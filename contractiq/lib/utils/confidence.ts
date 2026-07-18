/** Confidence colour-coding per docs/engineering-doc §5 / FR-11. */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown'

export function confidenceLevel(score: number | null): ConfidenceLevel {
  if (score === null || Number.isNaN(score)) return 'unknown'
  if (score >= 0.8) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; textClass: string; bgClass: string; borderClass: string }
> = {
  high: { label: 'High', textClass: 'text-success-700', bgClass: 'bg-success-50', borderClass: 'border-success-200' },
  medium: { label: 'Medium', textClass: 'text-warning-800', bgClass: 'bg-warning-50', borderClass: 'border-warning-200' },
  low: { label: 'Low', textClass: 'text-danger-700', bgClass: 'bg-danger-50', borderClass: 'border-danger-200' },
  unknown: { label: 'Unknown', textClass: 'text-muted', bgClass: 'bg-subtle', borderClass: 'border-line' },
}

/** Formats a 0..1 score as a whole percentage, e.g. 0.91 -> "91%". */
export function formatConfidence(score: number | null): string {
  if (score === null || Number.isNaN(score)) return '—'
  return `${Math.round(score * 100)}%`
}
