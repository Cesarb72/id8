import type {
  CityOpportunityStopOption,
  ProviderShadowPreviewDiagnostics,
  VerifiedCityOpportunity,
} from '../interpretation/verifiedCityOpportunity'
import {
  aggregateTasteOpportunityFromVenues,
  type TasteAggregatedVenueInput,
  type TasteOpportunityAggregation,
} from '../interpretation/taste/aggregateTasteOpportunityFromVenues'
import { interpretVenueTaste } from '../interpretation/taste/interpretVenueTaste'
import { mapVenueToTasteInput } from '../interpretation/taste/mapVenueToTasteInput'
import type { Venue } from '../types/venue'
import type { BuildProviderSourceOpportunity } from './buildProviderSourceOpportunity'
import { providerCanonicalVenueSeeds } from './providerCanonicalVenueSeeds'

const BUILD_PROVIDER_STEP2_INTEGRATION_ENV_FLAG =
  'VITE_ID8_BUILD_PROVIDER_STEP2_INTEGRATION'
const BUILD_PROVIDER_VISIBLE_MERGE_ENV_FLAG =
  'VITE_ID8_BUILD_PROVIDER_VISIBLE_MERGE'

export interface BuildProviderShadowIntegrationDiagnostics {
  buildProviderIntegrationEnabled: boolean
  buildProviderSourceOpportunityEmitted: boolean
  buildProviderVerifiedOpportunityCount: number
  buildProviderFallbackReason: string | null
  buildStaticSourceOpportunityCount: number
  buildLiveSourceOpportunityCount: number
}

export interface AdaptBuildProviderSourceOpportunityInput {
  opportunity: BuildProviderSourceOpportunity
}

export type ProviderShadowPreviewSupportDiagnostics =
  ProviderShadowPreviewDiagnostics

function getProcessEnvValue(key: string): string | undefined {
  const processEnv = (globalThis as {
    process?: { env?: Record<string, string | undefined> }
  }).process?.env
  return processEnv?.[key]
}

function readEnvValue(key: string): string | undefined {
  const importMetaEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env
  return importMetaEnv?.[key] ?? getProcessEnvValue(key)
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return undefined
}

export function isBuildProviderStep2IntegrationEnabled(): boolean {
  return (
    parseBooleanEnv(readEnvValue(BUILD_PROVIDER_STEP2_INTEGRATION_ENV_FLAG)) ===
    true
  )
}

