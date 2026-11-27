import React, { useEffect, useMemo, useState } from 'react'
import { IconCheck, IconChevronLeft, IconChevronRight, IconX } from '../icons'
import { useDocsI18n } from '../i18n'

export interface QuizQuestionItem {
  front?: string
  question?: string
  back?: string
  answer?: string
  options?: string[]
  correctIndex?: number
  explanation?: string
  citationLocator?: string
}

interface QuizPlayerProps {
  artifactKey: string
  title?: string
  questions: QuizQuestionItem[]
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function QuizPlayer({ artifactKey, title, questions }: QuizPlayerProps) {
  const { t, locale } = useDocsI18n()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedByIdx, setSelectedByIdx] = useState<Record<number, number>>({})
  const [revealedByIdx, setRevealedByIdx] = useState<Record<number, boolean>>({})
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  useEffect(() => {
    setCurrentIdx(0)
    setSelectedByIdx({})
    setRevealedByIdx({})
    setFeedbackOpen(false)
    setShowSummary(false)
  }, [artifactKey])

  const total = questions.length
  const safeIdx = Math.min(Math.max(0, currentIdx), Math.max(0, total - 1))
  const current = questions[safeIdx]

  const scoreStats = useMemo(() => {
    let correctCount = 0
    let answeredCount = 0
    let gradableCount = 0
    questions.forEach((q, idx) => {
      const hasOptions = Array.isArray(q.options) && q.options.length > 0 && typeof q.correctIndex === 'number'
      if (!hasOptions) return
      gradableCount += 1
      const chosen = selectedByIdx[idx]
      if (typeof chosen === 'number') {
        answeredCount += 1
        if (chosen === q.correctIndex) correctCount += 1
      }
    })
    const denominator = gradableCount > 0 ? gradableCount : total
    const percent = denominator > 0 ? Math.round((correctCount / denominator) * 100) : 0
    const grade10 = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(denominator > 0 ? (correctCount / denominator) * 10 : 0)
    return { correctCount, answeredCount, gradableCount: denominator, percent, grade10 }
  }, [questions, selectedByIdx, total, locale])

  if (total === 0) {
    return null
  }

  const handleRestart = () => {
    setCurrentIdx(0)
    setSelectedByIdx({})
    setRevealedByIdx({})
    setFeedbackOpen(false)
    setShowSummary(false)
  }

  const goToQuestion = (nextIdx: number) => {
    setCurrentIdx(nextIdx)
    setFeedbackOpen(false)
  }

