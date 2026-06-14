import { starterPacks } from '../src/data/starterPacks.ts'
import { buildCanonicalPublicRouteFlowTruth, buildArtifactBackedVisibleItinerary } from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { buildContractEntryRuntimeRouteLockTruth } from '../src/app/services/live/contractEntryLockHandoff.ts'
import { buildLockedLiveArtifactPayload } from '../src/app/services/live/liveSessionHandoff.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import {
  loadSharedLiveArtifactPlan,
  saveSharedLiveArtifactPlan,
} from '../src/domain/live/liveArtifactSession.ts'
import { validateLockedLiveArtifactSessionPayload } from '../src/domain/live/validateLiveArtifact.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ExperienceMode, IntentInput, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'
import type { Itinerary } from '../src/domain/types/itinerary.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const originalFetch = globalThis.fetch
const originalFlagValue = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Canonical route truth continuity test must not call fetch.')
}

interface Scenario {
  mode: ExperienceMode
  input: IntentInput
  starterPack?: StarterPack
}

class MemoryStorage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  clear(): void {
    this.values.clear()
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function buildScenarios(): Scenario[] {
  const starterPack = findStarterPack('coffee-books')
  return [
    {
      mode: 'curate',
      starterPack,
      input: {
        mode: 'curate',
        persona: starterPack.personaBias ?? null,
        primaryVibe: starterPack.primaryAnchor,
        secondaryVibe: starterPack.secondaryAnchors?.[0],
        city: 'San Jose',
        distanceMode: starterPack.distanceMode ?? 'nearby',
        prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
      },
    },
    {
      mode: 'surprise',
      input: {
        mode: 'surprise',
        persona: 'friends',
        primaryVibe: 'cultured',
        secondaryVibe: 'lively',
        city: 'San Jose',
        distanceMode: 'nearby',
        prefersHiddenGems: true,
      },
    },
    {
      mode: 'build',
      input: {
        mode: 'build',
        planningMode: 'user-led',
        persona: 'romantic',
        primaryVibe: 'cozy',
        secondaryVibe: 'cultured',
        city: 'San Jose',
        distanceMode: 'nearby',
        prefersHiddenGems: false,
      },
    },
  ]
}

function setEnv(): void {
  globalThis.fetch = fetchTrap
  process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = '1'
  process.env.VITE_ID8_SOURCE_MODE = 'curated'
  delete process.env.VITE_GOOGLE_PLACES_API_KEY
}

function restoreEnv(): void {
  globalThis.fetch = originalFetch
  if (originalFlagValue === undefined) {
    delete process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
  } else {
    process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = originalFlagValue
  }
  if (originalSourceMode === undefined) {
    delete process.env.VITE_ID8_SOURCE_MODE
  } else {
    process.env.VITE_ID8_SOURCE_MODE = originalSourceMode
  }
  if (originalGoogleKey === undefined) {
    delete process.env.VITE_GOOGLE_PLACES_API_KEY
  } else {
    process.env.VITE_GOOGLE_PLACES_API_KEY = originalGoogleKey
  }
}

function buildDryLockSafeItinerary(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    stops: itinerary.stops.map((stop, index) => ({
      ...stop,
      imageUrl: stop.imageUrl || `https://example.test/dry-validation/${index + 1}.jpg`,
      formattedAddress:
        stop.formattedAddress ?? `Dry validation address ${index + 1}, San Jose, CA`,
      latitude: stop.latitude ?? 37.33 + index * 0.001,
      longitude: stop.longitude ?? -121.89 - index * 0.001,
    })),
  }
}

function buildDryLockSafeScoredVenues(result: Awaited<ReturnType<typeof runGeneratePlan>>) {
  const stopByVenueId = new Map(result.itinerary.stops.map((stop) => [stop.venueId, stop] as const))
  return result.scoredVenues.map((candidate, index) => {
    const stop = stopByVenueId.get(candidate.venue.id)
    return {
      ...candidate,
      venue: {
        ...candidate.venue,
        source: {
          ...candidate.venue.source,
          formattedAddress:
            candidate.venue.source.formattedAddress ??
            stop?.formattedAddress ??
            `Dry validation address ${index + 1}, San Jose, CA`,
          latitude: candidate.venue.source.latitude ?? stop?.latitude ?? 37.33 + index * 0.001,
          longitude: candidate.venue.source.longitude ?? stop?.longitude ?? -121.89 - index * 0.001,
        },
      },
    }
  })
}

