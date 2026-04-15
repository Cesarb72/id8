import { inverseRoleProjection } from '../config/roleProjection'
import type { TasteHyperlocalTemporalLabel } from '../interpretation/taste/types'
import type { ScoredVenue } from '../types/arc'
import type { ItineraryStop, UserStopRole } from '../types/itinerary'

interface BuildTonightSignalsInput {
  stop: ItineraryStop
  scoredVenue?: ScoredVenue
  roleTravelWindowMinutes?: number
  nearbySummary?: string
  nearbyOptionsCount?: number
}

type ActivityState = 'active' | 'steady' | 'calm'
type ClusterDensity = 'tight' | 'moderate' | 'spread'

function toTagSet(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.toLowerCase()))
}

function inferEnergyFromStop(stop: ItineraryStop, tags: Set<string>): number {
  let energy = 0.56
  if (stop.category === 'live_music' || stop.category === 'event') {
    energy += 0.22
  } else if (stop.category === 'bar' || stop.category === 'activity') {
    energy += 0.14
  } else if (stop.category === 'cafe' || stop.category === 'dessert' || stop.category === 'park') {
    energy -= 0.12
  }

  if (tags.has('high-energy') || tags.has('late-night') || tags.has('live')) {
    energy += 0.1
  }
  if (tags.has('quiet') || tags.has('cozy') || tags.has('conversation')) {
    energy -= 0.12
  }
  return Math.max(0, Math.min(1, energy))
}

function inferSocialDensityFromStop(stop: ItineraryStop, tags: Set<string>): number {
  let social = 0.54
  if (stop.category === 'bar' || stop.category === 'live_music' || stop.category === 'event') {
    social += 0.16
  }
  if (stop.category === 'cafe' || stop.category === 'park' || stop.category === 'museum') {
    social -= 0.1
  }
  if (tags.has('social') || tags.has('crowded')) {
    social += 0.12
  }
  if (tags.has('quiet') || tags.has('intimate')) {
    social -= 0.14
  }
  return Math.max(0, Math.min(1, social))
}

function inferMomentIntensityFromStop(
  role: UserStopRole,
  stop: ItineraryStop,
  tags: Set<string>,
): number {
  let intensity = role === 'highlight' ? 0.7 : role === 'windDown' ? 0.46 : 0.5
  if (stop.category === 'live_music' || stop.category === 'event') {
    intensity += 0.14
  } else if (stop.category === 'bar' || stop.category === 'activity') {
    intensity += 0.08
  } else if (stop.category === 'cafe' || stop.category === 'dessert') {
    intensity -= 0.08
  }
  if (tags.has('high-energy') || tags.has('late-night')) {
    intensity += 0.08
  }
  if (tags.has('quiet') || tags.has('cozy')) {
    intensity -= 0.1
  }
  return Math.max(0, Math.min(1, intensity))
}

function inferTemporalLabel(tags: Set<string>): TasteHyperlocalTemporalLabel {
  if (tags.has('late-night') || tags.has('live') || tags.has('event')) {
    return 'active'
  }
  if (tags.has('quiet') || tags.has('cozy') || tags.has('tea-room')) {
    return 'background'
  }
  return 'timely'
}

function getActivityState(
  socialDensity: number,
  energy: number,
  temporalLabel: TasteHyperlocalTemporalLabel,
): ActivityState {
  if (temporalLabel === 'active' || socialDensity >= 0.68 || energy >= 0.72) {
    return 'active'
  }
  if (temporalLabel === 'background' || (socialDensity <= 0.46 && energy <= 0.5)) {
    return 'calm'
  }
  return 'steady'
}

function getClusterDensity(localTravelMinutes: number, nearbyOptionsCount?: number): ClusterDensity {
  if (localTravelMinutes <= 12 || (nearbyOptionsCount ?? 0) >= 5) {
    return 'tight'
  }
  if (localTravelMinutes >= 20 || (nearbyOptionsCount ?? 0) <= 1) {
    return 'spread'
  }
  return 'moderate'
}

function getEnergyBand(energy: number): 'low' | 'moderate' | 'high' {
  if (energy >= 0.7) {
    return 'high'
  }
  if (energy <= 0.46) {
    return 'low'
  }
  return 'moderate'
}

function getIntensityBand(intensity: number): 'high' | 'moderate' | 'low' {
  if (intensity >= 0.72) {
    return 'high'
  }
  if (intensity <= 0.5) {
    return 'low'
  }
  return 'moderate'
}

function getRoleFitBand(roleFit: number | undefined): 'high' | 'solid' | 'light' {
  if (typeof roleFit !== 'number') {
    return 'solid'
  }
  if (roleFit >= 0.68) {
    return 'high'
  }
  if (roleFit >= 0.52) {
    return 'solid'
  }
  return 'light'
}

