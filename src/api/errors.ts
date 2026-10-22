/** `status` is 0 for failures that never produced an HTTP response (network, timeout). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Field name -> message, filled from a 422 response. */
  readonly fieldErrors: Readonly<Record<string, string>>

  constructor(init: {
    status: number
    code: string
    message: string
    fieldErrors?: Readonly<Record<string, string>>
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * A request cancelled through its AbortSignal. Callers should ignore these: they mean
 * "a newer request replaced this one", not "something went wrong".
 * Matched by name because the error comes from a DOMException that may belong to another realm.
 */
export function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError'
}

/** Builds an ApiError from a non-2xx response body, tolerating bodies that are not our error shape. */
export function parseApiError(status: number, body: unknown): ApiError {
  const error = isRecord(body) ? body.error : undefined
  if (!isRecord(error)) {
    return new ApiError({
      status,
      code: 'unknown_error',
      message: `Request failed with status ${String(status)}.`,
    })
  }

  const fieldErrors: Record<string, string> = {}
  if (isRecord(error.fields)) {
    for (const [field, message] of Object.entries(error.fields)) {
      if (typeof message === 'string') fieldErrors[field] = message
    }
  }

  return new ApiError({
    status,
    code: typeof error.code === 'string' ? error.code : 'unknown_error',
    message:
      typeof error.message === 'string'
        ? error.message
        : `Request failed with status ${String(status)}.`,
    fieldErrors,
  })
}
