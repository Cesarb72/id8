import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { LifecycleUserId } from '../lockedPlanLifecycleTypes'
import type { SupabaseBrowserLifecycleConfig } from './supabaseLifecycleEnv'

export type SupabaseIdentityFailureCode =
  | 'provider_error'
  | 'invalid_session'
  | 'invalid_email'
  | 'callback_not_required'

export interface SupabaseIdentityFailure {
  ok: false
  code: SupabaseIdentityFailureCode
  detail: string
}

export interface SupabaseIdentitySuccess<T> {
  ok: true
  value: T
}

export type SupabaseIdentityResult<T> =
  | SupabaseIdentitySuccess<T>
  | SupabaseIdentityFailure

export interface SupabaseAuthenticatedIdentity {
  status: 'authenticated'
  userId: LifecycleUserId
  email: string | null
}

export interface SupabaseUnauthenticatedIdentity {
  status: 'unauthenticated'
}

export type SupabaseIdentityState =
  | SupabaseAuthenticatedIdentity
  | SupabaseUnauthenticatedIdentity

export interface SupabaseAuthProviderErrorLike {
  message?: string
  name?: string
}

export interface SupabaseAuthProviderResult<T> {
  data: T
  error: SupabaseAuthProviderErrorLike | null
}

export interface SupabaseAuthSubscription {
  unsubscribe(): void
}

export interface SupabaseAuthBoundary {
  getSession(): Promise<SupabaseAuthProviderResult<{ session: Session | null }>>
  signInWithOtp(input: {
    email: string
    options: {
      emailRedirectTo: string
    }
  }): Promise<SupabaseAuthProviderResult<unknown>>
  onAuthStateChange(
    callback: (event: AuthChangeEvent | string, session: Session | null) => void,
  ): {
    data: {
      subscription: SupabaseAuthSubscription
    }
  }
  signOut(): Promise<{ error: SupabaseAuthProviderErrorLike | null }>
  exchangeCodeForSession?(
    code: string,
  ): Promise<SupabaseAuthProviderResult<{ session: Session | null }>>
}

export interface EmailAuthTransitionRequest {
  email: string
  redirectTo?: string
}

export interface SupabaseCallbackCompletionRequest {
  currentUrl: string
}

export interface SupabaseCallbackCompletion {
  status: 'completed' | 'not_required'
  identity: SupabaseIdentityState
}

export interface SupabaseIdentitySessionAdapter {
  readSession(): Promise<SupabaseIdentityResult<SupabaseIdentityState>>
  requestEmailAuthTransition(
    request: EmailAuthTransitionRequest,
  ): Promise<SupabaseIdentityResult<{ redirectTo: string }>>
  observeAuthStateChanges(
    callback: (state: SupabaseIdentityResult<SupabaseIdentityState>) => void,
  ): SupabaseAuthSubscription
  signOut(): Promise<SupabaseIdentityResult<SupabaseUnauthenticatedIdentity>>
  completeAuthCallback(
    request: SupabaseCallbackCompletionRequest,
  ): Promise<SupabaseIdentityResult<SupabaseCallbackCompletion>>
}

function identitySuccess<T>(value: T): SupabaseIdentitySuccess<T> {
  return { ok: true, value }
}

function identityFailure(
  code: SupabaseIdentityFailureCode,
  detail: string,
): SupabaseIdentityFailure {
  return { ok: false, code, detail }
}

function providerFailure(error: SupabaseAuthProviderErrorLike): SupabaseIdentityFailure {
  return identityFailure(
    'provider_error',
    error.message?.trim() || error.name?.trim() || 'Supabase Auth provider returned an error.',
  )
}

export function mapSupabaseSessionToIdentity(
  session: Session | null,
): SupabaseIdentityResult<SupabaseIdentityState> {
  if (!session) {
    return identitySuccess({ status: 'unauthenticated' })
  }
  const userId = session.user?.id?.trim()
  if (!userId) {
    return identityFailure('invalid_session', 'Supabase session did not include a stable user id.')
  }
  const email = typeof session.user.email === 'string' && session.user.email.trim()
    ? session.user.email.trim()
    : null
  return identitySuccess({
    status: 'authenticated',
    userId,
    email,
  })
}

function validateEmail(email: string): SupabaseIdentityResult<string> {
  const normalized = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return identityFailure('invalid_email', 'Email authentication requires a valid email address.')
  }
  return identitySuccess(normalized)
}

function callbackCodeFromUrl(currentUrl: string): string | null {
  try {
    const parsed = new URL(currentUrl)
    return parsed.searchParams.get('code')?.trim() || null
  } catch {
    return null
  }
}

export function createSupabaseIdentitySessionAdapter(input: {
  auth: SupabaseAuthBoundary
  config: Pick<SupabaseBrowserLifecycleConfig, 'authCallbackUrl'>
}): SupabaseIdentitySessionAdapter {
  const { auth, config } = input

  return {
    async readSession() {
      const result = await auth.getSession()
      if (result.error) {
        return providerFailure(result.error)
      }
      return mapSupabaseSessionToIdentity(result.data.session)
    },

    async requestEmailAuthTransition(request) {
      const email = validateEmail(request.email)
      if (!email.ok) {
        return email
      }
      const redirectTo = request.redirectTo ?? config.authCallbackUrl
      const result = await auth.signInWithOtp({
        email: email.value,
        options: {
          emailRedirectTo: redirectTo,
        },
      })
      if (result.error) {
        return providerFailure(result.error)
      }
      return identitySuccess({ redirectTo })
    },

    observeAuthStateChanges(callback) {
      const subscription = auth.onAuthStateChange((_event, session) => {
        callback(mapSupabaseSessionToIdentity(session))
      }).data.subscription
      return subscription
    },

    async signOut() {
      const result = await auth.signOut()
      if (result.error) {
        return providerFailure(result.error)
      }
      return identitySuccess({ status: 'unauthenticated' })
    },

    async completeAuthCallback(request) {
      const code = callbackCodeFromUrl(request.currentUrl)
      if (!code) {
        const session = await this.readSession()
        if (!session.ok) {
          return session
        }
        return identitySuccess({
          status: 'not_required',
          identity: session.value,
        })
      }
      if (!auth.exchangeCodeForSession) {
        return identityFailure(
          'callback_not_required',
          'Supabase client did not require explicit callback code exchange.',
        )
      }
      const exchanged = await auth.exchangeCodeForSession(code)
      if (exchanged.error) {
        return providerFailure(exchanged.error)
      }
      const identity = mapSupabaseSessionToIdentity(exchanged.data.session)
      if (!identity.ok) {
        return identity
      }
      return identitySuccess({
        status: 'completed',
        identity: identity.value,
      })
    },
  }
}
