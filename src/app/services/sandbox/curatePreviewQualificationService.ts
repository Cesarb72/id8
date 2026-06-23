import type {
  CanonicalCandidateRouteArtifact,
  ContractEntryArtifactLineage,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { ContractGateWorld } from '../../../domain/bearings/buildContractGateWorld'
import type { CanonicalInterpretationBundle } from '../../../domain/interpretation/buildCanonicalInterpretationBundle'
import type { DistrictTasteBridgeArtifact } from '../../../domain/interpretation/taste/districtTasteBridgeArtifact'
import type {
  DirectionIdentityMode,
  DirectionPlanningSelection,
} from '../../../domain/arc/directionPlanning'
import type { GeneratePlanResult } from '../../../domain/runGeneratePlan'
import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { StarterPack } from '../../../domain/types/starterPack'
import type { ConciergeIntent, ContractConstraints, ExperienceContract, IntentInput, PersonaMode, ResolvedDirectionContext, RouteShapeContract, VibeAnchor } from '../../../domain/types/intent'
import type { UserStopRole } from '../../../domain/types/itinerary'
import type { RankedPocket } from '../../../engines/district/types/districtTypes'
import { validatePublicCurateApprovedPayloadTruth } from '../curate/publicCurateCardTruthService'
import type {
  CuratePreviewCommitabilityStateLike,
  CurateQualificationRepairState,
  CurateWindDownRepairTargetLike,
} from './curatePreviewQualificationTypes'
import {
  PostPlannerCommitParityValidationError,
  type PostPlannerCommitParityStagesResult,
} from './sandboxPlannerParityService'

type CurateStopRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
type CurateCommitSemantics = 'seed_guided' | 'approved_route_hard_commit'

const approvedPayloadRouteMaterializationUnavailableReason =
  'approved_payload_route_materialization_unavailable' as const

export type CuratePreviewQualificationAttemptResult<
  TDirectionCoreRole extends string = string,
  TApprovedPayload = unknown,
  TRepairTarget extends CurateWindDownRepairTargetLike = CurateWindDownRepairTargetLike,
> =
  | {
      kind: 'committable'
      artifactId: string
      state: CuratePreviewCommitabilityStateLike<TDirectionCoreRole, TApprovedPayload>
    }
  | {
      kind: 'infeasible'
      artifactId: string
      state: CuratePreviewCommitabilityStateLike<TDirectionCoreRole, TApprovedPayload>
    }
  | {
      kind: 'repairRequested'
      artifactId: string
      repairedArtifact: CanonicalCandidateRouteArtifact
      repairState: CurateQualificationRepairState<TRepairTarget>
    }
  | {
      kind: 'unexpectedFailure'
      artifactId: string
      state: CuratePreviewCommitabilityStateLike<TDirectionCoreRole, TApprovedPayload>
    }

export interface CuratePreviewQualificationAttemptParams<
  TDirectionCard extends { cluster: string; card: { confirmation: string } },
  TDirectionCoreRole extends string = string,
  TOpportunity = unknown,
  TStarterDebug = unknown,
  TRepairTarget extends CurateWindDownRepairTargetLike = CurateWindDownRepairTargetLike,
  TSelectedDirectionPreviewContext = unknown,
> {
  artifactId: string
  artifactToQualify: CanonicalCandidateRouteArtifact
  repairState?: CurateQualificationRepairState<TRepairTarget>
  starterDebug?: TStarterDebug
  activeDirection: TDirectionCard
  activeCandidateOpportunity?: TOpportunity
  selectedStarterPack?: unknown
  districtLocationQuery: string
  persona: PersonaMode
  primaryVibe: VibeAnchor
  activeDistrictPocketId: string
  canonicalInterpretationBundle: CanonicalInterpretationBundle
  canonicalConciergeIntent: ConciergeIntent
  canonicalExperienceContract: ExperienceContract
  canonicalContractConstraints: ContractConstraints
  rankedDistrictPockets?: RankedPocket[]
  districtTasteBridgeArtifacts?: DistrictTasteBridgeArtifact[]
  contractGateWorld?: ContractGateWorld
  refinementModes: NonNullable<IntentInput['refinementModes']>
  activeDirectionContract: DirectionPlanningSelection
  activeDirectionContextForValidation: ResolvedDirectionContext
  activeDirectionContractForValidation: DirectionPlanningSelection
  expectedDirectionIdentityForPreview: DirectionIdentityMode
  activeIntentSelectedDirectionContext: NonNullable<IntentInput['selectedDirectionContext']>
  activeRouteShapeContract: RouteShapeContract
  selectedArtifactDiscoveryPreferences:
    | NonNullable<IntentInput['discoveryPreferences']>
    | undefined
  selectedArtifactLineage: ContractEntryArtifactLineage | undefined
  selectedArtifactLineageSummary: string
  plannerInputSummary: string
  selectedDirectionPreviewContext?: TSelectedDirectionPreviewContext
}

export interface CuratePreviewQualificationAttemptDependencies<
  TDirectionCard extends { cluster: string; card: { confirmation: string } },
  TDirectionCoreRole extends string = string,
  TOpportunity = unknown,
  TStarterDebug = unknown,
  TApprovedPayload = unknown,
  TRepairTarget extends CurateWindDownRepairTargetLike = CurateWindDownRepairTargetLike,
  TSelectedDirectionPreviewContext = unknown,
> {
  runPlanBuild(
    input: IntentInput,
    options?: {
      sourceMode: 'curated'
      sourceModeOverrideApplied: true
      debugMode: false
      curateCommitSemantics: CurateCommitSemantics
      starterPack?: unknown
      experienceContract: ExperienceContract
      contractConstraints: ContractConstraints
      canonicalInterpretationBundle: CanonicalInterpretationBundle
      rankedDistrictPockets?: RankedPocket[]
      districtTasteBridgeArtifacts?: DistrictTasteBridgeArtifact[]
      contractGateWorld?: ContractGateWorld
      selectedArtifactLineage?: ContractEntryArtifactLineage
    },
  ): Promise<GeneratePlanResult>
  enforceSelectedDirectionLineage(params: {
    wrapperSeam: string
    expectedDirectionId: string
    actualSelectedDirectionContext: GeneratePlanResult['intentProfile']['selectedDirectionContext']
    errorMessage: string
  }): void
  runPostPlannerCommitParityStages(params: {
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
    selectedDirectionPreviewContext?: TSelectedDirectionPreviewContext
    selectedCluster: TDirectionCard['cluster']
  }): Promise<PostPlannerCommitParityStagesResult>
  attemptStarterAwareWindDownRepair(params: {
    artifact: CanonicalCandidateRouteArtifact
    opportunity: TOpportunity | undefined
    starterDebug: TStarterDebug | undefined
    eligibleWindDownVenueIds?: string[]
  }): {
    repairedArtifact: CanonicalCandidateRouteArtifact | null
    repairReason: string
    originalWindDown: string | null
    repairedWindDown: string | null
    repairedWindDownTarget: TRepairTarget | null
    repairSource: string | null
  }
  buildApprovedRefinementEntryPayload(params: {
    artifactId: string
    artifactToQualify: CanonicalCandidateRouteArtifact
    result: GeneratePlanResult
    parity: PostPlannerCommitParityStagesResult
    selectedArtifactLineageSummary: string
    activeDirection: TDirectionCard
    activeDirectionContextForValidation: ResolvedDirectionContext
    activeDirectionContractForValidation: DirectionPlanningSelection
    activeRouteShapeContract: RouteShapeContract
    selectedDirectionPreviewContext?: TSelectedDirectionPreviewContext
    canonicalConciergeIntent: ConciergeIntent
    canonicalExperienceContract: ExperienceContract
    canonicalContractConstraints: ContractConstraints
  }): TApprovedPayload
  formatCurateSelectedTargetSummary(
    curateHardCommit: GeneratePlanResult['trace']['curateHardCommit'],
  ): string
  formatCurateFinalWinnerSummary(
    curateHardCommit: GeneratePlanResult['trace']['curateHardCommit'],
  ): string
  formatCurateHardCommitSampleCandidatesSummary(
    curateHardCommit: GeneratePlanResult['trace']['curateHardCommit'],
  ): string
  getCurateDiscoveryPreferenceVenueId(
    discoveryPreferences: NonNullable<IntentInput['discoveryPreferences']> | undefined,
    role: CurateStopRole,
  ): string
  getErrorName(error: unknown): string
  getErrorMessageRaw(error: unknown): string
  getCuratePreflightRuntimeReason(error: unknown): string
}

function hasScenarioNight(value: object): value is { scenarioNight?: unknown } {
  return 'scenarioNight' in value
}

function hasScenarioFamily(value: object): value is { scenarioFamily?: unknown } {
  return 'scenarioFamily' in value
}

function getPreviewScenarioFamily(opportunity: unknown): string | undefined {
  if (
    !opportunity ||
    typeof opportunity !== 'object' ||
    !hasScenarioNight(opportunity)
  ) {
    return undefined
  }

  const { scenarioNight } = opportunity
  if (
    !scenarioNight ||
    typeof scenarioNight !== 'object' ||
    !hasScenarioFamily(scenarioNight)
  ) {
    return undefined
  }

  return typeof scenarioNight.scenarioFamily === 'string'
    ? scenarioNight.scenarioFamily
    : undefined
}

function getSelectedStarterPackForApprovedPayloadTruth(
  value: unknown,
): StarterPack | null {
  if (!value || typeof value !== 'object' || !('id' in value)) {
    return null
  }
  const id = (value as { id?: unknown }).id
  return typeof id === 'string' && id.trim() ? (value as StarterPack) : null
}

function getApprovedPayloadTruthFailureReason(params: {
  artifactId: string
  artifactToQualify: CanonicalCandidateRouteArtifact
  nextFinalRoute: RuntimeRouteArtifact
  selectedStarterPack?: unknown
}): string | null {
  const truth = validatePublicCurateApprovedPayloadTruth({
    selectedStarterPack: getSelectedStarterPackForApprovedPayloadTruth(
      params.selectedStarterPack,
    ),
    artifact: params.artifactToQualify,
    approvedRefinementEntryPayload: {
      artifactId: params.artifactId,
      finalRoute: params.nextFinalRoute,
    },
  })
  return truth.allowedToRender ? null : truth.rejectionReasons[0] ?? 'approved_payload_route_mismatch'
}

function hasExactCoreRouteDiscoveryPreferences(
  discoveryPreferences: NonNullable<IntentInput['discoveryPreferences']> | undefined,
): boolean {
  if (!discoveryPreferences || discoveryPreferences.length === 0) {
    return false
  }
  return (['start', 'highlight', 'windDown'] as const).every((role) =>
    discoveryPreferences.some(
      (preference) => preference.role === role && Boolean(preference.venueId.trim()),
    ),
  )
}

function shouldUseApprovedRouteHardCommit(params: {
  activeCandidateOpportunity?: unknown
  selectedArtifactLineage?: ContractEntryArtifactLineage
  selectedArtifactDiscoveryPreferences:
    | NonNullable<IntentInput['discoveryPreferences']>
    | undefined
}): boolean {
  return Boolean(
    params.selectedArtifactLineage &&
      getPreviewScenarioFamily(params.activeCandidateOpportunity) &&
      hasExactCoreRouteDiscoveryPreferences(params.selectedArtifactDiscoveryPreferences),
  )
}

function buildRepairDiagnostics<
  TDirectionCoreRole extends string,
  TApprovedPayload,
  TRepairTarget extends CurateWindDownRepairTargetLike,
>(params: {
  repairState?: CurateQualificationRepairState<TRepairTarget>
  selectedArtifactDiscoveryPreferences:
    | NonNullable<IntentInput['discoveryPreferences']>
    | undefined
  getCurateDiscoveryPreferenceVenueId(
    discoveryPreferences: NonNullable<IntentInput['discoveryPreferences']> | undefined,
    role: CurateStopRole,
  ): string
}): Pick<
  CuratePreviewCommitabilityStateLike<TDirectionCoreRole, TApprovedPayload>,
  | 'windDownRepairAttempted'
  | 'windDownRepairOriginal'
  | 'windDownRepairReplacement'
  | 'windDownRepairReplacementId'
  | 'windDownRepairReason'
  | 'windDownRepairSource'
  | 'windDownRepairPreferenceApplied'
  | 'windDownRepairPreferenceTarget'
  | 'repairedDiscoveryPrefsWindDown'
  | 'repairedLineageWindDown'
> {
  const { repairState } = params

  return {
    windDownRepairAttempted: Boolean(repairState?.attempted),
    windDownRepairOriginal: repairState?.originalWindDown ?? null,
    windDownRepairReplacement: repairState?.repairedWindDown ?? null,
    windDownRepairReplacementId: repairState?.repairedWindDownTarget?.venueId ?? null,
    windDownRepairReason: repairState?.repairReason ?? null,
    windDownRepairSource: repairState?.repairSource ?? null,
    windDownRepairPreferenceApplied: Boolean(
      repairState?.repairedWindDownTarget?.venueId &&
        params.getCurateDiscoveryPreferenceVenueId(
          params.selectedArtifactDiscoveryPreferences,
          'windDown',
        ) === repairState.repairedWindDownTarget.venueId,
    ),
    windDownRepairPreferenceTarget: repairState?.repairedWindDownTarget
      ? `${repairState.repairedWindDownTarget.name} [${repairState.repairedWindDownTarget.venueId ?? 'n/a'}] (${repairState.repairedWindDownTarget.source})`
      : null,
    repairedDiscoveryPrefsWindDown: repairState?.attempted
      ? params.getCurateDiscoveryPreferenceVenueId(
          params.selectedArtifactDiscoveryPreferences,
          'windDown',
        )
      : null,
    repairedLineageWindDown: repairState?.repairedWindDownTarget
      ? `${repairState.repairedWindDownTarget.name} [${repairState.repairedWindDownTarget.venueId ?? 'n/a'}]`
      : null,
  }
}

export async function runCuratePreviewQualificationAttempt<
  TDirectionCard extends { cluster: string; card: { confirmation: string } },
  TDirectionCoreRole extends string = string,
  TOpportunity = unknown,
  TStarterDebug = unknown,
  TApprovedPayload = unknown,
  TRepairTarget extends CurateWindDownRepairTargetLike = CurateWindDownRepairTargetLike,
  TSelectedDirectionPreviewContext = unknown,
>(
  params: CuratePreviewQualificationAttemptParams<
    TDirectionCard,
    TDirectionCoreRole,
    TOpportunity,
    TStarterDebug,
    TRepairTarget,
    TSelectedDirectionPreviewContext
  >,
  dependencies: CuratePreviewQualificationAttemptDependencies<
    TDirectionCard,
    TDirectionCoreRole,
    TOpportunity,
    TStarterDebug,
    TApprovedPayload,
    TRepairTarget,
    TSelectedDirectionPreviewContext
  >,
): Promise<
  CuratePreviewQualificationAttemptResult<
    TDirectionCoreRole,
    TApprovedPayload,
    TRepairTarget
  >
> {
  const repairDiagnostics = buildRepairDiagnostics<
    TDirectionCoreRole,
    TApprovedPayload,
    TRepairTarget
  >({
    repairState: params.repairState,
    selectedArtifactDiscoveryPreferences: params.selectedArtifactDiscoveryPreferences,
    getCurateDiscoveryPreferenceVenueId:
      dependencies.getCurateDiscoveryPreferenceVenueId,
  })

  try {
    const curateCommitSemantics: CurateCommitSemantics = shouldUseApprovedRouteHardCommit({
      activeCandidateOpportunity: params.activeCandidateOpportunity,
      selectedArtifactLineage: params.selectedArtifactLineage,
      selectedArtifactDiscoveryPreferences: params.selectedArtifactDiscoveryPreferences,
    })
      ? 'approved_route_hard_commit'
      : 'seed_guided'
    const result = await dependencies.runPlanBuild(
      {
        mode: 'curate',
        planningMode: 'engine-led',
        persona: params.persona,
        primaryVibe: params.primaryVibe,
        city: params.districtLocationQuery,
        district: params.activeDirectionContract.pocketLabel,
        distanceMode: 'nearby',
        refinementModes: params.refinementModes,
        selectedDirectionContext: params.activeIntentSelectedDirectionContext,
        discoveryPreferences: params.selectedArtifactDiscoveryPreferences,
      },
      {
        sourceMode: 'curated',
        sourceModeOverrideApplied: true,
        debugMode: false,
        curateCommitSemantics,
        starterPack: params.selectedStarterPack,
        experienceContract: params.canonicalExperienceContract,
        contractConstraints: params.canonicalContractConstraints,
        canonicalInterpretationBundle: params.canonicalInterpretationBundle,
        rankedDistrictPockets: params.rankedDistrictPockets,
        districtTasteBridgeArtifacts: params.districtTasteBridgeArtifacts,
        contractGateWorld: params.contractGateWorld,
        selectedArtifactLineage: params.selectedArtifactLineage,
      },
    )

    dependencies.enforceSelectedDirectionLineage({
      wrapperSeam: 'sandbox_concierge.curate_preflight',
      expectedDirectionId: params.activeDirectionContract.id,
      actualSelectedDirectionContext: result.intentProfile.selectedDirectionContext,
      errorMessage:
        'Route drifted from selected direction contract. Direction context was not preserved.',
    })

    const parity = await dependencies.runPostPlannerCommitParityStages({
      result,
      contractConstraints: params.canonicalContractConstraints,
      expectedDirectionIdentity: params.expectedDirectionIdentityForPreview,
      selectedDirectionContextForValidation: params.activeDirectionContextForValidation,
      selectedDirectionContractForValidation:
        params.activeDirectionContractForValidation,
      previewScenarioFamily: getPreviewScenarioFamily(
        params.activeCandidateOpportunity,
      ),
      selectedDirectionId: params.activeDirectionContract.id,
      city: params.districtLocationQuery,
      persona: params.persona,
      vibe: params.primaryVibe,
      selectedDirectionPreviewContext: params.selectedDirectionPreviewContext,
      selectedCluster: params.activeDirection.cluster,
    })

    const curateHardCommit = result.trace.curateHardCommit
    const hardCommitRequired = Boolean(curateHardCommit?.hardCommitRequired)
    const hardCommitPreservationSucceeded = Boolean(
      curateHardCommit?.hardCommitPreservationSucceeded,
    )
    const exactPreservationSatisfied =
      !hardCommitRequired || hardCommitPreservationSucceeded
    const approvedPayloadMaterializationFailureReason =
      curateCommitSemantics === 'approved_route_hard_commit' &&
      hardCommitRequired &&
      !hardCommitPreservationSucceeded
        ? approvedPayloadRouteMaterializationUnavailableReason
        : null
    const baseCommitParitySucceeded = Boolean(
      exactPreservationSatisfied &&
        parity.directionValidation.valid &&
        parity.nextFinalRoute &&
        parity.nextFinalRoute.selectedDirectionId === params.activeDirectionContract.id,
    )
    const approvedPayloadTruthFailureReason = baseCommitParitySucceeded
      ? getApprovedPayloadTruthFailureReason({
          artifactId: params.artifactId,
          artifactToQualify: params.artifactToQualify,
          nextFinalRoute: parity.nextFinalRoute,
          selectedStarterPack: params.selectedStarterPack,
        })
      : null
    const commitParitySucceeded = Boolean(
      baseCommitParitySucceeded && !approvedPayloadTruthFailureReason,
    )
    const failedCheck = commitParitySucceeded
      ? null
      : approvedPayloadTruthFailureReason ??
        approvedPayloadMaterializationFailureReason ??
        (hardCommitRequired && !hardCommitPreservationSucceeded
          ? 'curateHardCommit.hardCommitPreservationSucceeded'
          : !parity.directionValidation.valid
            ? parity.directionValidation.generationDriftReason ??
              'directionValidation.valid'
            : parity.nextFinalRoute.selectedDirectionId !==
                params.activeDirectionContract.id
              ? 'nextFinalRoute.selectedDirectionId'
              : 'curate_preflight_commit_parity')
    const failureKind: CuratePreviewCommitabilityStateLike<
      TDirectionCoreRole,
      TApprovedPayload
    >['failureKind'] = commitParitySucceeded
      ? undefined
      : parity.directionValidation.valid
        ? 'structural_infeasibility'
        : 'validation_failure'

    if (
      !commitParitySucceeded &&
      !params.repairState?.attempted &&
      (parity.directionValidation.missingRoleForContract === 'windDown' ||
        parity.directionValidation.candidatePoolSufficiencyByRole.windDown === 0)
    ) {
      const repairAttempt = dependencies.attemptStarterAwareWindDownRepair({
        artifact: params.artifactToQualify,
        opportunity: params.activeCandidateOpportunity,
        starterDebug: params.starterDebug,
        eligibleWindDownVenueIds: parity.strongCurationPass.rolePoolVenueIdsByRole.windDown,
      })
      if (repairAttempt.repairedArtifact) {
        return {
          kind: 'repairRequested',
          artifactId: params.artifactId,
          repairedArtifact: repairAttempt.repairedArtifact,
          repairState: {
            attempted: true,
            originalWindDown: repairAttempt.originalWindDown,
            repairedWindDown: repairAttempt.repairedWindDown,
            repairedWindDownTarget: repairAttempt.repairedWindDownTarget,
            repairReason: repairAttempt.repairReason,
            repairSource: repairAttempt.repairSource,
          },
        }
      }

      return {
        kind: 'infeasible',
        artifactId: params.artifactId,
        state: {
          status: 'infeasible',
          artifactId: params.artifactId,
          hardCommitCandidateCount: curateHardCommit?.hardCommitCandidateCount ?? 0,
          rankedCandidateCount: curateHardCommit?.rankedCandidateCount ?? 0,
          explicitFallbackReason: `${
            approvedPayloadTruthFailureReason ??
            approvedPayloadMaterializationFailureReason ??
            curateHardCommit?.explicitFallbackReason ??
            parity.directionValidation.generationDriftReason ??
            failedCheck ??
            'curate_preflight_commit_parity_failed'
          } | repair:${repairAttempt.repairReason}`,
          failureKind,
          failedCheck,
          errorName: null,
          errorMessageRaw: null,
          curateCommitSemantics: 'seed_guided',
          hardCommitRequired: false,
          failedRoles:
            curateHardCommit?.failedRoles ?? ['start', 'highlight', 'windDown'],
          contractBuildabilityStatus:
            parity.directionValidation.contractBuildabilityStatus,
          missingRoleForContract:
            parity.directionValidation.missingRoleForContract as TDirectionCoreRole | null,
          candidatePoolSufficiencyByRole:
            parity.directionValidation
              .candidatePoolSufficiencyByRole as Record<TDirectionCoreRole, number>,
          selectedDirectionId: params.activeDirectionContract.id,
          activeDistrictPocketId: params.activeDistrictPocketId,
          selectedArtifactLineageSummary: params.selectedArtifactLineageSummary,
          plannerInputSummary: params.plannerInputSummary,
          sampledCandidatesSummary:
            dependencies.formatCurateHardCommitSampleCandidatesSummary(
              curateHardCommit,
            ),
          rolePoolVenueIdsByRole:
            parity.strongCurationPass
              .rolePoolVenueIdsByRole as Record<TDirectionCoreRole, string[]>,
          approvedRefinementEntryPayload: undefined,
          ...repairDiagnostics,
          windDownRepairAttempted: true,
          windDownRepairSucceeded: false,
          windDownRepairOriginal: repairAttempt.originalWindDown,
          windDownRepairReplacement: repairAttempt.repairedWindDown,
          windDownRepairReplacementId:
            repairAttempt.repairedWindDownTarget?.venueId ?? null,
          windDownRepairReason: repairAttempt.repairReason,
          windDownRepairSource: repairAttempt.repairSource,
          windDownRepairPreferenceApplied: false,
          windDownRepairPreferenceTarget: repairAttempt.repairedWindDownTarget
            ? `${repairAttempt.repairedWindDownTarget.name} [${repairAttempt.repairedWindDownTarget.venueId ?? 'n/a'}] (${repairAttempt.repairedWindDownTarget.source})`
            : null,
          repairedDiscoveryPrefsWindDown: null,
          repairedLineageWindDown: repairAttempt.repairedWindDownTarget
            ? `${repairAttempt.repairedWindDownTarget.name} [${repairAttempt.repairedWindDownTarget.venueId ?? 'n/a'}]`
            : null,
          repairedCandidatePoolSufficiencyByRole:
            parity.directionValidation
              .candidatePoolSufficiencyByRole as Record<TDirectionCoreRole, number>,
          repairedHardCommitCandidateCount:
            curateHardCommit?.hardCommitCandidateCount ?? 0,
          repairedFailureReason: `${
            approvedPayloadTruthFailureReason ??
            approvedPayloadMaterializationFailureReason ??
            curateHardCommit?.explicitFallbackReason ??
            parity.directionValidation.generationDriftReason ??
            failedCheck ??
            'curate_preflight_commit_parity_failed'
          } | repair:${repairAttempt.repairReason}`,
          repairedQualificationStatus: 'infeasible',
        },
      }
    }

    const approvedRefinementEntryPayload = commitParitySucceeded
      ? dependencies.buildApprovedRefinementEntryPayload({
          artifactId: params.artifactId,
          artifactToQualify: params.artifactToQualify,
          result,
          parity,
          selectedArtifactLineageSummary: params.selectedArtifactLineageSummary,
          activeDirection: params.activeDirection,
          activeDirectionContextForValidation:
            params.activeDirectionContextForValidation,
          activeDirectionContractForValidation:
            params.activeDirectionContractForValidation,
          activeRouteShapeContract: params.activeRouteShapeContract,
          selectedDirectionPreviewContext: params.selectedDirectionPreviewContext,
          canonicalConciergeIntent: params.canonicalConciergeIntent,
          canonicalExperienceContract: params.canonicalExperienceContract,
          canonicalContractConstraints: params.canonicalContractConstraints,
        })
      : undefined

    const state: CuratePreviewCommitabilityStateLike<
      TDirectionCoreRole,
      TApprovedPayload
    > = {
      status: commitParitySucceeded ? 'committable' : 'infeasible',
      artifactId: params.artifactId,
      hardCommitCandidateCount: curateHardCommit?.hardCommitCandidateCount ?? 0,
      rankedCandidateCount: curateHardCommit?.rankedCandidateCount ?? 0,
      explicitFallbackReason: commitParitySucceeded
        ? curateHardCommit?.explicitFallbackReason
        : approvedPayloadTruthFailureReason ??
          approvedPayloadMaterializationFailureReason ??
          curateHardCommit?.explicitFallbackReason ??
          parity.directionValidation.generationDriftReason ??
          failedCheck ??
          'curate_preflight_commit_parity_failed',
      failureKind,
      failedCheck,
      errorName: null,
      errorMessageRaw: null,
      curateCommitSemantics:
        curateHardCommit?.curateCommitSemantics ?? 'seed_guided',
      hardCommitRequired: curateHardCommit?.hardCommitRequired ?? false,
      failedRoles: commitParitySucceeded
        ? curateHardCommit?.failedRoles ?? []
        : curateHardCommit?.failedRoles ?? ['start', 'highlight', 'windDown'],
      contractBuildabilityStatus:
        parity.directionValidation.contractBuildabilityStatus,
      missingRoleForContract:
        parity.directionValidation.missingRoleForContract as TDirectionCoreRole | null,
      candidatePoolSufficiencyByRole:
        parity.directionValidation
          .candidatePoolSufficiencyByRole as Record<TDirectionCoreRole, number>,
      selectedDirectionId: params.activeDirectionContract.id,
      activeDistrictPocketId: params.activeDistrictPocketId,
      selectedArtifactLineageSummary: params.selectedArtifactLineageSummary,
      plannerInputSummary: params.plannerInputSummary,
      selectedTargetSummary: dependencies.formatCurateSelectedTargetSummary(
        curateHardCommit,
      ),
      exactPreservingCandidateIds:
        curateHardCommit?.exactPreservingCandidateIds ?? [],
      finalWinnerSummary: dependencies.formatCurateFinalWinnerSummary(
        curateHardCommit,
      ),
      sampledCandidatesSummary:
        dependencies.formatCurateHardCommitSampleCandidatesSummary(
          curateHardCommit,
        ),
      rolePoolVenueIdsByRole:
        parity.strongCurationPass
          .rolePoolVenueIdsByRole as Record<TDirectionCoreRole, string[]>,
      approvedRefinementEntryPayload,
      ...repairDiagnostics,
      windDownRepairSucceeded: Boolean(
        params.repairState?.attempted && commitParitySucceeded,
      ),
      repairedCandidatePoolSufficiencyByRole: params.repairState?.attempted
        ? (parity.directionValidation
            .candidatePoolSufficiencyByRole as Record<TDirectionCoreRole, number>)
        : undefined,
      repairedHardCommitCandidateCount: params.repairState?.attempted
        ? curateHardCommit?.hardCommitCandidateCount ?? 0
        : null,
      repairedFailureReason: params.repairState?.attempted
        ? commitParitySucceeded
          ? null
          : approvedPayloadTruthFailureReason ??
            approvedPayloadMaterializationFailureReason ??
            curateHardCommit?.explicitFallbackReason ??
            parity.directionValidation.generationDriftReason ??
            failedCheck ??
            'curate_preflight_commit_parity_failed'
        : null,
      repairedQualificationStatus: params.repairState?.attempted
        ? commitParitySucceeded
          ? 'committable'
          : 'infeasible'
        : null,
    }

    return {
      kind: commitParitySucceeded ? 'committable' : 'infeasible',
      artifactId: params.artifactId,
      state,
    }
  } catch (preflightError) {
    const isValidationFailure =
      preflightError instanceof PostPlannerCommitParityValidationError
    const errorName = dependencies.getErrorName(preflightError)
    const errorMessageRaw = dependencies.getErrorMessageRaw(preflightError)

    return {
      kind: 'unexpectedFailure',
      artifactId: params.artifactId,
      state: {
        status: 'infeasible',
        artifactId: params.artifactId,
        hardCommitCandidateCount: 0,
        rankedCandidateCount: 0,
        explicitFallbackReason: isValidationFailure
          ? preflightError.directionValidation.generationDriftReason ??
            preflightError.failedCheck
          : dependencies.getCuratePreflightRuntimeReason(preflightError),
        failureKind: isValidationFailure ? 'validation_failure' : 'runtime_error',
        failedCheck: isValidationFailure ? preflightError.failedCheck : null,
        errorName,
        errorMessageRaw,
        curateCommitSemantics: 'seed_guided',
        hardCommitRequired: false,
        failedRoles: [],
        contractBuildabilityStatus: isValidationFailure
          ? preflightError.directionValidation.contractBuildabilityStatus
          : undefined,
        missingRoleForContract: isValidationFailure
          ? (preflightError.directionValidation
              .missingRoleForContract as TDirectionCoreRole | null)
          : null,
        candidatePoolSufficiencyByRole: isValidationFailure
          ? (preflightError.directionValidation
              .candidatePoolSufficiencyByRole as Record<TDirectionCoreRole, number>)
          : undefined,
        selectedDirectionId: params.activeDirectionContract.id,
        activeDistrictPocketId: params.activeDistrictPocketId,
        selectedArtifactLineageSummary: params.selectedArtifactLineageSummary,
        plannerInputSummary: params.plannerInputSummary,
        sampledCandidatesSummary: undefined,
        rolePoolVenueIdsByRole: undefined,
        approvedRefinementEntryPayload: undefined,
        ...repairDiagnostics,
        windDownRepairSucceeded: false,
        repairedCandidatePoolSufficiencyByRole: params.repairState?.attempted
          ? isValidationFailure
            ? (preflightError.directionValidation
                .candidatePoolSufficiencyByRole as Record<TDirectionCoreRole, number>)
            : undefined
          : undefined,
        repairedHardCommitCandidateCount: params.repairState?.attempted ? 0 : null,
        repairedFailureReason: params.repairState?.attempted
          ? isValidationFailure
            ? preflightError.directionValidation.generationDriftReason ??
              preflightError.failedCheck
            : dependencies.getCuratePreflightRuntimeReason(preflightError)
          : null,
        repairedQualificationStatus: params.repairState?.attempted
          ? 'infeasible'
          : null,
      },
    }
  }
}
