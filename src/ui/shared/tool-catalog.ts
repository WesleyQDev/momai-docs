export interface ToolSpec {
  id: string
  emoji: string
  label: string
  category: 'Oficial' | 'Acadêmico' | 'Slides' | 'Planilhas' | 'Áudio & Vídeo' | 'Relatórios'
  description: string
  specLine: string
  formats: string[]
  thumbVariant: 'a4' | 'slide' | 'sheet' | 'audio' | 'abnt' | 'letterhead'
  featured?: boolean
  featuredCompact?: boolean
}

export const TOOL_CATALOG: ToolSpec[] = [
  {
    id: 'oficio',
    emoji: '🏛️',
    label: 'Ofícios e Cartas',
    category: 'Oficial',
    description: 'Redação oficial com numeração, endereçamento e fecho formal.',
    specLine: 'Manual de Redação Oficial · margens 3 / 2 / 3 / 2 cm',
    formats: ['docx', 'pdf'],
    thumbVariant: 'letterhead',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'abnt',
    emoji: '🎓',
    label: 'Trabalho ABNT',
    category: 'Acadêmico',
    description: 'Capa, folha de rosto, sumário, citações e referências NBR 14724.',
    specLine: 'ABNT NBR 14724 · margens 3 / 2 / 3 / 2 cm · fonte 12pt',
    formats: ['docx', 'pdf'],
    thumbVariant: 'abnt',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'video',
    emoji: '🎬',
    label: 'Vídeo Explicativo',
    category: 'Áudio & Vídeo',
    description: 'Cenas narradas com slides sincronizados, legendas e exportação MP4.',
    specLine: 'Vídeo 1080p · narração e legendas embutidas',
    formats: ['mp4', 'mp3', 'srt'],
    thumbVariant: 'slide',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'apostila',
    emoji: '📖',
    label: 'Apostilas',
    category: 'Acadêmico',
    description: 'Material didático estruturado com módulos, quadros e exercícios.',
    specLine: 'Estrutura modular · caixas de destaque e gabarito',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'podcast',
    emoji: '🎙️',
    label: 'Podcast (Phonon TTS)',
    category: 'Áudio & Vídeo',
    description: 'Roteiro em diálogo com duas vozes neurais locais e legenda SRT.',
    specLine: 'Áudio estéreo + transcrição sincronizada',
    formats: ['mp3', 'wav', 'srt', 'md'],
    thumbVariant: 'audio',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'xlsx',
    emoji: '📈',
    label: 'Planilha XLSX',
    category: 'Planilhas',
    description: 'Tabelas estruturadas com fórmulas reais, totais e múltiplas abas.',
    specLine: 'Fórmulas nativas Excel · formatação tabular',
    formats: ['xlsx'],
    thumbVariant: 'sheet',
    featured: true,
    featuredCompact: true
  },
  {
    id: 'report',
    emoji: '📑',
    label: 'Relatório Executivo',
    category: 'Relatórios',
    description: 'Sumário executivo, métricas, achados rastreados e próximos passos.',
    specLine: 'Layout executivo · tabelas e citações por fonte',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4',
    featured: true
  },
  {
    id: 'letterhead',
    emoji: '🖋️',
    label: 'Folha Timbrada',
    category: 'Oficial',
    description: 'Extrai timbre, marca e paleta de um documento base da instituição.',
    specLine: 'Identidade visual extraída · cabeçalho e rodapé fiéis',
    formats: ['docx', 'pdf'],
    thumbVariant: 'letterhead',
    featured: true
  },
  {
    id: 'pptx',
    emoji: '📊',
    label: 'Slides',
    category: 'Slides',
    description: 'Deck 16:9 com capa, agenda, dados visuais e notas do apresentador.',
    specLine: 'Widescreen 16:9 · hierarquia visual automática',
    formats: ['pptx', 'pdf'],
    thumbVariant: 'slide',
    featured: true
  },
  {
    id: 'flashcards',
    emoji: '🃏',
    label: 'Flashcards & Quiz',
    category: 'Acadêmico',
    description: 'Cartões de revisão ativa e questões comentadas a partir das fontes.',
    specLine: 'Compatível com Anki e CSV',
    formats: ['csv', 'anki'],
    thumbVariant: 'a4',
    featured: true
  },
  {
    id: 'mindmap',
    emoji: '🧠',
    label: 'Mapa Mental / Timeline',
    category: 'Acadêmico',
    description: 'Diagrama vetorial limpo para estudo, síntese e visão cronológica.',
    specLine: 'SVG vetorial escalável',
    formats: ['svg'],
    thumbVariant: 'slide'
  },
  {
    id: 'resume',
    emoji: '📄',
    label: 'Currículo ATS',
    category: 'Relatórios',
    description: 'Currículo limpo, legível por recrutadores e sistemas ATS.',
    specLine: 'Coluna única · leitura otimizada',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4'
  },
  {
    id: 'lesson_plan',
    emoji: '🗓️',
    label: 'Plano de Aula',
    category: 'Acadêmico',
    description: 'Objetivos, habilidades, metodologia, cronograma e avaliação.',
    specLine: 'Estrutura pedagógica pronta para impressão',
    formats: ['docx', 'pdf'],
    thumbVariant: 'a4'
  },
  {
    id: 'meeting_minutes',
    emoji: '📝',
    label: 'Ata de Reunião',
    category: 'Oficial',
    description: 'Pauta, participantes, deliberações, responsáveis e prazos.',
    specLine: 'Registro formal com blocos de decisão',
    formats: ['docx', 'pdf'],
    thumbVariant: 'letterhead'
  }
]

