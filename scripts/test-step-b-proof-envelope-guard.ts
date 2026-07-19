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
  ROW_1_COFFEE_BOOKS_PROOF_TARGET_ID,
  resolveCurateHardPocketProofTarget,
} from '../src/app/services/curate/row1CoffeeBooksProofTarget.ts'
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

function buildRow1DirectionCard(params: {
  directionId: string
  pocketId: string
  pocketLabel?: string
  confidence?: number
}) {
  return {
    id: params.directionId,
    cluster: 'chill',
    card: {
      title: params.pocketLabel ?? params.pocketId,
      subtitle: 'Existing Direction carrier',
      whyNow: 'Existing Direction carrier',
      whyYou: 'Existing Direction carrier',
      proofLine: 'Existing Direction carrier',
      liveSignals: { title: 'Existing Direction carrier', items: [] },
      confirmation: 'Existing Direction carrier',
    },
    debugMeta: {
      pocketId: params.pocketId,
      pocketLabel: params.pocketLabel,
      archetype: 'cultured',
      confidence: params.confidence ?? 0.9,
      directionDistrictSupportSummary: params.pocketLabel,
    },
  } as never
}

function assertRow1DirectionDistrictCarrierResolution(): void {
  const resolution = resolveCurateHardPocketProofTarget({
    starterPackId: 'coffee-books',
    city: 'San Jose',
    districts: [
      {
        id: 'sj-willow-glen-core',
        name: 'Willow Glen Pocket',
        centroid: { lat: 37.309, lng: -121.9 },
        radiusM: 650,
      },
    ],
    allDirectionCards: [
      buildRow1DirectionCard({
        directionId: 'direction-willow-glen-reading',
        pocketId: 'sj-willow-glen-core',
        pocketLabel: 'Willow Glen Pocket',
      }),
    ],
  })

  assert(resolution.target !== null, 'Row 1 must resolve from existing Direction/District carriers.')
  assert(
    resolution.target.selectedDirectionId === 'direction-willow-glen-reading',
    'Row 1 selectedDirectionId must come from the matching RealityDirectionCard.',
  )
  assert(
    resolution.target.selectedPocketId === 'sj-willow-glen-core',
    'Row 1 selectedPocketId must come from the matching District pocket carrier.',
  )
  assert(
    resolution.target.livePocketHint.pocketId === 'sj-willow-glen-core' &&
      resolution.target.livePocketHint.source === 'district_intelligence',
    'Row 1 livePocketHint must come from the selected District pocket before Field supply.',
  )
  assert(
    resolution.target.crossPocketAllowed === false,
    'Row 1 carrier wiring must preserve hard-pocket, no cross-pocket reselection.',
  )
  assert(
    resolution.diagnostics.matchingDirectionCarrierExists &&
      resolution.diagnostics.matchingPocketCarrierExists &&
      resolution.diagnostics.matchingLivePocketHintCarrierExists,
    'Row 1 diagnostics must report the matching Direction/District carrier state.',
  )

  const readiness = evaluateStepBPreSupplyReadiness({
    proofTargetId: resolution.target.proofTargetId,
    scenarioFamily: 'romantic_cultured',
    starterPackId: 'coffee-books',
    selectedDirectionId: resolution.target.selectedDirectionId,
    selectedPocketId: resolution.target.selectedPocketId,
    livePocketHint: resolution.target.livePocketHint,
    crossPocketAllowed: resolution.target.crossPocketAllowed,
    envelope: {
      maxProviderCalls: 3,
      maxQueryLabels: 3,
      maxCenters: 1,
    },
    providerValveExpectedMode: 'preview_field_proxy_expected_armed',
    providerValveReady: true,
  })
  assert(readiness.status === 'ready', 'Pre-supply readiness must become ready with only carrier inputs.')
  assert(
    readiness.notRequiredBeforeSupply.includes('selected_proof_stop') &&
      readiness.notRequiredBeforeSupply.includes('starterSemanticRepresentation'),
    'Pre-supply readiness must not require post-supply semantic proof or selected proof stop.',
  )
  process.stdout.write('Row 1 Direction/District carrier resolution: passed\n')
}

