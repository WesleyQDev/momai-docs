import { createHash, randomUUID } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import { extractText as extractPdfText } from 'unpdf'
import type { ExtractedImageRef, HostBridge, SourceChunkRecord, SourceKind } from '../types.ts'
import type { LLMGateway } from '../llm/llm-gateway.ts'

const MAX_CHUNK_CHARS = 1200
const CHUNK_OVERLAP = 150
const MAX_CHUNKS_PER_SOURCE = 600
const MAX_FETCH_BYTES = 4 * 1024 * 1024

const PRIVATE_IP_RE =
  /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\]|fc00:|fe80:)/i

export function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    if (PRIVATE_IP_RE.test(parsed.hostname)) return false
    return true
  } catch {
    return false
  }
}

export function sanitizeUntrustedText(raw: string): string {
  return String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .trim()
}

export function sanitizeSvgMarkup(svg: string): string {
  return String(svg || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function htmlToPlainText(html: string): { title: string; text: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const title = titleMatch ? decodeXmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : ''
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:nav|footer|aside|noscript)\b[^>]*>[\s\S]*?<\/(?:nav|footer|aside|noscript)>/gi, ' ')
    .replace(/<\/(?:p|div|h1|h2|h3|h4|h5|h6|li|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const text = decodeXmlEntities(cleaned)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title, text }
}

export interface ExtractedSection {
  locator: string
  sectionTitle: string
  timestamp?: string
  text: string
}

export interface IngestedSourcePayload {
  title: string
  contentHash: string
  sections: ExtractedSection[]
  totalChars: number
  pageCount?: number
  summary: string
  extractedImages: ExtractedImageRef[]
}

async function extractPdfSections(buffer: Buffer): Promise<{ sections: ExtractedSection[]; pageCount: number }> {
  const res = await extractPdfText(new Uint8Array(buffer), { mergePages: false })
  const pages = Array.isArray(res.text) ? res.text : [String(res.text || '')]
  const sections: ExtractedSection[] = []
  pages.forEach((pageText, idx) => {
    const clean = sanitizeUntrustedText(pageText)
    if (clean) {
      sections.push({
        locator: `p. ${idx + 1}`,
        sectionTitle: `Página ${idx + 1}`,
        text: clean
      })
    }
  })
  return { sections, pageCount: res.totalPages || pages.length }
}

async function extractDocxSections(
  buffer: Buffer,
  projectId: string,
  sourceId: string,
  sourceTitle: string,
  bridge?: HostBridge
): Promise<{ sections: ExtractedSection[]; images: ExtractedImageRef[] }> {
  const files = unzipSync(new Uint8Array(buffer))
  const docXml = files['word/document.xml']
  const sections: ExtractedSection[] = []
  const images: ExtractedImageRef[] = []

  if (docXml) {
    const xml = strFromU8(docXml)
    let currentTitle = 'Documento'
    let bufferParagraphs: string[] = []
    let sectionIdx = 1

    for (const para of xml.split(/<\/w:p>/i)) {
      const isHeading = /w:pStyle[^>]*w:val=["']Heading(\d)|Título/i.test(para)
      const runs = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
      if (!runs) continue
      const text = decodeXmlEntities(runs.map((r) => r.replace(/<[^>]+>/g, '')).join('')).trim()
      if (!text) continue

      if (isHeading && bufferParagraphs.length > 0) {
        sections.push({
          locator: `Seção ${sectionIdx++}`,
          sectionTitle: currentTitle,
          text: bufferParagraphs.join('\n\n')
        })
        bufferParagraphs = []
        currentTitle = text
      } else if (isHeading) {
        currentTitle = text
      } else {
        bufferParagraphs.push(text)
      }
    }
    if (bufferParagraphs.length > 0) {
      sections.push({
        locator: `Seção ${sectionIdx}`,
        sectionTitle: currentTitle,
        text: bufferParagraphs.join('\n\n')
      })
    }
  }

  if (bridge) {
    for (const [entryPath, bytes] of Object.entries(files)) {
      const match = /^word\/media\/([^/]+\.(png|jpe?g|webp))$/i.exec(entryPath)
      if (!match || bytes.byteLength > 2 * 1024 * 1024) continue
      const imgId = `img-${randomUUID().slice(0, 8)}`
      const relPath = `sources/${projectId}/${sourceId}/${imgId}-${match[1]}`
      await bridge.sessionFiles.write(relPath, bytes).catch(() => {})
      images.push({
        id: imgId,
        sourceId,
        sourceTitle,
        relativePath: relPath,
        mimeType: match[2].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg',
        caption: `Imagem extraída de ${sourceTitle}`
      })
      if (images.length >= 12) break
    }
  }

  return { sections, images }
}

async function extractPptxSections(
  buffer: Buffer,
  projectId: string,
  sourceId: string,
  sourceTitle: string,
  bridge?: HostBridge
): Promise<{ sections: ExtractedSection[]; pageCount: number; images: ExtractedImageRef[] }> {
  const files = unzipSync(new Uint8Array(buffer))
  const slideKeys = Object.keys(files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number(/slide(\d+)\.xml/i.exec(a)?.[1] || 0)
      const nb = Number(/slide(\d+)\.xml/i.exec(b)?.[1] || 0)
      return na - nb
    })

  const sections: ExtractedSection[] = []
  const images: ExtractedImageRef[] = []

  slideKeys.forEach((key, idx) => {
    const xml = strFromU8(files[key])
    const texts = (xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [])
      .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '')).trim())
      .filter(Boolean)
    if (texts.length > 0) {
      sections.push({
        locator: `Slide ${idx + 1}`,
        sectionTitle: texts[0].slice(0, 80),
        text: texts.join('\n')
      })
    }
  })

  if (bridge) {
    for (const [entryPath, bytes] of Object.entries(files)) {
      const match = /^ppt\/media\/([^/]+\.(png|jpe?g|webp))$/i.exec(entryPath)
      if (!match || bytes.byteLength > 2 * 1024 * 1024) continue
      const imgId = `img-${randomUUID().slice(0, 8)}`
      const relPath = `sources/${projectId}/${sourceId}/${imgId}-${match[1]}`
      await bridge.sessionFiles.write(relPath, bytes).catch(() => {})
      images.push({
        id: imgId,
        sourceId,
        sourceTitle,
        relativePath: relPath,
        mimeType: match[2].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg',
        caption: `Imagem extraída de ${sourceTitle}`
      })
      if (images.length >= 12) break
    }
  }

  return { sections, pageCount: slideKeys.length, images }
}

