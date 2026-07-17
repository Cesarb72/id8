import { curatedVenues } from '../src/data/venues'
import { applyFieldCorpusRuntimeHoursAdmission } from '../src/domain/bearings/fieldCorpusRuntimeHoursAdmission'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus'
import { computeFieldRealVerdict } from '../src/domain/field/computeFieldRealVerdict'
import { buildProviderPublicLiveEnvelope } from '../src/domain/providers/buildProviderPublicLiveWiring'
import {
  buildProviderSourceOpportunity,
  type BuildProviderRoleCandidateReviewSummary,
  type BuildProviderSourceOpportunityResult,
} from '../src/domain/providers/buildProviderSourceOpportunity'
import type { ProviderVenue } from '../src/domain/providers/providerTypes'
import type { PlanningTimeWindowSignal } from '../src/domain/types/hours'
import type { Venue } from '../src/domain/types/venue'

const FIELD_PROXY_PATH = '/api/field/text-search'

type Scenario =
  | 'role-diverse'
  | 'thin-world-provider-insufficient-role-diversity'
  | 'fallback-masked-role-diversity-collapse'

type RoleName = 'start' | 'highlight' | 'windDown'

type FailureSummary = Record<
  RoleName,
  {
    hoursSuppressed: number
    qualityGateNotApproved: number
  }
>

const originalFetch = globalThis.fetch
const originalEnv = {
  VITE_ID8_BUILD_PROVIDER_SUPPLY: process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY,
}

let directProviderFetchAttemptCount = 0
let unexpectedFetchAttemptCount = 0
let fieldProxyFetchAttemptCount = 0
let mockProviderScenario: Scenario = 'role-diverse'

