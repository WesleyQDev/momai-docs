import React, { useEffect, useMemo, useRef, useState } from 'react'
import sdk from 'momai:sdk'
import { IconPaperclip, IconSend, IconSparkles, IconX } from '../src/ui/icons'
import {
  buildDeterministicDemoFallback,
  DEFAULT_DEMO_SUGGESTIONS,
  DEMO_CHAT_MAX_CHARS,
  DEMO_GREETING_REPLY,
  DEMO_OUT_OF_SCOPE_REPLY,
  evaluateDemoChatMessage,
  getDemoFollowUpSuggestions
} from './demo-chat-guard'

interface DemoChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  suggestPurchase?: boolean
}

interface DemoChatBarProps {
  demoExtId: string
  onTriggerPurchase: () => void
}

function DocsAssistantIcon({ size = 22, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 drop-shadow-sm ${spinning ? 'animate-pulse' : ''}`}
    >
      <defs>
        <linearGradient id="mdocsChatFolioBack" x1="4" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="mdocsChatFolioFront" x1="6" y1="7" x2="24" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="55%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="mdocsChatPenNib" x1="16" y1="3" x2="29" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect x="4" y="5" width="17" height="22" rx="4" transform="rotate(-7 12.5 16)" fill="url(#mdocsChatFolioBack)" opacity="0.5" />
      <rect x="6" y="6" width="18" height="22" rx="4.2" fill="url(#mdocsChatFolioFront)" />
      <rect x="9.5" y="10.5" width="7.5" height="2.4" rx="1.2" fill="#FFFFFF" />
      <rect x="9.5" y="15" width="11" height="2" rx="1" fill="#E0F2FE" />
      <rect x="9.5" y="18.8" width="8" height="2" rx="1" fill="#BAE6FD" />
      <path
        d="M26.8 3.6C27.9 4.7 27.9 6.5 26.8 7.6L17.9 16.5L13.5 17.7L14.7 13.3L23.6 4.4C24.7 3.3 26.5 3.3 26.8 3.6Z"
        fill="url(#mdocsChatPenNib)"
      />
      <path d="M24.2 5.2L16.3 13.1" stroke="#FEF9C3" strokeWidth="1.1" strokeLinecap="round" />
      <path
        d="M11 23.2L11.7 25L13.5 25.7L11.7 26.4L11 28.2L10.3 26.4L8.5 25.7L10.3 25L11 23.2Z"
        fill="#FDE047"
      />
    </svg>
  )
}

export function DemoChatBar({ demoExtId, onTriggerPurchase }: DemoChatBarProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<DemoChatMessage[]>([])
  const [trayOpen, setTrayOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [statusLabel, setStatusLabel] = useState('Analisando...')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const dynamicSuggestions = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.text)
    if (userMessages.length === 0) return DEFAULT_DEMO_SUGGESTIONS
    const lastUserMessage = userMessages[userMessages.length - 1]
    return getDemoFollowUpSuggestions(lastUserMessage, userMessages)
  }, [messages])

  const closeAndClearChat = () => {
    setTrayOpen(false)
    setMessages([])
    setSending(false)
  }

  useEffect(() => {
    if (!trayOpen) return
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeAndClearChat()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndClearChat()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [trayOpen])

  useEffect(() => {
    if (!trayOpen || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending, trayOpen])

  const handleSend = async (overrideText?: string) => {
    const trimmed = String(overrideText ?? input).trim()
    if (!trimmed || sending) return

    const userMsg: DemoChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed
    }

    setMessages((prev) => [...prev.slice(-11), userMsg])
    if (overrideText === undefined) setInput('')
    setTrayOpen(true)
    setSending(true)

    const guard = evaluateDemoChatMessage(trimmed)
    if (!guard.allowed) {
      setStatusLabel('Verificando contexto...')
      await new Promise((r) => window.setTimeout(r, 380))
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: DEMO_OUT_OF_SCOPE_REPLY,
          suggestPurchase: true
        }
      ])
      setSending(false)
      return
    }

    if (guard.reason === 'greeting') {
      setStatusLabel('Analisando...')
      await new Promise((r) => window.setTimeout(r, 320))
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: DEMO_GREETING_REPLY,
          suggestPurchase: false
        }
      ])
      setSending(false)
      return
    }

    setStatusLabel('Analisando sua pergunta...')

    try {
      const timeoutPromise = new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 6000)
      })
      const res = await Promise.race([
        sdk.api.post(`/extensions/${demoExtId}/demo-chat`, {
          message: trimmed
        }),
        timeoutPromise
      ])
      const data = res && typeof res === 'object' && 'data' in res ? (res as any).data : null
      const replyText =
        data?.ok && typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : buildDeterministicDemoFallback(trimmed)

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          suggestPurchase: Boolean(data?.suggestPurchase)
        }
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: buildDeterministicDemoFallback(trimmed),
          suggestPurchase: false
        }
      ])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div ref={containerRef} className="shrink-0 px-3 pb-3 pt-1.5 space-y-2 bg-main">
      {trayOpen && messages.length > 0 && (
        <div className="rounded-2xl bg-card border border-border shadow-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between gap-2 bg-main/40">
            <div className="flex items-center gap-2 min-w-0">
              <DocsAssistantIcon size={19} spinning={sending} />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-text truncate">MomAI Docs</span>
                <span className="text-[10px] text-text-muted">·</span>
                <span className="text-[11px] text-text-muted truncate">
                  {sending ? statusLabel : 'Assistente da Demo'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  setTrayOpen(false)
                }}
                className="h-6 px-2 rounded-lg text-[11px] text-text-muted hover:text-text hover:bg-input transition-colors"
              >
                Novo chat
              </button>
              <button
                type="button"
                onClick={closeAndClearChat}
                title="Fechar chat"
                aria-label="Fechar chat"
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-input transition-colors"
              >
                <IconX size={14} />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-3.5 space-y-4">
            {messages.map((msg) =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex justify-end mdocs-chat-msg-in">
                  <div className="max-w-[82%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] leading-relaxed bg-input text-text border border-border/70">
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex items-start gap-3 mdocs-chat-msg-in">
                  <div className="pt-0.5">
                    <DocsAssistantIcon size={22} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="text-[11px] font-semibold text-text-muted">MomAI Docs</div>
                    <p className="text-[13px] leading-relaxed text-text whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                    {msg.suggestPurchase && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={onTriggerPurchase}
                          className="mdocs-demo-btn-primary h-8 px-3.5 rounded-xl inline-flex items-center gap-1.5"
                        >
                          <IconSparkles size={13} />
                          <span>Comprar pacote MomAI Docs</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {sending && (
              <div className="flex items-start gap-3 mdocs-chat-msg-in">
                <div className="pt-0.5">
                  <DocsAssistantIcon size={22} spinning />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-[11px] font-semibold text-text-muted">MomAI Docs</div>
                  <div className="inline-flex items-center gap-2 text-xs text-text-muted">
                    <span>{statusLabel}</span>
                    <span className="inline-flex items-center gap-1 pt-0.5">
                      <span className="mdocs-chat-dot" />
                      <span className="mdocs-chat-dot" />
                      <span className="mdocs-chat-dot" />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!sending && (
            <div className="px-4 py-2 border-t border-border/50 bg-main/30 flex items-center gap-1.5 flex-wrap">
              {dynamicSuggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void handleSend(q)}
                  className="h-6 px-2.5 rounded-full bg-input/80 border border-border/60 text-[11px] text-text-muted hover:text-text hover:border-accent/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-2 flex items-end gap-2 focus-within:border-accent/60 transition-colors shadow-sm">
        <button
          type="button"
          onClick={onTriggerPurchase}
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-text-muted hover:text-text hover:bg-input transition-colors"
          title="Anexar arquivos disponível na versão completa"
        >
          <IconPaperclip size={15} />
        </button>
        <textarea
          rows={2}
          maxLength={DEMO_CHAT_MAX_CHARS}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          placeholder="Pergunte às fontes do projeto ou tire dúvidas sobre o MomAI Docs..."
          className="flex-1 min-w-0 resize-none bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none px-1 py-1"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !input.trim()}
          className="mdocs-demo-btn-primary h-8 w-8 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-45"
          title="Enviar pergunta"
        >
          <IconSend size={14} />
        </button>
      </div>
      <div className="text-[10px] text-text-muted text-center">
        Chat restrito a dúvidas sobre a extensão MomAI Docs · Chat com suas fontes e anexos disponível na versão completa.
      </div>
    </div>
  )
}
