import { randomUUID } from 'node:crypto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { z } from 'zod'
import type {
  ArtifactRecord,
  ArtifactVersionRecord,
  BrandKit,
  CitationRef,
  ExportFormat,
  GroundingMode,
  HostBridge,
  ProjectRecord,
  SourceRecord,
  ToolId,
  UserProfile
} from './types.ts'
import { LLMGateway } from './llm/llm-gateway.ts'
import {
  buildChatSystemPrompt,
  buildGroundingSystemPrompt,
  buildOutlinePrompt,
  buildRefinePrompt,
  buildSlotFillPrompt
} from './llm/prompts/v1/index.ts'
import { chunkSections, ingestSource } from './rag/source-ingestor.ts'
import { discoverCuratedSources } from './rag/source-discovery.ts'
import { RagEngine } from './rag/rag-engine.ts'
import { normalizeLocale, outputLanguageRule, chatLanguageRule, defaultProjectName, isUntitledProject, type DocsLocale } from './i18n.ts'
import { translateCore } from './translate.ts'
import { templateRegistry } from './templates/template-registry.ts'
import { extractRequestedLogoQuery, fetchWikimediaImageDataUrl } from './media/wikimedia-image.ts'

const LOGO_CAPABLE_TOOLS = new Set<ToolId>([
  'oficio',
  'letterhead',
  'report',
  'apostila',
  'abnt',
  'pptx',
  'meeting_minutes',
  'contract'
])
import { createDefaultBrandKit, getBrandKitForProject, saveBrandKit } from './templates/brand-kit.ts'
import { renderDocxAndPdf } from './engines/docx-pdf-engine.ts'
import { analyzeLetterheadFile, fillDocxLetterhead, fillPdfLetterhead } from './engines/letterhead-engine.ts'
import { renderPptxAndPdf } from './engines/pptx-engine.ts'
import { renderPodcastArtifact } from './engines/podcast-engine.ts'
import { renderVideoArtifact } from './engines/video-engine.ts'
import {
  exportFlashcardsCsvAndAnki,
  renderMindMapOrTimelineSvg,
  renderXlsxWorkbook
} from './engines/study-data-engines.ts'

const OPEN_OBJECT_SCHEMA = z.record(z.string(), z.any())

export interface TrialState {
  firstUsedAt: number
  generationsCount: number
}

export class StudioOrchestrator {
  public readonly bridge: HostBridge
  public readonly llm: LLMGateway
  public readonly rag: RagEngine

  private cancelledRequestIds = new Set<string>()
  private completedByRequestId = new Map<string, ArtifactRecord>()

  constructor(bridge: HostBridge, llm?: LLMGateway, rag?: RagEngine) {
    this.bridge = bridge
    this.llm = llm || new LLMGateway()
    this.rag = rag || new RagEngine(bridge)
  }

  cancelGeneration(requestId: string): ArtifactRecord | null {
    if (requestId) this.cancelledRequestIds.add(requestId)
    return this.completedByRequestId.get(requestId) || null
  }

  isGenerationCancelled(requestId?: string): boolean {
    return Boolean(requestId && this.cancelledRequestIds.has(requestId))
  }

  async ensureOnboardingSampleProject(): Promise<ProjectRecord[]> {
    const existing = (await this.bridge.collections.list('projects', { limit: 500 })) as ProjectRecord[]
    if (existing.length > 0) return existing

    const alreadySeeded = await this.bridge.storage.get<boolean>('onboarding_sample_seeded').catch(() => false)
    if (alreadySeeded) return []
    await this.bridge.storage.set('onboarding_sample_seeded', true)

    const projectId = 'proj-exemplo-onboarding'
    const now = Date.now()
    const sampleProject: ProjectRecord = {
      id: projectId,
      name: 'Exemplo: Relatório de Sustentabilidade & Estudo',
      description: 'Projeto de exemplo pré-carregado para testar todas as ferramentas com citações.',
      profile: 'general',
      groundingMode: 'sources_only',
      archived: false,
      isExample: true,
      createdAt: now,
      updatedAt: now
    }
    await this.bridge.collections.upsert('projects', sampleProject as unknown as Record<string, unknown>)

    const sampleText = [
      '# Relatório Anual de Eficiência Energética 2026',
      'Em 2026, a unidade piloto reduziu o consumo de energia elétrica em 28% após a adoção de iluminação LED e sensores de presença.',
      'A economia financeira acumulada no exercício foi de R$ 420.000,00, com retorno do investimento (payback) em 14 meses.',
      '## Metas para 2027',
      '1. Expandir energia solar fotovoltaica para 60% da demanda diurna.',
      '2. Treinar 100% das equipes operacionais em boas práticas de eficiência até junho de 2027.'
    ].join('\n\n')

    await this.addSource({
      projectId,
      kind: 'text',
      title: 'Relatório Piloto 2026 (Exemplo)',
      text: sampleText,
      pinned: true
    })

    return [sampleProject]
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return this.ensureOnboardingSampleProject()
  }

