import { normalizeLocale, type DocsLocale } from '../../core/i18n.ts'

/**
 * Sample copy used by the template preview SVGs.
 *
 * These strings describe illustrative documents (letters, papers, reports and
 * media previews). They are kept apart from the main UI catalog because they
 * belong to a different voice: realistic document content instead of controls.
 */
export interface PreviewCopy {
  slide: {
    kickerVideo: string
    kickerPresentation: string
    defaultSubtitle: string
    coverLabel: string
    openingLabel: string
    contentLabel: string
    metricsLabel: string
    contentTitle: string
    bullets: [string, string, string, string]
    chartTitle: string
    quarters: [string, string, string]
    metricsTitle: string
    metrics: [string, string, string]
    summaryTitle: string
    summary: [string, string]
  }
  oficio: {
    page1: string
    page2: string
    number: string
    date: string
    recipientIntro: string
    recipientTitle: string
    address1: string
    address2: string
    subject: string
    salutation: string
    paragraph1: [string, string, string]
    paragraph2: [string, string]
    closing: string
    signer: string
    signerRole: string
    annexTitle: string
    annexColumns: [string, string, string]
    annexRows: Array<{ stage: string; unit: string; deadline: string }>
    pageOfPages: string
  }
  abnt: {
    page1: string
    page2: string
    institution: string
    author: string
    subtitle: string
    nature: [string, string, string]
    city: string
    year: string
    abstractTitle: string
    abstract: [string, string, string]
    keywordsLabel: string
    keywords: string
    sectionTitle: string
    section: [string, string, string]
    quote: [string, string]
    referencesTitle: string
    reference: string
  }
  resume: {
    page: string
    name: string
    role: string
    contact: string
    summaryTitle: string
    summary: [string, string]
    experienceTitle: string
    jobTitle: string
    jobPeriod: string
    jobBullets: [string, string]
    skillsTitle: string
    skills: string
  }
  report: {
    kickerApostila: string
    kickerContract: string
    kickerDefault: string
    coverLabel: string
    bodyLabel: string
    summaryTitle: string
    summary: [string, string]
    section1Title: string
    section1: [string, string, string]
    page1: string
    section2Title: string
    section2Intro: string
    table: {
      indicator: string
      current: string
      target: string
      rows: Array<[string, string, string]>
    }
    page2: string
  }
  xlsx: {
    page: string
    headers: [string, string, string, string]
    rows: Array<[string, string, string, string]>
    totalLabel: string
    sumFormula: string
  }
  podcast: {
    page: string
    description: string
    hostA: string
    hostB: string
    quotes: [string, string]
  }
  mindmap: {
    page: string
    nodes: [string, string, string, string]
  }
  flashcards: {
    page: string
    front: string
    question: [string, string]
    source: string
    back: string
    answer: string
    answerLines: [string, string, string]
  }
}

