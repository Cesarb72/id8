import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { FieldTextSearchRequest } from '../src/domain/field/fieldProxyTypes.ts'
import type { GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { ExperienceMode, IntentInput, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'
import type { Itinerary } from '../src/domain/types/itinerary.ts'

type YesNo = 'yes' | 'no'
type PassFail = 'pass' | 'fail' | 'not_evaluated'

const liveApprovalEnvKey = 'ID8_PHASE_3R_LIVE_PROOF'
const providerActivationValue = 'google_places_text_search'
const fieldProxyPath = '/api/field/text-search'
const googleTextSearchEndpoint = 'https://places.googleapis.com/v1/places:searchText'
const approvedQueryLabels = new Set([
  'coffee-books-start-reading@pocket',
  'coffee-books-highlight-culture@pocket',
  'coffee-books-wind-down-literary@pocket',
])
const managedEnvKeys = [
  'VITE_ID8_PROVIDER_ENABLE_RETRIEVAL_SUPPLY',
  'VITE_ID8_PROVIDER_RETRIEVAL_SUPPLY_BILLABLE_CALL_CAP',
  'VITE_ID8_PROVIDER_BILLABLE_CALL_CAP',
  'ID8_FIELD_PROVIDER',
  'ID8_PROVIDER_DAILY_CALL_CAP',
  liveApprovalEnvKey,
] as const

const outputColumns = [
  'mode',
  'starter/family',
  'route id / route label',
  'support source',
  'candidate producer',
  'support-screen producer',
  'materialization/projection source',
  'Great Stop producer',
  'routeAuthority/Application involvement',
  'ContractEntryArtifact produced? yes/no',
  'RuntimeRouteArtifact produced? yes/no',
  'Great Stop pass/fail',
  'Great Stop failure reasons',
  'Review/Lock eligible? yes/no',
  'provider calls count',
  'hosted calls count',
  'static corpus used? yes/no',
  'dry path used? yes/no',
  'fallback used? yes/no',
  'provider-shadow used? yes/no',
  'DEMO-SPECIAL path used? yes/no',
  'app-authority shadow used? yes/no',
  'legacy wrapper used? yes/no',
  'diagnostic-only? yes/no',
  'valid live proof pass? yes/no',
  'valid MVP pass? yes/no',
  'honest-fail? yes/no',
  'roleScore',
  'stopShapeFit',
  'lensCompatibility',
  'contextSpecificity',
  'threshold source',
  'evidence persisted/carried/recomputed/defaulted/unavailable',
  'selected windDown venue',
  'Philz candidate-scope numerics if Philz appears',
  'Philz route-scope numerics if Philz appears',
  'selected windDown route-scope numerics if not Philz',
  'ContractEntryArtifact status',
  'RuntimeRouteArtifact status',
  'Great Stop evaluation status',
  'Review/Lock status',
  'lifecycle capture status',
  'routeAuthority snapshot status',
  'routeAuthority source label',
  'routeAuthority rejection reasons',
  'lock input status',
  'lock input rejection reason',
  'runtime lock truth status',
  'runtime lock truth reason',
  'lifecycle input availability',
  'itinerary missing? yes/no',
  'scored venues missing? yes/no',
  'runtime lock eligibility missing? yes/no',
  'Great Stop status missing? yes/no',
  'route-level lock truth source missing? yes/no',
  'compatibility route truth? yes/no',
  'canonical route truth? yes/no',
  'approved payload compatibility? yes/no',
  'page-local route used? yes/no',
  'SelectedRouteArtifact used? yes/no',
  'CurateRefinementEntryPayload used? yes/no',
  'RuntimeRouteArtifact canonical? yes/no',
  'false-green risk? yes/no',
  'why not MVP green',
  'invalid false-green? yes/no',
  'proof validity label',
  'live data provider/source name',
  'live data query labels',
  'live data query center / pocket',
  'live data provider place ids',
  'live data venue evidence summary',
  'live data address/location evidence',
  'live data categories/types evidence',
  'live data hours/open-status evidence',
  'live data rating/review evidence',
  'live data website/phone evidence',
  'live data raw evidence availability flags',
  'live data source path classification',
  'Taste live field support',
  'Taste missing/thin evidence',
  'Bearings evidence summary',
  'Bearings missing constraint evidence',
  'selected route role sequence',
  'Great Stop evidence source',
  'live data came through',
  'live data missing',
  'live evidence sufficient',
  'live evidence thin',
  'local MVP representation requirements',
  'engine ownership for gaps',
  'another live call justified? yes/no',
] as const

type OutputColumn = (typeof outputColumns)[number]
type ProofRow = Record<OutputColumn, string>

interface BudgetSnapshot {
  date: string
  cap: number
  used: number
  remaining: number
}

interface FetchCounters {
  fieldProxyCalls: number
  providerCalls: number
  hostedCalls: number
  fieldProxyLabels: string[]
  centerKeys: Set<string>
  providerStatuses: string[]
}

interface LifecycleObservation {
  routeLabel: string
  contractEntryProduced: boolean
  runtimeRouteProduced: boolean
  greatStopPassFail: PassFail
  greatStopFailureReasons: string
  reviewLockEligible: boolean
  staticCorpusUsed: boolean
  dryPathUsed: boolean
  fallbackUsed: boolean
  providerShadowUsed: boolean
  demoSpecialUsed: boolean
  appAuthorityShadowUsed: boolean
  legacyWrapperUsed: boolean
  diagnosticOnly: boolean
  honestFail: boolean
  roleScore: string
  stopShapeFit: string
  lensCompatibility: string
  contextSpecificity: string
  thresholdSource: string
  evidenceStatus: string
  selectedWindDownVenue: string
  philzCandidateScopeNumerics: string
  philzRouteScopeNumerics: string
  selectedWindDownRouteScopeNumerics: string
  contractEntryStatus: string
  runtimeRouteStatus: string
  greatStopEvaluationStatus: string
  reviewLockStatus: string
  lifecycleCaptureStatus: string
  routeAuthoritySnapshotStatus: string
  routeAuthoritySourceLabel: string
  routeAuthorityRejectionReasons: string
  lockInputStatus: string
  lockInputRejectionReason: string
  runtimeLockTruthStatus: string
  runtimeLockTruthReason: string
  lifecycleInputAvailability: string
  itineraryMissing: boolean
  scoredVenuesMissing: boolean
  runtimeLockEligibilityMissing: boolean
  greatStopStatusMissing: boolean
  routeLevelLockTruthSourceMissing: boolean
  compatibilityRouteTruth: boolean
  canonicalRouteTruth: boolean
  approvedPayloadCompatibility: boolean
  pageLocalRouteUsed: boolean
  selectedRouteArtifactUsed: boolean
  curateRefinementEntryPayloadUsed: boolean
  runtimeRouteArtifactCanonical: boolean
  whyNotMvpGreen: string
  liveDataProviderSourceName: string
  liveDataQueryLabels: string
  liveDataQueryCenterPocket: string
  liveDataProviderPlaceIds: string
  liveDataVenueEvidenceSummary: string
  liveDataAddressLocationEvidence: string
  liveDataCategoriesTypesEvidence: string
  liveDataHoursOpenStatusEvidence: string
  liveDataRatingReviewEvidence: string
  liveDataWebsitePhoneEvidence: string
  liveDataRawEvidenceAvailabilityFlags: string
  liveDataSourcePathClassification: string
  tasteLiveFieldSupport: string
  tasteMissingThinEvidence: string
  bearingsEvidenceSummary: string
  bearingsMissingConstraintEvidence: string
  selectedRouteRoleSequence: string
  greatStopEvidenceSource: string
  liveDataCameThrough: string
  liveDataMissing: string
  liveEvidenceSufficient: string
  liveEvidenceThin: string
  localMvpRepresentationRequirements: string
  engineOwnershipForGaps: string
  anotherLiveCallJustified: boolean
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function yesNo(value: boolean): YesNo {
  return value ? 'yes' : 'no'
}

function readGitMetadata(args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function writeCsv(path: string, rows: ProofRow[]): void {
  const lines = [
    outputColumns.map(escapeCsv).join(','),
    ...rows.map((row) => outputColumns.map((column) => escapeCsv(row[column])).join(',')),
  ]
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8')
}

function writeNdjson(path: string, rows: ProofRow[]): void {
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')
}

function missingColumnsFor(row: ProofRow): string[] {
  return outputColumns.filter((column) => row[column] === undefined || row[column] === null || row[column] === '')
}

function joinReasonList(values: readonly string[] | null | undefined): string {
  const reasons = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
  return reasons.length > 0 ? reasons.join('|') : 'none'
}

function joinValueList(values: readonly (string | undefined | null)[]): string {
  const filtered = [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
  return filtered.length > 0 ? filtered.join('|') : 'unavailable'
}

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : 'unavailable'
}

function parsePositiveIntegerEnv(key: string): number | null {
  const value = process.env[key]?.trim()
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function snapshotManagedEnv(): Map<string, string | undefined> {
  return new Map(managedEnvKeys.map((key) => [key, process.env[key]] as const))
}

function restoreManagedEnv(snapshot: Map<string, string | undefined>): void {
  for (const key of managedEnvKeys) {
    const original = snapshot.get(key)
    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
  }
}

function buildCurateCoffeeBooksInput(starterPack: { personaBias?: PersonaMode | null; primaryAnchor: VibeAnchor; secondaryAnchors?: VibeAnchor[]; distanceMode?: IntentInput['distanceMode']; lensPreset?: { discoveryBias?: string } }): IntentInput {
  return {
    mode: 'curate',
    persona: starterPack.personaBias ?? null,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode ?? 'nearby',
    prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
  }
}

function findScoredVenueForVenueId(scoredVenues: ScoredVenue[], venueId: string | undefined): ScoredVenue | null {
  if (!venueId) {
    return null
  }
  return (
    scoredVenues.find(
      (candidate) =>
        candidate.venue.id === venueId ||
        candidate.candidateIdentity.baseVenueId === venueId ||
        candidate.candidateIdentity.candidateId === venueId,
    ) ?? null
  )
}

function findWindDownScoredVenue(result: GeneratePlanResult): { stopName: string; scoredVenue: ScoredVenue | null } {
  const windDownStop = result.itinerary.stops.find((stop) => stop.role === 'windDown')
  const routeStop = result.selectedArc.stops.find((stop) => stop.role === 'cooldown')
  return {
    stopName: windDownStop?.venueName ?? routeStop?.scoredVenue.venue.name ?? 'unavailable',
    scoredVenue:
      findScoredVenueForVenueId(result.scoredVenues, windDownStop?.venueId) ??
      routeStop?.scoredVenue ??
      null,
  }
}

function formatWindDownNumerics(scoredVenue: ScoredVenue | null): {
  roleScore: string
  stopShapeFit: string
  lensCompatibility: string
  contextSpecificity: string
  summary: string
} {
  const roleScore = formatNumber(scoredVenue?.roleScores.cooldown)
  const stopShapeFit = formatNumber(scoredVenue?.stopShapeFit.windDown)
  const lensCompatibility = formatNumber(scoredVenue?.lensCompatibility)
  const contextSpecificity = formatNumber(scoredVenue?.contextSpecificity.byRole.cooldown)
  return {
    roleScore,
    stopShapeFit,
    lensCompatibility,
    contextSpecificity,
    summary: `roleScore=${roleScore}; stopShapeFit=${stopShapeFit}; lensCompatibility=${lensCompatibility}; contextSpecificity=${contextSpecificity}`,
  }
}

type LiveEvidenceContractFields = Pick<
  LifecycleObservation,
  | 'liveDataProviderSourceName'
  | 'liveDataQueryLabels'
  | 'liveDataQueryCenterPocket'
  | 'liveDataProviderPlaceIds'
  | 'liveDataVenueEvidenceSummary'
  | 'liveDataAddressLocationEvidence'
  | 'liveDataCategoriesTypesEvidence'
  | 'liveDataHoursOpenStatusEvidence'
  | 'liveDataRatingReviewEvidence'
  | 'liveDataWebsitePhoneEvidence'
  | 'liveDataRawEvidenceAvailabilityFlags'
  | 'liveDataSourcePathClassification'
  | 'tasteLiveFieldSupport'
  | 'tasteMissingThinEvidence'
  | 'bearingsEvidenceSummary'
  | 'bearingsMissingConstraintEvidence'
  | 'selectedRouteRoleSequence'
  | 'greatStopEvidenceSource'
  | 'liveDataCameThrough'
  | 'liveDataMissing'
  | 'liveEvidenceSufficient'
  | 'liveEvidenceThin'
  | 'localMvpRepresentationRequirements'
  | 'engineOwnershipForGaps'
  | 'anotherLiveCallJustified'
>

function buildUnavailableLiveEvidenceContract(reason: string): LiveEvidenceContractFields {
  return {
    liveDataProviderSourceName: 'unavailable_stopped_before_provider',
    liveDataQueryLabels: 'unavailable_stopped_before_provider',
    liveDataQueryCenterPocket: 'unavailable_stopped_before_provider',
    liveDataProviderPlaceIds: 'unavailable_stopped_before_provider',
    liveDataVenueEvidenceSummary: 'unavailable_stopped_before_provider',
    liveDataAddressLocationEvidence: 'unavailable_stopped_before_provider',
    liveDataCategoriesTypesEvidence: 'unavailable_stopped_before_provider',
    liveDataHoursOpenStatusEvidence: 'unavailable_stopped_before_provider',
    liveDataRatingReviewEvidence: 'unavailable_stopped_before_provider',
    liveDataWebsitePhoneEvidence: 'unavailable_stopped_before_provider',
    liveDataRawEvidenceAvailabilityFlags: 'unavailable_stopped_before_provider',
    liveDataSourcePathClassification: 'provider-shadow:stopped_before_provider',
    tasteLiveFieldSupport: 'unavailable_stopped_before_provider',
    tasteMissingThinEvidence: reason,
    bearingsEvidenceSummary: 'unavailable_stopped_before_provider',
    bearingsMissingConstraintEvidence: reason,
    selectedRouteRoleSequence: 'unavailable_stopped_before_provider',
    greatStopEvidenceSource: 'missing_evidence_not_evaluated',
    liveDataCameThrough: 'none',
    liveDataMissing: reason,
    liveEvidenceSufficient: 'no',
    liveEvidenceThin: 'yes',
    localMvpRepresentationRequirements:
      'Field readiness and governed live evidence must be captured before local MVP fixture/closeout requirements can be determined.',
    engineOwnershipForGaps: `Field: ${reason}`,
    anotherLiveCallJustified: true,
  }
}

function buildLiveEvidenceContractFields(params: {
  artifact: ContractEntryArtifact
  counters: FetchCounters
  fallbackUsed: boolean
  providerShadowUsed: boolean
  result: GeneratePlanResult
  staticCorpusUsed: boolean
  windDown: { stopName: string; scoredVenue: ScoredVenue | null }
}): LiveEvidenceContractFields {
  const fieldSummary = params.artifact.enrichment?.fieldProvenanceSummary
  const tasteDistrictSummary = params.artifact.enrichment?.tasteDistrictSummary
  const source = params.windDown.scoredVenue?.venue.source
  const venue = params.windDown.scoredVenue?.venue
  const liveScoredVenues = params.result.scoredVenues.filter(
    (candidate) =>
      candidate.venue.source.sourceOrigin === 'live' ||
      Boolean(candidate.venue.source.provider) ||
      Boolean(candidate.venue.source.providerRecordId),
  )
  const providerPlaceIds = liveScoredVenues.map((candidate) => candidate.venue.source.providerRecordId)
  const queryLabels = joinValueList([
    ...(fieldSummary?.queryLabels ?? []),
    ...params.counters.fieldProxyLabels,
    source?.sourceQueryLabel,
  ])
  const pocketValues = joinValueList([
    params.artifact.selection.pocketId,
    tasteDistrictSummary?.pocketId,
    tasteDistrictSummary?.districtLabel,
    params.artifact.enrichment?.locationContext?.areaHint,
    ...[...params.counters.centerKeys].map((centerKey) => `center:${centerKey}`),
  ])
  const hasAddress = Boolean(source?.formattedAddress?.trim())
  const hasLocation = typeof source?.latitude === 'number' && typeof source.longitude === 'number'
  const hasHours =
    source?.hoursKnown === true ||
    typeof source?.openNow === 'boolean' ||
    Boolean(source?.runtimeHoursTextHoursAvailable) ||
    Boolean(source?.runtimeHoursStructuredPeriodCount)
  const hasRating = typeof source?.rating === 'number' || typeof source?.reviewCount === 'number'
  const hasSourceTypes = (source?.sourceTypes?.length ?? 0) > 0
  const missingSourceFields = source?.missingFields ?? []
  const thinEvidence = [
    !hasAddress ? 'missing_address' : null,
    !hasLocation ? 'missing_location' : null,
    !hasHours ? 'missing_hours_open_status' : null,
    !hasRating ? 'missing_rating_review_count' : null,
    !hasSourceTypes ? 'missing_categories_types' : null,
  ].filter((value): value is string => Boolean(value))
  const sourcePathClassification = [
    fieldSummary?.liveProviderUsed === true ? 'live_provider' : null,
    params.staticCorpusUsed ? 'static' : null,
    params.fallbackUsed ? 'fallback' : null,
    params.providerShadowUsed ? 'provider-shadow' : null,
    fieldSummary?.corpusUsed === true ? 'corpus' : null,
  ].filter((value): value is string => Boolean(value))
  const roleCoverage = params.artifact.enrichment?.canonicalRouteRoleCoverage
  const roleSequence = [
    roleCoverage?.start ? `start:${roleCoverage.start}` : null,
    roleCoverage?.highlight ? `highlight:${roleCoverage.highlight}` : null,
    roleCoverage?.windDown ? `windDown:${roleCoverage.windDown}` : null,
  ].filter((value): value is string => Boolean(value))
  const bearingsStatus = params.artifact.enrichment?.bearingsAdmissionProof?.status ?? 'not_run'
  const runtimeEligibility = params.artifact.enrichment?.runtimeLockEligibility
  const missingConstraintEvidence = [
    params.artifact.selection.pocketId || tasteDistrictSummary?.pocketId ? null : 'missing_pocket',
    typeof venue?.driveMinutes === 'number' ? null : 'missing_distance_movement',
    hasHours ? null : 'missing_hours_feasibility',
    bearingsStatus === 'present' ? null : `bearings_admission_${bearingsStatus}`,
    runtimeEligibility ? null : 'missing_runtime_lock_eligibility',
    ...missingSourceFields.map((field) => `source_missing_${field}`),
  ].filter((value): value is string => Boolean(value))
  const liveDataCameThrough =
    liveScoredVenues.length > 0
      ? `live_scored_venues=${liveScoredVenues.length}; providerCalls=${params.counters.providerCalls}; fieldProxyCalls=${params.counters.fieldProxyCalls}`
      : 'none'
  const liveDataMissing = [...thinEvidence, ...missingConstraintEvidence]
  const evidenceSufficient = liveScoredVenues.length > 0 && thinEvidence.length === 0 && missingConstraintEvidence.length === 0

  return {
    liveDataProviderSourceName: fieldSummary?.provider ?? source?.provider ?? 'unavailable',
    liveDataQueryLabels: queryLabels,
    liveDataQueryCenterPocket: pocketValues,
    liveDataProviderPlaceIds: joinValueList(providerPlaceIds),
    liveDataVenueEvidenceSummary: venue
      ? `selected=${venue.name}; liveCandidates=${liveScoredVenues.length}; sourceOrigin=${source?.sourceOrigin ?? 'unavailable'}`
      : 'selected venue unavailable',
    liveDataAddressLocationEvidence: `hasAddress=${yesNo(hasAddress)}; hasLocation=${yesNo(hasLocation)}; address=${hasAddress ? 'present_redacted' : 'unavailable'}; latLng=${hasLocation ? 'present' : 'unavailable'}`,
    liveDataCategoriesTypesEvidence: `category=${venue?.category ?? 'unavailable'}; subcategory=${venue?.subcategory ?? 'unavailable'}; sourceTypes=${joinValueList(source?.sourceTypes ?? [])}`,
    liveDataHoursOpenStatusEvidence: `hoursKnown=${yesNo(source?.hoursKnown === true)}; openNow=${typeof source?.openNow === 'boolean' ? yesNo(source.openNow) : 'unavailable'}; likelyOpenForCurrentWindow=${yesNo(source?.likelyOpenForCurrentWindow === true)}; businessStatus=${source?.businessStatus ?? 'unavailable'}; runtimeHoursPlanWindowProofStatus=${source?.runtimeHoursPlanWindowProofStatus ?? 'unavailable'}`,
    liveDataRatingReviewEvidence: `rating=${formatNumber(source?.rating)}; reviewCount=${typeof source?.reviewCount === 'number' ? String(source.reviewCount) : 'unavailable'}`,
    liveDataWebsitePhoneEvidence: 'not_captured_by_current_VenueSourceMetadata',
    liveDataRawEvidenceAvailabilityFlags: `providerPlaceId=${yesNo(Boolean(source?.providerRecordId))}; address=${yesNo(hasAddress)}; location=${yesNo(hasLocation)}; categoriesTypes=${yesNo(hasSourceTypes)}; hours=${yesNo(hasHours)}; ratingReview=${yesNo(hasRating)}; websitePhone=no`,
    liveDataSourcePathClassification: sourcePathClassification.length > 0 ? sourcePathClassification.join('|') : 'unavailable',
    tasteLiveFieldSupport: `scores=${formatWindDownNumerics(params.windDown.scoredVenue).summary}; supportedFields=${joinValueList([
      hasSourceTypes ? 'categories_types' : null,
      hasAddress ? 'address' : null,
      hasLocation ? 'location' : null,
      hasHours ? 'hours' : null,
      hasRating ? 'rating_review' : null,
    ])}`,
    tasteMissingThinEvidence: thinEvidence.length > 0 ? thinEvidence.join('|') : 'none',
    bearingsEvidenceSummary: `district=${tasteDistrictSummary?.districtLabel ?? 'unavailable'}; pocket=${params.artifact.selection.pocketId ?? tasteDistrictSummary?.pocketId ?? 'unavailable'}; driveMinutes=${typeof venue?.driveMinutes === 'number' ? String(venue.driveMinutes) : 'unavailable'}; hoursFeasibility=${hasHours ? 'present' : 'missing'}; PlaceRight=${bearingsStatus}; requiredAnchorSurvival=${runtimeEligibility?.buildMetadata?.missingRoles?.length ? 'missing_roles' : 'not_blocked_by_missing_roles'}; admissibility=${bearingsStatus}`,
    bearingsMissingConstraintEvidence:
      missingConstraintEvidence.length > 0 ? missingConstraintEvidence.join('|') : 'none',
    selectedRouteRoleSequence: roleSequence.length > 0 ? roleSequence.join(' -> ') : 'unavailable',
    greatStopEvidenceSource:
      fieldSummary?.liveProviderUsed === true && !params.providerShadowUsed
        ? 'live_evidence_carried'
        : params.providerShadowUsed
          ? 'provider_shadow_or_missing_live_evidence'
          : 'recomputed_or_defaulted_evidence',
    liveDataCameThrough,
    liveDataMissing: liveDataMissing.length > 0 ? liveDataMissing.join('|') : 'none',
    liveEvidenceSufficient: yesNo(evidenceSufficient),
    liveEvidenceThin: yesNo(!evidenceSufficient),
    localMvpRepresentationRequirements: evidenceSufficient
      ? 'Sanitized live evidence can be considered for local fixture/proof representation after explicit approval; raw provider payloads still must not be committed.'
      : 'Represent missing/thin live evidence locally only after sanitized capture approval; do not infer absent provider fields as local truth.',
    engineOwnershipForGaps: liveDataMissing.length > 0
      ? [
          thinEvidence.some((value) => value.includes('address') || value.includes('location') || value.includes('categories') || value.includes('hours') || value.includes('rating'))
            ? `Field: ${thinEvidence.join('|')}`
            : null,
          missingConstraintEvidence.length > 0 ? `Bearings: ${missingConstraintEvidence.join('|')}` : null,
          params.providerShadowUsed ? 'Field: provider-shadow/live-provider evidence missing' : null,
          params.staticCorpusUsed ? 'Field: static corpus participation' : null,
          params.fallbackUsed ? 'Waypoint/Application: fallback participation requires trace' : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join('; ')
      : 'none',
    anotherLiveCallJustified: !evidenceSufficient,
  }
}

function findPhilzScoredVenue(scoredVenues: ScoredVenue[]): ScoredVenue | null {
  return (
    scoredVenues.find((candidate) => {
      const haystack = [
        candidate.venue.id,
        candidate.venue.name,
        candidate.candidateIdentity.baseVenueId,
        candidate.candidateIdentity.candidateId,
        candidate.venue.source.providerRecordId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes('philz')
    }) ?? null
  )
}

function detectFallbackUsed(result: GeneratePlanResult): boolean {
  const values = [
    result.contractEntryArtifact.sourceMode,
    result.contractEntryArtifact.enrichment?.fieldProvenanceSummary?.provenanceId,
    ...(result.contractEntryArtifact.enrichment?.fieldProvenanceSummary?.queryLabels ?? []),
    ...result.itinerary.stops.map((stop) => stop.fallbackLabel ?? ''),
  ]
  return values.some((value) => value.toLowerCase().includes('fallback'))
}

function buildRow(params: {
  observation: LifecycleObservation
  providerCalls: number
  hostedCalls: number
}): ProofRow {
  const disqualifyingMasking =
    params.observation.staticCorpusUsed ||
    params.observation.dryPathUsed ||
    params.observation.fallbackUsed ||
    params.observation.providerShadowUsed ||
    params.observation.demoSpecialUsed ||
    params.observation.appAuthorityShadowUsed ||
    params.observation.legacyWrapperUsed
  const lineagePopulated =
    params.observation.routeAuthoritySourceLabel.trim().length > 0 &&
    params.observation.runtimeLockTruthStatus.trim().length > 0
  const falseGreenRisk = disqualifyingMasking || params.observation.compatibilityRouteTruth
  const validLiveProofPass =
    params.providerCalls > 0 &&
    params.providerCalls <= 3 &&
    params.hostedCalls === 0 &&
    params.observation.contractEntryProduced &&
    params.observation.runtimeRouteProduced &&
    params.observation.canonicalRouteTruth &&
    params.observation.greatStopPassFail === 'pass' &&
    params.observation.reviewLockEligible &&
    lineagePopulated &&
    !params.observation.compatibilityRouteTruth &&
    !params.observation.diagnosticOnly &&
    !disqualifyingMasking
  const apparentPass =
    params.observation.contractEntryProduced &&
    (params.observation.runtimeRouteProduced ||
      params.observation.greatStopPassFail === 'pass' ||
      params.observation.reviewLockEligible)
  const invalidFalseGreen =
    apparentPass &&
    !validLiveProofPass &&
    !params.observation.diagnosticOnly &&
    !params.observation.honestFail

  return {
    mode: 'curate',
    'starter/family': 'Coffee & Books / coffee-books',
    'route id / route label': params.observation.routeLabel,
    'support source': 'governed_live_field_route_ingress',
    'candidate producer': 'runGovernedFieldProxyRoutePlanBuild',
    'support-screen producer': 'not_applicable_route_lifecycle_proof',
    'materialization/projection source': 'runGovernedFieldProxyRoutePlanBuild -> buildArtifactBackedVisibleItinerary -> buildContractEntryRuntimeRouteLockTruth',
    'Great Stop producer': 'runGeneratePlanForGovernedRouteIngress carried Great Stop/runtime lock eligibility when available',
    'routeAuthority/Application involvement': 'routeAuthority observed as compatibility gate over ContractEntryArtifact/RuntimeRouteArtifact',
    'ContractEntryArtifact produced? yes/no': yesNo(params.observation.contractEntryProduced),
    'RuntimeRouteArtifact produced? yes/no': yesNo(params.observation.runtimeRouteProduced),
    'Great Stop pass/fail': params.observation.greatStopPassFail,
    'Great Stop failure reasons': params.observation.greatStopFailureReasons,
    'Review/Lock eligible? yes/no': yesNo(params.observation.reviewLockEligible),
    'provider calls count': String(params.providerCalls),
    'hosted calls count': String(params.hostedCalls),
    'static corpus used? yes/no': yesNo(params.observation.staticCorpusUsed),
    'dry path used? yes/no': yesNo(params.observation.dryPathUsed),
    'fallback used? yes/no': yesNo(params.observation.fallbackUsed),
    'provider-shadow used? yes/no': yesNo(params.observation.providerShadowUsed),
    'DEMO-SPECIAL path used? yes/no': yesNo(params.observation.demoSpecialUsed),
    'app-authority shadow used? yes/no': yesNo(params.observation.appAuthorityShadowUsed),
    'legacy wrapper used? yes/no': yesNo(params.observation.legacyWrapperUsed),
    'diagnostic-only? yes/no': yesNo(params.observation.diagnosticOnly),
    'valid live proof pass? yes/no': yesNo(validLiveProofPass),
    'valid MVP pass? yes/no': yesNo(validLiveProofPass),
    'honest-fail? yes/no': yesNo(params.observation.honestFail),
    roleScore: params.observation.roleScore,
    stopShapeFit: params.observation.stopShapeFit,
    lensCompatibility: params.observation.lensCompatibility,
    contextSpecificity: params.observation.contextSpecificity,
    'threshold source': params.observation.thresholdSource,
    'evidence persisted/carried/recomputed/defaulted/unavailable': params.observation.evidenceStatus,
    'selected windDown venue': params.observation.selectedWindDownVenue,
    'Philz candidate-scope numerics if Philz appears': params.observation.philzCandidateScopeNumerics,
    'Philz route-scope numerics if Philz appears': params.observation.philzRouteScopeNumerics,
    'selected windDown route-scope numerics if not Philz': params.observation.selectedWindDownRouteScopeNumerics,
    'ContractEntryArtifact status': params.observation.contractEntryStatus,
    'RuntimeRouteArtifact status': params.observation.runtimeRouteStatus,
    'Great Stop evaluation status': params.observation.greatStopEvaluationStatus,
    'Review/Lock status': params.observation.reviewLockStatus,
    'lifecycle capture status': params.observation.lifecycleCaptureStatus,
    'routeAuthority snapshot status': params.observation.routeAuthoritySnapshotStatus,
    'routeAuthority source label': params.observation.routeAuthoritySourceLabel,
    'routeAuthority rejection reasons': params.observation.routeAuthorityRejectionReasons,
    'lock input status': params.observation.lockInputStatus,
    'lock input rejection reason': params.observation.lockInputRejectionReason,
    'runtime lock truth status': params.observation.runtimeLockTruthStatus,
    'runtime lock truth reason': params.observation.runtimeLockTruthReason,
    'lifecycle input availability': params.observation.lifecycleInputAvailability,
    'itinerary missing? yes/no': yesNo(params.observation.itineraryMissing),
    'scored venues missing? yes/no': yesNo(params.observation.scoredVenuesMissing),
    'runtime lock eligibility missing? yes/no': yesNo(params.observation.runtimeLockEligibilityMissing),
    'Great Stop status missing? yes/no': yesNo(params.observation.greatStopStatusMissing),
    'route-level lock truth source missing? yes/no': yesNo(params.observation.routeLevelLockTruthSourceMissing),
    'compatibility route truth? yes/no': yesNo(params.observation.compatibilityRouteTruth),
    'canonical route truth? yes/no': yesNo(params.observation.canonicalRouteTruth),
    'approved payload compatibility? yes/no': yesNo(params.observation.approvedPayloadCompatibility),
    'page-local route used? yes/no': yesNo(params.observation.pageLocalRouteUsed),
    'SelectedRouteArtifact used? yes/no': yesNo(params.observation.selectedRouteArtifactUsed),
    'CurateRefinementEntryPayload used? yes/no': yesNo(params.observation.curateRefinementEntryPayloadUsed),
    'RuntimeRouteArtifact canonical? yes/no': yesNo(params.observation.runtimeRouteArtifactCanonical),
    'false-green risk? yes/no': yesNo(falseGreenRisk),
    'why not MVP green': validLiveProofPass ? 'valid live proof pass' : params.observation.whyNotMvpGreen,
    'invalid false-green? yes/no': yesNo(invalidFalseGreen),
    'proof validity label': validLiveProofPass
      ? 'valid_live_proof_pass'
      : params.observation.honestFail
        ? 'founder_approved_honest_fail'
        : params.observation.diagnosticOnly
          ? 'diagnostic_only_not_mvp_green'
          : 'invalid_false_green',
    'live data provider/source name': params.observation.liveDataProviderSourceName,
    'live data query labels': params.observation.liveDataQueryLabels,
    'live data query center / pocket': params.observation.liveDataQueryCenterPocket,
    'live data provider place ids': params.observation.liveDataProviderPlaceIds,
    'live data venue evidence summary': params.observation.liveDataVenueEvidenceSummary,
    'live data address/location evidence': params.observation.liveDataAddressLocationEvidence,
    'live data categories/types evidence': params.observation.liveDataCategoriesTypesEvidence,
    'live data hours/open-status evidence': params.observation.liveDataHoursOpenStatusEvidence,
    'live data rating/review evidence': params.observation.liveDataRatingReviewEvidence,
    'live data website/phone evidence': params.observation.liveDataWebsitePhoneEvidence,
    'live data raw evidence availability flags': params.observation.liveDataRawEvidenceAvailabilityFlags,
    'live data source path classification': params.observation.liveDataSourcePathClassification,
    'Taste live field support': params.observation.tasteLiveFieldSupport,
    'Taste missing/thin evidence': params.observation.tasteMissingThinEvidence,
    'Bearings evidence summary': params.observation.bearingsEvidenceSummary,
    'Bearings missing constraint evidence': params.observation.bearingsMissingConstraintEvidence,
    'selected route role sequence': params.observation.selectedRouteRoleSequence,
    'Great Stop evidence source': params.observation.greatStopEvidenceSource,
    'live data came through': params.observation.liveDataCameThrough,
    'live data missing': params.observation.liveDataMissing,
    'live evidence sufficient': params.observation.liveEvidenceSufficient,
    'live evidence thin': params.observation.liveEvidenceThin,
    'local MVP representation requirements': params.observation.localMvpRepresentationRequirements,
    'engine ownership for gaps': params.observation.engineOwnershipForGaps,
    'another live call justified? yes/no': yesNo(params.observation.anotherLiveCallJustified),
  }
}

function buildStoppedBeforeProviderObservation(reason: string): LifecycleObservation {
  return {
    routeLabel: 'phase-3r-live-proof-stopped-before-provider',
    contractEntryProduced: false,
    runtimeRouteProduced: false,
    greatStopPassFail: 'not_evaluated',
    greatStopFailureReasons: reason,
    reviewLockEligible: false,
    staticCorpusUsed: false,
    dryPathUsed: false,
    fallbackUsed: false,
    providerShadowUsed: true,
    demoSpecialUsed: false,
    appAuthorityShadowUsed: false,
    legacyWrapperUsed: false,
    diagnosticOnly: true,
    honestFail: false,
    roleScore: 'unavailable',
    stopShapeFit: 'unavailable',
    lensCompatibility: 'unavailable',
    contextSpecificity: 'unavailable',
    thresholdSource: 'roleScore 0.5; stopShapeFit 0.34; lensCompatibility 0.38; contextSpecificity 0.3',
    evidenceStatus: 'unavailable_stopped_before_provider',
    selectedWindDownVenue: 'not produced',
    philzCandidateScopeNumerics: 'Philz did not appear; still unknown',
    philzRouteScopeNumerics: 'Philz did not appear; still unknown',
    selectedWindDownRouteScopeNumerics: 'not produced',
    contractEntryStatus: 'not produced',
    runtimeRouteStatus: 'not produced',
    greatStopEvaluationStatus: 'not evaluated',
    reviewLockStatus: 'not evaluated',
    lifecycleCaptureStatus: 'blocked',
    routeAuthoritySnapshotStatus: 'not_evaluated',
    routeAuthoritySourceLabel: 'none',
    routeAuthorityRejectionReasons: reason,
    lockInputStatus: 'not_evaluated',
    lockInputRejectionReason: reason,
    runtimeLockTruthStatus: 'not_evaluated',
    runtimeLockTruthReason: reason,
    lifecycleInputAvailability: reason,
    itineraryMissing: true,
    scoredVenuesMissing: true,
    runtimeLockEligibilityMissing: true,
    greatStopStatusMissing: true,
    routeLevelLockTruthSourceMissing: true,
    compatibilityRouteTruth: false,
    canonicalRouteTruth: false,
    approvedPayloadCompatibility: false,
    pageLocalRouteUsed: false,
    selectedRouteArtifactUsed: false,
    curateRefinementEntryPayloadUsed: false,
    runtimeRouteArtifactCanonical: false,
    whyNotMvpGreen: `stopped before provider: ${reason}`,
    ...buildUnavailableLiveEvidenceContract(reason),
  }
}

async function readBudgetSnapshot(cap: number): Promise<BudgetSnapshot> {
  const { createFieldLedgerStoreFromEnv } = await import('../api/field/_lib/fieldLedgerStore.ts')
  const store = createFieldLedgerStoreFromEnv()
  if (!store) {
    throw new Error('durable_store_unavailable')
  }
  return store.getBudgetSnapshot(todayIsoDate(), cap)
}

async function dispatchFieldProxyRequest(body: unknown): Promise<Response> {
  const handlerModule = await import('../api/field/text-search.ts')
  const handler = handlerModule.default
  let statusCode = 200
  let payload: unknown = null
  await handler(
    {
      method: 'POST',
      body,
    },
    {
      status(status: number) {
        statusCode = status
        return this
      },
      json(value: unknown) {
        payload = value
      },
      setHeader() {
        return undefined
      },
    },
  )
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeUrlPrefix(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null
  }
  try {
    return new URL(value.trim()).href.replace(/\/+$/g, '')
  } catch {
    return null
  }
}

function isConfiguredKvRestUrl(url: string, configuredKvRestUrl: string | null): boolean {
  if (!configuredKvRestUrl) {
    return false
  }
  try {
    const normalizedUrl = new URL(url).href.replace(/\/+$/g, '')
    return normalizedUrl === configuredKvRestUrl || normalizedUrl.startsWith(`${configuredKvRestUrl}/`)
  } catch {
    return false
  }
}

function redactNetworkUrl(url: string): string {
  return isConfiguredKvRestUrl(url, normalizeUrlPrefix(process.env.KV_REST_API_URL))
    ? '<redacted KV_REST_API_URL>'
    : url
}

function installGovernedFetch(counters: FetchCounters, originalFetch: typeof fetch): void {
  const configuredKvRestUrl = normalizeUrlPrefix(process.env.KV_REST_API_URL)
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('vercel.app') || url.includes('vercel.com')) {
      counters.hostedCalls += 1
      throw new Error(`Hosted/Vercel URL is not approved for Phase 3R: ${redactNetworkUrl(url)}`)
    }
    if (url === fieldProxyPath || url.endsWith(fieldProxyPath)) {
      counters.fieldProxyCalls += 1
      if (counters.fieldProxyCalls > 3) {
        throw new Error(`Field proxy envelope exceeded maxProviderCalls=3; got ${counters.fieldProxyCalls}`)
      }
      const bodyText = typeof init?.body === 'string' ? init.body : '{}'
      const body = JSON.parse(bodyText) as FieldTextSearchRequest
      assert(body.purpose === 'retrieval_supply', `Expected retrieval_supply purpose, got ${body.purpose}`)
      assert(body.mode === 'curate', `Expected curate mode, got ${body.mode}`)
      assert(approvedQueryLabels.has(body.queryLabel), `Unexpected query label: ${body.queryLabel}`)
      counters.fieldProxyLabels.push(body.queryLabel)
      if (body.center) {
        counters.centerKeys.add(`${body.center.lat.toFixed(5)},${body.center.lng.toFixed(5)}`)
      }
      if (body.radiusMeters !== undefined) {
        assert(body.radiusMeters <= 1200, `Coffee & Books live proof radius exceeded 1200m: ${body.radiusMeters}`)
      }
      return dispatchFieldProxyRequest(body)
    }
    if (url === googleTextSearchEndpoint) {
      counters.providerCalls += 1
      if (counters.providerCalls > 3) {
        throw new Error(`Provider envelope exceeded maxProviderCalls=3; got ${counters.providerCalls}`)
      }
      return originalFetch(input, init)
    }
    if (isConfiguredKvRestUrl(url, configuredKvRestUrl)) {
      return originalFetch(input, init)
    }
    throw new Error(`Unexpected network URL in local governed live proof runner: ${redactNetworkUrl(url)}`)
  }) as typeof fetch
}

async function observeLiveLifecycle(params: {
  result: GeneratePlanResult
  counters: FetchCounters
}): Promise<LifecycleObservation> {
  const { buildLockInputFromRouteAuthoritySnapshot, buildRouteAuthoritySnapshot } = await import(
    '../src/app/services/routeAuthority/routeAuthorityService.ts'
  )
  const { buildArtifactBackedVisibleItinerary } = await import(
    '../src/app/services/canonicalPublicRouteTruthService.ts'
  )
  const { buildContractEntryRuntimeRouteLockTruth } = await import(
    '../src/app/services/live/contractEntryLockHandoff.ts'
  )

  const artifact: ContractEntryArtifact = params.result.contractEntryArtifact
  const runtimeLockEligibility = artifact.enrichment?.runtimeLockEligibility ?? null
  const greatStopStatus = runtimeLockEligibility?.greatStopStatus ?? params.result.trace.greatStopGateResult?.status ?? null
  const greatStopFailureReasons =
    joinReasonList(runtimeLockEligibility?.greatStopRejectionReasons) !== 'none'
      ? joinReasonList(runtimeLockEligibility?.greatStopRejectionReasons)
      : joinReasonList(params.result.trace.greatStopGateResult?.reasons)
  const selectedDirectionId =
    artifact.selection.directionId ??
    params.result.intentProfile.selectedDirectionContext?.directionId ??
    params.result.trace.selectedDistrictId ??
    'phase-3r-live-proof'
  const selectedClusterConfirmation =
    params.result.trace.selectedDistrictLabel || artifact.districtAnchorLine || 'Phase 3R live proof route'
  const persona = (params.result.intentProfile.persona ?? 'romantic') as PersonaMode
  const vibe = params.result.intentProfile.primaryAnchor as VibeAnchor
  const artifactBackedItinerary = buildArtifactBackedVisibleItinerary({
    artifact,
    itinerary: params.result.itinerary,
    context: {
      mode: 'curate',
      starterPack: params.result.trace.selectedArtifactLineage ? undefined : undefined,
    },
  })
  const windDown = findWindDownScoredVenue(params.result)
  const windDownNumerics = formatWindDownNumerics(windDown.scoredVenue)
  const philzScoredVenue = findPhilzScoredVenue(params.result.scoredVenues)
  const philzNumerics = philzScoredVenue ? formatWindDownNumerics(philzScoredVenue).summary : 'Philz did not appear; still unknown'
  const fieldSummary = artifact.enrichment?.fieldProvenanceSummary
  const staticCorpusUsed = fieldSummary?.sourceMode !== 'live' || fieldSummary?.corpusUsed === true
  const providerShadowUsed =
    params.counters.providerCalls === 0 ||
    fieldSummary?.liveProviderUsed !== true ||
    !params.counters.providerStatuses.every((status) => status === 'google_places_text_search')
  const fallbackUsed = detectFallbackUsed(params.result)
  const evidenceContract = buildLiveEvidenceContractFields({
    artifact,
    counters: params.counters,
    fallbackUsed,
    providerShadowUsed,
    result: params.result,
    staticCorpusUsed,
    windDown,
  })

  if (!artifactBackedItinerary) {
    const snapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: artifact,
      greatStopStatus,
      selectedDirectionId,
      selectedArtifactId: artifact.id,
      selectedClusterConfirmation,
    })
    const lockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    return {
      routeLabel: artifact.id,
      contractEntryProduced: true,
      runtimeRouteProduced: false,
      greatStopPassFail: greatStopStatus === 'PASS' ? 'pass' : greatStopStatus === 'FAIL' ? 'fail' : 'not_evaluated',
      greatStopFailureReasons,
      reviewLockEligible: lockInput.ok,
      staticCorpusUsed,
      dryPathUsed: false,
      fallbackUsed,
      providerShadowUsed,
      demoSpecialUsed: false,
      appAuthorityShadowUsed: false,
      legacyWrapperUsed: false,
      diagnosticOnly: true,
      honestFail: false,
      roleScore: windDownNumerics.roleScore,
      stopShapeFit: windDownNumerics.stopShapeFit,
      lensCompatibility: windDownNumerics.lensCompatibility,
      contextSpecificity: windDownNumerics.contextSpecificity,
      thresholdSource: 'roleScore 0.5; stopShapeFit 0.34; lensCompatibility 0.38; contextSpecificity 0.3',
      evidenceStatus: 'carried_from_live_generation_but_runtime_materialization_unavailable',
      selectedWindDownVenue: windDown.stopName,
      philzCandidateScopeNumerics: philzNumerics,
      philzRouteScopeNumerics: philzScoredVenue ? philzNumerics : 'Philz did not appear; still unknown',
      selectedWindDownRouteScopeNumerics: philzScoredVenue ? 'not_applicable_philz_present' : windDownNumerics.summary,
      contractEntryStatus: 'produced',
      runtimeRouteStatus: 'blocked',
      greatStopEvaluationStatus:
        greatStopStatus === 'PASS' ? 'evaluated-pass' : greatStopStatus === 'FAIL' ? 'evaluated-fail' : 'not observed',
      reviewLockStatus: lockInput.ok ? 'eligible' : 'ineligible',
      lifecycleCaptureStatus: 'blocked',
      routeAuthoritySnapshotStatus: snapshot.validationStatus,
      routeAuthoritySourceLabel: snapshot.sourceLabel,
      routeAuthorityRejectionReasons: joinReasonList(snapshot.rejectionReasons),
      lockInputStatus: lockInput.ok ? 'eligible' : 'blocked',
      lockInputRejectionReason: lockInput.ok
        ? 'none'
        : lockInput.diagnostics.rejectionReason ?? 'missing_lock_ready_canonical_route_truth',
      runtimeLockTruthStatus: 'blocked',
      runtimeLockTruthReason: 'missing_artifact_backed_visible_itinerary',
      lifecycleInputAvailability: 'missing_artifact_backed_visible_itinerary',
      itineraryMissing: false,
      scoredVenuesMissing: false,
      runtimeLockEligibilityMissing: !runtimeLockEligibility,
      greatStopStatusMissing: !greatStopStatus,
      routeLevelLockTruthSourceMissing: true,
      compatibilityRouteTruth: false,
      canonicalRouteTruth: false,
      approvedPayloadCompatibility: false,
      pageLocalRouteUsed: false,
      selectedRouteArtifactUsed: false,
      curateRefinementEntryPayloadUsed: false,
      runtimeRouteArtifactCanonical: false,
      whyNotMvpGreen: 'artifact-backed itinerary unavailable; RuntimeRouteArtifact blocked',
      ...evidenceContract,
    }
  }

  const lockTruth = buildContractEntryRuntimeRouteLockTruth({
    artifact,
    itinerary: artifactBackedItinerary,
    scoredVenues: params.result.scoredVenues,
    selectedDirectionId,
    selectedClusterConfirmation,
    city: artifactBackedItinerary.city,
    persona,
    vibe,
    mode: 'curate' as ExperienceMode,
  })
  const runtimeRouteArtifact: RuntimeRouteArtifact | null = lockTruth.ok ? lockTruth.finalRoute : null
  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    runtimeRouteArtifact,
    greatStopStatus,
    selectedDirectionId,
    selectedArtifactId: artifact.id,
    selectedClusterConfirmation,
    itinerary: lockTruth.ok ? lockTruth.itinerary : artifactBackedItinerary,
  })
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: artifactBackedItinerary.city,
  })
  const lockReadySource = snapshot.lockReadyCanonicalRouteTruthCandidate?.source ?? null
  const canonicalRouteTruth =
    Boolean(runtimeRouteArtifact) &&
    (lockReadySource === 'contract_entry_artifact.runtime_route_artifact' ||
      lockReadySource === 'runtime_route_artifact')
  const appAuthorityShadowUsed = !canonicalRouteTruth || snapshot.sourceLabel !== 'contract_entry_artifact.runtime_route_artifact'

  return {
    routeLabel: artifact.id,
    contractEntryProduced: true,
    runtimeRouteProduced: lockTruth.ok,
    greatStopPassFail: greatStopStatus === 'PASS' ? 'pass' : greatStopStatus === 'FAIL' ? 'fail' : 'not_evaluated',
    greatStopFailureReasons,
    reviewLockEligible: lockInput.ok,
    staticCorpusUsed,
    dryPathUsed: false,
    fallbackUsed,
    providerShadowUsed,
    demoSpecialUsed: false,
    appAuthorityShadowUsed,
    legacyWrapperUsed: false,
    diagnosticOnly: staticCorpusUsed || fallbackUsed || providerShadowUsed || appAuthorityShadowUsed || !lockTruth.ok,
    honestFail: !lockInput.ok && greatStopStatus === 'FAIL',
    roleScore: windDownNumerics.roleScore,
    stopShapeFit: windDownNumerics.stopShapeFit,
    lensCompatibility: windDownNumerics.lensCompatibility,
    contextSpecificity: windDownNumerics.contextSpecificity,
    thresholdSource: 'roleScore 0.5; stopShapeFit 0.34; lensCompatibility 0.38; contextSpecificity 0.3',
    evidenceStatus: 'carried_from_governed_live_generation',
    selectedWindDownVenue: windDown.stopName,
    philzCandidateScopeNumerics: philzNumerics,
    philzRouteScopeNumerics: philzScoredVenue ? philzNumerics : 'Philz did not appear; still unknown',
    selectedWindDownRouteScopeNumerics: philzScoredVenue ? 'not_applicable_philz_present' : windDownNumerics.summary,
    contractEntryStatus: 'produced',
    runtimeRouteStatus: lockTruth.ok ? 'produced' : 'blocked',
    greatStopEvaluationStatus:
      greatStopStatus === 'PASS' ? 'evaluated-pass' : greatStopStatus === 'FAIL' ? 'evaluated-fail' : 'not observed',
    reviewLockStatus: lockInput.ok ? 'eligible' : 'ineligible',
    lifecycleCaptureStatus: lockTruth.ok && greatStopStatus && lockInput.ok ? 'complete' : 'partial',
    routeAuthoritySnapshotStatus: snapshot.validationStatus,
    routeAuthoritySourceLabel: snapshot.sourceLabel,
    routeAuthorityRejectionReasons: joinReasonList(snapshot.rejectionReasons),
    lockInputStatus: lockInput.ok ? 'eligible' : 'blocked',
    lockInputRejectionReason: lockInput.ok
      ? 'none'
      : lockInput.diagnostics.rejectionReason ?? 'missing_lock_ready_canonical_route_truth',
    runtimeLockTruthStatus: lockTruth.ok ? 'produced' : 'blocked',
    runtimeLockTruthReason: lockTruth.ok ? 'RuntimeRouteArtifact produced by buildContractEntryRuntimeRouteLockTruth' : lockTruth.reason,
    lifecycleInputAvailability: lockTruth.ok ? 'available' : `runtime_lock_truth_blocked:${lockTruth.reason}`,
    itineraryMissing: false,
    scoredVenuesMissing: false,
    runtimeLockEligibilityMissing: !runtimeLockEligibility,
    greatStopStatusMissing: !greatStopStatus,
    routeLevelLockTruthSourceMissing: !runtimeRouteArtifact,
    compatibilityRouteTruth: lockReadySource === 'contract_entry_artifact.approved_payload',
    canonicalRouteTruth,
    approvedPayloadCompatibility: false,
    pageLocalRouteUsed: false,
    selectedRouteArtifactUsed: false,
    curateRefinementEntryPayloadUsed: false,
    runtimeRouteArtifactCanonical: canonicalRouteTruth,
    whyNotMvpGreen: [
      staticCorpusUsed ? 'static corpus used' : null,
      fallbackUsed ? 'fallback used' : null,
      providerShadowUsed ? 'provider-shadow used' : null,
      appAuthorityShadowUsed ? 'app-authority shadow used' : null,
      !lockTruth.ok ? `runtime route blocked:${lockTruth.reason}` : null,
      !lockInput.ok ? `Review/Lock blocked:${lockInput.diagnostics.rejectionReason ?? 'unknown'}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join('; ') || 'valid live proof pass',
    ...evidenceContract,
  }
}

async function runLiveProof(): Promise<{
  rows: ProofRow[]
  budgetBefore: BudgetSnapshot | null
  budgetAfter: BudgetSnapshot | null
  counters: FetchCounters
  valveOpened: boolean
  valveDisarmed: boolean
}> {
  const counters: FetchCounters = {
    fieldProxyCalls: 0,
    providerCalls: 0,
    hostedCalls: 0,
    fieldProxyLabels: [],
    centerKeys: new Set(),
    providerStatuses: [],
  }
  const originalFetch = globalThis.fetch
  const envSnapshot = snapshotManagedEnv()
  let valveOpened = false
  let valveDisarmed = false
  let budgetBefore: BudgetSnapshot | null = null
  let budgetAfter: BudgetSnapshot | null = null

  try {
    if (process.env[liveApprovalEnvKey] !== '1') {
      return {
        rows: [
          buildRow({
            observation: buildStoppedBeforeProviderObservation(`${liveApprovalEnvKey}_missing`),
            providerCalls: counters.providerCalls,
            hostedCalls: counters.hostedCalls,
          }),
        ],
        budgetBefore,
        budgetAfter,
        counters,
        valveOpened,
        valveDisarmed: true,
      }
    }

    assert(process.env.GOOGLE_PLACES_API_KEY?.trim(), 'GOOGLE_PLACES_API_KEY_missing')
    assert(process.env.KV_REST_API_URL?.trim(), 'KV_REST_API_URL_missing')
    assert(process.env.KV_REST_API_TOKEN?.trim(), 'KV_REST_API_TOKEN_missing')
    const dailyCap = parsePositiveIntegerEnv('ID8_PROVIDER_DAILY_CALL_CAP')
    assert(dailyCap !== null, 'ID8_PROVIDER_DAILY_CALL_CAP_missing_or_invalid')
    budgetBefore = await readBudgetSnapshot(dailyCap)
    assert(budgetBefore.remaining >= 3, `provider_budget_remaining_below_approved_3_calls:${budgetBefore.remaining}`)

    process.env.VITE_ID8_PROVIDER_ENABLE_RETRIEVAL_SUPPLY = '1'
    process.env.VITE_ID8_PROVIDER_RETRIEVAL_SUPPLY_BILLABLE_CALL_CAP = '3'
    process.env.VITE_ID8_PROVIDER_BILLABLE_CALL_CAP = '3'
    process.env.ID8_FIELD_PROVIDER = providerActivationValue
    valveOpened = true
    installGovernedFetch(counters, originalFetch)

    const { starterPacks } = await import('../src/data/starterPacks.ts')
    const { runGovernedFieldProxyRoutePlanBuild } = await import('../src/app/services/arcApplicationService.ts')
    const starterPack = starterPacks.find((pack) => pack.id === 'coffee-books')
    assert(starterPack, 'coffee_books_starter_pack_missing')
    const result = await runGovernedFieldProxyRoutePlanBuild(buildCurateCoffeeBooksInput(starterPack), {
      starterPack,
    })
    assert(counters.fieldProxyCalls <= 3, `field_proxy_calls_exceeded_3:${counters.fieldProxyCalls}`)
    assert(counters.providerCalls <= 3, `provider_calls_exceeded_3:${counters.providerCalls}`)
    assert(counters.centerKeys.size <= 1, `maxCenters_exceeded_1:${counters.centerKeys.size}`)
    const observation = await observeLiveLifecycle({ result, counters })
    budgetAfter = await readBudgetSnapshot(dailyCap)
    assert(
      budgetAfter.used - budgetBefore.used <= 3,
      `provider_budget_delta_exceeded_3:${budgetBefore.used}->${budgetAfter.used}`,
    )
    return {
      rows: [
        buildRow({
          observation,
          providerCalls: counters.providerCalls,
          hostedCalls: counters.hostedCalls,
        }),
      ],
      budgetBefore,
      budgetAfter,
      counters,
      valveOpened,
      valveDisarmed,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      rows: [
        buildRow({
          observation: buildStoppedBeforeProviderObservation(message),
          providerCalls: counters.providerCalls,
          hostedCalls: counters.hostedCalls,
        }),
      ],
      budgetBefore,
      budgetAfter,
      counters,
      valveOpened,
      valveDisarmed,
    }
  } finally {
    globalThis.fetch = originalFetch
    restoreManagedEnv(envSnapshot)
    valveDisarmed = true
  }
}

const result = await runLiveProof()
const rows = result.rows
const missingColumns = rows.flatMap((row, index) =>
  missingColumnsFor(row).map((column) => ({ row: index + 1, column })),
)

assert(missingColumns.length === 0, `Missing Phase 3R live proof columns: ${JSON.stringify(missingColumns)}`)
assert(
  rows.every((row) => row['compatibility route truth? yes/no'] !== 'yes' || row['valid live proof pass? yes/no'] === 'no'),
  'Compatibility route truth rows must not be marked as valid live proof passes.',
)
assert(
  rows.every((row) => row['dry path used? yes/no'] !== 'yes' || row['valid live proof pass? yes/no'] === 'no'),
  'Dry-path rows must not be marked as valid live proof passes.',
)
assert(
  rows.every((row) => row['static corpus used? yes/no'] !== 'yes' || row['valid live proof pass? yes/no'] === 'no'),
  'Static/local corpus rows must not be marked as valid live proof passes.',
)
assert(
  rows.every((row) => row['DEMO-SPECIAL path used? yes/no'] !== 'yes' || row['valid live proof pass? yes/no'] === 'no'),
  'DEMO-SPECIAL rows must not be marked as valid live proof passes.',
)
assert(
  rows.every((row) => row['provider-shadow used? yes/no'] !== 'yes' || row['valid live proof pass? yes/no'] === 'no'),
  'Provider-shadow rows must not be marked as valid live proof passes.',
)
assert(
  rows.every((row) => row['app-authority shadow used? yes/no'] !== 'yes' || row['valid live proof pass? yes/no'] === 'no'),
  'App-authority shadow rows must not be marked as valid live proof passes.',
)

const outputDir = join(process.cwd(), '.audit-output-614a103', 'phase-3-live-proof-gate')
mkdirSync(outputDir, { recursive: true })
const csvPath = join(outputDir, 'phase-3-mvp-proof-gate-live.csv')
const ndjsonPath = join(outputDir, 'phase-3-mvp-proof-gate-live.ndjson')
const jsonPath = join(outputDir, 'phase-3-mvp-proof-gate-live.json')
const markdownPath = join(outputDir, 'phase-3-mvp-proof-gate-live-summary.md')

const liveApprovalFlagPresent = process.env[liveApprovalEnvKey] === '1'
const stopReason =
  rows.map((row) => row['Great Stop failure reasons']).find((reason) => reason !== 'none') ?? 'none'
const runLabel = liveApprovalFlagPresent
  ? result.valveOpened
    ? 'live-approved run'
    : 'live-readiness stopped before provider'
  : 'dry/default run'

const summary = {
  generatedAt: new Date().toISOString(),
  head: readGitMetadata(['rev-parse', '--short', 'HEAD']),
  branch: readGitMetadata(['branch', '--show-current']),
  phase: `Phase 3T governed live proof runner ${runLabel}`,
  liveApprovalFlagPresent,
  stopReason,
  providerCalls: result.counters.providerCalls,
  fieldProxyCalls: result.counters.fieldProxyCalls,
  hostedCalls: result.counters.hostedCalls,
  fieldProxyLabels: result.counters.fieldProxyLabels,
  maxCentersObserved: result.counters.centerKeys.size,
  rowsProduced: rows.length,
  validLiveProofPasses: rows.filter((row) => row['valid live proof pass? yes/no'] === 'yes').length,
  validMvpPasses: rows.filter((row) => row['valid MVP pass? yes/no'] === 'yes').length,
  diagnosticOnlyRows: rows.filter((row) => row['diagnostic-only? yes/no'] === 'yes').length,
  honestFails: rows.filter((row) => row['honest-fail? yes/no'] === 'yes').length,
  invalidFalseGreens: rows.filter((row) => row['invalid false-green? yes/no'] === 'yes').length,
  budgetBefore: result.budgetBefore,
  budgetAfter: result.budgetAfter,
  valveOpened: result.valveOpened,
  valveDisarmed: true,
  missingColumns,
  outputColumns,
}

writeCsv(csvPath, rows)
writeNdjson(ndjsonPath, rows)
writeFileSync(jsonPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8')
writeFileSync(
  markdownPath,
  [
    '# Phase 3 Governed Live Proof Gate Summary',
    '',
    `- phase: ${summary.phase}`,
    `- head: ${summary.head}`,
    `- branch: ${summary.branch}`,
    `- live approval flag present: ${yesNo(summary.liveApprovalFlagPresent)}`,
    `- stop reason: ${summary.stopReason}`,
    `- provider calls: ${summary.providerCalls}`,
    `- field proxy calls: ${summary.fieldProxyCalls}`,
    `- hosted calls: ${summary.hostedCalls}`,
    `- max centers observed: ${summary.maxCentersObserved}`,
    `- rows produced: ${summary.rowsProduced}`,
    `- valid live proof passes: ${summary.validLiveProofPasses}`,
    `- valid MVP passes: ${summary.validMvpPasses}`,
    `- diagnostic-only rows: ${summary.diagnosticOnlyRows}`,
    `- honest-fails: ${summary.honestFails}`,
    `- invalid false-greens: ${summary.invalidFalseGreens}`,
    `- valve opened: ${yesNo(summary.valveOpened)}`,
    `- valve disarmed: ${yesNo(summary.valveDisarmed)}`,
    `- missing columns: ${summary.missingColumns.length}`,
    '',
    '## Rows',
    '',
    ...rows.map((row, index) =>
      [
        `### Row ${index + 1} - ${row['route id / route label']}`,
        '',
        `- valid live proof pass: ${row['valid live proof pass? yes/no']}`,
        `- valid MVP pass: ${row['valid MVP pass? yes/no']}`,
        `- diagnostic-only: ${row['diagnostic-only? yes/no']}`,
        `- provider calls: ${row['provider calls count']}`,
        `- selected windDown venue: ${row['selected windDown venue']}`,
        `- ContractEntryArtifact status: ${row['ContractEntryArtifact status']}`,
        `- RuntimeRouteArtifact status: ${row['RuntimeRouteArtifact status']}`,
        `- Great Stop status: ${row['Great Stop pass/fail']}`,
        `- Review/Lock status: ${row['Review/Lock status']}`,
        `- false-green risk: ${row['false-green risk? yes/no']}`,
        `- why not MVP green: ${row['why not MVP green']}`,
      ].join('\n'),
    ),
    '',
    '## Live Data Evidence / MVP Local Build Requirements',
    '',
    ...rows.map((row, index) =>
      [
        `### Row ${index + 1} - ${row['route id / route label']}`,
        '',
        `- provider/source: ${row['live data provider/source name']}`,
        `- query labels: ${row['live data query labels']}`,
        `- query center / pocket: ${row['live data query center / pocket']}`,
        `- live data came through: ${row['live data came through']}`,
        `- live data missing: ${row['live data missing']}`,
        `- evidence sufficient: ${row['live evidence sufficient']}`,
        `- evidence thin: ${row['live evidence thin']}`,
        `- Taste support: ${row['Taste live field support']}`,
        `- Taste missing/thin evidence: ${row['Taste missing/thin evidence']}`,
        `- Bearings evidence: ${row['Bearings evidence summary']}`,
        `- Bearings missing constraints: ${row['Bearings missing constraint evidence']}`,
        `- Great Stop evidence source: ${row['Great Stop evidence source']}`,
        `- local MVP representation requirements: ${row['local MVP representation requirements']}`,
        `- engine ownership for gaps: ${row['engine ownership for gaps']}`,
        `- another live call justified: ${row['another live call justified? yes/no']}`,
      ].join('\n'),
    ),
    '',
  ].join('\n'),
  'utf8',
)

process.stdout.write(
  `phase 3 governed live proof runner: ${runLabel} completed with liveApprovalFlagPresent=${yesNo(summary.liveApprovalFlagPresent)}, stopReason=${summary.stopReason}, provider calls=${summary.providerCalls}, valveOpened=${yesNo(summary.valveOpened)}, valveDisarmed=${yesNo(summary.valveDisarmed)}\n`,
)
