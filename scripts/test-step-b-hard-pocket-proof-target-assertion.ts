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

function buildSupportReselectionOpportunity(params: {
  includeCompactAlternatives: boolean
  selectionPocketId?: string
  selectionPocketLabel?: string
  directionId?: string
}): VerifiedCityOpportunity {
  const staleStart = buildStop({
    position: 'start',
    stopType: 'cultural_institution',
    venueId: 'fixture-rose-garden-walk',
    name: 'Rose Garden Twilight Walk',
    category: 'park',
    geoBucket: 'raw-pocket-rose-garden',
    geoLabel: 'Rose Garden Pocket',
    sourceTypes: ['park'],
  })
  const proofStop = buildStop({
    position: 'highlight',
    stopType: 'thoughtful_wine_or_lunch',
    venueId: 'sj-willow-glen-bookhouse',
    name: 'Willow Glen Bookhouse',
    category: 'cafe',
    subcategory: 'bookstore',
    geoBucket: 'raw-pocket-willow',
    geoLabel: 'Willow Glen Pocket',
    tags: ['bookstore', 'literary', 'reading'],
    sourceTypes: ['book_store'],
  })
  const staleWindDown = buildStop({
    position: 'windDown',
    stopType: 'atmospheric_nightcap',
    venueId: 'fixture-japantown-kissaten',
    name: 'Japantown Matcha Kissaten',
    category: 'cafe',
    geoBucket: 'raw-pocket-japantown',
    geoLabel: 'Japantown Pocket',
    sourceTypes: ['cafe'],
  })
  const compactStart = buildStop({
    position: 'mid',
    stopType: 'cultural_institution',
    venueId: 'sj-willow-glen-tea-atelier',
    name: 'Willow Glen Tea Atelier',
    category: 'cafe',
    geoBucket: 'raw-pocket-willow',
    geoLabel: 'Willow Glen Pocket',
    sourceTypes: ['cafe'],
  })
  const compactWindDown = buildStop({
    position: 'closer',
    stopType: 'atmospheric_nightcap',
    venueId: 'sj-willow-glen-bakehouse',
    name: 'Willow Glen Bakehouse',
    category: 'dessert',
    geoBucket: 'raw-pocket-willow',
    geoLabel: 'Willow Glen Pocket',
    sourceTypes: ['dessert'],
  })
  const stops = params.includeCompactAlternatives
    ? [staleStart, compactStart, proofStop, staleWindDown, compactWindDown]
    : [staleStart, proofStop, staleWindDown]
  const starterSemanticRepresentation = buildSemanticRepresentation({
    stop: proofStop,
  })
  const scenarioNight: BuiltScenarioNight = {
    id: 'support-reselection-fixture',
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    scenarioFamily: 'romantic_cultured',
    title: 'Support reselection fixture',
    flavorLine: 'Support reselection fixture',
    stops,
    whyThisWorks: 'The original route keeps stale support stops around a Willow Glen proof anchor.',
    complete: true,
    starterSemanticRepresentation,
  }
  return {
    id: `support-reselection-${params.includeCompactAlternatives ? 'with' : 'without'}-alternatives`,
    sourceMode: 'live',
    flavor: scenarioNight.flavorLine,
    anchor: {
      venueId: proofStop.venueId,
      name: proofStop.name,
      district: proofStop.district ?? 'Willow Glen Pocket',
      verificationReasons: ['selected-stop bookstore proof'],
    },
    starts: [{ venueId: staleStart.venueId, name: staleStart.name, reason: staleStart.whyThisStop }],
    closes: [{ venueId: staleWindDown.venueId, name: staleWindDown.name, reason: staleWindDown.whyThisStop }],
    nearbyHappenings: [],
    districtContext: { primaryDistrict: params.selectionPocketLabel ?? 'Downtown Pocket' },
    fit: {
      persona: 'romantic',
      vibe: 'cultured',
      confidenceLine: 'Selected proof anchor is Willow Glen; support starts stale.',
      matchLine: 'Coffee & Books support reselection fixture',
    },
    storySpine: {
      start: staleStart.name,
      highlight: proofStop.name,
      windDown: staleWindDown.name,
    },
    selection: {
      pocketId: params.selectionPocketId ?? 'raw-pocket-downtown',
      directionId: params.directionId ?? 'direction-downtown',
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
      supportCoherence: 0.62,
      scenarioAlignment: 0.82,
      experienceAlignment: 0.82,
      localAuthority: 0.78,
      modeExcellence: 0.8,
    },
    starterSemanticRepresentation,
    scenarioNight,
  } as VerifiedCityOpportunity
}

