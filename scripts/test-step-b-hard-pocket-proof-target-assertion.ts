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
import type { VerifiedCityOpportunity } from '../src/domain/interpretation/verifiedCityOpportunity.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const coffeeBooksStarterPack = starterPacks.find((pack) => pack.id === 'coffee-books')
assert(coffeeBooksStarterPack, 'Missing Coffee & Books starter pack fixture.')

function buildStop(params: {
  position: BuiltScenarioStop['position']
  stopType: BuiltScenarioStop['stopType']
  venueId: string
  name: string
  category: VenueCategory
  subcategory?: string
  geoBucket: string
  geoLabel: string
  tags?: string[]
  sourceTypes?: string[]
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
    reasons: [`${params.name} supports the hard-pocket proof target.`],
    momentLabel: params.name,
    whyThisStop: `${params.name} is selected by the route.`,
    venueCategory: params.category,
    venueSubcategory: params.subcategory,
    venueTags: params.tags ?? [],
    sourceTypes: params.sourceTypes ?? [params.category],
    roleFit: { start: 0.72, highlight: 0.72, windDown: 0.72 },
  }
}

function buildSemanticRepresentation(params: {
  stop: BuiltScenarioStop
  represented?: boolean
}): StarterSemanticRepresentation {
  if (params.represented === false) {
    return {
      starterPackId: 'coffee-books',
      status: 'missing',
      evidence: [],
      matchedEvidence: [
        {
          stopVenueId: params.stop.venueId,
          stopName: params.stop.name,
          field: 'query',
          rawValue: 'coffee books literary bookstore',
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
        venueId: params.stop.venueId,
        name: params.stop.name,
        position: params.stop.position,
        stopType: params.stop.stopType,
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
  pocketId: string
  pocketLabel: string
  directionId?: string
  proofStopPocketId?: string
  proofStopPocketLabel?: string
  represented?: boolean
}): VerifiedCityOpportunity {
  const proofStop = buildStop({
    position: 'highlight',
    stopType: 'thoughtful_wine_or_lunch',
    venueId: 'fixture-pocket-bookstore',
    name: 'Pocket Bookstore',
    category: 'activity',
    subcategory: 'bookstore',
    geoBucket: params.proofStopPocketId ?? params.pocketId,
    geoLabel: params.proofStopPocketLabel ?? params.pocketLabel,
    tags: ['bookstore', 'literary', 'reading'],
    sourceTypes: ['book_store'],
  })
  const startStop = buildStop({
    position: 'start',
    stopType: 'cultural_institution',
    venueId: 'fixture-pocket-cafe',
    name: 'Pocket Quiet Cafe',
    category: 'cafe',
    geoBucket: params.pocketId,
    geoLabel: params.pocketLabel,
    sourceTypes: ['cafe'],
  })
  const windDownStop = buildStop({
    position: 'windDown',
    stopType: 'atmospheric_nightcap',
    venueId: 'fixture-pocket-tea',
    name: 'Pocket Tea Landing',
    category: 'cafe',
    geoBucket: params.pocketId,
    geoLabel: params.pocketLabel,
    sourceTypes: ['cafe'],
  })
  const starterSemanticRepresentation = buildSemanticRepresentation({
    stop: proofStop,
    represented: params.represented,
  })
  const scenarioNight: BuiltScenarioNight = {
    id: `night-${params.pocketId}`,
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    scenarioFamily: 'romantic_cultured',
    title: 'Hard-pocket Coffee & Books fixture',
    flavorLine: 'Coffee & Books fixture',
    stops: [startStop, proofStop, windDownStop],
    whyThisWorks: 'The proof-bearing stop is selected inside the asserted pocket.',
    complete: true,
    starterSemanticRepresentation,
  }

  return {
    id: `opportunity-${params.pocketId}-${params.proofStopPocketId ?? params.pocketId}`,
    sourceMode: 'bootstrap',
    flavor: scenarioNight.flavorLine,
    anchor: {
      venueId: proofStop.venueId,
      name: proofStop.name,
      district: proofStop.district ?? params.pocketLabel,
      verificationReasons: ['selected-stop bookstore proof'],
    },
    starts: [{ venueId: startStop.venueId, name: startStop.name, reason: startStop.whyThisStop }],
    closes: [{ venueId: windDownStop.venueId, name: windDownStop.name, reason: windDownStop.whyThisStop }],
    nearbyHappenings: [],
    districtContext: { primaryDistrict: params.pocketLabel },
    fit: {
      persona: 'romantic',
      vibe: 'cultured',
      confidenceLine: 'Selected-stop literary proof is pocket-aligned.',
      matchLine: 'Coffee & Books hard-pocket fixture',
    },
    storySpine: {
      start: startStop.name,
      highlight: proofStop.name,
      windDown: windDownStop.name,
    },
    selection: {
      pocketId: params.pocketId,
      ...(params.directionId ? { directionId: params.directionId } : {}),
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
    scenarioWindDownDebug: {
      originalVenueId: windDownStop.venueId,
      originalName: windDownStop.name,
      originalRoleEligible: true,
      repairApplied: false,
      repairReplacementVenueId: null,
      repairReplacementName: null,
      repairSource: null,
      repairReason: null,
      finalVenueId: windDownStop.venueId,
      finalName: windDownStop.name,
      finalRoleEligible: true,
    },
    starterSemanticRepresentation,
    scenarioNight,
  } as VerifiedCityOpportunity
}

function buildDirectionCard(params: { directionId: string; pocketId: string }) {
  return {
    id: params.directionId,
    cluster: 'romantic_cultured',
    card: { confirmation: 'Hard-pocket fixture direction' },
    debugMeta: {
      pocketId: params.pocketId,
      confidence: 0.9,
    },
  } as never
}

function assertHardPocketAssertionPassesAndMaterializes(): void {
  const opportunity = buildOpportunity({
    pocketId: 'willow-pocket',
    pocketLabel: 'Willow Glen Pocket',
    directionId: 'direction-willow',
  })
  const directions = [buildDirectionCard({ directionId: 'direction-willow', pocketId: 'willow-pocket' })]
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
      targetPocketId: 'willow-pocket',
      targetPocketLabel: 'Willow Glen Pocket',
      activePocketId: 'willow-pocket',
      activePocketLabel: 'Willow Glen Pocket',
      crossPocketAllowed: false,
    },
  })
  assert(bridge.candidateArtifacts.length === 1, 'Matching hard-pocket proof must materialize.')
  assert(
    bridge.diagnostics[0]?.proofTargetAssertion.status === 'passed',
    'Matching hard-pocket proof assertion must pass.',
  )
  process.stdout.write('hard-pocket assertion pass test: passed\n')
}

function assertHardPocketAssertionRejectsMismatchedActivePocket(): void {
  const opportunity = buildOpportunity({
    pocketId: 'willow-pocket',
    pocketLabel: 'Willow Glen Pocket',
    directionId: 'direction-willow',
  })
  const result = evaluateCurateHardPocketProofTargetAssertion({
    opportunity,
    selection: opportunity.selection,
    starterPack: coffeeBooksStarterPack,
    starterSemanticRepresentation: opportunity.starterSemanticRepresentation,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      targetPocketId: 'willow-pocket',
      targetPocketLabel: 'Willow Glen Pocket',
      activePocketId: 'downtown-pocket',
      activePocketLabel: 'Downtown Pocket',
      crossPocketAllowed: false,
    },
  })
  assert(result.status === 'failed', 'Downtown active pocket must not approve Willow Glen proof.')
  assert(
    result.reason === 'proof_target_active_pocket_mismatch',
    `Expected active-pocket mismatch, received ${result.reason}.`,
  )
  process.stdout.write('hard-pocket assertion fail test: passed\n')
}