const PT_BR: PreviewCopy = {
  slide: {
    kickerVideo: 'VÍDEO EXPLICATIVO',
    kickerPresentation: 'APRESENTAÇÃO EXECUTIVA',
    defaultSubtitle: 'Síntese estratégica baseada nas fontes',
    coverLabel: 'Capa',
    openingLabel: 'Abertura',
    contentLabel: 'Conteúdo & Gráfico',
    metricsLabel: 'Indicadores',
    contentTitle: 'Principais Pontos e Evolução',
    bullets: [
      'Diagnóstico claro dos gargalos operacionais',
      'Metas mensuráveis com prazo e responsável',
      'Comparativo de impacto antes e depois',
      'Próximos passos priorizados por retorno'
    ],
    chartTitle: 'Evolução Trimestral',
    quarters: ['T1', 'T2', 'T3'],
    metricsTitle: 'Indicadores e Resultados',
    metrics: ['Eficiência operacional', 'Fidelidade às fontes', 'Ganho de produtividade'],
    summaryTitle: 'Síntese Executiva',
    summary: [
      'Os dados consolidados apontam redução de custos no segundo semestre,',
      'com recomendação de expansão imediata para as unidades regionais.'
    ]
  },
  oficio: {
    page1: 'Ofício (Pág. 1)',
    page2: 'Anexo (Pág. 2)',
    number: 'Ofício nº 042/2026/GAB',
    date: 'Brasília, 24 de novembro de 2026.',
    recipientIntro: 'Ao Senhor',
    recipientTitle: 'Diretor de Planejamento e Gestão',
    address1: 'Esplanada dos Ministérios, Bloco A',
    address2: '70040-900 Brasília - DF',
    subject: 'Assunto: Encaminhamento de cronograma e solicitação de providências.',
    salutation: 'Senhor Diretor,',
    paragraph1: [
      '1. Cumprimentando-o cordialmente, encaminho para análise e aprovação o',
      'cronograma consolidado das entregas previstas para o próximo trimestre operacional,',
      'conforme Processo Administrativo nº 2026/0184.'
    ],
    paragraph2: [
      '2. Solicito a gentileza de validar as metas descritas no anexo técnico até o dia',
      '10 de dezembro de 2026, garantindo o alinhamento entre as unidades envolvidas.'
    ],
    closing: 'Atenciosamente,',
    signer: 'MARIA SILVA OLIVEIRA',
    signerRole: 'Diretora Executiva',
    annexTitle: 'ANEXO ÚNICO — CRONOGRAMA DE ENTREGAS',
    annexColumns: ['Etapa', 'Unidade Responsável', 'Prazo'],
    annexRows: [
      { stage: '1. Diagnóstico inicial', unit: 'Coordenação Técnica', deadline: '05/12/2026' },
      { stage: '2. Validação orçamentária', unit: 'Diretoria Financeira', deadline: '12/12/2026' },
      { stage: '3. Publicação oficial', unit: 'Gabinete', deadline: '18/12/2026' }
    ],
    pageOfPages: 'Página 2 de 2'
  },
  abnt: {
    page1: 'Folha de Rosto',
    page2: 'Resumo & Texto',
    institution: 'UNIVERSIDADE FEDERAL DE TECNOLOGIA',
    author: 'JOÃO DA CONCEIÇÃO ARAÚJO',
    subtitle: 'Estudo de caso com normas NBR 14724, 10520 e 6023',
    nature: [
      'Trabalho de Conclusão de Curso apresentado à',
      'Coordenação de Graduação como requisito parcial',
      'para obtenção do título de Bacharel.'
    ],
    city: 'SÃO PAULO',
    year: '2026',
    abstractTitle: 'RESUMO',
    abstract: [
      'Este trabalho analisa a implementação de práticas sustentáveis na gestão pública,',
      'com base em evidências documentais e indicadores comparativos do período de 2024',
      'a 2026. Os resultados demonstram ganho expressivo de eficiência administrativa.'
    ],
    keywordsLabel: 'Palavras-chave:',
    keywords: 'Eficiência. Sustentabilidade. Gestão Pública.',
    sectionTitle: '1 INTRODUÇÃO',
    section: [
      'A modernização administrativa demanda instrumentos padronizados que assegurem',
      'rastreabilidade das decisões e rigor metodológico (SILVA, 2026, p. 14). Nesse',
      'sentido, a adoção de critérios objetivos permite avaliar resultados com transparência.'
    ],
    quote: [
      '“A clareza metodológica é condição indispensável para a reprodutibilidade',
      'científica e validação documental dos achados.” (SILVA, 2026, p. 42).'
    ],
    referencesTitle: 'REFERÊNCIAS',
    reference: 'SILVA, M. Gestão Sustentável e Eficiência. São Paulo: Editora Exemplo, 2026.'
  },
  resume: {
    page: 'Currículo ATS',
    name: 'MARIANA COSTA ALMEIDA',
    role: 'Coordenadora de Projetos e Operações',
    contact: 'São Paulo, SP · mariana.almeida@email.com · linkedin.com/in/mariana',
    summaryTitle: 'RESUMO PROFISSIONAL',
    summary: [
      'Profissional com 8 anos de experiência em gestão de projetos, otimização de',
      'processos e liderança de equipes multidisciplinares com foco em resultados.'
    ],
    experienceTitle: 'EXPERIÊNCIA PROFISSIONAL',
    jobTitle: 'Gerente de Operações — Empresa Horizonte S.A.',
    jobPeriod: '2023 – Atual',
    jobBullets: [
      '• Redução de 28% nos custos operacionais após padronização de fluxos.',
      '• Implantação de painel de indicadores para 4 unidades regionais.'
    ],
    skillsTitle: 'COMPETÊNCIAS',
    skills: 'Gestão Ágil · Planejamento Estratégico · Análise de Indicadores · Liderança'
  },
  report: {
    kickerApostila: 'MATERIAL DIDÁTICO',
    kickerContract: 'INSTRUMENTO PARTICULAR',
    kickerDefault: 'RELATÓRIO EXECUTIVO',
    coverLabel: 'Capa / Abertura',
    bodyLabel: 'Miolo & Tabelas',
    summaryTitle: 'Síntese Executiva',
    summary: [
      'Consolidação dos principais achados, indicadores de desempenho e ações',
      'prioritárias fundamentadas diretamente nas fontes do projeto.'
    ],
    section1Title: '1. Contexto e Análise',
    section1: [
      'A análise integrada dos documentos permite identificar padrões operacionais',
      'e oportunidades de ganho imediato de eficiência, com redução de retrabalho.',
      'Cada recomendação abaixo está vinculada às evidências verificadas nas fontes.'
    ],
    page1: 'Pág. 1 / 2',
    section2Title: '2. Quadro Comparativo e Próximos Passos',
    section2Intro: 'Comparação dos indicadores consolidados e plano de ação recomendado:',
    table: {
      indicator: 'Indicador',
      current: 'Atual',
      target: 'Meta',
      rows: [
        ['Adoção do processo', '74%', '92%'],
        ['Qualidade documental', '88%', '98%'],
        ['Prazo médio de entrega', '4 dias', '2 dias']
      ]
    },
    page2: 'Pág. 2 / 2'
  },
  xlsx: {
    page: 'Planilha',
    headers: ['Unidade Regional', 'Receita (R$)', 'Custo (R$)', 'Margem'],
    rows: [
      ['São Paulo - Centro', '420.000', '285.000', '32,1%'],
      ['Campinas - Planta B', '310.000', '198.000', '36,1%'],
      ['Curitiba - Sul', '275.000', '184.000', '33,1%']
    ],
    totalLabel: 'Total Consolidado',
    sumFormula: '=SOMA(B2:B4)'
  },
  podcast: {
    page: 'Roteiro & Áudio',
    description: 'Episódio em áudio estéreo (2 apresentadores) · Transcrição sincronizada (SRT)',
    hostA: 'HOST A (Apresentadora)',
    hostB: 'HOST B (Analista)',
    quotes: [
      '“Os dados do relatório mostram uma redução de 28% nos custos logo no primeiro ano.”',
      '“E o mais interessante é que o retorno do investimento aconteceu em apenas 14 meses.”'
    ]
  },
  mindmap: {
    page: 'Diagrama',
    nodes: ['1. Contexto Inicial', '2. Evidências', '3. Indicadores', '4. Conclusões']
  },
  flashcards: {
    page: 'Cartões',
    front: 'FRENTE · PERGUNTA',
    question: ['Qual foi a redução percentual de', 'consumo registrada no projeto piloto?'],
    source: 'Fonte: Relatório Piloto 2026, p. 1',
    back: 'VERSO · RESPOSTA',
    answer: 'Redução de 28%',
    answerLines: [
      'Alcançada após a adoção de iluminação LED',
      'e sensores de presença, com economia de',
      'R$ 420.000,00 no exercício.'
    ]
  }
}

