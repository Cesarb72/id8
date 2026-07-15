import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'

import type { ScoredVenue } from '../src/domain/types/arc'
import type { ItineraryStop } from '../src/domain/types/itinerary'
import type {
  SteeringFeasibilityEvidence,
  SteeringMovementDeltaEvidence,
  SteeringPrelockAcceptedProposal,
  SteeringRoleFitEvidence,
} from '../src/integrations/waypoint/coordination/steeringPrelockProposal'
import {
  coordinateSteeringPrelockSwapProposals,
  projectSteeringSwapCandidateForCoordination,
  type SteeringSwapCandidateProjection,
} from '../src/integrations/waypoint/coordination/coordinateSteeringPrelockProposals'

const projectRoot = process.cwd()
const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), 'utf8')

const sandboxSource = readSource('src/pages/SandboxConciergePage.tsx')
const coordinatorSource = readSource(
  'src/integrations/waypoint/coordination/coordinateSteeringPrelockProposals.ts',
)

let fetchCallCount = 0
const originalFetch = globalThis.fetch
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in steering proposal consumption observer: ${String(args[0])}`)
}) as typeof fetch

function assertSourceContains(source: string, marker: string, label: string): void {
  assert.ok(source.includes(marker), `${label} missing marker: ${marker}`)
}

function assertSourceExcludes(source: string, marker: string, label: string): void {
  assert.ok(!source.includes(marker), `${label} should not contain marker: ${marker}`)
}

function buildStop(overrides: Partial<ItineraryStop> = {}): ItineraryStop {
  return {
    id: 'stop:highlight',
    role: 'highlight',
    title: 'Highlight',
    venueId: 'sj-current-highlight',
    venueName: 'Current Highlight',
    formattedAddress: '1 Current St, San Jose, CA',
    latitude: 37.33,
    longitude: -121.89,
    city: 'San Jose',
    category: 'bar',
    subcategory: 'wine',
    priceTier: '$$',
    tags: [],
    vibeTags: [],
    neighborhood: 'Downtown',
    driveMinutes: 10,
    durationClass: 'medium',
    estimatedDurationMinutes: 75,
    estimatedDurationLabel: 'About 75 minutes',
    subtitle: 'Downtown',
    imageUrl: '',
    stopInsider: {
      roleReason: 'Current highlight.',
      localSignal: 'Local signal.',
      selectionReason: 'Selected for fixture.',
    },
    ...overrides,
  }
}

function buildCandidate(params: {
  id: string
  baseVenueId?: string
  name: string
  roleScore: number
  driveMinutes: number
  providerRecordId?: string
}): ScoredVenue {
  const roleScores = {
    warmup: 0.5,
    peak: params.roleScore,
    wildcard: 0.5,
    cooldown: 0.5,
  }
  return {
    venue: {
      id: params.id,
      name: params.name,
      city: 'San Jose',
      neighborhood: 'Downtown',
      driveMinutes: params.driveMinutes,
      category: 'bar',
      subcategory: 'wine',
      priceTier: '$$',
      tags: [],
      useCases: [],
      vibeTags: [],
      energyLevel: 0.6,
      socialDensity: 0.6,
      uniquenessScore: 0.6,
      distinctivenessScore: 0.6,
      underexposureScore: 0.5,
      shareabilityScore: 0.5,
      isChain: false,
      localSignals: {
        localFavoriteScore: 0.5,
        neighborhoodPrideScore: 0.5,
        repeatVisitorScore: 0.5,
      },
      roleAffinity: roleScores,
      imageUrl: '',
      shortDescription: '',
      narrativeFlavor: '',
      isHiddenGem: false,
      isActive: true,
      highlightCapable: true,
      durationProfile: {} as never,
      settings: {} as never,
      signature: {} as never,
      source: {
        normalizedFromRawType: 'seed',
        sourceOrigin: 'live',
        provider: 'google-places',
        providerRecordId: params.providerRecordId,
        formattedAddress: `${params.name}, San Jose, CA`,
        latitude: 37.331,
        longitude: -121.891,
        sourceConfidence: 0.9,
        completenessScore: 0.9,
        qualityScore: 0.9,
        hoursKnown: true,
        likelyOpenForCurrentWindow: true,
        businessStatus: 'OPERATIONAL',
        timeConfidence: 0.9,
        hoursPressureLevel: 'low',
        hoursPressureNotes: [],
        hoursDemotionApplied: false,
        hoursSuppressionApplied: false,
        sourceTypes: [],
        missingFields: [],
        inferredFields: [],
        qualityGateStatus: 'approved',
        qualityGateNotes: [],
        approvalBlockers: [],
        demotionReasons: [],
        suppressionReasons: [],
      },
    },
    candidateIdentity: {
      candidateId: `candidate:${params.id}`,
      baseVenueId: params.baseVenueId ?? params.id,
      kind: 'base',
      traceLabel: params.name,
    },
    momentIdentity: { type: 'anchor', strength: 'strong' },
    fitBreakdown: {} as never,
    fitScore: params.roleScore,
    hiddenGemScore: 0.5,
    lensCompatibility: 0.7,
    contextSpecificity: {
      overall: 0.7,
      personaSignal: 0.7,
      vibeSignal: 0.7,
      lensSignal: 0.7,
      byRole: roleScores,
    },
    dominanceControl: {
      universalityScore: 0.2,
      flaggedUniversal: false,
      byRole: {
        warmup: 0.2,
        peak: 0.2,
        wildcard: 0.2,
        cooldown: 0.2,
      },
    },
    roleContract: {
      warmup: {} as never,
      peak: {} as never,
      wildcard: {} as never,
      cooldown: {} as never,
    },
    stopShapeFit: {
      start: 0.5,
      highlight: params.roleScore,
      surprise: 0.5,
      windDown: 0.5,
    },
    vibeAuthority: {} as never,
    highlightValidity: {} as never,
    roleScores,
    taste: {
      signals: {} as never,
      modeAlignment: {
        score: 0.7,
        penalty: 0,
        lane: 'balanced' as never,
        tier: 'primary',
        supportiveTagScore: 0,
        lanePriorityScore: 0,
      },
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: '',
      },
      rolePoolInfluence: {
        warmup: {} as never,
        peak: {} as never,
        wildcard: {} as never,
        cooldown: {} as never,
      },
    },
  }
}

function oldAppLocalScore(candidate: ScoredVenue, currentStop: ItineraryStop): number {
  const proximity = 1 / (1 + Math.abs(candidate.venue.driveMinutes - currentStop.driveMinutes))
  return candidate.roleScores.peak * 0.9 + proximity * 0.1
}

function projectedCandidate(
  currentStop: ItineraryStop,
  candidate: ScoredVenue,
): SteeringSwapCandidateProjection {
  const projection = projectSteeringSwapCandidateForCoordination({
    currentStop,
    candidate,
    targetRole: 'highlight',
    internalRole: 'peak',
  })
  assert.equal(projection.status, 'projected')
  return projection.candidate
}

function cloneWithEvidence(
  candidate: SteeringSwapCandidateProjection,
  overrides: {
    roleFit?: Partial<SteeringRoleFitEvidence<'role_suitability'>>
    feasibility?: Partial<SteeringFeasibilityEvidence<'admission'>>
    movement?: Partial<SteeringMovementDeltaEvidence>
  },
): SteeringSwapCandidateProjection {
  return {
    ...candidate,
    roleFitEvidence: [
      {
        ...candidate.roleFitEvidence[0],
        ...overrides.roleFit,
      },
    ],
    feasibility: [
      {
        ...candidate.feasibility[0],
        ...overrides.feasibility,
      },
    ],
    movementDelta: {
      ...candidate.movementDelta,
      ...overrides.movement,
    },
  }
}

try {
  assertSourceContains(
    sandboxSource,
    'coordinateSteeringPrelockSwapProposals',
    'Sandbox swap proposal consumption',
  )
  assertSourceContains(
    sandboxSource,
    'projectSteeringSwapCandidateForCoordination',
    'Sandbox identity projection consumption',
  )
  assertSourceExcludes(
    coordinatorSource,
    'scoreAnchoredRoleFit',
    'Waypoint steering proposal coordinator',
  )
  assertSourceExcludes(
    coordinatorSource,
    'SandboxConciergePage',
    'Waypoint steering proposal coordinator',
  )
  assertSourceExcludes(
    sandboxSource,
    'scoreAnchoredRoleFit(left, role) * 0.9 + leftProximity * 0.1',
    'Sandbox swap ordering path',
  )
  assertSourceExcludes(
    sandboxSource,
    'scoreAnchoredRoleFit(left, internalRole)',
    'Sandbox swap identity hydration path',
  )

  const currentStop = buildStop()
  const roleLedLonger = buildCandidate({
    id: 'sj-role-led-longer',
    name: 'Role Led Longer',
    roleScore: 0.75,
    driveMinutes: 25,
    providerRecordId: 'live_google_role_led_longer',
  })
  const movementHonestCloser = buildCandidate({
    id: 'sj-movement-honest-closer',
    name: 'Movement Honest Closer',
    roleScore: 0.7,
    driveMinutes: 5,
    providerRecordId: 'live_google_movement_honest_closer',
  })

  const oldOrder = [roleLedLonger, movementHonestCloser]
    .slice()
    .sort(
      (left, right) =>
        oldAppLocalScore(right, currentStop) - oldAppLocalScore(left, currentStop) ||
        left.venue.name.localeCompare(right.venue.name),
    )
    .map((candidate) => candidate.candidateIdentity.baseVenueId)

  const ownerEvidenceCandidates = [
    projectedCandidate(currentStop, roleLedLonger),
    projectedCandidate(currentStop, movementHonestCloser),
  ]
  const ownerEvidenceResult = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity: ownerEvidenceCandidates[0]!.currentStopIdentity,
    candidates: ownerEvidenceCandidates,
  })
  const newOrder = ownerEvidenceResult.acceptedProposals.map(
    (proposal) => proposal.candidateIdentity.baseVenueId,
  )

  assert.deepEqual(oldOrder, ['sj-role-led-longer', 'sj-movement-honest-closer'])
  assert.deepEqual(newOrder, ['sj-movement-honest-closer', 'sj-role-led-longer'])
  assert.ok(
    ownerEvidenceResult.rankingAttribution.includes('Bearings movementDelta'),
    'Ordering shift must be attributable to Bearings movementDelta.',
  )
  assert.ok(
    ownerEvidenceResult.rankingAttribution.includes('Taste role-fit evidence'),
    'Ordering must consume Taste role-fit evidence.',
  )
  assert.ok(
    ownerEvidenceResult.rankingAttribution.includes('Field identity/provenance'),
    'Ordering must consume Field identity/provenance.',
  )

  const firstProposal = ownerEvidenceResult.acceptedProposals[0] as SteeringPrelockAcceptedProposal
  assert.equal(firstProposal.candidateIdentity.baseVenueId, 'sj-movement-honest-closer')
  assert.equal(firstProposal.candidateIdentity.providerRecordId, 'live_google_movement_honest_closer')
  assert.notEqual(
    firstProposal.candidateIdentity.baseVenueId,
    firstProposal.candidateIdentity.providerRecordId,
  )
  assert.equal(firstProposal.rank.source, 'waypoint')
  assert.equal(firstProposal.roleFitEvidence[0].source, 'taste')
  assert.equal(firstProposal.feasibility[0].source, 'bearings')
  assert.equal(firstProposal.movementDelta?.source, 'bearings')
  assert.equal(firstProposal.currentStopIdentity.source, 'field')
  assert.equal(firstProposal.candidateIdentity.source, 'field')

  const missingIdentity = projectSteeringSwapCandidateForCoordination({
    currentStop,
    candidate: buildCandidate({
      id: 'live_google_adega',
      baseVenueId: 'live_google_adega',
      name: 'Provider ID As Base',
      roleScore: 0.8,
      driveMinutes: 8,
      providerRecordId: 'live_google_adega',
    }),
    targetRole: 'highlight',
    internalRole: 'peak',
  })
  assert.equal(missingIdentity.status, 'refused')
  assert.equal(missingIdentity.refusal.refusalClass, 'identity_provenance_missing')

  const weakRoleFit = cloneWithEvidence(ownerEvidenceCandidates[0]!, {
    roleFit: {
      value: 0.2,
      verdict: 'weak_fit',
    },
  })
  const weakRoleFitRefusal = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity: weakRoleFit.currentStopIdentity,
    candidates: [weakRoleFit],
  })
  assert.equal(weakRoleFitRefusal.refusalProposal?.refusalReason.refusalClass, 'role_fit_too_weak')

  const infeasible = cloneWithEvidence(ownerEvidenceCandidates[0]!, {
    feasibility: {
      value: false,
      status: 'infeasible',
    },
  })
  const infeasibleRefusal = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity: infeasible.currentStopIdentity,
    candidates: [infeasible],
  })
  assert.equal(
    infeasibleRefusal.refusalProposal?.refusalReason.refusalClass,
    'no_admissible_replacement',
  )

  const movementWorse = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity: ownerEvidenceCandidates[0]!.currentStopIdentity,
    candidates: [ownerEvidenceCandidates[0]!],
    allowMovementWorsening: false,
  })
  assert.equal(
    movementWorse.refusalProposal?.refusalReason.refusalClass,
    'movement_would_get_worse',
  )

  const empty = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity: ownerEvidenceCandidates[0]!.currentStopIdentity,
    candidates: [],
  })
  assert.equal(empty.refusalProposal?.refusalReason.refusalClass, 'no_admissible_replacement')
  assert.equal(empty.refusalProposal?.refusalReason.userFacingCapable, true)

  assert.equal(fetchCallCount, 0, 'observer made provider/network calls')

  console.log(
    JSON.stringify(
      {
        observer: 'steering_prelock_proposal_consumption',
        ordering: {
          oldOrder,
          newOrder,
          changed: oldOrder.join('|') !== newOrder.join('|'),
          attribution: ownerEvidenceResult.rankingAttribution,
        },
        identity: {
          routeLogicIdentity: firstProposal.candidateIdentity.baseVenueId,
          providerRecordId: firstProposal.candidateIdentity.providerRecordId,
          providerPromotedToIdentity: false,
        },
        refusalReasons: {
          missingIdentity: missingIdentity.refusal.refusalClass,
          weakRoleFit: weakRoleFitRefusal.refusalProposal?.refusalReason.refusalClass,
          infeasible: infeasibleRefusal.refusalProposal?.refusalReason.refusalClass,
          movementWorse: movementWorse.refusalProposal?.refusalReason.refusalClass,
          empty: empty.refusalProposal?.refusalReason.refusalClass,
        },
        boundary: {
          noScoreAnchoredRoleFitInCoordinator: true,
          noAppRawScoreInCoordinator: true,
          waypointRanksAndRefusesOnly: true,
          ownerProvenancedEvidenceOnly: true,
        },
        providerNetworkCalls: fetchCallCount,
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
