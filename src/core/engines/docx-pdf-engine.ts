import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { BrandKit, DesignTokens, TemplateManifest, ToolId, VisualQAReport } from '../types.ts'
import { runVisualQA, type VisualPageMetric } from '../qa/visual-qa.ts'

function hexRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').padEnd(6, '0').slice(0, 6)
  const n = parseInt(clean, 16)
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  }
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// pdf-lib StandardFonts (WinAnsi) safely supports Latin-1 (all PT-BR accents),
// replacing rare symbols outside WinAnsi (like emoji or curly quotes) to prevent encode errors.
function toWinAnsiSafe(text: string): string {
  return String(text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ')
}

function wrapTextToLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const safe = toWinAnsiSafe(text)
  const paragraphs = safe.split(/\r?\n/)
  const lines: string[] = []
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let current = words[0]
    for (let i = 1; i < words.length; i++) {
      const cand = `${current} ${words[i]}`
      if (font.widthOfTextAtSize(cand, fontSize) <= maxWidth) {
        current = cand
      } else {
        lines.push(current)
        current = words[i]
      }
    }
    lines.push(current)
  }
  return lines
}

export interface RenderedBlock {
  kind: 'title' | 'subtitle' | 'heading' | 'paragraph' | 'quote' | 'callout' | 'bullet' | 'page_break' | 'table'
  text?: string
  headers?: string[]
  rows?: string[][]
}

