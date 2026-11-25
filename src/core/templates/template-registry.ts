import type { BrandKit, DesignTokens, LicenseMetadata, SlotConstraint, TemplateManifest, ToolId } from '../types.ts'

export const COMMERCIAL_FONTS_LICENSES: Array<{
  family: string
  role: string
  license: LicenseMetadata
}> = [
    {
      family: 'Inter',
      role: 'Sans-serif moderna para relatórios, slides e UI',
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
      role: 'Serifada métrica equivalente à Times New Roman (norma ABNT)',
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
      role: 'Sans-serif métrica equivalente à Arial (norma ABNT e ofícios)',
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
      role: 'Serifada editorial para apostilas e citações de destaque',
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
      role: 'Monoespaçada para códigos, fórmulas e tabelas técnicas',
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
  name: 'MIT License (Normas ABNT NBR 14724/10520/6023; referência estrutural abnTeX2 LPPL-1.3c)',
  author: 'MomAI Docs Studio / abnTeX2 reference',
  url: 'https://www.abntex.net.br/',
  commercialUseAllowed: true,
  attributionRequired: true,
  attributionText: 'Formatação ABNT inspirada na especificação aberta abnTeX2 (LPPL 1.3c).'
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
    { key: 'documentNumber', label: 'Número do Ofício', type: 'string', required: true, maxChars: 60, description: 'Ex: Ofício nº 042/2026-GAB' },
    { key: 'placeAndDate', label: 'Local e Data', type: 'string', required: true, maxChars: 80, description: 'Cidade, dia de mês de ano' },
    { key: 'recipientTitle', label: 'Vocativo / Destinatário', type: 'string', required: true, maxChars: 140, description: 'Cargo e tratamento do destinatário' },
    { key: 'subject', label: 'Assunto', type: 'string', required: true, maxChars: 160, description: 'Síntese objetiva do assunto' },
    { key: 'paragraphs', label: 'Parágrafos do Corpo', type: 'string[]', required: true, maxItems: 10, description: 'Parágrafos numerados ou corridos fundamentados nas fontes' },
    { key: 'closing', label: 'Fecho Oficial', type: 'string', required: true, maxChars: 80, description: 'Ex: Respeitosamente, / Atenciosamente,' },
    { key: 'signerName', label: 'Signatário', type: 'string', required: true, maxChars: 100, description: 'Nome e cargo do remetente' }
  ],
  apostila: [
    { key: 'title', label: 'Título da Apostila', type: 'string', required: true, maxChars: 120, description: 'Título principal' },
    { key: 'subtitle', label: 'Subtítulo', type: 'string', required: false, maxChars: 180, description: 'Ementa ou subtítulo' },
    { key: 'presentation', label: 'Apresentação', type: 'string', required: false, maxChars: 600, description: 'Breve introdução didática e propósito do material' },
    { key: 'chapters', label: 'Capítulos', type: 'object[]', required: true, maxItems: 10, description: 'Lista de { title, objectives[], sections: [{ heading, body, example?, callout?, table?: { headers, rows }, comparison?: { leftTitle, leftItems[], rightTitle, rightItems[] }, timeline?: [{ step, detail }], checklist?: string[] }], exercises: [{ question, answer }] } (varie os blocos visuais livremente conforme o tema)' },
    { key: 'conclusion', label: 'Considerações Finais', type: 'string', required: false, maxChars: 600, description: 'Síntese final e próximos passos de estudo' },
    { key: 'glossary', label: 'Glossário', type: 'object[]', required: false, maxItems: 20, description: 'Lista de { term, definition }' },
    { key: 'references', label: 'Referências', type: 'string[]', required: true, maxItems: 30, description: 'Fontes citadas' }
  ],
  abnt: [
    { key: 'institution', label: 'Instituição', type: 'string', required: true, maxChars: 140, description: 'Universidade / Faculdade / Curso' },
    { key: 'author', label: 'Autor(es)', type: 'string', required: true, maxChars: 140, description: 'Nome completo do autor' },
    { key: 'title', label: 'Título do Trabalho', type: 'string', required: true, maxChars: 160, description: 'Título principal' },
    { key: 'subtitle', label: 'Subtítulo', type: 'string', required: false, maxChars: 160, description: 'Subtítulo opcional' },
    { key: 'cityAndYear', label: 'Cidade e Ano', type: 'string', required: true, maxChars: 60, description: 'Ex: São Paulo, 2026' },
    { key: 'workNature', label: 'Natureza do Trabalho', type: 'string', required: true, maxChars: 280, description: 'Nota de folha de rosto (tipo, curso, instituição, orientador)' },
    { key: 'abstractPt', label: 'Resumo (PT-BR)', type: 'string', required: true, maxChars: 1600, description: 'Resumo estruturado em parágrafo único + palavras-chave' },
    { key: 'keywordsPt', label: 'Palavras-chave', type: 'string[]', required: true, maxItems: 5, description: '3 a 5 palavras-chave' },
    { key: 'abstractEn', label: 'Abstract (EN)', type: 'string', required: false, maxChars: 1600, description: 'Versão em inglês do resumo' },
    { key: 'sections', label: 'Seções Textuais', type: 'object[]', required: true, maxItems: 12, description: 'Lista de { number, heading, paragraphs[], longQuotes?: [{ text, citation }] }' },
    { key: 'references', label: 'Referências (NBR 6023)', type: 'string[]', required: true, maxItems: 40, description: 'Referências completas em ordem alfabética' }
  ],
  letterhead: [
    { key: 'documentTitle', label: 'Título / Tipo de Documento', type: 'string', required: true, maxChars: 120, description: 'Título central ou identificação do documento' },
    { key: 'fields', label: 'Campos / Lacunas', type: 'object[]', required: false, maxItems: 25, description: 'Pares { key, value } para preencher lacunas {{campo}} ou ____ do papel timbrado' },
    { key: 'paragraphs', label: 'Corpo do Texto', type: 'string[]', required: true, maxItems: 16, description: 'Parágrafos a inserir na zona segura do timbrado' },
    { key: 'signatureBlock', label: 'Assinatura', type: 'string', required: false, maxChars: 160, description: 'Local, data e identificação do signatário' }
  ],
  pptx: [
    { key: 'title', label: 'Título da Apresentação', type: 'string', required: true, maxChars: 90, description: 'Título da capa' },
    { key: 'subtitle', label: 'Subtítulo', type: 'string', required: false, maxChars: 140, description: 'Subtítulo da capa' },
    { key: 'slides', label: 'Slides', type: 'object[]', required: true, maxItems: 18, description: 'Lista de { layout: "bullets"|"two_col"|"metrics"|"chart"|"quote"|"timeline", title, bullets?: string[], metrics?: [{ label, value }], chart?: { type: "bar"|"line"|"pie", labels: string[], values: number[] }, notes: string }' }
  ],
  podcast: [
    { key: 'title', label: 'Título do Episódio', type: 'string', required: true, maxChars: 110, description: 'Título atrativo do podcast' },
    { key: 'summary', label: 'Descrição do Episódio', type: 'string', required: true, maxChars: 350, description: 'Resumo de abertura' },
    { key: 'chapters', label: 'Capítulos', type: 'object[]', required: true, maxItems: 8, description: 'Lista de { title, startTurnIndex }' },
    { key: 'turns', label: 'Falas do Roteiro', type: 'object[]', required: true, maxItems: 40, description: 'Lista de { id, speaker: "hostA"|"hostB", speakerName, text, emotion: "neutral"|"curious"|"enthusiastic"|"thoughtful", pauseAfterMs, citationLocator? }' }
  ],
  video: [
    { key: 'title', label: 'Título do Vídeo', type: 'string', required: true, maxChars: 90, description: 'Título principal' },
    { key: 'aspectRatio', label: 'Proporção', type: 'string', required: true, maxChars: 10, description: '16:9 ou 9:16' },
    { key: 'scenes', label: 'Cenas do Storyboard', type: 'object[]', required: true, maxItems: 12, description: 'Lista de { id, component: "TitleHeroScene"|"AnimatedBulletListScene"|"ComparisonSplitScene"|"MetricCounterGridScene"|"BarChartScene"|"ProcessFlowScene"|"TimelineScene"|"ConceptMapScene"|"QuoteCalloutScene"|"SourceImageSpotlightScene"|"TableHighlightScene"|"SummaryTakeawaysScene", heading, narration, items?: string[], metrics?: [{ label, value }], quote?: { text, author }, imageQuery?: string (2-5 palavras para foto ilustrativa do tema), imageId? }' }
  ],
  report: [
    { key: 'title', label: 'Título do Relatório', type: 'string', required: true, maxChars: 120, description: 'Título executivo' },
    { key: 'executiveSummary', label: 'Resumo Executivo', type: 'string', required: true, maxChars: 1200, description: 'Síntese das conclusões' },
    { key: 'kpis', label: 'Indicadores-Chave', type: 'object[]', required: false, maxItems: 6, description: 'Lista de { label, value, trend? }' },
    { key: 'sections', label: 'Seções Analíticas', type: 'object[]', required: true, maxItems: 8, description: 'Lista de { heading, body, table?: { headers: string[], rows: string[][] } }' },
    { key: 'recommendations', label: 'Recomendações', type: 'string[]', required: true, maxItems: 8, description: 'Ações práticas recomendadas' }
  ],
  flashcards: [
    { key: 'deckTitle', label: 'Título do Baralho', type: 'string', required: true, maxChars: 100, description: 'Nome do conjunto' },
    { key: 'cards', label: 'Cartões / Questões', type: 'object[]', required: true, maxItems: 30, description: 'Lista de { front, back, options?: string[], correctIndex?: number, explanation, citationLocator }' }
  ],
  mindmap: [
    { key: 'rootLabel', label: 'Tema Central', type: 'string', required: true, maxChars: 80, description: 'Nó central do mapa ou título da linha do tempo' },
    { key: 'mode', label: 'Modo', type: 'string', required: true, maxChars: 20, description: 'mindmap ou timeline' },
    { key: 'nodes', label: 'Nós / Marcos', type: 'object[]', required: true, maxItems: 24, description: 'Lista de { id, label, detail?, dateOrOrder?, children?: [{ label, detail? }], citationLocator? }' }
  ],
  xlsx: [
    { key: 'workbookTitle', label: 'Título da Pasta', type: 'string', required: true, maxChars: 90, description: 'Nome do arquivo/relatório' },
    { key: 'sheets', label: 'Abas', type: 'object[]', required: true, maxItems: 6, description: 'Lista de { name, headers: string[], rows: Array<Array<string|number>>, summaryFormulaRow?: boolean }' }
  ],
  resume: [
    { key: 'fullName', label: 'Nome Completo', type: 'string', required: true, maxChars: 100, description: 'Nome profissional' },
    { key: 'headline', label: 'Cargo / Objetivo', type: 'string', required: true, maxChars: 120, description: 'Título profissional' },
    { key: 'summary', label: 'Resumo Profissional', type: 'string', required: true, maxChars: 600, description: 'Síntese de experiência' },
    { key: 'experiences', label: 'Experiências', type: 'object[]', required: true, maxItems: 8, description: 'Lista de { role, company, period, achievements: string[] }' },
    { key: 'skills', label: 'Competências', type: 'string[]', required: true, maxItems: 16, description: 'Habilidades técnicas e comportamentais' }
  ],
  lesson_plan: [
    { key: 'title', label: 'Tema da Aula', type: 'string', required: true, maxChars: 120, description: 'Título da aula' },
    { key: 'gradeAndDuration', label: 'Série e Duração', type: 'string', required: true, maxChars: 80, description: 'Ex: 9º Ano • 50 min' },
    { key: 'objectives', label: 'Objetivos de Aprendizagem', type: 'string[]', required: true, maxItems: 6, description: 'Objetivos claros' },
    { key: 'stages', label: 'Etapas da Aula', type: 'object[]', required: true, maxItems: 6, description: 'Lista de { phase, minutes, activity, resources }' },
    { key: 'assessment', label: 'Avaliação', type: 'string', required: true, maxChars: 400, description: 'Critério de avaliação' }
  ],
  meeting_minutes: [
    { key: 'title', label: 'Título da Reunião', type: 'string', required: true, maxChars: 120, description: 'Pauta/Título' },
    { key: 'dateAndParticipants', label: 'Data e Participantes', type: 'string', required: true, maxChars: 300, description: 'Data, local e lista de presentes' },
    { key: 'decisions', label: 'Deliberações', type: 'string[]', required: true, maxItems: 12, description: 'Decisões tomadas' },
    { key: 'actionItems', label: 'Plano de Ação', type: 'object[]', required: true, maxItems: 12, description: 'Lista de { task, owner, deadline }' }
  ],
  contract: [
    { key: 'title', label: 'Título do Instrumento', type: 'string', required: true, maxChars: 120, description: 'Tipo de contrato/termo' },
    { key: 'parties', label: 'Qualificação das Partes', type: 'string[]', required: true, maxItems: 4, description: 'Partes envolvidas' },
    { key: 'clauses', label: 'Cláusulas', type: 'object[]', required: true, maxItems: 15, description: 'Lista de { number, title, text }' }
  ],
  faq: [
    { key: 'title', label: 'Título do FAQ', type: 'string', required: true, maxChars: 120, description: 'Título' },
    { key: 'items', label: 'Perguntas e Respostas', type: 'object[]', required: true, maxItems: 20, description: 'Lista de { question, answer, category? }' }
  ],
  newsletter: [
    { key: 'title', label: 'Título da Edição', type: 'string', required: true, maxChars: 100, description: 'Assunto principal' },
    { key: 'lead', label: 'Editorial de Abertura', type: 'string', required: true, maxChars: 450, description: 'Texto introdutório' },
    { key: 'blocks', label: 'Destaques', type: 'object[]', required: true, maxItems: 6, description: 'Lista de { heading, body, ctaText? }' }
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
  // OFÍCIOS (5)
  tpl('oficio-mrpr', 'oficio', 'Ofício Oficial (Padrão MRPR)', 'Segue a 3ª ed. do Manual de Redação da Presidência da República: preto no branco, sem adornos.', 'oficial', { primary: '#111827', secondary: '#374151', accent: '#111827', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Use linguagem formal oficial, vocativo adequado ao cargo, assunto objetivo em negrito e fecho "Respeitosamente," ou "Atenciosamente,".', { layoutPreset: 'classic' }),
  tpl('oficio-corporativo', 'oficio', 'Carta Corporativa Executiva', 'Layout sobrio com linha institucional discreta no topo para comunicações empresariais.', 'corporativo', { primary: '#1E3A5F', secondary: '#475569', accent: '#2563EB' }, 'Tom cordial, direto e orientado a decisões de negócio.', { layoutPreset: 'executive' }),
  tpl('oficio-juridico', 'oficio', 'Notificação / Requerimento Jurídico', 'Tipografia clássica serifada preto no branco para petições e notificações extrajudiciais.', 'juridico', { primary: '#111827', secondary: '#374151', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Cite dispositivos, datas e fatos estritamente como constam nas fontes.', { layoutPreset: 'classic' }),
  tpl('oficio-academico', 'oficio', 'Ofício Acadêmico / Universitário', 'Ideal para solicitações a coordenações, reitorias, bancas e órgãos de fomento.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#0F766E', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Tom acadêmico respeitoso, identificando curso, matrícula ou edital.', { layoutPreset: 'academic' }),
  tpl('oficio-comunicado', 'oficio', 'Comunicado / Memorando Interno', 'Formato enxuto para circulares, avisos operacionais e memorandos.', 'corporativo', { primary: '#1E293B', secondary: '#475569', accent: '#334155' }, 'Parágrafos curtos com prazos e responsáveis bem destacados.', { layoutPreset: 'minimal' }),

  // APOSTILAS (5)
  tpl('apostila-modular', 'apostila', 'Apostila Técnica Modular', 'Capítulos com objetivos, quadros de destaque, exercícios comentados e glossário.', 'educacao', { primary: '#1E3A5F', accent: '#0284C7' }, 'Organize de forma didática progressiva com exemplos das fontes e exercícios ao final de cada capítulo.', { layoutPreset: 'modern' }),
  tpl('apostila-concurso', 'apostila', 'Preparatório Intensivo / Concurso', 'Foco em pontos-chave, tabelas comparativas, pegadinhas comuns e questões de fixação.', 'educacao', { primary: '#92400E', accent: '#D97706' }, 'Destaque regras, exceções e prazos em callouts objetivos.', { layoutPreset: 'whiteboard' }),
  tpl('apostila-onboarding', 'apostila', 'Manual de Treinamento Corporativo', 'Guia prático de processos internos, fluxos e boas práticas.', 'corporativo', { primary: '#0F766E', accent: '#0D9488' }, 'Linguagem clara de passo a passo com checklist operacional.', { layoutPreset: 'executive' }),
  tpl('apostila-lab', 'apostila', 'Caderno de Laboratório / Oficina', 'Estrutura prática voltada a experimentos, roteiros e análise de resultados.', 'tecnico', { primary: '#0369A1', accent: '#0284C7', monoFont: 'JetBrains Mono' }, 'Separe teoria breve, procedimento passo a passo e perguntas de verificação.', { layoutPreset: 'minimal' }),
  tpl('apostila-editorial', 'apostila', 'Livro-Texto Universitário', 'Tipografia Merriweather de leitura confortável para materiais extensos.', 'academico', { primary: '#1E293B', accent: '#475569', headingFont: 'Merriweather', bodyFont: 'Merriweather' }, 'Redação aprofundada com rigor conceitual e citações completas.', { layoutPreset: 'editorial' }),

  // ABNT (5)
  tpl('abnt-tcc', 'abnt', 'TCC / Monografia Completa (NBR 14724)', 'Margens 3/2cm, folha de rosto, resumo, abstract, citações NBR 10520 e referências NBR 6023.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#111827', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Siga rigorosamente a norma ABNT: terceira pessoa impessoal, citações autor-data e referências ordenadas.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),
  tpl('abnt-artigo', 'abnt', 'Artigo Científico ABNT (NBR 6022)', 'Estrutura de artigo científico com resumo, palavras-chave, introdução, desenvolvimento e conclusão.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#111827', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Redação científica concisa com fundamentação explícita nas fontes.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),
  tpl('abnt-projeto', 'abnt', 'Projeto de Pesquisa / Qualificação', 'Inclui problema, objetivos, justificativa, referencial teórico e metodologia.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Estruture problema, hipóteses e metodologia a partir das fontes.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'academic' }),
  tpl('abnt-relatorio', 'abnt', 'Relatório Técnico-Científico (NBR 10719)', 'Relatório formal com objetivos, procedimentos, resultados e conclusões.', 'tecnico', { primary: '#111827', secondary: '#374151', accent: '#1F2937', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Apresente dados, tabelas e conclusões técnicas de forma objetiva.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),
  tpl('abnt-resenha', 'abnt', 'Resenha Crítica / Fichamento', 'Análise estruturada de obra ou conjunto de artigos com citações diretas e indiretas.', 'academico', { primary: '#111827', secondary: '#374151', accent: '#374151', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Distinga claramente síntese da obra e análise crítica fundamentada.', { license: ABNT_LPPL_INSPIRED_LICENSE, layoutPreset: 'classic' }),

  // FOLHA TIMBRADA (5)
  tpl('timbrado-oficio', 'letterhead', 'Ofício em Papel Timbrado', 'Preserva cabeçalho, rodapé e marca d’água originais inserindo o ofício apenas na zona segura.', 'oficial', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Respeite o espaço útil da folha timbrada e preencha eventuais campos {{campo}} ou ____ detectados.', { layoutPreset: 'classic' }),
  tpl('timbrado-parecer', 'letterhead', 'Parecer Técnico em Timbrado', 'Composição de parecer estruturado (Ementa, Fatos, Análise, Conclusão) sobre o timbrado original.', 'juridico', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Organize em tópicos numerados com conclusão clara.', { layoutPreset: 'classic' }),
  tpl('timbrado-declaracao', 'letterhead', 'Declaração / Atestado em Timbrado', 'Texto centralizado/justificado curto com destaque de título e bloco de assinatura.', 'oficial', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Sans', bodyFont: 'Liberation Sans' }, 'Texto objetivo em parágrafo único ou dois parágrafos com local, data e assinatura.', { layoutPreset: 'classic' }),
  tpl('timbrado-proposta', 'letterhead', 'Proposta Comercial em Timbrado', 'Estrutura de escopo, entregas, cronograma e investimento preservando a identidade visual.', 'corporativo', { primary: '#1E3A5F', accent: '#2563EB' }, 'Destaque entregáveis, premissas e condições comerciais baseadas nas fontes.', { layoutPreset: 'executive' }),
  tpl('timbrado-formulario', 'letterhead', 'Preenchimento de Formulário / Lacunas', 'Detecta e preenche automaticamente lacunas (____, {{campo}}, tabelas) do arquivo timbrado.', 'geral', { primary: '#1F2937', accent: '#374151' }, 'Extraia os valores exatos das fontes para preencher cada campo do formulário.', { layoutPreset: 'minimal' }),

  // POWERPOINT (6)
  tpl('pptx-executivo', 'pptx', 'Executivo Clean (16:9)', 'Design corporativo limpo com alta legibilidade, cards de métricas e gráficos nativos.', 'corporativo', { primary: '#1E3A5F', accent: '#2563EB', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'Máximo de 5 bullets curtos por slide (até 12 palavras cada) e notas detalhadas para o apresentador.', { layoutPreset: 'executive' }),
  tpl('pptx-pitch', 'pptx', 'Pitch Deck de Produto', 'Narrativa problema → solução → dados → tração → próximos passos.', 'corporativo', { primary: '#0F172A', accent: '#0EA5E9', surface: '#FFFFFF', surfaceAlt: '#F1F5F9' }, 'Slides de alto impacto visual com números reais das fontes.', { layoutPreset: 'modern' }),
  tpl('pptx-aula', 'pptx', 'Aula Magna / Acadêmico', 'Slides didáticos com definições, exemplos, linha do tempo e síntese final.', 'educacao', { primary: '#0F766E', accent: '#14B8A6', surface: '#FFFFFF', surfaceAlt: '#F0FDFA' }, 'Priorize clareza didática e citações no rodapé das notas.', { layoutPreset: 'editorial' }),
  tpl('pptx-dados', 'pptx', 'Relatório de Resultados & BI', 'Foco em gráficos nativos editáveis, KPIs e comparativos.', 'dados', { primary: '#0369A1', accent: '#0284C7', surface: '#FFFFFF', surfaceAlt: '#F0F9FF' }, 'Use layouts "metrics" e "chart" sempre que houver dados quantitativos nas fontes.', { layoutPreset: 'minimal' }),
  tpl('pptx-workshop', 'pptx', 'Workshop Interativo', 'Estrutura dinâmica com perguntas disparadoras, dinâmicas e takeaways.', 'educacao', { primary: '#92400E', accent: '#D97706', surface: '#FFFDF7', surfaceAlt: '#FEF3C7' }, 'Inclua perguntas de reflexão e exercícios práticos.', { layoutPreset: 'playful' }),
  tpl('pptx-dark-tech', 'pptx', 'Dark Tech / Engenharia', 'Paleta escura de alto contraste para apresentações técnicas e arquitetura.', 'tecnico', { primary: '#F8FAFC', accent: '#38BDF8', surface: '#0F172A', surfaceAlt: '#1E293B', textPrimary: '#F8FAFC', textMuted: '#94A3B8', border: '#334155' }, 'Direto ao ponto, com diagramas de fluxo e métricas técnicas.', { layoutPreset: 'tech_dark' }),

  // PODCAST (5)
  tpl('podcast-conversa', 'podcast', 'Conversa Deep-Dive (2 Hosts)', 'Diálogo natural e envolvente entre dois apresentadores explorando as fontes em profundidade.', 'audio', { primary: '#1E3A5F', accent: '#0284C7' }, 'Alternância natural entre hostA (apresentador guia) e hostB (analista curioso), com pausas e ênfases.'),
  tpl('podcast-debate', 'podcast', 'Debate Ponto e Contraponto', 'Dois apresentadores analisam prós, contras, riscos e evidências presentes nas fontes.', 'audio', { primary: '#991B1B', accent: '#DC2626' }, 'Mantenha equilíbrio argumentativo estritamente baseado nas evidências das fontes.'),
  tpl('podcast-aula', 'podcast', 'Aula em Áudio (Professor + Aluno)', 'Formato didático em que perguntas do aluno destravam explicações claras do professor.', 'educacao', { primary: '#065F46', accent: '#059669' }, 'Use analogias fiéis às fontes e recapitulações por capítulo.'),
  tpl('podcast-briefing', 'podcast', 'Briefing Executivo (3 min)', 'Resumo matinal direto ao ponto com os principais fatos, números e decisões.', 'corporativo', { primary: '#1E3A5F', accent: '#2563EB' }, 'Falas curtas e objetivas, sem rodeios, focadas em impacto e ação.'),
  tpl('podcast-revisao', 'podcast', 'Revisão Rápida para Prova', 'Perguntas e respostas em ritmo ágil para fixação de conteúdo.', 'educacao', { primary: '#92400E', accent: '#D97706' }, 'Alterne perguntas rápidas com explicações concisas e citação do trecho.'),

  // VÍDEO EXPLICATIVO SVG (5)
  tpl('video-quadro-branco', 'video', 'Quadro Branco Didático (16:9)', 'Fundo claro editorial com listas animadas, mapas conceituais e citações.', 'educacao', { primary: '#1E293B', accent: '#0284C7', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, 'Narração clara de 15 a 25 palavras por cena; varie os componentes SVG entre cenas.', { layoutPreset: 'whiteboard' }),
  tpl('video-dados', 'video', 'Apresentação Dinâmica de Dados (16:9)', 'Foco em métricas animadas, gráficos de barras e comparativos visuais.', 'dados', { primary: '#F8FAFC', accent: '#0EA5E9', surface: '#0F172A', surfaceAlt: '#1E293B', textPrimary: '#F8FAFC', textMuted: '#94A3B8', border: '#334155' }, 'Destaque números exatos das fontes em MetricCounterGridScene e BarChartScene.', { layoutPreset: 'tech_dark' }),
  tpl('video-timeline', 'video', 'Linha do Tempo & Processo (16:9)', 'Ideal para evolução histórica, etapas de projeto ou fluxos de trabalho.', 'geral', { primary: '#0F766E', accent: '#14B8A6', surface: '#FFFFFF', surfaceAlt: '#F0FDFA' }, 'Use TimelineScene e ProcessFlowScene com marcos ordenados.', { layoutPreset: 'editorial' }),
  tpl('video-vertical', 'video', 'Resumo Vertical Shorts/Reels (9:16)', 'Formato vertical otimizado para celular com texto grande e ritmo ágil.', 'social', { primary: '#F8FAFC', accent: '#F59E0B', surface: '#111827', surfaceAlt: '#1F2937', textPrimary: '#F8FAFC', textMuted: '#CBD5E1', border: '#374151' }, 'Cenas curtas (5 a 7 cenas), títulos curtos e foco total em retenção.', { orientation: 'portrait', pageFormat: '9:16', layoutPreset: 'modern' }),
  tpl('video-comparativo', 'video', 'Comparativo Técnico Visual (16:9)', 'Compara alternativas, cenários ou normativas lado a lado.', 'corporativo', { primary: '#1E3A5F', accent: '#2563EB', surface: '#FFFFFF', surfaceAlt: '#F1F5F9' }, 'Priorize ComparisonSplitScene e TableHighlightScene.', { layoutPreset: 'executive' }),

  // RELATÓRIOS (5)
  tpl('report-onepager', 'report', 'One-Pager Executivo', 'Síntese de 1 a 2 páginas com KPIs no topo, achados e plano de ação.', 'corporativo', { primary: '#1E3A5F', accent: '#2563EB' }, 'Concisão máxima: resumo executivo, 3 a 4 KPIs e recomendações acionáveis.', { layoutPreset: 'executive' }),
  tpl('report-dados', 'report', 'Relatório Analítico de Dados', 'Tabelas estruturadas, comparativos e interpretações baseadas nas fontes.', 'dados', { primary: '#0369A1', accent: '#0EA5E9' }, 'Sempre inclua tabelas comparativas e destaque variações percentuais reais.', { layoutPreset: 'modern' }),
  tpl('report-diagnostico', 'report', 'Diagnóstico e Plano de Ação', 'Mapeia problemas encontrados nas fontes, causas raiz e ações recomendadas.', 'corporativo', { primary: '#991B1B', accent: '#DC2626' }, 'Relacione cada recomendação à evidência correspondente nas fontes.', { layoutPreset: 'whiteboard' }),
  tpl('report-financeiro', 'report', 'Relatório Operacional / Financeiro', 'Estrutura sobria para prestação de contas, orçamento e resultados.', 'corporativo', { primary: '#065F46', accent: '#059669' }, 'Mantenha precisão numérica absoluta conforme as fontes.', { layoutPreset: 'minimal' }),
  tpl('report-dossie', 'report', 'Dossiê de Pesquisa Consolidado', 'Consolidação multi-fonte com cruzamento de evidências e referências.', 'academico', { primary: '#1E293B', accent: '#475569' }, 'Cruze múltiplas fontes indicando convergências e divergências.', { layoutPreset: 'editorial' }),

  // ESTUDO / DADOS / COMPLEMENTARES
  tpl('flashcards-anki', 'flashcards', 'Baralho de Estudo Ativo (Anki)', 'Cartões frente/verso objetivos com citação da página/fonte.', 'educacao', { primary: '#1E3A5F', accent: '#0284C7' }, 'Uma ideia atômica por cartão; pergunta clara na frente, resposta concisa no verso.'),
  tpl('flashcards-simulado', 'flashcards', 'Simulado Comentado (Múltipla Escolha)', 'Questões com 4 alternativas e gabarito comentado fundamentado.', 'educacao', { primary: '#1E3A5F', accent: '#2563EB' }, 'Crie distratores plausíveis baseados no tema, com apenas 1 alternativa correta e comentário citando a fonte.'),
  tpl('mindmap-radial', 'mindmap', 'Mapa Mental Hierárquico', 'Estrutura radial do tema central em ramos e sub-tópicos.', 'educacao', { primary: '#0F766E', accent: '#14B8A6' }, 'Rótulos curtos (2 a 5 palavras) com detalhamento opcional.'),
  tpl('mindmap-timeline', 'mindmap', 'Linha do Tempo Cronológica', 'Eventos ou etapas ordenadas com data/ordem e impacto.', 'geral', { primary: '#1E3A5F', accent: '#2563EB' }, 'Ordene cronologicamente com precisão nas datas/etapas das fontes.'),
  tpl('xlsx-analitico', 'xlsx', 'Planilha Analítica Multi-Aba', 'Abas estruturadas com somatórios/médias automáticas e aba de fontes.', 'dados', { primary: '#065F46', accent: '#059669' }, 'Normalize números como tipo numérico real (não string) para permitir fórmulas.'),
  tpl('extra-curriculo', 'resume', 'Currículo Profissional (ATS)', 'Layout limpo compatível com sistemas ATS de recrutamento.', 'carreira', { primary: '#111827', accent: '#374151' }, 'Use verbos de ação e resultados mensuráveis extraídos das fontes do usuário.', { layoutPreset: 'minimal' }),
  tpl('extra-plano-aula', 'lesson_plan', 'Plano de Aula Estruturado', 'Objetivos, etapas cronometradas, recursos e avaliação.', 'educacao', { primary: '#0F766E', accent: '#0D9488' }, 'Estruture tempos realistas e atividades alinhadas ao material de referência.', { layoutPreset: 'executive' }),
  tpl('extra-ata', 'meeting_minutes', 'Ata de Reunião Executiva', 'Registro formal de participantes, decisões e responsáveis.', 'corporativo', { primary: '#111827', accent: '#374151' }, 'Extraia apenas decisões, responsáveis e prazos efetivamente registrados.', { layoutPreset: 'classic' }),
  tpl('extra-contrato', 'contract', 'Minuta / Contrato-Modelo', 'Cláusulas numeradas organizadas por objeto, obrigações, prazo e foro.', 'juridico', { primary: '#111827', accent: '#1F2937', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, 'Sinalize campos que dependam de dados específicos não informados com [PREENCHER].', { layoutPreset: 'classic' }),
  tpl('extra-faq', 'faq', 'FAQ / Base de Conhecimento', 'Perguntas frequentes agrupadas por categoria.', 'geral', { primary: '#1E3A5F', accent: '#0284C7' }, 'Respostas diretas e verificáveis nas fontes.', { layoutPreset: 'minimal' }),
  tpl('extra-newsletter', 'newsletter', 'Newsletter / Boletim Informativo', 'Editorial de abertura e blocos de destaque prontos para envio.', 'comunicacao', { primary: '#1E293B', accent: '#D97706' }, 'Tom envolvente com chamadas claras baseadas nos documentos.', { layoutPreset: 'editorial' })
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
  { slug: 'nordic-clean', label: 'Nordic Clean', desc: 'Visual escandinavo limpo com amplo respiro e contraste suave.', category: 'minimal', preset: 'minimal', tokens: { primary: '#1E293B', accent: '#64748B', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Priorize concisão, hierarquia clara e blocos curtos.' },
  { slug: 'navy-exec', label: 'Executivo Navy', desc: 'Azul-marinho institucional com acento dourado discreto.', category: 'corporativo', preset: 'executive', tokens: { primary: '#0F2942', accent: '#B45309', surface: '#FFFFFF', surfaceAlt: '#F1F5F9' }, guide: 'Tom executivo objetivo orientado a decisões e métricas.' },
  { slug: 'forest-sage', label: 'Botânico & Sustentável', desc: 'Verde-floresta profundo com fundo claro orgânico.', category: 'corporativo', preset: 'editorial', tokens: { primary: '#14532D', accent: '#16A34A', surface: '#FFFFFF', surfaceAlt: '#F0FDF4' }, guide: 'Destaque impacto, sustentabilidade e clareza.' },
  { slug: 'terracota-warm', label: 'Terracota Editorial', desc: 'Tipografia quente e acolhedora com acento terracota.', category: 'editorial', preset: 'editorial', tokens: { primary: '#7C2D12', accent: '#EA580C', surface: '#FFFBF7', surfaceAlt: '#FFEDD5', headingFont: 'Merriweather', bodyFont: 'Inter' }, guide: 'Estilo editorial fluido com citações e destaques.' },
  { slug: 'slate-mono', label: 'Grafite Monocromático', desc: 'Escala de cinza de alto contraste sem distrações.', category: 'oficial', preset: 'classic', tokens: { primary: '#111827', accent: '#374151', surface: '#FFFFFF', surfaceAlt: '#F3F4F6' }, guide: 'Sobriedade máxima e precisão factual.' },
  { slug: 'oceano-bi', label: 'Oceano & Dados', desc: 'Azul-petróleo e ciano voltado a indicadores e tabelas.', category: 'dados', preset: 'modern', tokens: { primary: '#0C4A6E', accent: '#0284C7', surface: '#FFFFFF', surfaceAlt: '#F0F9FF' }, guide: 'Evidencie números, comparativos e tendências.' },
  { slug: 'amber-atelier', label: 'Ateliê Âmbar', desc: 'Fundo creme editorial com destaques em âmbar.', category: 'criativo', preset: 'playful', tokens: { primary: '#78350F', accent: '#D97706', surface: '#FFFBEB', surfaceAlt: '#FEF3C7' }, guide: 'Abordagem didática com exemplos práticos e quadros.' },
  { slug: 'midnight-slate', label: 'Midnight Dark', desc: 'Modo escuro elegante com alto contraste para tela.', category: 'tecnico', preset: 'tech_dark', tokens: { primary: '#E2E8F0', accent: '#38BDF8', surface: '#0F172A', surfaceAlt: '#1E293B', textPrimary: '#F8FAFC', textMuted: '#94A3B8', border: '#334155' }, guide: 'Direto ao ponto, com estrutura visual de alto contraste.' },
  { slug: 'carbon-emerald', label: 'Carbono & Esmeralda', desc: 'Fundo escuro técnico com acento esmeralda.', category: 'tecnico', preset: 'tech_dark', tokens: { primary: '#F9FAFB', accent: '#10B981', surface: '#111827', surfaceAlt: '#1F2937', textPrimary: '#F9FAFB', textMuted: '#9CA3AF', border: '#374151' }, guide: 'Foco em arquitetura, processos e métricas exatas.' },
  { slug: 'swiss-grid', label: 'Grid Suíço', desc: 'Composição geométrica precisa inspirada no design suíço.', category: 'moderno', preset: 'modern', tokens: { primary: '#991B1B', accent: '#DC2626', surface: '#FFFFFF', surfaceAlt: '#F9FAFB' }, guide: 'Títulos fortes e blocos curtos bem alinhados.' },
  { slug: 'bordeaux-classic', label: 'Clássico Bordô', desc: 'Elegância acadêmica e jurídica em bordô e serifas.', category: 'academico', preset: 'academic', tokens: { primary: '#6B1D2F', accent: '#9F1239', surface: '#FFFFFF', surfaceAlt: '#FFF1F2', headingFont: 'Liberation Serif', bodyFont: 'Liberation Serif' }, guide: 'Linguagem formal, rigorosa e bem fundamentada.' },
  { slug: 'teal-studio', label: 'Estúdio Petrol', desc: 'Verde-petróleo moderno equilibrado para apresentações e guias.', category: 'educacao', preset: 'executive', tokens: { primary: '#134E4A', accent: '#0D9488', surface: '#FFFFFF', surfaceAlt: '#F0FDFA' }, guide: 'Clareza didática e síntese visual.' },
  { slug: 'whiteboard-sketch', label: 'Quadro Didático', desc: 'Moldura leve de quadro branco para ensino e workshops.', category: 'educacao', preset: 'whiteboard', tokens: { primary: '#1E3A5F', accent: '#0284C7', surface: '#FFFFFF', surfaceAlt: '#F8FAFC' }, guide: 'Organize em passos visuais e perguntas-chave.' },
  { slug: 'sand-minimal', label: 'Areia & Papel', desc: 'Tom papel quente de leitura confortável e sem fadiga.', category: 'editorial', preset: 'editorial', tokens: { primary: '#292524', accent: '#78716C', surface: '#FAF8F5', surfaceAlt: '#F5F0EB', headingFont: 'Merriweather', bodyFont: 'Inter' }, guide: 'Fluidez narrativa com citações bem integradas.' },
  { slug: 'cobalt-pro', label: 'Cobalto Profissional', desc: 'Azul-cobalto limpo para propostas, relatórios e decks.', category: 'corporativo', preset: 'modern', tokens: { primary: '#1D4ED8', accent: '#3B82F6', surface: '#FFFFFF', surfaceAlt: '#EFF6FF' }, guide: 'Destaque entregáveis, metas e resultados.' }
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

  search(opts: { toolId?: string; category?: string; query?: string } = {}): TemplateManifest[] {
    const q = (opts.query || '').trim().toLowerCase()
    return this.getAll().filter((t) => {
      if (opts.toolId && t.toolId !== opts.toolId) return false
      if (opts.category && t.category !== opts.category) return false
      if (q) {
        const hay = `${t.name} ${t.description} ${t.category} ${t.toolId}`.toLowerCase()
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
