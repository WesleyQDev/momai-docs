export type DocsLocale = 'pt-BR' | 'en-US' | 'es'

const DICT: Record<DocsLocale, Record<string, string>> = {
  'pt-BR': {
    appTitle: 'MomAI Docs',
    appSubtitle: 'Estúdio editorial fundamentado nas suas fontes',
    newProject: 'Novo projeto',
    projectsTitle: 'Seus projetos',
    sourcesTitle: 'Fontes da verdade',
    addFile: 'Arquivo',
    addLink: 'Link / YouTube',
    addText: 'Colar texto',
    discoverSources: 'Buscar fontes na web',
    studioTab: 'Ferramentas & Templates',
    chatTab: 'Chat do Projeto',
    artifactsTitle: 'Artefatos & Refino',
    generateBtn: 'Gerar material',
    generating: 'Gerando...',
    exportBtn: 'Exportar',
    refinePlaceholder: 'Ex: Deixe mais formal, troque o slide 3, resuma a conclusão...',
    refineBtn: 'Refinar',
    sourcesOnly: 'Somente fontes',
    sourcesPlusGeneral: 'Fontes + conhecimento complementar',
    localProviderBadge: 'Local (Privado)',
    cloudProviderBadge: 'Nuvem (envia trechos ao provedor)',
    queueBtn: 'Fila',
    brandKitBtn: 'Kit de marca',
    creditsBtn: 'Créditos & Licenças',
    diagnosticsBtn: 'Diagnóstico',
    backHome: 'Projetos',
    emptySources: 'Arraste PDFs, DOCX, PPTX, XLSX, imagens ou adicione um link para começar.',
    emptyArtifacts: 'Escolha uma ferramenta e um template ao centro para gerar seu primeiro material.',
    qaPassed: 'QA Visual aprovado',
    qaRepaired: 'QA Visual auto-reparado'
  },
  'en-US': {
    appTitle: 'MomAI Docs',
    appSubtitle: 'Source-grounded creation studio',
    newProject: 'New project',
    projectsTitle: 'Your projects',
    sourcesTitle: 'Sources of truth',
    addFile: 'File',
    addLink: 'Link / YouTube',
    addText: 'Paste text',
    discoverSources: 'Discover web sources',
    studioTab: 'Tools & Templates',
    chatTab: 'Project Chat',
    artifactsTitle: 'Artifacts & Refine',
    generateBtn: 'Generate',
    generating: 'Generating...',
    exportBtn: 'Export',
    refinePlaceholder: 'e.g. Make it more formal, replace slide 3, shorten summary...',
    refineBtn: 'Refine',
    sourcesOnly: 'Sources only',
    sourcesPlusGeneral: 'Sources + general knowledge',
    localProviderBadge: 'Local (Private)',
    cloudProviderBadge: 'Cloud (sends snippets to provider)',
    queueBtn: 'Queue',
    brandKitBtn: 'Brand kit',
    creditsBtn: 'Credits & Licenses',
    diagnosticsBtn: 'Diagnostics',
    backHome: 'Projects',
    emptySources: 'Drag & drop PDF, DOCX, PPTX, XLSX, images or add a link to begin.',
    emptyArtifacts: 'Pick a tool and template in the center to generate your first artifact.',
    qaPassed: 'Visual QA passed',
    qaRepaired: 'Visual QA auto-repaired'
  },
  es: {
    appTitle: 'MomAI Docs',
    appSubtitle: 'Estudio editorial basado en tus fuentes',
    newProject: 'Nuevo proyecto',
    projectsTitle: 'Tus proyectos',
    sourcesTitle: 'Fuentes de verdad',
    addFile: 'Archivo',
    addLink: 'Enlace / YouTube',
    addText: 'Pegar texto',
    discoverSources: 'Buscar fuentes web',
    studioTab: 'Herramientas y Plantillas',
    chatTab: 'Chat del Proyecto',
    artifactsTitle: 'Artefactos y Refinamiento',
    generateBtn: 'Generar',
    generating: 'Generando...',
    exportBtn: 'Exportar',
    refinePlaceholder: 'Ej: Hazlo más formal, cambia la diapositiva 3...',
    refineBtn: 'Refinar',
    sourcesOnly: 'Solo fuentes',
    sourcesPlusGeneral: 'Fuentes + conocimiento general',
    localProviderBadge: 'Local (Privado)',
    cloudProviderBadge: 'Nube (envía fragmentos al proveedor)',
    queueBtn: 'Cola',
    brandKitBtn: 'Kit de marca',
    creditsBtn: 'Créditos y Licencias',
    diagnosticsBtn: 'Diagnóstico',
    backHome: 'Proyectos',
    emptySources: 'Arrastra PDF, DOCX, PPTX, XLSX o agrega un enlace para empezar.',
    emptyArtifacts: 'Elige una herramienta y plantilla para generar tu primer artefacto.',
    qaPassed: 'QA Visual aprobado',
    qaRepaired: 'QA Visual auto-reparado'
  }
}

export function resolveLocale(raw?: string): DocsLocale {
  const val = String(raw || 'pt-BR')
  if (val.startsWith('en')) return 'en-US'
  if (val.startsWith('es')) return 'es'
  return 'pt-BR'
}

export function tDocs(locale: DocsLocale, key: string): string {
  return DICT[locale]?.[key] || DICT['pt-BR'][key] || key
}
