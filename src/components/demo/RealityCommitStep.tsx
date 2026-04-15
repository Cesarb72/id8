import { useMemo, useState } from 'react'
import type { PersonaMode, VibeAnchor } from '../../domain/types/intent'

export type RealityCluster = 'lively' | 'chill' | 'explore'

interface RealityCommitStepProps {
  persona: PersonaMode
  vibe: VibeAnchor
  selectedDirectionId: string | null
  finalSelectedId?: string | null
  selectedIdReconciled?: boolean
  userSelectedOverrideActive?: boolean
  onSelectDirection: (directionId: string) => void
  onGenerate: () => void
  loading: boolean
  directionCards?: RealityDirectionCard[]
  showDebugMeta?: boolean
  allowFallbackCards?: boolean
  showGenerateAction?: boolean
  showIntroCopy?: boolean
}

export interface RealityClusterCardCopy {
  title: string
  subtitle?: string
  toneTag?: string
  whyNow: string
  whyYou: string
  anchorLine?: string
  supportLine?: string
  proofLine: string
  selectedProofLine?: string
  storySpinePreview?: {
    start: string
    highlight: string
    windDown: string
    whyThisWorks: string
  }
  liveSignals: {
    title: string
    items: string[]
  }
  confirmation: string
}

interface RealityInterpretation {
  dominantCluster: RealityCluster
  cards: Record<RealityCluster, RealityClusterCardCopy>
}

export interface RealityDirectionCard {
  id: string
  cluster: RealityCluster
  card: RealityClusterCardCopy
  recommended?: boolean
  directionStrategyWorldDebug?: {
    admittedCount: number
    suppressedCount: number
    rejectedCount: number
    fallbackAdmittedCount: number
    totalInputCount: number
    hardFailCount: number
    suppressedBySignal: Record<string, number>
    rejectedBySignal: Record<string, number>
    topFailureReasons: string[]
    survivabilityStatus: 'viable' | 'weak' | 'collapsed'
    sampleDecisions: Array<{
      pocketId: string
      status: 'admitted' | 'suppressed' | 'rejected'
      reasonSummary: string
    }>
    allowedPreview: string
    suppressedPreview: string
    rejectedPreview: string
  }
  debugMeta?: {
    pocketId: string
    pocketLabel?: string
    archetype: string
    confidence: number
    persona?: PersonaMode
    personaBoost?: number
    vibe?: VibeAnchor
    vibeBoost?: number
    finalScore?: number
    familyBias?: number
    richnessBoostApplied?: number
    similarityPenaltyApplied?: number
    composedCandidateAccepted?: boolean
    composedCandidateRejected?: boolean
    richnessContrastReason?: string
    shapedScoreBeforeCompression?: number
    shapedScoreAfterCompression?: number
    compressionApplied?: boolean
    compressionDelta?: number
    candidatePoolSize?: number
    preShapeRank?: number
    shapedRank?: number
    selectedRank?: number
    selectionMode?:
      | 'winner_strength'
      | 'guardrail_lane_alignment'
      | 'safe_adjacent'
      | 'different_angle'
      | 'score_fallback'
    maxSimilarityToSelected?: number
    similarityToWinner?: number
    similarityToSlot2?: number
    sameLaneAsWinner?: boolean
    similarityPenalty?: number
    contrastScore?: number
    winnerStrengthBonus?: number
    diversityLift?: number
    compositionChangedByShaping?: boolean
    elevatedFromOutsideTop3?: boolean
    laneIdentity?: string
    macroLane?: string
    directionExperienceIdentity?: string
    directionPrimaryIdentitySource?: string
    directionPeakModel?: string
    directionMovementStyle?: string
    directionDistrictSupportSummary?: string
    directionStrategyId?: string
    directionStrategyLabel?: string
    directionStrategyFamily?: string
    directionStrategySummary?: string
    directionStrategySource?: string
    directionCollapseGuardApplied?: boolean
    directionStrategyOverlapSummary?: string
    strategyConstraintStatus?: {
      required: 'pass' | 'fail'
      preferred: number
      suppressed: 'triggered' | 'not_triggered'
    }
    strategyPoolSize?: number
    strategyRejectedCount?: number
    strategyHardGuardStatus?: 'pass' | 'degraded'
    strategyHardGuardReason?: string
    contractGateApplied?: boolean
    contractGateSummary?: string
    contractGateStrengthSummary?: string
    contractGateRejectedCount?: number
    contractGateAllowedPreview?: string[]
    contractGateSuppressedPreview?: string[]
    directionContractGateStatus?: string
    directionContractGateReasonSummary?: string
    strategyWorldSource?: string
    selectedStrategyWorldId?: string
    strategyWorldSummary?: string
    strategyWorldAdmittedCount?: number
    strategyWorldSuppressedCount?: number
    strategyWorldRejectedCount?: number
    strategyWorldAllowedPreview?: string
    strategyWorldSuppressedPreview?: string
    directionStrategyWorldDebug?: {
      admittedCount: number
      suppressedCount: number
      rejectedCount: number
      fallbackAdmittedCount: number
      totalInputCount: number
      hardFailCount: number
      suppressedBySignal: Record<string, number>
      rejectedBySignal: Record<string, number>
      topFailureReasons: string[]
      survivabilityStatus: 'viable' | 'weak' | 'collapsed'
      sampleDecisions: Array<{
        pocketId: string
        status: 'admitted' | 'suppressed' | 'rejected'
        reasonSummary: string
      }>
      allowedPreview: string
      suppressedPreview: string
      rejectedPreview: string
    }
    directionStrategyWorldStatus?: string
    directionStrategyWorldReasonSummary?: string
    directionNarrativeSource?: string
    directionNarrativeMode?: string
    directionNarrativeSummary?: string
    districtIdentityStrength?: number
    momentumProfile?: string
    contrastEligible?: boolean
    contrastReason?: string
    experienceFamily?: string
    familyConfidence?: number
    laneCollapseRisk?: boolean
    laneSeparatedSlot3?: boolean
    laneSeparationReason?: string
    selectedFamilies?: string[]
    familyDiversityApplied?: boolean
    fallbackUsed?: boolean
    strongestShapedId?: string
    correctedWinnerId?: string
    finalSelectedId?: string
    strongestShapedPreserved?: boolean
    slot1GuardrailApplied?: boolean
    top1RawSeparation?: number
    top1AdjustedSeparation?: number
    expressionMode?: string
    localSpecificityScore?: number
    usedPrimaryMicroPocket?: boolean
    usedPrimaryAnchor?: boolean
    selectedTemplateKeys?: string[]
    expressionPrimarySignal?: string
    expressionPocketType?: string
    routeShapeGrammarHint?: string
    routeShapeMovementHint?: string
    routeShapeSwapHint?: string
    experienceContractId?: string
    experienceContractIdentity?: string
    experienceContractSummary?: string
    experienceContractCoordinationMode?: string
    experienceContractHighlightModel?: string
    experienceContractHighlightType?: string
    experienceContractMovementStyle?: string
    experienceContractSocialPosture?: string
    experienceContractPacingStyle?: string
    experienceContractActPattern?: string
    experienceContractReasonSummary?: string
    contractConstraintsId?: string
    contractConstraintsPeakCountModel?: string
    contractConstraintsMovementTolerance?: string
    contractConstraintsHighlightPressure?: string
    contractConstraintsRequireContinuity?: boolean
    contractConstraintsRequireRecoveryWindows?: boolean
    conciergeIntentId?: string
    conciergeIntentMode?: string
    conciergeObjectivePrimary?: string
    conciergeControlPostureMode?: string
    conciergeConstraintSwapTolerance?: string
    conciergeHint?: string
  }
}

