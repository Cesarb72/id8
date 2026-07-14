import { curatedVenues } from '../src/data/venues'
import { loadFieldSourceVenues } from '../src/domain/field/loadFieldSourceVenues'
import { haversineDistanceM } from '../src/domain/shared/geo/geoDistance'
import type { QualityGateStatus } from '../src/domain/types/normalization'
import type { Venue, VenueCategory } from '../src/domain/types/venue'
import { admitDistrictEntities } from '../src/engines/district/entities/admitDistrictEntities'
import type { DistrictAdmissionStatus, PlaceEntity } from '../src/engines/district/types/districtTypes'

type RoleName = 'start' | 'highlight' | 'windDown'

type RoleBuckets = Record<RoleName, Venue[]>
type RoleCounts = Record<RoleName, number>

type RoleEligibility = Record<RoleName, boolean>

type ProjectedOwnerSignal = {
  venueId: string
  field: {
    recordTruthUsable: boolean
    sourceSupplyPresent: boolean
  }
  taste: {
    highlightSuitability: number
    startSuitability: number
    windDownSuitability: number
  }
  bearings: {
    highlightFeasible: boolean
    hoursFeasible: boolean
    qualityApproved: boolean
    startFeasible: boolean
    windDownFeasible: boolean
  }
  waypoint: {
    projectedRoleEligibility: RoleEligibility
  }
}

type RoleDerivationProjection = {
  counts: RoleCounts
  honestFailureCandidate: {
    decision: 'no_provider_role_diverse_route'
    reason: 'provider_insufficient_role_diversity'
  } | null
  insufficientRoleDiversity: boolean
  ownerSignals: ProjectedOwnerSignal[]
  roleBuckets: RoleBuckets
  staticFallbackUsed: boolean
}

type CaseParitySummary = {
  caseName: string
  legacyCounts: RoleCounts
  projectedCounts: RoleCounts
  roleBucketIds: Record<RoleName, string[]>
  sidecar: {
    honestFailureCandidate: RoleDerivationProjection['honestFailureCandidate']
    insufficientRoleDiversity: boolean
    staticFallbackUsed: boolean
  }
}

const REPLAY_CENTER = { lat: 37.3382, lng: -121.8863 }
const REPLAY_RADIUS_M = 900

let fieldProxyHits = 0
let browserProviderHits = 0
let lceProviderHits = 0
let unexpectedFetchHits = 0

