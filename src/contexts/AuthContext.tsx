import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  LOCAL_LOGIN_ENABLED,
  LOCAL_LOGIN_EMAIL,
  LOCAL_LOGIN_FULL_NAME,
  LOCAL_LOGIN_ROLE,
  LOCAL_LOGIN_GRADE_LEVEL,
} from '@/lib/config'
import { User, UserGamification } from '@/types'
import { hydratePoemStoresFromDb, resetPoemHydration } from '@/lib/poemSync'
import toast from 'react-hot-toast'

interface AuthContextType {
  user: SupabaseUser | null
  profile: User | null
  gamification: UserGamification | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string) => Promise<any>
  localSignIn: () => Promise<any>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  refreshProfile: () => Promise<void>
  initializeUser: (profileData: Partial<User>, targetUserId?: string) => Promise<any>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ---------------------------------------------------------------------------
// Local demo mode (绕过接口的本地一键登录)
// ---------------------------------------------------------------------------
// When the Supabase auth API is unreachable or the demo account cannot be
// created, the "Continue as Demo Student" button falls back to a purely local
// session: no network request is made at all. The session is persisted in
// localStorage so the demo user stays signed in across page reloads.
const DEMO_SESSION_KEY = 'vocabquest:demo-session'
// Stable demo user id (valid UUID format so DB queries that use it keep working).
const DEMO_USER_ID = '00000000-0000-4000-8000-00000000d001'

interface DemoSession {
  user: SupabaseUser
  profile: User
  gamification: UserGamification
}

function buildDemoSession(): DemoSession {
  const email = LOCAL_LOGIN_EMAIL || 'demo.student@example.com'
  const fullName = LOCAL_LOGIN_FULL_NAME || 'Demo Student'
  const now = new Date().toISOString()

  const user = {
    id: DEMO_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'local', providers: ['local'] },
    user_metadata: { full_name: fullName, role: LOCAL_LOGIN_ROLE },
    identities: [],
    created_at: now,
    updated_at: now,
  } as unknown as SupabaseUser

  const profile: User = {
    id: DEMO_USER_ID,
    email,
    full_name: fullName,
    role: LOCAL_LOGIN_ROLE,
    grade_level: LOCAL_LOGIN_GRADE_LEVEL,
    preferences: {},
    created_at: now,
    updated_at: now,
    last_active: now,
    is_active: true,
  }

  const gamification: UserGamification = {
    id: DEMO_USER_ID,
    user_id: DEMO_USER_ID,
    total_points: 0,
    current_level: 1,
    current_xp: 0,
    xp_to_next_level: 100,
    current_streak: 0,
    longest_streak: 0,
    words_learned: 0,
    total_time_minutes: 0,
    achievements_earned: 0,
    created_at: now,
    updated_at: now,
  }

  return { user, profile, gamification }
}

function readDemoSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.user && parsed?.profile ? (parsed as DemoSession) : null
  } catch {
    return null
  }
}

function writeDemoSession(session: DemoSession) {
  try {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session))
  } catch (error) {
    console.warn('[demo] unable to persist demo session:', error)
  }
}

function clearDemoSession() {
  try {
    localStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    // ignore
  }
}

