import { readFileSync } from 'node:fs'
import { starterPacks } from '../src/data/starterPacks.ts'
import { curatedVenues } from '../src/data/venues.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import {
  projectFieldMechanicalBuildProviderTextSearchScaffold,
  projectFieldMechanicalLiveQueryScaffold,
  projectFieldMechanicalProviderTextSearchScaffold,
  type FieldMechanicalBuildProviderTextSearchScaffold,
  type FieldMechanicalProviderTextSearchScaffold,
} from '../src/domain/field/projectFieldMechanicalQueryScaffold.ts'
import { buildApplicationConciergeIntent } from '../src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts'
import {
  projectInterpretationBuildProviderSemanticQueryProjection,
  projectInterpretationSemanticLiveQueryProjection,
} from '../src/domain/interpretation/query/projectSemanticQueryProjection.ts'
import { buildProviderPublicLiveEnvelope } from '../src/domain/providers/buildProviderPublicLiveWiring.ts'
import {
  buildProviderSourceOpportunity,
  buildProviderSourceOpportunityConfig,
} from '../src/domain/providers/buildProviderSourceOpportunity.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import { buildLiveQueryPlan, type LiveQueryPlanEntry } from '../src/domain/sources/buildLiveQueryPlan.ts'
import { fetchLivePlaces } from '../src/domain/sources/fetchLivePlaces.ts'
import type { IntentProfile } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import type { Venue } from '../src/domain/types/venue.ts'
import { buildWhenSignalProfile } from '../src/domain/when/whenSignalProfile.ts'

type QuerySnapshotRow = {
  case: string
  currentPath: string
  queryLabels: string[]
  textQueries: string[]
  sourceFamilyOrKind: string[]
  provenanceTerms: string[][]
  centersRadius: Array<{ center: { lat: number; lng: number } | null; radiusMeters: number | null }>
  sourceMode: string
  envelopeCaps: {
    maxProviderCalls?: number
    maxQueryLabels?: number
    maxCenters?: number
  } | null
  fieldMaskPageSize: {
    fieldMask: string[] | string | null
    pageSize: number | null
  }
  plannedCalls: number
  attemptedCalls: number
  providerCalls: number
}

type QueryOutputComparison = {
  case: string
  oldMixedQueryOutput: {
    queryLabels: string[]
    textQueries: string[]
    sourceFamilyOrKind: string[]
    provenanceTerms: string[][]
  }
  newInterpretationProjection: {
    queryLabels: string[]
    textQueries: string[]
    sourceFamilyOrKind: string[]
    provenanceTerms: string[][]
  }
  fieldMechanicalScaffold: {
    queryLabels: string[]
    textQueries: string[]
    sourceFamilyOrKind: string[]
    provenanceTerms: string[][]
  }
  textQueryLabelsMatch: boolean
  sourceFamilyMatch: boolean
  provenanceTermsMatch: boolean
  fieldTextQueryLabelsMatch: boolean
  fieldSourceFamilyMatch: boolean
  fieldProvenanceTermsMatch: boolean
}

type FieldMechanicalScaffoldRow = {
  case: string
  sourceMode: string
  envelopeCaps: QuerySnapshotRow['envelopeCaps']
  fieldMaskPageSize: QuerySnapshotRow['fieldMaskPageSize']
  centersRadius: QuerySnapshotRow['centersRadius']
  plannedCalls: number
  attemptedCalls: number
  providerCalls: number
  labelsConsidered: number
  labelsAdmitted: number
  centersConsidered: number
  centersAdmitted: number
  plannedWithinCap: boolean
}

type RouteSnapshotRow = {
  case: string
  routePathExercised: boolean
  downstreamRouteOutputCaptured: boolean
  notes: string[]
}

const FIELD_PROXY_PATH = '/api/field/text-search'
const originalFetch = globalThis.fetch
const originalBuildProviderSupply = process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY

let activeMockCase = 'none'
let directProviderFetchAttemptCount = 0
let unexpectedFetchAttemptCount = 0
let fieldProxyAttemptCount = 0
let capturedRequests: FieldTextSearchRequest[] = []

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function baseIntent(patch: Partial<IntentProfile> = {}): IntentProfile {
  return {
    city: 'San Jose',
    crew: 'romantic',
    distanceMode: 'nearby',
    mode: 'build',
    persona: 'romantic',
    personaSource: 'explicit',
    planningMode: 'engine-led',
    prefersHiddenGems: false,
    primaryAnchor: 'cozy',
    timeWindow: 'evening',
    ...patch,
  }
}

