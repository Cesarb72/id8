import { buildCurateScenarioBackedArtifactBridge } from '../src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts'
import { validatePublicCurateApprovedPayloadTruth } from '../src/app/services/curate/publicCurateCardTruthService.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import {
  buildScenarioNightsFromCandidateBoard,
  type BuiltScenarioNight,
} from '../src/domain/interpretation/construction/scenarioBuilder.ts'
import { buildStopTypeCandidateBoard } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import type {
  StopType,
  StopTypeCandidate,
  StopTypeCandidateBoard,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import { mapBuiltScenarioNightToVerifiedOpportunity } from '../src/domain/interpretation/verifiedCityOpportunity.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import type { Venue, VenueCategory } from '../src/domain/types/venue.ts'

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const coffeeBooksStarterPack = starterPacks.find((pack) => pack.id === 'coffee-books')
assert(coffeeBooksStarterPack, 'Missing Coffee & Books starter pack fixture.')

const requiredStopTypes: StopType[] = [
  'cultural_institution',
  'atmospheric_detour',
  'thoughtful_wine_or_lunch',
  'performance_or_fine_dining',
  'atmospheric_nightcap',
]

function buildCandidate(params: {
  stopType: StopType
  venueId: string
  name: string
  category: VenueCategory
  subcategory?: string
  tags?: string[]
  sourceTypes?: string[]
  roleFit?: StopTypeCandidate['roleFit']
  authorityScore?: number
  currentRelevance?: number
  geoBucket?: string
}): StopTypeCandidate {
  return {
    venueId: params.venueId,
    name: params.name,
    city: 'San Jose',
    district: 'Test Reading Pocket',
    neighborhoodLabel: 'Test Reading Pocket',
    geoBucket: params.geoBucket ?? 'raw-pocket-reading',
    geoBucketSource: 'district_intelligence',
    geoLabel: 'Test Reading Pocket',
    geoAssignmentMethod: 'district_intelligence_direct',
    stopType: params.stopType,
    venueCategory: params.category,
    venueSubcategory: params.subcategory,
    sourceLabel: 'curated',
    sourceType: 'venue',
    sourceTypes: params.sourceTypes ?? [params.category],
    venueTags: params.tags ?? ['quiet', 'curated'],
    authorityScore: params.authorityScore ?? 0.72,
    hiddenGemScore: 0.42,
    currentRelevance: params.currentRelevance ?? 0.68,
    culturalAnchorPotential: params.category === 'museum' ? 0.76 : 0.52,
    roleFit: params.roleFit ?? {
      start: 0.72,
      highlight: 0.72,
      windDown: 0.72,
    },
    reasons: [`${params.name} fits the local Coffee & Books fixture.`],
  }
}

function buildBoard(options: {
  includeInPocketLiteraryStop: boolean
  includeOutOfPocketLiteraryStop?: boolean
}): StopTypeCandidateBoard {
  const culturalHighlight = buildCandidate({
    stopType: 'thoughtful_wine_or_lunch',
    venueId: 'fixture-cultural-gallery',
    name: 'Pocket Cultural Gallery',
    category: 'museum',
    subcategory: 'gallery',
    tags: ['gallery', 'culture', 'quiet'],
    sourceTypes: ['museum', 'gallery'],
    roleFit: { start: 0.68, highlight: 0.85, windDown: 0.52 },
    authorityScore: 0.92,
  })
  const inPocketLiterary = buildCandidate({
    stopType: 'thoughtful_wine_or_lunch',
    venueId: 'fixture-reading-library',
    name: 'Pocket Reading Library',
    category: 'museum',
    subcategory: 'reading library',
    tags: ['reading', 'literary', 'quiet'],
    sourceTypes: ['library', 'book_store', 'museum'],
    roleFit: { start: 0.58, highlight: 0.7, windDown: 0.5 },
    authorityScore: 0.74,
  })
  const outOfPocketLiterary = buildCandidate({
    stopType: 'thoughtful_wine_or_lunch',
    venueId: 'fixture-outside-bookstore',
    name: 'Outside Pocket Bookstore',
    category: 'museum',
    subcategory: 'bookstore',
    tags: ['bookstore', 'reading', 'literary'],
    sourceTypes: ['book_store'],
    roleFit: { start: 0.58, highlight: 0.9, windDown: 0.5 },
    authorityScore: 0.96,
    geoBucket: 'raw-pocket-outside',
  })

  const highlightPool = [
    culturalHighlight,
    ...(options.includeInPocketLiteraryStop ? [inPocketLiterary] : []),
    // Simulates Field finding a qualifying stop that Bearings/pocket filtering did not admit.
    ...(options.includeOutOfPocketLiteraryStop ? [] : []),
  ]
  void outOfPocketLiterary

  return {
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    starterPack: coffeeBooksStarterPack,
    scenarioFamily: 'romantic_cultured',
    evaluationContract: {
      scenarioFamily: 'romantic_cultured',
      starterId: 'coffee-books',
      routeContract: coffeeBooksStarterPack.roleContracts,
    },
    requiredStopTypes,
    candidatesByStopType: {
      cultural_institution: [
        buildCandidate({
          stopType: 'cultural_institution',
          venueId: 'fixture-cafe-start',
          name: 'Pocket Quiet Cafe',
          category: 'cafe',
          sourceTypes: ['cafe'],
          roleFit: { start: 0.88, highlight: 0.42, windDown: 0.5 },
        }),
      ],
      atmospheric_detour: [
        buildCandidate({
          stopType: 'atmospheric_detour',
          venueId: 'fixture-mural-walk',
          name: 'Pocket Mural Walk',
          category: 'activity',
          sourceTypes: ['activity', 'art'],
          roleFit: { start: 0.68, highlight: 0.5, windDown: 0.42 },
        }),
      ],
      thoughtful_wine_or_lunch: highlightPool,
      performance_or_fine_dining: [
        buildCandidate({
          stopType: 'performance_or_fine_dining',
          venueId: 'fixture-dessert-winddown',
          name: 'Pocket Dessert Room',
          category: 'dessert',
          tags: ['quiet', 'calm'],
          sourceTypes: ['dessert'],
          roleFit: { start: 0.48, highlight: 0.56, windDown: 0.86 },
        }),
      ],
      atmospheric_nightcap: [
        buildCandidate({
          stopType: 'atmospheric_nightcap',
          venueId: 'fixture-tea-landing',
          name: 'Pocket Tea Landing',
          category: 'cafe',
          tags: ['quiet', 'calm'],
          sourceTypes: ['cafe'],
          roleFit: { start: 0.52, highlight: 0.44, windDown: 0.82 },
        }),
      ],
    } as StopTypeCandidateBoard['candidatesByStopType'],
    debug: {
      devGreatStopFixturesEnabled: false,
      scenarioCandidateBoardFixtureCandidates: [],
      scenarioCandidateBoardFixtureDrops: [],
      districtIntelligence: {
        profileCount: 1,
        assignedVenueCount: 5,
        admittedVenueCount: 5,
        blockedVenueCount: 0,
        selectedPocketIds: ['raw-pocket-reading'],
        notes: [],
        liveCandidateDiagnostics: [],
      },
    },
  }
}

function buildDirectionCards() {
  return [
    {
      id: 'direction-reading-pocket',
      cluster: 'romantic_cultured',
      card: { confirmation: 'Reading pocket direction' },
      debugMeta: {
        pocketId: 'pocket-reading',
        confidence: 0.9,
      },
    },
  ] as never
}

function buildVenue(params: {
  id: string
  name: string
  category: VenueCategory
  subcategory: string
  tags?: string[]
  sourceTypes?: string[]
  authority?: number
  culturalDepth?: number
  currentRelevance?: number
  geoOffset?: number
}): Venue {
  const offset = params.geoOffset ?? 0
  return {
    id: params.id,
    name: params.name,
    city: 'San Jose',
    neighborhood: 'Test Reading Pocket',
    driveMinutes: 8,
    category: params.category,
    subcategory: params.subcategory,
    priceTier: '$$',
    tags: params.tags ?? ['quiet', 'curated'],
    useCases: ['date'],
    vibeTags: ['cultured'],
    energyLevel: 2,
    socialDensity: 2,
    uniquenessScore: params.authority ?? 0.72,
    distinctivenessScore: params.authority ?? 0.72,
    underexposureScore: 0.5,
    shareabilityScore: 0.5,
    isChain: false,
    localSignals: {
      localFavoriteScore: params.authority ?? 0.72,
      neighborhoodPrideScore: 0.68,
      repeatVisitorScore: 0.5,
    },
    roleAffinity: {
      warmup: 0.64,
      peak: 0.68,
      wildcard: 0.5,
      cooldown: 0.62,
    },
    imageUrl: '',
    shortDescription: `${params.name} is a Coffee & Books board-level fixture.`,
    narrativeFlavor: `${params.name} supports a quiet cultured route.`,
    isHiddenGem: false,
    isActive: true,
    highlightCapable: true,
    durationProfile: {
      durationClass: 'M',
      estimatedMinutes: 45,
    },
    settings: {
      socialDensity: 2,
      highlightCapabilityTier: 'highlight-capable',
      highlightConfidence: 0.72,
      supportOnly: false,
      connectiveOnly: false,
      setting: 'indoor',
      familyFriendly: false,
      adultSocial: true,
      dateFriendly: true,
      eventCapable: false,
      musicCapable: false,
      performanceCapable: false,
      routeFootprint: 'compact',
    },
    signature: {
      chainLike: false,
      genericScore: 0.2,
      signatureScore: params.authority ?? 0.72,
    },
    source: {
      normalizedFromRawType: 'raw-place',
      sourceOrigin: 'live',
      provider: 'google_places',
      providerRecordId: `provider:${params.id}`,
      formattedAddress: 'San Jose, CA',
      latitude: 37.3382 + offset,
      longitude: -121.8863 - offset,
      sourceQueryLabel: 'coffee-books-highlight-culture@pocket',
      rating: 4.6,
      reviewCount: 120,
      sourceConfidence: 0.9,
      completenessScore: 0.9,
      qualityScore: params.authority ?? 0.72,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      businessStatus: 'operational',
      timeConfidence: 0.8,
      hoursPressureLevel: 'strong-open',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: params.sourceTypes ?? [params.category],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus: 'approved',
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: [],
      happenings: {
        hotspotStrength: 0.45,
        eventPotential: 0.1,
        performancePotential: 0.1,
        liveNightlifePotential: 0.1,
        culturalAnchorPotential: params.culturalDepth ?? 0.68,
        lateNightPotential: 0.2,
        currentRelevance: params.currentRelevance ?? 0.7,
        hiddenGemStrength: 0.4,
        majorVenueStrength: 0.25,
      },
    },
  } as Venue
}

function buildScoredVenue(venue: Venue, role = 0.66): ScoredVenue {
  return {
    venue,
    candidateIdentity: {
      candidateId: `candidate:${venue.id}`,
      baseVenueId: venue.id,
      kind: 'base',
      traceLabel: venue.name,
    },
    fitScore: 0.72,
    hiddenGemScore: 0.4,
    roleScores: { warmup: role, peak: role, wildcard: role, cooldown: role },
    vibeAuthority: { overall: 0.7 },
    taste: {
      signals: {
        anchorStrength: 0.7,
        conversationFriendliness: 0.75,
        interactiveStrength: 0.3,
        romanticSignals: { intimacy: 0.7, ambiance: 0.7 },
        momentEnrichment: {
          culturalDepth: venue.source.happenings?.culturalAnchorPotential ?? 0.68,
        },
      },
    },
  } as ScoredVenue
}

function assertProviderBookstoreSurvivesBoardAdmission(): void {
  const genericCulturalVenues = Array.from({ length: 6 }, (_, index) =>
    buildScoredVenue(
      buildVenue({
        id: `fixture-generic-cultural-${index + 1}`,
        name: `Generic Cultural Gallery ${index + 1}`,
        category: 'museum',
        subcategory: 'gallery',
        tags: ['gallery', 'museum', 'cultural'],
        sourceTypes: ['museum', 'gallery'],
        authority: 0.82 - index * 0.01,
        culturalDepth: 0.82,
        geoOffset: index * 0.0001,
      }),
      0.78,
    ),
  )
  const providerBookstore = buildScoredVenue(
    buildVenue({
      id: 'provider-recycle-bookstore',
      name: 'Recycle Bookstore',
      category: 'restaurant',
      subcategory: 'book_store',
      tags: ['bookstore', 'reading', 'literary', 'quiet'],
      sourceTypes: ['book_store', 'store', 'point_of_interest', 'establishment'],
      authority: 0.7,
      culturalDepth: 0.5,
      geoOffset: 0.0002,
    }),
    0.58,
  )
  const board = buildStopTypeCandidateBoard({
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    starterPack: coffeeBooksStarterPack,
    scenarioFamilyOverride: 'romantic_cultured',
    scoredVenues: [...genericCulturalVenues, providerBookstore],
  })
  assert(board, 'Expected provider-style Coffee & Books board.')
  const bookstorePoolEntries = Object.values(board.candidatesByStopType)
    .flat()
    .filter((candidate) => candidate.venueId === providerBookstore.venue.id)
  const bookstoreDiagnostics = Object.values(board.debug?.candidateDiagnosticsByStopType ?? {})
    .flatMap((diagnostic) => diagnostic.topCandidates)
    .filter((candidate) => candidate.venueId === providerBookstore.venue.id)
  assert(
    bookstorePoolEntries.length > 0,
    `Provider bookstore supply must survive stop-type board admission before scenario selection. diagnostics=${JSON.stringify(bookstoreDiagnostics)}`,
  )
  const nights = buildScenarioNightsFromCandidateBoard(board, { minNights: 2, maxNights: 2 })
  const selected = nights[0]
  assert(selected, 'Expected board-level provider bookstore scenario night.')
  assert(
    selected.starterSemanticRepresentation?.status === 'represented',
    'Board-level provider bookstore supply must become selected-stop semantic proof.',
  )
  assert(
    selected.stops.some((stop) => stop.venueId === providerBookstore.venue.id),
    'Selected route must include the admitted provider bookstore stop.',
  )
  process.stdout.write('Coffee & Books provider bookstore board admission: passed\n')
}

function mapNightToOpportunity(night: BuiltScenarioNight) {
  const opportunity = mapBuiltScenarioNightToVerifiedOpportunity({
    night,
    districtDiscoveryCards: [{ id: 'pocket-reading', name: 'Test Reading Pocket' }],
    directionCards: buildDirectionCards(),
    personaLabel: 'romantic',
    vibeLabel: 'cultured',
    starterPack: coffeeBooksStarterPack,
  })
  assert(opportunity, 'Scenario night must map to a verified opportunity.')
  return opportunity
}

function buildApprovedPayloadRoute(params: {
  artifactId: string
  selectedDirectionId: string
  start: string
  highlight: string
  windDown: string
}): RuntimeRouteArtifact {
  const stops = [
    { role: 'start' as const, displayName: params.start },
    { role: 'highlight' as const, displayName: params.highlight },
    { role: 'windDown' as const, displayName: params.windDown },
  ].map((stop, index) => ({
    id: `${params.artifactId}-${stop.role}`,
    sourceStopId: `${params.artifactId}-${stop.role}-source`,
    displayName: stop.displayName,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    address: 'San Jose, CA',
    role: stop.role,
    stopIndex: index,
    venueId: `${params.artifactId}-${stop.role}-venue`,
    title: stop.displayName,
    subtitle: 'Coffee & Books fixture stop',
    neighborhood: 'Test Reading Pocket',
    driveMinutes: 0,
    imageUrl: '',
  }))
  return {
    routeId: `${params.artifactId}-route`,
    selectedDirectionId: params.selectedDirectionId,
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Approved Coffee & Books fixture',
    routeSummary: 'A local fixture route with selected-stop literary proof.',
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1,
  }
}

function assertInPocketLiteraryStopQualifies(): void {
  const nights = buildScenarioNightsFromCandidateBoard(
    buildBoard({ includeInPocketLiteraryStop: true }),
    { minNights: 2, maxNights: 2 },
  )
  const selected = nights[0]
  assert(selected, 'Expected an in-pocket Coffee & Books scenario night.')
  assert(
    selected.starterSemanticRepresentation?.status === 'represented',
    'In-pocket literary/bookstore evidence must produce represented starter semantics.',
  )
  assert(
    selected.starterSemanticRepresentation.evidence.some(
      (entry) => entry.source === 'selected_route_stop',
    ),
    'Starter semantics must be backed by selected-route-stop evidence.',
  )
  assert(
    selected.stops.some((stop) => /reading|library|book/i.test(stop.name)),
    'Selected route must carry actual literary/bookstore stop evidence.',
  )

  const opportunity = mapNightToOpportunity(selected)
  const bridge = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: buildDirectionCards(),
    allDirectionCards: buildDirectionCards(),
    starterPack: coffeeBooksStarterPack,
  })
  assert(
    bridge.candidateArtifacts.length === 1 &&
      bridge.qualificationCandidateArtifacts.length === 1,
    'In-pocket literary/bookstore artifact must enter candidate and qualification carrier.',
  )
  const artifact = bridge.qualificationCandidateArtifacts[0]
  assert(
    artifact.enrichment?.starterSemanticRepresentation?.status === 'represented',
    'ContractEntryArtifact enrichment must carry represented starter semantics.',
  )
  const finalRoute = buildApprovedPayloadRoute({
    artifactId: artifact.id,
    selectedDirectionId: artifact.selection.directionId ?? 'direction-reading-pocket',
    start: artifact.storySpine.start,
    highlight: artifact.storySpine.highlight,
    windDown: artifact.storySpine.windDown,
  })
  const approvedTruth = validatePublicCurateApprovedPayloadTruth({
    selectedStarterPack: coffeeBooksStarterPack,
    artifact,
    approvedRefinementEntryPayload: {
      artifactId: artifact.id,
      starterPackId: coffeeBooksStarterPack.id,
      finalRoute,
    },
  })
  assert(
    approvedTruth.allowedToRender &&
      approvedTruth.coffeeBooksSemanticRepresentationStatus === 'represented',
    'Approved payload truth must see selected-stop Coffee & Books proof.',
  )
  process.stdout.write('Coffee & Books in-pocket semantic carrier: passed\n')
}

