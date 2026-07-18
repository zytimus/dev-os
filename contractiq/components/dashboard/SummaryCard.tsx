import { Card } from '@/components/ui/Card'
import { CONTRACT_TYPE_LABELS } from '@/lib/constants/terms'
import type { ContractTotals } from '@/types'

interface StatTile {
  label: string
  value: number
}

/** Dashboard summary: total processed + NDA/MSA breakdown. Server-safe (no client state). */
export function SummaryCard({ totals }: { totals: ContractTotals }) {
  const tiles: StatTile[] = [
    { label: 'Total processed', value: totals.total },
    { label: `${CONTRACT_TYPE_LABELS.nda}s`, value: totals.nda },
    { label: `${CONTRACT_TYPE_LABELS.msa}s`, value: totals.msa },
  ]

  return (
    <Card className="grid grid-cols-1 gap-px overflow-hidden bg-line sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="flex flex-col gap-1 bg-white p-6">
          <span className="text-h2 text-ink tabular-nums">{tile.value}</span>
          <span className="text-body-sm text-muted">{tile.label}</span>
        </div>
      ))}
    </Card>
  )
}
