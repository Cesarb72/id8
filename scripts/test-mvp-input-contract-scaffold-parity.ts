import assert from 'node:assert/strict'

import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { projectConciergeIntentToIntentInput } from '../src/domain/interpretation/projectConciergeIntentToIntentInput.ts'
import { buildWhenSignalProfile, type WhenSignalPosture } from '../src/domain/when/whenSignalProfile.ts'
import { resolveLocation } from '../src/engines/district/location/resolveLocation.ts'
import type { ConciergeObjectiveOccasion } from '../src/domain/types/intent.ts'

let providerCallCount = 0
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`MVP input contract scaffold parity must not call fetch: ${String(input)}`)
}) as typeof fetch

function assertEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message)
}

function buildDefaultCasualPlan() {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'curate',
    persona: 'romantic',
    primaryVibe: 'cozy',
    city: 'San Jose',
  })
  const projectedInput = projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'curate',
    city: 'San Jose',
    distanceMode: 'nearby',
  })
  const whenProfile = buildWhenSignalProfile({
    durationMinutes: null,
    spatialMode: 'WALKABLE',
  })
  const location = resolveLocation({
    locationQuery: 'San Jose',
  })

  assertEqual(conciergeIntent.objective.occasion, 'connect', 'Default objective must be connect.')
  assertEqual(conciergeIntent.objectiveDefaulted, true, 'Default objective marker must be projected.')
  assertEqual(conciergeIntent.objectiveSource, 'defaulted', 'Default objective source must be explicit.')
  assertEqual(
    projectedInput,
    {
      mode: 'curate',
      planningMode: 'engine-led',
      persona: 'romantic',
      primaryVibe: 'cozy',
      city: 'San Jose',
      district: undefined,
      neighborhood: undefined,
      distanceMode: 'nearby',
      refinementModes: undefined,
      selectedDirectionContext: undefined,
      discoveryPreferences: undefined,
      anchor: undefined,
    },
    'Compatibility IntentInput projection must remain unchanged.',
  )

  assertEqual(whenProfile.whenPosture, 'now_doable_tonight', 'When default must be now/doable tonight.')
  assertEqual(whenProfile.whenDefaulted, true, 'When default marker must be explicit.')
  assertEqual(whenProfile.whenPostureSource, 'defaulted', 'When source must be explicit.')
  assertEqual(whenProfile.durationMinutes, null, 'Default duration must remain unspecified.')
  assertEqual(whenProfile.durationSource, 'defaulted', 'Default duration source must be explicit.')
  assertEqual(whenProfile.spatialMode, 'WALKABLE', 'Default spatial mode must remain walkable.')
  assertEqual(whenProfile.flexibilitySource, 'defaulted', 'Default flexibility source must be explicit.')
  assertEqual(whenProfile.movementPreference, 'walkable', 'Default movement preference must remain walkable.')
  assertEqual(
    whenProfile.eventsReadiness,
    {
      seam: 'when_plus_where',
      status: 'parked',
      canSeedFutureEventsQuery: true,
      reason: 'When posture is structured for a future when+where Events query; Events behavior is parked.',
    },
    'When must expose a parked future Events seam without behavior.',
  )

  assertEqual(location.originPrecision, 'city', 'San Jose fallback must be city precision.')
  assertEqual(location.originSource, 'city_fallback', 'San Jose fallback source must be explicit.')
  assertEqual(location.source, 'query_lookup', 'Existing resolved location source must remain query_lookup.')
  assertEqual(location.eventsReadiness?.status, 'parked', 'Location Events seam must remain parked.')

  return {
    case: 'default casual plan',
    objective: conciergeIntent.objective.occasion,
    objectiveMarker: conciergeIntent.objectiveSource,
    whenPosture: whenProfile.whenPosture,
    durationFlexibility: `${whenProfile.durationSource}/${whenProfile.flexibilitySource}`,
    origin: `${location.originPrecision}/${location.originSource}`,
    pass: true,
  }
}

function assertObjectiveOverrideShape(): Array<{
  case: string
  objective: ConciergeObjectiveOccasion
  objectiveMarker: string | undefined
  pass: boolean
}> {
  return (['explore', 'connect', 'celebrate'] satisfies ConciergeObjectiveOccasion[]).map(
    (objectiveOccasion) => {
      const conciergeIntent = buildApplicationConciergeIntent({
        mode: 'curate',
        persona: 'friends',
        primaryVibe: 'lively',
        city: 'San Jose',
        objectiveOccasion,
      })
      assertEqual(
        conciergeIntent.objective.occasion,
        objectiveOccasion,
        `${objectiveOccasion} objective override must be representable.`,
      )
      assertEqual(
        conciergeIntent.objectiveDefaulted,
        false,
        `${objectiveOccasion} objective override must not be marked defaulted.`,
      )
      assertEqual(
        conciergeIntent.objectiveSource,
        'user_supplied',
        `${objectiveOccasion} objective override source must be explicit.`,
      )
      return {
        case: `${objectiveOccasion} objective override`,
        objective: objectiveOccasion,
        objectiveMarker: conciergeIntent.objectiveSource,
        pass: true,
      }
    },
  )
}

