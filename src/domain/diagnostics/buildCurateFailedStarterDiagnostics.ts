import { assembleArcCandidates } from '../arc/assembleArcCandidates'
import { buildRolePools, type RolePools } from '../arc/buildRolePools'
import { getInvalidArcCombinationReasons } from '../arc/isValidArcCombination'
import { roleProjection } from '../config/roleProjection'
import { getRoleContract } from '../contracts/getRoleContract'
import { buildExperienceLens } from '../intent/buildExperienceLens'
import { getCrewPolicy } from '../intent/getCrewPolicy'
import { normalizeIntent } from '../intent/normalizeIntent'
import { applyContractRetrievalPressure } from '../retrieval/applyContractRetrievalPressure'
import { retrieveVenues } from '../retrieval/retrieveVenues'
import { scoreVenueCollection } from '../retrieval/scoreVenueFit'
import { runGeneratePlan } from '../runGeneratePlan'
import type { ArcStop, ScoredVenue } from '../types/arc'
import type { IntentInput, IntentProfile } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { StarterPack } from '../types/starterPack'
import type { InternalRole, Venue } from '../types/venue'

export interface CurateFailedStarterFieldCorpusDiagnostics {
  retrievedCount: number
  appendedCount: number
  candidateCount: number
  scoredCount: number
}

export interface CurateFailedStarterRuntimeHoursDiagnostics {
  requiredRetrievedCount: number
  wouldBlockRetrievedCount: number
  requiredScoredCount: number
  wouldBlockScoredCount: number
  bearingsRequiredCount: number
  bearingsWouldBlockCount: number
  missingRuntimeProofCount: number
}

export interface CurateFailedStarterRoleCandidateSample {
  venueId: string
  venueName: string
  score: number
  category: string
  fieldCorpus: boolean
  runtimeHoursRequired: boolean
}

export interface CurateFailedStarterRolePoolDiagnostics {
  count: number
  contractStatus: RolePools['contractPoolStatus'][InternalRole]
  topCandidates: CurateFailedStarterRoleCandidateSample[]
}

export interface CurateFailedStarterArcDiagnostics {
  candidateCount: number
  baseFullArcAttempts: number
  partialArcAttempts: number
  highlightOnlyAttempts: number
  invalidReasonHistogram: Record<string, number>
  surpriseDiagnostics: ReturnType<typeof assembleArcCandidates>['surpriseDiagnostics']
}

export interface CurateFailedStarterFallbackProbeDiagnostics {
  exactFallbackTraceAvailable: false
  exactFallbackTraceUnavailableReason: 'private_run_generate_plan_helper_not_extracted'
  peakCandidateCount: number
  supportCandidateCount: number
  fullArcAttempts: number
  partialArcAttempts: number
  highlightOnlyAttempts: number
  validFullArcCount: number
  validPartialArcCount: number
  validHighlightOnlyCount: number
  invalidReasonHistogram: Record<string, number>
  inferredFallbackFailureReason?: string
}

export interface CurateFailedStarterRunGeneratePlanComparison {
  generated: boolean
  failureReason?: string
  selectedStopIds: string[]
}

export interface CurateFailedStarterDiagnostics {
  starterId: string
  retrieval: {
    requestedMode: string
    effectiveMode: string
    liveFetchAttempted: boolean
    liveFetchSucceeded: boolean
    countsBySource: Record<string, number>
    retrievedVenueCount: number
    totalVenueCount: number
  }
  fieldCorpus: CurateFailedStarterFieldCorpusDiagnostics
  scoring: {
    rawScoredCount: number
    finalScoredCount: number
    retrievalContractApplied: boolean
    contractInfluenceSummary: string
  }
  runtimeHours: CurateFailedStarterRuntimeHoursDiagnostics
  rolePools: Record<UserStopRole, CurateFailedStarterRolePoolDiagnostics>
  arcAssembly: CurateFailedStarterArcDiagnostics
  fallbackProbe: CurateFailedStarterFallbackProbeDiagnostics
  runGeneratePlanComparison: CurateFailedStarterRunGeneratePlanComparison
  inferredFailureCategories: string[]
}