function buildBuildRequiredAnchorProofTarget() {
  return {
    diagnosticOnly: true,
    proofTargetId: 'row1_step_b_coffee_books_representative',
    proofPolicy: 'build_required_anchor_soft_geography' as const,
    proofMode: 'build_required_anchor' as const,
    targetPocketId: 'raw-pocket-willow',
    targetPocketLabel: 'Willow Glen Pocket',
    activePocketId: 'raw-pocket-willow',
    activePocketLabel: 'Willow Glen Pocket',
    crossPocketAllowed: true,
  }
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

function assertBuildRequiredAnchorSupportSelectionReselectsStaleSupports(): void {
  const opportunity = buildSupportReselectionOpportunity({
    includeCompactAlternatives: true,
  })
  const directions = [buildDirectionCard({ directionId: 'direction-downtown', pocketId: 'raw-pocket-downtown' })]
  const first = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    starterPack: coffeeBooksStarterPack,
    proofTarget: buildBuildRequiredAnchorProofTarget(),
  })
  const second = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    starterPack: coffeeBooksStarterPack,
    proofTarget: buildBuildRequiredAnchorProofTarget(),
  })
  const artifact = first.candidateArtifacts[0]
  const diagnostic = first.diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(artifact, 'Build required-anchor support reselection must still materialize an artifact.')
  assert(diagnostic?.status === 'passed', `Support selection must pass, received ${diagnostic?.status}.`)
  assert(
    diagnostic.reason === 'anchor_centered_support_selection_applied',
    `Expected anchor-centered applied reason, received ${diagnostic.reason}.`,
  )
  assert(
    artifact.anchorVenueId === 'sj-willow-glen-bookhouse' &&
      artifact.storySpine.highlight === 'Willow Glen Bookhouse',
    'Required anchor must be preserved with its highlight role.',
  )
  assert(
    artifact.storySpine.start === 'Willow Glen Tea Atelier' &&
      artifact.storySpine.windDown === 'Willow Glen Bakehouse',
    `Stale support stops must be replaced around the required anchor pocket. route=${JSON.stringify(artifact.storySpine)} diagnostics=${JSON.stringify(diagnostic)}`,
  )
  assert(
    artifact.storySpine.highlight === 'Willow Glen Bookhouse',
    'Replacement must preserve start/highlight/windDown route shape.',
  )
  assert(
    second.candidateArtifacts[0]?.storySpine.start === artifact.storySpine.start &&
      second.candidateArtifacts[0]?.storySpine.windDown === artifact.storySpine.windDown,
    'Support replacement must be deterministic for the same inputs.',
  )
  assert(
    diagnostic.replacementSupportStops.some(
      (entry) =>
        entry.replaced &&
        entry.reason === 'support_stop_replaced_for_route_compactness' &&
        entry.replacementPocketLabel === 'Willow Glen Pocket',
    ),
    'Support replacement diagnostics must emit reason codes and replacement pockets.',
  )
  assert(
    diagnostic.movementTotalBefore !== null &&
      diagnostic.movementTotalAfter !== null &&
      diagnostic.movementTotalAfter < diagnostic.movementTotalBefore,
    'Anchor-centered support selection must improve route movement before Great Stop.',
  )
  assert(
    diagnostic.neighborhoodsAfter.length === 1 &&
      diagnostic.neighborhoodsAfter[0] === 'Willow Glen Pocket' &&
      diagnostic.anchorCentered &&
      diagnostic.greatStopInputUsesReplacedSupports,
    'Diagnostics must show the Great Stop input route is anchor-centered with replaced supports.',
  )
  assert(
    !artifact.qualification?.approvedRefinementEntryPayload,
    'Support replacement alone must not create an approved payload.',
  )
  process.stdout.write('Build required-anchor support reselection: passed\n')
}

