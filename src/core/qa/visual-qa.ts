import type { DesignTokens, VisualQAIssue, VisualQAReport } from '../types.ts'
import { normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16)
    ]
  }
  const num = parseInt(clean.padEnd(6, '0').slice(0, 6), 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexToRgb(hexA))
  const l2 = relativeLuminance(hexToRgb(hexB))
  const bright = Math.max(l1, l2)
  const dark = Math.min(l1, l2)
  return (bright + 0.05) / (dark + 0.05)
}

export interface VisualPageMetric {
  index: number
  label: string
  fillRatio: number
  overflowChars: number
  collidesWithHeaderOrFooter?: boolean
  endsWithOrphanHeading?: boolean
}

export function runVisualQA(opts: {
  tokens: DesignTokens
  pages: VisualPageMetric[]
  autoRepair?: boolean
  locale?: DocsLocale
}): { report: VisualQAReport; adjustedTokens: DesignTokens } {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const issues: VisualQAIssue[] = []
  let repairsApplied = 0
  const adjustedTokens: DesignTokens = { ...opts.tokens }
  const doRepair = opts.autoRepair !== false

  // 1. Contrast check (WCAG AA >= 4.5:1)
  const textContrast = contrastRatio(adjustedTokens.textPrimary, adjustedTokens.surface)
  if (textContrast < 4.5) {
    if (doRepair) {
      const surfaceLum = relativeLuminance(hexToRgb(adjustedTokens.surface))
      adjustedTokens.textPrimary = surfaceLum > 0.5 ? '#0F172A' : '#F8FAFC'
      adjustedTokens.textMuted = surfaceLum > 0.5 ? '#475569' : '#CBD5E1'
      repairsApplied += 1
    }
    issues.push({
      code: 'contrast_violation',
      severity: 'warning',
      location: 'DesignTokens.textPrimary',
      message: tr('Contraste insuficiente ({ratio}:1 < 4.5:1).', { ratio: textContrast.toFixed(2) }),
      autoRepaired: doRepair
    })
  }

  // 2. Per-page / per-slide geometric checks
  for (const page of opts.pages) {
    if (page.overflowChars > 0) {
      issues.push({
        code: 'text_overflow',
        severity: 'error',
        location: page.label,
        message: tr('Estouro estimado de {count} caracteres em {label}.', { count: page.overflowChars, label: page.label }),
        autoRepaired: doRepair
      })
      if (doRepair) repairsApplied += 1
    }
    if (page.collidesWithHeaderOrFooter) {
      issues.push({
        code: 'letterhead_collision',
        severity: 'error',
        location: page.label,
        message: tr('Conteúdo invadiu a zona de cabeçalho/rodapé em {label}.', { label: page.label }),
        autoRepaired: doRepair
      })
      if (doRepair) repairsApplied += 1
    }
    if (opts.pages.length > 1 && page.index === opts.pages.length - 1 && page.fillRatio < 0.12) {
      issues.push({
        code: 'sparse_page',
        severity: 'warning',
        location: page.label,
        message: tr('Última página quase vazia ({percent}% ocupada).', { percent: Math.round(page.fillRatio * 100) }),
        autoRepaired: doRepair
      })
      if (doRepair) repairsApplied += 1
    }
    if (page.endsWithOrphanHeading) {
      issues.push({
        code: 'widow_orphan',
        severity: 'warning',
        location: page.label,
        message: tr('Título órfão ao final de {label}.', { label: page.label }),
        autoRepaired: doRepair
      })
      if (doRepair) repairsApplied += 1
    }
  }

  const unfixedErrors = issues.some((i) => i.severity === 'error' && !i.autoRepaired)
  return {
    report: {
      passed: !unfixedErrors,
      checkedAt: Date.now(),
      pagesOrSlidesChecked: opts.pages.length,
      issues,
      repairsApplied
    },
    adjustedTokens
  }
}
