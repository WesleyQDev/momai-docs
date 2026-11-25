import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createIpcDocsStorage } from './storage-ipc.ts'
import type { HostBridge } from './src/core/types.ts'
import { StudioOrchestrator } from './src/core/studio-orchestrator.ts'
import { normalizeLocale, defaultProjectName } from './src/core/i18n.ts'
import { translateCore } from './src/core/translate.ts'
import { templateRegistry } from './src/core/templates/template-registry.ts'
import { saveBrandKit, getBrandKitForProject } from './src/core/templates/brand-kit.ts'
import { analyzeUserTemplateFile, saveCustomUserTemplate } from './src/core/templates/custom-template-importer.ts'
import { searchWikimediaImages } from './src/core/media/wikimedia-image.ts'

function safeSend(msg: unknown) {
  try {
    if (typeof process.send === 'function') process.send(msg)
  } catch {}
}

let storageResponseListener: ((msg: any) => void) | null = null
const ipcBridge = createIpcDocsStorage({
  send: (msg) => safeSend(msg),
  onResponse: (fn) => {
    storageResponseListener = fn
  },
  storageDir: process.env.MOMAI_EXTENSION_STORAGE_DIR || 'momai-docs'
})

const bridge: HostBridge = {
  storage: ipcBridge.storage,
  collections: ipcBridge.collections,
  sessionFiles: ipcBridge.sessionFiles,
  log: (message: string) => safeSend({ type: 'log', message: String(message) }),
  sendEvent: (eventType: string, data: Record<string, unknown>) =>
    safeSend({ type: 'event', eventType, data }),
  sendStructuredResponse: (data: Record<string, unknown>) =>
    safeSend({ type: 'event', eventType: 'structured_response', data })
}

let orchestrator: StudioOrchestrator | null = null
const activeGenerations = new Map<
  string,
  {
    projectId: string
    toolId: string
    stage: string
    percent: number
    detail?: string
    status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
    artifact?: any
    error?: string
    startedAt: number
    finishedAt?: number
  }
>()
let generationQueue: Promise<void> = Promise.resolve()

