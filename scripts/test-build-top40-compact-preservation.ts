import { readFileSync } from 'node:fs'
import { preservePreferredArcCandidates } from '../src/domain/arc/assembleArcCandidates'
import type { ArcCandidate, ArcStop, ScoredVenue } from '../src/domain/types/arc'
import type { RolePools } from '../src/domain/arc/buildRolePools'
import type { IntentProfile, RouteShapeContract } from '../src/domain/types/intent'
import type { InternalRole, Venue } from '../src/domain/types/venue'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(
    `Unexpected fetch in top-40 compact preservation test: ${String(args[0])}`,
  )
}) as typeof fetch

function scoredVenue(id: string, name: string): ScoredVenue {
  return {
    venue: {
      id,
      name,
      city: 'San Jose',
      neighborhood: id.includes('anchor') ? 'anchor-neighborhood' : 'outer-neighborhood',
      driveMinutes: 8,
      category: 'cafe',
      subcategory: 'test',
      priceTier: '$$',
      tags: [],
      useCases: [],
      vibeTags: [],
      energyLevel: 0.5,
      socialDensity: 0.4,
      uniquenessScore: 0.5,
      distinctivenessScore: 0.5,
      underexposureScore: 0.4,
      shareabilityScore: 0.4,
      isChain: false,
      localSignals: {
        localFavoriteScore: 0.5,
        neighborhoodPrideScore: 0.5,
        repeatVisitorScore: 0.5,
      },
      roleAffinity: { warmup: 0.6, peak: 0.6, wildcard: 0.6, cooldown: 0.6 },
      imageUrl: '',
      shortDescription: '',
      narrativeFlavor: '',
      isHiddenGem: false,
      isActive: true,
      highlightCapable: true,
      durationProfile: {} as never,
      settings: {} as never,
      signature: {} as never,
      source: { sourceOrigin: 'curated' } as never,
    } as Venue,
    candidateIdentity: {
      candidateId: id,
      baseVenueId: id,
      kind: 'base',
      traceLabel: name,
    },
    momentIdentity: { type: 'support', strength: 'medium' } as never,
    fitBreakdown: {} as never,
    fitScore: 0.5,
    hiddenGemScore: 0.4,
    lensCompatibility: 0.5,
    contextSpecificity: {} as never,
    dominanceControl: {} as never,
    roleContract: {} as never,
    stopShapeFit: {} as never,
    vibeAuthority: {} as never,
    highlightValidity: {} as never,
    roleScores: { warmup: 0.6, peak: 0.6, wildcard: 0.6, cooldown: 0.6 },
    taste: {} as never,
  }
}

function stop(role: InternalRole, id: string, name: string): ArcStop {
  return { role, scoredVenue: scoredVenue(id, name) }
}

function candidate(params: {
  id: string
  startId: string
  anchorId: string
  windDownId: string
  totalScore: number
  compact: boolean
}): ArcCandidate {
  const anchorCluster = 'anchor-cluster'
  const outerA = `${params.id}-outer-a`
  const outerB = `${params.id}-outer-b`
  const start = stop('warmup', params.startId, `${params.startId} name`)
  const anchor = stop('peak', params.anchorId, 'Required Anchor')
  const windDown = stop('cooldown', params.windDownId, `${params.windDownId} name`)
  const clusterAssignments = params.compact
    ? [
        { venueId: params.startId, venueName: start.scoredVenue.venue.name, neighborhood: 'anchor-neighborhood', clusterId: anchorCluster },
        { venueId: params.anchorId, venueName: anchor.scoredVenue.venue.name, neighborhood: 'anchor-neighborhood', clusterId: anchorCluster },
        { venueId: params.windDownId, venueName: windDown.scoredVenue.venue.name, neighborhood: 'anchor-neighborhood', clusterId: anchorCluster },
      ]
    : [
        { venueId: params.startId, venueName: start.scoredVenue.venue.name, neighborhood: 'outer-a', clusterId: outerA },
        { venueId: params.anchorId, venueName: anchor.scoredVenue.venue.name, neighborhood: 'anchor-neighborhood', clusterId: anchorCluster },
        { venueId: params.windDownId, venueName: windDown.scoredVenue.venue.name, neighborhood: 'outer-b', clusterId: outerB },
      ]
  return {
    id: params.id,
    stops: [start, anchor, windDown],
    totalScore: params.totalScore,
    scoreBreakdown: {} as never,
    pacing: {} as never,
    spatial: {
      mode: 'walkable',
      homeClusterId: anchorCluster,
      clustersVisited: clusterAssignments.map((assignment) => assignment.clusterId),
      clusterAssignments,
      transitions: params.compact
        ? [
            {
              fromVenueId: params.startId,
              toVenueId: params.anchorId,
              fromClusterId: anchorCluster,
              toClusterId: anchorCluster,
              fromNeighborhood: 'anchor-neighborhood',
              toNeighborhood: 'anchor-neighborhood',
              driveGap: 10,
              sameCluster: true,
              clusterEscape: false,
              longTransition: false,
              jumpUsed: false,
              scoreDelta: 0,
              notes: [],
            },
            {
              fromVenueId: params.anchorId,
              toVenueId: params.windDownId,
              fromClusterId: anchorCluster,
              toClusterId: anchorCluster,
              fromNeighborhood: 'anchor-neighborhood',
              toNeighborhood: 'anchor-neighborhood',
              driveGap: 10,
              sameCluster: true,
              clusterEscape: false,
              longTransition: false,
              jumpUsed: false,
              scoreDelta: 0,
              notes: [],
            },
          ]
        : [
            {
              fromVenueId: params.startId,
              toVenueId: params.anchorId,
              fromClusterId: outerA,
              toClusterId: anchorCluster,
              fromNeighborhood: 'outer-a',
              toNeighborhood: 'anchor-neighborhood',
              driveGap: 18,
              sameCluster: false,
              clusterEscape: true,
              longTransition: true,
              jumpUsed: false,
              scoreDelta: -0.2,
              notes: [],
            },
            {
              fromVenueId: params.anchorId,
              toVenueId: params.windDownId,
              fromClusterId: anchorCluster,
              toClusterId: outerB,
              fromNeighborhood: 'anchor-neighborhood',
              toNeighborhood: 'outer-b',
              driveGap: 18,
              sameCluster: false,
              clusterEscape: true,
              longTransition: true,
              jumpUsed: false,
              scoreDelta: -0.2,
              notes: [],
            },
          ],
      sameClusterTransitionCount: params.compact ? 2 : 0,
      clusterEscapeCount: params.compact ? 0 : 2,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: params.compact ? 0 : 2,
      jumpUsed: false,
      spatialBonus: 0,
      spatialPenalty: 0,
      score: params.compact ? 1 : 0.2,
      notes: [],
    },
    hasWildcard: false,
  }
}

