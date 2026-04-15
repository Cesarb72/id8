import type { UserStopRole } from '../types/itinerary'
import type { InternalRole } from '../types/venue'

export const roleProjection: Record<InternalRole, UserStopRole> = {
  warmup: 'start',
  peak: 'highlight',
  wildcard: 'surprise',
  cooldown: 'windDown',
}

export const inverseRoleProjection: Record<UserStopRole, InternalRole> = {
  start: 'warmup',
  highlight: 'peak',
  surprise: 'wildcard',
  windDown: 'cooldown',
}