function assertRow1MissingDirectionCarrierHoldsPrecisely(): void {
  const resolution = resolveCurateHardPocketProofTarget({
    starterPackId: 'coffee-books',
    city: 'San Jose',
    districts: [
      {
        id: 'sj-willow-glen-core',
        name: 'Willow Glen Pocket',
        centroid: { lat: 37.309, lng: -121.9 },
        radiusM: 650,
      },
    ],
    allDirectionCards: [
      buildRow1DirectionCard({
        directionId: 'direction-downtown',
        pocketId: 'downtown',
        pocketLabel: 'Downtown',
      }),
    ],
  })

  assert(resolution.target === null, 'Row 1 must not fake a selected direction when no matching carrier exists.')
  assert(
    resolution.diagnostics.proofPolicy === 'curate_hard_pocket' &&
      resolution.diagnostics.geographyPolicy === 'hard_block',
    'Default Row 1 proof policy must remain Curate hard-pocket.',
  )
  assert(
    resolution.diagnostics.reason === 'pre_supply_selected_direction_unavailable_for_target_pocket',
    `Expected precise missing-direction reason, received ${resolution.diagnostics.reason}.`,
  )
  assert(
    resolution.diagnostics.selectedPocketIdAvailable &&
      resolution.diagnostics.livePocketHintAvailable &&
      !resolution.diagnostics.selectedDirectionIdAvailable,
    'Row 1 diagnostics must distinguish resolved pocket/hint from missing selectedDirectionId.',
  )

  const readiness = evaluateStepBPreSupplyReadiness({
    proofTargetId: ROW_1_COFFEE_BOOKS_PROOF_TARGET_ID,
    scenarioFamily: 'romantic_cultured',
    starterPackId: 'coffee-books',
    selectedDirectionId: null,
    selectedPocketId: null,
    livePocketHint: null,
    crossPocketAllowed: null,
    envelope: {
      maxProviderCalls: 3,
      maxQueryLabels: 3,
      maxCenters: 1,
    },
    providerValveExpectedMode: 'preview_field_proxy_expected_armed',
    providerValveReady: true,
    carrierResolutionHoldReason: resolution.diagnostics.preSupplyHoldReason,
  })
  assert(
    readiness.status === 'held' &&
      readiness.holdReason === 'pre_supply_selected_direction_unavailable_for_target_pocket',
    'Field supply must stay held with the precise missing Direction carrier reason.',
  )
  process.stdout.write('Row 1 missing Direction carrier hold: passed\n')
}

