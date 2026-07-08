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
    `Unexpected fetch in no-network Build candidate-pool compactness diagnostics test: ${String(args[0])}`,
  )
}) as typeof fetch

const repoRoot = process.cwd()
const arcTypesSource = readFileSync(join(repoRoot, 'src/domain/types/arc.ts'), 'utf8')
const greatStopTypesSource = readFileSync(
  join(repoRoot, 'src/domain/types/greatStopGate.ts'),
  'utf8',
)
const arcAssemblySource = readFileSync(
  join(repoRoot, 'src/domain/arc/assembleArcCandidates.ts'),
  'utf8',
)
const runGeneratePlanSource = readFileSync(
  join(repoRoot, 'src/domain/runGeneratePlan.ts'),
  'utf8',
)
const sandboxSource = readFileSync(
  join(repoRoot, 'src/pages/SandboxConciergePage.tsx'),
  'utf8',
)
const waypointSource = readFileSync(join(repoRoot, 'src/integrations/waypoint/core.ts'), 'utf8')
const routeAuthoritySource = readFileSync(
  join(repoRoot, 'src/app/services/routeAuthority/routeAuthorityService.ts'),
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  join(repoRoot, 'src/domain/artifacts/runtimeRouteArtifact.ts'),
  'utf8',
)

const requiredTypeTokens = [
  'preTop40Candidates?: ArcCandidate[]',
  'BuildCandidatePoolCompactnessDiagnostics',
  'fullAssembledCandidateCount',
  'anchorPreservingAssembledCandidateCount',
  'threeStopCandidateCount',
  'fourStopCandidateCount',
  'withSurpriseCandidateCount',
  'withoutSurpriseCandidateCount',
  'preTop40CompactCandidateCount',
  'preTop40PlaceRightCandidateCount',
  'preTop40NearCompactCandidateCount',
  'compactCandidatesPrunedBeforeTop40Count',
  'placeRightCandidatesPrunedBeforeTop40Count',
  'nearCompactCandidatesPrunedBeforeTop40Count',
  'compactCandidatesPreservedIntoTop40Count',
  'placeRightCandidatesPreservedIntoTop40Count',
  'preservedCompactCandidateIds',
  'preservedCompactCandidateRoutes',
  'replacedCandidateIds',
  'replacedCandidateCount',
  'candidatePreservationReason',
  'rolePoolNearAnchorSupportVisibility',
  'compactnessTotalMovementLimit',
  'greatStopTotalMovementLimit',
  'compactnessLimitMatchesGreatStopLimit',
  'nearestPreTop40CompactCandidate',
  'nearestPreTop40PlaceRightCandidate',
  'bestPreTop40NearCompactCandidate',
  'topPreTop40MovementCandidates',
  'buildCandidatePoolCompactnessDiagnostics?: BuildCandidatePoolCompactnessDiagnostics',
]

for (const token of requiredTypeTokens) {
  assert(
    arcTypesSource.includes(token) || greatStopTypesSource.includes(token),
    `Expected diagnostics type token ${token}.`,
  )
}

