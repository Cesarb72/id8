import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  CurateBuildAdmittedSupportCandidate,
} from '../src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts'
import type {
  BuiltScenarioNight,
  BuiltScenarioStop,
  StarterSemanticRepresentation,
} from '../src/domain/interpretation/construction/scenarioBuilder.ts'
import type { VerifiedCityOpportunity } from '../src/domain/interpretation/verifiedCityOpportunity.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

type YesNo = 'yes' | 'no'

const outputColumns = [
  'mode',
  'starter/family',
  'route id / route label',
  'support source',
  'candidate producer',
  'support-screen producer',
  'materialization/projection source',
  'Great Stop producer',
  'routeAuthority/Application involvement',
  'ContractEntryArtifact produced? yes/no',
  'RuntimeRouteArtifact produced? yes/no',
  'Great Stop pass/fail',
  'Great Stop failure reasons',
  'Review/Lock eligible? yes/no',
  'provider calls count',
  'hosted calls count',
  'static corpus used? yes/no',
  'fallback used? yes/no',
  'provider-shadow used? yes/no',
  'DEMO-SPECIAL path used? yes/no',
  'app-authority shadow used? yes/no',
  'legacy wrapper used? yes/no',
  'diagnostic-only? yes/no',
  'valid MVP pass? yes/no',
  'honest-fail? yes/no',
  'roleScore',
  'stopShapeFit',
  'lensCompatibility',
  'contextSpecificity',
  'threshold source',
  'evidence persisted/carried/recomputed/defaulted/unavailable',
  'invalid false-green? yes/no',
  'proof validity label',
] as const

type OutputColumn = (typeof outputColumns)[number]
type ProofRow = Record<OutputColumn, string>

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected network call in local Phase 3 proof harness: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function yesNo(value: boolean): YesNo {
  return value ? 'yes' : 'no'
}

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function writeCsv(path: string, rows: ProofRow[]): void {
  const lines = [
    outputColumns.map(escapeCsv).join(','),
    ...rows.map((row) => outputColumns.map((column) => escapeCsv(row[column])).join(',')),
  ]
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8')
}

function writeNdjson(path: string, rows: ProofRow[]): void {
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')
}

function missingColumnsFor(row: ProofRow): string[] {
  return outputColumns.filter((column) => row[column] === undefined || row[column] === null || row[column] === '')
}

function buildStop(params: {
  position: BuiltScenarioStop['position']
  stopType: BuiltScenarioStop['stopType']
  venueId: string
  name: string
  category: VenueCategory
  subcategory?: string
  geoBucket: string
  geoLabel: string
  tags?: string[]
  sourceTypes?: string[]
  roleFit?: Partial<BuiltScenarioStop['roleFit']>
}): BuiltScenarioStop {
  return {
    position: params.position,
    stopType: params.stopType,
    venueId: params.venueId,
    name: params.name,
    district: params.geoLabel,
    neighborhoodLabel: params.geoLabel,
    geoBucket: params.geoBucket,
    geoBucketSource: 'district_intelligence',
    geoLabel: params.geoLabel,
    geoAssignmentMethod: 'district_intelligence_direct',
    authorityScore: 0.78,
    currentRelevance: 0.72,
    reasons: [`${params.name} supports the local Phase 3 proof cell.`],
    momentLabel: params.name,
    whyThisStop: `${params.name} is selected by the local proof fixture.`,
    venueCategory: params.category,
    venueSubcategory: params.subcategory,
    venueTags: params.tags ?? [],
    sourceTypes: params.sourceTypes ?? [params.category],
    roleFit: { start: 0.72, highlight: 0.72, windDown: 0.72, ...params.roleFit },
  }
}

function buildSemanticRepresentation(stop: BuiltScenarioStop): StarterSemanticRepresentation {
  return {
    starterPackId: 'coffee-books',
    status: 'represented',
    evidence: [
      {
        starterPackId: 'coffee-books',
        venueId: stop.venueId,
        name: stop.name,
        position: stop.position,
        stopType: stop.stopType,
        evidenceTypes: ['bookstore', 'literary'],
        matchedTerms: ['bookstore', 'literary'],
        matches: [],
        source: 'selected_route_stop',
      },
    ],
    matchedEvidence: [],
  }
}