function assertFutureWhenOptionShape(): Array<{
  case: string
  whenPosture: WhenSignalPosture
  durationFlexibility: string
  pass: boolean
}> {
  return ([
    'later_tonight',
    'this_weekend',
    'next_week',
    'pick_a_time',
  ] satisfies WhenSignalPosture[]).map((whenPosture) => {
    const profile = buildWhenSignalProfile({
      whenPosture,
      whenPostureSource: 'user_supplied',
      startTime: whenPosture === 'pick_a_time' ? '8:30pm' : undefined,
      durationMinutes: 150,
      durationSource: 'user_supplied',
      spatialMode: 'FLEXIBLE',
      flexibilitySource: 'user_supplied',
    })
    assertEqual(profile.whenPosture, whenPosture, `${whenPosture} posture must be representable.`)
    assertEqual(profile.whenDefaulted, false, `${whenPosture} posture must not be defaulted.`)
    assertEqual(profile.durationSource, 'user_supplied', `${whenPosture} duration source must be explicit.`)
    assertEqual(profile.flexibilitySource, 'user_supplied', `${whenPosture} flexibility source must be explicit.`)
    assertEqual(profile.movementPreference, 'flexible', `${whenPosture} flexible movement must be represented.`)
    assertEqual(profile.eventsReadiness.status, 'parked', `${whenPosture} must not introduce Events behavior.`)
    return {
      case: `${whenPosture} shape`,
      whenPosture,
      durationFlexibility: `${profile.durationSource}/${profile.flexibilitySource}`,
      pass: true,
    }
  })
}

function assertOriginPrecisionShapes(): Array<{
  case: string
  origin: string
  source: string
  pass: boolean
}> {
  const precise = resolveLocation({
    locationQuery: 'Current location',
    userLatLng: { lat: 37.3329, lng: -121.8883 },
    originSource: 'geolocation',
  })
  assertEqual(precise.originPrecision, 'precise', 'User lat/lng origin must be precise.')
  assertEqual(precise.originSource, 'geolocation', 'User lat/lng origin source must be geolocation.')
  assertEqual(precise.source, 'user_lat_lng', 'Existing user lat/lng source must remain unchanged.')

  const explicit = resolveLocation({
    locationQuery: '37.3329, -121.8883',
  })
  assertEqual(explicit.originPrecision, 'precise', 'Coordinate query must be precise.')
  assertEqual(explicit.originSource, 'explicit_origin', 'Coordinate query must be explicit origin.')

  const neighborhood = resolveLocation({
    locationQuery: 'Downtown San Jose',
  })
  assertEqual(neighborhood.originPrecision, 'neighborhood', 'Neighborhood fallback must be explicit.')
  assertEqual(
    neighborhood.originSource,
    'neighborhood_fallback',
    'Neighborhood fallback source must be explicit.',
  )

  const queryFallback = resolveLocation({
    locationQuery: 'Downtown',
  })
  assertEqual(queryFallback.originPrecision, 'query_fallback', 'Ambiguous query fallback must be explicit.')
  assertEqual(queryFallback.originSource, 'query_fallback', 'Ambiguous query fallback source must be explicit.')

  return [
    {
      case: 'precise geolocation-style origin',
      origin: `${precise.originPrecision}/${precise.originSource}`,
      source: precise.source,
      pass: true,
    },
    {
      case: 'precise explicit coordinate origin',
      origin: `${explicit.originPrecision}/${explicit.originSource}`,
      source: explicit.source,
      pass: true,
    },
    {
      case: 'neighborhood fallback origin',
      origin: `${neighborhood.originPrecision}/${neighborhood.originSource}`,
      source: neighborhood.source,
      pass: true,
    },
    {
      case: 'query fallback origin',
      origin: `${queryFallback.originPrecision}/${queryFallback.originSource}`,
      source: queryFallback.source,
      pass: true,
    },
  ]
}

function main(): void {
  try {
    const defaultResult = buildDefaultCasualPlan()
    const objectiveResults = assertObjectiveOverrideShape()
    const whenResults = assertFutureWhenOptionShape()
    const originResults = assertOriginPrecisionShapes()

    assertEqual(providerCallCount, 0, 'MVP input scaffold parity must not call providers.')

    console.info('MVP input contract scaffold parity')
    console.table([defaultResult])
    console.info('Objective override shape')
    console.table(objectiveResults)
    console.info('Future When option shape')
    console.table(whenResults)
    console.info('Origin precision/source shape')
    console.table(originResults)
    console.info('Events parked: when_plus_where seam represented; no Events provider/search/UI/ranking introduced.')
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

main()
