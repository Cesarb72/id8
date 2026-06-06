import type { ProviderCallPurpose } from './providerCallTrace'

export type ProviderCorpusRole = 'start' | 'highlight' | 'windDown' | 'support'

export type ProviderCorpusCategoryFamily =
  | 'arcade_activity'
  | 'cocktail_nightlife'
  | 'coffee_books'
  | 'cultural_spaces'
  | 'dessert_pastry'
  | 'dining'
  | 'family_activity'
  | 'ice_cream'
  | 'live_music'
  | 'parks_outdoor'
  | 'street_food'
  | 'wine_intimate'

export type ProviderCorpusScenarioFamily =
  | 'romantic_cozy'
  | 'romantic_lively'
  | 'romantic_cultured'
  | 'friends_cozy'
  | 'friends_lively'
  | 'friends_cultured'
  | 'family_cozy'
  | 'family_lively'
  | 'family_cultured'

export type ProviderCorpusBuildAnchorFamily =
  | 'activity'
  | 'cafe'
  | 'cocktail'
  | 'culture'
  | 'dessert'
  | 'dining'
  | 'family_activity'
  | 'live_music'
  | 'park'
  | 'street_food'
  | 'wine'

export interface ProviderCorpusManifestEntry {
  label: string
  queryText: string
  purpose: Extract<ProviderCallPurpose, 'retrieval_supply'>
  supportedStarters: string[]
  supportedScenarioFamilies: ProviderCorpusScenarioFamily[]
  supportedBuildAnchorFamilies: ProviderCorpusBuildAnchorFamily[]
  expectedRoles: ProviderCorpusRole[]
  expectedCategoryFamily: ProviderCorpusCategoryFamily
  gate1Required: boolean
  surpriseHighlightSupport: boolean
  maxCenters: number
  maxCalls: number
}

export interface ProviderCorpusManifest {
  city: 'San Jose'
  executionScope: 'offline_corpus_build_only'
  entries: ProviderCorpusManifestEntry[]
  expectedQueryCount: number
  provider: 'google-places'
}

const retrievalSupplyPurpose: Extract<ProviderCallPurpose, 'retrieval_supply'> = 'retrieval_supply'

export const providerCorpusScenarioFamilies: ProviderCorpusScenarioFamily[] = [
  'romantic_cozy',
  'romantic_lively',
  'romantic_cultured',
  'friends_cozy',
  'friends_lively',
  'friends_cultured',
  'family_cozy',
  'family_lively',
  'family_cultured',
]

export const providerCorpusGate1StarterIds = [
  'cozy-date-night',
  'dessert-conversation',
  'wine-slow-evening',
  'sunset-stroll',
  'park-ice-cream',
  'museum-afternoon',
  'live-music-loop',
  'coffee-books',
  'hidden-cocktail-corners',
  'arcade-drinks',
  'street-food-adventure',
]

export const providerCorpusRequiredBuildAnchorFamilies: ProviderCorpusBuildAnchorFamily[] = [
  'activity',
  'cafe',
  'cocktail',
  'culture',
  'dessert',
  'dining',
  'family_activity',
  'live_music',
  'park',
  'street_food',
  'wine',
]

function gate1Entry(
  entry: Omit<ProviderCorpusManifestEntry, 'gate1Required' | 'maxCalls' | 'maxCenters' | 'purpose'>,
): ProviderCorpusManifestEntry {
  return {
    ...entry,
    gate1Required: true,
    maxCalls: 1,
    maxCenters: 1,
    purpose: retrievalSupplyPurpose,
  }
}

