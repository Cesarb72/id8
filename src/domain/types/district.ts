import type { TasteOpportunityAggregation } from '../interpretation/taste/aggregateTasteOpportunityFromVenues'

export type DistrictAnchorSource =
  | 'explicit_district'
  | 'explicit_neighborhood'
  | 'inferred_district'
  | 'inferred_cluster'
  | 'city_fallback'

export interface DistrictAnchor {
  districtId: string
  districtLabel: string
  source: DistrictAnchorSource
  confidence: number
  reason: string
}

export interface DistrictRecommendation {
  districtId: string
  label: string
  score: number
  tasteAggregation?: TasteOpportunityAggregation
  districtExplanation: {
    summary: string
    tone: string
    highlights: string[]
  }
  districtInsider: {
    whyNow: string
    whyYou: string
    whatStandsOut: string
  }
  signals: {
    density: number
    relevance: number
    diversity: number
    energy: number
  }
  reason: string
  debug?: {
    adjustedDensity: number
    affinity: number
    vibeAffinity: number
    crewAffinity: number
    signature: number
    coherence: number
    sequenceSupport: number
    startStrength: number
    highlightStrength: number
    winddownStrength: number
    roleFitScore: number
    roleFitAdjustment: number
    roleWeights: {
      start: number
      highlight: number
      winddown: number
    }
    alignmentLift: number
    breadthPenalty: number
    sparsityPenalty: number
    componentBreakdown: {
      density: number
      relevance: number
      diversity: number
      energy: number
      affinity: number
      signature: number
      coherence: number
      sequenceSupport: number
      roleFit: number
    }
  }
}
