import { evaluateStaticRuntimeHoursProof } from '../src/domain/bearings/staticRuntimeHoursProof.ts'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import { RUNTIME_HOURS_VALIDATION_REQUIRED } from '../src/domain/field/corpus/types.ts'
import type { PromotedFieldProviderCorpusVenue } from '../src/domain/field/corpus/types.ts'
import type { PlanningTimeWindowSignal } from '../src/domain/types/hours.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Bearings static runtime-hours proof test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
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
  patch: Partial<PromotedFieldProviderCorpusVenue> = {},
): PromotedFieldProviderCorpusVenue {
  const venue = clonePromotedVenue(patch)
  return {
    ...venue,
    venue: {
      ...venue.venue,
      source: {
        ...venue.venue.source,
        bearingsValidationRequirements: [RUNTIME_HOURS_VALIDATION_REQUIRED],
      },
    },
  }
}

const fridayEvening: PlanningTimeWindowSignal = {
  day: 5,
  hour: 19,
  minute: 30,
  phase: 'evening',
  label: 'Friday 7:30 PM',
  usesIntentWindow: true,
}

const tuesdayAfternoon: PlanningTimeWindowSignal = {
  day: 2,
  hour: 14,
  minute: 0,
  phase: 'afternoon',
  label: 'Tuesday 2:00 PM',
  usesIntentWindow: true,
}

function main(): void {
  globalThis.fetch = fetchTrap

  const structuredOpenVenue = requiredVenue({
    runtimeHoursProof: {
      structuredPeriods: [
        {
          open: { day: 5, hour: 17, minute: 0 },
          close: { day: 6, hour: 1, minute: 0 },
        },
      ],
      textHoursAvailable: true,
      proofSource: 'structured_periods',
    },
  })
  assert(
    evaluateStaticRuntimeHoursProof(structuredOpenVenue, fridayEvening).status ===
      'open_for_plan_window',
    'Structured Friday evening open periods must prove open_for_plan_window.',
  )
  assert(
    evaluateStaticRuntimeHoursProof(structuredOpenVenue, tuesdayAfternoon).status ===
      'closed_for_plan_window',
    'Structured Tuesday 2pm closed periods must prove closed_for_plan_window.',
  )

  const noStructuredVenue = requiredVenue({
    runtimeHoursProof: {
      structuredPeriods: [],
      textHoursAvailable: false,
      proofSource: 'none',
    },
  })
  assert(
    evaluateStaticRuntimeHoursProof(noStructuredVenue, fridayEvening).status ===
      'unknown_for_plan_window',
    'Required venue with no structured periods must be unknown_for_plan_window.',
  )

  const textOnlyVenue = requiredVenue({
    runtimeHoursProof: {
      structuredPeriods: [],
      textHoursAvailable: true,
      proofSource: 'text_only',
    },
  })
  assert(
    evaluateStaticRuntimeHoursProof(textOnlyVenue, fridayEvening).status ===
      'unknown_for_plan_window',
    'Text-only hours must stay unknown_for_plan_window without a supported parser.',
  )

  const persistedOpenNowVenue = requiredVenue({
    runtimeHoursProof: {
      structuredPeriods: [],
      textHoursAvailable: false,
      proofSource: 'none',
    },
    venue: {
      ...sanJoseProviderCorpusVenues[0]!.venue,
      source: {
        ...sanJoseProviderCorpusVenues[0]!.venue.source,
        openNow: true,
        likelyOpenForCurrentWindow: false,
        timeConfidence: 0.99,
      },
    },
  })
  assert(
    evaluateStaticRuntimeHoursProof(persistedOpenNowVenue, fridayEvening).status ===
      'unknown_for_plan_window',
    'Persisted openNow true alone must not prove open_for_plan_window.',
  )

  const persistedLikelyVenue = requiredVenue({
    runtimeHoursProof: {
      structuredPeriods: [],
      textHoursAvailable: false,
      proofSource: 'none',
    },
    venue: {
      ...sanJoseProviderCorpusVenues[0]!.venue,
      source: {
        ...sanJoseProviderCorpusVenues[0]!.venue.source,
        openNow: false,
        likelyOpenForCurrentWindow: true,
        timeConfidence: 0.99,
      },
    },
  })
  assert(
    evaluateStaticRuntimeHoursProof(persistedLikelyVenue, fridayEvening).status ===
      'unknown_for_plan_window',
    'Persisted likelyOpenForCurrentWindow true alone must not prove open_for_plan_window.',
  )

  const nonRequiredVenue = clonePromotedVenue({
    runtimeHoursProof: {
      structuredPeriods: [],
      textHoursAvailable: false,
      proofSource: 'none',
    },
    venue: {
      ...sanJoseProviderCorpusVenues[0]!.venue,
      source: {
        ...sanJoseProviderCorpusVenues[0]!.venue.source,
        bearingsValidationRequirements: [],
      },
    },
  })
  assert(
    evaluateStaticRuntimeHoursProof(nonRequiredVenue, fridayEvening).status ===
      'not_required',
    'Non-required venue must return not_required.',
  )

  const requiredRealTextOnly = sanJoseProviderCorpusVenues.find(
    (venue) =>
      venue.venue.source.bearingsValidationRequirements?.includes(
        RUNTIME_HOURS_VALIDATION_REQUIRED,
      ) &&
      venue.runtimeHoursProof.proofSource === 'text_only',
  )
  assert(requiredRealTextOnly !== undefined, 'Expected at least one required real text-only corpus venue.')
  assert(
    evaluateStaticRuntimeHoursProof(requiredRealTextOnly, fridayEvening).status ===
      'unknown_for_plan_window',
    'Real required text-only corpus venue must remain unknown_for_plan_window.',
  )

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('bearings static runtime-hours proof validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        realCorpusRuntimeHoursProof: {
          structuredCount: sanJoseProviderCorpusVenues.filter(
            (venue) => venue.runtimeHoursProof.structuredPeriods.length > 0,
          ).length,
          textOnlyCount: sanJoseProviderCorpusVenues.filter(
            (venue) => venue.runtimeHoursProof.proofSource === 'text_only',
          ).length,
          noneCount: sanJoseProviderCorpusVenues.filter(
            (venue) => venue.runtimeHoursProof.proofSource === 'none',
          ).length,
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
