import React, { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'momai_autocomplete_history'
const MAX_ENTRIES = 500

interface HistoryEntry {
  text: string
  count: number
  lastUsed: number
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    const pruned = entries.sort((a, b) => b.count - a.count).slice(0, Math.floor(MAX_ENTRIES / 2))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
    } catch {
      // ignore storage quota errors
    }
  }
}

function normalize(text: string): string {
  return text.toLowerCase().trim()
}

export function useAutocomplete() {
  const historyRef = useRef<HistoryEntry[]>(loadHistory())
  const [suggestion, setSuggestion] = useState<string>('')

  useEffect(() => {
    historyRef.current = loadHistory()
  }, [])

  const addToHistory = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 1) return

    const entries = loadHistory()
    const normalized = normalize(trimmed)
    const existing = entries.find((e) => normalize(e.text) === normalized)

    if (existing) {
      existing.count += 1
      existing.lastUsed = Date.now()
      if (existing.text.length < trimmed.length) {
        existing.text = trimmed
      }
    } else {
      entries.push({ text: trimmed, count: 1, lastUsed: Date.now() })
    }

    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
      entries.length = MAX_ENTRIES
    }

    historyRef.current = entries
    saveHistory(entries)
  }, [])

  const syncFromMessages = useCallback(
    (messages: Array<{ text?: string; content?: string; role?: string }>) => {
      if (!Array.isArray(messages) || messages.length === 0) return
      let changed = false
      const entries = [...loadHistory()]

      for (const msg of messages) {
        if (msg.role && msg.role !== 'user') continue
        const rawText = msg.text || msg.content || ''
        const trimmed = rawText.trim()
        if (!trimmed) continue

        const normalized = normalize(trimmed)
        const existing = entries.find((e) => normalize(e.text) === normalized)
        if (!existing) {
          entries.push({ text: trimmed, count: 1, lastUsed: Date.now() })
          changed = true
        }
      }

      if (changed) {
        if (entries.length > MAX_ENTRIES) {
          entries.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
          entries.length = MAX_ENTRIES
        }
        historyRef.current = entries
        saveHistory(entries)
      }
    },
    []
  )

  const getSuggestion = useCallback((input: string): string => {
    const trimmed = input.trimStart()
    if (!trimmed || trimmed.length < 2) {
      setSuggestion('')
      return ''
    }

    const inputLower = trimmed.toLowerCase()
    const entries = loadHistory()
    historyRef.current = entries

    const matches = entries
      .filter((e) => {
        const entryLower = e.text.toLowerCase()
        return entryLower.startsWith(inputLower) && entryLower !== inputLower
      })
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)

    if (matches.length === 0) {
      setSuggestion('')
      return ''
    }

    const best = matches[0]
    const completion = best.text.slice(trimmed.length)
    setSuggestion(completion)
    return completion
  }, [])

  const clearSuggestion = useCallback(() => {
    setSuggestion('')
  }, [])

  const acceptSuggestion = useCallback(
    (currentText: string): string => {
      if (!suggestion) return currentText
      const result = currentText + suggestion
      setSuggestion('')
      return result
    },
    [suggestion]
  )

  const getRecentHistory = useCallback((): string[] => {
    return [...loadHistory()]
      .sort((a, b) => b.lastUsed - a.lastUsed || b.count - a.count)
      .map((entry) => entry.text)
      .filter((text) => Boolean(text && text.trim()))
  }, [])

  return {
    suggestion,
    addToHistory,
    syncFromMessages,
    getSuggestion,
    clearSuggestion,
    acceptSuggestion,
    getRecentHistory
  }
}

interface AutocompleteTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string
  onValueChange: (nextValue: string) => void
  wrapperClassName?: string
  overlayPaddingClassName?: string
}

export function AutocompleteTextarea({
  value,
  onValueChange,
  wrapperClassName = 'relative flex-1 min-w-0',
  overlayPaddingClassName = 'px-1 py-1 text-xs',
  className = '',
  onKeyDown,
  onBlur,
  onScroll,
  ...rest
}: AutocompleteTextareaProps) {
  const { suggestion, getSuggestion, clearSuggestion, acceptSuggestion, getRecentHistory } = useAutocomplete()
  const ghostRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyNavIndexRef = useRef<number>(-1)
  const historyDraftRef = useRef<string>('')

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    historyNavIndexRef.current = -1
    onValueChange(next)
    getSuggestion(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestion && (e.key === 'Tab' || e.key === 'ArrowRight')) {
      const el = inputRef.current
      const atEnd = !el || (el.selectionStart === value.length && el.selectionEnd === value.length)
      if (e.key === 'Tab' || atEnd) {
        e.preventDefault()
        historyNavIndexRef.current = -1
        onValueChange(acceptSuggestion(value))
        return
      }
    }
    if (e.key === 'ArrowUp') {
      const el = inputRef.current
      if (el && el.selectionStart === 0 && el.selectionEnd === 0) {
        const history = getRecentHistory()
        if (history.length > 0) {
          e.preventDefault()
          if (historyNavIndexRef.current === -1) {
            historyDraftRef.current = value
            historyNavIndexRef.current = 0
          } else if (historyNavIndexRef.current < history.length - 1) {
            historyNavIndexRef.current += 1
          }
          const nextValue = history[historyNavIndexRef.current] || ''
          onValueChange(nextValue)
          clearSuggestion()
          requestAnimationFrame(() => {
            if (!inputRef.current) return
            const pos = nextValue.length
            try {
              inputRef.current.setSelectionRange(pos, pos)
            } catch {
              // ignore selection errors
            }
          })
          return
        }
      }
    }
    if (e.key === 'ArrowDown' && historyNavIndexRef.current !== -1) {
      const el = inputRef.current
      if (el && el.selectionStart === value.length && el.selectionEnd === value.length) {
        e.preventDefault()
        const history = getRecentHistory()
        if (history.length > 0 && historyNavIndexRef.current > 0) {
          historyNavIndexRef.current -= 1
          const nextValue = history[historyNavIndexRef.current] || ''
          onValueChange(nextValue)
          clearSuggestion()
          requestAnimationFrame(() => {
            if (!inputRef.current) return
            const pos = nextValue.length
            try {
              inputRef.current.setSelectionRange(pos, pos)
            } catch {
              // ignore selection errors
            }
          })
          return
        }
        historyNavIndexRef.current = -1
        const draft = historyDraftRef.current || ''
        onValueChange(draft)
        clearSuggestion()
        requestAnimationFrame(() => {
          if (!inputRef.current) return
          const pos = draft.length
          try {
            inputRef.current.setSelectionRange(pos, pos)
          } catch {
            // ignore selection errors
          }
        })
        return
      }
    }
    if (suggestion && e.key === 'Escape') {
      clearSuggestion()
    }
    onKeyDown?.(e)
  }

  return (
    <div className={wrapperClassName}>
      <div
        ref={ghostRef}
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden text-transparent leading-normal ${overlayPaddingClassName}`}
      >
        <span>{value}</span>
        {suggestion && <span className="text-text-muted/25 select-none">{suggestion}</span>}
      </div>
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          clearSuggestion()
          onBlur?.(e)
        }}
        onScroll={(e) => {
          if (ghostRef.current && inputRef.current) {
            ghostRef.current.scrollTop = inputRef.current.scrollTop
          }
          onScroll?.(e)
        }}
        className={`relative z-10 w-full bg-transparent ${className}`}
        {...rest}
      />
    </div>
  )
}
