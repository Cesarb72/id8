import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
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

const EVIDENCE_JSON_PATH = 'diagnostics/move-2b-0b/current-composition-evidence.json'
const FOUNDER_REVIEW_INDEX_PATH = 'diagnostics/move-2b-0b/founder-review-index.md'
const WRITE_EVIDENCE = process.argv.includes('--write-evidence')

type CoreRouteRole = 'start' | 'highlight' | 'windDown'

interface StopIdentityDiagnostic {
  role: CoreRouteRole | 'wildcard'
  position: string
  venueId: string
  name: string
  stopType: string
  category?: string
  district?: string
  neighborhood?: string
  authorityScore: number
  currentRelevance: number
}

interface CompositionEvaluationRowDiagnostic {
  rowId: string
  generationRunId: string
  scenario: string
  scenarioFamily: ScenarioFamily
  persona: PersonaMode
  vibe: Extract<VibeAnchor, 'cozy' | 'lively' | 'cultured'>
  mode: 'scenario-harness'
  location: 'San Jose'
  sourceLayer: 'interpretation_scenario_builder'
  provenance: {
    kind: 'produced' | 'supplemental'
    generatedNightIndex: number
    sourceRowId: string | null
    reason: string
  }
  route: {
    fingerprint: string
    complete: boolean
    start: StopIdentityDiagnostic | null
    highlight: StopIdentityDiagnostic | null
    windDown: StopIdentityDiagnostic | null
    wildcardStops: StopIdentityDiagnostic[]
    allStops: StopIdentityDiagnostic[]
  }
  requirements: {
    routeShapeContractId?: string
    intendedPersonaVibeShape: {
      persona: PersonaMode
      vibe: Extract<VibeAnchor, 'cozy' | 'lively' | 'cultured'>
      scenarioFamily: ScenarioFamily
    }
    startContribution?: unknown
    highlightContribution?: unknown
    windDownContribution?: unknown
    openerPeakRelationship?: unknown
    retainedPeakCondition: string
    peakResolutionRelationship?: unknown
    unavailable: string[]
  }
  assessmentEvidence: {
    stopEvidence: TasteExperienceCompositionCandidateEvidence[]
    stamp: TasteExperienceCompositionStamp
    classificationFloor: {
      tolerance: 'strict' | 'balanced' | 'flexible'
      passFloor: number
      softFloor: number
      marginFromPassFloor: number
      marginFromSoftFloor: number
    }
    nonPassAssessments: string[]
    nonPassDimensions: Array<{
      owner: string
      dimension: string
      status: string
      score: number
      reasons: string[]
    }>
    wildcard: {
      present: boolean
      count: number
      effect: 'none' | 'single_wildcard_softens_pass' | 'multiple_wildcards_force_fail'
      candidateIds: string[]
    }
    missingEvidence: {
      present: boolean
      unavailableEvidence: string[]
      effect: 'none' | 'status_unavailable_or_subassessment_unavailable'
    }
    evaluatorVersion: 'taste.experience_composition.v0_1'
  }
}

interface HistoricalComparisonRouteDiagnostic {
  historicalId: string
  label: 'HISTORICAL ROMANTIC COMPARISON - NOT CORPUS-ADMITTED'
  commit: 'fed6a60'
  scenarioFamily: 'romantic_cozy' | 'romantic_lively' | 'romantic_cultured'
  historicalName: string
  historicalGreatStopPass: boolean
  historicalFailedStops: string
  start: string
  highlight: string
  windDown: string
  currentProjectionStatus: 'not_evaluable_missing_current_candidate_evidence'
  unavailableFields: string[]
  founderInspectionSufficient: false
}

function roundDiagnostic(value: number): number {
  return Math.round(value * 1000) / 1000
}

function statusFloors(tolerance: 'strict' | 'balanced' | 'flexible'): {
  passFloor: number
  softFloor: number
} {
  if (tolerance === 'strict') {
    return { passFloor: 0.72, softFloor: 0.56 }
  }
  if (tolerance === 'flexible') {
    return { passFloor: 0.62, softFloor: 0.42 }
  }
  return { passFloor: 0.66, softFloor: 0.48 }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableSerialization(value), null, 2) + '\n'
}

