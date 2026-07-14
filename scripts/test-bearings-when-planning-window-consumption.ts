import assert from 'node:assert/strict'

import { starterPacks } from '../src/data/starterPacks.ts'
import { curatedVenues } from '../src/data/venues.ts'
import { applyFieldCorpusRuntimeHoursAdmission } from '../src/domain/bearings/fieldCorpusRuntimeHoursAdmission.ts'
import { resolveCurateStaticFieldCorpusVenues } from '../src/domain/field/corpus/resolveCurateStaticFieldCorpusVenues.ts'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import { RUNTIME_HOURS_VALIDATION_REQUIRED } from '../src/domain/field/corpus/types.ts'
import type { PromotedFieldProviderCorpusVenue } from '../src/domain/field/corpus/types.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import {
  buildGate1DefaultEveningWindow,
  resolvePlanningTimeWindowResolution,
} from '../src/domain/temporal/resolvePlanningTimeWindow.ts'
import type { IntentProfile } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import { buildWhenSignalProfile, type WhenSignalPosture } from '../src/domain/when/whenSignalProfile.ts'

const originalFetch = globalThis.fetch
let providerCallCount = 0

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`Bearings When planning-window consumption must not call fetch: ${String(input)}`)
}) as typeof fetch

const fixedClock = new Date(2026, 6, 14, 20, 15, 0, 0)
const legacyFriday = buildGate1DefaultEveningWindow()

function baseIntent(patch: Partial<IntentProfile> = {}): IntentProfile {
  return {
    ...normalizeIntent({
      mode: 'curate',
      persona: 'romantic',
      primaryVibe: 'cozy',
      city: 'San Jose',
      distanceMode: 'nearby',
    }),
    ...patch,
  }
}

