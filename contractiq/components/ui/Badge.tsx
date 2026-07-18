import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral'

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 border-brand-200 text-brand-700',
  success: 'bg-success-50 border-success-200 text-success-700',
  warning: 'bg-warning-50 border-warning-200 text-warning-800',
  danger: 'bg-danger-50 border-danger-200 text-danger-700',
  accent: 'bg-accent-50 border-accent-200 text-accent-700',
  neutral: 'bg-subtle border-line text-muted',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

/** Semantic status badge (docs/design.md "Semantic Status Badge" pattern). */
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-tag border px-2 py-0.5 text-body-sm font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  )
}
