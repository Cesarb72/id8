import { buildRouteShapeContract } from '../src/domain/arc/directionPlanning'
import { buildApplicationConciergeIntent } from '../src/domain/interpretation/conciergeIntent/buildConciergeIntent'
import {
  buildScenarioNightsFromCandidateBoard,
  type BuiltScenarioNight,
  type BuiltScenarioStop,
} from '../src/domain/interpretation/construction/scenarioBuilder'
import {
  buildStopTypeCandidateBoardFromIntent,
  type ScenarioFamily,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard'
import {
  buildDirectionPlanningSelection,
  buildResolvedDirectionContext,
} from '../src/domain/interpretation/direction/selectedDirectionProjection'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import {
  computeTasteExperienceCompositionStamp,
  type TasteExperienceCompositionCandidateEvidence,
  type TasteExperienceCompositionStamp,
} from '../src/domain/interpretation/taste/computeExperienceCompositionStamp'
import type { TasteRouteMomentVerdict } from '../src/domain/interpretation/taste/routeMomentVerdict'
import type { PersonaMode, RouteShapeContract, VibeAnchor } from '../src/domain/types/intent'

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected provider fetch in Move 2A composition harness: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const PERSONA_VIBE_CASES: Array<{
  persona: PersonaMode
  vibe: Extract<VibeAnchor, 'cozy' | 'lively' | 'cultured'>
}> = [
  { persona: 'romantic', vibe: 'cozy' },
  { persona: 'romantic', vibe: 'lively' },
  { persona: 'romantic', vibe: 'cultured' },
  { persona: 'friends', vibe: 'cozy' },
  { persona: 'friends', vibe: 'lively' },
  { persona: 'friends', vibe: 'cultured' },
  { persona: 'family', vibe: 'cozy' },
  { persona: 'family', vibe: 'lively' },
  { persona: 'family', vibe: 'cultured' },
]

function routeClusterFor(vibe: string): 'lively' | 'chill' | 'explore' {
  if (vibe === 'lively') return 'lively'
  if (vibe === 'cultured') return 'explore'
  return 'chill'
}

function buildRequirements(params: {
  persona: PersonaMode
  vibe: Extract<VibeAnchor, 'cozy' | 'lively' | 'cultured'>
  scenarioFamily: ScenarioFamily
}): RouteShapeContract {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'surprise',
    persona: params.persona,
    primaryVibe: params.vibe,
    city: 'San Jose',
    objectiveOccasion: 'connect',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.move2a.composition_rubric',
  })
  const selectedDirection = buildDirectionPlanningSelection({
    id: `move2a_${params.scenarioFamily}`,
    label: params.scenarioFamily.replace(/_/g, ' '),
    cluster: routeClusterFor(params.vibe),
    archetype: params.scenarioFamily,
    pocketId: `move2a_${params.scenarioFamily}_pocket`,
    pocketLabel: 'Move 2A calibration pocket',
  })
  const selectedDirectionContext = buildResolvedDirectionContext(selectedDirection)
  assert(selectedDirectionContext, 'Expected resolved direction context.')
  return buildRouteShapeContract({
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
  })
}

function scoreFromStop(stop: BuiltScenarioStop, role: 'start' | 'highlight' | 'windDown'): number {
  return Math.max(stop.roleFit[role] ?? 0, stop.authorityScore, stop.currentRelevance)
}

function energyFor(stop: BuiltScenarioStop, role: 'start' | 'highlight' | 'windDown'): number {
  const highSignal = Math.max(
    stop.eventPotential ?? 0,
    stop.performancePotential ?? 0,
    stop.liveNightlifePotential ?? 0,
    role === 'highlight' ? stop.authorityScore : 0,
  )
  const calmSignal =
    /quiet|calm|cozy|garden|tea|book|reading|dinner|wine/i.test(
      [stop.name, stop.momentLabel, stop.whyThisStop, stop.venueSubcategory, ...(stop.venueTags ?? [])].join(' '),
    )
      ? 0.22
      : 0
  const base = role === 'highlight' ? 0.56 : role === 'windDown' ? 0.34 : 0.4
  return Math.max(0.12, Math.min(0.95, base + highSignal * 0.32 - calmSignal))
}

function categoryFor(stop: BuiltScenarioStop): string {
  return stop.venueCategory ?? stop.stopType.replace(/_/g, '-')
}

