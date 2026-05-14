const DRY_RUN_ENV_FLAG = 'ID8_PROVIDER_DRY_RUN'

async function main(): Promise<void> {
  if (process.env[DRY_RUN_ENV_FLAG] !== '1') {
    process.stderr.write(
      `${JSON.stringify(
        {
          allowed: false,
          reason: `Provider dry run is disabled by default. Set ${DRY_RUN_ENV_FLAG}=1 to run the harness.`,
        },
        null,
        2,
      )}\n`,
    )
    process.exitCode = 1
    return
  }

  const {
    providerDryRunHarnessConfig,
    runProviderDryRunHarness,
  } = await import('../src/domain/providers/providerDryRunHarness.ts')

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
