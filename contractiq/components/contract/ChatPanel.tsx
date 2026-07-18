'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Layers, MapPin, MessageCircle, RotateCcw, Send } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { LIMITS } from '@/lib/constants/terms'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage, QueryMode } from '@/types'

// Attribution label + icon per source, shown on assistant messages.
const SOURCE_META: Record<QueryMode, { label: string; Icon: typeof FileText }> = {
  contract: { label: 'From the contract', Icon: FileText },
  history: { label: 'From the conversation', Icon: MessageCircle },
  both: { label: 'From contract + conversation', Icon: Layers },
}

interface ChatPanelProps {
  contractId: string
  onNavigate: (page: number) => void
}

// Local display type — optimistic user messages have a temporary client id.
interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  page_citation: number | null
  source: QueryMode | null
  pending?: boolean
}

function toDisplay(m: ChatMessage): DisplayMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    page_citation: m.page_citation,
    source: m.source,
  }
}

export function ChatPanel({ contractId, onNavigate }: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAttempt, setLastAttempt] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Seed history on mount.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/contracts/${contractId}/chat`)
        if (!res.ok) throw new Error('Failed to load chat history.')
        const data = await res.json()
        if (!cancelled) setMessages((data.messages as ChatMessage[]).map(toDisplay))
      } catch {
        // History load failure is non-fatal — start with an empty thread.
        if (!cancelled) setMessages([])
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [contractId])

  // Auto-scroll to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setError(null)
    setLastAttempt(trimmed)
    setInput('')

    const optimistic: DisplayMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: trimmed,
      page_citation: null,
      source: null,
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setSending(true)

    try {
      const res = await fetch(`/api/contracts/${contractId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'The assistant could not respond.')
      }
      const data = await res.json()
      const assistant = toDisplay(data.message as ChatMessage)
      // Confirm the optimistic user bubble + append the assistant reply.
      setMessages((prev) =>
        prev
          .map((m) => (m.id === optimistic.id ? { ...m, pending: false } : m))
          .concat(assistant),
      )
      setLastAttempt(null)
    } catch (err) {
      // Remove the optimistic bubble and surface a retry.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setError(err instanceof Error ? err.message : 'The assistant could not respond.')
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void send(input)
  }

  const showEmpty = !loadingHistory && messages.length === 0

  return (
    <Card className="flex h-full min-h-[24rem] flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <MessageCircle size={18} strokeWidth={1.5} className="text-brand" aria-hidden />
        <h2 className="text-body-lg text-ink">Ask about this contract</h2>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} className="text-brand" />
          </div>
        ) : showEmpty ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-body-lg text-ink">Ask a question</p>
            <p className="text-body-sm text-muted">
              Answers are grounded strictly in this document, with a page citation.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-card px-3 py-2 text-body-sm',
                  m.role === 'user'
                    ? 'bg-brand-50 text-ink'
                    : 'border border-line bg-surface text-ink',
                  m.pending && 'opacity-70',
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.role === 'assistant' && (m.source != null || m.page_citation != null) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-1.5">
                    {m.source != null &&
                      (() => {
                        const { label, Icon } = SOURCE_META[m.source]
                        return (
                          <span className="inline-flex items-center gap-1 text-body-sm text-muted">
                            <Icon size={14} strokeWidth={1.5} aria-hidden />
                            {label}
                          </span>
                        )
                      })()}
                    {m.page_citation != null && (
                      <button
                        type="button"
                        onClick={() => onNavigate(m.page_citation as number)}
                        className="inline-flex items-center gap-1 text-body-sm font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                      >
                        <MapPin size={14} strokeWidth={1.5} aria-hidden />
                        Page {m.page_citation}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-2 text-body-sm text-muted">
              <Spinner size={14} />
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 border-t border-danger-200 bg-danger-50 px-4 py-2">
          <p className="text-body-sm text-danger-700">{error}</p>
          {lastAttempt && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void send(lastAttempt)}
              disabled={sending}
            >
              <RotateCcw size={14} strokeWidth={1.5} aria-hidden />
              Retry
            </Button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-line p-3">
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about this contract
        </label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
          rows={1}
          maxLength={LIMITS.MAX_MESSAGE_CHARS}
          disabled={sending}
          placeholder="Ask a question…"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-y rounded-input border border-line bg-white px-3 py-2 text-body-lg text-ink placeholder:text-grey-300 transition-colors duration-100 ease-out focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:bg-subtle"
        />
        <Button
          type="submit"
          size="sm"
          loading={sending}
          disabled={sending || input.trim().length === 0}
          aria-label="Send message"
        >
          {!sending && <Send size={14} strokeWidth={1.5} aria-hidden />}
          Send
        </Button>
      </form>
    </Card>
  )
}
