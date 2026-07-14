import assert from 'node:assert/strict'

import {
  applyConciergeCardWhenCapture,
  buildDefaultConciergeCardWhenDraft,
} from '../src/app/concierge/whenCardCapture.ts'
import { buildWhenSignalProfile, type ConciergeCardInputDraft } from '../src/app/types/conciergeCardInput.ts'

let providerCallCount = 0
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`When picker card capture observer must not call fetch: ${String(input)}`)
}) as typeof fetch

function baseDraft(): ConciergeCardInputDraft {
  const when = buildDefaultConciergeCardWhenDraft()
  return {
    city: 'San Jose',
    persona: 'romantic',
    objectiveOccasion: 'connect',
    when,
    whenSignalProfile: buildWhenSignalProfile(when),
    vibe: {
      selectedVibe: 'cozy',
      uxProfile: 'cozy',
      tasteProfileId: null,
      vibeTasteProfileId: null,
    },
  }
}

function assertDefaultCapture(): Record<string, unknown> {
  const draft = baseDraft()
  assert.equal(draft.whenSignalProfile.whenPosture, 'now_doable_tonight')
  assert.equal(draft.whenSignalProfile.whenDefaulted, true)
  assert.equal(draft.whenSignalProfile.startTime, undefined)
  assert.equal(draft.whenSignalProfile.durationMinutes, null)
  assert.equal(draft.whenSignalProfile.durationSource, 'defaulted')
  assert.equal(draft.whenSignalProfile.spatialMode, 'WALKABLE')
  assert.equal(draft.whenSignalProfile.flexibilitySource, 'defaulted')

  return {
    case: 'skip/default',
    expected: 'now_doable_tonight default, no fake startTime',
    observed: draft.whenSignalProfile.reasonSummary,
    pass: true,
  }
}

function assertNowSelectedCapture(): Record<string, unknown> {
  const draft = applyConciergeCardWhenCapture(baseDraft(), {
    whenPosture: 'now_doable_tonight',
  })
  assert.equal(draft.when.whenPosture, 'now_doable_tonight')
  assert.equal(draft.when.whenPostureSource, 'user_supplied')
  assert.equal(draft.whenSignalProfile.whenPosture, 'now_doable_tonight')
  assert.equal(draft.whenSignalProfile.whenDefaulted, false)
  assert.equal(draft.whenSignalProfile.startTime, undefined)

  return {
    case: 'now selected',
    expected: 'now_doable_tonight user-supplied, no fake startTime',
    observed: draft.whenSignalProfile.reasonSummary,
    pass: true,
  }
}

function assertPresetCapture(posture: 'later_tonight' | 'this_weekend' | 'next_week'): Record<string, unknown> {
  const draft = applyConciergeCardWhenCapture(baseDraft(), { whenPosture: posture })
  assert.equal(draft.when.whenPosture, posture)
  assert.equal(draft.when.whenPostureSource, 'user_supplied')
  assert.equal(draft.whenSignalProfile.whenPosture, posture)
  assert.equal(draft.whenSignalProfile.whenDefaulted, false)
  assert.equal(draft.whenSignalProfile.startTime, undefined)

  return {
    case: posture,
    expected: 'user-supplied posture without fake startTime',
    observed: draft.whenSignalProfile.reasonSummary,
    pass: true,
  }
}

function assertPickTimeCapture(): Record<string, unknown> {
  const draft = applyConciergeCardWhenCapture(baseDraft(), {
    whenPosture: 'pick_a_time',
    startTime: ' 8:30pm ',
  })
  assert.equal(draft.when.whenPosture, 'pick_a_time')
  assert.equal(draft.when.whenPostureSource, 'user_supplied')
  assert.equal(draft.whenSignalProfile.whenDefaulted, false)
  assert.equal(draft.whenSignalProfile.startTime, '8:30pm')
  assert.equal(draft.whenSignalProfile.timePhase, 'evening')

  return {
    case: 'pick-a-time',
    expected: 'explicit startTime preserved and trimmed',
    observed: draft.whenSignalProfile.reasonSummary,
    pass: true,
  }
}

