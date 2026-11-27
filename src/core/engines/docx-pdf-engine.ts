import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { BrandKit, DesignTokens, TemplateManifest, ToolId, VisualQAReport } from '../types.ts'
import { runVisualQA, type VisualPageMetric } from '../qa/visual-qa.ts'
import { normalizeLocale, isUntitledProject } from '../i18n.ts'
import { translateCore } from '../translate.ts'
import { buildDocumentHtml, renderHtmlToPdfBuffer, renderHtmlWithPaginatedToc } from './html-pdf-engine.ts'
import {
  maybeRenderFlowDiagramPng,
  maybeRenderTableBarChartPng,
  renderConceptMapPng,
  renderCoverIllustrationPng
} from './visual-charts-png.ts'

function cleanEditorialText(text: string, isHeading = false): string {
  const raw = String(text || '')
  if (!raw) return ''
  // Replace AI-slop em/en dashes with natural punctuation
  const dashFixed = raw
    .replace(/\s*[\u2014\u2013]\s*/g, isHeading ? ': ' : ', ')
    .replace(/,\s*,/g, ',')
    .replace(/:\s*,/g, ':')
    .replace(/\uFFFD/g, '-')
  // Deduplicate repeated paragraphs inside the same block (e.g. uppercase + lowercase duplicate)
  const paras = dashFixed.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  const seen = new Set<string>()
  const unique: string[] = []
  for (const p of paras) {
    const norm = p.replace(/^[-•*\u2022]\s*/, '').replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(norm)) continue
    seen.add(norm)
    unique.push(p)
  }
  // Also catch if first half in UPPERCASE matches second half in lowercase
  if (unique.length >= 2) {
    const first = unique[0].replace(/\s+/g, ' ').toLowerCase()
    const rest = unique.slice(1).join(' ').replace(/^[-•*\u2022]\s*/, '').replace(/\s+/g, ' ').toLowerCase()
    if (first === rest || (rest.length > 30 && first.includes(rest.slice(0, 30)))) {
      return unique.slice(1).join('\n')
    }
  }
  return unique.join('\n')
}

function parseExerciseOptions(questionText: string, explicitOptions?: unknown): { question: string; options: string[] } {
  if (Array.isArray(explicitOptions) && explicitOptions.length > 0) {
    return {
      question: cleanEditorialText(questionText),
      options: explicitOptions.map((o) => cleanEditorialText(String(o || '').trim())).filter(Boolean)
    }
  }
  const cleanQ = cleanEditorialText(questionText)
  // Split inline "(A) ... (B) ... (C) ..." or "A) ... B) ... C) ..."
  const inlineMatch = cleanQ.match(/^([\s\S]+?)\s+(?=\(?[A-Ea-e]\)\s)/)
  if (inlineMatch) {
    const stem = inlineMatch[1].trim()
    const rest = cleanQ.slice(inlineMatch[0].length).trim()
    const parts = rest.split(/\s+(?=\(?[A-Ea-e]\)\s)/).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      return { question: stem, options: parts }
    }
  }
  return { question: cleanQ, options: [] }
}

function hexRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').padEnd(6, '0').slice(0, 6)
  const n = parseInt(clean, 16)
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  }
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// pdf-lib StandardFonts (WinAnsi) safely supports Latin-1 (all PT-BR accents),
// replacing rare symbols outside WinAnsi (like emoji or curly quotes) to prevent encode errors.
function toWinAnsiSafe(text: string): string {
  return String(text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ')
}

function wrapTextToLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const safe = toWinAnsiSafe(text)
  const paragraphs = safe.split(/\r?\n/)
  const lines: string[] = []
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let current = words[0]
    for (let i = 1; i < words.length; i++) {
      const cand = `${current} ${words[i]}`
      if (font.widthOfTextAtSize(cand, fontSize) <= maxWidth) {
        current = cand
      } else {
        lines.push(current)
        current = words[i]
      }
    }
    lines.push(current)
  }
  return lines
}

export interface TocEntryItem {
  key: string
  badge: string
  label: string
}

export interface RenderedBlock {
  kind:
  | 'cover'
  | 'toc'
  | 'chapter_heading'
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'subheading'
  | 'divider'
  | 'signature'
  | 'paragraph'
  | 'quote'
  | 'callout'
  | 'bullet'
  | 'answer'
  | 'glossary_item'
  | 'page_break'
  | 'table'
  | 'comparison'
  | 'timeline'
  | 'checklist'
  | 'kpi_grid'
  | 'exercise'
  | 'concept_map'
  | 'presentation_page'
  text?: string
  exerciseNumber?: number
  options?: string[]
  caption?: string
  figureCaption?: string
  chartPngDataUrl?: string
  diagramPngDataUrl?: string
  coverIllustrationPng?: string
  kpis?: Array<{ label: string; value: string; trend?: string }>
  subtitle?: string
  institution?: string
  presentation?: string
  badgeLabel?: string
  studentFields?: string[]
  tocKey?: string
  tocItems?: string[]
  tocEntries?: TocEntryItem[]
  moduleNumber?: number
  term?: string
  headers?: string[]
  rows?: string[][]
  leftTitle?: string
  leftItems?: string[]
  rightTitle?: string
  rightItems?: string[]
  timelineItems?: Array<{ step: string; detail: string }>
  checklistTitle?: string
  checklistItems?: string[]
}

