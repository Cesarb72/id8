import type { Venue } from '../types/venue'

export type BearingsRuntimeHoursProofStatus =
  | 'closed_for_plan_window'
  | 'missing_runtime_proof'
  | 'not_required'
  | 'open_for_plan_window'
  | 'unknown_for_plan_window'

export interface BearingsRuntimeHoursPersistedSnapshot {
  openNow?: boolean
  hoursKnown: boolean
  likelyOpenForCurrentWindow: boolean
  businessStatus: Venue['source']['businessStatus']
  timeConfidence: number
  hoursPressureLevel: Venue['source']['hoursPressureLevel']
}

export interface BearingsRuntimeHoursVenueDiagnostic {
  venueId: string
  venueName: string
  sourceOrigin: Venue['source']['sourceOrigin']
  curatedSubtype?: Venue['source']['curatedSubtype']
  provider?: Venue['source']['provider']
  providerRecordId?: string
  qualityGateStatus: Venue['source']['qualityGateStatus']
  wouldRequireRuntimeHoursValidation: boolean
  runtimeProofStatus: BearingsRuntimeHoursProofStatus
  wouldBlockUnderConservativeEnforcement: boolean
  persistedHoursSnapshot: BearingsRuntimeHoursPersistedSnapshot
}

export interface BearingsRuntimeHoursDiagnostics {
  evaluatedVenueCount: number
  requiredVenueCount: number
  missingRuntimeProofCount: number
  notRequiredVenueCount: number
  wouldBlockUnderConservativeEnforcementCount: number
  sampledVenues: BearingsRuntimeHoursVenueDiagnostic[]
}

const RUNTIME_HOURS_VALIDATION_REQUIRED = 'runtime_hours_validation_required'

export function venueRequiresRuntimeHoursValidation(venue: Venue): boolean {
  return (
    venue.source.bearingsValidationRequirements?.includes(
      RUNTIME_HOURS_VALIDATION_REQUIRED,
    ) === true
  )
}

export function assessRuntimeHoursValidationDiagnostic(
  venue: Venue,
): BearingsRuntimeHoursVenueDiagnostic {
  const wouldRequireRuntimeHoursValidation =
    venueRequiresRuntimeHoursValidation(venue)
  const runtimeProofStatus =
    venue.source.runtimeHoursPlanWindowProofStatus ??
    (wouldRequireRuntimeHoursValidation
      ? 'missing_runtime_proof'
      : 'not_required')

  return {
    venueId: venue.id,
    venueName: venue.name,
    sourceOrigin: venue.source.sourceOrigin,
    curatedSubtype: venue.source.curatedSubtype,
    provider: venue.source.provider,
    providerRecordId: venue.source.providerRecordId,
    qualityGateStatus: venue.source.qualityGateStatus,
    wouldRequireRuntimeHoursValidation,
    runtimeProofStatus,
    wouldBlockUnderConservativeEnforcement:
      runtimeProofStatus === 'closed_for_plan_window' ||
      runtimeProofStatus === 'missing_runtime_proof',
    persistedHoursSnapshot: {
      openNow: venue.source.openNow,
      hoursKnown: venue.source.hoursKnown,
      likelyOpenForCurrentWindow: venue.source.likelyOpenForCurrentWindow,
      businessStatus: venue.source.businessStatus,
      timeConfidence: venue.source.timeConfidence,
      hoursPressureLevel: venue.source.hoursPressureLevel,
    },
  }
}

export function buildRuntimeHoursValidationDiagnostics(
  venues: Venue[],
  sampleLimit = 12,
): BearingsRuntimeHoursDiagnostics {
  const diagnostics = venues.map(assessRuntimeHoursValidationDiagnostic)
  const required = diagnostics.filter(
    (diagnostic) => diagnostic.wouldRequireRuntimeHoursValidation,
  )
  const missingRuntimeProof = diagnostics.filter(
    (diagnostic) => diagnostic.runtimeProofStatus === 'missing_runtime_proof',
  )
  const wouldBlockUnderConservativeEnforcement = diagnostics.filter(
    (diagnostic) => diagnostic.wouldBlockUnderConservativeEnforcement,
  )

  return {
    evaluatedVenueCount: diagnostics.length,
    requiredVenueCount: required.length,
    missingRuntimeProofCount: missingRuntimeProof.length,
    notRequiredVenueCount: diagnostics.length - required.length,
    wouldBlockUnderConservativeEnforcementCount:
      wouldBlockUnderConservativeEnforcement.length,
    sampledVenues: [
      ...required,
      ...diagnostics.filter(
        (diagnostic) => !diagnostic.wouldRequireRuntimeHoursValidation,
      ),
    ].slice(0, sampleLimit),
  }
}