type DebugMeta = NonNullable<RealityDirectionCard['debugMeta']>

interface DebugSection {
  label: 'Scoring' | 'Family' | 'Richness' | 'Experience' | 'Expression' | 'Selection' | 'Other'
  rows: Array<{ key: string; value: string }>
}

interface DebugSelectionContext {
  canonicalFinalSelectedId?: string
  highlightedCardId?: string
  selectedSyncOk: boolean
  selectedIdReconciled: boolean
}

const SCORING_DEBUG_KEYS: Array<keyof DebugMeta> = [
  'pocketId',
  'archetype',
  'confidence',
  'finalScore',
  'candidatePoolSize',
  'preShapeRank',
  'shapedRank',
  'selectedRank',
  'shapedScoreBeforeCompression',
  'shapedScoreAfterCompression',
  'compressionApplied',
  'compressionDelta',
  'winnerStrengthBonus',
  'top1RawSeparation',
  'top1AdjustedSeparation',
]

const FAMILY_DEBUG_KEYS: Array<keyof DebugMeta> = [
  'persona',
  'personaBoost',
  'vibe',
  'vibeBoost',
  'experienceFamily',
  'familyConfidence',
  'familyBias',
  'laneIdentity',
  'macroLane',
  'momentumProfile',
  'districtIdentityStrength',
  'selectedFamilies',
  'familyDiversityApplied',
  'fallbackUsed',
  'laneCollapseRisk',
  'laneSeparatedSlot3',
  'laneSeparationReason',
]

const RICHNESS_DEBUG_KEYS: Array<keyof DebugMeta> = [
  'richnessBoostApplied',
  'similarityPenaltyApplied',
  'composedCandidateAccepted',
  'composedCandidateRejected',
  'richnessContrastReason',
  'compositionChangedByShaping',
  'elevatedFromOutsideTop3',
  'contrastEligible',
  'contrastReason',
  'diversityLift',
  'contrastScore',
]

const EXPRESSION_DEBUG_KEYS: Array<keyof DebugMeta> = [
  'expressionMode',
  'localSpecificityScore',
  'usedPrimaryMicroPocket',
  'usedPrimaryAnchor',
  'expressionPrimarySignal',
  'expressionPocketType',
  'selectedTemplateKeys',
]

const EXPERIENCE_CONTRACT_DEBUG_KEYS: Array<keyof DebugMeta> = [
  'directionExperienceIdentity',
  'directionPrimaryIdentitySource',
  'directionPeakModel',
  'directionMovementStyle',
  'directionDistrictSupportSummary',
  'directionStrategyId',
  'directionStrategyLabel',
  'directionStrategyFamily',
  'directionStrategySummary',
  'directionStrategySource',
  'directionCollapseGuardApplied',
  'directionStrategyOverlapSummary',
  'strategyConstraintStatus',
  'strategyPoolSize',
  'strategyRejectedCount',
  'strategyHardGuardStatus',
  'strategyHardGuardReason',
  'contractGateApplied',
  'contractGateSummary',
  'contractGateStrengthSummary',
  'contractGateRejectedCount',
  'contractGateAllowedPreview',
  'contractGateSuppressedPreview',
  'directionContractGateStatus',
  'directionContractGateReasonSummary',
  'directionNarrativeSource',
  'directionNarrativeMode',
  'directionNarrativeSummary',
  'experienceContractId',
  'experienceContractIdentity',
  'experienceContractSummary',
  'experienceContractCoordinationMode',
  'experienceContractHighlightModel',
  'experienceContractHighlightType',
  'experienceContractMovementStyle',
  'experienceContractSocialPosture',
  'experienceContractPacingStyle',
  'experienceContractActPattern',
  'experienceContractReasonSummary',
]

const SELECTION_DEBUG_KEYS: Array<keyof DebugMeta> = [
  'selectionMode',
  'maxSimilarityToSelected',
  'similarityToWinner',
  'similarityToSlot2',
  'sameLaneAsWinner',
  'similarityPenalty',
  'strongestShapedId',
  'correctedWinnerId',
  'finalSelectedId',
  'strongestShapedPreserved',
  'slot1GuardrailApplied',
]

const CLUSTER_ORDER: RealityCluster[] = ['lively', 'chill', 'explore']