function buildAdmittedSupportCandidate(params: {
  venueId?: string
  name?: string
  roleFit?: Partial<NonNullable<CurateBuildAdmittedSupportCandidate['roleFit']>>
} = {}): CurateBuildAdmittedSupportCandidate {
  const venueId = params.venueId ?? 'sj-willow-glen-cafe-landing'
  const name = params.name ?? 'Willow Glen Cafe Landing'
  const roleContract = {
    contractLabel: 'Coffee Books support',
    strength: 'strong' as const,
    score: 0.82,
    satisfied: true,
    matchedSignals: ['fixture_taste_evidence'],
    violations: [],
  }
  return {
    venueId,
    name,
    district: 'Willow Glen Pocket',
    neighborhoodLabel: 'Willow Glen Pocket',
    geoBucket: 'raw-pocket-willow-live',
    geoBucketSource: 'district_intelligence',
    geoLabel: 'Willow Glen Pocket',
    geoAssignmentMethod: 'district_intelligence_direct',
    venueCategory: 'cafe',
    venueSubcategory: 'coffee-shop',
    sourceLabel: 'coffee-books-start-reading@pocket',
    sourceTypes: ['coffee-shop', 'cafe', 'food-store'],
    authorityScore: 0.77,
    currentRelevance: 0.77,
    score: 0.77,
    boardRank: 6,
    admitted: true,
    blockedReason: null,
    enteredStopTypePool: false,
    enteredAnyScenarioNight: false,
    roleFit: { start: 1, highlight: 1, windDown: 1, ...params.roleFit },
    tasteEvidence: {
      lensCompatibility: 0.72,
      stopShapeFit: { start: 0.7, highlight: 0.68, surprise: 0.5, windDown: 0.72 },
      roleScores: { warmup: 0.72, peak: 0.72, wildcard: 0.5, cooldown: 0.72 },
      fitScore: 0.74,
      contextSpecificity: {
        overall: 0.68,
        personaSignal: 0.68,
        vibeSignal: 0.7,
        lensSignal: 0.7,
        byRole: { warmup: 0.68, peak: 0.68, wildcard: 0.5, cooldown: 0.7 },
      },
      roleContract: {
        warmup: roleContract,
        peak: roleContract,
        wildcard: roleContract,
        cooldown: roleContract,
      },
      candidateIdentity: {
        candidateId: venueId,
        baseVenueId: venueId,
        kind: 'base',
        traceLabel: name,
      },
      sourceProvenance: {
        provider: 'google-places',
        providerRecordId: venueId,
        sourceOrigin: 'live',
        sourceQueryLabel: 'coffee-books-start-reading@pocket',
      },
    },
  }
}

