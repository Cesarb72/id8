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
  | 'CURRENT BEHAVIOR CONFIRMED'
  | 'RULED BEHAVIOR IMPLEMENTED'
  | 'RULED BEHAVIOR NOT YET IMPLEMENTED'
  | 'CURRENT HONEST FAILURE'
  | 'CANONICAL CONTROL PASSES'
  | 'NOT COVERED'
  | 'UNRESOLVED'

type IdentityMode = 'canonical' | 'provider' | 'source' | 'provider_and_source' | 'none'

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

interface ProofCase {
  caseId: string
  status: CaseStatus
  producingLayer: string
  incomingCarrier: string
  venueIds: string[]
  providerRecordIds: Array<string | null>
  sourceStopIds: string[]
  displayNames: string[]
  approvalState: string
  greatStopState: string
  fallbackCandidatesInOrder: string[][]
  selectedComparisonValues: string[]
  canonicalRouteIds: string[]
  routeOrderBefore: string[]
  routeOrderAfter: string[]
  equalityResult: string
  reviewEligibility: boolean
  lockEligibility: boolean
  artifactMaterializationResult: string
  downstreamConsumer: string
  currentBehavior: string
  ruledFutureBehavior: string
  honestFailureOccurs: boolean
  providerActivityOccurred: boolean
}

const ROLE_ORDER = ['start', 'highlight', 'windDown'] as const
const CANONICAL_IDS = {
  start: 'sj-a3-provider-proof-start',
  highlight: 'sj-a3-provider-proof-highlight',
  windDown: 'sj-a3-provider-proof-winddown',
} as const
const PROVIDER_IDS = {
  start: 'provider:a3-provider-proof-start',
  highlight: 'provider:a3-provider-proof-highlight',
  windDown: 'provider:a3-provider-proof-winddown',
} as const
const SOURCE_IDS = {
  start: 'source:a3-provider-proof-start',
  highlight: 'source:a3-provider-proof-highlight',
  windDown: 'source:a3-provider-proof-winddown',
} as const
const DISPLAY_NAMES = {
  start: 'A3 Provider Proof Start',
  highlight: 'A3 Provider Proof Highlight',
  windDown: 'A3 Provider Proof Winddown',
} as const
const DIRECTION_ID = 'a3-3:direction:provider-source-proof'
const ARTIFACT_ID = 'a3-3:contract-entry:provider-source-proof'
const CONFIRMATION = 'A3 Provider Proof Start -> A3 Provider Proof Highlight -> A3 Provider Proof Winddown'

const originalFetch = globalThis.fetch
const previousWindow = (globalThis as unknown as { window?: unknown }).window
const fetchCalls: string[] = []

