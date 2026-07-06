import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { curatedVenues } from '../src/data/venues.ts'

type Role = 'start' | 'highlight' | 'windDown'

type Lane =
  | 'coffee_tea_cafe'
  | 'restaurant_meal'
  | 'drinks_bar_nightlife'
  | 'dessert_bakery'
  | 'culture_museum_activity'
  | 'park_outdoor'
  | 'retail_maker_studio'
  | 'family_kid_friendly'
  | 'neighborhood_walkable_support'
  | 'other'

type CellKind = 'THIN' | 'PASS'

type ArtifactCell = {
  key: string
  kind: CellKind
  label: string
  path: string
}

type RunSummary = {
  persona?: string
  locationClass?: string
  anchor?: string
  canonicalId?: string
  classification?: string
  mergedUniqueResultCount?: number
  rolePoolCounts?: Partial<Record<Role, number>>
  staticFallbackUsed?: boolean
  blockedReason?: string | null
  providerDiagnosticsSettleState?: string
  fieldTextSearchRequestCount?: number
  queryLabelsAttempted?: string[]
  generatedFinalRouteStops?: RouteStop[]
  visibleRouteCardStopsAfterContinue?: RouteStop[]
  routeAuthorityStatus?: string
  lockInputAvailable?: boolean
  generatedContractEntryArtifactPresent?: boolean
  finalRoutePresent?: boolean
  visibleCardEqualsGeneratedFinalRoute?: boolean
  finalRoutePreservedReviewLockLivePlans?: boolean
  requiredAnchorRoleCredited?: string | null
  routeAuthority?: {
    routeAuthoritySourceLabel?: string | null
    generatedCanonicalRouteHandoffComplete?: boolean
  }
}

type RouteStop = {
  stop?: string
  name?: string
  venueId?: string
  id?: string
  role?: string
}

type NetworkCapture = {
  fieldTextSearchRequests?: Array<{
    queryLabel?: string
    resultCount?: number
    cache?: string
    callConsumed?: boolean
    responseBody?: {
      results?: ProviderResult[]
    }
  }>
}

type ProviderResult = {
  displayName?: string
  primaryType?: string
  types?: string[]
  formattedAddress?: string
  location?: {
    latitude?: number
    longitude?: number
  }
}

type QualityDiagnostics = {
  rolePoolVenueIdsByRole?: Partial<Record<Role, string[]>>
  retrievedVenueIds?: string[]
  highlightShortlistIds?: string[]
  finalGeneratedRouteStopIds?: string[]
  generatedRouteScore?: {
    totalScore?: number
    scoreBreakdown?: {
      diversityScore?: number
      repeatedCategoryCount?: number
      categoryDiversityNotes?: string[]
      strongMomentPresent?: boolean
      momentQualityNote?: string
      roleEnergyNote?: string
      expressionWidth?: string
      expressionWidthReason?: string
      eliteFieldDiversified?: boolean
      eliteFieldDiversificationReason?: string
    } & Record<string, unknown>
    spatial?: {
      score?: number
      clustersVisited?: string[]
      clusterEscapeCount?: number
      sameClusterTransitionCount?: number
      notes?: string[]
    } & Record<string, unknown>
  }
  movementEvidence?: {
    spatialScore?: number
    clusters?: string[]
    clusterEscapes?: number
    sameClusterAdjacencies?: number
    notes?: string[]
  }
  evidenceVerdicts?: {
    diversityScore?: number
    repeatedCategoryCount?: number
    categoryNotes?: string[]
    strongMomentPresent?: boolean
    momentQualityNote?: string
    roleEnergyNote?: string
    expressionWidth?: string
    expressionWidthReason?: string
    eliteFieldDiversified?: boolean
    eliteFieldDiversifiedReason?: string
  }
}

type RouteArtifacts = {
  snapshots?: Array<{
    providerDiagnostics?: unknown
    qualityDiagnostics?: QualityDiagnostics
    reviewGatingDiagnostics?: unknown
    routeCards?: unknown
    routeSpineStops?: unknown
    routeSummary?: string
  }>
}

type VenueLite = {
  id: string
  name: string
  lane: Lane
  category?: string
  tags: string[]
  cluster: string
  latitude?: number
  longitude?: number
  source: 'static' | 'provider' | 'inferred'
}

