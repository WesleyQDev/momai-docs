import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { VisualQAReport } from '../types.ts'
import { runVisualQA, type VisualPageMetric } from '../qa/visual-qa.ts'
import { normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

export interface LetterheadAnalysis {
  format: 'docx' | 'pdf'
  pageCount: number
  detectedPlaceholders: string[]
  safeZone: {
    topMarginPt: number
    bottomMarginPt: number
    leftMarginPt: number
    rightMarginPt: number
  }
}

const FIELD_PATTERN = /\{\{([a-zA-Z0-9_.-]+)\}\}|\[([A-Z0-9_ ]{2,40})\]|_{4,}/g

function escapeXml(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toWinAnsiSafe(text: string): string {
  return String(text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ')
}

export async function analyzeLetterheadFile(
  fileName: string,
  buffer: Buffer
): Promise<LetterheadAnalysis> {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') {
    const pdf = await PDFDocument.load(buffer)
    const form = pdf.getForm()
    const fieldNames = form.getFields().map((f) => f.getName())
    return {
      format: 'pdf',
      pageCount: pdf.getPageCount(),
      detectedPlaceholders: fieldNames,
      safeZone: {
        topMarginPt: 115,
        bottomMarginPt: 85,
        leftMarginPt: 60,
        rightMarginPt: 60
      }
    }
  }

  const files = unzipSync(new Uint8Array(buffer))
  const docXml = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : ''
  const found = new Set<string>()
  let blankSeq = 1
  for (const m of docXml.matchAll(FIELD_PATTERN)) {
    found.add((m[1] || m[2] || `lacuna_${blankSeq++}`).trim())
  }

  // Read sectPr pgMar (twips -> pt = twips / 20)
  const marMatch = /<w:pgMar\b([^>]+)\/>/i.exec(docXml)
  const readAttr = (name: string, fallbackPt: number) => {
    if (!marMatch) return fallbackPt
    const attr = new RegExp(`w:${name}=["'](\\d+)["']`, 'i').exec(marMatch[1])
    return attr ? Math.round(Number(attr[1]) / 20) : fallbackPt
  }

  return {
    format: 'docx',
    pageCount: 1,
    detectedPlaceholders: Array.from(found),
    safeZone: {
      topMarginPt: readAttr('top', 90),
      bottomMarginPt: readAttr('bottom', 72),
      leftMarginPt: readAttr('left', 72),
      rightMarginPt: readAttr('right', 72)
    }
  }
}

/**
 * Fills a DOCX letterhead WITHOUT recreating it: preserves headers, footers,
 * watermarks, media, styles and sectPr byte-for-byte, only replacing placeholders
 * and inserting structured paragraphs before </w:body> (or <w:sectPr>).
 */
export function fillDocxLetterhead(opts: {
  templateBuffer: Buffer
  documentTitle?: string
  fields?: Array<{ key: string; value: string }>
  paragraphs: string[]
  signatureBlock?: string
  locale?: DocsLocale
}): { buffer: Buffer; warnings: string[] } {
  const files = unzipSync(new Uint8Array(opts.templateBuffer))
  const docEntry = files['word/document.xml']
  if (!docEntry) {
    throw new Error('Invalid DOCX file: word/document.xml was not found.')
  }

  let xml = strFromU8(docEntry)
  const warnings: string[] = []
  const fieldMap = new Map<string, string>()
  for (const f of opts.fields || []) {
    if (f.key) fieldMap.set(f.key.toLowerCase(), String(f.value || ''))
  }

  const consumedKeys = new Set<string>()
  // Replace explicit {{key}} or [KEY] placeholders inside text runs
  xml = xml.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}|\[([A-Z0-9_ ]{2,40})\]/g, (full, k1, k2) => {
    const key = String(k1 || k2 || '').trim().toLowerCase()
    const val = fieldMap.get(key)
    if (val === undefined) return full
    consumedKeys.add(key)
    return escapeXml(val)
  })

  // Replace sequential ____ blanks only with unconsumed field values
  const remainingValues = (opts.fields || [])
    .filter((f) => f.key && !consumedKeys.has(f.key.toLowerCase()) && f.value)
    .map((f) => f.value)
  let blankCursor = 0
  xml = xml.replace(/_{4,}/g, (full) => {
    if (blankCursor < remainingValues.length) {
      return escapeXml(remainingValues[blankCursor++])
    }
    return full
  })

  const makeParaXml = (text: string, bold = false) =>
    `<w:p><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`

  const inserted: string[] = []
  if (opts.documentTitle) inserted.push(makeParaXml(opts.documentTitle, true))
  for (const p of opts.paragraphs) {
    if (p.trim()) inserted.push(makeParaXml(p.trim()))
  }
  if (opts.signatureBlock) inserted.push(makeParaXml(opts.signatureBlock, true))

  const sectIdx = xml.lastIndexOf('<w:sectPr')
  if (sectIdx !== -1) {
    xml = xml.slice(0, sectIdx) + inserted.join('') + xml.slice(sectIdx)
  } else {
    xml = xml.replace('</w:body>', `${inserted.join('')}</w:body>`)
  }

  files['word/document.xml'] = strToU8(xml)
  const outBytes = zipSync(files, { level: 6 })
  return { buffer: Buffer.from(outBytes), warnings }
}

