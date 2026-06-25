import { starterPacks } from '../src/data/starterPacks.ts'
import { curatedVenues } from '../src/data/venues.ts'
import { buildCanonicalPublicRouteFlowTruth } from '../src/app/services/canonicalPublicRouteTruthService.ts'
import {
  buildPublicCurateCardTruthModel,
  validatePublicCurateApprovedPayloadTruth,
} from '../src/app/services/curate/publicCurateCardTruthService.ts'
import { buildContractEntryRuntimeRouteLockTruth } from '../src/app/services/live/contractEntryLockHandoff.ts'
import { buildLockedLiveArtifactPayload } from '../src/app/services/live/liveSessionHandoff.ts'
import { buildCurateRefinementEntryPayload } from '../src/app/wrapper/curateRefinementEntry.ts'
import { buildPreviewFromFinalRoute } from '../src/domain/artifacts/selectedRouteProjection.ts'
import {
  loadSharedLiveArtifactPlan,
  saveSharedLiveArtifactPlan,
} from '../src/domain/live/liveArtifactSession.ts'
import { validateLockedLiveArtifactSessionPayload } from '../src/domain/live/validateLiveArtifact.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { Itinerary, ItineraryStop, UserStopRole, UserStopTitle } from '../src/domain/types/itinerary.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import type { Venue } from '../src/domain/types/venue.ts'

const FIELD_PROXY_PATH = '/api/field/text-search'
const CANONICAL_ROUTE_IDS = [
  'sj-willow-court-wine-bar',
  'sj-theatre-district-jazz-cellar',
  'sj-hedley-club-lounge',
] as const
const CANONICAL_ROUTE_NAMES = [
  'Willow Court Wine Bar',
  'Theatre District Jazz Cellar',
  'Hedley Club Lounge',
] as const
const SELECTED_DIRECTION_ID = 'curate:green-path:willow-court'
const ARTIFACT_ID = 'contract-entry:curate-green-path:willow-court'
const STARTER_PACK_ID = 'cozy-jazz-night'

const originalFetch = globalThis.fetch
const fetchCalls: string[] = []

const fetchTrap: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  fetchCalls.push(url)
  throw new Error(`Curate green-path regression must not call fetch: ${url}`)
}