function extractXlsxSections(buffer: Buffer): ExtractedSection[] {
  const files = unzipSync(new Uint8Array(buffer))
  const sharedXml = files['xl/sharedStrings.xml']
  const shared = sharedXml
    ? (strFromU8(sharedXml).match(/<t[^>]*>([^<]*)<\/t>/g) || []).map((m) =>
        decodeXmlEntities(m.replace(/<[^>]+>/g, ''))
      )
    : []
  const sheetKeys = Object.keys(files)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort()

  const sections: ExtractedSection[] = []
  sheetKeys.forEach((key, idx) => {
    const xml = strFromU8(files[key])
    const rows: string[] = []
    for (const row of xml.split(/<\/row>/i)) {
      const cells = row.match(/<c[^>]*>[\s\S]*?<\/c>/g)
      if (!cells) continue
      const vals: string[] = []
      for (const c of cells) {
        const vMatch = /<v>([^<]*)<\/v>/.exec(c)
        if (!vMatch) continue
        if (c.includes('t="s"') && shared[Number(vMatch[1])] !== undefined) {
          vals.push(shared[Number(vMatch[1])])
        } else {
          vals.push(decodeXmlEntities(vMatch[1]))
        }
      }
      if (vals.length > 0) rows.push(`| ${vals.join(' | ')} |`)
    }
    if (rows.length > 0) {
      sections.push({
        locator: `Aba ${idx + 1}`,
        sectionTitle: `Planilha ${idx + 1}`,
        text: rows.join('\n')
      })
    }
  })
  return sections
}

function extractMarkdownSections(text: string): ExtractedSection[] {
  const lines = sanitizeUntrustedText(text).split(/\r?\n/)
  const sections: ExtractedSection[] = []
  let currentTitle = 'Introdução'
  let buf: string[] = []
  let idx = 1
  for (const line of lines) {
    const h = /^#{1,4}\s+(.+)$/.exec(line)
    if (h) {
      if (buf.length > 0) {
        sections.push({ locator: `Seção ${idx++}`, sectionTitle: currentTitle, text: buf.join('\n').trim() })
        buf = []
      }
      currentTitle = h[1].trim()
    } else {
      buf.push(line)
    }
  }
  if (buf.length > 0) {
    sections.push({ locator: `Seção ${idx}`, sectionTitle: currentTitle, text: buf.join('\n').trim() })
  }
  return sections.filter((s) => s.text.length > 0)
}

