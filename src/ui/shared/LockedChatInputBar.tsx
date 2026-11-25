import React from 'react'
import { IconPaperclip, IconSend } from '../icons'
import { useDocsI18n } from '../i18n'

interface LockedChatInputBarProps {
  onTriggerPurchase: () => void
  placeholder?: string
  hintText?: string
}

export function LockedChatInputBar({
  onTriggerPurchase,
  placeholder,
  hintText
}: LockedChatInputBarProps) {
  const { t } = useDocsI18n()
  const resolvedPlaceholder = placeholder || t('Pergunte às fontes do projeto...')
  const resolvedHint = hintText || t('As respostas usam apenas as fontes indexadas neste projeto.')

  return (
    <div className="shrink-0 px-3 pb-3 pt-1.5 space-y-1.5 bg-main">
      <div
        onClick={onTriggerPurchase}
        className="bg-card border border-border rounded-2xl p-2 flex items-end gap-2 cursor-pointer hover:border-accent/60 transition-colors"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTriggerPurchase()
          }}
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-text-muted hover:text-text hover:bg-input transition-colors"
          title={t('Anexar arquivos ou imagens')}
        >
          <IconPaperclip size={15} />
        </button>
        <textarea
          readOnly
          rows={2}
          value=""
          onFocus={(e) => {
            e.target.blur()
            onTriggerPurchase()
          }}
          onClick={(e) => {
            e.stopPropagation()
            onTriggerPurchase()
          }}
          placeholder={resolvedPlaceholder}
          className="flex-1 min-w-0 resize-none bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none px-1 py-1 cursor-pointer"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTriggerPurchase()
          }}
          className="h-8 w-8 rounded-xl bg-accent text-bg flex items-center justify-center shrink-0 hover:opacity-90"
          title={t('Enviar')}
        >
          <IconSend size={14} />
        </button>
      </div>
      <div className="text-[10px] text-text-muted text-center">{resolvedHint}</div>
    </div>
  )
}