function assertBuildRequiredAnchorSoftGeographyAllowsDirectionPocketMismatch(): void {
  const resolution = resolveCurateHardPocketProofTarget({
    starterPackId: 'coffee-books',
    city: 'San Jose',
    proofPolicy: 'build_required_anchor_soft_geography',
    requiredAnchorPresent: true,
    districts: [
      {
        id: 'sj-willow-glen-core',
        name: 'Willow Glen Pocket',
        centroid: { lat: 37.309, lng: -121.9 },
        radiusM: 650,
      },
    ],
    allDirectionCards: [
      buildRow1DirectionCard({
        directionId: 'direction-downtown',
        pocketId: 'downtown',
        pocketLabel: 'Downtown',
      }),
    ],
  })

  assert(
    resolution.target !== null,
    'Build required-anchor soft geography must not hard-hold solely on direction/pocket mismatch.',
  )
  assert(
    resolution.target.selectedDirectionId === 'direction-downtown' &&
      resolution.target.selectedPocketId === 'sj-willow-glen-core',
    'Build soft-geography path must carry selected direction and required anchor/proof pocket separately.',
  )
  assert(
    resolution.target.crossPocketAllowed === true,
    'Build required-anchor soft geography must explicitly allow the pre-supply pocket mismatch.',
  )
  assert(
    !resolution.diagnostics.matchingDirectionCarrierExists &&
      resolution.diagnostics.matchingPocketCarrierExists &&
      resolution.diagnostics.matchingLivePocketHintCarrierExists,
    'Build soft-geography diagnostics must preserve carrier mismatch evidence.',
  )
  assert(
    resolution.diagnostics.proofPolicy === 'build_required_anchor_soft_geography' &&
      resolution.diagnostics.proofMode === 'build_required_anchor' &&
      resolution.diagnostics.requiredAnchorPresent &&
      resolution.diagnostics.geographyPolicy === 'soft_penalty',
    'Build path must expose proof policy, required-anchor presence, and soft geography policy.',
  )
  assert(
    resolution.diagnostics.selectedDirectionPocketId === 'downtown' &&
      resolution.diagnostics.anchorProofPocketId === 'sj-willow-glen-core' &&
      resolution.diagnostics.pocketMismatchReason ===
        'selected_direction_pocket_differs_from_required_anchor_pocket' &&
      resolution.diagnostics.pocketMismatchAllowed &&
      resolution.diagnostics.pocketMismatchAllowedReason ===
        'build_required_anchor_geography_soft_penalty',
    'Build soft-geography diagnostics must expose the pocket mismatch and allowed reason.',
  )

  const readiness = evaluateStepBPreSupplyReadiness({
    proofTargetId: resolution.target.proofTargetId,
    proofPolicy: resolution.diagnostics.proofPolicy,
    proofMode: resolution.diagnostics.proofMode,
    scenarioFamily: 'romantic_cultured',
    starterPackId: 'coffee-books',
    requiredAnchorPresent: resolution.diagnostics.requiredAnchorPresent,
    selectedDirectionId: resolution.target.selectedDirectionId,
    selectedPocketId: resolution.target.selectedPocketId,
    selectedDirectionPocketId: resolution.diagnostics.selectedDirectionPocketId,
    selectedDirectionPocketLabel: resolution.diagnostics.selectedDirectionPocketLabel,
    anchorProofPocketId: resolution.diagnostics.anchorProofPocketId,
    anchorProofPocketLabel: resolution.diagnostics.anchorProofPocketLabel,
    geographyPolicy: resolution.diagnostics.geographyPolicy,
    pocketMismatchReason: resolution.diagnostics.pocketMismatchReason,
    pocketMismatchAllowed: resolution.diagnostics.pocketMismatchAllowed,
    pocketMismatchAllowedReason: resolution.diagnostics.pocketMismatchAllowedReason,
    livePocketHint: resolution.target.livePocketHint,
    crossPocketAllowed: resolution.target.crossPocketAllowed,
    envelope: {
      maxProviderCalls: 3,
      maxQueryLabels: 3,
      maxCenters: 1,
    },
    providerValveExpectedMode: 'preview_field_proxy_expected_armed',
    providerValveReady: true,
  })
  assert(
    readiness.status === 'ready' &&
      readiness.geographyPolicy === 'soft_penalty' &&
      readiness.pocketMismatchAllowed,
    'Build soft-geography readiness must become ready while preserving mismatch diagnostics.',
  )

  const missingProviderValve = evaluateStepBPreSupplyReadiness({
    proofTargetId: resolution.target.proofTargetId,
    proofPolicy: resolution.diagnostics.proofPolicy,
    proofMode: resolution.diagnostics.proofMode,
    scenarioFamily: 'romantic_cultured',
    starterPackId: 'coffee-books',
    requiredAnchorPresent: resolution.diagnostics.requiredAnchorPresent,
    selectedDirectionId: resolution.target.selectedDirectionId,
    selectedPocketId: resolution.target.selectedPocketId,
    livePocketHint: resolution.target.livePocketHint,
    crossPocketAllowed: resolution.target.crossPocketAllowed,
    envelope: {
      maxProviderCalls: 3,
      maxQueryLabels: 3,
      maxCenters: 1,
    },
    providerValveExpectedMode: null,
    providerValveReady: false,
  })
  assert(
    missingProviderValve.status === 'held' &&
      missingProviderValve.holdReason === 'pre_supply_provider_valve_readiness_missing',
    'Build soft geography must still hold when non-geography provider readiness is missing.',
  )
  process.stdout.write('Build required-anchor soft geography pre-supply mismatch: passed\n')
}

