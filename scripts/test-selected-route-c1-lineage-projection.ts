import assert from 'node:assert/strict'

import {
  buildCompositionEvidenceLineageFromGeneration,
  cloneCompositionEvidenceLineage,
  validateCompositionEvidenceLineageForFinalRoute,
  type CompositionEvidenceLineage,
} from '../src/domain/artifacts/compositionEvidenceLineage.ts'
import { buildLockInputFromRouteAuthoritySnapshot, buildRouteAuthoritySnapshot } from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { selectWaypointC1ApprovalCandidates } from '../src/domain/waypoint/selectWaypointC1ApprovalCandidates.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc.ts'
import type { GenerationDiagnostics } from '../src/domain/types/diagnostics.ts'
import type { GreatStopGateResult, GreatStopGateSelectionDiagnostics } from '../src/domain/types/greatStopGate.ts'
import type { RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary } from '../src/domain/types/itinerary.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'

const originalFetch = globalThis.fetch
let providerCalls = 0
globalThis.fetch = (async (input) => {
  providerCalls += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  throw new Error(`selected-route C1 lineage proof must not call providers: ${url}`)
}) as typeof fetch

const routeShapeContract = {
  id: 'route-shape-contract-selected-lineage-proof',
  interpretationC1Projection: {
    projectionId: 'c1-projection-selected-lineage-proof',
    selectedDirectionId: 'direction-selected-lineage-proof',
    selectedPocketId: 'pocket-selected-lineage-proof',
  },
} as RouteShapeContract

function requirement(minimumStatus: 'pass' | 'soft') {
  return { minimumStatus }
}

function stamp(status: 'pass' | 'soft' | 'fail' | 'unavailable') {
  return {
    source: 'taste.experience_composition.v0_1',
    status,
    requirementSource: 'route_shape_contract',
    routeShapeContractId: routeShapeContract.id,
    score: status === 'pass' ? 0.91 : 0.51,
    startContribution: { status, requirement: requirement('pass') },
    highlightContribution: { status, requirement: requirement('pass') },
    windDownContribution: { status, requirement: requirement('pass') },
    startPreparesHighlight: { status },
    windDownResolvesHighlight: { status },
    reasons: status === 'soft' ? ['soft_selected_candidate'] : [],
    unavailableEvidence: [],
  }
}

function scoredVenue(baseVenueId: string, name: string) {
  return {
    venue: { id: baseVenueId, name },
    candidateIdentity: {
      candidateId: baseVenueId,
      baseVenueId,
      kind: 'base',
      traceLabel: name,
    },
  }
}

function routeStops(prefix: string): ArcStop[] {
  return [
    { role: 'warmup', scoredVenue: scoredVenue(`${prefix}-start`, `${prefix} Start`) },
    { role: 'peak', scoredVenue: scoredVenue(`${prefix}-highlight`, `${prefix} Highlight`) },
    { role: 'cooldown', scoredVenue: scoredVenue(`${prefix}-wind-down`, `${prefix} Wind Down`) },
  ] as ArcStop[]
}

function candidate(id: string, status: 'pass' | 'soft'): ArcCandidate {
  return {
    id,
    stops: routeStops(id),
    totalScore: status === 'pass' ? 0.94 : 0.72,
    scoreBreakdown: {
      experienceCompositionStamp: stamp(status),
    },
  } as ArcCandidate
}

const eligibleSelected = candidate('eligible-selected', 'pass')
const ineligibleAlternate = candidate('ineligible-alternate', 'soft')
const ineligibleSelected = candidate('ineligible-selected', 'soft')

function greatStopGateResult(): GreatStopGateResult {
  return {
    status: 'PASS',
    criteria: {
      placeRight: { passed: true, reasons: [] },
    },
    failedCriteria: [],
    reasons: [],
  } as unknown as GreatStopGateResult
}

function diagnostics(waypointC1Approval: GreatStopGateSelectionDiagnostics['waypointC1Approval']): GenerationDiagnostics {
  return {
    greatStopGateResult: greatStopGateResult(),
    greatStopGateSelectionDiagnostics: {
      status: 'PASS',
      stage: 'pre_selection_gate',
      selectedCandidateId: waypointC1Approval?.selectedCandidateId,
      selectedCandidateRank: waypointC1Approval?.selectedCandidateRank,
      evaluatedCandidateCount: waypointC1Approval?.evaluatedCandidateCount ?? 0,
      failureReasons: [],
      waypointC1Approval,
    },
  } as unknown as GenerationDiagnostics
}

