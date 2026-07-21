import { readFileSync } from 'node:fs'
import {
  buildCurateScenarioBackedArtifactBridge,
  evaluateCurateHardPocketProofTargetAssertion,
  type CurateBuildAdmittedSupportCandidate,
} from '../src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import { buildContractEntryArtifactLineage } from '../src/domain/artifacts/contractEntryArtifact.ts'
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
  roleFit?: Partial<BuiltScenarioStop['roleFit']>
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
    roleFit: { start: 0.72, highlight: 0.72, windDown: 0.72, ...params.roleFit },
  }
}

function buildAdmittedSupportCandidate(params: {
  venueId?: string
  name?: string
  category?: VenueCategory
  subcategory?: string
  geoBucket?: string
  geoLabel?: string
  sourceLabel?: string
  sourceTypes?: string[]
  admitted?: boolean
  admissionEvidenceSource?: CurateBuildAdmittedSupportCandidate['admissionEvidenceSource']
  admissionStatusBeforeAdaptation?: string | null
  admissionStatusAfterAdaptation?: string | null
  blockedReason?: string | null
  enteredStopTypePool?: boolean
  enteredAnyScenarioNight?: boolean
  roleFit?: Partial<NonNullable<CurateBuildAdmittedSupportCandidate['roleFit']>>
  score?: number
} = {}): CurateBuildAdmittedSupportCandidate {
  return {
    venueId: params.venueId ?? 'sj-willow-glen-cafe-landing',
    name: params.name ?? 'Willow Glen Cafe Landing',
    district: params.geoLabel ?? 'Willow Glen Pocket',
    neighborhoodLabel: params.geoLabel ?? 'Willow Glen Pocket',
    geoBucket: params.geoBucket ?? 'raw-pocket-willow-live',
    geoBucketSource: 'district_intelligence',
    geoLabel: params.geoLabel ?? 'Willow Glen Pocket',
    geoAssignmentMethod: 'district_intelligence_direct',
    venueCategory: params.category ?? 'cafe',
    venueSubcategory: params.subcategory ?? 'coffee-shop',
    sourceLabel: params.sourceLabel ?? 'coffee-books-start-reading@pocket',
    sourceTypes: params.sourceTypes ?? ['coffee-shop', 'cafe', 'food-store'],
    authorityScore: params.score ?? 0.77,
    currentRelevance: params.score ?? 0.77,
    score: params.score ?? 0.77,
    boardRank: 6,
    admitted: params.admitted ?? true,
    ...(params.admissionEvidenceSource
      ? { admissionEvidenceSource: params.admissionEvidenceSource }
      : {}),
    ...(params.admissionStatusBeforeAdaptation !== undefined
      ? { admissionStatusBeforeAdaptation: params.admissionStatusBeforeAdaptation }
      : {}),
    ...(params.admissionStatusAfterAdaptation !== undefined
      ? { admissionStatusAfterAdaptation: params.admissionStatusAfterAdaptation }
      : {}),
    blockedReason: params.blockedReason ?? null,
    enteredStopTypePool: params.enteredStopTypePool ?? false,
    enteredAnyScenarioNight: params.enteredAnyScenarioNight ?? false,
    roleFit: { start: 1, highlight: 1, windDown: 1, ...params.roleFit },
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
    : [staleStart, compactStart, proofStop, staleWindDown]
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

function assertBuildRequiredAnchorSupportSelectionUsesAdmittedWindDownSupply(): void {
  const opportunity = buildSupportReselectionOpportunity({
    includeCompactAlternatives: false,
  })
  const admittedSupportCandidate = buildAdmittedSupportCandidate()
  const directions = [buildDirectionCard({ directionId: 'direction-downtown', pocketId: 'raw-pocket-downtown' })]
  const first = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    admittedSupportCandidates: [admittedSupportCandidate],
    starterPack: coffeeBooksStarterPack,
    proofTarget: buildBuildRequiredAnchorProofTarget(),
  })
  const second = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    admittedSupportCandidates: [admittedSupportCandidate],
    starterPack: coffeeBooksStarterPack,
    proofTarget: buildBuildRequiredAnchorProofTarget(),
  })
  const artifact = first.candidateArtifacts[0]
  const diagnostic = first.diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(artifact, 'Admitted windDown supply must allow Build support selection to materialize an artifact.')
  assert(diagnostic?.status === 'passed', `Admitted windDown support selection must pass, got ${diagnostic?.status}.`)
  assert(
    diagnostic.reason === 'build_required_anchor_support_from_admitted_supply',
    `Expected admitted-supply reason, received ${diagnostic.reason}.`,
  )
  assert(
    artifact.anchorVenueId === 'sj-willow-glen-bookhouse' &&
      artifact.storySpine.highlight === 'Willow Glen Bookhouse',
    'Admitted windDown fallback must preserve the required anchor.',
  )
  assert(
    artifact.storySpine.start === 'Willow Glen Tea Atelier' &&
      artifact.storySpine.windDown === 'Willow Glen Cafe Landing',
    `Expected admitted Willow Glen windDown route, got ${JSON.stringify(artifact.storySpine)}.`,
  )
  const lineage = buildContractEntryArtifactLineage(artifact)
  assert(
    artifact.enrichment?.materializedRouteStops?.start?.venueId === 'sj-willow-glen-tea-atelier' &&
      artifact.enrichment.materializedRouteStops.highlight?.venueId === 'sj-willow-glen-bookhouse' &&
      artifact.enrichment.materializedRouteStops.windDown?.venueId === 'sj-willow-glen-cafe-landing',
    `Materialized route stops must carry replacement route ids: ${JSON.stringify(artifact.enrichment?.materializedRouteStops)}`,
  )
  assert(
    lineage.materializedRouteStops?.start?.venueId === 'sj-willow-glen-tea-atelier' &&
      lineage.materializedRouteStops.highlight?.venueId === 'sj-willow-glen-bookhouse' &&
      lineage.materializedRouteStops.windDown?.venueId === 'sj-willow-glen-cafe-landing',
    `ContractEntryArtifact lineage must preserve materialized replacement ids: ${JSON.stringify(lineage.materializedRouteStops)}`,
  )
  assert(
    !Object.values(lineage.materializedRouteStops ?? {}).some(
      (stop) => stop?.venueId === 'fixture-japantown-kissaten',
    ),
    'Stale original windDown must not survive in materialized route lineage.',
  )
  assert(
    diagnostic.routeShapePreserved &&
      Boolean(artifact.storySpine.start) &&
      Boolean(artifact.storySpine.highlight) &&
      Boolean(artifact.storySpine.windDown),
    'Admitted windDown fallback must preserve start/highlight/windDown route shape.',
  )
  assert(
    second.candidateArtifacts[0]?.storySpine.start === artifact.storySpine.start &&
      second.candidateArtifacts[0]?.storySpine.windDown === artifact.storySpine.windDown,
    'Admitted windDown support selection must be deterministic for the same inputs.',
  )
  assert(
    diagnostic.scenarioSupportCandidateCountByRole.windDown === 0 &&
      diagnostic.admittedCandidateBoardCountByRole.windDown === 1 &&
      diagnostic.admittedFallbackCandidateCountByRole.windDown > 0,
    `Diagnostics must separate missing scenario windDown from admitted fallback candidates: ${JSON.stringify(diagnostic)}`,
  )
  assert(
    diagnostic.supportSelectionSourceByRole.start === 'scenario_stop' &&
      diagnostic.supportSelectionSourceByRole.windDown === 'admitted_candidate_board' &&
      diagnostic.supportSelectionUsedCandidateBoardFallback,
    `Diagnostics must distinguish scenario and admitted support sources: ${JSON.stringify(diagnostic.supportSelectionSourceByRole)}`,
  )
  assert(
    diagnostic.replacementSupportStops.some(
      (entry) =>
        entry.role === 'windDown' &&
        entry.replaced &&
        entry.reason === 'admitted_winddown_candidate_selected' &&
        entry.replacementStopName === 'Willow Glen Cafe Landing',
    ),
    'Replacement diagnostics must name admitted windDown selection.',
  )
  assert(
    diagnostic.chosenWindDownCandidate?.name === 'Willow Glen Cafe Landing' &&
      diagnostic.chosenWindDownCandidate.source === 'admitted_candidate_board',
    `Chosen windDown diagnostic must identify admitted candidate: ${JSON.stringify(diagnostic.chosenWindDownCandidate)}`,
  )
  assert(
    diagnostic.chosenWindDownAdmissionSource === 'carried_admission' &&
      diagnostic.rawCandidateBoardCountByRole.windDown === 1 &&
      diagnostic.admissionProvenCandidateBoardCountByRole.windDown === 1 &&
      diagnostic.roleEligibleCandidateBoardCountByRole.windDown === 1 &&
      diagnostic.finalFallbackPoolCountByRole.windDown === 1,
    `Admission aggregate diagnostics must expose carried candidate-board admission: ${JSON.stringify(diagnostic)}`,
  )
  assert(
    diagnostic.windDownCandidateDiagnostics.some(
      (entry) =>
        entry.name === 'Willow Glen Cafe Landing' &&
        entry.source === 'admitted_candidate_board' &&
        entry.sourceLabel === 'coffee-books-start-reading@pocket' &&
        entry.admitted === true &&
        entry.admissionEvidenceSource === 'carried_admission' &&
        entry.admissionStatusAfterAdaptation === 'admitted' &&
        entry.enteredStopTypePool === false &&
        entry.enteredAnyScenarioNight === false &&
        entry.roleFit?.windDown === 1 &&
        entry.anchorPocketMatch &&
        entry.roleSemanticsPassed &&
        entry.roleContractPassed &&
        entry.deterministicRankPosition === 1 &&
        entry.selected,
    ),
    `WindDown candidate diagnostics must show selected admitted role/contract pass: ${JSON.stringify(diagnostic.windDownCandidateDiagnostics)}`,
  )
  assert(
    diagnostic.movementTotalBefore !== null &&
      diagnostic.movementTotalAfter !== null &&
      diagnostic.movementTotalAfter < diagnostic.movementTotalBefore &&
      diagnostic.maxTransitionBefore !== null &&
      diagnostic.maxTransitionAfter !== null &&
      diagnostic.maxTransitionAfter < diagnostic.maxTransitionBefore &&
      diagnostic.neighborhoodsAfter.length === 1 &&
      diagnostic.neighborhoodsAfter[0] === 'Willow Glen Pocket',
    'Admitted support selection must improve anchor-centered compactness before Great Stop.',
  )
  assert(
    !artifact.qualification?.approvedRefinementEntryPayload,
    'Admitted support replacement alone must not create an approved payload.',
  )
  process.stdout.write('Build admitted windDown support selection: passed\n')
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

