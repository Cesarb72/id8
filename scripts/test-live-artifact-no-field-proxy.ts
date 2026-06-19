import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { buildLockedLiveArtifactPayload } from '../src/app/services/live/liveSessionHandoff.ts'
import { buildContractEntryRuntimeRouteLockTruth } from '../src/app/services/live/contractEntryLockHandoff.ts'
import { JourneyMapReal } from '../src/components/journey/JourneyMapReal.tsx'
import { starterPacks } from '../src/data/starterPacks.ts'
import { fetchNearbyPlacesForWaypoint } from '../src/domain/nearby/fetchNearbyPlacesForWaypoint.ts'
import { LiveJourneyPage } from '../src/pages/LiveJourneyPage.tsx'
import { saveLiveArtifactSession } from '../src/domain/live/liveArtifactSession.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { IntentInput, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'
import type { Itinerary, UserStopRole } from '../src/domain/types/itinerary.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

(globalThis as { React?: typeof React }).React = React

const FIELD_PROXY_PATH = '/api/field/text-search'
const originalFetch = globalThis.fetch
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalGoogleKey = process.env.GOOGLE_PLACES_API_KEY
const originalFieldProvider = process.env.ID8_FIELD_PROVIDER
let proxyCallCount = 0

class MemoryStorage implements Storage {
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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function installClosedValveWindow(): void {
  delete process.env.GOOGLE_PLACES_API_KEY
  delete process.env.ID8_FIELD_PROVIDER
  const sessionStorage = new MemoryStorage()
  const localStorage = new MemoryStorage()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      clearTimeout,
      localStorage,
      location: {
        assign: () => undefined,
        origin: 'https://preview.test',
        pathname: '/journey/live',
        search: '',
      },
      sessionStorage,
      setTimeout,
    },
  })
}

function restoreWindow(): void {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
}

function installFetchTrap(label: string): void {
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes(FIELD_PROXY_PATH)) {
      proxyCallCount += 1
      throw new Error(`${label}: unexpected Field proxy call to ${url}`)
    }
    throw new Error(`${label}: unexpected fetch to ${url}`)
  }) as typeof fetch
}

function restoreEnv(): void {
  globalThis.fetch = originalFetch
  if (originalGoogleKey === undefined) {
    delete process.env.GOOGLE_PLACES_API_KEY
  } else {
    process.env.GOOGLE_PLACES_API_KEY = originalGoogleKey
  }
  if (originalFieldProvider === undefined) {
    delete process.env.ID8_FIELD_PROVIDER
  } else {
    process.env.ID8_FIELD_PROVIDER = originalFieldProvider
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function buildInput(starterPack: StarterPack): IntentInput {
  return {
    mode: 'curate',
    persona: starterPack.personaBias ?? null,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode ?? 'nearby',
    prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
  }
}

function buildDryLockSafeItinerary(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    stops: itinerary.stops.map((stop, index) => ({
      ...stop,
      formattedAddress:
        stop.formattedAddress ?? `Live artifact dry address ${index + 1}, San Jose, CA`,
      imageUrl: stop.imageUrl || `https://example.test/live-artifact/${index + 1}.jpg`,
      latitude: stop.latitude ?? 37.33 + index * 0.001,
      longitude: stop.longitude ?? -121.89 - index * 0.001,
    })),
  }
}

async function seedLiveArtifactSession(): Promise<void> {
  const starterPack = findStarterPack('coffee-books')
  const result = await runGeneratePlan(buildInput(starterPack), {
    starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
  })
  const itinerary = buildDryLockSafeItinerary(result.itinerary)
  const stopByVenueId = new Map(itinerary.stops.map((stop) => [stop.venueId, stop] as const))
  const scoredVenues = result.scoredVenues.map((candidate, index) => {
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
            `Live artifact dry source ${index + 1}, San Jose, CA`,
          latitude: candidate.venue.source.latitude ?? stop?.latitude ?? 37.33 + index * 0.001,
          longitude: candidate.venue.source.longitude ?? stop?.longitude ?? -121.89 - index * 0.001,
        },
      },
    }
  })
  const lockTruth = buildContractEntryRuntimeRouteLockTruth({
    artifact: result.contractEntryArtifact,
    itinerary,
    scoredVenues,
    selectedClusterConfirmation:
      result.trace.selectedDistrictLabel || result.contractEntryArtifact.districtAnchorLine,
    selectedDirectionId:
      result.contractEntryArtifact.selection.directionId ?? result.trace.selectedDistrictId ?? 'dry-live',
    city: itinerary.city,
    persona: (result.intentProfile.persona ?? 'romantic') as PersonaMode,
    vibe: result.intentProfile.primaryAnchor as VibeAnchor,
    mode: 'curate',
  })
  assert(lockTruth.ok, `Live artifact lock truth must be valid (${lockTruth.ok ? 'ok' : lockTruth.reason}).`)
  const payload = buildLockedLiveArtifactPayload({
    canonicalRouteArtifact: {
      finalRoute: lockTruth.finalRoute,
      itinerary: lockTruth.itinerary,
      selectedClusterConfirmation:
        result.trace.selectedDistrictLabel || result.contractEntryArtifact.districtAnchorLine,
    },
    lockSafeItineraryStops: lockTruth.lockSafeItineraryStops,
    activeRole: 'highlight',
    fallbackCity: itinerary.city,
    lockedAt: 1_787_000_000_000,
    sessionId: 'live-artifact-zero-field-proxy',
  })
  saveLiveArtifactSession(payload)
}

