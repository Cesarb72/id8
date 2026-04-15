import type {
  OverlapPairDiagnostics,
  OverlapScenarioDiagnostics,
} from '../types/boundaryDiagnostics'

function roundPct(value: number): number {
  return Number(value.toFixed(1))
}

function jaccardOverlap(leftValues: string[], rightValues: string[]): number {
  const left = new Set(leftValues)
  const right = new Set(rightValues)
  if (left.size === 0 && right.size === 0) {
    return 100
  }
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let intersection = 0
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1
    }
  }
  const union = left.size + right.size - intersection
  return roundPct((intersection / union) * 100)
}

export function computeOverlapPair(
  left: OverlapScenarioDiagnostics,
  right: OverlapScenarioDiagnostics,
): OverlapPairDiagnostics {
  return {
    leftScenarioId: left.scenarioId,
    rightScenarioId: right.scenarioId,
    retrievedVenueOverlapPct: jaccardOverlap(left.retrievedVenueIds, right.retrievedVenueIds),
    rolePoolOverlapPct: jaccardOverlap(left.rolePoolVenueIds, right.rolePoolVenueIds),
    topCandidateOverlapPct: jaccardOverlap(left.topCandidateSignatures, right.topCandidateSignatures),
    winnerOverlapPct: left.winnerSignature === right.winnerSignature ? 100 : 0,
  }
}

export function computePairMatrix(
  scenarios: OverlapScenarioDiagnostics[],
): OverlapPairDiagnostics[] {
  const pairs: OverlapPairDiagnostics[] = []
  for (let index = 0; index < scenarios.length; index += 1) {
    const left = scenarios[index]
    for (let inner = index + 1; inner < scenarios.length; inner += 1) {
      const right = scenarios[inner]
      pairs.push(computeOverlapPair(left, right))
    }
  }
  return pairs
}