function sortForStableSerialization(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortForStableSerialization(entry))
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortForStableSerialization(record[key])
        return sorted
      }, {})
  }
  return value
}

function writeStableJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stableStringify(value), 'utf8')
}

function stopIdentity(
  stop: BuiltScenarioStop | undefined,
  role: CoreRouteRole | 'wildcard',
): StopIdentityDiagnostic | null {
  if (!stop) {
    return null
  }
  return {
    role,
    position: stop.position,
    venueId: stop.venueId,
    name: stop.name,
    stopType: stop.stopType,
    category: stop.venueCategory,
    district: stop.district,
    neighborhood: stop.neighborhoodLabel,
    authorityScore: roundDiagnostic(stop.authorityScore),
    currentRelevance: roundDiagnostic(stop.currentRelevance),
  }
}

function routeFingerprint(params: {
  scenarioFamily: ScenarioFamily
  start?: BuiltScenarioStop
  highlight?: BuiltScenarioStop
  windDown?: BuiltScenarioStop
  wildcardStops: BuiltScenarioStop[]
}): string {
  const wildcardPart =
    params.wildcardStops.length > 0
      ? `|wildcard=${params.wildcardStops.map((stop) => stop.venueId).join(',')}`
      : ''
  return [
    `scenario=${params.scenarioFamily}`,
    `start=${params.start?.venueId ?? 'missing'}`,
    `highlight=${params.highlight?.venueId ?? 'missing'}`,
    `windDown=${params.windDown?.venueId ?? 'missing'}`,
  ].join('|') + wildcardPart
}

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

function stopEvidenceForNight(night: BuiltScenarioNight): TasteExperienceCompositionCandidateEvidence[] {
  const start = getSelectedStop(night, 'start')
  const highlight = getSelectedStop(night, 'highlight')
  const windDown = getSelectedStop(night, 'windDown')
  return [
    start ? toEvidence(start, 'start') : undefined,
    highlight ? toEvidence(highlight, 'highlight') : undefined,
    windDown ? toEvidence(windDown, 'windDown') : undefined,
  ].filter((entry): entry is TasteExperienceCompositionCandidateEvidence => Boolean(entry))
}

function nonPassAssessments(stamp: TasteExperienceCompositionStamp): string[] {
  return [
    ['startContribution', stamp.startContribution.status],
    ['highlightContribution', stamp.highlightContribution.status],
    ['windDownContribution', stamp.windDownContribution.status],
    ['startPreparesHighlight', stamp.startPreparesHighlight.status],
    ['windDownResolvesHighlight', stamp.windDownResolvesHighlight.status],
    ['peakEvidenceReference', stamp.peakEvidenceReference.status],
  ]
    .filter(([, status]) => status !== 'pass')
    .map(([name, status]) => `${name}:${status}`)
}

function nonPassDimensions(
  stamp: TasteExperienceCompositionStamp,
): CompositionEvaluationRowDiagnostic['assessmentEvidence']['nonPassDimensions'] {
  return [
    ...stamp.startContribution.dimensions.map((dimension) => ({
      owner: 'startContribution',
      ...dimension,
    })),
    ...stamp.highlightContribution.dimensions.map((dimension) => ({
      owner: 'highlightContribution',
      ...dimension,
    })),
    ...stamp.windDownContribution.dimensions.map((dimension) => ({
      owner: 'windDownContribution',
      ...dimension,
    })),
    ...stamp.startPreparesHighlight.dimensions.map((dimension) => ({
      owner: 'startPreparesHighlight',
      ...dimension,
    })),
    ...stamp.windDownResolvesHighlight.dimensions.map((dimension) => ({
      owner: 'windDownResolvesHighlight',
      ...dimension,
    })),
  ]
    .filter((dimension) => dimension.status !== 'pass')
    .map((dimension) => ({
      owner: dimension.owner,
      dimension: dimension.dimension,
      status: dimension.status,
      score: dimension.score,
      reasons: [...dimension.reasons],
    }))
}