export const PROFILE_EMOJIS: Record<string, string> = {
  general: '📓',
  student: '🎓',
  teacher: '📖',
  lawyer: '⚖️',
  public_servant: '🏛️',
  executive: '💼'
}

export const PROFILE_LABELS: Record<string, string> = {
  general: 'Geral',
  student: 'Acadêmico',
  teacher: 'Docente',
  lawyer: 'Jurídico',
  public_servant: 'Oficial',
  executive: 'Executivo'
}

export interface ToolSizeOption {
  value: string
  label: string
  promptHint: string
}

export interface ToolSizeConfig {
  label: string
  options: ToolSizeOption[]
}

const AUTO_OPTION: ToolSizeOption = {
  value: 'auto',
  label: 'Automático',
  promptHint: ''
}

const PAGE_SIZE_SHORT: ToolSizeConfig = {
  label: 'Tamanho (páginas)',
  options: [
    AUTO_OPTION,
    { value: '1p', label: '1 página (curto)', promptHint: 'Extensão alvo: exatamente 1 página (conciso e direto).' },
    { value: '2p', label: '2 páginas', promptHint: 'Extensão alvo: cerca de 2 páginas bem distribuídas.' },
    { value: '3-4p', label: '3 a 4 páginas', promptHint: 'Extensão alvo: entre 3 e 4 páginas com desenvolvimento detalhado.' },
    { value: '5+p', label: '5+ páginas (completo)', promptHint: 'Extensão alvo: 5 páginas ou mais, com aprofundamento completo.' }
  ]
}

