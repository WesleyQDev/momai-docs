import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export interface OficioDemoData {
  institution?: string
  documentNumber: string
  placeAndDate: string
  recipientTitle: string
  subject: string
  paragraphs: string[]
  closing: string
  signerName: string
}

const MAX_DEMO_PARAGRAPHS = 4
const MAX_DEMO_CHARS = 1800

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

/** Enforces the strict 1-page demo ceiling on structured oficio content. */
export function clampOficioToSinglePage(input: Partial<OficioDemoData>): OficioDemoData {
  const rawParagraphs = Array.isArray(input.paragraphs) ? input.paragraphs : []
  const paragraphs: string[] = []
  let totalChars = 0

  for (const p of rawParagraphs.slice(0, MAX_DEMO_PARAGRAPHS)) {
    const clean = String(p || '').trim()
    if (!clean) continue
    const remaining = MAX_DEMO_CHARS - totalChars
    if (remaining <= 40) break
    const clipped = clean.length > remaining ? `${clean.slice(0, remaining - 3).trim()}...` : clean
    paragraphs.push(clipped)
    totalChars += clipped.length
  }

  if (paragraphs.length === 0) {
    paragraphs.push('Venho por meio deste apresentar a solicitação descrita em epígrafe.')
  }

  return {
    institution: input.institution ? String(input.institution).trim().slice(0, 120) : undefined,
    documentNumber: String(input.documentNumber || 'Ofício nº 001/2026').trim().slice(0, 80),
    placeAndDate: String(input.placeAndDate || 'Brasília, 2026').trim().slice(0, 80),
    recipientTitle: String(input.recipientTitle || 'Ao Senhor(a) Destinatário(a)').trim().slice(0, 160),
    subject: String(input.subject || 'Assunto Oficial').trim().slice(0, 180),
    paragraphs,
    closing: String(input.closing || 'Atenciosamente,').trim().slice(0, 80),
    signerName: String(input.signerName || 'Signatário').trim().slice(0, 120)
  }
}

export async function renderOficioDemoFiles(data: OficioDemoData): Promise<{
  docxBase64: string
  pdfBase64: string
  previewHtml: string
  pageCount: 1
}> {
  const safe = clampOficioToSinglePage(data)

  // 1. DOCX (single A4 page)
  const docChildren: Paragraph[] = []
  if (safe.institution) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [new TextRun({ text: safe.institution.toUpperCase(), bold: true, size: 22 })]
      })
    )
  }
  docChildren.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: safe.documentNumber, bold: true, size: 24 })]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 180 },
      children: [new TextRun({ text: safe.placeAndDate, size: 22 })]
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [new TextRun({ text: safe.recipientTitle, size: 22 })]
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: `Assunto: ${safe.subject}`, bold: true, size: 22 })]
    })
  )
  safe.paragraphs.forEach((p, idx) => {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 160, line: 300 },
        children: [new TextRun({ text: `${idx + 1}. ${p}`, size: 22 })]
      })
    )
  })
  docChildren.push(
    new Paragraph({
      spacing: { before: 240, after: 320 },
      children: [new TextRun({ text: safe.closing, size: 22 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: safe.signerName, bold: true, size: 22 })]
    })
  )

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1701, bottom: 1134, left: 1701, right: 1134 }
          }
        },
        children: docChildren
      }
    ]
  })
  const docxBuf = await Packer.toBuffer(doc)

  // 2. PDF (strictly 1 page — never adds a second page)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([595.28, 841.89]) // A4
  const marginLeft = 85
  const marginRight = 56
  const maxWidth = 595.28 - marginLeft - marginRight
  const bottomLimit = 64
  let y = 841.89 - 85

  const drawLines = (text: string, size: number, isBold = false, gapAfter = 8) => {
    const activeFont = isBold ? bold : font
    const lineHeight = size * 1.4
    const lines = wrapTextToLines(text, activeFont, size, maxWidth)
    for (const line of lines) {
      if (y - lineHeight < bottomLimit) return
      page.drawText(line, {
        x: marginLeft,
        y,
        size,
        font: activeFont,
        color: rgb(0.11, 0.14, 0.2)
      })
      y -= lineHeight
    }
    y -= gapAfter
  }

  if (safe.institution) drawLines(safe.institution.toUpperCase(), 10, true, 12)
  drawLines(safe.documentNumber, 11, true, 6)
  drawLines(safe.placeAndDate, 10, false, 12)
  drawLines(safe.recipientTitle, 10, false, 12)
  drawLines(`Assunto: ${safe.subject}`, 10.5, true, 14)
  safe.paragraphs.forEach((p, idx) => drawLines(`${idx + 1}. ${p}`, 10.5, false, 10))
  y -= 8
  drawLines(safe.closing, 10.5, false, 20)
  drawLines(safe.signerName, 10.5, true, 0)

  const pdfBytes = await pdf.save()

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const previewHtml = `<div style="font-family:Georgia,serif;color:#0f172a;padding:24px;line-height:1.55;">
    ${safe.institution ? `<p style="text-align:center;font-weight:700;font-size:12px;letter-spacing:.06em;margin-bottom:16px;">${escapeHtml(safe.institution.toUpperCase())}</p>` : ''}
    <p style="font-weight:700;margin-bottom:4px;">${escapeHtml(safe.documentNumber)}</p>
    <p style="text-align:right;margin-bottom:16px;font-size:13px;">${escapeHtml(safe.placeAndDate)}</p>
    <p style="margin-bottom:14px;">${escapeHtml(safe.recipientTitle)}</p>
    <p style="font-weight:700;margin-bottom:14px;">Assunto: ${escapeHtml(safe.subject)}</p>
    ${safe.paragraphs.map((p, i) => `<p style="text-align:justify;margin-bottom:10px;">${i + 1}. ${escapeHtml(p)}</p>`).join('')}
    <p style="margin-top:20px;margin-bottom:24px;">${escapeHtml(safe.closing)}</p>
    <p style="text-align:center;font-weight:700;">${escapeHtml(safe.signerName)}</p>
  </div>`

  return {
    docxBase64: Buffer.from(docxBuf).toString('base64'),
    pdfBase64: Buffer.from(pdfBytes).toString('base64'),
    previewHtml,
    pageCount: 1
  }
}