async function main(): Promise<void> {
  setEnv()
  const originalWindow = (globalThis as { window?: unknown }).window
  const memoryStorage = new MemoryStorage()
  ;(globalThis as { window?: unknown }).window = {
    location: {
      pathname: '/dry-validation',
      search: '',
    },
    localStorage: memoryStorage,
    sessionStorage: new MemoryStorage(),
  }
  const summaries = []

  try {
    for (const scenario of buildScenarios()) {
      const result = await runGeneratePlan(scenario.input, {
        starterPack: scenario.starterPack,
        sourceMode: 'curated',
        sourceModeOverrideApplied: true,
      })
      const dryLockSafeItinerary = buildDryLockSafeItinerary(result.itinerary)
      const dryLockSafeScoredVenues = buildDryLockSafeScoredVenues(result)
      const artifact = result.contractEntryArtifact
      const flowTruth = buildCanonicalPublicRouteFlowTruth(artifact, {
        mode: scenario.mode,
        starterPack: scenario.starterPack ?? null,
      })
      assert(flowTruth.allowed, `${scenario.mode}: canonical public flow truth must be allowed.`)
      assert(flowTruth.visibleCard, `${scenario.mode}: visible card projection must exist.`)
      assert(flowTruth.review, `${scenario.mode}: review projection must exist.`)
      assert(flowTruth.reveal, `${scenario.mode}: reveal projection must exist.`)
      assert(flowTruth.lock, `${scenario.mode}: lock projection must exist.`)
      assert(flowTruth.plans, `${scenario.mode}: plans projection must exist.`)

      const artifactBackedItinerary = buildArtifactBackedVisibleItinerary({
        artifact,
        itinerary: dryLockSafeItinerary,
        context: {
          mode: scenario.mode,
          starterPack: scenario.starterPack ?? null,
        },
      })
      assert(artifactBackedItinerary, `${scenario.mode}: visible itinerary must be artifact-backed.`)

      const selectedDirectionId =
        artifact.selection.directionId ?? result.trace.selectedDistrictId ?? `dry:${scenario.mode}`
      const selectedClusterConfirmation =
        result.trace.selectedDistrictLabel || artifact.districtAnchorLine || 'Dry validation route'
      const persona = (result.intentProfile.persona ?? scenario.input.persona ?? 'friends') as PersonaMode
      const vibe = result.intentProfile.primaryAnchor as VibeAnchor
      const lockTruth = buildContractEntryRuntimeRouteLockTruth({
        artifact,
        itinerary: artifactBackedItinerary,
        scoredVenues: dryLockSafeScoredVenues,
        selectedDirectionId,
        selectedClusterConfirmation,
        city: artifactBackedItinerary.city,
        persona,
        vibe,
        mode: scenario.mode,
      })
      assert(
        lockTruth.ok,
        `${scenario.mode}: lock must produce RuntimeRouteArtifact (${lockTruth.ok ? 'ok' : lockTruth.reason}).`,
      )

      const visibleRoles = flowTruth.visibleCard.routeTitle
      assert(flowTruth.review.routeTitle === visibleRoles, `${scenario.mode}: visible card route = review route.`)
      assert(flowTruth.reveal.headline === flowTruth.review.routeTitle, `${scenario.mode}: review route = reveal route.`)
      assert(
        lockTruth.finalRoute.routeHeadline === flowTruth.reveal.headline,
        `${scenario.mode}: reveal route = lock route.`,
      )
      assert(
        lockTruth.finalRoute.stops.map((stop) => stop.displayName).join('|') ===
          [
            flowTruth.review.routeRoles.start,
            flowTruth.review.routeRoles.highlight,
            flowTruth.review.routeRoles.windDown,
          ].join('|'),
        `${scenario.mode}: RuntimeRouteArtifact stops must match review roles.`,
      )

      const payload = buildLockedLiveArtifactPayload({
        canonicalRouteArtifact: {
          selectedClusterConfirmation,
          itinerary: lockTruth.itinerary,
          finalRoute: lockTruth.finalRoute,
        },
        lockSafeItineraryStops: lockTruth.lockSafeItineraryStops,
        activeRole: 'start',
        fallbackCity: artifactBackedItinerary.city,
        lockedAt: 1_787_000_000_000,
        sessionId: `dry-${scenario.mode}`,
      })
      const validatedPayload = validateLockedLiveArtifactSessionPayload(payload)
      assert(
        validatedPayload.ok,
        `${scenario.mode}: locked payload must validate (${
          validatedPayload.ok ? 'ok' : `${validatedPayload.error.code}: ${validatedPayload.error.detail}`
        }).`,
      )
      saveSharedLiveArtifactPlan(`dry-${scenario.mode}`, payload)
      const reopened = loadSharedLiveArtifactPlan(`dry-${scenario.mode}`)
      assert(reopened, `${scenario.mode}: saved plan must reopen.`)
      assert(
        reopened.finalRoute?.routeId === payload.finalRoute?.routeId,
        `${scenario.mode}: Plans Hub save/reopen must preserve RuntimeRouteArtifact.`,
      )
      assert(
        reopened.finalRoute?.stops.map((stop) => stop.displayName).join('|') ===
          payload.finalRoute?.stops.map((stop) => stop.displayName).join('|'),
        `${scenario.mode}: Plans Hub save/reopen must preserve same route.`,
      )

      summaries.push({
        mode: scenario.mode,
        artifactId: artifact.id,
        visibleCardRoute: flowTruth.visibleCard.routeTitle,
        reviewRoute: flowTruth.review.routeTitle,
        revealRoute: flowTruth.reveal.headline,
        runtimeRouteId: lockTruth.finalRoute.routeId,
        liveProviderUsed: artifact.enrichment?.fieldProvenanceSummary?.liveProviderUsed,
        providerValve: 'closed',
        dryValidationOnly: true,
      })
    }
  } finally {
    ;(globalThis as { window?: unknown }).window = originalWindow
  }

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('canonical route truth continuity: passed\n')
  process.stdout.write(`${JSON.stringify({ fetchCallCount, summaries }, null, 2)}\n`)
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    restoreEnv()
  })
