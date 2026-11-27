import { strToU8, zipSync } from 'fflate'
import type { DesignTokens, VisualQAReport } from '../types.ts'
import { runVisualQA } from '../qa/visual-qa.ts'
import { normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

function escapeXml(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colLetter(idx: number): string {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function toArgb(hex: string | undefined, fallback: string): string {
  const clean = String(hex || '').replace('#', '').trim().toUpperCase()
  return /^[0-9A-F]{6}$/.test(clean) ? `FF${clean}` : `FF${fallback}`
}

function buildXlsxStylesXml(tokens?: DesignTokens): string {
  const primaryArgb = toArgb(tokens?.primary, '065F46')
  const surfaceAltArgb = toArgb(tokens?.surfaceAlt, 'F0FDF4')
  const borderArgb = toArgb(tokens?.border, 'CBD5E1')
  const textArgb = toArgb(tokens?.textPrimary, '111827')
  const fontName = escapeXml(tokens?.bodyFont || 'Calibri')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="3">` +
    `<font><sz val="11"/><color rgb="${textArgb}"/><name val="${fontName}"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="${fontName}"/></font>` +
    `<font><b/><sz val="11"/><color rgb="${textArgb}"/><name val="${fontName}"/></font>` +
    `</fonts>` +
    `<fills count="4">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="${primaryArgb}"/></patternFill></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="${surfaceAltArgb}"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="3">` +
    `<border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left style="thin"><color rgb="${borderArgb}"/></left><right style="thin"><color rgb="${borderArgb}"/></right><top style="thin"><color rgb="${borderArgb}"/></top><bottom style="thin"><color rgb="${borderArgb}"/></bottom><diagonal/></border>` +
    `<border><left style="thin"><color rgb="${borderArgb}"/></left><right style="thin"><color rgb="${borderArgb}"/></right><top style="medium"><color rgb="${primaryArgb}"/></top><bottom style="thin"><color rgb="${borderArgb}"/></bottom><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="7">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>` +
    `</cellXfs>` +
    `</styleSheet>`
  )
}

export function renderXlsxWorkbook(opts: {
  sheets: Array<{
    name: string
    headers: string[]
    rows: Array<Array<string | number>>
    summaryFormulaRow?: boolean
  }>
  tokens?: DesignTokens
  locale?: string
}): Buffer {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string) => translateCore(locale, text)
  const sheets = opts.sheets.length > 0 ? opts.sheets : [{ name: tr('Dados'), headers: [tr('Item'), tr('Valor')], rows: [] }]
  const files: Record<string, Uint8Array> = {}

  files['[Content_Types].xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join('') +
      `</Types>`
  )

  files['_rels/.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`
  )

  files['xl/workbook.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>` +
      sheets
        .map(
          (s, i) =>
            `<sheet name="${escapeXml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        )
        .join('') +
      `</sheets></workbook>`
  )

  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`
  )

  files['xl/styles.xml'] = strToU8(buildXlsxStylesXml(opts.tokens))

  sheets.forEach((sheet, sIdx) => {
    const colCount = Math.max(sheet.headers.length, ...sheet.rows.map((r) => r.length), 1)
    const allRows: Array<Array<string | number>> = [sheet.headers, ...sheet.rows]
    const colWidths = Array.from({ length: colCount }, (_, cIdx) => {
      let maxLen = 10
      for (const row of allRows) {
        const len = String(row?.[cIdx] ?? '').length
        if (len > maxLen) maxLen = len
      }
      return Math.min(68, Math.max(14, Math.ceil(maxLen * 1.12) + 5))
    })
    const colsXml =
      `<cols>` +
      colWidths
        .map((w, cIdx) => `<col min="${cIdx + 1}" max="${cIdx + 1}" width="${w}" customWidth="1"/>`)
        .join('') +
      `</cols>`

    const rowXmls: string[] = []
    allRows.forEach((row, rIdx) => {
      const isHeader = rIdx === 0
      const isZebra = rIdx > 0 && rIdx % 2 === 0
      let maxLines = 1
      const cells = Array.from({ length: colCount })
        .map((_, cIdx) => {
          const val = row?.[cIdx]
          const ref = `${colLetter(cIdx)}${rIdx + 1}`
          const textStr = String(val ?? '')
          const colW = Math.max(10, Math.floor(colWidths[cIdx] * 0.85))
          const estLines = Math.max(1, Math.ceil(textStr.length / colW))
          if (estLines > maxLines) maxLines = estLines
          if (typeof val === 'number' && Number.isFinite(val)) {
            const styleIdx = isHeader ? 1 : isZebra ? 6 : 5
            return `<c r="${ref}" s="${styleIdx}"><v>${val}</v></c>`
          }
          const styleIdx = isHeader ? 1 : isZebra ? 3 : 2
          return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t>${escapeXml(textStr)}</t></is></c>`
        })
        .join('')
      const rowHeight = isHeader ? 28 : Math.max(24, Math.min(180, maxLines * 17 + 10))
      rowXmls.push(`<row r="${rIdx + 1}" ht="${rowHeight}" customHeight="1">${cells}</row>`)
    })

    if (sheet.summaryFormulaRow && sheet.rows.length > 0) {
      const sumRowIdx = allRows.length + 1
      const formulaCells = Array.from({ length: colCount })
        .map((_, cIdx) => {
          const ref = `${colLetter(cIdx)}${sumRowIdx}`
          if (cIdx === 0) return `<c r="${ref}" s="4" t="inlineStr"><is><t>${escapeXml(tr('Total'))}</t></is></c>`
          const allNum = sheet.rows.every((r) => typeof r[cIdx] === 'number')
          if (allNum) {
            const col = colLetter(cIdx)
            return `<c r="${ref}" s="4"><f>SUM(${col}2:${col}${allRows.length})</f></c>`
          }
          return `<c r="${ref}" s="4" t="inlineStr"><is><t></t></is></c>`
        })
        .join('')
      rowXmls.push(`<row r="${sumRowIdx}" ht="26" customHeight="1">${formulaCells}</row>`)
    }

    files[`xl/worksheets/sheet${sIdx + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
        colsXml +
        `<sheetData>${rowXmls.join('')}</sheetData>` +
        `</worksheet>`
    )
  })

  return Buffer.from(zipSync(files, { level: 6 }))
}

function wrapMindMapText(text: string, maxChars: number, maxLines: number): string[] {
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
  return lines.slice(0, maxLines)
}

export function renderMindMapOrTimelineSvg(opts: {
  rootLabel: string
  mode: 'mindmap' | 'timeline'
  nodes: Array<{ id: string; label: string; detail?: string; dateOrOrder?: string; children?: Array<{ label: string }> }>
  tokens: DesignTokens
  locale?: string
}): { svg: string; qaReport: VisualQAReport } {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const nodes = opts.nodes.slice(0, 12)
  const elements: string[] = []

  if (opts.mode === 'timeline') {
    const w = 1200
    const h = 680
    elements.push(`<line x1="80" y1="340" x2="${w - 80}" y2="340" stroke="${opts.tokens.primary}" stroke-width="4"/>`)
    const step = nodes.length > 1 ? (w - 220) / (nodes.length - 1) : 0
    nodes.forEach((n, idx) => {
      const x = 110 + idx * step
      const above = idx % 2 === 0
      const boxY = above ? 140 : 400
      const lines = wrapMindMapText(n.label, 20, 2)
      elements.push(`<line x1="${x}" y1="340" x2="${x}" y2="${above ? 245 : 400}" stroke="${opts.tokens.border}" stroke-width="2"/>`)
      elements.push(`<circle cx="${x}" cy="340" r="10" fill="${opts.tokens.accent}"/>`)
      elements.push(`<rect x="${x - 86}" y="${boxY}" width="172" height="100" rx="12" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}"/>`)
      elements.push(`<text x="${x}" y="${boxY + 26}" text-anchor="middle" font-size="11" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(String(n.dateOrOrder || `#${idx + 1}`))}</text>`)
      lines.forEach((l, li) => {
        elements.push(`<text x="${x}" y="${boxY + 52 + li * 17}" text-anchor="middle" font-size="12" font-weight="600" fill="${opts.tokens.textPrimary}">${escapeXml(l)}</text>`)
      })
    })
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" font-family="Segoe UI, Inter, Arial, sans-serif"><rect width="${w}" height="${h}" fill="${opts.tokens.surface}"/><text x="48" y="48" font-size="22" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(opts.rootLabel)}</text>${elements.join('')}</svg>`
    const { report } = runVisualQA({
      tokens: opts.tokens,
      pages: [{ index: 0, label: tr('Diagrama {number}', { number: 1 }), fillRatio: 0.7, overflowChars: 0 }],
      locale
    })
    return { svg, qaReport: report }
  }

  const w = 1440
  const rightCount = Math.ceil(nodes.length / 2)
  const leftCount = nodes.length - rightCount
  const maxSide = Math.max(rightCount, leftCount, 1)
  const h = Math.max(820, 180 + maxSide * 145)
  const cx = w / 2
  const cy = h / 2

  const branchPalette = [
    opts.tokens.accent || '#0D9488',
    '#2563EB',
    '#7C3AED',
    '#D97706',
    '#059669'
  ]

  const renderSide = (sideNodes: typeof nodes, side: 'left' | 'right', colorOffset: number) => {
    const count = sideNodes.length
    if (count === 0) return
    const topPad = 96
    const bottomPad = 60
    const usableH = h - topPad - bottomPad
    const stepY = count === 1 ? 0 : usableH / (count - 1)

    sideNodes.forEach((n, i) => {
      const branchColor = branchPalette[(i + colorOffset) % branchPalette.length]
      const ny = count === 1 ? cy : topPad + i * stepY
      const cardW = 248
      const labelLines = wrapMindMapText(n.label, 24, 2)
      const children = Array.isArray(n.children) ? n.children.slice(0, 3).map((c) => c.label).filter(Boolean) : []
      const subText = children.length === 0 && n.detail ? wrapMindMapText(n.detail, 28, 2) : []
      const cardH = Math.max(54, 24 + labelLines.length * 19 + subText.length * 15)

      const hubEdgeX = side === 'right' ? cx + 118 : cx - 118
      const cardX = side === 'right' ? cx + 235 : cx - 235 - cardW
      const cardEdgeX = side === 'right' ? cardX : cardX + cardW
      const ctrl1X = hubEdgeX + (side === 'right' ? 68 : -68)
      const ctrl2X = cardEdgeX + (side === 'right' ? -68 : 68)

      // Smooth organic cubic Bezier curve from central hub to node
      elements.push(
        `<path d="M ${hubEdgeX} ${cy} C ${ctrl1X} ${cy}, ${ctrl2X} ${ny}, ${cardEdgeX} ${ny}" fill="none" stroke="${branchColor}" stroke-width="3" opacity="0.72"/>`
      )
      elements.push(`<circle cx="${cardEdgeX}" cy="${ny}" r="4.5" fill="${branchColor}"/>`)

      // Node card
      const cardTop = ny - cardH / 2
      elements.push(
        `<rect x="${cardX}" y="${cardTop}" width="${cardW}" height="${cardH}" rx="14" fill="${opts.tokens.surfaceAlt}" stroke="${branchColor}" stroke-width="1.8"/>`
      )
      const accentBarX = side === 'right' ? cardX : cardX + cardW - 6
      elements.push(
        `<rect x="${accentBarX}" y="${cardTop + 6}" width="6" height="${cardH - 12}" rx="3" fill="${branchColor}"/>`
      )
      const textStartY = cardTop + 23 + (subText.length === 0 && labelLines.length === 1 ? 10 : 0)
      labelLines.forEach((line, li) => {
        elements.push(
          `<text x="${cardX + 18}" y="${textStartY + li * 19}" font-size="14" font-weight="700" fill="${opts.tokens.textPrimary}">${escapeXml(line)}</text>`
        )
      })
      subText.forEach((line, si) => {
        elements.push(
          `<text x="${cardX + 18}" y="${textStartY + labelLines.length * 19 + 4 + si * 15}" font-size="11" fill="${opts.tokens.textMuted}">${escapeXml(line)}</text>`
        )
      })

      // Child sub-branches fanning out cleanly
      if (children.length > 0) {
        const childW = 166
        const childStartY = ny - ((children.length - 1) * 34) / 2
        const parentOuterX = side === 'right' ? cardX + cardW : cardX
        const childX = side === 'right' ? parentOuterX + 34 : parentOuterX - 34 - childW
        const childEdgeX = side === 'right' ? childX : childX + childW
        children.forEach((cLabel, ci) => {
          const cyChild = childStartY + ci * 34
          const midX = (parentOuterX + childEdgeX) / 2
          elements.push(
            `<path d="M ${parentOuterX} ${ny} C ${midX} ${ny}, ${midX} ${cyChild}, ${childEdgeX} ${cyChild}" fill="none" stroke="${branchColor}" stroke-width="1.6" opacity="0.5"/>`
          )
          elements.push(
            `<rect x="${childX}" y="${cyChild - 13}" width="${childW}" height="26" rx="13" fill="${opts.tokens.surface}" stroke="${branchColor}" stroke-width="1.1" opacity="0.92"/>`
          )
          const cText = wrapMindMapText(cLabel, 21, 1)[0] || cLabel
          elements.push(
            `<text x="${childX + childW / 2}" y="${cyChild + 4}" text-anchor="middle" font-size="11" font-weight="500" fill="${opts.tokens.textPrimary}">${escapeXml(cText)}</text>`
          )
        })
      }
    })
  }

  renderSide(nodes.slice(0, rightCount), 'right', 0)
  renderSide(nodes.slice(rightCount), 'left', rightCount)

  // Central Hub
  const rootLines = wrapMindMapText(opts.rootLabel || tr('Mapa Mental'), 20, 3)
  const hubW = 236
  const hubH = Math.max(82, 34 + rootLines.length * 22)
  elements.push(`<rect x="${cx - hubW / 2 - 5}" y="${cy - hubH / 2 - 5}" width="${hubW + 10}" height="${hubH + 10}" rx="28" fill="${opts.tokens.accent}" opacity="0.14"/>`)
  elements.push(`<rect x="${cx - hubW / 2}" y="${cy - hubH / 2}" width="${hubW}" height="${hubH}" rx="24" fill="${opts.tokens.primary}"/>`)
  const rootStartY = cy - ((rootLines.length - 1) * 22) / 2 + 5
  rootLines.forEach((line, li) => {
    elements.push(
      `<text x="${cx}" y="${rootStartY + li * 22}" text-anchor="middle" font-size="16" font-weight="800" fill="${opts.tokens.surface || '#FFFFFF'}">${escapeXml(line)}</text>`
    )
  })

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" font-family="Segoe UI, Inter, Arial, sans-serif">` +
    `<defs><pattern id="mm-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" fill="${opts.tokens.border}" opacity="0.45"/></pattern></defs>` +
    `<rect width="${w}" height="${h}" fill="${opts.tokens.surface}"/>` +
    `<rect width="${w}" height="${h}" fill="url(#mm-dots)"/>` +
    `${elements.join('')}` +
    `</svg>`

  const { report } = runVisualQA({
    tokens: opts.tokens,
    pages: [{ index: 0, label: tr('Diagrama {number}', { number: 1 }), fillRatio: 0.75, overflowChars: 0 }],
    locale
  })
  return { svg, qaReport: report }
}

export function exportFlashcardsCsvAndAnki(opts: {
  deckTitle: string
  cards: Array<{
    front: string
    back?: string
    options?: string[]
    correctIndex?: number
    explanation?: string
    citationLocator?: string
  }>
  locale?: string
}): { csvText: string; ankiTsvText: string } {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string) => translateCore(locale, text)
  const escCsv = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`
  const resolveAnswer = (c: { back?: string; options?: string[]; correctIndex?: number }) => {
    if (c.back && String(c.back).trim()) return String(c.back)
    if (Array.isArray(c.options) && typeof c.correctIndex === 'number' && c.options[c.correctIndex]) {
      return String(c.options[c.correctIndex])
    }
    return ''
  }
  const csvRows = [
    [tr('Pergunta'), tr('Resposta'), tr('Explicação'), tr('Fonte')].map(escCsv).join(','),
    ...opts.cards.map((c) =>
      [c.front, resolveAnswer(c), c.explanation || '', c.citationLocator || ''].map(escCsv).join(',')
    )
  ]
  const ankiRows = opts.cards.map((c) => {
    const answer = resolveAnswer(c)
    return `${c.front.replace(/\t|\n/g, ' ')}\t${answer.replace(/\t|\n/g, ' ')}${c.citationLocator ? ` (${c.citationLocator})` : ''}`
  })
  return {
    csvText: csvRows.join('\n'),
    ankiTsvText: ankiRows.join('\n')
  }
}
