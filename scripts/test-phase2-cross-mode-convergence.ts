import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { buildLockedLiveArtifactPayload } from '../src/app/services/live/liveSessionHandoff.ts'
import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildFinalRoute } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import type { ContractEntryArtifact, ContractEntryArtifactMode } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import {
  sanitizeLiveArtifactSessionPayload,
  validateLockedLiveArtifactSessionPayload,
} from '../src/domain/live/validateLiveArtifact.ts'
import type { ConciergeIntent, ExperienceMode, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole, UserStopTitle } from '../src/domain/types/itinerary.ts'
import type { EngineSourceMode } from '../src/domain/types/sourceMode.ts'
import type { Venue } from '../src/domain/types/venue.ts'
import { curatedVenues } from '../src/data/venues.ts'

type ModeId = 'build' | 'surprise' | 'curate'

type FetchCounters = {
  fetchCallCount: number
  fieldProxyHits: number
  browserProviderHits: number
}

interface ModeFixtureConfig {
  mode: ModeId
  routeIds: {
    start: string
    highlight: string
    windDown: string
  }
  persona: PersonaMode
  vibe: VibeAnchor
  sourceMode: EngineSourceMode
  lockSource: 'runtime' | 'approved_payload'
  directionId: string
  artifactId: string
  sourceOpportunityId: string
  anchorRole: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  anchorVenueId: string
  includeHiddenSurprise?: boolean
}

interface ModeConvergenceProof {
  mode: ModeId
  conciergeIntentMode: ConciergeIntent['intentMode']
  objectivePrimary: ConciergeIntent['objective']['primary']
  strategyFamily: string
  routeAuthorityStatus: string
  lockInputAvailable: boolean
  lockInputSource: string | null
  runtimeRouteArtifactKeys: string[]
  runtimeRouteStopKeys: string[]
  routeIds: string[]
  finalRouteSourceCoverageComplete: boolean
  hiddenSurpriseCompanionPreserved: boolean | null
  livePayloadValidation: boolean
  livePayloadUsesFinalRoute: boolean
  plansPayloadUsesFinalRoute: boolean
  pageLocalOnlyLockReady: boolean
  legacySelectedRouteOnlyLockReady: boolean
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
const fetchCounters: FetchCounters = {
  fetchCallCount: 0,
  fieldProxyHits: 0,
  browserProviderHits: 0,
}

globalThis.fetch = (async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  fetchCounters.fetchCallCount += 1
  if (url.includes('/api/field/text-search')) {
    fetchCounters.fieldProxyHits += 1
  }
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    fetchCounters.browserProviderHits += 1
  }
  throw new Error(`Phase 2.5 convergence proof must not call fetch/providers: ${url}`)
}) as typeof fetch

const fixtures: ModeFixtureConfig[] = [
  {
    mode: 'build',
    routeIds: {
      start: 'sj-nirvana-soul',
      highlight: 'sj-paper-plane',
      windDown: 'sj-lincoln-avenue-deli',
    },
    persona: 'romantic',
    vibe: 'lively',
    sourceMode: 'curated',
    lockSource: 'runtime',
    directionId: 'phase2-cross-mode-build',
    artifactId: 'contract-entry:phase2-cross-mode:build',
    sourceOpportunityId: 'opportunity:phase2-cross-mode:build',
    anchorRole: 'highlight',
    anchorVenueId: 'sj-paper-plane',
  },
  {
    mode: 'surprise',
    routeIds: {
      start: 'sj-riverwalk-boardgame-cafe',
      highlight: 'sj-theatre-district-jazz-cellar',
      windDown: 'sj-willow-glen-bakehouse',
    },
    persona: 'romantic',
    vibe: 'lively',
    sourceMode: 'curated',
    lockSource: 'runtime',
    directionId: 'phase2-cross-mode-surprise',
    artifactId: 'contract-entry:phase2-cross-mode:surprise',
    sourceOpportunityId: 'opportunity:phase2-cross-mode:surprise',
    anchorRole: 'highlight',
    anchorVenueId: 'sj-theatre-district-jazz-cellar',
    includeHiddenSurprise: true,
  },
  {
    mode: 'curate',
    routeIds: {
      start: 'sj-willow-court-wine-bar',
      highlight: 'sj-theatre-district-jazz-cellar',
      windDown: 'sj-hedley-club-lounge',
    },
    persona: 'romantic',
    vibe: 'cozy',
    sourceMode: 'curated',
    lockSource: 'approved_payload',
    directionId: 'curate:green-path:willow-court',
    artifactId: 'contract-entry:phase2-cross-mode:curate',
    sourceOpportunityId: 'opportunity:phase2-cross-mode:curate',
    anchorRole: 'highlight',
    anchorVenueId: 'sj-theatre-district-jazz-cellar',
  },
]

