export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  createdAt: string
}

interface AuthResponse {
  user: AuthUser
  token: string
  expiresAt: string
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    fields?: Record<string, string>
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api').replace(/\/$/, '')
const TOKEN_KEY = 'fieldnote.accessToken'

export class ApiError extends Error {
  code?: string
  fields?: Record<string, string>
  status: number

  constructor(message: string, status: number, code?: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function hasSession() {
  return Boolean(getToken())
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function apiRequest<T>(path: string, init: RequestInit = {}, includeAuth = true): Promise<T> {
  const headers = new Headers(init.headers)
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (init.body && !isFormDataBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const token = includeAuth ? getToken() : null
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Could not connect to the API. Check that the backend is running.', 0)
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null) as ApiErrorBody | T | null
  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null
    if (response.status === 401 && includeAuth) clearSession()
    throw new ApiError(
      errorBody?.error?.message || `Request failed (${response.status})`,
      response.status,
      errorBody?.error?.code,
      errorBody?.error?.fields,
    )
  }

  return body as T
}

export async function authenticate(mode: 'login' | 'register', input: { email: string; password: string; displayName?: string }) {
  const result = await apiRequest<AuthResponse>(`/auth/${mode}`, {
    method: 'POST',
    body: JSON.stringify(input),
  }, false)

  if (mode === 'login') sessionStorage.setItem(TOKEN_KEY, result.token)
  return result.user
}

export function getCurrentUser() {
  return apiRequest<AuthUser>('/auth/me')
}

export function apiFetch<T>(path: string, init: RequestInit = {}) {
  return apiRequest<T>(path, init)
}