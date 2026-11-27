import type { CitationRef, HostBridge, SourceChunkRecord, SourceRecord } from '../types.ts'
import { normalizeLocale, onboardingSampleCopy, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

export interface EmbeddingClient {
  embed(texts: string[], kind: 'query' | 'document'): Promise<number[][] | null>
}

export function createHostEmbeddingClient(): EmbeddingClient {
  const baseUrl = () => (process.env.MOMAI_API_URL || 'http://127.0.0.1:8050').replace(/\/$/, '')
  const token = () => process.env.MOMAI_SESSION_TOKEN || ''

  return {
    async embed(texts, kind) {
      if (texts.length === 0) return null
      try {
        const res = await fetch(`${baseUrl()}/extensions/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token()
          },
          body: JSON.stringify({ texts, kind }),
          signal: AbortSignal.timeout(45_000)
        })
        if (!res.ok) return null
        const data = (await res.json()) as { available?: boolean; vectors?: number[][] | null }
        return Array.isArray(data.vectors) ? data.vectors : null
      } catch {
        return null
      }
    }
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

const RRF_K = 60
const MIN_VECTOR_SIMILARITY = 0.35
const MMR_LAMBDA = 0.7

export interface RetrievedChunk extends SourceChunkRecord {
  score: number
}

export function wrapUntrustedSourceBlock(chunk: SourceChunkRecord): string {
  const safeText = chunk.text.replace(/<\/source_data>/gi, '&lt;/source_data&gt;')
  return `<source_data id="${chunk.sourceId}" title="${chunk.sourceTitle}" locator="${chunk.pageOrSlide}" section="${chunk.sectionTitle}">\n${safeText}\n</source_data>`
}

function localizeChunkMetadata(chunk: SourceChunkRecord, locale: DocsLocale): SourceChunkRecord {
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const pageMatch = /^Página (\d+)$/.exec(chunk.pageOrSlide)
  const sectionMatch = /^Seção (\d+)$/.exec(chunk.pageOrSlide)
  const sheetMatch = /^Aba (\d+)$/.exec(chunk.pageOrSlide)
  const workbookMatch = /^Planilha (\d+)$/.exec(chunk.pageOrSlide)
  const pageOrSlide = pageMatch
    ? tr('Página {number}', { number: pageMatch[1] })
    : sectionMatch
      ? tr('Seção {number}', { number: sectionMatch[1] })
      : sheetMatch
        ? tr('Aba {number}', { number: sheetMatch[1] })
        : workbookMatch
          ? tr('Planilha {number}', { number: workbookMatch[1] })
          : tr(chunk.pageOrSlide)
  const sectionTitle = tr(chunk.sectionTitle)
  const sourceTitle =
    chunk.sourceTitle === 'Relatório Piloto 2026 (Exemplo)'
      ? onboardingSampleCopy(locale).sourceTitle
      : chunk.sourceTitle
  return { ...chunk, pageOrSlide, sectionTitle, sourceTitle }
}

export class RagEngine {
  private readonly bridge: HostBridge
  private readonly embeddings: EmbeddingClient

  constructor(bridge: HostBridge, embeddings?: EmbeddingClient) {
    this.bridge = bridge
    this.embeddings = embeddings || createHostEmbeddingClient()
  }

  async indexChunks(chunks: SourceChunkRecord[]): Promise<{ indexed: number; embedded: number }> {
    if (chunks.length === 0) return { indexed: 0, embedded: 0 }

    let embedded = 0
    const batchSize = 16
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const vectors = await this.embeddings.embed(
        batch.map((c) => c.text),
        'document'
      )
      if (vectors && vectors.length === batch.length) {
        batch.forEach((c, idx) => {
          c.embedding = vectors[idx]
          c.embeddingModel = 'embeddinggemma-2'
          embedded += 1
        })
      }
    }

    await this.bridge.collections.upsertMany(
      'chunks',
      chunks as unknown as Array<Record<string, unknown>>
    )
    return { indexed: chunks.length, embedded }
  }

  async removeSourceChunks(sourceId: string): Promise<void> {
    const existing = (await this.bridge.collections.list('chunks', {
      where: { sourceId },
      limit: 500
    })) as SourceChunkRecord[]
    for (const row of existing) {
      if ((row as any)._rowId !== undefined) {
        await this.bridge.collections.remove('chunks', (row as any)._rowId)
      }
    }
  }

  async retrieve(opts: {
    projectId: string
    query: string
    limit?: number
    maxChars?: number
    activeSources?: SourceRecord[]
    ensureSourceCoverage?: boolean
    locale?: string
  }): Promise<{ chunks: RetrievedChunk[]; contextText: string; citations: CitationRef[] }> {
    const locale = normalizeLocale(opts.locale)
    const limit = Math.min(Math.max(1, opts.limit || 8), 24)
    const activeSources =
      opts.activeSources ||
      ((await this.bridge.collections.list('sources', {
        where: { projectId: opts.projectId, active: true },
        limit: 200
      })) as SourceRecord[])

    const activeIds = new Set(activeSources.filter((s) => s.active !== false).map((s) => s.id))
    const pinnedIds = new Set(activeSources.filter((s) => s.pinned).map((s) => s.id))

    if (activeIds.size === 0) {
      return { chunks: [], contextText: '', citations: [] }
    }

    // 1. Ensure active chunks have Gemma Embedding 2 vectors (self-heal if background indexing missed any)
    const cleanQuery = String(opts.query || '').trim()
    const allProjectChunks = (await this.bridge.collections.list('chunks', {
      where: { projectId: opts.projectId },
      limit: 1000
    })) as SourceChunkRecord[]

    const activeChunks = allProjectChunks.filter((c) => activeIds.has(c.sourceId))
    const byId = new Map<string, SourceChunkRecord>()
    for (const c of activeChunks) byId.set(c.id, c)

    const unembeddedChunks = activeChunks.filter((c) => !Array.isArray(c.embedding) || c.embedding.length === 0)
    if (unembeddedChunks.length > 0) {
      await this.indexChunks(unembeddedChunks.slice(0, 32)).catch(() => { })
    }

    // 2. Vector retrieval via Gemma Embedding 2 (primary semantic ranking)
    let vectorIds: string[] = []
    const vectorSims = new Map<string, number>()
    const embeddedChunks = activeChunks.filter((c) => Array.isArray(c.embedding) && c.embedding.length > 0)
    if (cleanQuery && embeddedChunks.length > 0) {
      const qVecs = await this.embeddings.embed([cleanQuery], 'query')
      const qVec = qVecs?.[0]
      if (qVec) {
        const scored = embeddedChunks
          .map((c) => ({ id: c.id, sourceId: c.sourceId, sim: cosineSimilarity(qVec, c.embedding!) }))
          .sort((a, b) => b.sim - a.sim)
        const topSim = scored[0]?.sim ?? 0
        const picked = scored
          .filter((item) => item.sim >= MIN_VECTOR_SIMILARITY && item.sim >= topSim * 0.78)
          .slice(0, limit * 3)
        const pickedIds = new Set(picked.map((item) => item.id))

        if (opts.ensureSourceCoverage && activeIds.size > 1) {
          const coveredSources = new Set(picked.map((item) => item.sourceId))
          for (const srcId of activeIds) {
            if (coveredSources.has(srcId)) continue
            const bestForSource = scored.filter((item) => item.sourceId === srcId).slice(0, 2)
            for (const item of bestForSource) {
              if (!pickedIds.has(item.id)) {
                picked.push(item)
                pickedIds.add(item.id)
              }
            }
          }
        }

        vectorIds = picked.map((item) => item.id)
        for (const item of picked) vectorSims.set(item.id, item.sim)
      }
    }

    // 3. Score candidates: pure semantic vector ranking when available; lexical fallback only when embeddings are unavailable
    const scores = new Map<string, number>()
    if (vectorIds.length > 0) {
      vectorIds.forEach((id, idx) => {
        const sim = vectorSims.get(id) ?? 0
        scores.set(id, sim + 1 / (RRF_K + idx + 1))
      })
    } else if (cleanQuery) {
      const lexicalRows = (await this.bridge.collections.search('chunks', cleanQuery, {
        where: { projectId: opts.projectId },
        limit: limit * 3
      })) as SourceChunkRecord[]
      lexicalRows
        .filter((r) => activeIds.has(r.sourceId))
        .forEach((r, idx) => {
          scores.set(r.id, (scores.get(r.id) || 0) + 1 / (RRF_K + idx + 1))
        })
    }

    // Cold-start fallback or generic request: include first chunks of pinned/active sources
    if (scores.size === 0) {
      if (opts.ensureSourceCoverage && activeIds.size > 1) {
        const bySource = new Map<string, SourceChunkRecord[]>()
        for (const c of activeChunks) {
          const list = bySource.get(c.sourceId) || []
          list.push(c)
          bySource.set(c.sourceId, list)
        }
        for (const list of bySource.values()) list.sort((a, b) => a.chunkIndex - b.chunkIndex)
        let rank = 0
        let added = true
        while (scores.size < limit && added) {
          added = false
          for (const list of bySource.values()) {
            const next = list.shift()
            if (next) {
              scores.set(next.id, 1 / (RRF_K + rank + 1))
              rank += 1
              added = true
              if (scores.size >= limit) break
            }
          }
        }
      } else {
        activeChunks
          .sort((a, b) => a.chunkIndex - b.chunkIndex)
          .slice(0, limit)
          .forEach((c, idx) => scores.set(c.id, 1 / (RRF_K + idx + 1)))
      }
    } else if (opts.ensureSourceCoverage && activeIds.size > 1) {
      // Ensure every active source with chunks has at least one candidate in the pool
      const represented = new Set<string>()
      for (const id of scores.keys()) {
        const c = byId.get(id)
        if (c) represented.add(c.sourceId)
      }
      const missingSources = [...activeIds].filter((sid) => !represented.has(sid))
      if (missingSources.length > 0) {
        const missingSet = new Set(missingSources)
        const firstByMissing = new Map<string, SourceChunkRecord>()
        for (const c of [...activeChunks].sort((a, b) => a.chunkIndex - b.chunkIndex)) {
          if (missingSet.has(c.sourceId) && !firstByMissing.has(c.sourceId)) {
            firstByMissing.set(c.sourceId, c)
          }
        }
        let rank = scores.size
        for (const c of firstByMissing.values()) {
          scores.set(c.id, 1 / (RRF_K + rank + 1))
          rank += 1
        }
      }
    }

    const queryTerms = cleanQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3)

    const candidates: Array<{ chunk: SourceChunkRecord; score: number }> = []
    for (const [id, baseScore] of scores.entries()) {
      const chunk = byId.get(id)
      if (!chunk) continue
      let boost = pinnedIds.has(chunk.sourceId) ? 0.015 : 0
      if (queryTerms.length > 0) {
        const lower = chunk.text.toLowerCase()
        const hits = queryTerms.filter((t) => lower.includes(t)).length
        boost += (hits / queryTerms.length) * 0.01
      }
      candidates.push({ chunk, score: baseScore + boost })
    }
    candidates.sort((a, b) => b.score - a.score)

    // 4. Source-balanced pre-selection (when requested) + MMR diversification across chunks
    const selected: RetrievedChunk[] = []
    const remaining = [...candidates]
    if (opts.ensureSourceCoverage && activeIds.size > 1) {
      const seenSources = new Set<string>()
      for (let i = 0; i < remaining.length && selected.length < limit; i++) {
        const cand = remaining[i]
        if (!seenSources.has(cand.chunk.sourceId)) {
          seenSources.add(cand.chunk.sourceId)
          selected.push({ ...cand.chunk, score: cand.score })
          remaining.splice(i, 1)
          i--
        }
      }
    }
    while (remaining.length > 0 && selected.length < limit) {
      let bestIdx = 0
      let bestMmr = -Infinity
      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i]
        let maxSim = 0
        if (cand.chunk.embedding) {
          for (const chosen of selected) {
            if (chosen.embedding) {
              maxSim = Math.max(maxSim, cosineSimilarity(cand.chunk.embedding, chosen.embedding))
            }
          }
        }
        const mmr = MMR_LAMBDA * cand.score - (1 - MMR_LAMBDA) * maxSim
        if (mmr > bestMmr) {
          bestMmr = mmr
          bestIdx = i
        }
      }
      const picked = remaining.splice(bestIdx, 1)[0]
      selected.push({ ...picked.chunk, score: picked.score })
    }

    const maxChars = opts.maxChars || 12_000
    const blocks: string[] = []
    const citations: CitationRef[] = []
    let used = 0

    const localizedChunks: RetrievedChunk[] = []
    for (const picked of selected) {
      const chunk = { ...localizeChunkMetadata(picked, locale), score: picked.score }
      const block = wrapUntrustedSourceBlock(chunk)
      if (used + block.length > maxChars && blocks.length > 0) break
      blocks.push(block)
      used += block.length
      localizedChunks.push(chunk)
      citations.push({
        sourceId: chunk.sourceId,
        sourceTitle: chunk.sourceTitle,
        locator: chunk.pageOrSlide,
        snippet: chunk.text.slice(0, 180)
      })
    }

    return {
      chunks: localizedChunks,
      contextText: blocks.join('\n\n'),
      citations
    }
  }
}