function buildSupportReselectionOpportunity(params: {
  includeCompactWindDown: boolean
}): VerifiedCityOpportunity {
  const staleStart = buildStop({
    position: 'start',
    stopType: 'cultural_institution',
    venueId: 'fixture-rose-garden-walk',
    name: 'Rose Garden Twilight Walk',
    category: 'park',
    geoBucket: 'raw-pocket-rose-garden',
    geoLabel: 'Rose Garden Pocket',
    sourceTypes: ['park'],
  })
  const compactStart = buildStop({
    position: 'mid',
    stopType: 'cultural_institution',
    venueId: 'sj-willow-glen-tea-atelier',
    name: 'Willow Glen Tea Atelier',
    category: 'cafe',
    geoBucket: 'raw-pocket-willow',
    geoLabel: 'Willow Glen Pocket',
    sourceTypes: ['cafe'],
  })
  const proofStop = buildStop({
    position: 'highlight',
    stopType: 'thoughtful_wine_or_lunch',
    venueId: 'sj-willow-glen-bookhouse',
    name: 'Willow Glen Bookhouse',
    category: 'cafe',
    subcategory: 'bookstore',
    geoBucket: 'raw-pocket-willow',
    geoLabel: 'Willow Glen Pocket',
    tags: ['bookstore', 'literary', 'reading'],
    sourceTypes: ['book_store'],
  })
  const staleWindDown = buildStop({
    position: 'windDown',
    stopType: 'atmospheric_nightcap',
    venueId: 'fixture-japantown-kissaten',
    name: 'Japantown Matcha Kissaten',
    category: 'cafe',
    geoBucket: 'raw-pocket-japantown',
    geoLabel: 'Japantown Pocket',
    sourceTypes: ['cafe'],
  })
  const compactWindDown = buildStop({
    position: 'closer',
    stopType: 'atmospheric_nightcap',
    venueId: 'sj-willow-glen-bakehouse',
    name: 'Willow Glen Bakehouse',
    category: 'dessert',
    geoBucket: 'raw-pocket-willow',
    geoLabel: 'Willow Glen Pocket',
    sourceTypes: ['dessert'],
  })
  const stops = params.includeCompactWindDown
    ? [staleStart, compactStart, proofStop, staleWindDown, compactWindDown]
    : [staleStart, compactStart, proofStop, staleWindDown]
  const starterSemanticRepresentation = buildSemanticRepresentation(proofStop)
  const scenarioNight: BuiltScenarioNight = {
    id: 'phase-3-support-reselection-fixture',
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    scenarioFamily: 'romantic_cultured',
    title: 'Phase 3 support reselection fixture',
    flavorLine: 'Phase 3 support reselection fixture',
    stops,
    whyThisWorks: 'The original route keeps stale support stops around a Willow Glen proof anchor.',
    complete: true,
    starterSemanticRepresentation,
  }
  return {
    id: `phase-3-support-reselection-${params.includeCompactWindDown ? 'scenario-only' : 'admitted'}`,
    sourceMode: 'live',
    flavor: scenarioNight.flavorLine,
    anchor: {
      venueId: proofStop.venueId,
      name: proofStop.name,
      district: proofStop.district ?? 'Willow Glen Pocket',
      verificationReasons: ['selected-stop bookstore proof'],
    },
    starts: [{ venueId: staleStart.venueId, name: staleStart.name, reason: staleStart.whyThisStop }],
    closes: [{ venueId: staleWindDown.venueId, name: staleWindDown.name, reason: staleWindDown.whyThisStop }],
    nearbyHappenings: [],
    districtContext: { primaryDistrict: 'Downtown Pocket' },
    fit: {
      persona: 'romantic',
      vibe: 'cultured',
      confidenceLine: 'Selected proof anchor is Willow Glen; support starts stale.',
      matchLine: 'Coffee & Books support reselection fixture',
    },
    storySpine: {
      start: staleStart.name,
      highlight: proofStop.name,
      windDown: staleWindDown.name,
    },
    selection: {
      pocketId: 'raw-pocket-downtown',
      directionId: 'direction-downtown',
    },
    survivorSignals: {
      whyTonightStrength: 0.72,
      cozyAuthorityStrength: 0.74,
      highWhyTonight: true,
      highCozyAuthority: true,
    },
    excellence: {
      score: 0.78,
      threshold: 0.62,
      passes: true,
      anchorStrength: 0.78,
      startQuality: 0.72,
      windDownQuality: 0.72,
      supportCoherence: 0.62,
      scenarioAlignment: 0.82,
      experienceAlignment: 0.82,
      localAuthority: 0.78,
      modeExcellence: 0.8,
    },
    starterSemanticRepresentation,
    scenarioNight,
  } as VerifiedCityOpportunity
}

function buildDirectionCard() {
  return {
    id: 'direction-downtown',
    cluster: 'romantic_cultured',
    card: { confirmation: 'Phase 3 local proof fixture direction' },
    debugMeta: {
      pocketId: 'raw-pocket-downtown',
      confidence: 0.9,
    },
  } as never
}

function buildBuildRequiredAnchorProofTarget() {
  return {
    diagnosticOnly: true,
    proofTargetId: 'phase_3_row_1_local_no_provider',
    proofPolicy: 'build_required_anchor_soft_geography' as const,
    proofMode: 'build_required_anchor' as const,
    targetPocketId: 'raw-pocket-willow',
    targetPocketLabel: 'Willow Glen Pocket',
    activePocketId: 'raw-pocket-willow',
    activePocketLabel: 'Willow Glen Pocket',
    crossPocketAllowed: true,
  }
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'unavailable'
}

