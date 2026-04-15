/**
 * ARC BOUNDARY: cross-engine generation orchestrator.
 *
 * Owns:
 * - deterministic execution order across Field/Interpretation/Bearings/Waypoint seams
 * - canonical artifact handoff between those engines
 *
 * Does NOT own:
 * - semantic interpretation authorship
 * - admissibility truth authorship
 * - product presentation logic
 */
import { assembleArcCandidates } from './arc/assembleArcCandidates'
import { buildRolePools, type RolePools } from './arc/buildRolePools'
import { getRoleAlternatives } from './arc/getRoleAlternatives'
import { roleProjection } from './config/roleProjection'
import { buildBoundaryTruthNotes } from './debug/buildBoundaryTruthNotes'
import { computePairMatrix } from './debug/computeCandidateOverlap'
import { buildStopReasons } from './explainability/buildStopReasons'
import { recommendDistricts } from './interpretation/district/recommendDistricts'
import { resolveDistrictAnchor } from './interpretation/district/resolveDistrictAnchor'
import { getRoleContract } from './contracts/getRoleContract'
import { buildExperienceLens } from './intent/buildExperienceLens'
import { getCrewPolicy } from './intent/getCrewPolicy'
import { normalizeIntent } from './intent/normalizeIntent'
import { projectItinerary } from './itinerary/projectItinerary'
import { buildTemporalTrace, detectTemporalMode } from './constraints/detectTemporalMode'
import { applyTargetedRefinement } from './refinement/applyTargetedRefinement'
import { getRefinementDirective } from './refinement/getRefinementDirective'
import { selectRefinementTargetRoles } from './refinement/selectRefinementTargetRoles'
import { computeLiveCompetitiveness } from './retrieval/computeLiveCompetitiveness'
import { getNearbyAlternatives } from './retrieval/getNearbyAlternatives'
import { applyContractRetrievalPressure } from './retrieval/applyContractRetrievalPressure'
import { retrieveVenues, type RetrieveVenuesResult } from './retrieval/retrieveVenues'
import { scoreVenueCollection } from './retrieval/scoreVenueFit'
import { isValidArcCombination } from './arc/isValidArcCombination'
import { isArcViable, scoreArcAssembly } from './arc/scoreArcAssembly'
import { rankWithWaypointBoundary } from '../integrations/waypoint/core'
import { createId } from '../lib/ids'
import { starterPacks } from '../data/starterPacks'
import type {
  ArcAssemblySurpriseDiagnostics,
  ArcCandidate,
  ArcStop,
  ScoredVenue,
} from './types/arc'
import type {
  ArcCandidateSnapshot,
  BoundaryDiagnostics,
  OverlapDiagnostics,
  OverlapScenarioDiagnostics,
  RankedArcCandidateSnapshot,
} from './types/boundaryDiagnostics'
import type { ConstraintTraceEntry } from './types/constraints'
import type {
  BuildFallbackTraceDiagnostics,
  GenerationDiagnostics,
  RoleWinnerFrequencyEntry,
} from './types/diagnostics'
import type { ExperienceLens } from './types/experienceLens'
import type {
  ContractConstraints,
  ExperienceContract,
  ExperienceMode,
  IntentInput,
  IntentProfile,
  PersonaMode,
  VibeAnchor,
} from './types/intent'
import type { Itinerary, UserStopRole } from './types/itinerary'
import type { SourceMode } from './types/sourceMode'
import type { StarterPack } from './types/starterPack'
import type { Venue } from './types/venue'

export interface GenerationTrace extends GenerationDiagnostics {
  intent: IntentProfile
  lens: Pick<ExperienceLens, 'tone' | 'discoveryBias' | 'movementTolerance'>
  rankingEngine: string
}

export interface GeneratePlanResult {
  itinerary: Itinerary
  selectedArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  intentProfile: IntentProfile
  lens: ExperienceLens
  trace: GenerationTrace
}

interface GeneratePlanOptions {
  starterPack?: StarterPack
  baselineArc?: ArcCandidate
  baselineTrace?: GenerationTrace
  baselineItineraryId?: string
  seedVenues?: Venue[]
  experienceContract?: ExperienceContract
  contractConstraints?: ContractConstraints
  debugMode?: boolean
  strictShape?: boolean
  sourceMode?: SourceMode
  sourceModeOverrideApplied?: boolean
}

interface RefinementPathContext {
  targetedRoles: UserStopRole[]
  primaryTargetRole?: UserStopRole
  targetRoleExistedInVisiblePlan: boolean
  targetRoleSelectionReason: string
  targetedCandidateCount: number
  targetedChangeSucceeded: boolean
  fullPlanFallbackUsed: boolean
  winnerInertiaDetected: boolean
  winnerInertiaReduced: boolean
  winnerInertiaNotes: string[]
}

type FallbackFailureReason =
  | 'no_highlight_candidates'
  | 'no_standard_or_recovered_highlight_candidates'
  | 'recovered_highlight_candidates_invalid'
  | 'no_valid_support_candidates'
  | 'partial_arcs_built_but_invalid'
  | 'partial_arc_selected_but_dropped_downstream'
  | 'final_plan_construction_rejected_arc'
  | 'no_honest_route_available'

function scoreFallbackSupportReadability(
  support: ScoredVenue,
  peak: ScoredVenue,
  role: 'warmup' | 'cooldown',
): number {
  const roleScore =
    role === 'warmup' ? support.roleScores.warmup : support.roleScores.cooldown
  const shapeScore =
    role === 'warmup' ? support.stopShapeFit.start : support.stopShapeFit.windDown
  const categoryContrast =
    support.venue.category === peak.venue.category ? -0.08 : 0.1
  const archetypeContrast =
    support.taste.signals.primaryExperienceArchetype ===
    peak.taste.signals.primaryExperienceArchetype
      ? -0.07
      : 0.09
  const energyContrast =
    role === 'warmup'
      ? Math.max(0, (peak.venue.energyLevel - support.venue.energyLevel + 1) / 4)
      : Math.max(
          0,
          (support.venue.energyLevel <= peak.venue.energyLevel
            ? peak.venue.energyLevel - support.venue.energyLevel + 1
            : 0) / 4,
        )
  return (
    roleScore * 0.48 +
    shapeScore * 0.22 +
    energyContrast * 0.14 +
    categoryContrast +
    archetypeContrast
  )
}

const FALLBACK_PEAK_CANDIDATE_LIMIT = 12
const FALLBACK_SUPPORT_CANDIDATE_LIMIT = 6
const PARTIAL_ARC_SELECTION_DELTA = 0.02

interface BuildFallbackCandidateResult {
  candidate?: ArcCandidate
  trace: BuildFallbackTraceDiagnostics
}

interface FallbackArcOption {
  stops: ArcStop[]
  score: ReturnType<typeof scoreArcAssembly>
  supportReadability: number
  fallbackType: 'full' | 'partial' | 'single'
  partialReason?: 'start_plus_highlight' | 'highlight_plus_wind_down'
  tieKey: string
}

