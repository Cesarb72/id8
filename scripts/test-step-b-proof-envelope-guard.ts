import { readFileSync } from 'node:fs'
import {
  buildStepBCurateLiveSmokeCandidateSupplyRunFingerprint,
  type StepBCurateLiveSmokeCandidateSupplyGate,
  type StepBCurateLiveSmokeCandidateSupplyInput,
} from '../src/app/services/arcApplicationService.ts'
import {
  formatStepBFieldProxyEnvelopeBreach,
  summarizeFieldProxyBody,
  summarizeStepBFieldProxyPostEnvelope,
  summarizeStepBNoCardDiagnostics,
} from './observe-hosted-step-b-supply.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import type { StopTypeCandidateBoard } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function buildGate(): StepBCurateLiveSmokeCandidateSupplyGate {
  return {
    environment: 'default',
    pathname: '/start/curate',
    isPublicSurface: true,
    mode: 'curate',
    inputMode: 'curate',
    phase: 'candidate_supply',
    selectedStarterPackPresent: true,
    userSourceModeOverrideApplied: false,
    smokeSwitchEnabled: true,
  }
}

function buildInput(overrides: Partial<StepBCurateLiveSmokeCandidateSupplyInput> = {}): StepBCurateLiveSmokeCandidateSupplyInput {
  return {
    city: 'San Jose',
    mode: 'curate',
    persona: 'romantic',
    vibe: 'cozy',
    sourceMode: 'curated',
    ...overrides,
  }
}

async function assertStepBRunFingerprintSharesInFlightPromise(): Promise<void> {
  const starterPack = starterPacks.find((entry) => entry.id === 'coffee-books') ?? null
  const gate = buildGate()
  const input = buildInput()
  const fingerprint = buildStepBCurateLiveSmokeCandidateSupplyRunFingerprint({
    gate,
    input,
    starterPack,
  })
  assert(fingerprint, 'Step B proof input must produce a run fingerprint.')

  let runCount = 0
  const byFingerprint = new Map<string, Promise<StopTypeCandidateBoard | null>>()
  const runGuarded = (key: string): Promise<StopTypeCandidateBoard | null> => {
    let promise = byFingerprint.get(key)
    if (!promise) {
      runCount += 1
      promise = Promise.resolve(null)
      byFingerprint.set(key, promise)
    }
    return promise
  }

  const [first, second] = await Promise.all([runGuarded(fingerprint), runGuarded(fingerprint)])
  assert(first === second, 'Duplicate Step B proof input must share the same in-flight result.')
  assert(runCount === 1, `Duplicate Step B proof input must run once; received ${runCount}.`)

  const nextFingerprint = buildStepBCurateLiveSmokeCandidateSupplyRunFingerprint({
    gate,
    input: buildInput({ city: 'Oakland' }),
    starterPack,
  })
  assert(nextFingerprint && nextFingerprint !== fingerprint, 'Legitimate new Step B input must get a new fingerprint.')
  await runGuarded(nextFingerprint)
  assert(runCount === 2, 'Legitimate new Step B input must still be allowed to run.')

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('stepBCurateLiveSmokeCandidateSupplyRunByFingerprintRef') &&
      sandboxSource.includes('buildStepBCurateLiveSmokeCandidateSupplyRunFingerprint') &&
      sandboxSource.includes('stepBCandidateSupplyBoardPromise'),
    'Sandbox Step B candidate supply must share in-flight work by fingerprint.',
  )
  process.stdout.write('Step B run-once/in-flight fingerprint guard: passed\n')
}

