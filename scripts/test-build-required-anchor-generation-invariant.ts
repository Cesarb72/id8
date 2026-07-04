import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { IntentInput } from '../src/domain/types/intent.ts'
import type { Venue } from '../src/domain/types/venue.ts'
import { sanJoseVenues } from '../src/data/venues.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-required-anchor-generation-invariant must not call fetch.')
}) as typeof fetch

const REQUIRED_ANCHOR_ID = 'sj-haberdasher'
const REQUIRED_ROLE = 'windDown'

try {
  const requiredAnchor = sanJoseVenues.find((venue) => venue.id === REQUIRED_ANCHOR_ID)
  assert(requiredAnchor, 'Expected sj-haberdasher to exist in static venue data.')

  const buildAnchorContract = buildAnchorTruthContract({
    identity: {
      venueId: requiredAnchor.id,
      displayName: requiredAnchor.name,
      providerRecordId: requiredAnchor.source.providerRecordId,
      sourceOrigin: requiredAnchor.source.sourceOrigin,
      provider: requiredAnchor.source.provider,
      latitude: requiredAnchor.source.latitude,
      longitude: requiredAnchor.source.longitude,
    },
    role: {
      role: REQUIRED_ROLE,
      roleResolutionSource: 'explicit',
    },
  })

  const seedVenues = sanJoseVenues.map((venue): Venue => {
    if (venue.id !== REQUIRED_ANCHOR_ID) {
      return venue
    }
    return {
      ...venue,
      roleAffinity: {
        ...venue.roleAffinity,
        // Force the selected anchor below wind-down admission while keeping it
        // present in the generation inventory. This isolates the upstream gap:
        // generation can continue when the required anchor fails to survive arc assembly.
        cooldown: 0,
      },
    }
  })

  const input: IntentInput = {
    persona: 'romantic',
    primaryVibe: 'lively',
    city: 'San Jose',
    district: 'Downtown',
    distanceMode: 'nearby',
    mode: 'build',
    planningMode: 'user-led',
    anchor: {
      venueId: REQUIRED_ANCHOR_ID,
      role: REQUIRED_ROLE,
    },
    discoveryPreferences: [
      {
        venueId: REQUIRED_ANCHOR_ID,
        role: REQUIRED_ROLE,
      },
    ],
  }

  const result = await runGeneratePlan(input, {
    seedVenues,
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
  })

  const trace = result.trace as typeof result.trace & {
    anchorSurvivedToArc?: boolean
    userLedFinalRoleLockApplied?: boolean
    finalArcFilteredToAnchorRole?: boolean
    preRankingAnchorRoleLockTrace?: {
      triggered?: boolean
      lockApplied?: boolean
      preLockCandidateCount?: number
      postLockCandidateCount?: number
    }
    anchorDroppedReason?: string
    finalAnchorArcLossReason?: string
    invalidatedAnchorArcReasons?: Record<string, number>
  }
  const selectedRouteStops = result.selectedArc.stops.map((stop) => ({
    role: stop.role,
    venueId: stop.scoredVenue.venue.id,
    name: stop.scoredVenue.venue.name,
  }))
  const itineraryStops = result.itinerary.stops.map((stop) => ({
    role: stop.role,
    venueId: stop.venueId,
    name: stop.venueName,
  }))
  const requiredAnchorInSelectedRoute = selectedRouteStops.some(
    (stop) => stop.role === 'cooldown' && stop.venueId === REQUIRED_ANCHOR_ID,
  )
  const requiredAnchorInItinerary = itineraryStops.some(
    (stop) => stop.role === REQUIRED_ROLE && stop.venueId === REQUIRED_ANCHOR_ID,
  )
  const anchorPassedIntoGeneration =
    result.intentProfile.anchor?.venueId === REQUIRED_ANCHOR_ID &&
    result.intentProfile.anchor.role === REQUIRED_ROLE
  const generationFellBackToNormalCandidates =
    trace.anchorSurvivedToArc === false &&
    trace.userLedFinalRoleLockApplied === false &&
    trace.finalArcFilteredToAnchorRole === false &&
    trace.preRankingAnchorRoleLockTrace?.lockApplied === false
  const routeCanBeProducedWithoutRequiredAnchor =
    result.itinerary.stops.length > 0 &&
    result.selectedArc.stops.length > 0 &&
    !requiredAnchorInSelectedRoute &&
    !requiredAnchorInItinerary
  const postHocRepairRequired =
    buildAnchorContract.diagnostics.status === 'valid' && routeCanBeProducedWithoutRequiredAnchor

  const evidence = {
    buildAnchorTruthContractPresent: Boolean(buildAnchorContract),
    buildAnchorTruthContractStatus: buildAnchorContract.diagnostics.status,
    requiredAnchorCanonicalVenueId: buildAnchorContract.canonicalVenueId,
    requiredRole: buildAnchorContract.requiredRole,
    anchorPassedIntoGeneration,
    anchorSurvivedToArc: trace.anchorSurvivedToArc,
    userLedFinalRoleLockApplied: trace.userLedFinalRoleLockApplied,
    generationFellBackToNormalCandidates,
    routeCanBeProducedWithoutRequiredAnchor,
    postHocRepairRequired,
    selectedRouteStops,
    itineraryStops,
    anchorDroppedReason: trace.anchorDroppedReason,
    finalAnchorArcLossReason: trace.finalAnchorArcLossReason,
    invalidatedAnchorArcReasons: trace.invalidatedAnchorArcReasons,
    preRankingAnchorRoleLockTrace: trace.preRankingAnchorRoleLockTrace,
    fetchCallCount,
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`)

  assert(
    buildAnchorContract.diagnostics.status === 'valid',
    'BuildAnchorTruthContract must be valid.',
  )
  assert(anchorPassedIntoGeneration, 'Required anchor must be passed into generation input.')
  assert(trace.anchorSurvivedToArc === true, 'Expected required anchor to survive arc assembly.')
  assert(
    trace.userLedFinalRoleLockApplied === true,
    'Expected user-led final role lock to activate.',
  )
  assert(
    !generationFellBackToNormalCandidates,
    'Expected generation not to fall back to normal boundary candidates.',
  )
  assert(
    !routeCanBeProducedWithoutRequiredAnchor,
    'Expected generation not to produce a route without the required anchor.',
  )
  assert(!postHocRepairRequired, 'Expected post-hoc repair not to be required.')
  assert(
    itineraryStops.some(
      (stop) => stop.role === REQUIRED_ROLE && stop.venueId === REQUIRED_ANCHOR_ID,
    ),
    'Expected final route to include sj-haberdasher in windDown.',
  )
  assert(
    trace.anchorDroppedReason !== 'anchor_trimmed_before_arc_assembly',
    'Expected no anchor_trimmed_before_arc_assembly after the upstream fix.',
  )
  assert(
    trace.finalAnchorArcLossReason !== 'anchor_arcs_invalidated',
    'Expected no anchor_arcs_invalidated after the upstream fix.',
  )
  assert(fetchCallCount === 0, `Expected no provider/fetch calls, received ${fetchCallCount}.`)

  process.stdout.write('Build required anchor generation invariant: PASS\n')
} finally {
  globalThis.fetch = originalFetch
}
