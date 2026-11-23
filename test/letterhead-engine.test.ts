import { describe, it, expect } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  analyzeLetterheadFile,
  fillDocxLetterhead,
  fillPdfLetterhead
} from '../src/core/engines/letterhead-engine.ts'

describe('Letterhead Engine (Preservation without recreation)', () => {
  it('fills DOCX letterhead preserving original header, footer and styles', async () => {
    const originalHeader = '<w:hdr><w:p><w:r><w:t>PREFEITURA MUNICIPAL MODELO - TIMBRADO</w:t></w:r></w:p></w:hdr>'
    const originalFooter = '<w:ftr><w:p><w:r><w:t>Rua Central, 100 - CEP 01000-000</w:t></w:r></w:p></w:ftr>'
    const originalDoc =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:t>Destinatário: {{destinatario}} | Protocolo: ____</w:t></w:r></w:p>' +
      '<w:sectPr><w:pgMar w:top="1800" w:bottom="1440" w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>'

    const templateZip = Buffer.from(
      zipSync({
        'word/header1.xml': strToU8(originalHeader),
        'word/footer1.xml': strToU8(originalFooter),
        'word/document.xml': strToU8(originalDoc)
      })
    )

    const analysis = await analyzeLetterheadFile('timbrado.docx', templateZip)
    expect(analysis.detectedPlaceholders).toContain('destinatario')

    const filled = fillDocxLetterhead({
      templateBuffer: templateZip,
      documentTitle: 'Ofício nº 12/2026',
      fields: [
        { key: 'destinatario', value: 'Secretaria de Educação' },
        { key: 'protocolo', value: '2026-9981' }
      ],
      paragraphs: ['Solicitamos providências conforme documento anexo.']
    })

    const outFiles = unzipSync(new Uint8Array(filled.buffer))
    expect(strFromU8(outFiles['word/header1.xml'])).toBe(originalHeader)
    expect(strFromU8(outFiles['word/footer1.xml'])).toBe(originalFooter)
    const outDocXml = strFromU8(outFiles['word/document.xml'])
    expect(outDocXml).toContain('Secretaria de Educação')
    expect(outDocXml).toContain('2026-9981')
    expect(outDocXml).toContain('Solicitamos providências conforme documento anexo.')
  })

  it('fills PDF letterhead embedding original page as background across multiple pages', async () => {
    const srcPdf = await PDFDocument.create()
    const page = srcPdf.addPage([595.28, 841.89])
    const font = await srcPdf.embedFont(StandardFonts.HelveticaBold)
    page.drawText('INSTITUICAO EXEMPLO - TIMBRADO OFICIAL', { x: 60, y: 790, size: 12, font })
    const templateBytes = Buffer.from(await srcPdf.save())

    const longParagraph = 'Conteúdo institucional fundamentado nas fontes do projeto para testar quebra de página preservando o timbrado em todas as folhas. '.repeat(25)
    const filled = await fillPdfLetterhead({
      templateBuffer: templateBytes,
      documentTitle: 'Parecer Técnico nº 05/2026',
      paragraphs: [longParagraph, longParagraph]
    })

    const outPdf = await PDFDocument.load(filled.buffer)
    expect(outPdf.getPageCount()).toBeGreaterThanOrEqual(2)
    expect(filled.qaReport.passed).toBe(true)
  })
})
