import PptxGenJS from 'pptxgenjs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { BrandKit, DesignTokens, VisualQAReport } from '../types.ts'
import { runVisualQA, type VisualPageMetric } from '../qa/visual-qa.ts'

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toWinAnsiSafe(text: string): string {
  return String(text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ')
}

function hexRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').padEnd(6, '0').slice(0, 6)
  const n = parseInt(clean, 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

export async function renderPptxAndPdf(opts: {
  tokens: DesignTokens
  data: Record<string, any>
  brandKit?: BrandKit | null
}): Promise<{
  pptxBuffer: Buffer
  pdfBuffer: Buffer
  previewSvgs: string[]
  qaReport: VisualQAReport
}> {
  const slidesInput = Array.isArray(opts.data.slides) ? opts.data.slides : []
  const qaMetrics: VisualPageMetric[] = [
    { index: 0, label: 'Slide 1 (Capa)', fillRatio: 0.65, overflowChars: 0 }
  ]

  slidesInput.forEach((s: any, i: number) => {
    const bullets = Array.isArray(s.bullets) ? s.bullets : []
    const totalChars = bullets.join(' ').length + String(s.title || '').length
    qaMetrics.push({
      index: i + 1,
      label: `Slide ${i + 2}`,
      fillRatio: Math.min(1, Math.max(0.25, totalChars / 520)),
      overflowChars: Math.max(0, totalChars - 750)
    })
  })

  const { report, adjustedTokens } = runVisualQA({
    tokens: opts.tokens,
    pages: qaMetrics,
    autoRepair: true
  })

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = String(opts.data.title || 'Apresentação MomAI Docs')

  const bgHex = adjustedTokens.surface.replace('#', '')
  const altHex = adjustedTokens.surfaceAlt.replace('#', '')
  const primHex = adjustedTokens.primary.replace('#', '')
  const accHex = adjustedTokens.accent.replace('#', '')
  const txtHex = adjustedTokens.textPrimary.replace('#', '')
  const mutedHex = adjustedTokens.textMuted.replace('#', '')

  // Cover slide
  const cover = pptx.addSlide()
  cover.background = { color: bgHex }
  cover.addShape('rect', { x: 0, y: 0, w: 0.35, h: 5.625, fill: { color: primHex } })
  cover.addText(String(opts.data.title || 'Apresentação'), {
    x: 0.9,
    y: 1.7,
    w: 8.5,
    h: 1.3,
    fontSize: 34,
    bold: true,
    color: primHex,
    fontFace: adjustedTokens.headingFont
  })
  if (opts.data.subtitle) {
    cover.addText(String(opts.data.subtitle), {
      x: 0.9,
      y: 3.1,
      w: 8.2,
      h: 0.9,
      fontSize: 18,
      color: mutedHex,
      fontFace: adjustedTokens.bodyFont
    })
  }
  if (opts.brandKit?.institutionName) {
    cover.addText(opts.brandKit.institutionName, {
      x: 0.9,
      y: 4.8,
      w: 8.0,
      h: 0.4,
      fontSize: 12,
      color: mutedHex
    })
  }

  const previewSvgs: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%"><rect width="960" height="540" fill="${adjustedTokens.surface}"/><rect width="28" height="540" fill="${adjustedTokens.primary}"/><text x="84" y="220" font-size="34" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(String(opts.data.title || 'Apresentação'))}</text><text x="84" y="270" font-size="18" fill="${adjustedTokens.textMuted}">${escapeXml(String(opts.data.subtitle || ''))}</text></svg>`
  ]

  const pdfDoc = await PDFDocument.create()
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const bgC = hexRgb01(adjustedTokens.surface)
  const primC = hexRgb01(adjustedTokens.primary)
  const txtC = hexRgb01(adjustedTokens.textPrimary)

  const pdfCover = pdfDoc.addPage([960, 540])
  pdfCover.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(bgC.r, bgC.g, bgC.b) })
  pdfCover.drawRectangle({ x: 0, y: 0, width: 28, height: 540, color: rgb(primC.r, primC.g, primC.b) })
  pdfCover.drawText(toWinAnsiSafe(String(opts.data.title || 'Apresentação')), {
    x: 84,
    y: 320,
    size: 32,
    font: fontBold,
    color: rgb(primC.r, primC.g, primC.b)
  })

  for (let idx = 0; idx < slidesInput.length; idx++) {
    const s = slidesInput[idx] || {}
    const slide = pptx.addSlide()
    slide.background = { color: bgHex }
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.9, fill: { color: altHex } })
    slide.addText(String(s.title || `Slide ${idx + 2}`), {
      x: 0.6,
      y: 0.2,
      w: 8.8,
      h: 0.5,
      fontSize: 22,
      bold: true,
      color: primHex,
      fontFace: adjustedTokens.headingFont
    })

    const bullets = Array.isArray(s.bullets) ? s.bullets.slice(0, 6).map(String) : []
    const metrics = Array.isArray(s.metrics) ? s.metrics.slice(0, 4) : []

    if (metrics.length > 0) {
      metrics.forEach((m: any, mIdx: number) => {
        const xPos = 0.6 + mIdx * 2.25
        slide.addShape('roundRect', {
          x: xPos,
          y: 1.25,
          w: 2.05,
          h: 1.35,
          fill: { color: altHex },
          line: { color: accHex, pt: 1 }
        })
        slide.addText(String(m.value || ''), {
          x: xPos + 0.15,
          y: 1.4,
          w: 1.75,
          h: 0.55,
          fontSize: 22,
          bold: true,
          color: accHex
        })
        slide.addText(String(m.label || ''), {
          x: xPos + 0.15,
          y: 2.0,
          w: 1.75,
          h: 0.45,
          fontSize: 11,
          color: mutedHex
        })
      })
    }

    if (s.chart && Array.isArray(s.chart.labels) && Array.isArray(s.chart.values) && s.chart.labels.length > 0) {
      slide.addChart(
        s.chart.type === 'line' ? pptx.ChartType.line : s.chart.type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar,
        [{ name: String(s.title || 'Dados'), labels: s.chart.labels, values: s.chart.values.map(Number) }],
        { x: 0.6, y: metrics.length > 0 ? 2.8 : 1.2, w: 8.8, h: metrics.length > 0 ? 2.4 : 3.9 }
      )
    } else if (bullets.length > 0) {
      slide.addText(
        bullets.map((b: string) => ({ text: b, options: { bullet: true, breakLine: true } })),
        {
          x: 0.7,
          y: metrics.length > 0 ? 2.85 : 1.25,
          w: 8.6,
          h: metrics.length > 0 ? 2.3 : 3.9,
          fontSize: 16,
          color: txtHex,
          fontFace: adjustedTokens.bodyFont,
          valign: 'top'
        }
      )
    }

    if (s.notes) slide.addNotes(String(s.notes))

    const svgBullets = bullets
      .map(
        (b: string, bIdx: number) =>
          `<text x="72" y="${155 + bIdx * 48}" font-size="18" fill="${adjustedTokens.textPrimary}">• ${escapeXml(b.slice(0, 90))}</text>`
      )
      .join('')
    previewSvgs.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%"><rect width="960" height="540" fill="${adjustedTokens.surface}"/><rect width="960" height="86" fill="${adjustedTokens.surfaceAlt}"/><text x="56" y="54" font-size="24" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(String(s.title || ''))}</text>${svgBullets}<text x="904" y="516" text-anchor="end" font-size="12" fill="${adjustedTokens.textMuted}">${idx + 2}/${slidesInput.length + 1}</text></svg>`
    )

    const pdfPage = pdfDoc.addPage([960, 540])
    pdfPage.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(bgC.r, bgC.g, bgC.b) })
    pdfPage.drawText(toWinAnsiSafe(String(s.title || '')), {
      x: 56,
      y: 470,
      size: 24,
      font: fontBold,
      color: rgb(primC.r, primC.g, primC.b)
    })
    bullets.forEach((b: string, bIdx: number) => {
      pdfPage.drawText(toWinAnsiSafe(`- ${b.slice(0, 95)}`), {
        x: 64,
        y: 410 - bIdx * 44,
        size: 16,
        font: fontReg,
        color: rgb(txtC.r, txtC.g, txtC.b)
      })
    })
  }

  const rawOut = await pptx.write({ outputType: 'nodebuffer' })
  const pptxBuffer = Buffer.isBuffer(rawOut) ? rawOut : Buffer.from(rawOut as ArrayBuffer)
  const pdfBuffer = Buffer.from(await pdfDoc.save())

  return { pptxBuffer, pdfBuffer, previewSvgs, qaReport: report }
}
