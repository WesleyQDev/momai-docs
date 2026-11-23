import { describe, it, expect } from 'vitest'
import { BUILTIN_TEMPLATES, templateRegistry } from '../src/core/templates/template-registry.ts'
import { renderDocxAndPdf } from '../src/core/engines/docx-pdf-engine.ts'
import { renderPptxAndPdf } from '../src/core/engines/pptx-engine.ts'

const PRIMARY_TOOLS = ['oficio', 'apostila', 'abnt', 'letterhead', 'pptx', 'podcast', 'video', 'report']

describe('Templates & Golden Renderers', () => {
  it('provides at least 5 commercially licensed templates per primary tool', () => {
    for (const toolId of PRIMARY_TOOLS) {
      const list = templateRegistry.search({ toolId })
      expect(list.length, `Tool ${toolId} should have >= 5 templates`).toBeGreaterThanOrEqual(5)
      for (const tpl of list) {
        expect(tpl.license.commercialUseAllowed).toBe(true)
        expect(tpl.license.spdx.length).toBeGreaterThan(0)
      }
    }
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(45)
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
})