const fallbackPeakLimit = 12
const fallbackSupportLimit = 6

function roundScore(value: number): number {
  return Number(value.toFixed(3))
}

function isFieldCorpusVenue(venue: Venue): boolean {
  return (
    venue.source.sourceOrigin === 'curated' &&
    venue.source.curatedSubtype === 'curated-derived' &&
    venue.source.provider === 'google-places' &&
    Boolean(venue.source.providerRecordId)
  )
}

function requiresRuntimeHours(venue: Venue): boolean {
  return (
    venue.source.bearingsValidationRequirements?.includes(
      'runtime_hours_validation_required',
    ) === true
  )
}

function addReasons(
  histogram: Record<string, number>,
  reasons: string[],
): void {
  for (const reason of reasons) {
    histogram[reason] = (histogram[reason] ?? 0) + 1
  }
}

function roleScore(candidate: ScoredVenue, role: InternalRole): number {
  return candidate.roleScores[role]
}

function candidateSample(
  candidate: ScoredVenue,
  role: InternalRole,
): CurateFailedStarterRoleCandidateSample {
  return {
    venueId: candidate.venue.id,
    venueName: candidate.venue.name,
    score: roundScore(roleScore(candidate, role)),
    category: candidate.venue.category,
    fieldCorpus: isFieldCorpusVenue(candidate.venue),
    runtimeHoursRequired: requiresRuntimeHours(candidate.venue),
  }
}

function getRolePool(role: InternalRole, pools: RolePools): ScoredVenue[] {
  if (role === 'warmup') {
    return pools.warmup
  }
  if (role === 'peak') {
    return pools.peak
  }
  if (role === 'wildcard') {
    return pools.wildcard
  }
  return pools.cooldown
}

function buildRolePoolDiagnostics(
  pools: RolePools,
): Record<UserStopRole, CurateFailedStarterRolePoolDiagnostics> {
  const entries = (['warmup', 'peak', 'wildcard', 'cooldown'] as InternalRole[]).map(
    (role) => {
      const pool = getRolePool(role, pools)
      return [
        roleProjection[role],
        {
          count: pool.length,
          contractStatus: pools.contractPoolStatus[role],
          topCandidates: pool.slice(0, 8).map((candidate) => candidateSample(candidate, role)),
        },
      ] as const
    },
  )
  return Object.fromEntries(entries) as Record<
    UserStopRole,
    CurateFailedStarterRolePoolDiagnostics
  >
}

function buildInvalidArcDiagnostics(params: {
  pools: RolePools
  intent: IntentProfile
  crewPolicy: ReturnType<typeof getCrewPolicy>
  lens: ReturnType<typeof buildExperienceLens>
}): Pick<
  CurateFailedStarterArcDiagnostics,
  'baseFullArcAttempts' | 'partialArcAttempts' | 'highlightOnlyAttempts' | 'invalidReasonHistogram'
