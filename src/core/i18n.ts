/**
 * Shared locale helpers for MomAI Docs.
 *
 * The UI and the background runtime both need the same locale normalization
 * and the same language rules for generated content, so this module lives in
 * `core` and has no React or host dependencies.
 */

export type DocsLocale = 'pt-BR' | 'en-US' | 'es' | 'fr' | 'de' | 'it'

export const DOCS_LOCALES: DocsLocale[] = ['pt-BR', 'en-US', 'es', 'fr', 'de', 'it']

export const DEFAULT_DOCS_LOCALE: DocsLocale = 'pt-BR'

export function normalizeLocale(raw?: string | null): DocsLocale {
  const value = String(raw || '').trim()
  if (!value) return DEFAULT_DOCS_LOCALE
  const exact = DOCS_LOCALES.find((locale) => locale.toLowerCase() === value.toLowerCase())
  if (exact) return exact
  const normalized = value.replace('_', '-').toLowerCase()
  if (normalized.startsWith('pt')) return 'pt-BR'
  if (normalized.startsWith('en')) return 'en-US'
  if (normalized.startsWith('es')) return 'es'
  if (normalized.startsWith('fr')) return 'fr'
  if (normalized.startsWith('de')) return 'de'
  if (normalized.startsWith('it')) return 'it'
  return DEFAULT_DOCS_LOCALE
}

export function isDocsLocale(raw?: string | null): raw is DocsLocale {
  return DOCS_LOCALES.includes(raw as DocsLocale)
}

/**
 * Sentence used in structured-generation prompts to pin the output language.
 */
export function outputLanguageRule(locale: DocsLocale): string {
  switch (normalizeLocale(locale)) {
    case 'en-US':
      return 'Write all output content in English, with impeccable spelling and grammar.'
    case 'es':
      return 'Escribe todo el contenido en español, con ortografía y gramática impecables.'
    case 'fr':
      return 'Rédigez tout le contenu en français, avec une orthographe et une grammaire irréprochables.'
    case 'de':
      return 'Schreiben Sie alle Inhalte auf Deutsch, mit einwandfreier Rechtschreibung und Grammatik.'
    case 'it':
      return 'Scrivi tutti i contenuti in italiano, con ortografia e grammatica impeccabili.'
    default:
      return 'Redija todo o conteúdo em Português do Brasil (PT-BR), com ortografia, acentuação e concordância impecáveis.'
  }
}

/**
 * Sentence used in chat prompts to pin the reply language.
 */
export function chatLanguageRule(locale: DocsLocale): string {
  switch (normalizeLocale(locale)) {
    case 'en-US':
      return 'Reply naturally, clearly and helpfully in English.'
    case 'es':
      return 'Responde de forma natural, clara y útil en español.'
    case 'fr':
      return 'Répondez de manière naturelle, claire et utile en français.'
    case 'de':
      return 'Antworten Sie natürlich, klar und hilfreich auf Deutsch.'
    case 'it':
      return 'Rispondi in modo naturale, chiaro e utile in italiano.'
    default:
      return 'Responda de forma natural, clara e amigável em Português do Brasil (PT-BR).'
  }
}

export const LOCALE_LABELS: Record<DocsLocale, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano'
}

export const LOCALE_SHORT_LABELS: Record<DocsLocale, string> = {
  'pt-BR': 'PT',
  'en-US': 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  it: 'IT'
}

const UNTITLED_PROJECT_NAMES: Record<DocsLocale, string> = {
  'pt-BR': 'Projeto sem título',
  'en-US': 'Untitled project',
  es: 'Proyecto sin título',
  fr: 'Projet sans titre',
  de: 'Unbenanntes Projekt',
  it: 'Progetto senza titolo'
}

export function defaultProjectName(locale: DocsLocale): string {
  return UNTITLED_PROJECT_NAMES[normalizeLocale(locale)]
}

/**
 * True when the name is one of the placeholder titles used across languages.
 * Older projects may still carry the Portuguese placeholders, so they stay
 * eligible for auto-titling after a language change.
 */
export function isUntitledProject(name: string, locale: DocsLocale): boolean {
  const value = String(name || '').trim()
  if (!value) return true
  const placeholders = new Set<string>([
    'Projeto sem título',
    'Novo Projeto',
    'New Project',
    'Untitled project',
    'Proyecto sin título',
    'Nuevo Proyecto',
    'Projet sans titre',
    'Nouveau Projet',
    'Unbenanntes Projekt',
    'Neues Projekt',
    'Progetto senza titolo',
    'Nuovo Progetto',
    defaultProjectName(locale)
  ])
  return placeholders.has(value)
}
