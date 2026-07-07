import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  adaptBuildProviderSourceOpportunityToVerifiedOpportunity,
  getBuildProviderPreviewBaseVenueId,
  selectProviderShadowPreviewSupports,
} from '../src/domain/providers/adaptBuildProviderSourceOpportunityToVerifiedOpportunity'
import {
  buildRouteRecommendationLifecycleDiagnostics,
  isCandidateRouteLifecycleSurface,
} from '../src/app/services/routeRecommendationLifecycle'
import type { BuildProviderSourceOpportunity } from '../src/domain/providers/buildProviderSourceOpportunity'
import type { Venue } from '../src/domain/types/venue'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(
    `Unexpected fetch in provider-shadow preview support shaping test: ${String(args[0])}`,
  )
}) as typeof fetch

function makeVenue(overrides: Partial<Venue> & Pick<Venue, 'id' | 'name'>): Venue {
  return {
    id: overrides.id,
    name: overrides.name,
    city: overrides.city ?? 'San Jose',
    neighborhood: overrides.neighborhood ?? 'Downtown',
    driveMinutes: overrides.driveMinutes ?? 8,
    category: overrides.category ?? 'cafe',
    subcategory: overrides.subcategory ?? 'coffee',
    priceTier: overrides.priceTier ?? '$$',
    tags: overrides.tags ?? ['quiet', 'local'],
    useCases: overrides.useCases ?? ['romantic'],
    vibeTags: overrides.vibeTags ?? ['cozy'],
    energyLevel: overrides.energyLevel ?? 3,
    socialDensity: overrides.socialDensity ?? 3,
    uniquenessScore: overrides.uniquenessScore ?? 0.74,
    distinctivenessScore: overrides.distinctivenessScore ?? 0.72,
    underexposureScore: overrides.underexposureScore ?? 0.6,
    shareabilityScore: overrides.shareabilityScore ?? 0.58,
    isChain: overrides.isChain ?? false,
    localSignals: overrides.localSignals ?? {
      localFavoriteScore: 0.7,
      neighborhoodPrideScore: 0.68,
      repeatVisitorScore: 0.64,
    },
    roleAffinity: overrides.roleAffinity ?? {
      warmup: 0.74,
      peak: 0.7,
      wildcard: 0.45,
      cooldown: 0.74,
    },
    imageUrl: overrides.imageUrl ?? '',
    shortDescription: overrides.shortDescription ?? `${overrides.name} support stop.`,
    narrativeFlavor: overrides.narrativeFlavor ?? `${overrides.name} fits the route.`,
    isHiddenGem: overrides.isHiddenGem ?? false,
    isActive: overrides.isActive ?? true,
    highlightCapable: overrides.highlightCapable ?? true,
    durationProfile: overrides.durationProfile ?? {
      durationClass: 'medium',
      estimatedMinutes: 45,
    },
    settings: overrides.settings ?? {
      socialDensity: 3,
      highlightCapabilityTier: 'highlight-capable',
      highlightConfidence: 0.72,
      supportOnly: false,
      connectiveOnly: false,
      setting: 'indoor',
      familyFriendly: true,
      adultSocial: true,
      dateFriendly: true,
      eventCapable: false,
      musicCapable: false,
      performanceCapable: false,
      routeFootprint: 'compact',
    },
    signature: overrides.signature ?? {
      chainLike: false,
      genericScore: 0.18,
      signatureScore: 0.78,
    },
    source: {
      normalizedFromRawType: 'raw-place',
      sourceOrigin: 'live',
      provider: 'google-places',
      providerRecordId: `${overrides.id}-provider-record`,
      formattedAddress: `${overrides.name} address`,
      latitude: 37.33,
      longitude: -121.89,
      sourceQueryLabel: 'test',
      rating: 4.5,
      reviewCount: 100,
      sourceConfidence: 0.86,
      completenessScore: 0.9,
      qualityScore: 0.82,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      businessStatus: 'OPERATIONAL',
      timeConfidence: 0.86,
      hoursPressureLevel: 'low',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: ['cafe'],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus: 'approved',
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: [],
      ...overrides.source,
    },
  }
}

function makeOpportunity(params: {
  anchor: Venue
  starts: Venue[]
  windDown: Venue[]
  highlight?: Venue[]
}): BuildProviderSourceOpportunity {
  return {
    id: 'provider-shadow-preview-shaping',
    sourceMode: 'live',
    anchor: {
      canonicalVenueId: params.anchor.id,
      providerRecordId: params.anchor.source.providerRecordId ?? 'anchor-provider',
      venue: params.anchor,
    },
    nearbyCandidates: [params.anchor, ...params.starts, ...params.windDown],
    roleCandidates: {
      start: params.starts,
      highlight: params.highlight ?? [params.anchor],
      windDown: params.windDown,
    },
    diagnostics: {
      canonicalMappings: [],
      completeness: [],
      equivalence: [],
      trace: null,
      ledger: null,
      suppressionReasons: [],
      roleCandidateCounts: {
        start: params.starts.length,
        highlight: params.highlight?.length ?? 1,
        windDown: params.windDown.length,
      },
    },
  } as unknown as BuildProviderSourceOpportunity
}

