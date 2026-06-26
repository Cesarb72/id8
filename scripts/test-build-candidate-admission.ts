import { readFileSync } from 'node:fs'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { BuildAnchorCanonicalRole } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { ScenarioRouteGeoCoherence } from '../src/domain/interpretation/construction/scenarioBuilder.ts'
import type { BearingsStaticRuntimeHoursProofResult } from '../src/domain/bearings/staticRuntimeHoursProof.ts'
import {
  evaluateBuildCandidateAdmission,
  evaluateCandidateGeoPosture,
} from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Build candidate admission test must not call fetch.')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function buildContract(role: BuildAnchorCanonicalRole = 'highlight') {
  return buildAnchorTruthContract({
    identity: {
      venueId: 'sj-paper-plane',
      sourceVenueId: 'google:sj-paper-plane',
      providerRecordId: 'provider-paper-plane',
      displayName: 'Paper Plane',
      sourceOrigin: 'curated',
      provider: 'google-places',
      latitude: 37.332,
      longitude: -121.889,
    },
    role: {
      role,
      roleResolutionSource: 'explicit',
    },
  })
}

function buildArtifact(patch: Partial<ContractEntryArtifact> = {}): ContractEntryArtifact {
  return {
    id: 'build-candidate-paper-plane',
    sourceOpportunityId: 'build-opportunity-paper-plane',
    sourceMode: 'curated',
    anchorVenueId: 'sj-paper-plane',
    anchorRole: 'highlight',
    anchorName: 'Paper Plane',
    routeTitle: 'Paper Plane Night',
    flavorLine: 'Cocktails with a compact downtown arc.',
    routeSummary: 'Start nearby, center Paper Plane, and land close.',
    traits: ['cocktails', 'downtown'],
    storySpine: {
      start: 'Good Karma',
      highlight: 'Paper Plane',
      windDown: 'Haberdasher',
    },
    districtLine: 'Downtown San Jose',
    districtAnchorLine: 'Downtown',
    authorityLine: 'Build candidate fixture.',
    whyChooseLine: 'Keeps the required anchor in the route.',
    selection: {
      directionId: 'downtown-cocktails',
      pocketId: 'downtown',
    },
    ...patch,
  }
}

function proof(
  status: BearingsStaticRuntimeHoursProofResult['status'],
): BearingsStaticRuntimeHoursProofResult {
  return {
    status,
    required: true,
    proofSource: 'structured_periods',
    structuredPeriodCount: status === 'unknown_for_plan_window' ? 0 : 1,
    textHoursAvailable: false,
    planningWindowLabel: 'Friday 7:00 PM',
  }
}

const explicitWindow = {
  day: 5,
  hour: 19,
  minute: 0,
  label: 'Friday 7:00 PM',
  source: 'intent_time_window',
  usesIntentWindow: true,
} as const

const unspecifiedWindow = {
  ...explicitWindow,
  source: 'default_evening_window',
  usesIntentWindow: false,
} as const

const scatteredGeo: ScenarioRouteGeoCoherence = {
  status: 'scattered',
  rejectionReason: 'scenario_route_geo_scattered',
  geoBearingStopCount: 3,
  uniqueGeoBucketCount: 3,
  dominantGeoBucket: 'downtown',
  dominantGeoShare: 0.34,
  routeGeoBuckets: [
    { role: 'start', venueId: 'sj-good-karma', name: 'Good Karma', geoBucket: 'downtown' },
    { role: 'highlight', venueId: 'sj-paper-plane', name: 'Paper Plane', geoBucket: 'soma' },
    { role: 'windDown', venueId: 'sj-haberdasher', name: 'Haberdasher', geoBucket: 'sofa' },
  ],
}

