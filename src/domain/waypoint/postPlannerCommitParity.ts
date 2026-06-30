import { buildFinalRoute } from '../artifacts/runtimeRouteProjection'
import type { GeneratePlanResult } from '../runGeneratePlan'
import type {
  DirectionContractValidationResult,
  DirectionIdentityMode,
  DirectionPlanningSelection,
} from '../arc/directionPlanning'
import type {
  DirectionContractBuildability,
  DirectionCoreRole,
} from '../bearings/assessDirectionContractBuildability'
import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type { ExperienceLens } from '../types/experienceLens'
import type {
  ContractConstraints,
  IntentProfile,
  PersonaMode,
  ResolvedDirectionContext,
  VibeAnchor,
} from '../types/intent'
import type { Itinerary, UserStopRole } from '../types/itinerary'
import type { RuntimeRouteArtifact } from '../artifacts/runtimeRouteArtifact'

export interface CanonicalPlanningStopIdentityLike {
  displayName: string
  providerRecordId: string
  latitude: number
  longitude: number
  addressLine: string
  city: string
  neighborhood: string
}

export interface FullStopRealityContractOutcome {
  selectedArc: ArcCandidate
  itinerary: Itinerary
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentityLike>>
  rejectedStopRoles: UserStopRole[]
}

export interface StrongCurationTastePassResult {
  selectedArc: ArcCandidate
  itinerary: Itinerary
  scoredVenues: ScoredVenue[]
  qualificationByCandidateId: Record<string, unknown>
  personaVibeTasteBiasSummary: string
  thinPoolHighlightFallbackApplied: boolean
  highlightPoolCountBefore: number
  highlightPoolCountAfter: number
  rolePoolCountByRoleBefore: Record<DirectionCoreRole, number>
  rolePoolCountByRoleAfter: Record<DirectionCoreRole, number>
  signatureHighlightShortlistCount: number
  signatureHighlightShortlistIds: string[]
  highlightShortlistScoreSummary: string
  selectedHighlightFromShortlist: boolean
  selectedHighlightShortlistRank: number | null
  fallbackToQualifiedHighlightPool: boolean
  upstreamPoolSelectionApplied: boolean
  postGenerationRepairCount: number
  rolePoolVenueIdsByRole: Record<DirectionCoreRole, string[]>
  rolePoolVenueIdsCombined: string[]
  windDownCandidateQualityDiagnostics?: Array<{
    venueId: string
    name: string
    inCandidateUniverse: boolean
    inWindDownPool: boolean
    windDownPoolRank: number | null
    selectedAsWindDown: boolean
    roleAffinityCooldownScore: number | null
    roleCandidateWeight: number | null
    roleEligibilityScore: number | null
    roleEligibilityFloor: number | null
    roleEligibilityPassed: boolean | null
    roleEligibilityReason: string | null
    anchoredCooldownFit: number | null
    category: string | null
    tags: string[]
    neighborhood: string | null
    driveMinutes: number | null
    sourceKind: string | null
    providerRecordId: string | null
    hasCoordinates: boolean
  }>
  thinPoolRelaxationTrace: {
    triggered: boolean
    baseQualifiedHighlightCount: number
    baseHighlightFloor: number
    relaxedHighlightFloor: number
    triggerReason: string
    relaxedRule: string
    effectSummary: string
  }
}

export interface PostPlannerCommitParityStagesResult {
  strongCurationPass: StrongCurationTastePassResult
  anchoredPlan: FullStopRealityContractOutcome
  canonicalItinerary: Itinerary
  contractBuildability: DirectionContractBuildability
  directionValidation: DirectionContractValidationResult
  nextFinalRoute: RuntimeRouteArtifact
}

export class PostPlannerCommitParityValidationError extends Error {
  readonly directionValidation: DirectionContractValidationResult
  readonly contractBuildability: DirectionContractBuildability
  readonly failedCheck: string

  constructor(params: {
    message: string
    directionValidation: DirectionContractValidationResult
    contractBuildability: DirectionContractBuildability
    failedCheck: string
  }) {
    super(params.message)
    this.name = 'PostPlannerCommitParityValidationError'
    Object.setPrototypeOf(this, PostPlannerCommitParityValidationError.prototype)
    this.directionValidation = params.directionValidation
    this.contractBuildability = params.contractBuildability
    this.failedCheck = params.failedCheck
  }
}

export function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}

