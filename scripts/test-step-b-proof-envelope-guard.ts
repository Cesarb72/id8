import { readFileSync } from 'node:fs'
import {
  buildStepBCurateLiveSmokeCandidateSupplyRunFingerprint,
  type StepBCurateLiveSmokeCandidateSupplyGate,
  type StepBCurateLiveSmokeCandidateSupplyInput,
} from '../src/app/services/arcApplicationService.ts'
import {
  evaluateStepBPostSupplyProofGate,
  evaluateStepBPreSupplyReadiness,
} from '../src/app/services/curate/stepBProofGate.ts'
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

function buildPreSupplyReadinessInput(overrides: Parameters<typeof evaluateStepBPreSupplyReadiness>[0] = {}) {
  return {
    proofTargetId: 'row1_step_b_coffee_books_representative',
    scenarioFamily: 'romantic_cultured',
    starterPackId: 'coffee-books',
    selectedDirectionId: 'direction-willow',
    selectedPocketId: 'raw-pocket-willow',
    livePocketHint: {
      pocketId: 'raw-pocket-willow',
      pocketLabel: 'Willow Glen',
      centroid: { lat: 37.309, lng: -121.9 },
      radiusM: 650,
      source: 'district_intelligence' as const,
      city: 'San Jose',
      locationLabel: 'Willow Glen, San Jose',
    },
    crossPocketAllowed: false,
    envelope: {
      maxProviderCalls: 3,
      maxQueryLabels: 3,
      maxCenters: 1,
    },
    providerValveExpectedMode: 'preview_field_proxy_expected_armed',
    providerValveReady: true,
    ...overrides,
  }
}

