import { LIMITS } from '@/lib/constants/terms'
import { HttpError } from '@/lib/utils/api'

/**
 * Validates an uploaded file before any processing:
 * - must be present and a PDF (MIME + extension)
 * - must be within the size limit
 * Throws HttpError(400) with a specific code on failure.
 */
export function validateFileUpload(file: unknown): asserts file is File {
  if (!(file instanceof File)) {
    throw new HttpError(400, 'invalid_file', 'No file was uploaded.')
  }
  const isPdfMime = file.type === 'application/pdf'
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf')
  if (!isPdfMime || !isPdfExt) {
    throw new HttpError(400, 'invalid_file', 'Only PDF files are supported.')
  }
  if (file.size === 0) {
    throw new HttpError(400, 'invalid_file', 'The uploaded file is empty.')
  }
  if (file.size > LIMITS.MAX_FILE_BYTES) {
    throw new HttpError(
      400,
      'file_too_large',
      `File is too large. The limit is ${LIMITS.MAX_FILE_BYTES / (1024 * 1024)} MB.`,
    )
  }
}
