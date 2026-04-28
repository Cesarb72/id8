import { isDevOrSandboxCloseoutFlow } from '../sources/getSourceMode'
import type { VenueSourceMetadata } from '../types/normalization'
import type {
  FieldGovernanceRuntimeMode,
  ProviderAuthorityClass,
  SourceMode,
} from '../types/sourceMode'

type FieldSourceModePolicy = {
  autoUpgradeCuratedToHybrid: boolean
  allowCuratedFallbackWithoutCoverage: boolean
  allowDefaultCityFallbackWhenNoExactMatch: boolean
  defaultFallbackCity: string
}

type FieldCityRetrievalPolicy = {
  authorityTargets: string[]
  sourceMode: FieldSourceModePolicy
}

export interface FieldGovernancePolicy {
  runtimeMode: FieldGovernanceRuntimeMode
  allowCuratedFallback: boolean
  allowBootstrapFallback: boolean
  allowDefaultCityFallback: boolean
  allowFixtureInjection: boolean
  failClosedOnLiveInventoryFailure: boolean
}

function getProcessEnvValue(key: string): string | undefined {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env
  return processEnv?.[key]
}

function readEnvValue(key: string): string | undefined {
  const importMetaEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env
  return importMetaEnv?.[key] ?? getProcessEnvValue(key)
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return undefined
}

const DEFAULT_FIELD_POLICY: FieldCityRetrievalPolicy = {
  authorityTargets: [],
  sourceMode: {
    autoUpgradeCuratedToHybrid: false,
    allowCuratedFallbackWithoutCoverage: false,
    allowDefaultCityFallbackWhenNoExactMatch: false,
    defaultFallbackCity: 'san jose',
  },
}

const FIELD_POLICY_BY_CITY: Record<string, Partial<FieldCityRetrievalPolicy>> = {
  'san jose': {
    authorityTargets: [
      'La Foret',
      'Hakone Gardens',
      'Hedley Club Lounge',
      'Japanese Friendship Garden',
      'Friendship Garden',
      'Willow Glen',
      'Hammer Theatre',
      'Opera San Jose',
      'San Pedro Square Market',
      'SAP Center',
    ],
    sourceMode: {
      autoUpgradeCuratedToHybrid: true,
      allowCuratedFallbackWithoutCoverage: true,
      allowDefaultCityFallbackWhenNoExactMatch: true,
      defaultFallbackCity: 'san jose',
    },
  },
}

function sanitize(value: string): string {
  return value.trim().toLowerCase()
}

export function sanitizeCityKey(value: string): string {
  const normalized = sanitize(value).replace(/\./g, '')
  const [head] = normalized.split(',')
  return (head ?? normalized).trim()
}

function resolveFieldCityRetrievalPolicy(cityQuery: string): FieldCityRetrievalPolicy {
  const cityPolicy = FIELD_POLICY_BY_CITY[cityQuery] ?? {}
  return {
    authorityTargets: cityPolicy.authorityTargets ?? DEFAULT_FIELD_POLICY.authorityTargets,
    sourceMode: {
      ...DEFAULT_FIELD_POLICY.sourceMode,
      ...(cityPolicy.sourceMode ?? {}),
    },
  }
}

export function resolveFieldRetrievalSourceMode(params: {
  cityQuery: string
  requestedSourceMode: SourceMode
  sourceModeOverrideApplied: boolean
}): SourceMode {
  const policy = resolveFieldCityRetrievalPolicy(params.cityQuery)
  if (
    params.requestedSourceMode === 'curated' &&
    !params.sourceModeOverrideApplied &&
    policy.sourceMode.autoUpgradeCuratedToHybrid
  ) {
    return 'hybrid'
  }
  return params.requestedSourceMode
}

export function resolveAllowCuratedFallback(params: {
  cityQuery: string
  curatedCoverageForCity: boolean
}): boolean {
  const policy = resolveFieldCityRetrievalPolicy(params.cityQuery)
  return (
    params.curatedCoverageForCity ||
    params.cityQuery.length === 0 ||
    policy.sourceMode.allowCuratedFallbackWithoutCoverage
  )
}