export function getErrorMessageRaw(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function getCuratePreflightRuntimeReason(error: unknown): string {
  const errorName = getErrorName(error)
  return errorName ? `curate_preflight_runtime_error:${errorName}` : 'curate_preflight_runtime_error'
}

export interface RunPostPlannerCommitParityStagesDependencies {
  buildPassthroughStrongCurationTastePass(params: {
    itinerary: Itinerary
    selectedArc: ArcCandidate
    scoredVenues: ScoredVenue[]
  }): StrongCurationTastePassResult
  applyStrongCurationTastePass(params: {
    itinerary: Itinerary
    selectedArc: ArcCandidate
    scoredVenues: ScoredVenue[]
    intentProfile: IntentProfile
    lens: ExperienceLens
    contractConstraints: ContractConstraints
    requiredBuildAnchor?: {
      role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
      venueId: string
    }
  }): StrongCurationTastePassResult
  enforceFullStopRealityContract(params: {
    itinerary: Itinerary
    selectedArc: ArcCandidate
    scoredVenues: ScoredVenue[]
    intentProfile: IntentProfile
    lens: ExperienceLens
  }): Promise<FullStopRealityContractOutcome>
  applyCanonicalIdentityToItinerary(
    itinerary: Itinerary,
    canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentityLike>>,
  ): Itinerary
  assessDirectionContractBuildability(params: {
    expectedDirectionIdentity: DirectionIdentityMode
    scoredVenues: ScoredVenue[]
  }): DirectionContractBuildability
  validateDirectionRouteContract(params: {
    selectedDirectionContext?: ResolvedDirectionContext
    selectedDirection?: Pick<DirectionPlanningSelection, 'identity'>
    itinerary: Itinerary
    buildability: DirectionContractBuildability
    mode?: 'surprise' | 'curate' | 'build'
    previewScenarioFamily?: string
  }): DirectionContractValidationResult
  resolveRouteCopy(params: { canonicalItinerary: Itinerary }): {
    routeHeadline: string
    routeSummary: string
  }
}

export interface RunPostPlannerCommitParityStagesParams {
  result: GeneratePlanResult
  contractConstraints: ContractConstraints
  expectedDirectionIdentity: DirectionIdentityMode
  selectedDirectionContextForValidation: ResolvedDirectionContext
  selectedDirectionContractForValidation: DirectionPlanningSelection
  previewScenarioFamily?: string
  selectedDirectionId: string
  city: string
  persona: PersonaMode
  vibe: VibeAnchor
}

export async function runPostPlannerCommitParityStages(
  params: RunPostPlannerCommitParityStagesParams,
  dependencies: RunPostPlannerCommitParityStagesDependencies,
): Promise<PostPlannerCommitParityStagesResult> {
  const strongCurationPass =
    params.result.intentProfile.mode === 'surprise'
      ? dependencies.buildPassthroughStrongCurationTastePass({
          itinerary: params.result.itinerary,
          selectedArc: params.result.selectedArc,
          scoredVenues: params.result.scoredVenues,
        })
      : dependencies.applyStrongCurationTastePass({
          itinerary: params.result.itinerary,
          selectedArc: params.result.selectedArc,
          scoredVenues: params.result.scoredVenues,
          intentProfile: params.result.intentProfile,
          lens: params.result.lens,
          contractConstraints: params.contractConstraints,
        })
  const anchoredPlan = await dependencies.enforceFullStopRealityContract({
    itinerary: strongCurationPass.itinerary,
    selectedArc: strongCurationPass.selectedArc,
    scoredVenues: strongCurationPass.scoredVenues,
    intentProfile: params.result.intentProfile,
    lens: params.result.lens,
  })
  const canonicalItinerary = dependencies.applyCanonicalIdentityToItinerary(
    anchoredPlan.itinerary,
    anchoredPlan.canonicalStopByRole,
  )
  const contractBuildability = dependencies.assessDirectionContractBuildability({
    expectedDirectionIdentity: params.expectedDirectionIdentity,
    scoredVenues: strongCurationPass.scoredVenues,
  })
  const directionValidation = dependencies.validateDirectionRouteContract({
    selectedDirectionContext: params.selectedDirectionContextForValidation,
    selectedDirection: params.selectedDirectionContractForValidation,
    itinerary: canonicalItinerary,
    buildability: contractBuildability,
    mode: params.result.intentProfile.mode,
    previewScenarioFamily: params.previewScenarioFamily,
  })
  if (!directionValidation.valid) {
    throw new PostPlannerCommitParityValidationError({
      message: 'Route drifted from selected direction contract. Please regenerate.',
      directionValidation,
      contractBuildability,
      failedCheck: directionValidation.generationDriftReason ?? 'directionValidation.valid',
    })
  }
  const { routeHeadline, routeSummary } = dependencies.resolveRouteCopy({
    canonicalItinerary,
  })
  const nextFinalRoute = buildFinalRoute({
    itinerary: canonicalItinerary,
    canonicalStopByRole: anchoredPlan.canonicalStopByRole,
    selectedDirectionId: params.selectedDirectionId,
    city: params.city,
    persona: params.persona,
    vibe: params.vibe,
    activeRole: 'start',
    mode: params.result.intentProfile.mode,
    routeHeadline,
    routeSummary,
  })
  if (!nextFinalRoute) {
    throw new PostPlannerCommitParityValidationError({
      message: 'Route commit failed: one or more stops are missing canonical identity.',
      directionValidation,
      contractBuildability,
      failedCheck: 'buildFinalRoute.canonicalIdentity',
    })
  }
  if (nextFinalRoute.selectedDirectionId !== params.selectedDirectionId) {
    throw new PostPlannerCommitParityValidationError({
      message: 'Route drifted from selected direction contract. Please regenerate.',
      directionValidation,
      contractBuildability,
      failedCheck: 'nextFinalRoute.selectedDirectionId',
    })
  }
  return {
    strongCurationPass,
    anchoredPlan,
    canonicalItinerary,
    contractBuildability,
    directionValidation,
    nextFinalRoute,
  }
}
