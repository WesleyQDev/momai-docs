import { randomUUID } from 'node:crypto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { z } from 'zod'
import type {
  ArtifactRecord,
  ArtifactVersionRecord,
  BrandKit,
  CitationRef,
  ExportFormat,
  GroundingMode,
  HostBridge,
  ProjectRecord,
  SourceRecord,
  ToolId,
  UserProfile
} from './types.ts'
import { extractJsonCandidate, enforceSlotConstraints, LLMGateway } from './llm/llm-gateway.ts'
import {
  buildChapterDraftPrompt,
  buildChatSystemPrompt,
  buildDocumentEnvelopePrompt,
  buildGroundingSystemPrompt,
  buildOutlinePrompt,
  buildRefinePrompt,
  buildSlotFillPrompt
} from './llm/prompts/v1/index.ts'
import { chunkSections, ingestSource } from './rag/source-ingestor.ts'
import { discoverCuratedSources } from './rag/source-discovery.ts'
import { RagEngine } from './rag/rag-engine.ts'
import { normalizeLocale, outputLanguageRule, chatLanguageRule, defaultProjectName, isUntitledProject, onboardingSampleCopy, type DocsLocale } from './i18n.ts'
import { translateCore } from './translate.ts'
import { templateRegistry } from './templates/template-registry.ts'
import { localizeTemplate } from './templates/localize-template.ts'
import { extractRequestedLogoQuery, fetchWikimediaImageDataUrl } from './media/wikimedia-image.ts'
import { detectStudioGenerationIntent, mightBeStudioGenerationRequest } from './chat-studio-intent.ts'

const LOGO_CAPABLE_TOOLS = new Set<ToolId>([
  'oficio',
  'letterhead',
  'report',
  'apostila',
  'abnt',
  'pptx',
  'meeting_minutes',
  'contract'
])
import { createDefaultBrandKit, getBrandKitForProject, saveBrandKit } from './templates/brand-kit.ts'
import { renderDocxAndPdf } from './engines/docx-pdf-engine.ts'
import { analyzeLetterheadFile, fillDocxLetterhead, fillPdfLetterhead } from './engines/letterhead-engine.ts'
import { renderPptxAndPdf } from './engines/pptx-engine.ts'
import { renderPodcastArtifact } from './engines/podcast-engine.ts'
import { renderPngToJpg, renderSvgToPng, renderVideoArtifact } from './engines/video-engine.ts'
import {
  exportFlashcardsCsvAndAnki,
  renderMindMapOrTimelineSvg,
  renderXlsxWorkbook
} from './engines/study-data-engines.ts'

const OPEN_OBJECT_SCHEMA = z.record(z.string(), z.any())

function compactPreviewSvgsForStorage(svgs: string[], maxTotalBytes = 1_500_000): string[] {
  if (!Array.isArray(svgs) || svgs.length === 0) return []
  const totalBytes = svgs.reduce((acc, s) => acc + Buffer.byteLength(s || '', 'utf8'), 0)
  if (totalBytes <= maxTotalBytes) return svgs

  // Strip heavy embedded base64 images from SVG previews when persisting to collections
  // (the exported PDF/DOCX/PPTX files in sessionFiles always retain full-resolution images).
  const stripped = svgs.map((svg) =>
    svg.replace(/href="data:image\/[^"]{8192,}"/gi, 'href=""')
  )
  const strippedBytes = stripped.reduce((acc, s) => acc + Buffer.byteLength(s || '', 'utf8'), 0)
  if (strippedBytes <= maxTotalBytes) return stripped

  const out: string[] = []
  let accBytes = 0
  for (const s of stripped) {
    const b = Buffer.byteLength(s || '', 'utf8')
    if (accBytes + b > maxTotalBytes && out.length > 0) break
    out.push(s)
    accBytes += b
  }
  return out
}

export interface TrialState {
  firstUsedAt: number
  generationsCount: number
}

export class StudioOrchestrator {
  public readonly bridge: HostBridge
  public readonly llm: LLMGateway
  public readonly rag: RagEngine

  private cancelledRequestIds = new Set<string>()
  private completedByRequestId = new Map<string, ArtifactRecord>()

  constructor(bridge: HostBridge, llm?: LLMGateway, rag?: RagEngine) {
    this.bridge = bridge
    this.llm = llm || new LLMGateway()
    this.rag = rag || new RagEngine(bridge)
  }

  cancelGeneration(requestId: string): ArtifactRecord | null {
    if (requestId) this.cancelledRequestIds.add(requestId)
    return this.completedByRequestId.get(requestId) || null
  }

  isGenerationCancelled(requestId?: string): boolean {
    return Boolean(requestId && this.cancelledRequestIds.has(requestId))
  }

  async ensureOnboardingSampleProject(locale?: DocsLocale): Promise<ProjectRecord[]> {
    const resolvedLocale = normalizeLocale(locale)
    const copy = onboardingSampleCopy(resolvedLocale)
    const existing = (await this.bridge.collections.list('projects', { limit: 500 })) as ProjectRecord[]
    if (existing.length > 0) {
      return existing.map((project) =>
        project.isExample ? { ...project, name: copy.projectName, description: copy.projectDescription } : project
      )
    }

    const alreadySeeded = await this.bridge.storage.get<boolean>('onboarding_sample_seeded').catch(() => false)
    if (alreadySeeded) return []
    await this.bridge.storage.set('onboarding_sample_seeded', true)

    const projectId = 'proj-exemplo-onboarding'
    const now = Date.now()
    const sampleProject: ProjectRecord = {
      id: projectId,
      name: copy.projectName,
      description: copy.projectDescription,
      profile: 'general',
      groundingMode: 'sources_only',
      archived: false,
      isExample: true,
      createdAt: now,
      updatedAt: now
    }
    await this.bridge.collections.upsert('projects', sampleProject as unknown as Record<string, unknown>)

    await this.addSource({
      projectId,
      kind: 'text',
      title: copy.sourceTitle,
      text: copy.sourceText,
      pinned: true,
      locale: resolvedLocale
    })

    return [sampleProject]
  }

  async listProjects(locale?: DocsLocale): Promise<ProjectRecord[]> {
    return this.ensureOnboardingSampleProject(locale)
  }

  async createProject(opts: {
    name: string
    description?: string
    profile?: UserProfile
    groundingMode?: GroundingMode
    locale?: DocsLocale
  }): Promise<ProjectRecord> {
    const locale = normalizeLocale(opts.locale)
    const now = Date.now()
    const project: ProjectRecord = {
      id: `proj-${randomUUID().slice(0, 8)}`,
      name: opts.name.trim() || defaultProjectName(locale),
      description: (opts.description || '').trim(),
      profile: opts.profile || 'general',
      groundingMode: opts.groundingMode || 'sources_only',
      archived: false,
      createdAt: now,
      updatedAt: now
    }
    const isPlaceholder = isUntitledProject(project.name, locale)
    await Promise.all([
      this.bridge.collections.upsert('projects', project as unknown as Record<string, unknown>),
      saveBrandKit(this.bridge, createDefaultBrandKit(project.id, isPlaceholder ? '' : project.name, locale))
    ])
    return project
  }

