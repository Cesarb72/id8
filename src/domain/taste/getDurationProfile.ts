import type { DurationClass } from '../types/pacing'
import type { Venue } from '../types/venue'

interface DurationProfile {
  durationClass: DurationClass
  minMinutes: number
  maxMinutes: number
  baseMinutes: number
}

type DurationProfileInput = Pick<Venue, 'category' | 'tags'>

const categoryProfiles: Record<Venue['category'], DurationProfile> = {
  dessert: { durationClass: 'XS', minMinutes: 15, maxMinutes: 35, baseMinutes: 25 },
  cafe: { durationClass: 'S', minMinutes: 30, maxMinutes: 65, baseMinutes: 45 },
  bar: { durationClass: 'M', minMinutes: 45, maxMinutes: 95, baseMinutes: 75 },
  restaurant: { durationClass: 'L', minMinutes: 75, maxMinutes: 150, baseMinutes: 110 },
  museum: { durationClass: 'L', minMinutes: 75, maxMinutes: 140, baseMinutes: 100 },
  live_music: { durationClass: 'XL', minMinutes: 110, maxMinutes: 180, baseMinutes: 140 },
  park: { durationClass: 'S', minMinutes: 30, maxMinutes: 100, baseMinutes: 50 },
  activity: { durationClass: 'M', minMinutes: 45, maxMinutes: 120, baseMinutes: 80 },
  event: { durationClass: 'M', minMinutes: 45, maxMinutes: 120, baseMinutes: 85 },
}

export function getDurationClass(minutes: number): DurationClass {
  if (minutes <= 30) {
    return 'XS'
  }
  if (minutes <= 60) {
    return 'S'
  }
  if (minutes <= 90) {
    return 'M'
  }
  if (minutes <= 150) {
    return 'L'
  }
  return 'XL'
}

export function getDurationProfile(venue: DurationProfileInput): DurationProfile {
  const tags = new Set(venue.tags.map((tag) => tag.toLowerCase()))
  const profile = categoryProfiles[venue.category]
  let baseMinutes = profile.baseMinutes

  if (tags.has('quick-start') || tags.has('walk-up')) {
    baseMinutes -= 10
  }
  if (tags.has('chef-led') || tags.has('elevated') || tags.has('tasting-menu') || tags.has('wine-pairing')) {
    baseMinutes += 20
  }
  if (tags.has('social') || tags.has('rooftop') || tags.has('beer-garden')) {
    baseMinutes += 10
  }
  if (tags.has('tea-room') || tags.has('quiet') || tags.has('reflective') || tags.has('garden')) {
    baseMinutes += 10
  }
  if (tags.has('trail') || tags.has('viewpoint') || tags.has('nature')) {
    baseMinutes += 25
  }
  if (tags.has('arcade') || tags.has('games') || tags.has('mini-golf') || tags.has('karaoke')) {
    baseMinutes += 15
  }
  if (
    tags.has('hands-on') ||
    tags.has('immersive') ||
    tags.has('guided') ||
    tags.has('learning') ||
    tags.has('family-friendly')
  ) {
    baseMinutes += 10
  }
  if (
    tags.has('local-artists') ||
    tags.has('small-stage') ||
    tags.has('listening') ||
    tags.has('jazz') ||
    tags.has('acoustic')
  ) {
    baseMinutes += 15
  }
  if (tags.has('market') || tags.has('makers') || tags.has('gallery') || tags.has('vintage') || tags.has('pop-up')) {
    baseMinutes -= 10
  }
  if (tags.has('dessert') || tags.has('gelato') || tags.has('ice-cream')) {
    baseMinutes -= 10
  }

  const estimatedDurationMinutes = Math.max(profile.minMinutes, Math.min(profile.maxMinutes, baseMinutes))

  return {
    durationClass: getDurationClass(estimatedDurationMinutes),
    minMinutes: profile.minMinutes,
    maxMinutes: profile.maxMinutes,
    baseMinutes: estimatedDurationMinutes,
  }
}
