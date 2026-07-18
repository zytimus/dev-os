'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ZoomIn, ZoomOut } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'

interface PdfViewerProps {
  signedUrl: string
  targetPage: number | null
  onError: () => void
}

const MIN_SCALE = 0.6
const MAX_SCALE = 2.4
const SCALE_STEP = 0.2

/** Renders a PDF from a signed URL using pdfjs-dist. Client-only. */
export function PdfViewer({ signedUrl, targetPage, onError }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1.2)
  const [highlighted, setHighlighted] = useState<number | null>(null)

  // Load + render the document. Re-runs on scale change to re-rasterise pages.
  useEffect(() => {
    let cancelled = false
    let loadingTask: { destroy?: () => void } | null = null

    async function render() {
      if (typeof window === 'undefined') return
      setLoading(true)
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

        loadingTask = pdfjs.getDocument({ url: signedUrl })
        const pdf = await (loadingTask as { promise: Promise<unknown> }).promise as {
          numPages: number
          getPage: (n: number) => Promise<{
            getViewport: (o: { scale: number }) => { width: number; height: number }
            render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
              promise: Promise<void>
            }
          }>
        }

        if (cancelled) return
        setNumPages(pdf.numPages)

        for (let n = 1; n <= pdf.numPages; n += 1) {
          if (cancelled) return
          const page = await pdf.getPage(n)
          const viewport = page.getViewport({ scale })
          const wrapper = pageRefs.current.get(n)
          if (!wrapper) continue

          const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null
          if (!canvas) continue
          const context = canvas.getContext('2d')
          if (!context) continue

          const ratio = window.devicePixelRatio || 1
          canvas.width = Math.floor(viewport.width * ratio)
          canvas.height = Math.floor(viewport.height * ratio)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          context.setTransform(ratio, 0, 0, ratio, 0, 0)

          await page.render({ canvasContext: context, viewport }).promise
        }

        if (!cancelled) setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('[PdfViewer] render failed:', err)
        onError()
      }
    }

    void render()

    return () => {
      cancelled = true
      try {
        loadingTask?.destroy?.()
      } catch {
        // ignore teardown errors
      }
    }
  }, [signedUrl, scale, onError])

  // React to targetPage: smooth-scroll + brief highlight.
  useEffect(() => {
    if (targetPage == null || numPages === 0) return
    const clamped = Math.min(Math.max(targetPage, 1), numPages)
    const el = pageRefs.current.get(clamped)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlighted(clamped)
    const timer = window.setTimeout(() => setHighlighted(null), 1600)
    return () => window.clearTimeout(timer)
  }, [targetPage, numPages])

  const setPageRef = useCallback((n: number) => (el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(n, el)
    else pageRefs.current.delete(n)
  }, [])

  // Placeholder page slots render before numPages resolves so refs exist.
  const pageSlots = numPages > 0 ? Array.from({ length: numPages }, (_, i) => i + 1) : []

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, Number((s - SCALE_STEP).toFixed(2))))}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            className="inline-flex items-center justify-center rounded-button border border-line p-1.5 text-ink transition-colors duration-150 ease-out hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-grey-300"
          >
            <ZoomOut size={16} strokeWidth={1.5} aria-hidden />
          </button>
          <span className="min-w-[3rem] text-center text-body-sm tabular-nums text-muted">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, Number((s + SCALE_STEP).toFixed(2))))}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            className="inline-flex items-center justify-center rounded-button border border-line p-1.5 text-ink transition-colors duration-150 ease-out hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-grey-300"
          >
            <ZoomIn size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-body-sm font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Download size={14} strokeWidth={1.5} aria-hidden />
          Download PDF
        </a>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-auto bg-subtle p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-subtle/70">
            <Spinner size={28} className="text-brand" />
          </div>
        )}
        <div className="flex flex-col items-center gap-4">
          {pageSlots.map((n) => (
            <div
              key={n}
              ref={setPageRef(n)}
              id={`page-${n}`}
              className={cn(
                'scroll-mt-4 rounded-card border bg-white p-2 shadow-sm transition-shadow duration-150 ease-out',
                highlighted === n ? 'border-brand ring-2 ring-brand' : 'border-line',
              )}
            >
              <div className="mb-1 text-center text-body-sm text-muted">Page {n}</div>
              <canvas className="block" aria-label={`Page ${n}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