const EN_US: PreviewCopy = {
  slide: {
    kickerVideo: 'EXPLAINER VIDEO',
    kickerPresentation: 'EXECUTIVE PRESENTATION',
    defaultSubtitle: 'Strategic synthesis grounded in the sources',
    coverLabel: 'Cover',
    openingLabel: 'Opening',
    contentLabel: 'Content & Chart',
    metricsLabel: 'Indicators',
    contentTitle: 'Key Points and Evolution',
    bullets: [
      'Clear diagnosis of operational bottlenecks',
      'Measurable goals with deadlines and owners',
      'Before-and-after impact comparison',
      'Next steps prioritized by return'
    ],
    chartTitle: 'Quarterly Evolution',
    quarters: ['Q1', 'Q2', 'Q3'],
    metricsTitle: 'Indicators and Results',
    metrics: ['Operational efficiency', 'Source fidelity', 'Productivity gain'],
    summaryTitle: 'Executive Summary',
    summary: [
      'Consolidated data shows a cost reduction in the second half,',
      'with a recommendation to expand immediately to regional units.'
    ]
  },
  oficio: {
    page1: 'Letter (Page 1)',
    page2: 'Annex (Page 2)',
    number: 'Letter No. 042/2026/GAB',
    date: 'Brasília, November 24, 2026.',
    recipientIntro: 'To the Honorable',
    recipientTitle: 'Director of Planning and Management',
    address1: 'Esplanada dos Ministérios, Block A',
    address2: '70040-900 Brasília - DF',
    subject: 'Subject: Schedule submission and request for action.',
    salutation: 'Dear Director,',
    paragraph1: [
      '1. Kindly, I am forwarding for analysis and approval the',
      'consolidated schedule of deliveries planned for the next operational quarter,',
      'under Administrative Process No. 2026/0184.'
    ],
    paragraph2: [
      '2. I kindly ask you to validate the targets described in the technical annex by',
      'December 10, 2026, ensuring alignment across the units involved.'
    ],
    closing: 'Sincerely,',
    signer: 'MARIA SILVA OLIVEIRA',
    signerRole: 'Executive Director',
    annexTitle: 'SOLE ANNEX — DELIVERY SCHEDULE',
    annexColumns: ['Stage', 'Responsible Unit', 'Deadline'],
    annexRows: [
      { stage: '1. Initial diagnosis', unit: 'Technical Coordination', deadline: 'Dec 5, 2026' },
      { stage: '2. Budget validation', unit: 'Finance Department', deadline: 'Dec 12, 2026' },
      { stage: '3. Official publication', unit: 'Executive Office', deadline: 'Dec 18, 2026' }
    ],
    pageOfPages: 'Page 2 of 2'
  },
  abnt: {
    page1: 'Title Page',
    page2: 'Abstract & Text',
    institution: 'FEDERAL UNIVERSITY OF TECHNOLOGY',
    author: 'JOÃO DA CONCEIÇÃO ARAÚJO',
    subtitle: 'Case study following NBR 14724, 10520 and 6023',
    nature: [
      'Course Completion Work submitted to',
      'the Undergraduate Coordination as a partial requirement',
      'for the degree of Bachelor.'
    ],
    city: 'SÃO PAULO',
    year: '2026',
    abstractTitle: 'ABSTRACT',
    abstract: [
      'This work analyzes the implementation of sustainable practices in public management,',
      'based on documentary evidence and comparative indicators from 2024',
      'to 2026. The results show a significant gain in administrative efficiency.'
    ],
    keywordsLabel: 'Keywords:',
    keywords: 'Efficiency. Sustainability. Public Management.',
    sectionTitle: '1 INTRODUCTION',
    section: [
      'Administrative modernization requires standardized instruments that ensure',
      'traceability of decisions and methodological rigor (SILVA, 2026, p. 14). In this',
      'sense, adopting objective criteria allows results to be evaluated transparently.'
    ],
    quote: [
      '“Methodological clarity is an indispensable condition for scientific reproducibility',
      'and documentary validation of the findings.” (SILVA, 2026, p. 42).'
    ],
    referencesTitle: 'REFERENCES',
    reference: 'SILVA, M. Sustainable Management and Efficiency. São Paulo: Example Publisher, 2026.'
  },
  resume: {
    page: 'ATS Résumé',
    name: 'MARIANA COSTA ALMEIDA',
    role: 'Project and Operations Coordinator',
    contact: 'São Paulo, SP · mariana.almeida@email.com · linkedin.com/in/mariana',
    summaryTitle: 'PROFESSIONAL SUMMARY',
    summary: [
      'Professional with 8 years of experience in project management, process',
      'optimization and leadership of multidisciplinary teams focused on results.'
    ],
    experienceTitle: 'PROFESSIONAL EXPERIENCE',
    jobTitle: 'Operations Manager — Horizonte S.A.',
    jobPeriod: '2023 – Present',
    jobBullets: [
      '• 28% reduction in operating costs after standardizing workflows.',
      '• Deployment of an indicator dashboard for 4 regional units.'
    ],
    skillsTitle: 'SKILLS',
    skills: 'Agile Management · Strategic Planning · Indicator Analysis · Leadership'
  },
  report: {
    kickerApostila: 'LEARNING MATERIAL',
    kickerContract: 'PRIVATE INSTRUMENT',
    kickerDefault: 'EXECUTIVE REPORT',
    coverLabel: 'Cover / Opening',
    bodyLabel: 'Body & Tables',
    summaryTitle: 'Executive Summary',
    summary: [
      'Consolidation of the main findings, performance indicators and priority actions',
      'grounded directly in the project sources.'
    ],
    section1Title: '1. Context and Analysis',
    section1: [
      'The integrated analysis of the documents makes it possible to identify operational patterns',
      'and opportunities for immediate efficiency gains, with less rework.',
      'Each recommendation below is linked to evidence verified in the sources.'
    ],
    page1: 'Page 1 / 2',
    section2Title: '2. Comparison and Next Steps',
    section2Intro: 'Comparison of consolidated indicators and recommended action plan:',
    table: {
      indicator: 'Indicator',
      current: 'Current',
      target: 'Target',
      rows: [
        ['Process adoption', '74%', '92%'],
        ['Document quality', '88%', '98%'],
        ['Average delivery time', '4 days', '2 days']
      ]
    },
    page2: 'Page 2 / 2'
  },
  xlsx: {
    page: 'Spreadsheet',
    headers: ['Regional Unit', 'Revenue (R$)', 'Cost (R$)', 'Margin'],
    rows: [
      ['São Paulo - Downtown', '420,000', '285,000', '32.1%'],
      ['Campinas - Plant B', '310,000', '198,000', '36.1%'],
      ['Curitiba - South', '275,000', '184,000', '33.1%']
    ],
    totalLabel: 'Consolidated Total',
    sumFormula: '=SUM(B2:B4)'
  },
  podcast: {
    page: 'Script & Audio',
    description: 'Stereo audio episode (2 hosts) · Synchronized transcript (SRT)',
    hostA: 'HOST A (Presenter)',
    hostB: 'HOST B (Analyst)',
    quotes: [
      '“The report data shows a 28% cost reduction in the first year.”',
      '“And what is most interesting is that the investment paid back in only 14 months.”'
    ]
  },
  mindmap: {
    page: 'Diagram',
    nodes: ['1. Initial Context', '2. Evidence', '3. Indicators', '4. Conclusions']
  },
  flashcards: {
    page: 'Cards',
    front: 'FRONT · QUESTION',
    question: ['What was the percentage reduction in', 'consumption recorded in the pilot project?'],
    source: 'Source: Pilot Report 2026, p. 1',
    back: 'BACK · ANSWER',
    answer: '28% reduction',
    answerLines: [
      'Achieved after adopting LED lighting',
      'and occupancy sensors, saving',
      'R$ 420,000.00 in the fiscal year.'
    ]
  }
}