globalThis.fetch = (async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    directProviderFetchAttemptCount += 1
    throw new Error(`Direct provider fetch is forbidden in hours/source-quality readout: ${url}`)
  }
  if (url !== FIELD_PROXY_PATH) {
    unexpectedFetchAttemptCount += 1
    throw new Error(`Unexpected fetch path in hours/source-quality readout: ${url}`)
  }

  fieldProxyFetchAttemptCount += 1
  const requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
  const mockedResults = buildMockProviderVenues(
    String(requestBody.queryLabel ?? ''),
    mockProviderScenario,
  )

  return new Response(
    JSON.stringify({
      ok: true,
      cache: 'miss',
      budget: {
        date: '2026-07-16',
        cap: 3,
        used: fieldProxyFetchAttemptCount,
        remaining: Math.max(0, 3 - fieldProxyFetchAttemptCount),
      },
      results: mockedResults,
      diagnostics: {
        purpose: 'waypoint_nearby',
        queryHash: `hours-source-quality-seam-${mockProviderScenario}`,
        providerStatus: 'mocked',
        resultCount: mockedResults.length,
        callConsumed: true,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function emptyFailureSummary(): FailureSummary {
  return {
    start: {
      hoursSuppressed: 0,
      qualityGateNotApproved: 0,
    },
    highlight: {
      hoursSuppressed: 0,
      qualityGateNotApproved: 0,
    },
    windDown: {
      hoursSuppressed: 0,
      qualityGateNotApproved: 0,
    },
  }
}

function summarizeReviewFailures(
  reviews: readonly BuildProviderRoleCandidateReviewSummary[],
): FailureSummary {
  const summary = emptyFailureSummary()
  for (const review of reviews) {
    for (const role of ['start', 'highlight', 'windDown'] as const) {
      if (review[role].failedReasons.includes('hours_suppressed')) {
        summary[role].hoursSuppressed += 1
      }
      if (review[role].failedReasons.includes('quality_gate_not_approved')) {
        summary[role].qualityGateNotApproved += 1
      }
    }
  }
  return summary
}

function recomputeReviewFailures(
  reviews: readonly BuildProviderRoleCandidateReviewSummary[],
): FailureSummary {
  const summary = emptyFailureSummary()
  for (const review of reviews) {
    for (const role of ['start', 'highlight', 'windDown'] as const) {
      if (review.hoursSuppressionApplied) {
        summary[role].hoursSuppressed += 1
      }
      if (review.qualityGateStatus !== 'approved') {
        summary[role].qualityGateNotApproved += 1
      }
    }
  }
  return summary
}

async function runProviderScenario(
  scenario: Scenario,
  anchorVenue: Venue,
): Promise<{
  fieldProxyHits: number
  result: BuildProviderSourceOpportunityResult
}> {
  mockProviderScenario = scenario
  directProviderFetchAttemptCount = 0
  unexpectedFetchAttemptCount = 0
  fieldProxyFetchAttemptCount = 0

  return {
    fieldProxyHits: fieldProxyFetchAttemptCount,
    result: await buildProviderSourceOpportunity({
      anchorVenue,
      liveEnvelope: buildProviderPublicLiveEnvelope(),
    }),
  }
}

function planningWindow(): PlanningTimeWindowSignal {
  return {
    day: 2,
    hour: 20,
    minute: 15,
    phase: 'evening',
    label: 'Defaulted now Tuesday 8:15 PM',
    source: 'when_planning_window',
    usesIntentWindow: false,
    whenProjection: {
      posture: 'now_doable_tonight',
      strictness: 'soft',
      whenDefaulted: true,
      source: 'defaulted',
      broadFuture: false,
      actualRuntimeClockUsed: true,
    },
  }
}

function cloneVenue(id: string, patch: Partial<Venue>): Venue {
  const base = curatedVenues[0]
  assert(base, 'Expected curated venue fixture base.')
  return {
    ...base,
    ...patch,
    id,
    name: patch.name ?? id,
    source: {
      ...base.source,
      ...(patch.source ?? {}),
    },
  }
}

function fieldRealReadout() {
  const approved = cloneVenue('hours-quality-approved-record', {
    name: 'Hours Quality Approved Record',
    source: {
      ...curatedVenues[0]!.source,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      qualityGateStatus: 'approved',
      hoursSuppressionApplied: false,
      suppressionReasons: [],
      demotionReasons: [],
    },
  })
  const suppressed = cloneVenue('hours-quality-suppressed-record', {
    name: 'Hours Quality Suppressed Record',
    source: {
      ...curatedVenues[0]!.source,
      openNow: false,
      hoursKnown: true,
      likelyOpenForCurrentWindow: false,
      qualityGateStatus: 'suppressed',
      hoursSuppressionApplied: true,
      suppressionReasons: ['observer_hours_source_quality_suppressed'],
      demotionReasons: [],
    },
  })
  const verdict = computeFieldRealVerdict([
    {
      role: 'warmup',
      venue: approved,
      candidateIdentity: {
        candidateId: approved.id,
        baseVenueId: approved.id,
        kind: 'base',
        traceLabel: 'approved-record',
      },
    },
    {
      role: 'peak',
      venue: suppressed,
      candidateIdentity: {
        candidateId: suppressed.id,
        baseVenueId: suppressed.id,
        kind: 'base',
        traceLabel: 'suppressed-record',
      },
    },
  ])

  return {
    status: verdict.status,
    realReady: verdict.realReady,
    failureReasons: verdict.failureReasons,
    stopEvidence: verdict.stopEvidence.map((stop) => ({
      baseVenueId: stop.identity.candidateIdentityBaseVenueId,
      availabilityStatus: stop.availability.availabilityStatus,
      suppressionStatus: stop.quality.suppressionStatus,
      qualityGateStatus: stop.quality.qualityGateStatus,
      failureReasons: stop.failureReasons,
    })),
  }
}

function bearingsRuntimeHoursReadout() {
  const admission = applyFieldCorpusRuntimeHoursAdmission(
    sanJoseProviderCorpusVenues,
    planningWindow(),
  )

  return {
    evaluatedCount: admission.diagnostics.evaluatedCount,
    requiredCount: admission.diagnostics.requiredCount,
    openCount: admission.diagnostics.openCount,
    closedBlockedCount: admission.diagnostics.closedBlockedCount,
    unknownAdmittedCount: admission.diagnostics.unknownAdmittedCount,
    admittedCount: admission.diagnostics.admittedCount,
    blockedCount: admission.diagnostics.blockedCount,
    sampledBlockedVenues: admission.diagnostics.sampledBlockedVenues.slice(0, 3),
  }
}

function buildMockProviderVenues(queryLabel: string, scenario: Scenario): ProviderVenue[] {
  if (scenario === 'thin-world-provider-insufficient-role-diversity') {
    return [
      buildMockProviderVenue({
        displayName: `Thin World ${queryLabel}`,
        latitude: 37.3307,
        longitude: -121.8871,
        neighborhood: 'SoFA District',
        primaryType: 'cafe',
        providerRecordId: `mock-thin-world-${queryLabel}`,
      }),
    ]
  }

  if (scenario === 'fallback-masked-role-diversity-collapse') {
    if (queryLabel === 'build-provider-start') {
      return [
        buildMockProviderVenue({
          displayName: 'Role Diversity Honest Opener',
          latitude: 37.3307,
          longitude: -121.8871,
          neighborhood: 'SoFA District',
          primaryType: 'cafe',
          providerRecordId: 'mock-role-diversity-honest-start',
        }),
      ]
    }
    if (queryLabel === 'build-provider-highlight') {
      return [
        buildMockProviderVenue({
          displayName: 'Role Diversity Honest Support',
          latitude: 37.331,
          longitude: -121.887,
          neighborhood: 'SoFA District',
          primaryType: 'cafe',
          providerRecordId: 'mock-role-diversity-honest-support',
        }),
      ]
    }
    if (queryLabel === 'build-provider-winddown') {
      return [
        buildMockProviderVenue({
          displayName: 'Role Diversity Honest Wind Down',
          latitude: 37.3359,
          longitude: -121.8894,
          neighborhood: 'Downtown',
          primaryType: 'dessert',
          providerRecordId: 'mock-role-diversity-honest-winddown',
        }),
      ]
    }
    return []
  }

  if (queryLabel === 'build-provider-start') {
    return [
      buildMockProviderVenue({
        displayName: 'Role Diversity Pass Start',
        latitude: 37.3307,
        longitude: -121.8871,
        neighborhood: 'SoFA District',
        primaryType: 'cafe',
        providerRecordId: 'mock-role-diversity-pass-start',
      }),
    ]
  }
  if (queryLabel === 'build-provider-highlight') {
    return [
      buildMockProviderVenue({
        displayName: 'Role Diversity Pass Highlight',
        latitude: 37.3481,
        longitude: -121.8944,
        neighborhood: 'Japantown',
        primaryType: 'restaurant',
        providerRecordId: 'mock-role-diversity-pass-highlight',
      }),
    ]
  }
  if (queryLabel === 'build-provider-winddown') {
    return [
      buildMockProviderVenue({
        displayName: 'Role Diversity Pass Wind Down',
        latitude: 37.3359,
        longitude: -121.8894,
        neighborhood: 'Downtown',
        primaryType: 'dessert',
        providerRecordId: 'mock-role-diversity-pass-winddown',
      }),
    ]
  }
  return []
}

function buildMockProviderVenue(input: {
  displayName: string
  latitude: number
  longitude: number
  neighborhood: string
  primaryType: string
  providerRecordId: string
}): ProviderVenue {
  return {
    provider: 'google_places',
    providerRecordId: input.providerRecordId,
    displayName: input.displayName,
    formattedAddress: `${input.displayName}, ${input.neighborhood}, San Jose, CA`,
    shortFormattedAddress: `${input.neighborhood}, San Jose`,
    primaryType: input.primaryType,
    types: [input.primaryType, 'point_of_interest', 'establishment'],
    liveMusic: false,
    servesBeer: true,
    servesWine: true,
    goodForGroups: true,
    goodForChildren: false,
    allowsDogs: false,
    servesVegetarianFood: false,
    editorialSummary: `${input.displayName} mocked 2A-2a provider record.`,
    businessStatus: 'OPERATIONAL',
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    regularOpeningHours: {
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    rating: 4.6,
    userRatingCount: 120,
    utcOffsetMinutes: -420,
    websiteUri: 'https://example.test',
    location: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt: 1782691200000,
    completenessHints: {
      hasAddress: true,
      hasLocation: true,
      hasHours: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

async function main(): Promise<void> {
  try {
    process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = 'true'
    const anchorVenue = curatedVenues.find((venue) => venue.id === 'sj-paper-plane')
    assert(anchorVenue, 'Paper Plane venue must exist.')

    const providerCases = []
    for (const scenario of [
      'role-diverse',
      'thin-world-provider-insufficient-role-diversity',
      'fallback-masked-role-diversity-collapse',
    ] as const) {
      const { result } = await runProviderScenario(scenario, anchorVenue)
      const oldSummary = summarizeReviewFailures(
        result.diagnostics.roleCandidateReviewSummaries,
      )
      const observedSummary = recomputeReviewFailures(
        result.diagnostics.roleCandidateReviewSummaries,
      )
      assert(
        JSON.stringify(oldSummary) === JSON.stringify(observedSummary),
        `${scenario}: provider role review hours/source-quality failure summary drifted.`,
      )
      providerCases.push({
        case: scenario,
        consumer: 'buildProviderSourceOpportunity role eligibility diagnostics',
        oldResult: oldSummary,
        observedResult: observedSummary,
        match: true,
        emitted: result.diagnostics.buildProviderSourceOpportunityEmitted,
        blockedReason: result.diagnostics.buildProviderSupplyBlockedReason,
        nearbyVenueCount: result.diagnostics.buildProviderNearbyVenueCount,
      })
    }

    const fieldReal = fieldRealReadout()
    assert(fieldReal.status === 'fail', 'Field Real suppressed fixture must fail record truth.')
    assert(
      fieldReal.failureReasons.includes('real:suppressed_record'),
      'Field Real readout must expose suppressed record truth.',
    )

    const bearingsRuntimeHours = bearingsRuntimeHoursReadout()
    assert(
      bearingsRuntimeHours.evaluatedCount === sanJoseProviderCorpusVenues.length,
      'Bearings runtime-hours admission must evaluate the static Field corpus.',
    )

    process.stdout.write(
      `${JSON.stringify(
        {
          observer: 'hours_source_quality_seam_readout',
          providerCases,
          fieldReal: {
            case: 'curated record-truth fixture',
            consumer: 'FieldRealVerdict',
            oldResult: 'suppressed record fails Field Real',
            observedResult: fieldReal,
            match: true,
          },
          bearingsRuntimeHours: {
            case: 'San Jose static provider corpus',
            consumer: 'applyFieldCorpusRuntimeHoursAdmission',
            oldResult: 'central Bearings runtime-hours admission evaluates Field corpus facts',
            observedResult: bearingsRuntimeHours,
            match: true,
          },
          staticOnlyConsumers: [
            {
              consumer: 'retrieval scoring/filtering',
              status: 'static_readout_only',
              reason: 'retrieval score/lift paths read source quality and hours pressure across broad generation flows',
            },
            {
              consumer: 'app/public diagnostics',
              status: 'static_readout_only',
              reason: 'debug/public projections render existing source fields; no provider-free product UI harness was run here',
            },
            {
              consumer: 'Great Stop / Gate 1 owner signals',
              status: 'covered_by_existing_observers',
              reason: 'Field Real and Bearings signals are exercised by existing Great Stop/lifecycle/Gate 1 observers',
            },
          ],
          providerSafety: {
            directProviderFetchAttemptCount,
            unexpectedFetchAttemptCount,
          },
        },
        null,
        2,
      )}\n`,
    )
    process.stdout.write('hours/source-quality seam readout: passed\n')
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
