import type {
  ProviderCorpusBuildAnchorFamily,
  ProviderCorpusCategoryFamily,
  ProviderCorpusRole,
  ProviderCorpusScenarioFamily,
} from './providerCorpusManifest'
import type { ProviderCallLedger } from './providerCallTrace'
import type { RawPlace } from '../types/rawPlace'
import type { Venue } from '../types/venue'

export type ProviderCorpusArtifactSource = 'mocked' | 'provider'
export type ProviderCorpusRuntimeSafetyStatus = 'safe_for_future_runtime_ingestion' | 'blocked'

export interface ProviderCorpusArtifactQuery {
  label: string
  queryText: string
  purpose: 'retrieval_supply'
  expectedCategoryFamily: ProviderCorpusCategoryFamily
  expectedRoles: ProviderCorpusRole[]
  gate1Required: boolean
  maxCenters: number
  maxCalls: number
  mockedResultCount: number
  providerResultCount: number
  billableCallCount: number
}

export interface ProviderCorpusArtifactVenueSupport {
  categoryFamily: ProviderCorpusCategoryFamily
  roles: ProviderCorpusRole[]
  starters: string[]
  scenarioFamilies: ProviderCorpusScenarioFamily[]
  buildAnchorFamilies: ProviderCorpusBuildAnchorFamily[]
  surpriseHighlightSupport: boolean
}

export interface ProviderCorpusArtifactVenue {
  id: string
  provider: 'google-places'
  providerRecordId: string
  sourceQueryLabel: string
  sourceQueryText: string
  fetchedAt: number
  generatedAt: string
  rawPlace: RawPlace
  normalizedVenue: Venue
  support: ProviderCorpusArtifactVenueSupport
  runtimeSafety: {
    status: ProviderCorpusRuntimeSafetyStatus
    reasons: string[]
  }
}

export interface ProviderCorpusDedupeReport {
  inputVenueCount: number
  uniqueVenueCount: number
  duplicateProviderRecordIds: string[]
  dedupedVenueIds: Array<{
    droppedVenueId: string
    keptVenueId: string
    providerRecordId: string
    reason: 'duplicate_provider_record_id'
  }>
}

export interface ProviderCorpusCoverageReport {
  buildAnchorFamilies: ProviderCorpusBuildAnchorFamily[]
  categoryFamilies: ProviderCorpusCategoryFamily[]
  curateStarters: string[]
  manifestQueryLabels: string[]
  roles: ProviderCorpusRole[]
  scenarioFamilies: ProviderCorpusScenarioFamily[]
  surpriseHighlightCategoryFamilies: ProviderCorpusCategoryFamily[]
  surpriseSupported: boolean
}

export interface ProviderCorpusDropReasons {
  providerMappedDropped: Record<string, number>
  normalizationDropped: Record<string, number>
  runtimeSafetyBlocked: Record<string, number>
}

export interface ProviderCorpusFreshnessPolicy {
  generatedAt: string
  reviewBy: string
  maxAgeDays: number
  staleAction: 'review_before_runtime_ingestion'
}

export interface ProviderCorpusArtifact {
  artifactVersion: 'provider-corpus-snapshot.v1'
  city: 'San Jose'
  generatedAt: string
  source: ProviderCorpusArtifactSource
  manifestVersion: 'provider-corpus-manifest.v1'
  manifestQueryCount: number
  queries: ProviderCorpusArtifactQuery[]
  venues: ProviderCorpusArtifactVenue[]
  dedupeReport: ProviderCorpusDedupeReport
  coverageReport: ProviderCorpusCoverageReport
  providerLedgerSummary: ProviderCallLedger
  dropReasons: ProviderCorpusDropReasons
  freshnessPolicy: ProviderCorpusFreshnessPolicy
  runtimeImportAllowed: false
}

export interface ProviderCorpusArtifactValidationResult {
  valid: boolean
  errors: string[]
}

