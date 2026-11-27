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

export function citationLabel(locale: DocsLocale): string {
  switch (normalizeLocale(locale)) {
    case 'en-US':
      return 'Source'
    case 'es':
      return 'Fuente'
    case 'fr':
      return 'Source'
    case 'de':
      return 'Quelle'
    case 'it':
      return 'Fonte'
    default:
      return 'Fonte'
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

export interface OnboardingSampleCopy {
  projectName: string
  projectDescription: string
  sourceTitle: string
  sourceText: string
}

const ONBOARDING_SAMPLE_COPY: Record<DocsLocale, OnboardingSampleCopy> = {
  'pt-BR': {
    projectName: 'Exemplo: Relatório de Sustentabilidade & Estudo',
    projectDescription: 'Projeto de exemplo pré-carregado para testar todas as ferramentas com citações.',
    sourceTitle: 'Relatório Piloto 2026 (Exemplo)',
    sourceText: [
      '# Relatório Anual de Eficiência Energética 2026',
      'Em 2026, a unidade piloto reduziu o consumo de energia elétrica em 28% após a adoção de iluminação LED e sensores de presença.',
      'A economia financeira acumulada no exercício foi de R$ 420.000,00, com retorno do investimento (payback) em 14 meses.',
      '## Metas para 2027',
      '1. Expandir energia solar fotovoltaica para 60% da demanda diurna.',
      '2. Treinar 100% das equipes operacionais em boas práticas de eficiência até junho de 2027.'
    ].join('\n\n')
  },
  'en-US': {
    projectName: 'Example: Sustainability Report & Study',
    projectDescription: 'Preloaded example project for trying every tool with citations.',
    sourceTitle: 'Pilot Report 2026 (Example)',
    sourceText: [
      '# 2026 Annual Energy Efficiency Report',
      'In 2026, the pilot unit reduced electricity consumption by 28% after adopting LED lighting and occupancy sensors.',
      'The accumulated financial savings reached R$ 420,000.00, with a payback period of 14 months.',
      '## Goals for 2027',
      '1. Expand photovoltaic solar energy to meet 60% of daytime demand.',
      '2. Train 100% of operations teams in energy-efficiency best practices by June 2027.'
    ].join('\n\n')
  },
  es: {
    projectName: 'Ejemplo: Informe de Sostenibilidad y Estudio',
    projectDescription: 'Proyecto de ejemplo precargado para probar todas las herramientas con citas.',
    sourceTitle: 'Informe Piloto 2026 (Ejemplo)',
    sourceText: [
      '# Informe Anual de Eficiencia Energética 2026',
      'En 2026, la unidad piloto redujo el consumo de electricidad en un 28 % tras adoptar iluminación LED y sensores de presencia.',
      'El ahorro financiero acumulado fue de R$ 420.000,00, con un período de recuperación de la inversión de 14 meses.',
      '## Metas para 2027',
      '1. Ampliar la energía solar fotovoltaica para cubrir el 60 % de la demanda diurna.',
      '2. Capacitar al 100 % de los equipos operativos en buenas prácticas de eficiencia hasta junio de 2027.'
    ].join('\n\n')
  },
  fr: {
    projectName: 'Exemple : Rapport de durabilité et étude',
    projectDescription: 'Projet d’exemple préchargé pour essayer tous les outils avec des citations.',
    sourceTitle: 'Rapport pilote 2026 (Exemple)',
    sourceText: [
      '# Rapport annuel d’efficacité énergétique 2026',
      'En 2026, l’unité pilote a réduit sa consommation d’électricité de 28 % après l’adoption d’un éclairage LED et de capteurs de présence.',
      'Les économies financières cumulées ont atteint 420 000,00 R$, avec un retour sur investissement en 14 mois.',
      '## Objectifs pour 2027',
      '1. Développer l’énergie solaire photovoltaïque pour couvrir 60 % de la demande diurne.',
      '2. Former 100 % des équipes opérationnelles aux bonnes pratiques d’efficacité d’ici juin 2027.'
    ].join('\n\n')
  },
  de: {
    projectName: 'Beispiel: Nachhaltigkeitsbericht und Studie',
    projectDescription: 'Vorgeladenes Beispielprojekt zum Ausprobieren aller Werkzeuge mit Zitaten.',
    sourceTitle: 'Pilotbericht 2026 (Beispiel)',
    sourceText: [
      '# Jahresbericht zur Energieeffizienz 2026',
      'Im Jahr 2026 reduzierte die Pilotabteilung den Stromverbrauch um 28 %, nachdem LED-Beleuchtung und Präsenzsensoren eingeführt wurden.',
      'Die kumulierten finanziellen Einsparungen betrugen 420.000,00 R$, bei einer Amortisationsdauer von 14 Monaten.',
      '## Ziele für 2027',
      '1. Photovoltaik so ausbauen, dass 60 % des Tagesbedarfs gedeckt werden.',
      '2. Bis Juni 2027 100 % der operativen Teams in bewährten Effizienzpraktiken schulen.'
    ].join('\n\n')
  },
  it: {
    projectName: 'Esempio: Rapporto di sostenibilità e studio',
    projectDescription: 'Progetto di esempio precaricato per provare tutti gli strumenti con citazioni.',
    sourceTitle: 'Rapporto pilota 2026 (Esempio)',
    sourceText: [
      '# Rapporto annuale sull’efficienza energetica 2026',
      'Nel 2026, l’unità pilota ha ridotto i consumi di elettricità del 28 % dopo l’adozione di illuminazione LED e sensori di presenza.',
      'Il risparmio finanziario cumulato è stato di R$ 420.000,00, con un ritorno dell’investimento in 14 mesi.',
      '## Obiettivi per il 2027',
      '1. Espandere l’energia solare fotovoltaica per coprire il 60 % della domanda diurna.',
      '2. Formare il 100 % dei team operativi sulle buone pratiche di efficienza entro giugno 2027.'
    ].join('\n\n')
  }
}

export function onboardingSampleCopy(locale: DocsLocale): OnboardingSampleCopy {
  return ONBOARDING_SAMPLE_COPY[normalizeLocale(locale)]
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
