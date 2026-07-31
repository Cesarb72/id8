import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildRouteRecommendationLifecycleDiagnostics } from '../src/app/services/routeRecommendationLifecycle.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
  type BuildRouteAuthoritySnapshotInput,
  type RouteAuthorityObservedSource,
  type RouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import {
  buildSandboxCanonicalRouteArtifact,
  projectFinalRouteToPlanningDisplayStops,
} from '../src/app/services/sandbox/canonicalRouteArtifactService.ts'
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
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../src/domain/artifacts/contractEntryArtifact.ts'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole, UserStopTitle } from '../src/domain/types/itinerary.ts'
import type { PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'

type FallbackClassification =
  | 'ACTIVE AUTHORITY'
  | 'DEFENSIVE COMPATIBILITY'
  | 'UNREACHABLE RESIDUE'
  | 'ARTIFACT REPAIR'
  | 'APPLICATION REPAIR'
  | 'UPSTREAM-GAP MASKING'
  | 'UNRESOLVED'

type RouteTruthEquality =
  | 'EXACT EQUALITY'
  | 'EXPLAINED COMPATIBILITY PROJECTION'
  | 'REPAIR WITHOUT AUTHORITY CHANGE'
  | 'AUTHORITY SUBSTITUTION'
  | 'NOT COVERED'
  | 'UNRESOLVED'

interface AuthorityLedgerRow {
  scenario: string
  mode: 'curate' | 'build' | 'surprise' | 'compatibility' | 'live_lce'
  producingLayer: string
  incomingCarrier: string
  incomingRouteIdentity: string | null
  incomingStopIdentities: string[]
  incomingApprovalState: string
  greatStopState: 'PASS' | 'FAIL' | 'NOT_PROVIDED'
  routeAuthorityInputSelected: string | null
  fallbackEvaluated: string[]
  fallbackTaken: string[]
  comparisonKey: string
  identityBefore: string[]
  identityAfter: string[]
  routeOrderBefore: string[]
  routeOrderAfter: string[]
  outputCarrier: string
  downstreamConsumer: string
  reviewEligibility: boolean | 'not_evaluated'
  lockEligibility: boolean
  artifactResult: string
  mutationOrRepairObserved: string
  reviewedRouteEqualsLockedRoute: RouteTruthEquality
  lockedRouteEqualsSavedReturnedRoute: RouteTruthEquality
}

interface FallbackLedgerRow {
  fallback: FallbackClassification
  file: string
  symbol: string
  producer: string
  consumer: string
  triggerCondition: string
  selectedValue: string
  authorityBefore: string
  authorityAfter: string
  routeTruthChanges: boolean
  identityChanges: boolean
  eligibilityChanges: boolean
  artifactMaterializationChanges: boolean
  reviewLockEqualityCanChange: boolean
  removalWouldBeBehaviorChanging: boolean
  bigWireApprovalStatus: string
}

interface EqualityLedgerRow {
  scenario: string
  generatedCandidateRoute: string[]
  approvedRoute: string[]
  reviewedRoute: string[]
  lockedRoute: string[]
  runtimeRouteArtifactRoute: string[]
  savedRoute: string[]
  returnedPlansRoute: string[]
  liveRoute: string[]
  lceRoute: string[]
  result: RouteTruthEquality
  reason: string
}

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

const ROUTE_IDS = {
  start: 'sj-willow-court-wine-bar',
  highlight: 'sj-theatre-district-jazz-cellar',
  windDown: 'sj-hedley-club-lounge',
} as const

const ROUTE_NAMES = {
  start: 'Willow Court Wine Bar',
  highlight: 'Theatre District Jazz Cellar',
  windDown: 'Hedley Club Lounge',
} as const

const PROVIDER_IDS = {
  start: 'provider:sj-willow-court-wine-bar',
  highlight: 'provider:sj-theatre-district-jazz-cellar',
  windDown: 'provider:sj-hedley-club-lounge',
} as const

const DIRECTION_ID = 'a3:direction:willow-court'
const ARTIFACT_ID = 'contract-entry:a3:willow-court'
const CONFIRMATION = 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge'

const originalFetch = globalThis.fetch
const fetchCalls: string[] = []
const previousWindow = (globalThis as unknown as { window?: unknown }).window

globalThis.fetch = (async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  fetchCalls.push(url)
  throw new Error(`A3 routeAuthority characterization must not call fetch/providers: ${url}`)
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

function coreRoles(): Array<Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>> {
  return ['start', 'highlight', 'windDown']
}

function buildItineraryStop(role: UserStopRole, index: number): ItineraryStop {
  const venueId =
    role === 'highlight' ? ROUTE_IDS.highlight : role === 'windDown' ? ROUTE_IDS.windDown : ROUTE_IDS.start
  const venueName =
    role === 'highlight' ? ROUTE_NAMES.highlight : role === 'windDown' ? ROUTE_NAMES.windDown : ROUTE_NAMES.start
  return {
    id: `source-stop:${venueId}`,
    role,
    title: titleForRole(role),
    venueId,
    venueName,
    formattedAddress: `${100 + index} A3 Fixture Way, San Jose, CA`,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    city: 'San Jose',
    category: role === 'highlight' ? 'live_music' : 'bar',
    subcategory: 'A3 fixture',
    priceTier: '$$',
    tags: ['a3', 'fixture'],
    vibeTags: ['cozy'],
    neighborhood: 'San Jose',
    driveMinutes: 6,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: `${venueName} A3 fixture stop`,
    imageUrl: `https://example.invalid/${venueId}.jpg`,
    stopInsider: {
      roleReason: `${venueName} holds the ${role} role.`,
      localSignal: 'A3 local fixture.',
      selectionReason: 'A3 routeAuthority characterization fixture.',
    },
  }
}

function buildItinerary(): Itinerary {
  const stops = coreRoles().map((role, index) => buildItineraryStop(role, index))
  return {
    id: 'itinerary:a3:willow-court',
    title: 'A3 Willow Court Route',
    city: 'San Jose',
    neighborhood: 'San Jose',
    crew: 'romantic',
    vibes: ['cozy'],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'A3 deterministic route',
    story: {
      headline: 'A3 Willow Court Route',
      subtitle: 'Provider-free routeAuthority characterization.',
    },
    shareSummary: CONFIRMATION,
  }
}

function buildRuntimeStop(params: {
  role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  index: number
  venueId: string
  displayName: string
  sourceStopId?: string
  providerRecordId?: string
  imageUrl?: string
}): RuntimeRouteStop {
  return {
    id: `runtime-stop:${params.role}:${params.venueId || params.providerRecordId || params.index}`,
    sourceStopId: params.sourceStopId ?? `source-stop:${params.venueId}`,
    displayName: params.displayName,
    providerRecordId: params.providerRecordId ?? `provider:${params.venueId}`,
    latitude: 37.33 + params.index * 0.001,
    longitude: -121.89 - params.index * 0.001,
    address: `${100 + params.index} A3 Fixture Way, San Jose, CA`,
    role: params.role,
    stopIndex: params.index,
    venueId: params.venueId,
    title: titleForRole(params.role),
    subtitle: `${params.displayName} A3 runtime stop`,
    neighborhood: 'San Jose',
    driveMinutes: 6,
    imageUrl: params.imageUrl ?? `https://example.invalid/${params.venueId || params.providerRecordId}.jpg`,
  }
}

function buildRuntimeRoute(params: {
  routeId?: string
  directionId?: string
  persona?: PersonaMode
  vibe?: VibeAnchor
  stopOverrides?: Partial<
    Record<
      Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>,
      Partial<RuntimeRouteStop>
    >
  >
} = {}): RuntimeRouteArtifact {
  const stops = coreRoles().map((role, index) => {
    const base = buildRuntimeStop({
      role,
      index,
      venueId: ROUTE_IDS[role],
      displayName: ROUTE_NAMES[role],
      providerRecordId: PROVIDER_IDS[role],
    })
    return {
      ...base,
      ...(params.stopOverrides?.[role] ?? {}),
    }
  })
  return {
    routeId: params.routeId ?? 'runtime-route:a3:willow-court',
    selectedDirectionId: params.directionId ?? DIRECTION_ID,
    location: 'San Jose',
    persona: params.persona ?? 'romantic',
    vibe: params.vibe ?? 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'A3 Willow Court Route',
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
    updatedAt: 1_787_000_000_000,
  }
}

function buildArtifact(params: {
  id?: string
  directionId?: string
  supportIds?: 'canonical' | 'provider' | 'none'
  anchorRole?: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  runtimeRouteArtifact?: RuntimeRouteArtifact
  runtimeEligible?: boolean
  greatStopStatus?: 'PASS' | 'FAIL'
  validationStatus?: 'valid' | 'incomplete' | 'rejected'
} = {}): ContractEntryArtifact {
  const supportIds = params.supportIds ?? 'canonical'
  const support = coreRoles().map((role) => ({
    role,
    name: ROUTE_NAMES[role],
    ...(supportIds === 'canonical'
      ? { venueId: ROUTE_IDS[role] }
      : supportIds === 'provider'
        ? { venueId: PROVIDER_IDS[role] }
        : {}),
  }))

  return {
    id: params.id ?? ARTIFACT_ID,
    sourceOpportunityId: 'opportunity:a3:willow-court',
    sourceMode: 'curated',
    anchorVenueId: ROUTE_IDS.highlight,
    ...(params.anchorRole !== undefined ? { anchorRole: params.anchorRole } : { anchorRole: 'highlight' }),
    anchorName: ROUTE_NAMES.highlight,
    routeTitle: 'A3 Willow Court Route',
    flavorLine: 'Provider-free routeAuthority characterization.',
    routeSummary: CONFIRMATION,
    traits: ['a3', 'authority', 'characterization'],
    storySpine: {
      start: ROUTE_NAMES.start,
      highlight: ROUTE_NAMES.highlight,
      windDown: ROUTE_NAMES.windDown,
    },
    districtLine: 'San Jose',
    districtAnchorLine: `Anchor: ${ROUTE_NAMES.highlight}`,
    authorityLine: 'A3 provider-free authority characterization.',
    whyChooseLine: 'The route has deterministic canonical stop identity.',
    whyTonightProofLine: 'Local proof only.',
    selection: {
      directionId: params.directionId ?? DIRECTION_ID,
      pocketId: 'a3:willow-court',
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
        anchorVenueId: ROUTE_IDS.highlight,
        anchorName: ROUTE_NAMES.highlight,
      },
      conciergeIntentSummary: {
        planningMode: 'curate',
        primaryVibe: 'cozy',
        persona: 'romantic',
        summary: 'A3 routeAuthority characterization fixture.',
      },
      tasteDistrictSummary: {
        tasteProfileId: 'a3',
        districtId: 'a3:willow-court',
        districtLabel: 'San Jose',
        summary: 'A3 deterministic route.',
      },
      fieldProvenanceSummary: {
        sourceMode: 'curated',
        provider: 'static-corpus',
        liveProviderUsed: false,
        corpusUsed: true,
        calibrationOnly: false,
        candidateCount: 3,
        queryLabels: [],
        provenanceId: 'a3-local-fixture',
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: 'bearings:a3',
        summary: 'Canonical fixture roles are admitted.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'waypoint:a3',
        summary: CONFIRMATION,
      },
      canonicalRouteRoleCoverage: {
        start: ROUTE_NAMES.start,
        highlight: ROUTE_NAMES.highlight,
        windDown: ROUTE_NAMES.windDown,
        support,
      },
      validationStatus: params.validationStatus ?? 'valid',
      rejectionReasons: [],
      starterContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'a3:curate',
        rejectionReasons: [],
      },
      modeContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'mode:curate',
        rejectionReasons: [],
      },
      runtimeLockEligibility: {
        eligible: params.runtimeEligible ?? true,
        status: params.runtimeEligible === false ? 'ineligible' : 'eligible',
        selectedDirectionId: params.directionId ?? DIRECTION_ID,
        rejectionReasons: params.runtimeEligible === false ? ['a3_runtime_ineligible_fixture'] : [],
        ...(params.greatStopStatus ? { greatStopStatus: params.greatStopStatus } : {}),
        ...(params.runtimeRouteArtifact ? { runtimeRouteArtifact: params.runtimeRouteArtifact } : {}),
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

function selectedRouteArtifact(finalRoute: RuntimeRouteArtifact): {
  source: string
  directionId: string
  candidateArtifactId: string
  canonicalRouteArtifact: { finalRoute: RuntimeRouteArtifact }
} {
  return {
    source: 'legacy_selected_route_artifact',
    directionId: finalRoute.selectedDirectionId,
    candidateArtifactId: ARTIFACT_ID,
    canonicalRouteArtifact: {
      finalRoute,
    },
  }
}

function sourceByKind(
  snapshot: RouteAuthoritySnapshot,
  kind: RouteAuthorityObservedSource['kind'],
): RouteAuthorityObservedSource {
  const source = snapshot.observedSources.find((candidate) => candidate.kind === kind)
  assert(source, `missing observed source ${kind}`)
  return source
}

function routeStopIds(route: RuntimeRouteArtifact | null | undefined): string[] {
  return (
    route?.stops
      .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => stop.venueId || stop.providerRecordId || stop.sourceStopId || 'missing_identity') ?? []
  )
}

function routeOrder(route: RuntimeRouteArtifact | null | undefined): string[] {
  return (
    route?.stops
      .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => stop.role) ?? []
  )
}

function routeIdentity(route: RuntimeRouteArtifact | null | undefined): string | null {
  if (!route) {
    return null
  }
  return `${route.routeId}|${route.selectedDirectionId}|${routeStopIds(route).join('>')}`
}

function sameRoute(left: RuntimeRouteArtifact | null | undefined, right: RuntimeRouteArtifact | null | undefined): boolean {
  return routeIdentity(left) === routeIdentity(right) && routeOrder(left).join('|') === routeOrder(right).join('|')
}

function equalityLabel(left: RuntimeRouteArtifact | null | undefined, right: RuntimeRouteArtifact | null | undefined): RouteTruthEquality {
  if (!left || !right) {
    return 'NOT COVERED'
  }
  return sameRoute(left, right) ? 'EXACT EQUALITY' : 'AUTHORITY SUBSTITUTION'
}

function snapshotLedger(params: {
  scenario: string
  mode: AuthorityLedgerRow['mode']
  producingLayer: string
  incomingCarrier: string
  input: BuildRouteAuthoritySnapshotInput
  incomingRoute: RuntimeRouteArtifact | null
  incomingApprovalState: string
  greatStopState: AuthorityLedgerRow['greatStopState']
  fallbackEvaluated: string[]
  fallbackTaken: string[]
  comparisonKey: string
  downstreamConsumer: string
  reviewEligibility?: boolean | 'not_evaluated'
  artifactResult?: string
  mutationOrRepairObserved?: string
  reviewedRoute?: RuntimeRouteArtifact | null
  savedReturnedRoute?: RuntimeRouteArtifact | null
}): AuthorityLedgerRow {
  const snapshot = buildRouteAuthoritySnapshot(params.input)
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  const outputRoute = lockInput.ok ? lockInput.input.canonicalRouteArtifact.finalRoute : snapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute ?? null
  return {
    scenario: params.scenario,
    mode: params.mode,
    producingLayer: params.producingLayer,
    incomingCarrier: params.incomingCarrier,
    incomingRouteIdentity: routeIdentity(params.incomingRoute),
    incomingStopIdentities: routeStopIds(params.incomingRoute),
    incomingApprovalState: params.incomingApprovalState,
    greatStopState: params.greatStopState,
    routeAuthorityInputSelected: snapshot.lockReadyCanonicalRouteTruthCandidate?.source ?? null,
    fallbackEvaluated: params.fallbackEvaluated,
    fallbackTaken: params.fallbackTaken,
    comparisonKey: params.comparisonKey,
    identityBefore: routeStopIds(params.incomingRoute),
    identityAfter: routeStopIds(outputRoute),
    routeOrderBefore: routeOrder(params.incomingRoute),
    routeOrderAfter: routeOrder(outputRoute),
    outputCarrier: lockInput.ok ? 'RouteAuthorityLockInputResult.ok' : 'RouteAuthoritySnapshot',
    downstreamConsumer: params.downstreamConsumer,
    reviewEligibility: params.reviewEligibility ?? 'not_evaluated',
    lockEligibility: lockInput.ok,
    artifactResult: params.artifactResult ?? snapshot.validationStatus,
    mutationOrRepairObserved: params.mutationOrRepairObserved ?? 'none',
    reviewedRouteEqualsLockedRoute: equalityLabel(params.reviewedRoute ?? params.incomingRoute, outputRoute),
    lockedRouteEqualsSavedReturnedRoute: params.savedReturnedRoute
      ? equalityLabel(outputRoute, params.savedReturnedRoute)
      : 'NOT COVERED',
  }
}

function assertCanonicalSource(snapshot: RouteAuthoritySnapshot, source: string): void {
  assert.equal(snapshot.lockReadyCanonicalRouteTruthCandidate?.source, source)
  assert.equal(snapshot.validationStatus, 'valid')
}

function assertRouteIds(actual: string[], expected: string[], label: string): void {
  assert.deepEqual(actual, expected, `${label}: route IDs mismatch`)
}

function assertSourceTrace(): void {
  const routeAuthoritySource = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
  assert(routeAuthoritySource.includes('return nonEmpty(stop.venueId) ?? nonEmpty(stop.providerRecordId) ?? nonEmpty(stop.sourceStopId)'))
  assert(routeAuthoritySource.includes('return unique([stop.venueId, stop.providerRecordId, stop.sourceStopId])'))
  assert(routeAuthoritySource.includes('const expectedName = normalizeText(expected.displayName)'))
  assert(routeAuthoritySource.includes('approvedPayloadRouteCanonical'))
  assert(routeAuthoritySource.includes('legacy_sources_cannot_author_lock_ready_truth'))
  assert(routeAuthoritySource.includes('sharedFallbackImageUrl'))

  const sandboxSource = readFileSync('src/app/services/sandbox/canonicalRouteArtifactService.ts', 'utf8')
  assert(sandboxSource.includes('input.isBuildWrapperActive'))
  assert(sandboxSource.includes('routeAuthorityFinalRoute'))
  assert(sandboxSource.includes('renderOnlyFinalRoute'))
}

function run(): void {
  installMemoryWindow()
  assertSourceTrace()

  const itinerary = buildItinerary()
  const runtimeRoute = buildRuntimeRoute()
  const artifact = buildArtifact({ runtimeRouteArtifact: runtimeRoute, greatStopStatus: 'PASS' })
  const artifactValidation = validateContractEntryArtifactPreCommitTruth(artifact, { requireEnrichment: true })
  assert.equal(artifactValidation.status, 'valid')
  assert.deepEqual(deriveContractEntryArtifactRoleCoverage(artifact), ROUTE_NAMES)

  const canonicalSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    runtimeRouteArtifact: runtimeRoute,
    approvedPayload: approvedPayload(runtimeRoute),
    legacyCurateRefinementEntryPayload: approvedPayload(runtimeRoute),
    legacySelectedRouteArtifact: selectedRouteArtifact(runtimeRoute),
    pageLocalFinalRoute: runtimeRoute,
    selectedDirectionId: DIRECTION_ID,
    selectedArtifactId: ARTIFACT_ID,
    greatStopStatus: 'PASS',
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  })
  assertCanonicalSource(canonicalSnapshot, 'contract_entry_artifact.runtime_route_artifact')
  assertRouteIds(canonicalSnapshot.canonicalRouteIds, Object.values(ROUTE_IDS), 'canonical snapshot')
  assert.equal(sourceByKind(canonicalSnapshot, 'approved_payload').classification, 'validated_compatibility')
  assert.equal(sourceByKind(canonicalSnapshot, 'legacy_curate_refinement_entry_payload').classification, 'legacy_compatibility')
  assert.equal(sourceByKind(canonicalSnapshot, 'legacy_selected_route_artifact').classification, 'legacy_compatibility')
  assert.equal(sourceByKind(canonicalSnapshot, 'page_local_final_route').classification, 'page_local_authoring')

  const canonicalLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: canonicalSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(canonicalLockInput.ok, 'canonical routeAuthority lock input should be available')
  assertRouteIds(
    routeStopIds(canonicalLockInput.input.canonicalRouteArtifact.finalRoute),
    Object.values(ROUTE_IDS),
    'canonical lock input',
  )

  const livePayload = buildLockedLiveArtifactPayload({
    ...canonicalLockInput.input,
    sessionId: 'a3-lock-session',
    lockedAt: 1,
  })
  const livePayloadValidation = validateLockedLiveArtifactSessionPayload(livePayload)
  assert.equal(livePayloadValidation.ok, true)
  const sanitizedPayload = sanitizeLiveArtifactSessionPayload(livePayload)
  assert(sanitizedPayload?.finalRoute)
  const sanitizedFinalRoute = sanitizedPayload.finalRoute
  assert(sameRoute(sanitizedFinalRoute, runtimeRoute))
  const saveResult = saveLockedLiveArtifactSession({
    ...canonicalLockInput.input,
    sessionId: 'a3-lock-session',
    lockedAt: 1,
  })
  assert.equal(saveResult.ok, true)
  const returnedSession = loadLiveArtifactSession()
  assert(returnedSession?.finalRoute)
  const returnedSessionFinalRoute = returnedSession.finalRoute
  assert(sameRoute(returnedSessionFinalRoute, runtimeRoute))
  saveSharedLiveArtifactPlan('a3-shared-plan', livePayload)
  const returnedPlan = loadSharedLiveArtifactPlan('a3-shared-plan')
  assert(returnedPlan?.finalRoute)
  const returnedPlanFinalRoute = returnedPlan.finalRoute
  assert(sameRoute(returnedPlanFinalRoute, runtimeRoute))
  const lceContract = buildLceRuntimeContract({
    source: 'a3-route-authority-characterization',
    mutationKind: 'continuation',
    phase: 'confirm',
    runtimeRouteArtifact: runtimeRoute,
    userConfirmed: true,
  })
  assert(sameRoute(lceContract.route, runtimeRoute))
  assert.equal(assertLceRuntimeMutationMayCommit(lceContract).ok, true)

  const approvedOnlyArtifact = buildArtifact({ supportIds: 'canonical', greatStopStatus: 'PASS' })
  const approvedSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: approvedOnlyArtifact,
    approvedPayload: approvedPayload(runtimeRoute),
    selectedDirectionId: DIRECTION_ID,
    selectedArtifactId: ARTIFACT_ID,
    greatStopStatus: 'PASS',
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  })
  assertCanonicalSource(approvedSnapshot, 'contract_entry_artifact.approved_payload')

  const staleRenderOnlyRoute = buildRuntimeRoute({
    routeId: 'runtime-route:a3:stale-render',
    directionId: DIRECTION_ID,
    stopOverrides: {
      highlight: {
        venueId: 'sj-stale-display-route',
        displayName: 'Stale Display Route',
      },
    },
  })
  const plan = {
    selectedDirectionContract: { id: DIRECTION_ID },
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  }
  const buildProjection = buildSandboxCanonicalRouteArtifact({
    plan,
    routeAuthorityFinalRoute: runtimeRoute,
    renderOnlyFinalRoute: staleRenderOnlyRoute,
    canonicalStopByRole: {
      start: { venueId: ROUTE_IDS.start },
      highlight: { venueId: ROUTE_IDS.highlight },
      windDown: { venueId: ROUTE_IDS.windDown },
    },
    isBuildWrapperActive: true,
  })
  assert(buildProjection)
  assert(sameRoute(buildProjection.finalRoute, runtimeRoute))
  assert(!sameRoute(buildProjection.finalRoute, staleRenderOnlyRoute))
  const planningDisplayStops = projectFinalRouteToPlanningDisplayStops(buildProjection)
  assert.deepEqual(
    planningDisplayStops.map((stop) => stop.venueId),
    Object.values(ROUTE_IDS),
  )

  const providerIdRoute = buildRuntimeRoute({
    routeId: 'runtime-route:a3:provider-id-fallback',
    stopOverrides: {
      start: { venueId: '', providerRecordId: PROVIDER_IDS.start },
      highlight: { venueId: '', providerRecordId: PROVIDER_IDS.highlight },
      windDown: { venueId: '', providerRecordId: PROVIDER_IDS.windDown },
    },
  })
  const providerIdArtifact = buildArtifact({
    id: 'contract-entry:a3:provider-id-fallback',
    supportIds: 'provider',
    runtimeRouteArtifact: providerIdRoute,
    greatStopStatus: 'PASS',
  })
  providerIdArtifact.anchorVenueId = PROVIDER_IDS.highlight
  providerIdArtifact.enrichment!.userInputContext!.anchorVenueId = PROVIDER_IDS.highlight
  const providerIdSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: providerIdArtifact,
    runtimeRouteArtifact: providerIdRoute,
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  })
  assert.equal(providerIdSnapshot.validationStatus, 'valid')
  assertRouteIds(providerIdSnapshot.canonicalRouteIds, Object.values(PROVIDER_IDS), 'provider-id fallback')

  const displayOnlyArtifact = buildArtifact({
    id: 'contract-entry:a3:display-name-fallback',
    supportIds: 'none',
    anchorRole: undefined,
    runtimeRouteArtifact: runtimeRoute,
    greatStopStatus: 'PASS',
  })
  delete displayOnlyArtifact.anchorRole
  const displayDriftRoute = buildRuntimeRoute({
    routeId: 'runtime-route:a3:display-name-fallback',
    stopOverrides: {
      start: { venueId: 'sj-different-start-same-name', displayName: ROUTE_NAMES.start },
      highlight: { venueId: 'sj-different-highlight-same-name', displayName: ROUTE_NAMES.highlight },
      windDown: { venueId: 'sj-different-winddown-same-name', displayName: ROUTE_NAMES.windDown },
    },
  })
  displayOnlyArtifact.enrichment!.runtimeLockEligibility!.runtimeRouteArtifact = displayDriftRoute
  const displaySnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: displayOnlyArtifact,
    runtimeRouteArtifact: displayDriftRoute,
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  })
  assert.equal(displaySnapshot.validationStatus, 'valid')
  assertRouteIds(
    displaySnapshot.canonicalRouteIds,
    ['sj-different-start-same-name', 'sj-different-highlight-same-name', 'sj-different-winddown-same-name'],
    'display-name fallback',
  )

  const sourceRepairRoute = buildRuntimeRoute({
    routeId: 'runtime-route:a3:source-repair',
    stopOverrides: {
      start: { sourceStopId: 'runtime-source:a3:start', imageUrl: '' },
      highlight: { sourceStopId: 'runtime-source:a3:highlight', imageUrl: '' },
      windDown: { sourceStopId: 'runtime-source:a3:windDown', imageUrl: '' },
    },
  })
  const sourceRepairSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: buildArtifact({ runtimeRouteArtifact: sourceRepairRoute }),
    runtimeRouteArtifact: sourceRepairRoute,
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  })
  const sourceRepairLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: sourceRepairSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(sourceRepairLockInput.ok, 'source repair lock input should be available')
  assert.deepEqual(
    sourceRepairLockInput.input.lockSafeItineraryStops.map((stop) => stop.id),
    ['runtime-source:a3:start', 'runtime-source:a3:highlight', 'runtime-source:a3:windDown'],
  )
  assert.deepEqual(
    sourceRepairLockInput.input.lockSafeItineraryStops.map((stop) => stop.venueId),
    Object.values(ROUTE_IDS),
  )

  const legacyOnlySnapshot = buildRouteAuthoritySnapshot({
    legacyCurateRefinementEntryPayload: approvedPayload(runtimeRoute),
    legacySelectedRouteArtifact: selectedRouteArtifact(runtimeRoute),
    pageLocalFinalRoute: runtimeRoute,
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  })
  const legacyOnlyInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: legacyOnlySnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert.equal(legacyOnlyInput.ok, false)
  assert(legacyOnlySnapshot.rejectionReasons.includes('legacy_sources_cannot_author_lock_ready_truth'))

  const rejectedSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: buildArtifact({ runtimeRouteArtifact: runtimeRoute, greatStopStatus: 'FAIL' }),
    runtimeRouteArtifact: runtimeRoute,
    greatStopStatus: 'FAIL',
    selectedClusterConfirmation: CONFIRMATION,
    itinerary,
  })
  const rejectedInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: rejectedSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert.equal(rejectedInput.ok, false)
  assert(rejectedSnapshot.rejectionReasons.includes('great_stop_failed'))
  const rejectedLifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: true,
    finalRoutePresent: true,
    runtimeRouteArtifactPresent: false,
    greatStopStatus: 'FAIL',
    routeAuthorityStatus: rejectedSnapshot.validationStatus,
    lockInputAvailable: false,
    reviewEligible: true,
    lockEligible: false,
  })
  assert.equal(rejectedLifecycle.reviewEligible, false)
  assert.equal(rejectedLifecycle.lockEligible, false)

  const reviewOnlySnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    runtimeRouteArtifact: runtimeRoute,
    selectedDirectionId: DIRECTION_ID,
    selectedArtifactId: ARTIFACT_ID,
    greatStopStatus: 'PASS',
    itinerary,
  })
  assert.equal(reviewOnlySnapshot.validationStatus, 'valid')
  const reviewOnlyInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: reviewOnlySnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert.equal(reviewOnlyInput.ok, false)
  assert.equal(reviewOnlyInput.diagnostics.rejectionReason, 'missing_selected_cluster_confirmation')
  const reviewOnlyLifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: true,
    finalRoutePresent: true,
    runtimeRouteArtifactPresent: false,
    greatStopStatus: 'PASS',
    routeAuthorityStatus: reviewOnlySnapshot.validationStatus,
    lockInputAvailable: false,
    reviewEligible: true,
    lockEligible: false,
  })
  assert.equal(reviewOnlyLifecycle.reviewEligible, true)
  assert.equal(reviewOnlyLifecycle.lockEligible, false)

  const authorityLedger: AuthorityLedgerRow[] = [
    snapshotLedger({
      scenario: 'canonical-runtime-authority',
      mode: 'curate',
      producingLayer: 'Waypoint/Application handoff',
      incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
      input: {
        contractEntryArtifact: artifact,
        runtimeRouteArtifact: runtimeRoute,
        approvedPayload: approvedPayload(runtimeRoute),
        legacyCurateRefinementEntryPayload: approvedPayload(runtimeRoute),
        legacySelectedRouteArtifact: selectedRouteArtifact(runtimeRoute),
        pageLocalFinalRoute: runtimeRoute,
        selectedDirectionId: DIRECTION_ID,
        selectedArtifactId: ARTIFACT_ID,
        greatStopStatus: 'PASS',
        selectedClusterConfirmation: CONFIRMATION,
        itinerary,
      },
      incomingRoute: runtimeRoute,
      incomingApprovalState: 'approved_runtime_truth',
      greatStopState: 'PASS',
      fallbackEvaluated: ['approved_payload', 'legacy_curate_refinement_entry_payload', 'legacy_selected_route_artifact', 'page_local_final_route'],
      fallbackTaken: [],
      comparisonKey: 'canonical venueId',
      downstreamConsumer: 'Review/Lock and liveSessionHandoff',
      reviewEligibility: true,
      reviewedRoute: runtimeRoute,
      savedReturnedRoute: returnedSessionFinalRoute,
    }),
    snapshotLedger({
      scenario: 'approved-payload-authority',
      mode: 'curate',
      producingLayer: 'Application approved payload compatibility',
      incomingCarrier: 'ContractEntryArtifact + approvedPayload.finalRoute',
      input: {
        contractEntryArtifact: approvedOnlyArtifact,
        approvedPayload: approvedPayload(runtimeRoute),
        selectedDirectionId: DIRECTION_ID,
        selectedArtifactId: ARTIFACT_ID,
        greatStopStatus: 'PASS',
        selectedClusterConfirmation: CONFIRMATION,
        itinerary,
      },
      incomingRoute: runtimeRoute,
      incomingApprovalState: 'approved_payload_present',
      greatStopState: 'PASS',
      fallbackEvaluated: ['approved_payload'],
      fallbackTaken: ['approvedPayloadRouteCanonical'],
      comparisonKey: 'artifact support venueId',
      downstreamConsumer: 'buildLockInputFromRouteAuthoritySnapshot',
      reviewEligibility: true,
    }),
    snapshotLedger({
      scenario: 'provider-source-stable-id-fallback',
      mode: 'compatibility',
      producingLayer: 'Malformed/compat RuntimeRouteArtifact-like input',
      incomingCarrier: 'RuntimeRouteArtifact with empty venueId and providerRecordId fallback',
      input: {
        contractEntryArtifact: providerIdArtifact,
        runtimeRouteArtifact: providerIdRoute,
        selectedClusterConfirmation: CONFIRMATION,
        itinerary,
      },
      incomingRoute: providerIdRoute,
      incomingApprovalState: 'ambiguous_runtime_identity',
      greatStopState: 'NOT_PROVIDED',
      fallbackEvaluated: ['firstStableStopId', 'stopStableIdCandidates'],
      fallbackTaken: ['providerRecordId'],
      comparisonKey: 'providerRecordId/sourceStopId stable fallback',
      downstreamConsumer: 'RouteAuthoritySnapshot.lockReadyCanonicalRouteTruthCandidate',
      reviewEligibility: 'not_evaluated',
      artifactResult: providerIdSnapshot.validationStatus,
      mutationOrRepairObserved: 'authority_identity_derived_from_providerRecordId',
    }),
    snapshotLedger({
      scenario: 'display-name-comparison-fallback',
      mode: 'compatibility',
      producingLayer: 'ContractEntryArtifact with missing role venue IDs',
      incomingCarrier: 'ContractEntryArtifact storySpine + RuntimeRouteArtifact',
      input: {
        contractEntryArtifact: displayOnlyArtifact,
        runtimeRouteArtifact: displayDriftRoute,
        selectedClusterConfirmation: CONFIRMATION,
        itinerary,
      },
      incomingRoute: displayDriftRoute,
      incomingApprovalState: 'artifact_identity_incomplete',
      greatStopState: 'NOT_PROVIDED',
      fallbackEvaluated: ['compareRouteToArtifact display-name branch'],
      fallbackTaken: ['displayName'],
      comparisonKey: 'normalized displayName',
      downstreamConsumer: 'RouteAuthoritySnapshot.lockReadyCanonicalRouteTruthCandidate',
      reviewEligibility: 'not_evaluated',
      artifactResult: displaySnapshot.validationStatus,
      mutationOrRepairObserved: 'authority_comparison_without_canonical_role_ids',
    }),
    snapshotLedger({
      scenario: 'legacy-and-page-local-only-non-authority',
      mode: 'compatibility',
      producingLayer: 'Application compatibility wrappers',
      incomingCarrier: 'legacy Curate payload + SelectedRouteArtifact + pageLocalFinalRoute',
      input: {
        legacyCurateRefinementEntryPayload: approvedPayload(runtimeRoute),
        legacySelectedRouteArtifact: selectedRouteArtifact(runtimeRoute),
        pageLocalFinalRoute: runtimeRoute,
        selectedClusterConfirmation: CONFIRMATION,
        itinerary,
      },
      incomingRoute: runtimeRoute,
      incomingApprovalState: 'compatibility_only',
      greatStopState: 'NOT_PROVIDED',
      fallbackEvaluated: ['legacy_curate_refinement_entry_payload', 'legacy_selected_route_artifact', 'page_local_final_route'],
      fallbackTaken: [],
      comparisonKey: 'none_without_canonical_authority',
      downstreamConsumer: 'routeAuthority diagnostics',
      reviewEligibility: false,
      artifactResult: legacyOnlySnapshot.validationStatus,
    }),
    snapshotLedger({
      scenario: 'great-stop-rejected-before-lock',
      mode: 'curate',
      producingLayer: 'Great Stop / routeAuthority gate',
      incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact + Great Stop FAIL',
      input: {
        contractEntryArtifact: buildArtifact({ runtimeRouteArtifact: runtimeRoute, greatStopStatus: 'FAIL' }),
        runtimeRouteArtifact: runtimeRoute,
        greatStopStatus: 'FAIL',
        selectedClusterConfirmation: CONFIRMATION,
        itinerary,
      },
      incomingRoute: runtimeRoute,
      incomingApprovalState: 'great_stop_failed',
      greatStopState: 'FAIL',
      fallbackEvaluated: [],
      fallbackTaken: [],
      comparisonKey: 'canonical venueId, then Great Stop rejection',
      downstreamConsumer: 'routeRecommendationLifecycle',
      reviewEligibility: rejectedLifecycle.reviewEligible,
      artifactResult: rejectedSnapshot.validationStatus,
    }),
    snapshotLedger({
      scenario: 'review-eligible-not-lockable',
      mode: 'curate',
      producingLayer: 'Application lifecycle',
      incomingCarrier: 'valid routeAuthority snapshot missing selectedClusterConfirmation',
      input: {
        contractEntryArtifact: artifact,
        runtimeRouteArtifact: runtimeRoute,
        selectedDirectionId: DIRECTION_ID,
        selectedArtifactId: ARTIFACT_ID,
        greatStopStatus: 'PASS',
        itinerary,
      },
      incomingRoute: runtimeRoute,
      incomingApprovalState: 'review_generated_missing_lock_input',
      greatStopState: 'PASS',
      fallbackEvaluated: [],
      fallbackTaken: [],
      comparisonKey: 'canonical venueId',
      downstreamConsumer: 'routeRecommendationLifecycle',
      reviewEligibility: reviewOnlyLifecycle.reviewEligible,
      artifactResult: reviewOnlySnapshot.validationStatus,
    }),
  ]

  const equalityLedger: EqualityLedgerRow[] = [
    {
      scenario: 'review-lock-save-return-live-lce',
      generatedCandidateRoute: routeStopIds(runtimeRoute),
      approvedRoute: routeStopIds(canonicalSnapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute),
      reviewedRoute: routeStopIds(runtimeRoute),
      lockedRoute: routeStopIds(canonicalLockInput.input.canonicalRouteArtifact.finalRoute),
      runtimeRouteArtifactRoute: routeStopIds(runtimeRoute),
      savedRoute: routeStopIds(returnedSessionFinalRoute),
      returnedPlansRoute: routeStopIds(returnedPlanFinalRoute),
      liveRoute: routeStopIds(sanitizedFinalRoute),
      lceRoute: routeStopIds(lceContract.route),
      result: 'EXACT EQUALITY',
      reason: 'All compared carriers preserve exact stable IDs and role order.',
    },
    {
      scenario: 'build-render-only-projection',
      generatedCandidateRoute: routeStopIds(staleRenderOnlyRoute),
      approvedRoute: routeStopIds(runtimeRoute),
      reviewedRoute: routeStopIds(buildProjection.finalRoute),
      lockedRoute: routeStopIds(runtimeRoute),
      runtimeRouteArtifactRoute: routeStopIds(runtimeRoute),
      savedRoute: [],
      returnedPlansRoute: [],
      liveRoute: [],
      lceRoute: [],
      result: 'REPAIR WITHOUT AUTHORITY CHANGE',
      reason: 'Sandbox projection uses routeAuthorityFinalRoute instead of stale renderOnlyFinalRoute.',
    },
    {
      scenario: 'provider-source-stable-id-fallback',
      generatedCandidateRoute: routeStopIds(providerIdRoute),
      approvedRoute: routeStopIds(providerIdSnapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute),
      reviewedRoute: [],
      lockedRoute: [],
      runtimeRouteArtifactRoute: routeStopIds(providerIdRoute),
      savedRoute: [],
      returnedPlansRoute: [],
      liveRoute: [],
      lceRoute: [],
      result: 'AUTHORITY SUBSTITUTION',
      reason: 'Empty venueId allows providerRecordId to become routeAuthority canonicalRouteIds.',
    },
    {
      scenario: 'display-name-comparison-fallback',
      generatedCandidateRoute: Object.values(ROUTE_IDS),
      approvedRoute: routeStopIds(displaySnapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute),
      reviewedRoute: [],
      lockedRoute: [],
      runtimeRouteArtifactRoute: routeStopIds(displayDriftRoute),
      savedRoute: [],
      returnedPlansRoute: [],
      liveRoute: [],
      lceRoute: [],
      result: 'AUTHORITY SUBSTITUTION',
      reason: 'Artifact lacks role venue IDs, so routeAuthority accepts same display names with different venue IDs.',
    },
  ]

  const fallbackLedger: FallbackLedgerRow[] = [
    {
      fallback: 'ACTIVE AUTHORITY',
      file: 'src/app/services/routeAuthority/routeAuthorityService.ts',
      symbol: 'firstStableStopId / stopStableIdCandidates',
      producer: 'RuntimeRouteArtifact-like stop with empty venueId',
      consumer: 'routeIds, compareRouteToArtifact, compareRoutesByStableIds',
      triggerCondition: 'RuntimeRouteStop.venueId is empty or absent while providerRecordId/sourceStopId is present.',
      selectedValue: 'providerRecordId',
      authorityBefore: 'intended canonical venueId',
      authorityAfter: 'providerRecordId/sourceStopId can define routeAuthority canonicalRouteIds',
      routeTruthChanges: true,
      identityChanges: true,
      eligibilityChanges: true,
      artifactMaterializationChanges: false,
      reviewLockEqualityCanChange: true,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before any correction',
    },
    {
      fallback: 'ACTIVE AUTHORITY',
      file: 'src/app/services/routeAuthority/routeAuthorityService.ts',
      symbol: 'compareRouteToArtifact displayName branch',
      producer: 'ContractEntryArtifact with missing role venue IDs',
      consumer: 'routeAuthority runtime/artifact comparison',
      triggerCondition: 'Artifact role identity lacks canonical id but has displayName.',
      selectedValue: 'normalized displayName',
      authorityBefore: 'artifact role coverage without canonical physical identity',
      authorityAfter: 'same display names can validate different runtime venue IDs',
      routeTruthChanges: true,
      identityChanges: true,
      eligibilityChanges: true,
      artifactMaterializationChanges: false,
      reviewLockEqualityCanChange: true,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before any correction',
    },
    {
      fallback: 'ACTIVE AUTHORITY',
      file: 'src/app/services/routeAuthority/routeAuthorityService.ts',
      symbol: 'approvedPayloadRouteCanonical',
      producer: 'approvedPayload.finalRoute',
      consumer: 'lockReadyCanonicalRouteTruthCandidate',
      triggerCondition: 'No RuntimeRouteArtifact is present, ContractEntryArtifact exists, and approved payload matches artifact.',
      selectedValue: 'approvedPayload.finalRoute',
      authorityBefore: 'ContractEntryArtifact pre-commit truth',
      authorityAfter: 'contract_entry_artifact.approved_payload lock input source',
      routeTruthChanges: false,
      identityChanges: false,
      eligibilityChanges: true,
      artifactMaterializationChanges: false,
      reviewLockEqualityCanChange: false,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before any removal',
    },
    {
      fallback: 'DEFENSIVE COMPATIBILITY',
      file: 'src/app/services/routeAuthority/routeAuthorityService.ts',
      symbol: 'legacyCurateRefinementEntryPayload',
      producer: 'legacy Curate wrapper',
      consumer: 'observedSources diagnostics',
      triggerCondition: 'Legacy Curate finalRoute present.',
      selectedValue: 'legacy finalRoute diagnostics only',
      authorityBefore: 'canonical artifact/runtime route',
      authorityAfter: 'unchanged unless no canonical authority, then lock is blocked',
      routeTruthChanges: false,
      identityChanges: false,
      eligibilityChanges: false,
      artifactMaterializationChanges: false,
      reviewLockEqualityCanChange: false,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before compatibility removal',
    },
    {
      fallback: 'DEFENSIVE COMPATIBILITY',
      file: 'src/app/services/routeAuthority/routeAuthorityService.ts',
      symbol: 'legacySelectedRouteArtifact',
      producer: 'SelectedRouteArtifact compatibility wrapper',
      consumer: 'observedSources diagnostics',
      triggerCondition: 'Legacy selected-route wrapper present.',
      selectedValue: 'canonicalRouteArtifact.finalRoute diagnostics only',
      authorityBefore: 'canonical artifact/runtime route',
      authorityAfter: 'unchanged unless no canonical authority, then lock is blocked',
      routeTruthChanges: false,
      identityChanges: false,
      eligibilityChanges: false,
      artifactMaterializationChanges: false,
      reviewLockEqualityCanChange: false,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before compatibility removal',
    },
    {
      fallback: 'DEFENSIVE COMPATIBILITY',
      file: 'src/app/services/routeAuthority/routeAuthorityService.ts',
      symbol: 'pageLocalFinalRoute',
      producer: 'Application page-local finalRoute projection',
      consumer: 'observedSources diagnostics',
      triggerCondition: 'Page-local finalRoute present.',
      selectedValue: 'page local route diagnostics only',
      authorityBefore: 'canonical artifact/runtime route',
      authorityAfter: 'unchanged unless no canonical authority, then lock is blocked',
      routeTruthChanges: false,
      identityChanges: false,
      eligibilityChanges: false,
      artifactMaterializationChanges: false,
      reviewLockEqualityCanChange: false,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before compatibility removal',
    },
    {
      fallback: 'APPLICATION REPAIR',
      file: 'src/app/services/routeAuthority/routeAuthorityService.ts',
      symbol: 'buildLockSafeItineraryStops',
      producer: 'RuntimeRouteArtifact finalRoute + itinerary',
      consumer: 'liveSessionHandoff lockSafeItineraryStops',
      triggerCondition: 'finalRoute.sourceStopId does not match itinerary stop id; index/role fallback finds companion.',
      selectedValue: 'finalRoute venueId/displayName/sourceStopId with itinerary details',
      authorityBefore: 'RuntimeRouteArtifact finalRoute',
      authorityAfter: 'unchanged finalRoute; repaired lock-safe itinerary projection',
      routeTruthChanges: false,
      identityChanges: false,
      eligibilityChanges: false,
      artifactMaterializationChanges: true,
      reviewLockEqualityCanChange: false,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before lock projection change',
    },
    {
      fallback: 'APPLICATION REPAIR',
      file: 'src/app/services/sandbox/canonicalRouteArtifactService.ts',
      symbol: 'buildSandboxCanonicalRouteArtifact',
      producer: 'Sandbox routeAuthorityFinalRoute + renderOnlyFinalRoute',
      consumer: 'Sandbox canonical route artifact and planning display projection',
      triggerCondition: 'Build wrapper active and renderOnlyFinalRoute differs from routeAuthorityFinalRoute.',
      selectedValue: 'routeAuthorityFinalRoute',
      authorityBefore: 'routeAuthorityFinalRoute',
      authorityAfter: 'unchanged canonical route; stale render-only route is not promoted',
      routeTruthChanges: false,
      identityChanges: false,
      eligibilityChanges: false,
      artifactMaterializationChanges: true,
      reviewLockEqualityCanChange: false,
      removalWouldBeBehaviorChanging: true,
      bigWireApprovalStatus: 'required before Application projection change',
    },
  ]

  const nonCoverage = [
    {
      condition: 'real governed-live provider routeAuthority path',
      whyNotCovered: 'Provider calls are forbidden in A3-1.',
      currentA3RequiresIt: false,
      laterProofLane: 'governed provider proof',
      blocksA3Ruling: false,
    },
    {
      condition: 'browser-rendered Review/Reveal UI equality',
      whyNotCovered: 'A3-1 uses canonical carriers and local services, not rendered UI.',
      currentA3RequiresIt: false,
      laterProofLane: 'Application/Review UI proof',
      blocksA3Ruling: false,
    },
    {
      condition: 'full Plans Hub browser return',
      whyNotCovered: 'Local storage payload continuity is covered; browser navigation is outside provider-free script scope.',
      currentA3RequiresIt: false,
      laterProofLane: 'Application save/session/Plans proof',
      blocksA3Ruling: false,
    },
    {
      condition: 'live nearby/swap provider replacement',
      whyNotCovered: 'LCE route consumption is covered; provider-backed runtime replacement is Stage 2G/governed-live scope.',
      currentA3RequiresIt: false,
      laterProofLane: 'Stage 2G / LCE live identity decision',
      blocksA3Ruling: false,
    },
  ]

  const result = {
    status: 'PASS',
    judgment: 'A3 AUTHORITY PATHS CHARACTERIZED - MULTIPLE AUTHORITY SEAMS REQUIRE C-SUITE RULING',
    nextDecision: 'MULTIPLE AUTHORITY CHANGES REQUIRE ARCHITECTURE RULING',
    providerCallsAttempted: fetchCalls.length,
    systemTopology: {
      preAuthority:
        'Field source/provenance -> Interpretation canonical physical identity -> Bearings route-bearing admission -> Waypoint candidate/route coordination -> Great Stop verdict -> routeAuthority',
      artifactSpine: 'ContractEntryArtifact -> approvedPayload/runtimeRouteArtifact -> routeAuthority -> lock input -> Live/Plans/LCE',
      lifecycle: 'generation -> Review/Reveal -> approval -> Lock -> save/session -> Plans return -> Live/LCE consumption',
      applicationConsumers: ['Curate', 'Build', 'Sandbox', 'compatibility wrappers', 'Review/Lock', 'Live/LCE'],
    },
    authorityLedger,
    equalityLedger,
    fallbackLedger,
    approvedPayloadAuthority: {
      source: approvedSnapshot.lockReadyCanonicalRouteTruthCandidate?.source,
      validationStatus: approvedSnapshot.validationStatus,
      routeIds: approvedSnapshot.canonicalRouteIds,
      classification: 'ACTIVE AUTHORITY',
    },
    buildRenderOnlyProjection: {
      renderOnlyRouteIds: routeStopIds(staleRenderOnlyRoute),
      routeAuthorityRouteIds: routeStopIds(runtimeRoute),
      projectedRouteIds: routeStopIds(buildProjection.finalRoute),
      displayProjectionIds: planningDisplayStops.map((stop) => stop.venueId),
      result: 'REPAIR WITHOUT AUTHORITY CHANGE',
    },
    lockSafeItineraryRepair: {
      sourceRepairRouteIds: routeStopIds(sourceRepairRoute),
      lockSafeItineraryIds: sourceRepairLockInput.input.lockSafeItineraryStops.map((stop) => stop.id),
      lockSafeVenueIds: sourceRepairLockInput.input.lockSafeItineraryStops.map((stop) => stop.venueId),
      finalRouteIds: routeStopIds(sourceRepairLockInput.input.canonicalRouteArtifact.finalRoute),
      result: 'REPAIR WITHOUT AUTHORITY CHANGE',
    },
    continuity: {
      saveSessionOk: saveResult.ok,
      livePayloadValidation: livePayloadValidation.ok,
      sanitizedRouteIds: routeStopIds(sanitizedFinalRoute),
      loadedSessionRouteIds: routeStopIds(returnedSessionFinalRoute),
      sharedPlanRouteIds: routeStopIds(returnedPlanFinalRoute),
      lceRouteSource: lceContract.diagnostics.routeSource,
      lceMutationCommitAllowed: assertLceRuntimeMutationMayCommit(lceContract).ok,
    },
    codeConfirmedAuthorityGapInventory: [
      {
        gap: 'provider/source stable-ID fallback can become routeAuthority canonicalRouteIds when venueId is empty',
        firstCarrier: 'RuntimeRouteArtifact.stops[]',
        firstAmbiguousField: 'venueId',
        proofScenario: 'provider-source-stable-id-fallback',
      },
      {
        gap: 'display-name comparison can validate artifact/runtime equality when artifact role venue IDs are missing',
        firstCarrier: 'ContractEntryArtifact.enrichment.canonicalRouteRoleCoverage.support[]',
        firstAmbiguousField: 'venueId',
        proofScenario: 'display-name-comparison-fallback',
      },
      {
        gap: 'approvedPayload.finalRoute is a current lock-ready authority source when RuntimeRouteArtifact is absent',
        firstCarrier: 'BuildRouteAuthoritySnapshotInput.approvedPayload.finalRoute',
        firstAmbiguousField: 'approvedPayloadRouteCanonical',
        proofScenario: 'approved-payload-authority',
      },
    ],
    minimumA3ChangeMap: [],
    nonCoverage,
    protectedBehavior: {
      routeOutputMutationCausedByProof: false,
      artifactShapeChange: false,
      routeEligibilityChange: false,
      scoringOrRankingChange: false,
      waypointBehaviorChange: false,
      bearingsBehaviorChange: false,
      greatStopBehaviorChange: false,
      fallbackBehaviorChange: false,
      reviewLockBehaviorChange: false,
      saveSessionBehaviorChange: false,
      applicationBehaviorChange: false,
      lceBehaviorChange: false,
      providerActivity: false,
      fixtureOrCorpusWrites: false,
      hostedOrVercelActivity: false,
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
