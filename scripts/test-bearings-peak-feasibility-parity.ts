import { evaluatePeakCandidateFeasibility } from '../src/domain/bearings/evaluateArcRouteMovementFeasibility'
import type { ScoredVenue } from '../src/domain/types/arc'
import type { IntentProfile } from '../src/domain/types/intent'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Bearings peak feasibility parity test: ${String(args[0])}`)
}) as typeof fetch

const nearbyIntent = {
  distanceMode: 'nearby',
  planningMode: 'user-led',
  anchor: {
    venueId: 'peak-good',
    role: 'highlight',
  },
} as IntentProfile

function makeCandidate(params: {
  id: string
  driveMinutes?: number
  proximityFit?: number
  businessStatus?: ScoredVenue['venue']['source']['businessStatus']
  sourceOrigin?: ScoredVenue['venue']['source']['sourceOrigin']
  likelyOpenForCurrentWindow?: boolean
  timeConfidence?: number
  highlightValidity?: ScoredVenue['highlightValidity']['validityLevel']
  personaVetoes?: string[]
  hardContractSatisfied?: boolean
}): ScoredVenue {
  return {
    candidateIdentity: {
      candidateId: params.id,
      baseVenueId: params.id,
      kind: 'base',
      traceLabel: params.id,
    },
    venue: {
      id: params.id,
      name: params.id,
      driveMinutes: params.driveMinutes ?? 8,
      source: {
        businessStatus: params.businessStatus ?? 'operational',
        sourceOrigin: params.sourceOrigin ?? 'curated',
        likelyOpenForCurrentWindow: params.likelyOpenForCurrentWindow ?? true,
        timeConfidence: params.timeConfidence ?? 0,
      },
    },
    fitBreakdown: {
      proximityFit: params.proximityFit ?? 0.72,
    },
    highlightValidity: {
      validityLevel: params.highlightValidity ?? 'valid',
      personaVetoes: params.personaVetoes ?? [],
      contextVetoes: [],
      violations: [],
    },
    roleContract: {
      peak: {
        strength: 'hard',
        satisfied: params.hardContractSatisfied ?? true,
      },
    },
  } as ScoredVenue
}

function legacyPeakFeasibility(candidate: ScoredVenue, intent?: IntentProfile): boolean {
  const anchoredPeakVenueId =
    intent?.planningMode === 'user-led' && (intent.anchor?.role ?? 'highlight') === 'highlight'
      ? intent.anchor?.venueId
      : undefined
  if (anchoredPeakVenueId && anchoredPeakVenueId !== candidate.candidateIdentity.baseVenueId) {
    return false
  }
  if (candidate.highlightValidity.validityLevel === 'invalid') {
    return false
  }
  if (intent) {
    if (intent.distanceMode === 'nearby' && candidate.venue.driveMinutes > 14) {
      return false
    }
  } else if (candidate.fitBreakdown.proximityFit < 0.48) {
    return false
  }
  if (
    candidate.venue.source.businessStatus === 'temporarily-closed' ||
    candidate.venue.source.businessStatus === 'closed-permanently'
  ) {
    return false
  }
  if (
    candidate.highlightValidity.personaVetoes.length > 0 ||
    candidate.highlightValidity.contextVetoes.length > 0 ||
    candidate.highlightValidity.violations.length > 0 ||
    (candidate.roleContract.peak.strength === 'hard' &&
      !candidate.roleContract.peak.satisfied)
  ) {
    return false
  }
  return true
}

function bearingsPeakFeasibility(candidate: ScoredVenue, intent?: IntentProfile): boolean {
  return evaluatePeakCandidateFeasibility({
    candidate,
    intent,
    anchoredPeakBaseVenueId:
      intent?.planningMode === 'user-led' && (intent.anchor?.role ?? 'highlight') === 'highlight'
        ? intent.anchor?.venueId
        : undefined,
    allowMeaningfulStretch: true,
    isMeaningfulStretchCandidate: () => false,
    evaluateHoursPressure: true,
    evaluateRouteTime: false,
    requireHighlightValidity: true,
    requireHighlightVetoClear: true,
    requirePeakContract: true,
  }).feasible
}

const cases = [
  makeCandidate({ id: 'peak-good' }),
  makeCandidate({ id: 'peak-distance-fail', driveMinutes: 24 }),
  makeCandidate({ id: 'peak-closed-fail', businessStatus: 'closed-permanently' }),
  makeCandidate({ id: 'peak-invalid-fail', highlightValidity: 'invalid' }),
  makeCandidate({ id: 'peak-contract-fail', hardContractSatisfied: false }),
]

const results = cases.map((candidate) => ({
  candidateId: candidate.candidateIdentity.baseVenueId,
  legacy: legacyPeakFeasibility(candidate, nearbyIntent),
  bearings: bearingsPeakFeasibility(candidate, nearbyIntent),
}))

for (const result of results) {
  assert(
    result.legacy === result.bearings,
    `Peak feasibility parity failed for ${result.candidateId}`,
  )
}

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      cases: results,
      providerNetworkCalls: fetchCallCount,
    },
    null,
    2,
  ),
)
