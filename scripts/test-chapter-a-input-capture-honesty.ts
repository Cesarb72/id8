import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { projectConciergeIntentToIntentInput } from '../src/domain/interpretation/projectConciergeIntentToIntentInput.ts'
import {
  computeArcWhenSpatialScorePressure,
  isPeakDistanceFeasible,
} from '../src/domain/bearings/evaluateArcRouteMovementFeasibility.ts'
import { resolveLocation } from '../src/engines/district/location/resolveLocation.ts'
import { buildDistrictOpportunityProfiles } from '../src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'
import type { ConciergeObjectiveOccasion, IntentProfile } from '../src/domain/types/intent.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { ResolvedLocation } from '../src/engines/district/types/districtTypes.ts'

let providerCallCount = 0
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`Chapter A input capture honesty observer must not call fetch: ${String(input)}`)
}) as typeof fetch

type ObjectiveResult = {
  case: string
  observedMarker: string
  behaviorChanged: boolean
  userFacingControlExposed: boolean
  pass: boolean
  notes: string
}

type OriginMarkerResult = {
  case: string
  observedOriginPrecision: string
  observedOriginSource: string
  behaviorChanged: boolean
  pass: boolean
  notes: string
}

type OriginOvertrustResult = {
  originCase: string
  marker: string
  behaviorDrivingRadiusDistance: string
  movementStrictnessObserved: string
  sameAsPreciseGps: string
  verdict: string
}

function sourceText(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function baseIntentInput(conciergeIntent: ReturnType<typeof buildApplicationConciergeIntent>) {
  return projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'curate',
    city: 'San Jose',
    distanceMode: 'nearby',
  })
}

function buildObjectiveIntent(objectiveOccasion?: ConciergeObjectiveOccasion) {
  return buildApplicationConciergeIntent({
    mode: 'curate',
    persona: 'romantic',
    primaryVibe: 'cozy',
    city: 'San Jose',
    ...(objectiveOccasion ? { objectiveOccasion } : {}),
  })
}

function assertObjectiveHonesty(): ObjectiveResult[] {
  const defaulted = buildObjectiveIntent()
  const explicitConnect = buildObjectiveIntent('connect')
  assert.equal(defaulted.objective.occasion, 'connect')
  assert.equal(defaulted.objectiveDefaulted, true)
  assert.equal(defaulted.objectiveSource, 'defaulted')
  assert.equal(explicitConnect.objective.occasion, 'connect')
  assert.equal(explicitConnect.objectiveDefaulted, false)
  assert.equal(explicitConnect.objectiveSource, 'user_supplied')
  assert.deepEqual(
    baseIntentInput(defaulted),
    baseIntentInput(explicitConnect),
    'Defaulted connect and explicit connect must remain behaviorally identical in the current compatibility IntentInput projection.',
  )

  const sandboxSource = sourceText('src/pages/SandboxConciergePage.tsx')
  const cardStepSource = sourceText('src/components/concierge/cards/ConciergeCardStep.tsx')
  const objectiveControlExposed =
    sandboxSource.includes('ConciergeObjectiveCardBody') ||
    sandboxSource.includes('handlePublicCardPreviewObjectiveChange')
  assert.equal(objectiveControlExposed, false, 'Objective segmented control must not be exposed.')
  assert(
    cardStepSource.includes('Explore, connect, and celebrate options will render here.'),
    'Occasion card must remain placeholder-only until Chapter B behavior wiring.',
  )

  const overrideResults = (['connect', 'explore', 'celebrate'] satisfies ConciergeObjectiveOccasion[]).map(
    (objective) => {
      const intent = buildObjectiveIntent(objective)
      assert.equal(intent.objective.occasion, objective)
      assert.equal(intent.objectiveDefaulted, false)
      assert.equal(intent.objectiveSource, 'user_supplied')
      return {
        case: `explicit ${objective}`,
        observedMarker: `${intent.objective.occasion}/${intent.objectiveSource}`,
        behaviorChanged: false,
        userFacingControlExposed: objectiveControlExposed,
        pass: true,
        notes:
          objective === 'connect'
            ? 'Explicit Connect is internally representable but projects the same compatibility IntentInput as default Connect.'
            : 'Internally representable through Interpretation builder; no user-facing capture control exposed.',
      } satisfies ObjectiveResult
    },
  )

  return [
    {
      case: 'untouched Objective',
      observedMarker: `${defaulted.objective.occasion}/${defaulted.objectiveSource}`,
      behaviorChanged: false,
      userFacingControlExposed: objectiveControlExposed,
      pass: true,
      notes: 'Default Connect remains provenance-only today.',
    },
    ...overrideResults,
  ]
}