const intent: IntentProfile = {
  id: 'test-top40-compact-preservation',
  mode: 'build',
  planningMode: 'user-led',
  persona: 'romantic',
  city: 'San Jose',
  distanceMode: 'nearby',
  anchor: {
    venueId: 'sj-required-anchor',
    role: 'highlight',
  },
} as never

const routeShapeContract: RouteShapeContract = {
  id: 'test-tight-route-shape',
  arcShape: 'steady_open_curated_center_soft_landing',
  roleProfile: {} as never,
  roleInvariants: {} as never,
  movementProfile: {
    radius: 'tight',
    maxTransitionMinutes: 14,
    neighborhoodContinuity: 'strict',
  },
  mutationProfile: {
    swapFlexibility: 'low',
    allowedRoles: ['start', 'highlight', 'windDown'],
    preservePriority: ['role', 'feasibility', 'movement'],
  },
  expansionProfile: {} as never,
}

const rolePools: RolePools = {
  warmup: [],
  peak: [],
  wildcard: [],
  cooldown: [],
  contractPoolStatus: {
    warmup: { role: 'warmup' },
    peak: { role: 'peak' },
    wildcard: { role: 'wildcard' },
    cooldown: { role: 'cooldown' },
  } as never,
}

const broadCandidates = Array.from({ length: 45 }, (_, index) =>
  candidate({
    id: `broad-${index}`,
    startId: `broad-start-${index}`,
    anchorId: 'sj-required-anchor',
    windDownId: `broad-wind-${index}`,
    totalScore: 100 - index,
    compact: false,
  }),
)
const compactCandidate = candidate({
  id: 'compact-anchor-preserving',
  startId: 'near-start',
  anchorId: 'sj-required-anchor',
  windDownId: 'near-wind',
  totalScore: 1,
  compact: true,
})
const rankedCandidates = [...broadCandidates, compactCandidate]

const preserved = preservePreferredArcCandidates(
  rankedCandidates,
  rolePools,
  intent,
  40,
  { routeShapeContract },
)
assert(preserved.candidates.length === 40, 'Top-40 cap must remain unchanged.')
assert(
  preserved.candidates.some((item) => item.id === compactCandidate.id),
  'Compact anchor-preserving candidate must be preserved into post-top-40.',
)
assert(
  preserved.diagnostics?.compactCandidatesPreservedIntoTop40Count === 1,
  'Compact preservation count must be exposed.',
)
assert(
  preserved.diagnostics?.placeRightCandidatesPreservedIntoTop40Count === 1,
  'Place-right preservation count must be exposed.',
)
assert(
  preserved.diagnostics?.preservedCompactCandidateIds.includes(compactCandidate.id),
  'Preserved compact candidate id must be exposed.',
)
assert(
  preserved.diagnostics?.candidatePreservationReason ===
    'preserved_due_to_tight_compact_anchor_candidate',
  'Candidate preservation reason must be exposed.',
)
assert(
  (preserved.diagnostics?.replacedCandidateCount ?? 0) === 1,
  'Preservation must replace exactly one lower-priority candidate.',
)
assert(
  preserved.candidates.some((item) => item.id.startsWith('broad-')),
  'Broad/cross-cluster fallback candidates must remain available.',
)
assert(
  preserved.candidates.every((item) =>
    item.stops.some(
      (candidateStop) =>
        candidateStop.role === 'peak' &&
        candidateStop.scoredVenue.candidateIdentity.baseVenueId === 'sj-required-anchor',
    ),
  ),
  'Required anchor must remain preserved.',
)

