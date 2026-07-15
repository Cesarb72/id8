import assert from 'node:assert/strict'

import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { projectOriginMovementPosture } from '../src/domain/bearings/projectOriginMovementPosture.ts'
import { projectObjectiveVisibility } from '../src/domain/interpretation/conciergeIntent/projectObjectiveVisibility.ts'
import type { ConciergeObjectiveOccasion } from '../src/domain/types/intent.ts'

let providerCallCount = 0
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`Chapter A origin projection observer must not call fetch: ${String(input)}`)
}) as typeof fetch

function buildIntent(objectiveOccasion?: ConciergeObjectiveOccasion) {
  return buildApplicationConciergeIntent({
    mode: 'curate',
    persona: 'romantic',
    primaryVibe: 'cozy',
    city: 'San Jose',
    ...(objectiveOccasion ? { objectiveOccasion } : {}),
  })
}

function assertOriginProjection(): Array<Record<string, unknown>> {
  const cases = [
    {
      case: 'precise geolocation',
      input: { originPrecision: 'precise', originSource: 'geolocation' },
      strictness: 'strict',
      movementRadiusPosture: 'tight',
      captureNeeded: false,
      fallbackEstimated: false,
      allowsTightWalkableClaims: true,
      valid: true,
    },
    {
      case: 'precise explicit origin',
      input: { originPrecision: 'precise', originSource: 'explicit_origin' },
      strictness: 'strict',
      movementRadiusPosture: 'tight',
      captureNeeded: false,
      fallbackEstimated: false,
      allowsTightWalkableClaims: true,
      valid: true,
    },
    {
      case: 'neighborhood fallback',
      input: { originPrecision: 'neighborhood', originSource: 'neighborhood_fallback' },
      strictness: 'medium',
      movementRadiusPosture: 'medium',
      captureNeeded: false,
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: true,
    },
    {
      case: 'city fallback',
      input: { originPrecision: 'city', originSource: 'city_fallback' },
      strictness: 'broad',
      movementRadiusPosture: 'soft',
      captureNeeded: false,
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: true,
    },
    {
      case: 'unknown fallback',
      input: { originPrecision: 'unknown', originSource: 'unknown' },
      strictness: 'softest',
      movementRadiusPosture: 'softest',
      captureNeeded: true,
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: true,
    },
    {
      case: 'anchor fallback not user-selected',
      input: { originPrecision: 'anchor', originSource: 'anchor_fallback' },
      strictness: 'invalid',
      movementRadiusPosture: 'invalid',
      captureNeeded: true,
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: false,
    },
    {
      case: 'anchor fallback user-selected',
      input: {
        originPrecision: 'anchor',
        originSource: 'anchor_user_selected',
        userSelectedStartNearAnchor: true,
      },
      strictness: 'medium',
      movementRadiusPosture: 'medium',
      captureNeeded: false,
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: true,
    },
  ] as const

  return cases.map((testCase) => {
    const projection = projectOriginMovementPosture(testCase.input)
    assert.equal(projection.source, 'bearings')
    assert.equal(projection.strictness, testCase.strictness)
    assert.equal(projection.movementRadiusPosture, testCase.movementRadiusPosture)
    assert.equal(projection.captureNeeded, testCase.captureNeeded)
    assert.equal(projection.fallbackEstimated, testCase.fallbackEstimated)
    assert.equal(projection.allowsTightWalkableClaims, testCase.allowsTightWalkableClaims)
    assert.equal(projection.valid, testCase.valid)
    return {
      case: testCase.case,
      strictness: projection.strictness,
      radiusPosture: projection.movementRadiusPosture,
      captureNeeded: projection.captureNeeded,
      fallbackEstimated: projection.fallbackEstimated,
      allowsTightWalkableClaims: projection.allowsTightWalkableClaims,
      valid: projection.valid,
    }
  })
}

function assertObjectiveProjection(): Array<Record<string, unknown>> {
  const defaulted = buildIntent()
  const explicitConnect = buildIntent('connect')
  const defaultedProjection = projectObjectiveVisibility(defaulted)
  const explicitConnectProjection = projectObjectiveVisibility(explicitConnect)

  assert.equal(defaultedProjection.objectiveOccasion, 'connect')
  assert.equal(defaultedProjection.objectiveSource, 'defaulted')
  assert.equal(defaultedProjection.objectiveDefaulted, true)
  assert.equal(defaultedProjection.provenanceOnly, true)
  assert.equal(defaultedProjection.behaviorDriving, false)
  assert.equal(defaultedProjection.userFacingControlRecommended, false)

  assert.equal(explicitConnectProjection.objectiveOccasion, 'connect')
  assert.equal(explicitConnectProjection.objectiveSource, 'user_supplied')
  assert.equal(explicitConnectProjection.objectiveDefaulted, false)
  assert.equal(explicitConnectProjection.provenanceOnly, true)
  assert.equal(explicitConnectProjection.behaviorDriving, false)

  assert.deepEqual(
    projectConciergeIntentToIntentInput({
      conciergeIntent: defaulted,
      mode: 'curate',
      city: 'San Jose',
      distanceMode: 'nearby',
    }),
    projectConciergeIntentToIntentInput({
      conciergeIntent: explicitConnect,
      mode: 'curate',
      city: 'San Jose',
      distanceMode: 'nearby',
    }),
    'Objective visibility projection must not change compatibility IntentInput behavior.',
  )

  const rows = [
    defaultedProjection,
    explicitConnectProjection,
    projectObjectiveVisibility(buildIntent('explore')),
    projectObjectiveVisibility(buildIntent('celebrate')),
  ]

  return rows.map((projection) => {
    assert.equal(projection.source, 'interpretation')
    assert.equal(projection.provenanceOnly, true)
    assert.equal(projection.behaviorDriving, false)
    return {
      objective: projection.objectiveOccasion,
      source: projection.objectiveSource,
      defaulted: projection.objectiveDefaulted,
      provenanceOnly: projection.provenanceOnly,
      behaviorDriving: projection.behaviorDriving,
      userFacingControlRecommended: projection.userFacingControlRecommended,
    }
  })
}

async function main(): Promise<void> {
  try {
    const originRows = assertOriginProjection()
    const objectiveRows = assertObjectiveProjection()
    assert.equal(providerCallCount, 0, 'Origin projection observer must not call providers.')

    console.info('Chapter A A3 Bearings origin movement posture projection')
    console.table(originRows)
    console.info('Chapter A A3 Interpretation objective visibility projection')
    console.table(objectiveRows)
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

void main()
