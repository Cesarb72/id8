import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  evaluateProviderCorpusBuildPreflight,
  getGitStatusShort,
  isGitIgnored,
  providerCorpusBuildHarnessConfig,
  removeMockedCorpusOutput,
  runLiveProviderCorpusBuildHarness,
  type ProviderCorpusBuildPreflightBlockCode,
} from './provider-corpus-build-harness.ts'
import {
  providerCorpusManifest,
  type ProviderCorpusManifest,
} from '../src/domain/providers/providerCorpusManifest.ts'
import { validateProviderCorpusArtifact } from '../src/domain/providers/providerCorpusArtifact.ts'
import { curatedVenues } from '../src/data/venues.ts'
import { promoteProviderCorpus } from '../src/domain/field/corpus/promoteProviderCorpus.ts'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'

const originalFetch = globalThis.fetch
const managedEnvKeys = [
  providerCorpusBuildHarnessConfig.approvalEnvKey,
  providerCorpusBuildHarnessConfig.budgetCapEnvKey,
  providerCorpusBuildHarnessConfig.keyEnvKey,
  providerCorpusBuildHarnessConfig.modeEnvKey,
  providerCorpusBuildHarnessConfig.realOutputDeleteApprovalEnvKey,
  providerCorpusBuildHarnessConfig.retrievalActivationEnvKey,
  providerCorpusBuildHarnessConfig.sourceModeEnvKey,
  'VITE_ID8_PROVIDER_BILLABLE_CALL_CAP',
  'VITE_GOOGLE_PLACES_ENDPOINT',
]
const originalEnvValues = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]] as const),
)

let fetchCallCount = 0
const placeholderKey = 'placeholder-live-corpus-key-not-real'

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function restoreEnv(): void {
  for (const key of managedEnvKeys) {
    const original = originalEnvValues.get(key)
    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
  }
}

function clearManagedEnv(): void {
  for (const key of managedEnvKeys) {
    delete process.env[key]
  }
}

function liveEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    [providerCorpusBuildHarnessConfig.approvalEnvKey]: '1',
    [providerCorpusBuildHarnessConfig.budgetCapEnvKey]: '12',
    [providerCorpusBuildHarnessConfig.keyEnvKey]: placeholderKey,
    [providerCorpusBuildHarnessConfig.modeEnvKey]: 'live',
    [providerCorpusBuildHarnessConfig.retrievalActivationEnvKey]: '1',
    [providerCorpusBuildHarnessConfig.sourceModeEnvKey]: 'hybrid',
    VITE_ID8_PROVIDER_BILLABLE_CALL_CAP: '12',
    ...overrides,
  }
}

function applyEnv(env: Record<string, string | undefined>): void {
  clearManagedEnv()
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      process.env[key] = value
    }
  }
}

function blockerCodes(
  result: ReturnType<typeof evaluateProviderCorpusBuildPreflight>,
): ProviderCorpusBuildPreflightBlockCode[] {
  return result.blockers.map((blocker) => blocker.code)
}

function assertBlockedBy(
  label: string,
  codes: ProviderCorpusBuildPreflightBlockCode[],
  expectedCode: ProviderCorpusBuildPreflightBlockCode,
): void {
  assert(codes.includes(expectedCode), `${label}: expected blocker ${expectedCode}, received ${codes.join(', ')}`)
}

function buildMalformedManifest(): ProviderCorpusManifest {
  return {
    ...providerCorpusManifest,
    entries: providerCorpusManifest.entries.slice(0, 11),
  }
}

