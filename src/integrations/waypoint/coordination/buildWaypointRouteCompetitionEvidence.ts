import { getArcStopBaseVenueId } from '../../../domain/candidates/candidateIdentity'
import type {
  ArcCandidate,
  ArcStop,
  ArcTop40PreservationDiagnostics,
} from '../../../domain/types/arc'
import type { CanonicalInterpretationIngressDiagnostics } from '../../../domain/types/diagnostics'
import type { GreatStopGateResult } from '../../../domain/types/greatStopGate'
import type { Itinerary, UserStopRole } from '../../../domain/types/itinerary'
import type {
  WaypointRouteCompetitionComparisonRow,
  WaypointRouteCompetitionDiagnostics,
  WaypointRouteCompetitionFailureReason,
  WaypointRouteCompetitionPromiseIdentity,
  WaypointRouteCompetitionRankedIdentity,
  WaypointRouteCompetitionRowPurpose,
  WaypointRouteCompetitionStructuralPosture,
} from '../../../domain/types/waypointRouteCompetitionDiagnostics'
import type {
  WaypointContractTrace,
  WaypointRankedCandidate,
} from '../core'

const DEFAULT_ROW_CAP = 12
const DEFAULT_IDENTITY_CAP = 40

const roleProjection: Record<ArcStop['role'], UserStopRole> = {
  warmup: 'start',
  peak: 'highlight',
  wildcard: 'surprise',
  cooldown: 'windDown',
}

export interface BuildWaypointRouteCompetitionEvidenceInput {
  preTop40Candidates: readonly ArcCandidate[]
  assembledCandidates: readonly ArcCandidate[]
  finalBoundaryCandidates: readonly ArcCandidate[]
  finalRankedEntries: readonly WaypointRankedCandidate[]
  selectedCandidate?: ArcCandidate
  itinerary?: Itinerary
  greatStopGateResult?: GreatStopGateResult
  waypointContractTrace?: WaypointContractTrace
  canonicalInterpretationIngress?: CanonicalInterpretationIngressDiagnostics
  top40PreservationDiagnostics?: ArcTop40PreservationDiagnostics
  rowCap?: number
  identityCap?: number
}

interface RowSelection {
  entry: WaypointRankedCandidate
  rank: number
  purposes: Set<WaypointRouteCompetitionRowPurpose>
}

function orderedStopIds(candidate: ArcCandidate): string[] {
  return candidate.stops.map((stop) => stop.scoredVenue.venue.id)
}

function orderedBaseVenueIds(candidate: ArcCandidate): string[] {
  return candidate.stops.map((stop) => getArcStopBaseVenueId(stop))
}

function orderedRouteSignature(candidate: ArcCandidate): string {
  return orderedStopIds(candidate).join('|')
}

function highlightId(candidate: ArcCandidate): string | undefined {
  return candidate.stops.find((stop) => stop.role === 'peak')?.scoredVenue.venue.id
}

function stopIdsByRole(candidate: ArcCandidate): Partial<Record<UserStopRole, string>> {
  const result: Partial<Record<UserStopRole, string>> = {}
  for (const stop of candidate.stops) {
    result[roleProjection[stop.role]] = stop.scoredVenue.venue.id
  }
  return result
}

function structuralPosture(candidate: ArcCandidate): WaypointRouteCompetitionStructuralPosture {
  return {
    stopCount: candidate.stops.length,
    hasWildcard: candidate.hasWildcard,
    promotionOutcome: candidate.surpriseInjection?.promotionOutcome,
    candidateTier: candidate.surpriseInjection?.candidateTier,
  }
}

function structuralPostureSignature(candidate: ArcCandidate): string {
  const posture = structuralPosture(candidate)
  return [
    posture.stopCount,
    posture.hasWildcard ? 'wildcard' : 'no_wildcard',
    posture.promotionOutcome ?? 'no_promotion',
    posture.candidateTier ?? 'no_tier',
  ].join('|')
}

