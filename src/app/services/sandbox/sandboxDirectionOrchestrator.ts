import type {
  RealityDirectionCard,
  RealityCluster,
} from '../../../components/demo/RealityCommitStep'
import { applyPersonaShaping } from '../../../domain/direction/applyPersonaShaping'
import { applyVibeShaping } from '../../../domain/direction/applyVibeShaping'
import {
  buildDirectionCandidates,
  type DirectionCandidate,
} from '../../../domain/direction/buildDirectionCandidates'
import { selectBestDistinctDirections } from '../../../domain/direction/selectBestDistinctDirections'
import {
  buildDirectionPlanningSelection as buildDirectionPlanningSelectionEngine,
  buildResolvedDirectionContext as buildResolvedDirectionContextEngine,
  buildRouteShapeContract as buildRouteShapeContractEngine,
} from '../../../domain/arc/directionPlanning'
import {
  buildContractGateWorld,
  type ContractAwareDistrictRankingResult,
  type ContractGateWorld,
} from '../../../domain/bearings/buildContractGateWorld'
import { buildGreatStopAdmissibilitySignal } from '../../../domain/bearings/buildGreatStopAdmissibilitySignal'
import {
  buildStrategyAdmissibleWorlds,
  type StrategyAdmissibleWorld,
} from '../../../domain/bearings/buildStrategyAdmissibleWorlds'
import {
  buildHyperlocalDirectionExpression,
  type PocketType,
} from '../../../domain/directions/buildHyperlocalDirectionExpression'
import type { BuiltScenarioNight } from '../../../domain/interpretation/construction/scenarioBuilder'
import {
  buildCanonicalInterpretationBundle,
  formatExperienceContractActShape,
  type CanonicalInterpretationBundle,
} from '../../../domain/interpretation/buildCanonicalInterpretationBundle'
import type { DistrictTasteBridgeArtifact } from '../../../domain/interpretation/taste/districtTasteBridgeArtifact'
import type {
  ConciergeIntent,
  ContractConstraints,
  ExperienceContract,
  RouteShapeContract,
  VibeAnchor,
} from '../../../domain/types/intent'
import type { PersonaMode } from '../../../domain/types/intent'
import type { BuildDistrictOpportunityProfilesResult } from '../../../engines/district'

function getProcessEnvValue(key: string): string | undefined {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env
  return processEnv?.[key]
}

function readEnvValue(key: string): string | undefined {
  const importMetaEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env
  return importMetaEnv?.[key] ?? getProcessEnvValue(key)
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return undefined
}

function getTasteBridgeDirectionDiversificationFlag(): boolean {
  return parseBooleanEnv(readEnvValue('VITE_ID8_TASTE_BRIDGE_DIRECTION_DIVERSIFICATION')) ?? false
}

let hasLoggedDirectionEnvFlags = false

function logDirectionEnvFlags(): void {
  if (hasLoggedDirectionEnvFlags) {
    return
  }
  hasLoggedDirectionEnvFlags = true

  const env = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env

  console.info('[ID8 direction env]', {
    VITE_ID8_DIRECTION_CANDIDATE_FLOOR_RECOVERY:
      env?.VITE_ID8_DIRECTION_CANDIDATE_FLOOR_RECOVERY,
    VITE_ID8_DIRECTION_CONTRAST_POCKET_INJECTION:
      env?.VITE_ID8_DIRECTION_CONTRAST_POCKET_INJECTION,
    VITE_ID8_TASTE_BRIDGE_DIRECTION_DIVERSIFICATION:
      env?.VITE_ID8_TASTE_BRIDGE_DIRECTION_DIVERSIFICATION,
  })
}

export interface AssembleSandboxDirectionWorldParams {
  persona: PersonaMode
  primaryVibe: VibeAnchor
  districtLocationQuery: string
  districtPreviewResult: BuildDistrictOpportunityProfilesResult | null
  resolvedScenarioFamily: unknown
  scenarioBuiltNights: BuiltScenarioNight[]
}

