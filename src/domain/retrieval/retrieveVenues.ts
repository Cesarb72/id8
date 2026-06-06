import { applyLensToVenue, type LensShapedVenue } from './applyLensToVenue'
import {
  classifyProviderAuthority,
  getFieldAuthorityTargets,
  resolveAllowCuratedFallback,
  resolveDefaultCityFallback,
  resolveFieldGovernancePolicy,
  sanitizeCityKey,
} from './fieldPolicy'
import { fetchHybridPortableVenues } from './hybridPortableAdapter'
import { mergeVenueSources } from './mergeVenueSources'
import { buildLiveTrustBreakdown } from '../debug/buildLiveTrustBreakdown'
import { deriveVenueHappeningsSignals } from '../normalize/deriveVenueHappeningsSignals'
import {
  BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES,
  isOutsideStrictNearbyButWithinBoundedStretch,
  isWithinStrictNearbyWindow,
} from '../constraints/localStretchPolicy'
import { fetchLivePlaces } from '../sources/fetchLivePlaces'
import { isDevOrSandboxCloseoutFlow } from '../sources/getSourceMode'
import { resolveDessertConversationProviderProof } from '../providers/providerProofGate'
import type { LiveDedupeLossDiagnostics } from '../types/diagnostics'
import type { LiveTrustBreakdownDiagnostics } from '../types/diagnostics'
import type { FallbackRelaxationLevel } from '../types/diagnostics'
import type { ExperienceLens } from '../types/experienceLens'
import { curatedVenues as baseCuratedVenues } from '../../data/venues'
import {
  devGreatStopFixtureVenueIds,
  normalizeDevGreatStopFixtures,
  readDevGreatStopFixturesEnvRaw,
  readDevGreatStopFixturesEnabled,
} from '../sources/devGreatStopFixtures'
import type { IntentProfile } from '../types/intent'
import type { ExcludedVenueDiagnostics } from '../types/normalization'
import type {
  FieldFallbackSource,
  FieldGovernanceRuntimeMode,
  FieldInventoryTruth,
  ProviderAuthorityClass,
  SourceMode,
} from '../types/sourceMode'
import type { StarterPack } from '../types/starterPack'
import type { Venue } from '../types/venue'

