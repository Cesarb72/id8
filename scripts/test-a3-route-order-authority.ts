import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildRouteRecommendationLifecycleDiagnostics } from '../src/app/services/routeRecommendationLifecycle.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
  type BuildRouteAuthoritySnapshotInput,
  type RouteAuthorityLockInputResult,
  type RouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import {
  buildLockedLiveArtifactPayload,
  saveLockedLiveArtifactSession,
} from '../src/app/services/live/liveSessionHandoff.ts'
import {
  loadLiveArtifactSession,
  loadSharedLiveArtifactPlan,
  saveSharedLiveArtifactPlan,
} from '../src/domain/live/liveArtifactSession.ts'
import {
  sanitizeLiveArtifactSessionPayload,
  validateLockedLiveArtifactSessionPayload,
} from '../src/domain/live/validateLiveArtifact.ts'
import {
  assertLceRuntimeMutationMayCommit,
  buildLceRuntimeContract,
} from '../src/domain/lce/lceRuntimeContract.ts'
import {
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../src/domain/artifacts/contractEntryArtifact.ts'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole, UserStopTitle } from '../src/domain/types/itinerary.ts'

type CaseStatus =
  | 'CANONICAL CONTROL PASSES'
  | 'CURRENT BEHAVIOR CONFIRMED'
  | 'RULED BEHAVIOR IMPLEMENTED'
  | 'CURRENT HONEST FAILURE'
  | 'RULED BEHAVIOR NOT YET IMPLEMENTED'
  | 'NOT COVERED'
  | 'UNRESOLVED'
  | 'ORDER CONTRACT CONTRADICTION'

type CoreRole = 'start' | 'highlight' | 'windDown'

interface MemoryStorageLike {
  readonly length: number
  clear(): void
  getItem(key: string): string | null
  key(index: number): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

class MemoryStorage implements MemoryStorageLike {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

interface OrderProofCase {
  caseId: string
  status: CaseStatus
  producingLayer: string
  incomingCarrier: string
  approvedPayloadArrayOrder: string[]
  approvedPayloadStopIndexOrder: string[]
  approvedPayloadCanonicalRouteIdsByStopIndex: string[]
  runtimeArrayOrder: string[]
  runtimeStopIndexOrder: string[]
  runtimeCanonicalRouteIdsByStopIndex: string[]
  artifactRoleOrder: string[]
  artifactRoleCanonicalIds: string[]
  routeRoleIdentity: string[]
  routeCanonicalVenueSet: string[]
  canonicalRouteIds: string[]
  comparisonBasis: string
  lockInputComparison: string
  equalityResult: string
  reviewEligibility: boolean
  lockEligibility: boolean
  lockInputResult: string
  artifactMaterializationImpact: string
  currentBehavior: string
  ruledFutureBehavior: string
  honestFailureOccurs: boolean
  providerCallCount: number
}

const CORE_ROLES: CoreRole[] = ['start', 'highlight', 'windDown']
const CANONICAL_IDS: Record<CoreRole, string> = {
  start: 'sj-a3-order-proof-start',
  highlight: 'sj-a3-order-proof-highlight',
  windDown: 'sj-a3-order-proof-winddown',
}
const DISPLAY_NAMES: Record<CoreRole, string> = {
  start: 'A3 Order Proof Start',
  highlight: 'A3 Order Proof Highlight',
  windDown: 'A3 Order Proof Winddown',
}
const DIRECTION_ID = 'a3-4b:direction:route-order-proof'
const ARTIFACT_ID = 'a3-4b:contract-entry:route-order-proof'
const CONFIRMATION = 'A3 Order Proof Start -> A3 Order Proof Highlight -> A3 Order Proof Winddown'
const REORDERED_ROLES: CoreRole[] = ['highlight', 'start', 'windDown']
const DOWNSTREAM_CONSUMERS = [
  'RouteAuthoritySnapshot.validationStatus',
  'RouteAuthoritySnapshot.lockReadyCanonicalRouteTruthCandidate',
  'RouteAuthoritySnapshot.canonicalRouteIds',
  'RouteAuthorityLockInputResult',
  'routeRecommendationLifecycle reviewEligible/lockEligible',
  'buildLockedLiveArtifactPayload / saveLockedLiveArtifactSession',
  'Live/Plans session payload',
  'LCE runtime contract after lock',
]

const originalFetch = globalThis.fetch
const previousWindow = (globalThis as unknown as { window?: unknown }).window
const fetchCalls: string[] = []

globalThis.fetch = (async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  fetchCalls.push(url)
  throw new Error(`A3 route-order proof must not call fetch/providers: ${url}`)
}) as typeof fetch

function installMemoryWindow(): void {
  ;(globalThis as unknown as { window?: { sessionStorage: MemoryStorageLike; localStorage: MemoryStorageLike } }).window = {
    sessionStorage: new MemoryStorage(),
    localStorage: new MemoryStorage(),
  }
}

function restoreGlobals(): void {
  globalThis.fetch = originalFetch
  if (previousWindow === undefined) {
    delete (globalThis as unknown as { window?: unknown }).window
    return
  }
  ;(globalThis as unknown as { window?: unknown }).window = previousWindow
}

function titleForRole(role: UserStopRole): UserStopTitle {
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'windDown') {
    return 'Wind Down'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Start'
}

function buildItineraryStop(role: CoreRole, index: number): ItineraryStop {
  return {
    id: `itinerary:${CANONICAL_IDS[role]}`,
    role,
    title: titleForRole(role),
    venueId: CANONICAL_IDS[role],
    venueName: DISPLAY_NAMES[role],
    formattedAddress: `${100 + index} A3 Order Proof Way, San Jose, CA`,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    city: 'San Jose',
    category: 'proof',
    subcategory: 'route-order',
    priceTier: '$$',
    tags: ['a3-4b', 'route-order'],
    vibeTags: ['neutral'],
    neighborhood: 'San Jose',
    driveMinutes: 6,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: `${DISPLAY_NAMES[role]} proof stop`,
    imageUrl: `https://example.invalid/${CANONICAL_IDS[role]}.jpg`,
    stopInsider: {
      roleReason: `${DISPLAY_NAMES[role]} holds the ${role} role.`,
      localSignal: 'Provider-free A3-4B fixture.',
      selectionReason: 'A3-4B routeAuthority route-order proof.',
    },
  }
}

function buildItinerary(): Itinerary {
  const stops = CORE_ROLES.map((role, index) => buildItineraryStop(role, index))
  return {
    id: 'itinerary:a3-4b:route-order-proof',
    title: 'A3-4B Route Order Proof',
    city: 'San Jose',
    neighborhood: 'San Jose',
    crew: 'romantic',
    vibes: ['cozy'],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'A3-4B deterministic route',
    story: {
      headline: 'A3-4B Route Order Proof',
      subtitle: 'Provider-free routeAuthority proof.',
    },
    shareSummary: CONFIRMATION,
  }
}

function buildRuntimeStop(params: {
  role: CoreRole
  venueId: string
  displayName: string
  stopIndex: number
}): RuntimeRouteStop {
  return {
    id: `runtime:${params.role}:${params.venueId}`,
    sourceStopId: `source:${params.role}:${params.venueId}`,
    displayName: params.displayName,
    latitude: 37.33 + params.stopIndex * 0.001,
    longitude: -121.89 - params.stopIndex * 0.001,
    address: `${100 + params.stopIndex} A3 Order Proof Way, San Jose, CA`,
    role: params.role,
    stopIndex: params.stopIndex,
    venueId: params.venueId,
    title: titleForRole(params.role),
    subtitle: `${params.displayName} proof stop`,
    neighborhood: 'San Jose',
    driveMinutes: 6,
    imageUrl: `https://example.invalid/${params.venueId}.jpg`,
  }
}

function baseStops(): Record<CoreRole, RuntimeRouteStop> {
  return {
    start: buildRuntimeStop({
      role: 'start',
      venueId: CANONICAL_IDS.start,
      displayName: DISPLAY_NAMES.start,
      stopIndex: 0,
    }),
    highlight: buildRuntimeStop({
      role: 'highlight',
      venueId: CANONICAL_IDS.highlight,
      displayName: DISPLAY_NAMES.highlight,
      stopIndex: 1,
    }),
    windDown: buildRuntimeStop({
      role: 'windDown',
      venueId: CANONICAL_IDS.windDown,
      displayName: DISPLAY_NAMES.windDown,
      stopIndex: 2,
    }),
  }
}

function buildRuntimeRoute(params: {
  routeId?: string
  stops?: RuntimeRouteStop[]
} = {}): RuntimeRouteArtifact {
  const stops = params.stops ?? CORE_ROLES.map((role) => baseStops()[role])
  return {
    routeId: params.routeId ?? 'runtime-route:a3-4b:route-order-proof',
    selectedDirectionId: DIRECTION_ID,
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'A3-4B Route Order Proof',
    routeSummary: CONFIRMATION,
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1_787_300_000_000,
  }
}

function buildArtifact(): ContractEntryArtifact {
  return {
    id: ARTIFACT_ID,
    sourceOpportunityId: 'opportunity:a3-4b:route-order-proof',
    sourceMode: 'curated',
    anchorVenueId: CANONICAL_IDS.highlight,
    anchorRole: 'highlight',
    anchorName: DISPLAY_NAMES.highlight,
    routeTitle: 'A3-4B Route Order Proof',
    flavorLine: 'Provider-free routeAuthority route-order proof.',
    routeSummary: CONFIRMATION,
    traits: ['a3-4b', 'route-order'],
    storySpine: {
      start: DISPLAY_NAMES.start,
      highlight: DISPLAY_NAMES.highlight,
      windDown: DISPLAY_NAMES.windDown,
    },
    districtLine: 'San Jose',
    districtAnchorLine: `Anchor: ${DISPLAY_NAMES.highlight}`,
    authorityLine: 'A3-4B proof only.',
    whyChooseLine: 'The route has deterministic proof identity and sequence.',
    whyTonightProofLine: 'Provider-free local proof only.',
    selection: {
      directionId: DIRECTION_ID,
      pocketId: 'a3-4b:route-order',
    },
    qualification: {
      status: 'committable',
      failedCheck: null,
      missingRoleForContract: null,
      hardCommitRequired: true,
    },
    enrichment: {
      mode: 'curate',
      locationContext: {
        city: 'San Jose',
        neighborhood: 'San Jose',
      },
      userInputContext: {
        primaryVibe: 'cozy',
        persona: 'romantic',
        anchorVenueId: CANONICAL_IDS.highlight,
        anchorName: DISPLAY_NAMES.highlight,
      },
      conciergeIntentSummary: {
        planningMode: 'curate',
        primaryVibe: 'cozy',
        persona: 'romantic',
        summary: 'A3-4B route-order proof.',
      },
      tasteDistrictSummary: {
        tasteProfileId: 'a3-4b',
        districtId: 'a3-4b:route-order',
        districtLabel: 'San Jose',
        summary: 'A3-4B deterministic route.',
      },
      fieldProvenanceSummary: {
        sourceMode: 'curated',
        provider: 'static-corpus',
        liveProviderUsed: false,
        corpusUsed: true,
        calibrationOnly: false,
        candidateCount: 3,
        queryLabels: [],
        provenanceId: 'a3-4b-local-fixture',
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: 'bearings:a3-4b',
        summary: 'Proof fixture roles are admitted.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'waypoint:a3-4b',
        summary: CONFIRMATION,
      },
      canonicalRouteRoleCoverage: {
        start: DISPLAY_NAMES.start,
        highlight: DISPLAY_NAMES.highlight,
        windDown: DISPLAY_NAMES.windDown,
        support: CORE_ROLES.map((role) => ({
          role,
          name: DISPLAY_NAMES[role],
          venueId: CANONICAL_IDS[role],
        })),
      },
      validationStatus: 'valid',
      rejectionReasons: [],
      starterContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'a3-4b:curate',
        rejectionReasons: [],
      },
      modeContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'mode:curate',
        rejectionReasons: [],
      },
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        selectedDirectionId: DIRECTION_ID,
        rejectionReasons: [],
        buildMetadata: {
          canBuildRuntimeRoute: true,
        },
      },
    },
  }
}

