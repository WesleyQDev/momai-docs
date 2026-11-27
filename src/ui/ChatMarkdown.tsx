import React from 'react'

type TableAlign = 'left' | 'center' | 'right'

function splitUnescapedPipes(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let current = ''
  let inCode = false
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]
    if (ch === '\\' && i + 1 < trimmed.length && trimmed[i + 1] === '|') {
      current += '|'
      i += 1
      continue
    }
    if (ch === '`') {
      inCode = !inCode
      current += ch
      continue
    }
    if (ch === '|' && !inCode) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

function isTableSeparatorLine(line: string): boolean {
  if (!line.includes('|')) return false
  const cells = splitUnescapedPipes(line)
  if (cells.length === 0) return false
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))
}

function parseTableAlignments(line: string): TableAlign[] {
  return splitUnescapedPipes(line).map((cell) => {
    const c = cell.trim()
    const left = c.startsWith(':')
    const right = c.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })
}

function convertHtmlTableToMarkdown(htmlTable: string): string {
  const rows: string[][] = []
  const rowMatches = htmlTable.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []
  for (const rowHtml of rowMatches) {
    const cellMatches = rowHtml.match(/<(?:th|td)\b[^>]*>[\s\S]*?<\/(?:th|td)>/gi) || []
    const cells = cellMatches.map((cellHtml) =>
      cellHtml
        .replace(/^<(?:th|td)\b[^>]*>/i, '')
        .replace(/<\/(?:th|td)>$/i, '')
        .replace(/<br\s*\/?>/gi, ' / ')
        .replace(/<\/?(?:b|strong)\b[^>]*>/gi, '**')
        .replace(/<\/?(?:i|em)\b[^>]*>/gi, '*')
        .replace(/<\/?code\b[^>]*>/gi, '`')
        .replace(/<[^>]+>/g, '')
        .replace(/\|/g, '\\|')
        .replace(/\s+/g, ' ')
        .trim()
    )
    if (cells.length > 0) rows.push(cells)
  }
  if (rows.length === 0) return ''
  const colCount = Math.max(...rows.map((r) => r.length))
  const padRow = (r: string[]) => Array.from({ length: colCount }, (_, idx) => r[idx] ?? '')
  const header = `| ${padRow(rows[0]).join(' | ')} |`
  const sep = `| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`
  const body = rows.slice(1).map((r) => `| ${padRow(r).join(' | ')} |`)
  return [header, sep, ...body].join('\n')
}

function normalizeOutsideCodeBlocks(segment: string): string {
  let out = segment.replace(/<\/?source_data>/gi, '')
  out = out.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (m) => {
    const md = convertHtmlTableToMarkdown(m)
    return md ? `\n${md}\n` : ''
  })
  out = out
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
    .replace(/<(?:i|em)\b[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<\/?(?:p|div|ul|ol|thead|tbody|section|article)\b[^>]*>/gi, '\n')
  return out
}

function normalizeChatMarkdown(raw: string): string {
  const source = String(raw || '')
  if (!source.includes('<')) return source
  const parts = source.split(/(```[\s\S]*?```)/g)
  return parts
    .map((part, idx) => (idx % 2 === 1 ? part : normalizeOutsideCodeBlocks(part)))
    .join('')
}

function renderInline(text: string): React.ReactNode[] {
  const segments = text.split(/(<br\s*\/?>)/gi)
  const out: React.ReactNode[] = []

  segments.forEach((seg, segIdx) => {
    if (/^<br\s*\/?>$/i.test(seg)) {
      out.push(<br key={`br-${segIdx}`} />)
      return
    }
    const parts = seg.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g)
    parts.forEach((part, idx) => {
      const key = `${segIdx}-${idx}`
      if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
        out.push(
          <strong key={key} className="font-semibold italic text-text">
            {part.slice(3, -3)}
          </strong>
        )
        return
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        out.push(
          <strong key={key} className="font-semibold text-text">
            {part.slice(2, -2)}
          </strong>
        )
        return
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        out.push(
          <code key={key} className="px-1 py-0.5 rounded bg-input font-mono text-[11px] text-accent">
            {part.slice(1, -1)}
          </code>
        )
        return
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        out.push(
          <em key={key} className="italic">
            {part.slice(1, -1)}
          </em>
        )
        return
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
      if (linkMatch) {
        out.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline hover:opacity-80"
          >
            {linkMatch[1]}
          </a>
        )
        return
      }
      if (part) out.push(part)
    })
  })

  return out
}

export function ChatMarkdown({ text }: { text: string }) {
  const normalized = normalizeChatMarkdown(text)
  const lines = normalized.split(/\r?\n/)
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1
      nodes.push(
        <pre key={`code-${i}`} className="p-2.5 rounded-lg bg-input font-mono text-[11px] overflow-x-auto my-1.5">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    if (i + 1 < lines.length && line.includes('|') && isTableSeparatorLine(lines[i + 1])) {
      const headers = splitUnescapedPipes(line)
      const alignments = parseTableAlignments(lines[i + 1])
      i += 2
      const bodyRows: string[][] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('```') &&
        lines[i].includes('|')
      ) {
        bodyRows.push(splitUnescapedPipes(lines[i]))
        i += 1
      }
      const colCount = Math.max(headers.length, alignments.length, ...bodyRows.map((r) => r.length))
      nodes.push(
        <div key={`tbl-${i}`} className="my-2 overflow-x-auto rounded-xl border border-border/60 bg-input/30">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="bg-input/70 text-text font-semibold">
              <tr>
                {Array.from({ length: colCount }, (_, colIdx) => (
                  <th
                    key={colIdx}
                    className="px-2.5 py-1.5 border-b border-border/60 whitespace-nowrap"
                    style={{ textAlign: alignments[colIdx] || 'left' }}
                  >
                    {renderInline(headers[colIdx] || '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-input/40 transition-colors">
                  {Array.from({ length: colCount }, (_, colIdx) => (
                    <td
                      key={colIdx}
                      className="px-2.5 py-1.5 align-top text-text"
                      style={{ textAlign: alignments[colIdx] || 'left' }}
                    >
                      {renderInline(row[colIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      nodes.push(<hr key={`hr-${i}`} className="border-border/60 my-2" />)
      i += 1
      continue
    }

    if (/^#{1,3}\s+/.test(line)) {
      const clean = line.replace(/^#{1,3}\s+/, '')
      nodes.push(
        <div key={`h-${i}`} className="font-semibold text-text pt-1">
          {renderInline(clean)}
        </div>
      )
      i += 1
      continue
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''))
        i += 1
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-0.5 my-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i += 1
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-0.5 my-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ol>
      )
      continue
    }

    if (line.trim().startsWith('>')) {
      nodes.push(
        <blockquote key={`bq-${i}`} className="border-l-2 border-accent/60 pl-2.5 text-text-muted italic my-1">
          {renderInline(line.replace(/^\s*>\s?/, ''))}
        </blockquote>
      )
      i += 1
      continue
    }

    if (!line.trim()) {
      nodes.push(<div key={`sp-${i}`} className="h-1.5" />)
      i += 1
      continue
    }

    nodes.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInline(line)}
      </p>
    )
    i += 1
  }

  return <div className="space-y-1">{nodes}</div>
}
