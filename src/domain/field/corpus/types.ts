import type { ProviderCanonicalMatchMethod } from '../../providers/providerCanonicalVenueMapping'
import type {
  ProviderCorpusArtifactSource,
  ProviderCorpusArtifactVenueSupport,
} from '../../providers/providerCorpusArtifact'
import type { ProviderCorpusCategoryFamily } from '../../providers/providerCorpusManifest'
import type {
  BearingsValidationRequirement,
  QualityGateStatus,
} from '../../types/normalization'
import type { HoursPeriod } from '../../types/hours'
import type { Venue } from '../../types/venue'

export type { BearingsValidationRequirement } from '../../types/normalization'

export const PROMOTED_FIELD_PROVIDER_CORPUS_VERSION = 'field-provider-corpus.v1' as const
export const RUNTIME_HOURS_VALIDATION_REQUIRED =
  'runtime_hours_validation_required' as const satisfies BearingsValidationRequirement
export const OFFLINE_CORPUS_TIME_SENSITIVE_AUDIT_REASON =
  'offline_corpus_time_sensitive_requires_runtime_hours_validation'

export interface PromotedFieldProviderCorpusProvenance {
  provider: 'google-places'
  providerRecordId: string
  sourceQueryLabel: string
  sourceQueryText: string
  fetchedAt: number
  generatedAt: string
  originalVenueId: string
  canonicalMatch: {
    canonicalVenueId: string | null
    confidence: number
    method: ProviderCanonicalMatchMethod
  }
}

export interface PromotedFieldProviderCorpusVenueAudit {
  approvalBlockers: string[]
  demotionReasons: string[]
  qualityGateNotes: string[]
  suppressionReasons: string[]
}

export interface PromotedFieldProviderCorpusRuntimeHoursProof {
  structuredPeriods: HoursPeriod[]
  textHoursAvailable: boolean
  proofSource:
    | 'structured_periods'
    | 'text_only'
    | 'none'
}

export interface PromotedFieldProviderCorpusVenue {
  id: string
  providerProvenance: PromotedFieldProviderCorpusProvenance
  qualityGateStatus: Exclude<QualityGateStatus, 'suppressed'>
  runtimeHoursProof: PromotedFieldProviderCorpusRuntimeHoursProof
  support: ProviderCorpusArtifactVenueSupport
  venue: Venue
  venueAudit: PromotedFieldProviderCorpusVenueAudit
}

export interface PromotedFieldProviderCorpusExclusions {
  suppressedVenueCount: number
}

export interface PromotedFieldProviderCorpus {
  artifactVersion: typeof PROMOTED_FIELD_PROVIDER_CORPUS_VERSION
  city: 'San Jose'
  source: ProviderCorpusArtifactSource
  sourceArtifactVersion: 'provider-corpus-snapshot.v1'
  sourceGeneratedAt: string
  sourceRunId: string
  manifestVersion: 'provider-corpus-manifest.v1'
  manifestQueryCount: number
  venueCount: number
  excluded: PromotedFieldProviderCorpusExclusions
  categoryFamilies: ProviderCorpusCategoryFamily[]
  runtimeImportAllowed: false
  venues: PromotedFieldProviderCorpusVenue[]
}

export interface PromotedFieldProviderCorpusValidationResult {
  valid: boolean
  errors: string[]
}
