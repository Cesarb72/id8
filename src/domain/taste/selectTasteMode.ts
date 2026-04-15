import type {
  ExperienceLens,
  LensBias,
  LensEnergy,
  LensStopRole,
  MovementTolerance,
  StopShapeProfile,
} from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { RefinementMode } from '../types/refinement'
import type { Venue, VenueCategory } from '../types/venue'

export type TasteModeId =
  | 'cozy-flow'
  | 'highlight-centered'
  | 'activity-led'
  | 'wander-explore'
  | 'social-night'
  | 'scenic-outdoor'

export type TasteExperienceLane =
  | 'dining'
  | 'drinks'
  | 'sweet'
  | 'activity'
  | 'outdoor'
  | 'culture'

export type TasteModeEnforcement = 'light' | 'moderate' | 'strong'
export type TasteModeAlignmentTier = 'primary' | 'supporting' | 'fallback' | 'misaligned'

export interface SelectedTasteMode {
  id: TasteModeId
  label: string
  reason: string
  biasSummary: string
  favoredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  favoredTags: string[]
  discouragedTags: string[]
  favoredLanes: TasteExperienceLane[]
  discouragedLanes: TasteExperienceLane[]
  enforcementStrength: TasteModeEnforcement
  alignmentWeight: number
  penaltyWeight: number
  movementTolerance: MovementTolerance
  discoveryBias: LensBias
  wildcardAggressivenessFloor: number
  energyBand: LensEnergy[]
  roleBoosts: Record<LensStopRole, number>
  stopShapePatches: Partial<Record<LensStopRole, Partial<StopShapeProfile>>>
}

interface TasteModeBlueprint
  extends Omit<SelectedTasteMode, 'reason'> {
  reasonBuilder: (intent: IntentProfile) => string
}

