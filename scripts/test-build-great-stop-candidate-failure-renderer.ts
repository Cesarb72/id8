import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(
    `Unexpected fetch in no-network Great Stop candidate failure renderer test: ${String(args[0])}`,
  )
}) as typeof fetch

const repoRoot = process.cwd()
const sandboxSource = readFileSync(join(repoRoot, 'src/pages/SandboxConciergePage.tsx'), 'utf8')
const greatStopGateSource = readFileSync(
  join(repoRoot, 'src/domain/greatStop/buildGreatStopGateResult.ts'),
  'utf8',
)
const greatStopGateTypesSource = readFileSync(
  join(repoRoot, 'src/domain/types/greatStopGate.ts'),
  'utf8',
)
const routeAuthoritySource = readFileSync(
  join(repoRoot, 'src/app/services/routeAuthority/routeAuthorityService.ts'),
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  join(repoRoot, 'src/domain/artifacts/runtimeRouteArtifact.ts'),
  'utf8',
)

const requiredRendererTokens = [
  'greatStopCandidateFailureDetails:',
  'greatStopCandidateFailureReasonCounts:',
  'greatStopNearestToPass:',
  'greatStopTopFailingCandidate.',
  'formatGreatStopCandidateFailureDetail',
  'formatGreatStopRepeatedFailureReasonCounts',
  'topFailingCandidates.slice(',
  'greatStopCandidateFailureDetails.detailCandidateLimit',
  'route:${candidate.routeNames.join',
  'rawIds:${candidate.stopIds.join',
  'baseIds:${candidate.baseVenueIds.join',
  'movement:${candidate.totalMovementEstimate}/${candidate.totalLimitMinutes}',
  'maxTransition:${candidate.maxSingleTransitionEstimate}/${candidate.transitionLimitMinutes}',
  'clusters:${candidate.clusterPath.join',
  'moment:${candidate.momentFailureReasons.join',
  'score:${formatGreatStopScoreSummary(candidate.scoreSummary)}',
  'greatStopCompactnessActivation:',
  'greatStopCompactnessRanking:',
  'greatStopCompactnessPoolVisibility:',
  'greatStopNearestCompactCandidate:',
  'greatStopNearestPlaceRightCandidate:',
  'greatStopCompactnessTopCandidate.',
  'formatGreatStopCompactnessCandidateDetail',
  'greatStopCompactnessRankingDiagnostics.detailCandidateLimit',
  'compactnessAdjustment:${candidate.compactnessAdjustmentScore}',
  'score:${candidate.originalWaypointScore}->${candidate.adjustedWaypointScore}',
]

for (const token of requiredRendererTokens) {
  assert(sandboxSource.includes(token), `Build quality renderer must expose ${token}.`)
}

assert(
  sandboxSource.includes('greatStopCandidateFailureDetails') &&
    sandboxSource.includes("greatStopTopFailingCandidates: n/a"),
  'Renderer must handle missing Great Stop candidate failure details safely.',
)
assert(
  sandboxSource.includes('data-id8-public-build-quality-diagnostics={safeJsonForDataAttribute('),
  'Full public Build quality diagnostics object must remain available as data JSON.',
)
assert(
  sandboxSource.includes('greatStopGateSelectionDiagnostics:') &&
    sandboxSource.includes('generationContractDebug?.greatStopGateSelectionDiagnostics'),
  'Great Stop selection diagnostics must still propagate to public Build diagnostics.',
)
assert(
  greatStopGateTypesSource.includes('greatStopCandidateFailureDetails?: GreatStopCandidateFailureDetails'),
  'Candidate failure details must remain optional under GreatStopGateSelectionDiagnostics.',
)
assert(
  greatStopGateTypesSource.includes(
    'compactnessRankingDiagnostics?: GreatStopCompactnessRankingDiagnostics',
  ),
  'Compactness ranking diagnostics must remain optional under GreatStopGateSelectionDiagnostics.',
)
assert(
  greatStopGateSource.includes('const GREAT_STOP_FAILURE_DETAIL_LIMIT = 5') &&
    sandboxSource.includes('greatStopCandidateFailureDetails.detailCandidateLimit'),
  'Renderer must use the existing capped candidate detail limit.',
)
assert(
  greatStopGateSource.includes('maxComfortableTotalMovementMinutes: 24') &&
    greatStopGateSource.includes("driveLikeMovement: 'limited'"),
  'Great Stop place-right thresholds must remain unchanged.',
)
assert(
  routeAuthoritySource.includes("reasons.push('provider_shadow_not_authority')"),
  'routeAuthority must still reject provider_shadow as non-authority.',
)
assert(
  !routeAuthoritySource.includes('greatStopCandidateFailureDetails'),
  'Candidate failure renderer patch must not modify routeAuthority.',
)
assert(
  runtimeRouteArtifactSource.includes('export interface RuntimeRouteArtifact') &&
    !runtimeRouteArtifactSource.includes('greatStopCandidateFailureDetails'),
  'RuntimeRouteArtifact shape must remain unchanged.',
)
assert(fetchCallCount === 0, 'No fetch calls should occur in renderer regression.')

const output = {
  rendererPrintsCandidateFailureDetails: sandboxSource.includes(
    'greatStopCandidateFailureDetails:',
  ),
  rendererPrintsNearestToPass: sandboxSource.includes('greatStopNearestToPass:'),
  rendererPrintsTopFailingCandidates: sandboxSource.includes(
    'greatStopTopFailingCandidate.',
  ),
  rendererPrintsRepeatedFailureReasonCounts: sandboxSource.includes(
    'greatStopCandidateFailureReasonCounts:',
  ),
  rendererPrintsCompactnessActivation: sandboxSource.includes(
    'greatStopCompactnessActivation:',
  ),
  rendererPrintsCompactnessRanking: sandboxSource.includes(
    'greatStopCompactnessRanking:',
  ),
  rendererPrintsCompactnessPoolVisibility: sandboxSource.includes(
    'greatStopCompactnessPoolVisibility:',
  ),
  rendererPrintsNearestCompactCandidate: sandboxSource.includes(
    'greatStopNearestCompactCandidate:',
  ),
  rendererPrintsNearestPlaceRightCandidate: sandboxSource.includes(
    'greatStopNearestPlaceRightCandidate:',
  ),
  rendererPrintsCappedCompactnessTopCandidates: sandboxSource.includes(
    'greatStopCompactnessTopCandidate.',
  ),
  candidateDetailRowsCappedByExistingLimit:
    sandboxSource.includes('topFailingCandidates.slice(') &&
    sandboxSource.includes('greatStopCandidateFailureDetails.detailCandidateLimit'),
  aggregateCountsStillProducedByGate: greatStopGateSource.includes(
    'repeatedFailureReasonCounts',
  ),
  greatStopBehaviorThresholdsUnchanged:
    greatStopGateSource.includes('maxComfortableTotalMovementMinutes: 24') &&
    greatStopGateSource.includes("driveLikeMovement: 'limited'"),
  routeAuthorityUnchanged: !routeAuthoritySource.includes('greatStopCandidateFailureDetails'),
  runtimeRouteArtifactShapeUnchanged: !runtimeRouteArtifactSource.includes(
    'greatStopCandidateFailureDetails',
  ),
  providerShadowRemainsNonAuthoritative: routeAuthoritySource.includes(
    'provider_shadow_not_authority',
  ),
  fetchCallCount,
}

console.log(JSON.stringify(output, null, 2))
