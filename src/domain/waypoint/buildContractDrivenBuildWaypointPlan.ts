import { projectConciergeIntentToIntentInput } from '../interpretation/projectConciergeIntentToIntentInput'
import type { ContractEntryArtifactLineage } from '../artifacts/contractEntryArtifact'
import { buildContractEntryArtifactFromGeneration } from '../artifacts/buildContractEntryArtifactFromGeneration'
import {
  validateContractEntryArtifactBuildAnchor,
  validateRuntimeRouteBuildAnchor,
  type BuildAnchorCanonicalRole,
  type BuildAnchorTruthContract,
} from '../artifacts/buildAnchorTruthContract'
import { buildFinalRoute } from '../artifacts/runtimeRouteProjection'
import { buildRouteShapeContract } from '../arc/directionPlanning'
import {
  buildGreatStopGateResult,
  buildGreatStopRoutePacingDiagnostics,
} from '../greatStop/buildGreatStopGateResult'
import { computeFieldRealVerdictForArcCandidate } from '../field/computeFieldRealVerdict'
import type {
  DirectionContractValidationResult,
  DirectionIdentityMode,
  DirectionPlanningSelection,
} from '../arc/directionPlanning'
import type { DirectionContractBuildability } from '../bearings/assessDirectionContractBuildability'
import { buildRoutePlaceRightVerdictForArcCandidate } from '../bearings/buildRoutePlaceRightVerdictForArcCandidate'
import type { CanonicalInterpretationBundle } from '../interpretation/buildCanonicalInterpretationBundle'
import { runGeneratePlan, type GeneratePlanResult, type RunGeneratePlanOptions } from '../runGeneratePlan'
import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type {
  ConciergeIntent,
  ContractConstraints,
  AnchorRole,
  IntentInput,
  IntentProfile,
  PersonaMode,
  PlanAnchor,
  PreferredDiscoveryVenue,
  ResolvedDirectionContext,
  SelectedDirectionContext,
  RouteShapeContract,
  VibeAnchor,
} from '../types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../types/itinerary'
import type { RuntimeRouteArtifact } from '../artifacts/runtimeRouteArtifact'
import type { SourceMode } from '../types/sourceMode'
import type { StarterPack } from '../types/starterPack'
import type { ExperienceLens } from '../types/experienceLens'
import { GreatStopGateSelectionError } from '../types/greatStopGate'
import type { GreatStopGateSelectionDiagnostics } from '../types/greatStopGate'
import type {
  CanonicalPlanningStopIdentityLike,
  FullStopRealityContractOutcome,
  PostPlannerCommitParityStagesResult,
  RunPostPlannerCommitParityStagesDependencies,
  StrongCurationTastePassResult,
} from './postPlannerCommitParity'
import { runPostPlannerCommitParityStages } from './postPlannerCommitParity'

export class BuildContractCompatibilityProjectionMutationError extends Error {
  constructor() {
    super('Build contract compatibility projection was mutated before Waypoint planning.')
    this.name = 'BuildContractCompatibilityProjectionMutationError'
  }
}

export interface BuildContractDrivenWaypointPlanDiagnostics {
  contractAuthority: 'concierge_intent'
  compatibilityProjectionAuthoritative: false
  plannerIntentAuthoritative: false
  compatibilityProjectionRejected: boolean
  intentProfileRole: 'derived_compatibility_view'
  greatStopGatePostRepairVerification?: GreatStopGateSelectionDiagnostics
  buildAnchorRoleCasting?: BuildAnchorRoleCastingDiagnostics
}

export type BuildAnchorRoleCastingVariantOutcome =
  | {
      role: AnchorRole
      status: 'completed'
      selectedRouteId: string
      anchorRoleScore: number
      routeScore: number
      greatStopStatus: 'PASS'
    }
  | {
      role: AnchorRole
      status: 'rejected'
      failureStage: string
      reasonEvidence: string[]
    }

export interface BuildAnchorRoleCastingDiagnostics {
  owner: 'waypoint'
  source: 'build_anchor_missing_role_contextual_cast'
  selectedRole: AnchorRole
  attemptedOutcomes: BuildAnchorRoleCastingVariantOutcome[]
  selectorRule: 'normal_great_stop_pass_then_anchor_role_score_then_route_score'
}

export interface BuildContractDrivenWaypointPlanResult {
  result: GeneratePlanResult
  strongCurationPass: StrongCurationTastePassResult
  anchoredPlan: FullStopRealityContractOutcome
  canonicalItinerary: Itinerary
  contractBuildability: DirectionContractBuildability
  directionValidation: DirectionContractValidationResult
  nextFinalRoute: RuntimeRouteArtifact
  postParityContractEntryArtifact: ReturnType<typeof buildContractEntryArtifactFromGeneration>
  routeShapeContract: RouteShapeContract
  diagnostics: BuildContractDrivenWaypointPlanDiagnostics
  preLineage: {
    expectedDirectionId: string
    actualDirectionId: string | null
    passed: boolean
  }
}

