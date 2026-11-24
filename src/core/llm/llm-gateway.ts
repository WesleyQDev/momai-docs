import { z } from 'zod'
import type { LLMCapabilities, SlotConstraint } from '../types.ts'
import { buildJsonRepairPrompt } from './prompts/v1/index.ts'

export interface LLMCallOptions {
  system?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  user: string
  temperature?: number
  maxTokens?: number
  format?: 'text' | 'json'
  contextBudget?: 'default' | 'adaptive'
  timeoutMs?: number
  signal?: AbortSignal
}

export interface LLMCallResult {
  text: string
  json?: unknown
  model: string
  provider: string
  isLocal: boolean
}

export interface LLMTransport {
  complete(opts: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    temperature?: number
    maxTokens?: number
    format?: 'text' | 'json'
    contextBudget?: 'default' | 'adaptive'
    timeoutMs?: number
    signal?: AbortSignal
  }): Promise<{ text: string; json?: unknown; model?: string | null; provider?: string | null }>
  vision(opts: {
    imageBase64: string
    prompt: string
    maxTokens?: number
  }): Promise<{ text: string; visionAvailable?: boolean }>
  getCapabilities(): Promise<LLMCapabilities>
}

/**
 * Default transport that calls the MomAI Host SDK HTTP bridge using the
 * worker-injected MOMAI_API_URL and MOMAI_SESSION_TOKEN. Never calls any
 * third-party LLM provider directly.
 */
export function createHostLlmTransport(): LLMTransport {
  const baseUrl = () => (process.env.MOMAI_API_URL || 'http://127.0.0.1:8050').replace(/\/$/, '')
  const token = () => process.env.MOMAI_SESSION_TOKEN || ''

  const headers = () => ({
    'Content-Type': 'application/json',
    'X-Session-Token': token(),
    'x-extension-id': process.env.MOMAI_EXTENSION_ID || 'momai-docs'
  })

  return {
    async complete(opts) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000)
      const onAbort = () => controller.abort()
      if (opts.signal) {
        if (opts.signal.aborted) controller.abort()
        else opts.signal.addEventListener('abort', onAbort, { once: true })
      }
      try {
        const res = await fetch(`${baseUrl()}/extensions/llm/complete`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            messages: opts.messages,
            temperature: opts.temperature,
            maxTokens: opts.maxTokens,
            format: opts.format,
            contextBudget: opts.contextBudget
          }),
          signal: controller.signal
        })
        if (!res.ok) {
          const errPayload = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(errPayload.error || `LLM HTTP ${res.status}`)
        }
        return (await res.json()) as any
      } finally {
        clearTimeout(timer)
        opts.signal?.removeEventListener('abort', onAbort)
      }
    },

    async vision(opts) {
      const res = await fetch(`${baseUrl()}/extensions/llm/vision`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          image_base64: opts.imageBase64,
          prompt: opts.prompt,
          max_tokens: opts.maxTokens || 1024,
          caller: 'momai-docs'
        }),
        signal: AbortSignal.timeout(60_000)
      })
      if (!res.ok) {
        return { text: '', visionAvailable: false }
      }
      return (await res.json()) as any
    },

    async getCapabilities() {
      const res = await fetch(`${baseUrl()}/extensions/llm/capabilities`, {
        method: 'GET',
        headers: headers(),
        signal: AbortSignal.timeout(8_000)
      })
      if (!res.ok) {
        return {
          provider: 'local',
          providerName: 'Local',
          model: 'unknown',
          isLocal: true,
          contextWindowTokens: 8192,
          maxOutputTokens: 2048,
          visionSupported: false,
          structuredOutputSupported: true,
          streamingSupported: false
        }
      }
      return (await res.json()) as LLMCapabilities
    }
  }
}

export function extractJsonCandidate(text: string): unknown {
  const raw = String(text || '').trim()
  if (!raw) return undefined
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : raw).trim()
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.search(/[[{]/)
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'))
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1))
      } catch {
        return undefined
      }
    }
    return undefined
  }
}

function truncateSmart(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  const slice = value.slice(0, maxChars - 1)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…'
}

export function enforceSlotConstraints(
  data: Record<string, unknown>,
  slots: SlotConstraint[]
): { sanitized: Record<string, unknown>; warnings: string[] } {
  const out: Record<string, unknown> = { ...data }
  const warnings: string[] = []
  for (const slot of slots) {
    const val = out[slot.key]
    if (val === undefined || val === null) {
      if (slot.required) {
        if (slot.type === 'string') out[slot.key] = `[${slot.label} não informado nas fontes]`
        else if (slot.type === 'string[]' || slot.type === 'object[]') out[slot.key] = []
        else if (slot.type === 'number') out[slot.key] = 0
        warnings.push(`Slot obrigatório ausente: ${slot.key}`)
      }
      continue
    }
    if (slot.type === 'string' && typeof val === 'string' && slot.maxChars && val.length > slot.maxChars) {
      out[slot.key] = truncateSmart(val, slot.maxChars)
      warnings.push(`Slot ${slot.key} ajustado para ${slot.maxChars} caracteres`)
    }
    if (Array.isArray(val) && slot.maxItems && val.length > slot.maxItems) {
      out[slot.key] = val.slice(0, slot.maxItems)
      warnings.push(`Slot ${slot.key} limitado a ${slot.maxItems} itens`)
    }
  }
  return { sanitized: out, warnings }
}

