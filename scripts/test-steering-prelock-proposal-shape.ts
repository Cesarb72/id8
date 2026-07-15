import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'

import type {
  SteeringFeasibilityEvidence,
  SteeringMovementDeltaEvidence,
  SteeringPrelockProposal,
  SteeringProposalRank,
  SteeringRefusalReason,
  SteeringRoleFitEvidence,
  SteeringStopIdentity,
} from '../src/integrations/waypoint/coordination/steeringPrelockProposal'

const projectRoot = process.cwd()
const proposalPath = join(
  projectRoot,
  'src/integrations/waypoint/coordination/steeringPrelockProposal.ts',
)
const proposalSource = readFileSync(proposalPath, 'utf8')

const fetchCalls: string[] = []
const originalFetch = globalThis.fetch

globalThis.fetch = ((input: RequestInfo | URL, _init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  fetchCalls.push(url)
  throw new Error(`Unexpected provider/network call in steering proposal shape observer: ${url}`)
}) as typeof fetch

function assertSourceContains(marker: string, label: string): void {
  assert.ok(proposalSource.includes(marker), `${label} missing marker: ${marker}`)
}

function assertSourceExcludes(marker: string, label: string): void {
  assert.ok(!proposalSource.includes(marker), `${label} must not include marker: ${marker}`)
}

