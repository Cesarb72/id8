import type {
  BearingsDistanceBurdenVerdict,
  BearingsFeasibilitySubVerdict,
  BearingsPlaceRightClauseAttribution,
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
const MAX_FLEXIBLE_CLUSTER_ESCAPES = 2

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

function clauseStatus(passed: boolean): BearingsRouteFeasibilityStatus {
  return passed ? 'pass' : 'fail'
}

function buildPlaceRightClauseAttribution(params: {
  input: BearingsRouteFeasibilityInput
  preClauseFailureReasons: string[]
  hardFailureReasons: string[]
}): BearingsPlaceRightClauseAttribution {
  const { input, preClauseFailureReasons, hardFailureReasons } = params
  const districtFacts = input.districtFacts
  const sameDistrictPassed =
    districtFacts.sameNeighborhood.allStopsSameNeighborhood === true &&
    districtFacts.sameNeighborhood.neighborhoods.length === 1
  const sameDistrict = {
    clause: 'same_district' as const,
    status: clauseStatus(sameDistrictPassed),
    evidence: [
      `neighborhoods:${districtFacts.sameNeighborhood.neighborhoods.join('|') || 'none'}`,
      `allStopsSameNeighborhood:${String(districtFacts.sameNeighborhood.allStopsSameNeighborhood)}`,
    ],
    nonPassReasons: sameDistrictPassed
      ? []
      : [
          districtFacts.sameNeighborhood.neighborhoods.length > 1
            ? 'multiple_district_route_place_facts'
            : 'same_district_not_asserted_by_district_facts',
        ],
  }

  const spatialMode = input.movementContract.spatialMode ?? (
    input.movementContract.tolerance === 'flexible' ? 'flexible' : 'walkable'
  )
  const clusterIds = districtFacts.clusterCoherence.clusterIds
  const clusterEscapeCount = districtFacts.clusterCoherence.clusterEscapeCount ?? 0
  const repeatedClusterEscapeCount = districtFacts.clusterCoherence.repeatedClusterEscapeCount ?? 0
  const backtrackDetected = districtFacts.clusterCoherence.backtrackDetected === true
  const longTransitionCount = districtFacts.clusterCoherence.longTransitionCount ?? 0
  const sameClusterRoute = clusterIds.length <= 1 && clusterEscapeCount === 0
  const controlledDestinationJump =
    spatialMode === 'walkable' &&
    clusterIds.length <= 2 &&
    clusterEscapeCount <= 2 &&
    repeatedClusterEscapeCount === 0 &&
    !backtrackDetected
  const flexibleClusterRoute =
    spatialMode === 'flexible' &&
    clusterIds.length <= 2 &&
    repeatedClusterEscapeCount === 0 &&
    !backtrackDetected
  const walkableClusterPassed =
    sameClusterRoute || controlledDestinationJump || flexibleClusterRoute
  const walkableCluster = {
    clause: 'walkable_cluster' as const,
    status: clauseStatus(walkableClusterPassed),
    evidence: [
      `spatialMode:${spatialMode}`,
      `clusterIds:${clusterIds.join('|') || 'none'}`,
      `clusterEscapeCount:${clusterEscapeCount}`,
      `repeatedClusterEscapeCount:${repeatedClusterEscapeCount}`,
      `backtrackDetected:${String(backtrackDetected)}`,
      `longTransitionCount:${longTransitionCount}`,
    ],
    nonPassReasons: walkableClusterPassed
      ? []
      : [
          repeatedClusterEscapeCount > 0 || backtrackDetected
            ? 'repeated_bouncing_not_walkable_cluster'
            : clusterIds.length > 2
              ? 'too_many_clusters_for_walkable_cluster'
              : 'walkable_cluster_not_asserted_by_spatial_facts',
        ],
  }

  const stretchEvidence = input.tasteStretchEvidence ?? []
  const validStretchEvidence = stretchEvidence.find(
    (evidence) =>
      evidence.stretchApplied === true &&
      evidence.localSupplyInsufficient === true &&
      evidence.strongerNearbyishMoment === true &&
      evidence.boundedStretchRespected === true &&
      evidence.stretchWorthiness === 'worth_it',
  )
  const deliberateMovement = {
    clause: 'deliberate_movement' as const,
    status: clauseStatus(Boolean(validStretchEvidence)),
    evidence: validStretchEvidence
      ? [
          `baseVenueId:${validStretchEvidence.baseVenueId}`,
          'localSupplyInsufficient:true',
          'strongerNearbyishMoment:true',
          'boundedStretchRespected:true',
          'stretchApplied:true',
        ]
      : stretchEvidence.length > 0
        ? stretchEvidence.flatMap((evidence) => [
            `baseVenueId:${evidence.baseVenueId}`,
            `localSupplyInsufficient:${String(evidence.localSupplyInsufficient)}`,
            `strongerNearbyishMoment:${String(evidence.strongerNearbyishMoment)}`,
            `boundedStretchRespected:${String(evidence.boundedStretchRespected)}`,
            `stretchApplied:${String(evidence.stretchApplied)}`,
            `stretchWorthiness:${evidence.stretchWorthiness}`,
          ])
        : ['local_stretch_evidence_missing'],
    nonPassReasons: validStretchEvidence
      ? []
      : [
          stretchEvidence.length === 0
            ? 'local_stretch_evidence_missing'
            : 'local_stretch_conditions_not_satisfied',
        ],
  }

  const passedClauses = [
    ...(sameDistrict.status === 'pass' ? [sameDistrict.clause] : []),
    ...(walkableCluster.status === 'pass' ? [walkableCluster.clause] : []),
    ...(deliberateMovement.status === 'pass' ? [deliberateMovement.clause] : []),
  ]

  return {
    sameDistrict,
    walkableCluster,
    deliberateMovement,
    passedClauses,
    rescueSource: passedClauses.length > 0 ? passedClauses : 'none',
    blockedByHardFailure: hardFailureReasons.length > 0,
    hardFailureReasons,
    preClauseFailureReasons,
  }
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
  const requiresRouteContinuity =
    input.movementContract.requireContinuity === true ||
    input.movementContract.tolerance === 'contained'
  const maxClusterEscapes =
    input.movementContract.tolerance === 'flexible'
      ? MAX_FLEXIBLE_CLUSTER_ESCAPES
      : MAX_ACCEPTABLE_CLUSTER_ESCAPES
  const structuralReasonCodes = [
    ...(districtFactsPresent ? [] : ['place_right:district_provenance_missing']),
    ...(structuralMissing ? ['place_right:district_structural_facts_missing'] : []),
    ...(districtFacts.compactness.compactnessScore !== undefined &&
    districtFacts.compactness.compactnessScore < MIN_ACCEPTABLE_COMPACTNESS
      ? ['place_right:low_route_compactness']
      : []),
    ...(requiresRouteContinuity &&
    (districtFacts.sameNeighborhood.allStopsSameNeighborhood === false ||
      (districtFacts.sameNeighborhood.mismatchedStopBaseVenueIds?.length ?? 0) > 0 ||
      districtFacts.sameNeighborhood.neighborhoods.length > 1)
      ? ['place_right:scattered_neighborhoods']
      : []),
    ...((districtFacts.clusterCoherence.clusterEscapeCount ?? 0) > maxClusterEscapes
      ? ['place_right:cluster_escape_structure']
      : []),
    ...((districtFacts.clusterCoherence.repeatedClusterEscapeCount ?? 0) > 0 ||
    districtFacts.clusterCoherence.backtrackDetected
      ? ['place_right:backtrack_structure']
      : []),
  ]

  const supportReasonCodes = [
    ...(requiresRouteContinuity &&
    districtFacts.supportProximity.some((fact) => fact.sameNeighborhood === false)
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
  const hardFailureReasons = unique([
    ...(districtFactsPresent ? [] : ['place_right:district_provenance_missing']),
    ...(structuralMissing ? ['place_right:district_structural_facts_missing'] : []),
    ...requiredStopSurvival.verdict.reasonCodes,
    ...openClosedReasonCodes,
    ...stretchReasonCodes,
  ])
  const clauseAttribution = buildPlaceRightClauseAttribution({
    input,
    preClauseFailureReasons: reasons,
    hardFailureReasons,
  })
  const clauseRescued = clauseAttribution.passedClauses.length > 0 && hardFailureReasons.length === 0
  const finalReasonCodes = clauseRescued ? [] : reasons
  const status = structuralMissing || !districtFactsPresent ? 'unknown' : getStatus(finalReasonCodes)
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
    reasonCodes: finalReasonCodes,
  }

  return {
    placeRightReady,
    status,
    reasons: finalReasonCodes,
    distanceBurden,
    movementToleranceFit,
    stretchAdmissibility,
    supportProximityVerdict,
    supportSupplyBuildabilityVerdict,
    requiredStopSurvivalVerdict: requiredStopSurvival.verdict,
    openClosedViabilityVerdict,
    stopEvidence: requiredStopSurvival.stopEvidence,
    routeEvidence,
    clauseAttribution,
    compatibility: {
      greatStopPlaceRightStatus: status,
      greatStopPlaceRightReasonCodes: finalReasonCodes,
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
