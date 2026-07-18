'use client'

import { useState } from 'react'
import { Check, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { FeedbackRating } from '@/types'

/** Thumbs up/down + optional comment feedback on a completed review. */
export function FeedbackWidget({ contractId }: { contractId: string }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!rating || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          rating,
          comment: comment.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Could not submit feedback.')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card className="flex items-center gap-2 border-success-200 bg-success-50 p-4" role="status">
        <Check size={18} strokeWidth={1.5} className="text-success-700" aria-hidden />
        <p className="text-body-sm text-success-700">Thanks for your feedback.</p>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-body-lg text-ink">Was this review helpful?</p>

      <div className="flex items-center gap-2" role="group" aria-label="Rate this review">
        <button
          type="button"
          onClick={() => setRating('up')}
          aria-pressed={rating === 'up'}
          aria-label="Helpful"
          className={cn(
            'inline-flex items-center gap-1 rounded-button border px-3 py-2 text-body-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            rating === 'up'
              ? 'border-success-200 bg-success-50 text-success-700'
              : 'border-line text-ink hover:bg-surface',
          )}
        >
          <ThumbsUp size={18} strokeWidth={1.5} aria-hidden />
          Yes
        </button>
        <button
          type="button"
          onClick={() => setRating('down')}
          aria-pressed={rating === 'down'}
          aria-label="Not helpful"
          className={cn(
            'inline-flex items-center gap-1 rounded-button border px-3 py-2 text-body-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            rating === 'down'
              ? 'border-danger-200 bg-danger-50 text-danger-700'
              : 'border-line text-ink hover:bg-surface',
          )}
        >
          <ThumbsDown size={18} strokeWidth={1.5} aria-hidden />
          No
        </button>
      </div>

      {rating && (
        <>
          <label htmlFor="feedback-comment" className="sr-only">
            Optional comment
          </label>
          <textarea
            id="feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Tell us more (optional)"
            className="w-full resize-y rounded-input border border-line bg-white px-3 py-2 text-body-lg text-ink placeholder:text-grey-300 transition-colors duration-100 ease-out focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={submit} loading={submitting} disabled={submitting}>
              Submit feedback
            </Button>
            {error && <p className="text-body-sm text-danger-700">{error}</p>}
          </div>
        </>
      )}
    </Card>
  )
}