function rankedIdentity(
  entry: WaypointRankedCandidate,
  index: number,
): WaypointRouteCompetitionRankedIdentity {
  return {
    rank: index + 1,
    candidateId: entry.candidate.id,
    orderedStopIds: orderedStopIds(entry.candidate),
    orderedBaseVenueIds: orderedBaseVenueIds(entry.candidate),
    orderedRouteSignature: orderedRouteSignature(entry.candidate),
    highlightId: highlightId(entry.candidate),
  }
}

function promiseIdentity(params: {
  waypointContractTrace?: WaypointContractTrace
  canonicalInterpretationIngress?: CanonicalInterpretationIngressDiagnostics
}): WaypointRouteCompetitionPromiseIdentity | undefined {
  const { waypointContractTrace, canonicalInterpretationIngress } = params
  if (!waypointContractTrace && !canonicalInterpretationIngress) {
    return undefined
  }
  return {
    supplied: Boolean(
      waypointContractTrace?.canonicalInterpretationSupplied ||
        canonicalInterpretationIngress?.supplied,
    ),
    primaryInput: waypointContractTrace?.primaryInput,
    canonicalInterpretationSupplied: waypointContractTrace?.canonicalInterpretationSupplied,
    strategyIds: waypointContractTrace?.strategyIds ?? [],
    strategyFamily: canonicalInterpretationIngress?.strategyFamily,
    experienceContractId: canonicalInterpretationIngress?.experienceContractId,
    contractConstraintsId: canonicalInterpretationIngress?.contractConstraintsId,
    normalizedObjectivePrimary: waypointContractTrace?.normalizedObjectivePrimary,
    normalizedPacing: waypointContractTrace?.normalizedPacing,
    anchorPostureMode: waypointContractTrace?.anchorPostureMode,
    candidateLineageSource: waypointContractTrace?.candidateLineageSource,
  }
}

function sameOrderedRoute(left: ArcCandidate, right: ArcCandidate): boolean {
  return orderedRouteSignature(left) === orderedRouteSignature(right)
}

function addPurpose(
  selections: Map<string, RowSelection>,
  entry: WaypointRankedCandidate | undefined,
  rank: number | undefined,
  purpose: WaypointRouteCompetitionRowPurpose,
): void {
  if (!entry || typeof rank !== 'number') {
    return
  }
  const existing = selections.get(entry.candidate.id)
  if (existing) {
    existing.purposes.add(purpose)
    return
  }
  selections.set(entry.candidate.id, {
    entry,
    rank,
    purposes: new Set([purpose]),
  })
}

function buildComparisonRow(
  selection: RowSelection,
  interpretationPromiseIdentity?: WaypointRouteCompetitionPromiseIdentity,
): WaypointRouteCompetitionComparisonRow {
  const { entry, rank, purposes } = selection
  const scoreBreakdown = entry.candidate.scoreBreakdown
  return {
    purposes: [...purposes],
    rank,
    candidateId: entry.candidate.id,
    orderedStopIds: orderedStopIds(entry.candidate),
    orderedBaseVenueIds: orderedBaseVenueIds(entry.candidate),
    stopIdsByRole: stopIdsByRole(entry.candidate),
    highlightId: highlightId(entry.candidate),
    productionScore: entry.rankingScore,
    comparisonDimensions: {
      productionRankingScore: entry.rankingScore,
      boundaryBaseScore: entry.boundaryBaseScore,
      boundaryQualityAdjustment: entry.boundaryQualityAdjustment,
      routeShapeCompactnessAdjustment: entry.routeShapeCompactnessAdjustment,
      refinementNudge: entry.refinementNudge,
      tiebreaker: entry.tiebreaker,
    },
    structuralPosture: structuralPosture(entry.candidate),
    tasteEvidence: {
      routeMomentVerdict: scoreBreakdown.routeMomentVerdict,
      experienceCompositionStamp: scoreBreakdown.experienceCompositionStamp,
      highlightMomentScore: scoreBreakdown.highlightMomentScore,
      momentStrengthScore: scoreBreakdown.momentStrengthScore,
      momentVarianceScore: scoreBreakdown.momentVarianceScore,
      strongMomentPresent: scoreBreakdown.strongMomentPresent,
    },
    bearingsEvidence: {
      geographyScore: scoreBreakdown.geographyScore,
      spatialCoherenceScore: scoreBreakdown.spatialCoherenceScore,
      spatial: entry.candidate.spatial,
      pacing: entry.candidate.pacing,
    },
    interpretationPromiseIdentity,
  }
}