const ES: PreviewCopy = {
  slide: {
    kickerVideo: 'VÍDEO EXPLICATIVO',
    kickerPresentation: 'PRESENTACIÓN EJECUTIVA',
    defaultSubtitle: 'Síntesis estratégica basada en las fuentes',
    coverLabel: 'Portada',
    openingLabel: 'Apertura',
    contentLabel: 'Contenido y gráfico',
    metricsLabel: 'Indicadores',
    contentTitle: 'Puntos principales y evolución',
    bullets: [
      'Diagnóstico claro de los cuellos de botella operativos',
      'Metas medibles con plazo y responsable',
      'Comparativa de impacto antes y después',
      'Próximos pasos priorizados por retorno'
    ],
    chartTitle: 'Evolución trimestral',
    quarters: ['T1', 'T2', 'T3'],
    metricsTitle: 'Indicadores y resultados',
    metrics: ['Eficiencia operativa', 'Fidelidad a las fuentes', 'Ganancia de productividad'],
    summaryTitle: 'Síntesis ejecutiva',
    summary: [
      'Los datos consolidados muestran una reducción de costes en el segundo semestre,',
      'con recomendación de expansión inmediata a las unidades regionales.'
    ]
  },
  oficio: {
    page1: 'Oficio (Pág. 1)',
    page2: 'Anexo (Pág. 2)',
    number: 'Oficio n.º 042/2026/GAB',
    date: 'Brasilia, 24 de noviembre de 2026.',
    recipientIntro: 'Al Señor',
    recipientTitle: 'Director de Planificación y Gestión',
    address1: 'Esplanada dos Ministérios, Bloque A',
    address2: '70040-900 Brasilia - DF',
    subject: 'Asunto: Envío de cronograma y solicitud de medidas.',
    salutation: 'Señor Director:',
    paragraph1: [
      '1. Le saludo cordialmente y remito para análisis y aprobación el',
      'cronograma consolidado de las entregas previstas para el próximo trimestre operativo,',
      'conforme al Proceso Administrativo n.º 2026/0184.'
    ],
    paragraph2: [
      '2. Le solicito validar las metas descritas en el anexo técnico hasta el día',
      '10 de diciembre de 2026, garantizando la alineación entre las unidades implicadas.'
    ],
    closing: 'Atentamente,',
    signer: 'MARIA SILVA OLIVEIRA',
    signerRole: 'Directora Ejecutiva',
    annexTitle: 'ANEXO ÚNICO — CRONOGRAMA DE ENTREGAS',
    annexColumns: ['Etapa', 'Unidad Responsable', 'Plazo'],
    annexRows: [
      { stage: '1. Diagnóstico inicial', unit: 'Coordinación Técnica', deadline: '05/12/2026' },
      { stage: '2. Validación presupuestaria', unit: 'Dirección Financiera', deadline: '12/12/2026' },
      { stage: '3. Publicación oficial', unit: 'Gabinete', deadline: '18/12/2026' }
    ],
    pageOfPages: 'Página 2 de 2'
  },
  abnt: {
    page1: 'Hoja de rostro',
    page2: 'Resumen y texto',
    institution: 'UNIVERSIDAD FEDERAL DE TECNOLOGÍA',
    author: 'JOÃO DA CONCEIÇÃO ARAÚJO',
    subtitle: 'Estudio de caso con normas NBR 14724, 10520 y 6023',
    nature: [
      'Trabajo de fin de grado presentado a la',
      'Coordinación de Grado como requisito parcial',
      'para la obtención del título de Bachiller.'
    ],
    city: 'SÃO PAULO',
    year: '2026',
    abstractTitle: 'RESUMEN',
    abstract: [
      'Este trabajo analiza la implementación de prácticas sostenibles en la gestión pública,',
      'con base en evidencias documentales e indicadores comparativos del período 2024',
      'a 2026. Los resultados demuestran una ganancia significativa de eficiencia administrativa.'
    ],
    keywordsLabel: 'Palabras clave:',
    keywords: 'Eficiencia. Sostenibilidad. Gestión Pública.',
    sectionTitle: '1 INTRODUCCIÓN',
    section: [
      'La modernización administrativa exige instrumentos estandarizados que aseguren',
      'trazabilidad de las decisiones y rigor metodológico (SILVA, 2026, p. 14). En ese',
      'sentido, adoptar criterios objetivos permite evaluar resultados con transparencia.'
    ],
    quote: [
      '“La claridad metodológica es condición indispensable para la reproducibilidad',
      'científica y la validación documental de los hallazgos.” (SILVA, 2026, p. 42).'
    ],
    referencesTitle: 'REFERENCIAS',
    reference: 'SILVA, M. Gestión Sostenible y Eficiencia. São Paulo: Editora Ejemplo, 2026.'
  },
  resume: {
    page: 'Currículum ATS',
    name: 'MARIANA COSTA ALMEIDA',
    role: 'Coordinadora de Proyectos y Operaciones',
    contact: 'São Paulo, SP · mariana.almeida@email.com · linkedin.com/in/mariana',
    summaryTitle: 'RESUMEN PROFESIONAL',
    summary: [
      'Profesional con 8 años de experiencia en gestión de proyectos, optimización de',
      'procesos y liderazgo de equipos multidisciplinares enfocados en resultados.'
    ],
    experienceTitle: 'EXPERIENCIA PROFESIONAL',
    jobTitle: 'Gerente de Operaciones — Empresa Horizonte S.A.',
    jobPeriod: '2023 – Actual',
    jobBullets: [
      '• Reducción del 28% en los costes operativos tras estandarizar los flujos.',
      '• Implantación de un panel de indicadores para 4 unidades regionales.'
    ],
    skillsTitle: 'COMPETENCIAS',
    skills: 'Gestión Ágil · Planificación Estratégica · Análisis de Indicadores · Liderazgo'
  },
  report: {
    kickerApostila: 'MATERIAL DIDÁCTICO',
    kickerContract: 'INSTRUMENTO PRIVADO',
    kickerDefault: 'INFORME EJECUTIVO',
    coverLabel: 'Portada / Apertura',
    bodyLabel: 'Cuerpo y tablas',
    summaryTitle: 'Síntesis ejecutiva',
    summary: [
      'Consolidación de los principales hallazgos, indicadores de desempeño y acciones',
      'prioritarias fundamentadas directamente en las fuentes del proyecto.'
    ],
    section1Title: '1. Contexto y análisis',
    section1: [
      'El análisis integrado de los documentos permite identificar patrones operativos',
      'y oportunidades de ganancia inmediata de eficiencia, con reducción del retrabajo.',
      'Cada recomendación siguiente está vinculada a las evidencias verificadas en las fuentes.'
    ],
    page1: 'Pág. 1 / 2',
    section2Title: '2. Cuadro comparativo y próximos pasos',
    section2Intro: 'Comparación de los indicadores consolidados y plan de acción recomendado:',
    table: {
      indicator: 'Indicador',
      current: 'Actual',
      target: 'Meta',
      rows: [
        ['Adopción del proceso', '74%', '92%'],
        ['Calidad documental', '88%', '98%'],
        ['Plazo medio de entrega', '4 días', '2 días']
      ]
    },
    page2: 'Pág. 2 / 2'
  },
  xlsx: {
    page: 'Hoja de cálculo',
    headers: ['Unidad Regional', 'Ingresos (R$)', 'Costes (R$)', 'Margen'],
    rows: [
      ['São Paulo - Centro', '420.000', '285.000', '32,1%'],
      ['Campinas - Planta B', '310.000', '198.000', '36,1%'],
      ['Curitiba - Sur', '275.000', '184.000', '33,1%']
    ],
    totalLabel: 'Total consolidado',
    sumFormula: '=SUMA(B2:B4)'
  },
  podcast: {
    page: 'Guion y audio',
    description: 'Episodio de audio estéreo (2 presentadores) · Transcripción sincronizada (SRT)',
    hostA: 'HOST A (Presentadora)',
    hostB: 'HOST B (Analista)',
    quotes: [
      '“Los datos del informe muestran una reducción del 28% en los costes en el primer año.”',
      '“Y lo más interesante es que la inversión se recuperó en solo 14 meses.”'
    ]
  },
  mindmap: {
    page: 'Diagrama',
    nodes: ['1. Contexto inicial', '2. Evidencias', '3. Indicadores', '4. Conclusiones']
  },
  flashcards: {
    page: 'Tarjetas',
    front: 'FRENTE · PREGUNTA',
    question: ['¿Cuál fue la reducción porcentual de', 'consumo registrada en el proyecto piloto?'],
    source: 'Fuente: Informe Piloto 2026, p. 1',
    back: 'REVERSO · RESPUESTA',
    answer: 'Reducción del 28%',
    answerLines: [
      'Lograda tras adoptar iluminación LED',
      'y sensores de presencia, con un ahorro de',
      'R$ 420.000,00 en el ejercicio.'
    ]
  }
}

