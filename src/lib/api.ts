/**
 * 自建后端 API 客户端（替代原 Supabase 客户端）。
 *
 * - 会话（JWT + 用户基本信息）持久化在 localStorage，跨刷新保持登录；
 * - 所有请求自动携带 Authorization: Bearer <token>；
 * - 统一抛出 ApiError，携带 HTTP status 与服务端 message。
 */

import { API_BASE_URL } from './config'

const AUTH_SESSION_KEY = 'vocabquest:auth'

export interface AuthSession {
  token: string
  user: {
    id: string
    email: string
    full_name?: string
    role?: string
    created_at?: string
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function readAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.token && parsed?.user?.id ? (parsed as AuthSession) : null
  } catch {
    return null
  }
}

export function writeAuthSession(session: AuthSession) {
  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  } catch (error) {
    console.warn('[api] unable to persist auth session:', error)
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY)
  } catch {
    // ignore
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const session = readAuthSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const errorBody = await response.json()
      const serverMessage = errorBody?.message
      message = Array.isArray(serverMessage)
        ? serverMessage.join(', ')
        : serverMessage || message
    } catch {
      // keep default message
    }

    // Token 失效：清理本地会话，强制重新登录
    if (response.status === 401) {
      clearAuthSession()
    }

    throw new ApiError(response.status, message)
  }

  return response.json()
}
