/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (optional - falls back to the built-in demo project) */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key (optional - falls back to the built-in demo project) */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Whether the one-click local login is enabled. Defaults to 'true' */
  readonly VITE_LOCAL_LOGIN_ENABLED?: string
  /** Email used by the one-click local login */
  readonly VITE_LOCAL_LOGIN_EMAIL?: string
  /** Password used by the one-click local login */
  readonly VITE_LOCAL_LOGIN_PASSWORD?: string
  /** Display name used when auto-creating the local login user */
  readonly VITE_LOCAL_LOGIN_FULL_NAME?: string
  /** Role of the local login user: 'student' | 'admin'. Defaults to 'student' */
  readonly VITE_LOCAL_LOGIN_ROLE?: string
  /** Grade level of the local login user. Defaults to 4 */
  readonly VITE_LOCAL_LOGIN_GRADE_LEVEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
