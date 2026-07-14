import { applyFieldCorpusRuntimeHoursAdmission } from '../src/domain/bearings/fieldCorpusRuntimeHoursAdmission.ts'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import { RUNTIME_HOURS_VALIDATION_REQUIRED } from '../src/domain/field/corpus/types.ts'
import type { PromotedFieldProviderCorpusVenue } from '../src/domain/field/corpus/types.ts'
import {
  projectBearingsWhenPlanningWindow,
  projectWhenPlanningWindowToSignal,
} from '../src/domain/bearings/projectWhenPlanningWindow.ts'
import { buildWhenSignalProfile } from '../src/domain/when/whenSignalProfile.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Field corpus runtime-hours admission test must not call fetch.')
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
  const venue = clonePromotedVenue({
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
  return venue
}

function main(): void {
  globalThis.fetch = fetchTrap
  const planningWindow = projectWhenPlanningWindowToSignal(
    projectBearingsWhenPlanningWindow({
      whenSignalProfile: buildWhenSignalProfile({ spatialMode: 'WALKABLE' }),
      clock: new Date(2026, 6, 14, 20, 15, 0, 0),
    }),
  )
  assert(planningWindow !== undefined, 'Projected default When planning window must exist.')
  assert(
    planningWindow.source === 'when_planning_window',
    'Default planning window source must come from Bearings When projection.',
  )

  const openRequired = requiredVenue('test-open-required', {
    runtimeHoursProof: {
      structuredPeriods: [
        {
          open: { day: 2, hour: 20, minute: 0 },
          close: { day: 2, hour: 21, minute: 30 },
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
  const notRequired = clonePromotedVenue({
    id: 'test-not-required',
    providerProvenance: {
      ...sanJoseProviderCorpusVenues[0]!.providerProvenance,
      providerRecordId: 'test-not-required',
    },
    runtimeHoursProof: {
      structuredPeriods: [],
      textHoursAvailable: false,
      proofSource: 'none',
    },
    venue: {
      ...sanJoseProviderCorpusVenues[0]!.venue,
      id: 'test-not-required',
      source: {
        ...sanJoseProviderCorpusVenues[0]!.venue.source,
        bearingsValidationRequirements: [],
        providerRecordId: 'test-not-required',
      },
    },
  })

  const result = applyFieldCorpusRuntimeHoursAdmission(
    [openRequired, closedRequired, unknownRequired, notRequired],
    planningWindow,
  )

  assert(result.admitted.map((venue) => venue.id).includes(openRequired.id), 'Open required venue must be admitted.')
  assert(
    result.blocked.map((venue) => venue.id).includes(closedRequired.id),
    'Closed required venue must be blocked.',
  )
  assert(
    result.admitted.map((venue) => venue.id).includes(unknownRequired.id),
    'Unknown required venue must be admitted with diagnostics.',
  )
  assert(result.admitted.map((venue) => venue.id).includes(notRequired.id), 'Non-required venue must be admitted.')
  assert(result.diagnostics.evaluatedCount === 4, 'Admission must evaluate all candidates.')
  assert(result.diagnostics.requiredCount === 3, 'Admission must count required candidates.')
  assert(result.diagnostics.openCount === 1, 'Admission must count open candidates.')
  assert(result.diagnostics.closedBlockedCount === 1, 'Admission must count closed blocked candidates.')
  assert(result.diagnostics.unknownAdmittedCount === 1, 'Admission must count unknown admitted candidates.')
  assert(result.diagnostics.notRequiredCount === 1, 'Admission must count not-required candidates.')
  assert(result.diagnostics.admittedCount === 3, 'Admission must return admitted count.')
  assert(result.diagnostics.blockedCount === 1, 'Admission must return blocked count.')
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('field corpus runtime-hours admission validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        planningWindow: result.diagnostics.planningWindow,
        counts: {
          admitted: result.diagnostics.admittedCount,
          blocked: result.diagnostics.blockedCount,
          closedBlocked: result.diagnostics.closedBlockedCount,
          unknownAdmitted: result.diagnostics.unknownAdmittedCount,
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
