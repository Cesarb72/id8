import { readFileSync } from 'node:fs'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
const originalSupplyFlag = process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-public-provider-diagnostics must not call fetch.')
}) as typeof fetch

try {
  process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = 'true'

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const providerAdapterSource = readFileSync('src/domain/providers/ProviderAdapter.ts', 'utf8')
  const sourceModeSource = readFileSync('src/domain/sources/getSourceMode.ts', 'utf8')
  const venuesModule = await import('../src/data/venues.ts')
  const buildProviderModule = await import(
    '../src/domain/providers/buildProviderSourceOpportunity.ts'
  )
  const wiring = await import('../src/domain/providers/buildProviderPublicLiveWiring.ts')

  assert(
    sandboxSource.includes('publicBuildProviderDiagnosticsVisible') &&
      sandboxSource.includes('isPublicSurface && isBuildWrapperActive && showDebug'),
    'Public Build diagnostics must be gated to public Build with debug enabled.',
  )
  assert(
    sandboxSource.includes('data-id8-public-build-provider-diagnostics'),
    'Public Build diagnostics must expose a capturable DOM data attribute.',
  )
  assert(
    sandboxSource.includes('buildProviderPublicLiveEligibility.eligible') &&
      sandboxSource.includes('buildProviderPublicLiveSourceMode') &&
      sandboxSource.includes('buildProviderPublicLiveEligibility.reasons'),
    'Public Build diagnostics must include eligibility, source mode, and reason codes.',
  )
  assert(
    sandboxSource.includes('blockedBeforeFetch') &&
      sandboxSource.includes('anchor_coordinates_missing') &&
      sandboxSource.includes('fieldProxyFetchAttemptedCount'),
    'Public Build diagnostics must surface pre-fetch blockers and Field proxy attempt state.',
  )
  assert(
    sandboxSource.includes('step2_static_build_paper_plane') &&
      sandboxSource.includes('staticFallbackUsed') &&
      sandboxSource.includes('build_static_pre_generation'),
    'Static fallback must remain distinguishable in diagnostics and card display.',
  )
  assert(
    !sandboxSource.includes('GOOGLE_PLACES_API_KEY') &&
      !sandboxSource.includes('KV_REST_API_URL') &&
      !sandboxSource.includes('KV_REST_API_TOKEN') &&
      !sandboxSource.includes('ID8_FIELD_PROVIDER') &&
      !sandboxSource.includes('ID8_PROVIDER_DAILY_CALL_CAP'),
    'Public diagnostics must not expose server env or secret names.',
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

  const paperPlane = venuesModule.curatedVenues.find((venue) => venue.id === 'sj-paper-plane')
  assert(paperPlane, 'Paper Plane static venue must exist for the diagnostic harness.')
  assert(
    typeof paperPlane.source.latitude === 'number' &&
      typeof paperPlane.source.longitude === 'number',
    'Static Paper Plane must expose provider-source coordinates.',
  )

  const eligible = wiring.evaluateBuildProviderPublicLiveEligibility({
    isPublicSurface: true,
    isBuildWrapperActive: true,
    isDevOrSandboxCloseoutFlow: false,
    step2IntegrationFlagEnabled: true,
    supplyFlagEnabled: true,
    sourceMode: 'hybrid',
  })
  assert(eligible.eligible === true, 'Public Build provider path must remain eligible.')
  assert(
    eligible.envelope?.liveProviderAllowed === true &&
      eligible.envelope.maxProviderCalls === 3 &&
      eligible.envelope.maxQueryLabels === 3 &&
      eligible.envelope.maxCenters === 1,
    'Public Build provider diagnostics must preserve the fixed 3/3/1 envelope.',
  )

  const diagnosticsResult = await buildProviderModule.buildProviderSourceOpportunity({
    anchorVenue: paperPlane,
  })
  assert(
    diagnosticsResult.opportunity === null,
    'Closed local diagnostic run must not emit a provider source opportunity.',
  )
  assert(
    diagnosticsResult.diagnostics.buildProviderSupplyBlockedReason ===
      'provider_request_blocked',
    'Paper Plane should now pass coordinate gating and stop at the closed local provider valve.',
  )
  assert(
    diagnosticsResult.diagnostics.buildProviderSupplyBlockedReason !==
      'anchor_coordinates_missing',
    'Paper Plane must no longer fail the provider path on anchor_coordinates_missing.',
  )
  assert(
    diagnosticsResult.diagnostics.buildProviderAnchorProviderRecordId !== null,
    'Paper Plane provider record should remain found.',
  )
  assert(
    diagnosticsResult.diagnostics.trace === null &&
      diagnosticsResult.diagnostics.ledger === null,
    'Closed local pre-fetch block must not create provider trace or ledger diagnostics.',
  )
  assert(fetchCallCount === 0, `Expected no Field proxy/provider fetches, received ${fetchCallCount}.`)

  process.stdout.write('build public provider diagnostics: passed\n')
  process.stdout.write(
    JSON.stringify(
      {
        diagnosticSurface: 'data-id8-public-build-provider-diagnostics',
        publicBuildDebugGate: true,
        blockedReason: diagnosticsResult.diagnostics.buildProviderSupplyBlockedReason,
        coordinatesPresent: true,
        coordinatesMissing: false,
        providerRecordFound: Boolean(
          diagnosticsResult.diagnostics.buildProviderAnchorProviderRecordId,
        ),
        envelope: eligible.envelope,
        staticFallbackDistinguishable: true,
        fetchCallCount,
        nonBuildModesOpened: false,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  if (originalSupplyFlag === undefined) {
    delete process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY
  } else {
    process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = originalSupplyFlag
  }
  globalThis.fetch = originalFetch
}