function main(): void {
  globalThis.fetch = fetchTrap

  const admitted = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract('highlight'),
    contractEntryArtifact: buildArtifact(),
    hoursProof: proof('open_for_plan_window'),
    planningWindow: explicitWindow,
    buildParked: {
      providerSelectionAllowed: false,
      providerMergedIntoVisiblePool: false,
    },
  })
  assert(admitted.admitted, 'Exact anchor in required role must admit.')
  assert(admitted.truthGateStatus === 'passed', 'Exact anchor must pass truth gate.')

  const wrongRole = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract('start'),
    contractEntryArtifact: buildArtifact(),
    hoursProof: proof('open_for_plan_window'),
    planningWindow: explicitWindow,
  })
  assert(!wrongRole.admitted, 'Wrong required anchor role must reject.')
  assert(
    wrongRole.rejectionReasons.includes('anchor_wrong_required_role'),
    'Wrong-role rejection must be explicit.',
  )

  const supportOnly = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract('highlight'),
    runtimeRouteArtifact: {
      routeId: 'support-only-route',
      selectedDirectionId: 'downtown-cocktails',
      location: 'San Jose',
      persona: 'friends',
      vibe: 'lively',
      activeStopIndex: 0,
      routeHeadline: 'Support-only',
      routeSummary: 'Support-only',
      liveNotices: [],
      updatedAt: 1,
      stops: [
        {
          id: 'start',
          sourceStopId: 'start',
          displayName: 'Start',
          latitude: 37.33,
          longitude: -121.89,
          address: '1 Test Way',
          role: 'start',
          stopIndex: 0,
          venueId: 'sj-good-karma',
          title: 'Start',
          subtitle: 'Start',
          neighborhood: 'Downtown',
          driveMinutes: 4,
          imageUrl: '/test.jpg',
        },
        {
          id: 'highlight',
          sourceStopId: 'highlight',
          displayName: 'Highlight',
          latitude: 37.33,
          longitude: -121.89,
          address: '1 Test Way',
          role: 'surprise',
          stopIndex: 1,
          venueId: 'sj-paper-plane',
          title: 'Support',
          subtitle: 'Support',
          neighborhood: 'Downtown',
          driveMinutes: 4,
          imageUrl: '/test.jpg',
        },
        {
          id: 'windDown',
          sourceStopId: 'windDown',
          displayName: 'Wind down',
          latitude: 37.33,
          longitude: -121.89,
          address: '1 Test Way',
          role: 'windDown',
          stopIndex: 2,
          venueId: 'sj-haberdasher',
          title: 'Wind down',
          subtitle: 'Wind down',
          neighborhood: 'Downtown',
          driveMinutes: 4,
          imageUrl: '/test.jpg',
        },
      ],
      mapMarkers: [],
    },
    hoursProof: proof('open_for_plan_window'),
    planningWindow: explicitWindow,
  })
  assert(!supportOnly.admitted, 'Support-only anchor must reject.')
  assert(
    supportOnly.rejectionReasons.includes('anchor_support_only'),
    'Support-only rejection must be explicit.',
  )

  const providerOnly = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract('highlight'),
    contractEntryArtifact: buildArtifact({ anchorVenueId: 'provider-paper-plane' }),
    hoursProof: proof('open_for_plan_window'),
    planningWindow: explicitWindow,
  })
  assert(!providerOnly.admitted, 'Provider-ID-only anchor match must reject.')
  assert(
    providerOnly.rejectionReasons.includes('anchor_provider_id_only'),
    'Provider-ID-only rejection must be explicit.',
  )

  const missingIdentity = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildAnchorTruthContract({
      identity: { displayName: 'Missing ID' },
      role: { role: 'highlight', roleResolutionSource: 'explicit' },
    }),
    contractEntryArtifact: buildArtifact(),
  })
  assert(!missingIdentity.admitted, 'Missing canonical anchor identity must reject.')
  assert(
    missingIdentity.rejectionReasons.includes('missing_anchor_identity'),
    'Missing canonical anchor identity must be explicit.',
  )

  const closedHours = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract(),
    contractEntryArtifact: buildArtifact(),
    hoursProof: proof('closed_for_plan_window'),
    planningWindow: explicitWindow,
  })
  assert(!closedHours.admitted, 'Closed hours must reject.')
  assert(
    closedHours.rejectionReasons.includes('closed_for_plan_window'),
    'Closed-hours rejection must be explicit.',
  )

  const explicitUnknown = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract(),
    contractEntryArtifact: buildArtifact(),
    hoursProof: proof('unknown_for_plan_window'),
    planningWindow: explicitWindow,
  })
  assert(!explicitUnknown.admitted, 'Explicit time plus unknown hours must reject.')
  assert(
    explicitUnknown.rejectionReasons.includes('explicit_time_requires_known_open_hours'),
    'Explicit-time unknown-hours rejection must be explicit.',
  )

  const unspecifiedUnknown = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract(),
    contractEntryArtifact: buildArtifact(),
    hoursProof: proof('unknown_for_plan_window'),
    planningWindow: unspecifiedWindow,
  })
  assert(
    unspecifiedUnknown.admitted,
    'Unspecified time plus unknown hours may admit with relaxation.',
  )
  assert(
    unspecifiedUnknown.warningReasons.includes('unspecified_time_unknown_hours_relaxed'),
    'Unspecified unknown-hours relaxation must warn.',
  )

  const scatteredBuild = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract(),
    contractEntryArtifact: buildArtifact(),
    hoursProof: proof('open_for_plan_window'),
    planningWindow: explicitWindow,
    geoCoherence: scatteredGeo,
  })
  assert(scatteredBuild.admitted, 'Build scattered geo must not hard-reject by itself.')
  assert(
    scatteredBuild.warningReasons.includes('build_geo_scattered_required_anchor'),
    'Build scattered geo must warn.',
  )
  assert(scatteredBuild.geoPenalty > 0, 'Build scattered geo must produce a penalty.')

  const curateGeo = evaluateCandidateGeoPosture({
    mode: 'curate',
    geoCoherence: scatteredGeo,
  })
  assert(
    curateGeo.hardBlockReason === 'curate_geo_scattered',
    'Curate scattered geography must remain a hard gate.',
  )

  const staleRoute = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: buildContract(),
    contractEntryArtifact: buildArtifact(),
    expectedCanonicalRouteIds: {
      start: 'sj-good-karma',
      highlight: 'sj-paper-plane',
      windDown: 'sj-haberdasher',
    },
  })
  assert(!staleRoute.admitted, 'Non-canonical route IDs must reject.')
  assert(
    staleRoute.rejectionReasons.includes('stale_or_non_canonical_route_ids'),
    'Non-canonical route IDs must be explicit.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('const buildProviderSelectionAllowed = true'),
    'Build provider selection must be locally unparked.',
  )
  assert(
    sandboxSource.includes('const buildProviderMergedIntoVisiblePool = true'),
    'Build provider visible merge must be locally unparked.',
  )

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('build candidate admission: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        exactAnchorAdmitted: admitted.admitted,
        wrongRoleReasons: wrongRole.rejectionReasons,
        scatteredBuildWarnings: scatteredBuild.warningReasons,
        curateGeoHardBlock: curateGeo.hardBlockReason,
        buildProviderSelectionAllowed: true,
        buildProviderMergedIntoVisiblePool: true,
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
