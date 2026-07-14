import assert from 'node:assert/strict'

import { projectBearingsWhenPlanningWindow } from '../src/domain/bearings/projectWhenPlanningWindow.ts'
import { buildWhenSignalProfile, type WhenSignalPosture } from '../src/domain/when/whenSignalProfile.ts'

const originalFetch = globalThis.fetch
let providerCallCount = 0

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`Bearings When planning-window projection must not call fetch: ${String(input)}`)
}) as typeof fetch

const fixedClock = new Date(2026, 6, 14, 20, 15, 0, 0)

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

function assertNotFridaySeven(label: string, window: { day: number; hour: number } | undefined): void {
  assert(window !== undefined, `${label} must project a representative window.`)
  assert.notEqual(
    `${window.day}/${window.hour}`,
    '5/19',
    `${label} must not project the legacy Friday 7PM fallback.`,
  )
}

function assertDefaultNow(): Record<string, unknown> {
  const projection = projectBearingsWhenPlanningWindow({
    whenSignalProfile: profile({}),
    clock: fixedClock,
  })

  assert.equal(projection.posture, 'now_doable_tonight')
  assert.equal(projection.whenDefaulted, true)
  assert.equal(projection.whenPostureSource, 'defaulted')
  assert.equal(projection.strictness, 'soft')
  assert.equal(projection.kind, 'runtime_now')
  assert.equal(projection.actualRuntimeClockUsed, true)
  assert.equal(projection.representativeWindow?.day, 2)
  assert.equal(projection.representativeWindow?.hour, 20)
  assert.equal(projection.representativeWindow?.minute, 15)
  assertNotFridaySeven('default now', projection.representativeWindow)

  return {
    case: 'default now',
    input: 'default WhenSignalProfile',
    expected: 'Tuesday 20:15 soft defaulted runtime clock',
    observed: `${projection.representativeWindow?.day}/${projection.representativeWindow?.hour}:${projection.representativeWindow?.minute} ${projection.strictness}`,
    pass: true,
    notes: projection.diagnostics.reason,
  }
}

function assertUserSelectedNow(): Record<string, unknown> {
  const projection = projectBearingsWhenPlanningWindow({
    whenSignalProfile: profile({
      whenPosture: 'now_doable_tonight',
      whenPostureSource: 'user_supplied',
    }),
    clock: fixedClock,
  })

  assert.equal(projection.whenDefaulted, false)
  assert.equal(projection.whenPostureSource, 'user_supplied')
  assert.equal(projection.strictness, 'medium')
  assert.equal(projection.actualRuntimeClockUsed, true)
  assert.equal(projection.representativeWindow?.day, 2)
  assert.equal(projection.representativeWindow?.hour, 20)
  assertNotFridaySeven('user-selected now', projection.representativeWindow)

  return {
    case: 'user-selected now',
    input: 'now_doable_tonight/user_supplied',
    expected: 'injected clock with medium strictness',
    observed: `${projection.representativeWindow?.label} ${projection.strictness}`,
    pass: true,
    notes: projection.diagnostics.reason,
  }
}

function assertLaterTonight(): Record<string, unknown> {
  const projection = projectBearingsWhenPlanningWindow({
    whenSignalProfile: profile({
      whenPosture: 'later_tonight',
      whenPostureSource: 'user_supplied',
      durationMinutes: 150,
    }),
    clock: fixedClock,
  })

  assert.equal(projection.strictness, 'medium')
  assert.equal(projection.kind, 'posture_representative')
  assert.equal(projection.representativeWindow?.day, 2)
  assert.equal(projection.representativeWindow?.hour, 22)
  assert.equal(projection.windowWidthMinutes, 150)
  assertNotFridaySeven('later tonight', projection.representativeWindow)

  return {
    case: 'later tonight',
    input: 'later_tonight/user_supplied/150min',
    expected: 'same-day later posture, not Friday',
    observed: `${projection.representativeWindow?.day}/${projection.representativeWindow?.hour}:${projection.representativeWindow?.minute}`,
    pass: true,
    notes: projection.diagnostics.reason,
  }
}

function assertThisWeekend(): Record<string, unknown> {
  const projection = projectBearingsWhenPlanningWindow({
    whenSignalProfile: profile({
      whenPosture: 'this_weekend',
      whenPostureSource: 'user_supplied',
    }),
    clock: fixedClock,
  })

  assert.equal(projection.strictness, 'medium')
  assert.equal(projection.kind, 'posture_representative')
  assert.equal(projection.representativeWindow?.day, 6)
  assert.equal(projection.representativeWindow?.hour, 19)
  assertNotFridaySeven('this weekend', projection.representativeWindow)

  return {
    case: 'this weekend',
    input: 'this_weekend/user_supplied',
    expected: 'date-aware weekend posture, not Friday 7PM',
    observed: `${projection.representativeWindow?.localDate} ${projection.representativeWindow?.hour}:00`,
    pass: true,
    notes: projection.diagnostics.reason,
  }
}