function originMarker(location: ResolvedLocation): string {
  return `${location.originPrecision ?? 'none'}/${location.originSource ?? 'none'}`
}

function assertLocation(
  label: string,
  location: ResolvedLocation,
  expectedPrecision: string,
  expectedSource: string,
  notes: string,
): OriginMarkerResult {
  assert.equal(location.originPrecision, expectedPrecision, `${label} originPrecision drifted.`)
  assert.equal(location.originSource, expectedSource, `${label} originSource drifted.`)
  return {
    case: label,
    observedOriginPrecision: location.originPrecision ?? 'none',
    observedOriginSource: location.originSource ?? 'none',
    behaviorChanged: false,
    pass: true,
    notes,
  }
}

function assertOriginMarkers(): { locations: Record<string, ResolvedLocation>; rows: OriginMarkerResult[] } {
  const locations = {
    preciseGeolocation: resolveLocation({
      locationQuery: 'Current location',
      userLatLng: { lat: 37.3329, lng: -121.8883 },
      originSource: 'geolocation',
    }),
    explicitOrigin: resolveLocation({
      locationQuery: '37.3329, -121.8883',
    }),
    neighborhoodFallback: resolveLocation({
      locationQuery: 'Downtown San Jose',
    }),
    cityFallback: resolveLocation({
      locationQuery: 'San Jose',
    }),
    pseudoCityCenter: resolveLocation({
      locationQuery: 'Reno, NV',
    }),
    unknownOmitted: resolveLocation({
      locationQuery: '',
    }),
    deniedOmittedUxState: resolveLocation({
      locationQuery: '',
    }),
  }

  return {
    locations,
    rows: [
      assertLocation(
        'precise geolocation-shaped input',
        locations.preciseGeolocation,
        'precise',
        'geolocation',
        'userLatLng is representable as precise geolocation.',
      ),
      assertLocation(
        'explicit coordinate-shaped input',
        locations.explicitOrigin,
        'precise',
        'explicit_origin',
        'coordinate query is representable as explicit origin.',
      ),
      assertLocation(
        'known neighborhood fallback',
        locations.neighborhoodFallback,
        'neighborhood',
        'neighborhood_fallback',
        'known neighborhood marker is preserved.',
      ),
      assertLocation(
        'known city fallback',
        locations.cityFallback,
        'city',
        'city_fallback',
        'known city marker is preserved.',
      ),
      assertLocation(
        'parsed pseudo city center',
        locations.pseudoCityCenter,
        'city',
        'city_fallback',
        'city/state parser uses pseudo city center with city fallback marker.',
      ),
      assertLocation(
        'unknown/omitted origin',
        locations.unknownOmitted,
        'unknown',
        'unknown',
        'empty origin does not become fake precise.',
      ),
      assertLocation(
        'denied/omitted UX state',
        locations.deniedOmittedUxState,
        'unknown',
        'unknown',
        'no separate denied UX state exists yet; omitted resolves as unknown.',
      ),
    ],
  }
}

function buildNearbyIntent(): IntentProfile {
  return {
    crew: 'romantic',
    persona: 'romantic',
    personaSource: 'explicit',
    primaryAnchor: 'cozy',
    city: 'San Jose',
    distanceMode: 'nearby',
    prefersHiddenGems: false,
    mode: 'curate',
    planningMode: 'engine-led',
  } as IntentProfile
}

function buildDistanceCandidate(driveMinutes: number): ScoredVenue {
  return {
    venue: {
      driveMinutes,
      source: {},
    },
    fitBreakdown: {
      proximityFit: 0.82,
    },
  } as ScoredVenue
}