/**
 * Fills a PDF letterhead WITHOUT recreating it: embeds the original PDF page
 * as a vector background layer on every page and composes text strictly inside
 * the safe writing zone, repeating the letterhead on page breaks.
 */
export async function fillPdfLetterhead(opts: {
  templateBuffer: Buffer
  documentTitle?: string
  fields?: Array<{ key: string; value: string }>
  paragraphs: string[]
  signatureBlock?: string
  safeZone?: { topMarginPt: number; bottomMarginPt: number; leftMarginPt: number; rightMarginPt: number }
  locale?: DocsLocale
}): Promise<{ buffer: Buffer; previewSvgs: string[]; qaReport: VisualQAReport; warnings: string[] }> {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const srcPdf = await PDFDocument.load(opts.templateBuffer)
  const srcPages = srcPdf.getPages()
  const basePage = srcPages[0]
  const { width, height } = basePage.getSize()
  const zone = opts.safeZone || {
    topMarginPt: 115,
    bottomMarginPt: 85,
    leftMarginPt: 60,
    rightMarginPt: 60
  }

  const outPdf = await PDFDocument.create()
  const fontRegular = await outPdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await outPdf.embedFont(StandardFonts.HelveticaBold)
  const [embeddedBg] = await outPdf.embedPages([basePage])

  const usableWidth = Math.max(180, width - zone.leftMarginPt - zone.rightMarginPt)
  const warnings: string[] = []

  // Try filling AcroForm fields if the original PDF has them
  try {
    const form = srcPdf.getForm()
    const fieldMap = new Map((opts.fields || []).map((f) => [f.key.toLowerCase(), f.value]))
    for (const f of form.getFields()) {
      const val = fieldMap.get(f.getName().toLowerCase())
      if (val && typeof (f as any).setText === 'function') {
        ;(f as any).setText(toWinAnsiSafe(val))
      }
    }
  } catch {}

  const allBlocks: Array<{ text: string; bold: boolean }> = []
  if (opts.documentTitle) allBlocks.push({ text: opts.documentTitle, bold: true })
  if (opts.fields && opts.fields.length > 0) {
    for (const f of opts.fields) {
      if (f.value) allBlocks.push({ text: `${f.key}: ${f.value}`, bold: false })
    }
  }
  for (const p of opts.paragraphs) {
    if (p.trim()) allBlocks.push({ text: p.trim(), bold: false })
  }
  if (opts.signatureBlock) allBlocks.push({ text: opts.signatureBlock, bold: true })

  let page = outPdf.addPage([width, height])
  page.drawPage(embeddedBg, { x: 0, y: 0, width, height })
  let cursorY = height - zone.topMarginPt
  const svgPages: string[][] = [[]]
  const qaMetrics: VisualPageMetric[] = []
  let usedY = 0

  const newPage = () => {
    qaMetrics.push({
      index: svgPages.length - 1,
      label: tr('Timbrado Pág. {number}', { number: svgPages.length }),
      fillRatio: Math.min(1, usedY / Math.max(1, height - zone.topMarginPt - zone.bottomMarginPt)),
      overflowChars: 0,
      collidesWithHeaderOrFooter: false
    })
    page = outPdf.addPage([width, height])
    page.drawPage(embeddedBg, { x: 0, y: 0, width, height })
    cursorY = height - zone.topMarginPt
    usedY = 0
    svgPages.push([])
  }

  for (const blk of allBlocks) {
    const fontSize = blk.bold ? 12 : 11
    const lineHeight = fontSize * 1.45
    const font = blk.bold ? fontBold : fontRegular
    const words = toWinAnsiSafe(blk.text).split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let curr = words[0] || ''
    for (let i = 1; i < words.length; i++) {
      const cand = `${curr} ${words[i]}`
      if (font.widthOfTextAtSize(cand, fontSize) <= usableWidth) curr = cand
      else {
        lines.push(curr)
        curr = words[i]
      }
    }
    if (curr) lines.push(curr)

    for (const line of lines) {
      if (cursorY - lineHeight < zone.bottomMarginPt) newPage()
      page.drawText(line, {
        x: zone.leftMarginPt,
        y: cursorY,
        size: fontSize,
        font,
        color: rgb(0.08, 0.1, 0.14)
      })
      const svgY = height - cursorY + fontSize
      svgPages[svgPages.length - 1].push(
        `<text x="${zone.leftMarginPt}" y="${svgY.toFixed(1)}" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="${blk.bold ? '700' : '400'}" fill="#0F172A">${escapeXml(line)}</text>`
      )
      cursorY -= lineHeight
      usedY += lineHeight
    }
    cursorY -= 6
    usedY += 6
  }

  qaMetrics.push({
    index: svgPages.length - 1,
    label: tr('Timbrado Pág. {number}', { number: svgPages.length }),
    fillRatio: Math.min(1, usedY / Math.max(1, height - zone.topMarginPt - zone.bottomMarginPt)),
    overflowChars: 0,
    collidesWithHeaderOrFooter: false
  })

  const { report } = runVisualQA({
    tokens: {
      primary: '#1E293B',
      secondary: '#475569',
      accent: '#7C3AED',
      surface: '#FFFFFF',
      surfaceAlt: '#F8FAFC',
      textPrimary: '#0F172A',
      textMuted: '#64748B',
      border: '#CBD5E1',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      monoFont: 'JetBrains Mono'
    },
    pages: qaMetrics,
    locale
  })

  const previewSvgs = svgPages.map(
    (els, idx) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="background:#fff"><rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="${zone.leftMarginPt}" y="${zone.topMarginPt}" width="${usableWidth}" height="${height - zone.topMarginPt - zone.bottomMarginPt}" fill="none" stroke="#94A3B8" stroke-dasharray="4 4" opacity="0.45"/><text x="${zone.leftMarginPt}" y="28" font-size="10" fill="#64748B">${escapeXml(tr('[Cabeçalho Original do Timbrado Preservado, Pág. {number}]', { number: idx + 1 }))}</text>${els.join('')}<text x="${zone.leftMarginPt}" y="${height - 22}" font-size="10" fill="#64748B">${escapeXml(tr('[Rodapé Original do Timbrado Preservado]'))}</text></svg>`
  )

  return {
    buffer: Buffer.from(await outPdf.save()),
    previewSvgs,
    qaReport: report,
    warnings
  }
}