const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  const url = String(input)
  if (url.includes('/api/field/text-search')) {
    fieldProxyHits += 1
    throw new Error('Provider role-derivation seam observer must not call /api/field/text-search.')
  }
  if (url.includes('places.googleapis.com')) {
    browserProviderHits += 1
    throw new Error('Provider role-derivation seam observer must not call Google Places.')
  }
  if (url.includes('/api/nearby') || url.includes('waypoint_nearby')) {
    lceProviderHits += 1
    throw new Error('Provider role-derivation seam observer must not call nearby provider paths.')
  }
  unexpectedFetchHits += 1
  throw new Error(`Unexpected fetch during provider role-derivation seam observer: ${url}`)
}) as typeof fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertSameIds(actual: Venue[], expected: Venue[], message: string): void {
  const actualIds = actual.map((venue) => venue.id)
  const expectedIds = expected.map((venue) => venue.id)
  assert(
    JSON.stringify(actualIds) === JSON.stringify(expectedIds),
    `${message}: expected ${JSON.stringify(expectedIds)}, got ${JSON.stringify(actualIds)}`,
  )
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

function dedupeVenuesById(venues: Venue[]): Venue[] {
  const seen = new Set<string>()
  const deduped: Venue[] = []
  for (const venue of venues) {
    if (seen.has(venue.id)) {
      continue
    }
    seen.add(venue.id)
    deduped.push(venue)
  }
  return deduped
}

function deriveLegacyRoleBuckets(venues: Venue[]): RoleBuckets {
  return {
    start: dedupeVenuesById(
      venues.filter(
        (venue) =>
          venue.roleAffinity.warmup >= 0.6 &&
          venue.energyLevel <= 4 &&
          venue.source.qualityGateStatus === 'approved' &&
          !venue.source.hoursSuppressionApplied,
      ),
    ),
    highlight: dedupeVenuesById(
      venues.filter(
        (venue) =>
          venue.highlightCapable &&
          venue.roleAffinity.peak >= 0.7 &&
          venue.source.qualityGateStatus === 'approved' &&
          !venue.source.hoursSuppressionApplied,
      ),
    ),
    windDown: dedupeVenuesById(
      venues.filter(
        (venue) =>
          venue.roleAffinity.cooldown >= 0.58 &&
          venue.energyLevel <= 4 &&
          venue.source.qualityGateStatus === 'approved' &&
          !venue.source.hoursSuppressionApplied,
      ),
    ),
  }
}

function countRoleBuckets(roleBuckets: RoleBuckets): RoleCounts {
  return {
    start: roleBuckets.start.length,
    highlight: roleBuckets.highlight.length,
    windDown: roleBuckets.windDown.length,
  }
}

function hasInsufficientRoleDiversity(counts: RoleCounts): boolean {
  return counts.start === 0 || counts.highlight === 0 || counts.windDown === 0
}

function projectOwnerSignal(venue: Venue): ProjectedOwnerSignal {
  const qualityApproved = venue.source.qualityGateStatus === 'approved'
  const hoursFeasible = !venue.source.hoursSuppressionApplied
  const startFeasible = venue.energyLevel <= 4 && qualityApproved && hoursFeasible
  const highlightFeasible = venue.highlightCapable && qualityApproved && hoursFeasible
  const windDownFeasible = venue.energyLevel <= 4 && qualityApproved && hoursFeasible
  const projectedRoleEligibility = {
    start: venue.roleAffinity.warmup >= 0.6 && startFeasible,
    highlight: venue.roleAffinity.peak >= 0.7 && highlightFeasible,
    windDown: venue.roleAffinity.cooldown >= 0.58 && windDownFeasible,
  }

  return {
    venueId: venue.id,
    field: {
      recordTruthUsable:
        venue.isActive &&
        Boolean(venue.id.trim()) &&
        Boolean(venue.name.trim()) &&
        venue.source.qualityGateStatus !== 'suppressed',
      sourceSupplyPresent: venue.source.sourceOrigin === 'live',
    },
    taste: {
      startSuitability: venue.roleAffinity.warmup,
      highlightSuitability: venue.roleAffinity.peak,
      windDownSuitability: venue.roleAffinity.cooldown,
    },
    bearings: {
      qualityApproved,
      hoursFeasible,
      startFeasible,
      highlightFeasible,
      windDownFeasible,
    },
    waypoint: {
      projectedRoleEligibility,
    },
  }
}

function projectRoleDerivationOwnerBuckets(venues: Venue[]): RoleDerivationProjection {
  const ownerSignals = venues.map(projectOwnerSignal)
  const byVenueId = new Map(venues.map((venue) => [venue.id, venue]))
  const roleBuckets: RoleBuckets = {
    start: dedupeVenuesById(
      ownerSignals.flatMap((signal) =>
        signal.waypoint.projectedRoleEligibility.start ? [byVenueId.get(signal.venueId)] : [],
      ).filter((venue): venue is Venue => Boolean(venue)),
    ),
    highlight: dedupeVenuesById(
      ownerSignals.flatMap((signal) =>
        signal.waypoint.projectedRoleEligibility.highlight ? [byVenueId.get(signal.venueId)] : [],
      ).filter((venue): venue is Venue => Boolean(venue)),
    ),
    windDown: dedupeVenuesById(
      ownerSignals.flatMap((signal) =>
        signal.waypoint.projectedRoleEligibility.windDown ? [byVenueId.get(signal.venueId)] : [],
      ).filter((venue): venue is Venue => Boolean(venue)),
    ),
  }
  const counts = countRoleBuckets(roleBuckets)
  const insufficientRoleDiversity = hasInsufficientRoleDiversity(counts)

  return {
    counts,
    honestFailureCandidate: insufficientRoleDiversity
      ? {
          decision: 'no_provider_role_diverse_route',
          reason: 'provider_insufficient_role_diversity',
        }
      : null,
    insufficientRoleDiversity,
    ownerSignals,
    roleBuckets,
    staticFallbackUsed: insufficientRoleDiversity,
  }
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
    neighborhood: 'Provider Role Seam Replay Pocket',
    category: input.category,
    subcategory: input.category,
    tags: [input.category, 'synthetic-provider-role-seam'],
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
      sourceQueryLabel: 'synthetic-provider-role-seam',
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
          ? ['Synthetic provider role seam record approved for projection tracing.']
          : ['Synthetic provider role seam record demoted before role derivation.'],
      approvalBlockers: [],
      demotionReasons:
        input.qualityGateStatus === 'demoted'
          ? ['synthetic_provider_role_derivation_pressure']
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

function buildThinWorldReplaySourcePacket(): Venue[] {
  return [
    buildReplayVenue({
      category: 'cafe',
      energyLevel: 2,
      highlightCapable: false,
      latitude: 37.33825,
      longitude: -121.88635,
      name: 'Provider Role Seam Opener',
      providerRecordId: 'provider_role_seam_opener',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.18, peak: 0.12, warmup: 0.88, wildcard: 0.24 },
    }),
    buildReplayVenue({
      category: 'restaurant',
      energyLevel: 3,
      highlightCapable: false,
      latitude: 37.33831,
      longitude: -121.8862,
      name: 'Provider Role Seam Demoted Dinner',
      providerRecordId: 'provider_role_seam_demoted_dinner',
      qualityGateStatus: 'demoted',
      roleAffinity: { cooldown: 0.28, peak: 0.34, warmup: 0.42, wildcard: 0.36 },
    }),
    buildReplayVenue({
      category: 'bar',
      energyLevel: 5,
      highlightCapable: false,
      latitude: 37.3384,
      longitude: -121.8861,
      name: 'Provider Role Seam Demoted Lounge',
      providerRecordId: 'provider_role_seam_demoted_lounge',
      qualityGateStatus: 'demoted',
      roleAffinity: { cooldown: 0.31, peak: 0.46, warmup: 0.24, wildcard: 0.39 },
    }),
    buildReplayVenue({
      category: 'dessert',
      energyLevel: 3,
      highlightCapable: false,
      latitude: 37.3381,
      longitude: -121.88645,
      name: 'Provider Role Seam Demoted Dessert',
      providerRecordId: 'provider_role_seam_demoted_dessert',
      qualityGateStatus: 'demoted',
      roleAffinity: { cooldown: 0.52, peak: 0.18, warmup: 0.38, wildcard: 0.28 },
    }),
    buildReplayVenue({
      category: 'activity',
      energyLevel: 3,
      highlightCapable: false,
      name: 'Provider Role Seam Missing Coordinates',
      providerRecordId: 'provider_role_seam_missing_coordinates',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.4, peak: 0.62, warmup: 0.48, wildcard: 0.44 },
    }),
    buildReplayVenue({
      category: 'restaurant',
      energyLevel: 3,
      highlightCapable: true,
      latitude: 37.33815,
      longitude: -121.88628,
      name: 'Provider Role Seam Low Confidence Highlight',
      providerRecordId: 'provider_role_seam_low_confidence',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.28, peak: 0.86, warmup: 0.4, wildcard: 0.42 },
      sourceConfidence: 0.41,
    }),
  ]
}