try {
  assertSourceExcludes('scoreAnchoredRoleFit', 'Steering proposal module')
  assertSourceExcludes('SandboxConciergePage', 'Steering proposal module')
  assertSourceExcludes('PublicConciergePage', 'Steering proposal module')
  assertSourceExcludes('AppShell', 'Steering proposal module')
  assertSourceExcludes('scoreArcAssembly', 'Steering proposal module')
  assertSourceExcludes('isValidArcCombination', 'Steering proposal module')
  assertSourceExcludes('function ', 'Steering proposal module')
  assertSourceExcludes('=>', 'Steering proposal module')

  assertSourceContains("source: 'field'", 'Field-owned identity')
  assertSourceContains("source: 'taste'", 'Taste-owned role-fit evidence')
  assertSourceContains("source: 'bearings'", 'Bearings-owned feasibility evidence')
  assertSourceContains("source: 'waypoint'", 'Waypoint-owned rank/refusal output')
  assertSourceContains('userFacingCapable: true', 'User-facing-capable refusal reason')
  assertSourceContains('rawRoleFitScore?: never', 'Raw role-fit guardrail')
  assertSourceContains('waypointAuthoredMeaning?: never', 'Waypoint meaning guardrail')
  assertSourceContains('waypointAuthoredFeasibility?: never', 'Waypoint feasibility guardrail')
  assertSourceContains('waypointHydratedIdentity?: never', 'Waypoint identity guardrail')

  const currentStopIdentity: SteeringStopIdentity = {
    source: 'field',
    venueId: 'sj-current-peak',
    candidateId: 'current-peak-candidate',
    baseVenueId: 'sj-current-peak',
    displayName: 'Current Peak',
    providerRecordId: 'google-current-peak',
    sourceOrigin: 'curated',
    sourceProvenance: 'field:curated',
    latitude: 37.33,
    longitude: -121.89,
    formattedAddress: '1 Current St, San Jose, CA',
    neighborhood: 'SoFA',
    identityStatus: 'resolved',
  }

  const candidateIdentity: SteeringStopIdentity = {
    source: 'field',
    venueId: 'sj-better-peak',
    candidateId: 'better-peak-candidate',
    baseVenueId: 'sj-better-peak',
    displayName: 'Better Peak',
    providerRecordId: 'google-better-peak',
    sourceOrigin: 'live',
    sourceProvenance: 'field:provider',
    latitude: 37.331,
    longitude: -121.891,
    formattedAddress: '2 Better St, San Jose, CA',
    neighborhood: 'SoFA',
    identityStatus: 'resolved',
  }

  const roleFitEvidence: SteeringRoleFitEvidence<'role_suitability'> = {
    source: 'taste',
    key: 'role_suitability',
    authority: 'owner_evidence',
    value: 0.86,
    role: 'highlight',
    verdict: 'strong_fit',
    label: 'Taste role suitability',
    reason: 'Candidate is a stronger highlight fit.',
    ownerReasons: ['taste:strong_highlight_fit'],
  }

  const feasibility: SteeringFeasibilityEvidence<'admission'> = {
    source: 'bearings',
    key: 'admission',
    authority: 'owner_evidence',
    value: true,
    status: 'feasible',
    label: 'Bearings admission',
    reason: 'Candidate is admissible for the planning window.',
    ownerReasons: ['bearings:admission_pass'],
  }

  const movementDelta: SteeringMovementDeltaEvidence = {
    source: 'bearings',
    key: 'movement_delta',
    authority: 'owner_evidence',
    value: -4,
    deltaMinutes: -4,
    currentTravelMinutes: 12,
    candidateTravelMinutes: 8,
    direction: 'shorter',
    originAware: true,
    originPrecision: 'precise',
    label: 'Bearings movement delta',
    reason: 'Replacement is shorter from the captured origin.',
    ownerReasons: ['bearings:shorter_origin_aware_move'],
  }

  const rank: SteeringProposalRank = {
    source: 'waypoint',
    rank: 1,
    score: 0.91,
    tieBreakKey: 'highlight:sj-better-peak',
    rankingBasis: 'owner_evidence',
  }

  const acceptedProposal: SteeringPrelockProposal = {
    status: 'proposed',
    action: 'swap_stop',
    targetRole: 'highlight',
    currentStopIdentity,
    candidateIdentity,
    roleFitEvidence: [roleFitEvidence],
    feasibility: [feasibility],
    movementDelta,
    rank,
    provenance: {
      waypoint: {
        source: 'waypoint',
        key: 'steering_prelock_proposal',
        action: 'swap_stop',
        label: 'Waypoint proposal ranking',
      },
      ownerTrace: [
        { source: 'taste', key: roleFitEvidence.key, reason: roleFitEvidence.reason },
        { source: 'bearings', key: feasibility.key, reason: feasibility.reason },
        { source: 'field', key: 'candidate_identity', reason: 'Field identity carried.' },
      ],
    },
  }

  const refusalReason: SteeringRefusalReason = {
    source: 'waypoint',
    refusalClass: 'no_admissible_replacement',
    userFacingCapable: true,
    messageKey: 'steering.swap.no_admissible_replacement',
    ownerEvidenceNeeded: ['taste', 'bearings', 'field'],
    ownerReasons: ['bearings:no_admissible_replacement'],
  }

  const refusalProposal: SteeringPrelockProposal = {
    status: 'refused',
    action: 'swap_stop',
    targetRole: 'highlight',
    currentStopIdentity,
    refusalReason,
    provenance: {
      waypoint: {
        source: 'waypoint',
        key: 'steering_prelock_proposal',
        action: 'swap_stop',
        label: 'Waypoint refusal',
      },
      ownerTrace: [
        { source: 'taste', key: 'role_suitability', reason: 'Taste evidence was required.' },
        { source: 'bearings', key: 'admission', reason: 'Bearings found no admissible replacement.' },
        { source: 'field', key: 'candidate_identity', reason: 'Field identity would be required.' },
      ],
    },
  }

  assert.equal(acceptedProposal.action, 'swap_stop')
  assert.equal(acceptedProposal.targetRole, 'highlight')
  assert.equal(acceptedProposal.currentStopIdentity.source, 'field')
  assert.equal(acceptedProposal.candidateIdentity.source, 'field')
  assert.equal(acceptedProposal.roleFitEvidence[0].source, 'taste')
  assert.equal(acceptedProposal.feasibility[0].source, 'bearings')
  assert.equal(acceptedProposal.movementDelta?.source, 'bearings')
  assert.equal(acceptedProposal.rank.source, 'waypoint')
  assert.equal(acceptedProposal.provenance.ownerTrace.length, 3)
  assert.ok(
    acceptedProposal.provenance.ownerTrace.some((entry) => entry.source === 'taste'),
    'Proposal provenance must include Taste trace.',
  )
  assert.ok(
    acceptedProposal.provenance.ownerTrace.some((entry) => entry.source === 'bearings'),
    'Proposal provenance must include Bearings trace.',
  )
  assert.ok(
    acceptedProposal.provenance.ownerTrace.some((entry) => entry.source === 'field'),
    'Proposal provenance must include Field trace.',
  )

  assert.equal(refusalProposal.status, 'refused')
  assert.equal(refusalProposal.refusalReason.source, 'waypoint')
  assert.equal(refusalProposal.refusalReason.userFacingCapable, true)
  assert.equal(refusalProposal.refusalReason.refusalClass, 'no_admissible_replacement')
  assert.deepEqual(refusalProposal.refusalReason.ownerEvidenceNeeded, [
    'taste',
    'bearings',
    'field',
  ])

  assert.equal(fetchCalls.length, 0, 'observer made provider/network calls')

  console.log(
    JSON.stringify(
      {
        observer: 'steering_prelock_proposal_shape',
        proposalShape: {
          action: acceptedProposal.action,
          targetRole: acceptedProposal.targetRole,
          currentStopIdentityOwner: acceptedProposal.currentStopIdentity.source,
          candidateIdentityOwner: acceptedProposal.candidateIdentity.source,
          roleFitEvidenceOwner: acceptedProposal.roleFitEvidence[0].source,
          feasibilityOwner: acceptedProposal.feasibility[0].source,
          movementDeltaOwner: acceptedProposal.movementDelta?.source,
          rankOwner: acceptedProposal.rank.source,
          refusalReasonOwner: refusalProposal.refusalReason.source,
          refusalReasonUserFacingCapable: refusalProposal.refusalReason.userFacingCapable,
          ownerTraceSources: acceptedProposal.provenance.ownerTrace.map((entry) => entry.source),
        },
        boundary: {
          noScoreAnchoredRoleFitImport: true,
          noAppPageImports: true,
          noRoleFitComputationInWaypoint: true,
          noFeasibilityComputationInWaypoint: true,
          noIdentityHydrationInWaypoint: true,
          ownerEvidenceOnly: true,
          waypointRanksAndProposesOnly: true,
        },
        providerNetworkCalls: fetchCalls.length,
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