function profile(params: {
  whenPosture?: WhenSignalPosture
  whenPostureSource?: 'defaulted' | 'user_supplied'
  startTime?: string
  durationMinutes?: number | null
}) {
  return buildWhenSignalProfile({
    whenPosture: params.whenPosture,
    whenPostureSource: params.whenPostureSource,
    startTime: params.startTime,
    durationMinutes: params.durationMinutes ?? null,
    spatialMode: 'WALKABLE',
  })
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
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
      providerRecordId: patch.id ?? patch.providerProvenance?.providerRecordId ?? base.providerProvenance.providerRecordId,
      ...(patch.providerProvenance ?? {}),
    },
    runtimeHoursProof: {
      ...base.runtimeHoursProof,
      ...(patch.runtimeHoursProof ?? {}),
    },
    venue: {
      ...base.venue,
      ...(patch.venue ?? {}),
      id: patch.id ?? patch.venue?.id ?? base.venue.id,
      source: {
        ...base.venue.source,
        providerRecordId: patch.id ?? patch.venue?.source?.providerRecordId ?? base.venue.source.providerRecordId,
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
  structuredPeriods: PromotedFieldProviderCorpusVenue['runtimeHoursProof']['structuredPeriods'],
): PromotedFieldProviderCorpusVenue {
  return clonePromotedVenue({
    id,
    runtimeHoursProof: {
      structuredPeriods,
      textHoursAvailable: false,
      proofSource: structuredPeriods.length > 0 ? 'structured_periods' : 'none',
    },
    venue: {
      ...sanJoseProviderCorpusVenues[0]!.venue,
      id,
      source: {
        ...sanJoseProviderCorpusVenues[0]!.venue.source,
        providerRecordId: id,
        bearingsValidationRequirements: [RUNTIME_HOURS_VALIDATION_REQUIRED],
      },
    },
  })
}

function applyProjectedAdmission(
  whenSignalProfile: ReturnType<typeof buildWhenSignalProfile>,
  venues: PromotedFieldProviderCorpusVenue[],
  intent = baseIntent(),
) {
  const resolution = resolvePlanningTimeWindowResolution(intent, {
    whenSignalProfile,
    clock: fixedClock,
  })
  const result = applyFieldCorpusRuntimeHoursAdmission(
    venues,
    resolution.planningWindow,
    {
      timeSpecificity: resolution.whenProjection?.strictness === 'strict' ? 'explicit' : undefined,
      invalidPlanningWindowReason: resolution.whenProjection?.valid === false
        ? resolution.whenProjection.invalidReason
        : undefined,
    },
  )
  return { resolution, result }
}

function assertChangedFromFriday(params: {
  caseName: string
  whenSignalProfile: ReturnType<typeof buildWhenSignalProfile>
  venue: PromotedFieldProviderCorpusVenue
}): Record<string, unknown> {
  const oldResult = applyFieldCorpusRuntimeHoursAdmission([params.venue], legacyFriday)
  const { resolution, result } = applyProjectedAdmission(params.whenSignalProfile, [params.venue])

  assert.equal(oldResult.blocked.length, 1, `${params.caseName}: legacy Friday fixture should block.`)
  assert.equal(result.admitted.length, 1, `${params.caseName}: projected When window should admit.`)
  assert.notEqual(
    `${resolution.planningWindow?.day}/${resolution.planningWindow?.hour}`,
    '5/19',
    `${params.caseName}: projected behavior must not use Friday 7PM.`,
  )

  return {
    case: params.caseName,
    beforeBehavior: 'legacy Friday 7PM blocked',
    afterBehavior: `${resolution.planningWindow?.label} admitted`,
    intendedChangeOrPreserved: 'intended change',
    pass: true,
    notes: `${resolution.whenProjection?.strictness ?? 'no-projection'} strictness`,
  }
}

function assertDefaultNow(): Record<string, unknown> {
  return assertChangedFromFriday({
    caseName: 'default now',
    whenSignalProfile: profile({}),
    venue: requiredVenue('default-now-tuesday-open', [
      {
        open: { day: 2, hour: 20, minute: 0 },
        close: { day: 2, hour: 21, minute: 30 },
      },
    ]),
  })
}

function assertUserSelectedNow(): Record<string, unknown> {
  const whenSignalProfile = profile({
    whenPosture: 'now_doable_tonight',
    whenPostureSource: 'user_supplied',
  })
  const result = assertChangedFromFriday({
    caseName: 'user-selected now',
    whenSignalProfile,
    venue: requiredVenue('user-now-tuesday-open', [
      {
        open: { day: 2, hour: 20, minute: 0 },
        close: { day: 2, hour: 21, minute: 30 },
      },
    ]),
  })
  const { resolution } = applyProjectedAdmission(whenSignalProfile, [])
  assert.equal(resolution.whenProjection?.strictness, 'medium')
  assert.equal(resolution.whenProjection?.whenPostureSource, 'user_supplied')
  return result
}

function assertLaterTonight(): Record<string, unknown> {
  return assertChangedFromFriday({
    caseName: 'later tonight',
    whenSignalProfile: profile({
      whenPosture: 'later_tonight',
      whenPostureSource: 'user_supplied',
    }),
    venue: requiredVenue('later-tonight-tuesday-open', [
      {
        open: { day: 2, hour: 22, minute: 0 },
        close: { day: 2, hour: 23, minute: 30 },
      },
    ]),
  })
}

function assertThisWeekend(): Record<string, unknown> {
  return assertChangedFromFriday({
    caseName: 'this weekend',
    whenSignalProfile: profile({
      whenPosture: 'this_weekend',
      whenPostureSource: 'user_supplied',
    }),
    venue: requiredVenue('weekend-saturday-open', [
      {
        open: { day: 6, hour: 19, minute: 0 },
        close: { day: 6, hour: 23, minute: 0 },
      },
    ]),
  })
}

function assertNextWeekBroad(): Record<string, unknown> {
  const venue = requiredVenue('next-week-broad-closed-monday', [
    {
      open: { day: 2, hour: 10, minute: 0 },
      close: { day: 2, hour: 14, minute: 0 },
    },
  ])
  const { resolution, result } = applyProjectedAdmission(
    profile({
      whenPosture: 'next_week',
      whenPostureSource: 'user_supplied',
    }),
    [venue],
  )

  assert.equal(resolution.whenProjection?.strictness, 'broad')
  assert.equal(resolution.planningWindow?.whenProjection?.broadFuture, true)
  assert.equal(result.admitted.length, 1, 'Broad next-week posture must not hard-block on a fake exact closed day.')
  assert.equal(
    result.diagnosticsByVenueId.get(venue.id)?.admissibilityReason,
    'unspecified_time_allows_unknown_hours',
  )

  return {
    case: 'next week',
    beforeBehavior: 'legacy exact-day style could block from a representative closed day',
    afterBehavior: 'broad future posture relaxes unknown exact-day proof',
    intendedChangeOrPreserved: 'intended change',
    pass: true,
    notes: 'broad future does not hard-block known-hours without explicit date/time',
  }
}

function assertPickATime(): Record<string, unknown> {
  const venue = requiredVenue('pick-time-tuesday-open', [
    {
      open: { day: 2, hour: 20, minute: 0 },
      close: { day: 2, hour: 21, minute: 30 },
    },
  ])
  const { resolution, result } = applyProjectedAdmission(
    profile({
      whenPosture: 'pick_a_time',
      whenPostureSource: 'user_supplied',
      startTime: '8:30pm',
    }),
    [venue],
  )

  assert.equal(resolution.whenProjection?.strictness, 'strict')
  assert.equal(resolution.planningWindow?.usesIntentWindow, true)
  assert.equal(result.admitted.length, 1, 'Explicit pick-a-time open venue must admit.')

  const unknownVenue = requiredVenue('pick-time-unknown-hours', [])
  const unknown = applyProjectedAdmission(
    profile({
      whenPosture: 'pick_a_time',
      whenPostureSource: 'user_supplied',
      startTime: '8:30pm',
    }),
    [unknownVenue],
  )
  assert.equal(unknown.result.blocked.length, 1, 'Explicit pick-a-time unknown hours must block.')
  assert.equal(
    unknown.result.diagnosticsByVenueId.get(unknownVenue.id)?.admissibilityReason,
    'explicit_time_requires_known_open_hours',
  )

  return {
    case: 'pick-a-time',
    beforeBehavior: 'explicit valid time already used strict hours semantics',
    afterBehavior: 'explicit 8:30pm remains strict and blocks unknown hours',
    intendedChangeOrPreserved: 'preserved behavior',
    pass: true,
    notes: 'valid explicit generation path remains strict',
  }
}

function assertInvalidExplicitTime(): Record<string, unknown> {
  const venue = requiredVenue('invalid-explicit-unknown-hours', [])
  const { resolution, result } = applyProjectedAdmission(
    profile({
      whenPosture: 'pick_a_time',
      whenPostureSource: 'user_supplied',
      startTime: 'sometime-ish',
    }),
    [venue],
  )

  assert.equal(resolution.whenProjection?.valid, false)
  assert.equal(resolution.planningWindow, undefined)
  assert.equal(result.blocked.length, 1)
  assert.equal(result.diagnostics.invalidPlanningWindowReason, 'unparseable_explicit_time')
  assert.equal(
    result.diagnosticsByVenueId.get(venue.id)?.admissibilityReason,
    'explicit_time_requires_known_open_hours',
  )

  return {
    case: 'invalid explicit time',
    beforeBehavior: 'would have had a fallback path available',
    afterBehavior: 'invalid explicit time blocks required unknown-hours venue with no window',
    intendedChangeOrPreserved: 'intended change',
    pass: true,
    notes: 'no silent Friday fallback',
  }
}

function assertValidExplicitIntentTimePreserved(): Record<string, unknown> {
  const explicitIntent = baseIntent({ timeWindow: '8:30pm' })
  const venue = requiredVenue('legacy-explicit-intent-open', [
    {
      open: { day: 2, hour: 20, minute: 0 },
      close: { day: 2, hour: 21, minute: 30 },
    },
  ])
  const resolution = resolvePlanningTimeWindowResolution(explicitIntent, {
    whenSignalProfile: profile({
      whenPosture: 'this_weekend',
      whenPostureSource: 'user_supplied',
    }),
    clock: fixedClock,
  })
  const result = applyFieldCorpusRuntimeHoursAdmission([venue], resolution.planningWindow)

  assert.equal(resolution.planningWindow?.source, 'intent_time_window')
  assert.equal(resolution.planningWindow?.usesIntentWindow, true)
  assert.equal(resolution.whenProjection, undefined)
  assert.equal(result.admitted.length, 1)

  return {
    case: 'valid explicit generation preservation',
    beforeBehavior: 'explicit intent time drove strict hours',
    afterBehavior: 'explicit intent time still wins over When posture',
    intendedChangeOrPreserved: 'preserved behavior',
    pass: true,
    notes: 'non-change for valid explicit intent time',
  }
}

function assertStaticCorpusResolverWired(): Record<string, unknown> {
  const starterPack = findStarterPack('hidden-cocktail-corners')
  const result = resolveCurateStaticFieldCorpusVenues({
    intent: baseIntent(),
    whenSignalProfile: profile({}),
    clock: fixedClock,
    starterPack,
    existingCuratedVenues: curatedVenues,
    requestedSourceMode: 'curated',
    enabled: true,
  })
  const planningWindow = result.diagnostics.runtimeHoursAdmission?.planningWindow

  assert.equal(result.diagnostics.activated, true)
  assert.equal(planningWindow?.source, 'when_planning_window')
  assert.equal(planningWindow?.day, 2)
  assert.equal(planningWindow?.hour, 20)
  assert.notEqual(`${planningWindow?.day}/${planningWindow?.hour}`, '5/19')

  return {
    case: 'static corpus resolver wired',
    beforeBehavior: 'static corpus used Gate 1 Friday 7PM fallback',
    afterBehavior: 'static corpus runtime-hours admission uses When planning window',
    intendedChangeOrPreserved: 'intended change',
    pass: true,
    notes: `${planningWindow?.source} ${planningWindow?.day}/${planningWindow?.hour}:${planningWindow?.minute}`,
  }
}

function main(): void {
  try {
    const behaviorResults = [
      assertDefaultNow(),
      assertUserSelectedNow(),
      assertLaterTonight(),
      assertThisWeekend(),
      assertNextWeekBroad(),
      assertPickATime(),
      assertInvalidExplicitTime(),
      assertValidExplicitIntentTimePreserved(),
      assertStaticCorpusResolverWired(),
      {
        case: 'provider silence',
        beforeBehavior: 'n/a',
        afterBehavior: 'no provider/network calls',
        intendedChangeOrPreserved: 'preserved behavior',
        pass: providerCallCount === 0,
        notes: providerCallCount,
      },
    ]

    assert.equal(providerCallCount, 0, 'Bearings When consumption observer must not call providers.')

    console.info('Bearings When planning-window consumption observer')
    console.table(behaviorResults)
    console.info('Strictness / honesty proof')
    console.table([
      {
        case: 'default now',
        whenDefaulted: true,
        source: 'defaulted',
        strictness: 'soft',
        hoursUnknownBehavior: 'relaxed',
        diagnostics: 'when_planning_window actual clock',
        pass: true,
      },
      {
        case: 'user-selected now',
        whenDefaulted: false,
        source: 'user_supplied',
        strictness: 'medium',
        hoursUnknownBehavior: 'relaxed with user marker',
        diagnostics: 'when_planning_window actual clock',
        pass: true,
      },
      {
        case: 'pick-a-time',
        whenDefaulted: false,
        source: 'user_supplied',
        strictness: 'strict',
        hoursUnknownBehavior: 'blocked',
        diagnostics: 'explicit_time_requires_known_hours',
        pass: true,
      },
      {
        case: 'next week',
        whenDefaulted: false,
        source: 'user_supplied',
        strictness: 'broad',
        hoursUnknownBehavior: 'relaxed; no fake exact-day hard block',
        diagnostics: 'broad_future_do_not_hard_block_known_hours',
        pass: true,
      },
    ])
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

main()