  async deleteProject(projectId: string): Promise<{ ok: boolean }> {
    const projects = (await this.bridge.collections.list('projects', { where: { id: projectId }, limit: 1 })) as any[]
    if (projects[0]?._rowId !== undefined) {
      await this.bridge.collections.remove('projects', projects[0]._rowId)
    }
    const sources = (await this.bridge.collections.list('sources', { where: { projectId }, limit: 200 })) as any[]
    for (const s of sources) {
      await this.rag.removeSourceChunks(s.id)
      if (s._rowId !== undefined) await this.bridge.collections.remove('sources', s._rowId)
    }
    const artifacts = (await this.bridge.collections.list('artifacts', { where: { projectId }, limit: 200 })) as any[]
    for (const a of artifacts) {
      if (a._rowId !== undefined) await this.bridge.collections.remove('artifacts', a._rowId)
    }
    return { ok: true }
  }

  async addSource(opts: {
    projectId: string
    kind: 'file' | 'url' | 'youtube' | 'text'
    title?: string
    fileName?: string
    mimeType?: string
    contentBase64?: string
    text?: string
    url?: string
    pinned?: boolean
    locale?: DocsLocale
  }): Promise<SourceRecord> {
    const sourceId = `src-${randomUUID().slice(0, 8)}`
    const now = Date.now()
    const ingested = await ingestSource({
      projectId: opts.projectId,
      sourceId,
      kind: opts.kind,
      title: opts.title,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      contentBase64: opts.contentBase64,
      text: opts.text,
      url: opts.url,
      locale: opts.locale,
      llm: this.llm,
      bridge: this.bridge
    })

    // Deduplicate by contentHash inside the same project
    const existing = (await this.bridge.collections.list('sources', {
      where: { projectId: opts.projectId, contentHash: ingested.contentHash },
      limit: 1
    })) as SourceRecord[]
    if (existing[0]) return existing[0]

    const caps = await this.llm.getCapabilities().catch(() => null)
    const maxChunkChars = caps ? this.llm.recommendedRetrievalConfig(caps).maxChunkChars : 1100
    const chunks = chunkSections({
      projectId: opts.projectId,
      sourceId,
      sourceTitle: ingested.title,
      sections: ingested.sections,
      maxChunkChars
    })

    if (chunks.length > 0) {
      // Persist text chunks right away so retrieval works immediately, then compute
      // vector embeddings in the background without blocking the import UI.
      await this.bridge.collections.upsertMany(
        'chunks',
        chunks as unknown as Array<Record<string, unknown>>
      )
      void this.rag.indexChunks(chunks).catch(() => { })
    }

    const record: SourceRecord = {
      id: sourceId,
      projectId: opts.projectId,
      kind: opts.kind,
      title: ingested.title,
      originUrl: opts.url,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      status: 'ready',
      pinned: Boolean(opts.pinned),
      active: true,
      contentHash: ingested.contentHash,
      totalChars: ingested.totalChars,
      totalChunks: chunks.length,
      pageCount: ingested.pageCount,
      summary: ingested.summary,
      extractedImages: ingested.extractedImages,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now
    }
    await this.bridge.collections.upsert('sources', record as unknown as Record<string, unknown>)
    return record
  }

  async maybeAutoTitleProjectFromSources(
    projectId: string,
    localeInput?: DocsLocale
  ): Promise<ProjectRecord | null> {
    if (!projectId) return null
    const locale = normalizeLocale(localeInput)
    const projects = (await this.bridge.collections.list('projects', {
      where: { id: projectId },
      limit: 1
    })) as ProjectRecord[]
    const project = projects[0]
    if (!project || project.titleLocked) return null

    const allSources = (await this.bridge.collections.list('sources', {
      where: { projectId },
      limit: 100
    })) as SourceRecord[]
    const activeSources = allSources.filter((s) => s.active !== false)
    const sources = activeSources.length > 0 ? activeSources : allSources
    if (sources.length === 0) return null

    const cleanSourceTitle = (raw: string) =>
      String(raw || '')
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/^https?:\/\/(www\.)?/i, '')
        .trim()

