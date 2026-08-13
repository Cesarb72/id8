import type {
  BearingsDistanceBurdenVerdict,
  BearingsFeasibilitySubVerdict,
  BearingsPlaceRightClauseEvidence,
  BearingsPlaceRightClauseAttribution,
  BearingsPlaceRightDiagnosticClauseRelationship,
  BearingsPlaceRightDiagnosticRejectedCandidate,
  BearingsPlaceRightDiagnosticSupplyStage,
  BearingsPlaceRightRequiredStopSurvivalDiagnostic,
  BearingsPlaceRightHardClauseMode,
  BearingsPlaceRightSoftClauseMode,
  BearingsPlaceRightVerdict,
  BearingsRouteFeasibilityInput,
  BearingsRouteFeasibilityStatus,
  BearingsPlaceRightSupportWorldDiagnostics,
  BearingsRouteLevelFeasibilityEvidence,
  BearingsStopLevelFeasibilityEvidence,
  DistrictRouteAnchorSupportRelationshipFact,
} from './routePlaceRightContract'

const BEARINGS_ROUTE_PLACE_RIGHT_VERSION = 'gw1-bearings-3'
const MIN_ACCEPTABLE_COMPACTNESS = 0.55
const MAX_ACCEPTABLE_CLUSTER_ESCAPES = 1
const MAX_FLEXIBLE_CLUSTER_ESCAPES = 2

const SOFT_PLACE_RIGHT_REASON_CODES = new Set([
  'place_right:low_route_compactness',
  'place_right:scattered_neighborhoods',
  'place_right:cluster_escape_structure',
  'place_right:backtrack_structure',
  'place_right:poor_support_proximity',
])

interface EvaluateRoutePlaceRightEvidenceOptions {
  softClauseMode?: BearingsPlaceRightSoftClauseMode
  hardClauseMode?: BearingsPlaceRightHardClauseMode
}

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

function roleForSupportCandidate(
  input: BearingsRouteFeasibilityInput,
  candidateId: string,
): string {
  return (
    input.districtFacts.supportProximity.find((fact) => fact.supportBaseVenueId === candidateId)
      ?.supportRole ??
    input.roleFacts.find((fact) => fact.baseVenueId === candidateId)?.routeRole ??
    'support'
  )
}

function buildSupplyStage(
  input: BearingsRouteFeasibilityInput,
  candidateIds: string[],
): BearingsPlaceRightDiagnosticSupplyStage {
  const uniqueCandidateIds = unique(candidateIds)
  const byRole: Record<string, number> = {}
  for (const candidateId of uniqueCandidateIds) {
    const role = roleForSupportCandidate(input, candidateId)
    byRole[role] = (byRole[role] ?? 0) + 1
  }
  return {
    total: uniqueCandidateIds.length,
    byRole,
    candidateIds: uniqueCandidateIds,
  }
}

