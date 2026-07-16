export type BearingsRouteFeasibilityStatus = 'pass' | 'fail' | 'unknown'

export type BearingsRouteFeasibilityEvidenceStatus =
  | BearingsRouteFeasibilityStatus
  | 'not_applicable'

export type BearingsRouteTravelPosture =
  | 'walkable'
  | 'limited_drive'
  | 'drive_like'
  | 'unknown'

export type BearingsRouteMovementTolerance =
  | 'contained'
  | 'compressed'
  | 'flexible'
  | 'unknown'

export type BearingsRouteStopRole =
  | 'start'
  | 'warmup'
  | 'peak'
  | 'highlight'
  | 'wildcard'
  | 'cooldown'
  | 'windDown'
  | 'support'
  | 'unknown'

export interface DistrictRoutePlaceFactsProvenance {
  source: 'district'
  version: string
  evidenceIds?: string[]
  notes?: string[]
}

export interface BearingsRouteFeasibilityProvenance {
  source: 'bearings'
  version: string
  policyId?: string
  notes?: string[]
}

export interface DistrictRouteSameNeighborhoodFacts {
  allStopsSameNeighborhood?: boolean
  neighborhoods: string[]
  mismatchedStopBaseVenueIds?: string[]
  confidence?: number
  missingFactReasons?: string[]
}

export interface DistrictRouteClusterCoherenceFacts {
  homeClusterId?: string
  clusterIds: string[]
  clusterEscapeCount?: number
  repeatedClusterEscapeCount?: number
  longTransitionCount?: number
  backtrackDetected?: boolean
  confidence?: number
  missingFactReasons?: string[]
}

export interface DistrictRouteCompactnessFacts {
  compactnessScore?: number
  routeRadiusM?: number
  maxPairwiseDistanceM?: number
  centroid?: {
    lat: number
    lng: number
  }
  confidence?: number
  missingFactReasons?: string[]
}

export interface DistrictRouteSupportProximityFact {
  supportBaseVenueId: string
  supportRole?: BearingsRouteStopRole
  anchorBaseVenueId?: string
  sameNeighborhood?: boolean
  sameCluster?: boolean
  distanceMeters?: number
  confidence?: number
  missingFactReasons?: string[]
}

export interface DistrictRouteAnchorSupportRelationshipFact {
  anchorBaseVenueId: string
  supportBaseVenueIds: string[]
  sameNeighborhoodSupportCount?: number
  sameClusterSupportCount?: number
  nearestSupportDistanceMeters?: number
  confidence?: number
  missingFactReasons?: string[]
}

export interface DistrictRouteStructuralConfidence {
  status: 'complete' | 'partial' | 'missing'
  missingFactReasons: string[]
  notes?: string[]
}

// District -> Bearings: structural place facts only. District measures route
// shape and proximity; Bearings consumes these facts and judges feasibility.
// Canonical stop identity uses candidateIdentity.baseVenueId, not provider id,
// display name, or rendered label identity.
export interface DistrictRoutePlaceFacts {
  routeId?: string
  candidateId?: string
  stopBaseVenueIds: string[]
  requiredStopBaseVenueIds?: string[]
  sameNeighborhood: DistrictRouteSameNeighborhoodFacts
  clusterCoherence: DistrictRouteClusterCoherenceFacts
  compactness: DistrictRouteCompactnessFacts
  supportProximity: DistrictRouteSupportProximityFact[]
  anchorSupportRelationships: DistrictRouteAnchorSupportRelationshipFact[]
  structuralConfidence: DistrictRouteStructuralConfidence
  provenance: DistrictRoutePlaceFactsProvenance
}

export interface BearingsRouteRoleFact {
  baseVenueId: string
  routeRole: BearingsRouteStopRole
  requiredRole?: BearingsRouteStopRole
  isRequiredStop?: boolean
  isSelectedAnchor?: boolean
  isPeakCandidate?: boolean
}

export interface BearingsRequiredStopFact {
  baseVenueId: string
  requiredRole: BearingsRouteStopRole
  survivalRequired: boolean
  source: 'build_anchor' | 'user_contract' | 'compatibility'
}

export interface BearingsOpenClosedFact {
  baseVenueId: string
  status: 'open' | 'likely_open' | 'likely_closed' | 'closed' | 'unknown'
  confidence?: number
  reasonCodes?: string[]
}

export interface BearingsDistanceTransitionFact {
  fromBaseVenueId: string
  toBaseVenueId: string
  estimatedTransitionMinutes?: number
  driveMinutes?: number
  walkMinutes?: number
  travelPosture?: BearingsRouteTravelPosture
  evidenceSource?: string
}

export interface BearingsDistanceBurdenFacts {
  totalEstimatedTransitionMinutes?: number
  maxSingleTransitionMinutes?: number
  transitions: BearingsDistanceTransitionFact[]
  reasonCodes?: string[]
}

export interface BearingsMovementContractFacts {
  tolerance: BearingsRouteMovementTolerance
  travelPosture?: BearingsRouteTravelPosture
  spatialMode?: 'walkable' | 'flexible'
  requireContinuity?: boolean
  reasonCodes?: string[]
}