function lineageFor(
  selectedCandidate: ArcCandidate,
  waypointC1Approval: GreatStopGateSelectionDiagnostics['waypointC1Approval'],
): CompositionEvidenceLineage {
  const lineage = buildCompositionEvidenceLineageFromGeneration({
    selectedArc: selectedCandidate,
    diagnostics: diagnostics(waypointC1Approval),
    routeShapeContract,
    approvedAt: 1,
  })
  assert(lineage, 'CompositionEvidenceLineage must build.')
  return lineage
}

function runtimeRouteFor(candidateId: string): RuntimeRouteArtifact {
  return {
    routeId: `runtime-${candidateId}`,
    selectedDirectionId: 'direction-selected-lineage-proof',
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'lively',
    stops: [
      routeStop('start', 0, `${candidateId}-start`, `${candidateId} Start`),
      routeStop('highlight', 1, `${candidateId}-highlight`, `${candidateId} Highlight`),
      routeStop('windDown', 2, `${candidateId}-wind-down`, `${candidateId} Wind Down`),
    ],
    activeStopIndex: 0,
    routeHeadline: 'Selected route',
    routeSummary: 'Selected route summary',
    mapMarkers: [],
    liveNotices: [],
    updatedAt: 1,
  }
}

function routeStop(role: 'start' | 'highlight' | 'windDown', stopIndex: number, venueId: string, displayName: string) {
  return {
    id: `${role}-${venueId}`,
    sourceStopId: `${role}-${venueId}`,
    displayName,
    providerRecordId: `provider:${venueId}`,
    latitude: 37.33 + stopIndex / 100,
    longitude: -121.89 - stopIndex / 100,
    address: `${displayName}, San Jose, CA`,
    role,
    stopIndex,
    venueId,
    title: displayName,
    subtitle: displayName,
    neighborhood: 'San Jose',
    driveMinutes: 6,
    imageUrl: '',
  }
}

function itineraryFor(candidateId: string): Itinerary {
  return {
    id: `itinerary-${candidateId}`,
    city: 'San Jose',
    title: 'Selected route',
    stops: runtimeRouteFor(candidateId).stops.map((stop) => ({
      id: stop.sourceStopId,
      role: stop.role,
      title: stop.title,
      venueId: stop.venueId,
      venueName: stop.displayName,
      neighborhood: stop.neighborhood,
      latitude: stop.latitude,
      longitude: stop.longitude,
      formattedAddress: stop.address,
      driveMinutes: stop.driveMinutes,
      selectedBecause: 'Selected for proof.',
    })),
  } as Itinerary
}

function artifactFor(candidateId: string, lineage?: CompositionEvidenceLineage): ContractEntryArtifact {
  return {
    id: `contract-entry-${candidateId}`,
    sourceOpportunityId: candidateId,
    sourceMode: 'curated',
    anchorVenueId: `${candidateId}-highlight`,
    anchorRole: 'highlight',
    anchorName: `${candidateId} Highlight`,
    routeTitle: 'Selected route',
    flavorLine: 'Selected route line.',
    routeSummary: 'Selected route summary.',
    traits: [],
    storySpine: {
      start: `${candidateId} Start`,
      highlight: `${candidateId} Highlight`,
      windDown: `${candidateId} Wind Down`,
    },
    districtLine: 'San Jose',
    districtAnchorLine: 'San Jose',
    authorityLine: 'Authority 99%',
    whyChooseLine: 'Selected for proof.',
    selection: {
      directionId: 'direction-selected-lineage-proof',
      pocketId: 'pocket-selected-lineage-proof',
    },
    enrichment: {
      mode: 'surprise',
      canonicalRouteRoleCoverage: {
        start: `${candidateId} Start`,
        highlight: `${candidateId} Highlight`,
        windDown: `${candidateId} Wind Down`,
        support: [
          { role: 'start', name: `${candidateId} Start`, venueId: `${candidateId}-start` },
          { role: 'highlight', name: `${candidateId} Highlight`, venueId: `${candidateId}-highlight` },
          { role: 'windDown', name: `${candidateId} Wind Down`, venueId: `${candidateId}-wind-down` },
        ],
      },
      validationStatus: 'valid',
      rejectionReasons: [],
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        rejectionReasons: [],
        greatStopStatus: 'PASS',
        selectedDirectionId: 'direction-selected-lineage-proof',
      },
      ...(lineage ? { compositionEvidenceLineage: lineage } : {}),
    },
  }
}

