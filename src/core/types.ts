export type ToolId =
  | 'oficio'
  | 'apostila'
  | 'abnt'
  | 'letterhead'
  | 'pptx'
  | 'podcast'
  | 'video'
  | 'report'
  | 'flashcards'
  | 'mindmap'
  | 'xlsx'
  | 'resume'
  | 'lesson_plan'
  | 'meeting_minutes'
  | 'contract'
  | 'faq'
  | 'newsletter'

export type ExportFormat =
  | 'docx'
  | 'pdf'
  | 'pptx'
  | 'xlsx'
  | 'mp3'
  | 'wav'
  | 'mp4'
  | 'srt'
  | 'csv'
  | 'anki'
  | 'svg'
  | 'png'
  | 'md'
  | 'html'

export type GroundingMode = 'sources_only' | 'sources_plus_general'
export type UserProfile = 'general' | 'student' | 'teacher' | 'lawyer' | 'public_servant' | 'executive'
export type SourceKind = 'file' | 'url' | 'youtube' | 'text'
export type SourceStatus = 'queued' | 'extracting' | 'indexing' | 'ready' | 'error'

export interface CitationRef {
  sourceId: string
  sourceTitle: string
  locator: string
  snippet?: string
}

export interface ProjectRecord {
  id: string
  name: string
  description: string
  profile: UserProfile
  groundingMode: GroundingMode
  brandKitId?: string | null
  archived: boolean
  pinned?: boolean
  titleLocked?: boolean
  isExample?: boolean
  createdAt: number
  updatedAt: number
}

export interface ExtractedImageRef {
  id: string
  sourceId: string
  sourceTitle: string
  relativePath: string
  mimeType: string
  caption?: string
}

export interface SourceRecord {
  id: string
  projectId: string
  kind: SourceKind
  title: string
  originUrl?: string
  fileName?: string
  mimeType?: string
  status: SourceStatus
  errorReason?: string
  pinned: boolean
  active: boolean
  contentHash: string
  totalChars: number
  totalChunks: number
  pageCount?: number
  summary: string
  extractedImages?: ExtractedImageRef[]
  lastSyncedAt?: number
  remoteChanged?: boolean
  createdAt: number
  updatedAt: number
}

export interface SourceChunkRecord {
  id: string
  projectId: string
  sourceId: string
  sourceTitle: string
  chunkIndex: number
  pageOrSlide: string
  timestamp?: string
  sectionTitle: string
  text: string
  contentHash: string
  embedding?: number[] | null
  embeddingModel?: string | null
}

export interface SourceSuggestion {
  id: string
  title: string
  url: string
  domain: string
  kind: 'url' | 'youtube'
  reliabilityScore: number
  reliabilityLabel: 'high' | 'medium' | 'general'
  publishedDate?: string
  snippet: string
  summary: string
}

export interface BrandKit {
  id: string
  projectId: string
  name: string
  institutionName: string
  department?: string
  footerText?: string
  headerText?: string
  logoDataUrl?: string
  headerLogoDataUrl?: string
  footerLogoDataUrl?: string
  headerAlign?: 'left' | 'center' | 'right'
  footerAlign?: 'left' | 'center' | 'right'
  logoPlacement?: 'header' | 'footer' | 'both'
  logoInHeader?: boolean
  logoInFooter?: boolean
  signatureName?: string
  signatureRole?: string
  logoPath?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  headingFont: string
  bodyFont: string
  updatedAt: number
}

export interface DesignTokens {
  primary: string
  secondary: string
  accent: string
  surface: string
  surfaceAlt: string
  textPrimary: string
  textMuted: string
  border: string
  headingFont: string
  bodyFont: string
  monoFont: string
}

export interface LicenseMetadata {
  spdx: string
  name: string
  author: string
  url: string
  commercialUseAllowed: boolean
  attributionRequired: boolean
  attributionText?: string
}