const repoRoot = process.cwd()
const routeAuthoritySource = readFileSync(
  join(repoRoot, 'src/app/services/routeAuthority/routeAuthorityService.ts'),
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  join(repoRoot, 'src/domain/artifacts/runtimeRouteArtifact.ts'),
  'utf8',
)
const greatStopGateSource = readFileSync(
  join(repoRoot, 'src/domain/greatStop/buildGreatStopGateResult.ts'),
  'utf8',
)

const anchor = makeVenue({
  id: 'sj-adega-wine-atelier',
  name: 'Adega',
  category: 'restaurant',
  subcategory: 'wine atelier',
  roleAffinity: { warmup: 0.45, peak: 0.86, wildcard: 0.5, cooldown: 0.5 },
  source: {
    providerRecordId: 'ChIJC797reHMj4ARSaQDCMuHWSQ',
  } as Venue['source'],
})

const qishr = makeVenue({
  id: 'live_google_qishr-provider-record',
  name: 'Qishr Coffee House',
  source: {
    providerRecordId: 'qishr-provider-record',
  } as Venue['source'],
})
const jtown = makeVenue({
  id: 'live_google_jtown-provider-record',
  name: 'Jtown Matcha Kissaten',
  source: {
    providerRecordId: 'jtown-provider-record',
  } as Venue['source'],
})

const supportSelection = selectProviderShadowPreviewSupports({
  anchor,
  startsPool: [qishr],
  windDownPool: [qishr, jtown],
})

assert(
  supportSelection.diagnostics.providerShadowPreviewDuplicateVenueDetected,
  'Top start/top windDown same venue must be detected.',
)
assert(
  supportSelection.diagnostics.providerShadowPreviewDuplicateVenueAvoided,
  'Distinct windDown alternative must avoid duplicate route-instance support.',
)
assert(
  !supportSelection.diagnostics.providerShadowPreviewDuplicateVenueUnavoidable,
  'Duplicate support must not be marked unavoidable when a distinct alternative exists.',
)
assert(
  supportSelection.windDownPool[0]?.id === jtown.id,
  'The first distinct windDown alternative must be moved to the route-instance position.',
)
assert(
  supportSelection.windDownPool.some((venue) => venue.id === qishr.id),
  'Original duplicate venue must remain available in the role pool options.',
)

const adapted = adaptBuildProviderSourceOpportunityToVerifiedOpportunity({
  opportunity: makeOpportunity({
    anchor,
    starts: [qishr],
    windDown: [qishr, jtown],
  }),
})
assert(adapted, 'Provider-shadow source opportunity must adapt.')
assert(adapted.storySpine.start === 'Qishr Coffee House', 'Preview start should use top start.')
assert(adapted.storySpine.highlight === 'Adega', 'Required anchor must remain the highlight.')
assert(
  adapted.storySpine.windDown === 'Jtown Matcha Kissaten',
  'Qishr-like duplicate windDown must not be selected when alternatives exist.',
)
assert(adapted.closes[0]?.name === 'Jtown Matcha Kissaten', 'Preview close should be distinct.')
assert(
  adapted.closes.some((close) => close.venueId === qishr.id),
  'Duplicate role-pool option should remain present after route-instance support shaping.',
)
assert(
  adapted.providerShadowPreviewDiagnostics?.providerShadowPreviewDuplicateVenueAvoided,
  'Adapted provider-shadow opportunity must expose duplicate avoidance diagnostics.',
)

const unavoidable = selectProviderShadowPreviewSupports({
  anchor,
  startsPool: [qishr],
  windDownPool: [qishr],
})
assert(
  unavoidable.diagnostics.providerShadowPreviewDuplicateVenueDetected,
  'Single duplicate support must still be detected.',
)
assert(
  unavoidable.diagnostics.providerShadowPreviewDuplicateVenueUnavoidable,
  'Single duplicate support must be diagnosed as unavoidable.',
)
assert(
  !unavoidable.diagnostics.providerShadowPreviewDistinctSupportAvailable,
  'Distinct support must be false when no alternate windDown exists.',
)
const unavoidableAdapted = adaptBuildProviderSourceOpportunityToVerifiedOpportunity({
  opportunity: makeOpportunity({
    anchor,
    starts: [qishr],
    windDown: [qishr],
  }),
})
assert(
  unavoidableAdapted?.providerShadowPreviewDiagnostics
    ?.providerShadowPreviewDuplicateVenueUnavoidable,
  'Adapted provider-shadow opportunity must expose unavoidable duplicate diagnostics.',
)

