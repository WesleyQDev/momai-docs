import { randomUUID } from 'node:crypto'
import { createIpcDocsStorage } from '../storage-ipc.ts'
import { LLMGateway } from '../src/core/llm/llm-gateway.ts'
import {
  clampOficioToSinglePage,
  renderOficioDemoFiles,
  type OficioDemoData
} from './oficio-demo-engine.ts'
import {
  buildDeterministicDemoFallback,
  DEMO_CHAT_SYSTEM_PROMPT,
  DEMO_GREETING_REPLY,
  DEMO_OUT_OF_SCOPE_REPLY,
  evaluateDemoChatMessage
} from './demo-chat-guard.ts'

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
  storageDir: process.env.MOMAI_EXTENSION_STORAGE_DIR || 'momai-docs-demo'
})

const DEMO_PROJECT_ID = 'demo-oficio-project'
const STORAGE_STATE_KEY = 'demo_state_v1'
const llm = new LLMGateway()

interface DemoStoredState {
  project: {
    id: string
    name: string
    description: string
    profile: 'public_servant'
    createdAt: number
    updatedAt: number
  }
  artifact: {
    id: string
    projectId: string
    toolId: 'oficio'
    title: string
    pageCount: 1
    data: OficioDemoData
    previewHtml: string
    docxBase64: string
    pdfBase64: string
    createdAt: number
  } | null
}

async function readState(): Promise<DemoStoredState> {
  const saved = (await ipcBridge.storage.get(STORAGE_STATE_KEY).catch(() => null)) as DemoStoredState | null
  if (saved && saved.project) return saved
  const now = Date.now()
  const initial: DemoStoredState = {
    project: {
      id: DEMO_PROJECT_ID,
      name: 'Demo: Ofícios e Cartas (1 página)',
      description: 'Espaço de demonstração para testar a geração de Ofícios e Cartas em 1 página.',
      profile: 'public_servant',
      createdAt: now,
      updatedAt: now
    },
    artifact: null
  }
  await ipcBridge.storage.set(STORAGE_STATE_KEY, initial).catch(() => {})
  return initial
}

const OFICIO_TEMPLATES = [
  {
    id: 'oficio-executivo',
    toolId: 'oficio',
    name: 'Ofício Padrão (Manual de Redação Oficial)',
    description: 'Ofício formal com numeração, endereçamento, assunto e fecho oficial.'
  },
  {
    id: 'carta-formal',
    toolId: 'oficio',
    name: 'Carta Comercial / Institucional',
    description: 'Carta objetiva com vocativo, corpo claro e assinatura.'
  }
]

