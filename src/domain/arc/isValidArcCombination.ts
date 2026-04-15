import type { ArcStop } from '../types/arc'
import { getArcStopBaseVenueId } from '../candidates/candidateIdentity'
import { getRomanticPersonaHighlightType, isRomanticPersonaContractActive } from '../contracts/romanticPersonaContract'
import type { CrewPolicy } from '../types/crewPolicies'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { InternalRole } from '../types/venue'

const validShapes: InternalRole[][] = [
  ['peak'],
  ['warmup', 'peak'],
  ['peak', 'cooldown'],
  ['warmup', 'peak', 'cooldown'],
  ['warmup', 'peak', 'wildcard', 'cooldown'],
]

const ARC_VIABILITY_HIGHLIGHT_THRESHOLD = 0.6

function matchesValidShape(roles: InternalRole[]): boolean {
  return validShapes.some(
    (shape) => shape.length === roles.length && shape.every((role, index) => role === roles[index]),
  )
}

function hasUniqueVenues(stops: ArcStop[]): boolean {
  const uniqueVenueIds = new Set(stops.map((stop) => getArcStopBaseVenueId(stop)))
  return uniqueVenueIds.size === stops.length
}

function hasAnchorStop(stops: ArcStop[], intent: IntentProfile): boolean {
  if (intent.planningMode !== 'user-led' || !intent.anchor?.venueId) {
    return false
  }

  const anchorRole = intent.anchor.role ?? 'highlight'
  return stops.some(
    (stop) =>
      getArcStopBaseVenueId(stop) === intent.anchor!.venueId &&
      ((anchorRole === 'start' && stop.role === 'warmup') ||
        (anchorRole === 'highlight' && stop.role === 'peak') ||
        (anchorRole === 'windDown' && stop.role === 'cooldown')),
  )
}

function satisfiesRomanticPersonaContractHighlight(
  stops: ArcStop[],
  lens: ExperienceLens,
): boolean {
  if (!isRomanticPersonaContractActive(lens)) {
    return false
  }

  const highlight = stops.find((stop) => stop.role === 'peak')
  const highlightType = highlight ? getRomanticPersonaHighlightType(highlight.scoredVenue) : undefined
  if (!highlight || !highlightType) {
    return false
  }

  const momentIdentity = highlight.scoredVenue.momentIdentity
  return (
    Boolean(lens.resolvedContract?.highlight.preferredHighlightTypes.includes(highlightType)) &&
    momentIdentity.strength === 'strong' &&
    (momentIdentity.type === 'anchor' || momentIdentity.type === 'explore')
  )
}

function avoidsCategoryRepetition(
  stops: ArcStop[],
  intent: IntentProfile,
  lens: ExperienceLens,
): boolean {
  if (hasAnchorStop(stops, intent)) {
    return true
  }

  const categories = stops.map((stop) => stop.scoredVenue.venue.category)
  const uniqueCategories = new Set(categories)
  const allowedRepeats = lens.repetitionTolerance === 'high' ? 1 : 0
  return uniqueCategories.size >= stops.length - allowedRepeats
}

function hasSaneGeography(
  stops: ArcStop[],
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
): boolean {
  const drives = stops.map((stop) => stop.scoredVenue.venue.driveMinutes)
  const maxDrive = Math.max(...drives)
  const minDrive = Math.min(...drives)
  const spread = maxDrive - minDrive
  const neighborhoods = stops.map((stop) => stop.scoredVenue.venue.neighborhood)
  let jumps = 0
  for (let index = 1; index < neighborhoods.length; index += 1) {
    if (neighborhoods[index] !== neighborhoods[index - 1]) {
      jumps += 1
    }
  }

  const lensMovement =
    lens.movementTolerance === 'low' ? 0.72 : lens.movementTolerance === 'high' ? 1.2 : 1
  const strictnessMultiplier = (1 - crewPolicy.proximityStrictness * 0.35) * lensMovement
  const baseMaxSpread = intent.distanceMode === 'nearby' ? 8 : 18
  const romanticHighlightSpreadBonus =
    satisfiesRomanticPersonaContractHighlight(stops, lens) && intent.distanceMode === 'nearby'
      ? 1.5
      : 0
  const maxSpread = baseMaxSpread * strictnessMultiplier + romanticHighlightSpreadBonus
  const tighterSpread = Math.max(
    3,
    intent.refinementModes?.includes('closer-by') ? maxSpread - 4 : maxSpread,
  )
  const baseJumpLimit = intent.distanceMode === 'nearby' ? 1 : 2
  const lensJumpAllowance =
    lens.movementTolerance === 'high' ? 1 : lens.movementTolerance === 'low' ? -1 : 0
  const jumpLimit = Math.max(1, baseJumpLimit + lensJumpAllowance)

  return spread <= tighterSpread && jumps <= jumpLimit
}

