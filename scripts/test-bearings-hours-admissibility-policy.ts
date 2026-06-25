import { applyFieldCorpusRuntimeHoursAdmission } from '../src/domain/bearings/fieldCorpusRuntimeHoursAdmission.ts'
import { evaluateHoursAdmissibility } from '../src/domain/bearings/hoursAdmissibilityPolicy.ts'
import { evaluateStaticRuntimeHoursProof } from '../src/domain/bearings/staticRuntimeHoursProof.ts'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import { RUNTIME_HOURS_VALIDATION_REQUIRED } from '../src/domain/field/corpus/types.ts'
import type { PromotedFieldProviderCorpusVenue } from '../src/domain/field/corpus/types.ts'
import { buildGate1DefaultEveningWindow } from '../src/domain/temporal/resolvePlanningTimeWindow.ts'
import type { PlanningTimeWindowSignal } from '../src/domain/types/hours.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Bearings hours admissibility policy test must not call fetch.')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function clonePromotedVenue(
  patch: Partial<PromotedFieldProviderCorpusVenue>,
): PromotedFieldProviderCorpusVenue {
  const base = sanJoseProviderCorpusVenues[0]
  if (!base) {
    throw new Error('Missing promoted corpus venue fixture.')
  }

  return {
    ...base,
    ...patch,
    providerProvenance: {
      ...base.providerProvenance,
      ...(patch.providerProvenance ?? {}),
    },
    runtimeHoursProof: {
      ...base.runtimeHoursProof,
      ...(patch.runtimeHoursProof ?? {}),
    },
    venue: {
      ...base.venue,
      ...(patch.venue ?? {}),
      source: {
        ...base.venue.source,
        ...(patch.venue?.source ?? {}),
      },
    },
    venueAudit: {
      ...base.venueAudit,
      ...(patch.venueAudit ?? {}),
    },
  }
}

function requiredVenue(
  id: string,
  patch: Partial<PromotedFieldProviderCorpusVenue> = {},
): PromotedFieldProviderCorpusVenue {
  return clonePromotedVenue({
    ...patch,
    id,
    providerProvenance: {
      ...sanJoseProviderCorpusVenues[0]!.providerProvenance,
      providerRecordId: id,
      ...(patch.providerProvenance ?? {}),
    },
    venue: {
      ...sanJoseProviderCorpusVenues[0]!.venue,
      ...(patch.venue ?? {}),
      id,
      source: {
        ...sanJoseProviderCorpusVenues[0]!.venue.source,
        ...(patch.venue?.source ?? {}),
        bearingsValidationRequirements: [RUNTIME_HOURS_VALIDATION_REQUIRED],
        providerRecordId: id,
      },
    },
  })
}

function buildExplicitWindow(): PlanningTimeWindowSignal {
  return {
    ...buildGate1DefaultEveningWindow(),
    label: 'Intent Friday 7:00 PM',
    source: 'intent_time_window',
    usesIntentWindow: true,
  }
}

function evaluateFixture(
  venue: PromotedFieldProviderCorpusVenue,
  planningWindow: PlanningTimeWindowSignal,
) {
  const proof = evaluateStaticRuntimeHoursProof(venue, planningWindow)
  return evaluateHoursAdmissibility({
    proof,
    planningWindow,
  })
}

