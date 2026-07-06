import type { PersonaMode } from './intent'
import type { UserStopRole } from './itinerary'

export type GreatStopGateStatus = 'PASS' | 'FAIL'

export type GreatStopGateCriterion =
  | 'real'
  | 'role_right'
  | 'intent_right'
  | 'place_right'
  | 'moment_right'

export type BuildLocationClass = 'L1 Dense' | 'L2 Mid' | 'L3 Sparse'

export type GreatStopTravelTolerance = 'tight' | 'balanced' | 'expanded'

export type GreatStopGatePresetSource = 'explicit' | 'inferred_from_distance_mode'

export interface GreatStopCriterionResult {
  passed: boolean
  reasons: string[]
}

export interface GreatStopRequiredAnchorResult {
  venueId: string
  role: UserStopRole
  survived: boolean
  creditedRole?: UserStopRole
}

export interface GreatStopGatePreset {
  persona: PersonaMode
  locationClass: BuildLocationClass
  travelTolerance: GreatStopTravelTolerance
  source: GreatStopGatePresetSource
}

export interface GreatStopGateDiagnostics {
  movement: {
    totalEstimatedTransitionMinutes: number
    maxSingleTransitionMinutes: number
    transitionCount: number
    driveLikeMovement: boolean
    transitionLimitMinutes: number
    totalLimitMinutes: number
  }
  clusterCoherence: {
    clusterEscapeCount: number
    repeatedClusterEscapeCount: number
    longTransitionCount: number
    maxClusterEscapes: number
    spatialScore: number
    notes: string[]
  }
  zigzagOrBacktrack: {
    detected: boolean
    reason?: string
  }
  arcProgression: {
    startPresent: boolean
    highlightPresent: boolean
    windDownPresent: boolean
    peakRoleAdvantage: number
    supportAverageRoleFit: number
    energyProgressionValid: boolean
  }
  laneVariance: {
    uniqueLaneCount: number
    laneRepetitionCount: number
    supportLaneVariance: number
  }
  strongMoment: {
    present: boolean
    note?: string
    highlightMomentScore?: number
    momentStrengthScore?: number
    momentFlatPenalty?: number
  }
}

export interface GreatStopGateResult {
  status: GreatStopGateStatus
  failedCriteria: GreatStopGateCriterion[]
  reasons: string[]
  routeId: string
  requiredAnchor?: GreatStopRequiredAnchorResult
  criteria: {
    real: GreatStopCriterionResult
    roleRight: GreatStopCriterionResult
    intentRight: GreatStopCriterionResult
    placeRight: GreatStopCriterionResult
    momentRight: GreatStopCriterionResult
  }
  preset: GreatStopGatePreset
  diagnostics: GreatStopGateDiagnostics
}
