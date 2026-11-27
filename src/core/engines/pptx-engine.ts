import PptxGenJS from 'pptxgenjs'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { BrandKit, DesignTokens, LayoutPreset, VisualQAReport } from '../types.ts'
import { normalizeLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'
import { runVisualQA, type VisualPageMetric } from '../qa/visual-qa.ts'
import { searchWikimediaImages } from '../media/wikimedia-image.ts'

type ResolvedSlideLayout =
  | 'chart'
  | 'metrics'
  | 'two_col'
  | 'timeline'
  | 'quote'
  | 'horizontal_cards'
  | 'split_visual'

function stripSourceTag(str: string): string {
  return String(str || '')
    .replace(/\s*[\[(](?:Fonte|Source|Fuente|Quelle)[\s\]:][^\]\)]*[\])]/gi, '')
    .replace(/\s*[\[(](?:Nota complementar|Supplementary note|Nota complementaria|Note complémentaire|Ergänzender Hinweis|Nota supplementare)[\])]/gi, '')
    .replace(/\s*[\[(](?:Não encontrado nas fontes fornecidas|Not found in the provided sources|No encontrado en las fuentes proporcionadas|Introuvable dans les sources fournies|In den bereitgestellten Quellen nicht gefunden|Non trovato nelle fonti fornite)[\])]/gi, '')
    .trim()
}

function cleanBulletText(raw: any): string {
  const base = stripSourceTag(typeof raw === 'string' ? raw : String(raw?.text || raw?.title || raw?.label || ''))
  return base.replace(/^[\s\-•*▪▸►–—]+/, '').trim()
}

function splitCardTitleBody(text: string, fallbackHeading: string): { heading: string; body: string } {
  const colonIdx = text.indexOf(':')
  if (colonIdx > 2 && colonIdx <= 34) {
    return {
      heading: text.slice(0, colonIdx).trim(),
      body: text.slice(colonIdx + 1).trim()
    }
  }
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > 5) {
    return {
      heading: words.slice(0, 3).join(' '),
      body: words.slice(3).join(' ')
    }
  }
  return { heading: fallbackHeading, body: text }
}

function wrapSlideLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length >= maxLines) break
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines
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

function extractSlideKeywords(raw: string): string {
  const stop = new Set([
    'para', 'como', 'com', 'sem', 'entre', 'sobre', 'mais', 'menos', 'uma', 'uns', 'umas',
    'dos', 'das', 'nos', 'nas', 'pelos', 'pelas', 'que', 'por', 'the', 'and', 'for', 'with'
  ])
  return String(raw || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stop.has(w.toLowerCase()))
    .slice(0, 3)
    .join(' ')
}

function resolveSlideLayout(
  rawLayout: string,
  idx: number,
  hasMetrics: boolean,
  hasChart: boolean,
  bulletsCount: number
): ResolvedSlideLayout {
  if (hasChart) return 'chart'
  if (hasMetrics) return 'metrics'
  if (rawLayout === 'quote') return 'quote'
  if (rawLayout === 'timeline') return 'timeline'
  if (rawLayout === 'two_col') return 'two_col'
  if (bulletsCount >= 2 && bulletsCount <= 4 && idx % 2 === 0) return 'horizontal_cards'
  return 'split_visual'
}

