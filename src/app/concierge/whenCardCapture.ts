import {
  buildWhenSignalProfile,
  type ConciergeCardInputDraft,
  type ConciergeCardSpatialMode,
  type ConciergeCardWhenDraft,
  type WhenSignalPosture,
} from '../types/conciergeCardInput'

export interface ConciergeCardWhenCaptureUpdate {
  whenPosture?: WhenSignalPosture
  startTime?: string
  durationMinutes?: number | null
  spatialMode?: ConciergeCardSpatialMode
}

export function buildDefaultConciergeCardWhenDraft(): ConciergeCardWhenDraft {
  return {
    startTime: undefined,
    durationMinutes: null,
    spatialMode: 'WALKABLE',
  }
}

export function applyConciergeCardWhenCapture(
  current: ConciergeCardInputDraft,
  update: ConciergeCardWhenCaptureUpdate,
): ConciergeCardInputDraft {
  const userTouchedWhen = Object.keys(update).length > 0
  const requestedPosture =
    'whenPosture' in update
      ? update.whenPosture
      : current.when.whenPosture ?? (userTouchedWhen ? 'now_doable_tonight' : undefined)
  const whenPosture = requestedPosture
  const durationMinutes =
    'durationMinutes' in update
      ? update.durationMinutes ?? null
      : current.when.durationMinutes
  const startTime =
    whenPosture === 'pick_a_time'
      ? ('startTime' in update ? update.startTime : current.when.startTime)?.trim() || undefined
      : undefined
  const spatialMode = update.spatialMode ?? current.when.spatialMode

  const when: ConciergeCardWhenDraft = {
    whenPosture,
    whenPostureSource:
      whenPosture && userTouchedWhen ? 'user_supplied' : current.when.whenPostureSource,
    startTime,
    durationMinutes,
    durationSource:
      'durationMinutes' in update
        ? durationMinutes == null
          ? undefined
          : 'user_supplied'
        : current.when.durationSource,
    spatialMode,
    flexibilitySource: 'spatialMode' in update ? 'user_supplied' : current.when.flexibilitySource,
  }

  return {
    ...current,
    when,
    whenSignalProfile: buildWhenSignalProfile(when),
  }
}
