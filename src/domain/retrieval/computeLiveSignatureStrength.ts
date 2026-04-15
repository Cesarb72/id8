import type { RawVenueInput } from '../types/rawPlace'
import type { VenueCategory } from '../types/venue'

export interface LiveSignatureStrength {
  strength: number
  signatureBoost: number
  genericRelief: number
  sourceConfidenceBoost: number
  notes: string[]
}

const emptyStrength: LiveSignatureStrength = {
  strength: 0,
  signatureBoost: 0,
  genericRelief: 0,
  sourceConfidenceBoost: 0,
  notes: [],
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function tokenizeQueryLabel(value: string | undefined): string[] {
  if (!value) {
    return []
  }
  return value
    .split(/[^a-z0-9]+/i)
    .map((part) => normalizeValue(part))
    .filter(Boolean)
}

function countMatches(values: Set<string>, candidates: string[]): number {
  return candidates.filter((candidate) => values.has(normalizeValue(candidate))).length
}

export function computeLiveSignatureStrength(
  raw: RawVenueInput,
  category: VenueCategory,
): LiveSignatureStrength {
  if (raw.sourceOrigin !== 'live') {
    return emptyStrength
  }

  const normalizedSignals = new Set<string>([
    ...(raw.tags ?? []).map(normalizeValue),
    ...(raw.sourceTypes ?? []).map(normalizeValue),
    ...(raw.queryTerms ?? []).map(normalizeValue),
    ...tokenizeQueryLabel(raw.sourceQueryLabel),
  ])
  const notes: string[] = []

  const distinctiveSignals = countMatches(normalizedSignals, [
    'cocktails',
    'cocktail-bar',
    'wine',
    'wine-bar',
    'espresso-bar',
    'tea-house',
    'brunch',
    'chef-led',
    'seasonal',
    'local',
    'artisan',
    'craft',
    'cozy',
    'intimate',
    'rooftop',
    'outdoor-seating',
    'historic',
    'understated',
  ])
  const categorySpecificSignals =
    category === 'bar'
      ? countMatches(normalizedSignals, ['cocktails', 'wine', 'rooftop', 'brewery', 'craft', 'intimate'])
      : category === 'cafe'
        ? countMatches(normalizedSignals, ['espresso-bar', 'tea-house', 'cozy', 'artisan', 'local'])
        : countMatches(normalizedSignals, ['chef-led', 'seasonal', 'brunch', 'local', 'craft', 'intimate'])

  const rating = raw.rating ?? 0
  const ratingCount = raw.ratingCount ?? 0
  const reviewSignal =
    (rating >= 4.6 ? 0.12 : rating >= 4.4 ? 0.08 : rating >= 4.2 ? 0.04 : 0) +
    (ratingCount >= 800 ? 0.1 : ratingCount >= 250 ? 0.07 : ratingCount >= 80 ? 0.04 : 0)
  const summarySignal =
    raw.shortDescription && raw.shortDescription.trim().length >= 36
      ? 0.06
      : raw.shortDescription && raw.shortDescription.trim().length >= 20
        ? 0.03
        : 0
  const querySignal = categorySpecificSignals >= 1 && (raw.queryTerms?.length ?? 0) > 0 ? 0.04 : 0
  const localSignal = distinctiveSignals >= 2 ? 0.06 : distinctiveSignals === 1 ? 0.03 : 0
  const chainPenalty = raw.isChain ? 0.12 : 0

  const strength = clamp01(
    0.26 +
      reviewSignal +
      summarySignal +
      querySignal +
      localSignal +
      Math.min(categorySpecificSignals, 3) * 0.06 -
      chainPenalty,
  )

  if (reviewSignal >= 0.08) {
    notes.push('reviews imply stronger local signal')
  }
  if (categorySpecificSignals >= 1) {
    notes.push('category-specific signature cues detected')
  }
  if (querySignal > 0) {
    notes.push('query intent aligns with venue signature')
  }

  return {
    strength: Number(strength.toFixed(2)),
    signatureBoost: Number((Math.min(0.16, strength * 0.14)).toFixed(2)),
    genericRelief: Number((Math.min(0.14, strength * 0.12)).toFixed(2)),
    sourceConfidenceBoost: Number((Math.min(0.06, strength * 0.05)).toFixed(2)),
    notes,
  }
}
