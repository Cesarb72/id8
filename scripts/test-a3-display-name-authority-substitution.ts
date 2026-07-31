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
  | 'RULED BEHAVIOR NOT YET IMPLEMENTED'
  | 'CURRENT HONEST FAILURE'
  | 'CANONICAL CONTROL PASSES'
  | 'NOT COVERED'
  | 'UNRESOLVED'

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

interface ProofCase {
  caseId: string
  status: CaseStatus
  producingLayer: string
  incomingCarrier: string
  selectedRouteCanonicalIds: string[]
  artifactRoleCanonicalIds: Array<string | null>
  displayNames: {
    artifact: string[]
    selectedRoute: string[]
  }
  routeOrder: string[]
  roleOrder: string[]
  nameNormalizationApplied: string
  exactCanonicalComparisonAvailability: string
  displayNameFallbackTrigger: string
  selectedComparisonValues: string[]
  equalityResult: string
  reviewEligibility: boolean
  lockEligibility: boolean
  lockInputResult: string
  artifactMaterializationImpact: string
  downstreamConsumers: string[]
  currentBehavior: string
  ruledFutureBehavior: string
  honestFailureOccurs: boolean
  providerCallCount: number
}

const CORE_ROLES: CoreRole[] = ['start', 'highlight', 'windDown']
const CANONICAL_IDS: Record<CoreRole, string> = {
  start: 'sj-a3-display-proof-start',
  highlight: 'sj-a3-display-proof-highlight',
  windDown: 'sj-a3-display-proof-winddown',
}
const DIFFERENT_IDS: Record<CoreRole, string> = {
  start: 'sj-a3-display-proof-other-start',
  highlight: 'sj-a3-display-proof-other-highlight',
  windDown: 'sj-a3-display-proof-other-winddown',
}
const DISPLAY_NAMES: Record<CoreRole, string> = {
  start: 'A3 Display Proof Start',
  highlight: 'A3 Display Proof Highlight',
  windDown: 'A3 Display Proof Winddown',
}
const DISPLAY_VARIANTS: Record<CoreRole, string> = {
  start: 'A3 Display Proof Start Patio',
  highlight: 'A3 Display Proof Highlight Room',
  windDown: 'A3 Display Proof Winddown Lounge',
}
const DIRECTION_ID = 'a3-4:direction:display-name-proof'
const ARTIFACT_ID = 'a3-4:contract-entry:display-name-proof'
const CONFIRMATION = 'A3 Display Proof Start -> A3 Display Proof Highlight -> A3 Display Proof Winddown'
const DOWNSTREAM_CONSUMERS = [
  'RouteAuthoritySnapshot.validationStatus',
  'RouteAuthoritySnapshot.rejectionReasons',
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
  throw new Error(`A3-4 display-name proof must not call fetch/providers: ${url}`)
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

function normalizeName(value: string | undefined | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

function buildItineraryStop(role: CoreRole, index: number): ItineraryStop {
  return {
    id: `itinerary:${CANONICAL_IDS[role]}`,
    role,
    title: titleForRole(role),
    venueId: CANONICAL_IDS[role],
    venueName: DISPLAY_NAMES[role],
    formattedAddress: `${100 + index} A3 Display Proof Way, San Jose, CA`,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    city: 'San Jose',
    category: 'proof',
    subcategory: 'display-name',
    priceTier: '$$',
    tags: ['a3-4', 'display-name'],
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
      localSignal: 'Provider-free A3-4 fixture.',
      selectionReason: 'A3-4 routeAuthority display-name substitution proof.',
    },
  }
}

function buildItinerary(): Itinerary {
  const stops = CORE_ROLES.map((role, index) => buildItineraryStop(role, index))
  return {
    id: 'itinerary:a3-4:display-name-proof',
    title: 'A3-4 Display Name Route',
    city: 'San Jose',
    neighborhood: 'San Jose',
    crew: 'romantic',
    vibes: ['cozy'],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'A3-4 deterministic route',
    story: {
      headline: 'A3-4 Display Name Route',
      subtitle: 'Provider-free routeAuthority proof.',
    },
    shareSummary: CONFIRMATION,
  }
}

function buildRuntimeStop(params: {
  role: CoreRole
  stopIndex: number
  venueId: string
  displayName: string
}): RuntimeRouteStop {
  return {
    id: `runtime:${params.role}:${params.venueId}`,
    sourceStopId: `source:${params.role}:${params.venueId}`,
    displayName: params.displayName,
    latitude: 37.33 + params.stopIndex * 0.001,
    longitude: -121.89 - params.stopIndex * 0.001,
    address: `${100 + params.stopIndex} A3 Display Proof Way, San Jose, CA`,
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

function buildRuntimeRoute(params: {
  routeId?: string
  ids?: Record<CoreRole, string>
  names?: Record<CoreRole, string>
  stopOrder?: CoreRole[]
} = {}): RuntimeRouteArtifact {
  const ids = params.ids ?? CANONICAL_IDS
  const names = params.names ?? DISPLAY_NAMES
  const stopOrder = params.stopOrder ?? CORE_ROLES
  const stopIndexByRole = new Map(stopOrder.map((role, index) => [role, index] as const))
  const stops = CORE_ROLES.map((role) =>
    buildRuntimeStop({
      role,
      stopIndex: stopIndexByRole.get(role) ?? CORE_ROLES.indexOf(role),
      venueId: ids[role],
      displayName: names[role],
    }),
  )
  return {
    routeId: params.routeId ?? 'runtime-route:a3-4:display-name-proof',
    selectedDirectionId: DIRECTION_ID,
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'A3-4 Display Name Route',
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
    updatedAt: 1_787_200_000_000,
  }
}

function buildArtifact(params: {
  id?: string
  ids?: Record<CoreRole, string | undefined>
  names?: Record<CoreRole, string>
  anchorRole?: CoreRole
  validationStatus?: 'valid' | 'incomplete' | 'rejected'
  runtimeRouteArtifact?: RuntimeRouteArtifact
} = {}): ContractEntryArtifact {
  const ids = params.ids ?? CANONICAL_IDS
  const names = params.names ?? DISPLAY_NAMES
  const support = CORE_ROLES.map((role) => ({
    role,
    name: names[role],
    ...(ids[role] ? { venueId: ids[role] } : {}),
  }))
  return {
    id: params.id ?? ARTIFACT_ID,
    sourceOpportunityId: 'opportunity:a3-4:display-name-proof',
    sourceMode: 'curated',
    anchorVenueId: CANONICAL_IDS.highlight,
    ...(params.anchorRole ? { anchorRole: params.anchorRole } : {}),
    anchorName: names.highlight,
    routeTitle: 'A3-4 Display Name Route',
    flavorLine: 'Provider-free routeAuthority display-name substitution proof.',
    routeSummary: CONFIRMATION,
    traits: ['a3-4', 'display-name'],
    storySpine: {
      start: names.start,
      highlight: names.highlight,
      windDown: names.windDown,
    },
    districtLine: 'San Jose',
    districtAnchorLine: `Anchor: ${names.highlight}`,
    authorityLine: 'A3-4 proof only.',
    whyChooseLine: 'The route has deterministic proof identity.',
    whyTonightProofLine: 'Provider-free local proof only.',
    selection: {
      directionId: DIRECTION_ID,
      pocketId: 'a3-4:display-name',
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
        anchorName: names.highlight,
      },
      conciergeIntentSummary: {
        planningMode: 'curate',
        primaryVibe: 'cozy',
        persona: 'romantic',
        summary: 'A3-4 display-name substitution proof.',
      },
      tasteDistrictSummary: {
        tasteProfileId: 'a3-4',
        districtId: 'a3-4:display-name',
        districtLabel: 'San Jose',
        summary: 'A3-4 deterministic route.',
      },
      fieldProvenanceSummary: {
        sourceMode: 'curated',
        provider: 'static-corpus',
        liveProviderUsed: false,
        corpusUsed: true,
        calibrationOnly: false,
        candidateCount: 3,
        queryLabels: [],
        provenanceId: 'a3-4-local-fixture',
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: 'bearings:a3-4',
        summary: 'Proof fixture roles are admitted.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'waypoint:a3-4',
        summary: CONFIRMATION,
      },
      canonicalRouteRoleCoverage: {
        start: names.start,
        highlight: names.highlight,
        windDown: names.windDown,
        support,
      },
      validationStatus: params.validationStatus ?? 'valid',
      rejectionReasons: [],
      starterContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'a3-4:curate',
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

function idsAbsent(): Record<CoreRole, undefined> {
  return {
    start: undefined,
    highlight: undefined,
    windDown: undefined,
  }
}

function artifactRoleIds(artifact: ContractEntryArtifact): Array<string | null> {
  const byRole = new Map(
    (artifact.enrichment?.canonicalRouteRoleCoverage?.support ?? []).map((support) => [
      support.role,
      support.venueId?.trim() || null,
    ]),
  )
  return CORE_ROLES.map((role) => {
    if (artifact.anchorRole === role && artifact.anchorVenueId.trim()) {
      return artifact.anchorVenueId
    }
    return byRole.get(role) ?? null
  })
}

function routeIds(route: RuntimeRouteArtifact | null | undefined): string[] {
  return (
    route?.stops
      .filter((stop) => CORE_ROLES.includes(stop.role as CoreRole))
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => stop.venueId)
      .filter((id): id is string => Boolean(id?.trim())) ?? []
  )
}

function routeDisplayNames(route: RuntimeRouteArtifact): string[] {
  return route.stops
    .filter((stop) => CORE_ROLES.includes(stop.role as CoreRole))
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => stop.displayName)
}

function artifactDisplayNames(artifact: ContractEntryArtifact): string[] {
  return CORE_ROLES.map((role) => artifact.enrichment?.canonicalRouteRoleCoverage?.[role] ?? artifact.storySpine[role])
}

function routeOrder(route: RuntimeRouteArtifact): string[] {
  return route.stops
    .filter((stop) => CORE_ROLES.includes(stop.role as CoreRole))
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => stop.role)
}

function selectedComparisonValues(artifact: ContractEntryArtifact, route: RuntimeRouteArtifact): string[] {
  const artifactIds = artifactRoleIds(artifact)
  const stopByRole = new Map(route.stops.map((stop) => [stop.role, stop]))
  return CORE_ROLES.map((role, index) => {
    const artifactId = artifactIds[index]
    if (artifactId) {
      return `id:${artifactId}`
    }
    return `displayName:${normalizeName(stopByRole.get(role)?.displayName)}`
  })
}

function fallbackTrigger(artifact: ContractEntryArtifact): string {
  const missing = CORE_ROLES.filter((_, index) => !artifactRoleIds(artifact)[index])
  if (missing.length === 0) {
    return 'not_triggered_artifact_role_ids_complete'
  }
  return `triggered_for_missing_artifact_role_ids:${missing.join(',')}`
}

function exactCanonicalAvailability(artifact: ContractEntryArtifact): string {
  const ids = artifactRoleIds(artifact)
  return ids.every(Boolean) ? 'available_for_all_roles' : `unavailable_for_roles:${CORE_ROLES.filter((_, index) => !ids[index]).join(',')}`
}

function evaluateCase(params: {
  caseId: string
  input: BuildRouteAuthoritySnapshotInput
  route: RuntimeRouteArtifact
  artifact: ContractEntryArtifact
  status: CaseStatus
  producingLayer: string
  incomingCarrier: string
  currentBehavior: string
  ruledFutureBehavior: string
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
    selectedRouteCanonicalIds: routeIds(params.route),
    artifactRoleCanonicalIds: artifactRoleIds(params.artifact),
    displayNames: {
      artifact: artifactDisplayNames(params.artifact),
      selectedRoute: routeDisplayNames(params.route),
    },
    routeOrder: routeOrder(params.route),
    roleOrder: CORE_ROLES,
    nameNormalizationApplied: 'trim + lowercase + repeated whitespace collapse; punctuation is preserved',
    exactCanonicalComparisonAvailability: exactCanonicalAvailability(params.artifact),
    displayNameFallbackTrigger: fallbackTrigger(params.artifact),
    selectedComparisonValues: selectedComparisonValues(params.artifact, params.route),
    equalityResult: snapshot.validationStatus,
    reviewEligibility: lifecycle.reviewEligible,
    lockEligibility: lifecycle.lockEligible,
    lockInputResult: lockInput.ok ? 'lock_input_materialized' : lockInput.diagnostics.rejectionReason ?? 'not_materialized',
    artifactMaterializationImpact: lockInput.ok
      ? `materialized_from:${snapshot.lockReadyCanonicalRouteTruthCandidate?.source}`
      : 'not_materialized',
    downstreamConsumers: DOWNSTREAM_CONSUMERS,
    currentBehavior: params.currentBehavior,
    ruledFutureBehavior: params.ruledFutureBehavior,
    honestFailureOccurs: !lockInput.ok,
    providerCallCount: fetchCalls.length,
  }
  return { row, snapshot, lockInput }
}

function buildInput(params: {
  artifact: ContractEntryArtifact
  route?: RuntimeRouteArtifact
  approvedRoute?: RuntimeRouteArtifact
  itinerary: Itinerary
}): BuildRouteAuthoritySnapshotInput {
  return {
    contractEntryArtifact: params.artifact,
    ...(params.route ? { runtimeRouteArtifact: params.route } : {}),
    ...(params.approvedRoute ? { approvedPayload: approvedPayload(params.approvedRoute) } : {}),
    selectedDirectionId: DIRECTION_ID,
    selectedArtifactId: params.artifact.id,
    greatStopStatus: 'PASS',
    selectedClusterConfirmation: CONFIRMATION,
    itinerary: params.itinerary,
  }
}

function assertStaticTrace(): {
  exactFile: string
  exactSymbol: string
  directCallers: string[]
  transitiveEntryPoints: string[]
  lifecycleStatesReached: string[]
  comparisonPrecedence: string[]
  displayFallbackTrigger: string
  equalityOutputConsumers: string[]
  removalWouldCurrentlyBeBehaviorChanging: boolean
} {
  const routeAuthority = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
  assert(routeAuthority.includes('if (expected.id)'))
  assert(routeAuthority.includes('const candidateIds = stopStableIdCandidates(stop)'))
  assert(routeAuthority.includes('const expectedName = normalizeText(expected.displayName)'))
  assert(routeAuthority.includes('const actualName = normalizeText(stop.displayName)'))
  assert(routeAuthority.includes('`${params.reasonPrefix}_${role}_display_name_mismatch`'))
  assert(routeAuthority.includes('compareRouteToArtifact({'))
  assert(routeAuthority.includes('runtime_route_artifact_mismatch'))
  assert(routeAuthority.includes('approved_payload_route_mismatch'))

  const sandbox = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const publicTruth = readFileSync('src/app/services/canonicalPublicRouteTruthService.ts', 'utf8')
  assert(sandbox.includes('buildRouteAuthoritySnapshot('))
  assert(sandbox.includes('buildLockInputFromRouteAuthoritySnapshot('))
  assert(publicTruth.includes('buildRouteAuthoritySnapshot('))
  assert(publicTruth.includes('buildLockInputFromRouteAuthoritySnapshot('))

  return {
    exactFile: 'src/app/services/routeAuthority/routeAuthorityService.ts',
    exactSymbol: 'compareRouteToArtifact display-name branch',
    directCallers: [
      'buildRouteAuthorityBuildDiagnostics candidate contract comparison',
      'runtime_route_artifact comparison',
      'approved_payload comparison when runtime route is absent',
      'legacy_curate_refinement_entry_payload diagnostics comparison',
      'legacy_selected_route_artifact diagnostics comparison',
      'page_local_final_route diagnostics comparison',
    ],
    transitiveEntryPoints: [
      'buildRouteAuthoritySnapshot',
      'buildLockInputFromRouteAuthoritySnapshot',
      'canonicalPublicRouteTruthService buildBuildCardTruthModel',
      'SandboxConciergePage routeAuthority handoff',
    ],
    lifecycleStatesReached: [
      'recommendation/review diagnostics',
      'pre-lock approved payload',
      'lock input materialization',
      'save/session/Plans after lock',
      'Live/LCE only after successful lock',
    ],
    comparisonPrecedence: ['artifact role id vs route stable ID candidates', 'normalized displayName fallback'],
    displayFallbackTrigger:
      'artifact role identity exists with displayName but without id after canonicalRouteRoleCoverage/support and anchorRole processing',
    equalityOutputConsumers: DOWNSTREAM_CONSUMERS,
    removalWouldCurrentlyBeBehaviorChanging: true,
  }
}

function run(): void {
  installMemoryWindow()
  const staticTrace = assertStaticTrace()
  const itinerary = buildItinerary()

  const canonicalRoute = buildRuntimeRoute()
  const canonicalArtifact = buildArtifact({ anchorRole: 'highlight' })
  assert.equal(validateContractEntryArtifactPreCommitTruth(canonicalArtifact, { requireEnrichment: true }).status, 'valid')

  const canonical = evaluateCase({
    caseId: 'case-1-canonical-equality-control',
    input: buildInput({ artifact: canonicalArtifact, route: canonicalRoute, itinerary }),
    route: canonicalRoute,
    artifact: canonicalArtifact,
    status: 'CANONICAL CONTROL PASSES',
    producingLayer: 'Interpretation/Bearings canonical identity spine',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'complete artifact role IDs take precedence; names do not control equality',
    ruledFutureBehavior: 'preserve canonical ID equality as the authority path',
  })
  assert.equal(canonical.snapshot.validationStatus, 'valid')
  assert(canonical.lockInput.ok)
  assert.deepEqual(canonical.row.selectedRouteCanonicalIds, Object.values(CANONICAL_IDS))

  const mismatchNamesMatchingRoute = buildRuntimeRoute({ ids: DIFFERENT_IDS })
  const canonicalMismatch = evaluateCase({
    caseId: 'case-2-canonical-mismatch-matching-names',
    input: buildInput({ artifact: canonicalArtifact, route: mismatchNamesMatchingRoute, itinerary }),
    route: mismatchNamesMatchingRoute,
    artifact: canonicalArtifact,
    status: 'CURRENT HONEST FAILURE',
    producingLayer: 'runtime route with different canonical venue IDs',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'complete artifact IDs reject different runtime venue IDs even when display names match',
    ruledFutureBehavior: 'canonical mismatch must fail regardless of name equality',
  })
  assert.equal(canonicalMismatch.snapshot.validationStatus, 'invalid')
  assert.equal(canonicalMismatch.lockInput.ok, false)
  assert(canonicalMismatch.snapshot.mismatchReasons.includes('runtime_route_artifact_start_id_mismatch'))

  const displayOnlyArtifact = buildArtifact({ ids: idsAbsent() })
  assert.equal(validateContractEntryArtifactPreCommitTruth(displayOnlyArtifact, { requireEnrichment: true }).status, 'valid')
  const missingArtifactIdsMatchingNames = evaluateCase({
    caseId: 'case-3-missing-artifact-identity-matching-names',
    input: buildInput({ artifact: displayOnlyArtifact, route: canonicalRoute, itinerary }),
    route: canonicalRoute,
    artifact: displayOnlyArtifact,
    status: 'CURRENT BEHAVIOR CONFIRMED',
    producingLayer: 'ContractEntryArtifact with role names but no role venue IDs',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'display-name fallback validates artifact/runtime equality and preserves lock readiness',
    ruledFutureBehavior:
      'RULED BEHAVIOR NOT YET IMPLEMENTED: honest non-lockable failure until exact canonical role IDs are present',
  })
  assert.equal(missingArtifactIdsMatchingNames.snapshot.validationStatus, 'valid')
  assert(missingArtifactIdsMatchingNames.lockInput.ok)
  assert.deepEqual(missingArtifactIdsMatchingNames.row.artifactRoleCanonicalIds, [null, null, null])
  assert.equal(missingArtifactIdsMatchingNames.row.displayNameFallbackTrigger, 'triggered_for_missing_artifact_role_ids:start,highlight,windDown')

  const differentNameRoute = buildRuntimeRoute({ names: DISPLAY_VARIANTS })
  const missingArtifactIdsDifferentNames = evaluateCase({
    caseId: 'case-4-missing-artifact-identity-different-names',
    input: buildInput({ artifact: displayOnlyArtifact, route: differentNameRoute, itinerary }),
    route: differentNameRoute,
    artifact: displayOnlyArtifact,
    status: 'CURRENT HONEST FAILURE',
    producingLayer: 'ContractEntryArtifact with role names but no role venue IDs',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'display-name fallback rejects when normalized names differ',
    ruledFutureBehavior: 'honest non-lockable failure; this is the existing reference failure for missing canonical role IDs',
  })
  assert.equal(missingArtifactIdsDifferentNames.snapshot.validationStatus, 'invalid')
  assert.equal(missingArtifactIdsDifferentNames.lockInput.ok, false)
  assert(missingArtifactIdsDifferentNames.snapshot.mismatchReasons.includes('runtime_route_artifact_start_display_name_mismatch'))

  const completeIdsDifferentNames = evaluateCase({
    caseId: 'case-5-same-canonical-ids-different-presentation-names',
    input: buildInput({ artifact: canonicalArtifact, route: differentNameRoute, itinerary }),
    route: differentNameRoute,
    artifact: canonicalArtifact,
    status: 'CANONICAL CONTROL PASSES',
    producingLayer: 'canonical route with presentation-name drift',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'canonical ID branch preserves equality; differing names do not defeat exact ID equality',
    ruledFutureBehavior: 'names must not defeat exact canonical equality',
  })
  assert.equal(completeIdsDifferentNames.snapshot.validationStatus, 'valid')
  assert(completeIdsDifferentNames.lockInput.ok)

  const caseWhitespaceNames = {
    start: '  a3   display proof start  ',
    highlight: 'A3 DISPLAY PROOF HIGHLIGHT',
    windDown: 'a3 display proof winddown',
  }
  const punctuationNames = {
    start: 'A3 Display-Proof Start',
    highlight: 'A3 Display Proof Highlight',
    windDown: 'A3 Display Proof Winddown',
  }
  const whitespaceRoute = buildRuntimeRoute({ names: caseWhitespaceNames })
  const punctuationRoute = buildRuntimeRoute({ names: punctuationNames })
  const normalizationWhitespace = evaluateCase({
    caseId: 'case-6a-normalization-case-whitespace',
    input: buildInput({ artifact: displayOnlyArtifact, route: whitespaceRoute, itinerary }),
    route: whitespaceRoute,
    artifact: displayOnlyArtifact,
    status: 'CURRENT BEHAVIOR CONFIRMED',
    producingLayer: 'display-only artifact with presentation-normalized route names',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'case and repeated/edge whitespace normalize to equality',
    ruledFutureBehavior: 'presentation normalization must not prove canonical equality',
  })
  assert.equal(normalizationWhitespace.snapshot.validationStatus, 'valid')
  assert(normalizationWhitespace.lockInput.ok)

  const normalizationPunctuation = evaluateCase({
    caseId: 'case-6b-normalization-punctuation',
    input: buildInput({ artifact: displayOnlyArtifact, route: punctuationRoute, itinerary }),
    route: punctuationRoute,
    artifact: displayOnlyArtifact,
    status: 'CURRENT HONEST FAILURE',
    producingLayer: 'display-only artifact with punctuation-altered route names',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'punctuation is preserved by normalization, so punctuation changes reject',
    ruledFutureBehavior: 'presentation punctuation still must not be identity evidence',
  })
  assert.equal(normalizationPunctuation.snapshot.validationStatus, 'invalid')
  assert.equal(normalizationPunctuation.lockInput.ok, false)

  const routeOrderChanged = buildRuntimeRoute({ stopOrder: ['highlight', 'start', 'windDown'] })
  const routeOrder = evaluateCase({
    caseId: 'case-7-route-order-control',
    input: buildInput({ artifact: canonicalArtifact, route: routeOrderChanged, itinerary }),
    route: routeOrderChanged,
    artifact: canonicalArtifact,
    status: 'CURRENT BEHAVIOR CONFIRMED',
    producingLayer: 'canonical route with changed stopIndex order but preserved role IDs',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'compareRouteToArtifact compares by role and lock input self-checks routeIds from the same route, so changed stopIndex order remains lockable',
    ruledFutureBehavior: 'RULED BEHAVIOR NOT YET IMPLEMENTED: exact route order mismatch must fail before lock readiness',
  })
  assert.equal(routeOrder.snapshot.validationStatus, 'valid')
  assert(routeOrder.lockInput.ok)
  assert.deepEqual(routeOrder.row.routeOrder, ['highlight', 'start', 'windDown'])

  const duplicateNames = {
    start: 'Shared Venue Name',
    highlight: 'Shared Venue Name',
    windDown: 'Shared Venue Name',
  }
  const duplicateArtifact = buildArtifact({ ids: idsAbsent(), names: duplicateNames })
  const duplicateRoute = buildRuntimeRoute({ ids: DIFFERENT_IDS, names: duplicateNames })
  const duplicateNameCollision = evaluateCase({
    caseId: 'case-8-duplicate-display-name-collision',
    input: buildInput({ artifact: duplicateArtifact, route: duplicateRoute, itinerary }),
    route: duplicateRoute,
    artifact: duplicateArtifact,
    status: 'CURRENT BEHAVIOR CONFIRMED',
    producingLayer: 'display-only artifact and distinct canonical runtime venues sharing names',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'duplicate display names validate role equality even though artifact has no canonical venue IDs',
    ruledFutureBehavior: 'RULED BEHAVIOR NOT YET IMPLEMENTED: distinct venues must remain distinct; duplicate names cannot prove equality',
  })
  assert.equal(duplicateNameCollision.snapshot.validationStatus, 'valid')
  assert(duplicateNameCollision.lockInput.ok)
  assert.deepEqual(duplicateNameCollision.row.artifactRoleCanonicalIds, [null, null, null])
  assert.deepEqual(duplicateNameCollision.row.selectedRouteCanonicalIds, Object.values(DIFFERENT_IDS))

  const approvedPayloadControl = evaluateCase({
    caseId: 'case-9-approved-payload-lifecycle-control',
    input: buildInput({ artifact: canonicalArtifact, approvedRoute: canonicalRoute, itinerary }),
    route: canonicalRoute,
    artifact: canonicalArtifact,
    status: 'CANONICAL CONTROL PASSES',
    producingLayer: 'Application lifecycle approved payload',
    incomingCarrier: 'ContractEntryArtifact.approvedPayload.finalRoute',
    currentBehavior: 'approvedPayloadRouteCanonical remains legitimate pre-lock authority when complete canonical IDs match',
    ruledFutureBehavior: 'preserve approvedPayload lifecycle authority; it is not part of display-name substitution',
  })
  assert.equal(approvedPayloadControl.snapshot.lockReadyCanonicalRouteTruthCandidate?.source, 'contract_entry_artifact.approved_payload')
  assert(approvedPayloadControl.lockInput.ok)

  const a3ThreeIsolation = evaluateCase({
    caseId: 'case-10-a3-3-isolation',
    input: buildInput({ artifact: displayOnlyArtifact, route: canonicalRoute, itinerary }),
    route: canonicalRoute,
    artifact: displayOnlyArtifact,
    status: 'CURRENT BEHAVIOR CONFIRMED',
    producingLayer: 'display-only artifact with complete canonical runtime venue IDs',
    incomingCarrier: 'ContractEntryArtifact + RuntimeRouteArtifact',
    currentBehavior: 'display-name branch is reachable without providerRecordId/sourceStopId substitution because runtime venueIds are complete',
    ruledFutureBehavior: 'A3-4 correction can reject missing artifact role IDs without changing A3-3 provider/source fallback',
  })
  assert(a3ThreeIsolation.lockInput.ok)
  assert.deepEqual(a3ThreeIsolation.row.selectedRouteCanonicalIds, Object.values(CANONICAL_IDS))

  const displayLeakPayload = buildLockedLiveArtifactPayload({
    ...missingArtifactIdsMatchingNames.lockInput.input,
    sessionId: 'a3-4-display-name-substitution-lock',
    lockedAt: 1,
  })
  assert.equal(validateLockedLiveArtifactSessionPayload(displayLeakPayload).ok, true)
  const displayLeakSanitized = sanitizeLiveArtifactSessionPayload(displayLeakPayload)
  assert(displayLeakSanitized?.finalRoute)
  assert.deepEqual(routeIds(displayLeakSanitized.finalRoute), Object.values(CANONICAL_IDS))
  const displayLeakSave = saveLockedLiveArtifactSession({
    ...missingArtifactIdsMatchingNames.lockInput.input,
    sessionId: 'a3-4-display-name-substitution-lock',
    lockedAt: 1,
  })
  assert.equal(displayLeakSave.ok, true)
  const returnedSession = loadLiveArtifactSession()
  assert(returnedSession?.finalRoute)
  assert.deepEqual(routeIds(returnedSession.finalRoute), Object.values(CANONICAL_IDS))
  saveSharedLiveArtifactPlan('a3-4-display-name-substitution-plan', displayLeakPayload)
  const returnedPlan = loadSharedLiveArtifactPlan('a3-4-display-name-substitution-plan')
  assert(returnedPlan?.finalRoute)
  assert.deepEqual(routeIds(returnedPlan.finalRoute), Object.values(CANONICAL_IDS))
  const lceContract = buildLceRuntimeContract({
    source: 'a3-4-display-name-authority-substitution',
    mutationKind: 'continuation',
    phase: 'confirm',
    runtimeRouteArtifact: missingArtifactIdsMatchingNames.lockInput.input.canonicalRouteArtifact.finalRoute,
    userConfirmed: true,
  })
  assert.equal(assertLceRuntimeMutationMayCommit(lceContract).ok, true)

  const cases = [
    canonical.row,
    canonicalMismatch.row,
    missingArtifactIdsMatchingNames.row,
    missingArtifactIdsDifferentNames.row,
    completeIdsDifferentNames.row,
    normalizationWhitespace.row,
    normalizationPunctuation.row,
    routeOrder.row,
    duplicateNameCollision.row,
    approvedPayloadControl.row,
    a3ThreeIsolation.row,
  ]

  const result = {
    status: 'PASS',
    judgment: 'A3-4 DISPLAY-NAME AUTHORITY SUBSTITUTION PROVEN',
    isolationJudgment: 'A3-4 PRODUCTION CORRECTION IS ISOLATABLE FROM A3-3',
    upstreamOwnershipJudgment:
      'UPSTREAM ARTIFACT IDENTITY CONTRACT IS ALREADY COMPLETE - DISPLAY-NAME FALLBACK IS DEFENSIVE BUT PROHIBITED',
    providerCallsAttempted: fetchCalls.length,
    systemTrace: {
      orderedSeam:
        'Interpretation canonical identity -> Bearings identity preservation -> Waypoint approved route -> ContractEntryArtifact.approvedPayload.finalRoute -> RuntimeRouteArtifact roles/stops -> routeAuthority carrier selection -> compareRouteToArtifact -> canonical-ID comparison -> display-name fallback -> equality verdict -> Review/Lock -> lock input -> save/session/Plans -> Live/LCE',
      rightfulOwners: {
        canonicalRouteIdentity: 'Interpretation/Bearings route-bearing physical identity',
        approvedRouteCoordination: 'Waypoint coordinates sequence from admitted identity',
        artifactAuthority: 'ContractEntryArtifact.approvedPayload.finalRoute before lock, RuntimeRouteArtifact after lock',
        displayName: 'Application presentation only; never identity authority',
      },
    },
    staticTrace,
    comparisonPrecedence: ['artifact role id vs route stable ID candidates', 'normalized displayName fallback only when artifact role id is absent'],
    exactFallbackTrigger:
      'compareRouteToArtifact uses display names when artifactRoleIdentities returns a role identity with displayName but no id; this occurs when canonicalRouteRoleCoverage/storySpine names exist while support[].venueId and anchorRole-derived id are absent for that role.',
    cases,
    downstreamImpact: {
      matchingNamesWithMissingArtifactIdsCanAffectEquality: true,
      matchingNamesWithMissingArtifactIdsCanAffectReviewEligibility: true,
      matchingNamesWithMissingArtifactIdsCanAffectLockEligibility: true,
      matchingNamesWithMissingArtifactIdsCanAffectArtifactMaterialization: true,
      matchingNamesWithMissingArtifactIdsCanSurviveSaveSessionPlans: true,
      matchingNamesWithMissingArtifactIdsCanReachLceThroughValidSession: true,
      completeCanonicalIdsPreventDisplayNameSubstitution: true,
      completeCanonicalIdsAllowPresentationNameDrift: true,
      duplicateNamesCanCollapseUnprovenArtifactIdentity: true,
      routeOrderChangeWithPreservedRoleIdsCurrentlyLockable: true,
      approvedPayloadRouteCanonicalIsLegitimateAuthority: true,
      a3ThreeProviderSourceFallbackRequiredForA3FourLeak: false,
    },
    minimumChangeMap: [
      {
        exactFile: 'src/app/services/routeAuthority/routeAuthorityService.ts',
        exactSymbolOrBranch: 'compareRouteToArtifact display-name branch after `if (expected.id)`',
        currentTrigger:
          'ContractEntryArtifact role identity has displayName but no canonical id after canonicalRouteRoleCoverage/support and anchorRole processing.',
        currentSelectedComparison: 'normalizeText(expected.displayName) === normalizeText(stop.displayName)',
        intendedRuledResult:
          'Do not treat displayName equality as approved-route/runtime-artifact equality; fail lock-readiness honestly when canonical role ID comparison is unavailable.',
        rightfulFailureCarrier: 'RouteAuthoritySnapshot.rejectionReasons plus RouteAuthorityLockInputDiagnostics.rejectionReason',
        upstreamDependency:
          'Approved artifact path must continue producing canonical role IDs before routeAuthority can prove equality.',
        downstreamConsumers: DOWNSTREAM_CONSUMERS,
        identityAndEqualityImpact:
          'Presentation names no longer substitute for artifact role venue identity; exact canonical IDs remain authoritative.',
        reviewLockImpact: 'Review/Lock eligibility must fail when artifact role IDs are missing and only names match.',
        artifactImpact: 'RuntimeRouteArtifact materialization must not be authorized by display-name equality.',
        saveSessionLceImpact:
          'Canonical complete routes preserve continuity; display-name-only equality stops before save/session/Plans/LCE.',
        compatibilityImpact:
          'Legacy/page-local diagnostics may continue reporting name mismatches but cannot author lock-ready truth.',
        requiredRegressionProofs: [
          'A3-4 display-name substitution proof',
          'A3-3 provider/source substitution proof',
          'A3 route authority characterization',
          'routeAuthority shadow proof',
          'ContractEntryArtifact lineage proof',
          'Build Review/Lock handoff proof',
          'phase2 cross-mode save/session proof',
          'A1/A2 identity ingress proofs',
        ],
        bigWireApprovalRequirement: 'required',
      },
    ],
    nonCoverage: [
      {
        condition: 'browser-rendered Review/Lock/Plans UI equality',
        whyNotCovered: 'A3-4 uses service and storage carriers only; browser rendering is a later Application proof lane.',
        blocksA3FourRuling: false,
        rightfulLaterProofLane: 'browser Review/Lock/Plans display proof',
      },
      {
        condition: 'governed-live provider route that omits artifact role IDs',
        whyNotCovered: 'Provider calls are forbidden in A3-4.',
        blocksA3FourRuling: false,
        rightfulLaterProofLane: 'governed-live provider validation',
      },
      {
        condition: 'presentation-normalization design',
        whyNotCovered: 'Normalization was characterized only; no display-name normalization work is authorized.',
        blocksA3FourRuling: false,
        rightfulLaterProofLane: 'A3-5 or later UI/presentation normalization ruling if needed',
      },
    ],
    protectedBehavior: {
      productionBehaviorChanged: false,
      equalityBehaviorChanged: false,
      a3ThreeFallbackChanged: false,
      routeOutputOrCanonicalIdentityChanged: false,
      eligibilityOrGreatStopBehaviorChanged: false,
      artifactShapeOrMaterializationChanged: false,
      reviewLockBehaviorChanged: false,
      applicationSaveSessionPlansLceBehaviorChanged: false,
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