const FR: PreviewCopy = {
  slide: {
    kickerVideo: 'VIDÉO EXPLICATIVE',
    kickerPresentation: 'PRÉSENTATION EXÉCUTIVE',
    defaultSubtitle: 'Synthèse stratégique fondée sur les sources',
    coverLabel: 'Couverture',
    openingLabel: 'Ouverture',
    contentLabel: 'Contenu et graphique',
    metricsLabel: 'Indicateurs',
    contentTitle: 'Points clés et évolution',
    bullets: [
      'Diagnostic clair des goulets d’étranglement opérationnels',
      'Objectifs mesurables avec échéance et responsable',
      'Comparatif d’impact avant et après',
      'Prochaines étapes priorisées par retour'
    ],
    chartTitle: 'Évolution trimestrielle',
    quarters: ['T1', 'T2', 'T3'],
    metricsTitle: 'Indicateurs et résultats',
    metrics: ['Efficacité opérationnelle', 'Fidélité aux sources', 'Gain de productivité'],
    summaryTitle: 'Synthèse exécutive',
    summary: [
      'Les données consolidées montrent une réduction des coûts au second semestre,',
      'avec une recommandation d’extension immédiate aux unités régionales.'
    ]
  },
  oficio: {
    page1: 'Courrier (p. 1)',
    page2: 'Annexe (p. 2)',
    number: 'Courrier n° 042/2026/GAB',
    date: 'Brasilia, le 24 novembre 2026.',
    recipientIntro: 'À Monsieur le',
    recipientTitle: 'Directeur de la planification et de la gestion',
    address1: 'Esplanada dos Ministérios, Bloc A',
    address2: '70040-900 Brasilia - DF',
    subject: 'Objet : Transmission du calendrier et demande de mesures.',
    salutation: 'Monsieur le Directeur,',
    paragraph1: [
      '1. Je vous salue cordialement et vous transmets pour analyse et approbation le',
      'calendrier consolidé des livraisons prévues pour le prochain trimestre opérationnel,',
      'conformément au dossier administratif n° 2026/0184.'
    ],
    paragraph2: [
      '2. Je vous prie de bien vouloir valider les objectifs décrits en annexe technique avant le',
      '10 décembre 2026, afin de garantir l’alignement entre les unités concernées.'
    ],
    closing: 'Cordialement,',
    signer: 'MARIA SILVA OLIVEIRA',
    signerRole: 'Directrice exécutive',
    annexTitle: 'ANNEXE UNIQUE — CALENDRIER DES LIVRAISONS',
    annexColumns: ['Étape', 'Unité responsable', 'Échéance'],
    annexRows: [
      { stage: '1. Diagnostic initial', unit: 'Coordination technique', deadline: '05/12/2026' },
      { stage: '2. Validation budgétaire', unit: 'Direction financière', deadline: '12/12/2026' },
      { stage: '3. Publication officielle', unit: 'Cabinet', deadline: '18/12/2026' }
    ],
    pageOfPages: 'Page 2 sur 2'
  },
  abnt: {
    page1: 'Page de titre',
    page2: 'Résumé et texte',
    institution: 'UNIVERSITÉ FÉDÉRALE DE TECHNOLOGIE',
    author: 'JOÃO DA CONCEIÇÃO ARAÚJO',
    subtitle: 'Étude de cas selon les normes NBR 14724, 10520 et 6023',
    nature: [
      'Travail de fin d’études présenté à',
      'la coordination de licence comme exigence partielle',
      'pour l’obtention du titre de licencié.'
    ],
    city: 'SÃO PAULO',
    year: '2026',
    abstractTitle: 'RÉSUMÉ',
    abstract: [
      'Ce travail analyse la mise en œuvre de pratiques durables dans la gestion publique,',
      'à partir de preuves documentaires et d’indicateurs comparatifs de la période 2024',
      'à 2026. Les résultats montrent un gain significatif d’efficacité administrative.'
    ],
    keywordsLabel: 'Mots-clés :',
    keywords: 'Efficacité. Durabilité. Gestion publique.',
    sectionTitle: '1 INTRODUCTION',
    section: [
      'La modernisation administrative exige des instruments standardisés garantissant',
      'la traçabilité des décisions et la rigueur méthodologique (SILVA, 2026, p. 14). En ce',
      'sens, l’adoption de critères objectifs permet d’évaluer les résultats avec transparence.'
    ],
    quote: [
      '« La clarté méthodologique est une condition indispensable à la reproductibilité',
      'scientifique et à la validation documentaire des résultats. » (SILVA, 2026, p. 42).'
    ],
    referencesTitle: 'RÉFÉRENCES',
    reference: 'SILVA, M. Gestion durable et efficacité. São Paulo : Éditeur Exemple, 2026.'
  },
  resume: {
    page: 'CV ATS',
    name: 'MARIANA COSTA ALMEIDA',
    role: 'Coordinatrice de projets et d’opérations',
    contact: 'São Paulo, SP · mariana.almeida@email.com · linkedin.com/in/mariana',
    summaryTitle: 'RÉSUMÉ PROFESSIONNEL',
    summary: [
      'Professionnelle avec 8 ans d’expérience en gestion de projets, optimisation de',
      'processus et direction d’équipes pluridisciplinaires axées sur les résultats.'
    ],
    experienceTitle: 'EXPÉRIENCE PROFESSIONNELLE',
    jobTitle: 'Responsable des opérations — Entreprise Horizonte S.A.',
    jobPeriod: '2023 – Aujourd’hui',
    jobBullets: [
      '• Réduction de 28 % des coûts opérationnels après standardisation des flux.',
      '• Déploiement d’un tableau de bord d’indicateurs pour 4 unités régionales.'
    ],
    skillsTitle: 'COMPÉTENCES',
    skills: 'Gestion agile · Planification stratégique · Analyse d’indicateurs · Direction'
  },
  report: {
    kickerApostila: 'SUPPORT PÉDAGOGIQUE',
    kickerContract: 'INSTRUMENT PRIVÉ',
    kickerDefault: 'RAPPORT EXÉCUTIF',
    coverLabel: 'Couverture / Ouverture',
    bodyLabel: 'Corps et tableaux',
    summaryTitle: 'Synthèse exécutive',
    summary: [
      'Consolidation des principaux constats, indicateurs de performance et actions',
      'prioritaires fondées directement sur les sources du projet.'
    ],
    section1Title: '1. Contexte et analyse',
    section1: [
      'L’analyse intégrée des documents permet d’identifier des schémas opérationnels',
      'et des gains immédiats d’efficacité, avec moins de retraitement.',
      'Chaque recommandation ci-dessous est liée aux preuves vérifiées dans les sources.'
    ],
    page1: 'Page 1 sur 2',
    section2Title: '2. Tableau comparatif et prochaines étapes',
    section2Intro: 'Comparaison des indicateurs consolidés et plan d’action recommandé :',
    table: {
      indicator: 'Indicateur',
      current: 'Actuel',
      target: 'Cible',
      rows: [
        ['Adoption du processus', '74 %', '92 %'],
        ['Qualité documentaire', '88 %', '98 %'],
        ['Délai moyen de livraison', '4 jours', '2 jours']
      ]
    },
    page2: 'Page 2 sur 2'
  },
  xlsx: {
    page: 'Tableur',
    headers: ['Unité régionale', 'Revenus (R$)', 'Coûts (R$)', 'Marge'],
    rows: [
      ['São Paulo - Centre', '420 000', '285 000', '32,1 %'],
      ['Campinas - Usine B', '310 000', '198 000', '36,1 %'],
      ['Curitiba - Sud', '275 000', '184 000', '33,1 %']
    ],
    totalLabel: 'Total consolidé',
    sumFormula: '=SOMME(B2:B4)'
  },
  podcast: {
    page: 'Script et audio',
    description: 'Épisode audio stéréo (2 animateurs) · Transcription synchronisée (SRT)',
    hostA: 'ANIMATEUR A (Présentateur)',
    hostB: 'ANIMATEUR B (Analyste)',
    quotes: [
      '« Les données du rapport montrent une réduction de 28 % des coûts dès la première année. »',
      '« Et le plus intéressant, c’est que l’investissement a été rentabilisé en seulement 14 mois. »'
    ]
  },
  mindmap: {
    page: 'Diagramme',
    nodes: ['1. Contexte initial', '2. Preuves', '3. Indicateurs', '4. Conclusions']
  },
  flashcards: {
    page: 'Cartes',
    front: 'RECTO · QUESTION',
    question: ['Quelle a été la réduction en pourcentage de', 'consommation enregistrée dans le projet pilote ?'],
    source: 'Source : Rapport pilote 2026, p. 1',
    back: 'VERSO · RÉPONSE',
    answer: 'Réduction de 28 %',
    answerLines: [
      'Obtenue après l’adoption de l’éclairage LED',
      'et de capteurs de présence, avec une économie de',
      'R$ 420 000,00 sur l’exercice.'
    ]
  }
}

