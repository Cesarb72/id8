import {
  previewDistrictRecommendationsForPlanBuild,
  runPlanBuild,
} from '../arcApplicationService'
import {
  enrichContractEntryArtifactWithDirectionBacking,
  partitionContractEntryArtifactsByDirectionBacking,
} from '../sandbox/contractEntryArtifactNormalizer'
import { buildDistrictOpportunityProfiles } from '../../../engines/district'
import { buildContractEntryArtifactLineage } from '../../../domain/artifacts/contractEntryArtifact'
import type { ContractEntryArtifact } from '../../../domain/artifacts/contractEntryArtifact'
import { buildContractEntryArtifactFromVerifiedOpportunity } from '../../../domain/interpretation/buildContractEntryArtifactFromVerifiedOpportunity'
import { buildScenarioNightsFromCandidateBoard } from '../../../domain/interpretation/construction/scenarioBuilder'
import {
  buildStopTypeCandidateBoardFromIntent,
  resolveScenarioFamily,
} from '../../../domain/interpretation/discovery/stopTypeCandidateBoard'
import {
  mapBuiltScenarioNightToVerifiedOpportunity,
  type VerifiedCityOpportunity,
} from '../../../domain/interpretation/verifiedCityOpportunity'
import { buildLiveDistrictVerifiedCityOpportunity } from '../../../domain/interpretation/buildLiveDistrictVerifiedCityOpportunities'
import type { DistrictRecommendation } from '../../../domain/types/district'
import type { IntentInput } from '../../../domain/types/intent'
import type { StarterPack } from '../../../domain/types/starterPack'
import {
  assembleSandboxDirectionWorld,
  type AssembleSandboxDirectionWorldDependencies,
} from '../sandbox/sandboxDirectionOrchestrator'
import type {
  CuratePublicCardPrimaryDisplayMode,
  CuratePublicCardGateDiagnostics,
} from './buildCuratePublicCardGateDiagnostics'
import { buildCurateCommittedRouteFallbackDecision } from './buildCurateCommittedRouteFallback'

type StarterDebug = {
  starterMatchScore: number
}

type DiagnosticDistrictCard = {
  id: string
  name: string
  matchSignal?: string
  tasteAggregation?: DistrictRecommendation['tasteAggregation']
}

type PreDisplayBuildability = {
  tier: 'cached_committable' | 'full_support' | 'partial_support' | 'known_role_hole'
  score: number
  roleSupportByRole: Record<'start' | 'highlight' | 'windDown', number>
  missingRoles: Array<'start' | 'highlight' | 'windDown'>
}

export interface CurateScenarioCardGateDiagnostics
  extends Omit<
    CuratePublicCardGateDiagnostics,
    'extractionBoundary' | 'cardArtifactCandidateCount'
  > {
  artifactSource: 'scenario_artifact_path'
  scenarioArtifactCount: number
  displayArtifactCount: number
  cardArtifactCandidateCount: number
  selectedArtifactId: string | null
  scenarioArtifactRouteStops: string[] | null
  scenarioPath: {
    scenarioFamily: string | null
    scenarioBuiltNightCount: number
    scenarioBackedOpportunityCount: number
    admittedScenarioBackedOpportunityCount: number
    verifiedFallbackOpportunityCount: number
    fallbackArtifactCount: number
    suppressedDirectionUnbackedCount: number
  }
  extractionBoundary: {
    scenarioBackedArtifactConstructionMirrored: boolean
    displayArtifactSelectionMirrored: boolean
    qualificationProbeMirroredWithRunPlanBuild: boolean
    browserSelectionStateMirrored: boolean
    pageEffectTimingMirrored: boolean
  }
}

const city = 'San Jose'

const defaultEcsState = {
  exploration: 'focused',
  discovery: 'reliable',
  highlight: 'standout',
} as const

const directionWorldDependencies: AssembleSandboxDirectionWorldDependencies = {
  getDirectionTrajectoryHint: () => 'a diagnostic route with clear pacing.',
  getDirectionToneTag: (archetype) =>
    archetype === 'lively' ? 'Active' : archetype === 'cultural' ? 'Curated' : 'Calm',
  getDirectionProofLine: (candidate) => candidate.nearbyExamples.slice(0, 2).join(' - ') || candidate.pocketLabel,
  getStorySpineStartLine: () => 'Diagnostic start line.',
  getStorySpineHighlightLine: () => 'Diagnostic highlight line.',
  getStorySpineWindDownLine: () => 'Diagnostic wind-down line.',
  getStorySpineWhyThisWorksLine: () => 'Diagnostic route shape line.',
  getRouteShapeHints: () => ({
    grammarHint: 'Diagnostic grammar',
    movementHint: 'Diagnostic movement',
    swapHint: 'Diagnostic swap',
  }),
}