export function chunkSections(opts: {
  projectId: string
  sourceId: string
  sourceTitle: string
  sections: ExtractedSection[]
  maxChunkChars?: number
}): SourceChunkRecord[] {
  const maxChars = opts.maxChunkChars || MAX_CHUNK_CHARS
  const records: SourceChunkRecord[] = []
  let chunkIndex = 0

  for (const sec of opts.sections) {
    const text = sec.text.trim()
    if (!text) continue
    if (text.length <= maxChars) {
      records.push({
        id: `${opts.sourceId}#${chunkIndex}`,
        projectId: opts.projectId,
        sourceId: opts.sourceId,
        sourceTitle: opts.sourceTitle,
        chunkIndex: chunkIndex++,
        pageOrSlide: sec.locator,
        timestamp: sec.timestamp,
        sectionTitle: sec.sectionTitle,
        text,
        contentHash: createHash('sha256').update(text).digest('hex')
      })
      continue
    }

    let start = 0
    while (start < text.length && records.length < MAX_CHUNKS_PER_SOURCE) {
      let end = Math.min(text.length, start + maxChars)
      if (end < text.length) {
        const slice = text.slice(start, end)
        const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf('. '))
        if (breakAt > maxChars * 0.45) {
          end = start + breakAt + 1
        }
      }
      const chunkText = text.slice(start, end).trim()
      if (chunkText) {
        records.push({
          id: `${opts.sourceId}#${chunkIndex}`,
          projectId: opts.projectId,
          sourceId: opts.sourceId,
          sourceTitle: opts.sourceTitle,
          chunkIndex: chunkIndex++,
          pageOrSlide: sec.locator,
          timestamp: sec.timestamp,
          sectionTitle: sec.sectionTitle,
          text: chunkText,
          contentHash: createHash('sha256').update(chunkText).digest('hex')
        })
      }
      if (end >= text.length) break
      start = Math.max(start + 1, end - CHUNK_OVERLAP)
    }
  }
  return records.slice(0, MAX_CHUNKS_PER_SOURCE)
}