type RouteCandidate = {
  stops: [VenueLite, VenueLite, VenueLite]
  lanes: Lane[]
  clusters: string[]
  laneDistinctCount: number
  clusterDistinctCount: number
  clusterTransitions: number
  movementKm: number | null
  hospitalityRepeatCount: number
  experientialCount: number
  strongMomentProxy: number
  greatStopProxyScore: number
  movementScore: number
}

const artifactCells: ArtifactCell[] = [
  {
    key: 'l2_adega',
    kind: 'THIN',
    label: 'L2 Romantic / Adega',
    path: 'tmp/phase4-runs/2026-07-05T21-14-09-032Z',
  },
  {
    key: 'l2_miniboss',
    kind: 'THIN',
    label: 'L2 Friends / MINIBOSS',
    path: 'tmp/phase4-runs/2026-07-05T21-19-11-670Z',
  },
  {
    key: 'l2_happy_hollow',
    kind: 'THIN',
    label: 'L2 Family / Happy Hollow',
    path: 'tmp/phase4-runs/2026-07-05T21-19-32-770Z',
  },
  {
    key: 'l3_village_grill',
    kind: 'THIN',
    label: 'L3 Friends / Village Grill',
    path: 'tmp/phase4-runs/2026-07-05T19-18-37-148Z',
  },
  {
    key: 'l3_evergreen',
    kind: 'PASS',
    label: 'L3 Romantic / Evergreen Coffee Company',
    path: 'tmp/phase4-runs/2026-07-04T20-42-53-291Z',
  },
  {
    key: 'l3_alum_rock',
    kind: 'PASS',
    label: 'L3 Family / Alum Rock Park',
    path: 'tmp/phase4-runs/2026-07-04T20-42-36-599Z',
  },
  {
    key: 'l1_tech',
    kind: 'PASS',
    label: 'L1 Family / The Tech Interactive',
    path: 'tmp/phase4-runs/2026-07-04T09-18-00-330Z',
  },
  {
    key: 'l1_haberdasher',
    kind: 'PASS',
    label: 'L1 Romantic / Haberdasher',
    path: 'tmp/phase4-runs/2026-07-04T04-08-29-128Z',
  },
]

const roles: Role[] = ['start', 'highlight', 'windDown']
const venueById = new Map(curatedVenues.map((venue) => [venue.id, venue]))
let fetchCallCount = 0

globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error('Network disabled for Build quality artifact replay diagnostic.')
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function readJson<T>(path: string): T {
  assert(existsSync(path), `Missing artifact file: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function lastSnapshot(artifacts: RouteArtifacts): NonNullable<RouteArtifacts['snapshots']>[number] {
  const snapshots = artifacts.snapshots ?? []
  assert(snapshots.length > 0, 'Missing route artifact snapshots')
  return snapshots[snapshots.length - 1]
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').toLowerCase()
}

function laneFromSignals(signals: string[]): Lane {
  const text = signals.map(normalizeText).join(' ')
  if (/\b(cocktail|bar|wine|beer|brew|night|lounge|speakeasy|pub|drinks?)\b/.test(text)) {
    return 'drinks_bar_nightlife'
  }
  if (/\b(dessert|bakery|bakehouse|gelato|ice cream|manju|pastry|sweet)\b/.test(text)) {
    return 'dessert_bakery'
  }
  if (/\b(coffee|tea|cafe|matcha|kissaten|espresso)\b/.test(text)) {
    return 'coffee_tea_cafe'
  }
  if (/\b(museum|activity|arcade|game|zoo|interactive|theater|theatre|gallery|music|event)\b/.test(text)) {
    return 'culture_museum_activity'
  }
  if (/\b(park|garden|outdoor|trail|promenade|picnic|plaza)\b/.test(text)) {
    return 'park_outdoor'
  }
  if (/\b(studio|maker|retail|shop|boutique|market)\b/.test(text)) {
    return 'retail_maker_studio'
  }
  if (/\b(family|kid|kids|children|zoo)\b/.test(text)) {
    return 'family_kid_friendly'
  }
  if (/\b(restaurant|meal|dinner|supper|ramen|pasta|bistro|grill|kitchen|eatery|deli)\b/.test(text)) {
    return 'restaurant_meal'
  }
  if (/\b(neighborhood|walk|walkable|local|plaza|district)\b/.test(text)) {
    return 'neighborhood_walkable_support'
  }
  return 'other'
}

function venueFromId(id: string): VenueLite {
  const venue = venueById.get(id)
  if (venue) {
    const tags = [
      venue.category,
      venue.subcategory,
      ...(venue.tags ?? []),
      ...(venue.vibeTags ?? []),
      ...(venue.sourceTypes ?? []),
      venue.name,
      venue.neighborhood,
    ].filter(Boolean) as string[]
    return {
      id,
      name: venue.name,
      lane: laneFromSignals(tags),
      category: venue.category,
      tags,
      cluster: venue.neighborhood ?? venue.city ?? 'unknown',
      latitude: venue.latitude,
      longitude: venue.longitude,
      source: 'static',
    }
  }

  const inferredName = id
    .replace(/^moment-/, '')
    .replace(/^sj-/, '')
    .replace(/-/g, ' ')
  return {
    id,
    name: inferredName,
    lane: laneFromSignals([id, inferredName]),
    tags: [id],
    cluster: inferClusterFromId(id),
    source: 'inferred',
  }
}

function venueFromProviderResult(result: ProviderResult, label: string): VenueLite {
  const name = result.displayName ?? 'unknown provider result'
  const signals = [
    name,
    result.primaryType,
    ...(result.types ?? []),
    result.formattedAddress,
  ].filter(Boolean) as string[]
  return {
    id: `provider:${label}:${name}`,
    name,
    lane: laneFromSignals(signals),
    category: result.primaryType,
    tags: signals,
    cluster: inferClusterFromAddress(result.formattedAddress),
    latitude: result.location?.latitude,
    longitude: result.location?.longitude,
    source: 'provider',
  }
}

function inferClusterFromId(id: string): string {
  if (id.includes('willow')) return 'Willow Glen'
  if (id.includes('jtown') || id.includes('japanese')) return 'Japantown'
  if (id.includes('rose') || id.includes('bramhall')) return 'Rose Garden'
  if (id.includes('evergreen') || id.includes('village-grill')) return 'Evergreen'
  if (id.includes('alum-rock')) return 'Alum Rock'
  if (id.includes('little-portugal') || id.includes('adega')) return 'Little Portugal'
  if (id.includes('tech') || id.includes('miniboss') || id.includes('haberdasher')) return 'Downtown'
  return 'unknown'
}

function inferClusterFromAddress(address: string | undefined): string {
  const text = normalizeText(address)
  if (text.includes('willow')) return 'Willow Glen'
  if (text.includes('japantown') || text.includes('jackson')) return 'Japantown'
  if (text.includes('alum rock')) return 'Alum Rock'
  if (text.includes('evergreen')) return 'Evergreen'
  if (text.includes('santa clara') || text.includes('1st') || text.includes('2nd') || text.includes('san pedro')) {
    return 'Downtown'
  }
  return 'San Jose'
}

function uniqueById(venues: VenueLite[]): VenueLite[] {
  return [...new Map(venues.map((venue) => [venue.id, venue])).values()]
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (counts, value) => ({
      ...counts,
      [value]: (counts[value] ?? 0) + 1,
    }),
    {} as Record<T, number>,
  )
}

function countLaneDistinct(venues: VenueLite[]): number {
  return new Set(venues.map((venue) => venue.lane)).size
}

function countClusterDistinct(venues: VenueLite[]): number {
  return new Set(venues.map((venue) => venue.cluster)).size
}

function isHospitalityLane(lane: Lane): boolean {
  return [
    'coffee_tea_cafe',
    'restaurant_meal',
    'drinks_bar_nightlife',
    'dessert_bakery',
  ].includes(lane)
}

function isExperientialLane(lane: Lane): boolean {
  return [
    'culture_museum_activity',
    'park_outdoor',
    'retail_maker_studio',
    'family_kid_friendly',
  ].includes(lane)
}

function routeDistanceKm(stops: VenueLite[]): number | null {
  const distances: number[] = []
  for (let index = 0; index < stops.length - 1; index += 1) {
    const a = stops[index]
    const b = stops[index + 1]
    if (
      typeof a.latitude !== 'number' ||
      typeof a.longitude !== 'number' ||
      typeof b.latitude !== 'number' ||
      typeof b.longitude !== 'number'
    ) {
      return null
    }
    distances.push(haversineKm(a.latitude, a.longitude, b.latitude, b.longitude))
  }
  return round(distances.reduce((sum, distance) => sum + distance, 0), 2)
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function round(value: number, places = 3): number {
  return Number(value.toFixed(places))
}

function routeCandidate(stops: [VenueLite, VenueLite, VenueLite], persona: string | undefined): RouteCandidate {
  const lanes = stops.map((stop) => stop.lane)
  const clusters = stops.map((stop) => stop.cluster)
  const clusterTransitions = clusters.slice(1).filter((cluster, index) => cluster !== clusters[index]).length
  const movementKm = routeDistanceKm(stops)
  const laneDistinctCount = new Set(lanes).size
  const clusterDistinctCount = new Set(clusters).size
  const hospitalityRepeatCount = Math.max(0, lanes.filter(isHospitalityLane).length - 1)
  const experientialCount = lanes.filter(isExperientialLane).length
  const strongMomentProxy = computeStrongMomentProxy(stops[1], persona)
  const movementScore =
    movementKm == null
      ? Math.max(0, 1 - clusterTransitions * 0.2)
      : Math.max(0, 1 - Math.min(movementKm, 12) / 12)
  const greatStopProxyScore =
    laneDistinctCount * 1.5 +
    strongMomentProxy * 2 +
    movementScore * 1.5 +
    experientialCount * 0.4 -
    hospitalityRepeatCount * 0.6 -
    clusterTransitions * 0.25

  return {
    stops,
    lanes,
    clusters,
    laneDistinctCount,
    clusterDistinctCount,
    clusterTransitions,
    movementKm,
    hospitalityRepeatCount,
    experientialCount,
    strongMomentProxy,
    greatStopProxyScore: round(greatStopProxyScore),
    movementScore: round(movementScore),
  }
}

function computeStrongMomentProxy(highlight: VenueLite, persona: string | undefined): number {
  const tags = [highlight.lane, highlight.category, ...highlight.tags].join(' ').toLowerCase()
  let score = 0
  if (highlight.lane === 'culture_museum_activity' || highlight.lane === 'park_outdoor') score += 1
  if (highlight.lane === 'drinks_bar_nightlife' || highlight.lane === 'restaurant_meal') score += 0.7
  if (/\b(unique|hidden|interactive|zoo|museum|arcade|tasting|garden|park|chef|flight|landmark)\b/.test(tags)) {
    score += 0.8
  }
  if (persona === 'Family' && /\b(family|kid|zoo|museum|activity|park|interactive)\b/.test(tags)) score += 0.8
  if (persona === 'Romantic' && /\b(intimate|wine|dinner|garden|tasting|quiet|elevated)\b/.test(tags)) score += 0.8
  if (persona === 'Friends' && /\b(arcade|game|grill|social|hang|dessert|coffee|lively)\b/.test(tags)) score += 0.8
  return round(Math.min(score, 2.5))
}

function routeStopToVenue(stop: RouteStop): VenueLite {
  const id = stop.venueId ?? stop.id
  if (id) {
    const venue = venueFromId(id)
    if (stop.stop || stop.name) {
      return {
        ...venue,
        name: stop.stop ?? stop.name ?? venue.name,
      }
    }
    return venue
  }
  const name = stop.stop ?? stop.name ?? 'unknown stop'
  return {
    id: `route:${name}`,
    name,
    lane: laneFromSignals([name]),
    tags: [name],
    cluster: inferClusterFromId(name.toLowerCase().replace(/\s+/g, '-')),
    source: 'inferred',
  }
}

function enumerateCandidates(
  rolePools: Partial<Record<Role, VenueLite[]>>,
  selectedRoute: VenueLite[],
  persona: string | undefined,
): RouteCandidate[] {
  const pools = {
    start: rolePools.start ?? [],
    highlight: rolePools.highlight ?? [],
    windDown: rolePools.windDown ?? [],
  }
  if (pools.start.length === 0 || pools.highlight.length === 0 || pools.windDown.length === 0) return []

  const selectedIds = new Set(selectedRoute.map((venue) => venue.id))
  const candidates: RouteCandidate[] = []
  for (const start of pools.start) {
    for (const highlight of pools.highlight) {
      for (const windDown of pools.windDown) {
        const ids = [start.id, highlight.id, windDown.id]
        if (new Set(ids).size < 3) continue
        const candidate = routeCandidate([start, highlight, windDown], persona)
        if (selectedIds.size > 0 && ids.every((id) => selectedIds.has(id))) {
          candidate.greatStopProxyScore = round(candidate.greatStopProxyScore + 0.001)
        }
        candidates.push(candidate)
      }
    }
  }
  return candidates
}

function summarizeCandidate(candidate: RouteCandidate): object {
  return {
    stops: candidate.stops.map((stop) => stop.name),
    ids: candidate.stops.map((stop) => stop.id),
    lanes: candidate.lanes,
    clusters: candidate.clusters,
    laneDistinctCount: candidate.laneDistinctCount,
    clusterTransitions: candidate.clusterTransitions,
    movementKm: candidate.movementKm,
    hospitalityRepeatCount: candidate.hospitalityRepeatCount,
    strongMomentProxy: candidate.strongMomentProxy,
    greatStopProxyScore: candidate.greatStopProxyScore,
    movementScore: candidate.movementScore,
  }
}

function topCandidates(candidates: RouteCandidate[], sorter: (candidate: RouteCandidate) => number): object[] {
  return [...candidates]
    .sort((a, b) => sorter(b) - sorter(a))
    .slice(0, 5)
    .map(summarizeCandidate)
}

function selectedRank(
  candidates: RouteCandidate[],
  selectedRoute: VenueLite[],
  sorter: (candidate: RouteCandidate) => number,
): number | null {
  const selectedIds = selectedRoute.map((venue) => venue.id).join('|')
  const sorted = [...candidates].sort((a, b) => sorter(b) - sorter(a))
  const index = sorted.findIndex((candidate) => candidate.stops.map((venue) => venue.id).join('|') === selectedIds)
  return index >= 0 ? index + 1 : null
}

function artifactProviderVenues(network: NetworkCapture): VenueLite[] {
  return uniqueById(
    (network.fieldTextSearchRequests ?? []).flatMap((request) =>
      (request.responseBody?.results ?? []).map((result) =>
        venueFromProviderResult(result, request.queryLabel ?? 'unknown'),
      ),
    ),
  )
}

function diagnoseCell(cell: ArtifactCell): object {
  const artifactDir = join(process.cwd(), cell.path)
  const runSummary = readJson<RunSummary>(join(artifactDir, 'run-summary.json'))
  const network = readJson<NetworkCapture>(join(artifactDir, 'network.json'))
  const routeArtifacts = readJson<RouteArtifacts>(join(artifactDir, 'route-artifacts.json'))
  const snapshot = lastSnapshot(routeArtifacts)
  const quality = snapshot.qualityDiagnostics ?? {}
  const rolePoolIds = quality.rolePoolVenueIdsByRole ?? {}
  const rolePools: Partial<Record<Role, VenueLite[]>> = Object.fromEntries(
    roles.map((role) => [role, uniqueById((rolePoolIds[role] ?? []).map(venueFromId))]),
  ) as Partial<Record<Role, VenueLite[]>>

  const selectedRoute = selectedRouteFromArtifacts(runSummary, quality)
  const providerVenues = artifactProviderVenues(network)
  const rolePoolVenues = uniqueById(roles.flatMap((role) => rolePools[role] ?? []))
  const reconstructedPool = uniqueById([...rolePoolVenues, ...providerVenues])
  const candidateRoutes = enumerateCandidates(rolePools, selectedRoute, runSummary.persona)
  const selectedCandidate = selectedRoute.length === 3
    ? routeCandidate(selectedRoute as [VenueLite, VenueLite, VenueLite], runSummary.persona)
    : null

  const roleDiversity = Object.fromEntries(
    roles.map((role) => {
      const venues = rolePools[role] ?? []
      const laneDistribution = countBy(venues.map((venue) => venue.lane))
      const clusterDistribution = countBy(venues.map((venue) => venue.cluster))
      return [
        role,
        {
          optionsCount: venues.length,
          laneDistinctOptions: countLaneDistinct(venues),
          clusterDistinctOptions: countClusterDistinct(venues),
          roleFitOptionsProxy: venues.filter((venue) => computeStrongMomentProxy(venue, runSummary.persona) > 0).length,
          hasAtLeast2LaneDistinctViableOptions: countLaneDistinct(venues) >= 2,
          hasAtLeast2ClusterCompatibleOptions: Object.values(clusterDistribution).some((count) => count >= 2),
          laneDistribution,
          clusterDistribution,
          sampleOptions: venues.slice(0, 8).map((venue) => ({
            id: venue.id,
            name: venue.name,
            lane: venue.lane,
            cluster: venue.cluster,
            source: venue.source,
          })),
        },
      ]
    }),
  )

  const laneDistribution = countBy(reconstructedPool.map((venue) => venue.lane))
  const hospitalityConcentration = reconstructedPool.filter((venue) => isHospitalityLane(venue.lane)).length
  const experientialOptions = reconstructedPool.filter((venue) => isExperientialLane(venue.lane)).length
  const selectedRouteSummary = selectedCandidate ? summarizeCandidate(selectedCandidate) : null
  const bestGreatStop = candidateRoutes.length > 0 ? topCandidates(candidateRoutes, (candidate) => candidate.greatStopProxyScore) : []
  const bestMovement = candidateRoutes.length > 0 ? topCandidates(candidateRoutes, (candidate) => candidate.movementScore) : []
  const bestLaneDiversity = candidateRoutes.length > 0 ? topCandidates(candidateRoutes, (candidate) => candidate.laneDistinctCount) : []

  return {
    key: cell.key,
    kind: cell.kind,
    label: cell.label,
    artifactDir: cell.path,
    status: {
      classification: runSummary.classification,
      persona: runSummary.persona,
      locationClass: runSummary.locationClass,
      anchor: runSummary.anchor,
      canonicalId: runSummary.canonicalId,
      providerDiagnosticsSettleState: runSummary.providerDiagnosticsSettleState,
      staticFallbackUsed: runSummary.staticFallbackUsed,
      blockedReason: runSummary.blockedReason,
      generatedContractEntryArtifactPresent: runSummary.generatedContractEntryArtifactPresent,
      finalRoutePresent: runSummary.finalRoutePresent,
      lockInputAvailable: runSummary.lockInputAvailable,
      routeAuthorityStatus: runSummary.routeAuthorityStatus,
      routeAuthoritySource: runSummary.routeAuthority?.routeAuthoritySourceLabel,
      generatedCanonicalRouteHandoffComplete:
        runSummary.routeAuthority?.generatedCanonicalRouteHandoffComplete,
      finalRoutePreservedReviewLockLivePlans: runSummary.finalRoutePreservedReviewLockLivePlans,
    },
    reconstruction: {
      completeness: 'partial',
      mergedUniqueResultCount: runSummary.mergedUniqueResultCount,
      providerResultVenueCount: providerVenues.length,
      staticOrInferredRolePoolVenueCount: rolePoolVenues.length,
      totalReconstructedVenueCount: reconstructedPool.length,
      missingFields: [
        'full ranked arc candidate list',
        'selected route rank from live Waypoint scoring',
        'per-candidate rejection reasons',
        'post-Field normalized live venue ids for every provider result',
        'complete scored venue objects for every role-pool entry',
      ],
    },
    poolDiversity: {
      laneDistinctVenueCount: countLaneDistinct(reconstructedPool),
      laneDistribution,
      hospitalityCoffeeDessertDrinksConcentration: hospitalityConcentration,
      activityCultureParkFamilyDistinctOptions: experientialOptions,
      anchorLaneDominatesSelectedRoute:
        selectedCandidate != null
          ? selectedCandidate.lanes.filter((lane) => lane === selectedCandidate.stops[1].lane).length > 1
          : null,
    },
    roleDiversity,
    selectedRoute: selectedRouteSummary,
    capturedQualitySignals: {
      movementEvidence: summarizeMovementEvidence(quality.movementEvidence),
      generatedRouteScore: summarizeGeneratedRouteScore(quality),
      retrievedVenueIdsCount: quality.retrievedVenueIds?.length ?? null,
      highlightShortlistIds: quality.highlightShortlistIds ?? [],
    },
    candidateEnumeration: {
      method: 'proxy enumeration from captured rolePoolVenueIdsByRole; not live Waypoint scoring',
      candidateCount: candidateRoutes.length,
      selectedRankByGreatStopProxy:
        selectedCandidate != null
          ? selectedRank(candidateRoutes, selectedRoute, (candidate) => candidate.greatStopProxyScore)
          : null,
      selectedRankByMovementProxy:
        selectedCandidate != null
          ? selectedRank(candidateRoutes, selectedRoute, (candidate) => candidate.movementScore)
          : null,
      top5ByGreatStopProxy: bestGreatStop,
      top5ByMovementCoherence: bestMovement,
      top5ByLaneDiversity: bestLaneDiversity,
      betterRouteAvailableByProxy:
        selectedCandidate != null && candidateRoutes.some(
          (candidate) => candidate.greatStopProxyScore > selectedCandidate.greatStopProxyScore + 0.25,
        ),
      betterClusterCoherentRouteAvailableByProxy:
        selectedCandidate != null && candidateRoutes.some(
          (candidate) => candidate.movementScore > selectedCandidate.movementScore + 0.15,
        ),
      betterLaneDiverseRouteAvailableByProxy:
        selectedCandidate != null && candidateRoutes.some(
          (candidate) => candidate.laneDistinctCount > selectedCandidate.laneDistinctCount,
        ),
    },
    diagnosis: classifyCell(cell.key, runSummary, quality, selectedCandidate, candidateRoutes),
  }
}

function selectedRouteFromArtifacts(runSummary: RunSummary, quality: QualityDiagnostics): VenueLite[] {
  const ids = quality.finalGeneratedRouteStopIds ?? []
  if (ids.length === 3) {
    return ids.map(venueFromId)
  }
  return (runSummary.generatedFinalRouteStops ?? []).map(routeStopToVenue)
}

function summarizeMovementEvidence(movement: QualityDiagnostics['movementEvidence']): object | null {
  if (!movement) return null
  return {
    spatialScore: movement.spatialScore ?? null,
    clusters: movement.clusters ?? null,
    clusterEscapes: movement.clusterEscapes ?? null,
    sameClusterAdjacencies: movement.sameClusterAdjacencies ?? null,
    notes: movement.notes ?? null,
    availableKeys: Object.keys(movement),
  }
}

function summarizeGeneratedRouteScore(quality: QualityDiagnostics): object | null {
  const score = quality.generatedRouteScore
  if (!score) return summarizeEvidenceVerdicts(quality.evidenceVerdicts)
  const breakdown = score.scoreBreakdown ?? {}
  const spatial = score.spatial ?? {}
  return {
    totalScore: score.totalScore ?? null,
    spatialScore: spatial.score ?? null,
    clusters: spatial.clustersVisited ?? null,
    clusterEscapes: spatial.clusterEscapeCount ?? null,
    sameClusterAdjacencies: spatial.sameClusterTransitionCount ?? null,
    movementNotes: spatial.notes ?? null,
    diversityScore: breakdown.diversityScore ?? null,
    repeatedCategoryCount: breakdown.repeatedCategoryCount ?? null,
    categoryNotes: breakdown.categoryDiversityNotes ?? null,
    strongMomentPresent: breakdown.strongMomentPresent ?? null,
    momentQualityNote: breakdown.momentQualityNote ?? null,
    roleEnergyNote: breakdown.roleEnergyNote ?? null,
    expressionWidth: breakdown.expressionWidth ?? null,
    expressionWidthReason: breakdown.expressionWidthReason ?? null,
    eliteFieldDiversified: breakdown.eliteFieldDiversified ?? null,
    eliteFieldDiversifiedReason: breakdown.eliteFieldDiversificationReason ?? null,
    scoreBreakdownKeys: Object.keys(breakdown),
  }
}

function summarizeEvidenceVerdicts(verdicts: QualityDiagnostics['evidenceVerdicts']): object | null {
  if (!verdicts) return null
  return {
    diversityScore: verdicts.diversityScore ?? null,
    repeatedCategoryCount: verdicts.repeatedCategoryCount ?? null,
    categoryNotes: verdicts.categoryNotes ?? null,
    strongMomentPresent: verdicts.strongMomentPresent ?? null,
    momentQualityNote: verdicts.momentQualityNote ?? null,
    roleEnergyNote: verdicts.roleEnergyNote ?? null,
    expressionWidth: verdicts.expressionWidth ?? null,
    expressionWidthReason: verdicts.expressionWidthReason ?? null,
    eliteFieldDiversified: verdicts.eliteFieldDiversified ?? null,
    eliteFieldDiversifiedReason: verdicts.eliteFieldDiversifiedReason ?? null,
    availableKeys: Object.keys(verdicts),
  }
}

function classifyCell(
  key: string,
  runSummary: RunSummary,
  quality: QualityDiagnostics,
  selectedCandidate: RouteCandidate | null,
  candidates: RouteCandidate[],
): object {
  const scoreBreakdown = quality.generatedRouteScore?.scoreBreakdown
  const spatial = quality.generatedRouteScore?.spatial
  const betterByGreatStop =
    selectedCandidate != null &&
    candidates.some((candidate) => candidate.greatStopProxyScore > selectedCandidate.greatStopProxyScore + 0.25)
  const lowMoment = scoreBreakdown?.strongMomentPresent === false
  const flatArc = normalizeText(scoreBreakdown?.roleEnergyNote).includes('flat')
  const movementWeak =
    typeof spatial?.clusterEscapeCount === 'number' && spatial.clusterEscapeCount >= 2
  const laneCompressed =
    (scoreBreakdown?.repeatedCategoryCount ?? 0) > 0 ||
    (scoreBreakdown?.categoryDiversityNotes ?? []).some((note) =>
      /hospitality|drinks|coffee|repeats/i.test(note),
    )

  const roots = new Set<string>()
  if (laneCompressed) roots.add('B_role_pool_or_lane_compression')
  if (movementWeak) roots.add('C_cluster_coherence_failure')
  if (betterByGreatStop) roots.add('D_waypoint_ranking_or_selection_failure_proxy')
  if (lowMoment || flatArc) roots.add('E_route_shape_contract_quality_floor_weakness')
  if (['l2_adega', 'l2_happy_hollow'].includes(key)) roots.add('F_anchor_pressure')
  roots.add('G_diagnostic_insufficiency_for_exact_root')

  const fixLocations = new Set<string>()
  if (roots.has('B_role_pool_or_lane_compression')) {
    fixLocations.add('C_provider_result_admission_or_role_pool_diversity')
    fixLocations.add('B_interpretation_lane_or_venue_family_classification')
  }
  if (roots.has('C_cluster_coherence_failure') || roots.has('D_waypoint_ranking_or_selection_failure_proxy')) {
    fixLocations.add('D_waypoint_movement_sequencing_lane_variance_scoring')
  }
  if (roots.has('E_route_shape_contract_quality_floor_weakness')) {
    fixLocations.add('E_route_shape_or_direction_contract_tuning')
  }
  fixLocations.add('F_better_artifact_diagnostics_before_product_patch')

  return {
    selectedRouteBestAvailableByProxy: !betterByGreatStop,
    rootClassification: [...roots],
    recommendedFixLocation: [...fixLocations],
  }
}

const diagnostics = artifactCells.map(diagnoseCell)

const output = {
  test: 'Build quality THIN route artifact replay diagnostic',
  mode: 'no-network artifact replay',
  fetchCallCount,
  artifactsInspected: artifactCells.map((cell) => cell.path),
  reconstructionNote:
    'Candidate pool reconstruction is partial. The artifacts include role pools, provider response metadata, final routes, and quality verdicts, but not full ranked Waypoint arc alternatives or per-candidate rejection reasons.',
  thinCells: diagnostics.filter((cell) => (cell as { kind: CellKind }).kind === 'THIN'),
  passComparisonCells: diagnostics.filter((cell) => (cell as { kind: CellKind }).kind === 'PASS'),
  patternLevelClassification: {
    authorityProviderCopyTruthStatus: 'closed_green',
    buildMvpGreatStopQualityStatus: 'open_yellow',
    primaryFinding:
      'THIN cells are not provider-starved. Current evidence points to candidate shaping, role-pool lane compression, route-shape quality floor, and Waypoint ranking/movement tradeoffs, with better ranked-arc diagnostics needed before product patching.',
    recommendedPrimaryFixLocation: 'F_better_artifact_diagnostics_before_product_patch',
    likelyNextFixLocations: [
      'D_waypoint_movement_sequencing_lane_variance_scoring',
      'E_route_shape_or_direction_contract_tuning',
      'C_provider_result_admission_or_role_pool_diversity',
    ],
  },
}

assert(fetchCallCount === 0, `Expected fetchCallCount 0, received ${fetchCallCount}`)
console.log(JSON.stringify(output, null, 2))
