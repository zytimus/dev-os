import type { ReactNode } from 'react'

/**
 * Accessible CSS tooltip — appears on hover and keyboard focus (focus-within),
 * no JS required. Used for confidence warnings and jargon explanations.
 */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="group relative inline-flex focus-within:z-10">
      <span tabIndex={0} className="inline-flex cursor-help outline-none">
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-button border border-line bg-ink px-3 py-2 text-body-sm text-white opacity-0 shadow-sm transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}
