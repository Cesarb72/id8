export interface CoordinateArcScoreAssemblyInput {
  roleFlowScore: number
  diversityScore: number
  geographyScore: number
  hiddenGemLift: number
  windDownScore: number
  pacingScore: number
  transitionSmoothnessScore: number
  outingLengthScore: number
  vibeCoherenceScore: number
  highlightVibeScore: number
  highlightMomentScore: number
  momentVarianceScore: number
  highlightValidityScore: number
  arcContrastScore: number
  highlightCenteringScore: number
  discoveryContractScore: number
  supportStopVibeScore: number
  routeShapeBiasScore: number
  alignmentPreservationScore: number
  themeSpreadScore: number
  momentPreservationScore: number
  romanticContractScore: number
  familyCompetitionScore: number
  expressionReleaseScore: number
  activationMomentElevationScore: number
  localStretchScore: number
  roleEnergyScore: number
  liveRolePromotionScore: number
  roleAwareCategoryLift: number
  surpriseDirectionAlignmentScore: number
  surpriseHighlightCalibrationScore: number
  highlightDominanceBoost: number
  familyAlignmentBoost: number
  categoryDiversityBonus: number
  lensCoherenceScore: number
  contextSpecificityLift: number
  weakHighlightPenalty: number
  familyMismatchPenalty: number
  supportPenalty: number
  fakeCompletenessPenalty: number
  discoveryContractPenalty: number
  categoryDiversityPenalty: number
  awkwardPacingPenalty: number
  dominancePenalty: number
  contractComplianceScore: number
  contractViolationPenalty: number
  momentFlatPenalty: number
  momentPenalty: number
  romanticContractPenalty: number
  familyCompetitionPenalty: number
  expressionReleasePenalty: number
  activationMomentElevationPenalty: number
  fallbackHighlightPenalty: number
  localStretchPenalty: number
  themeSpreadPenalty: number
  surpriseDirectionAlignmentPenalty: number
  surpriseHighlightCalibrationPenalty: number
  roleEnergyPenalty: number
  missedPeakPenalty: number
  alignmentPreservationPenalty: number
  whenSpatialScoreDelta: number
}

export interface CoordinateArcScoreAssemblyResult {
  totalScoreRaw: number
  totalScore: number
}

function normalizeArcTotalScore(value: number): number {
  if (value <= 0) {
    return 0
  }
  if (value <= 0.88) {
    return value
  }
  return value / (1 + value - 0.88)
}

export function coordinateArcScoreAssembly(
  input: CoordinateArcScoreAssemblyInput,
): CoordinateArcScoreAssemblyResult {
  const totalScoreRaw =
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

  return {
    totalScoreRaw,
    totalScore: normalizeArcTotalScore(totalScoreRaw),
  }
}