  async createProject(opts: {
    name: string
    description?: string
    profile?: UserProfile
    groundingMode?: GroundingMode
    locale?: DocsLocale
  }): Promise<ProjectRecord> {
    const locale = normalizeLocale(opts.locale)
    const now = Date.now()
    const project: ProjectRecord = {
      id: `proj-${randomUUID().slice(0, 8)}`,
      name: opts.name.trim() || defaultProjectName(locale),
      description: (opts.description || '').trim(),
      profile: opts.profile || 'general',
      groundingMode: opts.groundingMode || 'sources_only',
      archived: false,
      createdAt: now,
      updatedAt: now
    }
    await this.bridge.collections.upsert('projects', project as unknown as Record<string, unknown>)
    const isPlaceholder = isUntitledProject(project.name, locale)
    await saveBrandKit(this.bridge, createDefaultBrandKit(project.id, isPlaceholder ? '' : project.name))
    return project
  }

  async deleteProject(projectId: string): Promise<{ ok: boolean }> {
    const projects = (await this.bridge.collections.list('projects', { where: { id: projectId }, limit: 1 })) as any[]
    if (projects[0]?._rowId !== undefined) {
      await this.bridge.collections.remove('projects', projects[0]._rowId)
    }
    const sources = (await this.bridge.collections.list('sources', { where: { projectId }, limit: 200 })) as any[]
    for (const s of sources) {
      await this.rag.removeSourceChunks(s.id)
      if (s._rowId !== undefined) await this.bridge.collections.remove('sources', s._rowId)
    }
    const artifacts = (await this.bridge.collections.list('artifacts', { where: { projectId }, limit: 200 })) as any[]
    for (const a of artifacts) {
      if (a._rowId !== undefined) await this.bridge.collections.remove('artifacts', a._rowId)
    }
    return { ok: true }
  }

  async addSource(opts: {
    projectId: string
    kind: 'file' | 'url' | 'youtube' | 'text'
    title?: string
    fileName?: string
    mimeType?: string
    contentBase64?: string
    text?: string
    url?: string
    pinned?: boolean
    locale?: DocsLocale
  }): Promise<SourceRecord> {
    const sourceId = `src-${randomUUID().slice(0, 8)}`
    const now = Date.now()
    const ingested = await ingestSource({
      projectId: opts.projectId,
      sourceId,
      kind: opts.kind,
      title: opts.title,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      contentBase64: opts.contentBase64,
      text: opts.text,
      url: opts.url,
      locale: opts.locale,
      llm: this.llm,
      bridge: this.bridge
    })

    // Deduplicate by contentHash inside the same project
    const existing = (await this.bridge.collections.list('sources', {
      where: { projectId: opts.projectId, contentHash: ingested.contentHash },
      limit: 1
    })) as SourceRecord[]
    if (existing[0]) return existing[0]

    const caps = await this.llm.getCapabilities().catch(() => null)
    const maxChunkChars = caps ? this.llm.recommendedRetrievalConfig(caps).maxChunkChars : 1100
    const chunks = chunkSections({
      projectId: opts.projectId,
      sourceId,
      sourceTitle: ingested.title,
      sections: ingested.sections,
      maxChunkChars
    })

    if (chunks.length > 0) {
      // Persist text chunks right away so retrieval works immediately, then compute
      // vector embeddings in the background without blocking the import UI.
      await this.bridge.collections.upsertMany(
        'chunks',
        chunks as unknown as Array<Record<string, unknown>>
      )
      void this.rag.indexChunks(chunks).catch(() => {})
    }

    const record: SourceRecord = {
      id: sourceId,
      projectId: opts.projectId,
      kind: opts.kind,
      title: ingested.title,
      originUrl: opts.url,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      status: 'ready',
      pinned: Boolean(opts.pinned),
      active: true,
      contentHash: ingested.contentHash,
      totalChars: ingested.totalChars,
      totalChunks: chunks.length,
      pageCount: ingested.pageCount,
      summary: ingested.summary,
      extractedImages: ingested.extractedImages,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now
    }
    await this.bridge.collections.upsert('sources', record as unknown as Record<string, unknown>)
    return record
  }

  async maybeAutoTitleProjectFromSource(
    projectId: string,
    source: SourceRecord,
    localeInput?: DocsLocale
  ): Promise<ProjectRecord | null> {
    if (!projectId) return null
    const locale = normalizeLocale(localeInput)
    const projects = (await this.bridge.collections.list('projects', {
      where: { id: projectId },
      limit: 1
    })) as ProjectRecord[]
    const project = projects[0]
    if (!project || project.titleLocked) return null
    const curName = String(project.name || '').trim()
    if (curName && !isUntitledProject(curName, locale)) return null

    const fallbackTitle = String(source.title || '')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/^https?:\/\/(www\.)?/i, '')
      .trim()
      .slice(0, 56)