export interface SlotConstraint {
  key: string
  label: string
  type: 'string' | 'string[]' | 'object[]' | 'number'
  required?: boolean
  maxChars?: number
  maxItems?: number
  description: string
}

export interface TemplateManifest {
  id: string
  toolId: ToolId
  name: string
  description: string
  category: string
  locales: string[]
  orientation: 'portrait' | 'landscape'
  pageFormat: 'A4' | '16:9' | '9:16' | 'square' | 'audio'
  version: string
  isCustomUserTemplate?: boolean
  customFilePath?: string
  license: LicenseMetadata
  designTokens: DesignTokens
  slots: SlotConstraint[]
  styleGuideForAgent: string
}

export interface VisualQAIssue {
  code:
    | 'text_overflow'
    | 'letterhead_collision'
    | 'sparse_page'
    | 'widow_orphan'
    | 'contrast_violation'
    | 'image_aspect_violation'
  severity: 'warning' | 'error'
  location: string
  message: string
  autoRepaired: boolean
}

export interface VisualQAReport {
  passed: boolean
  checkedAt: number
  pagesOrSlidesChecked: number
  issues: VisualQAIssue[]
  repairsApplied: number
}

export interface ArtifactVersionRecord {
  id: string
  artifactId: string
  versionNumber: number
  instruction?: string
  structuredData: Record<string, unknown>
  citations: CitationRef[]
  previewSvgs: string[]
  exportFiles: Partial<Record<ExportFormat, string>>
  qaReport: VisualQAReport
  createdAt: number
}

export interface ArtifactRecord {
  id: string
  projectId: string
  toolId: ToolId
  templateId: string
  title: string
  summary: string
  status: 'draft' | 'ready' | 'error'
  currentVersion: number
  groundingMode: GroundingMode
  providerUsed: string
  modelUsed: string
  structuredData: Record<string, unknown>
  citations: CitationRef[]
  previewSvgs: string[]
  exportFiles: Partial<Record<ExportFormat, string>>
  qaReport: VisualQAReport
  createdAt: number
  updatedAt: number
}

export interface LLMCapabilities {
  provider: string
  providerName: string
  model: string
  isLocal: boolean
  contextWindowTokens: number
  maxOutputTokens: number
  visionSupported: boolean
  structuredOutputSupported: boolean
  streamingSupported: boolean
}

export interface HostBridge {
  storage: {
    get<T = any>(key: string): Promise<T | null>
    set(key: string, value: unknown, opts?: { ttlMs?: number }): Promise<void>
    delete(key: string): Promise<void>
    listKeys(opts?: { prefix?: string; limit?: number }): Promise<string[]>
  }
  collections: {
    insert(collection: string, record: Record<string, unknown>): Promise<{ id: number }>
    list(collection: string, opts?: Record<string, unknown>): Promise<Array<Record<string, any>>>
    count(collection: string, opts?: Record<string, unknown>): Promise<{ count: number }>
    search(collection: string, query: string, opts?: Record<string, unknown>): Promise<Array<Record<string, any>>>
    remove(collection: string, idOrFilter: unknown): Promise<{ ok: boolean }>
    clear(collection: string, opts?: Record<string, unknown>): Promise<{ removed: number }>
    upsert(collection: string, record: Record<string, unknown>): Promise<{ id: number; updated: boolean }>
    upsertMany(collection: string, records: Array<Record<string, unknown>>): Promise<{ upserted: number }>
  }
  sessionFiles: {
    write(relativePath: string, content: string | Uint8Array): Promise<{ ok: boolean; path: string }>
    read(relativePath: string): Promise<{ bytes: Uint8Array; text: string }>
    list(prefix?: string): Promise<string[]>
    remove(relativePath: string): Promise<{ ok: boolean }>
  }
  log(message: string): void
  sendEvent(eventType: string, data: Record<string, unknown>): void
  sendStructuredResponse(data: Record<string, unknown>): void
}
