import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { curatedVenues } from '../src/data/venues.ts'

type Role = 'start' | 'highlight' | 'windDown'
type CellKind = 'THIN' | 'PASS'

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

type ArtifactCell = {
  key: string
  kind: CellKind
  label: string
  path: string
}

type RouteStop = {
  stop?: string
  name?: string
  venueId?: string
  id?: string
  role?: string
}

type RunSummary = {
  persona?: string
  locationClass?: string
  anchor?: string
  canonicalId?: string
  classification?: string
  mergedUniqueResultCount?: number
  staticFallbackUsed?: boolean
  providerDiagnosticsSettleState?: string
  generatedFinalRouteStops?: RouteStop[]
  requiredAnchorRoleCredited?: string | null
  routeAuthorityStatus?: string
  lockInputAvailable?: boolean
  generatedContractEntryArtifactPresent?: boolean
  finalRoutePresent?: boolean
  finalRoutePreservedReviewLockLivePlans?: boolean
  routeAuthority?: {
    routeAuthoritySourceLabel?: string | null
    generatedCanonicalRouteHandoffComplete?: boolean
  }
}

type QualityDiagnostics = {
  rolePoolVenueIdsByRole?: Partial<Record<Role, string[]>>
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
}

type RouteArtifacts = {
  snapshots?: Array<{
    qualityDiagnostics?: QualityDiagnostics
  }>
}

type VenueLite = {
  id: string
  name: string
  lane: Lane
  cluster: string
  category?: string
  tags: string[]
  latitude?: number
  longitude?: number
  source: 'static' | 'inferred'
}

type Candidate = {
  stops: Record<Role, VenueLite>
  ids: Record<Role, string>
  names: Record<Role, string>
  lanes: Record<Role, Lane>
  clusters: Record<Role, string>
  laneDistinctCount: number
  clusterTransitionCount: number
  movementKm: number | null
  hospitalityRepeatCount: number
  supportStopVariance: number
  strongMomentPresentProxy: boolean
  personaFitProxy: number
  roleFitProxy: number
  greatStopProxyScore: number
  movementScore: number
}

type RejectionCounts = {
  missingAnchor: number
  wrongAnchorRole: number
  duplicateVenue: number
  roleShapeInvalid: number
  hardPersonaIncompatible: number
  totalRejected: number
}

const roles: Role[] = ['start', 'highlight', 'windDown']
const venueById = new Map(curatedVenues.map((venue) => [venue.id, venue]))
let fetchCallCount = 0

globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error('Network disabled for anchor-preserving ranked arc diagnostic.')
}) as typeof fetch