> {
  const histogram: Record<string, number> = {}
  let baseFullArcAttempts = 0
  let partialArcAttempts = 0
  let highlightOnlyAttempts = 0

  for (const warmup of params.pools.warmup) {
    for (const peak of params.pools.peak) {
      for (const cooldown of params.pools.cooldown) {
        baseFullArcAttempts += 1
        addReasons(
          histogram,
          getInvalidArcCombinationReasons(
            [
              { role: 'warmup', scoredVenue: warmup },
              { role: 'peak', scoredVenue: peak },
              { role: 'cooldown', scoredVenue: cooldown },
            ],
            params.intent,
            params.crewPolicy,
            params.lens,
          ),
        )
      }
      partialArcAttempts += 1
      addReasons(
        histogram,
        getInvalidArcCombinationReasons(
          [
            { role: 'warmup', scoredVenue: warmup },
            { role: 'peak', scoredVenue: peak },
          ],
          params.intent,
          params.crewPolicy,
          params.lens,
        ),
      )
    }
  }

  for (const peak of params.pools.peak) {
    highlightOnlyAttempts += 1
    addReasons(
      histogram,
      getInvalidArcCombinationReasons(
        [{ role: 'peak', scoredVenue: peak }],
        params.intent,
        params.crewPolicy,
        params.lens,
      ),
    )
    for (const cooldown of params.pools.cooldown) {
      partialArcAttempts += 1
      addReasons(
        histogram,
        getInvalidArcCombinationReasons(
          [
            { role: 'peak', scoredVenue: peak },
            { role: 'cooldown', scoredVenue: cooldown },
          ],
          params.intent,
          params.crewPolicy,
          params.lens,
        ),
      )
    }
  }

  return {
    baseFullArcAttempts,
    partialArcAttempts,
    highlightOnlyAttempts,
    invalidReasonHistogram: histogram,
  }
}

function chooseFallbackSupports(
  scoredVenues: ScoredVenue[],
  peak: ScoredVenue,
  role: 'warmup' | 'cooldown',
): ScoredVenue[] {
  return scoredVenues
    .filter((candidate) => candidate.venue.id !== peak.venue.id)
    .sort((left, right) => roleScore(right, role) - roleScore(left, role))
    .slice(0, fallbackSupportLimit)
}

function countValidFallbackOption(
  stops: ArcStop[],
  params: {
    intent: IntentProfile
    crewPolicy: ReturnType<typeof getCrewPolicy>
    lens: ReturnType<typeof buildExperienceLens>
    histogram: Record<string, number>
  },
): boolean {
  const reasons = getInvalidArcCombinationReasons(
    stops,
    params.intent,
    params.crewPolicy,
    params.lens,
  )
  addReasons(params.histogram, reasons)
  return reasons.length === 0
}

function buildFallbackProbe(params: {
  scoredVenues: ScoredVenue[]
  pools: RolePools
  intent: IntentProfile
  crewPolicy: ReturnType<typeof getCrewPolicy>
  lens: ReturnType<typeof buildExperienceLens>
}): CurateFailedStarterFallbackProbeDiagnostics {
  const peaks =
    params.pools.peak.length > 0
      ? params.pools.peak.slice(0, fallbackPeakLimit)
      : [...params.scoredVenues]
          .sort((left, right) => roleScore(right, 'peak') - roleScore(left, 'peak'))
          .slice(0, fallbackPeakLimit)
  const histogram: Record<string, number> = {}
  let supportCandidateCount = 0
  let fullArcAttempts = 0
  let partialArcAttempts = 0
  let highlightOnlyAttempts = 0
  let validFullArcCount = 0
  let validPartialArcCount = 0
  let validHighlightOnlyCount = 0

  for (const peak of peaks) {
    const warmups = chooseFallbackSupports(params.scoredVenues, peak, 'warmup')
    const cooldowns = chooseFallbackSupports(params.scoredVenues, peak, 'cooldown')
    supportCandidateCount += warmups.length + cooldowns.length

    for (const warmup of warmups) {
      partialArcAttempts += 1
      if (
        countValidFallbackOption(
          [
            { role: 'warmup', scoredVenue: warmup },
            { role: 'peak', scoredVenue: peak },
          ],
          { ...params, histogram },
        )
      ) {
        validPartialArcCount += 1
      }

      for (const cooldown of cooldowns) {
        fullArcAttempts += 1
        if (
          countValidFallbackOption(
            [
              { role: 'warmup', scoredVenue: warmup },
              { role: 'peak', scoredVenue: peak },
              { role: 'cooldown', scoredVenue: cooldown },
            ],
            { ...params, histogram },
          )
        ) {
          validFullArcCount += 1
        }
      }
    }

    for (const cooldown of cooldowns) {
      partialArcAttempts += 1
      if (
        countValidFallbackOption(
          [
            { role: 'peak', scoredVenue: peak },
            { role: 'cooldown', scoredVenue: cooldown },
          ],
          { ...params, histogram },
        )
      ) {
        validPartialArcCount += 1
      }
    }

    highlightOnlyAttempts += 1
    if (
      countValidFallbackOption(
        [{ role: 'peak', scoredVenue: peak }],
        { ...params, histogram },
      )
    ) {
      validHighlightOnlyCount += 1
    }
  }

  const inferredFallbackFailureReason =
    validFullArcCount > 0 || validPartialArcCount > 0 || validHighlightOnlyCount > 0
      ? undefined
      : supportCandidateCount === 0
        ? 'no_valid_support_candidates'
        : fullArcAttempts > 0 || partialArcAttempts > 0 || highlightOnlyAttempts > 0
          ? 'partial_arcs_built_but_invalid'
          : 'no_honest_route_available'

  return {
    exactFallbackTraceAvailable: false,
    exactFallbackTraceUnavailableReason: 'private_run_generate_plan_helper_not_extracted',
    peakCandidateCount: peaks.length,
    supportCandidateCount,
    fullArcAttempts,
    partialArcAttempts,
    highlightOnlyAttempts,
    validFullArcCount,
    validPartialArcCount,
    validHighlightOnlyCount,
    invalidReasonHistogram: histogram,
    inferredFallbackFailureReason,
  }
}

