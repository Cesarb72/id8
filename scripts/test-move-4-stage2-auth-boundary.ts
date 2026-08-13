import assert from 'node:assert/strict'
import type { Session } from '@supabase/supabase-js'
import {
  clearPendingLockedPlanClaim,
  consumePendingLockedPlanClaim,
  PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY,
  preservePendingLockedPlanClaim,
  readPendingLockedPlanClaim,
  type PendingLockedPlanClaimStorage,
} from '../src/app/lifecycle/pendingLockedPlanClaim.ts'
import { createSupabaseBrowserClient } from '../src/app/lifecycle/supabase/supabaseBrowserClient.ts'
import {
  parseSupabaseBrowserLifecycleEnv,
  parseSupabaseServerLifecycleEnv,
} from '../src/app/lifecycle/supabase/supabaseLifecycleEnv.ts'
import {
  createSupabaseIdentitySessionAdapter,
  type SupabaseAuthBoundary,
} from '../src/app/lifecycle/supabase/supabaseIdentitySession.ts'
import {
  buildCompositionEvidenceRouteIdentitySignature,
  type CompositionEvidenceLineage,
} from '../src/domain/artifacts/compositionEvidenceLineage.ts'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { LiveArtifactSessionPayload } from '../src/domain/live/liveArtifactSession.ts'
import { validateLockedLiveArtifactSessionPayload } from '../src/domain/live/validateLiveArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`Move 4 Stage 2 proof must not call fetch: ${String(input)}`)
}) as typeof fetch

const publicEnv = {
  VITE_ID8_SUPABASE_URL: 'https://rjkjxgdxbauasbgortic.supabase.co',
  VITE_ID8_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_stage2proof_abcdefghijklmnopqrstuvwxyz',
  VITE_ID8_APP_ORIGIN: 'http://localhost:5173',
}

const serverEnv = {
  ...publicEnv,
  ID8_SUPABASE_URL: publicEnv.VITE_ID8_SUPABASE_URL,
  ID8_SUPABASE_PUBLISHABLE_KEY: publicEnv.VITE_ID8_SUPABASE_PUBLISHABLE_KEY,
  ID8_SUPABASE_SECRET_KEY: ['sb', 'secret', 'stage2proof', 'abcdefghijklmnopqrstuvwxyz'].join('_'),
  ID8_APP_ORIGIN: publicEnv.VITE_ID8_APP_ORIGIN,
}