const DE: PreviewCopy = {
  slide: {
    kickerVideo: 'ERKLÄRVIDEO',
    kickerPresentation: 'MANAGEMENT-PRÄSENTATION',
    defaultSubtitle: 'Strategische Synthese auf Basis der Quellen',
    coverLabel: 'Titel',
    openingLabel: 'Einstieg',
    contentLabel: 'Inhalt und Diagramm',
    metricsLabel: 'Kennzahlen',
    contentTitle: 'Kernpunkte und Entwicklung',
    bullets: [
      'Klares Bild der operativen Engpässe',
      'Messbare Ziele mit Frist und Verantwortlichem',
      'Vorher-Nachher-Vergleich der Wirkung',
      'Nächste Schritte nach Rendite priorisiert'
    ],
    chartTitle: 'Quartalsentwicklung',
    quarters: ['Q1', 'Q2', 'Q3'],
    metricsTitle: 'Kennzahlen und Ergebnisse',
    metrics: ['Operative Effizienz', 'Quellentreue', 'Produktivitätsgewinn'],
    summaryTitle: 'Management Summary',
    summary: [
      'Die konsolidierten Daten zeigen eine Kostenreduktion im zweiten Halbjahr,',
      'mit der Empfehlung, sofort auf regionale Einheiten zu erweitern.'
    ]
  },
  oficio: {
    page1: 'Schreiben (S. 1)',
    page2: 'Anhang (S. 2)',
    number: 'Schreiben Nr. 042/2026/GAB',
    date: 'Brasília, 24. November 2026.',
    recipientIntro: 'An den',
    recipientTitle: 'Direktor für Planung und Verwaltung',
    address1: 'Esplanada dos Ministérios, Block A',
    address2: '70040-900 Brasília - DF',
    subject: 'Betreff: Übermittlung des Zeitplans und Bitte um Maßnahmen.',
    salutation: 'Sehr geehrter Herr Direktor,',
    paragraph1: [
      '1. Ich übermittle Ihnen freundlich zur Prüfung und Genehmigung den',
      'konsolidierten Zeitplan der Lieferungen für das nächste operative Quartal,',
      'gemäß Verwaltungsvorgang Nr. 2026/0184.'
    ],
    paragraph2: [
      '2. Ich bitte Sie, die im technischen Anhang beschriebenen Ziele bis zum',
      '10. Dezember 2026 zu bestätigen und die Abstimmung der beteiligten Einheiten sicherzustellen.'
    ],
    closing: 'Mit freundlichen Grüßen',
    signer: 'MARIA SILVA OLIVEIRA',
    signerRole: 'Geschäftsführerin',
    annexTitle: 'EINZIGE ANLAGE — LIEFERZEITPLAN',
    annexColumns: ['Phase', 'Verantwortliche Einheit', 'Frist'],
    annexRows: [
      { stage: '1. Erstdiagnose', unit: 'Technische Koordination', deadline: '05.12.2026' },
      { stage: '2. Budgetprüfung', unit: 'Finanzdirektion', deadline: '12.12.2026' },
      { stage: '3. Amtliche Veröffentlichung', unit: 'Stabsstelle', deadline: '18.12.2026' }
    ],
    pageOfPages: 'Seite 2 von 2'
  },
  abnt: {
    page1: 'Titelseite',
    page2: 'Zusammenfassung und Text',
    institution: 'BUNDESUNIVERSITÄT FÜR TECHNOLOGIE',
    author: 'JOÃO DA CONCEIÇÃO ARAÚJO',
    subtitle: 'Fallstudie nach den Normen NBR 14724, 10520 und 6023',
    nature: [
      'Abschlussarbeit, vorgelegt an die',
      'Studienkoordination als Teilvoraussetzung',
      'für den Abschluss als Bachelor.'
    ],
    city: 'SÃO PAULO',
    year: '2026',
    abstractTitle: 'ZUSAMMENFASSUNG',
    abstract: [
      'Diese Arbeit untersucht die Umsetzung nachhaltiger Praktiken in der öffentlichen Verwaltung',
      'anhand dokumentarischer Belege und vergleichender Kennzahlen aus den Jahren 2024',
      'bis 2026. Die Ergebnisse zeigen einen deutlichen Gewinn an Verwaltungseffizienz.'
    ],
    keywordsLabel: 'Schlagwörter:',
    keywords: 'Effizienz. Nachhaltigkeit. Öffentliche Verwaltung.',
    sectionTitle: '1 EINLEITUNG',
    section: [
      'Die Verwaltungsmodernisierung erfordert standardisierte Instrumente, die',
      'Nachvollziehbarkeit der Entscheidungen und methodische Strenge sichern (SILVA, 2026, S. 14). In diesem',
      'Sinne ermöglichen objektive Kriterien eine transparente Bewertung der Ergebnisse.'
    ],
    quote: [
      '„Methodische Klarheit ist eine unverzichtbare Voraussetzung für wissenschaftliche',
      'Reproduzierbarkeit und dokumentarische Validierung der Ergebnisse.“ (SILVA, 2026, S. 42).'
    ],
    referencesTitle: 'LITERATURVERZEICHNIS',
    reference: 'SILVA, M. Nachhaltige Verwaltung und Effizienz. São Paulo: Beispielverlag, 2026.'
  },
  resume: {
    page: 'ATS-Lebenslauf',
    name: 'MARIANA COSTA ALMEIDA',
    role: 'Projekt- und Betriebskoordinatorin',
    contact: 'São Paulo, SP · mariana.almeida@email.com · linkedin.com/in/mariana',
    summaryTitle: 'BERUFLICHES PROFIL',
    summary: [
      'Fachkraft mit 8 Jahren Erfahrung in Projektmanagement, Prozessoptimierung',
      'und Führung multidisziplinärer Teams mit Ergebnisorientierung.'
    ],
    experienceTitle: 'BERUFSERFAHRUNG',
    jobTitle: 'Betriebsleiterin — Unternehmen Horizonte S.A.',
    jobPeriod: '2023 – heute',
    jobBullets: [
      '• 28 % geringere Betriebskosten nach Standardisierung der Abläufe.',
      '• Einführung eines Kennzahlen-Dashboards für 4 regionale Einheiten.'
    ],
    skillsTitle: 'KOMPETENZEN',
    skills: 'Agiles Management · Strategische Planung · Kennzahlenanalyse · Führung'
  },
  report: {
    kickerApostila: 'LEHRMATERIAL',
    kickerContract: 'PRIVATURKUNDE',
    kickerDefault: 'MANAGEMENTBERICHT',
    coverLabel: 'Titel / Einstieg',
    bodyLabel: 'Inhalt und Tabellen',
    summaryTitle: 'Management Summary',
    summary: [
      'Zusammenfassung der wichtigsten Ergebnisse, Leistungskennzahlen und',
      'prioritären Maßnahmen direkt aus den Projektquellen.'
    ],
    section1Title: '1. Kontext und Analyse',
    section1: [
      'Die integrierte Analyse der Dokumente zeigt operative Muster',
      'und Möglichkeiten für sofortige Effizienzgewinne bei weniger Nacharbeit.',
      'Jede Empfehlung unten ist mit den geprüften Belegen aus den Quellen verknüpft.'
    ],
    page1: 'Seite 1 / 2',
    section2Title: '2. Vergleichstabelle und nächste Schritte',
    section2Intro: 'Vergleich der konsolidierten Kennzahlen und empfohlener Aktionsplan:',
    table: {
      indicator: 'Kennzahl',
      current: 'Aktuell',
      target: 'Ziel',
      rows: [
        ['Prozessakzeptanz', '74 %', '92 %'],
        ['Dokumentqualität', '88 %', '98 %'],
        ['Durchschnittliche Lieferzeit', '4 Tage', '2 Tage']
      ]
    },
    page2: 'Seite 2 / 2'
  },
  xlsx: {
    page: 'Tabelle',
    headers: ['Regionale Einheit', 'Umsatz (R$)', 'Kosten (R$)', 'Marge'],
    rows: [
      ['São Paulo - Zentrum', '420.000', '285.000', '32,1 %'],
      ['Campinas - Werk B', '310.000', '198.000', '36,1 %'],
      ['Curitiba - Süd', '275.000', '184.000', '33,1 %']
    ],
    totalLabel: 'Konsolidierte Summe',
    sumFormula: '=SUMME(B2:B4)'
  },
  podcast: {
    page: 'Skript und Audio',
    description: 'Stereo-Audiofolge (2 Moderatoren) · Synchronisierte Transkription (SRT)',
    hostA: 'MODERATOR A (Präsentator)',
    hostB: 'MODERATOR B (Analyst)',
    quotes: [
      '„Die Berichtsdaten zeigen eine Kostensenkung von 28 % bereits im ersten Jahr.“',
      '„Und besonders interessant: Die Investition hat sich in nur 14 Monaten amortisiert.“'
    ]
  },
  mindmap: {
    page: 'Diagramm',
    nodes: ['1. Ausgangslage', '2. Belege', '3. Kennzahlen', '4. Schlussfolgerungen']
  },
  flashcards: {
    page: 'Karten',
    front: 'VORDERSEITE · FRAGE',
    question: ['Wie hoch war die prozentuale Reduktion des', 'Verbrauchs im Pilotprojekt?'],
    source: 'Quelle: Pilotbericht 2026, S. 1',
    back: 'RÜCKSEITE · ANTWORT',
    answer: 'Reduktion um 28 %',
    answerLines: [
      'Erreicht durch LED-Beleuchtung',
      'und Präsenzsensoren, mit einer Einsparung von',
      'R$ 420.000,00 im Geschäftsjahr.'
    ]
  }
}