function approvedPayload(finalRoute: RuntimeRouteArtifact): {
  artifactId: string
  selectedDirectionId: string
  finalRoute: RuntimeRouteArtifact
} {
  return {
    artifactId: ARTIFACT_ID,
    selectedDirectionId: finalRoute.selectedDirectionId,
    finalRoute,
  }
}

function routeArrayOrder(route: RuntimeRouteArtifact | null | undefined): string[] {
  return route?.stops.map((stop) => `${stop.role}:${stop.venueId}:idx${stop.stopIndex}`) ?? []
}

function orderedStops(route: RuntimeRouteArtifact | null | undefined): RuntimeRouteStop[] {
  return (
    route?.stops
      .filter((stop) => CORE_ROLES.includes(stop.role as CoreRole))
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex) ?? []
  )
}

function stopIndexOrder(route: RuntimeRouteArtifact | null | undefined): string[] {
  return orderedStops(route).map((stop) => `${stop.role}:${stop.venueId}:idx${stop.stopIndex}`)
}

function stopIndexRouteIds(route: RuntimeRouteArtifact | null | undefined): string[] {
  return orderedStops(route).map((stop) => stop.venueId)
}

function roleIdentity(route: RuntimeRouteArtifact | null | undefined): string[] {
  const byRole = new Map(route?.stops.map((stop) => [stop.role, stop.venueId]) ?? [])
  return CORE_ROLES.map((role) => `${role}:${byRole.get(role) ?? 'missing'}`)
}

