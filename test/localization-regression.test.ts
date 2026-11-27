import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { renderSceneSvg } from '../src/core/engines/video-engine.ts'
import { parseLocaleNumber } from '../src/core/engines/visual-charts-png.ts'
import {
  exportFlashcardsCsvAndAnki,
  renderXlsxWorkbook
} from '../src/core/engines/study-data-engines.ts'
import { enforceSlotConstraints } from '../src/core/llm/llm-gateway.ts'
import { buildChatSystemPrompt } from '../src/core/llm/prompts/v1/index.ts'
import { onboardingSampleCopy } from '../src/core/i18n.ts'
import { runVisualQA } from '../src/core/qa/visual-qa.ts'
import { ingestSource } from '../src/core/rag/source-ingestor.ts'
import { createDefaultBrandKit } from '../src/core/templates/brand-kit.ts'
import { localizeTemplate } from '../src/core/templates/localize-template.ts'
import { templateRegistry } from '../src/core/templates/template-registry.ts'
import { translateCore } from '../src/core/translate.ts'
import { buildTemplatePreviewPages } from '../src/ui/shared/template-preview-svg.ts'
import { resolveTargetSizeHint } from '../src/ui/shared/tool-catalog.ts'

const tokens = {
  primary: '#111827',
  secondary: '#374151',
  accent: '#7C3AED',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  textPrimary: '#111827',
  textMuted: '#4B5563',
  border: '#D1D5DB',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  monoFont: 'JetBrains Mono'
}

describe('localization regressions', () => {
  it('translates the clear action instead of falling back to Portuguese', () => {
    expect(translateCore('en-US', 'Limpar')).toBe('Clear')
    expect(translateCore('fr', 'Limpar')).toBe('Effacer')
  })

  it('localizes chat citation markers', () => {
    const english = buildChatSystemPrompt({ hasSources: true, groundingMode: 'sources_only', locale: 'en-US' })
    const french = buildChatSystemPrompt({ hasSources: true, groundingMode: 'sources_only', locale: 'fr' })
    expect(english).toContain('[Source:')
    expect(english).not.toContain('[Fonte:')
    expect(french).toContain('[Source:')
  })

  it('localizes source section metadata', async () => {
    const result = await ingestSource({
      projectId: 'project',
      sourceId: 'source',
      kind: 'text',
      text: 'First paragraph without a heading.',
      locale: 'en-US'
    })
    expect(result.sections[0].sectionTitle).toBe('Introduction')
    expect(result.sections[0].locator).toBe('Section 1')
  })

  it('localizes generated video labels and quote fallback', () => {
    const cover = renderSceneSvg({
      scene: { id: 'cover', component: 'TitleHeroScene', heading: 'Results', narration: 'Summary' },
      tokens,
      aspectRatio: '16:9',
      sceneIndex: 0,
      totalScenes: 1,
      locale: 'en-US'
    })
    const quote = renderSceneSvg({
      scene: { id: 'quote', component: 'QuoteCalloutScene', heading: 'Quote', narration: '', quote: { text: 'Evidence' } },
      tokens,
      aspectRatio: '16:9',
      sceneIndex: 0,
      totalScenes: 1,
      locale: 'en-US'
    })
    expect(cover).toContain('PRESENTATION')
    expect(cover).not.toContain('APRESENTAÇÃO')
    expect(quote).toContain('Reference')
    expect(quote).not.toContain('Referência')
  })

  it('localizes spreadsheet defaults and summary rows', () => {
    const buffer = renderXlsxWorkbook({
      sheets: [{ name: 'Metrics', headers: ['Value'], rows: [[10]], summaryFormulaRow: true }],
      locale: 'de'
    })
    const files = unzipSync(new Uint8Array(buffer))
    const workbook = strFromU8(files['xl/workbook.xml'])
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(workbook).toContain('Metrics')
    expect(sheet).toContain('Gesamt')

    const fallback = renderXlsxWorkbook({ sheets: [], locale: 'en-US' })
    const fallbackFiles = unzipSync(new Uint8Array(fallback))
    expect(strFromU8(fallbackFiles['xl/workbook.xml'])).toContain('Data')
    expect(strFromU8(fallbackFiles['xl/worksheets/sheet1.xml'])).toContain('Item')
  })

  it('localizes flashcard CSV headers', () => {
    const result = exportFlashcardsCsvAndAnki({
      deckTitle: 'Review',
      cards: [{ front: 'Question', back: 'Answer' }],
      locale: 'en-US'
    })
    expect(result.csvText).toContain('"Question","Answer","Explanation","Source"')
  })

  it('localizes missing-slot placeholders and QA messages', () => {
    const constrained = enforceSlotConstraints({}, [{ key: 'title', label: 'Title', type: 'string', required: true, description: 'Title' }], 'en-US')
    expect(constrained.sanitized.title).toBe('[Title not found in sources]')

    const qa = runVisualQA({
      tokens: { ...tokens, textPrimary: '#777777' },
      pages: [{ index: 0, label: 'Page 1', fillRatio: 0.5, overflowChars: 20 }],
      locale: 'en-US'
    })
    expect(qa.report.issues.map((issue) => issue.message).join(' ')).toContain('Insufficient contrast')
    expect(qa.report.issues.map((issue) => issue.message).join(' ')).toContain('Estimated overflow')
  })

  it('localizes the default brand kit name', () => {
    expect(createDefaultBrandKit('project', '', 'en-US').name).toBe('Default Brand Kit')
  })

  it('does not leak Portuguese subtopic labels into English mindmap previews', () => {
    const preview = buildTemplatePreviewPages(
      { id: 'mindmap-radial', name: 'Mind map', description: 'Mind map' },
      'mindmap',
      null,
      false,
      'en-US'
    )
    expect(preview.pages.map((page) => page.svg).join(' ')).not.toContain('Subtema')
  })

  it('localizes template metadata without mutating the registry', () => {
    const source = templateRegistry.getById('oficio-mrpr')!
    const localized = localizeTemplate(source, 'en-US')
    expect(localized.name).toBe('Official Letter (MRPR Standard)')
    expect(localized.description).not.toBe(source.description)
    expect(source.name).toBe('Ofício Oficial (Padrão MRPR)')
  })

  it('localizes onboarding copy and target-size hints', () => {
    expect(onboardingSampleCopy('en-US').projectName).toContain('Sustainability Report')
    expect(resolveTargetSizeHint('pptx', 'custom', '12', 'en-US')).toContain('12 content slide(s)')
  })

  it('preserves double-brace placeholders during interpolation', () => {
    expect(translateCore('en-US', 'Valor para preencher {{placeholder}}', { placeholder: 'name' })).toBe('Value to fill {{name}}')
  })

  it('localizes legacy custom-template descriptions', () => {
    const source = templateRegistry.getById('oficio-mrpr')!
    const localized = localizeTemplate({ ...source, description: 'Template personalizado importado (base.docx)' }, 'en-US')
    expect(localized.description).toBe('Imported custom template (base.docx)')
  })

  it('parses formatted chart numbers according to the artifact locale', () => {
    expect(parseLocaleNumber('1,450', 'en-US')).toBe(1450)
    expect(parseLocaleNumber('1.450', 'pt-BR')).toBe(1450)
    expect(parseLocaleNumber('1,450', 'pt-BR')).toBe(1.45)
    expect(parseLocaleNumber('1.450,25', 'de')).toBe(1450.25)
  })
})
