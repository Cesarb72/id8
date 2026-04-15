import type { TasteOpportunityAggregation } from './aggregateTasteOpportunityFromVenues'

type Step2ConvictionBucket =
  | 'anchor'
  | 'discovery'
  | 'closer'
  | 'hidden_gem'
  | 'major_event'
  | 'cultural'
  | 'nightlife'

type Step2ConvictionEntry = {
  venue: string
  weight: number
  buckets: Step2ConvictionBucket[]
}

type Step2ConvictionScenarioMap = {
  anchors: Step2ConvictionEntry[]
}

export type Step2AuthoritySignalsInput = {
  city?: string | null
  persona?: string | null
  vibe?: string | null
  anchorName?: string | null
  anchorReason?: string | null
  anchorTimingRelevance?: number
  anchorLiveContext?: {
    hasEvent?: boolean
    hasHappyHour?: boolean
    hasPerformance?: boolean
    timeWindowLabel?: string
  }
  starts: Array<{ name: string; reason?: string }>
  closes: Array<{ name: string; reason?: string }>
  happenings: Array<{
    name: string
    type?: string
    reason?: string
    timingLabel?: string
    strength?: number
    hasEvent?: boolean
    hasPerformance?: boolean
    hasHappyHour?: boolean
    timeWindowLabel?: string
  }>
  summary?: TasteOpportunityAggregation['summary']
}

export type Step2AuthoritySignals = {
  anchorConviction: number
  startConviction: number
  windDownConviction: number
  discoveryConviction: number
  hiddenGemConviction: number
  majorEventConviction: number
  culturalConviction: number
  nightlifeConviction: number
  happeningAuthority: number
  whyTonightPressure: number
  overallAuthority: number
}

const SAN_JOSE_ROMANTIC_COZY: Step2ConvictionScenarioMap = {
  anchors: [
    { venue: 'La Foret', weight: 1, buckets: ['anchor', 'hidden_gem'] },
    { venue: 'Hedley Club Lounge', weight: 0.95, buckets: ['anchor', 'closer'] },
    { venue: 'Hakone Gardens', weight: 0.93, buckets: ['anchor', 'discovery', 'hidden_gem', 'cultural'] },
    { venue: 'Japanese Friendship Garden', weight: 0.92, buckets: ['discovery', 'hidden_gem', 'cultural'] },
    { venue: 'Heritage Tea House', weight: 0.9, buckets: ['anchor', 'closer', 'hidden_gem'] },
    { venue: 'Heritage tea pairing', weight: 0.9, buckets: ['anchor', 'closer', 'hidden_gem'] },
    { venue: 'Rosicrucian Egyptian Museum', weight: 0.88, buckets: ['cultural', 'major_event', 'anchor'] },
    { venue: 'Municipal Rose Garden', weight: 0.86, buckets: ['discovery', 'hidden_gem'] },
    { venue: 'Friendship Garden', weight: 0.85, buckets: ['closer', 'hidden_gem'] },
    { venue: 'Willow Glen Tea Atelier', weight: 0.85, buckets: ['discovery', 'hidden_gem', 'closer'] },
    { venue: 'Willow Glen Bakehouse', weight: 0.83, buckets: ['closer', 'hidden_gem'] },
    { venue: 'Rose Garden sunset promenade', weight: 0.83, buckets: ['discovery', 'hidden_gem', 'closer'] },
    { venue: 'Willow Court Wine Bar', weight: 0.82, buckets: ['closer'] },
  ],
}

const SAN_JOSE_ROMANTIC_LIVELY: Step2ConvictionScenarioMap = {
  anchors: [
    { venue: 'Poor House Bistro', weight: 1, buckets: ['anchor', 'nightlife'] },
    { venue: 'Hedley Club Lounge', weight: 0.94, buckets: ['anchor', 'closer', 'nightlife'] },
    { venue: 'Hammer Theatre', weight: 0.93, buckets: ['anchor', 'major_event', 'cultural', 'nightlife'] },
    { venue: 'Opera San Jose', weight: 0.92, buckets: ['major_event', 'cultural', 'anchor'] },
    { venue: 'Paper Plane', weight: 0.9, buckets: ['nightlife', 'closer', 'anchor'] },
    { venue: 'Downtown Listening Room', weight: 0.88, buckets: ['nightlife', 'major_event'] },
    { venue: 'San Pedro Square Market', weight: 0.84, buckets: ['nightlife', 'major_event'] },
    { venue: 'SAP Center', weight: 0.82, buckets: ['major_event'] },
  ],
}

