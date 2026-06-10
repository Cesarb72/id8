import { runPlanBuild } from '../arcApplicationService'
import {
  buildCurateCommittedRouteFallbackDecision,
  buildCurateStarterPlannerInput,
  type CurateCommittedRouteFallbackRejectedReason,
} from './buildCurateCommittedRouteFallback'
import {
  buildContractEntryArtifactLineage,
  type ContractEntryArtifact,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { GeneratePlanResult } from '../../../domain/runGeneratePlan'
import type {
  DiscoveryPreferenceRole,
  IntentInput,
  PreferredDiscoveryVenue,
  SelectedDirectionContext,
} from '../../../domain/types/intent'
import type { StarterPack } from '../../../domain/types/starterPack'

export type CuratePublicCardPrimaryDisplayMode =
  | 'qualified_only'
  | 'checking'
  | 'no_qualified_fallback'

export interface CuratePublicCardGateDiagnostics {
  starterId: string
  publicCardGateReached: boolean
  directPlannerGenerated: boolean
  directPlannerRouteStops: string[]
  cardArtifactCandidateCount: number
  qualificationCandidateCount: number
  qualifiedVisibleCardCount: number
  rejectedVisibleCardCount: number
  primaryCardDisplayMode: CuratePublicCardPrimaryDisplayMode
  hasApprovedPayload: boolean
  selectedCuratePreviewCommitability: {
    status: 'committable' | 'infeasible' | 'not_run'
    hardCommitCandidateCount: number | null
    missingRoleForContract: string | null
    failedCheck: string | null
    failedReason: string | null
  }
  noQualifiedFallback: boolean
  selectedInfeasible: boolean
  committedRouteFallback: {
    status: 'accepted' | 'rejected'
    rejectedReason: CurateCommittedRouteFallbackRejectedReason | null
  }
  sourceMode: {
    requestedMode: string | null
    effectiveMode: string | null
    liveFetchAttempted: boolean | null
    liveCount: number | null
  }
  fetchCallCount: number
  extractionBoundary: {
    cardDisplayDecisionExtracted: boolean
    artifactSource: 'diagnostic_direct_planner_projection'
    pageScenarioArtifactConstructionMirrored: boolean
    postPlannerParityMirrored: boolean
  }
}

interface PlannedRoleStop {
  role: DiscoveryPreferenceRole
  venueId: string
  name: string
}

type PlannerStopRole = GeneratePlanResult['selectedArc']['stops'][number]['role']

const rolePreferenceOrder: Record<DiscoveryPreferenceRole, PlannerStopRole[]> = {
  start: ['warmup'],
  highlight: ['peak'],
  windDown: ['cooldown'],
}

function buildDiagnosticDirectionContext(starterPack: StarterPack): SelectedDirectionContext {
  return {
    directionId: `diagnostic_direction_${starterPack.id}`,
    label: starterPack.title,
    archetype: starterPack.primaryAnchor,
  }
}

function findPlannedRoleStop(
  result: GeneratePlanResult,
  role: DiscoveryPreferenceRole,
): PlannedRoleStop | null {
  const acceptedRoles = rolePreferenceOrder[role]
  const stop = result.selectedArc.stops.find((candidate) =>
    acceptedRoles.includes(candidate.role),
  )
  if (!stop) {
    return null
  }
  return {
    role,
    venueId: stop.scoredVenue.venue.id,
    name: stop.scoredVenue.venue.name,
  }
}

function buildDiagnosticArtifact(
  starterPack: StarterPack,
  result: GeneratePlanResult,
): {
  artifact: ContractEntryArtifact | null
  discoveryPreferences: PreferredDiscoveryVenue[]
  missingRoles: DiscoveryPreferenceRole[]
} {
  const start = findPlannedRoleStop(result, 'start')
  const highlight = findPlannedRoleStop(result, 'highlight')
  const windDown = findPlannedRoleStop(result, 'windDown')
  const roleStops = [start, highlight, windDown].filter(
    (stop): stop is PlannedRoleStop => Boolean(stop),
  )
  const missingRoles = (['start', 'highlight', 'windDown'] as const).filter(
    (role) => !roleStops.some((stop) => stop.role === role),
  )
  const discoveryPreferences = roleStops.map((stop) => ({
    venueId: stop.venueId,
    role: stop.role,
  }))

  if (!highlight) {
    return {
      artifact: null,
      discoveryPreferences,
      missingRoles,
    }
  }

  const directionId = result.intentProfile.selectedDirectionContext?.directionId
    ?? buildDiagnosticDirectionContext(starterPack).directionId
  const pocketId = result.intentProfile.selectedDirectionContext?.pocketId
  const routeSummary =
    result.itinerary.storySpine?.routeSummary ?? result.itinerary.shareSummary
  const artifact: ContractEntryArtifact = {
    id: `diagnostic_${starterPack.id}`,
    sourceOpportunityId: `diagnostic_${starterPack.id}`,
    sourceMode: 'curated',
    anchorVenueId: highlight.venueId,
    anchorRole: 'highlight',
    anchorName: highlight.name,
    routeTitle: `${starterPack.title} diagnostic route`,
    flavorLine: starterPack.description,
    routeSummary,
    traits: [starterPack.primaryAnchor, ...(starterPack.secondaryAnchors ?? [])],
    storySpine: {
      start: start?.name ?? 'missing start',
      highlight: highlight.name,
      windDown: windDown?.name ?? 'missing wind-down',
    },
    districtLine: 'Mostly in San Jose',
    districtAnchorLine: 'District anchor: San Jose',
    authorityLine: 'Diagnostic route artifact projected from direct planner output.',
    whyChooseLine: routeSummary,
    selection: {
      ...(directionId ? { directionId } : {}),
      ...(pocketId ? { pocketId } : {}),
    },
  }

  return {
    artifact,
    discoveryPreferences,
    missingRoles,
  }
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

export async function buildCuratePublicCardGateDiagnostics(params: {
  starterPack: StarterPack
  fetchCallCount: () => number
}): Promise<CuratePublicCardGateDiagnostics> {
  const directResult = await runPlanBuild(buildCurateStarterPlannerInput(params.starterPack), {
    starterPack: params.starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
  })
  const directLiveSource = directResult.trace.retrievalDiagnostics.liveSource
  const directRouteStops = directResult.selectedArc.stops.map(
    (stop) => `${stop.role}:${stop.scoredVenue.venue.name}`,
  )
  const { artifact, discoveryPreferences, missingRoles } = buildDiagnosticArtifact(
    params.starterPack,
    directResult,
  )
  const fallbackDecision = buildCurateCommittedRouteFallbackDecision({
    starterPack: params.starterPack,
    result: directResult,
    selectedDirectionId:
      directResult.intentProfile.selectedDirectionContext?.directionId ??
      buildDiagnosticDirectionContext(params.starterPack).directionId,
    selectedPocketId: directResult.intentProfile.selectedDirectionContext?.pocketId,
  })
  const cardArtifactCandidateCount = artifact ? 1 : 0
  const qualificationCandidateCount = artifact ? 1 : 0

  if (!artifact) {
    return {
      starterId: params.starterPack.id,
      publicCardGateReached: true,
      directPlannerGenerated: true,
      directPlannerRouteStops: directRouteStops,
      cardArtifactCandidateCount,
      qualificationCandidateCount,
      qualifiedVisibleCardCount: 0,
      rejectedVisibleCardCount: 1,
      primaryCardDisplayMode: 'no_qualified_fallback',
      hasApprovedPayload: false,
      selectedCuratePreviewCommitability: {
        status: 'infeasible',
        hardCommitCandidateCount: 0,
        missingRoleForContract: missingRoles[0] ?? 'highlight',
        failedCheck: 'diagnosticArtifact.highlight',
        failedReason: 'Diagnostic artifact could not identify a highlight stop.',
      },
      noQualifiedFallback: true,
      selectedInfeasible: true,
      committedRouteFallback: {
        status: fallbackDecision.status,
        rejectedReason:
          fallbackDecision.status === 'rejected' ? fallbackDecision.rejectedReason : null,
      },
      sourceMode: {
        requestedMode: directLiveSource.requestedMode,
        effectiveMode: directLiveSource.effectiveMode,
        liveFetchAttempted: directLiveSource.liveFetchAttempted,
        liveCount: directLiveSource.countsBySource.live,
      },
      fetchCallCount: params.fetchCallCount(),
      extractionBoundary: {
        cardDisplayDecisionExtracted: true,
        artifactSource: 'diagnostic_direct_planner_projection',
        pageScenarioArtifactConstructionMirrored: false,
        postPlannerParityMirrored: false,
      },
    }
  }

  const qualificationInput: IntentInput = {
    ...buildCurateStarterPlannerInput(params.starterPack),
    selectedDirectionContext: buildDiagnosticDirectionContext(params.starterPack),
    discoveryPreferences,
  }
  const qualificationResult = await runPlanBuild(qualificationInput, {
    starterPack: params.starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
    curateCommitSemantics: 'seed_guided',
    selectedArtifactLineage: buildContractEntryArtifactLineage(artifact),
  })
  const qualificationLiveSource = qualificationResult.trace.retrievalDiagnostics.liveSource
  const hardCommit = qualificationResult.trace.curateHardCommit
  const hardCommitCandidateCount = hardCommit?.hardCommitCandidateCount ?? 0
  const hardCommitPreservationSucceeded =
    hardCommit?.hardCommitPreservationSucceeded === true
  const missingRoleForContract = missingRoles[0] ?? hardCommit?.failedRoles[0] ?? null
  const status =
    hardCommitPreservationSucceeded && missingRoles.length === 0
      ? 'committable'
      : 'infeasible'
  const hasApprovedPayload = status === 'committable'
  const qualifiedVisibleCardCount = hasApprovedPayload ? 1 : 0
  const rejectedVisibleCardCount = hasApprovedPayload ? 0 : 1
  const primaryCardDisplayMode = resolvePrimaryCardDisplayMode({
    qualifiedVisibleCardCount,
    checkingCount: 0,
  })
  const failedCheck =
    status === 'committable'
      ? null
      : missingRoles.length > 0
        ? `diagnosticArtifact.${missingRoles[0]}`
        : 'curateHardCommit.hardCommitPreservationSucceeded'
  const failedReason =
    status === 'committable'
      ? null
      : missingRoles.length > 0
        ? `Diagnostic artifact is missing role support: ${missingRoles.join(', ')}.`
        : hardCommit?.explicitFallbackReason ?? 'Projected diagnostic artifact was not preserved.'

  return {
    starterId: params.starterPack.id,
    publicCardGateReached: true,
    directPlannerGenerated: true,
    directPlannerRouteStops: directRouteStops,
    cardArtifactCandidateCount,
    qualificationCandidateCount,
    qualifiedVisibleCardCount,
    rejectedVisibleCardCount,
    primaryCardDisplayMode,
    hasApprovedPayload,
    selectedCuratePreviewCommitability: {
      status,
      hardCommitCandidateCount,
      missingRoleForContract,
      failedCheck,
      failedReason,
    },
    noQualifiedFallback: primaryCardDisplayMode === 'no_qualified_fallback',
    selectedInfeasible: status === 'infeasible',
    committedRouteFallback: {
      status: fallbackDecision.status,
      rejectedReason:
        fallbackDecision.status === 'rejected' ? fallbackDecision.rejectedReason : null,
    },
    sourceMode: {
      requestedMode: qualificationLiveSource.requestedMode,
      effectiveMode: qualificationLiveSource.effectiveMode,
      liveFetchAttempted: qualificationLiveSource.liveFetchAttempted,
      liveCount: qualificationLiveSource.countsBySource.live,
    },
    fetchCallCount: params.fetchCallCount(),
    extractionBoundary: {
      cardDisplayDecisionExtracted: true,
      artifactSource: 'diagnostic_direct_planner_projection',
      pageScenarioArtifactConstructionMirrored: false,
      postPlannerParityMirrored: false,
    },
  }
}
