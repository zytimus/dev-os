import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { confidenceLevel, CONFIDENCE_META, formatConfidence } from '@/lib/utils/confidence'
import { cn } from '@/lib/utils/cn'

const LOW_CONFIDENCE_HINT =
  'Low confidence — we recommend verifying this in the document directly.'

/**
 * Confidence indicator: shows the % with the level colour. Low-confidence terms
 * also carry a warning icon + non-dismissible tooltip. Uses icon AND colour so
 * meaning is not conveyed by colour alone (WCAG).
 */
export function ConfidenceBadge({ score }: { score: number | null }) {
  const level = confidenceLevel(score)
  const meta = CONFIDENCE_META[level]
  const label = formatConfidence(score)

  const badge = (
    <Badge
      className={cn('border', meta.textClass, meta.bgClass, meta.borderClass)}
      aria-label={`Confidence: ${meta.label} (${label})`}
    >
      {level === 'low' && (
        <AlertTriangle size={14} strokeWidth={2} aria-hidden className="shrink-0" />
      )}
      <span className="tabular-nums">{label}</span>
      <span className="sr-only">{meta.label} confidence</span>
    </Badge>
  )

  if (level === 'low') {
    return <Tooltip content={LOW_CONFIDENCE_HINT}>{badge}</Tooltip>
  }

  return badge
}
