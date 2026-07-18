'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { StatusPill } from '@/components/ui/StatusPill'
import { CONTRACT_TYPE_LABELS } from '@/lib/constants/terms'
import { cn } from '@/lib/utils/cn'
import type { ContractSummary } from '@/types'

type SortKey = 'name' | 'type' | 'date'
type SortDir = 'asc' | 'desc'

interface Column {
  key: SortKey
  label: string
  className?: string
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'date', label: 'Date' },
]

function compare(a: ContractSummary, b: ContractSummary, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
    case 'type':
      return a.contract_type.localeCompare(b.contract_type)
    case 'date':
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ContractTable({ contracts }: { contracts: ContractSummary[] }) {
  const router = useRouter()
  // Rows arrive ordered by created_at desc from the server; default sort mirrors that.
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const rows = [...contracts]
    rows.sort((a, b) => {
      const result = compare(a, b, sortKey)
      return sortDir === 'asc' ? result : -result
    })
    return rows
  }, [contracts, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Names/types read most naturally ascending; dates newest-first.
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  function openContract(id: string) {
    router.push(`/contracts/${id}`)
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-white">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((col) => {
              const active = col.key === sortKey
              return (
                <th key={col.key} scope="col" className="px-6 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="inline-flex items-center gap-1 text-body-sm font-medium text-muted transition-colors duration-150 ease-out hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {col.label}
                    {active ? (
                      sortDir === 'asc' ? (
                        <ArrowUp size={14} strokeWidth={1.5} aria-hidden />
                      ) : (
                        <ArrowDown size={14} strokeWidth={1.5} aria-hidden />
                      )
                    ) : (
                      <ChevronsUpDown size={14} strokeWidth={1.5} className="text-grey-300" aria-hidden />
                    )}
                  </button>
                </th>
              )
            })}
            <th scope="col" className="px-6 py-3 text-body-sm font-medium text-muted">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((contract) => (
            <tr
              key={contract.id}
              onClick={() => openContract(contract.id)}
              className="cursor-pointer border-b border-line last:border-0 transition-colors duration-150 ease-out hover:bg-surface"
            >
              <td className="px-6 py-4">
                <a
                  href={`/contracts/${contract.id}`}
                  onClick={(e) => {
                    // Let the row handler own navigation; prevent double-push.
                    e.preventDefault()
                  }}
                  className="text-body-lg text-ink underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {contract.filename}
                </a>
              </td>
              <td className="px-6 py-4">
                <Badge tone="brand">{CONTRACT_TYPE_LABELS[contract.contract_type]}</Badge>
              </td>
              <td className={cn('px-6 py-4 text-body-sm text-muted tabular-nums')}>
                {formatDate(contract.created_at)}
              </td>
              <td className="px-6 py-4">
                <StatusPill status={contract.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