export function resolveDefaultCityFallback(params: {
  cityQuery: string
  shouldFallbackToCurated: boolean
  retrievalSourceMode: SourceMode
  allowDefaultCityFallback?: boolean
}): string | undefined {
  const policy = resolveFieldCityRetrievalPolicy(params.cityQuery)
  if (params.allowDefaultCityFallback === false) {
    return undefined
  }
  const canUseFallbackCity =
    params.cityQuery.length === 0 || policy.sourceMode.allowDefaultCityFallbackWhenNoExactMatch
  if (!canUseFallbackCity) {
    return undefined
  }
  if (!(params.shouldFallbackToCurated || params.retrievalSourceMode === 'curated')) {
    return undefined
  }
  return policy.sourceMode.defaultFallbackCity
}

export function getFieldAuthorityTargets(cityQuery: string): string[] {
  return resolveFieldCityRetrievalPolicy(cityQuery).authorityTargets
}

export function resolveFieldGovernancePolicy(): FieldGovernancePolicy {
  if (isDevOrSandboxCloseoutFlow()) {
    return {
      runtimeMode: 'demo_dev_closeout',
      allowCuratedFallback: true,
      allowBootstrapFallback: true,
      allowDefaultCityFallback: true,
      allowFixtureInjection: true,
      failClosedOnLiveInventoryFailure: false,
    }
  }

  const governedModeEnabled = parseBooleanEnv(readEnvValue('VITE_ID8_FIELD_GOVERNED_MODE')) === true
  if (!governedModeEnabled) {
    return {
      runtimeMode: 'standard_local',
      allowCuratedFallback: true,
      allowBootstrapFallback: true,
      allowDefaultCityFallback: true,
      allowFixtureInjection: true,
      failClosedOnLiveInventoryFailure: false,
    }
  }

  return {
    runtimeMode: 'api_governed',
    allowCuratedFallback:
      parseBooleanEnv(readEnvValue('VITE_ID8_ALLOW_CURATED_FALLBACK')) ?? false,
    allowBootstrapFallback:
      parseBooleanEnv(readEnvValue('VITE_ID8_ALLOW_BOOTSTRAP_FALLBACK')) ?? false,
    allowDefaultCityFallback:
      parseBooleanEnv(readEnvValue('VITE_ID8_ALLOW_DEFAULT_CITY_FALLBACK')) ?? false,
    allowFixtureInjection:
      parseBooleanEnv(readEnvValue('VITE_ID8_ALLOW_FIXTURE_INJECTION')) ?? false,
    failClosedOnLiveInventoryFailure:
      parseBooleanEnv(readEnvValue('VITE_ID8_FAIL_CLOSED_ON_LIVE_INVENTORY_FAILURE')) ?? true,
  }
}

export function classifyProviderAuthority(
  source: Pick<
    VenueSourceMetadata,
    'sourceOrigin' | 'curatedSubtype' | 'provider' | 'providerRecordId' | 'normalizedFromRawType' | 'sourceQueryLabel'
  >,
): ProviderAuthorityClass {
  if (
    source.sourceOrigin === 'live' &&
    source.provider &&
    source.providerRecordId &&
    source.normalizedFromRawType === 'raw-place'
  ) {
    return 'live_authoritative'
  }
  if (source.sourceOrigin === 'curated' && source.curatedSubtype === 'bootstrap-portable') {
    return 'bootstrap_non_authoritative'
  }
  if (
    source.sourceOrigin === 'curated' &&
    (source.curatedSubtype === 'manual-custom' || source.sourceQueryLabel === 'manual-custom')
  ) {
    return 'manual_non_provider'
  }
  if (source.sourceOrigin === 'curated' && source.curatedSubtype === 'seed') {
    return 'seed_non_authoritative'
  }
  return 'curated_non_authoritative'
}
