// Server-side PDF text extraction with [PAGE N] markers.
// Imported from the library subpath to avoid pdf-parse's debug harness that runs
// when the package is required as a module entrypoint.
// @ts-expect-error - the subpath ships no bundled type declarations
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { estimateTokens } from '@/lib/security/tokenLimiter'

export interface ExtractResult {
  text: string
  pageCount: number
  tokenCount: number
  wordCount: number
}

interface PdfTextItem {
  str: string
  transform: number[]
}
interface PdfPageData {
  getTextContent: (opts: {
    normalizeWhitespace: boolean
    disableCombineTextItems: boolean
  }) => Promise<{ items: PdfTextItem[] }>
}

/**
 * Extracts text from a text-layer PDF, prefixing each page with a `[PAGE N]`
 * marker (1-indexed). Downstream extraction + chat read this stored text; the
 * text viewer fallback parses the same markers.
 */
export async function extractText(buffer: Buffer): Promise<ExtractResult> {
  let pageIndex = 0

  const renderPage = (pageData: PdfPageData): Promise<string> => {
    pageIndex += 1
    const marker = `\n[PAGE ${pageIndex}]\n`
    return pageData
      .getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
      .then(({ items }) => {
        let lastY: number | undefined
        let text = ''
        for (const item of items) {
          const y = item.transform[5]
          if (lastY === undefined || lastY === y) {
            text += item.str
          } else {
            text += '\n' + item.str
          }
          lastY = y
        }
        return marker + text
      })
  }

  const data = await pdfParse(buffer, { pagerender: renderPage })

  const text = (data.text || '').trim()
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0
  const pageCount = data.numpages ?? pageIndex

  return {
    text,
    pageCount,
    wordCount,
    tokenCount: estimateTokens(text),
  }
}
