'use client'

import { useEffect, type ReactNode } from 'react'
import { Card } from './Card'

/** Accessible modal: closes on Escape and backdrop click; locks body scroll. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-modal p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-h5 text-ink">{title}</h2>
        {children}
      </Card>
    </div>
  )
}
