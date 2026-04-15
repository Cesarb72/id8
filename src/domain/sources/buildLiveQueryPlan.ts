import { getTimeWindowSignal } from '../retrieval/getTimeWindowSignal'
import type { IntentProfile } from '../types/intent'
import type { StarterPack } from '../types/starterPack'

export type LivePlaceKind =
  | 'restaurant'
  | 'bar'
  | 'cafe'
  | 'dessert'
  | 'museum'
  | 'activity'
  | 'park'
export type LiveQueryRoleHint = 'start' | 'highlight' | 'windDown' | 'support'

export interface LiveQueryPlanEntry {
  kind: LivePlaceKind
  roleHint: LiveQueryRoleHint
  label: string
  template: string
  textQuery: string
  queryTerms: string[]
  notes: string[]
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

export function buildLiveQueryPlan(
  intent: IntentProfile,
  starterPack?: StarterPack,
): LiveQueryPlanEntry[] {
  const locationLabel = buildLocationLabel(intent)
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

  const plan: LiveQueryPlanEntry[] = [
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