export async function renderPptxAndPdf(opts: {
  tokens: DesignTokens
  data: Record<string, any>
  brandKit?: BrandKit | null
  layoutPreset?: LayoutPreset
  locale?: string
  disableRemoteImages?: boolean
  selectBestImage?: (opts: {
    slideTitle: string
    imageQuery: string
    candidates: Array<{ title: string; dataUrl: string }>
    allowFallbackPick?: boolean
  }) => Promise<string | null>
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
    { index: 0, label: `${tr('Slide {number}', { number: 1 })} (${tr('Capa')})`, fillRatio: 0.65, overflowChars: 0 }
  ]

  slidesInput.forEach((s: any, i: number) => {
    const bullets = Array.isArray(s.bullets) ? s.bullets : []
    const totalChars = bullets.join(' ').length + String(s.title || '').length
    qaMetrics.push({
      index: i + 1,
      label: tr('Slide {number}', { number: i + 2 }),
      fillRatio: Math.min(1, Math.max(0.25, totalChars / 520)),
      overflowChars: Math.max(0, totalChars - 750)
    })
  })

  const { report, adjustedTokens } = runVisualQA({
    tokens: opts.tokens,
    pages: qaMetrics,
    autoRepair: true,
    locale
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
  const borderHex = adjustedTokens.border.replace('#', '')

  const preset: LayoutPreset = opts.layoutPreset || 'executive'
  const paletteCycle = [accHex, primHex, accHex]

  // Cover slide
  const cover = pptx.addSlide()
  cover.background = { color: bgHex }
  if (preset === 'modern') {
    cover.addShape('rect', { x: 7.2, y: 0, w: 2.8, h: 5.625, fill: { color: altHex } })
    cover.addShape('ellipse', { x: 7.7, y: 1.1, w: 1.8, h: 1.8, fill: { color: accHex } })
    cover.addShape('rect', { x: 0.9, y: 4.55, w: 2.4, h: 0.1, fill: { color: accHex } })
  } else if (preset === 'tech_dark') {
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
    cover.addShape('rect', { x: 0.9, y: 1.32, w: 1.1, h: 0.06, fill: { color: accHex } })
  }
  const cleanTitle = stripSourceTag(String(opts.data.title || tr('Apresentação')))
  const cleanSubtitle = opts.data.subtitle ? stripSourceTag(String(opts.data.subtitle)) : ''
  cover.addText(cleanTitle, {
    x: 0.9,
    y: 1.65,
    w: preset === 'modern' || preset === 'tech_dark' ? 5.9 : 8.2,
    h: 1.35,
    fontSize: 34,
    bold: true,
    color: primHex,
    fontFace: adjustedTokens.headingFont
  })
  if (cleanSubtitle) {
    cover.addText(cleanSubtitle, {
      x: 0.9,
      y: 3.1,
      w: preset === 'modern' || preset === 'tech_dark' ? 5.8 : 8.0,
      h: 1.05,
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
        ? `<rect x="84" y="155" width="120" height="5" rx="2" fill="${adjustedTokens.primary}"/><rect x="660" y="84" width="240" height="372" rx="16" fill="${adjustedTokens.surfaceAlt}" stroke="${adjustedTokens.accent}" stroke-width="1.5"/>`
        : preset === 'editorial' || preset === 'academic'
          ? `<rect x="84" y="72" width="792" height="2" fill="${adjustedTokens.primary}"/><rect x="84" y="468" width="792" height="2" fill="${adjustedTokens.accent}"/>`
          : preset === 'playful' || preset === 'whiteboard'
            ? `<rect x="44" y="44" width="872" height="452" rx="22" fill="${adjustedTokens.surfaceAlt}" stroke="${adjustedTokens.accent}" stroke-width="2.5"/><circle cx="835" cy="115" r="36" fill="${adjustedTokens.primary}" opacity="0.18"/>`
            : preset === 'minimal'
              ? `<rect x="60" y="175" width="6" height="140" rx="3" fill="${adjustedTokens.primary}"/>`
              : `<rect x="84" y="132" width="96" height="5" rx="2.5" fill="${adjustedTokens.accent}"/>`

  const coverTitleLines = wrapSlideLines(cleanTitle, 32, 3)
  const coverSubLines = cleanSubtitle ? wrapSlideLines(cleanSubtitle, 58, 3) : []
  const previewSvgs: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%"><rect width="960" height="540" fill="${adjustedTokens.surface}"/>${coverDecorSvg}${coverTitleLines
      .map(
        (line, li) =>
          `<text x="84" y="${198 + li * 40}" font-size="32" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(line)}</text>`
      )
      .join('')}${coverSubLines
      .map(
        (line, si) =>
          `<text x="84" y="${218 + coverTitleLines.length * 40 + si * 24}" font-size="17" fill="${adjustedTokens.textMuted}">${escapeXml(line)}</text>`
      )
      .join('')}</svg>`
  ]

  const pdfDoc = await PDFDocument.create()
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const bgC = hexRgb01(adjustedTokens.surface)
  const altC = hexRgb01(adjustedTokens.surfaceAlt)
  const primC = hexRgb01(adjustedTokens.primary)
  const accC = hexRgb01(adjustedTokens.accent)
  const txtC = hexRgb01(adjustedTokens.textPrimary)
  const mutedC = hexRgb01(adjustedTokens.textMuted)
  const borderC = hexRgb01(adjustedTokens.border)

  const pdfCover = pdfDoc.addPage([960, 540])
  pdfCover.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(bgC.r, bgC.g, bgC.b) })
  pdfCover.drawRectangle({ x: 0, y: 0, width: 28, height: 540, color: rgb(primC.r, primC.g, primC.b) })
  pdfCover.drawRectangle({ x: 28, y: 0, width: 8, height: 540, color: rgb(accC.r, accC.g, accC.b) })
  coverTitleLines.forEach((line, li) => {
    pdfCover.drawText(toWinAnsiSafe(line), {
      x: 84,
      y: 342 - li * 40,
      size: 32,
      font: fontBold,
      color: rgb(primC.r, primC.g, primC.b)
    })
  })
  coverSubLines.forEach((line, si) => {
    pdfCover.drawText(toWinAnsiSafe(line), {
      x: 84,
      y: 316 - coverTitleLines.length * 40 - si * 24,
      size: 17,
      font: fontReg,
      color: rgb(mutedC.r, mutedC.g, mutedC.b)
    })
  })

  const shouldFetchRemoteImages = !opts.disableRemoteImages && !process.env.VITEST
  const usedImageDataUrls = new Set<string>()
  const slideImages: Array<string | null> = shouldFetchRemoteImages
    ? await Promise.all(
        slidesInput.map(async (s: any, idx: number) => {
          if (typeof s?.imageDataUrl === 'string' && /^data:image\/(?:png|jpe?g);base64,/i.test(s.imageDataUrl)) {
            return s.imageDataUrl
          }
          const bulletsLen = Array.isArray(s?.bullets) ? s.bullets.length : 0
          const hasMetrics = Array.isArray(s?.metrics) && s.metrics.length > 0
          const hasChart = Boolean(s?.chart?.labels?.length && s?.chart?.values?.length)
          const resolved = resolveSlideLayout(String(s?.layout || 'bullets'), idx, hasMetrics, hasChart, bulletsLen)
          if (resolved !== 'split_visual' && !s?.imageQuery) return null

          const queries = [
            String(s?.imageQuery || '').trim(),
            String(s?.imageQueryAlt || '').trim(),
            extractSlideKeywords(String(s?.title || '')),
            extractSlideKeywords(cleanTitle),
            'technology abstract concept'
          ].filter((q, qi, arr) => Boolean(q) && arr.indexOf(q) === qi)

          let bestFallbackCandidate: string | null = null
          for (let qi = 0; qi < queries.length; qi++) {
            const q = queries[qi]
            const candidates = (await searchWikimediaImages(q, 4)).filter(
              (c) => !usedImageDataUrls.has(c.dataUrl)
            )
            if (candidates.length === 0) continue
            if (!bestFallbackCandidate) bestFallbackCandidate = candidates[0].dataUrl
            const isLast = qi === queries.length - 1
            const chosen = opts.selectBestImage
              ? await opts.selectBestImage({
                  slideTitle: String(s?.title || cleanTitle),
                  imageQuery: q,
                  candidates,
                  allowFallbackPick: isLast
                }).catch(() => candidates[0]?.dataUrl || null)
              : candidates[0]?.dataUrl || null
            if (chosen) {
              usedImageDataUrls.add(chosen)
              return chosen
            }
          }
          if (bestFallbackCandidate && !usedImageDataUrls.has(bestFallbackCandidate)) {
            usedImageDataUrls.add(bestFallbackCandidate)
            return bestFallbackCandidate
          }
          return null
        })
      )
    : slidesInput.map(() => null)

  for (let idx = 0; idx < slidesInput.length; idx++) {
    const s = slidesInput[idx] || {}
    const slideTitle = stripSourceTag(String(s.title || `Slide ${idx + 2}`))
    const bullets: string[] = Array.isArray(s.bullets)
      ? s.bullets.slice(0, 6).map(cleanBulletText).filter(Boolean)
      : []
    const metrics = Array.isArray(s.metrics) ? s.metrics.slice(0, 4) : []
    const rawLabels = Array.isArray(s.chart?.labels) ? s.chart.labels.map(String) : []
    const rawValues = Array.isArray(s.chart?.values)
      ? s.chart.values.map((v: any) => {
          const num = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
          return Number.isFinite(num) ? num : 0
        })
      : []
    const chartLen = Math.min(rawLabels.length, rawValues.length)
    const layout = resolveSlideLayout(
      String(s.layout || 'bullets'),
      idx,
      metrics.length > 0,
      Boolean(s.chart && chartLen > 0),
      bullets.length
    )

    // --- PPTX Slide ---
    const slide = pptx.addSlide()
    slide.background = { color: bgHex }
    if (preset === 'minimal') {
      slide.addShape('rect', { x: 0.55, y: 0.88, w: 8.9, h: 0.02, fill: { color: borderHex } })
      slide.addText(slideTitle, {
        x: 0.55,
        y: 0.22,
        w: 8.9,
        h: 0.52,
        fontSize: 21,
        bold: true,
        color: primHex,
        fontFace: adjustedTokens.headingFont
      })
    } else if (preset === 'editorial' || preset === 'academic') {
      slide.addShape('rect', { x: 0.55, y: 0.16, w: 8.9, h: 0.02, fill: { color: primHex } })
      slide.addShape('rect', { x: 0.55, y: 0.88, w: 8.9, h: 0.02, fill: { color: borderHex } })
      slide.addText(slideTitle, {
        x: 0.55,
        y: 0.25,
        w: 8.9,
        h: 0.52,
        fontSize: 21,
        bold: true,
        color: primHex,
        fontFace: adjustedTokens.headingFont
      })
    } else if (preset === 'modern') {
      slide.addShape('rect', { x: 0.55, y: 0.22, w: 0.1, h: 0.52, fill: { color: primHex } })
      slide.addShape('rect', { x: 0.55, y: 0.88, w: 8.9, h: 0.02, fill: { color: borderHex } })
      slide.addText(slideTitle, {
        x: 0.8,
        y: 0.2,
        w: 8.65,
        h: 0.54,
        fontSize: 21,
        bold: true,
        color: primHex,
        fontFace: adjustedTokens.headingFont
      })
    } else {
      slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.86, fill: { color: altHex } })
      slide.addShape('rect', { x: 0, y: 0.86, w: 10, h: 0.025, fill: { color: accHex } })
      slide.addText(slideTitle, {
        x: 0.6,
        y: 0.18,
        w: 8.8,
        h: 0.5,
        fontSize: 20,
        bold: true,
        color: primHex,
        fontFace: adjustedTokens.headingFont
      })
    }

    // --- SVG & PDF setup ---
    const svgParts: string[] = []
    const pdfPage = pdfDoc.addPage([960, 540])
    pdfPage.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(bgC.r, bgC.g, bgC.b) })
    if (preset === 'minimal') {
      pdfPage.drawRectangle({ x: 52, y: 456, width: 856, height: 1.5, color: rgb(borderC.r, borderC.g, borderC.b) })
    } else if (preset === 'editorial' || preset === 'academic') {
      pdfPage.drawRectangle({ x: 52, y: 522, width: 856, height: 1.5, color: rgb(primC.r, primC.g, primC.b) })
      pdfPage.drawRectangle({ x: 52, y: 456, width: 856, height: 1.5, color: rgb(borderC.r, borderC.g, borderC.b) })
    } else if (preset === 'modern') {
      pdfPage.drawRectangle({ x: 52, y: 472, width: 8, height: 44, color: rgb(primC.r, primC.g, primC.b) })
      pdfPage.drawRectangle({ x: 52, y: 456, width: 856, height: 1.5, color: rgb(borderC.r, borderC.g, borderC.b) })
    } else {
      pdfPage.drawRectangle({ x: 0, y: 458, width: 960, height: 82, color: rgb(altC.r, altC.g, altC.b) })
      pdfPage.drawRectangle({ x: 0, y: 455, width: 960, height: 3, color: rgb(accC.r, accC.g, accC.b) })
    }

    const titleLines = wrapSlideLines(slideTitle, 54, 2)
    const titleSize = titleLines.length > 1 ? 18 : 21
    const titleY = titleLines.length > 1 ? 33 : 49
    const titleXSvg = preset === 'modern' ? 74 : 52
    titleLines.forEach((line, li) => {
      svgParts.push(
        `<text x="${titleXSvg}" y="${titleY + li * 22}" font-size="${titleSize}" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(line)}</text>`
      )
      pdfPage.drawText(toWinAnsiSafe(line), {
        x: titleXSvg,
        y: (titleLines.length > 1 ? 506 : 491) - li * 22,
        size: titleSize,
        font: fontBold,
        color: rgb(primC.r, primC.g, primC.b)
      })
    })

    if (layout === 'chart') {
      const hasSideBullets = bullets.length > 0
      const chartX = hasSideBullets ? 4.45 : 0.6
      const chartW = hasSideBullets ? 4.95 : 8.8
      slide.addChart(
        s.chart.type === 'line' ? pptx.ChartType.line : s.chart.type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar,
        [{ name: slideTitle, labels: rawLabels.slice(0, chartLen), values: rawValues.slice(0, chartLen) }],
        { x: chartX, y: 1.2, w: chartW, h: 3.7 }
      )
      if (hasSideBullets) {
        bullets.slice(0, 4).forEach((b, bi) => {
          const yIn = 1.25 + bi * 0.9
          const cardColor = paletteCycle[bi % paletteCycle.length]
          slide.addShape('rect', { x: 0.6, y: yIn + 0.06, w: 0.07, h: 0.66, fill: { color: cardColor } })
          slide.addText(b, {
            x: 0.8,
            y: yIn,
            w: 3.4,
            h: 0.78,
            fontSize: 12.5,
            color: txtHex,
            fontFace: adjustedTokens.bodyFont,
            valign: 'middle'
          })
          const sy = 122 + bi * 84
          svgParts.push(`<rect x="52" y="${sy}" width="5" height="62" rx="2.5" fill="#${cardColor}"/>`)
          wrapSlideLines(b, 38, 3).forEach((l, li) => {
            svgParts.push(
              `<text x="70" y="${sy + 20 + li * 18}" font-size="13.5" fill="${adjustedTokens.textPrimary}">${escapeXml(l)}</text>`
            )
          })
          pdfPage.drawRectangle({ x: 52, y: 460 - sy - 58, width: 5, height: 58, color: rgb(accC.r, accC.g, accC.b) })
          wrapSlideLines(b, 38, 3).forEach((l, li) => {
            pdfPage.drawText(toWinAnsiSafe(l), { x: 70, y: 460 - sy - 16 - li * 16, size: 12.5, font: fontReg, color: rgb(txtC.r, txtC.g, txtC.b) })
          })
        })
      }
      const cxSvg = hasSideBullets ? 420 : 60
      const cwSvg = hasSideBullets ? 488 : 840
      const maxVal = Math.max(1, ...rawValues.slice(0, chartLen))
      svgParts.push(`<rect x="${cxSvg}" y="118" width="${cwSvg}" height="346" rx="12" fill="${adjustedTokens.surfaceAlt}"/>`)
      pdfPage.drawRectangle({ x: cxSvg, y: 76, width: cwSvg, height: 346, color: rgb(altC.r, altC.g, altC.b) })
      const barStep = (cwSvg - 64) / Math.max(1, chartLen)
      const barW = Math.min(54, barStep * 0.56)
      for (let ci = 0; ci < Math.min(chartLen, 8); ci++) {
        const val = rawValues[ci]
        const barH = Math.max(12, Math.round((val / maxVal) * 210))
        const bx = cxSvg + 36 + ci * barStep + (barStep - barW) / 2
        const by = 408 - barH
        const bColor = `#${paletteCycle[ci % paletteCycle.length]}`
        svgParts.push(`<rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="6" fill="${bColor}"/>`)
        svgParts.push(`<text x="${bx + barW / 2}" y="${by - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="${adjustedTokens.textPrimary}">${escapeXml(String(val))}</text>`)
        svgParts.push(`<text x="${bx + barW / 2}" y="432" text-anchor="middle" font-size="11" fill="${adjustedTokens.textMuted}">${escapeXml(rawLabels[ci].slice(0, 10))}</text>`)
        pdfPage.drawRectangle({ x: bx, y: 122, width: barW, height: barH, color: rgb(accC.r, accC.g, accC.b) })
        pdfPage.drawText(toWinAnsiSafe(rawLabels[ci].slice(0, 10)), { x: bx, y: 102, size: 10, font: fontReg, color: rgb(mutedC.r, mutedC.g, mutedC.b) })
      }
    } else if (layout === 'metrics') {
      const mCount = metrics.length
      const hasBottomBullets = bullets.length > 0
      const cardWIn = (8.8 - (mCount - 1) * 0.25) / Math.max(1, mCount)
      const cardYIn = hasBottomBullets ? 1.25 : 1.9
      const cardHIn = hasBottomBullets ? 1.45 : 2.15
      const svgW = (856 - (mCount - 1) * 20) / Math.max(1, mCount)
      const svgTop = hasBottomBullets ? 120 : 180
      const svgH = hasBottomBullets ? 136 : 210
      const pdfBottom = 540 - svgTop - svgH

      metrics.forEach((m: any, mIdx: number) => {
        const xPos = 0.6 + mIdx * (cardWIn + 0.25)
        const cHex = paletteCycle[mIdx % paletteCycle.length]
        const valStr = String(m?.value ?? '').trim()
        const lblStr = String(m?.label ?? '').trim()
        const isLongVal = valStr.length > 10
        const valFontSize = isLongVal ? 16 : 24

        slide.addShape('roundRect', { x: xPos, y: cardYIn, w: cardWIn, h: cardHIn, fill: { color: altHex }, rectRadius: 0.1 })
        slide.addShape('rect', { x: xPos, y: cardYIn, w: cardWIn, h: 0.08, fill: { color: cHex } })
        slide.addText(valStr, { x: xPos + 0.16, y: cardYIn + 0.18, w: cardWIn - 0.32, h: isLongVal ? 0.68 : 0.56, fontSize: valFontSize, bold: true, color: cHex, valign: 'top' })
        slide.addText(lblStr, { x: xPos + 0.16, y: cardYIn + (isLongVal ? 0.92 : 0.8), w: cardWIn - 0.32, h: 0.6, fontSize: 12, color: mutedHex, valign: 'top' })

        const sx = 52 + mIdx * (svgW + 20)
        const valMaxChars = Math.max(10, Math.floor((svgW - 36) / (isLongVal ? 10.5 : 14)))
        const valLines = wrapSlideLines(valStr, valMaxChars, 2)
        const lblMaxChars = Math.max(14, Math.floor((svgW - 36) / 7.8))
        const lblLines = wrapSlideLines(lblStr, lblMaxChars, 3)

        svgParts.push(
          `<rect x="${sx}" y="${svgTop}" width="${svgW}" height="${svgH}" rx="12" fill="${adjustedTokens.surfaceAlt}"/>` +
            `<rect x="${sx}" y="${svgTop}" width="${svgW}" height="6" rx="3" fill="#${cHex}"/>`
        )
        valLines.forEach((l, li) => {
          svgParts.push(`<text x="${sx + 18}" y="${svgTop + 48 + li * 22}" font-size="${valFontSize}" font-weight="800" fill="#${cHex}">${escapeXml(l)}</text>`)
        })
        const lblStartSvg = svgTop + 56 + valLines.length * 22
        lblLines.forEach((l, li) => {
          svgParts.push(`<text x="${sx + 18}" y="${lblStartSvg + li * 17}" font-size="12.5" fill="${adjustedTokens.textMuted}">${escapeXml(l)}</text>`)
        })

        pdfPage.drawRectangle({ x: sx, y: pdfBottom, width: svgW, height: svgH, color: rgb(altC.r, altC.g, altC.b) })
        pdfPage.drawRectangle({ x: sx, y: pdfBottom + svgH - 6, width: svgW, height: 6, color: rgb(accC.r, accC.g, accC.b) })
        const pdfValLines = wrapPdfLines(valStr, fontBold, valFontSize, svgW - 36, 2)
        pdfValLines.forEach((l, li) => {
          pdfPage.drawText(toWinAnsiSafe(l), { x: sx + 18, y: pdfBottom + svgH - 46 - li * 21, size: valFontSize, font: fontBold, color: rgb(accC.r, accC.g, accC.b) })
        })
        const pdfLblLines = wrapPdfLines(lblStr, fontReg, 12, svgW - 36, 3)
        pdfLblLines.forEach((l, li) => {
          pdfPage.drawText(toWinAnsiSafe(l), { x: sx + 18, y: pdfBottom + svgH - 58 - pdfValLines.length * 21 - li * 16, size: 12, font: fontReg, color: rgb(mutedC.r, mutedC.g, mutedC.b) })
        })
      })

      if (hasBottomBullets) {
        const bSlice = bullets.slice(0, 3)
        const bwIn = (8.8 - (bSlice.length - 1) * 0.25) / bSlice.length
        bSlice.forEach((b, bi) => {
          const xIn = 0.6 + bi * (bwIn + 0.25)
          slide.addShape('rect', { x: xIn, y: 2.95, w: 0.06, h: 1.5, fill: { color: paletteCycle[bi % paletteCycle.length] } })
          slide.addText(b, { x: xIn + 0.16, y: 2.95, w: bwIn - 0.2, h: 1.5, fontSize: 13, color: txtHex, fontFace: adjustedTokens.bodyFont, valign: 'top' })
          const bSvgW = (856 - (bSlice.length - 1) * 20) / bSlice.length
          const bsx = 52 + bi * (bSvgW + 20)
          svgParts.push(`<rect x="${bsx}" y="280" width="5" height="145" rx="2.5" fill="#${paletteCycle[bi % paletteCycle.length]}"/>`)
          wrapSlideLines(b, 26, 4).forEach((l, li) => {
            svgParts.push(`<text x="${bsx + 18}" y="${304 + li * 22}" font-size="13.5" fill="${adjustedTokens.textPrimary}">${escapeXml(l)}</text>`)
          })
          drawPdfBulletLines(pdfPage, fontReg, b, bsx + 8, 242, 26, rgb(accC.r, accC.g, accC.b), rgb(txtC.r, txtC.g, txtC.b))
        })
      }
    } else if (layout === 'horizontal_cards') {
      const cards = bullets.slice(0, 4)
      const cardCount = Math.max(1, cards.length)
      const gapIn = 0.25
      const cardWIn = (8.8 - (cardCount - 1) * gapIn) / cardCount
      const svgGap = 20
      const svgCardW = (856 - (cardCount - 1) * svgGap) / cardCount
      const cardH = 264
      const cardTopSvg = 148
      const maxHeadingChars = Math.max(12, Math.floor((svgCardW - 44) / 10.5))
      const maxBodyChars = Math.max(15, Math.floor((svgCardW - 44) / 8.5))

      cards.forEach((item, ci) => {
        const cHex = paletteCycle[ci % paletteCycle.length]
        const { heading, body } = splitCardTitleBody(item, `${tr('Ponto')} ${ci + 1}`)
        const xIn = 0.6 + ci * (cardWIn + gapIn)

        slide.addShape('roundRect', { x: xIn, y: 1.5, w: cardWIn, h: 2.85, fill: { color: altHex }, rectRadius: 0.12 })
        slide.addShape('rect', { x: xIn, y: 1.5, w: cardWIn, h: 0.09, fill: { color: cHex } })
        slide.addShape('ellipse', { x: xIn + 0.2, y: 1.78, w: 0.42, h: 0.42, fill: { color: cHex } })
        slide.addText(String(ci + 1).padStart(2, '0'), { x: xIn + 0.2, y: 1.79, w: 0.42, h: 0.4, fontSize: 11.5, bold: true, color: bgHex, align: 'center' })
        slide.addText(heading, { x: xIn + 0.2, y: 2.34, w: cardWIn - 0.4, h: 0.58, fontSize: 14.5, bold: true, color: primHex, fontFace: adjustedTokens.headingFont })
        slide.addText(body, { x: xIn + 0.2, y: 2.96, w: cardWIn - 0.4, h: 1.25, fontSize: 12.5, color: txtHex, fontFace: adjustedTokens.bodyFont, valign: 'top' })

        const sx = 52 + ci * (svgCardW + svgGap)
        svgParts.push(
          `<rect x="${sx}" y="${cardTopSvg}" width="${svgCardW}" height="${cardH}" rx="14" fill="${adjustedTokens.surfaceAlt}"/>` +
            `<rect x="${sx}" y="${cardTopSvg}" width="${svgCardW}" height="7" rx="3.5" fill="#${cHex}"/>` +
            `<circle cx="${sx + 36}" cy="${cardTopSvg + 40}" r="16" fill="#${cHex}"/>` +
            `<text x="${sx + 36}" y="${cardTopSvg + 45}" text-anchor="middle" font-size="12" font-weight="700" fill="${adjustedTokens.surface}">${String(ci + 1).padStart(2, '0')}</text>`
        )
        const hLines = wrapSlideLines(heading, maxHeadingChars, 2)
        hLines.forEach((l, li) => {
          svgParts.push(`<text x="${sx + 20}" y="${cardTopSvg + 86 + li * 20}" font-size="15" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(l)}</text>`)
        })
        const bodyStartSvg = cardTopSvg + 92 + hLines.length * 20
        const bLines = wrapSlideLines(body, maxBodyChars, 5)
        bLines.forEach((l, li) => {
          svgParts.push(`<text x="${sx + 20}" y="${bodyStartSvg + li * 19}" font-size="13" fill="${adjustedTokens.textPrimary}">${escapeXml(l)}</text>`)
        })

        const pdfCardBottom = 540 - cardTopSvg - cardH
        pdfPage.drawRectangle({ x: sx, y: pdfCardBottom, width: svgCardW, height: cardH, color: rgb(altC.r, altC.g, altC.b) })
        pdfPage.drawRectangle({ x: sx, y: pdfCardBottom + cardH - 7, width: svgCardW, height: 7, color: rgb(accC.r, accC.g, accC.b) })
        pdfPage.drawCircle({ x: sx + 34, y: pdfCardBottom + cardH - 38, size: 14, color: rgb(accC.r, accC.g, accC.b) })
        pdfPage.drawText(String(ci + 1).padStart(2, '0'), { x: sx + 27, y: pdfCardBottom + cardH - 42, size: 10.5, font: fontBold, color: rgb(bgC.r, bgC.g, bgC.b) })
        hLines.forEach((l, li) => {
          pdfPage.drawText(toWinAnsiSafe(l), { x: sx + 20, y: pdfCardBottom + cardH - 80 - li * 19, size: 14, font: fontBold, color: rgb(primC.r, primC.g, primC.b) })
        })
        const pdfBodyY = pdfCardBottom + cardH - 86 - hLines.length * 19
        bLines.forEach((l, li) => {
          pdfPage.drawText(toWinAnsiSafe(l), { x: sx + 20, y: pdfBodyY - li * 18, size: 12, font: fontReg, color: rgb(txtC.r, txtC.g, txtC.b) })
        })
      })
    } else if (layout === 'timeline') {
      const steps = bullets.slice(0, 4)
      const count = Math.max(1, steps.length)
      const stepWIn = 8.8 / count
      slide.addShape('rect', { x: 0.9, y: 1.95, w: 8.2, h: 0.05, fill: { color: accHex } })
      svgParts.push(`<line x1="90" y1="184" x2="870" y2="184" stroke="${adjustedTokens.accent}" stroke-width="4"/>`)
      pdfPage.drawLine({ start: { x: 90, y: 356 }, end: { x: 870, y: 356 }, thickness: 3, color: rgb(accC.r, accC.g, accC.b) })

      steps.forEach((st, si) => {
        const cHex = paletteCycle[si % paletteCycle.length]
        const { heading, body } = splitCardTitleBody(st, `${tr('Etapa')} ${si + 1}`)
        const cxIn = 0.6 + si * stepWIn + stepWIn / 2
        slide.addShape('ellipse', { x: cxIn - 0.24, y: 1.72, w: 0.48, h: 0.48, fill: { color: cHex } })
        slide.addText(String(si + 1), { x: cxIn - 0.24, y: 1.73, w: 0.48, h: 0.46, fontSize: 13, bold: true, color: bgHex, align: 'center' })
        slide.addShape('roundRect', { x: 0.65 + si * stepWIn, y: 2.42, w: stepWIn - 0.2, h: 2.15, fill: { color: altHex }, rectRadius: 0.1 })
        slide.addText(heading, { x: 0.78 + si * stepWIn, y: 2.58, w: stepWIn - 0.46, h: 0.5, fontSize: 14, bold: true, color: primHex })
        slide.addText(body, { x: 0.78 + si * stepWIn, y: 3.12, w: stepWIn - 0.46, h: 1.3, fontSize: 12, color: txtHex, valign: 'top' })

        const svgSlotW = 856 / count
        const scx = 52 + si * svgSlotW + svgSlotW / 2
        const scardX = 58 + si * svgSlotW
        const scardW = svgSlotW - 18
        const maxHChars = Math.max(12, Math.floor((scardW - 32) / 10))
        const maxBChars = Math.max(14, Math.floor((scardW - 32) / 8.5))
        svgParts.push(`<circle cx="${scx}" cy="184" r="19" fill="#${cHex}"/>`)
        svgParts.push(`<text x="${scx}" y="190" text-anchor="middle" font-size="14" font-weight="700" fill="${adjustedTokens.surface}">${si + 1}</text>`)
        svgParts.push(`<rect x="${scardX}" y="226" width="${scardW}" height="214" rx="12" fill="${adjustedTokens.surfaceAlt}"/>`)
        const hLines = wrapSlideLines(heading, maxHChars, 2)
        hLines.forEach((l, li) => {
          svgParts.push(`<text x="${scardX + 16}" y="${260 + li * 18}" font-size="14" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(l)}</text>`)
        })
        const bLines = wrapSlideLines(body, maxBChars, 5)
        bLines.forEach((l, li) => {
          svgParts.push(`<text x="${scardX + 16}" y="${272 + hLines.length * 18 + li * 18}" font-size="12.5" fill="${adjustedTokens.textPrimary}">${escapeXml(l)}</text>`)
        })
        pdfPage.drawCircle({ x: scx, y: 356, size: 17, color: rgb(accC.r, accC.g, accC.b) })
        pdfPage.drawText(String(si + 1), { x: scx - 4, y: 351, size: 13, font: fontBold, color: rgb(bgC.r, bgC.g, bgC.b) })
        pdfPage.drawRectangle({ x: scardX, y: 100, width: scardW, height: 214, color: rgb(altC.r, altC.g, altC.b) })
        hLines.forEach((l, li) => {
          pdfPage.drawText(toWinAnsiSafe(l), { x: scardX + 14, y: 284 - li * 18, size: 13, font: fontBold, color: rgb(primC.r, primC.g, primC.b) })
        })
        bLines.forEach((l, li) => {
          pdfPage.drawText(toWinAnsiSafe(l), { x: scardX + 14, y: 270 - hLines.length * 18 - li * 16, size: 11.5, font: fontReg, color: rgb(txtC.r, txtC.g, txtC.b) })
        })
      })
    } else if (layout === 'two_col') {
      const mid = Math.ceil(bullets.length / 2)
      const cols = [bullets.slice(0, mid), bullets.slice(mid)]
      cols.forEach((colItems, cIdx) => {
        const xIn = cIdx === 0 ? 0.6 : 5.15
        const cHex = paletteCycle[cIdx]
        slide.addShape('rect', { x: xIn, y: 1.35, w: 4.25, h: 0.08, fill: { color: cHex } })
        colItems.forEach((item, ii) => {
          const { heading, body } = splitCardTitleBody(item, `${tr('Ponto')} ${ii + 1}`)
          const yIn = 1.65 + ii * 1.1
          slide.addShape('ellipse', { x: xIn + 0.08, y: yIn + 0.08, w: 0.14, h: 0.14, fill: { color: cHex } })
          slide.addText(heading, { x: xIn + 0.34, y: yIn, w: 3.85, h: 0.32, fontSize: 13.5, bold: true, color: primHex })
          slide.addText(body, { x: xIn + 0.34, y: yIn + 0.32, w: 3.85, h: 0.62, fontSize: 12.5, color: txtHex, valign: 'top' })
        })

        const sx = cIdx === 0 ? 52 : 504
        svgParts.push(`<rect x="${sx}" y="132" width="404" height="5" rx="2.5" fill="#${cHex}"/>`)
        pdfPage.drawRectangle({ x: sx, y: 404, width: 404, height: 5, color: rgb(accC.r, accC.g, accC.b) })
        colItems.forEach((item, ii) => {
          const { heading, body } = splitCardTitleBody(item, `${tr('Ponto')} ${ii + 1}`)
          const iy = 176 + ii * 102
          svgParts.push(`<circle cx="${sx + 10}" cy="${iy - 4}" r="5.5" fill="#${cHex}"/>`)
          svgParts.push(`<text x="${sx + 28}" y="${iy}" font-size="14.5" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(heading.slice(0, 34))}</text>`)
          wrapSlideLines(body, 42, 2).forEach((l, li) => {
            svgParts.push(`<text x="${sx + 28}" y="${iy + 22 + li * 19}" font-size="13.5" fill="${adjustedTokens.textPrimary}">${escapeXml(l)}</text>`)
          })
          pdfPage.drawCircle({ x: sx + 10, y: 540 - iy + 4, size: 4.5, color: rgb(accC.r, accC.g, accC.b) })
          pdfPage.drawText(toWinAnsiSafe(heading.slice(0, 34)), { x: sx + 28, y: 540 - iy, size: 13.5, font: fontBold, color: rgb(primC.r, primC.g, primC.b) })
          wrapSlideLines(body, 42, 2).forEach((l, li) => {
            pdfPage.drawText(toWinAnsiSafe(l), { x: sx + 28, y: 540 - iy - 20 - li * 17, size: 12.5, font: fontReg, color: rgb(txtC.r, txtC.g, txtC.b) })
          })
        })
      })
    } else if (layout === 'quote') {
      const mainQuote = bullets[0] || slideTitle
      const noteText = bullets.slice(1).join(' · ')
      slide.addShape('rect', { x: 0.85, y: 1.65, w: 0.12, h: 2.35, fill: { color: accHex } })
      slide.addText('“', { x: 1.15, y: 1.4, w: 0.8, h: 0.8, fontSize: 54, bold: true, color: accHex })
      slide.addText(mainQuote, { x: 1.25, y: 2.05, w: 7.7, h: 1.5, fontSize: 22, bold: true, color: primHex, fontFace: adjustedTokens.headingFont })
      if (noteText) {
        slide.addText(noteText, { x: 1.25, y: 3.65, w: 7.7, h: 0.55, fontSize: 13.5, color: mutedHex })
      }
      svgParts.push(
        `<rect x="82" y="162" width="10" height="220" rx="5" fill="${adjustedTokens.accent}"/>` +
          `<text x="114" y="210" font-size="60" font-weight="800" fill="${adjustedTokens.accent}" opacity="0.45">“</text>`
      )
      wrapSlideLines(mainQuote, 50, 4).forEach((l, li) => {
        svgParts.push(`<text x="120" y="${240 + li * 32}" font-size="23" font-weight="700" fill="${adjustedTokens.primary}">${escapeXml(l)}</text>`)
      })
      if (noteText) {
        svgParts.push(`<text x="120" y="388" font-size="14" fill="${adjustedTokens.textMuted}">${escapeXml(noteText.slice(0, 78))}</text>`)
      }
      pdfPage.drawRectangle({ x: 82, y: 158, width: 10, height: 220, color: rgb(accC.r, accC.g, accC.b) })
      wrapSlideLines(mainQuote, 50, 4).forEach((l, li) => {
        pdfPage.drawText(toWinAnsiSafe(l), { x: 120, y: 312 - li * 30, size: 22, font: fontBold, color: rgb(primC.r, primC.g, primC.b) })
      })
      if (noteText) {
        pdfPage.drawText(toWinAnsiSafe(noteText.slice(0, 78)), { x: 120, y: 168, size: 13, font: fontReg, color: rgb(mutedC.r, mutedC.g, mutedC.b) })
      }
    } else {
      // 'split_visual': borderless structured items + internet image (or transparent diagram fallback)
      const slideImg = slideImages[idx]
      const imgOnLeft = Boolean(slideImg) && idx % 4 === 3
      const textXIn = imgOnLeft ? 4.2 : 0.6
      const textXSvg = imgOnLeft ? 396 : 68
      const imgXIn = imgOnLeft ? 0.6 : 6.1
      const imgXSvg = imgOnLeft ? 52 : 600

      const leftItems = bullets.slice(0, 5)
      const rowStep = leftItems.length <= 3 ? 98 : leftItems.length === 4 ? 78 : 66
      const rowStartSvg = 132
      leftItems.forEach((b, bi) => {
        const cHex = paletteCycle[bi % paletteCycle.length]
        const { heading, body } = splitCardTitleBody(b, `${tr('Item')} ${bi + 1}`)
        const yIn = 1.3 + bi * (leftItems.length <= 3 ? 1.05 : leftItems.length === 4 ? 0.85 : 0.72)
        slide.addShape('ellipse', { x: textXIn, y: yIn + 0.08, w: 0.22, h: 0.22, fill: { color: cHex } })
        slide.addText(
          [
            { text: `${heading}: `, options: { bold: true, color: primHex } },
            { text: body, options: { color: txtHex } }
          ],
          { x: textXIn + 0.34, y: yIn, w: 4.85, h: 0.62, fontSize: 13, fontFace: adjustedTokens.bodyFont, valign: 'top' }
        )

        const sy = rowStartSvg + bi * rowStep
        svgParts.push(`<circle cx="${textXSvg}" cy="${sy + 8}" r="7" fill="#${cHex}"/>`)
        if (bi < leftItems.length - 1) {
          svgParts.push(`<line x1="${textXSvg}" y1="${sy + 20}" x2="${textXSvg}" y2="${sy + rowStep - 4}" stroke="${adjustedTokens.border}" stroke-width="1.5"/>`)
        }
        const fullLine = body ? `${heading}: ${body}` : heading
        wrapSlideLines(fullLine, 52, 2).forEach((l, li) => {
          svgParts.push(`<text x="${textXSvg + 20}" y="${sy + 12 + li * 20}" font-size="14" font-weight="${li === 0 ? 600 : 400}" fill="${adjustedTokens.textPrimary}">${escapeXml(l)}</text>`)
        })
        pdfPage.drawCircle({ x: textXSvg, y: 540 - sy - 4, size: 5.5, color: rgb(accC.r, accC.g, accC.b) })
        wrapSlideLines(fullLine, 52, 2).forEach((l, li) => {
          pdfPage.drawText(toWinAnsiSafe(l), { x: textXSvg + 20, y: 540 - sy - 8 - li * 17, size: 13, font: li === 0 ? fontBold : fontReg, color: rgb(txtC.r, txtC.g, txtC.b) })
        })
      })

      let renderedRemoteImg = false
      if (slideImg) {
        try {
          const match = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(slideImg)
          if (match) {
            const mime = match[1].toLowerCase()
            const imgBuf = Buffer.from(match[2], 'base64')
            const embeddedImg = mime.includes('png') ? await pdfDoc.embedPng(imgBuf) : await pdfDoc.embedJpg(imgBuf)
            const scaled = embeddedImg.scaleToFit(308, 330)
            const drawX = imgXSvg + (308 - scaled.width) / 2
            const drawY = 82 + (330 - scaled.height) / 2
            pdfPage.drawImage(embeddedImg, { x: drawX, y: drawY, width: scaled.width, height: scaled.height })
            slide.addImage({
              data: slideImg,
              x: imgXIn,
              y: 1.35,
              w: 3.3,
              h: 3.35,
              sizing: { type: 'contain', w: 3.3, h: 3.35 }
            })
            svgParts.push(`<image href="${slideImg}" x="${imgXSvg}" y="128" width="308" height="330" preserveAspectRatio="xMidYMid meet"/>`)
            renderedRemoteImg = true
          }
        } catch {
          renderedRemoteImg = false
        }
      }

      if (!renderedRemoteImg) {
        // Right-side transparent vector diagram (no outer box!), varying cleanly by slide index
        const visualLabels = leftItems.slice(0, 3).map((b, bi) => splitCardTitleBody(b, `${tr('Pilar')} ${bi + 1}`).heading.slice(0, 20))
        while (visualLabels.length < 3) visualLabels.push(`${tr('Etapa')} ${visualLabels.length + 1}`)
        const variant = idx % 3

        if (variant === 0) {
          // Layered ascending horizontal bars (transparent background)
          visualLabels.forEach((lbl, vi) => {
            const barW = 2.0 + vi * 0.55
            const yIn = 1.65 + vi * 0.95
            const cHex = paletteCycle[vi % paletteCycle.length]
            slide.addShape('roundRect', { x: 6.15, y: yIn, w: barW, h: 0.68, fill: { color: cHex }, rectRadius: 0.14 })
            slide.addText(lbl, { x: 6.3, y: yIn + 0.08, w: barW - 0.3, h: 0.52, fontSize: 12, bold: true, color: bgHex, valign: 'middle' })

            const sy = 158 + vi * 92
            const sw = 190 + vi * 52
            svgParts.push(`<rect x="604" y="${sy}" width="${sw}" height="58" rx="14" fill="#${cHex}"/>`)
            svgParts.push(`<text x="622" y="${sy + 34}" font-size="13.5" font-weight="700" fill="${adjustedTokens.surface}">${escapeXml(lbl)}</text>`)
            pdfPage.drawRectangle({ x: 604, y: 540 - sy - 58, width: sw, height: 58, color: rgb(accC.r, accC.g, accC.b) })
            pdfPage.drawText(toWinAnsiSafe(lbl), { x: 622, y: 540 - sy - 34, size: 13, font: fontBold, color: rgb(bgC.r, bgC.g, bgC.b) })
          })
        } else if (variant === 1) {
          // Connected triad nodes (transparent background)
          const coords = [
            { x: 752, y: 186, xIn: 7.4, yIn: 1.5 },
            { x: 654, y: 342, xIn: 6.3, yIn: 3.15 },
            { x: 850, y: 342, xIn: 8.3, yIn: 3.15 }
          ]
          svgParts.push(`<line x1="752" y1="186" x2="654" y2="342" stroke="${adjustedTokens.accent}" stroke-width="2.5" opacity="0.5"/>`)
          svgParts.push(`<line x1="752" y1="186" x2="850" y2="342" stroke="${adjustedTokens.accent}" stroke-width="2.5" opacity="0.5"/>`)
          svgParts.push(`<line x1="654" y1="342" x2="850" y2="342" stroke="${adjustedTokens.accent}" stroke-width="2.5" opacity="0.5"/>`)
          pdfPage.drawLine({ start: { x: 752, y: 354 }, end: { x: 654, y: 198 }, thickness: 2, color: rgb(accC.r, accC.g, accC.b) })
          pdfPage.drawLine({ start: { x: 752, y: 354 }, end: { x: 850, y: 198 }, thickness: 2, color: rgb(accC.r, accC.g, accC.b) })
          pdfPage.drawLine({ start: { x: 654, y: 198 }, end: { x: 850, y: 198 }, thickness: 2, color: rgb(accC.r, accC.g, accC.b) })
          coords.forEach((pt, vi) => {
            const cHex = paletteCycle[vi % paletteCycle.length]
            slide.addShape('ellipse', { x: pt.xIn, y: pt.yIn, w: 0.9, h: 0.9, fill: { color: cHex } })
            slide.addText(String(vi + 1), { x: pt.xIn, y: pt.yIn + 0.05, w: 0.9, h: 0.8, fontSize: 18, bold: true, color: bgHex, align: 'center' })
            svgParts.push(`<circle cx="${pt.x}" cy="${pt.y}" r="38" fill="#${cHex}"/>`)
            svgParts.push(`<text x="${pt.x}" y="${pt.y + 6}" text-anchor="middle" font-size="18" font-weight="800" fill="${adjustedTokens.surface}">${vi + 1}</text>`)
            svgParts.push(`<text x="${pt.x}" y="${pt.y + 56}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${adjustedTokens.textPrimary}">${escapeXml(visualLabels[vi].slice(0, 16))}</text>`)
            pdfPage.drawCircle({ x: pt.x, y: 540 - pt.y, size: 34, color: rgb(accC.r, accC.g, accC.b) })
            pdfPage.drawText(String(vi + 1), { x: pt.x - 4, y: 540 - pt.y - 5, size: 16, font: fontBold, color: rgb(bgC.r, bgC.g, bgC.b) })
          })
        } else {
          // Horizontal flow chevrons / pills stacked vertically (transparent background)
          visualLabels.forEach((lbl, vi) => {
            const sy = 154 + vi * 96
            const cHex = paletteCycle[vi % paletteCycle.length]
            const yIn = 1.6 + vi * 0.96
            slide.addShape('roundRect', { x: 6.1, y: yIn, w: 3.1, h: 0.72, fill: { color: altHex }, line: { color: cHex, pt: 1.5 }, rectRadius: 0.14 })
            slide.addText(`${vi + 1}. ${lbl}`, { x: 6.28, y: yIn + 0.08, w: 2.75, h: 0.56, fontSize: 12.5, bold: true, color: primHex, valign: 'middle' })
            svgParts.push(`<rect x="604" y="${sy}" width="296" height="64" rx="14" fill="${adjustedTokens.surfaceAlt}" stroke="#${cHex}" stroke-width="2"/>`)
            svgParts.push(`<text x="624" y="${sy + 37}" font-size="13.5" font-weight="700" fill="${adjustedTokens.primary}">${vi + 1}. ${escapeXml(lbl)}</text>`)
            pdfPage.drawRectangle({ x: 604, y: 540 - sy - 64, width: 296, height: 64, color: rgb(altC.r, altC.g, altC.b), borderColor: rgb(accC.r, accC.g, accC.b), borderWidth: 1.5 })
            pdfPage.drawText(toWinAnsiSafe(`${vi + 1}. ${lbl}`), { x: 624, y: 540 - sy - 37, size: 13, font: fontBold, color: rgb(primC.r, primC.g, primC.b) })
          })
        }
      }
    }

    if (s.notes) slide.addNotes(String(s.notes))

    const svgHeaderDecor =
      preset === 'minimal'
        ? `<line x1="52" y1="84" x2="908" y2="84" stroke="${adjustedTokens.border}" stroke-width="1.5"/>`
        : preset === 'editorial' || preset === 'academic'
          ? `<line x1="52" y1="18" x2="908" y2="18" stroke="${adjustedTokens.primary}" stroke-width="1.5"/><line x1="52" y1="84" x2="908" y2="84" stroke="${adjustedTokens.border}" stroke-width="1.5"/>`
          : preset === 'modern'
            ? `<rect x="52" y="24" width="8" height="44" rx="2" fill="${adjustedTokens.primary}"/><line x1="52" y1="84" x2="908" y2="84" stroke="${adjustedTokens.border}" stroke-width="1.5"/>`
            : `<rect width="960" height="82" fill="${adjustedTokens.surfaceAlt}"/><rect y="82" width="960" height="3" fill="${adjustedTokens.accent}"/>`

    previewSvgs.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%"><rect width="960" height="540" fill="${adjustedTokens.surface}"/>${svgHeaderDecor}${svgParts.join('')}</svg>`
    )
  }

  const rawOut = await pptx.write({ outputType: 'nodebuffer' })
  const pptxBuffer = Buffer.isBuffer(rawOut) ? rawOut : Buffer.from(rawOut as ArrayBuffer)
  const pdfBuffer = Buffer.from(await pdfDoc.save())

  return { pptxBuffer, pdfBuffer, previewSvgs, qaReport: report }
}

function wrapPdfLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(toWinAnsiSafe(next), fontSize) <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length >= maxLines) break
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines
}

function drawPdfBulletLines(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxChars: number,
  dotColor: ReturnType<typeof rgb>,
  textColor: ReturnType<typeof rgb>
): void {
  page.drawCircle({ x: x + 4, y: y + 4, size: 3.5, color: dotColor })
  const lines = wrapSlideLines(text, maxChars, 3)
  lines.forEach((line, li) => {
    page.drawText(toWinAnsiSafe(line), {
      x: x + 16,
      y: y - li * 16,
      size: 12,
      font,
      color: textColor
    })
  })
}
