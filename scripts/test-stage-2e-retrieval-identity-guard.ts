import assert from 'node:assert/strict'

import {
  dedupeVenues,
  getAdmittedRouteVenueIdentity,
} from '../src/domain/retrieval/dedupeVenues'
import { mergeVenueSources } from '../src/domain/retrieval/mergeVenueSources'
import {
  mergeEvidenceBearingLiveCandidatesForRetrieval,
  resolveRequiredInventoryVenues,
} from '../src/domain/retrieval/retrieveVenues'
import type { Venue } from '../src/domain/types/venue'

function venue(input: {
  id: string
  name?: string
  sourceOrigin?: Venue['source']['sourceOrigin']
  providerRecordId?: string
  category?: Venue['category']
  city?: string
  neighborhood?: string
  driveMinutes?: number
  qualityScore?: number
  sourceConfidence?: number
}): Venue {
  return {
    id: input.id,
    name: input.name ?? 'Shared Name',
    city: input.city ?? 'San Jose',
    neighborhood: input.neighborhood ?? 'Downtown',
    driveMinutes: input.driveMinutes ?? 6,
    category: input.category ?? 'bar',
    subcategory: 'test fixture',
    priceTier: '$$',
    tags: ['cocktails'],
    useCases: ['date-night'],
    vibeTags: ['intimate'],
    energyLevel: 0.6,
    socialDensity: 0.5,
    uniquenessScore: 0.7,
    distinctivenessScore: 0.7,
    underexposureScore: 0.5,
    shareabilityScore: 0.6,
    isChain: false,
    localSignals: {
      localFavoriteScore: 0.7,
      neighborhoodPrideScore: 0.7,
      repeatVisitorScore: 0.6,
    },
    roleAffinity: {
      warmup: 0.7,
      peak: 0.8,
      wildcard: 0.4,
      cooldown: 0.6,
    },
    imageUrl: '',
    shortDescription: 'Offline Stage 2E identity fixture.',
    narrativeFlavor: 'Fixture only.',
    isHiddenGem: false,
    isActive: true,
    highlightCapable: true,
    durationProfile: {
      durationClass: 'medium',
      estimatedMinutes: 75,
    },
    settings: {
      groupFriendly: true,
      conversationFriendly: true,
      soloFriendly: true,
      goodForDates: true,
      familyFriendly: false,
      dogFriendly: false,
      outdoorSeating: false,
      reservationsRecommended: false,
    },
    signature: {
      signatureScore: 0.7,
      specificityScore: 0.7,
      genericScore: 0.1,
      textSignalCount: 4,
      uniqueTagCount: 3,
      highlightCapabilityTier: 'highlight-capable',
    },
    source: {
      normalizedFromRawType: 'raw-place',
      sourceOrigin: input.sourceOrigin ?? 'curated',
      provider: input.providerRecordId ? 'google-places' : undefined,
      providerRecordId: input.providerRecordId,
      formattedAddress: '100 Fixture St, San Jose, CA 95113',
      latitude: 37.335,
      longitude: -121.889,
      sourceConfidence: input.sourceConfidence ?? 0.8,
      completenessScore: 0.9,
      qualityScore: input.qualityScore ?? 0.8,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      businessStatus: 'OPERATIONAL',
      timeConfidence: 0.8,
      hoursPressureLevel: 'none',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: ['bar', 'point_of_interest', 'establishment'],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus: 'approved',
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: [],
    },
  }
}

function identitySnapshot(venues: Venue[]): Array<{
  id: string
  sourceOrigin: Venue['source']['sourceOrigin']
  providerRecordId: string | null
}> {
  return venues
    .map((item) => ({
      id: item.id,
      sourceOrigin: item.source.sourceOrigin,
      providerRecordId: item.source.providerRecordId ?? null,
    }))
    .sort((left, right) => `${left.id}:${left.sourceOrigin}`.localeCompare(`${right.id}:${right.sourceOrigin}`))
}

function assertSameCanonicalIdentityMerge(): void {
  const curated = venue({
    id: 'stage2e-shared-canonical',
    name: 'Static Shared Room',
    sourceOrigin: 'curated',
    qualityScore: 0.45,
  })
  const providerBacked = venue({
    id: 'stage2e-shared-canonical',
    name: 'Provider Shared Room',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-provider-shared',
    qualityScore: 0.99,
  })

  const merged = mergeVenueSources([curated], [providerBacked], 'hybrid')

  assert.equal(merged.venues.length, 1)
  assert.equal(merged.venues[0]?.id, 'stage2e-shared-canonical')
  assert.equal(getAdmittedRouteVenueIdentity(merged.venues[0]!), 'stage2e-shared-canonical')
  assert.equal(merged.dedupedCount, 1)
  assert.equal(merged.dedupeLosses[0]?.duplicateReason, 'same admitted canonical route identity')
  assert.notEqual(providerBacked.source.providerRecordId, merged.venues[0]?.id)
}

