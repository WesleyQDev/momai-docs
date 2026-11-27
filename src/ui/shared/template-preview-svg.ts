import type { DesignTokens, LayoutPreset } from '../../core/types'
import { isUntitledProject, normalizeLocale, type DocsLocale } from '../../core/i18n.ts'
import { translateCore } from '../../core/translate.ts'
import { getPreviewCopy, type PreviewCopy } from './template-preview-copy.ts'

export interface PreviewableTemplate {
  id: string
  toolId?: string
  name: string
  description?: string
  category?: string
  layoutPreset?: LayoutPreset
  designTokens?: Partial<DesignTokens>
  styleGuideForAgent?: string
}

export interface PreviewBrandKit {
  institutionName?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  headingFont?: string
  bodyFont?: string
  headerText?: string
  footerText?: string
}

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textLine(
  x: number | string,
  y: number,
  content: string,
  opts: {
    font?: string
    size?: number
    weight?: number | string
    fill?: string
    anchor?: 'start' | 'middle' | 'end'
    spacing?: number
    serif?: boolean
  } = {}
): string {
  const font = opts.font || 'Inter'
  const family = opts.serif ? `${esc(font)}, serif` : `${esc(font)}, sans-serif`
  const attrs = [`x="${x}"`, `y="${y}"`, `font-family="${family}"`, `font-size="${opts.size ?? 11}"`]
  if (opts.weight) attrs.push(`font-weight="${opts.weight}"`)
  if (opts.anchor) attrs.push(`text-anchor="${opts.anchor}"`)
  if (opts.spacing) attrs.push(`letter-spacing="${opts.spacing}"`)
  attrs.push(`fill="${opts.fill || '#111827'}"`)
  return `<text ${attrs.join(' ')}>${esc(content)}</text>`
}

function resolveTokens(tpl: PreviewableTemplate, brandKit?: PreviewBrandKit | null, isBrandMode = false): DesignTokens {
  const base: DesignTokens = {
    primary: tpl.designTokens?.primary || '#111827',
    secondary: tpl.designTokens?.secondary || '#374151',
    accent: tpl.designTokens?.accent || '#1F2937',
    surface: tpl.designTokens?.surface || '#FFFFFF',
    surfaceAlt: tpl.designTokens?.surfaceAlt || '#F8FAFC',
    textPrimary: tpl.designTokens?.textPrimary || '#111827',
    textMuted: tpl.designTokens?.textMuted || '#4B5563',
    border: tpl.designTokens?.border || '#D1D5DB',
    headingFont: tpl.designTokens?.headingFont || 'Inter',
    bodyFont: tpl.designTokens?.bodyFont || 'Inter',
    monoFont: tpl.designTokens?.monoFont || 'JetBrains Mono'
  }
  if (!isBrandMode || !brandKit) return base
  const isLegacyDefault =
    brandKit.primaryColor === '#1E3A8A' && brandKit.accentColor === '#7C3AED'
  if (isLegacyDefault) return base
  return {
    ...base,
    primary: brandKit.primaryColor || base.primary,
    secondary: brandKit.secondaryColor || base.secondary,
    accent: brandKit.accentColor || base.accent,
    headingFont: brandKit.headingFont || base.headingFont,
    bodyFont: brandKit.bodyFont || base.bodyFont
  }
}

function buildSlideCoverSvg(
  title: string,
  subtitle: string,
  tokens: DesignTokens,
  preset: LayoutPreset,
  inst: string,
  isVideo: boolean,
  copy: PreviewCopy
): string {
  const decor =
    preset === 'modern'
      ? `<rect x="680" y="0" width="280" height="540" fill="${tokens.surfaceAlt}"/><rect x="80" y="405" width="180" height="6" rx="3" fill="${tokens.accent}"/>`
      : preset === 'tech_dark'
        ? `<rect x="80" y="135" width="96" height="4" rx="2" fill="${tokens.accent}"/>`
        : preset === 'editorial' || preset === 'academic'
          ? `<rect x="80" y="70" width="800" height="1.5" fill="${tokens.primary}"/><rect x="80" y="470" width="800" height="1" fill="${tokens.border}"/>`
          : preset === 'playful' || preset === 'whiteboard'
            ? `<rect x="40" y="40" width="880" height="460" rx="18" fill="${tokens.surfaceAlt}" stroke="${tokens.accent}" stroke-width="2"/>`
            : preset === 'minimal'
              ? `<rect x="62" y="168" width="5" height="165" rx="2.5" fill="${tokens.primary}"/>`
              : `<rect x="86" y="128" width="64" height="4" rx="2" fill="${tokens.accent}"/>`

  const kicker = inst.toUpperCase() || (isVideo ? copy.slide.kickerVideo : copy.slide.kickerPresentation)
  const footerCounter = isVideo
    ? ''
    : textLine(86, 452, '01 / 03', { font: tokens.bodyFont, size: 12, fill: tokens.textMuted })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/>${decor}${textLine(
    86,
    165,
    kicker,
    { font: tokens.bodyFont, size: 13, weight: 600, spacing: 1.8, fill: tokens.accent }
  )}${textLine(86, 232, title.slice(0, 34), {
    font: tokens.headingFont,
    size: 36,
    weight: 700,
    fill: tokens.primary
  })}${textLine(86, 282, (subtitle || copy.slide.defaultSubtitle).slice(0, 64), {
    font: tokens.bodyFont,
    size: 18,
    fill: tokens.textMuted
  })}${footerCounter}</svg>`
}

function buildSlideContentSvg(tokens: DesignTokens, preset: LayoutPreset, isVideo: boolean, copy: PreviewCopy): string {
  const headerBar =
    preset === 'tech_dark'
      ? `<line x1="56" y1="88" x2="904" y2="88" stroke="${tokens.border}" stroke-width="1"/>`
      : `<rect x="0" y="0" width="960" height="84" fill="${tokens.surfaceAlt}"/><line x1="0" y1="84" x2="960" y2="84" stroke="${tokens.border}" stroke-width="1"/>`

  const bulletMarkup = copy.slide.bullets
    .map(
      (b, idx) =>
        `<circle cx="76" cy="${178 + idx * 60}" r="5" fill="${tokens.accent}"/>${textLine(
          96,
          184 + idx * 60,
          b.slice(0, 62),
          { font: tokens.bodyFont, size: 16, weight: 500, fill: tokens.textPrimary }
        )}`
    )
    .join('')

  const quarterLabels = copy.slide.quarters
    .map((q, idx) => textLine(632 + idx * 70, 438, q, { size: 12, fill: tokens.textMuted, anchor: 'middle' }))
    .join('')

  const footer = isVideo ? '' : textLine(904, 514, '02 / 03', { size: 12, fill: tokens.textMuted, anchor: 'end' })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/>${headerBar}${textLine(
    56,
    54,
    copy.slide.contentTitle,
    { font: tokens.headingFont, size: 23, weight: 700, fill: tokens.primary }
  )}${bulletMarkup}<rect x="562" y="128" width="342" height="334" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="1"/>${textLine(
    588,
    168,
    copy.slide.chartTitle,
    { font: tokens.headingFont, size: 15, weight: 700, fill: tokens.primary }
  )}<rect x="610" y="330" width="44" height="85" rx="4" fill="${tokens.primary}" opacity="0.45"/><rect x="680" y="275" width="44" height="140" rx="4" fill="${tokens.primary}" opacity="0.7"/><rect x="750" y="210" width="44" height="205" rx="4" fill="${tokens.accent}"/>${quarterLabels}${footer}</svg>`
}