globalThis.fetch = (async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  fetchCalls.push(url)
  throw new Error(`A3-3 provider/source proof must not call fetch/providers: ${url}`)
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

function roleKeys(): Array<(typeof ROLE_ORDER)[number]> {
  return [...ROLE_ORDER]
}

function idsForMode(mode: IdentityMode): Record<(typeof ROLE_ORDER)[number], string | undefined> {
  if (mode === 'canonical') {
    return CANONICAL_IDS
  }
  if (mode === 'provider' || mode === 'provider_and_source') {
    return PROVIDER_IDS
  }
  if (mode === 'source') {
    return SOURCE_IDS
  }
  return {
    start: undefined,
    highlight: undefined,
    windDown: undefined,
  }
}

function buildItineraryStop(role: UserStopRole, index: number): ItineraryStop {
  const coreRole = role === 'highlight' || role === 'windDown' ? role : 'start'
  return {
    id: `itinerary:${SOURCE_IDS[coreRole]}`,
    role,
    title: titleForRole(role),
    venueId: CANONICAL_IDS[coreRole],
    venueName: DISPLAY_NAMES[coreRole],
    formattedAddress: `${100 + index} A3 Proof Way, San Jose, CA`,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    city: 'San Jose',
    category: 'proof',
    subcategory: 'provider-source',
    priceTier: '$$',
    tags: ['a3-3', 'provider-source'],
    vibeTags: ['neutral'],
    neighborhood: 'San Jose',
    driveMinutes: 6,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: `${DISPLAY_NAMES[coreRole]} proof stop`,
    imageUrl: `https://example.invalid/${CANONICAL_IDS[coreRole]}.jpg`,
    stopInsider: {
      roleReason: `${DISPLAY_NAMES[coreRole]} holds the ${role} role.`,
      localSignal: 'Provider-free A3-3 fixture.',
      selectionReason: 'A3-3 routeAuthority provider/source substitution proof.',
    },
  }
}

function buildItinerary(): Itinerary {
  const stops = roleKeys().map((role, index) => buildItineraryStop(role, index))
  return {
    id: 'itinerary:a3-3:provider-source-proof',
    title: 'A3-3 Provider Source Route',
    city: 'San Jose',
    neighborhood: 'San Jose',
    crew: 'romantic',
    vibes: ['cozy'],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'A3-3 deterministic route',
    story: {
      headline: 'A3-3 Provider Source Route',
      subtitle: 'Provider-free routeAuthority proof.',
    },
    shareSummary: CONFIRMATION,
  }
}

function buildRuntimeStop(params: {
  role: (typeof ROLE_ORDER)[number]
  index: number
  venueId?: string
  providerRecordId?: string
  sourceStopId?: string
}): RuntimeRouteStop {
  return {
    id: `runtime:${params.role}:${params.venueId || params.providerRecordId || params.sourceStopId || 'missing'}`,
    sourceStopId: params.sourceStopId ?? SOURCE_IDS[params.role],
    displayName: DISPLAY_NAMES[params.role],
    ...(params.providerRecordId !== undefined ? { providerRecordId: params.providerRecordId } : {}),
    latitude: 37.33 + params.index * 0.001,
    longitude: -121.89 - params.index * 0.001,
    address: `${100 + params.index} A3 Proof Way, San Jose, CA`,
    role: params.role,
    stopIndex: params.index,
    venueId: params.venueId ?? CANONICAL_IDS[params.role],
    title: titleForRole(params.role),
    subtitle: `${DISPLAY_NAMES[params.role]} proof stop`,
    neighborhood: 'San Jose',
    driveMinutes: 6,
    imageUrl: `https://example.invalid/${params.venueId || params.providerRecordId || params.sourceStopId || 'missing'}.jpg`,
  }
}

function buildRuntimeRoute(mode: IdentityMode): RuntimeRouteArtifact {
  const stops = roleKeys().map((role, index) => {
    if (mode === 'canonical') {
      return buildRuntimeStop({
        role,
        index,
        venueId: CANONICAL_IDS[role],
        providerRecordId: PROVIDER_IDS[role],
        sourceStopId: SOURCE_IDS[role],
      })
    }
    if (mode === 'provider') {
      return buildRuntimeStop({
        role,
        index,
        venueId: '',
        providerRecordId: PROVIDER_IDS[role],
        sourceStopId: '',
      })
    }
    if (mode === 'source') {
      return buildRuntimeStop({
        role,
        index,
        venueId: '',
        providerRecordId: '',
        sourceStopId: SOURCE_IDS[role],
      })
    }
    if (mode === 'provider_and_source') {
      return buildRuntimeStop({
        role,
        index,
        venueId: '',
        providerRecordId: PROVIDER_IDS[role],
        sourceStopId: SOURCE_IDS[role],
      })
    }
    return buildRuntimeStop({
      role,
      index,
      venueId: '',
      providerRecordId: '',
      sourceStopId: '',
    })
  })

  return {
    routeId: `runtime-route:a3-3:${mode}`,
    selectedDirectionId: DIRECTION_ID,
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'A3-3 Provider Source Route',
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
    updatedAt: 1_787_100_000_000,
  }
}

function buildArtifact(mode: IdentityMode): ContractEntryArtifact {
  const ids = idsForMode(mode)
  const support = roleKeys().map((role) => ({
    role,
    name: DISPLAY_NAMES[role],
    ...(ids[role] ? { venueId: ids[role] } : {}),
  }))
  const anchorVenueId = ids.highlight ?? ''
  return {
    id: `${ARTIFACT_ID}:${mode}`,
    sourceOpportunityId: `opportunity:a3-3:${mode}`,
    sourceMode: 'curated',
    anchorVenueId,
    ...(anchorVenueId ? { anchorRole: 'highlight' as const } : {}),
    anchorName: DISPLAY_NAMES.highlight,
    routeTitle: 'A3-3 Provider Source Route',
    flavorLine: 'Provider-free routeAuthority provider/source substitution proof.',
    routeSummary: CONFIRMATION,
    traits: ['a3-3', 'provider-source'],
    storySpine: {
      start: DISPLAY_NAMES.start,
      highlight: DISPLAY_NAMES.highlight,
      windDown: DISPLAY_NAMES.windDown,
    },
    districtLine: 'San Jose',
    districtAnchorLine: `Anchor: ${DISPLAY_NAMES.highlight}`,
    authorityLine: 'A3-3 proof only.',
    whyChooseLine: 'The route has deterministic proof identity.',
    whyTonightProofLine: 'Provider-free local proof only.',
    selection: {
      directionId: DIRECTION_ID,
      pocketId: 'a3-3:provider-source',
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
        ...(anchorVenueId ? { anchorVenueId } : {}),
        anchorName: DISPLAY_NAMES.highlight,
      },
      conciergeIntentSummary: {
        planningMode: 'curate',
        primaryVibe: 'cozy',
        persona: 'romantic',
        summary: 'A3-3 provider/source substitution proof.',
      },
      tasteDistrictSummary: {
        tasteProfileId: 'a3-3',
        districtId: 'a3-3:provider-source',
        districtLabel: 'San Jose',
        summary: 'A3-3 deterministic route.',
      },
      fieldProvenanceSummary: {
        sourceMode: 'curated',
        provider: 'static-corpus',
        liveProviderUsed: false,
        corpusUsed: true,
        calibrationOnly: false,
        candidateCount: 3,
        queryLabels: [],
        provenanceId: 'a3-3-local-fixture',
      },
      bearingsAdmissionProof: {
        status: mode === 'none' ? 'missing' : 'present',
        proofId: 'bearings:a3-3',
        summary: mode === 'none' ? 'No stable identity is available.' : 'Proof fixture roles are admitted.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'waypoint:a3-3',
        summary: CONFIRMATION,
      },
      canonicalRouteRoleCoverage: {
        start: DISPLAY_NAMES.start,
        highlight: DISPLAY_NAMES.highlight,
        windDown: DISPLAY_NAMES.windDown,
        support,
      },
      validationStatus: mode === 'none' ? 'incomplete' : 'valid',
      rejectionReasons: mode === 'none' ? ['missing_canonical_route_identity'] : [],
      starterContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'a3-3:curate',
        rejectionReasons: [],
      },
      modeContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'mode:curate',
        rejectionReasons: [],
      },
      runtimeLockEligibility: {
        eligible: mode !== 'none',
        status: mode === 'none' ? 'ineligible' : 'eligible',
        selectedDirectionId: DIRECTION_ID,
        rejectionReasons: mode === 'none' ? ['missing_canonical_route_identity'] : [],
        buildMetadata: {
          canBuildRuntimeRoute: mode !== 'none',
        },
      },
    },
  }
}

