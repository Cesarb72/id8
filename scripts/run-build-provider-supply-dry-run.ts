const DRY_RUN_ENV_FLAG = 'ID8_BUILD_PROVIDER_SUPPLY_DRY_RUN'

async function main(): Promise<void> {
  if (process.env[DRY_RUN_ENV_FLAG] !== '1') {
    process.stdout.write(
      `${JSON.stringify(
        {
          runId: `build-provider-supply-dry-run-${Date.now()}`,
          anchor: {
            canonicalVenueId: 'sj-paper-plane',
            providerRecordId: 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
            displayName: 'Paper Plane',
          },
          emitted: false,
          blockedReason: 'dry_run_disabled',
          nearbyVenueCount: 0,
          suppressedVenueCount: 0,
          roleCandidateCounts: {
            start: 0,
            highlight: 0,
            windDown: 0,
          },
          anchorSearchTrace: null,
          buildNearbyTrace: null,
          anchorSearchLedger: null,
          buildNearbyLedger: null,
          providerLedger: null,
          anchorCanonicalMappingSummary: null,
          anchorCompletenessSummary: null,
          anchorEquivalenceSummary: null,
          suppressionReasons: [],
          nearbySuppressionReasons: [],
          nearbyCandidateReviewSummaries: [],
          nearbyCanonicalMappingSummaries: [],
          nearbyCompletenessSummaries: [],
          nearbyEquivalenceSummaries: [],
        },
        null,
        2,
      )}\n`,
    )
    process.exitCode = 1
    return
  }

  const {
    runBuildProviderSupplyDryRunHarness,
  } = await import('../src/domain/providers/buildProviderSupplyDryRunHarness.ts')
  const report = await runBuildProviderSupplyDryRunHarness()
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stdout.write(
    `${JSON.stringify(
      {
        runId: `build-provider-supply-dry-run-${Date.now()}`,
        anchor: {
          canonicalVenueId: 'sj-paper-plane',
          providerRecordId: 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
          displayName: 'Paper Plane',
        },
        emitted: false,
        blockedReason: 'provider_request_failed',
        error: message,
        nearbyVenueCount: 0,
        suppressedVenueCount: 0,
        roleCandidateCounts: {
          start: 0,
          highlight: 0,
          windDown: 0,
        },
        anchorSearchTrace: null,
        buildNearbyTrace: null,
        anchorSearchLedger: null,
        buildNearbyLedger: null,
        providerLedger: null,
        anchorCanonicalMappingSummary: null,
        anchorCompletenessSummary: null,
        anchorEquivalenceSummary: null,
        suppressionReasons: [],
        nearbySuppressionReasons: [],
        nearbyCandidateReviewSummaries: [],
        nearbyCanonicalMappingSummaries: [],
        nearbyCompletenessSummaries: [],
        nearbyEquivalenceSummaries: [],
      },
      null,
      2,
    )}\n`,
  )
  process.exitCode = 1
})
