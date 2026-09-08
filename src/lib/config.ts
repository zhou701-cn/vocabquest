/**
 * Runtime configuration sourced from environment variables at build time.
 *
 * Vite only exposes env vars prefixed with `VITE_` to client code
 * (see https://vitejs.dev/guide/env-and-mode). The fallback values below
 * keep the app working when a variable is not provided.
 */

// ---- Supabase connection ----
// Override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://zxxkutexabspjiwghsvn.supabase.co'

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eGt1dGV4YWJzcGppd2doc3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3OTYwNzMsImV4cCI6MjA2ODM3MjA3M30.us8-BQW50RsdhMfMtTPnTshexKBBv7qisCB6sSQEMQk'

// ---- Local one-click login (本地一键登录) ----
// Whether the "local login" button is shown on the auth page.
// Enabled by default; set VITE_LOCAL_LOGIN_ENABLED=false to disable it.
export const LOCAL_LOGIN_ENABLED =
  (import.meta.env.VITE_LOCAL_LOGIN_ENABLED ?? 'true').trim().toLowerCase() !== 'false'

// Credentials used by the one-click local login. Keep them in .env.local
// (never commit real secrets). When no user exists yet for this email the
// sign-in flow will try to register it automatically (see AuthContext).
export const LOCAL_LOGIN_EMAIL = import.meta.env.VITE_LOCAL_LOGIN_EMAIL?.trim() || ''
export const LOCAL_LOGIN_PASSWORD = import.meta.env.VITE_LOCAL_LOGIN_PASSWORD || ''

// Profile used when the local login user is created on the fly.
export const LOCAL_LOGIN_FULL_NAME =
  import.meta.env.VITE_LOCAL_LOGIN_FULL_NAME?.trim() || 'Demo Student'
export const LOCAL_LOGIN_ROLE: 'student' | 'admin' =
  import.meta.env.VITE_LOCAL_LOGIN_ROLE?.trim() === 'admin' ? 'admin' : 'student'
export const LOCAL_LOGIN_GRADE_LEVEL = Number(import.meta.env.VITE_LOCAL_LOGIN_GRADE_LEVEL) || 4
