import type {
  BearingsDistanceBurdenVerdict,
  BearingsFeasibilitySubVerdict,
  BearingsPlaceRightVerdict,
  BearingsRouteFeasibilityInput,
  BearingsRouteFeasibilityStatus,
  BearingsRouteLevelFeasibilityEvidence,
  BearingsStopLevelFeasibilityEvidence,
  DistrictRouteAnchorSupportRelationshipFact,
} from './routePlaceRightContract'

const BEARINGS_ROUTE_PLACE_RIGHT_VERSION = 'gw1-bearings-3'
const MIN_ACCEPTABLE_COMPACTNESS = 0.55
const MAX_ACCEPTABLE_CLUSTER_ESCAPES = 1

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function subVerdict(
  status: BearingsFeasibilitySubVerdict['status'],
  reasonCodes: string[],
  notes?: string[],
): BearingsFeasibilitySubVerdict {
  return {
    status,
    reasonCodes: unique(reasonCodes),
    ...(notes && notes.length > 0 ? { notes: unique(notes) } : {}),
  }
}

function getStatus(reasonCodes: string[]): BearingsRouteFeasibilityStatus {
  return reasonCodes.length > 0 ? 'fail' : 'pass'
}

function supportCountForRelationship(
  relationship: DistrictRouteAnchorSupportRelationshipFact | undefined,
): number {
  return relationship?.sameNeighborhoodSupportCount ?? relationship?.supportBaseVenueIds.length ?? 0
}

function buildDistanceBurden(input: BearingsRouteFeasibilityInput): BearingsDistanceBurdenVerdict {
  const reasonCodes = input.distanceFacts.reasonCodes ?? []
  return {
    status: getStatus(reasonCodes),
    burden: reasonCodes.length > 0 ? 'high' : 'low',
    reasonCodes,
    notes:
      input.distanceFacts.totalEstimatedTransitionMinutes !== undefined ||
      input.distanceFacts.maxSingleTransitionMinutes !== undefined
        ? [
            `total:${input.distanceFacts.totalEstimatedTransitionMinutes ?? 'unknown'}`,
            `max:${input.distanceFacts.maxSingleTransitionMinutes ?? 'unknown'}`,
          ]
        : undefined,
  }
}

function buildRequiredStopSurvival(input: BearingsRouteFeasibilityInput): {
  verdict: BearingsFeasibilitySubVerdict
  stopEvidence: BearingsStopLevelFeasibilityEvidence[]
} {
  const districtFacts = input.districtFacts
  const stopEvidence = input.requiredStopFacts.map((requiredStop) => {
    const relationship = districtFacts.anchorSupportRelationships.find(
      (entry) => entry.anchorBaseVenueId === requiredStop.baseVenueId,
    )
    const supportCount = supportCountForRelationship(relationship)
    const reasonCodes =
      requiredStop.survivalRequired && supportCount === 0
        ? [
            'place_right:required_stop_survival_failed',
            'place_right:support_supply_not_buildable',
          ]
        : []
    return {
      baseVenueId: requiredStop.baseVenueId,
      status: getStatus(reasonCodes),
      role: requiredStop.requiredRole,
      requiredStopSurvival: subVerdict(getStatus(reasonCodes), reasonCodes),
      reasonCodes,
    }
  })
  const reasonCodes = unique(stopEvidence.flatMap((entry) => entry.reasonCodes))
  return {
    verdict: subVerdict(getStatus(reasonCodes), reasonCodes),
    stopEvidence,
  }
}