const SAN_JOSE_ROMANTIC_CULTURED: Step2ConvictionScenarioMap = {
  anchors: [
    { venue: 'Rosicrucian Egyptian Museum', weight: 1, buckets: ['anchor', 'cultural', 'major_event'] },
    { venue: 'Japanese American Gallery', weight: 0.95, buckets: ['anchor', 'cultural', 'discovery'] },
    { venue: 'Hammer Theatre', weight: 0.93, buckets: ['major_event', 'cultural', 'anchor'] },
    { venue: 'Opera San Jose', weight: 0.93, buckets: ['major_event', 'cultural', 'anchor'] },
    { venue: 'San Jose Museum of Art', weight: 0.92, buckets: ['cultural', 'discovery'] },
    { venue: 'Hakone Gardens', weight: 0.9, buckets: ['cultural', 'discovery', 'hidden_gem'] },
    { venue: 'Japanese Friendship Garden', weight: 0.88, buckets: ['cultural', 'discovery', 'hidden_gem'] },
    { venue: 'Willow Court Wine Bar', weight: 0.84, buckets: ['closer', 'cultural'] },
  ],
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesVenueName(value: string, target: string): boolean {
  const normalizedValue = normalizeToken(value)
  const normalizedTarget = normalizeToken(target)
  if (!normalizedValue || !normalizedTarget) {
    return false
  }
  return normalizedValue.includes(normalizedTarget) || normalizedTarget.includes(normalizedValue)
}

function getScenarioMap(
  city: string | undefined | null,
  persona: string | undefined | null,
  vibe: string | undefined | null,
): Step2ConvictionScenarioMap | null {
  const normalizedCity = normalizeToken(city)
  const normalizedPersona = normalizeToken(persona)
  const normalizedVibe = normalizeToken(vibe)
  if (normalizedCity !== 'san jose' || normalizedPersona !== 'romantic') {
    return null
  }
  if (normalizedVibe === 'cozy') {
    return SAN_JOSE_ROMANTIC_COZY
  }
  if (normalizedVibe === 'lively') {
    return SAN_JOSE_ROMANTIC_LIVELY
  }
  if (normalizedVibe === 'cultured') {
    return SAN_JOSE_ROMANTIC_CULTURED
  }
  return null
}

function getBucketConviction(name: string, map: Step2ConvictionScenarioMap, bucket: Step2ConvictionBucket): number {
  if (!name) {
    return 0
  }
  let best = 0
  map.anchors.forEach((entry) => {
    if (!entry.buckets.includes(bucket)) {
      return
    }
    if (matchesVenueName(name, entry.venue)) {
      best = Math.max(best, entry.weight)
    }
  })
  return best
}

function getAggregateBucketConviction(
  names: string[],
  map: Step2ConvictionScenarioMap,
  bucket: Step2ConvictionBucket,
): number {
  if (names.length === 0) {
    return 0
  }
  const values = names.map((name) => getBucketConviction(name, map, bucket))
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function getReasonSignalScore(corpus: string): {
  nightlife: number
  event: number
  cultural: number
  discovery: number
  hiddenGem: number
  close: number
  start: number
} {
  const normalized = normalizeToken(corpus)
  if (!normalized) {
    return {
      nightlife: 0,
      event: 0,
      cultural: 0,
      discovery: 0,
      hiddenGem: 0,
      close: 0,
      start: 0,
    }
  }
  const hasAny = (tokens: string[]): boolean => tokens.some((token) => normalized.includes(token))
  return {
    nightlife: hasAny(['late', 'nightlife', 'cocktail', 'live', 'jazz', 'music', 'after show']) ? 1 : 0,
    event: hasAny(['event', 'show', 'performance', 'theatre', 'opera', 'ticketed']) ? 1 : 0,
    cultural: hasAny(['museum', 'gallery', 'cultural', 'curated', 'exhibit', 'art']) ? 1 : 0,
    discovery: hasAny(['discovery', 'hidden', 'local', 'insider', 'neighborhood']) ? 1 : 0,
    hiddenGem: hasAny(['hidden', 'insider', 'garden', 'lantern', 'atelier']) ? 1 : 0,
    close: hasAny(['close', 'landing', 'nightcap', 'wind down', 'soft']) ? 1 : 0,
    start: hasAny(['start', 'entry', 'opener', 'aperitivo']) ? 1 : 0,
  }
}

function getTimingSignalScore(value: string | undefined): number {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return 0
  }
  if (normalized.includes('late')) {
    return 1
  }
  if (normalized.includes('evening') || normalized.includes('tonight')) {
    return 0.72
  }
  if (normalized.includes('day')) {
    return 0.45
  }
  return 0.56
}

function getHappeningsAuthority(happenings: Step2AuthoritySignalsInput['happenings']): {
  nightlife: number
  event: number
  cultural: number
  discovery: number
  currentness: number
} {
  if (happenings.length === 0) {
    return { nightlife: 0, event: 0, cultural: 0, discovery: 0, currentness: 0 }
  }
  let nightlife = 0
  let event = 0
  let cultural = 0
  let discovery = 0
  let currentness = 0
  happenings.slice(0, 2).forEach((entry) => {
    const weight = clampScore(entry.strength ?? 0.62)
    const reasonSignal = getReasonSignalScore(
      `${entry.name} ${entry.reason ?? ''} ${entry.timingLabel ?? ''} ${entry.type ?? ''}`,
    )
    const timingSignal = getTimingSignalScore(entry.timeWindowLabel ?? entry.timingLabel)
    if (entry.type === 'temporal') {
      event += 0.5 * weight
      nightlife += 0.25 * weight
      currentness += 0.32 * weight
    }
    if (entry.type === 'discovery') {
      discovery += 0.52 * weight
      cultural += 0.2 * weight
    }
    if (entry.type === 'community') {
      discovery += 0.34 * weight
      cultural += 0.22 * weight
    }
    nightlife += reasonSignal.nightlife * 0.32 * weight
    event += reasonSignal.event * 0.34 * weight
    cultural += reasonSignal.cultural * 0.3 * weight
    discovery += reasonSignal.discovery * 0.24 * weight
    if (entry.hasEvent) {
      event += 0.26 * weight
      currentness += 0.14 * weight
    }
    if (entry.hasPerformance) {
      event += 0.22 * weight
      nightlife += 0.14 * weight
      cultural += 0.1 * weight
      currentness += 0.1 * weight
    }
    if (entry.hasHappyHour) {
      nightlife += 0.14 * weight
      currentness += 0.16 * weight
    }
    currentness += timingSignal * 0.18 * weight
  })
  return {
    nightlife: clampScore(nightlife),
    event: clampScore(event),
    cultural: clampScore(cultural),
    discovery: clampScore(discovery),
    currentness: clampScore(currentness),
  }
}

export function deriveStep2AuthoritySignals(input: Step2AuthoritySignalsInput): Step2AuthoritySignals {
  const map = getScenarioMap(input.city, input.persona, input.vibe)
  const anchorName = input.anchorName?.trim() ?? ''
  const startNames = input.starts.map((entry) => entry.name).filter(Boolean)
  const closeNames = input.closes.map((entry) => entry.name).filter(Boolean)
  const reasonCorpus = `${anchorName} ${input.anchorReason ?? ''} ${startNames
    .map((name, index) => `${name} ${input.starts[index]?.reason ?? ''}`)
    .join(' ')} ${closeNames
    .map((name, index) => `${name} ${input.closes[index]?.reason ?? ''}`)
    .join(' ')}`.trim()
  const reasonSignals = getReasonSignalScore(reasonCorpus)
  const happeningsSignals = getHappeningsAuthority(input.happenings)
  const anchorTimingSignal = clampScore(input.anchorTimingRelevance ?? 0)
  const anchorLiveSignal = clampScore(
    (input.anchorLiveContext?.hasEvent ? 0.26 : 0) +
      (input.anchorLiveContext?.hasPerformance ? 0.24 : 0) +
      (input.anchorLiveContext?.hasHappyHour ? 0.18 : 0) +
      getTimingSignalScore(input.anchorLiveContext?.timeWindowLabel) * 0.2,
  )

  const mappedAnchor = map ? getBucketConviction(anchorName, map, 'anchor') : 0
  const mappedStart = map ? getAggregateBucketConviction(startNames, map, 'discovery') : 0
  const mappedWindDown = map ? getAggregateBucketConviction(closeNames, map, 'closer') : 0
  const mappedHiddenGem = map
    ? getAggregateBucketConviction([anchorName, ...startNames, ...closeNames], map, 'hidden_gem')
    : 0
  const mappedCultural = map
    ? getAggregateBucketConviction([anchorName, ...startNames, ...closeNames], map, 'cultural')
    : 0
  const mappedNightlife = map
    ? getAggregateBucketConviction([anchorName, ...startNames, ...closeNames], map, 'nightlife')
    : 0
  const mappedMajorEvent = map
    ? getAggregateBucketConviction([anchorName, ...startNames, ...closeNames], map, 'major_event')
    : 0
  const mappedDiscovery = map
    ? getAggregateBucketConviction([anchorName, ...startNames], map, 'discovery')
    : 0

  const summaryNightlife =
    input.summary?.dominantEnergy === 'lively'
      ? 1
      : input.summary?.dominantEnergy === 'balanced'
        ? 0.62
        : 0.34
  const summaryCultural =
    input.summary?.discoveryBalance === 'novel'
      ? 1
      : input.summary?.discoveryBalance === 'balanced'
        ? 0.64
        : 0.34
  const summaryAnchor =
    input.summary?.highlightPotential === 'high'
      ? 1
      : input.summary?.highlightPotential === 'medium'
        ? 0.72
        : 0.44
  const summaryContainment =
    input.summary?.movementProfile === 'tight'
      ? 0.9
      : input.summary?.movementProfile === 'moderate'
        ? 0.65
        : 0.36
  const anchorContextSignal = Math.max(
    reasonSignals.event,
    reasonSignals.cultural,
    reasonSignals.nightlife,
  )

  const anchorConviction = clampScore(
    mappedAnchor * 0.56 + summaryAnchor * 0.34 + anchorContextSignal * 0.1,
  )
  const startConviction = clampScore(
    mappedStart * 0.5 +
      reasonSignals.start * 0.28 +
      summaryContainment * 0.12 +
      mappedAnchor * 0.1,
  )
  const windDownConviction = clampScore(
    mappedWindDown * 0.52 +
      reasonSignals.close * 0.26 +
      mappedHiddenGem * 0.1 +
      summaryContainment * 0.12,
  )
  const hiddenGemConviction = clampScore(
    mappedHiddenGem * 0.6 + reasonSignals.hiddenGem * 0.16 + happeningsSignals.discovery * 0.24,
  )
  const culturalConviction = clampScore(
    mappedCultural * 0.56 + happeningsSignals.cultural * 0.24 + summaryCultural * 0.2,
  )
  const nightlifeConviction = clampScore(
    mappedNightlife * 0.5 + happeningsSignals.nightlife * 0.26 + summaryNightlife * 0.24,
  )
  const majorEventConviction = clampScore(
    mappedMajorEvent * 0.54 +
      happeningsSignals.event * 0.3 +
      reasonSignals.event * 0.1 +
      summaryNightlife * 0.06,
  )
  const discoveryConviction = clampScore(
    mappedDiscovery * 0.46 +
      happeningsSignals.discovery * 0.26 +
      reasonSignals.discovery * 0.14 +
      summaryCultural * 0.14,
  )
  const happeningAuthority = clampScore(
    happeningsSignals.event * 0.32 +
      happeningsSignals.nightlife * 0.24 +
      happeningsSignals.cultural * 0.24 +
      happeningsSignals.discovery * 0.2 +
      summaryNightlife * 0.06 +
      summaryCultural * 0.06,
  )
  const whyTonightPressure = clampScore(
    happeningsSignals.currentness * 0.38 +
      happeningsSignals.event * 0.18 +
      happeningsSignals.nightlife * 0.14 +
      anchorTimingSignal * 0.14 +
      anchorLiveSignal * 0.16,
  )

  const normalizedVibe = normalizeToken(input.vibe)
  const modeAuthority =
    normalizedVibe === 'lively'
      ? nightlifeConviction * 0.34 +
        majorEventConviction * 0.24 +
        anchorConviction * 0.18 +
        startConviction * 0.12 +
        whyTonightPressure * 0.12
      : normalizedVibe === 'cultured'
        ? culturalConviction * 0.3 +
          discoveryConviction * 0.2 +
          majorEventConviction * 0.14 +
          windDownConviction * 0.12 +
          anchorConviction * 0.1 +
          whyTonightPressure * 0.14
        : hiddenGemConviction * 0.26 +
          windDownConviction * 0.24 +
          anchorConviction * 0.18 +
          discoveryConviction * 0.1 +
          culturalConviction * 0.1 +
          whyTonightPressure * 0.12

  const overallAuthority = clampScore(
    modeAuthority * 0.66 +
      happeningAuthority * 0.14 +
      whyTonightPressure * 0.12 +
      ((anchorConviction + startConviction + windDownConviction) / 3) * 0.08,
  )

  return {
    anchorConviction,
    startConviction,
    windDownConviction,
    discoveryConviction,
    hiddenGemConviction,
    majorEventConviction,
    culturalConviction,
    nightlifeConviction,
    happeningAuthority,
    whyTonightPressure,
    overallAuthority,
  }
}