function inferFailureCategories(params: {
  rolePools: RolePools
  invalidReasonHistogram: Record<string, number>
  runtimeHours: CurateFailedStarterRuntimeHoursDiagnostics
  fieldCorpus: CurateFailedStarterFieldCorpusDiagnostics
  scoredCount: number
}): string[] {
  const categories = new Set<string>()
  const rolePoolCounts = [
    params.rolePools.warmup.length,
    params.rolePools.peak.length,
    params.rolePools.cooldown.length,
  ]

  if (rolePoolCounts.some((count) => count === 0)) {
    categories.add('role_invariants')
  }
  if (
    params.invalidReasonHistogram.invalid_shape ||
    params.invalidReasonHistogram.arc_viability ||
    params.invalidReasonHistogram.lens_stop_shape ||
    params.invalidReasonHistogram.single_stop_highlight_too_weak
  ) {
    categories.add('route_shape')
  }
  if (params.invalidReasonHistogram.category_repetition) {
    categories.add('category_mismatch')
  }
  if (params.invalidReasonHistogram.geography) {
    categories.add('geography')
  }
  if (params.invalidReasonHistogram.duplicate_venue) {
    categories.add('duplicate_identity')
  }
  if (params.runtimeHours.wouldBlockRetrievedCount > 0) {
    categories.add('hours')
  }
  if (
    params.fieldCorpus.retrievedCount > 0 &&
    params.scoredCount > 0 &&
    rolePoolCounts.some((count) => count < 2)
  ) {
    categories.add('score_pressure')
  }

  return [...categories]
}