function assertObserverCapturesDiagnosticsAndHardStops(): void {
  const bodySummary = summarizeFieldProxyBody(
    JSON.stringify({
      diagnostics: {
        callConsumed: true,
        providerStatus: 'google_places_text_search',
      },
      budget: {
        used: 4,
        remaining: 28,
      },
      results: [{ name: 'Academic Coffee' }],
    }),
  )
  assert(bodySummary.callConsumed === true, 'Observer must read diagnostics.callConsumed.')
  assert(
    bodySummary.providerStatus === 'google_places_text_search',
    'Observer must read diagnostics.providerStatus.',
  )

  const envelopeSummary = summarizeStepBFieldProxyPostEnvelope({
    networkRequests: [
      {
        requestId: '1',
        method: 'POST',
        isFieldProxy: true,
        queryLabel: 'coffee-books-start-reading@pocket',
        status: 200,
      },
      {
        requestId: '2',
        method: 'POST',
        isFieldProxy: true,
        queryLabel: 'coffee-books-start-reading@pocket',
        status: 200,
      },
      {
        requestId: '3',
        method: 'POST',
        isFieldProxy: true,
        queryLabel: 'coffee-books-highlight-culture@pocket',
        status: 200,
      },
      {
        requestId: '4',
        method: 'POST',
        isFieldProxy: true,
        queryLabel: 'coffee-books-wind-down-literary@pocket',
        status: null,
      },
    ],
    fieldProxyCalls: [
      {
        requestId: '1',
        queryLabel: 'coffee-books-start-reading@pocket',
        cache: 'miss',
        callConsumed: true,
        providerStatus: 'google_places_text_search',
        budget: { used: 2 },
      },
    ],
  })
  assert(envelopeSummary.exceeded, 'Observer must classify a fourth Field proxy POST as an envelope breach.')
  assert(envelopeSummary.postCount === 4, `Expected 4 Field proxy POSTs, received ${envelopeSummary.postCount}.`)
  const breachMessage = formatStepBFieldProxyEnvelopeBreach(envelopeSummary)
  assert(
    breachMessage.includes('4/3') &&
      breachMessage.includes('coffee-books-wind-down-literary@pocket') &&
      breachMessage.includes('budget.used=2'),
    'Observer breach message must include count, labels, and completed budget evidence.',
  )

  const observerSource = readFileSync('scripts/observe-hosted-step-b-supply.ts', 'utf8')
  assert(
    observerSource.includes('field_proxy_post_envelope_breach') &&
      observerSource.includes('assertNoFieldProxyEnvelopeBreach'),
    'Hosted observer must hard-stop when the Field proxy POST envelope is exceeded.',
  )
  process.stdout.write('observer Step B envelope diagnostics: passed\n')
}

function assertNoApprovedPayloadClassificationIsExplicit(): void {
  const noCardSummary = summarizeStepBNoCardDiagnostics({
    present: true,
    diagnostic: {
      artifactCardAdmission: {
        primaryCardDisplayMode: 'no_qualified_fallback',
        qualifiedRouteCardCount: 0,
        artifactDiagnostics: [
          {
            qualificationStatus: 'runtime_error',
            rejectionReason: 'no_approved_payload',
            hasApprovedPayload: false,
          },
        ],
        qualificationDiagnostics: [
          {
            qualificationStatus: 'runtime_error',
            explicitFallbackReason: 'curate_preflight_runtime_error:GreatStopGateSelectionError',
          },
        ],
      },
      publicNoCardState: {
        reviewCtaExpectedVisible: false,
      },
    },
  })

  assert(
    noCardSummary.classification === 'great_stop_no_approved_payload',
    `Expected Great Stop no-approved-payload classification, received ${noCardSummary.classification}.`,
  )
  assert(noCardSummary.qualifiedRouteCardCount === 0, 'No approved payload must keep qualifiedRouteCardCount at 0.')
  assert(
    noCardSummary.reviewCtaExpectedVisible === false,
    'Great Stop honest-fail must continue suppressing Review/Lock.',
  )

  const observerSource = readFileSync('scripts/observe-hosted-step-b-supply.ts', 'utf8')
  assert(
    observerSource.includes('step_b_no_card_classification') &&
      observerSource.includes('No visible route card found after Step B candidate supply.') &&
      !observerSource.includes('return\n    }\n    const selectedCardArtifactId'),
    'Hosted observer must not mask a no-card proof failure behind finalError:null.',
  )
  process.stdout.write('Step B no_approved_payload classification: passed\n')
}

async function main(): Promise<void> {
  await assertStepBRunFingerprintSharesInFlightPromise()
  assertObserverCapturesDiagnosticsAndHardStops()
  assertNoApprovedPayloadClassificationIsExplicit()
  process.stdout.write('Step B proof envelope guard: passed\n')
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