function wildcardEffect(stamp: TasteExperienceCompositionStamp): 'none' | 'single_wildcard_softens_pass' | 'multiple_wildcards_force_fail' {
  if (stamp.wildcard.candidateIds.length > 1) {
    return 'multiple_wildcards_force_fail'
  }
  if (stamp.wildcard.candidateIds.length === 1) {
    return 'single_wildcard_softens_pass'
  }
  return 'none'
}

function rowDiagnostic(params: {
  generationRunId: string
  scenarioFamily: ScenarioFamily
  persona: PersonaMode
  vibe: Extract<VibeAnchor, 'cozy' | 'lively' | 'cultured'>
  night: BuiltScenarioNight
  routeShapeContract: RouteShapeContract
  generatedNightIndex: number
  sourceRowId: string | null
  producedNightCount: number
}): CompositionEvaluationRowDiagnostic {
  const rowNumber = params.generatedNightIndex + 1
  const provenanceKind = params.sourceRowId ? 'supplemental' : 'produced'
  const rowId = `move2b0b-current-${params.scenarioFamily}-${String(rowNumber).padStart(2, '0')}`
  const start = getSelectedStop(params.night, 'start')
  const highlight = getSelectedStop(params.night, 'highlight')
  const windDown = getSelectedStop(params.night, 'windDown')
  const wildcardStops = params.night.stops.filter((stop) => stop.position === 'wildcard')
  const stopEvidence = stopEvidenceForNight(params.night)
  const routeMomentVerdict = buildMomentVerdict(stopEvidence.find((stop) => stop.role === 'highlight'))
  const stamp = computeTasteExperienceCompositionStamp({
    routeShapeContract: params.routeShapeContract,
    stops: stopEvidence,
    routeMomentVerdict,
  })
  const tolerance =
    params.routeShapeContract.roleProfile.highlight.compositionRequirement?.tolerance ?? 'balanced'
  const floors = statusFloors(tolerance)
  return {
    rowId,
    generationRunId: params.generationRunId,
    scenario: `${params.scenarioFamily}#${rowNumber}${params.sourceRowId ? ':supplemental' : ''}`,
    scenarioFamily: params.scenarioFamily,
    persona: params.persona,
    vibe: params.vibe,
    mode: 'scenario-harness',
    location: 'San Jose',
    sourceLayer: 'interpretation_scenario_builder',
    provenance: {
      kind: provenanceKind,
      generatedNightIndex: rowNumber,
      sourceRowId: params.sourceRowId,
      reason: params.sourceRowId
        ? `Existing harness repeats source row because current builder produced ${params.producedNightCount} night(s), fewer than four.`
        : 'Current scenario builder produced this row directly.',
    },
    route: {
      fingerprint: routeFingerprint({
        scenarioFamily: params.scenarioFamily,
        start,
        highlight,
        windDown,
        wildcardStops,
      }),
      complete: Boolean(start && highlight && windDown),
      start: stopIdentity(start, 'start'),
      highlight: stopIdentity(highlight, 'highlight'),
      windDown: stopIdentity(windDown, 'windDown'),
      wildcardStops: wildcardStops
        .map((stop) => stopIdentity(stop, 'wildcard'))
        .filter((entry): entry is StopIdentityDiagnostic => Boolean(entry)),
      allStops: params.night.stops
        .map((stop) =>
          stopIdentity(
            stop,
            stop.position === 'start' || stop.position === 'highlight' || stop.position === 'windDown'
              ? stop.position
              : 'wildcard',
          ),
        )
        .filter((entry): entry is StopIdentityDiagnostic => Boolean(entry)),
    },
    requirements: {
      routeShapeContractId: params.routeShapeContract.id,
      intendedPersonaVibeShape: {
        persona: params.persona,
        vibe: params.vibe,
        scenarioFamily: params.scenarioFamily,
      },
      startContribution: params.routeShapeContract.roleProfile.start.compositionRequirement,
      highlightContribution: params.routeShapeContract.roleProfile.highlight.compositionRequirement,
      windDownContribution: params.routeShapeContract.roleProfile.windDown.compositionRequirement,
      openerPeakRelationship:
        params.routeShapeContract.roleProfile.start.compositionRequirement?.relationship,
      retainedPeakCondition: routeMomentVerdict ? 'taste_route_moment_verdict_retained' : 'unavailable',
      peakResolutionRelationship:
        params.routeShapeContract.roleProfile.windDown.compositionRequirement?.relationship,
      unavailable: [
        params.routeShapeContract.roleProfile.start.compositionRequirement ? undefined : 'start_requirement',
        params.routeShapeContract.roleProfile.highlight.compositionRequirement ? undefined : 'highlight_requirement',
        params.routeShapeContract.roleProfile.windDown.compositionRequirement ? undefined : 'windDown_requirement',
        routeMomentVerdict ? undefined : 'route_moment_verdict',
      ].filter((entry): entry is string => Boolean(entry)),
    },
    assessmentEvidence: {
      stopEvidence,
      stamp,
      classificationFloor: {
        tolerance,
        passFloor: floors.passFloor,
        softFloor: floors.softFloor,
        marginFromPassFloor: roundDiagnostic(stamp.score - floors.passFloor),
        marginFromSoftFloor: roundDiagnostic(stamp.score - floors.softFloor),
      },
      nonPassAssessments: nonPassAssessments(stamp),
      nonPassDimensions: nonPassDimensions(stamp),
      wildcard: {
        present: stamp.wildcard.present,
        count: stamp.wildcard.candidateIds.length,
        effect: wildcardEffect(stamp),
        candidateIds: [...stamp.wildcard.candidateIds],
      },
      missingEvidence: {
        present: stamp.unavailableEvidence.length > 0,
        unavailableEvidence: [...stamp.unavailableEvidence],
        effect:
          stamp.unavailableEvidence.length > 0
            ? 'status_unavailable_or_subassessment_unavailable'
            : 'none',
      },
      evaluatorVersion: 'taste.experience_composition.v0_1',
    },
  }
}