function buildStarterInput(starterPack: StarterPack): IntentInput {
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

export async function buildCurateFailedStarterDiagnostics(
  starterPack: StarterPack,
): Promise<CurateFailedStarterDiagnostics> {
  const input = buildStarterInput(starterPack)
  const intent = normalizeIntent(input)
  const lens = buildExperienceLens({ intent, starterPack })
  const crewPolicy = getCrewPolicy(intent.crew)
  const roleContracts = getRoleContract({ intent, starterPack })
  const retrieval = await retrieveVenues(intent, lens, {
    requestedSourceMode: 'curated',
    starterPack,
  })
  const rawScoredVenues = scoreVenueCollection(
    retrieval.venues,
    intent,
    crewPolicy,
    lens,
    roleContracts,
    starterPack,
  )
  const retrievalPressure = applyContractRetrievalPressure({
    scoredVenues: rawScoredVenues,
  })
  const scoredVenues = retrievalPressure.scoredVenues
  const rolePools = buildRolePools(scoredVenues, crewPolicy, lens, intent, roleContracts)
  const arcAssembly = assembleArcCandidates(scoredVenues, intent, crewPolicy, lens, rolePools)
  const invalidArcDiagnostics = buildInvalidArcDiagnostics({
    pools: rolePools,
    intent,
    crewPolicy,
    lens,
  })
  const fallbackProbe = buildFallbackProbe({
    scoredVenues,
    pools: rolePools,
    intent,
    crewPolicy,
    lens,
  })
  let comparison: CurateFailedStarterRunGeneratePlanComparison
  try {
    const generated = await runGeneratePlan(input, {
      starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: false,
    })
    comparison = {
      generated: true,
      selectedStopIds: generated.selectedArc.stops.map((stop) => stop.scoredVenue.venue.id),
    }
  } catch (error) {
    comparison = {
      generated: false,
      failureReason: error instanceof Error ? error.message : String(error),
      selectedStopIds: [],
    }
  }

  const retrievedFieldCorpus = retrieval.venues.filter(isFieldCorpusVenue)
  const scoredFieldCorpus = scoredVenues.filter((candidate) => isFieldCorpusVenue(candidate.venue))
  const requiredRetrieved = retrieval.venues.filter(requiresRuntimeHours)
  const requiredScored = scoredVenues.filter((candidate) => requiresRuntimeHours(candidate.venue))
  const bearingsRuntimeHours = retrieval.sourceMode.bearingsRuntimeHours
  const fieldCorpus = {
    retrievedCount: retrievedFieldCorpus.length,
    appendedCount: retrieval.sourceMode.curateStaticCorpus?.appendedCount ?? 0,
    candidateCount: retrieval.sourceMode.curateStaticCorpus?.candidateCount ?? 0,
    scoredCount: scoredFieldCorpus.length,
  }
  const runtimeHours = {
    requiredRetrievedCount: requiredRetrieved.length,
    wouldBlockRetrievedCount: requiredRetrieved.length,
    requiredScoredCount: requiredScored.length,
    wouldBlockScoredCount: requiredScored.length,
    bearingsRequiredCount: bearingsRuntimeHours?.requiredVenueCount ?? 0,
    bearingsWouldBlockCount:
      bearingsRuntimeHours?.wouldBlockUnderConservativeEnforcementCount ?? 0,
    missingRuntimeProofCount: bearingsRuntimeHours?.missingRuntimeProofCount ?? 0,
  }

  return {
    starterId: starterPack.id,
    retrieval: {
      requestedMode: retrieval.sourceMode.requestedMode,
      effectiveMode: retrieval.sourceMode.effectiveMode,
      liveFetchAttempted: retrieval.sourceMode.liveFetchAttempted,
      liveFetchSucceeded: retrieval.sourceMode.liveFetchSucceeded,
      countsBySource: retrieval.sourceMode.countsBySource,
      retrievedVenueCount: retrieval.venues.length,
      totalVenueCount: retrieval.totalVenueCount,
    },
    fieldCorpus,
    scoring: {
      rawScoredCount: rawScoredVenues.length,
      finalScoredCount: scoredVenues.length,
      retrievalContractApplied: retrievalPressure.retrievalContractApplied,
      contractInfluenceSummary: retrievalPressure.contractInfluenceSummary,
    },
    runtimeHours,
    rolePools: buildRolePoolDiagnostics(rolePools),
    arcAssembly: {
      candidateCount: arcAssembly.candidates.length,
      ...invalidArcDiagnostics,
      surpriseDiagnostics: arcAssembly.surpriseDiagnostics,
    },
    fallbackProbe,
    runGeneratePlanComparison: comparison,
    inferredFailureCategories: inferFailureCategories({
      rolePools,
      invalidReasonHistogram: invalidArcDiagnostics.invalidReasonHistogram,
      runtimeHours,
      fieldCorpus,
      scoredCount: scoredVenues.length,
    }),
  }
}
