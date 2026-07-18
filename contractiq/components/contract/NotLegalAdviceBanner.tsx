import { Info } from 'lucide-react'

/** Mandatory disclaimer shown on every results page (docs/specs cross-cutting). */
export function NotLegalAdviceBanner() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-card border border-warning-200 bg-warning-50 px-4 py-3 text-ink"
    >
      <Info size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning-800" aria-hidden />
      <p className="text-body-sm">
        This is an AI-assisted review tool, not legal advice. Always verify critical terms with a
        qualified lawyer.
      </p>
    </div>
  )
}
