import { describe, expect, it } from 'vitest'

import {
  DOCS_LOCALES,
  chatLanguageRule,
  defaultProjectName,
  isUntitledProject,
  normalizeLocale,
  outputLanguageRule
} from '../src/core/i18n.ts'
import { translateCore } from '../src/core/translate.ts'
import { CATALOG } from '../src/locales/catalog.ts'
import { TEMPLATES_CATALOG } from '../src/locales/templates-catalog.ts'
import { TOOLS_CATALOG } from '../src/locales/tools-catalog.ts'
import { RUNTIME_CATALOG } from '../src/locales/runtime-catalog.ts'
import { getPreviewCopy } from '../src/ui/shared/template-preview-copy.ts'
import { buildTemplatePreviewPages } from '../src/ui/shared/template-preview-svg.ts'

const TRANSLATED_LOCALES = ['en-US', 'es', 'fr', 'de', 'it'] as const

describe('docs i18n', () => {
  it('normalizes the six supported locales and their language aliases', () => {
    expect(normalizeLocale('pt')).toBe('pt-BR')
    expect(normalizeLocale('pt_BR')).toBe('pt-BR')
    expect(normalizeLocale('en')).toBe('en-US')
    expect(normalizeLocale('en-GB')).toBe('en-US')
    expect(normalizeLocale('es-ES')).toBe('es')
    expect(normalizeLocale('fr-FR')).toBe('fr')
    expect(normalizeLocale('de-DE')).toBe('de')
    expect(normalizeLocale('it-IT')).toBe('it')
    expect(normalizeLocale('xx-YY')).toBe('pt-BR')
  })

  it('translates UI copy and leaves unknown keys untouched', () => {
    expect(translateCore('en-US', 'Novo projeto')).toBe('New project')
    expect(translateCore('fr', 'Configurar timbre e identidade visual')).toContain('identité visuelle')
    expect(translateCore('de', 'Ferramentas & Templates')).toBe('Werkzeuge und Vorlagen')
    expect(translateCore('it', '{count} projetos', { count: 3 })).toBe('3 progetti')
    expect(translateCore('en-US', 'chave inexistente')).toBe('chave inexistente')
  })

  it('keeps one translation for every language in every catalog entry', () => {
    const dictionaries = [CATALOG, TOOLS_CATALOG, TEMPLATES_CATALOG, RUNTIME_CATALOG]
    for (const dictionary of dictionaries) {
      for (const [key, entry] of Object.entries(dictionary)) {
        for (const locale of TRANSLATED_LOCALES) {
          expect(entry[locale], `${key} is missing ${locale}`).toBeTruthy()
        }
      }
    }
  })

  it('builds language rules for all six locales', () => {
    for (const locale of DOCS_LOCALES) {
      expect(outputLanguageRule(locale).length).toBeGreaterThan(20)
      expect(chatLanguageRule(locale).length).toBeGreaterThan(20)
    }
  })

  it('recognizes placeholder project names across languages', () => {
    for (const locale of DOCS_LOCALES) {
      expect(isUntitledProject(defaultProjectName(locale), locale)).toBe(true)
    }
    expect(isUntitledProject('Relatório de sustentabilidade', 'pt-BR')).toBe(false)
    expect(isUntitledProject('Untitled project', 'de')).toBe(true)
  })

  it('localizes the illustrative template previews', () => {
    const slideTemplate = { id: 'pptx-executivo', name: 'Executive deck', description: 'Executive deck' }
    for (const locale of DOCS_LOCALES) {
      const copy = getPreviewCopy(locale)
      const preview = buildTemplatePreviewPages(slideTemplate, 'pptx', null, false, locale)
      const text = preview.pages.map((page) => page.svg).join(' ')
      expect(text).toContain(copy.slide.contentTitle)
      if (locale !== 'pt-BR') {
        expect(text).not.toContain('Principais Pontos e Evolução')
      }
    }

    const letter = buildTemplatePreviewPages(
      { id: 'oficio-mrpr', name: 'Official letter', description: 'Official letter' },
      'oficio',
      null,
      false,
      'en-US'
    )
    const letterText = letter.pages.map((page) => page.svg).join(' ')
    expect(letterText).toContain('Letter No. 042/2026/GAB')
    expect(letterText).toContain('DELIVERY SCHEDULE')
  })
})