function buildSlideMetricsSvg(tokens: DesignTokens, isVideo: boolean, copy: PreviewCopy): string {
  const [metric1, metric2, metric3] = copy.slide.metrics
  const footer = isVideo ? '' : textLine(904, 514, '03 / 03', { size: 12, fill: tokens.textMuted, anchor: 'end' })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/><rect width="960" height="82" fill="${tokens.surfaceAlt}"/>${textLine(
    56,
    52,
    copy.slide.metricsTitle,
    { font: tokens.headingFont, size: 23, weight: 700, fill: tokens.primary }
  )}<rect x="56" y="128" width="264" height="146" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="1"/>${textLine(
    82,
    196,
    '+42%',
    { font: tokens.headingFont, size: 36, weight: 700, fill: tokens.accent }
  )}${textLine(82, 234, metric1, { font: tokens.bodyFont, size: 14, fill: tokens.textMuted })}<rect x="348" y="128" width="264" height="146" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="1"/>${textLine(
    374,
    196,
    '98,4%',
    { font: tokens.headingFont, size: 36, weight: 700, fill: tokens.primary }
  )}${textLine(374, 234, metric2, { font: tokens.bodyFont, size: 14, fill: tokens.textMuted })}<rect x="640" y="128" width="264" height="146" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="1"/>${textLine(
    666,
    196,
    '12x',
    { font: tokens.headingFont, size: 36, weight: 700, fill: tokens.textPrimary }
  )}${textLine(666, 234, metric3, { font: tokens.bodyFont, size: 14, fill: tokens.textMuted })}<line x1="56" y1="322" x2="904" y2="322" stroke="${tokens.border}" stroke-width="1"/>${textLine(
    56,
    366,
    copy.slide.summaryTitle,
    { font: tokens.headingFont, size: 17, weight: 600, fill: tokens.primary }
  )}${textLine(56, 398, copy.slide.summary[0].slice(0, 82), {
    font: tokens.bodyFont,
    size: 15,
    fill: tokens.textPrimary
  })}${textLine(56, 424, copy.slide.summary[1].slice(0, 82), {
    font: tokens.bodyFont,
    size: 15,
    fill: tokens.textPrimary
  })}${footer}</svg>`
}

function buildOficioPages(
  tpl: PreviewableTemplate,
  tokens: DesignTokens,
  inst: string,
  copy: PreviewCopy
): Array<{ label: string; svg: string }> {
  const font = tokens.bodyFont || 'Liberation Sans'
  const isCorp = tpl.id === 'oficio-corporativo'
  const topBar = ''
  const titleColor = isCorp ? tokens.primary : '#111827'

  const page1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${topBar}
    ${inst ? textLine(297.5, 72, inst.toUpperCase(), { font, size: 11, weight: 700, fill: titleColor, anchor: 'middle' }) : ''}
    ${textLine(72, 112, copy.oficio.number, { font, size: 11.5, weight: 700, fill: titleColor })}
    ${textLine(535, 138, copy.oficio.date, { font, size: 11, fill: '#111827', anchor: 'end' })}
    ${textLine(72, 176, copy.oficio.recipientIntro, { font, size: 11, fill: '#111827' })}
    ${textLine(72, 193, copy.oficio.recipientTitle, { font, size: 11, weight: 700, fill: '#111827' })}
    ${textLine(72, 210, copy.oficio.address1, { font, size: 11, fill: '#111827' })}
    ${textLine(72, 227, copy.oficio.address2, { font, size: 11, fill: '#111827' })}
    ${textLine(72, 266, copy.oficio.subject, { font, size: 11, weight: 700, fill: '#111827' })}
    ${textLine(132, 308, copy.oficio.salutation, { font, size: 11, fill: '#111827' })}
    ${textLine(132, 340, copy.oficio.paragraph1[0], { font, size: 11, fill: '#111827' })}
    ${textLine(72, 358, copy.oficio.paragraph1[1], { font, size: 11, fill: '#111827' })}
    ${textLine(72, 376, copy.oficio.paragraph1[2], { font, size: 11, fill: '#111827' })}
    ${textLine(132, 408, copy.oficio.paragraph2[0], { font, size: 11, fill: '#111827' })}
    ${textLine(72, 426, copy.oficio.paragraph2[1], { font, size: 11, fill: '#111827' })}
    ${textLine(132, 466, copy.oficio.closing, { font, size: 11, fill: '#111827' })}
    ${textLine(297.5, 546, copy.oficio.signer, { font, size: 11, weight: 700, fill: '#111827', anchor: 'middle' })}
    ${textLine(297.5, 563, copy.oficio.signerRole, { font, size: 10.5, fill: '#374151', anchor: 'middle' })}
  </svg>`

  const rows = copy.oficio.annexRows
    .map((row, idx) => {
      const y = 164 + idx * 28
      return `${textLine(72, y, row.stage, { font, size: 10.5, fill: '#111827' })}${textLine(310, y, row.unit, {
        font,
        size: 10.5,
        fill: '#374151'
      })}${textLine(470, y, row.deadline, { font, size: 10.5, fill: '#111827' })}`
    })
    .join('')

  const page2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${topBar}
    ${textLine(72, 88, copy.oficio.annexTitle, { font, size: 11, weight: 700, fill: '#111827' })}
    <line x1="72" y1="108" x2="535" y2="108" stroke="#111827" stroke-width="1"/>
    ${textLine(72, 130, copy.oficio.annexColumns[0], { font, size: 10.5, weight: 700, fill: '#111827' })}
    ${textLine(310, 130, copy.oficio.annexColumns[1], { font, size: 10.5, weight: 700, fill: '#111827' })}
    ${textLine(470, 130, copy.oficio.annexColumns[2], { font, size: 10.5, weight: 700, fill: '#111827' })}
    <line x1="72" y1="140" x2="535" y2="140" stroke="#9CA3AF" stroke-width="0.8"/>
    ${rows}
    <line x1="72" y1="234" x2="535" y2="234" stroke="#111827" stroke-width="1"/>
    ${textLine(535, 792, copy.oficio.pageOfPages, { font, size: 10, fill: '#4B5563', anchor: 'end' })}
  </svg>`

  const makeOficioExtraPage = (num: number, heading: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(72, 64, copy.oficio.number, { font, size: 10, fill: '#4B5563' })}
    ${textLine(72, 108, `${num}. ${heading}`, { font, size: 12, weight: 700, fill: '#111827' })}
    ${textLine(72, 140, copy.oficio.paragraph1[0], { font, size: 11, fill: '#111827' })}
    ${textLine(72, 160, copy.oficio.paragraph1[1], { font, size: 11, fill: '#111827' })}
    ${textLine(72, 196, copy.oficio.paragraph2[0], { font, size: 11, fill: '#111827' })}
    ${textLine(72, 216, copy.oficio.paragraph2[1], { font, size: 11, fill: '#111827' })}
    ${textLine(535, 792, `${num} / 5`, { font, size: 10, fill: '#4B5563', anchor: 'end' })}
  </svg>`

  return [
    { label: `${copy.oficio.page1} (1/5)`, svg: page1 },
    { label: `${copy.oficio.page2} (2/5)`, svg: page2 },
    { label: `${copy.oficio.page2} (3/5)`, svg: makeOficioExtraPage(3, copy.oficio.subject) },
    { label: `${copy.oficio.page2} (4/5)`, svg: makeOficioExtraPage(4, copy.oficio.annexTitle) },
    { label: `${copy.oficio.page2} (5/5)`, svg: makeOficioExtraPage(5, copy.oficio.closing) }
  ]
}