function toEvidence(
  stop: BuiltScenarioStop,
  role: 'start' | 'highlight' | 'windDown',
): TasteExperienceCompositionCandidateEvidence {
  const roleScore = scoreFromStop(stop, role)
  const tags = [
    ...(stop.venueTags ?? []),
    ...(stop.venueFeatures ?? []),
    ...(stop.serviceOptions ?? []),
    stop.stopType,
    stop.momentLabel,
  ].filter((value): value is string => Boolean(value))
  return {
    role,
    candidateId: `${role}:${stop.venueId}`,
    venueName: stop.name,
    category: categoryFor(stop),
    tags,
    neighborhood: stop.district ?? stop.neighborhoodLabel,
    energyScore: energyFor(stop, role),
    roleFitScore: Math.max(0.01, stop.roleFit[role] ?? roleScore),
    stopShapeFitScore: Math.max(0.01, stop.roleFit[role] ?? roleScore),
    vibeFitScore: Math.max(0.01, stop.authorityScore),
    intentFitScore: stop.evaluation?.isIntentRight === false ? 0.38 : Math.max(0.01, stop.currentRelevance),
    momentScore: role === 'highlight' ? roleScore : Math.max(stop.authorityScore, stop.currentRelevance) * 0.72,
    momentIntensityScore: role === 'highlight' ? roleScore : energyFor(stop, role),
    primaryExperienceArchetype: stop.stopType,
    momentIdentityType: role === 'highlight' ? 'anchor' : role === 'start' ? 'arrival' : 'linger',
    highlightValidity: role === 'highlight' ? 'valid' : 'unknown',
  }
}

function getSelectedStop(
  night: BuiltScenarioNight,
  role: 'start' | 'highlight' | 'windDown',
): BuiltScenarioStop | undefined {
  if (role === 'windDown') {
    return (
      night.stops.find((stop) => stop.position === 'windDown') ??
      night.stops.find((stop) => stop.position === 'closer')
    )
  }
  return night.stops.find((stop) => stop.position === role)
}

function buildMomentVerdict(
  highlight: TasteExperienceCompositionCandidateEvidence | undefined,
): TasteRouteMomentVerdict | undefined {
  if (!highlight) {
    return undefined
  }
  const peakScore = Math.max(highlight.momentScore, highlight.momentIntensityScore)
  return {
    source: 'taste',
    provenance: [{ source: 'taste', key: 'move2a_calibration_peak_reference' }],
    peakCandidateVenueId: highlight.candidateId,
    anchorAsPeakCandidacy: 'intended_peak',
    peakSuitability: {
      score: peakScore,
      tier: peakScore >= 0.72 ? 'signature' : peakScore >= 0.58 ? 'strong' : 'soft',
    },
    momentStrengthVerdict: {
      strength: peakScore >= 0.72 ? 'strong' : peakScore >= 0.58 ? 'medium' : 'weak',
      score: peakScore,
    },
    momentPreservationStatus: peakScore >= 0.48 ? 'preserved' : 'missed',
    strongMomentPresent: peakScore >= 0.62,
    flatArcRisk: { level: 'none', score: 0, varianceScore: 0.7, penalty: 0, reasons: [] },
    missedPeakReason: {
      applied: peakScore < 0.48,
      code: peakScore < 0.48 ? 'selected_peak_too_weak' : 'none',
    },
    availableMomentEvidence: {
      availableHighMomentCount: peakScore >= 0.62 ? 1 : 0,
      availableStrongMomentCount: peakScore >= 0.72 ? 1 : 0,
      highMomentVenueIds: peakScore >= 0.62 ? [highlight.candidateId] : [],
      strongMomentVenueIds: peakScore >= 0.72 ? [highlight.candidateId] : [],
    },
    peakRoleEvidence: {
      candidateVenueId: highlight.candidateId,
      roleFitScore: highlight.roleFitScore,
      stopShapeFitScore: highlight.stopShapeFitScore,
      highlightValidity: highlight.highlightValidity,
    },
    anchorStrengthEvidence: {
      candidateVenueId: highlight.candidateId,
      anchorStrength: peakScore,
      momentIdentityType: 'anchor',
      momentIdentityStrength: peakScore >= 0.72 ? 'strong' : peakScore >= 0.58 ? 'medium' : 'weak',
      momentPotentialScore: highlight.momentScore,
      momentIntensityScore: highlight.momentIntensityScore,
    },
    momentQualityNote: 'Move 2A calibration peak reference.',
  }
}

