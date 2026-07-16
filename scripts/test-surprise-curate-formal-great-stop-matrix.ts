import { sanJoseVenues } from '../src/data/venues.ts'
import { buildRouteRecommendationLifecycleDiagnostics } from '../src/app/services/routeRecommendationLifecycle.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import {
  GreatStopGateSelectionError,
  type BuildLocationClass,
  type GreatStopGateCriterion,
  type GreatStopGateResult,
  type GreatStopGateSelectionDiagnostics,
} from '../src/domain/types/greatStopGate.ts'
import type {
  DistanceMode,
  ExperienceMode,
  IntentInput,
  PersonaMode,
  VibeAnchor,
} from '../src/domain/types/intent.ts'

type MatrixMode = Extract<ExperienceMode, 'surprise' | 'curate'>
type PassFail = 'PASS' | 'FAIL'
type MatrixCellStatus = 'completed' | 'soft_gate_exhausted' | 'runtime_error'

interface MatrixCellSpec {
  mode: MatrixMode
  persona: PersonaMode
  locationClass: BuildLocationClass
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  district: string
  distanceMode: DistanceMode
}

interface MatrixCellResult {
  mode: MatrixMode
  persona: PersonaMode
  locationClass: BuildLocationClass
  caseIdentity: string
  starterIdentity: string | null
  status: MatrixCellStatus
  candidatePoolSize: number | null
  selectedCandidate: string | null
  selectedRouteNames: string[]
  softGate: string
  aggregate: PassFail
  real: PassFail
  role: PassFail
  intent: PassFail
  place: PassFail
  moment: PassFail
  reviewable: boolean
  lockable: boolean
  failureReasons: string[]
  greatStopGateResult: {
    status: PassFail
    failedCriteria: GreatStopGateCriterion[]
    reasons: string[]
    preset?: GreatStopGateResult['preset']
  } | null
  selectionDiagnostics: GreatStopGateSelectionDiagnostics | null
  fallbackHit: boolean
  providerCalls: number
  errorMessage?: string
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Surprise/Curate formal Great Stop matrix must not call fetch: ${url}`)
}) as typeof fetch

const personas: Array<{
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
}> = [
  { persona: 'romantic', primaryVibe: 'cozy', secondaryVibe: 'lively' },
  { persona: 'friends', primaryVibe: 'lively', secondaryVibe: 'cultured' },
  { persona: 'family', primaryVibe: 'playful', secondaryVibe: 'cultured' },
]

const locationClasses: Array<{
  locationClass: BuildLocationClass
  district: string
  distanceMode: DistanceMode
}> = [
  { locationClass: 'L1 Dense', district: 'Downtown', distanceMode: 'nearby' },
  { locationClass: 'L2 Mid', district: 'San Jose', distanceMode: 'short-drive' },
  { locationClass: 'L3 Sparse', district: 'Evergreen', distanceMode: 'short-drive' },
]

const modes: MatrixMode[] = ['surprise', 'curate']

function buildSpecs(): MatrixCellSpec[] {
  return modes.flatMap((mode) =>
    personas.flatMap((persona) =>
      locationClasses.map((location) => ({
        mode,
        persona: persona.persona,
        primaryVibe: persona.primaryVibe,
        ...(persona.secondaryVibe ? { secondaryVibe: persona.secondaryVibe } : {}),
        locationClass: location.locationClass,
        district: location.district,
        distanceMode: location.distanceMode,
      })),
    ),
  )
}

function caseIdentity(spec: MatrixCellSpec): string {
  return `${spec.mode}:${spec.persona}:${spec.locationClass}`
}

function buildInput(spec: MatrixCellSpec): IntentInput {
  return {
    mode: spec.mode,
    planningMode: 'engine-led',
    persona: spec.persona,
    primaryVibe: spec.primaryVibe,
    secondaryVibe: spec.secondaryVibe,
    city: 'San Jose',
    district: spec.district,
    distanceMode: spec.distanceMode,
    prefersHiddenGems: spec.mode === 'surprise',
  }
}

function passFail(passed: boolean): PassFail {
  return passed ? 'PASS' : 'FAIL'
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function criterionStatus(
  criterion: GreatStopGateCriterion,
  failedCriteria: readonly GreatStopGateCriterion[],
): PassFail {
  return failedCriteria.includes(criterion) ? 'FAIL' : 'PASS'
}

function rowFromGate(params: {
  spec: MatrixCellSpec
  gate: GreatStopGateResult
  selectionDiagnostics: GreatStopGateSelectionDiagnostics | undefined
  result: Awaited<ReturnType<typeof runGeneratePlan>>
}): MatrixCellResult {
  const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: true,
    finalRoutePresent: true,
    greatStopStatus: params.gate.status,
    routeAuthorityStatus: params.result.contractEntryArtifact.enrichment?.validationStatus ?? null,
    lockInputAvailable:
      params.result.contractEntryArtifact.enrichment?.runtimeLockEligibility?.eligible ?? false,
    reviewEligible:
      params.result.contractEntryArtifact.enrichment?.runtimeLockEligibility?.eligible ?? false,
    lockEligible:
      params.result.contractEntryArtifact.enrichment?.runtimeLockEligibility?.eligible ?? false,
  })
  const selectedRank = params.selectionDiagnostics?.selectedCandidateRank
  const softGate =
    params.selectionDiagnostics?.status === 'PASS'
      ? `selected rank ${selectedRank ?? 'unknown'}`
      : params.selectionDiagnostics?.status ?? 'not_reported'

  return {
    mode: params.spec.mode,
    persona: params.spec.persona,
    locationClass: params.spec.locationClass,
    caseIdentity: caseIdentity(params.spec),
    starterIdentity: null,
    status: 'completed',
    candidatePoolSize:
      params.selectionDiagnostics?.rankedCandidateCount ??
      params.selectionDiagnostics?.evaluatedCandidateCount ??
      null,
    selectedCandidate:
      params.selectionDiagnostics?.selectedCandidateId ?? params.result.selectedArc.id,
    selectedRouteNames: params.result.selectedArc.stops.map(
      (stop) => stop.scoredVenue.venue.name,
    ),
    softGate,
    aggregate: params.gate.status,
    real: passFail(params.gate.criteria.real.passed),
    role: passFail(params.gate.criteria.roleRight.passed),
    intent: passFail(params.gate.criteria.intentRight.passed),
    place: passFail(params.gate.criteria.placeRight.passed),
    moment: passFail(params.gate.criteria.momentRight.passed),
    reviewable: lifecycle.reviewEligible,
    lockable: lifecycle.lockEligible,
    failureReasons: unique(params.gate.reasons),
    greatStopGateResult: {
      status: params.gate.status,
      failedCriteria: [...params.gate.failedCriteria],
      reasons: unique(params.gate.reasons),
      preset: params.gate.preset,
    },
    selectionDiagnostics: params.selectionDiagnostics
      ? {
          status: params.selectionDiagnostics.status,
          stage: params.selectionDiagnostics.stage,
          selectedCandidateId: params.selectionDiagnostics.selectedCandidateId,
          selectedCandidateRank: params.selectionDiagnostics.selectedCandidateRank,
          rankedCandidateCount: params.selectionDiagnostics.rankedCandidateCount,
          evaluatedCandidateCount: params.selectionDiagnostics.evaluatedCandidateCount,
          fullEvaluatedCandidateCount: params.selectionDiagnostics.fullEvaluatedCandidateCount,
          failedTopCandidateCriteria: params.selectionDiagnostics.failedTopCandidateCriteria,
          failureReasons: unique(params.selectionDiagnostics.failureReasons),
          passingCandidateCount: params.selectionDiagnostics.passingCandidateCount,
        }
      : null,
    fallbackHit: true,
    providerCalls: fetchCallCount,
  }
}

function rowFromSelectionError(
  spec: MatrixCellSpec,
  diagnostics: GreatStopGateSelectionDiagnostics,
): MatrixCellResult {
  const failedCriteria =
    diagnostics.failedTopCandidateCriteria ??
    diagnostics.bestFailingCandidateSummary?.failedCriteria ??
    []
  const failureReasons =
    diagnostics.failureReasons.length > 0
      ? diagnostics.failureReasons
      : diagnostics.bestFailingCandidateSummary?.reasons ?? []

  return {
    mode: spec.mode,
    persona: spec.persona,
    locationClass: spec.locationClass,
    caseIdentity: caseIdentity(spec),
    starterIdentity: null,
    status: 'soft_gate_exhausted',
    candidatePoolSize:
      diagnostics.rankedCandidateCount ?? diagnostics.evaluatedCandidateCount ?? null,
    selectedCandidate: null,
    selectedRouteNames: [],
    softGate: 'exhausted',
    aggregate: 'FAIL',
    real: criterionStatus('real', failedCriteria),
    role: criterionStatus('role_right', failedCriteria),
    intent: criterionStatus('intent_right', failedCriteria),
    place: criterionStatus('place_right', failedCriteria),
    moment: criterionStatus('moment_right', failedCriteria),
    reviewable: false,
    lockable: false,
    failureReasons: unique(failureReasons),
    greatStopGateResult: null,
    selectionDiagnostics: {
      status: diagnostics.status,
      stage: diagnostics.stage,
      rankedCandidateCount: diagnostics.rankedCandidateCount,
      evaluatedCandidateCount: diagnostics.evaluatedCandidateCount,
      fullEvaluatedCandidateCount: diagnostics.fullEvaluatedCandidateCount,
      failedTopCandidateCriteria: diagnostics.failedTopCandidateCriteria,
      failureReasons: unique(diagnostics.failureReasons),
      passingCandidateCount: diagnostics.passingCandidateCount,
      bestFailingCandidateSummary: diagnostics.bestFailingCandidateSummary,
    },
    fallbackHit: true,
    providerCalls: fetchCallCount,
  }
}

function rowFromRuntimeError(spec: MatrixCellSpec, error: unknown): MatrixCellResult {
  const message = error instanceof Error ? error.message : String(error)
  return {
    mode: spec.mode,
    persona: spec.persona,
    locationClass: spec.locationClass,
    caseIdentity: caseIdentity(spec),
    starterIdentity: null,
    status: 'runtime_error',
    candidatePoolSize: null,
    selectedCandidate: null,
    selectedRouteNames: [],
    softGate: 'not_reached',
    aggregate: 'FAIL',
    real: 'FAIL',
    role: 'FAIL',
    intent: 'FAIL',
    place: 'FAIL',
    moment: 'FAIL',
    reviewable: false,
    lockable: false,
    failureReasons: [`runtime_error:${message}`],
    greatStopGateResult: null,
    selectionDiagnostics: null,
    fallbackHit: true,
    providerCalls: fetchCallCount,
    errorMessage: message,
  }
}

async function runCell(spec: MatrixCellSpec): Promise<MatrixCellResult> {
  try {
    const result = await runGeneratePlan(buildInput(spec), {
      seedVenues: sanJoseVenues,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
      greatStopGateLocationClass: spec.locationClass,
    })
    const gate = result.trace.greatStopGateResult
    if (!gate) {
      return rowFromRuntimeError(spec, new Error('trace.greatStopGateResult missing'))
    }
    return rowFromGate({
      spec,
      gate,
      selectionDiagnostics: result.trace.greatStopGateSelectionDiagnostics,
      result,
    })
  } catch (error) {
    if (error instanceof GreatStopGateSelectionError) {
      return rowFromSelectionError(spec, error.greatStopGateSelectionDiagnostics)
    }
    return rowFromRuntimeError(spec, error)
  }
}

function countWhere<T>(items: T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length
}

function summarize(results: MatrixCellResult[], mode: MatrixMode) {
  const cells = results.filter((result) => result.mode === mode)
  return {
    totalCells: cells.length,
    passCount: countWhere(cells, (cell) => cell.aggregate === 'PASS'),
    failCount: countWhere(cells, (cell) => cell.aggregate === 'FAIL'),
    softGateSelectedLowerRank: cells
      .filter((cell) => {
        const rank = cell.selectionDiagnostics?.selectedCandidateRank
        return typeof rank === 'number' && rank > 1
      })
      .map((cell) => ({
        caseIdentity: cell.caseIdentity,
        selectedCandidateRank: cell.selectionDiagnostics?.selectedCandidateRank,
      })),
    softGateExhausted: cells
      .filter((cell) => cell.status === 'soft_gate_exhausted')
      .map((cell) => cell.caseIdentity),
    reviewableNotLockable: cells
      .filter((cell) => cell.reviewable && !cell.lockable)
      .map((cell) => cell.caseIdentity),
    neitherReviewableNorLockable: cells
      .filter((cell) => !cell.reviewable && !cell.lockable)
      .map((cell) => cell.caseIdentity),
    failBlockedNotSurfaced: cells
      .filter((cell) => cell.aggregate === 'FAIL' && (cell.reviewable || cell.lockable))
      .map((cell) => cell.caseIdentity),
    fallbackHit: cells.filter((cell) => cell.fallbackHit).map((cell) => cell.caseIdentity),
    providerCalls: fetchCallCount,
  }
}

async function main(): Promise<void> {
  try {
    const specs = buildSpecs()
    const results: MatrixCellResult[] = []
    for (const spec of specs) {
      process.stderr.write(`matrix cell start: ${caseIdentity(spec)}\n`)
      const row = await runCell(spec)
      process.stderr.write(`matrix cell done: ${caseIdentity(spec)} ${row.status} ${row.aggregate}\n`)
      results.push(row)
    }

    const missingCells = specs
      .map(caseIdentity)
      .filter((identity) => !results.some((result) => result.caseIdentity === identity))
    const runtimeErrors = results.filter((result) => result.status === 'runtime_error')

    process.stdout.write(
      `${JSON.stringify(
        {
          observer: 'surprise_curate_formal_great_stop_matrix',
          proofType: 'current_no_provider_generation_plus_formal_great_stop_gate',
          realCaseSources: [
            'runGeneratePlan',
            'src/data/venues.ts sanJoseVenues',
            'Packet 1A 2x3x3 Surprise/Curate mode-persona-location grid',
          ],
          collectAllFailuresMode: true,
          syntheticFixturesUsed: false,
          totalCellsConstructed: results.length,
          expectedCells: 18,
          missingCells,
          runtimeErrorCells: runtimeErrors.map((result) => ({
            caseIdentity: result.caseIdentity,
            errorMessage: result.errorMessage,
          })),
          providerCalls: fetchCallCount,
          summaries: {
            surprise: summarize(results, 'surprise'),
            curate: summarize(results, 'curate'),
          },
          cells: results,
        },
        null,
        2,
      )}\n`,
    )

    if (fetchCallCount !== 0) {
      throw new Error(`Expected provider silence, fetch called ${fetchCallCount} time(s).`)
    }
    if (missingCells.length > 0 || results.length !== 18) {
      throw new Error(`Expected 18 constructed cells, got ${results.length}.`)
    }
    if (runtimeErrors.length > 0) {
      throw new Error(`Runtime errors in ${runtimeErrors.length} matrix cell(s).`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
