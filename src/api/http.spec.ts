import { delay, http as mswHttp, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, isAbortError } from '@/api/errors'
import { createHttpClient, type HttpClientConfig } from '@/api/http'
import { server } from '@/mocks/server'

function makeClient(overrides: Partial<HttpClientConfig> = {}) {
  const onUnauthorized = vi.fn()
  const client = createHttpClient({
    baseUrl: '/api',
    getToken: () => null,
    onUnauthorized,
    ...overrides,
  })
  return { client, onUnauthorized }
}

function errorBody(code: string, message: string, fields?: Record<string, string>) {
  return { error: { code, message, ...(fields === undefined ? {} : { fields }) } }
}

/** Runs the promise and returns the rejection, failing the test if it resolves. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
}

describe('http client: success', () => {
  it('parses a JSON response', async () => {
    server.use(mswHttp.get('/api/things', () => HttpResponse.json([{ id: 'a' }])))

    const { client } = makeClient()

    expect(await client.get('/things')).toEqual([{ id: 'a' }])
  })

  it('serializes query params and skips empty ones', async () => {
    let requestedUrl = ''
    server.use(
      mswHttp.get('/api/things', ({ request }) => {
        requestedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    const { client } = makeClient()
    await client.get('/things', {
      query: { q: 'pizza margherita', categoryId: '', status: undefined },
    })

    expect(new URL(requestedUrl).search).toBe('?q=pizza+margherita')
  })

  it('sends the body as JSON', async () => {
    let received: { contentType: string | null; body: unknown } | null = null
    server.use(
      mswHttp.post('/api/things', async ({ request }) => {
        received = { contentType: request.headers.get('content-type'), body: await request.json() }
        return HttpResponse.json({ id: 'new' }, { status: 201 })
      }),
    )

    const { client } = makeClient()
    await client.post('/things', { body: { name: 'Soup' } })

    expect(received).toEqual({ contentType: 'application/json', body: { name: 'Soup' } })
  })

  it('resolves to undefined on 204', async () => {
    server.use(mswHttp.delete('/api/things/1', () => new HttpResponse(null, { status: 204 })))

    const { client } = makeClient()

    await expect(client.delete('/things/1')).resolves.toBeUndefined()
  })
})

describe('http client: auth', () => {
  it('injects the bearer token when there is one', async () => {
    let authorization: string | null = null
    server.use(
      mswHttp.get('/api/me', ({ request }) => {
        authorization = request.headers.get('authorization')
        return HttpResponse.json({})
      }),
    )

    const { client } = makeClient({ getToken: () => 'secret' })
    await client.get('/me')

    expect(authorization).toBe('Bearer secret')
  })

  it('omits the Authorization header without a token', async () => {
    let authorization: string | null = 'unset'
    server.use(
      mswHttp.get('/api/me', ({ request }) => {
        authorization = request.headers.get('authorization')
        return HttpResponse.json({})
      }),
    )

    const { client } = makeClient()
    await client.get('/me')

    expect(authorization).toBeNull()
  })

  it('calls onUnauthorized once and still rejects when an authenticated request gets 401', async () => {
    server.use(
      mswHttp.get('/api/admin/orders', () =>
        HttpResponse.json(errorBody('unauthorized', 'Session expired'), { status: 401 }),
      ),
    )

    const { client, onUnauthorized } = makeClient({ getToken: () => 'stale' })
    const error = await rejection(client.get('/admin/orders'))

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' })
  })

  it('does not treat 401 as an expired session when no token was sent (wrong login)', async () => {
    server.use(
      mswHttp.post('/api/auth/login', () =>
        HttpResponse.json(errorBody('invalid_credentials', 'Wrong email or password'), {
          status: 401,
        }),
      ),
    )

    const { client, onUnauthorized } = makeClient()
    const error = await rejection(client.post('/auth/login', { body: {} }))

    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(error).toMatchObject({ status: 401, code: 'invalid_credentials' })
  })
})

describe('http client: error responses', () => {
  it('maps 404 to an ApiError with the server code and message', async () => {
    server.use(
      mswHttp.get('/api/orders/nope', () =>
        HttpResponse.json(errorBody('not_found', 'Order not found'), { status: 404 }),
      ),
    )

    const { client } = makeClient()
    const error = await rejection(client.get('/orders/nope'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'Order not found',
      fieldErrors: {},
    })
  })

  it('exposes field errors from a 422', async () => {
    server.use(
      mswHttp.post('/api/orders', () =>
        HttpResponse.json(
          errorBody('validation_error', 'Invalid order', {
            'customer.name': 'Name is required',
            'customer.phone': 'Phone is invalid',
          }),
          { status: 422 },
        ),
      ),
    )

    const { client } = makeClient()
    const error = await rejection(client.post('/orders', { body: {} }))

    expect(error).toMatchObject({
      status: 422,
      code: 'validation_error',
      fieldErrors: { 'customer.name': 'Name is required', 'customer.phone': 'Phone is invalid' },
    })
  })

  it('maps 409 to an ApiError', async () => {
    server.use(
      mswHttp.patch('/api/admin/orders/1/status', () =>
        HttpResponse.json(errorBody('invalid_transition', 'Cannot go from ready to new'), {
          status: 409,
        }),
      ),
    )

    const { client } = makeClient()
    const error = await rejection(
      client.patch('/admin/orders/1/status', { body: { status: 'new' } }),
    )

    expect(error).toMatchObject({ status: 409, code: 'invalid_transition' })
  })

  it('falls back to a generic error when the body is not our error shape', async () => {
    server.use(mswHttp.get('/api/things', () => new HttpResponse('Bad gateway', { status: 502 })))

    const { client } = makeClient()
    const error = await rejection(client.get('/things'))

    expect(error).toMatchObject({
      status: 502,
      code: 'unknown_error',
      message: 'Request failed with status 502.',
    })
  })

  it('reports a successful response with an unreadable body as invalid_response', async () => {
    server.use(mswHttp.get('/api/things', () => new HttpResponse('<html>', { status: 200 })))

    const { client } = makeClient()
    const error = await rejection(client.get('/things'))

    expect(error).toMatchObject({ status: 200, code: 'invalid_response' })
  })
})

describe('http client: failures without a response', () => {
  it('reports a network failure as status 0', async () => {
    server.use(mswHttp.get('/api/things', () => HttpResponse.error()))

    const { client } = makeClient()
    const error = await rejection(client.get('/things'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: 'network_error' })
  })

  it('times out slow requests', async () => {
    server.use(
      mswHttp.get('/api/things', async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }),
    )

    const { client } = makeClient({ timeoutMs: 30 })
    const error = await rejection(client.get('/things'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: 'timeout' })
  })

  it('lets a per-request timeout override the client default', async () => {
    server.use(
      mswHttp.get('/api/things', async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }),
    )

    const { client } = makeClient({ timeoutMs: 60_000 })
    const error = await rejection(client.get('/things', { timeoutMs: 30 }))

    expect(error).toMatchObject({ code: 'timeout' })
  })
})

describe('http client: cancellation', () => {
  it('rejects with the AbortError, not an ApiError, when the caller aborts', async () => {
    server.use(
      mswHttp.get('/api/things', async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }),
    )

    const { client } = makeClient()
    const controller = new AbortController()
    const pending = rejection(client.get('/things', { signal: controller.signal }))
    controller.abort()
    const error = await pending

    expect(error).not.toBeInstanceOf(ApiError)
    expect(isAbortError(error)).toBe(true)
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const { client } = makeClient()

    const error = await rejection(client.get('/things', { signal: AbortSignal.abort() }))

    expect(isAbortError(error)).toBe(true)
  })
})
