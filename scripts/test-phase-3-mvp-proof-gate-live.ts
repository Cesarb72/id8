import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { FieldTextSearchRequest } from '../src/domain/field/fieldProxyTypes.ts'
import type { GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type {
  FieldCandidateClass,
  LiveQueryCandidateDispositionDiagnostics,
  ProvisionalLeakageGuardStatus,
  RoleCompetitionDiagnostics,
  StaticLiveIdentityOverlapClassification,
  StaticLiveIdentityOverlapDiagnostic,
  SupportRoleRejectionDiagnostic,
  SupportRoleRejectionFactor,
  SupportRoleRejectionOwnerClassification,
} from '../src/domain/types/diagnostics.ts'
import type { ExperienceMode, IntentInput, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'
import type { Itinerary, UserStopRole } from '../src/domain/types/itinerary.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

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
  'mode context adapter',
  'Curate starter context supplied? yes/no',
  'Surprise context carrier exercised? yes/no',
  'Build context carrier exercised? yes/no',
  'future mode context requirement',
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
  'provider attrition by query',
  'provider attrition totals',
  'provider candidate selection counts',
  'provider candidate rejection reasons',
  'selected stop source origins',
  'selected windDown evidence availability flags',
  'surviving live candidate evidence availability flags',
  'perQueryRawProviderRecords',
  'perQueryMappedProviderRecords',
  'perQueryPreFilterNormalizedRecords',
  'aggregateEffectiveLiveVenues',
  'aggregateQualityApprovedLiveVenues',
  'aggregateDemotedLiveVenues',
  'aggregateSuppressedLiveVenues',
  'aggregateMergedLiveVenues',
  'aggregateScoredRetrievalLiveVenues',
  'aggregateRolePoolLiveVenues',
  'aggregateFinalRouteLiveStops',
  'field attrition substage counts',
  'field attrition drop reasons by stage',
  'field pocket candidate diagnostics',
  'field quality gate candidate diagnostics',
  'field pocket/quality diagnostic rollups',
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
  mode: ExperienceMode
  starterFamily: string
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
  modeContextAdapter: string
  curateStarterContextSupplied: boolean
  surpriseContextCarrierExercised: boolean
  buildContextCarrierExercised: boolean
  futureModeContextRequirement: string
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
  providerAttritionByQuery: string
  providerAttritionTotals: string
  providerCandidateSelectionCounts: string
  providerCandidateRejectionReasons: string
  selectedStopSourceOrigins: string
  selectedWindDownEvidenceAvailabilityFlags: string
  survivingLiveCandidateEvidenceAvailabilityFlags: string
  perQueryRawProviderRecords: string
  perQueryMappedProviderRecords: string
  perQueryPreFilterNormalizedRecords: string
  aggregateEffectiveLiveVenues: string
  aggregateQualityApprovedLiveVenues: string
  aggregateDemotedLiveVenues: string
  aggregateSuppressedLiveVenues: string
  aggregateMergedLiveVenues: string
  aggregateScoredRetrievalLiveVenues: string
  aggregateRolePoolLiveVenues: string
  aggregateFinalRouteLiveStops: string
  fieldAttritionSubstageCounts: string
  fieldAttritionDropReasonsByStage: string
  fieldPocketCandidateDiagnostics: string
  fieldQualityGateCandidateDiagnostics: string
  fieldPocketQualityDiagnosticRollups: string
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

type RunnerContextStatus = 'supplied' | 'missing' | 'not_applicable' | 'not_exercised'

interface RunnerModeContext {
  mode: ExperienceMode
  curate: {
    starterPack: StarterPack | null
    status: RunnerContextStatus
  }
  surprise: {
    status: RunnerContextStatus
    selectedDirectionContextStatus: RunnerContextStatus
  }
  build: {
    status: RunnerContextStatus
    anchorContextStatus: RunnerContextStatus
  }
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

function buildCurateStarterPackInput(starterPack: { personaBias?: PersonaMode | null; primaryAnchor: VibeAnchor; secondaryAnchors?: VibeAnchor[]; distanceMode?: IntentInput['distanceMode']; lensPreset?: { discoveryBias?: string } }): IntentInput {
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

function buildCurateRunnerModeContext(starterPack: StarterPack | null): RunnerModeContext {
  return {
    mode: 'curate',
    curate: {
      starterPack,
      status: starterPack ? 'supplied' : 'missing',
    },
    surprise: {
      status: 'not_exercised',
      selectedDirectionContextStatus: 'not_exercised',
    },
    build: {
      status: 'not_exercised',
      anchorContextStatus: 'not_exercised',
    },
  }
}

function formatModeContextAdapter(context: RunnerModeContext): string {
  return [
    `mode=${context.mode}`,
    `curateStarter=${context.curate.status}`,
    `surpriseContext=${context.surprise.status}`,
    `buildContext=${context.build.status}`,
  ].join('; ')
}

function futureModeContextRequirement(context: RunnerModeContext): string {
  if (context.mode === 'curate') {
    return 'Curate rows must carry activeStarterPack/starterPack into artifact-backed itinerary validation.'
  }
  if (context.mode === 'surprise') {
    return 'Surprise rows must carry selectedDirectionContext/selectedDirectionId before artifact-backed itinerary, RuntimeRouteArtifact, and Review-Lock validation.'
  }
  return 'Build rows must carry selected anchor, required anchor role, and buildContext before artifact-backed itinerary, RuntimeRouteArtifact, and Review-Lock validation.'
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
  | 'providerAttritionByQuery'
  | 'providerAttritionTotals'
  | 'providerCandidateSelectionCounts'
  | 'providerCandidateRejectionReasons'
  | 'selectedStopSourceOrigins'
  | 'selectedWindDownEvidenceAvailabilityFlags'
  | 'survivingLiveCandidateEvidenceAvailabilityFlags'
  | 'perQueryRawProviderRecords'
  | 'perQueryMappedProviderRecords'
  | 'perQueryPreFilterNormalizedRecords'
  | 'aggregateEffectiveLiveVenues'
  | 'aggregateQualityApprovedLiveVenues'
  | 'aggregateDemotedLiveVenues'
  | 'aggregateSuppressedLiveVenues'
  | 'aggregateMergedLiveVenues'
  | 'aggregateScoredRetrievalLiveVenues'
  | 'aggregateRolePoolLiveVenues'
  | 'aggregateFinalRouteLiveStops'
  | 'fieldAttritionSubstageCounts'
  | 'fieldAttritionDropReasonsByStage'
  | 'fieldPocketCandidateDiagnostics'
  | 'fieldQualityGateCandidateDiagnostics'
  | 'fieldPocketQualityDiagnosticRollups'
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
    providerAttritionByQuery: 'unavailable_stopped_before_provider',
    providerAttritionTotals: 'unavailable_stopped_before_provider',
    providerCandidateSelectionCounts: 'unavailable_stopped_before_provider',
    providerCandidateRejectionReasons: reason,
    selectedStopSourceOrigins: 'unavailable_stopped_before_provider',
    selectedWindDownEvidenceAvailabilityFlags: 'unavailable_stopped_before_provider',
    survivingLiveCandidateEvidenceAvailabilityFlags: 'unavailable_stopped_before_provider',
    perQueryRawProviderRecords: 'unavailable_stopped_before_provider',
    perQueryMappedProviderRecords: 'unavailable_stopped_before_provider',
    perQueryPreFilterNormalizedRecords: 'unavailable_stopped_before_provider',
    aggregateEffectiveLiveVenues: 'unavailable_stopped_before_provider',
    aggregateQualityApprovedLiveVenues: 'unavailable_stopped_before_provider',
    aggregateDemotedLiveVenues: 'unavailable_stopped_before_provider',
    aggregateSuppressedLiveVenues: 'unavailable_stopped_before_provider',
    aggregateMergedLiveVenues: 'unavailable_stopped_before_provider',
    aggregateScoredRetrievalLiveVenues: 'unavailable_stopped_before_provider',
    aggregateRolePoolLiveVenues: 'unavailable_stopped_before_provider',
    aggregateFinalRouteLiveStops: 'unavailable_stopped_before_provider',
    fieldAttritionSubstageCounts: 'unavailable_stopped_before_provider',
    fieldAttritionDropReasonsByStage: reason,
    fieldPocketCandidateDiagnostics: 'unavailable_stopped_before_provider',
    fieldQualityGateCandidateDiagnostics: 'unavailable_stopped_before_provider',
    fieldPocketQualityDiagnosticRollups: 'unavailable_stopped_before_provider',
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

function countAvailability<T>(items: T[], predicate: (item: T) => boolean): string {
  const yesCount = items.filter(predicate).length
  return `yes=${yesCount}/no=${items.length - yesCount}`
}

function isLiveScoredVenue(candidate: ScoredVenue): boolean {
  return (
    candidate.venue.source.sourceOrigin === 'live' ||
    Boolean(candidate.venue.source.provider) ||
    Boolean(candidate.venue.source.providerRecordId)
  )
}

const fieldCandidateClassOrder: FieldCandidateClass[] = [
  'canonical_live_candidate',
  'provisional_live_candidate',
  'blocked_live_candidate',
  'curated_static_candidate',
]

function incrementClassCount(
  counts: Record<FieldCandidateClass, number>,
  candidateClass: FieldCandidateClass,
): void {
  counts[candidateClass] += 1
}

function buildEmptyFieldCandidateClassCounts(): Record<FieldCandidateClass, number> {
  return {
    canonical_live_candidate: 0,
    provisional_live_candidate: 0,
    blocked_live_candidate: 0,
    curated_static_candidate: 0,
  }
}

function fieldCandidateClassCountsFromDiagnostics(
  result: GeneratePlanResult,
): Record<FieldCandidateClass, number> {
  const counts = buildEmptyFieldCandidateClassCounts()
  for (const query of result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery) {
    for (const candidate of query.candidates ?? []) {
      incrementClassCount(counts, candidate.fieldCandidateClass)
    }
  }
  const curatedStaticCount =
    result.trace.retrievalDiagnostics.liveSource.liveCandidateSurvivalDiagnostics?.filter(
      (diagnostic) => diagnostic.fieldCandidateClass === 'curated_static_candidate',
    ).length ?? 0
  counts.curated_static_candidate += curatedStaticCount
  return counts
}

function formatFieldCandidateClassCounts(counts: Record<FieldCandidateClass, number>): string {
  return fieldCandidateClassOrder
    .map((candidateClass) => `${candidateClass}=${counts[candidateClass]}`)
    .join('; ')
}

type IdentityKeyKind = 'venue_id' | 'provider_id' | 'name'
type RouteEligibilitySurface = 'scored_venues' | 'selected_route'

interface IdentityKey {
  kind: IdentityKeyKind
  value: string
}

interface ProvisionalCandidateOverlap {
  provisional: LiveQueryCandidateDispositionDiagnostics
  surface: RouteEligibilitySurface
  matchKinds: IdentityKeyKind[]
  staticCanonicalVenueId?: string
  liveProviderDiagnosticId?: string
  selectedStaticLacksLiveLockEvidence: boolean
  liveObjectEnteredActualRouteEligibilityArrays: boolean
  liveObjectEnteredRouteTruth: boolean
}

interface ProvisionalLeakageGuardDiagnostic {
  status: ProvisionalLeakageGuardStatus
  classification: StaticLiveIdentityOverlapClassification
  routeTruthRisk: boolean
  scoredLeakCount: number
  routeLeakCount: number
  artifactEligibleCount: number
  scoredIdentityOverlapCount: number
  routeIdentityOverlapCount: number
  overlapDiagnostics: StaticLiveIdentityOverlapDiagnostic[]
}

function normalizeIdentityKey(key: string | undefined): string | null {
  const normalized = key?.trim().toLowerCase()
  return normalized ? normalized : null
}

function buildIdentityKeys(entries: Array<{ kind: IdentityKeyKind; value?: string }>): IdentityKey[] {
  return entries
    .map((entry) => {
      const value = normalizeIdentityKey(entry.value)
      return value ? { kind: entry.kind, value } : null
    })
    .filter((entry): entry is IdentityKey => Boolean(entry))
}

function queryCandidatesForClass(
  result: GeneratePlanResult,
  candidateClass: FieldCandidateClass,
): LiveQueryCandidateDispositionDiagnostics[] {
  const candidates: LiveQueryCandidateDispositionDiagnostics[] = []
  for (const query of result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery) {
    for (const candidate of query.candidates ?? []) {
      if (candidate.fieldCandidateClass !== candidateClass) {
        continue
      }
      candidates.push(candidate)
    }
  }
  return candidates
}

function identityKeysForQueryCandidate(
  candidate: LiveQueryCandidateDispositionDiagnostics,
): IdentityKey[] {
  return buildIdentityKeys([
    { kind: 'venue_id', value: candidate.venueId },
    { kind: 'provider_id', value: candidate.providerPlaceId },
    { kind: 'name', value: candidate.name },
  ])
}

function queryCandidateKeysForClass(
  result: GeneratePlanResult,
  candidateClass: FieldCandidateClass,
): Set<string> {
  const keys = new Set<string>()
  for (const candidate of queryCandidatesForClass(result, candidateClass)) {
    for (const key of identityKeysForQueryCandidate(candidate)) {
      keys.add(key.value)
    }
  }
  return keys
}

function queryCandidatesForGuard(result: GeneratePlanResult): LiveQueryCandidateDispositionDiagnostics[] {
  return [
    ...queryCandidatesForClass(result, 'provisional_live_candidate'),
    ...queryCandidatesForClass(result, 'blocked_live_candidate'),
  ]
}

function queryCandidateKeysForGuard(result: GeneratePlanResult): Set<string> {
  const keys = new Set<string>()
  for (const candidate of queryCandidatesForGuard(result)) {
    for (const key of identityKeysForQueryCandidate(candidate)) {
      keys.add(key.value)
    }
  }
  return keys
}

function scoredVenueIdentityKeys(candidate: ScoredVenue): IdentityKey[] {
  return buildIdentityKeys([
    { kind: 'venue_id', value: candidate.venue.id },
    { kind: 'name', value: candidate.venue.name },
    { kind: 'provider_id', value: candidate.venue.source.providerRecordId },
    { kind: 'venue_id', value: candidate.candidateIdentity.baseVenueId },
    { kind: 'venue_id', value: candidate.candidateIdentity.candidateId },
  ])
}

function scoredVenueKeys(candidate: ScoredVenue): string[] {
  return scoredVenueIdentityKeys(candidate).map((key) => key.value)
}

function matchingIdentityKinds(left: IdentityKey[], right: IdentityKey[]): IdentityKeyKind[] {
  const rightByValue = new Map<string, IdentityKeyKind[]>()
  for (const key of right) {
    rightByValue.set(key.value, [...(rightByValue.get(key.value) ?? []), key.kind])
  }
  const kinds = new Set<IdentityKeyKind>()
  for (const key of left) {
    if (!rightByValue.has(key.value)) {
      continue
    }
    kinds.add(key.kind)
    for (const rightKind of rightByValue.get(key.value) ?? []) {
      kinds.add(rightKind)
    }
  }
  return [...kinds]
}

function hasLiveLockEvidence(candidate: ScoredVenue | null): boolean {
  const source = candidate?.venue.source
  return Boolean(
    source?.providerRecordId?.trim() &&
      source.formattedAddress?.trim() &&
      typeof source.latitude === 'number' &&
      typeof source.longitude === 'number',
  )
}

function liveCandidateDisposition(
  candidate: LiveQueryCandidateDispositionDiagnostics,
): StaticLiveIdentityOverlapDiagnostic['liveCandidateDisposition'] {
  if (candidate.fieldCandidateClass === 'canonical_live_candidate') {
    return 'canonical_live_candidate'
  }
  if (candidate.fieldCandidateClass === 'blocked_live_candidate') {
    return 'blocked_live_candidate'
  }
  if (candidate.filterVerdict === 'rejected_outside_selected_envelope') {
    return 'provisional_outside_envelope'
  }
  return candidate.fieldCandidateClass === 'provisional_live_candidate'
    ? 'provisional_blocked_or_noncanonical'
    : 'unknown'
}

function nameSimilarityBasisFor(matchKinds: readonly IdentityKeyKind[]): StaticLiveIdentityOverlapDiagnostic['nameSimilarityBasis'] {
  if (matchKinds.includes('provider_id') || matchKinds.includes('venue_id')) {
    return 'id_or_provider_id_match'
  }
  if (matchKinds.includes('name')) {
    return 'exact_normalized_name_match'
  }
  return 'none'
}

function buildOverlapDiagnostic(
  overlap: ProvisionalCandidateOverlap,
  classification: StaticLiveIdentityOverlapClassification,
): StaticLiveIdentityOverlapDiagnostic {
  const routeTruthRisk =
    classification === 'real_provisional_route_truth_leak' ||
    (!overlap.liveObjectEnteredActualRouteEligibilityArrays &&
      Boolean(overlap.staticCanonicalVenueId) &&
      overlap.selectedStaticLacksLiveLockEvidence) ||
    (overlap.surface === 'selected_route' && classification === 'insufficient_evidence')
  return {
    classification,
    guardStatus:
      classification === 'real_provisional_route_truth_leak' ||
      classification === 'real_provisional_eligibility_leak'
        ? 'fail'
        : routeTruthRisk
          ? 'warn'
          : 'pass',
    ...(overlap.staticCanonicalVenueId ? { staticCanonicalVenueId: overlap.staticCanonicalVenueId } : {}),
    ...(overlap.liveProviderDiagnosticId ? { liveProviderDiagnosticId: overlap.liveProviderDiagnosticId } : {}),
    nameSimilarityBasis: nameSimilarityBasisFor(overlap.matchKinds),
    liveCandidateDisposition: liveCandidateDisposition(overlap.provisional),
    staticSelectedRouteLacksLiveLockEvidence: overlap.selectedStaticLacksLiveLockEvidence,
    liveObjectEnteredActualRouteEligibilityArrays: overlap.liveObjectEnteredActualRouteEligibilityArrays,
    routeTruthRisk,
    evidence: [
      `surface=${overlap.surface}`,
      `matchKinds=${overlap.matchKinds.join('+') || 'none'}`,
      `provisionalClass=${overlap.provisional.fieldCandidateClass}`,
      `provisionalProofEligible=${yesNo(overlap.provisional.proofEligible)}`,
      `provisionalDiagnosticOnly=${yesNo(overlap.provisional.diagnosticOnly)}`,
      `filterVerdict=${overlap.provisional.filterVerdict ?? 'unknown'}`,
      `staticSelectedRouteLacksLiveLockEvidence=${yesNo(overlap.selectedStaticLacksLiveLockEvidence)}`,
      `liveObjectEnteredActualRouteEligibilityArrays=${yesNo(overlap.liveObjectEnteredActualRouteEligibilityArrays)}`,
      `liveObjectEnteredRouteTruth=${yesNo(overlap.liveObjectEnteredRouteTruth)}`,
    ],
  }
}

function classifyOverlap(overlap: ProvisionalCandidateOverlap): StaticLiveIdentityOverlapClassification {
  const idOrProviderMatch =
    overlap.matchKinds.includes('venue_id') || overlap.matchKinds.includes('provider_id')
  if (overlap.surface === 'selected_route') {
    if (overlap.liveObjectEnteredRouteTruth || idOrProviderMatch) {
      return 'real_provisional_route_truth_leak'
    }
    if (!overlap.staticCanonicalVenueId) {
      return 'insufficient_evidence'
    }
    if (overlap.selectedStaticLacksLiveLockEvidence) {
      return 'identity_overlap_ambiguous'
    }
    return 'static_live_identity_overlap'
  }
  if (overlap.liveObjectEnteredActualRouteEligibilityArrays) {
    return 'real_provisional_eligibility_leak'
  }
  if (idOrProviderMatch) {
    return 'real_provisional_eligibility_leak'
  }
  if (overlap.staticCanonicalVenueId && overlap.selectedStaticLacksLiveLockEvidence) {
    return 'identity_overlap_ambiguous'
  }
  if (overlap.staticCanonicalVenueId) {
    return 'static_live_identity_overlap'
  }
  if (overlap.matchKinds.length === 0) {
    return 'proof_runner_false_positive'
  }
  return 'insufficient_evidence'
}

function strongestClassification(
  diagnostics: readonly StaticLiveIdentityOverlapDiagnostic[],
  fallback: StaticLiveIdentityOverlapClassification,
): StaticLiveIdentityOverlapClassification {
  const priority: StaticLiveIdentityOverlapClassification[] = [
    'real_provisional_route_truth_leak',
    'real_provisional_eligibility_leak',
    'identity_overlap_ambiguous',
    'static_live_identity_overlap',
    'insufficient_evidence',
    'proof_runner_false_positive',
  ]
  return priority.find((classification) =>
    diagnostics.some((diagnostic) => diagnostic.classification === classification),
  ) ?? fallback
}

function guardStatusFor(
  diagnostics: readonly StaticLiveIdentityOverlapDiagnostic[],
): ProvisionalLeakageGuardStatus {
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.classification === 'real_provisional_route_truth_leak' ||
        diagnostic.classification === 'real_provisional_eligibility_leak',
    )
  ) {
    return 'fail'
  }
  if (diagnostics.some((diagnostic) => diagnostic.routeTruthRisk)) {
    return 'warn'
  }
  return 'pass'
}

function buildProvisionalLeakageGuardDiagnostic(result: GeneratePlanResult): ProvisionalLeakageGuardDiagnostic {
  const provisionalCandidates = queryCandidatesForGuard(result)
  if (provisionalCandidates.length === 0) {
    return {
      status: 'pass',
      classification: 'proof_runner_false_positive',
      routeTruthRisk: false,
      scoredLeakCount: 0,
      routeLeakCount: 0,
      artifactEligibleCount: 0,
      scoredIdentityOverlapCount: 0,
      routeIdentityOverlapCount: 0,
      overlapDiagnostics: [],
    }
  }

  const overlaps: ProvisionalCandidateOverlap[] = []
  for (const provisional of provisionalCandidates) {
    const provisionalKeys = identityKeysForQueryCandidate(provisional)
    for (const scored of result.scoredVenues) {
      const matchKinds = matchingIdentityKinds(provisionalKeys, scoredVenueIdentityKeys(scored))
      if (matchKinds.length === 0) {
        continue
      }
      overlaps.push({
        provisional,
        surface: 'scored_venues',
        matchKinds,
        staticCanonicalVenueId: scored.venue.source.sourceOrigin === 'live' ? undefined : scored.venue.id,
        liveProviderDiagnosticId: provisional.providerPlaceId ?? provisional.venueId,
        selectedStaticLacksLiveLockEvidence: scored.venue.source.sourceOrigin !== 'live' && !hasLiveLockEvidence(scored),
        liveObjectEnteredActualRouteEligibilityArrays: scored.venue.source.sourceOrigin === 'live',
        liveObjectEnteredRouteTruth: false,
      })
    }
    for (const stop of result.itinerary.stops) {
      const routeKeys = buildIdentityKeys([
        { kind: 'venue_id', value: stop.venueId },
        { kind: 'name', value: stop.venueName },
      ])
      const matchKinds = matchingIdentityKinds(provisionalKeys, routeKeys)
      if (matchKinds.length === 0) {
        continue
      }
      const selectedScoredVenue = findScoredVenueForVenueId(result.scoredVenues, stop.venueId)
      const selectedIsLive = Boolean(selectedScoredVenue && isLiveScoredVenue(selectedScoredVenue))
      const idOrProviderMatch = matchKinds.includes('venue_id') || matchKinds.includes('provider_id')
      overlaps.push({
        provisional,
        surface: 'selected_route',
        matchKinds,
        staticCanonicalVenueId: selectedIsLive ? undefined : stop.venueId,
        liveProviderDiagnosticId: provisional.providerPlaceId ?? provisional.venueId,
        selectedStaticLacksLiveLockEvidence: !selectedIsLive && !hasLiveLockEvidence(selectedScoredVenue),
        liveObjectEnteredActualRouteEligibilityArrays: selectedIsLive,
        liveObjectEnteredRouteTruth: selectedIsLive || idOrProviderMatch,
      })
    }
  }

  const overlapDiagnostics = overlaps.map((overlap) =>
    buildOverlapDiagnostic(overlap, classifyOverlap(overlap)),
  )
  const scoredLeakCount = overlapDiagnostics.filter(
    (diagnostic) =>
      diagnostic.classification === 'real_provisional_eligibility_leak' &&
      diagnostic.evidence.includes('surface=scored_venues'),
  ).length
  const routeLeakCount = overlapDiagnostics.filter(
    (diagnostic) =>
      diagnostic.classification === 'real_provisional_route_truth_leak' &&
      diagnostic.evidence.includes('surface=selected_route'),
  ).length
  const routeTruthRisk = overlapDiagnostics.some((diagnostic) => diagnostic.routeTruthRisk)
  return {
    status: guardStatusFor(overlapDiagnostics),
    classification: strongestClassification(overlapDiagnostics, 'proof_runner_false_positive'),
    routeTruthRisk,
    scoredLeakCount,
    routeLeakCount,
    artifactEligibleCount: routeLeakCount > 0 && Boolean(result.contractEntryArtifact) ? routeLeakCount : 0,
    scoredIdentityOverlapCount: overlapDiagnostics.filter((diagnostic) =>
      diagnostic.evidence.includes('surface=scored_venues'),
    ).length,
    routeIdentityOverlapCount: overlapDiagnostics.filter((diagnostic) =>
      diagnostic.evidence.includes('surface=selected_route'),
    ).length,
    overlapDiagnostics,
  }
}

function formatOverlapEvidence(
  diagnostics: readonly StaticLiveIdentityOverlapDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return 'none'
  }
  return diagnostics
    .slice(0, 5)
    .map((diagnostic) =>
      [
        `classification=${diagnostic.classification}`,
        `staticCanonicalVenueId=${diagnostic.staticCanonicalVenueId ?? 'unavailable'}`,
        `liveProviderDiagnosticId=${diagnostic.liveProviderDiagnosticId ?? 'unavailable'}`,
        `nameSimilarityBasis=${diagnostic.nameSimilarityBasis}`,
        `liveCandidateDisposition=${diagnostic.liveCandidateDisposition}`,
        `staticSelectedRouteLacksLiveLockEvidence=${yesNo(diagnostic.staticSelectedRouteLacksLiveLockEvidence)}`,
        `liveObjectEnteredActualRouteEligibilityArrays=${yesNo(diagnostic.liveObjectEnteredActualRouteEligibilityArrays)}`,
        `routeTruthRisk=${yesNo(diagnostic.routeTruthRisk)}`,
      ].join(','),
    )
    .join('|')
}

function resolveScoredVenueCandidateClass(
  result: GeneratePlanResult,
  candidate: ScoredVenue | null,
): FieldCandidateClass | 'live_candidate_class_unavailable' | 'selected_stop_class_unavailable' {
  if (!candidate) {
    return 'selected_stop_class_unavailable'
  }
  if (!isLiveScoredVenue(candidate)) {
    return 'curated_static_candidate'
  }
  const scoredKeys = scoredVenueKeys(candidate)
  for (const query of result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery) {
    for (const queryCandidate of query.candidates ?? []) {
      if (
        scoredKeys.some((key) =>
          [
            queryCandidate.venueId,
            queryCandidate.providerPlaceId,
            queryCandidate.name,
          ]
            .map((value) => value?.trim().toLowerCase())
            .includes(key),
        )
      ) {
        return queryCandidate.fieldCandidateClass
      }
    }
  }
  return 'live_candidate_class_unavailable'
}

function formatSelectedStopCandidateClasses(result: GeneratePlanResult): string {
  return result.itinerary.stops
    .map((stop) => {
      const scoredVenue = findScoredVenueForVenueId(result.scoredVenues, stop.venueId)
      return `${stop.role}:${resolveScoredVenueCandidateClass(result, scoredVenue)}`
    })
    .join('|')
}

function formatProvisionalRouteLeakage(result: GeneratePlanResult): string {
  const guard = buildProvisionalLeakageGuardDiagnostic(result)
  if (queryCandidateKeysForGuard(result).size === 0) {
    return [
      'provisionalLeakageGuard=pass',
      'provisionalLeakageGuardStatus=pass',
      'overlapClassification=proof_runner_false_positive',
      'routeTruthRisk=no',
      'identityOverlapEvidence=none',
      'provisionalInRetrievalVenues=not_observable:no_provisional_or_blocked_candidates',
      'provisionalInScoredVenues=0',
      'staticLiveIdentityOverlapInScoredVenues=0',
      'provisionalInRolePools=not_observable:no_provisional_or_blocked_candidates',
      'provisionalInSelectedRoute=0',
      'staticLiveIdentityOverlapInSelectedRoute=0',
      'provisionalArtifactEligible=0',
      'provisionalLockEligible=not_observable:no_provisional_or_blocked_candidates',
    ].join('; ')
  }
  return [
    `provisionalLeakageGuard=${guard.status}`,
    `provisionalLeakageGuardStatus=${guard.status}`,
    `overlapClassification=${guard.classification}`,
    `routeTruthRisk=${yesNo(guard.routeTruthRisk)}`,
    `identityOverlapEvidence=${formatOverlapEvidence(guard.overlapDiagnostics)}`,
    'provisionalInRetrievalVenues=not_observable:GeneratePlanResult_does_not_expose_retrieval_venues',
    `provisionalInScoredVenues=${guard.scoredLeakCount}`,
    `staticLiveIdentityOverlapInScoredVenues=${guard.scoredIdentityOverlapCount}`,
    'provisionalInRolePools=not_observable:no_per_candidate_role_pool_class_in_current_trace',
    `provisionalInSelectedRoute=${guard.routeLeakCount}`,
    `staticLiveIdentityOverlapInSelectedRoute=${guard.routeIdentityOverlapCount}`,
    `provisionalArtifactEligible=${guard.artifactEligibleCount}`,
    'provisionalLockEligible=not_observable:routeAuthority_lock_input_not_per_candidate_classed',
  ].join('; ')
}

const supportRoles: UserStopRole[] = ['start', 'highlight', 'surprise', 'windDown']

function roleScoreKey(role: UserStopRole): 'warmup' | 'peak' | 'wildcard' | 'cooldown' {
  if (role === 'start') return 'warmup'
  if (role === 'highlight') return 'peak'
  if (role === 'surprise') return 'wildcard'
  return 'cooldown'
}

function findLiveQueryCandidateForScoredVenue(
  result: GeneratePlanResult,
  candidate: ScoredVenue,
): LiveQueryCandidateDispositionDiagnostics | null {
  const scoredKeys = scoredVenueKeys(candidate)
  for (const query of result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery) {
    for (const queryCandidate of query.candidates ?? []) {
      const queryKeys = [
        queryCandidate.venueId,
        queryCandidate.providerPlaceId,
        queryCandidate.name,
      ]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
      if (scoredKeys.some((key) => queryKeys.includes(key))) {
        return queryCandidate
      }
    }
  }
  return null
}

function roleCompetitionEntries(
  result: GeneratePlanResult,
): Array<[UserStopRole, RoleCompetitionDiagnostics]> {
  return Object.entries(
    result.trace.retrievalDiagnostics.liveSource.roleCompetitionByRole ?? {},
  ).filter((entry): entry is [UserStopRole, RoleCompetitionDiagnostics] =>
    Boolean(entry[1]),
  )
}

function sameVenueId(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && left === right)
}

function liveCandidateEnteredAnyRolePool(
  result: GeneratePlanResult,
  candidate: ScoredVenue,
): boolean {
  return roleCompetitionEntries(result).some(([, comparison]) =>
    sameVenueId(comparison.strongestLive?.venueId, candidate.venue.id) &&
    comparison.liveEnteredRolePool,
  )
}

function liveRolePoolMembershipObservable(result: GeneratePlanResult): boolean {
  return sumRecordNumbers(result.trace.retrievalDiagnostics.liveSource.liveRolePoolCounts) === 0
}

function factorFromDeltaLabel(label: string): SupportRoleRejectionFactor | null {
  const normalized = label.toLowerCase()
  if (normalized.includes('lens compatibility')) return 'lens_compatibility'
  if (normalized.includes('role-pool score')) return 'role_pool_score'
  if (normalized.includes('highlight validity') || normalized.includes('highlight capability')) {
    return 'highlight_validity'
  }
  if (normalized.includes('signature score')) return 'signature_score'
  return null
}

function factorsForRoleRejection(comparison: RoleCompetitionDiagnostics): SupportRoleRejectionFactor[] {
  const factors = new Set<SupportRoleRejectionFactor>()
  for (const delta of comparison.strongestLiveVsCuratedDelta) {
    if (delta.favored !== 'curated') {
      continue
    }
    const factor = factorFromDeltaLabel(delta.label)
    if (factor) {
      factors.add(factor)
    }
  }
  if (comparison.strongestLiveLostAtStage === 'highlight-validity') {
    factors.add('highlight_validity')
  }
  if (comparison.strongestLiveLostAtStage === 'role-pool' && factors.size === 0) {
    factors.add('role_pool_score')
  }
  return factors.size > 0 ? [...factors] : ['insufficient_evidence']
}

function ownerForSupportRoleRejection(
  factors: readonly SupportRoleRejectionFactor[],
): SupportRoleRejectionOwnerClassification {
  if (factors.includes('admissibility')) return 'Bearings'
  if (factors.includes('identity_overlap')) return 'proof-runner'
  if (
    factors.includes('lens_compatibility') ||
    factors.includes('highlight_validity') ||
    factors.includes('signature_score')
  ) {
    return 'Taste'
  }
  if (factors.includes('role_pool_score')) return 'role-pool assembly'
  return 'insufficient evidence'
}

function supportRoleCandidateClass(
  queryCandidate: LiveQueryCandidateDispositionDiagnostics | null,
): SupportRoleRejectionDiagnostic['candidateClass'] {
  return queryCandidate?.fieldCandidateClass ?? 'not_retained'
}

function supportRoleSourceStage(
  queryCandidate: LiveQueryCandidateDispositionDiagnostics | null,
): SupportRoleRejectionDiagnostic['sourceStage'] {
  return queryCandidate?.sourceStage ?? 'not_retained'
}

function roleAffinityScores(candidate: ScoredVenue): SupportRoleRejectionDiagnostic['candidateRoleAffinities'] {
  return {
    start: candidate.roleScores?.warmup ?? 'not_observed',
    highlight: candidate.roleScores?.peak ?? 'not_observed',
    surprise: candidate.roleScores?.wildcard ?? 'not_observed',
    windDown: candidate.roleScores?.cooldown ?? 'not_observed',
  }
}

function hasTasteSupportEvidence(candidate: ScoredVenue): boolean {
  return (
    typeof candidate.lensCompatibility === 'number' &&
    Boolean(candidate.roleScores) &&
    Boolean(candidate.stopShapeFit) &&
    Boolean(candidate.contextSpecificity)
  )
}

function lensCompatibilityVerdict(score: number | undefined): 'pass' | 'fail' | 'not_observed' {
  if (typeof score !== 'number') return 'not_observed'
  return score >= 0.38 ? 'pass' : 'fail'
}

function supportRoleIdentityOverlapStatus(
  result: GeneratePlanResult,
): SupportRoleRejectionDiagnostic['identityOverlapStatus'] {
  const guard = buildProvisionalLeakageGuardDiagnostic(result)
  return guard.classification === 'proof_runner_false_positive'
    ? 'not_relevant'
    : guard.classification
}

function buildSupportRoleRejectionDiagnostics(result: GeneratePlanResult): SupportRoleRejectionDiagnostic[] {
  const liveScoredVenues = result.scoredVenues.filter(isLiveScoredVenue)
  const allLiveRolePoolMembershipObservable = liveRolePoolMembershipObservable(result)
  return liveScoredVenues
    .filter((candidate) =>
      allLiveRolePoolMembershipObservable
        ? true
        : !liveCandidateEnteredAnyRolePool(result, candidate),
    )
    .map((candidate) => {
      const queryCandidate = findLiveQueryCandidateForScoredVenue(result, candidate)
      const comparisons = roleCompetitionEntries(result).filter(([, comparison]) =>
        sameVenueId(comparison.strongestLive?.venueId, candidate.venue.id),
      )
      const roleDiagnostics = comparisons.map(([role, comparison]) => {
        const score = comparison.strongestLive?.score
        const roleFactors = factorsForRoleRejection(comparison)
        return {
          role,
          rolePoolEntered: comparison.liveEnteredRolePool,
          ...(comparison.strongestLiveLostAtStage ? { lostAtStage: comparison.strongestLiveLostAtStage } : {}),
          lossReason: comparison.strongestLiveLossReason ?? 'insufficient_evidence',
          rolePoolScore: score?.poolRankingScore ?? 'not_retained',
          rolePoolThreshold: 'not_retained',
          lensCompatibilityScore: score?.lensCompatibility ?? candidate.lensCompatibility ?? 'not_retained',
          lensCompatibilityVerdict: lensCompatibilityVerdict(candidate.lensCompatibility),
          highlightValidityVerdict:
            role === 'highlight'
              ? score?.highlightValidityLevel ?? candidate.highlightValidity?.validityLevel ?? 'not_observed'
              : 'not_applicable',
          signatureScore: score?.signatureScore ?? candidate.venue.signature?.signatureScore ?? 'not_retained',
          signatureThreshold: 'not_retained',
          rejectionFactors: roleFactors,
        }
      })
      const allFactors = new Set<SupportRoleRejectionFactor>(
        roleDiagnostics.flatMap((diagnostic) => diagnostic.rejectionFactors),
      )
      if (roleDiagnostics.length === 0) {
        allFactors.add('insufficient_evidence')
      }
      return {
        diagnosticOnly: true,
        behaviorImpact: false,
        candidateName: candidate.venue.name,
        candidateId: candidate.candidateIdentity?.baseVenueId ?? candidate.venue.id ?? 'not_retained',
        diagnosticId: candidate.venue.source.providerRecordId ?? queryCandidate?.providerPlaceId ?? 'not_retained',
        candidateClass: supportRoleCandidateClass(queryCandidate),
        sourceStage: supportRoleSourceStage(queryCandidate),
        intendedRoles: roleDiagnostics.length > 0 ? roleDiagnostics.map((diagnostic) => diagnostic.role) : 'not_retained',
        candidateRoleAffinities: roleAffinityScores(candidate),
        tasteEvidenceStatus: hasTasteSupportEvidence(candidate) ? 'present' : 'insufficient_evidence',
        bearingsAdmissibilityStatus: queryCandidate?.bearingsCandidateAdmissibility?.overallStatus ?? 'not_observed',
        identityOverlapStatus: supportRoleIdentityOverlapStatus(result),
        finalRejectionReason: [...allFactors].join('+') || 'insufficient_evidence',
        ownerClassification: ownerForSupportRoleRejection([...allFactors]),
        roleDiagnostics,
      } satisfies SupportRoleRejectionDiagnostic
    })
}

function supportRoleRollupCount(
  diagnostics: readonly SupportRoleRejectionDiagnostic[],
  predicate: (diagnostic: SupportRoleRejectionDiagnostic) => boolean,
): number {
  return diagnostics.filter(predicate).length
}

function diagnosticHasFactor(
  diagnostic: SupportRoleRejectionDiagnostic,
  factor: SupportRoleRejectionFactor,
): boolean {
  return diagnostic.roleDiagnostics.some((roleDiagnostic) =>
    roleDiagnostic.rejectionFactors.includes(factor),
  ) || diagnostic.finalRejectionReason.split('+').includes(factor)
}

function formatSupportRoleRejectionRollups(result: GeneratePlanResult): string {
  const diagnostics = buildSupportRoleRejectionDiagnostics(result)
  return [
    `scoredLiveButNoRolePoolCount=${diagnostics.length}`,
    `rolePoolRejectionLensCompatibilityCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnosticHasFactor(diagnostic, 'lens_compatibility'))}`,
    `rolePoolRejectionRolePoolScoreCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnosticHasFactor(diagnostic, 'role_pool_score'))}`,
    `rolePoolRejectionHighlightValidityCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnosticHasFactor(diagnostic, 'highlight_validity'))}`,
    `rolePoolRejectionSignatureScoreCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnosticHasFactor(diagnostic, 'signature_score'))}`,
    `rolePoolRejectionAdmissibilityCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnosticHasFactor(diagnostic, 'admissibility'))}`,
    `rolePoolRejectionIdentityOverlapCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnosticHasFactor(diagnostic, 'identity_overlap') || diagnostic.identityOverlapStatus !== 'not_relevant')}`,
    `rolePoolRejectionInsufficientEvidenceCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnosticHasFactor(diagnostic, 'insufficient_evidence'))}`,
    `rolePoolRejectionOwnerTasteCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnostic.ownerClassification === 'Taste')}`,
    `rolePoolRejectionOwnerRolePoolAssemblyCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnostic.ownerClassification === 'role-pool assembly' || diagnosticHasFactor(diagnostic, 'role_pool_score'))}`,
    `rolePoolRejectionOwnerProofRunnerCount=${supportRoleRollupCount(diagnostics, (diagnostic) => diagnostic.ownerClassification === 'proof-runner')}`,
  ].join('; ')
}

function compactRoleAffinity(
  affinities: SupportRoleRejectionDiagnostic['candidateRoleAffinities'],
): string {
  return supportRoles
    .map((role) => `${role}:${formatNumber(affinities[role] as number | undefined)}`)
    .join(',')
}

function formatSupportRoleRejectionDiagnostics(result: GeneratePlanResult): string {
  const diagnostics = buildSupportRoleRejectionDiagnostics(result)
  if (diagnostics.length === 0) {
    return 'supportRoleRejectionDiagnostics=none'
  }
  return diagnostics
    .map((diagnostic) =>
      [
        `supportRoleRejectionCandidate=${diagnostic.candidateName}`,
        `candidateId=${diagnostic.candidateId}`,
        `diagnosticId=${diagnostic.diagnosticId}`,
        `candidateClass=${diagnostic.candidateClass}`,
        `sourceStage=${diagnostic.sourceStage}`,
        `intendedRoles=${Array.isArray(diagnostic.intendedRoles) ? diagnostic.intendedRoles.join('+') : diagnostic.intendedRoles}`,
        `candidateRoleAffinities=${compactRoleAffinity(diagnostic.candidateRoleAffinities)}`,
        `tasteEvidence=${diagnostic.tasteEvidenceStatus}`,
        `bearingsAdmissibility=${diagnostic.bearingsAdmissibilityStatus}`,
        `identityOverlap=${diagnostic.identityOverlapStatus}`,
        `finalRejectionReason=${diagnostic.finalRejectionReason}`,
        `owner=${diagnostic.ownerClassification}`,
        `roleDetails=${diagnostic.roleDiagnostics.map((roleDiagnostic) =>
          [
            roleDiagnostic.role,
            `stage:${roleDiagnostic.lostAtStage ?? 'not_observed'}`,
            `reason:${roleDiagnostic.lossReason}`,
            `rolePoolScore:${roleDiagnostic.rolePoolScore}`,
            `rolePoolThreshold:${roleDiagnostic.rolePoolThreshold}`,
            `lens:${roleDiagnostic.lensCompatibilityScore}/${roleDiagnostic.lensCompatibilityVerdict}`,
            `highlight:${roleDiagnostic.highlightValidityVerdict}`,
            `signature:${roleDiagnostic.signatureScore}/threshold:${roleDiagnostic.signatureThreshold}`,
            `factors:${roleDiagnostic.rejectionFactors.join('+')}`,
          ].join(','),
        ).join('~')}`,
      ].join(';'),
    )
    .join(' | ')
}

function fakeProvisionalCandidate(
  overrides: Partial<LiveQueryCandidateDispositionDiagnostics> = {},
): LiveQueryCandidateDispositionDiagnostics {
  return {
    name: 'Live Provisional Candidate',
    venueId: 'live-provisional-candidate',
    providerPlaceId: 'places/live-provisional-candidate',
    fieldCandidateClass: 'provisional_live_candidate',
    proofEligible: false,
    diagnosticOnly: true,
    sourceOrigin: 'live',
    sourceMode: 'live',
    sourceTypes: ['cafe'],
    providerResultSummary: true,
    normalizedResult: true,
    candidateBoardAdmission: false,
    pocketFilter: 'outside_pocket_envelope',
    filterVerdict: 'rejected_outside_selected_envelope',
    hasLocationEvidence: true,
    hasFormattedAddressEvidence: true,
    hasProviderIdEvidence: true,
    ...overrides,
  }
}

function fakeScoredVenue(params: {
  id: string
  name: string
  sourceOrigin: 'live' | 'curated'
  providerRecordId?: string
  hasLiveLockEvidence?: boolean
}): ScoredVenue {
  return {
    venue: {
      id: params.id,
      name: params.name,
      source: {
        sourceOrigin: params.sourceOrigin,
        ...(params.providerRecordId ? { providerRecordId: params.providerRecordId } : {}),
        ...(params.hasLiveLockEvidence
          ? {
              formattedAddress: '1 Proof St, San Jose, CA',
              latitude: 37.33,
              longitude: -121.89,
            }
          : {}),
      },
    },
    candidateIdentity: {
      baseVenueId: params.id,
      candidateId: params.id,
    },
  } as ScoredVenue
}

function fakeResultForGuard(params: {
  provisionalCandidates?: LiveQueryCandidateDispositionDiagnostics[]
  scoredVenues?: ScoredVenue[]
  stops?: Array<{ venueId?: string; venueName?: string; role?: string }>
  contractEntryArtifact?: unknown
}): GeneratePlanResult {
  return {
    trace: {
      retrievalDiagnostics: {
        liveSource: {
          liveCandidatesByQuery: [
            {
              label: 'identity-overlap-proof',
              template: 'identity-overlap-proof',
              roleHint: 'proof',
              fetchedCount: params.provisionalCandidates?.length ?? 0,
              mappedCount: params.provisionalCandidates?.length ?? 0,
              normalizedCount: params.provisionalCandidates?.length ?? 0,
              approvedCount: 0,
              demotedCount: 0,
              suppressedCount: 0,
              candidates: params.provisionalCandidates ?? [],
            },
          ],
        },
      },
    },
    scoredVenues: params.scoredVenues ?? [],
    itinerary: {
      stops: (params.stops ?? []).map((stop) => ({
        role: stop.role ?? 'windDown',
        venueId: stop.venueId,
        venueName: stop.venueName,
      })),
    },
    ...(params.contractEntryArtifact === undefined
      ? { contractEntryArtifact: { id: 'contract-entry-proof' } }
      : { contractEntryArtifact: params.contractEntryArtifact }),
  } as GeneratePlanResult
}

function fakePotentiallyPassingObservation(
  providerCandidateSelectionCounts: string,
): LifecycleObservation {
  return {
    mode: 'curate',
    starterFamily: 'proof / guard',
    routeLabel: 'guard-pass-proof',
    contractEntryProduced: true,
    runtimeRouteProduced: true,
    greatStopPassFail: 'pass',
    greatStopFailureReasons: 'none',
    reviewLockEligible: true,
    staticCorpusUsed: false,
    dryPathUsed: false,
    fallbackUsed: false,
    providerShadowUsed: false,
    demoSpecialUsed: false,
    appAuthorityShadowUsed: false,
    legacyWrapperUsed: false,
    diagnosticOnly: false,
    honestFail: false,
    routeAuthoritySourceLabel: 'contract_entry_artifact.runtime_route_artifact',
    runtimeLockTruthStatus: 'produced',
    compatibilityRouteTruth: false,
    canonicalRouteTruth: true,
    whyNotMvpGreen: 'none',
    providerCandidateSelectionCounts,
  } as LifecycleObservation
}

function fakeSupportScoredVenue(overrides: Partial<ScoredVenue> = {}): ScoredVenue {
  return {
    venue: {
      id: 'live-support-candidate',
      name: 'Live Support Candidate',
      category: 'library',
      energyLevel: 2,
      source: {
        sourceOrigin: 'live',
        providerRecordId: 'places/live-support-candidate',
        qualityGateStatus: 'approved',
        likelyOpenForCurrentWindow: true,
        timeConfidence: 0.82,
        sourceConfidence: 0.78,
        completenessScore: 0.71,
        qualityScore: 0.76,
        hoursKnown: true,
      },
      signature: {
        signatureScore: 0.42,
        genericScore: 0.48,
      },
    },
    candidateIdentity: {
      baseVenueId: 'live-support-candidate',
      candidateId: 'live-support-candidate',
    },
    roleScores: {
      warmup: 0.51,
      peak: 0.49,
      wildcard: 0.5,
      cooldown: 0.52,
    },
    stopShapeFit: {
      start: 0.44,
      highlight: 0.31,
      surprise: 0.4,
      windDown: 0.43,
    },
    lensCompatibility: 0.32,
    contextSpecificity: {
      overall: 0.34,
      byRole: {
        warmup: 0.34,
        peak: 0.3,
        wildcard: 0.33,
        cooldown: 0.34,
      },
    },
    highlightValidity: {
      validityLevel: 'invalid',
      candidateTier: 'connective-only',
    },
    ...overrides,
  } as ScoredVenue
}

function fakeSupportQueryCandidate(
  candidate: ScoredVenue,
): LiveQueryCandidateDispositionDiagnostics {
  return {
    name: candidate.venue.name,
    venueId: candidate.venue.id,
    providerPlaceId: candidate.venue.source.providerRecordId,
    fieldCandidateClass: 'canonical_live_candidate',
    proofEligible: true,
    diagnosticOnly: false,
    sourceStage: 'pocket_filter',
    sourceOrigin: 'live',
    sourceMode: 'live',
    sourceTypes: ['library'],
    providerResultSummary: true,
    normalizedResult: true,
    candidateBoardAdmission: true,
    pocketFilter: 'admitted',
    filterVerdict: 'kept',
    hasLocationEvidence: true,
    hasFormattedAddressEvidence: true,
    hasProviderIdEvidence: true,
  }
}

function fakeSupportDelta(
  factor: SupportRoleRejectionFactor,
): RoleCompetitionDiagnostics['strongestLiveVsCuratedDelta'][number] {
  const labelByFactor: Partial<Record<SupportRoleRejectionFactor, string>> = {
    lens_compatibility: 'Lens compatibility',
    role_pool_score: 'Role-pool score',
    highlight_validity: 'Highlight validity',
    signature_score: 'Signature score',
  }
  return {
    key: factor,
    label: labelByFactor[factor] ?? 'Insufficient evidence',
    liveValue: 30,
    curatedValue: 70,
    delta: -40,
    favored: 'curated',
    explanation: `${labelByFactor[factor] ?? 'Evidence'} favored curated.`,
  }
}

function fakeSupportComparison(params: {
  candidate: ScoredVenue
  role: UserStopRole
  factors: SupportRoleRejectionFactor[]
  enteredRolePool?: boolean
  lostAtStage?: RoleCompetitionDiagnostics['strongestLiveLostAtStage']
}): RoleCompetitionDiagnostics {
  return {
    role: params.role,
    strongestLive: {
      venueId: params.candidate.venue.id,
      venueName: params.candidate.venue.name,
      sourceOrigin: 'live',
      qualityGateStatus: 'approved',
      score: {
        poolRankingScore: 41,
        roleFit: 51,
        tasteBonus: 0,
        tasteRoleSuitabilityContribution: 0,
        highlightPlausibilityBonus: params.role === 'highlight' ? -50 : undefined,
        overallFit: 58,
        lensCompatibility: 32,
        stopShapeFit: 44,
        vibeAuthority: 40,
        contextSpecificity: 34,
        dominancePenalty: 0,
        contractScore: 0,
        highlightValidityLevel: params.role === 'highlight' ? 'invalid' : undefined,
        highlightCandidateTier: params.role === 'highlight' ? 'connective-only' : undefined,
        highlightValidityBoost: params.role === 'highlight' ? -50 : undefined,
        rolePoolLift: 0,
        liveRoleLift: 0,
        liveRolePromotion: 0,
        hoursPenalty: 0,
        hoursAdjusted: false,
        sourceConfidence: 78,
        completenessScore: 71,
        qualityScore: 76,
        timeConfidence: 82,
        likelyOpenForCurrentWindow: true,
        hoursKnown: true,
        signatureScore: 42,
        genericScore: 48,
        qualityGateStatus: 'approved',
      },
    },
    strongestLiveScore: 41,
    strongestLiveLossReason: params.factors.join('+'),
    strongestLiveLostAtStage:
      params.lostAtStage ?? (params.factors.includes('highlight_validity') ? 'highlight-validity' : 'role-pool'),
    strongestLiveVsCuratedDelta: params.factors
      .filter((factor) => factor !== 'insufficient_evidence')
      .map(fakeSupportDelta),
    arcScoreDelta: [],
    outcome: 'curated-won',
    liveEnteredRolePool: params.enteredRolePool ?? false,
    curatedEnteredRolePool: true,
    liveReachedArcAssembly: false,
    curatedReachedArcAssembly: true,
    liveWonFinalRoute: false,
    winningVenueId: 'curated-winner',
    selectedArcScore: 72,
  }
}

function fakeSupportResult(params: {
  candidate?: ScoredVenue
  comparisons?: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
  liveRolePoolCounts?: Partial<Record<UserStopRole, number>>
}): GeneratePlanResult {
  const candidate = params.candidate ?? fakeSupportScoredVenue()
  return {
    scoredVenues: [candidate],
    itinerary: { stops: [] },
    trace: {
      retrievalDiagnostics: {
        liveSource: {
          liveCandidatesByQuery: [
            {
              label: 'support-role-rejection-proof',
              template: 'support-role-rejection-proof',
              roleHint: 'support',
              fetchedCount: 1,
              mappedCount: 1,
              normalizedCount: 1,
              approvedCount: 1,
              demotedCount: 0,
              suppressedCount: 0,
              candidates: [fakeSupportQueryCandidate(candidate)],
            },
          ],
          liveRolePoolCounts: {
            start: params.liveRolePoolCounts?.start ?? 0,
            highlight: params.liveRolePoolCounts?.highlight ?? 0,
            surprise: params.liveRolePoolCounts?.surprise ?? 0,
            windDown: params.liveRolePoolCounts?.windDown ?? 0,
          },
          roleCompetitionByRole: params.comparisons ?? {},
        },
      },
    },
  } as GeneratePlanResult
}

function assertSupportRoleRejectionDiagnostics(): void {
  const lensCandidate = fakeSupportScoredVenue()
  const lensResult = fakeSupportResult({
    candidate: lensCandidate,
    comparisons: {
      start: fakeSupportComparison({
        candidate: lensCandidate,
        role: 'start',
        factors: ['lens_compatibility'],
      }),
    },
  })
  const lensDiagnostic = buildSupportRoleRejectionDiagnostics(lensResult)[0]
  assert(lensDiagnostic.candidateName === 'Live Support Candidate', 'support rejection must report candidate name.')
  assert(lensDiagnostic.candidateClass === 'canonical_live_candidate', 'support rejection must report candidate class.')
  assert(lensDiagnostic.sourceStage === 'pocket_filter', 'support rejection must report source stage.')
  assert(
    diagnosticHasFactor(lensDiagnostic, 'lens_compatibility'),
    'support rejection must classify lens compatibility loss.',
  )
  assert(
    formatSupportRoleRejectionRollups(lensResult).includes('rolePoolRejectionLensCompatibilityCount=1'),
    'support rejection rollups must count lens compatibility losses.',
  )

  const rolePoolCandidate = fakeSupportScoredVenue()
  const rolePoolResult = fakeSupportResult({
    candidate: rolePoolCandidate,
    comparisons: {
      windDown: fakeSupportComparison({
        candidate: rolePoolCandidate,
        role: 'windDown',
        factors: ['role_pool_score'],
      }),
    },
  })
  assert(
    formatSupportRoleRejectionRollups(rolePoolResult).includes('rolePoolRejectionRolePoolScoreCount=1'),
    'support rejection rollups must count role-pool score losses.',
  )

  const highlightCandidate = fakeSupportScoredVenue()
  const highlightResult = fakeSupportResult({
    candidate: highlightCandidate,
    comparisons: {
      highlight: fakeSupportComparison({
        candidate: highlightCandidate,
        role: 'highlight',
        factors: ['highlight_validity'],
        lostAtStage: 'highlight-validity',
      }),
    },
  })
  assert(
    formatSupportRoleRejectionRollups(highlightResult).includes('rolePoolRejectionHighlightValidityCount=1'),
    'support rejection rollups must count highlight validity losses.',
  )

  const signatureCandidate = fakeSupportScoredVenue()
  const signatureResult = fakeSupportResult({
    candidate: signatureCandidate,
    comparisons: {
      surprise: fakeSupportComparison({
        candidate: signatureCandidate,
        role: 'surprise',
        factors: ['signature_score'],
      }),
    },
  })
  assert(
    formatSupportRoleRejectionRollups(signatureResult).includes('rolePoolRejectionSignatureScoreCount=1'),
    'support rejection rollups must count signature score losses.',
  )

  const insufficientResult = fakeSupportResult({})
  assert(
    formatSupportRoleRejectionRollups(insufficientResult).includes('rolePoolRejectionInsufficientEvidenceCount=1'),
    'support rejection rollups must count insufficient retained evidence.',
  )

  const cleanCandidate = fakeSupportScoredVenue()
  const cleanResult = fakeSupportResult({
    candidate: cleanCandidate,
    liveRolePoolCounts: { start: 1 },
    comparisons: {
      start: fakeSupportComparison({
        candidate: cleanCandidate,
        role: 'start',
        factors: [],
        enteredRolePool: true,
      }),
    },
  })
  assert(
    buildSupportRoleRejectionDiagnostics(cleanResult).length === 0,
    'clean live candidate that reaches a role pool must not produce rejection diagnostics.',
  )
  assert(
    formatSupportRoleRejectionRollups(cleanResult).includes('scoredLiveButNoRolePoolCount=0'),
    'support rejection diagnostics must preserve clean role-pool eligibility counts.',
  )
  assert(
    formatSupportRoleRejectionDiagnostics(lensResult).includes('behaviorImpact') === false,
    'support rejection formatting must not claim behavior changes.',
  )
}

function assertRowBlockedByGuard(
  providerCandidateSelectionCounts: string,
  expectedReason: string,
): void {
  const row = buildRow({
    observation: fakePotentiallyPassingObservation(providerCandidateSelectionCounts),
    providerCalls: 3,
    hostedCalls: 0,
  })
  assert(row['valid live proof pass? yes/no'] === 'no', `${expectedReason} must block valid live proof pass.`)
  assert(row['valid MVP pass? yes/no'] === 'no', `${expectedReason} must block valid MVP pass.`)
  assert(
    row['why not MVP green'].includes(expectedReason),
    `${expectedReason} must appear in why-not-MVP-green.`,
  )
}

function assertProvisionalLeakageGuardDiagnostics(): void {
  const realScoredLeakResult = fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          venueId: 'live-actual-leak',
          providerPlaceId: 'places/live-actual-leak',
          name: 'Actual Leak',
        }),
      ],
      scoredVenues: [
        fakeScoredVenue({
          id: 'live-actual-leak',
          name: 'Actual Leak',
          sourceOrigin: 'live',
          providerRecordId: 'places/live-actual-leak',
          hasLiveLockEvidence: true,
        }),
      ],
    })
  const realScoredLeak = buildProvisionalLeakageGuardDiagnostic(realScoredLeakResult)
  assert(realScoredLeak.status === 'fail', 'real provisional scored eligibility leak must fail guard.')
  assert(
    realScoredLeak.classification === 'real_provisional_eligibility_leak',
    'real scored eligibility leak must be classified as real_provisional_eligibility_leak.',
  )
  assert(realScoredLeak.scoredLeakCount === 1, 'real scored leak count must be reported.')
  assert(
    buildProvisionalLeakageGuardBlockReason({
      providerCandidateSelectionCounts: formatProvisionalRouteLeakage(realScoredLeakResult),
      providerCalls: 3,
    }) === 'provisionalLeakageGuard blocked:fail',
    'real scored leak must block valid live/MVP aggregation.',
  )
  assertRowBlockedByGuard(
    formatProvisionalRouteLeakage(realScoredLeakResult),
    'provisionalLeakageGuard blocked:fail',
  )

  const staticLiveOverlapResult = fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          venueId: 'live-voyager',
          providerPlaceId: 'places/live-voyager',
          name: 'Voyager Craft Coffee',
        }),
      ],
      scoredVenues: [
        fakeScoredVenue({
          id: 'sj-voyager-coffee',
          name: 'Voyager Craft Coffee',
          sourceOrigin: 'curated',
        }),
      ],
      stops: [{ venueId: 'sj-voyager-coffee', venueName: 'Voyager Craft Coffee' }],
    })
  const staticLiveOverlap = buildProvisionalLeakageGuardDiagnostic(staticLiveOverlapResult)
  assert(staticLiveOverlap.status === 'warn', 'static/live identity overlap must warn, not fail.')
  assert(
    staticLiveOverlap.classification === 'identity_overlap_ambiguous',
    'static selected route lacking live lock evidence must be identity_overlap_ambiguous.',
  )
  assert(staticLiveOverlap.scoredLeakCount === 0, 'static/live overlap must not count as scored leak.')
  assert(staticLiveOverlap.routeLeakCount === 0, 'static/live overlap must not count as route leak.')
  assert(staticLiveOverlap.routeTruthRisk, 'static/live overlap without lock evidence must report route truth risk.')
  assert(
    buildProvisionalLeakageGuardBlockReason({
      providerCandidateSelectionCounts: formatProvisionalRouteLeakage(staticLiveOverlapResult),
      providerCalls: 3,
    }) === 'provisionalLeakageGuard blocked:warn',
    'static/live warning must block valid live/MVP aggregation.',
  )
  assertRowBlockedByGuard(
    formatProvisionalRouteLeakage(staticLiveOverlapResult),
    'provisionalLeakageGuard blocked:warn',
  )

  const nameOnlyAmbiguousResult = fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          venueId: 'live-name-only',
          providerPlaceId: 'places/live-name-only',
          name: 'Name Only Coffee',
        }),
      ],
      stops: [{ venueName: 'Name Only Coffee' }],
    })
  const nameOnlyAmbiguous = buildProvisionalLeakageGuardDiagnostic(nameOnlyAmbiguousResult)
  assert(nameOnlyAmbiguous.status === 'warn', 'name-only route-truth uncertainty must warn, not pass.')
  assert(
    nameOnlyAmbiguous.classification === 'insufficient_evidence',
    'name-only overlap without static identity must be insufficient_evidence.',
  )
  assert(nameOnlyAmbiguous.routeTruthRisk, 'name-only route-truth uncertainty must report route truth risk.')
  assert(
    buildProvisionalLeakageGuardBlockReason({
      providerCandidateSelectionCounts: formatProvisionalRouteLeakage(nameOnlyAmbiguousResult),
      providerCalls: 3,
    }) === 'provisionalLeakageGuard blocked:warn',
    'insufficient evidence warning must block valid live/MVP aggregation.',
  )
  assertRowBlockedByGuard(
    formatProvisionalRouteLeakage(nameOnlyAmbiguousResult),
    'provisionalLeakageGuard blocked:warn',
  )

  const selectedStaticNoLockEvidence = buildProvisionalLeakageGuardDiagnostic(
    fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          venueId: 'live-static-no-lock',
          providerPlaceId: 'places/live-static-no-lock',
          name: 'Static No Lock Coffee',
        }),
      ],
      stops: [{ venueId: 'static-no-lock', venueName: 'Static No Lock Coffee' }],
    }),
  )
  assert(
    selectedStaticNoLockEvidence.classification === 'identity_overlap_ambiguous' ||
      selectedStaticNoLockEvidence.classification === 'static_live_identity_overlap',
    'selected static without lock evidence must classify as overlap ambiguity, not route eligibility leak.',
  )
  assert(
    selectedStaticNoLockEvidence.routeLeakCount === 0,
    'selected static without lock evidence must not count as provisional route leak.',
  )

  const noProvisionalPresenceResult = fakeResultForGuard({
      scoredVenues: [
        fakeScoredVenue({
          id: 'static-only',
          name: 'Static Only',
          sourceOrigin: 'curated',
        }),
      ],
      stops: [{ venueId: 'static-only', venueName: 'Static Only' }],
    })
  const noProvisionalPresence = buildProvisionalLeakageGuardDiagnostic(noProvisionalPresenceResult)
  assert(noProvisionalPresence.status === 'pass', 'no provisional or blocked presence must pass guard.')
  assert(
    noProvisionalPresence.classification === 'proof_runner_false_positive',
    'no provisional or blocked presence must not report leakage.',
  )
  assert(
    buildProvisionalLeakageGuardBlockReason({
      providerCandidateSelectionCounts: formatProvisionalRouteLeakage(noProvisionalPresenceResult),
      providerCalls: 3,
    }) === null,
    'clean guard pass must not block otherwise valid live/MVP aggregation.',
  )
  const cleanGuardRow = buildRow({
    observation: fakePotentiallyPassingObservation(formatProvisionalRouteLeakage(noProvisionalPresenceResult)),
    providerCalls: 3,
    hostedCalls: 0,
  })
  assert(cleanGuardRow['valid live proof pass? yes/no'] === 'yes', 'clean guard pass must allow other pass criteria.')
  assert(cleanGuardRow['valid MVP pass? yes/no'] === 'yes', 'clean guard pass must allow MVP pass when all other criteria pass.')

  const noOverlap = buildProvisionalLeakageGuardDiagnostic(
    fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          venueId: 'live-no-overlap',
          providerPlaceId: 'places/live-no-overlap',
          name: 'No Overlap Coffee',
        }),
      ],
      scoredVenues: [
        fakeScoredVenue({
          id: 'static-other',
          name: 'Static Other',
          sourceOrigin: 'curated',
        }),
      ],
      stops: [{ venueId: 'static-other', venueName: 'Static Other' }],
    }),
  )
  assert(noOverlap.status === 'pass', 'no overlap must pass guard.')
  assert(noOverlap.classification === 'proof_runner_false_positive', 'no overlap must not report leakage.')

  const routeOnlyLeakResult = fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          venueId: 'live-route-only-leak',
          providerPlaceId: 'places/live-route-only-leak',
          name: 'Route Only Leak',
        }),
      ],
      stops: [{ venueId: 'live-route-only-leak', venueName: 'Route Only Leak' }],
    })
  const routeOnlyLeak = buildProvisionalLeakageGuardDiagnostic(routeOnlyLeakResult)
  assert(routeOnlyLeak.status === 'fail', 'selected-route-only provisional leak must fail guard.')
  assert(
    routeOnlyLeak.classification === 'real_provisional_route_truth_leak',
    'selected-route-only provisional leak must be classified as real_provisional_route_truth_leak.',
  )
  assert(routeOnlyLeak.scoredLeakCount === 0, 'selected-route-only provisional leak must not require scored leak.')
  assert(routeOnlyLeak.routeLeakCount === 1, 'selected-route-only provisional leak count must be reported.')
  assert(
    buildProvisionalLeakageGuardBlockReason({
      providerCandidateSelectionCounts: formatProvisionalRouteLeakage(routeOnlyLeakResult),
      providerCalls: 3,
    }) === 'provisionalLeakageGuard blocked:fail',
    'selected-route-only leak must block valid live/MVP aggregation.',
  )
  assertRowBlockedByGuard(
    formatProvisionalRouteLeakage(routeOnlyLeakResult),
    'provisionalLeakageGuard blocked:fail',
  )

  const blockedRouteLeak = buildProvisionalLeakageGuardDiagnostic(
    fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          fieldCandidateClass: 'blocked_live_candidate',
          venueId: 'blocked-route-leak',
          providerPlaceId: 'places/blocked-route-leak',
          name: 'Blocked Route Leak',
        }),
      ],
      stops: [{ venueId: 'blocked-route-leak', venueName: 'Blocked Route Leak' }],
    }),
  )
  assert(blockedRouteLeak.status === 'fail', 'selected-route-only blocked live leak must fail guard.')
  assert(
    blockedRouteLeak.classification === 'real_provisional_route_truth_leak',
    'selected-route-only blocked live leak must be classified as real_provisional_route_truth_leak.',
  )

  const realRouteLeak = buildProvisionalLeakageGuardDiagnostic(
    fakeResultForGuard({
      provisionalCandidates: [
        fakeProvisionalCandidate({
          venueId: 'live-route-leak',
          providerPlaceId: 'places/live-route-leak',
          name: 'Route Leak',
        }),
      ],
      scoredVenues: [
        fakeScoredVenue({
          id: 'live-route-leak',
          name: 'Route Leak',
          sourceOrigin: 'live',
          providerRecordId: 'places/live-route-leak',
          hasLiveLockEvidence: true,
        }),
      ],
      stops: [{ venueId: 'live-route-leak', venueName: 'Route Leak' }],
    }),
  )
  assert(realRouteLeak.status === 'fail', 'real selected-route provisional leak must fail guard.')
  assert(realRouteLeak.routeLeakCount === 1, 'real selected-route leak count must be reported.')
  assert(realRouteLeak.artifactEligibleCount === 1, 'real selected-route leak must report artifact eligibility risk.')
}