export function buildDocumentBlocks(
  toolId: ToolId,
  data: Record<string, any>,
  brandKit?: BrandKit | null
): RenderedBlock[] {
  const blocks: RenderedBlock[] = []
  const inst = brandKit?.institutionName || (data.institution as string) || ''

  if (toolId === 'oficio') {
    if (inst) blocks.push({ kind: 'subtitle', text: inst.toUpperCase() })
    blocks.push({ kind: 'heading', text: String(data.documentNumber || 'Ofício nº 001/2026') })
    blocks.push({ kind: 'paragraph', text: String(data.placeAndDate || '') })
    blocks.push({ kind: 'paragraph', text: String(data.recipientTitle || '') })
    blocks.push({ kind: 'callout', text: `Assunto: ${String(data.subject || '')}` })
    const paras = Array.isArray(data.paragraphs) ? data.paragraphs : []
    paras.forEach((p, idx) => blocks.push({ kind: 'paragraph', text: `${idx + 1}. ${String(p)}` }))
    blocks.push({ kind: 'paragraph', text: String(data.closing || 'Atenciosamente,') })
    blocks.push({ kind: 'heading', text: String(data.signerName || brandKit?.signatureName || '') })
    return blocks
  }

  if (toolId === 'abnt') {
    if (inst) blocks.push({ kind: 'subtitle', text: inst.toUpperCase() })
    blocks.push({ kind: 'title', text: String(data.title || 'Trabalho Acadêmico') })
    if (data.subtitle) blocks.push({ kind: 'subtitle', text: String(data.subtitle) })
    blocks.push({ kind: 'paragraph', text: `Autor: ${String(data.author || '')}` })
    blocks.push({ kind: 'callout', text: String(data.workNature || '') })
    blocks.push({ kind: 'paragraph', text: String(data.cityAndYear || '') })
    blocks.push({ kind: 'page_break' })
    blocks.push({ kind: 'heading', text: 'RESUMO' })
    blocks.push({ kind: 'paragraph', text: String(data.abstractPt || '') })
    if (Array.isArray(data.keywordsPt) && data.keywordsPt.length > 0) {
      blocks.push({ kind: 'paragraph', text: `Palavras-chave: ${data.keywordsPt.join('; ')}.` })
    }
    if (data.abstractEn) {
      blocks.push({ kind: 'heading', text: 'ABSTRACT' })
      blocks.push({ kind: 'paragraph', text: String(data.abstractEn) })
    }
    blocks.push({ kind: 'page_break' })
    const secs = Array.isArray(data.sections) ? data.sections : []
    for (const sec of secs) {
      blocks.push({ kind: 'heading', text: `${sec.number || ''} ${sec.heading || ''}`.trim() })
      for (const p of sec.paragraphs || []) blocks.push({ kind: 'paragraph', text: String(p) })
      for (const q of sec.longQuotes || []) {
        blocks.push({ kind: 'quote', text: `${String(q.text || '')} (${String(q.citation || '')})` })
      }
    }
    blocks.push({ kind: 'page_break' })
    blocks.push({ kind: 'heading', text: 'REFERÊNCIAS' })
    for (const ref of data.references || []) blocks.push({ kind: 'paragraph', text: String(ref) })
    return blocks
  }

  if (toolId === 'apostila') {
    if (inst) blocks.push({ kind: 'subtitle', text: inst })
    blocks.push({ kind: 'title', text: String(data.title || 'Apostila Didática') })
    if (data.subtitle) blocks.push({ kind: 'subtitle', text: String(data.subtitle) })
    blocks.push({ kind: 'page_break' })
    for (const ch of data.chapters || []) {
      blocks.push({ kind: 'heading', text: String(ch.title || 'Capítulo') })
      if (Array.isArray(ch.objectives) && ch.objectives.length > 0) {
        blocks.push({ kind: 'callout', text: `Objetivos: ${ch.objectives.join(' • ')}` })
      }
      for (const sec of ch.sections || []) {
        blocks.push({ kind: 'heading', text: String(sec.heading || '') })
        blocks.push({ kind: 'paragraph', text: String(sec.body || '') })
        if (sec.callout) blocks.push({ kind: 'callout', text: String(sec.callout) })
      }
      if (Array.isArray(ch.exercises) && ch.exercises.length > 0) {
        blocks.push({ kind: 'heading', text: 'Exercícios de Fixação' })
        ch.exercises.forEach((ex: any, i: number) => {
          blocks.push({ kind: 'bullet', text: `${i + 1}. ${String(ex.question || '')}` })
          if (ex.answer) blocks.push({ kind: 'paragraph', text: `Gabarito: ${String(ex.answer)}` })
        })
      }
    }
    if (Array.isArray(data.glossary) && data.glossary.length > 0) {
      blocks.push({ kind: 'heading', text: 'Glossário' })
      for (const g of data.glossary) {
        blocks.push({ kind: 'bullet', text: `${String(g.term || '')}: ${String(g.definition || '')}` })
      }
    }
    if (Array.isArray(data.references) && data.references.length > 0) {
      blocks.push({ kind: 'heading', text: 'Referências' })
      for (const r of data.references) blocks.push({ kind: 'paragraph', text: String(r) })
    }
    return blocks
  }

  // Generic structured document (report, resume, lesson_plan, meeting_minutes, contract, faq, newsletter)
  blocks.push({ kind: 'title', text: String(data.title || data.fullName || 'Documento') })
  if (data.subtitle || data.headline || data.gradeAndDuration || data.dateAndParticipants) {
    blocks.push({
      kind: 'subtitle',
      text: String(data.subtitle || data.headline || data.gradeAndDuration || data.dateAndParticipants)
    })
  }
  if (data.executiveSummary || data.summary || data.lead) {
    blocks.push({ kind: 'callout', text: String(data.executiveSummary || data.summary || data.lead) })
  }
  if (Array.isArray(data.kpis) && data.kpis.length > 0) {
    blocks.push({
      kind: 'table',
      headers: ['Indicador', 'Valor', 'Tendência'],
      rows: data.kpis.map((k: any) => [String(k.label || ''), String(k.value || ''), String(k.trend || '-')])
    })
  }
  for (const sec of data.sections || data.clauses || data.blocks || data.stages || []) {
    blocks.push({ kind: 'heading', text: String(sec.heading || sec.title || sec.phase || `Cláusula ${sec.number || ''}`) })
    blocks.push({ kind: 'paragraph', text: String(sec.body || sec.text || sec.activity || '') })
    if (sec.table?.headers && sec.table?.rows) {
      blocks.push({ kind: 'table', headers: sec.table.headers, rows: sec.table.rows })
    }
  }
  if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
    blocks.push({ kind: 'heading', text: 'Recomendações' })
    for (const r of data.recommendations) blocks.push({ kind: 'bullet', text: String(r) })
  }
  if (Array.isArray(data.items) && data.items.length > 0) {
    for (const item of data.items) {
      blocks.push({ kind: 'heading', text: String(item.question || '') })
      blocks.push({ kind: 'paragraph', text: String(item.answer || '') })
    }
  }
  return blocks
}