function buildStarterInput(starterPack: StarterPack): IntentInput {
  return {
    mode: 'curate',
    persona: starterPack.personaBias ?? null,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city,
    distanceMode: starterPack.distanceMode ?? 'nearby',
    prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
  }
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function lookupKeys(value: string | undefined): string[] {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return []
  }
  return [
    normalized,
    normalized.replace(/\s+/g, '-'),
    normalized.replace(/\s+/g, '_'),
  ]
}

function hasToken(corpus: string, value: unknown): boolean {
  const token = normalizeToken(value)
  return Boolean(token && corpus.includes(token))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function buildOpportunityCorpus(opportunity: VerifiedCityOpportunity): string {
  return [
    opportunity.flavor,
    opportunity.anchor.name,
    opportunity.anchor.district,
    ...opportunity.anchor.verificationReasons,
    ...opportunity.starts.flatMap((stop) => [stop.name, stop.reason]),
    ...(opportunity.highlightAlternates ?? []).flatMap((stop) => [stop.name, stop.reason]),
    ...opportunity.closes.flatMap((stop) => [stop.name, stop.reason]),
    opportunity.fit.confidenceLine,
    opportunity.fit.matchLine,
    opportunity.storySpine.start,
    opportunity.storySpine.highlight,
    opportunity.storySpine.windDown,
    ...(opportunity.scenarioNight?.stops.flatMap((stop) => [
      stop.name,
      stop.venueCategory,
      stop.venueSubcategory,
      stop.venueTypeLabel,
      ...(stop.venueFeatures ?? []),
      ...(stop.reasons ?? []),
      stop.whyThisStop,
    ]) ?? []),
  ].map(normalizeToken).filter(Boolean).join(' | ')
}

function getRoleCorpus(
  opportunity: VerifiedCityOpportunity,
  role: 'start' | 'highlight' | 'windDown',
): string {
  const scenarioStop = opportunity.scenarioNight?.stops.find((stop) =>
    role === 'start'
      ? stop.position === 'start'
      : role === 'highlight'
        ? stop.position === 'highlight'
        : stop.position === 'closer' || stop.position === 'windDown',
  )
  const stopOptions =
    role === 'start'
      ? opportunity.starts
      : role === 'highlight'
        ? [
            {
              venueId: opportunity.anchor.venueId,
              name: opportunity.anchor.name,
              reason: opportunity.anchor.verificationReasons.join(' '),
            },
            ...(opportunity.highlightAlternates ?? []),
          ]
        : opportunity.closes
  return [
    scenarioStop?.name,
    scenarioStop?.venueCategory,
    scenarioStop?.venueSubcategory,
    scenarioStop?.venueTypeLabel,
    ...(scenarioStop?.venueFeatures ?? []),
    ...(scenarioStop?.reasons ?? []),
    scenarioStop?.whyThisStop,
    ...stopOptions.flatMap((stop) => [stop.name, stop.reason]),
  ].map(normalizeToken).filter(Boolean).join(' | ')
}

function evaluateStarterOpportunity(params: {
  opportunity: VerifiedCityOpportunity
  starterPack: StarterPack
}): StarterDebug {
  const { opportunity, starterPack } = params
  const corpus = buildOpportunityCorpus(opportunity)
  const preferredCategories = starterPack.lensPreset?.preferredCategories ?? []
  const preferredTags = starterPack.lensPreset?.preferredTags ?? []
  const matchedPreferredCategories = preferredCategories.filter((category) =>
    hasToken(corpus, category),
  )
  const matchedPreferredTags = preferredTags.filter((tag) => hasToken(corpus, tag))
  const matchedPreferredStopShapes: string[] = []
  const preferredStopShapes = starterPack.lensPreset?.preferredStopShapes ?? {}
  ;(['start', 'highlight', 'windDown'] as const).forEach((role) => {
    const shape = preferredStopShapes[role]
    if (!shape) {
      return
    }
    const roleCorpus = getRoleCorpus(opportunity, role)
    const categoryMatch = (shape.preferredCategories ?? []).some((category) =>
      hasToken(roleCorpus, category),
    )
    const tagMatch = (shape.preferredTags ?? []).some((tag) => hasToken(roleCorpus, tag))
    if (categoryMatch || tagMatch) {
      matchedPreferredStopShapes.push(role)
    }
  })
  const roleContractMatches = Object.entries(starterPack.roleContracts ?? {}).filter(
    ([role, contract]) => {
      if (role !== 'start' && role !== 'highlight' && role !== 'windDown') {
        return false
      }
      const roleCorpus = getRoleCorpus(opportunity, role)
      return (
        (contract.requiredCategories ?? []).some((category) => hasToken(roleCorpus, category)) ||
        (contract.preferredCategories ?? []).some((category) => hasToken(roleCorpus, category)) ||
        (contract.requiredTags ?? []).some((tag) => hasToken(roleCorpus, tag)) ||
        (contract.preferredTags ?? []).some((tag) => hasToken(roleCorpus, tag))
      )
    },
  )
  const secondaryAnchorMatch = (starterPack.secondaryAnchors ?? []).some((anchor) =>
    hasToken(corpus, anchor),
  )
  const distanceModeMatch =
    starterPack.distanceMode === 'short-drive'
      ? Boolean(opportunity.districtContext.secondaryDistricts?.length) ||
        normalizeToken(starterPack.lensPreset?.movementTolerance).includes('high')
      : starterPack.distanceMode === 'nearby'
        ? !opportunity.districtContext.secondaryDistricts?.length
        : Boolean(starterPack.distanceMode)
  const categoryScore =
    preferredCategories.length > 0
      ? matchedPreferredCategories.length / preferredCategories.length
      : 0
  const tagScore =
    preferredTags.length > 0 ? matchedPreferredTags.length / preferredTags.length : 0
  const stopShapeCount = Object.keys(preferredStopShapes).length
  const stopShapeScore =
    stopShapeCount > 0 ? matchedPreferredStopShapes.length / stopShapeCount : 0
  const roleContractCount = Object.keys(starterPack.roleContracts ?? {}).length
  const roleContractScore =
    roleContractCount > 0 ? roleContractMatches.length / roleContractCount : 0
  return {
    starterMatchScore: clampScore(
      categoryScore * 0.24 +
        tagScore * 0.24 +
        stopShapeScore * 0.24 +
        roleContractScore * 0.12 +
        (secondaryAnchorMatch ? 0.08 : 0) +
        (distanceModeMatch ? 0.08 : 0),
    ),
  }
}

function getDiversityKey(opportunity: VerifiedCityOpportunity): string {
  return [
    opportunity.selection.directionId ?? 'no_direction',
    opportunity.anchor.venueId,
    opportunity.storySpine.start,
    opportunity.storySpine.highlight,
    opportunity.storySpine.windDown,
  ].map(normalizeToken).join('|')
}

function selectStarterAwareOpportunities(params: {
  opportunities: VerifiedCityOpportunity[]
  starterPack: StarterPack
  targetCount: number
}): {
  opportunities: VerifiedCityOpportunity[]
  rankedOpportunities: VerifiedCityOpportunity[]
  debugByOpportunityId: Map<string, StarterDebug>
} {
  const debugByOpportunityId = new Map<string, StarterDebug>()
  const ranked = params.opportunities
    .map((opportunity, index) => {
      const debug = evaluateStarterOpportunity({ opportunity, starterPack: params.starterPack })
      debugByOpportunityId.set(opportunity.id, debug)
      return { opportunity, debug, index }
    })
    .sort((left, right) => {
      if (right.debug.starterMatchScore !== left.debug.starterMatchScore) {
        return right.debug.starterMatchScore - left.debug.starterMatchScore
      }
      if (right.opportunity.excellence.score !== left.opportunity.excellence.score) {
        return right.opportunity.excellence.score - left.opportunity.excellence.score
      }
      return left.index - right.index
    })
  const selected: VerifiedCityOpportunity[] = []
  const selectedDirectionIds = new Set<string>()
  const selectedAnchorVenueIds = new Set<string>()
  const selectedStoryFingerprints = new Set<string>()
  const addIfDiverse = (entry: (typeof ranked)[number], allowDuplicates: boolean) => {
    if (selected.length >= params.targetCount) {
      return
    }
    const directionId = entry.opportunity.selection.directionId ?? ''
    const storyFingerprint = getDiversityKey(entry.opportunity)
    const duplicate =
      (directionId && selectedDirectionIds.has(directionId)) ||
      selectedAnchorVenueIds.has(entry.opportunity.anchor.venueId) ||
      selectedStoryFingerprints.has(storyFingerprint)
    if (duplicate && !allowDuplicates) {
      return
    }
    selected.push(entry.opportunity)
    if (directionId) {
      selectedDirectionIds.add(directionId)
    }
    selectedAnchorVenueIds.add(entry.opportunity.anchor.venueId)
    selectedStoryFingerprints.add(storyFingerprint)
  }
  ranked.forEach((entry) => addIfDiverse(entry, false))
  ranked.forEach((entry) => addIfDiverse(entry, true))
  return {
    opportunities: selected,
    rankedOpportunities: ranked.map((entry) => entry.opportunity),
    debugByOpportunityId,
  }
}

function buildPreDisplayBuildability(params: {
  artifacts: ContractEntryArtifact[]
  opportunityById: Map<string, VerifiedCityOpportunity>
}): Map<string, PreDisplayBuildability> {
  const byArtifactId = new Map<string, PreDisplayBuildability>()
  params.artifacts.forEach((artifact) => {
    if (byArtifactId.has(artifact.id)) {
      return
    }
    const opportunity = params.opportunityById.get(artifact.sourceOpportunityId)
    const roleSupportByRole = {
      start: opportunity?.starts.length ?? 0,
      highlight:
        (artifact.anchorName.trim() ? 1 : 0) + (opportunity?.highlightAlternates?.length ?? 0),
      windDown: opportunity?.closes.length ?? 0,
    }
    const missingRoles = (['start', 'highlight', 'windDown'] as const).filter(
      (role) => roleSupportByRole[role] === 0,
    )
    let tier: PreDisplayBuildability['tier'] = 'full_support'
    let score =
      roleSupportByRole.start * 18 +
      roleSupportByRole.highlight * 12 +
      roleSupportByRole.windDown * 24
    if (missingRoles.length === 0) {
      score += 200
    } else if (
      roleSupportByRole.start > 0 ||
      roleSupportByRole.highlight > 0 ||
      roleSupportByRole.windDown > 0
    ) {
      tier = 'partial_support'
      score -= 120 * missingRoles.length
    } else {
      tier = 'known_role_hole'
      score -= 300
    }
    if (roleSupportByRole.windDown === 0) {
      score -= 160
      if (tier === 'full_support') {
        tier = 'partial_support'
      }
    }
    byArtifactId.set(artifact.id, {
      tier,
      score,
      roleSupportByRole,
      missingRoles,
    })
  })
  return byArtifactId
}

function storySpineFingerprint(artifact: Pick<ContractEntryArtifact, 'storySpine'>): string {
  return [
    artifact.storySpine.start,
    artifact.storySpine.highlight,
    artifact.storySpine.windDown,
  ].map(normalizeToken).join('>')
}

function getArtifactIdentityKey(artifact: ContractEntryArtifact): string {
  if (artifact.id.trim()) {
    return `artifact:${artifact.id}`
  }
  if (artifact.sourceOpportunityId.trim()) {
    return `source:${artifact.sourceOpportunityId}`
  }
  if (artifact.anchorVenueId.trim()) {
    return `anchor:${artifact.anchorVenueId}`
  }
  const storyFingerprint = storySpineFingerprint(artifact)
  if (storyFingerprint.trim()) {
    return `story:${storyFingerprint}`
  }
  const directionId = artifact.selection.directionId?.trim()
  if (directionId) {
    return `direction:${directionId}|title:${normalizeToken(artifact.routeTitle)}`
  }
  return `title:${normalizeToken(artifact.routeTitle)}`
}

function buildDisplayArtifacts(params: {
  primaryArtifacts: ContractEntryArtifact[]
  fallbackArtifacts: ContractEntryArtifact[]
  buildabilityByArtifactId: Map<string, PreDisplayBuildability>
}): ContractEntryArtifact[] {
  const desiredCount = params.primaryArtifacts.length
  const dedupedBefore: ContractEntryArtifact[] = []
  const seenIdentityKeys = new Set<string>()
  params.primaryArtifacts.forEach((artifact) => {
    const identityKey = getArtifactIdentityKey(artifact)
    if (seenIdentityKeys.has(identityKey)) {
      return
    }
    seenIdentityKeys.add(identityKey)
    dedupedBefore.push(artifact)
  })
  const tierPriority = (tier: PreDisplayBuildability['tier']): number => {
    switch (tier) {
      case 'cached_committable':
        return 0
      case 'full_support':
        return 1
      case 'partial_support':
        return 2
      case 'known_role_hole':
        return 3
    }
  }
  const rankedUniqueCandidates = [...dedupedBefore, ...params.fallbackArtifacts]
    .map((artifact, index) => ({
      artifact,
      index,
      identityKey: getArtifactIdentityKey(artifact),
      buildability:
        params.buildabilityByArtifactId.get(artifact.id) ?? {
          tier: 'known_role_hole',
          score: -999,
          roleSupportByRole: { start: 0, highlight: 0, windDown: 0 },
          missingRoles: ['start', 'highlight', 'windDown'],
        },
    }))
    .filter((entry, index, list) =>
      list.findIndex((candidate) => candidate.identityKey === entry.identityKey) === index,
    )
    .sort((left, right) => {
      const leftPriority = tierPriority(left.buildability.tier)
      const rightPriority = tierPriority(right.buildability.tier)
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }
      if (right.buildability.score !== left.buildability.score) {
        return right.buildability.score - left.buildability.score
      }
      return left.index - right.index
    })
  const selectedIdentityKeys = new Set<string>()
  const finalArtifacts: ContractEntryArtifact[] = []
  rankedUniqueCandidates.forEach((entry) => {
    if (finalArtifacts.length >= desiredCount || selectedIdentityKeys.has(entry.identityKey)) {
      return
    }
    selectedIdentityKeys.add(entry.identityKey)
    finalArtifacts.push(entry.artifact)
  })
  return finalArtifacts
}