try {
  const proofs = fixtures.map((fixture) => runModeConvergenceProof(fixture))
  assertSameRuntimeRouteShape(proofs)
  assert(fetchCounters.fetchCallCount === 0, 'Cross-mode convergence proof must make zero fetch calls.')
  assert(fetchCounters.fieldProxyHits === 0, 'Cross-mode convergence proof must not hit Field proxy.')
  assert(fetchCounters.browserProviderHits === 0, 'Cross-mode convergence proof must not hit browser providers.')

  process.stdout.write('phase2 cross-mode convergence: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        invariant:
          'routeAuthority -> lock input -> RuntimeRouteArtifact -> Live/Plans-compatible finalRoute',
        allowedLockSources: [
          'contract_entry_artifact.runtime_route_artifact',
          'contract_entry_artifact.approved_payload',
        ],
        proofs,
        providerValve: fetchCounters,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
}

function runModeConvergenceProof(config: ModeFixtureConfig): ModeConvergenceProof {
  const conciergeIntent = buildModeConciergeIntent(config)
  assertCompleteConciergeIntent(conciergeIntent, config.mode)
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-phase2-cross-mode-convergence',
  })
  assert(
    canonicalInterpretationBundle.contractConstraints.id.length > 0,
    `${config.mode} must build ContractConstraints.`,
  )
  assert(
    canonicalInterpretationBundle.experienceContract.persona === config.persona,
    `${config.mode} must preserve persona in ExperienceContract.`,
  )

  const itinerary = buildItinerary(config)
  const finalRoute = buildRuntimeRoute(config, itinerary)
  const artifact = buildArtifact({
    config,
    finalRoute,
    conciergeIntent,
    strategyFamily: canonicalInterpretationBundle.strategyFamily,
  })
  const approvedPayload =
    config.lockSource === 'approved_payload'
      ? {
          artifactId: artifact.id,
          selectedDirectionId: finalRoute.selectedDirectionId,
          finalRoute,
        }
      : null

  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    runtimeRouteArtifact: config.lockSource === 'runtime' ? finalRoute : null,
    approvedPayload,
    selectedDirectionId: finalRoute.selectedDirectionId,
    selectedArtifactId: artifact.id,
    selectedClusterConfirmation: `${config.mode} generated route is ready for Lock.`,
    itinerary,
    ...(config.mode === 'build'
      ? {
          buildContext: {
            mode: 'build' as const,
            selectedCandidateArtifact: null,
            selectedCandidateSourceKind: null,
            selectedAnchorVenueId: config.anchorVenueId,
            selectedAnchorRequiredRole: config.anchorRole,
            routeReplacementAdmitted: false,
          },
        }
      : {}),
  })
  assert(snapshot.validationStatus === 'valid', `${config.mode} routeAuthority must be valid.`)

  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(lockInput.ok, `${config.mode} lock input must be available.`)
  assert(
    lockInput.diagnostics.lockInputSource ===
      (config.lockSource === 'approved_payload'
        ? 'contract_entry_artifact.approved_payload'
        : 'contract_entry_artifact.runtime_route_artifact'),
    `${config.mode} lock input must use the expected canonical source.`,
  )
  assert(
    lockInput.diagnostics.builtFromCanonicalAuthority,
    `${config.mode} lock input must come through routeAuthority canonical truth.`,
  )

  const lockSafeSourceIds = new Set(lockInput.input.lockSafeItineraryStops.map((stop) => stop.id))
  const finalRouteSourceCoverageComplete = finalRoute.stops.every((stop) =>
    lockSafeSourceIds.has(stop.sourceStopId),
  )
  assert(
    finalRouteSourceCoverageComplete,
    `${config.mode} every finalRoute sourceStopId must have itinerary companion coverage.`,
  )

  const hiddenSurpriseCompanionPreserved =
    config.includeHiddenSurprise === true
      ? lockSafeSourceIds.has('surprise:wildcard_sj-jtown-ramen-ya')
      : null
  if (config.includeHiddenSurprise) {
    assert(
      hiddenSurpriseCompanionPreserved,
      'Surprise hidden wildcard companion must remain preserved post-lock.',
    )
  }

  const livePayload = buildLockedLiveArtifactPayload({
    ...lockInput.input,
    lockedAt: 1,
    sessionId: `phase2-cross-mode-${config.mode}`,
  })
  const livePayloadValidation = validateLockedLiveArtifactSessionPayload(livePayload)
  assert(livePayloadValidation.ok, `${config.mode} live payload must validate.`)
  const sanitizedPayload = sanitizeLiveArtifactSessionPayload(livePayload)
  assert(
    sanitizedPayload?.finalRoute?.routeId === finalRoute.routeId,
    `${config.mode} Live/Plans-compatible payload must preserve finalRoute routeId.`,
  )
  assert(
    routeIdsFromRuntimeRoute(sanitizedPayload.finalRoute).join('|') ===
      routeIdsFromRuntimeRoute(finalRoute).join('|'),
    `${config.mode} Live/Plans-compatible payload must use finalRoute, not itinerary fallback.`,
  )

  const pageLocalOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: buildRouteAuthoritySnapshot({
      pageLocalFinalRoute: buildStaleRoute(finalRoute),
      selectedClusterConfirmation: `${config.mode} stale page-local finalRoute.`,
      itinerary,
    }),
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!pageLocalOnlyLockInput.ok, `${config.mode} page-local finalRoute alone must not lock.`)

  const legacySelectedRouteOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: buildRouteAuthoritySnapshot({
      legacySelectedRouteArtifact: {
        source: 'legacy_selected_route_artifact',
        directionId: finalRoute.selectedDirectionId,
        candidateArtifactId: `legacy:${config.mode}`,
        canonicalRouteArtifact: {
          finalRoute: buildStaleRoute(finalRoute),
        },
      },
      selectedClusterConfirmation: `${config.mode} stale SelectedRouteArtifact.`,
      itinerary,
    }),
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(
    !legacySelectedRouteOnlyLockInput.ok,
    `${config.mode} legacy SelectedRouteArtifact alone must not lock.`,
  )

  return {
    mode: config.mode,
    conciergeIntentMode: conciergeIntent.intentMode,
    objectivePrimary: conciergeIntent.objective.primary,
    strategyFamily: canonicalInterpretationBundle.strategyFamily,
    routeAuthorityStatus: snapshot.validationStatus,
    lockInputAvailable: lockInput.ok,
    lockInputSource: lockInput.diagnostics.lockInputSource,
    runtimeRouteArtifactKeys: runtimeRouteArtifactKeys(finalRoute),
    runtimeRouteStopKeys: runtimeRouteStopKeys(finalRoute),
    routeIds: routeIdsFromRuntimeRoute(finalRoute),
    finalRouteSourceCoverageComplete,
    hiddenSurpriseCompanionPreserved,
    livePayloadValidation: livePayloadValidation.ok,
    livePayloadUsesFinalRoute: Boolean(sanitizedPayload?.finalRoute),
    plansPayloadUsesFinalRoute: Boolean(sanitizedPayload?.finalRoute),
    pageLocalOnlyLockReady: pageLocalOnlyLockInput.ok,
    legacySelectedRouteOnlyLockReady: legacySelectedRouteOnlyLockInput.ok,
  }
}