    const fallbackTitle = cleanSourceTitle(sources[0].title || '').slice(0, 56)
    let nextTitle = fallbackTitle
    try {
      const titleLanguage = outputLanguageRule(locale)
      const projectChunks = (await this.bridge.collections.list('chunks', {
        where: { projectId },
        limit: 200
      })) as Array<{ sourceId: string; chunkIndex: number; text: string }>
      const chunkBySource = new Map<string, string>()
      for (const ch of projectChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)) {
        const prev = chunkBySource.get(ch.sourceId) || ''
        if (prev.length < 260) {
          chunkBySource.set(ch.sourceId, `${prev} ${ch.text.replace(/\s+/g, ' ').trim()}`.trim().slice(0, 260))
        }
      }
      const sourcesDigest = sources
        .slice(0, 15)
        .map((s, idx) => {
          const excerpt = chunkBySource.get(s.id) || String(s.summary || '').slice(0, 240)
          return `${idx + 1}. ${s.title}: ${excerpt}`
        })
        .join('\n')
      const res = await this.llm.completeText({
        system: `You create short, unified project titles (3 to 6 words) that accurately summarize the main subject across ALL attached sources together for study and document projects. Do not just copy a filename like "Aula 01". ${titleLanguage} Reply only with the title, without quotes, final punctuation or explanations.`,
        user: `Attached sources (${sources.length}):\n${sourcesDigest}`,
        temperature: 0.2,
        contextBudget: 'adaptive',
        timeoutMs: 30_000
      })
      const rawText = String(res.text || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim()
      const candidate = rawText
        .replace(/^["'«»*#\s]+|["'«»*.\s]+$/g, '')
        .split('\n')[0]
        .trim()
        .slice(0, 56)
      if (candidate && !isUntitledProject(candidate, locale)) {
        nextTitle = candidate
      } else {
        this.bridge.log?.(
          `Auto-title returned empty/untitled candidate (provider=${res.provider}, model=${res.model}, raw=${JSON.stringify(String(res.text || '').slice(0, 120))}) for project ${projectId}; using fallback "${fallbackTitle}"`
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.bridge.log?.(`Auto-title LLM failed for project ${projectId}: ${msg}`)
      // Fallback to cleaned source title when LLM is unavailable/busy
    }

    if (!nextTitle || isUntitledProject(nextTitle, locale)) return null
    if (nextTitle === String(project.name || '').trim()) return project
    const updated: ProjectRecord = {
      ...project,
      name: nextTitle,
      updatedAt: Date.now()
    }
    await this.bridge.collections.upsert('projects', updated as unknown as Record<string, unknown>)
    return updated
  }

  async maybeAutoTitleProjectFromSource(
    projectId: string,
    _source: SourceRecord,
    localeInput?: DocsLocale
  ): Promise<ProjectRecord | null> {
    return this.maybeAutoTitleProjectFromSources(projectId, localeInput)
  }

  async discoverSources(opts: { projectId: string; query: string; limit?: number; includeYouTube?: boolean; locale?: DocsLocale }) {
    return discoverCuratedSources(opts)
  }

  async querySources(opts: {
    projectId: string
    query: string
    limit?: number
    answerWithCitations?: boolean
    groundingMode?: GroundingMode
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    locale?: DocsLocale
  }) {
    const locale = normalizeLocale(opts.locale)
    const ragRes = await this.rag.retrieve({
      projectId: opts.projectId,
      query: opts.query,
      limit: opts.limit || 8,
      locale
    })
    if (!opts.answerWithCitations) {
      return { hits: ragRes.chunks, citations: ragRes.citations }
    }
    const hasSources = ragRes.chunks.length > 0
    const system = buildChatSystemPrompt({
      hasSources,
      groundingMode: opts.groundingMode || 'sources_only',
      locale
    })
    const userPrompt = hasSources
      ? `${chatLanguageRule(locale)}\n\nUser message: ${opts.query}\n\nSources (<source_data>):\n${ragRes.contextText}\n\nReply in natural text, citing sources and locators when you use information from them.`
      : `${chatLanguageRule(locale)}\n\nUser message: ${opts.query}`
    const sanitizedHistory = Array.isArray(opts.history)
      ? opts.history
        .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.trim())
        .slice(-12)
        .map((h) => ({ role: h.role, content: h.content.trim().slice(0, 4000) }))
      : []

    if (mightBeStudioGenerationRequest(opts.query)) {
      const intent = await detectStudioGenerationIntent({
        llm: this.llm,
        query: opts.query,
        history: sanitizedHistory,
        locale
      })
      if (intent?.shouldGenerate && intent.toolId) {
        const fallbackReply = translateCore(
          locale,
          'Perfeito! Iniciei a geração no Estúdio. Você pode acompanhar o progresso na seção Gerados.'
        )
        return {
          answer: intent.reply || fallbackReply,
          citations: ragRes.citations,
          provider: 'studio-intent',
          model: 'studio-intent',
          generatedAction: {
            toolId: intent.toolId,
            templateId: intent.templateId,
            instructions: intent.instructions || opts.query
          }
        }
      }
    }

    const res = await this.llm.completeText({
      system,
      history: sanitizedHistory,
      user: userPrompt,
      format: 'text'
    })
    return { answer: res.text, citations: ragRes.citations, provider: res.provider, model: res.model }
  }

  async checkAndConsumeTrialOrEntitlement(_entitledFromHost: boolean): Promise<{
    allowed: boolean
    reason?: string
    trialGenerationsLeft?: number
  }> {
    return { allowed: true }
  }

  async generateArtifact(opts: {
    projectId: string
    toolId: ToolId
    templateId?: string
    instructions?: string
    groundingMode?: GroundingMode
    letterheadFileBase64?: string
    letterheadFileName?: string
    options?: Record<string, any>
    requestId?: string
    locale?: DocsLocale
    onProgress?: (stage: string, percent: number, detail?: string) => void
  }): Promise<ArtifactRecord> {
    const locale = normalizeLocale(opts.locale)
    const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
    const checkCancelled = () => {
      if (opts.requestId && this.cancelledRequestIds.has(opts.requestId)) {
        this.cancelledRequestIds.delete(opts.requestId)
        throw new Error('__CANCELLED__')
      }
    }
    const reportProgress = (stage: string, percent: number, detail?: string) => {
      opts.onProgress?.(stage, percent, detail)
    }

    checkCancelled()

    reportProgress('planning', 10, tr('Carregando template e capacidades do modelo...'))
    const projects = (await this.bridge.collections.list('projects', { where: { id: opts.projectId }, limit: 1 })) as ProjectRecord[]
    const project = projects[0]
    const requestedMode: GroundingMode = opts.groundingMode || project?.groundingMode || 'sources_only'
    const isBrandMode = opts.templateId === '__brand__'
    const isAutoTemplate = !opts.templateId || opts.templateId === 'auto'
    const selectedTemplate =
      (!isBrandMode && !isAutoTemplate ? templateRegistry.getById(opts.templateId!) : undefined) ||
      templateRegistry.selectBestForContext(
        opts.toolId,
        `${opts.instructions || ''} ${project?.name || ''}`,
        project?.profile
      )
    const template = localizeTemplate(selectedTemplate, locale)
    const savedBrandKit = (await getBrandKitForProject(this.bridge, opts.projectId, locale)) || undefined
    const hasBrandOverrides = Boolean(
      opts.options?.brandLogoBase64 ||
      opts.options?.brandHeaderLogoBase64 ||
      opts.options?.brandFooterLogoBase64 ||
      opts.options?.brandHeaderText ||
      opts.options?.brandFooterText ||
      opts.options?.brandHeaderAlign ||
      opts.options?.brandFooterAlign ||
      opts.options?.brandLogoInHeader !== undefined ||
      opts.options?.brandLogoInFooter !== undefined ||
      opts.options?.brandPlacement
    )
    let brandKit: BrandKit | undefined = hasBrandOverrides
      ? {
        ...(savedBrandKit || createDefaultBrandKit(opts.projectId, '', locale)),
        logoDataUrl:
          typeof opts.options?.brandLogoBase64 === 'string' && opts.options.brandLogoBase64
            ? opts.options.brandLogoBase64
            : savedBrandKit?.logoDataUrl,
        headerLogoDataUrl:
          typeof opts.options?.brandHeaderLogoBase64 === 'string' && opts.options.brandHeaderLogoBase64
            ? opts.options.brandHeaderLogoBase64
            : typeof opts.options?.brandLogoBase64 === 'string' && opts.options.brandLogoBase64
              ? opts.options.brandLogoBase64
              : savedBrandKit?.headerLogoDataUrl,
        footerLogoDataUrl:
          typeof opts.options?.brandFooterLogoBase64 === 'string' && opts.options.brandFooterLogoBase64
            ? opts.options.brandFooterLogoBase64
            : savedBrandKit?.footerLogoDataUrl,
        headerAlign:
          opts.options?.brandHeaderAlign === 'left' || opts.options?.brandHeaderAlign === 'center' || opts.options?.brandHeaderAlign === 'right'
            ? opts.options.brandHeaderAlign
            : savedBrandKit?.headerAlign || 'right',
        footerAlign:
          opts.options?.brandFooterAlign === 'left' || opts.options?.brandFooterAlign === 'center' || opts.options?.brandFooterAlign === 'right'
            ? opts.options.brandFooterAlign
            : savedBrandKit?.footerAlign || 'right',
        logoInHeader:
          opts.options?.brandLogoInHeader !== undefined
            ? Boolean(opts.options.brandLogoInHeader)
            : opts.options?.brandPlacement === 'footer'
              ? false
              : true,
        logoInFooter:
          opts.options?.brandLogoInFooter !== undefined
            ? Boolean(opts.options.brandLogoInFooter)
            : opts.options?.brandPlacement === 'footer' || opts.options?.brandPlacement === 'both',
        logoPlacement:
          opts.options?.brandPlacement === 'footer' || opts.options?.brandPlacement === 'both'
            ? opts.options.brandPlacement
            : 'header',
        headerText:
          typeof opts.options?.brandHeaderText === 'string' && opts.options.brandHeaderText.trim()
            ? opts.options.brandHeaderText.trim()
            : savedBrandKit?.headerText,
        footerText:
          typeof opts.options?.brandFooterText === 'string' && opts.options.brandFooterText.trim()
            ? opts.options.brandFooterText.trim()
            : savedBrandKit?.footerText
      }
      : savedBrandKit

    if (
      LOGO_CAPABLE_TOOLS.has(opts.toolId) &&
      !brandKit?.headerLogoDataUrl &&
      !brandKit?.logoDataUrl &&
      opts.instructions
    ) {
      const requestedLogoQuery = extractRequestedLogoQuery(opts.instructions)
      if (requestedLogoQuery) {
        const fetchedLogo = await fetchWikimediaImageDataUrl(requestedLogoQuery, undefined, 400, { emblemOnly: true })
        if (fetchedLogo) {
          brandKit = {
            ...(brandKit || createDefaultBrandKit(opts.projectId, requestedLogoQuery, locale)),
            logoDataUrl: fetchedLogo,
            headerLogoDataUrl: fetchedLogo,
            logoInHeader: true,
            logoPlacement: 'header'
          }
        }
      }
    }

    const tokens = templateRegistry.applyBrandKit(template, brandKit)
    const caps = await this.llm.getCapabilities()
    const retrievalCfg = this.llm.recommendedRetrievalConfig(caps)
    const allProjectSources = (await this.bridge.collections.list('sources', {
      where: { projectId: opts.projectId },
      limit: 100
    })) as SourceRecord[]
    const activeSources = allProjectSources.filter((s) => s.active !== false)
    const effectiveTopK = Math.max(
      retrievalCfg.topK,
      Math.min(24, Math.max(activeSources.length * 2, retrievalCfg.topK))
    )

    reportProgress('retrieving', 25, tr('Buscando trechos relevantes nas fontes (Gemma Embedding + FTS5)...'))
    const ragRes = await this.rag.retrieve({
      projectId: opts.projectId,
      query: opts.instructions || `${template.name} ${project?.name || ''}`,
      limit: effectiveTopK,
      maxChars: effectiveTopK * retrievalCfg.maxChunkChars,
      activeSources,
      ensureSourceCoverage: true,
      locale
    })

    if (ragRes.chunks.length === 0 && requestedMode === 'sources_only' && !opts.instructions?.trim() && !project?.name?.trim()) {
      throw new Error(tr('Adicione ao menos uma fonte ou preencha as instruções antes de gerar.'))
    }
    const groundingMode: GroundingMode = ragRes.chunks.length === 0 ? 'sources_plus_general' : requestedMode

    const systemPrompt = buildGroundingSystemPrompt({
      groundingMode,
      locale,
      compact: this.llm.isCompactModel(caps),
      hasSources: ragRes.chunks.length > 0,
      toolId: opts.toolId
    })

    const attachmentItems: Array<{ name: string; base64: string; caption?: string }> = Array.isArray(opts.options?.attachments)
      ? opts.options.attachments
      : []
    const attachmentNote =
      attachmentItems.length > 0
        ? `\n\n[Visual attachments included by the user: ${attachmentItems.map((a) => a.caption || a.name).join(', ')}. Embed these files in the "Attachments" section at the end of the document and mention them in the text when appropriate.]`
        : ''
    const baseTopic =
      opts.instructions?.trim() ||
      (ragRes.chunks.length === 0 && project?.name && !isUntitledProject(project.name, locale)
        ? project.name.trim()
        : '')
    const effectiveInstructions = `${baseTopic}${attachmentNote}`.trim()

    const targetSizeHint =
      typeof opts.options?.targetSizeHint === 'string' && opts.options.targetSizeHint.trim()
        ? opts.options.targetSizeHint.trim()
        : undefined

    const speakerCount: 1 | 2 =
      opts.options?.speakerCount === 1
        ? 1
        : opts.options?.speakerCount === 2
          ? 2
          : opts.toolId === 'podcast' || opts.toolId === 'video'
            ? 2
            : 1

    // Map-reduce outline step for large materials or compact models
    let outlineJson: string | undefined
    if (retrievalCfg.useOutlineFirst || ['apostila', 'abnt', 'report', 'pptx', 'video'].includes(opts.toolId)) {
      reportProgress('outlining', 40, tr('Estruturando outline fundamentado nas fontes...'))
      const summaries = activeSources
        .slice(0, 50)
        .map((s) => {
          const sourceChunks = ragRes.chunks.filter((c) => c.sourceId === s.id)
          const chunkHighlights = sourceChunks
            .slice(0, 2)
            .map((c) => c.text.replace(/\s+/g, ' ').trim().slice(0, 220))
            .filter(Boolean)
            .join(' | ')
          const summaryText = chunkHighlights || s.summary
          return `- [${s.id}] ${s.title}: ${summaryText}`
        })
        .join('\n')
      const outlineRes = await this.llm.completeText({
        system: systemPrompt,
        user: buildOutlinePrompt({
          toolId: opts.toolId,
          templateName: template.name,
          instructions: effectiveInstructions,
          sourceSummaries: summaries,
          compact: this.llm.isCompactModel(caps),
          targetSizeHint,
          speakerCount
        }),
        format: 'json'
      })
      outlineJson = outlineRes.text
    }

    const brandNote = isBrandMode && brandKit
      ? ` Prioritize the user's letterhead identity (${brandKit.institutionName || brandKit.name || 'Brand Kit'}) while keeping creative freedom in the visual organization of the blocks.`
      : ''

    const parsedOutline = outlineJson ? (extractJsonCandidate(outlineJson) as Record<string, any> | undefined) : undefined
    const outlineSections = Array.isArray(parsedOutline?.sections) ? parsedOutline.sections : []
    const supportsIncrementalDraft =
      ['apostila', 'abnt', 'report'].includes(opts.toolId) && outlineSections.length >= 2

    let structuredData: Record<string, any> | null = null
    let modelUsed = caps.model
    let providerUsed = caps.provider

    if (supportsIncrementalDraft) {
      const targetSections = outlineSections.slice(0, 6)
      const draftedItems: Array<Record<string, any>> = []
      for (let idx = 0; idx < targetSections.length; idx++) {
        checkCancelled()
        const pct = Math.round(46 + ((idx + 1) / (targetSections.length + 1)) * 24)
        reportProgress('drafting', pct, tr('Redigindo módulo {current}/{total}...', { current: idx + 1, total: targetSections.length }))
        const sec = targetSections[idx] || {}
        const secSourceIds = Array.isArray(sec.sourceIds)
          ? new Set(sec.sourceIds.filter((id: unknown): id is string => typeof id === 'string'))
          : null
        const secSources =
          secSourceIds && secSourceIds.size > 0
            ? activeSources.filter((s) => secSourceIds.has(s.id))
            : []
        const chapterRag =
          activeSources.length > 0
            ? await this.rag
                .retrieve({
                  projectId: opts.projectId,
                  query: `${sec.heading || ''} ${sec.objective || ''} ${effectiveInstructions}`.trim(),
                  limit: Math.min(retrievalCfg.topK, 10),
                  maxChars: Math.min(retrievalCfg.topK, 10) * retrievalCfg.maxChunkChars,
                  activeSources: secSources.length > 0 ? secSources : activeSources,
                  ensureSourceCoverage: true,
                  locale
                })
                .catch(() => null)
            : null
        const chPrompt = buildChapterDraftPrompt({
          toolId: opts.toolId,
          templateName: isBrandMode ? `${template.name} (User Letterhead)` : template.name,
          styleGuide: `${template.styleGuideForAgent}${brandNote}`,
          chapterIndex: idx,
          totalChapters: targetSections.length,
          outlineSection: sec,
          contextBlocks: chapterRag?.contextText || ragRes.contextText,
          instructions: effectiveInstructions,
          targetSizeHint,
          locale
        })
        const chRes = await this.llm
          .completeStructured({
            system: systemPrompt,
            user: chPrompt,
            schema: OPEN_OBJECT_SCHEMA,
            locale
          })
          .catch(() => null)
        if (chRes?.data) {
          draftedItems.push(chRes.data)
          modelUsed = chRes.model
          providerUsed = chRes.provider
        }
      }

      if (draftedItems.length >= 2) {
        checkCancelled()
        reportProgress('drafting', 72, tr('Finalizando capa, glossário e referências...'))
        const chapterTitles = draftedItems.map(
          (item, i) => String(item.title || item.heading || targetSections[i]?.heading || tr('Módulo {number}', { number: i + 1 }))
        )
        const envPrompt = buildDocumentEnvelopePrompt({
          toolId: opts.toolId,
          templateName: isBrandMode ? `${template.name} (User Letterhead)` : template.name,
          outlineTitle: typeof parsedOutline?.title === 'string' ? parsedOutline.title : undefined,
          outlineSubtitle: typeof parsedOutline?.subtitle === 'string' ? parsedOutline.subtitle : undefined,
          chapterTitles,
          instructions: effectiveInstructions,
          contextBlocks: ragRes.contextText
        })
        const envRes = await this.llm
          .completeStructured({
            system: systemPrompt,
            user: envPrompt,
            schema: OPEN_OBJECT_SCHEMA,
            locale
          })
          .catch(() => null)

        const rawCombined: Record<string, any> = {
          ...(envRes?.data || { title: parsedOutline?.title || effectiveInstructions }),
          ...(opts.toolId === 'apostila' ? { chapters: draftedItems } : { sections: draftedItems })
        }
        structuredData = enforceSlotConstraints(rawCombined, template.slots, locale).sanitized
      }
    }

    if (!structuredData) {
      reportProgress('drafting', 58, tr('Redigindo conteúdo estruturado e validando schema...'))
      const fillPrompt = buildSlotFillPrompt({
        toolId: opts.toolId,
        templateName: isBrandMode ? `${template.name} (User Letterhead)` : template.name,
        styleGuide: `${template.styleGuideForAgent}${brandNote}`,
        slots: template.slots,
        contextBlocks: ragRes.contextText,
        instructions: effectiveInstructions,
        outlineJson,
        targetSizeHint,
        speakerCount
      })

      checkCancelled()
      const structuredRes = await this.llm.completeStructured({
        system: systemPrompt,
        user: fillPrompt,
        schema: OPEN_OBJECT_SCHEMA,
        slots: template.slots,
        locale
      })

      checkCancelled()
      structuredData = structuredRes.data
      modelUsed = structuredRes.model
      providerUsed = structuredRes.provider
    }

    // Editorial reviewer pass: catch shallow modules (e.g. 1-paragraph chapters with no blocks/exercises)
    if (opts.toolId === 'apostila' && Array.isArray(structuredData.chapters)) {
      const hasShallowChapter = structuredData.chapters.some((ch: any) => {
        const secs = Array.isArray(ch?.sections) ? ch.sections : []
        const hasRichBlock = secs.some(
          (s: any) => s?.table || s?.comparison || s?.timeline?.length || s?.checklist?.length || s?.example || s?.callout
        )
        const totalChars =
          String(ch?.summary || ch?.body || ch?.content || '').length +
          secs.reduce((acc: number, s: any) => acc + String(s?.body || s?.content || s?.text || '').length, 0)
        const hasExercises = Array.isArray(ch?.exercises) && ch.exercises.length > 0
        return totalChars < 320 && !hasRichBlock && !hasExercises
      })
      if (structuredData.chapters.length < 2 || hasShallowChapter) {
        reportProgress('reviewing', 68, tr('Revisando qualidade editorial e profundidade do material...'))
        const expandPrompt = buildRefinePrompt({
          currentJson: JSON.stringify(structuredData),
          instruction:
            structuredData.chapters.length < 2
              ? 'Expand "chapters" into 3 to 4 complete, in-depth modules covering the core topics of the subject (keep any useful existing module and add new modules with applied theory, concrete examples, visual blocks like table/comparison/checklist, and at least 2 commented exercises per module). Write in the target document language.'
              : 'Review and enrich every shallow chapter in "chapters": ensure each module has 2 to 3 substantive sections with real explanations, at least one concrete example or visual block (table, comparison, timeline, or checklist), and 2 to 3 commented exercises. Keep all factual grounding intact and write in the target document language.',
          contextBlocks: ragRes.contextText,
          targetSizeHint
        })
        const expandedRes = await this.llm
          .completeStructured({
            system: systemPrompt,
            user: expandPrompt,
            schema: OPEN_OBJECT_SCHEMA,
            slots: template.slots,
            locale
          })
          .catch(() => null)
        if (expandedRes?.data && Array.isArray(expandedRes.data.chapters) && expandedRes.data.chapters.length >= structuredData.chapters.length) {
          Object.assign(structuredData, expandedRes.data)
        }
      }
    }

    const citations: CitationRef[] = Array.isArray(structuredData.citations)
      ? structuredData.citations
      : ragRes.citations

    reportProgress('rendering', 75, tr('Renderizando artefato final e pré-visualizações...'))
    const artifactId = `art-${randomUUID().slice(0, 8)}`
    const rendered = await this.renderArtifactOutputs({
      artifactId,
      versionNumber: 1,
      toolId: opts.toolId,
      templateId: template.id,
      tokens,
      structuredData,
      brandKit,
      letterheadFileBase64: opts.letterheadFileBase64,
      letterheadFileName: opts.letterheadFileName,
      options: opts.options,
      locale
    })

    reportProgress('visual_qa', 92, tr('Executando checagem de qualidade visual automática...'))
    const now = Date.now()
    const title = String(
      structuredData.title ||
      structuredData.documentTitle ||
      structuredData.documentNumber ||
      structuredData.deckTitle ||
      structuredData.rootLabel ||
      structuredData.workbookTitle ||
      structuredData.fullName ||
      template.name
    )

    const storedPreviewSvgs = compactPreviewSvgsForStorage(rendered.previewSvgs)
    const artifact: ArtifactRecord = {
      id: artifactId,
      projectId: opts.projectId,
      toolId: opts.toolId,
      templateId: template.id,
      title,
      summary: `${template.name} • ${tr('{count} citações', { count: citations.length })}`,
      status: 'ready',
      currentVersion: 1,
      groundingMode,
      providerUsed,
      modelUsed,
      structuredData,
      citations,
      previewSvgs: storedPreviewSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      createdAt: now,
      updatedAt: now
    }

    const versionRecord: ArtifactVersionRecord = {
      id: `${artifactId}-v1`,
      artifactId,
      versionNumber: 1,
      instruction: opts.instructions || tr('Geração inicial'),
      structuredData,
      citations,
      previewSvgs: storedPreviewSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      createdAt: now
    }

    checkCancelled()
    await this.bridge.collections.upsert('artifacts', artifact as unknown as Record<string, unknown>)
    await this.bridge.collections.upsert('artifact_versions', versionRecord as unknown as Record<string, unknown>)

    // Auto-title placeholder project using the LLM-generated artifact title
    if (
      project &&
      !project.titleLocked &&
      title &&
      isUntitledProject(project.name, locale)
    ) {
      const updatedProject: ProjectRecord = {
        ...project,
        name: title.slice(0, 64),
        updatedAt: now
      }
      await this.bridge.collections.upsert('projects', updatedProject as unknown as Record<string, unknown>)
    }
    if (opts.requestId) {
      this.completedByRequestId.set(opts.requestId, artifact)
      if (this.completedByRequestId.size > 30) {
        const oldestKey = this.completedByRequestId.keys().next().value
        if (oldestKey) this.completedByRequestId.delete(oldestKey)
      }
    }
    reportProgress('done', 100, tr('Artefato pronto!'))
    return artifact
  }

  private async renderArtifactOutputs(opts: {
    artifactId: string
    versionNumber: number
    toolId: ToolId
    templateId: string
    tokens: any
    structuredData: Record<string, any>
    brandKit?: BrandKit | null
    letterheadFileBase64?: string
    letterheadFileName?: string
    options?: Record<string, any>
    locale?: DocsLocale
  }): Promise<{
    previewSvgs: string[]
    exportFiles: Partial<Record<ExportFormat, string>>
    qaReport: any
  }> {
    const locale = normalizeLocale(opts.locale)
    const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
    const baseDir = `artifacts/${opts.artifactId}/v${opts.versionNumber}`
    const exportFiles: Partial<Record<ExportFormat, string>> = {}

    if (opts.toolId === 'letterhead' && opts.letterheadFileBase64) {
      const raw = opts.letterheadFileBase64.replace(/^data:[^;]+;base64,/, '')
      const tplBuf = Buffer.from(raw, 'base64')
      const isPdf = (opts.letterheadFileName || '').toLowerCase().endsWith('.pdf')
      if (isPdf) {
        const analysis = await analyzeLetterheadFile(opts.letterheadFileName || 'letterhead.pdf', tplBuf)
        const pdfRes = await fillPdfLetterhead({
          templateBuffer: tplBuf,
          documentTitle: opts.structuredData.documentTitle,
          fields: opts.structuredData.fields,
          paragraphs: Array.isArray(opts.structuredData.paragraphs) ? opts.structuredData.paragraphs : [],
          signatureBlock: opts.structuredData.signatureBlock,
          safeZone: analysis.safeZone,
          locale
        })
        const pdfPath = `${baseDir}/${tr('timbrado-preenchido')}.pdf`
        await this.bridge.sessionFiles.write(pdfPath, pdfRes.buffer)
        exportFiles.pdf = pdfPath
        return { previewSvgs: pdfRes.previewSvgs, exportFiles, qaReport: pdfRes.qaReport }
      }
      const docxRes = fillDocxLetterhead({
        templateBuffer: tplBuf,
        documentTitle: opts.structuredData.documentTitle,
        fields: opts.structuredData.fields,
        paragraphs: Array.isArray(opts.structuredData.paragraphs) ? opts.structuredData.paragraphs : [],
        signatureBlock: opts.structuredData.signatureBlock,
        locale
      })
      const docxPath = `${baseDir}/${tr('timbrado-preenchido')}.docx`
      await this.bridge.sessionFiles.write(docxPath, docxRes.buffer)
      exportFiles.docx = docxPath
      const fallbackPdf = await renderDocxAndPdf({
        toolId: 'oficio',
        template: localizeTemplate(templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool('oficio'), locale),
        tokens: opts.tokens,
        data: opts.structuredData,
        brandKit: opts.brandKit,
        locale: opts.locale
      })
      const pdfPath = `${baseDir}/${tr('timbrado-preenchido')}.pdf`
      await this.bridge.sessionFiles.write(pdfPath, fallbackPdf.pdfBuffer)
      exportFiles.pdf = pdfPath
      return { previewSvgs: fallbackPdf.previewSvgs, exportFiles, qaReport: fallbackPdf.qaReport }
    }

    if (opts.toolId === 'pptx') {
      const pptxTpl = localizeTemplate(templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool('pptx'), locale)
      const caps = await this.llm.getCapabilities().catch(() => ({ visionSupported: false }))
      const res = await renderPptxAndPdf({
        tokens: opts.tokens,
        data: opts.structuredData,
        brandKit: opts.brandKit,
        layoutPreset: pptxTpl.layoutPreset,
        locale: opts.locale,
        selectBestImage: caps.visionSupported
          ? async ({ slideTitle, imageQuery, candidates, allowFallbackPick }) => {
              const evaluated = await Promise.all(
                candidates.slice(0, 3).map(async (c) => {
                  const ans = await this.llm
                    .analyzeImage({
                      imageBase64: c.dataUrl,
                      prompt:
                        `Slide title: "${slideTitle}". Search query: "${imageQuery}". ` +
                        `Is this image clean, relevant, and appropriate as an illustration for this slide (no distracting watermarks or unrelated content)? ` +
                        `Reply ONLY with "YES <score 6-10>" or "NO <score 1-5>".`,
                      maxTokens: 20
                    })
                    .catch(() => ({ text: '', visionAvailable: false }))
                  if (!ans.visionAvailable) return { dataUrl: c.dataUrl, accepted: true, score: 6 }
                  const mYes = /^\s*YES(?:\s+(\d+(?:\.\d+)?))?/i.exec(ans.text || '')
                  if (mYes) return { dataUrl: c.dataUrl, accepted: true, score: Number(mYes[1] || 7) }
                  const mNo = /^\s*NO(?:\s+(\d+(?:\.\d+)?))?/i.exec(ans.text || '')
                  return { dataUrl: c.dataUrl, accepted: false, score: Number(mNo?.[1] || 2) }
                })
              )
              const accepted = evaluated.filter((e) => e.accepted).sort((a, b) => b.score - a.score)
              if (accepted.length > 0) return accepted[0].dataUrl
              if (allowFallbackPick && evaluated.length > 0) {
                const bestAny = [...evaluated].sort((a, b) => b.score - a.score)
                return bestAny[0].dataUrl
              }
              return null
            }
          : undefined
      })
      await this.bridge.sessionFiles.write(`${baseDir}/${tr('apresentacao')}.pptx`, res.pptxBuffer)
      await this.bridge.sessionFiles.write(`${baseDir}/${tr('apresentacao')}.pdf`, res.pdfBuffer)
      exportFiles.pptx = `${baseDir}/${tr('apresentacao')}.pptx`
      exportFiles.pdf = `${baseDir}/${tr('apresentacao')}.pdf`
      return { previewSvgs: res.previewSvgs, exportFiles, qaReport: res.qaReport }
    }

    if (opts.toolId === 'podcast') {
      const res = await renderPodcastArtifact({
        bridge: this.bridge,
        title: String(opts.structuredData.title || 'Podcast MomAI Docs'),
        turns: Array.isArray(opts.structuredData.turns) ? opts.structuredData.turns : [],
        voiceA: opts.options?.voiceA,
        voiceB: opts.options?.voiceB,
        locale: opts.locale
      })
      await this.bridge.sessionFiles.write(`${baseDir}/podcast.mp3`, res.mp3Buffer)
      await this.bridge.sessionFiles.write(`${baseDir}/podcast.wav`, res.wavBuffer)
      if (opts.options?.includeSubtitles !== false) {
        await this.bridge.sessionFiles.write(`${baseDir}/podcast.srt`, res.srtText)
        exportFiles.srt = `${baseDir}/podcast.srt`
      }
      await this.bridge.sessionFiles.write(`${baseDir}/${tr('transcricao')}.md`, res.transcriptMarkdown)
      exportFiles.mp3 = `${baseDir}/podcast.mp3`
      exportFiles.wav = `${baseDir}/podcast.wav`
      exportFiles.md = `${baseDir}/${tr('transcricao')}.md`
      return {
        previewSvgs: [],
        exportFiles,
        qaReport: { passed: true, checkedAt: Date.now(), pagesOrSlidesChecked: 1, issues: [], repairsApplied: 0 }
      }
    }

    if (opts.toolId === 'video') {
      const ratio = opts.structuredData.aspectRatio === '9:16' ? '9:16' : '16:9'
      const includeSubtitles =
        opts.options?.includeSubtitles === true || opts.structuredData.includeSubtitles === true
      const videoTpl = localizeTemplate(templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool('video'), locale)
      const res = await renderVideoArtifact({
        title: String(opts.structuredData.title || tr('Vídeo MomAI Docs')),
        aspectRatio: ratio,
        scenes: Array.isArray(opts.structuredData.scenes) ? opts.structuredData.scenes : [],
        tokens: opts.tokens,
        layoutPreset: videoTpl.layoutPreset,
        voice: opts.options?.voice,
        voiceB: opts.options?.speakerCount === 2 ? opts.options?.voiceB : undefined,
        speakerCount: opts.options?.speakerCount === 2 ? 2 : 1,
        includeSubtitles,
        subtitleStyle:
          opts.structuredData.subtitleStyle && typeof opts.structuredData.subtitleStyle === 'object'
            ? opts.structuredData.subtitleStyle
            : undefined,
        attachments: Array.isArray(opts.options?.attachments) ? opts.options.attachments : undefined,
        locale: opts.locale
      })
      if (res.mp4Buffer) {
        await this.bridge.sessionFiles.write(`${baseDir}/video.mp4`, res.mp4Buffer)
        exportFiles.mp4 = `${baseDir}/video.mp4`
      }
      if (res.mp3Buffer) {
        await this.bridge.sessionFiles.write(`${baseDir}/audio.mp3`, res.mp3Buffer)
        exportFiles.mp3 = `${baseDir}/audio.mp3`
      }
      if (includeSubtitles) {
        await this.bridge.sessionFiles.write(`${baseDir}/${tr('legendas')}.srt`, res.srtText)
        exportFiles.srt = `${baseDir}/${tr('legendas')}.srt`
      }
      return { previewSvgs: res.previewSvgs, exportFiles, qaReport: res.qaReport }
    }

    if (opts.toolId === 'xlsx') {
      const xlsxBuf = renderXlsxWorkbook({
        sheets: Array.isArray(opts.structuredData.sheets) ? opts.structuredData.sheets : [],
        tokens: opts.tokens,
        locale
      })
      await this.bridge.sessionFiles.write(`${baseDir}/${tr('planilha')}.xlsx`, xlsxBuf)
      exportFiles.xlsx = `${baseDir}/${tr('planilha')}.xlsx`
      return {
        previewSvgs: [],
        exportFiles,
        qaReport: { passed: true, checkedAt: Date.now(), pagesOrSlidesChecked: 1, issues: [], repairsApplied: 0 }
      }
    }

    if (opts.toolId === 'mindmap') {
      const res = renderMindMapOrTimelineSvg({
        rootLabel: String(opts.structuredData.rootLabel || tr('Mapa Mental')),
        mode: opts.structuredData.mode === 'timeline' ? 'timeline' : 'mindmap',
        nodes: Array.isArray(opts.structuredData.nodes) ? opts.structuredData.nodes : [],
        tokens: opts.tokens,
        locale
      })
      await this.bridge.sessionFiles.write(`${baseDir}/${tr('diagrama')}.svg`, res.svg)
      exportFiles.svg = `${baseDir}/${tr('diagrama')}.svg`
      try {
        const pngBuf = await renderSvgToPng(res.svg)
        await this.bridge.sessionFiles.write(`${baseDir}/${tr('diagrama')}.png`, pngBuf)
        exportFiles.png = `${baseDir}/${tr('diagrama')}.png`
        const jpgBuf = await renderPngToJpg(pngBuf)
        if (jpgBuf) {
          await this.bridge.sessionFiles.write(`${baseDir}/${tr('diagrama')}.jpg`, jpgBuf)
          exportFiles.jpg = `${baseDir}/${tr('diagrama')}.jpg`
        }
      } catch {
        // Keep SVG export even if PNG/JPG rasterization fails
      }
      return { previewSvgs: [res.svg], exportFiles, qaReport: res.qaReport }
    }

    if (opts.toolId === 'flashcards') {
      const exp = exportFlashcardsCsvAndAnki({
        deckTitle: String(opts.structuredData.deckTitle || 'Quiz'),
        cards: Array.isArray(opts.structuredData.cards) ? opts.structuredData.cards : [],
        locale
      })
      await this.bridge.sessionFiles.write(`${baseDir}/quiz.csv`, exp.csvText)
      await this.bridge.sessionFiles.write(`${baseDir}/quiz-anki.txt`, exp.ankiTsvText)
      exportFiles.csv = `${baseDir}/quiz.csv`
      exportFiles.anki = `${baseDir}/quiz-anki.txt`
      return {
        previewSvgs: [],
        exportFiles,
        qaReport: { passed: true, checkedAt: Date.now(), pagesOrSlidesChecked: 1, issues: [], repairsApplied: 0 }
      }
    }

    const docRes = await renderDocxAndPdf({
      toolId: opts.toolId,
      template: localizeTemplate(templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool(opts.toolId), locale),
      tokens: opts.tokens,
      data: opts.structuredData,
      brandKit: opts.brandKit,
      attachments: Array.isArray(opts.options?.attachments) ? opts.options.attachments : undefined,
      locale: opts.locale
    })
    await this.bridge.sessionFiles.write(`${baseDir}/${tr('documento')}.docx`, docRes.docxBuffer)
    await this.bridge.sessionFiles.write(`${baseDir}/${tr('documento')}.pdf`, docRes.pdfBuffer)
    exportFiles.docx = `${baseDir}/${tr('documento')}.docx`
    exportFiles.pdf = `${baseDir}/${tr('documento')}.pdf`
    return { previewSvgs: docRes.previewSvgs, exportFiles, qaReport: docRes.qaReport }
  }

  async refineArtifact(opts: {
    artifactId: string
    instruction?: string
    targetSectionOrSlide?: string
    revertToVersion?: number
    targetSizeHint?: string
    locale?: DocsLocale
  }): Promise<ArtifactRecord> {
    const locale = normalizeLocale(opts.locale)
    const found = (await this.bridge.collections.list('artifacts', {
      where: { id: opts.artifactId },
      limit: 1
    })) as ArtifactRecord[]
    const current = found[0]
    if (!current) throw new Error(translateCore(locale, 'Artefato não encontrado.'))

    if (typeof opts.revertToVersion === 'number') {
      const versions = (await this.bridge.collections.list('artifact_versions', {
        where: { artifactId: opts.artifactId, versionNumber: opts.revertToVersion },
        limit: 1
      })) as ArtifactVersionRecord[]
      const target = versions[0]
      if (!target) throw new Error(translateCore(locale, 'Versão {version} não encontrada.', { version: opts.revertToVersion }))
      const reverted: ArtifactRecord = {
        ...current,
        currentVersion: target.versionNumber,
        structuredData: target.structuredData,
        citations: target.citations,
        previewSvgs: target.previewSvgs,
        exportFiles: target.exportFiles,
        qaReport: target.qaReport,
        updatedAt: Date.now()
      }
      await this.bridge.collections.upsert('artifacts', reverted as unknown as Record<string, unknown>)
      return reverted
    }

    if (!opts.instruction?.trim()) throw new Error(translateCore(locale, 'Informe uma instrução de refino.'))
    const ragRes = await this.rag.retrieve({
      projectId: current.projectId,
      query: opts.instruction,
      limit: 6,
      locale
    })
    const caps = await this.llm.getCapabilities()
    const system = buildGroundingSystemPrompt({
      groundingMode: current.groundingMode,
      locale,
      compact: this.llm.isCompactModel(caps),
      hasSources: ragRes.chunks.length > 0,
      toolId: current.toolId
    })
    const refinedRes = await this.llm.completeStructured({
      system,
      user: buildRefinePrompt({
        currentJson: JSON.stringify(current.structuredData),
        instruction: opts.instruction,
        targetSectionOrSlide: opts.targetSectionOrSlide,
        contextBlocks: ragRes.contextText,
        targetSizeHint: opts.targetSizeHint
      }),
      schema: OPEN_OBJECT_SCHEMA,
      locale
    })

    const nextVersion = current.currentVersion + 1
    const template = localizeTemplate(
      templateRegistry.getById(current.templateId) || templateRegistry.getDefaultForTool(current.toolId),
      locale
    )
    const brandKit = await getBrandKitForProject(this.bridge, current.projectId, locale)
    const tokens = templateRegistry.applyBrandKit(template, brandKit)

    const rendered = await this.renderArtifactOutputs({
      artifactId: current.id,
      versionNumber: nextVersion,
      toolId: current.toolId,
      templateId: current.templateId,
      tokens,
      structuredData: refinedRes.data,
      brandKit,
      locale
    })

    const storedRefinedSvgs = compactPreviewSvgsForStorage(rendered.previewSvgs)
    const updated: ArtifactRecord = {
      ...current,
      currentVersion: nextVersion,
      structuredData: refinedRes.data,
      previewSvgs: storedRefinedSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      providerUsed: refinedRes.provider,
      modelUsed: refinedRes.model,
      updatedAt: Date.now()
    }
    const verRecord: ArtifactVersionRecord = {
      id: `${current.id}-v${nextVersion}`,
      artifactId: current.id,
      versionNumber: nextVersion,
      instruction: opts.instruction,
      structuredData: refinedRes.data,
      citations: current.citations,
      previewSvgs: storedRefinedSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      createdAt: Date.now()
    }
    await this.bridge.collections.upsert('artifacts', updated as unknown as Record<string, unknown>)
    await this.bridge.collections.upsert('artifact_versions', verRecord as unknown as Record<string, unknown>)
    return updated
  }

  async exportProjectBundle(projectId: string, locale?: DocsLocale): Promise<{ fileName: string; base64: string }> {
    const resolvedLocale = normalizeLocale(locale)
    const projects = (await this.bridge.collections.list('projects', { where: { id: projectId }, limit: 1 })) as ProjectRecord[]
    if (!projects[0]) throw new Error(translateCore(resolvedLocale, 'Projeto não encontrado'))
    const sources = await this.bridge.collections.list('sources', { where: { projectId }, limit: 200 })
    const artifacts = await this.bridge.collections.list('artifacts', { where: { projectId }, limit: 200 })
    const brandKit = await getBrandKitForProject(this.bridge, projectId, resolvedLocale)
    const manifest = { schema: 'momai-docs-bundle-v1', exportedAt: Date.now(), project: projects[0], sources, artifacts, brandKit }
    const zipBytes = zipSync({ 'project.json': strToU8(JSON.stringify(manifest, null, 2)) }, { level: 6 })
    return {
      fileName: `${projects[0].name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.momai-docs`,
      base64: Buffer.from(zipBytes).toString('base64')
    }
  }

  async importProjectBundle(bundleBase64: string, locale?: DocsLocale): Promise<ProjectRecord> {
    const resolvedLocale = normalizeLocale(locale)
    const files = unzipSync(Buffer.from(bundleBase64, 'base64'))
    if (!files['project.json']) throw new Error(translateCore(resolvedLocale, 'Pacote .momai-docs inválido.'))
    const parsed = JSON.parse(strFromU8(files['project.json'])) as {
      project: ProjectRecord
      sources?: SourceRecord[]
      artifacts?: ArtifactRecord[]
      brandKit?: BrandKit | null
    }
    const newId = `proj-${randomUUID().slice(0, 8)}`
    const proj: ProjectRecord = { ...parsed.project, id: newId, updatedAt: Date.now() }
    await this.bridge.collections.upsert('projects', proj as unknown as Record<string, unknown>)
    if (parsed.brandKit) {
      await saveBrandKit(this.bridge, { ...parsed.brandKit, projectId: newId, id: `brand-${randomUUID().slice(0, 8)}` })
    }
    return proj
  }
}
