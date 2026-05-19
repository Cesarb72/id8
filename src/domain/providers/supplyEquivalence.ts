import type { EngineSourceMode } from '../types/sourceMode'
import type { Venue } from '../types/venue'
import type { VerifiedCityOpportunity } from '../interpretation/verifiedCityOpportunity'
import type {
  ProviderCanonicalVenueMapping,
} from './providerCanonicalVenueMapping'
import { isCanonicalVenueResolved } from './providerCanonicalVenueMapping'
import type {
  ProviderCompletenessGateResult,
} from './providerCompletenessGate'
import {
  isProviderVenueDryRunEligible,
  isProviderVenueProductEligible,
} from './providerCompletenessGate'
import type { CanonicalIdentityStatus } from './admitLiveVenueIdentity'

export type SupplyEquivalenceStatus =
  | 'equivalent'
  | 'equivalent_with_warnings'
  | 'not_equivalent'

export type SupplyEquivalenceSource = EngineSourceMode

export type SupplyEquivalenceReason =
  | 'static_equivalent'
  | 'live_equivalent'
  | 'bootstrap_equivalent'
  | 'missing_canonical_identity'
  | 'missing_coordinates'
  | 'missing_category'
  | 'unresolved_provider_identity'
  | 'completeness_warning'
  | 'source_mode_missing'
  | 'source_lineage_mismatch'
  | 'fallback_required'
  | 'fallback_unavailable'

export interface SupplyEquivalenceResult {
  equivalent: boolean
  status: SupplyEquivalenceStatus
  sourceMode: SupplyEquivalenceSource
  canonicalVenueId?: string | null
  providerRecordId?: string
  warnings: SupplyEquivalenceReason[]
  blockingReasons: SupplyEquivalenceReason[]
  confidence?: number
  requiresFallback?: boolean
  fallbackReason?: SupplyEquivalenceReason
}

export interface SupplyEquivalenceOptions {
  allowLiveWarningsForEquivalence?: boolean
}

type CuratedSupplyInput = {
  kind: 'curated'
  venue: Venue
}

type LiveSupplyInput = {
  kind: 'live'
  gateResult: ProviderCompletenessGateResult
  canonicalMapping?: ProviderCanonicalVenueMapping
  canonicalIdentityStatus?: CanonicalIdentityStatus
}

type BootstrapSupplyInput = {
  kind: 'bootstrap'
  opportunity: VerifiedCityOpportunity
}

export type SupplyEquivalenceInput =
  | CuratedSupplyInput
  | LiveSupplyInput
  | BootstrapSupplyInput

function getDefaultOptions(): Required<SupplyEquivalenceOptions> {
  return {
    allowLiveWarningsForEquivalence: true,
  }
}

function buildResult(params: SupplyEquivalenceResult): SupplyEquivalenceResult {
  return params
}

