import type { LivePlaceKind, LiveQueryPlanEntry, LiveQueryRoleHint } from '../../sources/buildLiveQueryPlan'
import type {
  ConciergeIntent,
  VibeAnchor,
} from '../../types/intent'
import type {
  MovementOriginPrecision,
  MovementOriginSource,
} from '../../../engines/district/types/districtTypes'
import type { StarterPack } from '../../types/starterPack'
import type { Venue } from '../../types/venue'
import type { WhenSignalProfile, WhenSignalTimePhase } from '../../when/whenSignalProfile'

export type SemanticQuerySearchBreadth = 'focused' | 'balanced' | 'broad'
export type SemanticQueryNoveltyPressure = 'low' | 'medium' | 'high'
export type SemanticQueryLocationScope = 'city' | 'pocket' | 'anchor_nearby'
export type SemanticQuerySequencePurpose =
  | 'sequence_entry'
  | 'sequence_center'
  | 'sequence_landing'
  | 'sequence_support'

export interface DomainNeutralSemanticQueryFacets {
  queryIdentity: string
  sourceFamily: LivePlaceKind | 'build_provider_nearby'
  requestedKind?: LivePlaceKind
  searchBreadth: SemanticQuerySearchBreadth
  noveltyPressure: SemanticQueryNoveltyPressure
  locationScope: SemanticQueryLocationScope
  timeWindowApplicability: 'current_window'
  sequencePurpose: SemanticQuerySequencePurpose
}

export interface InterpretationSemanticLiveQueryProjectionEntry {
  compatibility: LiveQueryPlanEntry
  facets: DomainNeutralSemanticQueryFacets
}

export interface InterpretationSemanticLiveQueryProjection {
  entries: LiveQueryPlanEntry[]
  projectedEntries: InterpretationSemanticLiveQueryProjectionEntry[]
  provenance: {
    owner: 'interpretation'
    compatibilityBridge: 'text_query_passthrough_until_2c_6'
    notes: string[]
  }
}

export interface InterpretationBuildProviderSemanticQueryProjectionEntry {
  label: 'build-provider-start' | 'build-provider-highlight' | 'build-provider-winddown'
  textQuery: string
  queryTerms: string[]
  sourceFamily: 'build_provider_nearby'
  facets: DomainNeutralSemanticQueryFacets
}

export interface InterpretationBuildProviderSemanticQueryProjection {
  entries: InterpretationBuildProviderSemanticQueryProjectionEntry[]
  provenance: {
    owner: 'interpretation'
    compatibilityBridge: 'text_query_passthrough_until_2c_6'
    notes: string[]
  }
}

export interface InterpretationSemanticQueryPlaceContext {
  city: string
  neighborhood?: string
  locationLabelOverride?: string
  locationScope?: SemanticQueryLocationScope
  originPrecision?: MovementOriginPrecision
  originSource?: MovementOriginSource
}

export interface InterpretationSemanticQueryProjectionInput {
  conciergeIntent: ConciergeIntent
  whenSignalProfile: WhenSignalProfile
  placeContext: InterpretationSemanticQueryPlaceContext
  starterPack?: StarterPack
}