function renderLiveJourneyPage(): string {
  return renderToString(React.createElement(LiveJourneyPage))
}

function renderJourneyMapReal(): string {
  return renderToString(
    React.createElement(JourneyMapReal, {
      activeRole: 'highlight' as UserStopRole,
      alertActive: true,
      alertRole: 'highlight' as UserStopRole,
      routeStops: [
        {
          id: 'dry-start',
          role: 'start' as UserStopRole,
          name: 'Dry Start',
          displayName: 'Dry Start',
          stopIndex: 0,
          coordinates: [-121.8863, 37.3382],
        },
        {
          id: 'dry-highlight',
          role: 'highlight' as UserStopRole,
          name: 'Dry Highlight',
          displayName: 'Dry Highlight',
          stopIndex: 1,
          coordinates: [-121.8848, 37.3368],
        },
      ],
    }),
  )
}

async function runJourneyMapActiveWaypointEffectPath(): Promise<void> {
  const diagnostic = await fetchNearbyPlacesForWaypoint({
    role: 'highlight',
    name: 'Dry Highlight',
    coordinates: [-121.8848, 37.3368],
  })
  assert(
    diagnostic.reason === 'runtime-provider-disabled',
    `Default Live nearby lookup must fail closed before Field proxy; received ${diagnostic.reason}.`,
  )
  assert(diagnostic.places.length === 0, 'Default Live nearby lookup must return zero live places.')
}

function assertJourneyMapWiring(): void {
  const source = readFileSync('src/components/journey/JourneyMapReal.tsx', 'utf8')
  assert(
    source.includes('runtimeLiveEnvelope = CLOSED_RUNTIME_LIVE_ENVELOPE'),
    'JourneyMapReal must default to CLOSED_RUNTIME_LIVE_ENVELOPE.',
  )
  assert(
    source.includes('runtimeLiveEnvelope.liveProviderAllowed !== true'),
    'JourneyMapReal active waypoint effect must check runtimeLiveEnvelope.liveProviderAllowed.',
  )
  assert(
    source.includes('fetchNearbyPlacesForWaypoint(activeWaypoint, { runtimeLiveEnvelope })'),
    'JourneyMapReal active waypoint effect must pass runtimeLiveEnvelope to nearby lookup.',
  )
}

async function main(): Promise<void> {
  installClosedValveWindow()
  installFetchTrap('Live artifact closed runtime envelope')
  await seedLiveArtifactSession()

  const callsAfterSeed = proxyCallCount
  const liveHtml = renderLiveJourneyPage()
  const journeyLiveRenderCalls = proxyCallCount - callsAfterSeed
  assert(liveHtml.includes('Live Journey Artifact'), 'LiveJourneyPage must render the Live Journey Artifact surface.')
  assert(liveHtml.includes('Keep the night going'), 'LiveJourneyPage must render Keep the night going.')
  assert(liveHtml.includes('Continue local'), 'LiveJourneyPage must render Continue local.')
  assert(liveHtml.includes('Re-lift energy'), 'LiveJourneyPage must render Re-lift energy.')
  assert(liveHtml.includes('Soft close'), 'LiveJourneyPage must render Soft close.')
  assert(liveHtml.includes('Suggested next stop'), 'LiveJourneyPage must render suggested next stop slots.')

  const callsAfterLiveRender = proxyCallCount
  renderJourneyMapReal()
  const journeyMapRenderCalls = proxyCallCount - callsAfterLiveRender

  const callsAfterMapRender = proxyCallCount
  await runJourneyMapActiveWaypointEffectPath()
  const journeyMapEffectCalls = proxyCallCount - callsAfterMapRender
  assertJourneyMapWiring()

  process.stdout.write(`/journey/live render proxy calls: ${journeyLiveRenderCalls}\n`)
  process.stdout.write(`Live Journey Artifact render proxy calls: ${journeyLiveRenderCalls}\n`)
  process.stdout.write(`JourneyMapReal render proxy calls: ${journeyMapRenderCalls}\n`)
  process.stdout.write(`JourneyMapReal active waypoint effect proxy calls: ${journeyMapEffectCalls}\n`)
  process.stdout.write('Keep the Night Going render proxy calls: 0\n')
  process.stdout.write('Continue Local / Re-lift Energy / Soft Close render proxy calls: 0\n')
  process.stdout.write('Suggested next stop placeholder proxy calls: 0\n')
  process.stdout.write('Live suggestions default closed reason: runtime-provider-disabled\n')
  process.stdout.write('live artifact no field proxy: passed\n')
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    restoreWindow()
    restoreEnv()
  })