function hasTasteEvidence(row: WaypointRouteCompetitionComparisonRow): boolean {
  return Boolean(
    row.tasteEvidence.routeMomentVerdict &&
      row.tasteEvidence.experienceCompositionStamp,
  )
}

function hasBearingsEvidence(row: WaypointRouteCompetitionComparisonRow): boolean {
  return (
    typeof row.bearingsEvidence.geographyScore === 'number' &&
    Boolean(row.bearingsEvidence.spatial) &&
    Boolean(row.bearingsEvidence.pacing)
  )
}

function sameOrderedVenueIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function buildWaypointRouteCompetitionEvidence(
  input: BuildWaypointRouteCompetitionEvidenceInput,
): WaypointRouteCompetitionDiagnostics {
  const rowCap = input.rowCap ?? DEFAULT_ROW_CAP
  const identityCap = input.identityCap ?? DEFAULT_IDENTITY_CAP
  const finalRankedEntries = [...input.finalRankedEntries]
  const finalBoundaryCandidateIds = new Set(
    input.finalBoundaryCandidates.map((candidate) => candidate.id),
  )
  const finalRankedCandidateIds = new Set(
    finalRankedEntries.map((entry) => entry.candidate.id),
  )
  const identityPopulationComplete = finalRankedEntries.length <= identityCap
  const finalRankedPopulationEntries = finalRankedEntries
    .slice(0, identityCap)
    .map(rankedIdentity)
  const preTop40CandidateCount = input.preTop40Candidates.length
  const assembledCandidateCount = input.assembledCandidates.length
  const finalBoundaryInputCount = input.finalBoundaryCandidates.length
  const finalRankedCandidateCount = finalRankedEntries.length
  const top40Truncated = preTop40CandidateCount > finalBoundaryInputCount
  const boundaryAndRankedSetsMatch =
    finalBoundaryInputCount === finalRankedCandidateCount &&
    input.finalBoundaryCandidates.every((candidate) => finalRankedCandidateIds.has(candidate.id)) &&
    finalRankedEntries.every((entry) => finalBoundaryCandidateIds.has(entry.candidate.id))
  const rankedPopulationComplete =
    !top40Truncated && identityPopulationComplete && boundaryAndRankedSetsMatch
  const selectedCandidateId = input.selectedCandidate?.id
  const selectedIndex = selectedCandidateId
    ? finalRankedEntries.findIndex((entry) => entry.candidate.id === selectedCandidateId)
    : -1
  const selectedRank = selectedIndex >= 0 ? selectedIndex + 1 : undefined
  const selectedFromRankedPopulation = selectedIndex >= 0
  const selectedFirstWithinFinalRankedPopulation = selectedIndex === 0
  const selectedEntry = selectedIndex >= 0 ? finalRankedEntries[selectedIndex] : undefined
  const selectedRankingScore = selectedEntry?.rankingScore
  const interpretationPromiseIdentity = promiseIdentity({
    waypointContractTrace: input.waypointContractTrace,
    canonicalInterpretationIngress: input.canonicalInterpretationIngress,
  })

  const selections = new Map<string, RowSelection>()
  addPurpose(selections, selectedEntry, selectedRank, 'selected_winner')
  addPurpose(selections, finalRankedEntries[1], 2, 'immediate_ranked_runner_up')

  if (selectedEntry) {
    const selectedHighlightId = highlightId(selectedEntry.candidate)
    const selectedPostureSignature = structuralPostureSignature(selectedEntry.candidate)
    const differentHighlightIndex = finalRankedEntries.findIndex(
      (entry) => highlightId(entry.candidate) !== selectedHighlightId,
    )
    addPurpose(
      selections,
      differentHighlightIndex >= 0 ? finalRankedEntries[differentHighlightIndex] : undefined,
      differentHighlightIndex >= 0 ? differentHighlightIndex + 1 : undefined,
      'first_different_highlight',
    )
    const differentRouteIndex = finalRankedEntries.findIndex(
      (entry) => !sameOrderedRoute(entry.candidate, selectedEntry.candidate),
    )
    addPurpose(
      selections,
      differentRouteIndex >= 0 ? finalRankedEntries[differentRouteIndex] : undefined,
      differentRouteIndex >= 0 ? differentRouteIndex + 1 : undefined,
      'first_different_ordered_route',
    )
    const differentPostureIndex = finalRankedEntries.findIndex(
      (entry) => structuralPostureSignature(entry.candidate) !== selectedPostureSignature,
    )
    addPurpose(
      selections,
      differentPostureIndex >= 0 ? finalRankedEntries[differentPostureIndex] : undefined,
      differentPostureIndex >= 0 ? differentPostureIndex + 1 : undefined,
      'first_different_structural_posture',
    )
  }

  const selectedBoundaryTieEntries =
    typeof selectedRankingScore === 'number'
      ? finalRankedEntries
          .map((entry, index) => ({ entry, rank: index + 1 }))
          .filter(({ entry }) => entry.rankingScore === selectedRankingScore)
      : []
  for (const { entry, rank } of selectedBoundaryTieEntries) {
    addPurpose(selections, entry, rank, 'selected_score_boundary_tie')
  }

  const selectedTieIds = new Set(
    selectedBoundaryTieEntries.map(({ entry }) => entry.candidate.id),
  )
  let orderedSelections = [...selections.values()].sort((left, right) => left.rank - right.rank)
  const rowCapExceeded = orderedSelections.length > rowCap
  if (rowCapExceeded) {
    const selectedSelection = selectedCandidateId
      ? orderedSelections.find((selection) => selection.entry.candidate.id === selectedCandidateId)
      : undefined
    orderedSelections = orderedSelections.slice(0, rowCap)
    if (
      selectedSelection &&
      !orderedSelections.some(
        (selection) => selection.entry.candidate.id === selectedSelection.entry.candidate.id,
      )
    ) {
      orderedSelections = [...orderedSelections.slice(0, Math.max(0, rowCap - 1)), selectedSelection]
        .sort((left, right) => left.rank - right.rank)
    }
  }

  const retainedRowIds = new Set(
    orderedSelections.map((selection) => selection.entry.candidate.id),
  )
  const tiePopulationTruncated = [...selectedTieIds].some((id) => !retainedRowIds.has(id))
  const comparisonRows = orderedSelections.map((selection) =>
    buildComparisonRow(selection, interpretationPromiseIdentity),
  )
  const assessedRouteMatchesSelected = Boolean(
    selectedCandidateId &&
      input.greatStopGateResult?.routeId &&
      input.greatStopGateResult.routeId === selectedCandidateId,
  )
  const shownRouteMatchesSelected = Boolean(
    input.selectedCandidate &&
      input.itinerary &&
      sameOrderedVenueIds(
        orderedStopIds(input.selectedCandidate),
        input.itinerary.stops.map((stop) => stop.venueId),
      ),
  )
  const interpretationPromisePresent = Boolean(
    interpretationPromiseIdentity?.supplied &&
      (interpretationPromiseIdentity.experienceContractId ||
        interpretationPromiseIdentity.strategyIds.length > 0 ||
        interpretationPromiseIdentity.primaryInput),
  )
  const comparedRowsHavePromise =
    comparisonRows.length > 0 &&
    comparisonRows.every((row) => row.interpretationPromiseIdentity === interpretationPromiseIdentity)
  const tasteEvidencePresent =
    comparisonRows.length > 0 && comparisonRows.every(hasTasteEvidence)
  const bearingsEvidencePresent =
    comparisonRows.length > 0 && comparisonRows.every(hasBearingsEvidence)
  const deterministicTieHandlingRetained =
    selectedFromRankedPopulation && typeof selectedEntry?.tiebreaker === 'number'
  const evidenceMissing =
    !interpretationPromisePresent ||
    !comparedRowsHavePromise ||
    !tasteEvidencePresent ||
    !bearingsEvidencePresent ||
    !deterministicTieHandlingRetained ||
    !input.top40PreservationDiagnostics && top40Truncated

  const failureReasons: WaypointRouteCompetitionFailureReason[] = []
  if (preTop40CandidateCount === 0 && assembledCandidateCount === 0) {
    failureReasons.push('assembly_incomplete')
  }
  if (top40Truncated) {
    failureReasons.push('pre_ranking_population_truncated')
  }
  if (!rankedPopulationComplete) {
    failureReasons.push('ranked_population_incomplete')
  }
  if (!selectedFromRankedPopulation) {
    failureReasons.push('selected_not_in_ranked_population')
  }
  if (selectedFromRankedPopulation && !selectedFirstWithinFinalRankedPopulation) {
    failureReasons.push('selected_not_first')
  }
  if (tiePopulationTruncated) {
    failureReasons.push('tie_population_truncated')
  }
  if (evidenceMissing) {
    failureReasons.push('evidence_missing')
  }
  if (!assessedRouteMatchesSelected) {
    failureReasons.push('assessed_route_mismatch')
  }
  if (!shownRouteMatchesSelected) {
    failureReasons.push('shown_route_mismatch')
  }

  const globalStrongestStatus =
    failureReasons.length === 0 ? 'GLOBAL_STRONGEST_PROVEN' : 'GLOBAL_STRONGEST_NOT_PROVEN'

  return {
    enabled: true,
    owner: 'Waypoint',
    diagnosticVersion: 'waypoint.route_competition.v1',
    assemblyCompleted: preTop40CandidateCount > 0 || assembledCandidateCount > 0,
    retainedCandidateCount: preTop40CandidateCount,
    preTop40CandidateCount,
    assembledCandidateCount,
    finalBoundaryInputCount,
    finalRankedCandidateCount,
    top40Truncated,
    rankedPopulationComplete,
    selectedCandidateId,
    selectedRank,
    selectedFromRankedPopulation,
    selectedFirstWithinFinalRankedPopulation,
    assessedRouteMatchesSelected,
    shownRouteMatchesSelected,
    approvalContinuityStatus: 'UNAVAILABLE_WITHOUT_PROTECTED_INSTRUMENTATION',
    globalStrongestStatus,
    globalStrongestFailureReasons: [...new Set(failureReasons)],
    finalRankedPopulation: {
      count: finalRankedCandidateCount,
      complete: identityPopulationComplete,
      cap: identityCap,
      truncated: !identityPopulationComplete,
      entries: finalRankedPopulationEntries,
    },
    comparisonRows,
    rowTruncation: {
      cap: rowCap,
      truncated: rowCapExceeded || tiePopulationTruncated,
      reason: tiePopulationTruncated
        ? 'selected_score_boundary_ties_exceeded_cap'
        : rowCapExceeded
          ? 'row_cap_exceeded'
          : undefined,
    },
    interpretationPromiseIdentity,
    interpretationPromiseSharedByComparedRows: comparedRowsHavePromise,
  }
}