function assertBuildRequiredAnchorSupportSelectionRejectsLowFitAdmittedWindDown(): void {
  const opportunity = buildSupportReselectionOpportunity({
    includeCompactAlternatives: false,
  })
  const rejectedCandidate = buildAdmittedSupportCandidate({
    venueId: 'sj-willow-glen-low-fit-cafe',
    name: 'Willow Glen Low-Fit Cafe',
    roleFit: { start: 0.2, highlight: 0.3, windDown: 0.2 },
  })
  const directions = [buildDirectionCard({ directionId: 'direction-downtown', pocketId: 'raw-pocket-downtown' })]
  const bridge = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: directions,
    allDirectionCards: directions,
    admittedSupportCandidates: [rejectedCandidate],
    starterPack: coffeeBooksStarterPack,
    proofTarget: buildBuildRequiredAnchorProofTarget(),
  })
  const diagnostic = bridge.diagnostics[0]
  const supportDiagnostic = diagnostic?.buildRequiredAnchorSupportSelection
  assert(bridge.candidateArtifacts.length === 0, 'Low-fit admitted windDown supply must fail closed.')
  assert(
    diagnostic?.scenarioRouteBuildabilityReason === 'anchor_centered_support_selection_failed',
    `Expected support-selection failure, received ${diagnostic?.scenarioRouteBuildabilityReason}.`,
  )
  assert(
    supportDiagnostic?.status === 'failed' &&
      supportDiagnostic.reason === 'build_required_anchor_no_admitted_winddown_support_candidate' &&
      supportDiagnostic.scenarioSupportCandidateCountByRole.windDown === 0 &&
      supportDiagnostic.admittedCandidateBoardCountByRole.windDown === 1 &&
      supportDiagnostic.admittedFallbackCandidateCountByRole.windDown === 0,
    `Fail-closed diagnostics must show no qualifying windDown supply: ${JSON.stringify(supportDiagnostic)}.`,
  )
  assert(
    supportDiagnostic.windDownCandidateDiagnostics.some(
      (entry) =>
        entry.name === 'Willow Glen Low-Fit Cafe' &&
        entry.source === 'admitted_candidate_board' &&
        entry.anchorPocketMatch &&
        !entry.roleSemanticsPassed &&
        entry.rejectedReason === 'role_semantics_failed',
    ),
    `Rejected admitted windDown diagnostics must name role semantics failure: ${JSON.stringify(supportDiagnostic.windDownCandidateDiagnostics)}`,
  )
  process.stdout.write('Build admitted windDown role-semantics fail-closed: passed\n')
}

