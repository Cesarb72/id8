import type { DetectedMomentType } from './types'

export type HospitalityPersona = 'romantic' | 'friends' | 'family'
export type HospitalityVibe = 'cozy' | 'lively' | 'cultured'

export type ScenarioStopRole = 'start' | 'highlight' | 'windDown'

export type ScenarioStopRule = {
  position: number
  stopType: string
  purpose: string
  examples?: string[]
}

export type ScenarioTimingRules = {
  startWindowLabels: string[]
  endWindowLabels: string[]
  paceLabel: string
  minStopMinutes?: number
  maxStopMinutes?: number
  minBufferMinutes?: number
}

export type ScenarioHiddenGemRules = {
  minimumHiddenGemStops?: number
  preferredHiddenGemVenues?: string[]
  routeLevelHiddenGemBias?: boolean
}

export type ScenarioAnchorRules = {
  defaultPrimaryAnchors?: string[]
  stronglyPreferredVenues?: string[]
  allowedVenues?: string[]
  avoidVenues?: string[]
  forbiddenPatterns?: string[]
}

export type ScenarioSelectionBias = {
  roleBoosts?: Partial<Record<ScenarioStopRole, number>>
  momentTypeBoosts?: Partial<Record<DetectedMomentType, number>>
  preferredVenueBoost?: number
  hiddenGemBoost?: number
}

export type HospitalityScenarioContract = {
  id: string
  city: string
  persona: HospitalityPersona
  vibe: HospitalityVibe
  buildLabel: string
  description: string
  timingRules: ScenarioTimingRules
  stopRules: ScenarioStopRule[]
  hiddenGemRules: ScenarioHiddenGemRules
  anchorRules: ScenarioAnchorRules
  toneGuidance: string
  specialRules?: string[]
  selectionBias?: ScenarioSelectionBias
}

type ScenarioLookupInput = {
  city?: string | null
  persona?: string | null
  vibe?: string | null
}

const SAN_JOSE_ROMANTIC_COZY_CONTRACT: HospitalityScenarioContract = {
  id: 'san_jose_romantic_cozy',
  city: 'San Jose',
  persona: 'romantic',
  vibe: 'cozy',
  buildLabel: 'Romantic Cozy Concierge Build',
  description:
    'Atmospheric romantic pacing that centers a conviction dinner anchor, preserves hidden gems, and closes softly.',
  timingRules: {
    startWindowLabels: ['golden-hour', 'early-evening'],
    endWindowLabels: ['nightcap', 'soft-close'],
    paceLabel: 'gentle linger',
    minStopMinutes: 55,
    maxStopMinutes: 120,
    minBufferMinutes: 10,
  },
  stopRules: [
    {
      position: 1,
      stopType: 'start',
      purpose: 'shared arrival with low-friction movement',
      examples: ['garden stroll', 'tea', 'quiet aperitif'],
    },
    {
      position: 2,
      stopType: 'highlight',
      purpose: 'intimate dinner or scenic romantic centerpiece',
      examples: ['intimate dinner', 'scenic anchor', 'conversation-first'],
    },
    {
      position: 3,
      stopType: 'windDown',
      purpose: 'soft close with jazz, wine, or calm cocktail energy',
      examples: ['jazz close', 'wine bar', 'quiet lounge'],
    },
  ],
  hiddenGemRules: {
    minimumHiddenGemStops: 1,
    preferredHiddenGemVenues: [
      'Hakone Gardens',
      'Japanese Friendship Garden',
      'Rosicrucian Egyptian Museum',
    ],
    routeLevelHiddenGemBias: true,
  },
  anchorRules: {
    defaultPrimaryAnchors: ['La Foret', 'Hedley Club Lounge'],
    stronglyPreferredVenues: [
      'La Foret',
      'Hedley Club Lounge',
      'Hakone Gardens',
      'Japanese Friendship Garden',
    ],
    avoidVenues: ['San Pedro Square Market'],
    forbiddenPatterns: [
      'back to back high energy bar crawl',
      'hard cut ending after peak',
      'no intimate centerpiece',
    ],
  },
  toneGuidance: 'Warm, intimate, and discovery-aware with a calm landing.',
  specialRules: [
    'Preserve at least one hidden-gem or scenic signal when available.',
    'Avoid loud back-to-back peak stacking.',
  ],
  selectionBias: {
    roleBoosts: {
      start: 0.04,
      highlight: 0.09,
      windDown: 0.06,
    },
    momentTypeBoosts: {
      anchor: 0.08,
      supporting: 0.05,
      discovery: 0.07,
      community: 0.06,
      temporal: 0.03,
    },
    preferredVenueBoost: 0.16,
    hiddenGemBoost: 0.09,
  },
}