class MemoryStorage implements Storage, PendingLockedPlanClaimStorage {
  private values = new Map<string, string>()

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const routeIds = {
  start: 'venue-start',
  highlight: 'venue-highlight',
  windDown: 'venue-wind-down',
}

function titleForRole(role: UserStopRole): ItineraryStop['title'] {
  if (role === 'windDown') {
    return 'Wind Down'
  }
  return role === 'start' ? 'Start' : role === 'highlight' ? 'Highlight' : 'Surprise'
}

function itineraryStop(role: UserStopRole, index: number): ItineraryStop {
  const title = titleForRole(role)
  const venueId = role === 'windDown' ? routeIds.windDown : routeIds[role as 'start' | 'highlight']
  return {
    id: venueId,
    role,
    title,
    venueId,
    venueName: `${title} Venue`,
    formattedAddress: '1 San Jose Way',
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    city: 'San Jose',
    category: 'bar',
    subcategory: 'proof',
    priceTier: '$$',
    tags: ['proof'],
    vibeTags: ['cozy'],
    neighborhood: 'Downtown',
    driveMinutes: index === 0 ? 0 : 8,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: 'Proof stop',
    imageUrl: 'https://example.test/move-4-stage2-proof.jpg',
    stopInsider: {
      roleReason: 'Proof role',
      localSignal: 'Proof signal',
      selectionReason: 'Proof selection',
    },
  }
}

function runtimeStop(role: 'start' | 'highlight' | 'windDown', index: number): RuntimeRouteStop {
  const venueId = routeIds[role]
  const title = titleForRole(role)
  return {
    id: venueId,
    sourceStopId: venueId,
    displayName: `${title} Venue`,
    providerRecordId: venueId,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    address: '1 San Jose Way',
    role,
    stopIndex: index,
    venueId,
    title: `${title} Venue`,
    subtitle: 'Proof stop',
    neighborhood: 'Downtown',
    driveMinutes: index === 0 ? 0 : 8,
    imageUrl: 'https://example.test/move-4-stage2-proof.jpg',
  }
}

function buildValidPayload(overrides: Partial<LiveArtifactSessionPayload> = {}): LiveArtifactSessionPayload {
  const itinerary: Itinerary = {
    id: 'itinerary-move-4-stage2-proof',
    title: 'Move 4 Stage 2 proof route',
    city: 'San Jose',
    crew: 'romantic',
    vibes: ['cozy'],
    stops: [
      itineraryStop('start', 0),
      itineraryStop('highlight', 1),
      itineraryStop('windDown', 2),
    ],
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: '2.5 hr',
    routeFeelLabel: 'Tight',
    story: {
      headline: 'Move 4 Stage 2 proof',
      subtitle: 'Identity boundary evidence',
    },
    shareSummary: 'Move 4 Stage 2 proof route.',
  }
  const stops = [
    runtimeStop('start', 0),
    runtimeStop('highlight', 1),
    runtimeStop('windDown', 2),
  ]
  const finalRoute: RuntimeRouteArtifact = {
    routeId: 'runtime-move-4-stage2-proof',
    selectedDirectionId: 'direction-move-4-stage2',
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Move 4 Stage 2 proof route',
    routeSummary: 'Identity boundary proof route.',
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1,
  }
  const compositionEvidenceLineage: CompositionEvidenceLineage = {
    schemaVersion: 'composition_evidence_lineage.v0_1',
    source: 'contract_entry_artifact.generation',
    approvedAt: 1,
    approvedCandidateId: 'arc-move-4-stage2-proof',
    approvedRouteIdentitySignature: buildCompositionEvidenceRouteIdentitySignature(routeIds),
    approvedRouteIdentity: routeIds,
    inputCarrier: {
      routeShapeContractId: 'route-shape-move-4-stage2',
      conciergeIntentId: 'concierge-intent-move-4-stage2',
      experienceContractId: 'experience-contract-move-4-stage2',
      contractConstraintsId: 'contract-constraints-move-4-stage2',
      routeShapeProjectionId: 'projection-move-4-stage2',
      selectedDirectionId: 'direction-move-4-stage2',
      selectedPocketId: 'pocket-move-4-stage2',
    },
    taste: {
      source: 'taste.experience_composition.v0_1',
      status: 'pass',
      requirementSource: 'route_shape_contract',
      routeShapeContractId: 'route-shape-move-4-stage2',
      score: 0.91,
      startContributionStatus: 'pass',
      highlightContributionStatus: 'pass',
      windDownContributionStatus: 'pass',
      startPreparesHighlightStatus: 'pass',
      windDownResolvesHighlightStatus: 'pass',
      reasonCodes: [],
      unavailableEvidence: [],
    },
    waypoint: {
      enforcementActive: true,
      routeShapeContractId: 'route-shape-move-4-stage2',
      projectionId: 'projection-move-4-stage2',
      selectedCandidateId: 'arc-move-4-stage2-proof',
      selectedCandidateRank: 1,
      eligibleCandidateCount: 1,
      failureReasons: [],
    },
    bearings: {
      status: 'pass',
      reasonCodes: [],
    },
    greatStop: {
      status: 'PASS',
      selectedCandidateId: 'arc-move-4-stage2-proof',
      selectedCandidateRank: 1,
      failedCriteria: [],
      reasonCodes: [],
    },
  }
  return {
    sessionId: 'session-move-4-stage2-proof',
    city: 'San Jose',
    itinerary,
    selectedClusterConfirmation: 'Move 4 Stage 2 proof confirmed.',
    initialActiveRole: 'highlight',
    lockedAt: 1,
    finalRoute,
    compositionEvidenceLineage,
    ...overrides,
  }
}

function sessionFor(userId: string): Session {
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 10000,
    refresh_token: 'mock-refresh-token',
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
      email: `${userId}@example.test`,
    },
  } as Session
}

class MockAuth implements SupabaseAuthBoundary {
  session: Session | null = null
  sessionError: { message: string } | null = null
  signInError: { message: string } | null = null
  signOutError: { message: string } | null = null
  getSessionCalls = 0
  signInCalls = 0
  signOutCalls = 0
  exchangeCalls = 0
  observed: Array<(event: string, session: Session | null) => void> = []
  lastRedirect: string | null = null

  async getSession() {
    this.getSessionCalls += 1
    return {
      data: { session: this.session },
      error: this.sessionError,
    }
  }