function buildRow(params: {
  routeLabel: string
  supportSource: string
  candidateProducer: string
  supportScreenProducer: string
  materializationSource: string
  greatStopProducer: string
  appInvolvement: string
  contractEntryProduced: boolean
  runtimeRouteProduced: boolean
  greatStopPassFail: 'pass' | 'fail' | 'not_evaluated'
  greatStopFailureReasons: string
  reviewLockEligible: boolean
  staticCorpusUsed: boolean
  fallbackUsed: boolean
  providerShadowUsed: boolean
  demoSpecialUsed: boolean
  appAuthorityShadowUsed: boolean
  legacyWrapperUsed: boolean
  diagnosticOnly: boolean
  honestFail: boolean
  roleScore: string
  stopShapeFit: string
  lensCompatibility: string
  contextSpecificity: string
  thresholdSource: string
  evidenceStatus: string
}): ProofRow {
  const lineagePopulated = [
    params.candidateProducer,
    params.supportScreenProducer,
    params.materializationSource,
    params.greatStopProducer,
    params.appInvolvement,
  ].every((value) => value.trim().length > 0)
  const maskingFlagsPopulated = true
  const disqualifyingMasking =
    params.staticCorpusUsed ||
    params.fallbackUsed ||
    params.providerShadowUsed ||
    params.demoSpecialUsed ||
    params.appAuthorityShadowUsed ||
    params.legacyWrapperUsed
  const validMvpPass =
    params.contractEntryProduced &&
    params.runtimeRouteProduced &&
    params.greatStopPassFail === 'pass' &&
    params.reviewLockEligible &&
    lineagePopulated &&
    maskingFlagsPopulated &&
    !disqualifyingMasking
  const apparentPass =
    params.contractEntryProduced &&
    (params.greatStopPassFail === 'pass' || params.reviewLockEligible || params.runtimeRouteProduced)
  const invalidFalseGreen =
    apparentPass &&
    !validMvpPass &&
    !params.diagnosticOnly &&
    !params.honestFail

  return {
    mode: 'Curate',
    'starter/family': 'coffee-books / romantic_cultured',
    'route id / route label': params.routeLabel,
    'support source': params.supportSource,
    'candidate producer': params.candidateProducer,
    'support-screen producer': params.supportScreenProducer,
    'materialization/projection source': params.materializationSource,
    'Great Stop producer': params.greatStopProducer,
    'routeAuthority/Application involvement': params.appInvolvement,
    'ContractEntryArtifact produced? yes/no': yesNo(params.contractEntryProduced),
    'RuntimeRouteArtifact produced? yes/no': yesNo(params.runtimeRouteProduced),
    'Great Stop pass/fail': params.greatStopPassFail,
    'Great Stop failure reasons': params.greatStopFailureReasons,
    'Review/Lock eligible? yes/no': yesNo(params.reviewLockEligible),
    'provider calls count': String(fetchCallCount),
    'hosted calls count': '0',
    'static corpus used? yes/no': yesNo(params.staticCorpusUsed),
    'fallback used? yes/no': yesNo(params.fallbackUsed),
    'provider-shadow used? yes/no': yesNo(params.providerShadowUsed),
    'DEMO-SPECIAL path used? yes/no': yesNo(params.demoSpecialUsed),
    'app-authority shadow used? yes/no': yesNo(params.appAuthorityShadowUsed),
    'legacy wrapper used? yes/no': yesNo(params.legacyWrapperUsed),
    'diagnostic-only? yes/no': yesNo(params.diagnosticOnly),
    'valid MVP pass? yes/no': yesNo(validMvpPass),
    'honest-fail? yes/no': yesNo(params.honestFail),
    roleScore: params.roleScore,
    stopShapeFit: params.stopShapeFit,
    lensCompatibility: params.lensCompatibility,
    contextSpecificity: params.contextSpecificity,
    'threshold source': params.thresholdSource,
    'evidence persisted/carried/recomputed/defaulted/unavailable': params.evidenceStatus,
    'invalid false-green? yes/no': yesNo(invalidFalseGreen),
    'proof validity label': validMvpPass
      ? 'valid_mvp_pass'
      : params.honestFail
        ? 'founder_review_honest_fail_candidate'
        : params.diagnosticOnly
          ? 'diagnostic_only_not_mvp_green'
          : 'invalid_false_green',
  }
}

const { buildCurateScenarioBackedArtifactBridge } = await import(
  '../src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts'
)
const { starterPacks } = await import('../src/data/starterPacks.ts')

const coffeeBooksStarterPack = starterPacks.find((pack) => pack.id === 'coffee-books')
assert(coffeeBooksStarterPack, 'Missing Coffee & Books starter pack fixture.')

const directionCard = buildDirectionCard()
const proofTarget = buildBuildRequiredAnchorProofTarget()

