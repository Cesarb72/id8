export type MomentType =
  | 'live_performance'
  | 'social_ritual'
  | 'tasting'
  | 'cultural_activation'
  | 'seasonal_activation'
  | 'scenic_moment'

export type MomentTimeWindow = 'day' | 'evening' | 'late' | 'flexible'

export type MomentSourceType = 'curated' | 'inferred'

export interface Moment {
  id: string
  title: string
  parentPlaceId?: string
  momentType: MomentType
  timeWindow: MomentTimeWindow
  energy: number
  romanticPotential: number
  uniquenessScore: number
  sourceType: MomentSourceType
  district?: string
}