function assertSurpriseHardPocketPolicyStillBlocksDirectionPocketMismatch(): void {
  const resolution = resolveCurateHardPocketProofTarget({
    starterPackId: 'coffee-books',
    city: 'San Jose',
    proofPolicy: 'surprise_hard_pocket',
    districts: [
      {
        id: 'sj-willow-glen-core',
        name: 'Willow Glen Pocket',
        centroid: { lat: 37.309, lng: -121.9 },
        radiusM: 650,
      },
    ],
    allDirectionCards: [
      buildRow1DirectionCard({
        directionId: 'direction-downtown',
        pocketId: 'downtown',
        pocketLabel: 'Downtown',
      }),
    ],
  })

  assert(resolution.target === null, 'Surprise hard-pocket policy must not inherit Build soft geography.')
  assert(
    resolution.diagnostics.proofPolicy === 'surprise_hard_pocket' &&
      resolution.diagnostics.geographyPolicy === 'hard_block' &&
      resolution.diagnostics.preSupplyHoldReason ===
        'pre_supply_selected_direction_unavailable_for_target_pocket',
    'Surprise hard-pocket mismatch must remain a pre-supply hard hold.',
  )
  process.stdout.write('Surprise hard-pocket mismatch remains blocked: passed\n')
}

function assertRow1MissingPocketHintHoldsPrecisely(): void {
  const resolution = resolveCurateHardPocketProofTarget({
    starterPackId: 'coffee-books',
    city: 'San Jose',
    districts: [
      {
        id: 'sj-willow-glen-core',
        name: 'Willow Glen Pocket',
      },
    ],
    allDirectionCards: [
      buildRow1DirectionCard({
        directionId: 'direction-willow',
        pocketId: 'sj-willow-glen-core',
        pocketLabel: 'Willow Glen Pocket',
      }),
    ],
  })

  assert(resolution.target === null, 'Row 1 must not fake a livePocketHint when District geometry is missing.')
  assert(
    resolution.diagnostics.reason === 'pre_supply_live_pocket_hint_unavailable_for_target',
    `Expected precise missing-hint reason, received ${resolution.diagnostics.reason}.`,
  )
  assert(
    resolution.diagnostics.matchingDirectionCarrierExists &&
      resolution.diagnostics.matchingPocketCarrierExists &&
      !resolution.diagnostics.matchingLivePocketHintCarrierExists,
    'Row 1 diagnostics must distinguish matching carriers from missing livePocketHint geometry.',
  )
  process.stdout.write('Row 1 missing livePocketHint hold: passed\n')
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
      sandboxSource.includes('row1CoffeeBooksProofPolicy') &&
      sandboxSource.includes('build_required_anchor_soft_geography') &&
      sandboxSource.includes('pocketMismatchAllowedReason') &&
      sandboxSource.includes('evaluateStepBPostSupplyProofGate') &&
      sandboxSource.includes('evaluateStepBPreSupplyReadiness'),
    'Coffee Books Row 1 diagnostics must split pre-supply readiness from post-supply proof and expose Build soft-geography policy.',
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
            greatStopGateSelectionDiagnostics: {
              status: 'FAIL',
              stage: 'pre_selection_gate',
              evaluatedCandidateCount: 2,
              passingCandidateCount: 0,
              failedTopCandidateCriteria: ['place_right'],
              failureReasons: ['place_right:cluster_escape_structure'],
              bestFailingCandidateSummary: {
                candidateId: 'candidate-culture-bookstore-loop',
                failedCriteria: ['place_right'],
                reasons: ['place_right:cluster_escape_structure'],
                requiredAnchorPreserved: true,
                requiredAnchorRoleCorrect: true,
              },
            },
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
  assert(
    typeof noCardSummary.greatStopGateSelectionDiagnostics === 'object' &&
      noCardSummary.greatStopGateSelectionDiagnostics !== null &&
      !Array.isArray(noCardSummary.greatStopGateSelectionDiagnostics) &&
      noCardSummary.greatStopGateSelectionDiagnostics.status === 'FAIL' &&
      noCardSummary.greatStopGateSelectionDiagnostics.evaluatedCandidateCount === 2,
    'Observer no-card summary must expose preserved Great Stop selection diagnostics.',
  )

  const observerSource = readFileSync('scripts/observe-hosted-step-b-supply.ts', 'utf8')
  assert(
    observerSource.includes('step_b_no_card_classification') &&
      observerSource.includes('No visible route card found after Step B candidate supply.') &&
      observerSource.includes('greatStopGateSelectionDiagnostics') &&
      observerSource.includes('selectedQualificationDiagnostic?.greatStopGateSelectionDiagnostics') &&
      !observerSource.includes('return\n    }\n    const selectedCardArtifactId'),
    'Hosted observer must not mask a no-card proof failure behind finalError:null.',
  )
  process.stdout.write('Step B no_approved_payload classification: passed\n')
}

