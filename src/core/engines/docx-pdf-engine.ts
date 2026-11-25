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
import { normalizeLocale, isUntitledProject } from '../i18n.ts'
import { translateCore } from '../translate.ts'

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
  kind:
    | 'cover'
    | 'toc'
    | 'chapter_heading'
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'paragraph'
    | 'quote'
    | 'callout'
    | 'bullet'
    | 'page_break'
    | 'table'
    | 'comparison'
    | 'timeline'
    | 'checklist'
  text?: string
  subtitle?: string
  institution?: string
  presentation?: string
  tocItems?: string[]
  moduleNumber?: number
  headers?: string[]
  rows?: string[][]
  leftTitle?: string
  leftItems?: string[]
  rightTitle?: string
  rightItems?: string[]
  timelineItems?: Array<{ step: string; detail: string }>
  checklistTitle?: string
  checklistItems?: string[]
}

export function buildDocumentBlocks(
  toolId: ToolId,
  data: Record<string, any>,
  brandKit?: BrandKit | null,
  localeInput?: string
): RenderedBlock[] {
  const blocks: RenderedBlock[] = []
  const locale = normalizeLocale(localeInput)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const rawInst = brandKit?.institutionName || (data.institution as string) || ''
  const inst = isUntitledProject(rawInst, locale) ? '' : rawInst

  if (toolId === 'oficio') {
    if (inst) blocks.push({ kind: 'subtitle', text: inst.toUpperCase() })
    blocks.push({ kind: 'heading', text: String(data.documentNumber || tr('Ofício nº 001/2026')) })
    blocks.push({ kind: 'paragraph', text: String(data.placeAndDate || '') })
    blocks.push({ kind: 'paragraph', text: String(data.recipientTitle || '') })
    blocks.push({ kind: 'heading', text: `${tr('Assunto:')} ${String(data.subject || '')}` })
    const paras = Array.isArray(data.paragraphs) ? data.paragraphs : []
    paras.forEach((p, idx) => blocks.push({ kind: 'paragraph', text: `${idx + 1}. ${String(p)}` }))
    blocks.push({ kind: 'paragraph', text: String(data.closing || tr('Atenciosamente,')) })
    blocks.push({ kind: 'heading', text: String(data.signerName || brandKit?.signatureName || '') })
    return blocks
  }

  if (toolId === 'abnt') {
    if (inst) blocks.push({ kind: 'subtitle', text: inst.toUpperCase() })
    blocks.push({ kind: 'title', text: String(data.title || tr('Trabalho Acadêmico')) })
    if (data.subtitle) blocks.push({ kind: 'subtitle', text: String(data.subtitle) })
    blocks.push({ kind: 'paragraph', text: `${tr('Autor:')} ${String(data.author || '')}` })
    blocks.push({ kind: 'callout', text: String(data.workNature || '') })
    blocks.push({ kind: 'paragraph', text: String(data.cityAndYear || '') })
    blocks.push({ kind: 'page_break' })
    blocks.push({ kind: 'heading', text: tr('RESUMO') })
    blocks.push({ kind: 'paragraph', text: String(data.abstractPt || '') })
    if (Array.isArray(data.keywordsPt) && data.keywordsPt.length > 0) {
      blocks.push({ kind: 'paragraph', text: `${tr('Palavras-chave:')} ${data.keywordsPt.join('; ')}.` })
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
    blocks.push({ kind: 'heading', text: tr('REFERÊNCIAS') })
    for (const ref of data.references || []) blocks.push({ kind: 'paragraph', text: String(ref) })
    return blocks
  }

  if (toolId === 'apostila') {
    const chapters = Array.isArray(data.chapters) ? data.chapters : []
    blocks.push({
      kind: 'cover',
      institution: inst || undefined,
      text: String(data.title || tr('Apostila Didática')),
      subtitle: data.subtitle ? String(data.subtitle) : undefined,
      presentation:
        data.presentation || data.introduction ? String(data.presentation || data.introduction) : undefined
    })
    blocks.push({ kind: 'page_break' })
    if (chapters.length > 0) {
      const tocEntries = chapters.map(
        (ch: any, idx: number) => `${String(idx + 1).padStart(2, '0')}   ${String(ch?.title || `${tr('Capítulo')} ${idx + 1}`)}`
      )
      if (Array.isArray(data.glossary) && data.glossary.length > 0) tocEntries.push(`+    ${tr('Glossário')}`)
      if (Array.isArray(data.references) && data.references.length > 0) tocEntries.push(`+    ${tr('Referências')}`)
      blocks.push({
        kind: 'toc',
        text: tr('Sumário'),
        tocItems: tocEntries
      })
      blocks.push({ kind: 'page_break' })
    }
    chapters.forEach((ch: any, chIdx: number) => {
      blocks.push({
        kind: 'chapter_heading',
        moduleNumber: chIdx + 1,
        text: String(ch.title || ch.heading || `${tr('Capítulo')} ${chIdx + 1}`)
      })
      if (Array.isArray(ch.objectives) && ch.objectives.length > 0) {
        blocks.push({
          kind: 'callout',
          text: `${tr('Objetivos:')}\n${ch.objectives.map((o: any) => `- ${String(o)}`).join('\n')}`
        })
      }
      const chIntro = ch.summary || ch.body || ch.content || ch.text || ch.description
      if (typeof chIntro === 'string' && chIntro.trim()) {
        blocks.push({ kind: 'paragraph', text: chIntro.trim() })
      }
      const chBullets = ch.bullets || ch.keyPoints
      if (Array.isArray(chBullets)) {
        for (const b of chBullets) blocks.push({ kind: 'bullet', text: String(b) })
      }
      const chSections = Array.isArray(ch.sections) ? ch.sections : Array.isArray(ch.topics) ? ch.topics : []
      for (const sec of chSections) {
        if (typeof sec === 'string') {
          blocks.push({ kind: 'paragraph', text: sec })
          continue
        }
        const secHeading = sec.heading || sec.title || sec.name || ''
        if (secHeading) blocks.push({ kind: 'heading', text: String(secHeading) })
        const secBody = sec.body || sec.content || sec.text || sec.summary || sec.description || ''
        if (secBody) blocks.push({ kind: 'paragraph', text: String(secBody) })
        if (Array.isArray(sec.bullets)) {
          for (const sb of sec.bullets) blocks.push({ kind: 'bullet', text: String(sb) })
        }
        if (sec.example) blocks.push({ kind: 'callout', text: `${tr('Exemplo:')} ${String(sec.example)}` })
        if (sec.callout) blocks.push({ kind: 'callout', text: String(sec.callout) })
        if (sec.table?.headers && sec.table?.rows) {
          blocks.push({ kind: 'table', headers: sec.table.headers, rows: sec.table.rows })
        }
        if (sec.comparison && (Array.isArray(sec.comparison.leftItems) || Array.isArray(sec.comparison.rightItems))) {
          blocks.push({
            kind: 'comparison',
            leftTitle: String(sec.comparison.leftTitle || ''),
            leftItems: Array.isArray(sec.comparison.leftItems) ? sec.comparison.leftItems.map(String) : [],
            rightTitle: String(sec.comparison.rightTitle || ''),
            rightItems: Array.isArray(sec.comparison.rightItems) ? sec.comparison.rightItems.map(String) : []
          })
        }
        if (Array.isArray(sec.timeline) && sec.timeline.length > 0) {
          blocks.push({
            kind: 'timeline',
            timelineItems: sec.timeline.map((it: any) => ({
              step: String(it?.step || it?.title || ''),
              detail: String(it?.detail || it?.description || '')
            }))
          })
        }
        if (Array.isArray(sec.checklist) && sec.checklist.length > 0) {
          blocks.push({
            kind: 'checklist',
            checklistTitle: sec.checklistTitle ? String(sec.checklistTitle) : undefined,
            checklistItems: sec.checklist.map(String)
          })
        }
      }
      if (Array.isArray(ch.exercises) && ch.exercises.length > 0) {
        blocks.push({ kind: 'heading', text: tr('Exercícios de Fixação') })
        ch.exercises.forEach((ex: any, i: number) => {
          blocks.push({ kind: 'bullet', text: `${i + 1}. ${String(ex.question || '')}` })
          if (ex.answer) blocks.push({ kind: 'paragraph', text: `${tr('Gabarito:')} ${String(ex.answer)}` })
        })
      }
    })
    if (data.conclusion) {
      blocks.push({ kind: 'heading', text: tr('Considerações Finais') })
      blocks.push({ kind: 'paragraph', text: String(data.conclusion) })
    }
    if (Array.isArray(data.glossary) && data.glossary.length > 0) {
      blocks.push({ kind: 'heading', text: tr('Glossário') })
      for (const g of data.glossary) {
        blocks.push({ kind: 'bullet', text: `${String(g.term || '')}: ${String(g.definition || '')}` })
      }
    }
    if (Array.isArray(data.references) && data.references.length > 0) {
      blocks.push({ kind: 'heading', text: tr('Referências') })
      for (const r of data.references) blocks.push({ kind: 'paragraph', text: String(r) })
    }
    return blocks
  }

  // Generic structured document (report, resume, lesson_plan, meeting_minutes, contract, faq, newsletter)
  blocks.push({ kind: 'title', text: String(data.title || data.fullName || tr('Documento')) })
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
      headers: [tr('Indicador'), tr('Valor'), tr('Tendência')],
      rows: data.kpis.map((k: any) => [String(k.label || ''), String(k.value || ''), String(k.trend || '-')])
    })
  }
  for (const sec of data.sections || data.clauses || data.blocks || data.stages || []) {
    blocks.push({ kind: 'heading', text: String(sec.heading || sec.title || sec.phase || tr('Cláusula {number}', { number: sec.number || '' })) })
    blocks.push({ kind: 'paragraph', text: String(sec.body || sec.text || sec.activity || '') })
    if (sec.table?.headers && sec.table?.rows) {
      blocks.push({ kind: 'table', headers: sec.table.headers, rows: sec.table.rows })
    }
  }
  if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
    blocks.push({ kind: 'heading', text: tr('Recomendações') })
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