function assertNextWeek(): Record<string, unknown> {
  const projection = projectBearingsWhenPlanningWindow({
    whenSignalProfile: profile({
      whenPosture: 'next_week',
      whenPostureSource: 'user_supplied',
      durationMinutes: 210,
    }),
    clock: fixedClock,
  })

  assert.equal(projection.strictness, 'broad')
  assert.equal(projection.kind, 'broad_future')
  assert.equal(projection.broadFuture, true)
  assert.equal(projection.exactUserTime, false)
  assert.equal(projection.hoursPosture, 'broad_future_do_not_hard_block_known_hours')
  assert.equal(projection.windowWidthMinutes, 210)
  assertNotFridaySeven('next week', projection.representativeWindow)

  return {
    case: 'next week',
    input: 'next_week/user_supplied/210min',
    expected: 'broad future posture, no hard exact day',
    observed: `${projection.kind}/${projection.strictness}/${projection.hoursPosture}`,
    pass: true,
    notes: projection.diagnostics.reason,
  }
}

function assertPickATime(): Record<string, unknown> {
  const projection = projectBearingsWhenPlanningWindow({
    whenSignalProfile: profile({
      whenPosture: 'pick_a_time',
      whenPostureSource: 'user_supplied',
      startTime: '8:30pm',
      durationMinutes: 90,
    }),
    clock: fixedClock,
  })

  assert.equal(projection.strictness, 'strict')
  assert.equal(projection.kind, 'explicit_time')
  assert.equal(projection.exactUserTime, true)
  assert.equal(projection.actualRuntimeClockUsed, false)
  assert.equal(projection.representativeWindow?.day, 2)
  assert.equal(projection.representativeWindow?.hour, 20)
  assert.equal(projection.representativeWindow?.minute, 30)
  assert.equal(projection.hoursPosture, 'explicit_time_requires_known_hours')
  assertNotFridaySeven('pick-a-time', projection.representativeWindow)

  return {
    case: 'pick-a-time',
    input: 'pick_a_time/user_supplied/8:30pm',
    expected: 'explicit 20:30 strict',
    observed: `${projection.representativeWindow?.hour}:${projection.representativeWindow?.minute} ${projection.strictness}`,
    pass: true,
    notes: projection.diagnostics.reason,
  }
}

function assertInvalidExplicitTime(): Record<string, unknown> {
  const projection = projectBearingsWhenPlanningWindow({
    whenSignalProfile: profile({
      whenPosture: 'pick_a_time',
      whenPostureSource: 'user_supplied',
      startTime: 'sometime-ish',
    }),
    clock: fixedClock,
  })

  assert.equal(projection.strictness, 'strict')
  assert.equal(projection.kind, 'invalid_explicit_time')
  assert.equal(projection.valid, false)
  assert.equal(projection.invalidReason, 'unparseable_explicit_time')
  assert.equal(projection.representativeWindow, undefined)
  assert.equal(projection.hoursPosture, 'invalid_time_no_fallback')
  assert.equal(projection.actualRuntimeClockUsed, false)

  return {
    case: 'invalid explicit time',
    input: 'pick_a_time/user_supplied/sometime-ish',
    expected: 'invalid, no Friday fallback',
    observed: `${projection.kind}/${projection.invalidReason}/${projection.representativeWindow ?? 'no-window'}`,
    pass: true,
    notes: projection.diagnostics.reason,
  }
}

function main(): void {
  try {
    const projectionCases = [
      assertDefaultNow(),
      assertUserSelectedNow(),
      assertLaterTonight(),
      assertThisWeekend(),
      assertNextWeek(),
      assertPickATime(),
      assertInvalidExplicitTime(),
      {
        case: 'provider silence',
        input: 'observer fetch trap',
        expected: 0,
        observed: providerCallCount,
        pass: providerCallCount === 0,
        notes: 'Projection helper is pure and does not call providers.',
      },
    ]

    assert.equal(providerCallCount, 0, 'Bearings When projection observer must not call providers.')

    console.info('Bearings When planning-window projection observer')
    console.table(projectionCases)
    console.info('Strictness semantics')
    console.table([
      {
        case: 'default now',
        whenDefaulted: true,
        source: 'defaulted',
        strictness: 'soft',
        actualClockUsed: true,
        broadFuture: false,
      },
      {
        case: 'user-selected now',
        whenDefaulted: false,
        source: 'user_supplied',
        strictness: 'medium',
        actualClockUsed: true,
        broadFuture: false,
      },
      {
        case: 'next week',
        whenDefaulted: false,
        source: 'user_supplied',
        strictness: 'broad',
        actualClockUsed: true,
        broadFuture: true,
      },
      {
        case: 'pick-a-time',
        whenDefaulted: false,
        source: 'user_supplied',
        strictness: 'strict',
        actualClockUsed: false,
        broadFuture: false,
      },
    ])
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

main()