function hasHoursOpenStatus(source: ScoredVenue['venue']['source'] | undefined): boolean {
  return Boolean(
    source?.hoursKnown === true ||
      typeof source?.openNow === 'boolean' ||
      source?.runtimeHoursTextHoursAvailable ||
      source?.runtimeHoursStructuredPeriodCount,
  )
}

function formatSelectedVenueEvidenceFlags(scoredVenue: ScoredVenue | null): string {
  const source = scoredVenue?.venue.source
  if (!source) {
    return 'selectedWindDown=unavailable'
  }
  return [
    `hasProviderPlaceId=${yesNo(Boolean(source.providerRecordId?.trim()))}`,
    `hasFormattedAddress=${yesNo(Boolean(source.formattedAddress?.trim()))}`,
    `hasLocation=${yesNo(typeof source.latitude === 'number' && typeof source.longitude === 'number')}`,
    `hasCategoriesTypes=${yesNo((source.sourceTypes?.length ?? 0) > 0)}`,
    `hasHoursOpenStatus=${yesNo(hasHoursOpenStatus(source))}`,
    `hasRating=${yesNo(typeof source.rating === 'number')}`,
    `hasUserRatingCount=${yesNo(typeof source.reviewCount === 'number')}`,
    'hasWebsite=no',
    'hasPhone=no',
  ].join('; ')
}

