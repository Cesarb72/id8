import { curatedVenues } from '../src/data/venues'
import { loadFieldSourceVenues } from '../src/domain/field/loadFieldSourceVenues'
import { haversineDistanceM } from '../src/domain/shared/geo/geoDistance'
import type { QualityGateStatus } from '../src/domain/types/normalization'
import type { Venue, VenueCategory } from '../src/domain/types/venue'
import { admitDistrictEntities } from '../src/engines/district/entities/admitDistrictEntities'
import type { DistrictAdmissionStatus, PlaceEntity } from '../src/engines/district/types/districtTypes'

type RoleCounts = {
  start: number
  highlight: number
  windDown: number
  support: number
}

type FunnelStage = {
  stage: string
  countIn: number
  countOut: number
  roleCounts?: RoleCounts
  droppedOrBlockedReason: string
  notes: string
}

const CAFE_EDEN_REPLAY_CENTER = { lat: 37.3382, lng: -121.8863 }
const CAFE_EDEN_REPLAY_RADIUS_M = 900

let fieldProxyHits = 0
let browserProviderHits = 0
let lceProviderHits = 0
let unexpectedFetchHits = 0

const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  const url = String(input)
  if (url.includes('/api/field/text-search')) {
    fieldProxyHits += 1
    throw new Error('Thin-world replay must not call /api/field/text-search.')
  }
  if (url.includes('places.googleapis.com')) {
    browserProviderHits += 1
    throw new Error('Thin-world replay must not call a live provider.')
  }
  if (url.includes('/api/nearby') || url.includes('waypoint_nearby')) {
    lceProviderHits += 1
    throw new Error('Thin-world replay must not call LCE/Waypoint nearby provider paths.')
  }
  unexpectedFetchHits += 1
  throw new Error(`Unexpected fetch during thin-world replay: ${url}`)
}) as typeof fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function countByAdmissionStatus(
  entries: Array<{ admissionStatus: Exclude<DistrictAdmissionStatus, 'admitted'> }>,
): Partial<Record<Exclude<DistrictAdmissionStatus, 'admitted'>, number>> {
  return entries.reduce<Partial<Record<Exclude<DistrictAdmissionStatus, 'admitted'>, number>>>(
    (counts, entry) => {
      counts[entry.admissionStatus] = (counts[entry.admissionStatus] ?? 0) + 1
      return counts
    },
    {},
  )
}

function roleMembership(venue: Venue): {
  highlight: boolean
  start: boolean
  windDown: boolean
  support: boolean
} {
  const start =
    venue.roleAffinity.warmup >= 0.6 &&
    venue.energyLevel <= 4 &&
    venue.source.qualityGateStatus === 'approved' &&
    !venue.source.hoursSuppressionApplied
  const highlight =
    venue.highlightCapable &&
    venue.roleAffinity.peak >= 0.7 &&
    venue.source.qualityGateStatus === 'approved' &&
    !venue.source.hoursSuppressionApplied
  const windDown =
    venue.roleAffinity.cooldown >= 0.58 &&
    venue.energyLevel <= 4 &&
    venue.source.qualityGateStatus === 'approved' &&
    !venue.source.hoursSuppressionApplied
  const support =
    venue.source.qualityGateStatus === 'approved' &&
    !venue.source.hoursSuppressionApplied &&
    !start &&
    !highlight &&
    !windDown
  return {
    highlight,
    start,
    support,
    windDown,
  }
}

function deriveRoleCounts(venues: Venue[]): RoleCounts {
  return venues.reduce<RoleCounts>(
    (counts, venue) => {
      const roles = roleMembership(venue)
      if (roles.start) {
        counts.start += 1
      }
      if (roles.highlight) {
        counts.highlight += 1
      }
      if (roles.windDown) {
        counts.windDown += 1
      }
      if (roles.support) {
        counts.support += 1
      }
      return counts
    },
    { highlight: 0, start: 0, support: 0, windDown: 0 },
  )
}