function buildModeConciergeIntent(config: ModeFixtureConfig): ConciergeIntent {
  return buildApplicationConciergeIntent({
    mode: config.mode as ExperienceMode,
    persona: config.persona,
    primaryVibe: config.vibe,
    city: 'San Jose',
    objectiveOccasion: config.mode === 'surprise' ? 'explore' : 'connect',
    anchor:
      config.mode === 'build'
        ? {
            venueId: config.anchorVenueId,
            role: config.anchorRole,
          }
        : null,
    anchorDisplayName: findVenue(config.anchorVenueId).name,
    candidateLineage: {
      source: config.mode === 'build' ? 'build_anchor' : config.mode === 'curate' ? 'starter_pack' : 'none',
      candidateArtifactId: config.artifactId,
    },
  })
}

function assertCompleteConciergeIntent(conciergeIntent: ConciergeIntent, mode: ModeId): void {
  assert(conciergeIntent.id.startsWith('cintent_v0_1'), `${mode} must produce ConciergeIntent.`)
  assert(Boolean(conciergeIntent.objective.primary), `${mode} ConciergeIntent objective must be populated.`)
  assert(Boolean(conciergeIntent.controlPosture.mode), `${mode} ConciergeIntent control posture must be populated.`)
  assert(Boolean(conciergeIntent.experienceProfile.persona), `${mode} ConciergeIntent persona must be populated.`)
  assert(Boolean(conciergeIntent.experienceProfile.vibe), `${mode} ConciergeIntent vibe must be populated.`)
  assert(Boolean(conciergeIntent.anchorPosture.mode), `${mode} ConciergeIntent anchor posture must be populated.`)
  assert(Boolean(conciergeIntent.constraintPosture.travelTolerance), `${mode} ConciergeIntent constraints must be populated.`)
  assert(Boolean(conciergeIntent.realityPosture.coherencePriority), `${mode} ConciergeIntent reality posture must be populated.`)
}

