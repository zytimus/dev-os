import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover disabled:bg-grey-200',
  ghost: 'bg-transparent text-ink border border-line hover:border-brand hover:bg-surface disabled:text-grey-300',
  danger: 'bg-danger-500 text-white hover:bg-danger-700 disabled:bg-danger-200',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 text-body-sm',
  md: 'px-6 py-3 text-body-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-button font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  )
})