export interface DocumentImageAttachment {
  name: string
  base64: string
  caption?: string
}

export async function renderDocxAndPdf(opts: {
  toolId: ToolId
  template: TemplateManifest
  tokens: DesignTokens
  data: Record<string, any>
  brandKit?: BrandKit | null
  attachments?: DocumentImageAttachment[]
  locale?: string
}): Promise<{
  docxBuffer: Buffer
  pdfBuffer: Buffer
  previewSvgs: string[]
  qaReport: VisualQAReport
}> {
  const tr = (text: string, vars?: Record<string, string | number>) =>
    translateCore(normalizeLocale(opts.locale), text, vars)
  const blocks = buildDocumentBlocks(opts.toolId, opts.data, opts.brandKit, opts.locale)
  const attachmentsHeading = tr('Anexos')
  const isAbnt = opts.toolId === 'abnt'
  const primaryHex = opts.tokens.primary.replace('#', '')
  const textHex = opts.tokens.textPrimary.replace('#', '')
  const fontBody = opts.tokens.bodyFont || (isAbnt ? 'Liberation Serif' : 'Inter')

  // 1. Build native editable DOCX
  const docChildren: Array<Paragraph | Table> = []
  for (const b of blocks) {
    if (b.kind === 'page_break') {
      docChildren.push(new Paragraph({ children: [new PageBreak()] }))
    } else if (b.kind === 'cover') {
      if (b.institution) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: b.institution.toUpperCase(), bold: true, size: 22, color: textHex, font: fontBody })]
          })
        )
      }
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 220 },
          children: [new TextRun({ text: b.text || '', bold: true, size: 44, color: primaryHex, font: fontBody })]
        })
      )
      if (b.subtitle) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [new TextRun({ text: b.subtitle, italics: true, size: 24, color: '475569', font: fontBody })]
          })
        )
      }
      if (b.presentation) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 480, after: 120 },
            children: [new TextRun({ text: tr('Apresentação'), bold: true, size: 24, color: primaryHex, font: fontBody })]
          }),
          new Paragraph({
            spacing: { after: 200, line: 276 },
            children: [new TextRun({ text: b.presentation, size: 22, color: textHex, font: fontBody })]
          })
        )
      }
    } else if (b.kind === 'toc') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 120, after: 240 },
          children: [new TextRun({ text: b.text || tr('Sumário'), bold: true, size: 32, color: primaryHex, font: fontBody })]
        })
      )
      for (const item of b.tocItems || []) {
        docChildren.push(
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: item, size: 22, color: textHex, font: fontBody })]
          })
        )
      }
    } else if (b.kind === 'chapter_heading') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 320, after: 140 },
          keepNext: true,
          children: [
            new TextRun({
              text: `${b.moduleNumber ? `${String(b.moduleNumber).padStart(2, '0')} · ` : ''}${b.text || ''}`,
              bold: true,
              size: 28,
              color: primaryHex,
              font: fontBody
            })
          ]
        })
      )
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
    } else if (b.kind === 'comparison') {
      const leftParas = [
        ...(b.leftTitle
          ? [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.leftTitle, bold: true, size: 22, color: primaryHex, font: fontBody })] })]
          : []),
        ...(b.leftItems || []).map(
          (item) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: item, size: 20, color: textHex, font: fontBody })] })
        )
      ]
      const rightParas = [
        ...(b.rightTitle
          ? [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.rightTitle, bold: true, size: 22, color: primaryHex, font: fontBody })] })]
          : []),
        ...(b.rightItems || []).map(
          (item) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: item, size: 20, color: textHex, font: fontBody })] })
        )
      ]
      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: leftParas.length ? leftParas : [new Paragraph('')] }),
                new TableCell({ children: rightParas.length ? rightParas : [new Paragraph('')] })
              ]
            })
          ]
        })
      )
    } else if (b.kind === 'timeline' && Array.isArray(b.timelineItems)) {
      b.timelineItems.forEach((it, idx) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [new TextRun({ text: `${idx + 1}. ${it.step}`, bold: true, size: 22, color: primaryHex, font: fontBody })]
          })
        )
        if (it.detail) {
          docChildren.push(
            new Paragraph({
              indent: { left: 360 },
              spacing: { after: 100 },
              children: [new TextRun({ text: it.detail, size: 20, color: textHex, font: fontBody })]
            })
          )
        }
      })
    } else if (b.kind === 'checklist' && Array.isArray(b.checklistItems)) {
      if (b.checklistTitle) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [new TextRun({ text: b.checklistTitle, bold: true, size: 22, color: primaryHex, font: fontBody })]
          })
        )
      }
      for (const item of b.checklistItems) {
        docChildren.push(
          new Paragraph({
            indent: { left: 240 },
            spacing: { after: 80 },
            children: [new TextRun({ text: `✓ ${item}`, size: 20, color: textHex, font: fontBody })]
          })
        )
      }
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

  const validAttachments = (opts.attachments || []).filter((att) =>
    /^data:image\/(png|jpe?g);base64,/i.test(att.base64 || '')
  )
  if (validAttachments.length > 0) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 160 },
        keepNext: true,
        children: [new TextRun({ text: attachmentsHeading, bold: true, size: 24, color: primaryHex, font: fontBody })]
      })
    )
    for (const att of validAttachments) {
      const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(att.base64)
      if (!match) continue
      const type = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
      const imgData = Buffer.from(match[2], 'base64')
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 80 },
          children: [
            new ImageRun({
              data: imgData,
              type,
              transformation: { width: 420, height: 260 }
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: att.caption || att.name,
              italics: true,
              size: 18,
              color: '64748B',
              font: fontBody
            })
          ]
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
  const accentC = hexRgb01(opts.tokens.accent)
  const borderC = hexRgb01(opts.tokens.border)
  const textC = hexRgb01(opts.tokens.textPrimary)
  const pdfPrimary = rgb(primaryC.r, primaryC.g, primaryC.b)
  const pdfAccent = rgb(accentC.r, accentC.g, accentC.b)
  const pdfBorder = rgb(borderC.r, borderC.g, borderC.b)
  const pdfSoftTint = rgb(
    Math.min(1, accentC.r * 0.1 + 0.9),
    Math.min(1, accentC.g * 0.1 + 0.9),
    Math.min(1, accentC.b * 0.1 + 0.9)
  )
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
    if (b.kind === 'cover') {
      page.drawRectangle({ x: 0, y: pageHeight - 14, width: pageWidth, height: 14, color: pdfPrimary })
      page.drawRectangle({ x: 0, y: pageHeight - 18, width: pageWidth, height: 4, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="0" y="0" width="${pageWidth}" height="14" fill="${opts.tokens.primary}" />` +
          `<rect x="0" y="14" width="${pageWidth}" height="4" fill="${opts.tokens.accent}" />`
      )
      let cy = pageHeight - 95
      if (showLogoInHeader && headerLogoDataUrl) {
        try {
          const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(headerLogoDataUrl)
          if (m) {
            const imgBytes = Buffer.from(m[2], 'base64')
            const embedded = m[1].toLowerCase() === 'png' ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
            const scale = Math.min(96 / embedded.width, 96 / embedded.height, 1)
            const lw = embedded.width * scale
            const lh = embedded.height * scale
            const lx = (pageWidth - lw) / 2
            const ly = cy - lh
            page.drawImage(embedded, { x: lx, y: ly, width: lw, height: lh })
            svgPages[svgPages.length - 1].push(
              `<image href="${escapeXml(headerLogoDataUrl)}" x="${lx.toFixed(1)}" y="${(pageHeight - cy).toFixed(1)}" width="${lw.toFixed(1)}" height="${lh.toFixed(1)}" preserveAspectRatio="xMidYMid meet" />`
            )
            cy = ly - 28
          }
        } catch {}
      }
      if (b.institution) {
        const instLines = wrapTextToLines(b.institution.toUpperCase(), boldFont, 10, usableWidth)
        for (const il of instLines) {
          const iw = boldFont.widthOfTextAtSize(il, 10)
          const ix = (pageWidth - iw) / 2
          page.drawText(il, { x: ix, y: cy, size: 10, font: boldFont, color: pdfAccent })
          svgPages[svgPages.length - 1].push(
            `<text x="${(pageWidth / 2).toFixed(1)}" y="${(pageHeight - cy + 10).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(il)}</text>`
          )
          cy -= 16
        }
        cy -= 10
      }
      const titleLines = wrapTextToLines(b.text || '', boldFont, 24, usableWidth - 24)
      for (const tl of titleLines) {
        const tw = boldFont.widthOfTextAtSize(tl, 24)
        const tx = (pageWidth - tw) / 2
        page.drawText(tl, { x: tx, y: cy, size: 24, font: boldFont, color: pdfPrimary })
        svgPages[svgPages.length - 1].push(
          `<text x="${(pageWidth / 2).toFixed(1)}" y="${(pageHeight - cy + 24).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="24" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(tl)}</text>`
        )
        cy -= 32
      }
      cy -= 8
      const barW = 72
      page.drawRectangle({ x: (pageWidth - barW) / 2, y: cy, width: barW, height: 3, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="${((pageWidth - barW) / 2).toFixed(1)}" y="${(pageHeight - cy).toFixed(1)}" width="${barW}" height="3" rx="1.5" fill="${opts.tokens.accent}" />`
      )
      cy -= 24
      if (b.subtitle) {
        const subLines = wrapTextToLines(b.subtitle, regularFont, 12, usableWidth - 40)
        const mutedRgb = hexRgb01(opts.tokens.textMuted)
        const pdfMuted = rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b)
        for (const sl of subLines) {
          const sw = regularFont.widthOfTextAtSize(sl, 12)
          page.drawText(sl, { x: (pageWidth - sw) / 2, y: cy, size: 12, font: regularFont, color: pdfMuted })
          svgPages[svgPages.length - 1].push(
            `<text x="${(pageWidth / 2).toFixed(1)}" y="${(pageHeight - cy + 12).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" fill="${opts.tokens.textMuted}">${escapeXml(sl)}</text>`
          )
          cy -= 18
        }
      }
      if (b.presentation) {
        const pLines = wrapTextToLines(b.presentation, regularFont, 10.5, usableWidth - 28)
        const boxH = pLines.length * 15 + 38
        const boxTopY = Math.min(cy - 28, marginBottom + boxH + 44)
        const boxBottomY = boxTopY - boxH
        page.drawRectangle({
          x: marginLeft,
          y: boxBottomY,
          width: usableWidth,
          height: boxH,
          color: pdfSoftTint,
          borderColor: pdfBorder,
          borderWidth: 0.7
        })
        page.drawRectangle({ x: marginLeft, y: boxBottomY, width: 3.5, height: boxH, color: pdfAccent })
        svgPages[svgPages.length - 1].push(
          `<rect x="${marginLeft}" y="${(pageHeight - boxTopY).toFixed(1)}" width="${usableWidth}" height="${boxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.8" />` +
            `<rect x="${marginLeft}" y="${(pageHeight - boxTopY).toFixed(1)}" width="3.5" height="${boxH.toFixed(1)}" rx="1.5" fill="${opts.tokens.accent}" />`
        )
        const presTitle = tr('Apresentação')
        page.drawText(presTitle, { x: marginLeft + 14, y: boxTopY - 20, size: 11, font: boldFont, color: pdfPrimary })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft + 14}" y="${(pageHeight - (boxTopY - 20)).toFixed(1)}" font-family="Inter, sans-serif" font-size="11" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(presTitle)}</text>`
        )
        pLines.forEach((pl, idx) => {
          const ly = boxTopY - 38 - idx * 15
          page.drawText(pl, { x: marginLeft + 14, y: ly, size: 10.5, font: regularFont, color: pdfText })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 14}" y="${(pageHeight - ly).toFixed(1)}" font-family="Inter, sans-serif" font-size="10.5" fill="${opts.tokens.textPrimary}">${escapeXml(pl)}</text>`
          )
        })
      }
      currentUsedY = pageHeight - marginTop - marginBottom
      continue
    }

    if (b.kind === 'toc') {
      const tocHeading = b.text || tr('Sumário')
      page.drawText(tocHeading, { x: marginLeft, y: cursorY, size: 18, font: boldFont, color: pdfPrimary })
      svgPages[svgPages.length - 1].push(
        `<text x="${marginLeft}" y="${(pageHeight - cursorY + 18).toFixed(1)}" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(tocHeading)}</text>`
      )
      cursorY -= 14
      page.drawRectangle({ x: marginLeft, y: cursorY, width: 52, height: 2.5, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft}" y="${(pageHeight - cursorY).toFixed(1)}" width="52" height="2.5" rx="1" fill="${opts.tokens.accent}" />`
      )
      cursorY -= 26
      for (const item of b.tocItems || []) {
        const lines = wrapTextToLines(item, regularFont, 11, usableWidth - 28)
        const rowH = lines.length * 16 + 14
        if (cursorY - rowH < marginBottom) startNewPage()
        const boxBottom = cursorY - rowH + 6
        page.drawRectangle({ x: marginLeft, y: boxBottom, width: usableWidth, height: rowH - 4, color: pdfSoftTint })
        svgPages[svgPages.length - 1].push(
          `<rect x="${marginLeft}" y="${(pageHeight - cursorY - 2).toFixed(1)}" width="${usableWidth}" height="${(rowH - 4).toFixed(1)}" rx="5" fill="${opts.tokens.surfaceAlt}" />`
        )
        lines.forEach((ln, idx) => {
          const ly = cursorY - 12 - idx * 16
          page.drawText(ln, { x: marginLeft + 14, y: ly, size: 11, font: regularFont, color: pdfText })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 14}" y="${(pageHeight - ly).toFixed(1)}" font-family="Inter, sans-serif" font-size="11" fill="${opts.tokens.textPrimary}">${escapeXml(ln)}</text>`
          )
        })
        cursorY -= rowH + 4
        currentUsedY += rowH + 4
      }
      continue
    }

    if (b.kind === 'chapter_heading') {
      const chLines = wrapTextToLines(b.text || '', boldFont, 15, usableWidth)
      const needed = chLines.length * 20 + 46
      if (cursorY - needed < marginBottom) startNewPage()
      else if (currentUsedY > 10) {
        cursorY -= 14
        currentUsedY += 14
      }
      if (b.moduleNumber) {
        const modLabel = `${tr('MÓDULO')} ${String(b.moduleNumber).padStart(2, '0')}`
        page.drawText(modLabel, { x: marginLeft, y: cursorY, size: 9, font: boldFont, color: pdfAccent })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft}" y="${(pageHeight - cursorY + 9).toFixed(1)}" font-family="Inter, sans-serif" font-size="9" font-weight="700" letter-spacing="1" fill="${opts.tokens.accent}">${escapeXml(modLabel)}</text>`
        )
        cursorY -= 16
        currentUsedY += 16
      }
      for (const line of chLines) {
        page.drawText(line, { x: marginLeft, y: cursorY, size: 15, font: boldFont, color: pdfPrimary })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft}" y="${(pageHeight - cursorY + 15).toFixed(1)}" font-family="Inter, sans-serif" font-size="15" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(line)}</text>`
        )
        cursorY -= 20
        currentUsedY += 20
      }
      page.drawRectangle({ x: marginLeft, y: cursorY + 6, width: usableWidth, height: 1, color: pdfBorder })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft}" y="${(pageHeight - (cursorY + 6)).toFixed(1)}" width="${usableWidth}" height="1" fill="${opts.tokens.border}" />`
      )
      cursorY -= 14
      currentUsedY += 14
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
      cursorY -= 16
      currentUsedY += 16
      continue
    }

    if (b.kind === 'comparison') {
      const gap = 12
      const colW = (usableWidth - gap) / 2
      const pad = 10
      const leftLines: Array<{ text: string; bold: boolean }> = []
      if (b.leftTitle) {
        for (const l of wrapTextToLines(b.leftTitle, boldFont, 10.5, colW - pad * 2)) leftLines.push({ text: l, bold: true })
      }
      for (const it of b.leftItems || []) {
        for (const l of wrapTextToLines(`• ${it}`, regularFont, 9.5, colW - pad * 2)) leftLines.push({ text: l, bold: false })
      }
      const rightLines: Array<{ text: string; bold: boolean }> = []
      if (b.rightTitle) {
        for (const l of wrapTextToLines(b.rightTitle, boldFont, 10.5, colW - pad * 2)) rightLines.push({ text: l, bold: true })
      }
      for (const it of b.rightItems || []) {
        for (const l of wrapTextToLines(`• ${it}`, regularFont, 9.5, colW - pad * 2)) rightLines.push({ text: l, bold: false })
      }
      const maxLines = Math.max(leftLines.length, rightLines.length, 1)
      const boxH = maxLines * 14 + pad * 2
      if (cursorY - boxH < marginBottom) startNewPage()
      const svgTop = pageHeight - cursorY
      const pdfBottom = cursorY - boxH
      ;[0, 1].forEach((colIdx) => {
        const bx = marginLeft + colIdx * (colW + gap)
        page.drawRectangle({
          x: bx,
          y: pdfBottom,
          width: colW,
          height: boxH,
          color: pdfSoftTint,
          borderColor: pdfBorder,
          borderWidth: 0.7
        })
        svgPages[svgPages.length - 1].push(
          `<rect x="${bx.toFixed(1)}" y="${svgTop.toFixed(1)}" width="${colW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.9" />`
        )
        const lines = colIdx === 0 ? leftLines : rightLines
        lines.forEach((ln, lIdx) => {
          const ly = cursorY - pad - 10 - lIdx * 14
          const svgLy = pageHeight - ly
          page.drawText(ln.text, {
            x: bx + pad,
            y: ly,
            size: ln.bold ? 10.5 : 9.5,
            font: ln.bold ? boldFont : regularFont,
            color: ln.bold ? pdfPrimary : pdfText
          })
          svgPages[svgPages.length - 1].push(
            `<text x="${(bx + pad).toFixed(1)}" y="${svgLy.toFixed(1)}" font-family="Inter, sans-serif" font-size="${ln.bold ? 10.5 : 9.5}" font-weight="${ln.bold ? '700' : '400'}" fill="${ln.bold ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(ln.text)}</text>`
          )
        })
      })
      cursorY -= boxH + 16
      currentUsedY += boxH + 16
      continue
    }

    if (b.kind === 'timeline' && Array.isArray(b.timelineItems)) {
      for (let tIdx = 0; tIdx < b.timelineItems.length; tIdx++) {
        const item = b.timelineItems[tIdx]
        const stepLines = wrapTextToLines(item.step || '', boldFont, 10.5, usableWidth - 28)
        const detailLines = item.detail ? wrapTextToLines(item.detail, regularFont, 9.5, usableWidth - 28) : []
        const itemH = stepLines.length * 14 + detailLines.length * 13 + 12
        if (cursorY - itemH < marginBottom) startNewPage()
        const circleX = marginLeft + 9
        const circleY = cursorY - 6
        const svgCy = pageHeight - circleY
        page.drawCircle({ x: circleX, y: circleY, size: 7.5, color: pdfAccent })
        const numStr = String(tIdx + 1)
        const numW = boldFont.widthOfTextAtSize(numStr, 8)
        page.drawText(numStr, {
          x: circleX - numW / 2,
          y: circleY - 3,
          size: 8,
          font: boldFont,
          color: rgb(1, 1, 1)
        })
        if (tIdx < b.timelineItems.length - 1) {
          page.drawRectangle({ x: circleX - 0.6, y: cursorY - itemH + 2, width: 1.2, height: itemH - 12, color: pdfBorder })
        }
        svgPages[svgPages.length - 1].push(
          (tIdx < b.timelineItems.length - 1
            ? `<line x1="${circleX.toFixed(1)}" y1="${(svgCy + 7.5).toFixed(1)}" x2="${circleX.toFixed(1)}" y2="${(svgCy + itemH - 4).toFixed(1)}" stroke="${opts.tokens.border}" stroke-width="1.2" />`
            : '') +
            `<circle cx="${circleX.toFixed(1)}" cy="${svgCy.toFixed(1)}" r="7.5" fill="${opts.tokens.accent}" />` +
            `<text x="${circleX.toFixed(1)}" y="${(svgCy + 3).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="8.5" font-weight="700" fill="#FFFFFF">${tIdx + 1}</text>`
        )
        let ty = cursorY - 9
        for (const sl of stepLines) {
          page.drawText(sl, { x: marginLeft + 24, y: ty, size: 10.5, font: boldFont, color: pdfPrimary })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 24}" y="${(pageHeight - ty).toFixed(1)}" font-family="Inter, sans-serif" font-size="10.5" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(sl)}</text>`
          )
          ty -= 14
        }
        for (const dl of detailLines) {
          page.drawText(dl, { x: marginLeft + 24, y: ty, size: 9.5, font: regularFont, color: pdfText })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 24}" y="${(pageHeight - ty).toFixed(1)}" font-family="Inter, sans-serif" font-size="9.5" fill="${opts.tokens.textPrimary}">${escapeXml(dl)}</text>`
          )
          ty -= 13
        }
        cursorY -= itemH
        currentUsedY += itemH
      }
      cursorY -= 12
      currentUsedY += 12
      continue
    }

    if (b.kind === 'checklist' && Array.isArray(b.checklistItems)) {
      const pad = 12
      const renderedLines: Array<{ text: string; bold: boolean }> = []
      if (b.checklistTitle) {
        for (const l of wrapTextToLines(b.checklistTitle, boldFont, 10.5, usableWidth - pad * 2)) {
          renderedLines.push({ text: l, bold: true })
        }
      }
      for (const it of b.checklistItems) {
        for (const l of wrapTextToLines(`• ${it}`, regularFont, 10, usableWidth - pad * 2)) {
          renderedLines.push({ text: l, bold: false })
        }
      }
      const boxH = renderedLines.length * 15 + pad * 2
      if (cursorY - boxH < marginBottom) startNewPage()
      const svgTop = pageHeight - cursorY
      const pdfBottom = cursorY - boxH
      page.drawRectangle({ x: marginLeft, y: pdfBottom, width: usableWidth, height: boxH, color: pdfSoftTint })
      page.drawRectangle({ x: marginLeft, y: pdfBottom, width: 3.5, height: boxH, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="${usableWidth}" height="${boxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" />` +
          `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="3.5" height="${boxH.toFixed(1)}" rx="1.5" fill="${opts.tokens.accent}" />`
      )
      renderedLines.forEach((ln, idx) => {
        const ly = cursorY - pad - 10 - idx * 15
        page.drawText(ln.text, {
          x: marginLeft + pad + 4,
          y: ly,
          size: ln.bold ? 10.5 : 10,
          font: ln.bold ? boldFont : regularFont,
          color: ln.bold ? pdfPrimary : pdfText
        })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft + pad + 4}" y="${(pageHeight - ly).toFixed(1)}" font-family="Inter, sans-serif" font-size="${ln.bold ? 10.5 : 10}" font-weight="${ln.bold ? '700' : '400'}" fill="${ln.bold ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(ln.text)}</text>`
        )
      })
      cursorY -= boxH + 16
      currentUsedY += boxH + 16
      continue
    }

    const text = b.text || ''
    if (!text.trim()) continue

    if (b.kind === 'callout') {
      const pad = 12
      const rawParagraphs = text.split('\n')
      const lines = rawParagraphs.flatMap((p) => wrapTextToLines(p, boldFont, 10, usableWidth - pad * 2 - 6))
      const boxH = lines.length * 14.5 + pad * 2
      if (cursorY - boxH < marginBottom) startNewPage()
      const svgTop = pageHeight - cursorY
      const pdfBottom = cursorY - boxH
      page.drawRectangle({ x: marginLeft, y: pdfBottom, width: usableWidth, height: boxH, color: pdfSoftTint })
      page.drawRectangle({ x: marginLeft, y: pdfBottom, width: 3.5, height: boxH, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="${usableWidth}" height="${boxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" />` +
          `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="3.5" height="${boxH.toFixed(1)}" rx="1.5" fill="${opts.tokens.accent}" />`
      )
      lines.forEach((line, idx) => {
        const ly = cursorY - pad - 10 - idx * 14.5
        page.drawText(line, { x: marginLeft + pad + 4, y: ly, size: 10, font: boldFont, color: pdfPrimary })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft + pad + 4}" y="${(pageHeight - ly).toFixed(1)}" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(line)}</text>`
        )
      })
      cursorY -= boxH + 16
      currentUsedY += boxH + 16
      continue
    }

    const isHeading = b.kind === 'title' || b.kind === 'heading'
    const fontSize = b.kind === 'title' ? 18 : b.kind === 'heading' ? 13 : b.kind === 'quote' ? 10 : 11
    const lineHeight = fontSize * (isAbnt ? 1.55 : 1.4)
    const font = isHeading ? boldFont : regularFont
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
        color: isHeading ? pdfPrimary : pdfText
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

  if (validAttachments.length > 0) {
    if (cursorY - 80 < marginBottom) startNewPage()
    const anexosSvgY = pageHeight - cursorY + 13
    page.drawText(attachmentsHeading, {
      x: marginLeft,
      y: cursorY,
      size: 13,
      font: boldFont,
      color: pdfPrimary
    })
    svgPages[svgPages.length - 1].push(
      `<text x="${marginLeft}" y="${anexosSvgY.toFixed(1)}" font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(attachmentsHeading)}</text>`
    )
    cursorY -= 24
    currentUsedY += 24

    for (const att of validAttachments) {
      try {
        const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(att.base64)
        if (!match) continue
        const imgBytes = Buffer.from(match[2], 'base64')
        const embedded =
          match[1].toLowerCase() === 'png' ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
        const scale = Math.min(usableWidth / embedded.width, 220 / embedded.height, 1)
        const drawW = embedded.width * scale
        const drawH = embedded.height * scale
        if (cursorY - drawH - 28 < marginBottom) startNewPage()
        const imgX = marginLeft + (usableWidth - drawW) / 2
        const imgY = cursorY - drawH
        page.drawImage(embedded, { x: imgX, y: imgY, width: drawW, height: drawH })
        const svgTop = pageHeight - cursorY
        svgPages[svgPages.length - 1].push(
          `<image href="${escapeXml(att.base64)}" x="${imgX.toFixed(1)}" y="${svgTop.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawH.toFixed(1)}" preserveAspectRatio="xMidYMid meet" />`
        )
        cursorY = imgY - 14
        const capText = toWinAnsiSafe(att.caption || att.name)
        const capW = regularFont.widthOfTextAtSize(capText, 9)
        const capX = marginLeft + Math.max(0, (usableWidth - capW) / 2)
        const capRgb = hexRgb01('64748B')
        page.drawText(capText, { x: capX, y: cursorY, size: 9, font: regularFont, color: rgb(capRgb.r, capRgb.g, capRgb.b) })
        svgPages[svgPages.length - 1].push(
          `<text x="${(marginLeft + usableWidth / 2).toFixed(1)}" y="${(pageHeight - cursorY + 9).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="${opts.tokens.textMuted}">${escapeXml(capText)}</text>`
        )
        cursorY -= 22
        currentUsedY += drawH + 36
      } catch {
        // Ignore malformed attachment image without breaking document export
      }
    }
  }

  qaMetrics.push({
    index: svgPages.length - 1,
    label: `Página ${svgPages.length}`,
    fillRatio: Math.min(1, currentUsedY / (pageHeight - marginTop - marginBottom)),
    overflowChars: 0
  })

  const { report } = runVisualQA({ tokens: opts.tokens, pages: qaMetrics, autoRepair: true })

  // Draw page numbers and optional header/footer on the actual PDF pages
  const allPdfPages = pdfDoc.getPages()
  const totalPdfPages = allPdfPages.length
  const mutedPdfRgb = hexRgb01(opts.tokens.textMuted)
  const pdfMutedColor = rgb(mutedPdfRgb.r, mutedPdfRgb.g, mutedPdfRgb.b)
  for (let pIdx = 0; pIdx < totalPdfPages; pIdx++) {
    if (opts.toolId === 'apostila' && pIdx === 0) continue
    const p = allPdfPages[pIdx]
    const pageLabel = toWinAnsiSafe(
      translateCore(normalizeLocale(opts.locale), 'Pág. {current}/{total}', {
        current: pIdx + 1,
        total: totalPdfPages
      })
    )
    const label = footerText ? `${toWinAnsiSafe(footerText)}  |  ${pageLabel}` : pageLabel
    const lw = regularFont.widthOfTextAtSize(label, 8.5)
    p.drawText(label, {
      x: pageWidth - marginRight - lw,
      y: 22,
      size: 8.5,
      font: regularFont,
      color: pdfMutedColor
    })
    if (headerText) {
      const ht = toWinAnsiSafe(headerText)
      p.drawText(ht, {
        x: marginLeft,
        y: pageHeight - 28,
        size: 8.5,
        font: regularFont,
        color: pdfMutedColor
      })
    }
  }

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
    const pageLabel = translateCore(normalizeLocale(opts.locale), 'Pág. {current}/{total}', {
      current: idx + 1,
      total
    })
    const label = footerText ? `${footerText}  |  ${pageLabel}` : pageLabel
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
  const preset = opts.template.layoutPreset || 'classic'
  const isStrictFormal =
    opts.toolId === 'oficio' ||
    opts.toolId === 'abnt' ||
    opts.toolId === 'contract' ||
    opts.toolId === 'meeting_minutes'
  const buildPresetDecorSvg = (idx: number) => {
    if (isStrictFormal || preset === 'classic' || preset === 'academic' || preset === 'minimal') {
      return ''
    }
    if (preset === 'executive' || preset === 'modern') {
      return idx === 0
        ? `<rect x="0" y="0" width="${pageWidth}" height="8" fill="${opts.tokens.primary}"/><rect x="${marginLeft}" y="52" width="64" height="2.5" rx="1.25" fill="${opts.tokens.accent}"/>`
        : `<rect x="0" y="0" width="${pageWidth}" height="4" fill="${opts.tokens.primary}"/>`
    }
    if (preset === 'editorial') {
      return `<rect x="${marginLeft}" y="38" width="${usableWidth}" height="1" fill="${opts.tokens.border}"/><rect x="0" y="0" width="5" height="${pageHeight}" fill="${opts.tokens.primary}"/>`
    }
    if (preset === 'whiteboard' || preset === 'playful') {
      return `<rect x="18" y="18" width="${pageWidth - 36}" height="${pageHeight - 36}" rx="12" fill="none" stroke="${opts.tokens.accent}" stroke-width="1" stroke-dasharray="6 4" opacity="0.45"/>`
    }
    return ''
  }
  const previewSvgs = svgPages.map(
    (els, idx) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWidth} ${pageHeight}" width="100%" style="background:${opts.tokens.surface}"><rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="${opts.tokens.surface}" stroke="${opts.tokens.border}" stroke-width="1"/>${buildPresetDecorSvg(idx)}${headerSvgMarkup}${els.join('')}${buildFooterSvg(idx, svgPages.length)}</svg>`
  )

  return { docxBuffer, pdfBuffer, previewSvgs, qaReport: report }
}