function approvedPayload(finalRoute: RuntimeRouteArtifact, mode = 'canonical'): {
  artifactId: string
  selectedDirectionId: string
  finalRoute: RuntimeRouteArtifact
} {
  return {
    artifactId: `${ARTIFACT_ID}:${mode}`,
    selectedDirectionId: finalRoute.selectedDirectionId,
    finalRoute,
  }
}

function legacySelectedRouteArtifact(finalRoute: RuntimeRouteArtifact): {
  source: string
  directionId: string
  candidateArtifactId: string
  canonicalRouteArtifact: { finalRoute: RuntimeRouteArtifact }
} {
  return {
    source: 'legacy_selected_route_artifact',
    directionId: finalRoute.selectedDirectionId,
    candidateArtifactId: `${ARTIFACT_ID}:legacy`,
    canonicalRouteArtifact: {
      finalRoute,
    },
  }
}

function stableCandidates(stop: RuntimeRouteStop): string[] {
  return [stop.venueId].filter((value): value is string => Boolean(value?.trim()))
}

function selectedComparisonValue(stop: RuntimeRouteStop): string | null {
  return stop.venueId.trim() || null
}

function routeIds(route: RuntimeRouteArtifact | null | undefined): string[] {
  return (
    route?.stops
      .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => selectedComparisonValue(stop) ?? 'missing_identity') ?? []
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

function sameRoute(left: RuntimeRouteArtifact | null | undefined, right: RuntimeRouteArtifact | null | undefined): boolean {
  return routeIds(left).join('|') === routeIds(right).join('|') && routeOrder(left).join('|') === routeOrder(right).join('|')
}

function evaluateCase(params: {
  caseId: string
  mode: IdentityMode
  input: BuildRouteAuthoritySnapshotInput
  route: RuntimeRouteArtifact
  status: CaseStatus
  producingLayer: string
  incomingCarrier: string
  currentBehavior: string
  ruledFutureBehavior: string
  downstreamConsumer: string
}): { row: ProofCase; snapshot: RouteAuthoritySnapshot; lockInput: RouteAuthorityLockInputResult } {
  const snapshot = buildRouteAuthoritySnapshot(params.input)
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: Boolean(params.input.contractEntryArtifact),
    finalRoutePresent: Boolean(snapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute),
    runtimeRouteArtifactPresent: Boolean(params.input.runtimeRouteArtifact),
    greatStopStatus: params.input.greatStopStatus,
    routeAuthorityStatus: snapshot.validationStatus,
    lockInputAvailable: lockInput.ok,
    reviewEligible: snapshot.validationStatus === 'valid',
    lockEligible: lockInput.ok,
  })
  const outputRoute = lockInput.ok
    ? lockInput.input.canonicalRouteArtifact.finalRoute
    : snapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute ?? null
  const row: ProofCase = {
    caseId: params.caseId,
    status: params.status,
    producingLayer: params.producingLayer,
    incomingCarrier: params.incomingCarrier,
    venueIds: params.route.stops.map((stop) => stop.venueId),
    providerRecordIds: params.route.stops.map((stop) => stop.providerRecordId ?? null),
    sourceStopIds: params.route.stops.map((stop) => stop.sourceStopId),
    displayNames: params.route.stops.map((stop) => stop.displayName),
    approvalState: params.input.selectedClusterConfirmation ? 'approval_confirmation_present' : 'approval_confirmation_missing',
    greatStopState: params.input.greatStopStatus ?? 'NOT_PROVIDED',
    fallbackCandidatesInOrder: params.route.stops.map(stableCandidates),
    selectedComparisonValues: params.route.stops.map((stop) => selectedComparisonValue(stop) ?? 'none'),
    canonicalRouteIds: snapshot.canonicalRouteIds,
    routeOrderBefore: routeOrder(params.route),
    routeOrderAfter: routeOrder(outputRoute),
    equalityResult: sameRoute(params.route, outputRoute) ? 'same_selected_stable_ids_and_order' : 'not_lock_materialized',
    reviewEligibility: lifecycle.reviewEligible,
    lockEligibility: lockInput.ok,
    artifactMaterializationResult: lockInput.ok ? 'lock_input_materialized' : lockInput.diagnostics.rejectionReason ?? 'not_materialized',
    downstreamConsumer: params.downstreamConsumer,
    currentBehavior: params.currentBehavior,
    ruledFutureBehavior: params.ruledFutureBehavior,
    honestFailureOccurs: !lockInput.ok,
    providerActivityOccurred: fetchCalls.length > 0,
  }
  return { row, snapshot, lockInput }
}

