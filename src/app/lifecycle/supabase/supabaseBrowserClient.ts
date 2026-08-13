import { createClient } from '@supabase/supabase-js'
import type { SupabaseBrowserLifecycleConfig } from './supabaseLifecycleEnv'
import type { SupabaseAuthBoundary } from './supabaseIdentitySession'

export interface SupabaseBrowserClientOptions {
  storage?: Storage
  fetch?: typeof fetch
}

export interface SupabaseBrowserClientBoundary {
  auth: SupabaseAuthBoundary
}

export function createSupabaseBrowserClient(
  config: SupabaseBrowserLifecycleConfig,
  options: SupabaseBrowserClientOptions = {},
): SupabaseBrowserClientBoundary {
  const client = createClient(config.projectUrl, config.publishableKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: options.storage,
    },
    global: options.fetch
      ? {
          fetch: options.fetch,
        }
      : undefined,
  })

  return {
    auth: client.auth,
  }
}