export const TOOL_SIZE_CONFIGS: Record<string, ToolSizeConfig> = {
  oficio: PAGE_SIZE_SHORT,
  letterhead: {
    label: 'Tamanho (páginas)',
    options: [
      AUTO_OPTION,
      { value: '1p', label: '1 página', promptHint: 'Extensão alvo: 1 página.' },
      { value: '2p', label: '2 páginas', promptHint: 'Extensão alvo: 2 páginas.' },
      { value: '3-5p', label: '3 a 5 páginas', promptHint: 'Extensão alvo: entre 3 e 5 páginas.' }
    ]
  },
  abnt: {
    label: 'Tamanho (páginas)',
    options: [
      AUTO_OPTION,
      { value: '3-5p', label: '3 a 5 páginas (artigo curto)', promptHint: 'Extensão alvo: entre 3 e 5 páginas textuais.' },
      { value: '6-10p', label: '6 a 10 páginas', promptHint: 'Extensão alvo: entre 6 e 10 páginas com seções bem desenvolvidas.' },
      { value: '12-20p', label: '12 a 20 páginas', promptHint: 'Extensão alvo: entre 12 e 20 páginas com referencial aprofundado.' },
      { value: '25+p', label: '25+ páginas (monografia)', promptHint: 'Extensão alvo: 25 páginas ou mais, em formato completo de monografia.' }
    ]
  },
  apostila: {
    label: 'Tamanho (páginas)',
    options: [
      AUTO_OPTION,
      { value: '4-8p', label: '4 a 8 páginas (módulo)', promptHint: 'Extensão alvo: entre 4 e 8 páginas didáticas.' },
      { value: '10-15p', label: '10 a 15 páginas', promptHint: 'Extensão alvo: entre 10 e 15 páginas com exemplos e exercícios.' },
      { value: '16-25p', label: '16 a 25 páginas (completa)', promptHint: 'Extensão alvo: entre 16 e 25 páginas com múltiplos capítulos.' }
    ]
  },
  report: {
    label: 'Tamanho (páginas)',
    options: [
      AUTO_OPTION,
      { value: '1-2p', label: '1 a 2 páginas (One-Pager)', promptHint: 'Extensão alvo: 1 a 2 páginas executivas.' },
      { value: '3-5p', label: '3 a 5 páginas', promptHint: 'Extensão alvo: entre 3 e 5 páginas analíticas.' },
      { value: '6-10p', label: '6 a 10 páginas (dossiê)', promptHint: 'Extensão alvo: entre 6 e 10 páginas detalhadas.' }
    ]
  },
  resume: {
    label: 'Tamanho (páginas)',
    options: [
      AUTO_OPTION,
      { value: '1p', label: '1 página (enxuto)', promptHint: 'Extensão alvo: caber em 1 página.' },
      { value: '2p', label: '2 páginas (detalhado)', promptHint: 'Extensão alvo: 2 páginas com experiências detalhadas.' }
    ]
  },
  lesson_plan: {
    label: 'Tamanho (páginas)',
    options: [
      AUTO_OPTION,
      { value: '1p', label: '1 página (1 aula)', promptHint: 'Extensão alvo: 1 página para uma aula.' },
      { value: '2p', label: '2 páginas (aula dupla)', promptHint: 'Extensão alvo: 2 páginas com atividades detalhadas.' },
      { value: '3+p', label: '3+ páginas (sequência)', promptHint: 'Extensão alvo: 3 ou mais páginas em sequência didática.' }
    ]
  },
  meeting_minutes: PAGE_SIZE_SHORT,
  video: {
    label: 'Duração (minutos)',
    options: [
      AUTO_OPTION,
      { value: '1m', label: '1 minuto (curto)', promptHint: 'Duração alvo do vídeo: cerca de 1 minuto (aprox. 140 a 170 palavras de narração em 4 a 5 cenas).' },
      { value: '2-3m', label: '2 a 3 minutos', promptHint: 'Duração alvo do vídeo: 2 a 3 minutos (aprox. 320 a 480 palavras de narração em 6 a 8 cenas).' },
      { value: '5m', label: '5 minutos', promptHint: 'Duração alvo do vídeo: cerca de 5 minutos (aprox. 700 a 800 palavras de narração em 9 a 11 cenas).' },
      { value: '8-10m', label: '8 a 10 minutos (aula)', promptHint: 'Duração alvo do vídeo: 8 a 10 minutos (aprox. 1.100 a 1.400 palavras de narração em 12 cenas detalhadas).' }
    ]
  },
  podcast: {
    label: 'Duração (minutos)',
    options: [
      AUTO_OPTION,
      { value: '2-3m', label: '2 a 3 minutos (briefing)', promptHint: 'Duração alvo do podcast: 2 a 3 minutos (cerca de 12 a 16 falas objetivas).' },
      { value: '5m', label: '5 minutos', promptHint: 'Duração alvo do podcast: cerca de 5 minutos (cerca de 20 a 26 falas).' },
      { value: '10m', label: '10 minutos', promptHint: 'Duração alvo do podcast: cerca de 10 minutos (cerca de 30 a 36 falas aprofundadas).' },
      { value: '15+m', label: '15+ minutos (deep-dive)', promptHint: 'Duração alvo do podcast: 15 minutos ou mais (até 40 falas completas e detalhadas).' }
    ]
  },
  pptx: {
    label: 'Quantidade de slides',
    options: [
      AUTO_OPTION,
      { value: '5s', label: '5 slides (enxuto)', promptHint: 'Quantidade alvo: 5 slides de conteúdo (além da capa).' },
      { value: '8s', label: '8 slides', promptHint: 'Quantidade alvo: 8 slides de conteúdo (além da capa).' },
      { value: '12s', label: '12 slides', promptHint: 'Quantidade alvo: 12 slides de conteúdo (além da capa).' },
      { value: '15+s', label: '15+ slides (completo)', promptHint: 'Quantidade alvo: 15 a 18 slides de conteúdo (além da capa).' }
    ]
  },
  xlsx: {
    label: 'Quantidade de abas',
    options: [
      AUTO_OPTION,
      { value: '1a', label: '1 aba (tabela única)', promptHint: 'Estrutura alvo: 1 aba principal consolidada.' },
      { value: '2-3a', label: '2 a 3 abas', promptHint: 'Estrutura alvo: 2 a 3 abas organizadas por tema.' },
      { value: '4-6a', label: '4 a 6 abas (completa)', promptHint: 'Estrutura alvo: 4 a 6 abas detalhadas com resumos.' }
    ]
  },
  flashcards: {
    label: 'Quantidade de cartões',
    options: [
      AUTO_OPTION,
      { value: '10c', label: '10 cartões', promptHint: 'Quantidade alvo: exatamente 10 cartões/questões.' },
      { value: '15c', label: '15 cartões', promptHint: 'Quantidade alvo: exatamente 15 cartões/questões.' },
      { value: '20c', label: '20 cartões', promptHint: 'Quantidade alvo: exatamente 20 cartões/questões.' },
      { value: '30c', label: '30 cartões', promptHint: 'Quantidade alvo: exatamente 30 cartões/questões.' }
    ]
  },
  mindmap: {
    label: 'Quantidade de nós',
    options: [
      AUTO_OPTION,
      { value: '8-10n', label: '8 a 10 nós (resumido)', promptHint: 'Quantidade alvo: entre 8 e 10 nós principais.' },
      { value: '12-16n', label: '12 a 16 nós', promptHint: 'Quantidade alvo: entre 12 e 16 nós com sub-tópicos.' },
      { value: '20+n', label: '20+ nós (detalhado)', promptHint: 'Quantidade alvo: entre 20 e 24 nós bem ramificados.' }
    ]
  }
}

export function getToolSizeConfig(toolId: string): ToolSizeConfig {
  return TOOL_SIZE_CONFIGS[toolId] || PAGE_SIZE_SHORT
}

export function resolveTargetSizeHint(toolId: string, sizeValue?: string): string | undefined {
  if (!sizeValue || sizeValue === 'auto') return undefined
  const cfg = getToolSizeConfig(toolId)
  const found = cfg.options.find((o) => o.value === sizeValue)
  return found?.promptHint || undefined
}