function formatSurvivingLiveCandidateEvidenceFlags(scoredVenues: ScoredVenue[]): string {
  const liveCandidates = scoredVenues.filter(isLiveScoredVenue)
  if (liveCandidates.length === 0) {
    return 'liveCandidates=0'
  }
  return [
    `liveCandidates=${liveCandidates.length}`,
    `hasProviderPlaceId:${countAvailability(liveCandidates, (candidate) => Boolean(candidate.venue.source.providerRecordId?.trim()))}`,
    `hasFormattedAddress:${countAvailability(liveCandidates, (candidate) => Boolean(candidate.venue.source.formattedAddress?.trim()))}`,
    `hasLocation:${countAvailability(liveCandidates, (candidate) => typeof candidate.venue.source.latitude === 'number' && typeof candidate.venue.source.longitude === 'number')}`,
    `hasCategoriesTypes:${countAvailability(liveCandidates, (candidate) => (candidate.venue.source.sourceTypes?.length ?? 0) > 0)}`,
    `hasHoursOpenStatus:${countAvailability(liveCandidates, (candidate) => hasHoursOpenStatus(candidate.venue.source))}`,
    `hasRating:${countAvailability(liveCandidates, (candidate) => typeof candidate.venue.source.rating === 'number')}`,
    `hasUserRatingCount:${countAvailability(liveCandidates, (candidate) => typeof candidate.venue.source.reviewCount === 'number')}`,
    'hasWebsite:no_field_in_current_VenueSourceMetadata',
    'hasPhone:no_field_in_current_VenueSourceMetadata',
  ].join('; ')
}