function buildCanonicalSemanticProjectionInput(
  intent: IntentProfile,
  starterPack?: StarterPack,
  options: { locationLabelOverride?: string; locationScope?: 'city' | 'pocket' | 'anchor_nearby' } = {},
): Parameters<typeof projectInterpretationSemanticLiveQueryProjection>[0] {
  const persona = intent.persona ?? starterPack?.personaBias ?? 'romantic'
  return {
    conciergeIntent: buildApplicationConciergeIntent({
      mode: intent.mode,
      persona,
      primaryVibe: intent.primaryAnchor,
      city: intent.city,
      starterPack,
      anchor: intent.anchor,
    }),
    whenSignalProfile: buildWhenSignalProfile({
      whenPosture: 'pick_a_time',
      whenPostureSource: intent.timeWindow ? 'user_supplied' : 'defaulted',
      startTime: intent.timeWindow,
      durationMinutes: null,
      spatialMode: 'WALKABLE',
    }),
    placeContext: {
      city: intent.city,
      neighborhood: intent.neighborhood,
      locationLabelOverride: options.locationLabelOverride,
      locationScope: options.locationScope,
      originPrecision: intent.originPrecision,
      originSource: intent.originSource,
    },
    starterPack,
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  assert(starterPack, `Expected starter pack ${id}.`)
  return starterPack
}

function getPaperPlane(): Venue {
  const venue = curatedVenues.find((candidate) => candidate.id === 'sj-paper-plane')
  assert(venue, 'Expected Paper Plane in curated venues.')
  assert(
    typeof venue.source.latitude === 'number' && typeof venue.source.longitude === 'number',
    'Paper Plane must carry provider-source coordinates for Build provider query parity.',
  )
  return venue
}

function summarizeLiveQueryEntries(
  caseName: string,
  currentPath: string,
  entries: LiveQueryPlanEntry[],
): QuerySnapshotRow {
  return {
    case: caseName,
    currentPath,
    queryLabels: entries.map((entry) => entry.label),
    textQueries: entries.map((entry) => entry.textQuery),
    sourceFamilyOrKind: entries.map((entry) => entry.kind),
    provenanceTerms: entries.map((entry) => entry.queryTerms),
    centersRadius: [],
    sourceMode: 'not_dispatched',
    envelopeCaps: null,
    fieldMaskPageSize: {
      fieldMask: null,
      pageSize: null,
    },
    plannedCalls: 0,
    attemptedCalls: 0,
    providerCalls: 0,
  }
}

function extractGoogleFieldMaskFromSource(): string {
  const source = readFileSync('src/domain/sources/fetchLivePlaces.ts', 'utf8')
  const match = source.match(/const googleFieldMask = \[([\s\S]*?)\]\.join\(',?'\)/)
  assert(match, 'Expected fetchLivePlaces googleFieldMask constant.')
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]).join(',')
}

function resetFetchCapture(caseName: string): void {
  activeMockCase = caseName
  directProviderFetchAttemptCount = 0
  unexpectedFetchAttemptCount = 0
  fieldProxyAttemptCount = 0
  capturedRequests = []
}

function countProviderCalls(): number {
  return directProviderFetchAttemptCount + unexpectedFetchAttemptCount
}

function summarizeRequests(
  caseName: string,
  currentPath: string,
  options: {
    envelopeCaps: QuerySnapshotRow['envelopeCaps']
    fieldMask: QuerySnapshotRow['fieldMaskPageSize']['fieldMask']
    plannedCalls: number
    sourceFamilyOrKind: string[]
    sourceMode: string
  },
): QuerySnapshotRow {
  return {
    case: caseName,
    currentPath,
    queryLabels: capturedRequests.map((request) => request.queryLabel),
    textQueries: capturedRequests.map((request) => request.textQuery),
    sourceFamilyOrKind: options.sourceFamilyOrKind,
    provenanceTerms: capturedRequests.map((request) => tokenizeText(request.textQuery)),
    centersRadius: capturedRequests.map((request) => ({
      center: request.center ?? null,
      radiusMeters: request.radiusMeters ?? null,
    })),
    sourceMode: options.sourceMode,
    envelopeCaps: options.envelopeCaps,
    fieldMaskPageSize: {
      fieldMask: options.fieldMask,
      pageSize: capturedRequests[0]?.pageSize ?? null,
    },
    plannedCalls: options.plannedCalls,
    attemptedCalls: fieldProxyAttemptCount,
    providerCalls: countProviderCalls(),
  }
}

function queryOutputFromLiveEntries(entries: LiveQueryPlanEntry[]): QueryOutputComparison['oldMixedQueryOutput'] {
  return {
    queryLabels: entries.map((entry) => entry.label),
    textQueries: entries.map((entry) => entry.textQuery),
    sourceFamilyOrKind: entries.map((entry) => entry.kind),
    provenanceTerms: entries.map((entry) => entry.queryTerms),
  }
}

function queryOutputFromProviderQueries(
  queries: Array<{ queryLabel: string; textQuery: string }>,
  sourceFamilyOrKind: string[],
): QueryOutputComparison['oldMixedQueryOutput'] {
  return {
    queryLabels: queries.map((query) => query.queryLabel),
    textQueries: queries.map((query) => query.textQuery),
    sourceFamilyOrKind,
    provenanceTerms: queries.map((query) => tokenizeText(query.textQuery)),
  }
}

function queryOutputFromSnapshotRow(row: QuerySnapshotRow): QueryOutputComparison['oldMixedQueryOutput'] {
  return {
    queryLabels: row.queryLabels,
    textQueries: row.textQueries,
    sourceFamilyOrKind: row.sourceFamilyOrKind,
    provenanceTerms: row.provenanceTerms,
  }
}