function enqueueGeneration<T>(fn: () => Promise<T>): Promise<T> {
  const run = generationQueue.then(fn, fn)
  generationQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function getOrchestrator(): StudioOrchestrator {
  if (!orchestrator) orchestrator = new StudioOrchestrator(bridge)
  return orchestrator
}

async function reportHostJobProgress(jobId: string | undefined, stage: string, percent: number, detail?: string) {
  if (!jobId) return
  const baseUrl = (process.env.MOMAI_API_URL || 'http://127.0.0.1:8050').replace(/\/$/, '')
  await fetch(`${baseUrl}/extensions/jobs/${encodeURIComponent(jobId)}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': process.env.MOMAI_SESSION_TOKEN || ''
    },
    body: JSON.stringify({ stage, percent, detail }),
    signal: AbortSignal.timeout(5000)
  }).catch(() => {})
}

export async function execute(toolName: string, args: Record<string, any> = {}): Promise<any> {
  const studio = getOrchestrator()
  const locale = normalizeLocale(args.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const custom = await bridge.storage.get<any[]>('custom_templates').catch(() => null)
  if (Array.isArray(custom)) templateRegistry.setCustomTemplates(custom)

  switch (toolName) {
    case 'docs_route_projects':
    case 'docs_project_manage': {
      const action = args.action || 'list'
      if (action === 'list') {
        const list = await studio.listProjects()
        list.sort((a, b) => {
          const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
          if (pinDiff !== 0) return pinDiff
          return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
        })
        return { ok: true, projects: list }
      }
      if (action === 'create') {
        const project = await studio.createProject({
          name: args.name || defaultProjectName(locale),
          description: args.description,
          profile: args.profile,
          groundingMode: args.groundingMode,
          locale
        })
        return { ok: true, project }
      }
      if (action === 'open') {
        const projects = await studio.listProjects()
        const project = projects.find((p) => p.id === args.projectId)
        if (!project) return { ok: false, error: tr('Projeto não encontrado') }
        const sources = await bridge.collections.list('sources', { where: { projectId: project.id }, limit: 200 })
        const artifacts = await bridge.collections.list('artifacts', { where: { projectId: project.id }, limit: 200 })
        return { ok: true, project, sources, artifacts }
      }
      if (action === 'update' && args.projectId) {
        const projects = await studio.listProjects()
        const current = projects.find((p) => p.id === args.projectId)
        if (!current) return { ok: false, error: tr('Projeto não encontrado') }
        const updated = {
          ...current,
          name: typeof args.name === 'string' && args.name.trim() ? args.name.trim() : current.name,
          titleLocked: args.titleLocked !== undefined ? Boolean(args.titleLocked) : (current as any).titleLocked,
          pinned: args.pinned !== undefined ? Boolean(args.pinned) : (current as any).pinned,
          updatedAt: Date.now()
        }
        await bridge.collections.upsert('projects', updated as unknown as Record<string, unknown>)
        return { ok: true, project: updated }
      }
      if (action === 'delete') {
        return studio.deleteProject(args.projectId)
      }
      if (action === 'delete_many' && Array.isArray(args.projectIds)) {
        const deleted: string[] = []
        for (const pid of args.projectIds) {
          if (typeof pid === 'string' && pid) {
            await studio.deleteProject(pid)
            deleted.push(pid)
          }
        }
        return { ok: true, deleted }
      }
      if (action === 'export_bundle') {
        return { ok: true, ...(await studio.exportProjectBundle(args.projectId)) }
      }
      if (action === 'import_bundle') {
        const project = await studio.importProjectBundle(args.bundleBase64)
        return { ok: true, project }
      }
      return { ok: false, error: tr('Ação desconhecida: {action}', { action }) }
    }

    case 'docs_route_sources': {
      const sources = await bridge.collections.list('sources', {
        where: args.projectId ? { projectId: args.projectId } : undefined,
        limit: 200
      })
      return { ok: true, sources }
    }

    case 'docs_source_add': {
      if ((args.kind === 'remove' || args.action === 'delete') && args.sourceId) {
        const rows = (await bridge.collections.list('sources', { where: { id: args.sourceId }, limit: 1 })) as any[]
        await studio.rag.removeSourceChunks(args.sourceId)
        if (rows[0]?._rowId !== undefined) await bridge.collections.remove('sources', rows[0]._rowId)
        return { ok: true, removed: args.sourceId }
      }
      if ((args.kind === 'toggle_pin' || args.kind === 'toggle_active') && args.sourceId) {
        const rows = (await bridge.collections.list('sources', { where: { id: args.sourceId }, limit: 1 })) as any[]
        if (!rows[0]) return { ok: false, error: tr('Fonte não encontrada') }
        const updated = {
          ...rows[0],
          ...(args.kind === 'toggle_pin' ? { pinned: args.pinned ?? !rows[0].pinned } : {}),
          ...(args.kind === 'toggle_active' ? { active: args.active ?? !rows[0].active } : {}),
          updatedAt: Date.now()
        }
        await bridge.collections.upsert('sources', updated)
        return { ok: true, source: updated }
      }
      const source = await studio.addSource({
        projectId: args.projectId,
        kind: args.kind,
        title: args.title,
        fileName: args.fileName,
        mimeType: args.mimeType,
        contentBase64: args.contentBase64,
        text: args.text,
        url: args.url,
        pinned: args.pinned,
        locale
      })
      const updatedProject = await studio
        .maybeAutoTitleProjectFromSource(args.projectId, source, locale)
        .catch(() => null)
      return { ok: true, source, ...(updatedProject ? { project: updatedProject } : {}) }
    }

    case 'docs_source_discover': {
      if (args.action === 'search_media') {
        const images = await searchWikimediaImages(String(args.query || ''), Number(args.limit || 6))
        return { ok: true, images }
      }
      const suggestions = await studio.discoverSources({
        projectId: args.projectId,
        query: args.query,
        limit: args.limit,
        includeYouTube: args.includeYouTube,
        locale
      })
      return { ok: true, suggestions }
    }

    case 'docs_source_query': {
      const res = await studio.querySources({
        projectId: args.projectId,
        query: args.query,
        limit: args.limit,
        answerWithCitations: args.answerWithCitations !== false,
        history: Array.isArray(args.history) ? args.history : undefined,
        locale
      })
      return { ok: true, ...res }
    }

    case 'docs_templates_list': {
      if (args.action === 'analyze_user_template' && args.fileName && args.contentBase64) {
        const buf = Buffer.from(String(args.contentBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
        return { ok: true, analysis: analyzeUserTemplateFile(args.fileName, buf) }
      }
      if (args.action === 'save_user_template' && args.fileName && args.contentBase64) {
        const buf = Buffer.from(String(args.contentBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
        const manifest = await saveCustomUserTemplate({
          bridge,
          name: args.name || args.fileName,
          toolId: args.toolId || 'letterhead',
          fileName: args.fileName,
          buffer: buf,
          slots: args.slots || []
        })
        return { ok: true, template: manifest }
      }
      const templates = templateRegistry.search({
        toolId: args.toolId,
        category: args.category,
        query: args.query
      })
      return { ok: true, templates }
    }

    case 'docs_route_artifacts': {
      if (args.action === 'rename' && args.artifactId && typeof args.title === 'string') {
        const rows = (await bridge.collections.list('artifacts', {
          where: { id: args.artifactId },
          limit: 1
        })) as any[]
        const target = rows[0]
        if (!target) return { ok: false, error: tr('Artefato não encontrado') }
        const updated = { ...target, title: args.title.trim() || target.title, updatedAt: Date.now() }
        await bridge.collections.upsert('artifacts', updated)
        return { ok: true, artifact: updated }
      }
      if (args.action === 'delete' && args.artifactId) {
        const rows = (await bridge.collections.list('artifacts', {
          where: { id: args.artifactId },
          limit: 1
        })) as any[]
        if (rows[0]?._rowId !== undefined) {
          await bridge.collections.remove('artifacts', rows[0]._rowId)
        }
        return { ok: true }
      }
      const artifacts = await bridge.collections.list('artifacts', {
        where: args.projectId ? { projectId: args.projectId } : undefined,
        orderBy: 'createdAt',
        order: 'desc',
        limit: 100
      })
      const versions = args.artifactId
        ? await bridge.collections.list('artifact_versions', {
            where: { artifactId: args.artifactId },
            orderBy: 'versionNumber',
            order: 'desc',
            limit: 30
          })
        : []
      const activeForProject = Array.from(activeGenerations.values()).find(
        (g) => (!args.projectId || g.projectId === args.projectId) && (g.status === 'queued' || g.status === 'running')
      )
      const jobStatus =
        typeof args.requestId === 'string' && args.requestId
          ? activeGenerations.get(args.requestId) || null
          : null
      return {
        ok: true,
        artifacts,
        versions,
        jobStatus,
        activeGeneration: activeForProject || null
      }
    }

    case 'docs_artifact_generate': {
      if (typeof args.cancelRequestId === 'string' && args.cancelRequestId) {
        const completed = studio.cancelGeneration(args.cancelRequestId)
        const existing = activeGenerations.get(args.cancelRequestId)
        if (existing) {
          activeGenerations.set(args.cancelRequestId, {
            ...existing,
            status: 'cancelled',
            stage: 'cancelled',
            finishedAt: Date.now()
          })
        }
        return { ok: true, cancelled: true, artifact: completed || undefined }
      }
      const jobId = typeof args.__jobId === 'string' ? args.__jobId : undefined
      const requestId = typeof args.requestId === 'string' ? args.requestId : undefined
      const projId = String(args.projectId || '__global__')
      const genKey = requestId || projId

      // Prune finished entries older than 5 minutes
      const cutoff = Date.now() - 5 * 60_000
      for (const [k, v] of activeGenerations.entries()) {
        if (v.finishedAt && v.finishedAt < cutoff) activeGenerations.delete(k)
      }

      activeGenerations.set(genKey, {
        projectId: projId,
        toolId: String(args.toolId || 'report'),
        stage: 'queued',
        percent: 5,
        detail: tr('Na fila para geração...'),
        status: 'queued',
        startedAt: Date.now()
      })

      const jobPromise = enqueueGeneration(async () => {
        if (studio.isGenerationCancelled(requestId)) {
          activeGenerations.set(genKey, {
            projectId: projId,
            toolId: String(args.toolId || 'report'),
            stage: 'cancelled',
            percent: 0,
            status: 'cancelled',
            startedAt: Date.now(),
            finishedAt: Date.now()
          })
          return { ok: false, cancelled: true }
        }
        const curStart = activeGenerations.get(genKey)
        if (curStart) {
          activeGenerations.set(genKey, { ...curStart, status: 'running', stage: 'preparing', percent: 10 })
        }
        try {
          const artifact = await studio.generateArtifact({
            projectId: args.projectId,
            toolId: args.toolId,
            templateId: args.templateId,
            instructions: args.instructions,
            groundingMode: args.groundingMode,
            letterheadFileBase64: args.letterheadFileBase64,
            letterheadFileName: args.letterheadFileName,
            options: args.options,
            requestId,
            locale,
            onProgress: (stage, percent, detail) => {
              const cur = activeGenerations.get(genKey)
              if (cur) {
                activeGenerations.set(genKey, { ...cur, status: 'running', stage, percent, detail })
              }
              void reportHostJobProgress(jobId, stage, percent, detail)
            }
          })
          bridge.sendEvent('docs_artifact_ready', {
            artifactId: artifact.id,
            projectId: artifact.projectId,
            title: artifact.title,
            toolId: artifact.toolId
          })
          const curDone = activeGenerations.get(genKey)
          activeGenerations.set(genKey, {
            projectId: projId,
            toolId: String(args.toolId || 'report'),
            stage: 'done',
            percent: 100,
            status: 'done',
            artifact,
            startedAt: curDone?.startedAt || Date.now(),
            finishedAt: Date.now()
          })
          return { ok: true, artifact }
        } catch (err: any) {
          if (err?.message === '__CANCELLED__') {
            const curCancel = activeGenerations.get(genKey)
            activeGenerations.set(genKey, {
              projectId: projId,
              toolId: String(args.toolId || 'report'),
              stage: 'cancelled',
              percent: 0,
              status: 'cancelled',
              startedAt: curCancel?.startedAt || Date.now(),
              finishedAt: Date.now()
            })
            return { ok: false, cancelled: true }
          }
          const curErr = activeGenerations.get(genKey)
          const errMsg = err?.message || String(err)
          activeGenerations.set(genKey, {
            projectId: projId,
            toolId: String(args.toolId || 'report'),
            stage: 'error',
            percent: 0,
            status: 'error',
            error: errMsg,
            startedAt: curErr?.startedAt || Date.now(),
            finishedAt: Date.now()
          })
          if (args.async) return { ok: false, error: errMsg }
          throw err
        }
      })

      if (args.async) {
        void jobPromise.catch(() => {})
        return { ok: true, queued: true, requestId: genKey }
      }
      return jobPromise
    }

    case 'docs_artifact_refine': {
      const artifact = await studio.refineArtifact({
        artifactId: args.artifactId,
        instruction: args.instruction,
        targetSectionOrSlide: args.targetSectionOrSlide,
        revertToVersion: args.revertToVersion,
        targetSizeHint: args.targetSizeHint,
        locale
      })
      return { ok: true, artifact }
    }

    case 'docs_artifact_export': {
      const rows = (await bridge.collections.list('artifacts', {
        where: { id: args.artifactId },
        limit: 1
      })) as any[]
      const art = rows[0]
      if (!art) return { ok: false, error: tr('Artefato não encontrado') }
      const relPath = art.exportFiles?.[args.format]
      if (!relPath) {
        return {
          ok: false,
          error: tr('Formato {format} não disponível para este artefato. Disponíveis: {formats}', { format: args.format, formats: Object.keys(art.exportFiles || {}).join(', ') })
        }
      }
      const file = await bridge.sessionFiles.read(relPath)
      const fileName = relPath.split('/').pop() || `momai-docs.${args.format}`
      if (args.open === true) {
        const openDir = path.join(os.tmpdir(), 'momai-docs-open')
        fs.mkdirSync(openDir, { recursive: true })
        const safeName = path.basename(fileName).replace(/[^\w.\-]/g, '_') || `document.${args.format}`
        const outPath = path.join(openDir, `${Date.now()}-${safeName}`)
        fs.writeFileSync(outPath, Buffer.from(file.bytes))
        if (process.platform === 'win32') {
          spawn('cmd', ['/c', 'start', '', outPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          }).unref()
        } else if (process.platform === 'darwin') {
          spawn('open', [outPath], { detached: true, stdio: 'ignore' }).unref()
        } else {
          spawn('xdg-open', [outPath], { detached: true, stdio: 'ignore' }).unref()
        }
        return {
          ok: true,
          opened: true,
          fileName: safeName,
          format: args.format
        }
      }
      return {
        ok: true,
        fileName,
        format: args.format,
        base64: Buffer.from(file.bytes).toString('base64')
      }
    }

    case 'docs_route_brand_kits': {
      if (args.brandKit) {
        const saved = await saveBrandKit(bridge, args.brandKit)
        return { ok: true, brandKit: saved }
      }
      const brandKit = args.projectId ? await getBrandKitForProject(bridge, args.projectId) : null
      return { ok: true, brandKit }
    }

    case 'docs_route_diagnostics': {
      const caps = await studio.llm.getCapabilities().catch(() => null)
      const projectCount = await bridge.collections.count('projects')
      const sourceCount = await bridge.collections.count('sources')
      const artifactCount = await bridge.collections.count('artifacts')
      return {
        ok: true,
        diagnostics: {
          version: '1.0.0',
          capabilities: caps,
          counts: {
            projects: projectCount.count,
            sources: sourceCount.count,
            artifacts: artifactCount.count
          }
        }
      }
    }

    default:
      return { ok: false, error: `Ferramenta desconhecida: ${toolName}` }
  }
}

const heartbeat = setInterval(() => {
  safeSend({ type: 'heartbeat', timestamp: Date.now() })
}, 30000)
if (typeof heartbeat.unref === 'function') heartbeat.unref()

safeSend({ type: 'ready', worker: 'momai-docs' })

process.on('message', async (msg: any) => {
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'storage-response') {
    storageResponseListener?.(msg)
    return
  }
  if (msg.type === 'execute') {
    const { requestId } = msg
    const source = msg.payload || msg
    const { toolName, args } = source || {}
    try {
      const result = await execute(toolName, args)
      safeSend({ type: 'response', requestId, result })
    } catch (err: any) {
      safeSend({
        type: 'response',
        requestId,
        result: { ok: false, error: err?.message || String(err) }
      })
    }
  } else if (msg.type === 'shutdown') {
    process.exit(0)
  }
})

process.on('disconnect', () => process.exit(0))