function sumRecordNumbers(record: Partial<Record<string, number>> | undefined): number {
  return Object.values(record ?? {}).reduce((sum, value) => {
    return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
  }, 0)
}

function formatProviderAttritionByQuery(result: GeneratePlanResult, counters: FetchCounters): string {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  if (liveSource.liveCandidatesByQuery.length === 0) {
    return liveSource.liveFetchAttempted
      ? `providerCallAttempted=yes; providerCallSucceeded=${yesNo(liveSource.liveFetchSucceeded)}; queryBreakdown=unavailable`
      : 'providerCallAttempted=no; providerCallSucceeded=no; queryBreakdown=not_attempted'
  }
  const attemptedLabels = new Set([...liveSource.liveQueryLabelsUsed, ...counters.fieldProxyLabels])
  return liveSource.liveCandidatesByQuery
    .map((query) => {
      const attempted =
        attemptedLabels.has(query.label) ||
        query.fetchedCount > 0 ||
        query.mappedCount > 0 ||
        query.normalizedCount > 0 ||
        query.approvedCount > 0
      const succeeded = attempted
        ? liveSource.liveFetchSucceeded
          ? 'yes'
          : 'unknown'
        : 'no'
      const rejectedCount = query.demotedCount + query.suppressedCount
      return [
        `${query.label}:attempted=${yesNo(attempted)}`,
        `succeeded=${succeeded}`,
        `raw=${query.fetchedCount}`,
        `normalized=${query.normalizedCount}`,
        `admitted=${query.approvedCount}`,
        `demoted=${query.demotedCount}`,
        `suppressed=${query.suppressedCount}`,
        `rejected=${rejectedCount}`,
      ].join(';')
    })
    .join(' | ')
}