interface SemanticQueryTimeSignal {
  phase: Exclude<WhenSignalTimePhase, 'unspecified'>
  label: string
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ')
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function pickStarterPackTerms(starterPack?: StarterPack): string[] {
  const preferred = starterPack?.lensPreset?.preferredTags ?? []
  return unique(preferred.slice(0, 3).map(normalizeTerm).filter((value) => value.length >= 4))
}

function getPersonaTerms(conciergeIntent: ConciergeIntent): string[] {
  if (conciergeIntent.experienceProfile.persona === 'romantic') {
    return ['intimate', 'date night', 'conversation']
  }
  if (
    conciergeIntent.experienceProfile.socialEnergy === 'high' ||
    conciergeIntent.constraintPosture.structureRigidity === 'flexible'
  ) {
    return ['social', 'cocktail', 'lively']
  }
  return ['welcoming', 'casual', 'comfortable']
}

function getVibeTerms(vibe: VibeAnchor): string[] {
  const primary = vibe
  if (primary === 'cozy') {
    return ['cozy', 'quiet', 'warm']
  }
  if (primary === 'lively') {
    return ['lively', 'buzzing', 'energetic']
  }
  if (primary === 'cultured') {
    return ['thoughtful', 'design forward', 'local culture']
  }
  if (primary === 'chill') {
    return ['relaxed', 'easygoing', 'neighborhood']
  }
  if (primary === 'playful') {
    return ['fun', 'playful', 'social']
  }
  if (primary === 'adventurous-urban') {
    return ['local', 'under the radar', 'neighborhood']
  }
  return ['scenic', 'open air', 'local']
}

function buildLocationLabel(placeContext: InterpretationSemanticQueryPlaceContext): string {
  if (placeContext.locationLabelOverride?.trim()) {
    return placeContext.locationLabelOverride.trim()
  }
  return placeContext.neighborhood
    ? `${placeContext.neighborhood}, ${placeContext.city}`
    : placeContext.city
}

function buildQueryText(kind: LivePlaceKind, descriptors: string[], locationLabel: string): string {
  const phrase = unique(descriptors).slice(0, 4).join(' ')
  return `${phrase} ${kind} in ${locationLabel}`.trim()
}

function isCoffeeBooksStarter(starterPack?: StarterPack): boolean {
  return starterPack?.id === 'coffee-books'
}

function getTimeSignal(whenSignalProfile: WhenSignalProfile): SemanticQueryTimeSignal {
  if (whenSignalProfile.timePhase !== 'unspecified') {
    return {
      phase: whenSignalProfile.timePhase,
      label: whenSignalProfile.startTime?.trim() || whenSignalProfile.timePhase,
    }
  }
  if (
    whenSignalProfile.whenPosture === 'now_doable_tonight' ||
    whenSignalProfile.whenPosture === 'later_tonight'
  ) {
    return {
      phase: 'evening',
      label: whenSignalProfile.whenPosture,
    }
  }
  return {
    phase: 'evening',
    label: whenSignalProfile.whenPosture,
  }
}

function usesSocialQueryPosture(conciergeIntent: ConciergeIntent): boolean {
  return (
    conciergeIntent.experienceProfile.socialEnergy === 'high' ||
    conciergeIntent.constraintPosture.structureRigidity === 'flexible' ||
    conciergeIntent.constraintPosture.swapTolerance === 'high'
  )
}

function getSequencePurpose(roleHint: LiveQueryRoleHint): SemanticQuerySequencePurpose {
  if (roleHint === 'start') {
    return 'sequence_entry'
  }
  if (roleHint === 'highlight') {
    return 'sequence_center'
  }
  if (roleHint === 'windDown') {
    return 'sequence_landing'
  }
  return 'sequence_support'
}

function getSearchBreadth(roleHint: LiveQueryRoleHint): SemanticQuerySearchBreadth {
  if (roleHint === 'support') {
    return 'broad'
  }
  if (roleHint === 'highlight') {
    return 'focused'
  }
  return 'balanced'
}

function getNoveltyPressure(
  intent: ConciergeIntent,
  starterPack?: StarterPack,
): SemanticQueryNoveltyPressure {
  if (
    intent.realityPosture.noveltyPriority === 'high' ||
    starterPack?.lensPreset?.discoveryBias === 'high'
  ) {
    return 'high'
  }
  if (
    intent.realityPosture.noveltyPriority === 'low' ||
    starterPack?.lensPreset?.discoveryBias === 'low'
  ) {
    return 'low'
  }
  return 'medium'
}

function projectLiveEntry(
  entry: LiveQueryPlanEntry,
  conciergeIntent: ConciergeIntent,
  starterPack: StarterPack | undefined,
  locationScope: SemanticQueryLocationScope,
): InterpretationSemanticLiveQueryProjectionEntry {
  return {
    compatibility: entry,
    facets: {
      queryIdentity: entry.label,
      sourceFamily: entry.kind,
      requestedKind: entry.kind,
      searchBreadth: getSearchBreadth(entry.roleHint),
      noveltyPressure: getNoveltyPressure(conciergeIntent, starterPack),
      locationScope,
      timeWindowApplicability: 'current_window',
      sequencePurpose: getSequencePurpose(entry.roleHint),
    },
  }
}

function buildProjectedEntries(
  input: InterpretationSemanticQueryProjectionInput,
): LiveQueryPlanEntry[] {
  const { conciergeIntent, starterPack, whenSignalProfile, placeContext } = input
  const locationLabel = buildLocationLabel(placeContext)
  const timeSignal = getTimeSignal(whenSignalProfile)
  const personaTerms = getPersonaTerms(conciergeIntent)
  const vibe = conciergeIntent.experienceProfile.vibe
  const vibeTerms = getVibeTerms(vibe)
  const starterPackTerms = pickStarterPackTerms(starterPack)
  const socialQueryPosture = usesSocialQueryPosture(conciergeIntent)
  const dateOrSocialTerms = conciergeIntent.experienceProfile.persona === 'romantic'
    ? ['wine', 'dessert']
    : socialQueryPosture
      ? ['cocktail', 'group friendly']
      : ['coffee', 'daytime']

  const startKind: LivePlaceKind =
    timeSignal.phase === 'morning' || timeSignal.phase === 'afternoon' ? 'cafe' : 'restaurant'
  const highlightKind: LivePlaceKind =
    timeSignal.phase === 'late-night' ||
    vibe === 'lively' ||
    socialQueryPosture
      ? 'bar'
      : 'restaurant'
  const windDownKind: LivePlaceKind = timeSignal.phase === 'late-night' ? 'bar' : 'cafe'
  const cultureKind: LivePlaceKind =
    vibe === 'cultured' || conciergeIntent.starterLineage.primaryAnchor === 'cultured'
      ? 'museum'
      : 'activity'
  const strollKind: LivePlaceKind =
    vibe === 'cozy' || vibe === 'chill' ? 'park' : 'activity'

  const coffeeBooksStarter = isCoffeeBooksStarter(starterPack)
  const plan: LiveQueryPlanEntry[] = coffeeBooksStarter
    ? [
        {
          kind: 'cafe',
          roleHint: 'start',
          label: 'coffee-books-start-reading',
          template: 'coffee-books-start-role-aware',
          queryTerms: unique([
            'coffee',
            'tea',
            'quiet',
            'reading',
            'bookstore',
            'literary',
            ...starterPackTerms.slice(0, 2),
          ]),
          notes: [
            'Coffee & Books start query keeps the opener cafe-compatible while carrying reading and bookstore intent.',
          ],
          textQuery: '',
        },
        {
          kind: 'museum',
          roleHint: 'highlight',
          label: 'coffee-books-highlight-culture',
          template: 'coffee-books-highlight-role-aware',
          queryTerms: unique([
            'bookstore',
            'books',
            'reading',
            'literary',
            'gallery',
            'local culture',
            'quiet',
            ...starterPackTerms,
          ]),
          notes: [
            'Coffee & Books highlight query requires literary, gallery, or quiet cultural supply inside the Step B cap.',
          ],
          textQuery: '',
        },
        {
          kind: 'cafe',
          roleHint: 'windDown',
          label: 'coffee-books-wind-down-literary',
          template: 'coffee-books-wind-down-role-aware',
          queryTerms: unique([
            'wind down',
            'tea',
            'dessert',
            'quiet',
            'reading',
            'literary',
            'culture',
            ...vibeTerms.slice(0, 2),
          ]),
          notes: [
            'Coffee & Books wind-down query keeps the landing soft while preserving the Books promise.',
          ],
          textQuery: '',
        },
      ]
    : [
        {
          kind: startKind,
          roleHint: 'start',
          label: 'start-intent',
          template: 'start-role-aware',
          queryTerms: unique([
            'start',
            ...personaTerms.slice(0, 2),
            ...vibeTerms.slice(0, 2),
            ...(startKind === 'cafe' ? ['coffee', 'brunch', 'easy'] : ['lighter', 'easy']),
            ...starterPackTerms.slice(0, 2),
          ]),
          notes: [
            `Start query favors easier openings for ${timeSignal.label}.`,
            startKind === 'cafe'
              ? 'Start query leans toward cafes and lighter coffee-led openings.'
              : 'Start query leans toward lighter restaurants with lower-friction entry.',
          ],
          textQuery: '',
        },
        {
          kind: highlightKind,
          roleHint: 'highlight',
          label: 'highlight-intent',
          template: 'highlight-role-aware',
          queryTerms: unique([
            'highlight',
            ...personaTerms,
            ...vibeTerms,
            ...dateOrSocialTerms,
            ...(highlightKind === 'bar'
              ? ['cocktail', 'stylish', 'night']
              : ['restaurant', 'chef led', 'intimate']),
            ...starterPackTerms,
          ]),
          notes: [
            'Highlight query aims for anchor-grade restaurant/bar candidates.',
            highlightKind === 'bar'
              ? 'Highlight query emphasizes nightlife and social anchor strength.'
              : 'Highlight query emphasizes dinner and date-centered anchor strength.',
          ],
          textQuery: '',
        },
        {
          kind: windDownKind,
          roleHint: 'windDown',
          label: 'wind-down-intent',
          template: 'wind-down-role-aware',
          queryTerms: unique([
            'wind down',
            'quiet',
            'conversation',
            ...(windDownKind === 'bar' ? ['wine', 'nightcap'] : ['dessert', 'tea', 'coffee']),
            ...vibeTerms.slice(0, 2),
            ...starterPackTerms.slice(0, 2),
          ]),
          notes: [
            'Wind-down query favors calmer endings and softer support candidates.',
            windDownKind === 'bar'
              ? 'Wind-down query allows quieter bars or wine-forward nightcaps.'
              : 'Wind-down query favors cafes and dessert-adjacent soft landings.',
          ],
          textQuery: '',
        },
        {
          kind: highlightKind,
          roleHint: 'support',
          label: 'neighborhood-broad',
          template: 'context-broad',
          queryTerms: unique([
            ...personaTerms.slice(0, 2),
            ...vibeTerms.slice(0, 2),
            'neighborhood',
            'local',
            ...starterPackTerms.slice(0, 1),
          ]),
          notes: ['Broad neighborhood query keeps a small fallback layer of context-matched live candidates.'],
          textQuery: '',
        },
        {
          kind: cultureKind,
          roleHint: 'support',
          label: 'culture-discovery',
          template: 'culture-support',
          queryTerms: unique([
            'local',
            'cultural',
            'discovery',
            ...(cultureKind === 'museum'
              ? ['museum', 'gallery', 'historic']
              : ['activity', 'community', 'art']),
            ...starterPackTerms.slice(0, 2),
          ]),
          notes: ['Culture support query expands retrieval into district-identity shaping venues.'],
          textQuery: '',
        },
        {
          kind: strollKind,
          roleHint: 'support',
          label: 'walkable-support',
          template: 'walkability-support',
          queryTerms: unique([
            'walkable',
            'neighborhood',
            'local',
            ...(strollKind === 'park'
              ? ['park', 'trail', 'open air']
              : ['plaza', 'market', 'district']),
            ...vibeTerms.slice(0, 1),
          ]),
          notes: ['Walkability support query broadens non-dining anchors for district sequencing.'],
          textQuery: '',
        },
        {
          kind: 'dessert',
          roleHint: 'windDown',
          label: 'dessert-winddown',
          template: 'winddown-dessert',
          queryTerms: unique([
            'dessert',
            'sweet',
            'shareable',
            'nightcap',
            ...vibeTerms.slice(0, 1),
          ]),
          notes: ['Dessert query provides softer end-of-route anchors when available.'],
          textQuery: '',
        },
      ]

  const withText = plan.map((entry) => ({
    ...entry,
    textQuery: buildQueryText(entry.kind, entry.queryTerms, locationLabel),
  }))

  const deduped = new Map<string, LiveQueryPlanEntry>()
  for (const entry of withText) {
    const key = `${entry.kind}:${entry.textQuery.toLowerCase()}`
    if (!deduped.has(key)) {
      deduped.set(key, entry)
    }
  }

  return [...deduped.values()]
}

export function projectInterpretationSemanticLiveQueryProjection(
  input: InterpretationSemanticQueryProjectionInput,
): InterpretationSemanticLiveQueryProjection {
  const entries = buildProjectedEntries(input)
  const locationScope =
    input.placeContext.locationScope ??
    (input.placeContext.locationLabelOverride ? 'pocket' : 'city')
  return {
    entries,
    projectedEntries: entries.map((entry) =>
      projectLiveEntry(entry, input.conciergeIntent, input.starterPack, locationScope),
    ),
    provenance: {
      owner: 'interpretation',
      compatibilityBridge: 'text_query_passthrough_until_2c_6',
      notes: [
        'Projection is derived from canonical ConciergeIntent, WhenSignalProfile, place context, and starter carriers.',
        'textQuery passthrough preserves 2C parity only; Field facet composition is required before 2C closes.',
      ],
    },
  }
}

function tokenizeTextQuery(value: string): string[] {
  return unique(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  )
}

function buildProviderSemanticEntry(
  label: InterpretationBuildProviderSemanticQueryProjectionEntry['label'],
  textQuery: string,
  sequencePurpose: SemanticQuerySequencePurpose,
): InterpretationBuildProviderSemanticQueryProjectionEntry {
  return {
    label,
    textQuery,
    queryTerms: tokenizeTextQuery(textQuery),
    sourceFamily: 'build_provider_nearby',
    facets: {
      queryIdentity: label,
      sourceFamily: 'build_provider_nearby',
      searchBreadth: label === 'build-provider-highlight' ? 'focused' : 'balanced',
      noveltyPressure: 'medium',
      locationScope: 'anchor_nearby',
      timeWindowApplicability: 'current_window',
      sequencePurpose,
    },
  }
}

export function projectInterpretationBuildProviderSemanticQueryProjection(
  anchorVenue: Pick<Venue, 'city' | 'name'>,
): InterpretationBuildProviderSemanticQueryProjection {
  const anchorLabel = `${anchorVenue.name}, ${anchorVenue.city}`
  return {
    entries: [
      buildProviderSemanticEntry(
        'build-provider-start',
        `cafes wine bars casual restaurants low key openers near ${anchorLabel}`,
        'sequence_entry',
      ),
      buildProviderSemanticEntry(
        'build-provider-highlight',
        `destination restaurants live music nightlife experiences near ${anchorLabel}`,
        'sequence_center',
      ),
      buildProviderSemanticEntry(
        'build-provider-winddown',
        `dessert quiet lounges late night cafes relaxed nightcap spots near ${anchorLabel}`,
        'sequence_landing',
      ),
    ],
    provenance: {
      owner: 'interpretation',
      compatibilityBridge: 'text_query_passthrough_until_2c_6',
      notes: [
        'Build provider semantic query strings are projected from existing anchor/city carriers for parity.',
        'Provider envelope, centers, radius, field mask, and dispatch remain outside Interpretation.',
      ],
    },
  }
}
