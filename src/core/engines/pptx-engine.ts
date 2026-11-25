import PptxGenJS from 'pptxgenjs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { BrandKit, DesignTokens, LayoutPreset, VisualQAReport } from '../types.ts'
import { normalizeLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'
import { runVisualQA, type VisualPageMetric } from '../qa/visual-qa.ts'

function stripSourceTag(str: string): string {
  return String(str || '')
    .replace(/\s*\[Fonte[^\]]*\]/gi, '')
    .replace(/\s*\(Fonte[^)]*\)/gi, '')
    .replace(/\s*\[Nota complementar\]/gi, '')
    .replace(/\s*\(Nota complementar\)/gi, '')
    .replace(/\s*\[Não encontrado nas fontes fornecidas\]/gi, '')
    .trim()
}

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
  layoutPreset?: LayoutPreset
  locale?: string
}): Promise<{
  pptxBuffer: Buffer
  pdfBuffer: Buffer
  previewSvgs: string[]
  qaReport: VisualQAReport
}> {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
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
  pptx.title = String(opts.data.title || tr('Apresentação MomAI Docs'))

  const bgHex = adjustedTokens.surface.replace('#', '')
  const altHex = adjustedTokens.surfaceAlt.replace('#', '')
  const primHex = adjustedTokens.primary.replace('#', '')
  const accHex = adjustedTokens.accent.replace('#', '')
  const txtHex = adjustedTokens.textPrimary.replace('#', '')
  const mutedHex = adjustedTokens.textMuted.replace('#', '')

  const preset: LayoutPreset = opts.layoutPreset || 'executive'

  // Cover slide
  const cover = pptx.addSlide()
  cover.background = { color: bgHex }
  if (preset === 'modern') {
    cover.addShape('rect', { x: 7.2, y: 0, w: 2.8, h: 5.625, fill: { color: altHex } })
    cover.addShape('ellipse', { x: 7.7, y: 1.1, w: 1.8, h: 1.8, fill: { color: accHex } })
    cover.addShape('rect', { x: 0.9, y: 4.55, w: 2.4, h: 0.1, fill: { color: accHex } })
  } else if (preset === 'tech_dark') {
    cover.addShape('rect', { x: 0, y: 0, w: 10, h: 0.08, fill: { color: accHex } })
    cover.addShape('rect', { x: 0.9, y: 1.35, w: 1.4, h: 0.06, fill: { color: primHex } })
    cover.addShape('roundRect', { x: 6.9, y: 0.85, w: 2.4, h: 3.9, fill: { color: altHex }, line: { color: accHex, pt: 1 } })
  } else if (preset === 'editorial' || preset === 'academic') {
    cover.addShape('rect', { x: 0.9, y: 0.75, w: 8.2, h: 0.03, fill: { color: primHex } })
    cover.addShape('rect', { x: 0.9, y: 4.95, w: 8.2, h: 0.02, fill: { color: accHex } })
  } else if (preset === 'playful' || preset === 'whiteboard') {
    cover.addShape('roundRect', { x: 0.45, y: 0.5, w: 9.1, h: 4.6, fill: { color: altHex }, line: { color: accHex, pt: 1.5 } })
    cover.addShape('ellipse', { x: 8.2, y: 0.8, w: 0.9, h: 0.9, fill: { color: primHex } })
  } else if (preset === 'minimal') {
    cover.addShape('rect', { x: 0.65, y: 1.65, w: 0.08, h: 2.2, fill: { color: primHex } })
  } else {
    cover.addShape('rect', { x: 0, y: 0, w: 0.35, h: 5.625, fill: { color: primHex } })
    cover.addShape('rect', { x: 0.35, y: 0, w: 0.08, h: 5.625, fill: { color: accHex } })
  }
  const cleanTitle = stripSourceTag(String(opts.data.title || tr('Apresentação')))
  const cleanSubtitle = opts.data.subtitle ? stripSourceTag(String(opts.data.subtitle)) : ''
  cover.addText(cleanTitle, {
    x: 0.9,
    y: 1.7,
    w: preset === 'modern' || preset === 'tech_dark' ? 5.9 : 8.5,
    h: 1.3,
    fontSize: 34,
    bold: true,
    color: primHex,
    fontFace: adjustedTokens.headingFont
  })
  if (cleanSubtitle) {
    cover.addText(cleanSubtitle, {
      x: 0.9,
      y: 3.1,
      w: preset === 'modern' || preset === 'tech_dark' ? 5.8 : 8.2,
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

  const coverDecorSvg =
    preset === 'modern'
      ? `<rect x="690" y="0" width="270" height="540" fill="${adjustedTokens.surfaceAlt}"/><circle cx="825" cy="210" r="88" fill="${adjustedTokens.accent}" opacity="0.16"/><rect x="84" y="420" width="180" height="6" rx="3" fill="${adjustedTokens.accent}"/>`
      : preset === 'tech_dark'
        ? `<rect x="0" y="0" width="960" height="6" fill="${adjustedTokens.accent}"/><rect x="84" y="155" width="120" height="5" rx="2" fill="${adjustedTokens.primary}"/><rect x="660" y="84" width="240" height="372" rx="16" fill="${adjustedTokens.surfaceAlt}" stroke="${adjustedTokens.accent}" stroke-width="1.5"/>`
        : preset === 'editorial' || preset === 'academic'
          ? `<rect x="84" y="72" width="792" height="2" fill="${adjustedTokens.primary}"/><rect x="84" y="468" width="792" height="2" fill="${adjustedTokens.accent}"/>`
          : preset === 'playful' || preset === 'whiteboard'
            ? `<rect x="44" y="44" width="872" height="452" rx="22" fill="${adjustedTokens.surfaceAlt}" stroke="${adjustedTokens.accent}" stroke-width="2.5"/><circle cx="835" cy="115" r="36" fill="${adjustedTokens.primary}" opacity="0.18"/>`
            : preset === 'minimal'
              ? `<rect x="60" y="175" width="6" height="140" rx="3" fill="${adjustedTokens.primary}"/>`
              : `<rect width="28" height="540" fill="${adjustedTokens.primary}"/><rect x="28" width="8" height="540" fill="${adjustedTokens.accent}"/>`

  const previewSvgs: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%"><rect width="960" height="540" fill="${adjustedTokens.surface}"/>${coverDecorSvg}<text x="84" y="220" font-size="34" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(cleanTitle)}</text><text x="84" y="270" font-size="18" fill="${adjustedTokens.textMuted}">${escapeXml(cleanSubtitle)}</text></svg>`
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
  pdfCover.drawText(toWinAnsiSafe(String(opts.data.title || tr('Apresentação'))), {
    x: 84,
    y: 320,
    size: 32,
    font: fontBold,
    color: rgb(primC.r, primC.g, primC.b)
  })

  for (let idx = 0; idx < slidesInput.length; idx++) {
    const s = slidesInput[idx] || {}
    const slideTitle = stripSourceTag(String(s.title || `Slide ${idx + 2}`))
    const slide = pptx.addSlide()
    slide.background = { color: bgHex }
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.9, fill: { color: altHex } })
    slide.addShape('rect', { x: 0, y: 0.88, w: 10, h: 0.03, fill: { color: accHex } })
    slide.addText(slideTitle, {
      x: 0.6,
      y: 0.2,
      w: 8.8,
      h: 0.5,
      fontSize: 22,
      bold: true,
      color: primHex,
      fontFace: adjustedTokens.headingFont
    })

    const bullets = Array.isArray(s.bullets)
      ? s.bullets
          .slice(0, 6)
          .map((b: any) => stripSourceTag(typeof b === 'string' ? b : String(b?.text || b?.title || b?.label || '')))
          .filter(Boolean)
      : []
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
        slide.addText(String(m?.value ?? ''), {
          x: xPos + 0.15,
          y: 1.4,
          w: 1.75,
          h: 0.55,
          fontSize: 22,
          bold: true,
          color: accHex
        })
        slide.addText(String(m?.label ?? ''), {
          x: xPos + 0.15,
          y: 2.0,
          w: 1.75,
          h: 0.45,
          fontSize: 11,
          color: mutedHex
        })
      })
    }

    const rawLabels = Array.isArray(s.chart?.labels) ? s.chart.labels.map(String) : []
    const rawValues = Array.isArray(s.chart?.values)
      ? s.chart.values.map((v: any) => {
          const num = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
          return Number.isFinite(num) ? num : 0
        })
      : []
    const chartLen = Math.min(rawLabels.length, rawValues.length)
    if (s.chart && chartLen > 0) {
      slide.addChart(
        s.chart.type === 'line' ? pptx.ChartType.line : s.chart.type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar,
        [{ name: String(s.title || tr('Dados')), labels: rawLabels.slice(0, chartLen), values: rawValues.slice(0, chartLen) }],
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

    const svgMetrics = metrics
      .map((m: any, mIdx: number) => {
        const xPos = 56 + mIdx * 214
        return `<rect x="${xPos}" y="114" width="198" height="118" rx="10" fill="${adjustedTokens.surfaceAlt}" stroke="${adjustedTokens.accent}" stroke-width="1.2"/><text x="${xPos + 16}" y="168" font-size="24" font-weight="700" fill="${adjustedTokens.accent}">${escapeXml(String(m.value || '').slice(0, 14))}</text><text x="${xPos + 16}" y="202" font-size="12" fill="${adjustedTokens.textMuted}">${escapeXml(String(m.label || '').slice(0, 22))}</text>`
      })
      .join('')
    const bulletStartY = metrics.length > 0 ? 275 : 148
    const svgBullets = bullets
      .map(
        (b: string, bIdx: number) =>
          `<text x="64" y="${bulletStartY + bIdx * 44}" font-size="17" fill="${adjustedTokens.textPrimary}">• ${escapeXml(b.slice(0, 88))}</text>`
      )
      .join('')
    previewSvgs.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%"><rect width="960" height="540" fill="${adjustedTokens.surface}"/><rect width="960" height="82" fill="${adjustedTokens.surfaceAlt}"/><text x="56" y="52" font-size="23" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(String(s.title || ''))}</text>${svgMetrics}${svgBullets}<text x="904" y="516" text-anchor="end" font-size="12" fill="${adjustedTokens.textMuted}">${idx + 2}/${slidesInput.length + 1}</text></svg>`
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
