import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import { DistrictPreviewPanel } from '../components/dev/DistrictPreviewPanel'
import {
  RealityCommitStep,
  type RealityClusterCardCopy,
  type RealityDirectionCard,
  type RealityCluster,
} from '../components/demo/RealityCommitStep'
import {
  buildDirectionCandidates,
  type DirectionCandidate,
} from '../domain/direction/buildDirectionCandidates'
import { applyPersonaShaping } from '../domain/direction/applyPersonaShaping'
import { applyVibeShaping } from '../domain/direction/applyVibeShaping'
import { selectBestDistinctDirections } from '../domain/direction/selectBestDistinctDirections'
import { JourneyMapReal } from '../components/journey/JourneyMapReal'
import type { JourneyWaypointOverride } from '../components/journey/JourneyMapReal'
import { RouteSpine } from '../components/journey/RouteSpine'
import { PageShell } from '../components/layout/PageShell'
import {
  assertCanonicalSelectedDirectionContext,
  enforceSelectedDirectionLineage,
} from '../app/wrapper/arcWrapperBoundary'
import { swapArcStop } from '../domain/arc/swapArcStop'
import { scoreAnchoredRoleFit } from '../domain/arc/scoreAnchoredRoleFit'
import { inverseRoleProjection } from '../domain/config/roleProjection'
import {
  buildDirectionPlanningSelection as buildDirectionPlanningSelectionEngine,
  buildIntentSelectedDirectionContext as buildIntentSelectedDirectionContextEngine,
  buildResolvedDirectionContext as buildResolvedDirectionContextEngine,
  buildRouteShapeContract as buildRouteShapeContractEngine,
  evaluateHardStructuralSwapCompatibility as evaluateHardStructuralSwapCompatibilityEngine,
  validateDirectionRouteContract as validateDirectionRouteContractEngine,
  type DirectionContractValidationResult,
  type DirectionIdentityMode,
  type DirectionPlanningSelection,
  type HardStructuralSwapCompatibilityEvaluation,
  type HardStructuralSwapCompatibilityInput,
} from '../domain/arc/directionPlanning'
import {
  assessDirectionContractBuildability as assessDirectionContractBuildabilityEngine,
  type DirectionContractBuildability,
  type DirectionCoreRole,
} from '../domain/bearings/assessDirectionContractBuildability'
import {
  buildHyperlocalDirectionExpression,
  type PocketType,
} from '../domain/directions/buildHyperlocalDirectionExpression'
import {
  saveLiveArtifactSession,
  type FinalRoute,
  type FinalRouteStop,
} from '../domain/live/liveArtifactSession'
import {
  searchAnchorVenues,
  type AnchorSearchChip,
  type AnchorSearchResult,
} from '../domain/search/searchAnchorVenues'
import { getCrewPolicy } from '../domain/intent/getCrewPolicy'
import { projectItinerary } from '../domain/itinerary/projectItinerary'
import { buildTonightSignals } from '../domain/journey/buildTonightSignals'
import { deriveContractAwareStopNarrative } from '../domain/journey/deriveStopNarrative'
import { previewDistrictRecommendations } from '../domain/previewDistrictRecommendations'
import { runGeneratePlan, type GenerationTrace } from '../domain/runGeneratePlan'
import { dedupeStringIds } from '../domain/utils/dedupeStringIds'
import {
  areStageOverlapFingerprintsEqual,
  computeJaccardOverlap,
  formatCollapsedIdPreview,
  formatIdList,
  formatJaccard,
  formatSignedScore,
  truncateText,
} from '../domain/utils/debugListHelpers'
import {
  buildCanonicalInterpretationBundle,
  formatExperienceContractActShape,
  normalizeExperienceContractVibe,
} from '../domain/interpretation/buildCanonicalInterpretationBundle'
import {
  buildStopTypeCandidateBoardFromIntent,
  resolveScenarioFamily,
  type StopTypeCandidateBoard,
} from '../domain/interpretation/discovery/stopTypeCandidateBoard'
import {
  buildScenarioNightsFromCandidateBoard,
  type BuiltScenarioNight,
  type BuiltScenarioStop,
} from '../domain/interpretation/construction/scenarioBuilder'
import type { ExperienceContract as InterpretationExperienceContract } from '../domain/interpretation/contracts/experienceContract'
import {
  buildContractGateWorld,
  type ContractAwareDistrictRankingResult,
  type ContractGateWorld,
} from '../domain/bearings/buildContractGateWorld'
import { buildGreatStopAdmissibilitySignal } from '../domain/bearings/buildGreatStopAdmissibilitySignal'
import {
  buildStrategyAdmissibleWorlds,
  type StrategyAdmissibleWorld,
} from '../domain/bearings/buildStrategyAdmissibleWorlds'
import { mapVenueToTasteInput } from '../domain/interpretation/taste/mapVenueToTasteInput'
import { interpretVenueTaste } from '../domain/interpretation/taste/interpretVenueTaste'
import {
  buildDistrictOpportunityProfiles,
  type BuildDistrictOpportunityProfilesResult,
} from '../engines/district'
import type {
  TasteOpportunityAggregation,
  TasteOpportunityRoleCandidate,
} from '../domain/interpretation/taste/aggregateTasteOpportunityFromVenues'
import { applyScenarioContractToAggregation } from '../domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { applyExperienceContractToAggregation } from '../domain/interpretation/taste/applyExperienceContractToOpportunityAggregation'
import { buildExperienceContractFromScenarioContract } from '../domain/interpretation/contracts/experienceContract'
import { deriveStep2AuthoritySignals } from '../domain/interpretation/taste/step2AuthorityConviction'
import {
  getHospitalityScenarioContract,
  type HospitalityScenarioContract,
} from '../domain/interpretation/taste/scenarioContracts'
import type { ArcCandidate, ScoredVenue } from '../domain/types/arc'
import type { ExperienceLens } from '../domain/types/experienceLens'
import type {
  ConciergeIntent,
  ContractConstraints,
  ExperienceContract,
  IntentProfile,
  PersonaMode,
  ResolvedDirectionContext,
  RoleInvariantProfile,
  RouteShapeContract,
  VibeAnchor,
} from '../domain/types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../domain/types/itinerary'
import type { RefinementMode } from '../domain/types/refinement'
import type { DistrictRecommendation } from '../domain/types/district'
import type { TasteSignals } from '../domain/interpretation/taste/types'

interface DemoPlanState {
  itinerary: Itinerary
  selectedArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  generationTrace: GenerationTrace
  intentProfile: IntentProfile
  lens: ExperienceLens
  conciergeIntent: ConciergeIntent
  experienceContract: ExperienceContract
  contractConstraints: ContractConstraints
  selectedDirectionContext: ResolvedDirectionContext
  selectedCluster: RealityCluster
  selectedClusterConfirmation: string
  selectedDirectionContract: DirectionPlanningSelection
  routeShapeContract: RouteShapeContract
  tasteCurationDebug?: TasteCurationDebug
  selectedDirectionPreviewContext?: SelectedDirectionPreviewContext
}

type CityOpportunityStopOption = {
  venueId: string
  name: string
  address?: string
  reason: string
  isOpenNow?: boolean
  score?: number
}

type CityOpportunityHappening = {
  id: string
  name: string
  type?: string
  timingLabel?: string
  timeWindowLabel?: string
  reason: string
  strength?: number
  hasEvent?: boolean
  hasPerformance?: boolean
  hasHappyHour?: boolean
}

type VerifiedCityOpportunity = {
  id: string
  flavor: string
  anchor: {
    venueId: string
    name: string
    address?: string
    district: string
    sourceType?: 'venue' | 'event' | 'hybrid'
    isOpenNow?: boolean
    timingLabel?: string
    verificationReasons: string[]
  }
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  nearbyHappenings: CityOpportunityHappening[]
  districtContext: {
    primaryDistrict: string
    secondaryDistricts?: string[]
  }
  fit: {
    persona: string
    vibe: string
    confidenceLine: string
    matchLine?: string
  }
  storySpine: {
    start: string
    highlight: string
    windDown: string
  }
  selection: {
    pocketId?: string
    directionId?: string
  }
  survivorSignals: {
    whyTonightStrength: number
    cozyAuthorityStrength: number
    highWhyTonight: boolean
    highCozyAuthority: boolean
  }
  excellence: {
    score: number
    threshold: number
    passes: boolean
    anchorStrength: number
    startQuality: number
    windDownQuality: number
    supportCoherence: number
    scenarioAlignment: number
    experienceAlignment: number
    localAuthority: number
    modeExcellence: number
  }
  whyTonightProofLine?: string
  scenarioNight?: BuiltScenarioNight
  scenarioPreviewModel?: BuiltScenarioNightPreviewModel
}

type BuiltScenarioPreviewStop = {
  venueId: string
  name: string
  position: BuiltScenarioStop['position']
  stopType: BuiltScenarioStop['stopType']
  momentLabel: string
  whyThisStop: string
  whyTonight?: string
  address?: string
  district?: string
  neighborhoodLabel?: string
  venueTypeLabel?: string
  factualSummary?: string
  venueFeatures?: string[]
  serviceOptions?: string[]
  sourceType?: BuiltScenarioStop['sourceType']
  evaluation?: BuiltScenarioStop['evaluation']
}

type BuiltScenarioNightPreviewModel = {
  nightId: string
  title: string
  flavorLine: string
  whyThisWorks: string
  evaluation?: BuiltScenarioNight['evaluation']
  stops: BuiltScenarioPreviewStop[]
}

type Step2BuiltNightCard = {
  id: string
  anchorName: string
  flavorLine: string
  traits: string[]
  storySpine: {
    start: string
    highlight: string
    windDown: string
  }
  districtLine: string
  whyChooseLine: string
  whyTonightProofLine?: string
  scenarioEvaluation?: BuiltScenarioNight['evaluation']
  selection: {
    pocketId?: string
    directionId?: string
  }
}

type ExplorationControlState = {
  exploration: 'focused' | 'exploratory'
  discovery: 'reliable' | 'discover'
  highlight: 'casual' | 'standout'
}

interface SelectedDirectionPreviewContext {
  directionId: string
  directionTitle: string
  pocketId?: string
  cluster: RealityCluster
  experienceFamily?: DirectionCandidate['experienceFamily']
  familyConfidence?: number
  subtitle?: string
  supportLine?: string
  whyNow?: string
  storySpinePreview?: RealityClusterCardCopy['storySpinePreview']
}

interface InlineAlternative {
  venueId: string
  name: string
  descriptor: string
}

interface SwapCandidatePrefilterDebug {
  swapCandidateDisplayCountBefore: number
  swapCandidateDisplayCountAfter: number
  canonicalIdentityResolvedCount: number
  canonicalIdentityMissingCount: number
  prefilteredSwapCandidateIds: string[]
  prefilterRejectReasonSummary: string[]
  swapDisplayUsesSharedHardStructuralCheck: boolean
}

interface InlineStopDetail {
  whyItFits: string
  tonightSignals?: string[]
  aroundHereSignals?: string[]
  knownFor: string
  goodToKnow: string
  localSignal?: string
  stopNarrativeWhyNow?: string
  stopNarrativeRoleMeaning?: string
  stopNarrativeTransitionLogic?: string
  stopNarrativeFlavorTags?: string[]
  stopNarrativeMode?: string
  stopNarrativeSource?: string
  stopFlavorSummary?: string
  stopTransitionSummary?: string
  alternatives?: InlineAlternative[]
  venueLinkUrl?: string
}

interface PreviewSwapState {
  role: UserStopRole
  targetRouteId: string
  targetStopId: string
  targetStopIndex: number
  targetRole: UserStopRole
  swapBeforeStopId: string
  requestedReplacementId: string
  originalStop: ItineraryStop
  candidateStop: ItineraryStop
  replacementCanonical: CanonicalPlanningStopIdentity
  swappedArc: ArcCandidate
  swappedItinerary: Itinerary
  descriptor: string
  whyItFits: string
  knownFor: string
  localSignal: string
  venueLinkUrl: string
  tradeoffSignal: string
  constraintSignal: string
  cascadeHint: string
}

interface SwapDebugBreadcrumb {
  swapTargetSlotIndex: number
  swapTargetRole: UserStopRole
  swapBeforeStopId: string
  swapRequestedReplacementId: string
  swapAppliedReplacementId: string | null
  postSwapCanonicalStopIdBySlot?: string[]
  postSwapRenderedStopIdBySlot?: string[]
  swapCommitSucceeded: boolean
  swapRenderSource: 'finalRoute'
  routeVersion: number
  mismatch: boolean
}

interface SwapInteractionBreadcrumb {
  swapClickFired: boolean
  swapHandlerEntered: boolean
  swapCandidateAtClickId: string | null
  swapCandidateCanonicalIdentityAtClick?: string | null
  candidateHasCanonicalIdentity?: boolean | null
  swapTargetSlotIndexAtClick: number | null
  swapTargetRoleAtClick: UserStopRole | null
  swapGuardFailureReason: string | null
  swapCommitStarted: boolean
  swapCommitFinished: boolean
  swapModalClosedAfterCommit: boolean
}

interface SwapCommitInvocation {
  role: UserStopRole
  swapSnapshot?: PreviewSwapState
  planSnapshot?: DemoPlanState
  finalRouteSnapshot?: FinalRoute
  routeVersionAtClick: number
}

interface SwapCompatibilityResult {
  swapCompatibilityPassed: boolean
  swapCompatibilityReason: string
  swapCompatibilityRejectClass: 'none' | 'hard_structural' | 'soft_direction_drift'
  preservedRole: boolean
  preservedDistrict: boolean
  preservedFamily: boolean
  preservedFeasibility: boolean
  softDirectionDriftDetected: boolean
}

interface GenerationContractDebugBreadcrumb {
  generationDriftReason: string | null
  missingRoleForContract: DirectionCoreRole | null
  contractBuildabilityStatus: DirectionContractBuildability['contractBuildabilityStatus']
  candidatePoolSufficiencyByRole: Record<DirectionCoreRole, number>
  expectedDirectionIdentity: DirectionIdentityMode
  observedDirectionIdentity: DirectionIdentityMode
  fallbackApplied: boolean
  thinPoolRelaxationTrace?: DirectionContractValidationResult['thinPoolRelaxationTrace']
}

type CoreTasteRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

interface TasteRoleEligibilitySnapshot {
  score: number
  floor: number
  passed: boolean
  reason: string
}

interface TasteVenuePersonalityProfile {
  intimate: boolean
  social: boolean
  destination: boolean
  lingering: boolean
  quickStop: boolean
  experiential: boolean
  calm: boolean
  highIntensity: boolean
  lowFriction: boolean
  summary: string
}

interface TasteCandidateQualification {
  candidateId: string
  highlightQualificationScore: number
  highlightQualificationPassed: boolean
  roleEligibility: Record<CoreTasteRole, TasteRoleEligibilitySnapshot>
  venuePersonality: TasteVenuePersonalityProfile
}

interface StrongCurationTasteBias {
  highlightFloor: number
  startFloor: number
  windDownFloor: number
  summary: string
}

interface StrongCurationTastePassResult {
  selectedArc: ArcCandidate
  itinerary: Itinerary
  scoredVenues: ScoredVenue[]
  qualificationByCandidateId: Record<string, TasteCandidateQualification>
  personaVibeTasteBiasSummary: string
  thinPoolHighlightFallbackApplied: boolean
  highlightPoolCountBefore: number
  highlightPoolCountAfter: number
  rolePoolCountByRoleBefore: Record<CoreTasteRole, number>
  rolePoolCountByRoleAfter: Record<CoreTasteRole, number>
  signatureHighlightShortlistCount: number
  signatureHighlightShortlistIds: string[]
  highlightShortlistScoreSummary: string
  selectedHighlightFromShortlist: boolean
  selectedHighlightShortlistRank: number | null
  fallbackToQualifiedHighlightPool: boolean
  upstreamPoolSelectionApplied: boolean
  postGenerationRepairCount: number
  rolePoolVenueIdsByRole: Record<CoreTasteRole, string[]>
  rolePoolVenueIdsCombined: string[]
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

interface TasteCurationDebug {
  highlightQualificationScore: number | null
  highlightQualificationPassed: boolean | null
  tasteRoleEligibilityByRole: Record<CoreTasteRole, string>
  personaVibeTasteBiasSummary: string
  venuePersonalitySummary: string
  thinPoolHighlightFallbackApplied: boolean
  highlightPoolCountBefore: number
  highlightPoolCountAfter: number
  rolePoolCountByRoleBefore: Record<CoreTasteRole, number>
  rolePoolCountByRoleAfter: Record<CoreTasteRole, number>
  signatureHighlightShortlistCount: number
  signatureHighlightShortlistIds: string[]
  highlightShortlistScoreSummary: string
  selectedHighlightFromShortlist: boolean
  selectedHighlightShortlistRank: number | null
  fallbackToQualifiedHighlightPool: boolean
  upstreamPoolSelectionApplied: boolean
  postGenerationRepairCount: number
  rolePoolVenueIdsByRole: Record<CoreTasteRole, string[]>
  rolePoolVenueIdsCombined: string[]
  thinPoolRelaxationTrace: StrongCurationTastePassResult['thinPoolRelaxationTrace']
}

interface StageOverlapFingerprint {
  scenarioKey: string
  topPocketIds: string[]
  directionCandidatePocketIds: string[]
  retrievedVenueIds: string[]
  rolePoolVenueIds: string[]
  highlightShortlistIds: string[]
  finalStopVenueIds: string[]
}

interface SignatureHighlightShortlistEntry {
  candidate: ScoredVenue
  score: number
}

const personaOptions: Array<{ label: string; value: PersonaMode }> = [
  { label: 'Romantic', value: 'romantic' },
  { label: 'Friends', value: 'friends' },
  { label: 'Family', value: 'family' },
]

const vibeOptions: Array<{ label: string; value: VibeAnchor }> = [
  { label: 'Lively', value: 'lively' },
  { label: 'Cozy', value: 'cozy' },
  { label: 'Cultured', value: 'cultured' },
]

const clusterRefinementMap: Record<RealityCluster, RefinementMode[]> = {
  lively: ['more-exciting'],
  chill: ['more-relaxed'],
  explore: ['more-unique'],
}
const ALL_DISTRICTS_CONTEXT_ID = 'all_districts'
const DEFAULT_ECS_STATE: ExplorationControlState = {
  exploration: 'focused',
  discovery: 'reliable',
  highlight: 'standout',
}
const ECS_EXPLORATION_OPTIONS: Array<{
  value: ExplorationControlState['exploration']
  label: string
}> = [
  { value: 'focused', label: 'Focused' },
  { value: 'exploratory', label: 'Exploratory' },
]
const ECS_DISCOVERY_OPTIONS: Array<{
  value: ExplorationControlState['discovery']
  label: string
}> = [
  { value: 'reliable', label: 'Reliable' },
  { value: 'discover', label: 'Discover' },
]
const ECS_HIGHLIGHT_OPTIONS: Array<{
  value: ExplorationControlState['highlight']
  label: string
}> = [
  { value: 'casual', label: 'Casual' },
  { value: 'standout', label: 'Standout' },
]

type PreviewShapeIntent =
  | 'more_lively'
  | 'more_relaxed'
  | 'shorter_moves'
  | 'different_centerpiece'

type PreviewAdjustableRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

const PREVIEW_ADJUSTABLE_ROLES: PreviewAdjustableRole[] = ['start', 'highlight', 'windDown']

function getPreviewRoleLabel(role: PreviewAdjustableRole): 'Start' | 'Highlight' | 'Wind-down' {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  return 'Wind-down'
}

function getPreviewRoleTone(role: PreviewAdjustableRole): string {
  if (role === 'start') {
    return 'Ease in'
  }
  if (role === 'highlight') {
    return 'Peak moment'
  }
  return 'Land cleanly'
}

function getPreviewStopDetailLines(role: PreviewAdjustableRole): [string, string] {
  if (role === 'start') {
    return [
      'Ease in with a gentle opener.',
      'Sets a smooth move into the center.',
    ]
  }
  if (role === 'highlight') {
    return [
      'Peak moment and center of the night.',
      'Strongest beat in this route.',
    ]
  }
  return [
    'Land cleanly with a softer finish.',
    'Close calmly without stretching the route.',
  ]
}

function getPreviewSwapFeedback(role: UserStopRole | null): string | null {
  if (!role) {
    return null
  }
  if (role === 'start') {
    return 'Updated: shorter opening, same overall flow.'
  }
  if (role === 'highlight') {
    return 'Updated: stronger center, with the route structure preserved.'
  }
  if (role === 'windDown') {
    return "Updated: softer landing, without changing the night's pacing."
  }
  return null
}

const PREVIEW_SHAPE_ACTIONS: Array<{
  intent: PreviewShapeIntent
  label: string
  appliedFeedback: string
  stableFeedback: string
}> = [
  {
    intent: 'more_lively',
    label: 'More lively',
    appliedFeedback: 'Updated: livelier peak, same walkable footprint.',
    stableFeedback: 'Already at the strongest lively profile in this route set.',
  },
  {
    intent: 'more_relaxed',
    label: 'More relaxed',
    appliedFeedback: 'Updated: softer pacing around the main stop.',
    stableFeedback: 'Already at the calmest pacing available in this route set.',
  },
  {
    intent: 'shorter_moves',
    label: 'Shorter moves',
    appliedFeedback: 'Updated: shorter opening, same overall flow.',
    stableFeedback: 'Already using the tightest movement profile available.',
  },
  {
    intent: 'different_centerpiece',
    label: 'Stronger center',
    appliedFeedback: 'Updated: stronger center, with the route structure preserved.',
    stableFeedback: 'The highlight is already the strongest center available.',
  },
]

function buildPreviewShapeCorpus(entry: RealityDirectionCard): string {
  const parts = [
    entry.cluster,
    entry.card.title,
    entry.card.subtitle,
    entry.card.whyNow,
    entry.card.whyYou,
    entry.debugMeta?.directionNarrativeSummary,
    entry.debugMeta?.directionDistrictSupportSummary,
    entry.debugMeta?.directionStrategySummary,
    entry.debugMeta?.directionMovementStyle,
    entry.debugMeta?.directionPeakModel,
    entry.debugMeta?.directionStrategyId,
    entry.debugMeta?.pocketLabel,
  ]
  return parts
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .toLowerCase()
}

function countShapeTerms(corpus: string, terms: string[]): number {
  return terms.reduce((total, term) => total + (corpus.includes(term) ? 1 : 0), 0)
}

function scorePreviewShapeCandidate(
  entry: RealityDirectionCard,
  intent: PreviewShapeIntent,
  baseline: RealityDirectionCard | undefined,
): number {
  const corpus = buildPreviewShapeCorpus(entry)
  const strategyId = entry.debugMeta?.directionStrategyId ?? ''
  const baselineStrategyId = baseline?.debugMeta?.directionStrategyId ?? ''
  const pocketId = entry.debugMeta?.pocketId ?? entry.id
  const baselinePocketId = baseline?.debugMeta?.pocketId ?? baseline?.id ?? ''

  if (intent === 'more_lively') {
    return (
      (entry.cluster === 'lively' ? 4 : 0) +
      countShapeTerms(corpus, ['lively', 'social', 'energy', 'pulse', 'peak', 'late']) * 1.15 +
      countShapeTerms(corpus, ['calm', 'cozy', 'relaxed', 'quiet']) * -0.6
    )
  }
  if (intent === 'more_relaxed') {
    return (
      (entry.cluster === 'chill' ? 4 : 0) +
      countShapeTerms(corpus, ['relaxed', 'calm', 'cozy', 'soft', 'linger', 'intimate']) * 1.15 +
      countShapeTerms(corpus, ['high energy', 'lively', 'pulse']) * -0.7
    )
  }
  if (intent === 'shorter_moves') {
    return (
      countShapeTerms(corpus, ['short', 'tight', 'compact', 'contained', 'walkable', 'nearby']) *
        1.2 +
      countShapeTerms(corpus, ['spread', 'broad', 'explor']) * -0.7
    )
  }
  return (
    (baseline && entry.id !== baseline.id ? 2.4 : -3) +
    (strategyId && baselineStrategyId && strategyId !== baselineStrategyId ? 1.8 : 0) +
    (pocketId && baselinePocketId && pocketId !== baselinePocketId ? 1.2 : 0) +
    countShapeTerms(corpus, ['center', 'centerpiece', 'central', 'anchor', 'highlight', 'peak']) *
      0.7
  )
}

function normalizeDistrictSignalText(raw: string | undefined): string {
  if (!raw) {
    return 'Supports a smooth route through nearby spots.'
  }
  const cleaned = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length === 0) {
    return 'Supports a smooth route through nearby spots.'
  }
  const normalized = cleaned
    .replace(/\bhigh activation core\b/gi, 'lively center activity')
    .replace(/\bactivation core\b/gi, 'active center')
    .replace(/\bcompact energy\b/gi, 'tight neighborhood rhythm')
  const sentence = normalized[0].toUpperCase() + normalized.slice(1)
  return sentence.endsWith('.') ? sentence : `${sentence}.`
}

function describeDistrictSignals(params: {
  density?: number
  walkability?: number
  energyBand?: 'low' | 'medium' | 'high'
  radiusM?: number
  supportSignal?: string
}): {
  movementStyle: string
  energyPattern: string
  spatialFeel: string
  supportSignal: string
} {
  const { density, walkability, energyBand, radiusM, supportSignal } = params

  let movementStyle = 'Mostly easy movement between nearby spots.'
  if ((typeof walkability === 'number' && walkability >= 0.8) || (typeof radiusM === 'number' && radiusM <= 900)) {
    movementStyle = 'Short walks between most stops.'
  } else if (
    (typeof walkability === 'number' && walkability <= 0.4) ||
    (typeof radiusM === 'number' && radiusM >= 1800)
  ) {
    movementStyle = 'More spread-out movement between pockets.'
  }

  let energyPattern = 'Energy stays steady through the evening.'
  if (energyBand === 'high') {
    energyPattern = 'Energy builds toward a lively center.'
  } else if (energyBand === 'low') {
    energyPattern = 'Energy stays relaxed and low-key.'
  }

  let spatialFeel = 'Balanced layout across nearby pockets.'
  if (typeof density === 'number' && density >= 0.8) {
    spatialFeel = 'Clustered layout with a tight footprint.'
  } else if (typeof density === 'number' && density <= 0.4) {
    spatialFeel = 'Open layout with more room between stops.'
  }

  return {
    movementStyle,
    energyPattern,
    spatialFeel,
    supportSignal: normalizeDistrictSignalText(supportSignal),
  }
}

function deriveBestFit(supportedDirectionCount: number): string {
  if (supportedDirectionCount >= 2) {
    return 'exploratory, flexible nights'
  }
  if (supportedDirectionCount === 1) {
    return 'focused, intentional nights'
  }
  return 'quieter, low-variation plans'
}

function getNightOptionTitle(
  aggregation: TasteOpportunityAggregation | undefined,
  fallbackLabel: string,
): string {
  if (!aggregation) {
    return fallbackLabel.trim().length > 0 ? fallbackLabel : 'Intent-matched pick'
  }
  const topMoment = aggregation.moments.primary[0]
  const highlightType = (aggregation.signatures.highlightTypes[0] ?? '').toLowerCase()
  const anchorReason = (
    aggregation.anchors.strongestHighlight?.reason ??
    topMoment?.reason ??
    ''
  ).toLowerCase()
  if (topMoment?.momentType === 'temporal') {
    return 'Temporal pulse'
  }
  if (topMoment?.momentType === 'discovery') {
    return 'Discovery drift'
  }
  if (topMoment?.momentType === 'community') {
    return 'Community rhythm'
  }
  if (highlightType.includes('cultural') || anchorReason.includes('cultural')) {
    return 'Cultural linger'
  }
  if (highlightType.includes('live') || anchorReason.includes('live')) {
    return 'Live-music drift'
  }
  if (highlightType.includes('signature') || anchorReason.includes('signature')) {
    return 'Signature anchor'
  }
  if (aggregation.summary.dominantEnergy === 'lively') {
    return 'Lively pulse'
  }
  if (aggregation.summary.dominantEnergy === 'calm') {
    return 'Intimate anchor'
  }
  return 'Balanced anchor'
}

function getNightOptionConfidenceLine(
  aggregation: TasteOpportunityAggregation | undefined,
): string {
  if (!aggregation) {
    return 'Balanced movement with reliable route support'
  }
  const movement =
    aggregation.summary.movementProfile === 'tight'
      ? 'Tight movement'
      : aggregation.summary.movementProfile === 'spread'
        ? 'More open movement'
        : 'Balanced movement'
  const highlightConfidence =
    aggregation.summary.highlightPotential === 'high'
      ? 'high anchor confidence'
      : aggregation.summary.highlightPotential === 'medium'
        ? 'steady anchor confidence'
        : 'emerging anchor confidence'
  return `${movement} with ${highlightConfidence}`
}

function getNightOptionAnchorReason(
  aggregation: TasteOpportunityAggregation | undefined,
): string | undefined {
  const raw =
    aggregation?.anchors.strongestHighlight?.reason ??
    aggregation?.moments.primary[0]?.reason
  if (!raw) {
    return undefined
  }
  const normalized = raw.trim()
  if (!normalized) {
    return undefined
  }
  return normalized.charAt(0).toLowerCase() + normalized.slice(1)
}

function getNightOptionSupportLine(
  aggregation: TasteOpportunityAggregation | undefined,
): {
  openerHints: string[]
  windDownHints: string[]
  line: string
} {
  if (!aggregation) {
    return {
      openerHints: [],
      windDownHints: [],
      line: 'Role-ready starts and closes available nearby',
    }
  }
  const openerHint =
    aggregation.ingredients.startCandidates[0]?.venueName ??
    aggregation.signatures.openerTypes[0]
  const windDownHint =
    aggregation.ingredients.windDownCandidates[0]?.venueName ??
    aggregation.signatures.windDownTypes[0]
  if (openerHint && windDownHint) {
    return {
      openerHints: [openerHint],
      windDownHints: [windDownHint],
      line: `Start: ${openerHint} | Close: ${windDownHint}`,
    }
  }
  if (openerHint) {
    return {
      openerHints: [openerHint],
      windDownHints: [],
      line: `Start support: ${openerHint}`,
    }
  }
  if (windDownHint) {
    return {
      openerHints: [],
      windDownHints: [windDownHint],
      line: `Close support: ${windDownHint}`,
    }
  }
  return {
    openerHints: [],
    windDownHints: [],
    line: 'Role-ready starts and closes available nearby',
  }
}

function toLowerSentence(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  return normalized.charAt(0).toLowerCase() + normalized.slice(1)
}

function toSentenceCase(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1)
  return sentence.endsWith('.') ? sentence : `${sentence}.`
}

function toConciseRoleReason(
  role: 'start' | 'windDown',
  rawReason: string | undefined,
  fallbackReason: string,
): string {
  const reason = (rawReason ?? '').toLowerCase()
  if (role === 'start') {
    if (reason.includes('easy') || reason.includes('entry')) {
      return 'easier opener'
    }
    if (reason.includes('conversation') || reason.includes('social')) {
      return 'social opener'
    }
    if (reason.includes('steady')) {
      return 'steady opener'
    }
    if (reason.includes('nearby')) {
      return 'nearby opener'
    }
    return fallbackReason
  }
  if (reason.includes('soft') || reason.includes('calm') || reason.includes('landing')) {
    return 'soft close'
  }
  if (reason.includes('quiet')) {
    return 'quiet finish'
  }
  if (reason.includes('steady')) {
    return 'steady close'
  }
  if (reason.includes('nearby')) {
    return 'nearby close'
  }
  return fallbackReason
}

type AggregatedMoment = TasteOpportunityAggregation['moments']['primary'][number]

function getAnchorMoment(
  aggregation: TasteOpportunityAggregation | undefined,
  anchorVenueId: string | undefined,
): AggregatedMoment | undefined {
  if (!aggregation || !anchorVenueId) {
    return undefined
  }
  const pooled = [...aggregation.moments.primary, ...aggregation.moments.secondary]
  return pooled.find((moment) => moment.venueId === anchorVenueId)
}

function getMomentTimingLabel(moment: AggregatedMoment | undefined): string | undefined {
  if (!moment) {
    return undefined
  }
  const windowLabel = (moment.liveContext?.timeWindowLabel ?? '').toLowerCase()
  if (moment.liveContext?.hasHappyHour) {
    return 'Happy hour timing'
  }
  if (moment.liveContext?.hasPerformance) {
    return 'Performance timing'
  }
  if (windowLabel === 'late') {
    return 'Late-night relevant'
  }
  if (windowLabel === 'evening') {
    return 'Tonight relevant'
  }
  if (windowLabel === 'day') {
    return 'Day-to-evening option'
  }
  if (moment.momentType === 'temporal') {
    return 'Good right now'
  }
  return undefined
}

function getVerifiedOpportunityFlavor(
  aggregation: TasteOpportunityAggregation | undefined,
  fallbackLabel: string,
  scenarioContract: HospitalityScenarioContract | null,
): string {
  if (scenarioContract?.persona === 'romantic') {
    if (scenarioContract.vibe === 'cozy') {
      return 'Intimate romantic night'
    }
    if (scenarioContract.vibe === 'lively') {
      return 'Pulse-forward romantic night'
    }
    if (scenarioContract.vibe === 'cultured') {
      return 'Curated romantic night'
    }
  }
  const normalizedFallback = normalizeQualityText(fallbackLabel)
  if (normalizedFallback.includes('cultural') || normalizedFallback.includes('gallery')) {
    return 'Cultural-led night'
  }
  if (normalizedFallback.includes('live') || normalizedFallback.includes('lively')) {
    return 'Live-energy night'
  }
  if (aggregation?.summary.dominantEnergy === 'lively') {
    return 'Lively anchored night'
  }
  if (aggregation?.summary.dominantEnergy === 'calm') {
    return 'Calm anchored night'
  }
  return 'Intent-matched night'
}

function getVerifiedAnchorReasons(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorMoment: AggregatedMoment | undefined
  confidenceLine: string
  hasSupportStops: boolean
}): string[] {
  const { aggregation, anchorMoment, confidenceLine, hasSupportStops } = params
  const reasons: string[] = []
  const canonicalReason = getCityOpportunityAnchorReason(aggregation)
  if (canonicalReason) {
    reasons.push(toSentenceCase(canonicalReason))
  }
  if (aggregation?.summary.highlightPotential === 'high') {
    reasons.push('High-confidence highlight nearby.')
  } else if (aggregation?.summary.highlightPotential === 'medium') {
    reasons.push('Reliable highlight with steady support.')
  }
  if (anchorMoment?.momentType === 'discovery') {
    reasons.push('Discovery-worthy anchor for tonight.')
  }
  if (anchorMoment?.momentType === 'temporal') {
    reasons.push('Timing-relevant anchor for tonight.')
  }
  if (anchorMoment?.momentType === 'community') {
    reasons.push('Community energy around this anchor.')
  }
  const timingLabel = getMomentTimingLabel(anchorMoment)
  if (timingLabel) {
    reasons.push(`${timingLabel}.`)
  }
  if (hasSupportStops) {
    reasons.push('Easy start and close nearby.')
  }
  if (reasons.length === 0) {
    reasons.push(toSentenceCase(confidenceLine))
  }
  return Array.from(new Set(reasons)).slice(0, 2)
}

function getCityOpportunityAnchorReason(
  aggregation: TasteOpportunityAggregation | undefined,
): string {
  const canonical = getNightOptionAnchorReason(aggregation)
  if (canonical) {
    return canonical
  }
  return 'strong central fit for your intent'
}

function toCityOpportunityStopOptions(
  candidates: TasteOpportunityRoleCandidate[] | undefined,
  role: 'start' | 'windDown',
): CityOpportunityStopOption[] {
  return (candidates ?? [])
    .slice(0, 2)
    .map((candidate) => ({
      venueId: candidate.venueId,
      name: candidate.venueName,
      reason: toConciseRoleReason(
        role,
        candidate.reason,
        role === 'start' ? 'easy opener' : 'soft close nearby',
      ),
      score: candidate.score,
    }))
    .filter((candidate) => candidate.name.trim().length > 0)
}

function getCityOpportunityHappenings(
  aggregation: TasteOpportunityAggregation | undefined,
): CityOpportunityHappening[] {
  if (!aggregation) {
    return []
  }
  const priorityByType: Record<AggregatedMoment['momentType'], number> = {
    temporal: 5,
    discovery: 4,
    community: 3,
    supporting: 2,
    anchor: 1,
  }
  return [...aggregation.moments.primary, ...aggregation.moments.secondary]
    .filter((moment) => moment.momentType !== 'anchor' && moment.strength >= 0.6)
    .sort((left, right) => {
      const priorityDiff = (priorityByType[right.momentType] ?? 0) - (priorityByType[left.momentType] ?? 0)
      if (priorityDiff !== 0) {
        return priorityDiff
      }
      if (right.strength !== left.strength) {
        return right.strength - left.strength
      }
      return left.id.localeCompare(right.id)
    })
    .filter((moment, index, all) => all.findIndex((entry) => entry.title === moment.title) === index)
    .slice(0, 2)
    .map((moment) => ({
      id: moment.id,
      name: moment.title,
      type: moment.momentType,
      timingLabel: getMomentTimingLabel(moment),
      timeWindowLabel: moment.liveContext?.timeWindowLabel,
      strength: moment.strength,
      hasEvent: moment.liveContext?.hasEvent,
      hasPerformance: moment.liveContext?.hasPerformance,
      hasHappyHour: moment.liveContext?.hasHappyHour,
      reason:
        moment.momentType === 'temporal'
          ? 'timely nearby moment'
          : moment.momentType === 'discovery'
            ? 'discovery pull nearby'
            : moment.momentType === 'community'
              ? 'community energy nearby'
              : toLowerSentence(moment.reason) || 'relevant nearby moment',
    }))
}

function normalizeQualityText(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasLoosePhraseMatch(value: string, phrase: string): boolean {
  const left = normalizeQualityText(value)
  const right = normalizeQualityText(phrase)
  if (!left || !right) {
    return false
  }
  return left.includes(right) || right.includes(left)
}

function matchesScenarioVenue(name: string | undefined, venues: string[] | undefined): boolean {
  if (!name || !venues || venues.length === 0) {
    return false
  }
  return venues.some((entry) => hasLoosePhraseMatch(name, entry))
}

function toHighlightTierScore(tier: number | undefined, fallbackScore: number): number {
  if (tier === 1) {
    return 1
  }
  if (tier === 2) {
    return 0.72
  }
  if (tier === 3) {
    return 0.44
  }
  return clampScore(fallbackScore)
}

function toHighlightPotentialScore(
  value: TasteOpportunityAggregation['summary']['highlightPotential'] | undefined,
): number {
  if (value === 'high') {
    return 1
  }
  if (value === 'medium') {
    return 0.72
  }
  return 0.44
}

function toMovementTightnessScore(
  value: TasteOpportunityAggregation['summary']['movementProfile'] | undefined,
): number {
  if (value === 'tight') {
    return 1
  }
  if (value === 'moderate') {
    return 0.76
  }
  return 0.52
}

function toDiscoveryBalanceScore(
  value: TasteOpportunityAggregation['summary']['discoveryBalance'] | undefined,
): number {
  if (value === 'novel') {
    return 1
  }
  if (value === 'balanced') {
    return 0.68
  }
  return 0.42
}

function getStopAverageScore(options: CityOpportunityStopOption[]): number {
  if (options.length === 0) {
    return 0
  }
  const scored = options
    .slice(0, 2)
    .map((entry) => entry.score ?? 0.5)
  if (scored.length === 0) {
    return 0
  }
  return clampScore(scored.reduce((sum, value) => sum + value, 0) / scored.length)
}

function getRoleContractFitScore(
  role: 'start' | 'windDown',
  options: CityOpportunityStopOption[],
  contract: HospitalityScenarioContract | null,
): number {
  if (!contract) {
    return 0.56
  }
  const targetRule = contract.stopRules.find((rule) => rule.stopType === role)
  if (!targetRule) {
    return 0.56
  }
  if (options.length === 0) {
    return 0
  }
  const corpus = normalizeQualityText(
    options
      .slice(0, 2)
      .map((entry) => `${entry.name} ${entry.reason}`)
      .join(' '),
  )
  if (!corpus) {
    return 0
  }
  const candidateSignals = [targetRule.purpose, ...(targetRule.examples ?? [])]
  const matchedSignals = candidateSignals.filter((signal) => hasLoosePhraseMatch(corpus, signal)).length
  const baseMatch = candidateSignals.length > 0 ? matchedSignals / candidateSignals.length : 0

  const lexicalBoost =
    role === 'start'
      ? ['opener', 'entry', 'social', 'aperitivo', 'cocktail'].some((token) => corpus.includes(token))
        ? 0.16
        : 0
      : ['close', 'nightcap', 'late', 'quiet', 'soft', 'landing'].some((token) =>
            corpus.includes(token),
          )
        ? 0.16
        : 0

  return clampScore(baseMatch * 0.7 + lexicalBoost + 0.22)
}

function getHiddenGemPresenceScore(params: {
  contract: HospitalityScenarioContract | null
  anchorName: string | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { contract, anchorName, starts, closes, happenings } = params
  if (!contract) {
    return 0.5
  }
  const preferred = contract.hiddenGemRules.preferredHiddenGemVenues ?? []
  if (preferred.length === 0) {
    return 0.5
  }
  const surfaceNames = [
    anchorName ?? '',
    ...starts.slice(0, 2).map((entry) => entry.name),
    ...closes.slice(0, 2).map((entry) => entry.name),
    ...happenings.slice(0, 2).map((entry) => entry.name),
  ]
  const matches = surfaceNames.filter((name) => matchesScenarioVenue(name, preferred)).length
  if (matches > 0) {
    return clampScore(0.72 + Math.min(matches, 2) * 0.14)
  }
  if ((contract.hiddenGemRules.minimumHiddenGemStops ?? 0) > 0) {
    return 0.26
  }
  return 0.46
}

function getMomentBiasAlignmentScore(
  aggregation: TasteOpportunityAggregation | undefined,
  anchorMoment: AggregatedMoment | undefined,
  happenings: CityOpportunityHappening[],
  contract: HospitalityScenarioContract | null,
): number {
  if (!aggregation || !contract?.selectionBias?.momentTypeBoosts) {
    return 0.5
  }
  const boosts = contract.selectionBias.momentTypeBoosts
  const entries = Object.entries(boosts).filter(([, value]) => typeof value === 'number' && value > 0)
  if (entries.length === 0) {
    return 0.5
  }
  const maxBoost = Math.max(...entries.map(([, value]) => value as number), 0.01)
  const happeningTypes = happenings.map((entry) => entry.type).filter(Boolean)
  const anchorType = anchorMoment?.momentType
  const weightedTypeMatch = entries.reduce((sum, [momentType, boostValue]) => {
    const normalizedBoost = (boostValue as number) / maxBoost
    const matchesAnchor = anchorType === momentType
    const matchesHappening = happeningTypes.includes(momentType)
    return sum + (matchesAnchor || matchesHappening ? normalizedBoost : 0)
  }, 0)
  const normalizedMatch = weightedTypeMatch / entries.length
  const discoveryBalanceScore = toDiscoveryBalanceScore(aggregation.summary.discoveryBalance)
  return clampScore(normalizedMatch * 0.78 + discoveryBalanceScore * 0.22)
}

function getStorySpineCoherenceScore(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorName: string
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  startQuality: number
  windDownQuality: number
}): number {
  const { aggregation, anchorName, starts, closes, startQuality, windDownQuality } = params
  const topStart = starts[0]?.name?.trim() ?? ''
  const topClose = closes[0]?.name?.trim() ?? ''
  const normalizedAnchor = anchorName.trim().toLowerCase()
  const normalizedStart = topStart.toLowerCase()
  const normalizedClose = topClose.toLowerCase()
  const hasBothSupport = starts.length > 0 && closes.length > 0
  const supportCoverage = hasBothSupport ? 1 : starts.length > 0 || closes.length > 0 ? 0.58 : 0
  const uniqueCount = new Set([normalizedAnchor, normalizedStart, normalizedClose].filter(Boolean)).size
  const distinctness = uniqueCount >= 3 ? 1 : uniqueCount === 2 ? 0.62 : 0.22
  const supportStrength = clampScore((startQuality + windDownQuality) / 2)
  const movementTightness = toMovementTightnessScore(aggregation?.summary.movementProfile)
  return clampScore(
    supportCoverage * 0.38 +
      distinctness * 0.26 +
      supportStrength * 0.24 +
      movementTightness * 0.12,
  )
}

function getDiscoveryLocalStrengthScore(
  aggregation: TasteOpportunityAggregation | undefined,
  happenings: CityOpportunityHappening[],
  hiddenGemPresence: number,
): number {
  const happeningStrength = happenings
    .slice(0, 2)
    .reduce((sum, happening) => {
      const baseTypeScore =
        happening.type === 'temporal'
          ? 0.92
          : happening.type === 'discovery'
            ? 0.88
            : happening.type === 'community'
              ? 0.82
              : 0.58
      return sum + baseTypeScore * (happening.strength ?? 0.62)
    }, 0)
  const normalizedHappenings = happenings.length > 0 ? happeningStrength / happenings.length : 0
  const discoveryBalance = toDiscoveryBalanceScore(aggregation?.summary.discoveryBalance)
  return clampScore(normalizedHappenings * 0.58 + discoveryBalance * 0.24 + hiddenGemPresence * 0.18)
}

function getScenarioAlignmentScore(params: {
  contract: HospitalityScenarioContract | null
  aggregation: TasteOpportunityAggregation | undefined
  anchorName: string
  anchorMoment: AggregatedMoment | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { contract, aggregation, anchorName, anchorMoment, starts, closes, happenings } = params
  if (!contract) {
    return 0.56
  }
  const preferredAnchors = [
    ...(contract.anchorRules.defaultPrimaryAnchors ?? []),
    ...(contract.anchorRules.stronglyPreferredVenues ?? []),
  ]
  const avoidAnchors = contract.anchorRules.avoidVenues ?? []
  const anchorPreference =
    matchesScenarioVenue(anchorName, preferredAnchors)
      ? 1
      : matchesScenarioVenue(anchorName, avoidAnchors)
        ? 0.1
        : 0.52
  const startFit = getRoleContractFitScore('start', starts, contract)
  const windDownFit = getRoleContractFitScore('windDown', closes, contract)
  const hiddenGemPresence = getHiddenGemPresenceScore({
    contract,
    anchorName,
    starts,
    closes,
    happenings,
  })
  const momentBiasAlignment = getMomentBiasAlignmentScore(
    aggregation,
    anchorMoment,
    happenings,
    contract,
  )
  const roleBoosts = contract.selectionBias?.roleBoosts
  const roleBias =
    roleBoosts != null
      ? clampScore(
          ((roleBoosts.start ?? 0) + (roleBoosts.highlight ?? 0) + (roleBoosts.windDown ?? 0)) / 0.24,
        )
      : 0.5
  const avoidPenalty =
    matchesScenarioVenue(anchorName, avoidAnchors) ||
    starts.some((entry) => matchesScenarioVenue(entry.name, avoidAnchors)) ||
    closes.some((entry) => matchesScenarioVenue(entry.name, avoidAnchors))
      ? 0.22
      : 0

  return clampScore(
    anchorPreference * 0.34 +
      startFit * 0.2 +
      windDownFit * 0.2 +
      hiddenGemPresence * 0.14 +
      momentBiasAlignment * 0.08 +
      roleBias * 0.04 -
      avoidPenalty,
  )
}

function getExperienceContractAlignmentScore(params: {
  contract: InterpretationExperienceContract | null
  aggregation: TasteOpportunityAggregation | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { contract, aggregation, starts, closes, happenings } = params
  if (!contract || !aggregation) {
    return 0.56
  }

  let score = 0.56
  const energy = aggregation.summary.dominantEnergy
  const socialDensity = aggregation.summary.dominantSocialDensity
  const movement = aggregation.summary.movementProfile
  const discovery = aggregation.summary.discoveryBalance
  const highlightPotential = aggregation.summary.highlightPotential
  const hasTemporal = happenings.some((entry) => entry.type === 'temporal')
  const hasDiscoveryLike = happenings.some(
    (entry) => entry.type === 'discovery' || entry.type === 'community',
  )
  const supportCoverage = starts.length > 0 && closes.length > 0 ? 1 : 0.62

  if (
    contract.coordinationMode === 'pulse' ||
    contract.highlightModel === 'multi_peak' ||
    contract.pacingStyle === 'escalating'
  ) {
    score += energy === 'lively' ? 0.18 : energy === 'balanced' ? 0.08 : -0.12
    score += highlightPotential === 'high' ? 0.08 : highlightPotential === 'medium' ? 0.03 : -0.08
    score += movement === 'spread' || movement === 'moderate' ? 0.06 : -0.04
    score += hasTemporal ? 0.06 : -0.03
  }

  if (
    contract.coordinationMode === 'depth' ||
    contract.highlightModel === 'earned_peak' ||
    contract.pacingStyle === 'slow_build'
  ) {
    score += energy === 'calm' ? 0.14 : energy === 'balanced' ? 0.04 : -0.08
    score += socialDensity === 'intimate' ? 0.1 : socialDensity === 'mixed' ? 0.03 : -0.05
    score += movement === 'tight' || movement === 'moderate' ? 0.06 : -0.05
    score += discovery === 'balanced' ? 0.04 : discovery === 'familiar' ? 0.02 : -0.02
  }

  if (
    contract.coordinationMode === 'narrative' ||
    contract.highlightModel === 'reflective_peak' ||
    contract.pacingStyle === 'deliberate'
  ) {
    score += discovery === 'novel' ? 0.14 : discovery === 'balanced' ? 0.06 : -0.08
    score += energy === 'calm' || energy === 'balanced' ? 0.06 : -0.05
    score += movement === 'moderate' || movement === 'spread' ? 0.05 : -0.03
    score += hasDiscoveryLike ? 0.06 : -0.02
    score += hasTemporal ? -0.02 : 0
  }

  if (contract.socialPosture === 'shared_pulse') {
    score += socialDensity === 'social' ? 0.08 : socialDensity === 'mixed' ? 0.03 : -0.06
  } else if (contract.socialPosture === 'intimate') {
    score += socialDensity === 'intimate' ? 0.08 : socialDensity === 'mixed' ? 0.02 : -0.05
  } else if (contract.socialPosture === 'reflective') {
    score += hasDiscoveryLike ? 0.05 : 0
  }

  score += supportCoverage * 0.05
  return clampScore(score)
}

function getLiveEventRelevanceScore(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorMoment: AggregatedMoment | undefined
  happenings: CityOpportunityHappening[]
  scenarioContract: HospitalityScenarioContract | null
}): number {
  const { aggregation, anchorMoment, happenings, scenarioContract } = params
  const allMoments = aggregation ? [...aggregation.moments.primary, ...aggregation.moments.secondary] : []
  const temporalMoments = allMoments.filter((moment) => moment.momentType === 'temporal')
  const temporalDensity = allMoments.length > 0 ? temporalMoments.length / allMoments.length : 0
  const momentTimingSignal =
    temporalMoments.length > 0
      ? clampScore(
          temporalMoments.reduce((sum, moment) => sum + moment.timingRelevance, 0) /
            temporalMoments.length,
        )
      : 0
  const anchorTimingSignal = clampScore(anchorMoment?.timingRelevance ?? 0)
  const happeningEventSignal = happenings.some((entry) => entry.hasEvent) ? 1 : 0
  const happeningPerformanceSignal = happenings.some((entry) => entry.hasPerformance) ? 1 : 0
  const happeningHappyHourSignal = happenings.some((entry) => entry.hasHappyHour) ? 1 : 0
  const happeningLateSignal = happenings.some((entry) =>
    normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
  )
    ? 1
    : 0
  const happeningTonightSignal = happenings.some((entry) => {
    const timing = normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel)
    return timing.includes('evening') || timing.includes('tonight') || timing.includes('late')
  })
    ? 1
    : 0
  const happeningTemporalStrength =
    happenings.length > 0
      ? clampScore(
          happenings
            .filter((entry) => entry.type === 'temporal')
            .reduce((sum, entry) => sum + (entry.strength ?? 0.62), 0) /
            Math.max(1, happenings.filter((entry) => entry.type === 'temporal').length),
        )
      : 0

  const baseLiveScore = clampScore(
    temporalDensity * 0.2 +
      momentTimingSignal * 0.18 +
      anchorTimingSignal * 0.16 +
      happeningEventSignal * 0.12 +
      happeningPerformanceSignal * 0.12 +
      happeningHappyHourSignal * 0.08 +
      happeningLateSignal * 0.08 +
      happeningTonightSignal * 0.06 +
      happeningTemporalStrength * 0.1,
  )
  if (scenarioContract?.vibe === 'lively') {
    return clampScore(
      baseLiveScore * 0.6 +
        happeningPerformanceSignal * 0.14 +
        happeningLateSignal * 0.12 +
        happeningHappyHourSignal * 0.08 +
        happeningEventSignal * 0.06,
    )
  }
  if (scenarioContract?.vibe === 'cultured') {
    const culturalTemporalSignal = happenings.some(
      (entry) => entry.type === 'community' || entry.type === 'discovery' || entry.hasPerformance,
    )
      ? 1
      : 0
    return clampScore(
      baseLiveScore * 0.64 +
        culturalTemporalSignal * 0.14 +
        happeningPerformanceSignal * 0.1 +
        happeningEventSignal * 0.06 +
        happeningTonightSignal * 0.06,
    )
  }
  const quietTonightSignal = happenings.some((entry) => {
    const reason = normalizeQualityText(entry.reason)
    return (
      reason.includes('quiet') ||
      reason.includes('soft') ||
      reason.includes('landing') ||
      reason.includes('nightcap')
    )
  })
    ? 1
    : 0
  return clampScore(
    baseLiveScore * 0.56 +
      quietTonightSignal * 0.16 +
      happeningLateSignal * 0.1 +
      happeningHappyHourSignal * 0.06 +
      anchorTimingSignal * 0.12,
  )
}

function getCloserAuthorityLift(params: {
  scenarioContract: HospitalityScenarioContract | null
  windDownQuality: number
  authoritySignals: ReturnType<typeof deriveStep2AuthoritySignals>
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { scenarioContract, windDownQuality, authoritySignals, closes, happenings } = params
  const closeCorpus = normalizeQualityText(
    closes
      .slice(0, 2)
      .map((entry) => `${entry.name} ${entry.reason}`)
      .join(' '),
  )
  const closeLiveSignal = happenings.some(
    (entry) =>
      entry.hasHappyHour ||
      entry.hasEvent ||
      entry.hasPerformance ||
      normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
  )
    ? 1
    : 0
  if (scenarioContract?.vibe === 'lively') {
    const livelyCloseSignal =
      closeLiveSignal ||
      closeCorpus.includes('late') ||
      closeCorpus.includes('nightcap') ||
      closeCorpus.includes('cocktail')
        ? 1
        : 0
    return clampScore(
      windDownQuality * 0.5 +
        authoritySignals.windDownConviction * 0.3 +
        authoritySignals.nightlifeConviction * 0.12 +
        livelyCloseSignal * 0.08,
    )
  }
  if (scenarioContract?.vibe === 'cultured') {
    const reflectiveCloseSignal =
      closeCorpus.includes('wine') ||
      closeCorpus.includes('quiet') ||
      closeCorpus.includes('reflective') ||
      closeCorpus.includes('soft')
        ? 1
        : 0
    return clampScore(
      windDownQuality * 0.44 +
        authoritySignals.windDownConviction * 0.28 +
        authoritySignals.culturalConviction * 0.18 +
        reflectiveCloseSignal * 0.1,
    )
  }
  const cozyCloseSignal =
    closeCorpus.includes('soft') ||
    closeCorpus.includes('quiet') ||
    closeCorpus.includes('landing') ||
    closeCorpus.includes('nightcap')
      ? 1
      : 0
  return clampScore(
    windDownQuality * 0.42 +
      authoritySignals.windDownConviction * 0.3 +
      authoritySignals.hiddenGemConviction * 0.2 +
      cozyCloseSignal * 0.08,
  )
}

function getSyntheticNamingPenalty(
  anchorName: string | undefined,
  starts: CityOpportunityStopOption[],
  closes: CityOpportunityStopOption[],
): number {
  const corpus = normalizeQualityText(
    [anchorName ?? '', ...starts.slice(0, 2).map((entry) => entry.name), ...closes.slice(0, 2).map((entry) => entry.name)].join(' '),
  )
  if (!corpus) {
    return 0
  }
  const syntheticTokens = [
    'microcrawl',
    'sketchbook',
    'drop',
    'proto',
    'prototype',
    'sandbox',
    'testbed',
    'simulator',
  ]
  const syntheticHits = syntheticTokens.filter((token) => corpus.includes(token)).length
  if (syntheticHits === 0) {
    return 0
  }
  return Math.min(0.12, syntheticHits * 0.045)
}

function getCityOpportunitySurfaceScore(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorReasons: string[]
  anchorMoment: AggregatedMoment | undefined
  hasRealAnchor: boolean
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
  representativeDirection?: RealityDirectionCard
  ecsState: ExplorationControlState
  scenarioContract: HospitalityScenarioContract | null
  experienceContract: InterpretationExperienceContract | null
  city: string
  persona: string
  vibe: string
  authoritySignalsOverride?: ReturnType<typeof deriveStep2AuthoritySignals>
}): number {
  const {
    aggregation,
    anchorReasons,
    anchorMoment,
    hasRealAnchor,
    starts,
    closes,
    happenings,
    representativeDirection,
    ecsState,
    scenarioContract,
    experienceContract,
    city,
    persona,
    vibe,
  } = params
  const authoritySignals =
    params.authoritySignalsOverride ??
    deriveStep2AuthoritySignals({
      city,
      persona,
      vibe,
      anchorName: aggregation?.anchors.strongestHighlight?.venueName,
      anchorReason: aggregation?.anchors.strongestHighlight?.reason ?? anchorMoment?.reason,
      anchorTimingRelevance: anchorMoment?.timingRelevance,
      anchorLiveContext: anchorMoment?.liveContext,
      starts: starts.map((entry) => ({ name: entry.name, reason: entry.reason })),
      closes: closes.map((entry) => ({ name: entry.name, reason: entry.reason })),
      happenings: happenings.map((entry) => ({
        name: entry.name,
        type: entry.type,
        reason: entry.reason,
        timingLabel: entry.timingLabel,
        timeWindowLabel: entry.timeWindowLabel,
        strength: entry.strength,
        hasEvent: entry.hasEvent,
        hasPerformance: entry.hasPerformance,
        hasHappyHour: entry.hasHappyHour,
      })),
      summary: aggregation?.summary,
    })
  const anchorScore =
    aggregation?.anchors.strongestHighlight?.score ??
    aggregation?.ingredients.highlightCandidates[0]?.score ??
    0.44
  const intentFitSignal =
    anchorMoment?.intentFit ??
    aggregation?.moments.primary[0]?.intentFit ??
    aggregation?.moments.secondary[0]?.intentFit ??
    0.52
  const directionConfidence = representativeDirection?.debugMeta?.confidence ?? 0
  const highlightTierScore = toHighlightTierScore(
    aggregation?.anchors.strongestHighlight?.tier,
    anchorScore,
  )
  const highlightPotentialScore = toHighlightPotentialScore(aggregation?.summary.highlightPotential)
  const anchorMomentStrength = anchorMoment?.strength ?? 0.56
  const anchorConviction = clampScore(
    anchorScore * 0.4 +
      highlightTierScore * 0.2 +
      intentFitSignal * 0.2 +
      anchorMomentStrength * 0.12 +
      highlightPotentialScore * 0.08 +
      authoritySignals.anchorConviction * 0.1,
  )

  const startQuality = clampScore(
    getStopAverageScore(starts) * 0.58 +
      getRoleContractFitScore('start', starts, scenarioContract) * 0.22 +
      authoritySignals.startConviction * 0.2,
  )
  const windDownQuality = clampScore(
    getStopAverageScore(closes) * 0.54 +
      getRoleContractFitScore('windDown', closes, scenarioContract) * 0.22 +
      authoritySignals.windDownConviction * 0.24,
  )

  const hiddenGemPresence = getHiddenGemPresenceScore({
    contract: scenarioContract,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName,
    starts,
    closes,
    happenings,
  })
  const scenarioAlignment = getScenarioAlignmentScore({
    contract: scenarioContract,
    aggregation,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? '',
    anchorMoment,
    starts,
    closes,
    happenings,
  })
  const experienceAlignment = getExperienceContractAlignmentScore({
    contract: experienceContract,
    aggregation,
    starts,
    closes,
    happenings,
  })
  const storySpineCoherence = getStorySpineCoherenceScore({
    aggregation,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? '',
    starts,
    closes,
    startQuality,
    windDownQuality,
  })
  const discoveryLocalStrength = clampScore(
    getDiscoveryLocalStrengthScore(aggregation, happenings, hiddenGemPresence) * 0.62 +
      authoritySignals.discoveryConviction * 0.18 +
      authoritySignals.culturalConviction * 0.1 +
      authoritySignals.happeningAuthority * 0.1,
  )
  const liveEventRelevance = getLiveEventRelevanceScore({
    aggregation,
    anchorMoment,
    happenings,
    scenarioContract,
  })
  const closerAuthorityLift = getCloserAuthorityLift({
    scenarioContract,
    windDownQuality,
    authoritySignals,
    closes,
    happenings,
  })
  const proximityScore = clampScore(
    directionConfidence * 0.58 + toMovementTightnessScore(aggregation?.summary.movementProfile) * 0.42,
  )
  const verificationScore = Math.min(anchorReasons.length, 2) / 2
  const supportCoverageScore = starts.length > 0 && closes.length > 0 ? 1 : starts.length > 0 || closes.length > 0 ? 0.58 : 0
  const genericPenalty =
    starts.length === 0 || closes.length === 0
      ? 0.14
      : starts[0]?.name?.trim().toLowerCase() === closes[0]?.name?.trim().toLowerCase()
        ? 0.08
        : 0
  const weakSupportPenalty =
    (startQuality < 0.5 ? 0.06 : 0) + (windDownQuality < 0.5 ? 0.06 : 0)
  const syntheticNamingPenalty = getSyntheticNamingPenalty(
    aggregation?.anchors.strongestHighlight?.venueName,
    starts,
    closes,
  )
  const authorityMismatchPenalty =
    authoritySignals.overallAuthority < 0.42
      ? 0.1
      : authoritySignals.overallAuthority < 0.52
        ? 0.05
        : 0
  const contractMismatchPenalty =
    experienceAlignment < 0.48
      ? 0.08
      : experienceAlignment < 0.56
        ? 0.04
        : 0
  const scenarioAuthorityLift =
    scenarioContract?.vibe === 'lively'
      ? authoritySignals.nightlifeConviction * 0.16 +
        authoritySignals.majorEventConviction * 0.12 +
        authoritySignals.happeningAuthority * 0.06 +
        liveEventRelevance * 0.12 +
        authoritySignals.whyTonightPressure * 0.1
      : scenarioContract?.vibe === 'cultured'
        ? authoritySignals.culturalConviction * 0.18 +
          authoritySignals.discoveryConviction * 0.12 +
          authoritySignals.majorEventConviction * 0.08 +
          liveEventRelevance * 0.1 +
          authoritySignals.whyTonightPressure * 0.08
        : authoritySignals.hiddenGemConviction * 0.16 +
          authoritySignals.windDownConviction * 0.12 +
          authoritySignals.discoveryConviction * 0.07 +
          liveEventRelevance * 0.06 +
          authoritySignals.whyTonightPressure * 0.08
  const scenarioAuthorityPenalty =
    scenarioContract?.vibe === 'lively'
      ? authoritySignals.nightlifeConviction < 0.22 &&
        authoritySignals.majorEventConviction < 0.16
        ? 0.08
        : 0
      : scenarioContract?.vibe === 'cultured'
        ? authoritySignals.culturalConviction < 0.24 &&
          authoritySignals.discoveryConviction < 0.2
          ? 0.08
          : 0
        : authoritySignals.hiddenGemConviction < 0.22 &&
            authoritySignals.windDownConviction < 0.32
          ? 0.06
          : 0

  const highlightEcsBias = ecsState.highlight === 'standout' ? anchorConviction * 0.07 : (1 - anchorConviction) * 0.03
  const discoveryEcsBias =
    ecsState.discovery === 'discover'
      ? discoveryLocalStrength * 0.08
      : (1 - discoveryLocalStrength) * 0.02 + supportCoverageScore * 0.01
  const explorationEcsBias =
    ecsState.exploration === 'exploratory'
      ? discoveryLocalStrength * 0.05 + (1 - proximityScore) * 0.03
      : storySpineCoherence * 0.03 + proximityScore * 0.02

  const anchorPresenceScore = hasRealAnchor ? 0.08 : -0.2
  return (
    anchorConviction * 0.28 +
    scenarioAlignment * 0.2 +
    experienceAlignment * 0.16 +
    storySpineCoherence * 0.14 +
    startQuality * 0.1 +
    windDownQuality * 0.08 +
    discoveryLocalStrength * 0.07 +
    closerAuthorityLift * 0.07 +
    liveEventRelevance * 0.06 +
    proximityScore * 0.03 +
    verificationScore * 0.02 +
    anchorPresenceScore +
    highlightEcsBias +
    discoveryEcsBias +
    explorationEcsBias +
    scenarioAuthorityLift +
    supportCoverageScore * 0.03 -
    genericPenalty -
    weakSupportPenalty -
    syntheticNamingPenalty -
    contractMismatchPenalty -
    authorityMismatchPenalty -
    scenarioAuthorityPenalty
  )
}

function buildCityOpportunityAuthoritySignals(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorMoment: AggregatedMoment | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
  city: string
  persona: string
  vibe: string
}): ReturnType<typeof deriveStep2AuthoritySignals> {
  const { aggregation, anchorMoment, starts, closes, happenings, city, persona, vibe } = params
  return deriveStep2AuthoritySignals({
    city,
    persona,
    vibe,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName,
    anchorReason: aggregation?.anchors.strongestHighlight?.reason ?? anchorMoment?.reason,
    anchorTimingRelevance: anchorMoment?.timingRelevance,
    anchorLiveContext: anchorMoment?.liveContext,
    starts: starts.map((entry) => ({ name: entry.name, reason: entry.reason })),
    closes: closes.map((entry) => ({ name: entry.name, reason: entry.reason })),
    happenings: happenings.map((entry) => ({
      name: entry.name,
      type: entry.type,
      reason: entry.reason,
      timingLabel: entry.timingLabel,
      timeWindowLabel: entry.timeWindowLabel,
      strength: entry.strength,
      hasEvent: entry.hasEvent,
      hasPerformance: entry.hasPerformance,
      hasHappyHour: entry.hasHappyHour,
    })),
    summary: aggregation?.summary,
  })
}

function buildWhyTonightStrength(params: {
  authoritySignals: ReturnType<typeof deriveStep2AuthoritySignals>
  happenings: CityOpportunityHappening[]
  anchorMoment: AggregatedMoment | undefined
  aggregation: TasteOpportunityAggregation | undefined
}): number {
  const { authoritySignals, happenings, anchorMoment, aggregation } = params
  const hasTemporal = happenings.some((entry) => entry.type === 'temporal')
  const hasPerformance = happenings.some((entry) => entry.hasPerformance)
  const hasEvent = happenings.some((entry) => entry.hasEvent)
  const hasHappyHour = happenings.some((entry) => entry.hasHappyHour)
  const lateSignal = happenings.some((entry) =>
    normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
  )
    ? 1
    : 0
  const happeningStrength =
    happenings.length > 0
      ? clampScore(
          happenings.slice(0, 2).reduce((sum, entry) => sum + (entry.strength ?? 0.58), 0) /
            Math.min(2, happenings.length),
        )
      : 0
  const temporalDensity =
    aggregation && aggregation.moments.primary.length + aggregation.moments.secondary.length > 0
      ? clampScore(
          [...aggregation.moments.primary, ...aggregation.moments.secondary].filter(
            (moment) => moment.momentType === 'temporal',
          ).length /
            ([...aggregation.moments.primary, ...aggregation.moments.secondary].length || 1),
        )
      : 0

  const liveContextSignal = clampScore(
    (hasTemporal ? 0.26 : 0) +
      (hasPerformance ? 0.22 : 0) +
      (hasEvent ? 0.18 : 0) +
      (hasHappyHour ? 0.12 : 0) +
      (lateSignal ? 0.14 : 0),
  )

  return clampScore(
    authoritySignals.whyTonightPressure * 0.44 +
      authoritySignals.happeningAuthority * 0.2 +
      happeningStrength * 0.12 +
      temporalDensity * 0.1 +
      clampScore(anchorMoment?.timingRelevance ?? 0) * 0.06 +
      liveContextSignal * 0.08,
  )
}

function buildCozyAuthorityStrength(params: {
  authoritySignals: ReturnType<typeof deriveStep2AuthoritySignals>
  anchorName: string
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { authoritySignals, anchorName, starts, closes, happenings } = params
  const cozyCorpus = normalizeQualityText(
    [anchorName, ...starts.map((entry) => entry.name), ...closes.map((entry) => `${entry.name} ${entry.reason}`)]
      .filter(Boolean)
      .join(' '),
  )
  const cozyLexicalSignal =
    ['cozy', 'intimate', 'quiet', 'soft', 'landing', 'nightcap', 'garden', 'tea', 'wine', 'romantic'].some(
      (token) => cozyCorpus.includes(token),
    )
      ? 1
      : 0
  const knownCozyAuthoritySignal =
    [
      'la foret',
      'hakone gardens',
      'hedley club lounge',
      'japanese friendship garden',
      'willow glen',
    ].some((entry) => hasLoosePhraseMatch(anchorName, entry))
      ? 1
      : 0
  const quietHappeningSignal = happenings.some((entry) => {
    const reason = normalizeQualityText(entry.reason)
    return reason.includes('quiet') || reason.includes('soft') || reason.includes('discovery')
  })
    ? 1
    : 0

  return clampScore(
    authoritySignals.hiddenGemConviction * 0.28 +
      authoritySignals.windDownConviction * 0.24 +
      authoritySignals.anchorConviction * 0.16 +
      authoritySignals.discoveryConviction * 0.1 +
      cozyLexicalSignal * 0.12 +
      knownCozyAuthoritySignal * 0.06 +
      quietHappeningSignal * 0.04,
  )
}

function buildWhyTonightProofLine(params: {
  authoritySignals: ReturnType<typeof deriveStep2AuthoritySignals>
  whyTonightStrength: number
  cozyAuthorityStrength: number
  happenings: CityOpportunityHappening[]
  scenarioContract: HospitalityScenarioContract | null
}): string | undefined {
  const { authoritySignals, whyTonightStrength, cozyAuthorityStrength, happenings, scenarioContract } = params
  if (whyTonightStrength < 0.58) {
    return undefined
  }
  if (happenings.some((entry) => entry.hasPerformance)) {
    return 'Performance-capable highlight energy nearby tonight.'
  }
  if (happenings.some((entry) => entry.hasEvent)) {
    return 'Eventful nearby momentum makes tonight stronger.'
  }
  if (
    happenings.some((entry) =>
      normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
    ) ||
    happenings.some((entry) => entry.hasHappyHour)
  ) {
    return 'Late-night momentum is strong nearby right now.'
  }
  if (scenarioContract?.vibe === 'cultured' && authoritySignals.culturalConviction >= 0.5) {
    return 'Cultural highlights are active nearby tonight.'
  }
  if (scenarioContract?.vibe === 'cozy' && cozyAuthorityStrength >= 0.62) {
    return 'Quiet hidden-gem authority fits tonight especially well.'
  }
  return 'Strong tonight relevance across this local sequence.'
}

function buildModeExcellenceStrength(params: {
  scenarioContract: HospitalityScenarioContract | null
  authoritySignals: ReturnType<typeof deriveStep2AuthoritySignals>
  whyTonightStrength: number
  cozyAuthorityStrength: number
  anchorName: string
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
}): number {
  const {
    scenarioContract,
    authoritySignals,
    whyTonightStrength,
    cozyAuthorityStrength,
    anchorName,
    starts,
    closes,
  } = params
  const supportCorpus = normalizeQualityText(
    [anchorName, ...starts.map((entry) => `${entry.name} ${entry.reason}`), ...closes.map((entry) => `${entry.name} ${entry.reason}`)]
      .join(' '),
  )

  if (scenarioContract?.vibe === 'lively') {
    const nightlifeLexicalSignal =
      ['nightlife', 'cocktail', 'late', 'live', 'music', 'performance', 'pulse'].some((token) =>
        supportCorpus.includes(token),
      )
        ? 1
        : 0
    return clampScore(
      authoritySignals.nightlifeConviction * 0.36 +
        authoritySignals.majorEventConviction * 0.24 +
        whyTonightStrength * 0.28 +
        nightlifeLexicalSignal * 0.12,
    )
  }

  if (scenarioContract?.vibe === 'cultured') {
    const culturalLexicalSignal =
      ['cultural', 'museum', 'gallery', 'theatre', 'opera', 'discovery', 'reflective'].some((token) =>
        supportCorpus.includes(token),
      )
        ? 1
        : 0
    return clampScore(
      authoritySignals.culturalConviction * 0.38 +
        authoritySignals.discoveryConviction * 0.28 +
        authoritySignals.majorEventConviction * 0.12 +
        whyTonightStrength * 0.12 +
        culturalLexicalSignal * 0.1,
    )
  }

  const cozyLexicalSignal =
    ['cozy', 'intimate', 'soft', 'quiet', 'nightcap', 'garden', 'wine', 'tea', 'hidden gem'].some((token) =>
      supportCorpus.includes(token),
    )
      ? 1
      : 0
  const genericPromenadePenalty =
    supportCorpus.includes('promenade') &&
    !supportCorpus.includes('intimate') &&
    !supportCorpus.includes('romantic') &&
    !supportCorpus.includes('wine') &&
    !supportCorpus.includes('tea')
      ? 0.08
      : 0
  return clampScore(
    authoritySignals.hiddenGemConviction * 0.34 +
      authoritySignals.windDownConviction * 0.22 +
      cozyAuthorityStrength * 0.22 +
      whyTonightStrength * 0.1 +
      cozyLexicalSignal * 0.12 -
      genericPromenadePenalty,
  )
}

function buildStep2ExcellenceThreshold(params: {
  scenarioContract: HospitalityScenarioContract | null
}): number {
  const { scenarioContract } = params
  if (scenarioContract?.vibe === 'cozy') {
    return 0.68
  }
  if (scenarioContract?.vibe === 'lively') {
    return 0.66
  }
  if (scenarioContract?.vibe === 'cultured') {
    return 0.66
  }
  return 0.65
}

function buildStep2ExcellenceScore(params: {
  anchorStrength: number
  startQuality: number
  windDownQuality: number
  supportCoherence: number
  scenarioAlignment: number
  experienceAlignment: number
  localAuthority: number
  whyTonightStrength: number
  modeExcellence: number
  existingSurfaceScore: number
  scenarioContract: HospitalityScenarioContract | null
}): number {
  const {
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioAlignment,
    experienceAlignment,
    localAuthority,
    whyTonightStrength,
    modeExcellence,
    existingSurfaceScore,
    scenarioContract,
  } = params

  const weakSupportPenalty =
    (startQuality < 0.52 ? 0.06 : 0) +
    (windDownQuality < 0.54 ? 0.06 : 0) +
    (supportCoherence < 0.56 ? 0.06 : 0)
  const weakAnchorPenalty = anchorStrength < 0.56 ? 0.09 : anchorStrength < 0.62 ? 0.05 : 0
  const weakAuthorityPenalty = localAuthority < 0.52 ? 0.07 : 0

  const modePenalty =
    scenarioContract?.vibe === 'cozy'
      ? modeExcellence < 0.58
        ? 0.08
        : 0
      : scenarioContract?.vibe === 'lively'
        ? modeExcellence < 0.54
          ? 0.08
          : 0
        : scenarioContract?.vibe === 'cultured'
          ? modeExcellence < 0.56
            ? 0.08
            : 0
          : 0

  return clampScore(
    anchorStrength * 0.2 +
      scenarioAlignment * 0.14 +
      experienceAlignment * 0.12 +
      startQuality * 0.11 +
      windDownQuality * 0.14 +
      supportCoherence * 0.1 +
      localAuthority * 0.1 +
      whyTonightStrength * 0.09 +
      modeExcellence * 0.1 +
      clampScore(existingSurfaceScore) * 0.04 -
      weakSupportPenalty -
      weakAnchorPenalty -
      weakAuthorityPenalty -
      modePenalty,
  )
}

function isStep2ExcellenceCandidate(params: {
  excellenceScore: number
  threshold: number
  anchorStrength: number
  startQuality: number
  windDownQuality: number
  supportCoherence: number
  scenarioContract: HospitalityScenarioContract | null
  modeExcellence: number
}): boolean {
  const {
    excellenceScore,
    threshold,
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioContract,
    modeExcellence,
  } = params

  if (anchorStrength < 0.54) {
    return false
  }
  if (startQuality < 0.46 || windDownQuality < 0.5) {
    return false
  }
  if (supportCoherence < 0.5) {
    return false
  }

  if (scenarioContract?.vibe === 'cozy') {
    if (modeExcellence < 0.58 || windDownQuality < 0.56) {
      return false
    }
  } else if (scenarioContract?.vibe === 'lively') {
    if (modeExcellence < 0.54 || anchorStrength < 0.58) {
      return false
    }
  } else if (scenarioContract?.vibe === 'cultured') {
    if (modeExcellence < 0.56 || anchorStrength < 0.56) {
      return false
    }
  }

  return excellenceScore >= threshold
}

function isRomanticCozyMode(params: {
  persona: string
  vibe: string
  scenarioContract: HospitalityScenarioContract | null
}): boolean {
  const { persona, vibe, scenarioContract } = params
  const normalizedPersona = normalizeQualityText(persona)
  const normalizedVibe = normalizeQualityText(vibe)
  const scenarioMatch =
    scenarioContract?.persona === 'romantic' && scenarioContract.vibe === 'cozy'
  return scenarioMatch || (normalizedPersona.includes('romantic') && normalizedVibe.includes('cozy'))
}

function enforceStep2SurvivorConstraints(params: {
  rankedCards: VerifiedCityOpportunity[]
  selectionCards: VerifiedCityOpportunity[]
  visibleCardCap: number
  persona: string
  vibe: string
  scenarioContract: HospitalityScenarioContract | null
}): VerifiedCityOpportunity[] {
  const { rankedCards, selectionCards, visibleCardCap, persona, vibe, scenarioContract } = params
  if (selectionCards.length <= visibleCardCap) {
    return selectionCards.slice(0, visibleCardCap)
  }

  const selected = selectionCards.slice(0, visibleCardCap)
  const selectedIds = new Set(selected.map((entry) => entry.id))
  const excellenceEligibleIds = new Set(selectionCards.map((entry) => entry.id))

  const highWhyTonightAvailable = rankedCards.filter(
    (entry) => entry.survivorSignals.highWhyTonight && excellenceEligibleIds.has(entry.id),
  )
  const selectedHasHighWhyTonight = selected.some((entry) => entry.survivorSignals.highWhyTonight)
  if (!selectedHasHighWhyTonight && highWhyTonightAvailable.length > 0) {
    const bestWhyTonight = highWhyTonightAvailable.find((entry) => !selectedIds.has(entry.id))
    if (bestWhyTonight) {
      const replaceIndex = selected.length - 1
      selected[replaceIndex] = bestWhyTonight
      selectedIds.add(bestWhyTonight.id)
    }
  }

  if (
    isRomanticCozyMode({ persona, vibe, scenarioContract }) &&
    !selected.some((entry) => entry.survivorSignals.highCozyAuthority)
  ) {
    const highCozyAvailable = rankedCards.filter(
      (entry) => entry.survivorSignals.highCozyAuthority && excellenceEligibleIds.has(entry.id),
    )
    const bestCozy = highCozyAvailable.find((entry) => !selectedIds.has(entry.id))
    if (bestCozy) {
      const replaceIndex = selected.findIndex((entry) => !entry.survivorSignals.highWhyTonight)
      const targetIndex = replaceIndex >= 0 ? replaceIndex : selected.length - 1
      selected[targetIndex] = bestCozy
      selectedIds.add(bestCozy.id)
    }
  }

  return selected.slice(0, visibleCardCap)
}

function selectStep2ExcellentSurvivors(params: {
  rankedCards: VerifiedCityOpportunity[]
  persona: string
  vibe: string
  scenarioContract: HospitalityScenarioContract | null
}): VerifiedCityOpportunity[] {
  const { rankedCards, persona, vibe, scenarioContract } = params
  if (rankedCards.length === 0) {
    return []
  }

  const maxVisible = rankedCards.length > 3 ? 4 : 3
  const excellent = rankedCards.filter((entry) => entry.excellence.passes)
  const targetVisible =
    excellent.length >= maxVisible
      ? maxVisible
      : excellent.length >= 3
        ? 3
        : excellent.length >= 2
          ? 2
          : Math.min(2, rankedCards.length)

  const selectionPool =
    excellent.length >= 2
      ? excellent
      : rankedCards.slice(0, Math.min(Math.max(2, targetVisible), rankedCards.length))

  return enforceStep2SurvivorConstraints({
    rankedCards,
    selectionCards: selectionPool,
    visibleCardCap: targetVisible,
    persona,
    vibe,
    scenarioContract,
  })
}

function buildVerifiedOpportunityShapeFingerprint(opportunity: VerifiedCityOpportunity): string {
  const momentTypes = opportunity.nearbyHappenings
    .slice(0, 2)
    .map((entry) => entry.type ?? 'generic')
    .join('|')
  const starts = opportunity.starts
    .slice(0, 2)
    .map((entry) => entry.name.toLowerCase())
    .join('|')
  const closes = opportunity.closes
    .slice(0, 2)
    .map((entry) => entry.name.toLowerCase())
    .join('|')
  return [opportunity.flavor.toLowerCase(), starts, closes, momentTypes].join('::')
}

function isMeaningfullyDifferentVerifiedOpportunity(
  candidate: VerifiedCityOpportunity,
  existing: VerifiedCityOpportunity,
): boolean {
  const candidateFingerprint = buildVerifiedOpportunityShapeFingerprint(candidate)
  const existingFingerprint = buildVerifiedOpportunityShapeFingerprint(existing)
  if (candidateFingerprint !== existingFingerprint) {
    return true
  }
  if (candidate.fit.confidenceLine !== existing.fit.confidenceLine) {
    return true
  }
  return false
}

function dedupeCityOpportunityCards(
  cards: VerifiedCityOpportunity[],
  ecsState: ExplorationControlState,
): VerifiedCityOpportunity[] {
  if (cards.length <= 1) {
    return cards
  }
  const shouldDiversify = ecsState.exploration === 'exploratory' || ecsState.discovery === 'discover'
  const selected: VerifiedCityOpportunity[] = []
  const selectedByAnchor = new Map<string, VerifiedCityOpportunity[]>()
  cards.forEach((card) => {
    const anchorKey = card.anchor.venueId.trim().toLowerCase()
    const existingForAnchor = selectedByAnchor.get(anchorKey) ?? []
    if (existingForAnchor.length === 0) {
      selected.push(card)
      selectedByAnchor.set(anchorKey, [card])
      return
    }
    const canKeepDuplicate = existingForAnchor.every((existing) =>
      isMeaningfullyDifferentVerifiedOpportunity(card, existing),
    )
    if (canKeepDuplicate && shouldDiversify) {
      selected.push(card)
      selectedByAnchor.set(anchorKey, [...existingForAnchor, card])
    }
  })
  if (selected.length === 0) {
    return cards.slice(0, 1)
  }
  return selected.slice(0, cards.length)
}

function normalizeDistrictLookupKey(value: string | undefined): string {
  if (!value) {
    return ''
  }
  return value
    .toLowerCase()
    .replace(/\b(district|pocket|area|core)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildDistrictLookupKeys(value: string | undefined): string[] {
  const normalized = normalizeDistrictLookupKey(value)
  if (!normalized) {
    return []
  }
  const collapsed = normalized.replace(/\s+/g, '')
  return Array.from(new Set([normalized, collapsed]))
}

function buildDistrictLookupTokens(value: string | undefined): string[] {
  const normalized = normalizeDistrictLookupKey(value)
  if (!normalized) {
    return []
  }
  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function getDistrictTokenSubsetMatchScore(
  candidateTokens: string[],
  recommendationTokens: string[],
): number {
  if (candidateTokens.length === 0 || recommendationTokens.length === 0) {
    return 0
  }
  const recommendationSet = new Set(recommendationTokens)
  let overlapCount = 0
  candidateTokens.forEach((token) => {
    if (recommendationSet.has(token)) {
      overlapCount += 1
    }
  })
  const coverage = overlapCount / candidateTokens.length
  if (overlapCount === 0) {
    return 0
  }
  if (candidateTokens.length <= 2) {
    return coverage >= 0.5 ? coverage : 0
  }
  if (overlapCount >= 2 && coverage >= 0.5) {
    return coverage
  }
  return 0
}

function getTasteAggregationSummaryLine(
  summary: TasteOpportunityAggregation['summary'],
): string {
  const movement =
    summary.movementProfile === 'tight'
      ? 'Compact movement'
      : summary.movementProfile === 'spread'
        ? 'More open movement'
        : 'Balanced movement'
  const energy =
    summary.dominantEnergy === 'lively'
      ? 'lively energy'
      : summary.dominantEnergy === 'calm'
        ? 'calmer energy'
        : 'steady energy'
  const discovery =
    summary.discoveryBalance === 'novel'
      ? 'novel discovery'
      : summary.discoveryBalance === 'familiar'
        ? 'familiar discovery'
        : 'balanced discovery'
  return `${movement}, ${energy}, ${discovery}.`
}

function getTasteAggregationAnchorLine(
  aggregation: TasteOpportunityAggregation,
): string {
  const strongestHighlight = aggregation.anchors.strongestHighlight
  if (!strongestHighlight) {
    return 'Best anchor right now: still emerging in this area.'
  }
  return `Best anchor right now: ${strongestHighlight.venueName}`
}

function getTasteAggregationIngredientLine(
  aggregation: TasteOpportunityAggregation,
): string {
  const openerType = aggregation.signatures.openerTypes[0]
  const highlightType = aggregation.signatures.highlightTypes[0]
  const windDownType = aggregation.signatures.windDownTypes[0]
  if (openerType && highlightType && windDownType) {
    return `Supports ${openerType} starts + ${highlightType} peaks + ${windDownType} closes`
  }
  if (highlightType && windDownType) {
    return `Supports ${highlightType} peaks + ${windDownType} closes`
  }
  if (highlightType) {
    return `Supports ${highlightType} peaks with role-ready nearby options`
  }
  return 'Supports role-ready opener, peak, and close options'
}

type AggregationMoment = TasteOpportunityAggregation['moments']['primary'][number]
type AggregationMomentType = AggregationMoment['momentType']
type AggregationRole = 'start' | 'highlight' | 'windDown'

type MomentVenueStats = {
  maxStrength: number
  anchor: number
  supporting: number
  temporal: number
  discovery: number
  community: number
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function shiftHighlightPotential(
  value: TasteOpportunityAggregation['summary']['highlightPotential'],
  direction: 'up' | 'down',
): TasteOpportunityAggregation['summary']['highlightPotential'] {
  if (direction === 'up') {
    if (value === 'low') {
      return 'medium'
    }
    if (value === 'medium') {
      return 'high'
    }
    return 'high'
  }
  if (value === 'high') {
    return 'medium'
  }
  if (value === 'medium') {
    return 'low'
  }
  return 'low'
}

function shiftDiscoveryBalance(
  value: TasteOpportunityAggregation['summary']['discoveryBalance'],
  direction: 'toward_discover' | 'toward_reliable',
): TasteOpportunityAggregation['summary']['discoveryBalance'] {
  if (direction === 'toward_discover') {
    if (value === 'familiar') {
      return 'balanced'
    }
    if (value === 'balanced') {
      return 'novel'
    }
    return 'novel'
  }
  if (value === 'novel') {
    return 'balanced'
  }
  if (value === 'balanced') {
    return 'familiar'
  }
  return 'familiar'
}

function incrementMomentTypeStat(stats: MomentVenueStats, momentType: AggregationMomentType): void {
  if (momentType === 'anchor') {
    stats.anchor += 1
    return
  }
  if (momentType === 'supporting') {
    stats.supporting += 1
    return
  }
  if (momentType === 'temporal') {
    stats.temporal += 1
    return
  }
  if (momentType === 'discovery') {
    stats.discovery += 1
    return
  }
  stats.community += 1
}

function buildMomentVenueStats(moments: AggregationMoment[]): Map<string, MomentVenueStats> {
  const statsByVenue = new Map<string, MomentVenueStats>()
  moments.forEach((moment) => {
    if (!moment.venueId) {
      return
    }
    const existing = statsByVenue.get(moment.venueId) ?? {
      maxStrength: 0,
      anchor: 0,
      supporting: 0,
      temporal: 0,
      discovery: 0,
      community: 0,
    }
    existing.maxStrength = Math.max(existing.maxStrength, moment.strength)
    incrementMomentTypeStat(existing, moment.momentType)
    statsByVenue.set(moment.venueId, existing)
  })
  return statsByVenue
}

function getMomentEcsScore(moment: AggregationMoment, ecs: ExplorationControlState): number {
  let score = moment.strength * 0.72 + moment.intentFit * 0.2 + moment.timingRelevance * 0.08
  if (ecs.exploration === 'focused') {
    if (moment.momentType === 'anchor') {
      score += 0.05
    } else if (moment.momentType === 'supporting') {
      score += 0.04
    } else if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score += 0.02
    }
  } else {
    if (moment.momentType === 'discovery') {
      score += 0.11
    } else if (moment.momentType === 'community') {
      score += 0.09
    } else if (moment.momentType === 'temporal') {
      score += 0.05
    } else if (moment.momentType === 'anchor') {
      score -= 0.03
    }
  }
  if (ecs.discovery === 'discover') {
    if (moment.momentType === 'discovery') {
      score += 0.16
    } else if (moment.momentType === 'community') {
      score += 0.12
    } else if (moment.momentType === 'anchor') {
      score -= 0.05
    }
  } else if (moment.momentType === 'anchor') {
    score += 0.06
  } else if (moment.momentType === 'supporting') {
    score += 0.05
  } else if (moment.momentType === 'discovery' || moment.momentType === 'community') {
    score += 0.02
  }
  if (ecs.highlight === 'standout') {
    if (moment.momentType === 'anchor') {
      score += 0.08
    } else if (moment.momentType === 'temporal') {
      score += 0.04
    } else if (moment.momentType === 'discovery') {
      score += 0.02
    }
  } else if (moment.momentType === 'anchor') {
    score -= 0.1
  } else if (moment.momentType === 'supporting') {
    score += 0.07
  }
  return score
}

function reshapeMoments(
  moments: TasteOpportunityAggregation['moments'],
  ecs: ExplorationControlState,
): TasteOpportunityAggregation['moments'] {
  const combined = [...moments.primary, ...moments.secondary]
  if (combined.length === 0) {
    return { primary: [], secondary: [] }
  }
  const ranked = combined
    .slice()
    .sort((left, right) => {
      const scoreDiff = getMomentEcsScore(right, ecs) - getMomentEcsScore(left, ecs)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      if (right.strength !== left.strength) {
        return right.strength - left.strength
      }
      return left.id.localeCompare(right.id)
    })
  const diversified =
    ecs.exploration === 'exploratory'
      ? (() => {
          const usedVenueIds = new Set<string>()
          const prioritized: AggregationMoment[] = []
          const overflow: AggregationMoment[] = []
          ranked.forEach((moment) => {
            if (moment.venueId && !usedVenueIds.has(moment.venueId)) {
              usedVenueIds.add(moment.venueId)
              prioritized.push(moment)
              return
            }
            overflow.push(moment)
          })
          return [...prioritized, ...overflow]
        })()
      : ranked
  const primaryCount = Math.max(1, moments.primary.length)
  const secondaryCount = moments.secondary.length
  return {
    primary: diversified.slice(0, primaryCount),
    secondary: diversified.slice(primaryCount, primaryCount + secondaryCount),
  }
}

function getRoleCandidateEcsScore(
  candidate: TasteOpportunityRoleCandidate,
  role: AggregationRole,
  statsByVenue: Map<string, MomentVenueStats>,
  ecs: ExplorationControlState,
  strongestHighlightVenueId: string | undefined,
): number {
  const stats = statsByVenue.get(candidate.venueId)
  const hasAnchor = (stats?.anchor ?? 0) > 0
  const hasSupporting = (stats?.supporting ?? 0) > 0
  const hasDiscovery = (stats?.discovery ?? 0) > 0
  const hasCommunity = (stats?.community ?? 0) > 0
  const hasTemporal = (stats?.temporal ?? 0) > 0
  let score = candidate.score
  if (ecs.exploration === 'focused') {
    score += candidate.score * 0.06
    if (hasAnchor) {
      score += 0.03
    }
  } else {
    score += hasDiscovery || hasCommunity ? 0.1 : 0
    score += hasTemporal ? 0.04 : 0
    score += hasAnchor ? -0.04 : 0.03
    score += (1 - candidate.score) * 0.03
  }
  if (ecs.discovery === 'discover') {
    score += hasDiscovery ? 0.12 : 0
    score += hasCommunity ? 0.08 : 0
    score -= hasAnchor && !hasDiscovery && !hasCommunity ? 0.05 : 0
  } else {
    score += hasAnchor ? 0.05 : 0
    score += hasSupporting ? 0.05 : 0
    score += hasDiscovery ? 0.01 : 0
    score += hasCommunity ? 0.01 : 0
  }
  const highlightWeight = role === 'highlight' ? 1 : 0.45
  if (ecs.highlight === 'standout') {
    score += highlightWeight * (hasAnchor ? 0.07 : 0)
    score += highlightWeight * (hasTemporal ? 0.04 : 0)
    score += highlightWeight * (hasDiscovery ? 0.015 : 0)
    score += highlightWeight * candidate.score * 0.04
    if (role === 'highlight' && candidate.venueId === strongestHighlightVenueId) {
      score += 0.05
    }
  } else {
    score -= highlightWeight * (hasAnchor ? 0.08 : 0)
    score += highlightWeight * (hasSupporting ? 0.06 : 0)
    score += highlightWeight * (hasDiscovery ? 0.04 : 0)
    score += highlightWeight * (1 - candidate.score) * 0.05
  }
  score += (stats?.maxStrength ?? 0) * 0.03
  return clampScore(score)
}

function reshapeRoleCandidates(
  candidates: TasteOpportunityRoleCandidate[],
  role: AggregationRole,
  statsByVenue: Map<string, MomentVenueStats>,
  ecs: ExplorationControlState,
  strongestHighlightVenueId: string | undefined,
): TasteOpportunityRoleCandidate[] {
  return candidates
    .slice()
    .sort((left, right) => {
      const scoreDiff =
        getRoleCandidateEcsScore(right, role, statsByVenue, ecs, strongestHighlightVenueId) -
        getRoleCandidateEcsScore(left, role, statsByVenue, ecs, strongestHighlightVenueId)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.venueName.localeCompare(right.venueName)
    })
}

function inferHighlightTier(
  candidate: TasteOpportunityRoleCandidate | undefined,
  originalStrongestHighlight: TasteOpportunityAggregation['anchors']['strongestHighlight'],
): number | undefined {
  if (!candidate) {
    return undefined
  }
  if (originalStrongestHighlight?.venueId === candidate.venueId) {
    return originalStrongestHighlight.tier
  }
  if (candidate.score >= 0.72) {
    return 1
  }
  if (candidate.score >= 0.56) {
    return 2
  }
  return 3
}

function applyExplorationControlsToAggregation(
  aggregation: TasteOpportunityAggregation,
  ecs: ExplorationControlState,
): TasteOpportunityAggregation {
  const nextMoments = reshapeMoments(aggregation.moments, ecs)
  const momentStatsByVenue = buildMomentVenueStats([...nextMoments.primary, ...nextMoments.secondary])
  const strongestHighlightVenueId = aggregation.anchors.strongestHighlight?.venueId

  const startCandidates = reshapeRoleCandidates(
    aggregation.ingredients.startCandidates,
    'start',
    momentStatsByVenue,
    ecs,
    strongestHighlightVenueId,
  )
  const highlightCandidates = reshapeRoleCandidates(
    aggregation.ingredients.highlightCandidates,
    'highlight',
    momentStatsByVenue,
    ecs,
    strongestHighlightVenueId,
  )
  const windDownCandidates = reshapeRoleCandidates(
    aggregation.ingredients.windDownCandidates,
    'windDown',
    momentStatsByVenue,
    ecs,
    strongestHighlightVenueId,
  )

  const strongestHighlight = highlightCandidates[0]
  const strongestHighlightTier = inferHighlightTier(strongestHighlight, aggregation.anchors.strongestHighlight)
  const nextMovementProfile =
    ecs.exploration === 'exploratory'
      ? aggregation.summary.movementProfile === 'tight'
        ? 'moderate'
        : aggregation.summary.movementProfile
      : aggregation.summary.movementProfile === 'spread'
        ? 'moderate'
        : aggregation.summary.movementProfile
  const nextHighlightPotential =
    ecs.highlight === 'standout'
      ? shiftHighlightPotential(aggregation.summary.highlightPotential, 'up')
      : shiftHighlightPotential(aggregation.summary.highlightPotential, 'down')
  const nextDiscoveryBalance =
    ecs.discovery === 'discover'
      ? shiftDiscoveryBalance(aggregation.summary.discoveryBalance, 'toward_discover')
      : shiftDiscoveryBalance(aggregation.summary.discoveryBalance, 'toward_reliable')

  return {
    ...aggregation,
    summary: {
      ...aggregation.summary,
      movementProfile: nextMovementProfile,
      highlightPotential: nextHighlightPotential,
      discoveryBalance: nextDiscoveryBalance,
    },
    ingredients: {
      startCandidates,
      highlightCandidates,
      windDownCandidates,
    },
    anchors: {
      strongestStart: startCandidates[0],
      strongestHighlight:
        strongestHighlight && typeof strongestHighlightTier === 'number'
          ? {
              ...strongestHighlight,
              tier: strongestHighlightTier,
            }
          : undefined,
      strongestWindDown: windDownCandidates[0],
    },
    moments: nextMoments,
  }
}

function buildStep2CardTraits(
  opportunity: VerifiedCityOpportunity,
  ecs: ExplorationControlState,
): string[] {
  const explorationTrait = ecs.exploration === 'exploratory' ? 'Exploratory' : 'Focused'
  const discoveryTrait =
    ecs.discovery === 'discover' || opportunity.nearbyHappenings.length > 0
      ? 'Discovery-forward'
      : 'Reliable'
  const flavorCorpus = `${opportunity.flavor} ${opportunity.fit.matchLine ?? ''}`.toLowerCase()
  const vibeTrait =
    flavorCorpus.includes('culture') || flavorCorpus.includes('museum') || flavorCorpus.includes('gallery')
      ? 'Cultural'
      : flavorCorpus.includes('intimate') || flavorCorpus.includes('cozy') || flavorCorpus.includes('romantic')
        ? 'Intimate'
        : flavorCorpus.includes('lively') || flavorCorpus.includes('pulse') || flavorCorpus.includes('energetic')
          ? 'Lively'
          : ecs.highlight === 'standout'
            ? 'Standout'
            : 'Balanced'
  return [explorationTrait, discoveryTrait, vibeTrait]
}

function uniqueStopNames(names: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  names.forEach((name) => {
    const trimmed = (name ?? '').trim()
    if (!trimmed) {
      return
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    ordered.push(trimmed)
  })
  return ordered
}

function firstDistinctStop(candidates: string[], blocked: string[]): string | null {
  const blockedSet = new Set(blocked.map((value) => value.trim().toLowerCase()))
  for (const candidate of candidates) {
    if (!blockedSet.has(candidate.toLowerCase())) {
      return candidate
    }
  }
  return null
}

function validateOrRepairStep2StorySpine(
  opportunity: VerifiedCityOpportunity,
): Step2BuiltNightCard['storySpine'] {
  const fallbackHighlight = opportunity.anchor.name || opportunity.storySpine.highlight
  const highlight = fallbackHighlight.trim()
  const startCandidates = uniqueStopNames([
    ...opportunity.starts.map((entry) => entry.name),
    opportunity.storySpine.start,
    ...opportunity.closes.map((entry) => entry.name),
  ])
  const windDownCandidates = uniqueStopNames([
    ...opportunity.closes.map((entry) => entry.name),
    opportunity.storySpine.windDown,
    ...opportunity.starts.map((entry) => entry.name),
  ])
  const fallbackStart = startCandidates[0] ?? opportunity.storySpine.start
  const start = firstDistinctStop(startCandidates, [highlight]) ?? fallbackStart
  const fallbackWindDown =
    windDownCandidates[0] ?? opportunity.storySpine.windDown ?? opportunity.storySpine.start
  const windDown =
    firstDistinctStop(windDownCandidates, [highlight, start]) ??
    firstDistinctStop(windDownCandidates, [highlight]) ??
    fallbackWindDown

  return {
    start: start || opportunity.storySpine.start,
    highlight: highlight || opportunity.storySpine.highlight,
    windDown: windDown || opportunity.storySpine.windDown,
  }
}

function getScenarioStopByPosition(
  night: BuiltScenarioNight,
  position: BuiltScenarioStop['position'],
): BuiltScenarioStop | undefined {
  return night.stops.find((stop) => stop.position === position)
}

function getScenarioHighlightStop(night: BuiltScenarioNight): BuiltScenarioStop | undefined {
  return (
    getScenarioStopByPosition(night, 'highlight') ??
    night.stops[Math.min(2, Math.max(0, night.stops.length - 1))]
  )
}

function getDominantScenarioDistrict(night: BuiltScenarioNight): string | undefined {
  const counts = new Map<string, { label: string; count: number }>()
  for (const stop of night.stops) {
    const district = stop.district?.trim()
    if (!district) {
      continue
    }
    const key = normalizeQualityText(district)
    const current = counts.get(key)
    if (current) {
      current.count += 1
    } else {
      counts.set(key, { label: district, count: 1 })
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))[0]
    ?.label
}

function mapBuiltScenarioStopToPreviewStop(stop: BuiltScenarioStop): BuiltScenarioPreviewStop {
  return {
    venueId: stop.venueId,
    name: stop.name,
    position: stop.position,
    stopType: stop.stopType,
    momentLabel: stop.momentLabel,
    whyThisStop: stop.whyThisStop,
    whyTonight: stop.whyTonight,
    address: stop.address,
    district: stop.district,
    neighborhoodLabel: stop.neighborhoodLabel,
    venueTypeLabel: stop.venueTypeLabel,
    factualSummary: stop.factualSummary,
    venueFeatures: stop.venueFeatures,
    serviceOptions: stop.serviceOptions,
    sourceType: stop.sourceType,
    evaluation: stop.evaluation,
  }
}

function mapBuiltScenarioNightToPreviewModel(
  night: BuiltScenarioNight,
): BuiltScenarioNightPreviewModel {
  return {
    nightId: night.id,
    title: night.title,
    flavorLine: night.flavorLine,
    whyThisWorks: night.whyThisWorks,
    evaluation: night.evaluation,
    stops: night.stops.map(mapBuiltScenarioStopToPreviewStop),
  }
}

function buildScenarioCanonicalWhyTonightProofLine(night: BuiltScenarioNight): string | undefined {
  const directStopSignal = night.stops.find((stop) => Boolean(stop.whyTonight))?.whyTonight
  if (directStopSignal) {
    return directStopSignal
  }
  if (night.evaluation?.passesGreatStopStandard === false) {
    return night.evaluation.notes?.[0]
  }
  return undefined
}

function buildScenarioSelectionContext(params: {
  night: BuiltScenarioNight
  districtDiscoveryCards: Array<{ id: string; name: string }>
  directionCards: RealityDirectionCard[]
}): { pocketId?: string; directionId?: string } {
  const { night, districtDiscoveryCards, directionCards } = params
  const highlightDistrict = getScenarioHighlightStop(night)?.district
  const dominantDistrict = getDominantScenarioDistrict(night)
  const districtHint = highlightDistrict ?? dominantDistrict
  if (!districtHint) {
    return {}
  }
  const matchedDistrict = districtDiscoveryCards.find((entry) => hasLoosePhraseMatch(entry.name, districtHint))
  if (!matchedDistrict) {
    return {}
  }
  const fallbackDirection = directionCards
    .filter((entry) => {
      const pocketId = entry.debugMeta?.pocketId ?? entry.id
      return pocketId === matchedDistrict.id
    })
    .sort((left, right) => {
      const leftScore = left.debugMeta?.confidence ?? 0
      const rightScore = right.debugMeta?.confidence ?? 0
      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }
      return left.id.localeCompare(right.id)
    })[0]
  return {
    pocketId: matchedDistrict.id,
    directionId: fallbackDirection?.id,
  }
}

function mapBuiltScenarioNightToVerifiedOpportunity(params: {
  night: BuiltScenarioNight
  districtDiscoveryCards: Array<{ id: string; name: string }>
  directionCards: RealityDirectionCard[]
  personaLabel: string
  vibeLabel: string
}): VerifiedCityOpportunity | null {
  const { night, districtDiscoveryCards, directionCards, personaLabel, vibeLabel } = params
  if (!night.complete || night.stops.length === 0) {
    return null
  }
  const firstStop = night.stops[0]
  const highlightStop = getScenarioHighlightStop(night) ?? firstStop
  const windDownStop = getScenarioStopByPosition(night, 'closer') ?? night.stops[night.stops.length - 1]
  if (!highlightStop || !windDownStop) {
    return null
  }
  const dominantDistrict =
    highlightStop.district ??
    getDominantScenarioDistrict(night) ??
    districtDiscoveryCards[0]?.name ??
    'San Jose'
  const secondaryDistricts = uniqueStopNames(
    night.stops.map((stop) => stop.district).filter((entry) => !hasLoosePhraseMatch(entry ?? '', dominantDistrict)),
  ).slice(0, 2)
  const starts: CityOpportunityStopOption[] = [
    {
      venueId: firstStop.venueId,
      name: firstStop.name,
      address: firstStop.address,
      reason: firstStop.whyThisStop || firstStop.reasons[0] || 'Strong scenario start.',
      score: clampScore(firstStop.authorityScore * 0.62 + firstStop.currentRelevance * 0.38),
    },
  ]
  const closes: CityOpportunityStopOption[] = [
    {
      venueId: windDownStop.venueId,
      name: windDownStop.name,
      address: windDownStop.address,
      reason: windDownStop.whyThisStop || windDownStop.reasons[0] || 'Strong scenario landing.',
      score: clampScore(windDownStop.authorityScore * 0.58 + windDownStop.currentRelevance * 0.42),
    },
  ]
  const whyTonightStrength = clampScore(
    night.stops.reduce((sum, stop) => sum + stop.currentRelevance, 0) / Math.max(1, night.stops.length),
  )
  const cozyAuthorityStrength = clampScore(
    highlightStop.authorityScore * 0.74 + (highlightStop.isHiddenGem ? 0.18 : 0.08),
  )
  const selection = buildScenarioSelectionContext({
    night,
    districtDiscoveryCards,
    directionCards,
  })

  return {
    id: `step2_scenario_${night.id}`,
    flavor: night.flavorLine,
    anchor: {
      venueId: highlightStop.venueId,
      name: highlightStop.name,
      address: highlightStop.address,
      district: highlightStop.district ?? dominantDistrict,
      sourceType: highlightStop.sourceType,
      verificationReasons: highlightStop.reasons.slice(0, 2),
    },
    starts,
    closes,
    nearbyHappenings: [],
    districtContext: {
      primaryDistrict: dominantDistrict,
      secondaryDistricts: secondaryDistricts.length > 0 ? secondaryDistricts : undefined,
    },
    fit: {
      persona: personaLabel,
      vibe: vibeLabel,
      confidenceLine: night.whyThisWorks,
      matchLine: night.title,
    },
    storySpine: {
      start: firstStop.name,
      highlight: highlightStop.name,
      windDown: windDownStop.name,
    },
    selection,
    survivorSignals: {
      whyTonightStrength,
      cozyAuthorityStrength,
      highWhyTonight: whyTonightStrength >= 0.64,
      highCozyAuthority: cozyAuthorityStrength >= 0.62,
    },
    excellence: {
      score: clampScore(highlightStop.authorityScore * 0.52 + whyTonightStrength * 0.48),
      threshold: 0.62,
      passes: true,
      anchorStrength: highlightStop.authorityScore,
      startQuality: starts[0]?.score ?? 0.62,
      windDownQuality: closes[0]?.score ?? 0.62,
      supportCoherence: 0.78,
      scenarioAlignment: 0.84,
      experienceAlignment: 0.82,
      localAuthority: highlightStop.authorityScore,
      modeExcellence: 0.8,
    },
    whyTonightProofLine: buildScenarioCanonicalWhyTonightProofLine(night),
    // Boundary: Scenario Builder fields are canonical for supported romantic flows.
    scenarioNight: night,
    scenarioPreviewModel: mapBuiltScenarioNightToPreviewModel(night),
  }
}

const roleToInternalRole: Record<UserStopRole, keyof ScoredVenue['roleScores']> = {
  start: 'warmup',
  highlight: 'peak',
  surprise: 'wildcard',
  windDown: 'cooldown',
}

interface PlanningStopDisplay {
  title: string
  sourceBacked: boolean
}

interface CanonicalPlanningStopIdentity {
  role: UserStopRole
  stopId: string
  sourceVenueId: string
  displayName: string
  providerRecordId: string
  latitude: number
  longitude: number
  addressLine: string
  city: string
  neighborhood: string
}

function normalizePlanningNameCandidate(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return undefined
  }
  const token = normalized.toLowerCase()
  if (token === 'tbd' || token === 'unknown' || token === 'n/a') {
    return undefined
  }
  return normalized
}

function extractRepresentativeEntityName(traceLabel: string | undefined): string | undefined {
  const normalizedTrace = normalizePlanningNameCandidate(traceLabel)
  if (!normalizedTrace) {
    return undefined
  }
  const [entityNameCandidate] = normalizedTrace.split('|')
  return normalizePlanningNameCandidate(entityNameCandidate)
}

function getAnchorSearchChip(category: ItineraryStop['category']): AnchorSearchChip | undefined {
  if (category === 'restaurant') {
    return 'restaurant'
  }
  if (category === 'bar' || category === 'live_music') {
    return 'drinks'
  }
  if (category === 'park') {
    return 'park'
  }
  if (category === 'activity' || category === 'museum' || category === 'event') {
    return 'activity'
  }
  return undefined
}

function tokenizeName(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function computeNameOverlapScore(query: string, candidate: string): number {
  const queryTokens = new Set(tokenizeName(query))
  if (queryTokens.size === 0) {
    return 0
  }
  const candidateTokens = tokenizeName(candidate)
  if (candidateTokens.length === 0) {
    return 0
  }
  let overlapCount = 0
  for (const token of candidateTokens) {
    if (queryTokens.has(token)) {
      overlapCount += 1
    }
  }
  return overlapCount / queryTokens.size
}

function isLikelySyntheticVenueStyleName(name: string): boolean {
  const geoToken =
    /\b(district|downtown|midtown|uptown|japantown|willow|rose|river|alley|station|square|avenue|road)\b/i
  const venueToken =
    /\b(cellar|atelier|promenade|stroll|walk|loop|collective|corner|room|hall|yard|grove)\b/i
  return geoToken.test(name) && venueToken.test(name)
}

function hasSourceBackedIdentity(scoredVenue: ScoredVenue | undefined): boolean {
  if (!scoredVenue) {
    return false
  }
  const source = scoredVenue.venue.source
  const providerRecordId = source.providerRecordId?.trim()
  return Boolean(
    providerRecordId ||
      source.sourceOrigin === 'live' ||
      scoredVenue.candidateIdentity.parentPlaceId ||
      scoredVenue.candidateIdentity.baseVenueId,
  )
}

function hasNavigableVenueLocation(scoredVenue: ScoredVenue | undefined): boolean {
  if (!scoredVenue) {
    return false
  }
  const source = scoredVenue.venue.source
  const hasProviderRecord = Boolean(source.providerRecordId?.trim())
  const hasCoordinates =
    typeof source.latitude === 'number' && typeof source.longitude === 'number'
  const hasAreaContext = Boolean(
    scoredVenue.venue.city.trim() && scoredVenue.venue.neighborhood.trim(),
  )
  return hasProviderRecord || hasCoordinates || hasAreaContext
}

function isCommittedHighlightCandidateAnchored(scoredVenue: ScoredVenue): boolean {
  const resolvedDisplay = resolvePlanningVenueDisplayFromScoredVenue(scoredVenue)
  if (!resolvedDisplay.sourceBacked) {
    return false
  }
  if (!hasSourceBackedIdentity(scoredVenue)) {
    return false
  }
  if (!hasNavigableVenueLocation(scoredVenue)) {
    return false
  }
  if (
    scoredVenue.venue.source.normalizedFromRawType === 'seed' &&
    !scoredVenue.venue.source.providerRecordId &&
    isLikelySyntheticVenueStyleName(resolvedDisplay.title)
  ) {
    return false
  }
  return true
}

function isCanonicalAnchorSearchResult(
  providerRecordId: string | undefined,
  latitude: number | undefined,
  longitude: number | undefined,
  subtitle: string | undefined,
): providerRecordId is string {
  return Boolean(
    providerRecordId &&
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      subtitle?.trim(),
  )
}

async function resolveCanonicalPlanningStopIdentity(
  stop: ItineraryStop,
  scoredVenue?: ScoredVenue,
): Promise<CanonicalPlanningStopIdentity | undefined> {
  const directCanonical = resolveCanonicalPlanningStopIdentityFromScoredVenue(stop, scoredVenue)
  if (directCanonical) {
    return directCanonical
  }

  const queryCandidates = [
    normalizePlanningNameCandidate(stop.venueName),
    normalizePlanningNameCandidate(scoredVenue?.venue.name),
    extractRepresentativeEntityName(scoredVenue?.candidateIdentity.traceLabel),
  ].filter((value): value is string => Boolean(value))
  const uniqueQueries = [...new Set(queryCandidates)]
  if (uniqueQueries.length === 0) {
    return undefined
  }

  const searchCity =
    normalizePlanningNameCandidate(stop.city) ??
    normalizePlanningNameCandidate(scoredVenue?.venue.city)
  if (!searchCity) {
    return undefined
  }
  const searchNeighborhood =
    normalizePlanningNameCandidate(stop.neighborhood) ??
    normalizePlanningNameCandidate(scoredVenue?.venue.neighborhood)
  const chip = getAnchorSearchChip(stop.category)

  for (const query of uniqueQueries) {
    const candidates = await searchAnchorVenues({
      query,
      city: searchCity,
      neighborhood: searchNeighborhood,
      chip,
    })
    const ranked = candidates
      .map((candidate) => {
        const providerRecordId = candidate.venue.source.providerRecordId?.trim()
        const latitude = candidate.venue.source.latitude
        const longitude = candidate.venue.source.longitude
        const subtitle = candidate.subtitle?.trim()
        if (!isCanonicalAnchorSearchResult(providerRecordId, latitude, longitude, subtitle)) {
          return undefined
        }
        const overlapScore = computeNameOverlapScore(query, candidate.venue.name)
        if (overlapScore <= 0) {
          return undefined
        }
        return {
          candidate,
          overlapScore,
        }
      })
      .filter((value): value is { candidate: AnchorSearchResult; overlapScore: number } =>
        Boolean(value),
      )
      .sort((left, right) => right.overlapScore - left.overlapScore)
    const matched = ranked[0]?.candidate
    if (!matched) {
      continue
    }
    return {
      role: stop.role,
      stopId: stop.id,
      sourceVenueId: matched.venue.id,
      displayName: matched.venue.name,
      providerRecordId: matched.venue.source.providerRecordId!,
      latitude: matched.venue.source.latitude!,
      longitude: matched.venue.source.longitude!,
      addressLine: matched.subtitle.trim(),
      city: matched.venue.city,
      neighborhood: matched.venue.neighborhood,
    }
  }

  return undefined
}

function getPlanningFallbackCategoryLabel(category: ItineraryStop['category']): string {
  if (category === 'live_music') {
    return 'Live music venue'
  }
  if (category === 'cafe') {
    return 'Coffee stop'
  }
  if (category === 'bar') {
    return 'Bar stop'
  }
  if (category === 'dessert') {
    return 'Dessert stop'
  }
  if (category === 'restaurant') {
    return 'Restaurant stop'
  }
  if (category === 'activity') {
    return 'Activity stop'
  }
  if (category === 'museum') {
    return 'Museum stop'
  }
  if (category === 'park') {
    return 'Park stop'
  }
  return 'Event venue'
}

function buildPlanningFallbackStopTitle(stop: {
  category: ItineraryStop['category']
  neighborhood: string
  city: string
}): string {
  const categoryLabel = getPlanningFallbackCategoryLabel(stop.category)
  const neighborhood = stop.neighborhood.trim()
  const city = stop.city.trim()
  if (neighborhood) {
    return `${categoryLabel} in ${neighborhood}`
  }
  if (city) {
    return `${categoryLabel} near ${city}`
  }
  return `${categoryLabel} nearby`
}

function resolvePlanningStopDisplay(
  stop: ItineraryStop,
  scoredVenue?: ScoredVenue,
): PlanningStopDisplay {
  const genericFallback = buildPlanningFallbackStopTitle(stop)
  const genericFallbackToken = genericFallback.toLowerCase()
  const stopName = normalizePlanningNameCandidate(stop.venueName)
  const scoredVenueName = normalizePlanningNameCandidate(scoredVenue?.venue.name)
  const traceEntityName = extractRepresentativeEntityName(scoredVenue?.candidateIdentity.traceLabel)
  const preferredRealName =
    [stopName, scoredVenueName, traceEntityName].find(
      (candidate) => candidate && candidate.toLowerCase() !== genericFallbackToken,
    ) ?? undefined

  if (preferredRealName) {
    return {
      title: preferredRealName,
      sourceBacked: true,
    }
  }
  return {
    title: genericFallback,
    sourceBacked: false,
  }
}

function resolvePlanningVenueDisplayFromScoredVenue(
  scoredVenue: ScoredVenue,
): PlanningStopDisplay {
  const genericFallback = buildPlanningFallbackStopTitle({
    category: scoredVenue.venue.category,
    neighborhood: scoredVenue.venue.neighborhood,
    city: scoredVenue.venue.city,
  })
  const genericFallbackToken = genericFallback.toLowerCase()
  const venueName = normalizePlanningNameCandidate(scoredVenue.venue.name)
  const traceEntityName = extractRepresentativeEntityName(scoredVenue.candidateIdentity.traceLabel)
  const preferredRealName =
    [venueName, traceEntityName].find(
      (candidate) => candidate && candidate.toLowerCase() !== genericFallbackToken,
    ) ?? undefined

  if (preferredRealName) {
    return {
      title: preferredRealName,
      sourceBacked: true,
    }
  }
  return {
    title: genericFallback,
    sourceBacked: false,
  }
}

function buildCanonicalAddressLine(
  stop: ItineraryStop,
  scoredVenue?: ScoredVenue,
): string | undefined {
  const stopSubtitle = normalizePlanningNameCandidate(stop.subtitle)
  if (stopSubtitle) {
    return stopSubtitle
  }
  const neighborhood =
    normalizePlanningNameCandidate(stop.neighborhood) ??
    normalizePlanningNameCandidate(scoredVenue?.venue.neighborhood)
  const city =
    normalizePlanningNameCandidate(stop.city) ??
    normalizePlanningNameCandidate(scoredVenue?.venue.city)
  if (neighborhood && city) {
    return `${neighborhood}, ${city}`
  }
  return neighborhood ?? city
}

function resolveCanonicalPlanningStopIdentityFromScoredVenue(
  stop: ItineraryStop,
  scoredVenue?: ScoredVenue,
): CanonicalPlanningStopIdentity | undefined {
  if (!scoredVenue) {
    return undefined
  }
  const providerRecordId = scoredVenue.venue.source.providerRecordId?.trim()
  const latitude = scoredVenue.venue.source.latitude
  const longitude = scoredVenue.venue.source.longitude
  if (!providerRecordId || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return undefined
  }
  const addressLine = buildCanonicalAddressLine(stop, scoredVenue)
  if (!addressLine) {
    return undefined
  }
  const display = resolvePlanningStopDisplay(stop, scoredVenue)
  return {
    role: stop.role,
    stopId: stop.id,
    sourceVenueId: scoredVenue.venue.id,
    displayName: display.title,
    providerRecordId,
    latitude,
    longitude,
    addressLine,
    city: stop.city || scoredVenue.venue.city,
    neighborhood: stop.neighborhood || scoredVenue.venue.neighborhood,
  }
}

function findScoredVenueForStop(
  stop: ItineraryStop,
  selectedArc: ArcCandidate,
): ScoredVenue | undefined {
  const targetRole = inverseRoleProjection[stop.role]
  const matched = selectedArc.stops.find(
    (arcStop) =>
      arcStop.role === targetRole &&
      arcStop.scoredVenue.venue.id === stop.venueId,
  )
  if (matched) {
    return matched.scoredVenue
  }
  return selectedArc.stops.find((arcStop) => arcStop.role === targetRole)?.scoredVenue
}

interface FullStopRealityContractOutcome {
  selectedArc: ArcCandidate
  itinerary: Itinerary
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>>
  rejectedStopRoles: UserStopRole[]
}

async function enforceFullStopRealityContract(params: {
  itinerary: Itinerary
  selectedArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  intentProfile: IntentProfile
  lens: ExperienceLens
}): Promise<FullStopRealityContractOutcome> {
  let nextArc = params.selectedArc
  let nextItinerary = params.itinerary
  const rejectedStopRoles: UserStopRole[] = []
  const committedRoles = nextItinerary.stops
    .map((stop) => stop.role)
    .filter(
      (role): role is UserStopRole =>
        role === 'start' || role === 'highlight' || role === 'windDown',
    )

  const crewPolicy = getCrewPolicy(params.intentProfile.crew)
  for (const role of committedRoles) {
    const currentStop = nextItinerary.stops.find((stop) => stop.role === role)
    if (!currentStop) {
      continue
    }
    const currentScoredVenue = findScoredVenueForStop(currentStop, nextArc)
    const currentCanonical = await resolveCanonicalPlanningStopIdentity(
      currentStop,
      currentScoredVenue,
    )
    if (currentCanonical) {
      continue
    }

    const internalRole = inverseRoleProjection[role]
    const replacementCandidates = params.scoredVenues
      .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
      .filter((candidate) => candidate.venue.id !== currentScoredVenue?.venue.id)
      .sort((left, right) => {
        const roleScoreKey = roleToInternalRole[role]
        const leftScore = scoreAnchoredRoleFit(left, roleScoreKey)
        const rightScore = scoreAnchoredRoleFit(right, roleScoreKey)
        return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name)
      })
    let replaced = false

    for (const candidate of replacementCandidates) {
      const swappedArc = swapArcStop({
        currentArc: nextArc,
        role: internalRole,
        replacement: candidate,
        intent: params.intentProfile,
        crewPolicy,
        lens: params.lens,
      })
      if (!swappedArc) {
        continue
      }
      const swappedItinerary = projectItinerary(swappedArc, params.intentProfile, params.lens)
      const swappedStop = swappedItinerary.stops.find((item) => item.role === role)
      if (!swappedStop) {
        continue
      }
      const swappedScoredVenue = findScoredVenueForStop(swappedStop, swappedArc)
      const swappedCanonical = await resolveCanonicalPlanningStopIdentity(
        swappedStop,
        swappedScoredVenue,
      )
      if (!swappedCanonical) {
        continue
      }
      nextArc = swappedArc
      nextItinerary = swappedItinerary
      rejectedStopRoles.push(role)
      replaced = true
      break
    }

    if (!replaced) {
      throw new Error(
        `No canonical source-backed ${role} stop is available for planning mode.`,
      )
    }
  }

  const canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>> = {}
  for (const stop of nextItinerary.stops) {
    const scoredVenue = findScoredVenueForStop(stop, nextArc)
    const canonical = await resolveCanonicalPlanningStopIdentity(stop, scoredVenue)
    if (!canonical) {
      if (stop.role === 'surprise') {
        continue
      }
      throw new Error(
        `Canonical identity resolution failed for committed ${stop.role} stop.`,
      )
    }
    canonicalStopByRole[stop.role] = canonical
  }

  return {
    selectedArc: nextArc,
    itinerary: nextItinerary,
    canonicalStopByRole,
    rejectedStopRoles,
  }
}

function applyCanonicalIdentityToItinerary(
  itinerary: Itinerary,
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>>,
): Itinerary {
  return {
    ...itinerary,
    stops: itinerary.stops.map((stop) => {
      const canonical = canonicalStopByRole[stop.role]
      if (!canonical) {
        return stop
      }
      return {
        ...stop,
        venueName: canonical.displayName,
        city: canonical.city,
        neighborhood: canonical.neighborhood,
      }
    }),
  }
}

function toFinalRouteStop(
  stop: ItineraryStop,
  stopIndex: number,
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>>,
): FinalRouteStop | null {
  const canonical = canonicalStopByRole[stop.role]
  if (
    !canonical ||
    !canonical.providerRecordId ||
    !canonical.displayName ||
    typeof canonical.latitude !== 'number' ||
    typeof canonical.longitude !== 'number' ||
    !canonical.addressLine
  ) {
    return null
  }
  return {
    id: stop.id,
    sourceStopId: stop.id,
    displayName: canonical.displayName,
    providerRecordId: canonical.providerRecordId,
    latitude: canonical.latitude,
    longitude: canonical.longitude,
    address: canonical.addressLine,
    role: stop.role,
    stopIndex,
    venueId: stop.venueId,
    title: stop.title,
    subtitle: stop.subtitle,
    neighborhood: canonical.neighborhood || stop.neighborhood,
    driveMinutes: stop.driveMinutes,
    imageUrl: stop.imageUrl,
  }
}

function buildFinalRoute(params: {
  itinerary: Itinerary
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>>
  selectedDirectionId: string
  city: string
  persona: PersonaMode
  vibe: VibeAnchor
  activeRole: UserStopRole
  selectedCluster: RealityCluster
  selectedDirectionPreviewContext?: SelectedDirectionPreviewContext
}): FinalRoute | null {
  const stops = params.itinerary.stops
    .map((stop, stopIndex) => toFinalRouteStop(stop, stopIndex, params.canonicalStopByRole))
  if (stops.some((stop) => !stop)) {
    return null
  }
  const committedStops = stops.filter((stop): stop is FinalRouteStop => Boolean(stop))
  const routeHeadline = getPreviewOneLiner(
    params.selectedCluster,
    params.itinerary,
    params.selectedDirectionPreviewContext,
  )
  const routeSummary = getPreviewContinuityLine(
    params.selectedCluster,
    params.itinerary,
    params.selectedDirectionPreviewContext,
  )
  const activeStopIndex = Math.max(
    0,
    committedStops.findIndex((stop) => stop.role === params.activeRole),
  )
  return {
    routeId: `${params.itinerary.id}-${Date.now()}`,
    selectedDirectionId: params.selectedDirectionId,
    location: params.city,
    persona: params.persona,
    vibe: params.vibe,
    stops: committedStops,
    activeStopIndex,
    routeHeadline,
    routeSummary,
    mapMarkers: committedStops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: Date.now(),
  }
}

function buildFinalRouteMapMarkers(
  stops: FinalRouteStop[],
): FinalRoute['mapMarkers'] {
  return stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }))
}

function patchFinalRouteStop(params: {
  route: FinalRoute
  targetRole: UserStopRole
  targetStopId?: string
  targetStopIndex?: number
  replacementStop: FinalRouteStop
  notice?: string
  activeRole?: UserStopRole
}): {
  route: FinalRoute
  resolvedStop: FinalRouteStop
  resolution: 'id' | 'index' | 'role'
} | null {
  const orderedStops = params.route.stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
  let replaceIndex = -1
  let resolution: 'id' | 'index' | 'role' | null = null
  if (params.targetStopId) {
    replaceIndex = orderedStops.findIndex((stop) => stop.id === params.targetStopId)
    if (replaceIndex >= 0) {
      resolution = 'id'
    }
  }
  if (replaceIndex < 0 && typeof params.targetStopIndex === 'number') {
    replaceIndex = orderedStops.findIndex((stop) => stop.stopIndex === params.targetStopIndex)
    if (replaceIndex >= 0) {
      resolution = 'index'
    }
  }
  if (replaceIndex < 0) {
    replaceIndex = orderedStops.findIndex((stop) => stop.role === params.targetRole)
    if (replaceIndex >= 0) {
      resolution = 'role'
    }
  }
  if (replaceIndex < 0 || !resolution) {
    return null
  }
  const currentStop = orderedStops[replaceIndex]
  if (!currentStop) {
    return null
  }
  const replacementStop: FinalRouteStop = {
    ...currentStop,
    ...params.replacementStop,
    title: currentStop.title,
    role: currentStop.role,
    stopIndex: currentStop.stopIndex,
  }
  const nextStops = orderedStops.map((stop, index) =>
    index === replaceIndex ? replacementStop : stop,
  )
  const nextActiveStopIndex =
    params.activeRole != null
      ? Math.max(0, nextStops.findIndex((stop) => stop.role === params.activeRole))
      : params.route.activeStopIndex
  return {
    route: {
      ...params.route,
      routeId: `${params.route.routeId}-swap-${Date.now()}`,
      stops: nextStops,
      activeStopIndex: nextActiveStopIndex,
      mapMarkers: buildFinalRouteMapMarkers(nextStops),
      liveNotices: params.notice
        ? [...(params.route.liveNotices ?? []), params.notice]
        : params.route.liveNotices,
      updatedAt: Date.now(),
    },
    resolvedStop: currentStop,
    resolution,
  }
}

function logSwapCommitChecks(
  route: FinalRoute,
  swappedRole: UserStopRole,
  surfaces: string[],
): void {
  if (!import.meta.env.DEV) {
    return
  }
  const stopNames = route.stops.map((stop) => stop.displayName)
  const stopIds = route.stops.map((stop) => stop.providerRecordId || stop.id)
  console.log('SWAP COMMIT CHECK', {
    routeId: route.routeId,
    swappedRole,
    stopNames,
    stopIds,
  })
  surfaces.forEach((surface) => {
    console.log('SURFACE ROUTE CHECK', {
      surface,
      routeId: route.routeId,
      stopNames,
    })
  })
}

function clampTasteScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

function formatTasteScore(value: number): string {
  return value.toFixed(2)
}

function deriveFoundationTasteSignals(
  scoredVenue: ScoredVenue | undefined,
  timeWindow?: string,
  persona?: PersonaMode | null,
  vibe?: VibeAnchor | null,
): TasteSignals | undefined {
  if (!scoredVenue) {
    return undefined
  }
  return interpretVenueTaste(mapVenueToTasteInput(scoredVenue.venue), {
    timeWindow,
    persona: persona ?? undefined,
    vibe: vibe ?? undefined,
  })
}

function formatTasteRoleSuitabilitySummary(signals: TasteSignals | undefined): string {
  if (!signals) {
    return 'n/a'
  }
  return `start:${formatTasteScore(signals.roleSuitability.start)} | highlight:${formatTasteScore(
    signals.roleSuitability.highlight,
  )} | windDown:${formatTasteScore(signals.roleSuitability.windDown)}`
}

function formatTasteSignalSummary(signals: TasteSignals | undefined): string {
  if (!signals) {
    return 'n/a'
  }
  return `energy:${formatTasteScore(signals.energy)} social:${formatTasteScore(
    signals.socialDensity,
  )} intimacy:${formatTasteScore(signals.intimacy)} linger:${formatTasteScore(
    signals.lingerFactor,
  )} destination:${formatTasteScore(signals.destinationFactor)} experiential:${formatTasteScore(
    signals.experientialFactor,
  )} convo:${formatTasteScore(signals.conversationFriendliness)}`
}

function formatTastePersonalitySummary(signals: TasteSignals | undefined): string {
  if (!signals || signals.venuePersonality.tags.length === 0) {
    return 'n/a'
  }
  return signals.venuePersonality.tags.join(' | ')
}

function formatHighlightRoleContrastSummary(signals: TasteSignals | undefined): string {
  if (!signals) {
    return 'n/a'
  }
  const highlightVsStart = signals.roleSuitability.highlight - signals.roleSuitability.start
  const highlightVsWindDown = signals.roleSuitability.highlight - signals.roleSuitability.windDown
  return `h-s:${formatTasteScore(highlightVsStart)} | h-w:${formatTasteScore(highlightVsWindDown)}`
}

function formatHighlightTierReasonSummary(signals: TasteSignals | undefined): string {
  if (!signals) {
    return 'n/a'
  }
  const quickPenalty = signals.durationEstimate === 'quick' ? 'quick_duration_penalty' : 'no_quick_penalty'
  const personality = signals.venuePersonality.tags.join('|') || 'none'
  return `tier:${signals.highlightTier} | dest:${formatTasteScore(
    signals.destinationFactor,
  )} exp:${formatTasteScore(signals.experientialFactor)} sig:${formatTasteScore(
    signals.anchorStrength,
  )} | ${quickPenalty} | personality:${personality}`
}

function formatEnergyBand(value: number | undefined): string {
  if (typeof value !== 'number') {
    return 'n/a'
  }
  if (value >= 0.78) {
    return 'high-pulse'
  }
  if (value >= 0.62) {
    return 'animated'
  }
  if (value >= 0.46) {
    return 'balanced'
  }
  return 'soft'
}

function formatSocialDensityBand(value: number | undefined): string {
  if (typeof value !== 'number') {
    return 'n/a'
  }
  if (value >= 0.78) {
    return 'broad-social'
  }
  if (value >= 0.62) {
    return 'contained-social'
  }
  if (value >= 0.46) {
    return 'mixed-social'
  }
  return 'quiet-social'
}

function formatSelectedHighlightVibeFit(
  signals: TasteSignals | undefined,
  persona: PersonaMode | null | undefined,
  vibe: VibeAnchor | null | undefined,
): string {
  if (!signals || !vibe) {
    return 'n/a'
  }
  const livelyLike = vibe === 'lively' || vibe === 'playful'
  const cozyLike = vibe === 'cozy' || vibe === 'chill'
  const energyBand = formatEnergyBand(signals.energy)
  const socialBand = formatSocialDensityBand(signals.socialDensity)
  const highlightStrength = signals.roleSuitability.highlight
  if (livelyLike) {
    const containedLivelyFit =
      signals.energy >= 0.56 &&
      signals.socialDensity >= 0.54 &&
      highlightStrength >= 0.62 &&
      (persona !== 'romantic' ||
        signals.intimacy >= 0.48 ||
        signals.conversationFriendliness >= 0.5)
    return containedLivelyFit ? `strong (${energyBand}/${socialBand})` : `soft (${energyBand}/${socialBand})`
  }
  if (cozyLike) {
    const cozyFit =
      signals.energy <= 0.62 &&
      signals.socialDensity <= 0.62 &&
      signals.intimacy >= 0.52 &&
      highlightStrength >= 0.54
    return cozyFit ? `strong (${energyBand}/${socialBand})` : `drifted (${energyBand}/${socialBand})`
  }
  return `balanced (${energyBand}/${socialBand})`
}

function formatVibePressureSummary(
  signals: TasteSignals | undefined,
  persona: PersonaMode | null | undefined,
  vibe: VibeAnchor | null | undefined,
): string {
  if (!signals || !vibe) {
    return 'n/a'
  }
  const livelyLike = vibe === 'lively' || vibe === 'playful'
  const cozyLike = vibe === 'cozy' || vibe === 'chill'
  const tension = formatTasteScore(signals.roleSuitability.highlight - signals.roleSuitability.windDown)
  if (livelyLike) {
    const mode = persona === 'romantic' ? 'contained_pulse' : persona === 'friends' ? 'broad_pulse' : 'animated_pulse'
    return `${mode} | energy:${formatEnergyBand(signals.energy)} | social:${formatSocialDensityBand(signals.socialDensity)} | h-w:${tension}`
  }
  if (cozyLike) {
    return `soft_contained | energy:${formatEnergyBand(signals.energy)} | social:${formatSocialDensityBand(signals.socialDensity)} | h-w:${tension}`
  }
  return `balanced_tone | energy:${formatEnergyBand(signals.energy)} | social:${formatSocialDensityBand(signals.socialDensity)} | h-w:${tension}`
}

function formatToneSeparationSummary(
  signals: TasteSignals | undefined,
): string {
  if (!signals) {
    return 'n/a'
  }
  const highlightVsStart = formatTasteScore(
    signals.roleSuitability.highlight - signals.roleSuitability.start,
  )
  const highlightVsWindDown = formatTasteScore(
    signals.roleSuitability.highlight - signals.roleSuitability.windDown,
  )
  return `h-s:${highlightVsStart} | h-w:${highlightVsWindDown} | tier:${signals.highlightTier}`
}

function getFoundationTasteSignalsForRole(
  plan: DemoPlanState | undefined,
  role: CoreTasteRole,
): TasteSignals | undefined {
  if (!plan) {
    return undefined
  }
  const stop = plan.itinerary.stops.find((entry) => entry.role === role)
  if (!stop) {
    return undefined
  }
  const scoredVenue = findScoredVenueForStop(stop, plan.selectedArc)
  return deriveFoundationTasteSignals(
    scoredVenue,
    plan.intentProfile.timeWindow,
    plan.intentProfile.persona ?? undefined,
    plan.intentProfile.primaryAnchor,
  )
}

function buildTasteVenuePersonalityProfile(candidate: ScoredVenue): TasteVenuePersonalityProfile {
  const signals = candidate.taste.signals
  const tags = toTagSet(candidate.venue.tags)
  const intimate =
    signals.intimacy >= 0.58 ||
    ['intimate', 'cozy', 'quiet', 'conversation', 'romantic', 'courtyard'].some((tag) =>
      tags.has(tag),
    )
  const social =
    signals.socialDensity >= 0.6 ||
    ['social', 'cocktails', 'lively', 'buzzing', 'live', 'music', 'jazz'].some((tag) =>
      tags.has(tag),
    )
  const destination =
    signals.destinationFactor >= 0.58 ||
    signals.highlightTier === 1 ||
    ['destination', 'signature', 'chef-led', 'tasting'].some((tag) => tags.has(tag))
  const lingering =
    signals.lingerFactor >= 0.56 ||
    signals.durationEstimate === 'extended' ||
    signals.durationEstimate === 'event' ||
    ['lingering', 'dessert', 'tea', 'wine', 'conversation'].some((tag) => tags.has(tag))
  const quickStop =
    signals.durationEstimate === 'quick' ||
    ['quick-stop', 'quick-start', 'walk-up', 'grab-and-go', 'counter-service'].some((tag) =>
      tags.has(tag),
    )
  const experiential =
    signals.experientialFactor >= 0.56 ||
    signals.momentIntensity.score >= 0.66 ||
    ['experiential', 'live', 'performance', 'immersive', 'tasting', 'curated'].some((tag) =>
      tags.has(tag),
    )
  const calm =
    signals.energy <= 0.46 ||
    ['quiet', 'calm', 'tea', 'dessert', 'bakery', 'low-key'].some((tag) => tags.has(tag))
  const highIntensity =
    signals.momentIntensity.score >= 0.72 ||
    signals.energy >= 0.72 ||
    ['high-energy', 'late-night', 'night-owl', 'buzzing', 'lively'].some((tag) => tags.has(tag))
  const lowFriction =
    candidate.venue.driveMinutes <= 12 ||
    ['walkable', 'easy-entry', 'quick-start', 'reservation-recommended'].some((tag) =>
      tags.has(tag),
    )
  const summary = [
    intimate ? 'intimate' : null,
    social ? 'social' : null,
    destination ? 'destination' : null,
    lingering ? 'lingering' : null,
    quickStop ? 'quick-stop' : null,
    experiential ? 'experiential' : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' | ')

  return {
    intimate,
    social,
    destination,
    lingering,
    quickStop,
    experiential,
    calm,
    highIntensity,
    lowFriction,
    summary: summary || 'neutral',
  }
}

function getStrongCurationTasteBias(
  persona: PersonaMode,
  vibe: VibeAnchor,
  contractConstraints?: ContractConstraints,
): StrongCurationTasteBias {
  let highlightFloor = 0.62
  let startFloor = 0.5
  let windDownFloor = 0.5

  if (persona === 'friends') {
    highlightFloor = 0.58
    startFloor = 0.47
    windDownFloor = 0.46
  } else if (persona === 'family') {
    highlightFloor = 0.6
    startFloor = 0.54
    windDownFloor = 0.52
  }

  if (vibe === 'lively' || vibe === 'playful') {
    highlightFloor -= 0.02
  } else if (vibe === 'cozy' || vibe === 'chill') {
    highlightFloor += 0.02
    windDownFloor += 0.02
  } else if (vibe === 'cultured') {
    highlightFloor += 0.01
  }

  if (contractConstraints) {
    if (contractConstraints.highlightPressure === 'strong') {
      highlightFloor += 0.02
    } else if (contractConstraints.highlightPressure === 'distributed') {
      highlightFloor -= 0.06
    } else {
      highlightFloor -= 0.01
    }

    if (contractConstraints.peakCountModel === 'single') {
      highlightFloor += 0.02
      windDownFloor += 0.02
    } else if (contractConstraints.peakCountModel === 'multi') {
      highlightFloor -= 0.02
      startFloor -= 0.01
      windDownFloor -= 0.01
    } else if (contractConstraints.peakCountModel === 'distributed') {
      highlightFloor -= 0.05
      startFloor -= 0.01
    } else if (contractConstraints.peakCountModel === 'cumulative') {
      startFloor += 0.01
    }

    if (contractConstraints.requireRecoveryWindows) {
      startFloor += 0.03
      windDownFloor += 0.04
    }
    if (contractConstraints.requireContinuity) {
      startFloor += 0.01
      windDownFloor += 0.01
    }
    if (contractConstraints.windDownStrictness === 'soft_required') {
      windDownFloor += 0.03
    } else if (contractConstraints.windDownStrictness === 'controlled') {
      windDownFloor += 0.01
    } else {
      windDownFloor -= 0.02
    }
    if (!contractConstraints.allowLateHighEnergy) {
      windDownFloor += 0.01
    }
    if (contractConstraints.movementTolerance === 'contained') {
      startFloor += 0.01
    }
  }

  const summary = `strong-curation | ${persona}/${vibe} | floors start ${formatTasteScore(startFloor)} highlight ${formatTasteScore(
    highlightFloor,
  )} windDown ${formatTasteScore(windDownFloor)} | constraints ${
    contractConstraints
      ? `${contractConstraints.peakCountModel}/${contractConstraints.highlightPressure}/${contractConstraints.windDownStrictness}`
      : 'none'
  }`
  return {
    highlightFloor: clampTasteScore(highlightFloor),
    startFloor: clampTasteScore(startFloor),
    windDownFloor: clampTasteScore(windDownFloor),
    summary,
  }
}

function deriveHighlightQualification(params: {
  candidate: ScoredVenue
  persona: PersonaMode
  vibe: VibeAnchor
  highlightFloor: number
  contractConstraints?: ContractConstraints
}): {
  score: number
  passed: boolean
  reason: string
  personality: TasteVenuePersonalityProfile
} {
  const { candidate, persona, vibe, highlightFloor, contractConstraints } = params
  const signals = candidate.taste.signals
  const personality = buildTasteVenuePersonalityProfile(candidate)
  const tierPenalty = signals.highlightTier === 1 ? 0.08 : signals.highlightTier === 2 ? -0.04 : -0.2

  let score =
    signals.roleSuitability.highlight * 0.32 +
    signals.momentIntensity.score * 0.22 +
    signals.destinationFactor * 0.16 +
    signals.experientialFactor * 0.14 +
    candidate.venue.signature.signatureScore * 0.1 +
    signals.personalityStrength * 0.06

  score += tierPenalty
  if (personality.destination) {
    score += 0.05
  }
  if (personality.experiential) {
    score += 0.04
  }
  if (personality.quickStop && !personality.destination && !personality.experiential) {
    score -= 0.24
  }
  if (personality.lingering && persona === 'romantic') {
    score += 0.05
  }
  if (personality.intimate && persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
    score += 0.06
  }
  if (persona === 'friends' && vibe === 'lively' && personality.social) {
    score += 0.05
  }
  if (persona === 'family' && personality.highIntensity) {
    score -= 0.08
  }
  if (persona === 'romantic' && vibe !== 'lively' && personality.social && !personality.intimate) {
    score -= 0.06
  }
  if (vibe === 'lively' && personality.highIntensity) {
    score += 0.03
  }
  if (contractConstraints) {
    if (
      contractConstraints.highlightPressure === 'strong' &&
      (personality.destination || personality.experiential)
    ) {
      score += 0.05
    }
    if (
      contractConstraints.highlightPressure === 'distributed' &&
      personality.destination &&
      !personality.experiential
    ) {
      score -= 0.04
    }
    if (
      contractConstraints.peakCountModel === 'single' &&
      !personality.destination &&
      !personality.intimate
    ) {
      score -= 0.04
    }
    if (contractConstraints.peakCountModel === 'multi' && personality.social) {
      score += 0.03
    }
    if (contractConstraints.requireEscalation && personality.highIntensity) {
      score += 0.03
    }
    if (!contractConstraints.allowLateHighEnergy && personality.highIntensity) {
      score -= 0.06
    }
    if (contractConstraints.kidEngagementRequired && personality.highIntensity) {
      score -= 0.04
    }
  }

  const normalizedScore = clampTasteScore(score)
  const passed = normalizedScore >= highlightFloor
  const reason = passed ? 'qualified' : 'below_highlight_floor'

  return {
    score: normalizedScore,
    passed,
    reason,
    personality,
  }
}

function deriveRoleEligibility(params: {
  role: CoreTasteRole
  candidate: ScoredVenue
  persona: PersonaMode
  vibe: VibeAnchor
  floors: StrongCurationTasteBias
  highlightQualification: ReturnType<typeof deriveHighlightQualification>
  contractConstraints?: ContractConstraints
}): TasteRoleEligibilitySnapshot {
  const { role, candidate, persona, vibe, floors, highlightQualification, contractConstraints } = params
  const signals = candidate.taste.signals
  const personality = highlightQualification.personality
  const floor = role === 'start' ? floors.startFloor : role === 'windDown' ? floors.windDownFloor : floors.highlightFloor

  if (role === 'highlight') {
    return {
      score: highlightQualification.score,
      floor,
      passed: highlightQualification.passed,
      reason: highlightQualification.reason,
    }
  }

  if (role === 'start') {
    let score =
      signals.roleSuitability.start * 0.58 +
      (personality.lowFriction ? 0.12 : 0) +
      (personality.quickStop ? 0.06 : 0) +
      (signals.energy <= 0.62 ? 0.05 : -0.03)
    if (personality.highIntensity) {
      score -= 0.12
    }
    if (personality.destination && !personality.lowFriction) {
      score -= 0.06
    }
    if (persona === 'family' && !personality.lowFriction) {
      score -= 0.08
    }
    if (persona === 'friends' && vibe === 'lively' && personality.social) {
      score += 0.03
    }
    if (contractConstraints?.requireContinuity && !personality.lowFriction) {
      score -= 0.06
    }
    if (
      contractConstraints &&
      (contractConstraints.movementTolerance === 'contained' ||
        contractConstraints.movementTolerance === 'compressed') &&
      !personality.lowFriction
    ) {
      score -= 0.04
    }
    if (contractConstraints?.groupBasecampPreferred && personality.social) {
      score += 0.03
    }
    const normalized = clampTasteScore(score)
    const passed = normalized >= floor
    return {
      score: normalized,
      floor,
      passed,
      reason: passed ? 'qualified' : 'below_start_floor',
    }
  }

  let windDownScore =
    signals.roleSuitability.windDown * 0.56 +
    (personality.calm ? 0.09 : 0) +
    (personality.lingering ? 0.07 : 0) +
    (signals.energy <= 0.54 ? 0.06 : -0.02)
  if (personality.highIntensity) {
    windDownScore -= 0.16
  }
  if (personality.quickStop && !personality.calm) {
    windDownScore -= 0.06
  }
  if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill') && personality.intimate) {
    windDownScore += 0.05
  }
  if (persona === 'friends' && vibe === 'lively' && personality.social && !personality.calm) {
    windDownScore -= 0.04
  }
  if (contractConstraints?.requireRecoveryWindows && personality.calm) {
    windDownScore += 0.05
  }
  if (contractConstraints?.requireRecoveryWindows && !personality.calm && !personality.lingering) {
    windDownScore -= 0.06
  }
  if (contractConstraints && !contractConstraints.allowLateHighEnergy && personality.highIntensity) {
    windDownScore -= 0.08
  }
  if (contractConstraints?.windDownStrictness === 'soft_required' && personality.lingering) {
    windDownScore += 0.03
  }
  const normalizedWindDown = clampTasteScore(windDownScore)
  const windDownPassed = normalizedWindDown >= floor
  return {
    score: normalizedWindDown,
    floor,
    passed: windDownPassed,
    reason: windDownPassed ? 'qualified' : 'below_winddown_floor',
  }
}

function buildCandidateQualificationMap(params: {
  scoredVenues: ScoredVenue[]
  persona: PersonaMode
  vibe: VibeAnchor
  floors: StrongCurationTasteBias
  contractConstraints?: ContractConstraints
}): Record<string, TasteCandidateQualification> {
  const { scoredVenues, persona, vibe, floors, contractConstraints } = params
  const qualificationByCandidateId: Record<string, TasteCandidateQualification> = {}
  for (const candidate of scoredVenues) {
    const highlightQualification = deriveHighlightQualification({
      candidate,
      persona,
      vibe,
      highlightFloor: floors.highlightFloor,
      contractConstraints,
    })
    const roleEligibility: Record<CoreTasteRole, TasteRoleEligibilitySnapshot> = {
      start: deriveRoleEligibility({
        role: 'start',
        candidate,
        persona,
        vibe,
        floors,
        highlightQualification,
        contractConstraints,
      }),
      highlight: deriveRoleEligibility({
        role: 'highlight',
        candidate,
        persona,
        vibe,
        floors,
        highlightQualification,
        contractConstraints,
      }),
      windDown: deriveRoleEligibility({
        role: 'windDown',
        candidate,
        persona,
        vibe,
        floors,
        highlightQualification,
        contractConstraints,
      }),
    }
    qualificationByCandidateId[candidate.candidateIdentity.candidateId] = {
      candidateId: candidate.candidateIdentity.candidateId,
      highlightQualificationScore: highlightQualification.score,
      highlightQualificationPassed: highlightQualification.passed,
      roleEligibility,
      venuePersonality: highlightQualification.personality,
    }
  }
  return qualificationByCandidateId
}

function getCandidateQualificationForVenue(
  qualificationByCandidateId: Record<string, TasteCandidateQualification>,
  candidate: ScoredVenue,
): TasteCandidateQualification | undefined {
  const byCandidate = qualificationByCandidateId[candidate.candidateIdentity.candidateId]
  if (byCandidate) {
    return byCandidate
  }
  return Object.values(qualificationByCandidateId).find(
    (entry) => entry.candidateId.split('::')[0] === candidate.venue.id,
  )
}

function applyStrongCurationRoleScoreShaping(params: {
  candidate: ScoredVenue
  qualification?: TasteCandidateQualification
  rolePoolMembershipByRole: Record<CoreTasteRole, Set<string>>
}): ScoredVenue {
  const { candidate, qualification, rolePoolMembershipByRole } = params
  if (!qualification) {
    return candidate
  }
  const inStartPool = rolePoolMembershipByRole.start.has(candidate.venue.id)
  const inHighlightPool = rolePoolMembershipByRole.highlight.has(candidate.venue.id)
  const inWindDownPool = rolePoolMembershipByRole.windDown.has(candidate.venue.id)
  const startMultiplier = qualification.roleEligibility.start.passed
    ? 1 + (qualification.roleEligibility.start.score - qualification.roleEligibility.start.floor) * 0.32
    : 0.34
  const highlightMultiplier = qualification.roleEligibility.highlight.passed
    ? 1 + (qualification.highlightQualificationScore - qualification.roleEligibility.highlight.floor) * 0.5
    : 0.16
  const windDownMultiplier = qualification.roleEligibility.windDown.passed
    ? 1 + (qualification.roleEligibility.windDown.score - qualification.roleEligibility.windDown.floor) * 0.34
    : 0.3

  return {
    ...candidate,
    roleScores: {
      ...candidate.roleScores,
      warmup: inStartPool
        ? clampTasteScore(candidate.roleScores.warmup * clampTasteScore(startMultiplier * 1.08))
        : clampTasteScore(candidate.roleScores.warmup * 0.18),
      peak: inHighlightPool
        ? clampTasteScore(candidate.roleScores.peak * clampTasteScore(highlightMultiplier * 1.16))
        : clampTasteScore(candidate.roleScores.peak * 0.07),
      cooldown: inWindDownPool
        ? clampTasteScore(candidate.roleScores.cooldown * clampTasteScore(windDownMultiplier * 1.09))
        : clampTasteScore(candidate.roleScores.cooldown * 0.18),
    },
  }
}

function isStrictHighlightPoolCandidate(params: {
  candidate: ScoredVenue
  qualification: TasteCandidateQualification
  persona: PersonaMode
  vibe: VibeAnchor
  thinPoolHighlightFallbackApplied: boolean
  contractConstraints?: ContractConstraints
}): boolean {
  const {
    candidate,
    qualification,
    persona,
    vibe,
    thinPoolHighlightFallbackApplied,
    contractConstraints,
  } = params
  const personality = qualification.venuePersonality
  const signals = candidate.taste.signals
  const highlightFloor = qualification.roleEligibility.highlight.floor
  const strongQualification = qualification.highlightQualificationScore >= highlightFloor + 0.08
  const exceptionalTier2 =
    qualification.highlightQualificationScore >= highlightFloor + 0.11 &&
    (personality.destination || personality.experiential) &&
    candidate.venue.signature.signatureScore >= 0.56

  if (!qualification.highlightQualificationPassed || !qualification.roleEligibility.highlight.passed) {
    return false
  }
  if (personality.quickStop && !personality.destination && !personality.experiential) {
    return false
  }
  if (
    candidate.venue.signature.signatureScore < 0.48 &&
    signals.destinationFactor < 0.5 &&
    signals.experientialFactor < 0.5
  ) {
    return false
  }
  if (signals.highlightTier === 3) {
    if (!thinPoolHighlightFallbackApplied) {
      return false
    }
    return strongQualification
  }
  if (signals.highlightTier === 2 && !thinPoolHighlightFallbackApplied && !exceptionalTier2) {
    return false
  }

  if (persona === 'romantic' && vibe === 'lively') {
    if (
      personality.social &&
      !personality.intimate &&
      !personality.destination &&
      qualification.highlightQualificationScore < highlightFloor + 0.1
    ) {
      return false
    }
  }
  if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
    if (personality.social && !personality.intimate && !thinPoolHighlightFallbackApplied) {
      return false
    }
    if (
      !personality.intimate &&
      !personality.lingering &&
      qualification.highlightQualificationScore < highlightFloor + 0.1
    ) {
      return false
    }
  }
  if (persona === 'family' && personality.highIntensity && !thinPoolHighlightFallbackApplied) {
    return false
  }
  if (
    contractConstraints &&
    !contractConstraints.allowLateHighEnergy &&
    personality.highIntensity &&
    !thinPoolHighlightFallbackApplied
  ) {
    return false
  }
  if (
    contractConstraints?.highlightPressure === 'strong' &&
    !personality.destination &&
    !personality.experiential &&
    qualification.highlightQualificationScore <
      qualification.roleEligibility.highlight.floor + 0.08
  ) {
    return false
  }
  if (
    contractConstraints?.highlightPressure === 'distributed' &&
    personality.destination &&
    !personality.social &&
    qualification.highlightQualificationScore <
      qualification.roleEligibility.highlight.floor + 0.1
  ) {
    return false
  }

  return true
}

function isStrictStartPoolCandidate(params: {
  candidate: ScoredVenue
  qualification: TasteCandidateQualification
  persona: PersonaMode
  vibe: VibeAnchor
  contractConstraints?: ContractConstraints
}): boolean {
  const { candidate, qualification, persona, vibe, contractConstraints } = params
  const personality = qualification.venuePersonality
  if (!qualification.roleEligibility.start.passed) {
    return false
  }
  if (personality.highIntensity) {
    return false
  }
  if (personality.destination && !personality.lowFriction) {
    return false
  }
  if (personality.quickStop && !personality.lowFriction) {
    return false
  }
  if (candidate.taste.signals.highlightTier === 1 && personality.destination) {
    return false
  }
  if (persona === 'family' && !personality.lowFriction) {
    return false
  }
  if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill') && !personality.intimate) {
    return false
  }
  if (
    contractConstraints?.requireContinuity &&
    !personality.lowFriction &&
    qualification.roleEligibility.start.score < qualification.roleEligibility.start.floor + 0.05
  ) {
    return false
  }
  if (contractConstraints?.requireRecoveryWindows && personality.highIntensity) {
    return false
  }
  return true
}

function isStrictWindDownPoolCandidate(params: {
  candidate: ScoredVenue
  qualification: TasteCandidateQualification
  persona: PersonaMode
  vibe: VibeAnchor
  contractConstraints?: ContractConstraints
}): boolean {
  const { candidate, qualification, persona, vibe, contractConstraints } = params
  const personality = qualification.venuePersonality
  const tags = toTagSet(candidate.venue.tags)
  if (!qualification.roleEligibility.windDown.passed) {
    return false
  }
  if (personality.highIntensity) {
    return false
  }
  if (tags.has('late-night') || tags.has('night-owl')) {
    return false
  }
  if (
    !personality.calm &&
    !personality.lingering &&
    qualification.roleEligibility.windDown.score <
      qualification.roleEligibility.windDown.floor + 0.08
  ) {
    return false
  }
  if (qualification.highlightQualificationScore >= qualification.roleEligibility.highlight.floor + 0.16) {
    return false
  }
  if (persona === 'friends' && vibe === 'lively' && personality.social && !personality.calm) {
    return false
  }
  if (contractConstraints?.requireRecoveryWindows && !personality.calm && !personality.lingering) {
    return false
  }
  if (contractConstraints && !contractConstraints.allowLateHighEnergy && personality.highIntensity) {
    return false
  }
  if (
    contractConstraints?.windDownStrictness === 'soft_required' &&
    !personality.calm &&
    !personality.lingering
  ) {
    return false
  }
  return true
}

function getCoreRolePoolCounts(scoredVenues: ScoredVenue[]): Record<CoreTasteRole, number> {
  const eligible = scoredVenues.filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
  return {
    start: eligible.filter((candidate) => candidate.roleScores.warmup >= 0.44).length,
    highlight: eligible.filter((candidate) => candidate.roleScores.peak >= 0.44).length,
    windDown: eligible.filter((candidate) => candidate.roleScores.cooldown >= 0.44).length,
  }
}

function scoreSignatureHighlightShortlistCandidate(params: {
  candidate: ScoredVenue
  qualification: TasteCandidateQualification
  persona: PersonaMode
  vibe: VibeAnchor
  contractConstraints?: ContractConstraints
}): number {
  const { candidate, qualification, persona, vibe, contractConstraints } = params
  const signals = candidate.taste.signals
  const personality = qualification.venuePersonality
  const tierWeight =
    signals.highlightTier === 1 ? 0.08 : signals.highlightTier === 2 ? -0.02 : -0.12

  let score =
    qualification.highlightQualificationScore * 0.38 +
    signals.roleSuitability.highlight * 0.16 +
    signals.momentIntensity.score * 0.13 +
    signals.destinationFactor * 0.11 +
    signals.experientialFactor * 0.1 +
    candidate.venue.signature.signatureScore * 0.08 +
    scoreAnchoredRoleFit(candidate, 'peak') * 0.04
  score += tierWeight
  if (personality.destination) {
    score += 0.05
  }
  if (personality.experiential) {
    score += 0.04
  }
  if (personality.quickStop && !personality.destination && !personality.experiential) {
    score -= 0.2
  }
  if (
    candidate.venue.signature.signatureScore < 0.48 &&
    signals.destinationFactor < 0.5 &&
    signals.experientialFactor < 0.5
  ) {
    score -= 0.12
  }

  if (persona === 'romantic' && vibe === 'lively') {
    if (personality.intimate || personality.lingering) {
      score += 0.05
    }
    if (personality.social && !personality.intimate && !personality.destination) {
      score -= 0.08
    }
  } else if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
    if (personality.intimate || personality.lingering) {
      score += 0.07
    }
    if (personality.social && !personality.intimate) {
      score -= 0.12
    }
  } else if (persona === 'friends' && vibe === 'lively') {
    if (personality.social || personality.highIntensity) {
      score += 0.06
    }
  } else if (persona === 'family') {
    if (personality.highIntensity) {
      score -= 0.12
    }
    if (personality.lowFriction || personality.lingering) {
      score += 0.03
    }
  }

  if (contractConstraints) {
    if (
      contractConstraints.highlightPressure === 'strong' &&
      (personality.destination || personality.experiential)
    ) {
      score += 0.04
    }
    if (contractConstraints.highlightPressure === 'distributed' && personality.social) {
      score += 0.05
    }
    if (!contractConstraints.allowLateHighEnergy && personality.highIntensity) {
      score -= 0.08
    }
    if (contractConstraints.peakCountModel === 'single' && personality.quickStop) {
      score -= 0.06
    }
  }

  return clampTasteScore(score)
}

function buildSignatureHighlightShortlist(params: {
  highlightPool: ScoredVenue[]
  qualifiedHighlightPool: ScoredVenue[]
  qualificationByCandidateId: Record<string, TasteCandidateQualification>
  persona: PersonaMode
  vibe: VibeAnchor
  thinPoolHighlightFallbackApplied: boolean
  contractConstraints?: ContractConstraints
}): {
  shortlist: SignatureHighlightShortlistEntry[]
  fallbackToQualifiedHighlightPool: boolean
} {
  const {
    highlightPool,
    qualifiedHighlightPool,
    qualificationByCandidateId,
    persona,
    vibe,
    thinPoolHighlightFallbackApplied,
    contractConstraints,
  } = params
  const sourcePool = highlightPool.length > 0 ? highlightPool : qualifiedHighlightPool
  if (sourcePool.length === 0) {
    return {
      shortlist: [],
      fallbackToQualifiedHighlightPool: true,
    }
  }

  const scored = sourcePool
    .map((candidate) => {
      const qualification = getCandidateQualificationForVenue(qualificationByCandidateId, candidate)
      if (!qualification) {
        return undefined
      }
      return {
        candidate,
        score: scoreSignatureHighlightShortlistCandidate({
          candidate,
          qualification,
          persona,
          vibe,
          contractConstraints,
        }),
      }
    })
    .filter((value): value is SignatureHighlightShortlistEntry => Boolean(value))
    .sort((left, right) => right.score - left.score || left.candidate.venue.name.localeCompare(right.candidate.venue.name))

  if (scored.length === 0) {
    return {
      shortlist: [],
      fallbackToQualifiedHighlightPool: true,
    }
  }

  const topScore = scored[0].score
  const dynamicThreshold = Math.max(
    thinPoolHighlightFallbackApplied ? 0.54 : 0.6,
    topScore -
      (contractConstraints?.highlightPressure === 'distributed'
        ? thinPoolHighlightFallbackApplied
          ? 0.24
          : 0.18
        : thinPoolHighlightFallbackApplied
          ? 0.18
          : 0.12),
  )
  const targetSize = scored.length >= 18 ? 8 : scored.length >= 12 ? 6 : scored.length >= 7 ? 5 : 3
  const shortlist = scored
    .filter((entry) => {
      const signals = entry.candidate.taste.signals
      if (signals.highlightTier === 3 && !thinPoolHighlightFallbackApplied) {
        return false
      }
      return entry.score >= dynamicThreshold
    })
    .slice(0, targetSize)

  if (shortlist.length === 0) {
    const fallbackSize = Math.min(3, scored.length)
    return {
      shortlist: scored.slice(0, fallbackSize),
      fallbackToQualifiedHighlightPool: true,
    }
  }

  return {
    shortlist,
    fallbackToQualifiedHighlightPool: false,
  }
}

function buildTasteCurationDebugForArc(params: {
  selectedArc: ArcCandidate
  qualificationByCandidateId: Record<string, TasteCandidateQualification>
  personaVibeTasteBiasSummary: string
  thinPoolHighlightFallbackApplied: boolean
  highlightPoolCountBefore: number
  highlightPoolCountAfter: number
  rolePoolCountByRoleBefore: Record<CoreTasteRole, number>
  rolePoolCountByRoleAfter: Record<CoreTasteRole, number>
  signatureHighlightShortlistCount: number
  signatureHighlightShortlistIds: string[]
  highlightShortlistScoreSummary: string
  selectedHighlightFromShortlist: boolean
  selectedHighlightShortlistRank: number | null
  fallbackToQualifiedHighlightPool: boolean
  upstreamPoolSelectionApplied: boolean
  postGenerationRepairCount: number
  rolePoolVenueIdsByRole: Record<CoreTasteRole, string[]>
  rolePoolVenueIdsCombined: string[]
  thinPoolRelaxationTrace: StrongCurationTastePassResult['thinPoolRelaxationTrace']
}): TasteCurationDebug {
  const {
    selectedArc,
    qualificationByCandidateId,
    personaVibeTasteBiasSummary,
    thinPoolHighlightFallbackApplied,
    highlightPoolCountBefore,
    highlightPoolCountAfter,
    rolePoolCountByRoleBefore,
    rolePoolCountByRoleAfter,
    signatureHighlightShortlistCount,
    signatureHighlightShortlistIds,
    highlightShortlistScoreSummary,
    selectedHighlightFromShortlist,
    selectedHighlightShortlistRank,
    fallbackToQualifiedHighlightPool,
    upstreamPoolSelectionApplied,
    postGenerationRepairCount,
    rolePoolVenueIdsByRole,
    rolePoolVenueIdsCombined,
    thinPoolRelaxationTrace,
  } = params

  const getRoleSummary = (role: CoreTasteRole): string => {
    const internalRole = role === 'start' ? 'warmup' : role === 'highlight' ? 'peak' : 'cooldown'
    const selectedStop = selectedArc.stops.find((stop) => stop.role === internalRole)?.scoredVenue
    if (!selectedStop) {
      return 'n/a'
    }
    const qualification = getCandidateQualificationForVenue(qualificationByCandidateId, selectedStop)
    if (!qualification) {
      return 'n/a'
    }
    const eligibility = qualification.roleEligibility[role]
    return `${eligibility.passed ? 'pass' : 'fail'} ${formatTasteScore(eligibility.score)}/${formatTasteScore(
      eligibility.floor,
    )} (${eligibility.reason})`
  }

  const highlightStop = selectedArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue
  const highlightQualification = highlightStop
    ? getCandidateQualificationForVenue(qualificationByCandidateId, highlightStop)
    : undefined

  return {
    highlightQualificationScore: highlightQualification?.highlightQualificationScore ?? null,
    highlightQualificationPassed: highlightQualification?.highlightQualificationPassed ?? null,
    tasteRoleEligibilityByRole: {
      start: getRoleSummary('start'),
      highlight: getRoleSummary('highlight'),
      windDown: getRoleSummary('windDown'),
    },
    personaVibeTasteBiasSummary,
    venuePersonalitySummary: highlightQualification?.venuePersonality.summary ?? 'n/a',
    thinPoolHighlightFallbackApplied,
    highlightPoolCountBefore,
    highlightPoolCountAfter,
    rolePoolCountByRoleBefore,
    rolePoolCountByRoleAfter,
    signatureHighlightShortlistCount,
    signatureHighlightShortlistIds,
    highlightShortlistScoreSummary,
    selectedHighlightFromShortlist,
    selectedHighlightShortlistRank,
    fallbackToQualifiedHighlightPool,
    upstreamPoolSelectionApplied,
    postGenerationRepairCount,
    rolePoolVenueIdsByRole,
    rolePoolVenueIdsCombined,
    thinPoolRelaxationTrace,
  }
}

function applyStrongCurationTastePass(params: {
  selectedArc: ArcCandidate
  itinerary: Itinerary
  scoredVenues: ScoredVenue[]
  intentProfile: IntentProfile
  lens: ExperienceLens
  contractConstraints?: ContractConstraints
}): StrongCurationTastePassResult {
  const { selectedArc, itinerary, scoredVenues, intentProfile, lens, contractConstraints } = params
  const persona = intentProfile.persona ?? 'friends'
  const vibe = intentProfile.primaryAnchor
  const baseBias = getStrongCurationTasteBias(persona, vibe, contractConstraints)
  const rolePoolCountByRoleBefore = getCoreRolePoolCounts(scoredVenues)
  const provisionalQualification = buildCandidateQualificationMap({
    scoredVenues,
    persona,
    vibe,
    floors: baseBias,
    contractConstraints,
  })
  const baseQualifiedHighlightCount = scoredVenues.filter((candidate) => {
    const qualification = getCandidateQualificationForVenue(provisionalQualification, candidate)
    return Boolean(
      qualification?.highlightQualificationPassed && qualification.roleEligibility.highlight.passed,
    )
  }).length
  const thinPoolHighlightFallbackApplied = baseQualifiedHighlightCount < 2
  const effectiveBias: StrongCurationTasteBias = thinPoolHighlightFallbackApplied
    ? {
        ...baseBias,
        highlightFloor: Math.max(0.5, baseBias.highlightFloor - 0.08),
        summary: `${baseBias.summary} | thin-pool highlight relaxation`,
      }
    : baseBias
  const thinPoolRelaxationTrace: StrongCurationTastePassResult['thinPoolRelaxationTrace'] = {
    triggered: thinPoolHighlightFallbackApplied,
    baseQualifiedHighlightCount,
    baseHighlightFloor: Number(baseBias.highlightFloor.toFixed(3)),
    relaxedHighlightFloor: Number(effectiveBias.highlightFloor.toFixed(3)),
    triggerReason:
      baseQualifiedHighlightCount < 2
        ? 'base_qualified_highlight_count_below_threshold'
        : 'highlight_pool_sufficient',
    relaxedRule: 'highlight_floor_softened_for_thin_supply',
    effectSummary: `${Number(baseBias.highlightFloor.toFixed(3))} -> ${Number(
      effectiveBias.highlightFloor.toFixed(3),
    )} | qualified:${baseQualifiedHighlightCount}`,
  }

  const finalQualification = buildCandidateQualificationMap({
    scoredVenues,
    persona,
    vibe,
    floors: effectiveBias,
    contractConstraints,
  })

  const baseCandidates = scoredVenues.filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
  const roleCandidateWeight = (role: CoreTasteRole, candidate: ScoredVenue): number => {
    const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
    if (!qualification) {
      return 0
    }
    if (role === 'highlight') {
      return (
        qualification.highlightQualificationScore * 0.64 +
        scoreAnchoredRoleFit(candidate, 'peak') * 0.36 +
        (qualification.venuePersonality.destination ? 0.04 : 0) +
        (qualification.venuePersonality.experiential ? 0.03 : 0)
      )
    }
    if (role === 'start') {
      return (
        qualification.roleEligibility.start.score * 0.48 +
        scoreAnchoredRoleFit(candidate, 'warmup') * 0.52 +
        (qualification.venuePersonality.lowFriction ? 0.04 : 0)
      )
    }
    return (
      qualification.roleEligibility.windDown.score * 0.46 +
      scoreAnchoredRoleFit(candidate, 'cooldown') * 0.54 +
      (qualification.venuePersonality.calm ? 0.04 : 0) +
      (qualification.venuePersonality.lingering ? 0.03 : 0)
    )
  }
  const sortByRoleWeight = (role: CoreTasteRole) => (left: ScoredVenue, right: ScoredVenue) =>
    roleCandidateWeight(role, right) - roleCandidateWeight(role, left) ||
    left.venue.name.localeCompare(right.venue.name)

  const strictHighlightPool = baseCandidates
    .filter((candidate) => {
      const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
      if (!qualification) {
        return false
      }
      return isStrictHighlightPoolCandidate({
        candidate,
        qualification,
        persona,
        vibe,
        thinPoolHighlightFallbackApplied,
        contractConstraints,
      })
    })
    .sort(sortByRoleWeight('highlight'))
  const relaxedHighlightPool = baseCandidates
    .filter((candidate) => {
      const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
      return Boolean(
        qualification?.highlightQualificationPassed &&
          qualification.roleEligibility.highlight.passed,
      )
    })
    .sort(sortByRoleWeight('highlight'))

  const strictStartPool = baseCandidates
    .filter((candidate) => {
      const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
      if (!qualification) {
        return false
      }
      return isStrictStartPoolCandidate({
        candidate,
        qualification,
        persona,
        vibe,
        contractConstraints,
      })
    })
    .sort(sortByRoleWeight('start'))
  const relaxedStartPool = baseCandidates
    .filter((candidate) => {
      const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
      return Boolean(qualification?.roleEligibility.start.passed)
    })
    .sort(sortByRoleWeight('start'))

  const strictWindDownPool = baseCandidates
    .filter((candidate) => {
      const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
      if (!qualification) {
        return false
      }
      return isStrictWindDownPoolCandidate({
        candidate,
        qualification,
        persona,
        vibe,
        contractConstraints,
      })
    })
    .sort(sortByRoleWeight('windDown'))
  const relaxedWindDownPool = baseCandidates
    .filter((candidate) => {
      const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
      return Boolean(qualification?.roleEligibility.windDown.passed)
    })
    .sort(sortByRoleWeight('windDown'))

  const dedupePool = (pool: ScoredVenue[]): ScoredVenue[] => {
    const byVenueId = new Map<string, ScoredVenue>()
    for (const candidate of pool) {
      if (!byVenueId.has(candidate.venue.id)) {
        byVenueId.set(candidate.venue.id, candidate)
      }
    }
    return [...byVenueId.values()]
  }

  const highlightPool = dedupePool(
    strictHighlightPool.length > 0
      ? strictHighlightPool
      : relaxedHighlightPool.slice(0, Math.max(3, relaxedHighlightPool.length)),
  )
  const startPool = dedupePool(
    strictStartPool.length > 0 ? strictStartPool : relaxedStartPool.slice(0, Math.max(4, relaxedStartPool.length)),
  )
  const windDownPool = dedupePool(
    strictWindDownPool.length > 0
      ? strictWindDownPool
      : relaxedWindDownPool.slice(0, Math.max(4, relaxedWindDownPool.length)),
  )
  const rolePoolCountByRoleAfter: Record<CoreTasteRole, number> = {
    start: startPool.length,
    highlight: highlightPool.length,
    windDown: windDownPool.length,
  }
  const shortlistBuild = buildSignatureHighlightShortlist({
    highlightPool,
    qualifiedHighlightPool: relaxedHighlightPool,
    qualificationByCandidateId: finalQualification,
    persona,
    vibe,
    thinPoolHighlightFallbackApplied,
    contractConstraints,
  })
  const signatureHighlightShortlist = shortlistBuild.shortlist
  const signatureHighlightShortlistPool = signatureHighlightShortlist.map((entry) => entry.candidate)
  const signatureHighlightShortlistIds = signatureHighlightShortlistPool.map(
    (candidate) => candidate.venue.id,
  )
  const highlightShortlistScoreSummary =
    signatureHighlightShortlist.length > 0
      ? signatureHighlightShortlist
          .slice(0, 5)
          .map((entry) => `${entry.candidate.venue.id}:${formatTasteScore(entry.score)}`)
          .join(' | ')
      : 'n/a'
  const highlightPreferredPool =
    signatureHighlightShortlistPool.length > 0 ? signatureHighlightShortlistPool : highlightPool
  let fallbackToQualifiedHighlightPool = shortlistBuild.fallbackToQualifiedHighlightPool
  let highlightMembershipSet = new Set(highlightPreferredPool.map((candidate) => candidate.venue.id))
  const rolePoolMembershipByRole: Record<CoreTasteRole, Set<string>> = {
    start: new Set(startPool.map((candidate) => candidate.venue.id)),
    highlight: highlightMembershipSet,
    windDown: new Set(windDownPool.map((candidate) => candidate.venue.id)),
  }
  const adjustedScoredVenues = scoredVenues.map((candidate) =>
    applyStrongCurationRoleScoreShaping({
      candidate,
      qualification: getCandidateQualificationForVenue(finalQualification, candidate),
      rolePoolMembershipByRole,
    }),
  )

  const crewPolicy = getCrewPolicy(intentProfile.crew)
  let nextArc = selectedArc
  let nextItinerary = itinerary
  let upstreamPoolSelectionApplied = false
  let postGenerationRepairCount = 0

  const applyRoleFromCustomPool = (
    role: CoreTasteRole,
    pool: ScoredVenue[],
    sharpenWhenPossible: boolean,
  ): boolean => {
    const internalRole = inverseRoleProjection[role]
    const currentStop = nextArc.stops.find((stop) => stop.role === internalRole)?.scoredVenue
    if (!currentStop) {
      return false
    }
    if (pool.length === 0) {
      return false
    }
    const currentScore = roleCandidateWeight(role, currentStop)
    const bestScore = roleCandidateWeight(role, pool[0])
    const currentInPool = rolePoolMembershipByRole[role].has(currentStop.venue.id)
    const shouldTry =
      !currentInPool ||
      (sharpenWhenPossible && bestScore >= currentScore + 0.08) ||
      (!sharpenWhenPossible && bestScore >= currentScore + 0.12)
    if (!shouldTry) {
      return false
    }

    for (const replacement of pool) {
      if (replacement.venue.id === currentStop.venue.id) {
        continue
      }
      const swappedArc = swapArcStop({
        currentArc: nextArc,
        role: internalRole,
        replacement,
        intent: intentProfile,
        crewPolicy,
        lens,
      })
      if (!swappedArc) {
        continue
      }
      const swappedItinerary = projectItinerary(swappedArc, intentProfile, lens)
      const swappedRoleStop = swappedItinerary.stops.find((stop) => stop.role === role)
      if (!swappedRoleStop || swappedRoleStop.venueId !== replacement.venue.id) {
        continue
      }
      if (role !== 'highlight' && highlightMembershipSet.size > 0) {
        const highlightStop = swappedArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue
        if (!highlightStop || !highlightMembershipSet.has(highlightStop.venue.id)) {
          continue
        }
      }
      nextArc = swappedArc
      nextItinerary = swappedItinerary
      upstreamPoolSelectionApplied = true
      return true
    }
    return false
  }

  const highlightSelectedFromPreferredPool = applyRoleFromCustomPool('highlight', highlightPreferredPool, true)
  const selectedHighlightAfterPreferred =
    nextArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue?.venue.id
  if (
    signatureHighlightShortlistPool.length > 0 &&
    (!selectedHighlightAfterPreferred || !highlightMembershipSet.has(selectedHighlightAfterPreferred))
  ) {
    const qualifiedFallbackPool = highlightPool.length > 0 ? highlightPool : relaxedHighlightPool
    if (qualifiedFallbackPool.length > 0) {
      fallbackToQualifiedHighlightPool = true
      highlightMembershipSet = new Set(qualifiedFallbackPool.map((candidate) => candidate.venue.id))
      rolePoolMembershipByRole.highlight = highlightMembershipSet
      const fallbackApplied = applyRoleFromCustomPool('highlight', qualifiedFallbackPool, true)
      if (fallbackApplied && !highlightSelectedFromPreferredPool) {
        upstreamPoolSelectionApplied = true
      }
    }
  }

  applyRoleFromCustomPool('start', startPool, false)
  applyRoleFromCustomPool('windDown', windDownPool, false)

  const maybeRepairRole = (role: CoreTasteRole): void => {
    const internalRole = inverseRoleProjection[role]
    const currentStop = nextArc.stops.find((stop) => stop.role === internalRole)?.scoredVenue
    if (!currentStop) {
      return
    }
    const currentQualification = getCandidateQualificationForVenue(finalQualification, currentStop)
    const currentPass =
      role === 'highlight'
        ? Boolean(
            currentQualification?.highlightQualificationPassed &&
              currentQualification.roleEligibility.highlight.passed,
          )
        : Boolean(currentQualification?.roleEligibility[role].passed)
    if (currentPass) {
      return
    }

    const roleScoreKey = roleToInternalRole[role]
    const highlightRepairPool =
      signatureHighlightShortlistPool.length > 0 && !fallbackToQualifiedHighlightPool
        ? signatureHighlightShortlistPool
        : highlightPool
    const replacements = (role === 'highlight' ? highlightRepairPool : adjustedScoredVenues)
      .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
      .filter((candidate) => candidate.venue.id !== currentStop.venue.id)
      .filter((candidate) => {
        if (role === 'highlight') {
          return highlightMembershipSet.has(candidate.venue.id)
        }
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate)
        return Boolean(qualification?.roleEligibility[role].passed)
      })
      .sort((left, right) => {
        const leftQualification = getCandidateQualificationForVenue(finalQualification, left)
        const rightQualification = getCandidateQualificationForVenue(finalQualification, right)
        const leftRoleWeight =
          role === 'highlight'
            ? (leftQualification?.highlightQualificationScore ?? 0) * 0.55 +
              scoreAnchoredRoleFit(left, roleScoreKey) * 0.45
            : (leftQualification?.roleEligibility[role].score ?? 0) * 0.4 +
              scoreAnchoredRoleFit(left, roleScoreKey) * 0.6
        const rightRoleWeight =
          role === 'highlight'
            ? (rightQualification?.highlightQualificationScore ?? 0) * 0.55 +
              scoreAnchoredRoleFit(right, roleScoreKey) * 0.45
            : (rightQualification?.roleEligibility[role].score ?? 0) * 0.4 +
              scoreAnchoredRoleFit(right, roleScoreKey) * 0.6
        return rightRoleWeight - leftRoleWeight || left.venue.name.localeCompare(right.venue.name)
      })

    for (const replacement of replacements) {
      const swappedArc = swapArcStop({
        currentArc: nextArc,
        role: internalRole,
        replacement,
        intent: intentProfile,
        crewPolicy,
        lens,
      })
      if (!swappedArc) {
        continue
      }
      const swappedItinerary = projectItinerary(swappedArc, intentProfile, lens)
      const swappedRoleStop = swappedItinerary.stops.find((stop) => stop.role === role)
      if (!swappedRoleStop || swappedRoleStop.venueId !== replacement.venue.id) {
        continue
      }
      if (role !== 'highlight') {
        const highlightStop = swappedArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue
        if (!highlightStop || !highlightMembershipSet.has(highlightStop.venue.id)) {
          continue
        }
      }
      nextArc = swappedArc
      nextItinerary = swappedItinerary
      postGenerationRepairCount += 1
      break
    }
  }

  maybeRepairRole('highlight')
  maybeRepairRole('start')
  maybeRepairRole('windDown')

  const selectedHighlightVenueId =
    nextArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue?.venue.id ?? null
  const shortlistRankByVenueId = new Map(
    signatureHighlightShortlistPool.map((candidate, index) => [candidate.venue.id, index + 1] as const),
  )
  const selectedHighlightFromShortlist = Boolean(
    selectedHighlightVenueId && shortlistRankByVenueId.has(selectedHighlightVenueId),
  )
  const selectedHighlightShortlistRank = selectedHighlightVenueId
    ? shortlistRankByVenueId.get(selectedHighlightVenueId) ?? null
    : null
  const rolePoolVenueIdsByRole: Record<CoreTasteRole, string[]> = {
    start: [...rolePoolMembershipByRole.start],
    highlight: [...rolePoolMembershipByRole.highlight],
    windDown: [...rolePoolMembershipByRole.windDown],
  }
  const rolePoolVenueIdsCombined = dedupeStringIds([
    ...rolePoolVenueIdsByRole.start,
    ...rolePoolVenueIdsByRole.highlight,
    ...rolePoolVenueIdsByRole.windDown,
  ])

  return {
    selectedArc: nextArc,
    itinerary: nextItinerary,
    scoredVenues: adjustedScoredVenues,
    qualificationByCandidateId: finalQualification,
    personaVibeTasteBiasSummary: effectiveBias.summary,
    thinPoolHighlightFallbackApplied,
    highlightPoolCountBefore: rolePoolCountByRoleBefore.highlight,
    highlightPoolCountAfter: rolePoolCountByRoleAfter.highlight,
    rolePoolCountByRoleBefore,
    rolePoolCountByRoleAfter,
    signatureHighlightShortlistCount: signatureHighlightShortlist.length,
    signatureHighlightShortlistIds,
    highlightShortlistScoreSummary,
    selectedHighlightFromShortlist,
    selectedHighlightShortlistRank,
    fallbackToQualifiedHighlightPool,
    upstreamPoolSelectionApplied,
    postGenerationRepairCount,
    rolePoolVenueIdsByRole,
    rolePoolVenueIdsCombined,
    thinPoolRelaxationTrace,
  }
}

function assessDirectionContractBuildability(params: {
  expectedDirectionIdentity: DirectionIdentityMode
  scoredVenues: ScoredVenue[]
}): DirectionContractBuildability {
  return assessDirectionContractBuildabilityEngine(params)
}

function validateDirectionRouteContract(params: {
  selectedDirectionContext?: ResolvedDirectionContext
  selectedDirection?: Pick<DirectionPlanningSelection, 'identity'>
  itinerary: Itinerary
  buildability: DirectionContractBuildability
}): DirectionContractValidationResult {
  return validateDirectionRouteContractEngine(params)
}

function normalizeSwapToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function formatRoleInvariantSummary(profile: RoleInvariantProfile | undefined): string {
  if (!profile) {
    return 'n/a'
  }
  const required = profile.requiredTraits.join('+') || 'none'
  const forbidden = profile.forbiddenTraits.join('+') || 'none'
  const minIntensity = profile.minRelativeIntensity ?? 'none'
  const maxIntensity = profile.maxRelativeIntensity ?? 'none'
  return `req:${required} | forbid:${forbidden} | min:${minIntensity} | max:${maxIntensity} | weak:${String(
    profile.allowSwapToWeaker,
  )} | esc:${String(profile.allowEscalation)}`
}

function evaluateHardStructuralSwapCompatibility(
  params: HardStructuralSwapCompatibilityInput,
): HardStructuralSwapCompatibilityEvaluation {
  return evaluateHardStructuralSwapCompatibilityEngine(params)
}

function evaluateSwapCompatibility(params: {
  role: UserStopRole
  swapSnapshot: PreviewSwapState
  canonicalItinerary: Itinerary
  planSnapshot: DemoPlanState
  finalRouteSnapshot: FinalRoute
  routeShapeContract: RouteShapeContract
}): SwapCompatibilityResult {
  const {
    role,
    swapSnapshot,
    canonicalItinerary,
    planSnapshot,
    finalRouteSnapshot,
    routeShapeContract,
  } = params
  const preservePriority = new Set(routeShapeContract.mutationProfile.preservePriority)
  const targetSlot = finalRouteSnapshot.stops.find((stop) => stop.stopIndex === swapSnapshot.targetStopIndex)
  const hardStructural = evaluateHardStructuralSwapCompatibility({
    role,
    targetRole: swapSnapshot.targetRole,
    targetStopIndex: swapSnapshot.targetStopIndex,
    hasTargetSlotAtIndex: Boolean(targetSlot),
    targetSlotRoleAtIndex: targetSlot?.role,
    requestedReplacementId: swapSnapshot.requestedReplacementId,
    candidateStop: swapSnapshot.candidateStop,
    originalStop: swapSnapshot.originalStop,
    canonicalItinerary,
    baselineItinerary: planSnapshot.itinerary,
    routeShapeContract,
    requireReplacementCanonicalProvider: true,
    replacementCanonicalProviderId: swapSnapshot.replacementCanonical.providerRecordId,
  })
  if (!hardStructural.passed) {
    return {
      swapCompatibilityPassed: false,
      swapCompatibilityReason: hardStructural.reason,
      swapCompatibilityRejectClass: 'hard_structural',
      preservedRole: hardStructural.preservedRole,
      preservedDistrict: false,
      preservedFamily: false,
      preservedFeasibility: hardStructural.preservedFeasibility,
      softDirectionDriftDetected: false,
    }
  }
  const { preservedRole, preservedFeasibility, transitionsWithinShape, preferredRoleTraitMissing } =
    hardStructural
  const preferredRoleTraitDrift = preferredRoleTraitMissing.length > 0
  const targetSlotForSoft = targetSlot ?? finalRouteSnapshot.stops.find(
    (stop) => stop.stopIndex === swapSnapshot.targetStopIndex,
  )
  if (!targetSlotForSoft) {
    return {
      swapCompatibilityPassed: false,
      swapCompatibilityReason: 'Hard reject: target slot index is no longer present on canonical route.',
      swapCompatibilityRejectClass: 'hard_structural',
      preservedRole,
      preservedDistrict: false,
      preservedFamily: false,
      preservedFeasibility,
      softDirectionDriftDetected: false,
    }
  }

  const districtBefore = normalizeSwapToken(targetSlotForSoft.neighborhood)
  const districtAfter = normalizeSwapToken(
    swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood,
  )
  const continuityMode = routeShapeContract.movementProfile.neighborhoodContinuity
  const preservedDistrict =
    !districtBefore ||
    !districtAfter ||
    districtBefore === districtAfter ||
    continuityMode === 'flexible'
  const selectedFamily = planSnapshot.selectedDirectionContract.experienceFamily
  const selectedFamilyConfidence = planSnapshot.selectedDirectionContract.familyConfidence ?? 0
  const expectedMode =
    selectedFamily && selectedFamilyConfidence >= FAMILY_STORY_CONFIDENCE_MIN
      ? mapFamilyModeToNightPreviewMode(selectedFamily)
      : undefined
  const actualMode = getNightPreviewMode(planSnapshot.selectedCluster, canonicalItinerary)
  const preservedFamily = !expectedMode || expectedMode === actualMode
  const roleShape =
    role === 'start' || role === 'highlight' || role === 'windDown'
      ? routeShapeContract.roleProfile[role]
      : undefined
  const softDirectionDriftDetected =
    (preservePriority.has('district') && !preservedDistrict) ||
    (preservePriority.has('family') && !preservedFamily) ||
    (preservePriority.has('movement') && !transitionsWithinShape) ||
    preferredRoleTraitDrift

  const driftSignals: string[] = []
  if (!preservedDistrict) {
    driftSignals.push('district')
  }
  if (!preservedFamily) {
    driftSignals.push('family')
  }
  if (!transitionsWithinShape) {
    driftSignals.push('movement')
  }
  if (preferredRoleTraitDrift) {
    driftSignals.push(`role_traits:${preferredRoleTraitMissing.join('+')}`)
  }

  if (softDirectionDriftDetected) {
    return {
      swapCompatibilityPassed: true,
      swapCompatibilityReason: `Passed swap compatibility with soft drift (${driftSignals.join(', ') || 'none'}); allowed by ${routeShapeContract.mutationProfile.swapFlexibility} swap flexibility.`,
      swapCompatibilityRejectClass: 'soft_direction_drift',
      preservedRole,
      preservedDistrict,
      preservedFamily,
      preservedFeasibility,
      softDirectionDriftDetected,
    }
  }

  return {
    swapCompatibilityPassed: true,
    swapCompatibilityReason: `Passed structural compatibility with route shape preserved (role variability ${roleShape?.variability ?? 'n/a'}).`,
    swapCompatibilityRejectClass: 'none',
    preservedRole,
    preservedDistrict,
    preservedFamily,
    preservedFeasibility,
    softDirectionDriftDetected: false,
  }
}

function getCoreStop(
  itinerary: Itinerary,
  role: UserStopRole,
): ItineraryStop | undefined {
  return itinerary.stops.find((stop) => stop.role === role)
}

function getRouteArcType(itinerary: Itinerary): 'full' | 'partial' | 'highlightOnly' {
  const hasStart = itinerary.stops.some((stop) => stop.role === 'start')
  const hasHighlight = itinerary.stops.some((stop) => stop.role === 'highlight')
  const hasWindDown = itinerary.stops.some((stop) => stop.role === 'windDown')
  if (hasHighlight && hasStart && hasWindDown) {
    return 'full'
  }
  if (hasHighlight && (hasStart || hasWindDown)) {
    return 'partial'
  }
  return 'highlightOnly'
}

function getHighlightIntensityFromArc(arc: ArcCandidate): number | undefined {
  return arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue.taste.signals.momentIntensity.score
}

function getBearingsSignal(itinerary: Itinerary): string {
  const transitions = itinerary.transitions
  if (transitions.length === 0) {
    return 'Everything stays within a short drive.'
  }

  const maxTravel = Math.max(
    ...transitions.map((transition) => transition.estimatedTravelMinutes),
  )
  if (maxTravel <= 12) {
    return 'Everything stays within a short drive.'
  }
  return 'This route avoids long travel gaps.'
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function computeDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadiusKm = 6371
  const deltaLatitude = toRadians(to.latitude - from.latitude)
  const deltaLongitude = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const haversine =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2)
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return earthRadiusKm * centralAngle
}

function getAnchoredBearingsSignal(
  itinerary: Itinerary,
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>>,
): string {
  const ordered = itinerary.stops
    .map((stop) => canonicalStopByRole[stop.role])
    .filter((item): item is CanonicalPlanningStopIdentity => Boolean(item))
  if (ordered.length < 2) {
    return getBearingsSignal(itinerary)
  }

  const segmentDistancesKm: number[] = []
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const from = ordered[index]
    const to = ordered[index + 1]
    if (!from || !to) {
      continue
    }
    segmentDistancesKm.push(
      computeDistanceKm(
        { latitude: from.latitude, longitude: from.longitude },
        { latitude: to.latitude, longitude: to.longitude },
      ),
    )
  }
  if (segmentDistancesKm.length === 0) {
    return getBearingsSignal(itinerary)
  }
  const maxSegmentDistanceKm = Math.max(...segmentDistancesKm)
  if (maxSegmentDistanceKm <= 3.6) {
    return 'Everything stays within a short drive.'
  }
  return 'This route avoids long travel gaps.'
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getDirectionToneTag(archetype: DirectionCandidate['archetype']): string {
  if (archetype === 'lively') {
    return 'Active'
  }
  if (archetype === 'cultural') {
    return 'Curated'
  }
  if (archetype === 'chill') {
    return 'Calm'
  }
  return 'Social'
}

function hasFlowSeed(value: string): boolean {
  const normalized = value.toLowerCase()
  return normalized.includes('->') || normalized.includes('\u2192') || normalized.includes(' then ')
}

function getDirectionWhyNow(candidate: DirectionCandidate): string {
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile
  const hasFlow = candidate.derivedFrom.momentSeeds.some((seed) => hasFlowSeed(seed))
  const activityMomentum = mix.activity + mix.drinks
  const comfortSignal = mix.dining + mix.cafe

  if (candidate.cluster === 'lively' || activityMomentum >= 0.5) {
    if (ambiance.energy === 'high' || hasFlow) {
      return 'This is where the night already has momentum.'
    }
    return 'Best when you want the night to build fast.'
  }

  if (candidate.cluster === 'chill' || comfortSignal >= 0.42) {
    if (ambiance.noise === 'low' || ambiance.energy === 'low') {
      return 'Softer, easier start without losing the night.'
    }
    return 'More neighborhood feel than main-strip energy.'
  }

  if (candidate.cluster === 'explore' || candidate.archetype === 'cultural' || mix.culture >= 0.18) {
    if (hasFlow || candidate.derivedFrom.momentPotential >= 0.7) {
      return 'More focused, intentional, and easy to commit to.'
    }
    return 'Better if you want the night to feel curated, not crowded.'
  }

  return 'A steadier option that keeps the night easy to follow.'
}

function getDirectionWhyYou(
  candidate: DirectionCandidate,
  persona: PersonaMode,
  vibe: VibeAnchor,
): string {
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile
  const highMomentum = mix.activity + mix.drinks >= 0.5 || ambiance.energy === 'high'
  const calmSignal = ambiance.energy === 'low' || ambiance.noise === 'low'
  const curatedSignal = mix.culture >= 0.2 || candidate.cluster === 'explore'

  if (vibe === 'lively') {
    if (candidate.cluster === 'lively' || highMomentum) {
      return 'Stronger social flow, fewer dead spots.'
    }
    if (candidate.cluster === 'explore' || curatedSignal) {
      return 'More focus, less wandering.'
    }
    return 'Easier pacing with fewer sharp transitions.'
  }

  if (vibe === 'cozy') {
    if (candidate.cluster === 'chill' || calmSignal) {
      return 'Less movement, more intimacy.'
    }
    if (candidate.cluster === 'explore' || curatedSignal) {
      return 'More focus, less noise.'
    }
    return 'More energy, less lingering.'
  }

  if (vibe === 'cultured') {
    if (candidate.cluster === 'explore' || curatedSignal) {
      return 'More focus, less noise.'
    }
    if (candidate.cluster === 'lively' || highMomentum) {
      return 'More energy, less wandering.'
    }
    return 'Easier pacing with fewer sharp transitions.'
  }

  if (persona === 'romantic') {
    return candidate.cluster === 'chill'
      ? 'Less movement, more intimacy.'
      : 'More energy, less wandering.'
  }
  if (persona === 'friends') {
    return candidate.cluster === 'lively'
      ? 'Stronger social flow, fewer dead spots.'
      : 'More focus, less noise.'
  }
  return candidate.cluster === 'chill'
    ? 'Easier pacing with fewer sharp transitions.'
    : 'More focus, less noise.'
}

function toProofToken(value: string): string {
  return value
    .replace(/\s*->\s*/g, ' | ')
    .replace(/\s*\u2192\s*/g, ' | ')
    .replace(/\s+pocket$/i, '')
    .trim()
}

function toSeedProofToken(seed: string): string | undefined {
  const normalized = seed.toLowerCase()
  if (normalized.includes('gallery')) {
    return 'Gallery stroll'
  }
  if (normalized.includes('coffee') || normalized.includes('cafe')) {
    return 'Coffee start'
  }
  if (normalized.includes('wine')) {
    return 'Wine bar'
  }
  if (normalized.includes('cocktail') || normalized.includes('bar')) {
    return 'Cocktail lane'
  }
  if (normalized.includes('dinner')) {
    return 'Dinner anchor'
  }
  if (normalized.includes('walk') || normalized.includes('stroll')) {
    return 'Walkable strip'
  }
  if (normalized.includes('late') || normalized.includes('night')) {
    return 'Late-night cluster'
  }
  if (normalized.includes('detour') || normalized.includes('playful')) {
    return 'Playful detour'
  }
  return undefined
}

function getMixProofToken(candidate: DirectionCandidate): string {
  const mix = candidate.derivedFrom.hospitalityMix
  if (mix.drinks >= 0.24) {
    return 'Wine bar pocket'
  }
  if (mix.activity >= 0.3) {
    return 'Late-night cluster'
  }
  if (mix.culture >= 0.2) {
    return 'Gallery pocket'
  }
  if (mix.cafe >= 0.2) {
    return 'Cafe pocket'
  }
  if (mix.dining >= 0.24) {
    return 'Dinner pocket'
  }
  return 'Neighborhood pocket'
}

function getDirectionProofLine(candidate: DirectionCandidate, selected: boolean): string {
  if (selected && candidate.nearbyExamples.length > 0) {
    return candidate.nearbyExamples.slice(0, 2).join(' Â· ')
  }

  const seedTokens = candidate.derivedFrom.momentSeeds
    .map((seed) => toSeedProofToken(seed))
    .filter((seed): seed is string => Boolean(seed))
  const mixToken = getMixProofToken(candidate)

  if (!selected) {
    const compact = Array.from(new Set([mixToken, ...seedTokens])).slice(0, 2)
    return compact.join(' Â· ')
  }

  const highlightTokens = candidate.highlights
    .map((value) => toProofToken(value))
    .filter((value) => value.length > 0)
  if (highlightTokens.length > 0) {
    return highlightTokens.slice(0, 2).join(' Â· ')
  }

  return toProofToken(candidate.pocketLabel)
}

const FAMILY_STORY_CONFIDENCE_MIN = 0.58
const NIGHT_PREVIEW_HIGHLIGHT_DOMINANCE_THRESHOLD = 0.72

function getStoryFamilyMode(
  candidate: DirectionCandidate,
): DirectionCandidate['experienceFamily'] | 'neutral' {
  return candidate.familyConfidence >= FAMILY_STORY_CONFIDENCE_MIN
    ? candidate.experienceFamily
    : 'neutral'
}

function getStorySpineStartLine(
  candidate: DirectionCandidate,
  vibe: VibeAnchor,
): string {
  const familyMode = getStoryFamilyMode(candidate)
  const ambiance = candidate.derivedFrom.ambianceProfile
  const mix = candidate.derivedFrom.hospitalityMix

  if (familyMode === 'ambient') {
    return 'Calmer entry that unfolds slowly into the area.'
  }
  if (familyMode === 'ritual') {
    return 'Step into a structured opening with clear pacing.'
  }
  if (familyMode === 'indulgent') {
    return 'Slower opening that settles around richer stops.'
  }
  if (familyMode === 'eventful') {
    return 'Quick start that builds toward punctuated peaks.'
  }
  if (familyMode === 'social') {
    return 'Warm social entry with early momentum.'
  }
  if (familyMode === 'cultural') {
    return 'Intentional opening that sets a focused route.'
  }
  if (familyMode === 'playful' || familyMode === 'exploratory') {
    return 'Curious opener with room for a small detour.'
  }
  if (vibe === 'cozy' || ambiance.noise === 'low') {
    return 'Low-friction start with calmer movement.'
  }
  if (mix.activity + mix.drinks >= 0.52 || vibe === 'lively') {
    return 'Fast opening that gets momentum going early.'
  }
  return 'Balanced opening that keeps pacing easy.'
}

function getStorySpineHighlightLine(candidate: DirectionCandidate): string {
  const familyMode = getStoryFamilyMode(candidate)
  const mix = candidate.derivedFrom.hospitalityMix
  const momentPotential = candidate.derivedFrom.momentPotential

  if (familyMode === 'eventful') {
    return 'Middle stretch peaks through bursty high-energy moments.'
  }
  if (familyMode === 'cultural') {
    return 'Centerpoint stays focused around culture-forward anchors.'
  }
  if (familyMode === 'ritual') {
    return 'Middle beat lands as a clean, stepwise centerpiece.'
  }
  if (familyMode === 'indulgent') {
    return 'Central moment centers on a deeper destination stop.'
  }
  if (familyMode === 'ambient' || familyMode === 'intimate') {
    return 'Center beat stays warm and contained, not chaotic.'
  }
  if (familyMode === 'social') {
    return 'Middle section carries a stronger social peak.'
  }
  if (familyMode === 'playful') {
    return 'Middle section leans into activity-forward switch-ups.'
  }
  if (familyMode === 'exploratory') {
    return 'Middle stretch layers varied signals into one focal moment.'
  }
  if (momentPotential >= 0.7 || mix.activity + mix.drinks >= 0.5) {
    return 'Middle stretch becomes the strongest momentum point.'
  }
  return 'Middle beat stays steady as the route center.'
}

function getStorySpineWindDownLine(candidate: DirectionCandidate): string {
  const familyMode = getStoryFamilyMode(candidate)
  const ambiance = candidate.derivedFrom.ambianceProfile

  if (familyMode === 'eventful' || familyMode === 'social') {
    return 'Finish tapers from peak energy into a cleaner close.'
  }
  if (familyMode === 'ritual') {
    return 'Finish lands predictably with minimal transition friction.'
  }
  if (familyMode === 'ambient' || familyMode === 'intimate') {
    return 'Finish settles into a quieter, lower-noise close.'
  }
  if (familyMode === 'indulgent') {
    return 'Finish slows so the closing stop can linger naturally.'
  }
  if (familyMode === 'cultural') {
    return 'Finish eases out without losing the intentional flow.'
  }
  if (familyMode === 'playful' || familyMode === 'exploratory') {
    return 'Finish settles after variety without abrupt drop-offs.'
  }
  if (ambiance.noise === 'low' || ambiance.energy === 'low') {
    return 'Finish stays low-friction and easy to land.'
  }
  return 'Finish resolves with a clean pacing drop.'
}

function getStorySpineWhyThisWorksLine(
  candidate: DirectionCandidate,
): string {
  const familyMode = getStoryFamilyMode(candidate)

  if (familyMode === 'eventful') {
    return 'Built for a quick build, punctuated peak, and controlled landing.'
  }
  if (familyMode === 'social') {
    return 'Built for social momentum, a clear middle peak, and clean finish.'
  }
  if (familyMode === 'ritual') {
    return 'Designed to progress cleanly with a strong central moment.'
  }
  if (familyMode === 'indulgent') {
    return 'Built around a richer center with slower, deliberate pacing.'
  }
  if (familyMode === 'ambient' || familyMode === 'intimate') {
    return 'Built for a calm build, contained middle, and soft finish.'
  }
  if (familyMode === 'cultural') {
    return 'Designed for focused progression with an intentional center.'
  }
  if (familyMode === 'playful' || familyMode === 'exploratory') {
    return 'Built for varied progression with a clear middle beat.'
  }
  return 'Built for steady progression with a strong central moment.'
}

function getDirectionTrajectoryHint(
  candidate: DirectionCandidate,
  vibe: VibeAnchor,
): string {
  const familyMode = getStoryFamilyMode(candidate)
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile

  if (familyMode === 'eventful') {
    return 'a fast build toward punctuated peaks.'
  }
  if (familyMode === 'social') {
    return 'an energetic build toward a social middle.'
  }
  if (familyMode === 'ritual') {
    return 'a structured route with a clear central beat.'
  }
  if (familyMode === 'indulgent') {
    return 'a slower arc centered on richer stops.'
  }
  if (familyMode === 'ambient' || familyMode === 'intimate') {
    return 'a softer arc with a calmer, contained middle.'
  }
  if (familyMode === 'cultural') {
    return 'an intentional progression toward a focused center.'
  }
  if (familyMode === 'playful' || familyMode === 'exploratory') {
    return 'a varied arc that still lands cleanly.'
  }
  if (vibe === 'cozy' || ambiance.noise === 'low') {
    return 'a lower-friction arc with calmer pacing.'
  }
  if (mix.activity + mix.drinks >= 0.5 || vibe === 'lively') {
    return 'a quicker build toward a stronger middle.'
  }
  return 'a steady arc with clear pacing.'
}

function getKnownForLine(stop: ItineraryStop): string {
  const priorityTags = stop.tags.filter((tag) =>
    ['jazz', 'cocktails', 'wine', 'dessert', 'chef-led', 'tasting', 'speakeasy', 'tea'].includes(
      tag.toLowerCase(),
    ),
  )
  const tags = (priorityTags.length > 0 ? priorityTags : stop.tags).slice(0, 2)
  if (tags.length > 0) {
    return `Known for ${tags.map((tag) => toTitleCase(tag)).join(' and ')}.`
  }
  if (stop.subcategory) {
    return `Known for its ${toTitleCase(stop.subcategory)} focus.`
  }
  return `Known for a strong local fit in ${stop.neighborhood}.`
}

function toTagSet(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.toLowerCase()))
}

function getAlternativeDescriptor(
  candidate: ScoredVenue,
  options?: {
    role?: UserStopRole
    contractConstraints?: ContractConstraints
  },
): string {
  const tags = toTagSet(candidate.venue.tags)
  let baseDescriptor = 'different vibe'
  if (
    ['intimate', 'quiet', 'cozy', 'conversation', 'tea-room'].some((tag) =>
      tags.has(tag),
    )
  ) {
    baseDescriptor = 'more intimate'
  } else if (
    ['live', 'jazz', 'music', 'social', 'cocktails', 'late-night'].some((tag) =>
      tags.has(tag),
    )
  ) {
    baseDescriptor = 'more lively'
  } else if (
    ['dessert', 'gelato', 'ice-cream', 'tea', 'pastry'].some((tag) =>
      tags.has(tag),
    )
  ) {
    baseDescriptor = 'slower pace'
  } else if (candidate.venue.category === 'museum' || candidate.venue.category === 'event') {
    baseDescriptor = 'slower pace'
  } else if (candidate.venue.category === 'park') {
    baseDescriptor = 'more open-air'
  } else if (candidate.venue.driveMinutes <= 8) {
    baseDescriptor = 'closer, easier stop'
  }

  const role = options?.role
  const movementSignal =
    candidate.venue.driveMinutes <= 6
      ? role === 'highlight'
        ? 'same block'
        : 'nearby'
      : candidate.venue.driveMinutes <= 12
        ? 'short walk'
        : candidate.venue.driveMinutes <= 18
          ? 'nearby'
          : null
  const withMovementSignal = (reason: string): string => {
    if (!movementSignal) {
      return reason
    }
    if (reason.includes('nearby') || reason.includes('same-area') || reason.includes('close-by')) {
      return reason
    }
    if (role === 'start' && reason === 'quicker start' && movementSignal === 'nearby') {
      return 'quicker start nearby'
    }
    if (role === 'windDown' && reason === 'softer ending' && movementSignal === 'nearby') {
      return 'soft close nearby'
    }
    if (role === 'windDown' && reason === 'quieter landing' && movementSignal === 'nearby') {
      return 'quiet finish nearby'
    }
    if (role === 'start' && reason === 'gentler opener' && movementSignal === 'nearby') {
      return 'close-by alternative'
    }
    return `${reason} · ${movementSignal}`
  }
  if (!role) {
    return withMovementSignal(baseDescriptor)
  }

  if (role === 'start') {
    if (baseDescriptor === 'more lively') {
      return withMovementSignal('quicker start')
    }
    if (baseDescriptor === 'more intimate' || baseDescriptor === 'slower pace') {
      return withMovementSignal('easier opener')
    }
    if (baseDescriptor === 'closer, easier stop') {
      return withMovementSignal('same-area opener')
    }
    return withMovementSignal('gentler opener')
  }

  if (role === 'highlight') {
    if (options?.contractConstraints?.peakCountModel === 'distributed') {
      return withMovementSignal(
        baseDescriptor === 'more lively' ? 'livelier center' : 'central peak option',
      )
    }
    if (baseDescriptor === 'more lively') {
      return withMovementSignal(tags.has('social') ? 'livelier center' : 'stronger peak')
    }
    if (baseDescriptor === 'more intimate') {
      return withMovementSignal('more intimate centerpiece')
    }
    if (baseDescriptor === 'slower pace') {
      return withMovementSignal('steadier center')
    }
    if (baseDescriptor === 'closer, easier stop') {
      return withMovementSignal('livelier center')
    }
    return withMovementSignal('central peak option')
  }

  if (role === 'windDown') {
    if (baseDescriptor === 'more lively') {
      return withMovementSignal('livelier landing')
    }
    if (baseDescriptor === 'more intimate' || baseDescriptor === 'slower pace') {
      return withMovementSignal('softer ending')
    }
    if (baseDescriptor === 'closer, easier stop') {
      return withMovementSignal('shorter finish')
    }
    return withMovementSignal('quieter landing')
  }

  return withMovementSignal(baseDescriptor)
}

interface CandidateSwapProjection {
  swappedArc: ArcCandidate
  swappedItinerary: Itinerary
  candidateStop: ItineraryStop
}

interface SwapCandidateDisplayPrefilterResult {
  passes: boolean
  reason?: string
}

interface RoleAlternativesResult {
  alternatives: InlineAlternative[]
  prefilterDebug: SwapCandidatePrefilterDebug
}

function evaluateSwapCandidateDisplayPrefilter(params: {
  role: UserStopRole
  originalStop: ItineraryStop
  candidateStop: ItineraryStop
  candidateHasCanonicalIdentity: boolean
  swappedItinerary: Itinerary
  routeShapeContract?: RouteShapeContract
  baselineItinerary?: Itinerary
  targetStopIndex: number
  targetRole: UserStopRole
  hasTargetSlotAtIndex: boolean
  targetSlotRoleAtIndex?: UserStopRole
  requestedReplacementId: string
}): SwapCandidateDisplayPrefilterResult {
  const {
    role,
    originalStop,
    candidateStop,
    candidateHasCanonicalIdentity,
    swappedItinerary,
    routeShapeContract,
    baselineItinerary,
    targetStopIndex,
    targetRole,
    hasTargetSlotAtIndex,
    targetSlotRoleAtIndex,
    requestedReplacementId,
  } = params
  if (!candidateHasCanonicalIdentity) {
    return {
      passes: false,
      reason: 'canonical_identity_missing',
    }
  }
  if (!routeShapeContract || !baselineItinerary) {
    return { passes: true }
  }
  const hardStructural = evaluateHardStructuralSwapCompatibility({
    role,
    targetRole,
    targetStopIndex,
    hasTargetSlotAtIndex,
    targetSlotRoleAtIndex,
    requestedReplacementId,
    candidateStop,
    originalStop,
    canonicalItinerary: swappedItinerary,
    baselineItinerary,
    routeShapeContract,
    requireReplacementCanonicalProvider: false,
  })
  if (!hardStructural.passed) {
    return {
      passes: false,
      reason: hardStructural.hardRejectCode,
    }
  }
  return { passes: true }
}

function getRoleAlternatives(
  stop: ItineraryStop,
  scoredVenues: ScoredVenue[],
  itineraryStops: ItineraryStop[],
  currentArc: ArcCandidate,
  intent: IntentProfile,
  lens: ExperienceLens,
  options?: {
    routeShapeContract?: RouteShapeContract
    baselineItinerary?: Itinerary
    finalRouteSnapshot?: FinalRoute
    canonicalSwapIdentityByVenueId?: Record<string, CanonicalPlanningStopIdentity>
    contractConstraints?: ContractConstraints
  },
): RoleAlternativesResult {
  const role = roleToInternalRole[stop.role]
  const usedVenueIds = new Set(itineraryStops.map((item) => item.venueId))
  const currentVenueId = stop.venueId
  const crewPolicy = getCrewPolicy(intent.crew)
  const projectionByVenueId = new Map<string, CandidateSwapProjection | null>()
  const targetRouteStop =
    options?.finalRouteSnapshot?.stops.find((routeStop) => routeStop.role === stop.role) ??
    options?.finalRouteSnapshot?.stops.find(
      (routeStop) => routeStop.sourceStopId === stop.id || routeStop.venueId === stop.venueId,
    )
  const baselineTargetStopIndex =
    targetRouteStop?.stopIndex ??
    options?.baselineItinerary?.stops.findIndex(
      (itineraryStop) =>
        itineraryStop.role === stop.role &&
        (itineraryStop.id === stop.id || itineraryStop.venueId === stop.venueId),
    ) ??
    -1
  const hasTargetSlotAtIndex = baselineTargetStopIndex >= 0
  const targetSlotRoleAtIndex =
    targetRouteStop?.role ??
    (hasTargetSlotAtIndex
      ? options?.baselineItinerary?.stops[baselineTargetStopIndex]?.role
      : undefined)

  const resolveProjection = (candidate: ScoredVenue): CandidateSwapProjection | null => {
    if (projectionByVenueId.has(candidate.venue.id)) {
      return projectionByVenueId.get(candidate.venue.id) ?? null
    }
    const swappedArc = swapArcStop({
      currentArc,
      role: inverseRoleProjection[stop.role],
      replacement: candidate,
      intent,
      crewPolicy,
      lens,
    })
    if (!swappedArc) {
      projectionByVenueId.set(candidate.venue.id, null)
      return null
    }
    const swappedItinerary = projectItinerary(swappedArc, intent, lens)
    const candidateStop = swappedItinerary.stops.find((item) => item.role === stop.role)
    if (!candidateStop) {
      projectionByVenueId.set(candidate.venue.id, null)
      return null
    }
    const projection: CandidateSwapProjection = {
      swappedArc,
      swappedItinerary,
      candidateStop,
    }
    projectionByVenueId.set(candidate.venue.id, projection)
    return projection
  }

  const buildRanked = (includeUsed: boolean, minRoleScore: number): ScoredVenue[] =>
    scoredVenues
      .filter((candidate) => candidate.venue.id !== currentVenueId)
      .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
      .filter((candidate) => hasSourceBackedIdentity(candidate))
      .filter((candidate) => hasNavigableVenueLocation(candidate))
      .filter((candidate) => (includeUsed ? true : !usedVenueIds.has(candidate.venue.id)))
      .filter((candidate) => candidate.roleScores[role] >= minRoleScore)
      .filter((candidate) => Boolean(resolveProjection(candidate)))
      .sort((left, right) => {
        const leftProximity = 1 / (1 + Math.abs(left.venue.driveMinutes - stop.driveMinutes))
        const rightProximity = 1 / (1 + Math.abs(right.venue.driveMinutes - stop.driveMinutes))
        const leftScore = scoreAnchoredRoleFit(left, role) * 0.9 + leftProximity * 0.1
        const rightScore = scoreAnchoredRoleFit(right, role) * 0.9 + rightProximity * 0.1
        return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name)
      })

  const strictPrimary = buildRanked(false, 0.52)
  const strictFallback = buildRanked(true, 0.52)
  const relaxedPrimary = buildRanked(false, 0.44)
  const relaxedFallback = buildRanked(true, 0.44)
  const combined = [...strictPrimary, ...strictFallback, ...relaxedPrimary, ...relaxedFallback]
  const uniqueCandidates: ScoredVenue[] = []
  const seenVenueIds = new Set<string>()
  for (const candidate of combined) {
    if (seenVenueIds.has(candidate.venue.id)) {
      continue
    }
    seenVenueIds.add(candidate.venue.id)
    if (stop.role === 'highlight' && !isCommittedHighlightCandidateAnchored(candidate)) {
      continue
    }
    uniqueCandidates.push(candidate)
  }

  const beforeCount = uniqueCandidates.length
  let canonicalIdentityResolvedCount = 0
  let canonicalIdentityMissingCount = 0
  const prefilteredSwapCandidateIds: string[] = []
  const prefilterRejectReasonSummary: string[] = []
  const filteredCandidates: ScoredVenue[] = []
  for (const candidate of uniqueCandidates) {
    const projection = resolveProjection(candidate)
    if (!projection) {
      prefilteredSwapCandidateIds.push(candidate.venue.id)
      if (prefilterRejectReasonSummary.length < 4) {
        prefilterRejectReasonSummary.push(`${candidate.venue.id}: no swap projection`)
      }
      continue
    }
    const directCanonical = resolveCanonicalPlanningStopIdentityFromScoredVenue(
      projection.candidateStop,
      candidate,
    )
    const cachedCanonical = options?.canonicalSwapIdentityByVenueId?.[candidate.venue.id]
    const candidateHasCanonicalIdentity = Boolean(directCanonical || cachedCanonical)
    if (candidateHasCanonicalIdentity) {
      canonicalIdentityResolvedCount += 1
    } else {
      canonicalIdentityMissingCount += 1
    }
    const prefilter = evaluateSwapCandidateDisplayPrefilter({
      role: stop.role,
      originalStop: stop,
      candidateStop: projection.candidateStop,
      candidateHasCanonicalIdentity,
      swappedItinerary: projection.swappedItinerary,
      routeShapeContract: options?.routeShapeContract,
      baselineItinerary: options?.baselineItinerary,
      targetStopIndex: baselineTargetStopIndex,
      targetRole: stop.role,
      hasTargetSlotAtIndex,
      targetSlotRoleAtIndex,
      requestedReplacementId: candidate.venue.id,
    })
    if (!prefilter.passes) {
      prefilteredSwapCandidateIds.push(candidate.venue.id)
      if (prefilter.reason && prefilterRejectReasonSummary.length < 4) {
        prefilterRejectReasonSummary.push(`${candidate.venue.id}: ${prefilter.reason}`)
      }
      continue
    }
    filteredCandidates.push(candidate)
  }

  const alternatives: InlineAlternative[] = []
  for (const candidate of filteredCandidates) {
    const planningDisplay = resolvePlanningVenueDisplayFromScoredVenue(candidate)
    alternatives.push({
      venueId: candidate.venue.id,
      name: planningDisplay.title,
      descriptor: getAlternativeDescriptor(candidate, {
        role: stop.role,
        contractConstraints: options?.contractConstraints,
      }),
    })
    if (alternatives.length >= 3) {
      break
    }
  }

  return {
    alternatives,
    prefilterDebug: {
      swapCandidateDisplayCountBefore: beforeCount,
      swapCandidateDisplayCountAfter: filteredCandidates.length,
      canonicalIdentityResolvedCount,
      canonicalIdentityMissingCount,
      prefilteredSwapCandidateIds,
      prefilterRejectReasonSummary,
      swapDisplayUsesSharedHardStructuralCheck: true,
    },
  }
}

function getLocalSignal(stop: ItineraryStop): string {
  const tags = toTagSet(stop.tags)
  if (
    ['reservations', 'reservation-recommended', 'book-ahead', 'bookings'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'Reservations recommended.'
  }
  if (
    ['late-night', 'night-owl', 'live', 'jazz', 'small-stage'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'Fills quickly after 9pm.'
  }
  if (
    ['walk-up', 'quick-start', 'coffee', 'tea-room', 'dessert', 'gelato'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'Best earlier in the evening.'
  }
  if (stop.role === 'windDown') {
    return 'Best once the main moment eases out.'
  }
  if (stop.category === 'restaurant' || stop.category === 'bar' || stop.category === 'live_music') {
    return 'Reservations recommended.'
  }
  return 'Best earlier in the evening.'
}

function buildVenueLinkUrl(
  stop: ItineraryStop,
  displayNameOverride?: string,
  anchorSource?: {
    providerRecordId?: string
    latitude?: number
    longitude?: number
    venueName?: string
  },
): string {
  const providerRecordId = anchorSource?.providerRecordId?.trim()
  if (providerRecordId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(providerRecordId)}`
  }
  const latitude = anchorSource?.latitude
  const longitude = anchorSource?.longitude
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
  }
  const queryName =
    displayNameOverride?.trim() ||
    normalizePlanningNameCandidate(anchorSource?.venueName) ||
    stop.venueName
  const query = [queryName, stop.neighborhood, stop.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function getRoleTravelWindow(itinerary: Itinerary, role: UserStopRole): number {
  const stopIndex = itinerary.stops.findIndex((stop) => stop.role === role)
  if (stopIndex < 0) {
    return 0
  }
  const before = stopIndex > 0 ? itinerary.transitions[stopIndex - 1]?.estimatedTravelMinutes ?? 0 : 0
  const after =
    stopIndex < itinerary.stops.length - 1
      ? itinerary.transitions[stopIndex]?.estimatedTravelMinutes ?? 0
      : 0
  return before + after
}

function getSwapTradeoffSignal(role: UserStopRole, candidate: ItineraryStop): string {
  const tags = toTagSet(candidate.tags)
  if (role === 'highlight') {
    if (
      candidate.category === 'museum' ||
      candidate.category === 'event' ||
      ['quiet', 'cozy', 'curated', 'gallery'].some((tag) => tags.has(tag))
    ) {
      return 'Keeps the centerpiece, shifts to a quieter pace.'
    }
    if (
      candidate.category === 'live_music' ||
      ['live', 'jazz', 'social', 'cocktails', 'late-night'].some((tag) => tags.has(tag))
    ) {
      return 'Keeps the centerpiece, shifts to a livelier middle.'
    }
    return 'Keeps the centerpiece, shifts the tone.'
  }

  if (role === 'start') {
    if (['coffee', 'tea-room', 'quiet'].some((tag) => tags.has(tag))) {
      return 'Starts with a calmer first beat.'
    }
    return 'Starts with a more active first beat.'
  }

  return 'Keeps the route shape, changes the landing style.'
}

function getSwapCascadeHint(role: UserStopRole, candidate: ItineraryStop): string {
  const tags = toTagSet(candidate.tags)
  if (role === 'highlight') {
    return ['quiet', 'cozy', 'conversation'].some((tag) => tags.has(tag))
      ? 'May soften the ending.'
      : 'May tighten the ending.'
  }
  if (role === 'start') {
    return 'May shift how quickly the middle builds.'
  }
  return 'May change how gently the night lands.'
}

function getPostSwapHintRole(role: UserStopRole): UserStopRole | null {
  if (role === 'start') {
    return 'highlight'
  }
  if (role === 'highlight') {
    return 'windDown'
  }
  return null
}

function getPostSwapHintText(role: UserStopRole): string | null {
  if (role === 'start') {
    return 'You may want to keep the middle focused.'
  }
  if (role === 'highlight') {
    return 'You may want to tighten this ending.'
  }
  return null
}

function getHighlightTypeLabel(stop?: ItineraryStop): string {
  if (!stop) {
    return 'main highlight'
  }
  const tags = toTagSet(stop.tags)
  const late = tags.has('late-night') || tags.has('night-owl')
  if (tags.has('jazz')) {
    return late ? 'late jazz set' : 'jazz set'
  }
  if (stop.category === 'live_music' || ['live', 'music', 'performance', 'listening'].some((tag) => tags.has(tag))) {
    return late ? 'late live music set' : 'live music set'
  }
  if (stop.category === 'restaurant' || ['dinner', 'chef-led', 'tasting'].some((tag) => tags.has(tag))) {
    return 'dinner anchor'
  }
  if (stop.category === 'bar' || ['cocktails', 'social'].some((tag) => tags.has(tag))) {
    return 'cocktail-forward highlight'
  }
  return 'main highlight'
}

function getStartPacingLabel(stop?: ItineraryStop): string {
  if (!stop) {
    return 'a balanced start'
  }
  const tags = toTagSet(stop.tags)
  if (['quiet', 'cozy', 'conversation', 'coffee', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
    return 'a relaxed start'
  }
  if (['high-energy', 'buzzing', 'social', 'lively'].some((tag) => tags.has(tag))) {
    return 'an energetic start'
  }
  return 'a balanced start'
}

function getFinishPacingLabel(stop?: ItineraryStop): string {
  if (!stop) {
    return 'a clean finish'
  }
  const tags = toTagSet(stop.tags)
  if (['dessert', 'quiet', 'cozy', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
    return 'a clean finish'
  }
  if (['social', 'late-night', 'cocktails'].some((tag) => tags.has(tag))) {
    return 'a social finish'
  }
  return 'a clean finish'
}

function getVibeNarrativeLabel(cluster: RealityCluster): string {
  if (cluster === 'lively') {
    return 'lively'
  }
  if (cluster === 'chill') {
    return 'slower-paced'
  }
  return 'exploratory'
}

function buildSelectedDirectionPreviewContext(
  direction?: RealityDirectionCard,
): SelectedDirectionPreviewContext | undefined {
  if (!direction) {
    return undefined
  }

  return {
    directionId: direction.id,
    directionTitle: direction.card.title,
    pocketId: direction.debugMeta?.pocketId ?? direction.id,
    cluster: direction.cluster,
    experienceFamily: direction.debugMeta?.experienceFamily,
    familyConfidence: direction.debugMeta?.familyConfidence,
    subtitle: direction.card.subtitle,
    supportLine: direction.card.supportLine,
    whyNow: direction.card.whyNow,
    storySpinePreview: direction.card.storySpinePreview,
  }
}

function getGreatStopSignalForDirection(params: {
  direction: RealityDirectionCard | undefined
  opportunities: VerifiedCityOpportunity[]
}) {
  const { direction, opportunities } = params
  if (!direction) {
    return undefined
  }
  const pocketId = direction.debugMeta?.pocketId ?? direction.id
  const matchedOpportunity =
    opportunities.find((opportunity) => opportunity.selection.directionId === direction.id) ??
    opportunities.find(
      (opportunity) =>
        !opportunity.selection.directionId &&
        Boolean(opportunity.selection.pocketId) &&
        opportunity.selection.pocketId === pocketId,
    )
  return buildGreatStopAdmissibilitySignal(matchedOpportunity?.scenarioNight?.evaluation)
}

function buildDirectionPlanningSelectionFromCard(
  direction?: RealityDirectionCard,
  greatStopSignal?: NonNullable<IntentProfile['selectedDirectionContext']>['greatStopSignal'],
): DirectionPlanningSelection | undefined {
  if (!direction) {
    return undefined
  }

  return buildDirectionPlanningSelectionEngine({
    id: direction.id,
    label: direction.card.title,
    pocketId: direction.debugMeta?.pocketId ?? direction.id,
    pocketLabel: direction.debugMeta?.pocketLabel ?? direction.card.title,
    archetype: direction.debugMeta?.archetype ?? direction.cluster,
    cluster: direction.cluster,
    experienceFamily: direction.debugMeta?.experienceFamily,
    familyConfidence: direction.debugMeta?.familyConfidence,
    subtitle: direction.card.subtitle,
    laneIdentity: direction.debugMeta?.laneIdentity,
    macroLane: direction.debugMeta?.macroLane,
    greatStopSignal,
  })
}

function buildResolvedDirectionContext(
  selectedDirection?: DirectionPlanningSelection,
): ResolvedDirectionContext | undefined {
  return buildResolvedDirectionContextEngine(selectedDirection)
}

function buildRouteShapeContract(params: {
  selectedDirection: DirectionPlanningSelection
  selectedDirectionContext: ResolvedDirectionContext
  conciergeIntent: ConciergeIntent
  contractConstraints: ContractConstraints
}): RouteShapeContract {
  return buildRouteShapeContractEngine(params)
}

function getRouteShapeHints(routeShapeContract: RouteShapeContract): {
  grammarHint: string
  movementHint: string
  swapHint: string
} {
  const startPacing =
    routeShapeContract.roleProfile.start.pacing === 'quick' ? 'Fast open' : 'Steady open'
  const highlightEnergy =
    routeShapeContract.roleProfile.highlight.energyLevel === 'high'
      ? 'strong center'
      : 'curated center'
  const landingPacing =
    routeShapeContract.roleProfile.windDown.pacing === 'linger'
      ? 'clean landing'
      : 'soft landing'
  const movementHint =
    routeShapeContract.movementProfile.radius === 'tight'
      ? 'Everything stays close'
      : routeShapeContract.movementProfile.radius === 'balanced'
        ? 'Short transitions throughout'
        : 'Flexible movement envelope'
  const swapHint =
    routeShapeContract.mutationProfile.swapFlexibility === 'high'
      ? 'Easy to swap the centerpiece'
      : routeShapeContract.mutationProfile.swapFlexibility === 'medium'
        ? 'Swaps stay in-shape'
        : 'Swaps are tightly scoped'
  return {
    grammarHint: `${startPacing} | ${highlightEnergy} | ${landingPacing}`,
    movementHint,
    swapHint,
  }
}

type PreviewFamilyMode = DirectionCandidate['experienceFamily'] | 'neutral'
type NightPreviewMode = 'social' | 'exploratory' | 'intimate'
type DirectionPreviewStopRole = Extract<UserStopRole, 'start' | 'highlight' | 'surprise' | 'windDown'>

interface DirectionPreviewStop {
  role: DirectionPreviewStopRole
  name: string
}

interface DirectionPreviewModel {
  directionId: string
  headline: string
  tone: string
  stops: DirectionPreviewStop[]
  continuityLine: string
}

function getPreviewFamilyMode(
  context?: SelectedDirectionPreviewContext,
): PreviewFamilyMode {
  if (!context?.experienceFamily) {
    return 'neutral'
  }
  return (context.familyConfidence ?? 0) >= FAMILY_STORY_CONFIDENCE_MIN
    ? context.experienceFamily
    : 'neutral'
}

function mapFamilyModeToNightPreviewMode(familyMode: PreviewFamilyMode): NightPreviewMode | undefined {
  if (familyMode === 'social' || familyMode === 'eventful' || familyMode === 'playful') {
    return 'social'
  }
  if (familyMode === 'exploratory' || familyMode === 'cultural' || familyMode === 'ritual') {
    return 'exploratory'
  }
  if (familyMode === 'intimate' || familyMode === 'ambient' || familyMode === 'indulgent') {
    return 'intimate'
  }
  return undefined
}

function getNightPreviewMode(
  cluster: RealityCluster,
  itinerary: Itinerary,
  context?: SelectedDirectionPreviewContext,
): NightPreviewMode {
  const familyMode = mapFamilyModeToNightPreviewMode(getPreviewFamilyMode(context))
  if (familyMode) {
    return familyMode
  }

  let socialScore = 0
  let exploratoryScore = 0
  let intimateScore = 0
  itinerary.stops.forEach((stop) => {
    const tags = toTagSet(stop.tags)
    if (
      stop.category === 'live_music' ||
      stop.category === 'bar' ||
      ['live', 'music', 'jazz', 'social', 'cocktails'].some((tag) => tags.has(tag))
    ) {
      socialScore += 1
    }
    if (
      stop.category === 'museum' ||
      stop.category === 'activity' ||
      stop.category === 'park' ||
      ['gallery', 'culture', 'walking', 'walkable', 'explore'].some((tag) => tags.has(tag))
    ) {
      exploratoryScore += 1
    }
    if (
      stop.category === 'restaurant' ||
      ['quiet', 'cozy', 'conversation', 'tea', 'dessert', 'courtyard'].some((tag) =>
        tags.has(tag),
      )
    ) {
      intimateScore += 1
    }
  })

  if (socialScore > exploratoryScore && socialScore > intimateScore) {
    return 'social'
  }
  if (exploratoryScore > socialScore && exploratoryScore > intimateScore) {
    return 'exploratory'
  }
  if (intimateScore > socialScore && intimateScore > exploratoryScore) {
    return 'intimate'
  }
  if (cluster === 'lively') {
    return 'social'
  }
  if (cluster === 'explore') {
    return 'exploratory'
  }
  return 'intimate'
}

function getNightPreviewModeFromDirection(direction: RealityDirectionCard): NightPreviewMode {
  const family = direction.debugMeta?.experienceFamily
  if (family === 'social' || family === 'eventful' || family === 'playful') {
    return 'social'
  }
  if (family === 'exploratory' || family === 'cultural' || family === 'ritual') {
    return 'exploratory'
  }
  if (family === 'intimate' || family === 'ambient' || family === 'indulgent') {
    return 'intimate'
  }
  if (direction.cluster === 'lively') {
    return 'social'
  }
  if (direction.cluster === 'explore') {
    return 'exploratory'
  }
  return 'intimate'
}

function extractPreviewStopNamesFromDirection(direction: RealityDirectionCard): string[] {
  const source = direction.card.selectedProofLine ?? direction.card.proofLine
  return Array.from(
    new Set(
      source
        .split(/\||\u00B7|,/)
        .map((part) => part.replace(/^includes:\s*/i, '').trim())
        .filter(Boolean),
    ),
  )
}

function toDirectionPreviewStops(stopNames: string[]): DirectionPreviewStop[] {
  if (stopNames.length === 0) {
    return []
  }
  if (stopNames.length === 1) {
    return [{ role: 'highlight', name: stopNames[0] }]
  }
  if (stopNames.length === 2) {
    return [
      { role: 'start', name: stopNames[0] },
      { role: 'highlight', name: stopNames[1] },
    ]
  }
  if (stopNames.length === 3) {
    return [
      { role: 'start', name: stopNames[0] },
      { role: 'highlight', name: stopNames[1] },
      { role: 'windDown', name: stopNames[2] },
    ]
  }
  return [
    { role: 'start', name: stopNames[0] },
    { role: 'highlight', name: stopNames[1] },
    { role: 'surprise', name: stopNames[2] },
    { role: 'windDown', name: stopNames[3] },
  ]
}

function getDirectionPreviewHeadline(mode: NightPreviewMode, persona: PersonaMode): string {
  if (persona === 'romantic') {
    if (mode === 'social') {
      return 'A lively plan with a strong centerpiece and softer pacing around it'
    }
    if (mode === 'exploratory') {
      return 'A relaxed plan with atmosphere and room for discovery'
    }
    return 'A slower plan built around intimate, standout moments'
  }
  if (persona === 'family') {
    if (mode === 'social') {
      return 'An easy, active plan with clear anchors from start to finish'
    }
    if (mode === 'exploratory') {
      return 'A clear, accessible plan with variety and simple pacing'
    }
    return 'A calm plan built around easy anchor stops'
  }
  if (mode === 'social') {
    return 'A lively plan that builds and keeps moving'
  }
  if (mode === 'exploratory') {
    return 'A varied plan with movement and room to explore'
  }
  return 'A steadier plan with a strong middle and easy flow'
}

function getDirectionPreviewTone(mode: NightPreviewMode, persona: PersonaMode): string {
  if (persona === 'romantic') {
    if (mode === 'social') {
      return 'Stronger center with an intimate pace.'
    }
    if (mode === 'exploratory') {
      return 'Atmospheric pacing with intentional movement between moments.'
    }
    return 'Calm pacing with room to linger at each stop.'
  }
  if (persona === 'family') {
    if (mode === 'social') {
      return 'Clear transitions and straightforward pacing across anchor stops.'
    }
    if (mode === 'exploratory') {
      return 'Accessible variety with low-friction movement.'
    }
    return 'Simple pacing with an easy, dependable finish.'
  }
  if (mode === 'social') {
    return 'Shared energy and steady movement through the middle.'
  }
  if (mode === 'exploratory') {
    return 'Variety-forward pacing with easy group flow.'
  }
  return 'Lower-key pacing with a clear center and soft finish.'
}

function buildPreviewFromDirection(
  direction: RealityDirectionCard,
  persona: PersonaMode,
): DirectionPreviewModel {
  const mode = getNightPreviewModeFromDirection(direction)
  const stopNames = extractPreviewStopNamesFromDirection(direction)
  return {
    directionId: direction.id,
    headline: getDirectionPreviewHeadline(mode, persona),
    tone: getDirectionPreviewTone(mode, persona),
    stops: toDirectionPreviewStops(stopNames),
    continuityLine: 'Everything stays close and easy to move between',
  }
}

function buildPreviewFromFinalRoute(route: FinalRoute): DirectionPreviewModel {
  return {
    directionId: route.selectedDirectionId,
    headline: route.routeHeadline,
    tone: route.routeSummary,
    stops: route.stops
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => ({
        role: stop.role,
        name: stop.displayName,
      })),
    continuityLine: route.routeSummary,
  }
}

function buildDirectionIdentity(direction: RealityDirectionCard): string {
  return [
    direction.id,
    direction.cluster,
    direction.card.title,
    direction.card.subtitle ?? '',
    direction.card.whyNow,
    direction.card.whyYou,
    direction.card.anchorLine ?? '',
    direction.card.supportLine ?? '',
    direction.card.proofLine,
    direction.card.selectedProofLine ?? '',
    direction.debugMeta?.experienceFamily ?? '',
    direction.debugMeta?.familyConfidence ?? '',
  ].join('|')
}

function getDirectionPreviewStopLine(stop: DirectionPreviewStop, persona: PersonaMode): string {
  if (persona === 'family') {
    if (stop.role === 'start') {
      return `Start easy at ${stop.name} â€” a simple stop to ease everyone in.`
    }
    if (stop.role === 'highlight') {
      return `Head to ${stop.name} â€” this is the central stop of the plan.`
    }
    if (stop.role === 'windDown') {
      return `Wrap up at ${stop.name} â€” an easy place to wind down.`
    }
    return `If you want a change, ${stop.name} is an easy detour.`
  }
  if (persona === 'romantic') {
    if (stop.role === 'start') {
      return `Start easy at ${stop.name} â€” a calm opener with atmosphere.`
    }
    if (stop.role === 'highlight') {
      return `Head to ${stop.name} â€” this is where the night peaks.`
    }
    if (stop.role === 'windDown') {
      return `Wrap up at ${stop.name} â€” a softer place to land together.`
    }
    return `If you want a pivot, ${stop.name} adds a flexible detour.`
  }
  if (stop.role === 'start') {
    return `Start easy at ${stop.name} â€” an easy start for the group.`
  }
  if (stop.role === 'highlight') {
    return `Head to ${stop.name} â€” this is where the night peaks.`
  }
  if (stop.role === 'windDown') {
    return `Wrap up at ${stop.name} â€” a relaxed place to close things out.`
  }
  return `If you want a pivot, ${stop.name} adds a flexible detour.`
}

function getPreviewFamilyHeadline(
  family: PreviewFamilyMode,
  cluster: RealityCluster,
): string {
  if (family === 'eventful') {
    return 'A punctuated night with clear peaks'
  }
  if (family === 'intimate') {
    return 'A closer, contained night with calmer pacing'
  }
  if (family === 'ritual') {
    return 'A structured night that progresses in sequence'
  }
  if (family === 'exploratory') {
    return 'A layered night with open progression'
  }
  if (family === 'indulgent') {
    return 'A richer night centered on deeper stops'
  }
  if (family === 'ambient') {
    return 'A slower night that settles into atmosphere'
  }
  if (family === 'social') {
    return 'A social night with momentum through the middle'
  }
  if (family === 'cultural') {
    return 'An intentional night with focused pacing'
  }
  if (family === 'playful') {
    return 'A curious night with activity-led contrast'
  }
  return `A ${getVibeNarrativeLabel(cluster)} night with clear pacing`
}

function getPreviewDirectionCue(
  context?: SelectedDirectionPreviewContext,
): string | undefined {
  const rawCue = context?.supportLine ?? context?.subtitle ?? context?.whyNow
  if (!rawCue) {
    return undefined
  }
  const normalized = rawCue.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '')
  if (!normalized) {
    return undefined
  }
  if (normalized.length <= 88) {
    return normalized
  }
  return `${normalized.slice(0, 85).trimEnd()}...`
}

function hasDenseOverlapCue(context?: SelectedDirectionPreviewContext): boolean {
  const cue = [
    context?.supportLine,
    context?.subtitle,
    context?.whyNow,
    context?.storySpinePreview?.whyThisWorks,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (!cue) {
    return false
  }
  return [
    'dense',
    'overlap',
    'compact',
    'tight',
    'walkable',
    'short transition',
    'coherent',
    'coherence',
    'support',
  ].some((token) => cue.includes(token))
}

function extractPreviewConcepts(value: string): Set<string> {
  const normalized = value.toLowerCase()
  const concepts = new Set<string>()
  const dictionary: Array<{ key: string; cues: string[] }> = [
    { key: 'fast', cues: ['fast', 'quick', 'momentum'] },
    { key: 'social', cues: ['social', 'lively'] },
    { key: 'calm', cues: ['calm', 'contained', 'softer', 'settle'] },
    { key: 'structured', cues: ['structured', 'sequence', 'intentional', 'focused'] },
    { key: 'varied', cues: ['varied', 'layered', 'exploratory'] },
    { key: 'rich', cues: ['richer', 'indulgent'] },
    { key: 'center', cues: ['central', 'center', 'anchor', 'peak'] },
  ]
  for (const entry of dictionary) {
    if (entry.cues.some((cue) => normalized.includes(cue))) {
      concepts.add(entry.key)
    }
  }
  return concepts
}

function shouldRenderNightPreviewIdentityLine(
  identityLine: string,
  headline: string,
  whyLine: string,
): boolean {
  const normalizedIdentity = identityLine.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalizedIdentity) {
    return false
  }
  const normalizedHeadline = headline.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const normalizedWhy = whyLine.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (
    normalizedHeadline.includes(normalizedIdentity) ||
    normalizedIdentity.includes(normalizedHeadline)
  ) {
    return false
  }
  const identityConcepts = extractPreviewConcepts(identityLine)
  if (identityConcepts.size === 0) {
    return false
  }
  const coveredConcepts = extractPreviewConcepts(`${headline} ${whyLine}`)
  let overlapCount = 0
  for (const concept of identityConcepts) {
    if (coveredConcepts.has(concept)) {
      overlapCount += 1
    }
  }
  return overlapCount / identityConcepts.size < 0.75
}

function getNightPreviewIdentityLine(
  context: SelectedDirectionPreviewContext | undefined,
  arc: ArcCandidate,
): string {
  const familyMode = getPreviewFamilyMode(context)
  const highlightIntensity = getHighlightIntensityFromArc(arc) ?? 0.62

  if (familyMode === 'eventful' || familyMode === 'social') {
    return 'A fast-moving night with a strong central moment'
  }
  if (familyMode === 'intimate' || familyMode === 'ambient') {
    return 'A calmer night with a contained central moment'
  }
  if (familyMode === 'ritual') {
    return 'A structured night that builds cleanly to center'
  }
  if (familyMode === 'cultural') {
    return 'An intentional night with a focused central moment'
  }
  if (familyMode === 'playful' || familyMode === 'exploratory') {
    return 'A varied night with a clear central anchor'
  }
  if (familyMode === 'indulgent') {
    return 'A richer night centered on one defining moment'
  }
  if (highlightIntensity >= NIGHT_PREVIEW_HIGHLIGHT_DOMINANCE_THRESHOLD) {
    return 'A quick-build night with a clear central peak'
  }
  if (highlightIntensity >= 0.62) {
    return 'A balanced night with a clear central moment'
  }
  return 'A steady night with a softer central anchor'
}

function getNightPreviewWhyLine(
  cluster: RealityCluster,
  itinerary: Itinerary,
  context: SelectedDirectionPreviewContext | undefined,
  _arc: ArcCandidate,
): string {
  void cluster
  void itinerary
  void context
  return ''
}

function getPreviewOneLiner(
  cluster: RealityCluster,
  itinerary: Itinerary,
  context?: SelectedDirectionPreviewContext,
): string {
  const mode = getNightPreviewMode(cluster, itinerary, context)
  if (mode === 'social') {
    return 'A lively night that builds and keeps moving'
  }
  if (mode === 'exploratory') {
    return 'A relaxed night with room to wander and discover'
  }
  return 'A slower night built around a few strong moments'
}

function getClusterInterpretation(
  cluster: RealityCluster,
  context?: SelectedDirectionPreviewContext,
): string {
  const familyMode = getPreviewFamilyMode(context)

  if (familyMode === 'eventful') {
    return 'Fast build with punctuated momentum and a clear central peak.'
  }
  if (familyMode === 'intimate') {
    return 'Contained progression with closer transitions and a softer landing.'
  }
  if (familyMode === 'ritual') {
    return 'Stepwise pacing with a predictable sequence into the center moment.'
  }
  if (familyMode === 'exploratory') {
    return 'Layered progression that keeps variety without losing route clarity.'
  }
  if (familyMode === 'indulgent') {
    return 'Richer middle focus with deliberate pacing around anchor-grade stops.'
  }
  if (familyMode === 'ambient') {
    return 'Atmospheric pacing that unfolds slowly and avoids abrupt transitions.'
  }
  if (familyMode === 'social') {
    return 'Social flow that builds quickly and stays active through the midpoint.'
  }
  if (familyMode === 'cultural') {
    return 'Intentional pacing with a focused center and lower chaos profile.'
  }
  if (familyMode === 'playful') {
    return 'Activity-forward pacing with controlled detours and a clear center beat.'
  }
  if (cluster === 'lively') {
    return 'Higher social momentum with a stronger midpoint.'
  }
  if (cluster === 'chill') {
    return 'Softer pacing with a steadier build into the highlight.'
  }
  return 'More exploratory pacing with contrast across stops.'
}

function getRouteThesis(
  cluster: RealityCluster,
  itinerary: Itinerary,
  context?: SelectedDirectionPreviewContext,
): string {
  const highlight = getCoreStop(itinerary, 'highlight')
  const waypoint = highlight ? `${highlight.venueName} (${getHighlightTypeLabel(highlight)})` : 'TBD'
  const cue = getPreviewDirectionCue(context)
  const interpretation = getClusterInterpretation(cluster, context)
  if (cue) {
    return `Interpretation: ${interpretation} Waypoint: ${waypoint}. Direction cue: ${cue}.`
  }
  return `Interpretation: ${interpretation} Waypoint: ${waypoint}.`
}

function getPreviewStopTexture(stop: ItineraryStop): string {
  const tags = toTagSet(stop.tags)

  if (
    stop.category === 'live_music' ||
    ['jazz', 'live', 'music', 'performance', 'listening'].some((tag) => tags.has(tag))
  ) {
    return 'A music-forward room'
  }
  if (
    ['tea', 'tea-room', 'coffee', 'quiet', 'cozy', 'conversation'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'A quiet lounge setting'
  }
  if (
    ['dessert', 'gelato', 'ice-cream', 'pastry', 'sweet'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'A gentle dessert-forward stop'
  }
  if (stop.category === 'restaurant') {
    return 'A warm dining room'
  }
  if (stop.category === 'bar') {
    return 'A cocktail-forward spot'
  }
  if (stop.category === 'museum') {
    return 'A culture-forward space'
  }
  if (stop.category === 'park') {
    return 'An open-air setting'
  }
  return 'A neighborhood venue'
}

function getRoleFamilyFraming(
  role: UserStopRole,
  family: PreviewFamilyMode,
  recoveredCentralMomentHighlight = false,
  dominantHighlight = false,
): string {
  if (role === 'start') {
    if (family === 'ritual' || family === 'cultural') {
      return 'sets direction early without peaking too soon'
    }
    if (family === 'eventful' || family === 'social') {
      return 'starts light and keeps the night flexible'
    }
    if (family === 'playful' || family === 'exploratory') {
      return 'opens with optionality while keeping the route pointed'
    }
    return 'opens the night with room to settle in'
  }

  if (role === 'highlight') {
    if (recoveredCentralMomentHighlight) {
      return 'acts as the night\'s central release point'
    }
    if (dominantHighlight || family === 'eventful' || family === 'social') {
      return 'delivers the clearest payoff of the night'
    }
    if (family === 'intimate' || family === 'ambient') {
      return 'holds the route together as its central moment'
    }
    if (family === 'ritual' || family === 'cultural') {
      return 'carries the route\'s defining central release'
    }
    return 'carries the main energy the route is built around'
  }

  if (role === 'windDown') {
    if (family === 'ritual' || family === 'cultural') {
      return 'turns the pace down into a cleaner close'
    }
    if (family === 'intimate' || family === 'ambient' || family === 'indulgent') {
      return 'gives the route a softer, more settled finish'
    }
    if (
      family === 'eventful' ||
      family === 'social' ||
      family === 'playful' ||
      family === 'exploratory'
    ) {
      return 'lets the night taper without dropping flat'
    }
    return 'lands the route with a clean decompression'
  }

  return 'supports overall route flow'
}

function getPreviewStopDescription(
  stop?: ItineraryStop,
  _context?: SelectedDirectionPreviewContext,
  _arc?: ArcCandidate,
): string {
  if (!stop) {
    return 'This stop keeps the night moving.'
  }
  if (stop.role === 'start') {
    return `Start easy at ${stop.venueName} â€” a low-key spot to ease in.`
  }
  if (stop.role === 'highlight') {
    return `Head to ${stop.venueName} â€” this is where the night peaks.`
  }
  if (stop.role === 'windDown') {
    return `Wrap up at ${stop.venueName} â€” a relaxed place to land softly.`
  }
  return `If you want a pivot, ${stop.venueName} adds a flexible detour.`
}

function getLightConstraintBadges(stop: ItineraryStop): string[] {
  const tags = toTagSet(stop.tags)
  const badgePool: Array<{ label: string; priority: number }> = []
  if (
    stop.category === 'live_music' ||
    ['jazz', 'live', 'music', 'performance', 'listening'].some((tag) =>
      tags.has(tag),
    )
  ) {
    badgePool.push({ label: 'Live music', priority: 4 })
  }
  if (
    ['late-night', 'night-owl', 'open-late', 'after-dark', 'night'].some((tag) =>
      tags.has(tag),
    )
  ) {
    badgePool.push({ label: 'Late-night friendly', priority: 3 })
  }
  if (tags.has('walkable')) {
    badgePool.push({ label: 'Short walk', priority: 2 })
  }
  if (
    ['popular', 'busy', 'crowded', 'buzzing', 'signature', 'destination'].some((tag) =>
      tags.has(tag),
    )
  ) {
    badgePool.push({ label: 'Popular spot', priority: 1 })
  }

  const strongestPriority = Math.max(...badgePool.map((item) => item.priority), 0)
  const filteredPool =
    strongestPriority >= 3
      ? badgePool.filter((item) => item.priority > 1)
      : badgePool
  return filteredPool
    .sort((left, right) => right.priority - left.priority || left.label.localeCompare(right.label))
    .slice(0, 2)
    .map((item) => item.label)
}

function getPreviewContinuityLine(
  _cluster: RealityCluster,
  _itinerary: Itinerary,
  _context?: SelectedDirectionPreviewContext,
  _arc?: ArcCandidate,
): string {
  return 'Everything stays close and easy to move between'
}

function getNightPreviewHighlightReasonLine(
  arc: ArcCandidate,
  context?: SelectedDirectionPreviewContext,
): string {
  const highlight = arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue
  if (!highlight) {
    return 'This anchors the experience and defines the tone.'
  }

  const familyMode = getPreviewFamilyMode(context)
  const recoveredCentralMomentHighlight = Boolean(
    arc.scoreBreakdown.recoveredCentralMomentHighlight,
  )
  if (recoveredCentralMomentHighlight) {
    if (familyMode === 'eventful' || familyMode === 'social') {
      return 'This is the main moment the route builds around.'
    }
    if (familyMode === 'ritual' || familyMode === 'indulgent') {
      return 'This anchors the route as its defining central moment.'
    }
    if (familyMode === 'intimate' || familyMode === 'ambient') {
      return 'This holds the night together as a calmer anchoring moment.'
    }
    return 'This serves as the central moment the rest of the route supports.'
  }
  const dominantPeak =
    Boolean(arc.scoreBreakdown.highlightDominanceApplied) ||
    highlight.taste.signals.momentIntensity.score >=
      NIGHT_PREVIEW_HIGHLIGHT_DOMINANCE_THRESHOLD

  if (dominantPeak) {
    if (familyMode === 'eventful' || familyMode === 'social') {
      return 'The night peaks here with its strongest energy.'
    }
    if (familyMode === 'ritual' || familyMode === 'indulgent') {
      return 'This anchors the experience as the defining central moment.'
    }
    if (familyMode === 'intimate' || familyMode === 'ambient') {
      return 'This is the central peak, kept strong without breaking the pacing.'
    }
    if (familyMode === 'exploratory' || familyMode === 'playful') {
      return 'This is the moment the route builds toward and resolves around.'
    }
    return 'This is the moment the night builds toward.'
  }

  if (familyMode === 'ritual' || familyMode === 'intimate' || familyMode === 'ambient') {
    return 'This becomes the central moment that the rest of the route supports.'
  }
  return 'This anchors the experience and defines the tone.'
}

function getInlineStopNarrative(
  stop: ItineraryStop,
  intent: IntentProfile,
  options?: {
    scoredVenue?: ScoredVenue
    roleTravelWindowMinutes?: number
    nearbySummary?: string
    itineraryStops?: ItineraryStop[]
    experienceContract?: ExperienceContract
    contractConstraints?: ContractConstraints
  },
): Pick<
  InlineStopDetail,
  | 'whyItFits'
  | 'tonightSignals'
  | 'aroundHereSignals'
  | 'knownFor'
  | 'goodToKnow'
  | 'localSignal'
  | 'stopNarrativeWhyNow'
  | 'stopNarrativeRoleMeaning'
  | 'stopNarrativeTransitionLogic'
  | 'stopNarrativeFlavorTags'
  | 'stopNarrativeMode'
  | 'stopNarrativeSource'
  | 'stopFlavorSummary'
  | 'stopTransitionSummary'
  | 'venueLinkUrl'
> {
  const localSignal = getLocalSignal(stop)
  const venueLinkUrl = buildVenueLinkUrl(stop)
  const baseTonightSignals = buildTonightSignals({
    stop,
    scoredVenue: options?.scoredVenue,
    roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
    nearbySummary: options?.nearbySummary,
  })
  const stopNarrative = deriveContractAwareStopNarrative({
    stop,
    intent,
    scoredVenue: options?.scoredVenue,
    itineraryStops: options?.itineraryStops,
    experienceContract: options?.experienceContract,
    contractConstraints: options?.contractConstraints,
  })
  const flavorLine =
    stopNarrative.flavorTags.length > 0 ? `Flavor: ${stopNarrative.flavorTags.join(' Â· ')}` : undefined
  const tonightSignals = Array.from(
    new Set([flavorLine, ...baseTonightSignals].filter((value): value is string => Boolean(value))),
  ).slice(0, 4)

  return {
    whyItFits: stopNarrative.roleMeaning,
    tonightSignals,
    aroundHereSignals: flavorLine ? [flavorLine] : undefined,
    knownFor: `${stopNarrative.whyNow} ${getKnownForLine(stop)}`,
    goodToKnow: stopNarrative.transitionLogic,
    localSignal,
    stopNarrativeWhyNow: stopNarrative.whyNow,
    stopNarrativeRoleMeaning: stopNarrative.roleMeaning,
    stopNarrativeTransitionLogic: stopNarrative.transitionLogic,
    stopNarrativeFlavorTags: stopNarrative.flavorTags,
    stopNarrativeMode: stopNarrative.mode,
    stopNarrativeSource: stopNarrative.source,
    stopFlavorSummary: stopNarrative.flavorSummary,
    stopTransitionSummary: stopNarrative.transitionSummary,
    venueLinkUrl,
  }
}

function getInlineStopDetail(
  stop: ItineraryStop,
  intent: IntentProfile,
  scoredVenues: ScoredVenue[],
  itineraryStops: ItineraryStop[],
  currentArc: ArcCandidate,
  lens: ExperienceLens,
  options?: {
    roleTravelWindowMinutes?: number
    nearbySummary?: string
    routeShapeContract?: RouteShapeContract
    baselineItinerary?: Itinerary
    finalRouteSnapshot?: FinalRoute
    canonicalSwapIdentityByVenueId?: Record<string, CanonicalPlanningStopIdentity>
    experienceContract?: ExperienceContract
    contractConstraints?: ContractConstraints
  },
): InlineStopDetail & { swapCandidatePrefilterDebug: SwapCandidatePrefilterDebug } {
  const narrative = getInlineStopNarrative(stop, intent, {
    scoredVenue: findScoredVenueForStop(stop, currentArc),
    roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
    nearbySummary: options?.nearbySummary,
    itineraryStops,
    experienceContract: options?.experienceContract,
    contractConstraints: options?.contractConstraints,
  })
  const { alternatives, prefilterDebug } = getRoleAlternatives(
    stop,
    scoredVenues,
    itineraryStops,
    currentArc,
    intent,
    lens,
    {
      routeShapeContract: options?.routeShapeContract,
      baselineItinerary: options?.baselineItinerary,
      finalRouteSnapshot: options?.finalRouteSnapshot,
      canonicalSwapIdentityByVenueId: options?.canonicalSwapIdentityByVenueId,
      contractConstraints: options?.contractConstraints,
    },
  )
  return {
    ...narrative,
    alternatives,
    swapCandidatePrefilterDebug: prefilterDebug,
  }
}

export function SandboxConciergePage() {
  /**
   * ARC BOUNDARY: Application wrapper for sandbox concierge.
   *
   * Owns orchestration + debug rendering only.
   * Must consume canonical engine artifacts and avoid re-authoring engine truth.
   */
  const [city, setCity] = useState('San Jose')
  const [persona, setPersona] = useState<PersonaMode>('romantic')
  const [primaryVibe, setPrimaryVibe] = useState<VibeAnchor>('lively')
  const [activeDistrictPocketId, setActiveDistrictPocketId] = useState<string>(ALL_DISTRICTS_CONTEXT_ID)
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null)
  const [selectedIdReconciled, setSelectedIdReconciled] = useState(false)
  const [userSelectedDirection, setUserSelectedDirection] = useState<{
    setKey: string
    directionId: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [showDebug, setShowDebug] = useState(false)
  const [showDistrictPanel, setShowDistrictPanel] = useState(false)
  const [ecsState, setEcsState] = useState<ExplorationControlState>(DEFAULT_ECS_STATE)
  const [activePreviewShapeIntent, setActivePreviewShapeIntent] = useState<PreviewShapeIntent | null>(
    null,
  )
  const [previewFeedback, setPreviewFeedback] = useState<string | null>(null)
  const [expandedRole, setExpandedRole] = useState<PreviewAdjustableRole | null>(
    null,
  )
  const [plan, setPlan] = useState<DemoPlanState>()
  const [finalRoute, setFinalRoute] = useState<FinalRoute | null>(null)
  const [routeVersion, setRouteVersion] = useState(0)
  const [hasRevealed, setHasRevealed] = useState(false)
  const [activeRole, setActiveRole] = useState<UserStopRole>('start')
  const [nearbySummaryByRole, setNearbySummaryByRole] = useState<Partial<Record<UserStopRole, string>>>(
    {},
  )
  const [isLocking, setIsLocking] = useState(false)
  const [previewSwap, setPreviewSwap] = useState<PreviewSwapState>()
  const [swapDebugBreadcrumb, setSwapDebugBreadcrumb] = useState<SwapDebugBreadcrumb | null>(null)
  const [swapInteractionBreadcrumb, setSwapInteractionBreadcrumb] =
    useState<SwapInteractionBreadcrumb | null>(null)
  const [swapCompatibilityDebug, setSwapCompatibilityDebug] = useState<SwapCompatibilityResult | null>(
    null,
  )
  const [swapCanonicalIdentityByVenueId, setSwapCanonicalIdentityByVenueId] = useState<
    Record<string, CanonicalPlanningStopIdentity>
  >({})
  const [swapCanonicalIdentityMissingByVenueId, setSwapCanonicalIdentityMissingByVenueId] = useState<
    Record<string, true>
  >({})
  const [generationContractDebug, setGenerationContractDebug] =
    useState<GenerationContractDebugBreadcrumb | null>(null)
  const [appliedSwapRole, setAppliedSwapRole] = useState<UserStopRole | null>(null)
  const [canonicalStopByRole, setCanonicalStopByRole] =
    useState<Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>>>({})
  const [rejectedStopRoles, setRejectedStopRoles] = useState<UserStopRole[]>([])
  const [districtPreviewResult, setDistrictPreviewResult] =
    useState<BuildDistrictOpportunityProfilesResult>()
  const [districtRecommendations, setDistrictRecommendations] = useState<
    DistrictRecommendation[]
  >([])
  const [scenarioCandidateBoard, setScenarioCandidateBoard] = useState<StopTypeCandidateBoard | null>(
    null,
  )
  const [scenarioBuiltNights, setScenarioBuiltNights] = useState<BuiltScenarioNight[]>([])
  const [districtPreviewLoading, setDistrictPreviewLoading] = useState(false)
  const [districtPreviewError, setDistrictPreviewError] = useState<string>()
  const [stageFingerprintsByScenario, setStageFingerprintsByScenario] = useState<
    Record<string, StageOverlapFingerprint>
  >({})
  const [debugExpandedByKey, setDebugExpandedByKey] = useState<Record<string, boolean>>({})
  const [selectionPreview, setSelectionPreview] = useState<DirectionPreviewModel | null>(null)
  const verticalDebugEnabled = false
  const districtLocationQuery = useMemo(() => city.trim(), [city])
  const selectedPersonaLabel = useMemo(
    () => personaOptions.find((option) => option.value === persona)?.label ?? persona,
    [persona],
  )
  const selectedVibeLabel = useMemo(
    () => vibeOptions.find((option) => option.value === primaryVibe)?.label ?? primaryVibe,
    [primaryVibe],
  )
  const showStep2SecondarySurfaces = verticalDebugEnabled && showDebug
  const resolvedScenarioFamily = useMemo(
    () =>
      resolveScenarioFamily({
        city: districtLocationQuery,
        persona,
        vibe: primaryVibe,
      }),
    [districtLocationQuery, persona, primaryVibe],
  )
  const activeScenarioContract = useMemo(
    () =>
      getHospitalityScenarioContract({
        city: districtLocationQuery,
        persona,
        vibe: primaryVibe,
      }),
    [districtLocationQuery, persona, primaryVibe],
  )
  const activeTasteExperienceContract = useMemo(
    () => buildExperienceContractFromScenarioContract(activeScenarioContract),
    [activeScenarioContract],
  )
  const intentBriefLine = useMemo(() => {
    const location = districtLocationQuery.length > 0 ? districtLocationQuery : 'Location not set'
    return `${location} Â· ${selectedPersonaLabel} Â· ${selectedVibeLabel}`
  }, [districtLocationQuery, selectedPersonaLabel, selectedVibeLabel])
  const previousDirectionIdentityRef = useRef<Map<string, string>>(new Map())
  const previousPersonaVibeRef = useRef<{ persona: PersonaMode; vibe: VibeAnchor } | null>(null)
  const selectionEpochRef = useRef(0)
  const autoDirectionSyncAttemptRef = useRef<string | null>(null)
  const planRef = useRef<DemoPlanState | undefined>(plan)
  const finalRouteRef = useRef<FinalRoute | null>(finalRoute)
  const canonicalStopByRoleRef =
    useRef<Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>>>(canonicalStopByRole)
  const swapCanonicalIdentityByVenueIdRef = useRef<Record<string, CanonicalPlanningStopIdentity>>(
    swapCanonicalIdentityByVenueId,
  )
  const routeVersionRef = useRef(routeVersion)
  const updateFinalRoute = useCallback((nextRoute: FinalRoute | null) => {
    setFinalRoute(nextRoute)
    setRouteVersion((current) => (nextRoute ? current + 1 : 0))
  }, [])
  useEffect(() => {
    planRef.current = plan
  }, [plan])
  useEffect(() => {
    finalRouteRef.current = finalRoute
  }, [finalRoute])
  useEffect(() => {
    canonicalStopByRoleRef.current = canonicalStopByRole
  }, [canonicalStopByRole])
  useEffect(() => {
    swapCanonicalIdentityByVenueIdRef.current = swapCanonicalIdentityByVenueId
  }, [swapCanonicalIdentityByVenueId])
  useEffect(() => {
    routeVersionRef.current = routeVersion
  }, [routeVersion])
  useEffect(() => {
    let cancelled = false
    const loadScenarioBuilderArtifacts = async () => {
      if (!resolvedScenarioFamily) {
        setScenarioCandidateBoard(null)
        setScenarioBuiltNights([])
        return
      }
      try {
        const board = await buildStopTypeCandidateBoardFromIntent({
          city: districtLocationQuery,
          persona,
          vibe: primaryVibe,
          sourceMode: 'hybrid',
        })
        if (cancelled) {
          return
        }
        if (!board) {
          setScenarioCandidateBoard(null)
          setScenarioBuiltNights([])
          return
        }
        const builtNights = buildScenarioNightsFromCandidateBoard(board)
        setScenarioCandidateBoard(board)
        setScenarioBuiltNights(builtNights)
      } catch {
        if (cancelled) {
          return
        }
        setScenarioCandidateBoard(null)
        setScenarioBuiltNights([])
      }
    }
    void loadScenarioBuilderArtifacts()
    return () => {
      cancelled = true
    }
  }, [districtLocationQuery, persona, primaryVibe, resolvedScenarioFamily])
  useEffect(() => {
    setSwapCanonicalIdentityByVenueId({})
    setSwapCanonicalIdentityMissingByVenueId({})
  }, [plan?.itinerary.id])
  useEffect(() => {
    if (!plan) {
      return
    }
    let cancelled = false

    const hydrateSwapCanonicalIdentity = async () => {
      const knownResolved = swapCanonicalIdentityByVenueId
      const knownMissing = swapCanonicalIdentityMissingByVenueId
      const nextResolved: Record<string, CanonicalPlanningStopIdentity> = {}
      const nextMissing: Record<string, true> = {}
      const crewPolicy = getCrewPolicy(plan.intentProfile.crew)
      const coreStops = plan.itinerary.stops.filter(
        (stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown',
      )

      for (const stop of coreStops) {
        const internalRole = roleToInternalRole[stop.role]
        const rankedCandidates = plan.scoredVenues
          .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
          .filter((candidate) => candidate.venue.id !== stop.venueId)
          .filter((candidate) => hasSourceBackedIdentity(candidate))
          .filter((candidate) => hasNavigableVenueLocation(candidate))
          .filter((candidate) => candidate.roleScores[internalRole] >= 0.44)
          .sort((left, right) => {
            const leftScore = scoreAnchoredRoleFit(left, internalRole)
            const rightScore = scoreAnchoredRoleFit(right, internalRole)
            return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name)
          })
          .slice(0, 14)

        for (const candidate of rankedCandidates) {
          if (
            knownResolved[candidate.venue.id] ||
            nextResolved[candidate.venue.id] ||
            knownMissing[candidate.venue.id] ||
            nextMissing[candidate.venue.id]
          ) {
            continue
          }
          const swappedArc = swapArcStop({
            currentArc: plan.selectedArc,
            role: inverseRoleProjection[stop.role],
            replacement: candidate,
            intent: plan.intentProfile,
            crewPolicy,
            lens: plan.lens,
          })
          if (!swappedArc) {
            nextMissing[candidate.venue.id] = true
            continue
          }
          const swappedItinerary = projectItinerary(swappedArc, plan.intentProfile, plan.lens)
          const candidateStop = swappedItinerary.stops.find((item) => item.role === stop.role)
          if (!candidateStop) {
            nextMissing[candidate.venue.id] = true
            continue
          }

          const canonicalFromSource = resolveCanonicalPlanningStopIdentityFromScoredVenue(
            candidateStop,
            candidate,
          )
          if (canonicalFromSource) {
            nextResolved[candidate.venue.id] = canonicalFromSource
            continue
          }

          const canonical = await resolveCanonicalPlanningStopIdentity(candidateStop, candidate)
          if (cancelled) {
            return
          }
          if (canonical) {
            nextResolved[candidate.venue.id] = canonical
          } else {
            nextMissing[candidate.venue.id] = true
          }
        }
      }

      if (cancelled) {
        return
      }
      if (Object.keys(nextResolved).length > 0) {
        setSwapCanonicalIdentityByVenueId((current) => ({
          ...current,
          ...nextResolved,
        }))
      }
      if (Object.keys(nextMissing).length > 0) {
        setSwapCanonicalIdentityMissingByVenueId((current) => ({
          ...current,
          ...nextMissing,
        }))
      }
    }

    void hydrateSwapCanonicalIdentity()
    return () => {
      cancelled = true
    }
  }, [plan, swapCanonicalIdentityByVenueId, swapCanonicalIdentityMissingByVenueId])
  const unresolvedLocationReason =
    districtPreviewResult?.location.source === 'unresolved_query'
      ? districtPreviewResult.location.meta.unresolvedReason
      : undefined
  const canonicalInterpretationBundle = useMemo(
    () =>
      // Wrapper seam: Interpretation owns canonical meaning artifact construction.
      buildCanonicalInterpretationBundle({
        persona,
        vibe: primaryVibe,
        city: districtLocationQuery,
        planningMode: 'engine-led',
        entryPoint: 'direction_selection',
        hasAnchor: false,
      }),
    [districtLocationQuery, persona, primaryVibe],
  )
  const canonicalConciergeIntent = canonicalInterpretationBundle.normalizedIntent
  const canonicalExperienceContract = canonicalInterpretationBundle.experienceContract
  const canonicalContractConstraints = canonicalInterpretationBundle.contractConstraints
  const bearingsGreatStopSignal = useMemo(() => {
    if (!resolvedScenarioFamily || scenarioBuiltNights.length === 0) {
      return undefined
    }
    const severeNight =
      scenarioBuiltNights.find((night) => {
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
      }) ?? scenarioBuiltNights[0]
    return buildGreatStopAdmissibilitySignal(severeNight.evaluation)
  }, [resolvedScenarioFamily, scenarioBuiltNights])
  const contractGateWorld = useMemo<ContractGateWorld>(() => {
    // Wrapper seam: Bearings owns admissibility truth (ContractGateWorld).
    return buildContractGateWorld({
      ranked: districtPreviewResult?.ranked ?? [],
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
  }, [
    bearingsGreatStopSignal,
    canonicalContractConstraints,
    canonicalExperienceContract,
    canonicalInterpretationBundle,
    districtPreviewResult,
  ])
  const contractAwareDistrictRanking = useMemo<ContractAwareDistrictRankingResult>(
    () => contractGateWorld.contractAwareRanking,
    [contractGateWorld],
  )
  const strategyAdmissibleWorlds = useMemo<StrategyAdmissibleWorld[]>(
    () =>
      // Wrapper seam: Bearings owns per-strategy admissible worlds.
      buildStrategyAdmissibleWorlds({
        contractGateWorld,
        strategyFamily: canonicalInterpretationBundle.strategyFamily,
        strategySummary: canonicalInterpretationBundle.strategySemantics.summary,
      }),
    [canonicalInterpretationBundle, contractGateWorld],
  )
  const allDirectionCards = useMemo<RealityDirectionCard[]>(() => {
    if (!districtPreviewResult || contractGateWorld.admittedPockets.length === 0) {
      return []
    }
    const experienceContractActShape = formatExperienceContractActShape(
      canonicalExperienceContract.actStructure.actPattern,
    )

    const candidatePoolLimit = Math.min(contractGateWorld.admittedPockets.length, 10)
    const baseCandidates = buildDirectionCandidates({
      ranked: contractAwareDistrictRanking.ranked,
      debug: districtPreviewResult.debug,
      candidatePoolLimit,
      contractGateWorld,
      strategyAdmissibleWorlds,
      context: {
        persona,
        vibe: primaryVibe,
        experienceContract: canonicalExperienceContract,
        contractConstraints: canonicalContractConstraints,
      },
    })
    const personaShapedCandidates = applyPersonaShaping(baseCandidates, persona)
    const vibeShapedCandidates = applyVibeShaping(personaShapedCandidates, primaryVibe)
    const finalSelection = selectBestDistinctDirections({
      candidates: vibeShapedCandidates,
      preShapeCandidates: baseCandidates,
      requestedVibe: primaryVibe,
      finalLimit: 3,
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
    // TODO(multi-vibe-shaping): support secondary-vibe and blended weighting in a future pass.

    const usedPrimarySignals = new Set<string>()
    const usedPocketTypes = new Set<PocketType>()

    return candidates.map((candidate, index) => {
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
      const confirmation = `You're starting in ${candidate.pocketLabel} â€” ${getDirectionTrajectoryHint(candidate, primaryVibe)}`
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
      const candidateDirectionContext = buildResolvedDirectionContext(candidateDirectionSelection)
      if (!candidateDirectionContext) {
        return null
      }
      const routeShapeHints = getRouteShapeHints(
        buildRouteShapeContract({
          selectedDirection: candidateDirectionSelection,
          selectedDirectionContext: candidateDirectionContext,
          conciergeIntent: canonicalConciergeIntent,
          contractConstraints: canonicalContractConstraints,
        }),
      )
      const conciergeHint = `${canonicalConciergeIntent.controlPosture.mode} | ${canonicalConciergeIntent.objective.primary} | swaps ${canonicalConciergeIntent.constraintPosture.swapTolerance}`

      return {
        id: candidate.pocketId,
        cluster: candidate.cluster,
        recommended: index === 0,
        directionStrategyWorldDebug: candidate.directionStrategyWorldDebug,
        card: {
          title: hyperlocalExpression.title,
          subtitle: hyperlocalExpression.subtitle,
          toneTag: getDirectionToneTag(candidate.archetype),
          whyNow: candidate.directionNarrativeSummary,
          whyYou: candidate.directionNarrativeSupport,
          anchorLine: hyperlocalExpression.anchorLine,
          supportLine: hyperlocalExpression.supportLine,
          proofLine: getDirectionProofLine(candidate, false),
          selectedProofLine: getDirectionProofLine(candidate, true),
          storySpinePreview: {
            start: getStorySpineStartLine(candidate, primaryVibe),
            highlight: getStorySpineHighlightLine(candidate),
            windDown: getStorySpineWindDownLine(candidate),
            whyThisWorks: getStorySpineWhyThisWorksLine(candidate),
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
          directionContractGateStatus: candidate.directionContractGateStatus,
          directionContractGateReasonSummary: candidate.directionContractGateReasonSummary,
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
          experienceContractReasonSummary: canonicalExperienceContract.debug.contractReasonSummary,
          contractConstraintsId: canonicalContractConstraints.id,
          contractConstraintsPeakCountModel: canonicalContractConstraints.peakCountModel,
          contractConstraintsMovementTolerance: canonicalContractConstraints.movementTolerance,
          contractConstraintsHighlightPressure: canonicalContractConstraints.highlightPressure,
          contractConstraintsRequireContinuity: canonicalContractConstraints.requireContinuity,
          contractConstraintsRequireRecoveryWindows:
            canonicalContractConstraints.requireRecoveryWindows,
          conciergeIntentId: canonicalConciergeIntent.id,
          conciergeIntentMode: canonicalConciergeIntent.intentMode,
          conciergeObjectivePrimary: canonicalConciergeIntent.objective.primary,
          conciergeControlPostureMode: canonicalConciergeIntent.controlPosture.mode,
          conciergeConstraintSwapTolerance:
            canonicalConciergeIntent.constraintPosture.swapTolerance,
          conciergeHint,
        },
      }
    }).filter((entry): entry is RealityDirectionCard => Boolean(entry))
  }, [
    canonicalConciergeIntent,
    canonicalContractConstraints,
    canonicalExperienceContract,
    contractAwareDistrictRanking,
    contractGateWorld,
    strategyAdmissibleWorlds,
    districtPreviewResult,
    persona,
    primaryVibe,
  ])
  const districtDiscoveryCards = useMemo(() => {
    const rankedSource =
      contractAwareDistrictRanking.ranked.length > 0
        ? contractAwareDistrictRanking.ranked
        : districtPreviewResult?.ranked ?? []
    const recommendationEntries = districtRecommendations
      .filter((recommendation) => Boolean(recommendation.tasteAggregation))
      .map((recommendation) => ({
        recommendation,
        lookupKeys: Array.from(
          new Set([
            ...buildDistrictLookupKeys(recommendation.districtId),
            ...buildDistrictLookupKeys(recommendation.label),
          ]),
        ),
        tokens: Array.from(
          new Set([
            ...buildDistrictLookupTokens(recommendation.label),
            ...buildDistrictLookupTokens(recommendation.districtId),
          ]),
        ),
      }))
    const recommendationByLookupKey = new Map<string, DistrictRecommendation>()
    recommendationEntries.forEach((entry) => {
      entry.lookupKeys.forEach((key) => {
        if (!recommendationByLookupKey.has(key)) {
          recommendationByLookupKey.set(key, entry.recommendation)
        }
      })
    })
    const directionCountByPocketId = new Map<string, number>()
    allDirectionCards.forEach((card) => {
      const pocketId = card.debugMeta?.pocketId ?? card.id
      directionCountByPocketId.set(pocketId, (directionCountByPocketId.get(pocketId) ?? 0) + 1)
    })
    const usedRecommendationIds = new Set<string>()
    const step2Candidates = rankedSource.slice(0, 6).map((entry) => {
      const profile = entry.profile
      const candidateLookupKeys = Array.from(
        new Set([
          ...buildDistrictLookupKeys(profile.meta.sourcePocketId),
          ...buildDistrictLookupKeys(profile.pocketId),
          ...buildDistrictLookupKeys(profile.label),
        ]),
      )
      let recommendation = candidateLookupKeys
        .map((key) => recommendationByLookupKey.get(key))
        .find((candidate): candidate is DistrictRecommendation => Boolean(candidate))
      if (!recommendation) {
        const candidateTokens = Array.from(
          new Set([
            ...buildDistrictLookupTokens(profile.meta.sourcePocketId),
            ...buildDistrictLookupTokens(profile.pocketId),
            ...buildDistrictLookupTokens(profile.label),
          ]),
        )
        const bestTokenMatch = recommendationEntries
          .map((entry) => ({
            recommendation: entry.recommendation,
            score: getDistrictTokenSubsetMatchScore(candidateTokens, entry.tokens),
          }))
          .filter((entry) => entry.score > 0)
          .sort((left, right) => {
            if (right.score !== left.score) {
              return right.score - left.score
            }
            if (right.recommendation.score !== left.recommendation.score) {
              return right.recommendation.score - left.recommendation.score
            }
            return left.recommendation.label.localeCompare(right.recommendation.label)
          })[0]
        recommendation = bestTokenMatch?.recommendation
      }
      if (recommendation) {
        usedRecommendationIds.add(recommendation.districtId)
      }
      return {
        entry,
        profile,
        recommendation,
      }
    })
    const remainingRecommendations = recommendationEntries
      .map((entry) => entry.recommendation)
      .filter((recommendation) => !usedRecommendationIds.has(recommendation.districtId))
    const fallbackQueue = remainingRecommendations
      .slice()
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    step2Candidates.forEach((candidate) => {
      if (candidate.recommendation) {
        return
      }
      const fallback = fallbackQueue.shift()
      if (fallback) {
        candidate.recommendation = fallback
        usedRecommendationIds.add(fallback.districtId)
      }
    })

    return step2Candidates.map((candidate) => {
      const { entry, profile, recommendation } = candidate
      const rankIndex = rankedSource.findIndex((rankedEntry) => rankedEntry.profile.pocketId === profile.pocketId)
      const densityValue = profile.coreSignals?.density
      const walkabilityValue = profile.coreSignals?.walkability
      const supportSignal =
        profile.hyperlocal?.whyHereSignals?.[0] ??
        profile.meta.originNotes?.[0] ??
        entry.reasons?.[0] ??
        'Clustered area supporting movement and variety'
      const supportedDirections = directionCountByPocketId.get(profile.pocketId) ?? 0
      const aggregation = recommendation?.tasteAggregation
      const signalDescription = describeDistrictSignals({
        density: densityValue,
        walkability: walkabilityValue,
        energyBand: profile.tasteSignals?.ambianceProfile?.energy,
        radiusM: profile.radiusM,
        supportSignal,
      })
      const summaryLine = aggregation
        ? getTasteAggregationSummaryLine(aggregation.summary)
        : `${signalDescription.movementStyle} ${signalDescription.energyPattern}`
      const anchorLine = aggregation
        ? getTasteAggregationAnchorLine(aggregation)
        : signalDescription.spatialFeel
      const ingredientLine = aggregation
        ? getTasteAggregationIngredientLine(aggregation)
        : signalDescription.supportSignal
      const matchSignal =
        rankIndex <= 0
          ? `Strong match for your ${selectedVibeLabel.toLowerCase()}, ${selectedPersonaLabel.toLowerCase()} intent`
          : signalDescription.movementStyle.toLowerCase().includes('short walks')
            ? 'Good alternative with tighter movement'
            : signalDescription.energyPattern.toLowerCase().includes('relaxed')
              ? 'Different direction with calmer pacing'
              : 'Alternative route with a different neighborhood rhythm'

      return {
        id: profile.pocketId,
        name: profile.label || 'Local district',
        summaryLine,
        anchorLine,
        ingredientLine,
        supportedDirections,
        rankLabel: rankIndex <= 0 ? 'Strong match' : 'Alternative',
        matchSignal,
        tasteAggregation: aggregation,
      }
    })
  }, [
    allDirectionCards,
    contractAwareDistrictRanking,
    districtRecommendations,
    districtPreviewResult,
    selectedPersonaLabel,
    selectedVibeLabel,
  ])

  const flexibleDistrictCardContent = useMemo(() => {
    const topAggregation = districtRecommendations.find(
      (recommendation) => Boolean(recommendation.tasteAggregation),
    )?.tasteAggregation
    if (topAggregation) {
      return {
        summaryLine: `Flexible mode: ${getTasteAggregationSummaryLine(topAggregation.summary).toLowerCase()}`,
        anchorLine: getTasteAggregationAnchorLine(topAggregation).replace(
          'Best anchor right now',
          'Top anchor across nearby areas',
        ),
        ingredientLine: getTasteAggregationIngredientLine(topAggregation),
      }
    }
    return {
      summaryLine: 'Blend of clustered and open pockets with steady energy.',
      anchorLine: 'Keeps movement flexible across nearby areas.',
      ingredientLine: 'Useful when you want options before committing.',
    }
  }, [districtRecommendations])

  const directionCardsByPocketId = useMemo(() => {
    const next = new Map<string, RealityDirectionCard[]>()
    allDirectionCards.forEach((card) => {
      const pocketId = card.debugMeta?.pocketId ?? card.id
      const current = next.get(pocketId) ?? []
      current.push(card)
      next.set(pocketId, current)
    })
    return next
  }, [allDirectionCards])

  const verifiedCityOpportunities = useMemo<VerifiedCityOpportunity[]>(() => {
    const scoredCards = districtDiscoveryCards
      .map((district) => {
        const representativeDirection = (
          directionCardsByPocketId.get(district.id) ?? []
        )
          .slice()
          .sort((left, right) => {
            const leftScore = left.debugMeta?.confidence ?? 0
            const rightScore = right.debugMeta?.confidence ?? 0
            if (rightScore !== leftScore) {
              return rightScore - leftScore
            }
            return left.id.localeCompare(right.id)
          })[0]
        const scenarioShapedAggregation = district.tasteAggregation
          ? applyScenarioContractToAggregation(district.tasteAggregation, activeScenarioContract)
          : undefined
        const experienceShapedAggregation = scenarioShapedAggregation
          ? applyExperienceContractToAggregation(
              scenarioShapedAggregation,
              activeTasteExperienceContract,
            )
          : undefined
        const aggregation = experienceShapedAggregation
          ? applyExplorationControlsToAggregation(experienceShapedAggregation, ecsState)
          : undefined
        const anchorCandidate = aggregation?.anchors.strongestHighlight
        const hasRealAnchor = Boolean(anchorCandidate?.venueId && anchorCandidate.venueName)
        if (!hasRealAnchor) {
          return null
        }
        const startCandidates = aggregation?.ingredients.startCandidates ?? []
        const closeCandidates = aggregation?.ingredients.windDownCandidates ?? []
        const hasSupportStructure = startCandidates.length > 0 || closeCandidates.length > 0
        if (!hasSupportStructure) {
          return null
        }

        const fallbackAnchorName =
          representativeDirection?.card.title ??
          aggregation?.ingredients.highlightCandidates[0]?.venueName ??
          district.name
        const anchorName = anchorCandidate?.venueName ?? fallbackAnchorName
        const confidenceLine = getNightOptionConfidenceLine(aggregation)
        const anchorMoment = getAnchorMoment(aggregation, anchorCandidate?.venueId)
        const starts = toCityOpportunityStopOptions(startCandidates, 'start')
        const closes = toCityOpportunityStopOptions(closeCandidates, 'windDown')
        const nearbyHappenings = getCityOpportunityHappenings(aggregation)
        const authoritySignals = buildCityOpportunityAuthoritySignals({
          aggregation,
          anchorMoment,
          starts,
          closes,
          happenings: nearbyHappenings,
          city: districtLocationQuery,
          persona,
          vibe: primaryVibe,
        })
        const whyTonightStrength = buildWhyTonightStrength({
          authoritySignals,
          happenings: nearbyHappenings,
          anchorMoment,
          aggregation,
        })
        const cozyAuthorityStrength = buildCozyAuthorityStrength({
          authoritySignals,
          anchorName,
          starts,
          closes,
          happenings: nearbyHappenings,
        })
        const highWhyTonight = whyTonightStrength >= 0.64
        const highCozyAuthority =
          isRomanticCozyMode({
            persona,
            vibe: primaryVibe,
            scenarioContract: activeScenarioContract,
          }) && cozyAuthorityStrength >= 0.62
        const whyTonightProofLine = buildWhyTonightProofLine({
          authoritySignals,
          whyTonightStrength,
          cozyAuthorityStrength,
          happenings: nearbyHappenings,
          scenarioContract: activeScenarioContract,
        })
        const hasSupportStops = starts.length > 0 && closes.length > 0
        const verificationReasons = getVerifiedAnchorReasons({
          aggregation,
          anchorMoment,
          confidenceLine,
          hasSupportStops,
        })
        const secondaryDistricts =
          ecsState.exploration === 'exploratory' || ecsState.discovery === 'discover'
            ? districtDiscoveryCards
                .filter((entry) => entry.id !== district.id)
                .map((entry) => entry.name)
                .filter(Boolean)
                .slice(0, 2)
            : undefined
        const card: VerifiedCityOpportunity = {
          id: `step2_city_opportunity_${district.id}`,
          flavor: getVerifiedOpportunityFlavor(
            aggregation,
            representativeDirection?.card.title ?? 'Intent-matched',
            activeScenarioContract,
          ),
          anchor: {
            venueId: anchorCandidate?.venueId ?? `anchor_${district.id}`,
            name: anchorName,
            district: district.name,
            sourceType: anchorMoment?.sourceType,
            timingLabel: getMomentTimingLabel(anchorMoment),
            verificationReasons,
          },
          starts,
          closes,
          nearbyHappenings,
          districtContext: {
            primaryDistrict: district.name,
            secondaryDistricts:
              secondaryDistricts && secondaryDistricts.length > 0 ? secondaryDistricts : undefined,
          },
          fit: {
            persona: selectedPersonaLabel,
            vibe: selectedVibeLabel,
            confidenceLine,
            matchLine: district.matchSignal,
          },
          storySpine: {
            start: starts[0]?.name ?? 'Nearby opener',
            highlight: anchorName,
            windDown: closes[0]?.name ?? 'Soft close nearby',
          },
          selection: {
            pocketId: district.id,
            directionId: representativeDirection?.id,
          },
          survivorSignals: {
            whyTonightStrength,
            cozyAuthorityStrength,
            highWhyTonight,
            highCozyAuthority,
          },
          excellence: {
            score: 0,
            threshold: 0,
            passes: false,
            anchorStrength: 0,
            startQuality: 0,
            windDownQuality: 0,
            supportCoherence: 0,
            scenarioAlignment: 0,
            experienceAlignment: 0,
            localAuthority: 0,
            modeExcellence: 0,
          },
          whyTonightProofLine,
        }
        const score = getCityOpportunitySurfaceScore({
          aggregation,
          anchorReasons: verificationReasons,
          anchorMoment,
          hasRealAnchor,
          starts,
          closes,
          happenings: nearbyHappenings,
          representativeDirection,
          ecsState,
          scenarioContract: activeScenarioContract,
          experienceContract: activeTasteExperienceContract,
          city: districtLocationQuery,
          persona,
          vibe: primaryVibe,
          authoritySignalsOverride: authoritySignals,
        })
        const anchorBaseScore =
          aggregation?.anchors.strongestHighlight?.score ??
          aggregation?.ingredients.highlightCandidates[0]?.score ??
          0.44
        const anchorStrength = clampScore(anchorBaseScore * 0.58 + authoritySignals.anchorConviction * 0.42)
        const startQuality = clampScore(
          getStopAverageScore(starts) * 0.58 +
            getRoleContractFitScore('start', starts, activeScenarioContract) * 0.22 +
            authoritySignals.startConviction * 0.2,
        )
        const windDownQuality = clampScore(
          getStopAverageScore(closes) * 0.54 +
            getRoleContractFitScore('windDown', closes, activeScenarioContract) * 0.22 +
            authoritySignals.windDownConviction * 0.24,
        )
        const scenarioAlignment = getScenarioAlignmentScore({
          contract: activeScenarioContract,
          aggregation,
          anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? anchorName,
          anchorMoment,
          starts,
          closes,
          happenings: nearbyHappenings,
        })
        const experienceAlignment = getExperienceContractAlignmentScore({
          contract: activeTasteExperienceContract,
          aggregation,
          starts,
          closes,
          happenings: nearbyHappenings,
        })
        const supportCoherence = getStorySpineCoherenceScore({
          aggregation,
          anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? anchorName,
          starts,
          closes,
          startQuality,
          windDownQuality,
        })
        const localAuthority = clampScore(
          authoritySignals.overallAuthority * 0.52 +
            authoritySignals.anchorConviction * 0.2 +
            authoritySignals.happeningAuthority * 0.12 +
            authoritySignals.whyTonightPressure * 0.16,
        )
        const modeExcellence = buildModeExcellenceStrength({
          scenarioContract: activeScenarioContract,
          authoritySignals,
          whyTonightStrength,
          cozyAuthorityStrength,
          anchorName,
          starts,
          closes,
        })
        const excellenceThreshold = buildStep2ExcellenceThreshold({
          scenarioContract: activeScenarioContract,
        })
        const excellenceScore = buildStep2ExcellenceScore({
          anchorStrength,
          startQuality,
          windDownQuality,
          supportCoherence,
          scenarioAlignment,
          experienceAlignment,
          localAuthority,
          whyTonightStrength,
          modeExcellence,
          existingSurfaceScore: score,
          scenarioContract: activeScenarioContract,
        })
        const passesExcellence = isStep2ExcellenceCandidate({
          excellenceScore,
          threshold: excellenceThreshold,
          anchorStrength,
          startQuality,
          windDownQuality,
          supportCoherence,
          scenarioContract: activeScenarioContract,
          modeExcellence,
        })
        card.excellence = {
          score: excellenceScore,
          threshold: excellenceThreshold,
          passes: passesExcellence,
          anchorStrength,
          startQuality,
          windDownQuality,
          supportCoherence,
          scenarioAlignment,
          experienceAlignment,
          localAuthority,
          modeExcellence,
        }
        return { card, score }
      })
      .filter((entry): entry is { card: VerifiedCityOpportunity; score: number } => Boolean(entry))

    const sortedCards = scoredCards
      .slice()
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }
        return left.card.id.localeCompare(right.card.id)
      })
      .map((entry) => entry.card)

    const deduped = dedupeCityOpportunityCards(sortedCards, ecsState)
    if (deduped.length > 0) {
      return deduped
    }
    return []
  }, [
    activeTasteExperienceContract,
    activeScenarioContract,
    districtLocationQuery,
    directionCardsByPocketId,
    districtDiscoveryCards,
    ecsState,
    persona,
    primaryVibe,
    selectedPersonaLabel,
    selectedVibeLabel,
  ])

  const scenarioBackedVerifiedCityOpportunities = useMemo<VerifiedCityOpportunity[]>(() => {
    if (!resolvedScenarioFamily || !scenarioCandidateBoard) {
      return []
    }
    return scenarioBuiltNights
      .map((night) =>
        mapBuiltScenarioNightToVerifiedOpportunity({
          night,
          districtDiscoveryCards,
          directionCards: allDirectionCards,
          personaLabel: selectedPersonaLabel,
          vibeLabel: selectedVibeLabel,
        }),
      )
      .filter((entry): entry is VerifiedCityOpportunity => Boolean(entry))
  }, [
    allDirectionCards,
    districtDiscoveryCards,
    resolvedScenarioFamily,
    scenarioBuiltNights,
    scenarioCandidateBoard,
    selectedPersonaLabel,
    selectedVibeLabel,
  ])

  const step2PrimarySourceOpportunities = useMemo<VerifiedCityOpportunity[]>(() => {
    // TODO(step2-integration): Scenario Builder output is the primary source of truth for supported families.
    if (resolvedScenarioFamily && scenarioBackedVerifiedCityOpportunities.length > 0) {
      return scenarioBackedVerifiedCityOpportunities
    }
    return verifiedCityOpportunities
  }, [resolvedScenarioFamily, scenarioBackedVerifiedCityOpportunities, verifiedCityOpportunities])

  const verifiedCityOpportunityById = useMemo(
    () =>
      new Map(step2PrimarySourceOpportunities.map((opportunity) => [opportunity.id, opportunity] as const)),
    [step2PrimarySourceOpportunities],
  )

  const scenarioPreviewModelByOpportunityId = useMemo(() => {
    // Boundary: for supported romantic flows, Step 3 should consume this engine-authored preview model directly.
    return new Map(
      step2PrimarySourceOpportunities
        .filter((opportunity) => Boolean(opportunity.scenarioPreviewModel))
        .map((opportunity) => [opportunity.id, opportunity.scenarioPreviewModel!] as const),
    )
  }, [step2PrimarySourceOpportunities])

  const step2BuiltNightCards = useMemo<Step2BuiltNightCard[]>(() => {
    if (resolvedScenarioFamily && scenarioBackedVerifiedCityOpportunities.length > 0) {
      return scenarioBackedVerifiedCityOpportunities.slice(0, 4).map((opportunity) => {
        const canonicalNight = opportunity.scenarioNight
        const canonicalStart = canonicalNight?.stops.find((stop) => stop.position === 'start')
        const canonicalHighlight = canonicalNight?.stops.find((stop) => stop.position === 'highlight')
        const canonicalWindDown =
          canonicalNight?.stops.find((stop) => stop.position === 'closer') ??
          canonicalNight?.stops[canonicalNight.stops.length - 1]
        const secondaryDistrictContext =
          opportunity.districtContext.secondaryDistricts &&
          opportunity.districtContext.secondaryDistricts.length > 0
            ? ` / ${opportunity.districtContext.secondaryDistricts.join(', ')}`
            : ''
        return {
          id: opportunity.id,
          anchorName: opportunity.anchor.name,
          flavorLine: opportunity.flavor,
          traits: buildStep2CardTraits(opportunity, ecsState),
          // Boundary: use canonical Scenario Builder stop sequence when available.
          storySpine: {
            start: canonicalStart?.name ?? opportunity.storySpine.start,
            highlight: canonicalHighlight?.name ?? opportunity.storySpine.highlight,
            windDown: canonicalWindDown?.name ?? opportunity.storySpine.windDown,
          },
          districtLine: `Mostly in ${opportunity.districtContext.primaryDistrict}${secondaryDistrictContext}`,
          whyChooseLine:
            canonicalHighlight?.whyThisStop ??
            opportunity.fit.confidenceLine,
          whyTonightProofLine: opportunity.whyTonightProofLine,
          scenarioEvaluation: canonicalNight?.evaluation,
          selection: opportunity.selection,
        }
      })
    }

    const survivors = selectStep2ExcellentSurvivors({
      rankedCards: verifiedCityOpportunities,
      persona,
      vibe: primaryVibe,
      scenarioContract: activeScenarioContract,
    })
    // Legacy fallback path for unsupported flows; semantic reconstruction remains here intentionally.
    return survivors.map((opportunity) => {
      const secondaryDistrictContext =
        opportunity.districtContext.secondaryDistricts &&
        opportunity.districtContext.secondaryDistricts.length > 0
          ? ` / ${opportunity.districtContext.secondaryDistricts.join(', ')}`
          : ''
      const repairedStorySpine = validateOrRepairStep2StorySpine(opportunity)
      return {
        id: opportunity.id,
        anchorName: opportunity.anchor.name,
        flavorLine: opportunity.flavor,
        traits: buildStep2CardTraits(opportunity, ecsState),
        storySpine: repairedStorySpine,
        districtLine: `Mostly in ${opportunity.districtContext.primaryDistrict}${secondaryDistrictContext}`,
        whyChooseLine:
          opportunity.anchor.verificationReasons[0] ??
          opportunity.fit.matchLine ??
          opportunity.fit.confidenceLine,
        whyTonightProofLine: opportunity.whyTonightProofLine,
        selection: opportunity.selection,
      }
    })
  }, [
    activeScenarioContract,
    ecsState,
    persona,
    primaryVibe,
    resolvedScenarioFamily,
    scenarioBackedVerifiedCityOpportunities,
    verifiedCityOpportunities,
  ])

  const directionView = useMemo(() => {
    if (activeDistrictPocketId === ALL_DISTRICTS_CONTEXT_ID) {
      return {
        cards: allDirectionCards,
        mode: 'all' as const,
      }
    }
    const exactPocketMatches = allDirectionCards.filter((card) => {
      const pocketId = card.debugMeta?.pocketId ?? card.id
      return pocketId === activeDistrictPocketId
    })
    if (exactPocketMatches.length > 0) {
      return {
        cards: exactPocketMatches,
        mode: 'district_exact' as const,
      }
    }

    const selectedDistrictLabel =
      districtDiscoveryCards.find((district) => district.id === activeDistrictPocketId)?.name?.toLowerCase() ??
      ''
    if (selectedDistrictLabel.length > 0) {
      const labelBiasMatches = allDirectionCards.filter((card) => {
        const summary = card.debugMeta?.directionDistrictSupportSummary?.toLowerCase() ?? ''
        return summary.includes(selectedDistrictLabel)
      })
      if (labelBiasMatches.length > 0) {
        return {
          cards: labelBiasMatches,
          mode: 'district_bias' as const,
        }
      }
    }

    return {
      cards: allDirectionCards,
      mode: 'district_fallback' as const,
    }
  }, [activeDistrictPocketId, allDirectionCards, districtDiscoveryCards])
  const directionCards = directionView.cards

  const activeDistrictLabel = useMemo(() => {
    if (activeDistrictPocketId === ALL_DISTRICTS_CONTEXT_ID) {
      return null
    }
    return (
      districtDiscoveryCards.find((district) => district.id === activeDistrictPocketId)?.name ?? null
    )
  }, [activeDistrictPocketId, districtDiscoveryCards])

  const directionContextLine = useMemo(() => {
    if (!activeDistrictLabel || directionView.mode === 'all') {
      return 'Flexible mode - using multiple strong nearby areas'
    }
    return `Building from ${activeDistrictLabel}`
  }, [activeDistrictLabel, directionView.mode])
  const directionCountLine = useMemo(() => {
    if (directionView.mode === 'all') {
      return 'Showing strongest routes across nearby areas'
    }
    if (directionCards.length === 1) {
      return '1 strong route matches this area'
    }
    return `${directionCards.length} routes match this area`
  }, [directionCards.length, directionView.mode])

  const directionIdentityById = useMemo(
    () =>
      new Map(
        directionCards.map((entry) => [entry.id, buildDirectionIdentity(entry)] as const),
      ),
    [directionCards],
  )
  const directionSetKey = useMemo(
    () => `${persona}|${primaryVibe}|${directionCards.map((entry) => entry.id).join('|')}`,
    [directionCards, persona, primaryVibe],
  )
  const selectedDirection = useMemo(
    () =>
      selectedDirectionId
        ? directionCards.find((entry) => entry.id === selectedDirectionId)
        : undefined,
    [directionCards, selectedDirectionId],
  )
  const selectedDirectionGreatStopSignal = useMemo(
    () =>
      getGreatStopSignalForDirection({
        direction: selectedDirection,
        opportunities: step2PrimarySourceOpportunities,
      }),
    [selectedDirection, step2PrimarySourceOpportunities],
  )
  const selectedDirectionContract = useMemo(
    () =>
      buildDirectionPlanningSelectionFromCard(
        selectedDirection,
        selectedDirectionGreatStopSignal,
      ),
    [selectedDirection, selectedDirectionGreatStopSignal],
  )
  const selectedDirectionContext = useMemo(
    () => buildResolvedDirectionContext(selectedDirectionContract),
    [selectedDirectionContract],
  )
  const selectedRouteShapeContract = useMemo(
    () =>
      selectedDirectionContract && selectedDirectionContext
        ? buildRouteShapeContract({
            selectedDirection: selectedDirectionContract,
            selectedDirectionContext,
            conciergeIntent: canonicalConciergeIntent,
            contractConstraints: canonicalContractConstraints,
          })
        : undefined,
    [
      canonicalConciergeIntent,
      canonicalContractConstraints,
      selectedDirectionContext,
      selectedDirectionContract,
    ],
  )
  const userSelectedOverrideActive = Boolean(
    selectedDirectionId &&
      userSelectedDirection &&
      userSelectedDirection.setKey === directionSetKey &&
      userSelectedDirection.directionId === selectedDirectionId,
  )
  const generatePlan = useCallback(
    async (directionIdOverride?: string | unknown) => {
      const selectionEpochAtStart = selectionEpochRef.current
      const normalizedDirectionOverride =
        typeof directionIdOverride === 'string' ? directionIdOverride : null
      const activeDirectionId = normalizedDirectionOverride ?? selectedDirectionId
      if (!activeDirectionId) {
        return false
      }
      const activeDirection = directionCards.find((entry) => entry.id === activeDirectionId)
      if (!activeDirection) {
        return false
      }
      const activeDirectionGreatStopSignal = getGreatStopSignalForDirection({
        direction: activeDirection,
        opportunities: step2PrimarySourceOpportunities,
      })
      const activeDirectionContract = buildDirectionPlanningSelectionFromCard(
        activeDirection,
        activeDirectionGreatStopSignal,
      )
      if (!activeDirectionContract) {
        setError('Direction contract is unavailable. Re-select a direction and try again.')
        return false
      }
      const activeDirectionContext = buildResolvedDirectionContext(activeDirectionContract)
      if (!activeDirectionContext) {
        setError('Direction context is unavailable. Re-select a direction and try again.')
        return false
      }
      const activeRouteShapeContract = buildRouteShapeContract({
        selectedDirection: activeDirectionContract,
        selectedDirectionContext: activeDirectionContext,
        conciergeIntent: canonicalConciergeIntent,
        contractConstraints: canonicalContractConstraints,
      })
      const activeIntentSelectedDirectionContext =
        buildIntentSelectedDirectionContextEngine(activeDirectionContract)
      if (!activeIntentSelectedDirectionContext) {
        setError('Direction context is unavailable. Re-select a direction and try again.')
        return false
      }
      const activeContractConstraints = canonicalContractConstraints
      const activeCluster = activeDirection.cluster
      if (!activeCluster) {
        return false
      }
      if (!districtLocationQuery) {
        setError('Enter a location before generating a plan.')
        return false
      }
      if (unresolvedLocationReason) {
        setError(unresolvedLocationReason)
        return false
      }
      if (districtPreviewResult && districtPreviewResult.ranked.length === 0) {
        setError('No viable districts for this location. Update the location and try again.')
        return false
      }
      setLoading(true)
      setError(undefined)
      setIsLocking(false)
      setHasRevealed(false)
      setPreviewSwap(undefined)
      setSwapDebugBreadcrumb(null)
      setSwapInteractionBreadcrumb(null)
      setSwapCompatibilityDebug(null)
      setGenerationContractDebug(null)
      setAppliedSwapRole(null)
      setNearbySummaryByRole({})
      setCanonicalStopByRole({})
      setRejectedStopRoles([])

      try {
        const selectedClusterConfirmation = activeDirection.card.confirmation
        const selectedDirectionPreviewContext =
          buildSelectedDirectionPreviewContext(activeDirection)
        // Wrapper seam: selectedDirectionContext is engine-authored; display fields stay out of planning truth.
        assertCanonicalSelectedDirectionContext({
          wrapperSeam: 'sandbox_concierge.generate',
          input: { selectedDirectionContext: activeIntentSelectedDirectionContext },
        })
        const result = await runGeneratePlan(
          {
            mode: 'build',
            planningMode: 'engine-led',
            persona,
            primaryVibe,
            city: districtLocationQuery,
            district: activeDirectionContract.pocketLabel,
            distanceMode: 'nearby',
            refinementModes: clusterRefinementMap[activeCluster],
            selectedDirectionContext: activeIntentSelectedDirectionContext,
          },
          {
            sourceMode: 'curated',
            sourceModeOverrideApplied: true,
            debugMode: false,
            experienceContract: canonicalExperienceContract,
            contractConstraints: canonicalContractConstraints,
          },
        )
        enforceSelectedDirectionLineage({
          wrapperSeam: 'sandbox_concierge.generate',
          expectedDirectionId: activeDirectionContract.id,
          actualSelectedDirectionContext: result.intentProfile.selectedDirectionContext,
          errorMessage:
            'Route drifted from selected direction contract. Direction context was not preserved.',
        })
        const strongCurationPass = applyStrongCurationTastePass({
          itinerary: result.itinerary,
          selectedArc: result.selectedArc,
          scoredVenues: result.scoredVenues,
          intentProfile: result.intentProfile,
          lens: result.lens,
          contractConstraints: activeContractConstraints,
        })
        const anchoredPlan = await enforceFullStopRealityContract({
          itinerary: strongCurationPass.itinerary,
          selectedArc: strongCurationPass.selectedArc,
          scoredVenues: strongCurationPass.scoredVenues,
          intentProfile: result.intentProfile,
          lens: result.lens,
        })
        const tasteCurationDebug = buildTasteCurationDebugForArc({
          selectedArc: anchoredPlan.selectedArc,
          qualificationByCandidateId: strongCurationPass.qualificationByCandidateId,
          personaVibeTasteBiasSummary: strongCurationPass.personaVibeTasteBiasSummary,
          thinPoolHighlightFallbackApplied:
            strongCurationPass.thinPoolHighlightFallbackApplied,
          highlightPoolCountBefore: strongCurationPass.highlightPoolCountBefore,
          highlightPoolCountAfter: strongCurationPass.highlightPoolCountAfter,
          rolePoolCountByRoleBefore: strongCurationPass.rolePoolCountByRoleBefore,
          rolePoolCountByRoleAfter: strongCurationPass.rolePoolCountByRoleAfter,
          signatureHighlightShortlistCount:
            strongCurationPass.signatureHighlightShortlistCount,
          signatureHighlightShortlistIds: strongCurationPass.signatureHighlightShortlistIds,
          highlightShortlistScoreSummary: strongCurationPass.highlightShortlistScoreSummary,
          selectedHighlightFromShortlist:
            strongCurationPass.selectedHighlightFromShortlist,
          selectedHighlightShortlistRank:
            strongCurationPass.selectedHighlightShortlistRank,
          fallbackToQualifiedHighlightPool:
            strongCurationPass.fallbackToQualifiedHighlightPool,
          upstreamPoolSelectionApplied: strongCurationPass.upstreamPoolSelectionApplied,
          postGenerationRepairCount: strongCurationPass.postGenerationRepairCount,
          rolePoolVenueIdsByRole: strongCurationPass.rolePoolVenueIdsByRole,
          rolePoolVenueIdsCombined: strongCurationPass.rolePoolVenueIdsCombined,
          thinPoolRelaxationTrace: strongCurationPass.thinPoolRelaxationTrace,
        })
        const canonicalItinerary = applyCanonicalIdentityToItinerary(
          anchoredPlan.itinerary,
          anchoredPlan.canonicalStopByRole,
        )
        const expectedDirectionIdentity =
          activeDirectionContext.identity ?? activeDirectionContract.identity ?? 'exploratory'
        const contractBuildability = assessDirectionContractBuildability({
          expectedDirectionIdentity,
          scoredVenues: strongCurationPass.scoredVenues,
        })
        const directionValidation = validateDirectionRouteContract({
          selectedDirectionContext: activeDirectionContext,
          selectedDirection: activeDirectionContract,
          itinerary: canonicalItinerary,
          buildability: contractBuildability,
        })
        setGenerationContractDebug({
          generationDriftReason: directionValidation.generationDriftReason,
          missingRoleForContract: directionValidation.missingRoleForContract,
          contractBuildabilityStatus: directionValidation.contractBuildabilityStatus,
          candidatePoolSufficiencyByRole: directionValidation.candidatePoolSufficiencyByRole,
          expectedDirectionIdentity: directionValidation.expectedDirectionIdentity,
          observedDirectionIdentity: directionValidation.observedDirectionIdentity,
          fallbackApplied: directionValidation.fallbackApplied,
          thinPoolRelaxationTrace: directionValidation.thinPoolRelaxationTrace,
        })
        if (!directionValidation.valid) {
          throw new Error('Route drifted from selected direction contract. Please regenerate.')
        }
        const nextFinalRoute = buildFinalRoute({
          itinerary: canonicalItinerary,
          canonicalStopByRole: anchoredPlan.canonicalStopByRole,
          selectedDirectionId: activeDirectionContract.id,
          city: districtLocationQuery,
          persona,
          vibe: primaryVibe,
          activeRole: 'start',
          selectedCluster: activeCluster,
          selectedDirectionPreviewContext,
        })
        if (!nextFinalRoute) {
          throw new Error('Route commit failed: one or more stops are missing canonical identity.')
        }
        if (nextFinalRoute.selectedDirectionId !== activeDirectionContract.id) {
          throw new Error('Route drifted from selected direction contract. Please regenerate.')
        }
        if (selectionEpochRef.current !== selectionEpochAtStart) {
          return false
        }
        setPlan({
          itinerary: canonicalItinerary,
          selectedArc: anchoredPlan.selectedArc,
          scoredVenues: strongCurationPass.scoredVenues,
          generationTrace: result.trace,
          intentProfile: result.intentProfile,
          lens: result.lens,
          conciergeIntent: canonicalConciergeIntent,
          experienceContract: canonicalExperienceContract,
          contractConstraints: activeContractConstraints,
          selectedDirectionContext: activeDirectionContext,
          selectedCluster: activeCluster,
          selectedClusterConfirmation,
          selectedDirectionContract: activeDirectionContract,
          routeShapeContract: activeRouteShapeContract,
          tasteCurationDebug,
          selectedDirectionPreviewContext,
        })
        updateFinalRoute(nextFinalRoute)
        setCanonicalStopByRole(anchoredPlan.canonicalStopByRole)
        setRejectedStopRoles(anchoredPlan.rejectedStopRoles)
        setActiveRole('start')
        setNearbySummaryByRole({})
        autoDirectionSyncAttemptRef.current = null
        return true
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : 'Failed to generate plan.',
        )
        return false
      } finally {
        setLoading(false)
      }
    },
    [
      canonicalConciergeIntent,
      canonicalContractConstraints,
      canonicalExperienceContract,
      directionCards,
      districtLocationQuery,
      districtPreviewResult,
      persona,
      primaryVibe,
      selectedDirectionId,
      step2PrimarySourceOpportunities,
      unresolvedLocationReason,
      updateFinalRoute,
    ],
  )

  const handleSelectDirection = useCallback(
    (directionId: string) => {
      const directionChanged = selectedDirectionId !== directionId
      setSelectedDirectionId(directionId)
      setUserSelectedDirection(
        directionSetKey.length > 0
          ? {
              setKey: directionSetKey,
              directionId,
            }
          : null,
      )
      setSelectedIdReconciled(false)
      setSwapDebugBreadcrumb(null)
      setSwapInteractionBreadcrumb(null)
      setSwapCompatibilityDebug(null)
      setGenerationContractDebug(null)
      if (directionChanged) {
        selectionEpochRef.current += 1
        autoDirectionSyncAttemptRef.current = null
        setLoading(false)
        setHasRevealed(false)
        setPreviewSwap(undefined)
        setExpandedRole(null)
        setAppliedSwapRole(null)
        setNearbySummaryByRole({})
        setCanonicalStopByRole({})
        setRejectedStopRoles([])
        setPlan(undefined)
        updateFinalRoute(null)
        setError(undefined)
      }
    },
    [directionSetKey, selectedDirectionId, updateFinalRoute],
  )

  const handleSelectStep2NightOption = useCallback(
    (option: VerifiedCityOpportunity) => {
      const optionPocketId = option.selection.pocketId
      const optionDirectionId = option.selection.directionId
      if (optionPocketId && activeDistrictPocketId !== optionPocketId) {
        setActiveDistrictPocketId(optionPocketId)
      }
      if (optionDirectionId) {
        handleSelectDirection(optionDirectionId)
        return
      }
      if (!optionPocketId) {
        const fallback = allDirectionCards[0]
        if (fallback) {
          handleSelectDirection(fallback.id)
        }
        return
      }
      const fallbackDirection = allDirectionCards.find((entry) => {
        const pocketId = entry.debugMeta?.pocketId ?? entry.id
        return pocketId === optionPocketId
      })
      if (fallbackDirection) {
        handleSelectDirection(fallbackDirection.id)
      }
    },
    [activeDistrictPocketId, allDirectionCards, handleSelectDirection],
  )

  const handlePreviewShape = useCallback(
    (intent: PreviewShapeIntent) => {
      if (directionCards.length === 0) {
        return
      }
      const baseline = selectedDirection ?? directionCards[0]
      const action = PREVIEW_SHAPE_ACTIONS.find((entry) => entry.intent === intent)
      if (!baseline || !action) {
        return
      }

      const ranked = directionCards
        .map((entry) => ({
          entry,
          score: scorePreviewShapeCandidate(entry, intent, baseline),
        }))
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score
          }
          return left.entry.id.localeCompare(right.entry.id)
        })
      const currentScore = scorePreviewShapeCandidate(baseline, intent, baseline)
      const best =
        ranked.find(({ entry }) => intent !== 'different_centerpiece' || entry.id !== baseline.id) ??
        ranked[0]
      setActivePreviewShapeIntent(intent)
      if (
        best &&
        best.entry.id !== baseline.id &&
        (intent === 'different_centerpiece' || best.score >= currentScore)
      ) {
        setPreviewFeedback(action.appliedFeedback)
        handleSelectDirection(best.entry.id)
        return
      }
      setPreviewFeedback(action.stableFeedback)
    },
    [directionCards, handleSelectDirection, selectedDirection],
  )
  const handlePreviewAdjustRoleToggle = useCallback(
    async (role: PreviewAdjustableRole) => {
      if (expandedRole === role) {
        setExpandedRole(null)
        return
      }
      setExpandedRole(role)
      if (plan || loading || !selectedDirectionId) {
        return
      }
      const generated = await generatePlan(selectedDirectionId)
      if (!generated) {
        return
      }
      setExpandedRole(role)
    },
    [expandedRole, generatePlan, loading, plan, selectedDirectionId],
  )

  useEffect(() => {
    const currentDirectionId = selectedDirectionId ?? plan?.selectedDirectionContract.id ?? null
    if (!plan || !finalRoute || loading || !currentDirectionId) {
      return
    }
    if (finalRoute.selectedDirectionId === currentDirectionId) {
      autoDirectionSyncAttemptRef.current = null
      return
    }
    if (autoDirectionSyncAttemptRef.current === currentDirectionId) {
      return
    }
    autoDirectionSyncAttemptRef.current = currentDirectionId
    void (async () => {
      const synced = await generatePlan(currentDirectionId)
      if (!synced) {
        setError(
          (current) =>
            current ??
            'Direction sync mismatch persisted. Re-select a direction and generate again.',
        )
      }
    })()
  }, [finalRoute, generatePlan, loading, plan, selectedDirectionId])

  useEffect(() => {
    setHasRevealed(false)
    setIsLocking(false)
    setActiveDistrictPocketId(ALL_DISTRICTS_CONTEXT_ID)
    setPreviewSwap(undefined)
    setSwapDebugBreadcrumb(null)
    setSwapInteractionBreadcrumb(null)
    setSwapCompatibilityDebug(null)
    setGenerationContractDebug(null)
    setAppliedSwapRole(null)
    setNearbySummaryByRole({})
    setCanonicalStopByRole({})
    setRejectedStopRoles([])
    setPlan(undefined)
    updateFinalRoute(null)
    setError(undefined)
  }, [districtLocationQuery, persona, primaryVibe, updateFinalRoute])

  useEffect(() => {
    if (activeDistrictPocketId === ALL_DISTRICTS_CONTEXT_ID) {
      return
    }
    const stillExists = districtDiscoveryCards.some((district) => district.id === activeDistrictPocketId)
    if (!stillExists) {
      setActiveDistrictPocketId(ALL_DISTRICTS_CONTEXT_ID)
    }
  }, [activeDistrictPocketId, districtDiscoveryCards])

  useEffect(() => {
    if (directionCards.length === 0 || directionSetKey.length === 0) {
      setSelectedDirectionId(null)
      setUserSelectedDirection(null)
      setSelectedIdReconciled(false)
      setSwapDebugBreadcrumb(null)
      setSwapInteractionBreadcrumb(null)
      setSwapCompatibilityDebug(null)
      setGenerationContractDebug(null)
      updateFinalRoute(null)
      previousDirectionIdentityRef.current = new Map()
      previousPersonaVibeRef.current = { persona, vibe: primaryVibe }
      return
    }

    const previousPersonaVibe = previousPersonaVibeRef.current
    const personaOrVibeChanged = Boolean(
      previousPersonaVibe &&
        (previousPersonaVibe.persona !== persona || previousPersonaVibe.vibe !== primaryVibe),
    )
    const previousIdentityById = previousDirectionIdentityRef.current
    const firstCandidateId = directionCards[0]?.id ?? null
    const selectedStillExists = Boolean(
      selectedDirectionId && directionIdentityById.has(selectedDirectionId),
    )

    let nextSelectedDirectionId = selectedDirectionId
    if (!selectedStillExists) {
      nextSelectedDirectionId = firstCandidateId
    } else if (personaOrVibeChanged && selectedDirectionId) {
      const previousIdentity = previousIdentityById.get(selectedDirectionId)
      const nextIdentity = directionIdentityById.get(selectedDirectionId)
      if (!previousIdentity || !nextIdentity || previousIdentity !== nextIdentity) {
        nextSelectedDirectionId = firstCandidateId
      }
    }

    if (!nextSelectedDirectionId) {
      nextSelectedDirectionId = firstCandidateId
    }

    const reconciled = nextSelectedDirectionId !== selectedDirectionId
    if (reconciled) {
      selectionEpochRef.current += 1
      autoDirectionSyncAttemptRef.current = null
      setGenerationContractDebug(null)
      setSelectedDirectionId(nextSelectedDirectionId)
      setUserSelectedDirection(null)
    } else if (
      userSelectedDirection &&
      (userSelectedDirection.setKey !== directionSetKey ||
        userSelectedDirection.directionId !== selectedDirectionId)
    ) {
      setUserSelectedDirection(null)
    }
    setSelectedIdReconciled(reconciled)
    previousDirectionIdentityRef.current = new Map(directionIdentityById)
    previousPersonaVibeRef.current = { persona, vibe: primaryVibe }
  }, [
    directionCards,
    directionIdentityById,
    directionSetKey,
    persona,
    primaryVibe,
    selectedDirectionId,
    updateFinalRoute,
    userSelectedDirection,
  ])

  useEffect(() => {
    let cancelled = false
    setDistrictPreviewLoading(true)
    setDistrictPreviewError(undefined)

    const timeoutHandle = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await buildDistrictOpportunityProfiles({
            locationQuery: districtLocationQuery,
            includeDebug: true,
          })
          if (!cancelled) {
            setDistrictPreviewResult(result)
            setDistrictPreviewError(
              result.location.source === 'unresolved_query'
                ? result.location.meta.unresolvedReason ?? 'Could not resolve location.'
                : undefined,
            )
          }
        } catch (nextError) {
          console.error(nextError)
          if (!cancelled) {
            setDistrictPreviewError(
              nextError instanceof Error
                ? nextError.message
                : 'Failed to load district preview.',
            )
          }
        } finally {
          if (!cancelled) {
            setDistrictPreviewLoading(false)
          }
        }
      })()
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutHandle)
    }
  }, [districtLocationQuery])

  useEffect(() => {
    let cancelled = false
    if (!districtLocationQuery) {
      setDistrictRecommendations([])
      return () => {
        cancelled = true
      }
    }

    const timeoutHandle = window.setTimeout(() => {
      void (async () => {
        try {
          const previewResult = await previewDistrictRecommendations({
            persona,
            primaryVibe,
            city: districtLocationQuery,
            distanceMode: 'nearby',
          })
          if (!cancelled) {
            setDistrictRecommendations(previewResult.recommendedDistricts)
          }
        } catch (nextError) {
          console.error(nextError)
          if (!cancelled) {
            setDistrictRecommendations([])
          }
        }
      })()
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutHandle)
    }
  }, [districtLocationQuery, persona, primaryVibe])

  const handleNearbySummaryChange = useCallback(
    (role: UserStopRole, summary: string | null) => {
      setNearbySummaryByRole((current) => {
        if (!summary) {
          if (!(role in current)) {
            return current
          }
          const next = { ...current }
          delete next[role]
          return next
        }
        if (current[role] === summary) {
          return current
        }
        return {
          ...current,
          [role]: summary,
        }
      })
    },
    [],
  )

  const handlePreviewAlternative = useCallback(async (role: UserStopRole, venueId: string) => {
    console.log('[SWAP CLICK]', venueId)
    const markPreviewGuardFailure = (reason: string, message: string) => {
      console.warn('[SWAP PREVIEW GUARD]', {
        reason,
        role,
        replacementId: venueId,
      })
      setSwapInteractionBreadcrumb((current) => ({
        swapClickFired: current?.swapClickFired ?? true,
        swapHandlerEntered: true,
        swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId ?? null,
        swapCandidateCanonicalIdentityAtClick:
          current?.swapCandidateCanonicalIdentityAtClick ?? null,
        candidateHasCanonicalIdentity: current?.candidateHasCanonicalIdentity ?? null,
        swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
        swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? role,
        swapGuardFailureReason: reason,
        swapCommitStarted: false,
        swapCommitFinished: false,
        swapModalClosedAfterCommit: false,
      }))
      setError(message)
    }

    setSwapInteractionBreadcrumb({
      swapClickFired: true,
      swapHandlerEntered: true,
      swapCandidateAtClickId: venueId ?? null,
      swapCandidateCanonicalIdentityAtClick: null,
      candidateHasCanonicalIdentity: null,
      swapTargetSlotIndexAtClick: null,
      swapTargetRoleAtClick: role,
      swapGuardFailureReason: null,
      swapCommitStarted: false,
      swapCommitFinished: false,
      swapModalClosedAfterCommit: false,
    })

    const activePlan = planRef.current
    const activeFinalRoute = finalRouteRef.current
    if (!activePlan) {
      markPreviewGuardFailure('plan_missing_at_click', 'Swap preview did not start: plan missing at click.')
      return
    }
    if (!activeFinalRoute) {
      markPreviewGuardFailure(
        'final_route_missing_at_click',
        'Swap preview did not start: final route missing at click.',
      )
      return
    }

    setError(undefined)
    try {
      const replacement = activePlan.scoredVenues.find((candidate) => candidate.venue.id === venueId)
      const originalStop = activePlan.itinerary.stops.find((stop) => stop.role === role)
      const targetRouteStop = activeFinalRoute.stops.find((stop) => stop.role === role)
      if (!replacement) {
        markPreviewGuardFailure(
          'replacement_missing_in_plan',
          `Swap preview did not start: replacement ${venueId} is not in the current plan.`,
        )
        return
      }
      if (!originalStop) {
        markPreviewGuardFailure(
          'original_stop_missing_for_role',
          `Swap preview did not start: original ${role} stop is missing.`,
        )
        return
      }
      if (!targetRouteStop) {
        markPreviewGuardFailure(
          'target_route_stop_missing_for_role',
          `Swap preview did not start: target route stop for ${role} is missing.`,
        )
        return
      }
      setSwapInteractionBreadcrumb((current) => ({
        swapClickFired: current?.swapClickFired ?? true,
        swapHandlerEntered: true,
        swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId,
        swapCandidateCanonicalIdentityAtClick:
          current?.swapCandidateCanonicalIdentityAtClick ?? null,
        candidateHasCanonicalIdentity: current?.candidateHasCanonicalIdentity ?? null,
        swapTargetSlotIndexAtClick: targetRouteStop.stopIndex,
        swapTargetRoleAtClick: targetRouteStop.role,
        swapGuardFailureReason: null,
        swapCommitStarted: false,
        swapCommitFinished: false,
        swapModalClosedAfterCommit: false,
      }))
      setSwapDebugBreadcrumb({
        swapTargetSlotIndex: targetRouteStop.stopIndex,
        swapTargetRole: targetRouteStop.role,
        swapBeforeStopId: targetRouteStop.id,
        swapRequestedReplacementId: replacement.venue.id,
        swapAppliedReplacementId: null,
        swapCommitSucceeded: false,
        swapRenderSource: 'finalRoute',
        routeVersion: routeVersionRef.current,
        mismatch: false,
      })

      const crewPolicy = getCrewPolicy(activePlan.intentProfile.crew)
      const swappedArc = swapArcStop({
        currentArc: activePlan.selectedArc,
        role: inverseRoleProjection[role],
        replacement,
        intent: activePlan.intentProfile,
        crewPolicy,
        lens: activePlan.lens,
      })
      if (!swappedArc) {
        markPreviewGuardFailure(
          'swap_arc_projection_failed',
          `Swap preview did not start: ${venueId} cannot project into the ${role} role.`,
        )
        return
      }
      const swappedItinerary = projectItinerary(swappedArc, activePlan.intentProfile, activePlan.lens)
      const candidateStop = swappedItinerary.stops.find((stop) => stop.role === role)
      if (!candidateStop) {
        markPreviewGuardFailure(
          'candidate_stop_missing_after_projection',
          `Swap preview did not start: projected ${role} stop is missing for ${venueId}.`,
        )
        return
      }
      if (candidateStop.venueId !== replacement.venue.id) {
        throw new Error('Swap preview mismatch: selected venue did not resolve to the requested role.')
      }
      const replacementCanonicalFromCandidate =
        swapCanonicalIdentityByVenueIdRef.current[replacement.venue.id] ??
        resolveCanonicalPlanningStopIdentityFromScoredVenue(candidateStop, replacement)
      setSwapInteractionBreadcrumb((current) => ({
        swapClickFired: current?.swapClickFired ?? true,
        swapHandlerEntered: true,
        swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId,
        swapCandidateCanonicalIdentityAtClick:
          replacementCanonicalFromCandidate?.providerRecordId ?? null,
        candidateHasCanonicalIdentity: Boolean(replacementCanonicalFromCandidate),
        swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? targetRouteStop.stopIndex,
        swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? targetRouteStop.role,
        swapGuardFailureReason: null,
        swapCommitStarted: false,
        swapCommitFinished: false,
        swapModalClosedAfterCommit: false,
      }))
      const replacementCanonical =
        replacementCanonicalFromCandidate ??
        (await resolveCanonicalPlanningStopIdentity(candidateStop, replacement))
      if (!replacementCanonical) {
        markPreviewGuardFailure(
          'replacement_canonical_identity_missing',
          'This swap option is missing canonical place identity and cannot be previewed.',
        )
        return
      }
      const originalCanonical = canonicalStopByRoleRef.current[role]
      const originalDisplay = resolvePlanningStopDisplay(
        originalStop,
        findScoredVenueForStop(originalStop, activePlan.selectedArc),
      )
      const candidateStopForDisplay: ItineraryStop = {
        ...candidateStop,
        venueName: replacementCanonical.displayName,
      }
      const candidateNarrative = getInlineStopNarrative(
        candidateStopForDisplay,
        activePlan.intentProfile,
        {
          scoredVenue: findScoredVenueForStop(candidateStop, swappedArc),
          roleTravelWindowMinutes: getRoleTravelWindow(swappedItinerary, role),
          itineraryStops: swappedItinerary.stops,
          experienceContract: activePlan.experienceContract,
          contractConstraints: activePlan.contractConstraints,
        },
      )
      const originalTravel = getRoleTravelWindow(activePlan.itinerary, role)
      const candidateTravel = getRoleTravelWindow(swappedItinerary, role)
      const travelDelta = Math.round(candidateTravel - originalTravel)
      const constraintSignal =
        travelDelta >= 2
          ? `Adds ~${travelDelta} min travel.`
          : travelDelta <= -2
            ? `Saves ~${Math.abs(travelDelta)} min travel.`
            : 'Keeps travel about the same.'

      setActiveRole(role)
      setPreviewSwap({
        role,
        targetRouteId: activeFinalRoute.routeId,
        targetStopId: targetRouteStop.id,
        targetStopIndex: targetRouteStop.stopIndex,
        targetRole: targetRouteStop.role,
        swapBeforeStopId: targetRouteStop.id,
        requestedReplacementId: replacement.venue.id,
        originalStop: {
          ...originalStop,
          venueName: originalCanonical?.displayName ?? originalDisplay.title,
        },
        candidateStop: candidateStopForDisplay,
        replacementCanonical,
        swappedArc,
        swappedItinerary,
        descriptor: getAlternativeDescriptor(replacement, {
          role,
          contractConstraints: activePlan.contractConstraints,
        }),
        whyItFits: candidateNarrative.whyItFits,
        knownFor: candidateNarrative.knownFor,
        localSignal: candidateNarrative.localSignal ?? 'Best earlier in the evening.',
        venueLinkUrl: buildVenueLinkUrl(
          candidateStopForDisplay,
          replacementCanonical.displayName,
          {
            providerRecordId: replacementCanonical.providerRecordId,
            latitude: replacementCanonical.latitude,
            longitude: replacementCanonical.longitude,
            venueName: replacementCanonical.displayName,
          },
        ),
        tradeoffSignal: getSwapTradeoffSignal(role, candidateStopForDisplay),
        constraintSignal,
        cascadeHint: getSwapCascadeHint(role, candidateStopForDisplay),
      })
      setSwapCompatibilityDebug(null)
      setAppliedSwapRole(null)
    } catch (nextError) {
      const reason =
        nextError instanceof Error ? nextError.message : 'Could not preview this swap option.'
      console.warn('[SWAP PREVIEW ERROR]', {
        role,
        replacementId: venueId,
        reason,
      })
      setSwapInteractionBreadcrumb((current) => ({
        swapClickFired: current?.swapClickFired ?? true,
        swapHandlerEntered: true,
        swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId ?? null,
        swapCandidateCanonicalIdentityAtClick:
          current?.swapCandidateCanonicalIdentityAtClick ?? null,
        candidateHasCanonicalIdentity: current?.candidateHasCanonicalIdentity ?? null,
        swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
        swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? role,
        swapGuardFailureReason: 'preview_exception',
        swapCommitStarted: false,
        swapCommitFinished: false,
        swapModalClosedAfterCommit: false,
      }))
      setError(reason)
    }
  }, [])

  const handleApplyPreviewSwap = async (invocation: SwapCommitInvocation) => {
    const markGuardFailure = (reason: string, message: string) => {
      setSwapCompatibilityDebug({
        swapCompatibilityPassed: false,
        swapCompatibilityReason: message,
        swapCompatibilityRejectClass: 'hard_structural',
        preservedRole: false,
        preservedDistrict: false,
        preservedFamily: false,
        preservedFeasibility: false,
        softDirectionDriftDetected: false,
      })
      setSwapInteractionBreadcrumb((current) => ({
        swapClickFired: current?.swapClickFired ?? true,
        swapHandlerEntered: true,
        swapCandidateAtClickId: current?.swapCandidateAtClickId ?? null,
        swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
        swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? null,
        swapGuardFailureReason: reason,
        swapCommitStarted: false,
        swapCommitFinished: false,
        swapModalClosedAfterCommit: false,
      }))
      setError(message)
    }

    setSwapInteractionBreadcrumb((current) => ({
      swapClickFired: current?.swapClickFired ?? true,
      swapHandlerEntered: true,
      swapCandidateAtClickId: current?.swapCandidateAtClickId ?? null,
      swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
      swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? null,
      swapGuardFailureReason: null,
      swapCommitStarted: false,
      swapCommitFinished: false,
      swapModalClosedAfterCommit: false,
    }))

    const { role, swapSnapshot, planSnapshot, finalRouteSnapshot, routeVersionAtClick } =
      invocation
    if (!swapSnapshot) {
      markGuardFailure('swap_snapshot_missing', 'Swap did not start: missing swap selection at click.')
      return
    }
    if (!planSnapshot) {
      markGuardFailure('plan_missing', 'Swap did not start: plan state missing at click.')
      return
    }
    if (!finalRouteSnapshot) {
      markGuardFailure('final_route_missing', 'Swap did not start: final route missing at click.')
      return
    }
    if (swapSnapshot.role !== role) {
      markGuardFailure(
        'role_mismatch',
        `Swap did not start: role mismatch (${swapSnapshot.role} vs ${role}).`,
      )
      return
    }
    if (!planSnapshot.selectedDirectionContract) {
      markGuardFailure(
        'direction_contract_missing',
        'Swap did not start: selected direction contract is missing.',
      )
      return
    }
    if (swapSnapshot.targetRole !== role) {
      markGuardFailure(
        'target_role_mismatch',
        `Swap did not start: target role mismatch (${swapSnapshot.targetRole} vs ${role}).`,
      )
      return
    }
    if (swapSnapshot.targetStopIndex < 0) {
      markGuardFailure('target_slot_missing', 'Swap did not start: target slot index is invalid.')
      return
    }

    setError(undefined)
    setSwapInteractionBreadcrumb((current) => ({
      swapClickFired: current?.swapClickFired ?? true,
      swapHandlerEntered: true,
      swapCandidateAtClickId: current?.swapCandidateAtClickId ?? swapSnapshot.requestedReplacementId,
      swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? swapSnapshot.targetStopIndex,
      swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? swapSnapshot.targetRole,
      swapGuardFailureReason: null,
      swapCommitStarted: true,
      swapCommitFinished: false,
      swapModalClosedAfterCommit: false,
    }))

    try {
      const nextCanonicalStopByRole: Partial<Record<UserStopRole, CanonicalPlanningStopIdentity>> = {
        ...canonicalStopByRole,
        [role]: swapSnapshot.replacementCanonical,
      }
      const canonicalItinerary = applyCanonicalIdentityToItinerary(
        swapSnapshot.swappedItinerary,
        nextCanonicalStopByRole,
      )
      const swapDirectionId = planSnapshot.selectedDirectionContract.id
      const swapPreviewContext = planSnapshot.selectedDirectionPreviewContext
      const compatibility = evaluateSwapCompatibility({
        role,
        swapSnapshot,
        canonicalItinerary,
        planSnapshot,
        finalRouteSnapshot,
        routeShapeContract: planSnapshot.routeShapeContract,
      })
      setSwapCompatibilityDebug(compatibility)
      if (!compatibility.swapCompatibilityPassed) {
        throw new Error(`Swap rejected: ${compatibility.swapCompatibilityReason}`)
      }
      if (!swapDirectionId || !swapPreviewContext) {
        throw new Error('Route update failed: canonical route state is unavailable.')
      }
      if (finalRouteSnapshot.selectedDirectionId !== swapDirectionId) {
        throw new Error('Swap rejected: route direction drifted from the selected direction contract.')
      }
      if (swapSnapshot.targetRouteId !== finalRouteSnapshot.routeId) {
        throw new Error('Swap preview is stale. Please reopen swap options and try again.')
      }
      const sourceSwapStop = canonicalItinerary.stops.find((stop) => stop.role === role)
      const currentRouteStop =
        finalRouteSnapshot.stops.find((stop) => stop.id === swapSnapshot.targetStopId) ??
        finalRouteSnapshot.stops.find((stop) => stop.stopIndex === swapSnapshot.targetStopIndex) ??
        finalRouteSnapshot.stops.find((stop) => stop.role === swapSnapshot.targetRole)
      if (!sourceSwapStop || !currentRouteStop) {
        throw new Error('Route update failed: swapped stop could not be resolved.')
      }
      if (
        currentRouteStop.role !== swapSnapshot.targetRole ||
        currentRouteStop.stopIndex !== swapSnapshot.targetStopIndex
      ) {
        console.error('Swap aborted due to target mismatch.', {
          routeId: finalRouteSnapshot.routeId,
          expectedRole: swapSnapshot.targetRole,
          expectedStopIndex: swapSnapshot.targetStopIndex,
          resolvedRole: currentRouteStop.role,
          resolvedStopIndex: currentRouteStop.stopIndex,
        })
        throw new Error('Swap target mismatch detected. Please retry from the current route.')
      }
      if (swapSnapshot.candidateStop.venueId !== swapSnapshot.requestedReplacementId) {
        throw new Error(
          `Swap integrity mismatch: modal requested ${swapSnapshot.requestedReplacementId}, candidate resolved ${swapSnapshot.candidateStop.venueId}.`,
        )
      }
      const projectedSwapMismatch = sourceSwapStop.venueId !== swapSnapshot.requestedReplacementId
      const canonicalItineraryAfterSwap = projectedSwapMismatch
        ? {
            ...canonicalItinerary,
            stops: canonicalItinerary.stops.map((stop) => {
              if (stop.role !== role) {
                return stop
              }
              return {
                ...stop,
                id: swapSnapshot.candidateStop.id,
                venueId: swapSnapshot.requestedReplacementId,
                venueName: swapSnapshot.replacementCanonical.displayName,
                city: swapSnapshot.replacementCanonical.city,
                neighborhood:
                  swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood,
                driveMinutes: swapSnapshot.candidateStop.driveMinutes,
                imageUrl: swapSnapshot.candidateStop.imageUrl,
              }
            }),
          }
        : canonicalItinerary
      const replacementStop: FinalRouteStop = {
        id: swapSnapshot.candidateStop.id,
        sourceStopId: swapSnapshot.candidateStop.id,
        displayName: swapSnapshot.replacementCanonical.displayName,
        providerRecordId: swapSnapshot.replacementCanonical.providerRecordId,
        latitude: swapSnapshot.replacementCanonical.latitude,
        longitude: swapSnapshot.replacementCanonical.longitude,
        address: swapSnapshot.replacementCanonical.addressLine,
        role: currentRouteStop.role,
        stopIndex: currentRouteStop.stopIndex,
        venueId: swapSnapshot.requestedReplacementId,
        title: currentRouteStop.title,
        subtitle: currentRouteStop.subtitle,
        neighborhood:
          swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood,
        driveMinutes: swapSnapshot.candidateStop.driveMinutes,
        imageUrl: swapSnapshot.candidateStop.imageUrl,
      }
      const patched = patchFinalRouteStop({
        route: finalRouteSnapshot,
        targetRole: swapSnapshot.targetRole,
        targetStopId: swapSnapshot.targetStopId,
        targetStopIndex: swapSnapshot.targetStopIndex,
        replacementStop,
        notice: `${role} swapped to ${replacementStop.displayName}.`,
        activeRole: role,
      })
      if (!patched) {
        throw new Error('Route update failed: canonical route patch did not apply.')
      }
      if (import.meta.env.DEV) {
        console.log('SWAP TARGET CHECK', {
          routeId: finalRouteSnapshot.routeId,
          modalTargetStopId: swapSnapshot.targetStopId,
          modalTargetRole: swapSnapshot.targetRole,
          modalTargetStopIndex: swapSnapshot.targetStopIndex,
          resolvedStopId: patched.resolvedStop.id,
          resolvedRole: patched.resolvedStop.role,
          resolvedStopIndex: patched.resolvedStop.stopIndex,
        })
      }
      if (
        patched.resolvedStop.role !== swapSnapshot.targetRole ||
        patched.resolvedStop.stopIndex !== swapSnapshot.targetStopIndex
      ) {
        console.error('Swap aborted due to patch resolution mismatch.', {
          routeId: finalRouteSnapshot.routeId,
          expectedRole: swapSnapshot.targetRole,
          expectedStopIndex: swapSnapshot.targetStopIndex,
          resolvedRole: patched.resolvedStop.role,
          resolvedStopIndex: patched.resolvedStop.stopIndex,
          resolution: patched.resolution,
        })
        throw new Error('Swap target mismatch detected. Please retry from the current route.')
      }
      const nextFinalRoute = patched.route
      const appliedStop = nextFinalRoute.stops.find(
        (stop) => stop.stopIndex === swapSnapshot.targetStopIndex,
      )
      if (!appliedStop) {
        throw new Error('Swap integrity mismatch: target slot is missing after route patch.')
      }
      if (appliedStop.role !== swapSnapshot.targetRole) {
        throw new Error(
          `Swap integrity mismatch: target role changed from ${swapSnapshot.targetRole} to ${appliedStop.role}.`,
        )
      }
      const appliedReplacementId = appliedStop.venueId
      const swapMismatch = appliedReplacementId !== swapSnapshot.requestedReplacementId
      setSwapDebugBreadcrumb({
        swapTargetSlotIndex: swapSnapshot.targetStopIndex,
        swapTargetRole: swapSnapshot.targetRole,
        swapBeforeStopId: swapSnapshot.swapBeforeStopId,
        swapRequestedReplacementId: swapSnapshot.requestedReplacementId,
        swapAppliedReplacementId: appliedReplacementId,
        postSwapCanonicalStopIdBySlot: [...nextFinalRoute.stops]
          .sort((left, right) => left.stopIndex - right.stopIndex)
          .map((stop) => stop.venueId),
        postSwapRenderedStopIdBySlot: canonicalItineraryAfterSwap.stops.map((stop) => stop.venueId),
        swapCommitSucceeded: !swapMismatch,
        swapRenderSource: 'finalRoute',
        routeVersion: swapMismatch ? routeVersionAtClick : routeVersionAtClick + 1,
        mismatch: swapMismatch,
      })
      if (swapMismatch) {
        throw new Error(
          `Swap integrity mismatch: requested ${swapSnapshot.requestedReplacementId}, applied ${appliedReplacementId}.`,
        )
      }
      setPlan({
        ...planSnapshot,
        itinerary: canonicalItineraryAfterSwap,
        selectedArc: swapSnapshot.swappedArc,
      })
      updateFinalRoute(nextFinalRoute)
      logSwapCommitChecks(nextFinalRoute, role, ['preview', 'map', 'spine', 'live', 'share', 'calendar'])
      setCanonicalStopByRole(nextCanonicalStopByRole)
      setPreviewSwap(undefined)
      setAppliedSwapRole(role)
      const swapFeedback = getPreviewSwapFeedback(role)
      if (swapFeedback) {
        setPreviewFeedback(swapFeedback)
      }
      setExpandedRole(null)
      setActiveRole(role)
      setSwapInteractionBreadcrumb((current) => ({
        swapClickFired: current?.swapClickFired ?? true,
        swapHandlerEntered: true,
        swapCandidateAtClickId: current?.swapCandidateAtClickId ?? swapSnapshot.requestedReplacementId,
        swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? swapSnapshot.targetStopIndex,
        swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? swapSnapshot.targetRole,
        swapGuardFailureReason: null,
        swapCommitStarted: true,
        swapCommitFinished: true,
        swapModalClosedAfterCommit: true,
      }))
    } catch (nextError) {
      const reason = nextError instanceof Error ? nextError.message : 'Could not apply this swap option.'
      setSwapCompatibilityDebug((current) => {
        if (current && !current.swapCompatibilityPassed) {
          return current
        }
        return {
          swapCompatibilityPassed: false,
          swapCompatibilityReason: reason,
          swapCompatibilityRejectClass: 'hard_structural',
          preservedRole: current?.preservedRole ?? false,
          preservedDistrict: current?.preservedDistrict ?? false,
          preservedFamily: current?.preservedFamily ?? false,
          preservedFeasibility: current?.preservedFeasibility ?? false,
          softDirectionDriftDetected: current?.softDirectionDriftDetected ?? false,
        }
      })
      setSwapInteractionBreadcrumb((current) => ({
        swapClickFired: current?.swapClickFired ?? true,
        swapHandlerEntered: true,
        swapCandidateAtClickId: current?.swapCandidateAtClickId ?? swapSnapshot?.requestedReplacementId ?? null,
        swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? swapSnapshot?.targetStopIndex ?? null,
        swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? swapSnapshot?.targetRole ?? null,
        swapGuardFailureReason: reason,
        swapCommitStarted: true,
        swapCommitFinished: true,
        swapModalClosedAfterCommit: false,
      }))
      setError(reason)
    }
  }

  const handleSwapConfirmClick = () => {
    const swapSnapshot = previewSwap
    const candidateIdAtClick =
      swapSnapshot?.requestedReplacementId ?? swapSnapshot?.candidateStop.venueId ?? null
    const targetSlotIndexAtClick = swapSnapshot?.targetStopIndex ?? null
    const targetRoleAtClick = swapSnapshot?.targetRole ?? null
    const clickMissingReason = !swapSnapshot
      ? 'preview_swap_missing_at_click'
      : !candidateIdAtClick
        ? 'candidate_missing_at_click'
        : targetSlotIndexAtClick == null
          ? 'target_slot_missing_at_click'
          : !targetRoleAtClick
            ? 'target_role_missing_at_click'
            : null
    setSwapInteractionBreadcrumb({
      swapClickFired: true,
      swapHandlerEntered: false,
      swapCandidateAtClickId: candidateIdAtClick,
      swapTargetSlotIndexAtClick: targetSlotIndexAtClick,
      swapTargetRoleAtClick: targetRoleAtClick,
      swapGuardFailureReason: clickMissingReason,
      swapCommitStarted: false,
      swapCommitFinished: false,
      swapModalClosedAfterCommit: false,
    })
    if (clickMissingReason || !swapSnapshot) {
      setSwapCompatibilityDebug({
        swapCompatibilityPassed: false,
        swapCompatibilityReason: `Swap click ignored: ${clickMissingReason ?? 'missing swap payload'}.`,
        swapCompatibilityRejectClass: 'hard_structural',
        preservedRole: false,
        preservedDistrict: false,
        preservedFamily: false,
        preservedFeasibility: false,
        softDirectionDriftDetected: false,
      })
      setError(`Swap click ignored: ${clickMissingReason ?? 'missing swap payload'}.`)
      return
    }
    void handleApplyPreviewSwap({
      role: swapSnapshot.role,
      swapSnapshot,
      planSnapshot: plan,
      finalRouteSnapshot: finalRoute,
      routeVersionAtClick: routeVersion,
    })
  }

  const handleKeepCurrentSwap = (role: UserStopRole) => {
    if (!previewSwap || previewSwap.role !== role) {
      return
    }
    setPreviewSwap(undefined)
  }

  const handleLockNight = () => {
    if (!plan || !finalRoute || isLocking) {
      return
    }
    setIsLocking(true)
    saveLiveArtifactSession({
      city: finalRoute.location || plan.itinerary.city || city.trim(),
      itinerary: plan.itinerary,
      selectedClusterConfirmation: plan.selectedClusterConfirmation,
      initialActiveRole: activeRole,
      lockedAt: Date.now(),
      finalRoute: {
        ...finalRoute,
        activeStopIndex: Math.max(
          0,
          finalRoute.stops.findIndex((stop) => stop.role === activeRole),
        ),
      },
    })
    const isDevSandbox =
      typeof window !== 'undefined' &&
      (window.location.pathname.toLowerCase().startsWith('/dev') ||
        window.location.pathname.toLowerCase().startsWith('/sandbox'))
    window.setTimeout(() => {
      window.location.assign(isDevSandbox ? '/dev/live' : '/journey/live')
    }, 220)
  }

  const planningDisplayStops = useMemo(() => {
    if (!plan || !finalRoute) {
      return []
    }
    const stopBySourceId = new Map(plan.itinerary.stops.map((stop) => [stop.id, stop] as const))
    const stopByIndex = new Map(plan.itinerary.stops.map((stop, index) => [index, stop] as const))
    const orderedRouteStops = [...finalRoute.stops]
      .filter((stop) => stop.role !== 'surprise')
      .sort((left, right) => left.stopIndex - right.stopIndex)
    return orderedRouteStops
      .map((finalStop) => {
        const sourceStop =
          stopBySourceId.get(finalStop.sourceStopId) ??
          stopByIndex.get(finalStop.stopIndex) ??
          plan.itinerary.stops.find(
            (stop) => stop.role === finalStop.role && stop.venueId === finalStop.venueId,
          ) ??
          plan.itinerary.stops.find((stop) => stop.role === finalStop.role)
        if (!sourceStop) {
          return null
        }
        return {
          ...sourceStop,
          id: finalStop.sourceStopId,
          role: finalStop.role,
          title: finalStop.title,
          subtitle: finalStop.subtitle,
          venueId: finalStop.venueId,
          venueName: finalStop.displayName,
          city: finalRoute.location || sourceStop.city,
          neighborhood: finalStop.neighborhood || sourceStop.neighborhood,
          driveMinutes: finalStop.driveMinutes,
          imageUrl: finalStop.imageUrl,
        }
      })
      .filter((stop): stop is ItineraryStop => Boolean(stop))
  }, [finalRoute, plan])
  const postSwapCanonicalStopIdBySlot = useMemo(
    () =>
      finalRoute
        ? [...finalRoute.stops]
            .sort((left, right) => left.stopIndex - right.stopIndex)
            .map((stop) => stop.venueId)
        : [],
    [finalRoute],
  )
  const postSwapRenderedStopIdBySlot = useMemo(
    () => planningDisplayStops.map((stop) => stop.venueId),
    [planningDisplayStops],
  )
  const selectedDirectionPreviewContext = useMemo(
    () => buildSelectedDirectionPreviewContext(selectedDirection),
    [selectedDirection],
  )
  const activePreviewDirectionContext =
    selectedDirectionPreviewContext ?? plan?.selectedDirectionPreviewContext
  const selectedDirectionContractId =
    selectedDirectionContract?.id ?? plan?.selectedDirectionContract.id ?? null
  const selectedDirectionPocketId =
    selectedDirectionContract?.pocketId ?? plan?.selectedDirectionContract.pocketId ?? null
  const resolvedSelectedDirectionContext =
    selectedDirectionContext ?? plan?.selectedDirectionContext
  const resolvedExperienceContract = plan?.experienceContract ?? canonicalExperienceContract
  const resolvedContractConstraints = plan?.contractConstraints ?? canonicalContractConstraints
  const resolvedConciergeIntent = plan?.conciergeIntent ?? canonicalConciergeIntent
  const experienceContractSource = plan?.experienceContract
    ? 'plan.experienceContract'
    : 'canonicalExperienceContract'
  const contractConstraintsSource = plan?.contractConstraints
    ? 'plan.contractConstraints'
    : 'canonicalContractConstraints'
  const experienceContractActPattern = resolvedExperienceContract.actStructure.actPattern.join(' | ')
  const executionBridgeSummary = [
    `peak:${resolvedContractConstraints.peakCountModel}`,
    `movement:${resolvedContractConstraints.movementTolerance} -> radius:${
      (selectedRouteShapeContract ?? plan?.routeShapeContract)?.movementProfile.radius ?? 'n/a'
    }`,
    `continuity:${resolvedContractConstraints.requireContinuity ? 'required' : 'optional'}`,
    `windDown:${resolvedContractConstraints.windDownStrictness}`,
  ].join(' | ')
  const conciergeIntentSource = plan?.conciergeIntent ? 'plan.conciergeIntent' : 'canonicalConciergeIntent'
  const conciergeIntentId = resolvedConciergeIntent.id
  const conciergeIntentMode = resolvedConciergeIntent.intentMode
  const conciergeIntentObjectivePrimary = resolvedConciergeIntent.objective.primary
  const conciergeIntentControlMode = resolvedConciergeIntent.controlPosture.mode
  const conciergeIntentPersona = resolvedConciergeIntent.experienceProfile.persona
  const conciergeIntentVibe = resolvedConciergeIntent.experienceProfile.vibe
  const conciergeIntentAnchorMode = resolvedConciergeIntent.anchorPosture.mode
  const conciergeIntentTravelTolerance =
    resolvedConciergeIntent.constraintPosture.travelTolerance
  const conciergeIntentSwapTolerance =
    resolvedConciergeIntent.constraintPosture.swapTolerance
  const activeRouteShapeContract = selectedRouteShapeContract ?? plan?.routeShapeContract
  const routeShapeContractId = activeRouteShapeContract?.id ?? null
  const routeShapeArcShape = activeRouteShapeContract?.arcShape ?? null
  const routeShapeSwapFlexibility =
    activeRouteShapeContract?.mutationProfile.swapFlexibility ?? null
  const routeShapeMovementRadius = activeRouteShapeContract?.movementProfile.radius ?? null
  const selectedDirectionContextIdentity = resolvedSelectedDirectionContext?.identity ?? null
  const selectedDirectionExperienceIdentity =
    selectedDirection?.debugMeta?.directionExperienceIdentity ?? 'n/a'
  const selectedDirectionPrimaryIdentitySource =
    selectedDirection?.debugMeta?.directionPrimaryIdentitySource ?? 'n/a'
  const selectedDirectionPeakModel = selectedDirection?.debugMeta?.directionPeakModel ?? 'n/a'
  const selectedDirectionMovementStyle =
    selectedDirection?.debugMeta?.directionMovementStyle ?? 'n/a'
  const selectedDirectionDistrictSupportSummary =
    selectedDirection?.debugMeta?.directionDistrictSupportSummary ?? 'n/a'
  const selectedDirectionStrategyId =
    selectedDirection?.debugMeta?.directionStrategyId ?? 'n/a'
  const selectedDirectionStrategyLabel =
    selectedDirection?.debugMeta?.directionStrategyLabel ?? 'n/a'
  const selectedDirectionStrategyFamily =
    selectedDirection?.debugMeta?.directionStrategyFamily ?? 'n/a'
  const selectedDirectionStrategySummary =
    selectedDirection?.debugMeta?.directionStrategySummary ?? 'n/a'
  const selectedDirectionStrategySource =
    selectedDirection?.debugMeta?.directionStrategySource ?? 'n/a'
  const selectedDirectionCollapseGuardApplied = String(
    selectedDirection?.debugMeta?.directionCollapseGuardApplied ?? false,
  )
  const selectedDirectionStrategyOverlapSummary =
    selectedDirection?.debugMeta?.directionStrategyOverlapSummary ?? 'n/a'
  const selectedDirectionStrategyConstraintStatus = selectedDirection?.debugMeta
    ?.strategyConstraintStatus
    ? JSON.stringify(selectedDirection.debugMeta.strategyConstraintStatus)
    : 'n/a'
  const selectedDirectionStrategyPoolSize =
    selectedDirection?.debugMeta?.strategyPoolSize ?? 'n/a'
  const selectedDirectionStrategyRejectedCount =
    selectedDirection?.debugMeta?.strategyRejectedCount ?? 'n/a'
  const selectedDirectionStrategyHardGuardStatus =
    selectedDirection?.debugMeta?.strategyHardGuardStatus ?? 'n/a'
  const selectedDirectionStrategyHardGuardReason =
    selectedDirection?.debugMeta?.strategyHardGuardReason ?? 'n/a'
  const selectedContractGateApplied = String(selectedDirection?.debugMeta?.contractGateApplied ?? false)
  const selectedContractGateSummary = selectedDirection?.debugMeta?.contractGateSummary ?? 'n/a'
  const selectedContractGateStrengthSummary =
    selectedDirection?.debugMeta?.contractGateStrengthSummary ?? 'n/a'
  const selectedContractGateRejectedCount =
    selectedDirection?.debugMeta?.contractGateRejectedCount ?? 'n/a'
  const selectedContractGateAllowedPreview =
    selectedDirection?.debugMeta?.contractGateAllowedPreview?.join(',') ?? 'n/a'
  const selectedContractGateSuppressedPreview =
    selectedDirection?.debugMeta?.contractGateSuppressedPreview?.join(',') ?? 'n/a'
  const contractGateStrategyFamilyResolution = contractGateWorld.debug.strategyFamilyResolution
  const contractGateStrategyFamilyResolutionSummary = [
    `resolved:${contractGateStrategyFamilyResolution.resolvedFamily}`,
    `fallback:${String(contractGateStrategyFamilyResolution.fallbackPathUsed)}`,
    `canonicalProvided:${String(contractGateStrategyFamilyResolution.canonicalStrategyFamilyProvided)}`,
    `canonicalAmbiguous:${String(contractGateStrategyFamilyResolution.canonicalStrategyFamilyAmbiguous)}`,
  ].join(' | ')
  const selectedDirectionContractGateStatus =
    selectedDirection?.debugMeta?.directionContractGateStatus ?? 'n/a'
  const selectedDirectionContractGateReasonSummary =
    selectedDirection?.debugMeta?.directionContractGateReasonSummary ?? 'n/a'
  const selectedStrategyWorld = strategyAdmissibleWorlds.find(
    (world) => world.strategyId === selectedDirectionStrategyId,
  )
  const selectedStrategyWorldId =
    selectedDirection?.debugMeta?.selectedStrategyWorldId ??
    selectedStrategyWorld?.strategyId ??
    'n/a'
  const selectedStrategyWorldSource =
    selectedDirection?.debugMeta?.strategyWorldSource ??
    selectedStrategyWorld?.source ??
    'n/a'
  const selectedStrategyWorldSummary =
    selectedDirection?.debugMeta?.strategyWorldSummary ??
    selectedStrategyWorld?.summary ??
    'n/a'
  const selectedStrategyWorldAdmittedCount =
    selectedDirection?.debugMeta?.strategyWorldAdmittedCount ??
    selectedStrategyWorld?.debug.admittedCount ??
    'n/a'
  const selectedStrategyWorldSuppressedCount =
    selectedDirection?.debugMeta?.strategyWorldSuppressedCount ??
    selectedStrategyWorld?.debug.suppressedCount ??
    'n/a'
  const selectedStrategyWorldRejectedCount =
    selectedDirection?.debugMeta?.strategyWorldRejectedCount ??
    selectedStrategyWorld?.debug.rejectedCount ??
    'n/a'
  const selectedStrategyWorldAllowedPreview =
    selectedDirection?.debugMeta?.strategyWorldAllowedPreview ??
    selectedStrategyWorld?.debug.allowedPreview ??
    'n/a'
  const selectedStrategyWorldSuppressedPreview =
    selectedDirection?.debugMeta?.strategyWorldSuppressedPreview ??
    selectedStrategyWorld?.debug.suppressedPreview ??
    'n/a'
  const selectedDirectionStrategyWorldStatus =
    selectedDirection?.debugMeta?.directionStrategyWorldStatus ?? 'n/a'
  const selectedDirectionStrategyWorldReasonSummary =
    selectedDirection?.debugMeta?.directionStrategyWorldReasonSummary ?? 'n/a'
  const selectedDirectionNarrativeSource =
    selectedDirection?.debugMeta?.directionNarrativeSource ?? 'n/a'
  const selectedDirectionNarrativeMode =
    selectedDirection?.debugMeta?.directionNarrativeMode ?? 'n/a'
  const selectedDirectionNarrativeSummary =
    selectedDirection?.debugMeta?.directionNarrativeSummary ?? 'n/a'
  const generationDriftReason = generationContractDebug?.generationDriftReason ?? null
  const contractBuildabilityStatus = generationContractDebug?.contractBuildabilityStatus ?? null
  const missingRoleForContract = generationContractDebug?.missingRoleForContract ?? null
  const candidatePoolSufficiencyByRole = generationContractDebug?.candidatePoolSufficiencyByRole
  const expectedDirectionIdentity = generationContractDebug?.expectedDirectionIdentity ?? null
  const observedDirectionIdentity = generationContractDebug?.observedDirectionIdentity ?? null
  const generationIdentityFallbackApplied = generationContractDebug?.fallbackApplied ?? false
  const candidatePoolSufficiencySummary = candidatePoolSufficiencyByRole
    ? `start:${candidatePoolSufficiencyByRole.start} | highlight:${candidatePoolSufficiencyByRole.highlight} | windDown:${candidatePoolSufficiencyByRole.windDown}`
    : null
  const thinPoolDirectionRelaxationSummary = generationContractDebug?.thinPoolRelaxationTrace
    ? `triggered:${String(generationContractDebug.thinPoolRelaxationTrace.triggered)} | reason:${generationContractDebug.thinPoolRelaxationTrace.relaxationReason ?? 'n/a'} | rule:${generationContractDebug.thinPoolRelaxationTrace.relaxedRule ?? 'n/a'} | outcome:${generationContractDebug.thinPoolRelaxationTrace.validationOutcome}`
    : 'n/a'
  const swapCanonicalIdentityCacheResolvedCount = Object.keys(swapCanonicalIdentityByVenueId).length
  const swapCanonicalIdentityCacheMissingCount = Object.keys(swapCanonicalIdentityMissingByVenueId).length
  const tasteCurationDebug = plan?.tasteCurationDebug
  const highlightQualificationScore =
    typeof tasteCurationDebug?.highlightQualificationScore === 'number'
      ? formatTasteScore(tasteCurationDebug.highlightQualificationScore)
      : 'n/a'
  const highlightQualificationPassed =
    tasteCurationDebug?.highlightQualificationPassed == null
      ? 'n/a'
      : String(tasteCurationDebug.highlightQualificationPassed)
  const tasteRoleEligibilityByRoleSummary = tasteCurationDebug
    ? `start:${tasteCurationDebug.tasteRoleEligibilityByRole.start} | highlight:${tasteCurationDebug.tasteRoleEligibilityByRole.highlight} | windDown:${tasteCurationDebug.tasteRoleEligibilityByRole.windDown}`
    : 'n/a'
  const personaVibeTasteBiasSummary = tasteCurationDebug?.personaVibeTasteBiasSummary ?? 'n/a'
  const venuePersonalitySummary = tasteCurationDebug?.venuePersonalitySummary ?? 'n/a'
  const highlightPoolCountBefore = tasteCurationDebug?.highlightPoolCountBefore ?? 0
  const highlightPoolCountAfter = tasteCurationDebug?.highlightPoolCountAfter ?? 0
  const rolePoolCountByRoleBeforeSummary = tasteCurationDebug
    ? `start:${tasteCurationDebug.rolePoolCountByRoleBefore.start} | highlight:${tasteCurationDebug.rolePoolCountByRoleBefore.highlight} | windDown:${tasteCurationDebug.rolePoolCountByRoleBefore.windDown}`
    : 'n/a'
  const rolePoolCountByRoleAfterSummary = tasteCurationDebug
    ? `start:${tasteCurationDebug.rolePoolCountByRoleAfter.start} | highlight:${tasteCurationDebug.rolePoolCountByRoleAfter.highlight} | windDown:${tasteCurationDebug.rolePoolCountByRoleAfter.windDown}`
    : 'n/a'
  const signatureHighlightShortlistCount = tasteCurationDebug?.signatureHighlightShortlistCount ?? 0
  const signatureHighlightShortlistIds =
    tasteCurationDebug && tasteCurationDebug.signatureHighlightShortlistIds.length > 0
      ? tasteCurationDebug.signatureHighlightShortlistIds.join(', ')
      : 'n/a'
  const highlightShortlistScoreSummary =
    tasteCurationDebug?.highlightShortlistScoreSummary ?? 'n/a'
  const selectedHighlightFromShortlist = String(
    tasteCurationDebug?.selectedHighlightFromShortlist ?? false,
  )
  const selectedHighlightShortlistRank =
    tasteCurationDebug?.selectedHighlightShortlistRank ?? 'n/a'
  const fallbackToQualifiedHighlightPool = String(
    tasteCurationDebug?.fallbackToQualifiedHighlightPool ?? false,
  )
  const upstreamPoolSelectionApplied = String(tasteCurationDebug?.upstreamPoolSelectionApplied ?? false)
  const postGenerationRepairCount = tasteCurationDebug?.postGenerationRepairCount ?? 0
  const thinPoolHighlightFallbackApplied = String(
    tasteCurationDebug?.thinPoolHighlightFallbackApplied ?? false,
  )
  const thinPoolHighlightRelaxationSummary = tasteCurationDebug?.thinPoolRelaxationTrace
    ? `triggered:${String(
        tasteCurationDebug.thinPoolRelaxationTrace.triggered,
      )} | baseQualified:${tasteCurationDebug.thinPoolRelaxationTrace.baseQualifiedHighlightCount} | floor:${formatTasteScore(
        tasteCurationDebug.thinPoolRelaxationTrace.baseHighlightFloor,
      )}->${formatTasteScore(tasteCurationDebug.thinPoolRelaxationTrace.relaxedHighlightFloor)} | effect:${tasteCurationDebug.thinPoolRelaxationTrace.effectSummary}`
    : 'n/a'
  const scenarioKey = `${persona}|${normalizeExperienceContractVibe(primaryVibe)}`
  const topPocketDebugRows = contractAwareDistrictRanking.ranked.slice(0, 6).map((entry) => ({
    pocketId: entry.profile.pocketId,
    debug: contractAwareDistrictRanking.pocketDebugById[entry.profile.pocketId],
  }))
  const topPocketIds = topPocketDebugRows.map((entry) => entry.pocketId)
  const topPocketContractFitDeltas = topPocketDebugRows.map(
    (entry) => `${entry.pocketId}:${formatSignedScore(entry.debug?.contractFitDelta ?? 0)}`,
  )
  const topPocketContractFitReasons = topPocketDebugRows.map((entry) => {
    const reasons = entry.debug?.contractFitReasons?.slice(0, 2).join(' & ') ?? 'n/a'
    return `${entry.pocketId}:${reasons}`
  })
  const directionCandidatePocketIds = dedupeStringIds(directionCards.map((entry) => entry.id))
  const directionStrategyIds = dedupeStringIds(
    directionCards.map((entry) => entry.debugMeta?.directionStrategyId ?? null),
  )
  const retrievalContractApplied = plan?.generationTrace.retrievalContractApplied ?? false
  const retrievedVenueIds = dedupeStringIds(
    plan?.generationTrace.retrievedVenueIds ??
      plan?.scoredVenues.map((venue) => venue.venue.id) ??
      [],
  )
  const rolePoolVenueIdsByRole = plan?.generationTrace.rolePoolVenueIdsByRole
  const rolePoolVenueIdsByRoleSummary = rolePoolVenueIdsByRole
    ? `start:${formatIdList(rolePoolVenueIdsByRole.start)} | highlight:${formatIdList(
        rolePoolVenueIdsByRole.highlight,
      )} | windDown:${formatIdList(rolePoolVenueIdsByRole.windDown)}`
    : 'n/a'
  const rolePoolVenueIds = dedupeStringIds(
    plan?.generationTrace.rolePoolVenueIdsCombined ??
      tasteCurationDebug?.rolePoolVenueIdsCombined ??
      [],
  )
  const contractInfluenceSummary =
    plan?.generationTrace.contractInfluenceSummary ??
    'retrieval:none|highlight:none|windDown:none'
  const highlightShortlistIds = dedupeStringIds(
    tasteCurationDebug?.signatureHighlightShortlistIds ?? [],
  )
  const finalStopVenueIds = dedupeStringIds(
    finalRoute?.stops
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => stop.venueId) ?? [],
  )
  const stageOverlapFingerprint = useMemo<StageOverlapFingerprint>(
    () => ({
      scenarioKey,
      topPocketIds,
      directionCandidatePocketIds,
      retrievedVenueIds,
      rolePoolVenueIds,
      highlightShortlistIds,
      finalStopVenueIds,
    }),
    [
      directionCandidatePocketIds,
      finalStopVenueIds,
      highlightShortlistIds,
      retrievedVenueIds,
      rolePoolVenueIds,
      scenarioKey,
      topPocketIds,
    ],
  )
  const topPocketIdsSummary = formatIdList(stageOverlapFingerprint.topPocketIds)
  const directionCandidatePocketIdsSummary = formatIdList(
    stageOverlapFingerprint.directionCandidatePocketIds,
  )
  const retrievedVenueIdsSummary = formatIdList(stageOverlapFingerprint.retrievedVenueIds)
  const rolePoolVenueIdsSummary = formatIdList(stageOverlapFingerprint.rolePoolVenueIds)
  const highlightShortlistIdsSummary = formatIdList(stageOverlapFingerprint.highlightShortlistIds)
  const finalStopVenueIdsSummary = formatIdList(stageOverlapFingerprint.finalStopVenueIds)
  const topPocketContractFitDeltasSummary = formatIdList(topPocketContractFitDeltas)
  const topPocketContractFitReasonsSummary = formatIdList(topPocketContractFitReasons)
  const trackedScenarioKeys = Object.keys(stageFingerprintsByScenario).sort()
  const trackedScenarioKeysSummary = trackedScenarioKeys.join(' | ') || 'n/a'
  const scenarioJaccardByStage = useMemo(() => {
    const comparisons = Object.entries(stageFingerprintsByScenario)
      .filter(([key]) => key !== stageOverlapFingerprint.scenarioKey)
      .map(([key, fingerprint]) => {
        const topPocketOverlap = computeJaccardOverlap(
          stageOverlapFingerprint.topPocketIds,
          fingerprint.topPocketIds,
        )
        const directionPocketOverlap = computeJaccardOverlap(
          stageOverlapFingerprint.directionCandidatePocketIds,
          fingerprint.directionCandidatePocketIds,
        )
        const retrievedVenueOverlap = computeJaccardOverlap(
          stageOverlapFingerprint.retrievedVenueIds,
          fingerprint.retrievedVenueIds,
        )
        const rolePoolOverlap = computeJaccardOverlap(
          stageOverlapFingerprint.rolePoolVenueIds,
          fingerprint.rolePoolVenueIds,
        )
        const shortlistOverlap = computeJaccardOverlap(
          stageOverlapFingerprint.highlightShortlistIds,
          fingerprint.highlightShortlistIds,
        )
        const finalStopOverlap = computeJaccardOverlap(
          stageOverlapFingerprint.finalStopVenueIds,
          fingerprint.finalStopVenueIds,
        )
        return `${key}[pockets:${formatJaccard(topPocketOverlap)} dir:${formatJaccard(
          directionPocketOverlap,
        )} retrieved:${formatJaccard(retrievedVenueOverlap)} pools:${formatJaccard(
          rolePoolOverlap,
        )} shortlist:${formatJaccard(shortlistOverlap)} final:${formatJaccard(finalStopOverlap)}]`
      })
      .sort((left, right) => left.localeCompare(right))
    return comparisons.length > 0 ? comparisons.join(' | ') : 'n/a'
  }, [stageFingerprintsByScenario, stageOverlapFingerprint])
  const setDebugExpanded = useCallback((key: string, nextExpanded: boolean) => {
    setDebugExpandedByKey((current) => ({
      ...current,
      [key]: nextExpanded,
    }))
  }, [])
  const toggleDebugExpanded = useCallback((key: string) => {
    setDebugExpandedByKey((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }, [])
  const isDebugExpanded = useCallback(
    (key: string) => Boolean(debugExpandedByKey[key]),
    [debugExpandedByKey],
  )
  const selectedStartTasteSignals = useMemo(
    () => getFoundationTasteSignalsForRole(plan, 'start'),
    [plan],
  )
  const selectedHighlightTasteSignals = useMemo(
    () => getFoundationTasteSignalsForRole(plan, 'highlight'),
    [plan],
  )
  const selectedWindDownTasteSignals = useMemo(
    () => getFoundationTasteSignalsForRole(plan, 'windDown'),
    [plan],
  )
  const selectedStartTasteSignalsSummary = formatTasteSignalSummary(selectedStartTasteSignals)
  const selectedHighlightTasteSignalsSummary = formatTasteSignalSummary(selectedHighlightTasteSignals)
  const selectedWindDownTasteSignalsSummary = formatTasteSignalSummary(selectedWindDownTasteSignals)
  const selectedStartTasteRoleSuitabilitySummary = formatTasteRoleSuitabilitySummary(
    selectedStartTasteSignals,
  )
  const selectedHighlightTasteRoleSuitabilitySummary = formatTasteRoleSuitabilitySummary(
    selectedHighlightTasteSignals,
  )
  const selectedWindDownTasteRoleSuitabilitySummary = formatTasteRoleSuitabilitySummary(
    selectedWindDownTasteSignals,
  )
  const selectedStartTastePersonalitySummary = formatTastePersonalitySummary(selectedStartTasteSignals)
  const selectedHighlightTastePersonalitySummary = formatTastePersonalitySummary(
    selectedHighlightTasteSignals,
  )
  const selectedWindDownTastePersonalitySummary = formatTastePersonalitySummary(
    selectedWindDownTasteSignals,
  )
  const selectedHighlightTasteTier = selectedHighlightTasteSignals?.highlightTier ?? 'n/a'
  const selectedHighlightTasteDuration = selectedHighlightTasteSignals?.durationEstimate ?? 'n/a'
  const selectedHighlightTasteNovelty =
    typeof selectedHighlightTasteSignals?.noveltyWeight === 'number'
      ? formatTasteScore(selectedHighlightTasteSignals.noveltyWeight)
      : 'n/a'
  const selectedHighlightTasteSourceMode =
    selectedHighlightTasteSignals?.debug.sourceMode ?? 'n/a'
  const selectedHighlightTasteSeedCalibratedApplied = String(
    selectedHighlightTasteSignals?.debug.seedCalibratedApplied ?? false,
  )
  const selectedHighlightRoleContrast = formatHighlightRoleContrastSummary(
    selectedHighlightTasteSignals,
  )
  const selectedHighlightTierReason = formatHighlightTierReasonSummary(
    selectedHighlightTasteSignals,
  )
  const selectedHighlightEnergyBand = formatEnergyBand(selectedHighlightTasteSignals?.energy)
  const selectedHighlightSocialDensityBand = formatSocialDensityBand(
    selectedHighlightTasteSignals?.socialDensity,
  )
  const selectedHighlightVibeFit = formatSelectedHighlightVibeFit(
    selectedHighlightTasteSignals,
    conciergeIntentPersona,
    conciergeIntentVibe,
  )
  const vibePressureSummary = formatVibePressureSummary(
    selectedHighlightTasteSignals,
    conciergeIntentPersona,
    conciergeIntentVibe,
  )
  const toneSeparationSummary = formatToneSeparationSummary(selectedHighlightTasteSignals)
  const routeShapeStartInvariantSummary = activeRouteShapeContract
    ? formatRoleInvariantSummary(activeRouteShapeContract.roleInvariants.start)
    : 'n/a'
  const routeShapeHighlightInvariantSummary = activeRouteShapeContract
    ? formatRoleInvariantSummary(activeRouteShapeContract.roleInvariants.highlight)
    : 'n/a'
  const routeShapeWindDownInvariantSummary = activeRouteShapeContract
    ? formatRoleInvariantSummary(activeRouteShapeContract.roleInvariants.windDown)
    : 'n/a'
  useEffect(() => {
    setSelectionPreview(
      selectedDirection ? buildPreviewFromDirection(selectedDirection, persona) : null,
    )
  }, [selectedDirection, persona])
  const preview = useMemo(
    () => {
      if (
        finalRoute &&
        selectedDirectionContractId &&
        finalRoute.selectedDirectionId === selectedDirectionContractId
      ) {
        return buildPreviewFromFinalRoute(finalRoute)
      }
      return selectionPreview
    },
    [finalRoute, selectedDirectionContractId, selectionPreview],
  )
  const previewDirectionId = preview?.directionId ?? null
  const finalRouteDirectionId = finalRoute?.selectedDirectionId ?? null
  const selectedDirectionContextId = resolvedSelectedDirectionContext?.selectedDirectionId ?? null
  const directionSyncMismatch = Boolean(
    selectedDirectionContractId &&
      ((previewDirectionId && previewDirectionId !== selectedDirectionContractId) ||
        (selectedDirectionContextId && selectedDirectionContextId !== selectedDirectionContractId) ||
        (finalRouteDirectionId && finalRouteDirectionId !== selectedDirectionContractId)),
  )
  const directionSyncStatus = !selectedDirectionContractId
    ? 'no_selection'
    : loading
      ? 'building'
      : !finalRoute
        ? 'awaiting_generation'
        : directionSyncMismatch
          ? 'mismatch'
          : 'synced'
  const previewSynced =
    Boolean(finalRoute) &&
    Boolean(selectedDirectionContractId) &&
    previewDirectionId === selectedDirectionContractId &&
    finalRouteDirectionId === selectedDirectionContractId
  const previewStartLabel =
    preview?.stops.find((stop) => stop.role === 'start')?.name ?? 'TBD'
  const previewHighlightLabel =
    preview?.stops.find((stop) => stop.role === 'highlight')?.name ?? 'TBD'
  const previewWindDownLabel =
    preview?.stops.find((stop) => stop.role === 'windDown')?.name ?? 'Soft close nearby'
  const previewNarrativeSummary =
    preview?.tone ??
    selectedDirection?.debugMeta?.directionNarrativeSummary ??
    selectedDirection?.card.whyNow ??
    "Choose a direction to see tonight's route preview."
  const selectedDirectionTitle = selectedDirection?.card.title?.trim() ?? null
  const previewHeaderTitle = selectedDirectionTitle
    ? `${selectedDirectionTitle} - structured for flow`
    : "Tonight's route - structured for flow"
  const previewStructureReason =
    resolvedContractConstraints.peakCountModel === 'distributed'
      ? 'Start, highlight, and wind-down stay coordinated even with a distributed peak model.'
      : 'Clear start -> peak -> wind-down rhythm keeps the night coherent.'
  const previewMovementReason =
    resolvedContractConstraints.movementTolerance === 'tight'
      ? 'Short moves maintain momentum without rush.'
      : resolvedContractConstraints.movementTolerance === 'moderate'
        ? 'Short moves maintain momentum without rush.'
        : 'Manageable moves preserve momentum without rush.'
  const previewWhyCandidates = dedupeStringIds(
    [
      previewStructureReason,
      previewMovementReason,
      selectedDirection?.debugMeta?.directionDistrictSupportSummary,
      selectedDirection?.card.whyYou,
      selectedDirection?.debugMeta?.directionStrategySummary,
    ].filter((value): value is string => Boolean(value && value.trim())),
  )
  const previewWhyThisWorks = useMemo(() => {
    const selected: string[] = []
    const normalizedSelected: string[] = []
    for (const reason of previewWhyCandidates) {
      const normalized = reason
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!normalized) {
        continue
      }
      const duplicate = normalizedSelected.some(
        (existing) => existing.includes(normalized) || normalized.includes(existing),
      )
      if (duplicate) {
        continue
      }
      selected.push(reason)
      normalizedSelected.push(normalized)
      if (selected.length >= 2) {
        break
      }
    }
    if (selected.length < 2) {
      const fallback = dedupeStringIds([
        'Route pacing preserves a clear central peak.',
        'Movement stays easy between nearby stops.',
      ])
      for (const reason of fallback) {
        if (selected.length >= 2) {
          break
        }
        const normalized = reason.toLowerCase()
        if (!normalizedSelected.includes(normalized)) {
          selected.push(reason)
          normalizedSelected.push(normalized)
        }
      }
    }
    return selected.slice(0, 2)
  }, [
    previewMovementReason,
    previewStructureReason,
    previewWhyCandidates,
    resolvedContractConstraints.movementTolerance,
    resolvedContractConstraints.peakCountModel,
  ])
  const activeDistrictDiscoveryCard = useMemo(() => {
    if (activeDistrictPocketId === ALL_DISTRICTS_CONTEXT_ID) {
      return null
    }
    return districtDiscoveryCards.find((district) => district.id === activeDistrictPocketId) ?? null
  }, [activeDistrictPocketId, districtDiscoveryCards])
  const previewDistrictAnchorLine = useMemo(() => {
    const districtName =
      activeDistrictDiscoveryCard?.name ??
      activeDistrictLabel ??
      selectedDirection?.debugMeta?.pocketLabel ??
      'Nearby districts'
    return `${districtName} - Compact, walkable, steady energy`
  }, [
    activeDistrictDiscoveryCard?.name,
    activeDistrictLabel,
    selectedDirection?.debugMeta?.pocketLabel,
  ])
  const previewSpatialCoherenceLine = useMemo(() => {
    if (resolvedContractConstraints.movementTolerance === 'tight') {
      return 'Everything stays within a tight, walkable pocket.'
    }
    if (resolvedContractConstraints.movementTolerance === 'moderate') {
      return 'All stops stay within a short, walkable area.'
    }
    return 'Movement remains easy across nearby areas.'
  }, [resolvedContractConstraints.movementTolerance])
  const previewSpatialStops = useMemo(
    () => [
      {
        key: 'start',
        roleLabel: 'Start',
        hint: 'near center',
        venue: previewStartLabel,
        left: '16%',
        top: '62%',
        highlighted: false,
      },
      {
        key: 'highlight',
        roleLabel: 'Highlight',
        hint: 'central cluster',
        venue: previewHighlightLabel,
        left: '50%',
        top: '30%',
        highlighted: true,
      },
      {
        key: 'windDown',
        roleLabel: 'Wind-down',
        hint: 'slightly quieter edge',
        venue: previewWindDownLabel,
        left: '82%',
        top: '58%',
        highlighted: false,
      },
    ],
    [previewHighlightLabel, previewStartLabel, previewWindDownLabel],
  )
  const previewBridgeLine = 'Generated route summary'
  const previewBridgeSubline = 'Start, Highlight, and Wind-down are ready. Review the full route.'
  const revealedStepHeader = 'Confirm your night'
  const revealedStepSubline = 'Take one last look.'
  const handleBuildFullPlan = useCallback(async () => {
    if (!selectedDirectionId || loading) {
      return
    }
    if (plan && previewSynced) {
      setHasRevealed(true)
      return
    }
    const generated = await generatePlan(selectedDirectionId)
    if (generated) {
      setHasRevealed(true)
    }
  }, [generatePlan, loading, plan, previewSynced, selectedDirectionId])
  const debugViewModel = useMemo(() => {
    const rolePoolCountsSummary = rolePoolVenueIdsByRole
      ? `start:${rolePoolVenueIdsByRole.start.length}/highlight:${rolePoolVenueIdsByRole.highlight.length}/windDown:${rolePoolVenueIdsByRole.windDown.length}`
      : 'start:0/highlight:0/windDown:0'
    const interpretationBundlePresent = true
    const interpretationBundleSource = canonicalInterpretationBundle.debug.bundleSource
    const interpretationBundleSummary = `${canonicalInterpretationBundle.strategyFamily} | ${canonicalInterpretationBundle.contractSummary}`
    const contractGateWorldPresent = contractGateWorld.debug.contractGateWorldPresent
    const contractGateWorldSource = contractGateWorld.debug.contractGateWorldSource
    const contractGateWorldSummary = contractGateWorld.debug.contractGateWorldSummary
    const contractGateWorldRejectedCount = contractGateWorld.debug.rejectedCount
    const contractGateWorldAllowedPreview = contractGateWorld.debug.allowedPreview.join(',') || 'n/a'
    const contractGateWorldSuppressedPreview =
      contractGateWorld.debug.suppressedPreview.join(',') || 'n/a'
    const strategyWorldsPresent = strategyAdmissibleWorlds.length > 0
    const strategyWorldIds =
      strategyAdmissibleWorlds.map((world) => world.strategyId).join(',') || 'n/a'
    const contractSummary = `${resolvedExperienceContract.contractIdentity} | ${resolvedExperienceContract.coordinationMode} | ${resolvedExperienceContract.highlightModel} | ${resolvedExperienceContract.movementStyle}`
    const constraintSummary = `${resolvedContractConstraints.peakCountModel} | continuity:${resolvedContractConstraints.requireContinuity ? 'on' : 'off'} | escalation:${resolvedContractConstraints.requireEscalation ? 'on' : 'off'} | windDown:${resolvedContractConstraints.windDownStrictness}`
    const directionSummary = `top=${topPocketIds.slice(0, 3).join(',') || 'n/a'} | strategy=${selectedDirectionStrategyLabel} | ids=${directionStrategyIds.join(',') || 'n/a'}`
    const generationSummary = `retrieval:${retrievalContractApplied ? 'on' : 'off'} | pools ${rolePoolCountsSummary} | shortlist:${highlightShortlistIds.length} | final:${finalStopVenueIds.length}`
    const swapRequestedReplacementId = swapDebugBreadcrumb?.swapRequestedReplacementId ?? 'n/a'
    const swapAppliedReplacementId = swapDebugBreadcrumb?.swapAppliedReplacementId ?? 'n/a'
    const swapCompatibilityReason = swapCompatibilityDebug?.swapCompatibilityReason ?? 'n/a'
    const directionSyncStatusMarker =
      directionSyncStatus === 'synced'
        ? 'OK'
        : directionSyncStatus === 'mismatch'
          ? 'FAIL'
          : 'WARN'
    const generationDriftMarker = generationDriftReason ? 'FAIL' : 'OK'
    const missingRoleMarker = missingRoleForContract ? `WARN ${missingRoleForContract}` : 'OK'
    const swapMarker = swapDebugBreadcrumb
      ? swapDebugBreadcrumb.swapCommitSucceeded && !swapDebugBreadcrumb.mismatch
        ? 'OK'
        : 'FAIL'
      : 'OK'
    const runtimeSummary = `sync:${directionSyncStatusMarker.toLowerCase()} | drift:${generationDriftReason ?? 'none'} | missingRole:${missingRoleForContract ?? 'none'} | swap:last ${swapMarker === 'OK' ? 'ok' : 'issue'}`
    const topPocketContractFitReasonsCompact = topPocketContractFitReasons.map((reason) =>
      truncateText(reason, 92),
    )
    const comparisons = Object.entries(stageFingerprintsByScenario)
      .filter(([key]) => key !== stageOverlapFingerprint.scenarioKey)
      .sort((left, right) => left[0].localeCompare(right[0]))
    const compareSummary =
      comparisons.length === 0
        ? 'no comparison yet'
        : (() => {
            const [targetKey, fingerprint] = comparisons[0]
            const topPocketOverlap = computeJaccardOverlap(
              stageOverlapFingerprint.topPocketIds,
              fingerprint.topPocketIds,
            )
            const retrievedVenueOverlap = computeJaccardOverlap(
              stageOverlapFingerprint.retrievedVenueIds,
              fingerprint.retrievedVenueIds,
            )
            const rolePoolOverlap = computeJaccardOverlap(
              stageOverlapFingerprint.rolePoolVenueIds,
              fingerprint.rolePoolVenueIds,
            )
            const shortlistOverlap = computeJaccardOverlap(
              stageOverlapFingerprint.highlightShortlistIds,
              fingerprint.highlightShortlistIds,
            )
            const finalStopOverlap = computeJaccardOverlap(
              stageOverlapFingerprint.finalStopVenueIds,
              fingerprint.finalStopVenueIds,
            )
            return `vs ${targetKey} | pockets ${formatJaccard(topPocketOverlap)} | retrieved ${formatJaccard(
              retrievedVenueOverlap,
            )} | pools ${formatJaccard(rolePoolOverlap)} | shortlist ${formatJaccard(
              shortlistOverlap,
            )} | final ${formatJaccard(finalStopOverlap)}`
          })()

    return {
      rolePoolCountsSummary,
      interpretationBundlePresent,
      interpretationBundleSource,
      interpretationBundleSummary,
      contractGateWorldPresent,
      contractGateWorldSource,
      contractGateWorldSummary,
      contractGateWorldRejectedCount,
      contractGateWorldAllowedPreview,
      contractGateWorldSuppressedPreview,
      strategyWorldsPresent,
      strategyWorldIds,
      contractSummary,
      constraintSummary,
      directionSummary,
      generationSummary,
      swapRequestedReplacementId,
      swapAppliedReplacementId,
      swapCompatibilityReason,
      directionSyncStatusMarker,
      generationDriftMarker,
      missingRoleMarker,
      swapMarker,
      runtimeSummary,
      topPocketContractFitReasonsCompact,
      compareSummary,
    }
  }, [
    directionSyncStatus,
    canonicalInterpretationBundle,
    contractGateWorld,
    strategyAdmissibleWorlds,
    finalStopVenueIds,
    generationDriftReason,
    highlightShortlistIds,
    missingRoleForContract,
    resolvedContractConstraints,
    resolvedExperienceContract,
    retrievalContractApplied,
    rolePoolVenueIdsByRole,
    selectedDirectionExperienceIdentity,
    selectedDirectionStrategyLabel,
    stageFingerprintsByScenario,
    stageOverlapFingerprint,
    swapCompatibilityDebug,
    swapDebugBreadcrumb,
    topPocketIds,
    topPocketContractFitReasons,
    directionStrategyIds,
  ])
  const {
    rolePoolCountsSummary,
    interpretationBundlePresent,
    interpretationBundleSource,
    interpretationBundleSummary,
    contractGateWorldPresent,
    contractGateWorldSource,
    contractGateWorldSummary,
    contractGateWorldRejectedCount,
    contractGateWorldAllowedPreview,
    contractGateWorldSuppressedPreview,
    strategyWorldsPresent,
    strategyWorldIds,
    contractSummary,
    constraintSummary,
    directionSummary,
    generationSummary,
    swapRequestedReplacementId,
    swapAppliedReplacementId,
    swapCompatibilityReason,
    directionSyncStatusMarker,
    generationDriftMarker,
    missingRoleMarker,
    swapMarker,
    runtimeSummary,
    topPocketContractFitReasonsCompact,
    compareSummary,
  } = debugViewModel
  useEffect(() => {
    if (!stageOverlapFingerprint.scenarioKey) {
      return
    }
    setStageFingerprintsByScenario((current) => {
      const existing = current[stageOverlapFingerprint.scenarioKey]
      if (areStageOverlapFingerprintsEqual(existing, stageOverlapFingerprint)) {
        return current
      }
      return {
        ...current,
        [stageOverlapFingerprint.scenarioKey]: stageOverlapFingerprint,
      }
    })
  }, [stageOverlapFingerprint])
  useEffect(() => {
    if (!import.meta.env.DEV || !finalRoute) {
      return
    }
    console.log('ROUTE TRUTH CHECK', {
      routeVersion,
      routeId: finalRoute.routeId,
      selectedDirectionId: finalRoute.selectedDirectionId,
      stopNames: finalRoute.stops.map((stop) => stop.displayName),
      stopRoles: finalRoute.stops.map((stop) => stop.role),
      stopIds: finalRoute.stops.map((stop) => stop.id || stop.providerRecordId),
    })
  }, [finalRoute, routeVersion])
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }
    console.log('DIRECTION REBUILD CHECK', {
      persona,
      vibe: primaryVibe,
      directionIds: directionCards.map((direction) => direction.id),
      selectedDirectionId,
    })
  }, [directionCards, persona, primaryVibe, selectedDirectionId])
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }
    console.log('SYNC CHECK', {
      selectedDirectionId: selectedDirectionContractId,
      selectedDirectionPocketId,
      previewDirectionId,
      finalRouteDirectionId,
      previewStops: preview?.stops?.map((stop) => stop.name),
    })
  }, [finalRouteDirectionId, preview, previewDirectionId, selectedDirectionContractId, selectedDirectionPocketId])
  useEffect(() => {
    if (!import.meta.env.DEV || !swapDebugBreadcrumb) {
      return
    }
    console.log('SWAP BREADCRUMB', swapDebugBreadcrumb)
  }, [swapDebugBreadcrumb])
  useEffect(() => {
    if (!import.meta.env.DEV || !swapInteractionBreadcrumb) {
      return
    }
    console.log('SWAP INTERACTION', swapInteractionBreadcrumb)
  }, [swapInteractionBreadcrumb])
  useEffect(() => {
    if (!import.meta.env.DEV || !swapCompatibilityDebug) {
      return
    }
    console.log('SWAP COMPATIBILITY', swapCompatibilityDebug)
  }, [swapCompatibilityDebug])
  useEffect(() => {
    if (!swapDebugBreadcrumb) {
      return
    }
    setSwapDebugBreadcrumb((current) => {
      if (!current) {
        return current
      }
      const canonicalAtTarget = postSwapCanonicalStopIdBySlot[current.swapTargetSlotIndex] ?? null
      const renderedAtTarget = postSwapRenderedStopIdBySlot[current.swapTargetSlotIndex] ?? null
      const canonicalRenderMismatch = canonicalAtTarget !== renderedAtTarget
      const canonicalRequestMismatch = canonicalAtTarget !== current.swapRequestedReplacementId
      const nextMismatch = current.mismatch || canonicalRenderMismatch || canonicalRequestMismatch
      const next = {
        ...current,
        postSwapCanonicalStopIdBySlot,
        postSwapRenderedStopIdBySlot,
        mismatch: nextMismatch,
        swapCommitSucceeded:
          current.swapCommitSucceeded &&
          !canonicalRenderMismatch &&
          !canonicalRequestMismatch &&
          current.swapAppliedReplacementId === current.swapRequestedReplacementId,
      }
      const canonicalUnchanged =
        JSON.stringify(current.postSwapCanonicalStopIdBySlot ?? []) ===
        JSON.stringify(next.postSwapCanonicalStopIdBySlot ?? [])
      const renderedUnchanged =
        JSON.stringify(current.postSwapRenderedStopIdBySlot ?? []) ===
        JSON.stringify(next.postSwapRenderedStopIdBySlot ?? [])
      if (
        canonicalUnchanged &&
        renderedUnchanged &&
        current.mismatch === next.mismatch &&
        current.swapCommitSucceeded === next.swapCommitSucceeded
      ) {
        return current
      }
      return next
    })
  }, [postSwapCanonicalStopIdBySlot, postSwapRenderedStopIdBySlot, swapDebugBreadcrumb])
  const guidedRouteStops = useMemo(
    () =>
      finalRoute
        ? [...finalRoute.stops]
            .filter((stop) => stop.role !== 'surprise')
            .sort((left, right) => left.stopIndex - right.stopIndex)
            .map((stop) => ({
              id: stop.id,
              role: stop.role,
              name: stop.displayName,
              displayName: stop.displayName,
              stopIndex: stop.stopIndex,
              latitude: stop.latitude,
              longitude: stop.longitude,
            }))
        : [],
    [finalRoute],
  )
  const guidedWaypointOverrides = useMemo(
    () =>
      Object.fromEntries(
        guidedRouteStops.map((stop) => [
          stop.role,
          typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
            ? {
                name: stop.displayName ?? stop.name,
                coordinates: [stop.longitude, stop.latitude] as [number, number],
              }
            : {
                name: stop.displayName ?? stop.name,
              },
        ]),
      ) as Partial<Record<UserStopRole, JourneyWaypointOverride>>,
    [guidedRouteStops],
  )
  const guidedActiveStop = useMemo(() => {
    if (guidedRouteStops.length === 0) {
      return undefined
    }
    return guidedRouteStops.find((stop) => stop.role === activeRole) ?? guidedRouteStops[0]
  }, [activeRole, guidedRouteStops])
  const guidedActiveStopIndex = useMemo(() => {
    if (!guidedActiveStop) {
      return undefined
    }
    const index = guidedRouteStops.findIndex((stop) => stop.id === guidedActiveStop.id)
    return index >= 0 ? index : undefined
  }, [guidedActiveStop, guidedRouteStops])
  useEffect(() => {
    if (!import.meta.env.DEV || !finalRoute) {
      return
    }
    console.log('MAP REFRESH CHECK', {
      routeId: finalRoute.routeId,
      activeStopId: guidedActiveStop?.id ?? null,
      activeStopIndex: guidedActiveStopIndex ?? null,
      mapStopNames: guidedRouteStops.map((stop) => stop.displayName || stop.name),
    })
  }, [finalRoute, guidedActiveStop?.id, guidedActiveStopIndex, guidedRouteStops])
  useEffect(() => {
    if (!import.meta.env.DEV || !verticalDebugEnabled || !finalRoute) {
      return
    }
    console.log('ROUTE SURFACE CHECK: preview', { routeId: finalRoute.routeId })
    console.log('ROUTE SURFACE CHECK: map', { routeId: finalRoute.routeId })
    console.log('ROUTE SURFACE CHECK: spine', { routeId: finalRoute.routeId })
  }, [finalRoute, verticalDebugEnabled])
  const {
    inlineDetailsByRole,
    swapCandidatePrefilterDebugByRole,
  } = useMemo(() => {
    if (!plan) {
      return {
        inlineDetailsByRole: {} as Partial<Record<UserStopRole, InlineStopDetail>>,
        swapCandidatePrefilterDebugByRole: {} as Partial<
          Record<UserStopRole, SwapCandidatePrefilterDebug>
        >,
      }
    }
    const detailEntries = planningDisplayStops.map((stop) => {
      const scoredVenue = findScoredVenueForStop(stop, plan.selectedArc)
      const inlineDetail = getInlineStopDetail(
        stop,
        plan.intentProfile,
        plan.scoredVenues,
        planningDisplayStops,
        plan.selectedArc,
        plan.lens,
          {
            roleTravelWindowMinutes: getRoleTravelWindow(plan.itinerary, stop.role),
            nearbySummary: nearbySummaryByRole[stop.role],
            routeShapeContract: plan.routeShapeContract,
            baselineItinerary: plan.itinerary,
            finalRouteSnapshot: finalRoute,
            canonicalSwapIdentityByVenueId: swapCanonicalIdentityByVenueId,
            experienceContract: plan.experienceContract,
            contractConstraints: plan.contractConstraints,
          },
        )
      const canonical = canonicalStopByRole[stop.role]
      inlineDetail.venueLinkUrl =
        canonical
          ? buildVenueLinkUrl(stop, canonical.displayName, {
              providerRecordId: canonical.providerRecordId,
              latitude: canonical.latitude,
              longitude: canonical.longitude,
              venueName: canonical.displayName,
            })
          : buildVenueLinkUrl(stop, stop.venueName, {
              providerRecordId: scoredVenue?.venue.source.providerRecordId,
              latitude: scoredVenue?.venue.source.latitude,
              longitude: scoredVenue?.venue.source.longitude,
              venueName: scoredVenue?.venue.name,
            })
      const nearbySummary = nearbySummaryByRole[stop.role]
      if (nearbySummary) {
        inlineDetail.aroundHereSignals = [
          nearbySummary,
          ...(inlineDetail.aroundHereSignals ?? []),
        ].slice(0, 2)
      }
      return [stop.role, inlineDetail] as const
    })
    const prefilterEntries = detailEntries.map(([role, detail]) => [
      role,
      detail.swapCandidatePrefilterDebug,
    ] as const)

    return {
      inlineDetailsByRole: Object.fromEntries(detailEntries) as Partial<
        Record<UserStopRole, InlineStopDetail>
      >,
      swapCandidatePrefilterDebugByRole: Object.fromEntries(prefilterEntries) as Partial<
        Record<UserStopRole, SwapCandidatePrefilterDebug>
      >,
    }
  }, [
    canonicalStopByRole,
    finalRoute,
    nearbySummaryByRole,
    plan,
    planningDisplayStops,
    swapCanonicalIdentityByVenueId,
  ])
  const activeStopInlineDetail = inlineDetailsByRole[activeRole]
  const activeStopNarrativeMode = activeStopInlineDetail?.stopNarrativeMode ?? 'n/a'
  const activeStopNarrativeSource = activeStopInlineDetail?.stopNarrativeSource ?? 'n/a'
  const activeStopFlavorSummary = activeStopInlineDetail?.stopFlavorSummary ?? 'n/a'
  const activeStopTransitionSummary = activeStopInlineDetail?.stopTransitionSummary ?? 'n/a'
  const previewAdjustStops = useMemo(
    () =>
      PREVIEW_ADJUSTABLE_ROLES.map((role) => {
        const detail = inlineDetailsByRole[role]
        const selectedName =
          role === 'start'
            ? previewStartLabel
            : role === 'highlight'
              ? previewHighlightLabel
              : previewWindDownLabel
        return {
          role,
          roleLabel: getPreviewRoleLabel(role),
          roleTone: getPreviewRoleTone(role),
          detailLines: getPreviewStopDetailLines(role),
          selectedName,
          alternatives: detail?.alternatives ?? [],
        }
      }),
    [inlineDetailsByRole, previewHighlightLabel, previewStartLabel, previewWindDownLabel],
  )
  const activeSwapCandidatePrefilterDebug = swapCandidatePrefilterDebugByRole[activeRole]
  const appliedSwapNoteByRole = useMemo(() => {
    if (!appliedSwapRole) {
      return {}
    }
    return {
      [appliedSwapRole]: 'Adjusted while keeping your flow intact',
    } as Partial<Record<UserStopRole, string>>
  }, [appliedSwapRole])
  const postSwapHintByRole = useMemo(() => {
    if (!appliedSwapRole || !plan) {
      return {}
    }
    const hintRole = getPostSwapHintRole(appliedSwapRole)
    const hintText = getPostSwapHintText(appliedSwapRole)
    if (!hintRole || !hintText || !plan.itinerary.stops.some((stop) => stop.role === hintRole)) {
      return {}
    }
    return {
      [hintRole]: hintText,
    } as Partial<Record<UserStopRole, string>>
  }, [appliedSwapRole, plan])

  return (
    <PageShell
      className="sandbox-concierge-shell"
      topSlot={
        <ID8Butler message="Pick a direction, review your route, and lock tonight when it feels right." />
      }
      title="ID.8 Concierge"
      subtitle={undefined}
    >
      <div className="demo-flow-frame concierge-flow">
      <div className="action-row draft-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => setShowDebug((current) => !current)}
        >
          {showDebug ? 'Hide system details' : 'Show system details'}
        </button>
      </div>
      {showDebug && (
      <div
        style={{
          border: '1px solid #d7dde2',
          background: '#f8fafb',
          color: '#31414b',
          padding: '0.55rem 0.7rem',
          borderRadius: '10px',
          fontSize: '0.79rem',
          lineHeight: 1.45,
        }}
      >
        <div>VITE_VERTICAL_DEBUG: {String(verticalDebugEnvValue)}</div>
        <div>verticalDebugEnabled: {String(verticalDebugEnabled)}</div>
        {verticalDebugEnabled && (
          <>
            <div style={{ marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>A. CONTRACT</div>
              <div>interpretationBundlePresent: {String(interpretationBundlePresent)}</div>
              <div>interpretationBundleSource: {interpretationBundleSource}</div>
              <div>interpretationBundleSummary: {interpretationBundleSummary}</div>
              <div>contractSummary: {contractSummary}</div>
              <div>experienceContract.id: {resolvedExperienceContract.id}</div>
              <div>contractIdentity: {resolvedExperienceContract.contractIdentity}</div>
              <div>coordinationMode: {resolvedExperienceContract.coordinationMode}</div>
              <div>highlightModel: {resolvedExperienceContract.highlightModel}</div>
              <div>movementStyle: {resolvedExperienceContract.movementStyle}</div>
              <div>actPattern: {experienceContractActPattern}</div>
            </div>

            <div style={{ marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>B. CONSTRAINTS</div>
              <div>constraintSummary: {constraintSummary}</div>
              <div>peakCountModel: {resolvedContractConstraints.peakCountModel}</div>
              <div>requireEscalation: {String(resolvedContractConstraints.requireEscalation)}</div>
              <div>requireContinuity: {String(resolvedContractConstraints.requireContinuity)}</div>
              <div>requireRecoveryWindows: {String(resolvedContractConstraints.requireRecoveryWindows)}</div>
              <div>socialDensityBand: {resolvedContractConstraints.socialDensityBand}</div>
              <div>windDownStrictness: {resolvedContractConstraints.windDownStrictness}</div>
              <div>highlightPressure: {resolvedContractConstraints.highlightPressure}</div>
            </div>

            <div style={{ marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>C. DISTRICT / DIRECTION</div>
              <div>directionSummary: {directionSummary}</div>
              <div>contractGateWorldPresent: {String(contractGateWorldPresent)}</div>
              <div>contractGateWorldSource: {contractGateWorldSource}</div>
              <div>contractGateWorldSummary: {contractGateWorldSummary}</div>
              <div>contractGateRejectedCount: {contractGateWorldRejectedCount}</div>
              <div>contractGateAllowedPreview: {contractGateWorldAllowedPreview}</div>
              <div>contractGateSuppressedPreview: {contractGateWorldSuppressedPreview}</div>
              <div>strategyWorldsPresent: {String(strategyWorldsPresent)}</div>
              <div>strategyWorldIds: {strategyWorldIds}</div>
              <div>selectedStrategyWorldId: {selectedStrategyWorldId}</div>
              <div>selectedStrategyWorldSource: {selectedStrategyWorldSource}</div>
              <div>selectedStrategyWorldSummary: {selectedStrategyWorldSummary}</div>
              <div>selectedStrategyWorldAdmittedCount: {selectedStrategyWorldAdmittedCount}</div>
              <div>selectedStrategyWorldSuppressedCount: {selectedStrategyWorldSuppressedCount}</div>
              <div>selectedStrategyWorldRejectedCount: {selectedStrategyWorldRejectedCount}</div>
              <div>selectedStrategyWorldAllowedPreview: {selectedStrategyWorldAllowedPreview}</div>
              <div>selectedStrategyWorldSuppressedPreview: {selectedStrategyWorldSuppressedPreview}</div>
              <div>contractAwareDistrictRankingApplied: {String(contractAwareDistrictRanking.applied)}</div>
              <div>
                topPocketIds:{' '}
                {isDebugExpanded('topPocketIds')
                  ? topPocketIdsSummary
                  : formatCollapsedIdPreview(topPocketIds)}
                {topPocketIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleDebugExpanded('topPocketIds')}
                    style={{ marginLeft: '0.35rem', fontSize: '0.74rem' }}
                  >
                    {isDebugExpanded('topPocketIds') ? 'hide' : 'show'}
                  </button>
                )}
              </div>
              <div>
                topPocketContractFitReasons:{' '}
                {isDebugExpanded('topPocketContractFitReasons')
                  ? topPocketContractFitReasonsSummary
                  : formatCollapsedIdPreview(topPocketContractFitReasonsCompact)}
                {topPocketContractFitReasons.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleDebugExpanded('topPocketContractFitReasons')}
                    style={{ marginLeft: '0.35rem', fontSize: '0.74rem' }}
                  >
                    {isDebugExpanded('topPocketContractFitReasons') ? 'hide' : 'show'}
                  </button>
                )}
              </div>
              <div>directionExperienceIdentity: {selectedDirectionExperienceIdentity}</div>
              <div>directionStrategyId: {selectedDirectionStrategyId}</div>
              <div>directionStrategyLabel: {selectedDirectionStrategyLabel}</div>
              <div>directionStrategyFamily: {selectedDirectionStrategyFamily}</div>
              <div>directionStrategySummary: {selectedDirectionStrategySummary}</div>
              <div>directionStrategySource: {selectedDirectionStrategySource}</div>
              <div>directionCollapseGuardApplied: {selectedDirectionCollapseGuardApplied}</div>
              <div>directionStrategyOverlapSummary: {selectedDirectionStrategyOverlapSummary}</div>
              <div>strategyConstraintStatus: {selectedDirectionStrategyConstraintStatus}</div>
              <div>strategyPoolSize: {selectedDirectionStrategyPoolSize}</div>
              <div>strategyRejectedCount: {selectedDirectionStrategyRejectedCount}</div>
              <div>strategyHardGuardStatus: {selectedDirectionStrategyHardGuardStatus}</div>
              <div>strategyHardGuardReason: {selectedDirectionStrategyHardGuardReason}</div>
              <div>contractGateApplied: {selectedContractGateApplied}</div>
              <div>contractGateSummary: {selectedContractGateSummary}</div>
              <div>gateStrengthSummary: {selectedContractGateStrengthSummary}</div>
              <div>contractGateRejectedCount: {selectedContractGateRejectedCount}</div>
              <div>contractGateAllowedPreview: {selectedContractGateAllowedPreview}</div>
              <div>contractGateSuppressedPreview: {selectedContractGateSuppressedPreview}</div>
              <div>
                contractGateStrategyFamilyResolution: {contractGateStrategyFamilyResolutionSummary}
              </div>
              <div>directionContractGateStatus: {selectedDirectionContractGateStatus}</div>
              <div>directionContractGateReasonSummary: {selectedDirectionContractGateReasonSummary}</div>
              <div>directionStrategyWorldStatus: {selectedDirectionStrategyWorldStatus}</div>
              <div>directionStrategyWorldReasonSummary: {selectedDirectionStrategyWorldReasonSummary}</div>
              <div>directionDistrictSupportSummary: {selectedDirectionDistrictSupportSummary}</div>
              <div>directionNarrativeSummary: {selectedDirectionNarrativeSummary}</div>
              <div>compareSummary: {compareSummary}</div>
              <div>stageScenarioKeys: {trackedScenarioKeysSummary}</div>
              <div>scenarioJaccardByStage: {scenarioJaccardByStage}</div>
            </div>

            <div style={{ marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>D. GENERATION</div>
              <div>generationSummary: {generationSummary}</div>
              <div>retrievalContractApplied: {String(retrievalContractApplied)}</div>
              <div>
                retrievedVenueIds:{' '}
                {isDebugExpanded('retrievedVenueIds')
                  ? retrievedVenueIdsSummary
                  : formatCollapsedIdPreview(retrievedVenueIds)}
                {retrievedVenueIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleDebugExpanded('retrievedVenueIds')}
                    style={{ marginLeft: '0.35rem', fontSize: '0.74rem' }}
                  >
                    {isDebugExpanded('retrievedVenueIds') ? 'hide' : 'show'}
                  </button>
                )}
              </div>
              <div>
                rolePoolVenueIdsByRole:{' '}
                {isDebugExpanded('rolePoolVenueIdsByRole')
                  ? rolePoolVenueIdsByRoleSummary
                  : rolePoolCountsSummary}
                {rolePoolVenueIdsByRole && (
                  <button
                    type="button"
                    onClick={() => toggleDebugExpanded('rolePoolVenueIdsByRole')}
                    style={{ marginLeft: '0.35rem', fontSize: '0.74rem' }}
                  >
                    {isDebugExpanded('rolePoolVenueIdsByRole') ? 'hide' : 'show'}
                  </button>
                )}
              </div>
              <div>
                highlightShortlistIds:{' '}
                {isDebugExpanded('highlightShortlistIds')
                  ? highlightShortlistIdsSummary
                  : formatCollapsedIdPreview(highlightShortlistIds)}
                {highlightShortlistIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleDebugExpanded('highlightShortlistIds')}
                    style={{ marginLeft: '0.35rem', fontSize: '0.74rem' }}
                  >
                    {isDebugExpanded('highlightShortlistIds') ? 'hide' : 'show'}
                  </button>
                )}
              </div>
              <div>
                finalStopVenueIds:{' '}
                {isDebugExpanded('finalStopVenueIds')
                  ? finalStopVenueIdsSummary
                  : formatCollapsedIdPreview(finalStopVenueIds)}
                {finalStopVenueIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleDebugExpanded('finalStopVenueIds')}
                    style={{ marginLeft: '0.35rem', fontSize: '0.74rem' }}
                  >
                    {isDebugExpanded('finalStopVenueIds') ? 'hide' : 'show'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>E. RUNTIME / SWAP</div>
              <div>runtimeSummary: {runtimeSummary}</div>
              <div>directionSyncStatus: {directionSyncStatusMarker} {directionSyncStatus}</div>
              <div>generationDriftReason: {generationDriftMarker} {generationDriftReason ?? 'none'}</div>
              <div>missingRoleForContract: {missingRoleMarker}</div>
              <div>swapCompatibilityReason: {swapMarker} {swapCompatibilityReason}</div>
              <div>swapRequestedReplacementId: {swapRequestedReplacementId}</div>
              <div>swapAppliedReplacementId: {swapAppliedReplacementId}</div>
              <div>activeStopNarrativeMode: {activeStopNarrativeMode}</div>
              <div>activeStopNarrativeSource: {activeStopNarrativeSource}</div>
              <div>activeStopFlavorSummary: {activeStopFlavorSummary}</div>
              <div>activeStopTransitionSummary: {activeStopTransitionSummary}</div>
              {(swapInteractionBreadcrumb || swapCompatibilityDebug || swapDebugBreadcrumb) && (
                <div>
                  swapTraceDetails:{' '}
                  <button
                    type="button"
                    onClick={() => toggleDebugExpanded('swapTraceDetails')}
                    style={{ marginLeft: '0.2rem', fontSize: '0.74rem' }}
                  >
                    {isDebugExpanded('swapTraceDetails') ? 'hide' : 'show'}
                  </button>
                </div>
              )}
              {isDebugExpanded('swapTraceDetails') && (
                <>
                  <div>
                    swapTrace.swapClickFired:{' '}
                    {swapInteractionBreadcrumb
                      ? String(swapInteractionBreadcrumb.swapClickFired)
                      : 'n/a'}
                  </div>
                  <div>
                    swapTrace.swapGuardFailureReason:{' '}
                    {swapInteractionBreadcrumb?.swapGuardFailureReason ?? 'none'}
                  </div>
                  <div>
                    swapTrace.swapCompatibilityRejectClass:{' '}
                    {swapCompatibilityDebug?.swapCompatibilityRejectClass ?? 'n/a'}
                  </div>
                  <div>
                    swapTrace.postSwapCanonicalStopIdBySlot:{' '}
                    {swapDebugBreadcrumb
                      ? formatCollapsedIdPreview(
                          swapDebugBreadcrumb.postSwapCanonicalStopIdBySlot ?? [],
                        )
                      : 'n/a'}
                  </div>
                  <div>
                    swapTrace.postSwapRenderedStopIdBySlot:{' '}
                    {swapDebugBreadcrumb
                      ? formatCollapsedIdPreview(
                          swapDebugBreadcrumb.postSwapRenderedStopIdBySlot ?? [],
                        )
                      : 'n/a'}
                  </div>
                </>
              )}
            </div>

            <details
              style={{ marginTop: '0.6rem' }}
              open={isDebugExpanded('legacyDebugDetails')}
              onToggle={(event) =>
                setDebugExpanded('legacyDebugDetails', (event.target as HTMLDetailsElement).open)
              }
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                Legacy full debug details (all signals preserved)
              </summary>
              <div style={{ marginTop: '0.4rem' }}>
            <div>selectedDirectionId: {selectedDirectionContractId ?? 'n/a'}</div>
            <div>selectedDirectionPocketId: {selectedDirectionPocketId ?? 'n/a'}</div>
            <div>
              selectedDirectionContext.id:{' '}
              {resolvedSelectedDirectionContext?.selectedDirectionId ?? 'n/a'}
            </div>
            <div>selectedDirectionContextIdentity: {selectedDirectionContextIdentity ?? 'n/a'}</div>
            <div>directionExperienceIdentity: {selectedDirectionExperienceIdentity}</div>
            <div>directionPrimaryIdentitySource: {selectedDirectionPrimaryIdentitySource}</div>
            <div>directionPeakModel: {selectedDirectionPeakModel}</div>
            <div>directionMovementStyle: {selectedDirectionMovementStyle}</div>
            <div>directionDistrictSupportSummary: {selectedDirectionDistrictSupportSummary}</div>
            <div>directionStrategyId: {selectedDirectionStrategyId}</div>
            <div>directionStrategyLabel: {selectedDirectionStrategyLabel}</div>
            <div>directionStrategyFamily: {selectedDirectionStrategyFamily}</div>
            <div>directionStrategySummary: {selectedDirectionStrategySummary}</div>
            <div>directionStrategySource: {selectedDirectionStrategySource}</div>
            <div>directionCollapseGuardApplied: {selectedDirectionCollapseGuardApplied}</div>
            <div>directionStrategyOverlapSummary: {selectedDirectionStrategyOverlapSummary}</div>
            <div>strategyConstraintStatus: {selectedDirectionStrategyConstraintStatus}</div>
            <div>strategyPoolSize: {selectedDirectionStrategyPoolSize}</div>
            <div>strategyRejectedCount: {selectedDirectionStrategyRejectedCount}</div>
            <div>strategyHardGuardStatus: {selectedDirectionStrategyHardGuardStatus}</div>
            <div>strategyHardGuardReason: {selectedDirectionStrategyHardGuardReason}</div>
            <div>contractGateApplied: {selectedContractGateApplied}</div>
            <div>contractGateSummary: {selectedContractGateSummary}</div>
            <div>gateStrengthSummary: {selectedContractGateStrengthSummary}</div>
            <div>contractGateRejectedCount: {selectedContractGateRejectedCount}</div>
            <div>contractGateAllowedPreview: {selectedContractGateAllowedPreview}</div>
            <div>contractGateSuppressedPreview: {selectedContractGateSuppressedPreview}</div>
            <div>
              contractGateStrategyFamilyResolution: {contractGateStrategyFamilyResolutionSummary}
            </div>
            <div>directionContractGateStatus: {selectedDirectionContractGateStatus}</div>
            <div>directionContractGateReasonSummary: {selectedDirectionContractGateReasonSummary}</div>
            <div>directionStrategyWorldStatus: {selectedDirectionStrategyWorldStatus}</div>
            <div>directionStrategyWorldReasonSummary: {selectedDirectionStrategyWorldReasonSummary}</div>
            <div>selectedStrategyWorldId: {selectedStrategyWorldId}</div>
            <div>selectedStrategyWorldSource: {selectedStrategyWorldSource}</div>
            <div>selectedStrategyWorldSummary: {selectedStrategyWorldSummary}</div>
            <div>selectedStrategyWorldAdmittedCount: {selectedStrategyWorldAdmittedCount}</div>
            <div>selectedStrategyWorldSuppressedCount: {selectedStrategyWorldSuppressedCount}</div>
            <div>selectedStrategyWorldRejectedCount: {selectedStrategyWorldRejectedCount}</div>
            <div>selectedStrategyWorldAllowedPreview: {selectedStrategyWorldAllowedPreview}</div>
            <div>selectedStrategyWorldSuppressedPreview: {selectedStrategyWorldSuppressedPreview}</div>
            <div>directionNarrativeSource: {selectedDirectionNarrativeSource}</div>
            <div>directionNarrativeMode: {selectedDirectionNarrativeMode}</div>
            <div>directionNarrativeSummary: {selectedDirectionNarrativeSummary}</div>
            <div>directionSyncStatus: {directionSyncStatus}</div>
            <div>directionSyncMismatch: {String(directionSyncMismatch)}</div>
            <div>previewDirectionId: {previewDirectionId ?? 'n/a'}</div>
            <div>finalRouteDirectionId: {finalRouteDirectionId ?? 'n/a'}</div>
            <div>interpretationBundlePresent: {String(interpretationBundlePresent)}</div>
            <div>interpretationBundleSource: {interpretationBundleSource}</div>
            <div>interpretationBundleSummary: {interpretationBundleSummary}</div>
            <div>contractGateWorldPresent: {String(contractGateWorldPresent)}</div>
            <div>contractGateWorldSource: {contractGateWorldSource}</div>
            <div>contractGateWorldSummary: {contractGateWorldSummary}</div>
            <div>contractGateWorldRejectedCount: {contractGateWorldRejectedCount}</div>
            <div>contractGateWorldAllowedPreview: {contractGateWorldAllowedPreview}</div>
            <div>contractGateWorldSuppressedPreview: {contractGateWorldSuppressedPreview}</div>
            <div>strategyWorldsPresent: {String(strategyWorldsPresent)}</div>
            <div>strategyWorldIds: {strategyWorldIds}</div>
            <div>conciergeIntent.id: {conciergeIntentId ?? 'n/a'}</div>
            <div>conciergeIntent.intentMode: {conciergeIntentMode ?? 'n/a'}</div>
            <div>
              conciergeIntent.objective.primary: {conciergeIntentObjectivePrimary ?? 'n/a'}
            </div>
            <div>
              conciergeIntent.controlPosture.mode: {conciergeIntentControlMode ?? 'n/a'}
            </div>
            <div>conciergeIntent.persona: {conciergeIntentPersona ?? 'n/a'}</div>
            <div>conciergeIntent.vibe: {conciergeIntentVibe ?? 'n/a'}</div>
            <div>conciergeIntent.anchorPosture.mode: {conciergeIntentAnchorMode ?? 'n/a'}</div>
            <div>conciergeIntent.source: {conciergeIntentSource}</div>
            <div>
              conciergeIntent.constraintPosture.travelTolerance:{' '}
              {conciergeIntentTravelTolerance ?? 'n/a'}
            </div>
            <div>
              conciergeIntent.constraintPosture.swapTolerance:{' '}
              {conciergeIntentSwapTolerance ?? 'n/a'}
            </div>
            <div>experienceContract.id: {resolvedExperienceContract.id}</div>
            <div>
              experienceContract.contractIdentity:{' '}
              {resolvedExperienceContract.contractIdentity}
            </div>
            <div>
              experienceContract.coordinationMode:{' '}
              {resolvedExperienceContract.coordinationMode}
            </div>
            <div>
              experienceContract.highlightModel:{' '}
              {resolvedExperienceContract.highlightModel}
            </div>
            <div>
              experienceContract.highlightType: {resolvedExperienceContract.highlightType}
            </div>
            <div>
              experienceContract.movementStyle: {resolvedExperienceContract.movementStyle}
            </div>
            <div>
              experienceContract.socialPosture: {resolvedExperienceContract.socialPosture}
            </div>
            <div>
              experienceContract.pacingStyle: {resolvedExperienceContract.pacingStyle}
            </div>
            <div>experienceContract.actPattern: {experienceContractActPattern}</div>
            <div>
              experienceContract.contractReasonSummary:{' '}
              {resolvedExperienceContract.debug.contractReasonSummary}
            </div>
            <div>experienceContract.source: {experienceContractSource}</div>
            <div>contractConstraints.id: {resolvedContractConstraints.id}</div>
            <div>
              contractConstraints.peakCountModel: {resolvedContractConstraints.peakCountModel}
            </div>
            <div>
              contractConstraints.requireEscalation:{' '}
              {String(resolvedContractConstraints.requireEscalation)}
            </div>
            <div>
              contractConstraints.requireContinuity:{' '}
              {String(resolvedContractConstraints.requireContinuity)}
            </div>
            <div>
              contractConstraints.requireRecoveryWindows:{' '}
              {String(resolvedContractConstraints.requireRecoveryWindows)}
            </div>
            <div>
              contractConstraints.maxEnergyDropTolerance:{' '}
              {resolvedContractConstraints.maxEnergyDropTolerance}
            </div>
            <div>
              contractConstraints.socialDensityBand: {resolvedContractConstraints.socialDensityBand}
            </div>
            <div>
              contractConstraints.movementTolerance:{' '}
              {resolvedContractConstraints.movementTolerance}
            </div>
            <div>
              contractConstraints.allowLateHighEnergy:{' '}
              {String(resolvedContractConstraints.allowLateHighEnergy)}
            </div>
            <div>
              contractConstraints.windDownStrictness:{' '}
              {resolvedContractConstraints.windDownStrictness}
            </div>
            <div>
              contractConstraints.highlightPressure:{' '}
              {resolvedContractConstraints.highlightPressure}
            </div>
            <div>
              contractConstraints.multiAnchorAllowed:{' '}
              {String(resolvedContractConstraints.multiAnchorAllowed)}
            </div>
            <div>
              contractConstraints.groupBasecampPreferred:{' '}
              {String(resolvedContractConstraints.groupBasecampPreferred)}
            </div>
            <div>
              contractConstraints.kidEngagementRequired:{' '}
              {String(resolvedContractConstraints.kidEngagementRequired)}
            </div>
            <div>
              contractConstraints.adultPayoffRequired:{' '}
              {String(resolvedContractConstraints.adultPayoffRequired)}
            </div>
            <div>
              contractConstraints.constraintReasonSummary:{' '}
              {resolvedContractConstraints.debug.constraintReasonSummary}
            </div>
            <div>contractConstraints.source: {contractConstraintsSource}</div>
            <div>executionBridgeSummary: {executionBridgeSummary}</div>
            <div>
              contractAwareDistrictRankingApplied: {String(contractAwareDistrictRanking.applied)}
            </div>
            <div>retrievalContractApplied: {String(retrievalContractApplied)}</div>
            <div>contractInfluenceSummary: {contractInfluenceSummary}</div>
            <div>topPocketIds: {topPocketIdsSummary}</div>
            <div>topPocketContractFitDeltas: {topPocketContractFitDeltasSummary}</div>
            <div>topPocketContractFitReasons: {topPocketContractFitReasonsSummary}</div>
            <div>directionCandidatePocketIds: {directionCandidatePocketIdsSummary}</div>
            <div>directionStrategyIds: {formatIdList(directionStrategyIds)}</div>
            <div>retrievedVenueIds: {retrievedVenueIdsSummary}</div>
            <div>rolePoolVenueIdsByRole: {rolePoolVenueIdsByRoleSummary}</div>
            <div>rolePoolVenueIds: {rolePoolVenueIdsSummary}</div>
            <div>highlightShortlistIds: {highlightShortlistIdsSummary}</div>
            <div>finalStopVenueIds: {finalStopVenueIdsSummary}</div>
            <div>stageScenarioKeys: {trackedScenarioKeysSummary}</div>
            <div>scenarioJaccardByStage: {scenarioJaccardByStage}</div>
            <div>routeShapeContract.id: {routeShapeContractId ?? 'n/a'}</div>
            <div>routeShapeContract.arcShape: {routeShapeArcShape ?? 'n/a'}</div>
            <div>
              routeShapeContract.mutationProfile.swapFlexibility:{' '}
              {routeShapeSwapFlexibility ?? 'n/a'}
            </div>
            <div>routeShapeContract.movementProfile.radius: {routeShapeMovementRadius ?? 'n/a'}</div>
            <div>routeShapeContract.roleInvariants.start: {routeShapeStartInvariantSummary}</div>
            <div>
              routeShapeContract.roleInvariants.highlight: {routeShapeHighlightInvariantSummary}
            </div>
            <div>
              routeShapeContract.roleInvariants.windDown: {routeShapeWindDownInvariantSummary}
            </div>
            <div>generationDriftReason: {generationDriftReason ?? 'none'}</div>
            <div>contractBuildabilityStatus: {contractBuildabilityStatus ?? 'n/a'}</div>
            <div>missingRoleForContract: {missingRoleForContract ?? 'n/a'}</div>
            <div>expectedDirectionIdentity: {expectedDirectionIdentity ?? 'n/a'}</div>
            <div>observedDirectionIdentity: {observedDirectionIdentity ?? 'n/a'}</div>
            <div>generationIdentityFallbackApplied: {String(generationIdentityFallbackApplied)}</div>
            <div>candidatePoolSufficiencyByRole: {candidatePoolSufficiencySummary ?? 'n/a'}</div>
            <div>thinPoolDirectionRelaxation: {thinPoolDirectionRelaxationSummary}</div>
            <div>highlightQualificationScore: {highlightQualificationScore}</div>
            <div>highlightQualificationPassed: {highlightQualificationPassed}</div>
            <div>highlightPoolCountBefore: {highlightPoolCountBefore}</div>
            <div>highlightPoolCountAfter: {highlightPoolCountAfter}</div>
            <div>rolePoolCountByRoleBefore: {rolePoolCountByRoleBeforeSummary}</div>
            <div>rolePoolCountByRoleAfter: {rolePoolCountByRoleAfterSummary}</div>
            <div>
              signatureHighlightShortlistCount: {signatureHighlightShortlistCount}
            </div>
            <div>signatureHighlightShortlistIds: {signatureHighlightShortlistIds}</div>
            <div>highlightShortlistScoreSummary: {highlightShortlistScoreSummary}</div>
            <div>
              selectedHighlightFromShortlist: {selectedHighlightFromShortlist}
            </div>
            <div>
              selectedHighlightShortlistRank: {selectedHighlightShortlistRank}
            </div>
            <div>
              fallbackToQualifiedHighlightPool: {fallbackToQualifiedHighlightPool}
            </div>
            <div>tasteRoleEligibilityByRole: {tasteRoleEligibilityByRoleSummary}</div>
            <div>personaVibeTasteBias: {personaVibeTasteBiasSummary}</div>
            <div>venuePersonalitySummary: {venuePersonalitySummary}</div>
            <div>
              selectedStartTasteSignals: {selectedStartTasteSignalsSummary}
            </div>
            <div>
              selectedStartTasteRoleSuitability: {selectedStartTasteRoleSuitabilitySummary}
            </div>
            <div>
              selectedStartVenuePersonality: {selectedStartTastePersonalitySummary}
            </div>
            <div>
              selectedHighlightTasteSignals: {selectedHighlightTasteSignalsSummary}
            </div>
            <div>
              selectedHighlightTasteRoleSuitability:{' '}
              {selectedHighlightTasteRoleSuitabilitySummary}
            </div>
            <div>
              selectedHighlightVenuePersonality: {selectedHighlightTastePersonalitySummary}
            </div>
            <div>selectedHighlightTasteTier: {selectedHighlightTasteTier}</div>
            <div>selectedHighlightDurationEstimate: {selectedHighlightTasteDuration}</div>
            <div>selectedHighlightNoveltyWeight: {selectedHighlightTasteNovelty}</div>
            <div>selectedHighlightTasteSourceMode: {selectedHighlightTasteSourceMode}</div>
            <div>selectedHighlightRoleContrast: {selectedHighlightRoleContrast}</div>
            <div>selectedHighlightTierReason: {selectedHighlightTierReason}</div>
            <div>selectedHighlightVibeFit: {selectedHighlightVibeFit}</div>
            <div>selectedHighlightEnergyBand: {selectedHighlightEnergyBand}</div>
            <div>selectedHighlightSocialDensityBand: {selectedHighlightSocialDensityBand}</div>
            <div>vibePressureSummary: {vibePressureSummary}</div>
            <div>toneSeparationSummary: {toneSeparationSummary}</div>
            <div>
              selectedHighlightSeedCalibratedApplied:{' '}
              {selectedHighlightTasteSeedCalibratedApplied}
            </div>
            <div>
              selectedWindDownTasteSignals: {selectedWindDownTasteSignalsSummary}
            </div>
            <div>
              selectedWindDownTasteRoleSuitability:{' '}
              {selectedWindDownTasteRoleSuitabilitySummary}
            </div>
            <div>
              selectedWindDownVenuePersonality: {selectedWindDownTastePersonalitySummary}
            </div>
            <div>upstreamPoolSelectionApplied: {upstreamPoolSelectionApplied}</div>
            <div>postGenerationRepairCount: {postGenerationRepairCount}</div>
            <div>
              thinPoolHighlightFallbackApplied: {thinPoolHighlightFallbackApplied}
            </div>
            <div>thinPoolHighlightRelaxation: {thinPoolHighlightRelaxationSummary}</div>
            <div>swapPrefilterActiveRole: {activeRole}</div>
            <div>
              swapCanonicalIdentityCacheResolvedCount: {swapCanonicalIdentityCacheResolvedCount}
            </div>
            <div>
              swapCanonicalIdentityCacheMissingCount: {swapCanonicalIdentityCacheMissingCount}
            </div>
            <div>
              swapCandidateDisplayCountBefore:{' '}
              {activeSwapCandidatePrefilterDebug?.swapCandidateDisplayCountBefore ?? 'n/a'}
            </div>
            <div>
              swapCandidateDisplayCountAfter:{' '}
              {activeSwapCandidatePrefilterDebug?.swapCandidateDisplayCountAfter ?? 'n/a'}
            </div>
            <div>
              canonicalIdentityResolvedCount:{' '}
              {activeSwapCandidatePrefilterDebug?.canonicalIdentityResolvedCount ?? 'n/a'}
            </div>
            <div>
              canonicalIdentityMissingCount:{' '}
              {activeSwapCandidatePrefilterDebug?.canonicalIdentityMissingCount ?? 'n/a'}
            </div>
            <div>
              prefilteredSwapCandidateIds:{' '}
              {(activeSwapCandidatePrefilterDebug?.prefilteredSwapCandidateIds ?? []).join(', ') || 'n/a'}
            </div>
            <div>
              prefilterRejectReasonSummary:{' '}
              {(activeSwapCandidatePrefilterDebug?.prefilterRejectReasonSummary ?? []).join(' | ') ||
                'n/a'}
            </div>
            <div>
              swapDisplayUsesSharedHardStructuralCheck:{' '}
              {String(
                activeSwapCandidatePrefilterDebug?.swapDisplayUsesSharedHardStructuralCheck ?? false,
              )}
            </div>
            {swapInteractionBreadcrumb && (
              <>
                <div>swapClickFired: {String(swapInteractionBreadcrumb.swapClickFired)}</div>
                <div>swapHandlerEntered: {String(swapInteractionBreadcrumb.swapHandlerEntered)}</div>
                <div>
                  swapCandidateAtClickId: {swapInteractionBreadcrumb.swapCandidateAtClickId ?? 'n/a'}
                </div>
                <div>
                  swapCandidateCanonicalIdentityAtClick:{' '}
                  {swapInteractionBreadcrumb.swapCandidateCanonicalIdentityAtClick ?? 'n/a'}
                </div>
                <div>
                  candidateHasCanonicalIdentity:{' '}
                  {String(swapInteractionBreadcrumb.candidateHasCanonicalIdentity ?? false)}
                </div>
                <div>
                  swapTargetSlotIndexAtClick:{' '}
                  {swapInteractionBreadcrumb.swapTargetSlotIndexAtClick ?? 'n/a'}
                </div>
                <div>
                  swapTargetRoleAtClick: {swapInteractionBreadcrumb.swapTargetRoleAtClick ?? 'n/a'}
                </div>
                <div>
                  swapGuardFailureReason: {swapInteractionBreadcrumb.swapGuardFailureReason ?? 'none'}
                </div>
                <div>swapCommitStarted: {String(swapInteractionBreadcrumb.swapCommitStarted)}</div>
                <div>swapCommitFinished: {String(swapInteractionBreadcrumb.swapCommitFinished)}</div>
                <div>
                  swapModalClosedAfterCommit:{' '}
                  {String(swapInteractionBreadcrumb.swapModalClosedAfterCommit)}
                </div>
              </>
            )}
            {swapCompatibilityDebug && (
              <>
                <div>
                  swapCompatibilityPassed: {String(swapCompatibilityDebug.swapCompatibilityPassed)}
                </div>
                <div>swapCompatibilityReason: {swapCompatibilityDebug.swapCompatibilityReason}</div>
                <div>
                  swapCompatibilityRejectClass: {swapCompatibilityDebug.swapCompatibilityRejectClass}
                </div>
                <div>
                  swapRejectSource:{' '}
                  {swapCompatibilityDebug.swapCompatibilityRejectClass === 'hard_structural'
                    ? 'hard structural invalidity'
                    : swapCompatibilityDebug.swapCompatibilityRejectClass === 'soft_direction_drift'
                      ? 'soft direction drift'
                      : 'none'}
                </div>
                <div>preservedRole: {String(swapCompatibilityDebug.preservedRole)}</div>
                <div>preservedDistrict: {String(swapCompatibilityDebug.preservedDistrict)}</div>
                <div>preservedFamily: {String(swapCompatibilityDebug.preservedFamily)}</div>
                <div>
                  preservedFeasibility: {String(swapCompatibilityDebug.preservedFeasibility)}
                </div>
                <div>
                  softDirectionDriftDetected:{' '}
                  {String(swapCompatibilityDebug.softDirectionDriftDetected)}
                </div>
              </>
            )}
            {swapDebugBreadcrumb && (
              <>
                <div>swapTargetSlotIndex: {swapDebugBreadcrumb.swapTargetSlotIndex}</div>
                <div>swapTargetRole: {swapDebugBreadcrumb.swapTargetRole}</div>
                <div>swapBeforeStopId: {swapDebugBreadcrumb.swapBeforeStopId}</div>
                <div>swapRequestedReplacementId: {swapDebugBreadcrumb.swapRequestedReplacementId}</div>
                <div>
                  swapAppliedReplacementId: {swapDebugBreadcrumb.swapAppliedReplacementId ?? 'n/a'}
                </div>
                <div>swapCommitSucceeded: {String(swapDebugBreadcrumb.swapCommitSucceeded)}</div>
                <div>swapRenderSource: {swapDebugBreadcrumb.swapRenderSource}</div>
                <div>
                  postSwapCanonicalStopIdBySlot:{' '}
                  {(swapDebugBreadcrumb.postSwapCanonicalStopIdBySlot ?? []).join(', ') || 'n/a'}
                </div>
                <div>
                  postSwapRenderedStopIdBySlot:{' '}
                  {(swapDebugBreadcrumb.postSwapRenderedStopIdBySlot ?? []).join(', ') || 'n/a'}
                </div>
                <div>routeVersion: {swapDebugBreadcrumb.routeVersion}</div>
                {swapDebugBreadcrumb.mismatch && (
                  <div>
                    SWAP_ID_MISMATCH: requested {swapDebugBreadcrumb.swapRequestedReplacementId} but
                    applied {swapDebugBreadcrumb.swapAppliedReplacementId ?? 'n/a'}
                    {' | '}
                    canonicalAtSlot{' '}
                    {swapDebugBreadcrumb.postSwapCanonicalStopIdBySlot?.[
                      swapDebugBreadcrumb.swapTargetSlotIndex
                    ] ?? 'n/a'}
                    {' | '}
                    renderedAtSlot{' '}
                    {swapDebugBreadcrumb.postSwapRenderedStopIdBySlot?.[
                      swapDebugBreadcrumb.swapTargetSlotIndex
                    ] ?? 'n/a'}
                  </div>
                )}
              </>
            )}
              </div>
            </details>
          </>
        )}
      </div>
      )}

      <section className="preview-adjustments draft-tune-panel">
        <p className="kicker reality-curated-label">Set your night</p>
        <p className="instruction concierge-context-line">
          Tell us what kind of night you want.
        </p>
        <div className="intent-brief">
          <div className="brief-line">{intentBriefLine}</div>
          <div className="controls preview-adjustments-grid compact">
            <label className="input-group inline-field">
              <span className="input-label">Location</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City, ST"
              />
            </label>
            <label className="input-group inline-field">
              <span className="input-label">Persona</span>
              <select
                value={persona}
                onChange={(event) =>
                  setPersona(event.target.value as PersonaMode)
                }
              >
                {personaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-group inline-field">
              <span className="input-label">Vibe</span>
              <select
                value={primaryVibe}
                onChange={(event) =>
                  setPrimaryVibe(event.target.value as VibeAnchor)
                }
              >
                {vibeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className="local-context reality-step-supporting-line">
          Using nearby district signals to shape your options.
        </p>
      </section>

      <section className="district-discovery">
        <h4>Explore what&apos;s possible</h4>
        <p className="district-subtext">
          See what&apos;s happening nearby and how your night could unfold.
        </p>
        {showStep2SecondarySurfaces && (
          <div className="step2-ecs-controls" aria-label="Exploration controls">
            <div className="step2-ecs-group">
              <p className="step2-ecs-label">Exploration</p>
              <div className="step2-ecs-options">
                {ECS_EXPLORATION_OPTIONS.map((option) => (
                  <button
                    key={`ecs_exploration_${option.value}`}
                    type="button"
                    className={`step2-ecs-option${ecsState.exploration === option.value ? ' selected' : ''}`}
                    onClick={() =>
                      setEcsState((current) => ({
                        ...current,
                        exploration: option.value,
                      }))
                    }
                    aria-pressed={ecsState.exploration === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="step2-ecs-group">
              <p className="step2-ecs-label">Discovery</p>
              <div className="step2-ecs-options">
                {ECS_DISCOVERY_OPTIONS.map((option) => (
                  <button
                    key={`ecs_discovery_${option.value}`}
                    type="button"
                    className={`step2-ecs-option${ecsState.discovery === option.value ? ' selected' : ''}`}
                    onClick={() =>
                      setEcsState((current) => ({
                        ...current,
                        discovery: option.value,
                      }))
                    }
                    aria-pressed={ecsState.discovery === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="step2-ecs-group">
              <p className="step2-ecs-label">Highlight</p>
              <div className="step2-ecs-options">
                {ECS_HIGHLIGHT_OPTIONS.map((option) => (
                  <button
                    key={`ecs_highlight_${option.value}`}
                    type="button"
                    className={`step2-ecs-option${ecsState.highlight === option.value ? ' selected' : ''}`}
                    onClick={() =>
                      setEcsState((current) => ({
                        ...current,
                        highlight: option.value,
                      }))
                    }
                    aria-pressed={ecsState.highlight === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="step2-night-options">
          <p className="step2-night-options-label">Choose tonight's direction</p>
          <div className="step2-night-options-grid">
            {step2BuiltNightCards.map((option) => {
              const sourceOption = verifiedCityOpportunityById.get(option.id)
              if (!sourceOption) {
                return null
              }
              const isSelected =
                (option.selection.directionId &&
                  selectedDirectionId === option.selection.directionId) ||
                (!option.selection.directionId &&
                  option.selection.pocketId &&
                  activeDistrictPocketId === option.selection.pocketId)
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`district-card step2-night-option${isSelected ? ' selected' : ''}`}
                  onClick={() => handleSelectStep2NightOption(sourceOption)}
                  aria-pressed={isSelected}
                >
                  <h5 className="step2-night-option-anchor-title">{option.anchorName}</h5>
                  <p className="step2-night-option-flavor-line">{option.flavorLine}</p>
                  <div className="step2-night-option-traits">
                    {option.traits.slice(0, 3).map((trait) => (
                      <span key={`${option.id}_${trait}`} className="step2-night-option-trait">
                        {trait}
                      </span>
                    ))}
                  </div>
                  <div className="step2-night-option-story-spine">
                    <div className="step2-night-option-story-row">
                      <span className="step2-night-option-story-role">Start</span>
                      <span className="step2-night-option-story-stop">{option.storySpine.start}</span>
                    </div>
                    <div className="step2-night-option-story-row highlight">
                      <span className="step2-night-option-story-role">Highlight</span>
                      <span className="step2-night-option-story-stop">{option.storySpine.highlight}</span>
                    </div>
                    <div className="step2-night-option-story-row">
                      <span className="step2-night-option-story-role">Wind-down</span>
                      <span className="step2-night-option-story-stop">{option.storySpine.windDown}</span>
                    </div>
                  </div>
                  <p className="step2-night-option-context">{option.districtLine}</p>
                  <p className="step2-night-option-match">{option.whyChooseLine}</p>
                  {option.whyTonightProofLine ? (
                    <p className="step2-night-option-match">{option.whyTonightProofLine}</p>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
        {showStep2SecondarySurfaces && (
          <>
            <p className="step2-district-context-label supporting">Area context</p>
            <div className="district-discovery-grid step2-area-context-supporting">
              <button
                type="button"
                className={`district-card district-context-card${
                  activeDistrictPocketId === ALL_DISTRICTS_CONTEXT_ID ? ' selected' : ''
                } supporting`}
                onClick={() => setActiveDistrictPocketId(ALL_DISTRICTS_CONTEXT_ID)}
                aria-pressed={activeDistrictPocketId === ALL_DISTRICTS_CONTEXT_ID}
              >
                <div className="district-title">Flexible (multiple areas)</div>
                {activeDistrictPocketId === ALL_DISTRICTS_CONTEXT_ID && (
                  <span className="district-chip">Active area</span>
                )}
                <p className="district-character">{flexibleDistrictCardContent.summaryLine}</p>
                <ul className="district-signals">
                  <li>{flexibleDistrictCardContent.anchorLine}</li>
                  <li>{flexibleDistrictCardContent.ingredientLine}</li>
                </ul>
                <div className="district-best-for">
                  Strong match for your {selectedVibeLabel.toLowerCase()}, {selectedPersonaLabel.toLowerCase()} intent
                </div>
              </button>
              {districtDiscoveryCards.slice(0, 3).map((pocket) => (
                <button
                  key={pocket.id}
                  type="button"
                  className={`district-card district-context-card${
                    activeDistrictPocketId === pocket.id ? ' selected' : ''
                  } supporting`}
                  onClick={() => setActiveDistrictPocketId(pocket.id)}
                  aria-pressed={activeDistrictPocketId === pocket.id}
                >
                  <div className="district-title">{pocket.name}</div>
                  <span className="district-chip">{pocket.rankLabel}</span>
                  {activeDistrictPocketId === pocket.id && (
                    <span className="district-chip">Active area</span>
                  )}
                  <p className="district-character">{pocket.summaryLine}</p>
                  <ul className="district-signals">
                    <li>{pocket.anchorLine}</li>
                    <li>{pocket.ingredientLine}</li>
                  </ul>
                  <div className="district-best-for">{pocket.matchSignal}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {showStep2SecondarySurfaces && (
        <>
          <p className="direction-count-line">{directionCountLine}</p>
          <p className="district-context-line">{directionContextLine}</p>

          <RealityCommitStep
            persona={persona}
            vibe={primaryVibe}
            selectedDirectionId={selectedDirectionId}
            finalSelectedId={selectedDirectionId}
            selectedIdReconciled={selectedIdReconciled}
            userSelectedOverrideActive={userSelectedOverrideActive}
            onSelectDirection={handleSelectDirection}
            onGenerate={generatePlan}
            loading={loading}
            directionCards={directionCards}
            showDebugMeta={showDebug && verticalDebugEnabled}
            allowFallbackCards={false}
            showGenerateAction={false}
            showIntroCopy={false}
          />
        </>
      )}

      {!hasRevealed && preview && (
        <section className={`plan-preview${directionCards.length === 1 ? ' is-single-direction' : ''}`}>
          <p className="preview-bridge-line">{previewBridgeLine}</p>
          <p className="preview-bridge-subline">{previewBridgeSubline}</p>
          <article className="night-preview-card">
            <div className="night-preview-content compact-top">
              <h3>{previewHeaderTitle}</h3>
              <p className="night-preview-commit">A complete, ready-to-run night.</p>
              <p className="night-preview-mainline">{previewNarrativeSummary}</p>
              <div className="plan-update-lists">
                <div>
                  <p className="plan-update-list-title">Start</p>
                  <ul className="plan-update-list">
                    <li>{previewStartLabel}</li>
                  </ul>
                </div>
                <div>
                  <p className="plan-update-list-title">Highlight</p>
                  <ul className="plan-update-list">
                    <li>{previewHighlightLabel}</li>
                  </ul>
                </div>
                <div>
                  <p className="plan-update-list-title">Wind-down</p>
                  <ul className="plan-update-list">
                    <li>{previewWindDownLabel}</li>
                  </ul>
                </div>
              </div>
              <section
                className={`preview-district-anchor preview-spatial-overview${
                  activeDistrictPocketId !== ALL_DISTRICTS_CONTEXT_ID ? ' is-active' : ''
                }`}
                aria-label="Where this night lives"
              >
                <p className="preview-spatial-overview-title">Where this night lives</p>
                <div className="preview-district-anchor-head">
                  <p className="preview-district-anchor-title">{previewDistrictAnchorLine}</p>
                  {activeDistrictPocketId !== ALL_DISTRICTS_CONTEXT_ID && (
                    <span className="preview-district-anchor-badge">ACTIVE AREA</span>
                  )}
                </div>
                <p className="preview-spatial-line">{previewSpatialCoherenceLine}</p>
                <div className="preview-spatial-map" role="presentation">
                  <div className="preview-spatial-path" />
                  {previewSpatialStops.map((stop) => (
                    <div
                      key={`preview_spatial_${stop.key}`}
                      className={`preview-spatial-marker${stop.highlighted ? ' is-highlight' : ''}`}
                      style={{ left: stop.left, top: stop.top }}
                    >
                      <span className="preview-spatial-dot" />
                      <div className="preview-spatial-marker-copy">
                        <p className="preview-spatial-marker-role">{stop.roleLabel}</p>
                        <p className="preview-spatial-marker-hint">{stop.hint}</p>
                        <p className="preview-spatial-marker-venue">{stop.venue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="preview-adjust-section">
                <p className="preview-shape-title">Adjust your night</p>
                <p className="preview-adjust-label">Tune the feel:</p>
                <div className="preview-shape-actions">
                  {PREVIEW_SHAPE_ACTIONS.map((action) => (
                    <button
                      key={action.intent}
                      type="button"
                      className={`chip-action preview-shape-chip${
                        activePreviewShapeIntent === action.intent ? ' selected' : ''
                      }`}
                      onClick={() => handlePreviewShape(action.intent)}
                      disabled={loading || directionCards.length === 0}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`preview-mini-spine${expandedRole ? ' has-active' : ''}`}>
                {previewAdjustStops.map((stop, index) => {
                  const isOpen = expandedRole === stop.role
                  const hasAlternatives = stop.alternatives.length > 0
                  return (
                    <div
                      key={`preview_mini_spine_${stop.role}`}
                      className={`preview-mini-spine-node${isOpen ? ' is-active' : ''}`}
                    >
                      <div className="preview-mini-spine-rail">
                        <span className="preview-mini-spine-dot" />
                        {index < previewAdjustStops.length - 1 && (
                          <span className="preview-mini-spine-line" />
                        )}
                      </div>
                      <div
                        className={`preview-mini-spine-content${isOpen ? ' is-open' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          void handlePreviewAdjustRoleToggle(stop.role)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void handlePreviewAdjustRoleToggle(stop.role)
                          }
                        }}
                      >
                        <p className="preview-stop-adjust-role">{stop.roleLabel}</p>
                        <p className="preview-stop-adjust-tone">{stop.roleTone}</p>
                        <p className="preview-stop-adjust-selected">{stop.selectedName}</p>
                        {stop.role === 'highlight' && !isOpen && (
                          <p className="preview-stop-adjust-highlight-note">
                            Strongest central fit for this route
                          </p>
                        )}
                        {stop.role === 'windDown' && (
                          <p className="preview-stop-adjust-landing-note">Soft close nearby</p>
                        )}
                        {isOpen && (
                          <p className="preview-stop-active-label">Editing this moment</p>
                        )}
                        <button
                          type="button"
                          className="ghost-button preview-stop-adjust-toggle"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handlePreviewAdjustRoleToggle(stop.role)
                          }}
                          disabled={loading || !selectedDirectionId || (plan ? !hasAlternatives : false)}
                        >
                          Swap
                        </button>
                        {isOpen && (
                          <div className="preview-stop-adjust-options">
                            <div className="preview-stop-detail-lines">
                              {stop.detailLines.map((line) => (
                                <p key={`${stop.role}_${line}`}>{line}</p>
                              ))}
                            </div>
                            {hasAlternatives ? (
                              <ul className="preview-stop-adjust-option-list">
                                {stop.alternatives.slice(0, 3).map((alternative) => (
                                  <li key={`${stop.role}_${alternative.venueId}`}>
                                    <div className="preview-stop-adjust-option-copy">
                                      <p className="preview-stop-adjust-option-name">
                                        {alternative.name}
                                      </p>
                                      <p className="preview-stop-adjust-option-reason">
                                        {alternative.descriptor}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      className="ghost-button preview-stop-adjust-swap"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void handlePreviewAlternative(stop.role, alternative.venueId)
                                      }}
                                      disabled={loading}
                                    >
                                      Swap to this
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="preview-stop-adjust-empty">
                                No better options right now
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {previewFeedback && (
                <div className="preview-feedback">{previewFeedback}</div>
              )}
              <div className="reality-step-live-strip direction-preview">
                <p className="reality-step-live-title">Why this works:</p>
                <ul className="reality-step-live-list">
                  {previewWhyThisWorks.map((reason) => (
                    <li key={`preview_why_${reason}`}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="action-row draft-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleBuildFullPlan}
                  disabled={!selectedDirectionId || loading}
                >
                  {loading ? 'Building full plan...' : 'Continue with this plan \u2192'}
                </button>
              </div>
            </div>
          </article>
        </section>
      )}

      {error && (
        <div className="preview-notice draft-feedback">
          <p className="preview-notice-title">Could not generate</p>
          <p className="preview-notice-copy">{error}</p>
        </div>
      )}

      {hasRevealed && plan && finalRoute && previewSynced && (
        <section className={`plan-reveal sandbox-plan-reveal${isLocking ? ' is-locking' : ''}`}>
          <div className="confirm-night-header">
            <h2>{revealedStepHeader}</h2>
            <p>{revealedStepSubline}</p>
          </div>

          <p className="preview-notice-copy">{plan.selectedClusterConfirmation}</p>

          <div className="sandbox-guided-review">
            <div className="sandbox-guided-map-rail">
              <div className="sandbox-guided-map-rail-inner">
                <JourneyMapReal
                  key={`sandbox-route-${finalRoute.routeId}`}
                  activeRole={activeRole}
                  routeStops={guidedRouteStops}
                  waypointOverrides={guidedWaypointOverrides}
                  activeStopId={guidedActiveStop?.id}
                  activeStopIndex={guidedActiveStopIndex}
                  cityLabel={finalRoute.location || city.trim()}
                  onNearbySummaryChange={handleNearbySummaryChange}
                />
              </div>
            </div>

            <div className="sandbox-guided-story-column">
              <RouteSpine
                className="draft-story-spine"
                stops={planningDisplayStops}
                storySpine={plan.itinerary.storySpine}
                routeHeadline={finalRoute.routeHeadline}
                routeWhyLine={finalRoute.routeSummary}
                experienceFamily={activePreviewDirectionContext?.experienceFamily}
                familyConfidence={activePreviewDirectionContext?.familyConfidence}
                usedRecoveredCentralMomentHighlight={Boolean(
                  plan.selectedArc.scoreBreakdown.recoveredCentralMomentHighlight,
                )}
                routeDebugSummary={undefined}
                allowStopAdjustments={false}
                enableInlineDetails
                inlineDetailsByRole={inlineDetailsByRole}
                appliedSwapNoteByRole={appliedSwapNoteByRole}
                postSwapHintByRole={postSwapHintByRole}
                activeRole={activeRole}
                changedRoles={[]}
                animatedRoles={[]}
                debugMode={false}
                enableActiveStopTracking
                alternativesByRole={{}}
                alternativeKindsByRole={{}}
                highlightDecisionSignal="Chosen over closer options to carry the night better."
                onFocusRole={setActiveRole}
                onShowSwap={() => undefined}
                onShowNearby={() => undefined}
                onApplySwap={() => undefined}
                onPreviewAlternative={handlePreviewAlternative}
              />

              <div className="sandbox-guided-action-row">
                <p className="confirm-decision-line">
                  {isLocking
                    ? 'Locking it in...'
                    : 'Ready when you are.'}
                </p>

                <div className="action-row draft-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleLockNight}
                    disabled={isLocking}
                  >
                    {isLocking ? 'Locking it in...' : 'Lock this night'}
                  </button>
                  <button type="button" className="ghost-button">
                    Send to friends
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      </div>

      <section className="preview-adjustments draft-tune-panel">
        <div className="action-row draft-actions">
          <p className="reality-curated-label" style={{ margin: 0 }}>
            What&apos;s working nearby
          </p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setShowDistrictPanel((current) => !current)}
          >
            {showDistrictPanel ? 'Hide' : 'Show'}
          </button>
        </div>
        {showDistrictPanel && (
          <DistrictPreviewPanel
            data={districtPreviewResult}
            loading={districtPreviewLoading}
            error={districtPreviewError}
            locationQuery={districtLocationQuery}
          />
        )}
      </section>

      {previewSwap && (
        <div
          className="swap-preview-overlay"
          onClick={() => setPreviewSwap(undefined)}
          role="presentation"
        >
          <article
            className="swap-preview-popout"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swap-preview-header">
              <p className="swap-preview-kicker">Swap option</p>
              <button
                type="button"
                className="ghost-button subtle"
                onClick={() => setPreviewSwap(undefined)}
              >
                Close
              </button>
            </div>

            <div className="swap-preview-card">
              <div className="swap-preview-image-wrap">
                <img
                  src={previewSwap.candidateStop.imageUrl}
                  alt={previewSwap.candidateStop.venueName}
                />
              </div>
              <div className="swap-preview-body">
                <span className="reveal-story-chip active">{previewSwap.candidateStop.title}</span>
                <h3>{previewSwap.candidateStop.venueName}</h3>
                <p className="swap-preview-descriptor">{previewSwap.descriptor}</p>
                <p className="stop-card-meta">
                  <span className="district-name">{previewSwap.candidateStop.neighborhood}</span> |{' '}
                  {previewSwap.candidateStop.driveMinutes} min out
                </p>

                <div className="stop-card-inline-detail-row">
                  <p className="stop-card-inline-detail-label">Why it fits</p>
                  <p className="stop-card-inline-detail-copy">{previewSwap.whyItFits}</p>
                </div>
                <div className="stop-card-inline-detail-row">
                  <p className="stop-card-inline-detail-label">Known for</p>
                  <p className="stop-card-inline-detail-copy">{previewSwap.knownFor}</p>
                </div>
                <div className="stop-card-inline-detail-row">
                  <p className="stop-card-inline-detail-label">Local signal</p>
                  <p className="stop-card-inline-detail-copy">{previewSwap.localSignal}</p>
                </div>

                <div className="swap-preview-impact">
                  <p className="stop-card-inline-detail-label">What changes</p>
                  <ul className="swap-preview-impact-list">
                    <li>{previewSwap.tradeoffSignal}</li>
                    <li>{previewSwap.constraintSignal}</li>
                    <li>{previewSwap.cascadeHint}</li>
                  </ul>
                </div>
                <p className="swap-preview-reassure">The rest of your route stays stable.</p>

                <div className="swap-preview-actions">
                  <a
                    className="stop-card-venue-link"
                    href={previewSwap.venueLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open venue page{' ->'}
                  </a>
                  <div className="action-row">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleKeepCurrentSwap(previewSwap.role)}
                    >
                      Stay on plan
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleSwapConfirmClick}
                    >
                      Swap this stop
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </PageShell>
  )
}