export async function execute(toolName: string, args: Record<string, any> = {}): Promise<any> {
  switch (toolName) {
    case 'docs_route_projects':
    case 'docs_project_manage': {
      const state = await readState()
      const action = args.action || 'list'
      if (action === 'list') {
        return { ok: true, projects: [state.project] }
      }
      if (action === 'open') {
        return {
          ok: true,
          project: state.project,
          sources: [],
          artifacts: state.artifact ? [state.artifact] : []
        }
      }
      return { ok: false, error: 'demo_locked' }
    }

    case 'docs_templates_list': {
      if (args.toolId && args.toolId !== 'oficio') {
        return { ok: false, error: 'demo_locked' }
      }
      return { ok: true, templates: OFICIO_TEMPLATES }
    }

    case 'docs_route_artifacts': {
      const state = await readState()
      return {
        ok: true,
        artifacts: state.artifact ? [state.artifact] : [],
        versions: [],
        activeGeneration: null
      }
    }

    case 'docs_artifact_generate': {
      if (args.toolId && args.toolId !== 'oficio') {
        return { ok: false, error: 'demo_locked' }
      }

      const state = await readState()
      if (state.artifact) {
        return {
          ok: false,
          error: 'demo_page_limit_reached',
          message: 'A demonstração permite gerar 1 página de Ofício/Carta por usuário.'
        }
      }

      const instructions = String(args.instructions || '').trim()
      if (!instructions) {
        return { ok: false, error: 'Informe as instruções para gerar o ofício ou carta.' }
      }

      let generated: Partial<OficioDemoData>
      try {
        const res = await llm.completeText({
          system:
            'Você redige Ofícios e Cartas formais em português brasileiro que caibam estritamente em 1 página A4. Responda apenas JSON válido com: institution, documentNumber, placeAndDate, recipientTitle, subject, paragraphs (array com no máximo 3 parágrafos curtos), closing, signerName.',
          user: `Pedido do usuário: ${instructions}`,
          format: 'json',
          maxTokens: 900,
          temperature: 0.3
        })
        const parsed = JSON.parse(String(res?.text || '{}'))
        generated = parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        generated = {
          documentNumber: 'Ofício nº 001/2026',
          placeAndDate: 'Brasília, 2026',
          recipientTitle: 'Ao Senhor(a) Destinatário(a)',
          subject: instructions.slice(0, 90),
          paragraphs: [instructions],
          closing: 'Atenciosamente,',
          signerName: 'Remetente'
        }
      }

      const clamped = clampOficioToSinglePage(generated)
      const rendered = await renderOficioDemoFiles(clamped)
      const now = Date.now()
      const artifact = {
        id: `demo-art-${randomUUID().slice(0, 8)}`,
        projectId: DEMO_PROJECT_ID,
        toolId: 'oficio' as const,
        title: clamped.subject || 'Ofício (Demo 1 página)',
        pageCount: 1 as const,
        data: clamped,
        previewHtml: rendered.previewHtml,
        docxBase64: rendered.docxBase64,
        pdfBase64: rendered.pdfBase64,
        createdAt: now
      }

      state.artifact = artifact
      state.project.updatedAt = now
      await ipcBridge.storage.set(STORAGE_STATE_KEY, state)

      return { ok: true, artifact }
    }

    case 'docs_artifact_export': {
      const state = await readState()
      const artifact = state.artifact
      if (!artifact || (args.artifactId && args.artifactId !== artifact.id)) {
        return { ok: false, error: 'Artefato não encontrado.' }
      }
      const format = String(args.format || 'pdf').toLowerCase()
      if (format !== 'pdf' && format !== 'docx') {
        return { ok: false, error: 'demo_locked' }
      }
      const base64 = format === 'docx' ? artifact.docxBase64 : artifact.pdfBase64
      const mimeType =
        format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf'
      return {
        ok: true,
        fileName: `oficio-demo-1-pagina.${format}`,
        mimeType,
        base64
      }
    }

    case 'docs_demo_chat': {
      const message = String(args.message || '').trim()
      const guard = evaluateDemoChatMessage(message)

      if (!guard.allowed) {
        if (guard.reason === 'empty') {
          return { ok: false, error: 'Digite uma pergunta sobre o MomAI Docs.' }
        }
        return {
          ok: true,
          inScope: false,
          suggestPurchase: true,
          reason: guard.reason,
          reply: DEMO_OUT_OF_SCOPE_REPLY
        }
      }

      if (guard.reason === 'greeting') {
        return {
          ok: true,
          inScope: true,
          suggestPurchase: false,
          reply: DEMO_GREETING_REPLY
        }
      }

      let replyText = ''
      try {
        const res = await llm.completeText({
          system: DEMO_CHAT_SYSTEM_PROMPT,
          user: message,
          maxTokens: 280,
          temperature: 0.2
        })
        replyText = String(res?.text || '').trim()
      } catch {
        replyText = ''
      }

      if (replyText.includes('[[OUT_OF_SCOPE]]')) {
        return {
          ok: true,
          inScope: false,
          suggestPurchase: true,
          reason: 'llm_out_of_scope',
          reply: DEMO_OUT_OF_SCOPE_REPLY
        }
      }

      if (!replyText) {
        replyText = buildDeterministicDemoFallback(message)
      }

      return {
        ok: true,
        inScope: true,
        suggestPurchase: false,
        reply: replyText
      }
    }

    default:
      return { ok: false, error: 'demo_locked' }
  }
}

export async function run(toolName: string, args: Record<string, any> = {}): Promise<any> {
  return execute(toolName, args)
}

process.on('message', async (msg: any) => {
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'storage_response') {
    storageResponseListener?.(msg)
    return
  }
  if (msg.type === 'tool_call') {
    try {
      const result = await execute(msg.toolName, msg.args || {})
      safeSend({ type: 'tool_result', callId: msg.callId, ok: true, result })
    } catch (err: any) {
      safeSend({
        type: 'tool_result',
        callId: msg.callId,
        ok: false,
        error: err?.message || String(err)
      })
    }
  }
})