const tasteModes: Record<TasteModeId, TasteModeBlueprint> = {
  'cozy-flow': {
    id: 'cozy-flow',
    label: 'Cozy Flow',
    biasSummary: 'Favor intimate openers, conversation-friendly highlights, and soft landings.',
    favoredCategories: ['cafe', 'dessert', 'restaurant', 'park'],
    discouragedCategories: ['activity', 'event', 'live_music'],
    favoredTags: ['cozy', 'intimate', 'conversation', 'craft', 'quiet', 'wine'],
    discouragedTags: ['festival', 'arcade', 'chaotic', 'high-energy'],
    favoredLanes: ['dining', 'sweet', 'outdoor'],
    discouragedLanes: ['activity'],
    enforcementStrength: 'moderate',
    alignmentWeight: 0.14,
    penaltyWeight: 0.06,
    movementTolerance: 'low',
    discoveryBias: 'medium',
    wildcardAggressivenessFloor: 0.36,
    energyBand: ['low', 'medium'],
    roleBoosts: {
      start: 0.095,
      highlight: 0.075,
      surprise: 0.05,
      windDown: 0.1,
    },
    stopShapePatches: {
      start: {
        preferredCategories: ['cafe', 'park', 'restaurant'],
        preferredTags: ['cozy', 'intimate', 'walkable'],
      },
      highlight: {
        preferredCategories: ['restaurant', 'dessert', 'cafe'],
        preferredTags: ['conversation', 'chef-led', 'craft'],
      },
      windDown: {
        preferredCategories: ['dessert', 'cafe', 'park'],
        preferredTags: ['calm', 'soft-landing', 'easygoing'],
      },
    },
    reasonBuilder: (intent) =>
      `Primary vibe is ${intent.primaryAnchor}, so Taste keeps the night low-friction and close to conversation.`,
  },
  'highlight-centered': {
    id: 'highlight-centered',
    label: 'Highlight-Centered',
    biasSummary: 'Hold back early so one strong stop clearly carries the night.',
    favoredCategories: ['restaurant', 'live_music', 'museum', 'event', 'bar'],
    discouragedCategories: ['park'],
    favoredTags: ['chef-led', 'immersive', 'performance', 'signature', 'curated', 'cocktails'],
    discouragedTags: ['predictable', 'sleepy'],
    favoredLanes: ['dining', 'culture', 'drinks'],
    discouragedLanes: ['outdoor'],
    enforcementStrength: 'moderate',
    alignmentWeight: 0.15,
    penaltyWeight: 0.05,
    movementTolerance: 'medium',
    discoveryBias: 'medium',
    wildcardAggressivenessFloor: 0.48,
    energyBand: ['medium', 'high'],
    roleBoosts: {
      start: 0.04,
      highlight: 0.13,
      surprise: 0.06,
      windDown: 0.045,
    },
    stopShapePatches: {
      highlight: {
        preferredCategories: ['restaurant', 'live_music', 'museum', 'event'],
        preferredTags: ['immersive', 'signature', 'performance', 'chef-led'],
      },
    },
    reasonBuilder: (intent) =>
      intent.refinementModes?.includes('more-exciting')
        ? 'Interpretation asked for more excitement, so Taste centers the route on a stronger peak moment.'
        : `Primary vibe is ${intent.primaryAnchor}, so Taste gives one standout stop more weight than the connectors.`,
  },
  'activity-led': {
    id: 'activity-led',
    label: 'Activity-Led',
    biasSummary: 'Lean into interactive or movement-oriented stops before food becomes the center of gravity.',
    favoredCategories: ['activity', 'event', 'park', 'dessert'],
    discouragedCategories: ['museum'],
    favoredTags: ['interactive', 'games', 'hands-on', 'playful', 'social'],
    discouragedTags: ['formal', 'sleepy'],
    favoredLanes: ['activity', 'sweet', 'outdoor'],
    discouragedLanes: ['culture'],
    enforcementStrength: 'strong',
    alignmentWeight: 0.18,
    penaltyWeight: 0.08,
    movementTolerance: 'medium',
    discoveryBias: 'medium',
    wildcardAggressivenessFloor: 0.58,
    energyBand: ['medium', 'high'],
    roleBoosts: {
      start: 0.07,
      highlight: 0.12,
      surprise: 0.11,
      windDown: 0.04,
    },
    stopShapePatches: {
      start: {
        preferredCategories: ['activity', 'cafe', 'dessert'],
        preferredTags: ['quick-start', 'interactive'],
      },
      highlight: {
        preferredCategories: ['activity', 'event', 'park'],
        preferredTags: ['playful', 'hands-on', 'social'],
      },
      surprise: {
        preferredCategories: ['activity', 'event', 'dessert'],
        preferredTags: ['unexpected', 'community', 'games'],
      },
    },
    reasonBuilder: () =>
      'Interpretation reads as playful or interactive, so Taste favors nights built around doing something together.',
  },
  'wander-explore': {
    id: 'wander-explore',
    label: 'Wander / Explore',
    biasSummary: 'Prefer local pockets, underexposed finds, and route shapes with a little more drift.',
    favoredCategories: ['restaurant', 'bar', 'event', 'cafe', 'dessert'],
    discouragedCategories: ['museum'],
    favoredTags: ['underexposed', 'local', 'community', 'market', 'neighborhood', 'wandering'],
    discouragedTags: ['predictable', 'chain'],
    favoredLanes: ['dining', 'drinks', 'sweet', 'activity'],
    discouragedLanes: [],
    enforcementStrength: 'strong',
    alignmentWeight: 0.17,
    penaltyWeight: 0.07,
    movementTolerance: 'high',
    discoveryBias: 'high',
    wildcardAggressivenessFloor: 0.72,
    energyBand: ['medium', 'high'],
    roleBoosts: {
      start: 0.06,
      highlight: 0.08,
      surprise: 0.12,
      windDown: 0.045,
    },
    stopShapePatches: {
      start: {
        preferredCategories: ['cafe', 'restaurant', 'event'],
        preferredTags: ['local', 'neighborhood', 'community'],
      },
      highlight: {
        preferredCategories: ['restaurant', 'bar', 'event'],
        preferredTags: ['underexposed', 'market', 'wandering', 'local'],
      },
      surprise: {
        preferredCategories: ['event', 'bar', 'dessert'],
        preferredTags: ['unexpected', 'underexposed', 'live-popups'],
      },
    },
    reasonBuilder: (intent) =>
      intent.mode === 'surprise'
        ? 'Surprise mode is active, so Taste opens the route to more local and underexposed options.'
        : `Primary vibe is ${intent.primaryAnchor}, so Taste pushes away from obvious defaults and toward local pockets.`,
  },
  'social-night': {
    id: 'social-night',
    label: 'Social Night',
    biasSummary: 'Prioritize buzzing group-friendly stops, then land somewhere easy to keep talking.',
    favoredCategories: ['bar', 'live_music', 'event', 'restaurant', 'activity'],
    discouragedCategories: ['park'],
    favoredTags: ['social', 'buzzing', 'cocktails', 'group-friendly', 'interactive', 'live'],
    discouragedTags: ['silent', 'sleepy'],
    favoredLanes: ['drinks', 'activity', 'dining'],
    discouragedLanes: ['outdoor'],
    enforcementStrength: 'moderate',
    alignmentWeight: 0.16,
    penaltyWeight: 0.06,
    movementTolerance: 'high',
    discoveryBias: 'medium',
    wildcardAggressivenessFloor: 0.62,
    energyBand: ['medium', 'high'],
    roleBoosts: {
      start: 0.05,
      highlight: 0.11,
      surprise: 0.08,
      windDown: 0.05,
    },
    stopShapePatches: {
      start: {
        preferredCategories: ['restaurant', 'bar', 'activity'],
        preferredTags: ['social', 'quick-start'],
      },
      highlight: {
        preferredCategories: ['bar', 'live_music', 'event', 'activity'],
        preferredTags: ['buzzing', 'live', 'cocktails', 'interactive'],
      },
      windDown: {
        preferredCategories: ['bar', 'dessert', 'cafe'],
        preferredTags: ['easygoing', 'social'],
      },
    },
    reasonBuilder: (intent) =>
      `Crew and vibe read as more social, so Taste favors nights with stronger group energy and lively anchors.`,
  },
  'scenic-outdoor': {
    id: 'scenic-outdoor',
    label: 'Scenic / Outdoor',
    biasSummary: 'Bias toward open-air movement, scenic pauses, and stops that feel better outside than inside.',
    favoredCategories: ['park', 'activity', 'cafe', 'dessert'],
    discouragedCategories: ['bar', 'museum'],
    favoredTags: ['scenic', 'viewpoint', 'garden', 'trail', 'outdoor-seating', 'fresh-air'],
    discouragedTags: ['indoors-only', 'late-night'],
    favoredLanes: ['outdoor', 'activity', 'sweet'],
    discouragedLanes: ['drinks'],
    enforcementStrength: 'strong',
    alignmentWeight: 0.2,
    penaltyWeight: 0.09,
    movementTolerance: 'medium',
    discoveryBias: 'medium',
    wildcardAggressivenessFloor: 0.5,
    energyBand: ['low', 'medium'],
    roleBoosts: {
      start: 0.11,
      highlight: 0.12,
      surprise: 0.08,
      windDown: 0.1,
    },
    stopShapePatches: {
      start: {
        preferredCategories: ['park', 'cafe'],
        preferredTags: ['walkable', 'scenic', 'garden'],
      },
      highlight: {
        preferredCategories: ['park', 'activity', 'dessert'],
        preferredTags: ['viewpoint', 'open-air', 'trail'],
      },
      windDown: {
        preferredCategories: ['dessert', 'park', 'cafe'],
        preferredTags: ['quiet', 'outdoor-seating', 'soft-landing'],
      },
    },
    reasonBuilder: () =>
      'Interpretation points outdoors, so Taste keeps the route oriented around scenic and open-air moments.',
  },
}