function buildFallbackArcTieKey(stops: ArcStop[]): string {
  return stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.venue.id}`)
    .join('|')
}

function compareFallbackArcOptions(left: FallbackArcOption, right: FallbackArcOption): number {
  const scoreDelta = right.score.totalScore - left.score.totalScore
  if (scoreDelta !== 0) {
    return scoreDelta
  }
  const readabilityDelta = right.supportReadability - left.supportReadability
  if (readabilityDelta !== 0) {
    return readabilityDelta
  }
  return left.tieKey.localeCompare(right.tieKey)
}

function chooseFallbackSupports(
  scoredVenues: ScoredVenue[],
  peak: ScoredVenue,
  role: 'warmup' | 'cooldown',
  limit = FALLBACK_SUPPORT_CANDIDATE_LIMIT,
): ScoredVenue[] {
  return scoredVenues
    .filter((candidate) => candidate.venue.id !== peak.venue.id)
    .sort((left, right) => {
      const scoreDelta =
        scoreFallbackSupportReadability(right, peak, role) -
        scoreFallbackSupportReadability(left, peak, role)
      if (scoreDelta !== 0) {
        return scoreDelta
      }
      return left.venue.id.localeCompare(right.venue.id)
    })
    .slice(0, limit)
}

function buildFallbackCandidate(
  scoredVenues: ScoredVenue[],
  rolePools: RolePools,
  intent: IntentProfile,
  crewPolicy: ReturnType<typeof getCrewPolicy>,
  lens: ExperienceLens,
): BuildFallbackCandidateResult {
  const poolPeakCandidates = rolePools.peak.slice(0, FALLBACK_PEAK_CANDIDATE_LIMIT)
  const poolRecoveryCount =
    rolePools.contractPoolStatus.peak.recoveredHighlightCandidatesCount ?? 0
  const poolUsedRecovery = Boolean(
    rolePools.contractPoolStatus.peak.recoveredCentralMomentHighlight,
  )
  const poolRecoveryReason =
    rolePools.contractPoolStatus.peak.centralMomentRecoveryReason
  const peaks =
    poolPeakCandidates.length > 0
      ? poolPeakCandidates
      : [...scoredVenues]
          .sort((left, right) => {
            const peakDelta = right.roleScores.peak - left.roleScores.peak
            if (peakDelta !== 0) {
              return peakDelta
            }
            return left.venue.id.localeCompare(right.venue.id)
          })
          .slice(0, FALLBACK_PEAK_CANDIDATE_LIMIT)
  if (peaks.length === 0) {
    const fallbackFailureReason: FallbackFailureReason =
      poolRecoveryCount > 0
        ? 'recovered_highlight_candidates_invalid'
        : 'no_standard_or_recovered_highlight_candidates'
    return {
      trace: {
        fullArcCandidatesCount: 0,
        partialArcCandidatesCount: 0,
        highlightOnlyCandidatesCount: 0,
        bestFullArcFound: false,
        bestPartialArcFound: false,
        bestHighlightOnlyFound: false,
        usedRecoveredCentralMomentHighlight: poolUsedRecovery,
        recoveredHighlightCandidatesCount: poolRecoveryCount,
        centralMomentRecoveryReason: poolRecoveryReason,
        fallbackFailureReason,
      },
    }
  }

  const options: FallbackArcOption[] = []
  const seen = new Set<string>()
  let supportCandidateCount = 0
  let partialAttemptCount = 0
  let highlightOnlyAttemptCount = 0
  const addOption = (
    stops: ArcStop[],
    fallbackType: FallbackArcOption['fallbackType'],
    partialReason?: FallbackArcOption['partialReason'],
  ) => {
    const highlight = stops.find((stop) => stop.role === 'peak')
    if (!highlight) {
      return
    }
    const highlightIntensity = highlight.scoredVenue.taste.signals.momentIntensity.score
    const supportingStopsCount = stops.filter(
      (stop) => stop.role === 'warmup' || stop.role === 'cooldown',
    ).length
    const viabilitySatisfied =
      stops.length === 1
        ? highlightIntensity >= 0.8
        : isArcViable({
            hasHighlight: true,
            highlightIntensity,
            supportingStopsCount,
          })
    if (!viabilitySatisfied || !isValidArcCombination(stops, intent, crewPolicy, lens)) {
      return
    }
    const tieKey = buildFallbackArcTieKey(stops)
    if (seen.has(tieKey)) {
      return
    }
    seen.add(tieKey)
    const score = scoreArcAssembly(stops, intent, crewPolicy, lens)
    const supportReadability =
      fallbackType === 'single'
        ? 0
        : stops.reduce((acc, stop) => {
            if (stop.role === 'warmup' || stop.role === 'cooldown') {
              return (
                acc +
                scoreFallbackSupportReadability(
                  stop.scoredVenue,
                  highlight.scoredVenue,
                  stop.role,
                )
              )
            }
            return acc
          }, 0)
    options.push({
      stops,
      score,
      supportReadability,
      fallbackType,
      partialReason,
      tieKey,
    })
  }

  for (const peak of peaks) {
    const warmups = chooseFallbackSupports(scoredVenues, peak, 'warmup')
    const cooldowns = chooseFallbackSupports(scoredVenues, peak, 'cooldown')
    supportCandidateCount += warmups.length + cooldowns.length

    for (const warmup of warmups) {
      partialAttemptCount += 1
      addOption(
        [
          { role: 'warmup', scoredVenue: warmup },
          { role: 'peak', scoredVenue: peak },
        ],
        'partial',
        'start_plus_highlight',
      )
      for (const cooldown of cooldowns) {
        if (cooldown.venue.id === warmup.venue.id) {
          continue
        }
        addOption(
          [
            { role: 'warmup', scoredVenue: warmup },
            { role: 'peak', scoredVenue: peak },
            { role: 'cooldown', scoredVenue: cooldown },
          ],
          'full',
        )
      }
    }

    for (const cooldown of cooldowns) {
      partialAttemptCount += 1
      addOption(
        [
          { role: 'peak', scoredVenue: peak },
          { role: 'cooldown', scoredVenue: cooldown },
        ],
        'partial',
        'highlight_plus_wind_down',
      )
    }

    if (peak.taste.signals.momentIntensity.score >= 0.8) {
      highlightOnlyAttemptCount += 1
      addOption([{ role: 'peak', scoredVenue: peak }], 'single')
    }
  }

  const fullCandidates = options
    .filter((candidate) => candidate.fallbackType === 'full')
    .sort(compareFallbackArcOptions)
  const partialCandidates = options
    .filter((candidate) => candidate.fallbackType === 'partial')
    .sort(compareFallbackArcOptions)
  const singleCandidates = options
    .filter((candidate) => candidate.fallbackType === 'single')
    .sort(compareFallbackArcOptions)

  const bestFull = fullCandidates[0]
  const bestPartial = partialCandidates[0]
  const bestSingle = singleCandidates[0]
  const fallbackTrace: BuildFallbackTraceDiagnostics = {
    fullArcCandidatesCount: fullCandidates.length,
    partialArcCandidatesCount: partialCandidates.length,
    highlightOnlyCandidatesCount: singleCandidates.length,
    bestFullArcFound: Boolean(bestFull),
    bestPartialArcFound: Boolean(bestPartial),
    bestHighlightOnlyFound: Boolean(bestSingle),
    usedRecoveredCentralMomentHighlight:
      poolUsedRecovery || peaks.some((candidate) => Boolean(candidate.recoveredCentralMomentHighlight)),
    recoveredHighlightCandidatesCount:
      poolRecoveryCount > 0
        ? poolRecoveryCount
        : peaks.filter((candidate) => Boolean(candidate.recoveredCentralMomentHighlight)).length,
    centralMomentRecoveryReason:
      poolRecoveryReason ??
      peaks.find((candidate) => candidate.centralMomentRecoveryReason)?.centralMomentRecoveryReason,
  }

  if (!bestFull && !bestPartial && !bestSingle) {
    const fallbackFailureReason: FallbackFailureReason =
      fallbackTrace.usedRecoveredCentralMomentHighlight &&
      (fallbackTrace.recoveredHighlightCandidatesCount ?? 0) > 0
        ? 'recovered_highlight_candidates_invalid'
        : supportCandidateCount === 0
        ? 'no_valid_support_candidates'
        : partialAttemptCount > 0 || highlightOnlyAttemptCount > 0
          ? 'partial_arcs_built_but_invalid'
          : 'no_honest_route_available'
    return {
      trace: {
        ...fallbackTrace,
        fallbackFailureReason,
      },
    }
  }

  const fullArcUnavailable = !bestFull
  const fullArcIsLikelyPadded =
    (bestFull?.score.scoreBreakdown.fakeCompletenessPenalty ?? 0) > 0 &&
    Boolean(bestPartial) &&
    (bestPartial?.score.totalScore ?? 0) >=
      (bestFull?.score.totalScore ?? 0) - PARTIAL_ARC_SELECTION_DELTA

  const selected =
    !bestFull ? bestPartial ?? bestSingle ?? options.sort(compareFallbackArcOptions)[0] :
    fullArcIsLikelyPadded ? bestPartial ?? bestFull :
    bestFull
  const selectedHighlight = selected.stops.find((stop) => stop.role === 'peak')?.scoredVenue

  return {
    candidate: {
      id: createId('arc_fallback'),
      stops: selected.stops,
      totalScore: selected.score.totalScore,
      scoreBreakdown: {
        ...selected.score.scoreBreakdown,
        usedPartialArc: selected.stops.length < 3,
        droppedWeakSupport: selected.stops.length === 2,
        fakeCompletenessAvoided:
          selected.stops.length === 2 &&
          (bestFull?.score.scoreBreakdown.fakeCompletenessPenalty ?? 0) > 0,
        returnedPartialArc: selected.fallbackType === 'partial',
        returnedHighlightOnlyArc: selected.fallbackType === 'single',
        fullArcUnavailable,
        recoveredCentralMomentHighlight: Boolean(
          selectedHighlight?.recoveredCentralMomentHighlight,
        ),
        usedRecoveredCentralMomentHighlight: Boolean(
          fallbackTrace.usedRecoveredCentralMomentHighlight ||
            selectedHighlight?.recoveredCentralMomentHighlight,
        ),
        recoveredHighlightCandidatesCount:
          fallbackTrace.recoveredHighlightCandidatesCount,
        centralMomentRecoveryReason:
          selectedHighlight?.centralMomentRecoveryReason ??
          fallbackTrace.centralMomentRecoveryReason,
        partialArcChosenReason:
          selected.fallbackType === 'partial'
            ? fullArcUnavailable
              ? selected.partialReason === 'start_plus_highlight'
                ? 'full_unavailable_selected_start_plus_highlight'
                : 'full_unavailable_selected_highlight_plus_wind_down'
              : fullArcIsLikelyPadded
                ? 'fake_completeness_avoided'
                : 'partial_selected_by_score'
            : undefined,
      },
      pacing: selected.score.pacing,
      spatial: selected.score.spatial,
      hasWildcard: selected.stops.some((stop) => stop.role === 'wildcard'),
    },
    trace: {
      ...fallbackTrace,
      selectedFallbackType: selected.fallbackType,
      selectedFallbackScore: roundToHundredths(selected.score.totalScore),
      selectedFallbackStopCount: selected.stops.length,
    },
  }
}

function toInternalRole(role: 'start' | 'highlight' | 'windDown'): ArcStop['role'] {
  if (role === 'start') {
    return 'warmup'
  }
  if (role === 'highlight') {
    return 'peak'
  }
  return 'cooldown'
}

function normalizeVenueIdentity(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function resolveAnchorVenueIdFromRetrieval(
  intent: IntentProfile,
  retrieval: RetrieveVenuesResult,
  seedVenues?: Venue[],
): string | undefined {
  if (intent.planningMode !== 'user-led' || !intent.anchor?.venueId) {
    return undefined
  }

  const anchorVenueId = intent.anchor.venueId
  if (retrieval.venues.some((venue) => venue.id === anchorVenueId)) {
    return anchorVenueId
  }

  const dedupeResolvedVenueId = retrieval.sourceMode.dedupeLosses.find(
    (loss) => loss.removedVenueId === anchorVenueId,
  )?.keptVenueId
  if (
    dedupeResolvedVenueId &&
    retrieval.venues.some((venue) => venue.id === dedupeResolvedVenueId)
  ) {
    return dedupeResolvedVenueId
  }

  const selectedAnchorVenue = seedVenues?.find((venue) => venue.id === anchorVenueId)
  if (!selectedAnchorVenue) {
    return undefined
  }

  return retrieval.venues.find((venue) => {
    if (
      selectedAnchorVenue.source.providerRecordId &&
      venue.source.providerRecordId === selectedAnchorVenue.source.providerRecordId
    ) {
      return true
    }

    return (
      venue.category === selectedAnchorVenue.category &&
      normalizeVenueIdentity(venue.name) === normalizeVenueIdentity(selectedAnchorVenue.name) &&
      normalizeVenueIdentity(venue.city) === normalizeVenueIdentity(selectedAnchorVenue.city) &&
      normalizeVenueIdentity(venue.neighborhood) ===
        normalizeVenueIdentity(selectedAnchorVenue.neighborhood)
    )
  })?.id
}

interface AnchorCanonicalizationResult {
  intent: IntentProfile
  rawAnchorVenueId?: string
  canonicalAnchorVenueId?: string
  anchorCanonicalized: boolean
  anchorCanonicalizationFailureReason?: string
}

function resolvePlanningIntent(
  intent: IntentProfile,
  retrieval: RetrieveVenuesResult,
  seedVenues?: Venue[],
): AnchorCanonicalizationResult {
  const rawAnchorVenueId =
    intent.planningMode === 'user-led' ? intent.anchor?.venueId : undefined
  const resolvedAnchorVenueId = resolveAnchorVenueIdFromRetrieval(
    intent,
    retrieval,
    seedVenues,
  )
  if (!rawAnchorVenueId) {
    return {
      intent,
      rawAnchorVenueId,
      canonicalAnchorVenueId: undefined,
      anchorCanonicalized: false,
    }
  }

  if (!resolvedAnchorVenueId) {
    return {
      intent,
      rawAnchorVenueId,
      canonicalAnchorVenueId: undefined,
      anchorCanonicalized: false,
      anchorCanonicalizationFailureReason: 'anchor_not_found_in_retrieved_inventory',
    }
  }

  if (resolvedAnchorVenueId === rawAnchorVenueId) {
    return {
      intent,
      rawAnchorVenueId,
      canonicalAnchorVenueId: resolvedAnchorVenueId,
      anchorCanonicalized: false,
    }
  }

  return {
    intent: {
      ...intent,
      anchor: {
        ...intent.anchor!,
        venueId: resolvedAnchorVenueId,
      },
      discoveryPreferences: intent.discoveryPreferences?.map((preference) =>
        preference.venueId === rawAnchorVenueId
          ? { ...preference, venueId: resolvedAnchorVenueId }
          : preference,
      ),
    },
    rawAnchorVenueId,
    canonicalAnchorVenueId: resolvedAnchorVenueId,
    anchorCanonicalized: true,
  }
}

function countChangedStops(nextArc: ArcCandidate, baselineArc: ArcCandidate): number {
  const nextIds = nextArc.stops.map((stop) => stop.scoredVenue.venue.id)
  const baseIds = baselineArc.stops.map((stop) => stop.scoredVenue.venue.id)
  return nextIds.filter((id, index) => id !== baseIds[index]).length
}

function rehydrateBaselineArc(
  baselineArc: ArcCandidate,
  scoredVenues: ScoredVenue[],
  intent: IntentProfile,
  crewPolicy: ReturnType<typeof getCrewPolicy>,
  lens: ExperienceLens,
): ArcCandidate | undefined {
  const venueById = new Map(scoredVenues.map((item) => [item.venue.id, item] as const))
  const nextStops: ArcStop[] = []
  for (const stop of baselineArc.stops) {
    const scoredVenue = venueById.get(stop.scoredVenue.venue.id)
    if (!scoredVenue) {
      return undefined
    }
    nextStops.push({
      role: stop.role,
      scoredVenue,
    })
  }
  if (!isValidArcCombination(nextStops, intent, crewPolicy, lens)) {
    return undefined
  }
  const score = scoreArcAssembly(nextStops, intent, crewPolicy, lens)
  return {
    id: baselineArc.id,
    stops: nextStops,
    totalScore: score.totalScore,
    scoreBreakdown: score.scoreBreakdown,
    pacing: score.pacing,
    spatial: score.spatial,
    hasWildcard: nextStops.some((stop) => stop.role === 'wildcard'),
  }
}

function countStarterPackMatches(scoredVenues: ScoredVenue[], starterPack?: StarterPack): number {
  if (!starterPack?.lensPreset) {
    return 0
  }
  const preferredCategories = starterPack.lensPreset.preferredCategories ?? []
  const preferredTags = (starterPack.lensPreset.preferredTags ?? []).map((tag) => tag.toLowerCase())
  return scoredVenues.filter((item) => {
    const categoryMatch = preferredCategories.length > 0 && preferredCategories.includes(item.venue.category)
    const tagMatch =
      preferredTags.length > 0 &&
      item.venue.tags.some((tag) => preferredTags.includes(tag.toLowerCase()))
    return categoryMatch || tagMatch
  }).length
}

function countRefinementMatches(scoredVenues: ScoredVenue[], mode?: string): number {
  if (!mode) {
    return 0
  }
  if (mode === 'more-unique') {
    return scoredVenues.filter(
      (item) => item.hiddenGemScore >= 0.64 || item.venue.distinctivenessScore >= 0.62,
    ).length
  }
  if (mode === 'closer-by') {
    return scoredVenues.filter((item) => item.venue.driveMinutes <= 12).length
  }
  if (mode === 'more-relaxed') {
    return scoredVenues.filter((item) => item.venue.energyLevel <= 2).length
  }
  if (mode === 'more-exciting') {
    return scoredVenues.filter((item) => item.venue.energyLevel >= 4).length
  }
  return scoredVenues.filter((item) => item.venue.priceTier === '$$$' || item.venue.priceTier === '$$$$').length
}

function countRoleShapeEligible(scoredVenues: ScoredVenue[]): number {
  return scoredVenues.filter(
    (item) =>
      item.stopShapeFit.start >= 0.4 ||
      item.stopShapeFit.highlight >= 0.4 ||
      item.stopShapeFit.surprise >= 0.4 ||
      item.stopShapeFit.windDown >= 0.4,
  ).length
}

function roundToTenths(value: number): number {
  return Number(value.toFixed(1))
}

function roundToHundredths(value: number): number {
  return Number(value.toFixed(2))
}

function buildConstraintTrace(params: {
  anchorApplied: boolean
  anchorAdmissionFailureReason?: string
  anchorDroppedReason?: string
  anchorGeographyRelaxed: boolean
  anchorHoursRelaxed: boolean
  anchorHoursRelaxationReason?: string
  anchorRole?: UserStopRole
  anchorSurvivedToArc?: boolean
  finalAnchorArcLossReason?: string
  geographyViolationCount: number
  temporalMode: 'explicit' | 'unspecified'
}): ConstraintTraceEntry[] {
  const trace: ConstraintTraceEntry[] = []

  trace.push({
    type: 'hours',
    priority: params.temporalMode === 'explicit' ? 'hard' : 'soft',
    decision: params.anchorHoursRelaxed
      ? 'softened'
      : params.anchorAdmissionFailureReason === 'rejected_hours' &&
          params.temporalMode === 'explicit'
        ? 'conflict'
        : 'enforced',
    reason: params.anchorHoursRelaxed
      ? params.anchorHoursRelaxationReason
      : params.anchorAdmissionFailureReason === 'rejected_hours'
        ? 'anchor_hours_gate'
        : params.temporalMode === 'explicit'
          ? 'explicit_time_window'
          : 'unspecified_time_window',
    overriddenBy: params.anchorHoursRelaxed ? 'user' : undefined,
    details:
      params.anchorAdmissionFailureReason === 'rejected_hours'
        ? ['Anchor hit the existing hours gate during preferred-role admission.']
        : params.temporalMode === 'explicit'
          ? ['Explicit user time keeps current hours signals hard.']
          : ['No explicit user time keeps current hours signals soft.'],
  })

  trace.push({
    type: 'geography',
    priority: 'soft',
    decision: params.anchorGeographyRelaxed
      ? 'softened'
      : params.geographyViolationCount > 0
        ? 'enforced'
        : 'skipped',
    reason: params.anchorGeographyRelaxed
      ? 'anchor_survived_geography_pressure'
      : params.geographyViolationCount > 0
        ? 'geography_pressure_retained_as_soft_score'
        : 'no_anchor_geography_pressure',
    overriddenBy: params.anchorGeographyRelaxed ? 'user' : undefined,
    details:
      params.geographyViolationCount > 0
        ? [`${params.geographyViolationCount} anchor arc combinations triggered geography pressure.`]
        : ['No anchor arc combinations triggered geography pressure.'],
  })

  if (params.anchorApplied) {
    const anchorConflict =
      params.temporalMode === 'explicit' &&
      params.anchorAdmissionFailureReason === 'rejected_hours'
    trace.push({
      type: 'anchor',
      priority: 'user',
      decision: anchorConflict
        ? 'conflict'
        : params.anchorSurvivedToArc === true
          ? 'enforced'
          : params.anchorAdmissionFailureReason || params.anchorDroppedReason || params.finalAnchorArcLossReason
            ? 'failed'
            : 'skipped',
      reason:
        params.finalAnchorArcLossReason ??
        params.anchorDroppedReason ??
        params.anchorAdmissionFailureReason ??
        (params.anchorSurvivedToArc === true
          ? `anchor_${params.anchorRole ?? 'highlight'}_preserved`
          : 'anchor_not_evaluated'),
      overriddenBy: anchorConflict ? 'hard' : undefined,
      details: [
        `Anchor role: ${params.anchorRole ?? 'highlight'}.`,
        params.anchorSurvivedToArc === true
          ? 'Anchor reached arc assembly.'
          : 'Anchor did not reach the surviving arc set.',
      ],
    })
  }

  return trace
}

const TASTE_DIAGNOSTIC_SAMPLE_SIZE = 4

function formatRoleLabel(role: UserStopRole): string {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Wind Down'
}

function arcSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.venue.id}`)
    .join('|')
}