function canonicalVenueSet(route: RuntimeRouteArtifact): string[] {
  return [...new Set(route.stops.map((stop) => stop.venueId))].sort()
}

function artifactRoleIds(artifact: ContractEntryArtifact): string[] {
  const byRole = new Map(
    (artifact.enrichment?.canonicalRouteRoleCoverage?.support ?? []).map((support) => [
      support.role,
      support.venueId ?? 'missing',
    ]),
  )
  return CORE_ROLES.map((role) => byRole.get(role) ?? 'missing')
}

function buildInput(params: {
  artifact: ContractEntryArtifact
  runtimeRoute: RuntimeRouteArtifact
  approvedRoute: RuntimeRouteArtifact
  itinerary: Itinerary
}): BuildRouteAuthoritySnapshotInput {
  return {
    contractEntryArtifact: params.artifact,
    runtimeRouteArtifact: params.runtimeRoute,
    approvedPayload: approvedPayload(params.approvedRoute),
    selectedDirectionId: DIRECTION_ID,
    selectedArtifactId: params.artifact.id,
    greatStopStatus: 'PASS',
    selectedClusterConfirmation: CONFIRMATION,
    itinerary: params.itinerary,
  }
}

function evaluateCase(params: {
  caseId: string
  artifact: ContractEntryArtifact
  runtimeRoute: RuntimeRouteArtifact
  approvedRoute: RuntimeRouteArtifact
  itinerary: Itinerary
  status: CaseStatus
  producingLayer: string
  incomingCarrier: string
  currentBehavior: string
  ruledFutureBehavior: string
}): { row: OrderProofCase; snapshot: RouteAuthoritySnapshot; lockInput: RouteAuthorityLockInputResult } {
  const snapshot = buildRouteAuthoritySnapshot(
    buildInput({
      artifact: params.artifact,
      runtimeRoute: params.runtimeRoute,
      approvedRoute: params.approvedRoute,
      itinerary: params.itinerary,
    }),
  )
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: true,
    finalRoutePresent: Boolean(snapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute),
    runtimeRouteArtifactPresent: true,
    greatStopStatus: 'PASS',
    routeAuthorityStatus: snapshot.validationStatus,
    lockInputAvailable: lockInput.ok,
    reviewEligible: snapshot.validationStatus === 'valid',
    lockEligible: lockInput.ok,
  })
  const row: OrderProofCase = {
    caseId: params.caseId,
    status: params.status,
    producingLayer: params.producingLayer,
    incomingCarrier: params.incomingCarrier,
    approvedPayloadArrayOrder: routeArrayOrder(params.approvedRoute),
    approvedPayloadStopIndexOrder: stopIndexOrder(params.approvedRoute),
    approvedPayloadCanonicalRouteIdsByStopIndex: stopIndexRouteIds(params.approvedRoute),
    runtimeArrayOrder: routeArrayOrder(params.runtimeRoute),
    runtimeStopIndexOrder: stopIndexOrder(params.runtimeRoute),
    runtimeCanonicalRouteIdsByStopIndex: stopIndexRouteIds(params.runtimeRoute),
    artifactRoleOrder: CORE_ROLES,
    artifactRoleCanonicalIds: artifactRoleIds(params.artifact),
    routeRoleIdentity: roleIdentity(params.runtimeRoute),
    routeCanonicalVenueSet: canonicalVenueSet(params.runtimeRoute),
    canonicalRouteIds: snapshot.canonicalRouteIds,
    comparisonBasis:
      'compareRouteToArtifact and compareRoutesByStableIds resolve stops by role; routeIds/canonicalRouteIds sort by stopIndex',
    lockInputComparison:
      'buildLockInputFromRouteAuthoritySnapshot compares routeIds(candidate.finalRoute) to snapshot.canonicalRouteIds',
    equalityResult: snapshot.validationStatus,
    reviewEligibility: lifecycle.reviewEligible,
    lockEligibility: lifecycle.lockEligible,
    lockInputResult: lockInput.ok ? 'lock_input_materialized' : lockInput.diagnostics.rejectionReason ?? 'not_materialized',
    artifactMaterializationImpact: lockInput.ok
      ? `materialized_from:${snapshot.lockReadyCanonicalRouteTruthCandidate?.source}`
      : 'not_materialized',
    currentBehavior: params.currentBehavior,
    ruledFutureBehavior: params.ruledFutureBehavior,
    honestFailureOccurs: !lockInput.ok,
    providerCallCount: fetchCalls.length,
  }
  return { row, snapshot, lockInput }
}

