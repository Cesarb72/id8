import {
  buildCanonicalPublicRouteFlowTruth,
  validatePublicContractEntryArtifactTruth,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import {
  buildRouteRecommendationLifecycleDiagnostics,
} from '../src/app/services/routeRecommendationLifecycle.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { buildContractEntryRuntimeRouteLockTruth } from '../src/app/services/live/contractEntryLockHandoff.ts'
import { sanJoseVenues } from '../src/data/venues.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import { getArcStopBaseVenueId } from '../src/domain/candidates/candidateIdentity.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import { GreatStopGateSelectionError } from '../src/domain/types/greatStopGate.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { IntentInput } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Great Stop lifecycle enforcement observer must not call fetch: ${url}`)
}) as typeof fetch

const ROUTE_IDS = {
  start: 'sj-willow-court-wine-bar',
  highlight: 'sj-theatre-district-jazz-cellar',
  windDown: 'sj-hedley-club-lounge',
} as const

const ROUTE_NAMES = {
  start: 'Willow Court Wine Bar',
  highlight: 'Theatre District Jazz Cellar',
  windDown: 'Hedley Club Lounge',
} as const

const SELECTED_DIRECTION_ID = 'curate:great-stop-lifecycle'
const ARTIFACT_ID = 'contract-entry:great-stop-lifecycle'
const STARTER_PACK = { id: 'cozy-jazz-night' } as never

function titleForRole(role: UserStopRole): string {
  return role === 'highlight' ? 'Highlight' : role === 'windDown' ? 'Wind Down' : 'Start'
}

function buildRuntimeStop(role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>, stopIndex: number): RuntimeRouteStop {
  const venueId = ROUTE_IDS[role]
  const displayName = ROUTE_NAMES[role]
  return {
    id: `runtime-stop:${venueId}`,
    sourceStopId: `source-stop:${venueId}`,
    displayName,
    providerRecordId: `provider:${venueId}`,
    latitude: 37.33 + stopIndex * 0.001,
    longitude: -121.89 - stopIndex * 0.001,
    address: `${100 + stopIndex} Fixture Way, San Jose, CA`,
    role,
    stopIndex,
    venueId,
    title: titleForRole(role),
    subtitle: `${displayName} fixture stop`,
    neighborhood: 'San Jose',
    driveMinutes: 6,
    imageUrl: `https://example.invalid/${venueId}.jpg`,
  }
}

