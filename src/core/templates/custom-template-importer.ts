import { randomUUID } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import type { HostBridge, SlotConstraint, TemplateManifest, ToolId } from '../types.ts'

export interface ImportedTemplateAnalysis {
  fileName: string
  format: 'docx' | 'pptx'
  detectedPlaceholders: string[]
  detectedHeadings: string[]
  slideCount?: number
  suggestedToolId: ToolId
  suggestedSlots: SlotConstraint[]
}

const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_.-]+)\}\}|<<([a-zA-Z0-9_.-]+)>>|_{4,}/g

export function analyzeUserTemplateFile(fileName: string, buffer: Buffer): ImportedTemplateAnalysis {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  const format: 'docx' | 'pptx' = ext === 'pptx' ? 'pptx' : 'docx'
  const files = unzipSync(new Uint8Array(buffer))
  const placeholders = new Set<string>()
  const headings: string[] = []
  let blankIndex = 1

  if (format === 'docx') {
    const xml = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : ''
    for (const m of xml.matchAll(PLACEHOLDER_RE)) {
      const name = (m[1] || m[2] || `campo_${blankIndex++}`).trim()
      placeholders.add(name)
    }
    for (const para of xml.split(/<\/w:p>/i)) {
      if (/Heading|Título/i.test(para)) {
        const text = (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join('')
          .trim()
        if (text) headings.push(text)
      }
    }
  } else {
    const slideKeys = Object.keys(files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    for (const key of slideKeys) {
      const xml = strFromU8(files[key])
      for (const m of xml.matchAll(PLACEHOLDER_RE)) {
        const name = (m[1] || m[2] || `slide_campo_${blankIndex++}`).trim()
        placeholders.add(name)
      }
    }
    const suggestedSlots: SlotConstraint[] = [
      ...Array.from(placeholders).map((p) => ({
        key: p,
        label: p,
        type: 'string' as const,
        required: true,
        maxChars: 240,
        description: `Valor para preencher o placeholder {{${p}}} no slide`
      })),
      {
        key: 'slides',
        label: 'Slides adicionais',
        type: 'object[]',
        required: false,
        maxItems: 15,
        description: 'Conteúdo estruturado dos slides'
      }
    ]
    return {
      fileName,
      format,
      detectedPlaceholders: Array.from(placeholders),
      detectedHeadings: headings,
      slideCount: slideKeys.length,
      suggestedToolId: 'pptx',
      suggestedSlots
    }
  }

  const hasLetterheadSignals =
    Object.keys(files).some((k) => /^word\/header\d*\.xml$/i.test(k)) ||
    placeholders.size > 0
  const suggestedToolId: ToolId = hasLetterheadSignals ? 'letterhead' : 'report'
  const suggestedSlots: SlotConstraint[] = [
    ...Array.from(placeholders).map((p) => ({
      key: p,
      label: p,
      type: 'string' as const,
      required: true,
      maxChars: 300,
      description: `Valor para preencher {{${p}}}`
    })),
    {
      key: 'paragraphs',
      label: 'Corpo do Documento',
      type: 'string[]',
      required: true,
      maxItems: 14,
      description: 'Parágrafos principais baseados nas fontes'
    }
  ]

  return {
    fileName,
    format,
    detectedPlaceholders: Array.from(placeholders),
    detectedHeadings: headings,
    suggestedToolId,
    suggestedSlots
  }
}

export async function saveCustomUserTemplate(opts: {
  bridge: HostBridge
  name: string
  toolId: ToolId
  fileName: string
  buffer: Buffer
  slots: SlotConstraint[]
}): Promise<TemplateManifest> {
  const id = `custom-${randomUUID().slice(0, 8)}`
  const relPath = `custom-templates/${id}-${opts.fileName}`
  await opts.bridge.sessionFiles.write(relPath, opts.buffer)

  const manifest: TemplateManifest = {
    id,
    toolId: opts.toolId,
    name: opts.name || opts.fileName,
    description: `Template personalizado importado (${opts.fileName})`,
    category: 'personalizado',
    locales: ['pt-BR', 'en-US', 'es'],
    orientation: opts.toolId === 'pptx' ? 'landscape' : 'portrait',
    pageFormat: opts.toolId === 'pptx' ? '16:9' : 'A4',
    version: '1.0.0',
    isCustomUserTemplate: true,
    customFilePath: relPath,
    license: {
      spdx: 'USER-OWNED',
      name: 'Template fornecido pelo usuário',
      author: 'Usuário',
      url: '',
      commercialUseAllowed: true,
      attributionRequired: false
    },
    designTokens: {
      primary: '#1E3A8A',
      secondary: '#334155',
      accent: '#7C3AED',
      surface: '#FFFFFF',
      surfaceAlt: '#F8FAFC',
      textPrimary: '#0F172A',
      textMuted: '#475569',
      border: '#CBD5E1',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      monoFont: 'JetBrains Mono'
    },
    slots: opts.slots,
    styleGuideForAgent: 'Preencha os slots detectados no template personalizado preservando o estilo original.'
  }

  const list = ((await opts.bridge.storage.get<TemplateManifest[]>('custom_templates')) || []).filter(
    (t) => t.id !== id
  )
  list.push(manifest)
  await opts.bridge.storage.set('custom_templates', list)
  return manifest
}
