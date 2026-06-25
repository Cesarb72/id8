import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
  type RouteAuthorityObservedSource,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { buildCurateRefinementEntryPayload } from '../src/app/wrapper/curateRefinementEntry.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { SelectedRouteArtifact } from '../src/domain/artifacts/selectedRouteArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole, UserStopTitle } from '../src/domain/types/itinerary.ts'

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

const originalFetch = globalThis.fetch
const fetchCalls: string[] = []

const fetchTrap: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  fetchCalls.push(url)
  throw new Error(`Route authority shadow test must not call fetch: ${url}`)
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertSameSequence(actual: readonly string[], expected: readonly string[], label: string): void {
  assert(
    actual.join('|') === expected.join('|'),
    `${label} mismatch. Expected ${expected.join(' -> ')}, received ${actual.join(' -> ')}.`,
  )
}

function sourceByKind(
  sources: RouteAuthorityObservedSource[],
  kind: RouteAuthorityObservedSource['kind'],
): RouteAuthorityObservedSource {
  const source = sources.find((candidate) => candidate.kind === kind)
  assert(source !== undefined, `Missing observed source: ${kind}`)
  return source
}

function titleForRole(role: UserStopRole): UserStopTitle {
  if (role === 'windDown') {
    return 'Wind Down'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Start'
}

function buildStop(params: {
  venueId: string
  displayName: string
  role: UserStopRole
  stopIndex: number
}): RuntimeRouteStop {
  return {
    id: `runtime-stop:${params.venueId}`,
    sourceStopId: `source-stop:${params.venueId}`,
    displayName: params.displayName,
    providerRecordId: `provider:${params.venueId}`,
    latitude: 37.33 + params.stopIndex * 0.001,
    longitude: -121.89 - params.stopIndex * 0.001,
    address: `${100 + params.stopIndex} Fixture Way, San Jose, CA`,
    role: params.role,
    stopIndex: params.stopIndex,
    venueId: params.venueId,
    title: titleForRole(params.role),
    subtitle: `${params.displayName} fixture stop`,
    neighborhood: 'San Jose',
    driveMinutes: 6,
    imageUrl: `https://example.invalid/${params.venueId}.jpg`,
  }
}

function buildRuntimeRoute(
  overrides: Partial<Record<UserStopRole, Partial<RuntimeRouteStop>>> = {},
): RuntimeRouteArtifact {
  const stops = [
    buildStop({
      venueId: CANONICAL_ROUTE_IDS[0],
      displayName: CANONICAL_ROUTE_NAMES[0],
      role: 'start',
      stopIndex: 0,
    }),
    buildStop({
      venueId: CANONICAL_ROUTE_IDS[1],
      displayName: CANONICAL_ROUTE_NAMES[1],
      role: 'highlight',
      stopIndex: 1,
    }),
    buildStop({
      venueId: CANONICAL_ROUTE_IDS[2],
      displayName: CANONICAL_ROUTE_NAMES[2],
      role: 'windDown',
      stopIndex: 2,
    }),
  ].map((stop) => ({
    ...stop,
    ...(overrides[stop.role] ?? {}),
  }))

  return {
    routeId: 'runtime-route:curate-green-path:willow-court',
    selectedDirectionId: SELECTED_DIRECTION_ID,
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Willow Court to Jazz Cellar',
    routeSummary:
      'Start at Willow Court Wine Bar, peak at Theatre District Jazz Cellar, and land at Hedley Club Lounge.',
    mapMarkers: stops.map((stop) => ({
      id: `marker:${stop.venueId}`,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1_787_000_000_000,
  }
}

function buildItineraryStop(params: {
  venueId: string
  venueName: string
  role: UserStopRole
  index: number
}): ItineraryStop {
  return {
    id: `source-stop:${params.venueId}`,
    role: params.role,
    title: titleForRole(params.role),
    venueId: params.venueId,
    venueName: params.venueName,
    formattedAddress: `${100 + params.index} Fixture Way, San Jose, CA`,
    latitude: 37.33 + params.index * 0.001,
    longitude: -121.89 - params.index * 0.001,
    city: 'San Jose',
    category: params.role === 'highlight' ? 'live_music' : 'bar',
    subcategory: 'Fixture',
    priceTier: '$$',
    tags: ['local', 'fixture'],
    vibeTags: ['cozy'],
    neighborhood: 'San Jose',
    driveMinutes: 6,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: `${params.venueName} fixture stop`,
    imageUrl: `https://example.invalid/${params.venueId}.jpg`,
    stopInsider: {
      roleReason: `${params.venueName} holds the ${params.role} role.`,
      localSignal: 'Local fixture.',
      selectionReason: 'Route authority shadow test fixture.',
    },
  }
}

function buildItinerary(): Itinerary {
  const stops = [
    buildItineraryStop({
      venueId: CANONICAL_ROUTE_IDS[0],
      venueName: CANONICAL_ROUTE_NAMES[0],
      role: 'start',
      index: 0,
    }),
    buildItineraryStop({
      venueId: CANONICAL_ROUTE_IDS[1],
      venueName: CANONICAL_ROUTE_NAMES[1],
      role: 'highlight',
      index: 1,
    }),
    buildItineraryStop({
      venueId: CANONICAL_ROUTE_IDS[2],
      venueName: CANONICAL_ROUTE_NAMES[2],
      role: 'windDown',
      index: 2,
    }),
  ]

  return {
    id: 'itinerary:curate-green-path:willow-court',
    title: 'Willow Court to Jazz Cellar',
    city: 'San Jose',
    neighborhood: 'Willow Glen / Downtown',
    crew: 'romantic',
    vibes: ['cozy'],
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

function buildArtifact(runtimeRouteArtifact?: RuntimeRouteArtifact): ContractEntryArtifact {
  return {
    id: ARTIFACT_ID,
    sourceOpportunityId: 'opportunity:curate-green-path:willow-court',
    sourceMode: 'curated',
    anchorVenueId: CANONICAL_ROUTE_IDS[1],
    anchorRole: 'highlight',
    anchorName: CANONICAL_ROUTE_NAMES[1],
    routeTitle: 'Willow Court to Jazz Cellar',
    flavorLine: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    routeSummary:
      'A deterministic Curate route from Willow Court Wine Bar to Theatre District Jazz Cellar and Hedley Club Lounge.',
    traits: ['intimate', 'local', 'music-led'],
    storySpine: {
      start: CANONICAL_ROUTE_NAMES[0],
      highlight: CANONICAL_ROUTE_NAMES[1],
      windDown: CANONICAL_ROUTE_NAMES[2],
    },
    districtLine: 'Willow Glen into Downtown San Jose',
    districtAnchorLine: `District anchor: ${CANONICAL_ROUTE_NAMES[1]}`,
    authorityLine: 'Approved local Curate green path.',
    whyChooseLine: 'The route keeps the proven warmup, peak, and cooldown identities intact.',
    whyTonightProofLine: 'Local-only regression fixture; no live provider required.',
    selection: {
      directionId: SELECTED_DIRECTION_ID,
      pocketId: 'willow-court-jazz-cellar',
    },
    enrichment: {
      mode: 'curate',
      locationContext: {
        city: 'San Jose',
        neighborhood: 'Willow Glen / Downtown',
      },
      userInputContext: {
        starterPackId: 'cozy-jazz-night',
        primaryVibe: 'cozy',
        secondaryVibe: 'cultured',
        persona: 'romantic',
        anchorVenueId: CANONICAL_ROUTE_IDS[1],
        anchorName: CANONICAL_ROUTE_NAMES[1],
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
        candidateCount: 3,
        queryLabels: [],
        provenanceId: 'local-route-authority-fixture',
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
        start: CANONICAL_ROUTE_NAMES[0],
        highlight: CANONICAL_ROUTE_NAMES[1],
        windDown: CANONICAL_ROUTE_NAMES[2],
        support: [
          {
            role: 'start',
            name: CANONICAL_ROUTE_NAMES[0],
            venueId: CANONICAL_ROUTE_IDS[0],
          },
          {
            role: 'highlight',
            name: CANONICAL_ROUTE_NAMES[1],
            venueId: CANONICAL_ROUTE_IDS[1],
          },
          {
            role: 'windDown',
            name: CANONICAL_ROUTE_NAMES[2],
            venueId: CANONICAL_ROUTE_IDS[2],
          },
        ],
      },
      validationStatus: 'valid',
      rejectionReasons: [],
      starterContextFit: {
        status: 'passed',
        starterPackId: 'cozy-jazz-night',
        mode: 'curate',
        contextKey: 'cozy-jazz-night:willow-court-jazz-cellar',
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
        ...(runtimeRouteArtifact ? { runtimeRouteArtifact } : {}),
        buildMetadata: {
          canBuildRuntimeRoute: true,
        },
      },
    },
  }
}

function buildSelectedRouteArtifact(finalRoute: RuntimeRouteArtifact): SelectedRouteArtifact<{
  finalRoute: RuntimeRouteArtifact
}> {
  return {
    source: 'committed',
    directionId: SELECTED_DIRECTION_ID,
    candidateArtifactId: ARTIFACT_ID,
    canonicalRouteArtifact: {
      finalRoute,
    },
    activeHighlight: {
      provenance: 'committed_runtime_route',
      activeName: CANONICAL_ROUTE_NAMES[1],
      activeVenueId: CANONICAL_ROUTE_IDS[1],
      activeStopId: `runtime-stop:${CANONICAL_ROUTE_IDS[1]}`,
    },
    preview: {
      directionId: SELECTED_DIRECTION_ID,
      headline: 'Willow Court to Jazz Cellar',
      tone: 'Wine, jazz, and lounge sequencing.',
      stops: [
        { role: 'start', name: CANONICAL_ROUTE_NAMES[0] },
        { role: 'highlight', name: CANONICAL_ROUTE_NAMES[1] },
        { role: 'windDown', name: CANONICAL_ROUTE_NAMES[2] },
      ],
      continuityLine: 'Local deterministic fixture.',
    },
    routeTitle: 'Willow Court to Jazz Cellar',
    routeSummary: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    districtLine: 'Willow Glen into Downtown San Jose',
    districtAnchorLine: `District anchor: ${CANONICAL_ROUTE_NAMES[1]}`,
    authorityLine: 'Compatibility projection only.',
    whyChooseLine: 'The route keeps the canonical IDs visible.',
  }
}

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap

  try {
    const runtimeRoute = buildRuntimeRoute()
    const itinerary = buildItinerary()
    const artifact = buildArtifact(runtimeRoute)
    const approvedPayload = buildCurateRefinementEntryPayload({
      artifactId: ARTIFACT_ID,
      selectedDirectionId: SELECTED_DIRECTION_ID,
      selectedArtifactLineageSummary: 'ContractEntryArtifact -> RuntimeRouteArtifact',
      previewRouteTitle: 'Willow Court to Jazz Cellar',
      planSnapshot: {
        source: 'local-route-authority-shadow-test',
      },
      finalRoute: runtimeRoute,
      canonicalStopByRole: {
        start: CANONICAL_ROUTE_IDS[0],
        highlight: CANONICAL_ROUTE_IDS[1],
        windDown: CANONICAL_ROUTE_IDS[2],
      },
      rejectedStopRoles: [],
    })
    const selectedRouteArtifact = buildSelectedRouteArtifact(runtimeRoute)

    const greenSnapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: artifact,
      selectedDirectionId: SELECTED_DIRECTION_ID,
      selectedArtifactId: ARTIFACT_ID,
      approvedPayload,
      legacyCurateRefinementEntryPayload: approvedPayload,
      legacySelectedRouteArtifact: selectedRouteArtifact,
      pageLocalFinalRoute: runtimeRoute,
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })

    assert(greenSnapshot.validationStatus === 'valid', 'Willow Court snapshot must be valid.')
    assert(greenSnapshot.lockReadyCanonicalRouteTruthCandidate !== null, 'Canonical runtime truth must become lock-ready.')
    assertSameSequence(greenSnapshot.canonicalRouteIds, CANONICAL_ROUTE_IDS, 'canonical route IDs')
    assert(
      sourceByKind(greenSnapshot.observedSources, 'contract_entry_artifact').classification ===
        'canonical_authority',
      'ContractEntryArtifact must be canonical authority.',
    )
    assert(
      sourceByKind(greenSnapshot.observedSources, 'runtime_route_artifact').classification ===
        'canonical_authority',
      'RuntimeRouteArtifact must be canonical authority.',
    )
    assert(
      sourceByKind(greenSnapshot.observedSources, 'approved_payload').classification ===
        'validated_compatibility',
      'Approved payload must be a validated compatibility source.',
    )
    assert(
      sourceByKind(greenSnapshot.observedSources, 'legacy_curate_refinement_entry_payload').classification ===
        'legacy_compatibility',
      'CurateRefinementEntryPayload must be classified as legacy compatibility.',
    )
    assert(
      sourceByKind(greenSnapshot.observedSources, 'legacy_curate_refinement_entry_payload').mismatchReasons.length ===
        0,
      'Matching CurateRefinementEntryPayload must validate against ContractEntryArtifact.',
    )
    assert(
      sourceByKind(greenSnapshot.observedSources, 'legacy_selected_route_artifact').classification ===
        'legacy_compatibility',
      'SelectedRouteArtifact must be classified as legacy compatibility.',
    )
    assert(
      sourceByKind(greenSnapshot.observedSources, 'page_local_final_route').classification ===
        'page_local_authoring',
      'page-local finalRoute must be classified as page-local authoring.',
    )

    const runtimeLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: greenSnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(runtimeLockInput.ok, 'Runtime-backed route authority snapshot must build lock input.')
    assert(
      runtimeLockInput.diagnostics.lockInputSource === 'contract_entry_artifact.runtime_route_artifact',
      'Runtime-backed lock input must identify canonical runtime authority.',
    )
    assertSameSequence(
      runtimeLockInput.input.lockSafeItineraryStops.map((stop) => stop.venueId),
      CANONICAL_ROUTE_IDS,
      'runtime-backed lock input IDs',
    )

    const preLockSnapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: buildArtifact(),
      selectedDirectionId: SELECTED_DIRECTION_ID,
      selectedArtifactId: ARTIFACT_ID,
      approvedPayload,
      legacyCurateRefinementEntryPayload: approvedPayload,
      pageLocalFinalRoute: runtimeRoute,
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })
    const preLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: preLockSnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(preLockInput.ok, 'Pre-lock ContractEntryArtifact plus approved payload must build lock input.')
    assert(
      preLockInput.diagnostics.lockInputSource === 'contract_entry_artifact.approved_payload',
      'Pre-lock lock input must identify approved payload canonical authority.',
    )
    assert(preLockInput.diagnostics.builtFromCanonicalAuthority, 'Lock input must be canonical-authority-backed.')
    assert(preLockInput.diagnostics.legacyInputsObserved, 'Legacy/page-local sources should be observed in diagnostics.')
    assert(
      preLockInput.diagnostics.legacyInputsMatchedCanonicalTruth === true,
      'Matching legacy/page-local sources should be diagnosed as matching canonical truth.',
    )
    assertSameSequence(
      preLockInput.input.lockSafeItineraryStops.map((stop) => stop.venueId),
      CANONICAL_ROUTE_IDS,
      'pre-lock lock input IDs',
    )

    const renamedRuntimeRoute = buildRuntimeRoute({
      start: {
        displayName: 'Renamed Willow Court Fixture',
      },
      highlight: {
        displayName: 'Renamed Jazz Fixture',
      },
      windDown: {
        displayName: 'Renamed Hedley Fixture',
      },
    })
    const idFirstSnapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: buildArtifact(renamedRuntimeRoute),
      runtimeRouteArtifact: renamedRuntimeRoute,
      approvedPayload: {
        artifactId: ARTIFACT_ID,
        selectedDirectionId: SELECTED_DIRECTION_ID,
        finalRoute: renamedRuntimeRoute,
      },
    })
    assert(idFirstSnapshot.validationStatus === 'valid', 'Stable IDs must validate even if display names drift.')
    assertSameSequence(idFirstSnapshot.canonicalRouteIds, CANONICAL_ROUTE_IDS, 'ID-first canonical route IDs')

    const staleApprovedPayloadRoute = buildRuntimeRoute({
      highlight: {
        venueId: 'sj-stale-theatre-district-jazz-cellar',
        providerRecordId: 'provider:sj-stale-theatre-district-jazz-cellar',
        sourceStopId: 'source-stop:sj-stale-theatre-district-jazz-cellar',
        displayName: CANONICAL_ROUTE_NAMES[1],
      },
    })
    const stalePayloadSnapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: buildArtifact(),
      approvedPayload: {
        artifactId: ARTIFACT_ID,
        selectedDirectionId: SELECTED_DIRECTION_ID,
        finalRoute: staleApprovedPayloadRoute,
      },
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })
    assert(stalePayloadSnapshot.validationStatus === 'invalid', 'Stale approved payload route must be invalid.')
    assert(
      stalePayloadSnapshot.rejectionReasons.includes('approved_payload_route_mismatch'),
      'Stale approved payload must report approved_payload_route_mismatch.',
    )
    const staleLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: stalePayloadSnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(!staleLockInput.ok, 'Stale approved payload must not build lock input.')
    assert(
      staleLockInput.diagnostics.rejectionReason === 'approved_payload_route_mismatch',
      'Stale lock input rejection must preserve approved_payload_route_mismatch.',
    )

    const staleLegacyPayload = {
      ...approvedPayload,
      finalRoute: staleApprovedPayloadRoute,
    }
    const staleLegacySnapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: artifact,
      approvedPayload,
      legacyCurateRefinementEntryPayload: staleLegacyPayload,
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })
    assert(
      sourceByKind(
        staleLegacySnapshot.observedSources,
        'legacy_curate_refinement_entry_payload',
      ).mismatchReasons.includes('legacy_curate_refinement_entry_payload_highlight_id_mismatch'),
      'Stale CurateRefinementEntryPayload finalRoute must be flagged as a legacy mismatch.',
    )
    const staleLegacyLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: staleLegacySnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(staleLegacyLockInput.ok, 'Stale legacy payload must not block canonical lock input.')
    assert(
      staleLegacyLockInput.diagnostics.lockInputSource === 'contract_entry_artifact.runtime_route_artifact',
      'Stale legacy payload must not become the lock input source.',
    )

    const legacyOnlySnapshot = buildRouteAuthoritySnapshot({
      legacyCurateRefinementEntryPayload: approvedPayload,
      legacySelectedRouteArtifact: selectedRouteArtifact,
      pageLocalFinalRoute: runtimeRoute,
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })
    assert(
      legacyOnlySnapshot.lockReadyCanonicalRouteTruthCandidate === null,
      'Legacy/page-local-only inputs must not become lock-ready authority.',
    )
    assert(
      legacyOnlySnapshot.rejectionReasons.includes('legacy_sources_cannot_author_lock_ready_truth'),
      'Legacy/page-local-only inputs must explain why lock-ready truth is unavailable.',
    )
    const legacyOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: legacyOnlySnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(!legacyOnlyLockInput.ok, 'Legacy/page-local-only snapshot must not build lock input.')
    assert(
      legacyOnlyLockInput.diagnostics.lockInputSource === null,
      'Legacy/page-local-only lock input must not identify an authority source.',
    )

    const selectedRouteOnlySnapshot = buildRouteAuthoritySnapshot({
      legacySelectedRouteArtifact: selectedRouteArtifact,
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })
    const selectedRouteOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: selectedRouteOnlySnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(!selectedRouteOnlyLockInput.ok, 'SelectedRouteArtifact alone must not build lock input.')

    const pageLocalOnlySnapshot = buildRouteAuthoritySnapshot({
      pageLocalFinalRoute: runtimeRoute,
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })
    const pageLocalOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: pageLocalOnlySnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(!pageLocalOnlyLockInput.ok, 'Page-local finalRoute alone must not build lock input.')

    const legacyCurateOnlySnapshot = buildRouteAuthoritySnapshot({
      legacyCurateRefinementEntryPayload: approvedPayload,
      selectedClusterConfirmation:
        'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      itinerary,
    })
    const legacyCurateOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: legacyCurateOnlySnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(!legacyCurateOnlyLockInput.ok, 'CurateRefinementEntryPayload alone must not build lock input.')

    const idMismatchRuntimeRoute = buildRuntimeRoute({
      highlight: {
        venueId: 'sj-wrong-jazz-cellar-id',
        providerRecordId: 'provider:sj-wrong-jazz-cellar-id',
        sourceStopId: 'source-stop:sj-wrong-jazz-cellar-id',
        displayName: CANONICAL_ROUTE_NAMES[1],
      },
    })
    const idMismatchSnapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: buildArtifact(idMismatchRuntimeRoute),
      runtimeRouteArtifact: idMismatchRuntimeRoute,
    })
    assert(idMismatchSnapshot.validationStatus === 'invalid', 'ID mismatch must fail even when names match.')
    assert(
      idMismatchSnapshot.mismatchReasons.includes('runtime_route_artifact_highlight_id_mismatch'),
      'ID mismatch must be reported as runtime_route_artifact_highlight_id_mismatch.',
    )

    assert(fetchCalls.length === 0, `Expected no provider/fetch calls, received ${fetchCalls.length}.`)

    process.stdout.write('route authority shadow seam: passed\n')
    process.stdout.write(
      `${JSON.stringify(
        {
          routeIds: greenSnapshot.canonicalRouteIds,
          sourceLabel: greenSnapshot.sourceLabel,
          validationStatus: greenSnapshot.validationStatus,
          lockInputSource: preLockInput.diagnostics.lockInputSource,
          observedSources: greenSnapshot.observedSources.map((source) => ({
            kind: source.kind,
            classification: source.classification,
            present: source.present,
          })),
          fetchCallCount: fetchCalls.length,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
