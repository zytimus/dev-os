'use client'

import { useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LIMITS } from '@/lib/constants/terms'

interface CustomTermInputProps {
  terms: string[]
  onChange: (terms: string[]) => void
  disabled?: boolean
}

const MAX = LIMITS.MAX_CUSTOM_TERMS
const MAX_LEN = 80

/**
 * Adds up to LIMITS.MAX_CUSTOM_TERMS custom key terms. Rejects empty/duplicate
 * (case-insensitive) values and disables adding once the max is reached.
 */
export function CustomTermInput({ terms, onChange, disabled = false }: CustomTermInputProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const atMax = terms.length >= MAX

  function addTerm() {
    const value = draft.trim()
    if (!value) {
      setError('Enter a term name.')
      return
    }
    if (value.length > MAX_LEN) {
      setError(`Keep terms under ${MAX_LEN} characters.`)
      return
    }
    if (terms.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setError('That term has already been added.')
      return
    }
    if (atMax) {
      setError(`You can add up to ${MAX} custom terms.`)
      return
    }
    onChange([...terms, value])
    setDraft('')
    setError(null)
  }

  function removeTerm(index: number) {
    onChange(terms.filter((_, i) => i !== index))
    setError(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!disabled && !atMax) addTerm()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-body-lg font-semibold text-ink">Add custom terms (optional)</h3>
        <p className="text-body-sm text-muted">
          {atMax
            ? `Maximum of ${MAX} custom terms reached.`
            : `Add up to ${MAX} extra terms for ContractIQ to extract.`}
        </p>
      </div>

      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Input
            name="custom-term"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Force Majeure"
            disabled={disabled || atMax}
            error={error ?? undefined}
            maxLength={MAX_LEN}
            aria-label="Custom term name"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={addTerm}
          disabled={disabled || atMax || draft.trim().length === 0}
        >
          + Add Key Term
        </Button>
      </div>

      {terms.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {terms.map((term, index) => (
            <li key={`${term}-${index}`}>
              <Badge tone="accent">
                {term}
                <button
                  type="button"
                  onClick={() => removeTerm(index)}
                  disabled={disabled}
                  aria-label={`Remove ${term}`}
                  className="ml-1 rounded-tag px-1 text-accent-700 transition-colors duration-150 ease-out hover:text-accent-500 disabled:cursor-not-allowed"
                >
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
