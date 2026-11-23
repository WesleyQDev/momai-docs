import { strToU8, zipSync } from 'fflate'
import type { DesignTokens, VisualQAReport } from '../types.ts'
import { runVisualQA } from '../qa/visual-qa.ts'

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

export function renderXlsxWorkbook(opts: {
  sheets: Array<{
    name: string
    headers: string[]
    rows: Array<Array<string | number>>
    summaryFormulaRow?: boolean
  }>
}): Buffer {
  const sheets = opts.sheets.length > 0 ? opts.sheets : [{ name: 'Dados', headers: ['Item', 'Valor'], rows: [] }]
  const files: Record<string, Uint8Array> = {}

  files['[Content_Types].xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
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
      `</Relationships>`
  )

  sheets.forEach((sheet, sIdx) => {
    const rowXmls: string[] = []
    const allRows: Array<Array<string | number>> = [sheet.headers, ...sheet.rows]
    allRows.forEach((row, rIdx) => {
      const cells = row
        .map((val, cIdx) => {
          const ref = `${colLetter(cIdx)}${rIdx + 1}`
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<c r="${ref}"><v>${val}</v></c>`
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(val ?? ''))}</t></is></c>`
        })
        .join('')
      rowXmls.push(`<row r="${rIdx + 1}">${cells}</row>`)
    })

    if (sheet.summaryFormulaRow && sheet.rows.length > 0) {
      const sumRowIdx = allRows.length + 1
      const formulaCells = sheet.headers
        .map((_, cIdx) => {
          const ref = `${colLetter(cIdx)}${sumRowIdx}`
          if (cIdx === 0) return `<c r="${ref}" t="inlineStr"><is><t>Total</t></is></c>`
          const allNum = sheet.rows.every((r) => typeof r[cIdx] === 'number')
          if (allNum) {
            const col = colLetter(cIdx)
            return `<c r="${ref}"><f>SUM(${col}2:${col}${allRows.length})</f></c>`
          }
          return ''
        })
        .join('')
      rowXmls.push(`<row r="${sumRowIdx}">${formulaCells}</row>`)
    }

    files[`xl/worksheets/sheet${sIdx + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXmls.join('')}</sheetData></worksheet>`
    )
  })

  return Buffer.from(zipSync(files, { level: 6 }))
}

export function renderMindMapOrTimelineSvg(opts: {
  rootLabel: string
  mode: 'mindmap' | 'timeline'
  nodes: Array<{ id: string; label: string; detail?: string; dateOrOrder?: string; children?: Array<{ label: string }> }>
  tokens: DesignTokens
}): { svg: string; qaReport: VisualQAReport } {
  const w = 1000
  const h = 620
  const nodes = opts.nodes.slice(0, 12)
  const elements: string[] = []

  if (opts.mode === 'timeline') {
    elements.push(`<line x1="80" y1="310" x2="${w - 80}" y2="310" stroke="${opts.tokens.primary}" stroke-width="4"/>`)
    const step = nodes.length > 1 ? (w - 200) / (nodes.length - 1) : 0
    nodes.forEach((n, idx) => {
      const x = 100 + idx * step
      const above = idx % 2 === 0
      const boxY = above ? 140 : 370
      elements.push(`<line x1="${x}" y1="310" x2="${x}" y2="${above ? 245 : 370}" stroke="${opts.tokens.border}" stroke-width="2"/>`)
      elements.push(`<circle cx="${x}" cy="310" r="10" fill="${opts.tokens.accent}"/>`)
      elements.push(`<rect x="${x - 80}" y="${boxY}" width="160" height="96" rx="10" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}"/>`)
      elements.push(`<text x="${x}" y="${boxY + 28}" text-anchor="middle" font-size="11" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(String(n.dateOrOrder || `#${idx + 1}`))}</text>`)
      elements.push(`<text x="${x}" y="${boxY + 52}" text-anchor="middle" font-size="12" font-weight="600" fill="${opts.tokens.textPrimary}">${escapeXml(n.label.slice(0, 22))}</text>`)
    })
  } else {
    const cx = w / 2
    const cy = h / 2
    const radius = 210
    nodes.forEach((n, idx) => {
      const angle = (idx / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2
      const nx = cx + Math.cos(angle) * radius
      const ny = cy + Math.sin(angle) * radius
      elements.push(`<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${opts.tokens.border}" stroke-width="2.5"/>`)
      elements.push(`<rect x="${nx - 85}" y="${ny - 26}" width="170" height="52" rx="12" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.accent}" stroke-width="1.5"/>`)
      elements.push(`<text x="${nx}" y="${ny + 5}" text-anchor="middle" font-size="12" font-weight="600" fill="${opts.tokens.textPrimary}">${escapeXml(n.label.slice(0, 22))}</text>`)
    })
    elements.push(`<rect x="${cx - 110}" y="${cy - 34}" width="220" height="68" rx="18" fill="${opts.tokens.primary}"/>`)
    elements.push(`<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="15" font-weight="700" fill="#FFFFFF">${escapeXml(opts.rootLabel.slice(0, 24))}</text>`)
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%"><rect width="${w}" height="${h}" fill="${opts.tokens.surface}"/><text x="40" y="46" font-size="22" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(opts.rootLabel)}</text>${elements.join('')}</svg>`
  const { report } = runVisualQA({
    tokens: opts.tokens,
    pages: [{ index: 0, label: 'Diagrama 1', fillRatio: 0.7, overflowChars: 0 }]
  })
  return { svg, qaReport: report }
}

export function exportFlashcardsCsvAndAnki(opts: {
  deckTitle: string
  cards: Array<{ front: string; back: string; explanation?: string; citationLocator?: string }>
}): { csvText: string; ankiTsvText: string } {
  const escCsv = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`
  const csvRows = [
    ['Pergunta', 'Resposta', 'Explicação', 'Fonte'].map(escCsv).join(','),
    ...opts.cards.map((c) =>
      [c.front, c.back, c.explanation || '', c.citationLocator || ''].map(escCsv).join(',')
    )
  ]
  const ankiRows = opts.cards.map((c) =>
    `${c.front.replace(/\t|\n/g, ' ')}\t${c.back.replace(/\t|\n/g, ' ')}${c.citationLocator ? ` (${c.citationLocator})` : ''}`
  )
  return {
    csvText: csvRows.join('\n'),
    ankiTsvText: ankiRows.join('\n')
  }
}