function getTimingLine(role: UserStopRole, activityState: ActivityState): string {
  if (role === 'start') {
    return activityState === 'active'
      ? 'Best early before things speed up.'
      : 'Best at the front of the night.'
  }
  if (role === 'highlight') {
    return activityState === 'active'
      ? 'Best a little later once the area picks up.'
      : 'Best once the night starts to build.'
  }
  if (role === 'windDown') {
    return activityState === 'calm'
      ? 'Best late when things settle down.'
      : 'Best after the big moment.'
  }
  return 'Best when you want a flexible pivot.'
}

function getEnergyLine(
  role: UserStopRole,
  energyBand: 'low' | 'moderate' | 'high',
  intensityBand: 'high' | 'moderate' | 'low',
  roleFitBand: 'high' | 'solid' | 'light',
): string {
  if (role === 'highlight') {
    if (intensityBand === 'high' || energyBand === 'high') {
      return 'This is where the night peaks.'
    }
    if (roleFitBand === 'high') {
      return 'This is the strongest stop in the lineup.'
    }
    return 'This is the center of gravity tonight.'
  }
  if (role === 'windDown') {
    if (energyBand === 'low' || intensityBand === 'low') {
      return 'This helps the night land softly.'
    }
    if (roleFitBand === 'high') {
      return 'This gives you a clean release.'
    }
    return 'This keeps the close easy to linger in.'
  }
  if (role === 'start') {
    if (energyBand === 'low' || roleFitBand === 'high') {
      return 'This is an easy way to get started.'
    }
    if (energyBand === 'high') {
      return 'This gets things moving without overcommitting.'
    }
    return 'This is where things start to build.'
  }
  return 'This keeps your night moving without a reset.'
}

function getContextLine(
  role: UserStopRole,
  activityState: ActivityState,
  clusterDensity: ClusterDensity,
  localTravelMinutes: number,
): string {
  const roundedTravel = Math.max(1, Math.round(localTravelMinutes))
  if (role === 'highlight') {
    if (activityState === 'active') {
      return 'Around here stays busy later into the night.'
    }
    if (activityState === 'calm') {
      return 'Around here feels calmer than the main strip.'
    }
    return 'Around here keeps a steady pulse.'
  }
  if (role === 'windDown') {
    if (clusterDensity === 'spread') {
      return 'Around here opens up so it feels less crowded.'
    }
    if (activityState === 'calm') {
      return 'Around here gets quieter as the night goes on.'
    }
    return 'Around here stays easy to move through.'
  }
  if (role === 'start') {
    if (roundedTravel <= 12) {
      return 'You can move between nearby spots quickly.'
    }
    if (activityState === 'active') {
      return 'Around here is lively but still easy to enter.'
    }
    return 'You have room to pivot nearby.'
  }
  return 'Around here keeps plenty of nearby options in play.'
}

export function buildTonightSignals({
  stop,
  scoredVenue,
  roleTravelWindowMinutes,
  nearbySummary: _nearbySummary,
  nearbyOptionsCount,
}: BuildTonightSignalsInput): string[] {
  const tags = toTagSet(stop.tags)
  const signals = scoredVenue?.taste.signals
  const roleKey = inverseRoleProjection[stop.role]
  const localTravelMinutes =
    typeof roleTravelWindowMinutes === 'number' && roleTravelWindowMinutes > 0
      ? roleTravelWindowMinutes
      : Math.max(6, stop.driveMinutes * 2)

  const energy = signals?.energy ?? inferEnergyFromStop(stop, tags)
  const socialDensity = signals?.socialDensity ?? inferSocialDensityFromStop(stop, tags)
  const momentIntensity =
    signals?.momentIntensity.score ?? inferMomentIntensityFromStop(stop.role, stop, tags)
  const roleFit = scoredVenue?.roleScores[roleKey]
  const temporalLabel = signals?.hyperlocalActivation.temporalLabel ?? inferTemporalLabel(tags)

  const activityState = getActivityState(socialDensity, energy, temporalLabel)
  const clusterDensity = getClusterDensity(localTravelMinutes, nearbyOptionsCount)
  const energyBand = getEnergyBand(energy)
  const intensityBand = getIntensityBand(momentIntensity)
  const roleFitBand = getRoleFitBand(roleFit)

  const lines = [
    getTimingLine(stop.role, activityState),
    getEnergyLine(stop.role, energyBand, intensityBand, roleFitBand),
    getContextLine(stop.role, activityState, clusterDensity, localTravelMinutes),
  ]

  return lines.slice(0, 3)
}