    let nextTitle = fallbackTitle
    try {
      const titleLanguage = outputLanguageRule(locale)
      const res = await this.llm.completeText({
        system: `You create short, clear project titles (3 to 6 words) for study and document projects. ${titleLanguage} Reply only with the title, without quotes, final punctuation or explanations.`,
        user: `Source title: ${source.title}\nSummary: ${String(source.summary || '').slice(0, 500)}`,
        temperature: 0.2,
        maxTokens: 36,
        timeoutMs: 12_000
      })
      const candidate = String(res.text || '')
        .replace(/^["'«»*#\s]+|["'«»*.\s]+$/g, '')
        .split('\n')[0]
        .trim()
        .slice(0, 56)
      if (candidate && !isUntitledProject(candidate, locale)) {
        nextTitle = candidate
      }
    } catch {
      // Fallback to cleaned source title when LLM is unavailable/busy
    }

    if (!nextTitle || isUntitledProject(nextTitle, locale)) return null
    const updated: ProjectRecord = {
      ...project,
      name: nextTitle,
      updatedAt: Date.now()
    }
    await this.bridge.collections.upsert('projects', updated as unknown as Record<string, unknown>)
    return updated
  }

  async discoverSources(opts: { projectId: string; query: string; limit?: number; includeYouTube?: boolean; locale?: DocsLocale }) {
    return discoverCuratedSources(opts)
  }

  async querySources(opts: {
    projectId: string
    query: string
    limit?: number
    answerWithCitations?: boolean
    groundingMode?: GroundingMode
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    locale?: DocsLocale
  }) {
    const locale = normalizeLocale(opts.locale)
    const ragRes = await this.rag.retrieve({
      projectId: opts.projectId,
      query: opts.query,
      limit: opts.limit || 8
    })
    if (!opts.answerWithCitations) {
      return { hits: ragRes.chunks, citations: ragRes.citations }
    }
    const hasSources = ragRes.chunks.length > 0
    const system = buildChatSystemPrompt({
      hasSources,
      groundingMode: opts.groundingMode || 'sources_only',
      locale
    })
    const userPrompt = hasSources
      ? `${chatLanguageRule(locale)}\n\nUser message: ${opts.query}\n\nSources (<source_data>):\n${ragRes.contextText}\n\nReply in natural text, citing sources and locators when you use information from them.`
      : `${chatLanguageRule(locale)}\n\nUser message: ${opts.query}`
    const sanitizedHistory = Array.isArray(opts.history)
      ? opts.history
          .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.trim())
          .slice(-12)
          .map((h) => ({ role: h.role, content: h.content.trim().slice(0, 4000) }))
      : []
    const res = await this.llm.completeText({
      system,
      history: sanitizedHistory,
      user: userPrompt,
      format: 'text'
    })
    return { answer: res.text, citations: ragRes.citations, provider: res.provider, model: res.model }
  }

  async checkAndConsumeTrialOrEntitlement(_entitledFromHost: boolean): Promise<{
    allowed: boolean
    reason?: string
    trialGenerationsLeft?: number
  }> {
    return { allowed: true }
  }