export function buildDocumentBlocks(
  toolId: ToolId,
  data: Record<string, any>,
  brandKit?: BrandKit | null,
  localeInput?: string
): RenderedBlock[] {
  const blocks: RenderedBlock[] = []
  const locale = normalizeLocale(localeInput)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const rawInst = brandKit?.institutionName || (data.institution as string) || ''
  const inst = isUntitledProject(rawInst, locale) ? '' : rawInst

  if (toolId === 'oficio') {
    if (inst) blocks.push({ kind: 'subtitle', text: inst.toUpperCase() })
    blocks.push({ kind: 'heading', text: String(data.documentNumber || tr('Ofício nº 001/2026')) })
    blocks.push({ kind: 'paragraph', text: String(data.placeAndDate || '') })
    blocks.push({ kind: 'paragraph', text: String(data.recipientTitle || '') })
    blocks.push({ kind: 'heading', text: `${tr('Assunto:')} ${String(data.subject || '')}` })
    const paras = Array.isArray(data.paragraphs) ? data.paragraphs : []
    paras.forEach((p, idx) => blocks.push({ kind: 'paragraph', text: `${idx + 1}. ${String(p)}` }))
    blocks.push({ kind: 'paragraph', text: String(data.closing || tr('Atenciosamente,')) })
    blocks.push({ kind: 'heading', text: String(data.signerName || brandKit?.signatureName || '') })
    return blocks
  }

  if (toolId === 'abnt') {
    if (inst) blocks.push({ kind: 'subtitle', text: inst.toUpperCase() })
    blocks.push({ kind: 'title', text: String(data.title || tr('Trabalho Acadêmico')) })
    if (data.subtitle) blocks.push({ kind: 'subtitle', text: String(data.subtitle) })
    blocks.push({ kind: 'paragraph', text: `${tr('Autor:')} ${String(data.author || '')}` })
    blocks.push({ kind: 'callout', text: String(data.workNature || '') })
    blocks.push({ kind: 'paragraph', text: String(data.cityAndYear || '') })
    blocks.push({ kind: 'page_break' })
    blocks.push({ kind: 'heading', text: tr('RESUMO') })
    blocks.push({ kind: 'paragraph', text: String(data.abstractPt || '') })
    if (Array.isArray(data.keywordsPt) && data.keywordsPt.length > 0) {
      blocks.push({ kind: 'paragraph', text: `${tr('Palavras-chave:')} ${data.keywordsPt.join('; ')}.` })
    }
    if (data.abstractEn) {
      blocks.push({ kind: 'heading', text: 'ABSTRACT' })
      blocks.push({ kind: 'paragraph', text: String(data.abstractEn) })
    }
    blocks.push({ kind: 'page_break' })
    const secs = Array.isArray(data.sections) ? data.sections : []
    for (const sec of secs) {
      blocks.push({ kind: 'heading', text: `${sec.number || ''} ${sec.heading || ''}`.trim() })
      for (const p of sec.paragraphs || []) blocks.push({ kind: 'paragraph', text: String(p) })
      for (const q of sec.longQuotes || []) {
        blocks.push({ kind: 'quote', text: `${String(q.text || '')} (${String(q.citation || '')})` })
      }
    }
    blocks.push({ kind: 'page_break' })
    blocks.push({ kind: 'heading', text: tr('REFERÊNCIAS') })
    for (const ref of data.references || []) blocks.push({ kind: 'paragraph', text: String(ref) })
    return blocks
  }

  if (toolId === 'apostila') {
    const chapters = Array.isArray(data.chapters) ? data.chapters : []
    const studentFields = Array.isArray(data.studentFields)
      ? data.studentFields.map((s: any) => String(s || '').trim()).filter(Boolean)
      : []
    const presentationText =
      data.presentation || data.introduction ? cleanEditorialText(String(data.presentation || data.introduction)) : ''
    blocks.push({
      kind: 'cover',
      institution: inst || undefined,
      badgeLabel: data.badgeLabel ? cleanEditorialText(String(data.badgeLabel).trim(), true) : undefined,
      studentFields: studentFields.length > 0 ? studentFields : undefined,
      text: cleanEditorialText(String(data.title || tr('Apostila Didática')), true),
      subtitle: data.subtitle ? cleanEditorialText(String(data.subtitle)) : undefined
    })
    blocks.push({ kind: 'page_break' })
    if (presentationText) {
      blocks.push({
        kind: 'presentation_page',
        text: presentationText,
        tocEntries: chapters.map((ch: any, idx: number) => ({
          key: `ch-${idx}`,
          badge: String(idx + 1).padStart(2, '0'),
          label: cleanEditorialText(String(ch?.title || ch?.heading || `${tr('Capítulo')} ${idx + 1}`), true)
        }))
      })
      blocks.push({ kind: 'page_break' })
    }
    const answerKeyGroups: Array<{ moduleLabel: string; items: Array<{ num: number; answer: string }> }> = []
    const hasAnyAnswer = chapters.some(
      (ch: any) => Array.isArray(ch?.exercises) && ch.exercises.some((ex: any) => Boolean(ex?.answer))
    )
    if (chapters.length > 0) {
      const tocEntriesStructured: TocEntryItem[] = chapters.map((ch: any, idx: number) => ({
        key: `ch-${idx}`,
        badge: String(idx + 1).padStart(2, '0'),
        label: cleanEditorialText(String(ch?.title || ch?.heading || `${tr('Capítulo')} ${idx + 1}`), true)
      }))
      if (hasAnyAnswer) tocEntriesStructured.push({ key: 'answer_key', badge: '✓', label: tr('Gabarito Comentado') })
      if (data.conclusion) tocEntriesStructured.push({ key: 'conclusion', badge: '•', label: tr('Considerações Finais') })
      if (Array.isArray(data.glossary) && data.glossary.length > 0) {
        tocEntriesStructured.push({ key: 'glossary', badge: '+', label: tr('Glossário') })
      }
      if (Array.isArray(data.references) && data.references.length > 0) {
        tocEntriesStructured.push({ key: 'references', badge: '+', label: tr('Referências') })
      }
      const tocItems = tocEntriesStructured.map((e) => `${e.badge}   ${e.label}`)
      blocks.push({
        kind: 'toc',
        text: tr('Sumário'),
        tocItems,
        tocEntries: tocEntriesStructured
      })
      blocks.push({ kind: 'page_break' })
    }
    chapters.forEach((ch: any, chIdx: number) => {
      const chTitleClean = cleanEditorialText(String(ch.title || ch.heading || `${tr('Capítulo')} ${chIdx + 1}`), true)
      blocks.push({
        kind: 'chapter_heading',
        tocKey: `ch-${chIdx}`,
        moduleNumber: chIdx + 1,
        text: chTitleClean
      })
      if (Array.isArray(ch.objectives) && ch.objectives.length > 0) {
        blocks.push({
          kind: 'callout',
          text: `${tr('Objetivos:')}\n${ch.objectives.map((o: any) => `- ${cleanEditorialText(String(o))}`).join('\n')}`
        })
      }
      const chIntro = ch.summary || ch.body || ch.content || ch.text || ch.description
      if (typeof chIntro === 'string' && chIntro.trim()) {
        blocks.push({ kind: 'paragraph', text: cleanEditorialText(chIntro.trim()) })
      }
      const chBullets = ch.bullets || ch.keyPoints
      if (Array.isArray(chBullets)) {
        for (const b of chBullets) blocks.push({ kind: 'bullet', text: cleanEditorialText(String(b)) })
      }
      const chSections = Array.isArray(ch.sections) ? ch.sections : Array.isArray(ch.topics) ? ch.topics : []
      let secCounter = 0
      let tableCounter = 0
      let figureCounter = 0
      let hasModuleDiagram = false
      for (const sec of chSections) {
        if (typeof sec === 'string') {
          blocks.push({ kind: 'paragraph', text: cleanEditorialText(sec) })
          continue
        }
        secCounter++
        const rawSecHeading = cleanEditorialText(String(sec.heading || sec.title || sec.name || ''), true)
        const secHeading =
          rawSecHeading && !/^\d+\.\d+\b/.test(rawSecHeading)
            ? `${chIdx + 1}.${secCounter} ${rawSecHeading}`
            : rawSecHeading
        if (secHeading) blocks.push({ kind: 'heading', text: secHeading })
        const secBody = sec.body || sec.content || sec.text || sec.summary || sec.description || ''
        if (secBody) blocks.push({ kind: 'paragraph', text: cleanEditorialText(String(secBody)) })
        if (Array.isArray(sec.bullets)) {
          for (const sb of sec.bullets) blocks.push({ kind: 'bullet', text: cleanEditorialText(String(sb)) })
        }
        if (sec.example) blocks.push({ kind: 'callout', text: `${tr('Exemplo:')}\n${cleanEditorialText(String(sec.example))}` })
        if (sec.callout) blocks.push({ kind: 'callout', text: cleanEditorialText(String(sec.callout)) })
        if (sec.table?.headers && sec.table?.rows) {
          tableCounter++
          const tblLabel = cleanEditorialText(String(sec.table.caption || rawSecHeading || chTitleClean), true)
          blocks.push({
            kind: 'table',
            caption: `${tr('Tabela')} ${chIdx + 1}.${tableCounter}: ${tblLabel}`,
            figureCaption: `${tr('Figura')} ${chIdx + 1}.${++figureCounter}: ${tblLabel}`,
            headers: sec.table.headers,
            rows: sec.table.rows
          })
          hasModuleDiagram = true
        }
        if (sec.comparison && (Array.isArray(sec.comparison.leftItems) || Array.isArray(sec.comparison.rightItems))) {
          blocks.push({
            kind: 'comparison',
            leftTitle: cleanEditorialText(String(sec.comparison.leftTitle || ''), true),
            leftItems: Array.isArray(sec.comparison.leftItems) ? sec.comparison.leftItems.map((x: any) => cleanEditorialText(String(x))) : [],
            rightTitle: cleanEditorialText(String(sec.comparison.rightTitle || ''), true),
            rightItems: Array.isArray(sec.comparison.rightItems) ? sec.comparison.rightItems.map((x: any) => cleanEditorialText(String(x))) : []
          })
        }
        if (Array.isArray(sec.timeline) && sec.timeline.length > 0) {
          figureCounter++
          hasModuleDiagram = true
          blocks.push({
            kind: 'timeline',
            figureCaption: `${tr('Figura')} ${chIdx + 1}.${figureCounter}: ${rawSecHeading || chTitleClean}`,
            timelineItems: sec.timeline.map((it: any) => ({
              step: cleanEditorialText(String(it?.step || it?.title || ''), true),
              detail: cleanEditorialText(String(it?.detail || it?.description || ''))
            }))
          })
        }
        if (Array.isArray(sec.checklist) && sec.checklist.length > 0) {
          blocks.push({
            kind: 'checklist',
            checklistTitle: sec.checklistTitle ? cleanEditorialText(String(sec.checklistTitle), true) : undefined,
            checklistItems: sec.checklist.map((x: any) => cleanEditorialText(String(x)))
          })
        }
      }
      if (!hasModuleDiagram && Array.isArray(ch.objectives) && ch.objectives.length >= 2) {
        figureCounter++
        blocks.push({
          kind: 'concept_map',
          text: chTitleClean,
          options: ch.objectives.map((o: any) => cleanEditorialText(String(o))),
          figureCaption: `${tr('Figura')} ${chIdx + 1}.${figureCounter}: ${chTitleClean}`
        })
      }
      if (Array.isArray(ch.exercises) && ch.exercises.length > 0) {
        blocks.push({ kind: 'heading', text: tr('Exercícios de Fixação') })
        const modAnswers: Array<{ num: number; answer: string }> = []
        ch.exercises.forEach((ex: any, i: number) => {
          const rawQ = String(ex.question || '').replace(/^\d+[\.\)]\s*/, '')
          const parsed = parseExerciseOptions(rawQ, ex.options)
          blocks.push({
            kind: 'exercise',
            exerciseNumber: i + 1,
            text: parsed.question,
            options: parsed.options
          })
          if (ex.answer) {
            modAnswers.push({
              num: i + 1,
              answer: cleanEditorialText(String(ex.answer).replace(/^gabarito\s*:\s*/i, ''))
            })
          }
        })
        if (modAnswers.length > 0) {
          answerKeyGroups.push({
            moduleLabel: `${tr('MÓDULO')} ${String(chIdx + 1).padStart(2, '0')}: ${chTitleClean}`,
            items: modAnswers
          })
        }
      }
    })
    if (answerKeyGroups.length > 0) {
      blocks.push({ kind: 'page_break' })
      blocks.push({ kind: 'heading', tocKey: 'answer_key', text: tr('Gabarito Comentado') })
      for (const grp of answerKeyGroups) {
        blocks.push({ kind: 'subtitle', text: grp.moduleLabel })
        for (const item of grp.items) {
          blocks.push({
            kind: 'answer',
            exerciseNumber: item.num,
            text: `${tr('Gabarito:')} ${item.answer}`
          })
        }
      }
    }
    if (data.conclusion) {
      blocks.push({ kind: 'heading', tocKey: 'conclusion', text: tr('Considerações Finais') })
      blocks.push({ kind: 'paragraph', text: cleanEditorialText(String(data.conclusion)) })
    }
    if (Array.isArray(data.glossary) && data.glossary.length > 0) {
      blocks.push({ kind: 'heading', tocKey: 'glossary', text: tr('Glossário') })
      for (const g of data.glossary) {
        blocks.push({
          kind: 'glossary_item',
          term: String(g.term || ''),
          text: String(g.definition || '')
        })
      }
    }
    if (Array.isArray(data.references) && data.references.length > 0) {
      blocks.push({ kind: 'heading', tocKey: 'references', text: tr('Referências') })
      for (const r of data.references) blocks.push({ kind: 'paragraph', text: String(r) })
    }
    return blocks
  }

  // Resume (ATS) dedicated layout
  if (toolId === 'resume') {
    blocks.push({ kind: 'title', text: String(data.fullName || data.title || tr('Currículo')) })
    if (data.headline || data.subtitle) {
      blocks.push({ kind: 'subtitle', text: String(data.headline || data.subtitle) })
    }
    blocks.push({ kind: 'divider' })
    if (data.summary) {
      blocks.push({ kind: 'heading', text: tr('Resumo Profissional') })
      blocks.push({ kind: 'paragraph', text: String(data.summary) })
    }
    if (Array.isArray(data.experiences) && data.experiences.length > 0) {
      blocks.push({ kind: 'heading', text: tr('Experiência Profissional') })
      for (const exp of data.experiences) {
        if (typeof exp === 'string') {
          blocks.push({ kind: 'bullet', text: exp })
          continue
        }
        const header = [exp?.role, exp?.company].filter(Boolean).join(' | ')
        const period = exp?.period ? ` (${exp.period})` : ''
        if (header) {
          blocks.push({ kind: 'subheading', text: `${header}${period}` })
        }
        if (Array.isArray(exp?.achievements)) {
          for (const ach of exp.achievements) {
            if (ach) blocks.push({ kind: 'bullet', text: String(ach) })
          }
        }
      }
    }
    if (Array.isArray(data.skills) && data.skills.length > 0) {
      blocks.push({ kind: 'heading', text: tr('Competências') })
      blocks.push({ kind: 'paragraph', text: data.skills.map(String).join(' • ') })
    }
    for (const sec of data.sections || []) {
      blocks.push({ kind: 'heading', text: String(sec.heading || sec.title || '') })
      if (sec.body || sec.text) blocks.push({ kind: 'paragraph', text: String(sec.body || sec.text) })
    }
    return blocks
  }

  // Generic structured document (report, lesson_plan, meeting_minutes, contract, faq, newsletter, letterhead)
  blocks.push({ kind: 'title', text: String(data.title || data.documentTitle || data.fullName || tr('Documento')) })
  if (data.subtitle || data.headline || data.gradeAndDuration || data.dateAndParticipants) {
    blocks.push({
      kind: 'subtitle',
      text: String(data.subtitle || data.headline || data.gradeAndDuration || data.dateAndParticipants)
    })
  }
  if (data.executiveSummary || data.summary || data.lead) {
    blocks.push({ kind: 'callout', text: String(data.executiveSummary || data.summary || data.lead) })
  }
  if (Array.isArray(data.parties) && data.parties.length > 0) {
    blocks.push({ kind: 'heading', text: tr('Qualificação das Partes') })
    for (const p of data.parties) blocks.push({ kind: 'paragraph', text: String(p) })
  }
  if (Array.isArray(data.objectives) && data.objectives.length > 0) {
    blocks.push({ kind: 'heading', text: tr('Objetivos de Aprendizagem') })
    for (const obj of data.objectives) blocks.push({ kind: 'bullet', text: String(obj) })
  }
  if (Array.isArray(data.decisions) && data.decisions.length > 0) {
    blocks.push({ kind: 'heading', text: tr('Deliberações') })
    for (const dec of data.decisions) blocks.push({ kind: 'bullet', text: String(dec) })
  }
  if (Array.isArray(data.actionItems) && data.actionItems.length > 0) {
    blocks.push({ kind: 'heading', text: tr('Plano de Ação') })
    blocks.push({
      kind: 'table',
      headers: [tr('Ação'), tr('Responsável'), tr('Prazo')],
      rows: data.actionItems.map((it: any) => [
        String(it?.task || ''),
        String(it?.owner || ''),
        String(it?.deadline || '')
      ])
    })
  }
  if (Array.isArray(data.kpis) && data.kpis.length > 0) {
    blocks.push({
      kind: 'kpi_grid',
      kpis: data.kpis.map((k: any) => ({
        label: String(k.label || ''),
        value: String(k.value || ''),
        trend: k.trend ? String(k.trend) : undefined
      }))
    })
  }
  for (const sec of data.sections || data.clauses || data.blocks || data.stages || []) {
    const baseHeading = String(sec.heading || sec.title || sec.phase || tr('Cláusula {number}', { number: sec.number || '' }))
    const headingWithTime = sec.minutes ? `${baseHeading} (${sec.minutes})` : baseHeading
    blocks.push({ kind: 'heading', text: headingWithTime })
    const secBody = sec.body || sec.text || sec.activity || ''
    if (secBody) blocks.push({ kind: 'paragraph', text: String(secBody) })
    if (sec.resources) blocks.push({ kind: 'bullet', text: `${tr('Recursos')}: ${String(sec.resources)}` })
    if (Array.isArray(sec.bullets)) {
      for (const sb of sec.bullets) blocks.push({ kind: 'bullet', text: String(sb) })
    }
    if (sec.callout) blocks.push({ kind: 'callout', text: String(sec.callout) })
    if (sec.table?.headers && sec.table?.rows) {
      blocks.push({ kind: 'table', headers: sec.table.headers, rows: sec.table.rows })
    }
    if (sec.comparison && (Array.isArray(sec.comparison.leftItems) || Array.isArray(sec.comparison.rightItems))) {
      blocks.push({
        kind: 'comparison',
        leftTitle: String(sec.comparison.leftTitle || ''),
        leftItems: Array.isArray(sec.comparison.leftItems) ? sec.comparison.leftItems.map(String) : [],
        rightTitle: String(sec.comparison.rightTitle || ''),
        rightItems: Array.isArray(sec.comparison.rightItems) ? sec.comparison.rightItems.map(String) : []
      })
    }
    if (Array.isArray(sec.timeline) && sec.timeline.length > 0) {
      blocks.push({
        kind: 'timeline',
        timelineItems: sec.timeline.map((it: any) => ({
          step: String(it?.step || it?.title || ''),
          detail: String(it?.detail || it?.description || '')
        }))
      })
    }
    if (Array.isArray(sec.checklist) && sec.checklist.length > 0) {
      blocks.push({
        kind: 'checklist',
        checklistTitle: sec.checklistTitle ? String(sec.checklistTitle) : undefined,
        checklistItems: sec.checklist.map(String)
      })
    }
  }
  if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
    blocks.push({ kind: 'heading', text: tr('Recomendações') })
    for (const r of data.recommendations) blocks.push({ kind: 'bullet', text: String(r) })
  }
  if (Array.isArray(data.items) && data.items.length > 0) {
    for (const item of data.items) {
      blocks.push({ kind: 'heading', text: String(item.question || '') })
      blocks.push({ kind: 'paragraph', text: String(item.answer || '') })
    }
  }
  if (data.assessment) {
    blocks.push({ kind: 'heading', text: tr('Avaliação') })
    blocks.push({ kind: 'paragraph', text: String(data.assessment) })
  }
  if (Array.isArray(data.paragraphs) && data.paragraphs.length > 0 && !(data.sections?.length)) {
    for (const p of data.paragraphs) blocks.push({ kind: 'paragraph', text: String(p) })
  }
  if (data.signatureBlock) {
    blocks.push({ kind: 'signature', text: String(data.signatureBlock) })
  }
  return blocks
}