function buildReplayVenue(input: {
  category: VenueCategory
  completenessScore?: number
  energyLevel: number
  highlightCapable: boolean
  latitude?: number
  longitude?: number
  name: string
  providerRecordId: string
  qualityGateStatus: QualityGateStatus
  roleAffinity: Venue['roleAffinity']
  sourceConfidence?: number
}): Venue {
  const base = curatedVenues[0]
  assert(base, 'Expected curated venue fixture base.')
  const hasCoordinates =
    typeof input.latitude === 'number' && typeof input.longitude === 'number'
  return {
    ...base,
    id: `live_google_${input.providerRecordId}`,
    name: input.name,
    city: 'San Jose',
    neighborhood: 'Cafe Eden Replay Pocket',
    category: input.category,
    subcategory: input.category,
    tags: [input.category, 'synthetic-thin-world-replay'],
    useCases: ['romantic', 'socialite'],
    vibeTags: ['cozy', 'chill'],
    energyLevel: input.energyLevel,
    highlightCapable: input.highlightCapable,
    roleAffinity: input.roleAffinity,
    isActive: true,
    source: {
      ...base.source,
      normalizedFromRawType: 'raw-place',
      sourceOrigin: 'live',
      provider: 'google-places',
      providerRecordId: input.providerRecordId,
      sourceQueryLabel: 'synthetic-cafe-eden-replay',
      sourceConfidence: input.sourceConfidence ?? 0.86,
      completenessScore: input.completenessScore ?? 0.82,
      qualityScore: input.qualityGateStatus === 'approved' ? 0.78 : 0.58,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      businessStatus: 'OPERATIONAL',
      timeConfidence: 0.9,
      hoursPressureLevel: 'low',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: [input.category, 'point_of_interest', 'establishment'],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus: input.qualityGateStatus,
      qualityGateNotes:
        input.qualityGateStatus === 'approved'
          ? ['Synthetic replay record approved for funnel tracing.']
          : ['Synthetic replay record demoted before role derivation.'],
      approvalBlockers: [],
      demotionReasons:
        input.qualityGateStatus === 'demoted'
          ? ['synthetic_role_derivation_pressure']
          : [],
      suppressionReasons: [],
      ...(hasCoordinates
        ? {
            latitude: input.latitude,
            longitude: input.longitude,
          }
        : {}),
    },
  }
}

function buildCafeEdenLikeReplaySourcePacket(): Venue[] {
  return [
    buildReplayVenue({
      category: 'cafe',
      energyLevel: 2,
      highlightCapable: false,
      latitude: 37.33825,
      longitude: -121.88635,
      name: 'Cafe Eden Replay Opener',
      providerRecordId: 'cafe_eden_replay_opener',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.18, peak: 0.12, warmup: 0.88, wildcard: 0.24 },
    }),
    buildReplayVenue({
      category: 'restaurant',
      energyLevel: 3,
      highlightCapable: false,
      latitude: 37.33831,
      longitude: -121.8862,
      name: 'Cafe Eden Replay Demoted Dinner',
      providerRecordId: 'cafe_eden_replay_demoted_dinner',
      qualityGateStatus: 'demoted',
      roleAffinity: { cooldown: 0.28, peak: 0.34, warmup: 0.42, wildcard: 0.36 },
    }),
    buildReplayVenue({
      category: 'bar',
      energyLevel: 5,
      highlightCapable: false,
      latitude: 37.3384,
      longitude: -121.8861,
      name: 'Cafe Eden Replay Demoted Lounge',
      providerRecordId: 'cafe_eden_replay_demoted_lounge',
      qualityGateStatus: 'demoted',
      roleAffinity: { cooldown: 0.31, peak: 0.46, warmup: 0.24, wildcard: 0.39 },
    }),
    buildReplayVenue({
      category: 'dessert',
      energyLevel: 3,
      highlightCapable: false,
      latitude: 37.3381,
      longitude: -121.88645,
      name: 'Cafe Eden Replay Demoted Dessert',
      providerRecordId: 'cafe_eden_replay_demoted_dessert',
      qualityGateStatus: 'demoted',
      roleAffinity: { cooldown: 0.52, peak: 0.18, warmup: 0.38, wildcard: 0.28 },
    }),
    buildReplayVenue({
      category: 'activity',
      energyLevel: 3,
      highlightCapable: false,
      name: 'Cafe Eden Replay Missing Coordinates',
      providerRecordId: 'cafe_eden_replay_missing_coordinates',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.4, peak: 0.62, warmup: 0.48, wildcard: 0.44 },
    }),
    buildReplayVenue({
      category: 'restaurant',
      energyLevel: 3,
      highlightCapable: true,
      latitude: 37.33815,
      longitude: -121.88628,
      name: 'Cafe Eden Replay Low Confidence Highlight',
      providerRecordId: 'cafe_eden_replay_low_confidence',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.28, peak: 0.86, warmup: 0.4, wildcard: 0.42 },
      sourceConfidence: 0.41,
    }),
  ]
}

