import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { LLMGateway, type LLMTransport } from '../src/core/llm/llm-gateway.ts'

function makeMockTransport(opts: {
  contextWindowTokens?: number
  isLocal?: boolean
  responses: string[]
}): LLMTransport {
  let callIdx = 0
  return {
    async complete() {
      const text = opts.responses[Math.min(callIdx++, opts.responses.length - 1)]
      return { text, model: 'mock-model', provider: opts.isLocal ? 'local' : 'cloud' }
    },
    async vision() {
      return { text: 'Texto OCR extraído', visionAvailable: true }
    },
    async getCapabilities() {
      return {
        provider: opts.isLocal ? 'local' : 'openai',
        providerName: opts.isLocal ? 'Local' : 'OpenAI',
        model: 'mock-model',
        isLocal: Boolean(opts.isLocal),
        contextWindowTokens: opts.contextWindowTokens ?? 8192,
        maxOutputTokens: 2048,
        visionSupported: true,
        structuredOutputSupported: true,
        streamingSupported: true
      }
    }
  }
}

describe('LLMGateway', () => {
  it('adapts retrieval budget to small local models vs large cloud models', async () => {
    const smallGw = new LLMGateway(makeMockTransport({ contextWindowTokens: 4096, isLocal: true, responses: ['ok'] }))
    const largeGw = new LLMGateway(makeMockTransport({ contextWindowTokens: 128000, isLocal: false, responses: ['ok'] }))

    const smallCaps = await smallGw.getCapabilities()
    const largeCaps = await largeGw.getCapabilities()

    expect(smallGw.isCompactModel(smallCaps)).toBe(true)
    expect(largeGw.isCompactModel(largeCaps)).toBe(false)
    expect(smallGw.recommendedRetrievalConfig(smallCaps).topK).toBeLessThan(
      largeGw.recommendedRetrievalConfig(largeCaps).topK
    )
  })

  it('repairs invalid JSON automatically using schema validation errors', async () => {
    const schema = z.object({
      title: z.string(),
      count: z.number()
    })
    const transport = makeMockTransport({
      responses: [
        '{"title": "Relatório", "count": "nao_numero"}',
        '{"title": "Relatório Corrigido", "count": 42}'
      ]
    })
    const gw = new LLMGateway(transport)
    const res = await gw.completeStructured({
      system: 'sys',
      user: 'usr',
      schema,
      slots: [{ key: 'title', label: 'Título', type: 'string', maxChars: 12, description: 't' }]
    })
    expect(res.repaired).toBe(true)
    expect(res.data.count).toBe(42)
    expect(res.data.title.length).toBeLessThanOrEqual(12)
  })
})
