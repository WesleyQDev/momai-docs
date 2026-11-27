import { describe, it, expect } from 'vitest'
import { BUILTIN_TEMPLATES, templateRegistry } from '../src/core/templates/template-registry.ts'
import { renderRealTemplatePreviewPages } from '../src/core/templates/template-preview-fixture.ts'
import { extractRequestedLogoQuery } from '../src/core/media/wikimedia-image.ts'
import { renderDocxAndPdf } from '../src/core/engines/docx-pdf-engine.ts'
import { renderPptxAndPdf } from '../src/core/engines/pptx-engine.ts'
import { buildTemplatePreviewPages } from '../src/ui/shared/template-preview-svg.ts'

const PRIMARY_TOOLS = ['oficio', 'apostila', 'abnt', 'letterhead', 'pptx', 'podcast', 'video', 'report']

describe('Templates & Golden Renderers', () => {
  it('provides at least 15 commercially licensed templates per primary tool', () => {
    for (const toolId of PRIMARY_TOOLS) {
      const list = templateRegistry.search({ toolId })
      expect(list.length, `Tool ${toolId} should have >= 15 templates`).toBeGreaterThanOrEqual(15)
      for (const tpl of list) {
        expect(tpl.license.commercialUseAllowed).toBe(true)
        expect(tpl.license.spdx.length).toBeGreaterThan(0)
      }
    }
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(210)
  })

  it('renders PT-BR accented DOCX & PDF across short, medium and long content with VisualQA passing', async () => {
    const abntTpl = templateRegistry.getById('abnt-tcc')!
    const longParagraph = 'A implementação de políticas públicas educacionais exige avaliação contínua, transparência orçamentária e participação social (SILVA, 2026, p. 14). '.repeat(12)

    const res = await renderDocxAndPdf({
      toolId: 'abnt',
      template: abntTpl,
      tokens: abntTpl.designTokens,
      data: {
        institution: 'Universidade Federal de Tecnologia',
        author: 'João da Conceição Araújo',
        title: 'Avaliação de Eficiência Energética e Gestão Sustentável',
        subtitle: 'Estudo de caso com acentuação: áéíóú âêô ãõ ç § º ª',
        cityAndYear: 'São Paulo, 2026',
        workNature: 'Trabalho de Conclusão de Curso apresentado à coordenação.',
        abstractPt: 'Resumo em português com acentuação completa.',
        keywordsPt: ['Eficiência', 'Sustentabilidade', 'Gestão'],
        sections: [
          { number: '1', heading: 'INTRODUÇÃO', paragraphs: [longParagraph] },
          { number: '2', heading: 'DESENVOLVIMENTO', paragraphs: [longParagraph, longParagraph] }
        ],
        references: ['SILVA, M. Gestão Sustentável. São Paulo: Editora Exemplo, 2026.']
      }
    })

    expect(res.docxBuffer.subarray(0, 2).toString()).toBe('PK') // valid ZIP/DOCX
    expect(res.pdfBuffer.subarray(0, 4).toString()).toBe('%PDF')
    expect(res.previewSvgs.length).toBeGreaterThanOrEqual(3)
    expect(res.qaReport.passed).toBe(true)
  })

  it('renders PPTX presentation with native chart and VisualQA passing', async () => {
    const pptTpl = templateRegistry.getById('pptx-executivo')!
    const res = await renderPptxAndPdf({
      tokens: pptTpl.designTokens,
      data: {
        title: 'Resultados Operacionais 2026',
        subtitle: 'Análise consolidada das fontes',
        slides: [
          {
            layout: 'metrics',
            title: 'Indicadores Principais',
            metrics: [
              { label: 'Economia Anual', value: 'R$ 420 mil' },
              { label: 'Redução kWh', value: '28%' }
            ],
            notes: 'Fonte: Relatório Piloto 2026, p. 1'
          },
          {
            layout: 'chart',
            title: 'Evolução Trimestral',
            chart: { type: 'bar', labels: ['T1', 'T2', 'T3', 'T4'], values: [12, 18, 24, 28] },
            notes: 'Dados extraídos da planilha trimestral.'
          }
        ]
      }
    })

    expect(res.pptxBuffer.subarray(0, 2).toString()).toBe('PK')
    expect(res.pdfBuffer.subarray(0, 4).toString()).toBe('%PDF')
    expect(res.previewSvgs.length).toBe(3)
    expect(res.qaReport.passed).toBe(true)
  })

  it('generates distinct layoutPreset previews and PPTX cover layouts', async () => {
    const pitchTpl = templateRegistry.getById('pptx-pitch')!
    const techTpl = templateRegistry.getById('pptx-dark-tech')!
    expect(pitchTpl.layoutPreset).toBe('modern')
    expect(techTpl.layoutPreset).toBe('tech_dark')

    const pitchPreview = buildTemplatePreviewPages(pitchTpl, 'pptx')
    const techPreview = buildTemplatePreviewPages(techTpl, 'pptx')
    expect(pitchPreview.orientation).toBe('landscape')
    expect(pitchPreview.pages.length).toBe(5)
    expect(pitchPreview.pages[0].svg).not.toBe(techPreview.pages[0].svg)

    const pitchRender = await renderPptxAndPdf({
      tokens: pitchTpl.designTokens,
      layoutPreset: pitchTpl.layoutPreset,
      data: { title: 'Pitch', slides: [] }
    })
    const techRender = await renderPptxAndPdf({
      tokens: techTpl.designTokens,
      layoutPreset: techTpl.layoutPreset,
      data: { title: 'Tech', slides: [] }
    })
    expect(pitchRender.previewSvgs[0]).not.toBe(techRender.previewSvgs[0])
  })

  it('renders editorial apostila PDF with cover fields, paginated TOC, wrapped tables, checklists and exercises', async () => {
    const apostilaTpl = templateRegistry.getById('apostila-modular')!
    const res = await renderDocxAndPdf({
      toolId: 'apostila',
      template: apostilaTpl,
      tokens: apostilaTpl.designTokens,
      data: {
        institution: 'Prefeitura Municipal de Curitiba',
        badgeLabel: 'CONCURSO PÚBLICO • PROFESSOR',
        title: 'Apostila de Estudos para o Concurso de Professor de Curitiba',
        subtitle: 'Conhecimentos pedagógicos, legislação educacional e prática docente',
        studentFields: ['Nome do Estudante', 'Data de Início', 'Meta de Conclusão'],
        presentation:
          'Este material foi estruturado para guiar sua preparação até a prova, reunindo teoria objetiva, quadros comparativos, exemplos de sala de aula e exercícios comentados.',
        chapters: [
          {
            title: 'Fundamentos da Educação e LDB (Lei 9.394/1996)',
            objectives: [
              'Compreender os princípios e fins da educação nacional na LDB',
              'Distinguir competências da União, Estados e Municípios na educação básica'
            ],
            sections: [
              {
                heading: 'Princípios constitucionais e dever do Estado',
                body: 'A educação escolar brasileira é regida pelos princípios da igualdade de condições para o acesso e permanência, liberdade de aprender e ensinar, pluralismo de ideias e gestão democrática do ensino público.\n\nNo âmbito municipal, o foco prioritário recai sobre a Educação Infantil e o Ensino Fundamental, assegurando padrão de qualidade e valorização dos profissionais da educação.',
                example: 'Em uma escola municipal, o Conselho Escolar participa da definição do Projeto Político-Pedagógico (PPP), concretizando a gestão democrática prevista no art. 14 da LDB.',
                table: {
                  headers: ['Esfera Administrativa', 'Atuação Prioritária (LDB)', 'Observação de Prova'],
                  rows: [
                    ['Municípios', 'Educação Infantil e Ensino Fundamental', 'Podem atuar no Ensino Médio apenas após atender plenamente sua área'],
                    ['Estados e DF', 'Ensino Fundamental e Ensino Médio', 'Asseguram o Ensino Fundamental em regime de colaboração'],
                    ['União', 'Coordenação da política nacional e Ensino Superior', 'Exerce função redistributiva e supletiva junto aos entes']
                  ]
                }
              },
              {
                heading: 'Planejamento semanal de revisão',
                body: 'Organize o estudo intercalando leitura legal, resolução de questões anteriores da banca e revisão ativa.',
                timeline: [
                  { step: 'Leitura dirigida da lei seca', detail: 'Destaque prazos, exceções e competências de cada ente federativo.' },
                  { step: 'Bateria de questões comentadas', detail: 'Resolva de 15 a 20 questões sobre o tópico e registre os erros.' },
                  { step: 'Revisão espaçada', detail: 'Retome os quadros-resumo após 48 horas e 7 dias.' }
                ],
                checklistTitle: 'Checklist do Capítulo',
                checklist: [
                  'Artigos 1º a 14 da LDB revisados com marcações',
                  'Diferença entre incumbências do município e do estado dominada',
                  'Exercícios de fixação resolvidos sem consulta'
                ]
              }
            ],
            exercises: [
              {
                question: 'Qual é a atuação prioritária dos Municípios segundo a LDB?',
                answer: 'Educação Infantil e Ensino Fundamental, em regime de colaboração com o Estado.'
              },
              {
                question: 'O que caracteriza a gestão democrática do ensino público?',
                answer: 'Participação dos profissionais da educação no projeto pedagógico e da comunidade escolar em conselhos.'
              }
            ]
          },
          {
            title: 'Língua Portuguesa: Compreensão e Coesão Textual',
            objectives: [
              'Diferenciar tese, argumento e ideia central em textos dissertativos',
              'Identificar mecanismos de coesão referencial e sequencial'
            ],
            sections: [
              {
                heading: 'Tese versus argumento na leitura de prova',
                body: 'Na interpretação de textos, localizar o ponto de vista defendido pelo autor evita cair em distratores que confundem exemplos particulares com a tese principal.',
                comparison: {
                  leftTitle: 'Tese (Ponto de vista)',
                  leftItems: ['Afirmação central defendida no texto', 'Responde ao posicionamento do autor'],
                  rightTitle: 'Argumento (Sustentação)',
                  rightItems: ['Dados, exemplos ou comparações', 'Justifica e comprova a tese apresentada']
                }
              }
            ],
            exercises: [
              {
                question: 'Qual a função dos conectivos na progressão textual?',
                answer: 'Estabelecer relações lógicas (causa, oposição, conclusão) entre orações e parágrafos.'
              }
            ]
          }
        ],
        conclusion: 'Mantenha constância diária, revise seus registros de erro e avance para os simulados completos.',
        glossary: [
          { term: 'Gestão Democrática', definition: 'Princípio que assegura participação da comunidade escolar nas decisões pedagógicas e administrativas.' },
          { term: 'Coesão Referencial', definition: 'Uso de pronomes e sinônimos para retomar elementos já mencionados no texto.' }
        ],
        references: ['BRASIL. Lei nº 9.394, de 20 de dezembro de 1996 (LDB).']
      }
    })

    expect(res.docxBuffer.subarray(0, 2).toString()).toBe('PK')
    expect(res.pdfBuffer.subarray(0, 4).toString()).toBe('%PDF')
    expect(res.previewSvgs.length).toBeGreaterThanOrEqual(4)
    expect(res.qaReport.passed).toBe(true)
    const { PDFDocument } = await import('pdf-lib')
    const parsedPdf = await PDFDocument.load(res.pdfBuffer)
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(4)
  })

  it('selects context-appropriate template automatically and cleans coat-of-arms queries', () => {
    const concursoTpl = templateRegistry.selectBestForContext(
      'apostila',
      'Apostila de Estudos para o Concurso de Professor de Curitiba',
      'student'
    )
    expect(concursoTpl.id).toBe('apostila-concurso')

    const corpTpl = templateRegistry.selectBestForContext(
      'apostila',
      'Manual de Treinamento e Onboarding Corporativo para Novos Colaboradores',
      'executive'
    )
    expect(corpTpl.id).toBe('apostila-onboarding')

    expect(extractRequestedLogoQuery('use o brasão da Prefeitura de Curitiba centralizado na capa')).toBe('Coat of arms Curitiba')
  })

  it('renders 5+ real engine preview pages with Lorem Ipsum across all tools', async () => {
    const allTools = [
      'oficio', 'apostila', 'abnt', 'letterhead', 'pptx', 'podcast',
      'video', 'report', 'flashcards', 'mindmap', 'xlsx', 'resume',
      'lesson_plan', 'meeting_minutes', 'contract', 'faq', 'newsletter'
    ] as const
    for (const toolId of allTools) {
      const tpl = templateRegistry.getDefaultForTool(toolId)
      const instant = buildTemplatePreviewPages(tpl, toolId)
      expect(instant.pages.length, `Instant preview for ${toolId} should have >= 5 pages`).toBeGreaterThanOrEqual(5)
      const preview = await renderRealTemplatePreviewPages({ templateId: tpl.id, toolId })
      expect(preview.pages.length, `Tool ${toolId} should have >= 5 preview pages`).toBeGreaterThanOrEqual(5)
      expect(preview.pages[0].svg).toContain('<svg')
    }
  }, 30000)

  it('renders resume ATS with experiences and skills into DOCX & PDF', async () => {
    const resumeTpl = templateRegistry.getDefaultForTool('resume')
    const res = await renderDocxAndPdf({
      toolId: 'resume',
      template: resumeTpl,
      tokens: resumeTpl.designTokens,
      data: {
        fullName: 'Leonardo Gomes',
        headline: 'Professor de Programação Orientada a Objetos',
        summary: 'Docente e pesquisador com experiência em engenharia de software.',
        experiences: [
          {
            role: 'Professor Titular',
            company: 'Instituto de Tecnologia',
            period: '2021 - Atual',
            achievements: ['Ministrou disciplinas de POO e arquitetura de sistemas.']
          }
        ],
        skills: ['Java', 'TypeScript', 'Arquitetura Limpa']
      }
    })
    expect(res.previewSvgs[0]).toContain('Experi')
    expect(res.previewSvgs[0]).toContain('Professor Titular')
    expect(res.previewSvgs[0]).toContain('Java')
  })
})
