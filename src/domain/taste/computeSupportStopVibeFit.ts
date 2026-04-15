import { getRoleShapeForVibe } from './getVibeProfile'
import type { ArcStop } from '../types/arc'
import type { IntentProfile } from '../types/intent'
import type { InternalRole } from '../types/venue'

export type SupportStopEffect = 'reinforces' | 'mixed' | 'weakens'

export interface SupportStopRoleFit {
  role: InternalRole
  score: number
  effect: SupportStopEffect
  notes: string[]
}

export interface SupportStopVibeFitResult {
  overall: number
  effect: SupportStopEffect
  byRole: Partial<Record<InternalRole, SupportStopRoleFit>>
  notes: string[]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase()
}

function overlapScore(source: string[], target: string[]): number {
  if (target.length === 0) {
    return 0
  }
  const normalized = new Set(source.map(normalizeTag))
  const matches = target.filter((tag) => normalized.has(normalizeTag(tag))).length
  return matches / target.length
}

function hasAnyTag(source: string[], target: string[]): boolean {
  return overlapScore(source, target) > 0
}

function effectFromScore(score: number): SupportStopEffect {
  if (score >= 0.7) {
    return 'reinforces'
  }
  if (score >= 0.5) {
    return 'mixed'
  }
  return 'weakens'
}

function roleLabel(role: InternalRole): 'start' | 'windDown' {
  return role === 'warmup' ? 'start' : 'windDown'
}

function computeContextualAdjustment(
  role: InternalRole,
  stop: ArcStop,
  highlight: ArcStop,
  intent: IntentProfile,
): { bonus: number; penalty: number; notes: string[] } {
  const notes: string[] = []
  const tags = stop.scoredVenue.venue.tags
  const driveGap = Math.abs(stop.scoredVenue.venue.driveMinutes - highlight.scoredVenue.venue.driveMinutes)
  const proximityBonus = clamp01(1 - driveGap / 14) * 0.14
  let bonus = proximityBonus
  let penalty = 0

  if (proximityBonus >= 0.08) {
    notes.push('stays close to the highlight')
  }

  if (intent.primaryAnchor === 'adventurous-outdoor') {
    const outdoorAdjacent =
      stop.scoredVenue.venue.category === 'park' ||
      hasAnyTag(tags, [
        'walkable',
        'scenic',
        'trail',
        'viewpoint',
        'nature',
        'garden',
        'stargazing',
        'fresh-air',
        'outdoor-seating',
      ])
    if (outdoorAdjacent) {
      bonus += 0.14
      notes.push('reinforces the outdoor anchor')
    }
    if (
      stop.scoredVenue.venue.category === 'museum' ||
      hasAnyTag(tags, ['district', 'street-food', 'night-market', 'indoors-only'])
    ) {
      penalty += 0.16
      notes.push('pulls the route back toward urban/cultural drift')
    }
  }

  if (intent.primaryAnchor === 'adventurous-urban') {
    const urbanAdjacent =
      hasAnyTag(tags, [
        'district',
        'street-food',
        'community',
        'local',
        'underexposed',
        'market',
        'food-hall',
        'live-popups',
        'neighborhood',
      ]) ||
      ['restaurant', 'bar', 'event', 'cafe', 'live_music'].includes(stop.scoredVenue.venue.category)
    if (urbanAdjacent) {
      bonus += 0.14
      notes.push('reinforces the urban wandering feel')
    }
    if (
      stop.scoredVenue.venue.category === 'park' ||
      hasAnyTag(tags, ['trail', 'viewpoint', 'nature', 'garden', 'stargazing'])
    ) {
      penalty += 0.16
      notes.push('pulls the route back toward scenic/outdoor logic')
    }
  }

  if (intent.primaryAnchor === 'cozy' || intent.primaryAnchor === 'chill') {
    if (hasAnyTag(tags, ['cozy', 'intimate', 'quiet', 'calm', 'soft-landing', 'wine'])) {
      bonus += 0.12
      notes.push('keeps the pacing soft and intimate')
    }
  }

  if (intent.primaryAnchor === 'lively') {
    if (
      hasAnyTag(tags, ['social', 'cocktails', 'community']) ||
      stop.scoredVenue.venue.energyLevel >= (role === 'warmup' ? 3 : 2)
    ) {
      bonus += 0.11
      notes.push('keeps social momentum around the highlight')
    }
  }

  if (intent.primaryAnchor === 'playful') {
    if (hasAnyTag(tags, ['interactive', 'games', 'community']) || stop.scoredVenue.venue.category === 'activity') {
      bonus += 0.12
      notes.push('keeps the route playful')
    }
  }

  if (intent.primaryAnchor === 'cultured') {
    if (hasAnyTag(tags, ['thoughtful', 'curated', 'gallery', 'historic', 'quiet']) || stop.scoredVenue.venue.category === 'museum') {
      bonus += 0.12
      notes.push('keeps the route thoughtful')
    }
  }

  return { bonus, penalty, notes }
}

export function computeSupportStopVibeFit(
  stops: ArcStop[],
  intent: IntentProfile,
): SupportStopVibeFitResult {
  const highlight = stops.find((stop) => stop.role === 'peak')
  if (!highlight) {
    return {
      overall: 0,
      effect: 'weakens',
      byRole: {},
      notes: [],
    }
  }

  const supportStops = stops.filter((stop) => stop.role === 'warmup' || stop.role === 'cooldown')
  const byRole: Partial<Record<InternalRole, SupportStopRoleFit>> = {}
  const notes: string[] = []

  for (const stop of supportStops) {
    const vibeRole = roleLabel(stop.role)
    const shape = getRoleShapeForVibe(intent.primaryAnchor, vibeRole)
    const categoryFit = shape.preferredCategories.includes(stop.scoredVenue.venue.category)
      ? 1
      : shape.discouragedCategories.includes(stop.scoredVenue.venue.category)
        ? 0.18
        : 0.46
    const preferredTagFit = overlapScore(stop.scoredVenue.venue.tags, shape.preferredTags)
    const discouragedTagPenalty = overlapScore(stop.scoredVenue.venue.tags, shape.discouragedTags) * 0.18
    const baseRoleFit = stop.scoredVenue.vibeAuthority.byRole[vibeRole]
    const contextual = computeContextualAdjustment(stop.role, stop, highlight, intent)

    const score = clamp01(
      baseRoleFit * 0.44 +
        categoryFit * 0.18 +
        preferredTagFit * 0.16 +
        contextual.bonus -
        discouragedTagPenalty -
        contextual.penalty,
    )
    const effect = effectFromScore(score)
    const roleNotes = [...contextual.notes]
    if (preferredTagFit >= 0.24) {
      roleNotes.push('matches vibe tags for this support role')
    }
    if (shape.preferredCategories.includes(stop.scoredVenue.venue.category)) {
      roleNotes.push('matches the preferred support-stop category')
    }
    if (discouragedTagPenalty >= 0.08 || shape.discouragedCategories.includes(stop.scoredVenue.venue.category)) {
      roleNotes.push('carries some off-vibe support signals')
    }

    byRole[stop.role] = {
      role: stop.role,
      score,
      effect,
      notes: [...new Set(roleNotes)].slice(0, 4),
    }
    notes.push(`${stop.role} ${effect}`)
  }

  const values = Object.values(byRole).map((entry) => entry?.score ?? 0)
  const overall = values.length > 0 ? clamp01(values.reduce((sum, value) => sum + value, 0) / values.length) : 0

  return {
    overall,
    effect: effectFromScore(overall),
    byRole,
    notes: [...new Set(notes)],
  }
}
