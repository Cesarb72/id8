import type {
  ConciergeCardInputDraft,
} from '../types/conciergeCardInput'
import type {
  ConciergeObjectiveOccasion,
  ConciergeObjectiveSource,
} from '../../domain/types/intent'

export interface ConciergeCardObjectiveCaptureUpdate {
  objectiveOccasion?: ConciergeObjectiveOccasion
}

export interface ConciergeCardObjectiveCaptureDraft {
  objectiveOccasion: ConciergeObjectiveOccasion
  objectiveSource: ConciergeObjectiveSource
  objectiveDefaulted: boolean
}

export function buildDefaultConciergeCardObjectiveDraft(): ConciergeCardObjectiveCaptureDraft {
  return {
    objectiveOccasion: 'connect',
    objectiveSource: 'defaulted',
    objectiveDefaulted: true,
  }
}

export function applyConciergeCardObjectiveCapture(
  current: ConciergeCardInputDraft,
  update: ConciergeCardObjectiveCaptureUpdate,
): ConciergeCardInputDraft {
  if (!('objectiveOccasion' in update) || !update.objectiveOccasion) {
    const defaulted = buildDefaultConciergeCardObjectiveDraft()
    return {
      ...current,
      objectiveOccasion: defaulted.objectiveOccasion,
      objectiveSource: defaulted.objectiveSource,
      objectiveDefaulted: defaulted.objectiveDefaulted,
    }
  }

  return {
    ...current,
    objectiveOccasion: update.objectiveOccasion,
    objectiveSource: 'user_supplied',
    objectiveDefaulted: false,
  }
}
