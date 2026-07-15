import { sanJoseVenues } from '../src/data/venues.ts'
import { getArcStopBaseVenueId } from '../src/domain/candidates/candidateIdentity.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type {
  BuildLocationClass,
  GreatStopGateCriterion,
  GreatStopGateResult,
} from '../src/domain/types/greatStopGate.ts'
import type {
  AnchorRole,
  DistanceMode,
  IntentInput,
  PersonaMode,
  VibeAnchor,
} from '../src/domain/types/intent.ts'

type HistoricalKind = 'THIN' | 'PASS'

interface BuildMatrixCellSpec {
  key: string
  cell: string
  historicalKind: HistoricalKind
  anchorVenueId: string
  anchorName: string
  anchorRole: AnchorRole
  anchorType: string
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  district: string
  distanceMode: DistanceMode
  expectedLocationClass: BuildLocationClass
}

interface BuildMatrixCellResult {
  key: string
  cell: string
  anchor: string
  anchorVenueId: string
  anchorRole: AnchorRole
  anchorType: string
  personaLocationBucket: string
  persona: PersonaMode
  expectedLocationClass: BuildLocationClass
  actualLocationClass: BuildLocationClass
  locationClassSource: string
  historicalKind: HistoricalKind
  generatedRouteIds: string[]
  generatedRouteNames: string[]
  selectedArcId: string
  real: 'PASS' | 'FAIL'
  roleRight: 'PASS' | 'FAIL'
  intentRight: 'PASS' | 'FAIL'
  placeRight: 'PASS' | 'FAIL'
  momentRight: 'PASS' | 'FAIL'
  aggregate: 'PASS' | 'FAIL'
  pass: boolean
  failedCriteria: GreatStopGateCriterion[]
  failureReasons: string[]
  requiredAnchorSurvived: boolean | null
  requiredAnchorCreditedRole: string | null
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Build matrix formal Great Stop observer must not call fetch: ${url}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

// Existing Build quality matrix from artifact replay diagnostics, converted to
// current no-provider generation inputs. The historical L3 labels are retained
// as matrix metadata; current generation-based formal gate infers only L1/L2
// unless an explicit location class is supplied, and supplying it changes Build
// Great Stop pre-selection behavior.
const buildMatrixCells: BuildMatrixCellSpec[] = [
  {
    key: 'l2_adega',
    cell: 'L2 Romantic / Adega',
    historicalKind: 'THIN',
    anchorVenueId: 'sj-adega-wine-atelier',
    anchorName: 'Adega',
    anchorRole: 'highlight',
    anchorType: 'wine_bar',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    expectedLocationClass: 'L2 Mid',
  },
  {
    key: 'l2_miniboss',
    cell: 'L2 Friends / MINIBOSS',
    historicalKind: 'THIN',
    anchorVenueId: 'sj-miniboss',
    anchorName: 'MINIBOSS',
    anchorRole: 'highlight',
    anchorType: 'arcade_bar',
    persona: 'friends',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    district: 'Downtown',
    distanceMode: 'short-drive',
    expectedLocationClass: 'L2 Mid',
  },
  {
    key: 'l2_happy_hollow',
    cell: 'L2 Family / Happy Hollow',
    historicalKind: 'THIN',
    anchorVenueId: 'sj-happy-hollow',
    anchorName: 'Happy Hollow',
    anchorRole: 'highlight',
    anchorType: 'family_activity',
    persona: 'family',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    district: 'East San Jose',
    distanceMode: 'short-drive',
    expectedLocationClass: 'L2 Mid',
  },
  {
    key: 'l3_village_grill',
    cell: 'L3 Friends / Village Grill',
    historicalKind: 'THIN',
    anchorVenueId: 'sj-village-grill',
    anchorName: 'Village Grill',
    anchorRole: 'highlight',
    anchorType: 'restaurant',
    persona: 'friends',
    primaryVibe: 'lively',
    secondaryVibe: 'chill',
    district: 'Evergreen',
    distanceMode: 'short-drive',
    expectedLocationClass: 'L3 Sparse',
  },
  {
    key: 'l3_evergreen',
    cell: 'L3 Romantic / Evergreen Coffee Company',
    historicalKind: 'PASS',
    anchorVenueId: 'sj-evergreen-coffee-company',
    anchorName: 'Evergreen Coffee Company',
    anchorRole: 'highlight',
    anchorType: 'coffee',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'chill',
    district: 'Evergreen',
    distanceMode: 'short-drive',
    expectedLocationClass: 'L3 Sparse',
  },
  {
    key: 'l3_alum_rock',
    cell: 'L3 Family / Alum Rock Park',
    historicalKind: 'PASS',
    anchorVenueId: 'sj-alum-rock-park',
    anchorName: 'Alum Rock Park',
    anchorRole: 'highlight',
    anchorType: 'park',
    persona: 'family',
    primaryVibe: 'adventurous-outdoor',
    secondaryVibe: 'playful',
    district: 'Alum Rock',
    distanceMode: 'short-drive',
    expectedLocationClass: 'L3 Sparse',
  },
  {
    key: 'l1_tech',
    cell: 'L1 Family / The Tech Interactive',
    historicalKind: 'PASS',
    anchorVenueId: 'sj-tech-interactive',
    anchorName: 'The Tech Interactive',
    anchorRole: 'highlight',
    anchorType: 'museum_activity',
    persona: 'family',
    primaryVibe: 'playful',
    secondaryVibe: 'cultured',
    district: 'Downtown',
    distanceMode: 'nearby',
    expectedLocationClass: 'L1 Dense',
  },
  {
    key: 'l1_haberdasher',
    cell: 'L1 Romantic / Haberdasher',
    historicalKind: 'PASS',
    anchorVenueId: 'sj-haberdasher',
    anchorName: 'Haberdasher',
    anchorRole: 'windDown',
    anchorType: 'cocktail_bar',
    persona: 'romantic',
    primaryVibe: 'lively',
    secondaryVibe: 'cozy',
    district: 'Downtown',
    distanceMode: 'nearby',
    expectedLocationClass: 'L1 Dense',
  },
]

function buildInput(spec: BuildMatrixCellSpec): IntentInput {
  return {
    mode: 'build',
    planningMode: 'user-led',
    persona: spec.persona,
    primaryVibe: spec.primaryVibe,
    secondaryVibe: spec.secondaryVibe,
    city: 'San Jose',
    district: spec.district,
    distanceMode: spec.distanceMode,
    anchor: {
      venueId: spec.anchorVenueId,
      role: spec.anchorRole,
    },
    discoveryPreferences: [
      {
        venueId: spec.anchorVenueId,
        role: spec.anchorRole,
      },
    ],
  }
}

function passFail(passed: boolean): 'PASS' | 'FAIL' {
  return passed ? 'PASS' : 'FAIL'
}

function cellResult(spec: BuildMatrixCellSpec, gate: GreatStopGateResult, result: Awaited<ReturnType<typeof runGeneratePlan>>): BuildMatrixCellResult {
  return {
    key: spec.key,
    cell: spec.cell,
    anchor: spec.anchorName,
    anchorVenueId: spec.anchorVenueId,
    anchorRole: spec.anchorRole,
    anchorType: spec.anchorType,
    personaLocationBucket: `${spec.persona} / ${spec.expectedLocationClass}`,
    persona: spec.persona,
    expectedLocationClass: spec.expectedLocationClass,
    actualLocationClass: gate.preset.locationClass,
    locationClassSource: gate.preset.source,
    historicalKind: spec.historicalKind,
    generatedRouteIds: result.selectedArc.stops.map(getArcStopBaseVenueId),
    generatedRouteNames: result.selectedArc.stops.map((stop) => stop.scoredVenue.venue.name),
    selectedArcId: result.selectedArc.id,
    real: passFail(gate.criteria.real.passed),
    roleRight: passFail(gate.criteria.roleRight.passed),
    intentRight: passFail(gate.criteria.intentRight.passed),
    placeRight: passFail(gate.criteria.placeRight.passed),
    momentRight: passFail(gate.criteria.momentRight.passed),
    aggregate: gate.status,
    pass: gate.status === 'PASS',
    failedCriteria: [...gate.failedCriteria],
    failureReasons: [...gate.reasons],
    requiredAnchorSurvived: gate.requiredAnchor?.survived ?? null,
    requiredAnchorCreditedRole: gate.requiredAnchor?.creditedRole ?? null,
  }
}

function countWhere<T>(items: T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length
}

function countBy<T>(items: T[], keyForItem: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const key = keyForItem(item)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function cellsFor(results: BuildMatrixCellResult[], predicate: (item: BuildMatrixCellResult) => boolean): string[] {
  return results.filter(predicate).map((item) => item.cell)
}

function reasonCount(results: BuildMatrixCellResult[], reason: string): number {
  return countWhere(results, (item) => item.failureReasons.includes(reason))
}

function reasonCells(results: BuildMatrixCellResult[], reason: string): string[] {
  return cellsFor(results, (item) => item.failureReasons.includes(reason))
}

function recurringReasonCodes(results: BuildMatrixCellResult[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const result of results) {
    for (const reason of result.failureReasons) {
      counts[reason] = (counts[reason] ?? 0) + 1
    }
  }
  return Object.fromEntries(
    Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  )
}

function classify(results: BuildMatrixCellResult[]): string {
  const failCount = countWhere(results, (item) => !item.pass)
  const placeFailCount = countWhere(results, (item) => item.failedCriteria.includes('place_right'))
  const intentFailCount = countWhere(results, (item) => item.failedCriteria.includes('intent_right'))
  const momentFailCount = countWhere(results, (item) => item.failedCriteria.includes('moment_right'))
  const requiredStopReasonCount = reasonCount(results, 'place_right:required_stop_survival_failed')
  const requiredStopReasonWithAnchorSurvivedCount = countWhere(
    results,
    (item) =>
      item.requiredAnchorSurvived === true &&
      item.failureReasons.includes('place_right:required_stop_survival_failed'),
  )
  const expectedSparseFailures = countWhere(
    results,
    (item) => item.expectedLocationClass === 'L3 Sparse' && !item.pass,
  )
  const sparseTotal = countWhere(results, (item) => item.expectedLocationClass === 'L3 Sparse')

  if (failCount === 0) return 'mostly pass, isolated hard-cell failures'
  if (
    failCount <= 3 &&
    results.filter((item) => !item.pass).every((item) => item.historicalKind === 'THIN')
  ) {
    return 'mostly pass, isolated hard-cell failures'
  }
  if (placeFailCount >= Math.ceil(results.length * 0.6) && requiredStopReasonWithAnchorSurvivedCount > 0) {
    return 'mixed'
  }
  if (requiredStopReasonCount > 0 && requiredStopReasonCount === placeFailCount) {
    return 'representation/reason-label mismatch'
  }
  if (placeFailCount >= Math.ceil(results.length * 0.6)) {
    return 'broad Place-Right calibration failure'
  }
  if (sparseTotal > 0 && expectedSparseFailures >= Math.ceil(sparseTotal * 0.6)) {
    return 'sparse-location / supply-cluster failure'
  }
  if (placeFailCount > 0 && (intentFailCount > 0 || momentFailCount > 0 || requiredStopReasonCount > 0)) {
    return 'mixed'
  }
  return 'inconclusive'
}

function failureDistribution(results: BuildMatrixCellResult[]) {
  return [
    {
      failurePattern: 'aggregate_fail',
      count: countWhere(results, (item) => !item.pass),
      cells: cellsFor(results, (item) => !item.pass),
      interpretation: 'Cells whose generated route failed the formal aggregated Great Stop gate.',
    },
    {
      failurePattern: 'place_right',
      count: countWhere(results, (item) => item.failedCriteria.includes('place_right')),
      cells: cellsFor(results, (item) => item.failedCriteria.includes('place_right')),
      interpretation: 'Bearings-authored Place-Right / structure / support feasibility failures.',
    },
    {
      failurePattern: 'intent_right',
      count: countWhere(results, (item) => item.failedCriteria.includes('intent_right')),
      cells: cellsFor(results, (item) => item.failedCriteria.includes('intent_right')),
      interpretation: 'Taste-authored Intent-Right failures.',
    },
    {
      failurePattern: 'moment_right',
      count: countWhere(results, (item) => item.failedCriteria.includes('moment_right')),
      cells: cellsFor(results, (item) => item.failedCriteria.includes('moment_right')),
      interpretation: 'Moment-Right failures from route-center / arc-shape evidence.',
    },
    {
      failurePattern: 'role_right',
      count: countWhere(results, (item) => item.failedCriteria.includes('role_right')),
      cells: cellsFor(results, (item) => item.failedCriteria.includes('role_right')),
      interpretation: 'Taste-authored Role-Right failures.',
    },
    {
      failurePattern: 'real',
      count: countWhere(results, (item) => item.failedCriteria.includes('real')),
      cells: cellsFor(results, (item) => item.failedCriteria.includes('real')),
      interpretation: 'Field Real failures.',
    },
    {
      failurePattern: 'support_supply_not_buildable',
      count: reasonCount(results, 'place_right:support_supply_not_buildable'),
      cells: reasonCells(results, 'place_right:support_supply_not_buildable'),
      interpretation: 'Support supply could not build the formal route shape.',
    },
    {
      failurePattern: 'required_stop_survival_failed',
      count: reasonCount(results, 'place_right:required_stop_survival_failed'),
      cells: reasonCells(results, 'place_right:required_stop_survival_failed'),
      interpretation: 'Generated gate reasons report required-stop survival pressure/failure.',
    },
    {
      failurePattern: 'required_stop_survival_failed_with_anchor_survived',
      count: countWhere(
        results,
        (item) =>
          item.requiredAnchorSurvived === true &&
          item.failureReasons.includes('place_right:required_stop_survival_failed'),
      ),
      cells: cellsFor(
        results,
        (item) =>
          item.requiredAnchorSurvived === true &&
          item.failureReasons.includes('place_right:required_stop_survival_failed'),
      ),
      interpretation:
        'Potential representation/reason-label mismatch: the formal gate reports required-stop survival failure while the required anchor survived and was credited.',
    },
    {
      failurePattern: 'cluster_escape_structure',
      count: reasonCount(results, 'place_right:cluster_escape_structure'),
      cells: reasonCells(results, 'place_right:cluster_escape_structure'),
      interpretation: 'Route structure escaped clusters beyond the formal Place-Right tolerance.',
    },
  ]
}

async function main(): Promise<void> {
  try {
    const results: BuildMatrixCellResult[] = []
    for (const spec of buildMatrixCells) {
      const generation = await runGeneratePlan(buildInput(spec), {
        seedVenues: sanJoseVenues,
        sourceMode: 'curated',
        sourceModeOverrideApplied: true,
        debugMode: false,
      })
      const greatStop = generation.trace.greatStopGateResult
      assert(greatStop, `${spec.cell} generation trace must expose formal Great Stop result.`)
      results.push(cellResult(spec, greatStop, generation))
    }

    assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

    const totalPass = countWhere(results, (item) => item.pass)
    const totalFail = results.length - totalPass
    const locationClassMismatches = results.filter(
      (item) => item.actualLocationClass !== item.expectedLocationClass,
    )
    const summary = {
      totalCells: results.length,
      totalPass,
      totalFail,
      criteriaFailureCounts: {
        real: countWhere(results, (item) => item.failedCriteria.includes('real')),
        role_right: countWhere(results, (item) => item.failedCriteria.includes('role_right')),
        intent_right: countWhere(results, (item) => item.failedCriteria.includes('intent_right')),
        place_right: countWhere(results, (item) => item.failedCriteria.includes('place_right')),
        moment_right: countWhere(results, (item) => item.failedCriteria.includes('moment_right')),
      },
      recurringReasonCounts: recurringReasonCodes(results),
      failuresByPersona: countBy(
        results.filter((item) => !item.pass),
        (item) => item.persona,
      ),
      failuresByExpectedLocationClass: countBy(
        results.filter((item) => !item.pass),
        (item) => item.expectedLocationClass,
      ),
      failuresByActualLocationClass: countBy(
        results.filter((item) => !item.pass),
        (item) => item.actualLocationClass,
      ),
      failuresByAnchorType: countBy(
        results.filter((item) => !item.pass),
        (item) => item.anchorType,
      ),
      locationClassMismatches: locationClassMismatches.map((item) => ({
        cell: item.cell,
        expected: item.expectedLocationClass,
        actual: item.actualLocationClass,
        source: item.locationClassSource,
      })),
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          observer: 'build_matrix_formal_great_stop',
          proofType: 'current_no_provider_generation_plus_formal_great_stop_gate',
          matrixSource:
            'existing Build quality artifact replay matrix; current observer replays equivalent Build inputs through runGeneratePlan',
          matrixDimensions: {
            personas: [...new Set(results.map((item) => item.persona))],
            expectedLocationClasses: [...new Set(results.map((item) => item.expectedLocationClass))],
            actualLocationClasses: [...new Set(results.map((item) => item.actualLocationClass))],
            anchors: results.map((item) => item.anchor),
          },
          locationClassCaveat:
            'Generation-based proof does not pass explicit greatStopGateLocationClass because that activates Build Great Stop pre-selection; current formal gate infers L1 from nearby and L2 otherwise, so historical L3 cells measure as actual L2 unless a separate explicit-gate observer is requested.',
          providerCalls: fetchCallCount,
          summary,
          failureDistribution: failureDistribution(results),
          diagnosticClassification: classify(results),
          cells: results,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
