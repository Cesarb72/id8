import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildContractGateWorldFromCanonical } from '../src/domain/bearings/buildContractGateWorld.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import {
  buildStopTypeCandidateBoardFromContract,
  buildStopTypeCandidateBoardFromIntent,
  type StopTypeCandidateBoard,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import { CLOSED_PREVIEW_LIVE_ENVELOPE } from '../src/domain/retrieval/liveEnvelope.ts'
import { buildDistrictOpportunityProfiles } from '../src/engines/district/index.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function boardSignature(board: StopTypeCandidateBoard): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(board.candidatesByStopType).map(([stopType, candidates]) => [
      stopType,
      candidates.slice(0, 5).map((candidate) => candidate.venueId),
    ]),
  )
}

async function main(): Promise<void> {
  globalThis.fetch = (async () => {
    fetchCallCount += 1
    throw new Error('Field / Discovery contract threading test must not call fetch.')
  }) as typeof fetch

  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'curate',
    persona: 'romantic',
    primaryVibe: 'lively',
    city: 'San Jose',
    objectiveOccasion: 'connect',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-field-discovery-contract-threading',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    ranked: districtPreview.ranked,
    canonicalInterpretationBundle,
    source: 'scripts.test-field-discovery-contract-threading.contractGateWorld',
  })

  const rawBoard = await buildStopTypeCandidateBoardFromIntent({
    city: 'San Jose',
    mode: 'curate',
    persona: 'romantic',
    vibe: 'lively',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  const contractBoard = await buildStopTypeCandidateBoardFromContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    contractGateWorld,
    locationQuery: 'San Jose',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })

  assert(rawBoard, 'Raw compatibility candidate board should build.')
  assert(contractBoard, 'Canonical Field / Discovery contract candidate board should build.')
  assert(
    contractBoard.scenarioFamily === rawBoard.scenarioFamily,
    'Canonical contract path should preserve the Curate candidate-board scenario family.',
  )
  assert(
    JSON.stringify(contractBoard.requiredStopTypes) === JSON.stringify(rawBoard.requiredStopTypes),
    'Canonical contract path should preserve required stop-type shape.',
  )
  assert(
    JSON.stringify(boardSignature(contractBoard)) === JSON.stringify(boardSignature(rawBoard)),
    'Canonical contract path should produce the same Curate candidate board as compatibility input.',
  )

  const diagnostic = contractBoard.debug?.fieldDiscoveryContract
  assert(diagnostic?.inputSource === 'canonical_contract', 'Candidate board must report canonical contract input.')
  assert(
    diagnostic.compatibilityIntentProjected,
    'Candidate board should project IntentProfile only as retrieval/scoring compatibility.',
  )
  assert(
    diagnostic.scenarioFamilySource === 'canonical_interpretation_bundle',
    'Candidate-board meaning should come from canonical Interpretation semantics.',
  )
  assert(
    diagnostic.contractGateWorldPresent && diagnostic.admittedBoundCount === contractGateWorld.admittedPockets.length,
    'Candidate board should carry ContractGateWorld admitted bounds.',
  )
  assert(
    diagnostic.districtIntelligenceOwnership === 'field_geo_pocket_projection',
    'Pocket formation and geo assignment must remain Field-owned.',
  )
  assert(
    diagnostic.interpretationOwnership === 'canonical_interpretation_bundle',
    'District/candidate meaning must remain Interpretation-owned.',
  )
  assert(
    districtPreview.rawPockets.length > 0 &&
      districtPreview.identifiedPockets.length > 0 &&
      districtPreview.ranked.length > 0,
    'Field-owned pocket formation should remain active.',
  )
  assert(
    contractBoard.debug?.districtIntelligence &&
      contractBoard.debug.districtIntelligence.profileCount > 0,
    'Candidate-board District Intelligence should continue to project Field geo pockets.',
  )
  assert(fetchCallCount === 0, `Expected zero fetch/provider calls, received ${fetchCallCount}.`)

  console.info('PASS Field / Discovery contract threading focused test')
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
  })