function assertDistinctCanonicalIdentitiesStaySeparate(): void {
  const left = venue({
    id: 'stage2e-distinct-a',
    name: 'Twin Lounge',
    sourceOrigin: 'curated',
    category: 'bar',
    driveMinutes: 5,
  })
  const right = venue({
    id: 'stage2e-distinct-b',
    name: 'Twin Lounge',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-provider-distinct-b',
    category: 'bar',
    driveMinutes: 6,
  })

  const merged = mergeVenueSources([left], [right], 'hybrid')

  assert.deepEqual(
    merged.venues.map((item) => item.id).sort(),
    ['stage2e-distinct-a', 'stage2e-distinct-b'],
  )
  assert.equal(merged.dedupedCount, 0)
}

function assertProviderProvenanceCannotBecomeRouteIdentity(): void {
  const providerOnly = venue({
    id: 'stage2e-provider-only-canonical',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-provider-provenance',
  })
  const liveGoogleHostile = venue({
    id: 'live_google_stage2e-hostile',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-hostile',
  })
  const providerRecordHostile = venue({
    id: 'stage2e-provider-record-hostile',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-provider-record-hostile',
  })

  const merged = mergeVenueSources([], [providerOnly, liveGoogleHostile, providerRecordHostile], 'live')
  assert.deepEqual(merged.venues.map((item) => item.id), ['stage2e-provider-only-canonical'])
  assert.equal(merged.venues[0]?.source.providerRecordId, 'stage2e-provider-provenance')
  assert.notEqual(merged.venues[0]?.id, merged.venues[0]?.source.providerRecordId)

  const retrievalMerged = mergeEvidenceBearingLiveCandidatesForRetrieval([], [
    providerOnly,
    liveGoogleHostile,
    providerRecordHostile,
  ])
  assert.deepEqual(retrievalMerged.map((item) => item.id), ['stage2e-provider-only-canonical'])
}

function assertRequiredInventoryUsesCanonicalIdentityOnly(): void {
  const admittedAvailable = venue({
    id: 'stage2e-required-canonical',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-required-provider',
  })
  const canonicalSeed = venue({
    id: 'stage2e-required-canonical',
    sourceOrigin: 'curated',
  })
  const providerRecordOnlySeed = venue({
    id: 'stage2e-unmatched-seed',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-required-provider',
  })
  const similarityOnlySeed = venue({
    id: 'stage2e-unmatched-similar',
    name: admittedAvailable.name,
    city: admittedAvailable.city,
    neighborhood: admittedAvailable.neighborhood,
    category: admittedAvailable.category,
    sourceOrigin: 'curated',
  })

  assert.deepEqual(
    resolveRequiredInventoryVenues([admittedAvailable], [canonicalSeed], []).map((item) => item.id),
    ['stage2e-required-canonical'],
  )
  assert.deepEqual(
    resolveRequiredInventoryVenues([admittedAvailable], [providerRecordOnlySeed], []),
    [],
  )
  assert.deepEqual(
    resolveRequiredInventoryVenues([admittedAvailable], [similarityOnlySeed], []),
    [],
  )
}

function assertSourceOrderDeterminism(): void {
  const curated = venue({
    id: 'stage2e-order-canonical',
    sourceOrigin: 'curated',
    qualityScore: 0.1,
  })
  const providerBacked = venue({
    id: 'stage2e-order-canonical',
    sourceOrigin: 'live',
    providerRecordId: 'stage2e-order-provider',
    qualityScore: 0.99,
  })
  const first = dedupeVenues([curated, providerBacked])
  const reversed = dedupeVenues([providerBacked, curated])

  assert.deepEqual(identitySnapshot(first.venues), identitySnapshot(reversed.venues))
  assert.deepEqual(first.losses.map((loss) => loss.keptVenueId), reversed.losses.map((loss) => loss.keptVenueId))
  assert.equal(first.venues[0]?.id, 'stage2e-order-canonical')
  assert.equal(first.venues[0]?.source.sourceOrigin, 'curated')
}

assertSameCanonicalIdentityMerge()
assertDistinctCanonicalIdentitiesStaySeparate()
assertProviderProvenanceCannotBecomeRouteIdentity()
assertRequiredInventoryUsesCanonicalIdentityOnly()
assertSourceOrderDeterminism()

console.log('stage 2E-1 retrieval identity guard: PASS')
console.log('provider calls consumed: 0')