function assertOutOfPocketOnlyLiteraryStopFailsEarly(): void {
  const nights = buildScenarioNightsFromCandidateBoard(
    buildBoard({
      includeInPocketLiteraryStop: false,
      includeOutOfPocketLiteraryStop: true,
    }),
    { minNights: 2, maxNights: 2 },
  )
  const selected = nights[0]
  assert(selected, 'Expected a diagnostic Coffee & Books scenario night.')
  assert(
    selected.starterSemanticRepresentation?.status === 'missing',
    'Out-of-pocket-only literary evidence must not be copied into selected-stop proof.',
  )
  assert(
    selected.starterSemanticRepresentation.rejectionReasons?.includes(
      'missing_explicit_book_reading_literary_library_or_bookstore_stop',
    ),
    'Missing selected-stop literary proof must remain explicit.',
  )
  const opportunity = mapNightToOpportunity(selected)
  const bridge = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: [opportunity],
    fallbackOpportunities: [],
    ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
    directionCards: buildDirectionCards(),
    allDirectionCards: buildDirectionCards(),
    starterPack: coffeeBooksStarterPack,
  })
  assert(
    bridge.candidateArtifacts.length === 0 &&
      bridge.qualificationCandidateArtifacts.length === 0,
    'Missing in-pocket literary/bookstore proof must not enter qualification.',
  )
  const rejection = bridge.diagnostics.find(
    (entry) =>
      entry.scenarioRouteBuildabilityReason ===
      'coffee_books_insufficient_in_pocket_literary_supply',
  )
  assert(
    rejection?.scenarioRouteBuildabilityStatus === 'rejected' &&
      rejection.hardCommitFeasibility.failureClass === 'semantic_contract_failed',
    'Out-of-pocket-only literary/bookstore supply must fail early with semantic insufficient-supply diagnostics.',
  )
  process.stdout.write('Coffee & Books out-of-pocket insufficient supply: passed\n')
}

function main(): void {
  assertProviderBookstoreSurvivesBoardAdmission()
  assertInPocketLiteraryStopQualifies()
  assertOutOfPocketOnlyLiteraryStopFailsEarly()
  process.stdout.write('Coffee & Books Step B semantic carrier: passed\n')
}

main()
