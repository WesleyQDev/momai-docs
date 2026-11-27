import { normalizeLocale, type DocsLocale } from '../../core/i18n.ts'
import { translateCore } from '../../core/translate.ts'

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
    label: 'Podcast',
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
    label: 'Planilha',
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
    id: 'mindmap',
    emoji: '🧠',
    label: 'Mapa Mental',
    category: 'Acadêmico',
    description: 'Diagrama orgânico para estudo, síntese e conexões entre conceitos.',
    specLine: 'PNG, JPG e SVG vetorial',
    formats: ['png', 'jpg', 'svg'],
    thumbVariant: 'slide',
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
    emoji: '🎯',
    label: 'Quiz',
    category: 'Acadêmico',
    description: 'Quiz interativo com gabarito comentado, nota final e exportação CSV/Anki.',
    specLine: 'Quiz x/x interativo · exporta CSV e Anki',
    formats: ['csv', 'anki'],
    thumbVariant: 'a4',
    featured: true
  },
  {
    id: 'contract',
    emoji: '⚖️',
    label: 'Contrato',
    category: 'Oficial',
    description: 'Cláusulas numeradas organizadas por objeto, obrigações, prazo e foro.',
    specLine: 'Estrutura jurídica pronta para revisão',
    formats: ['docx', 'pdf'],
    thumbVariant: 'letterhead'
  },
  {
    id: 'resume',
    emoji: '📄',
    label: 'Currículo',
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
  unit: string
  options: ToolSizeOption[]
}

const AUTO_OPTION: ToolSizeOption = {
  value: 'auto',
  label: 'Automático',
  promptHint: ''
}

const CUSTOM_OPTION: ToolSizeOption = {
  value: 'custom',
  label: 'Personalizado',
  promptHint: ''
}

const PAGE_SIZE_CONFIG: ToolSizeConfig = {
  label: 'Tamanho (páginas)',
  unit: 'páginas',
  options: [AUTO_OPTION, CUSTOM_OPTION]
}

export const TOOL_SIZE_CONFIGS: Record<string, ToolSizeConfig> = {
  oficio: PAGE_SIZE_CONFIG,
  letterhead: PAGE_SIZE_CONFIG,
  abnt: PAGE_SIZE_CONFIG,
  apostila: PAGE_SIZE_CONFIG,
  report: PAGE_SIZE_CONFIG,
  resume: PAGE_SIZE_CONFIG,
  lesson_plan: PAGE_SIZE_CONFIG,
  meeting_minutes: PAGE_SIZE_CONFIG,
  contract: PAGE_SIZE_CONFIG,
  faq: PAGE_SIZE_CONFIG,
  newsletter: PAGE_SIZE_CONFIG,
  video: {
    label: 'Duração (minutos)',
    unit: 'minutos',
    options: [AUTO_OPTION, CUSTOM_OPTION]
  },
  podcast: {
    label: 'Duração (minutos)',
    unit: 'minutos',
    options: [AUTO_OPTION, CUSTOM_OPTION]
  },
  pptx: {
    label: 'Quantidade de slides',
    unit: 'slides',
    options: [AUTO_OPTION, CUSTOM_OPTION]
  },
  xlsx: {
    label: 'Quantidade de abas',
    unit: 'abas',
    options: [AUTO_OPTION, CUSTOM_OPTION]
  },
  flashcards: {
    label: 'Quantidade de questões',
    unit: 'questões',
    options: [AUTO_OPTION, CUSTOM_OPTION]
  },
  mindmap: {
    label: 'Quantidade de nós',
    unit: 'nós',
    options: [AUTO_OPTION, CUSTOM_OPTION]
  }
}

export function getToolSizeConfig(toolId: string): ToolSizeConfig {
  return TOOL_SIZE_CONFIGS[toolId] || PAGE_SIZE_CONFIG
}

export function resolveTargetSizeHint(
  toolId: string,
  sizeValue?: string,
  customAmount?: string,
  locale?: DocsLocale
): string | undefined {
  if (!sizeValue || sizeValue === 'auto') return undefined
  const resolvedLocale = normalizeLocale(locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(resolvedLocale, text, vars)
  const cfg = getToolSizeConfig(toolId)
  if (sizeValue === 'custom') {
    const raw = String(customAmount || '').trim()
    if (!raw) return undefined
    if (toolId === 'video' || toolId === 'podcast') {
      return tr('Duração alvo: cerca de {amount} minuto(s).', { amount: raw })
    }
    if (toolId === 'pptx') {
      return tr('Quantidade alvo: {amount} slide(s) de conteúdo (além da capa).', { amount: raw })
    }
    if (toolId === 'xlsx') {
      return tr('Estrutura alvo: {amount} aba(s) organizada(s) por tema.', { amount: raw })
    }
    if (toolId === 'flashcards') {
      return tr('Quantidade alvo: exatamente {amount} questão(ões) de múltipla escolha.', { amount: raw })
    }
    if (toolId === 'mindmap') {
      return tr('Quantidade alvo: cerca de {amount} nós principais e sub-tópicos.', { amount: raw })
    }
    return tr('Extensão alvo: cerca de {amount} página(s).', { amount: raw })
  }
  const found = cfg.options.find((o) => o.value === sizeValue)
  return found?.promptHint || undefined
}
