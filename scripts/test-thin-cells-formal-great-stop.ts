import { sanJoseVenues } from '../src/data/venues.ts'
import { buildContractEntryRuntimeRouteLockTruth } from '../src/app/services/live/contractEntryLockHandoff.ts'
import { getArcStopBaseVenueId } from '../src/domain/candidates/candidateIdentity.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { BuildLocationClass, GreatStopGateResult } from '../src/domain/types/greatStopGate.ts'
import type { IntentInput, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'

type ThinCellId = 'Adega' | 'MINIBOSS' | 'Happy Hollow'

interface ThinCellSpec {
  cell: ThinCellId
  anchorVenueId: string
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  district: string
  distanceMode: NonNullable<IntentInput['distanceMode']>
  locationClass: BuildLocationClass
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`THIN formal Great Stop bridge observer must not call fetch: ${url}`)
}) as typeof fetch

const cells: ThinCellSpec[] = [
  {
    cell: 'Adega',
    anchorVenueId: 'sj-adega-wine-atelier',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    locationClass: 'L2 Mid',
  },
  {
    cell: 'MINIBOSS',
    anchorVenueId: 'sj-miniboss',
    persona: 'friends',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    district: 'Downtown',
    distanceMode: 'short-drive',
    locationClass: 'L2 Mid',
  },
  {
    cell: 'Happy Hollow',
    anchorVenueId: 'sj-happy-hollow',
    persona: 'family',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    district: 'East San Jose',
    distanceMode: 'short-drive',
    locationClass: 'L2 Mid',
  },
]

function buildInput(spec: ThinCellSpec): IntentInput {
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
      role: 'highlight',
    },
    discoveryPreferences: [
      {
        venueId: spec.anchorVenueId,
        role: 'highlight',
      },
    ],
  }
}

function criteriaSummary(gate: GreatStopGateResult) {
  return {
    real: gate.criteria.real.passed ? 'PASS' : 'FAIL',
    role_right: gate.criteria.roleRight.passed ? 'PASS' : 'FAIL',
    intent_right: gate.criteria.intentRight.passed ? 'PASS' : 'FAIL',
    place_right: gate.criteria.placeRight.passed ? 'PASS' : 'FAIL',
    moment_right: gate.criteria.momentRight.passed ? 'PASS' : 'FAIL',
  }
}

function assertLifecycleMatchesGate(cell: ThinCellId, params: {
  gate: GreatStopGateResult
  lockEligible: boolean
  lockRejectionReason: string | null
}): void {
  if (params.gate.status === 'PASS') {
    assert(params.lockEligible, `${cell} formal Great Stop PASS must remain lockable.`)
    return
  }
  assert(!params.lockEligible, `${cell} formal Great Stop FAIL must not be lockable.`)
  assert(
    params.lockRejectionReason === 'great_stop_failed',
    `${cell} formal Great Stop FAIL must reject lock with great_stop_failed, received ${params.lockRejectionReason}.`,
  )
}

try {
  const observed = []

  for (const spec of cells) {
    const result = await runGeneratePlan(buildInput(spec), {
      seedVenues: sanJoseVenues,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
    })
    const greatStop = result.trace.greatStopGateResult
    assert(greatStop, `${spec.cell} generation trace must expose formal Great Stop result.`)
    assert(
      greatStop.preset.locationClass === spec.locationClass,
      `${spec.cell} formal gate should infer ${spec.locationClass}, got ${greatStop.preset.locationClass}.`,
    )
    const lockTruth = buildContractEntryRuntimeRouteLockTruth({
      artifact: result.contractEntryArtifact,
      itinerary: result.itinerary,
      scoredVenues: result.scoredVenues,
      selectedDirectionId: result.intentProfile.selectedDirectionContext?.directionId ?? 'thin-build',
      selectedClusterConfirmation: `${spec.cell} THIN route`,
      city: result.itinerary.city,
      persona: result.intentProfile.persona ?? spec.persona,
      vibe: result.intentProfile.primaryAnchor,
      mode: 'build',
    })

    observed.push({
      cell: spec.cell,
      proofType: 'current_generation_plus_formal_great_stop_gate',
      anchorVenueId: spec.anchorVenueId,
      selectedArcId: result.selectedArc.id,
      selectedStopBaseVenueIds: result.selectedArc.stops.map(getArcStopBaseVenueId),
      selectedStopNames: result.selectedArc.stops.map((stop) => stop.scoredVenue.venue.name),
      selectedStopRoles: result.selectedArc.stops.map((stop) => stop.role),
      formalGateRun: true,
      criteria: criteriaSummary(greatStop),
      aggregatedResult: greatStop.status,
      lockable: lockTruth.ok,
      lockRejectionReason: lockTruth.ok ? null : lockTruth.reason,
      failedCriteria: greatStop.failedCriteria,
      reasons: greatStop.reasons,
      preset: greatStop.preset,
      selectionDiagnostics: result.trace.greatStopGateSelectionDiagnostics
        ? {
            status: result.trace.greatStopGateSelectionDiagnostics.status,
            stage: result.trace.greatStopGateSelectionDiagnostics.stage,
            evaluatedCandidateCount:
              result.trace.greatStopGateSelectionDiagnostics.evaluatedCandidateCount,
            passingCandidateCount:
              result.trace.greatStopGateSelectionDiagnostics.passingCandidateCount,
          }
        : undefined,
    })
  }

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  const failingCells = observed.filter((entry) => entry.aggregatedResult !== 'PASS')

  process.stdout.write(
    `${JSON.stringify(
      {
        observer: 'thin_cells_formal_great_stop',
        status: failingCells.length === 0 ? 'PASS' : 'FAIL',
        proofType: 'generation_based',
        formalFiveCriteriaGateRun: true,
        providerCalls: fetchCallCount,
        cells: observed,
      },
      null,
      2,
    )}\n`,
  )

  for (const entry of observed) {
    assertLifecycleMatchesGate(entry.cell, {
      lockEligible: entry.lockable,
      lockRejectionReason: entry.lockRejectionReason,
      gate: {
      status: entry.aggregatedResult,
      failedCriteria: entry.failedCriteria,
      reasons: entry.reasons,
      routeId: entry.selectedArcId,
      criteria: {
        real: { passed: entry.criteria.real === 'PASS', reasons: [] },
        roleRight: { passed: entry.criteria.role_right === 'PASS', reasons: [] },
        intentRight: { passed: entry.criteria.intent_right === 'PASS', reasons: [] },
        placeRight: { passed: entry.criteria.place_right === 'PASS', reasons: entry.reasons },
        momentRight: { passed: entry.criteria.moment_right === 'PASS', reasons: entry.reasons },
      },
      preset: entry.preset,
      diagnostics: {} as GreatStopGateResult['diagnostics'],
      },
    })
  }
} finally {
  globalThis.fetch = originalFetch
}
