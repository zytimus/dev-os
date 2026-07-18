import { STANDARD_TERMS, CONTRACT_TYPE_LABELS } from '@/lib/constants/terms'
import { Badge } from '@/components/ui/Badge'
import type { ContractType } from '@/types'

interface KeyTermPreviewProps {
  contractType: ContractType
  customTerms: string[]
}

/**
 * Presentational preview of the terms ContractIQ will extract for the selected
 * contract type, with any user-added custom terms appended (accent badge).
 */
export function KeyTermPreview({ contractType, customTerms }: KeyTermPreviewProps) {
  const standard = STANDARD_TERMS[contractType]

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-body-lg font-semibold text-ink">
          ContractIQ will look for these terms
        </h3>
        <p className="text-body-sm text-muted">
          Standard {CONTRACT_TYPE_LABELS[contractType]} terms plus any custom terms you add below.
        </p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {standard.map((term) => (
          <li key={term}>
            <Badge tone="neutral">{term}</Badge>
          </li>
        ))}
        {customTerms.map((term) => (
          <li key={`custom-${term}`}>
            <Badge tone="accent">
              {term}
              <span className="text-body-sm font-normal opacity-70">· Custom</span>
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