export interface AssembleSandboxDirectionWorldDependencies {
  getDirectionTrajectoryHint(candidate: DirectionCandidate, vibe: VibeAnchor): string
  getDirectionToneTag(archetype: DirectionCandidate['archetype']): string
  getDirectionProofLine(candidate: DirectionCandidate, selected: boolean): string
  getStorySpineStartLine(candidate: DirectionCandidate, vibe: VibeAnchor): string
  getStorySpineHighlightLine(candidate: DirectionCandidate): string
  getStorySpineWindDownLine(candidate: DirectionCandidate): string
  getStorySpineWhyThisWorksLine(candidate: DirectionCandidate): string
  getRouteShapeHints(routeShapeContract: RouteShapeContract): {
    grammarHint: string
    movementHint: string
    swapHint: string
  }
}

export interface SandboxDirectionWorld {
  canonicalInterpretationBundle: CanonicalInterpretationBundle
  canonicalConciergeIntent: ConciergeIntent
  canonicalExperienceContract: ExperienceContract
  canonicalContractConstraints: ContractConstraints
  bearingsGreatStopSignal:
    | ReturnType<typeof buildGreatStopAdmissibilitySignal>
    | undefined
  contractGateWorld: ContractGateWorld
  contractAwareDistrictRanking: ContractAwareDistrictRankingResult
  strategyAdmissibleWorlds: StrategyAdmissibleWorld[]
  allDirectionCards: RealityDirectionCard[]
}