export const providerCorpusManifest: ProviderCorpusManifest = {
  city: 'San Jose',
  executionScope: 'offline_corpus_build_only',
  expectedQueryCount: 12,
  provider: 'google-places',
  entries: [
    gate1Entry({
      label: 'cocktail-nightlife-sofa',
      queryText: 'cocktail bars SoFa District San Jose',
      supportedStarters: ['hidden-cocktail-corners', 'cozy-date-night', 'wine-slow-evening'],
      supportedScenarioFamilies: [
        'romantic_cozy',
        'romantic_lively',
        'friends_lively',
        'friends_cultured',
      ],
      supportedBuildAnchorFamilies: ['cocktail'],
      expectedRoles: ['highlight', 'windDown', 'support'],
      expectedCategoryFamily: 'cocktail_nightlife',
      surpriseHighlightSupport: true,
    }),
    gate1Entry({
      label: 'live-music-downtown',
      queryText: 'live music venues Downtown San Jose',
      supportedStarters: ['live-music-loop', 'hidden-cocktail-corners'],
      supportedScenarioFamilies: ['romantic_lively', 'friends_lively', 'friends_cultured'],
      supportedBuildAnchorFamilies: ['live_music', 'cocktail'],
      expectedRoles: ['highlight', 'support'],
      expectedCategoryFamily: 'live_music',
      surpriseHighlightSupport: true,
    }),
    gate1Entry({
      label: 'dining-sofa',
      queryText: 'restaurants dining SoFa District San Jose',
      supportedStarters: ['cozy-date-night', 'wine-slow-evening', 'street-food-adventure'],
      supportedScenarioFamilies: [
        'romantic_cozy',
        'romantic_lively',
        'friends_cozy',
        'friends_lively',
        'family_cozy',
      ],
      supportedBuildAnchorFamilies: ['dining'],
      expectedRoles: ['start', 'highlight', 'support'],
      expectedCategoryFamily: 'dining',
      surpriseHighlightSupport: true,
    }),
    gate1Entry({
      label: 'dessert-late-night',
      queryText: 'dessert pastry late night San Jose',
      supportedStarters: ['dessert-conversation', 'park-ice-cream', 'cozy-date-night'],
      supportedScenarioFamilies: ['romantic_cozy', 'friends_cozy', 'family_cozy'],
      supportedBuildAnchorFamilies: ['dessert', 'cafe'],
      expectedRoles: ['windDown', 'support'],
      expectedCategoryFamily: 'dessert_pastry',
      surpriseHighlightSupport: false,
    }),
    gate1Entry({
      label: 'coffee-books',
      queryText: 'coffee cafes bookstores San Jose',
      supportedStarters: ['coffee-books', 'dessert-conversation'],
      supportedScenarioFamilies: ['romantic_cozy', 'friends_cozy', 'family_cozy', 'family_cultured'],
      supportedBuildAnchorFamilies: ['cafe'],
      expectedRoles: ['start', 'windDown', 'support'],
      expectedCategoryFamily: 'coffee_books',
      surpriseHighlightSupport: false,
    }),
    gate1Entry({
      label: 'arcade-entertainment-bars',
      queryText: 'arcade entertainment bars San Jose',
      supportedStarters: ['arcade-drinks', 'hidden-cocktail-corners'],
      supportedScenarioFamilies: ['friends_lively', 'family_lively', 'romantic_lively'],
      supportedBuildAnchorFamilies: ['activity', 'cocktail'],
      expectedRoles: ['highlight', 'support'],
      expectedCategoryFamily: 'arcade_activity',
      surpriseHighlightSupport: true,
    }),
    gate1Entry({
      label: 'street-food-casual',
      queryText: 'street food casual dining San Jose',
      supportedStarters: ['street-food-adventure'],
      supportedScenarioFamilies: ['friends_lively', 'friends_cultured', 'family_lively'],
      supportedBuildAnchorFamilies: ['street_food', 'dining'],
      expectedRoles: ['start', 'highlight', 'support'],
      expectedCategoryFamily: 'street_food',
      surpriseHighlightSupport: true,
    }),
    gate1Entry({
      label: 'museums-galleries-culture',
      queryText: 'museums galleries cultural spaces San Jose',
      supportedStarters: ['museum-afternoon', 'sunset-stroll'],
      supportedScenarioFamilies: ['romantic_cultured', 'friends_cultured', 'family_cultured'],
      supportedBuildAnchorFamilies: ['culture'],
      expectedRoles: ['highlight', 'support'],
      expectedCategoryFamily: 'cultural_spaces',
      surpriseHighlightSupport: true,
    }),
    gate1Entry({
      label: 'parks-outdoor',
      queryText: 'parks outdoor recreation San Jose',
      supportedStarters: ['sunset-stroll', 'park-ice-cream'],
      supportedScenarioFamilies: ['romantic_cozy', 'friends_cozy', 'family_cozy', 'family_lively'],
      supportedBuildAnchorFamilies: ['park'],
      expectedRoles: ['start', 'support', 'windDown'],
      expectedCategoryFamily: 'parks_outdoor',
      surpriseHighlightSupport: false,
    }),
    gate1Entry({
      label: 'family-activities-dining',
      queryText: 'family friendly activities dining San Jose',
      supportedStarters: ['park-ice-cream', 'museum-afternoon', 'street-food-adventure'],
      supportedScenarioFamilies: ['family_cozy', 'family_lively', 'family_cultured'],
      supportedBuildAnchorFamilies: ['family_activity', 'activity', 'dining'],
      expectedRoles: ['start', 'highlight', 'support'],
      expectedCategoryFamily: 'family_activity',
      surpriseHighlightSupport: true,
    }),
    gate1Entry({
      label: 'ice-cream-gelato',
      queryText: 'ice cream gelato dessert San Jose',
      supportedStarters: ['park-ice-cream', 'dessert-conversation'],
      supportedScenarioFamilies: ['romantic_cozy', 'friends_cozy', 'family_cozy', 'family_lively'],
      supportedBuildAnchorFamilies: ['dessert', 'cafe'],
      expectedRoles: ['windDown', 'support'],
      expectedCategoryFamily: 'ice_cream',
      surpriseHighlightSupport: false,
    }),
    gate1Entry({
      label: 'wine-intimate-willow-glen',
      queryText: 'wine bars intimate dining Willow Glen San Jose',
      supportedStarters: ['wine-slow-evening', 'cozy-date-night', 'hidden-cocktail-corners'],
      supportedScenarioFamilies: ['romantic_cozy', 'romantic_cultured', 'friends_cozy'],
      supportedBuildAnchorFamilies: ['wine', 'dining', 'cocktail'],
      expectedRoles: ['highlight', 'windDown', 'support'],
      expectedCategoryFamily: 'wine_intimate',
      surpriseHighlightSupport: true,
    }),
  ],
}