function assertBuildRequiredAnchorSupportSelectionRejectsCandidateBoardPolicyFailures(): void {
  const directions = [buildDirectionCard({ directionId: 'direction-downtown', pocketId: 'raw-pocket-downtown' })]
  const runWithCandidate = (candidate: CurateBuildAdmittedSupportCandidate) => {
    const opportunity = buildSupportReselectionOpportunity({
      includeCompactAlternatives: false,
    })
    return buildCurateScenarioBackedArtifactBridge({
      primaryOpportunities: [opportunity],
      fallbackOpportunities: [],
      ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
      directionCards: directions,
      allDirectionCards: directions,
      admittedSupportCandidates: [candidate],
      starterPack: coffeeBooksStarterPack,
      proofTarget: buildBuildRequiredAnchorProofTarget(),
    })
  }

  const roleContractRejected = runWithCandidate(
    buildAdmittedSupportCandidate({
      venueId: 'sj-willow-glen-late-bar',
      name: 'Willow Glen Late Bar',
      category: 'bar',
      sourceTypes: ['bar'],
      roleFit: { windDown: 1 },
    }),
  ).diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(
    roleContractRejected?.status === 'failed' &&
      roleContractRejected.admittedCandidateBoardCountByRole.windDown === 1 &&
      roleContractRejected.admittedFallbackCandidateCountByRole.windDown === 0 &&
      roleContractRejected.windDownCandidateDiagnostics.some(
        (entry) =>
          entry.name === 'Willow Glen Late Bar' &&
          entry.rejectedReason === 'role_contract_failed',
      ),
    `Coffee & Books windDown contract must reject non-low-energy candidate-board support: ${JSON.stringify(roleContractRejected)}`,
  )

  const pocketRejected = runWithCandidate(
    buildAdmittedSupportCandidate({
      venueId: 'sj-downtown-cafe',
      name: 'Downtown Cafe',
      geoBucket: 'raw-pocket-downtown',
      geoLabel: 'Downtown Pocket',
    }),
  ).diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(
    pocketRejected?.status === 'failed' &&
      pocketRejected.windDownCandidateDiagnostics.some(
        (entry) =>
          entry.name === 'Downtown Cafe' &&
          !entry.anchorPocketMatch &&
          entry.rejectedReason === 'anchor_pocket_mismatch',
      ),
    `Candidate-board fallback must reject non-anchor-pocket support: ${JSON.stringify(pocketRejected)}`,
  )

  const usedIdRejected = runWithCandidate(
    buildAdmittedSupportCandidate({
      venueId: 'sj-willow-glen-bookhouse',
      name: 'Willow Glen Bookhouse',
    }),
  ).diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(
    usedIdRejected?.status === 'failed' &&
      usedIdRejected.windDownCandidateDiagnostics.some(
        (entry) =>
          entry.name === 'Willow Glen Bookhouse' &&
          entry.usedIdConflict &&
          entry.rejectedReason === 'used_id_conflict',
      ),
    `Candidate-board fallback must reject required-anchor/used-id conflicts: ${JSON.stringify(usedIdRejected)}`,
  )

  process.stdout.write('Build admitted candidate-board policy rejection diagnostics: passed\n')
}

