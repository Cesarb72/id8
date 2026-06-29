import { readFileSync } from 'node:fs'
import { buildBuildCardTruthModel } from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-public-review-gating-diagnostics must not call fetch.')
}) as typeof fetch

try {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const providerAdapterSource = readFileSync('src/domain/providers/ProviderAdapter.ts', 'utf8')
  const sourceModeSource = readFileSync('src/domain/sources/getSourceMode.ts', 'utf8')

  assert(
    sandboxSource.includes('publicBuildReviewGatingDiagnosticsVisible') &&
      sandboxSource.includes('isPublicSurface && isBuildWrapperActive && showDebug'),
    'Public Build Review diagnostics must be gated to public Build with debug enabled.',
  )
  assert(
    sandboxSource.includes('data-id8-public-build-review-gating-diagnostics'),
    'Public Build Review diagnostics must expose a capturable DOM data attribute.',
  )
  ;[
    'buildSelectedCardTruthReady',
    'buildReviewTruthEligible',
    'buildPreGenerationSelectionReady',
    'buildGenerationInProgress',
    'showPrimaryContinueAction',
    'primaryActionText',
    'reviewHiddenReasons',
    'selectedArtifactId',
    'selectedArtifactSourceOpportunityId',
    'selectedArtifactDisplaySource',
    'routeAuthorityStatus',
    'routeAuthorityReasons',
    'routeAuthorityBuildReasons',
    'lockInputAvailable',
    'finalRoutePresent',
    'generatedPlanPresent',
    'generatedContractEntryArtifactPresent',
    'generatedCanonicalRouteHandoffComplete',
  ].forEach((field) => {
    assert(
      sandboxSource.includes(field),
      `Public Build Review diagnostics must include ${field}.`,
    )
  })
  assert(
    sandboxSource.includes("primaryActionText: showPrimaryContinueAction ? 'Review this route' : 'none'"),
    'Diagnostics must expose whether the Review CTA should render.',
  )
  assert(
    sandboxSource.includes('selectedRouteStaticPreGeneration') &&
      sandboxSource.includes('build_static_pre_generation') &&
      sandboxSource.includes('step2_static_build_paper_plane'),
    'Diagnostics must preserve static pre-generation visibility.',
  )
  assert(
    !sandboxSource.includes('GOOGLE_PLACES_API_KEY') &&
      !sandboxSource.includes('KV_REST_API_URL') &&
      !sandboxSource.includes('KV_REST_API_TOKEN') &&
      !sandboxSource.includes('ID8_FIELD_PROVIDER') &&
      !sandboxSource.includes('ID8_PROVIDER_DAILY_CALL_CAP'),
    'Public Build Review diagnostics must not expose server env or secret names.',
  )
  assert(
    sandboxSource.includes('buildSelectedCardTruthReady') &&
      sandboxSource.includes('buildReviewTruthEligible') &&
      !sandboxSource.includes('!isBuildWrapperActive || buildReviewTruthEligible || buildPreGenerationSelectionReady'),
    'Build Review gates must not be loosened by pre-generation selection readiness.',
  )
  assert(
    sandboxSource.includes('Build route review is still parked until generated authority is lock-ready.'),
    'Build reveal handler must continue hard-blocking Review until generated authority is lock-ready.',
  )
  assert(
    providerAdapterSource.includes('fetch(config.requestPath') &&
      sourceModeSource.includes("requestPath: '/api/field/text-search'"),
    'Provider calls must remain routed through ProviderAdapter / Field proxy.',
  )
  assert(
    !providerAdapterSource.includes('places.googleapis.com'),
    'ProviderAdapter must not expose a browser-side Google provider path.',
  )

  const staticArtifact = buildStaticPaperPlaneArtifact()
  const staticTruth = buildBuildCardTruthModel({
    artifact: staticArtifact,
    selectedCandidateArtifact: staticArtifact,
    selectedArtifactId: staticArtifact.id,
    selectedDirectionId: staticArtifact.selection.directionId,
    approvedPayload: null,
    candidateAdmission: null,
    anchorTruthContract: buildAnchorTruthContract({
      identity: {
        venueId: 'sj-paper-plane',
        providerRecordId: 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
        displayName: 'Paper Plane',
      },
      role: {
        role: 'highlight',
        roleResolutionSource: 'explicit',
      },
    }),
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!staticTruth.reviewEligible, 'Static pre-generation route must not be Review-eligible.')
  assert(!staticTruth.routeAuthorityLockReady, 'Static pre-generation route must not be routeAuthority lock-ready.')
  assert(
    staticTruth.rejectionReasons.includes('build_route_authority_unavailable'),
    'Static pre-generation Review diagnostics must preserve build_route_authority_unavailable.',
  )
  assert(
    staticTruth.rejectionReasons.includes('build_review_truth_unavailable'),
    'Static pre-generation Review diagnostics must preserve build_review_truth_unavailable.',
  )
  assert(fetchCallCount === 0, `Expected no Field proxy/provider fetches, received ${fetchCallCount}.`)

  process.stdout.write('build public review gating diagnostics: passed\n')
  process.stdout.write(
    JSON.stringify(
      {
        diagnosticSurface: 'data-id8-public-build-review-gating-diagnostics',
        publicBuildDebugGate: true,
        staticReviewEligible: staticTruth.reviewEligible,
        routeAuthorityLockReady: staticTruth.routeAuthorityLockReady,
        rejectionReasons: staticTruth.rejectionReasons,
        fetchCallCount,
        nonBuildModesOpened: false,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  globalThis.fetch = originalFetch
}

function buildStaticPaperPlaneArtifact(): ContractEntryArtifact {
  return {
    id: 'step2_static_build_paper_plane',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    sourceMode: 'curated',
    anchorVenueId: 'sj-paper-plane',
    anchorRole: 'highlight',
    anchorName: 'Paper Plane',
    routeTitle: 'Paper Plane Cocktail-led downtown night',
    flavorLine: 'Cocktail-led downtown night',
    routeSummary: 'Petiscos to Paper Plane to Hedley Club Lounge.',
    traits: ['cocktails', 'downtown'],
    storySpine: {
      start: 'Petiscos',
      highlight: 'Paper Plane',
      windDown: 'Hedley Club Lounge',
    },
    districtLine: 'Downtown San Jose',
    districtAnchorLine: 'Downtown',
    authorityLine: 'Static Build candidate fixture.',
    whyChooseLine: 'Keeps Paper Plane as the required highlight.',
    selection: {
      directionId: 'downtown-paper-plane',
      pocketId: 'downtown',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: 'Petiscos',
        highlight: 'Paper Plane',
        windDown: 'Hedley Club Lounge',
        support: [
          { role: 'start', name: 'Petiscos', venueId: 'sj-petiscos' },
          { role: 'highlight', name: 'Paper Plane', venueId: 'sj-paper-plane' },
          { role: 'windDown', name: 'Hedley Club Lounge', venueId: 'sj-hedley-club-lounge' },
        ],
      },
    },
  }
}