function sanitize(value: string): string {
  return value.trim().toLowerCase()
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeCity(value: string): string {
  return sanitizeCityKey(value)
}

function hasCuratedCityCoverage(venues: Venue[], cityQuery: string): boolean {
  if (!cityQuery) {
    return false
  }
  const count = venues.filter((venue) => sanitizeCity(venue.city) === cityQuery).length
  return count >= 10
}

function ensureVenueHasHappenings(venue: Venue): Venue {
  if (venue.source.happenings) {
    return venue
  }
  return {
    ...venue,
    source: {
      ...venue.source,
      happenings: deriveVenueHappeningsSignals(venue),
    },
  }
}

interface RetrieveVenuesOptions {
  seedVenues?: Venue[]
  requestedSourceMode?: SourceMode
  sourceModeOverrideApplied?: boolean
  starterPack?: StarterPack
}

type ProviderAuthoritySummary = Partial<Record<ProviderAuthorityClass, number>>

export interface RetrieveVenuesResult {
  venues: Venue[]
  totalVenueCount: number
  lensCompatibleCount: number
  excludedByQualityGate: ExcludedVenueDiagnostics[]
  fallbackRelaxationApplied: FallbackRelaxationLevel
  sourceMode: {
    requestedMode: SourceMode
    effectiveMode: SourceMode
    debugOverrideApplied: boolean
    fallbackToCurated: boolean
    liveFetchAttempted: boolean
    liveFetchSucceeded: boolean
    provider?: 'google-places'
    failureReason?: string
    queryLocationLabel?: string
    queryCentersCount?: number
    queryCentersUsed?: Array<{ id: string; lat: number; lng: number }>
    queryRadiusM?: number
    queryCount: number
    liveQueryTemplatesUsed: string[]
    liveQueryLabelsUsed: string[]
    liveCandidatesByQuery: Array<{
      label: string
      template: string
      roleHint: string
      fetchedCount: number
      mappedCount: number
      normalizedCount: number
      approvedCount: number
      demotedCount: number
      suppressedCount: number
    }>
    liveRoleIntentQueryNotes: string[]
    fetchedCount: number
    rawFetchedCount: number
    mappedCount: number
    mappedDroppedCount: number
    mappedDropReasons: Record<string, number>
    normalizedCount: number
    dedupedByPlaceIdCount?: number
    normalizationDroppedCount: number
    normalizationDropReasons: Record<string, number>
    acceptedCount: number
    acceptanceDroppedCount: number
    acceptanceDropReasons: Record<string, number>
    approvedCount: number
    demotedCount: number
    suppressedCount: number
    liveHoursDemotedCount: number
    liveHoursSuppressedCount: number
    partialFailure: boolean
    errors: string[]
    countsBySource: {
      curated: number
      live: number
    }
    dedupedCount: number
    dedupedLiveCount: number
    liveDedupedAgainstCuratedCount: number
    liveNoveltyCollapsedCount: number
    dedupeLosses: LiveDedupeLossDiagnostics[]
    liveTrustBreakdown: LiveTrustBreakdownDiagnostics
    hybridAdapterUsed?: boolean
    hybridAdapterMode?: string
    hybridAdapterNotes?: string[]
    hybridAdapterCount?: number
    devGreatStopFixturesEnvRaw: string
    devGreatStopFixturesEnabled: boolean
    devGreatStopFixtureCount: number
    devGreatStopFixtureVenueIds: string[]
    runtimeMode?: FieldGovernanceRuntimeMode
    liveUsableInventory?: boolean
    fallbackUsed?: boolean
    fallbackReason?: string
    fallbackSources?: FieldFallbackSource[]
    inventoryTruth?: FieldInventoryTruth
    liveFailureVisible?: boolean
    fixtureInjectionUsed?: boolean
    bootstrapInjectionUsed?: boolean
    defaultCityFallbackUsed?: boolean
    providerAuthoritySummary?: ProviderAuthoritySummary
  }
  stageCounts: {
    totalSeed: number
    active: number
    qualityApproved: number
    qualityDemoted: number
    qualitySuppressed: number
    curatedSeed: number
    liveFetched: number
    liveMapped: number
    liveNormalized: number
    liveApproved: number
    liveDemoted: number
    liveSuppressed: number
    liveHoursDemoted: number
    liveHoursSuppressed: number
    cityMatch: number
    geographyMatch: number
    lensStrict: number
    lensSoft: number
    finalRetrieved: number
    neighborhoodPreferred: number
    dedupedMerged: number
    dedupedLive: number
    finalCurated: number
    finalLive: number
  }
}

function buildExcludedDiagnostics(venues: Venue[]): ExcludedVenueDiagnostics[] {
  return venues.map((venue) => ({
    venueId: venue.id,
    venueName: venue.name,
    sourceOrigin: venue.source.sourceOrigin,
    provider: venue.source.provider,
    qualityGateStatus: venue.source.qualityGateStatus,
    sourceConfidence: Number((venue.source.sourceConfidence * 100).toFixed(1)),
    completenessScore: Number((venue.source.completenessScore * 100).toFixed(1)),
    normalizedCategory: venue.category,
    reasons: venue.source.suppressionReasons,
  }))
}

function countBySource(venues: Venue[]): { curated: number; live: number } {
  return venues.reduce(
    (acc, venue) => {
      acc[venue.source.sourceOrigin] += 1
      return acc
    },
    { curated: 0, live: 0 },
  )
}

function resolveRequiredInventoryVenues(
  availableVenues: Venue[],
  seedVenues: Venue[] | undefined,
  dedupeLosses: LiveDedupeLossDiagnostics[],
): Venue[] {
  if (!seedVenues || seedVenues.length === 0) {
    return []
  }

  const venueById = new Map(availableVenues.map((venue) => [venue.id, venue] as const))

  return seedVenues
    .map((seedVenue) => {
      const exactMatch = venueById.get(seedVenue.id)
      if (exactMatch) {
        return exactMatch
      }

      const dedupeResolvedVenueId = dedupeLosses.find(
        (loss) => loss.removedVenueId === seedVenue.id,
      )?.keptVenueId
      if (dedupeResolvedVenueId) {
        const dedupeResolvedVenue = venueById.get(dedupeResolvedVenueId)
        if (dedupeResolvedVenue) {
          return dedupeResolvedVenue
        }
      }

      return availableVenues.find((venue) => {
        if (
          seedVenue.source.providerRecordId &&
          venue.source.providerRecordId === seedVenue.source.providerRecordId
        ) {
          return true
        }

        return (
          venue.category === seedVenue.category &&
          sanitize(venue.name) === sanitize(seedVenue.name) &&
          sanitize(venue.city) === sanitize(seedVenue.city) &&
          sanitize(venue.neighborhood) === sanitize(seedVenue.neighborhood)
        )
      })
    })
    .filter((venue): venue is Venue => Boolean(venue))
    .filter(
      (venue, index, collection) =>
        collection.findIndex((candidate) => candidate.id === venue.id) === index,
    )
}

function mergeRequiredVenues(primaryVenues: Venue[], requiredVenues: Venue[]): Venue[] {
  if (requiredVenues.length === 0) {
    return primaryVenues
  }

  const merged: Venue[] = [...requiredVenues]
  const seenIds = new Set(requiredVenues.map((venue) => venue.id))

  for (const venue of primaryVenues) {
    if (seenIds.has(venue.id)) {
      continue
    }
    merged.push(venue)
    seenIds.add(venue.id)
  }

  return merged
}

function isFoodDrinkCategory(category: Venue['category']): boolean {
  return (
    category === 'restaurant' ||
    category === 'bar' ||
    category === 'cafe' ||
    category === 'dessert'
  )
}

function collectCategoryLikeTokens(venue: Venue): Set<string> {
  const normalized = `${venue.subcategory} ${venue.tags.join(' ')} ${venue.source.sourceTypes.join(' ')}`.toLowerCase()
  return new Set(
    normalized
      .split(/[\s,./()_-]+/)
      .map((token) => token.trim())
      .filter(Boolean),
  )
}

function isCulturalOpportunity(venue: Venue): boolean {
  const tokens = collectCategoryLikeTokens(venue)
  return (
    venue.category === 'museum' ||
    tokens.has('gallery') ||
    tokens.has('theatre') ||
    tokens.has('theater') ||
    tokens.has('opera') ||
    tokens.has('historic') ||
    tokens.has('cultural')
  )
}

function isCommunityOpportunity(venue: Venue): boolean {
  const tokens = collectCategoryLikeTokens(venue)
  return (
    venue.category === 'event' ||
    tokens.has('market') ||
    tokens.has('night') ||
    tokens.has('community') ||
    tokens.has('festival') ||
    tokens.has('vendor')
  )
}

function isAtmosphericOpportunity(venue: Venue): boolean {
  const tokens = collectCategoryLikeTokens(venue)
  return (
    venue.category === 'park' ||
    tokens.has('garden') ||
    tokens.has('trail') ||
    tokens.has('scenic') ||
    tokens.has('walk')
  )
}

function isPerformanceOpportunity(venue: Venue): boolean {
  return (
    venue.category === 'live_music' ||
    venue.settings.musicCapable ||
    venue.settings.performanceCapable
  )
}

function isStrictPerformanceClass(venue: Venue): boolean {
  return venue.category === 'live_music'
}

function isStrictCulturalClass(venue: Venue): boolean {
  const tokens = collectCategoryLikeTokens(venue)
  return (
    venue.category === 'museum' ||
    tokens.has('gallery') ||
    tokens.has('theatre') ||
    tokens.has('theater') ||
    tokens.has('opera')
  )
}

function isStrictCommunityClass(venue: Venue): boolean {
  const tokens = collectCategoryLikeTokens(venue)
  return (
    venue.category === 'event' ||
    tokens.has('market') ||
    tokens.has('night-market') ||
    tokens.has('nightmarket') ||
    tokens.has('festival')
  )
}

function isStrictAtmosphericClass(venue: Venue): boolean {
  const tokens = collectCategoryLikeTokens(venue)
  return (
    venue.category === 'park' ||
    tokens.has('garden') ||
    tokens.has('trail') ||
    tokens.has('scenic')
  )
}

function isMajorVenueOpportunity(venue: Venue): boolean {
  const signals = deriveVenueHappeningsSignals(venue)
  return signals.majorVenueStrength >= 0.52 || signals.culturalAnchorPotential >= 0.64
}

function hasHappeningsBreadth(venue: Venue): boolean {
  return (
    isCulturalOpportunity(venue) ||
    isCommunityOpportunity(venue) ||
    isAtmosphericOpportunity(venue) ||
    isPerformanceOpportunity(venue) ||
    isMajorVenueOpportunity(venue)
  )
}

function scoreHappeningsRecovery(venue: Venue, lensCompatibility: number): number {
  const signals = deriveVenueHappeningsSignals(venue)
  const breadthBoost = hasHappeningsBreadth(venue) ? 0.1 : 0
  return (
    lensCompatibility * 0.45 +
    signals.culturalAnchorPotential * 0.15 +
    signals.eventPotential * 0.12 +
    signals.performancePotential * 0.1 +
    signals.hotspotStrength * 0.08 +
    signals.currentRelevance * 0.06 +
    signals.majorVenueStrength * 0.04 +
    breadthBoost
  )
}

function ensureHappeningsPreservation(
  shapedCandidates: LensShapedVenue[],
  filteredByLens: LensShapedVenue[],
  compatibilityThreshold: number,
): LensShapedVenue[] {
  if (shapedCandidates.length === 0 || filteredByLens.length === 0) {
    return filteredByLens
  }

  const existingIds = new Set(filteredByLens.map((candidate) => candidate.venue.id))
  const currentlyBroad = filteredByLens.filter((candidate) => hasHappeningsBreadth(candidate.venue))
  const targetBroadCount = Math.min(
    8,
    Math.max(4, Math.ceil(filteredByLens.length * 0.24)),
  )

  const minCompatibility = Math.max(0.18, compatibilityThreshold - 0.22)
  const supplemental = shapedCandidates
    .filter((candidate) => !existingIds.has(candidate.venue.id))
    .filter((candidate) => candidate.lensCompatibility >= minCompatibility)
    .filter((candidate) => hasHappeningsBreadth(candidate.venue))
    .map((candidate) => ({
      ...candidate,
      recoveryScore: scoreHappeningsRecovery(candidate.venue, candidate.lensCompatibility),
    }))
    .filter((candidate) => candidate.recoveryScore >= 0.5)
    .sort(
      (left, right) =>
        right.recoveryScore - left.recoveryScore ||
        right.lensCompatibility - left.lensCompatibility ||
        left.venue.name.localeCompare(right.venue.name),
    )

  const selectedSupplemental: LensShapedVenue[] = []
  const requiredSegments = [
    (venue: Venue) => isStrictPerformanceClass(venue),
    (venue: Venue) => isStrictCulturalClass(venue),
    (venue: Venue) => isStrictCommunityClass(venue),
    (venue: Venue) => isStrictAtmosphericClass(venue),
  ]

  for (const segmentCheck of requiredSegments) {
    const segmentExists =
      currentlyBroad.some((candidate) => segmentCheck(candidate.venue)) ||
      selectedSupplemental.some((candidate) => segmentCheck(candidate.venue))
    if (segmentExists) {
      continue
    }
    const strictSegmentCandidate = shapedCandidates
      .filter((candidate) => !existingIds.has(candidate.venue.id))
      .filter(
        (candidate) =>
          !selectedSupplemental.some((selected) => selected.venue.id === candidate.venue.id),
      )
      .filter((candidate) => candidate.lensCompatibility >= Math.max(0.12, minCompatibility - 0.1))
      .filter((candidate) => segmentCheck(candidate.venue))
      .map((candidate) => ({
        ...candidate,
        recoveryScore: scoreHappeningsRecovery(candidate.venue, candidate.lensCompatibility),
      }))
      .sort(
        (left, right) =>
          right.recoveryScore - left.recoveryScore ||
          right.lensCompatibility - left.lensCompatibility ||
          left.venue.name.localeCompare(right.venue.name),
      )[0]

    const nextSegmentCandidate =
      strictSegmentCandidate ??
      supplemental.find(
      (candidate) =>
        !selectedSupplemental.some((selected) => selected.venue.id === candidate.venue.id) &&
        segmentCheck(candidate.venue),
    )
    if (nextSegmentCandidate) {
      selectedSupplemental.push(nextSegmentCandidate)
    }
  }

  for (const candidate of supplemental) {
    if (selectedSupplemental.some((selected) => selected.venue.id === candidate.venue.id)) {
      continue
    }
    const projectedBroadCount =
      currentlyBroad.length +
      selectedSupplemental.filter((selected) => hasHappeningsBreadth(selected.venue)).length
    if (projectedBroadCount >= targetBroadCount) {
      break
    }
    if (selectedSupplemental.length >= 6) {
      break
    }
    selectedSupplemental.push(candidate)
  }

  if (selectedSupplemental.length === 0) {
    return filteredByLens
  }

  const merged = [...filteredByLens, ...selectedSupplemental]
  merged.sort(
    (left, right) => right.lensCompatibility - left.lensCompatibility || left.venue.name.localeCompare(right.venue.name),
  )

  const nonFoodBroad = merged.filter(
    (candidate) => hasHappeningsBreadth(candidate.venue) && !isFoodDrinkCategory(candidate.venue.category),
  )
  const baselineNonFoodBroad = filteredByLens.filter(
    (candidate) => hasHappeningsBreadth(candidate.venue) && !isFoodDrinkCategory(candidate.venue.category),
  )

  if (nonFoodBroad.length <= baselineNonFoodBroad.length) {
    return filteredByLens
  }

  return merged
}

function matchesAuthorityName(venueName: string, targetName: string): boolean {
  const normalizedVenueName = sanitizeToken(venueName)
  const normalizedTargetName = sanitizeToken(targetName)
  if (!normalizedVenueName || !normalizedTargetName) {
    return false
  }
  return (
    normalizedVenueName.includes(normalizedTargetName) ||
    normalizedTargetName.includes(normalizedVenueName)
  )
}

function collectAuthorityTargets(intent: IntentProfile): string[] {
  // Field boundary: authority rescue targets are city policy, not inline retrieval logic.
  return getFieldAuthorityTargets(sanitizeCity(intent.city))
}

function ensureAuthorityPreservation(
  shapedCandidates: LensShapedVenue[],
  filteredByLens: LensShapedVenue[],
  intent: IntentProfile,
  compatibilityThreshold: number,
): LensShapedVenue[] {
  if (shapedCandidates.length === 0 || filteredByLens.length === 0) {
    return filteredByLens
  }

  const authorityTargets = collectAuthorityTargets(intent)
  if (authorityTargets.length === 0) {
    return filteredByLens
  }

  const existingIds = new Set(filteredByLens.map((candidate) => candidate.venue.id))
  const minCompatibility = Math.max(0.16, compatibilityThreshold - 0.26)
  const targetPriority = new Map(
    authorityTargets.map((target, index) => [sanitizeToken(target), authorityTargets.length - index] as const),
  )

  const supplemental = shapedCandidates
    .filter((candidate) => !existingIds.has(candidate.venue.id))
    .filter((candidate) => candidate.lensCompatibility >= minCompatibility)
    .filter((candidate) =>
      authorityTargets.some((target) => matchesAuthorityName(candidate.venue.name, target)),
    )
    .map((candidate) => {
      const matchedPriority = authorityTargets.reduce((best, target) => {
        if (!matchesAuthorityName(candidate.venue.name, target)) {
          return best
        }
        return Math.max(best, targetPriority.get(sanitizeToken(target)) ?? 0)
      }, 0)
      return {
        candidate,
        matchedPriority,
      }
    })
    .sort(
      (left, right) =>
        right.matchedPriority - left.matchedPriority ||
        right.candidate.lensCompatibility - left.candidate.lensCompatibility ||
        left.candidate.venue.name.localeCompare(right.candidate.venue.name),
    )
    .slice(0, 8)
    .map((entry) => entry.candidate)

  if (supplemental.length === 0) {
    return filteredByLens
  }

  const merged = [...filteredByLens, ...supplemental]
  merged.sort(
    (left, right) =>
      right.lensCompatibility - left.lensCompatibility ||
      left.venue.name.localeCompare(right.venue.name),
  )
  return merged
}

export async function retrieveVenues(
  intent: IntentProfile,
  lens: ExperienceLens,
  options: RetrieveVenuesOptions = {},
): Promise<RetrieveVenuesResult> {
  const governancePolicy = resolveFieldGovernancePolicy()
  const devGreatStopFixturesEnvRaw = readDevGreatStopFixturesEnvRaw()
  const devGreatStopFixturesEnabled = readDevGreatStopFixturesEnabled()
  const devGreatStopFixtureVenues = devGreatStopFixturesEnabled ? normalizeDevGreatStopFixtures() : []
  const fixtureInjectionUsed =
    governancePolicy.allowFixtureInjection && devGreatStopFixtureVenues.length > 0
  const curatedFixtureVenues = governancePolicy.allowFixtureInjection
    ? devGreatStopFixtureVenues
    : []
  const curatedVenues = (
    options.seedVenues
      ? [...options.seedVenues, ...curatedFixtureVenues, ...baseCuratedVenues]
      : [...curatedFixtureVenues, ...baseCuratedVenues]
  ).map(ensureVenueHasHappenings)
  const cityQuery = sanitizeCity(intent.city)
  const requestedSourceMode = isDevOrSandboxCloseoutFlow()
    ? 'curated'
    : options.requestedSourceMode ?? 'curated'
  const providerProof = resolveDessertConversationProviderProof({
    mode: intent.mode,
    requestedSourceMode,
    starterPack: options.starterPack,
  })
  const retrievalSourceMode: SourceMode = providerProof.allowed
    ? providerProof.effectiveSourceMode
    : 'curated'
  const curatedCoverageForCity = hasCuratedCityCoverage(curatedVenues, cityQuery)
  const normalizedNeighborhood = intent.neighborhood
    ? sanitize(intent.neighborhood)
    : undefined
  const maxDriveMinutes =
    intent.distanceMode === 'nearby' ? BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES : 28

  const liveFetch =
    retrievalSourceMode === 'curated'
      ? {
          venues: [] as Venue[],
          diagnostics: {
            attempted: false,
            provider: 'google-places' as const,
            queryLocationLabel: intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city,
            queryCentersCount: 0,
            queryCentersUsed: [] as Array<{ id: string; lat: number; lng: number }>,
            queryRadiusM: 0,
            requestedKinds: ['restaurant', 'bar', 'cafe'] as const,
            queryCount: 0,
            liveQueryTemplatesUsed: [] as string[],
            liveQueryLabelsUsed: [] as string[],
            liveCandidatesByQuery: [] as Array<{
              label: string
              template: string
              roleHint: string
              fetchedCount: number
              mappedCount: number
              normalizedCount: number
              approvedCount: number
              demotedCount: number
              suppressedCount: number
            }>,
            liveRoleIntentQueryNotes: [] as string[],
            fetchedCount: 0,
            rawFetchedCount: 0,
            mappedCount: 0,
            mappedDroppedCount: 0,
            mappedDropReasons: {},
            normalizedCount: 0,
            dedupedByPlaceIdCount: 0,
            normalizationDroppedCount: 0,
            normalizationDropReasons: {},
            acceptedCount: 0,
            acceptanceDroppedCount: 0,
            acceptanceDropReasons: {},
            approvedCount: 0,
            demotedCount: 0,
            suppressedCount: 0,
            usableCount: 0,
            partialFailure: false,
            success: false,
            failureReason: undefined,
            failureCategory: undefined,
            errors: [] as string[],
          },
        }
      : await fetchLivePlaces(intent, options.starterPack, {
          liveQueryLabels: providerProof.liveQueryLabels,
          maxQueryCenters: providerProof.maxQueryCenters,
          sourceMode: retrievalSourceMode,
        })

  const hybridPortable =
    retrievalSourceMode !== 'curated' && cityQuery.length > 0 && !curatedCoverageForCity
      ? await fetchHybridPortableVenues(intent.city)
      : undefined
  const hybridPortableVenues = hybridPortable?.venues ?? []
  const bootstrapPortableVenues = hybridPortableVenues.filter(
    (venue) => venue.source.curatedSubtype === 'bootstrap-portable',
  )
  const bootstrapInjectionUsed = bootstrapPortableVenues.length > 0
  const governanceBlockedBootstrap =
    governancePolicy.runtimeMode === 'api_governed' && !governancePolicy.allowBootstrapFallback
  const effectiveLiveVenues = [
    ...liveFetch.venues,
    ...(!governanceBlockedBootstrap ? hybridPortableVenues : []),
  ].filter(
    (venue, index, collection) =>
      collection.findIndex((candidate) => candidate.id === venue.id) === index,
  ).map(ensureVenueHasHappenings)

  const mergedRequested = mergeVenueSources(curatedVenues, effectiveLiveVenues, retrievalSourceMode)
  const liveTrustBreakdown = buildLiveTrustBreakdown(effectiveLiveVenues, mergedRequested.dedupeLosses)
  const liveHoursDemotedCount = effectiveLiveVenues.filter((venue) => venue.source.hoursDemotionApplied).length
  const liveHoursSuppressedCount = effectiveLiveVenues.filter((venue) => venue.source.hoursSuppressionApplied).length
  const effectiveLiveApprovedCount = effectiveLiveVenues.filter(
    (venue) => venue.source.qualityGateStatus === 'approved',
  ).length
  const effectiveLiveDemotedCount = effectiveLiveVenues.filter(
    (venue) => venue.source.qualityGateStatus === 'demoted',
  ).length
  const effectiveLiveSuppressedCount = effectiveLiveVenues.filter(
    (venue) => venue.source.qualityGateStatus === 'suppressed',
  ).length
  const effectiveLiveUsableCount = effectiveLiveVenues.filter(
    (venue) =>
      venue.source.sourceOrigin === 'live' && venue.source.qualityGateStatus !== 'suppressed',
  ).length
  const liveUsableInventory = effectiveLiveUsableCount > 0
  const hasEffectiveLiveCoverage = liveFetch.diagnostics.success || effectiveLiveVenues.length > 0
  const allowCuratedFallbackForCity = resolveAllowCuratedFallback({
    cityQuery,
    curatedCoverageForCity,
  })
  const shouldFallbackToCuratedByAvailability =
    retrievalSourceMode !== 'curated' &&
    allowCuratedFallbackForCity &&
    (!hasEffectiveLiveCoverage ||
      mergedRequested.countsBySource.live === 0 ||
      (retrievalSourceMode === 'live' && mergedRequested.venues.length < 10))
  const shouldFallbackToCurated =
    shouldFallbackToCuratedByAvailability &&
    (governancePolicy.runtimeMode !== 'api_governed' || governancePolicy.allowCuratedFallback)

  const mergedPool = mergeVenueSources(
    curatedVenues,
    effectiveLiveVenues,
    shouldFallbackToCurated ? 'curated' : retrievalSourceMode,
  )
  const requiredInventoryVenues = resolveRequiredInventoryVenues(
    mergedPool.venues,
    options.seedVenues,
    mergedRequested.dedupeLosses,
  )
  const activeVenues = mergedPool.venues.filter((venue) => venue.isActive)
  const qualityApproved = activeVenues.filter((venue) => venue.source.qualityGateStatus === 'approved')
  const qualityDemoted = activeVenues.filter((venue) => venue.source.qualityGateStatus === 'demoted')
  const qualitySuppressed = activeVenues.filter((venue) => venue.source.qualityGateStatus === 'suppressed')
  const qualityEligibleVenues = activeVenues.filter(
    (venue) => venue.source.qualityGateStatus !== 'suppressed',
  )
  const excludedByQualityGate = buildExcludedDiagnostics(qualitySuppressed)

  const blockedFallbackSources = new Set<FieldFallbackSource>()
  if (shouldFallbackToCuratedByAvailability && !shouldFallbackToCurated) {
    blockedFallbackSources.add('curated')
  }
  if (bootstrapInjectionUsed && governanceBlockedBootstrap) {
    blockedFallbackSources.add('bootstrap')
  }
  if (
    governancePolicy.runtimeMode === 'api_governed' &&
    devGreatStopFixtureVenues.length > 0 &&
    !governancePolicy.allowFixtureInjection
  ) {
    blockedFallbackSources.add('fixture')
  }

  const cityMatches = qualityEligibleVenues.filter(
    (venue) =>
      sanitizeCity(venue.city) === cityQuery &&
      venue.driveMinutes <= maxDriveMinutes,
  )
  const defaultFallbackCity = resolveDefaultCityFallback({
    cityQuery,
    shouldFallbackToCurated,
    retrievalSourceMode,
    allowDefaultCityFallback: governancePolicy.allowDefaultCityFallback,
  })
  const governanceBlockedDefaultCityFallback =
    governancePolicy.runtimeMode === 'api_governed' &&
    !governancePolicy.allowDefaultCityFallback &&
    cityMatches.length === 0 &&
    qualityEligibleVenues.some(
      (venue) =>
        sanitizeCity(venue.city) !== cityQuery &&
        venue.driveMinutes <= maxDriveMinutes,
    )
  if (governanceBlockedDefaultCityFallback) {
    blockedFallbackSources.add('default_city')
  }
  const defaultCityFallbackUsed = cityMatches.length === 0 && Boolean(defaultFallbackCity)
  const fallbackMatches =
    cityMatches.length > 0
      ? cityMatches
      : defaultFallbackCity
        ? qualityEligibleVenues.filter(
            (venue) =>
              sanitizeCity(venue.city) === defaultFallbackCity &&
              venue.driveMinutes <= maxDriveMinutes,
          )
        : []
  const shouldFailClosedForLiveInventory =
    governancePolicy.runtimeMode === 'api_governed' &&
    governancePolicy.failClosedOnLiveInventoryFailure &&
    (retrievalSourceMode === 'live' || retrievalSourceMode === 'hybrid') &&
    !liveUsableInventory &&
    blockedFallbackSources.size > 0

  const shapedCandidates = fallbackMatches
    .map((venue) => applyLensToVenue(venue, intent, lens))
    .sort((left, right) => right.lensCompatibility - left.lensCompatibility)

  const compatibilityThreshold =
    lens.discoveryBias === 'high' ? 0.36 : lens.tone === 'refined' ? 0.44 : 0.41

  let fallbackRelaxationApplied: FallbackRelaxationLevel = 'none'
  let filteredByLens = shapedCandidates.filter(
    (candidate) => candidate.lensCompatibility >= compatibilityThreshold,
  )
  const lensStrictCount = filteredByLens.length
  const lensSoftCount = shapedCandidates.filter(
    (candidate) => candidate.lensCompatibility >= 0.3,
  ).length
  if (filteredByLens.length < 10) {
    filteredByLens = shapedCandidates.filter((candidate) => candidate.lensCompatibility >= 0.3)
    fallbackRelaxationApplied = 'lens-soft'
  }
  if (filteredByLens.length < 8) {
    filteredByLens = shapedCandidates
    fallbackRelaxationApplied = 'lens-off'
  }

  const authorityPreservedCandidates = ensureAuthorityPreservation(
    shapedCandidates,
    filteredByLens,
    intent,
    compatibilityThreshold,
  )
  const happeningsPreservedCandidates = ensureHappeningsPreservation(
    shapedCandidates,
    authorityPreservedCandidates,
    compatibilityThreshold,
  )
  const lensShapedVenues = happeningsPreservedCandidates.map((candidate) => candidate.venue)
  const localFirstLensShapedVenues =
    intent.distanceMode === 'nearby'
      ? [
          ...lensShapedVenues.filter((venue) =>
            isWithinStrictNearbyWindow(venue.driveMinutes, intent.distanceMode),
          ),
          ...lensShapedVenues
            .filter((venue) =>
              isOutsideStrictNearbyButWithinBoundedStretch(
                venue.driveMinutes,
                intent.distanceMode,
              ),
            )
            .slice(0, 6),
        ]
      : lensShapedVenues
  const buildResult = (venues: Venue[], neighborhoodPreferred: number): RetrieveVenuesResult => {
    const finalCountsBySource = countBySource(venues)
    const providerAuthoritySummary = countByProviderAuthority(venues)
    const blockedFallbackList = [...blockedFallbackSources]
    const finalBootstrapUsed = venues.some(
      (venue) => venue.source.curatedSubtype === 'bootstrap-portable',
    )
    const fallbackUsed = shouldFailClosedForLiveInventory
      ? false
      : shouldFallbackToCurated || finalBootstrapUsed || defaultCityFallbackUsed || fixtureInjectionUsed
    const liveFailureVisible =
      (retrievalSourceMode === 'live' || retrievalSourceMode === 'hybrid') &&
      (liveFetch.diagnostics.attempted || Boolean(liveFetch.diagnostics.failureReason)) &&
      !liveUsableInventory
    let fallbackReason = liveFetch.diagnostics.failureReason
    if (shouldFailClosedForLiveInventory) {
      fallbackReason = `Governance blocked fallback masking after live inventory failure: ${blockedFallbackList.join(', ')}.`
    } else if (shouldFallbackToCurated && retrievalSourceMode === 'live' && mergedRequested.venues.length < 10) {
      fallbackReason = 'Live-only inventory was too thin for safe plan generation, so curated fallback was used.'
    } else if (defaultCityFallbackUsed) {
      fallbackReason = `Default-city fallback used ${defaultFallbackCity ?? 'the fallback city'} because no exact city matches survived.`
    } else if (finalBootstrapUsed && hybridPortable?.diagnostics.bootstrapRequired) {
      fallbackReason = 'Portable bootstrap supplied coverage because live inventory was unavailable or too thin.'
    }
    let inventoryTruth: FieldInventoryTruth = 'curated_only'
    if (shouldFailClosedForLiveInventory) {
      inventoryTruth = 'live_failed_empty'
    } else if (finalCountsBySource.live > 0 && finalBootstrapUsed) {
      inventoryTruth = 'hybrid_live_bootstrap'
    } else if (finalCountsBySource.live > 0) {
      inventoryTruth = 'real_live'
    } else if (fallbackUsed && retrievalSourceMode !== 'curated') {
      inventoryTruth = 'fallback_filled'
    }
    const result: RetrieveVenuesResult = {
      venues,
      totalVenueCount: mergedPool.venues.length,
      lensCompatibleCount: happeningsPreservedCandidates.length,
      excludedByQualityGate,
      fallbackRelaxationApplied,
      sourceMode: {
        requestedMode: requestedSourceMode,
        effectiveMode: shouldFallbackToCurated ? 'curated' : retrievalSourceMode,
        debugOverrideApplied: Boolean(options.sourceModeOverrideApplied),
        fallbackToCurated: shouldFallbackToCurated,
        liveFetchAttempted: liveFetch.diagnostics.attempted,
        liveFetchSucceeded: liveFetch.diagnostics.success,
        provider: liveFetch.diagnostics.provider,
        failureReason: fallbackReason,
        queryLocationLabel: liveFetch.diagnostics.queryLocationLabel,
        queryCentersCount: liveFetch.diagnostics.queryCentersCount,
        queryCentersUsed: liveFetch.diagnostics.queryCentersUsed,
        queryRadiusM: liveFetch.diagnostics.queryRadiusM,
        queryCount: liveFetch.diagnostics.queryCount,
        liveQueryTemplatesUsed: liveFetch.diagnostics.liveQueryTemplatesUsed,
        liveQueryLabelsUsed: liveFetch.diagnostics.liveQueryLabelsUsed,
        liveCandidatesByQuery: liveFetch.diagnostics.liveCandidatesByQuery,
        liveRoleIntentQueryNotes: liveFetch.diagnostics.liveRoleIntentQueryNotes,
        fetchedCount: liveFetch.diagnostics.fetchedCount,
        rawFetchedCount: liveFetch.diagnostics.rawFetchedCount,
        mappedCount: liveFetch.diagnostics.mappedCount + (hybridPortable?.diagnostics.selectedCount ?? 0),
        mappedDroppedCount: liveFetch.diagnostics.mappedDroppedCount,
        mappedDropReasons: liveFetch.diagnostics.mappedDropReasons,
        normalizedCount: effectiveLiveVenues.length,
        dedupedByPlaceIdCount: liveFetch.diagnostics.dedupedByPlaceIdCount,
        normalizationDroppedCount: liveFetch.diagnostics.normalizationDroppedCount,
        normalizationDropReasons: liveFetch.diagnostics.normalizationDropReasons,
        acceptedCount: liveFetch.diagnostics.acceptedCount,
        acceptanceDroppedCount: liveFetch.diagnostics.acceptanceDroppedCount,
        acceptanceDropReasons: liveFetch.diagnostics.acceptanceDropReasons,
        approvedCount: effectiveLiveApprovedCount,
        demotedCount: effectiveLiveDemotedCount,
        suppressedCount: effectiveLiveSuppressedCount,
        liveHoursDemotedCount,
        liveHoursSuppressedCount,
        partialFailure: liveFetch.diagnostics.partialFailure,
        errors: liveFetch.diagnostics.errors,
        countsBySource: finalCountsBySource,
        dedupedCount: mergedRequested.dedupedCount,
        dedupedLiveCount: mergedRequested.dedupedLiveCount,
        liveDedupedAgainstCuratedCount: mergedRequested.liveDedupedAgainstCuratedCount,
        liveNoveltyCollapsedCount: mergedRequested.liveNoveltyCollapsedCount,
        dedupeLosses: mergedRequested.dedupeLosses,
        liveTrustBreakdown,
        hybridAdapterUsed: Boolean(hybridPortable),
        hybridAdapterMode: hybridPortable?.diagnostics.mode,
        hybridAdapterNotes: hybridPortable?.diagnostics.notes,
        hybridAdapterCount: hybridPortable?.diagnostics.selectedCount,
        devGreatStopFixturesEnvRaw,
        devGreatStopFixturesEnabled,
        devGreatStopFixtureCount: devGreatStopFixtureVenues.length,
        devGreatStopFixtureVenueIds: devGreatStopFixturesEnabled ? devGreatStopFixtureVenueIds : [],
        runtimeMode: governancePolicy.runtimeMode,
        liveUsableInventory,
        fallbackUsed,
        fallbackReason,
        fallbackSources: shouldFailClosedForLiveInventory ? blockedFallbackList : [
          ...(shouldFallbackToCurated ? (['curated'] as FieldFallbackSource[]) : []),
          ...(finalBootstrapUsed ? (['bootstrap'] as FieldFallbackSource[]) : []),
          ...(defaultCityFallbackUsed ? (['default_city'] as FieldFallbackSource[]) : []),
          ...(fixtureInjectionUsed ? (['fixture'] as FieldFallbackSource[]) : []),
        ],
        inventoryTruth,
        liveFailureVisible,
        fixtureInjectionUsed,
        bootstrapInjectionUsed,
        defaultCityFallbackUsed,
        providerAuthoritySummary,
      },
      stageCounts: {
        totalSeed: mergedPool.venues.length,
        active: activeVenues.length,
        qualityApproved: qualityApproved.length,
        qualityDemoted: qualityDemoted.length,
        qualitySuppressed: qualitySuppressed.length,
        curatedSeed: curatedVenues.length,
        liveFetched: liveFetch.diagnostics.fetchedCount,
        liveMapped: liveFetch.diagnostics.mappedCount + (hybridPortable?.diagnostics.selectedCount ?? 0),
        liveNormalized: effectiveLiveVenues.length,
        liveApproved: effectiveLiveApprovedCount,
        liveDemoted: effectiveLiveDemotedCount,
        liveSuppressed: effectiveLiveSuppressedCount,
        liveHoursDemoted: liveHoursDemotedCount,
        liveHoursSuppressed: liveHoursSuppressedCount,
        cityMatch: cityMatches.length,
        geographyMatch: fallbackMatches.length,
        lensStrict: lensStrictCount,
        lensSoft: lensSoftCount,
        finalRetrieved: venues.length,
        neighborhoodPreferred,
        dedupedMerged: mergedRequested.dedupedCount,
        dedupedLive: mergedRequested.dedupedLiveCount,
        finalCurated: finalCountsBySource.curated,
        finalLive: finalCountsBySource.live,
      },
    }

    if (
      shouldTraceGovernedBuild() &&
      (requestedSourceMode === 'live' || requestedSourceMode === 'hybrid')
    ) {
      console.info('[ID8 TRACE] retrieveVenues sourceMode', {
        requestedSourceMode,
        retrievalSourceMode,
        effectiveMode: result.sourceMode.effectiveMode,
        runtimeMode: result.sourceMode.runtimeMode,
        inventoryTruth: result.sourceMode.inventoryTruth,
        liveFailureVisible: result.sourceMode.liveFailureVisible,
        fallbackUsed: result.sourceMode.fallbackUsed,
        fallbackSources: result.sourceMode.fallbackSources,
        liveUsableInventory: result.sourceMode.liveUsableInventory,
        fixtureInjectionUsed: result.sourceMode.fixtureInjectionUsed,
        countsBySource: result.sourceMode.countsBySource,
      })
    }

    return result
  }

  if (shouldFailClosedForLiveInventory) {
    return buildResult([], 0)
  }

  if (!normalizedNeighborhood) {
    return buildResult(
      mergeRequiredVenues(localFirstLensShapedVenues, [
        ...requiredInventoryVenues,
        ...curatedFixtureVenues,
      ]),
      0,
    )
  }

  const neighborhoodMatches = localFirstLensShapedVenues.filter(
    (venue) => sanitize(venue.neighborhood) === normalizedNeighborhood,
  )
  const nearbyMatches = localFirstLensShapedVenues.filter(
    (venue) => sanitize(venue.neighborhood) !== normalizedNeighborhood,
  )

  if (intent.distanceMode === 'nearby' && neighborhoodMatches.length > 0) {
    return buildResult(
      mergeRequiredVenues([...neighborhoodMatches, ...nearbyMatches], [
        ...requiredInventoryVenues,
        ...curatedFixtureVenues,
      ]),
      neighborhoodMatches.length,
    )
  }

  return buildResult(
    mergeRequiredVenues(localFirstLensShapedVenues, [
      ...requiredInventoryVenues,
      ...curatedFixtureVenues,
    ]),
    neighborhoodMatches.length,
  )
}

function countByProviderAuthority(venues: Venue[]): ProviderAuthoritySummary {
  return venues.reduce<ProviderAuthoritySummary>((acc, venue) => {
    const authority = classifyProviderAuthority(venue.source)
    acc[authority] = (acc[authority] ?? 0) + 1
    return acc
  }, {})
}

function shouldTraceGovernedBuild(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.location.search.includes('debug=1')
}

