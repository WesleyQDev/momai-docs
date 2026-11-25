import { useCallback, useEffect, useState } from 'react'
import sdk from 'momai:sdk'

import { normalizeLocale, type DocsLocale } from '../core/i18n'
import { translateCore } from '../core/translate'

export type { DocsLocale }

export { normalizeLocale }

export function resolveLocale(raw?: string | null): DocsLocale {
  return normalizeLocale(raw)
}

/**
 * Resolve a Portuguese source string into the active locale.
 *
 * The key is the Portuguese copy itself, so a missing entry degrades to the
 * source text instead of exposing an internal key to the user.
 */
export function translate(
  locale: DocsLocale,
  text: string,
  vars?: Record<string, string | number>
): string {
  return translateCore(locale, text, vars)
}

export function createTranslator(locale: DocsLocale) {
  return (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars)
}

export type DocsTranslator = ReturnType<typeof createTranslator>

/**
 * React binding for the host locale. Keeps the component in sync when the
 * user changes the app language while the extension is open.
 */
export function useDocsI18n() {
  const [locale, setLocale] = useState<DocsLocale>(() => {
    try {
      return resolveLocale(sdk?.i18n?.getLocale?.())
    } catch {
      return 'pt-BR'
    }
  })

  useEffect(() => {
    try {
      const unsubscribe = sdk?.i18n?.onLocaleChange?.((loc: string) => setLocale(resolveLocale(loc)))
      return () => unsubscribe?.()
    } catch {
      return undefined
    }
  }, [])

  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) => translate(locale, text, vars),
    [locale]
  )

  return { locale, t }
}

/** @deprecated Use `translate` or `useDocsI18n` instead. */
export function tDocs(locale: DocsLocale, key: string): string {
  return translate(locale, key)
}