function hasRefinement(intent: IntentProfile, value: RefinementMode): boolean {
  return intent.refinementModes?.includes(value) ?? false
}

function getTasteModeId(intent: IntentProfile): TasteModeId {
  if (intent.primaryAnchor === 'adventurous-outdoor') {
    return 'scenic-outdoor'
  }
  if (intent.primaryAnchor === 'playful') {
    return 'activity-led'
  }
  if (intent.primaryAnchor === 'adventurous-urban') {
    return 'wander-explore'
  }
  if (
    intent.mode === 'surprise' ||
    hasRefinement(intent, 'more-unique')
  ) {
    return intent.primaryAnchor === 'cozy' || intent.primaryAnchor === 'chill'
      ? 'cozy-flow'
      : 'wander-explore'
  }
  if (intent.primaryAnchor === 'cozy' || intent.primaryAnchor === 'chill') {
    return hasRefinement(intent, 'more-exciting')
      ? 'highlight-centered'
      : 'cozy-flow'
  }
  if (intent.primaryAnchor === 'cultured') {
    return hasRefinement(intent, 'more-exciting')
      ? 'highlight-centered'
      : 'highlight-centered'
  }
  if (intent.primaryAnchor === 'lively') {
    return intent.crew === 'socialite' ? 'social-night' : 'highlight-centered'
  }
  if (intent.crew === 'socialite') {
    return 'social-night'
  }
  return 'highlight-centered'
}

