import type { ContractStatus } from '@/types'
import { Badge } from './Badge'

const STATUS_META: Record<ContractStatus, { tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  uploaded: { tone: 'neutral', label: 'Uploaded' },
  processing: { tone: 'warning', label: 'Processing' },
  complete: { tone: 'success', label: 'Complete' },
  error: { tone: 'danger', label: 'Error' },
}

export function StatusPill({ status }: { status: ContractStatus }) {
  const meta = STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}