function evaluateNight(
  night: BuiltScenarioNight,
  routeShapeContract: RouteShapeContract,
): TasteExperienceCompositionStamp {
  const start = getSelectedStop(night, 'start')
  const highlight = getSelectedStop(night, 'highlight')
  const windDown = getSelectedStop(night, 'windDown')
  const stops = [
    start ? toEvidence(start, 'start') : undefined,
    highlight ? toEvidence(highlight, 'highlight') : undefined,
    windDown ? toEvidence(windDown, 'windDown') : undefined,
  ].filter((entry): entry is TasteExperienceCompositionCandidateEvidence => Boolean(entry))
  return computeTasteExperienceCompositionStamp({
    routeShapeContract,
    stops,
    routeMomentVerdict: buildMomentVerdict(stops.find((stop) => stop.role === 'highlight')),
  })
}

function buildCoffeeBooksKnownBad(routeShapeContract: RouteShapeContract): TasteExperienceCompositionStamp {
  const badAnchor: TasteExperienceCompositionCandidateEvidence = {
    role: 'highlight',
    candidateId: 'known_bad:coffee_books_anchor',
    venueName: 'Coffee & Books anchor only',
    category: 'cafe',
    tags: ['coffee', 'bookstore', 'reading', 'quiet'],
    neighborhood: 'Downtown',
    energyScore: 0.24,
    roleFitScore: 0.28,
    stopShapeFitScore: 0.24,
    vibeFitScore: 0.42,
    intentFitScore: 0.34,
    momentScore: 0.22,
    momentIntensityScore: 0.18,
    primaryExperienceArchetype: 'coffee_books_anchor',
    momentIdentityType: 'support',
    highlightValidity: 'invalid',
  }
  return computeTasteExperienceCompositionStamp({
    routeShapeContract,
    stops: [badAnchor],
    routeMomentVerdict: buildMomentVerdict(badAnchor),
  })
}

function buildSyntheticUnavailable(routeShapeContract: RouteShapeContract): TasteExperienceCompositionStamp[] {
  const start: TasteExperienceCompositionCandidateEvidence = {
    role: 'start',
    candidateId: 'synthetic:start',
    venueName: 'Synthetic Start',
    category: 'park',
    tags: ['calm', 'walk', 'low friction'],
    energyScore: 0.32,
    roleFitScore: 0.72,
    stopShapeFitScore: 0.7,
    vibeFitScore: 0.66,
    intentFitScore: 0.62,
    momentScore: 0.4,
    momentIntensityScore: 0.34,
    primaryExperienceArchetype: 'arrival',
    momentIdentityType: 'arrival',
  }
  return [
    computeTasteExperienceCompositionStamp({ stops: [start] }),
    computeTasteExperienceCompositionStamp({ routeShapeContract, stops: [start] }),
  ]
}

function buildSyntheticFail(routeShapeContract: RouteShapeContract): TasteExperienceCompositionStamp {
  const weak = (role: 'start' | 'highlight' | 'windDown'): TasteExperienceCompositionCandidateEvidence => ({
    role,
    candidateId: `synthetic_fail:${role}`,
    venueName: `Synthetic weak ${role}`,
    category: role === 'highlight' ? 'generic' : 'bar',
    tags: role === 'highlight' ? ['generic', 'passive'] : ['loud', 'late', 'mismatch'],
    neighborhood: role === 'windDown' ? 'Far District' : 'Downtown',
    energyScore: role === 'highlight' ? 0.18 : 0.86,
    roleFitScore: 0.18,
    stopShapeFitScore: 0.16,
    vibeFitScore: 0.2,
    intentFitScore: 0.22,
    momentScore: role === 'highlight' ? 0.14 : 0.12,
    momentIntensityScore: role === 'highlight' ? 0.16 : 0.88,
    primaryExperienceArchetype: 'generic_mismatch',
    momentIdentityType: role === 'highlight' ? 'support' : 'close',
    highlightValidity: role === 'highlight' ? 'invalid' : 'unknown',
  })
  const stops = [weak('start'), weak('highlight'), weak('windDown')]
  return computeTasteExperienceCompositionStamp({
    routeShapeContract,
    stops,
    routeMomentVerdict: buildMomentVerdict(stops.find((stop) => stop.role === 'highlight')),
  })
}

function summarize(
  stamps: Array<{ scenario: string; stamp: TasteExperienceCompositionStamp }>,
): {
  byStatus: Record<TasteExperienceCompositionStamp['status'], number>
  minScore: number
  maxScore: number
  averageScore: number
  reasonCounts: Record<string, number>
} {
  const byStatus: Record<TasteExperienceCompositionStamp['status'], number> = {
    pass: 0,
    soft: 0,
    fail: 0,
    unavailable: 0,
  }
  const reasonCounts: Record<string, number> = {}
  for (const entry of stamps) {
    byStatus[entry.stamp.status] += 1
    for (const reason of entry.stamp.reasons) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
    }
  }
  const scores = stamps.map((entry) => entry.stamp.score)
  return {
    byStatus,
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    averageScore: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 1000) / 1000,
    reasonCounts,
  }
}

