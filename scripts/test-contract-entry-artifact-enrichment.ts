import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  enrichContractEntryArtifact,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../src/domain/artifacts/contractEntryArtifact.ts'
import {
  buildContractEntryLockProjection,
  buildContractEntryPlansSummaryProjection,
  buildContractEntryReviewProjection,
  buildContractEntryRevealProjection,
  buildContractEntryVisibleCardProjection,
} from '../src/domain/artifacts/contractEntryArtifactProjection.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('ContractEntryArtifact enrichment tests must not call fetch.')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function buildBaseArtifact(): ContractEntryArtifact {
  return {
    id: 'contract-entry:test',
    sourceOpportunityId: 'opportunity:test',
    sourceMode: 'curated',
    anchorVenueId: 'venue:highlight',
    anchorRole: 'highlight',
    anchorName: 'San Jose Jazz Center',
    routeTitle: 'Live music loop',
    flavorLine: 'A complete music-led night.',
    routeSummary: 'Start close, anchor on music, wind down nearby.',
    traits: ['Focused', 'Cultural'],
    storySpine: {
      start: 'Nirvana Soul',
      highlight: 'San Jose Jazz Center',
      windDown: 'Orchard Gelato',
    },
    districtLine: 'Mostly in Downtown San Jose',
    districtAnchorLine: 'District anchor: Downtown',
    authorityLine: 'Authority 91%',
    whyChooseLine: 'The highlight carries the night.',
    whyTonightProofLine: 'Tonight has enough nearby support.',
    selection: {
      directionId: 'direction:downtown-live',
      pocketId: 'downtown',
    },
  }
}

function buildRuntimeRouteArtifact(): RuntimeRouteArtifact {
  return {
    routeId: 'runtime-route:test',
    selectedDirectionId: 'direction:downtown-live',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'cultured',
    activeStopIndex: 1,
    routeHeadline: 'Live music loop',
    routeSummary: 'A locked three-stop route.',
    liveNotices: [],
    updatedAt: 1,
    stops: [
      {
        id: 'stop:start',
        sourceStopId: 'stop:start',
        displayName: 'Nirvana Soul',
        providerRecordId: 'places/start',
        latitude: 37.337,
        longitude: -121.889,
        address: '315 S First St, San Jose, CA',
        role: 'start',
        stopIndex: 0,
        venueId: 'venue:start',
        title: 'Start here',
        subtitle: 'Coffee and conversation',
        neighborhood: 'Downtown',
        driveMinutes: 4,
        imageUrl: 'https://example.test/start.jpg',
      },
      {
        id: 'stop:highlight',
        sourceStopId: 'stop:highlight',
        displayName: 'San Jose Jazz Center',
        providerRecordId: 'places/highlight',
        latitude: 37.336,
        longitude: -121.89,
        address: '310 S First St, San Jose, CA',
        role: 'highlight',
        stopIndex: 1,
        venueId: 'venue:highlight',
        title: 'Main event',
        subtitle: 'Live performance',
        neighborhood: 'SoFA',
        driveMinutes: 5,
        imageUrl: 'https://example.test/highlight.jpg',
      },
      {
        id: 'stop:windDown',
        sourceStopId: 'stop:windDown',
        displayName: 'Orchard Gelato',
        providerRecordId: 'places/wind-down',
        latitude: 37.335,
        longitude: -121.891,
        address: '320 S First St, San Jose, CA',
        role: 'windDown',
        stopIndex: 2,
        venueId: 'venue:wind-down',
        title: 'Wind down',
        subtitle: 'Dessert close',
        neighborhood: 'SoFA',
        driveMinutes: 3,
        imageUrl: 'https://example.test/wind-down.jpg',
      },
    ],
    mapMarkers: [
      {
        id: 'stop:start',
        displayName: 'Nirvana Soul',
        role: 'start',
        stopIndex: 0,
        latitude: 37.337,
        longitude: -121.889,
      },
      {
        id: 'stop:highlight',
        displayName: 'San Jose Jazz Center',
        role: 'highlight',
        stopIndex: 1,
        latitude: 37.336,
        longitude: -121.89,
      },
      {
        id: 'stop:windDown',
        displayName: 'Orchard Gelato',
        role: 'windDown',
        stopIndex: 2,
        latitude: 37.335,
        longitude: -121.891,
      },
    ],
  }
}

function assertNoFifthArtifactLayer(): void {
  const fullPlanArtifactPath = resolve(process.cwd(), 'src/domain/artifacts/fullPlanArtifact.ts')
  assert(!existsSync(fullPlanArtifactPath), 'P0-A must not introduce fullPlanArtifact.ts.')
  const canonicalLadder = ['ContractEntryArtifact', 'RuntimeRouteArtifact']
  assert(canonicalLadder.length === 2, 'Canonical artifact ladder must have two layers.')
}