export function hasArcGeographyViolation(
  stops: ArcStop[],
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
): boolean {
  return !hasSaneGeography(stops, intent, crewPolicy, lens)
}

function honorsCrewPolicy(stops: ArcStop[], crewPolicy: CrewPolicy): boolean {
  return stops.every((stop) => !crewPolicy.blockedCategories.includes(stop.scoredVenue.venue.category))
}

function preservesArcEnergy(stops: ArcStop[], lens: ExperienceLens): boolean {
  const warmup = stops.find((stop) => stop.role === 'warmup')
  const peak = stops.find((stop) => stop.role === 'peak')
  const cooldown = stops.find((stop) => stop.role === 'cooldown')
  if (!peak) {
    return false
  }
  const warmupEnergy = warmup?.scoredVenue.venue.energyLevel ?? peak.scoredVenue.venue.energyLevel
  const peakEnergy = peak.scoredVenue.venue.energyLevel
  const cooldownEnergy = cooldown?.scoredVenue.venue.energyLevel ?? peakEnergy
  const cooldownMaxEnergy =
    lens.windDownExpectation.maxEnergy === 'low'
      ? 2
      : lens.windDownExpectation.maxEnergy === 'medium'
        ? 3
        : 5
  const romanticHighlightEnergyException =
    Boolean(warmup) &&
    peakEnergy + 2 >= warmupEnergy &&
    satisfiesRomanticPersonaContractHighlight(stops, lens)
  const warmupOk =
    !warmup || peakEnergy >= warmupEnergy || romanticHighlightEnergyException
  const cooldownOk = !cooldown || (cooldownEnergy <= peakEnergy && cooldownEnergy <= cooldownMaxEnergy)
  return warmupOk && cooldownOk
}

function isArcViable(stops: ArcStop[]): boolean {
  const highlight = stops.find((stop) => stop.role === 'peak')
  const supportingStopsCount = stops.filter(
    (stop) => stop.role === 'warmup' || stop.role === 'cooldown',
  ).length
  return (
    Boolean(highlight) &&
    (highlight?.scoredVenue.taste.signals.momentIntensity.score ?? 0) >=
      ARC_VIABILITY_HIGHLIGHT_THRESHOLD &&
    supportingStopsCount >= 1
  )
}

function hasLensStopShapeCoherence(stops: ArcStop[]): boolean {
  return stops.every((stop) => {
    if (stop.role === 'warmup') {
      return stop.scoredVenue.stopShapeFit.start >= 0.45
    }
    if (stop.role === 'peak') {
      return stop.scoredVenue.stopShapeFit.highlight >= 0.45
    }
    if (stop.role === 'wildcard') {
      return stop.scoredVenue.stopShapeFit.surprise >= 0.4
    }
    return stop.scoredVenue.stopShapeFit.windDown >= 0.5
  })
}

export function isValidArcCombination(
  stops: ArcStop[],
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
): boolean {
  return getInvalidArcCombinationReasons(stops, intent, crewPolicy, lens).length === 0
}

export function getInvalidArcCombinationReasons(
  stops: ArcStop[],
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
): string[] {
  const roles = stops.map((stop) => stop.role)
  const reasons: string[] = []

  if (!matchesValidShape(roles)) {
    reasons.push('invalid_shape')
  }
  const hasHighlight = stops.some((stop) => stop.role === 'peak')
  if (!hasHighlight) {
    reasons.push('missing_highlight')
  }
  if (roles.length === 1) {
    const highlight = stops.find((stop) => stop.role === 'peak')
    const highlightIntensity =
      highlight?.scoredVenue.taste.signals.momentIntensity.score ?? 0
    if (highlightIntensity < 0.8) {
      reasons.push('single_stop_highlight_too_weak')
    }
  } else if (!isArcViable(stops)) {
    reasons.push('arc_viability')
  }
  if (!hasUniqueVenues(stops)) {
    reasons.push('duplicate_venue')
  }
  if (!avoidsCategoryRepetition(stops, intent, lens)) {
    reasons.push('category_repetition')
  }
  const geographyInvalid = hasArcGeographyViolation(stops, intent, crewPolicy, lens)
  if (geographyInvalid && !hasAnchorStop(stops, intent)) {
    reasons.push('geography')
  }
  if (!honorsCrewPolicy(stops, crewPolicy)) {
    reasons.push('crew_policy')
  }
  if (!preservesArcEnergy(stops, lens)) {
    reasons.push('energy_progression')
  }
  if (!hasLensStopShapeCoherence(stops)) {
    reasons.push('lens_stop_shape')
  }

  return reasons
}