export async function ingestSource(opts: {
  projectId: string
  sourceId: string
  kind: SourceKind
  title?: string
  fileName?: string
  mimeType?: string
  contentBase64?: string
  text?: string
  url?: string
  llm?: LLMGateway
  bridge?: HostBridge
}): Promise<IngestedSourcePayload> {
  const title = (opts.title || opts.fileName || opts.url || 'Fonte sem título').trim()
  let sections: ExtractedSection[] = []
  let pageCount: number | undefined
  let extractedImages: ExtractedImageRef[] = []

  if (opts.kind === 'text') {
    sections = extractMarkdownSections(opts.text || '')
  } else if (opts.kind === 'url') {
    if (!opts.url || !isSafePublicUrl(opts.url)) {
      throw new Error('URL inválida ou endereço privado/local bloqueado por segurança.')
    }
    const res = await fetch(opts.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 MomAI-Docs/1.0' },
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) throw new Error(`Falha ao acessar URL (HTTP ${res.status})`)
    const rawHtml = (await res.text()).slice(0, MAX_FETCH_BYTES)
    const parsed = htmlToPlainText(rawHtml)
    sections = extractMarkdownSections(parsed.text)
  } else if (opts.kind === 'youtube') {
    if (!opts.url || !isSafePublicUrl(opts.url)) {
      throw new Error('URL do YouTube inválida.')
    }
    const res = await fetch(opts.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) throw new Error(`Falha ao abrir vídeo do YouTube (HTTP ${res.status})`)
    const html = await res.text()
    const captionMatch = /"captionTracks":\s*(\[[\s\S]*?\])/.exec(html)
    let transcriptText = ''
    if (captionMatch) {
      try {
        const tracks = JSON.parse(captionMatch[1]) as Array<{ baseUrl?: string; languageCode?: string }>
        const track =
          tracks.find((t) => t.languageCode?.startsWith('pt')) ||
          tracks.find((t) => t.languageCode?.startsWith('en')) ||
          tracks[0]
        if (track?.baseUrl && isSafePublicUrl(track.baseUrl)) {
          const capRes = await fetch(track.baseUrl, { signal: AbortSignal.timeout(10_000) })
          const capXml = await capRes.text()
          const lines: string[] = []
          for (const m of capXml.matchAll(/<text start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g)) {
            const sec = Math.floor(Number(m[1]) || 0)
            const mm = String(Math.floor(sec / 60)).padStart(2, '0')
            const ss = String(sec % 60).padStart(2, '0')
            const txt = decodeXmlEntities(m[2].replace(/<[^>]+>/g, '')).trim()
            if (txt) lines.push(`[${mm}:${ss}] ${txt}`)
          }
          transcriptText = lines.join('\n')
        }
      } catch {}
    }
    if (!transcriptText) {
      const descMatch = /"shortDescription":"([\s\S]*?)"/.exec(html)
      transcriptText = descMatch ? descMatch[1].replace(/\\n/g, '\n') : htmlToPlainText(html).text
    }
    sections = extractMarkdownSections(transcriptText)
  } else if (opts.kind === 'file') {
    const rawB64 = String(opts.contentBase64 || '').replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(rawB64, 'base64')
    const ext = ((opts.fileName || '').split('.').pop() || '').toLowerCase()
    const mime = (opts.mimeType || '').toLowerCase()

    if (ext === 'pdf' || mime.includes('pdf')) {
      const pdf = await extractPdfSections(buffer)
      sections = pdf.sections
      pageCount = pdf.pageCount
    } else if (ext === 'docx' || mime.includes('wordprocessingml')) {
      const docxRes = await extractDocxSections(buffer, opts.projectId, opts.sourceId, title, opts.bridge)
      sections = docxRes.sections
      extractedImages = docxRes.images
    } else if (ext === 'pptx' || mime.includes('presentationml')) {
      const pptxRes = await extractPptxSections(buffer, opts.projectId, opts.sourceId, title, opts.bridge)
      sections = pptxRes.sections
      pageCount = pptxRes.pageCount
      extractedImages = pptxRes.images
    } else if (ext === 'xlsx' || mime.includes('spreadsheetml')) {
      sections = extractXlsxSections(buffer)
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || mime.startsWith('image/')) {
      if (opts.bridge) {
        const relPath = `sources/${opts.projectId}/${opts.sourceId}/original.${ext || 'png'}`
        await opts.bridge.sessionFiles.write(relPath, buffer).catch(() => {})
        extractedImages.push({
          id: `img-${randomUUID().slice(0, 8)}`,
          sourceId: opts.sourceId,
          sourceTitle: title,
          relativePath: relPath,
          mimeType: mime || `image/${ext || 'png'}`,
          caption: title
        })
      }
      if (opts.llm) {
        const ocr = await opts.llm.analyzeImage({
          imageBase64: rawB64,
          prompt: 'Transcreva fielmente todo o texto visível nesta imagem e descreva tabelas/gráficos relevantes.'
        })
        if (ocr.text.trim()) {
          sections = [{ locator: 'Imagem (OCR)', sectionTitle: title, text: ocr.text.trim() }]
        } else {
          sections = [{
            locator: 'Imagem',
            sectionTitle: title,
            text: `[Imagem anexada: ${title}. O modelo ativo não possui visão para OCR automático.]`
          }]
        }
      }
    } else if (['mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm'].includes(ext) || mime.startsWith('audio/') || mime.startsWith('video/')) {
      const baseUrl = (process.env.MOMAI_API_URL || 'http://127.0.0.1:8050').replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/voice/quick-transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': process.env.MOMAI_SESSION_TOKEN || ''
        },
        body: JSON.stringify({ audioBase64: rawB64, fileName: opts.fileName }),
        signal: AbortSignal.timeout(60_000)
      }).catch(() => null)
      const data = res && res.ok ? ((await res.json().catch(() => ({}))) as { text?: string }) : {}
      const transcribed = String(data.text || '').trim()
      if (!transcribed) {
        throw new Error('Transcrição de áudio/vídeo indisponível no momento (sidecar de voz inativo).')
      }
      sections = extractMarkdownSections(transcribed)
    } else {
      sections = extractMarkdownSections(buffer.toString('utf8'))
    }
  }

  const fullText = sections.map((s) => s.text).join('\n\n')
  if (!fullText.trim()) {
    throw new Error(`Não foi possível extrair texto legível da fonte "${title}".`)
  }

  const contentHash = createHash('sha256').update(fullText).digest('hex')
  const summary = fullText.replace(/\s+/g, ' ').trim().slice(0, 280)

  return {
    title,
    contentHash,
    sections,
    totalChars: fullText.length,
    pageCount,
    summary,
    extractedImages
  }
}
