import React, { useEffect, useMemo, useState } from 'react'
import sdk from 'momai:sdk'
import { DOCS_LAYOUT_CSS } from '../src/ui/shared/docs-layout-css'
import { ModelCard } from '../src/ui/shared/ModelCard'
import { DemoChatBar } from './DemoChatBar'
import { PROFILE_EMOJIS, TOOL_CATALOG, type ToolSpec } from '../src/ui/shared/tool-catalog'
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileText,
  IconLayoutGrid,
  IconMic,
  IconPanelLeft,
  IconSparkles,
  IconVideo
} from '../src/ui/icons'

const DEMO_EXT_ID = 'momai-docs-demo'
const PARENT_EXT_ID = 'momai-docs'

type DemoView = 'projects' | 'models' | 'oficio_studio'

function downloadBase64File(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function MomaiDocsDemoPage() {
  const [view, setView] = useState<DemoView>('projects')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modelCategory, setModelCategory] = useState('Todos')
  const [projects, setProjects] = useState<any[]>([])
  const [artifact, setArtifact] = useState<any | null>(null)
  const [instructions, setInstructions] = useState(
    'Solicitar autorização para realização de evento técnico institucional na próxima quinta-feira às 14h.'
  )
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const featuredTools = useMemo(() => TOOL_CATALOG.filter((t) => t.featured).slice(0, 10), [])
  const filteredTools = useMemo(
    () =>
      modelCategory === 'Todos'
        ? TOOL_CATALOG
        : TOOL_CATALOG.filter((t) => t.category === modelCategory),
    [modelCategory]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [projRes, artRes] = await Promise.all([
          sdk.api.get(`/extensions/${DEMO_EXT_ID}/projects`),
          sdk.api.get(`/extensions/${DEMO_EXT_ID}/artifacts`)
        ])
        if (cancelled) return
        if (Array.isArray(projRes?.data?.projects)) setProjects(projRes.data.projects)
        const list = artRes?.data?.artifacts
        if (Array.isArray(list) && list.length > 0) setArtifact(list[0])
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openPurchaseCard = () => {
    void sdk.billing.openCheckout(PARENT_EXT_ID, { fromDemoId: DEMO_EXT_ID })
  }

  const handleSelectTool = (tool: ToolSpec) => {
    if (tool.id === 'oficio') {
      setView('oficio_studio')
      return
    }
    openPurchaseCard()
  }

  const handleGenerateOficio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (artifact) {
      openPurchaseCard()
      return
    }
    if (!instructions.trim() || generating) return

    setErrorMsg(null)
    setGenerating(true)
    try {
      const res = await sdk.api.post(`/extensions/${DEMO_EXT_ID}/generate`, {
        toolId: 'oficio',
        instructions: instructions.trim()
      })
      const data = res?.data
      if (data?.ok && data?.artifact) {
        setArtifact(data.artifact)
      } else if (data?.error === 'demo_page_limit_reached') {
        openPurchaseCard()
      } else {
        setErrorMsg(data?.message || data?.error || 'Não foi possível gerar o ofício.')
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao gerar ofício.')
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!artifact || exporting) return
    setExporting(format)
    setErrorMsg(null)
    try {
      const res = await sdk.api.post(`/extensions/${DEMO_EXT_ID}/export`, {
        artifactId: artifact.id,
        format
      })
      const data = res?.data
      if (data?.ok && data?.base64) {
        downloadBase64File(data.base64, data.fileName || `oficio-demo.${format}`, data.mimeType)
      } else {
        setErrorMsg(data?.error || 'Não foi possível exportar.')
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao exportar arquivo.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="mdocs-root">
      <style>{DOCS_LAYOUT_CSS}</style>

      {sidebarOpen && (view === 'projects' || view === 'models') && (
        <aside className="mdocs-sidebar">
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="px-2.5 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Estúdio · Demo
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  title="Ocultar barra lateral"
                  aria-label="Ocultar barra lateral"
                  className="p-1.5 -mr-1 rounded-lg text-text-muted hover:text-text hover:bg-input active:bg-input/80 flex items-center justify-center shrink-0 transition-colors"
                >
                  <IconPanelLeft size={16} />
                </button>
              </div>
              <button
                onClick={() => setView('projects')}
                title="Início"
                className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between ${
                  view === 'projects'
                    ? 'bg-card text-text font-medium border border-border'
                    : 'text-text-muted hover:text-text hover:bg-card/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>🏠</span>
                  <span>Início</span>
                </span>
                <span className="text-[11px] text-text-muted tabular-nums">{projects.length || 1}</span>
              </button>
              <button
                onClick={() => setView('models')}
                title="Modelos"
                className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between ${
                  view === 'models'
                    ? 'bg-card text-text font-medium border border-border'
                    : 'text-text-muted hover:text-text hover:bg-card/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>🗂️</span>
                  <span>Modelos</span>
                </span>
                <span className="text-[11px] text-text-muted tabular-nums">{TOOL_CATALOG.length}</span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Recentes
              </div>
              {(projects.length > 0
                ? projects
                : [{ id: 'demo-oficio-project', name: 'Demo: Ofícios e Cartas (1 página)', profile: 'public_servant' }]
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setView('oficio_studio')}
                  title={p.name}
                  className="w-full h-8 px-2.5 rounded-lg text-xs flex items-center gap-2 text-left text-text-muted hover:text-text hover:bg-card/50"
                >
                  <span className="shrink-0">{PROFILE_EMOJIS[p.profile] || '🏛️'}</span>
                  <span className="truncate flex-1">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      <div className="mdocs-main">
        <header className="mdocs-topbar">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (view === 'projects' || view === 'models') && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Mostrar barra lateral"
                aria-label="Mostrar barra lateral"
                className="p-2 rounded-lg text-text-muted/60 hover:text-text hover:bg-input active:bg-input/80 flex items-center justify-center shrink-0 transition-colors"
              >
                <IconPanelLeft size={18} />
              </button>
            )}
            {view !== 'projects' && (
              <button
                onClick={() => setView('projects')}
                title="Voltar"
                className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs text-text hover:bg-input flex items-center gap-1 shrink-0"
              >
                <IconChevronLeft size={14} />
                <span>Voltar</span>
              </button>
            )}
            <div className="min-w-0 flex items-center gap-2.5">
              <svg
                width="26"
                height="26"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
                className="shrink-0 drop-shadow-sm"
              >
                <defs>
                  <linearGradient id="mdocsDemoFolioBack" x1="4" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#0D9488" />
                  </linearGradient>
                  <linearGradient id="mdocsDemoFolioFront" x1="6" y1="7" x2="24" y2="29" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#2DD4BF" />
                    <stop offset="55%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#0284C7" />
                  </linearGradient>
                  <linearGradient id="mdocsDemoPenNib" x1="16" y1="3" x2="29" y2="19" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="55%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>
                </defs>
                <rect x="4" y="5" width="17" height="22" rx="4" transform="rotate(-7 12.5 16)" fill="url(#mdocsDemoFolioBack)" opacity="0.5" />
                <rect x="6" y="6" width="18" height="22" rx="4.2" fill="url(#mdocsDemoFolioFront)" />
                <rect x="9.5" y="10.5" width="7.5" height="2.4" rx="1.2" fill="#FFFFFF" />
                <rect x="9.5" y="15" width="11" height="2" rx="1" fill="#E0F2FE" />
                <rect x="9.5" y="18.8" width="8" height="2" rx="1" fill="#BAE6FD" />
                <path
                  d="M26.8 3.6C27.9 4.7 27.9 6.5 26.8 7.6L17.9 16.5L13.5 17.7L14.7 13.3L23.6 4.4C24.7 3.3 26.5 3.3 26.8 3.6Z"
                  fill="url(#mdocsDemoPenNib)"
                />
                <path d="M24.2 5.2L16.3 13.1" stroke="#FEF9C3" strokeWidth="1.1" strokeLinecap="round" />
                <path
                  d="M11 23.2L11.7 25L13.5 25.7L11.7 26.4L11 28.2L10.3 26.4L8.5 25.7L10.3 25L11 23.2Z"
                  fill="#FDE047"
                />
              </svg>
              <h1 className="mdocs-demo-brand-title font-extrabold truncate">
                {view === 'oficio_studio' ? (
                  <span className="mdocs-demo-title-grad">Ofícios e Cartas · Demo (1 página)</span>
                ) : view === 'models' ? (
                  <span className="mdocs-demo-title-grad">Todos os Modelos</span>
                ) : (
                  <>
                    <span className="mdocs-demo-title-grad">MomAI Docs</span>{' '}
                    <span className="mdocs-demo-serif-em">Demo</span>
                  </>
                )}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={openPurchaseCard}
            className="mdocs-demo-btn-primary h-8 px-3.5 rounded-xl text-xs font-semibold shrink-0"
          >
            Desbloquear versão completa
          </button>
        </header>

        {view === 'projects' && (
          <main className="mdocs-scroll mdocs-demo-marketing">
            <div className="mdocs-container">
              {/* Catálogo completo (atração para compra) */}
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <h2 className="mdocs-demo-display mdocs-demo-top-title font-extrabold">
                      <span className="mdocs-demo-title-grad">Escolha um formato</span>{' '}
                      <span className="mdocs-demo-serif-em">e veja o estúdio em ação</span>
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      Teste <span className="mdocs-demo-word-accent">Ofícios e Cartas grátis</span> na demo ou clique em qualquer modelo para desbloquear os <span className="mdocs-demo-word-blue">14 formatos</span>.
                    </p>
                  </div>
                  <button
                    onClick={() => setView('models')}
                    title={`Ver todos os ${TOOL_CATALOG.length} modelos`}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 shrink-0"
                  >
                    <span>Ver todos ({TOOL_CATALOG.length})</span>
                    <IconChevronRight size={12} />
                  </button>
                </div>

                <div className="mdocs-featured-grid">
                  {featuredTools.map((tool) => (
                    <div key={tool.id} className={`relative ${tool.featuredCompact ? 'flex' : 'mdocs-featured-extra'}`}>
                      <ModelCard
                        tool={tool}
                        onClick={() => handleSelectTool(tool)}
                        className="mdocs-model-card w-full text-left p-4 flex flex-col justify-between gap-3"
                      />
                      <span
                        className={`pointer-events-none absolute top-3 left-11 z-20 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          tool.id === 'oficio'
                            ? 'bg-accent text-bg shadow-sm'
                            : 'bg-card/90 text-text border border-border'
                        }`}
                      >
                        {tool.id === 'oficio' ? 'Grátis na Demo' : 'Versão Completa'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Hero de apresentação e conversão */}
              <section className="py-2">
                <div className="mdocs-demo-hero-grid">
                  <div className="space-y-4 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/25 text-[11px] font-semibold text-accent">
                        <IconSparkles size={12} />
                        <span>Estúdio de documentos e mídia com IA</span>
                      </span>
                      <button
                        type="button"
                        onClick={openPurchaseCard}
                        className="mdocs-demo-price-balloon text-[11px] font-semibold text-accent cursor-pointer"
                      >
                        <span>Ver preço e desbloquear</span>
                        <IconChevronRight size={12} />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <h2 className="mdocs-demo-display mdocs-demo-hero-title font-extrabold text-text">
                        Seus arquivos ganham vida em{' '}
                        <span className="mdocs-demo-serif-em">documentos impecáveis</span>{' '}
                        em minutos.
                      </h2>
                      <p className="text-xs md:text-sm text-text-muted leading-relaxed max-w-xl">
                        Esqueça a formatação manual de <span className="mdocs-demo-word-blue">ABNT</span>,{' '}
                        <span className="mdocs-demo-word-accent">ofícios</span>,{' '}
                        <span className="mdocs-demo-word-info">slides</span> e{' '}
                        <span className="mdocs-demo-word-green">planilhas</span>. Gere materiais prontos para entregar com IA local, direto no seu computador.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setView('oficio_studio')}
                        className="mdocs-demo-btn-primary mdocs-demo-cta-glow h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2"
                      >
                        <IconFileText size={14} />
                        <span>{artifact ? 'Ver meu Ofício gerado' : 'Testar Ofício grátis agora'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={openPurchaseCard}
                        className="h-10 px-4 rounded-xl border border-border bg-input text-xs font-semibold text-text hover:bg-main transition-colors flex items-center gap-1.5"
                      >
                        <span>Desbloquear todos os 14 modelos</span>
                        <IconChevronRight size={13} />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px] text-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <IconCheck size={12} className="text-accent" />
                        <span>PDF e DOCX reais</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <IconCheck size={12} className="text-accent" />
                        <span>Sem marca d'água no teste</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <IconCheck size={12} className="text-accent" />
                        <span>Acesso completo sem mensalidade oculta</span>
                      </span>
                    </div>
                  </div>

                  {/* Painel visual resumindo entregas da versão completa */}
                  <div className="mdocs-demo-showcase-panel p-4 md:p-5 space-y-3.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="mdocs-demo-display text-sm md:text-base font-extrabold">
                          <span className="mdocs-demo-title-grad">Pacote completo</span>{' '}
                          <span className="mdocs-demo-serif-em">MomAI Docs</span>
                        </div>
                        <p className="text-[11px] text-text-muted">
                          Desbloqueie estúdios de texto, slides, planilhas, áudio e vídeo.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openPurchaseCard}
                        className="mdocs-demo-btn-primary text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 shadow-sm"
                      >
                        14 modelos + Chat
                      </button>
                    </div>
                    <div className="mdocs-demo-mini-grid">
                      {[
                        {
                          icon: IconFileText,
                          tint: 'mdocs-tint-blue',
                          titleColor: 'mdocs-demo-word-blue',
                          title: 'Ofícios e Cartas',
                          tag: 'Grátis na Demo',
                          active: true
                        },
                        {
                          icon: IconSparkles,
                          tint: 'mdocs-tint-info',
                          titleColor: 'mdocs-demo-word-info',
                          title: 'Trabalho ABNT',
                          tag: 'NBR 14724 · Completo',
                          active: false
                        },
                        {
                          icon: IconVideo,
                          tint: 'mdocs-tint-red',
                          titleColor: 'text-text',
                          title: 'Vídeo Explicativo',
                          tag: 'MP4 + Legenda · Completo',
                          active: false
                        },
                        {
                          icon: IconMic,
                          tint: 'mdocs-tint-yellow',
                          titleColor: 'text-text',
                          title: 'Podcast Neural',
                          tag: '2 vozes · Completo',
                          active: false
                        },
                        {
                          icon: IconLayoutGrid,
                          tint: 'mdocs-tint-info',
                          titleColor: 'mdocs-demo-word-info',
                          title: 'Slides PPTX',
                          tag: 'Apresentações · Completo',
                          active: false
                        },
                        {
                          icon: IconCheck,
                          tint: 'mdocs-tint-green',
                          titleColor: 'mdocs-demo-word-green',
                          title: 'Planilha XLSX',
                          tag: 'Fórmulas reais · Completo',
                          active: false
                        }
                      ].map((item) => {
                        const ItemIcon = item.icon
                        return (
                          <button
                            key={item.title}
                            type="button"
                            onClick={() => (item.active ? setView('oficio_studio') : openPurchaseCard())}
                            className={`text-left p-2.5 ${
                              item.active ? 'mdocs-demo-mini-card-active' : 'mdocs-demo-mini-card'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${item.tint}`}
                              >
                                <ItemIcon size={13} />
                              </span>
                              <span className={`text-[11px] font-bold truncate ${item.titleColor}`}>
                                {item.title}
                              </span>
                            </div>
                            <div
                              className={`text-[10px] mt-1.5 truncate pl-8 ${
                                item.active ? 'mdocs-demo-word-blue' : 'text-text-muted'
                              }`}
                            >
                              {item.tag}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-text-muted">
                        Seu teste grátis: <strong className="text-text">{artifact ? '1/1 usado' : '0/1 usado'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={openPurchaseCard}
                        className="mdocs-demo-word-blue hover:underline font-bold"
                      >
                        Consultar valor →
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Espaço liberado na demo */}
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <h2 className="mdocs-demo-display mdocs-demo-section-title font-extrabold">
                      <span className="mdocs-demo-title-grad">Experimente na prática</span>{' '}
                      <span className="mdocs-demo-serif-em">agora mesmo</span>
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      Gere seu primeiro documento oficial sem custo e confira a qualidade da exportação.
                    </p>
                  </div>
                </div>

                {(projects.length > 0
                  ? projects
                  : [
                      {
                        id: 'demo-oficio-project',
                        name: 'Ofícios e Cartas (1 página)',
                        profile: 'public_servant'
                      }
                    ]
                ).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setView('oficio_studio')}
                    className="mdocs-demo-spotlight-card p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <svg
                        width="42"
                        height="42"
                        viewBox="0 0 32 32"
                        fill="none"
                        aria-hidden="true"
                        className="shrink-0 drop-shadow-sm"
                      >
                        <defs>
                          <linearGradient id="mdocsSpotlightFolioBack" x1="4" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#0EA5E9" />
                            <stop offset="100%" stopColor="#0D9488" />
                          </linearGradient>
                          <linearGradient id="mdocsSpotlightFolioFront" x1="6" y1="7" x2="24" y2="29" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#2DD4BF" />
                            <stop offset="55%" stopColor="#0EA5E9" />
                            <stop offset="100%" stopColor="#0284C7" />
                          </linearGradient>
                          <linearGradient id="mdocsSpotlightPenNib" x1="16" y1="3" x2="29" y2="19" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#FDE047" />
                            <stop offset="55%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#EA580C" />
                          </linearGradient>
                        </defs>
                        <rect x="4" y="5" width="17" height="22" rx="4" transform="rotate(-7 12.5 16)" fill="url(#mdocsSpotlightFolioBack)" opacity="0.5" />
                        <rect x="6" y="6" width="18" height="22" rx="4.2" fill="url(#mdocsSpotlightFolioFront)" />
                        <rect x="9.5" y="10.5" width="7.5" height="2.4" rx="1.2" fill="#FFFFFF" />
                        <rect x="9.5" y="15" width="11" height="2" rx="1" fill="#E0F2FE" />
                        <rect x="9.5" y="18.8" width="8" height="2" rx="1" fill="#BAE6FD" />
                        <path
                          d="M26.8 3.6C27.9 4.7 27.9 6.5 26.8 7.6L17.9 16.5L13.5 17.7L14.7 13.3L23.6 4.4C24.7 3.3 26.5 3.3 26.8 3.6Z"
                          fill="url(#mdocsSpotlightPenNib)"
                        />
                        <path d="M24.2 5.2L16.3 13.1" stroke="#FEF9C3" strokeWidth="1.1" strokeLinecap="round" />
                        <path
                          d="M11 23.2L11.7 25L13.5 25.7L11.7 26.4L11 28.2L10.3 26.4L8.5 25.7L10.3 25L11 23.2Z"
                          fill="#FDE047"
                        />
                      </svg>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="mdocs-demo-display text-base md:text-lg font-extrabold text-text truncate">
                            {p.name}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                          Descreva o destinatário e o assunto para gerar um ofício formatado em{' '}
                          <span className="mdocs-demo-word-blue">PDF</span> e{' '}
                          <span className="mdocs-demo-word-accent">DOCX</span> pronto para imprimir.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setView('oficio_studio')
                      }}
                      className="mdocs-demo-btn-primary mdocs-demo-cta-glow h-10 px-5 rounded-xl text-xs font-bold shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <span>{artifact ? 'Abrir documento' : 'Começar teste grátis'}</span>
                      <IconChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </section>
            </div>
          </main>
        )}

        {view === 'models' && (
          <main className="mdocs-scroll">
            <div className="mdocs-container">
              <div className="flex items-center gap-1.5 flex-wrap">
                {['Todos', 'Oficial', 'Acadêmico', 'Slides', 'Planilhas', 'Áudio & Vídeo', 'Relatórios'].map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => setModelCategory(cat)}
                      className={`h-7 px-3 rounded-lg text-xs transition-colors ${
                        modelCategory === cat
                          ? 'bg-card border border-border text-text font-medium'
                          : 'text-text-muted hover:text-text hover:bg-card/50'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>

              <div className="mdocs-featured-grid">
                {filteredTools.map((tool) => (
                  <ModelCard
                    key={tool.id}
                    tool={tool}
                    onClick={() => handleSelectTool(tool)}
                    emojiClassName="text-lg leading-none mdocs-emoji drop-shadow-sm"
                    titleClassName="text-sm font-semibold text-white"
                  />
                ))}
              </div>
            </div>
          </main>
        )}

        {view === 'oficio_studio' && (
          <div className="mdocs-ws-body">
            <div className="mdocs-ws-center flex-1">
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-5">
                  <form
                    onSubmit={handleGenerateOficio}
                    className="rounded-2xl bg-card border border-border p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-text">
                        <IconFileText size={15} className="text-accent" />
                        <span>Gerar Ofício ou Carta (1 página)</span>
                      </div>
                      <span className="text-[11px] text-text-muted">
                        {artifact ? '1/1 documento usado na demo' : '0/1 documento usado na demo'}
                      </span>
                    </div>

                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={3}
                      disabled={Boolean(artifact) || generating}
                      placeholder="Descreva o destinatário, assunto e conteúdo do ofício ou carta..."
                      className="w-full rounded-xl bg-input border border-border px-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />

                    {errorMsg && (
                      <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">
                        {errorMsg}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[11px] text-text-muted">
                        Exportação disponível em PDF e DOCX (limite de 1 página).
                      </span>
                      {artifact ? (
                        <button
                          type="button"
                          onClick={openPurchaseCard}
                          className="mdocs-demo-btn-primary h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-2"
                        >
                          <IconSparkles size={14} />
                          <span>Gerar ilimitado na versão completa</span>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={generating || !instructions.trim()}
                          className="mdocs-demo-btn-primary h-9 px-4 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-2"
                        >
                          <IconSparkles size={14} />
                          <span>{generating ? 'Gerando...' : 'Gerar Ofício (1 página)'}</span>
                        </button>
                      )}
                    </div>
                  </form>

                  {artifact && (
                    <div className="rounded-2xl bg-card border border-border overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-xs font-semibold text-text">{artifact.title}</div>
                          <div className="text-[11px] text-text-muted">1 página · pronto para exportar</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleExport('pdf')}
                            disabled={exporting !== null}
                            className="mdocs-demo-btn-primary h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <IconDownload size={13} />
                            <span>{exporting === 'pdf' ? 'Exportando...' : 'Baixar PDF'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExport('docx')}
                            disabled={exporting !== null}
                            className="h-8 px-3 rounded-lg border border-border bg-input text-xs font-semibold text-text hover:bg-card flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <IconDownload size={13} />
                            <span>{exporting === 'docx' ? 'Exportando...' : 'Baixar DOCX'}</span>
                          </button>
                        </div>
                      </div>
                      <div
                        className="bg-white text-slate-900 max-h-[520px] overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: artifact.previewHtml }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <DemoChatBar demoExtId={DEMO_EXT_ID} onTriggerPurchase={openPurchaseCard} />
            </div>
          </div>
        )}

        {view === 'projects' && (
          <DemoChatBar demoExtId={DEMO_EXT_ID} onTriggerPurchase={openPurchaseCard} />
        )}
      </div>
    </div>
  )
}