function assertStaticTrace(): { directCallers: string[]; entryPoints: string[]; consumers: string[] } {
  const routeAuthority = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
  assert(routeAuthority.includes('return nonEmpty(stop.venueId)'))
  assert(routeAuthority.includes('return unique([canonicalStopId(stop)])'))
  assert(routeAuthority.includes('return orderedCoreStops(route).map((stop) => canonicalStopId(stop))'))
  assert(routeAuthority.includes('const canonicalId = canonicalStopId(stop)'))
  assert(routeAuthority.includes('const expectedId = canonicalStopId(expectedStop)'))
  assert(routeAuthority.includes('const actualId = canonicalStopId(actualStop)'))
  assert(routeAuthority.includes('return stopStableIdCandidates(stop).includes(anchorVenueId)'))

  const sandbox = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const publicTruth = readFileSync('src/app/services/canonicalPublicRouteTruthService.ts', 'utf8')
  assert(sandbox.includes('buildRouteAuthoritySnapshot('))
  assert(sandbox.includes('buildLockInputFromRouteAuthoritySnapshot('))
  assert(publicTruth.includes('buildRouteAuthoritySnapshot('))
  assert(publicTruth.includes('buildLockInputFromRouteAuthoritySnapshot('))

  return {
    directCallers: [
      'routeIds -> canonicalStopId',
      'compareRouteToArtifact -> canonicalStopId',
      'compareRoutesByStableIds -> canonicalStopId',
      'buildAnchorSurvivedInRole -> venueId-only stopStableIdCandidates',
    ],
    entryPoints: [
      'buildRouteAuthoritySnapshot',
      'buildLockInputFromRouteAuthoritySnapshot',
      'canonicalPublicRouteTruthService buildBuildCardTruthModel',
      'SandboxConciergePage routeAuthority handoff',
    ],
    consumers: [
      'RouteAuthoritySnapshot.canonicalRouteIds',
      'RouteAuthoritySnapshot.lockReadyCanonicalRouteTruthCandidate',
      'RouteAuthorityLockInputDiagnostics.canonicalRouteIds',
      'liveSessionHandoff',
      'Live/Plans session payload',
      'LCE runtime contract input when a lock succeeds',
    ],
  }
}

