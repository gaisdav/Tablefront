import { ApiError, parseApiError } from '@/api/errors'

const DEFAULT_TIMEOUT_MS = 15_000

export interface RequestOptions {
  /** Entries with an undefined or empty value are left out of the URL. */
  query?: Readonly<Record<string, string | undefined>>
  /** Serialized as JSON. */
  body?: unknown
  /** Cancels the request. Cancellation rejects with the original AbortError, not an ApiError. */
  signal?: AbortSignal
  timeoutMs?: number
}

export interface HttpClientConfig {
  baseUrl: string
  timeoutMs?: number
  getToken: () => string | null
  /** Called when a request that carried a token comes back 401. */
  onUnauthorized: () => void
}

export interface HttpClient {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>
  post: <T>(path: string, options?: RequestOptions) => Promise<T>
  put: <T>(path: string, options?: RequestOptions) => Promise<T>
  patch: <T>(path: string, options?: RequestOptions) => Promise<T>
  delete: (path: string, options?: RequestOptions) => Promise<void>
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): URL {
  // Resolved against the page origin so the same code works in the browser and in jsdom tests.
  const url = new URL(`${baseUrl}${path}`, globalThis.location.href)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value)
  }
  return url
}

// The one place a response body is typed: it is trusted to match the API contract in `src/types/api.ts`.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller declares the contract type
function asResponse<T>(body: unknown): T {
  // eslint-disable-next-line no-restricted-syntax -- response shape is the API contract; only error bodies are validated
  return body as T
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  async function request(method: string, path: string, options: RequestOptions): Promise<unknown> {
    const headers = new Headers({ Accept: 'application/json' })
    const token = config.getToken()
    if (token !== null) headers.set('Authorization', `Bearer ${token}`)
    if (options.body !== undefined) headers.set('Content-Type', 'application/json')

    const timeoutSignal = AbortSignal.timeout(
      options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )
    const signal =
      options.signal === undefined
        ? timeoutSignal
        : AbortSignal.any([options.signal, timeoutSignal])

    let response: Response
    try {
      response = await fetch(buildUrl(config.baseUrl, path, options.query), {
        method,
        headers,
        signal,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
    } catch (error) {
      if (options.signal?.aborted === true) throw error
      if (timeoutSignal.aborted) {
        throw new ApiError({
          status: 0,
          code: 'timeout',
          message: 'The request timed out. Please try again.',
        })
      }
      throw new ApiError({
        status: 0,
        code: 'network_error',
        message: 'Network error. Check your connection and try again.',
      })
    }

    if (!response.ok) {
      // Only a request that sent a token can mean "session expired". A 401 without one is
      // an ordinary failure, e.g. wrong credentials on the login form.
      if (response.status === 401 && token !== null) config.onUnauthorized()
      const body: unknown = await response.json().catch(() => null)
      throw parseApiError(response.status, body)
    }

    if (response.status === 204) return undefined
    try {
      const body: unknown = await response.json()
      return body
    } catch (error) {
      if (options.signal?.aborted === true) throw error
      throw new ApiError({
        status: response.status,
        code: 'invalid_response',
        message: 'The server sent a response that could not be read.',
      })
    }
  }

  return {
    get: async <T>(path: string, options: RequestOptions = {}) =>
      asResponse<T>(await request('GET', path, options)),
    post: async <T>(path: string, options: RequestOptions = {}) =>
      asResponse<T>(await request('POST', path, options)),
    put: async <T>(path: string, options: RequestOptions = {}) =>
      asResponse<T>(await request('PUT', path, options)),
    patch: async <T>(path: string, options: RequestOptions = {}) =>
      asResponse<T>(await request('PATCH', path, options)),
    delete: async (path: string, options: RequestOptions = {}) => {
      await request('DELETE', path, options)
    },
  }
}