const SAN_JOSE_ROMANTIC_LIVELY_CONTRACT: HospitalityScenarioContract = {
  id: 'san_jose_romantic_lively',
  city: 'San Jose',
  persona: 'romantic',
  vibe: 'lively',
  buildLabel: 'Romantic Lively Concierge Build',
  description:
    'Aperitivo-to-performance pulse with a conviction highlight and an intentional late close.',
  timingRules: {
    startWindowLabels: ['aperitivo', 'early-evening'],
    endWindowLabels: ['late-night', 'after-show'],
    paceLabel: 'energized build',
    minStopMinutes: 40,
    maxStopMinutes: 105,
    minBufferMinutes: 8,
  },
  stopRules: [
    {
      position: 1,
      stopType: 'start',
      purpose: 'social opener that builds toward a stronger center',
      examples: ['aperitivo', 'cocktail start', 'quick social opener'],
    },
    {
      position: 2,
      stopType: 'highlight',
      purpose: 'energetic dinner or live cultural centerpiece',
      examples: ['energetic dinner', 'performance anchor', 'live center'],
    },
    {
      position: 3,
      stopType: 'windDown',
      purpose: 'intentional late close with optional final bite',
      examples: ['late cocktail', 'nightcap', 'late food'],
    },
  ],
  hiddenGemRules: {
    minimumHiddenGemStops: 1,
    preferredHiddenGemVenues: ['Poor House Bistro', 'Hammer Theatre', 'Opera San Jose'],
    routeLevelHiddenGemBias: true,
  },
  anchorRules: {
    defaultPrimaryAnchors: ['Poor House Bistro', 'Hedley Club Lounge'],
    stronglyPreferredVenues: [
      'Poor House Bistro',
      'Hedley Club Lounge',
      'Hammer Theatre',
      'Opera San Jose',
      'Paper Plane',
    ],
    avoidVenues: ['quiet daytime cafe'],
    forbiddenPatterns: [
      'flat pacing without a clear center',
      'early close before peak lands',
      'low energy anchor for lively build',
    ],
  },
  toneGuidance: 'Confident pulse with a clear center and clean late landing.',
  specialRules: [
    'Protect anchor conviction before over-optimizing proximity.',
    'Preserve temporal/community moments when they reinforce tonight relevance.',
  ],
  selectionBias: {
    roleBoosts: {
      start: 0.03,
      highlight: 0.11,
      windDown: 0.04,
    },
    momentTypeBoosts: {
      anchor: 0.1,
      temporal: 0.09,
      discovery: 0.05,
      community: 0.06,
      supporting: 0.03,
    },
    preferredVenueBoost: 0.18,
    hiddenGemBoost: 0.07,
  },
}

