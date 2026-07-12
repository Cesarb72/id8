import {
  coordinateArcScoreAssembly,
  type CoordinateArcScoreAssemblyInput,
} from '../src/integrations/waypoint/coordination/coordinateArcScoreAssembly'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Waypoint score assembly parity test: ${String(args[0])}`)
}) as typeof fetch

function normalizeLegacyArcTotalScore(value: number): number {
  if (value <= 0) {
    return 0
  }
  if (value <= 0.88) {
    return value
  }
  return value / (1 + value - 0.88)
}

function legacyTotalScoreRaw(input: CoordinateArcScoreAssemblyInput): number {
  return (
    input.roleFlowScore * 0.34 +
    input.diversityScore * 0.12 +
    input.geographyScore * 0.2 +
    input.hiddenGemLift * 0.1 +
    input.windDownScore * 0.14 +
    input.pacingScore * 0.12 +
    input.transitionSmoothnessScore * 0.1 +
    input.outingLengthScore * 0.08 +
    input.vibeCoherenceScore * 0.1 +
    input.highlightVibeScore * 0.12 +
    input.highlightMomentScore * 0.18 +
    input.momentVarianceScore * 0.12 +
    input.highlightValidityScore * 0.16 +
    input.arcContrastScore * 0.16 +
    input.highlightCenteringScore * 0.14 +
    input.discoveryContractScore * 0.4 +
    input.supportStopVibeScore * 0.14 +
    input.routeShapeBiasScore * 0.08 +
    input.alignmentPreservationScore * 0.32 +
    input.themeSpreadScore * 0.08 +
    input.momentPreservationScore * 0.16 +
    input.romanticContractScore +
    input.familyCompetitionScore +
    input.expressionReleaseScore +
    input.activationMomentElevationScore +
    input.localStretchScore +
    input.roleEnergyScore * 0.1 +
    input.liveRolePromotionScore * 0.06 +
    input.roleAwareCategoryLift * 0.12 +
    input.surpriseDirectionAlignmentScore +
    input.surpriseHighlightCalibrationScore +
    input.highlightDominanceBoost +
    input.familyAlignmentBoost +
    input.categoryDiversityBonus +
    input.lensCoherenceScore * 0.1 +
    input.contextSpecificityLift * 0.09 -
    input.weakHighlightPenalty -
    input.familyMismatchPenalty -
    input.supportPenalty -
    input.fakeCompletenessPenalty -
    input.discoveryContractPenalty * 0.18 -
    input.categoryDiversityPenalty -
    input.awkwardPacingPenalty * 0.14 -
    input.dominancePenalty * 0.08 +
    input.contractComplianceScore * 0.12 -
    input.contractViolationPenalty * 0.16 -
    input.momentFlatPenalty -
    input.momentPenalty -
    input.romanticContractPenalty -
    input.familyCompetitionPenalty -
    input.expressionReleasePenalty -
    input.activationMomentElevationPenalty -
    input.fallbackHighlightPenalty -
    input.localStretchPenalty -
    input.themeSpreadPenalty -
    input.surpriseDirectionAlignmentPenalty -
    input.surpriseHighlightCalibrationPenalty -
    input.roleEnergyPenalty -
    input.missedPeakPenalty -
    input.alignmentPreservationPenalty +
    input.whenSpatialScoreDelta
  )
}

const input: CoordinateArcScoreAssemblyInput = {
  roleFlowScore: 0.82,
  diversityScore: 0.74,
  geographyScore: 0.78,
  hiddenGemLift: 0.28,
  windDownScore: 0.66,
  pacingScore: 0.7,
  transitionSmoothnessScore: 0.69,
  outingLengthScore: 0.71,
  vibeCoherenceScore: 0.76,
  highlightVibeScore: 0.81,
  highlightMomentScore: 0.88,
  momentVarianceScore: 0.64,
  highlightValidityScore: 0.92,
  arcContrastScore: 0.63,
  highlightCenteringScore: 0.77,
  discoveryContractScore: 0.52,
  supportStopVibeScore: 0.68,
  routeShapeBiasScore: 0.55,
  alignmentPreservationScore: 0.73,
  themeSpreadScore: 0.46,
  momentPreservationScore: 0.84,
  romanticContractScore: 0.08,
  familyCompetitionScore: 0.03,
  expressionReleaseScore: 0.05,
  activationMomentElevationScore: 0.04,
  localStretchScore: 0.02,
  roleEnergyScore: 0.67,
  liveRolePromotionScore: 0.31,
  roleAwareCategoryLift: 0.27,
  surpriseDirectionAlignmentScore: 0.015,
  surpriseHighlightCalibrationScore: 0.018,
  highlightDominanceBoost: 0.01,
  familyAlignmentBoost: 0.02,
  categoryDiversityBonus: 0.01,
  lensCoherenceScore: 0.72,
  contextSpecificityLift: 0.61,
  weakHighlightPenalty: 0.01,
  familyMismatchPenalty: 0.005,
  supportPenalty: 0.01,
  fakeCompletenessPenalty: 0.02,
  discoveryContractPenalty: 0.06,
  categoryDiversityPenalty: 0.015,
  awkwardPacingPenalty: 0.03,
  dominancePenalty: 0.025,
  contractComplianceScore: 0.58,
  contractViolationPenalty: 0.04,
  momentFlatPenalty: 0,
  momentPenalty: 0.01,
  romanticContractPenalty: 0.02,
  familyCompetitionPenalty: 0.01,
  expressionReleasePenalty: 0.008,
  activationMomentElevationPenalty: 0.006,
  fallbackHighlightPenalty: 0.012,
  localStretchPenalty: 0.004,
  themeSpreadPenalty: 0.011,
  surpriseDirectionAlignmentPenalty: 0.007,
  surpriseHighlightCalibrationPenalty: 0.006,
  roleEnergyPenalty: 0.014,
  missedPeakPenalty: 0,
  alignmentPreservationPenalty: 0.013,
  whenSpatialScoreDelta: 0.009,
}

const waypoint = coordinateArcScoreAssembly(input)
const legacyRaw = legacyTotalScoreRaw(input)
const legacyTotal = normalizeLegacyArcTotalScore(legacyRaw)

assert(
  Math.abs(waypoint.totalScoreRaw - legacyRaw) < 1e-12,
  'Waypoint raw score must match legacy Arc formula.',
)
assert(
  Math.abs(waypoint.totalScore - legacyTotal) < 1e-12,
  'Waypoint normalized score must match legacy Arc formula.',
)

console.log(
  JSON.stringify(
    {
      observer: 'waypoint_score_assembly_parity',
      status: 'PASS',
      scoreCombiningParity: true,
      legacyRaw,
      waypointRaw: waypoint.totalScoreRaw,
      legacyTotal,
      waypointTotal: waypoint.totalScore,
      providerNetworkCalls: fetchCallCount,
    },
    null,
    2,
  ),
)
