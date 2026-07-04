import { projectConciergeIntentToIntentInput } from '../interpretation/projectConciergeIntentToIntentInput'
import type { ContractEntryArtifactLineage } from '../artifacts/contractEntryArtifact'
import { buildContractEntryArtifactFromGeneration } from '../artifacts/buildContractEntryArtifactFromGeneration'
import {
  validateContractEntryArtifactBuildAnchor,
  validateRuntimeRouteBuildAnchor,
  type BuildAnchorTruthContract,
} from '../artifacts/buildAnchorTruthContract'
import { buildRouteShapeContract } from '../arc/directionPlanning'
import type {
  DirectionContractValidationResult,
  DirectionIdentityMode,
  DirectionPlanningSelection,
} from '../arc/directionPlanning'
import type { DirectionContractBuildability } from '../bearings/assessDirectionContractBuildability'
import type { CanonicalInterpretationBundle } from '../interpretation/buildCanonicalInterpretationBundle'
import { runGeneratePlan, type GeneratePlanResult, type RunGeneratePlanOptions } from '../runGeneratePlan'
import type { ArcCandidate } from '../types/arc'
import type {
  ConciergeIntent,
  ContractConstraints,
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
import type { Itinerary, UserStopRole } from '../types/itinerary'
import type { RuntimeRouteArtifact } from '../artifacts/runtimeRouteArtifact'
import type { SourceMode } from '../types/sourceMode'
import type { StarterPack } from '../types/starterPack'
import type { ExperienceLens } from '../types/experienceLens'
import type {
  FullStopRealityContractOutcome,
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

export async function buildContractDrivenBuildWaypointPlan(
  input: BuildContractDrivenWaypointPlanInput,
): Promise<BuildContractDrivenWaypointPlanResult> {
  const routeShapeContract = buildRouteShapeContract({
    selectedDirection: input.selectedDirectionContract,
    selectedDirectionContext: input.selectedDirectionContextForValidation,
    conciergeIntent: input.conciergeIntent,
    contractConstraints: input.canonicalInterpretationBundle.contractConstraints,
  })
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

  const parity = await runPostPlannerCommitParityStages(
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
    },
    preLineage,
  }
}