export interface BuildContractDrivenWaypointPlanInput {
  conciergeIntent: ConciergeIntent
  canonicalInterpretationBundle: CanonicalInterpretationBundle
  mode: 'build'
  city: string
  district: string
  distanceMode: IntentInput['distanceMode']
  refinementModes?: IntentInput['refinementModes']
  selectedDirectionContext: SelectedDirectionContext
  selectedDirectionContextForValidation: ResolvedDirectionContext
  selectedDirectionContract: DirectionPlanningSelection
  selectedDirectionContractForValidation: DirectionPlanningSelection
  selectedDirectionId: string
  selectedDirectionPreviewScenarioFamily?: string
  expectedDirectionIdentity: DirectionIdentityMode
  discoveryPreferences?: PreferredDiscoveryVenue[]
  anchor?: PlanAnchor
  selectedArtifactLineage?: ContractEntryArtifactLineage
  sourceMode: SourceMode
  sourceModeOverrideApplied: boolean
  rankedDistrictPockets?: RunGeneratePlanOptions['rankedDistrictPockets']
  districtTasteBridgeArtifacts?: RunGeneratePlanOptions['districtTasteBridgeArtifacts']
  contractGateWorld?: RunGeneratePlanOptions['contractGateWorld']
  strategyAdmissibleWorlds?: RunGeneratePlanOptions['strategyAdmissibleWorlds']
  greatStopGateLocationClass?: RunGeneratePlanOptions['greatStopGateLocationClass']
  persona: PersonaMode
  vibe: VibeAnchor
  starterPack?: StarterPack
  requiredBuildAnchor?: {
    role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
    venueId: string
  } | null
  buildAnchorTruthContract?: BuildAnchorTruthContract | null
  postPlannerDependencies: RunPostPlannerCommitParityStagesDependencies
  runPlanBuild?: (
    input: IntentInput,
    options?: RunGeneratePlanOptions,
  ) => Promise<GeneratePlanResult>
  compatibilityProjectionForMutationProof?: IntentInput
}

type RequiredBuildAnchorTruthContract = BuildAnchorTruthContract & {
  requiredRole: BuildAnchorCanonicalRole
}

export class BuildAnchorRoleCastingSelectionError extends Error {
  readonly attemptedOutcomes: BuildAnchorRoleCastingVariantOutcome[]

  constructor(attemptedOutcomes: BuildAnchorRoleCastingVariantOutcome[]) {
    super('No contextual Build anchor role cast produced a normal Great Stop PASS.')
    this.name = 'BuildAnchorRoleCastingSelectionError'
    this.attemptedOutcomes = attemptedOutcomes
  }
}

const BUILD_ANCHOR_CONTEXTUAL_ROLE_ORDER: AnchorRole[] = [
  'start',
  'highlight',
  'windDown',
]

function cloneCompatibilityProjection(input: IntentInput): IntentInput {
  return JSON.parse(JSON.stringify(input)) as IntentInput
}

function assertCompatibilityProjectionNotMutated(params: {
  derived: IntentInput
  provided?: IntentInput
}): void {
  if (!params.provided) {
    return
  }
  if (JSON.stringify(params.derived) !== JSON.stringify(params.provided)) {
    throw new BuildContractCompatibilityProjectionMutationError()
  }
}

function roleToArcRole(
  role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>,
): ArcCandidate['stops'][number]['role'] {
  if (role === 'start') {
    return 'warmup'
  }
  if (role === 'highlight') {
    return 'peak'
  }
  return 'cooldown'
}

function getAnchorRoleScore(params: {
  selectedArc: ArcCandidate
  role: AnchorRole
  anchorVenueId: string
}): number {
  const arcRole = roleToArcRole(params.role)
  const stop = params.selectedArc.stops.find(
    (entry) =>
      entry.role === arcRole &&
      entry.scoredVenue.venue.id === params.anchorVenueId,
  )
  return stop?.scoredVenue.roleScores[arcRole] ?? 0
}

function readBuildAnchorRoleResolutionSource(
  input: BuildContractDrivenWaypointPlanInput,
): string | null {
  const anchor = input.anchor as (PlanAnchor & { roleResolutionSource?: string }) | undefined
  const anchorPosture = input.conciergeIntent.anchorPosture as ConciergeIntent['anchorPosture'] & {
    roleResolutionSource?: string
  }
  return (
    input.buildAnchorTruthContract?.roleResolutionSource ??
    anchor?.roleResolutionSource ??
    anchorPosture.roleResolutionSource ??
    null
  )
}