  async signInWithOtp(input: { email: string; options: { emailRedirectTo: string } }) {
    this.signInCalls += 1
    this.lastRedirect = input.options.emailRedirectTo
    return {
      data: {},
      error: this.signInError,
    }
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    this.observed.push(callback)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.observed = this.observed.filter((entry) => entry !== callback)
          },
        },
      },
    }
  }

  async signOut() {
    this.signOutCalls += 1
    return {
      error: this.signOutError,
    }
  }

  async exchangeCodeForSession() {
    this.exchangeCalls += 1
    return {
      data: { session: this.session },
      error: null,
    }
  }

  emit(event: string, session: Session | null): void {
    for (const callback of this.observed) {
      callback(event, session)
    }
  }
}

const browserParsed = parseSupabaseBrowserLifecycleEnv(publicEnv)
assert.equal(browserParsed.ok, true)
assert.equal(browserParsed.ok ? browserParsed.value.projectRef : null, 'rjkjxgdxbauasbgortic')
assert.equal(browserParsed.ok ? browserParsed.value.authCallbackUrl : null, 'http://localhost:5173/auth/callback')
assert.deepEqual(
  browserParsed.ok ? Object.keys(browserParsed.value).sort() : [],
  ['appOrigin', 'authCallbackUrl', 'projectRef', 'projectUrl', 'publishableKey'].sort(),
)

const browserWithSecret = parseSupabaseBrowserLifecycleEnv(serverEnv)
assert.equal(browserWithSecret.ok, false)
assert.equal(browserWithSecret.ok ? null : browserWithSecret.code, 'secret_in_browser_env')

const serverParsed = parseSupabaseServerLifecycleEnv(serverEnv)
assert.equal(serverParsed.ok, true)
assert.equal(serverParsed.ok ? serverParsed.value.projectRef : null, 'rjkjxgdxbauasbgortic')
assert.equal(serverParsed.ok ? serverParsed.value.authCallbackUrl : null, 'http://localhost:5173/auth/callback')

const missing = parseSupabaseBrowserLifecycleEnv({
  VITE_ID8_SUPABASE_PUBLISHABLE_KEY: publicEnv.VITE_ID8_SUPABASE_PUBLISHABLE_KEY,
  VITE_ID8_APP_ORIGIN: publicEnv.VITE_ID8_APP_ORIGIN,
})
assert.equal(missing.ok, false)
assert.equal(missing.ok ? null : missing.code, 'missing_env')

const blank = parseSupabaseBrowserLifecycleEnv({
  ...publicEnv,
  VITE_ID8_APP_ORIGIN: ' ',
})
assert.equal(blank.ok, false)
assert.equal(blank.ok ? null : blank.code, 'blank_env')

const malformed = parseSupabaseBrowserLifecycleEnv({
  ...publicEnv,
  VITE_ID8_SUPABASE_URL: 'not-a-url',
})
assert.equal(malformed.ok, false)
assert.equal(malformed.ok ? null : malformed.code, 'malformed_url')

const mixed = parseSupabaseServerLifecycleEnv({
  ...serverEnv,
  VITE_ID8_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
})
assert.equal(mixed.ok, false)
assert.equal(mixed.ok ? null : mixed.code, 'mixed_project')

const storage = new MemoryStorage()
assert.equal(fetchCalls, 0)
const client = createSupabaseBrowserClient(browserParsed.ok ? browserParsed.value : never(), {
  storage,
  fetch: globalThis.fetch,
})
assert(client.auth)
assert.equal(fetchCalls, 0)

const auth = new MockAuth()
const adapter = createSupabaseIdentitySessionAdapter({
  auth,
  config: browserParsed.ok ? browserParsed.value : never(),
})
const missingSession = await adapter.readSession()
assert.equal(missingSession.ok, true)
assert.equal(missingSession.ok ? missingSession.value.status : null, 'unauthenticated')

auth.session = sessionFor('user-stage2')
const restoredA = await adapter.readSession()
const restoredB = await adapter.readSession()
assert.equal(restoredA.ok, true)
assert.equal(restoredB.ok, true)
assert.equal(restoredA.ok && restoredA.value.status === 'authenticated' ? restoredA.value.userId : null, 'user-stage2')
assert.equal(
  restoredB.ok && restoredB.value.status === 'authenticated' ? restoredB.value.userId : null,
  restoredA.ok && restoredA.value.status === 'authenticated' ? restoredA.value.userId : null,
)

