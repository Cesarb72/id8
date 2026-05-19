import type {
  ProviderCanonicalVenueMapping,
} from './providerCanonicalVenueMapping'
import { isCanonicalVenueResolved } from './providerCanonicalVenueMapping'
import type {
  ProviderCompletenessGateResult,
} from './providerCompletenessGate'
import type { SupplyEquivalenceResult } from './supplyEquivalence'
import type { ProviderVenue } from './providerTypes'

export type CanonicalIdentityStatus = 'resolved' | 'live_admitted' | 'unresolved'

export interface LiveVenueIdentityAdmissionResult {
  admitted: boolean
  canonicalIdentityStatus: CanonicalIdentityStatus
  venueId?: string
  canonicalVenueId?: string
  providerRecordId?: string
  sourceMode: 'live'
  blockingReasons: string[]
  warnings: string[]
}

export const LIVE_GOOGLE_VENUE_ID_PREFIX = 'live_google_'

export function createLiveGoogleVenueId(providerRecordId: string): string {
  return `${LIVE_GOOGLE_VENUE_ID_PREFIX}${providerRecordId.trim()}`
}

export function getProviderRecordIdFromLiveGoogleVenueId(
  venueId: string,
): string | undefined {
  if (!venueId.startsWith(LIVE_GOOGLE_VENUE_ID_PREFIX)) {
    return undefined
  }
  const providerRecordId = venueId.slice(LIVE_GOOGLE_VENUE_ID_PREFIX.length).trim()
  return providerRecordId.length > 0 ? providerRecordId : undefined
}

function hasRealCoordinates(providerVenue: ProviderVenue): boolean {
  return (
    typeof providerVenue.location?.latitude === 'number' &&
    Number.isFinite(providerVenue.location.latitude) &&
    typeof providerVenue.location?.longitude === 'number' &&
    Number.isFinite(providerVenue.location.longitude)
  )
}

function hasResolvedCategory(providerVenue: ProviderVenue): boolean {
  return Boolean(
    providerVenue.primaryType?.trim() || (providerVenue.types ?? []).some((entry) => entry.trim()),
  )
}

export function admitLiveVenueIdentity(params: {
  providerVenue: ProviderVenue
  canonicalMapping?: ProviderCanonicalVenueMapping
  completeness: ProviderCompletenessGateResult
  equivalence?: SupplyEquivalenceResult | null
  mode: 'product' | 'diagnostic'
  requestedAt: number
}): LiveVenueIdentityAdmissionResult {
  const {
    providerVenue,
    canonicalMapping,
    completeness,
    equivalence,
    mode,
  } = params
  void params.requestedAt

  const providerRecordId = providerVenue.providerRecordId.trim()
  const warnings = [...(equivalence?.warnings ?? [])]
  const blockingReasons = [...(equivalence?.blockingReasons ?? [])]
  const resolvedCanonicalVenueId =
    canonicalMapping && isCanonicalVenueResolved(canonicalMapping)
      ? canonicalMapping.canonicalVenueId
      : undefined

  if (resolvedCanonicalVenueId) {
    return {
      admitted: true,
      canonicalIdentityStatus: 'resolved',
      venueId: resolvedCanonicalVenueId,
      canonicalVenueId: resolvedCanonicalVenueId,
      providerRecordId,
      sourceMode: 'live',
      blockingReasons,
      warnings,
    }
  }

  if (mode !== 'product') {
    return {
      admitted: false,
      canonicalIdentityStatus: 'unresolved',
      providerRecordId,
      sourceMode: 'live',
      blockingReasons,
      warnings: [...warnings, 'diagnostic_mode_only'],
    }
  }

  if (!providerRecordId) {
    return {
      admitted: false,
      canonicalIdentityStatus: 'unresolved',
      sourceMode: 'live',
      blockingReasons: [...blockingReasons, 'missing_provider_id'],
      warnings,
    }
  }

  if (!hasRealCoordinates(providerVenue)) {
    return {
      admitted: false,
      canonicalIdentityStatus: 'unresolved',
      providerRecordId,
      sourceMode: 'live',
      blockingReasons: [...blockingReasons, 'missing_coordinates'],
      warnings,
    }
  }

  if (!hasResolvedCategory(providerVenue)) {
    return {
      admitted: false,
      canonicalIdentityStatus: 'unresolved',
      providerRecordId,
      sourceMode: 'live',
      blockingReasons: [...blockingReasons, 'missing_category'],
      warnings,
    }
  }

  if (completeness.status !== 'passed') {
    return {
      admitted: false,
      canonicalIdentityStatus: 'unresolved',
      providerRecordId,
      sourceMode: 'live',
      blockingReasons: [
        ...blockingReasons,
        completeness.failureReason ?? completeness.status,
      ],
      warnings,
    }
  }

  if (equivalence && equivalence.status !== 'equivalent') {
    return {
      admitted: false,
      canonicalIdentityStatus: 'unresolved',
      providerRecordId,
      sourceMode: 'live',
      blockingReasons: [
        ...blockingReasons,
        equivalence.blockingReasons[0] ?? equivalence.status,
      ],
      warnings,
    }
  }

  return {
    admitted: true,
    canonicalIdentityStatus: 'live_admitted',
    venueId: createLiveGoogleVenueId(providerRecordId),
    providerRecordId,
    sourceMode: 'live',
    blockingReasons,
    warnings: [...warnings, 'live_identity_admitted'],
  }
}