  async generateArtifact(opts: {
    projectId: string
    toolId: ToolId
    templateId?: string
    instructions?: string
    groundingMode?: GroundingMode
    letterheadFileBase64?: string
    letterheadFileName?: string
    options?: Record<string, any>
    requestId?: string
    locale?: DocsLocale
    onProgress?: (stage: string, percent: number, detail?: string) => void
  }): Promise<ArtifactRecord> {
    const locale = normalizeLocale(opts.locale)
    const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
    const checkCancelled = () => {
      if (opts.requestId && this.cancelledRequestIds.has(opts.requestId)) {
        this.cancelledRequestIds.delete(opts.requestId)
        throw new Error('__CANCELLED__')
      }
    }
    const reportProgress = (stage: string, percent: number, detail?: string) => {
      opts.onProgress?.(stage, percent, detail)
    }

    checkCancelled()

    reportProgress('planning', 10, tr('Carregando template e capacidades do modelo...'))
    const projects = (await this.bridge.collections.list('projects', { where: { id: opts.projectId }, limit: 1 })) as ProjectRecord[]
    const project = projects[0]
    const requestedMode: GroundingMode = opts.groundingMode || project?.groundingMode || 'sources_only'
    const isBrandMode = opts.templateId === '__brand__'
    const template =
      (!isBrandMode && opts.templateId ? templateRegistry.getById(opts.templateId) : undefined) ||
      templateRegistry.getDefaultForTool(opts.toolId)
    const savedBrandKit = (await getBrandKitForProject(this.bridge, opts.projectId)) || undefined
    const hasBrandOverrides = Boolean(
      opts.options?.brandLogoBase64 ||
      opts.options?.brandHeaderLogoBase64 ||
      opts.options?.brandFooterLogoBase64 ||
      opts.options?.brandHeaderText ||
      opts.options?.brandFooterText ||
      opts.options?.brandHeaderAlign ||
      opts.options?.brandFooterAlign ||
      opts.options?.brandLogoInHeader !== undefined ||
      opts.options?.brandLogoInFooter !== undefined ||
      opts.options?.brandPlacement
    )
    let brandKit: BrandKit | undefined = hasBrandOverrides
      ? {
          ...(savedBrandKit || createDefaultBrandKit(opts.projectId)),
          logoDataUrl:
            typeof opts.options?.brandLogoBase64 === 'string' && opts.options.brandLogoBase64
              ? opts.options.brandLogoBase64
              : savedBrandKit?.logoDataUrl,
          headerLogoDataUrl:
            typeof opts.options?.brandHeaderLogoBase64 === 'string' && opts.options.brandHeaderLogoBase64
              ? opts.options.brandHeaderLogoBase64
              : typeof opts.options?.brandLogoBase64 === 'string' && opts.options.brandLogoBase64
                ? opts.options.brandLogoBase64
                : savedBrandKit?.headerLogoDataUrl,
          footerLogoDataUrl:
            typeof opts.options?.brandFooterLogoBase64 === 'string' && opts.options.brandFooterLogoBase64
              ? opts.options.brandFooterLogoBase64
              : savedBrandKit?.footerLogoDataUrl,
          headerAlign:
            opts.options?.brandHeaderAlign === 'left' || opts.options?.brandHeaderAlign === 'center' || opts.options?.brandHeaderAlign === 'right'
              ? opts.options.brandHeaderAlign
              : savedBrandKit?.headerAlign || 'right',
          footerAlign:
            opts.options?.brandFooterAlign === 'left' || opts.options?.brandFooterAlign === 'center' || opts.options?.brandFooterAlign === 'right'
              ? opts.options.brandFooterAlign
              : savedBrandKit?.footerAlign || 'right',
          logoInHeader:
            opts.options?.brandLogoInHeader !== undefined
              ? Boolean(opts.options.brandLogoInHeader)
              : opts.options?.brandPlacement === 'footer'
                ? false
                : true,
          logoInFooter:
            opts.options?.brandLogoInFooter !== undefined
              ? Boolean(opts.options.brandLogoInFooter)
              : opts.options?.brandPlacement === 'footer' || opts.options?.brandPlacement === 'both',
          logoPlacement:
            opts.options?.brandPlacement === 'footer' || opts.options?.brandPlacement === 'both'
              ? opts.options.brandPlacement
              : 'header',
          headerText:
            typeof opts.options?.brandHeaderText === 'string' && opts.options.brandHeaderText.trim()
              ? opts.options.brandHeaderText.trim()
              : savedBrandKit?.headerText,
          footerText:
            typeof opts.options?.brandFooterText === 'string' && opts.options.brandFooterText.trim()
              ? opts.options.brandFooterText.trim()
              : savedBrandKit?.footerText
        }
      : savedBrandKit

    if (
      LOGO_CAPABLE_TOOLS.has(opts.toolId) &&
      !brandKit?.headerLogoDataUrl &&
      !brandKit?.logoDataUrl &&
      opts.instructions
    ) {
      const requestedLogoQuery = extractRequestedLogoQuery(opts.instructions)
      if (requestedLogoQuery) {
        const fetchedLogo = await fetchWikimediaImageDataUrl(requestedLogoQuery, undefined, 400)
        if (fetchedLogo) {
          brandKit = {
            ...(brandKit || createDefaultBrandKit(opts.projectId, requestedLogoQuery)),
            logoDataUrl: fetchedLogo,
            headerLogoDataUrl: fetchedLogo,
            logoInHeader: true,
            logoPlacement: 'header'
          }
        }
      }
    }

    const tokens = templateRegistry.applyBrandKit(template, brandKit)
    const caps = await this.llm.getCapabilities()
    const retrievalCfg = this.llm.recommendedRetrievalConfig(caps)

    reportProgress('retrieving', 25, tr('Buscando trechos relevantes nas fontes (Gemma Embedding + FTS5)...'))
    const ragRes = await this.rag.retrieve({
      projectId: opts.projectId,
      query: opts.instructions || `${template.name} ${project?.name || ''}`,
      limit: retrievalCfg.topK,
      maxChars: retrievalCfg.topK * retrievalCfg.maxChunkChars
    })

    if (ragRes.chunks.length === 0 && requestedMode === 'sources_only' && !opts.instructions?.trim() && !project?.name?.trim()) {
      throw new Error(tr('Adicione ao menos uma fonte ou preencha as instruções antes de gerar.'))
    }
    const groundingMode: GroundingMode = ragRes.chunks.length === 0 ? 'sources_plus_general' : requestedMode

    const systemPrompt = buildGroundingSystemPrompt({
      groundingMode,
      locale,
      compact: this.llm.isCompactModel(caps),
      hasSources: ragRes.chunks.length > 0,
      toolId: opts.toolId
    })

    const attachmentItems: Array<{ name: string; base64: string; caption?: string }> = Array.isArray(opts.options?.attachments)
      ? opts.options.attachments
      : []
    const attachmentNote =
      attachmentItems.length > 0
        ? `\n\n[Anexos visuais incluídos neste documento pelo usuário: ${attachmentItems.map((a) => a.caption || a.name).join(', ')}. Esses arquivos serão embutidos na seção "Anexos" ao final do documento; mencione-os no texto quando apropriado.]`
        : ''
    const baseTopic =
      opts.instructions?.trim() ||
      (project?.name && !isUntitledProject(project.name, locale) ? project.name.trim() : '')
    const effectiveInstructions = `${baseTopic}${attachmentNote}`.trim()

    const targetSizeHint =
      typeof opts.options?.targetSizeHint === 'string' && opts.options.targetSizeHint.trim()
        ? opts.options.targetSizeHint.trim()
        : undefined

    // Map-reduce outline step for large materials or compact models
    let outlineJson: string | undefined
    if (retrievalCfg.useOutlineFirst || ['apostila', 'abnt', 'report', 'pptx', 'video'].includes(opts.toolId)) {
      reportProgress('outlining', 40, tr('Estruturando outline fundamentado nas fontes...'))
      const sources = (await this.bridge.collections.list('sources', { where: { projectId: opts.projectId }, limit: 50 })) as SourceRecord[]
      const summaries = sources.map((s) => `- [${s.id}] ${s.title}: ${s.summary}`).join('\n')
      const outlineRes = await this.llm.completeText({
        system: systemPrompt,
        user: buildOutlinePrompt({
          toolId: opts.toolId,
          templateName: template.name,
          instructions: effectiveInstructions,
          sourceSummaries: summaries,
          compact: this.llm.isCompactModel(caps),
          targetSizeHint
        }),
        format: 'json'
      })
      outlineJson = outlineRes.text
    }

    reportProgress('drafting', 58, tr('Redigindo conteúdo estruturado e validando schema...'))
    const brandNote = isBrandMode && brandKit
      ? ` Priorize a identidade do timbre do usuário (${brandKit.institutionName || brandKit.name || 'Kit de Marca'}), mantendo liberdade criativa na organização visual dos blocos.`
      : ''
    const speakerCount: 1 | 2 =
      opts.options?.speakerCount === 1 ? 1 : opts.options?.speakerCount === 2 ? 2 : opts.toolId === 'podcast' ? 2 : 1
    const fillPrompt = buildSlotFillPrompt({
      toolId: opts.toolId,
      templateName: isBrandMode ? `${template.name} (Timbre do Usuário)` : template.name,
      styleGuide: `${template.styleGuideForAgent}${brandNote}`,
      slots: template.slots,
      contextBlocks: ragRes.contextText,
      instructions: effectiveInstructions,
      outlineJson,
      targetSizeHint,
      speakerCount
    })

    checkCancelled()
    const structuredRes = await this.llm.completeStructured({
      system: systemPrompt,
      user: fillPrompt,
      schema: OPEN_OBJECT_SCHEMA,
      slots: template.slots
    })

    checkCancelled()
    const structuredData = structuredRes.data
    const citations: CitationRef[] = Array.isArray(structuredData.citations)
      ? structuredData.citations
      : ragRes.citations

    reportProgress('rendering', 75, tr('Renderizando artefato final e pré-visualizações...'))
    const artifactId = `art-${randomUUID().slice(0, 8)}`
    const rendered = await this.renderArtifactOutputs({
      artifactId,
      versionNumber: 1,
      toolId: opts.toolId,
      templateId: template.id,
      tokens,
      structuredData,
      brandKit,
      letterheadFileBase64: opts.letterheadFileBase64,
      letterheadFileName: opts.letterheadFileName,
      options: opts.options,
      locale
    })

    reportProgress('visual_qa', 92, tr('Executando checagem de qualidade visual automática...'))
    const now = Date.now()
    const title = String(
      structuredData.title ||
        structuredData.documentTitle ||
        structuredData.documentNumber ||
        structuredData.deckTitle ||
        structuredData.rootLabel ||
        structuredData.workbookTitle ||
        structuredData.fullName ||
        template.name
    )

    const artifact: ArtifactRecord = {
      id: artifactId,
      projectId: opts.projectId,
      toolId: opts.toolId,
      templateId: template.id,
      title,
      summary: `${template.name} • ${tr('{count} citações', { count: citations.length })}`,
      status: 'ready',
      currentVersion: 1,
      groundingMode,
      providerUsed: structuredRes.provider,
      modelUsed: structuredRes.model,
      structuredData,
      citations,
      previewSvgs: rendered.previewSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      createdAt: now,
      updatedAt: now
    }

    const versionRecord: ArtifactVersionRecord = {
      id: `${artifactId}-v1`,
      artifactId,
      versionNumber: 1,
      instruction: opts.instructions || tr('Geração inicial'),
      structuredData,
      citations,
      previewSvgs: rendered.previewSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      createdAt: now
    }

    checkCancelled()
    await this.bridge.collections.upsert('artifacts', artifact as unknown as Record<string, unknown>)
    await this.bridge.collections.upsert('artifact_versions', versionRecord as unknown as Record<string, unknown>)

    // Auto-title placeholder project using the LLM-generated artifact title
    if (
      project &&
      !project.titleLocked &&
      title &&
      isUntitledProject(project.name, locale)
    ) {
      const updatedProject: ProjectRecord = {
        ...project,
        name: title.slice(0, 64),
        updatedAt: now
      }
      await this.bridge.collections.upsert('projects', updatedProject as unknown as Record<string, unknown>)
    }
    if (opts.requestId) {
      this.completedByRequestId.set(opts.requestId, artifact)
      if (this.completedByRequestId.size > 30) {
        const oldestKey = this.completedByRequestId.keys().next().value
        if (oldestKey) this.completedByRequestId.delete(oldestKey)
      }
    }
    reportProgress('done', 100, tr('Artefato pronto!'))
    return artifact
  }