auth.sessionError = { message: 'mock session failure' }
const sessionError = await adapter.readSession()
assert.equal(sessionError.ok, false)
assert.equal(sessionError.ok ? null : sessionError.code, 'provider_error')
auth.sessionError = null
auth.session = { ...sessionFor(''), user: { ...sessionFor('x').user, id: '' } }
const invalidSession = await adapter.readSession()
assert.equal(invalidSession.ok, false)
assert.equal(invalidSession.ok ? null : invalidSession.code, 'invalid_session')
auth.session = sessionFor('user-stage2')

const observed: string[] = []
const subscription = adapter.observeAuthStateChanges((state) => {
  observed.push(state.ok ? state.value.status : state.code)
})
auth.emit('SIGNED_IN', sessionFor('user-stage2'))
auth.emit('SIGNED_OUT', null)
assert.deepEqual(observed, ['authenticated', 'unauthenticated'])
subscription.unsubscribe()
auth.emit('SIGNED_IN', sessionFor('user-stage2-again'))
assert.deepEqual(observed, ['authenticated', 'unauthenticated'])

const signOut = await adapter.signOut()
assert.equal(signOut.ok, true)
assert.equal(auth.signOutCalls, 1)
auth.signOutError = { message: 'mock sign-out failure' }
const failedSignOut = await adapter.signOut()
assert.equal(failedSignOut.ok, false)
assert.equal(failedSignOut.ok ? null : failedSignOut.code, 'provider_error')
auth.signOutError = null

assert.equal(auth.signInCalls, 0)
const authRequest = await adapter.requestEmailAuthTransition({
  email: 'user@example.test',
})
assert.equal(authRequest.ok, true)
assert.equal(auth.signInCalls, 1)
assert.equal(auth.lastRedirect, 'http://localhost:5173/auth/callback')
auth.signInError = { message: 'mock auth request failure' }
const failedAuthRequest = await adapter.requestEmailAuthTransition({
  email: 'user@example.test',
})
assert.equal(failedAuthRequest.ok, false)
assert.equal(failedAuthRequest.ok ? null : failedAuthRequest.code, 'provider_error')
auth.signInError = null

const completedCallback = await adapter.completeAuthCallback({
  currentUrl: 'http://localhost:5173/auth/callback?code=mock-code',
})
assert.equal(completedCallback.ok, true)
assert.equal(completedCallback.ok ? completedCallback.value.status : null, 'completed')
assert.equal(auth.exchangeCalls, 1)

const payload = buildValidPayload()
assert.equal(validateLockedLiveArtifactSessionPayload(clone(payload)).ok, true)
const pendingStorage = new MemoryStorage()
const preserved = preservePendingLockedPlanClaim({
  storage: pendingStorage,
  payload,
})
assert.equal(preserved.ok, true)
const beforeAuthPayload = preserved.ok ? clone(preserved.value.payload) : null
payload.finalRoute!.routeHeadline = 'caller mutation after preserve'
const afterAuthRead = readPendingLockedPlanClaim({ storage: pendingStorage })
assert.equal(afterAuthRead.ok, true)
assert.deepEqual(afterAuthRead.ok ? afterAuthRead.value.payload : null, beforeAuthPayload)
assert.equal(afterAuthRead.ok ? afterAuthRead.value.lifecycleState : null, 'pending_auth_continuity')
assert.equal(afterAuthRead.ok ? afterAuthRead.value.durableSaveState : null, 'not_saved')

const invalidPayload = preservePendingLockedPlanClaim({
  storage: new MemoryStorage(),
  payload: { ...clone(buildValidPayload()), finalRoute: null },
})
assert.equal(invalidPayload.ok, false)
assert.equal(invalidPayload.ok ? null : invalidPayload.code, 'invalid_locked_payload')

const routeMismatchPayload = clone(buildValidPayload())
routeMismatchPayload.finalRoute!.stops[1]!.sourceStopId = 'missing-source-stop'
const routeMismatch = preservePendingLockedPlanClaim({
  storage: new MemoryStorage(),
  payload: routeMismatchPayload,
})
assert.equal(routeMismatch.ok, false)
assert.equal(routeMismatch.ok ? null : routeMismatch.code, 'route_binding_mismatch')

const lineageMismatchPayload = clone(buildValidPayload())
lineageMismatchPayload.compositionEvidenceLineage!.approvedRouteIdentity.highlight = 'stale-highlight'
lineageMismatchPayload.compositionEvidenceLineage!.approvedRouteIdentitySignature =
  buildCompositionEvidenceRouteIdentitySignature(
    lineageMismatchPayload.compositionEvidenceLineage!.approvedRouteIdentity,
  )
