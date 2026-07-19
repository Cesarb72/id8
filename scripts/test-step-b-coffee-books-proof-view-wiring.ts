import { readFileSync } from 'node:fs'
import {
  buildCurateScenarioBackedArtifactBridge,
  evaluateCurateHardPocketProofTargetAssertion,
} from '../src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import type {
  BuiltScenarioNight,
  BuiltScenarioStop,
  StarterSemanticRepresentation,
} from '../src/domain/interpretation/construction/scenarioBuilder.ts'
import {
  buildStopTypeCandidateBoardFromContract,
  type ScenarioFamily,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import type { VerifiedCityOpportunity } from '../src/domain/interpretation/verifiedCityOpportunity.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const coffeeBooksStarterPack = starterPacks.find((pack) => pack.id === 'coffee-books')
assert(coffeeBooksStarterPack, 'Missing Coffee & Books starter pack fixture.')

function buildContractInputWithCanonicalFamily(strategyFamily: ScenarioFamily) {
  return {
    conciergeIntent: {},
    canonicalInterpretationBundle: {
      normalizedIntent: {
        id: 'proof-view-intent',
        intentMode: 'curated',
        experienceProfile: {
          persona: 'romantic',
          vibe: 'cultured',
        },
        starterLineage: {
          source: 'starter_pack',
          starterPackId: 'coffee-books',
        },
      },
      strategyFamily,
    },
    contractConstraints: {
      id: 'proof-view-constraints',
    },
    contractGateWorld: {
      admittedPockets: [],
      requiredStopGuarantee: {
        required: false,
      },
      debug: {
        contractGateWorldPresent: true,
        contractGateWorldSource: 'test',
      },
    },
    locationQuery: 'San Jose',
    sourceMode: 'curated',
    starterPack: coffeeBooksStarterPack,
  } as never
}

function buildStop(params: {
  position: BuiltScenarioStop['position']
  stopType: BuiltScenarioStop['stopType']
  venueId: string
  name: string
  category: VenueCategory
  subcategory?: string
  geoBucket: string
  geoLabel: string
  sourceTypes?: string[]
  tags?: string[]
}): BuiltScenarioStop {
  return {
    position: params.position,
    stopType: params.stopType,
    venueId: params.venueId,
    name: params.name,
    district: params.geoLabel,
    neighborhoodLabel: params.geoLabel,
    geoBucket: params.geoBucket,
    geoBucketSource: 'district_intelligence',
    geoLabel: params.geoLabel,
    geoAssignmentMethod: 'district_intelligence_direct',
    authorityScore: 0.78,
    currentRelevance: 0.72,
    reasons: [`${params.name} is a proof-view fixture stop.`],
    momentLabel: params.name,
    whyThisStop: `${params.name} is selected inside the proof view.`,
    venueCategory: params.category,
    venueSubcategory: params.subcategory,
    venueTags: params.tags ?? [],
    sourceTypes: params.sourceTypes ?? [params.category],
    roleFit: { start: 0.72, highlight: 0.72, windDown: 0.72 },
  }
}

function buildSemanticRepresentation(params: {
  proofStop: BuiltScenarioStop
  represented: boolean
}): StarterSemanticRepresentation {
  if (!params.represented) {
    return {
      starterPackId: 'coffee-books',
      status: 'missing',
      evidence: [],
      matchedEvidence: [
        {
          stopVenueId: params.proofStop.venueId,
          stopName: params.proofStop.name,
          field: 'query',
          rawValue: 'coffee books bookstore literary',
          normalizedTerm: 'bookstore',
          evidenceType: 'bookstore',
          matchType: 'exact',
          sourceScope: 'query_terms_only',
          admissible: false,
        } as never,
      ],
      rejectionReasons: ['missing_explicit_book_reading_literary_library_or_bookstore_stop'],
    }
  }

  return {
    starterPackId: 'coffee-books',
    status: 'represented',
    evidence: [
      {
        starterPackId: 'coffee-books',
        venueId: params.proofStop.venueId,
        name: params.proofStop.name,
        position: params.proofStop.position,
        stopType: params.proofStop.stopType,
        evidenceTypes: ['bookstore', 'literary'],
        matchedTerms: ['bookstore', 'literary'],
        matches: [],
        source: 'selected_route_stop',
      },
    ],
    matchedEvidence: [],
  }
}

function buildOpportunity(params: {
  scenarioFamily: ScenarioFamily
  pocketId: string
  pocketLabel: string
  directionId: string
  represented: boolean
  greatStopPass: boolean
}): VerifiedCityOpportunity {
  const proofStop = buildStop({
    position: 'highlight',
    stopType: 'thoughtful_wine_or_lunch',
    venueId: 'fixture-proof-bookstore',
    name: 'Proof Pocket Bookstore',
    category: 'activity',
    subcategory: 'bookstore',
    geoBucket: params.pocketId,
    geoLabel: params.pocketLabel,
    sourceTypes: ['book_store'],
    tags: ['bookstore', 'literary', 'reading'],
  })
  const startStop = buildStop({
    position: 'start',
    stopType: 'cultural_institution',
    venueId: 'fixture-proof-cafe',
    name: 'Proof Pocket Cafe',
    category: 'cafe',
    geoBucket: params.pocketId,
    geoLabel: params.pocketLabel,
    sourceTypes: ['cafe'],
  })
  const windDownStop = buildStop({
    position: 'windDown',
    stopType: 'atmospheric_nightcap',
    venueId: 'fixture-proof-tea',
    name: 'Proof Pocket Tea',
    category: 'cafe',
    geoBucket: params.pocketId,
    geoLabel: params.pocketLabel,
    sourceTypes: ['cafe'],
  })
  const starterSemanticRepresentation = buildSemanticRepresentation({
    proofStop,
    represented: params.represented,
  })
  const scenarioNight: BuiltScenarioNight = {
    id: `proof-view-${params.scenarioFamily}`,
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    scenarioFamily: params.scenarioFamily,
    title: 'Coffee Books proof-view fixture',
    flavorLine: 'Coffee Books proof-view fixture',
    stops: [startStop, proofStop, windDownStop],
    whyThisWorks: 'The selected proof stop is carried by the scenario object.',
    complete: true,
    starterSemanticRepresentation,
    evaluation: {
      stopEvaluations: [],
      passesGreatStopStandard: params.greatStopPass,
      failedStops: [],
      notes: params.greatStopPass ? ['All stops pass Great Stop criteria.'] : [],
    },
  }

  return {
    id: `proof-view-opportunity-${params.scenarioFamily}-${params.represented ? 'proof' : 'missing'}`,
    sourceMode: 'bootstrap',
    flavor: scenarioNight.flavorLine,
    anchor: {
      venueId: proofStop.venueId,
      name: proofStop.name,
      district: params.pocketLabel,
      verificationReasons: ['selected-stop bookstore proof'],
    },
    starts: [{ venueId: startStop.venueId, name: startStop.name, reason: startStop.whyThisStop }],
    closes: [{ venueId: windDownStop.venueId, name: windDownStop.name, reason: windDownStop.whyThisStop }],
    nearbyHappenings: [],
    districtContext: { primaryDistrict: params.pocketLabel },
    fit: {
      persona: 'romantic',
      vibe: 'cultured',
      confidenceLine: 'Coffee Books proof view fixture.',
      matchLine: 'Coffee Books proof view fixture',
    },
    storySpine: {
      start: startStop.name,
      highlight: proofStop.name,
      windDown: windDownStop.name,
    },
    selection: {
      directionId: params.directionId,
      pocketId: params.pocketId,
    },
    survivorSignals: {
      whyTonightStrength: 0.72,
      cozyAuthorityStrength: 0.74,
      highWhyTonight: true,
      highCozyAuthority: true,
    },
    excellence: {
      score: 0.78,
      threshold: 0.62,
      passes: true,
      anchorStrength: 0.78,
      startQuality: 0.72,
      windDownQuality: 0.72,
      supportCoherence: 0.78,
      scenarioAlignment: 0.82,
      experienceAlignment: 0.82,
      localAuthority: 0.78,
      modeExcellence: 0.8,
    },
    starterSemanticRepresentation,
    scenarioNight,
  } as VerifiedCityOpportunity
}

function buildDirectionCard(params: { directionId: string; pocketId: string }) {
  return {
    id: params.directionId,
    cluster: 'romantic_cultured',
    card: { confirmation: 'Coffee Books proof-view direction' },
    debugMeta: {
      pocketId: params.pocketId,
      confidence: 0.9,
    },
  } as never
}

async function assertCoffeeBooksStarterWinsOverCanonicalFamily(): Promise<void> {
  const board = await buildStopTypeCandidateBoardFromContract(
    buildContractInputWithCanonicalFamily('romantic_lively'),
  )
  assert(board, 'Coffee Books contract board must build locally.')
  assert(
    board.scenarioFamily === 'romantic_cultured',
    `Coffee Books proof carrier must be romantic_cultured, received ${board.scenarioFamily}.`,
  )
  assert(
    board.evaluationContract.starterId === 'coffee-books',
    'Coffee Books proof carrier must preserve starter evaluation contract.',
  )
  process.stdout.write('Coffee Books scenario-family precedence: passed\n')
}

function assertAssertionReceivesActivePocketAndSelectedProofStop(): void {
  const opportunity = buildOpportunity({
    scenarioFamily: 'romantic_cultured',
    pocketId: 'raw-pocket-reading',
    pocketLabel: 'Reading Pocket',
    directionId: 'direction-reading',
    represented: true,
    greatStopPass: true,
  })
  const result = evaluateCurateHardPocketProofTargetAssertion({
    opportunity,
    selection: opportunity.selection,
    starterPack: coffeeBooksStarterPack,
    starterSemanticRepresentation: opportunity.starterSemanticRepresentation,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      targetPocketId: 'raw-pocket-reading',
      targetPocketLabel: 'Reading Pocket',
      activePocketId: 'raw-pocket-reading',
      activePocketLabel: 'Reading Pocket',
      activePocketCenter: { lat: 37.33, lng: -121.88 },
      activePocketHintRadiusM: 650,
      activeFieldAdmissionEnvelopeRadiusM: 900,
      crossPocketAllowed: false,
    },
  })
  assert(result.status === 'passed', `Expected hard-pocket assertion pass, received ${result.reason}.`)
  assert(result.activePocketId === 'raw-pocket-reading', 'Assertion must receive active Field pocket id.')
  assert(result.activePocketLabel === 'Reading Pocket', 'Assertion must receive active Field pocket label.')
  assert(result.activePocketCenter?.lat === 37.33, 'Assertion must receive active pocket center.')
  assert(result.activePocketHintRadiusM === 650, 'Assertion must receive active pocket hint radius.')
  assert(
    result.activeFieldAdmissionEnvelopeRadiusM === 900,
    'Assertion must receive Field admission envelope radius.',
  )
  assert(
    result.selectedProofStopId === 'fixture-proof-bookstore',
    'Assertion must receive selected proof stop.',
  )
  assert(
    result.selectedProofStopPocketId === 'raw-pocket-reading',
    'Assertion must receive selected proof stop pocket.',
  )
  process.stdout.write('Coffee Books proof-view assertion inputs: passed\n')
}