const BASE_REALITY_CARDS: Record<RealityCluster, RealityClusterCardCopy> = {
  lively: {
    title: 'Lively',
    toneTag: 'Magnetic',
    whyNow: 'Active later and well-suited to an evening build.',
    whyYou: 'Good for building social momentum early.',
    proofLine: 'Haberdasher | Mama Kin | Five Points',
    storySpinePreview: {
      start: 'Warm social entry with quick momentum.',
      highlight: 'Middle stretch peaks around high-energy stops.',
      windDown: 'Finish eases from peak to a cleaner close.',
      whyThisWorks: 'Built for a quick build, strong middle, and controlled landing.',
    },
    liveSignals: {
      title: 'Why this pocket works',
      items: [
        'Tight clustering supports short transitions between stops.',
        'Activity and drink categories overlap in a compact area.',
        'Support venues keep momentum without long dead zones.',
      ],
    },
    confirmation: "You're stepping into where the city's energy is already building.",
  },
  chill: {
    title: 'Chill',
    toneTag: 'Soft',
    whyNow: 'Quieter area with a steadier flow, better for a slower start.',
    whyYou: 'Supports a slower, more intimate opening.',
    proofLine: 'Paper Plane | Still O.G. | Orchard City Kitchen',
    storySpinePreview: {
      start: 'Softer opening with lower-friction movement.',
      highlight: 'Center beat stays warm and contained.',
      windDown: 'Close remains calm and easy to follow.',
      whyThisWorks: 'Built for steady pacing with a contained center and soft finish.',
    },
    liveSignals: {
      title: 'What defines this area',
      items: [
        'Dining and cafe density supports lower-friction pacing.',
        'Quieter cluster shape reduces abrupt energy shifts.',
      ],
    },
    confirmation: "You're easing into a quieter side of the city.",
  },
  explore: {
    title: 'Off the Radar',
    toneTag: 'Tucked Away',
    whyNow: 'Compact cluster that keeps movement low without feeling flat.',
    whyYou: 'Fits a cultural night without losing pacing.',
    proofLine: 'Five Points | District | The Continental',
    storySpinePreview: {
      start: 'Intentional start that sets a clear route.',
      highlight: 'Centerpoint stays focused around culture-forward stops.',
      windDown: 'Finish tapers without abrupt transitions.',
      whyThisWorks: 'Built for focused progression with a clear central moment.',
    },
    liveSignals: {
      title: 'Pocket shape',
      items: [
        'Culture-forward venues are packed into a compact loop.',
        'Strong overlap supports focused movement and easy sequencing.',
      ],
    },
    confirmation: "You're starting where most nights don't usually begin.",
  },
}

function getFallbackDominantCluster(vibe: VibeAnchor): RealityCluster {
  if (vibe === 'lively' || vibe === 'playful') {
    return 'lively'
  }
  if (vibe === 'cozy' || vibe === 'chill') {
    return 'chill'
  }
  return 'explore'
}

function formatDebugKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
}

function formatDebugValue(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 'n/a'
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(3)
  }
  if (typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '[]'
  }
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'n/a'
  }
  return JSON.stringify(value)
}

function buildDebugSection(
  label: DebugSection['label'],
  keys: Array<keyof DebugMeta>,
  meta: DebugMeta,
  consumedKeys: Set<string>,
): DebugSection | undefined {
  const rows = keys.reduce<Array<{ key: string; value: string }>>((acc, key) => {
    const value = meta[key]
    if (value === undefined) {
      return acc
    }
    consumedKeys.add(String(key))
    acc.push({
      key: formatDebugKey(String(key)),
      value: formatDebugValue(value),
    })
    return acc
  }, [])
  return rows.length > 0 ? { label, rows } : undefined
}

function summarizeTemplateKeys(templateKeys?: string[]): string | undefined {
  if (!templateKeys || templateKeys.length === 0) {
    return undefined
  }
  const preview = templateKeys.slice(0, 2).join(',')
  if (templateKeys.length <= 2) {
    return preview
  }
  return `${preview} +${templateKeys.length - 2}`
}

function getTopSignalCounts(
  signalCounts: Record<string, number> | undefined,
  limit = 2,
): Array<[string, number]> {
  if (!signalCounts) {
    return []
  }
  return Object.entries(signalCounts)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }
      return left[0].localeCompare(right[0])
    })
    .slice(0, limit)
}

function buildCompactDebugSummary(meta: DebugMeta): string {
  const tokens: string[] = []
  if (meta.directionExperienceIdentity) {
    tokens.push(`identity ${meta.directionExperienceIdentity}`)
  }
  if (meta.directionPeakModel) {
    tokens.push(`peak ${meta.directionPeakModel}`)
  }
  if (meta.directionMovementStyle) {
    tokens.push(`movement ${meta.directionMovementStyle}`)
  }
  if (meta.directionStrategyId) {
    tokens.push(`strategy ${meta.directionStrategyId}`)
  }
  if (meta.directionStrategyFamily) {
    tokens.push(`strategyFamily ${meta.directionStrategyFamily}`)
  }
  if (meta.strategyConstraintStatus) {
    tokens.push(
      `constraints req:${meta.strategyConstraintStatus.required} pref:${meta.strategyConstraintStatus.preferred.toFixed(2)} sup:${meta.strategyConstraintStatus.suppressed}`,
    )
  }
  if (meta.strategyPoolSize !== undefined) {
    const rejected = meta.strategyRejectedCount ?? 0
    tokens.push(`pool ${meta.strategyPoolSize} (rej ${rejected})`)
  }
  if (meta.strategyHardGuardStatus) {
    tokens.push(`hardGuard ${meta.strategyHardGuardStatus}`)
  }
  if (meta.contractGateApplied !== undefined) {
    tokens.push(`gate ${meta.contractGateApplied ? 'on' : 'off'}`)
  }
  if (meta.contractGateStrengthSummary) {
    tokens.push(`gateStrength ${meta.contractGateStrengthSummary}`)
  }
  if (meta.directionContractGateStatus) {
    tokens.push(`gateStatus ${meta.directionContractGateStatus}`)
  }
  if (meta.contractGateRejectedCount !== undefined) {
    tokens.push(`gateRejected ${meta.contractGateRejectedCount}`)
  }
  if (meta.directionNarrativeMode) {
    tokens.push(`narrative ${meta.directionNarrativeMode}`)
  }
  if (meta.experienceContractIdentity) {
    tokens.push(`contract ${meta.experienceContractIdentity}`)
  }
  if (meta.experienceContractCoordinationMode) {
    tokens.push(`coordination ${meta.experienceContractCoordinationMode}`)
  }
  if (meta.experienceContractHighlightModel) {
    tokens.push(`highlightModel ${meta.experienceContractHighlightModel}`)
  }
  if (meta.experienceFamily) {
    tokens.push(`family ${meta.experienceFamily}`)
  }
  if (meta.familyConfidence !== undefined) {
    tokens.push(`familyConf ${meta.familyConfidence.toFixed(3)}`)
  }
  if (meta.familyBias !== undefined) {
    tokens.push(`familyBias ${meta.familyBias.toFixed(3)}`)
  }
  if (meta.finalScore !== undefined) {
    const rankSuffix = meta.selectedRank !== undefined ? ` #${meta.selectedRank}` : ''
    tokens.push(`final ${meta.finalScore.toFixed(3)}${rankSuffix}`)
  } else if (meta.selectedRank !== undefined) {
    tokens.push(`rank #${meta.selectedRank}`)
  }
  if (meta.compressionApplied !== undefined) {
    tokens.push(`compression ${meta.compressionApplied ? 'on' : 'off'}`)
  }
  if (meta.richnessBoostApplied !== undefined || meta.similarityPenaltyApplied !== undefined) {
    tokens.push(
      `richness +${(meta.richnessBoostApplied ?? 0).toFixed(3)} / -${(
        meta.similarityPenaltyApplied ?? 0
      ).toFixed(3)}`,
    )
  }
  if (meta.composedCandidateAccepted !== undefined || meta.composedCandidateRejected !== undefined) {
    const composedState = meta.composedCandidateAccepted
      ? 'accepted'
      : meta.composedCandidateRejected
        ? 'rejected'
        : 'n/a'
    tokens.push(`composed ${composedState}`)
  }
  const templateSummary = summarizeTemplateKeys(meta.selectedTemplateKeys)
  if (templateSummary) {
    tokens.push(`templates ${templateSummary}`)
  }
  return tokens.length > 0 ? tokens.join(' | ') : 'no card debug metadata'
}

