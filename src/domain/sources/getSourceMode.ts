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
  requestPath: string
  languageCode: string
  regionCode: string
  pageSize: number
  queryRadiusM: number
  centerOffsetM: number
  maxCenters: number
}

export function isDevOrSandboxCloseoutFlow(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const path = window.location.pathname.toLowerCase()
  return path.startsWith('/dev') || path.startsWith('/sandbox')
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
    requestPath: '/api/field/text-search',
    languageCode:
      env.VITE_ID8_FIELD_LANGUAGE_CODE ?? 'en',
    regionCode:
      env.VITE_ID8_FIELD_REGION_CODE ?? 'US',
    pageSize: Number(
      env.VITE_ID8_FIELD_PAGE_SIZE ?? 8,
    ),
    queryRadiusM: Number(
      env.VITE_ID8_FIELD_QUERY_RADIUS_M ?? 3200,
    ),
    centerOffsetM: Number(
      env.VITE_ID8_FIELD_CENTER_OFFSET_M ?? 2400,
    ),
    maxCenters: Number(
      env.VITE_ID8_FIELD_MAX_CENTERS ?? 3,
    ),
  }
}

export function hasGooglePlacesConfig(): boolean {
  return false
}
