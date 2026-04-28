import type { SharedStopRepresentationRole } from '../types/stopRepresentation'

export type StopRepresentationRoleLabel = 'Start' | 'Highlight' | 'Surprise' | 'Wind-down'

export function getStopRepresentationRoleLabel(
  role: SharedStopRepresentationRole,
): StopRepresentationRoleLabel {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Wind-down'
}