const IT: PreviewCopy = {
  slide: {
    kickerVideo: 'VIDEO ESPLICATIVO',
    kickerPresentation: 'PRESENTAZIONE EXECUTIVE',
    defaultSubtitle: 'Sintesi strategica basata sulle fonti',
    coverLabel: 'Copertina',
    openingLabel: 'Apertura',
    contentLabel: 'Contenuto e grafico',
    metricsLabel: 'Indicatori',
    contentTitle: 'Punti chiave ed evoluzione',
    bullets: [
      'Diagnosi chiara dei colli di bottiglia operativi',
      'Obiettivi misurabili con scadenza e responsabile',
      'Confronto dell’impatto prima e dopo',
      'Prossimi passi prioritizzati per ritorno'
    ],
    chartTitle: 'Evoluzione trimestrale',
    quarters: ['T1', 'T2', 'T3'],
    metricsTitle: 'Indicatori e risultati',
    metrics: ['Efficienza operativa', 'Fedeltà alle fonti', 'Guadagno di produttività'],
    summaryTitle: 'Sintesi executive',
    summary: [
      'I dati consolidati mostrano una riduzione dei costi nel secondo semestre,',
      'con raccomandazione di espansione immediata alle unità regionali.'
    ]
  },
  oficio: {
    page1: 'Lettera (pag. 1)',
    page2: 'Allegato (pag. 2)',
    number: 'Lettera n. 042/2026/GAB',
    date: 'Brasilia, 24 novembre 2026.',
    recipientIntro: 'Al Signor',
    recipientTitle: 'Direttore della pianificazione e della gestione',
    address1: 'Esplanada dos Ministérios, Blocco A',
    address2: '70040-900 Brasilia - DF',
    subject: 'Oggetto: Invio del cronoprogramma e richiesta di provvedimenti.',
    salutation: 'Signor Direttore,',
    paragraph1: [
      '1. Con cordiali saluti, trasmetto per analisi e approvazione il',
      'cronoprogramma consolidato delle consegne previste per il prossimo trimestre operativo,',
      'ai sensi del Procedimento Amministrativo n. 2026/0184.'
    ],
    paragraph2: [
      '2. Chiedo cortesemente di validare gli obiettivi descritti nell’allegato tecnico entro il',
      '10 dicembre 2026, garantendo l’allineamento tra le unità coinvolte.'
    ],
    closing: 'Cordiali saluti,',
    signer: 'MARIA SILVA OLIVEIRA',
    signerRole: 'Direttrice esecutiva',
    annexTitle: 'ALLEGATO UNICO — CRONOPROGRAMMA DELLE CONSEGNE',
    annexColumns: ['Fase', 'Unità responsabile', 'Scadenza'],
    annexRows: [
      { stage: '1. Diagnosi iniziale', unit: 'Coordinamento tecnico', deadline: '05/12/2026' },
      { stage: '2. Validazione di bilancio', unit: 'Direzione finanziaria', deadline: '12/12/2026' },
      { stage: '3. Pubblicazione ufficiale', unit: 'Gabinetto', deadline: '18/12/2026' }
    ],
    pageOfPages: 'Pagina 2 di 2'
  },
  abnt: {
    page1: 'Frontespizio',
    page2: 'Riassunto e testo',
    institution: 'UNIVERSITÀ FEDERALE DI TECNOLOGIA',
    author: 'JOÃO DA CONCEIÇÃO ARAÚJO',
    subtitle: 'Caso di studio secondo le norme NBR 14724, 10520 e 6023',
    nature: [
      'Tesi di laurea presentata alla',
      'Coordinamento didattico come requisito parziale',
      'per il conseguimento del titolo di laureato.'
    ],
    city: 'SÃO PAULO',
    year: '2026',
    abstractTitle: 'RIASSUNTO',
    abstract: [
      'Questo lavoro analizza l’implementazione di pratiche sostenibili nella gestione pubblica,',
      'sulla base di evidenze documentali e indicatori comparativi del periodo 2024',
      '- 2026. I risultati mostrano un guadagno significativo di efficienza amministrativa.'
    ],
    keywordsLabel: 'Parole chiave:',
    keywords: 'Efficienza. Sostenibilità. Gestione pubblica.',
    sectionTitle: '1 INTRODUZIONE',
    section: [
      'La modernizzazione amministrativa richiede strumenti standardizzati che garantiscano',
      'tracciabilità delle decisioni e rigore metodologico (SILVA, 2026, p. 14). In questo',
      'senso, l’adozione di criteri oggettivi consente di valutare i risultati con trasparenza.'
    ],
    quote: [
      '“La chiarezza metodologica è condizione indispensabile per la riproducibilità',
      'scientifica e la validazione documentale dei risultati.” (SILVA, 2026, p. 42).'
    ],
    referencesTitle: 'RIFERIMENTI',
    reference: 'SILVA, M. Gestione sostenibile ed efficienza. São Paulo: Editore Esempio, 2026.'
  },
  resume: {
    page: 'Curriculum ATS',
    name: 'MARIANA COSTA ALMEIDA',
    role: 'Coordinatrice di progetti e operazioni',
    contact: 'São Paulo, SP · mariana.almeida@email.com · linkedin.com/in/mariana',
    summaryTitle: 'PROFILO PROFESSIONALE',
    summary: [
      'Professionista con 8 anni di esperienza nella gestione di progetti, ottimizzazione',
      'dei processi e guida di team multidisciplinari orientati ai risultati.'
    ],
    experienceTitle: 'ESPERIENZA PROFESSIONALE',
    jobTitle: 'Responsabile delle operazioni — Azienda Horizonte S.A.',
    jobPeriod: '2023 – oggi',
    jobBullets: [
      '• Riduzione del 28% dei costi operativi dopo la standardizzazione dei flussi.',
      '• Implementazione di una dashboard di indicatori per 4 unità regionali.'
    ],
    skillsTitle: 'COMPETENZE',
    skills: 'Gestione Agile · Pianificazione Strategica · Analisi di Indicatori · Leadership'
  },
  report: {
    kickerApostila: 'MATERIALE DIDATTICO',
    kickerContract: 'ATTO PRIVATO',
    kickerDefault: 'REPORT EXECUTIVE',
    coverLabel: 'Copertina / Apertura',
    bodyLabel: 'Corpo e tabelle',
    summaryTitle: 'Sintesi executive',
    summary: [
      'Consolidamento dei principali risultati, indicatori di prestazione e azioni',
      'prioritarie fondate direttamente sulle fonti del progetto.'
    ],
    section1Title: '1. Contesto e analisi',
    section1: [
      'L’analisi integrata dei documenti consente di individuare schemi operativi',
      'e opportunità di guadagno immediato di efficienza, con meno rilavorazioni.',
      'Ogni raccomandazione seguente è collegata alle evidenze verificate nelle fonti.'
    ],
    page1: 'Pag. 1 / 2',
    section2Title: '2. Quadro comparativo e prossimi passi',
    section2Intro: 'Confronto degli indicatori consolidati e piano d’azione consigliato:',
    table: {
      indicator: 'Indicatore',
      current: 'Attuale',
      target: 'Obiettivo',
      rows: [
        ['Adozione del processo', '74%', '92%'],
        ['Qualità documentale', '88%', '98%'],
        ['Tempo medio di consegna', '4 giorni', '2 giorni']
      ]
    },
    page2: 'Pag. 2 / 2'
  },
  xlsx: {
    page: 'Foglio di calcolo',
    headers: ['Unità regionale', 'Ricavi (R$)', 'Costi (R$)', 'Margine'],
    rows: [
      ['São Paulo - Centro', '420.000', '285.000', '32,1%'],
      ['Campinas - Impianto B', '310.000', '198.000', '36,1%'],
      ['Curitiba - Sud', '275.000', '184.000', '33,1%']
    ],
    totalLabel: 'Totale consolidato',
    sumFormula: '=SOMMA(B2:B4)'
  },
  podcast: {
    page: 'Copione e audio',
    description: 'Episodio audio stereo (2 conduttori) · Trascrizione sincronizzata (SRT)',
    hostA: 'CONDUTTORE A (Presentatore)',
    hostB: 'CONDUTTORE B (Analista)',
    quotes: [
      '“I dati del report mostrano una riduzione del 28% dei costi già nel primo anno.”',
      '“E la cosa più interessante è che l’investimento è stato recuperato in soli 14 mesi.”'
    ]
  },
  mindmap: {
    page: 'Diagramma',
    nodes: ['1. Contesto iniziale', '2. Evidenze', '3. Indicatori', '4. Conclusioni']
  },
  flashcards: {
    page: 'Schede',
    front: 'FRONTE · DOMANDA',
    question: ['Qual è stata la riduzione percentuale dei', 'consumi registrata nel progetto pilota?'],
    source: 'Fonte: Report pilota 2026, p. 1',
    back: 'RETRO · RISPOSTA',
    answer: 'Riduzione del 28%',
    answerLines: [
      'Ottenuta dopo l’adozione di illuminazione LED',
      'e sensori di presenza, con un risparmio di',
      'R$ 420.000,00 nell’esercizio.'
    ]
  }
}

const COPY: Record<DocsLocale, PreviewCopy> = {
  'pt-BR': PT_BR,
  'en-US': EN_US,
  es: ES,
  fr: FR,
  de: DE,
  it: IT
}

export function getPreviewCopy(locale?: string | null): PreviewCopy {
  return COPY[normalizeLocale(locale)]
}