export async function renderDocxAndPdf(opts: {
  toolId: ToolId
  template: TemplateManifest
  tokens: DesignTokens
  data: Record<string, any>
  brandKit?: BrandKit | null
}): Promise<{
  docxBuffer: Buffer
  pdfBuffer: Buffer
  previewSvgs: string[]
  qaReport: VisualQAReport
}> {
  const blocks = buildDocumentBlocks(opts.toolId, opts.data, opts.brandKit)
  const isAbnt = opts.toolId === 'abnt'
  const primaryHex = opts.tokens.primary.replace('#', '')
  const textHex = opts.tokens.textPrimary.replace('#', '')
  const fontBody = opts.tokens.bodyFont || (isAbnt ? 'Liberation Serif' : 'Inter')

  // 1. Build native editable DOCX
  const docChildren: Array<Paragraph | Table> = []
  for (const b of blocks) {
    if (b.kind === 'page_break') {
      docChildren.push(new Paragraph({ children: [new PageBreak()] }))
    } else if (b.kind === 'title') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: isAbnt ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 200 },
          children: [new TextRun({ text: b.text || '', bold: true, size: isAbnt ? 28 : 36, color: primaryHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'subtitle') {
      docChildren.push(
        new Paragraph({
          alignment: isAbnt ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 180 },
          children: [new TextRun({ text: b.text || '', italics: true, size: 22, color: '475569', font: fontBody })]
        })
      )
    } else if (b.kind === 'heading') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          keepNext: true,
          children: [new TextRun({ text: b.text || '', bold: true, size: 24, color: primaryHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'quote') {
      docChildren.push(
        new Paragraph({
          indent: { left: 2268 }, // ABNT 4cm = 2268 twips
          spacing: { after: 140, line: 240 },
          children: [new TextRun({ text: b.text || '', size: 20, color: textHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'callout') {
      docChildren.push(
        new Paragraph({
          indent: { left: 360, right: 360 },
          spacing: { before: 120, after: 160 },
          children: [new TextRun({ text: b.text || '', bold: true, size: 22, color: primaryHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'bullet') {
      docChildren.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 100 },
          children: [new TextRun({ text: b.text || '', size: 22, color: textHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'table' && b.headers && b.rows) {
      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: b.headers.map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: primaryHex })] })]
              })
          )
        }),
        ...b.rows.map(
          (r) =>
            new TableRow({
              children: r.map(
                (c) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, color: textHex })] })]
                  })
              )
            })
        )
      ]
      docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }))
    } else if (b.text) {
      docChildren.push(
        new Paragraph({
          alignment: isAbnt ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
          spacing: { after: 140, line: isAbnt ? 360 : 276 },
          children: [new TextRun({ text: b.text, size: 24, color: textHex, font: fontBody })]
        })
      )
    }
  }

  const headerLogoDataUrl = opts.brandKit?.headerLogoDataUrl || opts.brandKit?.logoDataUrl || ''
  const footerLogoDataUrl = opts.brandKit?.footerLogoDataUrl || opts.brandKit?.logoDataUrl || ''
  const logoPlacement = opts.brandKit?.logoPlacement || 'header'
  const showLogoInHeader =
    Boolean(headerLogoDataUrl) &&
    (opts.brandKit?.logoInHeader !== undefined
      ? Boolean(opts.brandKit.logoInHeader)
      : opts.brandKit?.headerLogoDataUrl
        ? true
        : logoPlacement === 'header' || logoPlacement === 'both')
  const showLogoInFooter =
    Boolean(footerLogoDataUrl) &&
    (opts.brandKit?.logoInFooter !== undefined
      ? Boolean(opts.brandKit.logoInFooter)
      : opts.brandKit?.footerLogoDataUrl
        ? true
        : logoPlacement === 'footer' || logoPlacement === 'both')
  const headerText = opts.brandKit?.headerText || opts.brandKit?.institutionName || ''
  const footerText = opts.brandKit?.footerText || ''
  const headerAlign = opts.brandKit?.headerAlign || 'right'
  const footerAlign = opts.brandKit?.footerAlign || 'right'
  const toDocxAlign = (a: 'left' | 'center' | 'right') =>
    a === 'left' ? AlignmentType.LEFT : a === 'center' ? AlignmentType.CENTER : AlignmentType.RIGHT

  const makeLogoRun = (dataUrl: string) => {
    if (!dataUrl) return null
    try {
      const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl)
      if (!match) return null
      const type = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
      const data = Buffer.from(match[2], 'base64')
      return new ImageRun({
        data,
        type,
        transformation: { width: 72, height: 28 }
      })
    } catch {
      return null
    }
  }

  const headerRuns: any[] = []
  if (showLogoInHeader) {
    const imgRun = makeLogoRun(headerLogoDataUrl)
    if (imgRun) headerRuns.push(imgRun)
  }
  if (headerText) {
    headerRuns.push(new TextRun({ text: headerRuns.length > 0 ? `   ${headerText}` : headerText, size: 18, color: '64748B' }))
  }

  const footerRuns: any[] = []
  if (showLogoInFooter) {
    const imgRun = makeLogoRun(footerLogoDataUrl)
    if (imgRun) footerRuns.push(imgRun)
  }
  footerRuns.push(
    new TextRun({
      text: footerText ? `${footerRuns.length > 0 ? '   ' : ''}${footerText}  |  ` : footerRuns.length > 0 ? '  |  ' : '',
      size: 16,
      color: '64748B'
    }),
    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B' })
  )

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: isAbnt
              ? { top: 1701, left: 1701, bottom: 1134, right: 1134 } // 3cm / 2cm
              : { top: 1440, left: 1440, bottom: 1440, right: 1440 }
          }
        },
        headers:
          headerRuns.length > 0
            ? {
                default: new Header({
                  children: [
                    new Paragraph({
                      alignment: toDocxAlign(headerAlign),
                      children: headerRuns
                    })
                  ]
                })
              }
            : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: toDocxAlign(footerAlign),
                children: footerRuns
              })
            ]
          })
        },
        children: docChildren
      }
    ]
  })
  const docxBuffer = Buffer.from(await Packer.toBuffer(doc))

  // 2. Build matching PDF + SVG previews + VisualQA metrics
  const pdfDoc = await PDFDocument.create()
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginLeft = isAbnt ? 85 : 56
  const marginRight = isAbnt ? 57 : 56
  const marginTop = isAbnt ? 85 : 64
  const marginBottom = isAbnt ? 57 : 64
  const usableWidth = pageWidth - marginLeft - marginRight

  const primaryC = hexRgb01(opts.tokens.primary)
  const textC = hexRgb01(opts.tokens.textPrimary)
  const pdfPrimary = rgb(primaryC.r, primaryC.g, primaryC.b)
  const pdfText = rgb(textC.r, textC.g, textC.b)

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let cursorY = pageHeight - marginTop
  const svgPages: string[][] = [[]]
  const qaMetrics: VisualPageMetric[] = []
  let currentUsedY = 0

  const startNewPage = () => {
    qaMetrics.push({
      index: svgPages.length - 1,
      label: `Página ${svgPages.length}`,
      fillRatio: Math.min(1, currentUsedY / (pageHeight - marginTop - marginBottom)),
      overflowChars: 0
    })
    page = pdfDoc.addPage([pageWidth, pageHeight])
    cursorY = pageHeight - marginTop
    currentUsedY = 0
    svgPages.push([])
  }

  for (const b of blocks) {
    if (b.kind === 'page_break') {
      startNewPage()
      continue
    }
    if (b.kind === 'table' && b.headers && b.rows) {
      const colCount = Math.max(b.headers.length, ...b.rows.map((r) => r.length), 1)
      const colW = usableWidth / colCount
      const cellPadX = 6
      const rowH = 22
      const allRows = [b.headers, ...b.rows]
      const accentRgb = hexRgb01(opts.tokens.accent)
      const borderRgb = hexRgb01(opts.tokens.border)
      const pdfBorder = rgb(borderRgb.r, borderRgb.g, borderRgb.b)
      const pdfHeaderBg = rgb(
        Math.min(1, accentRgb.r * 0.14 + 0.86),
        Math.min(1, accentRgb.g * 0.14 + 0.86),
        Math.min(1, accentRgb.b * 0.14 + 0.86)
      )

      for (let rIdx = 0; rIdx < allRows.length; rIdx++) {
        if (cursorY - rowH < marginBottom) startNewPage()
        const row = allRows[rIdx]
        const isHeaderRow = rIdx === 0
        const svgRowTop = pageHeight - cursorY
        const pdfRowBottom = cursorY - rowH

        if (isHeaderRow) {
          page.drawRectangle({
            x: marginLeft,
            y: pdfRowBottom,
            width: usableWidth,
            height: rowH,
            color: pdfHeaderBg
          })
          svgPages[svgPages.length - 1].push(
            `<rect x="${marginLeft}" y="${svgRowTop.toFixed(1)}" width="${usableWidth}" height="${rowH}" fill="${opts.tokens.surfaceAlt}" />`
          )
        }

        for (let cIdx = 0; cIdx < colCount; cIdx++) {
          const cellX = marginLeft + cIdx * colW
          const rawVal = toWinAnsiSafe(String(row[cIdx] ?? ''))
          const maxChars = Math.max(4, Math.floor((colW - cellPadX * 2) / 5.5))
          const cellText = rawVal.length > maxChars ? rawVal.slice(0, maxChars - 1) + '…' : rawVal
          page.drawRectangle({
            x: cellX,
            y: pdfRowBottom,
            width: colW,
            height: rowH,
            borderColor: pdfBorder,
            borderWidth: 0.6
          })
          page.drawText(cellText, {
            x: cellX + cellPadX,
            y: pdfRowBottom + 7,
            size: 9,
            font: isHeaderRow ? boldFont : regularFont,
            color: isHeaderRow ? pdfPrimary : pdfText
          })
          svgPages[svgPages.length - 1].push(
            `<rect x="${cellX.toFixed(1)}" y="${svgRowTop.toFixed(1)}" width="${colW.toFixed(1)}" height="${rowH}" fill="none" stroke="${opts.tokens.border}" stroke-width="0.8" />` +
              `<text x="${(cellX + cellPadX).toFixed(1)}" y="${(svgRowTop + 14.5).toFixed(1)}" font-family="Inter, sans-serif" font-size="9" font-weight="${isHeaderRow ? '700' : '400'}" fill="${isHeaderRow ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(cellText)}</text>`
          )
        }
        cursorY -= rowH
        currentUsedY += rowH
      }
      cursorY -= 8
      currentUsedY += 8
      continue
    }

    const text = b.text || ''
    if (!text.trim()) continue

    const isHeading = b.kind === 'title' || b.kind === 'heading'
    const fontSize = b.kind === 'title' ? 18 : b.kind === 'heading' ? 13 : b.kind === 'quote' ? 10 : 11
    const lineHeight = fontSize * (isAbnt ? 1.55 : 1.4)
    const font = isHeading || b.kind === 'callout' ? boldFont : regularFont
    const indent = b.kind === 'quote' ? 60 : b.kind === 'bullet' ? 14 : 0
    const lines = wrapTextToLines(text, font, fontSize, usableWidth - indent)

    if (isHeading && cursorY - lines.length * lineHeight - lineHeight * 2 < marginBottom) {
      startNewPage()
    }

    for (const line of lines) {
      if (cursorY - lineHeight < marginBottom) startNewPage()
      const svgY = pageHeight - cursorY + fontSize
      page.drawText(line, {
        x: marginLeft + indent,
        y: cursorY,
        size: fontSize,
        font,
        color: isHeading || b.kind === 'callout' ? pdfPrimary : pdfText
      })
      svgPages[svgPages.length - 1].push(
        `<text x="${marginLeft + indent}" y="${svgY.toFixed(1)}" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="${isHeading ? '700' : '400'}" fill="${isHeading ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(line)}</text>`
      )
      cursorY -= lineHeight
      currentUsedY += lineHeight
    }
    cursorY -= lineHeight * 0.45
    currentUsedY += lineHeight * 0.45
  }

  qaMetrics.push({
    index: svgPages.length - 1,
    label: `Página ${svgPages.length}`,
    fillRatio: Math.min(1, currentUsedY / (pageHeight - marginTop - marginBottom)),
    overflowChars: 0
  })

  const { report } = runVisualQA({ tokens: opts.tokens, pages: qaMetrics, autoRepair: true })
  const pdfBuffer = Buffer.from(await pdfDoc.save())
  const buildHeaderSvg = () => {
    if (!showLogoInHeader && !headerText) return ''
    const yTop = 18
    const logoW = 48
    const logoH = 20
    const anchor = headerAlign === 'left' ? 'start' : headerAlign === 'center' ? 'middle' : 'end'
    const baseX = headerAlign === 'left' ? marginLeft : headerAlign === 'center' ? pageWidth / 2 : pageWidth - marginRight
    const parts: string[] = []
    if (showLogoInHeader && headerLogoDataUrl) {
      const logoX =
        headerAlign === 'left'
          ? marginLeft
          : headerAlign === 'center'
            ? headerText
              ? pageWidth / 2 - 58
              : pageWidth / 2 - logoW / 2
            : pageWidth - marginRight - logoW
      parts.push(
        `<image href="${escapeXml(headerLogoDataUrl)}" x="${logoX.toFixed(1)}" y="${yTop}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`
      )
    }
    if (headerText) {
      const textX =
        showLogoInHeader && headerLogoDataUrl
          ? headerAlign === 'left'
            ? marginLeft + logoW + 8
            : headerAlign === 'center'
              ? pageWidth / 2 + 4
              : pageWidth - marginRight - logoW - 8
          : baseX
      parts.push(
        `<text x="${textX.toFixed(1)}" y="${yTop + 14}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-size="9" fill="${opts.tokens.textMuted}">${escapeXml(headerText)}</text>`
      )
    }
    return parts.join('')
  }

  const buildFooterSvg = (idx: number, total: number) => {
    const yBottom = pageHeight - 20
    const logoW = 40
    const logoH = 16
    const label = footerText ? `${footerText}  |  Pág. ${idx + 1}/${total}` : `Pág. ${idx + 1}/${total}`
    const anchor = footerAlign === 'left' ? 'start' : footerAlign === 'center' ? 'middle' : 'end'
    const baseX = footerAlign === 'left' ? marginLeft : footerAlign === 'center' ? pageWidth / 2 : pageWidth - marginRight
    const parts: string[] = []
    if (showLogoInFooter && footerLogoDataUrl) {
      const logoX =
        footerAlign === 'left'
          ? marginLeft
          : footerAlign === 'center'
            ? pageWidth / 2 - 56
            : pageWidth - marginRight - logoW
      parts.push(
        `<image href="${escapeXml(footerLogoDataUrl)}" x="${logoX.toFixed(1)}" y="${pageHeight - 34}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`
      )
    }
    const textX =
      showLogoInFooter && footerLogoDataUrl
        ? footerAlign === 'left'
          ? marginLeft + logoW + 8
          : footerAlign === 'center'
            ? pageWidth / 2 + 2
            : pageWidth - marginRight - logoW - 8
        : baseX
    parts.push(
      `<text x="${textX.toFixed(1)}" y="${yBottom}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-size="9" fill="${opts.tokens.textMuted}">${escapeXml(label)}</text>`
    )
    return parts.join('')
  }

  const headerSvgMarkup = buildHeaderSvg()
  const previewSvgs = svgPages.map(
    (els, idx) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWidth} ${pageHeight}" width="100%" style="background:${opts.tokens.surface}"><rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="${opts.tokens.surface}" stroke="${opts.tokens.border}" stroke-width="1"/>${headerSvgMarkup}${els.join('')}${buildFooterSvg(idx, svgPages.length)}</svg>`
  )

  return { docxBuffer, pdfBuffer, previewSvgs, qaReport: report }
}
