import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import sdk, { ContextMenu } from 'momai:sdk'
import { resolveLocale, translate, type DocsLocale } from './ui/i18n'
import { DOCS_LAYOUT_CSS } from './ui/shared/docs-layout-css'
import { ModelCard } from './ui/shared/ModelCard'
import { StyleCarouselSelector } from './ui/shared/StyleCarouselSelector'
import { buildTemplatePreviewPages } from './ui/shared/template-preview-svg'
import {
  getToolSizeConfig,
  PROFILE_EMOJIS,
  PROFILE_LABELS,
  resolveTargetSizeHint,
  TOOL_CATALOG as TOOL_CATALOG_BASE,
  type ToolSpec
} from './ui/shared/tool-catalog'
import { ChatMarkdown } from './ui/ChatMarkdown'
import { AutocompleteTextarea, useAutocomplete } from './ui/useAutocomplete'
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
  IconMoreVertical,
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
type ModalKind = 'none' | 'queue' | 'brand' | 'credits' | 'diagnostics' | 'new_project' | 'rename_project' | 'discover' | 'add_link' | 'generate_config'

function generatingSteps(t: (text: string) => string): string[] {
  return [
    t('Lendo arquivos e fontes do projeto'),
    t('Extraindo trechos e citações-chave'),
    t('Aplicando normas e estrutura do modelo'),
    t('Redigindo o documento completo'),
    t('Revisando formatação e prévia visual')
  ]
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(translate(resolveLocale(sdk.i18n?.getLocale?.()), 'Falha ao ler arquivo')))
    reader.readAsDataURL(file)
  })
}