function buildRoleDiverseSourcePacket(): Venue[] {
  return [
    buildReplayVenue({
      category: 'cafe',
      energyLevel: 2,
      highlightCapable: false,
      latitude: 37.33825,
      longitude: -121.88635,
      name: 'Provider Role Seam Role-Diverse Start',
      providerRecordId: 'provider_role_seam_diverse_start',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.18, peak: 0.22, warmup: 0.9, wildcard: 0.24 },
    }),
    buildReplayVenue({
      category: 'restaurant',
      energyLevel: 3,
      highlightCapable: true,
      latitude: 37.33831,
      longitude: -121.8862,
      name: 'Provider Role Seam Role-Diverse Highlight',
      providerRecordId: 'provider_role_seam_diverse_highlight',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.28, peak: 0.86, warmup: 0.42, wildcard: 0.36 },
    }),
    buildReplayVenue({
      category: 'dessert',
      energyLevel: 2,
      highlightCapable: false,
      latitude: 37.3381,
      longitude: -121.88645,
      name: 'Provider Role Seam Role-Diverse Wind Down',
      providerRecordId: 'provider_role_seam_diverse_wind_down',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.82, peak: 0.18, warmup: 0.38, wildcard: 0.28 },
    }),
  ]
}

function buildFallbackMaskedSourcePacket(): Venue[] {
  return [
    buildReplayVenue({
      category: 'cafe',
      energyLevel: 2,
      highlightCapable: false,
      latitude: 37.33825,
      longitude: -121.88635,
      name: 'Provider Role Seam Masked Start',
      providerRecordId: 'provider_role_seam_masked_start',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.18, peak: 0.22, warmup: 0.88, wildcard: 0.24 },
    }),
    buildReplayVenue({
      category: 'dessert',
      energyLevel: 2,
      highlightCapable: false,
      latitude: 37.3381,
      longitude: -121.88645,
      name: 'Provider Role Seam Masked Wind Down',
      providerRecordId: 'provider_role_seam_masked_wind_down',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.82, peak: 0.18, warmup: 0.38, wildcard: 0.28 },
    }),
    buildReplayVenue({
      category: 'activity',
      energyLevel: 3,
      highlightCapable: false,
      latitude: 37.3383,
      longitude: -121.8863,
      name: 'Provider Role Seam Masked Support',
      providerRecordId: 'provider_role_seam_masked_support',
      qualityGateStatus: 'approved',
      roleAffinity: { cooldown: 0.32, peak: 0.42, warmup: 0.48, wildcard: 0.44 },
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

function selectReplayVenues(sourceVenues: Venue[]): {
  blockedStatusCounts: Partial<Record<Exclude<DistrictAdmissionStatus, 'admitted'>, number>>
  nearestFallbackUsed: boolean
  selectedVenues: Venue[]
} {
  const admission = admitDistrictEntities(sourceVenues)
  const admittedEntities = uniqueById(admission.admitted.map((entry) => entry.entity))
  const radiusSurvivors = admittedEntities.filter(
    (entity) => haversineDistanceM(entity.location, REPLAY_CENTER) <= REPLAY_RADIUS_M,
  )
  const nearestFallbackUsed = radiusSurvivors.length < 3
  const selectedEntities = nearestFallbackUsed ? admittedEntities : radiusSurvivors
  const selectedEntityIds = new Set(selectedEntities.map((entity) => entity.id))
  return {
    blockedStatusCounts: countByAdmissionStatus(admission.blocked),
    nearestFallbackUsed,
    selectedVenues: sourceVenues.filter((venue) => selectedEntityIds.has(venue.id)),
  }
}

function assertProjectionParity(caseName: string, sourceVenues: Venue[]): CaseParitySummary {
  const selected = selectReplayVenues(sourceVenues)
  const legacyBuckets = deriveLegacyRoleBuckets(selected.selectedVenues)
  const legacyCounts = countRoleBuckets(legacyBuckets)
  const projected = projectRoleDerivationOwnerBuckets(selected.selectedVenues)

  assertSameIds(projected.roleBuckets.start, legacyBuckets.start, `${caseName} start bucket drift`)
  assertSameIds(
    projected.roleBuckets.highlight,
    legacyBuckets.highlight,
    `${caseName} highlight bucket drift`,
  )
  assertSameIds(
    projected.roleBuckets.windDown,
    legacyBuckets.windDown,
    `${caseName} windDown bucket drift`,
  )
  assert(
    JSON.stringify(projected.counts) === JSON.stringify(legacyCounts),
    `${caseName} count drift: expected ${JSON.stringify(legacyCounts)}, got ${JSON.stringify(
      projected.counts,
    )}`,
  )
  assert(
    projected.insufficientRoleDiversity === hasInsufficientRoleDiversity(legacyCounts),
    `${caseName} insufficient-role-diversity drift`,
  )
  assert(
    projected.staticFallbackUsed === hasInsufficientRoleDiversity(legacyCounts),
    `${caseName} static-fallback sidecar drift`,
  )
  assert(
    projected.ownerSignals.every(
      (signal) =>
        signal.field.sourceSupplyPresent &&
        signal.taste.startSuitability >= 0 &&
        signal.taste.highlightSuitability >= 0 &&
        signal.taste.windDownSuitability >= 0,
    ),
    `${caseName} owner signals must project Field supply and Taste role suitability values.`,
  )

  return {
    caseName,
    legacyCounts,
    projectedCounts: projected.counts,
    roleBucketIds: {
      start: legacyBuckets.start.map((venue) => venue.id),
      highlight: legacyBuckets.highlight.map((venue) => venue.id),
      windDown: legacyBuckets.windDown.map((venue) => venue.id),
    },
    sidecar: {
      honestFailureCandidate: projected.honestFailureCandidate,
      insufficientRoleDiversity: projected.insufficientRoleDiversity,
      staticFallbackUsed: projected.staticFallbackUsed,
    },
  }
}

async function main(): Promise<void> {
  try {
    const sanJoseSources = await loadFieldSourceVenues({ city: 'San Jose' })
    assert(sanJoseSources.sourceVenues.length === 72, 'San Jose Field source load changed.')

    const thinWorldSelection = selectReplayVenues(buildThinWorldReplaySourcePacket())
    assert(
      thinWorldSelection.blockedStatusCounts.blocked_missing_coordinates === 1 &&
        thinWorldSelection.blockedStatusCounts.blocked_low_confidence === 1,
      'Thin-world fixture must preserve Field/District coordinate and confidence losses.',
    )
    assert(
      !thinWorldSelection.nearestFallbackUsed,
      'Thin-world fixture should collapse at role derivation, not nearest fallback.',
    )

    const roleDiverse = assertProjectionParity(
      'role_diverse_provider_packet',
      buildRoleDiverseSourcePacket(),
    )
    assert(
      roleDiverse.legacyCounts.start === 1 &&
        roleDiverse.legacyCounts.highlight === 1 &&
        roleDiverse.legacyCounts.windDown === 1,
      'Role-diverse case must prove PASS-equivalent owner buckets.',
    )
    assert(
      !roleDiverse.sidecar.insufficientRoleDiversity &&
        !roleDiverse.sidecar.staticFallbackUsed &&
        roleDiverse.sidecar.honestFailureCandidate === null,
      'Role-diverse case must not project fallback sidecar failure.',
    )

    const thinWorld = assertProjectionParity(
      'thin_world_role_derivation_collapse',
      buildThinWorldReplaySourcePacket(),
    )
    assert(
      thinWorld.legacyCounts.start === 1 &&
        thinWorld.legacyCounts.highlight === 0 &&
        thinWorld.legacyCounts.windDown === 0,
      'Thin-world collapse must preserve one start and missing highlight/windDown roles.',
    )
    assert(
      thinWorld.sidecar.staticFallbackUsed &&
        thinWorld.sidecar.honestFailureCandidate?.reason ===
          'provider_insufficient_role_diversity',
      'Thin-world collapse must project provider_insufficient_role_diversity sidecar.',
    )

    const fallbackMasked = assertProjectionParity(
      'previously_masked_static_fallback',
      buildFallbackMaskedSourcePacket(),
    )
    assert(
      fallbackMasked.legacyCounts.start === 1 &&
        fallbackMasked.legacyCounts.highlight === 0 &&
        fallbackMasked.legacyCounts.windDown === 1,
      'Fallback-masked case must model start/windDown survival without highlight diversity.',
    )
    assert(
      fallbackMasked.sidecar.staticFallbackUsed &&
        fallbackMasked.sidecar.honestFailureCandidate?.decision ===
          'no_provider_role_diverse_route',
      'Fallback-masked case must project an honest no-route candidate sidecar.',
    )

    assert(fieldProxyHits === 0, 'Field proxy hit count must remain zero.')
    assert(browserProviderHits === 0, 'Browser provider hit count must remain zero.')
    assert(lceProviderHits === 0, 'LCE provider hit count must remain zero.')
    assert(unexpectedFetchHits === 0, 'No fetch calls are expected in provider role seam observer.')

    process.stdout.write(
      `${JSON.stringify(
        {
          projection: 'script_local_sidecar_only',
          sourceLoadBaseline: {
            sanJoseSourceVenueCount: sanJoseSources.sourceVenues.length,
          },
          cases: [roleDiverse, thinWorld, fallbackMasked],
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
    process.stdout.write('provider role-derivation seam projection: passed\n')
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