class MemoryStorage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  clear(): void {
    this.values.clear()
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function findVenue(id: string): Venue {
  const venue = curatedVenues.find((candidate) => candidate.id === id)
  if (!venue) {
    throw new Error(`Missing venue fixture: ${id}`)
  }
  return venue
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack fixture: ${id}`)
  }
  return starterPack
}

function titleForRole(role: UserStopRole): UserStopTitle {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'windDown') {
    return 'Wind Down'
  }
  return 'Surprise'
}

function buildStop(params: {
  venue: Venue
  role: UserStopRole
  index: number
}): ItineraryStop {
  const { venue, role, index } = params
  return {
    id: `stop:${venue.id}`,
    role,
    title: titleForRole(role),
    venueId: venue.id,
    venueName: venue.name,
    formattedAddress:
      venue.source.formattedAddress ?? `${100 + index} Local Fixture Way, San Jose, CA`,
    latitude: venue.source.latitude ?? 37.33 + index * 0.001,
    longitude: venue.source.longitude ?? -121.89 - index * 0.001,
    city: venue.city,
    category: venue.category,
    subcategory: venue.subcategory,
    priceTier: venue.priceTier,
    tags: venue.tags,
    vibeTags: venue.vibeTags,
    neighborhood: venue.neighborhood,
    driveMinutes: venue.driveMinutes,
    durationClass: venue.durationProfile.durationClass,
    estimatedDurationMinutes: venue.durationProfile.estimatedMinutes,
    estimatedDurationLabel: `${venue.durationProfile.estimatedMinutes} min`,
    subtitle: venue.shortDescription,
    imageUrl: venue.imageUrl,
    stopInsider: {
      roleReason: `${venue.name} holds the ${role} role in the deterministic green path.`,
      localSignal: venue.narrativeFlavor,
      selectionReason: 'Local fixture regression route.',
    },
  }
}

function buildScoredVenue(venue: Venue): ScoredVenue {
  return {
    venue,
    candidateIdentity: {
      candidateId: `candidate:${venue.id}`,
      baseVenueId: venue.id,
      kind: 'base',
      traceLabel: venue.name,
    },
  } as ScoredVenue
}

function orderedCoreIdsFromItinerary(itinerary: Itinerary): string[] {
  return itinerary.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .map((stop) => stop.venueId)
}

function orderedIdsFromFinalRoute(route: RuntimeRouteArtifact): string[] {
  return route.stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => stop.venueId)
}

function orderedNamesFromProjectionStops(stops: Array<{ name: string }>): string[] {
  return stops.map((stop) => stop.name)
}

function assertCanonicalIds(actual: string[], label: string): void {
  assert(
    actual.join('|') === CANONICAL_ROUTE_IDS.join('|'),
    `${label} must preserve canonical ids. Expected ${CANONICAL_ROUTE_IDS.join(' -> ')}, received ${actual.join(' -> ')}.`,
  )
}

function assertCanonicalNames(actual: string[], label: string): void {
  assert(
    actual.join('|') === CANONICAL_ROUTE_NAMES.join('|'),
    `${label} must preserve canonical names. Expected ${CANONICAL_ROUTE_NAMES.join(' -> ')}, received ${actual.join(' -> ')}.`,
  )
}

function buildWillowCourtItinerary(): Itinerary {
  const stops = [
    buildStop({ venue: findVenue('sj-willow-court-wine-bar'), role: 'start', index: 0 }),
    buildStop({ venue: findVenue('sj-willow-glen-tea-atelier'), role: 'surprise', index: 1 }),
    buildStop({ venue: findVenue('sj-theatre-district-jazz-cellar'), role: 'highlight', index: 2 }),
    buildStop({ venue: findVenue('sj-bramhall-park-promenade'), role: 'surprise', index: 3 }),
    buildStop({ venue: findVenue('sj-hedley-club-lounge'), role: 'windDown', index: 4 }),
  ]

  return {
    id: 'itinerary:curate-green-path:willow-court',
    title: 'Willow Court to Jazz Cellar',
    city: 'San Jose',
    neighborhood: 'Willow Glen / Downtown',
    crew: 'romantic',
    vibes: ['cozy', 'cultured'],
    stops,
    transitions: [],
    totalRouteFriction: 0.16,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'Intimate, local, and music-led',
    story: {
      headline: 'Willow Court to Jazz Cellar',
      subtitle: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    },
    shareSummary:
      'Start at Willow Court Wine Bar, peak at Theatre District Jazz Cellar, then wind down at Hedley Club Lounge.',
  }
}

function buildArtifact(params: {
  runtimeRouteArtifact?: RuntimeRouteArtifact
  approvedPayload?: unknown
}): ContractEntryArtifact {
  return {
    id: ARTIFACT_ID,
    sourceOpportunityId: 'opportunity:curate-green-path:willow-court',
    sourceMode: 'curated',
    anchorVenueId: 'sj-theatre-district-jazz-cellar',
    anchorRole: 'highlight',
    anchorName: 'Theatre District Jazz Cellar',
    routeTitle: 'Willow Court to Jazz Cellar',
    flavorLine: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    routeSummary:
      'A deterministic three-stop Curate route from Willow Court Wine Bar to Theatre District Jazz Cellar and Hedley Club Lounge.',
    traits: ['intimate', 'local', 'music-led'],
    storySpine: {
      start: 'Willow Court Wine Bar',
      highlight: 'Theatre District Jazz Cellar',
      windDown: 'Hedley Club Lounge',
    },
    districtLine: 'Willow Glen into Downtown San Jose',
    districtAnchorLine: 'District anchor: Theatre District Jazz Cellar',
    authorityLine: 'Approved local Curate green path.',
    whyChooseLine: 'The route keeps the proven warmup, peak, and cooldown identities intact.',
    whyTonightProofLine: 'Local-only regression fixture; no live provider required.',
    selection: {
      directionId: SELECTED_DIRECTION_ID,
      pocketId: 'willow-court-jazz-cellar',
    },
    qualification: {
      status: params.approvedPayload ? 'committable' : 'checking',
      failedCheck: null,
      missingRoleForContract: null,
      hardCommitRequired: true,
      ...(params.approvedPayload ? { approvedRefinementEntryPayload: params.approvedPayload } : {}),
    },
    enrichment: {
      mode: 'curate',
      locationContext: {
        city: 'San Jose',
        neighborhood: 'Willow Glen / Downtown',
      },
      userInputContext: {
        starterPackId: STARTER_PACK_ID,
        primaryVibe: 'cozy',
        secondaryVibe: 'cultured',
        persona: 'romantic',
        anchorVenueId: 'sj-theatre-district-jazz-cellar',
        anchorName: 'Theatre District Jazz Cellar',
      },
      conciergeIntentSummary: {
        planningMode: 'curated',
        primaryVibe: 'cozy',
        persona: 'romantic',
        summary: 'Curate green-path regression for the Willow Court route.',
      },
      tasteDistrictSummary: {
        tasteProfileId: 'cozy-jazz-night',
        districtId: 'willow-court-jazz-cellar',
        districtLabel: 'Willow Glen / Downtown',
        summary: 'Wine, jazz, and lounge sequencing.',
      },
      fieldProvenanceSummary: {
        sourceMode: 'curated',
        provider: 'static-corpus',
        liveProviderUsed: false,
        corpusUsed: true,
        calibrationOnly: false,
        candidateCount: 5,
        queryLabels: [],
        provenanceId: 'local-curated-fixture',
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: 'bearings:curate-green-path:willow-court',
        summary: 'Canonical warmup, peak, and cooldown roles are represented.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'waypoint:curate-green-path:willow-court',
        summary: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge.',
      },
      canonicalRouteRoleCoverage: {
        start: 'Willow Court Wine Bar',
        highlight: 'Theatre District Jazz Cellar',
        windDown: 'Hedley Club Lounge',
        support: [
          {
            role: 'surprise',
            name: 'Willow Glen Tea Atelier',
            venueId: 'sj-willow-glen-tea-atelier',
          },
          {
            role: 'surprise',
            name: 'Bramhall Park Promenade',
            venueId: 'sj-bramhall-park-promenade',
          },
        ],
      },
      validationStatus: 'valid',
      rejectionReasons: [],
      starterContextFit: {
        status: 'passed',
        starterPackId: STARTER_PACK_ID,
        mode: 'curate',
        contextKey: `${STARTER_PACK_ID}:willow-court-jazz-cellar`,
        rejectionReasons: [],
      },
      modeContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'mode:curate',
        rejectionReasons: [],
      },
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        selectedDirectionId: SELECTED_DIRECTION_ID,
        rejectionReasons: [],
        ...(params.runtimeRouteArtifact ? { runtimeRouteArtifact: params.runtimeRouteArtifact } : {}),
        buildMetadata: {
          canBuildRuntimeRoute: true,
        },
      },
    },
  }
}

function buildStalePageLocalFinalRoute(route: RuntimeRouteArtifact): RuntimeRouteArtifact {
  return {
    ...route,
    routeId: 'page-local-obsolete-wrapper',
    selectedDirectionId: 'page-local-obsolete-direction',
    stops: route.stops.map((stop) => ({
      ...stop,
      venueId: `obsolete:${stop.venueId}`,
      providerRecordId: `obsolete:${stop.providerRecordId}`,
    })),
  }
}

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap
  const originalWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    location: {
      pathname: '/local-curate-green-path-regression',
      search: '',
    },
  }

  try {
    const starterPack = findStarterPack(STARTER_PACK_ID)
    const itinerary = buildWillowCourtItinerary()
    const scoredVenues = itinerary.stops.map((stop) => buildScoredVenue(findVenue(stop.venueId)))
    const preLockArtifact = buildArtifact({})

    assert(itinerary.stops.length === 5, 'Fixture must include support stops before lock.')
    assertCanonicalIds(orderedCoreIdsFromItinerary(itinerary), 'selected route')

    const lockTruth = buildContractEntryRuntimeRouteLockTruth({
      artifact: preLockArtifact,
      itinerary,
      scoredVenues,
      selectedDirectionId: SELECTED_DIRECTION_ID,
      selectedClusterConfirmation: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      city: 'San Jose',
      persona: 'romantic',
      vibe: 'cozy',
      mode: 'curate',
    })
    assert(lockTruth.ok, `Lock handoff must produce RuntimeRouteArtifact (${lockTruth.ok ? 'ok' : lockTruth.reason}).`)
    assert(lockTruth.lockSafeItineraryStops.length === 3, 'Lock handoff must keep exactly 3 canonical stops.')
    assert(lockTruth.finalRoute.stops.length === 3, 'RuntimeRouteArtifact finalRoute must contain exactly 3 stops.')
    assertCanonicalIds(orderedIdsFromFinalRoute(lockTruth.finalRoute), 'lock handoff finalRoute')

    const approvedPayload = {
      starterPackId: STARTER_PACK_ID,
      ...buildCurateRefinementEntryPayload({
        artifactId: ARTIFACT_ID,
        selectedDirectionId: SELECTED_DIRECTION_ID,
        selectedArtifactLineageSummary: 'ContractEntryArtifact -> RuntimeRouteArtifact',
        previewRouteTitle: 'Willow Court to Jazz Cellar',
        planSnapshot: {
          source: 'local-deterministic-fixture',
          routeIds: CANONICAL_ROUTE_IDS,
        },
        finalRoute: lockTruth.finalRoute,
        canonicalStopByRole: {
          start: 'sj-willow-court-wine-bar',
          highlight: 'sj-theatre-district-jazz-cellar',
          windDown: 'sj-hedley-club-lounge',
        },
        rejectedStopRoles: [],
      }),
    }
    const artifact = buildArtifact({
      runtimeRouteArtifact: lockTruth.finalRoute,
      approvedPayload,
    })
    const pageLocalFinalRoute = buildStalePageLocalFinalRoute(lockTruth.finalRoute)

    const publicFlowTruth = buildCanonicalPublicRouteFlowTruth(artifact, {
      mode: 'curate',
      starterPack,
    })
    assert(publicFlowTruth.allowed, 'Canonical public route flow truth must allow the artifact.')
    assert(publicFlowTruth.visibleCard?.allowedToRender === true, 'Visible card must be artifact-approved.')
    assert(publicFlowTruth.review !== null, 'Review projection must exist.')
    assert(publicFlowTruth.lock?.runtimeRouteArtifact === lockTruth.finalRoute, 'Lock projection must preserve RuntimeRouteArtifact authority.')
    assert(publicFlowTruth.lock.runtimeRouteArtifact !== pageLocalFinalRoute, 'Lock projection must not use a page-local finalRoute wrapper.')
    assert(publicFlowTruth.plans?.artifactId === ARTIFACT_ID, 'Plans projection must derive from the selected artifact.')

    const approvedPayloadTruth = validatePublicCurateApprovedPayloadTruth({
      selectedStarterPack: starterPack,
      artifact,
      approvedRefinementEntryPayload: approvedPayload,
    })
    assert(approvedPayloadTruth.allowedToRender, 'Approved payload truth must allow the canonical route.')
    assert(approvedPayloadTruth.finalRoutePresent, 'Approved payload must carry finalRoute.')
    assertCanonicalNames(orderedNamesFromProjectionStops(approvedPayloadTruth.routeStops), 'approved payload finalRoute')
    assertCanonicalIds(orderedIdsFromFinalRoute(approvedPayload.finalRoute), 'approved payload finalRoute')

    const cardTruth = buildPublicCurateCardTruthModel({
      selectedStarterPack: starterPack,
      artifactCandidates: [artifact],
      selectedArtifactId: artifact.id,
      qualificationByArtifactId: {
        [artifact.id]: {
          status: 'committable',
          hasApprovedPayload: true,
          approvedRefinementEntryPayload: approvedPayload,
        },
      },
      committedRouteFallbackRenderEnabled: false,
    })
    assert(cardTruth.selectedCard?.allowedToRender === true, 'Selected card must be approved-payload-backed.')
    assert(cardTruth.approvedRefinementEntryPayload === approvedPayload, 'Selected card must carry the approved payload.')
    assert(cardTruth.reviewModel?.allowedToRender === true, 'Review CTA model must be approved-payload-backed.')
    assert(cardTruth.lockLiveModel?.allowedToRender === true, 'Lock model must be approved-payload-backed.')
    assert(cardTruth.plansHubPayload?.allowedToRender === true, 'Plans model must be approved-payload-backed.')
    assertCanonicalNames(orderedNamesFromProjectionStops(cardTruth.selectedRouteProjection?.routeStops ?? []), 'selected route projection')

    const lockedPayload = buildLockedLiveArtifactPayload({
      canonicalRouteArtifact: {
        selectedClusterConfirmation: lockTruth.selectedClusterConfirmation,
        itinerary: lockTruth.itinerary,
        finalRoute: lockTruth.finalRoute,
      },
      lockSafeItineraryStops: lockTruth.lockSafeItineraryStops,
      activeRole: 'start',
      fallbackCity: 'San Jose',
      lockedAt: 1_787_000_000_000,
      sessionId: 'curate-green-path-willow-court',
    })
    const payloadValidation = validateLockedLiveArtifactSessionPayload(lockedPayload)
    assert(
      payloadValidation.ok,
      `Locked payload must validate (${
        payloadValidation.ok ? 'ok' : `${payloadValidation.error.code}: ${payloadValidation.error.detail}`
      }).`,
    )
    const lockedFinalRoute = lockedPayload.finalRoute
    assert(lockedFinalRoute !== undefined, 'Locked payload must include RuntimeRouteArtifact finalRoute.')
    assertCanonicalIds(orderedIdsFromFinalRoute(lockedFinalRoute), 'RuntimeRouteArtifact payload')
    assert(lockedFinalRoute !== pageLocalFinalRoute, 'Locked payload must not use page-local finalRoute wrapper.')
    assert(lockedPayload.itinerary.stops.length === 3, 'Locked payload itinerary must not promote support stops.')

    saveSharedLiveArtifactPlan('curate-green-path-willow-court', lockedPayload)
    const reopenedPlan = loadSharedLiveArtifactPlan('curate-green-path-willow-court')
    const reopenedFinalRoute = reopenedPlan?.finalRoute
    assert(reopenedFinalRoute !== undefined, 'Plans projection must reopen a RuntimeRouteArtifact-backed payload.')
    assertCanonicalIds(orderedIdsFromFinalRoute(reopenedFinalRoute), 'Plans projection finalRoute')
    assert(reopenedFinalRoute.routeId === lockTruth.finalRoute.routeId, 'Plans projection must preserve RuntimeRouteArtifact routeId.')

    const preview = buildPreviewFromFinalRoute(reopenedFinalRoute)
    assert(preview.directionId === SELECTED_DIRECTION_ID, 'Plans preview must derive selectedDirectionId from RuntimeRouteArtifact.')
    assertCanonicalNames(
      preview.stops.map((stop) => stop.name),
      'RuntimeRouteArtifact preview',
    )

    const fieldProxyHits = fetchCalls.filter((url) => url.includes(FIELD_PROXY_PATH)).length
    const browserProviderHits = fetchCalls.filter((url) => /google|places|provider|text-search/i.test(url)).length
    const lceProviderHits = fetchCalls.filter((url) => /keep-the-night|continuation|lce/i.test(url)).length
    assert(fetchCalls.length === 0, `Expected no live provider calls, fetch called ${fetchCalls.length} time(s).`)
    assert(fieldProxyHits === 0, `Expected no ${FIELD_PROXY_PATH} calls, received ${fieldProxyHits}.`)
    assert(browserProviderHits === 0, `Expected browser provider hits = 0, received ${browserProviderHits}.`)
    assert(lceProviderHits === 0, `Expected LCE provider hits = 0, received ${lceProviderHits}.`)

    process.stdout.write('curate green-path regression: passed\n')
    process.stdout.write(
      `${JSON.stringify(
        {
          routeIds: CANONICAL_ROUTE_IDS,
          approvedPayloadBacked: cardTruth.selectedCard.allowedToRender,
          runtimeRouteStopCount: lockTruth.finalRoute.stops.length,
          supportStopsPromoted: false,
          fetchCallCount: fetchCalls.length,
          fieldProxyHits,
          browserProviderHits,
          lceProviderHits,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    ;(globalThis as { window?: unknown }).window = originalWindow
    globalThis.fetch = originalFetch
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