function isDemoSessionActive(): boolean {
  return readDemoSession() !== null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [gamification, setGamification] = useState<UserGamification | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Request deduplication: track ongoing profile requests by userId
  const ongoingRequests = useRef<Map<string, Promise<any>>>(new Map())
  
  // Profile data cache: store profile data in memory to avoid redundant API calls
  const profileCache = useRef<Map<string, { profile: User; gamification: UserGamification; timestamp: number }>>(new Map())

  // Load user on mount
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    // Demo mode: restore the local session without touching the network at all.
    const demoSession = readDemoSession()
    if (demoSession) {
      console.log('[auth] demo session restored from localStorage')
      setUser(demoSession.user)
      setProfile(demoSession.profile)
      setGamification(demoSession.gamification)
      setLoading(false)
      return
    }

    async function loadUser() {
      try {
        // Set a safety timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          console.warn('Auth loading timeout - forcing loading to false')
          setLoading(false)
        }, 5000) // 5 seconds timeout
        
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          await loadUserProfile(user.id)
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        clearTimeout(timeoutId)
        setLoading(false)
      }
    }
    
    loadUser()

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null
        setUser(currentUser)
        
        if (currentUser) {
          setLoading(true)
          try {
            await loadUserProfile(currentUser.id)
          } finally {
            setLoading(false)
          }
        } else {
          setProfile(null)
          setGamification(null)
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const loadUserProfile = async (userId: string) => {
    // Demo mode: everything is already in local state, skip the network call.
    if (userId === DEMO_USER_ID && isDemoSessionActive()) {
      const demoSession = readDemoSession()
      if (demoSession) {
        setProfile(demoSession.profile)
        setGamification(demoSession.gamification)
      }
      return
    }

    // 真实登录用户：水合诗词数据（本地→库一次性迁移 + 从库拉取，覆盖本地）
    void hydratePoemStoresFromDb(userId)

    // Check cache first - if data exists and is less than 5 minutes old, use it
    const cached = profileCache.current.get(userId)
    const now = Date.now()
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('Using cached profile data for user:', userId)
      setProfile(cached.profile)
      setGamification(cached.gamification)
      return
    }

    // Check if there's already an ongoing request for this user
    const existingRequest = ongoingRequests.current.get(userId)
    if (existingRequest) {
      console.log('Profile request already in progress for user:', userId)
      return existingRequest
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        console.log('Loading user profile for:', userId)
        
        // Use direct fetch instead of supabase.functions.invoke (which hangs)
        // Use the anon key for now - the function will extract user ID from the request context
        const response = await fetch(`${SUPABASE_URL}/functions/v1/user-profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'X-User-ID': userId // Pass the user ID directly
          }
        })

        const data = await response.json()
        const error = response.ok ? null : new Error(`HTTP ${response.status}`)

        if (error) {
          console.error('Error loading user profile:', error)
          // Don't throw error, just log it - user can still use the app
          return
        }

        if (data?.data) {
          const profileData = {
            profile: data.data.profile,
            gamification: data.data.gamification,
            timestamp: now
          }
          
          // Cache the data
          profileCache.current.set(userId, profileData)
          
          // Set the state
          setProfile(profileData.profile)
          setGamification(profileData.gamification)
          
          console.log('Profile loaded and cached for user:', userId)
        }
      } catch (error) {
        console.error('Error loading user profile:', error)
        // Don't throw error, just log it - user can still use the app
      } finally {
        // Remove the request from ongoing requests
        ongoingRequests.current.delete(userId)
      }
    })()

    // Store the request promise
    ongoingRequests.current.set(userId, requestPromise)
    
    return requestPromise
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      toast.error(error.message)
      throw error
    }

    toast.success('Welcome back!')
    return data
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.protocol}//${window.location.host}/auth/callback`
      }
    })

    if (error) {
      toast.error(error.message)
      throw error
    }

    toast.success('Check your email to confirm your account!')
    return data
  }

  /**
   * One-click local/demo login that completely bypasses the auth API.
   * The user/session is created locally (in memory + localStorage) so the
   * login works even when the Supabase auth endpoint is unreachable.
   */
  const localSignIn = async () => {
    if (!LOCAL_LOGIN_ENABLED) {
      toast.error('Local login is disabled')
      throw new Error('Local login is disabled')
    }

    console.log('[localSignIn] bypassing auth API - creating local demo session')

    const demoSession = buildDemoSession()
    writeDemoSession(demoSession)

    setUser(demoSession.user)
    setProfile(demoSession.profile)
    setGamification(demoSession.gamification)

    toast.success(`Welcome, ${demoSession.profile.full_name}!`)
    return { user: demoSession.user, session: null }
  }

  const signOut = async () => {
    // Demo mode: just clear the local session (no network call, the auth
    // API may be unreachable which would otherwise block sign-out).
    if (isDemoSessionActive()) {
      clearDemoSession()
      ongoingRequests.current.clear()
      profileCache.current.clear()
      resetPoemHydration()
      setUser(null)
      setProfile(null)
      setGamification(null)
      toast.success('Signed out successfully')
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
      throw error
    }
    
    // Clear ongoing requests, cache, and reset state
    ongoingRequests.current.clear()
    profileCache.current.clear()
    resetPoemHydration()
    setUser(null)
    setProfile(null)
    setGamification(null)
    toast.success('Signed out successfully')
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) {
      throw new Error('No user logged in')
    }

    // Demo mode: update the local profile only (no database access).
    if (user.id === DEMO_USER_ID && isDemoSessionActive()) {
      const demoSession = readDemoSession()
      if (demoSession) {
        const updatedProfile: User = {
          ...demoSession.profile,
          ...updates,
          updated_at: new Date().toISOString(),
        }
        const updatedSession = { ...demoSession, profile: updatedProfile }
        writeDemoSession(updatedSession)
        setProfile(updatedProfile)
        toast.success('Profile updated successfully!')
      }
      return
    }

    try {
      // Update profile directly in the database
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Database error updating profile:', error)
        toast.error('Failed to update profile')
        throw error
      }

      if (data) {
        // Update local state
        setProfile(data)
        // Clear cache to force refresh on next load
        profileCache.current.delete(user.id)
        toast.success('Profile updated successfully!')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  const refreshProfile = async () => {
    if (user) {
      // Clear cache and ongoing request for this user to force a fresh request
      profileCache.current.delete(user.id)
      ongoingRequests.current.delete(user.id)
      await loadUserProfile(user.id)
    }
  }

  const initializeUser = async (profileData: Partial<User>, targetUserId?: string) => {
    // Demo mode: no server initialization needed - profile is managed locally.
    if ((targetUserId || user?.id) === DEMO_USER_ID && isDemoSessionActive()) {
      return { data: { is_new_user: false } }
    }

    try {
      // Resolve the target user id explicitly: the React state may not have
      // been updated yet right after a sign-in, so prefer the passed id.
      const currentUserId = targetUserId || user?.id
      if (!currentUserId) {
        throw new Error('No user logged in')
      }

      // Use direct fetch instead of supabase.functions.invoke (which hangs)
      // Use the anon key and pass user ID in header
      const response = await fetch(`${SUPABASE_URL}/functions/v1/user-initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId // Pass the user ID directly
        },
        body: JSON.stringify(profileData)
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Error initializing user:', data)
        throw new Error(`HTTP ${response.status}: ${data.message || 'Unknown error'}`)
      }

      if (data?.data?.is_new_user) {
        // Clear cache to force reload of profile data
        profileCache.current.delete(currentUserId)
        await loadUserProfile(currentUserId)
        toast.success('Welcome! Your account has been set up.')
      }

      return data
    } catch (error) {
      console.error('Error initializing user:', error)
      throw error
    }
  }

  const value: AuthContextType = {
    user,
    profile,
    gamification,
    loading,
    signIn,
    signUp,
    localSignIn,
    signOut,
    updateProfile,
    refreshProfile,
    initializeUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}