function buildRuntimeRoute(): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', 0),
    buildRuntimeStop('highlight', 1),
    buildRuntimeStop('windDown', 2),
  ]
  return {
    routeId: 'runtime-route:great-stop-lifecycle',
    selectedDirectionId: SELECTED_DIRECTION_ID,
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Willow Court to Jazz Cellar',
    routeSummary: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    mapMarkers: stops.map((stop) => ({
      id: `marker:${stop.venueId}`,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1,
  }
}

function buildItineraryStop(role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>, index: number): ItineraryStop {
  const runtimeStop = buildRuntimeStop(role, index)
  return {
    id: runtimeStop.sourceStopId,
    role,
    title: titleForRole(role),
    venueId: runtimeStop.venueId,
    venueName: runtimeStop.displayName,
    formattedAddress: runtimeStop.address,
    latitude: runtimeStop.latitude,
    longitude: runtimeStop.longitude,
    city: 'San Jose',
    category: role === 'highlight' ? 'live_music' : 'bar',
    subcategory: 'Fixture',
    priceTier: '$$',
    tags: ['local', 'fixture'],
    vibeTags: ['cozy'],
    neighborhood: 'San Jose',
    driveMinutes: runtimeStop.driveMinutes,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: runtimeStop.subtitle,
    imageUrl: runtimeStop.imageUrl,
    stopInsider: {
      roleReason: `${runtimeStop.displayName} holds the ${role} role.`,
      localSignal: 'Local fixture.',
      selectionReason: 'Great Stop lifecycle observer fixture.',
    },
  }
}

function buildItinerary(): Itinerary {
  return {
    id: 'itinerary:great-stop-lifecycle',
    title: 'Willow Court to Jazz Cellar',
    city: 'San Jose',
    neighborhood: 'Willow Glen / Downtown',
    crew: 'romantic',
    vibes: ['cozy'],
    stops: [
      buildItineraryStop('start', 0),
      buildItineraryStop('highlight', 1),
      buildItineraryStop('windDown', 2),
    ],
    transitions: [],
    totalRouteFriction: 0.16,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'Intimate, local, and music-led',
    story: {
      headline: 'Willow Court to Jazz Cellar',
      subtitle: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    },
    storySpine: {
      title: 'Willow Court to Jazz Cellar',
      phases: [],
      routeSummary: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    },
    shareSummary: 'Start at Willow Court Wine Bar, peak at Theatre District Jazz Cellar, then wind down at Hedley Club Lounge.',
  }
}

function buildScoredVenues(): ScoredVenue[] {
  return (['start', 'highlight', 'windDown'] as const).map((role, index) => {
    const runtimeStop = buildRuntimeStop(role, index)
    return {
      venue: {
        id: runtimeStop.venueId,
        name: runtimeStop.displayName,
        neighborhood: runtimeStop.neighborhood,
        source: {
          providerRecordId: runtimeStop.providerRecordId,
          formattedAddress: runtimeStop.address,
          latitude: runtimeStop.latitude,
          longitude: runtimeStop.longitude,
          sourceOrigin: 'curated',
        },
      },
    } as ScoredVenue
  })
}

function buildArtifact(status: 'PASS' | 'FAIL', runtimeRouteArtifact?: RuntimeRouteArtifact): ContractEntryArtifact {
  const failedCriteria = status === 'FAIL' ? ['place_right'] : []
  const greatStopReasons =
    status === 'FAIL'
      ? ['place_right:required_stop_survival_failed']
      : []
  return {
    id: ARTIFACT_ID,
    sourceOpportunityId: 'opportunity:great-stop-lifecycle',
    sourceMode: 'curated',
    anchorVenueId: ROUTE_IDS.highlight,
    anchorRole: 'highlight',
    anchorName: ROUTE_NAMES.highlight,
    routeTitle: 'Willow Court to Jazz Cellar',
    flavorLine: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    routeSummary: 'A deterministic Curate route for Great Stop lifecycle enforcement.',
    traits: ['intimate', 'local', 'music-led'],
    storySpine: ROUTE_NAMES,
    districtLine: 'Willow Glen into Downtown San Jose',
    districtAnchorLine: `District anchor: ${ROUTE_NAMES.highlight}`,
    authorityLine: 'Great Stop lifecycle fixture.',
    whyChooseLine: 'The route keeps canonical role identities intact.',
    whyTonightProofLine: 'Local-only observer fixture; no provider required.',
    selection: {
      directionId: SELECTED_DIRECTION_ID,
      pocketId: 'great-stop-lifecycle',
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
        persona: 'romantic',
        anchorVenueId: ROUTE_IDS.highlight,
        anchorName: ROUTE_NAMES.highlight,
      },
      conciergeIntentSummary: {
        planningMode: 'curated',
        primaryVibe: 'cozy',
        persona: 'romantic',
        summary: 'Great Stop lifecycle fixture.',
      },
      tasteDistrictSummary: {
        tasteProfileId: 'cozy:romantic',
        districtId: 'great-stop-lifecycle',
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
        provenanceId: 'local-great-stop-lifecycle-fixture',
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: 'bearings:great-stop-lifecycle',
        summary: 'Canonical warmup, peak, and cooldown roles are represented.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'waypoint:great-stop-lifecycle',
        summary: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge.',
      },
      canonicalRouteRoleCoverage: {
        start: ROUTE_NAMES.start,
        highlight: ROUTE_NAMES.highlight,
        windDown: ROUTE_NAMES.windDown,
        support: [
          { role: 'start', name: ROUTE_NAMES.start, venueId: ROUTE_IDS.start },
          { role: 'highlight', name: ROUTE_NAMES.highlight, venueId: ROUTE_IDS.highlight },
          { role: 'windDown', name: ROUTE_NAMES.windDown, venueId: ROUTE_IDS.windDown },
        ],
      },
      validationStatus: 'valid',
      rejectionReasons: [],
      starterContextFit: {
        status: 'passed',
        starterPackId: 'cozy-jazz-night',
        mode: 'curate',
        contextKey: 'cozy-jazz-night:great-stop-lifecycle',
        rejectionReasons: [],
      },
      modeContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'mode:curate',
        rejectionReasons: [],
      },
      runtimeLockEligibility: {
        eligible: status === 'PASS',
        status: status === 'PASS' ? 'eligible' : 'ineligible',
        rejectionReasons: status === 'PASS' ? [] : ['great_stop_failed'],
        selectedDirectionId: SELECTED_DIRECTION_ID,
        greatStopStatus: status,
        greatStopFailedCriteria: failedCriteria,
        greatStopRejectionReasons: greatStopReasons,
        ...(runtimeRouteArtifact ? { runtimeRouteArtifact } : {}),
        buildMetadata: {
          canBuildRuntimeRoute: status === 'PASS',
        },
      },
    },
  }
}