function buildArtifact(params: {
  config: ModeFixtureConfig
  finalRoute: RuntimeRouteArtifact
  conciergeIntent: ConciergeIntent
  strategyFamily: string
}): ContractEntryArtifact {
  const { config, finalRoute, conciergeIntent, strategyFamily } = params
  const roleNames = namesByRole(finalRoute)
  return {
    id: config.artifactId,
    sourceOpportunityId: config.sourceOpportunityId,
    sourceMode: config.sourceMode,
    anchorVenueId: config.anchorVenueId,
    anchorRole: config.anchorRole,
    anchorName: findVenue(config.anchorVenueId).name,
    routeTitle: `${config.mode} convergence route`,
    flavorLine: `${config.mode} route-truth convergence fixture.`,
    routeSummary: `${roleNames.start} to ${roleNames.highlight} to ${roleNames.windDown}.`,
    traits: ['phase2', 'cross-mode', 'convergence'],
    storySpine: {
      start: roleNames.start,
      highlight: roleNames.highlight,
      windDown: roleNames.windDown,
    },
    districtLine: 'San Jose',
    districtAnchorLine: `Anchor: ${findVenue(config.anchorVenueId).name}`,
    authorityLine: 'Phase 2.5 canonical routeAuthority convergence fixture.',
    whyChooseLine: 'Proves the post-lock route truth spine without provider calls.',
    whyTonightProofLine: 'Local fixture only.',
    selection: {
      directionId: config.directionId,
      pocketId: `phase2-cross-mode-${config.mode}`,
    },
    qualification: {
      status: 'committable',
      failedCheck: null,
      missingRoleForContract: null,
      hardCommitRequired: true,
    },
    enrichment: {
      mode: config.mode as ContractEntryArtifactMode,
      locationContext: {
        city: 'San Jose',
        neighborhood: 'San Jose',
      },
      userInputContext: {
        primaryVibe: config.vibe,
        persona: config.persona,
        anchorVenueId: config.anchorVenueId,
        anchorName: findVenue(config.anchorVenueId).name,
      },
      conciergeIntentSummary: {
        conciergeIntentId: conciergeIntent.id,
        planningMode: config.mode,
        primaryVibe: config.vibe,
        persona: config.persona,
        summary: `${config.mode} ConciergeIntent-backed convergence fixture.`,
      },
      tasteDistrictSummary: {
        tasteProfileId: `phase2-cross-mode-${config.mode}`,
        districtId: `phase2-cross-mode-${config.mode}`,
        districtLabel: 'San Jose',
        summary: `Strategy family ${strategyFamily}.`,
      },
      fieldProvenanceSummary: {
        sourceMode: config.sourceMode,
        provider: 'static-corpus',
        liveProviderUsed: false,
        corpusUsed: true,
        calibrationOnly: false,
        candidateCount: finalRoute.stops.length,
        queryLabels: [],
        provenanceId: `phase2-cross-mode-${config.mode}`,
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: `bearings:phase2-cross-mode:${config.mode}`,
        summary: 'Canonical route roles admitted.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: `waypoint:phase2-cross-mode:${config.mode}`,
        summary: routeIdsFromRuntimeRoute(finalRoute).join(' -> '),
      },
      canonicalRouteRoleCoverage: {
        start: roleNames.start,
        highlight: roleNames.highlight,
        windDown: roleNames.windDown,
        support: finalRoute.stops.map((stop) => ({
          role: stop.role,
          name: stop.displayName,
          venueId: stop.venueId,
        })),
      },
      validationStatus: 'valid',
      rejectionReasons: [],
      starterContextFit: {
        status: 'passed',
        mode: config.mode as ContractEntryArtifactMode,
        contextKey: `phase2-cross-mode:${config.mode}`,
        rejectionReasons: [],
      },
      modeContextFit: {
        status: 'passed',
        mode: config.mode as ContractEntryArtifactMode,
        contextKey: `mode:${config.mode}`,
        rejectionReasons: [],
      },
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        selectedDirectionId: config.directionId,
        ...(config.lockSource === 'runtime' ? { runtimeRouteArtifact: finalRoute } : {}),
        buildMetadata: {
          canBuildRuntimeRoute: true,
        },
      },
    },
  }
}

