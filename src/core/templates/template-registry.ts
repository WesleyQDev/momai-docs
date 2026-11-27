import type { BrandKit, DesignTokens, LicenseMetadata, SlotConstraint, TemplateManifest, ToolId } from '../types.ts'
import { normalizeLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

export const COMMERCIAL_FONTS_LICENSES: Array<{
  family: string
  role: string
  license: LicenseMetadata
}> = [
    {
      family: 'Inter',
      role: 'Modern sans-serif for reports, slides, and UI',
      license: {
        spdx: 'OFL-1.1',
        name: 'SIL Open Font License 1.1',
        author: 'Rasmus Andersson',
        url: 'https://github.com/rsms/inter',
        commercialUseAllowed: true,
        attributionRequired: false
      }
    },
    {
      family: 'Liberation Serif',
      role: 'Metric-compatible serif equivalent to Times New Roman (ABNT standard)',
      license: {
        spdx: 'OFL-1.1',
        name: 'SIL Open Font License 1.1',
        author: 'Red Hat / Liberation Fonts',
        url: 'https://github.com/liberationfonts/liberation-fonts',
        commercialUseAllowed: true,
        attributionRequired: false
      }
    },
    {
      family: 'Liberation Sans',
      role: 'Metric-compatible sans-serif equivalent to Arial (ABNT standard and official letters)',
      license: {
        spdx: 'OFL-1.1',
        name: 'SIL Open Font License 1.1',
        author: 'Red Hat / Liberation Fonts',
        url: 'https://github.com/liberationfonts/liberation-fonts',
        commercialUseAllowed: true,
        attributionRequired: false
      }
    },
    {
      family: 'Merriweather',
      role: 'Editorial serif for study guides and highlighted quotations',
      license: {
        spdx: 'OFL-1.1',
        name: 'SIL Open Font License 1.1',
        author: 'Sorkin Type',
        url: 'https://github.com/SorkinType/Merriweather',
        commercialUseAllowed: true,
        attributionRequired: false
      }
    },
    {
      family: 'JetBrains Mono',
      role: 'Monospaced font for code, formulas, and technical tables',
      license: {
        spdx: 'OFL-1.1',
        name: 'SIL Open Font License 1.1',
        author: 'JetBrains',
        url: 'https://github.com/JetBrains/JetBrainsMono',
        commercialUseAllowed: true,
        attributionRequired: false
      }
    }
  ]

const MIT_MOMAI_LICENSE: LicenseMetadata = {
  spdx: 'MIT',
  name: 'MIT License (MomAI Docs Studio)',
  author: 'WesleyQDev / MomAI',
  url: 'https://opensource.org/licenses/MIT',
  commercialUseAllowed: true,
  attributionRequired: false
}

const ABNT_LPPL_INSPIRED_LICENSE: LicenseMetadata = {
  spdx: 'MIT',
  name: 'MIT License (ABNT standards NBR 14724/10520/6023; structural reference to abnTeX2 LPPL-1.3c)',
  author: 'MomAI Docs Studio / abnTeX2 reference',
  url: 'https://www.abntex.net.br/',
  commercialUseAllowed: true,
  attributionRequired: true,
  attributionText: 'ABNT formatting inspired by the open abnTeX2 specification (LPPL 1.3c).'
}

function makeTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    primary: '#111827',
    secondary: '#374151',
    accent: '#1F2937',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    textPrimary: '#111827',
    textMuted: '#4B5563',
    border: '#D1D5DB',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    monoFont: 'JetBrains Mono',
    ...overrides
  }
}