function assertNegativeFailRoute(): void {
  const runtimeRoute = buildRuntimeRoute()
  const itinerary = buildItinerary()
  const artifact = buildArtifact('FAIL', runtimeRoute)
  const approvedPayload = {
    artifactId: ARTIFACT_ID,
    selectedDirectionId: SELECTED_DIRECTION_ID,
    finalRoute: runtimeRoute,
  }

  const artifactTruth = validatePublicContractEntryArtifactTruth(artifact, {
    mode: 'curate',
    starterPack: STARTER_PACK,
  })
  assert(!artifactTruth.allowedToRender, 'Great Stop FAIL artifact must not render as visible recommendation.')
  assert(
    artifactTruth.rejectionReasons.includes('runtime_lock_ineligible') &&
      artifactTruth.rejectionReasons.includes('great_stop_failed'),
    'Great Stop FAIL artifact must expose runtime lock ineligibility and great_stop_failed.',
  )

  const flowTruth = buildCanonicalPublicRouteFlowTruth(artifact, {
    mode: 'curate',
    starterPack: STARTER_PACK,
  })
  assert(!flowTruth.allowed, 'Great Stop FAIL route must not produce public flow truth.')
  assert(flowTruth.visibleCard === null, 'Great Stop FAIL route must not produce visible card projection.')
  assert(flowTruth.review === null, 'Great Stop FAIL route must not produce Review projection.')
  assert(flowTruth.lock === null, 'Great Stop FAIL route must not produce Lock projection.')

  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    runtimeRouteArtifact: runtimeRoute,
    approvedPayload,
    greatStopStatus: 'FAIL',
    selectedDirectionId: SELECTED_DIRECTION_ID,
    selectedArtifactId: ARTIFACT_ID,
    selectedClusterConfirmation: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
    itinerary,
  })
  assert(snapshot.validationStatus === 'invalid', 'Great Stop FAIL routeAuthority must be invalid.')
  assert(snapshot.lockReadyCanonicalRouteTruthCandidate === null, 'Great Stop FAIL must not become lock-ready.')
  assert(snapshot.rejectionReasons.includes('great_stop_failed'), 'routeAuthority must carry great_stop_failed.')
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!lockInput.ok, 'Great Stop FAIL must not build lock input.')
  assert(lockInput.diagnostics.rejectionReason === 'great_stop_failed', 'Lock input must reject fail-backed authority.')

  const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: true,
    finalRoutePresent: true,
    runtimeRouteArtifactPresent: true,
    greatStopStatus: 'FAIL',
    routeAuthorityStatus: 'valid',
    lockInputAvailable: true,
    reviewEligible: true,
    lockEligible: true,
  })
  assert(lifecycle.phase === 'great_stop_failed', 'Lifecycle Great Stop FAIL must outrank routeAuthority/runtime truth.')
  assert(!lifecycle.reviewEligible, 'Great Stop FAIL lifecycle must not be reviewable.')
  assert(!lifecycle.lockEligible, 'Great Stop FAIL lifecycle must not be lockable.')

  const lockTruth = buildContractEntryRuntimeRouteLockTruth({
    artifact,
    itinerary,
    scoredVenues: buildScoredVenues(),
    selectedDirectionId: SELECTED_DIRECTION_ID,
    selectedClusterConfirmation: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    mode: 'curate',
  })
  assert(!lockTruth.ok, 'Great Stop FAIL must not project committed RuntimeRouteArtifact truth.')
  assert(lockTruth.reason === 'great_stop_failed', 'Runtime lock truth must reject with great_stop_failed.')
}

function assertPositivePassRoute(): void {
  const runtimeRoute = buildRuntimeRoute()
  const itinerary = buildItinerary()
  const artifact = buildArtifact('PASS', runtimeRoute)
  const approvedPayload = {
    artifactId: ARTIFACT_ID,
    selectedDirectionId: SELECTED_DIRECTION_ID,
    finalRoute: runtimeRoute,
  }

  const artifactTruth = validatePublicContractEntryArtifactTruth(artifact, {
    mode: 'curate',
    starterPack: STARTER_PACK,
  })
  assert(
    artifactTruth.allowedToRender,
    `Great Stop PASS artifact must remain visible. reasons=${artifactTruth.rejectionReasons.join('|')}`,
  )

  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    runtimeRouteArtifact: runtimeRoute,
    approvedPayload,
    greatStopStatus: 'PASS',
    selectedDirectionId: SELECTED_DIRECTION_ID,
    selectedArtifactId: ARTIFACT_ID,
    selectedClusterConfirmation: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
    itinerary,
  })
  assert(snapshot.validationStatus === 'valid', 'Great Stop PASS routeAuthority must remain valid.')
  assert(snapshot.lockReadyCanonicalRouteTruthCandidate !== null, 'Great Stop PASS route must become lock-ready.')

  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(lockInput.ok, 'Great Stop PASS route must still build lock input.')

  const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: true,
    finalRoutePresent: true,
    runtimeRouteArtifactPresent: false,
    greatStopStatus: 'PASS',
    routeAuthorityStatus: 'valid',
    lockInputAvailable: true,
    reviewEligible: true,
    lockEligible: true,
  })
  assert(lifecycle.phase === 'authority_valid_lockable', 'Great Stop PASS lifecycle must remain lockable.')
  assert(lifecycle.reviewEligible, 'Great Stop PASS lifecycle must remain reviewable.')
  assert(lifecycle.lockEligible, 'Great Stop PASS lifecycle must remain lockable.')

  const lockTruth = buildContractEntryRuntimeRouteLockTruth({
    artifact,
    itinerary,
    scoredVenues: buildScoredVenues(),
    selectedDirectionId: SELECTED_DIRECTION_ID,
    selectedClusterConfirmation: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    mode: 'curate',
  })
  assert(lockTruth.ok, 'Great Stop PASS must still project committed RuntimeRouteArtifact truth.')
}

