import type { LiveProviderEnvelope } from '../retrieval/liveEnvelope'
import type { SourceMode } from '../types/sourceMode'

export const BUILD_PROVIDER_PUBLIC_LIVE_ENVELOPE: Readonly<Required<LiveProviderEnvelope>> = {
  liveProviderAllowed: true,
  maxProviderCalls: 3,
  maxQueryLabels: 3,
  maxCenters: 1,
}

export type BuildProviderPublicLiveIneligibleReason =
  | 'not_public_surface'
  | 'not_build_mode'
  | 'dev_or_sandbox_closeout_flow'
  | 'step2_integration_flag_disabled'
  | 'supply_flag_disabled'
  | 'source_mode_not_live_compatible'

export interface BuildProviderPublicLiveEligibilityInput {
  isPublicSurface: boolean
  isBuildWrapperActive: boolean
  isDevOrSandboxCloseoutFlow: boolean
  step2IntegrationFlagEnabled: boolean
  supplyFlagEnabled: boolean
  sourceMode: SourceMode | null
}

export interface BuildProviderPublicLiveEligibility {
  eligible: boolean
  envelope: Required<LiveProviderEnvelope> | null
  reasons: BuildProviderPublicLiveIneligibleReason[]
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

function parseSourceMode(value: string | undefined): SourceMode | null {
  if (value === 'live' || value === 'hybrid') {
    return value
  }
  if (value === 'curated') {
    return value
  }
  return null
}

export function readBuildProviderPublicLiveSourceMode(): SourceMode | null {
  return parseSourceMode(readEnvValue('VITE_ID8_SOURCE_MODE'))
}

export function buildProviderPublicLiveEnvelope(): Required<LiveProviderEnvelope> {
  return { ...BUILD_PROVIDER_PUBLIC_LIVE_ENVELOPE }
}

export function evaluateBuildProviderPublicLiveEligibility(
  input: BuildProviderPublicLiveEligibilityInput,
): BuildProviderPublicLiveEligibility {
  const reasons: BuildProviderPublicLiveIneligibleReason[] = []

  if (!input.isPublicSurface) {
    reasons.push('not_public_surface')
  }
  if (!input.isBuildWrapperActive) {
    reasons.push('not_build_mode')
  }
  if (input.isDevOrSandboxCloseoutFlow) {
    reasons.push('dev_or_sandbox_closeout_flow')
  }
  if (!input.step2IntegrationFlagEnabled) {
    reasons.push('step2_integration_flag_disabled')
  }
  if (!input.supplyFlagEnabled) {
    reasons.push('supply_flag_disabled')
  }
  if (input.sourceMode !== 'live' && input.sourceMode !== 'hybrid') {
    reasons.push('source_mode_not_live_compatible')
  }

  return {
    eligible: reasons.length === 0,
    envelope: reasons.length === 0 ? buildProviderPublicLiveEnvelope() : null,
    reasons,
  }
}

export const buildProviderPublicLiveWiringConfig = {
  envelope: BUILD_PROVIDER_PUBLIC_LIVE_ENVELOPE,
  sourceModeEnvFlag: 'VITE_ID8_SOURCE_MODE',
}