export interface DocumentImageAttachment {
  name: string
  base64: string
  caption?: string
}

export async function renderDocxAndPdf(opts: {
  toolId: ToolId
  template: TemplateManifest
  tokens: DesignTokens
  data: Record<string, any>
  brandKit?: BrandKit | null
  attachments?: DocumentImageAttachment[]
  locale?: string
}): Promise<{
  docxBuffer: Buffer
  pdfBuffer: Buffer
  previewSvgs: string[]
  qaReport: VisualQAReport
}> {
  const tr = (text: string, vars?: Record<string, string | number>) =>
    translateCore(normalizeLocale(opts.locale), text, vars)
  const blocks = buildDocumentBlocks(opts.toolId, opts.data, opts.brandKit, opts.locale)
  const attachmentsHeading = tr('Anexos')
  const isAbnt = opts.toolId === 'abnt'
  const primaryHex = opts.tokens.primary.replace('#', '')
  const textHex = opts.tokens.textPrimary.replace('#', '')
  const fontBody = opts.tokens.bodyFont || (isAbnt ? 'Liberation Serif' : 'Inter')

  // 1. Build native editable DOCX
  const docChildren: Array<Paragraph | Table> = []
  for (const b of blocks) {
    if (b.kind === 'page_break') {
      docChildren.push(new Paragraph({ children: [new PageBreak()] }))
    } else if (b.kind === 'cover') {
      if (b.institution) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: b.institution.toUpperCase(), bold: true, size: 22, color: textHex, font: fontBody })]
          })
        )
      }
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 220 },
          children: [new TextRun({ text: b.text || '', bold: true, size: 44, color: primaryHex, font: fontBody })]
        })
      )
      if (b.subtitle) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [new TextRun({ text: b.subtitle, italics: true, size: 24, color: '475569', font: fontBody })]
          })
        )
      }
      if (b.presentation) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 480, after: 120 },
            children: [new TextRun({ text: tr('Apresentação'), bold: true, size: 24, color: primaryHex, font: fontBody })]
          }),
          new Paragraph({
            spacing: { after: 200, line: 276 },
            children: [new TextRun({ text: b.presentation, size: 22, color: textHex, font: fontBody })]
          })
        )
      }
    } else if (b.kind === 'presentation_page' && b.text) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 120, after: 180 },
          children: [new TextRun({ text: tr('Apresentação'), bold: true, size: 32, color: primaryHex, font: fontBody })]
        }),
        new Paragraph({
          spacing: { after: 200, line: 276 },
          children: [new TextRun({ text: b.text, size: 22, color: textHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'toc') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 120, after: 240 },
          children: [new TextRun({ text: b.text || tr('Sumário'), bold: true, size: 32, color: primaryHex, font: fontBody })]
        })
      )
      for (const item of b.tocItems || []) {
        docChildren.push(
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: item, size: 22, color: textHex, font: fontBody })]
          })
        )
      }
    } else if (b.kind === 'chapter_heading') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 320, after: 140 },
          keepNext: true,
          children: [
            new TextRun({
              text: `${b.moduleNumber ? `${String(b.moduleNumber).padStart(2, '0')} · ` : ''}${b.text || ''}`,
              bold: true,
              size: 28,
              color: primaryHex,
              font: fontBody
            })
          ]
        })
      )
    } else if (b.kind === 'title') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: isAbnt ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 200 },
          children: [new TextRun({ text: b.text || '', bold: true, size: isAbnt ? 28 : 36, color: primaryHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'subtitle') {
      docChildren.push(
        new Paragraph({
          alignment: isAbnt ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 180 },
          children: [new TextRun({ text: b.text || '', italics: true, size: 22, color: '475569', font: fontBody })]
        })
      )
    } else if (b.kind === 'heading') {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          keepNext: true,
          children: [new TextRun({ text: b.text || '', bold: true, size: 24, color: primaryHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'quote') {
      docChildren.push(
        new Paragraph({
          indent: { left: 2268 }, // ABNT 4cm = 2268 twips
          spacing: { after: 140, line: 240 },
          children: [new TextRun({ text: b.text || '', size: 20, color: textHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'callout') {
      docChildren.push(
        new Paragraph({
          indent: { left: 360, right: 360 },
          spacing: { before: 120, after: 160 },
          children: [new TextRun({ text: b.text || '', bold: true, size: 22, color: primaryHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'bullet') {
      docChildren.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 100 },
          children: [new TextRun({ text: b.text || '', size: 22, color: textHex, font: fontBody })]
        })
      )
    } else if (b.kind === 'kpi_grid' && Array.isArray(b.kpis)) {
      const kpiRows = [
        new TableRow({
          tableHeader: true,
          children: [tr('Indicador'), tr('Valor'), tr('Tendência')].map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: primaryHex })] })]
              })
          )
        }),
        ...b.kpis.map(
          (k) =>
            new TableRow({
              children: [k.label, k.value, k.trend || '-'].map(
                (c) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, color: textHex })] })]
                  })
              )
            })
        )
      ]
      docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: kpiRows }))
    } else if (b.kind === 'table' && b.headers && b.rows) {
      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: b.headers.map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: primaryHex })] })]
              })
          )
        }),
        ...b.rows.map(
          (r) =>
            new TableRow({
              children: r.map(
                (c) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, color: textHex })] })]
                  })
              )
            })
        )
      ]
      docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }))
    } else if (b.kind === 'comparison') {
      const leftParas = [
        ...(b.leftTitle
          ? [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.leftTitle, bold: true, size: 22, color: primaryHex, font: fontBody })] })]
          : []),
        ...(b.leftItems || []).map(
          (item) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: item, size: 20, color: textHex, font: fontBody })] })
        )
      ]
      const rightParas = [
        ...(b.rightTitle
          ? [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.rightTitle, bold: true, size: 22, color: primaryHex, font: fontBody })] })]
          : []),
        ...(b.rightItems || []).map(
          (item) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: item, size: 20, color: textHex, font: fontBody })] })
        )
      ]
      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: leftParas.length ? leftParas : [new Paragraph('')] }),
                new TableCell({ children: rightParas.length ? rightParas : [new Paragraph('')] })
              ]
            })
          ]
        })
      )
    } else if (b.kind === 'timeline' && Array.isArray(b.timelineItems)) {
      b.timelineItems.forEach((it, idx) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [new TextRun({ text: `${idx + 1}. ${it.step}`, bold: true, size: 22, color: primaryHex, font: fontBody })]
          })
        )
        if (it.detail) {
          docChildren.push(
            new Paragraph({
              indent: { left: 360 },
              spacing: { after: 100 },
              children: [new TextRun({ text: it.detail, size: 20, color: textHex, font: fontBody })]
            })
          )
        }
      })
    } else if (b.kind === 'checklist' && Array.isArray(b.checklistItems)) {
      if (b.checklistTitle) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [new TextRun({ text: b.checklistTitle, bold: true, size: 22, color: primaryHex, font: fontBody })]
          })
        )
      }
      for (const item of b.checklistItems) {
        docChildren.push(
          new Paragraph({
            indent: { left: 240 },
            spacing: { after: 80 },
            children: [new TextRun({ text: `✓ ${item}`, size: 20, color: textHex, font: fontBody })]
          })
        )
      }
    } else if (b.kind === 'exercise') {
      docChildren.push(
        new Paragraph({
          spacing: { before: 100, after: 60 },
          children: [
            new TextRun({
              text: `${b.exerciseNumber ? `${String(b.exerciseNumber).padStart(2, '0')}. ` : ''}${b.text || ''}`,
              bold: true,
              size: 22,
              color: textHex,
              font: fontBody
            })
          ]
        })
      )
      for (const opt of b.options || []) {
        docChildren.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { after: 40 },
            children: [new TextRun({ text: opt, size: 21, color: textHex, font: fontBody })]
          })
        )
      }
    } else if (b.kind === 'answer' && b.text) {
      docChildren.push(
        new Paragraph({
          indent: { left: 280 },
          spacing: { after: 140, line: 276 },
          children: [new TextRun({ text: b.text, italics: true, size: 21, color: '334155', font: fontBody })]
        })
      )
    } else if (b.kind === 'glossary_item') {
      docChildren.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 100 },
          children: [
            new TextRun({ text: b.term ? `${b.term}: ` : '', bold: true, size: 22, color: primaryHex, font: fontBody }),
            new TextRun({ text: b.text || '', size: 22, color: textHex, font: fontBody })
          ]
        })
      )
    } else if (b.text) {
      docChildren.push(
        new Paragraph({
          alignment: isAbnt ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
          spacing: { after: 140, line: isAbnt ? 360 : 276 },
          children: [new TextRun({ text: b.text, size: 24, color: textHex, font: fontBody })]
        })
      )
    }
  }

  const validAttachments = (opts.attachments || []).filter((att) =>
    /^data:image\/(png|jpe?g);base64,/i.test(att.base64 || '')
  )
  if (validAttachments.length > 0) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 160 },
        keepNext: true,
        children: [new TextRun({ text: attachmentsHeading, bold: true, size: 24, color: primaryHex, font: fontBody })]
      })
    )
    for (const att of validAttachments) {
      const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(att.base64)
      if (!match) continue
      const type = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
      const imgData = Buffer.from(match[2], 'base64')
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 80 },
          children: [
            new ImageRun({
              data: imgData,
              type,
              transformation: { width: 420, height: 260 }
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: att.caption || att.name,
              italics: true,
              size: 18,
              color: '64748B',
              font: fontBody
            })
          ]
        })
      )
    }
  }

  const headerLogoDataUrl = opts.brandKit?.headerLogoDataUrl || opts.brandKit?.logoDataUrl || ''
  const footerLogoDataUrl = opts.brandKit?.footerLogoDataUrl || opts.brandKit?.logoDataUrl || ''
  const logoPlacement = opts.brandKit?.logoPlacement || 'header'
  const showLogoInHeader =
    Boolean(headerLogoDataUrl) &&
    (opts.brandKit?.logoInHeader !== undefined
      ? Boolean(opts.brandKit.logoInHeader)
      : opts.brandKit?.headerLogoDataUrl
        ? true
        : logoPlacement === 'header' || logoPlacement === 'both')
  const showLogoInFooter =
    Boolean(footerLogoDataUrl) &&
    (opts.brandKit?.logoInFooter !== undefined
      ? Boolean(opts.brandKit.logoInFooter)
      : opts.brandKit?.footerLogoDataUrl
        ? true
        : logoPlacement === 'footer' || logoPlacement === 'both')
  const headerText = opts.brandKit?.headerText || opts.brandKit?.institutionName || ''
  const footerText = opts.brandKit?.footerText || ''
  const headerAlign = opts.brandKit?.headerAlign || 'right'
  const footerAlign = opts.brandKit?.footerAlign || 'right'
  const toDocxAlign = (a: 'left' | 'center' | 'right') =>
    a === 'left' ? AlignmentType.LEFT : a === 'center' ? AlignmentType.CENTER : AlignmentType.RIGHT

  const makeLogoRun = (dataUrl: string) => {
    if (!dataUrl) return null
    try {
      const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl)
      if (!match) return null
      const type = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
      const data = Buffer.from(match[2], 'base64')
      return new ImageRun({
        data,
        type,
        transformation: { width: 72, height: 28 }
      })
    } catch {
      return null
    }
  }

  const headerRuns: any[] = []
  if (showLogoInHeader) {
    const imgRun = makeLogoRun(headerLogoDataUrl)
    if (imgRun) headerRuns.push(imgRun)
  }
  if (headerText) {
    headerRuns.push(new TextRun({ text: headerRuns.length > 0 ? `   ${headerText}` : headerText, size: 18, color: '64748B' }))
  }

  const footerRuns: any[] = []
  if (showLogoInFooter) {
    const imgRun = makeLogoRun(footerLogoDataUrl)
    if (imgRun) footerRuns.push(imgRun)
  }
  footerRuns.push(
    new TextRun({
      text: footerText ? `${footerRuns.length > 0 ? '   ' : ''}${footerText}  |  ` : footerRuns.length > 0 ? '  |  ' : '',
      size: 16,
      color: '64748B'
    }),
    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B' })
  )

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: isAbnt
              ? { top: 1701, left: 1701, bottom: 1134, right: 1134 } // 3cm / 2cm
              : { top: 1440, left: 1440, bottom: 1440, right: 1440 }
          }
        },
        headers:
          headerRuns.length > 0
            ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: toDocxAlign(headerAlign),
                    children: headerRuns
                  })
                ]
              })
            }
            : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: toDocxAlign(footerAlign),
                children: footerRuns
              })
            ]
          })
        },
        children: docChildren
      }
    ]
  })
  const docxBuffer = Buffer.from(await Packer.toBuffer(doc))

  // 2. Build matching PDF + SVG previews + VisualQA metrics
  const pdfDoc = await PDFDocument.create()
  const useSerif =
    isAbnt || /merriweather|georgia|times|serif|garamond|playfair/i.test(`${opts.tokens.headingFont} ${opts.tokens.bodyFont}`)
  const regularFont = await pdfDoc.embedFont(useSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(useSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold)
  const italicFont = await pdfDoc.embedFont(useSerif ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique)
  const svgFontFamily = useSerif ? 'Georgia, Times New Roman, serif' : 'Inter, Helvetica, sans-serif'
  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginLeft = isAbnt ? 85 : 54
  const marginRight = isAbnt ? 57 : 54
  const marginTop = isAbnt ? 85 : 64
  const marginBottom = isAbnt ? 57 : 58
  const usableWidth = pageWidth - marginLeft - marginRight

  const primaryC = hexRgb01(opts.tokens.primary)
  const accentC = hexRgb01(opts.tokens.accent)
  const borderC = hexRgb01(opts.tokens.border)
  const textC = hexRgb01(opts.tokens.textPrimary)
  const mutedC = hexRgb01(opts.tokens.textMuted)
  const pdfPrimary = rgb(primaryC.r, primaryC.g, primaryC.b)
  const pdfAccent = rgb(accentC.r, accentC.g, accentC.b)
  const pdfBorder = rgb(borderC.r, borderC.g, borderC.b)
  const pdfMuted = rgb(mutedC.r, mutedC.g, mutedC.b)
  const pdfSoftTint = rgb(
    Math.min(1, accentC.r * 0.08 + 0.92),
    Math.min(1, accentC.g * 0.08 + 0.92),
    Math.min(1, accentC.b * 0.08 + 0.92)
  )
  const pdfPrimaryTint = rgb(
    Math.min(1, primaryC.r * 0.06 + 0.94),
    Math.min(1, primaryC.g * 0.06 + 0.94),
    Math.min(1, primaryC.b * 0.06 + 0.94)
  )
  const pdfText = rgb(textC.r, textC.g, textC.b)

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let cursorY = pageHeight - marginTop
  const svgPages: string[][] = [[]]
  const qaMetrics: VisualPageMetric[] = []
  let currentUsedY = 0
  let currentModuleLabel = ''
  const pageModuleLabels: string[] = ['']
  const tocPageMap: Record<string, number> = {}
  let pendingToc: {
    page: typeof page
    svgIndex: number
    heading: string
    entries: TocEntryItem[]
  } | null = null

  const startNewPage = () => {
    qaMetrics.push({
      index: svgPages.length - 1,
      label: translateCore(normalizeLocale(opts.locale), 'Página {number}', { number: svgPages.length }),
      fillRatio: Math.min(1, currentUsedY / (pageHeight - marginTop - marginBottom)),
      overflowChars: 0
    })
    page = pdfDoc.addPage([pageWidth, pageHeight])
    cursorY = pageHeight - marginTop
    currentUsedY = 0
    svgPages.push([])
    pageModuleLabels.push(currentModuleLabel)
  }

  const coverPreset = opts.template.layoutPreset || 'classic'

  for (const b of blocks) {
    if (b.kind === 'page_break') {
      startNewPage()
      continue
    }
    if (b.tocKey) {
      tocPageMap[b.tocKey] = pdfDoc.getPageCount()
    }
    if (b.kind === 'cover') {
      const isLeftAlignedCover = coverPreset === 'modern' || coverPreset === 'executive' || coverPreset === 'editorial'
      if (isLeftAlignedCover) {
        const rawSource = b.institution || b.text || 'MD'
        const initials = toWinAnsiSafe(rawSource)
          .split(/\s+/)
          .filter((w) => w.length > 2 || rawSource.split(/\s+/).length <= 2)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('') || 'MD'

        let topSvg = ''
        if (showLogoInHeader && headerLogoDataUrl) {
          topSvg += `<image href="${escapeXml(headerLogoDataUrl)}" x="${marginLeft}" y="44" width="44" height="44" preserveAspectRatio="xMidYMid meet" />`
        } else {
          topSvg +=
            `<rect x="${marginLeft}" y="44" width="44" height="44" rx="10" fill="${opts.tokens.primary}" />` +
            `<text x="${marginLeft + 22}" y="71" text-anchor="middle" font-family="${svgFontFamily}" font-size="15" font-weight="700" fill="#FFFFFF">${escapeXml(initials)}</text>`
        }

        const metaX = marginLeft + 58
        const badgeStr = toWinAnsiSafe((b.badgeLabel || (opts.toolId === 'apostila' ? tr('Apostila Didática') : '')).toUpperCase())
        if (b.institution) {
          topSvg += `<text x="${metaX}" y="60" font-family="${svgFontFamily}" font-size="10" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(b.institution.toUpperCase())}</text>`
        }
        if (badgeStr) {
          const bw = Math.min(usableWidth - 80, boldFont.widthOfTextAtSize(badgeStr, 8.5) + 22)
          const by = b.institution ? 66 : 56
          topSvg +=
            `<rect x="${metaX}" y="${by}" width="${bw.toFixed(1)}" height="20" rx="6" fill="${opts.tokens.surfaceAlt}" />` +
            `<text x="${(metaX + 11).toFixed(1)}" y="${by + 13}" font-family="${svgFontFamily}" font-size="8.5" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(badgeStr)}</text>`
        }
        topSvg += `<line x1="${marginLeft}" y1="108" x2="${pageWidth - marginRight}" y2="108" stroke="${opts.tokens.border}" stroke-width="0.9" />`

        const titleLines = wrapTextToLines(b.text || '', boldFont, 26, usableWidth - 20)
        let midY = 345
        let midSvg = ''
        for (const tl of titleLines) {
          midSvg += `<text x="${marginLeft}" y="${midY}" font-family="${svgFontFamily}" font-size="26" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(tl)}</text>`
          midY += 34
        }
        midSvg += `<rect x="${marginLeft}" y="${midY - 12}" width="52" height="4" rx="2" fill="${opts.tokens.accent}" />`
        midY += 16
        if (b.subtitle) {
          const subLines = wrapTextToLines(b.subtitle, regularFont, 12, usableWidth - 20)
          for (const sl of subLines) {
            midSvg += `<text x="${marginLeft}" y="${midY}" font-family="${svgFontFamily}" font-size="12" fill="${opts.tokens.textMuted}">${escapeXml(sl)}</text>`
            midY += 18
          }
        }

        const motifCx = pageWidth / 2
        const motifCy = Math.max(midY + 64, 535)
        const motifSvg =
          `<circle cx="${motifCx}" cy="${motifCy}" r="32" fill="${opts.tokens.surfaceAlt}" />` +
          `<path d="M${motifCx - 110} ${motifCy + 4} Q${motifCx - 55} ${motifCy - 14} ${motifCx} ${motifCy} T${motifCx + 110} ${motifCy - 4}" fill="none" stroke="${opts.tokens.accent}" stroke-width="1" stroke-dasharray="3 3" opacity="0.55" />` +
          `<rect x="${motifCx - 16}" y="${motifCy - 12}" width="15" height="22" rx="2" fill="none" stroke="${opts.tokens.primary}" stroke-width="1.6" />` +
          `<rect x="${motifCx + 1}" y="${motifCy - 12}" width="15" height="22" rx="2" fill="none" stroke="${opts.tokens.primary}" stroke-width="1.6" />`

        svgPages[svgPages.length - 1].push(topSvg + midSvg + motifSvg)
      }
      if (coverPreset === 'editorial' || coverPreset === 'academic') {
        page.drawRectangle({ x: marginLeft, y: pageHeight - 44, width: usableWidth, height: 1.5, color: pdfPrimary })
        if (!isLeftAlignedCover) {
          svgPages[svgPages.length - 1].push(
            `<rect x="${marginLeft}" y="44" width="${usableWidth}" height="1.5" fill="${opts.tokens.primary}" />`
          )
        }
      } else if (coverPreset === 'whiteboard' || coverPreset === 'playful') {
        page.drawRectangle({ x: 0, y: pageHeight - 294, width: pageWidth, height: 294, color: pdfPrimaryTint })
        page.drawRectangle({ x: 0, y: pageHeight - 297, width: pageWidth, height: 3, color: pdfAccent })
        page.drawRectangle({
          x: 20,
          y: 20,
          width: pageWidth - 40,
          height: pageHeight - 40,
          borderColor: pdfBorder,
          borderWidth: 0.8
        })
        svgPages[svgPages.length - 1].push(
          `<rect x="0" y="0" width="${pageWidth}" height="294" fill="${opts.tokens.surfaceAlt}" />` +
          `<rect x="0" y="294" width="${pageWidth}" height="3" fill="${opts.tokens.accent}" />` +
          `<rect x="20" y="20" width="${pageWidth - 40}" height="${pageHeight - 40}" rx="8" fill="none" stroke="${opts.tokens.border}" stroke-width="0.8" />`
        )
      } else if (coverPreset === 'minimal') {
        page.drawRectangle({ x: marginLeft, y: pageHeight - 36, width: usableWidth, height: 2, color: pdfPrimary })
        page.drawRectangle({ x: marginLeft, y: 32, width: usableWidth, height: 1, color: pdfBorder })
        svgPages[svgPages.length - 1].push(
          `<rect x="${marginLeft}" y="34" width="${usableWidth}" height="2" fill="${opts.tokens.primary}" />` +
          `<rect x="${marginLeft}" y="${pageHeight - 33}" width="${usableWidth}" height="1" fill="${opts.tokens.border}" />`
        )
      } else {
        page.drawRectangle({ x: 0, y: pageHeight - 16, width: pageWidth, height: 16, color: pdfPrimary })
        page.drawRectangle({ x: 0, y: pageHeight - 20, width: pageWidth, height: 4, color: pdfAccent })
        page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 8, color: pdfPrimary })
        if (!isLeftAlignedCover) {
          svgPages[svgPages.length - 1].push(
            `<rect x="0" y="0" width="${pageWidth}" height="16" fill="${opts.tokens.primary}" />` +
            `<rect x="0" y="16" width="${pageWidth}" height="4" fill="${opts.tokens.accent}" />` +
            `<rect x="0" y="${pageHeight - 8}" width="${pageWidth}" height="8" fill="${opts.tokens.primary}" />`
          )
        }
      }
      let cy = pageHeight - 82
      let drewLogo = false
      if (showLogoInHeader && headerLogoDataUrl) {
        try {
          const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(headerLogoDataUrl)
          if (m) {
            const imgBytes = Buffer.from(m[2], 'base64')
            const embedded = m[1].toLowerCase() === 'png' ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
            const scale = Math.min(88 / embedded.width, 88 / embedded.height, 1)
            const lw = embedded.width * scale
            const lh = embedded.height * scale
            const lx = (pageWidth - lw) / 2
            const ly = cy - lh
            page.drawImage(embedded, { x: lx, y: ly, width: lw, height: lh })
            if (!isLeftAlignedCover) {
              svgPages[svgPages.length - 1].push(
                `<image href="${escapeXml(headerLogoDataUrl)}" x="${lx.toFixed(1)}" y="${(pageHeight - cy).toFixed(1)}" width="${lw.toFixed(1)}" height="${lh.toFixed(1)}" preserveAspectRatio="xMidYMid meet" />`
              )
            }
            cy = ly - 26
            drewLogo = true
          }
        } catch { }
      }
      if (!drewLogo && (b.institution || opts.toolId === 'apostila')) {
        const rawSource = b.institution || b.text || 'MD'
        const initials = toWinAnsiSafe(rawSource)
          .split(/\s+/)
          .filter((w) => w.length > 2 || rawSource.split(/\s+/).length <= 2)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('') || 'MD'
        const emblemCx = pageWidth / 2
        const emblemCy = cy - 26
        page.drawCircle({ x: emblemCx, y: emblemCy, size: 26, color: pdfSoftTint, borderColor: pdfAccent, borderWidth: 1.5 })
        const initW = boldFont.widthOfTextAtSize(initials, 15)
        page.drawText(initials, { x: emblemCx - initW / 2, y: emblemCy - 5.5, size: 15, font: boldFont, color: pdfPrimary })
        if (!isLeftAlignedCover) {
          svgPages[svgPages.length - 1].push(
            `<circle cx="${emblemCx.toFixed(1)}" cy="${(pageHeight - emblemCy).toFixed(1)}" r="26" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.accent}" stroke-width="1.5" />` +
            `<text x="${emblemCx.toFixed(1)}" y="${(pageHeight - emblemCy + 5.5).toFixed(1)}" text-anchor="middle" font-family="${svgFontFamily}" font-size="15" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(initials)}</text>`
          )
        }
        cy = emblemCy - 44
      }
      if (b.institution) {
        const instLines = wrapTextToLines(b.institution.toUpperCase(), boldFont, 10, usableWidth)
        for (const il of instLines) {
          const iw = boldFont.widthOfTextAtSize(il, 10)
          const ix = (pageWidth - iw) / 2
          page.drawText(il, { x: ix, y: cy, size: 10, font: boldFont, color: pdfAccent })
          if (!isLeftAlignedCover) {
            svgPages[svgPages.length - 1].push(
              `<text x="${(pageWidth / 2).toFixed(1)}" y="${(pageHeight - cy + 10).toFixed(1)}" text-anchor="middle" font-family="${svgFontFamily}" font-size="10" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(il)}</text>`
            )
          }
          cy -= 15
        }
        cy -= 8
      }
      const badgeStr = toWinAnsiSafe((b.badgeLabel || (opts.toolId === 'apostila' ? tr('Apostila Didática') : '')).toUpperCase())
      if (badgeStr) {
        const bw = Math.min(usableWidth - 40, boldFont.widthOfTextAtSize(badgeStr, 8.5) + 24)
        const bx = (pageWidth - bw) / 2
        const by = cy - 18
        page.drawRectangle({ x: bx, y: by, width: bw, height: 20, color: pdfSoftTint, borderColor: pdfAccent, borderWidth: 0.7 })
        const tw = boldFont.widthOfTextAtSize(badgeStr, 8.5)
        page.drawText(badgeStr, { x: (pageWidth - tw) / 2, y: by + 6.5, size: 8.5, font: boldFont, color: pdfAccent })
        if (!isLeftAlignedCover) {
          svgPages[svgPages.length - 1].push(
            `<rect x="${bx.toFixed(1)}" y="${(pageHeight - by - 20).toFixed(1)}" width="${bw.toFixed(1)}" height="20" rx="10" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.accent}" stroke-width="0.8" />` +
            `<text x="${(pageWidth / 2).toFixed(1)}" y="${(pageHeight - by - 6.5).toFixed(1)}" text-anchor="middle" font-family="${svgFontFamily}" font-size="8.5" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(badgeStr)}</text>`
          )
        }
        cy = by - 26
      }
      const titleLines = wrapTextToLines(b.text || '', boldFont, 24, usableWidth - 24)
      for (const tl of titleLines) {
        const tw = boldFont.widthOfTextAtSize(tl, 24)
        const tx = (pageWidth - tw) / 2
        page.drawText(tl, { x: tx, y: cy, size: 24, font: boldFont, color: pdfPrimary })
        if (!isLeftAlignedCover) {
          svgPages[svgPages.length - 1].push(
            `<text x="${(pageWidth / 2).toFixed(1)}" y="${(pageHeight - cy + 24).toFixed(1)}" text-anchor="middle" font-family="${svgFontFamily}" font-size="24" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(tl)}</text>`
          )
        }
        cy -= 32
      }
      cy -= 6
      const barW = 72
      page.drawRectangle({ x: (pageWidth - barW) / 2, y: cy, width: barW, height: 3, color: pdfAccent })
      if (!isLeftAlignedCover) {
        svgPages[svgPages.length - 1].push(
          `<rect x="${((pageWidth - barW) / 2).toFixed(1)}" y="${(pageHeight - cy).toFixed(1)}" width="${barW}" height="3" rx="1.5" fill="${opts.tokens.accent}" />`
        )
      }
      cy -= 24
      if (b.subtitle) {
        const subLines = wrapTextToLines(b.subtitle, regularFont, 12, usableWidth - 40)
        for (const sl of subLines) {
          const sw = regularFont.widthOfTextAtSize(sl, 12)
          page.drawText(sl, { x: (pageWidth - sw) / 2, y: cy, size: 12, font: regularFont, color: pdfMuted })
          if (!isLeftAlignedCover) {
            svgPages[svgPages.length - 1].push(
              `<text x="${(pageWidth / 2).toFixed(1)}" y="${(pageHeight - cy + 12).toFixed(1)}" text-anchor="middle" font-family="${svgFontFamily}" font-size="12" fill="${opts.tokens.textMuted}">${escapeXml(sl)}</text>`
            )
          }
          cy -= 18
        }
        cy -= 12
      }

      const presLines = b.presentation ? wrapTextToLines(b.presentation, regularFont, 10.2, usableWidth - 32) : []
      const presBoxH = presLines.length > 0 ? presLines.length * 15 + 42 : 0
      const presTopY = marginBottom + presBoxH + 22

      if (Array.isArray(b.studentFields) && b.studentFields.length > 0) {
        const fields = b.studentFields.slice(0, 4)
        const cardH = fields.length * 24 + 34
        const availableTop = cy - 12
        const cardTopY = Math.max(presTopY + cardH + 16, Math.min(availableTop, presTopY + cardH + 46))
        if (cardTopY - cardH > presTopY + 8) {
          const cardBottomY = cardTopY - cardH
          page.drawRectangle({
            x: marginLeft,
            y: cardBottomY,
            width: usableWidth,
            height: cardH,
            color: pdfPrimaryTint,
            borderColor: pdfBorder,
            borderWidth: 0.7
          })
          svgPages[svgPages.length - 1].push(
            `<rect x="${marginLeft}" y="${(pageHeight - cardTopY).toFixed(1)}" width="${usableWidth}" height="${cardH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.8" />`
          )
          const idTitle = toWinAnsiSafe(tr('Identificação do Estudante').toUpperCase())
          page.drawText(idTitle, { x: marginLeft + 14, y: cardTopY - 18, size: 8.5, font: boldFont, color: pdfAccent })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 14}" y="${(pageHeight - (cardTopY - 18)).toFixed(1)}" font-family="${svgFontFamily}" font-size="8.5" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(idTitle)}</text>`
          )
          fields.forEach((fieldLabel, fIdx) => {
            const fy = cardTopY - 38 - fIdx * 24
            const cleanLabel = `${toWinAnsiSafe(fieldLabel)}:`
            const lw = boldFont.widthOfTextAtSize(cleanLabel, 9.5)
            page.drawText(cleanLabel, { x: marginLeft + 14, y: fy, size: 9.5, font: boldFont, color: pdfPrimary })
            const lineStartX = marginLeft + 14 + lw + 8
            const lineEndX = marginLeft + usableWidth - 14
            if (lineEndX > lineStartX + 20) {
              page.drawLine({ start: { x: lineStartX, y: fy - 2 }, end: { x: lineEndX, y: fy - 2 }, thickness: 0.7, color: pdfBorder })
              svgPages[svgPages.length - 1].push(
                `<text x="${marginLeft + 14}" y="${(pageHeight - fy).toFixed(1)}" font-family="${svgFontFamily}" font-size="9.5" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(cleanLabel)}</text>` +
                `<line x1="${lineStartX.toFixed(1)}" y1="${(pageHeight - fy + 2).toFixed(1)}" x2="${lineEndX.toFixed(1)}" y2="${(pageHeight - fy + 2).toFixed(1)}" stroke="${opts.tokens.border}" stroke-width="0.8" />`
              )
            }
          })
        }
      }

      if (presLines.length > 0) {
        const boxTopY = presTopY
        const boxBottomY = boxTopY - presBoxH
        page.drawRectangle({
          x: marginLeft,
          y: boxBottomY,
          width: usableWidth,
          height: presBoxH,
          color: pdfSoftTint,
          borderColor: pdfBorder,
          borderWidth: 0.7
        })
        page.drawRectangle({ x: marginLeft, y: boxBottomY, width: 3.5, height: presBoxH, color: pdfAccent })
        svgPages[svgPages.length - 1].push(
          `<rect x="${marginLeft}" y="${(pageHeight - boxTopY).toFixed(1)}" width="${usableWidth}" height="${presBoxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.8" />` +
          `<rect x="${marginLeft}" y="${(pageHeight - boxTopY).toFixed(1)}" width="3.5" height="${presBoxH.toFixed(1)}" rx="1.5" fill="${opts.tokens.accent}" />`
        )
        const presTitle = tr('Apresentação')
        page.drawText(presTitle, { x: marginLeft + 16, y: boxTopY - 20, size: 11, font: boldFont, color: pdfPrimary })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft + 16}" y="${(pageHeight - (boxTopY - 20)).toFixed(1)}" font-family="${svgFontFamily}" font-size="11" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(presTitle)}</text>`
        )
        presLines.forEach((pl, idx) => {
          const ly = boxTopY - 38 - idx * 15
          page.drawText(pl, { x: marginLeft + 16, y: ly, size: 10.2, font: regularFont, color: pdfText })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 16}" y="${(pageHeight - ly).toFixed(1)}" font-family="${svgFontFamily}" font-size="10.2" fill="${opts.tokens.textPrimary}">${escapeXml(pl)}</text>`
          )
        })
      }
      currentUsedY = pageHeight - marginTop - marginBottom
      continue
    }

    if (b.kind === 'toc') {
      const entries: TocEntryItem[] =
        b.tocEntries && b.tocEntries.length > 0
          ? b.tocEntries
          : (b.tocItems || []).map((t, i) => ({ key: `item-${i}`, badge: String(i + 1).padStart(2, '0'), label: t }))
      pendingToc = {
        page,
        svgIndex: svgPages.length - 1,
        heading: b.text || tr('Sumário'),
        entries
      }
      currentUsedY = Math.min(pageHeight - marginTop - marginBottom, entries.length * 32 + 72)
      continue
    }

    if (b.kind === 'chapter_heading') {
      const modLabel = b.moduleNumber ? `${tr('MÓDULO')} ${String(b.moduleNumber).padStart(2, '0')}` : ''
      currentModuleLabel = modLabel ? `${modLabel}  •  ${b.text || ''}` : b.text || ''
      pageModuleLabels[pageModuleLabels.length - 1] = currentModuleLabel
      const chLines = wrapTextToLines(b.text || '', boldFont, 17, usableWidth - 16)
      const usablePageHeight = pageHeight - marginTop - marginBottom
      const minChapterBlock = chLines.length * 22 + 180
      if (currentUsedY > usablePageHeight * 0.5 || cursorY - minChapterBlock < marginBottom) {
        if (currentUsedY > 10) startNewPage()
      } else if (currentUsedY > 10) {
        cursorY -= 26
        currentUsedY += 26
      }
      if (b.tocKey) {
        tocPageMap[b.tocKey] = pdfDoc.getPageCount()
      }
      if (modLabel && (coverPreset === 'whiteboard' || coverPreset === 'playful' || coverPreset === 'executive')) {
        const bannerH = chLines.length * 22 + 36
        if (cursorY - bannerH - 12 < marginBottom) startNewPage()
        const bannerBottom = cursorY - bannerH + 10
        page.drawRectangle({ x: marginLeft, y: bannerBottom, width: usableWidth, height: bannerH, color: pdfPrimary })
        page.drawRectangle({ x: marginLeft, y: bannerBottom, width: 5, height: bannerH, color: pdfAccent })
        svgPages[svgPages.length - 1].push(
          `<rect x="${marginLeft}" y="${(pageHeight - cursorY - 10).toFixed(1)}" width="${usableWidth}" height="${bannerH}" rx="6" fill="${opts.tokens.primary}" />` +
          `<rect x="${marginLeft}" y="${(pageHeight - cursorY - 10).toFixed(1)}" width="5" height="${bannerH}" rx="2" fill="${opts.tokens.accent}" />`
        )
        page.drawText(modLabel, { x: marginLeft + 16, y: cursorY - 6, size: 8.5, font: boldFont, color: rgb(0.95, 0.95, 0.95) })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft + 16}" y="${(pageHeight - cursorY + 6).toFixed(1)}" font-family="${svgFontFamily}" font-size="8.5" font-weight="700" letter-spacing="0.8" fill="#F8FAFC">${escapeXml(modLabel)}</text>`
        )
        let cyTitle = cursorY - 26
        for (const line of chLines) {
          page.drawText(line, { x: marginLeft + 16, y: cyTitle, size: 16.5, font: boldFont, color: rgb(1, 1, 1) })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 16}" y="${(pageHeight - cyTitle + 16.5).toFixed(1)}" font-family="${svgFontFamily}" font-size="16.5" font-weight="700" fill="#FFFFFF">${escapeXml(line)}</text>`
          )
          cyTitle -= 22
        }
        cursorY = bannerBottom - 16
        currentUsedY += bannerH + 26
        continue
      }
      if (modLabel) {
        const badgeW = boldFont.widthOfTextAtSize(modLabel, 8.5) + 18
        page.drawRectangle({ x: marginLeft, y: cursorY - 5, width: badgeW, height: 17, color: pdfSoftTint })
        page.drawText(modLabel, { x: marginLeft + 9, y: cursorY, size: 8.5, font: boldFont, color: pdfAccent })
        svgPages[svgPages.length - 1].push(
          `<rect x="${marginLeft}" y="${(pageHeight - cursorY - 12).toFixed(1)}" width="${badgeW.toFixed(1)}" height="17" rx="4" fill="${opts.tokens.surfaceAlt}" />` +
          `<text x="${marginLeft + 9}" y="${(pageHeight - cursorY).toFixed(1)}" font-family="${svgFontFamily}" font-size="8.5" font-weight="700" letter-spacing="0.8" fill="${opts.tokens.accent}">${escapeXml(modLabel)}</text>`
        )
        cursorY -= 24
        currentUsedY += 24
      }
      for (const line of chLines) {
        page.drawText(line, { x: marginLeft, y: cursorY, size: 17, font: boldFont, color: pdfPrimary })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft}" y="${(pageHeight - cursorY + 17).toFixed(1)}" font-family="${svgFontFamily}" font-size="17" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(line)}</text>`
        )
        cursorY -= 22
        currentUsedY += 22
      }
      page.drawRectangle({ x: marginLeft, y: cursorY + 6, width: 48, height: 2.5, color: pdfAccent })
      page.drawRectangle({ x: marginLeft + 52, y: cursorY + 6.75, width: usableWidth - 52, height: 0.75, color: pdfBorder })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft}" y="${(pageHeight - (cursorY + 8.5)).toFixed(1)}" width="48" height="2.5" rx="1.2" fill="${opts.tokens.accent}" />` +
        `<rect x="${marginLeft + 52}" y="${(pageHeight - (cursorY + 7.5)).toFixed(1)}" width="${usableWidth - 52}" height="0.8" fill="${opts.tokens.border}" />`
      )
      cursorY -= 16
      currentUsedY += 16
      continue
    }

    if (b.kind === 'table' && b.headers && b.rows) {
      const colCount = Math.max(b.headers.length, ...b.rows.map((r) => r.length), 1)
      const colW = usableWidth / colCount
      const cellPadX = 7
      const allRows = [b.headers, ...b.rows]
      const pdfHeaderBg = rgb(
        Math.min(1, accentC.r * 0.14 + 0.86),
        Math.min(1, accentC.g * 0.14 + 0.86),
        Math.min(1, accentC.b * 0.14 + 0.86)
      )

      const drawTableRow = (row: string[], isHeaderRow: boolean, isAltRow: boolean) => {
        const fontForRow = isHeaderRow ? boldFont : regularFont
        const cellWrapped = Array.from({ length: colCount }, (_, cIdx) =>
          wrapTextToLines(String(row[cIdx] ?? ''), fontForRow, 8.8, colW - cellPadX * 2)
        )
        const maxLines = Math.max(1, ...cellWrapped.map((cl) => cl.length))
        const rowH = Math.max(22, maxLines * 11.5 + 10)
        if (cursorY - rowH < marginBottom) {
          startNewPage()
          if (!isHeaderRow) {
            drawTableRow(b.headers!, true, false)
          }
        }
        const svgRowTop = pageHeight - cursorY
        const pdfRowBottom = cursorY - rowH
        if (isHeaderRow) {
          page.drawRectangle({ x: marginLeft, y: pdfRowBottom, width: usableWidth, height: rowH, color: pdfHeaderBg })
          svgPages[svgPages.length - 1].push(
            `<rect x="${marginLeft}" y="${svgRowTop.toFixed(1)}" width="${usableWidth}" height="${rowH}" fill="${opts.tokens.surfaceAlt}" />`
          )
        } else if (isAltRow) {
          page.drawRectangle({ x: marginLeft, y: pdfRowBottom, width: usableWidth, height: rowH, color: pdfPrimaryTint })
          svgPages[svgPages.length - 1].push(
            `<rect x="${marginLeft}" y="${svgRowTop.toFixed(1)}" width="${usableWidth}" height="${rowH}" fill="${opts.tokens.surfaceAlt}" opacity="0.45" />`
          )
        }

        for (let cIdx = 0; cIdx < colCount; cIdx++) {
          const cellX = marginLeft + cIdx * colW
          page.drawRectangle({
            x: cellX,
            y: pdfRowBottom,
            width: colW,
            height: rowH,
            borderColor: pdfBorder,
            borderWidth: 0.6
          })
          svgPages[svgPages.length - 1].push(
            `<rect x="${cellX.toFixed(1)}" y="${svgRowTop.toFixed(1)}" width="${colW.toFixed(1)}" height="${rowH}" fill="none" stroke="${opts.tokens.border}" stroke-width="0.7" />`
          )
          cellWrapped[cIdx].forEach((lineText, lIdx) => {
            const ly = cursorY - 13 - lIdx * 11.5
            page.drawText(lineText, {
              x: cellX + cellPadX,
              y: ly,
              size: 8.8,
              font: fontForRow,
              color: isHeaderRow ? pdfPrimary : pdfText
            })
            svgPages[svgPages.length - 1].push(
              `<text x="${(cellX + cellPadX).toFixed(1)}" y="${(pageHeight - ly).toFixed(1)}" font-family="${svgFontFamily}" font-size="8.8" font-weight="${isHeaderRow ? '700' : '400'}" fill="${isHeaderRow ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(lineText)}</text>`
            )
          })
        }
        cursorY -= rowH
        currentUsedY += rowH
      }

      for (let rIdx = 0; rIdx < allRows.length; rIdx++) {
        drawTableRow(allRows[rIdx], rIdx === 0, rIdx > 0 && rIdx % 2 === 0)
      }
      cursorY -= 16
      currentUsedY += 16
      continue
    }

    if (b.kind === 'comparison') {
      const gap = 12
      const colW = (usableWidth - gap) / 2
      const pad = 12
      const buildCompLines = (title?: string, items?: string[]) => {
        const out: Array<{ text: string; bold: boolean; isBulletStart: boolean }> = []
        if (title) {
          for (const l of wrapTextToLines(title, boldFont, 10.5, colW - pad * 2)) {
            out.push({ text: l, bold: true, isBulletStart: false })
          }
        }
        for (const it of items || []) {
          const wrapped = wrapTextToLines(it, regularFont, 9.5, colW - pad * 2 - 12)
          wrapped.forEach((l, idx) => out.push({ text: l, bold: false, isBulletStart: idx === 0 }))
        }
        return out
      }
      const leftLines = buildCompLines(b.leftTitle, b.leftItems)
      const rightLines = buildCompLines(b.rightTitle, b.rightItems)
      const maxLines = Math.max(leftLines.length, rightLines.length, 1)
      const boxH = maxLines * 14.5 + pad * 2
      if (cursorY - boxH < marginBottom) startNewPage()
      const svgTop = pageHeight - cursorY
      const pdfBottom = cursorY - boxH
        ;[0, 1].forEach((colIdx) => {
          const bx = marginLeft + colIdx * (colW + gap)
          page.drawRectangle({
            x: bx,
            y: pdfBottom,
            width: colW,
            height: boxH,
            color: pdfSoftTint,
            borderColor: pdfBorder,
            borderWidth: 0.7
          })
          svgPages[svgPages.length - 1].push(
            `<rect x="${bx.toFixed(1)}" y="${svgTop.toFixed(1)}" width="${colW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.9" />`
          )
          const lines = colIdx === 0 ? leftLines : rightLines
          lines.forEach((ln, lIdx) => {
            const ly = cursorY - pad - 10 - lIdx * 14.5
            const svgLy = pageHeight - ly
            const textX = ln.bold ? bx + pad : bx + pad + 11
            if (ln.isBulletStart) {
              page.drawCircle({ x: bx + pad + 3.5, y: ly + 3, size: 2.2, color: pdfAccent })
              svgPages[svgPages.length - 1].push(
                `<circle cx="${(bx + pad + 3.5).toFixed(1)}" cy="${(pageHeight - (ly + 3)).toFixed(1)}" r="2.2" fill="${opts.tokens.accent}" />`
              )
            }
            page.drawText(ln.text, {
              x: textX,
              y: ly,
              size: ln.bold ? 10.5 : 9.5,
              font: ln.bold ? boldFont : regularFont,
              color: ln.bold ? pdfPrimary : pdfText
            })
            svgPages[svgPages.length - 1].push(
              `<text x="${textX.toFixed(1)}" y="${svgLy.toFixed(1)}" font-family="${svgFontFamily}" font-size="${ln.bold ? 10.5 : 9.5}" font-weight="${ln.bold ? '700' : '400'}" fill="${ln.bold ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(ln.text)}</text>`
            )
          })
        })
      cursorY -= boxH + 16
      currentUsedY += boxH + 16
      continue
    }

    if (b.kind === 'timeline' && Array.isArray(b.timelineItems)) {
      for (let tIdx = 0; tIdx < b.timelineItems.length; tIdx++) {
        const item = b.timelineItems[tIdx]
        const stepLines = wrapTextToLines(item.step || '', boldFont, 10.5, usableWidth - 32)
        const detailLines = item.detail ? wrapTextToLines(item.detail, regularFont, 9.5, usableWidth - 32) : []
        const itemH = stepLines.length * 14.5 + detailLines.length * 13.5 + 14
        if (cursorY - itemH < marginBottom) startNewPage()
        const circleX = marginLeft + 10
        const circleY = cursorY - 7
        const svgCy = pageHeight - circleY
        if (tIdx < b.timelineItems.length - 1) {
          page.drawRectangle({ x: circleX - 0.6, y: cursorY - itemH, width: 1.2, height: itemH - 7, color: pdfBorder })
          svgPages[svgPages.length - 1].push(
            `<line x1="${circleX.toFixed(1)}" y1="${(svgCy + 8).toFixed(1)}" x2="${circleX.toFixed(1)}" y2="${(svgCy + itemH).toFixed(1)}" stroke="${opts.tokens.border}" stroke-width="1.2" />`
          )
        }
        page.drawCircle({ x: circleX, y: circleY, size: 8.5, color: pdfAccent })
        const numStr = String(tIdx + 1)
        const numW = boldFont.widthOfTextAtSize(numStr, 8.5)
        page.drawText(numStr, {
          x: circleX - numW / 2,
          y: circleY - 3,
          size: 8.5,
          font: boldFont,
          color: rgb(1, 1, 1)
        })
        svgPages[svgPages.length - 1].push(
          `<circle cx="${circleX.toFixed(1)}" cy="${svgCy.toFixed(1)}" r="8.5" fill="${opts.tokens.accent}" />` +
          `<text x="${circleX.toFixed(1)}" y="${(svgCy + 3).toFixed(1)}" text-anchor="middle" font-family="${svgFontFamily}" font-size="8.5" font-weight="700" fill="#FFFFFF">${tIdx + 1}</text>`
        )
        let ty = cursorY - 10
        for (const sl of stepLines) {
          page.drawText(sl, { x: marginLeft + 28, y: ty, size: 10.5, font: boldFont, color: pdfPrimary })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 28}" y="${(pageHeight - ty).toFixed(1)}" font-family="${svgFontFamily}" font-size="10.5" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(sl)}</text>`
          )
          ty -= 14.5
        }
        for (const dl of detailLines) {
          page.drawText(dl, { x: marginLeft + 28, y: ty, size: 9.5, font: regularFont, color: pdfText })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 28}" y="${(pageHeight - ty).toFixed(1)}" font-family="${svgFontFamily}" font-size="9.5" fill="${opts.tokens.textPrimary}">${escapeXml(dl)}</text>`
          )
          ty -= 13.5
        }
        cursorY -= itemH
        currentUsedY += itemH
      }
      cursorY -= 12
      currentUsedY += 12
      continue
    }

    if (b.kind === 'checklist' && Array.isArray(b.checklistItems)) {
      const pad = 14
      const renderedLines: Array<{ text: string; bold: boolean; isItemStart: boolean }> = []
      if (b.checklistTitle) {
        for (const l of wrapTextToLines(b.checklistTitle, boldFont, 10.5, usableWidth - pad * 2)) {
          renderedLines.push({ text: l, bold: true, isItemStart: false })
        }
      }
      for (const it of b.checklistItems) {
        const wrapped = wrapTextToLines(it, regularFont, 10, usableWidth - pad * 2 - 18)
        wrapped.forEach((l, idx) => renderedLines.push({ text: l, bold: false, isItemStart: idx === 0 }))
      }
      const boxH = renderedLines.length * 15.5 + pad * 2
      if (cursorY - boxH < marginBottom) startNewPage()
      const svgTop = pageHeight - cursorY
      const pdfBottom = cursorY - boxH
      page.drawRectangle({
        x: marginLeft,
        y: pdfBottom,
        width: usableWidth,
        height: boxH,
        color: pdfSoftTint,
        borderColor: pdfBorder,
        borderWidth: 0.6
      })
      page.drawRectangle({ x: marginLeft, y: pdfBottom, width: 3.5, height: boxH, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="${usableWidth}" height="${boxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.7" />` +
        `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="3.5" height="${boxH.toFixed(1)}" rx="1.5" fill="${opts.tokens.accent}" />`
      )
      renderedLines.forEach((ln, idx) => {
        const ly = cursorY - pad - 10 - idx * 15.5
        const textX = ln.bold ? marginLeft + pad + 4 : marginLeft + pad + 20
        if (ln.isItemStart) {
          const bx = marginLeft + pad + 4
          const by = ly - 1
          page.drawRectangle({ x: bx, y: by, width: 9, height: 9, borderColor: pdfAccent, borderWidth: 1 })
          page.drawLine({ start: { x: bx + 2, y: by + 4.5 }, end: { x: bx + 4, y: by + 2.2 }, thickness: 1.2, color: pdfAccent })
          page.drawLine({ start: { x: bx + 4, y: by + 2.2 }, end: { x: bx + 7.2, y: by + 7 }, thickness: 1.2, color: pdfAccent })
          const sby = pageHeight - by - 9
          svgPages[svgPages.length - 1].push(
            `<rect x="${bx}" y="${sby.toFixed(1)}" width="9" height="9" rx="2" fill="none" stroke="${opts.tokens.accent}" stroke-width="1.1" />` +
            `<path d="M ${(bx + 2).toFixed(1)} ${(sby + 4.5).toFixed(1)} L ${(bx + 4).toFixed(1)} ${(sby + 6.8).toFixed(1)} L ${(bx + 7.2).toFixed(1)} ${(sby + 2).toFixed(1)}" fill="none" stroke="${opts.tokens.accent}" stroke-width="1.2" />`
          )
        }
        page.drawText(ln.text, {
          x: textX,
          y: ly,
          size: ln.bold ? 10.5 : 10,
          font: ln.bold ? boldFont : regularFont,
          color: ln.bold ? pdfPrimary : pdfText
        })
        svgPages[svgPages.length - 1].push(
          `<text x="${textX}" y="${(pageHeight - ly).toFixed(1)}" font-family="${svgFontFamily}" font-size="${ln.bold ? 10.5 : 10}" font-weight="${ln.bold ? '700' : '400'}" fill="${ln.bold ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(ln.text)}</text>`
        )
      })
      cursorY -= boxH + 16
      currentUsedY += boxH + 16
      continue
    }

    if (b.kind === 'glossary_item') {
      const termPrefix = b.term ? `${toWinAnsiSafe(b.term)}: ` : ''
      const defText = toWinAnsiSafe(b.text || '')
      const fullText = `${termPrefix}${defText}`
      const lines = wrapTextToLines(fullText, regularFont, 10.2, usableWidth - 16)
      const lineH = 15
      if (cursorY - lines.length * lineH < marginBottom) startNewPage()
      lines.forEach((ln, idx) => {
        if (cursorY - lineH < marginBottom) startNewPage()
        if (idx === 0) {
          page.drawCircle({ x: marginLeft + 4, y: cursorY + 3.5, size: 2.2, color: pdfAccent })
          svgPages[svgPages.length - 1].push(
            `<circle cx="${marginLeft + 4}" cy="${(pageHeight - (cursorY + 3.5)).toFixed(1)}" r="2.2" fill="${opts.tokens.accent}" />`
          )
        }
        if (idx === 0 && termPrefix && ln.startsWith(termPrefix)) {
          const rest = ln.slice(termPrefix.length)
          const tw = boldFont.widthOfTextAtSize(termPrefix, 10.2)
          page.drawText(termPrefix, { x: marginLeft + 14, y: cursorY, size: 10.2, font: boldFont, color: pdfPrimary })
          if (rest) {
            page.drawText(rest, { x: marginLeft + 14 + tw, y: cursorY, size: 10.2, font: regularFont, color: pdfText })
          }
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 14}" y="${(pageHeight - cursorY + 10.2).toFixed(1)}" font-family="${svgFontFamily}" font-size="10.2" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(termPrefix)}<tspan font-weight="400" fill="${opts.tokens.textPrimary}">${escapeXml(rest)}</tspan></text>`
          )
        } else {
          page.drawText(ln, { x: marginLeft + 14, y: cursorY, size: 10.2, font: regularFont, color: pdfText })
          svgPages[svgPages.length - 1].push(
            `<text x="${marginLeft + 14}" y="${(pageHeight - cursorY + 10.2).toFixed(1)}" font-family="${svgFontFamily}" font-size="10.2" fill="${opts.tokens.textPrimary}">${escapeXml(ln)}</text>`
          )
        }
        cursorY -= lineH
        currentUsedY += lineH
      })
      cursorY -= 6
      currentUsedY += 6
      continue
    }

    const text = b.text || ''
    if (!text.trim()) continue

    if (b.kind === 'callout') {
      const pad = 14
      const rawParagraphs = text.split('\n')
      const styledLines: Array<{ text: string; bold: boolean }> = []
      rawParagraphs.forEach((p, pIdx) => {
        const isTitleLine = pIdx === 0 && (p.trim().endsWith(':') || p.trim().length <= 42)
        const f = isTitleLine ? boldFont : regularFont
        for (const l of wrapTextToLines(p, f, 10, usableWidth - pad * 2 - 6)) {
          styledLines.push({ text: l, bold: isTitleLine })
        }
      })
      const boxH = styledLines.length * 15 + pad * 2
      if (cursorY - boxH < marginBottom) startNewPage()
      const svgTop = pageHeight - cursorY
      const pdfBottom = cursorY - boxH
      page.drawRectangle({
        x: marginLeft,
        y: pdfBottom,
        width: usableWidth,
        height: boxH,
        color: pdfSoftTint,
        borderColor: pdfBorder,
        borderWidth: 0.6
      })
      page.drawRectangle({ x: marginLeft, y: pdfBottom, width: 3.5, height: boxH, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="${usableWidth}" height="${boxH.toFixed(1)}" rx="6" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.7" />` +
        `<rect x="${marginLeft}" y="${svgTop.toFixed(1)}" width="3.5" height="${boxH.toFixed(1)}" rx="1.5" fill="${opts.tokens.accent}" />`
      )
      styledLines.forEach((line, idx) => {
        const ly = cursorY - pad - 10 - idx * 15
        page.drawText(line.text, {
          x: marginLeft + pad + 4,
          y: ly,
          size: 10,
          font: line.bold ? boldFont : regularFont,
          color: line.bold ? pdfPrimary : pdfText
        })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft + pad + 4}" y="${(pageHeight - ly).toFixed(1)}" font-family="${svgFontFamily}" font-size="10" font-weight="${line.bold ? '700' : '400'}" fill="${line.bold ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(line.text)}</text>`
        )
      })
      cursorY -= boxH + 16
      currentUsedY += boxH + 16
      continue
    }

    if (b.kind === 'answer') {
      const lines = wrapTextToLines(text, regularFont, 9.8, usableWidth - 26)
      const lineH = 14.5
      const blockH = lines.length * lineH + 6
      if (cursorY - blockH < marginBottom) startNewPage()
      page.drawRectangle({ x: marginLeft + 10, y: cursorY - blockH + 5, width: 2, height: blockH - 6, color: pdfAccent })
      svgPages[svgPages.length - 1].push(
        `<rect x="${marginLeft + 10}" y="${(pageHeight - cursorY - 1).toFixed(1)}" width="2" height="${(blockH - 6).toFixed(1)}" fill="${opts.tokens.accent}" />`
      )
      lines.forEach((line, idx) => {
        const ly = cursorY - 6 - idx * lineH
        page.drawText(line, {
          x: marginLeft + 20,
          y: ly,
          size: 9.8,
          font: idx === 0 ? italicFont : regularFont,
          color: pdfMuted
        })
        svgPages[svgPages.length - 1].push(
          `<text x="${marginLeft + 20}" y="${(pageHeight - ly).toFixed(1)}" font-family="${svgFontFamily}" font-size="9.8" fill="${opts.tokens.textMuted}">${escapeXml(line)}</text>`
        )
      })
      cursorY -= blockH + 8
      currentUsedY += blockH + 8
      continue
    }

    const isHeading = b.kind === 'title' || b.kind === 'heading'
    const fontSize = b.kind === 'title' ? 18 : b.kind === 'heading' ? 13 : b.kind === 'quote' ? 10 : 10.5
    const lineHeight = fontSize * (isAbnt ? 1.55 : 1.48)
    const font = isHeading ? boldFont : regularFont
    const indent = b.kind === 'quote' ? 60 : b.kind === 'bullet' ? 14 : 0
    const lines = wrapTextToLines(text, font, fontSize, usableWidth - indent)

    if (isHeading && cursorY - (lines.length * lineHeight + 54) < marginBottom) {
      startNewPage()
    } else if (isHeading && currentUsedY > 12) {
      cursorY -= 6
      currentUsedY += 6
    }

    for (const line of lines) {
      if (cursorY - lineHeight < marginBottom) startNewPage()
      const svgY = pageHeight - cursorY + fontSize
      page.drawText(line, {
        x: marginLeft + indent,
        y: cursorY,
        size: fontSize,
        font,
        color: isHeading ? pdfPrimary : pdfText
      })
      svgPages[svgPages.length - 1].push(
        `<text x="${marginLeft + indent}" y="${svgY.toFixed(1)}" font-family="${svgFontFamily}" font-size="${fontSize}" font-weight="${isHeading ? '700' : '400'}" fill="${isHeading ? opts.tokens.primary : opts.tokens.textPrimary}">${escapeXml(line)}</text>`
      )
      cursorY -= lineHeight
      currentUsedY += lineHeight
    }
    cursorY -= lineHeight * 0.45
    currentUsedY += lineHeight * 0.45
  }

  // Fill deferred TOC with real 1-based page numbers
  if (pendingToc) {
    const tocPage = pendingToc.page
    const tocSvg = svgPages[pendingToc.svgIndex]
    let ty = pageHeight - marginTop
    tocPage.drawText(pendingToc.heading, { x: marginLeft, y: ty, size: 19, font: boldFont, color: pdfPrimary })
    tocSvg.push(
      `<text x="${marginLeft}" y="${(pageHeight - ty + 19).toFixed(1)}" font-family="${svgFontFamily}" font-size="19" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(pendingToc.heading)}</text>`
    )
    ty -= 14
    tocPage.drawRectangle({ x: marginLeft, y: ty, width: 52, height: 2.8, color: pdfAccent })
    tocSvg.push(
      `<rect x="${marginLeft}" y="${(pageHeight - ty).toFixed(1)}" width="52" height="2.8" rx="1.2" fill="${opts.tokens.accent}" />`
    )
    ty -= 28

    for (const entry of pendingToc.entries) {
      const pageNum = tocPageMap[entry.key]
      const pageStr = pageNum ? `${tr('Pág.')} ${String(pageNum).padStart(2, '0')}` : ''
      const rowH = 30
      if (ty - rowH < marginBottom) break
      const boxBottom = ty - rowH + 6
      tocPage.drawRectangle({
        x: marginLeft,
        y: boxBottom,
        width: usableWidth,
        height: rowH - 5,
        color: pdfSoftTint,
        borderColor: pdfBorder,
        borderWidth: 0.5
      })
      const badgeW = 28
      tocPage.drawRectangle({ x: marginLeft + 6, y: boxBottom + 4, width: badgeW, height: rowH - 13, color: pdfPrimary })
      const badgeStr = toWinAnsiSafe(entry.badge)
      const bw = boldFont.widthOfTextAtSize(badgeStr, 9)
      tocPage.drawText(badgeStr, { x: marginLeft + 6 + (badgeW - bw) / 2, y: boxBottom + 9.5, size: 9, font: boldFont, color: rgb(1, 1, 1) })
      const maxLabelW = usableWidth - 110
      let labelText = toWinAnsiSafe(entry.label)
      while (labelText.length > 6 && regularFont.widthOfTextAtSize(labelText, 10.5) > maxLabelW) {
        labelText = labelText.slice(0, -4).trimEnd() + '...'
      }
      tocPage.drawText(labelText, { x: marginLeft + 44, y: boxBottom + 9, size: 10.5, font: regularFont, color: pdfText })
      if (pageStr) {
        const pw = boldFont.widthOfTextAtSize(pageStr, 9.5)
        tocPage.drawText(pageStr, { x: marginLeft + usableWidth - pw - 10, y: boxBottom + 9, size: 9.5, font: boldFont, color: pdfAccent })
      }
      tocSvg.push(
        `<rect x="${marginLeft}" y="${(pageHeight - ty - 1).toFixed(1)}" width="${usableWidth}" height="${(rowH - 5).toFixed(1)}" rx="5" fill="${opts.tokens.surfaceAlt}" stroke="${opts.tokens.border}" stroke-width="0.6" />` +
        `<rect x="${marginLeft + 6}" y="${(pageHeight - ty + 3).toFixed(1)}" width="${badgeW}" height="${(rowH - 13).toFixed(1)}" rx="3" fill="${opts.tokens.primary}" />` +
        `<text x="${marginLeft + 6 + badgeW / 2}" y="${(pageHeight - ty + 14.5).toFixed(1)}" text-anchor="middle" font-family="${svgFontFamily}" font-size="9" font-weight="700" fill="#FFFFFF">${escapeXml(badgeStr)}</text>` +
        `<text x="${marginLeft + 44}" y="${(pageHeight - ty + 15).toFixed(1)}" font-family="${svgFontFamily}" font-size="10.5" fill="${opts.tokens.textPrimary}">${escapeXml(labelText)}</text>` +
        (pageStr
          ? `<text x="${marginLeft + usableWidth - 10}" y="${(pageHeight - ty + 15).toFixed(1)}" text-anchor="end" font-family="${svgFontFamily}" font-size="9.5" font-weight="700" fill="${opts.tokens.accent}">${escapeXml(pageStr)}</text>`
          : '')
      )
      ty -= rowH + 4
    }
  }

  if (validAttachments.length > 0) {
    if (cursorY - 80 < marginBottom) startNewPage()
    const anexosSvgY = pageHeight - cursorY + 13
    page.drawText(attachmentsHeading, {
      x: marginLeft,
      y: cursorY,
      size: 13,
      font: boldFont,
      color: pdfPrimary
    })
    svgPages[svgPages.length - 1].push(
      `<text x="${marginLeft}" y="${anexosSvgY.toFixed(1)}" font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="${opts.tokens.primary}">${escapeXml(attachmentsHeading)}</text>`
    )
    cursorY -= 24
    currentUsedY += 24

    for (const att of validAttachments) {
      try {
        const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(att.base64)
        if (!match) continue
        const imgBytes = Buffer.from(match[2], 'base64')
        const embedded =
          match[1].toLowerCase() === 'png' ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
        const scale = Math.min(usableWidth / embedded.width, 220 / embedded.height, 1)
        const drawW = embedded.width * scale
        const drawH = embedded.height * scale
        if (cursorY - drawH - 28 < marginBottom) startNewPage()
        const imgX = marginLeft + (usableWidth - drawW) / 2
        const imgY = cursorY - drawH
        page.drawImage(embedded, { x: imgX, y: imgY, width: drawW, height: drawH })
        const svgTop = pageHeight - cursorY
        svgPages[svgPages.length - 1].push(
          `<image href="${escapeXml(att.base64)}" x="${imgX.toFixed(1)}" y="${svgTop.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawH.toFixed(1)}" preserveAspectRatio="xMidYMid meet" />`
        )
        cursorY = imgY - 14
        const capText = toWinAnsiSafe(att.caption || att.name)
        const capW = regularFont.widthOfTextAtSize(capText, 9)
        const capX = marginLeft + Math.max(0, (usableWidth - capW) / 2)
        const capRgb = hexRgb01('64748B')
        page.drawText(capText, { x: capX, y: cursorY, size: 9, font: regularFont, color: rgb(capRgb.r, capRgb.g, capRgb.b) })
        svgPages[svgPages.length - 1].push(
          `<text x="${(marginLeft + usableWidth / 2).toFixed(1)}" y="${(pageHeight - cursorY + 9).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="${opts.tokens.textMuted}">${escapeXml(capText)}</text>`
        )
        cursorY -= 22
        currentUsedY += drawH + 36
      } catch {
        // Ignore malformed attachment image without breaking document export
      }
    }
  }

  qaMetrics.push({
    index: svgPages.length - 1,
    label: translateCore(normalizeLocale(opts.locale), 'Página {number}', { number: svgPages.length }),
    fillRatio: Math.min(1, currentUsedY / (pageHeight - marginTop - marginBottom)),
    overflowChars: 0
  })

  const { report } = runVisualQA({ tokens: opts.tokens, pages: qaMetrics, autoRepair: true, locale: normalizeLocale(opts.locale) })

  // Draw page numbers and running header/footer on the actual PDF pages
  const allPdfPages = pdfDoc.getPages()
  const totalPdfPages = allPdfPages.length
  const mutedPdfRgb = hexRgb01(opts.tokens.textMuted)
  const pdfMutedColor = rgb(mutedPdfRgb.r, mutedPdfRgb.g, mutedPdfRgb.b)
  const fitHeaderText = (raw: string, font: PDFFont, maxW: number): string => {
    const clean = toWinAnsiSafe(raw).trim()
    if (!clean || font.widthOfTextAtSize(clean, 8) <= maxW) return clean
    const words = clean.split(/\s+/)
    let out = ''
    for (const w of words) {
      const cand = out ? `${out} ${w}` : w
      if (font.widthOfTextAtSize(`${cand}...`, 8) <= maxW) out = cand
      else break
    }
    return out ? `${out}...` : clean.slice(0, 24) + '...'
  }
  const isStrictFormalDoc =
    opts.toolId === 'oficio' ||
    opts.toolId === 'abnt' ||
    opts.toolId === 'contract' ||
    opts.toolId === 'meeting_minutes'
  const docShortTitle = fitHeaderText(String(opts.data.title || ''), regularFont, usableWidth * 0.46)
  for (let pIdx = 0; pIdx < totalPdfPages; pIdx++) {
    if (opts.toolId === 'apostila' && pIdx === 0) continue
    const p = allPdfPages[pIdx]
    if (opts.toolId !== 'apostila' && !isStrictFormalDoc) {
      if (coverPreset === 'whiteboard' || coverPreset === 'playful') {
        p.drawRectangle({
          x: 18,
          y: 18,
          width: pageWidth - 36,
          height: pageHeight - 36,
          borderColor: pdfAccent,
          borderWidth: 0.7
        })
      }
    }
    const pageLabel = toWinAnsiSafe(
      translateCore(normalizeLocale(opts.locale), 'Pág. {current}/{total}', {
        current: pIdx + 1,
        total: totalPdfPages
      })
    )
    const label = footerText ? `${toWinAnsiSafe(footerText)}  |  ${pageLabel}` : pageLabel
    const lw = regularFont.widthOfTextAtSize(label, 8.5)
    const hideFooter = (totalPdfPages === 1 || opts.toolId === 'resume') && !footerText
    if (!hideFooter) {
      if (footerText) {
        p.drawLine({
          start: { x: marginLeft, y: 36 },
          end: { x: pageWidth - marginRight, y: 36 },
          thickness: 0.5,
          color: pdfBorder
        })
      }
      p.drawText(label, {
        x: pageWidth - marginRight - lw,
        y: 22,
        size: 8.5,
        font: regularFont,
        color: pdfMutedColor
      })
    }
    const suppressRunningHeader =
      isAbnt ||
      opts.toolId === 'oficio' ||
      opts.toolId === 'resume' ||
      pIdx === 0
    const customHeader = opts.brandKit?.headerText ? fitHeaderText(opts.brandKit.headerText, regularFont, usableWidth * 0.46) : ''
    const rightHeader = ''
    const leftHeader = customHeader
    if (!suppressRunningHeader && (leftHeader || rightHeader)) {
      p.drawLine({
        start: { x: marginLeft, y: pageHeight - 36 },
        end: { x: pageWidth - marginRight, y: pageHeight - 36 },
        thickness: 0.5,
        color: pdfBorder
      })
      if (leftHeader) {
        p.drawText(leftHeader, {
          x: marginLeft,
          y: pageHeight - 28,
          size: 8,
          font: regularFont,
          color: pdfMutedColor
        })
      }
      if (rightHeader && rightHeader !== leftHeader) {
        const rw = regularFont.widthOfTextAtSize(rightHeader, 8)
        p.drawText(rightHeader, {
          x: pageWidth - marginRight - rw,
          y: pageHeight - 28,
          size: 8,
          font: boldFont,
          color: pdfAccent
        })
      }
    } else if (opts.brandKit?.headerText && !suppressRunningHeader) {
      const ht = toWinAnsiSafe(headerText)
      p.drawText(ht, {
        x: marginLeft,
        y: pageHeight - 28,
        size: 8.5,
        font: regularFont,
        color: pdfMutedColor
      })
    }
  }

  // Enrich cover, numeric tables, timelines and concept maps with crisp PNG visual graphics
  for (const b of blocks) {
    if (b.kind === 'cover') {
      b.coverIllustrationPng = (await renderCoverIllustrationPng(opts.tokens)) || undefined
    } else if (b.kind === 'table' && b.headers && b.rows) {
      b.chartPngDataUrl = (await maybeRenderTableBarChartPng(b.headers, b.rows, opts.tokens, opts.locale)) || undefined
    } else if (b.kind === 'timeline' && Array.isArray(b.timelineItems)) {
      b.diagramPngDataUrl = (await maybeRenderFlowDiagramPng(b.timelineItems, opts.tokens)) || undefined
    } else if (b.kind === 'concept_map' && Array.isArray(b.options)) {
      b.diagramPngDataUrl = (await renderConceptMapPng(b.text || '', b.options, opts.tokens)) || undefined
    }
  }

  const htmlSource = buildDocumentHtml({
    toolId: opts.toolId,
    template: opts.template,
    tokens: opts.tokens,
    blocks,
    data: opts.data,
    brandKit: opts.brandKit,
    attachments: validAttachments,
    locale: opts.locale
  })
  const hasToc = blocks.some((b) => b.kind === 'toc')
  const pdfBuffer = hasToc
    ? await renderHtmlWithPaginatedToc({
      toolId: opts.toolId,
      template: opts.template,
      tokens: opts.tokens,
      blocks,
      data: opts.data,
      brandKit: opts.brandKit,
      attachments: validAttachments,
      locale: opts.locale
    })
    : await renderHtmlToPdfBuffer(htmlSource)
  const buildHeaderSvg = () => {
    if (!showLogoInHeader && !headerText) return ''
    const yTop = 18
    const logoW = 48
    const logoH = 20
    const anchor = headerAlign === 'left' ? 'start' : headerAlign === 'center' ? 'middle' : 'end'
    const baseX = headerAlign === 'left' ? marginLeft : headerAlign === 'center' ? pageWidth / 2 : pageWidth - marginRight
    const parts: string[] = []
    if (showLogoInHeader && headerLogoDataUrl) {
      const logoX =
        headerAlign === 'left'
          ? marginLeft
          : headerAlign === 'center'
            ? headerText
              ? pageWidth / 2 - 58
              : pageWidth / 2 - logoW / 2
            : pageWidth - marginRight - logoW
      parts.push(
        `<image href="${escapeXml(headerLogoDataUrl)}" x="${logoX.toFixed(1)}" y="${yTop}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`
      )
    }
    if (headerText) {
      const textX =
        showLogoInHeader && headerLogoDataUrl
          ? headerAlign === 'left'
            ? marginLeft + logoW + 8
            : headerAlign === 'center'
              ? pageWidth / 2 + 4
              : pageWidth - marginRight - logoW - 8
          : baseX
      parts.push(
        `<text x="${textX.toFixed(1)}" y="${yTop + 14}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-size="9" fill="${opts.tokens.textMuted}">${escapeXml(headerText)}</text>`
      )
    }
    return parts.join('')
  }

  const buildFooterSvg = (idx: number, total: number) => {
    if ((total === 1 || opts.toolId === 'resume') && !footerText && !(showLogoInFooter && footerLogoDataUrl)) return ''
    const yBottom = pageHeight - 20
    const logoW = 40
    const logoH = 16
    const pageLabel = translateCore(normalizeLocale(opts.locale), 'Pág. {current}/{total}', {
      current: idx + 1,
      total
    })
    const label = footerText ? `${footerText}  |  ${pageLabel}` : pageLabel
    const anchor = footerAlign === 'left' ? 'start' : footerAlign === 'center' ? 'middle' : 'end'
    const baseX = footerAlign === 'left' ? marginLeft : footerAlign === 'center' ? pageWidth / 2 : pageWidth - marginRight
    const parts: string[] = []
    if (showLogoInFooter && footerLogoDataUrl) {
      const logoX =
        footerAlign === 'left'
          ? marginLeft
          : footerAlign === 'center'
            ? pageWidth / 2 - 56
            : pageWidth - marginRight - logoW
      parts.push(
        `<image href="${escapeXml(footerLogoDataUrl)}" x="${logoX.toFixed(1)}" y="${pageHeight - 34}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`
      )
    }
    const textX =
      showLogoInFooter && footerLogoDataUrl
        ? footerAlign === 'left'
          ? marginLeft + logoW + 8
          : footerAlign === 'center'
            ? pageWidth / 2 + 2
            : pageWidth - marginRight - logoW - 8
        : baseX
    parts.push(
      `<text x="${textX.toFixed(1)}" y="${yBottom}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-size="9" fill="${opts.tokens.textMuted}">${escapeXml(label)}</text>`
    )
    return parts.join('')
  }

  const headerSvgMarkup = ''
  const preset = opts.template.layoutPreset || 'classic'
  const isStrictFormal =
    opts.toolId === 'oficio' ||
    opts.toolId === 'abnt' ||
    opts.toolId === 'contract' ||
    opts.toolId === 'meeting_minutes'
  const hasCoverPage = blocks[0]?.kind === 'cover'
  const buildPresetDecorSvg = (idx: number) => {
    if (idx === 0 && hasCoverPage) return ''
    if (isStrictFormal || preset === 'classic' || preset === 'academic' || preset === 'minimal') {
      return ''
    }
    if (preset === 'executive' || preset === 'modern') {
      return idx === 0
        ? `<rect x="${marginLeft}" y="52" width="64" height="2.5" rx="1.25" fill="${opts.tokens.accent}"/>`
        : ''
    }
    if (preset === 'editorial') {
      return `<rect x="${marginLeft}" y="38" width="${usableWidth}" height="1" fill="${opts.tokens.border}"/>`
    }
    if (preset === 'whiteboard' || preset === 'playful') {
      return `<rect x="18" y="18" width="${pageWidth - 36}" height="${pageHeight - 36}" rx="12" fill="none" stroke="${opts.tokens.accent}" stroke-width="1" stroke-dasharray="6 4" opacity="0.45"/>`
    }
    return ''
  }
  const previewSvgs = svgPages.map(
    (els, idx) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWidth} ${pageHeight}" width="100%" style="background:${opts.tokens.surface}"><rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="${opts.tokens.surface}" stroke="${opts.tokens.border}" stroke-width="1"/>${buildPresetDecorSvg(idx)}${headerSvgMarkup}${els.join('')}${idx === 0 && hasCoverPage ? '' : buildFooterSvg(idx, svgPages.length)}</svg>`
  )

  return { docxBuffer, pdfBuffer, previewSvgs, qaReport: report }
}