async function assertThinFailIsNonLockable(): Promise<{
  status: string
  lockEligible: boolean
  failedCriteria: string[]
  selectedStopBaseVenueIds: string[]
}> {
  const input: IntentInput = {
    mode: 'build',
    planningMode: 'user-led',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    city: 'San Jose',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    anchor: {
      venueId: 'sj-adega-wine-atelier',
      role: 'highlight',
    },
    discoveryPreferences: [
      {
        venueId: 'sj-adega-wine-atelier',
        role: 'highlight',
      },
    ],
  }
  let result: Awaited<ReturnType<typeof runGeneratePlan>> | undefined
  try {
    result = await runGeneratePlan(input, {
      seedVenues: sanJoseVenues,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
    })
  } catch (error) {
    if (!(error instanceof GreatStopGateSelectionError)) {
      throw error
    }
    const diagnostics = error.greatStopGateSelectionDiagnostics
    assert(
      diagnostics.status === 'FAIL',
      'Build THIN soft-gate exhaustion must expose structured FAIL diagnostics.',
    )
    assert(
      diagnostics.stage === 'pre_selection_gate',
      'Build THIN soft-gate exhaustion must fail before selected route commitment.',
    )
    return {
      status: diagnostics.status,
      lockEligible: false,
      failedCriteria: diagnostics.failedTopCandidateCriteria ?? [],
      selectedStopBaseVenueIds: [],
    }
  }
  const greatStop = result.trace.greatStopGateResult
  assert(greatStop, 'Build THIN route must expose formal Great Stop result.')
  assert(greatStop.status === 'FAIL', 'Build THIN observer expects current Adega formal Great Stop FAIL.')
  assert(
    result.contractEntryArtifact.enrichment?.runtimeLockEligibility?.eligible === false,
    'Build THIN Great Stop FAIL must mark runtime lock eligibility false.',
  )
  assert(
    result.contractEntryArtifact.enrichment?.runtimeLockEligibility?.rejectionReasons?.includes('great_stop_failed'),
    'Build THIN Great Stop FAIL must carry great_stop_failed rejection.',
  )
  const lockTruth = buildContractEntryRuntimeRouteLockTruth({
    artifact: result.contractEntryArtifact,
    itinerary: result.itinerary,
    scoredVenues: result.scoredVenues,
    selectedDirectionId: result.intentProfile.selectedDirectionContext?.directionId ?? 'thin-build',
    selectedClusterConfirmation: 'Build THIN generated route',
    city: result.itinerary.city,
    persona: result.intentProfile.persona ?? 'romantic',
    vibe: result.intentProfile.primaryAnchor,
    mode: 'build',
  })
  assert(!lockTruth.ok, 'Build THIN Great Stop FAIL must not build runtime lock truth.')
  assert(lockTruth.reason === 'great_stop_failed', 'Build THIN lock rejection must be great_stop_failed.')

  return {
    status: greatStop.status,
    lockEligible: result.contractEntryArtifact.enrichment.runtimeLockEligibility.eligible,
    failedCriteria: [...greatStop.failedCriteria],
    selectedStopBaseVenueIds: result.selectedArc.stops.map(getArcStopBaseVenueId),
  }
}

async function main(): Promise<void> {
  try {
    assertNegativeFailRoute()
    assertPositivePassRoute()
    const thin = await assertThinFailIsNonLockable()
    assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

    process.stdout.write('great stop lifecycle enforcement: passed\n')
    process.stdout.write(
      `${JSON.stringify(
        {
          observer: 'great_stop_lifecycle_enforcement',
          negativeFailRoute: {
            visibleRecommendation: false,
            reviewable: false,
            lockable: false,
            runtimeArtifactProduced: false,
          },
          positivePassRoute: {
            visibleRecommendation: true,
            reviewable: true,
            lockable: true,
            runtimeArtifactProduced: true,
          },
          buildThinFailRoute: thin,
          providerCalls: fetchCallCount,
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
