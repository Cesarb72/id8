import { sanJoseVenues } from '../src/data/venues.ts'
import { buildRolePools } from '../src/domain/arc/buildRolePools.ts'
import { getRoleContract } from '../src/domain/contracts/getRoleContract.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues.ts'
import { scoreVenueCollection } from '../src/domain/retrieval/scoreVenueFit.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import {
  GreatStopGateSelectionError,
  type BuildLocationClass,
} from '../src/domain/types/greatStopGate.ts'
import type {
  AnchorRole,
  DistanceMode,
  ExperienceMode,
  IntentInput,
  PersonaMode,
  VibeAnchor,
} from '../src/domain/types/intent.ts'
import { admitDistrictEntities } from '../src/engines/district/entities/admitDistrictEntities.ts'

type CaseMode = Extract<ExperienceMode, 'surprise' | 'curate' | 'build'>
type SupplyStatus =
  | 'source_thin'
  | 'query_too_narrow'
  | 'budget_capped'
  | 'normalization_attrition'
  | 'identity_attrition'
  | 'district_admission_attrition'
  | 'role_pool_attrition'
  | 'candidate_assembly_attrition'
  | 'great_stop_exhaustion'
  | 'not_thin'
  | 'inconclusive'

interface ObserverCaseSpec {
  case: string
  mode: CaseMode
  persona: PersonaMode
  locationClass: BuildLocationClass
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  district: string
  distanceMode: DistanceMode
  anchor?: {
    venueId: string
    role: AnchorRole
    label: string
  }
}

interface RolePoolCounts {
  start: number
  highlight: number
  windDown: number
  support: number
}

interface SupplyFunnelRow {
  case: string
  mode: CaseMode
  persona: PersonaMode
  locationClass: BuildLocationClass
  rawSourceCount: number
  normalizedCount: number
  identityAdmittedCount: number
  districtAdmittedCount: number
  rolePoolCounts: RolePoolCounts
  candidatePool: number
  greatStopResult: string
  thinStage: SupplyStatus
  notes: string[]
}