function withStopIndex(route: RuntimeRouteArtifact, indices: Record<CoreRole, number>): RuntimeRouteArtifact {
  return buildRuntimeRoute({
    routeId: `${route.routeId}:stopindex-mutated`,
    stops: route.stops.map((stop) => ({
      ...stop,
      stopIndex: indices[stop.role as CoreRole],
    })),
  })
}

function withArrayOrder(route: RuntimeRouteArtifact, order: CoreRole[], normalizeStopIndex: boolean): RuntimeRouteArtifact {
  const byRole = new Map(route.stops.map((stop) => [stop.role, stop] as const))
  return buildRuntimeRoute({
    routeId: `${route.routeId}:array-${normalizeStopIndex ? 'normalized' : 'reordered'}`,
    stops: order.map((role, index) => {
      const stop = byRole.get(role)
      assert(stop, `missing role ${role}`)
      return {
        ...stop,
        ...(normalizeStopIndex ? { stopIndex: index } : {}),
      }
    }),
  })
}

function roleReassignedRoute(route: RuntimeRouteArtifact): RuntimeRouteArtifact {
  const byRole = new Map(route.stops.map((stop) => [stop.role, stop] as const))
  const start = byRole.get('start')
  const highlight = byRole.get('highlight')
  const windDown = byRole.get('windDown')
  assert(start && highlight && windDown)
  return buildRuntimeRoute({
    routeId: `${route.routeId}:role-reassigned`,
    stops: [
      { ...highlight, role: 'start', title: 'Start', displayName: 'Neutral Start', stopIndex: 0 },
      { ...start, role: 'highlight', title: 'Highlight', displayName: 'Neutral Highlight', stopIndex: 1 },
      { ...windDown, role: 'windDown', title: 'Wind Down', displayName: 'Neutral Wind Down', stopIndex: 2 },
    ],
  })
}

