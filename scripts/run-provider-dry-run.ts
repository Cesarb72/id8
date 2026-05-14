import {
  providerDryRunHarnessConfig,
  runProviderDryRunHarness,
} from '../src/domain/providers/providerDryRunHarness.ts'

async function main(): Promise<void> {
  if (process.env[providerDryRunHarnessConfig.dryRunEnvFlag] !== '1') {
    throw new Error(
      `Provider dry run is disabled by default. Set ${providerDryRunHarnessConfig.dryRunEnvFlag}=1 to run the harness.`,
    )
  }

  const report = await runProviderDryRunHarness({
    query: providerDryRunHarnessConfig.query,
  })

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
