interface SelectionConfidenceInput {
  selectedScore: number
  roleFit: number
  lensCompatibility: number
  runnerUpScore?: number
  rolePoolSize: number
  strongCandidateCount: number
  fallbackUsed: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getSelectionConfidence({
  selectedScore,
  roleFit,
  lensCompatibility,
  runnerUpScore,
  rolePoolSize,
  strongCandidateCount,
  fallbackUsed,
}: SelectionConfidenceInput): number {
  let confidence = selectedScore * 72 + roleFit * 18 + lensCompatibility * 10

  if (typeof runnerUpScore === 'number') {
    const margin = selectedScore - runnerUpScore
    confidence += clamp(margin * 70, -18, 18)
  }

  if (rolePoolSize <= 2) {
    confidence -= 12
  } else if (rolePoolSize <= 4) {
    confidence -= 6
  }

  if (strongCandidateCount === 0) {
    confidence -= 12
  } else if (strongCandidateCount === 1) {
    confidence -= 7
  }

  if (fallbackUsed) {
    confidence -= 18
  }

  return Math.round(clamp(confidence, 0, 100))
}
