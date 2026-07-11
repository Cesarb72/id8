import type { BusinessStatus } from '../types/hours'
import type {
  QualityGateStatus,
  VenueSourceMetadata,
} from '../types/normalization'
import type {
  CuratedSourceSubtype,
  LiveDataProvider,
  ProviderAuthorityClass,
  VenueSourceOrigin,
} from '../types/sourceMode'

export type FieldRealVerdictStatus = 'pass' | 'fail' | 'unknown'

export type FieldRealAvailabilityStatus =
  | 'available_from_record'
  | 'unavailable_from_record'
  | 'unknown_from_record'

export type FieldRealStalenessStatus = 'current' | 'stale' | 'unknown'

export type FieldRealSuppressionStatus =
  | 'not_suppressed'
  | 'demoted'
  | 'suppressed'
  | 'unknown'

export type FieldRealFailureReason =
  | 'real:missing_canonical_identity'
  | 'real:invalid_canonical_identity'
  | 'real:unusable_source'
  | 'real:invalid_provenance'
  | 'real:inactive_record'
  | 'real:suppressed_record'
  | 'real:stale_record'
  | 'real:unavailable_from_record'
  | 'real:unknown_readiness'

export interface FieldRealCanonicalIdentityEvidence {
  // Canonical route identity authority is candidateIdentity.baseVenueId.
  candidateIdentityBaseVenueId: string
  candidateIdentityCandidateId?: string
  candidateIdentityKind?: 'base' | 'hyperlocal_activation' | 'moment'
}

export interface FieldRealSourceEvidence {
  sourceOrigin: VenueSourceOrigin
  normalizedFromRawType: VenueSourceMetadata['normalizedFromRawType']
  curatedSubtype?: CuratedSourceSubtype
  provider?: LiveDataProvider
  providerRecordId?: string
  providerAuthorityClass?: ProviderAuthorityClass
  sourceQueryLabel?: string
  sourceConfidence?: number
  completenessScore?: number
  qualityScore?: number
  missingFields: string[]
  inferredFields: string[]
}

export interface FieldRealAvailabilityEvidence {
  availabilityKnown: boolean
  availabilityStatus: FieldRealAvailabilityStatus
  openNow?: boolean
  hoursKnown: boolean
  likelyOpenForCurrentWindow: boolean
  businessStatus: BusinessStatus
  timeConfidence: number
  hoursPressureNotes: string[]
}

export interface FieldRealQualityEvidence {
  isActive: boolean
  qualityGateStatus: QualityGateStatus
  qualityGateNotes: string[]
  approvalBlockers: string[]
  demotionReasons: string[]
  suppressionReasons: string[]
  stalenessStatus: FieldRealStalenessStatus
  suppressionStatus: FieldRealSuppressionStatus
}

export interface FieldRealStopEvidence {
  role: string
  identity: FieldRealCanonicalIdentityEvidence
  identityUsable: boolean
  sourceUsable: boolean
  provenanceValid: boolean
  availability: FieldRealAvailabilityEvidence
  quality: FieldRealQualityEvidence
  displayName?: string
  providerRecordId?: string
  failureReasons: FieldRealFailureReason[]
}

export interface FieldRealRouteEvidence {
  stopCount: number
  failingStopCount: number
  unknownStopCount: number
  failureReasons: FieldRealFailureReason[]
}

export interface FieldRealGreatStopCompatibility {
  realReady: boolean
  realVerdict: FieldRealVerdictStatus
  realFailureReasons: FieldRealFailureReason[]
  unusableStopCount: number
  unknownStopCount: number
}

export interface FieldRealVerdictProvenance {
  source: 'field'
  evaluatedFrom: 'already_retrieved_record_truth'
  notes: string[]
}

export interface FieldRealVerdict {
  realReady: boolean
  status: FieldRealVerdictStatus
  identityUsable: boolean
  sourceUsable: boolean
  provenanceValid: boolean
  availabilityKnown: boolean
  availabilityStatus: FieldRealAvailabilityStatus
  stalenessStatus: FieldRealStalenessStatus
  suppressionStatus: FieldRealSuppressionStatus
  failureReasons: FieldRealFailureReason[]
  stopEvidence: FieldRealStopEvidence[]
  routeEvidence: FieldRealRouteEvidence
  provenance: FieldRealVerdictProvenance
  compatibility: {
    greatStopRealInputs: FieldRealGreatStopCompatibility
  }
}

// Field Real describes already-retrieved record truth only.
// Route-arrival open/closed feasibility remains Bearings-owned temporal feasibility.