function main(): void {
  globalThis.fetch = fetchTrap

  const unspecifiedWindow = buildGate1DefaultEveningWindow()
  const explicitWindow = buildExplicitWindow()
  const openRequired = requiredVenue('test-open-required', {
    runtimeHoursProof: {
      structuredPeriods: [
        {
          open: { day: 5, hour: 17, minute: 0 },
          close: { day: 6, hour: 1, minute: 0 },
        },
      ],
      textHoursAvailable: false,
      proofSource: 'structured_periods',
    },
  })
  const closedRequired = requiredVenue('test-closed-required', {
    runtimeHoursProof: {
      structuredPeriods: [
        {
          open: { day: 2, hour: 10, minute: 0 },
          close: { day: 2, hour: 14, minute: 0 },
        },
      ],
      textHoursAvailable: false,
      proofSource: 'structured_periods',
    },
  })
  const unknownRequired = requiredVenue('test-unknown-required', {
    runtimeHoursProof: {
      structuredPeriods: [],
      textHoursAvailable: false,
      proofSource: 'none',
    },
  })

  const openExplicit = evaluateFixture(openRequired, explicitWindow)
  assert(openExplicit.admitted, 'Open venue must admit for explicit plan window.')
  assert(openExplicit.status === 'admissible', 'Open venue must use admissible status.')
  assert(openExplicit.reason === 'open_for_plan_window', 'Open venue must keep open reason.')

  const closedExplicit = evaluateFixture(closedRequired, explicitWindow)
  assert(!closedExplicit.admitted, 'Closed venue must block for explicit plan window.')
  assert(closedExplicit.status === 'blocked', 'Closed venue must use blocked status.')
  assert(
    closedExplicit.reason === 'closed_for_plan_window',
    'Closed venue must keep closed_for_plan_window reason.',
  )

  const closedUnspecified = evaluateFixture(closedRequired, unspecifiedWindow)
  assert(!closedUnspecified.admitted, 'Closed venue must block under unspecified time.')
  assert(
    closedUnspecified.reason === 'closed_for_plan_window',
    'Closed venue must never pass through relaxation.',
  )

  const unknownUnspecified = evaluateFixture(unknownRequired, unspecifiedWindow)
  assert(unknownUnspecified.admitted, 'Unknown hours may admit under unspecified time.')
  assert(
    unknownUnspecified.status === 'admissible_with_unspecified_time_relaxation',
    'Unknown unspecified hours must carry relaxation status.',
  )
  assert(
    unknownUnspecified.reason === 'unspecified_time_allows_unknown_hours',
    'Unknown unspecified hours must carry explicit relaxation reason.',
  )
  assert(
    unknownUnspecified.diagnostics.relaxationApplied,
    'Unknown unspecified hours must diagnose relaxation.',
  )

  const unknownExplicit = evaluateFixture(unknownRequired, explicitWindow)
  assert(!unknownExplicit.admitted, 'Unknown hours must not silently pass for explicit time.')
  assert(
    unknownExplicit.reason === 'explicit_time_requires_known_open_hours',
    'Unknown explicit hours must require known open hours.',
  )
  assert(
    unknownExplicit.timeSpecificity === 'explicit',
    'Explicit window must be classified as explicit.',
  )

  const curateParity = applyFieldCorpusRuntimeHoursAdmission(
    [openRequired, closedRequired, unknownRequired],
    unspecifiedWindow,
  )
  assert(
    curateParity.admitted.map((venue) => venue.id).includes(openRequired.id),
    'Central policy must preserve Curate open admission.',
  )
  assert(
    curateParity.blocked.map((venue) => venue.id).includes(closedRequired.id),
    'Central policy must preserve Curate closed blocking.',
  )
  assert(
    curateParity.admitted.map((venue) => venue.id).includes(unknownRequired.id),
    'Central policy must preserve Curate unknown-hours admission under unspecified time.',
  )
  const unknownDiagnostic = curateParity.diagnosticsByVenueId.get(unknownRequired.id)
  assert(unknownDiagnostic !== undefined, 'Unknown venue diagnostic must be available.')
  assert(
    unknownDiagnostic.admissibilityStatus === 'admissible_with_unspecified_time_relaxation',
    'Curate unknown-hours admission must now expose the central relaxation status.',
  )
  assert(
    unknownDiagnostic.timeSpecificity === 'unspecified',
    'Curate default Gate 1 window must be classified as unspecified.',
  )
  assert(
    unknownDiagnostic.relaxationApplied,
    'Curate unknown-hours admission must expose relaxation diagnostics.',
  )

  const buildProviderCompatibility = evaluateHoursAdmissibility({
    proof: evaluateStaticRuntimeHoursProof(unknownRequired, unspecifiedWindow),
    planningWindow: unspecifiedWindow,
  })
  assert(
    buildProviderCompatibility.status === 'admissible_with_unspecified_time_relaxation',
    'Build/provider compatibility callers must be able to use the shared policy without provider calls.',
  )

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('bearings hours admissibility policy: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        explicitUnknown: unknownExplicit.reason,
        unspecifiedUnknown: unknownUnspecified.reason,
        curateParity: {
          admitted: curateParity.diagnostics.admittedCount,
          blocked: curateParity.diagnostics.blockedCount,
          unknownAdmitted: curateParity.diagnostics.unknownAdmittedCount,
        },
      },
      null,
      2,
    )}\n`,
  )
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
} finally {
  globalThis.fetch = originalFetch
}