function buildItinerary(config: ModeFixtureConfig): Itinerary {
  const stops = [
    buildStop({ venueId: config.routeIds.start, role: 'start', index: 0 }),
    buildStop({ venueId: config.routeIds.highlight, role: 'highlight', index: 1 }),
    ...(config.includeHiddenSurprise
      ? [
          buildStop({
            venueId: 'sj-jtown-ramen-ya',
            role: 'surprise',
            index: 2,
            id: 'surprise:wildcard_sj-jtown-ramen-ya',
          }),
        ]
      : []),
    buildStop({
      venueId: config.routeIds.windDown,
      role: 'windDown',
      index: config.includeHiddenSurprise ? 3 : 2,
    }),
  ]
  return {
    id: `itinerary:phase2-cross-mode:${config.mode}`,
    title: `${config.mode} convergence route`,
    city: 'San Jose',
    neighborhood: 'San Jose',
    crew: config.persona,
    vibes: [config.vibe],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'Canonical convergence route',
    story: {
      headline: `${config.mode} convergence route`,
      subtitle: 'Local-only Phase 2.5 route truth fixture.',
    },
    storySpine: {
      title: `${config.mode} convergence route`,
      phases: [
        { role: 'start', label: 'Start', summary: findVenue(config.routeIds.start).name },
        { role: 'highlight', label: 'Highlight', summary: findVenue(config.routeIds.highlight).name },
        { role: 'winddown', label: 'Wind down', summary: findVenue(config.routeIds.windDown).name },
      ],
      routeSummary: `${findVenue(config.routeIds.start).name} to ${findVenue(config.routeIds.highlight).name} to ${findVenue(config.routeIds.windDown).name}.`,
    },
    shareSummary: `${findVenue(config.routeIds.start).name} to ${findVenue(config.routeIds.highlight).name} to ${findVenue(config.routeIds.windDown).name}.`,
  }
}

function buildStop(params: {
  venueId: string
  role: UserStopRole
  index: number
  id?: string
}): ItineraryStop {
  const venue = findVenue(params.venueId)
  return {
    id: params.id ?? `stop:${params.role}:${venue.id}`,
    role: params.role,
    title: titleForRole(params.role),
    venueId: venue.id,
    venueName: venue.name,
    formattedAddress:
      venue.source.formattedAddress ?? `${100 + params.index} Phase 2.5 Way, San Jose, CA`,
    latitude: venue.source.latitude ?? 37.33 + params.index * 0.001,
    longitude: venue.source.longitude ?? -121.89 - params.index * 0.001,
    city: venue.city,
    category: venue.category,
    subcategory: venue.subcategory,
    priceTier: venue.priceTier,
    tags: venue.tags,
    vibeTags: venue.vibeTags,
    neighborhood: venue.neighborhood || 'San Jose',
    driveMinutes: venue.driveMinutes,
    durationClass: venue.durationProfile.durationClass,
    estimatedDurationMinutes: venue.durationProfile.estimatedMinutes,
    estimatedDurationLabel: `${venue.durationProfile.estimatedMinutes} min`,
    subtitle: venue.shortDescription,
    imageUrl: venue.imageUrl,
    selectedBecause: `Phase 2.5 ${params.role} convergence fixture.`,
    stopInsider: {
      roleReason: `${venue.name} holds ${params.role} in the convergence fixture.`,
      localSignal: venue.narrativeFlavor,
      selectionReason: 'Local fixture regression route.',
    },
  }
}

function buildRuntimeRoute(config: ModeFixtureConfig, itinerary: Itinerary): RuntimeRouteArtifact {
  const finalRoute = buildFinalRoute({
    itinerary,
    canonicalStopByRole: buildCanonicalStopIdentityByRole(itinerary),
    selectedDirectionId: config.directionId,
    city: 'San Jose',
    persona: config.persona,
    vibe: config.vibe,
    activeRole: 'start',
    mode: config.mode,
    routeHeadline: itinerary.storySpine?.title ?? itinerary.title,
    routeSummary: itinerary.storySpine?.routeSummary ?? itinerary.shareSummary,
  })
  assert(finalRoute, `${config.mode} RuntimeRouteArtifact must build.`)
  assertRuntimeRouteArtifactShape(finalRoute)
  return finalRoute
}

