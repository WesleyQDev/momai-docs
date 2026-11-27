import { z } from 'zod'
import { chatLanguageRule, normalizeLocale, type DocsLocale } from './i18n.ts'
import type { LLMGateway } from './llm/llm-gateway.ts'
import { localizeTemplate } from './templates/localize-template.ts'
import { templateRegistry } from './templates/template-registry.ts'
import type { ToolId } from './types.ts'

export const STUDIO_GENERATABLE_TOOLS: ReadonlyArray<{
  id: ToolId
  label: string
  description: string
}> = [
  { id: 'oficio', label: 'Ofícios e Cartas', description: 'Official letter / formal correspondence (DOCX/PDF)' },
  { id: 'abnt', label: 'Trabalho ABNT', description: 'Academic paper formatted to ABNT NBR 14724 (DOCX/PDF)' },
  { id: 'video', label: 'Vídeo Explicativo', description: 'Narrated explainer video with synchronized slides and subtitles (MP4)' },
  { id: 'apostila', label: 'Apostilas', description: 'Structured workbook / study guide with modules and exercises (DOCX/PDF)' },
  { id: 'podcast', label: 'Podcast', description: 'Two-voice dialogue audio podcast with SRT transcript (MP3/WAV)' },
  { id: 'xlsx', label: 'Planilha', description: 'Structured Excel spreadsheet with formulas and tabs (XLSX)' },
  { id: 'report', label: 'Relatório Executivo', description: 'Executive report with summary, metrics, findings, and next steps (DOCX/PDF)' },
  { id: 'mindmap', label: 'Mapa Mental', description: 'Visual mind map diagram (PNG/JPG/SVG)' },
  { id: 'pptx', label: 'Slides', description: '16:9 presentation slide deck with speaker notes (PPTX/PDF)' },
  { id: 'flashcards', label: 'Quiz', description: 'Interactive quiz / flashcards with explanations and CSV/Anki export' },
  { id: 'contract', label: 'Contrato', description: 'Legal contract with numbered clauses, obligations, term, and jurisdiction (DOCX/PDF)' },
  { id: 'resume', label: 'Currículo', description: 'ATS-friendly single-column resume / CV (DOCX/PDF)' },
  { id: 'lesson_plan', label: 'Plano de Aula', description: 'Pedagogical lesson plan with objectives, timeline, and evaluation (DOCX/PDF)' },
  { id: 'meeting_minutes', label: 'Ata de Reunião', description: 'Formal meeting minutes with agenda, attendees, decisions, and owners (DOCX/PDF)' }
]

const VALID_TOOL_IDS = new Set<string>(STUDIO_GENERATABLE_TOOLS.map((t) => t.id))

const GENERATION_INTENT_PATTERN =
  /\b(gerar|gere|gera|criar|crie|cria|fazer|faça|faca|faz|montar|monte|monta|produzir|produza|elaborar|elabore|redigir|redija|preparar|prepare|quero\s+um|quero\s+uma|preciso\s+de\s+um|preciso\s+de\s+uma|generate|create|make|build|produce|draft|prepare|generar|crear|hacer|producir|elaborar|estúdio|estudio|studio|modelo|template|ofício|oficio|abnt|vídeo|video|apostila|podcast|planilha|xlsx|relatório|relatorio|mapa\s+mental|mindmap|slides?|pptx|apresentação|apresentacao|quiz|flashcards?|contrato|currículo|curriculo|plano\s+de\s+aula|ata\s+de\s+reunião|ata\s+de\s+reuniao)\b/i

const IntentSchema = z.object({
  shouldGenerate: z.boolean(),
  toolId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  instructions: z.string().optional(),
  reply: z.string().optional()
})

export interface StudioGenerationIntent {
  shouldGenerate: boolean
  toolId?: ToolId
  templateId?: string
  instructions?: string
  reply?: string
}

export function mightBeStudioGenerationRequest(query: string): boolean {
  const q = String(query || '').trim()
  if (!q) return false
  return GENERATION_INTENT_PATTERN.test(q)
}

export async function detectStudioGenerationIntent(opts: {
  llm: LLMGateway
  query: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  locale?: DocsLocale
}): Promise<StudioGenerationIntent | null> {
  const locale = normalizeLocale(opts.locale)
  const templates = templateRegistry
    .search({ locale })
    .filter((tpl) => VALID_TOOL_IDS.has(tpl.toolId))
    .map((tpl) => {
      const loc = localizeTemplate(tpl, locale)
      return `- ${loc.id} (tool: ${loc.toolId}): ${loc.name}`
    })
    .join('\n')

  const toolsList = STUDIO_GENERATABLE_TOOLS.map((t) => `- ${t.id}: ${t.label} — ${t.description}`).join('\n')

  const system = [
    'You classify whether the user message in the MomAI Docs chat is asking to GENERATE a deliverable/model in the Studio, versus just asking a question or requesting text/tables in the chat.',
    'Return ONLY valid JSON matching the schema: { "shouldGenerate": boolean, "toolId": string | null, "templateId": string | null, "instructions": string, "reply": string }.',
    'Rules:',
    '- Set shouldGenerate=true ONLY when the user wants to generate/create a Studio deliverable (document, report, slides, podcast, video, spreadsheet, mindmap, quiz, ABNT paper, oficio, contract, resume, lesson plan, meeting minutes, or a specific Studio template).',
    '- Set shouldGenerate=false if the user is asking a question, asking for a summary/explanation in chat, or asking for a table/list directly in the chat.',
    '- When shouldGenerate=true, pick the exact matching toolId from the list below, and optionally pick templateId if the user named or clearly implied a specific template; otherwise set templateId=null.',
    '- Put the user topic/requirements into "instructions" (concise, preserving specifics).',
    `- Put a short, friendly confirmation message in "reply" informing the user that generation has started in the Studio ("Gerados"). ${chatLanguageRule(locale)}`,
    `Available Studio tools:\n${toolsList}`,
    templates ? `Available Studio templates:\n${templates}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')

  const historyText = (opts.history || [])
    .slice(-4)
    .map((h) => `${h.role}: ${h.content.slice(0, 300)}`)
    .join('\n')

  try {
    const res = await opts.llm.completeStructured({
      system,
      user: historyText
        ? `Recent conversation:\n${historyText}\n\nUser message: ${opts.query}`
        : `User message: ${opts.query}`,
      schema: IntentSchema,
      temperature: 0.1,
      locale
    })
    const data = res.data
    if (!data.shouldGenerate || !data.toolId || !VALID_TOOL_IDS.has(data.toolId)) {
      return { shouldGenerate: false }
    }
    const toolId = data.toolId as ToolId
    let templateId: string | undefined
    if (data.templateId) {
      const tpl = templateRegistry.getById(data.templateId)
      if (tpl && tpl.toolId === toolId) {
        templateId = tpl.id
      }
    }
    return {
      shouldGenerate: true,
      toolId,
      templateId,
      instructions: data.instructions?.trim() || opts.query,
      reply: data.reply?.trim() || undefined
    }
  } catch {
    return null
  }
}
