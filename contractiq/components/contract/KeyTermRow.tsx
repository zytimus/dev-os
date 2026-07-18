'use client'

import { useState } from 'react'
import { MapPin, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { ConfidenceBadge } from './ConfidenceBadge'
import { WhyDisclosure } from './WhyDisclosure'
import type { KeyTerm } from '@/types'

interface KeyTermRowProps {
  keyTerm: KeyTerm
  onNavigate: (page: number) => void
}

export function KeyTermRow({ keyTerm, onNavigate }: KeyTermRowProps) {
  const [term, setTerm] = useState<KeyTerm>(keyTerm)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(keyTerm.value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setDraft(term.value)
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  async function save() {
    const value = draft.trim()
    if (!value) {
      setError('Value cannot be empty')
      return
    }
    if (value === term.value) {
      setEditing(false)
      return
    }

    setSaving(true)
    setError(null)

    // Optimistic update — snapshot for rollback.
    const previous = term
    const optimistic: KeyTerm = {
      ...term,
      value,
      is_edited: true,
      original_ai_value: term.original_ai_value ?? term.value,
    }
    setTerm(optimistic)
    setEditing(false)

    try {
      const res = await fetch(`/api/key-terms/${term.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Could not save the change.')
      }
      const data = await res.json()
      setTerm(data.key_term as KeyTerm)
    } catch (err) {
      // Rollback.
      setTerm(previous)
      setDraft(previous.value)
      setEditing(true)
      setError(err instanceof Error ? err.message : 'Could not save the change.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body-lg text-ink">{term.term_name}</h3>
          {term.is_custom && <Badge tone="accent">Custom</Badge>}
          {term.is_edited && <Badge tone="neutral">Edited</Badge>}
        </div>
        <ConfidenceBadge score={term.confidence_score} />
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Input
            aria-label={`Edit ${term.term_name}`}
            value={draft}
            maxLength={2000}
            disabled={saving}
            error={error ?? undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
              if (e.key === 'Escape') cancelEdit()
            }}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void save()} loading={saving} disabled={saving}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-wrap text-body-lg text-muted">{term.value}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={startEdit}
            aria-label={`Edit ${term.term_name}`}
            className="shrink-0"
          >
            <Pencil size={14} strokeWidth={1.5} aria-hidden />
            Edit
          </Button>
        </div>
      )}

      {!editing && error && <p className="text-body-sm text-danger-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        {term.page_number != null && (
          <button
            type="button"
            onClick={() => onNavigate(term.page_number as number)}
            className="inline-flex items-center gap-1 text-body-sm font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <MapPin size={14} strokeWidth={1.5} aria-hidden />
            Page {term.page_number}
          </button>
        )}
        <WhyDisclosure sentence={term.source_sentence} />
      </div>
    </Card>
  )
}