async function buildCurrentRows(generationRunId: string): Promise<{
  rows: CompositionEvaluationRowDiagnostic[]
  scenarioCounts: Record<string, number>
  supplementalRows: Record<string, number>
  producedRowCounts: Record<string, number>
}> {
  const rows: CompositionEvaluationRowDiagnostic[] = []
  const scenarioCounts: Record<string, number> = {}
  const supplementalRows: Record<string, number> = {}
  const producedRowCounts: Record<string, number> = {}

  for (const scenario of PERSONA_VIBE_CASES) {
    const board = await buildStopTypeCandidateBoardFromIntent({
      city: 'San Jose',
      persona: scenario.persona,
      vibe: scenario.vibe,
    })
    assert(board, `Expected candidate board for ${scenario.persona}/${scenario.vibe}.`)
    const nights = buildScenarioNightsFromCandidateBoard(board, { minNights: 4, maxNights: 4 })
    assert(nights.length > 0, `Expected at least one current builder night for ${board.scenarioFamily}.`)
    producedRowCounts[board.scenarioFamily] = nights.length
    const routeShapeContract = buildRequirements({
      persona: scenario.persona,
      vibe: scenario.vibe,
      scenarioFamily: board.scenarioFamily,
    })
    for (let index = 0; index < 4; index += 1) {
      const sourceIndex = index < nights.length ? index : index % nights.length
      const night = nights[sourceIndex]
      assert(night, `Expected calibration night for ${board.scenarioFamily}#${index + 1}.`)
      const sourceRowId =
        index >= nights.length
          ? `move2b0b-current-${board.scenarioFamily}-${String(sourceIndex + 1).padStart(2, '0')}`
          : null
      if (sourceRowId) {
        supplementalRows[board.scenarioFamily] = (supplementalRows[board.scenarioFamily] ?? 0) + 1
      }
      rows.push(
        rowDiagnostic({
          generationRunId,
          scenarioFamily: board.scenarioFamily,
          persona: scenario.persona,
          vibe: scenario.vibe,
          night,
          routeShapeContract,
          generatedNightIndex: index,
          sourceRowId,
          producedNightCount: nights.length,
        }),
      )
    }
    scenarioCounts[board.scenarioFamily] = 4
  }

  return { rows, scenarioCounts, supplementalRows, producedRowCounts }
}

