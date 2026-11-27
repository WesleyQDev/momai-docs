import React, { useRef, useState } from 'react'
import { IconCheck, IconFileText, IconUpload, IconX } from '../icons'
import { useDocsI18n } from '../i18n'

export interface LetterheadAnalysisSummary {
  format: 'docx' | 'pdf'
  pageCount: number
  detectedPlaceholders: string[]
}

interface BrandKitModalProps {
  open: boolean
  letterheadFile: { name: string; base64: string } | null
  analysis: LetterheadAnalysisSummary | null
  extracting: boolean
  selectOnSave?: boolean
  onClose: () => void
  onUploadFile: (file: File) => Promise<void>
  onClearLetterheadFile: () => void
  onConfirm: (selectBrandStyle: boolean) => void
}

export function BrandKitModal({
  open,
  letterheadFile,
  analysis,
  extracting,
  selectOnSave = false,
  onClose,
  onUploadFile,
  onClearLetterheadFile,
  onConfirm
}: BrandKitModalProps) {
  const { t } = useDocsI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)

  if (!open) return null

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    await onUploadFile(file)
  }

  return (
    <div
      className="absolute inset-0 z-50 pointer-events-auto flex items-center justify-center bg-bg/75 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4 shadow-glass-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">{t('Usar meu documento')}</h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              {t('Envie um arquivo Word ou PDF para preencher ou usar como base nos seus documentos.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text p-1 rounded-lg"
            title={t('Fechar')}
          >
            <IconX size={15} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          className="hidden"
          onChange={async (e) => {
            await handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void handleFiles(e.dataTransfer.files)
          }}
          onClick={() => !extracting && fileInputRef.current?.click()}
          className={`rounded-xl border border-dashed p-6 text-center cursor-pointer transition-colors space-y-2 ${
            dragOver ? 'border-accent bg-accent/10' : 'border-border bg-input/50 hover:bg-input'
          }`}
        >
          <IconUpload size={22} className="mx-auto text-accent" />
          <div className="text-xs font-medium text-text">
            {extracting
              ? t('Lendo documento...')
              : t('Arraste seu documento Word ou PDF aqui')}
          </div>
          <div className="text-[11px] text-text-muted">
            {t('ou clique para escolher um arquivo (.docx, .pdf)')}
          </div>
        </div>

        {letterheadFile && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <IconFileText size={16} className="text-accent shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-medium text-text truncate">
                  {t('Documento carregado: {name}', { name: letterheadFile.name })}
                </div>
                <div className="text-[11px] text-text-muted">
                  {analysis && analysis.detectedPlaceholders.length > 0
                    ? t('{count} campo(s) detectado(s) para preenchimento automático.', {
                        count: analysis.detectedPlaceholders.length
                      })
                    : t('O layout e as informações do arquivo serão usados como base nos seus documentos.')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearLetterheadFile}
              className="text-[11px] text-text-muted hover:text-text shrink-0 px-1.5 py-0.5 rounded"
              title={t('Remover arquivo')}
            >
              <IconX size={13} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-xl bg-input text-xs font-medium text-text hover:opacity-80"
          >
            {t('Cancelar')}
          </button>
          <button
            type="button"
            disabled={extracting || !letterheadFile}
            onClick={() => onConfirm(selectOnSave)}
            className="h-9 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <IconCheck size={13} />
            <span>{t('Usar este documento')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