function getContextualBuildAnchorVenueId(
  input: BuildContractDrivenWaypointPlanInput,
): string | null {
  return (
    input.buildAnchorTruthContract?.canonicalVenueId ||
    input.requiredBuildAnchor?.venueId ||
    input.anchor?.venueId ||
    input.conciergeIntent.anchorPosture.anchorValue ||
    null
  )
}

function shouldContextuallyCastBuildAnchorRole(
  input: BuildContractDrivenWaypointPlanInput,
): boolean {
  return Boolean(
    input.mode === 'build' &&
      getContextualBuildAnchorVenueId(input) &&
      readBuildAnchorRoleResolutionSource(input) === 'missing' &&
      !input.anchor?.role &&
      !input.requiredBuildAnchor?.role &&
      !input.buildAnchorTruthContract?.requiredRole,
  )
}

function applyContextualBuildAnchorRoleVariant(
  input: BuildContractDrivenWaypointPlanInput,
  role: AnchorRole,
): BuildContractDrivenWaypointPlanInput {
  const anchorVenueId = getContextualBuildAnchorVenueId(input)
  if (!anchorVenueId) {
    return input
  }
  const variantAnchor: PlanAnchor & { roleResolutionSource?: 'inferred' } = {
    ...(input.anchor ?? { venueId: anchorVenueId }),
    venueId: anchorVenueId,
    role,
    roleResolutionSource: 'inferred',
  }
  return {
    ...input,
    conciergeIntent: {
      ...input.conciergeIntent,
      anchorPosture: {
        ...input.conciergeIntent.anchorPosture,
        roleHint: role,
      },
      anchorLineage: {
        ...input.conciergeIntent.anchorLineage,
        roleHint: role,
      },
    },
    anchor: variantAnchor,
    requiredBuildAnchor: {
      venueId: anchorVenueId,
      role,
    },
    buildAnchorTruthContract: input.buildAnchorTruthContract
      ? {
          ...input.buildAnchorTruthContract,
          requiredRole: role,
          roleResolutionSource: 'inferred',
        }
      : input.buildAnchorTruthContract,
  }
}

function classifyBuildAnchorRoleVariantFailure(error: unknown): {
  failureStage: string
  reasonEvidence: string[]
} {
  if (error instanceof GreatStopGateSelectionError) {
    const diagnostics = error.greatStopGateSelectionDiagnostics
    return {
      failureStage: diagnostics.stage,
      reasonEvidence: diagnostics.failureReasons,
    }
  }
  if (error instanceof Error) {
    return {
      failureStage: error.name || 'generation',
      reasonEvidence: [error.message],
    }
  }
  return {
    failureStage: 'unknown',
    reasonEvidence: [String(error)],
  }
}

function attachBuildAnchorRoleCastingDiagnostics(
  result: BuildContractDrivenWaypointPlanResult,
  diagnostics: BuildAnchorRoleCastingDiagnostics,
): BuildContractDrivenWaypointPlanResult {
  return {
    ...result,
    diagnostics: {
      ...result.diagnostics,
      buildAnchorRoleCasting: diagnostics,
    },
  }
}

function compareCompletedBuildAnchorRoleVariants(
  left: {
    role: AnchorRole
    result: BuildContractDrivenWaypointPlanResult
    outcome: Extract<BuildAnchorRoleCastingVariantOutcome, { status: 'completed' }>
  },
  right: {
    role: AnchorRole
    result: BuildContractDrivenWaypointPlanResult
    outcome: Extract<BuildAnchorRoleCastingVariantOutcome, { status: 'completed' }>
  },
): number {
  const anchorRoleScoreDelta = right.outcome.anchorRoleScore - left.outcome.anchorRoleScore
  if (anchorRoleScoreDelta !== 0) {
    return anchorRoleScoreDelta
  }
  const routeScoreDelta = right.outcome.routeScore - left.outcome.routeScore
  if (routeScoreDelta !== 0) {
    return routeScoreDelta
  }
  return (
    BUILD_ANCHOR_CONTEXTUAL_ROLE_ORDER.indexOf(left.role) -
    BUILD_ANCHOR_CONTEXTUAL_ROLE_ORDER.indexOf(right.role)
  )
}