function slugFromQuery(textQuery: string): string {
  return textQuery.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const mockedFetch: typeof fetch = async (input, init) => {
  fetchCallCount += 1
  const endpoint = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  assert(endpoint.includes('/v1/places:searchText'), `Unexpected endpoint: ${endpoint}`)
  const headers = new Headers(init?.headers)
  assert(headers.get('X-Goog-Api-Key') === placeholderKey, 'Expected placeholder key to be supplied only as request header.')
  const fieldMask = headers.get('X-Goog-FieldMask') ?? ''
  assert(fieldMask.includes('places.id'), 'Expected Places field mask.')
  for (const expectedField of [
    'places.currentOpeningHours.openNow',
    'places.currentOpeningHours.weekdayDescriptions',
    'places.currentOpeningHours.periods',
    'places.regularOpeningHours.weekdayDescriptions',
    'places.regularOpeningHours.periods',
  ]) {
    assert(fieldMask.includes(expectedField), `Expected Places field mask to include ${expectedField}.`)
  }
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { textQuery?: string } : {}
  const textQuery = body.textQuery ?? `missing-query-${fetchCallCount}`
  const slug = slugFromQuery(textQuery)
  return new Response(
    JSON.stringify({
      places: [
        {
          id: `mock_provider_${fetchCallCount}_${slug}`,
          displayName: {
            text: `Mock Provider ${fetchCallCount}`,
          },
          primaryType: 'restaurant',
          types: ['restaurant', 'point_of_interest', 'establishment'],
          formattedAddress: `${fetchCallCount} Mock Provider Way, San Jose, CA`,
          shortFormattedAddress: 'San Jose, CA',
          location: {
            latitude: 37.33 + fetchCallCount * 0.001,
            longitude: -121.89 - fetchCallCount * 0.001,
          },
          rating: 4.5,
          userRatingCount: 100 + fetchCallCount,
          businessStatus: 'OPERATIONAL',
          currentOpeningHours: {
            openNow: true,
            periods: [
              {
                open: { day: 1, hour: 10, minute: 0 },
                close: { day: 1, hour: 22, minute: 0 },
              },
            ],
            weekdayDescriptions: ['Monday: 10:00 AM - 10:00 PM'],
          },
          regularOpeningHours: {
            periods: [
              {
                open: { day: 1, hour: 8, minute: 0 },
                close: { day: 1, hour: 9, minute: 0 },
              },
            ],
            weekdayDescriptions: ['Monday: 10:00 AM - 10:00 PM'],
          },
        },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      status: 200,
    },
  )
}

function assertNoPlaceholderKey(path: string): void {
  const content = readFileSync(path, 'utf8')
  assert(!content.includes(placeholderKey), `Output leaked placeholder key: ${path}`)
}

function assertSharedRealRootDeleteBlocked(realFixtureRunDirectory: string): void {
  let blocked = false
  try {
    removeMockedCorpusOutput(providerCorpusBuildHarnessConfig.realOutputRoot)
  } catch {
    blocked = true
  }
  assert(blocked, 'Shared real corpus output root cleanup must require explicit approval.')
  assert(
    existsSync(realFixtureRunDirectory),
    'Shared real corpus output root cleanup guard must preserve existing real corpus directories.',
  )
}

async function main(): Promise<void> {
  globalThis.fetch = mockedFetch
  const outputRoot = providerCorpusBuildHarnessConfig.mockedLiveOutputRoot
  const realFixtureRunDirectory = join(
    providerCorpusBuildHarnessConfig.realOutputRoot,
    'fake-real-run-should-survive',
  )
  mkdirSync(realFixtureRunDirectory, { recursive: true })
  writeFileSync(join(realFixtureRunDirectory, 'sentinel.txt'), 'fake real corpus fixture\n', 'utf8')
  assertSharedRealRootDeleteBlocked(realFixtureRunDirectory)
  const ignoredProbePath = join(outputRoot, '.gitkeep').replace(/\\/g, '/')
  const tmpIgnored = isGitIgnored(ignoredProbePath)
  assert(tmpIgnored, `mocked live output path must be ignored before output is written: ${ignoredProbePath}`)

  const withoutApproval = evaluateProviderCorpusBuildPreflight({
    env: liveEnv({ [providerCorpusBuildHarnessConfig.approvalEnvKey]: undefined }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!withoutApproval.allowed, 'Live preflight must block without approval.')
  assertBlockedBy('without approval', blockerCodes(withoutApproval), 'live_execution_not_approved')

  const withoutKey = evaluateProviderCorpusBuildPreflight({
    env: liveEnv({ [providerCorpusBuildHarnessConfig.keyEnvKey]: undefined }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!withoutKey.allowed, 'Live preflight must block without key.')
  assertBlockedBy('without key', blockerCodes(withoutKey), 'missing_provider_key')

  const withoutRetrievalActivation = evaluateProviderCorpusBuildPreflight({
    env: liveEnv({ [providerCorpusBuildHarnessConfig.retrievalActivationEnvKey]: undefined }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!withoutRetrievalActivation.allowed, 'Live preflight must block without retrieval activation.')
  assertBlockedBy(
    'without retrieval activation',
    blockerCodes(withoutRetrievalActivation),
    'missing_retrieval_activation',
  )

  const withoutBudgetCap = evaluateProviderCorpusBuildPreflight({
    env: liveEnv({ [providerCorpusBuildHarnessConfig.budgetCapEnvKey]: undefined }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!withoutBudgetCap.allowed, 'Live preflight must block without budget cap.')
  assertBlockedBy('without budget cap', blockerCodes(withoutBudgetCap), 'missing_budget_cap')

  const excessiveBudgetCap = evaluateProviderCorpusBuildPreflight({
    env: liveEnv({ [providerCorpusBuildHarnessConfig.budgetCapEnvKey]: '13' }),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!excessiveBudgetCap.allowed, 'Live preflight must block with budget cap above allowed value.')
  assertBlockedBy('excessive budget cap', blockerCodes(excessiveBudgetCap), 'invalid_budget_cap')

  const malformedManifest = evaluateProviderCorpusBuildPreflight({
    env: liveEnv(),
    gitStatusShort: '',
    manifest: buildMalformedManifest(),
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(!malformedManifest.allowed, 'Live preflight must block malformed manifest.')
  assertBlockedBy('malformed manifest', blockerCodes(malformedManifest), 'manifest_query_count_invalid')

  const readyPreflight = evaluateProviderCorpusBuildPreflight({
    env: liveEnv(),
    gitStatusShort: '',
    manifest: providerCorpusManifest,
    mode: 'live',
    outputRoot,
    runtimeImportHits: [],
    tmpIgnored,
  })
  assert(readyPreflight.allowed, `Expected live preflight to allow mocked fetch execution, received ${blockerCodes(readyPreflight).join(', ')}`)

  const runId = 'live-harness-test-run'
  removeMockedCorpusOutput(join(outputRoot, runId))
  applyEnv(liveEnv())
  const result = await runLiveProviderCorpusBuildHarness({
    allowMockedLiveOutputRoot: true,
    gitStatusShort: '',
    outputRoot,
    runId,
  })

  const artifactValidation = validateProviderCorpusArtifact(result.artifact)
  assert(artifactValidation.valid, `Provider artifact validation failed: ${artifactValidation.errors.join('; ')}`)
  assert(result.artifact.source === 'provider', 'Expected provider artifact source.')
  assert(result.report.reportVersion === 'provider-corpus-review.v1', 'Expected review report v1.')
  assert(result.report.gate1Readiness === 'ready', `Expected ready review report, received ${result.report.gate1Readiness}.`)
  assert(fetchCallCount === 12, `Expected exactly 12 mocked fetch calls, received ${fetchCallCount}.`)
  assert(result.ledger.totalAttempted === 12, `Expected 12 attempted provider traces, received ${result.ledger.totalAttempted}.`)
  assert(result.ledger.totalAttemptedHttpRequests === 12, `Expected 12 attempted HTTP requests, received ${result.ledger.totalAttemptedHttpRequests}.`)
  assert(result.ledger.totalBillable === 12, `Expected 12 billable calls, received ${result.ledger.totalBillable}.`)
  assert(result.ledger.byPurpose.retrieval_supply === 12, `Expected 12 retrieval_supply traces, received ${result.ledger.byPurpose.retrieval_supply}.`)
  assert(result.ledger.byPurpose.details_lookup === 0, 'Expected no details_lookup traces.')
  assert(result.diagnostics.attemptedHttpRequestCount === 12, 'Expected diagnostics attempted HTTP request count 12.')
  assert(result.diagnostics.billableCallCount === 12, 'Expected diagnostics billable count 12.')
  assert(result.diagnostics.runtimeImportHits.length === 0, 'Expected no runtime imports.')
  const structuredVenue = result.artifact.venues[0]
  assert(structuredVenue !== undefined, 'Expected mocked live artifact to include venues.')
  const structuredPeriods = structuredVenue.rawPlace.hoursPeriods ?? []
  assert(
    structuredPeriods.length === 1,
    'Mocked live provider periods must survive into RawPlace.hoursPeriods.',
  )
  assert(
    structuredPeriods[0]?.open?.hour === 10,
    'RawPlace.hoursPeriods must prefer currentOpeningHours.periods over regularOpeningHours.periods.',
  )
  const normalizedFromStructuredPeriods = normalizeVenue(
    {
      ...structuredVenue.rawPlace,
      currentOpeningHoursText: undefined,
      openNow: undefined,
      regularOpeningHoursText: undefined,
    },
    {
      timeWindowSignal: {
        day: 1,
        hour: 12,
        minute: 0,
        phase: 'afternoon',
        label: 'Monday noon',
        usesIntentWindow: true,
      },
    },
  )
  assert(
    normalizedFromStructuredPeriods.source.likelyOpenForCurrentWindow === true,
    'normalizeVenue/inferHoursPressure must be able to evaluate preserved RawPlace.hoursPeriods.',
  )
  const promoted = promoteProviderCorpus({
    artifact: result.artifact,
    sourceRunId: 'mocked-live-structured-period-survival',
    staticVenues: curatedVenues,
  })
  const promotedStructuredVenue = promoted.venues.find(
    (venue) => venue.providerProvenance.providerRecordId === structuredVenue.providerRecordId,
  )
  assert(
    promotedStructuredVenue?.runtimeHoursProof.structuredPeriods.length === 1,
    'Promoted runtimeHoursProof.structuredPeriods must preserve mocked provider structured periods.',
  )
  assert(
    promotedStructuredVenue.runtimeHoursProof.proofSource === 'structured_periods',
    'Promoted runtimeHoursProof.proofSource must mark structured periods as structured_periods.',
  )

  for (const path of Object.values(result.outputPaths)) {
    assert(path.startsWith('tmp/provider-corpus/mock-live/'), `Output path must stay under mock-live tmp root: ${path}`)
    assert(existsSync(path), `Expected mocked live output file to exist: ${path}`)
    assertNoPlaceholderKey(path)
  }
  removeMockedCorpusOutput(join(outputRoot, runId))
  assert(
    existsSync(realFixtureRunDirectory),
    'Mocked live harness cleanup must not delete existing real corpus output directories.',
  )
  rmSync(realFixtureRunDirectory, { force: true, recursive: true })
  const tmpOutputStatus = getGitStatusShort('tmp/provider-corpus')
  assert(tmpOutputStatus.length === 0, `Expected provider corpus tmp output not to appear in git status, received ${tmpOutputStatus}.`)

  process.stdout.write('provider corpus live build harness mocked validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        gate1Readiness: result.report.gate1Readiness,
        ledger: result.ledger,
        outputPathRoot: outputRoot,
        structuredPeriodSurvival: {
          normalizedLikelyOpenForMondayNoon:
            normalizedFromStructuredPeriods.source.likelyOpenForCurrentWindow,
          promotedProofSource: promotedStructuredVenue.runtimeHoursProof.proofSource,
          rawPlacePeriodCount: structuredPeriods.length,
          rawPlacePreferredOpenHour: structuredPeriods[0]?.open?.hour,
        },
        preflightBlockingConfirmed: {
          excessiveBudgetCap: blockerCodes(excessiveBudgetCap),
          malformedManifest: blockerCodes(malformedManifest),
          withoutApproval: blockerCodes(withoutApproval),
          withoutBudgetCap: blockerCodes(withoutBudgetCap),
          withoutKey: blockerCodes(withoutKey),
          withoutRetrievalActivation: blockerCodes(withoutRetrievalActivation),
        },
        realFixtureSurvivedMockedCleanup: true,
        runtimeImportHits: result.diagnostics.runtimeImportHits,
        tmpIgnored,
        tmpOutputStatusAfterWrite: tmpOutputStatus,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}).finally(() => {
  globalThis.fetch = originalFetch
  restoreEnv()
})
