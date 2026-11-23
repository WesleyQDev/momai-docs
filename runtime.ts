import { createIpcDocsStorage } from './storage-ipc.ts'
import type { HostBridge } from './src/core/types.ts'
import { StudioOrchestrator } from './src/core/studio-orchestrator.ts'
import { templateRegistry } from './src/core/templates/template-registry.ts'
import { saveBrandKit, getBrandKitForProject } from './src/core/templates/brand-kit.ts'
import { analyzeUserTemplateFile, saveCustomUserTemplate } from './src/core/templates/custom-template-importer.ts'

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
  { projectId: string; toolId: string; stage: string; percent: number; startedAt: number }
>()

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
          name: args.name || 'Novo Projeto',
          description: args.description,
          profile: args.profile,
          groundingMode: args.groundingMode
        })
        return { ok: true, project }
      }
      if (action === 'open') {
        const projects = await studio.listProjects()
        const project = projects.find((p) => p.id === args.projectId)
        if (!project) return { ok: false, error: 'Projeto não encontrado' }
        const sources = await bridge.collections.list('sources', { where: { projectId: project.id }, limit: 200 })
        const artifacts = await bridge.collections.list('artifacts', { where: { projectId: project.id }, limit: 200 })
        return { ok: true, project, sources, artifacts }
      }
      if (action === 'update' && args.projectId) {
        const projects = await studio.listProjects()
        const current = projects.find((p) => p.id === args.projectId)
        if (!current) return { ok: false, error: 'Projeto não encontrado' }
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
      if (action === 'export_bundle') {
        return { ok: true, ...(await studio.exportProjectBundle(args.projectId)) }
      }
      if (action === 'import_bundle') {
        const project = await studio.importProjectBundle(args.bundleBase64)
        return { ok: true, project }
      }
      return { ok: false, error: `Ação desconhecida: ${action}` }
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
        if (!rows[0]) return { ok: false, error: 'Fonte não encontrada' }
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
        pinned: args.pinned
      })
      return { ok: true, source }
    }

    case 'docs_source_discover': {
      const suggestions = await studio.discoverSources({
        projectId: args.projectId,
        query: args.query,
        limit: args.limit,
        includeYouTube: args.includeYouTube
      })
      return { ok: true, suggestions }
    }

    case 'docs_source_query': {
      const res = await studio.querySources({
        projectId: args.projectId,
        query: args.query,
        limit: args.limit,
        answerWithCitations: args.answerWithCitations !== false
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
      return {
        ok: true,
        artifacts,
        versions,
        activeGeneration: args.projectId
          ? activeGenerations.get(args.projectId) || null
          : Array.from(activeGenerations.values())[0] || null
      }
    }

    case 'docs_artifact_generate': {
      const jobId = typeof args.__jobId === 'string' ? args.__jobId : undefined
      const genKey = String(args.projectId || '__global__')
      activeGenerations.set(genKey, {
        projectId: genKey,
        toolId: String(args.toolId || 'report'),
        stage: 'preparing',
        percent: 10,
        startedAt: Date.now()
      })
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
          onProgress: (stage, percent, detail) => {
            const cur = activeGenerations.get(genKey)
            if (cur) {
              activeGenerations.set(genKey, { ...cur, stage, percent })
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
        return { ok: true, artifact }
      } finally {
        activeGenerations.delete(genKey)
      }
    }

    case 'docs_artifact_refine': {
      const artifact = await studio.refineArtifact({
        artifactId: args.artifactId,
        instruction: args.instruction,
        targetSectionOrSlide: args.targetSectionOrSlide,
        revertToVersion: args.revertToVersion
      })
      return { ok: true, artifact }
    }

    case 'docs_artifact_export': {
      const rows = (await bridge.collections.list('artifacts', {
        where: { id: args.artifactId },
        limit: 1
      })) as any[]
      const art = rows[0]
      if (!art) return { ok: false, error: 'Artefato não encontrado' }
      const relPath = art.exportFiles?.[args.format]
      if (!relPath) {
        return {
          ok: false,
          error: `Formato ${args.format} não disponível para este artefato. Disponíveis: ${Object.keys(art.exportFiles || {}).join(', ')}`
        }
      }
      const file = await bridge.sessionFiles.read(relPath)
      return {
        ok: true,
        fileName: relPath.split('/').pop(),
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