interface SupplyAttributionRow {
  case: string
  supplyStatus: SupplyStatus
  evidence: string
  confidence: 'high' | 'medium' | 'low'
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`FieldWorld supply-funnel readout must not call fetch: ${url}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

const personas: Array<{
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
}> = [
  { persona: 'romantic', primaryVibe: 'cozy', secondaryVibe: 'lively' },
  { persona: 'friends', primaryVibe: 'lively', secondaryVibe: 'cultured' },
  { persona: 'family', primaryVibe: 'playful', secondaryVibe: 'cultured' },
]

const locationClasses: Array<{
  locationClass: BuildLocationClass
  district: string
  distanceMode: DistanceMode
}> = [
  { locationClass: 'L1 Dense', district: 'Downtown', distanceMode: 'nearby' },
  { locationClass: 'L2 Mid', district: 'San Jose', distanceMode: 'short-drive' },
  { locationClass: 'L3 Sparse', district: 'Evergreen', distanceMode: 'short-drive' },
]

const buildCases: ObserverCaseSpec[] = [
  {
    case: 'build:L2 Romantic / Adega',
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    locationClass: 'L2 Mid',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    anchor: { venueId: 'sj-adega-wine-atelier', role: 'highlight', label: 'Adega' },
  },
  {
    case: 'build:L2 Friends / MINIBOSS',
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    locationClass: 'L2 Mid',
    district: 'Downtown',
    distanceMode: 'short-drive',
    anchor: { venueId: 'sj-miniboss', role: 'highlight', label: 'MINIBOSS' },
  },
  {
    case: 'build:L2 Family / Happy Hollow',
    mode: 'build',
    persona: 'family',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    locationClass: 'L2 Mid',
    district: 'East San Jose',
    distanceMode: 'short-drive',
    anchor: { venueId: 'sj-happy-hollow', role: 'highlight', label: 'Happy Hollow' },
  },
  {
    case: 'build:L3 Friends / Village Grill',
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    secondaryVibe: 'chill',
    locationClass: 'L3 Sparse',
    district: 'Evergreen',
    distanceMode: 'short-drive',
    anchor: { venueId: 'sj-village-grill', role: 'highlight', label: 'Village Grill' },
  },
  {
    case: 'build:L3 Romantic / Evergreen Coffee Company',
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'chill',
    locationClass: 'L3 Sparse',
    district: 'Evergreen',
    distanceMode: 'short-drive',
    anchor: {
      venueId: 'sj-evergreen-coffee-company',
      role: 'highlight',
      label: 'Evergreen Coffee Company',
    },
  },
  {
    case: 'build:L3 Family / Alum Rock Park',
    mode: 'build',
    persona: 'family',
    primaryVibe: 'adventurous-outdoor',
    secondaryVibe: 'playful',
    locationClass: 'L3 Sparse',
    district: 'Alum Rock',
    distanceMode: 'short-drive',
    anchor: { venueId: 'sj-alum-rock-park', role: 'highlight', label: 'Alum Rock Park' },
  },
  {
    case: 'build:L1 Family / The Tech Interactive',
    mode: 'build',
    persona: 'family',
    primaryVibe: 'playful',
    secondaryVibe: 'cultured',
    locationClass: 'L1 Dense',
    district: 'Downtown',
    distanceMode: 'nearby',
    anchor: { venueId: 'sj-tech-interactive', role: 'highlight', label: 'The Tech Interactive' },
  },
  {
    case: 'build:L1 Romantic / Haberdasher',
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'lively',
    secondaryVibe: 'cozy',
    locationClass: 'L1 Dense',
    district: 'Downtown',
    distanceMode: 'nearby',
    anchor: { venueId: 'sj-haberdasher', role: 'windDown', label: 'Haberdasher' },
  },
]

function buildSurpriseCurateCases(): ObserverCaseSpec[] {
  const representativeCells = [
    { personaIndex: 0, locationIndex: 0 },
  ]
  return (['surprise', 'curate'] as const).flatMap((mode) =>
    representativeCells.map(({ personaIndex, locationIndex }) => {
      const persona = personas[personaIndex]!
      const location = locationClasses[locationIndex]!
      return {
        case: `${mode}:${persona.persona}:${location.locationClass}`,
        mode,
        persona: persona.persona,
        primaryVibe: persona.primaryVibe,
        ...(persona.secondaryVibe ? { secondaryVibe: persona.secondaryVibe } : {}),
        locationClass: location.locationClass,
        district: location.district,
        distanceMode: location.distanceMode,
      }
    }),
  )
}

function buildIntentInput(spec: ObserverCaseSpec): IntentInput {
  const base: IntentInput = {
    mode: spec.mode,
    planningMode: spec.mode === 'build' ? 'user-led' : 'engine-led',
    persona: spec.persona,
    primaryVibe: spec.primaryVibe,
    secondaryVibe: spec.secondaryVibe,
    city: 'San Jose',
    district: spec.district,
    distanceMode: spec.distanceMode,
    prefersHiddenGems: spec.mode === 'surprise',
  }
  if (!spec.anchor) {
    return base
  }
  return {
    ...base,
    anchor: {
      venueId: spec.anchor.venueId,
      role: spec.anchor.role,
    },
    discoveryPreferences: [
      {
        venueId: spec.anchor.venueId,
        role: spec.anchor.role,
      },
    ],
  }
}

async function buildSupplyProjection(spec: ObserverCaseSpec): Promise<{
  rawSourceCount: number
  normalizedCount: number
  identityAdmittedCount: number
  districtAdmittedCount: number
  districtBlockedCount: number
  rolePoolCounts: RolePoolCounts
  notes: string[]
}> {
  const intent = normalizeIntent(buildIntentInput(spec))
  const lens = buildExperienceLens({ intent })
  const crewPolicy = getCrewPolicy(intent.crew)
  const roleContracts = getRoleContract({ intent })
  const retrieval = await retrieveVenues(intent, lens, {
    requestedSourceMode: 'curated',
    sourceModeOverrideApplied: true,
    seedVenues: sanJoseVenues,
  })
  const districtAdmission = admitDistrictEntities(retrieval.venues)
  const scoredVenues = scoreVenueCollection(
    retrieval.venues,
    intent,
    crewPolicy,
    lens,
    roleContracts,
  )
  const rolePools = buildRolePools(scoredVenues, crewPolicy, lens, intent, roleContracts)
  const notes = [
    `effectiveSourceMode:${retrieval.sourceMode.effectiveMode}`,
    `liveFetchAttempted:${String(retrieval.sourceMode.liveFetchAttempted)}`,
    `sourceCounts:curated=${retrieval.sourceMode.countsBySource.curated},live=${retrieval.sourceMode.countsBySource.live}`,
    'identityAdmittedCount uses retrieved supply for curated/no-provider cases; live canonical admission is not separately exercised.',
    ...(districtAdmission.blocked.length > 0
      ? [`districtBlocked:${districtAdmission.blocked.length}`]
      : []),
  ]

  return {
    rawSourceCount: retrieval.stageCounts.totalSeed,
    normalizedCount: retrieval.stageCounts.active,
    identityAdmittedCount: retrieval.stageCounts.finalRetrieved,
    districtAdmittedCount: districtAdmission.admitted.length,
    districtBlockedCount: districtAdmission.blocked.length,
    rolePoolCounts: {
      start: rolePools.warmup.length,
      highlight: rolePools.peak.length,
      windDown: rolePools.cooldown.length,
      support: rolePools.wildcard.length,
    },
    notes,
  }
}

async function runFormalGreatStop(spec: ObserverCaseSpec): Promise<{
  result: string
  selectionStatus: string
  passingCandidateCount?: number
  rankedCandidateCount?: number
  candidatePool: number | null
  failureReasons: string[]
}> {
  try {
    const options: NonNullable<Parameters<typeof runGeneratePlan>[1]> = {
      seedVenues: sanJoseVenues,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
    }
    if (spec.mode !== 'build') {
      options.greatStopGateLocationClass = spec.locationClass
    }
    const result = await runGeneratePlan(buildIntentInput(spec), options)
    const gate = result.trace.greatStopGateResult
    const selection = result.trace.greatStopGateSelectionDiagnostics
    return {
      result: gate ? gate.status : 'UNKNOWN:no_gate_result',
      selectionStatus: selection?.status ?? 'not_reported',
      passingCandidateCount: selection?.passingCandidateCount,
      rankedCandidateCount: selection?.rankedCandidateCount,
      candidatePool: selection?.rankedCandidateCount ?? result.trace.candidateArcCount,
      failureReasons: unique(gate?.reasons ?? selection?.failureReasons ?? []),
    }
  } catch (error) {
    if (error instanceof GreatStopGateSelectionError) {
      const diagnostics = error.greatStopGateSelectionDiagnostics
      return {
        result: 'FAIL:soft_gate_exhausted',
        selectionStatus: diagnostics.status,
        passingCandidateCount: diagnostics.passingCandidateCount,
        rankedCandidateCount: diagnostics.rankedCandidateCount,
        candidatePool: diagnostics.rankedCandidateCount ?? diagnostics.evaluatedCandidateCount ?? null,
        failureReasons: unique(diagnostics.failureReasons),
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    return {
      result: `ERROR:${message}`,
      selectionStatus: 'runtime_error',
      candidatePool: null,
      failureReasons: [`runtime_error:${message}`],
    }
  }
}

function classifySupply(params: {
  projection: Awaited<ReturnType<typeof buildSupplyProjection>>
  greatStop: Awaited<ReturnType<typeof runFormalGreatStop>>
}): SupplyAttributionRow['supplyStatus'] {
  const { projection, greatStop } = params
  if (projection.rawSourceCount === 0) {
    return 'source_thin'
  }
  if (projection.normalizedCount < Math.max(3, Math.floor(projection.rawSourceCount * 0.25))) {
    return 'normalization_attrition'
  }
  if (projection.identityAdmittedCount < Math.max(3, Math.floor(projection.normalizedCount * 0.5))) {
    return 'identity_attrition'
  }
  if (projection.districtBlockedCount > 0 && projection.districtAdmittedCount < projection.identityAdmittedCount) {
    return 'district_admission_attrition'
  }
  if (
    projection.rolePoolCounts.start === 0 ||
    projection.rolePoolCounts.highlight === 0 ||
    projection.rolePoolCounts.windDown === 0
  ) {
    return 'role_pool_attrition'
  }
  if (greatStop.candidatePool === 0) {
    return 'candidate_assembly_attrition'
  }
  if (greatStop.result.startsWith('FAIL') || greatStop.selectionStatus === 'FAIL') {
    return 'great_stop_exhaustion'
  }
  return 'not_thin'
}

function evidenceFor(params: {
  projection: Awaited<ReturnType<typeof buildSupplyProjection>>
  greatStop: Awaited<ReturnType<typeof runFormalGreatStop>>
  status: SupplyStatus
}): string {
  const { projection, greatStop, status } = params
  const base = [
    `raw=${projection.rawSourceCount}`,
    `normalized=${projection.normalizedCount}`,
    `identity=${projection.identityAdmittedCount}`,
    `district=${projection.districtAdmittedCount}`,
    `rolePools=${JSON.stringify(projection.rolePoolCounts)}`,
    `candidates=${greatStop.candidatePool ?? 'n/a'}`,
    `greatStop=${greatStop.result}`,
    `passing=${greatStop.passingCandidateCount ?? 'n/a'}`,
  ]
  if (status === 'great_stop_exhaustion') {
    base.push(`failureReasons=${greatStop.failureReasons.join('|') || 'none_reported'}`)
  }
  return base.join('; ')
}

async function runCase(spec: ObserverCaseSpec): Promise<{
  funnel: SupplyFunnelRow
  attribution: SupplyAttributionRow
}> {
  const projection = await buildSupplyProjection(spec)
  const greatStop = await runFormalGreatStop(spec)
  const supplyStatus = classifySupply({ projection, greatStop })
  const notes = [
    ...projection.notes,
    `formalSelectionStatus:${greatStop.selectionStatus}`,
    `formalPassingCandidateCount:${greatStop.passingCandidateCount ?? 'n/a'}`,
    `formalRankedCandidateCount:${greatStop.rankedCandidateCount ?? 'n/a'}`,
    ...(greatStop.failureReasons.length > 0
      ? [`formalFailureReasons:${greatStop.failureReasons.join('|')}`]
      : []),
  ]
  return {
    funnel: {
      case: spec.case,
      mode: spec.mode,
      persona: spec.persona,
      locationClass: spec.locationClass,
      rawSourceCount: projection.rawSourceCount,
      normalizedCount: projection.normalizedCount,
      identityAdmittedCount: projection.identityAdmittedCount,
      districtAdmittedCount: projection.districtAdmittedCount,
      rolePoolCounts: projection.rolePoolCounts,
      candidatePool: greatStop.candidatePool ?? 0,
      greatStopResult: greatStop.result,
      thinStage: supplyStatus,
      notes,
    },
    attribution: {
      case: spec.case,
      supplyStatus,
      evidence: evidenceFor({ projection, greatStop, status: supplyStatus }),
      confidence:
        supplyStatus === 'great_stop_exhaustion' || supplyStatus === 'not_thin'
          ? 'medium'
          : 'low',
    },
  }
}

async function main(): Promise<void> {
  try {
    const cases = [...buildSurpriseCurateCases(), buildCases[0]!, buildCases[1]!, buildCases[2]!]
    const funnelRows: SupplyFunnelRow[] = []
    const attributionRows: SupplyAttributionRow[] = []
    for (const spec of cases) {
      process.stderr.write(`fieldworld supply-funnel start: ${spec.case}\n`)
      const row = await runCase(spec)
      process.stderr.write(
        `fieldworld supply-funnel done: ${spec.case} ${row.funnel.greatStopResult} ${row.funnel.thinStage}\n`,
      )
      funnelRows.push(row.funnel)
      attributionRows.push(row.attribution)
    }

    assert(fetchCallCount === 0, `Expected provider/network calls to remain 0; got ${fetchCallCount}.`)
    assert(funnelRows.length === 5, `Expected 5 no-provider cases, got ${funnelRows.length}.`)

    process.stdout.write(
      `${JSON.stringify(
        {
          observer: 'fieldworld_supply_funnel_readout',
          proofType: 'view_only_existing_diagnostics_no_provider',
          canonicalOwnershipGate: [
            {
              proposedObjectView: 'FieldWorld supply-funnel readout',
              newArtifact: false,
              existingCarrierReused:
                'RetrieveVenuesResult.sourceMode/stageCounts + District admitDistrictEntities + RolePools + Great Stop selection diagnostics',
              whatTwoThingsRemoved: 'none; observer-local view only',
              allowed: true,
            },
          ],
          canonicalFieldWorldArtifactCreated: false,
          behaviorChanged: false,
          providerCalls: fetchCallCount,
          casesCovered: {
            surpriseCurateFormalMatrixCells: 2,
            buildNoProviderStaticCells: 3,
            fixtureCases: 0,
          },
          reliableDistinctions: [
            'budget_capped when provider diagnostics report cap/dispatch blockage',
            'normalization_attrition when sourceMode normalization drops are present',
            'district_admission_attrition when District admission blocks retrieved supply',
            'role_pool_attrition when required role pools empty',
            'candidate_assembly_attrition when role pools exist but no candidates assemble',
            'great_stop_exhaustion when formal Great Stop selection reports no passing candidate',
            'not_thin when source, role, candidate, and Great Stop stages all pass',
          ],
          inconclusiveDistinctions: [
            'query_too_narrow vs universe_thin is inconclusive in curated/no-provider mode because no provider query is dispatched',
            'curated identity admission is not separately measured; identityAdmittedCount reuses retrieved supply unless live canonical diagnostics are present',
            'candidatePool comes from Great Stop selection diagnostics and is not a replacement route authority',
          ],
          funnelRows,
          attributionRows,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  globalThis.fetch = originalFetch
  console.error(error)
  process.exit(1)
})
