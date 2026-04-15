import type { SourceMode } from '../types/sourceMode'

const sourceModes = new Set<SourceMode>(['curated', 'live', 'hybrid'])

function parseSourceMode(value: string | null | undefined): SourceMode | undefined {
  if (!value) {
    return undefined
  }
  return sourceModes.has(value as SourceMode) ? (value as SourceMode) : undefined
}

export interface SourceModeResolution {
  requestedSourceMode: SourceMode
  overrideApplied: boolean
}

export interface GooglePlacesConfig {
  apiKey?: string
  endpoint: string
  languageCode: string
  regionCode: string
  pageSize: number
  queryRadiusM: number
  centerOffsetM: number
  maxCenters: number
}

function getProcessEnvValue(key: string): string | undefined {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env
  return processEnv?.[key]
}

export function getSourceMode(input?: {
  debugMode?: boolean
  search?: string
}): SourceModeResolution {
  const envMode = parseSourceMode(import.meta.env.VITE_ID8_SOURCE_MODE)
  const params = new URLSearchParams(
    input?.search ??
      (typeof window !== 'undefined' ? window.location.search : ''),
  )
  const debugMode = input?.debugMode ?? params.get('debug') === '1'
  const queryMode = debugMode ? parseSourceMode(params.get('sourceMode')) : undefined

  return {
    requestedSourceMode: queryMode ?? envMode ?? 'curated',
    overrideApplied: Boolean(queryMode),
  }
}

export function getGooglePlacesConfig(): GooglePlacesConfig {
  const env = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env ?? {}
  return {
    apiKey: env.VITE_GOOGLE_PLACES_API_KEY ?? getProcessEnvValue('VITE_GOOGLE_PLACES_API_KEY'),
    endpoint:
      env.VITE_GOOGLE_PLACES_ENDPOINT ??
      getProcessEnvValue('VITE_GOOGLE_PLACES_ENDPOINT') ??
      'https://places.googleapis.com/v1/places:searchText',
    languageCode:
      env.VITE_GOOGLE_PLACES_LANGUAGE_CODE ??
      getProcessEnvValue('VITE_GOOGLE_PLACES_LANGUAGE_CODE') ??
      'en',
    regionCode:
      env.VITE_GOOGLE_PLACES_REGION_CODE ??
      getProcessEnvValue('VITE_GOOGLE_PLACES_REGION_CODE') ??
      'US',
    pageSize: Number(
      env.VITE_GOOGLE_PLACES_PAGE_SIZE ??
        getProcessEnvValue('VITE_GOOGLE_PLACES_PAGE_SIZE') ??
        8,
    ),
    queryRadiusM: Number(
      env.VITE_GOOGLE_PLACES_QUERY_RADIUS_M ??
        getProcessEnvValue('VITE_GOOGLE_PLACES_QUERY_RADIUS_M') ??
        3200,
    ),
    centerOffsetM: Number(
      env.VITE_GOOGLE_PLACES_CENTER_OFFSET_M ??
        getProcessEnvValue('VITE_GOOGLE_PLACES_CENTER_OFFSET_M') ??
        2400,
    ),
    maxCenters: Number(
      env.VITE_GOOGLE_PLACES_MAX_CENTERS ??
        getProcessEnvValue('VITE_GOOGLE_PLACES_MAX_CENTERS') ??
        3,
    ),
  }
}

export function hasGooglePlacesConfig(): boolean {
  return Boolean(getGooglePlacesConfig().apiKey)
}