function uniqueById(entities: PlaceEntity[]): PlaceEntity[] {
  const seen = new Set<string>()
  const deduped: PlaceEntity[] = []
  for (const entity of entities) {
    if (seen.has(entity.id)) {
      continue
    }
    seen.add(entity.id)
    deduped.push(entity)
  }
  return deduped
}

function traceReplay(sourceVenues: Venue[]): {
  admittedVenueIds: string[]
  blockedStatusCounts: Partial<Record<Exclude<DistrictAdmissionStatus, 'admitted'>, number>>
  firstCollapseStage: string
  nearestFallbackUsed: boolean
  roleCounts: RoleCounts
  stages: FunnelStage[]
  staticFallbackUsed: boolean
} {
  const admission = admitDistrictEntities(sourceVenues)
  const admittedEntities = uniqueById(admission.admitted.map((entry) => entry.entity))
  const admittedVenueIds = new Set(admission.admitted.map((entry) => entry.lineage.venueId))
  const radiusSurvivors = admittedEntities.filter(
    (entity) =>
      haversineDistanceM(entity.location, CAFE_EDEN_REPLAY_CENTER) <= CAFE_EDEN_REPLAY_RADIUS_M,
  )
  const nearestFallbackUsed = radiusSurvivors.length < 3
  const selectedEntities = nearestFallbackUsed ? admittedEntities : radiusSurvivors
  const selectedEntityIds = new Set(selectedEntities.map((entity) => entity.id))
  const selectedVenues = sourceVenues.filter((venue) => selectedEntityIds.has(venue.id))
  const roleCounts = deriveRoleCounts(selectedVenues)
  const staticFallbackUsed =
    roleCounts.start === 0 || roleCounts.highlight === 0 || roleCounts.windDown === 0

  const stages: FunnelStage[] = [
    {
      stage: 'source load',
      countIn: 0,
      countOut: sourceVenues.length,
      droppedOrBlockedReason: 'none',
      notes: 'Synthetic representative source packet; historical Cafe Eden artifact is absent locally.',
    },
    {
      stage: 'identity / coordinate / confidence gates',
      countIn: sourceVenues.length,
      countOut: admission.admitted.length,
      droppedOrBlockedReason: JSON.stringify(countByAdmissionStatus(admission.blocked)),
      notes: 'Current District live admission gates applied via admitDistrictEntities.',
    },
    {
      stage: 'radius / distance filtering',
      countIn: admittedEntities.length,
      countOut: radiusSurvivors.length,
      droppedOrBlockedReason:
        radiusSurvivors.length === admittedEntities.length ? 'none' : 'outside_radius',
      notes: `${CAFE_EDEN_REPLAY_RADIUS_M}m replay radius around downtown San Jose center.`,
    },
    {
      stage: 'District admission',
      countIn: radiusSurvivors.length,
      countOut: selectedEntities.length,
      droppedOrBlockedReason: nearestFallbackUsed ? 'nearest_fallback_expanded_selection' : 'none',
      notes: 'Mirrors fetchPlaceEntities selected/admitted compatibility projection.',
    },
    {
      stage: 'role derivation',
      countIn: selectedVenues.length,
      countOut: roleCounts.start + roleCounts.highlight + roleCounts.windDown + roleCounts.support,
      roleCounts,
      droppedOrBlockedReason: staticFallbackUsed ? 'provider_insufficient_role_diversity' : 'none',
      notes: 'Uses the current buildProviderSourceOpportunity role thresholds.',
    },
    {
      stage: 'nearest fallback',
      countIn: radiusSurvivors.length,
      countOut: selectedEntities.length,
      droppedOrBlockedReason: nearestFallbackUsed ? 'radius_survivors_below_three' : 'not_triggered',
      notes: nearestFallbackUsed
        ? 'Nearest fallback would mask radius thinness by selecting nearest admitted entities.'
        : 'Nearest fallback did not trigger because radius survivors were already >= 3.',
    },
    {
      stage: 'static fallback',
      countIn: selectedVenues.length,
      countOut: staticFallbackUsed ? 0 : selectedVenues.length,
      roleCounts,
      droppedOrBlockedReason: staticFallbackUsed ? 'provider_insufficient_role_diversity' : 'none',
      notes: staticFallbackUsed
        ? 'Static fallback masks role-diversity failure after source/admission/radius survived.'
        : 'Static fallback not required.',
    },
  ]

  return {
    admittedVenueIds: [...admittedVenueIds],
    blockedStatusCounts: countByAdmissionStatus(admission.blocked),
    firstCollapseStage: 'role derivation',
    nearestFallbackUsed,
    roleCounts,
    stages,
    staticFallbackUsed,
  }
}