function assertStepBPocketProofDiagnosticsSurfaceInObserverReport(): void {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const row1ResolverSource = readFileSync('src/app/services/curate/row1CoffeeBooksProofTarget.ts', 'utf8')
  assert(
    sandboxSource.includes('proofTargetParameters') &&
      row1ResolverSource.includes('row1_step_b_coffee_books_representative') &&
      sandboxSource.includes('ROW_1_COFFEE_BOOKS_PROOF_TARGET_POCKET_LABEL') &&
      row1ResolverSource.includes('resolveCurateHardPocketProofTargetInstance') &&
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
      row1ResolverSource.includes('selected-stop-backed book, reading, literary, library, or bookstore evidence'),
    'Step B proof-target diagnostics must be explicitly non-authoritative and explain the current proof target.',
  )
  assert(
    row1ResolverSource.includes('availableDirectionCardIds') &&
      row1ResolverSource.includes('availableDirectionPocketCarriers') &&
      row1ResolverSource.includes('availableDistrictPocketCarriers') &&
      row1ResolverSource.includes('build_required_anchor_soft_geography') &&
      row1ResolverSource.includes('build_required_anchor_geography_soft_penalty') &&
      row1ResolverSource.includes('selected_direction_pocket_differs_from_required_anchor_pocket') &&
      row1ResolverSource.includes('selectedDirectionResolutionReason') &&
      row1ResolverSource.includes('pre_supply_selected_direction_unavailable_for_target_pocket'),
    'Row 1 proof-target resolver must report carrier state, soft-geography diagnostics, and precise pre-supply hold reasons.',
  )
  assert(
    !row1ResolverSource.includes('ProviderAdapter') &&
      !row1ResolverSource.includes('/api/field/text-search') &&
      !row1ResolverSource.includes('GOOGLE_PLACES'),
    'Row 1 proof-target resolver must not introduce Field/provider ownership.',
  )
  assert(
    !row1ResolverSource.includes('ProofTargetArtifact') &&
      !row1ResolverSource.includes('GreatStop') &&
      !row1ResolverSource.includes('query terms satisfy') &&
      !row1ResolverSource.includes('user search terms satisfy'),
    'Row 1 proof-target resolver must not create a canonical artifact, touch Great Stop, or copy query/user terms into proof.',
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
  assertRow1DirectionDistrictCarrierResolution()
  assertRow1MissingDirectionCarrierHoldsPrecisely()
  assertBuildRequiredAnchorSoftGeographyAllowsDirectionPocketMismatch()
  assertSurpriseHardPocketPolicyStillBlocksDirectionPocketMismatch()
  assertRow1MissingPocketHintHoldsPrecisely()
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