function assertDurationAndFlexibilityCapture(): Record<string, unknown>[] {
  const durationOmitted = applyConciergeCardWhenCapture(baseDraft(), {
    durationMinutes: null,
  })
  assert.equal(durationOmitted.whenSignalProfile.durationMinutes, null)
  assert.equal(durationOmitted.whenSignalProfile.durationSource, 'defaulted')

  const durationSupplied = applyConciergeCardWhenCapture(baseDraft(), {
    durationMinutes: 150,
  })
  assert.equal(durationSupplied.whenSignalProfile.whenDefaulted, false)
  assert.equal(durationSupplied.whenSignalProfile.durationMinutes, 150)
  assert.equal(durationSupplied.whenSignalProfile.durationSource, 'user_supplied')
  assert.equal(durationSupplied.whenSignalProfile.durationBand, 'standard')

  const flexibilityOmitted = baseDraft()
  assert.equal(flexibilityOmitted.whenSignalProfile.spatialMode, 'WALKABLE')
  assert.equal(flexibilityOmitted.whenSignalProfile.flexibilitySource, 'defaulted')
  assert.equal(flexibilityOmitted.whenSignalProfile.movementPreference, 'walkable')

  const flexibilitySupplied = applyConciergeCardWhenCapture(baseDraft(), {
    spatialMode: 'FLEXIBLE',
  })
  assert.equal(flexibilitySupplied.whenSignalProfile.whenDefaulted, false)
  assert.equal(flexibilitySupplied.whenSignalProfile.spatialMode, 'FLEXIBLE')
  assert.equal(flexibilitySupplied.whenSignalProfile.flexibilitySource, 'user_supplied')
  assert.equal(flexibilitySupplied.whenSignalProfile.movementPreference, 'flexible')

  return [
    {
      case: 'duration omitted',
      expected: 'null/defaulted',
      observed: `${durationOmitted.whenSignalProfile.durationMinutes}/${durationOmitted.whenSignalProfile.durationSource}`,
      pass: true,
    },
    {
      case: 'duration supplied',
      expected: '150/user_supplied',
      observed: `${durationSupplied.whenSignalProfile.durationMinutes}/${durationSupplied.whenSignalProfile.durationSource}`,
      pass: true,
    },
    {
      case: 'flexibility omitted',
      expected: 'WALKABLE/defaulted',
      observed: `${flexibilityOmitted.whenSignalProfile.spatialMode}/${flexibilityOmitted.whenSignalProfile.flexibilitySource}`,
      pass: true,
    },
    {
      case: 'flexibility supplied',
      expected: 'FLEXIBLE/user_supplied',
      observed: `${flexibilitySupplied.whenSignalProfile.spatialMode}/${flexibilitySupplied.whenSignalProfile.flexibilitySource}`,
      pass: true,
    },
  ]
}

function assertEventsParked(): Record<string, unknown> {
  const draft = applyConciergeCardWhenCapture(baseDraft(), {
    whenPosture: 'next_week',
    durationMinutes: 210,
    spatialMode: 'FLEXIBLE',
  })
  assert.equal(draft.whenSignalProfile.eventsReadiness.seam, 'when_plus_where')
  assert.equal(draft.whenSignalProfile.eventsReadiness.status, 'parked')
  assert.equal(draft.whenSignalProfile.eventsReadiness.canSeedFutureEventsQuery, true)

  return {
    case: 'Events parked',
    expected: 'when_plus_where parked',
    observed: `${draft.whenSignalProfile.eventsReadiness.seam}/${draft.whenSignalProfile.eventsReadiness.status}`,
    pass: true,
  }
}

function main(): void {
  try {
    const results = [
      assertDefaultCapture(),
      assertNowSelectedCapture(),
      assertPresetCapture('later_tonight'),
      assertPresetCapture('this_weekend'),
      assertPresetCapture('next_week'),
      assertPickTimeCapture(),
      ...assertDurationAndFlexibilityCapture(),
      assertEventsParked(),
      {
        case: 'provider calls zero',
        expected: 0,
        observed: providerCallCount,
        pass: providerCallCount === 0,
      },
    ]

    assert.equal(providerCallCount, 0, 'When picker capture observer must not call providers.')
    console.info('When picker card capture observer')
    console.table(results)
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

main()