function assertEquivalentPocketLabelsRemainHardPocketConsistent(): void {
  const opportunity = buildOpportunity({
    pocketId: 'raw-pocket-willow-selection',
    pocketLabel: 'Willow Glen Pocket',
    directionId: 'direction-willow',
    proofStopPocketId: 'raw-pocket-willow-proof',
    proofStopPocketLabel: 'Willow Glen Pocket',
  })
  const result = evaluateCurateHardPocketProofTargetAssertion({
    opportunity,
    selection: opportunity.selection,
    starterPack: coffeeBooksStarterPack,
    starterSemanticRepresentation: opportunity.starterSemanticRepresentation,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      targetPocketId: 'raw-pocket-willow-selection',
      targetPocketLabel: 'Willow Glen Pocket',
      activePocketId: 'raw-pocket-willow-field',
      activePocketLabel: 'Willow Glen Pocket',
      crossPocketAllowed: false,
    },
  })
  assert(
    result.status === 'passed',
    `Equivalent Willow Glen pocket labels must remain hard-pocket consistent, received ${result.reason}.`,
  )
  assert(
    result.selectedDirectionId === 'direction-willow' &&
      result.selectedPocketId === 'raw-pocket-willow-selection',
    'Selected direction and selected pocket must reach the assertion from existing carriers.',
  )
  process.stdout.write('hard-pocket equivalent-label assertion test: passed\n')
}