function formatSelectedStopSourceOrigins(result: GeneratePlanResult): string {
  const entries = Object.entries(result.trace.retrievalDiagnostics.liveSource.selectedStopSources)
  return entries.length > 0
    ? entries.map(([role, sourceOrigin]) => `${role}:${sourceOrigin}`).join('|')
    : 'unavailable'
}

function formatProviderAttritionTotals(result: GeneratePlanResult): string {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  const trace = liveSource.liveAttritionTrace
  const supportRoleEligible =
    trace.liveEnteredRolePoolStart +
    trace.liveEnteredRolePoolHighlight +
    trace.liveEnteredRolePoolSurprise +
    trace.liveEnteredRolePoolWindDown
  const rejectedOrLost = trace.stages.reduce((sum, stage) => sum + stage.droppedFromPrevious, 0)
  return [
    `providerCallAttempted=${yesNo(liveSource.liveFetchAttempted)}`,
    `providerCallSucceeded=${yesNo(liveSource.liveFetchSucceeded)}`,
    `rawProviderCandidates=${liveSource.fetchedCount}`,
    `mappedProviderCandidates=${liveSource.mappedCount}`,
    `normalizedProviderCandidates=${liveSource.normalizedCount}`,
    `dedupedMergedProviderCandidates=${liveSource.liveRetrievedCount}`,
    `admittedProviderCandidates=${liveSource.approvedCount}`,
    `supportRoleEligibleProviderCandidates=${supportRoleEligible}`,
    `rejectedLiveCandidateCount=${rejectedOrLost}`,
    `liveDedupedCount=${trace.liveDedupedCount}`,
    `liveDedupedAgainstCuratedCount=${trace.liveDedupedAgainstCuratedCount}`,
  ].join('; ')
}