export function selectTasteMode(intent: IntentProfile): SelectedTasteMode {
  const blueprint = tasteModes[getTasteModeId(intent)]
  return {
    ...blueprint,
    reason: blueprint.reasonBuilder(intent),
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

export function applyTasteModeToLens(
  lens: ExperienceLens,
  tasteMode: SelectedTasteMode,
): ExperienceLens {
  const nextLens: ExperienceLens = {
    ...lens,
    tasteMode,
    energyBand: unique([...lens.energyBand, ...tasteMode.energyBand]),
    preferredCategories: unique([...lens.preferredCategories, ...tasteMode.favoredCategories]),
    discouragedCategories: unique([
      ...lens.discouragedCategories,
      ...tasteMode.discouragedCategories,
    ]),
    preferredTags: unique([...lens.preferredTags, ...tasteMode.favoredTags]),
    discouragedTags: unique([...lens.discouragedTags, ...tasteMode.discouragedTags]),
    movementTolerance: tasteMode.movementTolerance,
    discoveryBias: tasteMode.discoveryBias,
    wildcardAggressiveness: Math.max(
      lens.wildcardAggressiveness,
      tasteMode.wildcardAggressivenessFloor,
    ),
    preferredStopShapes: { ...lens.preferredStopShapes },
    windDownExpectation: {
      ...lens.windDownExpectation,
      preferredCategories: unique([
        ...lens.windDownExpectation.preferredCategories,
        ...(tasteMode.stopShapePatches.windDown?.preferredCategories ?? []),
      ]),
      discouragedCategories: unique([
        ...lens.windDownExpectation.discouragedCategories,
        ...(tasteMode.stopShapePatches.windDown?.discouragedCategories ?? []),
      ]),
    },
  }

  const roles = Object.keys(nextLens.preferredStopShapes) as LensStopRole[]
  for (const role of roles) {
    const patch = tasteMode.stopShapePatches[role]
    if (!patch) {
      continue
    }
    nextLens.preferredStopShapes[role] = {
      preferredCategories: unique([
        ...nextLens.preferredStopShapes[role].preferredCategories,
        ...(patch.preferredCategories ?? []),
      ]),
      discouragedCategories: unique([
        ...nextLens.preferredStopShapes[role].discouragedCategories,
        ...(patch.discouragedCategories ?? []),
      ]),
      preferredTags: unique([
        ...nextLens.preferredStopShapes[role].preferredTags,
        ...(patch.preferredTags ?? []),
      ]),
      discouragedTags: unique([
        ...nextLens.preferredStopShapes[role].discouragedTags,
        ...(patch.discouragedTags ?? []),
      ]),
      energyPreference: unique([
        ...nextLens.preferredStopShapes[role].energyPreference,
        ...(patch.energyPreference ?? []),
      ]),
    }
  }

  return nextLens
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

function normalizedTagSet(tags: string[]): Set<string> {
  return new Set(tags.map(normalizeTag))
}

function hasAnyTag(tags: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => tags.has(normalizeTag(candidate)))
}

function textIncludesAny(values: Array<string | undefined>, terms: string[]): boolean {
  const corpus = values
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()
  if (!corpus) {
    return false
  }
  return terms.some((term) => corpus.includes(term.toLowerCase()))
}

function tagOverlap(venueTags: string[], targetTags: string[]): number {
  if (targetTags.length === 0) {
    return 0
  }
  const normalizedVenueTags = normalizedTagSet(venueTags)
  const matches = targetTags.filter((tag) => normalizedVenueTags.has(normalizeTag(tag))).length
  return matches / targetTags.length
}

export function getTasteExperienceLane(venue: Pick<Venue, 'category'>): TasteExperienceLane {
  if (venue.category === 'restaurant') {
    return 'dining'
  }
  if (venue.category === 'bar' || venue.category === 'cafe') {
    return 'drinks'
  }
  if (venue.category === 'dessert') {
    return 'sweet'
  }
  if (venue.category === 'activity') {
    return 'activity'
  }
  if (venue.category === 'park') {
    return 'outdoor'
  }
  return 'culture'
}

export function getTasteModeAlignment(
  venue: Venue,
  tasteMode?: SelectedTasteMode,
  options: {
    protectedCandidate?: boolean
  } = {},
): {
  overall: number
  penalty: number
  lane: TasteExperienceLane
  tier: TasteModeAlignmentTier
  supportiveTagScore: number
  lanePriorityScore: number
  byRole: Record<LensStopRole, number>
} {
  const lane = getTasteExperienceLane(venue)
  if (!tasteMode) {
    return {
      overall: 0,
      penalty: 0,
      lane,
      tier: 'misaligned',
      supportiveTagScore: 0,
      lanePriorityScore: 0,
      byRole: {
        start: 0,
        highlight: 0,
        surprise: 0,
        windDown: 0,
      },
    }
  }

  const protectedCandidate = options.protectedCandidate ?? false
  const normalizedTags = normalizedTagSet(venue.tags)
  const textSignals = [venue.subcategory, venue.shortDescription, venue.narrativeFlavor]
  const categoryMatch = tasteMode.favoredCategories.includes(venue.category) ? 1 : 0
  const categoryPenalty = tasteMode.discouragedCategories.includes(venue.category) ? 0.8 : 0
  const lanePriorityIndex = tasteMode.favoredLanes.indexOf(lane)
  const lanePriorityScore =
    lanePriorityIndex === 0
      ? 1
      : lanePriorityIndex === 1
        ? 0.82
        : lanePriorityIndex === 2
          ? 0.64
          : lanePriorityIndex === 3
            ? 0.46
            : 0.12
  const lanePenalty = tasteMode.discouragedLanes.includes(lane) ? 0.5 : 0
  const supportiveTagScore = tagOverlap(venue.tags, tasteMode.favoredTags)
  const tagPenalty = tagOverlap(venue.tags, tasteMode.discouragedTags)
  const modeSignalStrength = getModeSignalStrength(
    venue,
    tasteMode,
    normalizedTags,
    textSignals,
  )
  const hospitalityLane =
    lane === 'dining' || lane === 'drinks' || lane === 'sweet'
  const genericFallbackPenalty =
    protectedCandidate
      ? 0
      : (tasteMode.id === 'scenic-outdoor' || tasteMode.id === 'activity-led') &&
          hospitalityLane &&
          modeSignalStrength.strong < 0.32 &&
          supportiveTagScore < 0.18 &&
          categoryMatch === 0
        ? 0.92
      : hospitalityLane &&
          lanePriorityIndex > 1 &&
          supportiveTagScore < 0.18 &&
          categoryMatch === 0
        ? 0.75
        : hospitalityLane &&
            lanePriorityIndex === -1 &&
            supportiveTagScore < 0.12
          ? 0.58
          : 0
  const overall = Math.max(
    0,
    Math.min(
      1,
      lanePriorityScore * 0.42 +
        categoryMatch * 0.22 +
        supportiveTagScore * 0.22 +
        modeSignalStrength.strong * 0.24 +
        modeSignalStrength.light * 0.14 +
        (venue.distinctivenessScore ?? 0) * 0.08 +
        (venue.underexposureScore ?? 0) * 0.06 -
        categoryPenalty * 0.3 -
        lanePenalty * 0.18 -
        tagPenalty * 0.22 -
        genericFallbackPenalty * 0.22,
    ),
  )
  const penalty = protectedCandidate
    ? 0
    : Math.max(
        0,
        categoryPenalty * tasteMode.penaltyWeight * 0.34 +
          lanePenalty * tasteMode.penaltyWeight * 0.28 +
          tagPenalty * tasteMode.penaltyWeight * 0.26 +
          genericFallbackPenalty * tasteMode.penaltyWeight,
      )
  const tier: TasteModeAlignmentTier =
    overall >= 0.72 &&
    lanePriorityIndex <= 1 &&
    modeSignalStrength.strong >= 0.52
      ? 'primary'
      : overall >= 0.5 && (modeSignalStrength.light >= 0.34 || lanePriorityIndex <= 2)
        ? 'supporting'
      : overall >= 0.24
          ? 'fallback'
          : 'misaligned'

  return {
    overall,
    penalty,
    lane,
    tier,
    supportiveTagScore,
    lanePriorityScore,
    byRole: {
      start: overall * tasteMode.roleBoosts.start,
      highlight: overall * tasteMode.roleBoosts.highlight,
      surprise: overall * tasteMode.roleBoosts.surprise,
      windDown: overall * tasteMode.roleBoosts.windDown,
    },
  }
}

function getModeSignalStrength(
  venue: Venue,
  tasteMode: SelectedTasteMode,
  normalizedTags: Set<string>,
  textSignals: Array<string | undefined>,
): {
  strong: number
  light: number
} {
  if (tasteMode.id === 'scenic-outdoor') {
    const strong =
      (venue.category === 'park' ? 0.84 : 0) +
      (venue.settings.setting === 'outdoor' ? 0.42 : 0) +
      (hasAnyTag(normalizedTags, [
        'garden',
        'lookout',
        'open-air',
        'scenic',
        'trail',
        'viewpoint',
        'waterfront',
      ])
        ? 0.22
        : 0) +
      (textIncludesAny(textSignals, [
        'botanical',
        'garden',
        'lookout',
        'open air',
        'scenic',
        'sunset',
        'trail',
        'view',
        'waterfront',
      ])
        ? 0.18
        : 0)
    const light =
      strong * 0.72 +
      (venue.settings.setting === 'hybrid' ? 0.24 : 0) +
      (hasAnyTag(normalizedTags, ['courtyard', 'outdoor-seating', 'patio', 'plaza', 'walkable'])
        ? 0.22
        : 0)
    return {
      strong: Math.min(1, strong),
      light: Math.min(1, Math.max(strong, light)),
    }
  }

  if (tasteMode.id === 'activity-led') {
    const strong =
      (venue.category === 'activity' ? 0.78 : venue.category === 'event' ? 0.28 : 0) +
      (hasAnyTag(normalizedTags, [
        'arcade',
        'board-games',
        'games',
        'hands-on',
        'immersive',
        'interactive',
        'karaoke',
        'mini-golf',
        'workshop',
      ])
        ? 0.24
        : 0) +
      (textIncludesAny(textSignals, [
        'arcade',
        'class',
        'games',
        'hands-on',
        'immersive',
        'interactive',
        'karaoke',
        'mini golf',
        'workshop',
      ])
        ? 0.18
        : 0)
    const light =
      strong * 0.7 +
      (venue.settings.eventCapable ? 0.18 : 0) +
      (venue.settings.performanceCapable || venue.settings.musicCapable ? 0.12 : 0) +
      (hasAnyTag(normalizedTags, ['community', 'live', 'playful', 'social'])
        ? 0.18
        : 0)
    return {
      strong: Math.min(1, strong),
      light: Math.min(1, Math.max(strong, light)),
    }
  }

  const genericStrong =
    (tasteMode.favoredCategories.includes(venue.category) ? 0.38 : 0) +
    tagOverlap(venue.tags, tasteMode.favoredTags) * 0.42
  const genericLight =
    genericStrong * 0.72 +
    (tasteMode.favoredLanes.includes(getTasteExperienceLane(venue)) ? 0.18 : 0)

  return {
    strong: Math.min(1, genericStrong),
    light: Math.min(1, Math.max(genericStrong, genericLight)),
  }
}
