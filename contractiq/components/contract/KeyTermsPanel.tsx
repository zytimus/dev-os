'use client'

import { useMemo } from 'react'
import { FileSearch } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { KeyTermRow } from './KeyTermRow'
import type { KeyTerm } from '@/types'

interface KeyTermsPanelProps {
  keyTerms: KeyTerm[]
  onNavigate: (page: number) => void
}

/** Renders extracted key terms — standard first, then custom. */
export function KeyTermsPanel({ keyTerms, onNavigate }: KeyTermsPanelProps) {
  const ordered = useMemo(() => {
    const standard = keyTerms.filter((t) => !t.is_custom)
    const custom = keyTerms.filter((t) => t.is_custom)
    return [...standard, ...custom]
  }, [keyTerms])

  if (ordered.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <FileSearch size={28} strokeWidth={1.5} className="text-grey-300" aria-hidden />
        <h2 className="text-body-lg text-ink">No key terms extracted</h2>
        <p className="text-body-sm text-muted">
          We could not identify any key terms for this contract.
        </p>
      </Card>
    )
  }

  return (
    <section aria-label="Key terms" className="flex flex-col gap-3">
      {ordered.map((term) => (
        <KeyTermRow key={term.id} keyTerm={term} onNavigate={onNavigate} />
      ))}
    </section>
  )
}
