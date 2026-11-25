import React, { useEffect, useState } from 'react'
import { IconCheck, IconChevronLeft, IconChevronRight, IconSliders, IconX } from '../icons'
import { useDocsI18n } from '../i18n'
import {
  buildTemplatePreviewPages,
  type PreviewableTemplate,
  type PreviewBrandKit
} from './template-preview-svg'

interface TemplatePreviewModalProps {
  open: boolean
  template: PreviewableTemplate | null
  toolId: string
  isBrandMode?: boolean
  brandKit?: PreviewBrandKit | null
  onClose: () => void
  onUse: (templateId: string) => void
  onEditBrandKit?: () => void
}

export function TemplatePreviewModal({
  open,
  template,
  toolId,
  isBrandMode = false,
  brandKit,
  onClose,
  onUse,
  onEditBrandKit
}: TemplatePreviewModalProps) {
  const { t, locale } = useDocsI18n()
  const [pageIdx, setPageIdx] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    setPageIdx(0)
    setZoom(1)
  }, [template?.id, open])

  if (!open || !template) return null

  const clampZoom = (z: number) => Math.min(2.25, Math.max(0.75, Math.round(z * 100) / 100))
  const { orientation, pages } = buildTemplatePreviewPages(template, toolId, brandKit, isBrandMode, locale)
  const safeIdx = Math.min(pageIdx, Math.max(0, pages.length - 1))
  const activePage = pages[safeIdx]
  const targetId = isBrandMode ? '__brand__' : template.id

  return (
    <div className="mdocs-preview-backdrop" onClick={onClose}>
      <div className="mdocs-preview-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header with title on left, zoom + "Usar" CTA on right */}
        <div className="px-6 py-3.5 border-b border-border flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text truncate">{template.name}</h3>
                {template.category && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 text-accent shrink-0">
                    {t(template.category)}
                  </span>
                )}
              </div>
              {template.description && (
                <p className="text-[11px] text-text-muted truncate mt-0.5">{template.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom controls */}
            <div className="flex items-center rounded-xl border border-border bg-input p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => clampZoom(z - 0.25))}
                disabled={zoom <= 0.75}
                title={t('Diminuir zoom')}
                className="w-7 h-7 rounded-lg text-xs font-semibold text-text hover:bg-card disabled:opacity-40 flex items-center justify-center"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title={t('Redefinir zoom para 100%')}
                className="px-2 h-7 rounded-lg text-[11px] font-medium text-text-muted hover:text-text tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => clampZoom(z + 0.25))}
                disabled={zoom >= 2.25}
                title={t('Aumentar zoom')}
                className="w-7 h-7 rounded-lg text-xs font-semibold text-text hover:bg-card disabled:opacity-40 flex items-center justify-center"
              >
                +
              </button>
            </div>

            {isBrandMode && onEditBrandKit && (
              <button
                type="button"
                onClick={onEditBrandKit}
                className="h-8 px-3 rounded-xl border border-border bg-input text-xs font-medium text-text hover:border-accent/60 flex items-center gap-1.5"
              >
                <IconSliders size={13} />
                <span>{t('Editar timbre')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onUse(targetId)}
              className="h-8 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
            >
              <IconCheck size={14} />
              <span>{t('Usar')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              title={t('Fechar prévia')}
              className="w-8 h-8 rounded-xl border border-border bg-input text-text-muted hover:text-text flex items-center justify-center"
            >
              <IconX size={14} />
            </button>
          </div>
        </div>

        {/* Main Preview Stage */}
        <div className="flex-1 min-h-0 bg-bg p-4 flex flex-col items-center justify-between gap-3 overflow-hidden">
          <div
            className="flex-1 min-h-0 w-full overflow-auto flex p-2"
            onWheel={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.15 : -0.15)))
              }
            }}
          >
            <div
              style={{
                height:
                  orientation === 'landscape'
                    ? `calc(min(54vh, 410px) * ${zoom})`
                    : `calc(min(60vh, 470px) * ${zoom})`,
                aspectRatio: orientation === 'landscape' ? '16 / 9' : '595 / 842',
                flexShrink: 0
              }}
              className="m-auto rounded-xl border border-border bg-card shadow-glass-sm overflow-hidden flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block transition-[height] duration-150"
              dangerouslySetInnerHTML={{ __html: activePage.svg }}
            />
          </div>

          {/* Bottom Thumbnail Strip */}
          <div className="flex items-center gap-2 max-w-full shrink-0">
            <button
              type="button"
              disabled={safeIdx === 0}
              onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
              className="w-7 h-7 rounded-lg border border-border bg-card text-text-muted hover:text-text disabled:opacity-40 flex items-center justify-center shrink-0"
              title={t('Página anterior')}
            >
              <IconChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-2 overflow-x-auto py-1 px-1">
              {pages.map((p, idx) => {
                const isActive = idx === safeIdx
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPageIdx(idx)}
                    title={p.label}
                    style={{
                      width: orientation === 'landscape' ? 84 : 44,
                      height: orientation === 'landscape' ? 48 : 62
                    }}
                    className={`rounded-lg border overflow-hidden shrink-0 transition-all [&>svg]:w-full [&>svg]:h-full [&>svg]:block ${
                      isActive ? 'border-accent ring-2 ring-accent/30' : 'border-border opacity-75 hover:opacity-100'
                    }`}
                    dangerouslySetInnerHTML={{ __html: p.svg }}
                  />
                )
              })}
            </div>

            <button
              type="button"
              disabled={safeIdx >= pages.length - 1}
              onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
              className="w-7 h-7 rounded-lg border border-border bg-card text-text-muted hover:text-text disabled:opacity-40 flex items-center justify-center shrink-0"
              title={t('Próxima página')}
            >
              <IconChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
