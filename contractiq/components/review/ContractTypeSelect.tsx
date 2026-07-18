'use client'

import { cn } from '@/lib/utils/cn'
import { CONTRACT_TYPE_LABELS } from '@/lib/constants/terms'
import type { ContractType } from '@/types'

interface ContractTypeSelectProps {
  value: ContractType | null
  onChange: (value: ContractType) => void
  disabled?: boolean
}

const OPTIONS: ContractType[] = ['nda', 'msa']

const DESCRIPTIONS: Record<ContractType, string> = {
  nda: 'Non-Disclosure Agreement',
  msa: 'Master Service Agreement',
}

/** Segmented control for choosing the contract type (required before upload). */
export function ContractTypeSelect({ value, onChange, disabled = false }: ContractTypeSelectProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Contract type"
      className="grid grid-cols-2 gap-3"
    >
      {OPTIONS.map((type) => {
        const selected = value === type
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(type)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-card border px-4 py-3 text-left transition-colors duration-150 ease-out',
              'focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60',
              selected
                ? 'border-brand bg-brand-50'
                : 'border-line bg-white hover:border-brand',
            )}
          >
            <span className={cn('text-body-lg font-semibold', selected ? 'text-brand-700' : 'text-ink')}>
              {CONTRACT_TYPE_LABELS[type]}
            </span>
            <span className="text-body-sm text-muted">{DESCRIPTIONS[type]}</span>
          </button>
        )
      })}
    </div>
  )
}