function main(): void {
  globalThis.fetch = fetchTrap
  assertNoFifthArtifactLayer()

  const baseArtifact = buildBaseArtifact()
  const compatibilityValidation = validateContractEntryArtifactPreCommitTruth(baseArtifact)
  assert(compatibilityValidation.status === 'valid', 'Existing artifacts must remain valid in compatibility mode.')
  assert(compatibilityValidation.fullPlanVisible, 'Existing story spine must derive full-plan visibility.')

  const strictValidation = validateContractEntryArtifactPreCommitTruth(baseArtifact, {
    requireEnrichment: true,
  })
  assert(strictValidation.status === 'incomplete', 'Strict validation must require enrichment.')
  assert(
    strictValidation.rejectionReasons.includes('missing_enrichment'),
    'Strict validation must report missing enrichment.',
  )

  const runtimeRouteArtifact = buildRuntimeRouteArtifact()
  const enrichedArtifact = enrichContractEntryArtifact(baseArtifact, {
    mode: 'curate',
    locationContext: {
      city: 'San Jose',
      neighborhood: 'SoFA',
    },
    userInputContext: {
      starterPackId: 'live-music-loop',
      primaryVibe: 'cultured',
      persona: 'friends',
    },
    conciergeIntentSummary: {
      planningMode: 'curated',
      primaryVibe: 'cultured',
      persona: 'friends',
      summary: 'Curated live music night in San Jose.',
    },
    tasteDistrictSummary: {
      tasteProfileId: 'cultured-live',
      districtId: 'sofa',
      districtLabel: 'SoFA',
      summary: 'Music-forward downtown pocket.',
    },
    fieldProvenanceSummary: {
      sourceMode: 'curated',
      provider: 'static-corpus',
      liveProviderUsed: false,
      corpusUsed: true,
      calibrationOnly: true,
      candidateCount: 3,
      queryLabels: ['start', 'highlight', 'windDown'],
    },
    bearingsAdmissionProof: {
      status: 'present',
      proofId: 'bearings:test',
      summary: 'Hours and geography represented.',
    },
    waypointSequenceProof: {
      status: 'present',
      proofId: 'waypoint:test',
      summary: 'Start, highlight, wind-down sequence represented.',
    },
    canonicalRouteRoleCoverage: {
      start: 'Nirvana Soul',
      highlight: 'San Jose Jazz Center',
      windDown: 'Orchard Gelato',
      support: [
        {
          role: 'surprise',
          name: 'Gallery walk',
          venueId: 'venue:support',
        },
      ],
    },
    validationStatus: 'valid',
    rejectionReasons: [],
    starterContextFit: {
      status: 'passed',
      starterPackId: 'live-music-loop',
      mode: 'curate',
      contextKey: 'live-music-loop:sofa',
      rejectionReasons: [],
    },
    runtimeLockEligibility: {
      eligible: true,
      status: 'eligible',
      selectedDirectionId: 'direction:downtown-live',
      runtimeRouteArtifact,
      buildMetadata: {
        canBuildRuntimeRoute: true,
      },
    },
  })

  const enrichedValidation = validateContractEntryArtifactPreCommitTruth(enrichedArtifact, {
    requireEnrichment: true,
  })
  assert(enrichedValidation.status === 'valid', 'Enriched artifact must pass strict validation.')
  assert(enrichedValidation.fullPlanVisible, 'Enriched artifact must be full-plan visible.')

  const rejectedArtifact = enrichContractEntryArtifact(baseArtifact, {
    starterContextFit: {
      status: 'rejected',
      starterPackId: 'live-music-loop',
      rejectionReasons: ['card_promise_mismatch'],
    },
  })
  const rejectedValidation = validateContractEntryArtifactPreCommitTruth(rejectedArtifact)
  assert(rejectedValidation.status === 'rejected', 'Starter mismatch must reject artifact truth.')
  assert(
    rejectedValidation.rejectionReasons.includes('card_promise_mismatch'),
    'Starter mismatch reason must be preserved.',
  )

  const incompleteArtifact = enrichContractEntryArtifact(baseArtifact, {
    validationStatus: 'incomplete',
    rejectionReasons: ['missing_field_provenance_summary'],
  })
  const incompleteValidation = validateContractEntryArtifactPreCommitTruth(incompleteArtifact)
  assert(incompleteValidation.status === 'incomplete', 'Explicit incomplete status must be preserved.')
  assert(
    incompleteValidation.rejectionReasons.includes('missing_field_provenance_summary'),
    'Explicit incomplete reasons must be preserved.',
  )

  const card = buildContractEntryVisibleCardProjection(enrichedArtifact)
  const review = buildContractEntryReviewProjection(enrichedArtifact)
  const reveal = buildContractEntryRevealProjection(enrichedArtifact)
  const lock = buildContractEntryLockProjection(enrichedArtifact)
  const plans = buildContractEntryPlansSummaryProjection(enrichedArtifact)
  assert(card.allowedToRender, 'Visible card projection must derive renderability from validation.')
  assert(review.routeRoles.highlight === 'San Jose Jazz Center', 'Review projection must derive route roles.')
  assert(reveal.districtLine === 'Mostly in Downtown San Jose', 'Reveal projection must derive district line.')
  assert(lock.runtimeRouteArtifact === runtimeRouteArtifact, 'Lock projection must preserve RuntimeRouteArtifact reference.')
  assert(plans.city === 'San Jose' && plans.mode === 'curate', 'Plans projection must derive context.')

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('contract entry artifact enrichment: passed\n')
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