function routeAuthorityStatus(candidateId: string, lineage?: CompositionEvidenceLineage) {
  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifactFor(candidateId, lineage),
    runtimeRouteArtifact: runtimeRouteFor(candidateId),
    selectedDirectionId: 'direction-selected-lineage-proof',
    selectedArtifactId: `contract-entry-${candidateId}`,
    selectedClusterConfirmation: 'Selected route proof.',
    itinerary: itineraryFor(candidateId),
  })
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
    requireCompositionEvidenceLineage: true,
  })
  return { snapshot, lockInput }
}

try {
  const pool = [eligibleSelected, ineligibleAlternate]
  const selected = selectWaypointC1ApprovalCandidates({
    candidates: pool,
    routeShapeContract,
  })

  assert.deepEqual(
    pool.map((item) => item.id),
    ['eligible-selected', 'ineligible-alternate'],
    'Candidate input order must not change.',
  )
  assert.deepEqual(
    selected.candidates.map((item) => item.id),
    ['eligible-selected'],
    'Waypoint selected-candidate choice must remain unchanged.',
  )
  assert(
    selected.diagnostics.failureReasons.includes('c1_soft_not_authorized'),
    'Pool diagnostics must retain aggregate C1 ineligibility.',
  )

  const eligibleLineage = lineageFor(eligibleSelected, selected.diagnostics)
  assert.equal(eligibleLineage.approvedCandidateId, 'eligible-selected')
  assert.deepEqual(eligibleLineage.waypoint.failureReasons, [])
  assert.deepEqual(eligibleLineage.approvedRouteIdentity, {
    start: 'eligible-selected-start',
    highlight: 'eligible-selected-highlight',
    windDown: 'eligible-selected-wind-down',
  })
  assert.equal(
    validateCompositionEvidenceLineageForFinalRoute({
      lineage: eligibleLineage,
      finalRoute: runtimeRouteFor('eligible-selected'),
      selectedDirectionId: 'direction-selected-lineage-proof',
    }).ok,
    true,
    'Eligible selected-route lineage must validate.',
  )
  assert.equal(
    routeAuthorityStatus('eligible-selected', eligibleLineage).snapshot.validationStatus,
    'valid',
    'Eligible selected-route lineage must produce valid routeAuthority.',
  )

  const ineligibleSelection = selectWaypointC1ApprovalCandidates({
    candidates: [ineligibleSelected, eligibleSelected],
    routeShapeContract,
  })
  const ineligibleLineage = lineageFor(ineligibleSelected, ineligibleSelection.diagnostics)
  assert.deepEqual(ineligibleLineage.waypoint.failureReasons, ['c1_soft_not_authorized'])
  const ineligibleAuthority = routeAuthorityStatus('ineligible-selected', ineligibleLineage)
  assert.equal(ineligibleAuthority.snapshot.validationStatus, 'invalid')
  assert(ineligibleAuthority.snapshot.rejectionReasons.includes('composition_evidence_lineage_invalid'))
  assert.equal(ineligibleAuthority.lockInput.ok, false)

  const missingLineageAuthority = routeAuthorityStatus('eligible-selected')
  assert.equal(missingLineageAuthority.lockInput.ok, false)
  assert.equal(
    missingLineageAuthority.lockInput.diagnostics.rejectionReason,
    'missing_composition_evidence_lineage',
  )

  const staleLineage = cloneCompositionEvidenceLineage(eligibleLineage)
  staleLineage.approvedRouteIdentity.start = 'stale-start'
  staleLineage.approvedRouteIdentitySignature = 'start:stale-start|highlight:eligible-selected-highlight|windDown:eligible-selected-wind-down'
  const staleAuthority = routeAuthorityStatus('eligible-selected', staleLineage)
  assert.equal(staleAuthority.snapshot.validationStatus, 'invalid')
  assert(staleAuthority.snapshot.rejectionReasons.includes('composition_evidence_lineage_invalid'))

  const malformedLineage = cloneCompositionEvidenceLineage(eligibleLineage)
  malformedLineage.schemaVersion = 'malformed' as CompositionEvidenceLineage['schemaVersion']
  const malformedValidation = validateCompositionEvidenceLineageForFinalRoute({
    lineage: malformedLineage,
    finalRoute: runtimeRouteFor('eligible-selected'),
    selectedDirectionId: 'direction-selected-lineage-proof',
  })
  assert.equal(malformedValidation.ok, false)
  assert(
    malformedValidation.reasons.includes('composition_evidence_lineage_schema_version_mismatch'),
  )

  assert.equal(providerCalls, 0, 'Provider calls must remain zero.')
  process.stdout.write('selected-route C1 lineage projection proof: passed\n')
  process.stdout.write('Provider calls: 0\n')
} finally {
  globalThis.fetch = originalFetch
}
