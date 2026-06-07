import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  evaluateProviderCorpusBuildPreflight,
  getGitStatusShort,
  isGitIgnored,
  providerCorpusBuildHarnessConfig,
  removeMockedCorpusOutput,
  runMockedProviderCorpusBuildHarness,
  type ProviderCorpusBuildPreflightBlockCode,
} from './provider-corpus-build-harness.ts'
import {
  providerCorpusManifest,
  type ProviderCorpusManifest,
} from '../src/domain/providers/providerCorpusManifest.ts'
import { validateProviderCorpusArtifact } from '../src/domain/providers/providerCorpusArtifact.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Provider corpus build harness test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function assertBlockedBy(
  label: string,
  codes: ProviderCorpusBuildPreflightBlockCode[],
  expectedCode: ProviderCorpusBuildPreflightBlockCode,
): void {
  assert(codes.includes(expectedCode), `${label}: expected blocker ${expectedCode}, received ${codes.join(', ')}`)
}

function blockerCodes(
  result: ReturnType<typeof evaluateProviderCorpusBuildPreflight>,
): ProviderCorpusBuildPreflightBlockCode[] {
  return result.blockers.map((blocker) => blocker.code)
}

function cleanEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    [providerCorpusBuildHarnessConfig.approvalEnvKey]: undefined,
    [providerCorpusBuildHarnessConfig.keyEnvKey]: undefined,
    [providerCorpusBuildHarnessConfig.retrievalActivationEnvKey]: undefined,
    ...overrides,
  }
}

function buildMalformedManifest(): ProviderCorpusManifest {
  return {
    ...providerCorpusManifest,
    entries: providerCorpusManifest.entries.slice(0, 11),
  }
}

