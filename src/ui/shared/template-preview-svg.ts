import type { DesignTokens, LayoutPreset } from '../../core/types'
import { isUntitledProject, normalizeLocale } from '../../core/i18n.ts'
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
        ? `<rect x="0" y="0" width="960" height="5" fill="${tokens.accent}"/><rect x="80" y="135" width="96" height="4" rx="2" fill="${tokens.accent}"/>`
        : preset === 'editorial' || preset === 'academic'
          ? `<rect x="80" y="70" width="800" height="1.5" fill="${tokens.primary}"/><rect x="80" y="470" width="800" height="1" fill="${tokens.border}"/>`
          : preset === 'playful' || preset === 'whiteboard'
            ? `<rect x="40" y="40" width="880" height="460" rx="18" fill="${tokens.surfaceAlt}" stroke="${tokens.accent}" stroke-width="2"/>`
            : preset === 'minimal'
              ? `<rect x="62" y="168" width="5" height="165" rx="2.5" fill="${tokens.primary}"/>`
              : `<rect x="0" y="0" width="28" height="540" fill="${tokens.primary}"/>`

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
      ? `<rect x="0" y="0" width="960" height="4" fill="${tokens.accent}"/><line x1="56" y1="88" x2="904" y2="88" stroke="${tokens.border}" stroke-width="1"/>`
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
  const topBar = isCorp ? `<rect x="0" y="0" width="595" height="8" fill="${tokens.primary}"/>` : ''
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

  return [
    { label: copy.oficio.page1, svg: page1 },
    { label: copy.oficio.page2, svg: page2 }
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

  return [
    { label: copy.abnt.page1, svg: page1 },
    { label: copy.abnt.page2, svg: page2 }
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
  return [{ label: copy.resume.page, svg: page1 }]
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
      ? `<rect x="0" y="0" width="595" height="10" fill="${tokens.primary}"/><rect x="56" y="88" width="56" height="3" fill="${tokens.accent}"/>`
      : preset === 'editorial'
        ? `<rect x="0" y="0" width="8" height="842" fill="${tokens.primary}"/>`
        : ''
  const topDecorPage2 =
    preset === 'executive' || preset === 'modern'
      ? `<rect x="0" y="0" width="595" height="6" fill="${tokens.primary}"/>`
      : preset === 'editorial'
        ? `<rect x="0" y="0" width="8" height="842" fill="${tokens.primary}"/>`
        : ''

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

  return [
    { label: copy.report.coverLabel, svg: page1 },
    { label: copy.report.bodyLabel, svg: page2 }
  ]
}

function buildXlsxPreviewSvg(tplName: string, tokens: DesignTokens, copy: PreviewCopy): string {
  const rows = [copy.xlsx.headers, ...copy.xlsx.rows]
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
  )}${textLine(440, 376, '1.005.000', { font: tokens.monoFont, size: 14, weight: 700, fill: tokens.primary })}${textLine(
    640,
    376,
    '667.000',
    { font: tokens.monoFont, size: 14, weight: 700, fill: tokens.textPrimary }
  )}${textLine(820, 376, '33,6%', { font: tokens.monoFont, size: 14, weight: 700, fill: tokens.accent })}</svg>`
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

function buildMindmapPreviewSvg(tplName: string, tokens: DesignTokens, copy: PreviewCopy): string {
  const nodes = copy.mindmap.nodes
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/><line x1="480" y1="270" x2="210" y2="140" stroke="${tokens.border}" stroke-width="2.5"/><line x1="480" y1="270" x2="750" y2="140" stroke="${tokens.border}" stroke-width="2.5"/><line x1="480" y1="270" x2="210" y2="400" stroke="${tokens.border}" stroke-width="2.5"/><line x1="480" y1="270" x2="750" y2="400" stroke="${tokens.border}" stroke-width="2.5"/><rect x="360" y="226" width="240" height="88" rx="14" fill="${tokens.primary}"/>${textLine(
    480,
    276,
    tplName.slice(0, 22),
    { font: tokens.headingFont, size: 17, weight: 700, fill: tokens.surface, anchor: 'middle' }
  )}<rect x="90" y="106" width="220" height="64" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.accent}" stroke-width="1.5"/>${textLine(
    200,
    144,
    nodes[0],
    { font: tokens.bodyFont, size: 14, weight: 600, fill: tokens.textPrimary, anchor: 'middle' }
  )}<rect x="650" y="106" width="220" height="64" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.accent}" stroke-width="1.5"/>${textLine(
    760,
    144,
    nodes[1],
    { font: tokens.bodyFont, size: 14, weight: 600, fill: tokens.textPrimary, anchor: 'middle' }
  )}<rect x="90" y="368" width="220" height="64" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.primary}" stroke-width="1.5"/>${textLine(
    200,
    406,
    nodes[2],
    { font: tokens.bodyFont, size: 14, weight: 600, fill: tokens.textPrimary, anchor: 'middle' }
  )}<rect x="650" y="368" width="220" height="64" rx="10" fill="${tokens.surfaceAlt}" stroke="${tokens.primary}" stroke-width="1.5"/>${textLine(
    760,
    406,
    nodes[3],
    { font: tokens.bodyFont, size: 14, weight: 600, fill: tokens.textPrimary, anchor: 'middle' }
  )}</svg>`
}