  private async renderArtifactOutputs(opts: {
    artifactId: string
    versionNumber: number
    toolId: ToolId
    templateId: string
    tokens: any
    structuredData: Record<string, any>
    brandKit?: BrandKit | null
    letterheadFileBase64?: string
    letterheadFileName?: string
    options?: Record<string, any>
    locale?: DocsLocale
  }): Promise<{
    previewSvgs: string[]
    exportFiles: Partial<Record<ExportFormat, string>>
    qaReport: any
  }> {
    const baseDir = `artifacts/${opts.artifactId}/v${opts.versionNumber}`
    const exportFiles: Partial<Record<ExportFormat, string>> = {}

    if (opts.toolId === 'letterhead' && opts.letterheadFileBase64) {
      const raw = opts.letterheadFileBase64.replace(/^data:[^;]+;base64,/, '')
      const tplBuf = Buffer.from(raw, 'base64')
      const isPdf = (opts.letterheadFileName || '').toLowerCase().endsWith('.pdf')
      if (isPdf) {
        const analysis = await analyzeLetterheadFile(opts.letterheadFileName || 'timbrado.pdf', tplBuf)
        const pdfRes = await fillPdfLetterhead({
          templateBuffer: tplBuf,
          documentTitle: opts.structuredData.documentTitle,
          fields: opts.structuredData.fields,
          paragraphs: Array.isArray(opts.structuredData.paragraphs) ? opts.structuredData.paragraphs : [],
          signatureBlock: opts.structuredData.signatureBlock,
          safeZone: analysis.safeZone
        })
        const pdfPath = `${baseDir}/timbrado-preenchido.pdf`
        await this.bridge.sessionFiles.write(pdfPath, pdfRes.buffer)
        exportFiles.pdf = pdfPath
        return { previewSvgs: pdfRes.previewSvgs, exportFiles, qaReport: pdfRes.qaReport }
      }
      const docxRes = fillDocxLetterhead({
        templateBuffer: tplBuf,
        documentTitle: opts.structuredData.documentTitle,
        fields: opts.structuredData.fields,
        paragraphs: Array.isArray(opts.structuredData.paragraphs) ? opts.structuredData.paragraphs : [],
        signatureBlock: opts.structuredData.signatureBlock
      })
      const docxPath = `${baseDir}/timbrado-preenchido.docx`
      await this.bridge.sessionFiles.write(docxPath, docxRes.buffer)
      exportFiles.docx = docxPath
      const fallbackPdf = await renderDocxAndPdf({
        toolId: 'oficio',
        template: templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool('oficio'),
        tokens: opts.tokens,
        data: opts.structuredData,
        brandKit: opts.brandKit,
        locale: opts.locale
      })
      const pdfPath = `${baseDir}/timbrado-preenchido.pdf`
      await this.bridge.sessionFiles.write(pdfPath, fallbackPdf.pdfBuffer)
      exportFiles.pdf = pdfPath
      return { previewSvgs: fallbackPdf.previewSvgs, exportFiles, qaReport: fallbackPdf.qaReport }
    }

    if (opts.toolId === 'pptx') {
      const pptxTpl = templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool('pptx')
      const res = await renderPptxAndPdf({
        tokens: opts.tokens,
        data: opts.structuredData,
        brandKit: opts.brandKit,
        layoutPreset: pptxTpl.layoutPreset,
        locale: opts.locale
      })
      await this.bridge.sessionFiles.write(`${baseDir}/apresentacao.pptx`, res.pptxBuffer)
      await this.bridge.sessionFiles.write(`${baseDir}/apresentacao.pdf`, res.pdfBuffer)
      exportFiles.pptx = `${baseDir}/apresentacao.pptx`
      exportFiles.pdf = `${baseDir}/apresentacao.pdf`
      return { previewSvgs: res.previewSvgs, exportFiles, qaReport: res.qaReport }
    }

    if (opts.toolId === 'podcast') {
      const res = await renderPodcastArtifact({
        bridge: this.bridge,
        title: String(opts.structuredData.title || 'Podcast MomAI Docs'),
        turns: Array.isArray(opts.structuredData.turns) ? opts.structuredData.turns : [],
        voiceA: opts.options?.voiceA,
        voiceB: opts.options?.voiceB,
        locale: opts.locale
      })
      await this.bridge.sessionFiles.write(`${baseDir}/podcast.mp3`, res.mp3Buffer)
      await this.bridge.sessionFiles.write(`${baseDir}/podcast.wav`, res.wavBuffer)
      if (opts.options?.includeSubtitles !== false) {
        await this.bridge.sessionFiles.write(`${baseDir}/podcast.srt`, res.srtText)
        exportFiles.srt = `${baseDir}/podcast.srt`
      }
      await this.bridge.sessionFiles.write(`${baseDir}/transcricao.md`, res.transcriptMarkdown)
      exportFiles.mp3 = `${baseDir}/podcast.mp3`
      exportFiles.wav = `${baseDir}/podcast.wav`
      exportFiles.md = `${baseDir}/transcricao.md`
      return {
        previewSvgs: [],
        exportFiles,
        qaReport: { passed: true, checkedAt: Date.now(), pagesOrSlidesChecked: 1, issues: [], repairsApplied: 0 }
      }
    }

    if (opts.toolId === 'video') {
      const ratio = opts.structuredData.aspectRatio === '9:16' ? '9:16' : '16:9'
      const includeSubtitles =
        opts.options?.includeSubtitles === true || opts.structuredData.includeSubtitles === true
      const videoTpl = templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool('video')
      const res = await renderVideoArtifact({
        title: String(opts.structuredData.title || 'Vídeo MomAI Docs'),
        aspectRatio: ratio,
        scenes: Array.isArray(opts.structuredData.scenes) ? opts.structuredData.scenes : [],
        tokens: opts.tokens,
        layoutPreset: videoTpl.layoutPreset,
        voice: opts.options?.voice,
        voiceB: opts.options?.speakerCount === 2 ? opts.options?.voiceB : undefined,
        includeSubtitles,
        subtitleStyle:
          opts.structuredData.subtitleStyle && typeof opts.structuredData.subtitleStyle === 'object'
            ? opts.structuredData.subtitleStyle
            : undefined,
        attachments: Array.isArray(opts.options?.attachments) ? opts.options.attachments : undefined,
        locale: opts.locale
      })
      if (res.mp4Buffer) {
        await this.bridge.sessionFiles.write(`${baseDir}/video.mp4`, res.mp4Buffer)
        exportFiles.mp4 = `${baseDir}/video.mp4`
      }
      if (res.mp3Buffer) {
        await this.bridge.sessionFiles.write(`${baseDir}/audio.mp3`, res.mp3Buffer)
        exportFiles.mp3 = `${baseDir}/audio.mp3`
      }
      if (includeSubtitles) {
        await this.bridge.sessionFiles.write(`${baseDir}/legendas.srt`, res.srtText)
        exportFiles.srt = `${baseDir}/legendas.srt`
      }
      return { previewSvgs: res.previewSvgs, exportFiles, qaReport: res.qaReport }
    }

    if (opts.toolId === 'xlsx') {
      const xlsxBuf = renderXlsxWorkbook({
        sheets: Array.isArray(opts.structuredData.sheets) ? opts.structuredData.sheets : []
      })
      await this.bridge.sessionFiles.write(`${baseDir}/planilha.xlsx`, xlsxBuf)
      exportFiles.xlsx = `${baseDir}/planilha.xlsx`
      return {
        previewSvgs: [],
        exportFiles,
        qaReport: { passed: true, checkedAt: Date.now(), pagesOrSlidesChecked: 1, issues: [], repairsApplied: 0 }
      }
    }

    if (opts.toolId === 'mindmap') {
      const res = renderMindMapOrTimelineSvg({
        rootLabel: String(opts.structuredData.rootLabel || 'Mapa Mental'),
        mode: opts.structuredData.mode === 'timeline' ? 'timeline' : 'mindmap',
        nodes: Array.isArray(opts.structuredData.nodes) ? opts.structuredData.nodes : [],
        tokens: opts.tokens
      })
      await this.bridge.sessionFiles.write(`${baseDir}/diagrama.svg`, res.svg)
      exportFiles.svg = `${baseDir}/diagrama.svg`
      return { previewSvgs: [res.svg], exportFiles, qaReport: res.qaReport }
    }

    if (opts.toolId === 'flashcards') {
      const exp = exportFlashcardsCsvAndAnki({
        deckTitle: String(opts.structuredData.deckTitle || 'Flashcards'),
        cards: Array.isArray(opts.structuredData.cards) ? opts.structuredData.cards : []
      })
      await this.bridge.sessionFiles.write(`${baseDir}/flashcards.csv`, exp.csvText)
      await this.bridge.sessionFiles.write(`${baseDir}/flashcards-anki.txt`, exp.ankiTsvText)
      exportFiles.csv = `${baseDir}/flashcards.csv`
      exportFiles.anki = `${baseDir}/flashcards-anki.txt`
      return {
        previewSvgs: [],
        exportFiles,
        qaReport: { passed: true, checkedAt: Date.now(), pagesOrSlidesChecked: 1, issues: [], repairsApplied: 0 }
      }
    }

    const docRes = await renderDocxAndPdf({
      toolId: opts.toolId,
      template: templateRegistry.getById(opts.templateId) || templateRegistry.getDefaultForTool(opts.toolId),
      tokens: opts.tokens,
      data: opts.structuredData,
      brandKit: opts.brandKit,
      attachments: Array.isArray(opts.options?.attachments) ? opts.options.attachments : undefined,
      locale: opts.locale
    })
    await this.bridge.sessionFiles.write(`${baseDir}/documento.docx`, docRes.docxBuffer)
    await this.bridge.sessionFiles.write(`${baseDir}/documento.pdf`, docRes.pdfBuffer)
    exportFiles.docx = `${baseDir}/documento.docx`
    exportFiles.pdf = `${baseDir}/documento.pdf`
    return { previewSvgs: docRes.previewSvgs, exportFiles, qaReport: docRes.qaReport }
  }