function assertScenarioPassWithoutCoffeeBooksProofDoesNotMaterialize(): void {
  const opportunity = buildOpportunity({
    scenarioFamily: 'romantic_lively',
    pocketId: 'raw-pocket-reading',
    pocketLabel: 'Reading Pocket',
    directionId: 'direction-reading',
    represented: false,
    greatStopPass: true,
  })
  const directions = [buildDirectionCard({ directionId: 'direction-reading', pocketId: 'raw-pocket-reading' })]
  const bridge = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    starterPack: coffeeBooksStarterPack,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      targetPocketId: 'raw-pocket-reading',
      targetPocketLabel: 'Reading Pocket',
      activePocketId: 'raw-pocket-reading',
      activePocketLabel: 'Reading Pocket',
      crossPocketAllowed: false,
    },
  })
  const diagnostic = bridge.diagnostics[0]
  assert(bridge.candidateArtifacts.length === 0, 'Great Stop pass without Coffee proof must not materialize.')
  assert(
    diagnostic?.proofTargetAssertion.status === 'failed',
    'Scenario pass without Coffee proof must fail hard-pocket assertion.',
  )
  assert(
    diagnostic?.proofTargetAssertion.reason === 'proof_target_semantic_proof_missing',
    `Expected semantic proof missing, received ${diagnostic?.proofTargetAssertion.reason}.`,
  )
  process.stdout.write('scenario PASS without Coffee Books proof: passed\n')
}