function assertSelectedProofStopMustBeInsideTargetPocket(): void {
  const opportunity = buildOpportunity({
    pocketId: 'downtown-pocket',
    pocketLabel: 'Downtown Pocket',
    directionId: 'direction-downtown',
    proofStopPocketId: 'willow-pocket',
    proofStopPocketLabel: 'Willow Glen Pocket',
  })
  const result = evaluateCurateHardPocketProofTargetAssertion({
    opportunity,
    selection: opportunity.selection,
    starterPack: coffeeBooksStarterPack,
    starterSemanticRepresentation: opportunity.starterSemanticRepresentation,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      targetPocketId: 'downtown-pocket',
      targetPocketLabel: 'Downtown Pocket',
      activePocketId: 'downtown-pocket',
      activePocketLabel: 'Downtown Pocket',
      crossPocketAllowed: false,
    },
  })
  assert(result.status === 'failed', 'Out-of-pocket selected proof stop must fail.')
  assert(
    result.reason === 'proof_target_selected_stop_outside_pocket',
    `Expected selected-stop outside-pocket failure, received ${result.reason}.`,
  )
  process.stdout.write('Coffee & Books pocket-consistent target test: passed\n')
}

function assertQueryTermsDoNotSatisfyProof(): void {
  const opportunity = buildOpportunity({
    pocketId: 'willow-pocket',
    pocketLabel: 'Willow Glen Pocket',
    directionId: 'direction-willow',
    represented: false,
  })
  const result = evaluateCurateHardPocketProofTargetAssertion({
    opportunity,
    selection: opportunity.selection,
    starterPack: coffeeBooksStarterPack,
    starterSemanticRepresentation: opportunity.starterSemanticRepresentation,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      targetPocketId: 'willow-pocket',
      targetPocketLabel: 'Willow Glen Pocket',
      activePocketId: 'willow-pocket',
      activePocketLabel: 'Willow Glen Pocket',
      crossPocketAllowed: false,
    },
  })
  assert(result.status === 'failed', 'Query terms alone must not satisfy proof.')
  assert(
    result.reason === 'proof_target_semantic_proof_missing',
    `Expected semantic proof missing, received ${result.reason}.`,
  )
  process.stdout.write('no query-term proof test: passed\n')
}

function assertCompatibilityWrappersRemainNonAuthority(): void {
  const selectedRouteArtifactSource = readFileSync('src/domain/artifacts/selectedRouteArtifact.ts', 'utf8')
  const curatePayloadSource = readFileSync('src/app/wrapper/curateRefinementEntry.ts', 'utf8')
  const proofAssertionSource = readFileSync(
    'src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts',
    'utf8',
  )
  assert(
    selectedRouteArtifactSource.includes('must not independently author canonical route truth'),
    'SelectedRouteArtifact must remain compatibility projection, not authority.',
  )
  assert(
    curatePayloadSource.includes('must not independently') &&
      curatePayloadSource.includes('author canonical route truth'),
    'CurateRefinementEntryPayload must remain compatibility wrapper, not authority.',
  )
  assert(
    !proofAssertionSource.includes("from '../../../domain/artifacts/selectedRouteArtifact'") &&
      !proofAssertionSource.includes("from '../../wrapper/curateRefinementEntry'"),
    'Hard-pocket proof assertion must not depend on legacy compatibility wrappers as authority.',
  )
  process.stdout.write('compatibility-wrapper-not-authority test: passed\n')
}

function main(): void {
  assertHardPocketAssertionPassesAndMaterializes()
  assertHardPocketAssertionRejectsMismatchedActivePocket()
  assertEquivalentPocketLabelsRemainHardPocketConsistent()
  assertSelectedProofStopMustBeInsideTargetPocket()
  assertQueryTermsDoNotSatisfyProof()
  assertCompatibilityWrappersRemainNonAuthority()
  process.stdout.write('Step B hard-pocket proof-target assertion: passed\n')
}

main()