function buildFlashcardsPreviewSvg(tplName: string, tokens: DesignTokens, copy: PreviewCopy): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet"><rect width="960" height="540" fill="${tokens.surface}"/>${textLine(
    56,
    64,
    tplName,
    { font: tokens.headingFont, size: 22, weight: 700, fill: tokens.primary }
  )}<rect x="56" y="102" width="410" height="360" rx="14" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="1.2"/>${textLine(
    86,
    144,
    copy.flashcards.front,
    { font: tokens.bodyFont, size: 12, weight: 700, fill: tokens.accent }
  )}${textLine(86, 206, copy.flashcards.question[0], {
    font: tokens.headingFont,
    size: 18,
    weight: 600,
    fill: tokens.textPrimary
  })}${textLine(86, 234, copy.flashcards.question[1], {
    font: tokens.headingFont,
    size: 18,
    weight: 600,
    fill: tokens.textPrimary
  })}${textLine(86, 426, copy.flashcards.source, { font: tokens.bodyFont, size: 12, fill: tokens.textMuted })}<rect x="494" y="102" width="410" height="360" rx="14" fill="${tokens.surface}" stroke="${tokens.primary}" stroke-width="1.5"/>${textLine(
    524,
    144,
    copy.flashcards.back,
    { font: tokens.bodyFont, size: 12, weight: 700, fill: tokens.primary }
  )}${textLine(524, 206, copy.flashcards.answer, {
    font: tokens.headingFont,
    size: 20,
    weight: 700,
    fill: tokens.primary
  })}${textLine(524, 242, copy.flashcards.answerLines[0], {
    font: tokens.bodyFont,
    size: 14,
    fill: tokens.textPrimary
  })}${textLine(524, 264, copy.flashcards.answerLines[1], {
    font: tokens.bodyFont,
    size: 14,
    fill: tokens.textPrimary
  })}${textLine(524, 286, copy.flashcards.answerLines[2], {
    font: tokens.bodyFont,
    size: 14,
    fill: tokens.textPrimary
  })}</svg>`
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
    return { orientation: 'landscape', pages: [{ label: copy.xlsx.page, svg: buildXlsxPreviewSvg(tpl.name, tokens, copy) }] }
  }
  if (toolId === 'podcast') {
    return { orientation: 'landscape', pages: [{ label: copy.podcast.page, svg: buildPodcastPreviewSvg(tpl.name, tokens, copy) }] }
  }
  if (toolId === 'mindmap') {
    return { orientation: 'landscape', pages: [{ label: copy.mindmap.page, svg: buildMindmapPreviewSvg(tpl.name, tokens, copy) }] }
  }
  if (toolId === 'flashcards') {
    return { orientation: 'landscape', pages: [{ label: copy.flashcards.page, svg: buildFlashcardsPreviewSvg(tpl.name, tokens, copy) }] }
  }
  if (toolId === 'pptx' || toolId === 'video') {
    const isVideo = toolId === 'video'
    return {
      orientation: 'landscape',
      pages: [
        {
          label: isVideo ? copy.slide.openingLabel : copy.slide.coverLabel,
          svg: buildSlideCoverSvg(tpl.name, tpl.description || copy.slide.defaultSubtitle, tokens, preset, inst, isVideo, copy)
        },
        { label: copy.slide.contentLabel, svg: buildSlideContentSvg(tokens, preset, isVideo, copy) },
        { label: copy.slide.metricsLabel, svg: buildSlideMetricsSvg(tokens, isVideo, copy) }
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