export interface BearingsSupportSupplyFact {
  role: BearingsRouteStopRole
  anchorBaseVenueId?: string
  nearbyCandidateCount?: number
  supportSupplyMissing?: boolean
  reasonCodes?: string[]
}

export interface BearingsTasteStretchEvidence {
  baseVenueId: string
  stretchWorthiness: 'worth_it' | 'not_worth_it' | 'unknown'
  source: 'taste'
  localSupplyInsufficient?: boolean
  strongerNearbyishMoment?: boolean
  boundedStretchRespected?: boolean
  stretchApplied?: boolean
  reasonCodes?: string[]
}

export type BearingsPlaceRightClauseName =
  | 'same_district'
  | 'walkable_cluster'
  | 'deliberate_movement'

export interface BearingsPlaceRightClauseVerdict {
  clause: BearingsPlaceRightClauseName
  status: BearingsRouteFeasibilityStatus
  evidence: string[]
  nonPassReasons: string[]
}

export interface BearingsPlaceRightClauseAttribution {
  sameDistrict: BearingsPlaceRightClauseVerdict
  walkableCluster: BearingsPlaceRightClauseVerdict
  deliberateMovement: BearingsPlaceRightClauseVerdict
  passedClauses: BearingsPlaceRightClauseName[]
  rescueSource: BearingsPlaceRightClauseName[] | 'none'
  blockedByHardFailure: boolean
  hardFailureReasons: string[]
  preClauseFailureReasons: string[]
}

export interface BearingsRouteFeasibilityInput {
  routeId?: string
  candidateId?: string
  districtFacts: DistrictRoutePlaceFacts
  roleFacts: BearingsRouteRoleFact[]
  requiredStopFacts: BearingsRequiredStopFact[]
  openClosedFacts: BearingsOpenClosedFact[]
  distanceFacts: BearingsDistanceBurdenFacts
  movementContract: BearingsMovementContractFacts
  supportSupplyFacts: BearingsSupportSupplyFact[]
  tasteStretchEvidence?: BearingsTasteStretchEvidence[]
}

export interface BearingsFeasibilitySubVerdict {
  status: BearingsRouteFeasibilityEvidenceStatus
  reasonCodes: string[]
  notes?: string[]
}

export interface BearingsDistanceBurdenVerdict extends BearingsFeasibilitySubVerdict {
  burden: 'low' | 'moderate' | 'high' | 'unknown'
}

export interface BearingsStopLevelFeasibilityEvidence {
  baseVenueId: string
  status: BearingsRouteFeasibilityStatus
  role?: BearingsRouteStopRole
  distanceBurden?: BearingsFeasibilitySubVerdict
  openClosedViability?: BearingsFeasibilitySubVerdict
  requiredStopSurvival?: BearingsFeasibilitySubVerdict
  reasonCodes: string[]
}

export interface BearingsRouteLevelFeasibilityEvidence {
  status: BearingsRouteFeasibilityStatus
  distanceBurden: BearingsDistanceBurdenVerdict
  movementToleranceFit: BearingsFeasibilitySubVerdict
  stretchAdmissibility: BearingsFeasibilitySubVerdict
  supportProximity: BearingsFeasibilitySubVerdict
  supportSupplyBuildability: BearingsFeasibilitySubVerdict
  requiredStopSurvival: BearingsFeasibilitySubVerdict
  openClosedViability: BearingsFeasibilitySubVerdict
  reasonCodes: string[]
}

export interface BearingsPlaceRightCompatibilityValues {
  greatStopPlaceRightStatus?: BearingsRouteFeasibilityStatus
  greatStopPlaceRightReasonCodes?: string[]
  distanceBurdenSummary?: string
  movementToleranceSummary?: string
  supportBuildabilitySummary?: string
}

// Bearings verdict output. Bearings judges feasibility from already-authored
// evidence; it must not recompute District structural facts.
export interface BearingsRouteFeasibilityVerdict {
  placeRightReady: boolean
  status: BearingsRouteFeasibilityStatus
  reasons: string[]
  distanceBurden: BearingsDistanceBurdenVerdict
  movementToleranceFit: BearingsFeasibilitySubVerdict
  stretchAdmissibility: BearingsFeasibilitySubVerdict
  supportProximityVerdict: BearingsFeasibilitySubVerdict
  supportSupplyBuildabilityVerdict: BearingsFeasibilitySubVerdict
  requiredStopSurvivalVerdict: BearingsFeasibilitySubVerdict
  openClosedViabilityVerdict: BearingsFeasibilitySubVerdict
  stopEvidence: BearingsStopLevelFeasibilityEvidence[]
  routeEvidence: BearingsRouteLevelFeasibilityEvidence
  clauseAttribution?: BearingsPlaceRightClauseAttribution
  compatibility: BearingsPlaceRightCompatibilityValues
  provenance: BearingsRouteFeasibilityProvenance
}

export type BearingsPlaceRightVerdict = BearingsRouteFeasibilityVerdict