function formatProviderCandidateSelectionCounts(result: GeneratePlanResult): string {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  const selectedOrigins = Object.values(liveSource.selectedStopSources)
  const selectedProviderCandidates = selectedOrigins.filter((sourceOrigin) => sourceOrigin === 'live').length
  const selectedStaticCuratedCandidates = selectedOrigins.filter((sourceOrigin) => sourceOrigin === 'curated').length
  const liveCandidates = result.scoredVenues.filter(isLiveScoredVenue).length
  const curatedCandidates = result.scoredVenues.filter(
    (candidate) => candidate.venue.source.sourceOrigin === 'curated',
  ).length
  const classCounts = fieldCandidateClassCountsFromDiagnostics(result)
  return [
    `selectedProviderCandidates=${selectedProviderCandidates}`,
    `selectedStaticCuratedCandidates=${selectedStaticCuratedCandidates}`,
    `selectedStopCandidateClasses=${formatSelectedStopCandidateClasses(result) || 'unavailable'}`,
    `liveCandidates=${liveCandidates}`,
    `curatedCandidates=${curatedCandidates}`,
    `candidateClassRollups=${formatFieldCandidateClassCounts(classCounts)}`,
    formatProvisionalRouteLeakage(result),
    formatSupportRoleRejectionRollups(result),
    `liveRolePoolCandidates=${sumRecordNumbers(liveSource.liveRolePoolCounts)}`,
    `liveRoleWins=${sumRecordNumbers(liveSource.liveRoleWinCounts)}`,
  ].join('; ')
}

function formatProviderCandidateRejectionReasons(result: GeneratePlanResult): string {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  const stageNotes = liveSource.liveAttritionTrace.stages.flatMap((stage) =>
    stage.notes.map((note) => `${stage.stage}:${note}`),
  )
  return joinValueList([
    liveSource.fallbackReason,
    ...liveSource.errors,
    ...liveSource.liveLostToCuratedReason,
    ...liveSource.sourceBalanceNotes,
    ...liveSource.curatedVsLiveWinnerNotes,
    formatSupportRoleRejectionDiagnostics(result),
    ...stageNotes,
  ])
}

function formatPerQueryRawProviderRecords(result: GeneratePlanResult): string {
  const queries = result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery
  return queries.length > 0
    ? queries.map((query) => `${query.label}=${query.fetchedCount}`).join('|')
    : 'unavailable'
}

function formatPerQueryMappedProviderRecords(result: GeneratePlanResult): string {
  const queries = result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery
  return queries.length > 0
    ? queries.map((query) => `${query.label}=${query.mappedCount}`).join('|')
    : 'unavailable'
}

function formatPerQueryPreFilterNormalizedRecords(result: GeneratePlanResult): string {
  const queries = result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery
  return queries.length > 0
    ? queries.map((query) => `${query.label}=${query.normalizedCount}`).join('|')
    : 'unavailable'
}

function countPerQueryPreFilterNormalizedRecords(result: GeneratePlanResult): number {
  return result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery.reduce(
    (sum, query) => sum + query.normalizedCount,
    0,
  )
}

function countLiveSourceScoredVenues(result: GeneratePlanResult): number {
  return result.scoredVenues.filter((candidate) => candidate.venue.source.sourceOrigin === 'live').length
}

function formatReasonCounts(reasons: string[]): string {
  const counts = reasons.reduce<Record<string, number>>((acc, reason) => {
    const normalized = reason.trim() || 'unspecified'
    acc[normalized] = (acc[normalized] ?? 0) + 1
    return acc
  }, {})
  const entries = Object.entries(counts)
  return entries.length > 0
    ? entries.map(([reason, count]) => `${reason}=${count}`).join('; ')
    : 'none'
}

function getLiveAttritionStageNotes(
  result: GeneratePlanResult,
  stageName: string,
): string[] {
  return result.trace.retrievalDiagnostics.liveSource.liveAttritionTrace.stages
    .filter((stage) => stage.stage === stageName)
    .flatMap((stage) => stage.notes.map((note) => `${stage.stage}:${note}`))
}

function formatFieldAttritionSubstageCounts(result: GeneratePlanResult): string {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  const prePocketFilterCount = countPerQueryPreFilterNormalizedRecords(result)
  const postPocketFilterCount = liveSource.normalizedCount
  const postQualityNonSuppressed = liveSource.approvedCount + liveSource.demotedCount
  const postMergePreDedupeLiveCount = liveSource.liveRetrievedCount + liveSource.dedupedLiveCount
  const rolePoolLiveCount = sumRecordNumbers(liveSource.liveRolePoolCounts)
  const finalRouteLiveStops = sumRecordNumbers(liveSource.liveRoleWinCounts)
  return [
    `prePocketFilterCount=${prePocketFilterCount}`,
    `postPocketFilterCount=${postPocketFilterCount}`,
    `postSourceAdmissionCount=not_separately_exposed_in_generation_diagnostics; aggregateEffectiveLiveVenues=${postPocketFilterCount}`,
    `postQualityGateApproved=${liveSource.approvedCount}`,
    `postQualityGateDemoted=${liveSource.demotedCount}`,
    `postQualityGateSuppressed=${liveSource.suppressedCount}`,
    `postQualityGateNonSuppressed=${postQualityNonSuppressed}`,
    `postMergeCount=${postMergePreDedupeLiveCount}`,
    `postDedupeCount=${liveSource.liveRetrievedCount}`,
    `scoredRetrievalLiveCount=${countLiveSourceScoredVenues(result)}`,
    `rolePoolLiveCount=${rolePoolLiveCount}`,
    `finalSelectedLiveCount=${finalRouteLiveStops}`,
  ].join('; ')
}