  async refineArtifact(opts: {
    artifactId: string
    instruction?: string
    targetSectionOrSlide?: string
    revertToVersion?: number
    targetSizeHint?: string
    locale?: DocsLocale
  }): Promise<ArtifactRecord> {
    const locale = normalizeLocale(opts.locale)
    const found = (await this.bridge.collections.list('artifacts', {
      where: { id: opts.artifactId },
      limit: 1
    })) as ArtifactRecord[]
    const current = found[0]
    if (!current) throw new Error(translateCore(locale, 'Artefato não encontrado.'))

    if (typeof opts.revertToVersion === 'number') {
      const versions = (await this.bridge.collections.list('artifact_versions', {
        where: { artifactId: opts.artifactId, versionNumber: opts.revertToVersion },
        limit: 1
      })) as ArtifactVersionRecord[]
      const target = versions[0]
      if (!target) throw new Error(translateCore(locale, 'Versão {version} não encontrada.', { version: opts.revertToVersion }))
      const reverted: ArtifactRecord = {
        ...current,
        currentVersion: target.versionNumber,
        structuredData: target.structuredData,
        citations: target.citations,
        previewSvgs: target.previewSvgs,
        exportFiles: target.exportFiles,
        qaReport: target.qaReport,
        updatedAt: Date.now()
      }
      await this.bridge.collections.upsert('artifacts', reverted as unknown as Record<string, unknown>)
      return reverted
    }

    if (!opts.instruction?.trim()) throw new Error(translateCore(locale, 'Informe uma instrução de refino.'))
    const ragRes = await this.rag.retrieve({
      projectId: current.projectId,
      query: opts.instruction,
      limit: 6
    })
    const caps = await this.llm.getCapabilities()
    const system = buildGroundingSystemPrompt({
      groundingMode: current.groundingMode,
      locale,
      compact: this.llm.isCompactModel(caps),
      hasSources: ragRes.chunks.length > 0,
      toolId: current.toolId
    })
    const refinedRes = await this.llm.completeStructured({
      system,
      user: buildRefinePrompt({
        currentJson: JSON.stringify(current.structuredData),
        instruction: opts.instruction,
        targetSectionOrSlide: opts.targetSectionOrSlide,
        contextBlocks: ragRes.contextText,
        targetSizeHint: opts.targetSizeHint
      }),
      schema: OPEN_OBJECT_SCHEMA
    })

    const nextVersion = current.currentVersion + 1
    const template =
      templateRegistry.getById(current.templateId) || templateRegistry.getDefaultForTool(current.toolId)
    const brandKit = await getBrandKitForProject(this.bridge, current.projectId)
    const tokens = templateRegistry.applyBrandKit(template, brandKit)

    const rendered = await this.renderArtifactOutputs({
      artifactId: current.id,
      versionNumber: nextVersion,
      toolId: current.toolId,
      templateId: current.templateId,
      tokens,
      structuredData: refinedRes.data,
      brandKit,
      locale
    })

    const updated: ArtifactRecord = {
      ...current,
      currentVersion: nextVersion,
      structuredData: refinedRes.data,
      previewSvgs: rendered.previewSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      providerUsed: refinedRes.provider,
      modelUsed: refinedRes.model,
      updatedAt: Date.now()
    }
    const verRecord: ArtifactVersionRecord = {
      id: `${current.id}-v${nextVersion}`,
      artifactId: current.id,
      versionNumber: nextVersion,
      instruction: opts.instruction,
      structuredData: refinedRes.data,
      citations: current.citations,
      previewSvgs: rendered.previewSvgs,
      exportFiles: rendered.exportFiles,
      qaReport: rendered.qaReport,
      createdAt: Date.now()
    }
    await this.bridge.collections.upsert('artifacts', updated as unknown as Record<string, unknown>)
    await this.bridge.collections.upsert('artifact_versions', verRecord as unknown as Record<string, unknown>)
    return updated
  }