function buildCanonicalStopIdentityByRole(
  itinerary: Itinerary,
): Parameters<typeof buildFinalRoute>[0]['canonicalStopByRole'] {
  const canonicalStopByRole: Parameters<typeof buildFinalRoute>[0]['canonicalStopByRole'] = {}
  for (const stop of itinerary.stops) {
    canonicalStopByRole[stop.role] = {
      displayName: stop.venueName,
      providerRecordId: `provider:${stop.venueId}`,
      latitude: stop.latitude ?? 37.33,
      longitude: stop.longitude ?? -121.89,
      addressLine: stop.formattedAddress ?? `${stop.venueName}, San Jose, CA`,
      neighborhood: stop.neighborhood,
    }
  }
  return canonicalStopByRole
}

function assertRuntimeRouteArtifactShape(route: RuntimeRouteArtifact): void {
  assert(
    runtimeRouteArtifactKeys(route).join('|') ===
      [
        'activeStopIndex',
        'liveNotices',
        'location',
        'mapMarkers',
        'persona',
        'routeHeadline',
        'routeId',
        'routeSummary',
        'selectedDirectionId',
        'stops',
        'updatedAt',
        'vibe',
      ].join('|'),
    'RuntimeRouteArtifact key shape must remain unchanged.',
  )
  assert(route.stops.length >= 3, 'RuntimeRouteArtifact must contain at least three stops.')
  assert(route.mapMarkers.length === route.stops.length, 'RuntimeRouteArtifact map markers must match stops.')
}

function assertSameRuntimeRouteShape(proofs: ModeConvergenceProof[]): void {
  const firstArtifactShape = proofs[0]?.runtimeRouteArtifactKeys.join('|')
  const firstStopShape = proofs[0]?.runtimeRouteStopKeys.join('|')
  assert(firstArtifactShape && firstStopShape, 'Cross-mode proofs must include runtime shape signatures.')
  for (const proof of proofs) {
    assert(
      proof.runtimeRouteArtifactKeys.join('|') === firstArtifactShape,
      `${proof.mode} RuntimeRouteArtifact shape must match the cross-mode invariant.`,
    )
    assert(
      proof.runtimeRouteStopKeys.join('|') === firstStopShape,
      `${proof.mode} RuntimeRouteStop shape must match the cross-mode invariant.`,
    )
    assert(proof.finalRouteSourceCoverageComplete, `${proof.mode} sourceStopId coverage must be complete.`)
    assert(proof.livePayloadUsesFinalRoute, `${proof.mode} Live payload must use finalRoute.`)
    assert(proof.plansPayloadUsesFinalRoute, `${proof.mode} Plans payload must use finalRoute.`)
    assert(!proof.pageLocalOnlyLockReady, `${proof.mode} page-local finalRoute must not lock.`)
    assert(!proof.legacySelectedRouteOnlyLockReady, `${proof.mode} legacy selected route must not lock.`)
  }
}

function runtimeRouteArtifactKeys(route: RuntimeRouteArtifact): string[] {
  return Object.keys(route).sort()
}

function runtimeRouteStopKeys(route: RuntimeRouteArtifact): string[] {
  const stop = route.stops[0]
  assert(stop, 'RuntimeRouteArtifact must include a stop.')
  return Object.keys(stop).sort()
}

function namesByRole(route: RuntimeRouteArtifact): Record<'start' | 'highlight' | 'windDown', string> {
  const names = {
    start: '',
    highlight: '',
    windDown: '',
  }
  for (const stop of route.stops) {
    if (stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown') {
      names[stop.role] = stop.displayName
    }
  }
  return names
}

function routeIdsFromRuntimeRoute(route: RuntimeRouteArtifact | undefined): string[] {
  return (
    route?.stops
      .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => stop.venueId) ?? []
  )
}

function buildStaleRoute(route: RuntimeRouteArtifact): RuntimeRouteArtifact {
  return {
    ...route,
    routeId: `stale:${route.routeId}`,
    selectedDirectionId: `stale:${route.selectedDirectionId}`,
    stops: route.stops.map((stop) => ({
      ...stop,
      venueId: `stale:${stop.venueId}`,
      providerRecordId: `stale:${stop.providerRecordId}`,
    })),
  }
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

function findVenue(id: string): Venue {
  const venue = curatedVenues.find((candidate) => candidate.id === id)
  if (!venue) {
    throw new Error(`Missing venue fixture: ${id}`)
  }
  return venue
}