function formatFieldAttritionDropReasonsByStage(result: GeneratePlanResult): string {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  const queryCandidates = liveSource.liveCandidatesByQuery.flatMap((query) => query.candidates ?? [])
  const normalizationReasons = queryCandidates
    .filter(
      (candidate) =>
        candidate.dropReason === 'normalization_or_dedupe_drop' ||
        candidate.pocketProofDiagnostic?.candidateBoardAdmissionFalseSource === 'normalization_or_dedupe',
    )
    .map(
      (candidate) =>
        candidate.dropReason ??
        candidate.pocketProofDiagnostic?.candidateBoardAdmissionFalseSource ??
        'normalization_or_dedupe',
    )
  const pocketReasons = queryCandidates
    .filter((candidate) => candidate.pocketFilter === 'outside_pocket_envelope')
    .map(
      (candidate) =>
        candidate.pocketProofDiagnostic?.fieldSourceDecision.reason ??
        'field_source_pocket_filter_outside_selected_envelope',
    )
  const sourceAdmissionReasons = queryCandidates
    .filter((candidate) => !candidate.candidateBoardAdmission)
    .map(
      (candidate) =>
        candidate.pocketProofDiagnostic?.candidateBoardAdmissionFalseSource ??
        candidate.dropReason ??
        'candidate_board_admission_false',
    )
  const qualityGateReasons = getLiveAttritionStageNotes(result, 'quality-gate')
  const mergeDedupeReasons = [
    ...getLiveAttritionStageNotes(result, 'dedupe'),
    ...liveSource.dedupeNoveltyLoss.dedupeLossReason,
  ]
  const retrievalReasons = getLiveAttritionStageNotes(result, 'retrieval')
  const rolePoolReasons = getLiveAttritionStageNotes(result, 'role-pool')
  const finalRouteReasons = [
    ...getLiveAttritionStageNotes(result, 'final-route-winner'),
    ...liveSource.sourceBalanceNotes,
    ...liveSource.curatedVsLiveWinnerNotes,
  ]
  return [
    `mapping/normalization:${formatReasonCounts(normalizationReasons)}`,
    `pocket/district filter:${formatReasonCounts(pocketReasons)}`,
    `source admission:${formatReasonCounts(sourceAdmissionReasons)}`,
    `quality gate:${formatReasonCounts(qualityGateReasons)}`,
    `suppression:suppressed=${liveSource.suppressedCount}; hoursSuppressed=${liveSource.liveHoursSuppressedCount}`,
    `demotion:demoted=${liveSource.demotedCount}; hoursDemoted=${liveSource.liveHoursDemotedCount}`,
    `merge/dedupe:${formatReasonCounts(mergeDedupeReasons)}`,
    `retrieval scoring/filtering:${formatReasonCounts(retrievalReasons)}`,
    `role-pool eligibility:${formatReasonCounts(rolePoolReasons)}`,
    `final route selection:${formatReasonCounts(finalRouteReasons)}`,
  ].join(' | ')
}

function formatDistanceMargin(candidate: {
  distanceMargin?: { status: string; meters?: number }
}): string {
  const margin = candidate.distanceMargin
  if (!margin) {
    return 'unknown'
  }
  return typeof margin.meters === 'number'
    ? `${margin.status}:${margin.meters.toFixed(1)}m`
    : margin.status
}

function formatFieldPocketCandidateDiagnostics(result: GeneratePlanResult): string {
  const queries = result.trace.retrievalDiagnostics.liveSource.liveCandidatesByQuery
  const entries = queries.flatMap((query) =>
    (query.candidates ?? []).map((candidate) =>
      [
        `query=${query.label}`,
        `candidate=${candidate.name}`,
        `stage=${candidate.sourceStage ?? 'unknown'}`,
        `sourceOrigin=${candidate.sourceOrigin ?? 'unknown'}`,
        `sourceMode=${candidate.sourceMode ?? 'unknown'}`,
        `fieldCandidateClass=${candidate.fieldCandidateClass}`,
        `proofEligible=${yesNo(candidate.proofEligible)}`,
        `diagnosticOnly=${yesNo(candidate.diagnosticOnly)}`,
        `candidatePocket=${candidate.candidatePocket ?? 'unknown'}`,
        `selectedEnvelope=${candidate.selectedPocketEnvelope ?? 'none'}`,
        `distanceM=${typeof candidate.candidateDistanceFromPocketCenterM === 'number' ? candidate.candidateDistanceFromPocketCenterM.toFixed(1) : 'unknown'}`,
        `radiusM=${typeof candidate.pocketRadiusThresholdM === 'number' ? String(candidate.pocketRadiusThresholdM) : 'unknown'}`,
        `margin=${formatDistanceMargin(candidate)}`,
        `verdict=${candidate.filterVerdict ?? 'unknown'}`,
        `hasLocation=${yesNo(candidate.hasLocationEvidence === true)}`,
        `hasFormattedAddress=${yesNo(candidate.hasFormattedAddressEvidence === true)}`,
        `hasProviderId=${yesNo(candidate.hasProviderIdEvidence === true)}`,
        `provisionalHandoff=${candidate.fieldToBearingsProvisionalHandoff ? 'present' : 'absent'}`,
        `handoffFutureOwner=${candidate.fieldToBearingsProvisionalHandoff?.futureOwnerHint ?? 'none'}`,
        `handoffCurrentOwner=${candidate.fieldToBearingsProvisionalHandoff?.currentOwner ?? 'none'}`,
        `handoffSourceEvidence=${candidate.fieldToBearingsProvisionalHandoff?.sourceEvidenceStatus ?? 'none'}`,
        `bearingsCandidateAdmissibility=${candidate.bearingsCandidateAdmissibility?.overallStatus ?? 'absent'}`,
        `bearingsSpatialAdmissibility=${candidate.bearingsCandidateAdmissibility?.spatialAdmissibilityStatus ?? 'absent'}`,
        `bearingsSourceEvidence=${candidate.bearingsCandidateAdmissibility?.sourceEvidenceStatus ?? 'absent'}`,
        `bearingsDistrictSpatialStructure=${candidate.bearingsCandidateAdmissibility?.districtSpatialStructureStatus ?? 'absent'}`,
        `bearingsPlanTimeHoursFeasibility=${candidate.bearingsCandidateAdmissibility?.planTimeHoursFeasibilityStatus ?? 'absent'}`,
        `bearingsMovementFeasibility=${candidate.bearingsCandidateAdmissibility?.movementFeasibilityStatus ?? 'absent'}`,
        `bearingsPlaceRight=${candidate.bearingsCandidateAdmissibility?.placeRightStatus ?? 'absent'}`,
        `bearingsRequiredStopSurvival=${candidate.bearingsCandidateAdmissibility?.requiredStopSurvivalStatus ?? 'absent'}`,
        `bearingsUpgradeRequirement=${candidate.bearingsCandidateAdmissibility?.upgradeRequirement ?? 'absent'}`,
        `bearingsFieldCurrentHoursEvidence=${candidate.bearingsCandidateAdmissibility?.fieldCurrentHoursEvidenceStatus ?? 'absent'}`,
        `q5OutsideEnvelopeCorrectness=${candidate.bearingsCandidateAdmissibility?.q5OutsideEnvelopeCorrectness.classification ?? 'absent'}`,
        `q5EvidenceBasis=${candidate.bearingsCandidateAdmissibility?.q5OutsideEnvelopeCorrectness.evidenceBasis ?? 'absent'}`,
        `q5NearBoundaryThresholdM=${candidate.bearingsCandidateAdmissibility?.q5OutsideEnvelopeCorrectness.nearBoundaryThresholdM ?? 'absent'}`,
        `bearingsDiagnosticOnly=${candidate.bearingsCandidateAdmissibility ? yesNo(candidate.bearingsCandidateAdmissibility.diagnosticOnly) : 'no'}`,
        `bearingsRouteEligibilityChanged=${candidate.bearingsCandidateAdmissibility ? yesNo(candidate.bearingsCandidateAdmissibility.routeEligibilityChanged) : 'no'}`,
      ].join(';'),
    ),
  )
  return entries.length > 0 ? entries.join(' | ') : 'unavailable'
}

function formatFieldQualityGateCandidateDiagnostics(result: GeneratePlanResult): string {
  const diagnostics =
    result.trace.retrievalDiagnostics.liveSource.liveCandidateSurvivalDiagnostics ?? []
  if (diagnostics.length === 0) {
    return 'unavailable'
  }
  return diagnostics
    .map((diagnostic) =>
      [
        `candidate=${diagnostic.venueName}`,
        `fieldCandidateClass=${diagnostic.fieldCandidateClass}`,
        `qualityVerdict=${diagnostic.qualityVerdict}`,
        `proofEligible=${yesNo(diagnostic.proofEligible)}`,
        `diagnosticOnly=${yesNo(diagnostic.diagnosticOnly)}`,
        `primaryQualityReason=${diagnostic.primaryQualityReason}`,
        `survivalStatus=${diagnostic.status}`,
        `dropReason=${diagnostic.dropReason}`,
        `hasProviderPlaceId=${yesNo(diagnostic.hasProviderPlaceId)}`,
        `hasFormattedAddress=${yesNo(diagnostic.hasFormattedAddress)}`,
        `hasLocation=${yesNo(diagnostic.hasLocation)}`,
        `hasCategoriesTypes=${yesNo(diagnostic.hasCategoriesTypes)}`,
        `hasHoursOpenStatus=${yesNo(diagnostic.hasHoursOpenStatus)}`,
        `hasRating=${yesNo(diagnostic.hasRating)}`,
        `hasUserRatingCount=${yesNo(diagnostic.hasUserRatingCount)}`,
      ].join(';'),
    )
    .join(' | ')
}