function buildEmptyQueryOutput(): QueryOutputComparison['oldMixedQueryOutput'] {
  return {
    queryLabels: [],
    textQueries: [],
    sourceFamilyOrKind: [],
    provenanceTerms: [],
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function buildComparison(
  caseName: string,
  oldMixedQueryOutput: QueryOutputComparison['oldMixedQueryOutput'],
  newInterpretationProjection: QueryOutputComparison['newInterpretationProjection'],
  fieldMechanicalScaffold: QueryOutputComparison['fieldMechanicalScaffold'],
): QueryOutputComparison {
  const textQueryLabelsMatch =
    sameJson(oldMixedQueryOutput.queryLabels, newInterpretationProjection.queryLabels) &&
    sameJson(oldMixedQueryOutput.textQueries, newInterpretationProjection.textQueries)
  const sourceFamilyMatch = sameJson(
    oldMixedQueryOutput.sourceFamilyOrKind,
    newInterpretationProjection.sourceFamilyOrKind,
  )
  const provenanceTermsMatch = sameJson(
    oldMixedQueryOutput.provenanceTerms,
    newInterpretationProjection.provenanceTerms,
  )
  const fieldTextQueryLabelsMatch =
    sameJson(oldMixedQueryOutput.queryLabels, fieldMechanicalScaffold.queryLabels) &&
    sameJson(oldMixedQueryOutput.textQueries, fieldMechanicalScaffold.textQueries)
  const fieldSourceFamilyMatch = sameJson(
    oldMixedQueryOutput.sourceFamilyOrKind,
    fieldMechanicalScaffold.sourceFamilyOrKind,
  )
  const fieldProvenanceTermsMatch = sameJson(
    oldMixedQueryOutput.provenanceTerms,
    fieldMechanicalScaffold.provenanceTerms,
  )

  assert(textQueryLabelsMatch, `${caseName} text/query label parity failed.`)
  assert(sourceFamilyMatch, `${caseName} source family parity failed.`)
  assert(provenanceTermsMatch, `${caseName} provenance term parity failed.`)
  assert(fieldTextQueryLabelsMatch, `${caseName} Field scaffold text/query label parity failed.`)
  assert(fieldSourceFamilyMatch, `${caseName} Field scaffold source family parity failed.`)
  assert(fieldProvenanceTermsMatch, `${caseName} Field scaffold provenance term parity failed.`)

  return {
    case: caseName,
    oldMixedQueryOutput,
    newInterpretationProjection,
    fieldMechanicalScaffold,
    textQueryLabelsMatch,
    sourceFamilyMatch,
    provenanceTermsMatch,
    fieldTextQueryLabelsMatch,
    fieldSourceFamilyMatch,
    fieldProvenanceTermsMatch,
  }
}

function tokenizeText(value: string): string[] {
  return unique(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  )
}

function selectFirstDispatchOutput(
  entries: LiveQueryPlanEntry[],
  centerIds: string[],
  maxProviderCalls: number,
): QueryOutputComparison['newInterpretationProjection'] {
  const output: QueryOutputComparison['newInterpretationProjection'] = {
    queryLabels: [],
    textQueries: [],
    sourceFamilyOrKind: unique(entries.map((entry) => entry.kind)),
    provenanceTerms: [],
  }
  for (const entry of entries) {
    for (const centerId of centerIds) {
      if (output.queryLabels.length >= maxProviderCalls) {
        return output
      }
      output.queryLabels.push(`${entry.label}@${centerId}`)
      output.textQueries.push(entry.textQuery)
      output.provenanceTerms.push(tokenizeText(entry.textQuery))
    }
  }
  return output
}

function centersFromSnapshotRow(row: QuerySnapshotRow): Array<{ id: string; lat: number; lng: number }> {
  return row.centersRadius.map((entry, index) => {
    assert(entry.center, `${row.case} expected captured center ${index}.`)
    return {
      id: row.queryLabels[index]?.split('@')[1] ?? `center-${index}`,
      lat: entry.center.lat,
      lng: entry.center.lng,
    }
  })
}

function summarizeFieldProviderScaffold(
  row: QuerySnapshotRow,
  scaffold: FieldMechanicalProviderTextSearchScaffold,
): FieldMechanicalScaffoldRow {
  const centersRadius = scaffold.queries.map((query) => ({
    center: query.locationBias
      ? {
          lat: query.locationBias.circle.center.latitude,
          lng: query.locationBias.circle.center.longitude,
        }
      : null,
    radiusMeters: query.locationBias?.circle.radius ?? null,
  }))
  assert(sameJson(centersRadius, row.centersRadius), `${row.case} Field scaffold centers/radius drifted.`)
  assert(scaffold.plannedCalls === row.plannedCalls, `${row.case} Field scaffold planned calls drifted.`)
  assert(scaffold.queries.length === row.attemptedCalls, `${row.case} Field scaffold attempted calls drifted.`)
  assert(
    scaffold.queries.every((query) => query.fieldMask === row.fieldMaskPageSize.fieldMask),
    `${row.case} Field scaffold field mask drifted.`,
  )
  assert(
    scaffold.queries.every((query) => query.pageSize === row.fieldMaskPageSize.pageSize),
    `${row.case} Field scaffold page size drifted.`,
  )
  return {
    case: row.case,
    sourceMode: row.sourceMode,
    envelopeCaps: row.envelopeCaps,
    fieldMaskPageSize: row.fieldMaskPageSize,
    centersRadius,
    plannedCalls: scaffold.plannedCalls,
    attemptedCalls: scaffold.queries.length,
    providerCalls: 0,
    labelsConsidered: scaffold.labelsConsidered,
    labelsAdmitted: scaffold.labelsAdmitted,
    centersConsidered: scaffold.centersConsidered,
    centersAdmitted: scaffold.centersAdmitted,
    plannedWithinCap: scaffold.plannedWithinCap,
  }
}

function summarizeFieldBuildProviderScaffold(
  row: QuerySnapshotRow,
  scaffold: FieldMechanicalBuildProviderTextSearchScaffold,
): FieldMechanicalScaffoldRow {
  const centersRadius = scaffold.queries.map((query) => ({
    center: query.locationBias
      ? {
          lat: query.locationBias.circle.center.latitude,
          lng: query.locationBias.circle.center.longitude,
        }
      : null,
    radiusMeters: query.locationBias?.circle.radius ?? null,
  }))
  assert(sameJson(centersRadius, row.centersRadius), `${row.case} Field scaffold centers/radius drifted.`)
  assert(scaffold.plannedCalls === row.plannedCalls, `${row.case} Field scaffold planned calls drifted.`)
  assert(scaffold.queries.length === row.attemptedCalls, `${row.case} Field scaffold attempted calls drifted.`)
  assert(
    scaffold.queries.every((query) => query.fieldMask === row.fieldMaskPageSize.fieldMask),
    `${row.case} Field scaffold field mask drifted.`,
  )
  assert(
    scaffold.queries.every((query) => query.pageSize === row.fieldMaskPageSize.pageSize),
    `${row.case} Field scaffold page size drifted.`,
  )
  return {
    case: row.case,
    sourceMode: row.sourceMode,
    envelopeCaps: row.envelopeCaps,
    fieldMaskPageSize: row.fieldMaskPageSize,
    centersRadius,
    plannedCalls: scaffold.plannedCalls,
    attemptedCalls: scaffold.queries.length,
    providerCalls: 0,
    labelsConsidered: scaffold.labelsConsidered,
    labelsAdmitted: scaffold.labelsAdmitted,
    centersConsidered: row.centersRadius.length,
    centersAdmitted: row.centersRadius.length > 0 ? 1 : 0,
    plannedWithinCap: scaffold.plannedWithinCap,
  }
}

function buildMockProviderVenue(input: {
  displayName: string
  latitude: number
  longitude: number
  primaryType: string
  providerRecordId: string
  queryLabel: string
}): ProviderVenue {
  return {
    provider: 'google_places',
    providerRecordId: input.providerRecordId,
    displayName: input.displayName,
    formattedAddress: `${input.displayName}, San Jose, CA`,
    shortFormattedAddress: 'San Jose, CA',
    primaryType: input.primaryType,
    types: [input.primaryType, 'point_of_interest', 'establishment'],
    liveMusic: false,
    servesBeer: true,
    servesWine: true,
    goodForGroups: true,
    goodForChildren: false,
    allowsDogs: false,
    servesVegetarianFood: false,
    editorialSummary: `${input.displayName} mocked for query planner split parity.`,
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
      hasHours: true,
      hasLocation: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

function buildMockResultsForRequest(request: FieldTextSearchRequest): ProviderVenue[] {
  const center = request.center ?? { lat: 37.3382, lng: -121.8863 }

  if (activeMockCase === 'build-provider-mocked-safe') {
    if (request.queryLabel === 'build-provider-start') {
      return [
        buildMockProviderVenue({
          displayName: 'Query Planner Parity Start',
          latitude: 37.3307,
          longitude: -121.8871,
          primaryType: 'cafe',
          providerRecordId: 'query-planner-parity-start',
          queryLabel: request.queryLabel,
        }),
      ]
    }
    if (request.queryLabel === 'build-provider-highlight') {
      return [
        buildMockProviderVenue({
          displayName: 'Query Planner Parity Highlight',
          latitude: 37.3481,
          longitude: -121.8944,
          primaryType: 'restaurant',
          providerRecordId: 'query-planner-parity-highlight',
          queryLabel: request.queryLabel,
        }),
      ]
    }
    if (request.queryLabel === 'build-provider-winddown') {
      return [
        buildMockProviderVenue({
          displayName: 'Query Planner Parity Wind Down',
          latitude: 37.3359,
          longitude: -121.8894,
          primaryType: 'dessert',
          providerRecordId: 'query-planner-parity-winddown',
          queryLabel: request.queryLabel,
        }),
      ]
    }
  }

  return [
    buildMockProviderVenue({
      displayName: `Query Planner Parity ${request.queryLabel}`,
      latitude: center.lat,
      longitude: center.lng,
      primaryType: request.queryLabel.includes('bar') ? 'bar' : 'cafe',
      providerRecordId: `query-planner-${request.queryLabel}`,
      queryLabel: request.queryLabel,
    }),
  ]
}

globalThis.fetch = (async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    directProviderFetchAttemptCount += 1
    throw new Error(`Direct provider fetch is forbidden in 2C-1 parity observer: ${url}`)
  }
  if (url !== FIELD_PROXY_PATH) {
    unexpectedFetchAttemptCount += 1
    throw new Error(`Unexpected fetch path in 2C-1 parity observer: ${url}`)
  }

  fieldProxyAttemptCount += 1
  const request = JSON.parse(String(init?.body ?? '{}')) as FieldTextSearchRequest
  capturedRequests.push(request)
  const results = buildMockResultsForRequest(request)

  return new Response(
    JSON.stringify({
      ok: true,
      cache: 'mocked',
      budget: {
        date: '2026-07-16',
        cap: 32,
        used: fieldProxyAttemptCount,
        remaining: Math.max(0, 32 - fieldProxyAttemptCount),
      },
      results,
      diagnostics: {
        purpose: request.purpose,
        queryHash: `query-planner-split-parity:${activeMockCase}:${request.queryLabel}`,
        providerStatus: 'mocked_field_proxy',
        resultCount: results.length,
        callConsumed: false,
      },
    } satisfies FieldTextSearchResponse),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}) as typeof fetch

async function runGeneralNoProviderStatic(fieldMask: string): Promise<QuerySnapshotRow> {
  const caseName = 'general-live-retrieval-no-provider-static'
  resetFetchCapture(caseName)
  const result = await fetchLivePlaces(baseIntent({ mode: 'surprise' }), undefined, {
    maxQueryCenters: 0,
    sourceMode: 'curated',
    envelope: {
      maxProviderCalls: 0,
      maxQueryLabels: 0,
    },
  })
  assert(result.diagnostics.dispatchQueriesPlanned === 0, `${caseName} planned provider dispatch.`)
  assert(result.diagnostics.dispatchQueriesAttempted === 0, `${caseName} attempted provider dispatch.`)
  assert(fieldProxyAttemptCount === 0, `${caseName} hit the Field proxy.`)
  return {
    case: caseName,
    currentPath: 'fetchLivePlaces -> ProviderAdapter curated block',
    queryLabels: result.diagnostics.liveQueryLabelsUsed,
    textQueries: [],
    sourceFamilyOrKind: result.diagnostics.requestedKinds,
    provenanceTerms: [],
    centersRadius: result.diagnostics.queryCentersUsed.map((center) => ({
      center: { lat: center.lat, lng: center.lng },
      radiusMeters: result.diagnostics.queryRadiusM,
    })),
    sourceMode: 'curated',
    envelopeCaps: { maxProviderCalls: 0, maxQueryLabels: 0, maxCenters: 0 },
    fieldMaskPageSize: {
      fieldMask,
      pageSize: null,
    },
    plannedCalls: result.diagnostics.dispatchQueriesPlanned,
    attemptedCalls: result.diagnostics.dispatchQueriesAttempted,
    providerCalls: countProviderCalls(),
  }
}

async function runGeneralLiveMocked(fieldMask: string): Promise<QuerySnapshotRow> {
  const caseName = 'general-live-retrieval-mocked-safe'
  const envelope = { maxProviderCalls: 3, maxQueryLabels: 3, maxCenters: 3 }
  resetFetchCapture(caseName)
  const result = await fetchLivePlaces(baseIntent({ mode: 'surprise' }), undefined, {
    maxQueryCenters: envelope.maxCenters,
    sourceMode: 'live',
    envelope,
  })
  assert(result.diagnostics.dispatchQueriesPlanned === 3, `${caseName} planned-call drift.`)
  assert(result.diagnostics.dispatchQueriesAttempted === 3, `${caseName} attempted-call drift.`)
  assert(fieldProxyAttemptCount === 3, `${caseName} proxy attempt drift.`)
  return summarizeRequests(caseName, 'fetchLivePlaces -> ProviderAdapter mocked Field proxy', {
    envelopeCaps: envelope,
    fieldMask,
    plannedCalls: result.diagnostics.dispatchQueriesPlanned,
    sourceFamilyOrKind: result.diagnostics.requestedKinds,
    sourceMode: 'live',
  })
}

async function runCuratePocketMocked(fieldMask: string): Promise<QuerySnapshotRow> {
  const caseName = 'curate-coffee-books-pocket-mocked-safe'
  const envelope = { maxProviderCalls: 3, maxQueryLabels: 3, maxCenters: 1 }
  resetFetchCapture(caseName)
  const result = await fetchLivePlaces(
    baseIntent({ mode: 'curate', primaryAnchor: 'cultured' }),
    findStarterPack('coffee-books'),
    {
      maxQueryCenters: envelope.maxCenters,
      sourceMode: 'live',
      envelope,
      pocketHint: {
        pocketId: 'query-parity-pocket',
        pocketLabel: 'Query Parity Pocket',
        centroid: { lat: 37.32123, lng: -121.91234 },
        radiusM: 180,
        source: 'district_intelligence',
        city: 'San Jose',
        locationLabel: 'Query Parity Pocket, San Jose',
      },
    },
  )
  assert(result.diagnostics.pocketCenteredRetrievalApplied, `${caseName} lost pocket centering.`)
  assert(result.diagnostics.queryRadiusM === 650, `${caseName} pocket radius drift.`)
  assert(fieldProxyAttemptCount === 3, `${caseName} proxy attempt drift.`)
  return summarizeRequests(caseName, 'fetchLivePlaces coffee-books pocket -> mocked Field proxy', {
    envelopeCaps: envelope,
    fieldMask,
    plannedCalls: result.diagnostics.dispatchQueriesPlanned,
    sourceFamilyOrKind: result.diagnostics.requestedKinds,
    sourceMode: 'live',
  })
}

async function runBuildProviderMocked(): Promise<{
  queryRow: QuerySnapshotRow
  routeRow: RouteSnapshotRow
}> {
  const caseName = 'build-provider-mocked-safe'
  const envelope = buildProviderPublicLiveEnvelope()
  resetFetchCapture(caseName)
  process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = 'true'
  const result = await buildProviderSourceOpportunity({
    anchorVenue: getPaperPlane(),
    liveEnvelope: envelope,
  })
  assert(result.opportunity, `${caseName} did not emit a provider opportunity.`)
  assert(fieldProxyAttemptCount === 3, `${caseName} proxy attempt drift.`)
  return {
    queryRow: summarizeRequests(caseName, 'buildProviderSourceOpportunity -> executeFieldProviderTextSearch', {
      envelopeCaps: envelope,
      fieldMask: buildProviderSourceOpportunityConfig.fieldMask,
      plannedCalls: 3,
      sourceFamilyOrKind: ['build_provider_nearby'],
      sourceMode: 'live',
    }),
    routeRow: {
      case: caseName,
      routePathExercised: true,
      downstreamRouteOutputCaptured: true,
      notes: [
        `emitted=${String(result.diagnostics.buildProviderSourceOpportunityEmitted)}`,
        `blocked=${result.diagnostics.buildProviderSupplyBlockedReason ?? 'none'}`,
        `roleCounts=${JSON.stringify(result.diagnostics.buildProviderRoleCandidateCounts)}`,
        `selected=${[
          ...result.opportunity.roleCandidates.start.map((venue) => venue.id),
          result.opportunity.anchor.venue.id,
          ...result.opportunity.roleCandidates.highlight.map((venue) => venue.id),
          ...result.opportunity.roleCandidates.windDown.map((venue) => venue.id),
        ].join('>')}`,
      ],
    },
  }
}

async function main(): Promise<void> {
  try {
    const fieldMask = extractGoogleFieldMaskFromSource()
    const surprisePlan = buildLiveQueryPlan(baseIntent({ mode: 'surprise' }))
    const surpriseProjection = projectInterpretationSemanticLiveQueryProjection(
      buildCanonicalSemanticProjectionInput(baseIntent({ mode: 'surprise' })),
    )
    const surpriseFieldScaffold = projectFieldMechanicalLiveQueryScaffold(surpriseProjection)
    const curatePlan = buildLiveQueryPlan(
      baseIntent({ mode: 'curate', primaryAnchor: 'cultured' }),
      findStarterPack('coffee-books'),
    )
    const curateProjection = projectInterpretationSemanticLiveQueryProjection(
      buildCanonicalSemanticProjectionInput(
        baseIntent({ mode: 'curate', primaryAnchor: 'cultured' }),
        findStarterPack('coffee-books'),
      ),
    )
    const curateFieldScaffold = projectFieldMechanicalLiveQueryScaffold(curateProjection)

    const generalNoProviderRow = await runGeneralNoProviderStatic(fieldMask)
    const generalNoProviderFieldScaffold = projectFieldMechanicalProviderTextSearchScaffold({
      semanticProjection: surpriseProjection,
      centers: [],
      radiusM: 0,
      fieldMask,
      pageSize: 8,
      envelope: { maxProviderCalls: 0, maxQueryLabels: 0, maxCenters: 0 },
    })
    const generalLiveRow = await runGeneralLiveMocked(fieldMask)
    const generalLiveProjection = projectInterpretationSemanticLiveQueryProjection(
      buildCanonicalSemanticProjectionInput(baseIntent({ mode: 'surprise' })),
    )
    const generalLiveFieldScaffold = projectFieldMechanicalProviderTextSearchScaffold({
      semanticProjection: generalLiveProjection,
      centers: centersFromSnapshotRow(generalLiveRow),
      radiusM: generalLiveRow.centersRadius[0]?.radiusMeters ?? 0,
      fieldMask,
      pageSize: generalLiveRow.fieldMaskPageSize.pageSize ?? 8,
      envelope: { maxProviderCalls: 3, maxQueryLabels: 3, maxCenters: 3 },
    })
    const curatePocketRow = await runCuratePocketMocked(fieldMask)
    const curatePocketProjection = projectInterpretationSemanticLiveQueryProjection(
      buildCanonicalSemanticProjectionInput(
        baseIntent({ mode: 'curate', primaryAnchor: 'cultured' }),
        findStarterPack('coffee-books'),
        {
        locationLabelOverride: 'Query Parity Pocket, San Jose',
        locationScope: 'pocket',
        },
      ),
    )
    const curatePocketFieldScaffold = projectFieldMechanicalProviderTextSearchScaffold({
      semanticProjection: curatePocketProjection,
      centers: centersFromSnapshotRow(curatePocketRow),
      radiusM: curatePocketRow.centersRadius[0]?.radiusMeters ?? 0,
      fieldMask,
      pageSize: curatePocketRow.fieldMaskPageSize.pageSize ?? 8,
      envelope: { maxProviderCalls: 3, maxQueryLabels: 3, maxCenters: 1 },
    })
    const buildProvider = await runBuildProviderMocked()
    const buildProviderProjection = projectInterpretationBuildProviderSemanticQueryProjection(
      getPaperPlane(),
    )
    const buildProviderCenter = buildProvider.queryRow.centersRadius[0]?.center
    assert(buildProviderCenter, 'Expected Build provider field scaffold center.')
    const buildProviderFieldScaffold = projectFieldMechanicalBuildProviderTextSearchScaffold({
      semanticProjection: buildProviderProjection,
      center: { latitude: buildProviderCenter.lat, longitude: buildProviderCenter.lng },
      radiusM: buildProvider.queryRow.centersRadius[0]?.radiusMeters ?? 0,
      fieldMask: buildProviderSourceOpportunityConfig.fieldMask,
      pageSize: buildProvider.queryRow.fieldMaskPageSize.pageSize ?? 5,
      envelope: buildProvider.queryRow.envelopeCaps ?? undefined,
    })

    const queryRows: QuerySnapshotRow[] = [
      summarizeLiveQueryEntries(
        'surprise-buildLiveQueryPlan-direct',
        'buildLiveQueryPlan(intent)',
        surprisePlan,
      ),
      summarizeLiveQueryEntries(
        'curate-coffee-books-buildLiveQueryPlan-direct',
        'buildLiveQueryPlan(intent, starterPack)',
        curatePlan,
      ),
      generalNoProviderRow,
      generalLiveRow,
      curatePocketRow,
    ]
    queryRows.push(buildProvider.queryRow)

    const projectionParityRows: QueryOutputComparison[] = [
      buildComparison(
        'surprise-buildLiveQueryPlan-direct',
        queryOutputFromLiveEntries(surprisePlan),
        queryOutputFromLiveEntries(surpriseProjection.entries),
        queryOutputFromLiveEntries(surpriseFieldScaffold.entries),
      ),
      buildComparison(
        'curate-coffee-books-buildLiveQueryPlan-direct',
        queryOutputFromLiveEntries(curatePlan),
        queryOutputFromLiveEntries(curateProjection.entries),
        queryOutputFromLiveEntries(curateFieldScaffold.entries),
      ),
      buildComparison(
        'general-live-retrieval-no-provider-static',
        buildEmptyQueryOutput(),
        buildEmptyQueryOutput(),
        queryOutputFromProviderQueries(generalNoProviderFieldScaffold.queries, []),
      ),
      buildComparison(
        'general-live-retrieval-mocked-safe',
        queryOutputFromSnapshotRow(generalLiveRow),
        selectFirstDispatchOutput(generalLiveProjection.entries.slice(0, 3), ['core', 'north', 'east'], 3),
        queryOutputFromProviderQueries(
          generalLiveFieldScaffold.queries,
          unique(generalLiveFieldScaffold.admittedEntries.map((entry) => entry.kind)),
        ),
      ),
      buildComparison(
        'curate-coffee-books-pocket-mocked-safe',
        queryOutputFromSnapshotRow(curatePocketRow),
        selectFirstDispatchOutput(curatePocketProjection.entries, ['pocket'], 3),
        queryOutputFromProviderQueries(
          curatePocketFieldScaffold.queries,
          unique(curatePocketFieldScaffold.admittedEntries.map((entry) => entry.kind)),
        ),
      ),
      buildComparison(
        'build-provider-mocked-safe',
        queryOutputFromSnapshotRow(buildProvider.queryRow),
        {
          queryLabels: buildProviderProjection.entries.map((entry) => entry.label),
          textQueries: buildProviderProjection.entries.map((entry) => entry.textQuery),
          sourceFamilyOrKind: unique(
            buildProviderProjection.entries.map((entry) => entry.sourceFamily),
          ),
          provenanceTerms: buildProviderProjection.entries.map((entry) => entry.queryTerms),
        },
        queryOutputFromProviderQueries(buildProviderFieldScaffold.queries, ['build_provider_nearby']),
      ),
    ]

    const fieldMechanicalScaffoldRows: FieldMechanicalScaffoldRow[] = [
      {
        case: 'surprise-buildLiveQueryPlan-direct',
        sourceMode: 'not_dispatched',
        envelopeCaps: null,
        fieldMaskPageSize: { fieldMask: null, pageSize: null },
        centersRadius: [],
        plannedCalls: 0,
        attemptedCalls: 0,
        providerCalls: 0,
        labelsConsidered: surpriseFieldScaffold.labelsConsidered,
        labelsAdmitted: surpriseFieldScaffold.labelsAdmitted,
        centersConsidered: 0,
        centersAdmitted: 0,
        plannedWithinCap: true,
      },
      {
        case: 'curate-coffee-books-buildLiveQueryPlan-direct',
        sourceMode: 'not_dispatched',
        envelopeCaps: null,
        fieldMaskPageSize: { fieldMask: null, pageSize: null },
        centersRadius: [],
        plannedCalls: 0,
        attemptedCalls: 0,
        providerCalls: 0,
        labelsConsidered: curateFieldScaffold.labelsConsidered,
        labelsAdmitted: curateFieldScaffold.labelsAdmitted,
        centersConsidered: 0,
        centersAdmitted: 0,
        plannedWithinCap: true,
      },
      summarizeFieldProviderScaffold(generalNoProviderRow, generalNoProviderFieldScaffold),
      summarizeFieldProviderScaffold(generalLiveRow, generalLiveFieldScaffold),
      summarizeFieldProviderScaffold(curatePocketRow, curatePocketFieldScaffold),
      summarizeFieldBuildProviderScaffold(buildProvider.queryRow, buildProviderFieldScaffold),
    ]

    const routeRows: RouteSnapshotRow[] = [
      {
        case: 'surprise-buildLiveQueryPlan-direct',
        routePathExercised: false,
        downstreamRouteOutputCaptured: false,
        notes: ['Direct query-plan snapshot only; route output not part of this path.'],
      },
      {
        case: 'curate-coffee-books-buildLiveQueryPlan-direct',
        routePathExercised: false,
        downstreamRouteOutputCaptured: false,
        notes: ['Direct starter query-plan snapshot only; route output not part of this path.'],
      },
      {
        case: 'general-live-retrieval-no-provider-static',
        routePathExercised: false,
        downstreamRouteOutputCaptured: false,
        notes: ['Closed/curated provider boundary exercised; no route generation requested.'],
      },
      {
        case: 'general-live-retrieval-mocked-safe',
        routePathExercised: false,
        downstreamRouteOutputCaptured: false,
        notes: ['Mocked retrieval dispatch exercised; downstream route output not requested.'],
      },
      {
        case: 'curate-coffee-books-pocket-mocked-safe',
        routePathExercised: false,
        downstreamRouteOutputCaptured: false,
        notes: ['Mocked Curate pocket dispatch exercised; downstream route output not requested.'],
      },
      buildProvider.routeRow,
    ]

    for (const row of queryRows) {
      assert(row.providerCalls === 0, `${row.case} made provider/network calls.`)
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          observer: 'query_planner_split_parity',
          proofType: 'observer_local_existing_carriers_no_provider',
          canonicalOwnershipGate: [
            {
              proposedHelperView: 'Query planner split parity snapshot rows',
              existingOwnerHome:
                'observer-local view over buildLiveQueryPlan, LiveSourceDiagnostics, ProviderTextSearchQuery, LiveProviderEnvelope, SourceMode',
              newArtifact: false,
              whatTwoThingsRemoved: 'none; observer-local only',
              allowed: true,
            },
            {
              proposedHelperView: 'Field mechanical query scaffold',
              existingOwnerHome:
                'Field-owned mechanical view over LiveQueryPlanEntry, ProviderTextSearchQuery, LiveProviderEnvelope, LiveSourceDiagnostics, SourceMode',
              newArtifact: false,
              whatTwoThingsRemoved: 'none; scaffold-only over existing mechanical carriers',
              allowed: true,
            },
            {
              proposedHelperView: 'QueryIntent',
              existingOwnerHome: 'ConciergeIntent / existing Interpretation intent carriers',
              newArtifact: true,
              whatTwoThingsRemoved: 'none',
              allowed: false,
            },
            {
              proposedHelperView: 'FieldQueryPlan',
              existingOwnerHome:
                'LiveQueryPlanEntry / LiveProviderEnvelope / ProviderTextSearchQuery / LiveSourceDiagnostics / SourceMode',
              newArtifact: true,
              whatTwoThingsRemoved: 'none in 2C-1',
              allowed: false,
            },
          ],
          definitionOfDoneAmendment: {
            textQueryBridgeTemporary: true,
            fieldFacetCompositionRequiredBefore2CClose: true,
            returnBefore2C6: true,
          },
          interpretationProjection: {
            owner: 'interpretation',
            existingCarriersUsed: [
              'ConciergeIntent',
              'WhenSignalProfile',
              'origin/place context',
              'StarterPack',
              'Venue anchor name/city',
              'LiveQueryPlanEntry compatibility shape',
            ],
            newCanonicalArtifactCreated: false,
            queryIntentCreated: false,
            fieldQueryPlanCreated: false,
            textQueryBridgeTemporary: true,
            fieldReceivesProjectionIn2C2: false,
          },
          fieldMechanicalScaffold: {
            owner: 'field',
            existingCarriersUsed: [
              'LiveQueryPlanEntry compatibility shape',
              'ProviderTextSearchQuery',
              'LiveProviderEnvelope caps',
              'LiveSourceDiagnostics-equivalent counters',
              'SourceMode observer value',
            ],
            newCanonicalArtifactCreated: false,
            fieldQueryPlanCreated: false,
            textQueryBridgeTemporary: true,
            branchesOnSemanticMeaning: false,
            consumerMigrationIn2C3: false,
            rows: fieldMechanicalScaffoldRows,
          },
          projectionParityRows,
          queryRows,
          routeRows,
          providerSafety: {
            directProviderFetchAttemptCount,
            unexpectedFetchAttemptCount,
            providerCalls: queryRows.reduce((sum, row) => sum + row.providerCalls, 0),
          },
        },
        null,
        2,
      )}\n`,
    )
    process.stdout.write('query planner split parity harness: passed\n')
  } finally {
    globalThis.fetch = originalFetch
    if (originalBuildProviderSupply === undefined) {
      delete process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY
    } else {
      process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = originalBuildProviderSupply
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