export function isBuildProviderVisibleMergeEnabled(): boolean {
  return (
    parseBooleanEnv(readEnvValue(BUILD_PROVIDER_VISIBLE_MERGE_ENV_FLAG)) ===
    true
  )
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function dedupeVenuesById(venues: Venue[]): Venue[] {
  const seen = new Set<string>()
  const deduped: Venue[] = []
  venues.forEach((venue) => {
    if (seen.has(venue.id)) {
      return
    }
    seen.add(venue.id)
    deduped.push(venue)
  })
  return deduped
}

function getSeededCanonicalVenueIdForProviderRecord(
  providerRecordId: string | undefined,
): string | null {
  const normalizedProviderRecordId = providerRecordId?.trim()
  if (!normalizedProviderRecordId) {
    return null
  }
  return (
    providerCanonicalVenueSeeds.find(
      (entry) =>
        entry.provider === 'google-places' &&
        entry.providerRecordId === normalizedProviderRecordId,
    )?.canonicalVenueId ?? null
  )
}

export function getBuildProviderPreviewBaseVenueId(venue: Venue): string {
  return (
    getSeededCanonicalVenueIdForProviderRecord(venue.source.providerRecordId) ??
    venue.id.trim()
  )
}

function isSameProviderShadowPreviewVenue(left: Venue, right: Venue): boolean {
  const leftBaseVenueId = getBuildProviderPreviewBaseVenueId(left)
  const rightBaseVenueId = getBuildProviderPreviewBaseVenueId(right)
  return Boolean(leftBaseVenueId && rightBaseVenueId && leftBaseVenueId === rightBaseVenueId)
}

function moveSelectedVenueFirst(venues: Venue[], selected: Venue | null): Venue[] {
  if (!selected) {
    return venues
  }
  const selectedBaseVenueId = getBuildProviderPreviewBaseVenueId(selected)
  const selectedIndex = venues.findIndex(
    (venue) =>
      venue.id === selected.id ||
      getBuildProviderPreviewBaseVenueId(venue) === selectedBaseVenueId,
  )
  if (selectedIndex <= 0) {
    return venues
  }
  return [
    venues[selectedIndex]!,
    ...venues.slice(0, selectedIndex),
    ...venues.slice(selectedIndex + 1),
  ]
}

export function selectProviderShadowPreviewSupports(params: {
  anchor: Venue
  startsPool: Venue[]
  windDownPool: Venue[]
}): {
  startsPool: Venue[]
  windDownPool: Venue[]
  diagnostics: ProviderShadowPreviewSupportDiagnostics
} {
  const selectedStart = params.startsPool[0] ?? null
  const initialWindDown = params.windDownPool[0] ?? null
  const duplicateVenueDetected = Boolean(
    selectedStart &&
      initialWindDown &&
      isSameProviderShadowPreviewVenue(selectedStart, initialWindDown),
  )
  const distinctWindDown =
    duplicateVenueDetected && selectedStart
      ? params.windDownPool.find(
          (venue) => !isSameProviderShadowPreviewVenue(selectedStart, venue),
        ) ?? null
      : initialWindDown
  const selectedWindDown = distinctWindDown ?? initialWindDown
  const selectedStartBaseVenueId = selectedStart
    ? getBuildProviderPreviewBaseVenueId(selectedStart)
    : null
  const selectedWindDownBaseVenueId = selectedWindDown
    ? getBuildProviderPreviewBaseVenueId(selectedWindDown)
    : null
  const duplicateVenueAvoided = Boolean(
    duplicateVenueDetected &&
      selectedStartBaseVenueId &&
      selectedWindDownBaseVenueId &&
      selectedStartBaseVenueId !== selectedWindDownBaseVenueId,
  )
  const duplicateVenueUnavoidable = Boolean(
    duplicateVenueDetected && !duplicateVenueAvoided,
  )

  return {
    startsPool: params.startsPool,
    windDownPool: moveSelectedVenueFirst(params.windDownPool, selectedWindDown),
    diagnostics: {
      providerShadowPreviewDuplicateVenueDetected: duplicateVenueDetected,
      providerShadowPreviewDuplicateVenueAvoided: duplicateVenueAvoided,
      providerShadowPreviewDuplicateVenueUnavoidable: duplicateVenueUnavoidable,
      providerShadowPreviewDistinctSupportAvailable: duplicateVenueAvoided,
      providerShadowPreviewSelectedStartId: selectedStart?.id ?? null,
      providerShadowPreviewSelectedAnchorId: params.anchor.id,
      providerShadowPreviewSelectedWindDownId: selectedWindDown?.id ?? null,
      providerShadowPreviewSelectedStartBaseVenueId: selectedStartBaseVenueId,
      providerShadowPreviewSelectedAnchorBaseVenueId:
        getBuildProviderPreviewBaseVenueId(params.anchor),
      providerShadowPreviewSelectedWindDownBaseVenueId: selectedWindDownBaseVenueId,
    },
  }
}

function getPrimaryDistrictLabel(anchor: Venue): string {
  return anchor.neighborhood.trim() || anchor.city.trim() || 'Nearby district'
}

function mapVenueToAggregatedTasteInput(
  venue: Venue,
  districtLabel: string,
): TasteAggregatedVenueInput {
  const normalizedTasteInput = mapVenueToTasteInput(venue)
  const tasteSignals = interpretVenueTaste(normalizedTasteInput, {
    timeWindow: venue.source.openNow ? 'evening' : undefined,
  })
  return {
    venueId: venue.id,
    venueName: venue.name,
    districtId: districtLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    districtLabel,
    lat: venue.source.latitude,
    lng: venue.source.longitude,
    fitScore: clamp01(
        venue.source.qualityScore * 0.4 +
        venue.source.sourceConfidence * 0.25 +
        venue.roleAffinity.peak * 0.2 +
        venue.roleAffinity.cooldown * 0.15,
    ),
    tasteSignals,
    context: {
      timeWindow: venue.source.openNow ? 'evening' : 'unknown',
    },
    sourceFlags: {
      eventCapable: venue.settings.eventCapable,
      musicCapable: venue.settings.musicCapable,
      performanceCapable: venue.settings.performanceCapable,
      highlightCapable: venue.highlightCapable,
    },
    hoursStatus: normalizedTasteInput.hoursStatus,
    hoursConfidence: normalizedTasteInput.hoursConfidence,
    happenings: normalizedTasteInput.happenings,
  }
}

function buildOpportunityConfidenceLine(
  aggregation: TasteOpportunityAggregation,
): string {
  const movement =
    aggregation.summary.movementProfile === 'tight'
      ? 'tight movement'
      : aggregation.summary.movementProfile === 'spread'
        ? 'more open movement'
        : 'balanced movement'
  const highlight =
    aggregation.summary.highlightPotential === 'high'
      ? 'strong highlight confidence'
      : aggregation.summary.highlightPotential === 'medium'
        ? 'steady highlight confidence'
        : 'emerging highlight confidence'
  return `${movement} with ${highlight}`
}

function buildVibeLabel(aggregation: TasteOpportunityAggregation): string {
  if (aggregation.summary.dominantEnergy === 'lively') {
    return 'Lively'
  }
  if (aggregation.summary.discoveryBalance === 'novel') {
    return 'Exploratory'
  }
  if (aggregation.summary.dominantSocialDensity === 'intimate') {
    return 'Intimate'
  }
  return 'Balanced'
}

function buildFlavorLine(
  anchor: Venue,
  aggregation: TasteOpportunityAggregation,
): string {
  if (aggregation.summary.dominantEnergy === 'lively') {
    return `Live-energy ${anchor.category} anchor`
  }
  if (aggregation.summary.discoveryBalance === 'novel') {
    return `Discovery-led ${anchor.category} anchor`
  }
  if (aggregation.summary.dominantSocialDensity === 'intimate') {
    return `Contained ${anchor.category} anchor`
  }
  return `Intent-matched ${anchor.category} anchor`
}

function buildOpportunityVerificationReasons(params: {
  anchor: Venue
  confidenceLine: string
  startCount: number
  windDownCount: number
}): string[] {
  const reasons = [
    params.anchor.shortDescription,
    params.anchor.narrativeFlavor,
    params.confidenceLine,
    params.startCount > 0 && params.windDownCount > 0
      ? 'Admitted live support exists on both sides of the anchor.'
      : null,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())

  return reasons.slice(0, 2)
}

function buildStopOption(
  venue: Venue,
  role: 'start' | 'highlight' | 'windDown',
  aggregation: TasteOpportunityAggregation,
): CityOpportunityStopOption {
  const reasonByRole = new Map(
    (
      role === 'start'
        ? aggregation.ingredients.startCandidates
        : role === 'highlight'
          ? aggregation.ingredients.highlightCandidates
          : aggregation.ingredients.windDownCandidates
    ).map((candidate) => [candidate.venueId, candidate] as const),
  )
  const aggregatedCandidate = reasonByRole.get(venue.id)
  const fallbackReason =
    role === 'start'
      ? venue.shortDescription || 'Admitted live opener candidate.'
      : role === 'highlight'
        ? venue.narrativeFlavor || 'Admitted live highlight candidate.'
        : venue.shortDescription || 'Admitted live wind-down candidate.'

  const scoreBase =
    role === 'start'
      ? venue.roleAffinity.warmup
      : role === 'highlight'
        ? venue.roleAffinity.peak
        : venue.roleAffinity.cooldown

  return {
    venueId: venue.id,
    name: venue.name,
    address: venue.source.formattedAddress,
    reason: aggregatedCandidate?.reason ?? fallbackReason,
    isOpenNow: venue.source.openNow,
    score: clamp01(
      scoreBase * 0.55 +
        venue.source.qualityScore * 0.2 +
        venue.source.timeConfidence * 0.15 +
        venue.source.sourceConfidence * 0.1,
    ),
  }
}

function buildExcellenceScore(params: {
  anchor: Venue
  starts: CityOpportunityStopOption[]
  highlightAlternates: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  aggregation: TasteOpportunityAggregation
}): VerifiedCityOpportunity['excellence'] {
  const { anchor, starts, highlightAlternates, closes, aggregation } = params
  const anchorStrength = clamp01(
    anchor.roleAffinity.peak * 0.4 +
      anchor.source.qualityScore * 0.25 +
      anchor.source.sourceConfidence * 0.2 +
      anchor.localSignals.localFavoriteScore * 0.15,
  )
  const startQuality = starts[0]?.score ?? 0
  const windDownQuality = closes[0]?.score ?? 0
  const supportCoherence = clamp01(
    aggregation.summary.movementProfile === 'tight'
      ? 0.82
      : aggregation.summary.movementProfile === 'moderate'
        ? 0.72
        : 0.62,
  )
  const scenarioAlignment = clamp01(
    aggregation.summary.highlightPotential === 'high'
      ? 0.82
      : aggregation.summary.highlightPotential === 'medium'
        ? 0.72
        : 0.58,
  )
  const experienceAlignment = clamp01(
    aggregation.summary.discoveryBalance === 'balanced'
      ? 0.76
      : aggregation.summary.discoveryBalance === 'novel'
        ? 0.72
        : 0.68,
  )
  const localAuthority = clamp01(
    anchor.localSignals.localFavoriteScore * 0.45 +
      anchor.localSignals.neighborhoodPrideScore * 0.3 +
      anchor.localSignals.repeatVisitorScore * 0.25,
  )
  const modeExcellence = clamp01(
    (aggregation.diagnostics.roleCoverage.start > 0 ? 0.25 : 0) +
      (aggregation.diagnostics.roleCoverage.highlight > 0 ? 0.35 : 0) +
      (aggregation.diagnostics.roleCoverage.windDown > 0 ? 0.25 : 0) +
      (highlightAlternates.length > 0 ? 0.15 : 0),
  )
  const score = clamp01(
    anchorStrength * 0.22 +
      startQuality * 0.14 +
      windDownQuality * 0.16 +
      supportCoherence * 0.14 +
      scenarioAlignment * 0.1 +
      experienceAlignment * 0.08 +
      localAuthority * 0.08 +
      modeExcellence * 0.08,
  )

  return {
    score,
    threshold: 0.62,
    passes: score >= 0.62,
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioAlignment,
    experienceAlignment,
    localAuthority,
    modeExcellence,
  }
}

export function adaptBuildProviderSourceOpportunityToVerifiedOpportunity(
  input: AdaptBuildProviderSourceOpportunityInput,
): VerifiedCityOpportunity | null {
  const { opportunity } = input
  const anchor = opportunity.anchor.venue
  const startsPool = dedupeVenuesById(opportunity.roleCandidates.start)
  const highlightPool = dedupeVenuesById(
    opportunity.roleCandidates.highlight.filter(
      (venue) => venue.id !== anchor.id,
    ),
  )
  const initialWindDownPool = dedupeVenuesById(opportunity.roleCandidates.windDown)
  const previewSupports = selectProviderShadowPreviewSupports({
    anchor,
    startsPool,
    windDownPool: initialWindDownPool,
  })
  const windDownPool = previewSupports.windDownPool
  if (startsPool.length === 0 || windDownPool.length === 0) {
    return null
  }

  const primaryDistrict = getPrimaryDistrictLabel(anchor)
  const aggregation = aggregateTasteOpportunityFromVenues(
    dedupeVenuesById([
      anchor,
      ...opportunity.nearbyCandidates,
      ...startsPool,
      ...highlightPool,
      ...windDownPool,
    ]).map((venue) => mapVenueToAggregatedTasteInput(venue, primaryDistrict)),
  )

  const starts = startsPool.map((venue) =>
    buildStopOption(venue, 'start', aggregation),
  )
  const highlightAlternates = highlightPool.map((venue) =>
    buildStopOption(venue, 'highlight', aggregation),
  )
  const closes = windDownPool.map((venue) =>
    buildStopOption(venue, 'windDown', aggregation),
  )
  const confidenceLine = buildOpportunityConfidenceLine(aggregation)
  const vibeLabel = buildVibeLabel(aggregation)
  const excellence = buildExcellenceScore({
    anchor,
    starts,
    highlightAlternates,
    closes,
    aggregation,
  })
  const whyTonightStrength = clamp01(
    anchor.source.timeConfidence * 0.35 +
      anchor.source.qualityScore * 0.25 +
      (aggregation.summary.highlightPotential === 'high'
        ? 0.2
        : aggregation.summary.highlightPotential === 'medium'
          ? 0.12
          : 0.04) +
      (aggregation.summary.discoveryBalance === 'novel' ? 0.08 : 0),
  )
  const cozyAuthorityStrength = clamp01(
    anchor.localSignals.localFavoriteScore * 0.5 +
      anchor.localSignals.neighborhoodPrideScore * 0.3 +
      (anchor.energyLevel <= 3 ? 0.2 : 0.08),
  )

  return {
    id: `verified_${opportunity.id}`,
    sourceMode: 'live',
    flavor: buildFlavorLine(anchor, aggregation),
    anchor: {
      venueId: anchor.id,
      name: anchor.name,
      address: anchor.source.formattedAddress,
      district: primaryDistrict,
      sourceType: 'venue',
      isOpenNow: anchor.source.openNow,
      timingLabel: anchor.source.openNow ? 'Open now' : undefined,
      verificationReasons: buildOpportunityVerificationReasons({
        anchor,
        confidenceLine,
        startCount: starts.length,
        windDownCount: closes.length,
      }),
    },
    starts,
    highlightAlternates:
      highlightAlternates.length > 0 ? highlightAlternates : undefined,
    closes,
    nearbyHappenings: [],
    districtContext: {
      primaryDistrict,
    },
    fit: {
      persona: 'Build',
      vibe: vibeLabel,
      confidenceLine,
      matchLine: `${primaryDistrict} live provider opportunity`,
    },
    storySpine: {
      start: starts[0]?.name ?? anchor.name,
      highlight: anchor.name,
      windDown: closes[0]?.name ?? starts[0]?.name ?? anchor.name,
    },
    selection: {},
    survivorSignals: {
      whyTonightStrength,
      cozyAuthorityStrength,
      highWhyTonight: whyTonightStrength >= 0.64,
      highCozyAuthority: cozyAuthorityStrength >= 0.62,
    },
    excellence,
    whyTonightProofLine:
      whyTonightStrength >= 0.6
        ? 'Admitted live supply supports this nearby sequence tonight.'
        : undefined,
    providerShadowPreviewDiagnostics: previewSupports.diagnostics,
  }
}

export const buildProviderStep2IntegrationConfig = {
  envFlag: BUILD_PROVIDER_STEP2_INTEGRATION_ENV_FLAG,
  visibleMergeEnvFlag: BUILD_PROVIDER_VISIBLE_MERGE_ENV_FLAG,
}