const scenarioOnly = buildCurateScenarioBackedArtifactBridge({
  primaryOpportunities: [buildSupportReselectionOpportunity({ includeCompactWindDown: true })],
  fallbackOpportunities: [],
  ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
  directionCards: [directionCard],
  allDirectionCards: [directionCard],
  starterPack: coffeeBooksStarterPack,
  proofTarget,
})
const scenarioOnlyDiagnostic = scenarioOnly.diagnostics[0]?.buildRequiredAnchorSupportSelection
assert(scenarioOnlyDiagnostic, 'Scenario-only proof cell missing support diagnostic.')
const scenarioOnlyWindDown = scenarioOnlyDiagnostic.windDownCandidateDiagnostics.find(
  (entry) => entry.name === 'Willow Glen Bakehouse',
)
assert(scenarioOnlyWindDown, 'Scenario-only proof cell missing Willow Glen Bakehouse diagnostic.')
assert(
  scenarioOnly.candidateArtifacts.length === 0 &&
    scenarioOnlyDiagnostic.status === 'failed' &&
    scenarioOnlyWindDown.rejectedReason === 'taste_verdict_evidence_missing',
  'Scenario-only support without Taste evidence must fail closed.',
)

const admittedSupport = buildCurateScenarioBackedArtifactBridge({
  primaryOpportunities: [buildSupportReselectionOpportunity({ includeCompactWindDown: false })],
  fallbackOpportunities: [],
  ecsState: { exploration: 'focused', discovery: 'reliable', highlight: 'standout' },
  directionCards: [directionCard],
  allDirectionCards: [directionCard],
  admittedSupportCandidates: [buildAdmittedSupportCandidate()],
  starterPack: coffeeBooksStarterPack,
  proofTarget,
})
const admittedDiagnostic = admittedSupport.diagnostics[0]?.buildRequiredAnchorSupportSelection
assert(admittedDiagnostic, 'Admitted support proof cell missing support diagnostic.')
const admittedWindDown = admittedDiagnostic.windDownCandidateDiagnostics.find(
  (entry) => entry.name === 'Willow Glen Cafe Landing',
)
assert(admittedWindDown, 'Admitted support proof cell missing Willow Glen Cafe Landing diagnostic.')
assert(
  admittedSupport.candidateArtifacts.length === 1 &&
    admittedDiagnostic.status === 'passed' &&
    admittedWindDown.tasteSupportVerdictPassed,
  'Admitted Taste-backed support should materialize a ContractEntryArtifact for diagnostic proof.',
)

const rows: ProofRow[] = [
  buildRow({
    routeLabel: 'phase-3-row-1-scenario-only-missing-taste-evidence',
    supportSource: 'scenario_stop',
    candidateProducer: 'Application/Curate bridge fixture',
    supportScreenProducer: 'Application/Curate buildRequiredAnchorSupportSelection diagnostic',
    materializationSource: 'none - fail closed before ContractEntryArtifact',
    greatStopProducer: 'not_evaluated - no route materialized',
    appInvolvement: 'Curate bridge DEMO-SPECIAL diagnostic surface',
    contractEntryProduced: false,
    runtimeRouteProduced: false,
    greatStopPassFail: 'not_evaluated',
    greatStopFailureReasons: scenarioOnly.diagnostics[0]?.scenarioRouteBuildabilityReason ?? 'support_selection_failed',
    reviewLockEligible: false,
    staticCorpusUsed: true,
    fallbackUsed: false,
    providerShadowUsed: false,
    demoSpecialUsed: true,
    appAuthorityShadowUsed: true,
    legacyWrapperUsed: false,
    diagnosticOnly: true,
    honestFail: true,
    roleScore: formatNumber(scenarioOnlyWindDown.tasteSupportVerdict?.scores.roleScore),
    stopShapeFit: formatNumber(scenarioOnlyWindDown.tasteSupportVerdict?.scores.stopShapeFit),
    lensCompatibility: formatNumber(scenarioOnlyWindDown.tasteSupportVerdict?.scores.lensCompatibility),
    contextSpecificity: formatNumber(scenarioOnlyWindDown.tasteSupportVerdict?.scores.contextSpecificity),
    thresholdSource:
      scenarioOnlyWindDown.tasteSupportVerdict?.coreFunctionName ?? 'evaluateTasteRoleIntentCore',
    evidenceStatus: 'unavailable',
  }),
  buildRow({
    routeLabel: admittedSupport.candidateArtifacts[0]?.id ?? 'phase-3-row-1-admitted-support-diagnostic-route',
    supportSource: 'admitted_candidate_board',
    candidateProducer: 'Application/Curate bridge consuming Taste support verdict',
    supportScreenProducer: 'Taste evaluateTasteSupportCandidateVerdict via Curate bridge diagnostic',
    materializationSource: 'ContractEntryArtifact from scenario-backed Curate bridge',
    greatStopProducer: 'not_evaluated - Phase 3B local harness does not run Great Stop proof',
    appInvolvement: 'Curate bridge DEMO-SPECIAL diagnostic surface; routeAuthority not evaluated',
    contractEntryProduced: true,
    runtimeRouteProduced: false,
    greatStopPassFail: 'not_evaluated',
    greatStopFailureReasons: 'Great Stop proof not run in Phase 3B harness implementation',
    reviewLockEligible: false,
    staticCorpusUsed: true,
    fallbackUsed: false,
    providerShadowUsed: false,
    demoSpecialUsed: true,
    appAuthorityShadowUsed: true,
    legacyWrapperUsed: false,
    diagnosticOnly: true,
    honestFail: false,
    roleScore: formatNumber(admittedWindDown.tasteSupportVerdict?.scores.roleScore),
    stopShapeFit: formatNumber(admittedWindDown.tasteSupportVerdict?.scores.stopShapeFit),
    lensCompatibility: formatNumber(admittedWindDown.tasteSupportVerdict?.scores.lensCompatibility),
    contextSpecificity: formatNumber(admittedWindDown.tasteSupportVerdict?.scores.contextSpecificity),
    thresholdSource:
      admittedWindDown.tasteSupportVerdict?.coreFunctionName ?? 'evaluateTasteRoleIntentCore',
    evidenceStatus: 'carried',
  }),
]

