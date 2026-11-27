import { createHash } from 'node:crypto'
import { renderDocxAndPdf } from '../engines/docx-pdf-engine.ts'
import { renderPptxAndPdf } from '../engines/pptx-engine.ts'
import { renderMindMapOrTimelineSvg } from '../engines/study-data-engines.ts'
import { renderSceneSvg, type VideoScene } from '../engines/video-engine.ts'
import { buildTemplatePreviewPages } from '../../ui/shared/template-preview-svg.ts'
import type { BrandKit, TemplateManifest, ToolId } from '../types.ts'
import { templateRegistry } from './template-registry.ts'
import { localizeTemplate } from './localize-template.ts'
import { normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'
import { getPreviewCopy } from '../../ui/shared/template-preview-copy.ts'

export interface RenderedPreviewResult {
  orientation: 'landscape' | 'portrait'
  pages: Array<{ label: string; svg: string }>
}

const previewCache = new Map<string, RenderedPreviewResult>()
const MAX_CACHE_ENTRIES = 60

const LOREM_SHORT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
const LOREM_MEDIUM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta.'
const LOREM_LONG =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur sodales ligula in libero.'

function buildFixtureData(toolId: ToolId, templateName: string, locale: DocsLocale): Record<string, any> {
  const copy = getPreviewCopy(locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  switch (toolId) {
    case 'apostila':
      return {
        title: `${templateName} - Lorem Ipsum`,
        subtitle: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
        badgeLabel: 'LOREM IPSUM',
        studentFields: ['Lorem', 'Ipsum', 'Dolor'],
        presentation: `${LOREM_LONG} ${LOREM_MEDIUM}`,
        chapters: [
          {
            title: `1. ${copy.report.section1Title}`,
            objectives: [LOREM_SHORT, 'Ut enim ad minim veniam, quis nostrud exercitation ullamco.'],
            sections: [
              {
                heading: `1.1 ${copy.slide.contentTitle}`,
                body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}`,
                example: LOREM_MEDIUM,
                callout: LOREM_SHORT
              },
              {
                heading: `1.2 ${copy.report.section2Title}`,
                body: LOREM_MEDIUM,
                table: {
                  headers: ['Lorem', 'Ipsum', 'Dolor'],
                  rows: [
                    ['Lorem', 'Ipsum 12%', 'Dolor 24%'],
                    ['Consectetur', 'Adipiscing', 'Elit'],
                    ['Tempor', 'Incididunt', 'Labore']
                  ]
                }
              }
            ],
            exercises: [
              {
                question: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit?',
                options: ['A) Ut enim ad minim', 'B) Sed do eiusmod tempor', 'C) Duis aute irure dolor', 'D) Excepteur sint occaecat'],
                answer: 'B) Sed do eiusmod tempor. ' + LOREM_SHORT
              }
            ]
          },
          {
            title: `2. ${copy.report.section2Title}`,
            objectives: [LOREM_SHORT, 'Duis aute irure dolor in reprehenderit in voluptate velit.'],
            sections: [
              {
                heading: `2.1 ${copy.slide.contentLabel}`,
                body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}`,
                timeline: [
                  { step: 'Lorem 1', detail: LOREM_SHORT },
                  { step: 'Lorem 2', detail: LOREM_SHORT },
                  { step: 'Lorem 3', detail: LOREM_SHORT }
                ]
              },
              {
                heading: `2.2 ${copy.slide.metricsTitle}`,
                body: LOREM_MEDIUM,
                checklist: [
                  'Lorem ipsum dolor sit amet',
                  'Consectetur adipiscing elit',
                  'Sed do eiusmod tempor incididunt',
                  'Ut labore et dolore magna aliqua'
                ]
              }
            ],
            exercises: [
              {
                question: 'Quis nostrud exercitation ullamco laboris nisi ut aliquip?',
                answer: LOREM_MEDIUM
              }
            ]
          },
          {
            title: `3. ${copy.slide.summaryTitle}`,
            objectives: [LOREM_SHORT],
            sections: [
              {
                heading: `3.1 ${copy.report.section2Title}`,
                body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}`,
                comparison: {
                  leftTitle: 'Lorem A',
                  leftItems: [LOREM_SHORT, 'Lorem ipsum'],
                  rightTitle: 'Lorem B',
                  rightItems: [LOREM_SHORT, 'Ut labore et dolore']
                }
              }
            ],
            exercises: []
          }
        ],
        conclusion: LOREM_LONG,
        glossary: [
          { term: 'Lorem Ipsum', definition: LOREM_SHORT },
          { term: 'Dolor Sit Amet', definition: LOREM_SHORT }
        ],
        references: [
          'LOREM, I. Dolor Sit Amet: consectetur adipiscing elit. 2026.',
          'IPSUM, D. Tempor Incididunt Ut Labore. 2026.'
        ]
      }

    case 'abnt':
      return {
        institution: copy.abnt.institution,
        author: copy.abnt.author,
        title: `${templateName}: Lorem Ipsum`,
        subtitle: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
        cityAndYear: `${copy.abnt.city}, ${copy.abnt.year}`,
        workNature: copy.abnt.nature.join(' '),
        abstractPt: `${LOREM_LONG} ${LOREM_MEDIUM}`,
        keywordsPt: ['Lorem', 'Ipsum', 'Consectetur', 'Adipiscing'],
        abstractEn: `${LOREM_LONG} ${LOREM_MEDIUM}`,
        sections: [
          { number: '1', heading: copy.abnt.sectionTitle, paragraphs: [LOREM_LONG, LOREM_MEDIUM, LOREM_LONG, LOREM_MEDIUM] },
          {
            number: '2',
            heading: copy.abnt.referencesTitle,
            paragraphs: [LOREM_LONG, LOREM_MEDIUM, LOREM_LONG],
            longQuotes: [
              { text: LOREM_LONG, citation: '(LOREM, 2026, p. 14)' },
              { text: LOREM_MEDIUM, citation: '(IPSUM, 2025, p. 22)' }
            ]
          },
          { number: '3', heading: copy.report.section1Title, paragraphs: [LOREM_LONG, LOREM_MEDIUM, LOREM_LONG, LOREM_MEDIUM] },
          { number: '4', heading: copy.report.section2Title, paragraphs: [LOREM_LONG, LOREM_MEDIUM, LOREM_LONG] },
          { number: '5', heading: copy.slide.summaryTitle, paragraphs: [LOREM_LONG, LOREM_MEDIUM, LOREM_LONG] }
        ],
        references: [
          'LOREM, I. Consectetur Adipiscing Elit. Lorem Publisher, 2026.',
          'DOLOR, S. Sed Do Eiusmod Tempor. Ipsum Publisher, 2025.',
          'AMET, C. Ut Labore Et Dolore. Dolor Publisher, 2024.'
        ]
      }

    case 'report':
      return {
        title: `${templateName} - Lorem Ipsum`,
        executiveSummary: `${LOREM_LONG} ${LOREM_MEDIUM} ${LOREM_LONG}`,
        kpis: [
          { label: 'Lorem Index', value: '+28%', trend: '+4,2%' },
          { label: 'Ipsum Score', value: '94,5', trend: '+1,8%' },
          { label: 'Dolor Rate', value: '12,4s', trend: '-18%' }
        ],
        sections: [
          {
            heading: `1. ${copy.report.section1Title}`,
            body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}\n\n${LOREM_LONG}\n\n${LOREM_MEDIUM}`
          },
          {
            heading: `2. ${copy.report.section2Title}`,
            body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}\n\n${LOREM_LONG}`,
            table: {
              headers: [copy.report.table.indicator, copy.report.table.current, copy.report.table.target, 'Lorem'],
              rows: [
                ['Lorem Alpha', '120', '154', '+28,3%'],
                ['Ipsum Beta', '88%', '94,5%', '+6,5 p.p.'],
                ['Dolor Gamma', '420', '510', '+21,4%'],
                ['Sit Delta', '310', '395', '+27,4%']
              ]
            }
          },
          {
            heading: `3. ${copy.report.section2Title}`,
            body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}\n\n${LOREM_LONG}\n\n${LOREM_MEDIUM}`
          },
          {
            heading: `4. ${copy.report.section1Title}`,
            body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}\n\n${LOREM_LONG}`
          },
          {
            heading: `5. ${copy.slide.summaryTitle}`,
            body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}\n\n${LOREM_LONG}`
          },
          ...Array.from({ length: 7 }, (_, i) => ({
            heading: `${i + 6}. Lorem Ipsum`,
            body: `${LOREM_LONG}\n\n${LOREM_LONG}\n\n${LOREM_MEDIUM}`
          }))
        ],
        recommendations: [LOREM_SHORT, LOREM_SHORT, LOREM_SHORT, LOREM_SHORT, LOREM_SHORT]
      }

    case 'oficio':
      return {
        documentNumber: copy.oficio.number,
        placeAndDate: copy.oficio.date,
        recipientTitle: `${copy.oficio.recipientIntro} ${copy.oficio.recipientTitle}`,
        subject: copy.oficio.subject,
        paragraphs: Array.from({ length: 34 }, (_, i) => `${i + 1}. ${LOREM_LONG}`),
        closing: copy.oficio.closing,
        signerName: `${copy.oficio.signer}\n${copy.oficio.signerRole}`
      }

    case 'letterhead':
      return {
        title: `${templateName} - Lorem Ipsum`,
        documentTitle: `${templateName} — Lorem Ipsum`,
        fields: [
          { key: copy.oficio.signerRole, value: 'Lorem Ipsum Dolor' },
          { key: tr('Referência'), value: 'DOC-2026/042' }
        ],
        paragraphs: Array.from({ length: 20 }, (_, i) => `${i + 1}. ${LOREM_LONG}`),
        sections: Array.from({ length: 16 }, (_, i) => ({
          heading: `${i + 1}. ${tr('Seção {number}', { number: i + 1 })} Lorem Ipsum`,
          body: `${LOREM_LONG}\n\n${LOREM_LONG}`
        })),
        signatureBlock: `${copy.oficio.date}\n___________________________\n${copy.oficio.signer}`
      }

    case 'pptx':
      return {
        title: `${templateName}`,
        subtitle: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
        slides: [
          {
            layout: 'bullets',
            title: copy.slide.contentTitle,
            bullets: [
              'Lorem ipsum dolor sit amet: consectetur adipiscing elit',
              'Sed do eiusmod tempor: incididunt ut labore et dolore',
              'Ut enim ad minim veniam: quis nostrud exercitation',
              'Duis aute irure dolor: in reprehenderit in voluptate'
            ],
            notes: LOREM_MEDIUM
          },
          {
            layout: 'metrics',
            title: copy.slide.metricsTitle,
            metrics: [
              { label: copy.slide.metrics[0], value: '+28%' },
              { label: copy.slide.metrics[1], value: '96.4%' },
              { label: copy.slide.metrics[2], value: 'R$ 420k' }
            ],
            notes: LOREM_SHORT
          },
          {
            layout: 'chart',
            title: copy.slide.chartTitle,
            chart: { type: 'bar', labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [42, 58, 76, 94] },
            notes: LOREM_SHORT
          },
          {
            layout: 'two_col',
            title: copy.report.section2Title,
            bullets: [
              'Lorem A: lorem ipsum dolor sit amet',
              'Lorem B: consectetur adipiscing elit',
              'Lorem: 28%',
              'Lorem: 12'
            ],
            notes: LOREM_SHORT
          },
          {
            layout: 'timeline',
            title: copy.slide.contentLabel,
            bullets: [
              'Lorem 1: Lorem Ipsum',
              'Lorem 2: Consectetur',
              'Lorem 3: Adipiscing',
              'Lorem 4: Elit'
            ],
            notes: LOREM_SHORT
          },
          {
            layout: 'quote',
            title: copy.slide.summaryTitle,
            bullets: [LOREM_MEDIUM],
            notes: LOREM_SHORT
          }
        ]
      }

    case 'video':
      return {
        title: templateName,
        aspectRatio: '16:9',
        scenes: [
          { id: 'v1', component: 'TitleHeroScene', heading: templateName, narration: LOREM_SHORT },
          {
            id: 'v2',
            component: 'AnimatedBulletListScene',
            heading: copy.slide.contentTitle,
            narration: LOREM_SHORT,
            items: ['Lorem ipsum dolor sit amet', 'Consectetur adipiscing elit', 'Sed do eiusmod tempor']
          },
          {
            id: 'v3',
            component: 'MetricCounterGridScene',
            heading: copy.slide.metricsTitle,
            narration: LOREM_SHORT,
            metrics: [
              { label: 'Lorem', value: '+28%' },
              { label: 'Ipsum', value: '94%' },
              { label: 'Dolor', value: '12x' }
            ]
          },
          {
            id: 'v4',
            component: 'BarChartScene',
            heading: copy.slide.chartTitle,
            narration: LOREM_SHORT,
            items: ['Q1: 40', 'Q2: 65', 'Q3: 82', 'Q4: 96']
          },
          {
            id: 'v5',
            component: 'ComparisonSplitScene',
            heading: copy.report.section2Title,
            narration: LOREM_SHORT,
            items: ['Lorem A: Lorem ipsum', 'Lorem B: Consectetur']
          },
          {
            id: 'v6',
            component: 'SummaryTakeawaysScene',
            heading: copy.slide.summaryTitle,
            narration: LOREM_SHORT,
            items: ['Lorem ipsum dolor', 'Consectetur elit', 'Labore et dolore']
          }
        ] as VideoScene[]
      }

    case 'mindmap':
      return {
        rootLabel: templateName,
        mode: 'mindmap',
        nodes: [
          { id: 'n1', label: 'Lorem Ipsum', children: [{ label: 'Dolor sit' }, { label: 'Amet elit' }] },
          { id: 'n2', label: 'Consectetur', children: [{ label: 'Adipiscing' }, { label: 'Eiusmod' }] },
          { id: 'n3', label: 'Tempor Labore', children: [{ label: 'Magna aliqua' }, { label: 'Minim veniam' }] },
          { id: 'n4', label: 'Exercitation', children: [{ label: 'Ullamco' }, { label: 'Laboris' }] }
        ]
      }

    case 'resume':
      return {
        title: `Lorem Ipsum Dolor - ${copy.resume.page}`,
        fullName: 'Lorem Ipsum Dolor',
        headline: 'Lorem Ipsum',
        summary: `${LOREM_LONG} ${LOREM_MEDIUM} ${LOREM_LONG}`,
        experiences: Array.from({ length: 10 }, (_, i) => ({
          role: `Lorem ${i + 1}`,
          company: `Lorem Company ${i + 1}`,
          period: `${2016 + i} – ${2017 + i}`,
          achievements: [LOREM_MEDIUM, LOREM_MEDIUM, LOREM_SHORT]
        })),
        sections: Array.from({ length: 20 }, (_, i) => ({
          heading: `${copy.resume.experienceTitle} ${i + 1}`,
          body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}`
        })),
        skills: ['Lorem', 'Ipsum', 'Consectetur', 'Adipiscing', 'Eiusmod', 'Tempor', 'Labore', 'Dolore', 'Magna', 'Aliqua']
      }

    case 'lesson_plan':
      return {
        title: `${templateName} - Lorem Ipsum`,
        gradeAndDuration: 'Lorem Ipsum • 50 min',
        objectives: [LOREM_MEDIUM, LOREM_MEDIUM, LOREM_MEDIUM, LOREM_MEDIUM],
        stages: Array.from({ length: 24 }, (_, i) => ({
          phase: `Lorem ${i + 1}: Lorem Ipsum`,
          minutes: '15 min',
          activity: `${LOREM_LONG} ${LOREM_MEDIUM}`,
          resources: 'Lorem, Ipsum, Dolor'
        })),
        assessment: `${LOREM_LONG} ${LOREM_MEDIUM}`
      }

    case 'meeting_minutes':
      return {
        title: `${templateName} - Lorem Ipsum`,
        dateAndParticipants: '26/11/2026 • Lorem, Ipsum, Dolor, Sit Amet, Consectetur, Adipiscing',
        decisions: Array.from({ length: 16 }, (_, i) => `Lorem ${i + 1}: ${LOREM_LONG}`),
        actionItems: Array.from({ length: 12 }, (_, i) => ({
          task: `Lorem ${i + 1}: ${LOREM_MEDIUM}`,
          owner: `Lorem ${i + 1}`,
          deadline: '19/12/2026'
        })),
        sections: Array.from({ length: 20 }, (_, i) => ({
          heading: `Lorem ${i + 1}: Lorem Ipsum`,
          body: `${LOREM_LONG}\n\n${LOREM_MEDIUM}`
        }))
      }

    case 'contract':
      return {
        title: `${templateName} - Lorem Ipsum`,
        parties: ['Lorem: Lorem Ipsum S.A.', 'Ipsum: Dolor Tecnologia Ltda.'],
        clauses: Array.from({ length: 24 }, (_, i) => ({
          number: String(i + 1),
          title: `LOREM IPSUM ${i + 1}`,
          text: `${LOREM_LONG} ${LOREM_LONG}`
        }))
      }

    case 'faq':
      return {
        title: `${templateName} - Lorem Ipsum`,
        items: Array.from({ length: 30 }, (_, i) => ({
          question: `${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit?`,
          answer: `${LOREM_LONG} ${LOREM_MEDIUM}`,
          category: i % 2 === 0 ? tr('Geral') : tr('Técnico')
        }))
      }

    case 'newsletter':
      return {
        title: `${templateName} - Lorem Ipsum #42`,
        lead: `${LOREM_LONG} ${LOREM_MEDIUM}`,
        blocks: Array.from({ length: 22 }, (_, i) => ({
          heading: `Lorem ${i + 1}: Lorem Ipsum Dolor`,
          body: `${LOREM_LONG} ${LOREM_MEDIUM}`,
          ctaText: 'Lorem ipsum'
        }))
      }

    default:
      return { title: templateName, paragraphs: [LOREM_LONG, LOREM_MEDIUM] }
  }
}

export async function renderRealTemplatePreviewPages(opts: {
  templateId: string
  toolId?: ToolId
  brandKit?: BrandKit | null
  isBrandMode?: boolean
  locale?: string
}): Promise<RenderedPreviewResult> {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const baseTpl: TemplateManifest = localizeTemplate(
    templateRegistry.getById(opts.templateId) ||
      templateRegistry.getDefaultForTool(opts.toolId || 'report'),
    locale
  )
  const toolId = opts.toolId || baseTpl.toolId
  const effectiveBrand = opts.isBrandMode ? opts.brandKit : null
  const tokens = templateRegistry.applyBrandKit(baseTpl, effectiveBrand)

  const brandKey = effectiveBrand
    ? createHash('sha256').update(JSON.stringify(effectiveBrand)).digest('hex')
    : 'none'
  const cacheKey = `${baseTpl.id}:${toolId}:${brandKey}:${locale}`
  const cached = previewCache.get(cacheKey)
  if (cached) return cached

  const data = buildFixtureData(toolId, baseTpl.name, locale)
  let result: RenderedPreviewResult

  if (toolId === 'flashcards' || toolId === 'podcast' || toolId === 'xlsx') {
    result = buildTemplatePreviewPages(baseTpl, toolId, effectiveBrand, Boolean(opts.isBrandMode), opts.locale)
  } else if (toolId === 'pptx') {
    const res = await renderPptxAndPdf({
      tokens,
      data: data as any,
      brandKit: effectiveBrand,
      layoutPreset: baseTpl.layoutPreset,
      disableRemoteImages: true,
      locale
    })
    result = {
      orientation: 'landscape',
      pages: res.previewSvgs.map((svg, idx) => ({
        label: tr('Slide {number}', { number: idx + 1 }),
        svg
      }))
    }
  } else if (toolId === 'video') {
    const scenes = (data.scenes || []) as VideoScene[]
    const aspectRatio = baseTpl.pageFormat === '9:16' ? '9:16' : '16:9'
    const pages = scenes.map((scene, idx) => ({
      label: tr('Cena {number}', { number: idx + 1 }),
      svg: renderSceneSvg({
        scene,
        tokens,
        aspectRatio,
        sceneIndex: idx,
        totalScenes: scenes.length,
        layoutPreset: baseTpl.layoutPreset,
        locale
      })
    }))
    result = {
      orientation: aspectRatio === '9:16' ? 'portrait' : 'landscape',
      pages
    }
  } else if (toolId === 'mindmap') {
    const baseNodes = Array.isArray(data.nodes) ? data.nodes : []
    const views = [
      { label: tr('Mapa Completo ({current}/{total})', { current: 1, total: 5 }), mode: 'mindmap' as const, root: String(data.rootLabel || baseTpl.name), nodes: baseNodes },
      { label: tr('Linha do Tempo ({current}/{total})', { current: 2, total: 5 }), mode: 'timeline' as const, root: String(data.rootLabel || baseTpl.name), nodes: baseNodes },
      { label: tr('Ramo {number}: Lorem ({current}/{total})', { number: 1, current: 3, total: 5 }), mode: 'mindmap' as const, root: 'Lorem Ipsum', nodes: baseNodes.slice(0, 2) },
      { label: tr('Ramo {number}: Lorem ({current}/{total})', { number: 2, current: 4, total: 5 }), mode: 'mindmap' as const, root: 'Consectetur Elit', nodes: baseNodes.slice(2, 4) },
      { label: tr('Síntese Geral ({current}/{total})', { current: 5, total: 5 }), mode: 'timeline' as const, root: getPreviewCopy(locale).slide.summaryTitle, nodes: baseNodes.slice(0, 3) }
    ]
    result = {
      orientation: 'landscape',
      pages: views.map((v) => ({
        label: v.label,
        svg: renderMindMapOrTimelineSvg({
          rootLabel: v.root,
          mode: v.mode,
          nodes: v.nodes,
          tokens,
          locale
        }).svg
      }))
    }
  } else {
    const docRes = await renderDocxAndPdf({
      toolId,
      template: baseTpl,
      tokens,
      data,
      brandKit: effectiveBrand,
      locale: opts.locale
    })
    result = {
      orientation: 'portrait',
      pages: docRes.previewSvgs.map((svg, idx) => ({
        label: tr('Página {number}', { number: idx + 1 }),
        svg
      }))
    }
  }

  if (previewCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = previewCache.keys().next().value
    if (firstKey) previewCache.delete(firstKey)
  }
  previewCache.set(cacheKey, result)
  return result
}
