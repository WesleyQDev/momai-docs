import type { DesignTokens } from '../types.ts'
import { normalizeLocale } from '../i18n.ts'
import { renderSvgToPng } from './video-engine.ts'

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function parseLocaleNumber(raw: string, locale: string): number | null {
  const cleaned = String(raw || '').replace(/[%R$€£¥\s\u00a0\u202f']/g, '')
  if (!cleaned) return null
  const decimalComma = !normalizeLocale(locale).startsWith('en')
  let normalized = cleaned
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','
    normalized = cleaned.split(groupingSeparator).join('').replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1
    normalized = decimalComma || decimals !== 3 ? cleaned.replace(',', '.') : cleaned.replace(',', '')
  } else if (lastDot >= 0) {
    const decimals = cleaned.length - lastDot - 1
    normalized = !decimalComma || decimals !== 3 ? cleaned : cleaned.replace(/\./g, '')
  }
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/**
 * Generates a crisp horizontal bar chart PNG (base64 data URL) when a table
 * contains categorical labels and numeric values (>= 3 rows).
 */
export async function maybeRenderTableBarChartPng(
  headers: string[],
  rows: string[][],
  tokens: DesignTokens,
  locale?: string
): Promise<string | null> {
  if (!Array.isArray(headers) || !Array.isArray(rows) || rows.length < 3 || headers.length < 2) {
    return null
  }

  // Find first numeric column (skipping column 0 which is the label)
  let numCol = -1
  for (let c = 1; c < headers.length; c++) {
    const allNumeric = rows.every((r) => parseLocaleNumber(String(r[c] ?? ''), locale || 'pt-BR') !== null)
    if (allNumeric) {
      numCol = c
      break
    }
  }
  if (numCol < 0) return null

  const items = rows.slice(0, 8).map((r) => {
    const label = String(r[0] ?? '').trim()
    const val = parseLocaleNumber(String(r[numCol] ?? ''), locale || 'pt-BR') || 0
    return {
      label: label.length > 26 ? label.slice(0, 24) + '...' : label,
      displayVal: String(r[numCol] ?? ''),
      val
    }
  })

  const maxVal = Math.max(...items.map((i) => i.val), 1)
  const width = 760
  const rowH = 34
  const topPad = 42
  const bottomPad = 18
  const height = topPad + items.length * rowH + bottomPad
  const labelW = 210
  const barMaxW = width - labelW - 110
  const chartTitle = `${headers[0]} x ${headers[numCol]}`

  const barsSvg = items
    .map((it, idx) => {
      const y = topPad + idx * rowH
      const bw = Math.max(8, (it.val / maxVal) * barMaxW)
      return `
        <text x="${labelW - 12}" y="${y + 18}" text-anchor="end" font-family="Segoe UI, Inter, sans-serif" font-size="12" font-weight="600" fill="${esc(tokens.textPrimary)}">${esc(it.label)}</text>
        <rect x="${labelW}" y="${y + 5}" width="${barMaxW}" height="18" rx="4" fill="#F1F5F9" />
        <rect x="${labelW}" y="${y + 5}" width="${bw.toFixed(1)}" height="18" rx="4" fill="${idx === 0 ? esc(tokens.primary) : esc(tokens.accent)}" />
        <text x="${(labelW + bw + 8).toFixed(1)}" y="${y + 18}" font-family="Segoe UI, Inter, sans-serif" font-size="11.5" font-weight="700" fill="${esc(tokens.primary)}">${esc(it.displayVal)}</text>
      `
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#FFFFFF" stroke="${esc(tokens.border)}" stroke-width="1" />
    <text x="20" y="26" font-family="Segoe UI, Inter, sans-serif" font-size="13" font-weight="700" fill="${esc(tokens.primary)}">${esc(chartTitle)}</text>
    ${barsSvg}
  </svg>`

  try {
    const pngBuf = await renderSvgToPng(svg)
    return `data:image/png;base64,${pngBuf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Generates a light, tasteful editorial textbook cover illustration PNG
 * (open book + knowledge spark + subtle geometric arcs) without heavy ink blocks.
 */
export async function renderCoverIllustrationPng(tokens: DesignTokens): Promise<string | null> {
  const w = 520
  const h = 130
  const p = esc(tokens.primary)
  const a = esc(tokens.accent)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <circle cx="260" cy="65" r="52" fill="${a}" fill-opacity="0.08" />
    <circle cx="260" cy="65" r="38" fill="${p}" fill-opacity="0.06" />
    <path d="M90 65 Q175 25 260 65 T430 65" fill="none" stroke="${a}" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.45" />
    <g transform="translate(224, 31)" fill="none" stroke="${p}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12 C4 8 10 6 20 6 C28 6 34 8 36 12 L36 52 C34 48 28 46 20 46 C10 46 4 48 4 52 Z" fill="#FFFFFF" />
      <path d="M68 12 C68 8 62 6 52 6 C44 6 38 8 36 12 L36 52 C38 48 44 46 52 46 C62 46 68 48 68 52 Z" fill="#FFFFFF" />
      <line x1="12" y1="18" x2="28" y2="18" stroke="${a}" stroke-width="2" />
      <line x1="12" y1="26" x2="26" y2="26" stroke="${a}" stroke-width="1.6" opacity="0.7" />
      <line x1="44" y1="18" x2="60" y2="18" stroke="${a}" stroke-width="2" />
      <line x1="44" y1="26" x2="58" y2="26" stroke="${a}" stroke-width="1.6" opacity="0.7" />
    </g>
    <circle cx="152" cy="48" r="4" fill="${a}" opacity="0.55" />
    <circle cx="368" cy="82" r="4" fill="${p}" opacity="0.45" />
  </svg>`

  try {
    const pngBuf = await renderSvgToPng(svg)
    return `data:image/png;base64,${pngBuf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Generates a textbook-style visual concept map / synthesis PNG
 * connecting a module topic to up to 4 key takeaways.
 */
export async function renderConceptMapPng(
  centerTitle: string,
  keyPoints: string[],
  tokens: DesignTokens
): Promise<string | null> {
  const points = keyPoints.map((p) => String(p || '').trim()).filter(Boolean).slice(0, 4)
  if (points.length < 2) return null

  const width = 760
  const height = 220
  const cx = width / 2
  const cy = height / 2
  const p = esc(tokens.primary)
  const a = esc(tokens.accent)
  const b = esc(tokens.border)

  const wrap = (txt: string, maxChars = 24): string[] => {
    const words = txt.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const cand = cur ? `${cur} ${w}` : w
      if (cand.length <= maxChars) cur = cand
      else {
        if (cur) lines.push(cur)
        cur = w
        if (lines.length === 1) break
      }
    }
    if (cur && lines.length < 2) lines.push(cur)
    if (lines.length === 2 && words.join(' ').length > lines.join(' ').length) {
      lines[1] = lines[1].slice(0, maxChars - 3) + '...'
    }
    return lines.length > 0 ? lines : [txt.slice(0, maxChars)]
  }

  const slots = [
    { x: 24, y: 20, anchorX: 230, anchorY: 54 },
    { x: 526, y: 20, anchorX: 526, anchorY: 54 },
    { x: 24, y: 132, anchorX: 230, anchorY: 166 },
    { x: 526, y: 132, anchorX: 526, anchorY: 166 }
  ]

  const centerLines = wrap(centerTitle, 20)
  const nodesSvg = points
    .map((pt, idx) => {
      const s = slots[idx]
      const lines = wrap(pt, 25)
      const lineSvg = lines
        .map(
          (ln, lIdx) =>
            `<text x="${s.x + 14}" y="${s.y + 28 + lIdx * 15}" font-family="Segoe UI, Inter, sans-serif" font-size="11.5" font-weight="600" fill="${esc(tokens.textPrimary)}">${esc(ln)}</text>`
        )
        .join('')
      return `
        <path d="M ${cx} ${cy} C ${(cx + s.anchorX) / 2} ${cy}, ${(cx + s.anchorX) / 2} ${s.anchorY}, ${s.anchorX} ${s.anchorY}" fill="none" stroke="${a}" stroke-width="1.8" stroke-dasharray="4 3" opacity="0.65" />
        <rect x="${s.x}" y="${s.y}" width="210" height="66" rx="8" fill="#F8FAFC" stroke="${b}" stroke-width="1.2" />
        <rect x="${s.x}" y="${s.y}" width="4" height="66" rx="2" fill="${idx % 2 === 0 ? p : a}" />
        <circle cx="${s.anchorX}" cy="${s.anchorY}" r="3.5" fill="${a}" />
        ${lineSvg}
      `
    })
    .join('')

  const centerSvg = centerLines
    .map(
      (ln, lIdx) =>
        `<text x="${cx}" y="${cy - (centerLines.length - 1) * 7 + lIdx * 16 + 4}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="12.5" font-weight="800" fill="#FFFFFF">${esc(ln)}</text>`
    )
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#FFFFFF" stroke="${b}" stroke-width="1" />
    ${nodesSvg}
    <rect x="${cx - 96}" y="${cy - 36}" width="192" height="72" rx="12" fill="${p}" />
    ${centerSvg}
  </svg>`

  try {
    const pngBuf = await renderSvgToPng(svg)
    return `data:image/png;base64,${pngBuf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Generates a visual horizontal process/flow diagram PNG (base64 data URL)
 * for timelines with 3 to 5 steps.
 */
export async function maybeRenderFlowDiagramPng(
  items: Array<{ step: string; detail: string }>,
  tokens: DesignTokens
): Promise<string | null> {
  if (!Array.isArray(items) || items.length < 3 || items.length > 5) return null

  const width = 760
  const height = 132
  const padX = 20
  const gap = 18
  const n = items.length
  const boxW = (width - padX * 2 - gap * (n - 1)) / n
  const boxH = 88
  const boxY = 22

  const wrapDiagramLabel = (text: string, maxCharsPerLine = 18): string[] => {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const cand = cur ? `${cur} ${w}` : w
      if (cand.length <= maxCharsPerLine) cur = cand
      else {
        if (cur) lines.push(cur)
        cur = w
        if (lines.length === 1) break
      }
    }
    if (cur && lines.length < 2) lines.push(cur)
    if (lines.length === 2 && words.join(' ').length > lines.join(' ').length) {
      lines[1] = lines[1].length > maxCharsPerLine - 2 ? lines[1].slice(0, maxCharsPerLine - 3) + '...' : lines[1] + '...'
    }
    return lines.length > 0 ? lines : [text.slice(0, maxCharsPerLine)]
  }

  const nodesSvg = items
    .map((it, idx) => {
      const x = padX + idx * (boxW + gap)
      const stepLabel = String(it.step || '').replace(/^\d+[\.\)]\s*/, '').trim()
      const stepLines = wrapDiagramLabel(stepLabel, n <= 4 ? 19 : 15)
      const arrow =
        idx < n - 1
          ? `<line x1="${(x + boxW + 2).toFixed(1)}" y1="${boxY + boxH / 2}" x2="${(x + boxW + gap - 4).toFixed(1)}" y2="${boxY + boxH / 2}" stroke="${esc(tokens.accent)}" stroke-width="2" />
             <polygon points="${(x + boxW + gap - 2).toFixed(1)},${boxY + boxH / 2} ${(x + boxW + gap - 8).toFixed(1)},${boxY + boxH / 2 - 4} ${(x + boxW + gap - 8).toFixed(1)},${boxY + boxH / 2 + 4}" fill="${esc(tokens.accent)}" />`
          : ''
      const labelSvg = stepLines
        .map(
          (ln, lIdx) =>
            `<text x="${(x + boxW / 2).toFixed(1)}" y="${boxY + 54 + lIdx * 14}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="11" font-weight="700" fill="${esc(tokens.textPrimary)}">${esc(ln)}</text>`
        )
        .join('')
      return `
        <rect x="${x.toFixed(1)}" y="${boxY}" width="${boxW.toFixed(1)}" height="${boxH}" rx="8" fill="#F8FAFC" stroke="${esc(tokens.border)}" stroke-width="1.2" />
        <rect x="${x.toFixed(1)}" y="${boxY}" width="${boxW.toFixed(1)}" height="5" rx="2" fill="${idx === 0 ? esc(tokens.primary) : esc(tokens.accent)}" />
        <circle cx="${(x + boxW / 2).toFixed(1)}" cy="${boxY + 24}" r="11" fill="${esc(tokens.primary)}" />
        <text x="${(x + boxW / 2).toFixed(1)}" y="${boxY + 28}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF">${idx + 1}</text>
        ${labelSvg}
        ${arrow}
      `
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#FFFFFF" stroke="${esc(tokens.border)}" stroke-width="1" />
    ${nodesSvg}
  </svg>`

  try {
    const pngBuf = await renderSvgToPng(svg)
    return `data:image/png;base64,${pngBuf.toString('base64')}`
  } catch {
    return null
  }
}
