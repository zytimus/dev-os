import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
  ref,
) {
  const inputId = id || props.name
  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-body-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={cn(
          'w-full rounded-input border bg-white px-3 py-2 text-body-lg text-ink placeholder:text-grey-300 transition-colors duration-100 ease-out focus:outline-none focus:ring-2 focus:ring-brand',
          error ? 'border-danger-500' : 'border-line',
          className,
        )}
        {...props}
      />
      {error && <p className="text-body-sm text-danger-700">{error}</p>}
    </div>
  )
})