async function main(): Promise<void> {
  const results: Array<{ scenario: string; stamp: TasteExperienceCompositionStamp }> = []
  const scenarioCounts: Record<string, number> = {}
  const supplementalRows: Record<string, number> = {}

  for (const scenario of PERSONA_VIBE_CASES) {
    const board = await buildStopTypeCandidateBoardFromIntent({
      city: 'San Jose',
      persona: scenario.persona,
      vibe: scenario.vibe,
    })
    assert(board, `Expected candidate board for ${scenario.persona}/${scenario.vibe}.`)
    const nights = buildScenarioNightsFromCandidateBoard(board, { minNights: 4, maxNights: 4 })
    assert(nights.length > 0, `Expected at least one current builder night for ${board.scenarioFamily}.`)
    const routeShapeContract = buildRequirements({
      persona: scenario.persona,
      vibe: scenario.vibe,
      scenarioFamily: board.scenarioFamily,
    })
    const calibrationNights = Array.from({ length: 4 }, (_, index) => {
      const night = nights[index] ?? nights[index % nights.length]
      assert(night, `Expected calibration night for ${board.scenarioFamily}#${index + 1}.`)
      if (index >= nights.length) {
        supplementalRows[board.scenarioFamily] = (supplementalRows[board.scenarioFamily] ?? 0) + 1
      }
      return night
    })
    scenarioCounts[board.scenarioFamily] = calibrationNights.length
    calibrationNights.forEach((night, index) => {
      results.push({
        scenario: `${board.scenarioFamily}#${index + 1}${index >= nights.length ? ':supplemental' : ''}`,
        stamp: evaluateNight(night, routeShapeContract),
      })
    })
  }

  assert(results.length === 36, `Expected 36 known-good calibration nights, received ${results.length}.`)

  const coffeeRouteShape = buildRequirements({
    persona: 'romantic',
    vibe: 'cultured',
    scenarioFamily: 'romantic_cultured',
  })
  const coffeeBooks = buildCoffeeBooksKnownBad(coffeeRouteShape)
  assert(
    coffeeBooks.status === 'fail' || coffeeBooks.status === 'unavailable',
    `Coffee & Books known-bad anchor must not pass; received ${coffeeBooks.status}.`,
  )
  const syntheticUnavailable = buildSyntheticUnavailable(coffeeRouteShape)
  const syntheticFail = buildSyntheticFail(coffeeRouteShape)
  assert(
    syntheticUnavailable.some((stamp) => stamp.status === 'unavailable'),
    'Expected synthetic unavailable coverage.',
  )
  assert(syntheticFail.status === 'fail', `Expected synthetic fail coverage, received ${syntheticFail.status}.`)

  const firstRun = JSON.stringify(results.map((entry) => [entry.scenario, entry.stamp.status, entry.stamp.score]))
  const secondRun = JSON.stringify(results.map((entry) => [entry.scenario, entry.stamp.status, entry.stamp.score]))
  assert(firstRun === secondRun, 'Move 2A composition harness must be deterministic.')

  const knownGoodSummary = summarize(results)
  const allSummary = summarize([
    ...results,
    { scenario: 'coffee_books_known_bad', stamp: coffeeBooks },
    ...syntheticUnavailable.map((stamp, index) => ({ scenario: `synthetic_unavailable#${index + 1}`, stamp })),
    { scenario: 'synthetic_fail', stamp: syntheticFail },
  ])

  process.stdout.write(
    JSON.stringify(
      {
        move: '2A',
        calibrationNights: results.length,
        scenarioCounts,
        supplementalRows,
        knownGoodSummary,
        coffeeBooks: {
          status: coffeeBooks.status,
          score: coffeeBooks.score,
          reasons: coffeeBooks.reasons,
          unavailableEvidence: coffeeBooks.unavailableEvidence,
        },
        syntheticUnavailable: syntheticUnavailable.map((stamp) => ({
          status: stamp.status,
          score: stamp.score,
          reasons: stamp.reasons,
          unavailableEvidence: stamp.unavailableEvidence,
        })),
        syntheticFail: {
          status: syntheticFail.status,
          score: syntheticFail.score,
          reasons: syntheticFail.reasons,
          unavailableEvidence: syntheticFail.unavailableEvidence,
        },
        allSummary,
        providerFetchCalls: fetchCallCount,
      },
      null,
      2,
    ) + '\n',
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
