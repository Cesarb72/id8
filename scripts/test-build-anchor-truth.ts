import { readFileSync } from 'node:fs'
import { buildContractEntryArtifactFromGeneration } from '../src/domain/artifacts/buildContractEntryArtifactFromGeneration.ts'
import {
  buildAnchorTruthContract,
  validateContractEntryArtifactBuildAnchor,
  validateRuntimeRouteBuildAnchor,
} from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifactLineage } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { BuildAnchorCanonicalRole } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { IntentProfile } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Build anchor truth contract test must not call fetch.')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function buildRuntimeStop(role: UserStopRole, venueId: string, providerRecordId?: string): RuntimeRouteStop {
  return {
    id: `${role}:${venueId}`,
    sourceStopId: `${role}:${venueId}`,
    displayName: `${role} ${venueId}`,
    ...(providerRecordId ? { providerRecordId } : {}),
    latitude: 37.33,
    longitude: -121.89,
    address: '1 Test Way',
    role,
    stopIndex: role === 'start' ? 0 : role === 'highlight' ? 1 : 2,
    venueId,
    title: `${role} title`,
    subtitle: `${role} subtitle`,
    neighborhood: 'Downtown',
    driveMinutes: 4,
    imageUrl: '/test.jpg',
  }
}

function buildRuntimeRoute(stops: RuntimeRouteStop[]): RuntimeRouteArtifact {
  return {
    routeId: 'runtime-test-route',
    selectedDirectionId: 'direction-test',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Test route',
    routeSummary: 'Test route summary',
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
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

function buildContract(role: BuildAnchorCanonicalRole = 'highlight') {
  return buildAnchorTruthContract({
    identity: {
      venueId: `anchor-${role}`,
      sourceVenueId: `source-anchor-${role}`,
      providerRecordId: `provider-anchor-${role}`,
      displayName: `Anchor ${role}`,
      sourceOrigin: 'curated',
      provider: 'google-places',
      latitude: 37.33,
      longitude: -121.89,
    },
    role: {
      role,
      roleResolutionSource: 'inferred',
    },
  })
}

function buildMissingRoleContract() {
  return buildAnchorTruthContract({
    identity: {
      venueId: 'anchor-highlight',
      displayName: 'Anchor highlight',
    },
    role: {},
  })
}

function buildItineraryStop(role: UserStopRole, venueId: string): ItineraryStop {
  return {
    id: `${role}:${venueId}`,
    role,
    title: role === 'windDown' ? 'Wind Down' : role === 'highlight' ? 'Highlight' : 'Start',
    venueId,
    venueName: `${role} ${venueId}`,
    formattedAddress: '1 Test Way',
    latitude: 37.33,
    longitude: -121.89,
    city: 'San Jose',
    category: 'bar',
    subcategory: 'test',
    priceTier: '$$',
    tags: ['test'],
    vibeTags: ['lively'],
    neighborhood: 'Downtown',
    driveMinutes: 4,
    durationClass: 'standard',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: `${role} subtitle`,
    imageUrl: '/test.jpg',
    stopInsider: {
      roleReason: 'test role',
      localSignal: 'test local',
      selectionReason: 'test selection',
    },
  }
}

function buildItinerary(anchorRole: BuildAnchorCanonicalRole, anchorVenueId: string): Itinerary {
  return {
    id: `itinerary-${anchorRole}`,
    title: 'Test itinerary',
    city: 'San Jose',
    neighborhood: 'Downtown',
    crew: 'socialite',
    vibes: ['lively'],
    stops: [
      buildItineraryStop('start', anchorRole === 'start' ? anchorVenueId : 'start-other'),
      buildItineraryStop('highlight', anchorRole === 'highlight' ? anchorVenueId : 'highlight-other'),
      buildItineraryStop('windDown', anchorRole === 'windDown' ? anchorVenueId : 'wind-down-other'),
    ],
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: '2.5 hours',
    routeFeelLabel: 'Easy',
    story: {
      headline: 'Test story',
      subtitle: 'Test subtitle',
    },
    storySpine: {
      title: 'Test route',
      phases: [],
      routeSummary: 'Test route summary',
    },
    shareSummary: 'Test share summary',
  }
}

function buildIntent(anchorRole: BuildAnchorCanonicalRole, anchorVenueId: string): IntentProfile {
  return {
    crew: 'socialite',
    persona: 'friends',
    personaSource: 'explicit',
    primaryAnchor: 'lively',
    secondaryAnchors: ['chill'],
    city: 'San Jose',
    distanceMode: 'nearby',
    prefersHiddenGems: false,
    mode: 'build',
    planningMode: 'user-led',
    anchor: {
      venueId: anchorVenueId,
      role: anchorRole,
    },
    selectedDirectionContext: {
      directionId: 'direction-test',
      pocketId: 'pocket-test',
    },
  }
}

function buildGeneratedArtifact(anchorRole: BuildAnchorCanonicalRole) {
  const anchorVenueId = `anchor-${anchorRole}`
  const lineage: ContractEntryArtifactLineage = {
    artifactId: `artifact-${anchorRole}`,
    sourceOpportunityId: `opportunity-${anchorRole}`,
    anchorVenueId,
    anchorRole,
    directionId: 'direction-test',
    pocketId: 'pocket-test',
  }
  return buildContractEntryArtifactFromGeneration({
    itinerary: buildItinerary(anchorRole, anchorVenueId),
    selectedArc: {
      id: `arc-${anchorRole}`,
      totalScore: 0.91,
    } as never,
    scoredVenues: [],
    intentProfile: buildIntent(anchorRole, anchorVenueId),
    lens: {
      tone: 'social',
      discoveryBias: 'balanced',
      movementTolerance: 'moderate',
    } as never,
    diagnostics: {
      selectedDistrictId: 'district-test',
      selectedDistrictLabel: 'Downtown',
      selectedDistrictReason: 'test district',
      stopExplainability: {
        highlight: {
          selectedBecause: 'Test highlight reason',
        },
      },
      retrievalDiagnostics: {
        liveSource: {
          effectiveMode: 'curated',
          liveFetchAttempted: false,
          liveFetchSucceeded: false,
          countsBySource: {
            curated: 3,
          },
          liveQueryLabelsUsed: [],
        },
      },
    } as never,
    rankingEngine: 'test',
    selectedArtifactLineage: lineage,
  })
}

function main(): void {
  globalThis.fetch = fetchTrap

  for (const role of ['highlight', 'start', 'windDown'] as const) {
    const contract = buildContract(role)
    const route = buildRuntimeRoute([
      buildRuntimeStop('start', role === 'start' ? contract.canonicalVenueId : 'start-other'),
      buildRuntimeStop('highlight', role === 'highlight' ? contract.canonicalVenueId : 'highlight-other'),
      buildRuntimeStop('windDown', role === 'windDown' ? contract.canonicalVenueId : 'wind-down-other'),
    ])
    const validation = validateRuntimeRouteBuildAnchor(contract, route)
    assert(validation.status === 'valid', `${role} anchor must preserve in ${role}.`)
    assert(validation.preserved, `${role} anchor must be marked preserved.`)
  }

  const startContract = buildContract('start')
  const wrongRole = validateRuntimeRouteBuildAnchor(
    startContract,
    buildRuntimeRoute([
      buildRuntimeStop('start', 'start-other'),
      buildRuntimeStop('highlight', startContract.canonicalVenueId),
      buildRuntimeStop('windDown', 'wind-down-other'),
    ]),
  )
  assert(wrongRole.status === 'invalid', 'Anchor in wrong role must fail.')
  assert(
    wrongRole.reasons.includes('anchor_not_in_required_role'),
    'Wrong-role failure must report anchor_not_in_required_role.',
  )

  const supportOnly = validateRuntimeRouteBuildAnchor(
    startContract,
    buildRuntimeRoute([
      buildRuntimeStop('start', 'start-other'),
      buildRuntimeStop('highlight', 'highlight-other'),
      buildRuntimeStop('surprise', startContract.canonicalVenueId),
    ]),
  )
  assert(supportOnly.status === 'invalid', 'Support-only anchor must fail.')
  assert(
    supportOnly.reasons.includes('anchor_only_support_stop'),
    'Support-only failure must report anchor_only_support_stop.',
  )

  const providerOnly = validateRuntimeRouteBuildAnchor(
    startContract,
    buildRuntimeRoute([
      buildRuntimeStop('start', 'provider-only-venue', startContract.providerRecordId),
      buildRuntimeStop('highlight', 'highlight-other'),
      buildRuntimeStop('windDown', 'wind-down-other'),
    ]),
  )
  assert(providerOnly.status === 'invalid', 'Provider ID alone must not preserve anchor.')
  assert(
    providerOnly.reasons.includes('anchor_provider_id_only'),
    'Provider-only failure must report anchor_provider_id_only.',
  )

  const missingRoleContract = buildMissingRoleContract()
  assert(
    missingRoleContract.requiredRole === 'highlight',
    'Missing anchor role must default to highlight for compatibility.',
  )
  assert(
    missingRoleContract.roleResolutionSource === 'defaulted_highlight',
    'Missing anchor role must expose defaulted_highlight source.',
  )
  assert(
    missingRoleContract.diagnostics.reasons.includes('anchor_role_defaulted_highlight'),
    'Missing anchor role must diagnose defaulted highlight.',
  )

  const defaultedArtifactValidation = validateContractEntryArtifactBuildAnchor(
    missingRoleContract,
    {
      id: 'artifact-defaulted',
      sourceOpportunityId: 'opportunity-defaulted',
      anchorVenueId: missingRoleContract.canonicalVenueId,
      anchorName: 'Defaulted highlight',
      routeTitle: 'Defaulted',
      flavorLine: 'Defaulted',
      routeSummary: 'Defaulted',
      traits: [],
      storySpine: {
        start: 'Start',
        highlight: 'Defaulted highlight',
        windDown: 'Wind down',
      },
      districtLine: 'Downtown',
      districtAnchorLine: 'Downtown',
      authorityLine: 'Authority',
      whyChooseLine: 'Because',
      selection: {},
    },
  )
  assert(
    defaultedArtifactValidation.status === 'warning',
    'Missing artifact role must warn instead of silently passing.',
  )

  const generatedStart = buildGeneratedArtifact('start')
  assert(generatedStart.anchorRole === 'start', 'Generated Build start anchor must not re-author as highlight.')
  assert(generatedStart.anchorVenueId === 'anchor-start', 'Generated Build start anchor must keep canonical venue ID.')

  const generatedWindDown = buildGeneratedArtifact('windDown')
  assert(
    generatedWindDown.anchorRole === 'windDown',
    'Generated Build windDown anchor must not re-author as highlight.',
  )
  assert(
    generatedWindDown.anchorVenueId === 'anchor-windDown',
    'Generated Build windDown anchor must keep canonical venue ID.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('const buildProviderSelectionAllowed = true'),
    'Build provider selection must be locally unparked.',
  )

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('build anchor truth contract: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        preservedRoles: ['highlight', 'start', 'windDown'],
        missingRoleStatus: defaultedArtifactValidation.status,
        generatedStartAnchorRole: generatedStart.anchorRole,
        generatedWindDownAnchorRole: generatedWindDown.anchorRole,
        buildProviderSelectionAllowed: true,
      },
      null,
      2,
    )}\n`,
  )
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
} finally {
  globalThis.fetch = originalFetch
}
