import type { CrewProfile, VenueVibeTag, VibeAnchor } from './intent'
import type {
  DurationClass,
  RouteContinuity,
  RouteMovementMode,
} from './pacing'
import type { PriceTier, VenueCategory } from './venue'

export type UserStopRole = 'start' | 'highlight' | 'surprise' | 'windDown'
export type UserStopTitle = 'Start' | 'Highlight' | 'Surprise' | 'Wind Down'

export interface StopInsider {
  roleReason: string
  localSignal: string
  selectionReason: string
}

export interface ItineraryStop {
  id: string
  role: UserStopRole
  title: UserStopTitle
  venueId: string
  venueName: string
  city: string
  category: VenueCategory
  subcategory: string
  priceTier: PriceTier
  tags: string[]
  vibeTags: VenueVibeTag[]
  neighborhood: string
  driveMinutes: number
  durationClass: DurationClass
  estimatedDurationMinutes: number
  estimatedDurationLabel: string
  subtitle: string
  note?: string
  imageUrl: string
  reasonLabels?: string[]
  selectedBecause?: string
  selectionConfidence?: number
  fallbackLabel?: string
  stopInsider: StopInsider
}

export interface ItineraryTransition {
  fromStopId: string
  toStopId: string
  estimatedTravelMinutes: number
  transitionBufferMinutes: number
  estimatedTransitionMinutes: number
  frictionScore: number
  movementMode: RouteMovementMode
  neighborhoodContinuity: RouteContinuity
}

export interface ItineraryStory {
  headline: string
  subtitle: string
}

export type StorySpinePhaseRole = 'start' | 'highlight' | 'winddown'

export interface StorySpinePhase {
  role: StorySpinePhaseRole
  label: string
  summary: string
}

export interface StorySpine {
  title: string
  phases: StorySpinePhase[]
  routeSummary: string
}

export interface Itinerary {
  id: string
  title: string
  city: string
  neighborhood?: string
  crew: CrewProfile
  vibes: VibeAnchor[]
  stops: ItineraryStop[]
  transitions: ItineraryTransition[]
  totalRouteFriction: number
  estimatedTotalMinutes: number
  estimatedTotalLabel: string
  routeFeelLabel: string
  story: ItineraryStory
  storySpine?: StorySpine
  shareSummary: string
}
