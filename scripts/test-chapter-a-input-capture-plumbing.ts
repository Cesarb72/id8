import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  applyConciergeCardObjectiveCapture,
  buildDefaultConciergeCardObjectiveDraft,
} from '../src/app/concierge/objectiveCardCapture.ts'
import {
  applyConciergeCardOriginCapture,
  buildDefaultConciergeCardOriginDraft,
  buildDeniedConciergeCardOriginDraft,
} from '../src/app/concierge/originCardCapture.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import {
  buildWhenSignalProfile,
  type ConciergeCardInputDraft,
} from '../src/app/types/conciergeCardInput.ts'
import type { ConciergeObjectiveOccasion } from '../src/domain/types/intent.ts'

let providerCallCount = 0
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`Chapter A capture plumbing observer must not call fetch: ${String(input)}`)
}) as typeof fetch

function sourceText(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function baseDraft(): ConciergeCardInputDraft {
  const when = {
    whenPosture: 'now_doable_tonight',
    whenPostureSource: 'defaulted',
    startTime: undefined,
    durationMinutes: 150,
    durationSource: 'defaulted',
    spatialMode: 'WALKABLE',
    flexibilitySource: 'defaulted',
  } satisfies ConciergeCardInputDraft['when']

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

function intentInputForDraft(draft: ConciergeCardInputDraft) {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'curate',
    persona: draft.persona,
    primaryVibe: draft.vibe.selectedVibe,
    city: draft.city,
    objectiveOccasion: draft.objectiveOccasion,
    objectiveSource: draft.objectiveSource,
  })

  return projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'curate',
    city: draft.city,
    distanceMode: 'nearby',
  })
}

function assertObjectiveCapture(): Array<Record<string, unknown>> {
  const defaultObjective = buildDefaultConciergeCardObjectiveDraft()
  assert.equal(defaultObjective.objectiveOccasion, 'connect')
  assert.equal(defaultObjective.objectiveSource, 'defaulted')
  assert.equal(defaultObjective.objectiveDefaulted, true)

  const untouched = applyConciergeCardObjectiveCapture(baseDraft(), {})
  assert.equal(untouched.objectiveOccasion, 'connect')
  assert.equal(untouched.objectiveSource, 'defaulted')
  assert.equal(untouched.objectiveDefaulted, true)

  const defaultIntentInput = intentInputForDraft(untouched)
  const explicitConnect = applyConciergeCardObjectiveCapture(baseDraft(), {
    objectiveOccasion: 'connect',
  })
  assert.equal(explicitConnect.objectiveOccasion, 'connect')
  assert.equal(explicitConnect.objectiveSource, 'user_supplied')
  assert.equal(explicitConnect.objectiveDefaulted, false)
  assert.deepEqual(
    intentInputForDraft(explicitConnect),
    defaultIntentInput,
    'Defaulted Connect and explicit Connect must remain compatibility-identical today.',
  )

  const rows = [
    {
      case: 'untouched objective',
      objective: untouched.objectiveOccasion,
      source: untouched.objectiveSource,
      defaulted: untouched.objectiveDefaulted,
      behaviorChanged: false,
    },
    {
      case: 'explicit connect',
      objective: explicitConnect.objectiveOccasion,
      source: explicitConnect.objectiveSource,
      defaulted: explicitConnect.objectiveDefaulted,
      behaviorChanged: false,
    },
  ]

  for (const objective of ['explore', 'celebrate'] satisfies ConciergeObjectiveOccasion[]) {
    const captured = applyConciergeCardObjectiveCapture(baseDraft(), {
      objectiveOccasion: objective,
    })
    assert.equal(captured.objectiveOccasion, objective)
    assert.equal(captured.objectiveSource, 'user_supplied')
    assert.equal(captured.objectiveDefaulted, false)
    rows.push({
      case: `explicit ${objective}`,
      objective: captured.objectiveOccasion,
      source: captured.objectiveSource,
      defaulted: captured.objectiveDefaulted,
      behaviorChanged: false,
    })
  }

  const sandboxSource = sourceText('src/pages/SandboxConciergePage.tsx')
  const cardStepSource = sourceText('src/components/concierge/cards/ConciergeCardStep.tsx')
  assert.equal(
    sandboxSource.includes('ConciergeObjectiveCardBody') ||
      sandboxSource.includes('handlePublicCardPreviewObjectiveChange'),
    false,
    'Objective controls must stay unexposed in A2.',
  )
  assert(
    cardStepSource.includes('Explore, connect, and celebrate options will render here.'),
    'Occasion card must remain placeholder-only until Chapter B behavior wiring.',
  )

  return rows
}