export function evaluateSupplyEquivalence(
  input: SupplyEquivalenceInput,
  options?: SupplyEquivalenceOptions,
): SupplyEquivalenceResult {
  const resolvedOptions = {
    ...getDefaultOptions(),
    ...(options ?? {}),
  }

  if (input.kind === 'curated') {
    const venue = input.venue
    const canonicalVenueId = venue.id?.trim() || null
    const blockingReasons: SupplyEquivalenceReason[] = []
    const warnings: SupplyEquivalenceReason[] = []

    if (!venue.source.sourceOrigin) {
      blockingReasons.push('source_mode_missing')
    } else if (venue.source.sourceOrigin !== 'curated') {
      blockingReasons.push('source_lineage_mismatch')
    }
    if (!canonicalVenueId) {
      blockingReasons.push('missing_canonical_identity')
    }

    return buildResult({
      equivalent: blockingReasons.length === 0,
      status: blockingReasons.length === 0 ? 'equivalent' : 'not_equivalent',
      sourceMode: 'curated',
      canonicalVenueId,
      warnings: blockingReasons.length === 0 ? ['static_equivalent'] : warnings,
      blockingReasons,
      confidence:
        venue.source.qualityScore * 0.45 +
        venue.source.sourceConfidence * 0.3 +
        venue.source.completenessScore * 0.25,
      requiresFallback: false,
    })
  }

  if (input.kind === 'bootstrap') {
    const opportunity = input.opportunity
    const blockingReasons: SupplyEquivalenceReason[] = []
    const warnings: SupplyEquivalenceReason[] = []

    if (opportunity.sourceMode !== 'bootstrap') {
      blockingReasons.push('source_mode_missing')
    }
    if (!opportunity.anchor.venueId.trim()) {
      blockingReasons.push('missing_canonical_identity')
    }
    if (opportunity.starts.length === 0 || opportunity.closes.length === 0) {
      blockingReasons.push('fallback_unavailable')
    }

    return buildResult({
      equivalent: blockingReasons.length === 0,
      status: blockingReasons.length === 0 ? 'equivalent' : 'not_equivalent',
      sourceMode: 'bootstrap',
      canonicalVenueId: opportunity.anchor.venueId,
      warnings: blockingReasons.length === 0 ? ['bootstrap_equivalent'] : warnings,
      blockingReasons,
      confidence: opportunity.excellence.score,
      requiresFallback: false,
    })
  }

  const gateResult = input.gateResult
  const mapping = input.canonicalMapping
  const warnings: SupplyEquivalenceReason[] = []
  const blockingReasons: SupplyEquivalenceReason[] = []
  const identityResolvedByMapping = mapping ? isCanonicalVenueResolved(mapping) : false
  const identityResolved =
    input.canonicalIdentityStatus === 'resolved' ||
    input.canonicalIdentityStatus === 'live_admitted' ||
    identityResolvedByMapping

  if (!isProviderVenueDryRunEligible(gateResult)) {
    if (gateResult.coordinatesStatus === 'missing') {
      blockingReasons.push('missing_coordinates')
    }
    if (gateResult.categoryStatus === 'missing') {
      blockingReasons.push('missing_category')
    }
    if (gateResult.identityStatus === 'unresolved') {
      blockingReasons.push('unresolved_provider_identity')
    }
    if (
      blockingReasons.length === 0 &&
      gateResult.suppressionReasons.length > 0
    ) {
      blockingReasons.push('completeness_warning')
    }
  } else {
    warnings.push('live_equivalent')
    if (!isProviderVenueProductEligible(gateResult)) {
      warnings.push('completeness_warning')
    }
    if (!identityResolved) {
      warnings.push('unresolved_provider_identity')
    }
  }

  const liveEquivalent =
    isProviderVenueProductEligible(gateResult) ||
    (resolvedOptions.allowLiveWarningsForEquivalence &&
      isProviderVenueDryRunEligible(gateResult))

  return buildResult({
    equivalent: liveEquivalent && blockingReasons.length === 0,
    status:
      blockingReasons.length > 0
        ? 'not_equivalent'
        : isProviderVenueProductEligible(gateResult)
          ? 'equivalent'
          : 'equivalent_with_warnings',
    sourceMode: 'live',
    canonicalVenueId: mapping?.canonicalVenueId ?? null,
    providerRecordId: gateResult.providerRecordId,
    warnings,
    blockingReasons,
    confidence: gateResult.confidence,
    requiresFallback: !isProviderVenueProductEligible(gateResult),
    fallbackReason: !isProviderVenueProductEligible(gateResult)
      ? identityResolved
        ? 'fallback_required'
        : 'fallback_unavailable'
      : undefined,
  })
}

export function isSupplyEngineEquivalent(
  result: SupplyEquivalenceResult,
): boolean {
  return result.status === 'equivalent'
}

export function describeSupplyEquivalence(
  result: SupplyEquivalenceResult,
): string {
  const warnings = result.warnings.join(', ') || 'none'
  const blocking = result.blockingReasons.join(', ') || 'none'
  const canonical = result.canonicalVenueId ?? 'n/a'
  return `${result.sourceMode} | ${result.status} | canonical=${canonical} | warnings=${warnings} | blocking=${blocking}`
}