function assertBuildRequiredAnchorSupportSelectionFailsClosedWithoutAlternatives(): void {
  const opportunity = buildSupportReselectionOpportunity({
    includeCompactAlternatives: false,
  })
  const directions = [buildDirectionCard({ directionId: 'direction-downtown', pocketId: 'raw-pocket-downtown' })]
  const bridge = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    starterPack: coffeeBooksStarterPack,
    proofTarget: buildBuildRequiredAnchorProofTarget(),
  })
  const diagnostic = bridge.diagnostics[0]
  assert(bridge.candidateArtifacts.length === 0, 'Missing compact alternatives must fail closed.')
  assert(
    diagnostic?.scenarioRouteBuildabilityReason === 'anchor_centered_support_selection_failed',
    `Expected support-selection failure, received ${diagnostic?.scenarioRouteBuildabilityReason}.`,
  )
  assert(
    diagnostic?.buildRequiredAnchorSupportSelection.status === 'failed' &&
      diagnostic.buildRequiredAnchorSupportSelection.reason === 'anchor_centered_support_selection_failed',
    'Fail-closed diagnostics must name anchor_centered_support_selection_failed.',
  )
  process.stdout.write('Build required-anchor support reselection fail-closed: passed\n')
}

function assertHardPocketModesDoNotReselectSupports(): void {
  const opportunity = buildSupportReselectionOpportunity({
    includeCompactAlternatives: true,
    selectionPocketId: 'raw-pocket-willow',
    selectionPocketLabel: 'Willow Glen Pocket',
    directionId: 'direction-willow',
  })
  const directions = [buildDirectionCard({ directionId: 'direction-willow', pocketId: 'raw-pocket-willow' })]
  const curate = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    starterPack: coffeeBooksStarterPack,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      proofPolicy: 'curate_hard_pocket',
      proofMode: 'curate_or_surprise',
      targetPocketId: 'raw-pocket-willow',
      targetPocketLabel: 'Willow Glen Pocket',
      activePocketId: 'raw-pocket-willow',
      activePocketLabel: 'Willow Glen Pocket',
      crossPocketAllowed: false,
    },
  })
  const surprise = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    starterPack: coffeeBooksStarterPack,
    proofTarget: {
      diagnosticOnly: true,
      proofTargetId: 'row1_step_b_coffee_books_representative',
      proofPolicy: 'surprise_hard_pocket',
      proofMode: 'curate_or_surprise',
      targetPocketId: 'raw-pocket-willow',
      targetPocketLabel: 'Willow Glen Pocket',
      activePocketId: 'raw-pocket-willow',
      activePocketLabel: 'Willow Glen Pocket',
      crossPocketAllowed: false,
    },
  })
  assert(
    curate.candidateArtifacts[0]?.storySpine.start === 'Rose Garden Twilight Walk' &&
      curate.diagnostics[0]?.buildRequiredAnchorSupportSelection.status === 'not_applicable',
    'Curate hard-pocket behavior must not inherit Build support reselection.',
  )
  assert(
    surprise.candidateArtifacts[0]?.storySpine.windDown === 'Japantown Matcha Kissaten' &&
      surprise.diagnostics[0]?.buildRequiredAnchorSupportSelection.status === 'not_applicable',
    'Surprise hard-pocket behavior must not inherit Build support reselection.',
  )
  process.stdout.write('Curate/Surprise hard-pocket support behavior unchanged: passed\n')
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
  assertBuildRequiredAnchorSupportSelectionReselectsStaleSupports()
  assertBuildRequiredAnchorSupportSelectionFailsClosedWithoutAlternatives()
  assertHardPocketModesDoNotReselectSupports()
  assertQueryTermsDoNotSatisfyProof()
  assertCompatibilityWrappersRemainNonAuthority()
  process.stdout.write('Step B hard-pocket proof-target assertion: passed\n')
}

main()
