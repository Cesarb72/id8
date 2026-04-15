import type { ArcStop } from '../types/arc'
import type { EstimatedStopDuration, EstimatedTransition, RouteContinuity, RouteMovementMode } from '../types/pacing'

interface ComputeTransitionFrictionInput {
  fromStop: ArcStop
  toStop: ArcStop
  fromDuration: EstimatedStopDuration
  toDuration: EstimatedStopDuration
  priorDistinctNeighborhoods: number
}

function getMovementMode(
  sameNeighborhood: boolean,
  driveGap: number,
): RouteMovementMode {
  if (sameNeighborhood && driveGap <= 4) {
    return 'walkable'
  }
  if (driveGap <= 7) {
    return 'short-drive'
  }
  return 'drive'
}

function getNeighborhoodContinuity(
  sameNeighborhood: boolean,
  driveGap: number,
): RouteContinuity {
  if (sameNeighborhood) {
    return 'same-neighborhood'
  }
  if (driveGap <= 7) {
    return 'adjacent-neighborhoods'
  }
  return 'spread'
}

function getEnergyMismatchPenalty(fromStop: ArcStop, toStop: ArcStop): { penalty: number; note?: string } {
  const fromEnergy = fromStop.scoredVenue.venue.energyLevel
  const toEnergy = toStop.scoredVenue.venue.energyLevel
  const delta = toEnergy - fromEnergy

  if (toStop.role === 'cooldown' && delta >= 2) {
    return { penalty: 1, note: 'late energy spike into the finish' }
  }
  if (fromStop.role === 'warmup' && toStop.role === 'peak' && delta <= -2) {
    return { penalty: 1, note: 'momentum dips before the centerpiece' }
  }
  if (Math.abs(delta) >= 3) {
    return { penalty: 1, note: 'noticeable energy mismatch between stops' }
  }
  return { penalty: 0 }
}

export function computeTransitionFriction({
  fromStop,
  toStop,
  fromDuration,
  toDuration,
  priorDistinctNeighborhoods,
}: ComputeTransitionFrictionInput): EstimatedTransition {
  const fromVenue = fromStop.scoredVenue.venue
  const toVenue = toStop.scoredVenue.venue
  const sameNeighborhood = fromVenue.neighborhood === toVenue.neighborhood
  const driveGap = Math.abs(fromVenue.driveMinutes - toVenue.driveMinutes)
  const movementMode = getMovementMode(sameNeighborhood, driveGap)
  const neighborhoodContinuity = getNeighborhoodContinuity(sameNeighborhood, driveGap)
  const estimatedTravelMinutes =
    movementMode === 'walkable'
      ? Math.max(5, 5 + Math.round(driveGap / 2))
      : movementMode === 'short-drive'
        ? 8 + Math.round(driveGap * 0.75)
        : 11 + Math.round(driveGap * 0.85)
  const transitionBufferMinutes =
    movementMode === 'walkable' ? 4 : movementMode === 'short-drive' ? 6 : 8

  let frictionScore =
    sameNeighborhood && driveGap <= 2
      ? 0
      : sameNeighborhood || driveGap <= 4
        ? 1
        : driveGap <= 8
          ? 2
          : driveGap <= 12
            ? 3
            : 4

  const notes: string[] = []
  if (sameNeighborhood) {
    notes.push('same-neighborhood handoff')
  } else if (driveGap <= 7) {
    notes.push('short neighborhood transfer')
  } else {
    notes.push('longer cross-city transfer')
  }

  if (priorDistinctNeighborhoods >= 2 && !sameNeighborhood) {
    frictionScore += 1
    notes.push('route keeps spreading across neighborhoods')
  }

  const energyMismatch = getEnergyMismatchPenalty(fromStop, toStop)
  frictionScore += energyMismatch.penalty
  if (energyMismatch.note) {
    notes.push(energyMismatch.note)
  }

  if (fromDuration.durationClass === 'XS' && driveGap >= 8) {
    frictionScore += 1
    notes.push('brief stop followed by a larger move')
  }

  if (toStop.role === 'cooldown' && !sameNeighborhood && toVenue.driveMinutes > 18) {
    frictionScore += 1
    notes.push('wind-down lands farther from base')
  }

  if (toDuration.durationClass === 'XS' && driveGap >= 10) {
    frictionScore += 1
    notes.push('travel load feels heavy relative to the next stop')
  }

  return {
    fromRoleKey: fromStop.role,
    toRoleKey: toStop.role,
    fromVenueId: fromVenue.id,
    toVenueId: toVenue.id,
    estimatedTravelMinutes,
    transitionBufferMinutes,
    estimatedTransitionMinutes: estimatedTravelMinutes + transitionBufferMinutes,
    frictionScore,
    movementMode,
    neighborhoodContinuity,
    energyDelta: toVenue.energyLevel - fromVenue.energyLevel,
    notes,
  }
}
