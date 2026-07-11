import type {
  BearingsFeasibilitySubVerdict,
  BearingsRouteFeasibilityStatus,
  BearingsRouteStopRole,
  DistrictRoutePlaceFacts,
} from './routePlaceRightContract'

export interface RouteSupportFeasibilityVerdict {
  status: BearingsRouteFeasibilityStatus
  reason: string
  requiredAnchorBaseVenueId?: string
  requiredAnchorNeighborhood?: string
  admissibleSupportBaseVenueIds: string[]
  supportSupplyMissing: boolean
  supportProximityVerdict: BearingsFeasibilitySubVerdict
  supportSupplyBuildabilityVerdict: BearingsFeasibilitySubVerdict
  requiredStopSurvivalVerdict: BearingsFeasibilitySubVerdict
  provenance: {
    source: 'bearings'
    version: string
    consumedDistrictProvenance: DistrictRoutePlaceFacts['provenance']
  }
}

export interface EvaluateRouteSupportFeasibilityInput {
  districtFacts: DistrictRoutePlaceFacts
  role: BearingsRouteStopRole
  requiredAnchorBaseVenueId?: string
}

const BEARINGS_ROUTE_SUPPORT_FEASIBILITY_VERSION = 'gw1-bearings-2'

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function getAnchorNeighborhood(districtFacts: DistrictRoutePlaceFacts): string | undefined {
  return districtFacts.sameNeighborhood.neighborhoods[0]
}

function buildSubVerdict(
  status: BearingsFeasibilitySubVerdict['status'],
  reasonCodes: string[],
  notes?: string[],
): BearingsFeasibilitySubVerdict {
  return {
    status,
    reasonCodes,
    ...(notes && notes.length > 0 ? { notes } : {}),
  }
}

export function evaluateRouteSupportFeasibility(
  input: EvaluateRouteSupportFeasibilityInput,
): RouteSupportFeasibilityVerdict {
  const { districtFacts, role, requiredAnchorBaseVenueId } = input
  const requiredAnchorNeighborhood = getAnchorNeighborhood(districtFacts)
  const structuralMissing = districtFacts.structuralConfidence.status === 'missing'
  const missingReasons = districtFacts.structuralConfidence.missingFactReasons
  const nonBlockingStructuralNotes = [
    ...(districtFacts.compactness.missingFactReasons ?? []),
    ...(districtFacts.clusterCoherence.missingFactReasons ?? []),
  ]

  if (!requiredAnchorBaseVenueId || !requiredAnchorNeighborhood || structuralMissing) {
    const reason = 'required_anchor_neighborhood_not_available'
    return {
      status: 'unknown',
      reason,
      requiredAnchorBaseVenueId,
      requiredAnchorNeighborhood,
      admissibleSupportBaseVenueIds: [],
      supportSupplyMissing: true,
      supportProximityVerdict: buildSubVerdict('unknown', [reason], [
        ...missingReasons,
        ...nonBlockingStructuralNotes,
      ]),
      supportSupplyBuildabilityVerdict: buildSubVerdict('fail', ['support_supply_missing']),
      requiredStopSurvivalVerdict: buildSubVerdict('unknown', [reason], [
        ...missingReasons,
        ...nonBlockingStructuralNotes,
      ]),
      provenance: {
        source: 'bearings',
        version: BEARINGS_ROUTE_SUPPORT_FEASIBILITY_VERSION,
        consumedDistrictProvenance: districtFacts.provenance,
      },
    }
  }

  const relationship = districtFacts.anchorSupportRelationships.find(
    (entry) => entry.anchorBaseVenueId === requiredAnchorBaseVenueId,
  )
  const supportBaseVenueIds = unique(
    districtFacts.supportProximity
      .filter(
        (fact) =>
          fact.anchorBaseVenueId === requiredAnchorBaseVenueId &&
          fact.supportRole === role &&
          fact.sameNeighborhood === true,
      )
      .map((fact) => fact.supportBaseVenueId),
  )
  const relationshipSupportBaseVenueIds = relationship?.supportBaseVenueIds ?? []
  const admissibleSupportBaseVenueIds = unique([
    ...supportBaseVenueIds,
    ...relationshipSupportBaseVenueIds,
  ])
  const supportSupplyMissing = admissibleSupportBaseVenueIds.length === 0
  const reason = supportSupplyMissing
    ? 'support_supply_missing'
    : 'tight_build_same_neighborhood_support_available'
  const status: BearingsRouteFeasibilityStatus = supportSupplyMissing ? 'fail' : 'pass'

  return {
    status,
    reason,
    requiredAnchorBaseVenueId,
    requiredAnchorNeighborhood,
    admissibleSupportBaseVenueIds,
    supportSupplyMissing,
    supportProximityVerdict: buildSubVerdict(status, [reason], nonBlockingStructuralNotes),
    supportSupplyBuildabilityVerdict: buildSubVerdict(status, [reason], nonBlockingStructuralNotes),
    requiredStopSurvivalVerdict: buildSubVerdict('pass', [
      'required_anchor_structural_context_available',
    ]),
    provenance: {
      source: 'bearings',
      version: BEARINGS_ROUTE_SUPPORT_FEASIBILITY_VERSION,
      consumedDistrictProvenance: districtFacts.provenance,
    },
  }
}
