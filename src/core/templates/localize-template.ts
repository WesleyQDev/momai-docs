import type { TemplateManifest } from '../types.ts'
import { DOCS_LOCALES, normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

const LEGACY_CUSTOM_STYLE_GUIDE = 'Preencha os slots detectados no template personalizado preservando o estilo original.'
const CUSTOM_DESCRIPTION_PREFIXES = [
  'Template personalizado importado',
  'Imported custom template',
  'Plantilla personalizada importada',
  'Modèle personnalisé importé',
  'Importierte benutzerdefinierte Vorlage',
  'Modello personalizzato importato'
]

function canonicalText(text: string, key: string): string {
  return text === key || DOCS_LOCALES.some((locale) => translateCore(locale, key) === text) ? key : text
}

function localizeCustomSlots(template: TemplateManifest, tr: (text: string, vars?: Record<string, string | number>) => string) {
  return template.slots.map((slot) => {
    if (slot.key === 'slides') {
      return { ...slot, label: tr('Slides adicionais'), description: tr('Conteúdo estruturado dos slides') }
    }
    if (slot.key === 'paragraphs') {
      return { ...slot, label: tr('Corpo do Documento'), description: tr('Parágrafos principais baseados nas fontes') }
    }
    return {
      ...slot,
      description:
        template.toolId === 'pptx'
          ? tr('Valor para preencher o placeholder {{placeholder}} no slide', { placeholder: slot.key })
          : tr('Valor para preencher {{placeholder}}', { placeholder: slot.key })
    }
  })
}

export function localizeTemplate(template: TemplateManifest, locale?: DocsLocale): TemplateManifest {
  const resolvedLocale = normalizeLocale(locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(resolvedLocale, text, vars)
  const legacyDescription = CUSTOM_DESCRIPTION_PREFIXES
    .map((prefix) => new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((.+)\\)$`).exec(template.description))
    .find(Boolean)
  return {
    ...template,
    name: tr(template.name),
    description: legacyDescription
      ? tr('Template personalizado importado ({name})', { name: legacyDescription[1] })
      : tr(template.description),
    category: tr(template.category),
    slots: template.isCustomUserTemplate
      ? localizeCustomSlots(template, tr)
      : template.slots.map((slot) => ({
        ...slot,
        label: tr(slot.label),
        description: tr(slot.description)
      })),
    license: {
      ...template.license,
      name: tr(canonicalText(template.license.name, 'Template fornecido pelo usuário')),
      author: tr(canonicalText(template.license.author, 'Usuário'))
    },
    styleGuideForAgent:
      template.styleGuideForAgent === LEGACY_CUSTOM_STYLE_GUIDE
        ? 'Fill the detected slots in the custom template while preserving its original style.'
        : template.styleGuideForAgent
  }
}
