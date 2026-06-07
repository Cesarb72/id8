import {
  evaluateProviderCorpusBuildPreflight,
  isDirectRun,
  modeFromEnv,
  providerCorpusBuildHarnessConfig,
  runMockedProviderCorpusBuildHarness,
} from './provider-corpus-build-harness.ts'
import { providerCorpusManifest } from '../src/domain/providers/providerCorpusManifest.ts'

function main(): void {
  const mode = modeFromEnv()
  if (mode === 'live') {
    const preflight = evaluateProviderCorpusBuildPreflight({
      manifest: providerCorpusManifest,
      mode: 'live',
      outputRoot: providerCorpusBuildHarnessConfig.mockedOutputRoot,
    })
    process.stdout.write(`${JSON.stringify({ emitted: false, preflight }, null, 2)}\n`)
    process.exitCode = 1
    return
  }

  const result = runMockedProviderCorpusBuildHarness()
  process.stdout.write(
    `${JSON.stringify(
      {
        emitted: true,
        fetchCallCount: result.diagnostics.fetchCallCount,
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

if (isDirectRun(import.meta.url)) {
  try {
    main()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