function assertStaticTrace(): {
  exactFile: string
  symbols: string[]
  currentComparisonBasis: string[]
  missingComparison: string
  directCallers: string[]
  transitiveEntryPoints: string[]
  downstreamConsumers: string[]
  orderContractContradictionFound: boolean
} {
  const routeAuthority = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
  assert(routeAuthority.includes('.sort((left, right) => left.stopIndex - right.stopIndex)'))
  assert(routeAuthority.includes('function routeCanonicalOrderProof('))
  assert(routeAuthority.includes('function routeCanonicalOrdersMatch('))
  assert(routeAuthority.includes('runtime_route_artifact_order_mismatch'))
  assert(routeAuthority.includes('approved_payload_route_order_mismatch'))
  assert(routeAuthority.includes('const expectedByRole = new Map(artifactRoleIdentities(params.artifact).map((identity) => [identity.role, identity]))'))
  assert(routeAuthority.includes('const stopsByRole = routeStopByRole(params.route)'))
  assert(routeAuthority.includes('const expectedStops = routeStopByRole(params.expected)'))
  assert(routeAuthority.includes('const actualStops = routeStopByRole(params.actual)'))
  assert(routeAuthority.includes('canonicalRuntimeRoute ?? (approvedPayloadRouteCanonical ? approvedPayloadRoute : null)'))
  assert(routeAuthority.includes('coreRouteIdsMatch(routeIds(candidate.finalRoute), params.snapshot.canonicalRouteIds)'))

  const pdd = readFileSync('ID8_PDD_v91.md', 'utf8')
  const worklist = readFileSync('ID8_ReHousing_Worklist.md', 'utf8')
  assert(pdd.includes('same canonical venue IDs, same stop order, same route identity and lineage'))
  assert(worklist.includes('RuntimeRouteArtifact` is post-lock authority and must preserve exact approved canonical IDs/order'))

  const sandbox = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const publicTruth = readFileSync('src/app/services/canonicalPublicRouteTruthService.ts', 'utf8')
  assert(sandbox.includes('buildRouteAuthoritySnapshot('))
  assert(sandbox.includes('buildLockInputFromRouteAuthoritySnapshot('))
  assert(publicTruth.includes('buildRouteAuthoritySnapshot('))
  assert(publicTruth.includes('buildLockInputFromRouteAuthoritySnapshot('))

  return {
    exactFile: 'src/app/services/routeAuthority/routeAuthorityService.ts',
    symbols: [
      'orderedCoreStops',
      'routeIds',
      'routeStopByRole',
      'compareRouteToArtifact',
      'compareRoutesByStableIds',
      'buildRouteAuthoritySnapshot',
      'buildLockInputFromRouteAuthoritySnapshot',
    ],
    currentComparisonBasis: [
      'artifact/runtime equality by role identity',
      'approvedPayload/runtime equality by role identity',
      'approvedPayload/runtime order equality by stopIndex-ordered canonical venue IDs',
      'lock input self-check against snapshot canonicalRouteIds',
    ],
    missingComparison:
      'pre-correction only: no independent comparison of selected runtime route order against approvedPayload.finalRoute order before lock input materialization',
    directCallers: [
      'runtime_route_artifact comparison',
      'approved_payload comparison when runtime route exists',
      'lock input canonicalRouteIds self-check',
    ],
    transitiveEntryPoints: [
      'buildRouteAuthoritySnapshot',
      'buildLockInputFromRouteAuthoritySnapshot',
      'canonicalPublicRouteTruthService buildBuildCardTruthModel',
      'SandboxConciergePage routeAuthority handoff',
    ],
    downstreamConsumers: DOWNSTREAM_CONSUMERS,
    orderContractContradictionFound: false,
  }
}

