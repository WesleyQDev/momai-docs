import React from 'react'
import { getModelCardBackground } from '../modelCardArtwork'
import type { ToolSpec } from './tool-catalog'

interface ModelCardProps {
  tool: ToolSpec
  onClick: () => void
  className?: string
  emojiClassName?: string
  titleClassName?: string
}

export function ModelCard({
  tool,
  onClick,
  className = 'mdocs-model-card text-left p-4 flex flex-col justify-between gap-3',
  emojiClassName = 'text-base leading-none mdocs-emoji drop-shadow-sm',
  titleClassName = 'text-xs font-semibold text-white'
}: ModelCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${tool.label}: ${tool.description}`}
      className={className}
    >
      <img src={getModelCardBackground(tool.id)} alt="" className="mdocs-model-card-bg" />
      <div className="mdocs-model-card-scrim" />
      <div className="relative z-10 flex items-center justify-between gap-2 w-full">
        <div className={emojiClassName}>{tool.emoji}</div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white drop-shadow-sm">
          {tool.formats.slice(0, 2).join(' · ')}
        </span>
      </div>
      <div className="relative z-10 space-y-1">
        <div className={titleClassName}>{tool.label}</div>
        <div className="text-[11px] text-white/80 line-clamp-2 leading-relaxed">
          {tool.description}
        </div>
      </div>
    </button>
  )
}
