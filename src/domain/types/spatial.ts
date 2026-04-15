import type { DistanceMode } from './intent'

export type SpatialMode = 'walkable' | 'flexible'

export interface SpatialClusterAssignment {
  venueId: string
  venueName: string
  neighborhood: string
  clusterId: string
}

export interface SpatialTransitionAnalysis {
  fromVenueId: string
  toVenueId: string
  fromClusterId: string
  toClusterId: string
  fromNeighborhood: string
  toNeighborhood: string
  driveGap: number
  sameCluster: boolean
  clusterEscape: boolean
  longTransition: boolean
  jumpUsed: boolean
  scoreDelta: number
  notes: string[]
}

export interface SpatialCoherenceAnalysis {
  mode: SpatialMode
  homeClusterId: string
  clustersVisited: string[]
  clusterAssignments: SpatialClusterAssignment[]
  transitions: SpatialTransitionAnalysis[]
  sameClusterTransitionCount: number
  clusterEscapeCount: number
  repeatedClusterEscapeCount: number
  longTransitionCount: number
  jumpUsed: boolean
  spatialBonus: number
  spatialPenalty: number
  score: number
  notes: string[]
}

export function getSpatialMode(distanceMode: DistanceMode): SpatialMode {
  return distanceMode === 'nearby' ? 'walkable' : 'flexible'
}
