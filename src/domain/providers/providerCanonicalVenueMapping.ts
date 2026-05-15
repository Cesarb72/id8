import type { LiveDataProvider } from '../types/sourceMode'
import type { Venue } from '../types/venue'
import type { ProviderVenue } from './providerTypes'
import { providerCanonicalVenueSeeds } from './providerCanonicalVenueSeeds'

export type ProviderCanonicalMatchMethod =
  | 'provider_id'
  | 'static_alias'
  | 'normalized_name_address'
  | 'manual_seed'
  | 'unresolved'

export interface ProviderCanonicalVenueMapping {
  provider: Extract<LiveDataProvider, 'google-places'>
  providerRecordId: string
  canonicalVenueId: string | null
  matchMethod: ProviderCanonicalMatchMethod
  confidence: number
  matchedAt?: number
}

function normalizeIdentityPart(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildNormalizedNameSignature(value: string | undefined): string {
  return normalizeIdentityPart(value)
    .split(' ')
    .filter((part) => part.length > 1)
    .join(' ')
}

function containsLoosePhrase(haystack: string | undefined, needle: string | undefined): boolean {
  const left = normalizeIdentityPart(haystack)
  const right = normalizeIdentityPart(needle)
  if (!left || !right) {
    return false
  }
  return left.includes(right) || right.includes(left)
}

function buildUnresolvedMapping(
  providerVenue: ProviderVenue,
): ProviderCanonicalVenueMapping {
  return {
    provider: 'google-places',
    providerRecordId: providerVenue.providerRecordId,
    canonicalVenueId: null,
    matchMethod: 'unresolved',
    confidence: 0,
  }
}

function resolveSeededCanonicalVenueId(params: {
  providerVenue: ProviderVenue
  staticVenues: Venue[]
  matchedAt?: number
}): ProviderCanonicalVenueMapping | undefined {
  const { matchedAt, providerVenue, staticVenues } = params
  const seed = providerCanonicalVenueSeeds.find(
    (entry) =>
      entry.provider === 'google-places' &&
      entry.providerRecordId === providerVenue.providerRecordId,
  )
  if (!seed) {
    return undefined
  }

  const seededVenue = staticVenues.find((venue) => venue.id === seed.canonicalVenueId)
  if (!seededVenue) {
    return buildUnresolvedMapping(providerVenue)
  }

  return {
    provider: seed.provider,
    providerRecordId: seed.providerRecordId,
    canonicalVenueId: seed.canonicalVenueId,
    matchMethod: seed.matchMethod,
    confidence: seed.confidence,
    matchedAt,
  }
}

export function buildProviderCanonicalVenueKey(params: {
  provider: Extract<LiveDataProvider, 'google-places'>
  providerRecordId: string
}): string {
  return `${params.provider}:${params.providerRecordId.trim()}`
}

export function isCanonicalVenueResolved(
  mapping: ProviderCanonicalVenueMapping,
): mapping is ProviderCanonicalVenueMapping & { canonicalVenueId: string } {
  return Boolean(mapping.canonicalVenueId) && mapping.matchMethod !== 'unresolved'
}

export interface StaticCanonicalPrecedenceResolution {
  applies: boolean
  canonicalVenueId?: string
  providerRecordId?: string
  matchMethod?: Extract<ProviderCanonicalMatchMethod, 'manual_seed' | 'provider_id'>
  precedenceReason?: 'static_canonical_precedence'
  collisionReason?: 'provider_identity_collision'
}

export function resolveStaticCanonicalPrecedence(params: {
  curatedVenue: Venue
  liveVenue: Venue
}): StaticCanonicalPrecedenceResolution {
  const { curatedVenue, liveVenue } = params
  if (curatedVenue.source.sourceOrigin !== 'curated' || liveVenue.source.sourceOrigin !== 'live') {
    return { applies: false }
  }

  const canonicalVenueId = curatedVenue.id.trim()
  const providerRecordId = liveVenue.source.providerRecordId?.trim()
  if (!canonicalVenueId || !providerRecordId) {
    return { applies: false }
  }

  if (
    curatedVenue.source.provider === 'google-places' &&
    curatedVenue.source.providerRecordId?.trim() === providerRecordId
  ) {
    return {
      applies: true,
      canonicalVenueId,
      providerRecordId,
      matchMethod: 'provider_id',
      precedenceReason: 'static_canonical_precedence',
      collisionReason: 'provider_identity_collision',
    }
  }

  const seededMatch = providerCanonicalVenueSeeds.find(
    (entry) =>
      entry.provider === 'google-places' &&
      entry.providerRecordId === providerRecordId &&
      entry.canonicalVenueId === canonicalVenueId,
  )

  if (!seededMatch) {
    return { applies: false }
  }

  return {
    applies: true,
    canonicalVenueId,
    providerRecordId,
    matchMethod: seededMatch.matchMethod,
    precedenceReason: 'static_canonical_precedence',
    collisionReason: 'provider_identity_collision',
  }
}

export function resolveCanonicalVenueIdForProviderVenue(params: {
  providerVenue: ProviderVenue
  staticVenues: Venue[]
  matchedAt?: number
}): ProviderCanonicalVenueMapping {
  const { providerVenue, staticVenues, matchedAt } = params

  const seededMatch = resolveSeededCanonicalVenueId({
    matchedAt,
    providerVenue,
    staticVenues,
  })
  if (seededMatch) {
    return seededMatch
  }

  const providerIdMatches = staticVenues.filter(
    (venue) =>
      venue.source.provider === 'google-places' &&
      venue.source.providerRecordId === providerVenue.providerRecordId,
  )
  if (providerIdMatches.length === 1) {
    return {
      provider: 'google-places',
      providerRecordId: providerVenue.providerRecordId,
      canonicalVenueId: providerIdMatches[0]!.id,
      matchMethod: 'provider_id',
      confidence: 1,
      matchedAt,
    }
  }
  if (providerIdMatches.length > 1) {
    return buildUnresolvedMapping(providerVenue)
  }

  const providerName = buildNormalizedNameSignature(providerVenue.displayName)
  if (!providerName) {
    return buildUnresolvedMapping(providerVenue)
  }

  const addressSignals = [
    providerVenue.formattedAddress,
    providerVenue.shortFormattedAddress,
  ].filter((value): value is string => Boolean(value?.trim()))

  const nameAndAddressMatches = staticVenues.filter((venue) => {
    const venueName = buildNormalizedNameSignature(venue.name)
    if (!venueName || venueName !== providerName) {
      return false
    }
    if (addressSignals.length === 0) {
      return false
    }
    const neighborhoodHit = addressSignals.some((address) =>
      containsLoosePhrase(address, venue.neighborhood),
    )
    const cityHit = addressSignals.some((address) => containsLoosePhrase(address, venue.city))
    return neighborhoodHit && cityHit
  })

  if (nameAndAddressMatches.length === 1) {
    return {
      provider: 'google-places',
      providerRecordId: providerVenue.providerRecordId,
      canonicalVenueId: nameAndAddressMatches[0]!.id,
      matchMethod: 'normalized_name_address',
      confidence: 0.84,
      matchedAt,
    }
  }

  return buildUnresolvedMapping(providerVenue)
}
