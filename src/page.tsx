import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import sdk, { ContextMenu } from 'momai:sdk'
import { resolveLocale, tDocs, type DocsLocale } from './ui/i18n'
import { MiniDocumentThumb } from './ui/MiniDocumentThumb'
import { getModelCardBackground } from './ui/modelCardArtwork'
import { ChatMarkdown } from './ui/ChatMarkdown'
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconFileText,
  IconFolder,
  IconGlobe,
  IconLayoutGrid,
  IconMic,
  IconPanelLeft,
  IconPaperclip,
  IconPlus,
  IconSend,
  IconShield,
  IconSliders,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconVideo,
  IconX
} from './ui/icons'

const EXT_ID = 'momai-docs'
const BOOTSTRAP_CACHE_KEY = 'momai-docs:bootstrap-cache:v1'

interface BootstrapCache {
  projects?: any[]
  templates?: any[]
  capabilities?: any
  llmProviders?: Array<{ id: string; name: string; models: Array<{ id: string; label: string }> }>
  voices?: any[]
}

function readBootstrapCache(): BootstrapCache | null {
  try {
    const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeBootstrapCache(patch: Partial<BootstrapCache>) {
  try {
    const cur = readBootstrapCache() || {}
    localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({ ...cur, ...patch }))
  } catch { }
}

type StudioView = 'projects' | 'models' | 'template_detail' | 'workspace' | 'generating' | 'export'
type ModalKind = 'none' | 'queue' | 'brand' | 'credits' | 'diagnostics' | 'new_project' | 'rename_project' | 'discover' | 'add_link'

interface ToolSpec {
  id: string
  emoji: string
  label: string
  category: 'Oficial' | 'Acadêmico' | 'Slides' | 'Planilhas' | 'Áudio & Vídeo' | 'Relatórios'
  description: string
  specLine: string
  formats: string[]
  thumbVariant: 'a4' | 'slide' | 'sheet' | 'audio' | 'abnt' | 'letterhead'
  featured?: boolean
  featuredCompact?: boolean
}

const TOOL_CATALOG: ToolSpec[] = [
  {
    id: 'oficio',
    emoji: '🏛️',
    label: 'Ofícios e Cartas',
    category: 'Oficial',
    description: 'Redação oficial com numeração, endereçamento e fecho formal.',
    specLine: 'Manual de Redação Oficial · margens 3 / 2 / 3 / 2 cm',
    formats: ['docx', 'pdf'],
    thumbVariant: 'letterhead',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'abnt',
    emoji: '🎓',
    label: 'Trabalho ABNT',
    category: 'Acadêmico',
    description: 'Capa, folha de rosto, sumário, citações e referências NBR 14724.',
    specLine: 'ABNT NBR 14724 · margens 3 / 2 / 3 / 2 cm · fonte 12pt',
    formats: ['docx', 'pdf'],
    thumbVariant: 'abnt',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'pptx',
    emoji: '📊',
    label: 'Apresentação PPTX',
    category: 'Slides',
    description: 'Deck 16:9 com capa, agenda, dados visuais e notas do apresentador.',
    specLine: 'Widescreen 16:9 · hierarquia visual automática',
    formats: ['pptx', 'pdf'],
    thumbVariant: 'slide',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'apostila',
    emoji: '📖',
    label: 'Apostilas',
    category: 'Acadêmico',
    description: 'Material didático estruturado com módulos, quadros e exercícios.',
    specLine: 'Estrutura modular · caixas de destaque e gabarito',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'podcast',
    emoji: '🎙️',
    label: 'Podcast (Phonon TTS)',
    category: 'Áudio & Vídeo',
    description: 'Roteiro em diálogo com duas vozes neurais locais e legenda SRT.',
    specLine: 'Áudio estéreo + transcrição sincronizada',
    formats: ['mp3', 'wav', 'srt', 'md'],
    thumbVariant: 'audio',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'xlsx',
    emoji: '📈',
    label: 'Planilha XLSX',
    category: 'Planilhas',
    description: 'Tabelas estruturadas com fórmulas reais, totais e múltiplas abas.',
    specLine: 'Fórmulas nativas Excel · formatação tabular',
    formats: ['xlsx'],
    thumbVariant: 'sheet',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'report',
    emoji: '📑',
    label: 'Relatório Executivo',
    category: 'Relatórios',
    description: 'Sumário executivo, métricas, achados rastreados e próximos passos.',
    specLine: 'Layout executivo · tabelas e citações por fonte',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4',
    featured: true
  },
  {
    id: 'letterhead',
    emoji: '🖋️',
    label: 'Folha Timbrada',
    category: 'Oficial',
    description: 'Extrai timbre, marca e paleta de um documento base da instituição.',
    specLine: 'Identidade visual extraída · cabeçalho e rodapé fiéis',
    formats: ['docx', 'pdf'],
    thumbVariant: 'letterhead',
    featured: true
  },
  {
    id: 'video',
    emoji: '🎬',
    label: 'Vídeo Explicativo',
    category: 'Áudio & Vídeo',
    description: 'Cenas narradas com slides sincronizados, legendas e exportação MP4.',
    specLine: 'Vídeo 1080p · narração e legendas embutidas',
    formats: ['mp4', 'srt'],
    thumbVariant: 'slide',
    featured: true
  },
  {
    id: 'flashcards',
    emoji: '🃏',
    label: 'Flashcards & Quiz',
    category: 'Acadêmico',
    description: 'Cartões de revisão ativa e questões comentadas a partir das fontes.',
    specLine: 'Compatível com Anki e CSV',
    formats: ['csv', 'anki'],
    thumbVariant: 'a4',
    featured: true
  },
  {
    id: 'mindmap',
    emoji: '🧠',
    label: 'Mapa Mental / Timeline',
    category: 'Acadêmico',
    description: 'Diagrama vetorial limpo para estudo, síntese e visão cronológica.',
    specLine: 'SVG vetorial escalável',
    formats: ['svg'],
    thumbVariant: 'slide'
  },
  {
    id: 'resume',
    emoji: '📄',
    label: 'Currículo ATS',
    category: 'Relatórios',
    description: 'Currículo limpo, legível por recrutadores e sistemas ATS.',
    specLine: 'Coluna única · leitura otimizada',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4'
  },
  {
    id: 'lesson_plan',
    emoji: '🗓️',
    label: 'Plano de Aula',
    category: 'Acadêmico',
    description: 'Objetivos, habilidades, metodologia, cronograma e avaliação.',
    specLine: 'Estrutura pedagógica pronta para impressão',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4'
  },
  {
    id: 'meeting_minutes',
    emoji: '📝',
    label: 'Ata de Reunião',
    category: 'Oficial',
    description: 'Pauta, participantes, deliberações, responsáveis e prazos.',
    specLine: 'Registro formal com blocos de decisão',
    formats: ['docx', 'pdf'],
    thumbVariant: 'letterhead'
  }
]

const PROFILE_EMOJIS: Record<string, string> = {
  general: '📓',
  student: '🎓',
  teacher: '📖',
  lawyer: '⚖️',
  public_servant: '🏛️',
  executive: '💼'
}

const PROFILE_LABELS: Record<string, string> = {
  general: 'Geral',
  student: 'Acadêmico',
  teacher: 'Docente',
  lawyer: 'Jurídico',
  public_servant: 'Oficial',
  executive: 'Executivo'
}

const GENERATING_STEPS = [
  'Lendo arquivos e fontes do projeto',
  'Extraindo trechos e citações-chave',
  'Aplicando normas e estrutura do modelo',
  'Redigindo o documento completo',
  'Revisando formatação e prévia visual'
]

const DOCS_LAYOUT_CSS = `
.mdocs-root {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background: rgb(var(--bg-main));
  color: rgb(var(--text-primary));
  font-family: Inter, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif;
}
.mdocs-emoji {
  font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  line-height: 1;
}
.mdocs-tint-blue { background: rgb(var(--google-blue) / 0.14); color: rgb(var(--google-blue)); border: 1px solid rgb(var(--google-blue) / 0.25); }
.mdocs-tint-green { background: rgb(var(--google-green) / 0.14); color: rgb(var(--google-green)); border: 1px solid rgb(var(--google-green) / 0.25); }
.mdocs-tint-yellow { background: rgb(var(--google-yellow) / 0.16); color: rgb(var(--google-yellow)); border: 1px solid rgb(var(--google-yellow) / 0.28); }
.mdocs-tint-red { background: rgb(var(--google-red) / 0.14); color: rgb(var(--google-red)); border: 1px solid rgb(var(--google-red) / 0.25); }
.mdocs-tint-info { background: rgb(var(--info) / 0.14); color: rgb(var(--info)); border: 1px solid rgb(var(--info) / 0.25); }
@keyframes mdocs-scan-sweep {
  0% { transform: translateY(-20%); opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateY(340%); opacity: 0; }
}
@keyframes mdocs-line-write {
  0% { width: 12%; opacity: 0.35; }
  50% { width: 100%; opacity: 0.9; }
  100% { width: 12%; opacity: 0.35; }
}
@keyframes mdocs-caret-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.mdocs-scan-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 76px;
  background: linear-gradient(180deg, transparent 0%, rgb(var(--accent) / 0.14) 50%, transparent 100%);
  pointer-events: none;
  animation: mdocs-scan-sweep 2.8s ease-in-out infinite;
}
.mdocs-write-line {
  height: 7px;
  border-radius: 999px;
  background: rgb(var(--text-muted) / 0.24);
  animation: mdocs-line-write 2.4s ease-in-out infinite;
}
.mdocs-caret {
  display: inline-block;
  width: 2px;
  height: 11px;
  border-radius: 1px;
  background: rgb(var(--accent));
  animation: mdocs-caret-blink 0.9s steps(1, end) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .mdocs-scan-beam, .mdocs-write-line, .mdocs-caret { animation: none !important; }
}
.mdocs-sidebar {
  width: 224px;
  flex-shrink: 0;
  background: rgb(var(--bg-sidebar));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  overflow-y: auto;
}
.mdocs-main {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mdocs-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  background: rgb(var(--bg-main));
  flex-wrap: nowrap;
}
.mdocs-model-card {
  position: relative;
  overflow: hidden;
  min-height: 152px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.mdocs-model-card-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1);
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}
.mdocs-model-card:hover .mdocs-model-card-bg {
  transform: scale(1.08);
}
.mdocs-model-card-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.28) 50%, rgba(15, 23, 42, 0.72) 100%);
  pointer-events: none;
}
.mdocs-scroll {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
}
.mdocs-container {
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.mdocs-featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.mdocs-featured-extra {
  display: flex;
}
@media (max-width: 1180px) {
  .mdocs-featured-extra {
    display: none !important;
  }
}
.mdocs-projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.mdocs-templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}
.mdocs-ws-body {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.mdocs-ws-primary {
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mdocs-ws-primary-panels {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.mdocs-ws-windowed-tabs {
  display: none;
  flex-shrink: 0;
  padding: 8px 12px;
  gap: 6px;
  background: rgb(var(--bg-sidebar));
}
.mdocs-ws-left {
  width: 270px;
  flex-shrink: 0;
  background: rgb(var(--bg-sidebar));
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mdocs-ws-center {
  flex: 1 1 0%;
  min-width: 0;
  background: rgb(var(--bg-main));
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mdocs-ws-right {
  width: 310px;
  flex-shrink: 0;
  background: rgb(var(--bg-sidebar));
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mdocs-ws-mobile-tabs {
  display: none;
  flex-shrink: 0;
  padding: 8px 16px;
  gap: 6px;
  background: rgb(var(--bg-sidebar));
}
.mdocs-split-2 {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
  gap: 20px;
  height: 100%;
}
.mdocs-export-grid {
  flex: 1 1 0%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
  overflow: hidden;
}
@media (max-width: 1180px) and (min-width: 769px) {
  .mdocs-ws-windowed-tabs {
    display: flex;
  }
  .mdocs-ws-left,
  .mdocs-ws-center {
    width: auto;
    flex: 1 1 0%;
    border-right: none;
  }
  .mdocs-ws-right {
    width: 245px;
    display: flex !important;
  }
  .mdocs-ws-hidden-windowed {
    display: none !important;
  }
  .mdocs-chat-chip-extra {
    display: none !important;
  }
}
@media (max-width: 768px) {
  .mdocs-ws-mobile-tabs {
    display: flex;
  }
  .mdocs-ws-left,
  .mdocs-ws-center,
  .mdocs-ws-right {
    width: 100%;
    border-left: none;
    border-right: none;
  }
  .mdocs-ws-hidden-mobile {
    display: none !important;
  }
  .mdocs-split-2,
  .mdocs-export-grid {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .mdocs-sidebar {
    display: none;
  }
  .mdocs-topbar {
    padding: 10px 14px;
  }
  .mdocs-scroll {
    padding: 16px;
  }
}
`

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

function formatRelativeDate(ts?: number | string): string {
  if (!ts) return 'agora'
  const d = typeof ts === 'number' ? ts : Date.parse(ts)
  if (!Number.isFinite(d)) return 'recente'
  const diffMin = Math.max(0, Math.round((Date.now() - d) / 60000))
  if (diffMin < 2) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return 'ontem'
  if (diffD < 7) return `há ${diffD} d`
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function MomaiDocsPage() {
  const [locale, setLocale] = useState<DocsLocale>(() => resolveLocale(sdk.i18n?.getLocale?.()))
  const [view, setView] = useState<StudioView>('projects')
  const [initialCache] = useState<BootstrapCache | null>(() => readBootstrapCache())
  const [projects, setProjects] = useState<any[]>(() => initialCache?.projects || [])
  const [activeProject, setActiveProject] = useState<any | null>(null)
  const [sources, setSources] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [artifacts, setArtifacts] = useState<any[]>([])
  const [activeArtifact, setActiveArtifact] = useState<any | null>(null)
  const [templates, setTemplates] = useState<any[]>(() => initialCache?.templates || [])

  // Filters & workspace UI
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [projectSort, setProjectSort] = useState<'recent' | 'name'>('recent')
  const [modelCategory, setModelCategory] = useState<string>('Todos')
  const [selectedTool, setSelectedTool] = useState<string>('report')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [studioTab, setStudioTab] = useState<'generate' | 'docs'>('generate')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'sources' | 'chat' | 'studio'>('chat')
  const [exportTab, setExportTab] = useState<'preview' | 'edit' | 'export'>('export')
  const [exportOptions, setExportOptions] = useState({
    coverAndToc: true,
    applyLetterhead: true,
    aiReviewedBadge: false
  })

  // Inputs & chat
  const [instructions, setInstructions] = useState('')
  const [refineText, setRefineText] = useState('')
  const [chatQuery, setChatQuery] = useState('')
  const [chatAttachments, setChatAttachments] = useState<
    Array<{ id: string; name: string; mimeType: string; base64: string; isImage: boolean }>
  >([])
  const [chatMessages, setChatMessages] = useState<
    Array<{ id?: string; role: 'user' | 'assistant'; text: string; citations?: any[]; streaming?: boolean; attachments?: Array<{ name: string; isImage: boolean; base64?: string }> }>
  >([])
  const [dragOver, setDragOver] = useState(false)

  // Host & system state
  const [capabilities, setCapabilities] = useState<any>(() => initialCache?.capabilities || null)
  const [llmProviders, setLlmProviders] = useState<
    Array<{ id: string; name: string; models: Array<{ id: string; label: string }> }>
  >(() => initialCache?.llmProviders || [])
  const [selectedLlmModel, setSelectedLlmModel] = useState<string>('')
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(() => !initialCache)
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const [genStep, setGenStep] = useState(0)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalKind>('none')

  // Modal & context menu fields
  const [projectContextMenu, setProjectContextMenu] = useState<{ x: number; y: number; project: any } | null>(null)
  const [renameProjectTarget, setRenameProjectTarget] = useState<{ id: string; name: string } | null>(null)
  const [discoverQuery, setDiscoverQuery] = useState('')
  const [newProjName, setNewProjName] = useState('')
  const [newProjProfile, setNewProjProfile] = useState('general')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [addLinkKind, setAddLinkKind] = useState<'url' | 'youtube' | 'text'>('url')
  const [addLinkValue, setAddLinkValue] = useState('')
  const [letterheadFile, setLetterheadFile] = useState<{ name: string; base64: string } | null>(null)
  const [brandHeaderLogo, setBrandHeaderLogo] = useState<{ name: string; base64: string } | null>(null)
  const [brandFooterLogo, setBrandFooterLogo] = useState<{ name: string; base64: string } | null>(null)
  const [brandHeaderText, setBrandHeaderText] = useState('')
  const [brandFooterText, setBrandFooterText] = useState('')
  const [brandHeaderAlign, setBrandHeaderAlign] = useState<'left' | 'center' | 'right'>('right')
  const [brandFooterAlign, setBrandFooterAlign] = useState<'left' | 'center' | 'right'>('right')
  const [headerDropdownOpen, setHeaderDropdownOpen] = useState(false)
  const [footerDropdownOpen, setFooterDropdownOpen] = useState(false)
  const [brandKit, setBrandKit] = useState<any>(null)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [voices, setVoices] = useState<any[]>(() => initialCache?.voices || [])
  const [voiceA, setVoiceA] = useState('')
  const [voiceB, setVoiceB] = useState('')
  const [previewPageIdx, setPreviewPageIdx] = useState(0)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const chatAttachInputRef = useRef<HTMLInputElement | null>(null)
  const genAbortRef = useRef(false)

  const t = (key: string) => tDocs(locale, key)

  useEffect(() => {
    const unsubLocale = sdk.i18n?.onLocaleChange?.((loc: string) => setLocale(resolveLocale(loc)))
    const unsubProvider = sdk.llm?.onProviderChange?.((caps: any) => setCapabilities(caps))
    const unsubJobs = sdk.jobs?.subscribe?.((job: any) => {
      if (job.extensionId && job.extensionId !== EXT_ID) return
      setJobs((prev) => [job, ...prev.filter((j) => j.jobId !== job.jobId)])
      if (job.status === 'done' && activeProject) {
        void loadProjectData(activeProject.id)
      }
    })
    void bootstrap()
    return () => {
      unsubLocale?.()
      unsubProvider?.()
      unsubJobs?.()
    }
  }, [])

  async function bootstrap() {
    if (!initialCache) setLoading(true)

    // Hydrate host capabilities, voices, jobs and provider models in the background
    // so remote model queries never block the initial render.
    void (async () => {
      try {
        const [capsRes, voicesRes, jobsRes, provRes, keysRes, localModelsRes] = await Promise.all([
          sdk.llm?.getCapabilities?.().catch(() => null),
          sdk.tts?.listVoices?.().catch(() => []),
          sdk.jobs?.list?.(EXT_ID).catch(() => ({ ok: false, data: [] })),
          sdk.api.get('/llm/providers').catch(() => null),
          sdk.api.get('/llm/keys').catch(() => null),
          sdk.api.get('/llm/models').catch(() => null)
        ])
        if (capsRes) {
          setCapabilities(capsRes)
          writeBootstrapCache({ capabilities: capsRes })
        }
        if (Array.isArray(voicesRes)) {
          setVoices(voicesRes)
          writeBootstrapCache({ voices: voicesRes })
        }
        if (jobsRes?.ok && Array.isArray(jobsRes.data)) setJobs(jobsRes.data)
        if (provRes?.ok && Array.isArray(provRes.data?.providers)) {
          const keyMap: Record<string, any> = keysRes?.ok ? keysRes.data?.keys || keysRes.data || {} : {}
          const normalizeModel = (m: any): { id: string; label: string } | null => {
            if (typeof m === 'string' && m.trim()) return { id: m, label: m }
            if (m && typeof m === 'object' && (m.id || m.name)) {
              return { id: String(m.id || m.name), label: String(m.name || m.id) }
            }
            return null
          }
          const localDownloaded = Array.isArray(localModelsRes?.data?.models)
            ? localModelsRes.data.models.map(normalizeModel).filter(Boolean)
            : []
          const enriched = await Promise.all(
            provRes.data.providers.map(async (p: any) => {
              const keyEntry = keyMap[p.id] || keyMap[String(p.id).toLowerCase()]
              const isConfigured = p.id === 'local' || !p.requires_key || Boolean(keyEntry?.configured)
              let rawModels: any[] = Array.isArray(p.models) ? p.models : []
              if (p.id === 'local' && localDownloaded.length > 0) {
                rawModels = localDownloaded
              } else if (isConfigured && p.id !== 'local') {
                const dyn = await sdk.api.post('/llm/models', { provider: p.id }).catch(() => null)
                if (dyn?.ok && Array.isArray(dyn.data?.models) && dyn.data.models.length > 0) {
                  rawModels = dyn.data.models
                }
              }
              const models = rawModels.map(normalizeModel).filter(Boolean) as Array<{ id: string; label: string }>
              return { id: String(p.id), name: String(p.name || p.id), models, isConfigured }
            })
          )
          const activeProviders = enriched.filter((p) => p.isConfigured && p.models.length > 0)
          setLlmProviders(activeProviders)
          writeBootstrapCache({ llmProviders: activeProviders })
        }
      } catch { }
    })()

    try {
      const [projRes, tplRes] = await Promise.all([
        sdk.api.get(`/extensions/${EXT_ID}/projects`),
        sdk.api.get(`/extensions/${EXT_ID}/templates`)
      ])
      const loadedProjects = projRes?.ok && Array.isArray(projRes.data?.projects) ? projRes.data.projects : []
      setProjects(loadedProjects)
      const loadedTemplates = tplRes?.ok && Array.isArray(tplRes.data?.templates) ? tplRes.data.templates : undefined
      if (loadedTemplates) setTemplates(loadedTemplates)
      writeBootstrapCache({
        projects: loadedProjects,
        ...(loadedTemplates ? { templates: loadedTemplates } : {})
      })

      // Resume active generation if user navigated away and came back
      try {
        const rawGen = sessionStorage.getItem('momai-docs:active-gen')
        if (rawGen) {
          const parsed = JSON.parse(rawGen)
          const proj = loadedProjects.find((p: any) => p.id === parsed.projectId)
          if (proj) {
            await openProject(proj)
            return
          }
        }
      } catch { }
    } catch (err: any) {
      if (!initialCache) setErrorBanner(err?.message || 'Erro ao inicializar MomAI Docs')
    } finally {
      setLoading(false)
    }
  }

  function pollGenerationUntilDone(projectId: string, toolId: string) {
    setSelectedTool(toolId)
    setView('generating')
    setBusyMessage(`${t('generating')} (${toolId})`)
    const poll = window.setInterval(async () => {
      try {
        const artRes = await sdk.api.get(`/extensions/${EXT_ID}/artifacts`, { projectId })
        if (!artRes?.ok) return
        const ag = artRes.data?.activeGeneration
        const list = artRes.data?.artifacts || []
        if (ag) {
          const stepIdx = Math.min(
            GENERATING_STEPS.length - 1,
            Math.max(0, Math.floor((Number(ag.percent || 10) / 100) * GENERATING_STEPS.length))
          )
          setGenStep(stepIdx)
          return
        }
        window.clearInterval(poll)
        try {
          sessionStorage.removeItem('momai-docs:active-gen')
        } catch { }
        setBusyMessage(null)
        setArtifacts(list)
        if (list[0]) {
          setActiveArtifact(list[0])
          setPreviewPageIdx(0)
          setExportTab('export')
          setView('export')
        } else {
          setView('workspace')
        }
      } catch {
        window.clearInterval(poll)
        setBusyMessage(null)
        setView('workspace')
      }
    }, 1500)
  }

  async function loadProjectData(projectId: string) {
    const [srcRes, artRes, bkRes] = await Promise.all([
      sdk.api.get(`/extensions/${EXT_ID}/sources`, { projectId }),
      sdk.api.get(`/extensions/${EXT_ID}/artifacts`, { projectId }),
      sdk.api.get(`/extensions/${EXT_ID}/brand-kits`, { projectId })
    ])
    if (srcRes?.ok) setSources(srcRes.data?.sources || [])
    if (artRes?.ok) {
      const list = artRes.data?.artifacts || []
      setArtifacts(list)
      if (list[0]) {
        setActiveArtifact(list[0])
        setPreviewPageIdx(0)
      } else {
        setActiveArtifact(null)
      }
      if (artRes.data?.activeGeneration) {
        pollGenerationUntilDone(projectId, artRes.data.activeGeneration.toolId || selectedTool)
        return
      }
      try {
        const rawGen = sessionStorage.getItem('momai-docs:active-gen')
        if (rawGen) {
          const parsed = JSON.parse(rawGen)
          if (parsed.projectId === projectId) {
            sessionStorage.removeItem('momai-docs:active-gen')
            if (list[0] && Number(list[0].createdAt || 0) >= Number(parsed.startedAt || 0)) {
              setExportTab('export')
              setView('export')
            }
          }
        }
      } catch { }
    }
    if (bkRes?.ok) setBrandKit(bkRes.data?.brandKit || null)
  }

  async function openProject(proj: any) {
    setActiveProject(proj)
    setSuggestions([])
    setChatMessages([])
    setMobilePanel('chat')
    setView('workspace')
    await loadProjectData(proj.id)
  }

  async function createInstantProject(initialName = 'Projeto sem título', profile = 'general') {
    setBusyMessage('Criando projeto...')
    const res = await sdk.api.post(`/extensions/${EXT_ID}/projects`, {
      action: 'create',
      name: initialName,
      profile
    })
    setBusyMessage(null)
    if (res?.ok && res.data?.project) {
      setProjects((prev) => [res.data.project, ...prev])
      await openProject(res.data.project)
    }
  }

  async function saveProjectTitle(projectId: string, nextName: string) {
    const clean = nextName.trim().slice(0, 72)
    if (!clean) return
    const res = await sdk.api.post(`/extensions/${EXT_ID}/projects`, {
      action: 'update',
      projectId,
      name: clean,
      titleLocked: true
    })
    if (res?.ok && res.data?.project) {
      if (activeProject?.id === projectId) {
        setActiveProject(res.data.project)
      }
      setProjects((prev) => prev.map((p) => (p.id === projectId ? res.data.project : p)))
    }
  }

  async function handleTogglePinProject(proj: any) {
    const res = await sdk.api.post(`/extensions/${EXT_ID}/projects`, {
      action: 'update',
      projectId: proj.id,
      pinned: !proj.pinned
    })
    if (res?.ok && res.data?.project) {
      if (activeProject?.id === proj.id) {
        setActiveProject(res.data.project)
      }
      setProjects((prev) => prev.map((p) => (p.id === proj.id ? res.data.project : p)))
    }
  }

  function openProjectContextMenu(e: React.MouseEvent, proj: any) {
    e.preventDefault()
    e.stopPropagation()
    setProjectContextMenu({ x: e.clientX, y: e.clientY, project: proj })
  }

  async function maybeAutoTitleProject(candidate: string) {
    if (!activeProject) return
    if (activeProject.titleLocked) return
    const curName = String(activeProject.name || '').trim()
    if (curName && curName !== 'Projeto sem título' && curName !== 'Novo Projeto') return
    const cleaned = candidate
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/^https?:\/\/(www\.)?/i, '')
      .trim()
      .slice(0, 56)
    if (!cleaned) return
    await saveProjectTitle(activeProject.id, cleaned)
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newProjName.trim()) return
    setModal('none')
    await createInstantProject(newProjName.trim(), newProjProfile)
    setNewProjName('')
  }

  async function handleDeleteProject(projectId: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const res = await sdk.api.post(`/extensions/${EXT_ID}/projects`, {
      action: 'delete',
      projectId
    })
    if (res?.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      if (activeProject?.id === projectId) {
        setActiveProject(null)
        setView('projects')
      }
    }
  }

  async function handleFileDrop(files: FileList | null) {
    if (!files || !activeProject) return
    setErrorBanner(null)
    const projectId = activeProject.id
    for (const file of Array.from(files)) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const optimistic = {
        id: tempId,
        projectId,
        kind: 'file',
        title: file.name,
        fileName: file.name,
        status: 'indexing',
        active: true,
        totalChars: 0,
        totalChunks: 0
      }
      setSources((prev) => [optimistic, ...prev])
      try {
        const base64 = await fileToBase64(file)
        const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, {
          projectId,
          kind: 'file',
          fileName: file.name,
          mimeType: file.type,
          contentBase64: base64
        })
        if (res?.data?.source) {
          setSources((prev) => [
            res.data.source,
            ...prev.filter((s) => s.id !== tempId && s.id !== res.data.source.id)
          ])
          void maybeAutoTitleProject(res.data.source.title || file.name)
        } else {
          setSources((prev) => prev.filter((s) => s.id !== tempId))
          if (res?.data?.error) setErrorBanner(res.data.error)
        }
      } catch (err: any) {
        setSources((prev) => prev.filter((s) => s.id !== tempId))
        setErrorBanner(err?.message || `Erro ao processar ${file.name}`)
      }
    }
  }

  async function handleAddLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeProject || !addLinkValue.trim()) return
    const val = addLinkValue.trim()
    const kind = addLinkKind
    const projectId = activeProject.id
    setModal('none')
    setAddLinkValue('')
    setErrorBanner(null)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const title = kind === 'text' ? `Nota ${new Date().toLocaleTimeString()}` : val
    setSources((prev) => [
      { id: tempId, projectId, kind, title, status: 'indexing', active: true, totalChars: 0, totalChunks: 0 },
      ...prev
    ])
    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, {
        projectId,
        kind,
        ...(kind === 'text' ? { title, text: val } : { url: val })
      })
      if (res?.data?.source) {
        setSources((prev) => [
          res.data.source,
          ...prev.filter((s) => s.id !== tempId && s.id !== res.data.source.id)
        ])
        void maybeAutoTitleProject(res.data.source.title || val)
      } else {
        setSources((prev) => prev.filter((s) => s.id !== tempId))
        if (res?.data?.error) setErrorBanner(res.data.error)
      }
    } catch (err: any) {
      setSources((prev) => prev.filter((s) => s.id !== tempId))
      setErrorBanner(err?.message || 'Erro ao adicionar fonte')
    }
  }

  async function handleRemoveSource(sourceId: string) {
    if (!activeProject) return
    const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, {
      action: 'delete',
      projectId: activeProject.id,
      sourceId
    })
    if (res?.ok) {
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
    }
  }

  async function handleDiscoverSources(e: React.FormEvent) {
    e.preventDefault()
    if (!activeProject || !discoverQuery.trim()) return
    setMobilePanel('sources')
    setBusyMessage('Buscando fontes confiáveis...')
    setErrorBanner(null)
    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources/discover`, {
        projectId: activeProject.id,
        query: discoverQuery.trim(),
        limit: 6
      })
      if (res?.ok && Array.isArray(res.data?.suggestions)) {
        setSuggestions(res.data.suggestions)
        if (res.data.suggestions.length === 0) {
          setErrorBanner('Nenhuma sugestão encontrada para esse termo. Tente palavras-chave mais amplas.')
        }
      } else {
        setErrorBanner(res?.data?.error || 'Falha ao buscar fontes.')
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Falha ao buscar fontes.')
    } finally {
      setBusyMessage(null)
    }
  }

  async function approveSuggestion(sug: any) {
    if (!activeProject) return
    const projectId = activeProject.id
    const kind = sug.kind === 'youtube' ? 'youtube' : 'url'
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setSuggestions((prev) => prev.filter((s) => s.id !== sug.id))
    setSources((prev) => [
      { id: tempId, projectId, kind, title: sug.title, status: 'indexing', active: true, totalChars: 0, totalChunks: 0 },
      ...prev
    ])
    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, {
        projectId,
        kind,
        title: sug.title,
        url: sug.url
      })
      if (res?.data?.source) {
        setSources((prev) => [
          res.data.source,
          ...prev.filter((s) => s.id !== tempId && s.id !== res.data.source.id)
        ])
      } else {
        setSources((prev) => prev.filter((s) => s.id !== tempId))
      }
    } catch {
      setSources((prev) => prev.filter((s) => s.id !== tempId))
    }
  }

  async function handleGenerate(overrideTool?: string) {
    if (!activeProject) return
    const toolId = overrideTool || selectedTool
    genAbortRef.current = false
    setGenStep(0)
    setView('generating')
    setBusyMessage(`${t('generating')} (${toolId})`)
    setErrorBanner(null)
    try {
      sessionStorage.setItem(
        'momai-docs:active-gen',
        JSON.stringify({ projectId: activeProject.id, toolId, startedAt: Date.now() })
      )
    } catch { }

    const timer = window.setInterval(() => {
      setGenStep((prev) => (prev < GENERATING_STEPS.length - 1 ? prev + 1 : prev))
    }, 1100)

    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/generate`, {
        projectId: activeProject.id,
        toolId,
        templateId: selectedTemplate || undefined,
        instructions: instructions.trim() || undefined,
        groundingMode: activeProject.groundingMode,
        ...(toolId === 'letterhead' && letterheadFile
          ? { letterheadFileBase64: letterheadFile.base64, letterheadFileName: letterheadFile.name }
          : {}),
        options: {
          voiceA,
          voiceB,
          ...exportOptions,
          brandHeaderLogoBase64: brandHeaderLogo?.base64 || undefined,
          brandFooterLogoBase64: brandFooterLogo?.base64 || undefined,
          brandLogoInHeader: Boolean(brandHeaderLogo),
          brandLogoInFooter: Boolean(brandFooterLogo),
          brandHeaderText: brandHeaderText.trim() || undefined,
          brandFooterText: brandFooterText.trim() || undefined,
          brandHeaderAlign,
          brandFooterAlign
        }
      })
      window.clearInterval(timer)
      try {
        sessionStorage.removeItem('momai-docs:active-gen')
      } catch { }
      if (genAbortRef.current) return

      if (res?.data?.ok && res.data?.artifact) {
        setGenStep(GENERATING_STEPS.length - 1)
        setArtifacts((prev) => [res.data.artifact, ...prev])
        setActiveArtifact(res.data.artifact)
        setPreviewPageIdx(0)
        setInstructions('')
        setStudioTab('docs')
        setExportTab('export')
        setView('export')
        void maybeAutoTitleProject(res.data.artifact.title || instructions || activeToolSpec.label)
      } else {
        setErrorBanner(res?.data?.error || res?.error || 'Falha na geração.')
        setView('workspace')
      }
    } catch (err: any) {
      window.clearInterval(timer)
      try {
        sessionStorage.removeItem('momai-docs:active-gen')
      } catch { }
      if (!genAbortRef.current) {
        setErrorBanner(err?.message || 'Falha na geração.')
        setView('workspace')
      }
    } finally {
      setBusyMessage(null)
    }
  }

  async function handleRefine() {
    if (!activeArtifact || !refineText.trim()) return
    setBusyMessage('Refinando artefato...')
    setErrorBanner(null)
    const res = await sdk.api.post(`/extensions/${EXT_ID}/refine`, {
      artifactId: activeArtifact.id,
      instruction: refineText.trim()
    })
    setBusyMessage(null)
    if (res?.data?.ok && res.data?.artifact) {
      setActiveArtifact(res.data.artifact)
      setArtifacts((prev) => prev.map((a) => (a.id === res.data.artifact.id ? res.data.artifact : a)))
      setRefineText('')
    } else {
      setErrorBanner(res?.data?.error || 'Falha ao refinar artefato.')
    }
  }

  async function handleExport(format: string) {
    if (!activeArtifact) return
    setBusyMessage(`Exportando ${format.toUpperCase()}...`)
    const res = await sdk.api.post(`/extensions/${EXT_ID}/export`, {
      artifactId: activeArtifact.id,
      format
    })
    setBusyMessage(null)
    if (res?.data?.ok && res.data?.base64) {
      const bin = atob(res.data.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.data.fileName || `momai-docs.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      setErrorBanner(res?.data?.error || 'Erro ao exportar.')
    }
  }

  async function addBrandImageFromFile(file: File | null | undefined, target: 'header' | 'footer') {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setErrorBanner('Envie uma imagem PNG, JPG ou WEBP para o timbre.')
      return
    }
    const base64 = await fileToBase64(file)
    if (target === 'header') setBrandHeaderLogo({ name: file.name, base64 })
    else setBrandFooterLogo({ name: file.name, base64 })
  }

  async function pasteBrandImageFromClipboard(target: 'header' | 'footer') {
    try {
      if (!sdk.clipboard?.read) return
      const res = await sdk.clipboard.read()
      if (res?.ok && res.type === 'image' && res.dataUrl) {
        const payload = { name: `clipboard-${Date.now()}.png`, base64: res.dataUrl }
        if (target === 'header') setBrandHeaderLogo(payload)
        else setBrandFooterLogo(payload)
      } else {
        setErrorBanner('Nenhuma imagem encontrada na área de transferência.')
      }
    } catch {
      setErrorBanner('Não foi possível ler a imagem da área de transferência.')
    }
  }

  async function addChatAttachmentsFromFiles(files: FileList | File[] | null) {
    if (!files) return
    const list = Array.from(files)
    const next: Array<{ id: string; name: string; mimeType: string; base64: string; isImage: boolean }> = []
    for (const file of list) {
      const base64 = await fileToBase64(file)
      const isImage = /^image\//i.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name)
      next.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name || `anexo-${Date.now()}.png`,
        mimeType: file.type || (isImage ? 'image/png' : 'application/octet-stream'),
        base64,
        isImage
      })
    }
    if (next.length > 0) setChatAttachments((prev) => [...prev, ...next])
  }

  async function handleChatAsk(e?: React.FormEvent, presetQuery?: string) {
    e?.preventDefault()
    const rawQ = (presetQuery ?? chatQuery).trim()
    const pendingAttachments = presetQuery ? [] : chatAttachments
    if (!activeProject || (!rawQ && pendingAttachments.length === 0)) return
    const q = rawQ || 'Analise os anexos enviados.'
    if (!presetQuery) {
      setChatQuery('')
      setChatAttachments([])
    }
    const assistantId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: rawQ || `📎 ${pendingAttachments.map((a) => a.name).join(', ')}`,
        ...(pendingAttachments.length > 0
          ? { attachments: pendingAttachments.map((a) => ({ name: a.name, isImage: a.isImage, base64: a.isImage ? a.base64 : undefined })) }
          : {})
      },
      { id: assistantId, role: 'assistant', text: '', streaming: true }
    ])
    try {
      if (pendingAttachments.length > 0) {
        for (const att of pendingAttachments) {
          const srcRes = await sdk.api.post(`/extensions/${EXT_ID}/sources`, {
            projectId: activeProject.id,
            kind: 'file',
            fileName: att.name,
            mimeType: att.mimeType,
            contentBase64: att.base64
          })
          if (srcRes?.data?.source) {
            setSources((prev) => [
              srcRes.data.source,
              ...prev.filter((s) => s.id !== srcRes.data.source.id)
            ])
          }
        }
      }
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources/query`, {
        projectId: activeProject.id,
        query: q,
        answerWithCitations: true
      })
      const fullText = String(
        res?.data?.answer || res?.data?.error || 'Não consegui gerar uma resposta agora. Tente novamente.'
      )
      const citations = res?.data?.citations || []
      const tokens = fullText.split(/(\s+)/)
      const step = Math.max(2, Math.ceil(tokens.length / 45))
      let idx = 0
      await new Promise<void>((resolve) => {
        const tick = () => {
          idx = Math.min(tokens.length, idx + step)
          const partial = tokens.slice(0, idx).join('')
          const done = idx >= tokens.length
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, text: partial, streaming: !done, ...(done ? { citations } : {}) }
                : m
            )
          )
          if (done) resolve()
          else window.setTimeout(tick, 18)
        }
        tick()
      })
    } catch (err: any) {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: err?.message || 'Erro ao consultar o assistente.', streaming: false }
            : m
        )
      )
    }
  }

  async function startFromTool(tool: ToolSpec) {
    setSelectedTool(tool.id)
    setSelectedTemplate('')
    if (activeProject) {
      setStudioTab('generate')
      setView('workspace')
      return
    }
    const profile =
      tool.category === 'Acadêmico' ? 'student' : tool.category === 'Oficial' ? 'public_servant' : 'executive'
    await createInstantProject('Projeto sem título', profile)
  }

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      if (pinDiff !== 0) return pinDiff
      return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
    })
  }, [projects])

  const filteredProjects = useMemo(() => {
    const base =
      projectFilter === 'all'
        ? projects
        : projects.filter((p) => (p.profile || 'general') === projectFilter)
    return [...base].sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      if (pinDiff !== 0) return pinDiff
      if (projectSort === 'name') return String(a.name || '').localeCompare(String(b.name || ''))
      return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
    })
  }, [projects, projectFilter, projectSort])

  const featuredTools = useMemo(() => TOOL_CATALOG.filter((x) => x.featured), [])
  const filteredTools = useMemo(() => {
    if (modelCategory === 'Todos') return TOOL_CATALOG
    return TOOL_CATALOG.filter((tool) => tool.category === modelCategory)
  }, [modelCategory])

  const activeToolSpec = useMemo(
    () => TOOL_CATALOG.find((x) => x.id === selectedTool) || TOOL_CATALOG[0],
    [selectedTool]
  )

  const toolTemplates = useMemo(() => {
    const apiMatches = templates.filter((tpl) => tpl.toolId === selectedTool)
    if (apiMatches.length > 0) return apiMatches
    return [
      { id: `${selectedTool}-formal`, name: 'Formal Padrão', description: 'Estrutura clássica e margens oficiais' },
      { id: `${selectedTool}-simples`, name: 'Direto / Conciso', description: 'Sem timbre · foco em leitura rápida' },
      { id: `${selectedTool}-timbre`, name: 'Com Timbre', description: 'Cabeçalho institucional e rodapé' }
    ]
  }, [templates, selectedTool])

  const activeJobsCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length
  const overlayTarget = sdk.ui?.overlayRoot?.() ?? document.body

  if (loading) {
    return (
      <div className="mdocs-root">
        <style>{DOCS_LAYOUT_CSS}</style>
        <div className="mdocs-scroll">
          <div className="mdocs-container animate-pulse">
            <div className="h-9 w-56 rounded-xl bg-card border border-border" />
            <div className="mdocs-projects-grid">
              <div className="h-36 rounded-2xl bg-card border border-border" />
              <div className="h-36 rounded-2xl bg-card border border-border" />
              <div className="h-36 rounded-2xl bg-card border border-border" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mdocs-root">
      <style>{DOCS_LAYOUT_CSS}</style>

      {/* Left Studio Sidebar */}
      {sidebarOpen && (
        <aside className="mdocs-sidebar">
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="px-2.5 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Estúdio
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
                className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between ${view === 'projects'
                    ? 'bg-card text-text font-medium border border-border'
                    : 'text-text-muted hover:text-text hover:bg-card/50'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span>🏠</span>
                  <span>Início</span>
                </span>
                <span className="text-[11px] text-text-muted tabular-nums">{projects.length}</span>
              </button>
              <button
                onClick={() => setView('models')}
                className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between ${view === 'models' || view === 'template_detail'
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
              {activeProject && (
                <button
                  onClick={() => setView('workspace')}
                  className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between ${view === 'workspace' || view === 'generating' || view === 'export'
                      ? 'bg-card text-text font-medium border border-border'
                      : 'text-text-muted hover:text-text hover:bg-card/50'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <span>✨</span>
                    <span>Workspace</span>
                  </span>
                  <span className="text-[11px] text-text-muted tabular-nums">{artifacts.length}</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Recentes
              </div>
              {sortedProjects.length === 0 ? (
                <div className="px-2.5 py-1 text-[11px] text-text-muted">Nenhum projeto ainda</div>
              ) : (
                sortedProjects.slice(0, 4).map((p) => {
                  const isCurrent =
                    activeProject?.id === p.id &&
                    (view === 'workspace' || view === 'export' || view === 'generating')
                  return (
                    <button
                      key={p.id}
                      onClick={() => void openProject(p)}
                      onContextMenu={(e) => openProjectContextMenu(e, p)}
                      className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center gap-2 text-left ${isCurrent
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-text-muted hover:text-text hover:bg-card/50'
                        }`}
                    >
                      <span className="shrink-0">{PROFILE_EMOJIS[p.profile] || '📓'}</span>
                      <span className="truncate flex-1">{p.name}</span>
                      {p.pinned && <span className="text-[10px] shrink-0" title="Fixado no topo">📌</span>}
                    </button>
                  )
                })
              )}
            </div>

            <div className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Suporte
              </div>
              <button
                onClick={() => setModal('queue')}
                className="w-full h-8 px-2.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-card/50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <span>⏱️</span>
                  <span>Fila de tarefas</span>
                </span>
                {activeJobsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-accent text-bg text-[10px] font-semibold tabular-nums">
                    {activeJobsCount}
                  </span>
                )}
              </button>
              <button
                onClick={async () => {
                  const res = await sdk.api.get(`/extensions/${EXT_ID}/diagnostics`)
                  setDiagnostics(res?.data?.diagnostics || null)
                  setModal('diagnostics')
                }}
                className="w-full h-8 px-2.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-card/50 flex items-center gap-2"
              >
                <span>⚙️</span>
                <span>Diagnóstico</span>
              </button>
              <button
                onClick={() => setModal('credits')}
                className="w-full h-8 px-2.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-card/50 flex items-center gap-2"
              >
                <span>🛡️</span>
                <span>Licenças</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="mdocs-main">
        {/* Global Top Bar (adapts cleanly to Home vs Workspace vs Export) */}
        <header className="mdocs-topbar">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
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
                onClick={() => {
                  if (view === 'export' || view === 'generating') setView('workspace')
                  else if (view === 'template_detail') setView('models')
                  else setView('projects')
                }}
                className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs text-text hover:bg-input flex items-center gap-1 shrink-0"
              >
                <IconChevronLeft size={14} />
                <span>Voltar</span>
              </button>
            )}
            <div className="min-w-0">
              {view === 'workspace' && activeProject && editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    setEditingTitle(false)
                    if (titleDraft.trim() && titleDraft.trim() !== activeProject.name) {
                      void saveProjectTitle(activeProject.id, titleDraft)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setEditingTitle(false)
                      if (titleDraft.trim() && titleDraft.trim() !== activeProject.name) {
                        void saveProjectTitle(activeProject.id, titleDraft)
                      }
                    } else if (e.key === 'Escape') {
                      setEditingTitle(false)
                    }
                  }}
                  className="h-8 px-2.5 rounded-lg bg-input border border-accent text-base font-semibold text-text focus:outline-none"
                />
              ) : (
                <h1
                  onClick={() => {
                    if (view === 'workspace' && activeProject) {
                      setTitleDraft(activeProject.name || '')
                      setEditingTitle(true)
                    }
                  }}
                  title={view === 'workspace' && activeProject ? 'Clique para renomear o projeto' : undefined}
                  className={`text-lg font-semibold tracking-tight text-text truncate ${view === 'workspace' && activeProject ? 'cursor-pointer hover:text-accent transition-colors' : ''
                    }`}
                >
                  {view === 'workspace' && activeProject
                    ? activeProject.name
                    : view === 'models'
                      ? 'Modelos e Formatos'
                      : view === 'template_detail'
                        ? activeToolSpec.label
                        : view === 'export' && activeArtifact
                          ? activeArtifact.title
                          : 'MomAI Docs'}
                </h1>
              )}
              {view === 'workspace' && activeProject && (
                <p className="text-[11px] text-text-muted truncate">
                  {`${sources.length} fontes · ${artifacts.length} documentos · ${PROFILE_LABELS[activeProject.profile] || 'Geral'}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">

            {view === 'workspace' && activeProject ? (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-text hover:bg-input flex items-center gap-1.5"
                >
                  <IconPlus size={13} />
                  <span>Fonte</span>
                </button>
                <button
                  onClick={() => setModal('brand')}
                  className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-text hover:bg-input"
                >
                  Timbre
                </button>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={Boolean(busyMessage)}
                  className="h-8 px-3.5 rounded-lg bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <IconSparkles size={13} />
                  <span>Gerar</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModal('queue')}
                  className="h-8 px-2.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-input/60 flex items-center gap-1.5 transition-colors"
                  title="Fila de tarefas"
                >
                  <IconClock size={13} />
                  <span className="tabular-nums">{activeJobsCount}</span>
                </button>
                <button
                  onClick={() => void createInstantProject()}
                  className="h-8 px-3.5 rounded-lg bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                >
                  <IconPlus size={13} />
                  <span>Novo projeto</span>
                </button>
              </>
            )}
          </div>
        </header>

        {errorBanner && (
          <div className="shrink-0 bg-error/10 border-b border-error/25 px-6 py-2 text-xs text-error flex items-center justify-between gap-3">
            <span className="truncate">{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} className="shrink-0 hover:opacity-80">
              <IconX size={14} />
            </button>
          </div>
        )}

        {/* ── TELA 01: HOME (ESTILO NOTEBOOKLM) ─────────────────────────────────── */}
        {view === 'projects' && (
          <main className="mdocs-scroll">
            <div className="mdocs-container">
              {/* Seção 1: Comece com um modelo (Em destaque) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-text">Comece com um modelo</h2>
                  <button
                    onClick={() => setView('models')}
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <span>Ver todos ({TOOL_CATALOG.length})</span>
                    <IconChevronRight size={12} />
                  </button>
                </div>

                <div className="mdocs-featured-grid">
                  {featuredTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => void startFromTool(tool)}
                      className={`mdocs-model-card text-left p-4 flex-col justify-between gap-3 ${tool.featuredCompact ? 'flex' : 'mdocs-featured-extra'
                        }`}
                    >
                      <img src={getModelCardBackground(tool.id)} alt="" className="mdocs-model-card-bg" />
                      <div className="mdocs-model-card-scrim" />
                      <div className="relative z-10 flex items-center justify-between gap-2 w-full">
                        <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm border border-white/15 flex items-center justify-center text-base mdocs-emoji">
                          {tool.emoji}
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-black/35 backdrop-blur-sm border border-white/10 text-[10px] font-medium uppercase text-white/85">
                          {tool.formats.slice(0, 2).join(' · ')}
                        </span>
                      </div>
                      <div className="relative z-10 space-y-1">
                        <div className="text-xs font-semibold text-white">{tool.label}</div>
                        <div className="text-[11px] text-white/80 line-clamp-2 leading-relaxed">
                          {tool.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Seção 2: Projetos recentes */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-text mr-2">Projetos recentes</h2>
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'general', label: 'Geral' },
                      { id: 'student', label: 'Acadêmico' },
                      { id: 'lawyer', label: 'Jurídico' },
                      { id: 'public_servant', label: 'Oficial' },
                      { id: 'executive', label: 'Executivo' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setProjectFilter(f.id)}
                        className={`h-7 px-2.5 rounded-lg text-xs transition-colors ${projectFilter === f.id
                            ? 'bg-card border border-border text-text font-medium'
                            : 'text-text-muted hover:text-text hover:bg-card/50'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={projectSort}
                    onChange={(e) => setProjectSort(e.target.value as 'recent' | 'name')}
                    className="h-7 px-2.5 rounded-lg bg-card border border-border text-xs text-text"
                  >
                    <option value="recent">Recentes primeiro</option>
                    <option value="name">Nome (A–Z)</option>
                  </select>
                </div>

                <div className="mdocs-projects-grid">
                  <button
                    onClick={() => void createInstantProject()}
                    className="min-h-[124px] rounded-2xl border border-dashed border-border bg-card/40 hover:bg-card hover:border-accent/60 p-4 flex flex-col items-center justify-center gap-2 text-center transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-input border border-border flex items-center justify-center text-accent">
                      <IconPlus size={15} />
                    </div>
                    <div className="text-xs font-semibold text-text">Criar novo projeto</div>
                    <div className="text-[11px] text-text-muted">Adicione PDFs, links ou notas</div>
                  </button>

                  {filteredProjects.map((p) => {
                    const srcCount = p.sourceCount ?? p.sourcesCount ?? 0
                    const artCount = p.artifactCount ?? p.artifactsCount ?? 0
                    return (
                      <div
                        key={p.id}
                        onClick={() => void openProject(p)}
                        onContextMenu={(e) => openProjectContextMenu(e, p)}
                        className="group min-h-[124px] rounded-2xl bg-card hover:bg-input p-4 flex flex-col justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mdocs-emoji ${p.profile === 'student' || p.profile === 'teacher'
                                ? 'mdocs-tint-green'
                                : p.profile === 'lawyer' || p.profile === 'public_servant'
                                  ? 'mdocs-tint-blue'
                                  : p.profile === 'executive'
                                    ? 'mdocs-tint-yellow'
                                    : 'mdocs-tint-info'
                              }`}
                          >
                            {PROFILE_EMOJIS[p.profile] || '📓'}
                          </div>
                          <div className="flex items-center gap-1">
                            {p.pinned && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent" title="Fixado no topo">
                                📌
                              </span>
                            )}
                            <button
                              onClick={(e) => void handleDeleteProject(p.id, e)}
                              title="Excluir projeto"
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-all"
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 pt-2">
                          <div className="text-sm font-semibold text-text truncate">{p.name}</div>
                          <div className="text-[11px] text-text-muted truncate">
                            {formatRelativeDate(p.updatedAt || p.createdAt)} · {srcCount} fontes · {artCount} docs
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          </main>
        )}

        {/* ── TELA 02: MODELOS ──────────────────────────────────────────────────── */}
        {view === 'models' && (
          <main className="mdocs-scroll">
            <div className="mdocs-container">
              <div className="flex items-center gap-1.5 flex-wrap">
                {['Todos', 'Oficial', 'Acadêmico', 'Slides', 'Planilhas', 'Áudio & Vídeo', 'Relatórios'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setModelCategory(cat)}
                    className={`h-7 px-3 rounded-lg text-xs transition-colors ${modelCategory === cat
                        ? 'bg-card border border-border text-text font-medium'
                        : 'text-text-muted hover:text-text hover:bg-card/50'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="mdocs-featured-grid">
                {filteredTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setSelectedTool(tool.id)
                      setSelectedTemplate('')
                      setView('template_detail')
                    }}
                    className="mdocs-model-card text-left p-4 flex flex-col justify-between gap-3"
                  >
                    <img src={getModelCardBackground(tool.id)} alt="" className="mdocs-model-card-bg" />
                    <div className="mdocs-model-card-scrim" />
                    <div className="relative z-10 flex items-start justify-between gap-2 w-full">
                      <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/15 flex items-center justify-center text-lg mdocs-emoji">
                        {tool.emoji}
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-black/35 backdrop-blur-sm border border-white/10 text-[10px] font-medium uppercase text-white/85">
                        {tool.formats.slice(0, 2).join(' · ')}
                      </span>
                    </div>
                    <div className="relative z-10 space-y-1">
                      <div className="text-sm font-semibold text-white">{tool.label}</div>
                      <div className="text-[11px] text-white/80 line-clamp-2 leading-relaxed">
                        {tool.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </main>
        )}

        {/* ── TELA 03: DETALHE DO TEMPLATE ──────────────────────────────────────── */}
        {view === 'template_detail' && (
          <main className="mdocs-scroll">
            <div className="mdocs-container">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-text">{activeToolSpec.label}</h2>
                  <p className="text-xs text-text-muted">{activeToolSpec.specLine}</p>
                </div>
                <button
                  onClick={() => void startFromTool(activeToolSpec)}
                  className="h-9 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-2"
                >
                  <IconSparkles size={14} />
                  <span>{activeProject ? 'Usar no projeto atual' : 'Criar projeto com este modelo'}</span>
                </button>
              </div>

              <div className="mdocs-templates-grid">
                {toolTemplates.map((tpl, idx) => {
                  const isSel = selectedTemplate ? selectedTemplate === tpl.id : idx === 0
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`text-left rounded-2xl bg-card border p-5 flex flex-col items-center gap-4 transition-all ${isSel ? 'border-accent ring-1 ring-accent/30' : 'border-border hover:border-accent/50'
                        }`}
                    >
                      <MiniDocumentThumb
                        variant={activeToolSpec.thumbVariant}
                        toolId={selectedTool}
                        templateName={tpl.name}
                        highlight={isSel}
                      />
                      <div className="w-full flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-text truncate">{tpl.name}</div>
                          <div className="text-[11px] text-text-muted truncate">
                            {tpl.description || activeToolSpec.formats.join(' · ').toUpperCase()}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isSel ? 'bg-accent text-bg' : 'border border-border bg-input text-transparent'
                            }`}
                        >
                          <IconCheck size={12} />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </main>
        )}

        {/* ── TELA 04: WORKSPACE RESPONSIVO (3 PAINÉIS FLEX) ────────────────────── */}
        {view === 'workspace' && activeProject && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFileDrop(e.target.files)}
            />

            {/* Mobile / Windowed Switcher */}
            <div className="mdocs-ws-mobile-tabs">
              {[
                { id: 'sources', label: `Fontes (${sources.length})` },
                { id: 'chat', label: 'Chat' },
                { id: 'studio', label: `Estúdio (${artifacts.length})`, cls: 'mdocs-ws-tab-studio' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMobilePanel(tab.id as any)}
                  className={`flex-1 h-8 rounded-lg text-xs font-medium transition-colors ${tab.cls || ''} ${mobilePanel === tab.id ? 'bg-card border border-border text-text' : 'text-text-muted'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mdocs-ws-body">
              <div className={`mdocs-ws-primary ${mobilePanel === 'studio' ? 'mdocs-ws-hidden-mobile' : ''}`}>
                <div className="mdocs-ws-windowed-tabs">
                  {[
                    { id: 'sources', label: `Fontes (${sources.length})` },
                    { id: 'chat', label: 'Chat' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMobilePanel(tab.id as any)}
                      className={`flex-1 h-7 rounded-lg text-xs font-medium transition-colors ${
                        (mobilePanel === 'sources' ? tab.id === 'sources' : tab.id === 'chat')
                          ? 'bg-card text-text shadow-glass-sm'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="mdocs-ws-primary-panels">
                  {/* Painel Esquerdo: FONTES */}
                  <section
                    className={`mdocs-ws-left ${mobilePanel !== 'sources' ? 'mdocs-ws-hidden-mobile mdocs-ws-hidden-windowed' : ''}`}
                  >
                <div className="px-4 py-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Fontes</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-input text-[10px] font-semibold text-text tabular-nums">
                      {sources.length}
                    </span>
                  </div>
                  <button onClick={() => setModal('discover')} className="text-[11px] text-accent hover:underline">
                    Descobrir
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {sources.map((s) => (
                    <div
                      key={s.id}
                      className="group p-2.5 rounded-xl bg-card hover:bg-input flex items-start justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${s.kind === 'url' || s.kind === 'youtube' ? 'mdocs-tint-blue' : 'mdocs-tint-green'
                            }`}
                        >
                          {s.kind === 'url' || s.kind === 'youtube' ? <IconGlobe size={13} /> : <IconFileText size={13} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-text truncate">{s.title}</div>
                          <div className="text-[10px] text-text-muted uppercase">
                            {s.kind} · {s.chunkCount ?? 1} trechos
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => void handleRemoveSource(s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-error"
                        title="Remover fonte"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  ))}

                  {suggestions.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/25 space-y-2">
                      <div className="text-[11px] font-semibold text-accent">Sugestões encontradas</div>
                      {suggestions.map((sug) => (
                        <div key={sug.id} className="p-2 rounded-lg bg-card border border-border space-y-1.5">
                          <div className="text-[11px] font-medium text-text line-clamp-2">{sug.title}</div>
                          <button
                            onClick={() => void approveSuggestion(sug)}
                            className="px-2 py-1 rounded bg-accent text-bg text-[10px] font-semibold"
                          >
                            Importar fonte
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOver(false)
                      void handleFileDrop(e.dataTransfer.files)
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border border-dashed p-4 text-center cursor-pointer transition-colors space-y-1 ${dragOver ? 'border-accent bg-accent/10' : 'border-border bg-card/40 hover:bg-card'
                      }`}
                  >
                    <IconUpload size={16} className="mx-auto text-text-muted" />
                    <div className="text-xs font-medium text-text">Adicionar arquivos</div>
                    <div className="text-[10px] text-text-muted">PDF, DOCX, XLSX, PPTX, TXT</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setAddLinkKind('url')
                        setAddLinkValue('')
                        setModal('add_link')
                      }}
                      className="h-8 px-2 rounded-lg border border-border bg-card text-[11px] text-text hover:bg-input flex items-center justify-center gap-1.5"
                    >
                      <IconGlobe size={12} />
                      <span>URL / YouTube</span>
                    </button>
                    <button
                      onClick={() => {
                        setAddLinkKind('text')
                        setAddLinkValue('')
                        setModal('add_link')
                      }}
                      className="h-8 px-2 rounded-lg border border-border bg-card text-[11px] text-text hover:bg-input flex items-center justify-center gap-1.5"
                    >
                      <IconFileText size={12} />
                      <span>Colar texto</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Painel Central: CHAT COM AS FONTES */}
              <section
                className={`mdocs-ws-center ${mobilePanel !== 'chat' ? 'mdocs-ws-hidden-mobile' : ''} ${mobilePanel === 'sources' ? 'mdocs-ws-hidden-windowed' : ''}`}
              >
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
                      <div className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center text-accent">
                        <IconSparkles size={20} />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-sm font-semibold text-text">Converse com as suas fontes</h2>
                        <p className="text-xs text-text-muted leading-relaxed">
                          Faça perguntas com citações rastreáveis ou escolha um formato no painel Estúdio ao lado para gerar seu documento.
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((m, idx) => (
                      <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${m.role === 'user'
                              ? 'bg-accent text-bg font-medium'
                              : 'bg-card text-text shadow-glass-sm'
                            }`}
                        >
                          {m.role === 'user' && m.attachments && m.attachments.length > 0 && (
                            <div className="mb-1.5 flex flex-wrap gap-1.5">
                              {m.attachments.map((att, aIdx) =>
                                att.isImage && att.base64 ? (
                                  <img
                                    key={aIdx}
                                    src={att.base64}
                                    alt={att.name}
                                    className="w-16 h-16 rounded-lg object-cover border border-white/20"
                                  />
                                ) : (
                                  <span key={aIdx} className="px-2 py-0.5 rounded-md bg-black/20 text-[10px]">
                                    📎 {att.name}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                          {m.streaming && !m.text ? (
                            <div className="flex items-center gap-1.5 py-1 text-text-muted">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0.15s' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0.3s' }} />
                            </div>
                          ) : m.role === 'assistant' ? (
                            <ChatMarkdown text={m.text} />
                          ) : (
                            <div className="whitespace-pre-wrap">{m.text}</div>
                          )}
                          {m.citations && m.citations.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-border/70 flex flex-wrap gap-1">
                              {m.citations.slice(0, 4).map((c, cIdx) => (
                                <span key={cIdx} className="px-2 py-0.5 rounded-md bg-input text-[10px] text-accent">
                                  {c.sourceTitle} ({c.locator})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="shrink-0 p-4 bg-bg space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Resumir as fontes', extra: false },
                        { label: 'Pontos principais', extra: false },
                        { label: 'Listar citações', extra: true }
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          onClick={() => void handleChatAsk(undefined, chip.label)}
                          className={`h-7 px-2.5 rounded-lg bg-input/70 text-[11px] text-text-muted hover:text-text hover:bg-input transition-colors ${chip.extra ? 'mdocs-chat-chip-extra' : ''}`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                    {chatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setChatMessages([])}
                        className="h-7 px-2.5 rounded-lg text-[11px] text-text-muted hover:text-text hover:bg-input/70 transition-colors shrink-0"
                        title="Limpar conversa e iniciar novo chat"
                      >
                        Novo chat
                      </button>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => void handleChatAsk(e)}
                    onDragOver={(e) => {
                      e.preventDefault()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (e.dataTransfer.files?.length) {
                        void addChatAttachmentsFromFiles(e.dataTransfer.files)
                      }
                    }}
                    className="rounded-2xl bg-card border border-border p-2.5 space-y-2 focus-within:border-accent"
                  >
                    {chatAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {chatAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-input text-[11px] text-text max-w-[180px]"
                          >
                            {att.isImage ? (
                              <img src={att.base64} alt={att.name} className="w-4 h-4 rounded object-cover shrink-0" />
                            ) : (
                              <span className="shrink-0">📄</span>
                            )}
                            <span className="truncate">{att.name}</span>
                            <button
                              type="button"
                              onClick={() => setChatAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                              className="text-text-muted hover:text-error shrink-0"
                              title="Remover anexo"
                            >
                              <IconX size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => chatAttachInputRef.current?.click()}
                        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-text-muted hover:text-text hover:bg-input transition-colors"
                        title="Anexar arquivos ou imagens"
                      >
                        <IconPaperclip size={15} />
                      </button>
                      <input
                        ref={chatAttachInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.docx,.pptx,.xlsx,.csv,.txt,.md"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            void addChatAttachmentsFromFiles(e.target.files)
                            e.target.value = ''
                          }
                        }}
                      />
                      <textarea
                        value={chatQuery}
                        onChange={(e) => setChatQuery(e.target.value)}
                        onPaste={(e) => {
                          const files = e.clipboardData?.files
                          if (files && files.length > 0) {
                            e.preventDefault()
                            void addChatAttachmentsFromFiles(files)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void handleChatAsk()
                          }
                        }}
                        rows={2}
                        placeholder="Pergunte às fontes do projeto..."
                        className="flex-1 bg-transparent resize-none text-xs text-text placeholder:text-text-muted focus:outline-none px-1 py-1"
                      />
                      <button
                        type="submit"
                        disabled={(!chatQuery.trim() && chatAttachments.length === 0) || Boolean(busyMessage)}
                        className="h-8 w-8 rounded-xl bg-accent text-bg flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40"
                        title="Enviar"
                      >
                        <IconSend size={14} />
                      </button>
                    </div>
                  </form>
                  <div className="text-[10px] text-text-muted text-center">
                    {busyMessage || 'As respostas usam apenas as fontes indexadas neste projeto.'}
                  </div>
                </div>
              </section>
                </div>
              </div>

              {/* Painel Direito: ESTÚDIO (Abas: Gerar | Documentos) */}
              <section
                className={`mdocs-ws-right ${mobilePanel !== 'studio' ? 'mdocs-ws-hidden-mobile' : ''}`}
              >
                <div className="p-2 grid grid-cols-2 gap-1 shrink-0">
                  <button
                    onClick={() => setStudioTab('generate')}
                    className={`h-8 rounded-lg text-xs font-medium transition-colors ${studioTab === 'generate' ? 'bg-card text-text shadow-glass-sm' : 'text-text-muted hover:text-text'
                      }`}
                  >
                    Gerar documento
                  </button>
                  <button
                    onClick={() => setStudioTab('docs')}
                    className={`h-8 rounded-lg text-xs font-medium transition-colors ${studioTab === 'docs' ? 'bg-card text-text shadow-glass-sm' : 'text-text-muted hover:text-text'
                      }`}
                  >
                    Documentos ({artifacts.length})
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {studioTab === 'generate' ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-text-muted block">Formato</label>
                        <select
                          value={selectedTool}
                          onChange={(e) => {
                            setSelectedTool(e.target.value)
                            setSelectedTemplate('')
                          }}
                          className="w-full h-9 px-2.5 rounded-xl bg-input text-xs text-text focus:outline-none"
                        >
                          {TOOL_CATALOG.map((tool) => (
                            <option key={tool.id} value={tool.id}>
                              {tool.label} ({tool.formats.join(', ').toUpperCase()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-text-muted block">Modelo / Estilo</label>
                        <select
                          value={selectedTemplate}
                          onChange={(e) => setSelectedTemplate(e.target.value)}
                          className="w-full h-9 px-2.5 rounded-xl bg-input text-xs text-text focus:outline-none"
                        >
                          <option value="">Padrão recomendado</option>
                          {toolTemplates.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {tpl.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedTool === 'letterhead' && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-text-muted block">Timbre base</label>
                          <input
                            type="file"
                            accept=".docx,.pdf,.png,.jpg,.jpeg"
                            onChange={async (e) => {
                              const f = e.target.files?.[0]
                              if (f) setLetterheadFile({ name: f.name, base64: await fileToBase64(f) })
                            }}
                            className="w-full text-[11px] text-text-muted"
                          />
                        </div>
                      )}

                      {selectedTool === 'podcast' && voices.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={voiceA}
                            onChange={(e) => setVoiceA(e.target.value)}
                            className="h-8 px-2 rounded-lg bg-input border border-border text-[11px] text-text"
                          >
                            <option value="">Voz A (Auto)</option>
                            {voices.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                          <select
                            value={voiceB}
                            onChange={(e) => setVoiceB(e.target.value)}
                            className="h-8 px-2 rounded-lg bg-input border border-border text-[11px] text-text"
                          >
                            <option value="">Voz B (Auto)</option>
                            {voices.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Cabeçalho e Rodapé em dropdowns separados (sem fundo branco / bordas suaves) */}
                      <div className="space-y-2">
                        {/* Dropdown Cabeçalho */}
                        <div className="rounded-xl bg-input/65 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setHeaderDropdownOpen((o) => !o)}
                            className="w-full h-9 px-3 flex items-center justify-between text-xs font-medium text-text hover:bg-input transition-colors"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span>Cabeçalho</span>
                              {(brandHeaderLogo || brandHeaderText.trim()) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                              )}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0">
                              {headerDropdownOpen ? '▲' : '▼'}
                            </span>
                          </button>
                          {headerDropdownOpen && (
                            <div
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault()
                                void addBrandImageFromFile(e.dataTransfer.files?.[0], 'header')
                              }}
                              className="px-3 pb-3 pt-1 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex-1 flex items-center gap-2 px-2.5 h-9 rounded-lg bg-card/70 text-[11px] text-text cursor-pointer hover:bg-card min-w-0 transition-colors">
                                  {brandHeaderLogo ? (
                                    <img src={brandHeaderLogo.base64} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                                  ) : null}
                                  <span className="truncate">
                                    {brandHeaderLogo ? brandHeaderLogo.name : '+ Enviar ou arrastar imagem'}
                                  </span>
                                  <input
                                    type="file"
                                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => void addBrandImageFromFile(e.target.files?.[0], 'header')}
                                  />
                                </label>
                                {sdk.has?.('clipboard.read') && !brandHeaderLogo && (
                                  <button
                                    type="button"
                                    onClick={() => void pasteBrandImageFromClipboard('header')}
                                    className="h-9 px-2 rounded-lg bg-card/70 text-[10px] text-text-muted hover:text-text shrink-0"
                                    title="Colar imagem da área de transferência"
                                  >
                                    Colar
                                  </button>
                                )}
                                {brandHeaderLogo && (
                                  <button
                                    type="button"
                                    onClick={() => setBrandHeaderLogo(null)}
                                    className="text-[10px] text-error hover:underline shrink-0"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                              <input
                                value={brandHeaderText}
                                onChange={(e) => setBrandHeaderText(e.target.value)}
                                placeholder="Texto do cabeçalho (opcional)"
                                className="w-full h-8 px-2.5 rounded-lg bg-card/70 text-[11px] text-text placeholder:text-text-muted focus:outline-none"
                              />
                              <div className="grid grid-cols-3 gap-1">
                                {[
                                  { id: 'left', label: 'Esquerda' },
                                  { id: 'center', label: 'Centralizado' },
                                  { id: 'right', label: 'Direita' }
                                ].map((al) => (
                                  <button
                                    key={al.id}
                                    type="button"
                                    onClick={() => setBrandHeaderAlign(al.id as 'left' | 'center' | 'right')}
                                    className={`h-7 rounded-lg text-[10px] font-medium transition-colors ${brandHeaderAlign === al.id
                                        ? 'bg-accent text-bg'
                                        : 'bg-input text-text-muted hover:text-text'
                                      }`}
                                  >
                                    {al.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Dropdown Rodapé */}
                        <div className="rounded-xl bg-input/65 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setFooterDropdownOpen((o) => !o)}
                            className="w-full h-9 px-3 flex items-center justify-between text-xs font-medium text-text hover:bg-input transition-colors"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span>Rodapé</span>
                              {(brandFooterLogo || brandFooterText.trim()) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                              )}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0">
                              {footerDropdownOpen ? '▲' : '▼'}
                            </span>
                          </button>
                          {footerDropdownOpen && (
                            <div
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault()
                                void addBrandImageFromFile(e.dataTransfer.files?.[0], 'footer')
                              }}
                              className="px-3 pb-3 pt-1 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex-1 flex items-center gap-2 px-2.5 h-9 rounded-lg bg-card/70 text-[11px] text-text cursor-pointer hover:bg-card min-w-0 transition-colors">
                                  {brandFooterLogo ? (
                                    <img src={brandFooterLogo.base64} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                                  ) : null}
                                  <span className="truncate">
                                    {brandFooterLogo ? brandFooterLogo.name : '+ Enviar ou arrastar imagem'}
                                  </span>
                                  <input
                                    type="file"
                                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => void addBrandImageFromFile(e.target.files?.[0], 'footer')}
                                  />
                                </label>
                                {sdk.has?.('clipboard.read') && !brandFooterLogo && (
                                  <button
                                    type="button"
                                    onClick={() => void pasteBrandImageFromClipboard('footer')}
                                    className="h-9 px-2 rounded-lg bg-card/70 text-[10px] text-text-muted hover:text-text shrink-0"
                                    title="Colar imagem da área de transferência"
                                  >
                                    Colar
                                  </button>
                                )}
                                {brandFooterLogo && (
                                  <button
                                    type="button"
                                    onClick={() => setBrandFooterLogo(null)}
                                    className="text-[10px] text-error hover:underline shrink-0"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                              {brandHeaderLogo && !brandFooterLogo && (
                                <button
                                  type="button"
                                  onClick={() => setBrandFooterLogo(brandHeaderLogo)}
                                  className="text-[10px] text-accent hover:underline"
                                >
                                  Usar mesma logo do cabeçalho
                                </button>
                              )}
                              <input
                                value={brandFooterText}
                                onChange={(e) => setBrandFooterText(e.target.value)}
                                placeholder="Texto do rodapé (opcional)"
                                className="w-full h-8 px-2.5 rounded-lg bg-card/70 text-[11px] text-text placeholder:text-text-muted focus:outline-none"
                              />
                              <div className="grid grid-cols-3 gap-1">
                                {[
                                  { id: 'left', label: 'Esquerda' },
                                  { id: 'center', label: 'Centralizado' },
                                  { id: 'right', label: 'Direita' }
                                ].map((al) => (
                                  <button
                                    key={al.id}
                                    type="button"
                                    onClick={() => setBrandFooterAlign(al.id as 'left' | 'center' | 'right')}
                                    className={`h-7 rounded-lg text-[10px] font-medium transition-colors ${brandFooterAlign === al.id
                                        ? 'bg-accent text-bg'
                                        : 'bg-input text-text-muted hover:text-text'
                                      }`}
                                  >
                                    {al.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-text-muted block">Modelo de IA</label>
                        <select
                          value={selectedLlmModel}
                          onChange={(e) => setSelectedLlmModel(e.target.value)}
                          className="w-full h-9 pl-2.5 pr-6 rounded-xl bg-input text-xs text-text truncate focus:outline-none"
                        >
                          <option value="">
                            {capabilities?.model
                              ? `Padrão (${String(capabilities.model).length > 22 ? String(capabilities.model).slice(0, 21) + '…' : capabilities.model})`
                              : 'Padrão do chat'}
                          </option>
                          {llmProviders.map((p) => (
                            <optgroup key={p.id} label={p.name || p.id}>
                              {p.models.map((m) => (
                                <option key={`${p.id}::${m.id}`} value={`${p.id}::${m.id}`}>
                                  {m.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-text-muted block">Instruções</label>
                        <textarea
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          rows={4}
                          placeholder="Ex: Direcionar ao diretor de obras, tom formal, incluir prazo de 15 dias..."
                          className="w-full p-2.5 rounded-xl bg-input text-xs text-text placeholder:text-text-muted focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={() => void handleGenerate()}
                        disabled={Boolean(busyMessage)}
                        className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <IconSparkles size={14} />
                        <span>Gerar documento</span>
                      </button>
                    </div>
                  ) : artifacts.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-xs font-medium text-text">Nenhum documento gerado ainda</div>
                      <div className="text-[11px] text-text-muted">
                        Use a aba “Gerar documento” para criar o primeiro arquivo deste projeto.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {artifacts.map((art) => (
                        <button
                          key={art.id}
                          onClick={() => {
                            setActiveArtifact(art)
                            setPreviewPageIdx(0)
                            setExportTab('export')
                            setView('export')
                          }}
                          className="w-full text-left p-3 rounded-xl bg-card hover:bg-input flex items-center justify-between gap-2.5 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-input border border-border flex items-center justify-center text-accent shrink-0">
                              <IconFileText size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-text truncate">{art.title}</div>
                              <div className="text-[10px] text-text-muted uppercase">
                                v{art.currentVersion || 1} · {Object.keys(art.exportFiles || {}).join(' · ') || 'DOCX'}
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-input text-[11px] font-medium text-text shrink-0">
                            Abrir
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── TELA 05: GERANDO AO VIVO ──────────────────────────────────────────── */}
        {view === 'generating' && (
          <main className="mdocs-scroll">
            <div className="mdocs-container">
              <div className="mdocs-split-2">
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wider text-text-muted text-[10px]">
                        Etapa {genStep + 1} de {GENERATING_STEPS.length}
                      </span>
                      <span className="font-semibold text-text tabular-nums">
                        {Math.round(((genStep + 1) / GENERATING_STEPS.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-input overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-500"
                        style={{ width: `${Math.round(((genStep + 1) / GENERATING_STEPS.length) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-text-muted">{busyMessage || 'Processando...'}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                    {GENERATING_STEPS.map((label, idx) => {
                      const done = idx < genStep
                      const current = idx === genStep
                      return (
                        <div key={label} className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done
                                  ? 'bg-success/15 text-success'
                                  : current
                                    ? 'bg-accent/15 text-accent border border-accent'
                                    : 'bg-input border border-border text-transparent'
                                }`}
                            >
                              {done ? <IconCheck size={11} /> : current ? <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" /> : null}
                            </div>
                            <span className={current || done ? 'text-text font-medium' : 'text-text-muted'}>
                              {label}
                            </span>
                          </div>
                          <span className="text-[10px] text-text-muted">
                            {done ? 'concluído' : current ? 'em andamento' : 'aguardando'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => {
                      genAbortRef.current = true
                      setBusyMessage(null)
                      setView('workspace')
                    }}
                    className="w-full h-9 rounded-xl border border-border bg-card text-xs font-medium text-text hover:bg-input"
                  >
                    Cancelar geração
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-sidebar flex flex-col items-center justify-center min-h-[420px] space-y-4">
                  <div className="w-full max-w-xs flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    <span>Prévia ao vivo</span>
                    <span className="flex items-center gap-1.5 text-accent">
                      <span className="mdocs-emoji">{activeToolSpec.emoji}</span>
                      <span>{activeToolSpec.label}</span>
                    </span>
                  </div>

                  {/* Live Animated Document Assembly Sheet */}
                  <div
                    className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-glass-md p-6 flex flex-col justify-between"
                    style={{ width: 272, height: 352 }}
                  >
                    <div className="mdocs-scan-beam" />

                    <div className="space-y-4 relative z-10">
                      {/* Header / Timbre crystallizes at Step 0+ */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/70">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg mdocs-tint-blue flex items-center justify-center text-sm mdocs-emoji shrink-0">
                            {activeToolSpec.emoji}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="text-[11px] font-semibold text-text truncate">
                              {activeProject?.name || activeToolSpec.label}
                            </div>
                            <div className="text-[9px] text-text-muted">
                              {genStep >= 2 ? 'Normas e margens aplicadas' : 'Montando estrutura...'}
                            </div>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-input text-[9px] font-medium uppercase text-text-muted shrink-0">
                          {activeToolSpec.formats[0]}
                        </span>
                      </div>

                      {/* Title & Active Writing Lines */}
                      <div className="space-y-2.5">
                        <div className="h-2.5 w-3/4 rounded-full bg-text/30 transition-all duration-500" />
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-1/2 rounded-full bg-accent/45" />
                          <span className="mdocs-caret" />
                        </div>
                      </div>

                      {/* Staggered Animated Writing Paragraph */}
                      <div className="space-y-2 pt-1">
                        <div className="mdocs-write-line" style={{ animationDelay: '0s' }} />
                        <div className="mdocs-write-line" style={{ animationDelay: '0.25s' }} />
                        <div className="mdocs-write-line" style={{ animationDelay: '0.5s' }} />
                        <div className="mdocs-write-line" style={{ animationDelay: '0.75s' }} />
                      </div>

                      {/* Structured Block (table / slide / summary) appears cleanly as steps advance */}
                      <div
                        className={`p-2.5 rounded-xl bg-input/70 border border-border/60 space-y-1.5 transition-all duration-500 ${genStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-1'
                          }`}
                      >
                        <div className="flex items-center justify-between text-[9px] text-text-muted">
                          <span>{genStep >= 3 ? 'Conteúdo redigido' : 'Sintetizando dados'}</span>
                          <span className="tabular-nums text-accent font-medium">
                            {Math.round(((genStep + 1) / GENERATING_STEPS.length) * 100)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="h-4 rounded bg-card" />
                          <div className="h-4 rounded bg-card" />
                          <div className="h-4 rounded bg-card" />
                        </div>
                      </div>
                    </div>

                    {/* Footer & Quality Seal */}
                    <div className="relative z-10 flex items-center justify-between pt-3 border-t border-border/60 text-[10px] text-text-muted">
                      <span>{sources.length > 0 ? `${sources.length} fontes` : 'Base: instruções'}</span>
                      <span className={genStep >= 4 ? 'text-success font-medium' : 'text-text-muted'}>
                        {genStep >= 4 ? '✓ Revisão final' : GENERATING_STEPS[genStep]?.split(' ')[0] + '...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ── TELA 06: PRÉVIA & EXPORTAR ────────────────────────────────────────── */}
        {view === 'export' && activeArtifact && (
          <div className="mdocs-export-grid">
            <section className="bg-sidebar border-r border-border overflow-y-auto p-6 flex flex-col items-center gap-4">
              <div className="w-full max-w-3xl space-y-3">
                {Array.isArray(activeArtifact.previewSvgs) && activeArtifact.previewSvgs.length > 0 ? (
                  <div
                    className="rounded-xl overflow-hidden border border-border bg-card shadow-glass-md"
                    dangerouslySetInnerHTML={{
                      __html: activeArtifact.previewSvgs[previewPageIdx] || activeArtifact.previewSvgs[0]
                    }}
                  />
                ) : Array.isArray(activeArtifact.structuredData?.sheets) && activeArtifact.structuredData.sheets.length > 0 ? (
                  (() => {
                    const sheets = activeArtifact.structuredData.sheets
                    const sheet = sheets[previewPageIdx] || sheets[0]
                    const headers: string[] = Array.isArray(sheet?.headers) ? sheet.headers : []
                    const rows: any[][] = Array.isArray(sheet?.rows) ? sheet.rows : []
                    const colCount = Math.max(headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)), 1)
                    const colLetter = (i: number) => String.fromCharCode(65 + (i % 26))
                    return (
                      <div className="rounded-xl bg-card border border-border shadow-glass-md overflow-hidden">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap bg-bg">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="mdocs-emoji text-base">📈</span>
                            <span className="text-xs font-semibold text-text truncate">
                              {activeArtifact.structuredData.workbookTitle || activeArtifact.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {sheets.map((sh: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => setPreviewPageIdx(idx)}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors ${(previewPageIdx < sheets.length ? previewPageIdx : 0) === idx
                                    ? 'bg-accent text-bg'
                                    : 'bg-input text-text-muted hover:text-text'
                                  }`}
                              >
                                {sh.name || `Aba ${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-input/80 text-text-muted">
                                <th className="w-10 px-2 py-1.5 border-b border-r border-border text-center text-[10px] font-medium">#</th>
                                {Array.from({ length: colCount }).map((_, cIdx) => (
                                  <th
                                    key={cIdx}
                                    className="px-3 py-1.5 border-b border-r border-border text-center text-[10px] font-semibold"
                                  >
                                    {colLetter(cIdx)}
                                  </th>
                                ))}
                              </tr>
                              {headers.length > 0 && (
                                <tr className="bg-accent/10 text-text font-semibold">
                                  <td className="px-2 py-2 border-b border-r border-border text-center text-[10px] text-text-muted">1</td>
                                  {Array.from({ length: colCount }).map((_, cIdx) => (
                                    <td key={cIdx} className="px-3 py-2 border-b border-r border-border whitespace-nowrap">
                                      {headers[cIdx] ?? ''}
                                    </td>
                                  ))}
                                </tr>
                              )}
                            </thead>
                            <tbody>
                              {rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-input/50 transition-colors">
                                  <td className="px-2 py-2 border-b border-r border-border text-center text-[10px] text-text-muted bg-input/40 tabular-nums">
                                    {headers.length > 0 ? rIdx + 2 : rIdx + 1}
                                  </td>
                                  {Array.from({ length: colCount }).map((_, cIdx) => (
                                    <td key={cIdx} className="px-3 py-2 border-b border-r border-border text-text align-top">
                                      {row?.[cIdx] !== undefined && row?.[cIdx] !== null ? String(row[cIdx]) : ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()
                ) : Array.isArray(activeArtifact.structuredData?.cards) ? (
                  <div className="space-y-2.5">
                    {activeArtifact.structuredData.cards.map((c: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-xl bg-card shadow-glass-sm space-y-1.5">
                        <div className="text-xs font-semibold text-text">
                          {idx + 1}. {c.front || c.question}
                        </div>
                        <div className="text-xs text-text-muted">{c.back || c.answer}</div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(activeArtifact.structuredData?.turns) ? (
                  <div className="p-5 rounded-xl bg-card shadow-glass-md space-y-3">
                    {activeArtifact.structuredData.turns.map((turn: any, idx: number) => (
                      <div key={idx} className="text-xs space-y-0.5">
                        <span className="font-semibold text-accent">{turn.speaker}: </span>
                        <span className="text-text">{turn.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="p-5 rounded-xl bg-card border border-border text-xs text-text whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(activeArtifact.structuredData, null, 2)}
                  </pre>
                )}

                {Array.isArray(activeArtifact.previewSvgs) && activeArtifact.previewSvgs.length > 1 && (
                  <div className="flex items-center justify-center gap-3 text-xs text-text-muted">
                    <button
                      disabled={previewPageIdx <= 0}
                      onClick={() => setPreviewPageIdx((i) => Math.max(0, i - 1))}
                      className="h-7 px-3 rounded-lg border border-border bg-card text-text disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span className="tabular-nums">
                      Página {previewPageIdx + 1} de {activeArtifact.previewSvgs.length}
                    </span>
                    <button
                      disabled={previewPageIdx >= activeArtifact.previewSvgs.length - 1}
                      onClick={() =>
                        setPreviewPageIdx((i) => Math.min(activeArtifact.previewSvgs.length - 1, i + 1))
                      }
                      className="h-7 px-3 rounded-lg border border-border bg-card text-text disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-bg overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-input border border-border">
                {[
                  { id: 'preview', label: 'Prévia' },
                  { id: 'edit', label: 'Editar' },
                  { id: 'export', label: 'Exportar' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setExportTab(tab.id as any)}
                    className={`h-7 rounded-lg text-xs font-medium transition-colors ${exportTab === tab.id ? 'bg-card text-text' : 'text-text-muted hover:text-text'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {exportTab === 'export' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(activeArtifact.exportFiles || { docx: true, pdf: true }).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => void handleExport(fmt)}
                        className="p-3.5 rounded-xl bg-card border border-border hover:border-accent/60 text-left flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-input border border-border flex items-center justify-center text-accent shrink-0">
                          <IconDownload size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-text uppercase">{fmt}</div>
                          <div className="text-[10px] text-text-muted">Baixar</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {Object.keys(activeArtifact.exportFiles || {})[0] && (
                    <button
                      onClick={() => void handleExport(Object.keys(activeArtifact.exportFiles)[0])}
                      className="w-full h-10 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-2"
                    >
                      <IconDownload size={14} />
                      <span>Baixar {Object.keys(activeArtifact.exportFiles)[0].toUpperCase()}</span>
                    </button>
                  )}

                  <div className="pt-4 border-t border-border space-y-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Opções de exportação
                    </div>
                    {[
                      { key: 'coverAndToc', label: 'Incluir capa e sumário' },
                      { key: 'applyLetterhead', label: 'Aplicar timbre da instituição' },
                      { key: 'aiReviewedBadge', label: 'Marcar como revisado pela IA' }
                    ].map((opt) => {
                      const checked = exportOptions[opt.key as keyof typeof exportOptions]
                      return (
                        <button
                          key={opt.key}
                          onClick={() =>
                            setExportOptions((prev) => ({
                              ...prev,
                              [opt.key]: !prev[opt.key as keyof typeof exportOptions]
                            }))
                          }
                          className="w-full flex items-center gap-2.5 text-xs text-text py-1"
                        >
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border ${checked ? 'bg-accent border-accent text-bg' : 'bg-input border-border text-transparent'
                              }`}
                          >
                            <IconCheck size={10} />
                          </span>
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {exportTab === 'edit' && (
                <div className="space-y-4">
                  <textarea
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    rows={4}
                    placeholder="Ex: Deixe o tom mais formal, resuma a conclusão em 3 pontos..."
                    className="w-full p-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                  />
                  <button
                    onClick={() => void handleRefine()}
                    disabled={!refineText.trim() || Boolean(busyMessage)}
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {busyMessage ? 'Refinando...' : 'Aplicar revisão'}
                  </button>
                </div>
              )}

              {exportTab === 'preview' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Status de qualidade</span>
                      <span className="text-success font-medium">
                        {activeArtifact.qaReport?.repairsApplied > 0 ? t('qaRepaired') : t('qaPassed')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Versão atual</span>
                      <span className="text-text font-medium">v{activeArtifact.currentVersion || 1}</span>
                    </div>
                  </div>
                  {Array.isArray(activeArtifact.citations) && activeArtifact.citations.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        Citações rastreáveis
                      </div>
                      {activeArtifact.citations.slice(0, 8).map((c: any, idx: number) => (
                        <div key={idx} className="text-xs text-text">
                          • <span className="font-medium text-accent">{c.sourceTitle}</span>{' '}
                          <span className="text-text-muted">({c.locator})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

      </div>
      {/* Overlays portaled to sdk.ui.overlayRoot() */}
      {modal !== 'none' &&
        createPortal(
          <div className="absolute inset-0 z-50 pointer-events-auto bg-bg/75 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4 shadow-glass-md max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">
                  {modal === 'new_project' && 'Novo projeto'}
                  {modal === 'rename_project' && 'Editar título do projeto'}
                  {modal === 'discover' && 'Descobrir fontes confiáveis'}
                  {modal === 'add_link' && (addLinkKind === 'text' ? 'Colar texto como fonte' : 'Adicionar URL ou YouTube')}
                  {modal === 'queue' && 'Fila de tarefas'}
                  {modal === 'brand' && 'Timbre e identidade visual'}
                  {modal === 'credits' && 'Licenças e créditos'}
                  {modal === 'diagnostics' && 'Diagnóstico do ambiente'}
                </h3>
                <button onClick={() => setModal('none')} className="text-text-muted hover:text-text">
                  <IconX size={15} />
                </button>
              </div>

              {modal === 'rename_project' && renameProjectTarget && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const next = renameProjectTarget.name.trim()
                    if (!next) return
                    const targetId = renameProjectTarget.id
                    setModal('none')
                    setRenameProjectTarget(null)
                    await saveProjectTitle(targetId, next)
                  }}
                  className="space-y-3"
                >
                  <input
                    autoFocus
                    value={renameProjectTarget.name}
                    onChange={(e) => setRenameProjectTarget((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                    placeholder="Novo título do projeto"
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    Salvar título
                  </button>
                </form>
              )}

              {modal === 'new_project' && (
                <form onSubmit={handleCreateProject} className="space-y-3">
                  <input
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="Nome do projeto (ex: Ofício prefeitura)"
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                    required
                  />
                  <select
                    value={newProjProfile}
                    onChange={(e) => setNewProjProfile(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text"
                  >
                    <option value="general">Perfil Geral</option>
                    <option value="student">Estudante (ABNT, Flashcards)</option>
                    <option value="teacher">Professor (Apostilas, Planos de Aula)</option>
                    <option value="lawyer">Advogado (Ofícios, Timbrados)</option>
                    <option value="public_servant">Servidor Público (Redação Oficial)</option>
                    <option value="executive">Executivo (PPTX, Relatórios, Podcast)</option>
                  </select>
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    Criar projeto
                  </button>
                </form>
              )}

              {modal === 'add_link' && (
                <form onSubmit={handleAddLinkSubmit} className="space-y-3">
                  {addLinkKind === 'text' ? (
                    <textarea
                      value={addLinkValue}
                      onChange={(e) => setAddLinkValue(e.target.value)}
                      rows={5}
                      placeholder="Cole aqui o texto de referência..."
                      className="w-full p-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                      required
                    />
                  ) : (
                    <input
                      value={addLinkValue}
                      onChange={(e) => setAddLinkValue(e.target.value)}
                      placeholder="https://..."
                      className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                      required
                    />
                  )}
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    Adicionar fonte
                  </button>
                </form>
              )}

              {modal === 'discover' && (
                <form
                  onSubmit={(e) => {
                    setModal('none')
                    void handleDiscoverSources(e)
                  }}
                  className="space-y-3"
                >
                  <input
                    value={discoverQuery}
                    onChange={(e) => setDiscoverQuery(e.target.value)}
                    placeholder="Tema para buscar artigos e referências..."
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    Buscar sugestões
                  </button>
                </form>
              )}

              {modal === 'brand' && (
                <div className="space-y-3 text-xs">
                  <p className="text-text-muted">
                    Envie um documento ou imagem com o timbre da sua instituição para aplicar nos próximos ofícios e relatórios.
                  </p>
                  <input
                    type="file"
                    accept=".docx,.pdf,.png,.jpg,.jpeg"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f) setLetterheadFile({ name: f.name, base64: await fileToBase64(f) })
                    }}
                    className="w-full text-xs text-text-muted"
                  />
                  {letterheadFile && (
                    <div className="p-2.5 rounded-xl bg-input border border-border text-text">
                      Timbre carregado: <span className="font-medium">{letterheadFile.name}</span>
                    </div>
                  )}
                  {brandKit && (
                    <pre className="p-2.5 rounded-xl bg-input border border-border text-[11px] text-text-muted overflow-x-auto">
                      {JSON.stringify(brandKit, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {modal === 'queue' && (
                <div className="space-y-2 text-xs">
                  {jobs.length === 0 ? (
                    <p className="text-text-muted">Nenhuma tarefa em segundo plano registrada.</p>
                  ) : (
                    jobs.map((j) => (
                      <div
                        key={j.jobId}
                        className="p-3 rounded-xl bg-input border border-border flex justify-between items-center gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-text truncate">{j.label || j.tool}</div>
                          <div className="text-[11px] text-text-muted">
                            {j.status} · {j.stage || ''}
                          </div>
                        </div>
                        {(j.status === 'queued' || j.status === 'running') && (
                          <button
                            onClick={() => void sdk.jobs?.cancel?.(j.jobId)}
                            className="px-2.5 py-1 rounded-lg border border-border text-error text-[11px] shrink-0"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {modal === 'credits' && (
                <div className="space-y-2 text-xs text-text">
                  <p className="text-text-muted">
                    Todos os templates, fontes tipográficas e ícones permitem uso comercial:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-text-muted">
                    <li>Fontes: Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)</li>
                    <li>Ícones: SVG internos inspirados em Lucide (ISC)</li>
                    <li>Templates MomAI Docs: MIT (referência estrutural abnTeX2 LPPL 1.3c na ABNT)</li>
                    <li>Bibliotecas: docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)</li>
                  </ul>
                </div>
              )}

              {modal === 'diagnostics' && (
                <div className="space-y-3 text-xs">
                  <pre className="p-3 rounded-xl bg-input border border-border overflow-x-auto text-[11px] text-text">
                    {JSON.stringify(diagnostics, null, 2)}
                  </pre>
                  <button
                    onClick={() => void sdk.clipboard?.writeText?.(JSON.stringify(diagnostics, null, 2))}
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    Copiar diagnóstico
                  </button>
                </div>
              )}
            </div>
          </div>,
          overlayTarget
        )}

      {projectContextMenu && (
        <ContextMenu
          x={projectContextMenu.x}
          y={projectContextMenu.y}
          onClose={() => setProjectContextMenu(null)}
          disableAutoAugment
          items={[
            {
              id: 'rename',
              label: 'Editar título',
              onClick: () => {
                setRenameProjectTarget({
                  id: projectContextMenu.project.id,
                  name: projectContextMenu.project.name || ''
                })
                setModal('rename_project')
              }
            },
            {
              id: 'pin',
              label: projectContextMenu.project.pinned ? 'Desafixar do topo' : 'Fixar no topo',
              onClick: () => {
                void handleTogglePinProject(projectContextMenu.project)
              }
            },
            { divider: true },
            {
              id: 'delete',
              label: 'Excluir',
              danger: true,
              onClick: () => {
                void handleDeleteProject(projectContextMenu.project.id)
              }
            }
          ]}
        />
      )}
    </div>
  )
}
