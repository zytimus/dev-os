'use client'

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { cn } from '@/lib/utils/cn'
import { LIMITS } from '@/lib/constants/terms'
import { Spinner } from '@/components/ui/Spinner'

interface PdfDropzoneProps {
  onFile: (file: File) => void
  disabled?: boolean
  uploading?: boolean
  /** Server-side error message from a failed upload attempt. */
  error?: string | null
}

const MAX_MB = LIMITS.MAX_FILE_BYTES / (1024 * 1024)

/** Client-side pre-check mirroring the server validateFileUpload rules. */
function preCheck(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return 'Only PDF files are supported.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > LIMITS.MAX_FILE_BYTES) return `File is too large. The limit is ${MAX_MB} MB.`
  return null
}

export function PdfDropzone({ onFile, disabled = false, uploading = false, error }: PdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const interactive = !disabled && !uploading

  function handleFiles(files: FileList | null) {
    setLocalError(null)
    const file = files?.[0]
    if (!file) return
    const err = preCheck(file)
    if (err) {
      setSelectedName(null)
      setLocalError(err)
      return
    }
    setSelectedName(file.name)
    onFile(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    if (!interactive) return
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (interactive) setDragActive(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
    // Allow re-selecting the same file after an error.
    e.target.value = ''
  }

  function openPicker() {
    if (interactive) inputRef.current?.click()
  }

  const shownError = localError ?? error ?? null

  return (
    <div className="flex w-full flex-col gap-2">
      <div
        role="button"
        tabIndex={interactive ? 0 : -1}
        aria-disabled={!interactive}
        aria-label="Upload a PDF contract"
        onClick={openPicker}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && interactive) {
            e.preventDefault()
            openPicker()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 ease-out',
          interactive ? 'cursor-pointer' : 'cursor-not-allowed opacity-70',
          dragActive ? 'border-brand bg-brand-50' : 'border-line bg-white',
          shownError && !dragActive ? 'border-danger-500' : '',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={handleChange}
          disabled={!interactive}
        />

        {uploading ? (
          <div className="flex items-center gap-2 text-brand">
            <Spinner size={20} />
            <span className="text-body-lg font-medium">Uploading & extracting text…</span>
          </div>
        ) : selectedName ? (
          <div className="flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-tag border border-line bg-subtle px-3 py-1 text-body-sm font-medium text-ink">
              {selectedName}
            </span>
            <span className="text-body-sm text-muted">Choose a different file to replace it.</span>
          </div>
        ) : (
          <>
            <p className="text-body-lg font-medium text-ink">
              Drag & drop your PDF here, or{' '}
              <span className="text-brand">browse</span>
            </p>
            <p className="text-body-sm text-muted">Text-based PDF · up to {MAX_MB} MB · up to {LIMITS.MAX_PAGES} pages</p>
          </>
        )}
      </div>

      {shownError && (
        <p role="alert" className="text-body-sm text-danger-700">
          {shownError}
        </p>
      )}
    </div>
  )
}