function buildDebugSections(meta: DebugMeta, selection: DebugSelectionContext): DebugSection[] {
  const consumedKeys = new Set<string>()
  const sections: DebugSection[] = []
  const groupedSections = [
    buildDebugSection('Scoring', SCORING_DEBUG_KEYS, meta, consumedKeys),
    buildDebugSection('Family', FAMILY_DEBUG_KEYS, meta, consumedKeys),
    buildDebugSection('Richness', RICHNESS_DEBUG_KEYS, meta, consumedKeys),
    buildDebugSection('Experience', EXPERIENCE_CONTRACT_DEBUG_KEYS, meta, consumedKeys),
    buildDebugSection('Expression', EXPRESSION_DEBUG_KEYS, meta, consumedKeys),
    buildDebugSection('Selection', SELECTION_DEBUG_KEYS, meta, consumedKeys),
  ]

  groupedSections.forEach((section) => {
    if (section) {
      sections.push(section)
    }
  })

  const selectionSection = sections.find((section) => section.label === 'Selection')
  if (selectionSection) {
    selectionSection.rows.push(
      {
        key: 'canonical final selected id',
        value: selection.canonicalFinalSelectedId ?? 'n/a',
      },
      {
        key: 'highlighted card id',
        value: selection.highlightedCardId ?? 'n/a',
      },
      {
        key: 'selected sync ok',
        value: String(selection.selectedSyncOk),
      },
      {
        key: 'selected id reconciled',
        value: String(selection.selectedIdReconciled),
      },
    )
  } else {
    sections.push({
      label: 'Selection',
      rows: [
        {
          key: 'canonical final selected id',
          value: selection.canonicalFinalSelectedId ?? 'n/a',
        },
        {
          key: 'highlighted card id',
          value: selection.highlightedCardId ?? 'n/a',
        },
        {
          key: 'selected sync ok',
          value: String(selection.selectedSyncOk),
        },
        {
          key: 'selected id reconciled',
          value: String(selection.selectedIdReconciled),
        },
      ],
    })
  }

  const remainingRows = Object.entries(meta)
    .filter(([key, value]) => value !== undefined && !consumedKeys.has(key))
    .map(([key, value]) => ({
      key: formatDebugKey(key),
      value: formatDebugValue(value),
    }))
  if (remainingRows.length > 0) {
    sections.push({
      label: 'Other',
      rows: remainingRows,
    })
  }

  return sections
}