function buildMalformedCapManifest(): ProviderCorpusManifest {
  const [firstEntry, ...remainingEntries] = providerCorpusManifest.entries
  if (!firstEntry) {
    throw new Error('Expected provider corpus manifest to contain entries.')
  }
  return {
    ...providerCorpusManifest,
    entries: [
      {
        ...firstEntry,
        maxCalls: 2,
        maxCenters: 2,
      },
      ...remainingEntries,
    ],
  }
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function main(): void {
  globalThis.fetch = fetchTrap
  const outputRoot = providerCorpusBuildHarnessConfig.mockedOutputRoot
  const ignoredProbePath = join(outputRoot, '.gitkeep').replace(/\\/g, '/')
  const tmpIgnored = isGitIgnored(ignoredProbePath)
  assert(tmpIgnored, `tmp output path must be ignored before mocked output is written: ${ignoredProbePath}`)

  const defaultMockedPreflight = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv(),
    gitStatusShort: 'M mocked-mode-allows-dirty-status',
    manifest: providerCorpusManifest,
    mode: 'mocked',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(defaultMockedPreflight.allowed, 'Default mocked preflight should allow no-call execution.')

  const mockedWithKey = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv({
      [providerCorpusBuildHarnessConfig.keyEnvKey]: 'placeholder-not-used',
    }),
    manifest: providerCorpusManifest,
    mode: 'mocked',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!mockedWithKey.allowed, 'Mocked preflight must block if provider key is present.')
  assertBlockedBy('mocked with key', blockerCodes(mockedWithKey), 'provider_key_present_in_mocked_mode')

  const mockedWithApproval = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv({
      [providerCorpusBuildHarnessConfig.approvalEnvKey]: '1',
    }),
    manifest: providerCorpusManifest,
    mode: 'mocked',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!mockedWithApproval.allowed, 'Mocked preflight must block if live approval flag is present.')
  assertBlockedBy(
    'mocked with approval',
    blockerCodes(mockedWithApproval),
    'approval_flag_present_in_mocked_mode',
  )

  const liveWithoutApproval = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv({
      [providerCorpusBuildHarnessConfig.keyEnvKey]: 'placeholder-not-used',
      [providerCorpusBuildHarnessConfig.retrievalActivationEnvKey]: '1',
    }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!liveWithoutApproval.allowed, 'Live preflight must block without approval.')
  assertBlockedBy('live without approval', blockerCodes(liveWithoutApproval), 'live_execution_not_approved')

  const liveWithoutKey = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv({
      [providerCorpusBuildHarnessConfig.approvalEnvKey]: '1',
      [providerCorpusBuildHarnessConfig.retrievalActivationEnvKey]: '1',
    }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!liveWithoutKey.allowed, 'Live preflight must block without corpus-build key.')
  assertBlockedBy('live without key', blockerCodes(liveWithoutKey), 'missing_provider_key')

  const liveWithoutRetrievalActivation = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv({
      [providerCorpusBuildHarnessConfig.approvalEnvKey]: '1',
      [providerCorpusBuildHarnessConfig.keyEnvKey]: 'placeholder-not-used',
    }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!liveWithoutRetrievalActivation.allowed, 'Live preflight must block without retrieval activation.')
  assertBlockedBy(
    'live without retrieval activation',
    blockerCodes(liveWithoutRetrievalActivation),
    'missing_retrieval_activation',
  )

  const missingManifest = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv(),
    manifest: undefined,
    mode: 'mocked',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!missingManifest.allowed, 'Preflight must block missing manifest.')
  assertBlockedBy('missing manifest', blockerCodes(missingManifest), 'manifest_missing')

  const malformedManifest = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv(),
    manifest: buildMalformedManifest(),
    mode: 'mocked',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!malformedManifest.allowed, 'Preflight must block malformed manifest.')
  assertBlockedBy('malformed manifest', blockerCodes(malformedManifest), 'manifest_query_count_invalid')

  const malformedCapManifest = evaluateProviderCorpusBuildPreflight({
    env: cleanEnv(),
    manifest: buildMalformedCapManifest(),
    mode: 'mocked',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!malformedCapManifest.allowed, 'Preflight must block malformed manifest caps.')
  assertBlockedBy('malformed maxCenters', blockerCodes(malformedCapManifest), 'query_max_centers_invalid')
  assertBlockedBy('malformed maxCalls', blockerCodes(malformedCapManifest), 'query_max_calls_invalid')

  const runId = 'harness-test-run'
  removeMockedCorpusOutput(outputRoot)
  const result = runMockedProviderCorpusBuildHarness({
    env: cleanEnv(),
    outputRoot,
    runId,
  })

  const artifactValidation = validateProviderCorpusArtifact(result.artifact)
  assert(artifactValidation.valid, `Mocked artifact validation failed: ${artifactValidation.errors.join('; ')}`)
  assert(result.report.reportVersion === 'provider-corpus-review.v1', 'Expected mocked review report v1.')
  assert(result.report.gate1Readiness === 'ready', `Expected ready review report, received ${result.report.gate1Readiness}.`)
  assert(result.ledger.totalAttempted === 0, 'Expected mocked ledger totalAttempted to remain 0.')
  assert(result.ledger.totalAttemptedHttpRequests === 0, 'Expected mocked ledger attempted HTTP requests to remain 0.')
  assert(result.ledger.totalBillable === 0, 'Expected mocked ledger totalBillable to remain 0.')
  assert(result.diagnostics.attemptedHttpRequestCount === 0, 'Expected diagnostics attempted HTTP requests to remain 0.')
  assert(result.diagnostics.billableCallCount === 0, 'Expected diagnostics billable calls to remain 0.')
  assert(fetchCallCount === 0, `Expected fetch not to be called, received ${fetchCallCount}.`)
  assert(result.diagnostics.runtimeImportHits.length === 0, 'Expected no runtime imports.')

  for (const path of Object.values(result.outputPaths)) {
    assert(path.startsWith('tmp/provider-corpus/mock/'), `Output path must stay under tmp/provider-corpus/mock/: ${path}`)
    assert(existsSync(path), `Expected mocked output file to exist: ${path}`)
    assert(readJsonFile(path) !== null, `Expected mocked output file to contain JSON: ${path}`)
  }

  const tmpOutputStatus = getGitStatusShort(outputRoot)
  assert(tmpOutputStatus.length === 0, `Expected mocked tmp output not to appear in git status, received ${tmpOutputStatus}.`)
  removeMockedCorpusOutput(outputRoot)

  process.stdout.write('provider corpus build harness mocked validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        gate1Readiness: result.report.gate1Readiness,
        ledger: result.ledger,
        manifestQueryCount: result.artifact.manifestQueryCount,
        outputPathRoot: outputRoot,
        preflightBlockingConfirmed: {
          liveWithoutApproval: blockerCodes(liveWithoutApproval),
          liveWithoutKey: blockerCodes(liveWithoutKey),
          liveWithoutRetrievalActivation: blockerCodes(liveWithoutRetrievalActivation),
          malformedManifest: blockerCodes(malformedManifest),
          mockedWithApproval: blockerCodes(mockedWithApproval),
          mockedWithKey: blockerCodes(mockedWithKey),
          missingManifest: blockerCodes(missingManifest),
        },
        runtimeImportHits: result.diagnostics.runtimeImportHits,
        tmpIgnored,
        tmpOutputStatusAfterWrite: tmpOutputStatus,
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