assert(
  arcAssemblySource.includes('preTop40Candidates: rankedCandidates'),
  'Arc assembly must expose the full ranked pre-top-40 candidate list diagnostically.',
)
assert(
  arcAssemblySource.includes('preservePreferredArcCandidates(') &&
    arcAssemblySource.includes('preserved_due_to_tight_compact_anchor_candidate') &&
    arcAssemblySource.indexOf('preTop40Candidates: rankedCandidates') >
      arcAssemblySource.indexOf('preservePreferredArcCandidates('),
  'Pre-top-40 diagnostics must be emitted after deterministic top-40 preservation.',
)
assert(
  runGeneratePlanSource.includes('buildBuildCandidatePoolCompactnessDiagnostics') &&
    runGeneratePlanSource.includes('preTop40RankedEntries') &&
    runGeneratePlanSource.includes('postTop40RankedEntries'),
  'runGeneratePlan must build pre/post top-40 compactness diagnostics.',
)
assert(
  runGeneratePlanSource.includes('rankArcCandidatesFromContract(preTop40ArcCandidates') &&
    runGeneratePlanSource.includes('rankArcCandidatesWithDiagnostics(preTop40ArcCandidates'),
  'Pre-top-40 candidates must be evaluated through existing Waypoint ranking diagnostics.',
)
assert(
  runGeneratePlanSource.includes('buildGreatStopGateResult({') &&
    runGeneratePlanSource.includes('gateResult?.criteria.placeRight.passed'),
  'Pre-top-40 place-right census must use existing Great Stop evaluation.',
)
assert(
  runGeneratePlanSource.includes('BUILD_CANDIDATE_POOL_COMPACTNESS_DETAIL_LIMIT = 5') &&
    sandboxSource.includes('buildCandidatePoolCompactnessDiagnostics.detailCandidateLimit'),
  'Visible candidate rows must be capped by the diagnostic detail limit.',
)
assert(
  sandboxSource.includes('buildCandidatePoolCompactnessDiagnostics:') &&
    sandboxSource.includes('buildCandidatePoolShapeCounts:') &&
    sandboxSource.includes('buildCandidatePoolRolePoolNearAnchor:') &&
    sandboxSource.includes('buildCandidatePoolLimitAlignment:') &&
    sandboxSource.includes('buildCandidatePoolTop40Preservation:') &&
    sandboxSource.includes('buildCandidatePoolNearestPreTop40Compact:') &&
    sandboxSource.includes('buildCandidatePoolNearestPreTop40PlaceRight:') &&
    sandboxSource.includes('buildCandidatePoolBestPreTop40NearCompact:') &&
    sandboxSource.includes('buildCandidatePoolTopPreTop40MovementCandidate.'),
  'Public Build diagnostics must visibly render the candidate-pool compactness census.',
)
assert(
  runGeneratePlanSource.includes(
    'WaypointRouteShapeCompactnessSignals.totalMovementLimit',
  ) &&
    runGeneratePlanSource.includes(
      'GreatStopGateResult.diagnostics.movement.totalLimitMinutes',
    ) &&
    runGeneratePlanSource.includes('compactnessLimitMatchesGreatStopLimit'),
  'Compactness-vs-Great-Stop movement limit mismatch must be visible.',
)
assert(
  runGeneratePlanSource.includes('same-neighborhood role-pool support is captured') &&
    sandboxSource.includes('sameClusterStart:') &&
    sandboxSource.includes('sameClusterWindDown:'),
  'Role-pool near-anchor support visibility must report derivable support and not-captured cluster fields.',
)
assert(
  waypointSource.includes('routeShapeCompactnessAdjustment') &&
    waypointSource.includes('routeShapeCompactnessSignals') &&
    !waypointSource.includes('buildCandidatePoolCompactnessDiagnostics'),
  'Waypoint ordering behavior must remain unchanged; new pool census belongs outside the ranking kernel.',
)
assert(
  routeAuthoritySource.includes("provider_shadow_not_authority") &&
    !routeAuthoritySource.includes('BuildCandidatePoolCompactnessDiagnostics'),
  'routeAuthority must remain unchanged and provider_shadow must remain non-authoritative.',
)
assert(
  runtimeRouteArtifactSource.includes('export interface RuntimeRouteArtifact') &&
    !runtimeRouteArtifactSource.includes('BuildCandidatePoolCompactnessDiagnostics'),
  'RuntimeRouteArtifact shape must remain unchanged.',
)
assert(
  greatStopTypesSource.includes('greatStopCandidateFailureDetails?:') &&
    greatStopTypesSource.includes('compactnessRankingDiagnostics?:'),
  'Existing Great Stop diagnostics must remain optional.',
)
assert(fetchCallCount === 0, 'No fetch calls should occur in compactness diagnostic test.')

const output = {
  preTop40CandidateCountsExposed: true,
  postTop40CandidateCountsExposed: true,
  shapeCountsExposed: true,
  surpriseShapeCountsExposed: true,
  compactPlaceRightNearCompactCountsExposed: true,
  prunedBeforeTop40CountsExposed: true,
  compactTop40PreservationExposed:
    arcAssemblySource.includes('preserved_due_to_tight_compact_anchor_candidate') &&
    runGeneratePlanSource.includes('compactCandidatesPreservedIntoTop40Count') &&
    sandboxSource.includes('buildCandidatePoolTop40Preservation:'),
  nearestPreTop40RowsVisible: true,
  absenceCanBeExplicit: sandboxSource.includes("firstCompactPreTop40Rank ?? 'none'"),
  compactnessAndGreatStopLimitsVisible: true,
  limitMismatchVisible: true,
  candidateRowsCappedAt: 5,
  orderingBehaviorUnchanged: !waypointSource.includes('buildCandidatePoolCompactnessDiagnostics'),
  top40CapPreserved:
    arcAssemblySource.includes('preservePreferredArcCandidates(') &&
    arcAssemblySource.includes('limit - preservationCandidates.length'),
  greatStopThresholdsUnchanged:
    readFileSync(join(repoRoot, 'src/domain/greatStop/buildGreatStopGateResult.ts'), 'utf8').includes(
      'maxComfortableTotalMovementMinutes: 24',
    ),
  routeAuthorityUnchanged: !routeAuthoritySource.includes(
    'BuildCandidatePoolCompactnessDiagnostics',
  ),
  runtimeRouteArtifactShapeUnchanged: !runtimeRouteArtifactSource.includes(
    'BuildCandidatePoolCompactnessDiagnostics',
  ),
  providerShadowRemainsNonAuthoritative: routeAuthoritySource.includes(
    'provider_shadow_not_authority',
  ),
  fetchCallCount,
}

console.log(JSON.stringify(output, null, 2))