async function main(): Promise<void> {
  try {
    const sanJoseSources = await loadFieldSourceVenues({ city: 'San Jose' })
    assert(sanJoseSources.sourceVenues.length === 72, 'San Jose Field source load changed.')

    const sourceVenues = buildCafeEdenLikeReplaySourcePacket()
    const replay = traceReplay(sourceVenues)

    assert(sourceVenues.length === 6, 'Replay source packet must model a reasonable source set.')
    assert(replay.admittedVenueIds.length === 4, 'Replay gates should admit four source venues.')
    assert(
      replay.blockedStatusCounts.blocked_missing_coordinates === 1 &&
        replay.blockedStatusCounts.blocked_low_confidence === 1,
      'Replay gate drops must identify coordinate and confidence losses.',
    )
    assert(!replay.nearestFallbackUsed, 'Replay should not require nearest fallback before role derivation.')
    assert(
      replay.roleCounts.start === 1 &&
        replay.roleCounts.highlight === 0 &&
        replay.roleCounts.windDown === 0 &&
        replay.roleCounts.support === 0,
      'Replay must collapse at role derivation to one start candidate and no role diversity.',
    )
    assert(replay.staticFallbackUsed, 'Replay must require static fallback after role collapse.')
    assert(fieldProxyHits === 0, 'Field proxy hit count must remain zero.')
    assert(browserProviderHits === 0, 'Browser provider hit count must remain zero.')
    assert(lceProviderHits === 0, 'LCE provider hit count must remain zero.')
    assert(unexpectedFetchHits === 0, 'No fetch calls are expected in thin-world replay.')

    process.stdout.write(
      `${JSON.stringify(
        {
          fixtureType: 'synthetic_representative',
          sourceLoadBaseline: {
            sanJoseSourceVenueCount: sanJoseSources.sourceVenues.length,
          },
          replay: {
            firstCollapseStage: replay.firstCollapseStage,
            roleCounts: replay.roleCounts,
            staticFallbackUsed: replay.staticFallbackUsed,
            stages: replay.stages,
          },
          providerSafety: {
            fieldProxyHits,
            browserProviderHits,
            lceProviderHits,
            unexpectedFetchHits,
          },
        },
        null,
        2,
      )}\n`,
    )
    process.stdout.write('field thin-world replay: passed\n')
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