export function evaluateRoutePlaceRightEvidence(
  input: BearingsRouteFeasibilityInput,
): BearingsPlaceRightVerdict {
  const districtFacts = input.districtFacts
  const districtFactsPresent = districtFacts.provenance.source === 'district'
  const structuralMissing = districtFacts.structuralConfidence.status === 'missing'
  const structuralReasonCodes = [
    ...(districtFactsPresent ? [] : ['place_right:district_provenance_missing']),
    ...(structuralMissing ? ['place_right:district_structural_facts_missing'] : []),
    ...(districtFacts.compactness.compactnessScore !== undefined &&
    districtFacts.compactness.compactnessScore < MIN_ACCEPTABLE_COMPACTNESS
      ? ['place_right:low_route_compactness']
      : []),
    ...(districtFacts.sameNeighborhood.allStopsSameNeighborhood === false ||
    (districtFacts.sameNeighborhood.mismatchedStopBaseVenueIds?.length ?? 0) > 0 ||
    districtFacts.sameNeighborhood.neighborhoods.length > 1
      ? ['place_right:scattered_neighborhoods']
      : []),
    ...((districtFacts.clusterCoherence.clusterEscapeCount ?? 0) > MAX_ACCEPTABLE_CLUSTER_ESCAPES
      ? ['place_right:cluster_escape_structure']
      : []),
    ...((districtFacts.clusterCoherence.repeatedClusterEscapeCount ?? 0) > 0 ||
    districtFacts.clusterCoherence.backtrackDetected
      ? ['place_right:backtrack_structure']
      : []),
  ]

  const supportReasonCodes = [
    ...(districtFacts.supportProximity.some((fact) => fact.sameNeighborhood === false)
      ? ['place_right:poor_support_proximity']
      : []),
    ...input.supportSupplyFacts.flatMap((fact) =>
      fact.supportSupplyMissing ? ['place_right:support_supply_not_buildable'] : [],
    ),
  ]
  const requiredStopSurvival = buildRequiredStopSurvival(input)
  const openClosedReasonCodes = input.openClosedFacts.flatMap((fact) =>
    fact.status === 'closed' || fact.status === 'likely_closed'
      ? ['place_right:open_closed_viability_failed']
      : [],
  )
  const distanceBurden = buildDistanceBurden(input)
  const movementReasonCodes = input.movementContract.reasonCodes ?? []
  const stretchReasonCodes = input.tasteStretchEvidence?.flatMap((evidence) =>
    evidence.stretchWorthiness === 'not_worth_it'
      ? ['place_right:stretch_not_admissible']
      : [],
  ) ?? []

  const reasons = unique([
    ...structuralReasonCodes,
    ...supportReasonCodes,
    ...requiredStopSurvival.verdict.reasonCodes,
    ...openClosedReasonCodes,
    ...distanceBurden.reasonCodes,
    ...movementReasonCodes,
    ...stretchReasonCodes,
  ])
  const status = structuralMissing || !districtFactsPresent ? 'unknown' : getStatus(reasons)
  const placeRightReady = districtFactsPresent && !structuralMissing
  const supportProximityVerdict = subVerdict(getStatus(supportReasonCodes), supportReasonCodes)
  const supportSupplyBuildabilityVerdict = subVerdict(
    getStatus([...supportReasonCodes, ...requiredStopSurvival.verdict.reasonCodes]),
    [...supportReasonCodes, ...requiredStopSurvival.verdict.reasonCodes],
  )
  const movementToleranceFit = subVerdict(getStatus(movementReasonCodes), movementReasonCodes)
  const stretchAdmissibility = subVerdict(getStatus(stretchReasonCodes), stretchReasonCodes)
  const openClosedViabilityVerdict = subVerdict(getStatus(openClosedReasonCodes), openClosedReasonCodes)
  const routeEvidence: BearingsRouteLevelFeasibilityEvidence = {
    status,
    distanceBurden,
    movementToleranceFit,
    stretchAdmissibility,
    supportProximity: supportProximityVerdict,
    supportSupplyBuildability: supportSupplyBuildabilityVerdict,
    requiredStopSurvival: requiredStopSurvival.verdict,
    openClosedViability: openClosedViabilityVerdict,
    reasonCodes: reasons,
  }

  return {
    placeRightReady,
    status,
    reasons,
    distanceBurden,
    movementToleranceFit,
    stretchAdmissibility,
    supportProximityVerdict,
    supportSupplyBuildabilityVerdict,
    requiredStopSurvivalVerdict: requiredStopSurvival.verdict,
    openClosedViabilityVerdict,
    stopEvidence: requiredStopSurvival.stopEvidence,
    routeEvidence,
    compatibility: {
      greatStopPlaceRightStatus: status,
      greatStopPlaceRightReasonCodes: reasons,
      distanceBurdenSummary: distanceBurden.burden,
      movementToleranceSummary: movementToleranceFit.status,
      supportBuildabilitySummary: supportSupplyBuildabilityVerdict.status,
    },
    provenance: {
      source: 'bearings',
      version: BEARINGS_ROUTE_PLACE_RIGHT_VERSION,
      policyId: 'route_place_right_evidence_guard',
      notes: [
        `consumed-district-source:${districtFacts.provenance.source}`,
        `consumed-district-version:${districtFacts.provenance.version}`,
      ],
    },
  }
}