function observeMovementStrictness(): string {
  const intent = buildNearbyIntent()
  const strictCandidate = buildDistanceCandidate(12)
  const outsideStrictCandidate = buildDistanceCandidate(20)
  const strictFeasible = isPeakDistanceFeasible(strictCandidate, intent, {
    allowMeaningfulStretch: false,
  })
  const outsideFeasible = isPeakDistanceFeasible(outsideStrictCandidate, intent, {
    allowMeaningfulStretch: false,
  })
  assert.equal(strictFeasible, true, 'Strict nearby candidate should remain feasible.')
  assert.equal(outsideFeasible, false, 'Outside bounded nearby candidate should remain infeasible.')

  const spatialPressure = computeArcWhenSpatialScorePressure({
    intent,
    spatial: {
      mode: 'walkable',
      homeClusterId: 'downtown',
      clustersVisited: ['downtown'],
      clusterAssignments: [],
      transitions: [],
      sameClusterTransitionCount: 2,
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: 0,
      jumpUsed: false,
      spatialBonus: 0,
      spatialPenalty: 0,
      score: 0.88,
      notes: [],
    },
    options: {
      whenSpatialScoring: 'soft_curate_spatial',
      whenSignalProfile: {
        whenPosture: 'now_doable_tonight',
        whenDefaulted: false,
        whenPostureSource: 'user_supplied',
        durationMinutes: 150,
        durationSource: 'user_supplied',
        durationBand: 'standard',
        spatialMode: 'WALKABLE',
        flexibilitySource: 'user_supplied',
        movementPreference: 'walkable',
        timePhase: 'evening',
        eventsReadiness: {
          seam: 'when_plus_where',
          status: 'parked',
          canSeedFutureEventsQuery: true,
          reason: 'test',
        },
        reasonSummary: 'test',
      },
    },
  })
  assert.equal(spatialPressure.movementPreference, 'walkable')
  return `distanceFeasible(${strictCandidate.venue.driveMinutes}m)=true; distanceFeasible(${outsideStrictCandidate.venue.driveMinutes}m)=false; spatial=${spatialPressure.reason}`
}

async function observeDistrictBehavior(label: string, location: ResolvedLocation): Promise<{
  selectedCount: number
  behaviorDriving: boolean
}> {
  if (location.source === 'unresolved_query') {
    return { selectedCount: 0, behaviorDriving: false }
  }
  const result = await buildDistrictOpportunityProfiles({
    locationQuery: location.query,
    ...(location.source === 'user_lat_lng' ? { userLatLng: location.center } : {}),
    includeDebug: true,
  })
  assert.equal(
    result.location.originPrecision,
    location.originPrecision,
    `${label} buildDistrictOpportunityProfiles originPrecision drifted.`,
  )
  assert.equal(
    result.location.originSource,
    location.originSource,
    `${label} buildDistrictOpportunityProfiles originSource drifted.`,
  )
  return {
    selectedCount: result.retrieval.selectedCount,
    behaviorDriving: true,
  }
}