  async exportProjectBundle(projectId: string): Promise<{ fileName: string; base64: string }> {
    const projects = (await this.bridge.collections.list('projects', { where: { id: projectId }, limit: 1 })) as ProjectRecord[]
    if (!projects[0]) throw new Error('Projeto não encontrado.')
    const sources = await this.bridge.collections.list('sources', { where: { projectId }, limit: 200 })
    const artifacts = await this.bridge.collections.list('artifacts', { where: { projectId }, limit: 200 })
    const brandKit = await getBrandKitForProject(this.bridge, projectId)
    const manifest = { schema: 'momai-docs-bundle-v1', exportedAt: Date.now(), project: projects[0], sources, artifacts, brandKit }
    const zipBytes = zipSync({ 'project.json': strToU8(JSON.stringify(manifest, null, 2)) }, { level: 6 })
    return {
      fileName: `${projects[0].name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.momai-docs`,
      base64: Buffer.from(zipBytes).toString('base64')
    }
  }

  async importProjectBundle(bundleBase64: string): Promise<ProjectRecord> {
    const files = unzipSync(Buffer.from(bundleBase64, 'base64'))
    if (!files['project.json']) throw new Error('Pacote .momai-docs inválido.')
    const parsed = JSON.parse(strFromU8(files['project.json'])) as {
      project: ProjectRecord
      sources?: SourceRecord[]
      artifacts?: ArtifactRecord[]
      brandKit?: BrandKit | null
    }
    const newId = `proj-${randomUUID().slice(0, 8)}`
    const proj: ProjectRecord = { ...parsed.project, id: newId, updatedAt: Date.now() }
    await this.bridge.collections.upsert('projects', proj as unknown as Record<string, unknown>)
    if (parsed.brandKit) {
      await saveBrandKit(this.bridge, { ...parsed.brandKit, projectId: newId, id: `brand-${randomUUID().slice(0, 8)}` })
    }
    return proj
  }
}