function buildSelectedArtifactDiscoveryPreferences(params: {
  artifact: ContractEntryArtifact
  opportunity?: VerifiedCityOpportunity
}): NonNullable<IntentInput['discoveryPreferences']> | undefined {
  const preferences = new Map<string, NonNullable<IntentInput['discoveryPreferences']>[number]>()
  const addPreference = (
    venueId: string | undefined,
    role: NonNullable<IntentInput['discoveryPreferences']>[number]['role'],
  ) => {
    const normalizedVenueId = venueId?.trim()
    if (!normalizedVenueId) {
      return
    }
    preferences.set(normalizedVenueId, { venueId: normalizedVenueId, role })
  }
  const scenarioStart = params.opportunity?.scenarioNight?.stops.find(
    (stop) => stop.position === 'start',
  )
  const scenarioHighlight = params.opportunity?.scenarioNight?.stops.find(
    (stop) => stop.position === 'highlight',
  )
  const scenarioWindDown =
    params.opportunity?.scenarioNight?.stops.find((stop) => stop.position === 'closer') ??
    params.opportunity?.scenarioNight?.stops[
      params.opportunity.scenarioNight.stops.length - 1
    ]
  addPreference(scenarioStart?.venueId ?? params.opportunity?.starts[0]?.venueId, 'start')
  addPreference(
    scenarioHighlight?.venueId ?? params.artifact.anchorVenueId ?? params.opportunity?.anchor.venueId,
    params.artifact.anchorRole ?? 'highlight',
  )
  addPreference(scenarioWindDown?.venueId ?? params.opportunity?.closes[0]?.venueId, 'windDown')
  return preferences.size > 0 ? [...preferences.values()] : undefined
}