function categoryComposition(candidate: ArcCandidate): string[] {
  return [...new Set(candidate.stops.map((stop) => stop.scoredVenue.venue.category))]
}

function buildArcSnapshot(candidate: ArcCandidate): ArcCandidateSnapshot {
  const stopIdsByRole: Partial<Record<UserStopRole, string>> = {}
  const stopCategoriesByRole: Partial<Record<UserStopRole, string>> = {}
  for (const stop of candidate.stops) {
    const role = roleProjection[stop.role]
    stopIdsByRole[role] = stop.scoredVenue.venue.id
    stopCategoriesByRole[role] = stop.scoredVenue.venue.category
  }
  const composition = categoryComposition(candidate)
  return {
    candidateId: candidate.id,
    stopIdsByRole,
    stopCategoriesByRole,
    preBoundaryScore: roundToTenths(candidate.totalScore * 100),
    categoryComposition: composition,
    diversitySummary: `${composition.length} categories across ${candidate.stops.length} stops`,
  }
}

function computeTopCandidateOverlapPct(candidates: ArcCandidate[], limit = 8): number {
  const signatures = candidates.slice(0, limit).map((candidate) => arcSignature(candidate))
  if (signatures.length <= 1) {
    return 0
  }
  const uniqueSignatures = new Set(signatures)
  return roundToTenths(((signatures.length - uniqueSignatures.size) / signatures.length) * 100)
}

function computeRoleWinnerFrequency(
  rankedCandidates: ArcCandidate[],
  sampleSize = 20,
): GenerationDiagnostics['roleWinnerFrequency'] {
  const sample = rankedCandidates.slice(0, sampleSize)
  const counts: Partial<Record<UserStopRole, Map<string, { wins: number; flaggedUniversal: boolean }>>> = {}
  for (const candidate of sample) {
    for (const stop of candidate.stops) {
      const role = roleProjection[stop.role]
      const roleMap = counts[role] ?? new Map<string, { wins: number; flaggedUniversal: boolean }>()
      const current = roleMap.get(stop.scoredVenue.venue.id) ?? {
        wins: 0,
        flaggedUniversal: false,
      }
      current.wins += 1
      current.flaggedUniversal =
        current.flaggedUniversal || stop.scoredVenue.dominanceControl.flaggedUniversal
      roleMap.set(stop.scoredVenue.venue.id, current)
      counts[role] = roleMap
    }
  }

  const toEntries = (
    value: Map<string, { wins: number; flaggedUniversal: boolean }> | undefined,
  ): RoleWinnerFrequencyEntry[] => {
    if (!value || sample.length === 0) {
      return []
    }
    return [...value.entries()]
      .map(([venueId, stats]) => ({
        venueId,
        wins: stats.wins,
        winShare: roundToTenths((stats.wins / sample.length) * 100),
        flaggedUniversal: stats.flaggedUniversal,
      }))
      .sort((left, right) => right.wins - left.wins)
      .slice(0, 4)
  }

  return {
    start: toEntries(counts.start),
    highlight: toEntries(counts.highlight),
    surprise: toEntries(counts.surprise),
    windDown: toEntries(counts.windDown),
  }
}

function compareTasteDiagnostics(
  left: GenerationDiagnostics['retrievalDiagnostics']['tasteInterpretation']['seedExamples'][number],
  right: GenerationDiagnostics['retrievalDiagnostics']['tasteInterpretation']['seedExamples'][number],
): number {
  return (
    left.highlightTier - right.highlightTier ||
    right.roleSuitability.highlight - left.roleSuitability.highlight ||
    right.debug.confidence - left.debug.confidence ||
    right.noveltyWeight - left.noveltyWeight
  )
}

function buildTasteDiagnostics(
  scoredVenues: ScoredVenue[],
): GenerationDiagnostics['retrievalDiagnostics']['tasteInterpretation'] {
  const interpreted = scoredVenues.map((item) => {
    const sourceType: 'seed' | 'live' =
      item.venue.source.normalizedFromRawType === 'seed' ||
      item.venue.source.sourceOrigin !== 'live'
        ? 'seed'
        : 'live'
    const taste = item.taste.signals

    return {
      venueId: item.venue.id,
      venueName: item.venue.name,
      sourceType,
      energy: roundToHundredths(taste.energy),
      socialDensity: roundToHundredths(taste.socialDensity),
      intimacy: roundToHundredths(taste.intimacy),
      lingerFactor: roundToHundredths(taste.lingerFactor),
      destinationFactor: roundToHundredths(taste.destinationFactor),
      experientialFactor: roundToHundredths(taste.experientialFactor),
      conversationFriendliness: roundToHundredths(
        taste.conversationFriendliness,
      ),
      roleSuitability: {
        start: roundToHundredths(taste.roleSuitability.start),
        highlight: roundToHundredths(taste.roleSuitability.highlight),
        surprise: roundToHundredths(taste.roleSuitability.surprise),
        windDown: roundToHundredths(taste.roleSuitability.windDown),
      },
      highlightTier: taste.highlightTier,
      durationEstimate: taste.durationEstimate,
      noveltyWeight: roundToHundredths(taste.noveltyWeight),
      debug: {
        sourceMode: taste.debug.sourceMode,
        confidence: roundToHundredths(taste.debug.confidence),
        supportingSignals: taste.debug.supportingSignals,
      },
    }
  })

  return {
    seedExamples: interpreted
      .filter((item) => item.sourceType === 'seed')
      .sort(compareTasteDiagnostics)
      .slice(0, TASTE_DIAGNOSTIC_SAMPLE_SIZE),
    liveExamples: interpreted
      .filter((item) => item.sourceType === 'live')
      .sort(compareTasteDiagnostics)
      .slice(0, TASTE_DIAGNOSTIC_SAMPLE_SIZE),
  }
}

function buildSurpriseSelectionReason(
  selectedArc: ArcCandidate,
  surpriseDiagnostics: ArcAssemblySurpriseDiagnostics,
): string {
  if (selectedArc.hasWildcard) {
    return (
      selectedArc.surpriseInjection?.selectionReason ??
      'Selected route kept a surprise stop because it stayed spatially coherent and materially interesting.'
    )
  }

  if (surpriseDiagnostics.surpriseCandidateCount === 0) {
    return 'No surprise candidates cleared the surprise role pool.'
  }

  if (surpriseDiagnostics.generatedSurpriseArcCount > 0) {
    return '4-stop surprise routes were generated, but a 3-stop arc still won overall.'
  }

  if (
    surpriseDiagnostics.rejectedBySpatialCount === 0 &&
    surpriseDiagnostics.rejectedByProbabilityCount === 0 &&
    surpriseDiagnostics.rejectedByScoreCount === 0
  ) {
    return 'Strong surprise candidates existed, but none cleared full arc assembly validation.'
  }

  if (
    surpriseDiagnostics.rejectedBySpatialCount >=
      surpriseDiagnostics.rejectedByProbabilityCount &&
    surpriseDiagnostics.rejectedBySpatialCount >=
      surpriseDiagnostics.rejectedByScoreCount
  ) {
    return 'Strong surprise candidates existed, but they broke spatial coherence for this outing.'
  }

  if (
    surpriseDiagnostics.rejectedByProbabilityCount >=
    surpriseDiagnostics.rejectedByScoreCount
  ) {
    return `Strong surprise candidates existed, but the deterministic ${Math.round(
      surpriseDiagnostics.gateProbability * 100,
    )}% injection gate held the plan at 3 stops.`
  }

  if (
    typeof surpriseDiagnostics.bestRejectedScoreDelta === 'number' &&
    typeof surpriseDiagnostics.bestRejectedAllowedTradeoff === 'number'
  ) {
    return `Strong surprise candidates existed, but the best 4-stop arc landed at ${surpriseDiagnostics.bestRejectedScoreDelta} vs an allowed tradeoff of -${surpriseDiagnostics.bestRejectedAllowedTradeoff}.`
  }

  return 'Strong surprise candidates existed, but none justified the extra stop over the cleaner 3-stop route.'
}

function getBoundaryContributionLevel(
  changedWinner: boolean,
  changedOrderCount: number,
  averageRankDelta: number,
  candidateArcCount: number,
): BoundaryDiagnostics['boundaryContributionLevel'] {
  if (candidateArcCount <= 1 || (changedOrderCount === 0 && !changedWinner)) {
    return 'none'
  }
  if (
    changedWinner ||
    averageRankDelta >= 2 ||
    changedOrderCount >= Math.max(3, Math.floor(candidateArcCount * 0.35))
  ) {
    return 'meaningful'
  }
  return 'minor'
}

interface OverlapScenarioConfig {
  scenarioId: string
  label: string
  mode: ExperienceMode
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  starterPackId?: string
}

interface OverlapScenarioContext {
  city: string
  neighborhood?: string
  distanceMode: IntentInput['distanceMode']
  budget?: IntentInput['budget']
  timeWindow?: string
  strictShapeEnabled: boolean
}

async function simulateOverlapScenario(
  config: OverlapScenarioConfig,
  context: OverlapScenarioContext,
): Promise<OverlapScenarioDiagnostics> {
  const starterPack = config.starterPackId
    ? starterPacks.find((item) => item.id === config.starterPackId)
    : undefined
  const input: IntentInput = {
    mode: config.mode,
    persona: config.persona,
    primaryVibe: config.primaryVibe,
    secondaryVibe: config.secondaryVibe,
    city: context.city,
    neighborhood: context.neighborhood,
    distanceMode: starterPack?.distanceMode ?? context.distanceMode,
    budget: context.budget,
    timeWindow: context.timeWindow,
    prefersHiddenGems: starterPack?.lensPreset?.discoveryBias === 'high',
  }
  const scenarioIntent = normalizeIntent(input)
  const scenarioLens = buildExperienceLens({
    intent: scenarioIntent,
    starterPack,
    strictShape: context.strictShapeEnabled,
  })
  const scenarioCrewPolicy = getCrewPolicy(scenarioIntent.crew)
  const scenarioRoleContracts = getRoleContract({
    intent: scenarioIntent,
    starterPack,
    strictShapeEnabled: context.strictShapeEnabled,
  })
  const scenarioRetrieval = await retrieveVenues(scenarioIntent, scenarioLens, {
    requestedSourceMode: 'curated',
    starterPack,
  })
  const scenarioScored = scoreVenueCollection(
    scenarioRetrieval.venues,
    scenarioIntent,
    scenarioCrewPolicy,
    scenarioLens,
    scenarioRoleContracts,
    starterPack,
  )
  const scenarioPools = buildRolePools(
    scenarioScored,
    scenarioCrewPolicy,
    scenarioLens,
    scenarioIntent,
    scenarioRoleContracts,
    context.strictShapeEnabled,
  )
  const scenarioArcAssembly = assembleArcCandidates(
    scenarioScored,
    scenarioIntent,
    scenarioCrewPolicy,
    scenarioLens,
    scenarioPools,
  )
  const scenarioRanking = rankWithWaypointBoundary({
    candidates: scenarioArcAssembly.candidates,
    intent: scenarioIntent,
  })
  const rankedCandidates = scenarioRanking.ranked.map((entry) => entry.candidate)
  const winner = rankedCandidates[0]
  const rolePoolVenueIds = new Set<string>()
  for (const venue of scenarioPools.warmup) {
    rolePoolVenueIds.add(venue.venue.id)
  }
  for (const venue of scenarioPools.peak) {
    rolePoolVenueIds.add(venue.venue.id)
  }
  for (const venue of scenarioPools.wildcard) {
    rolePoolVenueIds.add(venue.venue.id)
  }
  for (const venue of scenarioPools.cooldown) {
    rolePoolVenueIds.add(venue.venue.id)
  }

  return {
    scenarioId: config.scenarioId,
    label: config.label,
    mode: config.mode,
    persona: config.persona,
    primaryVibe: config.primaryVibe,
    secondaryVibe: config.secondaryVibe,
    starterPackId: config.starterPackId,
    strictShapeEnabled: context.strictShapeEnabled,
    retrievedVenueIds: scenarioRetrieval.venues.map((venue) => venue.id),
    rolePoolVenueIds: [...rolePoolVenueIds],
    topCandidateSignatures: rankedCandidates.slice(0, 5).map((candidate) => arcSignature(candidate)),
    winnerSignature: winner ? arcSignature(winner) : 'none',
  }
}