const SAN_JOSE_ROMANTIC_CULTURED_CONTRACT: HospitalityScenarioContract = {
  id: 'san_jose_romantic_cultured',
  city: 'San Jose',
  persona: 'romantic',
  vibe: 'cultured',
  buildLabel: 'Romantic Cultured Concierge Build',
  description:
    'Institution or gallery-led structure with thoughtful pacing, strong anchor conviction, and refined close.',
  timingRules: {
    startWindowLabels: ['late-afternoon', 'early-evening'],
    endWindowLabels: ['nightcap', 'late-gallery-close'],
    paceLabel: 'intentional curated',
    minStopMinutes: 50,
    maxStopMinutes: 125,
    minBufferMinutes: 10,
  },
  stopRules: [
    {
      position: 1,
      stopType: 'start',
      purpose: 'curated opener that sets context and pace',
      examples: ['institution opener', 'gallery start', 'wine-led entry'],
    },
    {
      position: 2,
      stopType: 'highlight',
      purpose: 'cultural conviction centerpiece',
      examples: ['museum anchor', 'performance center', 'fine dining highlight'],
    },
    {
      position: 3,
      stopType: 'windDown',
      purpose: 'quiet reflective close nearby',
      examples: ['refined nightcap', 'soft close', 'quiet walk'],
    },
  ],
  hiddenGemRules: {
    minimumHiddenGemStops: 1,
    preferredHiddenGemVenues: [
      'Rosicrucian Egyptian Museum',
      'Japanese Friendship Garden',
      'Hakone Gardens',
    ],
    routeLevelHiddenGemBias: true,
  },
  anchorRules: {
    defaultPrimaryAnchors: ['Rosicrucian Egyptian Museum'],
    stronglyPreferredVenues: [
      'Rosicrucian Egyptian Museum',
      'Hammer Theatre',
      'Opera San Jose',
      'Hakone Gardens',
    ],
    avoidVenues: ['high-volume sports bar'],
    forbiddenPatterns: [
      'generic loud bar crawl',
      'anchorless roaming',
      'high friction cross city hopping',
    ],
  },
  toneGuidance: 'Curated, place-aware, and reflective with a clear cultural center.',
  specialRules: [
    'Bias toward high-conviction cultural anchors when available.',
    'Preserve discovery/community moments that deepen place meaning.',
  ],
  selectionBias: {
    roleBoosts: {
      start: 0.05,
      highlight: 0.09,
      windDown: 0.06,
    },
    momentTypeBoosts: {
      discovery: 0.1,
      community: 0.09,
      anchor: 0.08,
      temporal: 0.05,
      supporting: 0.04,
    },
    preferredVenueBoost: 0.17,
    hiddenGemBoost: 0.1,
  },
}

export const HOSPITALITY_SCENARIO_CONTRACTS: HospitalityScenarioContract[] = [
  SAN_JOSE_ROMANTIC_COZY_CONTRACT,
  SAN_JOSE_ROMANTIC_LIVELY_CONTRACT,
  SAN_JOSE_ROMANTIC_CULTURED_CONTRACT,
]

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function normalizePersona(value: string | null | undefined): HospitalityPersona | undefined {
  const token = normalizeToken(value)
  if (token.includes('romantic') || token.includes('couple') || token.includes('date')) {
    return 'romantic'
  }
  if (token.includes('friend') || token.includes('social')) {
    return 'friends'
  }
  if (token.includes('family')) {
    return 'family'
  }
  return undefined
}

function normalizeVibe(value: string | null | undefined): HospitalityVibe | undefined {
  const token = normalizeToken(value)
  if (token.includes('cozy') || token.includes('chill') || token.includes('calm')) {
    return 'cozy'
  }
  if (
    token.includes('lively') ||
    token.includes('playful') ||
    token.includes('pulse') ||
    token.includes('energetic')
  ) {
    return 'lively'
  }
  if (token.includes('cultured') || token.includes('culture') || token.includes('curated')) {
    return 'cultured'
  }
  return undefined
}

function normalizeCity(value: string | null | undefined): string {
  return normalizeToken(value)
}

function isSanJoseCity(value: string | null | undefined): boolean {
  const city = normalizeCity(value)
  return (
    city.includes('san jose') ||
    city.includes('san jose ca') ||
    city.includes('sj') ||
    city.includes('silicon valley')
  )
}

export function getHospitalityScenarioContract(
  input: ScenarioLookupInput,
): HospitalityScenarioContract | null {
  const persona = normalizePersona(input.persona)
  const vibe = normalizeVibe(input.vibe)
  if (!persona || !vibe) {
    return null
  }
  if (!isSanJoseCity(input.city)) {
    return null
  }
  return (
    HOSPITALITY_SCENARIO_CONTRACTS.find(
      (contract) =>
        contract.city === 'San Jose' &&
        contract.persona === persona &&
        contract.vibe === vibe,
    ) ?? null
  )
}
