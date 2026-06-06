import type { SourceMode } from '../types/sourceMode'
import type { ProviderCallPurpose } from './providerCallTrace'

export interface ProviderGovernancePreflightInput {
  purpose: ProviderCallPurpose
  queryCount: number
  sourceMode?: SourceMode
}

export interface ProviderGovernancePreflightResult {
  allowed: boolean
  blockedReason?: string
  billableCallCap: number
  estimatedBillableCallCount: number
}

const PURPOSE_ACTIVATION_ENV_KEYS: Partial<Record<ProviderCallPurpose, string>> = {
  anchor_search: 'VITE_ID8_PROVIDER_ENABLE_ANCHOR_SEARCH',
  build_anchor_nearby: 'VITE_ID8_PROVIDER_ENABLE_BUILD_ANCHOR_NEARBY',
  retrieval_supply: 'VITE_ID8_PROVIDER_ENABLE_RETRIEVAL_SUPPLY',
}

const PURPOSE_BUDGET_CAP_ENV_KEYS: Partial<Record<ProviderCallPurpose, string>> = {
  anchor_search: 'VITE_ID8_PROVIDER_ANCHOR_SEARCH_BILLABLE_CALL_CAP',
  build_anchor_nearby: 'VITE_ID8_PROVIDER_BUILD_ANCHOR_NEARBY_BILLABLE_CALL_CAP',
  retrieval_supply: 'VITE_ID8_PROVIDER_RETRIEVAL_SUPPLY_BILLABLE_CALL_CAP',
}

const GLOBAL_BUDGET_CAP_ENV_KEY = 'VITE_ID8_PROVIDER_BILLABLE_CALL_CAP'

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

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined
  }
  return parsed
}

function resolveBudgetCap(purpose: ProviderCallPurpose): number {
  const purposeCapKey = PURPOSE_BUDGET_CAP_ENV_KEYS[purpose]
  const purposeCap = purposeCapKey
    ? parseNonNegativeInteger(readEnvValue(purposeCapKey))
    : undefined
  return purposeCap ?? parseNonNegativeInteger(readEnvValue(GLOBAL_BUDGET_CAP_ENV_KEY)) ?? 0
}

function getActivationEnvKey(purpose: ProviderCallPurpose): string | undefined {
  return PURPOSE_ACTIVATION_ENV_KEYS[purpose]
}

export function evaluateProviderGovernancePreflight(
  input: ProviderGovernancePreflightInput,
): ProviderGovernancePreflightResult {
  const estimatedBillableCallCount = Math.max(0, input.queryCount)
  const billableCallCap = resolveBudgetCap(input.purpose)

  if (input.purpose === 'details_lookup') {
    return {
      allowed: false,
      billableCallCap,
      blockedReason: 'Place details lookup remains disabled by provider governance.',
      estimatedBillableCallCount,
    }
  }

  if (input.sourceMode === 'curated') {
    return {
      allowed: false,
      billableCallCap,
      blockedReason: 'Provider call blocked because sourceMode is curated.',
      estimatedBillableCallCount,
    }
  }

  const activationEnvKey = getActivationEnvKey(input.purpose)
  if (!activationEnvKey) {
    return {
      allowed: false,
      billableCallCap,
      blockedReason: `Provider call blocked because purpose "${input.purpose}" is not configured for live activation.`,
      estimatedBillableCallCount,
    }
  }

  if (!parseBooleanEnv(readEnvValue(activationEnvKey))) {
    return {
      allowed: false,
      billableCallCap,
      blockedReason: `Provider call blocked because ${activationEnvKey} is not enabled.`,
      estimatedBillableCallCount,
    }
  }

  if (estimatedBillableCallCount > billableCallCap) {
    return {
      allowed: false,
      billableCallCap,
      blockedReason: `Provider call budget blocked for ${input.purpose}: estimated billable calls ${estimatedBillableCallCount} exceed cap ${billableCallCap}.`,
      estimatedBillableCallCount,
    }
  }

  return {
    allowed: true,
    billableCallCap,
    estimatedBillableCallCount,
  }
}

export const providerGovernanceConfig = {
  activationEnvKeys: PURPOSE_ACTIVATION_ENV_KEYS,
  budgetCapEnvKeys: {
    global: GLOBAL_BUDGET_CAP_ENV_KEY,
    byPurpose: PURPOSE_BUDGET_CAP_ENV_KEYS,
  },
}