function assertOriginCapture(): Array<Record<string, unknown>> {
  const defaultOrigin = buildDefaultConciergeCardOriginDraft()
  assert.equal(defaultOrigin.originPrecision, 'unknown')
  assert.equal(defaultOrigin.originSource, 'unknown')
  assert.equal(defaultOrigin.posture, 'softest')
  assert.equal(defaultOrigin.captureNeeded, true)
  assert.equal(defaultOrigin.capturePath, 'choose_origin_method')

  const deniedOrigin = buildDeniedConciergeCardOriginDraft()
  assert.equal(deniedOrigin.originPrecision, 'unknown')
  assert.equal(deniedOrigin.originSource, 'unknown')
  assert.equal(deniedOrigin.posture, 'softest')
  assert.equal(deniedOrigin.captureNeeded, true)
  assert.equal(deniedOrigin.capturePath, 'enter_explicit_origin')

  const cases = [
    applyConciergeCardOriginCapture(baseDraft(), {
      status: 'geolocation_precise',
      userLatLng: { lat: 37.3329, lng: -121.8883 },
    }).origin,
    applyConciergeCardOriginCapture(baseDraft(), {
      status: 'explicit_origin',
      explicitOriginText: 'San Pedro Square',
    }).origin,
    applyConciergeCardOriginCapture(baseDraft(), { status: 'denied' }).origin,
    applyConciergeCardOriginCapture(baseDraft(), { status: 'omitted' }).origin,
    applyConciergeCardOriginCapture(baseDraft(), { status: 'unknown_fallback' }).origin,
  ]

  assert.equal(cases[0]?.originPrecision, 'precise')
  assert.equal(cases[0]?.originSource, 'geolocation')
  assert.equal(cases[0]?.posture, 'strict')
  assert.equal(cases[0]?.captureNeeded, false)
  assert.equal(cases[1]?.originPrecision, 'precise')
  assert.equal(cases[1]?.originSource, 'explicit_origin')
  assert.equal(cases[1]?.posture, 'strict')
  assert.equal(cases[1]?.captureNeeded, false)

  for (const origin of cases.slice(2)) {
    assert.equal(origin?.originPrecision, 'unknown')
    assert.equal(origin?.originSource, 'unknown')
    assert.equal(origin?.posture, 'softest')
    assert.equal(origin?.captureNeeded, true)
  }
  assert.equal(cases[2]?.capturePath, 'enter_explicit_origin')
  assert.equal(cases[3]?.capturePath, 'choose_origin_method')
  assert.equal(cases[4]?.capturePath, 'choose_origin_method')

  return cases.map((origin) => ({
    case: origin?.status,
    precision: origin?.originPrecision,
    source: origin?.originSource,
    posture: origin?.posture,
    captureNeeded: origin?.captureNeeded,
    capturePath: origin?.capturePath,
  }))
}

function assertThinGuardPresent(): Array<Record<string, unknown>> {
  const source = sourceText('scripts/test-waypoint-boundary-quality-scoring.ts')
  const rows = ['MINIBOSS', 'Happy Hollow', 'Adega'].map((fixture) => ({
    fixture,
    present: source.includes(fixture),
  }))
  rows.forEach((row) => assert.equal(row.present, true, `${row.fixture} THIN guard missing.`))
  return rows
}

async function main(): Promise<void> {
  try {
    const objectiveRows = assertObjectiveCapture()
    const originRows = assertOriginCapture()
    const thinRows = assertThinGuardPresent()
    assert.equal(providerCallCount, 0, 'Capture plumbing observer must not call providers.')

    console.info('Chapter A A2 objective capture plumbing')
    console.table(objectiveRows)
    console.info('Chapter A A2 origin capture plumbing')
    console.table(originRows)
    console.info('THIN guard presence')
    console.table(thinRows)
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

void main()