function formatRelativeDate(
  ts: number | string | undefined,
  locale: DocsLocale,
  t: (text: string, vars?: Record<string, string | number>) => string
): string {
  if (!ts) return t('agora')
  const d = typeof ts === 'number' ? ts : Date.parse(ts)
  if (!Number.isFinite(d)) return t('recente')
  const diffMin = Math.max(0, Math.round((Date.now() - d) / 60000))
  if (diffMin < 2) return t('agora')
  if (diffMin < 60) return t('há {n} min', { n: diffMin })
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return t('há {n} h', { n: diffH })
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return t('ontem')
  if (diffD < 7) return t('há {n} d', { n: diffD })
  return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
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
  const [modelSearch, setModelSearch] = useState<string>('')
  const [selectedTool, setSelectedTool] = useState<string>('report')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [studioTab, setStudioTab] = useState<'generate' | 'docs'>('generate')
  const [showAllStudioTools, setShowAllStudioTools] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarRecentLimit, setSidebarRecentLimit] = useState(8)
  const [sidebarSelectMode, setSidebarSelectMode] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [mobilePanel, setMobilePanel] = useState<'sources' | 'chat' | 'studio'>('chat')
  const [exportTab, setExportTab] = useState<'preview' | 'edit' | 'export'>('export')
  const [exportOptions, setExportOptions] = useState({
    coverAndToc: true,
    applyLetterhead: true,
    aiReviewedBadge: false
  })

  // Inputs & chat
  const [instructions, setInstructions] = useState('')
  const [targetSize, setTargetSize] = useState<string>('auto')
  const [refineText, setRefineText] = useState('')
  const [refineTargetSize, setRefineTargetSize] = useState<string>('auto')

  useEffect(() => {
    setTargetSize('auto')
  }, [selectedTool])

  useEffect(() => {
    setRefineTargetSize('auto')
  }, [activeArtifact?.id])
  const [chatQuery, setChatQuery] = useState('')
  const { addToHistory, syncFromMessages } = useAutocomplete()
  const [chatAttachments, setChatAttachments] = useState<
    Array<{ id: string; name: string; mimeType: string; base64: string; isImage: boolean }>
  >([])
  const [chatMessages, setChatMessages] = useState<
    Array<{ id?: string; role: 'user' | 'assistant'; text: string; citations?: any[]; streaming?: boolean; stopped?: boolean; query?: string; attachments?: Array<{ name: string; isImage: boolean; base64?: string }> }>
  >([])
  useEffect(() => {
    syncFromMessages(chatMessages)
  }, [chatMessages, syncFromMessages])
  const [dragOver, setDragOver] = useState(false)
  const [configStep, setConfigStep] = useState<'sources' | 'config'>('config')
  const [inlineSourceUrl, setInlineSourceUrl] = useState('')
  const [inlineSourceText, setInlineSourceText] = useState('')
  const [inlineSourceMode, setInlineSourceMode] = useState<'none' | 'url' | 'text' | 'discover'>('none')

  // Host & system state
  const [capabilities, setCapabilities] = useState<any>(() => initialCache?.capabilities || null)
  const [llmProviders, setLlmProviders] = useState<
    Array<{ id: string; name: string; models: Array<{ id: string; label: string }> }>
  >(() => initialCache?.llmProviders || [])
  const [selectedLlmModel, setSelectedLlmModel] = useState<string>('')
  const [jobs, setJobs] = useState<any[]>([])
  const [generatingItems, setGeneratingItems] = useState<
    Array<{
      id: string
      projectId: string
      toolId: string
      label: string
      emoji: string
      status: 'running' | 'stopped'
      percent?: number
      stageDetail?: string
      payload: Record<string, any>
    }>
  >([])
  const cancelledGenIdsRef = useRef<Set<string>>(new Set())
  const stoppedChatIdsRef = useRef<Set<string>>(new Set())
  const [unseenArtifactIds, setUnseenArtifactIds] = useState<string[]>([])
  const [loading, setLoading] = useState(() => !initialCache)
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const [genStep, setGenStep] = useState(0)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalKind>('none')

  // Modal & context menu fields
  const [projectContextMenu, setProjectContextMenu] = useState<{ x: number; y: number; project: any } | null>(null)
  const [artifactContextMenu, setArtifactContextMenu] = useState<{ x: number; y: number; artifact: any } | null>(null)
  const [renameArtifactTarget, setRenameArtifactTarget] = useState<{ id: string; title: string } | null>(null)
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
  const [docAttachments, setDocAttachments] = useState<Array<{ id: string; name: string; base64: string }>>([])
  const [brandHeaderText, setBrandHeaderText] = useState('')
  const [brandFooterText, setBrandFooterText] = useState('')
  const [brandHeaderAlign, setBrandHeaderAlign] = useState<'left' | 'center' | 'right'>('right')
  const [brandFooterAlign, setBrandFooterAlign] = useState<'left' | 'center' | 'right'>('right')
  const [headerDropdownOpen, setHeaderDropdownOpen] = useState(false)
  const [footerDropdownOpen, setFooterDropdownOpen] = useState(false)
  const [logoDropdownOpen, setLogoDropdownOpen] = useState(false)
  const [logoSearchQuery, setLogoSearchQuery] = useState('')
  const [logoSearchResults, setLogoSearchResults] = useState<Array<{ title: string; dataUrl: string }>>([])
  const [logoSearching, setLogoSearching] = useState(false)
  const [logoTarget, setLogoTarget] = useState<'header' | 'footer'>('header')
  const [brandKit, setBrandKit] = useState<any>(null)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [voices, setVoices] = useState<any[]>(() => initialCache?.voices || [])
  const [voiceA, setVoiceA] = useState('')
  const [voiceB, setVoiceB] = useState('')
  const [speakerCount, setSpeakerCount] = useState<1 | 2>(1)
  const [includeSubtitles, setIncludeSubtitles] = useState(false)

  useEffect(() => {
    setSpeakerCount(selectedTool === 'podcast' ? 2 : 1)
  }, [selectedTool])
  const [previewPageIdx, setPreviewPageIdx] = useState(0)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const chatAttachInputRef = useRef<HTMLInputElement | null>(null)
  const genAbortRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setVideoPlaying(false)
    if (!activeArtifact || activeArtifact.toolId !== 'video' || !activeArtifact.exportFiles?.mp4) {
      setVideoPreviewUrl(null)
      setVideoLoading(false)
      return
    }
    let cancelled = false
    let createdUrl: string | null = null
    setVideoLoading(true)
    void sdk.api
      .post(`/extensions/${EXT_ID}/export`, {
        artifactId: activeArtifact.id,
        format: 'mp4'
      })
      .then((res: any) => {
        if (cancelled) return
        if (res?.data?.ok && res.data?.base64) {
          const bin = atob(res.data.base64)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          const blob = new Blob([bytes], { type: 'video/mp4' })
          createdUrl = URL.createObjectURL(blob)
          setVideoPreviewUrl(createdUrl)
        } else {
          setVideoPreviewUrl(null)
        }
      })
      .catch(() => {
        if (!cancelled) setVideoPreviewUrl(null)
      })
      .finally(() => {
        if (!cancelled) setVideoLoading(false)
      })
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [activeArtifact?.id, activeArtifact?.currentVersion, activeArtifact?.exportFiles?.mp4])

  const t = (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars)
  const GENERATING_STEPS = useMemo(() => generatingSteps(t), [locale])
  const TOOL_CATALOG = useMemo(
    () =>
      TOOL_CATALOG_BASE.map((tool) => ({
        ...tool,
        label: t(tool.label),
        description: t(tool.description),
        specLine: t(tool.specLine)
      })),
    [locale]
  )

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
      const fetchProjectsWithRetry = async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const res = await sdk.api.get(`/extensions/${EXT_ID}/projects`)
          if (res?.ok && Array.isArray(res.data?.projects)) return res.data.projects as any[]
          if (attempt < 3) await new Promise((r) => setTimeout(r, 1200))
        }
        return null
      }

      const [loadedProjects, tplRes] = await Promise.all([
        fetchProjectsWithRetry(),
        sdk.api.get(`/extensions/${EXT_ID}/templates`)
      ])
      if (loadedProjects) {
        setProjects(loadedProjects)
        writeBootstrapCache({ projects: loadedProjects })
      }
      const loadedTemplates = tplRes?.ok && Array.isArray(tplRes.data?.templates) ? tplRes.data.templates : undefined
      if (loadedTemplates) {
        setTemplates(loadedTemplates)
        writeBootstrapCache({ templates: loadedTemplates })
      }

      // Resume active generation if user navigated away and came back
      if (loadedProjects) {
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
      }
    } catch (err: any) {
      if (!initialCache) setErrorBanner(err?.message || t('Erro ao inicializar MomAI Docs'))
    } finally {
      setLoading(false)
    }
  }

  function pollGenerationUntilDone(projectId: string, toolId: string) {
    setSelectedTool(toolId)
    setView('generating')
    setBusyMessage(`${t('Gerando...')} (${toolId})`)
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
    const _ts = Date.now()
    const [srcRes, artRes, bkRes] = await Promise.all([
      sdk.api.get(`/extensions/${EXT_ID}/sources`, { projectId, _ts }),
      sdk.api.get(`/extensions/${EXT_ID}/artifacts`, { projectId, _ts }),
      sdk.api.get(`/extensions/${EXT_ID}/brand-kits`, { projectId, _ts })
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
    const chatKey = `chat_${String(proj.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`
    const [savedChat] = await Promise.all([
      sdk.storage?.get?.(chatKey).catch(() => null),
      loadProjectData(proj.id)
    ])
    if (Array.isArray(savedChat) && savedChat.length > 0) {
      setChatMessages(savedChat)
    }
  }

  async function createInstantProject(initialName = t('Projeto sem título'), profile = 'general') {
    setBusyMessage(t('Criando projeto...'))
    const res = await sdk.api.post(`/extensions/${EXT_ID}/projects`, {
      action: 'create',
      name: initialName,
      profile,
      locale
    })
    setBusyMessage(null)
    if (res?.ok && res.data?.project) {
      setProjects((prev) => {
        const next = [res.data.project, ...prev.filter((p) => p.id !== res.data.project.id)]
        writeBootstrapCache({ projects: next })
        return next
      })
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
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === projectId ? res.data.project : p))
        writeBootstrapCache({ projects: next })
        return next
      })
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
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === proj.id ? res.data.project : p))
        writeBootstrapCache({ projects: next })
        return next
      })
    }
  }

  function openProjectContextMenu(e: React.MouseEvent, proj: any) {
    e.preventDefault()
    e.stopPropagation()
    setProjectContextMenu({ x: e.clientX, y: e.clientY, project: proj })
  }

  function openArtifactContextMenu(e: React.MouseEvent, art: any) {
    e.preventDefault()
    e.stopPropagation()
    setArtifactContextMenu({ x: e.clientX, y: e.clientY, artifact: art })
  }

  function openArtifactItem(art: any) {
    if (unseenArtifactIds.includes(art.id)) {
      setUnseenArtifactIds((prev) => prev.filter((id) => id !== art.id))
    }
    void sdk.badge?.clear?.(EXT_ID)
    setActiveArtifact(art)
    setPreviewPageIdx(0)
    setExportTab('export')
    setView('export')
  }

  async function handleDownloadArtifact(art: any) {
    const formats = Object.keys(art.exportFiles || {})
    const primaryFormat = formats[0] || 'pdf'
    setBusyMessage(t('Exportando {format}...', { format: primaryFormat.toUpperCase() }))
    const res = await sdk.api.post(`/extensions/${EXT_ID}/export`, {
      artifactId: art.id,
      format: primaryFormat
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
      a.download = res.data.fileName || `${art.title || 'momai-docs'}.${primaryFormat}`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      setErrorBanner(res?.data?.error || t('Falha ao baixar arquivo.'))
    }
  }

  async function handleShareArtifact(art: any) {
    const shareText = `${art.title || t('Documento MomAI Docs')}${art.summary ? `\n\n${art.summary}` : ''}`
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: art.title || 'MomAI Docs', text: shareText })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText)
      }
    } catch {
      // ignore user-cancelled share
    }
  }

  async function handleConfirmRenameArtifact() {
    if (!renameArtifactTarget || !renameArtifactTarget.title.trim()) return
    const nextTitle = renameArtifactTarget.title.trim()
    const res = await sdk.api.get(`/extensions/${EXT_ID}/artifacts?action=rename&artifactId=${encodeURIComponent(renameArtifactTarget.id)}&title=${encodeURIComponent(nextTitle)}`)
    if (res?.data?.ok && res.data?.artifact) {
      setArtifacts((prev) => prev.map((a) => (a.id === res.data.artifact.id ? res.data.artifact : a)))
      if (activeArtifact?.id === res.data.artifact.id) setActiveArtifact(res.data.artifact)
    }
    setRenameArtifactTarget(null)
  }

  async function handleDeleteArtifact(art: any) {
    const res = await sdk.api.get(`/extensions/${EXT_ID}/artifacts?action=delete&artifactId=${encodeURIComponent(art.id)}`)
    if (res?.data?.ok) {
      setArtifacts((prev) => prev.filter((a) => a.id !== art.id))
      if (activeArtifact?.id === art.id) {
        setActiveArtifact(null)
        setView('workspace')
      }
    }
  }

  function applyUpdatedProject(updatedProj: any) {
    if (!updatedProj?.id) return
    setActiveProject((prev: any) => (prev?.id === updatedProj.id ? updatedProj : prev))
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === updatedProj.id ? updatedProj : p))
      writeBootstrapCache({ projects: next })
      return next
    })
  }

  async function maybeAutoTitleProject(candidate: string, targetProjectId?: string) {
    const pid = targetProjectId || activeProject?.id
    const targetProj = (pid && projects.find((p) => p.id === pid)) || activeProject
    if (!targetProj) return
    if (targetProj.titleLocked) return
    const curName = String(targetProj.name || '').trim()
    const untitled = [t('Projeto sem título'), 'Projeto sem título', t('Novo Projeto'), 'Novo Projeto']
    if (curName && !untitled.includes(curName)) return
    const cleaned = candidate
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/^https?:\/\/(www\.)?/i, '')
      .trim()
      .slice(0, 56)
    if (!cleaned || untitled.includes(cleaned)) return
    await saveProjectTitle(targetProj.id, cleaned)
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
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== projectId)
        writeBootstrapCache({ projects: next })
        return next
      })
      setSelectedProjectIds((prev) => prev.filter((id) => id !== projectId))
      if (activeProject?.id === projectId) {
        setActiveProject(null)
        setView('projects')
      }
    }
  }

  async function handleBulkDeleteProjects() {
    if (selectedProjectIds.length === 0) return
    const idsToDelete = [...selectedProjectIds]
    const res = await sdk.api.post(`/extensions/${EXT_ID}/projects`, {
      action: 'delete_many',
      projectIds: idsToDelete
    })
    if (res?.ok) {
      const deletedSet = new Set<string>(Array.isArray(res.data?.deleted) ? res.data.deleted : idsToDelete)
      setProjects((prev) => {
        const next = prev.filter((p) => !deletedSet.has(p.id))
        writeBootstrapCache({ projects: next })
        return next
      })
      if (activeProject && deletedSet.has(activeProject.id)) {
        setActiveProject(null)
        setView('projects')
      }
      setSelectedProjectIds([])
      setSidebarSelectMode(false)
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
        const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, { locale,
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
          if (res.data.project) applyUpdatedProject(res.data.project)
          else void maybeAutoTitleProject(res.data.source.title || file.name)
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
    const title = kind === 'text' ? t('Nota {time}', { time: new Date().toLocaleTimeString(locale) }) : val
    setSources((prev) => [
      { id: tempId, projectId, kind, title, status: 'indexing', active: true, totalChars: 0, totalChunks: 0 },
      ...prev
    ])
    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, { locale,
        projectId,
        kind,
        ...(kind === 'text' ? { title, text: val } : { url: val })
      })
      if (res?.data?.source) {
        setSources((prev) => [
          res.data.source,
          ...prev.filter((s) => s.id !== tempId && s.id !== res.data.source.id)
        ])
        if (res.data.project) applyUpdatedProject(res.data.project)
        else void maybeAutoTitleProject(res.data.source.title || val)
      } else {
        setSources((prev) => prev.filter((s) => s.id !== tempId))
        if (res?.data?.error) setErrorBanner(res.data.error)
      }
    } catch (err: any) {
      setSources((prev) => prev.filter((s) => s.id !== tempId))
      setErrorBanner(err?.message || t('Erro ao adicionar fonte'))
    }
  }

  async function handleRemoveSource(sourceId: string) {
    if (!activeProject) return
    const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, { locale,
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
    setBusyMessage(t("Buscando fontes confiáveis..."))
    setErrorBanner(null)
    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources/discover`, { locale,
        projectId: activeProject.id,
        query: discoverQuery.trim(),
        limit: 6
      })
      if (res?.ok && Array.isArray(res.data?.suggestions)) {
        setSuggestions(res.data.suggestions)
        if (res.data.suggestions.length === 0) {
          setErrorBanner(t("Nenhuma sugestão encontrada para esse termo. Tente palavras-chave mais amplas."))
        }
      } else {
        setErrorBanner(res?.data?.error || t('Falha ao buscar fontes.'))
      }
    } catch (err: any) {
      setErrorBanner(err?.message || t('Falha ao buscar fontes.'))
    } finally {
      setBusyMessage(null)
    }
  }

  async function approveSuggestion(sug: any) {
    if (!activeProject) return
    const projectId = activeProject.id
    const kind = sug.kind === 'youtube' ? 'youtube' : 'url'
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setSuggestions((prev) =>
      prev.filter((s) => (sug.id ? s.id !== sug.id : true) && (sug.url ? s.url !== sug.url : true))
    )
    setSources((prev) => [
      { id: tempId, projectId, kind, title: sug.title || sug.url, status: 'indexing', active: true, totalChars: 0, totalChunks: 0 },
      ...prev
    ])
    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources`, { locale,
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
        if (res.data.project) applyUpdatedProject(res.data.project)
        else void maybeAutoTitleProject(res.data.source.title || sug.title || sug.url, projectId)
      } else {
        setSources((prev) => prev.filter((s) => s.id !== tempId))
      }
    } catch {
      setSources((prev) => prev.filter((s) => s.id !== tempId))
    }
  }

  async function runGeneration(
    projId: string,
    toolId: string,
    label: string,
    emoji: string,
    payload: Record<string, any>,
    replaceId?: string
  ) {
    const tempId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setErrorBanner(null)
    if (replaceId) {
      setGeneratingItems((prev) =>
        prev.map((item) =>
          item.id === replaceId ? { id: tempId, projectId: projId, toolId, label, emoji, status: 'running', payload } : item
        )
      )
    } else {
      setGeneratingItems((prev) => [
        { id: tempId, projectId: projId, toolId, label, emoji, status: 'running', payload },
        ...prev
      ])
    }

    try {
      sessionStorage.setItem(
        'momai-docs:active-gen',
        JSON.stringify({ projectId: projId, requestId: tempId, toolId, startedAt: Date.now() })
      )
    } catch { }

    try {
      let res = await sdk.api.post(`/extensions/${EXT_ID}/generate`, {
        ...payload,
        requestId: tempId,
        async: true,
        locale
      })
      if (res?.data?.queued) {
        const startedAt = Date.now()
        const maxWaitMs = 10 * 60_000
        while (Date.now() - startedAt < maxWaitMs) {
          if (cancelledGenIdsRef.current.has(tempId)) return
          await new Promise((r) => setTimeout(r, 1500))
          if (cancelledGenIdsRef.current.has(tempId)) return
          const pollRes = await sdk.api
            .get(`/extensions/${EXT_ID}/artifacts?projectId=${encodeURIComponent(projId)}&requestId=${encodeURIComponent(tempId)}`)
            .catch(() => null)
          const st = pollRes?.data?.jobStatus
          if (!st) continue
          if (typeof st.percent === 'number' || st.detail) {
            setGeneratingItems((prev) =>
              prev.map((item) =>
                item.id === tempId
                  ? {
                      ...item,
                      percent: typeof st.percent === 'number' ? st.percent : item.percent,
                      stageDetail: st.detail || item.stageDetail
                    }
                  : item
              )
            )
          }
          if (st.status === 'done' && st.artifact) {
            res = { ok: true, data: { ok: true, artifact: st.artifact } }
            break
          }
          if (st.status === 'cancelled') {
            res = { ok: true, data: { ok: false, cancelled: true } }
            break
          }
          if (st.status === 'error') {
            res = { ok: true, data: { ok: false, error: st.error || t('Falha na geração.') } }
            break
          }
        }
      }
      if (cancelledGenIdsRef.current.has(tempId)) {
        return
      }
      if (res?.data?.ok && res.data?.artifact) {
        setArtifacts((prev) => [res.data.artifact, ...prev.filter((a) => a.id !== res.data.artifact.id)])
        if (res.data.artifact.id) {
          setUnseenArtifactIds((prev) => [res.data.artifact.id, ...prev.filter((id) => id !== res.data.artifact.id)])
        }
        void sdk.badge?.set?.(true, EXT_ID)
        void maybeAutoTitleProject(res.data.artifact.title || payload.instructions || label, projId)
        void sdk.notifications
          ?.send?.({
            title: t('Documento pronto'),
            body: t('{title} foi gerado no MomAI Docs.', { title: res.data.artifact.title || label })
          })
          ?.catch?.(() => { })
      } else if (!res?.data?.cancelled) {
        const rawErr = res?.data?.error || res?.error || t('Falha na geração.')
        setErrorBanner(
          rawErr === 'llm_provider_request_failed'
            ? t('O provedor de IA falhou ou ficou sobrecarregado (llm_provider_request_failed). Verifique se o modelo está ativo e tente novamente.')
            : rawErr
        )
      }
    } catch (err: any) {
      if (!cancelledGenIdsRef.current.has(tempId)) {
        setErrorBanner(err?.message || t('Falha na geração.'))
      }
    } finally {
      try {
        sessionStorage.removeItem('momai-docs:active-gen')
      } catch { }
      if (!cancelledGenIdsRef.current.has(tempId)) {
        setGeneratingItems((prev) => prev.filter((item) => item.id !== tempId))
      }
    }
  }

  function stopGeneratingItem(id: string) {
    cancelledGenIdsRef.current.add(id)
    setGeneratingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'stopped' } : item))
    )
    void sdk.api.post(`/extensions/${EXT_ID}/generate`, { cancelRequestId: id }).catch(() => { })
  }

  async function resumeGeneratingItem(item: {
    id: string
    projectId: string
    toolId: string
    label: string
    emoji: string
    payload: Record<string, any>
  }) {
    // Keep the old id in cancelledGenIdsRef so any late response from the stopped run is ignored,
    // and first check if the stopped run already finished on the backend.
    const check = await sdk.api
      .post(`/extensions/${EXT_ID}/generate`, { cancelRequestId: item.id })
      .catch(() => null)
    if (check?.data?.artifact) {
      const completed = check.data.artifact
      setGeneratingItems((prev) => prev.filter((x) => x.id !== item.id))
      setArtifacts((prev) => [completed, ...prev.filter((a) => a.id !== completed.id)])
      if (completed.id) {
        setUnseenArtifactIds((prev) => [completed.id, ...prev.filter((id) => id !== completed.id)])
      }
      return
    }
    await runGeneration(item.projectId, item.toolId, item.label, item.emoji, item.payload, item.id)
  }

  function dismissGeneratingItem(id: string) {
    cancelledGenIdsRef.current.delete(id)
    setGeneratingItems((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleGenerate(overrideTool?: string) {
    if (!activeProject) return
    const proj = activeProject
    const toolId = overrideTool || selectedTool
    const toolSpec = TOOL_CATALOG.find((x) => x.id === toolId) || activeToolSpec
    const currentInstructions = instructions.trim()
    const currentTemplate = selectedTemplate || undefined
    const currentTargetSizeHint = resolveTargetSizeHint(toolId, targetSize)
    const currentAttachments = docAttachments.map((a) => ({ name: a.name, base64: a.base64 }))

    setInstructions('')
    setTargetSize('auto')
    setDocAttachments([])
    if (currentInstructions) addToHistory(currentInstructions)
    const payload = {
      projectId: proj.id,
      toolId,
      templateId: currentTemplate,
      instructions: currentInstructions || undefined,
      groundingMode: proj.groundingMode,
      ...(toolId === 'letterhead' && letterheadFile
        ? { letterheadFileBase64: letterheadFile.base64, letterheadFileName: letterheadFile.name }
        : {}),
      options: {
        voice: voiceA || undefined,
        voiceA,
        voiceB: speakerCount === 2 ? voiceB : undefined,
        speakerCount,
        includeSubtitles,
        ...(currentTargetSizeHint ? { targetSizeHint: currentTargetSizeHint } : {}),
        ...exportOptions,
        brandHeaderLogoBase64: brandHeaderLogo?.base64 || undefined,
        brandFooterLogoBase64: brandFooterLogo?.base64 || undefined,
        brandLogoInHeader: Boolean(brandHeaderLogo),
        brandLogoInFooter: Boolean(brandFooterLogo),
        brandHeaderText: brandHeaderText.trim() || undefined,
        brandFooterText: brandFooterText.trim() || undefined,
        brandHeaderAlign,
        brandFooterAlign,
        attachments: currentAttachments
      }
    }
    await runGeneration(proj.id, toolId, toolSpec.label, toolSpec.emoji, payload)
  }

  async function handleRefine() {
    if (!activeArtifact || !refineText.trim()) return
    addToHistory(refineText.trim())
    setBusyMessage(t("Refinando artefato..."))
    setErrorBanner(null)
    const refineSizeHint = resolveTargetSizeHint(activeArtifact.toolId, refineTargetSize)
    const res = await sdk.api.post(`/extensions/${EXT_ID}/refine`, {
      artifactId: activeArtifact.id,
      instruction: refineText.trim(),
      ...(refineSizeHint ? { targetSizeHint: refineSizeHint } : {}),
      locale
    })
    setBusyMessage(null)
    if (res?.data?.ok && res.data?.artifact) {
      setActiveArtifact(res.data.artifact)
      setArtifacts((prev) => prev.map((a) => (a.id === res.data.artifact.id ? res.data.artifact : a)))
      setRefineText('')
    } else {
      setErrorBanner(res?.data?.error || t('Falha ao refinar artefato.'))
    }
  }

  async function handleExport(format: string) {
    if (!activeArtifact) return
    setBusyMessage(t('Exportando {format}...', { format: format.toUpperCase() }))
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
      setErrorBanner(res?.data?.error || t('Erro ao exportar.'))
    }
  }

  async function handleOpenPdf() {
    if (!activeArtifact) return
    setBusyMessage(t('Exportando {format}...', { format: 'PDF' }))
    try {
      const res = await sdk.api.post(`/extensions/${EXT_ID}/export`, {
        artifactId: activeArtifact.id,
        format: 'pdf',
        open: true
      })
      if (!res?.data?.ok) {
        setErrorBanner(res?.data?.error || t('Erro ao exportar.'))
      }
    } finally {
      setBusyMessage(null)
    }
  }

  async function addBrandImageFromFile(file: File | null | undefined, target: 'header' | 'footer') {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setErrorBanner(t("Envie uma imagem PNG, JPG ou WEBP para o timbre."))
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
        setErrorBanner(t("Nenhuma imagem encontrada na área de transferência."))
      }
    } catch {
      setErrorBanner(t("Não foi possível ler a imagem da área de transferência."))
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

  function stopChatMessage(msgId: string) {
    stoppedChatIdsRef.current.add(msgId)
    setChatMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, streaming: false, stopped: true } : m))
    )
  }

  async function resumeChatMessage(msgId: string, queryText: string) {
    stoppedChatIdsRef.current.delete(msgId)
    setChatMessages((prev) => prev.filter((m) => m.id !== msgId))
    await handleChatAsk(undefined, queryText, true)
  }

  async function handleChatAsk(e?: React.FormEvent, presetQuery?: string, skipUserPush?: boolean) {
    e?.preventDefault()
    const rawQ = (presetQuery ?? chatQuery).trim()
    const pendingAttachments = presetQuery ? [] : chatAttachments
    if (!activeProject || (!rawQ && pendingAttachments.length === 0)) return
    const q = rawQ || t('Analise os anexos enviados.')
    if (!presetQuery) {
      if (rawQ) addToHistory(rawQ)
      setChatQuery('')
      setChatAttachments([])
    }
    const history = chatMessages
      .filter((m) => !m.streaming && m.text.trim())
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.text }))
    const assistantId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const userMsg = {
      role: 'user' as const,
      text: rawQ || `📎 ${pendingAttachments.map((a) => a.name).join(', ')}`,
      ...(pendingAttachments.length > 0
        ? { attachments: pendingAttachments.map((a) => ({ name: a.name, isImage: a.isImage, base64: a.isImage ? a.base64 : undefined })) }
        : {})
    }
    setChatMessages((prev) => [
      ...prev,
      ...(skipUserPush ? [] : [userMsg]),
      { id: assistantId, role: 'assistant', text: '', streaming: true, query: q }
    ])
    try {
      if (pendingAttachments.length > 0) {
        for (const att of pendingAttachments) {
          if (stoppedChatIdsRef.current.has(assistantId)) return
          const srcRes = await sdk.api.post(`/extensions/${EXT_ID}/sources`, { locale,
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
      if (stoppedChatIdsRef.current.has(assistantId)) return
      const res = await sdk.api.post(`/extensions/${EXT_ID}/sources/query`, {
        projectId: activeProject.id,
        query: q,
        answerWithCitations: true,
        history,
        locale
      })
      if (stoppedChatIdsRef.current.has(assistantId)) return
      const fullText = String(
        res?.data?.answer || res?.data?.error || t('Não consegui gerar uma resposta agora. Tente novamente.')
      )
      const citations = res?.data?.citations || []
      const tokens = fullText.split(/(\s+)/)
      const step = Math.max(2, Math.ceil(tokens.length / 45))
      let idx = 0
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (stoppedChatIdsRef.current.has(assistantId)) {
            resolve()
            return
          }
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
      if (stoppedChatIdsRef.current.has(assistantId)) return
      const chatKey = `chat_${String(activeProject.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`
      const nextToSave = [
        ...chatMessages,
        ...(skipUserPush ? [] : [{ role: userMsg.role, text: userMsg.text, ...(userMsg.attachments ? { attachments: userMsg.attachments.map((a) => ({ name: a.name, isImage: a.isImage })) } : {}) }]),
        { id: assistantId, role: 'assistant' as const, text: fullText, citations }
      ].slice(-40)
      void sdk.storage?.set?.(chatKey, nextToSave)?.catch?.(() => { })
    } catch (err: any) {
      if (stoppedChatIdsRef.current.has(assistantId)) return
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: err?.message || t('Erro ao consultar o assistente.'), streaming: false }
            : m
        )
      )
    }
  }

  async function startFromTool(tool: ToolSpec) {
    setSelectedTool(tool.id)
    setSelectedTemplate('')
    setMobilePanel('chat')
    if (activeProject && view !== 'projects' && view !== 'models') {
      setStudioTab('generate')
      setView('workspace')
      setConfigStep('config')
      setModal('generate_config')
      return
    }
    const profile =
      tool.category === 'Acadêmico' ? 'student' : tool.category === 'Oficial' ? 'public_servant' : 'executive'
    await createInstantProject(t('Projeto sem título'), profile)
    setStudioTab('generate')
    setConfigStep('sources')
    setModal('generate_config')
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

  const featuredTools = useMemo(() => TOOL_CATALOG.filter((x) => x.featured), [TOOL_CATALOG])
  const filteredTools = useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    return TOOL_CATALOG.filter((tool) => {
      if (modelCategory !== 'Todos' && tool.category !== modelCategory) return false
      if (!q) return true
      return (
        tool.label.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        tool.formats.some((f) => f.toLowerCase().includes(q))
      )
    })
  }, [TOOL_CATALOG, modelCategory, modelSearch])

  const activeToolSpec = useMemo(
    () => TOOL_CATALOG.find((x) => x.id === selectedTool) || TOOL_CATALOG[0],
    [TOOL_CATALOG, selectedTool]
  )

  const toolTemplates = useMemo(() => {
    const apiMatches = templates.filter((tpl) => tpl.toolId === selectedTool)
    if (apiMatches.length > 0) {
      return apiMatches.map((tpl) => ({ ...tpl, name: t(tpl.name), description: t(tpl.description) }))
    }
    return [
      { id: `${selectedTool}-formal`, name: t('Formal Padrão'), description: t('Estrutura clássica e margens oficiais') },
      { id: `${selectedTool}-simples`, name: t('Direto / Conciso'), description: t('Sem timbre · foco em leitura rápida') },
      { id: `${selectedTool}-timbre`, name: t('Com Timbre'), description: t('Cabeçalho institucional e rodapé') }
    ]
  }, [templates, selectedTool, locale])

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

      {/* Left Studio Sidebar (shown only on top-level catalog/home views) */}
      {sidebarOpen && (view === 'projects' || view === 'models' || view === 'template_detail') && (
        <aside className="mdocs-sidebar">
          <div className="flex flex-col flex-1 min-h-0 gap-5">
            <div className="space-y-1">
              <div className="px-2.5 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("Estúdio")}
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  title={t("Ocultar barra lateral")}
                  aria-label={t("Ocultar barra lateral")}
                  className="p-1.5 -mr-1 rounded-lg text-text-muted hover:text-text hover:bg-input active:bg-input/80 flex items-center justify-center shrink-0 transition-colors"
                >
                  <IconPanelLeft size={16} />
                </button>
              </div>
              <button
                onClick={() => setView('projects')}
                title={t("Início")}
                className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between ${view === 'projects'
                  ? 'bg-card text-text font-medium border border-border'
                  : 'text-text-muted hover:text-text hover:bg-card/50'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span>🏠</span>
                  <span>{t("Início")}</span>
                </span>
                <span className="text-[11px] text-text-muted tabular-nums">{projects.length}</span>
              </button>
              <button
                onClick={() => setView('models')}
                title={t("Modelos")}
                className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between ${view === 'models' || view === 'template_detail'
                  ? 'bg-card text-text font-medium border border-border'
                  : 'text-text-muted hover:text-text hover:bg-card/50'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span>🗂️</span>
                  <span>{t("Modelos")}</span>
                </span>
                <span className="text-[11px] text-text-muted tabular-nums">{TOOL_CATALOG.length}</span>
              </button>
              {activeProject && (
                <button
                  onClick={() => setView('workspace')}
                  title={t("Workspace")}
                  className="w-full h-8 px-2.5 rounded-lg text-xs flex items-center justify-between text-text-muted hover:text-text hover:bg-card/50"
                >
                  <span className="flex items-center gap-2">
                    <span>✨</span>
                    <span>{t("Workspace")}</span>
                  </span>
                  <span className="text-[11px] text-text-muted tabular-nums">{artifacts.length}</span>
                </button>
              )}
            </div>

            <div className="space-y-1 flex flex-col flex-1 min-h-0">
              <div className="px-2.5 pb-1 flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                <span>
                  {t("Recentes")}
                  {sortedProjects.length > 0 && (
                    <span className="ml-1.5 tabular-nums font-normal">
                      ({Math.min(sidebarRecentLimit, sortedProjects.length)}/{sortedProjects.length})
                    </span>
                  )}
                </span>
                {sortedProjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarSelectMode((m) => !m)
                      setSelectedProjectIds([])
                    }}
                    className="text-[10px] font-medium normal-case tracking-normal text-accent hover:underline"
                  >
                    {sidebarSelectMode ? t('Cancelar') : t('Selecionar')}
                  </button>
                )}
              </div>

              {sidebarSelectMode && sortedProjects.length > 0 && (
                <div className="px-2 pb-1 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProjectIds.length === sortedProjects.length) {
                        setSelectedProjectIds([])
                      } else {
                        setSelectedProjectIds(sortedProjects.map((p) => p.id))
                      }
                    }}
                    className="h-6 px-2 rounded-md bg-input text-[10px] font-medium text-text hover:opacity-80"
                  >
                    {selectedProjectIds.length === sortedProjects.length ? t('Desmarcar') : t('Selecionar tudo')}
                  </button>
                  <button
                    type="button"
                    disabled={selectedProjectIds.length === 0}
                    onClick={() => void handleBulkDeleteProjects()}
                    className="h-6 px-2 rounded-md bg-error/15 text-error text-[10px] font-semibold hover:bg-error/25 disabled:opacity-40 flex items-center gap-1"
                  >
                    <IconTrash size={11} />
                    <span>{t('Excluir ({count})', { count: selectedProjectIds.length })}</span>
                  </button>
                </div>
              )}

              {sortedProjects.length === 0 ? (
                <div className="px-2.5 py-1 text-[11px] text-text-muted">{t("Nenhum projeto ainda")}</div>
              ) : (
                <div
                  className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5"
                  onScroll={(e) => {
                    const el = e.currentTarget
                    if (
                      sidebarRecentLimit < sortedProjects.length &&
                      el.scrollTop + el.clientHeight >= el.scrollHeight - 24
                    ) {
                      setSidebarRecentLimit((n) => Math.min(sortedProjects.length, n + 6))
                    }
                  }}
                >
                  {sortedProjects.slice(0, sidebarRecentLimit).map((p) => {
                    const isChecked = selectedProjectIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (sidebarSelectMode) {
                            setSelectedProjectIds((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                            return
                          }
                          void openProject(p)
                        }}
                        onContextMenu={(e) => {
                          if (!sidebarSelectMode) openProjectContextMenu(e, p)
                        }}
                        title={p.name}
                        className={`w-full h-8 px-2.5 rounded-lg text-xs flex items-center gap-2 text-left shrink-0 ${
                          sidebarSelectMode && isChecked
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'text-text-muted hover:text-text hover:bg-card/50'
                        }`}
                      >
                        {sidebarSelectMode ? (
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                              isChecked
                                ? 'bg-accent border-accent text-bg'
                                : 'border-border bg-input text-transparent'
                            }`}
                          >
                            <IconCheck size={10} />
                          </span>
                        ) : (
                          <span className="shrink-0">{PROFILE_EMOJIS[p.profile] || '📓'}</span>
                        )}
                        <span className="truncate flex-1">{p.name}</span>
                        {!sidebarSelectMode && p.pinned && (
                          <span className="text-[10px] shrink-0" title={t("Fixado no topo")}>📌</span>
                        )}
                      </button>
                    )
                  })}
                  {sidebarRecentLimit < sortedProjects.length && (
                    <div className="px-2.5 py-1.5 text-[10px] text-text-muted text-center">
                      {t("Role para carregar mais...")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="mdocs-main">
        {/* Global Top Bar (adapts cleanly to Home vs Workspace vs Export) */}
        <header className="mdocs-topbar">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (view === 'projects' || view === 'models' || view === 'template_detail') && (
              <button
                onClick={() => setSidebarOpen(true)}
                title={t("Mostrar barra lateral")}
                aria-label={t("Mostrar barra lateral")}
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
                title={t("Voltar")}
                className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs text-text hover:bg-input flex items-center gap-1 shrink-0"
              >
                <IconChevronLeft size={14} />
                <span>{t("Voltar")}</span>
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
                  title={view === 'workspace' && activeProject ? t('Clique para renomear o projeto') : undefined}
                  className={`text-lg font-semibold tracking-tight text-text truncate ${view === 'workspace' && activeProject ? 'cursor-pointer hover:text-accent transition-colors' : ''
                    }`}
                >
                  {view === 'workspace' && activeProject
                    ? activeProject.name
                    : view === 'models'
                      ? t('Modelos e Formatos')
                      : view === 'template_detail'
                        ? activeToolSpec.label
                        : view === 'export' && activeArtifact
                          ? activeArtifact.title
                          : 'MomAI Docs'}
                </h1>
              )}
              {view === 'workspace' && activeProject && (
                <p className="text-[11px] text-text-muted truncate">
                  {t('{sources} fontes · {artifacts} documentos · {profile}', {
                    sources: sources.length,
                    artifacts: artifacts.length,
                    profile: t(PROFILE_LABELS[activeProject.profile] || 'Geral')
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">

            {view === 'workspace' && activeProject ? (
              <>
                <button
                  onClick={() => setModal('brand')}
                  title={t("Configurar timbre e identidade visual")}
                  className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-text hover:bg-input"
                >
                  {t("Timbre")}
                </button>
                <button
                  onClick={() => setModal('queue')}
                  className="h-8 px-2.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-input/60 flex items-center gap-1.5 transition-colors"
                  title={t("Fila de tarefas")}
                >
                  <IconClock size={13} />
                  <span className="tabular-nums">{activeJobsCount}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModal('queue')}
                  className="h-8 px-2.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-input/60 flex items-center gap-1.5 transition-colors"
                  title={t("Fila de tarefas")}
                >
                  <IconClock size={13} />
                  <span className="tabular-nums">{activeJobsCount}</span>
                </button>
                <button
                  onClick={() => void createInstantProject()}
                  title={t("Criar novo projeto")}
                  className="h-8 px-3.5 rounded-lg bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                >
                  <IconPlus size={13} />
                  <span>{t("Novo projeto")}</span>
                </button>
              </>
            )}
          </div>
        </header>

        {errorBanner && (
          <div className="shrink-0 bg-error/10 border-b border-error/25 px-6 py-2 text-xs text-error flex items-center justify-between gap-3">
            <span className="truncate">{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} title={t("Fechar aviso")} className="shrink-0 hover:opacity-80">
              <IconX size={14} />
            </button>
          </div>
        )}

        {/* ── TELA 01: HOME (TODOS OS MODELOS) ────────────────────────────────── */}
        {view === 'projects' && (
          <main className="mdocs-scroll">
            <div className="mdocs-container">
              <section className="space-y-3">
                <div className="relative">
                  <input
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder={t('Buscar modelos...')}
                    aria-label={t('Buscar modelos...')}
                    className="w-full h-9 pl-3.5 pr-8 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                  {modelSearch && (
                    <button
                      type="button"
                      onClick={() => setModelSearch('')}
                      title={t('Limpar')}
                      aria-label={t('Limpar')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                    >
                      <IconX size={13} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-text">{t('Todos os modelos ({count})', { count: filteredTools.length })}</h2>
                    <span className="text-[11px] text-text-muted hidden sm:inline">{t("Escolha um formato para iniciar um novo material")}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {['Todos', 'Oficial', 'Acadêmico', 'Slides', 'Planilhas', 'Áudio & Vídeo', 'Relatórios'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setModelCategory(cat)}
                        className={`h-6 px-2 rounded-md text-[11px] transition-colors ${modelCategory === cat
                          ? 'bg-card border border-border text-text font-medium'
                          : 'text-text-muted hover:text-text hover:bg-card/50'
                          }`}
                      >
                        {t(cat)}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTools.length === 0 ? (
                  <div className="py-10 text-center text-xs text-text-muted">
                    {t('Nenhum modelo encontrado para essa busca.')}
                  </div>
                ) : (
                  <div className="mdocs-featured-grid">
                    {filteredTools.map((tool) => (
                      <ModelCard
                        key={tool.id}
                        tool={tool}
                        onClick={() => void startFromTool(tool)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </main>
        )}

        {/* ── TELA 02: MODELOS ──────────────────────────────────────────────────── */}
        {view === 'models' && (
          <main className="mdocs-scroll">
            <div className="mdocs-container">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                  {['Todos', 'Oficial', 'Acadêmico', 'Slides', 'Planilhas', 'Áudio & Vídeo', 'Relatórios'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setModelCategory(cat)}
                      className={`h-6 px-2 rounded-md text-[11px] transition-colors ${modelCategory === cat
                        ? 'bg-card border border-border text-text font-medium'
                        : 'text-text-muted hover:text-text hover:bg-card/50'
                        }`}
                    >
                      {t(cat)}
                    </button>
                  ))}
                </div>
                <div className="relative w-56 max-w-full">
                  <input
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder={t('Buscar modelos...')}
                    aria-label={t('Buscar modelos...')}
                    className="w-full h-7 pl-2.5 pr-7 rounded-lg bg-input border border-border text-[11px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                  {modelSearch && (
                    <button
                      type="button"
                      onClick={() => setModelSearch('')}
                      title={t('Limpar')}
                      aria-label={t('Limpar')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                    >
                      <IconX size={11} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mdocs-featured-grid">
                {filteredTools.map((tool) => (
                  <ModelCard
                    key={tool.id}
                    tool={tool}
                    onClick={() => {
                      setSelectedTool(tool.id)
                      setSelectedTemplate('')
                      setView('template_detail')
                    }}
                    emojiClassName="text-lg leading-none mdocs-emoji drop-shadow-sm"
                    titleClassName="text-sm font-semibold text-white"
                  />
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
                  <span>{activeProject ? t('Usar no projeto atual') : t('Criar projeto com este modelo')}</span>
                </button>
              </div>

              <div className="mdocs-templates-grid">
                {toolTemplates.map((tpl, idx) => {
                  const isSel = selectedTemplate ? selectedTemplate === tpl.id : idx === 0
                  const preview = buildTemplatePreviewPages(tpl, selectedTool, brandKit, false, locale)
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`text-left rounded-2xl bg-card border p-5 flex flex-col items-center gap-4 transition-all ${isSel ? 'border-accent ring-1 ring-accent/30' : 'border-border hover:border-accent/50'
                        }`}
                    >
                      <div
                        className={`w-full overflow-hidden rounded-xl border bg-bg ${
                          preview.orientation === 'landscape' ? 'aspect-video' : 'max-w-[165px] aspect-[595/842]'
                        } ${isSel ? 'border-accent' : 'border-border'}`}
                        dangerouslySetInnerHTML={{ __html: preview.pages[0].svg }}
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
                { id: 'sources', label: t('Fontes ({count})', { count: sources.length }) },
                { id: 'chat', label: t('Chat') },
                { id: 'studio', label: t('Estúdio ({count})', { count: artifacts.length }), cls: 'mdocs-ws-tab-studio' }
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
                    { id: 'sources', label: t('Fontes ({count})', { count: sources.length }) },
                    { id: 'chat', label: t('Chat') }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMobilePanel(tab.id as any)}
                      className={`flex-1 h-7 rounded-lg text-xs font-medium transition-colors ${(mobilePanel === 'sources' ? tab.id === 'sources' : tab.id === 'chat')
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
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t("Fontes")}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-input text-[10px] font-semibold text-text tabular-nums">
                          {sources.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setModal('discover')}
                        title={t("Descobrir fontes")}
                        className="text-[11px] text-accent hover:underline"
                      >
                        {t("Descobrir")}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                      {sources.map((s) => (
                        <div
                          key={s.id}
                          title={s.title}
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
                                {s.kind} · {s.chunkCount ?? 1} {t("trechos")}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => void handleRemoveSource(s.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-error"
                            title={t("Remover fonte")}
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      ))}

                      {suggestions.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/25 space-y-2">
                          <div className="text-[11px] font-semibold text-accent">{t("Sugestões encontradas")}</div>
                          {suggestions.map((sug) => (
                            <div key={sug.id} className="p-2 rounded-lg bg-card border border-border space-y-1.5">
                              <div className="text-[11px] font-medium text-text line-clamp-2">{sug.title}</div>
                              <button
                                onClick={() => void approveSuggestion(sug)}
                                className="px-2 py-1 rounded bg-accent text-bg text-[10px] font-semibold"
                              >
                                {t("Importar fonte")}
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
                        <div className="text-xs font-medium text-text">{t("Adicionar arquivos")}</div>
                        <div className="text-[10px] text-text-muted">{t("PDF, DOCX, XLSX, PPTX, TXT")}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setAddLinkKind('url')
                            setAddLinkValue('')
                            setModal('add_link')
                          }}
                          title={t("Adicionar URL ou vídeo do YouTube")}
                          className="h-8 px-2 rounded-lg border border-border bg-card text-[11px] text-text hover:bg-input flex items-center justify-center gap-1.5"
                        >
                          <IconGlobe size={12} />
                          <span>{t("URL / YouTube")}</span>
                        </button>
                        <button
                          onClick={() => {
                            setAddLinkKind('text')
                            setAddLinkValue('')
                            setModal('add_link')
                          }}
                          title={t("Colar texto como fonte")}
                          className="h-8 px-2 rounded-lg border border-border bg-card text-[11px] text-text hover:bg-input flex items-center justify-center gap-1.5"
                        >
                          <IconFileText size={12} />
                          <span>{t("Colar texto")}</span>
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Painel Central: CHAT COM AS FONTES */}
                  <section
                    className={`mdocs-ws-center ${mobilePanel !== 'chat' ? 'mdocs-ws-hidden-mobile' : ''} ${mobilePanel === 'sources' ? 'mdocs-ws-hidden-windowed' : ''}`}
                  >
                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="max-w-3xl mx-auto w-full space-y-4 h-full flex flex-col">
                        {chatMessages.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
                            <div className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center text-accent">
                              <IconSparkles size={20} />
                            </div>
                            <div className="space-y-1">
                              <h2 className="text-sm font-semibold text-text">{t("Converse com as suas fontes")}</h2>
                              <p className="text-xs text-text-muted leading-relaxed">
                                {t("Faça perguntas com citações rastreáveis ou escolha um formato no painel Estúdio ao lado para gerar seu documento.")}
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
                                  <div className="space-y-2">
                                    {m.stopped && m.id && (
                                      <div className="flex items-center gap-2">
                                        {m.query && (
                                          <button
                                            type="button"
                                            onClick={() => void resumeChatMessage(m.id!, m.query!)}
                                            title={t("Continuar resposta")}
                                            aria-label={t("Continuar resposta")}
                                            className="w-6 h-6 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 flex items-center justify-center transition-colors"
                                          >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                            </svg>
                                          </button>
                                        )}
                                        <span className="text-[10px] text-text-muted">{t("Resposta interrompida")}</span>
                                      </div>
                                    )}
                                    <ChatMarkdown text={m.text || ''} />
                                  </div>
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
                    </div>

                    <div className="shrink-0 p-4 bg-bg">
                      <div className="max-w-3xl mx-auto w-full space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { label: t('Resumir as fontes'), extra: false },
                              { label: t('Pontos principais'), extra: false },
                              { label: t('Listar citações'), extra: true }
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
                              onClick={() => {
                                setChatMessages([])
                                if (activeProject) {
                                  const chatKey = `chat_${String(activeProject.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`
                                  void sdk.storage?.delete?.(chatKey)?.catch?.(() => { })
                                }
                              }}
                              className="h-7 px-2.5 rounded-lg text-[11px] text-text-muted hover:text-text hover:bg-input/70 transition-colors shrink-0"
                              title={t("Limpar conversa e iniciar novo chat")}
                            >
                              {t("Novo chat")}
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
                                    title={t("Remover anexo")}
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
                              title={t("Anexar arquivos ou imagens")}
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
                            <AutocompleteTextarea
                              value={chatQuery}
                              onValueChange={setChatQuery}
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
                              placeholder={t("Pergunte às fontes do projeto...")}
                              wrapperClassName="relative flex-1 min-w-0"
                              overlayPaddingClassName="px-1 py-1 text-xs"
                              className="resize-none text-xs text-text placeholder:text-text-muted focus:outline-none px-1 py-1"
                            />
                            {(() => {
                              const streamingChatMsg = chatMessages.find((m) => m.streaming && m.id)
                              if (streamingChatMsg?.id) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => stopChatMessage(streamingChatMsg.id!)}
                                    className="h-8 w-8 rounded-xl bg-accent text-bg hover:opacity-90 flex items-center justify-center shrink-0 transition-colors"
                                    title={t("Parar resposta")}
                                    aria-label={t("Parar resposta")}
                                  >
                                    <span className="w-3 h-3 rounded-[2px] bg-current" />
                                  </button>
                                )
                              }
                              return (
                                <button
                                  type="submit"
                                  disabled={(!chatQuery.trim() && chatAttachments.length === 0) || Boolean(busyMessage)}
                                  className="h-8 w-8 rounded-xl bg-accent text-bg flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40"
                                  title={t("Enviar")}
                                >
                                  <IconSend size={14} />
                                </button>
                              )
                            })()}
                          </div>
                        </form>
                        <div className="text-[10px] text-text-muted text-center">
                          {busyMessage || t('As respostas usam apenas as fontes indexadas neste projeto.')}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {/* Painel Direito: ESTÚDIO (Estilo NotebookLM: Lista limpa em linha única + Gerados) */}
              <section
                className={`mdocs-ws-right ${mobilePanel !== 'studio' ? 'mdocs-ws-hidden-mobile' : ''}`}
              >
                <div className="px-4 py-3.5 flex items-center justify-between shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t("Estúdio")}</span>
                  <button
                    type="button"
                    onClick={() => setShowAllStudioTools((v) => !v)}
                    title={showAllStudioTools ? t('Mostrar menos opções') : t('Ver todas as {count} opções', { count: TOOL_CATALOG.length })}
                    className="text-[11px] text-accent hover:underline"
                  >
                    {showAllStudioTools ? t('Menos') : t('Ver todos ({count})', { count: TOOL_CATALOG.length })}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-6">
                  <div className="grid grid-cols-2 gap-2.5">
                    {(showAllStudioTools ? TOOL_CATALOG : TOOL_CATALOG.filter((tItem) => tItem.featuredCompact)).map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        title={`${tool.label}: ${tool.description}`}
                        onClick={() => {
                          setSelectedTool(tool.id)
                          setSelectedTemplate('')
                          setConfigStep('config')
                          setModal('generate_config')
                        }}
                        className="px-3 py-2.5 rounded-xl bg-card hover:bg-input text-left flex items-center gap-2 min-w-0 transition-colors"
                      >
                        <span className="text-sm mdocs-emoji shrink-0">{tool.emoji}</span>
                        <span className="text-[11px] font-medium text-text truncate">{tool.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Documentos gerados logo abaixo (com loading em segundo plano) */}
                  {(() => {
                    const projectGenItems = generatingItems.filter((g) => g.projectId === activeProject.id)
                    const totalDocs = artifacts.length + projectGenItems.length
                    return (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                            {t('Gerados ({count})', { count: totalDocs })}
                          </span>
                        </div>

                        {totalDocs === 0 ? (
                          <div className="py-8 text-center space-y-2 px-4">
                            <div className="text-text-muted flex justify-center">
                              <IconSparkles size={18} />
                            </div>
                            <div className="text-xs font-medium text-text">{t("O resultado do Estúdio será salvo aqui")}</div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {projectGenItems.map((item) => (
                              <div
                                key={item.id}
                                className="w-full p-2.5 rounded-xl bg-card flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-sm mdocs-emoji shrink-0">
                                    {item.emoji}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-text truncate" title={item.label}>{item.label}</div>
                                    <div className="text-[10px] text-text-muted truncate">
                                      {item.status === 'running'
                                        ? `${item.percent ?? 5}% · ${item.stageDetail || t('Na fila...')}`
                                        : t('Parado')}
                                    </div>
                                  </div>
                                </div>
                                {item.status === 'running' ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className="w-4 h-4 rounded-full border-2 border-accent/25 border-t-accent animate-spin shrink-0"
                                      aria-label={t("Gerando")}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => stopGeneratingItem(item.id)}
                                      title={t("Parar geração")}
                                      aria-label={t("Parar geração")}
                                      className="w-6 h-6 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 flex items-center justify-center shrink-0 transition-colors"
                                    >
                                      <span className="w-2.5 h-2.5 rounded-[2px] bg-current" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => void resumeGeneratingItem(item)}
                                      title={t("Continuar geração")}
                                      className="px-2 py-0.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25 text-[10px] font-semibold shrink-0 transition-colors"
                                    >
                                      {t("Continuar")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => dismissGeneratingItem(item.id)}
                                      title={t("Remover da lista")}
                                      className="p-1 rounded-md text-text-muted hover:text-text hover:bg-input shrink-0"
                                    >
                                      <IconX size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {artifacts.map((art) => {
                              const isFresh = unseenArtifactIds.includes(art.id)
                              const toolMeta = TOOL_CATALOG.find((t) => t.id === art.toolId)
                              const iconEmoji = toolMeta?.emoji || '📄'
                              return (
                                <div
                                  key={art.id}
                                  title={art.title}
                                  onClick={() => openArtifactItem(art)}
                                  onContextMenu={(e) => openArtifactContextMenu(e, art)}
                                  className={`group w-full text-left px-2.5 py-2 rounded-xl hover:bg-card/80 flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${isFresh ? 'mdocs-card-ready' : ''}`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xl leading-none mdocs-emoji shrink-0" aria-hidden="true">
                                      {iconEmoji}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-text truncate">{art.title}</div>
                                      <div className="text-[11px] text-text-muted truncate">
                                        {formatRelativeDate(art.updatedAt || art.createdAt, locale, t)} · v{art.currentVersion || 1} · {Object.keys(art.exportFiles || {}).join(' · ').toUpperCase() || 'DOCX'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isFresh && <span className="w-2 h-2 rounded-full bg-success animate-pulse" aria-label={t("Novo")} />}
                                    <button
                                      type="button"
                                      onClick={(e) => openArtifactContextMenu(e, art)}
                                      title={t("Mais opções")}
                                      aria-label={t("Mais opções")}
                                      className="w-7 h-7 rounded-lg text-text-muted hover:text-text hover:bg-input flex items-center justify-center transition-colors"
                                    >
                                      <IconMoreVertical size={14} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── TELA 05 & 06: TELA ÚNICA DE GERAÇÃO -> PRÉVIA & EXPORTAR ────────── */}
        {(view === 'generating' || (view === 'export' && activeArtifact)) && (
          <div className="mdocs-export-grid">
            {/* Coluna Esquerda: Folha inteira de cima a baixo, sem scroll e sem margens laterais cinzas */}
            <section className="bg-bg overflow-hidden p-3 flex flex-col items-center justify-center min-h-0 h-full">
              {view === 'generating' ? (
                <div className="w-full max-w-[460px] h-full rounded-xl bg-card shadow-glass-md p-7 flex flex-col justify-between">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-input flex items-center justify-center text-base mdocs-emoji shrink-0">
                          {activeToolSpec.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-text truncate">{activeToolSpec.label}</div>
                          <div className="text-[11px] text-text-muted">{t("Gerando prévia...")}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-semibold tabular-nums shrink-0">
                        {Math.round(((genStep + 1) / GENERATING_STEPS.length) * 100)}%
                      </span>
                    </div>

                    <div className="space-y-3 animate-pulse pt-2">
                      <div className="h-4 w-2/3 rounded-md bg-input" />
                      <div className="h-3 w-1/3 rounded-md bg-input/80" />
                      <div className="pt-4 space-y-2.5">
                        <div className="h-2.5 w-full rounded bg-input" />
                        <div className="h-2.5 w-11/12 rounded bg-input" />
                        <div className="h-2.5 w-4/5 rounded bg-input" />
                        <div className="h-2.5 w-full rounded bg-input" />
                        <div className="h-2.5 w-9/12 rounded bg-input" />
                      </div>
                      <div className="pt-3 space-y-2.5">
                        <div className="h-2.5 w-full rounded bg-input" />
                        <div className="h-2.5 w-10/12 rounded bg-input" />
                        <div className="h-2.5 w-3/4 rounded bg-input" />
                        <div className="h-2.5 w-5/6 rounded bg-input" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 animate-pulse">
                    <div className="h-12 rounded-xl bg-input/70" />
                    <div className="h-12 rounded-xl bg-input/70" />
                    <div className="h-12 rounded-xl bg-input/70" />
                  </div>
                </div>
              ) : activeArtifact ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 min-h-0">
                  {activeArtifact.toolId === 'video' && activeArtifact.exportFiles?.mp4 ? (
                    <div className="flex-1 min-h-0 w-full flex flex-col gap-3 pt-1">
                      {videoLoading ? (
                        <div className="text-xs text-text-muted pt-8 text-center">{t("Carregando prévia do vídeo...")}</div>
                      ) : videoPreviewUrl ? (
                        <>
                          <div
                            className={`relative flex items-center justify-center rounded-xl overflow-hidden shadow-glass-md bg-bg border border-border shrink-0 ${activeArtifact.structuredData?.aspectRatio === '9:16'
                              ? 'h-[68%] aspect-[9/16] mx-auto'
                              : 'w-full h-[64%] min-h-[360px]'
                              }`}
                          >
                            <video
                              ref={videoRef}
                              src={videoPreviewUrl}
                              controls
                              preload="auto"
                              playsInline
                              onPlay={() => setVideoPlaying(true)}
                              onPause={() => setVideoPlaying(false)}
                              onEnded={() => setVideoPlaying(false)}
                              className="w-full h-full rounded-xl object-contain"
                            />
                            {!videoPlaying && (
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void videoRef.current?.play()
                                  }}
                                  aria-label={t("Reproduzir vídeo")}
                                  className="pointer-events-auto w-14 h-14 rounded-full bg-card/90 text-text border border-border shadow-glass-md flex items-center justify-center hover:scale-105 hover:border-accent transition-all backdrop-blur-md"
                                >
                                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current ml-0.5" aria-hidden="true">
                                    <polygon points="6,4 20,12 6,20" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="w-full flex-1 min-h-0 overflow-y-auto px-1 py-2 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-text truncate">
                                {activeArtifact.structuredData?.title || activeArtifact.title}
                              </div>
                              <span className="text-[11px] text-text-muted shrink-0">
                                {Array.isArray(activeArtifact.structuredData?.scenes)
                                  ? t('{count} cenas', { count: activeArtifact.structuredData.scenes.length })
                                  : activeArtifact.summary}
                              </span>
                            </div>
                            {(activeArtifact.structuredData?.description ||
                              activeArtifact.structuredData?.summary) && (
                                <p className="text-xs text-text-muted leading-relaxed">
                                  {activeArtifact.structuredData?.description ||
                                    activeArtifact.structuredData?.summary}
                                </p>
                              )}
                            {Array.isArray(activeArtifact.structuredData?.scenes) &&
                              activeArtifact.structuredData.scenes.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  {activeArtifact.structuredData.scenes.map((sc: any, idx: number) => (
                                    <div key={sc.id || idx} className="text-xs text-text-muted leading-relaxed">
                                      <span className="font-medium text-text">
                                        {idx + 1}. {sc.heading}:
                                      </span>{' '}
                                      {sc.narration}
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-text-muted text-center pt-8">{t("Não foi possível carregar a prévia do vídeo.")}</div>
                      )}
                    </div>
                  ) : Array.isArray(activeArtifact.previewSvgs) && activeArtifact.previewSvgs.length > 0 ? (
                    <div className="flex-1 min-h-0 w-full overflow-auto flex items-center justify-center p-1">
                      <div
                        style={{ zoom: previewZoom } as React.CSSProperties}
                        className="h-full max-w-full flex items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:w-auto [&>svg]:h-full [&>svg]:rounded-xl [&>svg]:shadow-glass-md"
                        dangerouslySetInnerHTML={{
                          __html: activeArtifact.previewSvgs[previewPageIdx] || activeArtifact.previewSvgs[0]
                        }}
                      />
                    </div>
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
                                  {sh.name || t('Aba {number}', { number: idx + 1 })}
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

                  {!(activeArtifact.toolId === 'video' && activeArtifact.exportFiles?.mp4) && Array.isArray(activeArtifact.previewSvgs) && activeArtifact.previewSvgs.length > 0 && (
                    <div className="flex items-center justify-center gap-3 text-xs text-text-muted flex-wrap">
                      {activeArtifact.previewSvgs.length > 1 && (
                        <>
                          <button
                            disabled={previewPageIdx <= 0}
                            onClick={() => setPreviewPageIdx((i) => Math.max(0, i - 1))}
                            className="h-7 px-3 rounded-lg border border-border bg-card text-text disabled:opacity-40"
                          >
                            {t("Anterior")}
                          </button>
                          <span className="tabular-nums">
                            {t('Página {current} de {total}', { current: previewPageIdx + 1, total: activeArtifact.previewSvgs.length })}
                          </span>
                          <button
                            disabled={previewPageIdx >= activeArtifact.previewSvgs.length - 1}
                            onClick={() =>
                              setPreviewPageIdx((i) => Math.min(activeArtifact.previewSvgs.length - 1, i + 1))
                            }
                            className="h-7 px-3 rounded-lg border border-border bg-card text-text disabled:opacity-40"
                          >
                            {t("Próxima")}
                          </button>
                        </>
                      )}
                      <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 h-7">
                        <button
                          type="button"
                          disabled={previewZoom <= 0.5}
                          onClick={() => setPreviewZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                          title={t("Diminuir zoom")}
                          aria-label={t("Diminuir zoom")}
                          className="w-6 h-5 rounded flex items-center justify-center text-text hover:bg-input disabled:opacity-40"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewZoom(1)}
                          title={t("Redefinir zoom")}
                          className="px-1.5 h-5 rounded text-[11px] font-medium text-text hover:bg-input tabular-nums"
                        >
                          {Math.round(previewZoom * 100)}%
                        </button>
                        <button
                          type="button"
                          disabled={previewZoom >= 2.5}
                          onClick={() => setPreviewZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                          title={t("Aumentar zoom")}
                          aria-label={t("Aumentar zoom")}
                          className="w-6 h-5 rounded flex items-center justify-center text-text hover:bg-input disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            {/* Coluna Direita: Progresso durante geração -> Exportar/Editar ao concluir */}
            <section className="bg-bg overflow-y-auto p-6 space-y-5">
              {view === 'generating' ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-card space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wider text-text-muted text-[10px]">
                        {t('Etapa {current} de {total}', { current: genStep + 1, total: GENERATING_STEPS.length })}
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
                    <div className="text-[11px] text-text-muted">{busyMessage || t('Processando...')}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-card space-y-3">
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
                                  ? 'bg-accent/15 text-accent'
                                  : 'bg-input text-transparent'
                                }`}
                            >
                              {done ? <IconCheck size={11} /> : current ? <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" /> : null}
                            </div>
                            <span className={current || done ? 'text-text font-medium' : 'text-text-muted'}>
                              {label}
                            </span>
                          </div>
                          <span className="text-[10px] text-text-muted">
                            {done ? t('concluído') : current ? t('em andamento') : t('aguardando')}
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
                    className="w-full h-9 rounded-xl bg-card text-xs font-medium text-text hover:bg-input"
                  >
                    {t("Cancelar geração")}
                  </button>
                </div>
              ) : activeArtifact ? (
                <>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-input">
                    {[
                      { id: 'preview', label: t('Prévia') },
                      { id: 'edit', label: t('Editar') },
                      { id: 'export', label: t('Exportar') }
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
                              <div className="text-[10px] text-text-muted">{t("Baixar")}</div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {Object.keys(activeArtifact.exportFiles || {})[0] && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void handleExport(Object.keys(activeArtifact.exportFiles)[0])}
                            className="flex-1 h-10 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-2"
                          >
                            <IconDownload size={14} />
                            <span>{t("Baixar")} {Object.keys(activeArtifact.exportFiles)[0].toUpperCase()}</span>
                          </button>
                          {activeArtifact.exportFiles?.pdf && (
                            <button
                              type="button"
                              onClick={() => void handleOpenPdf()}
                              className="h-10 px-4 rounded-xl bg-card border border-border text-text text-xs font-semibold hover:border-accent/60 flex items-center justify-center gap-1.5 shrink-0"
                            >
                              <IconFileText size={14} />
                              <span>{t("Abrir PDF")}</span>
                            </button>
                          )}
                        </div>
                      )}

                      <div className="pt-4 border-t border-border space-y-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("Opções de exportação")}
                        </div>
                        {[
                          { key: 'coverAndToc', label: t('Incluir capa e sumário') },
                          { key: 'applyLetterhead', label: t('Aplicar timbre da instituição') },
                          { key: 'aiReviewedBadge', label: t('Marcar como revisado pela IA') }
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
                      <AutocompleteTextarea
                        value={refineText}
                        onValueChange={setRefineText}
                        rows={4}
                        placeholder={t("Ex: Deixe o tom mais formal, resuma a conclusão em 3 pontos...")}
                        wrapperClassName="relative w-full"
                        overlayPaddingClassName="p-3 text-xs"
                        className="p-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                      />
                      {(() => {
                        const sizeCfg = getToolSizeConfig(activeArtifact.toolId)
                        return (
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-text-muted block">
                              {t(sizeCfg.label)}
                            </label>
                            <select
                              value={refineTargetSize}
                              onChange={(e) => setRefineTargetSize(e.target.value)}
                              className="w-full h-9 px-2.5 rounded-xl bg-input border border-border text-xs text-text focus:outline-none"
                            >
                              {sizeCfg.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value === 'auto' ? t('Automático (manter)') : t(opt.label)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      })()}
                      <button
                        onClick={() => void handleRefine()}
                        disabled={!refineText.trim() || Boolean(busyMessage)}
                        className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        {busyMessage ? t('Refinando...') : t('Aplicar revisão')}
                      </button>
                    </div>
                  )}

                  {exportTab === 'preview' && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-card border border-border space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-muted">{t("Status de qualidade")}</span>
                          <span className="text-success font-medium">
                            {activeArtifact.qaReport?.repairsApplied > 0 ? t('QA Visual auto-reparado') : t('QA Visual aprovado')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">{t("Versão atual")}</span>
                          <span className="text-text font-medium">v{activeArtifact.currentVersion || 1}</span>
                        </div>
                      </div>
                      {Array.isArray(activeArtifact.citations) && activeArtifact.citations.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                            {t("Citações rastreáveis")}
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
                </>
              ) : null}
            </section>
          </div>
        )}

      </div>
      {/* Responsive config overlay inside mdocs-root: fullscreen in windowed, centered horizontal modal when maximized */}
      {modal === 'generate_config' && (
        <div className="mdocs-config-backdrop">
          <div className="mdocs-config-dialog">
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm font-semibold text-text truncate">
                {`${activeToolSpec.emoji} ${configStep === 'sources' ? t('Fontes para {tool}', { tool: activeToolSpec.label }) : t('Configurar {tool}', { tool: activeToolSpec.label })}`}
              </h3>
              <div className="flex items-center rounded-lg bg-input p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfigStep('sources')}
                  className={`px-2.5 h-6 rounded-md text-[11px] font-medium transition-colors ${
                    configStep === 'sources' ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
                  }`}
                >
                  {t('1. Fontes ({count})', { count: sources.length })}
                </button>
                <button
                  type="button"
                  onClick={() => setConfigStep('config')}
                  className={`px-2.5 h-6 rounded-md text-[11px] font-medium transition-colors ${
                    configStep === 'config' ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
                  }`}
                >
                  {t("2. Configurar")}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModal('none')}
              className="w-8 h-8 rounded-xl bg-input text-text-muted hover:text-text flex items-center justify-center shrink-0"
              title={t("Fechar")}
            >
              <IconX size={15} />
            </button>
          </div>

          {configStep === 'sources' ? (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              <p className="text-xs text-text-muted leading-relaxed">
                {t("Adicione arquivos, links ou textos para fundamentar seu material, ou pule esta etapa para criar direto a partir das suas instruções.")}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start flex-1 min-h-0 overflow-y-auto">
                <div className="md:col-span-7 space-y-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-28 rounded-2xl border border-dashed border-border bg-input/50 hover:bg-input hover:border-accent/60 p-4 flex flex-col items-center justify-center gap-1.5 text-center transition-colors"
                  >
                    <IconUpload size={20} className="text-accent" />
                    <span className="text-xs font-semibold text-text">{t("Enviar arquivos do computador")}</span>
                    <span className="text-[11px] text-text-muted">{t("PDF, DOCX, PPTX, XLSX, TXT ou Markdown")}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInlineSourceMode((m) => (m === 'url' ? 'none' : 'url'))}
                      className={`flex-1 h-9 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        inlineSourceMode === 'url'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-input text-text hover:border-accent/50'
                      }`}
                    >
                      <IconGlobe size={13} />
                      <span>{t("Adicionar URL / YouTube")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineSourceMode((m) => (m === 'text' ? 'none' : 'text'))}
                      className={`flex-1 h-9 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        inlineSourceMode === 'text'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-input text-text hover:border-accent/50'
                      }`}
                    >
                      <IconFileText size={13} />
                      <span>{t("Colar texto")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineSourceMode((m) => (m === 'discover' ? 'none' : 'discover'))}
                      className={`flex-1 h-9 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        inlineSourceMode === 'discover'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-input text-text hover:border-accent/50'
                      }`}
                    >
                      <IconSparkles size={13} />
                      <span>{t("Descobrir")}</span>
                    </button>
                  </div>

                  {inlineSourceMode === 'discover' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          value={discoverQuery}
                          onChange={(e) => setDiscoverQuery(e.target.value)}
                          placeholder={t("Tema para buscar artigos e referências confiáveis...")}
                          className="flex-1 h-9 px-3 rounded-xl bg-input border border-border text-xs text-text focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          disabled={!discoverQuery.trim() || Boolean(busyMessage)}
                          onClick={async () => {
                            if (!activeProject || !discoverQuery.trim()) return
                            setBusyMessage(t("Buscando fontes confiáveis..."))
                            try {
                              const res = await sdk.api.post(`/extensions/${EXT_ID}/sources/discover`, { locale,
                                projectId: activeProject.id,
                                query: discoverQuery.trim(),
                                limit: 6
                              })
                              if (res?.ok && Array.isArray(res.data?.suggestions)) {
                                setSuggestions(res.data.suggestions)
                              }
                            } finally {
                              setBusyMessage(null)
                            }
                          }}
                          className="h-9 px-3.5 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-40 shrink-0"
                        >
                          {busyMessage ? t('Buscando...') : t('Buscar')}
                        </button>
                      </div>
                      {suggestions.length > 0 && (
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {suggestions.map((sug: any, idx: number) => (
                            <div
                              key={sug.url || idx}
                              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-input/60 border border-border/60 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-text truncate">{sug.title || sug.url}</div>
                                <div className="text-[10px] text-text-muted truncate">{sug.url}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void approveSuggestion(sug)}
                                className="h-7 px-2.5 rounded-lg bg-accent/15 text-accent text-[11px] font-semibold hover:bg-accent/25 shrink-0"
                              >
                                {t("+ Adicionar")}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {inlineSourceMode === 'url' && (
                    <div className="flex items-center gap-2">
                      <input
                        value={inlineSourceUrl}
                        onChange={(e) => setInlineSourceUrl(e.target.value)}
                        placeholder={t("https://... ou link do YouTube")}
                        className="flex-1 h-9 px-3 rounded-xl bg-input border border-border text-xs text-text focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        disabled={!inlineSourceUrl.trim()}
                        onClick={async () => {
                          const val = inlineSourceUrl.trim()
                          if (!val || !activeProject) return
                          setInlineSourceUrl('')
                          setInlineSourceMode('none')
                          await sdk.api.post(`/extensions/${EXT_ID}/sources`, { locale,
                            projectId: activeProject.id,
                            kind: 'url',
                            url: val
                          }).then((r: any) => {
                            if (r?.data?.source) {
                              setSources((prev) => [r.data.source, ...prev.filter((s) => s.id !== r.data.source.id)])
                              if (r.data.project) applyUpdatedProject(r.data.project)
                              else void maybeAutoTitleProject(r.data.source.title || val, activeProject.id)
                            }
                          })
                        }}
                        className="h-9 px-3.5 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-40"
                      >
                        {t("Adicionar")}
                      </button>
                    </div>
                  )}

                  {inlineSourceMode === 'text' && (
                    <div className="space-y-2">
                      <textarea
                        value={inlineSourceText}
                        onChange={(e) => setInlineSourceText(e.target.value)}
                        rows={3}
                        placeholder={t("Cole aqui notas, trechos ou informações de referência...")}
                        className="w-full p-2.5 rounded-xl bg-input border border-border text-xs text-text focus:outline-none focus:border-accent"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={!inlineSourceText.trim()}
                          onClick={async () => {
                            const val = inlineSourceText.trim()
                            if (!val || !activeProject) return
                            setInlineSourceText('')
                            setInlineSourceMode('none')
                            await sdk.api.post(`/extensions/${EXT_ID}/sources`, { locale,
                              projectId: activeProject.id,
                              kind: 'text',
                              title: t('Nota {time}', { time: new Date().toLocaleTimeString(locale) }),
                              text: val
                            }).then((r: any) => {
                              if (r?.data?.source) {
                                setSources((prev) => [r.data.source, ...prev.filter((s) => s.id !== r.data.source.id)])
                                if (r.data.project) applyUpdatedProject(r.data.project)
                                else void maybeAutoTitleProject(r.data.source.title || val, activeProject.id)
                              }
                            })
                          }}
                          className="h-8 px-3.5 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-40"
                        >
                          {t("Adicionar texto")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-5 rounded-2xl border border-border bg-card/50 p-3.5 space-y-2 max-h-[260px] overflow-y-auto">
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    {t('Fontes adicionadas ({count})', { count: sources.length })}
                  </div>
                  {sources.length === 0 ? (
                    <div className="py-6 text-center text-xs text-text-muted">
                      {t("Nenhuma fonte adicionada ainda.")}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {sources.map((src) => (
                        <div
                          key={src.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-input/70 text-xs"
                        >
                          <span className="truncate text-text">{src.title}</span>
                          {src.status === 'indexing' ? (
                            <span className="text-[10px] text-accent shrink-0 animate-pulse">{t("Adicionando...")}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleRemoveSource(src.id)}
                              title={t("Remover fonte")}
                              className="text-text-muted hover:text-error shrink-0"
                            >
                              <IconTrash size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 mt-auto">
                <button
                  type="button"
                  onClick={() => setModal('none')}
                  className="h-9 px-3.5 rounded-xl bg-input text-xs font-medium text-text hover:opacity-80"
                >
                  {t("Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfigStep('config')}
                  className="h-9 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                >
                  <span>{sources.length === 0 ? t('Pular fontes e configurar') : t('Continuar com {count} fonte(s)', { count: sources.length })}</span>
                  <IconChevronRight size={13} />
                </button>
              </div>
            </div>
          ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-5">
            <p className="text-xs text-text-muted leading-relaxed">{activeToolSpec.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              <div className="md:col-span-7 space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-text-muted block">{t("Instruções (opcional)")}</label>
                  <AutocompleteTextarea
                    autoFocus
                    value={instructions}
                    onValueChange={setInstructions}
                    rows={4}
                    placeholder={t("Ex: Direcionar ao diretor de obras, tom formal, incluir prazo de 15 dias...")}
                    wrapperClassName="relative w-full"
                    overlayPaddingClassName="p-2.5 text-xs"
                    className="p-2.5 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Anexos / Imagens para incluir dentro do documento */}
                {['oficio', 'letterhead', 'report', 'apostila', 'abnt', 'pptx', 'video', 'study_plan', 'meeting_minutes', 'contract', 'proposal', 'faq'].includes(selectedTool) && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-text-muted block">
                    {t("Anexos neste documento (imagens PNG/JPG)")}
                  </label>
                  <label className="flex items-center justify-center gap-2 h-9 px-3 rounded-xl border border-dashed border-border bg-input/50 hover:bg-input text-[11px] text-text cursor-pointer transition-colors">
                    <IconUpload size={13} className="text-text-muted" />
                    <span>{t("+ Enviar imagens para incluir no documento")}</span>
                    <input
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length === 0) return
                        const added: Array<{ id: string; name: string; base64: string }> = []
                        for (const f of files) {
                          const b64 = await fileToBase64(f)
                          added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: f.name, base64: b64 })
                        }
                        setDocAttachments((prev) => [...prev, ...added])
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {docAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {docAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-input text-[11px] text-text max-w-[190px]"
                        >
                          <img src={att.base64} alt={att.name} className="w-4 h-4 rounded object-cover shrink-0" />
                          <span className="truncate">{att.name}</span>
                          <button
                            type="button"
                            onClick={() => setDocAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                            className="text-text-muted hover:text-error shrink-0"
                            title={t("Remover anexo")}
                          >
                            <IconX size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>

              <div className="md:col-span-5 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-text-muted block">{t("Modelo de IA")}</label>
                    <select
                      value={selectedLlmModel}
                      onChange={(e) => setSelectedLlmModel(e.target.value)}
                      className="w-full h-9 pl-2.5 pr-6 rounded-xl bg-input border border-border text-xs text-text truncate focus:outline-none"
                    >
                      <option value="">{t("Automático (Padrão)")}</option>
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

                  {(() => {
                    const sizeCfg = getToolSizeConfig(selectedTool)
                    return (
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-text-muted block">{t(sizeCfg.label)}</label>
                        <select
                          value={targetSize}
                          onChange={(e) => setTargetSize(e.target.value)}
                          className="w-full h-9 pl-2.5 pr-6 rounded-xl bg-input border border-border text-xs text-text truncate focus:outline-none"
                        >
                          {sizeCfg.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.label)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })()}
                </div>

                {(selectedTool === 'video' || selectedTool === 'podcast') && (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-text-muted block">{t("Interlocutores")}</label>
                      <select
                        value={String(speakerCount)}
                        onChange={(e) => setSpeakerCount(e.target.value === '2' ? 2 : 1)}
                        title={t("Quantidade de interlocutores")}
                        className="w-full h-9 px-2.5 rounded-xl bg-input border border-border text-xs text-text focus:outline-none"
                      >
                        <option value="1">{t("1 (Solo)")}</option>
                        <option value="2">{t("2 (Diálogo)")}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-text-muted block">
                        {speakerCount === 2 ? 'Vozes' : 'Voz'}
                      </label>
                      {speakerCount === 2 ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={voiceA}
                            onChange={(e) => setVoiceA(e.target.value)}
                            title={t("Voz A")}
                            className="w-full h-9 px-2 rounded-xl bg-input border border-border text-xs text-text focus:outline-none"
                          >
                            <option value="">{t("Voz A (Auto)")}</option>
                            {voices.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                          <select
                            value={voiceB}
                            onChange={(e) => setVoiceB(e.target.value)}
                            title={t("Voz B")}
                            className="w-full h-9 px-2 rounded-xl bg-input border border-border text-xs text-text focus:outline-none"
                          >
                            <option value="">{t("Voz B (Auto)")}</option>
                            {voices.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <select
                          value={voiceA}
                          onChange={(e) => setVoiceA(e.target.value)}
                          title={t("Voz da narração")}
                          className="w-full h-9 px-2.5 rounded-xl bg-input border border-border text-xs text-text focus:outline-none"
                        >
                          <option value="">{t("Automática (Padrão)")}</option>
                          {voices.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-text-muted block">{t("Legendas")}</label>
                      <select
                        value={includeSubtitles ? 'on' : 'off'}
                        onChange={(e) => setIncludeSubtitles(e.target.value === 'on')}
                        title={t("Opções de legendas")}
                        className="w-full h-9 px-2.5 rounded-xl bg-input border border-border text-xs text-text focus:outline-none"
                      >
                        <option value="off">{t("Sem legendas")}</option>
                        <option value="on">{t("Incluir legendas (.srt)")}</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedTool === 'letterhead' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-text-muted block">{t("Timbre base")}</label>
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

                {/* Brasão / Logo, Cabeçalho e Rodapé rápidos */}
                {['oficio', 'letterhead', 'report', 'apostila', 'abnt', 'pptx', 'study_plan', 'meeting_minutes', 'contract', 'proposal', 'resume', 'faq'].includes(selectedTool) && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-input/65 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLogoDropdownOpen((o) => !o)}
                      className="w-full h-9 px-3 flex items-center justify-between text-xs font-medium text-text hover:bg-input transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{t("Brasão / Logo")}</span>
                        {(brandHeaderLogo || brandFooterLogo) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {logoDropdownOpen ? '▲' : '▼'}
                      </span>
                    </button>
                    {logoDropdownOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={logoSearchQuery}
                            onChange={(e) => setLogoSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && logoSearchQuery.trim() && !logoSearching) {
                                e.preventDefault()
                                void (async () => {
                                  setLogoSearching(true)
                                  try {
                                    const r = await sdk.api.post(`/extensions/${EXT_ID}/sources/discover`, {
                                      action: 'search_media',
                                      query: logoSearchQuery.trim(),
                                      limit: 6
                                    })
                                    setLogoSearchResults(Array.isArray(r?.data?.images) ? r.data.images : [])
                                  } finally {
                                    setLogoSearching(false)
                                  }
                                })()
                              }
                            }}
                            placeholder={t("Buscar brasão ou logo (ex.: Brasão de Curitiba)")}
                            className="flex-1 h-8 px-2.5 rounded-lg bg-card/70 text-[11px] text-text focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={!logoSearchQuery.trim() || logoSearching}
                            onClick={async () => {
                              if (!logoSearchQuery.trim()) return
                              setLogoSearching(true)
                              try {
                                const r = await sdk.api.post(`/extensions/${EXT_ID}/sources/discover`, {
                                  action: 'search_media',
                                  query: logoSearchQuery.trim(),
                                  limit: 6
                                })
                                setLogoSearchResults(Array.isArray(r?.data?.images) ? r.data.images : [])
                              } finally {
                                setLogoSearching(false)
                              }
                            }}
                            className="h-8 px-2.5 rounded-lg bg-accent text-bg text-[11px] font-semibold hover:opacity-90 disabled:opacity-40 shrink-0"
                          >
                            {logoSearching ? t("Buscando...") : t("Buscar")}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                          <span>{t("Aplicar em:")}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setLogoTarget('header')}
                              className={`px-2 py-0.5 rounded-md font-medium ${logoTarget === 'header' ? 'bg-accent text-bg' : 'bg-card/70 text-text'}`}
                            >
                              {t("Cabeçalho")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setLogoTarget('footer')}
                              className={`px-2 py-0.5 rounded-md font-medium ${logoTarget === 'footer' ? 'bg-accent text-bg' : 'bg-card/70 text-text'}`}
                            >
                              {t("Rodapé")}
                            </button>
                          </div>
                        </div>

                        {logoSearchResults.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto pr-0.5">
                            {logoSearchResults.map((img, i) => (
                              <button
                                key={`${img.title}-${i}`}
                                type="button"
                                onClick={() => {
                                  const picked = { name: img.title, base64: img.dataUrl }
                                  if (logoTarget === 'header') setBrandHeaderLogo(picked)
                                  else setBrandFooterLogo(picked)
                                }}
                                title={img.title}
                                className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-card/70 hover:bg-card border border-transparent hover:border-accent/50 transition-colors"
                              >
                                <img src={img.dataUrl} alt={img.title} className="w-10 h-10 object-contain rounded" />
                                <span className="text-[10px] text-text truncate w-full text-center">{img.title}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {(brandHeaderLogo || brandFooterLogo) && (
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-card/60 text-[11px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={(logoTarget === 'header' ? brandHeaderLogo : brandFooterLogo)?.base64 || brandHeaderLogo?.base64 || brandFooterLogo?.base64}
                                alt=""
                                className="w-5 h-5 object-contain rounded shrink-0"
                              />
                              <span className="truncate text-text">
                                {(logoTarget === 'header' ? brandHeaderLogo?.name : brandFooterLogo?.name) || brandHeaderLogo?.name || brandFooterLogo?.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (logoTarget === 'header') setBrandHeaderLogo(null)
                                else setBrandFooterLogo(null)
                              }}
                              className="text-[10px] text-error shrink-0"
                            >
                              {t("Remover")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl bg-input/65 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHeaderDropdownOpen((o) => !o)}
                      className="w-full h-9 px-3 flex items-center justify-between text-xs font-medium text-text hover:bg-input transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{t("Cabeçalho")}</span>
                        {(brandHeaderLogo || brandHeaderText.trim()) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {headerDropdownOpen ? '▲' : '▼'}
                      </span>
                    </button>
                    {headerDropdownOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex-1 flex items-center gap-2 px-2.5 h-8 rounded-lg bg-card/70 text-[11px] text-text cursor-pointer min-w-0">
                            {brandHeaderLogo ? <img src={brandHeaderLogo.base64} alt="" className="w-4 h-4 rounded object-cover shrink-0" /> : null}
                            <span className="truncate">{brandHeaderLogo ? brandHeaderLogo.name : '+ Enviar imagem'}</span>
                            <input
                              type="file"
                              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => void addBrandImageFromFile(e.target.files?.[0], 'header')}
                            />
                          </label>
                          {sdk.has?.('clipboard.read') && !brandHeaderLogo && (
                            <button type="button" onClick={() => void pasteBrandImageFromClipboard('header')} className="h-8 px-2 rounded-lg bg-card/70 text-[10px] text-text-muted">{t("Colar")}</button>
                          )}
                          {brandHeaderLogo && (
                            <button type="button" onClick={() => setBrandHeaderLogo(null)} className="text-[10px] text-error">{t("Remover")}</button>
                          )}
                        </div>
                        <input
                          value={brandHeaderText}
                          onChange={(e) => setBrandHeaderText(e.target.value)}
                          placeholder={t("Texto do cabeçalho (opcional)")}
                          className="w-full h-8 px-2.5 rounded-lg bg-card/70 text-[11px] text-text"
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-input/65 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFooterDropdownOpen((o) => !o)}
                      className="w-full h-9 px-3 flex items-center justify-between text-xs font-medium text-text hover:bg-input transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{t("Rodapé")}</span>
                        {(brandFooterLogo || brandFooterText.trim()) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {footerDropdownOpen ? '▲' : '▼'}
                      </span>
                    </button>
                    {footerDropdownOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex-1 flex items-center gap-2 px-2.5 h-8 rounded-lg bg-card/70 text-[11px] text-text cursor-pointer min-w-0">
                            {brandFooterLogo ? <img src={brandFooterLogo.base64} alt="" className="w-4 h-4 rounded object-cover shrink-0" /> : null}
                            <span className="truncate">{brandFooterLogo ? brandFooterLogo.name : '+ Enviar imagem'}</span>
                            <input
                              type="file"
                              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => void addBrandImageFromFile(e.target.files?.[0], 'footer')}
                            />
                          </label>
                          {sdk.has?.('clipboard.read') && !brandFooterLogo && (
                            <button type="button" onClick={() => void pasteBrandImageFromClipboard('footer')} className="h-8 px-2 rounded-lg bg-card/70 text-[10px] text-text-muted">{t("Colar")}</button>
                          )}
                          {brandFooterLogo && (
                            <button type="button" onClick={() => setBrandFooterLogo(null)} className="text-[10px] text-error">{t("Remover")}</button>
                          )}
                        </div>
                        <input
                          value={brandFooterText}
                          onChange={(e) => setBrandFooterText(e.target.value)}
                          placeholder={t("Texto do rodapé (opcional)")}
                          className="w-full h-8 px-2.5 rounded-lg bg-card/70 text-[11px] text-text"
                        />
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>

            <StyleCarouselSelector
              toolId={selectedTool}
              templates={toolTemplates}
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              brandKit={brandKit}
              onEditBrandKit={() => setModal('brand')}
            />

            <div className="flex items-center justify-between gap-2 pt-2 mt-auto">
              <button
                type="button"
                onClick={() => setConfigStep('sources')}
                className="h-9 px-3.5 rounded-xl bg-input text-xs font-medium text-text hover:opacity-80 flex items-center gap-1.5"
              >
                <IconChevronLeft size={13} />
                <span>{t('Fontes ({count})', { count: sources.length })}</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModal('none')}
                  className="h-9 px-3.5 rounded-xl bg-input text-xs font-medium text-text hover:opacity-80"
                >
                  {t("Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModal('none')
                    void handleGenerate()
                  }}
                  className="h-9 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                >
                  <IconSparkles size={13} />
                  <span>{t("Gerar agora")}</span>
                </button>
              </div>
            </div>
          </div>
          )}
          </div>
        </div>
      )}
      {/* Other overlays portaled to sdk.ui.overlayRoot() */}
      {modal !== 'none' && modal !== 'generate_config' &&
        createPortal(
          <div className="absolute inset-0 z-50 pointer-events-auto flex items-center justify-center bg-bg/75 p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4 shadow-glass-md max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">
                  {modal === 'new_project' && t('Novo projeto')}
                  {modal === 'rename_project' && t('Editar título do projeto')}
                  {modal === 'discover' && t('Descobrir fontes confiáveis')}
                  {modal === 'add_link' && (addLinkKind === 'text' ? t('Colar texto como fonte') : t('Adicionar URL ou YouTube'))}
                  {modal === 'queue' && t('Fila de tarefas')}
                  {modal === 'brand' && t('Timbre e identidade visual')}
                  {modal === 'credits' && t('Licenças e créditos')}
                  {modal === 'diagnostics' && t('Diagnóstico do ambiente')}
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
                    placeholder={t("Novo título do projeto")}
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    {t("Salvar título")}
                  </button>
                </form>
              )}

              {modal === 'new_project' && (
                <form onSubmit={handleCreateProject} className="space-y-3">
                  <input
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder={t("Nome do projeto (ex: Ofício prefeitura)")}
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                    required
                  />
                  <select
                    value={newProjProfile}
                    onChange={(e) => setNewProjProfile(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text"
                  >
                    <option value="general">{t("Perfil Geral")}</option>
                    <option value="student">{t("Estudante (ABNT, Flashcards)")}</option>
                    <option value="teacher">{t("Professor (Apostilas, Planos de Aula)")}</option>
                    <option value="lawyer">{t("Advogado (Ofícios, Timbrados)")}</option>
                    <option value="public_servant">{t("Servidor Público (Redação Oficial)")}</option>
                    <option value="executive">{t("Executivo (PPTX, Relatórios, Podcast)")}</option>
                  </select>
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    {t("Criar projeto")}
                  </button>
                </form>
              )}

              {modal === 'add_link' && (
                <form onSubmit={handleAddLinkSubmit} className="space-y-3">
                  {addLinkKind === 'text' ? (
                    <AutocompleteTextarea
                      value={addLinkValue}
                      onValueChange={setAddLinkValue}
                      rows={5}
                      placeholder={t("Cole aqui o texto de referência...")}
                      wrapperClassName="relative w-full"
                      overlayPaddingClassName="p-3 text-xs"
                      className="p-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                      required
                    />
                  ) : (
                    <input
                      value={addLinkValue}
                      onChange={(e) => setAddLinkValue(e.target.value)}
                      placeholder={t("https://...")}
                      className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                      required
                    />
                  )}
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    {t("Adicionar fonte")}
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
                    placeholder={t("Tema para buscar artigos e referências...")}
                    className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text placeholder:text-text-muted"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full h-9 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
                  >
                    {t("Buscar sugestões")}
                  </button>
                </form>
              )}

              {modal === 'brand' && (
                <div className="space-y-3 text-xs">
                  <p className="text-text-muted">
                    {t("Envie um documento ou imagem com o timbre da sua instituição para aplicar nos próximos ofícios e relatórios.")}
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
                      {t("Timbre carregado:")} <span className="font-medium">{letterheadFile.name}</span>
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
                    <p className="text-text-muted">{t("Nenhuma tarefa em segundo plano registrada.")}</p>
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
                            {t("Cancelar")}
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
                    {t("Todos os templates, fontes tipográficas e ícones permitem uso comercial:")}
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-text-muted">
                    <li>{t("Fontes: Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)")}</li>
                    <li>{t("Ícones: SVG internos inspirados em Lucide (ISC)")}</li>
                    <li>{t("Templates MomAI Docs: MIT (referência estrutural abnTeX2 LPPL 1.3c na ABNT)")}</li>
                    <li>{t("Bibliotecas: docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)")}</li>
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
                    {t("Copiar diagnóstico")}
                  </button>
                </div>
              )}
            </div>
          </div>,
          overlayTarget
        )}

      {artifactContextMenu && (
        <ContextMenu
          x={artifactContextMenu.x}
          y={artifactContextMenu.y}
          onClose={() => setArtifactContextMenu(null)}
          disableAutoAugment
          items={[
            {
              id: 'open',
              label: t('Abrir'),
              onClick: () => openArtifactItem(artifactContextMenu.artifact)
            },
            {
              id: 'download',
              label: t('Baixar'),
              onClick: () => void handleDownloadArtifact(artifactContextMenu.artifact)
            },
            {
              id: 'share',
              label: t('Compartilhar'),
              onClick: () => void handleShareArtifact(artifactContextMenu.artifact)
            },
            {
              id: 'rename',
              label: t('Renomear'),
              onClick: () => {
                setRenameArtifactTarget({
                  id: artifactContextMenu.artifact.id,
                  title: artifactContextMenu.artifact.title || ''
                })
              }
            },
            { divider: true },
            {
              id: 'delete',
              label: t('Excluir'),
              danger: true,
              onClick: () => void handleDeleteArtifact(artifactContextMenu.artifact)
            }
          ]}
        />
      )}

      {renameArtifactTarget && (
        <div
          className="absolute inset-0 z-50 pointer-events-auto bg-bg/75 flex items-center justify-center p-4"
          onClick={() => setRenameArtifactTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4 shadow-glass-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">{t("Renomear arquivo")}</h3>
              <button
                type="button"
                onClick={() => setRenameArtifactTarget(null)}
                className="text-text-muted hover:text-text"
              >
                <IconX size={15} />
              </button>
            </div>
            <input
              autoFocus
              value={renameArtifactTarget.title}
              onChange={(e) =>
                setRenameArtifactTarget((prev) => (prev ? { ...prev, title: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleConfirmRenameArtifact()
              }}
              className="w-full h-9 px-3 rounded-xl bg-input border border-border text-xs text-text focus:outline-none focus:border-accent"
              placeholder={t("Novo título...")}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameArtifactTarget(null)}
                className="h-8 px-3 rounded-xl bg-input text-xs font-medium text-text hover:opacity-80"
              >
                {t("Cancelar")}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRenameArtifact()}
                className="h-8 px-3.5 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90"
              >
                {t("Salvar")}
              </button>
            </div>
          </div>
        </div>
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
              label: t('Editar título'),
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
              label: projectContextMenu.project.pinned ? t('Desafixar do topo') : t('Fixar no topo'),
              onClick: () => {
                void handleTogglePinProject(projectContextMenu.project)
              }
            },
            { divider: true },
            {
              id: 'delete',
              label: t('Excluir'),
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