function assertBuildRequiredAnchorAdmissionShapeAdapter(): void {
  const directions = [buildDirectionCard({ directionId: 'direction-downtown', pocketId: 'raw-pocket-downtown' })]
  const runWithCandidates = (candidates: CurateBuildAdmittedSupportCandidate[]) => {
    const opportunity = buildSupportReselectionOpportunity({
      includeCompactAlternatives: false,
    })
    return buildCurateScenarioBackedArtifactBridge({
      primaryOpportunities: [opportunity],
      fallbackOpportunities: [],
      ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
      directionCards: directions,
      allDirectionCards: directions,
      admittedSupportCandidates: candidates,
      starterPack: coffeeBooksStarterPack,
      proofTarget: buildBuildRequiredAnchorProofTarget(),
    })
  }

  const missingAdmission = runWithCandidates([
    buildAdmittedSupportCandidate({
      venueId: 'sj-willow-glen-rolefit-only-cafe',
      name: 'Willow Glen RoleFit Only Cafe',
      admitted: false,
      enteredStopTypePool: false,
      roleFit: { windDown: 1 },
    }),
  ]).diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(
    missingAdmission?.status === 'failed' &&
      missingAdmission.reason ===
        'build_required_anchor_no_admission_proven_winddown_support_candidate' &&
      missingAdmission.rawCandidateBoardCountByRole.windDown === 1 &&
      missingAdmission.admissionProvenCandidateBoardCountByRole.windDown === 0 &&
      missingAdmission.roleEligibleCandidateBoardCountByRole.windDown === 0 &&
      missingAdmission.finalFallbackPoolCountByRole.windDown === 0,
    `Missing admission evidence must fail closed before roleFit can admit: ${JSON.stringify(missingAdmission)}`,
  )
  assert(
    missingAdmission.windDownCandidateDiagnostics.some(
      (entry) =>
        entry.name === 'Willow Glen RoleFit Only Cafe' &&
        entry.roleFit?.windDown === 1 &&
        entry.admissionEvidenceSource === 'none' &&
        entry.admissionStatusAfterAdaptation === 'missing' &&
        entry.rejectedReason === 'not_admitted_shape_unlinked',
    ),
    `RoleFit-only candidate must report missing admission evidence: ${JSON.stringify(missingAdmission.windDownCandidateDiagnostics)}`,
  )

  const boardEntered = runWithCandidates([
    buildAdmittedSupportCandidate({
      venueId: 'sj-willow-glen-board-entered-cafe',
      name: 'Willow Glen Board Entered Cafe',
      admitted: false,
      enteredStopTypePool: true,
      roleFit: { windDown: 1 },
    }),
  ])
  const boardEnteredDiagnostic = boardEntered.diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(
    boardEntered.candidateArtifacts[0]?.storySpine.windDown === 'Willow Glen Board Entered Cafe' &&
      boardEnteredDiagnostic?.chosenWindDownAdmissionSource === 'candidate_board_admitted' &&
      boardEnteredDiagnostic.admissionProvenCandidateBoardCountByRole.windDown === 1 &&
      boardEnteredDiagnostic.finalFallbackPoolCountByRole.windDown === 1,
    `Candidate-board entered marker must adapt into admitted support: ${JSON.stringify(boardEnteredDiagnostic)}`,
  )
  assert(
    boardEnteredDiagnostic.windDownCandidateDiagnostics.some(
      (entry) =>
        entry.name === 'Willow Glen Board Entered Cafe' &&
        entry.admissionEvidenceSource === 'candidate_board_admitted' &&
        entry.admissionStatusBeforeAdaptation === 'entered_stop_type_pool' &&
        entry.admissionStatusAfterAdaptation === 'admitted' &&
        entry.selected,
    ),
    `Board-entered admission diagnostics must be explicit: ${JSON.stringify(boardEnteredDiagnostic.windDownCandidateDiagnostics)}`,
  )

  const districtBlocked = runWithCandidates([
    buildAdmittedSupportCandidate({
      venueId: 'sj-willow-glen-district-blocked-cafe',
      name: 'Willow Glen District Blocked Cafe',
      admitted: false,
      admissionEvidenceSource: 'district_admission_diagnostic',
      admissionStatusBeforeAdaptation: 'blocked',
      admissionStatusAfterAdaptation: 'blocked',
      enteredStopTypePool: true,
      blockedReason: 'outside_admitted_bound',
      roleFit: { windDown: 1 },
    }),
  ]).diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(
    districtBlocked?.status === 'failed' &&
      districtBlocked.reason ===
        'build_required_anchor_no_admission_proven_winddown_support_candidate' &&
      districtBlocked.windDownCandidateDiagnostics.some(
        (entry) =>
          entry.name === 'Willow Glen District Blocked Cafe' &&
          entry.admissionEvidenceSource === 'district_admission_diagnostic' &&
          entry.rejectedReason === 'not_admitted_district_status_blocked',
      ),
    `District-blocked admission must fail closed even with board marker: ${JSON.stringify(districtBlocked)}`,
  )

  const ranked = runWithCandidates([
    buildAdmittedSupportCandidate({
      venueId: 'sj-willow-glen-lower-ranked-cafe',
      name: 'Willow Glen Lower Ranked Cafe',
      admitted: false,
      enteredStopTypePool: true,
      score: 0.62,
      roleFit: { windDown: 1 },
    }),
    buildAdmittedSupportCandidate({
      venueId: 'sj-willow-glen-higher-ranked-cafe',
      name: 'Willow Glen Higher Ranked Cafe',
      admitted: false,
      enteredStopTypePool: true,
      score: 0.91,
      roleFit: { windDown: 1 },
    }),
  ])
  const rankedDiagnostic = ranked.diagnostics[0]?.buildRequiredAnchorSupportSelection
  assert(
    ranked.candidateArtifacts[0]?.storySpine.windDown === 'Willow Glen Higher Ranked Cafe' &&
      rankedDiagnostic?.chosenWindDownCandidate?.name === 'Willow Glen Higher Ranked Cafe' &&
      rankedDiagnostic.finalFallbackPoolCountByRole.windDown === 2,
    `Deterministic ranking must choose the highest admitted support candidate: ${JSON.stringify(rankedDiagnostic)}`,
  )
  assert(
    rankedDiagnostic.windDownCandidateDiagnostics.some(
      (entry) =>
        entry.name === 'Willow Glen Higher Ranked Cafe' &&
        entry.deterministicRankPosition === 1 &&
        entry.selected,
    ) &&
      rankedDiagnostic.windDownCandidateDiagnostics.some(
        (entry) =>
          entry.name === 'Willow Glen Lower Ranked Cafe' &&
          entry.deterministicRankPosition === 2 &&
          !entry.selected,
      ),
    `Ranking diagnostics must expose selected and rejected ranks: ${JSON.stringify(rankedDiagnostic.windDownCandidateDiagnostics)}`,
  )

  assert(
    !boardEntered.candidateArtifacts[0]?.qualification?.approvedRefinementEntryPayload &&
      !ranked.candidateArtifacts[0]?.qualification?.approvedRefinementEntryPayload,
    'Admission adaptation alone must not create an approved payload or bypass Great Stop.',
  )
  process.stdout.write('Build candidate-board admission shape adapter: passed\n')
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
  const runGeneratePlanSource = readFileSync('src/domain/runGeneratePlan.ts', 'utf8')
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
  assert(
    runGeneratePlanSource.includes('roleTargetMapFromMaterializedRouteStops') &&
      runGeneratePlanSource.includes('hasMaterializedRouteStops') &&
      runGeneratePlanSource.includes('materialized_route_projection_missing_required_stops'),
    'Great Stop projection must prefer materialized route stops and fail closed when they are incomplete.',
  )
  assert(
    runGeneratePlanSource.includes('projectedGreatStopCandidateMatchesMaterializedRoute') &&
      runGeneratePlanSource.includes('stalePreferenceRouteBypassed') &&
      runGeneratePlanSource.includes('stalePreferenceStopIdsRemainingInProjectedCandidate'),
    'Great Stop projection diagnostics must expose materialized-route match and stale-preference bypass evidence.',
  )
  process.stdout.write('compatibility-wrapper-not-authority test: passed\n')
}

function main(): void {
  assertHardPocketAssertionPassesAndMaterializes()
  assertHardPocketAssertionRejectsMismatchedActivePocket()
  assertEquivalentPocketLabelsRemainHardPocketConsistent()
  assertSelectedProofStopMustBeInsideTargetPocket()
  assertBuildRequiredAnchorSupportSelectionReselectsStaleSupports()
  assertBuildRequiredAnchorSupportSelectionUsesAdmittedWindDownSupply()
  assertBuildRequiredAnchorSupportSelectionFailsClosedWithoutAlternatives()
  assertBuildRequiredAnchorSupportSelectionRejectsLowFitAdmittedWindDown()
  assertBuildRequiredAnchorSupportSelectionRejectsCandidateBoardPolicyFailures()
  assertBuildRequiredAnchorAdmissionShapeAdapter()
  assertHardPocketModesDoNotReselectSupports()
  assertQueryTermsDoNotSatisfyProof()
  assertCompatibilityWrappersRemainNonAuthority()
  process.stdout.write('Step B hard-pocket proof-target assertion: passed\n')
}

main()