function hardRejectedSupportCandidates(
  input: BearingsRouteFeasibilityInput,
  candidateIds: string[],
): BearingsPlaceRightDiagnosticRejectedCandidate[] {
  const openClosedById = new Map(
    input.openClosedFacts.map((fact) => [fact.baseVenueId, fact.status]),
  )
  return unique(candidateIds)
    .filter((candidateId) => {
      const status = openClosedById.get(candidateId)
      return status === 'closed' || status === 'likely_closed'
    })
    .map((candidateId) => ({
      candidateId,
      reason: 'place_right:open_closed_viability_failed',
    }))
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
  const requiresSupportSupply =
    input.movementContract.requireContinuity === true ||
    input.movementContract.tolerance === 'contained'
  const stopEvidence = input.requiredStopFacts.map((requiredStop) => {
    const relationship = districtFacts.anchorSupportRelationships.find(
      (entry) => entry.anchorBaseVenueId === requiredStop.baseVenueId,
    )
    const supportCount = supportCountForRelationship(relationship)
    const reasonCodes =
      requiredStop.survivalRequired && requiresSupportSupply && supportCount === 0
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

function reasonCodesForClause(clause: string): string[] {
  if (clause === 'support_supply_buildability') {
    return ['place_right:support_supply_not_buildable']
  }
  if (clause === 'required_stop_survival') {
    return ['place_right:required_stop_survival_failed', 'place_right:support_supply_not_buildable']
  }
  if (clause === 'cluster_escape_structure') {
    return ['place_right:cluster_escape_structure']
  }
  if (clause === 'support_proximity') {
    return ['place_right:poor_support_proximity']
  }
  if (clause === 'open_closed_viability') {
    return ['place_right:open_closed_viability_failed']
  }
  return []
}

function buildSupportWorldDiagnostics(params: {
  input: BearingsRouteFeasibilityInput
  structuralReasonCodes: string[]
  supportReasonCodes: string[]
  requiredStopSurvival: ReturnType<typeof buildRequiredStopSurvival>
  openClosedReasonCodes: string[]
  softClauseMode: BearingsPlaceRightSoftClauseMode
  hardClauseMode: BearingsPlaceRightHardClauseMode
  retainedProductionReasons: string[]
  observedOnlyReasons: string[]
}): BearingsPlaceRightSupportWorldDiagnostics {
  const { input } = params
  const enteringSupportIds = unique(
    input.districtFacts.anchorSupportRelationships.flatMap(
      (relationship) => relationship.supportBaseVenueIds,
    ),
  )
  const hardRejectedCandidates = hardRejectedSupportCandidates(input, enteringSupportIds)
  const hardRejectedIds = new Set(hardRejectedCandidates.map((entry) => entry.candidateId))
  const afterHardIds = enteringSupportIds.filter((candidateId) => !hardRejectedIds.has(candidateId))
  const softSurvivorIds = unique(
    input.districtFacts.supportProximity
      .filter((fact) => fact.sameNeighborhood === true)
      .map((fact) => fact.supportBaseVenueId),
  ).filter((candidateId) => afterHardIds.includes(candidateId))
  const softRejectedCandidates = afterHardIds
    .filter((candidateId) => !softSurvivorIds.includes(candidateId))
    .map((candidateId) => ({
      candidateId,
      reason: 'place_right:poor_support_proximity',
    }))
  const enteringPlaceRight = buildSupplyStage(input, enteringSupportIds)
  const afterHardConstraints = buildSupplyStage(input, afterHardIds)
  const afterSoftConstraints = buildSupplyStage(input, softSurvivorIds)
  const softCauseReasons = unique([
    ...params.structuralReasonCodes.filter((reason) => SOFT_PLACE_RIGHT_REASON_CODES.has(reason)),
    ...params.supportReasonCodes.filter((reason) => SOFT_PLACE_RIGHT_REASON_CODES.has(reason)),
  ])
  const downstreamCauses =
    softCauseReasons.length > 0
      ? softCauseReasons
      : softRejectedCandidates.length > 0
        ? ['place_right:poor_support_proximity']
        : []

  const requiredStopSurvival: BearingsPlaceRightRequiredStopSurvivalDiagnostic[] = input.requiredStopFacts.map((requiredStop) => {
    const relationship = input.districtFacts.anchorSupportRelationships.find(
      (entry) => entry.anchorBaseVenueId === requiredStop.baseVenueId,
    )
    const enteringSupportCount = relationship?.supportBaseVenueIds.length ?? 0
    const hardSurvivorCount = relationship
      ? relationship.supportBaseVenueIds.filter((candidateId) => afterHardIds.includes(candidateId))
          .length
      : 0
    const softSurvivorCount = relationship?.sameNeighborhoodSupportCount ?? 0
    const result: BearingsRouteFeasibilityStatus =
      requiredStop.survivalRequired && softSurvivorCount === 0 ? 'fail' : 'pass'
    const relationshipStatus: BearingsPlaceRightDiagnosticClauseRelationship =
      !relationship
        ? 'unresolved'
        : result === 'pass'
          ? 'independent_root'
          : enteringSupportCount === 0
            ? 'unresolved'
            : hardSurvivorCount === 0
              ? 'independent_root'
              : 'downstream_consequence'
    return {
      requiredStopBaseVenueId: requiredStop.baseVenueId,
      requiredRole: requiredStop.requiredRole,
      result,
      relationship: relationshipStatus,
      ...(relationshipStatus === 'downstream_consequence' && downstreamCauses.length > 0
        ? { causedBy: downstreamCauses }
        : {}),
      enteringSupportCount,
      hardSurvivorCount,
      softSurvivorCount,
      ...(relationship ? {} : { missingRelationship: 'anchor_support_relationship_missing' }),
    }
  })

  const supportSupplyRelationship =
    enteringPlaceRight.total === 0
      ? 'unresolved'
      : afterHardConstraints.total === 0
        ? 'independent_root'
        : afterSoftConstraints.total === 0
          ? 'downstream_consequence'
          : 'independent_root'
  const finalSupportWorldBuildable =
    requiredStopSurvival.every((entry) => entry.result === 'pass') &&
    afterSoftConstraints.total > 0
  const finalSupportWorldRelationship =
    finalSupportWorldBuildable
      ? 'independent_root'
      : requiredStopSurvival.some((entry) => entry.relationship === 'downstream_consequence') ||
          supportSupplyRelationship === 'downstream_consequence'
        ? 'downstream_consequence'
        : supportSupplyRelationship

  const clusterEscapeFailed = params.structuralReasonCodes.includes(
    'place_right:cluster_escape_structure',
  )
  const supportProximityFailed = params.supportReasonCodes.includes(
    'place_right:poor_support_proximity',
  )
  const openClosedFailed = params.openClosedReasonCodes.length > 0
  const clauseEvidence: BearingsPlaceRightClauseEvidence[] = [
    {
      clause: 'cluster_escape_structure',
      disposition: 'soft',
      result: clusterEscapeFailed ? 'fail' : 'pass',
      subjectIds: input.districtFacts.stopBaseVenueIds,
      factualInputs: {
        clusterIds: input.districtFacts.clusterCoherence.clusterIds,
        clusterEscapeCount: input.districtFacts.clusterCoherence.clusterEscapeCount ?? 0,
        maxClusterEscapes:
          input.movementContract.tolerance === 'flexible'
            ? MAX_FLEXIBLE_CLUSTER_ESCAPES
            : MAX_ACCEPTABLE_CLUSTER_ESCAPES,
        repeatedClusterEscapeCount:
          input.districtFacts.clusterCoherence.repeatedClusterEscapeCount ?? 0,
        backtrackDetected:
          input.districtFacts.clusterCoherence.backtrackDetected === true,
      },
      relationship: clusterEscapeFailed ? 'independent_root' : 'independent_root',
    },
    {
      clause: 'support_proximity',
      disposition: 'soft',
      result: supportProximityFailed ? 'fail' : 'pass',
      subjectIds: enteringSupportIds,
      factualInputs: {
        requiresRouteContinuity:
          input.movementContract.requireContinuity === true ||
          input.movementContract.tolerance === 'contained',
        supportProximity: input.districtFacts.supportProximity,
      },
      relationship: supportProximityFailed ? 'independent_root' : 'independent_root',
      supplyBefore: afterHardConstraints,
      supplyAfter: afterSoftConstraints,
      rejectedCandidates: softRejectedCandidates,
    },
    {
      clause: 'support_supply_buildability',
      disposition:
        supportSupplyRelationship === 'independent_root' && afterHardConstraints.total === 0
          ? 'hard'
          : 'unclassified',
      result: params.supportReasonCodes.includes('place_right:support_supply_not_buildable')
        ? 'fail'
        : 'pass',
      subjectIds: enteringSupportIds,
      factualInputs: {
        supportSupplyFacts: input.supportSupplyFacts,
      },
      relationship: supportSupplyRelationship,
      ...(supportSupplyRelationship === 'downstream_consequence' && downstreamCauses.length > 0
        ? { causedBy: downstreamCauses }
        : {}),
      supplyBefore: enteringPlaceRight,
      supplyAfter: afterSoftConstraints,
      rejectedCandidates: [...hardRejectedCandidates, ...softRejectedCandidates],
    },
    {
      clause: 'required_stop_survival',
      disposition: 'hard',
      result:
        params.requiredStopSurvival.verdict.status === 'fail'
          ? 'fail'
          : params.requiredStopSurvival.verdict.status === 'pass'
            ? 'pass'
            : 'not_evaluated',
      subjectIds: input.requiredStopFacts.map((fact) => fact.baseVenueId),
      factualInputs: {
        requiredStopFacts: input.requiredStopFacts,
        requiredStopSurvival,
      },
      relationship: requiredStopSurvival.some((entry) => entry.relationship === 'downstream_consequence')
        ? 'downstream_consequence'
        : requiredStopSurvival.some((entry) => entry.relationship === 'unresolved')
          ? 'unresolved'
          : 'independent_root',
      ...(requiredStopSurvival.some((entry) => entry.relationship === 'downstream_consequence') &&
      downstreamCauses.length > 0
        ? { causedBy: downstreamCauses }
        : {}),
      supplyBefore: afterHardConstraints,
      supplyAfter: afterSoftConstraints,
      rejectedCandidates: softRejectedCandidates,
    },
    {
      clause: 'open_closed_viability',
      disposition: 'hard',
      result: openClosedFailed ? 'fail' : 'pass',
      subjectIds: input.openClosedFacts.map((fact) => fact.baseVenueId),
      factualInputs: {
        openClosedFacts: input.openClosedFacts,
      },
      relationship: openClosedFailed ? 'independent_root' : 'independent_root',
      rejectedCandidates: hardRejectedCandidates,
    },
  ]

  return {
    evaluationMode: {
      softClauseMode: params.softClauseMode,
      hardClauseMode: params.hardClauseMode,
    },
    routeId: input.routeId,
    candidateId: input.candidateId,
    softClausesObservedOnly:
      params.softClauseMode === 'observe_only'
        ? [...SOFT_PLACE_RIGHT_REASON_CODES]
        : [],
    hardClausesEnforced: [
      'place_right:district_provenance_missing',
      'place_right:district_structural_facts_missing',
      'place_right:required_stop_survival_failed',
      'place_right:open_closed_viability_failed',
      'place_right:stretch_not_admissible',
    ],
    clauseEvidence,
    supplyFunnel: {
      enteringPlaceRight,
      afterHardConstraints,
      afterSoftConstraints,
      hardRejectedCandidates,
      softRejectedCandidates,
      requiredStopSurvival,
      finalSupportWorld: {
        buildable: finalSupportWorldBuildable,
        relationship: finalSupportWorldRelationship,
        ...(finalSupportWorldRelationship === 'downstream_consequence' &&
        downstreamCauses.length > 0
          ? { causedBy: downstreamCauses }
          : {}),
        reasonCodes: unique([
          ...params.supportReasonCodes,
          ...params.requiredStopSurvival.verdict.reasonCodes,
        ]),
      },
    },
    retainedProductionReasons: params.retainedProductionReasons,
    observedOnlyReasons: params.observedOnlyReasons,
  }
}

function downstreamReasonCodesCausedBySoft(
  diagnostics: BearingsPlaceRightSupportWorldDiagnostics,
): string[] {
  return unique(
    diagnostics.clauseEvidence
      .filter(
        (evidence) =>
          evidence.result === 'fail' &&
          evidence.relationship === 'downstream_consequence' &&
          (evidence.causedBy ?? []).some((reason) => SOFT_PLACE_RIGHT_REASON_CODES.has(reason)),
      )
      .flatMap((evidence) => reasonCodesForClause(evidence.clause)),
  )
}

export function evaluateRoutePlaceRightEvidence(
  input: BearingsRouteFeasibilityInput,
  options: EvaluateRoutePlaceRightEvidenceOptions = {},
): BearingsPlaceRightVerdict {
  const softClauseMode = options.softClauseMode ?? 'enforce'
  const hardClauseMode = options.hardClauseMode ?? 'enforce'
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
    ...(requiresRouteContinuity
      ? input.supportSupplyFacts.flatMap((fact) =>
          fact.supportSupplyMissing ? ['place_right:support_supply_not_buildable'] : [],
        )
      : []),
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
  const preliminaryDiagnostics = buildSupportWorldDiagnostics({
    input,
    structuralReasonCodes,
    supportReasonCodes,
    requiredStopSurvival,
    openClosedReasonCodes,
    softClauseMode,
    hardClauseMode,
    retainedProductionReasons: reasons,
    observedOnlyReasons: [],
  })
  const observedOnlyReasonCodes =
    softClauseMode === 'observe_only'
      ? unique([
          ...reasons.filter((reason) => SOFT_PLACE_RIGHT_REASON_CODES.has(reason)),
          ...downstreamReasonCodesCausedBySoft(preliminaryDiagnostics),
        ])
      : []
  const retainedReasonCodes =
    softClauseMode === 'observe_only'
      ? reasons.filter((reason) => !observedOnlyReasonCodes.includes(reason))
      : reasons
  const retainedHardFailureReasons =
    softClauseMode === 'observe_only'
      ? hardFailureReasons.filter((reason) => !observedOnlyReasonCodes.includes(reason))
      : hardFailureReasons
  const supportWorldDiagnostics = buildSupportWorldDiagnostics({
    input,
    structuralReasonCodes,
    supportReasonCodes,
    requiredStopSurvival,
    openClosedReasonCodes,
    softClauseMode,
    hardClauseMode,
    retainedProductionReasons: retainedReasonCodes,
    observedOnlyReasons: observedOnlyReasonCodes,
  })
  const clauseAttribution = buildPlaceRightClauseAttribution({
    input,
    preClauseFailureReasons: retainedReasonCodes,
    hardFailureReasons: retainedHardFailureReasons,
  })
  const clauseRescued =
    softClauseMode === 'enforce' &&
    clauseAttribution.passedClauses.length > 0 &&
    retainedHardFailureReasons.length === 0
  const finalReasonCodes =
    softClauseMode === 'observe_only'
      ? retainedReasonCodes
      : clauseRescued
        ? []
        : retainedReasonCodes
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
    supportWorldDiagnostics,
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
