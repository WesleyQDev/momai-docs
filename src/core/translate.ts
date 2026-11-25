import { CATALOG } from '../locales/catalog.ts'
import { TOOLS_CATALOG } from '../locales/tools-catalog.ts'
import { TEMPLATES_CATALOG } from '../locales/templates-catalog.ts'
import { normalizeLocale, type DocsLocale } from './i18n.ts'

const DICTIONARY: Record<string, Record<string, string | undefined>> = {
  ...CATALOG,
  ...TOOLS_CATALOG,
  ...TEMPLATES_CATALOG
}

/**
 * Pure translation helper shared by the UI and the background runtime.
 * Keys are Portuguese source strings; a missing entry falls back to the source.
 */
export function translateCore(
  locale: DocsLocale,
  text: string,
  vars?: Record<string, string | number>
): string {
  if (!text) return ''
  const normalized = normalizeLocale(locale)
  const entry = DICTIONARY[text]
  let out = normalized === 'pt-BR' ? text : entry?.[normalized] || text
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      out = out.split(`{${key}}`).join(String(value))
    }
  }
  return out
}