const missingColumns = rows.flatMap((row, index) =>
  missingColumnsFor(row).map((column) => ({ row: index + 1, column })),
)
assert(missingColumns.length === 0, `Missing Phase 3 proof columns: ${JSON.stringify(missingColumns)}`)
assert(fetchCallCount === 0, `Provider/hosted fetch calls must stay zero, got ${fetchCallCount}.`)

const outputDir = join(process.cwd(), '.audit-output-614a103', 'phase-3-proof-gate')
mkdirSync(outputDir, { recursive: true })
const csvPath = join(outputDir, 'phase-3-mvp-proof-gate.csv')
const ndjsonPath = join(outputDir, 'phase-3-mvp-proof-gate.ndjson')
const jsonPath = join(outputDir, 'phase-3-mvp-proof-gate.json')
const markdownPath = join(outputDir, 'phase-3-mvp-proof-gate-summary.md')

const summary = {
  generatedAt: new Date().toISOString(),
  head: '8a7c3e5',
  phase: '3B local no-provider proof harness',
  providerCalls: fetchCallCount,
  hostedCalls: 0,
  rowsProduced: rows.length,
  validMvpPasses: rows.filter((row) => row['valid MVP pass? yes/no'] === 'yes').length,
  diagnosticOnlyRows: rows.filter((row) => row['diagnostic-only? yes/no'] === 'yes').length,
  honestFails: rows.filter((row) => row['honest-fail? yes/no'] === 'yes').length,
  invalidFalseGreens: rows.filter((row) => row['invalid false-green? yes/no'] === 'yes').length,
  missingColumns,
  outputColumns,
}

writeCsv(csvPath, rows)
writeNdjson(ndjsonPath, rows)
writeFileSync(jsonPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8')
writeFileSync(
  markdownPath,
  [
    '# Phase 3 MVP Proof Gate Summary',
    '',
    '- phase: 3B local no-provider proof harness',
    '- claim: diagnostic-only harness implementation, not MVP green',
    `- rows produced: ${summary.rowsProduced}`,
    `- valid MVP passes: ${summary.validMvpPasses}`,
    `- diagnostic-only rows: ${summary.diagnosticOnlyRows}`,
    `- honest-fails: ${summary.honestFails}`,
    `- invalid false-greens: ${summary.invalidFalseGreens}`,
    `- provider calls: ${summary.providerCalls}`,
    `- hosted calls: ${summary.hostedCalls}`,
    `- missing columns: ${summary.missingColumns.length}`,
    '',
    '## Rows',
    '',
    ...rows.map((row, index) =>
      [
        `### Row ${index + 1} - ${row['route id / route label']}`,
        '',
        `- valid MVP pass: ${row['valid MVP pass? yes/no']}`,
        `- diagnostic-only: ${row['diagnostic-only? yes/no']}`,
        `- honest-fail: ${row['honest-fail? yes/no']}`,
        `- Great Stop: ${row['Great Stop pass/fail']}`,
        `- Review/Lock eligible: ${row['Review/Lock eligible? yes/no']}`,
        `- proof validity: ${row['proof validity label']}`,
        '',
      ].join('\n'),
    ),
  ].join('\n'),
  'utf8',
)

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
