import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IconCheck, IconChevronLeft, IconChevronRight, IconFileText, IconSparkles, IconUpload } from '../icons'
import { useDocsI18n } from '../i18n'
import {
  buildTemplatePreviewPages,
  type PreviewableTemplate,
  type PreviewBrandKit
} from './template-preview-svg'
import { TemplatePreviewModal } from './TemplatePreviewModal'

interface StyleCarouselSelectorProps {
  toolId: string
  templates: PreviewableTemplate[]
  value: string
  onChange: (templateId: string) => void
  brandKit?: PreviewBrandKit | null
  letterheadFileName?: string | null
  overlayRoot?: HTMLElement | null
  onEditBrandKit?: () => void
}

export function StyleCarouselSelector({
  toolId,
  templates,
  value,
  onChange,
  brandKit,
  letterheadFileName,
  overlayRoot,
  onEditBrandKit
}: StyleCarouselSelectorProps) {
  const { t, locale } = useDocsI18n()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<{
    template: PreviewableTemplate
    isBrandMode: boolean
  } | null>(null)

  const syncScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    if (!previewTarget) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setPreviewTarget(null)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [previewTarget])

  useEffect(() => {
    syncScrollState()
    const onResize = () => syncScrollState()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [syncScrollState, templates.length, toolId])

  const scrollBy = (delta: number) => {
    trackRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  const safeBrandInst =
    brandKit?.institutionName &&
      brandKit.institutionName !== 'Projeto sem título' &&
      brandKit.institutionName !== 'Novo Projeto' &&
      brandKit.institutionName !== t('Projeto sem título') &&
      brandKit.institutionName !== t('Novo Projeto')
      ? brandKit.institutionName
      : ''

  const brandTemplate: PreviewableTemplate = {
    ...(templates[0] || { id: 'default', name: t('Usar meu documento') }),
    id: '__brand__',
    name: letterheadFileName || safeBrandInst || t('Usar meu documento'),
    description: t('Usa sua identidade visual (cores, fontes, logo e cabeçalho) com liberdade criativa no layout.'),
    category: t('timbre')
  }

  const activeLabel =
    value === ''
      ? t('Seleção automática')
      : value === '__brand__'
        ? brandTemplate.name
        : templates.find((tpl) => tpl.id === value)?.name || t('Estilo selecionado')

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-text-muted">{t('Escolher estilo visual')}</label>
        <span className="text-[11px] font-medium text-accent truncate max-w-[220px]">{activeLabel}</span>
      </div>

      <div className="relative group/carousel">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-320)}
            title={t('Rolar para esquerda')}
            style={{ top: 54 }}
            className="absolute left-1.5 -translate-y-1/2 z-20 p-2 rounded-full border border-border/60 bg-card/90 text-text shadow-glass-sm backdrop-blur-md transition-all opacity-95 hover:bg-card hover:border-accent cursor-pointer"
          >
            <IconChevronLeft size={15} />
          </button>
        )}

        <div
          ref={trackRef}
          onScroll={syncScrollState}
          className="flex items-start gap-2.5 overflow-x-auto mdocs-no-scrollbar scroll-smooth px-1 py-0.5"
        >
          {/* 1. Seleção automática */}
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 text-left flex flex-col gap-1.5 group/card"
            style={{ width: 156 }}
          >
            <div
              style={{ width: 156, height: 108 }}
              className={`relative rounded-xl border flex items-center justify-center transition-all ${value === ''
                ? 'border-accent ring-2 ring-accent/25 bg-accent/10'
                : 'border-border bg-input hover:border-accent/50'
                }`}
            >
              <IconSparkles size={20} className="text-accent" />
              {value === '' && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-bg flex items-center justify-center">
                  <IconCheck size={10} />
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-text leading-tight line-clamp-2">
              {t('Seleção automática')}
            </span>
          </button>

          {/* 2. Meu Timbre / Personalizado */}
          <button
            type="button"
            onClick={() => {
              if (onEditBrandKit) {
                onEditBrandKit()
              } else {
                setPreviewTarget({ template: brandTemplate, isBrandMode: true })
              }
            }}
            title={t('Clique para enviar um documento Word/PDF ou configurar seu timbre')}
            className="shrink-0 text-left flex flex-col gap-1.5 group/card"
            style={{ width: 156 }}
          >
            <div
              style={{ width: 156, height: 108 }}
              className={`relative rounded-xl border flex flex-col items-center justify-center gap-1.5 px-2 transition-all ${value === '__brand__'
                ? 'border-accent ring-2 ring-accent/25 bg-accent/10'
                : 'border-border bg-input hover:border-accent/50'
                }`}
            >
              {letterheadFileName || safeBrandInst ? (
                <IconFileText size={19} className="text-accent" />
              ) : (
                <IconUpload size={19} className="text-accent" />
              )}
              <span className="text-[10px] text-text-muted px-1 text-center line-clamp-2 leading-tight max-w-full">
                {letterheadFileName || safeBrandInst || t('Enviar Word ou PDF')}
              </span>
              {value === '__brand__' && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-bg flex items-center justify-center">
                  <IconCheck size={10} />
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-text leading-tight line-clamp-2">
              {t('Usar meu documento')}
            </span>
          </button>

          {/* 3. Visual template cards */}
          {templates.map((tpl) => {
            const isSel = value === tpl.id
            const thumb = buildTemplatePreviewPages(tpl, toolId, brandKit, false, locale).pages[0]
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setPreviewTarget({ template: tpl, isBrandMode: false })}
                title={t('{name} — Clique para visualizar e usar', { name: tpl.name })}
                className="shrink-0 text-left flex flex-col gap-1.5 group/card"
                style={{ width: 156 }}
              >
                <div
                  style={{ width: 156, height: 108 }}
                  className={`relative rounded-xl border overflow-hidden bg-bg transition-all p-1 flex items-center justify-center ${isSel
                    ? 'border-accent ring-2 ring-accent/25'
                    : 'border-border hover:border-accent/50'
                    }`}
                >
                  <div
                    className="w-full h-full pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                    dangerouslySetInnerHTML={{ __html: thumb.svg }}
                  />
                  {isSel && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-bg flex items-center justify-center shadow-sm">
                      <IconCheck size={10} />
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-text leading-tight line-clamp-2">
                  {tpl.name}
                </span>
              </button>
            )
          })}
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy(320)}
            title={t('Rolar para direita')}
            style={{ top: 54 }}
            className="absolute right-1.5 -translate-y-1/2 z-20 p-2 rounded-full border border-border/60 bg-card/90 text-text shadow-glass-sm backdrop-blur-md transition-all opacity-95 hover:bg-card hover:border-accent cursor-pointer"
          >
            <IconChevronRight size={15} />
          </button>
        )}
      </div>

      <TemplatePreviewModal
        open={Boolean(previewTarget)}
        template={previewTarget?.template || null}
        toolId={toolId}
        isBrandMode={Boolean(previewTarget?.isBrandMode)}
        brandKit={brandKit}
        onClose={() => setPreviewTarget(null)}
        onUse={(id) => {
          onChange(id)
          setPreviewTarget(null)
        }}
        onEditBrandKit={
          onEditBrandKit
            ? () => {
              setPreviewTarget(null)
              onEditBrandKit()
            }
            : undefined
        }
      />
    </div>
  )
}