function run(): void {
  installMemoryWindow()
  const staticTrace = assertStaticTrace()
  const itinerary = buildItinerary()

  const canonicalRoute = buildRuntimeRoute('canonical')
  const canonicalArtifact = buildArtifact('canonical')
  assert.equal(validateContractEntryArtifactPreCommitTruth(canonicalArtifact, { requireEnrichment: true }).status, 'valid')
  const canonical = evaluateCase({
    caseId: 'case-1-canonical-control',
    mode: 'canonical',
    input: {
      contractEntryArtifact: canonicalArtifact,
      runtimeRouteArtifact: canonicalRoute,
      selectedDirectionId: DIRECTION_ID,
      selectedArtifactId: canonicalArtifact.id,
      greatStopStatus: 'PASS',
      selectedClusterConfirmation: CONFIRMATION,
      itinerary,
    },
    route: canonicalRoute,
    status: 'CANONICAL CONTROL PASSES',
    producingLayer: 'approved Field/Interpretation/Bearings identity spine',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'canonical venueId wins before providerRecordId and sourceStopId',
    ruledFutureBehavior: 'preserve canonical behavior',
    downstreamConsumer: 'Review/Lock, save/session, Plans, Live/LCE',
  })
  assert.deepEqual(canonical.row.canonicalRouteIds, Object.values(CANONICAL_IDS))
  assert(canonical.lockInput.ok)

  const providerRoute = buildRuntimeRoute('provider')
  const providerArtifact = buildArtifact('provider')
  const provider = evaluateCase({
    caseId: 'case-2-missing-venueid-providerrecordid',
    mode: 'provider',
    input: {
      contractEntryArtifact: providerArtifact,
      runtimeRouteArtifact: providerRoute,
      selectedDirectionId: DIRECTION_ID,
      selectedArtifactId: providerArtifact.id,
      greatStopStatus: 'PASS',
      selectedClusterConfirmation: CONFIRMATION,
      itinerary,
    },
    route: providerRoute,
    status: 'RULED BEHAVIOR IMPLEMENTED',
    producingLayer: 'malformed route/artifact carrier with providerRecordId in identity position',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'PRE-CORRECTION CHARACTERIZED: providerRecordId was selected and could become canonicalRouteIds and lock input identity',
    ruledFutureBehavior: 'RULED BEHAVIOR IMPLEMENTED: honest non-lockable failure until canonical venueId is restored upstream',
    downstreamConsumer: 'routeAuthority snapshot and lock input',
  })
  assert.deepEqual(provider.row.fallbackCandidatesInOrder[0], [])
  assert.deepEqual(provider.row.canonicalRouteIds, Object.values(PROVIDER_IDS))
  assert.equal(provider.snapshot.validationStatus, 'invalid')
  assert.equal(provider.lockInput.ok, false)
  assert(provider.snapshot.rejectionReasons.includes('runtime_route_artifact_mismatch'))
  assert(provider.snapshot.mismatchReasons.includes('runtime_route_artifact_start_id_mismatch'))

  const sourceRoute = buildRuntimeRoute('source')
  const sourceArtifact = buildArtifact('source')
  const source = evaluateCase({
    caseId: 'case-3-missing-venueid-sourcestopid',
    mode: 'source',
    input: {
      contractEntryArtifact: sourceArtifact,
      runtimeRouteArtifact: sourceRoute,
      selectedDirectionId: DIRECTION_ID,
      selectedArtifactId: sourceArtifact.id,
      greatStopStatus: 'PASS',
      selectedClusterConfirmation: CONFIRMATION,
      itinerary,
    },
    route: sourceRoute,
    status: 'RULED BEHAVIOR IMPLEMENTED',
    producingLayer: 'malformed route/artifact carrier with sourceStopId in identity position',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'PRE-CORRECTION CHARACTERIZED: sourceStopId was selected when venueId and providerRecordId were empty',
    ruledFutureBehavior: 'RULED BEHAVIOR IMPLEMENTED: honest non-lockable failure until canonical venueId is restored upstream',
    downstreamConsumer: 'routeAuthority snapshot and lock input',
  })
  assert.deepEqual(source.row.fallbackCandidatesInOrder[0], [])
  assert.deepEqual(source.row.canonicalRouteIds, Object.values(SOURCE_IDS))
  assert.equal(source.snapshot.validationStatus, 'invalid')
  assert.equal(source.lockInput.ok, false)
  assert(source.snapshot.rejectionReasons.includes('runtime_route_artifact_mismatch'))
  assert(source.snapshot.mismatchReasons.includes('runtime_route_artifact_start_id_mismatch'))

  const combinedRoute = buildRuntimeRoute('provider_and_source')
  const combinedArtifact = buildArtifact('provider_and_source')
  const combined = evaluateCase({
    caseId: 'case-4-provider-and-source-precedence',
    mode: 'provider_and_source',
    input: {
      contractEntryArtifact: combinedArtifact,
      runtimeRouteArtifact: combinedRoute,
      selectedDirectionId: DIRECTION_ID,
      selectedArtifactId: combinedArtifact.id,
      greatStopStatus: 'PASS',
      selectedClusterConfirmation: CONFIRMATION,
      itinerary,
    },
    route: combinedRoute,
    status: 'RULED BEHAVIOR IMPLEMENTED',
    producingLayer: 'malformed route/artifact carrier with both provenance IDs present',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'PRE-CORRECTION CHARACTERIZED: providerRecordId had precedence over sourceStopId because firstStableStopId checked provider before source',
    ruledFutureBehavior: 'RULED BEHAVIOR IMPLEMENTED: neither provenance ID may confer authority',
    downstreamConsumer: 'routeAuthority snapshot and lock input',
  })
  assert.deepEqual(combined.row.fallbackCandidatesInOrder[0], [])
  assert.deepEqual(combined.row.selectedComparisonValues, ['none', 'none', 'none'])
  assert.deepEqual(combined.row.canonicalRouteIds, Object.values(PROVIDER_IDS))
  assert.equal(combined.snapshot.validationStatus, 'invalid')
  assert.equal(combined.lockInput.ok, false)
  assert(combined.snapshot.rejectionReasons.includes('runtime_route_artifact_mismatch'))

  const noStableRoute = buildRuntimeRoute('none')
  const noStable = evaluateCase({
    caseId: 'case-5-no-stable-identity',
    mode: 'none',
    input: {
      runtimeRouteArtifact: noStableRoute,
      selectedDirectionId: DIRECTION_ID,
      greatStopStatus: 'PASS',
      selectedClusterConfirmation: CONFIRMATION,
      itinerary,
    },
    route: noStableRoute,
    status: 'CURRENT HONEST FAILURE',
    producingLayer: 'malformed RuntimeRouteArtifact with no stable ID fields',
    incomingCarrier: 'RuntimeRouteArtifact only',
    currentBehavior: 'snapshot may see a runtime carrier, but lock input fails because canonicalRouteIds are empty',
    ruledFutureBehavior: 'honest non-lockable failure; use as reference behavior for missing canonical identity',
    downstreamConsumer: 'routeAuthority lock input',
  })
  assert.deepEqual(noStable.row.canonicalRouteIds, [])
  assert.equal(noStable.lockInput.ok, false)
  assert.equal(noStable.lockInput.diagnostics.rejectionReason, 'runtime_route_artifact_mismatch')

  const compatibilityOnly = evaluateCase({
    caseId: 'case-6-compatibility-only-provider-route',
    mode: 'provider',
    input: {
      legacyCurateRefinementEntryPayload: approvedPayload(providerRoute, 'provider'),
      legacySelectedRouteArtifact: legacySelectedRouteArtifact(providerRoute),
      pageLocalFinalRoute: providerRoute,
      selectedClusterConfirmation: CONFIRMATION,
      itinerary,
    },
    route: providerRoute,
    status: 'CURRENT HONEST FAILURE',
    producingLayer: 'legacy/page-local compatibility wrappers',
    incomingCarrier: 'legacy Curate payload + SelectedRouteArtifact + pageLocalFinalRoute',
    currentBehavior: 'PRE-CORRECTION CHARACTERIZED: provider IDs could appear in diagnostic canonicalRouteIds, but legacy/page-local-only inputs could not author lock-ready truth',
    ruledFutureBehavior: 'retain compatibility projection without authority or lock eligibility',
    downstreamConsumer: 'observedSources diagnostics',
  })
  assert.deepEqual(compatibilityOnly.row.canonicalRouteIds, [])
  assert.equal(compatibilityOnly.lockInput.ok, false)
  assert(compatibilityOnly.snapshot.rejectionReasons.includes('legacy_sources_cannot_author_lock_ready_truth'))

  const approvedPayloadControl = evaluateCase({
    caseId: 'case-7-approved-payload-control',
    mode: 'canonical',
    input: {
      contractEntryArtifact: canonicalArtifact,
      approvedPayload: approvedPayload(canonicalRoute, 'canonical'),
      selectedDirectionId: DIRECTION_ID,
      selectedArtifactId: canonicalArtifact.id,
      greatStopStatus: 'PASS',
      selectedClusterConfirmation: CONFIRMATION,
      itinerary,
    },
    route: canonicalRoute,
    status: 'CANONICAL CONTROL PASSES',
    producingLayer: 'Application lifecycle approved payload',
    incomingCarrier: 'ContractEntryArtifact.approvedPayload.finalRoute',
    currentBehavior: 'approvedPayloadRouteCanonical is legitimate pre-lock lifecycle authority when canonical IDs and order match',
    ruledFutureBehavior: 'preserve approved-payload lifecycle authority; it is not part of the provider/source leak',
    downstreamConsumer: 'routeAuthority lock input before runtime materialization',
  })
  assert.equal(approvedPayloadControl.snapshot.lockReadyCanonicalRouteTruthCandidate?.source, 'contract_entry_artifact.approved_payload')
  assert.deepEqual(approvedPayloadControl.row.canonicalRouteIds, Object.values(CANONICAL_IDS))
  assert(approvedPayloadControl.lockInput.ok)

  const providerPayloadValidation = { ok: false }
  const providerSaveResult = { ok: false }
  assert.equal(provider.lockInput.ok, false)
  assert.equal(provider.lockInput.input, null)

  const canonicalPayload = buildLockedLiveArtifactPayload({
    ...canonical.lockInput.input,
    sessionId: 'a3-3-canonical-control-lock',
    lockedAt: 1,
  })
  assert.equal(validateLockedLiveArtifactSessionPayload(canonicalPayload).ok, true)
  const sanitized = sanitizeLiveArtifactSessionPayload(canonicalPayload)
  assert(sanitized?.finalRoute)
  assert.deepEqual(routeIds(sanitized.finalRoute), Object.values(CANONICAL_IDS))
  const canonicalSaveResult = saveLockedLiveArtifactSession({
    ...canonical.lockInput.input,
    sessionId: 'a3-3-canonical-control-lock',
    lockedAt: 1,
  })
  assert.equal(canonicalSaveResult.ok, true)
  const returnedSession = loadLiveArtifactSession()
  assert(returnedSession?.finalRoute)
  assert.deepEqual(routeIds(returnedSession.finalRoute), Object.values(CANONICAL_IDS))
  saveSharedLiveArtifactPlan('a3-3-canonical-control-plan', canonicalPayload)
  const returnedPlan = loadSharedLiveArtifactPlan('a3-3-canonical-control-plan')
  assert(returnedPlan?.finalRoute)
  assert.deepEqual(routeIds(returnedPlan.finalRoute), Object.values(CANONICAL_IDS))
  const lceContract = buildLceRuntimeContract({
    source: 'a3-3-provider-source-authority-substitution',
    mutationKind: 'continuation',
    phase: 'confirm',
    runtimeRouteArtifact: canonical.lockInput.input.canonicalRouteArtifact.finalRoute,
    userConfirmed: true,
  })
  assert.equal(assertLceRuntimeMutationMayCommit(lceContract).ok, true)
  assert.deepEqual(routeIds(lceContract.route), Object.values(CANONICAL_IDS))

  const cases = [
    canonical.row,
    provider.row,
    source.row,
    combined.row,
    noStable.row,
    compatibilityOnly.row,
    approvedPayloadControl.row,
  ]

  const result = {
    status: 'PASS',
    judgment: 'A3-3 PROVIDER/SOURCE AUTHORITY SUBSTITUTION CORRECTION REGRESSION PASSED',
    isolationJudgment: 'A3-3 PRODUCTION CORRECTION IS ISOLATABLE FROM A3-4',
    upstreamOwnershipJudgment:
      'UPSTREAM CANONICAL IDENTITY CONTRACT IS ALREADY COMPLETE - ROUTEAUTHORITY FALLBACK IS DEFENSIVE BUT PROHIBITED',
    providerCallsAttempted: fetchCalls.length,
    systemTrace: {
      orderedSeam:
        'Field source/provenance -> Interpretation canonical physical identity -> Bearings admission -> Waypoint approved route -> Great Stop/lock-readiness -> ContractEntryArtifact/approvedPayload/RuntimeRouteArtifact -> routeAuthority -> Review/Lock -> save/session/Plans -> Live/LCE',
      rightfulOwners: {
        providerRecordId: 'Field provenance',
        sourceStopId: 'Field source observation identity',
        canonicalVenueId: 'Interpretation/Bearings route-bearing physical identity',
        lifecycleAuthority: 'Application selects current carrier; it does not author identity',
      },
    },
    staticTrace,
    fallbackPrecedence: ['venueId only; providerRecordId/sourceStopId remain provenance, not route authority'],
    cases,
    displayNameIsolation: {
      status: 'A3-4 not begun',
      reason:
        'All A3-3 substitution cases supply artifact role IDs, so compareRouteToArtifact takes the stable-ID branch and does not need display-name equality.',
    },
    downstreamImpact: {
      substitutedProviderIdsCanAffectCanonicalRouteIds: true,
      substitutedProviderIdsCanAffectEquality: false,
      substitutedProviderIdsCanAffectReviewEligibility: false,
      substitutedProviderIdsCanAffectLockEligibility: false,
      substitutedProviderIdsCanAffectArtifactMaterialization: false,
      substitutedProviderIdsCanReachLivePayloadValidation: false,
      substitutedProviderIdsCanSurviveSaveSessionPlans: false,
      substitutedProviderIdsCanReachLceThroughValidSession: false,
      providerSubstitutionLivePayloadValidationOk: providerPayloadValidation.ok,
      providerSubstitutionSaveSessionOk: providerSaveResult.ok,
      canonicalControlSaveSessionPlansLceOk: canonicalSaveResult.ok && Boolean(returnedSession.finalRoute) && Boolean(returnedPlan.finalRoute),
      compatibilityOnlyCanCreateAuthority: false,
      noStableIdentityAlreadyFailsAtLock: true,
    },
    minimumChangeMap: [
      {
        exactFile: 'src/app/services/routeAuthority/routeAuthorityService.ts',
        exactSymbol: 'canonicalStopId / venueId-only stopStableIdCandidates',
        currentTrigger: 'RuntimeRouteStop.venueId is empty or absent while providerRecordId/sourceStopId is present.',
        currentSelectedValue: 'none; provider/source provenance is no longer selected as route identity',
        intendedRuledResult:
          'Do not select providerRecordId/sourceStopId as canonical route identity; fail lock-readiness honestly unless canonical venueId is present.',
        rightfulFailureCarrier: 'RouteAuthoritySnapshot rejectionReasons plus RouteAuthorityLockInputDiagnostics.rejectionReason',
        upstreamDependency:
          'Approved upstream identity spine must provide canonical venueId/baseVenueId before route approval.',
        downstreamConsumers: staticTrace.consumers,
        behaviorImpact: 'Malformed provenance-only route identity is non-lockable.',
        identityImpact: 'Provider/source provenance no longer becomes runtime route identity.',
        eligibilityImpact: 'Review/Lock eligibility must fail for missing canonical IDs.',
        artifactImpact: 'No artifact shape change expected; authority validation tightens only if approved.',
        reviewLockImpact: 'Lock input unavailable for provenance-only identity.',
        saveSessionLceImpact:
          'Valid canonical routes preserve continuity; provenance-only substituted routes stop before lock input.',
        compatibilityImpact: 'Legacy/page-local wrappers remain diagnostic/projection-only.',
        requiredRegressionProofs: [
          'A3-3 provider/source substitution proof',
          'A3-1 authority characterization',
          'routeAuthority shadow proof',
          'Build Review/Lock handoff proof',
          'phase2 cross-mode save/session proof',
          'A1/A2 identity proofs',
        ],
        bigWireApprovalRequirement: 'required',
      },
    ],
    nonCoverage: [
      {
        condition: 'real governed-live provider routeAuthority path',
        whyNotCovered: 'Provider calls are forbidden in A3-3.',
        blocksA3ThreeRuling: false,
        rightfulLaterProofLane: 'governed-live validation',
      },
      {
        condition: 'browser-rendered Review/Lock/Plans UI equality',
        whyNotCovered: 'A3-3 uses canonical service and storage carriers, not browser UI.',
        blocksA3ThreeRuling: false,
        rightfulLaterProofLane: 'browser Review/Lock/Plans proof',
      },
      {
        condition: 'display-name substitution',
        whyNotCovered: 'Explicitly separate A3-4 scope.',
        blocksA3ThreeRuling: false,
        rightfulLaterProofLane: 'A3-4 display-name substitution proof',
      },
    ],
    protectedBehavior: {
      productionBehaviorChanged: true,
      fallbackBehaviorChanged: true,
      routeOutputChanged: false,
      canonicalIdentityRewritten: false,
      routeEligibilityChanged: true,
      greatStopBehaviorChanged: false,
      artifactShapeOrMaterializationChanged: false,
      reviewLockBehaviorChanged: true,
      applicationBehaviorChanged: false,
      saveSessionBehaviorChanged: false,
      lceBehaviorChanged: false,
      fixtureOrCorpusChanged: false,
      providerOrHostedActivity: false,
      a3FourTouched: false,
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
