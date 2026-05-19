import type { EngineSourceMode } from '../types/sourceMode'
import type {
  ProviderCanonicalVenueMapping,
} from './providerCanonicalVenueMapping'
import { isCanonicalVenueResolved } from './providerCanonicalVenueMapping'
import type { ProviderVenue } from './providerTypes'

export type ProviderHoursConfidenceStatus =
  | 'known'
  | 'unknown'
  | 'insufficient'
  | 'not_required'

export type ProviderCoordinatesStatus = 'present' | 'missing'
export type ProviderCategoryStatus = 'resolved' | 'missing'
export type ProviderIdentityStatus = 'resolved' | 'unresolved'
export type ProviderCompletenessGateStatus = 'passed' | 'blocked' | 'warning'

export type ProviderCompletenessSuppressionReason =
  | 'missing_provider_id'
  | 'missing_coordinates'
  | 'missing_category'
  | 'unresolved_canonical_identity'
  | 'low_confidence'
  | 'hours_unknown'
  | 'source_mode_invalid'

export interface ProviderCompletenessGateOptions {
  requireCanonicalIdentity?: boolean
  requireOpenNowConfidence?: boolean
  minimumConfidence?: number
  treatUnresolvedCanonicalIdentityAsDiagnosticOnly?: boolean
}

export interface ProviderCompletenessGateResult {
  passed: boolean
  status: ProviderCompletenessGateStatus
  confidence: number
  missingFields: string[]
  warnings: string[]
  suppressionReasons: ProviderCompletenessSuppressionReason[]
  failureReason?: string
  canonicalVenueId?: string | null
  providerRecordId?: string
  sourceMode: Extract<EngineSourceMode, 'live'>
  hoursConfidenceStatus?: ProviderHoursConfidenceStatus
  coordinatesStatus: ProviderCoordinatesStatus
  categoryStatus: ProviderCategoryStatus
  identityStatus: ProviderIdentityStatus
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function getDefaultOptions(): Required<ProviderCompletenessGateOptions> {
  return {
    requireCanonicalIdentity: false,
    requireOpenNowConfidence: false,
    minimumConfidence: 0.6,
    treatUnresolvedCanonicalIdentityAsDiagnosticOnly: false,
  }
}

function buildFailureReason(result: {
  missingFields: string[]
  suppressionReasons: ProviderCompletenessSuppressionReason[]
}): string | undefined {
  if (result.suppressionReasons.length > 0) {
    return result.suppressionReasons.join(', ')
  }
  if (result.missingFields.length > 0) {
    return `missing fields: ${result.missingFields.join(', ')}`
  }
  return undefined
}

function getHoursConfidenceStatus(params: {
  providerVenue: ProviderVenue
  requireOpenNowConfidence: boolean
}): ProviderHoursConfidenceStatus {
  const { providerVenue, requireOpenNowConfidence } = params
  if (!requireOpenNowConfidence) {
    return providerVenue.completenessHints.hasHours ? 'known' : 'not_required'
  }
  if (!providerVenue.completenessHints.hasHours) {
    return 'unknown'
  }
  if (typeof providerVenue.currentOpeningHours?.openNow !== 'boolean') {
    return 'insufficient'
  }
  return 'known'
}

export function evaluateProviderVenueCompleteness(params: {
  providerVenue: ProviderVenue
  canonicalMapping?: ProviderCanonicalVenueMapping
  options?: ProviderCompletenessGateOptions
}): ProviderCompletenessGateResult {
  const { providerVenue, canonicalMapping } = params
  const options = {
    ...getDefaultOptions(),
    ...(params.options ?? {}),
  }

  const missingFields: string[] = []
  const warnings: string[] = []
  const suppressionReasons: ProviderCompletenessSuppressionReason[] = []

  if (!providerVenue.providerRecordId.trim()) {
    missingFields.push('providerRecordId')
    suppressionReasons.push('missing_provider_id')
  }

  const coordinatesPresent =
    typeof providerVenue.location?.latitude === 'number' &&
    typeof providerVenue.location?.longitude === 'number'
  if (!coordinatesPresent) {
    missingFields.push('location')
    suppressionReasons.push('missing_coordinates')
  }

  const categoryResolved = Boolean(
    providerVenue.primaryType?.trim() || (providerVenue.types ?? []).some((entry) => entry.trim()),
  )
  if (!categoryResolved) {
    missingFields.push('category')
    suppressionReasons.push('missing_category')
  }

  if (providerVenue.sourceMode !== 'live') {
    suppressionReasons.push('source_mode_invalid')
  }

  const identityResolved = canonicalMapping ? isCanonicalVenueResolved(canonicalMapping) : false
  if (!identityResolved) {
    warnings.push(
      options.treatUnresolvedCanonicalIdentityAsDiagnosticOnly
        ? 'unresolved_canonical_identity_pre_admission'
        : 'unresolved_canonical_identity',
    )
    if (options.requireCanonicalIdentity) {
      suppressionReasons.push('unresolved_canonical_identity')
    }
  }

  const hoursConfidenceStatus = getHoursConfidenceStatus({
    providerVenue,
    requireOpenNowConfidence: options.requireOpenNowConfidence,
  })
  if (hoursConfidenceStatus === 'unknown' || hoursConfidenceStatus === 'insufficient') {
    warnings.push('hours_unknown')
  }

  const confidence = clamp01(
    (providerVenue.completenessHints.hasLocation ? 0.24 : 0) +
      (providerVenue.completenessHints.hasPrimaryType ? 0.22 : 0) +
      (providerVenue.completenessHints.hasAddress ? 0.16 : 0) +
      (providerVenue.completenessHints.hasHours ? 0.12 : 0),
  )
  // rating/reviewCount are Taste scoring inputs, not admission signals.
  // Static canonical resolution is also not an operational completeness signal.

  if (confidence < options.minimumConfidence) {
    suppressionReasons.push('low_confidence')
  }

  const blocked = suppressionReasons.length > 0
  const statusWarnings = warnings.filter((warning) => {
    return !(
      options.treatUnresolvedCanonicalIdentityAsDiagnosticOnly &&
      warning === 'unresolved_canonical_identity_pre_admission'
    )
  })
  const status: ProviderCompletenessGateStatus = blocked
    ? 'blocked'
    : statusWarnings.length > 0
      ? 'warning'
      : 'passed'

  return {
    passed: !blocked,
    status,
    confidence,
    missingFields,
    warnings,
    suppressionReasons,
    failureReason: blocked
      ? buildFailureReason({ missingFields, suppressionReasons })
      : undefined,
    canonicalVenueId: canonicalMapping?.canonicalVenueId ?? null,
    providerRecordId: providerVenue.providerRecordId,
    sourceMode: 'live',
    hoursConfidenceStatus,
    coordinatesStatus: coordinatesPresent ? 'present' : 'missing',
    categoryStatus: categoryResolved ? 'resolved' : 'missing',
    identityStatus: identityResolved ? 'resolved' : 'unresolved',
  }
}

export function isProviderVenueEngineEligible(
  result: ProviderCompletenessGateResult,
): boolean {
  return result.status === 'passed'
}

export function isProviderVenueDryRunEligible(
  result: ProviderCompletenessGateResult,
): boolean {
  return result.status === 'passed' || result.status === 'warning'
}

export function isProviderVenueProductEligible(
  result: ProviderCompletenessGateResult,
): boolean {
  return result.status === 'passed'
}
