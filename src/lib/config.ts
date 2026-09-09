/**
 * Runtime configuration sourced from environment variables at build time.
 *
 * Vite only exposes env vars prefixed with `VITE_` to client code
 * (see https://vitejs.dev/guide/env-and-mode). The fallback values below
 * keep the app working when a variable is not provided.
 */

// ---- Supabase connection ----
// Override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local
// Note: SUPABASE_ANON_KEY accepts either the new Publishable key
// (sb_publishable_...) or the legacy anon JWT — both map to the low-privilege
// `anon`/`authenticated` roles and work with supabase-js createClient().
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://qqktniubayhipdzlsbke.supabase.co'

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  'sb_publishable_FVSX9xA51ha0XhemPYqANQ_e6lqv9lN'

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