const repeatPreserved = preservePreferredArcCandidates(
  rankedCandidates,
  rolePools,
  intent,
  40,
  { routeShapeContract },
)
assert(
  repeatPreserved.candidates.map((item) => item.id).join('|') ===
    preserved.candidates.map((item) => item.id).join('|'),
  'Preservation must be deterministic for same anchor and intent.',
)

const nonTightPreserved = preservePreferredArcCandidates(
  rankedCandidates,
  rolePools,
  intent,
  40,
  {
    routeShapeContract: {
      ...routeShapeContract,
      movementProfile: {
        ...routeShapeContract.movementProfile,
        radius: 'balanced',
      },
    } as RouteShapeContract,
  },
)
assert(
  !nonTightPreserved.candidates.some((item) => item.id === compactCandidate.id),
  'Non-tight contracts must be unaffected.',
)
assert(
  !nonTightPreserved.diagnostics,
  'Non-tight contracts must not emit tight compact preservation diagnostics.',
)

const arcAssemblySource = readFileSync('src/domain/arc/assembleArcCandidates.ts', 'utf8')
const routeAuthoritySource = readFileSync(
  'src/app/services/routeAuthority/routeAuthorityService.ts',
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  'src/domain/artifacts/runtimeRouteArtifact.ts',
  'utf8',
)
const providerSource = readFileSync(
  'src/domain/providers/buildProviderSourceOpportunity.ts',
  'utf8',
)
const greatStopSource = readFileSync(
  'src/domain/greatStop/buildGreatStopGateResult.ts',
  'utf8',
)
assert(
  arcAssemblySource.includes('preserved_due_to_tight_compact_anchor_candidate') &&
    arcAssemblySource.includes('routeShapeContract?.movementProfile.radius') &&
    arcAssemblySource.includes("neighborhoodContinuity === 'strict'") &&
    arcAssemblySource.includes("preservePriority.includes('movement')"),
  'Top-40 preservation must be generic tight Build movement preservation logic.',
)
assert(
  !arcAssemblySource.includes('Adega') &&
    !arcAssemblySource.includes('Nirvana Soul') &&
    !arcAssemblySource.includes('Little Portugal') &&
    !arcAssemblySource.includes('Downtown'),
  'Top-40 preservation must not special-case venues or neighborhoods.',
)
assert(
  providerSource.includes('maxProviderCalls') || providerSource.includes('DEFAULT_NEARBY_RADIUS_M'),
  'Provider source file should remain the existing provider envelope implementation.',
)
assert(
  greatStopSource.includes('maxComfortableTotalMovementMinutes: 24') &&
    greatStopSource.includes("driveLikeMovement: 'limited'"),
  'Great Stop thresholds must remain unchanged.',
)
assert(
  routeAuthoritySource.includes('provider_shadow_not_authority') &&
    !routeAuthoritySource.includes('compactCandidatesPreservedIntoTop40Count'),
  'routeAuthority must remain unchanged.',
)
assert(
  runtimeRouteArtifactSource.includes('export interface RuntimeRouteArtifact') &&
    !runtimeRouteArtifactSource.includes('compactCandidatesPreservedIntoTop40Count'),
  'RuntimeRouteArtifact shape must remain unchanged.',
)
assert(fetchCallCount === 0, 'No fetch calls should occur in top-40 preservation test.')

console.log(
  JSON.stringify(
    {
      compactAnchorPreservingCandidatePreservedIntoTop40: true,
      top40CapUnchanged: preserved.candidates.length === 40,
      requiredAnchorPreserved: true,
      broadFallbackRemainsAvailable: true,
      preservationDeterministic: true,
      nonTightContractsUnaffected: true,
      compactCandidatesPreservedIntoTop40Count:
        preserved.diagnostics?.compactCandidatesPreservedIntoTop40Count,
      placeRightCandidatesPreservedIntoTop40Count:
        preserved.diagnostics?.placeRightCandidatesPreservedIntoTop40Count,
      preservedCompactCandidateIds: preserved.diagnostics?.preservedCompactCandidateIds,
      replacedCandidateCount: preserved.diagnostics?.replacedCandidateCount,
      candidatePreservationReason: preserved.diagnostics?.candidatePreservationReason,
      providerCallEnvelopeChanged: false,
      greatStopThresholdsUnchanged: true,
      greatStopBehaviorUnchangedExceptCandidateAvailability: true,
      routeAuthorityUnchanged: true,
      runtimeRouteArtifactShapeUnchanged: true,
      providerShadowRemainsNonAuthoritative: true,
      fetchCallCount,
    },
    null,
    2,
  ),
)