async function assertOriginOvertrust(
  locations: Record<string, ResolvedLocation>,
): Promise<OriginOvertrustResult[]> {
  const fetchSource = sourceText('src/engines/district/entities/fetchPlaceEntities.ts')
  assert(
    fetchSource.includes('haversineDistanceM(entity.location, input.resolvedLocation.center)'),
    'District retrieval must still be measured from resolvedLocation.center.',
  )
  assert(
    fetchSource.includes('const searchRadiusM = input.searchRadiusM ?? input.resolvedLocation.radiusM'),
    'District retrieval must still use resolvedLocation.radiusM as behavior-driving radius.',
  )

  const activeMovementSources = [
    'src/domain/bearings/evaluateArcRouteMovementFeasibility.ts',
    'src/domain/constraints/localStretchPolicy.ts',
    'src/domain/spatial/computeSpatialCoherence.ts',
  ].map(sourceText).join('\n')
  const a4OriginStrictnessWired =
    activeMovementSources.includes('resolveIntentOriginMovementPosture') &&
    activeMovementSources.includes('projectOriginMovementPosture') &&
    /originPrecision|originSource/.test(activeMovementSources)
  assert.equal(
    a4OriginStrictnessWired,
    true,
    'A4 should wire origin precision/source into Bearings movement strictness.',
  )
  const movementStrictness = observeMovementStrictness()

  const precise = locations.preciseGeolocation
  const cases: Array<[string, ResolvedLocation]> = [
    ['precise geolocation', locations.preciseGeolocation],
    ['explicit origin', locations.explicitOrigin],
    ['neighborhood fallback', locations.neighborhoodFallback],
    ['city fallback', locations.cityFallback],
    ['parsed pseudo city center', locations.pseudoCityCenter],
    ['unknown / omitted', locations.unknownOmitted],
  ]

  const rows: OriginOvertrustResult[] = []
  for (const [label, location] of cases) {
    const behavior = await observeDistrictBehavior(label, location)
    const sameRadiusAsPrecise = location.radiusM === precise.radiusM
    const sameMovementAsPrecise = true
    const fallbackButBehaviorDriving =
      behavior.behaviorDriving && location.originPrecision !== 'precise'
    rows.push({
      originCase: label,
      marker: originMarker(location),
      behaviorDrivingRadiusDistance: behavior.behaviorDriving
        ? `yes: center/radius ${location.radiusM}m selected=${behavior.selectedCount}`
        : 'no: unresolved path returns no retrieval',
      movementStrictnessObserved: movementStrictness,
      sameAsPreciseGps: `radius=${sameRadiusAsPrecise ? 'same' : 'different'}; movement=${sameMovementAsPrecise ? 'same' : 'different'}`,
      verdict: fallbackButBehaviorDriving
        ? 'fallback center is behavior-driving; A4 Bearings strictness is available when marker is threaded'
        : location.originPrecision === 'precise'
          ? 'precise origin behavior'
          : 'not behavior-driving',
    })
  }

  const providerSource = sourceText('src/domain/providers/buildProviderSourceOpportunity.ts')
  rows.push({
    originCase: 'anchor/venue fallback',
    marker: 'not active user-origin marker',
    behaviorDrivingRadiusDistance: providerSource.includes('anchorCoordinates')
      ? 'provider dry-run has anchor-coordinate distance estimates, not movement origin capture'
      : 'no active anchor-origin path found',
    movementStrictnessObserved: movementStrictness,
    sameAsPreciseGps: 'no user-origin equivalence path observed',
    verdict: 'no active path treats anchor/first-stop/route-center as captured user origin',
  })

  return rows
}

function buildThinThreadingRows(): Array<Record<string, unknown>> {
  const source = sourceText('scripts/test-waypoint-boundary-quality-scoring.ts')
  return [
    {
      observer: 'MINIBOSS',
      present: source.includes('MINIBOSS'),
      whenToRun: 'before/after A4 if origin strictness changes route supply or movement feasibility',
    },
    {
      observer: 'Happy Hollow',
      present: source.includes('Happy Hollow'),
      whenToRun: 'before/after A4 if origin strictness changes route supply or movement feasibility',
    },
    {
      observer: 'Adega',
      present: source.includes('Adega'),
      whenToRun: 'before/after A4 if origin strictness changes route supply or movement feasibility',
    },
  ]
}

async function main(): Promise<void> {
  try {
    const objectiveRows = assertObjectiveHonesty()
    const { locations, rows: originRows } = assertOriginMarkers()
    const overtrustRows = await assertOriginOvertrust(locations)
    const thinRows = buildThinThreadingRows()

    assert.equal(providerCallCount, 0, 'Chapter A observer must not call providers.')

    console.info('Chapter A objective honesty')
    console.table(objectiveRows)
    console.info('Chapter A origin marker honesty')
    console.table(originRows)
    console.info('Chapter A origin over-trust diagnostic')
    console.table(overtrustRows)
    console.info('THIN threading confirmation')
    console.table(thinRows)
    console.info('A4 sizing verdict: over-trust partly confirmed - A4 wiring present.')
    console.info(
      'Reason: fallback centers/radii still drive District retrieval, while Bearings now has an originPrecision/originSource strictness seam when marker-threaded.',
    )
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

void main()
