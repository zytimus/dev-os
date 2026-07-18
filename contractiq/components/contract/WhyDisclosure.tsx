'use client'

import { useId, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/** Expandable "Why?" that reveals the verbatim source sentence for a key term. */
export function WhyDisclosure({ sentence }: { sentence: string | null }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex w-fit items-center gap-1 text-body-sm font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Why?
        {open ? (
          <ChevronUp size={14} strokeWidth={1.5} aria-hidden />
        ) : (
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className={cn('rounded-card border border-line bg-subtle px-3 py-2 text-body-sm')}
        >
          {sentence ? (
            <p className="italic text-muted">“{sentence}”</p>
          ) : (
            <p className="text-muted">No source sentence available</p>
          )}
        </div>
      )}
    </div>
  )
}