function addError(errors: string[], condition: boolean, message: string): void {
  if (!condition) {
    errors.push(message)
  }
}

function isLiveGoogleVenueId(id: string, providerRecordId: string): boolean {
  return id === `live_google_${providerRecordId.trim()}`
}

function isCuratedVenueId(id: string): boolean {
  return !id.startsWith('live_google_')
}

export function validateProviderCorpusArtifact(
  artifact: ProviderCorpusArtifact,
): ProviderCorpusArtifactValidationResult {
  const errors: string[] = []
  addError(
    errors,
    artifact.artifactVersion === 'provider-corpus-snapshot.v1',
    'artifactVersion must be provider-corpus-snapshot.v1.',
  )
  addError(errors, artifact.city === 'San Jose', 'city must be San Jose.')
  addError(errors, artifact.source === 'mocked' || artifact.source === 'provider', 'source is invalid.')
  addError(errors, artifact.runtimeImportAllowed === false, 'runtimeImportAllowed must be false.')
  addError(
    errors,
    artifact.manifestQueryCount === artifact.queries.length,
    'manifestQueryCount must match queries length.',
  )
  addError(errors, artifact.queries.length === 12, 'artifact must include exactly 12 query references.')
  addError(
    errors,
    artifact.queries.every((query) => query.purpose === 'retrieval_supply'),
    'all queries must use retrieval_supply.',
  )
  addError(
    errors,
    artifact.source === 'mocked'
      ? artifact.providerLedgerSummary.totalAttempted === 0 &&
          artifact.providerLedgerSummary.totalBillable === 0 &&
          artifact.providerLedgerSummary.totalAttemptedHttpRequests === 0
      : true,
    'mocked artifacts must report zero real provider calls.',
  )

  for (const venue of artifact.venues) {
    const venueIdValid =
      isCuratedVenueId(venue.id) || isLiveGoogleVenueId(venue.id, venue.providerRecordId)
    addError(
      errors,
      venueIdValid,
      `${venue.id}: venue id must be curated or live_google_<providerRecordId>.`,
    )
    addError(
      errors,
      venue.rawPlace.id === venue.id,
      `${venue.id}: rawPlace id must match artifact venue id.`,
    )
    addError(
      errors,
      venue.normalizedVenue.id === venue.id,
      `${venue.id}: normalized venue id must match artifact venue id.`,
    )
    addError(
      errors,
      venue.rawPlace.providerRecordId === venue.providerRecordId,
      `${venue.id}: raw provider record id must match artifact provider record id.`,
    )
    addError(
      errors,
      venue.normalizedVenue.source.providerRecordId === venue.providerRecordId,
      `${venue.id}: normalized provider record id must match artifact provider record id.`,
    )
    addError(
      errors,
      venue.runtimeSafety.status === 'safe_for_future_runtime_ingestion',
      `${venue.id}: mocked venue must be marked safe for future runtime ingestion.`,
    )
  }

  addError(
    errors,
    artifact.dedupeReport.inputVenueCount === artifact.venues.length,
    'dedupe inputVenueCount must match venue count before future artifact materialization changes it.',
  )
  addError(
    errors,
    artifact.dedupeReport.uniqueVenueCount <= artifact.dedupeReport.inputVenueCount,
    'dedupe uniqueVenueCount cannot exceed inputVenueCount.',
  )
  addError(
    errors,
    artifact.coverageReport.roles.includes('start') &&
      artifact.coverageReport.roles.includes('highlight') &&
      artifact.coverageReport.roles.includes('windDown') &&
      artifact.coverageReport.roles.includes('support'),
    'coverageReport must include all route roles.',
  )
  addError(
    errors,
    artifact.coverageReport.scenarioFamilies.length >= 9,
    'coverageReport must include all 9 persona/vibe scenarios.',
  )
  addError(
    errors,
    artifact.coverageReport.surpriseSupported,
    'coverageReport must mark Surprise as supported.',
  )

  return {
    errors,
    valid: errors.length === 0,
  }
}
