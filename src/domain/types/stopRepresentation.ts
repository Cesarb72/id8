export type SharedStopRepresentationRole = 'start' | 'highlight' | 'surprise' | 'windDown'

export interface VenueCardStopRepresentation {
  venueName: string
  role: SharedStopRepresentationRole
  roleLabel: string
  fitSummary: string
  mediaUrl?: string
  venueType?: string
  areaName?: string
  knownFor?: string
  areaFitSummary?: string
}

export interface VenueCardDetailInput {
  whyItFits?: string
  stopNarrativeRoleMeaning?: string
  stopFlavorSummary?: string
  localSignal?: string
  aroundHereSignals?: string[]
}

export interface VenueCardFallbackStopSeed {
  venueId?: string
  venueName: string
  fitSummary: string
  knownFor?: string
  areaName?: string
  venueType?: string
  areaFitSummary?: string
}

export interface VenueCardStopRepresentationWithSource extends VenueCardStopRepresentation {
  mediaUrl: string
  mediaAlt: string
  source: 'planning_stop' | 'fallback_seed'
}