  if (showSummary) {
    return (
      <div className="w-full max-w-2xl mx-auto min-w-0 space-y-5 py-1">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              {t('Resultado final')}
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-text break-words">
              {title || t('Quiz')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleRestart}
            className="h-8 px-3.5 rounded-xl bg-input/60 hover:bg-input text-xs font-medium text-text flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            <span>{t('Refazer quiz')}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3.5 rounded-xl bg-input/45 min-w-0">
            <div className="text-[11px] text-text-muted truncate">{t('Nota final')}</div>
            <div className="text-xl sm:text-2xl font-bold text-accent tabular-nums mt-0.5">
              {scoreStats.grade10} <span className="text-xs font-normal text-text-muted">/ 10</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-input/45 min-w-0">
            <div className="text-[11px] text-text-muted truncate">{t('Aproveitamento')}</div>
            <div className="text-xl sm:text-2xl font-bold text-text tabular-nums mt-0.5">{scoreStats.percent}%</div>
          </div>
          <div className="p-3.5 rounded-xl bg-input/45 min-w-0">
            <div className="text-[11px] text-text-muted truncate">{t('Acertos')}</div>
            <div className="text-xl sm:text-2xl font-bold text-success tabular-nums mt-0.5">
              {scoreStats.correctCount} <span className="text-xs font-normal text-text-muted">/ {scoreStats.gradableCount}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {t('Resumo das questões')}
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const hasOptions = Array.isArray(q.options) && q.options.length > 0 && typeof q.correctIndex === 'number'
              const chosen = selectedByIdx[idx]
              const isCorrect = hasOptions && chosen === q.correctIndex
              const isAnswered = typeof chosen === 'number'
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    goToQuestion(idx)
                    setShowSummary(false)
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-input/35 hover:bg-input/70 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors min-w-0"
                >
                  <div className="flex-1 min-w-0 text-xs text-text truncate">
                    <span className="font-semibold text-text-muted mr-1.5">{idx + 1}.</span>
                    {q.front || q.question}
                  </div>
                  {hasOptions && (
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                        !isAnswered
                          ? 'bg-input text-text-muted'
                          : isCorrect
                            ? 'bg-success/15 text-success'
                            : 'bg-error/15 text-error'
                      }`}
                    >
                      {!isAnswered ? (
                        t('Não respondida')
                      ) : isCorrect ? (
                        <>
                          <IconCheck size={11} />
                          {t('Acertou')}
                        </>
                      ) : (
                        <>
                          <IconX size={11} />
                          {t('Errou')}
                        </>
                      )}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const options = Array.isArray(current.options) ? current.options : []
  const hasMultipleChoice = options.length > 0 && typeof current.correctIndex === 'number'
  const chosenIdx = selectedByIdx[safeIdx]
  const isAnswered = typeof chosenIdx === 'number'
  const isCorrect = hasMultipleChoice && isAnswered && chosenIdx === current.correctIndex
  const isLegacyRevealed = Boolean(revealedByIdx[safeIdx])
  const progressPct = Math.round(((safeIdx + 1) / total) * 100)

  return (
    <div className="relative w-full max-w-2xl mx-auto min-w-0 space-y-5 py-1">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-accent tabular-nums">
            {safeIdx + 1} / {total}
          </span>
          <span className="text-[11px] text-text-muted tabular-nums">
            {t('Acertos')}: {scoreStats.correctCount} / {scoreStats.answeredCount}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-input overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="text-base font-semibold text-text leading-relaxed">
        {current.front || current.question}
      </div>

      {hasMultipleChoice ? (
        <div className="space-y-2">
          {options.map((opt, optIdx) => {
            const isSelected = chosenIdx === optIdx
            const isRightOption = current.correctIndex === optIdx

            let optionClasses = 'bg-input/45 text-text hover:bg-input/80'
            let badgeClasses = 'bg-card/70 text-text-muted'
            if (isAnswered) {
              if (isRightOption) {
                optionClasses = 'bg-success/15 text-text font-medium'
                badgeClasses = 'bg-success/20 text-success'
              } else if (isSelected && !isRightOption) {
                optionClasses = 'bg-error/15 text-text'
                badgeClasses = 'bg-error/20 text-error'
              } else {
                optionClasses = 'bg-input/25 text-text-muted opacity-65'
                badgeClasses = 'bg-transparent text-text-muted'
              }
            }

            return (
              <button
                key={optIdx}
                type="button"
                disabled={isAnswered}
                onClick={() => {
                  setSelectedByIdx((prev) => ({ ...prev, [safeIdx]: optIdx }))
                }}
                className={`w-full px-4 py-3 rounded-xl text-left text-xs sm:text-sm transition-colors flex items-center justify-between gap-3 ${optionClasses} ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 transition-colors ${badgeClasses}`}>
                    {OPTION_LETTERS[optIdx] || optIdx + 1}
                  </span>
                  <span className="leading-snug pt-0.5">{opt}</span>
                </div>
                {isAnswered && isRightOption && (
                  <span className="shrink-0 text-success flex items-center gap-1 text-xs font-semibold">
                    <IconCheck size={14} />
                  </span>
                )}
                {isAnswered && isSelected && !isRightOption && (
                  <span className="shrink-0 text-error flex items-center gap-1 text-xs font-semibold">
                    <IconX size={14} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {!isLegacyRevealed ? (
            <button
              type="button"
              onClick={() => setRevealedByIdx((prev) => ({ ...prev, [safeIdx]: true }))}
              className="h-9 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 cursor-pointer"
            >
              {t('Mostrar resposta')}
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-input/50 text-xs text-text leading-relaxed">
              {current.back || current.answer}
            </div>
          )}
        </div>
      )}

      {isAnswered && feedbackOpen && (
        <div className="absolute inset-x-0 bottom-12 z-20 rounded-xl border border-border bg-card shadow-glass-md p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className={`text-xs font-semibold flex items-center gap-1.5 ${isCorrect ? 'text-success' : 'text-error'}`}>
              {isCorrect ? <IconCheck size={14} /> : <IconX size={14} />}
              <span>{isCorrect ? t('Você acertou!') : t('Resposta incorreta')}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackOpen(false)}
              aria-label={t('Fechar')}
              className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-input/60 cursor-pointer transition-colors"
            >
              <IconX size={13} />
            </button>
          </div>
          {current.explanation && (
            <div className="text-xs text-text leading-relaxed">{current.explanation}</div>
          )}
          {current.citationLocator && (
            <div className="text-[11px] text-text-muted">{current.citationLocator}</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          disabled={safeIdx <= 0}
          onClick={() => goToQuestion(Math.max(0, safeIdx - 1))}
          className="h-9 px-3.5 rounded-xl bg-input/60 hover:bg-input text-xs font-medium text-text disabled:opacity-40 flex items-center gap-1.5 cursor-pointer disabled:cursor-default transition-colors"
        >
          <IconChevronLeft size={14} />
          <span>{t('Anterior')}</span>
        </button>

        {isAnswered && (
          <button
            type="button"
            onClick={() => setFeedbackOpen((o) => !o)}
            className={`h-8 px-3.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isCorrect
                ? 'bg-success/15 text-success hover:bg-success/25'
                : 'bg-error/15 text-error hover:bg-error/25'
            }`}
          >
            {isCorrect ? <IconCheck size={12} /> : <IconX size={12} />}
            <span>{isCorrect ? t('Acertou') : t('Errou')}</span>
            {current.explanation && (
              <span className="opacity-75 font-normal">· {t('Explicação')}</span>
            )}
          </button>
        )}

        {safeIdx < total - 1 ? (
          <button
            type="button"
            onClick={() => goToQuestion(Math.min(total - 1, safeIdx + 1))}
            className="h-9 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
          >
            <span>{t('Próxima questão')}</span>
            <IconChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="h-9 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
          >
            <span>{t('Ver nota final')}</span>
            <IconChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