function extractPreviewStops(proofLine: string): string[] {
  return proofLine
    .split(/\||\u00B7|\u00C2\u00B7|,/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function rewriteCenteredAround(value: string): string {
  return value.replace(/Centered around/gi, 'Near')
}

function getDistrictFromConfirmation(confirmation?: string): string | undefined {
  if (!confirmation) {
    return undefined
  }
  const match = confirmation.match(/starting in\s+(.+?)\s+(?:\u2014|-|\u00E2\u20AC\u201D)\s+/i)
  const district = match?.[1]?.trim()
  return district && district.length > 0 ? district : undefined
}

function getConfirmationSummary(
  selectedDistrict: string | undefined,
  cluster: RealityCluster | undefined,
): string {
  const arcLine =
    cluster === 'chill'
      ? 'builds steady and lands cleanly'
      : cluster === 'explore'
        ? 'builds with focus and lands cleanly'
        : 'builds fast and lands cleanly'
  if (selectedDistrict) {
    return `Starts in ${selectedDistrict} \u00B7 ${arcLine}`
  }
  return `${arcLine.charAt(0).toUpperCase()}${arcLine.slice(1)}`
}

type PrimaryMode = 'social' | 'exploratory' | 'intimate'

interface CardNarrativeCopy {
  mode: PrimaryMode
  summary: string
  bestWhen: string
}

const SOCIAL_TERMS = [
  'bar',
  'social',
  'live',
  'jazz',
  'music',
  'club',
  'buzz',
  'busy',
  'haberdasher',
  'kin',
]

const EXPLORATORY_TERMS = [
  'museum',
  'gallery',
  'culture',
  'cultural',
  'district',
  'art',
  'theatre',
  'theater',
  'wander',
  'explore',
  'continental',
]

const INTIMATE_TERMS = [
  'restaurant',
  'kitchen',
  'dining',
  'table',
  'courtyard',
  'cafe',
  'tea',
  'dessert',
  'orchard',
  'still',
  'linger',
]

const MODE_SUMMARY_BASE: Record<PrimaryMode, string> = {
  social: 'A social, fast-moving night with energy building across nearby spots',
  exploratory: 'A curious, culture-led night with room to wander',
  intimate: 'A slower, more intimate night built around a few strong stops',
}

const MODE_SUMMARY_VARIANTS: Record<PrimaryMode, string[]> = {
  social: [
    'A social, fast-moving night with energy building across nearby spots',
    'An anchored social night with a strong center and quick transitions',
    'A social route with steady momentum and a confident middle',
  ],
  exploratory: [
    'A curious, culture-led night with room to wander',
    'A culture-led route with walkable variety and time to wander',
    'A curious route with exploratory pacing and clear focal moments',
  ],
  intimate: [
    'A slower, more intimate night built around a few strong stops',
    'An intimate route with anchored pacing and room to linger',
    'A quieter, intimate night centered on standout table moments',
  ],
}

const MODE_BEST_WHEN: Record<PrimaryMode, string> = {
  social: 'Best when you want the night to keep moving',
  exploratory: 'Best when you want to explore without rushing',
  intimate: 'Best when you want to settle in and linger',
}

const PERSONA_SUMMARY_VARIANTS: Record<PersonaMode, Record<PrimaryMode, string[]>> = {
  romantic: {
    social: [
      'A social route with a stronger centerpiece and softer pacing around it',
      'A lively route that builds into one standout central moment',
      'A social night with momentum and a clear romantic center',
    ],
    exploratory: [
      'An atmospheric route with room to explore between intimate moments',
      'A culture-led route with slower pacing and stronger atmosphere',
      'A curious route that stays intentional and easy to settle into',
    ],
    intimate: [
      'A slower, intimate route centered on a few standout moments',
      'An intimate route with a strong center and a soft finish',
      'A quieter route built for atmosphere and steady pacing',
    ],
  },
  friends: {
    social: [
      'A social route that keeps moving with shared energy',
      'A fast-moving route with a strong center and easy momentum',
      'A lively route built for group flow across nearby spots',
    ],
    exploratory: [
      'A varied route with movement and interactive moments',
      'A curious route that keeps variety high without stalling',
      'An exploratory route with shared energy and clear pacing',
    ],
    intimate: [
      'A lower-key social route with a strong center',
      'A steadier route that still keeps group momentum',
      'A calmer route with easy flow and a clear middle',
    ],
  },
  family: {
    social: [
      'An easy, active route with clear anchors and simple transitions',
      'A higher-energy route that stays straightforward and accessible',
      'A social route with clear pacing and low-friction movement',
    ],
    exploratory: [
      'An accessible route with clear anchors and room to explore',
      'A culture-led route with simple pacing and easy transitions',
      'A varied route that stays structured and easy to follow',
    ],
    intimate: [
      'A calm route with low-friction pacing and clear anchor stops',
      'A slower route built around easy, dependable anchor moments',
      'A steady route with clear stops and a soft finish',
    ],
  },
}

const PERSONA_BEST_WHEN: Record<PersonaMode, Record<PrimaryMode, string>> = {
  romantic: {
    social: 'Best when you want stronger atmosphere around one standout center',
    exploratory: 'Best when you want atmosphere with time between stops',
    intimate: 'Best when you want a slower pace and room to linger',
  },
  friends: {
    social: 'Best when you want shared energy and steady movement',
    exploratory: 'Best when your group wants variety without rushing',
    intimate: 'Best when you want a calmer plan with a clear center',
  },
  family: {
    social: 'Best when you want easy movement and clear anchor stops',
    exploratory: 'Best when you want variety with simple pacing',
    intimate: 'Best when you want a calm plan that stays easy to follow',
  },
}

const PERSONA_STOP_TERMS: Record<PersonaMode, string[]> = {
  romantic: ['wine', 'cocktail', 'tea', 'dessert', 'courtyard', 'kitchen', 'lounge', 'bistro'],
  friends: ['bar', 'live', 'music', 'jazz', 'brew', 'club', 'social', 'tap', 'arcade'],
  family: ['museum', 'park', 'cafe', 'kitchen', 'market', 'garden', 'dessert', 'plaza'],
}

const FAMILY_NIGHTLIFE_TERMS = ['late', 'night', 'club', 'speakeasy', 'buzz']

function scoreTerms(value: string, terms: string[]): number {
  const normalized = value.toLowerCase()
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0)
}

function scoreStopForMode(stopName: string, mode: PrimaryMode): number {
  if (mode === 'social') {
    return scoreTerms(stopName, SOCIAL_TERMS)
  }
  if (mode === 'exploratory') {
    return scoreTerms(stopName, EXPLORATORY_TERMS)
  }
  return scoreTerms(stopName, INTIMATE_TERMS)
}

function scoreTextForMode(text: string, mode: PrimaryMode): number {
  return scoreStopForMode(text, mode)
}

function getModeDensitySignal(text: string[]): number {
  return text.reduce((score, value) => {
    const normalized = value.toLowerCase()
    if (
      normalized.includes('tight') ||
      normalized.includes('compact') ||
      normalized.includes('dense') ||
      normalized.includes('short transitions') ||
      normalized.includes('quick')
    ) {
      return score + 1
    }
    return score
  }, 0)
}

function getModeAnchorStrength(text: string[]): number {
  return text.reduce((score, value) => {
    const normalized = value.toLowerCase()
    if (
      normalized.includes('center') ||
      normalized.includes('central') ||
      normalized.includes('anchor') ||
      normalized.includes('focused')
    ) {
      return score + 1
    }
    return score
  }, 0)
}

function detectPrimaryMode(
  entry: RealityDirectionCard,
  stops: string[],
): PrimaryMode {
  const card = entry.card
  const sourceText = [
    card.title,
    card.subtitle ?? '',
    card.whyNow,
    card.whyYou,
    card.anchorLine ?? '',
    card.supportLine ?? '',
    card.liveSignals.title,
    ...card.liveSignals.items,
    entry.debugMeta?.momentumProfile ?? '',
    entry.debugMeta?.macroLane ?? '',
    entry.debugMeta?.laneIdentity ?? '',
  ].filter(Boolean)

  const socialTextScore = sourceText.reduce((score, item) => score + scoreTextForMode(item, 'social'), 0)
  const exploratoryTextScore = sourceText.reduce(
    (score, item) => score + scoreTextForMode(item, 'exploratory'),
    0,
  )
  const intimateTextScore = sourceText.reduce(
    (score, item) => score + scoreTextForMode(item, 'intimate'),
    0,
  )

  const socialStopScore = stops.reduce((score, stop) => score + scoreStopForMode(stop, 'social'), 0)
  const exploratoryStopScore = stops.reduce(
    (score, stop) => score + scoreStopForMode(stop, 'exploratory'),
    0,
  )
  const intimateStopScore = stops.reduce((score, stop) => score + scoreStopForMode(stop, 'intimate'), 0)

  const densitySignal = getModeDensitySignal(sourceText)
  const anchorSignal = getModeAnchorStrength(sourceText)
  const walkSignal = sourceText.some((item) => /walk|wander|explore|district/i.test(item)) ? 1 : 0
  const diningSignal = sourceText.some((item) => /dining|restaurant|table|courtyard|linger/i.test(item))
    ? 1
    : 0

  const socialComposite = socialTextScore + socialStopScore + densitySignal
  const exploratoryComposite = exploratoryTextScore + exploratoryStopScore + walkSignal
  const intimateComposite = intimateTextScore + intimateStopScore + diningSignal + anchorSignal

  if (socialComposite >= exploratoryComposite + 1 && socialComposite >= intimateComposite + 1) {
    return 'social'
  }
  if (
    exploratoryComposite >= socialComposite + 1 &&
    exploratoryComposite >= intimateComposite + 1
  ) {
    return 'exploratory'
  }
  if (intimateComposite >= socialComposite && intimateComposite >= exploratoryComposite) {
    return 'intimate'
  }

  if (entry.cluster === 'lively') {
    return 'social'
  }
  if (entry.cluster === 'explore') {
    return 'exploratory'
  }
  return 'intimate'
}

function scoreStopForPersona(stopName: string, persona: PersonaMode): number {
  let score = scoreTerms(stopName, PERSONA_STOP_TERMS[persona])
  if (persona === 'family') {
    const normalized = stopName.toLowerCase()
    if (FAMILY_NIGHTLIFE_TERMS.some((term) => normalized.includes(term))) {
      score -= 1
    }
  }
  return score
}

function getModeAlignedStops(stops: string[], mode: PrimaryMode, persona: PersonaMode): string[] {
  const normalized = Array.from(
    new Set(stops.map((stop) => stop.trim()).filter((stop) => stop.length > 0)),
  )
  if (normalized.length <= 1) {
    return normalized
  }
  return normalized
    .map((stop, index) => ({
      stop,
      index,
      score: scoreStopForMode(stop, mode) * 1.1 + scoreStopForPersona(stop, persona) * 1.35,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.stop)
}

function formatPreviewIncludes(stops: string[]): string {
  if (stops.length === 0) {
    return 'Includes nearby picks'
  }
  const namedStops = stops.slice(0, 3).map((stop) => rewriteCenteredAround(stop))
  const suffix = stops.length > 3 ? ' and nearby picks' : ''
  return `Includes: ${namedStops.join(' \u00B7 ')}${suffix}`
}

function modesMatchStops(stops: string[], mode: PrimaryMode): boolean {
  if (stops.length === 0) {
    return true
  }
  const total = stops.reduce((score, stop) => score + scoreStopForMode(stop, mode), 0)
  return total >= 1
}

function chooseBestModeFromStops(stops: string[], fallback: PrimaryMode): PrimaryMode {
  if (stops.length === 0) {
    return fallback
  }
  const totals: Array<{ mode: PrimaryMode; score: number }> = [
    { mode: 'social', score: stops.reduce((score, stop) => score + scoreStopForMode(stop, 'social'), 0) },
    {
      mode: 'exploratory',
      score: stops.reduce((score, stop) => score + scoreStopForMode(stop, 'exploratory'), 0),
    },
    { mode: 'intimate', score: stops.reduce((score, stop) => score + scoreStopForMode(stop, 'intimate'), 0) },
  ]
  const top = totals.sort((left, right) => right.score - left.score)[0]
  return (top?.score ?? 0) > 0 ? top.mode : fallback
}

function buildCardNarrativeCopy(
  cards: RealityDirectionCard[],
  persona: PersonaMode,
): Record<string, CardNarrativeCopy> {
  const detectedModes = cards.map((entry) => {
    const stops = extractPreviewStops(entry.card.proofLine)
    const detected = detectPrimaryMode(entry, stops)
    const correctedMode = modesMatchStops(stops, detected)
      ? detected
      : chooseBestModeFromStops(stops, detected)
    return {
      id: entry.id,
      mode: correctedMode,
      stopNames: stops,
      densitySignal: getModeDensitySignal([entry.card.whyNow, ...entry.card.liveSignals.items]),
      anchorSignal: getModeAnchorStrength([
        entry.card.whyYou,
        entry.card.storySpinePreview?.whyThisWorks ?? '',
      ]),
    }
  })

  const modeBuckets = new Map<PrimaryMode, Array<(typeof detectedModes)[number]>>()
  detectedModes.forEach((entry) => {
    const existing = modeBuckets.get(entry.mode) ?? []
    existing.push(entry)
    modeBuckets.set(entry.mode, existing)
  })

  const summaryById = new Map<string, string>()
  for (const [mode, entries] of modeBuckets.entries()) {
    const ordered = [...entries].sort(
      (left, right) =>
        right.densitySignal - left.densitySignal || right.anchorSignal - left.anchorSignal,
    )
    const variants = PERSONA_SUMMARY_VARIANTS[persona][mode]
    ordered.forEach((entry, index) => {
      summaryById.set(
        entry.id,
        variants[index] ?? variants[variants.length - 1] ?? MODE_SUMMARY_BASE[mode],
      )
    })
  }

  const usedSummaries = new Set<string>()
  const narrativeById: Record<string, CardNarrativeCopy> = {}
  detectedModes.forEach((entry) => {
    const variants = PERSONA_SUMMARY_VARIANTS[persona][entry.mode]
    let summary = summaryById.get(entry.id) ?? MODE_SUMMARY_BASE[entry.mode]
    if (usedSummaries.has(summary)) {
      summary = variants.find((variant) => !usedSummaries.has(variant)) ?? `${summary} (distinct pacing)`
    }
    usedSummaries.add(summary)
    narrativeById[entry.id] = {
      mode: entry.mode,
      summary,
      bestWhen: PERSONA_BEST_WHEN[persona][entry.mode] ?? MODE_BEST_WHEN[entry.mode],
    }
  })

  return narrativeById
}

export function getRealityInterpretation(
  persona: PersonaMode,
  vibe: VibeAnchor,
): RealityInterpretation {
  const dominantFromVibe = getFallbackDominantCluster(vibe)
  const dominantCluster =
    persona === 'family' && dominantFromVibe === 'explore' ? 'chill' : dominantFromVibe

  return {
    dominantCluster,
    cards: BASE_REALITY_CARDS,
  }
}

export function RealityCommitStep({
  persona,
  vibe,
  selectedDirectionId,
  finalSelectedId,
  selectedIdReconciled = false,
  userSelectedOverrideActive = false,
  onSelectDirection,
  onGenerate,
  loading,
  directionCards,
  showDebugMeta,
  allowFallbackCards = true,
  showGenerateAction = true,
  showIntroCopy = true,
}: RealityCommitStepProps) {
  const shouldShowDebug = Boolean(showDebugMeta)
  const [activeDebugCardId, setActiveDebugCardId] = useState<string | null>(null)
  const [inspectDirectionId, setInspectDirectionId] = useState<string | null>(null)
  const interpretation = getRealityInterpretation(persona, vibe)
  const fallbackCards: RealityDirectionCard[] = CLUSTER_ORDER.map((cluster) => ({
    id: `fallback-${cluster}`,
    cluster,
    card: interpretation.cards[cluster],
    recommended: interpretation.dominantCluster === cluster,
  }))
  const cards =
    directionCards && directionCards.length > 0
      ? directionCards
      : allowFallbackCards
        ? fallbackCards
        : []
  const cardNarrativeById = useMemo(() => buildCardNarrativeCopy(cards, persona), [cards, persona])
  const selectedCard = selectedDirectionId
    ? cards.find((entry) => entry.id === selectedDirectionId)
    : undefined
  const selectedDistrict = getDistrictFromConfirmation(selectedCard?.card.confirmation)
  const confirmation = selectedDirectionId
    ? getConfirmationSummary(selectedDistrict, selectedCard?.cluster)
    : undefined
  const canonicalFinalSelectedId = finalSelectedId ?? cards[0]?.id
  const highlightedCardId = selectedCard?.id
  const selectedSyncOk =
    highlightedCardId === undefined ||
    highlightedCardId === canonicalFinalSelectedId ||
    userSelectedOverrideActive
  const activeDebugEntry =
    shouldShowDebug && activeDebugCardId
      ? cards.find((entry) => entry.id === activeDebugCardId)
      : undefined
  const activeDebugSummary = activeDebugEntry?.debugMeta
    ? buildCompactDebugSummary(activeDebugEntry.debugMeta)
    : ''
  const activeDebugSections = activeDebugEntry?.debugMeta
    ? buildDebugSections(activeDebugEntry.debugMeta, {
        canonicalFinalSelectedId,
        highlightedCardId,
        selectedSyncOk,
        selectedIdReconciled,
      })
    : []

  return (
    <section className="reality-step">
      <div className="reality-curated-starts">
        {showIntroCopy && (
          <>
            <h2 className="reality-step-title">Choose tonight&apos;s direction</h2>
            <p className="reality-step-subline">
              Choose how you want the night to feel.
            </p>
            <p className="reality-intent-line">
              Built from what&apos;s working nearby tonight.
            </p>
            <p className="reality-curated-label">Good ways to start</p>
            <p className="reality-curated-copy">Matched to your vibe.</p>
          </>
        )}
        <div className={`reality-step-grid${cards.length === 1 ? ' single-card' : ''}`}>
          {cards.map((entry) => {
            const cluster = entry.cluster
            const card = entry.card
            const selected = selectedDirectionId === entry.id
            const dimmed = Boolean(selectedDirectionId && !selected)
            const recommended = Boolean(entry.recommended)
            const debugSummary = entry.debugMeta ? buildCompactDebugSummary(entry.debugMeta) : ''
            const isDebugExpanded = activeDebugCardId === entry.id
            const isInspectExpanded = inspectDirectionId === entry.id
            const strategyWorldDebug = entry.directionStrategyWorldDebug
            const topSuppressors = getTopSignalCounts(strategyWorldDebug?.suppressedBySignal)
            const topRejectors = getTopSignalCounts(strategyWorldDebug?.rejectedBySignal)
            const sampleDecisions = strategyWorldDebug?.sampleDecisions.slice(0, 3) ?? []
            const suppressedBySignalSummary =
              strategyWorldDebug && Object.keys(strategyWorldDebug.suppressedBySignal).length > 0
                ? Object.entries(strategyWorldDebug.suppressedBySignal)
                    .sort((left, right) => {
                      if (right[1] !== left[1]) {
                        return right[1] - left[1]
                      }
                      return left[0].localeCompare(right[0])
                    })
                    .map(([key, count]) => `${key}:${count}`)
                    .join(', ')
                : 'n/a'
            const rejectedBySignalSummary =
              strategyWorldDebug && Object.keys(strategyWorldDebug.rejectedBySignal).length > 0
                ? Object.entries(strategyWorldDebug.rejectedBySignal)
                    .sort((left, right) => {
                      if (right[1] !== left[1]) {
                        return right[1] - left[1]
                      }
                      return left[0].localeCompare(right[0])
                    })
                    .map(([key, count]) => `${key}:${count}`)
                    .join(', ')
                : 'n/a'
            const districtLabel = getDistrictFromConfirmation(card.confirmation)
            const identityLine =
              entry.debugMeta?.directionNarrativeSummary?.trim() ??
              card.whyNow?.trim() ??
              card.subtitle?.trim() ??
              'Structured route built from live local signals.'
            const primaryDistrict =
              entry.debugMeta?.pocketLabel?.trim() ?? districtLabel?.trim() ?? 'SoFA District'
            const whyLine =
              entry.debugMeta?.directionDistrictSupportSummary?.trim() ??
              card.whyYou?.trim() ??
              'Dense cluster supports short moves and strong peaks.'
            const shapeLine = 'Start -> Build -> Peak -> Wind-down'
            return (
              <div key={entry.id} className="reality-step-card-shell">
                <button
                  type="button"
                  className={`reality-step-card direction-card${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}${recommended ? ' recommended' : ''}`}
                  onClick={() => onSelectDirection(entry.id)}
                  aria-pressed={selected}
                >
                  <div className="direction-title">{rewriteCenteredAround(card.title)}</div>
                  <p className="direction-identity">{rewriteCenteredAround(identityLine)}</p>
                  <div className="direction-meta">
                    <p>
                      <strong>Primary district:</strong> {primaryDistrict}
                    </p>
                    <p>
                      <strong>Why this fits:</strong> {rewriteCenteredAround(whyLine)}
                    </p>
                  </div>
                  <div className="direction-shape">{shapeLine}</div>
                </button>
                {shouldShowDebug && entry.debugMeta && (
                  <div className="reality-step-inspect-shell">
                    <button
                  type="button"
                      className="reality-step-inspect-toggle"
                      onClick={() =>
                        setInspectDirectionId((previous) => (previous === entry.id ? null : entry.id))
                      }
                      aria-expanded={isInspectExpanded}
                    >
                      <span>Inspect this direction</span>
                      <span aria-hidden="true">{isInspectExpanded ? '[-]' : '[+]'}</span>
                    </button>
                    {isInspectExpanded && (
                      <div className="reality-step-inspect-panel">
                        <p className="reality-step-meta reality-step-debug-meta">
                          <span>Debug:</span> {debugSummary}
                        </p>
                        {strategyWorldDebug && (
                          <div className="reality-step-live-strip reality-step-debug-strip">
                            <p className="reality-step-live-title">Strategy World Health:</p>
                            <ul className="reality-step-live-list">
                              <li>Input: {strategyWorldDebug.totalInputCount}</li>
                              <li>Admitted: {strategyWorldDebug.admittedCount}</li>
                              <li>Suppressed: {strategyWorldDebug.suppressedCount}</li>
                              <li>Rejected: {strategyWorldDebug.rejectedCount}</li>
                              <li>Hard Fail: {strategyWorldDebug.hardFailCount}</li>
                              <li>Status: {strategyWorldDebug.survivabilityStatus}</li>
                              <li>suppressedBySignal: {suppressedBySignalSummary}</li>
                              <li>rejectedBySignal: {rejectedBySignalSummary}</li>
                            </ul>
                            {(topSuppressors.length > 0 || topRejectors.length > 0) && (
                              <>
                                <p className="reality-step-live-title">Failure Signals:</p>
                                {topSuppressors.length > 0 ? (
                                  <ul className="reality-step-live-list">
                                    {topSuppressors.map(([signalName, count]) => (
                                      <li key={`${entry.id}_suppress_${signalName}`}>
                                        suppressor {signalName}: {count}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="reality-step-meta reality-step-debug-meta">
                                    suppressor n/a
                                  </p>
                                )}
                                {topRejectors.length > 0 ? (
                                  <ul className="reality-step-live-list">
                                    {topRejectors.map(([signalName, count]) => (
                                      <li key={`${entry.id}_reject_${signalName}`}>
                                        rejector {signalName}: {count}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="reality-step-meta reality-step-debug-meta">
                                    rejector n/a
                                  </p>
                                )}
                              </>
                            )}
                            {sampleDecisions.length > 0 && (
                              <>
                                <p className="reality-step-live-title">Sample Decisions:</p>
                                <ul className="reality-step-live-list">
                                  {sampleDecisions.map((decision) => (
                                    <li key={`${entry.id}_decision_${decision.pocketId}`}>
                                      {decision.pocketId} → {decision.status} ({decision.reasonSummary})
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                        {selected && card.liveSignals.items.length > 0 && (
                          <div className="reality-step-live-strip reality-step-debug-strip">
                            <p className="reality-step-live-title">{card.liveSignals.title}:</p>
                            <ul className="reality-step-live-list">
                              {card.liveSignals.items.slice(0, 3).map((item) => (
                                <li key={`${cluster}_${item}`}>{rewriteCenteredAround(item)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selected && card.storySpinePreview && (
                          <div className="reality-step-live-strip reality-step-debug-strip">
                            <p className="reality-step-live-title">Story spine preview:</p>
                            <ul className="reality-step-live-list">
                              <li>
                                <strong>Start</strong> - {rewriteCenteredAround(card.storySpinePreview.start)}
                              </li>
                              <li>
                                <strong>Highlight</strong> - {rewriteCenteredAround(card.storySpinePreview.highlight)}
                              </li>
                              <li>
                                <strong>Wind-down</strong> - {rewriteCenteredAround(card.storySpinePreview.windDown)}
                              </li>
                            </ul>
                            <p className="reality-step-insider-fit">
                              {rewriteCenteredAround(card.storySpinePreview.whyThisWorks)}
                            </p>
                          </div>
                        )}
                        {selected && (
                          <p className="reality-step-meta reality-step-debug-meta">
                            <span>Selection Sync:</span> finalSelectedId {canonicalFinalSelectedId ?? 'n/a'} | highlightedCardId{' '}
                            {highlightedCardId ?? 'n/a'} | selectedSyncOk {String(selectedSyncOk)} | selectedIdReconciled{' '}
                            {String(selectedIdReconciled)}
                          </p>
                        )}
                        <p className="reality-step-meta reality-step-debug-meta">
                          <a
                            href={`#debug-${entry.id}`}
                            className="reality-step-debug-link"
                            onClick={(event) => {
                              event.preventDefault()
                              setActiveDebugCardId((previous) => (previous === entry.id ? null : entry.id))
                            }}
                            aria-expanded={isDebugExpanded}
                          >
                            {isDebugExpanded ? 'Hide full debug' : 'Show full debug'}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {shouldShowDebug && activeDebugEntry?.debugMeta && (
        <div
          className="reality-step-debug-inspector-backdrop"
          onClick={() => setActiveDebugCardId(null)}
        >
          <aside
            className="reality-step-debug-inspector"
            role="dialog"
            aria-modal="true"
            aria-label={`Full debug inspector for ${activeDebugEntry.card.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reality-step-debug-inspector-header">
              <p className="reality-step-debug-inspector-title">
                Full debug - {activeDebugEntry.card.title}
              </p>
              <button
                  type="button"
                className="reality-step-debug-close"
                onClick={() => setActiveDebugCardId(null)}
              >
                Close
              </button>
            </div>
            <p className="reality-step-meta reality-step-debug-meta">
              <span>Debug:</span> {activeDebugSummary}
            </p>
            <div className="reality-step-debug-panel">
              {activeDebugSections.map((section) => (
                <section
                  key={`${activeDebugEntry.id}_${section.label}`}
                  className="reality-step-debug-section"
                >
                  <p className="reality-step-debug-section-title">{section.label}</p>
                  <div className="reality-step-debug-rows">
                    {section.rows.map((row) => (
                      <p
                        key={`${activeDebugEntry.id}_${section.label}_${row.key}`}
                        className="reality-step-debug-row"
                      >
                        <span>{row.key}</span>
                        <code>{row.value}</code>
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        </div>
      )}

      {confirmation && <p className="reality-step-confirmation">{confirmation}</p>}

      {showGenerateAction && (
        <div className="action-row draft-actions">
          <button
                  type="button"
            className="primary-button"
            onClick={onGenerate}
            disabled={!selectedDirectionId || loading}
          >
            {loading ? 'Building full plan...' : 'Build full plan'}
          </button>
        </div>
      )}
    </section>
  )
}








