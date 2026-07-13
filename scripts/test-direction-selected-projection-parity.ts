import { isDeepStrictEqual } from 'node:util'
import {
  buildDirectionPlanningSelection as buildArcDirectionPlanningSelection,
  buildIntentSelectedDirectionContext as buildArcIntentSelectedDirectionContext,
  buildResolvedDirectionContext as buildArcResolvedDirectionContext,
} from '../src/domain/arc/directionPlanning.ts'
import {
  buildDirectionPlanningSelection,
  buildIntentSelectedDirectionContext,
  buildResolvedDirectionContext,
  type BuildDirectionPlanningSelectionInput,
} from '../src/domain/interpretation/direction/selectedDirectionProjection.ts'
import type { GreatStopDownstreamSignal } from '../src/domain/types/intent.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`)
  }
}

const greatStopSignal: GreatStopDownstreamSignal = {
  source: 'scenario_great_stop',
  available: true,
  passesNight: true,
  totalStopCount: 3,
  failedStopCount: 0,
  severeFailureCount: 0,
  failedCriteriaCounts: {
    real: 0,
    role_right: 0,
    intent_right: 0,
    place_right: 0,
    moment_right: 0,
  },
  severeCriteriaCounts: {
    real: 0,
    place_right: 0,
    moment_right: 0,
  },
  riskTier: 'none',
  suppressionRecommended: false,
  degradedConfidencePenalty: 0,
  reasonCodes: [],
  notes: [],
}

const fixtures: BuildDirectionPlanningSelectionInput[] = [
  {
    id: 'lively-social-night',
    label: 'Lively Social Night',
    pocketId: 'downtown-core',
    pocketLabel: 'Downtown Core',
    archetype: 'cocktail crawl',
    cluster: 'lively',
    experienceFamily: 'social',
    familyConfidence: 0.91,
    subtitle: 'high-energy bars and music',
    laneIdentity: 'social',
    macroLane: 'nightlife',
    greatStopSignal,
  },
  {
    id: 'quiet-courtyard-date',
    label: 'Quiet Courtyard Date',
    archetype: 'wine and dessert',
    cluster: 'chill',
    experienceFamily: 'intimate',
    familyConfidence: 0.84,
    subtitle: 'cozy romantic places',
    laneIdentity: 'intimate',
  },
  {
    id: 'curated-culture-walk',
    label: 'Curated Culture Walk',
    pocketId: 'sofa-district',
    pocketLabel: 'SoFA District',
    archetype: 'gallery ritual',
    cluster: 'explore',
    experienceFamily: 'cultural',
    familyConfidence: 0.76,
    macroLane: 'explore',
  },
]

for (const fixture of fixtures) {
  const directionSelection = buildDirectionPlanningSelection(fixture)
  const arcSelection = buildArcDirectionPlanningSelection(fixture)
  assertDeepEqual(
    directionSelection,
    arcSelection,
    `Selected-direction projection drifted for ${fixture.id}`,
  )
  assert(directionSelection.id === arcSelection.id, `Selected direction id drifted for ${fixture.id}`)
  assert(
    directionSelection.identity === arcSelection.identity,
    `Direction identity drifted for ${fixture.id}`,
  )

  const directionIntentContext = buildIntentSelectedDirectionContext(directionSelection)
  const arcIntentContext = buildArcIntentSelectedDirectionContext(arcSelection)
  assertDeepEqual(
    directionIntentContext,
    arcIntentContext,
    `Intent selected-direction context drifted for ${fixture.id}`,
  )

  const directionResolvedContext = buildResolvedDirectionContext(directionSelection)
  const arcResolvedContext = buildArcResolvedDirectionContext(arcSelection)
  assertDeepEqual(
    directionResolvedContext,
    arcResolvedContext,
    `Resolved direction context drifted for ${fixture.id}`,
  )
}

assertDeepEqual(
  buildIntentSelectedDirectionContext(undefined),
  buildArcIntentSelectedDirectionContext(undefined),
  'Undefined intent selected-direction context drifted',
)
assertDeepEqual(
  buildResolvedDirectionContext(undefined),
  buildArcResolvedDirectionContext(undefined),
  'Undefined resolved direction context drifted',
)

console.log('[direction-selected-projection-parity] PASS')
console.log('[direction-selected-projection-parity] provider/network calls: 0')