function formatFieldPocketQualityDiagnosticRollups(result: GeneratePlanResult): string {
  const rollups = result.trace.retrievalDiagnostics.liveSource.liveDiagnosticRollups
  if (!rollups) {
    return 'unavailable'
  }
  return [
    `pocketFilterKept=${rollups.pocketFilterKeptCount}`,
    `pocketFilterRejected=${rollups.pocketFilterRejectedCount}`,
    `canonicalLiveCandidate=${rollups.canonicalLiveCandidateCount}`,
    `provisionalLiveCandidate=${rollups.provisionalLiveCandidateCount}`,
    `blockedLiveCandidate=${rollups.blockedLiveCandidateCount}`,
    `curatedStaticCandidate=${rollups.curatedStaticCandidateCount}`,
    `provisionalHandoffCandidate=${rollups.provisionalHandoffCandidateCount}`,
    `provisionalHandoffWithLocation=${rollups.provisionalHandoffWithLocationCount}`,
    `provisionalHandoffWithFormattedAddress=${rollups.provisionalHandoffWithFormattedAddressCount}`,
    `provisionalHandoffOutsideEnvelope=${rollups.provisionalHandoffOutsideEnvelopeCount}`,
    `provisionalHandoffMissingLocation=${rollups.provisionalHandoffMissingLocationCount}`,
    `provisionalHandoffRequiresBearingsAdmissibility=${rollups.provisionalHandoffRequiresBearingsAdmissibilityCount}`,
    `bearingsCandidateAdmissibilityDiagnostic=${rollups.bearingsCandidateAdmissibilityDiagnosticCount}`,
    `bearingsSpatialAdmissibilityRequired=${rollups.bearingsSpatialAdmissibilityRequiredCount}`,
    `bearingsPlanTimeHoursFeasibilityRequired=${rollups.bearingsPlanTimeHoursFeasibilityRequiredCount}`,
    `bearingsMovementFeasibilityRequired=${rollups.bearingsMovementFeasibilityRequiredCount}`,
    `bearingsPlaceRightRequired=${rollups.bearingsPlaceRightRequiredCount}`,
    `bearingsBlockedCandidate=${rollups.bearingsBlockedCandidateCount}`,
    `bearingsProvisionalOnlyCandidate=${rollups.bearingsProvisionalOnlyCandidateCount}`,
    `bearingsOutsideEnvelope=${rollups.bearingsOutsideEnvelopeCount}`,
    `bearingsMissingLocation=${rollups.bearingsMissingLocationCount}`,
    `bearingsAdmissibilityNotEvaluated=${rollups.bearingsAdmissibilityNotEvaluatedCount}`,
    `bearingsCandidateUpgradeRequired=${rollups.bearingsCandidateUpgradeRequiredCount}`,
    `q5LegitimatelyOutsideEnvelope=${rollups.q5LegitimatelyOutsideEnvelopeCount}`,
    `q5NearBoundaryOrAmbiguous=${rollups.q5NearBoundaryOrAmbiguousCount}`,
    `q5PossiblyFalseDrop=${rollups.q5PossiblyFalseDropCount}`,
    `q5InsufficientData=${rollups.q5InsufficientDataCount}`,
    `q5UnknownExact22DueToMissingSavedCandidateDetails=${rollups.q5UnknownExact22DueToMissingSavedCandidateDetailsCount}`,
    `rejectedOutsideSelectedEnvelope=${rollups.rejectedOutsideSelectedEnvelopeCount}`,
    `rejectedMissingLocation=${rollups.rejectedMissingLocationCount}`,
    `rejectedUnknownDistance=${rollups.rejectedUnknownDistanceCount}`,
    `qualityApproved=${rollups.qualityApprovedCount}`,
    `qualityDemoted=${rollups.qualityDemotedCount}`,
    `qualitySuppressed=${rollups.qualitySuppressedCount}`,
    `qualityBlockedMissingEvidence=${rollups.qualityBlockedMissingEvidenceCount}`,
    `hoursDemoted=${rollups.hoursDemotedCount}`,
    `hoursSuppressed=${rollups.hoursSuppressedCount}`,
    `liveSurvivalEligible=${rollups.liveSurvivalEligibleCount}`,
  ].join('; ')
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
  const liveScoredVenues = params.result.scoredVenues.filter(isLiveScoredVenue)
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
    providerAttritionByQuery: formatProviderAttritionByQuery(params.result, params.counters),
    providerAttritionTotals: formatProviderAttritionTotals(params.result),
    providerCandidateSelectionCounts: formatProviderCandidateSelectionCounts(params.result),
    providerCandidateRejectionReasons: formatProviderCandidateRejectionReasons(params.result),
    selectedStopSourceOrigins: formatSelectedStopSourceOrigins(params.result),
    selectedWindDownEvidenceAvailabilityFlags: formatSelectedVenueEvidenceFlags(params.windDown.scoredVenue),
    survivingLiveCandidateEvidenceAvailabilityFlags:
      formatSurvivingLiveCandidateEvidenceFlags(params.result.scoredVenues),
    perQueryRawProviderRecords: formatPerQueryRawProviderRecords(params.result),
    perQueryMappedProviderRecords: formatPerQueryMappedProviderRecords(params.result),
    perQueryPreFilterNormalizedRecords: formatPerQueryPreFilterNormalizedRecords(params.result),
    aggregateEffectiveLiveVenues: String(params.result.trace.retrievalDiagnostics.liveSource.normalizedCount),
    aggregateQualityApprovedLiveVenues: String(params.result.trace.retrievalDiagnostics.liveSource.approvedCount),
    aggregateDemotedLiveVenues: String(params.result.trace.retrievalDiagnostics.liveSource.demotedCount),
    aggregateSuppressedLiveVenues: String(params.result.trace.retrievalDiagnostics.liveSource.suppressedCount),
    aggregateMergedLiveVenues: String(
      params.result.trace.retrievalDiagnostics.liveSource.liveRetrievedCount +
        params.result.trace.retrievalDiagnostics.liveSource.dedupedLiveCount,
    ),
    aggregateScoredRetrievalLiveVenues: String(countLiveSourceScoredVenues(params.result)),
    aggregateRolePoolLiveVenues: String(
      sumRecordNumbers(params.result.trace.retrievalDiagnostics.liveSource.liveRolePoolCounts),
    ),
    aggregateFinalRouteLiveStops: String(
      sumRecordNumbers(params.result.trace.retrievalDiagnostics.liveSource.liveRoleWinCounts),
    ),
    fieldAttritionSubstageCounts: formatFieldAttritionSubstageCounts(params.result),
    fieldAttritionDropReasonsByStage: formatFieldAttritionDropReasonsByStage(params.result),
    fieldPocketCandidateDiagnostics: formatFieldPocketCandidateDiagnostics(params.result),
    fieldQualityGateCandidateDiagnostics: formatFieldQualityGateCandidateDiagnostics(params.result),
    fieldPocketQualityDiagnosticRollups: formatFieldPocketQualityDiagnosticRollups(params.result),
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

function extractSemicolonField(serialized: string, key: string): string | null {
  const fields = serialized.split(';').map((field) => field.trim())
  const prefix = `${key}=`
  const field = fields.find((entry) => entry.startsWith(prefix))
  return field ? field.slice(prefix.length).trim() : null
}

function buildProvisionalLeakageGuardBlockReason(params: {
  providerCandidateSelectionCounts: string
  providerCalls: number
}): string | null {
  const guardStatus =
    extractSemicolonField(params.providerCandidateSelectionCounts, 'provisionalLeakageGuardStatus') ??
    extractSemicolonField(params.providerCandidateSelectionCounts, 'provisionalLeakageGuard')
  const overlapClassification = extractSemicolonField(
    params.providerCandidateSelectionCounts,
    'overlapClassification',
  )
  const routeTruthRisk = extractSemicolonField(params.providerCandidateSelectionCounts, 'routeTruthRisk')
  const guardRequired =
    params.providerCalls > 0 ||
    params.providerCandidateSelectionCounts.includes('candidateClassRollups=') ||
    params.providerCandidateSelectionCounts.includes('provisionalLeakageGuard')

  if (!guardRequired) {
    return null
  }
  if (!guardStatus) {
    return 'provisionalLeakageGuard blocked:not_evaluated'
  }
  if (guardStatus !== 'pass') {
    return `provisionalLeakageGuard blocked:${guardStatus}`
  }
  if (overlapClassification === 'identity_overlap_ambiguous' || overlapClassification === 'insufficient_evidence') {
    return `provisionalLeakageGuard blocked:${overlapClassification}`
  }
  if (routeTruthRisk === 'yes') {
    return 'provisionalLeakageGuard blocked:routeTruthRisk'
  }
  return null
}

function buildRow(params: {
  observation: LifecycleObservation
  providerCalls: number
  hostedCalls: number
}): ProofRow {
  const provisionalLeakageGuardBlockReason = buildProvisionalLeakageGuardBlockReason({
    providerCandidateSelectionCounts: params.observation.providerCandidateSelectionCounts,
    providerCalls: params.providerCalls,
  })
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
  const falseGreenRisk =
    disqualifyingMasking ||
    params.observation.compatibilityRouteTruth ||
    Boolean(provisionalLeakageGuardBlockReason)
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
    !disqualifyingMasking &&
    !provisionalLeakageGuardBlockReason
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
    mode: params.observation.mode,
    'starter/family': params.observation.starterFamily,
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
    'why not MVP green': validLiveProofPass
      ? 'valid live proof pass'
      : joinReasonList([
          params.observation.whyNotMvpGreen,
          ...(provisionalLeakageGuardBlockReason ? [provisionalLeakageGuardBlockReason] : []),
        ]),
    'invalid false-green? yes/no': yesNo(invalidFalseGreen),
    'proof validity label': validLiveProofPass
      ? 'valid_live_proof_pass'
      : params.observation.honestFail
        ? 'founder_approved_honest_fail'
        : params.observation.diagnosticOnly
          ? 'diagnostic_only_not_mvp_green'
          : 'invalid_false_green',
    'mode context adapter': params.observation.modeContextAdapter,
    'Curate starter context supplied? yes/no': yesNo(params.observation.curateStarterContextSupplied),
    'Surprise context carrier exercised? yes/no': yesNo(params.observation.surpriseContextCarrierExercised),
    'Build context carrier exercised? yes/no': yesNo(params.observation.buildContextCarrierExercised),
    'future mode context requirement': params.observation.futureModeContextRequirement,
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
    'provider attrition by query': params.observation.providerAttritionByQuery,
    'provider attrition totals': params.observation.providerAttritionTotals,
    'provider candidate selection counts': params.observation.providerCandidateSelectionCounts,
    'provider candidate rejection reasons': params.observation.providerCandidateRejectionReasons,
    'selected stop source origins': params.observation.selectedStopSourceOrigins,
    'selected windDown evidence availability flags': params.observation.selectedWindDownEvidenceAvailabilityFlags,
    'surviving live candidate evidence availability flags': params.observation.survivingLiveCandidateEvidenceAvailabilityFlags,
    perQueryRawProviderRecords: params.observation.perQueryRawProviderRecords,
    perQueryMappedProviderRecords: params.observation.perQueryMappedProviderRecords,
    perQueryPreFilterNormalizedRecords: params.observation.perQueryPreFilterNormalizedRecords,
    aggregateEffectiveLiveVenues: params.observation.aggregateEffectiveLiveVenues,
    aggregateQualityApprovedLiveVenues: params.observation.aggregateQualityApprovedLiveVenues,
    aggregateDemotedLiveVenues: params.observation.aggregateDemotedLiveVenues,
    aggregateSuppressedLiveVenues: params.observation.aggregateSuppressedLiveVenues,
    aggregateMergedLiveVenues: params.observation.aggregateMergedLiveVenues,
    aggregateScoredRetrievalLiveVenues: params.observation.aggregateScoredRetrievalLiveVenues,
    aggregateRolePoolLiveVenues: params.observation.aggregateRolePoolLiveVenues,
    aggregateFinalRouteLiveStops: params.observation.aggregateFinalRouteLiveStops,
    'field attrition substage counts': params.observation.fieldAttritionSubstageCounts,
    'field attrition drop reasons by stage': params.observation.fieldAttritionDropReasonsByStage,
    'field pocket candidate diagnostics': params.observation.fieldPocketCandidateDiagnostics,
    'field quality gate candidate diagnostics': params.observation.fieldQualityGateCandidateDiagnostics,
    'field pocket/quality diagnostic rollups': params.observation.fieldPocketQualityDiagnosticRollups,
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
    mode: 'curate',
    starterFamily: 'not_exercised_before_provider',
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
    modeContextAdapter:
      'mode=curate; curateStarter=not_exercised; surpriseContext=not_exercised; buildContext=not_exercised',
    curateStarterContextSupplied: false,
    surpriseContextCarrierExercised: false,
    buildContextCarrierExercised: false,
    futureModeContextRequirement:
      'Provider-consuming rows must build and pass runner-local mode context before artifact-backed itinerary, RuntimeRouteArtifact, and Review-Lock validation.',
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
  modeContext: RunnerModeContext
}): Promise<LifecycleObservation> {
  const { buildLockInputFromRouteAuthoritySnapshot, buildRouteAuthoritySnapshot } = await import(
    '../src/app/services/routeAuthority/routeAuthorityService.ts'
  )
  const { buildArtifactBackedVisibleItinerary, validatePublicContractEntryArtifactTruth } = await import(
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
  const artifactTruthContext = {
    mode: params.modeContext.mode,
    starterPack:
      params.modeContext.mode === 'curate'
        ? params.modeContext.curate.starterPack
        : null,
  }
  const artifactTruth = validatePublicContractEntryArtifactTruth(artifact, artifactTruthContext)
  const artifactBackedItinerary = buildArtifactBackedVisibleItinerary({
    artifact,
    itinerary: params.result.itinerary,
    context: artifactTruthContext,
  })
  const artifactBackedItineraryRejectionReason =
    artifactTruth.allowedToRender
      ? artifactBackedItinerary
        ? 'none'
        : 'artifact_backed_itinerary_role_mismatch'
      : joinReasonList(artifactTruth.rejectionReasons)
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
      mode: params.modeContext.mode,
      starterFamily:
        params.modeContext.curate.starterPack
          ? `${params.modeContext.curate.starterPack.title} / ${params.modeContext.curate.starterPack.id}`
          : `${params.modeContext.mode} / no-starter-context`,
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
      runtimeLockTruthReason: `missing_artifact_backed_visible_itinerary:${artifactBackedItineraryRejectionReason}`,
      lifecycleInputAvailability: `missing_artifact_backed_visible_itinerary:${artifactBackedItineraryRejectionReason}`,
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
      whyNotMvpGreen: `artifact-backed itinerary unavailable (${artifactBackedItineraryRejectionReason}); RuntimeRouteArtifact blocked`,
      modeContextAdapter: formatModeContextAdapter(params.modeContext),
      curateStarterContextSupplied: params.modeContext.curate.status === 'supplied',
      surpriseContextCarrierExercised: params.modeContext.surprise.status === 'supplied',
      buildContextCarrierExercised: params.modeContext.build.status === 'supplied',
      futureModeContextRequirement: futureModeContextRequirement(params.modeContext),
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
    mode: params.modeContext.mode,
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
    mode: params.modeContext.mode,
    starterFamily:
      params.modeContext.curate.starterPack
        ? `${params.modeContext.curate.starterPack.title} / ${params.modeContext.curate.starterPack.id}`
        : `${params.modeContext.mode} / no-starter-context`,
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
    modeContextAdapter: formatModeContextAdapter(params.modeContext),
    curateStarterContextSupplied: params.modeContext.curate.status === 'supplied',
    surpriseContextCarrierExercised: params.modeContext.surprise.status === 'supplied',
    buildContextCarrierExercised: params.modeContext.build.status === 'supplied',
    futureModeContextRequirement: futureModeContextRequirement(params.modeContext),
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
    const modeContext = buildCurateRunnerModeContext(starterPack)
    const result = await runGovernedFieldProxyRoutePlanBuild(buildCurateStarterPackInput(starterPack), {
      starterPack,
    })
    assert(counters.fieldProxyCalls <= 3, `field_proxy_calls_exceeded_3:${counters.fieldProxyCalls}`)
    assert(counters.providerCalls <= 3, `provider_calls_exceeded_3:${counters.providerCalls}`)
    assert(counters.centerKeys.size <= 1, `maxCenters_exceeded_1:${counters.centerKeys.size}`)
    const observation = await observeLiveLifecycle({ result, counters, modeContext })
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

assertProvisionalLeakageGuardDiagnostics()
assertSupportRoleRejectionDiagnostics()

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
        `- provider attrition totals: ${row['provider attrition totals']}`,
        `- provider candidate selection counts: ${row['provider candidate selection counts']}`,
        `- field attrition substage counts: ${row['field attrition substage counts']}`,
        `- selected stop source origins: ${row['selected stop source origins']}`,
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
        `- provider attrition by query: ${row['provider attrition by query']}`,
        `- per-query raw provider records: ${row.perQueryRawProviderRecords}`,
        `- per-query mapped provider records: ${row.perQueryMappedProviderRecords}`,
        `- per-query pre-filter normalized records: ${row.perQueryPreFilterNormalizedRecords}`,
        `- clarified aggregate live counts: effective=${row.aggregateEffectiveLiveVenues}; qualityApproved=${row.aggregateQualityApprovedLiveVenues}; demoted=${row.aggregateDemotedLiveVenues}; suppressed=${row.aggregateSuppressedLiveVenues}; merged=${row.aggregateMergedLiveVenues}; scoredRetrieval=${row.aggregateScoredRetrievalLiveVenues}; rolePool=${row.aggregateRolePoolLiveVenues}; finalRoute=${row.aggregateFinalRouteLiveStops}`,
        `- field attrition drop reasons by stage: ${row['field attrition drop reasons by stage']}`,
        `- field pocket candidate diagnostics: ${row['field pocket candidate diagnostics']}`,
        `- field quality gate candidate diagnostics: ${row['field quality gate candidate diagnostics']}`,
        `- field pocket/quality diagnostic rollups: ${row['field pocket/quality diagnostic rollups']}`,
        `- provider rejection/attrition reasons: ${row['provider candidate rejection reasons']}`,
        `- selected windDown evidence flags: ${row['selected windDown evidence availability flags']}`,
        `- surviving live candidate evidence flags: ${row['surviving live candidate evidence availability flags']}`,
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