const lineageMismatch = preservePendingLockedPlanClaim({
  storage: new MemoryStorage(),
  payload: lineageMismatchPayload,
})
assert.equal(lineageMismatch.ok, false)
assert.equal(lineageMismatch.ok ? null : lineageMismatch.code, 'lineage_binding_mismatch')

const corruptStorage = new MemoryStorage()
corruptStorage.setItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY, '{')
const corrupt = readPendingLockedPlanClaim({ storage: corruptStorage })
assert.equal(corrupt.ok, false)
assert.equal(corrupt.ok ? null : corrupt.code, 'corrupt_claim')
assert.equal(corruptStorage.getItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY), null)

const mismatchStorage = new MemoryStorage()
assert.equal(preservePendingLockedPlanClaim({ storage: mismatchStorage, payload: buildValidPayload() }).ok, true)
const storedClaim = JSON.parse(mismatchStorage.getItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY) ?? '{}') as {
  routeBinding: { routeId: string }
}
storedClaim.routeBinding.routeId = 'stale-route-id'
mismatchStorage.setItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY, JSON.stringify(storedClaim))
const storedMismatch = readPendingLockedPlanClaim({ storage: mismatchStorage })
assert.equal(storedMismatch.ok, false)
assert.equal(storedMismatch.ok ? null : storedMismatch.code, 'route_binding_mismatch')
assert.equal(mismatchStorage.getItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY), null)

const consumeStorage = new MemoryStorage()
const consumePreserve = preservePendingLockedPlanClaim({ storage: consumeStorage, payload: buildValidPayload() })
assert.equal(consumePreserve.ok, true)
const consumed = consumePendingLockedPlanClaim({ storage: consumeStorage })
assert.equal(consumed.ok, true)
assert.equal(consumeStorage.getItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY), null)

const clearStorage = new MemoryStorage()
assert.equal(preservePendingLockedPlanClaim({ storage: clearStorage, payload: buildValidPayload() }).ok, true)
const cleared = clearPendingLockedPlanClaim({ storage: clearStorage })
assert.equal(cleared.ok, true)
assert.equal(clearStorage.getItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY), null)

const claimEnvelope = JSON.parse(pendingStorage.getItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY) ?? '{}') as Record<string, unknown>
assert.equal('planId' in claimEnvelope, false)
assert.equal('saveOperationId' in claimEnvelope, false)
assert.equal('shareVersionId' in claimEnvelope, false)
assert.equal(claimEnvelope.durableSaveState, 'not_saved')
assert.equal(claimEnvelope.lifecycleState, 'pending_auth_continuity')
assert.equal(fetchCalls, 0)

function never(): never {
  throw new Error('Expected preceding parse to pass.')
}

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'move4_stage2_auth_boundary',
      providerCalls: 0,
      fetchCalls,
      externalNetworkCalls: 0,
      mockedAuthDelegations: {
        getSession: auth.getSessionCalls,
        signInWithOtp: auth.signInCalls,
        signOut: auth.signOutCalls,
        exchangeCodeForSession: auth.exchangeCalls,
      },
      redirectTarget: auth.lastRedirect,
      pendingClaim: {
        lifecycleState: claimEnvelope.lifecycleState,
        durableSaveState: claimEnvelope.durableSaveState,
        manufacturesPlanId: 'planId' in claimEnvelope,
        manufacturesSaveOperationId: 'saveOperationId' in claimEnvelope,
        manufacturesShareVersionId: 'shareVersionId' in claimEnvelope,
      },
      failures: {
        browserSecret: browserWithSecret.ok ? null : browserWithSecret.code,
        missing: missing.ok ? null : missing.code,
        blank: blank.ok ? null : blank.code,
        malformed: malformed.ok ? null : malformed.code,
        mixed: mixed.ok ? null : mixed.code,
        sessionError: sessionError.ok ? null : sessionError.code,
        invalidSession: invalidSession.ok ? null : invalidSession.code,
        failedSignOut: failedSignOut.ok ? null : failedSignOut.code,
        failedAuthRequest: failedAuthRequest.ok ? null : failedAuthRequest.code,
        invalidPayload: invalidPayload.ok ? null : invalidPayload.code,
        routeMismatch: routeMismatch.ok ? null : routeMismatch.code,
        lineageMismatch: lineageMismatch.ok ? null : lineageMismatch.code,
        corrupt: corrupt.ok ? null : corrupt.code,
        storedMismatch: storedMismatch.ok ? null : storedMismatch.code,
      },
    },
    null,
    2,
  ),
)