function run(): void {
  installMemoryWindow()
  const staticTrace = assertStaticTrace()
  const itinerary = buildItinerary()
  const artifact = buildArtifact()
  const approvedRoute = buildRuntimeRoute()
  assert.equal(validateContractEntryArtifactPreCommitTruth(artifact, { requireEnrichment: true }).status, 'valid')

  const exactCanonical = evaluateCase({
    caseId: 'case-1-exact-canonical-control',
    artifact,
    runtimeRoute: approvedRoute,
    approvedRoute,
    itinerary,
    status: 'CANONICAL CONTROL PASSES',
    producingLayer: 'Waypoint approved sequence materialized without mutation',
    incomingCarrier: 'ContractEntryArtifact + approvedPayload.finalRoute + RuntimeRouteArtifact',
    currentBehavior: 'same canonical IDs, array order, roles, and stopIndex values are valid and lockable',
    ruledFutureBehavior: 'preserve exact approved sequence control',
  })
  assert.equal(exactCanonical.snapshot.validationStatus, 'valid')
  assert(exactCanonical.lockInput.ok)
  assert.deepEqual(exactCanonical.row.canonicalRouteIds, Object.values(CANONICAL_IDS))

  const stopIndexOnlyRoute = withStopIndex(approvedRoute, { start: 1, highlight: 0, windDown: 2 })
  const stopIndexOnly = evaluateCase({
    caseId: 'case-2-stopindex-only-mutation',
    artifact,
    runtimeRoute: stopIndexOnlyRoute,
    approvedRoute,
    itinerary,
    status: 'RULED BEHAVIOR IMPLEMENTED',
    producingLayer: 'RuntimeRouteArtifact with stopIndex drift only',
    incomingCarrier: 'ContractEntryArtifact + approvedPayload.finalRoute + RuntimeRouteArtifact',
    currentBehavior:
      'PRE-CORRECTION CHARACTERIZED: array order, roles, and IDs remained intact, but changed stopIndex reordered canonicalRouteIds and stayed Review/Lock eligible',
    ruledFutureBehavior:
      'RULED BEHAVIOR IMPLEMENTED: runtime stopIndex order must match approvedPayload.finalRoute order before lock',
  })
  assert.equal(stopIndexOnly.snapshot.validationStatus, 'invalid')
  assert.equal(stopIndexOnly.lockInput.ok, false)
  assert(stopIndexOnly.snapshot.rejectionReasons.includes('runtime_route_artifact_order_mismatch'))
  assert.deepEqual(stopIndexOnly.row.canonicalRouteIds, Object.values(CANONICAL_IDS))

  const arrayReorderOnlyRoute = withArrayOrder(approvedRoute, REORDERED_ROLES, false)
  const arrayReorderOnly = evaluateCase({
    caseId: 'case-3-runtime-array-reorder-only',
    artifact,
    runtimeRoute: arrayReorderOnlyRoute,
    approvedRoute,
    itinerary,
    status: 'CURRENT BEHAVIOR CONFIRMED',
    producingLayer: 'RuntimeRouteArtifact with stop array reordered only',
    incomingCarrier: 'ContractEntryArtifact + approvedPayload.finalRoute + RuntimeRouteArtifact',
    currentBehavior:
      'runtime stop array order is not authority-relevant when stopIndex, roles, and IDs remain approved-order; routeAuthority remains valid and lockable',
    ruledFutureBehavior:
      'if approved sequence is defined by stopIndex order, this remains acceptable; if array order is also contractual, this requires a separate artifact-shape ruling',
  })
  assert.equal(arrayReorderOnly.snapshot.validationStatus, 'valid')
  assert(arrayReorderOnly.lockInput.ok)
  assert.deepEqual(arrayReorderOnly.row.canonicalRouteIds, Object.values(CANONICAL_IDS))

  const reassignedRoute = roleReassignedRoute(approvedRoute)
  const roleReassignment = evaluateCase({
    caseId: 'case-4-role-position-reassignment',
    artifact,
    runtimeRoute: reassignedRoute,
    approvedRoute,
    itinerary,
    status: 'CURRENT HONEST FAILURE',
    producingLayer: 'RuntimeRouteArtifact with canonical venues reassigned to different roles',
    incomingCarrier: 'ContractEntryArtifact + approvedPayload.finalRoute + RuntimeRouteArtifact',
    currentBehavior: 'role-based comparison rejects when canonical venues move between start/highlight/wind-down roles',
    ruledFutureBehavior: 'preserve role identity rejection; role reassignment is not approved-route equality',
  })
  assert.equal(roleReassignment.snapshot.validationStatus, 'invalid')
  assert.equal(roleReassignment.lockInput.ok, false)
  assert(roleReassignment.snapshot.mismatchReasons.includes('runtime_route_artifact_start_id_mismatch'))

  const arrayReorderNormalizedRoute = withArrayOrder(approvedRoute, REORDERED_ROLES, true)
  const arrayReorderNormalized = evaluateCase({
    caseId: 'case-5-array-reorder-plus-normalized-stopindex',
    artifact,
    runtimeRoute: arrayReorderNormalizedRoute,
    approvedRoute,
    itinerary,
    status: 'RULED BEHAVIOR IMPLEMENTED',
    producingLayer: 'RuntimeRouteArtifact with reordered array and rewritten stopIndex',
    incomingCarrier: 'ContractEntryArtifact + approvedPayload.finalRoute + RuntimeRouteArtifact',
    currentBehavior:
      'PRE-CORRECTION CHARACTERIZED: same canonical venue set and same role identity remained valid and lockable even when stopIndex order differed from approvedPayload.finalRoute',
    ruledFutureBehavior:
      'RULED BEHAVIOR IMPLEMENTED: unapproved sequence fails even when role identities are preserved',
  })
  assert.equal(arrayReorderNormalized.snapshot.validationStatus, 'invalid')
  assert.equal(arrayReorderNormalized.lockInput.ok, false)
  assert(arrayReorderNormalized.snapshot.rejectionReasons.includes('runtime_route_artifact_order_mismatch'))
  assert.deepEqual(arrayReorderNormalized.row.canonicalRouteIds, Object.values(CANONICAL_IDS))

  const lockInputUsesSelectedRoute = exactCanonical.lockInput
  assert(lockInputUsesSelectedRoute.ok)
  assert.deepEqual(
    stopIndexRouteIds(lockInputUsesSelectedRoute.input.canonicalRouteArtifact.finalRoute),
    stopIndexRouteIds(approvedRoute),
  )

  const reorderedPayload = buildLockedLiveArtifactPayload({
    ...lockInputUsesSelectedRoute.input,
    sessionId: 'a3-4b-route-order-exact-control-lock',
    lockedAt: 1,
  })
  assert.equal(validateLockedLiveArtifactSessionPayload(reorderedPayload).ok, true)
  const sanitized = sanitizeLiveArtifactSessionPayload(reorderedPayload)
  assert(sanitized?.finalRoute)
  assert.deepEqual(stopIndexRouteIds(sanitized.finalRoute), exactCanonical.row.canonicalRouteIds)
  const saveResult = saveLockedLiveArtifactSession({
    ...lockInputUsesSelectedRoute.input,
    sessionId: 'a3-4b-route-order-exact-control-lock',
    lockedAt: 1,
  })
  assert.equal(saveResult.ok, true)
  const returnedSession = loadLiveArtifactSession()
  assert(returnedSession?.finalRoute)
  assert.deepEqual(stopIndexRouteIds(returnedSession.finalRoute), exactCanonical.row.canonicalRouteIds)
  saveSharedLiveArtifactPlan('a3-4b-route-order-exact-control-plan', reorderedPayload)
  const returnedPlan = loadSharedLiveArtifactPlan('a3-4b-route-order-exact-control-plan')
  assert(returnedPlan?.finalRoute)
  assert.deepEqual(stopIndexRouteIds(returnedPlan.finalRoute), exactCanonical.row.canonicalRouteIds)
  const lceContract = buildLceRuntimeContract({
    source: 'a3-4b-route-order-authority',
    mutationKind: 'continuation',
    phase: 'confirm',
    runtimeRouteArtifact: lockInputUsesSelectedRoute.input.canonicalRouteArtifact.finalRoute,
    userConfirmed: true,
  })
  assert.equal(assertLceRuntimeMutationMayCommit(lceContract).ok, true)
  assert.deepEqual(stopIndexRouteIds(lceContract.route), exactCanonical.row.canonicalRouteIds)

  const cases = [
    exactCanonical.row,
    stopIndexOnly.row,
    arrayReorderOnly.row,
    roleReassignment.row,
    arrayReorderNormalized.row,
  ]

  const result = {
    status: 'PASS',
    judgment: 'A3 ROUTE-ORDER AUTHORITY CORRECTION REGRESSION PASSED',
    upstreamOrderContractJudgment: 'APPROVED SEQUENCE CONTRACT IS COMPLETE - ROUTEAUTHORITY ORDER CHECK IS IMPLEMENTED',
    isolationJudgment: 'ROUTE-ORDER CORRECTION SHARES THE A3-4 COMPARISON SEAM BUT CAN BE PROVEN SEPARATELY',
    providerCallsAttempted: fetchCalls.length,
    systemTrace: {
      orderedSeam:
        'Waypoint-approved route sequence -> ContractEntryArtifact.approvedPayload.finalRoute -> artifact role identities/order fields -> RuntimeRouteArtifact roles/stops -> routeAuthority carrier selection -> compareRouteToArtifact -> canonicalRouteIds -> buildRouteAuthoritySnapshot -> Review -> buildLockInputFromRouteAuthoritySnapshot -> Lock/materialization -> save/session/Plans -> Live/LCE',
      rightfulOwners: {
        routeSequence: 'Waypoint approved route sequence',
        preLockAuthority: 'ContractEntryArtifact.approvedPayload.finalRoute when exact canonical IDs/order are proven',
        postLockAuthority: 'RuntimeRouteArtifact preserving the exact approved route',
        lifecycleExposure: 'Application routeAuthority derives lockability but must not author replacement sequence truth',
      },
    },
    staticTrace,
    orderSignalsByCarrier: {
      approvedPayloadFinalRouteStopArrayOrder: routeArrayOrder(approvedRoute),
      approvedPayloadFinalRouteStopIndexOrder: stopIndexOrder(approvedRoute),
      artifactRoleOrder: CORE_ROLES,
      artifactRoleCanonicalIds: artifactRoleIds(artifact),
      runtimeStopArrayOrder: 'RuntimeRouteArtifact.stops physical array order; currently not used by routeIds',
      runtimeStopIndex: 'orderedCoreStops sorts by stopIndex and routeIds follows that order',
      routeRoleIdentity: 'compareRouteToArtifact / compareRoutesByStableIds map stops by role',
      canonicalRouteIdsOrder: 'first non-empty carrier routeIds, normally selected runtime route sorted by stopIndex',
    },
    canonicalRouteIdsSequenceProof: {
      exactControl: exactCanonical.row.canonicalRouteIds,
      stopIndexOnlyMutation: stopIndexOnly.row.canonicalRouteIds,
      arrayReorderOnly: arrayReorderOnly.row.canonicalRouteIds,
      arrayReorderPlusNormalizedStopIndex: arrayReorderNormalized.row.canonicalRouteIds,
      conclusion: 'canonicalRouteIds reflect the approved sequence when runtime sequence equality is proven; unapproved runtime order does not become lock-ready truth.',
    },
    lockInputIndependenceProof: {
      lockInputSelfCheckExpression:
        'coreRouteIdsMatch(routeIds(candidate.finalRoute), params.snapshot.canonicalRouteIds)',
      approvedPayloadOrder: stopIndexRouteIds(approvedRoute),
      selectedRuntimeOrder: arrayReorderNormalized.row.canonicalRouteIds,
      lockInputOkForReorderedRuntime: arrayReorderNormalized.lockInput.ok,
      conclusion:
        'RouteAuthority now blocks reordered runtime before lock input materialization; the lock input self-check remains a final canonical candidate guard.',
    },
    persistenceAndLceReach: {
      reorderedRouteMaterialized: arrayReorderNormalized.lockInput.ok,
      exactRouteMaterialized: lockInputUsesSelectedRoute.ok,
      livePayloadValidationOk: validateLockedLiveArtifactSessionPayload(reorderedPayload).ok,
      saveSessionOk: saveResult.ok,
      sessionRouteIdsByStopIndex: stopIndexRouteIds(returnedSession.finalRoute),
      plansRouteIdsByStopIndex: stopIndexRouteIds(returnedPlan.finalRoute),
      lceCommitAllowed: assertLceRuntimeMutationMayCommit(lceContract).ok,
      lceRouteIdsByStopIndex: stopIndexRouteIds(lceContract.route),
    },
    substitutionIsolation: {
      providerSourceFallbackRequired: false,
      displayNameFallbackRequired: false,
      venueIdsCompleteForEveryRuntimeCase: true,
      artifactRoleIdsCompleteForEveryRuntimeCase: true,
    },
    cases,
    downstreamImpact: {
      stopIndexOnlyMutationCanAffectCanonicalRouteIds: false,
      stopIndexOnlyMutationCanRemainLockable: false,
      arrayReorderOnlyCanRemainLockable: true,
      arrayReorderPlusNormalizedStopIndexCanAuthorizeDifferentSequence: false,
      roleReassignmentRejected: true,
      reorderedSequenceCanReachSaveSessionPlansLce: false,
    },
    minimumChangeMap: [
      {
        exactFile: 'src/app/services/routeAuthority/routeAuthorityService.ts',
        exactSymbolAndBranch:
          'buildRouteAuthoritySnapshot approvedPayload/runtime comparison and lockReadyCanonicalRouteTruthCandidate selection',
        currentComparisonBasis:
          'compareRoutesByStableIds and compareRouteToArtifact compare by role identity; routeCanonicalOrdersMatch compares approved/runtime stopIndex-ordered canonical IDs.',
        missingComparison:
          'PRE-CORRECTION CHARACTERIZED: selected runtime route stopIndex order was not compared to approvedPayload.finalRoute stopIndex order before lock readiness.',
        authoritativeApprovedOrderCarrier: 'ContractEntryArtifact.approvedPayload.finalRoute ordered by stopIndex',
        authoritativeRuntimeOrderCarrier: 'RuntimeRouteArtifact finalRoute ordered by stopIndex',
        intendedRuledComparison:
          'Require exact canonical venue ID sequence equality between approvedPayload.finalRoute and runtimeRouteArtifact before Review/Lock/materialization.',
        rightfulRejectionReason: 'runtime_route_artifact_order_mismatch or approved_payload_route_order_mismatch',
        reviewLockImpact: 'Reordered runtime routes become non-reviewable/non-lockable until exact approved order is restored.',
        artifactImpact: 'No artifact shape change expected; validation tightens only if approved.',
        saveSessionPlansLceImpact:
          'Valid canonical routes preserve continuity; reordered unapproved routes stop before save/session/Plans/LCE.',
        compatibilityImpact: 'Legacy/page-local diagnostics remain non-authoritative projections.',
        relationshipToA3ThreeAndA3Four:
          'Independent of provider/source fallback and display-name fallback; shares routeAuthority comparison surface with A3-4 only.',
        requiredRegressionProofs: [
          'A3-4B route-order proof',
          'A3-4 display-name proof',
          'A3-3 provider/source proof',
          'A3 route authority characterization',
          'routeAuthority shadow proof',
          'Review/Lock handoff proof',
          'phase2 save/session/Plans/LCE proof',
          'A1/A2 identity ingress proofs',
        ],
        bigWireApprovalRequirement: 'required',
      },
    ],
    nonCoverage: [
      {
        condition: 'browser-rendered map/list visual order',
        whyNotCovered: 'A3-4B exercises service and persistence carriers only.',
        blocksA3FourB: false,
        rightfulLaterProofLane: 'Application browser Review/Lock/Plans order proof',
      },
      {
        condition: 'governed-live provider route-order drift',
        whyNotCovered: 'Provider calls are forbidden in A3-4B.',
        blocksA3FourB: false,
        rightfulLaterProofLane: 'governed-live validation',
      },
    ],
    protectedBehavior: {
      productionBehaviorChanged: true,
      routeEqualityOrOrderBehaviorChanged: true,
      a3ThreeOrA3FourBehaviorChanged: false,
      routeOutputChanged: false,
      canonicalIdentityChanged: false,
      eligibilityChanged: true,
      greatStopBehaviorChanged: false,
      artifactShapeChanged: false,
      applicationSaveSessionPlansLceBehaviorChanged: true,
      fixtureOrCorpusChanged: false,
      providerOrHostedActivity: false,
    },
  }

  assert.equal(fetchCalls.length, 0)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

try {
  run()
} finally {
  restoreGlobals()
}