function buildAbntPages(
  tpl: PreviewableTemplate,
  tokens: DesignTokens,
  inst: string,
  copy: PreviewCopy
): Array<{ label: string; svg: string }> {
  const font = tokens.bodyFont || 'Liberation Serif'
  const page1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(297.5, 88, (inst || copy.abnt.institution).toUpperCase(), {
      font,
      size: 11.5,
      weight: 700,
      fill: '#111827',
      anchor: 'middle',
      serif: true
    })}
    ${textLine(297.5, 138, copy.abnt.author, { font, size: 11.5, fill: '#111827', anchor: 'middle', serif: true })}
    ${textLine(297.5, 340, tpl.name.toUpperCase().slice(0, 42), {
      font,
      size: 13.5,
      weight: 700,
      fill: '#111827',
      anchor: 'middle',
      serif: true
    })}
    ${textLine(297.5, 362, copy.abnt.subtitle, { font, size: 11.5, fill: '#374151', anchor: 'middle', serif: true })}
    ${textLine(295, 490, copy.abnt.nature[0], { font, size: 10, fill: '#111827', serif: true })}
    ${textLine(295, 505, copy.abnt.nature[1], { font, size: 10, fill: '#111827', serif: true })}
    ${textLine(295, 520, copy.abnt.nature[2], { font, size: 10, fill: '#111827', serif: true })}
    ${textLine(297.5, 756, copy.abnt.city, { font, size: 11, fill: '#111827', anchor: 'middle', serif: true })}
    ${textLine(297.5, 774, copy.abnt.year, { font, size: 11, fill: '#111827', anchor: 'middle', serif: true })}
  </svg>`

  const page2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(535, 64, '2', { font, size: 10, fill: '#4B5563', anchor: 'end', serif: true })}
    ${textLine(297.5, 102, copy.abnt.abstractTitle, { font, size: 12, weight: 700, fill: '#111827', anchor: 'middle', serif: true })}
    ${textLine(72, 136, copy.abnt.abstract[0], { font, size: 10.5, fill: '#111827', serif: true })}
    ${textLine(72, 154, copy.abnt.abstract[1], { font, size: 10.5, fill: '#111827', serif: true })}
    ${textLine(72, 172, copy.abnt.abstract[2], { font, size: 10.5, fill: '#111827', serif: true })}
    ${textLine(72, 202, copy.abnt.keywordsLabel, { font, size: 10.5, weight: 700, fill: '#111827', serif: true })}
    ${textLine(164, 202, copy.abnt.keywords, { font, size: 10.5, fill: '#111827', serif: true })}
    ${textLine(72, 256, copy.abnt.sectionTitle, { font, size: 12, weight: 700, fill: '#111827', serif: true })}
    ${textLine(108, 286, copy.abnt.section[0], { font, size: 11, fill: '#111827', serif: true })}
    ${textLine(72, 306, copy.abnt.section[1], { font, size: 11, fill: '#111827', serif: true })}
    ${textLine(72, 326, copy.abnt.section[2], { font, size: 11, fill: '#111827', serif: true })}
    ${textLine(180, 372, copy.abnt.quote[0], { font, size: 9.5, fill: '#111827', serif: true })}
    ${textLine(180, 387, copy.abnt.quote[1], { font, size: 9.5, fill: '#111827', serif: true })}
    ${textLine(72, 438, copy.abnt.referencesTitle, { font, size: 12, weight: 700, fill: '#111827', serif: true })}
    ${textLine(72, 466, copy.abnt.reference, { font, size: 10, fill: '#111827', serif: true })}
  </svg>`

  const makeAbntExtraPage = (num: number, titleText: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(535, 64, String(num), { font, size: 10, fill: '#4B5563', anchor: 'end', serif: true })}
    ${textLine(72, 102, titleText, { font, size: 12, weight: 700, fill: '#111827', serif: true })}
    ${textLine(108, 136, copy.abnt.section[0], { font, size: 11, fill: '#111827', serif: true })}
    ${textLine(72, 156, copy.abnt.section[1], { font, size: 11, fill: '#111827', serif: true })}
    ${textLine(72, 176, copy.abnt.section[2], { font, size: 11, fill: '#111827', serif: true })}
    ${textLine(180, 224, copy.abnt.quote[0], { font, size: 9.5, fill: '#111827', serif: true })}
    ${textLine(180, 240, copy.abnt.quote[1], { font, size: 9.5, fill: '#111827', serif: true })}
  </svg>`

  return [
    { label: `${copy.abnt.page1} (1/5)`, svg: page1 },
    { label: `${copy.abnt.page2} (2/5)`, svg: page2 },
    { label: `${copy.abnt.sectionTitle} (3/5)`, svg: makeAbntExtraPage(3, copy.abnt.sectionTitle) },
    { label: `${copy.abnt.sectionTitle} (4/5)`, svg: makeAbntExtraPage(4, copy.abnt.abstractTitle) },
    { label: `${copy.abnt.referencesTitle} (5/5)`, svg: makeAbntExtraPage(5, copy.abnt.referencesTitle) }
  ]
}

function buildResumePages(tokens: DesignTokens, copy: PreviewCopy): Array<{ label: string; svg: string }> {
  const font = tokens.bodyFont || 'Inter'
  const page1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(56, 78, copy.resume.name, { font, size: 22, weight: 700, fill: '#111827' })}
    ${textLine(56, 100, copy.resume.role, { font, size: 12, weight: 600, fill: '#374151' })}
    ${textLine(56, 118, copy.resume.contact, { font, size: 10, fill: '#4B5563' })}
    <line x1="56" y1="134" x2="539" y2="134" stroke="#111827" stroke-width="1.2"/>
    ${textLine(56, 160, copy.resume.summaryTitle, { font, size: 11.5, weight: 700, fill: '#111827' })}
    ${textLine(56, 182, copy.resume.summary[0], { font, size: 10.5, fill: '#1F2937' })}
    ${textLine(56, 198, copy.resume.summary[1], { font, size: 10.5, fill: '#1F2937' })}
    ${textLine(56, 236, copy.resume.experienceTitle, { font, size: 11.5, weight: 700, fill: '#111827' })}
    <line x1="56" y1="244" x2="539" y2="244" stroke="#D1D5DB" stroke-width="0.8"/>
    ${textLine(56, 266, copy.resume.jobTitle, { font, size: 11, weight: 700, fill: '#111827' })}
    ${textLine(539, 266, copy.resume.jobPeriod, { font, size: 10, fill: '#4B5563', anchor: 'end' })}
    ${textLine(66, 286, copy.resume.jobBullets[0], { font, size: 10.5, fill: '#1F2937' })}
    ${textLine(66, 304, copy.resume.jobBullets[1], { font, size: 10.5, fill: '#1F2937' })}
    ${textLine(56, 344, copy.resume.skillsTitle, { font, size: 11.5, weight: 700, fill: '#111827' })}
    <line x1="56" y1="352" x2="539" y2="352" stroke="#D1D5DB" stroke-width="0.8"/>
    ${textLine(56, 374, copy.resume.skills, { font, size: 10.5, fill: '#1F2937' })}
  </svg>`
  const page2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(48, 86, copy.resume.skillsTitle.toUpperCase(), { font: tokens.headingFont, size: 12, weight: 700, spacing: 1.4, fill: tokens.accent })}
    <line x1="48" y1="98" x2="545" y2="98" stroke="${tokens.border}" stroke-width="1"/>
    <rect x="48" y="122" width="497" height="76" rx="6" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="0.8"/>
    ${textLine(66, 152, copy.resume.jobTitle, { font: tokens.headingFont, size: 13, weight: 700, fill: tokens.primary })}
    ${textLine(66, 174, copy.resume.skills, { font: tokens.bodyFont, size: 11, fill: tokens.textPrimary })}
    ${textLine(48, 240, copy.report.section2Title, { font: tokens.headingFont, size: 12, weight: 700, fill: tokens.primary })}
    ${textLine(48, 266, copy.report.table.rows.map((r) => `${r[0]}: ${r[2]}`).join('   |   ').slice(0, 74), { font: tokens.bodyFont, size: 10.5, fill: tokens.textMuted })}
    <line x1="48" y1="760" x2="545" y2="760" stroke="${tokens.border}" stroke-width="0.8"/>
    ${textLine(545, 784, '2 / 2', { font: tokens.bodyFont, size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`
  const makeResumeExtra = (num: number, sectionTitle: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(48, 86, sectionTitle.toUpperCase(), { font: tokens.headingFont, size: 12, weight: 700, spacing: 1.4, fill: tokens.accent })}
    <line x1="48" y1="98" x2="545" y2="98" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(48, 134, copy.resume.jobTitle, { font: tokens.headingFont, size: 12, weight: 700, fill: tokens.primary })}
    ${textLine(48, 158, copy.resume.jobBullets[0], { font: tokens.bodyFont, size: 10.5, fill: tokens.textPrimary })}
    ${textLine(48, 178, copy.resume.jobBullets[1], { font: tokens.bodyFont, size: 10.5, fill: tokens.textPrimary })}
    ${textLine(545, 784, `${num} / 5`, { font: tokens.bodyFont, size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  return [
    { label: `${copy.resume.page} (1/5)`, svg: page1 },
    { label: `${copy.resume.page} (2/5)`, svg: page2 },
    { label: `${copy.resume.experienceTitle} (3/5)`, svg: makeResumeExtra(3, copy.resume.experienceTitle) },
    { label: `${copy.resume.skillsTitle} (4/5)`, svg: makeResumeExtra(4, copy.resume.skillsTitle) },
    { label: `${copy.resume.summaryTitle} (5/5)`, svg: makeResumeExtra(5, copy.resume.summaryTitle) }
  ]
}

function buildApostilaPages(
  tpl: PreviewableTemplate,
  tokens: DesignTokens,
  preset: LayoutPreset,
  inst: string,
  copy: PreviewCopy,
  locale: DocsLocale
): Array<{ label: string; svg: string }> {
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const page1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    <rect x="268" y="68" width="58" height="58" rx="12" fill="${tokens.primary}"/>
    ${textLine(297, 104, 'MD', { font: tokens.headingFont, size: 18, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}
    ${textLine(297, 152, (inst || copy.report.kickerApostila).toUpperCase().slice(0, 40), { font: tokens.bodyFont, size: 10, weight: 700, spacing: 1.4, fill: tokens.accent, anchor: 'middle' })}
    ${textLine(297, 206, tpl.name.slice(0, 34), { font: tokens.headingFont, size: 24, weight: 800, fill: tokens.primary, anchor: 'middle' })}
    <rect x="262" y="226" width="70" height="3.5" rx="1.5" fill="${tokens.accent}"/>
    ${textLine(297, 254, (tpl.description || '').slice(0, 62), { font: tokens.bodyFont, size: 11, fill: tokens.textMuted, anchor: 'middle' })}
    <rect x="52" y="346" width="491" height="122" rx="8" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="0.9"/>
    ${textLine(70, 372, tr('Nesta edição').toUpperCase(), { font: tokens.bodyFont, size: 9, weight: 700, spacing: 1, fill: tokens.accent })}
    <rect x="70" y="390" width="24" height="18" rx="3" fill="${tokens.primary}"/>${textLine(82, 403, '01', { size: 9, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}${textLine(102, 403, copy.report.section1Title.slice(0, 22), { size: 10.5, weight: 600, fill: tokens.textPrimary })}
    <rect x="304" y="390" width="24" height="18" rx="3" fill="${tokens.primary}"/>${textLine(316, 403, '02', { size: 9, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}${textLine(336, 403, copy.report.section2Title.slice(0, 22), { size: 10.5, weight: 600, fill: tokens.textPrimary })}
    <rect x="70" y="424" width="24" height="18" rx="3" fill="${tokens.primary}"/>${textLine(82, 437, '03', { size: 9, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}${textLine(102, 437, tr('Exercícios de Fixação').slice(0, 22), { size: 10.5, weight: 600, fill: tokens.textPrimary })}
    <rect x="304" y="424" width="24" height="18" rx="3" fill="${tokens.primary}"/>${textLine(316, 437, '✓', { size: 9, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}${textLine(336, 437, tr('Gabarito Comentado').slice(0, 22), { size: 10.5, weight: 600, fill: tokens.textPrimary })}
    <line x1="52" y1="670" x2="543" y2="670" stroke="${tokens.accent}" stroke-width="2"/>
    ${textLine(52, 694, tr('Apresentação').toUpperCase(), { size: 10, weight: 700, fill: tokens.primary })}
    ${textLine(52, 718, copy.report.summary[0], { size: 10.5, fill: tokens.textMuted })}
    ${textLine(52, 736, copy.report.summary[1], { size: 10.5, fill: tokens.textMuted })}
  </svg>`

  const tocItems = [
    ['01', copy.report.section1Title, '03'],
    ['02', copy.report.section2Title, '04'],
    ['✓', tr('Gabarito Comentado'), '04'],
    ['+', tr('Glossário'), '05'],
    ['+', tr('Referências'), '05']
  ]
  const page2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(56, 86, tr('Sumário'), { font: tokens.headingFont, size: 22, weight: 800, fill: tokens.primary })}
    <rect x="56" y="102" width="52" height="3.5" rx="1.5" fill="${tokens.accent}"/>
    ${tocItems
      .map(([badge, label, pg], idx) => {
        const y = 152 + idx * 46
        return `<rect x="56" y="${y - 18}" width="26" height="20" rx="4" fill="${tokens.primary}"/>${textLine(69, y - 4, badge, { size: 9.5, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}${textLine(94, y - 4, label, { size: 11.5, weight: 600, fill: tokens.textPrimary })}<line x1="94" y1="${y + 12}" x2="539" y2="${y + 12}" stroke="${tokens.border}" stroke-width="0.6" stroke-dasharray="2 3"/>${textLine(539, y - 4, pg, { size: 11, weight: 700, fill: tokens.accent, anchor: 'end' })}`
      })
      .join('')}
    ${textLine(539, 784, tr('Pág. {current}/{total}', { current: 2, total: 4 }), { size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  const page3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    <rect x="52" y="56" width="491" height="72" rx="6" fill="${tokens.primary}"/>
    <rect x="52" y="56" width="6" height="72" rx="2" fill="${tokens.accent}"/>
    ${textLine(72, 82, `${tr('MÓDULO')} 01`, { size: 9, weight: 700, spacing: 1, fill: '#E2E8F0' })}
    ${textLine(72, 110, copy.report.section1Title, { font: tokens.headingFont, size: 17, weight: 800, fill: '#FFFFFF' })}
    <line x1="52" y1="152" x2="543" y2="152" stroke="${tokens.primary}" stroke-width="1.2"/>
    ${textLine(52, 174, tr('Objetivos:').replace(':', '').toUpperCase(), { size: 9.5, weight: 800, fill: tokens.primary })}
    ${textLine(66, 196, `• ${copy.slide.bullets[0]}`, { size: 10.5, fill: tokens.textPrimary })}
    ${textLine(66, 214, `• ${copy.slide.bullets[1]}`, { size: 10.5, fill: tokens.textPrimary })}
    <line x1="52" y1="230" x2="543" y2="230" stroke="${tokens.border}" stroke-width="0.8"/>
    ${textLine(52, 264, copy.report.section1[0], { size: 11, fill: tokens.textPrimary })}
    ${textLine(52, 284, copy.report.section1[1], { size: 11, fill: tokens.textPrimary })}
    <rect x="52" y="310" width="491" height="66" fill="${tokens.surfaceAlt}"/><rect x="52" y="310" width="4" height="66" fill="${tokens.accent}"/>
    ${textLine(68, 332, tr('Exemplo:').replace(':', '').toUpperCase(), { size: 8.5, weight: 800, fill: tokens.accent })}
    ${textLine(68, 354, copy.report.section1[2], { size: 10.5, fill: tokens.textPrimary })}
    <rect x="52" y="404" width="491" height="168" rx="8" fill="#FFFFFF" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(72, 430, copy.slide.chartTitle, { font: tokens.headingFont, size: 12, weight: 700, fill: tokens.primary })}
    <rect x="190" y="452" width="280" height="18" rx="4" fill="${tokens.primary}"/>${textLine(480, 466, '85%', { size: 10.5, weight: 700, fill: tokens.primary })}
    <rect x="190" y="486" width="210" height="18" rx="4" fill="${tokens.accent}"/>${textLine(410, 500, '64%', { size: 10.5, weight: 700, fill: tokens.accent })}
    <rect x="190" y="520" width="150" height="18" rx="4" fill="${tokens.accent}" opacity="0.75"/>${textLine(350, 534, '45%', { size: 10.5, weight: 700, fill: tokens.accent })}
    ${textLine(539, 784, tr('Pág. {current}/{total}', { current: 3, total: 4 }), { size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  const page4 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(52, 76, tr('Exercícios de Fixação'), { font: tokens.headingFont, size: 16, weight: 800, fill: tokens.primary })}
    <rect x="52" y="102" width="24" height="20" rx="4" fill="${tokens.primary}"/>${textLine(64, 116, '01', { size: 9.5, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}
    ${textLine(86, 116, copy.flashcards.question[0], { size: 11, weight: 700, fill: tokens.textPrimary })}
    ${['A)', 'B)', 'C)', 'D)'].map((opt, idx) => `<rect x="86" y="${132 + idx * 30}" width="457" height="24" rx="4" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="0.6"/>${textLine(98, 148 + idx * 30, `${opt} ${copy.slide.bullets[idx].slice(0, 48)}`, { size: 10, fill: tokens.textPrimary })}`).join('')}
    <line x1="52" y1="286" x2="543" y2="286" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(52, 322, tr('Gabarito Comentado'), { font: tokens.headingFont, size: 15, weight: 800, fill: tokens.primary })}
    <rect x="52" y="344" width="491" height="72" fill="${tokens.surfaceAlt}"/><rect x="52" y="344" width="3" height="72" fill="${tokens.accent}"/>
    ${textLine(68, 368, `${tr('Gabarito:').replace(':', '').toUpperCase()} 01`, { size: 8.5, weight: 800, fill: tokens.accent })}
    ${textLine(68, 390, copy.flashcards.answerLines[0], { size: 10.5, fill: tokens.textMuted })}
    ${textLine(539, 784, tr('Pág. {current}/{total}', { current: 4, total: 4 }), { size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  const page5 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(56, 78, tr('Glossário & Referências'), { size: 18, weight: 700, fill: tokens.primary })}
    <line x1="56" y1="92" x2="539" y2="92" stroke="${tokens.border}" stroke-width="1"/>
    ${textLine(56, 130, copy.report.section1[0], { size: 11, fill: tokens.textPrimary })}
    ${textLine(56, 152, copy.report.section1[1], { size: 11, fill: tokens.textPrimary })}
    ${textLine(56, 194, copy.abnt.referencesTitle, { size: 13, weight: 700, fill: tokens.primary })}
    ${textLine(56, 222, copy.abnt.reference, { size: 10.5, fill: tokens.textMuted })}
    ${textLine(539, 784, tr('Pág. {current}/{total}', { current: 5, total: 5 }), { size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  return [
    { label: copy.report.coverLabel, svg: page1 },
    { label: tr('Sumário'), svg: page2 },
    { label: `${tr('MÓDULO')} 01`, svg: page3 },
    { label: tr('Exercícios de Fixação'), svg: page4 },
    { label: tr('Glossário & Referências'), svg: page5 }
  ]
}

function buildReportOrEditorialPages(
  toolId: string,
  tpl: PreviewableTemplate,
  tokens: DesignTokens,
  preset: LayoutPreset,
  inst: string,
  copy: PreviewCopy
): Array<{ label: string; svg: string }> {
  const topDecorPage1 =
    preset === 'executive' || preset === 'modern'
      ? `<rect x="56" y="88" width="56" height="3" fill="${tokens.accent}"/>`
      : ''
  const topDecorPage2 = ''

  const kicker =
    inst ||
    (toolId === 'apostila'
      ? copy.report.kickerApostila
      : toolId === 'contract'
        ? copy.report.kickerContract
        : copy.report.kickerDefault)

  const page1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${topDecorPage1}
    ${textLine(56, 122, kicker.toUpperCase(), {
      font: tokens.bodyFont,
      size: 10.5,
      weight: 600,
      spacing: 1.4,
      fill: tokens.accent
    })}
    ${textLine(56, 160, tpl.name.slice(0, 38), { font: tokens.headingFont, size: 22, weight: 700, fill: tokens.primary })}
    ${textLine(56, 186, (tpl.description || '').slice(0, 68), {
      font: tokens.bodyFont,
      size: 11.5,
      fill: tokens.textMuted
    })}
    <line x1="56" y1="210" x2="539" y2="210" stroke="${tokens.border}" stroke-width="1"/>
    <rect x="56" y="232" width="3" height="58" fill="${tokens.accent}"/>
    ${textLine(72, 250, copy.report.summaryTitle, { font: tokens.headingFont, size: 11.5, weight: 700, fill: tokens.primary })}
    ${textLine(72, 270, copy.report.summary[0], { font: tokens.bodyFont, size: 10.5, fill: tokens.textPrimary })}
    ${textLine(72, 286, copy.report.summary[1], { font: tokens.bodyFont, size: 10.5, fill: tokens.textPrimary })}
    ${textLine(56, 330, copy.report.section1Title, { font: tokens.headingFont, size: 13.5, weight: 700, fill: tokens.primary })}
    ${textLine(56, 358, copy.report.section1[0], { font: tokens.bodyFont, size: 11, fill: tokens.textPrimary })}
    ${textLine(56, 376, copy.report.section1[1], { font: tokens.bodyFont, size: 11, fill: tokens.textPrimary })}
    ${textLine(56, 408, copy.report.section1[2], { font: tokens.bodyFont, size: 11, fill: tokens.textPrimary })}
    <line x1="56" y1="760" x2="539" y2="760" stroke="${tokens.border}" stroke-width="0.8"/>
    ${textLine(539, 784, copy.report.page1, { font: tokens.bodyFont, size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  const tableRows = copy.report.table.rows
    .map((row, idx) => {
      const y = 200 + idx * 28
      return `${textLine(64, y, row[0], { font: tokens.bodyFont, size: 10.5, fill: tokens.textPrimary })}${textLine(
        290,
        y,
        row[1],
        { font: tokens.bodyFont, size: 10.5, fill: tokens.textMuted }
      )}${textLine(440, y, row[2], { font: tokens.bodyFont, size: 10.5, weight: 700, fill: tokens.primary })}`
    })
    .join('')

  const page2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${topDecorPage2}
    ${textLine(56, 88, copy.report.section2Title, { font: tokens.headingFont, size: 15, weight: 700, fill: tokens.primary })}
    ${textLine(56, 114, copy.report.section2Intro, { font: tokens.bodyFont, size: 11, fill: tokens.textPrimary })}
    <line x1="56" y1="142" x2="539" y2="142" stroke="${tokens.primary}" stroke-width="1.2"/>
    ${textLine(64, 164, copy.report.table.indicator, { font: tokens.headingFont, size: 10.5, weight: 700, fill: tokens.primary })}
    ${textLine(290, 164, copy.report.table.current, { font: tokens.headingFont, size: 10.5, weight: 700, fill: tokens.primary })}
    ${textLine(440, 164, copy.report.table.target, { font: tokens.headingFont, size: 10.5, weight: 700, fill: tokens.primary })}
    <line x1="56" y1="176" x2="539" y2="176" stroke="${tokens.border}" stroke-width="0.8"/>
    ${tableRows}
    <line x1="56" y1="272" x2="539" y2="272" stroke="${tokens.border}" stroke-width="1"/>
    <line x1="56" y1="760" x2="539" y2="760" stroke="${tokens.border}" stroke-width="0.8"/>
    ${textLine(539, 784, copy.report.page2, { font: tokens.bodyFont, size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  const page3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${topDecorPage2}
    ${textLine(56, 88, copy.slide.metricsTitle, { font: tokens.headingFont, size: 15, weight: 700, fill: tokens.primary })}
    ${copy.slide.metrics
      .map(
        (m, idx) =>
          `<rect x="${56 + idx * 165}" y="114" width="152" height="76" rx="6" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="0.8"/><rect x="${56 + idx * 165}" y="114" width="152" height="4" fill="${tokens.accent}"/>${textLine(68 + idx * 165, 140, m.slice(0, 18), { size: 9, weight: 700, fill: tokens.textMuted })}${textLine(68 + idx * 165, 170, ['+28%', '99%', '2.4x'][idx], { font: tokens.headingFont, size: 20, weight: 800, fill: tokens.primary })}`
      )
      .join('')}
    ${textLine(56, 232, copy.slide.chartTitle, { font: tokens.headingFont, size: 13.5, weight: 700, fill: tokens.primary })}
    ${copy.slide.bullets
      .slice(0, 3)
      .map(
        (b, idx) =>
          `<circle cx="68" cy="${266 + idx * 42}" r="10" fill="${tokens.accent}"/>${textLine(68, 270 + idx * 42, String(idx + 1), { size: 9.5, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}${textLine(90, 270 + idx * 42, b.slice(0, 58), { size: 10.5, fill: tokens.textPrimary })}`
      )
      .join('')}
    <line x1="56" y1="760" x2="539" y2="760" stroke="${tokens.border}" stroke-width="0.8"/>
    ${textLine(539, 784, '3 / 3', { font: tokens.bodyFont, size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  const makeReportExtra = (num: number, headingText: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" preserveAspectRatio="xMidYMid meet">
    <rect width="595" height="842" fill="${tokens.surface}" stroke="${tokens.border}" stroke-width="1"/>
    ${topDecorPage2}
    ${textLine(56, 68, tpl.name.toUpperCase(), { font: tokens.bodyFont, size: 9, weight: 700, spacing: 1.5, fill: tokens.accent })}
    ${textLine(56, 108, headingText, { font: tokens.headingFont, size: 17, weight: 700, fill: tokens.primary })}
    ${textLine(56, 144, copy.report.section1[0], { font: tokens.bodyFont, size: 11, fill: tokens.textPrimary })}
    ${textLine(56, 166, copy.report.section1[1], { font: tokens.bodyFont, size: 11, fill: tokens.textPrimary })}
    ${textLine(539, 784, `${num} / 5`, { font: tokens.bodyFont, size: 10, fill: tokens.textMuted, anchor: 'end' })}
  </svg>`

  return [
    { label: `${copy.report.coverLabel} (1/5)`, svg: page1 },
    { label: `${copy.report.bodyLabel} (2/5)`, svg: page2 },
    { label: `${copy.slide.metricsLabel} (3/5)`, svg: page3 },
    { label: `${copy.report.section1Title} (4/5)`, svg: makeReportExtra(4, copy.report.section2Title) },
    { label: `${copy.report.summaryTitle} (5/5)`, svg: makeReportExtra(5, copy.report.summaryTitle) }
  ]
}

function buildXlsxPreviewSvg(tplName: string, tokens: DesignTokens, copy: PreviewCopy, locale: DocsLocale): string {
  const rows = [copy.xlsx.headers, ...copy.xlsx.rows]
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const percentFormat = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const totalRevenue = numberFormat.format(1_005_000)
  const totalCost = numberFormat.format(667_000)
  const totalMargin = percentFormat.format(0.336)
  const rowSvg = rows
    .map((row, idx) => {
      const y = 148 + idx * 46
      const isHeader = idx === 0
      const fill = isHeader ? tokens.primary : idx % 2 === 0 ? tokens.surfaceAlt : tokens.surface
      const textFill = isHeader ? tokens.primary : tokens.textPrimary
      return `<rect x="48" y="${y - 28}" width="864" height="44" fill="${fill}" opacity="${isHeader ? 0.12 : 1}"/><line x1="48" y1="${y + 16}" x2="912" y2="${y + 16}" stroke="${tokens.border}" stroke-width="1"/>${textLine(
        68,
        y,
        row[0],
        { font: tokens.bodyFont, size: 14, weight: isHeader ? 700 : 500, fill: textFill }
      )}${textLine(440, y, row[1], {
        font: tokens.monoFont,
        size: 14,
        weight: isHeader ? 700 : 400,
        fill: textFill
      })}${textLine(640, y, row[2], {
        font: tokens.monoFont,
        size: 14,
        weight: isHeader ? 700 : 400,
        fill: isHeader ? tokens.primary : tokens.textMuted
      })}${textLine(820, y, row[3], {
        font: tokens.monoFont,
        size: 14,
        weight: 700,
        fill: isHeader ? tokens.primary : tokens.accent
      })}`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/><rect width="960" height="76" fill="${tokens.surfaceAlt}"/>${textLine(
    48,
    48,
    tplName,
    { font: tokens.headingFont, size: 21, weight: 700, fill: tokens.primary }
  )}${textLine(912, 48, copy.xlsx.sumFormula, {
    font: tokens.monoFont,
    size: 13,
    fill: tokens.accent,
    anchor: 'end'
  })}${rowSvg}<rect x="48" y="346" width="864" height="48" fill="${tokens.primary}" opacity="0.08"/>${textLine(
    68,
    376,
    copy.xlsx.totalLabel,
    { font: tokens.headingFont, size: 14, weight: 700, fill: tokens.primary }
  )}${textLine(440, 376, totalRevenue, { font: tokens.monoFont, size: 14, weight: 700, fill: tokens.primary })}${textLine(
    640,
    376,
    totalCost,
    { font: tokens.monoFont, size: 14, weight: 700, fill: tokens.textPrimary }
  )}${textLine(820, 376, totalMargin, { font: tokens.monoFont, size: 14, weight: 700, fill: tokens.accent })}</svg>`
}

function buildPodcastPreviewSvg(tplName: string, tokens: DesignTokens, copy: PreviewCopy): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/><rect x="48" y="44" width="864" height="108" rx="12" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="1"/>${textLine(
    76,
    88,
    tplName,
    { font: tokens.headingFont, size: 22, weight: 700, fill: tokens.primary }
  )}${textLine(76, 120, copy.podcast.description, { font: tokens.bodyFont, size: 14, fill: tokens.textMuted })}<rect x="48" y="182" width="864" height="84" rx="10" fill="${tokens.surfaceAlt}"/>${textLine(
    76,
    212,
    copy.podcast.hostA,
    { font: tokens.headingFont, size: 13, weight: 700, fill: tokens.accent }
  )}${textLine(76, 240, copy.podcast.quotes[0], { font: tokens.bodyFont, size: 14, fill: tokens.textPrimary })}<rect x="48" y="286" width="864" height="84" rx="10" fill="${tokens.surfaceAlt}"/>${textLine(
    76,
    316,
    copy.podcast.hostB,
    { font: tokens.headingFont, size: 13, weight: 700, fill: tokens.primary }
  )}${textLine(76, 344, copy.podcast.quotes[1], { font: tokens.bodyFont, size: 14, fill: tokens.textPrimary })}</svg>`
}

function buildMindmapPreviewSvg(tplName: string, tokens: DesignTokens, copy: PreviewCopy, locale: DocsLocale): string {
  const nodes = copy.mindmap.nodes
  const branchColors = [tokens.accent, '#2563EB', '#8B5CF6', '#D97706']
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const leftNodes = [
    { y: 152, label: nodes[2], color: branchColors[2], child: tr('Subtema {letter}', { letter: 'A' }) },
    { y: 388, label: nodes[3], color: branchColors[3], child: tr('Subtema {letter}', { letter: 'B' }) }
  ]
  const rightNodes = [
    { y: 152, label: nodes[0], color: branchColors[0], child: tr('Subtema {letter}', { letter: 'C' }) },
    { y: 388, label: nodes[1], color: branchColors[1], child: tr('Subtema {letter}', { letter: 'D' }) }
  ]

  const branchesSvg = [
    ...leftNodes.map(
      (n) =>
        `<path d="M 380 270 C 330 270, 325 ${n.y}, 276 ${n.y}" fill="none" stroke="${n.color}" stroke-width="2.6" opacity="0.78"/>` +
        `<circle cx="276" cy="${n.y}" r="3.8" fill="${n.color}"/>` +
        `<rect x="106" y="${n.y - 30}" width="170" height="60" rx="12" fill="${tokens.surfaceAlt}" stroke="${n.color}" stroke-width="1.6"/>` +
        `<rect x="270" y="${n.y - 24}" width="5" height="48" rx="2.5" fill="${n.color}"/>` +
        `${textLine(120, n.y + 5, n.label, { font: tokens.bodyFont, size: 13, weight: 700, fill: tokens.textPrimary })}` +
        `<path d="M 106 ${n.y} C 92 ${n.y}, 90 ${n.y}, 78 ${n.y}" fill="none" stroke="${n.color}" stroke-width="1.4" opacity="0.55"/>` +
        `<rect x="18" y="${n.y - 12}" width="60" height="24" rx="12" fill="${tokens.surface}" stroke="${n.color}" stroke-width="1"/>` +
        `${textLine(48, n.y + 4, n.child.slice(0, 8), { font: tokens.bodyFont, size: 9.5, weight: 500, fill: tokens.textPrimary, anchor: 'middle' })}`
    ),
    ...rightNodes.map(
      (n) =>
        `<path d="M 580 270 C 630 270, 635 ${n.y}, 684 ${n.y}" fill="none" stroke="${n.color}" stroke-width="2.6" opacity="0.78"/>` +
        `<circle cx="684" cy="${n.y}" r="3.8" fill="${n.color}"/>` +
        `<rect x="684" y="${n.y - 30}" width="170" height="60" rx="12" fill="${tokens.surfaceAlt}" stroke="${n.color}" stroke-width="1.6"/>` +
        `<rect x="685" y="${n.y - 24}" width="5" height="48" rx="2.5" fill="${n.color}"/>` +
        `${textLine(700, n.y + 5, n.label, { font: tokens.bodyFont, size: 13, weight: 700, fill: tokens.textPrimary })}` +
        `<path d="M 854 ${n.y} C 868 ${n.y}, 870 ${n.y}, 882 ${n.y}" fill="none" stroke="${n.color}" stroke-width="1.4" opacity="0.55"/>` +
        `<rect x="882" y="${n.y - 12}" width="60" height="24" rx="12" fill="${tokens.surface}" stroke="${n.color}" stroke-width="1"/>` +
        `${textLine(912, n.y + 4, n.child.slice(0, 8), { font: tokens.bodyFont, size: 9.5, weight: 500, fill: tokens.textPrimary, anchor: 'middle' })}`
    )
  ].join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><defs><pattern id="pv-mm-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1" fill="${tokens.border}" opacity="0.45"/></pattern></defs><rect width="960" height="540" fill="${tokens.surface}"/><rect width="960" height="540" fill="url(#pv-mm-dots)"/>${branchesSvg}<rect x="374" y="220" width="212" height="100" rx="24" fill="${tokens.accent}" opacity="0.15"/><rect x="380" y="226" width="200" height="88" rx="20" fill="${tokens.primary}"/>${textLine(
    480,
    276,
    tplName.slice(0, 20),
    { font: tokens.headingFont, size: 16, weight: 700, fill: tokens.surface, anchor: 'middle' }
  )}</svg>`
}

function buildFlashcardsPreviewSvg(tplName: string, tokens: DesignTokens, copy: PreviewCopy): string {
  const options = [
    { letter: 'A', text: copy.flashcards.answerLines[1] || '12%', correct: false },
    { letter: 'B', text: copy.flashcards.answer, correct: true },
    { letter: 'C', text: copy.flashcards.answerLines[2] || '45%', correct: false },
    { letter: 'D', text: copy.flashcards.source, correct: false }
  ]
  const optionRows = options
    .map((opt, idx) => {
      const y = 216 + idx * 64
      const fill = opt.correct ? tokens.surfaceAlt : tokens.surface
      const stroke = opt.correct ? tokens.accent : tokens.border
      const strokeW = opt.correct ? '1.8' : '1'
      const badgeFill = opt.correct ? tokens.accent : tokens.surfaceAlt
      const badgeTextFill = opt.correct ? tokens.surface : tokens.textMuted
      return `<rect x="56" y="${y}" width="848" height="50" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/><circle cx="88" cy="${y + 25}" r="14" fill="${badgeFill}"/>${textLine(
        88,
        y + 30,
        opt.letter,
        { font: tokens.bodyFont, size: 12, weight: 700, fill: badgeTextFill, anchor: 'middle' }
      )}${textLine(116, y + 30, opt.text.slice(0, 64), {
        font: tokens.bodyFont,
        size: 14,
        weight: opt.correct ? 600 : 400,
        fill: tokens.textPrimary
      })}`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/>${textLine(
    56,
    62,
    tplName,
    { font: tokens.headingFont, size: 22, weight: 700, fill: tokens.primary }
  )}${textLine(904, 62, '1 / 10', {
    font: tokens.bodyFont,
    size: 13,
    weight: 600,
    fill: tokens.accent,
    anchor: 'end'
  })}<rect x="56" y="82" width="848" height="6" rx="3" fill="${tokens.surfaceAlt}"/><rect x="56" y="82" width="170" height="6" rx="3" fill="${tokens.accent}"/>${textLine(
    56,
    136,
    copy.flashcards.question[0],
    { font: tokens.headingFont, size: 19, weight: 600, fill: tokens.textPrimary }
  )}${textLine(56, 166, copy.flashcards.question[1], {
    font: tokens.headingFont,
    size: 19,
    weight: 600,
    fill: tokens.textPrimary
  })}${optionRows}</svg>`
}

export function buildTemplatePreviewPages(
  tpl: PreviewableTemplate,
  toolId: string,
  brandKit?: PreviewBrandKit | null,
  isBrandMode = false,
  locale?: string
): { orientation: 'landscape' | 'portrait'; pages: Array<{ label: string; svg: string }> } {
  const tokens = resolveTokens(tpl, brandKit, isBrandMode)
  const preset: LayoutPreset = tpl.layoutPreset || 'executive'
  const copy = getPreviewCopy(locale)
  const normalizedLocale = normalizeLocale(locale)
  const rawInst = brandKit?.institutionName || ''
  const inst = isUntitledProject(rawInst, normalizedLocale) ? '' : rawInst

  if (toolId === 'xlsx') {
    const sheet1 = buildXlsxPreviewSvg(tpl.name, tokens, copy, normalizedLocale)
    const sheet2 = buildSlideMetricsSvg(tokens, false, copy)
    const sheet3 = buildSlideContentSvg(tokens, preset, false, copy)
    const sheet4 = buildXlsxPreviewSvg(`${tpl.name} · II`, tokens, copy, normalizedLocale)
    const sheet5 = buildSlideMetricsSvg(tokens, true, copy)
    return {
      orientation: 'landscape',
      pages: [
        { label: `${copy.xlsx.page} (1/5)`, svg: sheet1 },
        { label: `${copy.slide.chartTitle} (2/5)`, svg: sheet2 },
        { label: `${copy.slide.contentLabel} (3/5)`, svg: sheet3 },
        { label: `${copy.xlsx.page} (4/5)`, svg: sheet4 },
        { label: `${copy.slide.metricsLabel} (5/5)`, svg: sheet5 }
      ]
    }
  }
  if (toolId === 'podcast') {
    const p1 = buildPodcastPreviewSvg(tpl.name, tokens, copy)
    const p2 = buildSlideContentSvg(tokens, preset, true, copy)
    const p3 = buildSlideMetricsSvg(tokens, true, copy)
    const p4 = buildPodcastPreviewSvg(`${tpl.name} · 2`, tokens, copy)
    const p5 = buildSlideMetricsSvg(tokens, false, copy)
    return {
      orientation: 'landscape',
      pages: [
        { label: `${copy.podcast.page} (1/5)`, svg: p1 },
        { label: `${copy.slide.contentLabel} (2/5)`, svg: p2 },
        { label: `${copy.slide.summaryTitle} (3/5)`, svg: p3 },
        { label: `${copy.podcast.page} (4/5)`, svg: p4 },
        { label: `${copy.slide.metricsLabel} (5/5)`, svg: p5 }
      ]
    }
  }
  if (toolId === 'mindmap') {
    const p1 = buildMindmapPreviewSvg(tpl.name, tokens, copy, normalizedLocale)
    const p2 = buildSlideContentSvg(tokens, preset, true, copy)
    const p3 = buildSlideMetricsSvg(tokens, true, copy)
    const p4 = buildMindmapPreviewSvg(`${tpl.name} · II`, tokens, copy, normalizedLocale)
    const p5 = buildSlideCoverSvg(tpl.name, tpl.description || copy.slide.defaultSubtitle, tokens, preset, inst, true, copy)
    return {
      orientation: 'landscape',
      pages: [
        { label: `${copy.mindmap.page} (1/5)`, svg: p1 },
        { label: `${copy.slide.contentLabel} (2/5)`, svg: p2 },
        { label: `${copy.slide.metricsLabel} (3/5)`, svg: p3 },
        { label: `${copy.mindmap.page} (4/5)`, svg: p4 },
        { label: `${copy.slide.summaryTitle} (5/5)`, svg: p5 }
      ]
    }
  }
  if (toolId === 'flashcards') {
    const p1 = buildFlashcardsPreviewSvg(tpl.name, tokens, copy)
    const p2 = buildFlashcardsPreviewSvg(`${tpl.name} · 2/5`, tokens, copy)
    const p3 = buildFlashcardsPreviewSvg(`${tpl.name} · 3/5`, tokens, copy)
    const p4 = buildFlashcardsPreviewSvg(`${tpl.name} · 4/5`, tokens, copy)
    const p5 = buildSlideMetricsSvg(tokens, true, copy)
    return {
      orientation: 'landscape',
      pages: [
        { label: `${copy.flashcards.page} (1/5)`, svg: p1 },
        { label: `${copy.flashcards.page} (2/5)`, svg: p2 },
        { label: `${copy.flashcards.page} (3/5)`, svg: p3 },
        { label: `${copy.flashcards.page} (4/5)`, svg: p4 },
        { label: `${copy.slide.metricsLabel} (5/5)`, svg: p5 }
      ]
    }
  }
  if (toolId === 'apostila') {
    return { orientation: 'portrait', pages: buildApostilaPages(tpl, tokens, preset, inst, copy, normalizedLocale) }
  }
  if (toolId === 'pptx' || toolId === 'video') {
    const isVideo = toolId === 'video'
    return {
      orientation: 'landscape',
      pages: [
        {
          label: `${isVideo ? copy.slide.openingLabel : copy.slide.coverLabel} (1/5)`,
          svg: buildSlideCoverSvg(tpl.name, tpl.description || copy.slide.defaultSubtitle, tokens, preset, inst, isVideo, copy)
        },
        { label: `${copy.slide.contentLabel} (2/5)`, svg: buildSlideContentSvg(tokens, preset, isVideo, copy) },
        { label: `${copy.slide.metricsLabel} (3/5)`, svg: buildSlideMetricsSvg(tokens, isVideo, copy) },
        { label: `${copy.slide.chartTitle} (4/5)`, svg: buildSlideContentSvg(tokens, preset, !isVideo, copy) },
        { label: `${copy.slide.summaryTitle} (5/5)`, svg: buildSlideMetricsSvg(tokens, !isVideo, copy) }
      ]
    }
  }
  if (toolId === 'oficio') {
    return { orientation: 'portrait', pages: buildOficioPages(tpl, tokens, inst, copy) }
  }
  if (toolId === 'abnt') {
    return { orientation: 'portrait', pages: buildAbntPages(tpl, tokens, inst, copy) }
  }
  if (toolId === 'resume') {
    return { orientation: 'portrait', pages: buildResumePages(tokens, copy) }
  }

  return {
    orientation: 'portrait',
    pages: buildReportOrEditorialPages(toolId, tpl, tokens, preset, inst, copy)
  }
}
