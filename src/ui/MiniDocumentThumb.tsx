import React from 'react'

export function MiniDocumentThumb({
  variant = 'a4',
  toolId,
  templateName,
  compact = false,
  highlight = false
}: {
  variant?: 'a4' | 'slide' | 'sheet' | 'audio' | 'abnt' | 'letterhead'
  toolId?: string
  templateName?: string
  compact?: boolean
  highlight?: boolean
}) {
  if (compact) {
    return (
      <div
        className={`w-7 h-9 rounded border overflow-hidden ${
          highlight ? 'border-accent/50 bg-accent/5' : 'border-border bg-bg'
        } p-1 flex flex-col justify-between shrink-0`}
      >
        <div className="space-y-0.5">
          <div className={`h-1 rounded-full ${variant === 'letterhead' ? 'bg-accent/60 w-4' : 'bg-text/30 w-3'}`} />
          <div className="h-0.5 w-full rounded-full bg-text-muted/30" />
          <div className="h-0.5 w-4/5 rounded-full bg-text-muted/25" />
          <div className="h-0.5 w-full rounded-full bg-text-muted/20" />
        </div>
        <div className="h-0.5 w-2 rounded-full bg-text-muted/25 self-end" />
      </div>
    )
  }

  const nameLower = String(templateName || '').toLowerCase()
  const resolvedTool = toolId || variant

  // 16:9 Slide / Video Preview
  if (resolvedTool === 'pptx' || resolvedTool === 'video' || variant === 'slide') {
    const isVideo = resolvedTool === 'video'
    const isDark = nameLower.includes('dark') || nameLower.includes('vertical') || nameLower.includes('dados')
    return (
      <div
        className={`w-full max-w-[210px] h-32 rounded-xl border overflow-hidden ${
          highlight ? 'border-accent shadow-glass-sm' : 'border-border'
        } ${isDark ? 'bg-card' : 'bg-bg'} p-3 flex flex-col justify-between select-none`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold uppercase tracking-wider text-accent truncate" style={{ fontSize: '8px', lineHeight: 1.2 }}>
            {isVideo ? 'Cena 01 · 1080p' : templateName || 'Apresentação 16:9'}
          </span>
          <span className="text-text-muted shrink-0" style={{ fontSize: '8px', lineHeight: 1.2 }}>
            {isVideo ? '▶ MP4' : '01 / 10'}
          </span>
        </div>
        <div className="grid grid-cols-12 gap-2 items-center my-auto">
          <div className="col-span-7 space-y-1 min-w-0">
            <div className="font-bold text-text truncate" style={{ fontSize: '10px', lineHeight: 1.2 }}>
              {isVideo ? 'Resumo Visual' : 'Visão Geral'}
            </div>
            <div className="text-text-muted" style={{ fontSize: '7px', lineHeight: 1.3 }}>
              • Contexto e objetivos<br />• Principais indicadores<br />• Plano de ação
            </div>
          </div>
          <div className="col-span-5 rounded-lg bg-card border border-border p-1.5 flex items-end gap-1 h-14 justify-center">
            <div className="w-2 h-5 rounded-sm bg-accent/40" />
            <div className="w-2 h-8 rounded-sm bg-accent/70" />
            <div className="w-2 h-10 rounded-sm bg-accent" />
          </div>
        </div>
        {isVideo && (
          <div
            className="text-center py-0.5 rounded bg-card text-text-muted border border-border/60 truncate"
            style={{ fontSize: '7px', lineHeight: 1.2 }}
          >
            Legenda sincronizada (SRT)
          </div>
        )}
      </div>
    )
  }

  // Spreadsheet Preview (XLSX)
  if (resolvedTool === 'xlsx' || variant === 'sheet') {
    return (
      <div
        className={`w-full max-w-[210px] h-36 rounded-xl border overflow-hidden ${
          highlight ? 'border-accent shadow-glass-sm' : 'border-border'
        } bg-bg flex flex-col select-none`}
      >
        <div
          className="px-2.5 py-1.5 bg-card border-b border-border flex items-center justify-between gap-2"
          style={{ fontSize: '8px', lineHeight: 1.2 }}
        >
          <span className="font-semibold text-text truncate">{templateName || 'Planilha.xlsx'}</span>
          <span className="text-accent font-mono shrink-0">=SUM()</span>
        </div>
        <div className="flex-1 p-2 overflow-hidden">
          <table className="w-full border-collapse text-text" style={{ fontSize: '7px', lineHeight: 1.25 }}>
            <thead>
              <tr className="bg-accent/15 font-semibold">
                <td className="border border-border px-1 py-0.5">Item</td>
                <td className="border border-border px-1 py-0.5 text-right">Qtd</td>
                <td className="border border-border px-1 py-0.5 text-right">Valor</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border px-1 py-0.5">Item Exemplo A</td>
                <td className="border border-border px-1 py-0.5 text-right">12</td>
                <td className="border border-border px-1 py-0.5 text-right">1.450</td>
              </tr>
              <tr>
                <td className="border border-border px-1 py-0.5">Item Exemplo B</td>
                <td className="border border-border px-1 py-0.5 text-right">8</td>
                <td className="border border-border px-1 py-0.5 text-right">980</td>
              </tr>
              <tr className="bg-input/60 font-semibold">
                <td className="border border-border px-1 py-0.5">Total</td>
                <td className="border border-border px-1 py-0.5 text-right">20</td>
                <td className="border border-border px-1 py-0.5 text-right text-accent">2.430</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Podcast Preview
  if (resolvedTool === 'podcast' || variant === 'audio') {
    return (
      <div
        className={`w-full max-w-[210px] h-36 rounded-xl border overflow-hidden ${
          highlight ? 'border-accent shadow-glass-sm' : 'border-border'
        } bg-bg p-3 flex flex-col justify-between select-none`}
      >
        <div className="flex items-center justify-between text-text-muted" style={{ fontSize: '8px', lineHeight: 1.2 }}>
          <span className="font-semibold text-accent">🎙️ Phonon TTS</span>
          <span>MP3 · SRT</span>
        </div>
        <div className="space-y-1.5" style={{ fontSize: '7.5px', lineHeight: 1.3 }}>
          <div className="truncate">
            <span className="font-bold text-text">Host A:</span>{' '}
            <span className="text-text-muted">Resumo dos pontos centrais...</span>
          </div>
          <div className="truncate">
            <span className="font-bold text-accent">Host B:</span>{' '}
            <span className="text-text-muted">Dados citados nas fontes!</span>
          </div>
        </div>
        <div className="flex items-center gap-1 h-4 pt-1">
          {[35, 70, 50, 90, 60, 80, 45, 75, 55, 85, 40, 65].map((h, i) => (
            <div key={i} className="flex-1 rounded-full bg-accent/60" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    )
  }

  // ABNT Preview
  if (resolvedTool === 'abnt' || variant === 'abnt') {
    const isArticle = nameLower.includes('artigo')
    const isResenha = nameLower.includes('resenha')
    return (
      <div
        className={`w-28 h-40 rounded-lg border overflow-hidden ${
          highlight ? 'border-accent shadow-glass-sm' : 'border-border'
        } bg-bg p-2.5 flex flex-col justify-between select-none text-text`}
      >
        {isArticle ? (
          <div className="space-y-1.5 overflow-hidden">
            <div className="font-bold text-center" style={{ fontSize: '7px', lineHeight: 1.2 }}>
              ARTIGO CIENTÍFICO
            </div>
            <div className="text-center text-text-muted" style={{ fontSize: '5.5px', lineHeight: 1.2 }}>
              Autor · Instituição
            </div>
            <div className="p-1 rounded bg-card border border-border/60 text-text-muted" style={{ fontSize: '5.5px', lineHeight: 1.25 }}>
              <strong className="text-text">Resumo:</strong> Síntese com metodologia e resultados.
            </div>
            <div className="grid grid-cols-2 gap-1 text-text-muted pt-0.5" style={{ fontSize: '5px', lineHeight: 1.25 }}>
              <div>1. Introdução<br />Texto padrão...</div>
              <div>2. Análise<br />Citações ABNT...</div>
            </div>
          </div>
        ) : isResenha ? (
          <div className="space-y-1.5 overflow-hidden">
            <div className="font-bold uppercase text-accent" style={{ fontSize: '6.5px', lineHeight: 1.2 }}>
              Resenha Crítica
            </div>
            <div className="text-text-muted" style={{ fontSize: '5.5px', lineHeight: 1.25 }}>
              <strong className="text-text">Referência:</strong> AUTOR. Título da obra.
            </div>
            <div className="text-text-muted pt-1" style={{ fontSize: '5px', lineHeight: 1.3 }}>
              Síntese da obra, argumentos centrais e avaliação crítica.
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-between h-full py-1 text-center overflow-hidden">
            <div className="space-y-0.5">
              <div className="font-semibold uppercase tracking-wide" style={{ fontSize: '5.5px', lineHeight: 1.2 }}>
                Instituição Modelo
              </div>
              <div className="text-text-muted" style={{ fontSize: '5px', lineHeight: 1.2 }}>
                Nome do Autor
              </div>
            </div>
            <div className="font-bold px-1" style={{ fontSize: '7px', lineHeight: 1.25 }}>
              {nameLower.includes('projeto')
                ? 'PROJETO DE PESQUISA'
                : nameLower.includes('relatório')
                  ? 'RELATÓRIO TÉCNICO'
                  : 'MONOGRAFIA ABNT'}
            </div>
            <div className="text-text-muted" style={{ fontSize: '5px', lineHeight: 1.25 }}>
              Cidade · Ano
            </div>
          </div>
        )}
      </div>
    )
  }

  // Official Letter / Oficio / Ata / Timbre Preview (distinct system examples per template)
  if (
    resolvedTool === 'oficio' ||
    resolvedTool === 'letterhead' ||
    resolvedTool === 'meeting_minutes' ||
    variant === 'letterhead'
  ) {
    const isCorp = nameLower.includes('corporativa') || nameLower.includes('proposta')
    const isJuridico = nameLower.includes('jurídic') || nameLower.includes('parecer') || nameLower.includes('notificação')
    const isAcademico = nameLower.includes('acadêmico') || nameLower.includes('universitário')
    const isComunicado = nameLower.includes('comunicado') || nameLower.includes('memorando')
    const isDeclaracao = nameLower.includes('declaração') || nameLower.includes('atestado')
    const isFormulario = nameLower.includes('formulário') || nameLower.includes('lacunas')
    const isAta = resolvedTool === 'meeting_minutes' || nameLower.includes('ata')
    const isLetterhead = resolvedTool === 'letterhead' || variant === 'letterhead'

    const orgLabel = isCorp
      ? 'Empresa Modelo S/A'
      : isJuridico
        ? 'Assessoria Jurídica'
        : isAcademico
          ? 'Universidade Modelo'
          : isLetterhead
            ? 'Timbre Institucional'
            : 'Órgão Público'

    const docHeading = isAta
      ? 'ATA DE REUNIÃO'
      : isCorp
        ? 'CARTA EXECUTIVA'
        : isJuridico
          ? 'NOTIFICAÇÃO'
          : isAcademico
            ? 'OFÍCIO ACADÊMICO'
            : isComunicado
              ? 'MEMORANDO INTERNO'
              : isDeclaracao
                ? 'DECLARAÇÃO'
                : isFormulario
                  ? 'FORMULÁRIO'
                  : 'OFÍCIO Nº 001/GAB'

    const bodySample = isAta
      ? 'Pauta: Deliberações da equipe e próximos passos.'
      : isCorp
        ? 'Prezada Diretoria, apresentamos o resumo executivo.'
        : isJuridico
          ? 'Notifica-se o destinatário para ciência dos fatos.'
          : isAcademico
            ? 'À Coordenação, solicitamos análise do requerimento.'
            : isComunicado
              ? 'Para: Equipe · Comunicado operacional interno.'
              : isDeclaracao
                ? 'Declaramos para os devidos fins que constam os dados.'
                : isFormulario
                  ? 'Nome: {{nome}} · CPF: {{doc}} · Data: ____'
                  : 'Ao Senhor(a) Diretor(a), encaminhamos o expediente.'

    return (
      <div
        className={`w-28 h-40 rounded-lg border overflow-hidden ${
          highlight ? 'border-accent shadow-glass-sm' : 'border-border'
        } bg-bg p-2.5 flex flex-col justify-between select-none text-text`}
      >
        <div className="space-y-1.5 overflow-hidden">
          {isCorp ? (
            <div className="rounded bg-accent/15 border border-accent/30 px-1.5 py-1 flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-accent/60 shrink-0" />
              <div className="font-semibold truncate text-accent" style={{ fontSize: '5.5px', lineHeight: 1.2 }}>
                {orgLabel}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 border-b border-border pb-1">
              <div className="w-2.5 h-2.5 rounded bg-accent/25 border border-accent/50 shrink-0" />
              <div className="font-semibold truncate" style={{ fontSize: '5.5px', lineHeight: 1.2 }}>
                {orgLabel}
              </div>
            </div>
          )}
          <div className="font-bold truncate" style={{ fontSize: '6.5px', lineHeight: 1.2 }}>
            {docHeading}
          </div>
          <div className="text-text-muted truncate" style={{ fontSize: '5px', lineHeight: 1.2 }}>
            Cidade, DD/MM/AAAA
          </div>
          <div className="text-text pt-0.5" style={{ fontSize: '5.5px', lineHeight: 1.3 }}>
            {bodySample}
          </div>
        </div>
        <div
          className="pt-1 border-t border-border/60 text-center text-text-muted shrink-0"
          style={{ fontSize: '5px', lineHeight: 1.25 }}
        >
          Atenciosamente,<br />
          <strong className="text-text">Assinatura</strong>
        </div>
      </div>
    )
  }

  // General A4 Document (Apostila, Relatório, Currículo, Plano de Aula, Flashcards, etc.)
  return (
    <div
      className={`w-28 h-40 rounded-lg border overflow-hidden ${
        highlight ? 'border-accent shadow-glass-sm' : 'border-border'
      } bg-bg p-2.5 flex flex-col justify-between select-none text-text`}
    >
      <div className="space-y-1.5 overflow-hidden">
        <div
          className="font-bold uppercase tracking-wider text-accent truncate"
          style={{ fontSize: '5.5px', lineHeight: 1.2 }}
        >
          {resolvedTool === 'apostila'
            ? 'Módulo 01'
            : resolvedTool === 'lesson_plan'
              ? 'Plano de Aula'
              : resolvedTool === 'resume'
                ? 'Currículo ATS'
                : resolvedTool === 'contract'
                  ? 'Instrumento'
                  : 'Documento'}
        </div>
        <div className="font-bold line-clamp-2" style={{ fontSize: '6.5px', lineHeight: 1.25 }}>
          {templateName || 'Modelo Padrão'}
        </div>
        <div
          className="p-1 rounded bg-card border border-border/60 text-text-muted"
          style={{ fontSize: '5px', lineHeight: 1.3 }}
        >
          1. Sumário<br />
          2. Desenvolvimento<br />
          3. Conclusões
        </div>
      </div>
      <div
        className="flex items-center justify-between text-text-muted border-t border-border/60 pt-1 shrink-0"
        style={{ fontSize: '5px', lineHeight: 1.2 }}
      >
        <span>Exemplo</span>
        <span>Pág. 1</span>
      </div>
    </div>
  )
}
