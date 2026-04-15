import type { UserStopRole, UserStopTitle } from '../types/itinerary'

export const stopTitles: Record<UserStopRole, UserStopTitle> = {
  start: 'Start',
  highlight: 'Highlight',
  surprise: 'Surprise',
  windDown: 'Wind Down',
}
