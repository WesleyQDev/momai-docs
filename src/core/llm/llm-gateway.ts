import { z } from 'zod'
import type { LLMCapabilities, SlotConstraint } from '../types.ts'
import { buildJsonRepairPrompt } from './prompts/v1/index.ts'
import { normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

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
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 130_000)
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
          const err = new Error(errPayload.error || `LLM HTTP ${res.status}`) as Error & { status?: number }
          err.status = res.status
          throw err
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

function tryParseJsonWithCleanup(text: string): unknown {
  const cleaned = text.replace(/,\s*([}\]])/g, '$1').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return undefined
  }
}

function recoverTruncatedJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  if (start < 0) return undefined
  let src = text.slice(start).trim()
  const stack: Array<'{' | '['> = []
  let inString = false
  let escape = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' && stack[stack.length - 1] === '{') stack.pop()
    else if (ch === ']' && stack[stack.length - 1] === '[') stack.pop()
  }
  if (stack.length === 0 && !inString) return undefined
  if (inString) {
    if (escape) src = src.slice(0, -1)
    src += '"'
  }
  src = src.replace(/,\s*"[^"]*"\s*:\s*$/, '').replace(/,\s*"[^"]*"\s*$/, '').replace(/,\s*$/, '')
  // If cut right after a key like {"a":1,"b":
  src = src.replace(/,\s*"[^"]*"\s*:\s*"[^"]*"\s*$/, (m) => m)
  if (/:\s*$/.test(src)) src += 'null'
  for (let i = stack.length - 1; i >= 0; i--) {
    src += stack[i] === '{' ? '}' : ']'
  }
  return tryParseJsonWithCleanup(src)
}

export function extractJsonCandidate(text: string): unknown {
  const raw = String(text || '').trim()
  if (!raw) return undefined
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const unfenced = fenced ? fenced[1].trim() : raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()

  const direct = tryParseJsonWithCleanup(unfenced)
  if (direct !== undefined) {
    return Array.isArray(direct) && direct.length === 1 && direct[0] && typeof direct[0] === 'object' ? direct[0] : direct
  }

  const start = unfenced.search(/[[{]/)
  const end = Math.max(unfenced.lastIndexOf('}'), unfenced.lastIndexOf(']'))
  if (start >= 0 && end > start) {
    const sliced = tryParseJsonWithCleanup(unfenced.slice(start, end + 1))
    if (sliced !== undefined) {
      return Array.isArray(sliced) && sliced.length === 1 && sliced[0] && typeof sliced[0] === 'object' ? sliced[0] : sliced
    }
  }

  return recoverTruncatedJsonObject(unfenced)
}

function truncateSmart(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  const slice = value.slice(0, maxChars)
  const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
  if (lastSentence > maxChars * 0.55) {
    return slice.slice(0, lastSentence + 1).trimEnd()
  }
  const hardSlice = value.slice(0, maxChars - 1)
  const lastSpace = hardSlice.lastIndexOf(' ')
  return (lastSpace > maxChars * 0.6 ? hardSlice.slice(0, lastSpace) : hardSlice).trimEnd() + '…'
}

export function enforceSlotConstraints(
  data: Record<string, unknown>,
  slots: SlotConstraint[],
  locale?: DocsLocale
): { sanitized: Record<string, unknown>; warnings: string[] } {
  const resolvedLocale = normalizeLocale(locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(resolvedLocale, text, vars)
  const out: Record<string, unknown> = { ...data }
  const warnings: string[] = []
  for (const slot of slots) {
    const val = out[slot.key]
    if (val === undefined || val === null) {
      if (slot.required) {
        if (slot.type === 'string') out[slot.key] = `[${tr('{label} não informado nas fontes', { label: slot.label })}]`
        else if (slot.type === 'string[]' || slot.type === 'object[]') out[slot.key] = []
        else if (slot.type === 'number') out[slot.key] = 0
        warnings.push(`Missing required slot: ${slot.key}`)
      }
      continue
    }
    if (slot.type === 'string' && typeof val === 'string' && slot.maxChars && val.length > slot.maxChars) {
      out[slot.key] = truncateSmart(val, slot.maxChars)
      warnings.push(`Slot ${slot.key} adjusted to ${slot.maxChars} characters`)
    }
    if (Array.isArray(val) && slot.maxItems && val.length > slot.maxItems) {
      out[slot.key] = val.slice(0, slot.maxItems)
      warnings.push(`Slot ${slot.key} limited to ${slot.maxItems} items`)
    }
  }
  return { sanitized: out, warnings }
}

const DEFAULT_MAX_RETRIES = 4
const DEFAULT_RETRY_BASE_MS = 1200
const DEFAULT_RETRY_MAX_MS = 15_000

export interface LLMGatewayRetryOptions {
  maxRetries?: number
  retryBaseMs?: number
  retryMaxMs?: number
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  if (signal?.aborted) return Promise.reject(new Error('Aborted'))
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('Aborted'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export class LLMGateway {
  private readonly transport: LLMTransport
  private readonly maxRetries: number
  private readonly retryBaseMs: number
  private readonly retryMaxMs: number

  constructor(transport?: LLMTransport, retryOpts?: LLMGatewayRetryOptions) {
    this.transport = transport || createHostLlmTransport()
    this.maxRetries = retryOpts?.maxRetries ?? DEFAULT_MAX_RETRIES
    this.retryBaseMs = retryOpts?.retryBaseMs ?? DEFAULT_RETRY_BASE_MS
    this.retryMaxMs = retryOpts?.retryMaxMs ?? DEFAULT_RETRY_MAX_MS
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
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
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
        const status = (err as { status?: number })?.status
        const noSessionConnError =
          !process.env.MOMAI_SESSION_TOKEN &&
          (/fetch failed|ECONNREFUSED|ENOTFOUND|unauthorized|forbidden/i.test(msg) || status === 401 || status === 403)
        if (
          opts.signal?.aborted ||
          status === 401 ||
          status === 403 ||
          noSessionConnError ||
          /prompt_too_large|empty prompt/i.test(msg)
        ) {
          break
        }
        if (attempt < this.maxRetries) {
          const expDelay = Math.min(this.retryMaxMs, this.retryBaseMs * Math.pow(2, attempt))
          const jitter = Math.round(expDelay * (0.85 + Math.random() * 0.3))
          await sleepWithSignal(jitter, opts.signal)
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
    locale?: DocsLocale
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
        return { ok: false, errorText: 'The response is not a valid JSON object.' }
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
        slotsSummary: slotsSummary || 'JSON object as specified in the previous instructions'
      })
      const second = await this.completeText({
        system: opts.system,
        user: repairPrompt,
        temperature: 0.1,
        maxTokens: opts.maxTokens,
        format: 'json',
        contextBudget: 'adaptive',
        signal: opts.signal
      })
      candidate = second.json !== undefined ? second.json : extractJsonCandidate(second.text)
      check = tryValidate(candidate)
    }

    if (!check.ok) {
      throw new Error(`Failed to validate structured JSON from the model: ${check.errorText}`)
    }

    let finalData = check.value
    if (opts.slots && opts.slots.length > 0) {
      const enforced = enforceSlotConstraints(finalData, opts.slots, opts.locale)
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
