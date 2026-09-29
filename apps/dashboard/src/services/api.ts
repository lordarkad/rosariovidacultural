type TokenGetter = () => string | null
type TokenRefresher = () => Promise<string | null>

let _getToken: TokenGetter = () => null
let _refreshToken: TokenRefresher = async () => null

export function configureApi(getter: TokenGetter, refresher: TokenRefresher): void {
  _getToken = getter
  _refreshToken = refresher
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = _getToken()
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  if (res.status === 401 && retry) {
    const refreshed = await _refreshToken()
    if (refreshed) return request<T>(path, init, false)
  }

  const body = (await res.json()) as { success: boolean; data?: T; error?: string }
  if (!body.success) throw new ApiError(res.status, body.error ?? 'Unknown error')
  return body.data as T
}

export const apiGet = <T>(path: string): Promise<T> => request<T>(path)

export const apiPost = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const apiPut = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })

export const apiDelete = <T>(path: string): Promise<T> =>
  request<T>(path, { method: 'DELETE' })