export async function runGeneratePlan(
  input: IntentInput,
  options: GeneratePlanOptions = {},
): Promise<GeneratePlanResult> {
  // Boundary guardrail: interpretation and bearings artifacts should be passed as a canonical pair.
  console.assert(
    (Boolean(options.experienceContract) && Boolean(options.contractConstraints)) ||
      (!options.experienceContract && !options.contractConstraints),
    '[ARC-BOUNDARY] runGeneratePlan expects experienceContract + contractConstraints together.',
  )
  const intent = normalizeIntent(input)
  console.assert(
    !intent.selectedDirectionContext || Boolean(intent.selectedDirectionContext.directionId),
    '[ARC-BOUNDARY] selectedDirectionContext should carry a canonical directionId when present.',
  )
  const strictShapeEnabled = Boolean(options.debugMode && options.strictShape)
  const lens = buildExperienceLens({
    intent,
    starterPack: options.starterPack,
    strictShape: strictShapeEnabled,
  })
  const crewPolicy = getCrewPolicy(intent.crew)
  const roleContracts = getRoleContract({
    intent,
    starterPack: options.starterPack,
    strictShapeEnabled,
  })

  const retrieval = await retrieveVenues(intent, lens, {
    seedVenues: options.seedVenues,
    requestedSourceMode: options.sourceMode,
    sourceModeOverrideApplied: options.sourceModeOverrideApplied,
    starterPack: options.starterPack,
  })
  const anchorCanonicalization = resolvePlanningIntent(
    intent,
    retrieval,
    options.seedVenues,
  )
  const planningIntent = anchorCanonicalization.intent
  const anchorInjectionSource =
    anchorCanonicalization.rawAnchorVenueId
      ? options.seedVenues?.some(
          (venue) => venue.id === anchorCanonicalization.rawAnchorVenueId,
        )
        ? 'search'
        : options.seedVenues && options.seedVenues.length > 0
          ? 'session'
          : 'unknown'
      : undefined
  const anchorInjectedToInventory = Boolean(
    anchorCanonicalization.rawAnchorVenueId &&
      anchorCanonicalization.canonicalAnchorVenueId,
  )
  const anchorInjectionFailureReason =
    anchorCanonicalization.rawAnchorVenueId && !anchorInjectedToInventory
      ? 'anchor_not_present_after_inventory_assembly'
      : undefined
  const rawScoredVenues = scoreVenueCollection(
    retrieval.venues,
    planningIntent,
    crewPolicy,
    lens,
    roleContracts,
    options.starterPack,
  )
  const retrievalPressure = applyContractRetrievalPressure({
    scoredVenues: rawScoredVenues,
    experienceContract: options.experienceContract,
    contractConstraints: options.contractConstraints,
  })
  const scoredVenues = retrievalPressure.scoredVenues
  const rolePools = buildRolePools(
    scoredVenues,
    crewPolicy,
    lens,
    planningIntent,
    roleContracts,
    strictShapeEnabled,
    options.contractConstraints,
    options.experienceContract,
  )
  const recommendedDistricts = recommendDistricts({
    scoredVenues,
    rolePools,
    intent: planningIntent,
  })
  const arcAssembly = assembleArcCandidates(scoredVenues, planningIntent, crewPolicy, lens, rolePools)
  const arcCandidates = arcAssembly.candidates
  const anchorApplied =
    planningIntent.planningMode === 'user-led' && Boolean(planningIntent.anchor?.venueId)
  const temporalMode = detectTemporalMode(planningIntent)
  const temporalTrace = buildTemporalTrace(planningIntent)
  const anchorRole = anchorApplied ? planningIntent.anchor?.role ?? 'highlight' : undefined
  const anchorInternalRole =
    anchorRole === 'start' || anchorRole === 'highlight' || anchorRole === 'windDown'
      ? toInternalRole(anchorRole)
      : undefined
  const anchorSurvivedToArc =
    anchorApplied && planningIntent.anchor?.venueId && anchorInternalRole
      ? arcCandidates.some((candidate) =>
          candidate.stops.some(
            (stop) =>
              stop.role === anchorInternalRole &&
              stop.scoredVenue.venue.id === planningIntent.anchor!.venueId,
          ),
        )
      : undefined
  const anchorRolePool =
    anchorInternalRole === 'warmup'
      ? rolePools.warmup
      : anchorInternalRole === 'peak'
        ? rolePools.peak
        : anchorInternalRole === 'cooldown'
          ? rolePools.cooldown
          : undefined
  const anchorRolePoolVenueIds = anchorRolePool?.map((candidate) => candidate.venue.id)
  const anchorRolePoolIndex =
    anchorApplied && planningIntent.anchor?.venueId && anchorRolePoolVenueIds
      ? anchorRolePoolVenueIds.indexOf(planningIntent.anchor.venueId)
      : undefined
  const anchorRolePoolStatus =
    anchorApplied && anchorInternalRole
      ? rolePools.contractPoolStatus[anchorInternalRole]
      : undefined
  const anchorGeographyRelaxed = arcAssembly.anchorTrace?.anchorGeographyRelaxed ?? false
  const geographyViolationCount = arcAssembly.anchorTrace?.geographyViolationCount ?? 0
  const anchorHoursRelaxed = anchorRolePoolStatus?.preferredDiscoveryVenueHoursRelaxed ?? false
  const anchorHoursRelaxationReason =
    anchorRolePoolStatus?.preferredDiscoveryVenueHoursRelaxationReason
  const anchorAdmittedToRolePool =
    anchorRolePoolStatus?.preferredDiscoveryVenueAdmitted
  const anchorAdmissionFailureReason =
    anchorRolePoolStatus?.preferredDiscoveryVenueRejectedReason ??
    (anchorRolePoolStatus?.preferredDiscoveryVenueAdmitted === false
      ? 'anchor_not_scored'
      : undefined)
  const anchorDroppedReason =
    anchorApplied &&
    planningIntent.anchor?.venueId &&
    anchorInternalRole &&
    anchorSurvivedToArc === false
      ? anchorRolePoolStatus?.preferredDiscoveryVenueRejectedReason ??
        (!(
          anchorInternalRole === 'warmup'
            ? rolePools.warmup
            : anchorInternalRole === 'peak'
            ? rolePools.peak
            : rolePools.cooldown
        ).some((candidate) => candidate.venue.id === planningIntent.anchor!.venueId)
          ? 'anchor_missing_from_role_pool'
          : 'anchor_trimmed_before_arc_assembly')
      : undefined
  const survivingAnchorArcCount =
    anchorApplied && planningIntent.anchor?.venueId && anchorInternalRole
      ? arcCandidates.filter((candidate) =>
          candidate.stops.some(
            (stop) =>
              stop.role === anchorInternalRole &&
              stop.scoredVenue.venue.id === planningIntent.anchor!.venueId,
          ),
        ).length
      : 0
  const shouldApplyUserLedFinalRoleLock =
    planningIntent.planningMode === 'user-led' &&
    anchorRole === 'highlight' &&
    anchorInternalRole === 'peak' &&
    anchorSurvivedToArc === true
  const anchorLockedArcCandidates =
    shouldApplyUserLedFinalRoleLock && planningIntent.anchor?.venueId
      ? arcCandidates.filter((candidate) =>
          candidate.stops.some(
            (stop) =>
              stop.role === 'peak' &&
              stop.scoredVenue.venue.id === planningIntent.anchor!.venueId,
          ),
        )
      : arcCandidates
  const finalArcFilteredToAnchorRole =
    shouldApplyUserLedFinalRoleLock && anchorLockedArcCandidates.length > 0
  const userLedFinalRoleLockApplied = finalArcFilteredToAnchorRole
  const userLedFinalRoleLockFallbackReason =
    shouldApplyUserLedFinalRoleLock && anchorLockedArcCandidates.length === 0
      ? 'anchor_highlight_missing_from_final_winner_set'
      : undefined
  const boundaryCandidates = finalArcFilteredToAnchorRole
    ? anchorLockedArcCandidates
    : arcCandidates
  // Waypoint seam: ranking consumes already-assembled candidate arcs.
  // It must not be used to author interpretation or admissibility truth.
  const ranking = rankWithWaypointBoundary({ candidates: boundaryCandidates, intent: planningIntent })
  const rankedCandidates = ranking.ranked.map((entry) => entry.candidate)
  const finalAnchorCandidates =
    anchorApplied && planningIntent.anchor?.venueId && anchorInternalRole
      ? rankedCandidates.filter((candidate) =>
          candidate.stops.some(
            (stop) =>
              stop.role === anchorInternalRole &&
              stop.scoredVenue.venue.id === planningIntent.anchor!.venueId,
          ),
        )
      : []
  const bestFinalAnchorArc = finalAnchorCandidates[0]
  const bestNonAnchorArc =
    anchorApplied && planningIntent.anchor?.venueId && anchorInternalRole
      ? rankedCandidates.find(
          (candidate) =>
            !candidate.stops.some(
              (stop) =>
                stop.role === anchorInternalRole &&
                stop.scoredVenue.venue.id === planningIntent.anchor!.venueId,
            ),
        )
      : undefined
  const finalAnchorArcLossReason =
    anchorApplied && finalAnchorCandidates.length === 0
      ? (arcAssembly.anchorTrace?.preValidationAnchorArcCount ?? 0) === 0
        ? 'no_anchor_arc_generated'
        : (arcAssembly.anchorTrace?.postValidationAnchorArcCount ?? 0) === 0
          ? 'anchor_arcs_invalidated'
          : (arcAssembly.anchorTrace?.postPruneAnchorArcCount ?? 0) === 0
            ? 'anchor_arcs_pruned'
            : 'anchor_arcs_filtered_before_boundary'
      : undefined
  const preBoundaryOrder = boundaryCandidates.map((candidate) => candidate.id)
  const postBoundaryOrder = rankedCandidates.map((candidate) => candidate.id)
  const preBoundaryIndex = new Map(preBoundaryOrder.map((id, index) => [id, index] as const))
  let changedOrderCount = 0
  let rankDeltaSum = 0
  for (let index = 0; index < postBoundaryOrder.length; index += 1) {
    const candidateId = postBoundaryOrder[index]
    const previousIndex = preBoundaryIndex.get(candidateId) ?? index
    const delta = Math.abs(index - previousIndex)
    rankDeltaSum += delta
    if (delta > 0) {
      changedOrderCount += 1
    }
  }
  const averageRankDelta =
    postBoundaryOrder.length > 0 ? roundToTenths(rankDeltaSum / postBoundaryOrder.length) : 0
  const winnerBeforeBoundary = preBoundaryOrder[0]
  const winnerAfterBoundary = postBoundaryOrder[0]
  const changedWinner = Boolean(
    winnerBeforeBoundary && winnerAfterBoundary && winnerBeforeBoundary !== winnerAfterBoundary,
  )
  const preBoundarySnapshot = boundaryCandidates
    .slice(0, 8)
    .map((candidate) => buildArcSnapshot(candidate))
  const postBoundarySnapshot: RankedArcCandidateSnapshot[] = ranking.ranked
    .slice(0, 8)
    .map((rankedEntry, index) => {
      const snapshot = buildArcSnapshot(rankedEntry.candidate)
      const previousRank = (preBoundaryIndex.get(rankedEntry.candidate.id) ?? index) + 1
      return {
        ...snapshot,
        rank: index + 1,
        boundaryScore: roundToTenths(rankedEntry.rankingScore * 100),
        boundaryBaseScore: roundToTenths(rankedEntry.boundaryBaseScore * 100),
        boundaryRefinementNudge: roundToTenths(rankedEntry.refinementNudge * 100),
        boundaryTiebreaker: roundToTenths(rankedEntry.tiebreaker * 100),
        boundaryRefinementTokens: rankedEntry.refinementTokensApplied,
        boundaryRefinementTokenDeltas: Object.fromEntries(
          Object.entries(rankedEntry.refinementTokenDeltas).map(([token, delta]) => [
            token,
            roundToHundredths(delta),
          ]),
        ),
        previousRank,
        rankChanged: previousRank !== index + 1,
        becameWinner: index === 0 && previousRank !== 1,
      }
    })
  const topCandidateOverlapPct = computeTopCandidateOverlapPct(boundaryCandidates, 8)
  const roleWinnerFrequency = computeRoleWinnerFrequency(rankedCandidates, 20)
  let fallbackTrace: BuildFallbackTraceDiagnostics | undefined
  const buildFallbackFailureError = (
    reason: FallbackFailureReason,
    trace: BuildFallbackTraceDiagnostics,
  ): Error =>
    new Error(
      `Fallback arc recovery failed (${reason}). full=${trace.fullArcCandidatesCount} partial=${trace.partialArcCandidatesCount} highlightOnly=${trace.highlightOnlyCandidatesCount}`,
    )
  const selectFallbackArc = (params: {
    triggerStage: 'initial_selection' | 'refinement'
    primaryPathFailureReason: string
  }): ArcCandidate => {
    const fallback = buildFallbackCandidate(
      scoredVenues,
      rolePools,
      planningIntent,
      crewPolicy,
      lens,
    )
    fallbackTrace = {
      ...fallback.trace,
      triggerStage: params.triggerStage,
      primaryPathFailureReason: params.primaryPathFailureReason,
      boundaryCandidateCountAtTrigger: boundaryCandidates.length,
      rankedCandidateCountAtTrigger: rankedCandidates.length,
      rolePoolCountsAtTrigger: {
        start: rolePools.warmup.length,
        highlight: rolePools.peak.length,
        surprise: rolePools.wildcard.length,
        windDown: rolePools.cooldown.length,
      },
    }
    if (!fallback.candidate) {
      const reason =
        (fallback.trace.fallbackFailureReason as FallbackFailureReason | undefined) ??
        'no_honest_route_available'
      throw buildFallbackFailureError(reason, fallback.trace)
    }
    return fallback.candidate
  }
  let selectedArc =
    rankedCandidates[0] ??
    selectFallbackArc({
      triggerStage: 'initial_selection',
      primaryPathFailureReason: 'no_ranked_candidates_after_boundary',
    })
  let refinementPathContext: RefinementPathContext | undefined

  if (options.baselineArc && (intent.refinementModes?.length ?? 0) > 0) {
    const directive = getRefinementDirective(intent.refinementModes![0]!)
    const baselineRehydrated = rehydrateBaselineArc(
        options.baselineArc,
        scoredVenues,
        planningIntent,
        crewPolicy,
        lens,
      )
    const targetSelection = selectRefinementTargetRoles({
      directive,
      baselineArc: options.baselineArc,
    })
    const targetedRoles = targetSelection.roles

    if (baselineRehydrated) {
      const targeted = applyTargetedRefinement({
        currentArc: baselineRehydrated,
        scoredVenues,
        intent: planningIntent,
        crewPolicy,
        lens,
        directive,
        targetedRoles,
      })
      refinementPathContext = {
        targetedRoles: targeted.targetedRoles,
        primaryTargetRole: targeted.primaryTargetRole ?? targetSelection.primaryTargetRole,
        targetRoleExistedInVisiblePlan: targetSelection.targetRoleExistedInVisiblePlan,
        targetRoleSelectionReason: targetSelection.selectionReason,
        targetedCandidateCount: targeted.targetedCandidateCount,
        targetedChangeSucceeded: targeted.targetedChangeSucceeded,
        fullPlanFallbackUsed: !targeted.targetedChangeSucceeded,
        winnerInertiaDetected: targeted.winnerInertiaDetected,
        winnerInertiaReduced: targeted.winnerInertiaReduced,
        winnerInertiaNotes: targeted.winnerInertiaNotes,
      }
      if (targeted.nextArc) {
        selectedArc = targeted.nextArc
      } else {
        selectedArc =
          rankedCandidates[0] ??
          selectFallbackArc({
            triggerStage: 'refinement',
            primaryPathFailureReason: 'targeted_refinement_did_not_produce_next_arc',
          })
      }
    } else {
      refinementPathContext = {
        targetedRoles,
        primaryTargetRole: targetSelection.primaryTargetRole ?? targetedRoles[0],
        targetRoleExistedInVisiblePlan: targetSelection.targetRoleExistedInVisiblePlan,
        targetRoleSelectionReason: targetSelection.selectionReason,
        targetedCandidateCount: 0,
        targetedChangeSucceeded: false,
        fullPlanFallbackUsed: true,
        winnerInertiaDetected: false,
        winnerInertiaReduced: false,
        winnerInertiaNotes: [
          'Baseline plan could not be fully rehydrated under current refinement retrieval filters.',
        ],
      }
      selectedArc =
        rankedCandidates[0] ??
        selectFallbackArc({
          triggerStage: 'refinement',
          primaryPathFailureReason: 'baseline_arc_could_not_be_rehydrated_for_refinement',
        })
    }
  }
  const stopReasons = buildStopReasons({
    selectedArc,
    arcCandidates,
    scoredVenues,
    rolePools,
    intent: planningIntent,
    lens,
    starterPack: options.starterPack,
    baselineArc: options.baselineArc,
    previousStopExplainability: options.baselineTrace?.stopExplainability,
    refinementPathContext,
  })
  let itinerary: Itinerary
  try {
    itinerary = projectItinerary(
      selectedArc,
      planningIntent,
      lens,
      stopReasons.stopExplainability,
    )
  } catch (error) {
    if (fallbackTrace) {
      fallbackTrace = {
        ...fallbackTrace,
        fallbackFailureReason: 'final_plan_construction_rejected_arc',
      }
      throw buildFallbackFailureError(
        'final_plan_construction_rejected_arc',
        fallbackTrace,
      )
    }
    throw error
  }
  if (fallbackTrace && (fallbackTrace.selectedFallbackType === 'partial' || fallbackTrace.selectedFallbackType === 'single')) {
    const itineraryRoles = new Set(itinerary.stops.map((stop) => stop.role))
    const selectedArcRoles = selectedArc.stops.map((stop) => roleProjection[stop.role])
    const droppedRole = selectedArcRoles.find((role) => !itineraryRoles.has(role))
    if (droppedRole) {
      fallbackTrace = {
        ...fallbackTrace,
        fallbackFailureReason: 'partial_arc_selected_but_dropped_downstream',
      }
      throw buildFallbackFailureError(
        'partial_arc_selected_but_dropped_downstream',
        fallbackTrace,
      )
    }
  }
  const refinementOutcome = stopReasons.refinementOutcome
    ? {
        ...stopReasons.refinementOutcome,
        previousItineraryId: options.baselineItineraryId,
        nextItineraryId: itinerary.id,
      }
    : undefined
  const personaFilteredCount = scoredVenues.filter((item) => item.fitBreakdown.crewFit >= 0.62).length
  const starterPackFilteredCount = countStarterPackMatches(scoredVenues, options.starterPack)
  const refinementFilteredCount = countRefinementMatches(scoredVenues, intent.refinementModes?.[0])
  const geographyFilteredCount = scoredVenues.filter((item) => item.fitBreakdown.proximityFit >= 0.6).length
  const roleShapeEligibleCount = countRoleShapeEligible(scoredVenues)
  const primaryVibeMatchCount = scoredVenues.filter((item) => item.vibeAuthority.primary >= 0.62).length
  const secondaryVibe = intent.secondaryAnchors?.[0]
  const secondaryVibeMatchCount = secondaryVibe
    ? scoredVenues.filter((item) => item.fitBreakdown.anchorFit >= 0.62).length
    : 0
  const rolePoolSizes = [
    rolePools.warmup.length,
    rolePools.peak.length,
    rolePools.wildcard.length,
    rolePools.cooldown.length,
  ]
  const minRolePoolSize = Math.min(...rolePoolSizes)
  const overPruned =
    retrieval.stageCounts.finalRetrieved < 12 ||
    roleShapeEligibleCount < 10 ||
    minRolePoolSize < 3
  const pruneNotes: string[] = []
  if (retrieval.stageCounts.qualitySuppressed > 0) {
    pruneNotes.push(`${retrieval.stageCounts.qualitySuppressed} venues were suppressed by the quality gate.`)
  }
  if (retrieval.stageCounts.lensStrict < 10) {
    pruneNotes.push('Lens strict filter left very few venues before relaxation.')
  }
  if (roleShapeEligibleCount < 10) {
    pruneNotes.push('Role-shape expectations eliminated most candidates.')
  }
  if (minRolePoolSize < 3) {
    pruneNotes.push('At least one role pool is shallow (<3 candidates).')
  }
  const selectedSurpriseStop = selectedArc.stops.find((stop) => stop.role === 'wildcard')
  const surpriseInjection: GenerationDiagnostics['surpriseInjection'] = {
    surpriseInjected: Boolean(selectedSurpriseStop),
    surpriseCandidateCount: arcAssembly.surpriseDiagnostics.surpriseCandidateCount,
    surpriseCandidateTierBreakdown:
      arcAssembly.surpriseDiagnostics.surpriseCandidateTierBreakdown,
    generatedSurpriseArcCount: arcAssembly.surpriseDiagnostics.generatedSurpriseArcCount,
    surpriseComparedTierBreakdown:
      arcAssembly.surpriseDiagnostics.comparedSurpriseArcTierBreakdown,
    surpriseGateProbability: arcAssembly.surpriseDiagnostics.gateProbability,
    surpriseSelectionReason: buildSurpriseSelectionReason(
      selectedArc,
      arcAssembly.surpriseDiagnostics,
    ),
    surpriseRejectedBySpatialCount: arcAssembly.surpriseDiagnostics.rejectedBySpatialCount,
    surpriseRejectedBySpatialTier2Count:
      arcAssembly.surpriseDiagnostics.rejectedBySpatialNearStrongCount,
    scoreDeltaVsBaseArc:
      selectedArc.surpriseInjection?.scoreDeltaFromBase ??
      arcAssembly.surpriseDiagnostics.bestRejectedScoreDelta,
    tradeoffThreshold:
      selectedArc.surpriseInjection?.allowedTradeoff ??
      arcAssembly.surpriseDiagnostics.bestRejectedAllowedTradeoff,
    tradeoffThresholdBlocked:
      !selectedSurpriseStop && arcAssembly.surpriseDiagnostics.rejectedByScoreCount > 0,
    rejectedByScoreCount: arcAssembly.surpriseDiagnostics.rejectedByScoreCount,
    surpriseAcceptanceBonusApplied:
      (selectedArc.surpriseInjection?.acceptanceBonusApplied ??
        ((arcAssembly.surpriseDiagnostics.bestRejectedAcceptanceBonusValue ?? 0) > 0)),
    surpriseAcceptanceBonusValue:
      selectedArc.surpriseInjection?.acceptanceBonusValue ??
      arcAssembly.surpriseDiagnostics.bestRejectedAcceptanceBonusValue ??
      0,
    surpriseTasteSignals: selectedSurpriseStop
      ? {
          venueId: selectedSurpriseStop.scoredVenue.venue.id,
          venueName: selectedSurpriseStop.scoredVenue.venue.name,
          experientialFactor: roundToHundredths(
            selectedSurpriseStop.scoredVenue.taste.signals.experientialFactor,
          ),
          noveltyWeight: roundToHundredths(
            selectedSurpriseStop.scoredVenue.taste.signals.noveltyWeight,
          ),
          roleSuitability: roundToHundredths(
            selectedSurpriseStop.scoredVenue.taste.signals.roleSuitability.surprise,
          ),
          supportingSignals:
            selectedArc.surpriseInjection?.tasteSignals.supportingSignals ??
            selectedSurpriseStop.scoredVenue.taste.signals.debug.supportingSignals.slice(0, 4),
        }
      : undefined,
  }
  const districtAnchor = resolveDistrictAnchor({
    city: planningIntent.city,
    district: planningIntent.district,
    neighborhood: planningIntent.neighborhood,
    spatial: selectedArc.spatial,
  })
  const categoryDiversity: GenerationDiagnostics['categoryDiversity'] = {
    categoryDiversityScore: roundToHundredths(selectedArc.scoreBreakdown.diversityScore),
    repeatedCategoryCount: selectedArc.scoreBreakdown.repeatedCategoryCount ?? 0,
    categoryDiversityPenaltyApplied:
      (selectedArc.scoreBreakdown.categoryDiversityPenalty ?? 0) > 0,
    categoryDiversityPenalty: roundToHundredths(
      selectedArc.scoreBreakdown.categoryDiversityPenalty ?? 0,
    ),
    notes: selectedArc.scoreBreakdown.categoryDiversityNotes ?? [],
  }
  const boundaryDiagnostics: BoundaryDiagnostics = {
    boundaryInvoked: true,
    candidateArcCount: boundaryCandidates.length,
    candidateIdsPassed: preBoundaryOrder,
    preBoundaryOrder,
    postBoundaryOrder,
    winnerBeforeBoundary,
    winnerAfterBoundary,
    finalProjectedWinner: selectedArc.id,
    selectedArcBeforeBoundary: winnerBeforeBoundary,
    selectedArcAfterBoundary: winnerAfterBoundary,
    finalProjectedArcId: selectedArc.id,
    finalProjectedMatchesPostBoundaryWinner: Boolean(
      winnerAfterBoundary && selectedArc.id === winnerAfterBoundary,
    ),
    changedWinner,
    boundaryChangedWinner: changedWinner,
    changedOrderCount,
    averageRankDelta,
    topCandidateOverlapPct,
    refinementNudgeTrace: {
      ...ranking.refinementNudgeSummary,
      greatStopQualityContext: ranking.qualityContext
        ? {
            riskTier: ranking.qualityContext.greatStopRiskTier,
            failedStopCount: ranking.qualityContext.greatStopFailedStopCount,
            severeFailureCount: ranking.qualityContext.greatStopSevereFailureCount,
            suppressionRecommended:
              ranking.qualityContext.greatStopSuppressionRecommended,
            penaltyHint: ranking.qualityContext.greatStopPenaltyHint,
            reasonCodes: [...ranking.qualityContext.reasonCodes],
          }
        : undefined,
    },
    boundaryContributionLevel: getBoundaryContributionLevel(
      changedWinner,
      changedOrderCount,
      averageRankDelta,
      boundaryCandidates.length,
    ),
    preBoundarySnapshot,
    postBoundarySnapshot,
    warnings: [],
  }
  boundaryDiagnostics.warnings = buildBoundaryTruthNotes({
    boundary: boundaryDiagnostics,
    strictShapeEnabled,
    minRolePoolSize,
  })
  const faultIsolationNotes: string[] = []
  if (fallbackTrace) {
    faultIsolationNotes.push(
      `Fallback trace: full=${fallbackTrace.fullArcCandidatesCount}, partial=${fallbackTrace.partialArcCandidatesCount}, highlight-only=${fallbackTrace.highlightOnlyCandidatesCount}, selected=${fallbackTrace.selectedFallbackType ?? 'none'}.`,
    )
    if (fallbackTrace.primaryPathFailureReason) {
      faultIsolationNotes.push(
        `Fallback trigger: ${fallbackTrace.primaryPathFailureReason} at ${fallbackTrace.triggerStage ?? 'unknown_stage'}.`,
      )
    }
    if (typeof fallbackTrace.selectedFallbackScore === 'number') {
      faultIsolationNotes.push(
        `Fallback selection quality: score=${fallbackTrace.selectedFallbackScore}, stops=${fallbackTrace.selectedFallbackStopCount ?? 'n/a'}.`,
      )
    }
    if (fallbackTrace.usedRecoveredCentralMomentHighlight) {
      faultIsolationNotes.push(
        `Recovered central-moment highlights considered: ${fallbackTrace.recoveredHighlightCandidatesCount ?? 0}${fallbackTrace.centralMomentRecoveryReason ? ` (${fallbackTrace.centralMomentRecoveryReason})` : ''}.`,
      )
    }
    if (fallbackTrace.fallbackFailureReason) {
      faultIsolationNotes.push(`Fallback failure reason: ${fallbackTrace.fallbackFailureReason}.`)
    }
  }
  if (overPruned) {
    faultIsolationNotes.push('Potential over-pruning before ranking: check retrieval and role thresholds.')
  }
  if (userLedFinalRoleLockApplied) {
    faultIsolationNotes.push(
      `User-led final role lock restricted winner comparison to ${survivingAnchorArcCount} anchor-preserving highlight arcs.`,
    )
  }
  if (userLedFinalRoleLockFallbackReason) {
    faultIsolationNotes.push(
      `User-led final role lock could not be applied: ${userLedFinalRoleLockFallbackReason}.`,
    )
  }
  if (anchorApplied && anchorAdmittedToRolePool === false) {
    faultIsolationNotes.push(
      `Anchor admission failed before arc assembly: ${anchorAdmissionFailureReason ?? 'anchor_not_scored'}.`,
    )
  }
  if (finalAnchorArcLossReason) {
    faultIsolationNotes.push(`Anchor arcs dropped before final selection: ${finalAnchorArcLossReason}.`)
  }
  if (anchorHoursRelaxed) {
    faultIsolationNotes.push(
      `Anchor hours rejection was softened because ${anchorHoursRelaxationReason}.`,
    )
  }
  if (temporalMode === 'explicit' && anchorAdmissionFailureReason === 'rejected_hours') {
    faultIsolationNotes.push(
      'Anchor conflicted with an explicit time window, so hours remained a hard constraint.',
    )
  }
  if (anchorGeographyRelaxed) {
    faultIsolationNotes.push(
      `Anchor-containing arcs kept geography as a soft penalty across ${geographyViolationCount} generated combinations.`,
    )
  }
  if (anchorCanonicalization.rawAnchorVenueId && anchorInjectedToInventory) {
    faultIsolationNotes.push(
      `Anchor injected into planning inventory via ${anchorInjectionSource ?? 'unknown'} source.`,
    )
  }
  if (anchorInjectionFailureReason) {
    faultIsolationNotes.push(`Anchor injection failed: ${anchorInjectionFailureReason}.`)
  }
  if (anchorCanonicalization.anchorCanonicalized) {
    faultIsolationNotes.push(
      `Anchor canonicalized from ${anchorCanonicalization.rawAnchorVenueId} to ${anchorCanonicalization.canonicalAnchorVenueId}.`,
    )
  }
  if (anchorCanonicalization.anchorCanonicalizationFailureReason) {
    faultIsolationNotes.push(
      `Anchor canonicalization failed: ${anchorCanonicalization.anchorCanonicalizationFailureReason}.`,
    )
  }
  const constraintTrace = buildConstraintTrace({
    anchorApplied,
    anchorAdmissionFailureReason,
    anchorDroppedReason,
    anchorGeographyRelaxed,
    anchorHoursRelaxed,
    anchorHoursRelaxationReason,
    anchorRole,
    anchorSurvivedToArc,
    finalAnchorArcLossReason,
    geographyViolationCount,
    temporalMode,
  })
  if (refinementOutcome?.outcomeType === 'no_better_match') {
    faultIsolationNotes.push('Refinement could not find a materially better challenger in current inventory.')
  }
  if (
    refinementPathContext &&
    !refinementPathContext.targetedChangeSucceeded &&
    refinementPathContext.targetedCandidateCount === 0
  ) {
    faultIsolationNotes.push('Targeted refinement had zero viable candidates for preferred roles.')
  }
  if (refinementPathContext?.winnerInertiaDetected) {
    faultIsolationNotes.push('Winner inertia detected: axis-leading challengers were blocked by constraints or arc quality.')
  }
  if (surpriseInjection.surpriseInjected) {
    faultIsolationNotes.push(
      `Surprise stop injected: ${surpriseInjection.surpriseSelectionReason}`,
    )
  }
  if (districtAnchor.source === 'city_fallback') {
    faultIsolationNotes.push(`District anchor fell back to citywide context: ${districtAnchor.reason}.`)
  }
  if (categoryDiversity.categoryDiversityPenaltyApplied) {
    faultIsolationNotes.push(
      `Category diversity penalty applied: ${categoryDiversity.notes.join('; ')}.`,
    )
  }
  if (primaryVibeMatchCount < 6) {
    faultIsolationNotes.push(`Sparse inventory for primary vibe "${intent.primaryAnchor}".`)
  }
  if (retrieval.stageCounts.qualitySuppressed > 0) {
    faultIsolationNotes.push(
      `${retrieval.stageCounts.qualitySuppressed} venues were excluded before retrieval by the quality gate.`,
    )
  }
  if (options.starterPack && starterPackFilteredCount < 6) {
    faultIsolationNotes.push('Starter pack constraints appear weak due to limited matching local inventory.')
  }
  if (retrieval.sourceMode.fallbackToCurated) {
    faultIsolationNotes.push(
      `Live source fallback used: ${retrieval.sourceMode.failureReason ?? 'live inventory did not stay strong enough after normalization and retrieval.'}`,
    )
  } else if (retrieval.sourceMode.partialFailure) {
    faultIsolationNotes.push('Live source returned partial results; successful queries were blended while failed queries were ignored.')
  }
  if (retrieval.sourceMode.liveHoursSuppressedCount > 0) {
    faultIsolationNotes.push(
      `${retrieval.sourceMode.liveHoursSuppressedCount} live venues were suppressed by hours/open-now pressure.`,
    )
  }
  if (retrieval.sourceMode.liveHoursDemotedCount > 0) {
    faultIsolationNotes.push(
      `${retrieval.sourceMode.liveHoursDemotedCount} live venues were demoted by hours uncertainty or likely closure.`,
    )
  }
  const highlightLeader = roleWinnerFrequency.highlight?.[0]
  if (highlightLeader && highlightLeader.winShare >= 55) {
    faultIsolationNotes.push(
      `Highlight role shows dominant winner tendency (${highlightLeader.winShare}% in top candidates).`,
    )
  }
  if (highlightLeader?.flaggedUniversal) {
    faultIsolationNotes.push('Highlight winner is flagged as overly universal; generic winner penalty applied.')
  }
  const highlightExplain = stopReasons.stopExplainability.highlight
  if (highlightExplain && highlightExplain.dominancePenalty > 0) {
    faultIsolationNotes.push(
      `Generic winner penalty applied on Highlight (${highlightExplain.dominancePenalty}).`,
    )
  }
  if (highlightExplain && highlightExplain.contextSpecificity >= 65) {
    faultIsolationNotes.push(
      `Context-specificity bonus influenced Highlight (${highlightExplain.contextSpecificity}).`,
    )
  }
  if (highlightExplain?.highlightPressureSource) {
    faultIsolationNotes.push(
      `Highlight pressure source: ${highlightExplain.highlightPressureSource}.`,
    )
  }
  if (highlightExplain?.outdoorVsUrbanRead && highlightExplain.outdoorVsUrbanRead !== 'not-applicable') {
    faultIsolationNotes.push(`Highlight reads as ${highlightExplain.outdoorVsUrbanRead}.`)
  }
  if (highlightExplain?.supportStopVibeEffect) {
    faultIsolationNotes.push(`Support stops ${highlightExplain.supportStopVibeEffect} the requested vibe.`)
  }
  if (highlightExplain?.routeShapeBiasApplied) {
    faultIsolationNotes.push(highlightExplain.routeShapeBiasApplied)
  }
  if (highlightExplain?.highlightValidityLevel) {
    faultIsolationNotes.push(
      `Highlight validity level: ${highlightExplain.highlightValidityLevel}.`,
    )
  }
  if (highlightExplain?.selectedHighlightIsFallback) {
    faultIsolationNotes.push('Selected Highlight is a fallback-eligible centerpiece, not a fully valid fit.')
  }
  if (highlightExplain?.selectedHighlightViolatesIntent) {
    faultIsolationNotes.push('Selected Highlight violates the requested intent and should be treated as an emergency fallback.')
  }
  if (highlightExplain?.fallbackUsedBecauseNoValidHighlight) {
    faultIsolationNotes.push('No fully valid Highlight was available in the local pool; fallback eligibility was used.')
  }
  if (highlightExplain?.packLiteralRequirementSatisfied === false) {
    faultIsolationNotes.push('Selected Highlight did not fully satisfy the pack literal requirement.')
  }
  if (highlightExplain?.bestValidHighlightChallenger) {
    faultIsolationNotes.push(
      `Best valid Highlight challenger: ${highlightExplain.bestValidHighlightChallenger}.`,
    )
  }
  if (
    highlightExplain?.musicSupportSource &&
    highlightExplain.musicSupportSource !== 'not-applicable'
  ) {
    faultIsolationNotes.push(
      `Music/performance support came from ${highlightExplain.musicSupportSource}.`,
    )
  }
  if (highlightExplain?.moreContextSpecificChallengerExists) {
    faultIsolationNotes.push('Highlight winner was challenged by context-specific alternatives.')
  }
  if (selectedArc.pacing.pacingPenaltyApplied) {
    faultIsolationNotes.push(
      `Route pacing penalty applied: ${selectedArc.pacing.pacingPenaltyReasons.join('; ')}.`,
    )
  }
  if (selectedArc.pacing.smoothProgressionRewardApplied) {
    faultIsolationNotes.push(
      `Smooth progression rewarded: ${selectedArc.pacing.smoothProgressionRewardReasons.join('; ')}.`,
    )
  }
  if (selectedArc.pacing.totalRouteFriction >= 8) {
    faultIsolationNotes.push(
      `Route friction is high (${selectedArc.pacing.totalRouteFriction}) and may feel more effortful.`,
    )
  }
  if (selectedArc.spatial.jumpUsed) {
    faultIsolationNotes.push(
      `Spatial model used one allowed destination jump in ${selectedArc.spatial.mode} mode.`,
    )
  }
  if (selectedArc.spatial.repeatedClusterEscapeCount > 0) {
    faultIsolationNotes.push('Route changed clusters repeatedly and paid a spatial coherence penalty.')
  }
  if (selectedArc.spatial.score <= 0.55) {
    faultIsolationNotes.push(
      `Spatial coherence was weak (${selectedArc.spatial.score}) relative to the selected outing mode.`,
    )
  }
  for (const role of ['start', 'highlight', 'surprise', 'windDown'] as UserStopRole[]) {
    const poolDiagnostics = stopReasons.rolePoolDiagnostics[role]
    if (!poolDiagnostics) {
      continue
    }
    if (poolDiagnostics.contractRelaxed && poolDiagnostics.contractFallbackReason) {
      faultIsolationNotes.push(`${formatRoleLabel(role)} contract relaxed: ${poolDiagnostics.contractFallbackReason}`)
    }
    if (poolDiagnostics.selectedViolatesContract) {
      faultIsolationNotes.push(`${formatRoleLabel(role)} selected stop violated its role contract.`)
    }
  }
  if (
    refinementPathContext &&
    !refinementPathContext.targetRoleExistedInVisiblePlan &&
    refinementPathContext.targetRoleSelectionReason
  ) {
    faultIsolationNotes.push(refinementPathContext.targetRoleSelectionReason)
  }
  for (const warning of boundaryDiagnostics.warnings) {
    faultIsolationNotes.push(warning)
  }
  const retrievalDiagnostics: GenerationDiagnostics['retrievalDiagnostics'] = {
    stageCounts: retrieval.stageCounts,
    liveSource: {
      requestedMode: retrieval.sourceMode.requestedMode,
      effectiveMode: retrieval.sourceMode.effectiveMode,
      provider: retrieval.sourceMode.provider,
      debugOverrideApplied: retrieval.sourceMode.debugOverrideApplied,
      fallbackToCurated: retrieval.sourceMode.fallbackToCurated,
      liveFetchAttempted: retrieval.sourceMode.liveFetchAttempted,
      liveFetchSucceeded: retrieval.sourceMode.liveFetchSucceeded,
      failureReason: retrieval.sourceMode.failureReason,
      queryLocationLabel: retrieval.sourceMode.queryLocationLabel,
      queryCount: retrieval.sourceMode.queryCount,
      liveQueryTemplatesUsed: retrieval.sourceMode.liveQueryTemplatesUsed,
      liveQueryLabelsUsed: retrieval.sourceMode.liveQueryLabelsUsed,
      liveCandidatesByQuery: retrieval.sourceMode.liveCandidatesByQuery,
      liveRoleIntentQueryNotes: retrieval.sourceMode.liveRoleIntentQueryNotes,
      fetchedCount: retrieval.sourceMode.fetchedCount,
      mappedCount: retrieval.sourceMode.mappedCount,
      normalizedCount: retrieval.sourceMode.normalizedCount,
      approvedCount: retrieval.sourceMode.approvedCount,
      demotedCount: retrieval.sourceMode.demotedCount,
      suppressedCount: retrieval.sourceMode.suppressedCount,
      liveHoursDemotedCount: retrieval.sourceMode.liveHoursDemotedCount,
      liveHoursSuppressedCount: retrieval.sourceMode.liveHoursSuppressedCount,
      partialFailure: retrieval.sourceMode.partialFailure,
      errors: retrieval.sourceMode.errors,
      countsBySource: retrieval.sourceMode.countsBySource,
      dedupedCount: retrieval.sourceMode.dedupedCount,
      dedupedLiveCount: retrieval.sourceMode.dedupedLiveCount,
      liveRetrievedCount: 0,
      hybridLiveCompetitiveCount: 0,
      liveHighlightCandidateCount: 0,
      liveCompetitivenessLiftApplied: 0,
      liveTimeConfidenceAdjustedCount: 0,
      liveTimeConfidencePenaltyByRole: {
        start: 0,
        highlight: 0,
        surprise: 0,
        windDown: 0,
      },
      liveRejectedByHighlightValidityCount: 0,
      liveRejectedByRolePoolCount: 0,
      liveLostInArcAssemblyCount: 0,
      liveLostInFinalWinnerCount: 0,
      liveRolePoolCounts: {
        start: 0,
        highlight: 0,
        surprise: 0,
        windDown: 0,
      },
      liveRoleWinCounts: {
        start: 0,
        highlight: 0,
        surprise: 0,
        windDown: 0,
      },
      strongestLiveByRole: {},
      strongestCuratedByRole: {},
      strongestLiveScoreByRole: {},
      strongestCuratedScoreByRole: {},
      strongestLiveLossReasonByRole: {},
      strongestLiveLostAtStageByRole: {},
      strongestLiveVsCuratedDeltaByRole: {},
      roleCompetitionByRole: {},
      liveAttritionTrace: {
        liveFetchedCount: 0,
        liveMappedCount: 0,
        liveNormalizedCount: 0,
        liveApprovedCount: 0,
        liveDemotedCount: 0,
        liveSuppressedCount: 0,
        liveDedupedCount: 0,
        liveDedupedAgainstCuratedCount: 0,
        liveNoveltyCollapsedCount: 0,
        liveRetrievedCount: 0,
        liveEnteredRolePoolStart: 0,
        liveEnteredRolePoolHighlight: 0,
        liveEnteredRolePoolSurprise: 0,
        liveEnteredRolePoolWindDown: 0,
        liveRejectedByHighlightValidityCount: 0,
        liveRejectedByRolePoolCount: 0,
        liveLostInArcAssemblyCount: 0,
        liveLostInFinalWinnerCount: 0,
        stages: [],
      },
      curatedDominance: {
        curatedDominanceDetected: false,
        curatedDominancePrimaryReason: 'Not evaluated.',
        repeatedCuratedWinnerPattern: [],
        liveWouldNeedToImproveOn: [],
        sourceBalanceSummary: [],
      },
      dedupeNoveltyLoss: {
        liveDedupedAgainstCuratedCount: 0,
        strongestLiveDedupedExamples: [],
        dedupeLossReason: [],
        liveNoveltyCollapsedCount: 0,
      },
      liveTrustBreakdown: {
        topApprovedBlockers: [],
        topSuppressionReasons: [],
        topDedupeReasons: [],
        strongestApprovalFailures: [],
        strongestSuppressedCandidates: [],
        strongestDedupedCandidates: [],
      },
      strongLiveCandidatesFilteredCount: 0,
      liveLostToCuratedReason: [],
      sourceBalanceNotes: [],
      curatedVsLiveWinnerNotes: [],
      selectedStopSources: Object.fromEntries(
        selectedArc.stops.map((stop) => [
          roleProjection[stop.role],
          stop.scoredVenue.venue.source.sourceOrigin,
        ]),
      ) as GenerationDiagnostics['retrievalDiagnostics']['liveSource']['selectedStopSources'],
    },
    personaFilteredCount,
    starterPackFilteredCount,
    refinementFilteredCount,
    geographyFilteredCount,
    roleShapeEligibleCount,
    excludedByQualityGate: retrieval.excludedByQualityGate,
    overPruned,
    pruneNotes,
    vibeInfluence: {
      primaryVibe: intent.primaryAnchor,
      secondaryVibe,
      primaryVibeMatchCount,
      secondaryVibeMatchCount,
      weakVibeInfluence: primaryVibeMatchCount < 6 && secondaryVibeMatchCount < 4,
      selectedHighlightVibeFit: selectedArc.stops.find((stop) => stop.role === 'peak')
        ? roundToTenths(
            (selectedArc.stops.find((stop) => stop.role === 'peak')!.scoredVenue.vibeAuthority.byRole.highlight ?? 0) *
              100,
          )
        : undefined,
      selectedHighlightPackPressure: selectedArc.stops.find((stop) => stop.role === 'peak')
        ? roundToTenths(
            (selectedArc.stops.find((stop) => stop.role === 'peak')!.scoredVenue.vibeAuthority.packPressure.highlight ?? 0) *
              100,
          )
        : undefined,
      selectedHighlightPressureSource: selectedArc.stops.find((stop) => stop.role === 'peak')
        ?.scoredVenue.vibeAuthority.pressureSource.highlight,
      selectedHighlightMusicSupport: selectedArc.stops.find((stop) => stop.role === 'peak')
        ?.scoredVenue.vibeAuthority.musicSupportSource,
      selectedSupportStopVibeFit: stopReasons.planVibeDiagnostics.supportStopVibeFit,
      routeShapeBiasApplied: stopReasons.planVibeDiagnostics.routeShapeBiasApplied,
      routeShapeBiasScore: stopReasons.planVibeDiagnostics.routeShapeBiasScore,
      selectedHighlightAdventureRead: stopReasons.planVibeDiagnostics.selectedHighlightAdventureRead,
      outdoorVsUrbanNotes: stopReasons.planVibeDiagnostics.outdoorVsUrbanNotes,
    },
    tasteInterpretation: buildTasteDiagnostics(scoredVenues),
  }
  const liveCompetitiveness = computeLiveCompetitiveness({
    retrieval,
    scoredVenues,
    selectedArc,
    arcCandidates,
    rolePools,
    lens,
    effectiveSourceMode: retrieval.sourceMode.effectiveMode,
  })
  retrievalDiagnostics.liveSource.liveRetrievedCount =
    liveCompetitiveness.liveRetrievedCount
  retrievalDiagnostics.liveSource.hybridLiveCompetitiveCount =
    liveCompetitiveness.hybridLiveCompetitiveCount
  retrievalDiagnostics.liveSource.liveHighlightCandidateCount =
    liveCompetitiveness.liveHighlightCandidateCount
  retrievalDiagnostics.liveSource.liveCompetitivenessLiftApplied =
    liveCompetitiveness.liveCompetitivenessLiftApplied
  retrievalDiagnostics.liveSource.liveTimeConfidenceAdjustedCount =
    liveCompetitiveness.liveTimeConfidenceAdjustedCount
  retrievalDiagnostics.liveSource.liveTimeConfidencePenaltyByRole =
    liveCompetitiveness.liveTimeConfidencePenaltyByRole
  retrievalDiagnostics.liveSource.liveRejectedByHighlightValidityCount =
    liveCompetitiveness.liveRejectedByHighlightValidityCount
  retrievalDiagnostics.liveSource.liveRejectedByRolePoolCount =
    liveCompetitiveness.liveRejectedByRolePoolCount
  retrievalDiagnostics.liveSource.liveLostInArcAssemblyCount =
    liveCompetitiveness.liveLostInArcAssemblyCount
  retrievalDiagnostics.liveSource.liveLostInFinalWinnerCount =
    liveCompetitiveness.liveLostInFinalWinnerCount
  retrievalDiagnostics.liveSource.liveRolePoolCounts =
    liveCompetitiveness.liveRolePoolCounts
  retrievalDiagnostics.liveSource.liveRoleWinCounts =
    liveCompetitiveness.liveRoleWinCounts
  retrievalDiagnostics.liveSource.strongestLiveByRole =
    liveCompetitiveness.strongestLiveByRole
  retrievalDiagnostics.liveSource.strongestCuratedByRole =
    liveCompetitiveness.strongestCuratedByRole
  retrievalDiagnostics.liveSource.strongestLiveScoreByRole =
    liveCompetitiveness.strongestLiveScoreByRole
  retrievalDiagnostics.liveSource.strongestCuratedScoreByRole =
    liveCompetitiveness.strongestCuratedScoreByRole
  retrievalDiagnostics.liveSource.strongestLiveLossReasonByRole =
    liveCompetitiveness.strongestLiveLossReasonByRole
  retrievalDiagnostics.liveSource.strongestLiveLostAtStageByRole =
    liveCompetitiveness.strongestLiveLostAtStageByRole
  retrievalDiagnostics.liveSource.strongestLiveVsCuratedDeltaByRole =
    liveCompetitiveness.strongestLiveVsCuratedDeltaByRole
  retrievalDiagnostics.liveSource.roleCompetitionByRole =
    liveCompetitiveness.roleCompetitionByRole
  retrievalDiagnostics.liveSource.liveAttritionTrace =
    liveCompetitiveness.liveAttritionTrace
  retrievalDiagnostics.liveSource.curatedDominance =
    liveCompetitiveness.curatedDominance
  retrievalDiagnostics.liveSource.dedupeNoveltyLoss =
    liveCompetitiveness.dedupeNoveltyLoss
  retrievalDiagnostics.liveSource.liveTrustBreakdown =
    retrieval.sourceMode.liveTrustBreakdown
  retrievalDiagnostics.liveSource.strongLiveCandidatesFilteredCount =
    liveCompetitiveness.strongLiveCandidatesFilteredCount
  retrievalDiagnostics.liveSource.liveLostToCuratedReason =
    liveCompetitiveness.liveLostToCuratedReason
  retrievalDiagnostics.liveSource.sourceBalanceNotes =
    liveCompetitiveness.sourceBalanceNotes
  retrievalDiagnostics.liveSource.curatedVsLiveWinnerNotes =
    liveCompetitiveness.curatedVsLiveWinnerNotes
  for (const note of liveCompetitiveness.sourceBalanceNotes) {
    faultIsolationNotes.push(note)
  }
  for (const note of liveCompetitiveness.curatedVsLiveWinnerNotes) {
    faultIsolationNotes.push(note)
  }
  if (liveCompetitiveness.curatedDominance.curatedDominanceDetected) {
    faultIsolationNotes.push(liveCompetitiveness.curatedDominance.curatedDominancePrimaryReason)
  }
  if (liveCompetitiveness.dedupeNoveltyLoss.liveDedupedAgainstCuratedCount > 0) {
    faultIsolationNotes.push(
      `${liveCompetitiveness.dedupeNoveltyLoss.liveDedupedAgainstCuratedCount} live venues were deduped against curated seeds before final competition.`,
    )
  }
  const internalRoles = selectedArc.stops.map((stop) => stop.role)
  const alternativeCounts: GenerationDiagnostics['alternativeCounts'] = {}
  const nearbyAlternativeCounts: GenerationDiagnostics['nearbyAlternativeCounts'] = {}

  for (const role of internalRoles) {
    const userRole = roleProjection[role]
    alternativeCounts[userRole] = getRoleAlternatives({
      role,
      currentArc: selectedArc,
      scoredVenues,
      intent,
      crewPolicy,
      lens,
      limit: 5,
    }).length
    nearbyAlternativeCounts[userRole] = getNearbyAlternatives({
      role,
      currentArc: selectedArc,
      scoredVenues,
      intent,
      lens,
      limit: 4,
    }).length
  }

  let overlapDiagnostics: OverlapDiagnostics | undefined
  if (options.debugMode) {
    const overlapContext: OverlapScenarioContext = {
      city: intent.city,
      neighborhood: intent.neighborhood,
      distanceMode: intent.distanceMode,
      budget: intent.budget,
      timeWindow: intent.timeWindow,
      strictShapeEnabled,
    }
    const overlapScenarios = await Promise.all([
      simulateOverlapScenario(
        {
          scenarioId: 'romantic_drinks_music',
          label: 'Romantic / drinks + music',
          mode: 'build',
          persona: 'romantic',
          primaryVibe: 'lively',
          secondaryVibe: 'cultured',
        },
        overlapContext,
      ),
      simulateOverlapScenario(
        {
          scenarioId: 'family_drinks_music',
          label: 'Family / drinks + music',
          mode: 'build',
          persona: 'family',
          primaryVibe: 'lively',
          secondaryVibe: 'cultured',
        },
        overlapContext,
      ),
      simulateOverlapScenario(
        {
          scenarioId: 'friends_drinks_music',
          label: 'Friends / drinks + music',
          mode: 'build',
          persona: 'friends',
          primaryVibe: 'lively',
          secondaryVibe: 'cultured',
        },
        overlapContext,
      ),
      simulateOverlapScenario(
        {
          scenarioId: 'jazz_pack',
          label: 'Jazz Night starter pack',
          mode: 'curate',
          persona: 'romantic',
          primaryVibe: 'cozy',
          secondaryVibe: 'cultured',
          starterPackId: 'cozy-jazz-night',
        },
        overlapContext,
      ),
      simulateOverlapScenario(
        {
          scenarioId: 'build_similar_vibes',
          label: 'Build mode similar vibes',
          mode: 'build',
          persona: 'romantic',
          primaryVibe: 'cozy',
          secondaryVibe: 'cultured',
        },
        overlapContext,
      ),
    ])
    const overlapPairs = computePairMatrix(overlapScenarios)
    const scenarioById = new Map(overlapScenarios.map((scenario) => [scenario.scenarioId, scenario] as const))
    const overlapWarnings = overlapPairs
      .filter((pair) => pair.topCandidateOverlapPct >= 80 && pair.winnerOverlapPct >= 100)
      .map((pair) => {
        const left = scenarioById.get(pair.leftScenarioId)?.label ?? pair.leftScenarioId
        const right = scenarioById.get(pair.rightScenarioId)?.label ?? pair.rightScenarioId
        return `${left} and ${right} show high overlap before boundary (${pair.topCandidateOverlapPct}%).`
      })
    overlapDiagnostics = {
      scenarios: overlapScenarios,
      pairs: overlapPairs,
      warnings: overlapWarnings,
    }
    for (const note of overlapWarnings) {
      faultIsolationNotes.push(note)
    }
  }

  const rolePoolVenueIdsByRole: GenerationDiagnostics['rolePoolVenueIdsByRole'] = {
    start: [...new Set(rolePools.warmup.map((candidate) => candidate.venue.id))],
    highlight: [...new Set(rolePools.peak.map((candidate) => candidate.venue.id))],
    windDown: [...new Set(rolePools.cooldown.map((candidate) => candidate.venue.id))],
  }
  const rolePoolVenueIdsCombined = [
    ...new Set([
      ...rolePoolVenueIdsByRole.start,
      ...rolePoolVenueIdsByRole.highlight,
      ...rolePoolVenueIdsByRole.windDown,
    ]),
  ]

  const diagnostics: GenerationDiagnostics = {
    totalVenueCount: retrieval.totalVenueCount,
    retrievedVenueCount: retrieval.venues.length,
    retrievalContractApplied: retrievalPressure.retrievalContractApplied,
    retrievedVenueIds: retrievalPressure.retrievedVenueIds,
    lensCompatibleCount: retrieval.lensCompatibleCount,
    scoredVenueCount: scoredVenues.length,
    rolePoolCounts: {
      start: rolePools.warmup.length,
      highlight: rolePools.peak.length,
      surprise: rolePools.wildcard.length,
      windDown: rolePools.cooldown.length,
    },
    rolePoolVenueIdsByRole,
    rolePoolVenueIdsCombined,
    contractInfluenceSummary: retrievalPressure.contractInfluenceSummary,
    candidateArcCount: arcCandidates.length,
    anchorApplied,
    anchorRole,
    anchorInjectedToInventory,
    anchorInjectionSource,
    anchorInjectionFailureReason,
    rawAnchorVenueId: anchorCanonicalization.rawAnchorVenueId,
    canonicalAnchorVenueId: anchorCanonicalization.canonicalAnchorVenueId,
    anchorCanonicalized: anchorCanonicalization.anchorCanonicalized,
    anchorCanonicalizationFailureReason:
      anchorCanonicalization.anchorCanonicalizationFailureReason,
    anchorHoursRelaxed,
    anchorHoursRelaxationReason,
    anchorAdmittedToRolePool,
    anchorAdmissionFailureReason,
    anchorRolePoolSize: anchorRolePool?.length,
    anchorRolePoolIndex:
      typeof anchorRolePoolIndex === 'number' && anchorRolePoolIndex >= 0
        ? anchorRolePoolIndex
        : undefined,
    anchorRolePoolVenueIds,
    anchorGeographyRelaxed,
    geographyViolationCount,
    anchorSurvivedToArc,
    anchorDroppedReason,
    preValidationAnchorArcCount:
      arcAssembly.anchorTrace?.preValidationAnchorArcCount ?? 0,
    postValidationAnchorArcCount:
      arcAssembly.anchorTrace?.postValidationAnchorArcCount ?? 0,
    postPruneAnchorArcCount:
      arcAssembly.anchorTrace?.postPruneAnchorArcCount ?? 0,
    finalAnchorArcCount: finalAnchorCandidates.length,
    invalidatedAnchorArcCount:
      arcAssembly.anchorTrace?.invalidatedAnchorArcCount ?? 0,
    invalidatedAnchorArcReasons:
      arcAssembly.anchorTrace?.invalidatedAnchorArcReasons ?? {},
    anchorArcTrimmedByTopN:
      arcAssembly.anchorTrace?.anchorArcTrimmedByTopN ?? false,
    anchorArcTrimmedByWhichStage:
      arcAssembly.anchorTrace?.anchorArcTrimmedByWhichStage,
    bestPreValidationAnchorArcId:
      arcAssembly.anchorTrace?.bestPreValidationAnchorArcId,
    bestPreValidationAnchorArcScore:
      arcAssembly.anchorTrace?.bestPreValidationAnchorArcScore,
    bestValidatedAnchorArcId:
      arcAssembly.anchorTrace?.bestValidatedAnchorArcId,
    bestValidatedAnchorArcScore:
      arcAssembly.anchorTrace?.bestValidatedAnchorArcScore,
    bestPrunedAnchorArcId:
      arcAssembly.anchorTrace?.bestPrunedAnchorArcId,
    bestPrunedAnchorArcScore:
      arcAssembly.anchorTrace?.bestPrunedAnchorArcScore,
    bestFinalAnchorArcId: bestFinalAnchorArc?.id,
    bestFinalAnchorArcScore:
      typeof bestFinalAnchorArc?.totalScore === 'number'
        ? roundToHundredths(bestFinalAnchorArc.totalScore)
        : undefined,
    bestNonAnchorArcId: bestNonAnchorArc?.id,
    bestNonAnchorArcScore:
      typeof bestNonAnchorArc?.totalScore === 'number'
        ? roundToHundredths(bestNonAnchorArc.totalScore)
        : undefined,
    finalAnchorArcLossReason,
    userLedFinalRoleLockApplied,
    finalArcFilteredToAnchorRole,
    survivingAnchorArcCount,
    userLedFinalRoleLockFallbackReason,
    preRankingAnchorRoleLockTrace: {
      triggered: shouldApplyUserLedFinalRoleLock,
      lockApplied: userLedFinalRoleLockApplied,
      lockSource: shouldApplyUserLedFinalRoleLock ? 'user_intent_anchor' : 'none',
      triggerReason: shouldApplyUserLedFinalRoleLock
        ? 'user_led_highlight_anchor_survived_to_arc_candidates'
        : 'lock_not_eligible',
      lockedRole: shouldApplyUserLedFinalRoleLock ? 'highlight' : undefined,
      lockedVenueId:
        shouldApplyUserLedFinalRoleLock && planningIntent.anchor?.venueId
          ? planningIntent.anchor.venueId
          : undefined,
      anchorApplied,
      anchorSurvivedToArc,
      preLockCandidateCount: arcCandidates.length,
      postLockCandidateCount: boundaryCandidates.length,
      survivingAnchorArcCount,
      fallbackReason: userLedFinalRoleLockFallbackReason,
    },
    constraintTrace,
    temporalTrace,
    fallbackRelaxationApplied: retrieval.fallbackRelaxationApplied,
    fallbackRelaxationLevel: retrieval.fallbackRelaxationApplied,
    selectedArcId: selectedArc.id,
    selectedStopIds: selectedArc.stops.map((stop) => stop.scoredVenue.venue.id),
    buildFallbackTrace: fallbackTrace,
    starterPackInfluenceApplied: Boolean(options.starterPack),
    starterPackInfluenceSummary: stopReasons.starterPackInfluenceSummary,
    refinementModeApplied: intent.refinementModes ?? [],
    refinementChangeSummary: refinementOutcome?.summaryMessage,
    alternativeCounts,
    nearbyAlternativeCounts,
    geoPenaltyApplied: selectedArc.scoreBreakdown.geographyScore < 0.64,
    duplicateCategoryPenaltyApplied: categoryDiversity.categoryDiversityPenaltyApplied,
    roleWinnerFrequency,
    rolePoolDiagnostics: stopReasons.rolePoolDiagnostics,
    stopExplainability: stopReasons.stopExplainability,
    routePacing: {
      transitions: selectedArc.pacing.transitions.map((transition) => ({
        fromRole: roleProjection[transition.fromRoleKey as ArcStop['role']],
        toRole: roleProjection[transition.toRoleKey as ArcStop['role']],
        fromVenueId: transition.fromVenueId,
        toVenueId: transition.toVenueId,
        estimatedTravelMinutes: transition.estimatedTravelMinutes,
        transitionBufferMinutes: transition.transitionBufferMinutes,
        estimatedTransitionMinutes: transition.estimatedTransitionMinutes,
        frictionScore: transition.frictionScore,
        movementMode: transition.movementMode,
        neighborhoodContinuity: transition.neighborhoodContinuity,
        notes: transition.notes,
      })),
      totalRouteFriction: selectedArc.pacing.totalRouteFriction,
      estimatedStopMinutes: selectedArc.pacing.estimatedStopMinutes,
      estimatedTransitionMinutes: selectedArc.pacing.estimatedTransitionMinutes,
      estimatedTotalMinutes: selectedArc.pacing.estimatedTotalMinutes,
      estimatedTotalLabel: selectedArc.pacing.estimatedTotalLabel,
      routeFeelLabel: selectedArc.pacing.routeFeelLabel,
      pacingPenaltyApplied: selectedArc.pacing.pacingPenaltyApplied,
      pacingPenaltyReasons: selectedArc.pacing.pacingPenaltyReasons,
      smoothProgressionRewardApplied: selectedArc.pacing.smoothProgressionRewardApplied,
      smoothProgressionRewardReasons: selectedArc.pacing.smoothProgressionRewardReasons,
    },
    spatialCoherence: selectedArc.spatial,
    surpriseInjection,
    districtAnchor,
    recommendedDistricts,
    topDistrictId: recommendedDistricts[0]?.districtId,
    selectedDistrictId: districtAnchor.districtId,
    selectedDistrictLabel: districtAnchor.districtLabel,
    selectedDistrictSource: districtAnchor.source,
    selectedDistrictConfidence: districtAnchor.confidence,
    selectedDistrictReason: districtAnchor.reason,
    categoryDiversity,
    strictShapeEnabled,
    boundaryDiagnostics,
    overlapDiagnostics,
    retrievalDiagnostics,
    faultIsolationNotes,
    refinementOutcome,
    baselineArcId: options.baselineArc?.id,
    changedStopCount: refinementOutcome
      ? refinementOutcome.changedStopCount
      : options.baselineArc
        ? countChangedStops(selectedArc, options.baselineArc)
        : undefined,
  }

  return {
    itinerary,
    selectedArc,
    scoredVenues,
    intentProfile: planningIntent,
    lens,
    trace: {
      ...diagnostics,
      intent: planningIntent,
      lens: {
        tone: lens.tone,
        discoveryBias: lens.discoveryBias,
        movementTolerance: lens.movementTolerance,
      },
      rankingEngine: ranking.engine,
    },
  }
}
