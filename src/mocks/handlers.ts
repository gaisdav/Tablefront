import { http, HttpResponse, type PathParams } from 'msw'
import { canTransition, statusLabel } from '@/domain/orderStatus'
import { isOrderStatus, isRecord } from '@/domain/guards'
import { applyConditions } from '@/mocks/conditions'
import { db } from '@/mocks/db'
import { MOCK_ADMIN, MOCK_ADMIN_TOKEN } from '@/mocks/fixtures'
import { validateMenuItem, validateOrder } from '@/mocks/validation'
import type { ApiErrorBody, LoginResponse } from '@/types/api'

const API_BASE = '/api'

interface RouteContext {
  request: Request
  params: PathParams
}
type Resolver = (context: RouteContext) => Response | Promise<Response>

function errorResponse(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): Response {
  const body: ApiErrorBody = {
    error: { code, message, ...(fields === undefined ? {} : { fields }) },
  }
  return HttpResponse.json(body, { status })
}

const notFound = (what: string) => errorResponse(404, 'not_found', `${what} not found`)
const validationFailed = (fields: Record<string, string>) =>
  errorResponse(422, 'validation_error', 'Some fields are invalid', fields)

function isAdmin(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${MOCK_ADMIN_TOKEN}`
}

function idParam(params: PathParams): string {
  const id = params.id
  return typeof id === 'string' ? id : ''
}

/** Reads the JSON body; anything unreadable becomes `undefined` and fails validation like any bad input. */
async function readJson(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json()
    return body
  } catch {
    return undefined
  }
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** Every route goes through the simulated latency, failures and offline mode. */
function route(method: Method, path: string, resolver: Resolver) {
  return http[method](`${API_BASE}${path}`, async ({ request, params }) => {
    const failure = await applyConditions()
    return failure ?? resolver({ request, params })
  })
}

function adminRoute(method: Method, path: string, resolver: Resolver) {
  return route(method, path, (context) =>
    isAdmin(context.request)
      ? resolver(context)
      : errorResponse(401, 'unauthorized', 'Sign in to continue.'),
  )
}

export const handlers = [
  route('get', '/categories', () => HttpResponse.json(db.listCategories())),

  route('get', '/menu-items', ({ request }) => {
    const params = new URL(request.url).searchParams
    return HttpResponse.json(
      db.listMenuItems({
        categoryId: params.get('categoryId') ?? undefined,
        q: params.get('q') ?? undefined,
        // Guests only see what they can order; the admin panel needs the full list.
        includeUnavailable: isAdmin(request),
      }),
    )
  }),

  route('post', '/orders', async ({ request }) => {
    const result = validateOrder(await readJson(request), (id) => db.getMenuItem(id))
    if (!result.ok) return validationFailed(result.fields)
    return HttpResponse.json(db.createOrder(result.value), { status: 201 })
  }),

  route('get', '/orders/:id', ({ params }) => {
    const order = db.getOrder(idParam(params))
    return order === undefined ? notFound('Order') : HttpResponse.json(order)
  }),

  route('post', '/auth/login', async ({ request }) => {
    const body = await readJson(request)
    const credentials = isRecord(body) ? body : {}
    if (credentials.email !== MOCK_ADMIN.email || credentials.password !== MOCK_ADMIN.password) {
      return errorResponse(401, 'invalid_credentials', 'Wrong email or password')
    }
    const response: LoginResponse = { token: MOCK_ADMIN_TOKEN }
    return HttpResponse.json(response)
  }),

  adminRoute('get', '/admin/orders', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    if (status === null || status === '') return HttpResponse.json(db.listOrders())
    if (!isOrderStatus(status)) return validationFailed({ status: 'Unknown status' })
    return HttpResponse.json(db.listOrders(status))
  }),

  adminRoute('patch', '/admin/orders/:id/status', async ({ request, params }) => {
    const order = db.getOrder(idParam(params))
    if (order === undefined) return notFound('Order')

    const body = await readJson(request)
    const status = isRecord(body) ? body.status : undefined
    if (!isOrderStatus(status)) return validationFailed({ status: 'Unknown status' })

    if (!canTransition(order.status, status, order.fulfillment)) {
      const kind = order.fulfillment === 'delivery' ? 'A delivery' : 'A pickup'
      return errorResponse(
        409,
        'invalid_transition',
        `${kind} that is ${statusLabel(order.status).toLowerCase()} cannot become ${statusLabel(status).toLowerCase()}`,
      )
    }
    return HttpResponse.json(db.setOrderStatus(order.id, status))
  }),

  adminRoute('post', '/admin/menu-items', async ({ request }) => {
    const result = validateMenuItem(await readJson(request), (id) => db.hasCategory(id))
    if (!result.ok) return validationFailed(result.fields)
    return HttpResponse.json(db.createMenuItem(result.value), { status: 201 })
  }),

  adminRoute('put', '/admin/menu-items/:id', async ({ request, params }) => {
    const id = idParam(params)
    if (db.getMenuItem(id) === undefined) return notFound('Menu item')

    const result = validateMenuItem(await readJson(request), (categoryId) =>
      db.hasCategory(categoryId),
    )
    if (!result.ok) return validationFailed(result.fields)
    return HttpResponse.json(db.replaceMenuItem(id, result.value))
  }),

  adminRoute('delete', '/admin/menu-items/:id', ({ params }) =>
    db.deleteMenuItem(idParam(params))
      ? new HttpResponse(null, { status: 204 })
      : notFound('Menu item'),
  ),
]