const cells: ArtifactCell[] = [
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function readJson<T>(path: string): T {
  assert(existsSync(path), `Missing artifact file: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function round(value: number, places = 3): number {
  return Number(value.toFixed(places))
}

function normalize(value: string | undefined): string {
  return (value ?? '').toLowerCase()
}

function laneFromSignals(signals: string[]): Lane {
  const text = signals.map(normalize).join(' ')
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
      venue.name,
      venue.neighborhood,
      venue.category,
      venue.subcategory,
      ...(venue.tags ?? []),
      ...(venue.vibeTags ?? []),
      ...(venue.sourceTypes ?? []),
    ].filter(Boolean) as string[]
    return {
      id,
      name: venue.name,
      lane: laneFromSignals(tags),
      cluster: venue.neighborhood ?? venue.city ?? 'unknown',
      category: venue.category,
      tags,
      latitude: venue.latitude,
      longitude: venue.longitude,
      source: 'static',
    }
  }

  const name = id.replace(/^moment-/, '').replace(/^sj-/, '').replace(/-/g, ' ')
  return {
    id,
    name,
    lane: laneFromSignals([id, name]),
    cluster: inferCluster(id),
    tags: [id, name],
    source: 'inferred',
  }
}

function inferCluster(id: string): string {
  if (id.includes('willow')) return 'Willow Glen'
  if (id.includes('jtown') || id.includes('japanese')) return 'Japantown'
  if (id.includes('rose') || id.includes('bramhall')) return 'Rose Garden'
  if (id.includes('evergreen') || id.includes('village-grill')) return 'Evergreen'
  if (id.includes('alum-rock')) return 'Alum Rock'
  if (id.includes('adega') || id.includes('little-portugal')) return 'Little Portugal'
  if (id.includes('miniboss') || id.includes('tech') || id.includes('haberdasher')) return 'Downtown'
  return 'unknown'
}

function normalizeRole(role: string | null | undefined): Role | null {
  const value = normalize(role)
  if (value === 'start' || value === 'starter') return 'start'
  if (value === 'highlight' || value === 'peak' || value === 'anchor') return 'highlight'
  if (value === 'winddown' || value === 'wind_down' || value === 'wind-down' || value === 'end') {
    return 'windDown'
  }
  return null
}

function lastQuality(artifacts: RouteArtifacts): QualityDiagnostics {
  const snapshots = artifacts.snapshots ?? []
  assert(snapshots.length > 0, 'Missing route artifact snapshots')
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index].qualityDiagnostics?.rolePoolVenueIdsByRole) {
      return snapshots[index].qualityDiagnostics as QualityDiagnostics
    }
  }
  return snapshots[snapshots.length - 1].qualityDiagnostics ?? {}
}

function selectedRouteIds(summary: RunSummary, quality: QualityDiagnostics): string[] {
  if (quality.finalGeneratedRouteStopIds?.length === 3) return quality.finalGeneratedRouteStopIds
  return (summary.generatedFinalRouteStops ?? [])
    .map((stop) => stop.venueId ?? stop.id)
    .filter(Boolean) as string[]
}

function requiredRole(summary: RunSummary, quality: QualityDiagnostics): Role {
  const credited = normalizeRole(summary.requiredAnchorRoleCredited)
  if (credited) return credited

  const stop = (summary.generatedFinalRouteStops ?? []).find((candidate) => {
    const id = candidate.venueId ?? candidate.id
    return id === summary.canonicalId || normalize(candidate.stop) === normalize(summary.anchor)
  })
  const fromStop = normalizeRole(stop?.role)
  if (fromStop) return fromStop

  const rolePools = quality.rolePoolVenueIdsByRole ?? {}
  const containingRoles = roles.filter((role) => rolePools[role]?.includes(summary.canonicalId ?? ''))
  assert(containingRoles.length > 0, `Could not infer required role for ${summary.canonicalId}`)
  assert(
    containingRoles.length === 1,
    `Ambiguous required role for ${summary.canonicalId}: ${containingRoles.join(', ')}`,
  )
  return containingRoles[0]
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function haversineKm(a: VenueLite, b: VenueLite): number | null {
  if (
    typeof a.latitude !== 'number' ||
    typeof a.longitude !== 'number' ||
    typeof b.latitude !== 'number' ||
    typeof b.longitude !== 'number'
  ) {
    return null
  }
  const radiusKm = 6371
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const root =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return 2 * radiusKm * Math.atan2(Math.sqrt(root), Math.sqrt(1 - root))
}

function movementKm(stops: VenueLite[]): number | null {
  const first = haversineKm(stops[0], stops[1])
  const second = haversineKm(stops[1], stops[2])
  if (first == null || second == null) return null
  return round(first + second, 2)
}

function isHospitality(lane: Lane): boolean {
  return ['coffee_tea_cafe', 'restaurant_meal', 'drinks_bar_nightlife', 'dessert_bakery'].includes(lane)
}

function roleFit(venue: VenueLite, role: Role): number {
  if (role === 'highlight') return strongMomentScore(venue)
  if (role === 'start') return venue.lane === 'coffee_tea_cafe' || venue.lane === 'park_outdoor' ? 0.9 : 0.55
  return venue.lane === 'dessert_bakery' || venue.lane === 'coffee_tea_cafe' || venue.lane === 'drinks_bar_nightlife'
    ? 0.9
    : 0.5
}

function strongMomentScore(venue: VenueLite): number {
  const text = [venue.name, venue.category, ...venue.tags].join(' ').toLowerCase()
  let score = 0
  if (['culture_museum_activity', 'park_outdoor', 'drinks_bar_nightlife'].includes(venue.lane)) score += 0.8
  if (/\b(unique|hidden|interactive|zoo|museum|arcade|tasting|garden|park|chef|flight|landmark|grill)\b/.test(text)) {
    score += 0.8
  }
  if (venue.source === 'static') score += 0.2
  return Math.min(score, 1.8)
}

function personaFit(stops: Record<Role, VenueLite>, persona: string | undefined): number {
  const text = Object.values(stops)
    .flatMap((venue) => [venue.name, venue.category, ...venue.tags])
    .join(' ')
    .toLowerCase()
  if (persona === 'Family') {
    return /\b(family|kid|children|zoo|museum|park|interactive|activity|garden)\b/.test(text) ? 1 : 0.45
  }
  if (persona === 'Romantic') {
    return /\b(intimate|wine|dinner|garden|tasting|quiet|elevated|tea)\b/.test(text) ? 1 : 0.45
  }
  if (persona === 'Friends') {
    return /\b(arcade|game|grill|social|hang|dessert|coffee|lively|bar)\b/.test(text) ? 1 : 0.45
  }
  return 0.6
}

function hardPersonaIncompatible(stops: Record<Role, VenueLite>, persona: string | undefined): boolean {
  if (persona !== 'Family') return false
  return stops.highlight.lane === 'drinks_bar_nightlife'
}

function buildCandidate(stops: Record<Role, VenueLite>, persona: string | undefined): Candidate {
  const ordered = roles.map((role) => stops[role])
  const lanes = Object.fromEntries(roles.map((role) => [role, stops[role].lane])) as Record<Role, Lane>
  const clusters = Object.fromEntries(roles.map((role) => [role, stops[role].cluster])) as Record<Role, string>
  const clusterTransitionCount = roles.slice(1).filter((role, index) => clusters[role] !== clusters[roles[index]]).length
  const laneDistinctCount = new Set(Object.values(lanes)).size
  const hospitalityRepeatCount = Math.max(0, Object.values(lanes).filter(isHospitality).length - 1)
  const supportStopVariance = new Set([lanes.start, lanes.windDown]).size
  const distanceKm = movementKm(ordered)
  const movementScore = distanceKm == null ? Math.max(0, 1 - clusterTransitionCount * 0.2) : Math.max(0, 1 - Math.min(distanceKm, 12) / 12)
  const roleFitProxy = round(roles.reduce((sum, role) => sum + roleFit(stops[role], role), 0) / roles.length)
  const personaFitProxy = personaFit(stops, persona)
  const strongMoment = strongMomentScore(stops.highlight)
  const score =
    laneDistinctCount * 1.2 +
    movementScore * 1.6 +
    strongMoment * 1.7 +
    roleFitProxy * 1.2 +
    personaFitProxy +
    supportStopVariance * 0.35 -
    hospitalityRepeatCount * 0.45 -
    clusterTransitionCount * 0.2

  return {
    stops,
    ids: Object.fromEntries(roles.map((role) => [role, stops[role].id])) as Record<Role, string>,
    names: Object.fromEntries(roles.map((role) => [role, stops[role].name])) as Record<Role, string>,
    lanes,
    clusters,
    laneDistinctCount,
    clusterTransitionCount,
    movementKm: distanceKm,
    hospitalityRepeatCount,
    supportStopVariance,
    strongMomentPresentProxy: strongMoment >= 1,
    personaFitProxy: round(personaFitProxy),
    roleFitProxy,
    greatStopProxyScore: round(score),
    movementScore: round(movementScore),
  }
}

function summarizeCandidate(candidate: Candidate): object {
  return {
    route: roles.map((role) => candidate.names[role]).join(' -> '),
    ids: roles.map((role) => candidate.ids[role]).join(' -> '),
    lanes: candidate.lanes,
    clusters: candidate.clusters,
    laneDistinctCount: candidate.laneDistinctCount,
    clusterTransitionCount: candidate.clusterTransitionCount,
    movementKm: candidate.movementKm,
    hospitalityRepeatCount: candidate.hospitalityRepeatCount,
    supportStopVariance: candidate.supportStopVariance,
    strongMomentPresentProxy: candidate.strongMomentPresentProxy,
    personaFitProxy: candidate.personaFitProxy,
    roleFitProxy: candidate.roleFitProxy,
    greatStopProxyScore: candidate.greatStopProxyScore,
    movementScore: candidate.movementScore,
  }
}

function enumerate(
  rolePools: Record<Role, VenueLite[]>,
  requiredAnchorId: string,
  requiredAnchorRole: Role,
  persona: string | undefined,
): { valid: Candidate[]; rejected: RejectionCounts; considered: number } {
  const rejected: RejectionCounts = {
    missingAnchor: 0,
    wrongAnchorRole: 0,
    duplicateVenue: 0,
    roleShapeInvalid: 0,
    hardPersonaIncompatible: 0,
    totalRejected: 0,
  }
  const valid: Candidate[] = []
  let considered = 0

  for (const start of rolePools.start) {
    for (const highlight of rolePools.highlight) {
      for (const windDown of rolePools.windDown) {
        considered += 1
        const stops = { start, highlight, windDown }
        const ids = roles.map((role) => stops[role].id)
        const roleShapeInvalid = roles.some((role) => !stops[role])
        const duplicateVenue = new Set(ids).size !== ids.length
        const anchorRoles = roles.filter((role) => stops[role].id === requiredAnchorId)
        const missingAnchor = anchorRoles.length === 0
        const wrongAnchorRole = anchorRoles.length > 0 && !anchorRoles.includes(requiredAnchorRole)
        const personaInvalid = hardPersonaIncompatible(stops, persona)

        if (roleShapeInvalid) rejected.roleShapeInvalid += 1
        if (duplicateVenue) rejected.duplicateVenue += 1
        if (missingAnchor) rejected.missingAnchor += 1
        if (wrongAnchorRole) rejected.wrongAnchorRole += 1
        if (personaInvalid) rejected.hardPersonaIncompatible += 1

        if (roleShapeInvalid || duplicateVenue || missingAnchor || wrongAnchorRole || personaInvalid) {
          rejected.totalRejected += 1
          continue
        }
        valid.push(buildCandidate(stops, persona))
      }
    }
  }

  return { valid, rejected, considered }
}

function rankOfSelected(candidates: Candidate[], selectedIds: string[], score: (candidate: Candidate) => number): number | null {
  if (selectedIds.length !== 3) return null
  const selectedKey = selectedIds.join('|')
  const ranked = [...candidates].sort((a, b) => score(b) - score(a))
  const index = ranked.findIndex((candidate) => roles.map((role) => candidate.ids[role]).join('|') === selectedKey)
  return index >= 0 ? index + 1 : null
}

function top(candidates: Candidate[], score: (candidate: Candidate) => number): object[] {
  return [...candidates]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 10)
    .map(summarizeCandidate)
}

function rankBand(rank: number | null, total: number): 'top_ranked' | 'mid_ranked' | 'low_ranked' | 'not_found' {
  if (rank == null) return 'not_found'
  if (rank <= Math.max(3, total * 0.1)) return 'top_ranked'
  if (rank <= Math.max(6, total * 0.5)) return 'mid_ranked'
  return 'low_ranked'
}

function diagnose(cell: ArtifactCell): object {
  const artifactDir = join(process.cwd(), cell.path)
  const summary = readJson<RunSummary>(join(artifactDir, 'run-summary.json'))
  const artifacts = readJson<RouteArtifacts>(join(artifactDir, 'route-artifacts.json'))
  const quality = lastQuality(artifacts)
  const anchorId = summary.canonicalId
  assert(anchorId, `Missing canonicalId for ${cell.key}`)
  const role = requiredRole(summary, quality)
  const pools = Object.fromEntries(
    roles.map((poolRole) => [
      poolRole,
      (quality.rolePoolVenueIdsByRole?.[poolRole] ?? []).map(venueFromId),
    ]),
  ) as Record<Role, VenueLite[]>
  const selectedIds = selectedRouteIds(summary, quality)
  const selectedPreservesAnchor =
    selectedIds.includes(anchorId) && selectedIds[roles.indexOf(role)] === anchorId
  const requiredAnchorPresentInRequiredRolePool = pools[role].some((venue) => venue.id === anchorId)
  const { valid, rejected, considered } = enumerate(pools, anchorId, role, summary.persona)
  const selectedGreatStopRank = rankOfSelected(valid, selectedIds, (candidate) => candidate.greatStopProxyScore)
  const selectedMovementRank = rankOfSelected(valid, selectedIds, (candidate) => candidate.movementScore)
  const selectedLaneRank = rankOfSelected(valid, selectedIds, (candidate) => candidate.laneDistinctCount)
  const selectedCandidate = valid.find(
    (candidate) => roles.map((candidateRole) => candidate.ids[candidateRole]).join('|') === selectedIds.join('|'),
  )
  const topGreatStop = top(valid, (candidate) => candidate.greatStopProxyScore)
  const topMovement = top(valid, (candidate) => candidate.movementScore)
  const topLane = top(valid, (candidate) => candidate.laneDistinctCount)
  const materiallyBetter =
    selectedCandidate != null &&
    valid.some((candidate) => candidate.greatStopProxyScore > selectedCandidate.greatStopProxyScore + 0.35)

  return {
    key: cell.key,
    kind: cell.kind,
    label: cell.label,
    artifactDir: cell.path,
    status: {
      classification: summary.classification,
      persona: summary.persona,
      locationClass: summary.locationClass,
      anchor: summary.anchor,
      requiredAnchorId: anchorId,
      requiredRole: role,
      selectedFinalRouteIds: selectedIds,
      selectedFinalRoutePreservedRequiredAnchor: selectedPreservesAnchor,
      providerDiagnosticsSettleState: summary.providerDiagnosticsSettleState,
      staticFallbackUsed: summary.staticFallbackUsed,
      generatedRuntimeAuthorityPresent:
        summary.generatedContractEntryArtifactPresent === true &&
        summary.finalRoutePresent === true &&
        summary.routeAuthorityStatus === 'valid' &&
        summary.lockInputAvailable === true,
      providerShadowAuthorityAssumed: false,
      routeAuthoritySource: summary.routeAuthority?.routeAuthoritySourceLabel ?? null,
      generatedCanonicalRouteHandoffComplete:
        summary.routeAuthority?.generatedCanonicalRouteHandoffComplete ?? null,
      finalRoutePreservedReviewLockLivePlans: summary.finalRoutePreservedReviewLockLivePlans ?? null,
    },
    reconstruction: {
      completeness: 'partial',
      missingFields: [
        'full ranked Waypoint arc candidate list',
        'selected live Waypoint rank',
        'per-candidate rejection reasons',
        'normalized live venue ids for every provider result',
        'complete scored venue objects for every role-pool entry',
      ],
    },
    requiredAnchorValidity: {
      everyReportedAlternatePreservesRequiredAnchor: true,
      requiredAnchorPresentInRequiredRolePool,
      consideredCandidateCount: considered,
      validAnchorPreservingCandidateCount: valid.length,
      invalidAlternatesRejected: rejected,
      rolePoolCounts: Object.fromEntries(roles.map((poolRole) => [poolRole, pools[poolRole].length])),
    },
    selectedRouteRank: {
      greatStopProxyRank: selectedGreatStopRank,
      movementProxyRank: selectedMovementRank,
      laneDiversityProxyRank: selectedLaneRank,
      rankBand: rankBand(selectedGreatStopRank, valid.length),
      materiallyBetterAnchorPreservingCandidateExists: materiallyBetter,
    },
    selectedRouteProxy: selectedCandidate ? summarizeCandidate(selectedCandidate) : null,
    capturedRouteQuality: {
      generatedRouteScore: quality.generatedRouteScore?.totalScore ?? null,
      spatialScore: quality.generatedRouteScore?.spatial?.score ?? null,
      clusterEscapes: quality.generatedRouteScore?.spatial?.clusterEscapeCount ?? null,
      strongMomentPresent: quality.generatedRouteScore?.scoreBreakdown?.strongMomentPresent ?? null,
      roleEnergyNote: quality.generatedRouteScore?.scoreBreakdown?.roleEnergyNote ?? null,
      categoryNotes: quality.generatedRouteScore?.scoreBreakdown?.categoryDiversityNotes ?? null,
      expressionWidth: quality.generatedRouteScore?.scoreBreakdown?.expressionWidth ?? null,
    },
    topValidAlternatives: {
      byGreatStopProxy: topGreatStop,
      byMovementProxy: topMovement,
      byLaneDiversityProxy: topLane,
    },
    diagnosis: classify(
      cell.kind,
      valid.length,
      selectedCandidate,
      materiallyBetter,
      quality,
      rejected,
      selectedPreservesAnchor,
      requiredAnchorPresentInRequiredRolePool,
    ),
  }
}

function classify(
  kind: CellKind,
  validCount: number,
  selected: Candidate | undefined,
  materiallyBetter: boolean,
  quality: QualityDiagnostics,
  rejected: RejectionCounts,
  selectedPreservesAnchor: boolean,
  requiredAnchorPresentInRequiredRolePool: boolean,
): object {
  const roots = new Set<string>()
  const fixes = new Set<string>()
  const score = quality.generatedRouteScore?.scoreBreakdown
  const spatial = quality.generatedRouteScore?.spatial
  const laneCompression =
    (score?.repeatedCategoryCount ?? 0) > 0 ||
    (score?.categoryDiversityNotes ?? []).some((note) => /hospitality|drinks|coffee|repeats/i.test(note))

  if (validCount === 0 && selectedPreservesAnchor && !requiredAnchorPresentInRequiredRolePool) {
    roots.add('F_artifact_role_pool_missing_required_anchor')
  } else if (validCount === 0) {
    roots.add('A_candidate_pool_weak')
  }
  if (materiallyBetter) roots.add('B_waypoint_ranking_failure_proxy')
  if (score?.strongMomentPresent === false || normalize(score?.roleEnergyNote).includes('flat')) {
    roots.add('C_route_shape_contract_quality_floor_weakness')
  }
  if (laneCompression) roots.add('D_role_pool_shaping_or_lane_compression')
  if (selected && selected.hospitalityRepeatCount >= 2) roots.add('E_anchor_or_support_lane_pressure')
  if ((spatial?.clusterEscapeCount ?? 0) >= 2) roots.add('E_anchor_or_support_lane_pressure')
  roots.add('F_diagnostics_still_insufficient_for_live_waypoint_rank')

  if (roots.has('B_waypoint_ranking_failure_proxy')) fixes.add('Waypoint ranking/scoring')
  if (roots.has('C_route_shape_contract_quality_floor_weakness')) fixes.add('RouteShapeContract / direction contract quality floor')
  if (roots.has('D_role_pool_shaping_or_lane_compression')) {
    fixes.add('Provider admission / role-pool diversity')
    fixes.add('Interpretation lane/family classification')
  }
  if (roots.has('A_candidate_pool_weak')) fixes.add('Field query diversity or anchor replacement')
  fixes.add('Better ranked-arc artifact capture first')

  return {
    appliesToKind: kind,
    rootClassification: [...roots],
    rejectedCountsUsed: rejected,
    recommendedFixLocation: [...fixes],
  }
}

const diagnostics = cells.map(diagnose)

const output = {
  test: 'Build quality required-anchor-preserving ranked arc diagnostic',
  mode: 'no-network artifact replay',
  fetchCallCount,
  artifactsInspected: cells.map((cell) => cell.path),
  contractValidityRule:
    'Only candidates that include the selected Build anchor in the credited required role, contain no duplicate venues, and remain non-authoritative pre-generation are ranked as alternatives.',
  thinCells: diagnostics.filter((cell) => (cell as { kind: CellKind }).kind === 'THIN'),
  passComparisonCells: diagnostics.filter((cell) => (cell as { kind: CellKind }).kind === 'PASS'),
  patternLevelClassification: {
    currentArtifactsStillInsufficient: true,
    reason:
      'Anchor-preserving proxy ranking is stronger than raw proxy ranking, but artifacts still lack live Waypoint rank, full ranked arc candidates, per-candidate rejection reasons, and normalized provider venue ids.',
    primaryRecommendation: 'Better ranked-arc artifact capture first',
    likelyFixLocationsAfterArtifactCapture: [
      'Waypoint ranking/scoring',
      'RouteShapeContract / direction contract quality floor',
      'Provider admission / role-pool diversity',
      'Interpretation lane/family classification',
    ],
  },
}

assert(fetchCallCount === 0, `Expected fetchCallCount 0, received ${fetchCallCount}`)
console.log(JSON.stringify(output, null, 2))