function assertQueryTermsRemainNonProof(): void {
  const opportunity = buildOpportunity({
    scenarioFamily: 'romantic_cultured',
    pocketId: 'raw-pocket-reading',
    pocketLabel: 'Reading Pocket',
    directionId: 'direction-reading',
    represented: false,
    greatStopPass: true,
  })
  const result = evaluateCurateHardPocketProofTargetAssertion({
    opportunity,
    selection: opportunity.selection,
    starterPack: coffeeBooksStarterPack,
    starterSemanticRepresentation: opportunity.starterSemanticRepresentation,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      targetPocketId: 'raw-pocket-reading',
      targetPocketLabel: 'Reading Pocket',
      activePocketId: 'raw-pocket-reading',
      activePocketLabel: 'Reading Pocket',
      crossPocketAllowed: false,
    },
  })
  assert(result.status === 'failed', 'Query terms alone must not satisfy Coffee Books proof.')
  assert(
    result.reason === 'proof_target_semantic_proof_missing',
    `Expected semantic proof missing for query-only evidence, received ${result.reason}.`,
  )
  process.stdout.write('Coffee Books query terms remain non-proof: passed\n')
}

function assertPageWiresFieldPocketDiagnosticsIntoProofTarget(): void {
  const source = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    source.includes('resolveCurateProofTargetActivePocketDiagnostic'),
    'Page must compose proof-target active pocket diagnostics through the local helper.',
  )
  assert(
    source.includes('resolveCurateHardPocketProofTarget') &&
      source.includes('directionCardMatchesProofTargetDistrict') &&
      source.includes('resolutionDiagnostics') &&
      source.includes('resolverRanBeforeRequiredCarriers') &&
      source.includes('activeProofPocketMismatch'),
    'Page must expose non-authoritative Row 1 proof-target resolution diagnostics.',
  )
  assert(
    source.includes('candidate.pocketProofDiagnostic'),
    'Proof-target helper must fall back to Field candidate pocket diagnostics.',
  )
  assert(
    source.includes('activeFieldAdmissionEnvelopeRadiusM'),
    'Proof-target context must carry Field admission envelope diagnostics.',
  )
  assert(
    source.includes('resolveCurateHardPocketProofTargetInstance') &&
      source.includes('ROW_1_COFFEE_BOOKS_PROOF_TARGET_POCKET_LABEL') &&
      source.includes('selectedDirectionId: targetDirection.id') &&
      source.includes('selectedPocketId: targetDistrict.id') &&
      source.includes('livePocketHint') &&
      source.includes('source: \'district_intelligence\''),
    'Row 1 proof target must resolve selected direction/pocket from existing District and Direction carriers.',
  )
  assert(
    source.includes("ROW_1_COFFEE_BOOKS_PROOF_TARGET_POCKET_LABEL = 'Willow Glen'") &&
      source.includes('livePocketHint: row1CoffeeBooksProofTarget.livePocketHint') &&
      source.includes('row1CoffeeBooksProofTargetDiagnostics.status !== \'resolved\'') &&
      source.includes('crossPocketAllowed: false'),
    'Coffee Books Row 1 must gate supply on the resolved Willow Glen hard-pocket target before passing livePocketHint.',
  )
  assert(
    source.includes('requiredSemanticProof') &&
      source.includes('ROW_1_COFFEE_BOOKS_REQUIRED_SEMANTIC_PROOF') &&
      !source.includes('ProofTargetArtifact'),
    'Coffee Books proof-view wiring must stay a portable assertion instance, not a new canonical artifact.',
  )
  assert(
    !source.includes('query terms satisfy Coffee Books proof') &&
      !source.includes('user search terms satisfy Coffee Books proof'),
    'Coffee Books proof target must not copy query terms or user search terms into proof.',
  )
  process.stdout.write('page proof-target Field diagnostics wiring: passed\n')
}

async function main(): Promise<void> {
  await assertCoffeeBooksStarterWinsOverCanonicalFamily()
  assertAssertionReceivesActivePocketAndSelectedProofStop()
  assertScenarioPassWithoutCoffeeBooksProofDoesNotMaterialize()
  assertQueryTermsRemainNonProof()
  assertPageWiresFieldPocketDiagnosticsIntoProofTarget()
  process.stdout.write('Step B Coffee Books proof-view wiring: passed\n')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
