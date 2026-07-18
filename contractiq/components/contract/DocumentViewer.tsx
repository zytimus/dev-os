'use client'

import { useCallback, useState } from 'react'
import { PdfViewer } from './PdfViewer'
import { TextViewerFallback } from './TextViewerFallback'
import type { Contract } from '@/types'

interface DocumentViewerProps {
  contract: Contract
  signedUrl: string | null
  targetPage: number | null
}

/**
 * Picks the PDF viewer when a signed URL is available, otherwise the text
 * fallback. If the PDF fails to render, it falls back to the text view (which
 * still offers a "Download PDF" link).
 */
export function DocumentViewer({ contract, signedUrl, targetPage }: DocumentViewerProps) {
  const [pdfFailed, setPdfFailed] = useState(false)

  const handlePdfError = useCallback(() => setPdfFailed(true), [])

  const usePdf = signedUrl && !pdfFailed

  return (
    <div className="h-full overflow-hidden rounded-card border border-line bg-white">
      {usePdf ? (
        <PdfViewer signedUrl={signedUrl} targetPage={targetPage} onError={handlePdfError} />
      ) : (
        <TextViewerFallback contract={contract} signedUrl={signedUrl} targetPage={targetPage} />
      )}
    </div>
  )
}
