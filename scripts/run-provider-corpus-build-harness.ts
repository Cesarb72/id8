import {
  isDirectRun,
  modeFromEnv,
  runLiveProviderCorpusBuildHarness,
  runMockedProviderCorpusBuildHarness,
} from './provider-corpus-build-harness.ts'

async function main(): Promise<void> {
  const mode = modeFromEnv()
  if (mode === 'live') {
    const result = await runLiveProviderCorpusBuildHarness()
    process.stdout.write(
      `${JSON.stringify(
        {
          emitted: true,
          gate1Readiness: result.report.gate1Readiness,
          ledger: result.ledger,
          outputPaths: result.outputPaths,
          preflightAllowed: result.preflight.allowed,
          runtimeImportHits: result.diagnostics.runtimeImportHits,
        },
        null,
        2,
      )}\n`,
    )
  } else {
    const result = runMockedProviderCorpusBuildHarness()
    process.stdout.write(
      `${JSON.stringify(
        {
          emitted: true,
          gate1Readiness: result.report.gate1Readiness,
          ledger: result.ledger,
          outputPaths: result.outputPaths,
          preflightAllowed: result.preflight.allowed,
          runtimeImportHits: result.diagnostics.runtimeImportHits,
        },
        null,
        2,
      )}\n`,
    )
  }
}

if (isDirectRun(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
