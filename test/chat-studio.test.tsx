// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatMarkdown } from '../src/ui/ChatMarkdown'
import { StudioOrchestrator } from '../src/core/studio-orchestrator.ts'
import { LLMGateway } from '../src/core/llm/llm-gateway.ts'
import type { HostBridge } from '../src/core/types.ts'

function createInMemoryBridge(): HostBridge {
  const tables = new Map<string, any[]>()
  const kv = new Map<string, any>()
  return {
    storage: {
      async get(k) { return kv.get(k) ?? null },
      async set(k, v) { kv.set(k, v) },
      async delete(k) { kv.delete(k) },
      async listKeys() { return [...kv.keys()] }
    },
    collections: {
      async insert(col, rec) {
        const list = tables.get(col) || []
        const id = list.length + 1
        list.push({ ...rec, _rowId: id })
        tables.set(col, list)
        return { id }
      },
      async list(col, opts: any = {}) {
        let list = [...(tables.get(col) || [])]
        if (opts.where) {
          list = list.filter((row) => Object.entries(opts.where).every(([k, v]) => row[k] === v))
        }
        return list.slice(0, opts.limit || 100)
      },
      async count(col) { return { count: (tables.get(col) || []).length } },
      async search() { return [] },
      async remove() { return { ok: true } },
      async clear() { return { removed: 0 } },
      async upsert(col, rec) {
        const list = tables.get(col) || []
        list.push({ ...rec, _rowId: list.length + 1 })
        tables.set(col, list)
        return { id: list.length, updated: false }
      },
      async upsertMany() { return { upserted: 0 } }
    },
    sessionFiles: {
      async write(p) { return { ok: true, path: p } },
      async read() { return { bytes: new Uint8Array(), text: '' } },
      async list() { return [] },
      async remove() { return { ok: true } }
    },
    log() {},
    sendEvent() {},
    sendStructuredResponse() {}
  }
}

describe('ChatMarkdown', () => {
  it('renders GitHub-flavored Markdown tables cleanly without leaking pipes or dashes', () => {
    const md = [
      'Aqui está a comparação:',
      '',
      '| Recurso | Plano A | Plano B |',
      '| :--- | :---: | ---: |',
      '| Preço | **R$ 50** | R$ 90 |',
      '| Suporte | Email<br>Chat | `24/7` |'
    ].join('\n')

    const { container } = render(<ChatMarkdown text={md} />)
    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    const ths = Array.from(container.querySelectorAll('th')).map((el) => el.textContent)
    expect(ths).toEqual(['Recurso', 'Plano A', 'Plano B'])
    const tds = Array.from(container.querySelectorAll('td')).map((el) => el.textContent)
    expect(tds).toContain('R$ 50')
    expect(tds).toContain('24/7')
    expect(container.querySelector('br')).not.toBeNull()
    expect(container.textContent).not.toContain('---')
  })

  it('converts leaked HTML tables into clean rendered tables while preserving fenced code blocks', () => {
    const md = [
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead><tbody><tr><td>A</td><td>10</td></tr></tbody></table>',
      '',
      '```html',
      '<table><tr><td>raw</td></tr></table>',
      '```'
    ].join('\n')

    const { container } = render(<ChatMarkdown text={md} />)
    const tables = container.querySelectorAll('table')
    expect(tables.length).toBe(1)
    expect(tables[0].textContent).toContain('Item')
    expect(tables[0].textContent).toContain('10')
    const pre = container.querySelector('pre code')
    expect(pre?.textContent).toContain('<table><tr><td>raw</td></tr></table>')
  })
})

describe('Integrated chat Studio generation', () => {
  it('returns generatedAction when the user asks to generate a Studio model', async () => {
    const bridge = createInMemoryBridge()
    const mockLlm = new LLMGateway({
      async complete(opts) {
        if (opts.format === 'json') {
          return {
            text: JSON.stringify({
              shouldGenerate: true,
              toolId: 'pptx',
              templateId: null,
              instructions: 'Apresentação sobre energia solar com foco em economia.',
              reply: 'Iniciei a geração dos seus **Slides** no Estúdio!'
            }),
            model: 'mock',
            provider: 'mock'
          }
        }
        return { text: 'Resposta normal', model: 'mock', provider: 'mock' }
      },
      async vision() { return { text: '', visionAvailable: false } },
      async getCapabilities() {
        return { provider: 'mock', model: 'mock', isLocal: false, maxContextTokens: 8192, visionAvailable: false }
      }
    })

    const studio = new StudioOrchestrator(bridge, mockLlm)
    const res = await studio.querySources({
      projectId: 'proj-1',
      query: 'Gere uma apresentação de slides sobre energia solar',
      answerWithCitations: true,
      locale: 'pt-BR'
    })

    expect(res.generatedAction).toEqual({
      toolId: 'pptx',
      templateId: undefined,
      instructions: 'Apresentação sobre energia solar com foco em economia.'
    })
    expect(res.answer).toContain('Slides')
  })

  it('keeps normal chat answers without generatedAction when user asks for a table in chat', async () => {
    const bridge = createInMemoryBridge()
    const mockLlm = new LLMGateway({
      async complete(opts) {
        if (opts.format === 'json') {
          return {
            text: JSON.stringify({
              shouldGenerate: false,
              toolId: null,
              templateId: null,
              instructions: '',
              reply: ''
            }),
            model: 'mock',
            provider: 'mock'
          }
        }
        return {
          text: '| Col A | Col B |\n| --- | --- |\n| 1 | 2 |',
          model: 'mock',
          provider: 'mock'
        }
      },
      async vision() { return { text: '', visionAvailable: false } },
      async getCapabilities() {
        return { provider: 'mock', model: 'mock', isLocal: false, maxContextTokens: 8192, visionAvailable: false }
      }
    })

    const studio = new StudioOrchestrator(bridge, mockLlm)
    const res = await studio.querySources({
      projectId: 'proj-1',
      query: 'Faça uma tabela comparando A e B',
      answerWithCitations: true,
      locale: 'pt-BR'
    })

    expect((res as any).generatedAction).toBeUndefined()
    expect(res.answer).toContain('| Col A | Col B |')
  })
})
