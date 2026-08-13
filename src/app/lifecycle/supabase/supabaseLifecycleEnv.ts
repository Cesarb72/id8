export type SupabaseLifecycleEnvFailureCode =
  | 'missing_env'
  | 'blank_env'
  | 'malformed_url'
  | 'unsafe_url'
  | 'malformed_origin'
  | 'mixed_project'
  | 'secret_in_browser_env'
  | 'malformed_publishable_key'
  | 'malformed_secret_key'

export interface SupabaseLifecycleEnvFailure {
  ok: false
  code: SupabaseLifecycleEnvFailureCode
  detail: string
  field: string
}

export interface SupabaseLifecycleEnvSuccess<T> {
  ok: true
  value: T
}

export type SupabaseLifecycleEnvResult<T> =
  | SupabaseLifecycleEnvSuccess<T>
  | SupabaseLifecycleEnvFailure

export interface SupabaseBrowserLifecycleConfig {
  projectUrl: string
  publishableKey: string
  appOrigin: string
  projectRef: string
  authCallbackUrl: string
}

export interface SupabaseServerLifecycleConfig {
  projectUrl: string
  publishableKey: string
  secretKey: string
  appOrigin: string
  projectRef: string
  authCallbackUrl: string
}

export type SupabaseLifecycleEnvInput = Record<string, unknown>

const BROWSER_URL_KEY = 'VITE_ID8_SUPABASE_URL'
const BROWSER_PUBLISHABLE_KEY = 'VITE_ID8_SUPABASE_PUBLISHABLE_KEY'
const BROWSER_ORIGIN_KEY = 'VITE_ID8_APP_ORIGIN'
const SERVER_URL_KEY = 'ID8_SUPABASE_URL'
const SERVER_PUBLISHABLE_KEY = 'ID8_SUPABASE_PUBLISHABLE_KEY'
const SERVER_SECRET_KEY = 'ID8_SUPABASE_SECRET_KEY'
const SERVER_ORIGIN_KEY = 'ID8_APP_ORIGIN'

function envSuccess<T>(value: T): SupabaseLifecycleEnvSuccess<T> {
  return { ok: true, value }
}

function envFailure(
  code: SupabaseLifecycleEnvFailureCode,
  field: string,
  detail: string,
): SupabaseLifecycleEnvFailure {
  return {
    ok: false,
    code,
    field,
    detail,
  }
}

function readRequiredEnv(
  input: SupabaseLifecycleEnvInput,
  field: string,
): SupabaseLifecycleEnvResult<string> {
  if (!Object.prototype.hasOwnProperty.call(input, field)) {
    return envFailure('missing_env', field, `${field} is required.`)
  }
  const value = typeof input[field] === 'string' ? input[field].trim() : ''
  if (!value) {
    return envFailure('blank_env', field, `${field} must not be blank.`)
  }
  return envSuccess(value)
}

function readOptionalEnv(input: SupabaseLifecycleEnvInput, field: string): string | null {
  const raw = input[field]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function projectRefFromUrl(projectUrl: string, field: string): SupabaseLifecycleEnvResult<string> {
  let parsed: URL
  try {
    parsed = new URL(projectUrl)
  } catch {
    return envFailure('malformed_url', field, `${field} must be a valid URL.`)
  }
  if (parsed.protocol !== 'https:') {
    return envFailure('unsafe_url', field, `${field} must use HTTPS.`)
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return envFailure('malformed_url', field, `${field} must not include credentials, query, or hash.`)
  }
  const [projectRef, ...rest] = parsed.hostname.split('.')
  if (!projectRef || rest.join('.') !== 'supabase.co') {
    return envFailure('malformed_url', field, `${field} must point at a Supabase project host.`)
  }
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    return envFailure('mixed_project', field, `${field} must expose the expected project host shape.`)
  }
  return envSuccess(projectRef)
}

function normalizeOrigin(origin: string, field: string): SupabaseLifecycleEnvResult<string> {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return envFailure('malformed_origin', field, `${field} must be a valid origin.`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return envFailure('malformed_origin', field, `${field} must use HTTP or HTTPS.`)
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    return envFailure('malformed_origin', field, `${field} must be an origin only.`)
  }
  return envSuccess(parsed.origin)
}

function authCallbackUrl(appOrigin: string): string {
  return `${appOrigin}/auth/callback`
}

function publishableKeyShapeOk(value: string): boolean {
  if (/^sb_(publishable|public)_[A-Za-z0-9_-]{20,}$/.test(value)) {
    return true
  }
  const parts = value.split('.')
  return parts.length === 3
}

function secretKeyShapeOk(value: string): boolean {
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(value)) {
    return true
  }
  const parts = value.split('.')
  return parts.length === 3
}