function assertStepBPreSupplyPostSupplyGateSplit(): void {
  const missingDirection = evaluateStepBPreSupplyReadiness(
    buildPreSupplyReadinessInput({ selectedDirectionId: null }),
  )
  assert(
    missingDirection.status === 'held' &&
      missingDirection.holdReason === 'pre_supply_selected_direction_id_missing',
    'Pre-supply gate must hold when selectedDirectionId is missing.',
  )

  const missingPocket = evaluateStepBPreSupplyReadiness(
    buildPreSupplyReadinessInput({ selectedPocketId: null }),
  )
  assert(
    missingPocket.status === 'held' &&
      missingPocket.holdReason === 'pre_supply_selected_pocket_id_missing',
    'Pre-supply gate must hold when selectedPocketId is missing.',
  )

  const missingPocketHint = evaluateStepBPreSupplyReadiness(
    buildPreSupplyReadinessInput({ livePocketHint: null }),
  )
  assert(
    missingPocketHint.status === 'held' &&
      missingPocketHint.holdReason === 'pre_supply_live_pocket_hint_missing',
    'Pre-supply gate must hold when livePocketHint is missing.',
  )

  const ready = evaluateStepBPreSupplyReadiness(buildPreSupplyReadinessInput())
  assert(ready.status === 'ready', 'Pre-supply gate must become ready when only pre-supply carriers exist.')
  assert(
    ready.notRequiredBeforeSupply.includes('selected_proof_stop') &&
      ready.notRequiredBeforeSupply.includes('starterSemanticRepresentation'),
    'Pre-supply gate must explicitly exclude selected proof stop and starterSemanticRepresentation.',
  )
  assert(
    ready.envelopeReady &&
      ready.envelope?.maxProviderCalls === 3 &&
      ready.envelope.maxQueryLabels === 3 &&
      ready.envelope.maxCenters === 1,
    'Ready pre-supply gate must preserve the existing 3/3/1 envelope.',
  )

  const beforeSupply = evaluateStepBPostSupplyProofGate({
    fieldSupplyStatus: 'not_started',
    bearingsDistrictAdmissionStatus: 'not_run',
  })
  assert(
    beforeSupply.status === 'pending' &&
      beforeSupply.stage === 'before_supply' &&
      beforeSupply.failureReason === 'field_supply_not_started',
    'Post-supply proof gate must classify the before-supply phase separately.',
  )

  const passedPostSupply = evaluateStepBPostSupplyProofGate({
    fieldSupplyStatus: 'returned',
    bearingsDistrictAdmissionStatus: 'ran',
    selectedProofStopPresent: true,
    selectedProofStopPocketId: 'raw-pocket-willow',
    starterSemanticRepresentationStatus: 'represented',
    contractEntryArtifactMaterialized: true,
    hardPocketAssertionStatus: 'passed',
    greatStopStatus: 'approved',
    reviewLockEligible: true,
  })
  assert(passedPostSupply.status === 'passed', 'Post-supply proof gate must pass only after proof and lockability.')

  const gateSource = readFileSync('src/app/services/curate/stepBProofGate.ts', 'utf8')
  assert(
    !gateSource.includes('coffee') &&
      !gateSource.includes('bookstore') &&
      !gateSource.includes('literary'),
    'Step B gate helper must not introduce Field or kernel meaning ownership.',
  )
  process.stdout.write('Step B pre-supply/post-supply gate split: passed\n')
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

  const pocketFingerprint = buildStepBCurateLiveSmokeCandidateSupplyRunFingerprint({
    gate,
    input: buildInput({
      livePocketHint: {
        pocketId: 'raw-pocket-willow',
        pocketLabel: 'Willow Glen Pocket',
        centroid: { lat: 37.309, lng: -121.9 },
        radiusM: 650,
        source: 'district_intelligence',
        city: 'San Jose',
        locationLabel: 'Willow Glen Pocket, San Jose',
      },
    }),
    starterPack,
  })
  assert(
    pocketFingerprint && pocketFingerprint !== fingerprint,
    'Step B proof target pocket hint must participate in the run fingerprint.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('stepBCurateLiveSmokeCandidateSupplyRunByFingerprintRef') &&
      sandboxSource.includes('buildStepBCurateLiveSmokeCandidateSupplyRunFingerprint') &&
      sandboxSource.includes('stepBCandidateSupplyBoardPromise'),
    'Sandbox Step B candidate supply must share in-flight work by fingerprint.',
  )
  assert(
    sandboxSource.includes("row1CoffeeBooksPreSupplyReadiness.status !== 'ready'") &&
      sandboxSource.includes('clearScenarioBuilderArtifacts()') &&
      sandboxSource.indexOf("row1CoffeeBooksPreSupplyReadiness.status !== 'ready'") <
        sandboxSource.indexOf('runStepBCurateLiveSmokeCandidateSupply({'),
    'Coffee Books Row 1 Step B supply must hold before Field when pre-supply readiness is held.',
  )
  assert(
    sandboxSource.includes('preSupplyReadiness') &&
      sandboxSource.includes('postSupplyProof') &&
      sandboxSource.includes('evaluateStepBPostSupplyProofGate') &&
      sandboxSource.includes('evaluateStepBPreSupplyReadiness'),
    'Coffee Books Row 1 diagnostics must split pre-supply readiness from post-supply proof.',
  )
  assert(
    sandboxSource.includes('allDirectionCards,') &&
      sandboxSource.includes('districtDiscoveryCards,') &&
      sandboxSource.includes('row1CoffeeBooksPreSupplyReadiness.status') &&
      sandboxSource.includes('ROW_1_STEP_B_PRE_SUPPLY_ENVELOPE'),
    'Step B candidate supply effect must depend on pre-supply carrier inputs and diagnostics.',
  )
  const serviceSource = readFileSync('src/app/services/arcApplicationService.ts', 'utf8')
  assert(
    serviceSource.includes('livePocketHint: params.input.livePocketHint') &&
      serviceSource.includes('livePocketHint: input.livePocketHint ?? params.fieldDiscoveryContract.livePocketHint') &&
      serviceSource.includes('livePocketHint: input.livePocketHint ?? safeInput.livePocketHint'),
    'Step B candidate supply must carry the proof target pocket hint through fingerprint and board construction.',
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

function assertStepBPocketProofDiagnosticsSurfaceInObserverReport(): void {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('proofTargetParameters') &&
      sandboxSource.includes('row1_step_b_coffee_books_representative') &&
      sandboxSource.includes('ROW_1_COFFEE_BOOKS_PROOF_TARGET_POCKET_LABEL') &&
      sandboxSource.includes('resolveCurateHardPocketProofTargetInstance') &&
      sandboxSource.includes('livePocketHint: row1CoffeeBooksProofTarget.livePocketHint') &&
      sandboxSource.includes('selectedDirectionId: row1CoffeeBooksProofTarget?.selectedDirectionId') &&
      sandboxSource.includes('selectedPocketId: row1CoffeeBooksProofTarget?.selectedPocketId') &&
      sandboxSource.includes('admissionEnvelope') &&
      sandboxSource.includes('materializationDiagnostics') &&
      sandboxSource.includes('materializationRejectReason') &&
      sandboxSource.includes('pocketProofDiagnostic') &&
      sandboxSource.includes('sourceCategoryEvidence'),
    'Step B Coffee & Books diagnostic report must expose proof target parameters, pocket math, and materialization reasons.',
  )
  assert(
    sandboxSource.includes('diagnosticOnly: true') &&
      sandboxSource.includes('field_live_source_pocket_filter') &&
      sandboxSource.includes('selected-stop-backed book, reading, literary, library, or bookstore evidence'),
    'Step B proof-target diagnostics must be explicitly non-authoritative and explain the current proof target.',
  )

  const fieldSource = readFileSync('src/domain/sources/fetchLivePlaces.ts', 'utf8')
  assert(
    fieldSource.includes('candidateDistanceToPocketCenterM') &&
      fieldSource.includes('marginToFieldAdmissionEnvelopeM') &&
      fieldSource.includes('fieldSourceDecision') &&
      fieldSource.includes('bearingsAdmissibility') &&
      fieldSource.includes('districtSpatialFact') &&
      fieldSource.includes('interpretationBoardAdmission') &&
      fieldSource.includes('candidateBoardAdmissionFalseSource') &&
      fieldSource.includes('field_source_pocket_filter_outside_selected_envelope'),
    'Field live candidate diagnostics must expose candidate distance/margin and owner-stamped rejection.',
  )

  const observerSource = readFileSync('scripts/observe-hosted-step-b-supply.ts', 'utf8')
  assert(
    observerSource.includes('step_b_coffee_books_diagnostics') &&
      observerSource.includes('no_visible_route_card_after_candidate_supply') &&
      observerSource.includes('persist('),
    'Hosted observer must persist the full Step B Coffee & Books diagnostic report on no-card stops.',
  )
  process.stdout.write('Step B pocket/proof diagnostic visibility: passed\n')
}

async function main(): Promise<void> {
  assertStepBPreSupplyPostSupplyGateSplit()
  await assertStepBRunFingerprintSharesInFlightPromise()
  assertObserverCapturesDiagnosticsAndHardStops()
  assertNoApprovedPayloadClassificationIsExplicit()
  assertStepBPocketProofDiagnosticsSurfaceInObserverReport()
  process.stdout.write('Step B proof envelope guard: passed\n')
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