const seededAdegaLive = makeVenue({
  id: 'live_google_ChIJC797reHMj4ARSaQDCMuHWSQ',
  name: 'Adega Live Provider Record',
  source: {
    providerRecordId: 'ChIJC797reHMj4ARSaQDCMuHWSQ',
  } as Venue['source'],
})
const seededAdegaAlternateRaw = makeVenue({
  id: 'live_google_alt_raw_for_adega',
  name: 'Adega Alternate Raw Provider Record',
  source: {
    providerRecordId: 'ChIJC797reHMj4ARSaQDCMuHWSQ',
  } as Venue['source'],
})
assert(
  getBuildProviderPreviewBaseVenueId(seededAdegaLive) === 'sj-adega-wine-atelier',
  'Seeded provider venue must resolve to canonical/base identity for preview matching.',
)
const canonicalDuplicate = selectProviderShadowPreviewSupports({
  anchor,
  startsPool: [seededAdegaLive],
  windDownPool: [seededAdegaAlternateRaw, jtown],
})
assert(
  canonicalDuplicate.diagnostics.providerShadowPreviewDuplicateVenueDetected,
  'Same canonical/base identity must detect duplicate support even when raw IDs differ.',
)
assert(
  canonicalDuplicate.windDownPool[0]?.id === jtown.id,
  'Canonical/base duplicate must select the next distinct windDown.',
)

const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
  routeSummarySource: 'candidate',
  routeSummaryProvenance: 'candidate_artifact',
  renderedRouteSource: 'none',
  generatedContractEntryArtifactPresent: false,
  finalRoutePresent: false,
  runtimeRouteArtifactPresent: false,
  greatStopStatus: null,
  greatStopFailureClassification: null,
  routeAuthorityStatus: 'invalid',
  lockInputAvailable: false,
  reviewEligible: true,
  lockEligible: true,
})
assert(
  isCandidateRouteLifecycleSurface({
    routeSummarySource: 'candidate',
    routeSummaryProvenance: 'candidate_artifact',
  }),
  'Provider-shadow preview must remain candidate/candidate_artifact surface.',
)
assert(lifecycle.phase === 'candidate_preview', 'Provider-shadow preview must remain candidate_preview.')
assert(!lifecycle.reviewEligible, 'Provider-shadow preview must remain non-reviewable.')
assert(!lifecycle.lockEligible, 'Provider-shadow preview must remain non-lockable.')
assert(
  lifecycle.userFacingLabel === 'Candidate preview - not a recommendation yet',
  'Provider-shadow preview must keep the candidate preview label.',
)

assert(
  routeAuthoritySource.includes('provider_shadow_not_authority'),
  'provider_shadow must remain non-authoritative in routeAuthority.',
)
assert(
  runtimeRouteArtifactSource.includes('export interface RuntimeRouteStop') &&
    !runtimeRouteArtifactSource.includes('providerShadowPreviewDuplicateVenue'),
  'RuntimeRouteArtifact shape must remain unchanged by preview diagnostics.',
)
for (const thresholdToken of [
  'maxComfortableTotalMovementMinutes',
  'maxSingleTransitionMinutes',
  'maxClusterEscapes',
  'place_right:total_movement_over_preset',
  'moment_right:no_strong_main_moment',
]) {
  assert(
    greatStopGateSource.includes(thresholdToken),
    `Great Stop threshold/gate token must remain present: ${thresholdToken}`,
  )
}

console.log(
  JSON.stringify(
    {
      duplicatePreviewAvoided: true,
      qishrLikeDuplicateNotSelectedWhenAlternativeExists:
        adapted.storySpine.windDown === 'Jtown Matcha Kissaten',
      requiredAnchorPreserved: adapted.storySpine.highlight === 'Adega',
      rolePoolsPreserveDuplicateVenueOption: adapted.closes.some(
        (close) => close.venueId === qishr.id,
      ),
      duplicateUnavoidableDiagnosed:
        unavoidable.diagnostics.providerShadowPreviewDuplicateVenueUnavoidable,
      adaptedDuplicateDiagnosticsExposed:
        adapted.providerShadowPreviewDiagnostics?.providerShadowPreviewDuplicateVenueAvoided ===
          true &&
        unavoidableAdapted.providerShadowPreviewDiagnostics
          ?.providerShadowPreviewDuplicateVenueUnavoidable === true,
      canonicalBaseIdentityUsed:
        canonicalDuplicate.diagnostics.providerShadowPreviewDuplicateVenueDetected,
      candidatePreviewNonReviewable: !lifecycle.reviewEligible,
      candidatePreviewNonLockable: !lifecycle.lockEligible,
      reviewCtaSuppressed: lifecycle.userFacingLabel === 'Candidate preview - not a recommendation yet',
      providerShadowNonAuthoritative: routeAuthoritySource.includes('provider_shadow_not_authority'),
      runtimeRouteArtifactShapeUnchanged: !runtimeRouteArtifactSource.includes(
        'providerShadowPreviewDuplicateVenue',
      ),
      greatStopThresholdsUnchanged: true,
      fetchCallCount,
    },
    null,
    2,
  ),
)

assert(fetchCallCount === 0, 'No fetch calls are allowed in this no-network test.')