const MAX_RETRIES = 2
const RETRY_BASE_MS = 800

export class LLMGateway {
  private readonly transport: LLMTransport

  constructor(transport?: LLMTransport) {
    this.transport = transport || createHostLlmTransport()
  }

  async getCapabilities(): Promise<LLMCapabilities> {
    return this.transport.getCapabilities()
  }

  isCompactModel(caps: LLMCapabilities): boolean {
    return caps.contextWindowTokens <= 10_000
  }

  recommendedRetrievalConfig(caps: LLMCapabilities): {
    topK: number
    maxChunkChars: number
    useOutlineFirst: boolean
  } {
    if (caps.contextWindowTokens <= 8192) {
      return { topK: 4, maxChunkChars: 650, useOutlineFirst: true }
    }
    if (caps.contextWindowTokens <= 32768) {
      return { topK: 8, maxChunkChars: 1100, useOutlineFirst: true }
    }
    return { topK: 14, maxChunkChars: 1600, useOutlineFirst: false }
  }

  async completeText(opts: LLMCallOptions): Promise<LLMCallResult> {
    const caps = await this.getCapabilities()
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
    if (opts.system?.trim()) messages.push({ role: 'system', content: opts.system.trim() })
    if (Array.isArray(opts.history)) {
      for (const h of opts.history) {
        if ((h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.trim()) {
          messages.push({ role: h.role, content: h.content.trim() })
        }
      }
    }
    messages.push({ role: 'user', content: opts.user })

    let lastErr: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await this.transport.complete({
          messages,
          temperature: opts.temperature ?? 0.3,
          maxTokens: Math.min(opts.maxTokens ?? caps.maxOutputTokens, caps.maxOutputTokens),
          format: opts.format ?? 'text',
          contextBudget: opts.contextBudget ?? (caps.contextWindowTokens > 16384 ? 'adaptive' : 'default'),
          timeoutMs: opts.timeoutMs ?? 60_000,
          signal: opts.signal
        })
        return {
          text: res.text,
          json: res.json,
          model: res.model || caps.model,
          provider: res.provider || caps.provider,
          isLocal: caps.isLocal
        }
      } catch (err) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        if (opts.signal?.aborted || /prompt_too_large|empty prompt/i.test(msg)) break
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }

  async completeStructured<T extends Record<string, unknown>>(opts: {
    system: string
    user: string
    schema: z.ZodType<T>
    slots?: SlotConstraint[]
    temperature?: number
    maxTokens?: number
    signal?: AbortSignal
  }): Promise<{ data: T; model: string; provider: string; isLocal: boolean; repaired: boolean }> {
    const first = await this.completeText({
      system: opts.system,
      user: opts.user,
      temperature: opts.temperature ?? 0.25,
      maxTokens: opts.maxTokens,
      format: 'json',
      contextBudget: 'adaptive',
      signal: opts.signal
    })

    let candidate = first.json !== undefined ? first.json : extractJsonCandidate(first.text)
    let repaired = false

    const tryValidate = (raw: unknown): { ok: true; value: T } | { ok: false; errorText: string } => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, errorText: 'A resposta não é um objeto JSON válido.' }
      }
      const parsed = opts.schema.safeParse(raw)
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
          .join('; ')
        return { ok: false, errorText: msg }
      }
      return { ok: true, value: parsed.data }
    }

    let check = tryValidate(candidate)
    if (!check.ok) {
      repaired = true
      const slotsSummary = (opts.slots || [])
        .map((s) => `${s.key} (${s.type}${s.maxChars ? `, maxChars=${s.maxChars}` : ''})`)
        .join(', ')
      const repairPrompt = buildJsonRepairPrompt({
        brokenOutput: first.text,
        validationErrors: check.errorText,
        slotsSummary: slotsSummary || 'Objeto JSON conforme instruções anteriores'
      })
      const second = await this.completeText({
        system: opts.system,
        user: repairPrompt,
        temperature: 0.1,
        maxTokens: opts.maxTokens,
        format: 'json',
        signal: opts.signal
      })
      candidate = second.json !== undefined ? second.json : extractJsonCandidate(second.text)
      check = tryValidate(candidate)
    }

    if (!check.ok) {
      throw new Error(`Falha ao validar JSON estruturado do modelo: ${check.errorText}`)
    }

    let finalData = check.value
    if (opts.slots && opts.slots.length > 0) {
      const enforced = enforceSlotConstraints(finalData, opts.slots)
      finalData = enforced.sanitized as T
    }

    return {
      data: finalData,
      model: first.model,
      provider: first.provider,
      isLocal: first.isLocal,
      repaired
    }
  }

  async analyzeImage(opts: {
    imageBase64: string
    prompt: string
    maxTokens?: number
  }): Promise<{ text: string; visionAvailable: boolean }> {
    const res = await this.transport.vision(opts)
    return {
      text: res.text || '',
      visionAvailable: res.visionAvailable !== false
    }
  }
}
