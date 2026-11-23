import React from 'react'

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-text">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={idx} className="px-1 py-0.5 rounded bg-input font-mono text-[11px] text-accent">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }
    return part
  })
}

export function ChatMarkdown({ text }: { text: string }) {
  const lines = String(text || '').split(/\r?\n/)
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
