'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { Contract } from '@/types'
import { cn } from '@/lib/utils/cn'

interface TextViewerFallbackProps {
  contract: Contract
  signedUrl: string | null
  targetPage: number | null
}

interface PageSection {
  page: number
  text: string
}

/** Splits contract_text on `[PAGE N]` markers into labelled page sections. */
function parsePages(text: string): PageSection[] {
  if (!text) return []
  const regex = /\[PAGE\s+(\d+)\]/gi
  const sections: PageSection[] = []
  const matches = [...text.matchAll(regex)]

  if (matches.length === 0) {
    return [{ page: 1, text: text.trim() }]
  }

  matches.forEach((match, i) => {
    const page = parseInt(match[1], 10)
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length
    sections.push({ page, text: text.slice(start, end).trim() })
  })

  return sections
}

export function TextViewerFallback({ contract, signedUrl, targetPage }: TextViewerFallbackProps) {
  const pages = useMemo(() => parsePages(contract.contract_text), [contract.contract_text])
  const containerRef = useRef<HTMLDivElement>(null)
  const [highlighted, setHighlighted] = useState<number | null>(null)

  useEffect(() => {
    if (targetPage == null) return
    const el = document.getElementById(`page-${targetPage}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlighted(targetPage)
    const timer = window.setTimeout(() => setHighlighted(null), 1600)
    return () => window.clearTimeout(timer)
  }, [targetPage])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="text-body-sm text-muted">Text view</span>
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-body-sm font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Download size={14} strokeWidth={1.5} aria-hidden />
            Download PDF
          </a>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {pages.length === 0 ? (
          <p className="text-body-sm text-muted">No document text available.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {pages.map((section) => (
              <div
                key={section.page}
                id={`page-${section.page}`}
                className={cn(
                  'scroll-mt-4 rounded-card border bg-white p-4 transition-shadow duration-150 ease-out',
                  highlighted === section.page ? 'border-brand ring-2 ring-brand' : 'border-line',
                )}
              >
                <div className="mb-2 text-body-sm font-medium text-muted">Page {section.page}</div>
                <p className="whitespace-pre-wrap text-body-sm leading-relaxed text-ink">
                  {section.text || '(no text on this page)'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