export function assembleSandboxDirectionWorld(
  params: AssembleSandboxDirectionWorldParams,
  dependencies: AssembleSandboxDirectionWorldDependencies,
): SandboxDirectionWorld {
  logDirectionEnvFlags()

  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    persona: params.persona,
    vibe: params.primaryVibe,
    city: params.districtLocationQuery,
    planningMode: 'engine-led',
    entryPoint: 'direction_selection',
    hasAnchor: false,
  })
  const canonicalConciergeIntent = canonicalInterpretationBundle.normalizedIntent
  const canonicalExperienceContract = canonicalInterpretationBundle.experienceContract
  const canonicalContractConstraints = canonicalInterpretationBundle.contractConstraints
  const bearingsGreatStopSignal =
    !params.resolvedScenarioFamily || params.scenarioBuiltNights.length === 0
      ? undefined
      : buildGreatStopAdmissibilitySignal(
          (
            params.scenarioBuiltNights.find((night) => {
              const evaluation = night.evaluation
              if (!evaluation || evaluation.passesGreatStopStandard) {
                return false
              }
              return evaluation.stopEvaluations.some((entry) =>
                entry.evaluation.failedCriteria.some(
                  (criterion) =>
                    criterion === 'real' ||
                    criterion === 'place_right' ||
                    criterion === 'moment_right',
                ),
              )
            }) ?? params.scenarioBuiltNights[0]
          ).evaluation,
        )

  const contractGateWorld = buildContractGateWorld({
    ranked: params.districtPreviewResult?.ranked ?? [],
    context: {
      canonicalStrategyFamily: canonicalInterpretationBundle.strategyFamily,
      canonicalStrategyFamilyResolution:
        canonicalInterpretationBundle.strategyFamilyResolution,
      experienceContract: canonicalExperienceContract,
      contractConstraints: canonicalContractConstraints,
      greatStopAdmissibilitySignal: bearingsGreatStopSignal,
    },
    source: 'page.sandbox.direction.contractGateWorld',
  })

  const contractAwareDistrictRanking = contractGateWorld.contractAwareRanking
  const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({
    contractGateWorld,
    strategyFamily: canonicalInterpretationBundle.strategyFamily,
    strategySummary: canonicalInterpretationBundle.strategySemantics.summary,
  })

  const allDirectionCards =
    !params.districtPreviewResult || contractGateWorld.admittedPockets.length === 0
      ? []
      : (() => {
          const experienceContractActShape = formatExperienceContractActShape(
            canonicalExperienceContract.actStructure.actPattern,
          )

          const candidatePoolLimit = Math.min(contractGateWorld.admittedPockets.length, 10)
          const baseCandidates = buildDirectionCandidates({
            ranked: contractAwareDistrictRanking.ranked,
            debug: params.districtPreviewResult.debug,
            candidatePoolLimit,
            contractGateWorld,
            strategyAdmissibleWorlds,
            context: {
              persona: params.persona,
              vibe: params.primaryVibe,
              experienceContract: canonicalExperienceContract,
              contractConstraints: canonicalContractConstraints,
            },
          })
          const personaShapedCandidates = applyPersonaShaping(baseCandidates, params.persona)
          const vibeShapedCandidates = applyVibeShaping(
            personaShapedCandidates,
            params.primaryVibe,
          )
          const tasteBridgeDirectionDiversification =
            getTasteBridgeDirectionDiversificationFlag()
          const tasteBridgeByPocketId = new Map<string, DistrictTasteBridgeArtifact>()
          for (const trace of params.districtPreviewResult.debug?.pocketTraces ?? []) {
            if (trace.tasteBridge) {
              tasteBridgeByPocketId.set(trace.pocketId, trace.tasteBridge)
            }
          }
          const finalSelection = selectBestDistinctDirections({
            candidates: vibeShapedCandidates,
            preShapeCandidates: baseCandidates,
            requestedVibe: params.primaryVibe,
            finalLimit: 3,
            tasteBridgeDirectionDiversification,
            tasteBridgeByPocketId,
          })
          const correctedWinnerId =
            finalSelection.debug.correctedWinnerId ?? finalSelection.finalists[0]?.pocketId
          const finalistsByPocketId = new Map(
            finalSelection.finalists.map((candidate) => [candidate.pocketId, candidate] as const),
          )
          const correctedWinner = correctedWinnerId
            ? finalistsByPocketId.get(correctedWinnerId)
            : undefined
          const candidates = [
            ...(correctedWinner ? [correctedWinner] : []),
            ...finalSelection.finalists.filter(
              (candidate) => candidate.pocketId !== correctedWinner?.pocketId,
            ),
          ].slice(0, 3)
          const finalSelectedId = candidates[0]?.pocketId
          const preShapeRankByPocketId = new Map(
            baseCandidates.map((candidate, index) => [candidate.pocketId, index + 1] as const),
          )
          const shapedRankByPocketId = new Map(
            vibeShapedCandidates.map((candidate, index) => [candidate.pocketId, index + 1] as const),
          )
          const decisionByPocketId = new Map(
            finalSelection.debug.selectionDecisions.map((decision) => [decision.pocketId, decision] as const),
          )
          const elevatedPocketIds = new Set(finalSelection.debug.elevatedPocketIds)
          const usedPrimarySignals = new Set<string>()
          const usedPocketTypes = new Set<PocketType>()

          return candidates
            .map((candidate, index) => {
              const hyperlocalExpression = buildHyperlocalDirectionExpression({
                districtLabel: candidate.pocketLabel,
                defaultTitle: candidate.label,
                defaultSubtitle: candidate.subtitle,
                defaultSupportLine: candidate.supportLine,
                preferDefaultTitle: true,
                preferDefaultSubtitle: true,
                defaultSectionLabel: 'What defines this area',
                defaultBullets: candidate.reasons.slice(0, 3),
                candidate,
                hyperlocal: candidate.derivedFrom.hyperlocal,
                usedPrimarySignals,
                usedPocketTypes,
              })
              if (hyperlocalExpression.primarySignalKey) {
                usedPrimarySignals.add(hyperlocalExpression.primarySignalKey)
              }
              if (hyperlocalExpression.pocketType) {
                usedPocketTypes.add(hyperlocalExpression.pocketType)
              }
              const confirmation = `You're starting in ${candidate.pocketLabel} - ${dependencies.getDirectionTrajectoryHint(candidate, params.primaryVibe)}`
              const candidateDirectionSelection = buildDirectionPlanningSelectionEngine({
                id: candidate.pocketId,
                label: hyperlocalExpression.title,
                pocketId: candidate.pocketId,
                pocketLabel: candidate.pocketLabel,
                archetype: candidate.archetype,
                cluster: candidate.cluster,
                experienceFamily: candidate.experienceFamily,
                familyConfidence: candidate.familyConfidence,
                subtitle: hyperlocalExpression.subtitle,
                laneIdentity: candidate.contrastProfile.laneIdentity,
                macroLane: candidate.contrastProfile.macroLane,
              })
              const candidateDirectionContext = buildResolvedDirectionContextEngine(
                candidateDirectionSelection,
              )
              if (!candidateDirectionContext) {
                return null
              }
              const routeShapeHints = dependencies.getRouteShapeHints(
                buildRouteShapeContractEngine({
                  selectedDirection: candidateDirectionSelection,
                  selectedDirectionContext: candidateDirectionContext,
                  conciergeIntent: canonicalConciergeIntent,
                  contractConstraints: canonicalContractConstraints,
                }),
              )
              const conciergeHint = `${canonicalConciergeIntent.controlPosture.mode} | ${canonicalConciergeIntent.objective.primary} | swaps ${canonicalConciergeIntent.constraintPosture.swapTolerance}`

              return {
                id: candidate.pocketId,
                cluster: candidate.cluster as RealityCluster,
                recommended: index === 0,
                directionStrategyWorldDebug: candidate.directionStrategyWorldDebug,
                card: {
                  title: hyperlocalExpression.title,
                  subtitle: hyperlocalExpression.subtitle,
                  toneTag: dependencies.getDirectionToneTag(candidate.archetype),
                  whyNow: candidate.directionNarrativeSummary,
                  whyYou: candidate.directionNarrativeSupport,
                  anchorLine: hyperlocalExpression.anchorLine,
                  supportLine: hyperlocalExpression.supportLine,
                  proofLine: dependencies.getDirectionProofLine(candidate, false),
                  selectedProofLine: dependencies.getDirectionProofLine(candidate, true),
                  storySpinePreview: {
                    start: dependencies.getStorySpineStartLine(candidate, params.primaryVibe),
                    highlight: dependencies.getStorySpineHighlightLine(candidate),
                    windDown: dependencies.getStorySpineWindDownLine(candidate),
                    whyThisWorks: dependencies.getStorySpineWhyThisWorksLine(candidate),
                  },
                  liveSignals: {
                    title: hyperlocalExpression.sectionLabel,
                    items: hyperlocalExpression.bullets,
                  },
                  confirmation,
                },
                debugMeta: {
                  pocketId: candidate.pocketId,
                  pocketLabel: candidate.pocketLabel,
                  archetype: candidate.archetype,
                  confidence: candidate.confidence,
                  persona: candidate.shapingDebug?.persona,
                  personaBoost: candidate.shapingDebug?.personaBoost,
                  vibe: candidate.shapingDebug?.vibe,
                  vibeBoost: candidate.shapingDebug?.vibeBoost,
                  finalScore: candidate.shapingDebug?.finalScore,
                  familyBias: candidate.shapingDebug?.familyBias,
                  richnessBoostApplied: candidate.richnessDebug?.richnessBoostApplied,
                  similarityPenaltyApplied: candidate.richnessDebug?.similarityPenaltyApplied,
                  composedCandidateAccepted: candidate.richnessDebug?.composedCandidateAccepted,
                  composedCandidateRejected: candidate.richnessDebug?.composedCandidateRejected,
                  richnessContrastReason: candidate.richnessDebug?.richnessContrastReason,
                  shapedScoreBeforeCompression: candidate.shapingDebug?.shapedScoreBeforeCompression,
                  shapedScoreAfterCompression: candidate.shapingDebug?.shapedScoreAfterCompression,
                  compressionApplied: candidate.shapingDebug?.compressionApplied,
                  compressionDelta: candidate.shapingDebug?.compressionDelta,
                  candidatePoolSize: finalSelection.debug.candidatePoolSize,
                  preShapeRank: preShapeRankByPocketId.get(candidate.pocketId),
                  shapedRank: shapedRankByPocketId.get(candidate.pocketId),
                  selectedRank: decisionByPocketId.get(candidate.pocketId)?.selectionRank,
                  selectionMode: decisionByPocketId.get(candidate.pocketId)?.selectionMode,
                  maxSimilarityToSelected: decisionByPocketId.get(candidate.pocketId)?.maxSimilarityToSelected,
                  similarityToWinner: decisionByPocketId.get(candidate.pocketId)?.similarityToWinner,
                  similarityToSlot2: decisionByPocketId.get(candidate.pocketId)?.similarityToSlot2,
                  sameLaneAsWinner: decisionByPocketId.get(candidate.pocketId)?.sameLaneAsWinner,
                  similarityPenalty: decisionByPocketId.get(candidate.pocketId)?.similarityPenalty,
                  contrastScore: decisionByPocketId.get(candidate.pocketId)?.contrastScore,
                  winnerStrengthBonus: decisionByPocketId.get(candidate.pocketId)?.winnerStrengthBonus,
                  diversityLift: decisionByPocketId.get(candidate.pocketId)?.diversityLift,
                  compositionChangedByShaping: finalSelection.debug.compositionChangedByShaping,
                  elevatedFromOutsideTop3: elevatedPocketIds.has(candidate.pocketId),
                  strongestShapedId: finalSelection.debug.strongestShapedId,
                  correctedWinnerId: finalSelection.debug.correctedWinnerId,
                  finalSelectedId,
                  strongestShapedPreserved: finalSelection.debug.strongestShapedPreserved,
                  slot1GuardrailApplied: finalSelection.debug.slot1GuardrailApplied,
                  top1RawSeparation: finalSelection.debug.top1RawSeparation,
                  top1AdjustedSeparation: finalSelection.debug.top1AdjustedSeparation,
                  laneIdentity: candidate.contrastProfile.laneIdentity,
                  macroLane: candidate.contrastProfile.macroLane,
                  directionExperienceIdentity: candidate.directionExperienceIdentity,
                  directionPrimaryIdentitySource: candidate.directionPrimaryIdentitySource,
                  directionPeakModel: candidate.directionPeakModel,
                  directionMovementStyle: candidate.directionMovementStyle,
                  directionDistrictSupportSummary: candidate.directionDistrictSupportSummary,
                  directionStrategyId: candidate.directionStrategyId,
                  directionStrategyLabel: candidate.directionStrategyLabel,
                  directionStrategyFamily: candidate.directionStrategyFamily,
                  directionStrategySummary: candidate.directionStrategySummary,
                  directionStrategySource: candidate.directionStrategySource,
                  directionCollapseGuardApplied: candidate.directionCollapseGuardApplied,
                  directionStrategyOverlapSummary: candidate.directionStrategyOverlapSummary,
                  strategyConstraintStatus: candidate.strategyConstraintStatus,
                  strategyPoolSize: candidate.strategyPoolSize,
                  strategyRejectedCount: candidate.strategyRejectedCount,
                  strategyHardGuardStatus: candidate.strategyHardGuardStatus,
                  strategyHardGuardReason: candidate.strategyHardGuardReason,
                  contractGateApplied: candidate.contractGateApplied,
                  contractGateSummary: candidate.contractGateSummary,
                  contractGateStrengthSummary: candidate.contractGateStrengthSummary,
                  contractGateRejectedCount: candidate.contractGateRejectedCount,
                  contractGateAllowedPreview: candidate.contractGateAllowedPreview,
                  contractGateSuppressedPreview: candidate.contractGateSuppressedPreview,
                  floorRecoveryAttempted: contractGateWorld.debug.floorRecoveryAttempted,
                  floorRecoveryCandidateId: contractGateWorld.debug.floorRecoveryCandidateId,
                  floorRecoveryReason: contractGateWorld.debug.floorRecoveryReason,
                  floorRecoveryBlockedReason: contractGateWorld.debug.floorRecoveryBlockedReason,
                  directionContractGateStatus: candidate.directionContractGateStatus,
                  directionContractGateReasonSummary: candidate.directionContractGateReasonSummary,
                  contrastPocketInjected:
                    candidate.directionContractGateReasonSummary?.includes(
                      'contrast_pocket_injected',
                    ) === true ||
                    candidate.directionStrategyWorldReasonSummary ===
                      'contrast_pocket_injected' ||
                    candidate.directionStrategySource?.includes(
                      'contrast_pocket_injected',
                    ) === true,
                  strategyWorldSource: candidate.strategyWorldSource,
                  selectedStrategyWorldId: candidate.selectedStrategyWorldId,
                  strategyWorldSummary: candidate.strategyWorldSummary,
                  strategyWorldAdmittedCount: candidate.strategyWorldAdmittedCount,
                  strategyWorldSuppressedCount: candidate.strategyWorldSuppressedCount,
                  strategyWorldRejectedCount: candidate.strategyWorldRejectedCount,
                  strategyWorldAllowedPreview: candidate.strategyWorldAllowedPreview,
                  strategyWorldSuppressedPreview: candidate.strategyWorldSuppressedPreview,
                  directionStrategyWorldDebug: candidate.directionStrategyWorldDebug,
                  directionStrategyWorldStatus: candidate.directionStrategyWorldStatus,
                  directionStrategyWorldReasonSummary: candidate.directionStrategyWorldReasonSummary,
                  directionNarrativeSource: candidate.directionNarrativeSource,
                  directionNarrativeMode: candidate.directionNarrativeMode,
                  directionNarrativeSummary: candidate.directionNarrativeSummary,
                  districtIdentityStrength: candidate.contrastProfile.districtIdentityStrength,
                  momentumProfile: candidate.contrastProfile.momentumProfile,
                  contrastEligible: candidate.contrastProfile.contrastEligible,
                  contrastReason: candidate.contrastProfile.contrastReason,
                  experienceFamily: candidate.experienceFamily,
                  familyConfidence: candidate.familyConfidence,
                  laneCollapseRisk: finalSelection.debug.laneCollapseRisk,
                  laneSeparatedSlot3: finalSelection.debug.laneSeparatedSlot3,
                  laneSeparationReason: finalSelection.debug.laneSeparationReason,
                  selectedFamilies: finalSelection.debug.selectedFamilies,
                  familyDiversityApplied: finalSelection.debug.familyDiversityApplied,
                  fallbackUsed: finalSelection.debug.fallbackUsed,
                  tasteBridgeDirectionDiversificationApplied:
                    finalSelection.debug.tasteBridgeDirectionDiversificationApplied,
                  droppedPocketIds: finalSelection.debug.droppedPocketIds,
                  expressionMode: hyperlocalExpression.expressionMode,
                  localSpecificityScore: hyperlocalExpression.localSpecificityScore,
                  usedPrimaryMicroPocket: hyperlocalExpression.usedPrimaryMicroPocket,
                  usedPrimaryAnchor: hyperlocalExpression.usedPrimaryAnchor,
                  selectedTemplateKeys: hyperlocalExpression.templateKeys,
                  expressionPrimarySignal: hyperlocalExpression.primarySignalKey,
                  expressionPocketType: hyperlocalExpression.pocketType,
                  routeShapeGrammarHint: routeShapeHints.grammarHint,
                  routeShapeMovementHint: routeShapeHints.movementHint,
                  routeShapeSwapHint: routeShapeHints.swapHint,
                  experienceContractId: canonicalExperienceContract.id,
                  experienceContractIdentity: canonicalExperienceContract.contractIdentity,
                  experienceContractSummary: canonicalExperienceContract.summary,
                  experienceContractCoordinationMode: canonicalExperienceContract.coordinationMode,
                  experienceContractHighlightModel: canonicalExperienceContract.highlightModel,
                  experienceContractHighlightType: canonicalExperienceContract.highlightType,
                  experienceContractMovementStyle: canonicalExperienceContract.movementStyle,
                  experienceContractSocialPosture: canonicalExperienceContract.socialPosture,
                  experienceContractPacingStyle: canonicalExperienceContract.pacingStyle,
                  experienceContractActPattern: experienceContractActShape,
                  experienceContractReasonSummary:
                    canonicalExperienceContract.debug.contractReasonSummary,
                  contractConstraintsId: canonicalContractConstraints.id,
                  contractConstraintsPeakCountModel:
                    canonicalContractConstraints.peakCountModel,
                  contractConstraintsMovementTolerance:
                    canonicalContractConstraints.movementTolerance,
                  contractConstraintsHighlightPressure:
                    canonicalContractConstraints.highlightPressure,
                  contractConstraintsRequireContinuity:
                    canonicalContractConstraints.requireContinuity,
                  contractConstraintsRequireRecoveryWindows:
                    canonicalContractConstraints.requireRecoveryWindows,
                  conciergeIntentId: canonicalConciergeIntent.id,
                  conciergeIntentMode: canonicalConciergeIntent.intentMode,
                  conciergeObjectivePrimary:
                    canonicalConciergeIntent.objective.primary,
                  conciergeControlPostureMode:
                    canonicalConciergeIntent.controlPosture.mode,
                  conciergeConstraintSwapTolerance:
                    canonicalConciergeIntent.constraintPosture.swapTolerance,
                  conciergeHint,
                },
              }
            })
            .filter((entry): entry is RealityDirectionCard => Boolean(entry))
        })()

  return {
    canonicalInterpretationBundle,
    canonicalConciergeIntent,
    canonicalExperienceContract,
    canonicalContractConstraints,
    bearingsGreatStopSignal,
    contractGateWorld,
    contractAwareDistrictRanking,
    strategyAdmissibleWorlds,
    allDirectionCards,
  }
}