function historicalComparisonRoutes(): HistoricalComparisonRouteDiagnostic[] {
  const missing = [
    'current BuiltScenarioStop roleFit payload',
    'current evaluator candidate evidence',
    'current route moment verdict input',
    'current RouteShapeContract projection inputs',
  ]
  return [
    ['hist-romantic-cozy-01', 'romantic_cozy', 'Evening at Preserve Botanical Studio', true, 'none', 'Hakone Gardens', 'Preserve Botanical Studio', 'Lincoln Avenue Pasta Room'],
    ['hist-romantic-cozy-02', 'romantic_cozy', 'Evening at Rose Garden sunset promenade', true, 'none', 'Jacques Plaza Courtyard', 'Rose Garden sunset promenade', 'La Foret'],
    ['hist-romantic-cozy-03', 'romantic_cozy', 'Evening at Hakone Gardens', true, 'none', 'Bramhall Park Promenade', 'Hakone Gardens', 'La Foret'],
    ['hist-romantic-cozy-04', 'romantic_cozy', 'Evening at Japanese Friendship Garden', false, 'moment-rose-garden-sunset-promenade, sj-japanese-friendship-garden, moment-adega-regional-flight-window', 'Rose Garden sunset promenade', 'Japanese Friendship Garden', 'Adega regional flight window'],
    ['hist-romantic-lively-01', 'romantic_lively', 'Evening at Theatre District Jazz Cellar', true, 'none', 'Downtown Listening Room', 'Theatre District Jazz Cellar', 'Hedley Club Lounge'],
    ['hist-romantic-lively-02', 'romantic_lively', 'Evening at Riverwalk indie showcase', true, 'none', 'Jtown Sake Corner', 'Riverwalk indie showcase', 'Hidden Courtyard Cocktail Bar'],
    ['hist-romantic-lively-03', 'romantic_lively', 'Evening at Opera San Jose', false, 'moment-riverwalk-indie-showcase', 'Willow Court Wine Bar', 'Opera San Jose', 'Hidden Courtyard Cocktail Bar'],
    ['hist-romantic-lively-04', 'romantic_lively', 'Evening at Downtown Listening Room', false, 'sj-hedley-club-lounge, sj-river-oaks-concert, sj-downtown-listening-room, sj-willow-court-wine-bar, sj-jtown-santo-market-counter', 'Hedley Club Lounge', 'Downtown Listening Room', 'Willow Court Wine Bar'],
    ['hist-romantic-cultured-01', 'romantic_cultured', 'Evening at La Foret', true, 'none', 'Rosicrucian twilight walk', 'La Foret', 'Opera San Jose'],
    ['hist-romantic-cultured-02', 'romantic_cultured', 'Evening at Adega regional flight window', false, 'moment-riverwalk-indie-showcase', 'Camera obscura blue-hour loop', 'Adega regional flight window', 'Riverwalk indie showcase'],
    ['hist-romantic-cultured-03', 'romantic_cultured', 'Evening at Lincoln Avenue Pasta Room', false, 'moment-sofa-jazz-alley-set', 'Japanese American Gallery SJ', 'Lincoln Avenue Pasta Room', 'Hammer Theatre'],
    ['hist-romantic-cultured-04', 'romantic_cultured', 'Evening at La Foret', false, 'sj-jtown-jamsj-gallery, sj-japanese-friendship-garden, sj-la-foret, moment-riverwalk-indie-showcase, sj-willow-court-wine-bar', 'Japanese American Gallery SJ', 'La Foret', 'Riverwalk indie showcase'],
  ].map(
    ([
      historicalId,
      scenarioFamily,
      historicalName,
      historicalGreatStopPass,
      historicalFailedStops,
      start,
      highlight,
      windDown,
    ]) => ({
      historicalId: historicalId as string,
      label: 'HISTORICAL ROMANTIC COMPARISON - NOT CORPUS-ADMITTED',
      commit: 'fed6a60',
      scenarioFamily: scenarioFamily as HistoricalComparisonRouteDiagnostic['scenarioFamily'],
      historicalName: historicalName as string,
      historicalGreatStopPass: Boolean(historicalGreatStopPass),
      historicalFailedStops: historicalFailedStops as string,
      start: start as string,
      highlight: highlight as string,
      windDown: windDown as string,
      currentProjectionStatus: 'not_evaluable_missing_current_candidate_evidence',
      unavailableFields: missing,
      founderInspectionSufficient: false,
    }),
  )
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

function summarizeRows(rows: CompositionEvaluationRowDiagnostic[]): {
  byStatus: Record<TasteExperienceCompositionStamp['status'], number>
  producedCount: number
  supplementalCount: number
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
  for (const row of rows) {
    byStatus[row.assessmentEvidence.stamp.status] += 1
    for (const reason of row.assessmentEvidence.stamp.reasons) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
    }
  }
  const scores = rows.map((row) => row.assessmentEvidence.stamp.score)
  return {
    byStatus,
    producedCount: rows.filter((row) => row.provenance.kind === 'produced').length,
    supplementalCount: rows.filter((row) => row.provenance.kind === 'supplemental').length,
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    averageScore: roundDiagnostic(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    reasonCounts,
  }
}

function determinismComparableRows(
  rows: CompositionEvaluationRowDiagnostic[],
): Array<Omit<CompositionEvaluationRowDiagnostic, 'generationRunId'>> {
  return rows.map(({ generationRunId: _generationRunId, ...row }) => row)
}

function buildReviewMarkdown(params: {
  rows: CompositionEvaluationRowDiagnostic[]
  summary: ReturnType<typeof summarizeRows>
  determinismPassed: boolean
}): string {
  const softRows = params.rows.filter((row) => row.assessmentEvidence.stamp.status === 'soft')
  const passRows = params.rows.filter((row) => row.assessmentEvidence.stamp.status === 'pass')
  const lowMarginPasses = [...passRows]
    .sort(
      (left, right) =>
        left.assessmentEvidence.classificationFloor.marginFromPassFloor -
        right.assessmentEvidence.classificationFloor.marginFromPassFloor,
    )
    .slice(0, 6)
  const highMarginPasses = [...passRows]
    .sort(
      (left, right) =>
        right.assessmentEvidence.classificationFloor.marginFromPassFloor -
        left.assessmentEvidence.classificationFloor.marginFromPassFloor,
    )
    .slice(0, 6)
  const representativePassIds = [
    ...new Set([
      ...lowMarginPasses.map((row) => row.rowId),
      ...highMarginPasses.map((row) => row.rowId),
      ...PERSONA_VIBE_CASES.flatMap((caseEntry) => {
        const family = `${caseEntry.persona}_${caseEntry.vibe}` as ScenarioFamily
        return passRows.find((row) => row.scenarioFamily === family)?.rowId ?? []
      }),
    ]),
  ]

  const softDetails = softRows
    .map((row) => {
      const route = `${row.route.start?.name ?? 'missing'} -> ${row.route.highlight?.name ?? 'missing'} -> ${row.route.windDown?.name ?? 'missing'}`
      return [
        `### ${row.rowId}`,
        `- Scenario: ${row.scenario}; persona/vibe/mode: ${row.persona}/${row.vibe}/${row.mode}`,
        `- Route: ${route}`,
        `- Score/status/floor: ${row.assessmentEvidence.stamp.score} / ${row.assessmentEvidence.stamp.status} / pass ${row.assessmentEvidence.classificationFloor.passFloor}`,
        `- Margin from pass floor: ${row.assessmentEvidence.classificationFloor.marginFromPassFloor}`,
        `- Non-pass assessments: ${row.assessmentEvidence.nonPassAssessments.join(', ') || 'none'}`,
        `- Non-pass dimensions: ${
          row.assessmentEvidence.nonPassDimensions
            .map((dimension) => `${dimension.owner}.${dimension.dimension}:${dimension.status}:${dimension.score}`)
            .join(', ') || 'none'
        }`,
        `- Reasons: ${row.assessmentEvidence.stamp.reasons.join(', ') || 'none'}`,
        `- Wildcard effect: ${row.assessmentEvidence.wildcard.effect}`,
        `- Missing evidence: ${row.assessmentEvidence.missingEvidence.unavailableEvidence.join(', ') || 'none'}`,
      ].join('\n')
    })
    .join('\n\n')

  const passIndex = passRows
    .map((row) => {
      const sample = representativePassIds.includes(row.rowId) ? 'recommended-sample' : 'inspectable'
      return `| ${row.rowId} | ${row.scenario} | ${row.persona}/${row.vibe} | ${row.route.start?.name ?? 'missing'} -> ${row.route.highlight?.name ?? 'missing'} -> ${row.route.windDown?.name ?? 'missing'} | ${row.assessmentEvidence.stamp.score} | ${row.assessmentEvidence.classificationFloor.marginFromPassFloor} | ${sample} |`
    })
    .join('\n')

  return [
    '# Move 2B-0B Founder Review Index',
    '',
    'Diagnostic-only review index derived from `current-composition-evidence.json`. It does not classify product quality, admit corpus rows, calibrate thresholds, or authorize production consumption.',
    '',
    '## Summary',
    '',
    `- Rows: ${params.rows.length}`,
    `- Produced rows: ${params.summary.producedCount}`,
    `- Supplemental rows: ${params.summary.supplementalCount}`,
    `- Pass rows: ${params.summary.byStatus.pass}`,
    `- Soft rows: ${params.summary.byStatus.soft}`,
    `- Determinism proof: ${params.determinismPassed ? 'passed' : 'failed'}`,
    '',
    '## Six Soft Rows',
    '',
    softDetails,
    '',
    '## Thirty Pass Rows',
    '',
    '| Row ID | Scenario | Persona/Vibe | Route | Score | Margin From Pass Floor | Review Slot |',
    '|---|---|---|---|---:|---:|---|',
    passIndex,
    '',
    '## Caveats',
    '',
    '- The four supplemental rows remain unapproved repetitions.',
    '- This packet does not contain a complete known-bad composition anchor.',
    '- The historical twelve Romantic routes remain comparison material only.',
    '- The stamp remains diagnostic-only.',
    '',
  ].join('\n')
}

function validateSupplementalLineage(rows: CompositionEvaluationRowDiagnostic[]): void {
  const expected: Record<string, string> = {
    'move2b0b-current-romantic_lively-04': 'move2b0b-current-romantic_lively-01',
    'move2b0b-current-family_cultured-02': 'move2b0b-current-family_cultured-01',
    'move2b0b-current-family_cultured-03': 'move2b0b-current-family_cultured-01',
    'move2b0b-current-family_cultured-04': 'move2b0b-current-family_cultured-01',
  }
  for (const [rowId, sourceRowId] of Object.entries(expected)) {
    const row = rows.find((entry) => entry.rowId === rowId)
    const sourceRow = rows.find((entry) => entry.rowId === sourceRowId)
    assert(row, `Expected supplemental row ${rowId}.`)
    assert(sourceRow, `Expected source row ${sourceRowId}.`)
    assert(row.provenance.sourceRowId === sourceRowId, `${rowId} source row changed.`)
    assert(
      row.route.fingerprint === sourceRow.route.fingerprint,
      `${rowId} route fingerprint must equal ${sourceRowId}.`,
    )
    assert(
      stableStringify(row.assessmentEvidence.stamp) === stableStringify(sourceRow.assessmentEvidence.stamp),
      `${rowId} assessment must match ${sourceRowId}.`,
    )
  }
}

async function main(): Promise<void> {
  const first = await buildCurrentRows('move2b0b-current-run-1')
  const second = await buildCurrentRows('move2b0b-current-run-2')
  const results = first.rows.map((row) => ({ scenario: row.scenario, stamp: row.assessmentEvidence.stamp }))

  assert(first.rows.length === 36, `Expected 36 known-good calibration nights, received ${first.rows.length}.`)
  validateSupplementalLineage(first.rows)

  const firstComparable = determinismComparableRows(first.rows)
  const secondComparable = determinismComparableRows(second.rows)
  const determinismPassed = stableStringify(firstComparable) === stableStringify(secondComparable)
  assert(determinismPassed, 'Move 2B-0B generation and evaluation rows must be deterministic.')

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
  const rowSummary = summarizeRows(first.rows)
  const allSummary = summarize([
    ...results,
    { scenario: 'coffee_books_known_bad', stamp: coffeeBooks },
    ...syntheticUnavailable.map((stamp, index) => ({ scenario: `synthetic_unavailable#${index + 1}`, stamp })),
    { scenario: 'synthetic_fail', stamp: syntheticFail },
  ])
  const artifact = {
    artifact: 'move_2b_0b_current_composition_evidence',
    diagnosticOnly: true,
    sourceHead: '81647dc2898d2744be19ecc7dcfaa135ac90abb1',
    sourceHarness: 'scripts/test-move-2a-experience-composition-rubric.ts',
    evaluatorVersion: 'taste.experience_composition.v0_1',
    generationInputs: {
      city: 'San Jose',
      mode: 'scenario-harness',
      personaVibeCases: PERSONA_VIBE_CASES,
      routeGeneration: 'buildStopTypeCandidateBoardFromIntent -> buildScenarioNightsFromCandidateBoard',
      requirementGeneration:
        'buildApplicationConciergeIntent -> buildCanonicalInterpretationBundle -> buildRouteShapeContract',
    },
    determinism: {
      repetitions: 2,
      controlledInputs: ['city', 'persona', 'vibe', 'scenarioFamily', 'static scenario data'],
      clockRandomness: 'No clock or randomness injection was required by the committed harness.',
      equalityFields:
        'All row fields except generationRunId were compared, including route fingerprint, selected highlight, requirements, contribution assessments, relationship assessments, scores, status, reasons, wildcard, missing evidence, and produced-versus-repeat lineage.',
      excludedVolatileFields: ['generationRunId'],
      aggregateResult: determinismPassed ? 'pass' : 'fail',
      perRow: first.rows.map((row, index) => ({
        rowId: row.rowId,
        routeFingerprintEqual: row.route.fingerprint === second.rows[index]?.route.fingerprint,
        assessmentEqual:
          stableStringify(row.assessmentEvidence) ===
          stableStringify(second.rows[index]?.assessmentEvidence),
      })),
    },
    summary: rowSummary,
    scenarioCounts: first.scenarioCounts,
    producedRowCounts: first.producedRowCounts,
    supplementalRows: first.supplementalRows,
    rows: first.rows,
    softRows: first.rows.filter((row) => row.assessmentEvidence.stamp.status === 'soft'),
    passRows: first.rows.filter((row) => row.assessmentEvidence.stamp.status === 'pass'),
    supplementalRowDetails: first.rows.filter((row) => row.provenance.kind === 'supplemental'),
    historicalComparisonRoutes: historicalComparisonRoutes(),
    caveats: [
      'The four supplemental rows remain unapproved repetitions.',
      'The artifact is diagnostic-only and must not be imported by ordinary runtime code.',
      'No complete known-bad composition anchor is introduced.',
      'No historical Romantic route is admitted to the future corpus.',
      'No policy, threshold, score, reason, ranking, selection, fallback, Great Stop, Bearings, Application, Review, Lock, routeAuthority, RuntimeRouteArtifact, saved artifact, or LCE behavior is changed.',
    ],
  }

  if (WRITE_EVIDENCE) {
    writeStableJson(EVIDENCE_JSON_PATH, artifact)
    mkdirSync(dirname(FOUNDER_REVIEW_INDEX_PATH), { recursive: true })
    writeFileSync(
      FOUNDER_REVIEW_INDEX_PATH,
      buildReviewMarkdown({
        rows: first.rows,
        summary: rowSummary,
        determinismPassed,
      }),
      'utf8',
    )
  }

  process.stdout.write(
    JSON.stringify(
      {
        move: '2B-0B',
        diagnosticOnly: true,
        calibrationNights: first.rows.length,
        scenarioCounts: first.scenarioCounts,
        producedRowCounts: first.producedRowCounts,
        supplementalRows: first.supplementalRows,
        rowSummary,
        softRowIds: artifact.softRows.map((row) => row.rowId),
        supplementalRowIds: artifact.supplementalRowDetails.map((row) => ({
          rowId: row.rowId,
          sourceRowId: row.provenance.sourceRowId,
          routeFingerprint: row.route.fingerprint,
        })),
        determinism: artifact.determinism,
        evidenceWritten: WRITE_EVIDENCE
          ? [EVIDENCE_JSON_PATH, FOUNDER_REVIEW_INDEX_PATH]
          : [],
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