function resolvePrimaryCardDisplayMode(params: {
  qualifiedVisibleCardCount: number
  checkingCount: number
}): CuratePublicCardPrimaryDisplayMode {
  if (params.qualifiedVisibleCardCount > 0) {
    return 'qualified_only'
  }
  if (params.checkingCount > 0) {
    return 'checking'
  }
  return 'no_qualified_fallback'
}

async function qualifyArtifact(params: {
  starterPack: StarterPack
  artifact: ContractEntryArtifact
  opportunity?: VerifiedCityOpportunity
}): Promise<CurateScenarioCardGateDiagnostics['selectedCuratePreviewCommitability'] & {
  hasApprovedPayload: boolean
  sourceMode: CurateScenarioCardGateDiagnostics['sourceMode']
}> {
  const directionId = params.artifact.selection.directionId
  const qualificationResult = await runPlanBuild(
    {
      ...buildStarterInput(params.starterPack),
      selectedDirectionContext: directionId
        ? {
            directionId,
            pocketId: params.artifact.selection.pocketId,
            label: params.artifact.routeTitle,
          }
        : undefined,
      discoveryPreferences: buildSelectedArtifactDiscoveryPreferences(params),
    },
    {
      starterPack: params.starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
      curateCommitSemantics: 'seed_guided',
      selectedArtifactLineage: buildContractEntryArtifactLineage(params.artifact),
    },
  )
  const liveSource = qualificationResult.trace.retrievalDiagnostics.liveSource
  const hardCommit = qualificationResult.trace.curateHardCommit
  const hardCommitPreservationSucceeded =
    hardCommit?.hardCommitPreservationSucceeded === true
  const status = hardCommitPreservationSucceeded ? 'committable' : 'infeasible'
  return {
    status,
    hardCommitCandidateCount: hardCommit?.hardCommitCandidateCount ?? 0,
    missingRoleForContract: hardCommit?.failedRoles[0] ?? null,
    failedCheck:
      status === 'committable' ? null : 'curateHardCommit.hardCommitPreservationSucceeded',
    failedReason:
      status === 'committable'
        ? null
        : hardCommit?.explicitFallbackReason ?? 'Scenario artifact was not preserved.',
    hasApprovedPayload: status === 'committable',
    sourceMode: {
      requestedMode: liveSource.requestedMode,
      effectiveMode: liveSource.effectiveMode,
      liveFetchAttempted: liveSource.liveFetchAttempted,
      liveCount: liveSource.countsBySource.live,
    },
  }
}