export function parseSupabaseBrowserLifecycleEnv(
  input: SupabaseLifecycleEnvInput,
): SupabaseLifecycleEnvResult<SupabaseBrowserLifecycleConfig> {
  for (const field of Object.keys(input)) {
    if (field.startsWith('VITE_')) {
      continue
    }
    if (readOptionalEnv(input, field)) {
      return envFailure(
        'secret_in_browser_env',
        field,
        'Browser Supabase lifecycle configuration may not receive server-only variables.',
      )
    }
  }

  const url = readRequiredEnv(input, BROWSER_URL_KEY)
  if (!url.ok) {
    return url
  }
  const publishableKey = readRequiredEnv(input, BROWSER_PUBLISHABLE_KEY)
  if (!publishableKey.ok) {
    return publishableKey
  }
  if (!publishableKeyShapeOk(publishableKey.value)) {
    return envFailure(
      'malformed_publishable_key',
      BROWSER_PUBLISHABLE_KEY,
      `${BROWSER_PUBLISHABLE_KEY} must have a publishable/public key shape.`,
    )
  }
  const origin = readRequiredEnv(input, BROWSER_ORIGIN_KEY)
  if (!origin.ok) {
    return origin
  }
  const projectRef = projectRefFromUrl(url.value, BROWSER_URL_KEY)
  if (!projectRef.ok) {
    return projectRef
  }
  const appOrigin = normalizeOrigin(origin.value, BROWSER_ORIGIN_KEY)
  if (!appOrigin.ok) {
    return appOrigin
  }

  return envSuccess({
    projectUrl: url.value,
    publishableKey: publishableKey.value,
    appOrigin: appOrigin.value,
    projectRef: projectRef.value,
    authCallbackUrl: authCallbackUrl(appOrigin.value),
  })
}

export function parseSupabaseServerLifecycleEnv(
  input: SupabaseLifecycleEnvInput,
): SupabaseLifecycleEnvResult<SupabaseServerLifecycleConfig> {
  const url = readRequiredEnv(input, SERVER_URL_KEY)
  if (!url.ok) {
    return url
  }
  const publishableKey = readRequiredEnv(input, SERVER_PUBLISHABLE_KEY)
  if (!publishableKey.ok) {
    return publishableKey
  }
  if (!publishableKeyShapeOk(publishableKey.value)) {
    return envFailure(
      'malformed_publishable_key',
      SERVER_PUBLISHABLE_KEY,
      `${SERVER_PUBLISHABLE_KEY} must have a publishable/public key shape.`,
    )
  }
  const secretKey = readRequiredEnv(input, SERVER_SECRET_KEY)
  if (!secretKey.ok) {
    return secretKey
  }
  if (!secretKeyShapeOk(secretKey.value) || secretKey.value === publishableKey.value) {
    return envFailure(
      'malformed_secret_key',
      SERVER_SECRET_KEY,
      `${SERVER_SECRET_KEY} must have a distinct server-key shape.`,
    )
  }
  const origin = readRequiredEnv(input, SERVER_ORIGIN_KEY)
  if (!origin.ok) {
    return origin
  }
  const projectRef = projectRefFromUrl(url.value, SERVER_URL_KEY)
  if (!projectRef.ok) {
    return projectRef
  }
  const appOrigin = normalizeOrigin(origin.value, SERVER_ORIGIN_KEY)
  if (!appOrigin.ok) {
    return appOrigin
  }

  const browserUrl = readOptionalEnv(input, BROWSER_URL_KEY)
  if (browserUrl && browserUrl !== url.value) {
    return envFailure('mixed_project', BROWSER_URL_KEY, 'Browser and server Supabase URLs must match.')
  }
  const browserPublishableKey = readOptionalEnv(input, BROWSER_PUBLISHABLE_KEY)
  if (browserPublishableKey && browserPublishableKey !== publishableKey.value) {
    return envFailure(
      'mixed_project',
      BROWSER_PUBLISHABLE_KEY,
      'Browser and server publishable keys must match.',
    )
  }
  const browserOrigin = readOptionalEnv(input, BROWSER_ORIGIN_KEY)
  if (browserOrigin && normalizeOrigin(browserOrigin, BROWSER_ORIGIN_KEY).ok) {
    const normalizedBrowserOrigin = normalizeOrigin(browserOrigin, BROWSER_ORIGIN_KEY)
    if (normalizedBrowserOrigin.ok && normalizedBrowserOrigin.value !== appOrigin.value) {
      return envFailure('mixed_project', BROWSER_ORIGIN_KEY, 'Browser and server app origins must match.')
    }
  }

  return envSuccess({
    projectUrl: url.value,
    publishableKey: publishableKey.value,
    secretKey: secretKey.value,
    appOrigin: appOrigin.value,
    projectRef: projectRef.value,
    authCallbackUrl: authCallbackUrl(appOrigin.value),
  })
}
