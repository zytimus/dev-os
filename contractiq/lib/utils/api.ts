import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/** Standard error envelope: { error: { code, message } }. */
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export function apiJson<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

/** Known application error carrying an HTTP status + machine code. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Wraps a Route Handler so thrown HttpError / ZodError / unknown errors become
 * consistent JSON responses. Never leaks internal error details to the client.
 */
export function handleRoute<
  C extends { params: Record<string, string> } = { params: Record<string, string> },
>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      if (err instanceof HttpError) {
        return apiError(err.code, err.message, err.status)
      }
      if (err instanceof ZodError) {
        const first = err.issues[0]
        return apiError('validation_error', first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request', 400)
      }
      console.error('[route error]', err)
      return apiError('internal_error', 'Something went wrong. Please try again.', 500)
    }
  }
}