function getRoleTitle(role: UserStopRole): ItineraryStop['title'] {
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

function findRequiredAnchorSource(params: {
  contract: BuildAnchorTruthContract
  itinerary: Itinerary
  scoredVenues: ScoredVenue[]
}): {
  itineraryStop?: ItineraryStop
  scoredVenue?: ScoredVenue
} {
  return {
    itineraryStop: params.itinerary.stops.find(
      (stop) => stop.venueId === params.contract.canonicalVenueId,
    ),
    scoredVenue: params.scoredVenues.find(
      (candidate) => candidate.venue.id === params.contract.canonicalVenueId,
    ),
  }
}

function hasRequiredBuildAnchorRole(
  contract: BuildAnchorTruthContract,
): contract is RequiredBuildAnchorTruthContract {
  return contract.requiredRole !== undefined
}

function buildRequiredAnchorItineraryStop(params: {
  contract: RequiredBuildAnchorTruthContract
  currentRoleStop: ItineraryStop
  sourceStop?: ItineraryStop
  sourceCandidate?: ScoredVenue
}): ItineraryStop {
  const { contract, currentRoleStop, sourceStop, sourceCandidate } = params
  const venue = sourceCandidate?.venue
  const displayName = contract.displayName ?? venue?.name ?? sourceStop?.venueName ?? contract.canonicalVenueId
  const latitude = contract.coordinates?.latitude ?? venue?.source.latitude ?? sourceStop?.latitude ?? currentRoleStop.latitude
  const longitude =
    contract.coordinates?.longitude ?? venue?.source.longitude ?? sourceStop?.longitude ?? currentRoleStop.longitude

  return {
    ...currentRoleStop,
    id: `${contract.requiredRole}:${contract.canonicalVenueId}`,
    role: contract.requiredRole,
    title: getRoleTitle(contract.requiredRole),
    venueId: contract.canonicalVenueId,
    venueName: displayName,
    formattedAddress:
      venue?.source.formattedAddress ?? sourceStop?.formattedAddress ?? currentRoleStop.formattedAddress,
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    city: venue?.city ?? sourceStop?.city ?? currentRoleStop.city,
    category: venue?.category ?? sourceStop?.category ?? currentRoleStop.category,
    subcategory: venue?.subcategory ?? sourceStop?.subcategory ?? currentRoleStop.subcategory,
    priceTier: venue?.priceTier ?? sourceStop?.priceTier ?? currentRoleStop.priceTier,
    tags: venue?.tags ?? sourceStop?.tags ?? currentRoleStop.tags,
    vibeTags: venue?.vibeTags ?? sourceStop?.vibeTags ?? currentRoleStop.vibeTags,
    neighborhood: venue?.neighborhood ?? sourceStop?.neighborhood ?? currentRoleStop.neighborhood,
    driveMinutes: venue?.driveMinutes ?? sourceStop?.driveMinutes ?? currentRoleStop.driveMinutes,
    durationClass: venue?.durationProfile.durationClass ?? sourceStop?.durationClass ?? currentRoleStop.durationClass,
    estimatedDurationMinutes:
      venue?.durationProfile.estimatedMinutes ??
      sourceStop?.estimatedDurationMinutes ??
      currentRoleStop.estimatedDurationMinutes,
    estimatedDurationLabel: sourceStop?.estimatedDurationLabel ?? currentRoleStop.estimatedDurationLabel,
    subtitle: sourceStop?.subtitle ?? venue?.shortDescription ?? currentRoleStop.subtitle,
    imageUrl: venue?.imageUrl ?? sourceStop?.imageUrl ?? currentRoleStop.imageUrl,
    selectedBecause:
      sourceStop?.selectedBecause ??
      currentRoleStop.selectedBecause ??
      `Preserved required Build anchor as ${contract.requiredRole}.`,
    stopInsider: sourceStop?.stopInsider ?? currentRoleStop.stopInsider,
  }
}

function buildRequiredAnchorCanonicalIdentity(params: {
  contract: RequiredBuildAnchorTruthContract
  replacementStop: ItineraryStop
  existingIdentity?: CanonicalPlanningStopIdentityLike
  sourceCandidate?: ScoredVenue
}): CanonicalPlanningStopIdentityLike | null {
  const { contract, replacementStop, existingIdentity, sourceCandidate } = params
  const latitude =
    contract.coordinates?.latitude ??
    sourceCandidate?.venue.source.latitude ??
    replacementStop.latitude ??
    existingIdentity?.latitude
  const longitude =
    contract.coordinates?.longitude ??
    sourceCandidate?.venue.source.longitude ??
    replacementStop.longitude ??
    existingIdentity?.longitude
  const providerRecordId =
    contract.providerRecordId ??
    sourceCandidate?.venue.source.providerRecordId ??
    existingIdentity?.providerRecordId
  const addressLine =
    sourceCandidate?.venue.source.formattedAddress ??
    replacementStop.formattedAddress ??
    existingIdentity?.addressLine

  if (
    !providerRecordId ||
    !addressLine ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number'
  ) {
    return null
  }

  return {
    displayName: contract.displayName ?? sourceCandidate?.venue.name ?? replacementStop.venueName,
    providerRecordId,
    latitude,
    longitude,
    addressLine,
    city: sourceCandidate?.venue.city ?? replacementStop.city ?? existingIdentity?.city ?? '',
    neighborhood:
      sourceCandidate?.venue.neighborhood ??
      replacementStop.neighborhood ??
      existingIdentity?.neighborhood ??
      '',
  }
}

function replaceRequiredAnchorArcStop(params: {
  selectedArc: ArcCandidate
  contract: RequiredBuildAnchorTruthContract
  sourceCandidate?: ScoredVenue
}): ArcCandidate {
  const targetArcRole = roleToArcRole(params.contract.requiredRole)
  return {
    ...params.selectedArc,
    stops: params.selectedArc.stops.map((stop) => {
      if (stop.role !== targetArcRole) {
        return stop
      }
      if (params.sourceCandidate) {
        return {
          ...stop,
          scoredVenue: {
            ...stop.scoredVenue,
            venue: params.sourceCandidate.venue,
          },
        }
      }
      return {
        ...stop,
        scoredVenue: {
          ...stop.scoredVenue,
          venue: {
            ...stop.scoredVenue.venue,
            id: params.contract.canonicalVenueId,
            name: params.contract.displayName ?? stop.scoredVenue.venue.name,
            ...(params.contract.providerRecordId
              ? {
                  source: {
                    ...stop.scoredVenue.venue.source,
                    providerRecordId: params.contract.providerRecordId,
                  },
                }
              : {}),
          },
        },
      }
    }),
  }
}

function preserveRequiredBuildAnchorInParity(params: {
  parity: PostPlannerCommitParityStagesResult
  contract: BuildAnchorTruthContract
  selectedDirectionId: string
  city: string
  persona: PersonaMode
  vibe: VibeAnchor
}): PostPlannerCommitParityStagesResult {
  const runtimeAnchorValidation = validateRuntimeRouteBuildAnchor(
    params.contract,
    params.parity.nextFinalRoute,
  )
  if (runtimeAnchorValidation.status !== 'invalid') {
    return params.parity
  }
  if (!hasRequiredBuildAnchorRole(params.contract)) {
    return params.parity
  }

  const currentRoleStop = params.parity.canonicalItinerary.stops.find(
    (stop) => stop.role === params.contract.requiredRole,
  )
  if (!currentRoleStop) {
    return params.parity
  }

  const source = findRequiredAnchorSource({
    contract: params.contract,
    itinerary: params.parity.canonicalItinerary,
    scoredVenues: params.parity.strongCurationPass.scoredVenues,
  })
  const replacementStop = buildRequiredAnchorItineraryStop({
    contract: params.contract,
    currentRoleStop,
    sourceStop: source.itineraryStop,
    sourceCandidate: source.scoredVenue,
  })
  const replacementIdentity = buildRequiredAnchorCanonicalIdentity({
    contract: params.contract,
    replacementStop,
    existingIdentity: params.parity.anchoredPlan.canonicalStopByRole[params.contract.requiredRole],
    sourceCandidate: source.scoredVenue,
  })
  if (!replacementIdentity) {
    return params.parity
  }

  const canonicalItinerary: Itinerary = {
    ...params.parity.canonicalItinerary,
    stops: params.parity.canonicalItinerary.stops.map((stop) =>
      stop.role === params.contract.requiredRole ? replacementStop : stop,
    ),
  }
  const selectedArc = replaceRequiredAnchorArcStop({
    selectedArc: params.parity.anchoredPlan.selectedArc,
    contract: params.contract,
    sourceCandidate: source.scoredVenue,
  })
  const anchoredPlan: FullStopRealityContractOutcome = {
    ...params.parity.anchoredPlan,
    selectedArc,
    itinerary: canonicalItinerary,
    canonicalStopByRole: {
      ...params.parity.anchoredPlan.canonicalStopByRole,
      [params.contract.requiredRole]: replacementIdentity,
    },
  }
  const nextFinalRoute = buildFinalRoute({
    itinerary: canonicalItinerary,
    canonicalStopByRole: anchoredPlan.canonicalStopByRole,
    selectedDirectionId: params.selectedDirectionId,
    city: params.city,
    persona: params.persona,
    vibe: params.vibe,
    activeRole: 'start',
    mode: 'build',
    routeHeadline: params.parity.nextFinalRoute.routeHeadline,
    routeSummary: params.parity.nextFinalRoute.routeSummary,
  })
  if (!nextFinalRoute) {
    return params.parity
  }
  const repairedRuntimeAnchorValidation = validateRuntimeRouteBuildAnchor(
    params.contract,
    nextFinalRoute,
  )
  if (repairedRuntimeAnchorValidation.status === 'invalid') {
    return params.parity
  }

  return {
    ...params.parity,
    anchoredPlan,
    canonicalItinerary,
    nextFinalRoute,
  }
}

export function buildBuildSoftFeasibleRecoveryRouteShapeAttempts(
  routeShapeContract: RouteShapeContract,
  conciergeIntent: ConciergeIntent,
): RouteShapeContract[] {
  const recoveryAttempts =
    conciergeIntent.constraintPosture.buildSoftFeasibleRecoveryChoice?.orderedRouteShapeAttempts
  if (!recoveryAttempts) {
    return [routeShapeContract]
  }
  return recoveryAttempts.map((attempt) => ({
    ...routeShapeContract,
    movementProfile: attempt.movementProfile,
  }))
}

export function applyBuildSoftFeasibleRecoveryRouteShape(
  routeShapeContract: RouteShapeContract,
  conciergeIntent: ConciergeIntent,
): RouteShapeContract {
  return buildBuildSoftFeasibleRecoveryRouteShapeAttempts(routeShapeContract, conciergeIntent)[0] ??
    routeShapeContract
}

async function runBuildContractDrivenBuildWaypointPlanAttempt(
  input: BuildContractDrivenWaypointPlanInput,
  routeShapeContract: RouteShapeContract,
): Promise<BuildContractDrivenWaypointPlanResult> {
  const compatibilityProjection = projectConciergeIntentToIntentInput({
    conciergeIntent: input.conciergeIntent,
    mode: input.mode,
    city: input.city,
    district: input.district,
    distanceMode: input.distanceMode,
    refinementModes: input.refinementModes,
    selectedDirectionContext: input.selectedDirectionContext,
    discoveryPreferences: input.discoveryPreferences,
    anchor: input.anchor,
  })
  assertCompatibilityProjectionNotMutated({
    derived: compatibilityProjection,
    provided: input.compatibilityProjectionForMutationProof,
  })

  const result = await (input.runPlanBuild ?? runGeneratePlan)(
    cloneCompatibilityProjection(compatibilityProjection),
    {
      sourceMode: input.sourceMode,
      sourceModeOverrideApplied: input.sourceModeOverrideApplied,
      debugMode: false,
      vibeTasteProfileScoring: 'off',
      occasionScoring: 'off',
      whenSpatialScoring: 'off',
      starterPack: input.starterPack,
      experienceContract: input.canonicalInterpretationBundle.experienceContract,
      contractConstraints: input.canonicalInterpretationBundle.contractConstraints,
      canonicalInterpretationBundle: input.canonicalInterpretationBundle,
      rankedDistrictPockets: input.rankedDistrictPockets,
      districtTasteBridgeArtifacts: input.districtTasteBridgeArtifacts,
      contractGateWorld: input.contractGateWorld,
      strategyAdmissibleWorlds: input.strategyAdmissibleWorlds,
      greatStopGateLocationClass: input.greatStopGateLocationClass,
      routeShapeContract,
      includePlaceRightDiagnosticCounterfactuals: true,
      selectedArtifactLineage: input.selectedArtifactLineage,
    },
  )

  const preLineage = {
    expectedDirectionId: input.selectedDirectionContract.id,
    actualDirectionId: result.intentProfile.selectedDirectionContext?.directionId ?? null,
    passed:
      result.intentProfile.selectedDirectionContext?.directionId === input.selectedDirectionContract.id,
  }
  if (!preLineage.passed) {
    throw new Error('Route drifted from selected direction contract. Direction context was not preserved.')
  }

  const parityBeforeBuildAnchorPreservation = await runPostPlannerCommitParityStages(
    {
      result,
      contractConstraints: input.canonicalInterpretationBundle.contractConstraints,
      expectedDirectionIdentity: input.expectedDirectionIdentity,
      selectedDirectionContextForValidation: input.selectedDirectionContextForValidation,
      selectedDirectionContractForValidation: input.selectedDirectionContractForValidation,
      previewScenarioFamily: input.selectedDirectionPreviewScenarioFamily,
      selectedDirectionId: input.selectedDirectionId,
      city: input.city,
      persona: input.persona,
      vibe: input.vibe,
    },
    {
      ...input.postPlannerDependencies,
      applyStrongCurationTastePass: (params) =>
        input.postPlannerDependencies.applyStrongCurationTastePass({
          ...params,
          requiredBuildAnchor: input.requiredBuildAnchor ?? undefined,
        }),
    },
  )
  const parity = input.buildAnchorTruthContract
    ? preserveRequiredBuildAnchorInParity({
        parity: parityBeforeBuildAnchorPreservation,
        contract: input.buildAnchorTruthContract,
        selectedDirectionId: input.selectedDirectionId,
        city: input.city,
        persona: input.persona,
        vibe: input.vibe,
      })
    : parityBeforeBuildAnchorPreservation

  if (input.buildAnchorTruthContract) {
    const runtimeAnchorValidation = validateRuntimeRouteBuildAnchor(
      input.buildAnchorTruthContract,
      parity.nextFinalRoute,
    )
    if (runtimeAnchorValidation.status === 'invalid') {
      throw new Error(
        `Required anchor could not be preserved in this route: ${runtimeAnchorValidation.reasons.join(',')}`,
      )
    }
  }

  const postRepairGreatStopGateDiagnostics = (() => {
    const postRepairRoutePacing = buildGreatStopRoutePacingDiagnostics(parity.anchoredPlan.selectedArc)
    const postRepairPlaceRightVerdict = buildRoutePlaceRightVerdictForArcCandidate({
      candidate: parity.anchoredPlan.selectedArc,
      intent: result.intentProfile,
      routePacing: postRepairRoutePacing,
      locationClass: input.greatStopGateLocationClass,
      placeRightTolerance: routeShapeContract.movementProfile.placeRightTolerance,
      includeDiagnosticCounterfactuals: true,
    })
    const postRepairGreatStopGateResult = buildGreatStopGateResult({
      selectedArc: parity.anchoredPlan.selectedArc,
      intent: result.intentProfile,
      routePacing: postRepairRoutePacing,
      placeRightVerdict: postRepairPlaceRightVerdict,
      fieldRealVerdict: computeFieldRealVerdictForArcCandidate(parity.anchoredPlan.selectedArc),
      locationClass: input.greatStopGateLocationClass,
      locationClassSource: input.greatStopGateLocationClass ? 'explicit' : undefined,
      placeRightTolerance: routeShapeContract.movementProfile.placeRightTolerance,
    })
    const diagnostics: GreatStopGateSelectionDiagnostics = {
      status: postRepairGreatStopGateResult.status,
      stage: 'post_repair_verification',
      selectedCandidateId: parity.anchoredPlan.selectedArc.id,
      selectedCandidateRank: 1,
      evaluatedCandidateCount: 1,
      failedTopCandidateCriteria: postRepairGreatStopGateResult.failedCriteria,
      failureReasons: [...postRepairGreatStopGateResult.reasons],
      bestFailingCandidateSummary:
        postRepairGreatStopGateResult.status === 'FAIL'
          ? {
              candidateId: parity.anchoredPlan.selectedArc.id,
              rank: 1,
              signature: parity.anchoredPlan.selectedArc.stops
                .map((stop) => `${stop.role}:${stop.scoredVenue.venue.id}`)
                .join('|'),
              stopVenueIdsByRole: {
                start: parity.anchoredPlan.selectedArc.stops.find((stop) => stop.role === 'warmup')
                  ?.scoredVenue.venue.id,
                highlight: parity.anchoredPlan.selectedArc.stops.find((stop) => stop.role === 'peak')
                  ?.scoredVenue.venue.id,
                windDown: parity.anchoredPlan.selectedArc.stops.find((stop) => stop.role === 'cooldown')
                  ?.scoredVenue.venue.id,
              },
              requiredAnchorPreserved: postRepairGreatStopGateResult.requiredAnchor?.survived,
              requiredAnchorRoleCorrect: postRepairGreatStopGateResult.requiredAnchor
                ? postRepairGreatStopGateResult.requiredAnchor.survived &&
                  postRepairGreatStopGateResult.requiredAnchor.creditedRole ===
                    postRepairGreatStopGateResult.requiredAnchor.role
                : undefined,
              failedCriteria: [...postRepairGreatStopGateResult.failedCriteria],
              reasons: [...postRepairGreatStopGateResult.reasons],
            }
          : undefined,
      passingCandidateCount: postRepairGreatStopGateResult.status === 'PASS' ? 1 : 0,
      selectedGateResult: postRepairGreatStopGateResult,
    }
    if (postRepairGreatStopGateResult.status === 'FAIL') {
      throw new GreatStopGateSelectionError(diagnostics)
    }
    return diagnostics
  })()

  const postParityContractEntryArtifact = buildContractEntryArtifactFromGeneration({
    itinerary: parity.canonicalItinerary,
    selectedArc: parity.anchoredPlan.selectedArc,
    scoredVenues: parity.strongCurationPass.scoredVenues,
    intentProfile: result.intentProfile,
    lens: result.lens,
    diagnostics: result.trace,
    rankingEngine: result.trace.rankingEngine,
    starterPack: input.starterPack,
    selectedArtifactLineage: input.selectedArtifactLineage,
  })

  if (input.buildAnchorTruthContract) {
    const postParityArtifactAnchorValidation = validateContractEntryArtifactBuildAnchor(
      input.buildAnchorTruthContract,
      postParityContractEntryArtifact,
    )
    if (postParityArtifactAnchorValidation.status === 'invalid') {
      throw new Error(
        `Required anchor could not be preserved in post-parity generated route artifact: ${postParityArtifactAnchorValidation.reasons.join(',')}`,
      )
    }
  }

  return {
    result,
    ...parity,
    postParityContractEntryArtifact,
    routeShapeContract,
    diagnostics: {
      contractAuthority: 'concierge_intent',
      compatibilityProjectionAuthoritative: false,
      plannerIntentAuthoritative: false,
      compatibilityProjectionRejected: false,
      intentProfileRole: 'derived_compatibility_view',
      greatStopGatePostRepairVerification: postRepairGreatStopGateDiagnostics,
    },
    preLineage,
  }
}

export async function buildContractDrivenBuildWaypointPlan(
  input: BuildContractDrivenWaypointPlanInput,
): Promise<BuildContractDrivenWaypointPlanResult> {
  const baseRouteShapeContract = buildRouteShapeContract({
    selectedDirection: input.selectedDirectionContract,
    selectedDirectionContext: input.selectedDirectionContextForValidation,
    conciergeIntent: input.conciergeIntent,
    contractConstraints: input.canonicalInterpretationBundle.contractConstraints,
    placeRightLocationClass: input.greatStopGateLocationClass,
  })
  const routeShapeAttempts = buildBuildSoftFeasibleRecoveryRouteShapeAttempts(
    baseRouteShapeContract,
    input.conciergeIntent,
  )
  const recoveryActive = Boolean(
    input.conciergeIntent.constraintPosture.buildSoftFeasibleRecoveryChoice,
  )
  if (routeShapeAttempts.length === 0) {
    throw new Error('No eligible Build soft-feasible recovery movement postures remained.')
  }
  if (shouldContextuallyCastBuildAnchorRole(input)) {
    const attemptedOutcomes: BuildAnchorRoleCastingVariantOutcome[] = []
    const completedVariants: Array<{
      role: AnchorRole
      result: BuildContractDrivenWaypointPlanResult
      outcome: Extract<BuildAnchorRoleCastingVariantOutcome, { status: 'completed' }>
    }> = []
    const anchorVenueId = getContextualBuildAnchorVenueId(input)
    for (const role of BUILD_ANCHOR_CONTEXTUAL_ROLE_ORDER) {
      const variantInput = applyContextualBuildAnchorRoleVariant(input, role)
      let roleOutcomeRecorded = false
      let lastRecoveryGreatStopError: GreatStopGateSelectionError | null = null
      for (const routeShapeContract of routeShapeAttempts) {
        try {
          const result = await runBuildContractDrivenBuildWaypointPlanAttempt(
            variantInput,
            routeShapeContract,
          )
          const outcome: Extract<
            BuildAnchorRoleCastingVariantOutcome,
            { status: 'completed' }
          > = {
            role,
            status: 'completed',
            selectedRouteId: result.anchoredPlan.selectedArc.id,
            anchorRoleScore: anchorVenueId
              ? getAnchorRoleScore({
                  selectedArc: result.anchoredPlan.selectedArc,
                  role,
                  anchorVenueId,
                })
              : 0,
            routeScore: result.anchoredPlan.selectedArc.totalScore,
            greatStopStatus: 'PASS',
          }
          attemptedOutcomes.push(outcome)
          completedVariants.push({ role, result, outcome })
          roleOutcomeRecorded = true
          break
        } catch (error) {
          if (error instanceof GreatStopGateSelectionError && recoveryActive) {
            lastRecoveryGreatStopError = error
            continue
          }
          const failure = classifyBuildAnchorRoleVariantFailure(error)
          attemptedOutcomes.push({
            role,
            status: 'rejected',
            failureStage: failure.failureStage,
            reasonEvidence: failure.reasonEvidence,
          })
          roleOutcomeRecorded = true
          break
        }
      }
      if (!roleOutcomeRecorded) {
        const failure = classifyBuildAnchorRoleVariantFailure(
          lastRecoveryGreatStopError ??
            new Error('No route shape attempt completed for contextual Build anchor role.'),
        )
        attemptedOutcomes.push({
          role,
          status: 'rejected',
          failureStage: failure.failureStage,
          reasonEvidence: failure.reasonEvidence,
        })
      }
    }
    if (completedVariants.length === 0) {
      throw new BuildAnchorRoleCastingSelectionError(attemptedOutcomes)
    }
    const [winner] = completedVariants.sort(compareCompletedBuildAnchorRoleVariants)
    return attachBuildAnchorRoleCastingDiagnostics(winner.result, {
      owner: 'waypoint',
      source: 'build_anchor_missing_role_contextual_cast',
      selectedRole: winner.role,
      attemptedOutcomes,
      selectorRule: 'normal_great_stop_pass_then_anchor_role_score_then_route_score',
    })
  }
  let lastGreatStopSelectionError: GreatStopGateSelectionError | null = null
  for (const routeShapeContract of routeShapeAttempts) {
    try {
      return await runBuildContractDrivenBuildWaypointPlanAttempt(input, routeShapeContract)
    } catch (error) {
      if (recoveryActive && error instanceof GreatStopGateSelectionError) {
        lastGreatStopSelectionError = error
        continue
      }
      throw error
    }
  }
  if (lastGreatStopSelectionError) {
    throw lastGreatStopSelectionError
  }
  throw new Error('No Build soft-feasible recovery movement posture produced a route.')
}