const SLOTS_BY_TOOL: Record<ToolId, SlotConstraint[]> = {
  oficio: [
    { key: 'documentNumber', label: 'Official Letter Number', type: 'string', required: true, maxChars: 60, description: 'E.g., Official Letter No. 042/2026-GAB' },
    { key: 'placeAndDate', label: 'Place and Date', type: 'string', required: true, maxChars: 80, description: 'City, day, month, and year' },
    { key: 'recipientTitle', label: 'Salutation / Recipient', type: 'string', required: true, maxChars: 140, description: 'Recipient title and form of address' },
    { key: 'subject', label: 'Subject', type: 'string', required: true, maxChars: 160, description: 'Objective summary of the subject' },
    { key: 'paragraphs', label: 'Body Paragraphs', type: 'string[]', required: true, maxItems: 10, description: 'Numbered or continuous paragraphs grounded in the sources' },
    { key: 'closing', label: 'Official Closing', type: 'string', required: true, maxChars: 80, description: 'E.g., "Respectfully," / "Sincerely,"' },
    { key: 'signerName', label: 'Signatory', type: 'string', required: true, maxChars: 100, description: 'Sender name and title' }
  ],
  apostila: [
    { key: 'title', label: 'Study Guide Title', type: 'string', required: true, maxChars: 120, description: 'Main title' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', required: false, maxChars: 180, description: 'Scope or subtitle' },
    { key: 'badgeLabel', label: 'Cover Badge', type: 'string', required: false, maxChars: 48, description: 'Short category/exam notice badge on the cover (e.g., "PUBLIC EXAM • PREPARATORY COURSE")' },
    { key: 'studentFields', label: 'Student Fields on Cover', type: 'string[]', required: false, maxItems: 5, description: 'Identification labels on the cover when applicable (e.g., ["Student", "Study Start Date", "Completion Goal"])' },
    { key: 'presentation', label: 'Introduction', type: 'string', required: false, maxChars: 650, description: 'Welcome and usage guide for the student about the content (never describe the cover layout)' },
    { key: 'chapters', label: 'Chapters', type: 'object[]', required: true, maxItems: 10, description: 'List of 3 to 6 in-depth instructional modules: { title, objectives[], sections: [{ heading, body, example?, callout?, table?: { headers, rows }, comparison?: { leftTitle, leftItems[], rightTitle, rightItems[] }, timeline?: [{ step, detail }], checklist?: string[] }], exercises: [{ question, answer }] }' },
    { key: 'conclusion', label: 'Final Considerations', type: 'string', required: false, maxChars: 600, description: 'Final synthesis and next study steps' },
    { key: 'glossary', label: 'Glossary', type: 'object[]', required: false, maxItems: 20, description: 'List of { term, definition }' },
    { key: 'references', label: 'References', type: 'string[]', required: true, maxItems: 30, description: 'Cited sources' }
  ],
  abnt: [
    { key: 'institution', label: 'Institution', type: 'string', required: true, maxChars: 140, description: 'University / College / Program' },
    { key: 'author', label: 'Author(s)', type: 'string', required: true, maxChars: 140, description: 'Author full name' },
    { key: 'title', label: 'Paper Title', type: 'string', required: true, maxChars: 160, description: 'Main title' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', required: false, maxChars: 160, description: 'Optional subtitle' },
    { key: 'cityAndYear', label: 'City and Year', type: 'string', required: true, maxChars: 60, description: 'E.g., São Paulo, 2026' },
    { key: 'workNature', label: 'Nature of the Work', type: 'string', required: true, maxChars: 280, description: 'Title-page note (type, program, institution, advisor)' },
    { key: 'abstractPt', label: 'Abstract (PT-BR)', type: 'string', required: true, maxChars: 1600, description: 'Structured single-paragraph abstract + keywords' },
    { key: 'keywordsPt', label: 'Keywords', type: 'string[]', required: true, maxItems: 5, description: '3 to 5 keywords' },
    { key: 'abstractEn', label: 'Abstract (EN)', type: 'string', required: false, maxChars: 1600, description: 'English version of the abstract' },
    { key: 'sections', label: 'Textual Sections', type: 'object[]', required: true, maxItems: 12, description: 'List of { number, heading, paragraphs[], longQuotes?: [{ text, citation }] }' },
    { key: 'references', label: 'References (NBR 6023)', type: 'string[]', required: true, maxItems: 40, description: 'Complete references in alphabetical order' }
  ],
  letterhead: [
    { key: 'documentTitle', label: 'Document Title / Type', type: 'string', required: true, maxChars: 120, description: 'Central title or document identification' },
    { key: 'fields', label: 'Fields / Blanks', type: 'object[]', required: false, maxItems: 25, description: 'Pairs { key, value } to fill {{campo}} or ____ blanks in the letterhead' },
    { key: 'paragraphs', label: 'Body Text', type: 'string[]', required: true, maxItems: 16, description: 'Paragraphs to insert in the letterhead safe area' },
    { key: 'signatureBlock', label: 'Signature', type: 'string', required: false, maxChars: 160, description: 'Place, date, and signatory identification' }
  ],
  pptx: [
    { key: 'title', label: 'Presentation Title', type: 'string', required: true, maxChars: 90, description: 'Cover title' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', required: false, maxChars: 140, description: 'Cover subtitle' },
    { key: 'slides', label: 'Slides', type: 'object[]', required: true, maxItems: 18, description: 'List of { layout: "bullets"|"two_col"|"metrics"|"chart"|"quote"|"timeline", title, bullets?: string[], metrics?: [{ label, value }], chart?: { type: "bar"|"line"|"pie", labels: string[], values: number[] }, imageQuery?: string (2-3 English keywords for an illustrative internet image, e.g., "software architecture"), notes: string }' }
  ],
  podcast: [
    { key: 'title', label: 'Episode Title', type: 'string', required: true, maxChars: 110, description: 'Engaging podcast title' },
    { key: 'summary', label: 'Episode Description', type: 'string', required: true, maxChars: 350, description: 'Opening summary' },
    { key: 'chapters', label: 'Chapters', type: 'object[]', required: true, maxItems: 8, description: 'List of { title, startTurnIndex }' },
    { key: 'turns', label: 'Script Lines', type: 'object[]', required: true, maxItems: 40, description: 'List of { id, speaker: "hostA"|"hostB", speakerName, text, emotion: "neutral"|"curious"|"enthusiastic"|"thoughtful", pauseAfterMs, citationLocator? }' }
  ],
  video: [
    { key: 'title', label: 'Video Title', type: 'string', required: true, maxChars: 90, description: 'Main title' },
    { key: 'aspectRatio', label: 'Aspect Ratio', type: 'string', required: true, maxChars: 10, description: '16:9 or 9:16' },
    { key: 'scenes', label: 'Storyboard Scenes', type: 'object[]', required: true, maxItems: 12, description: 'The 1st scene must always be "TitleHeroScene" (video cover). List of { id, component: "TitleHeroScene"|"AnimatedBulletListScene"|"ComparisonSplitScene"|"MetricCounterGridScene"|"BarChartScene"|"ProcessFlowScene"|"TimelineScene"|"ConceptMapScene"|"QuoteCalloutScene"|"SourceImageSpotlightScene"|"TableHighlightScene"|"SummaryTakeawaysScene", heading, narration, speaker?: "hostA"|"hostB", items?: string[], metrics?: [{ label, value }], quote?: { text, author }, imageQuery?: string (2-3 English keywords for an illustrative photo/PNG element, e.g., "business analytics", "team meeting"), imageId? }' }
  ],
  report: [
    { key: 'title', label: 'Report Title', type: 'string', required: true, maxChars: 120, description: 'Executive title' },
    { key: 'executiveSummary', label: 'Executive Summary', type: 'string', required: true, maxChars: 1200, description: 'Summary of conclusions' },
    { key: 'kpis', label: 'Key Performance Indicators', type: 'object[]', required: false, maxItems: 6, description: 'List of { label, value, trend? }' },
    { key: 'sections', label: 'Analytical Sections', type: 'object[]', required: true, maxItems: 8, description: 'List of { heading, body, table?: { headers: string[], rows: string[][] } }' },
    { key: 'recommendations', label: 'Recommendations', type: 'string[]', required: true, maxItems: 8, description: 'Recommended practical actions' }
  ],
  flashcards: [
    { key: 'deckTitle', label: 'Quiz Title', type: 'string', required: true, maxChars: 100, description: 'Quiz name' },
    { key: 'cards', label: 'Quiz Questions', type: 'object[]', required: true, maxItems: 30, description: 'List of multiple-choice questions: { front (question text), options: string[] (4 choices), correctIndex: number (0 to 3), back (correct answer), explanation (answer with rationale), citationLocator }' }
  ],
  mindmap: [
    { key: 'rootLabel', label: 'Central Topic', type: 'string', required: true, maxChars: 80, description: 'Central node of the mind map' },
    { key: 'mode', label: 'Mode', type: 'string', required: true, maxChars: 20, description: 'mindmap' },
    { key: 'nodes', label: 'Nodes', type: 'object[]', required: true, maxItems: 24, description: 'List of { id, label, detail?, children?: [{ label, detail? }], citationLocator? }' }
  ],
  xlsx: [
    { key: 'workbookTitle', label: 'Workbook Title', type: 'string', required: true, maxChars: 90, description: 'File/report name' },
    { key: 'sheets', label: 'Sheets', type: 'object[]', required: true, maxItems: 6, description: 'List of { name, headers: string[], rows: Array<Array<string|number>>, summaryFormulaRow?: boolean }' }
  ],
  resume: [
    { key: 'fullName', label: 'Full Name', type: 'string', required: true, maxChars: 100, description: 'Professional name' },
    { key: 'headline', label: 'Position / Objective', type: 'string', required: true, maxChars: 120, description: 'Professional title' },
    { key: 'summary', label: 'Professional Summary', type: 'string', required: true, maxChars: 600, description: 'Summary of experience' },
    { key: 'experiences', label: 'Experience', type: 'object[]', required: true, maxItems: 8, description: 'List of { role, company, period, achievements: string[] }' },
    { key: 'skills', label: 'Skills', type: 'string[]', required: true, maxItems: 16, description: 'Technical and behavioral skills' }
  ],
  lesson_plan: [
    { key: 'title', label: 'Lesson Topic', type: 'string', required: true, maxChars: 120, description: 'Lesson title' },
    { key: 'gradeAndDuration', label: 'Grade and Duration', type: 'string', required: true, maxChars: 80, description: 'E.g., 9th Grade • 50 min' },
    { key: 'objectives', label: 'Learning Objectives', type: 'string[]', required: true, maxItems: 6, description: 'Clear objectives' },
    { key: 'stages', label: 'Lesson Stages', type: 'object[]', required: true, maxItems: 6, description: 'List of { phase, minutes, activity, resources }' },
    { key: 'assessment', label: 'Assessment', type: 'string', required: true, maxChars: 400, description: 'Assessment criterion' }
  ],
  meeting_minutes: [
    { key: 'title', label: 'Meeting Title', type: 'string', required: true, maxChars: 120, description: 'Agenda/Title' },
    { key: 'dateAndParticipants', label: 'Date and Participants', type: 'string', required: true, maxChars: 300, description: 'Date, location, and list of attendees' },
    { key: 'decisions', label: 'Decisions', type: 'string[]', required: true, maxItems: 12, description: 'Decisions made' },
    { key: 'actionItems', label: 'Action Plan', type: 'object[]', required: true, maxItems: 12, description: 'List of { task, owner, deadline }' }
  ],
  contract: [
    { key: 'title', label: 'Instrument Title', type: 'string', required: true, maxChars: 120, description: 'Type of contract/agreement' },
    { key: 'parties', label: 'Party Details', type: 'string[]', required: true, maxItems: 4, description: 'Parties involved' },
    { key: 'clauses', label: 'Clauses', type: 'object[]', required: true, maxItems: 15, description: 'List of { number, title, text }' }
  ],
  faq: [
    { key: 'title', label: 'FAQ Title', type: 'string', required: true, maxChars: 120, description: 'Title' },
    { key: 'items', label: 'Questions and Answers', type: 'object[]', required: true, maxItems: 20, description: 'List of { question, answer, category? }' }
  ],
  newsletter: [
    { key: 'title', label: 'Issue Title', type: 'string', required: true, maxChars: 100, description: 'Main topic' },
    { key: 'lead', label: 'Opening Editorial', type: 'string', required: true, maxChars: 450, description: 'Introductory text' },
    { key: 'blocks', label: 'Highlights', type: 'object[]', required: true, maxItems: 6, description: 'List of { heading, body, ctaText? }' }
  ]
}

function tpl(
  id: string,
  toolId: ToolId,
  name: string,
  description: string,
  category: string,
  tokens: Partial<DesignTokens>,
  styleGuideForAgent: string,
  opts: Partial<TemplateManifest> = {}
): TemplateManifest {
  return {
    id,
    toolId,
    name,
    description,
    category,
    locales: ['pt-BR', 'en-US', 'es', 'fr', 'de', 'it'],
    orientation: opts.orientation || (toolId === 'pptx' || toolId === 'video' ? 'landscape' : 'portrait'),
    pageFormat: opts.pageFormat || (toolId === 'pptx' || toolId === 'video' ? '16:9' : toolId === 'podcast' ? 'audio' : 'A4'),
    version: '1.0.0',
    layoutPreset: opts.layoutPreset || (category === 'academico' || category === 'oficial' ? 'classic' : category === 'tecnico' ? 'tech_dark' : 'executive'),
    license: opts.license || MIT_MOMAI_LICENSE,
    designTokens: makeTokens(tokens),
    slots: SLOTS_BY_TOOL[toolId],
    styleGuideForAgent,
    ...opts
  }
}

export const BUILTIN_TEMPLATES: TemplateManifest[] = [
  // OFFICIAL LETTERS (5)
  tpl('oficio-mrpr', 'oficio', 'Ofício Oficial (Padrão MRPR)', 'Segue a 3ª ed. do Manual de Redação da Presidência da República: preto no branco, sem adornos.', 'oficial', { primary: '#111827', secondary: '#374151', accent: '#111827', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Use formal official language, a salutation appropriate to the recipient rank, a concise subject in bold, and the closing "Respectfully," or "Sincerely,".', { layoutPreset: 'classic' }),
  tpl('oficio-corporativo', 'oficio', 'Carta Corporativa Executiva', 'Layout sobrio com linha institucional discreta no topo para comunicações empresariais.', 'corporativo', { primary: '#111827', secondary: '#475569', accent: '#334155' }, 'Cordial, direct tone focused on business decisions.', { layoutPreset: 'executive' }),
  tpl('oficio-juridico', 'oficio', 'Notificação / Requerimento Jurídico', 'Tipografia clássica serifada preto no branco para petições e notificações extrajudiciais.', 'juridico', { primary: '#111827', secondary: '#374151', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Cite legal provisions, dates, and facts exactly as stated in the sources.', { layoutPreset: 'classic' }),
  tpl('oficio-academico', 'oficio', 'Ofício Acadêmico / Universitário', 'Ideal para solicitações a coordenações, reitorias, bancas e órgãos de fomento.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#334155', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Respectful academic tone, identifying the program, registration number, or application notice.', { layoutPreset: 'academic' }),
  tpl('oficio-comunicado', 'oficio', 'Comunicado / Memorando Interno', 'Formato enxuto para circulares, avisos operacionais e memorandos.', 'corporativo', { primary: '#18181B', secondary: '#52525B', accent: '#3F3F46' }, 'Short paragraphs with deadlines and responsible parties clearly highlighted.', { layoutPreset: 'minimal' }),

  // APOSTILAS (5)
  tpl('apostila-modular', 'apostila', 'Apostila Técnica Modular', 'Capítulos com objetivos, quadros de destaque, exercícios comentados e glossário.', 'educacao', { primary: '#1E293B', accent: '#0284C7' }, 'Organize content in a progressive instructional sequence with examples from the sources and exercises at the end of each chapter.', { layoutPreset: 'modern' }),
  tpl('apostila-concurso', 'apostila', 'Preparatório Intensivo / Concurso', 'Foco em pontos-chave, tabelas comparativas, pegadinhas comuns e questões de fixação.', 'educacao', { primary: '#1E293B', accent: '#D97706' }, 'Highlight rules, exceptions, and deadlines in concise callouts.', { layoutPreset: 'whiteboard' }),
  tpl('apostila-onboarding', 'apostila', 'Manual de Treinamento Corporativo', 'Guia prático de processos internos, fluxos e boas práticas.', 'corporativo', { primary: '#1E293B', accent: '#0D9488' }, 'Clear step-by-step language with an operational checklist.', { layoutPreset: 'executive' }),
  tpl('apostila-lab', 'apostila', 'Caderno de Laboratório / Oficina', 'Estrutura prática voltada a experimentos, roteiros e análise de resultados.', 'tecnico', { primary: '#111827', accent: '#2563EB', monoFont: 'JetBrains Mono' }, 'Separate brief theory, step-by-step procedure, and verification questions.', { layoutPreset: 'minimal' }),
  tpl('apostila-editorial', 'apostila', 'Livro-Texto Universitário', 'Tipografia Merriweather de leitura confortável para materiais extensos.', 'academico', { primary: '#1C1917', accent: '#B45309', surface: '#FAF9F6', surfaceAlt: '#F3F1EC', headingFont: 'Merriweather', bodyFont: 'Merriweather' }, 'In-depth writing with conceptual rigor and complete citations.', { layoutPreset: 'editorial' }),

  // ABNT (5)
  tpl('abnt-tcc', 'abnt', 'TCC / Monografia Completa (NBR 14724)', 'Margens 3/2cm, folha de rosto, resumo, abstract, citações NBR 10520 e referências NBR 6023.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#111827', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Follow ABNT standards strictly: impersonal third person, author-date citations, and ordered references.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),
  tpl('abnt-artigo', 'abnt', 'Artigo Científico ABNT (NBR 6022)', 'Estrutura de artigo científico com resumo, palavras-chave, introdução, desenvolvimento e conclusão.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#111827', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Concise scientific writing with explicit grounding in the sources.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),
  tpl('abnt-projeto', 'abnt', 'Projeto de Pesquisa / Qualificação', 'Inclui problema, objetivos, justificativa, referencial teórico e metodologia.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Structure the problem, hypotheses, and methodology from the sources.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'academic' }),
  tpl('abnt-relatorio', 'abnt', 'Relatório Técnico-Científico (NBR 10719)', 'Relatório formal com objetivos, procedimentos, resultados e conclusões.', 'tecnico', { primary: '#111827', secondary: '#374151', accent: '#1F2937', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Present data, tables, and technical conclusions objectively.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),
  tpl('abnt-resenha', 'abnt', 'Resenha Crítica / Fichamento', 'Análise estruturada de obra ou conjunto de artigos com citações diretas e indiretas.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#374151', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Clearly distinguish the synthesis of the work from source-grounded critical analysis.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),

  // FOLHA TIMBRADA (5)
  tpl('timbrado-oficio', 'letterhead', 'Ofício em Papel Timbrado', 'Preserva cabeçalho, rodapé e marca d’água originais inserindo o ofício apenas na zona segura.', 'oficial', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Respect the usable area of the letterhead and fill any detected {{campo}} or ____ blanks.', { layoutPreset: 'classic' }),
  tpl('timbrado-parecer', 'letterhead', 'Parecer Técnico em Timbrado', 'Composição de parecer estruturado (Ementa, Fatos, Análise, Conclusão) sobre o timbrado original.', 'juridico', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Organize content into numbered sections with a clear conclusion.', { layoutPreset: 'classic' }),
  tpl('timbrado-declaracao', 'letterhead', 'Declaração / Atestado em Timbrado', 'Texto centralizado/justificado curto com destaque de título e bloco de assinatura.', 'oficial', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Concise text in one or two paragraphs with place, date, and signature.', { layoutPreset: 'classic' }),
  tpl('timbrado-proposta', 'letterhead', 'Proposta Comercial em Timbrado', 'Estrutura de escopo, entregas, cronograma e investimento preservando a identidade visual.', 'corporativo', { primary: '#111827', accent: '#334155' }, 'Highlight deliverables, assumptions, and commercial terms based on the sources.', { layoutPreset: 'executive' }),
  tpl('timbrado-formulario', 'letterhead', 'Preenchimento de Formulário / Lacunas', 'Detecta e preenche automaticamente lacunas (____, {{campo}}, tabelas) do arquivo timbrado.', 'geral', { primary: '#1F2937', accent: '#374151' }, 'Extract exact values from the sources to fill each form field.', { layoutPreset: 'minimal' }),

  // POWERPOINT (6)
  tpl('pptx-executivo', 'pptx', 'Executivo Clean (16:9)', 'Design corporativo limpo com alta legibilidade, cards de métricas e gráficos nativos.', 'corporativo', { primary: '#1E293B', accent: '#2563EB', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'At most 5 short bullets per slide (up to 12 words each) and detailed speaker notes.', { layoutPreset: 'executive' }),
  tpl('pptx-pitch', 'pptx', 'Pitch Deck de Produto', 'Narrativa problema → solução → dados → tração → próximos passos.', 'corporativo', { primary: '#111827', accent: '#0D9488', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'High-impact visual slides with real numbers from the sources.', { layoutPreset: 'modern' }),
  tpl('pptx-aula', 'pptx', 'Aula Magna / Acadêmico', 'Slides didáticos com definições, exemplos, linha do tempo e síntese final.', 'educacao', { primary: '#1C1917', accent: '#B45309', surface: '#FAF9F6', surfaceAlt: '#F4F3EF', headingFont: 'Merriweather', bodyFont: 'Inter' }, 'Prioritize instructional clarity and citations at the bottom of the notes.', { layoutPreset: 'editorial' }),
  tpl('pptx-dados', 'pptx', 'Relatório de Resultados & BI', 'Foco em gráficos nativos editáveis, KPIs e comparativos.', 'dados', { primary: '#1E293B', accent: '#0284C7', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'Use "metrics" and "chart" layouts whenever the sources contain quantitative data.', { layoutPreset: 'minimal' }),
  tpl('pptx-workshop', 'pptx', 'Workshop Interativo', 'Estrutura dinâmica com perguntas disparadoras, dinâmicas e takeaways.', 'educacao', { primary: '#1E293B', accent: '#7C3AED', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'Include reflection questions and practical exercises.', { layoutPreset: 'playful' }),
  tpl('pptx-dark-tech', 'pptx', 'Dark Tech / Engenharia', 'Paleta escura de alto contraste para apresentações técnicas e arquitetura.', 'tecnico', { primary: '#FFFFFF', accent: '#38BDF8', surface: '#0B0F17', surfaceAlt: '#151B26', textPrimary: '#FAFAFA', textMuted: '#94A3B8', border: '#263042' }, 'Direct and concise, with flow diagrams and technical metrics.', { layoutPreset: 'tech_dark' }),

  // PODCAST (5)
  tpl('podcast-conversa', 'podcast', 'Conversa Deep-Dive (2 Hosts)', 'Diálogo natural e envolvente entre dois apresentadores explorando as fontes em profundidade.', 'audio', { primary: '#1E293B', accent: '#0284C7' }, 'Natural alternation between hostA (guide host) and hostB (curious analyst), with pauses and emphasis.'),
  tpl('podcast-debate', 'podcast', 'Debate Ponto e Contraponto', 'Dois apresentadores analisam prós, contras, riscos e evidências presentes nas fontes.', 'audio', { primary: '#1E293B', accent: '#DC2626' }, 'Maintain argumentative balance grounded strictly in the evidence from the sources.'),
  tpl('podcast-aula', 'podcast', 'Aula em Áudio (Professor + Aluno)', 'Formato didático em que perguntas do aluno destravam explicações claras do professor.', 'educacao', { primary: '#1E293B', accent: '#059669' }, 'Use analogies faithful to the sources and recaps by chapter.'),
  tpl('podcast-briefing', 'podcast', 'Briefing Executivo (3 min)', 'Resumo matinal direto ao ponto com os principais fatos, números e decisões.', 'corporativo', { primary: '#111827', accent: '#2563EB' }, 'Short, objective lines without digressions, focused on impact and action.'),
  tpl('podcast-revisao', 'podcast', 'Revisão Rápida para Prova', 'Perguntas e respostas em ritmo ágil para fixação de conteúdo.', 'educacao', { primary: '#1C1917', accent: '#D97706' }, 'Alternate quick questions with concise explanations and citations to the relevant passage.'),

  // EXPLAINER VIDEO SVG (5)
  tpl('video-quadro-branco', 'video', 'Quadro Branco Didático (16:9)', 'Fundo claro editorial com listas animadas, mapas conceituais e citações.', 'educacao', { primary: '#1E293B', accent: '#0284C7', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'Clear narration of 15 to 25 words per scene; vary the SVG components between scenes.', { layoutPreset: 'whiteboard' }),
  tpl('video-dados', 'video', 'Apresentação Dinâmica de Dados (16:9)', 'Foco em métricas animadas, gráficos de barras e comparativos visuais.', 'dados', { primary: '#FFFFFF', accent: '#38BDF8', surface: '#0B0F17', surfaceAlt: '#151B26', textPrimary: '#FAFAFA', textMuted: '#94A3B8', border: '#263042' }, 'Highlight exact numbers from the sources in MetricCounterGridScene and BarChartScene.', { layoutPreset: 'tech_dark' }),
  tpl('video-timeline', 'video', 'Linha do Tempo & Processo (16:9)', 'Ideal para evolução histórica, etapas de projeto ou fluxos de trabalho.', 'geral', { primary: '#1E293B', accent: '#0D9488', surface: '#FAF9F6', surfaceAlt: '#F3F1EC' }, 'Use TimelineScene and ProcessFlowScene with ordered milestones.', { layoutPreset: 'editorial' }),
  tpl('video-vertical', 'video', 'Resumo Vertical Shorts/Reels (9:16)', 'Formato vertical otimizado para celular com texto grande e ritmo ágil.', 'social', { primary: '#FAFAFA', accent: '#F59E0B', surface: '#111315', surfaceAlt: '#1B1E22', textPrimary: '#FAFAFA', textMuted: '#A1A1AA', border: '#2E3238' }, 'Short scenes (5 to 7 scenes), short titles, and a strong focus on retention.', { orientation: 'portrait', pageFormat: '9:16', layoutPreset: 'modern' }),
  tpl('video-comparativo', 'video', 'Comparativo Técnico Visual (16:9)', 'Compara alternativas, cenários ou normativas lado a lado.', 'corporativo', { primary: '#1E293B', accent: '#2563EB', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'Prioritize ComparisonSplitScene and TableHighlightScene.', { layoutPreset: 'executive' }),

  // REPORTS (5)
  tpl('report-onepager', 'report', 'One-Pager Executivo', 'Síntese de 1 a 2 páginas com KPIs no topo, achados e plano de ação.', 'corporativo', { primary: '#1E293B', accent: '#2563EB' }, 'Maximum concision: executive summary, 3 to 4 KPIs, and actionable recommendations.', { layoutPreset: 'executive' }),
  tpl('report-dados', 'report', 'Relatório Analítico de Dados', 'Tabelas estruturadas, comparativos e interpretações baseadas nas fontes.', 'dados', { primary: '#1E293B', accent: '#0284C7' }, 'Always include comparative tables and highlight real percentage variations.', { layoutPreset: 'modern' }),
  tpl('report-diagnostico', 'report', 'Diagnóstico e Plano de Ação', 'Mapeia problemas encontrados nas fontes, causas raiz e ações recomendadas.', 'corporativo', { primary: '#1E293B', accent: '#DC2626' }, 'Link each recommendation to the corresponding evidence in the sources.', { layoutPreset: 'whiteboard' }),
  tpl('report-financeiro', 'report', 'Relatório Operacional / Financeiro', 'Estrutura sobria para prestação de contas, orçamento e resultados.', 'corporativo', { primary: '#1E293B', accent: '#059669' }, 'Maintain absolute numerical accuracy according to the sources.', { layoutPreset: 'minimal' }),
  tpl('report-dossie', 'report', 'Dossiê de Pesquisa Consolidado', 'Consolidação multi-fonte com cruzamento de evidências e referências.', 'academico', { primary: '#1C1917', accent: '#B45309', surface: '#FAF9F6', surfaceAlt: '#F3F1EC' }, 'Cross-check multiple sources, identifying convergences and divergences.', { layoutPreset: 'editorial' }),

  // ESTUDO / DADOS / COMPLEMENTARES
  tpl('flashcards-simulado', 'flashcards', 'Quiz Comentado (Múltipla Escolha)', 'Questões com 4 alternativas, feedback imediato, nota final e gabarito comentado.', 'educacao', { primary: '#1E293B', accent: '#2563EB' }, 'Create multiple-choice questions based on the topic with 4 plausible options, only 1 correct answer, back equal to the correct option, and an explanation citing the source.'),
  tpl('flashcards-anki', 'flashcards', 'Quiz Rápido (Revisão Ativa)', 'Questões objetivas de múltipla escolha com correção na hora e exportação CSV/Anki.', 'educacao', { primary: '#1E293B', accent: '#0284C7' }, 'One atomic idea per question; a clear question in front, 4 options in options, correctIndex from 0 to 3, and a concise answer in back.'),
  tpl('mindmap-radial', 'mindmap', 'Mapa Mental Hierárquico', 'Estrutura radial do tema central em ramos e sub-tópicos.', 'educacao', { primary: '#1E293B', accent: '#0D9488' }, 'Short labels (2 to 5 words) with optional detail.'),
  tpl('mindmap-conceitual', 'mindmap', 'Mapa Mental Conceitual', 'Conecta conceitos-chave, relações e sub-tópicos em ramos orgânicos.', 'academico', { primary: '#1E293B', accent: '#2563EB' }, 'Group main concepts into 4 to 6 branches with concise subtopics.'),
  tpl('xlsx-analitico', 'xlsx', 'Planilha Analítica Multi-Aba', 'Abas estruturadas com somatórios/médias automáticas e aba de fontes.', 'dados', { primary: '#1E293B', accent: '#059669' }, 'Normalize numbers as actual numeric values (not strings) to allow formulas.'),
  tpl('extra-curriculo', 'resume', 'Currículo Profissional', 'Layout limpo compatível com sistemas ATS de recrutamento.', 'carreira', { primary: '#111827', accent: '#374151' }, 'Use action verbs and measurable results drawn from the user sources.', { layoutPreset: 'minimal' }),
  tpl('extra-plano-aula', 'lesson_plan', 'Plano de Aula Estruturado', 'Objetivos, etapas cronometradas, recursos e avaliação.', 'educacao', { primary: '#1E293B', accent: '#0D9488' }, 'Structure realistic timing and activities aligned with the reference material.', { layoutPreset: 'executive' }),
  tpl('extra-ata', 'meeting_minutes', 'Ata de Reunião Executiva', 'Registro formal de participantes, decisões e responsáveis.', 'corporativo', { primary: '#111827', accent: '#374151' }, 'Extract only decisions, responsible parties, and deadlines actually recorded.', { layoutPreset: 'classic' }),
  tpl('extra-contrato', 'contract', 'Contrato-Modelo', 'Cláusulas numeradas organizadas por objeto, obrigações, prazo e foro.', 'juridico', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Flag fields that depend on specific missing data with [FILL].', { layoutPreset: 'classic' }),
  tpl('extra-faq', 'faq', 'FAQ / Base de Conhecimento', 'Perguntas frequentes agrupadas por categoria.', 'geral', { primary: '#1E293B', accent: '#0284C7' }, 'Direct, verifiable answers grounded in the sources.', { layoutPreset: 'minimal' }),
  tpl('extra-newsletter', 'newsletter', 'Newsletter / Boletim Informativo', 'Editorial de abertura e blocos de destaque prontos para envio.', 'comunicacao', { primary: '#1C1917', accent: '#D97706', surface: '#FAF9F6', surfaceAlt: '#F3F1EC' }, 'Engaging tone with clear calls to action based on the documents.', { layoutPreset: 'editorial' })
]

const VISUAL_THEME_EXPANSIONS: Array<{
  slug: string
  label: string
  desc: string
  category: string
  preset: TemplateManifest['layoutPreset']
  tokens: Partial<DesignTokens>
  guide: string
}> = [
  { slug: 'nordic-clean', label: 'Nordic Clean', desc: 'Visual escandinavo limpo com amplo respiro e contraste suave.', category: 'minimal', preset: 'minimal', tokens: { primary: '#1E293B', accent: '#3B82F6', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Prioritize concision, clear hierarchy, and short blocks.' },
  { slug: 'navy-exec', label: 'Executivo Navy', desc: 'Azul-marinho institucional com acento dourado discreto.', category: 'corporativo', preset: 'executive', tokens: { primary: '#0F2942', accent: '#B45309', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Objective executive tone focused on decisions and metrics.' },
  { slug: 'forest-sage', label: 'Botânico & Sustentável', desc: 'Verde-floresta profundo com fundo claro orgânico.', category: 'corporativo', preset: 'editorial', tokens: { primary: '#1E293B', accent: '#15803D', surface: '#FFFFFF', surfaceAlt: '#F8FAF8' }, guide: 'Highlight impact, sustainability, and clarity.' },
  { slug: 'terracota-warm', label: 'Terracota Editorial', desc: 'Tipografia quente e acolhedora com acento terracota.', category: 'editorial', preset: 'editorial', tokens: { primary: '#1C1917', accent: '#C2410C', surface: '#FAF9F6', surfaceAlt: '#F5F2EC', headingFont: 'Merriweather', bodyFont: 'Inter' }, guide: 'Fluid editorial style with citations and callouts.' },
  { slug: 'slate-mono', label: 'Grafite Monocromático', desc: 'Escala de cinza de alto contraste sem distrações.', category: 'oficial', preset: 'classic', tokens: { primary: '#111827', accent: '#374151', surface: '#FFFFFF', surfaceAlt: '#F3F4F6' }, guide: 'Maximum sobriety and factual precision.' },
  { slug: 'oceano-bi', label: 'Oceano & Dados', desc: 'Azul-petróleo e ciano voltado a indicadores e tabelas.', category: 'dados', preset: 'modern', tokens: { primary: '#0F172A', accent: '#0284C7', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Emphasize numbers, comparisons, and trends.' },
  { slug: 'amber-atelier', label: 'Ateliê Âmbar', desc: 'Fundo creme editorial com destaques em âmbar.', category: 'criativo', preset: 'playful', tokens: { primary: '#1C1917', accent: '#D97706', surface: '#FFFDF8', surfaceAlt: '#F7F4EC' }, guide: 'Instructional approach with practical examples and tables.' },
  { slug: 'midnight-slate', label: 'Midnight Dark', desc: 'Modo escuro elegante com alto contraste para tela.', category: 'tecnico', preset: 'tech_dark', tokens: { primary: '#FFFFFF', accent: '#38BDF8', surface: '#0B0F17', surfaceAlt: '#151B26', textPrimary: '#FAFAFA', textMuted: '#94A3B8', border: '#263042' }, guide: 'Direct and concise, with a high-contrast visual structure.' },
  { slug: 'carbon-emerald', label: 'Carbono & Esmeralda', desc: 'Fundo escuro técnico com acento esmeralda.', category: 'tecnico', preset: 'tech_dark', tokens: { primary: '#FAFAFA', accent: '#10B981', surface: '#111315', surfaceAlt: '#1B1E22', textPrimary: '#FAFAFA', textMuted: '#9CA3AF', border: '#2E3238' }, guide: 'Focus on architecture, processes, and exact metrics.' },
  { slug: 'swiss-grid', label: 'Grid Suíço', desc: 'Composição geométrica precisa inspirada no design suíço.', category: 'moderno', preset: 'modern', tokens: { primary: '#111827', accent: '#DC2626', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Strong headings and well-aligned short blocks.' },
  { slug: 'bordeaux-classic', label: 'Clássico Bordô', desc: 'Elegância acadêmica e jurídica em bordô e serifas.', category: 'academico', preset: 'academic', tokens: { primary: '#18181B', accent: '#9F1239', surface: '#FFFFFF', surfaceAlt: '#FBF9F9', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, guide: 'Formal, rigorous, well-grounded language.' },
  { slug: 'teal-studio', label: 'Estúdio Petrol', desc: 'Verde-petróleo moderno equilibrado para apresentações e guias.', category: 'educacao', preset: 'executive', tokens: { primary: '#1E293B', accent: '#0D9488', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Instructional clarity and visual synthesis.' },
  { slug: 'whiteboard-sketch', label: 'Quadro Didático', desc: 'Moldura leve de quadro branco para ensino e workshops.', category: 'educacao', preset: 'whiteboard', tokens: { primary: '#1E293B', accent: '#2563EB', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Organize content into visual steps and key questions.' },
  { slug: 'sand-minimal', label: 'Areia & Papel', desc: 'Tom papel quente de leitura confortável e sem fadiga.', category: 'editorial', preset: 'editorial', tokens: { primary: '#292524', accent: '#78716C', surface: '#FAF8F5', surfaceAlt: '#F5F0EB', headingFont: 'Merriweather', bodyFont: 'Inter' }, guide: 'Fluid narrative with well-integrated citations.' },
  { slug: 'cobalt-pro', label: 'Cobalto Profissional', desc: 'Azul-cobalto limpo para propostas, relatórios e decks.', category: 'corporativo', preset: 'modern', tokens: { primary: '#1E293B', accent: '#2563EB', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Highlight deliverables, goals, and results.' }
]

const TOOLS_TO_ENSURE_15: ToolId[] = [
  'oficio',
  'apostila',
  'abnt',
  'letterhead',
  'pptx',
  'podcast',
  'video',
  'report',
  'flashcards',
  'mindmap',
  'xlsx',
  'resume',
  'lesson_plan',
  'meeting_minutes'
]

for (const toolId of TOOLS_TO_ENSURE_15) {
  const existingCount = BUILTIN_TEMPLATES.filter((t) => t.toolId === toolId).length
  const needed = Math.max(0, 15 - existingCount)
  const isStrictFormalTool = toolId === 'oficio' || toolId === 'abnt' || toolId === 'meeting_minutes'
  const isLandscapeTool = toolId === 'pptx' || toolId === 'video'
  for (let i = 0; i < needed; i++) {
    const theme = VISUAL_THEME_EXPANSIONS[i % VISUAL_THEME_EXPANSIONS.length]
    const tokens = isStrictFormalTool
      ? { primary: '#111827', secondary: '#374151', accent: '#1F2937', headingFont: theme.tokens.headingFont || 'Liberation Sans', bodyFont: theme.tokens.bodyFont || 'Liberation Sans' }
      : theme.tokens
    BUILTIN_TEMPLATES.push(
      tpl(
        `${toolId}-${theme.slug}`,
        toolId,
        theme.label,
        theme.desc,
        theme.category,
        tokens,
        theme.guide,
        {
          layoutPreset: isStrictFormalTool ? 'classic' : theme.preset,
          orientation: isLandscapeTool ? 'landscape' : 'portrait',
          pageFormat: isLandscapeTool ? '16:9' : toolId === 'podcast' ? 'audio' : 'A4'
        }
      )
    )
  }
}

export class TemplateRegistry {
  private customTemplates: TemplateManifest[] = []

  setCustomTemplates(list: TemplateManifest[]): void {
    this.customTemplates = list
  }

  getAll(): TemplateManifest[] {
    return [...BUILTIN_TEMPLATES, ...this.customTemplates]
  }

  getById(id: string): TemplateManifest | undefined {
    return this.getAll().find((t) => t.id === id)
  }

  getDefaultForTool(toolId: ToolId): TemplateManifest {
    return this.getAll().find((t) => t.toolId === toolId) || BUILTIN_TEMPLATES[0]
  }

  selectBestForContext(toolId: ToolId, queryText?: string, profile?: string): TemplateManifest {
    const candidates = this.search({ toolId })
    if (candidates.length === 0) return this.getDefaultForTool(toolId)
    const q = `${queryText || ''} ${profile || ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    if (!q) return candidates[0]

    const keywordRules: Array<{ terms: string[]; matchers: string[]; bonus: number }> = [
      {
        terms: ['concurso', 'edital', 'vestibular', 'enem', 'oab', 'prova', 'gabarito', 'simulado', 'banca', 'prefeitura', 'exam', 'test', 'prep', 'examen', 'concours', 'pruefung', 'concorso'],
        matchers: ['concurso', 'preparatorio', 'intensivo', 'whiteboard', 'estudo'],
        bonus: 12
      },
      {
        terms: ['corporativo', 'empresa', 'onboarding', 'treinamento', 'rh', 'processo', 'compliance', 'manual', 'equipe', 'corporate', 'training', 'handbook', 'enterprise', 'empresa', 'formation', 'unternehmen', 'aziendale'],
        matchers: ['onboarding', 'corporativo', 'treinamento', 'executive', 'negocios'],
        bonus: 12
      },
      {
        terms: ['laboratorio', 'oficina', 'pratica', 'experimento', 'codigo', 'tecnico', 'engenharia', 'ti', 'software', 'lab', 'workshop', 'engineering', 'technical', 'code', 'taller', 'atelier', 'technik'],
        matchers: ['lab', 'tecnico', 'oficina', 'tech', 'minimal'],
        bonus: 12
      },
      {
        terms: ['universitario', 'academico', 'tcc', 'monografia', 'artigo', 'dissertacao', 'pesquisa', 'ciencia', 'livro', 'academic', 'university', 'thesis', 'paper', 'research', 'universidad', 'these', 'wissenschaft'],
        matchers: ['editorial', 'academico', 'universitario', 'abnt', 'academic'],
        bonus: 12
      },
      {
        terms: ['infantil', 'crianca', 'ludico', 'escola', 'fundamental', 'alfabetizacao', 'kids', 'playful', 'school', 'children', 'ninos', 'enfants', 'kinder', 'bambini'],
        matchers: ['playful', 'ludico', 'criativo', 'educacao'],
        bonus: 10
      },
      {
        terms: ['executivo', 'diretoria', 'board', 'financeiro', 'kpi', 'resultado', 'balanco', 'executive', 'financial', 'quarterly', 'revenue', 'finanzas', 'financier', 'finanzen', 'finanziario'],
        matchers: ['executivo', 'executive', 'financeiro', 'corporativo'],
        bonus: 10
      },
      {
        terms: ['minimal', 'limpo', 'clean', 'simples', 'simple', 'modern', 'moderno'],
        matchers: ['minimal', 'modern', 'clean'],
        bonus: 6
      }
    ]

    let best = candidates[0]
    let bestScore = -1
    for (const tpl of candidates) {
      const hay = `${tpl.id} ${tpl.name} ${tpl.description} ${tpl.category} ${tpl.layoutPreset || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      let score = 0
      for (const rule of keywordRules) {
        if (rule.terms.some((t) => q.includes(t)) && rule.matchers.some((m) => hay.includes(m))) {
          score += rule.bonus
        }
      }
      for (const token of q.split(/\s+/)) {
        if (token.length >= 4 && hay.includes(token)) score += 3
      }
      if (score > bestScore) {
        bestScore = score
        best = tpl
      }
    }

    return bestScore <= 0 ? candidates[0] : best
  }

  search(opts: { toolId?: string; category?: string; query?: string; locale?: string } = {}): TemplateManifest[] {
    const q = (opts.query || '').trim().toLowerCase()
    const locale = normalizeLocale(opts.locale)
    return this.getAll().filter((t) => {
      if (opts.toolId && t.toolId !== opts.toolId) return false
      if (opts.category && t.category !== opts.category && translateCore(locale, t.category) !== opts.category) return false
      if (q) {
        const hay = `${t.name} ${t.description} ${t.category} ${t.toolId} ${translateCore(locale, t.name)} ${translateCore(locale, t.description)} ${translateCore(locale, t.category)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }

  applyBrandKit(template: TemplateManifest, brandKit?: BrandKit | null): DesignTokens {
    if (!brandKit) return template.designTokens
    const isLegacyDefault =
      brandKit.primaryColor === '#1E3A8A' && brandKit.accentColor === '#7C3AED'
    if (isLegacyDefault) return template.designTokens
    return {
      ...template.designTokens,
      primary: brandKit.primaryColor || template.designTokens.primary,
      secondary: brandKit.secondaryColor || template.designTokens.secondary,
      accent: brandKit.accentColor || template.designTokens.accent,
      headingFont: brandKit.headingFont || template.designTokens.headingFont,
      bodyFont: brandKit.bodyFont || template.designTokens.bodyFont
    }
  }
}

export const templateRegistry = new TemplateRegistry()
