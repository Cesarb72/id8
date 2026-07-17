import { getTimeWindowSignal } from '../../retrieval/getTimeWindowSignal'
import type { LivePlaceKind, LiveQueryPlanEntry, LiveQueryRoleHint } from '../../sources/buildLiveQueryPlan'
import type { IntentProfile } from '../../types/intent'
import type { StarterPack } from '../../types/starterPack'
import type { Venue } from '../../types/venue'

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

function getPersonaTerms(intent: IntentProfile): string[] {
  if (intent.crew === 'romantic') {
    return ['intimate', 'date night', 'conversation']
  }
  if (intent.crew === 'socialite') {
    return ['social', 'cocktail', 'lively']
  }
  return ['welcoming', 'casual', 'comfortable']
}

function getVibeTerms(intent: IntentProfile): string[] {
  const primary = intent.primaryAnchor
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

function buildLocationLabel(intent: IntentProfile): string {
  return intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city
}

function buildQueryText(kind: LivePlaceKind, descriptors: string[], locationLabel: string): string {
  const phrase = unique(descriptors).slice(0, 4).join(' ')
  return `${phrase} ${kind} in ${locationLabel}`.trim()
}

function isCoffeeBooksStarter(starterPack?: StarterPack): boolean {
  return starterPack?.id === 'coffee-books'
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

function getNoveltyPressure(intent: IntentProfile, starterPack?: StarterPack): SemanticQueryNoveltyPressure {
  if (intent.prefersHiddenGems || starterPack?.lensPreset?.discoveryBias === 'high') {
    return 'high'
  }
  if (starterPack?.lensPreset?.discoveryBias === 'low') {
    return 'low'
  }
  return 'medium'
}

function projectLiveEntry(
  entry: LiveQueryPlanEntry,
  intent: IntentProfile,
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
      noveltyPressure: getNoveltyPressure(intent, starterPack),
      locationScope,
      timeWindowApplicability: 'current_window',
      sequencePurpose: getSequencePurpose(entry.roleHint),
    },
  }
}

function buildProjectedEntries(
  intent: IntentProfile,
  starterPack?: StarterPack,
  options: { locationLabelOverride?: string } = {},
): LiveQueryPlanEntry[] {
  const locationLabel = options.locationLabelOverride?.trim() || buildLocationLabel(intent)
  const timeSignal = getTimeWindowSignal(intent)
  const personaTerms = getPersonaTerms(intent)
  const vibeTerms = getVibeTerms(intent)
  const starterPackTerms = pickStarterPackTerms(starterPack)
  const dateOrSocialTerms =
    intent.crew === 'romantic'
      ? ['wine', 'dessert']
      : intent.crew === 'socialite'
        ? ['cocktail', 'group friendly']
        : ['coffee', 'daytime']

  const startKind: LivePlaceKind =
    timeSignal.phase === 'morning' || timeSignal.phase === 'afternoon' ? 'cafe' : 'restaurant'
  const highlightKind: LivePlaceKind =
    timeSignal.phase === 'late-night' ||
    intent.primaryAnchor === 'lively' ||
    intent.crew === 'socialite'
      ? 'bar'
      : 'restaurant'
  const windDownKind: LivePlaceKind = timeSignal.phase === 'late-night' ? 'bar' : 'cafe'
  const cultureKind: LivePlaceKind =
    intent.primaryAnchor === 'cultured' || intent.crew === 'curator'
      ? 'museum'
      : 'activity'
  const strollKind: LivePlaceKind =
    intent.primaryAnchor === 'cozy' || intent.primaryAnchor === 'chill' ? 'park' : 'activity'

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
  intent: IntentProfile,
  starterPack?: StarterPack,
  options: { locationLabelOverride?: string; locationScope?: SemanticQueryLocationScope } = {},
): InterpretationSemanticLiveQueryProjection {
  const entries = buildProjectedEntries(intent, starterPack, options)
  const locationScope = options.locationScope ?? (options.locationLabelOverride ? 'pocket' : 'city')
  return {
    entries,
    projectedEntries: entries.map((entry) =>
      projectLiveEntry(entry, intent, starterPack, locationScope),
    ),
    provenance: {
      owner: 'interpretation',
      compatibilityBridge: 'text_query_passthrough_until_2c_6',
      notes: [
        'Projection is derived from existing Interpretation intent/starter carriers.',
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