export async function buildCurateScenarioCardGateDiagnostics(params: {
  starterPack: StarterPack
  fetchCallCount: () => number
}): Promise<CurateScenarioCardGateDiagnostics> {
  const persona = params.starterPack.personaBias ?? 'romantic'
  const primaryVibe = params.starterPack.primaryAnchor
  const directResult = await runPlanBuild(buildStarterInput(params.starterPack), {
    starterPack: params.starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
  })
  const directRouteStops = directResult.selectedArc.stops.map(
    (stop) => `${stop.role}:${stop.scoredVenue.venue.name}`,
  )
  const directLiveSource = directResult.trace.retrievalDiagnostics.liveSource
  const directFallbackDecision = buildCurateCommittedRouteFallbackDecision({
    starterPack: params.starterPack,
    result: directResult,
    selectedDirectionId:
      directResult.intentProfile.selectedDirectionContext?.directionId ??
      `diagnostic_direction_${params.starterPack.id}`,
    selectedPocketId: directResult.intentProfile.selectedDirectionContext?.pocketId,
  })
  const scenarioFamily = resolveScenarioFamily({ city, persona, vibe: primaryVibe })
  const districtPreviewResult = await buildDistrictOpportunityProfiles({
    locationQuery: city,
    includeDebug: true,
  })
  const districtRecommendationResult = await previewDistrictRecommendationsForPlanBuild({
    persona,
    primaryVibe,
    city,
    distanceMode: params.starterPack.distanceMode ?? 'nearby',
  })
  const scenarioCandidateBoard = await buildStopTypeCandidateBoardFromIntent({
    city,
    persona,
    vibe: primaryVibe,
    sourceMode: 'curated',
  })
  const scenarioBuiltNights = scenarioCandidateBoard
    ? buildScenarioNightsFromCandidateBoard(scenarioCandidateBoard)
    : []
  const directionWorld = assembleSandboxDirectionWorld(
    {
      persona,
      primaryVibe,
      districtLocationQuery: city,
      districtPreviewResult,
      resolvedScenarioFamily: scenarioFamily,
      scenarioBuiltNights,
    },
    directionWorldDependencies,
  )
  const recommendationByLookupKey = new Map<string, DistrictRecommendation>()
  districtRecommendationResult.recommendedDistricts.forEach((recommendation) => {
    ;[...lookupKeys(recommendation.districtId), ...lookupKeys(recommendation.label)].forEach(
      (key) => {
        if (!recommendationByLookupKey.has(key)) {
          recommendationByLookupKey.set(key, recommendation)
        }
      },
    )
  })
  const districtDiscoveryCards: DiagnosticDistrictCard[] = districtPreviewResult.ranked
    .slice(0, 6)
    .map((entry) => {
      const profile = entry.profile
      const recommendation = [
        ...lookupKeys(profile.meta.sourcePocketId),
        ...lookupKeys(profile.pocketId),
        ...lookupKeys(profile.label),
      ]
        .map((key) => recommendationByLookupKey.get(key))
        .find((candidate): candidate is DistrictRecommendation => Boolean(candidate))
      return {
        id: profile.pocketId,
        name: profile.label,
        matchSignal: recommendation?.districtExplanation.summary ?? recommendation?.reason,
        tasteAggregation: recommendation?.tasteAggregation,
      }
    })
  const scenarioBackedOpportunities = scenarioBuiltNights
    .map((night) =>
      mapBuiltScenarioNightToVerifiedOpportunity({
        night,
        districtDiscoveryCards,
        directionCards: directionWorld.allDirectionCards,
        personaLabel: persona,
        vibeLabel: primaryVibe,
        expandedProjection: false,
        contractConstraints: directionWorld.canonicalContractConstraints,
      }),
    )
    .filter((entry): entry is VerifiedCityOpportunity => Boolean(entry))
  const admittedScenarioBackedOpportunities = scenarioBackedOpportunities.filter((opportunity) => {
    const artifact = buildContractEntryArtifactFromVerifiedOpportunity({
      opportunity,
      ecsState: defaultEcsState,
      useScenarioBackedArtifacts: true,
    })
    if (!artifact) {
      return false
    }
    return enrichContractEntryArtifactWithDirectionBacking({
      artifact,
      directionCards: directionWorld.allDirectionCards,
      allDirectionCards: directionWorld.allDirectionCards,
    }).directionBacking.status === 'backed'
  })
  const directionCardsByPocketId = new Map<string, typeof directionWorld.allDirectionCards>()
  directionWorld.allDirectionCards.forEach((card) => {
    const pocketId = card.debugMeta?.pocketId ?? card.id
    const current = directionCardsByPocketId.get(pocketId) ?? []
    current.push(card)
    directionCardsByPocketId.set(pocketId, current)
  })
  const verifiedFallbackOpportunities = districtDiscoveryCards
    .map((district) =>
      buildLiveDistrictVerifiedCityOpportunity({
        district,
        directionCards: directionCardsByPocketId.get(district.id) ?? [],
        scenarioContract: null,
        experienceContract: null,
        ecsState: defaultEcsState,
        city,
        persona,
        vibe: primaryVibe,
        personaLabel: persona,
        vibeLabel: primaryVibe,
        roleProjectionDepth: 2,
        sourceMode: 'curated',
      }),
    )
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.card.id.localeCompare(right.card.id)
    })
    .map((entry) => entry.card)
  const step2PrimarySourceOpportunities =
    scenarioFamily && admittedScenarioBackedOpportunities.length > 0
      ? admittedScenarioBackedOpportunities
      : verifiedFallbackOpportunities
  const starterAware = selectStarterAwareOpportunities({
    opportunities: step2PrimarySourceOpportunities,
    starterPack: params.starterPack,
    targetCount:
      step2PrimarySourceOpportunities.length > 3
        ? 4
        : Math.max(2, step2PrimarySourceOpportunities.length),
  })
  const opportunityById = new Map(
    [...admittedScenarioBackedOpportunities, ...verifiedFallbackOpportunities].map(
      (opportunity) => [opportunity.id, opportunity] as const,
    ),
  )
  const buildArtifact = (opportunity: VerifiedCityOpportunity) => {
    const artifact = buildContractEntryArtifactFromVerifiedOpportunity({
      opportunity,
      ecsState: defaultEcsState,
      useScenarioBackedArtifacts: true,
    })
    return artifact
      ? enrichContractEntryArtifactWithDirectionBacking({
          artifact,
          directionCards: directionWorld.allDirectionCards,
          allDirectionCards: directionWorld.allDirectionCards,
        })
      : null
  }
  const scenarioArtifacts = starterAware.opportunities
    .map(buildArtifact)
    .filter((artifact): artifact is NonNullable<typeof artifact> => Boolean(artifact))
  const fallbackArtifacts = starterAware.rankedOpportunities
    .map(buildArtifact)
    .filter((artifact): artifact is NonNullable<typeof artifact> => Boolean(artifact))
  const primaryPartition = partitionContractEntryArtifactsByDirectionBacking(scenarioArtifacts)
  const fallbackPartition = partitionContractEntryArtifactsByDirectionBacking(fallbackArtifacts)
  const buildabilityByArtifactId = buildPreDisplayBuildability({
    artifacts: [...scenarioArtifacts, ...fallbackArtifacts],
    opportunityById,
  })
  const qualificationCandidateArtifacts = [...scenarioArtifacts, ...fallbackArtifacts]
    .map((artifact, index) => ({
      artifact,
      index,
      starterScore: starterAware.debugByOpportunityId.get(artifact.sourceOpportunityId)?.starterMatchScore ?? 0,
      buildability: buildabilityByArtifactId.get(artifact.id)?.score ?? Number.NEGATIVE_INFINITY,
    }))
    .filter(
      (entry, index, list) =>
        list.findIndex((candidate) => candidate.artifact.id === entry.artifact.id) === index,
    )
    .sort((left, right) => {
      if (right.buildability !== left.buildability) {
        return right.buildability - left.buildability
      }
      if (right.starterScore !== left.starterScore) {
        return right.starterScore - left.starterScore
      }
      return left.index - right.index
    })
    .slice(0, 8)
    .map((entry) => entry.artifact)
  const displayArtifacts = buildDisplayArtifacts({
    primaryArtifacts: primaryPartition.backedArtifacts,
    fallbackArtifacts: fallbackPartition.backedArtifacts,
    buildabilityByArtifactId,
  })
  const selectedArtifact = displayArtifacts[0] ?? qualificationCandidateArtifacts[0] ?? null
  const selectedOpportunity = selectedArtifact
    ? opportunityById.get(selectedArtifact.sourceOpportunityId)
    : undefined
  const qualification = selectedArtifact
    ? await qualifyArtifact({
        starterPack: params.starterPack,
        artifact: selectedArtifact,
        opportunity: selectedOpportunity,
      })
    : null
  const hasApprovedPayload = qualification?.hasApprovedPayload === true
  const qualifiedVisibleCardCount = hasApprovedPayload ? 1 : 0
  const rejectedVisibleCardCount = selectedArtifact && !hasApprovedPayload ? 1 : 0
  const primaryCardDisplayMode = resolvePrimaryCardDisplayMode({
    qualifiedVisibleCardCount,
    checkingCount: 0,
  })

  return {
    starterId: params.starterPack.id,
    artifactSource: 'scenario_artifact_path',
    publicCardGateReached: true,
    directPlannerGenerated: true,
    directPlannerRouteStops: directRouteStops,
    cardArtifactCandidateCount: scenarioArtifacts.length,
    scenarioArtifactCount: scenarioArtifacts.length,
    displayArtifactCount: displayArtifacts.length,
    qualificationCandidateCount: qualificationCandidateArtifacts.length,
    qualifiedVisibleCardCount,
    rejectedVisibleCardCount,
    primaryCardDisplayMode,
    hasApprovedPayload,
    selectedArtifactId: selectedArtifact?.id ?? null,
    selectedCuratePreviewCommitability: qualification
      ? {
          status: qualification.status,
          hardCommitCandidateCount: qualification.hardCommitCandidateCount,
          missingRoleForContract: qualification.missingRoleForContract,
          failedCheck: qualification.failedCheck,
          failedReason: qualification.failedReason,
        }
      : {
          status: 'not_run',
          hardCommitCandidateCount: null,
          missingRoleForContract: null,
          failedCheck: 'scenarioArtifact.none',
          failedReason: 'No scenario artifact was available to qualify.',
        },
    noQualifiedFallback: primaryCardDisplayMode === 'no_qualified_fallback',
    selectedInfeasible: qualification?.status === 'infeasible',
    committedRouteFallback: {
      status: directFallbackDecision.status,
      rejectedReason:
        directFallbackDecision.status === 'rejected'
          ? directFallbackDecision.rejectedReason
          : null,
    },
    scenarioArtifactRouteStops: selectedArtifact
      ? [
          `start:${selectedArtifact.storySpine.start}`,
          `highlight:${selectedArtifact.storySpine.highlight}`,
          `windDown:${selectedArtifact.storySpine.windDown}`,
        ]
      : null,
    sourceMode: qualification?.sourceMode ?? {
      requestedMode: directLiveSource.requestedMode,
      effectiveMode: directLiveSource.effectiveMode,
      liveFetchAttempted: directLiveSource.liveFetchAttempted,
      liveCount: directLiveSource.countsBySource.live,
    },
    fetchCallCount: params.fetchCallCount(),
    scenarioPath: {
      scenarioFamily: scenarioFamily ?? null,
      scenarioBuiltNightCount: scenarioBuiltNights.length,
      scenarioBackedOpportunityCount: scenarioBackedOpportunities.length,
      admittedScenarioBackedOpportunityCount: admittedScenarioBackedOpportunities.length,
      verifiedFallbackOpportunityCount: verifiedFallbackOpportunities.length,
      fallbackArtifactCount: fallbackArtifacts.length,
      suppressedDirectionUnbackedCount:
        primaryPartition.suppressedUnbackedArtifacts.length +
        fallbackPartition.suppressedUnbackedArtifacts.length,
    },
    extractionBoundary: {
      scenarioBackedArtifactConstructionMirrored: true,
      displayArtifactSelectionMirrored: true,
      qualificationProbeMirroredWithRunPlanBuild: true,
      browserSelectionStateMirrored: false,
      pageEffectTimingMirrored: false,
    },
  }
}
