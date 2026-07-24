import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type {
  CurateBuildAdmittedSupportCandidate,
} from '../src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
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
  'ContractEntryArtifact status',
  'RuntimeRouteArtifact status',
  'Great Stop evaluation status',
  'Review/Lock status',
  'lifecycle capture status',
  'routeAuthority snapshot status',
  'routeAuthority source label',
  'routeAuthority rejection reasons',
  'lock input status',
  'lock input rejection reason',
  'runtime lock truth status',
  'runtime lock truth reason',
  'lifecycle input availability',
  'itinerary missing? yes/no',
  'scored venues missing? yes/no',
  'runtime lock eligibility missing? yes/no',
  'Great Stop status missing? yes/no',
  'route-level lock truth source missing? yes/no',
  'compatibility route truth? yes/no',
  'canonical route truth? yes/no',
  'false-green risk? yes/no',
  'why not MVP green',
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

function readGitMetadata(args: string[]): string | null {
  try {
    const value = execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return value.length > 0 ? value : null
  } catch {
    return null
  }
}

const PROOF_PHASE_LABEL = 'Phase 3L harness input mapping implementation/run'
const metadataHead = readGitMetadata(['rev-parse', '--short', 'HEAD'])
const metadataBranch = readGitMetadata(['branch', '--show-current'])
const metadataStatus = metadataHead ? 'available' : 'unavailable'

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
  contractEntryStatus: 'produced' | 'not produced' | 'not observed' | 'diagnostic-only' | 'blocked'
  runtimeRouteStatus:
    | 'produced'
    | 'not produced'
    | 'not observed'
    | 'unavailable_missing_inputs'
    | 'diagnostic-only'
    | 'blocked'
  greatStopEvaluationStatus:
    | 'evaluated-pass'
    | 'evaluated-fail'
    | 'not evaluated'
    | 'not observed'
    | 'unavailable_missing_inputs'
    | 'diagnostic-only'
  reviewLockStatus:
    | 'eligible'
    | 'ineligible'
    | 'not evaluated'
    | 'not observed'
    | 'unavailable_missing_inputs'
    | 'diagnostic-only'
  lifecycleCaptureStatus: 'complete' | 'partial' | 'diagnostic-only' | 'blocked'
  routeAuthoritySnapshotStatus: string
  routeAuthoritySourceLabel: string
  routeAuthorityRejectionReasons: string
  lockInputStatus: string
  lockInputRejectionReason: string
  runtimeLockTruthStatus: string
  runtimeLockTruthReason: string
  lifecycleInputAvailability: string
  itineraryMissing: boolean
  scoredVenuesMissing: boolean
  runtimeLockEligibilityMissing: boolean
  greatStopStatusMissing: boolean
  routeLevelLockTruthSourceMissing: boolean
  compatibilityRouteTruth: boolean
  canonicalRouteTruth: boolean
  whyNotMvpGreen: string
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
  const falseGreenRisk = disqualifyingMasking || params.compatibilityRouteTruth
  const validMvpPass =
    params.contractEntryProduced &&
    params.runtimeRouteProduced &&
    params.canonicalRouteTruth &&
    params.greatStopPassFail === 'pass' &&
    params.reviewLockEligible &&
    lineagePopulated &&
    maskingFlagsPopulated &&
    !params.compatibilityRouteTruth &&
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
    'ContractEntryArtifact status': params.contractEntryStatus,
    'RuntimeRouteArtifact status': params.runtimeRouteStatus,
    'Great Stop evaluation status': params.greatStopEvaluationStatus,
    'Review/Lock status': params.reviewLockStatus,
    'lifecycle capture status': params.lifecycleCaptureStatus,
    'routeAuthority snapshot status': params.routeAuthoritySnapshotStatus,
    'routeAuthority source label': params.routeAuthoritySourceLabel,
    'routeAuthority rejection reasons': params.routeAuthorityRejectionReasons,
    'lock input status': params.lockInputStatus,
    'lock input rejection reason': params.lockInputRejectionReason,
    'runtime lock truth status': params.runtimeLockTruthStatus,
    'runtime lock truth reason': params.runtimeLockTruthReason,
    'lifecycle input availability': params.lifecycleInputAvailability,
    'itinerary missing? yes/no': yesNo(params.itineraryMissing),
    'scored venues missing? yes/no': yesNo(params.scoredVenuesMissing),
    'runtime lock eligibility missing? yes/no': yesNo(params.runtimeLockEligibilityMissing),
    'Great Stop status missing? yes/no': yesNo(params.greatStopStatusMissing),
    'route-level lock truth source missing? yes/no': yesNo(params.routeLevelLockTruthSourceMissing),
    'compatibility route truth? yes/no': yesNo(params.compatibilityRouteTruth),
    'canonical route truth? yes/no': yesNo(params.canonicalRouteTruth),
    'false-green risk? yes/no': yesNo(falseGreenRisk),
    'why not MVP green': validMvpPass ? 'valid MVP pass' : params.whyNotMvpGreen,
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
const { buildLockInputFromRouteAuthoritySnapshot, buildRouteAuthoritySnapshot } = await import(
  '../src/app/services/routeAuthority/routeAuthorityService.ts'
)
const { starterPacks } = await import('../src/data/starterPacks.ts')

function joinReasonList(values: readonly string[] | null | undefined): string {
  const reasons = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
  return reasons.length > 0 ? reasons.join('|') : 'none'
}

function observeLifecycleFromArtifact(params: {
  artifact: ContractEntryArtifact | null
  selectedClusterConfirmation: string
  fallbackCity: string
}): {
  routeAuthoritySnapshotStatus: string
  routeAuthoritySourceLabel: string
  routeAuthorityRejectionReasons: string
  lockInputStatus: string
  lockInputRejectionReason: string
  runtimeLockTruthStatus: 'produced' | 'blocked' | 'not observed' | 'unavailable_missing_inputs' | 'diagnostic_only'
  runtimeLockTruthReason: string
  runtimeRouteStatus: 'produced' | 'blocked' | 'not observed' | 'unavailable_missing_inputs' | 'diagnostic-only'
  greatStopEvaluationStatus:
    | 'evaluated-pass'
    | 'evaluated-fail'
    | 'not evaluated'
    | 'not observed'
    | 'unavailable_missing_inputs'
    | 'diagnostic-only'
  reviewLockStatus: 'eligible' | 'ineligible' | 'not observed' | 'unavailable_missing_inputs'
  reviewLockEligible: boolean
  lifecycleInputAvailability: string
  itineraryMissing: boolean
  scoredVenuesMissing: boolean
  runtimeLockEligibilityMissing: boolean
  greatStopStatusMissing: boolean
  routeLevelLockTruthSourceMissing: boolean
  compatibilityRouteTruth: boolean
  canonicalRouteTruth: boolean
} {
  if (!params.artifact) {
    return {
      routeAuthoritySnapshotStatus: 'not_evaluated',
      routeAuthoritySourceLabel: 'none',
      routeAuthorityRejectionReasons: 'no_contract_entry_artifact',
      lockInputStatus: 'not_evaluated',
      lockInputRejectionReason: 'no_contract_entry_artifact',
      runtimeLockTruthStatus: 'not observed',
      runtimeLockTruthReason: 'no_contract_entry_artifact',
      runtimeRouteStatus: 'blocked',
      greatStopEvaluationStatus: 'not evaluated',
      reviewLockStatus: 'ineligible',
      reviewLockEligible: false,
      lifecycleInputAvailability: 'not_applicable_no_contract_entry_artifact',
      itineraryMissing: true,
      scoredVenuesMissing: true,
      runtimeLockEligibilityMissing: true,
      greatStopStatusMissing: true,
      routeLevelLockTruthSourceMissing: true,
      compatibilityRouteTruth: false,
      canonicalRouteTruth: false,
    }
  }

  const embeddedRuntimeLockEligibility = params.artifact.enrichment?.runtimeLockEligibility ?? null
  const embeddedRuntimeRouteArtifact = embeddedRuntimeLockEligibility?.runtimeRouteArtifact ?? null
  const embeddedGreatStopStatus = embeddedRuntimeLockEligibility?.greatStopStatus ?? null
  const lifecycleMissingInputs = [
    'missing_itinerary',
    'missing_scored_venues',
    embeddedRuntimeLockEligibility ? null : 'missing_runtime_lock_eligibility',
  ].filter((value): value is string => Boolean(value))
  const itineraryMissing = true
  const scoredVenuesMissing = true
  const runtimeLockEligibilityMissing = !embeddedRuntimeLockEligibility
  const greatStopStatusMissing = !embeddedGreatStopStatus
  const routeLevelLockTruthSourceMissing = !embeddedRuntimeRouteArtifact
  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: params.artifact,
    selectedDirectionId: params.artifact.selection.directionId ?? null,
    selectedArtifactId: params.artifact.id,
    selectedClusterConfirmation: params.selectedClusterConfirmation,
  })
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: params.fallbackCity,
  })

  const runtimeLockTruthStatus = embeddedRuntimeRouteArtifact
    ? 'produced'
    : lifecycleMissingInputs.length > 0
      ? 'unavailable_missing_inputs'
      : 'not observed'
  const runtimeLockTruthReason =
    runtimeLockTruthStatus === 'produced'
      ? 'embedded_runtime_route_artifact_observed'
      : runtimeLockTruthStatus === 'unavailable_missing_inputs'
        ? lifecycleMissingInputs.join('|')
        : 'runtime_lock_truth_not_observed'

  return {
    routeAuthoritySnapshotStatus: snapshot.validationStatus,
    routeAuthoritySourceLabel: snapshot.sourceLabel,
    routeAuthorityRejectionReasons: joinReasonList(snapshot.rejectionReasons),
    lockInputStatus: lockInput.ok ? 'eligible' : 'blocked',
    lockInputRejectionReason: lockInput.ok
      ? 'none'
      : lockInput.diagnostics.rejectionReason ?? 'missing_lock_ready_canonical_route_truth',
    runtimeLockTruthStatus,
    runtimeLockTruthReason,
    runtimeRouteStatus: embeddedRuntimeRouteArtifact ? 'produced' : 'unavailable_missing_inputs',
    greatStopEvaluationStatus:
      embeddedGreatStopStatus === 'PASS'
        ? 'evaluated-pass'
        : embeddedGreatStopStatus === 'FAIL'
          ? 'evaluated-fail'
          : 'not observed',
    reviewLockStatus: lockInput.ok ? 'eligible' : 'ineligible',
    reviewLockEligible: lockInput.ok,
    lifecycleInputAvailability:
      lifecycleMissingInputs.length > 0 ? lifecycleMissingInputs.join('|') : 'available',
    itineraryMissing,
    scoredVenuesMissing,
    runtimeLockEligibilityMissing,
    greatStopStatusMissing,
    routeLevelLockTruthSourceMissing,
    compatibilityRouteTruth: false,
    canonicalRouteTruth: Boolean(embeddedRuntimeRouteArtifact),
  }
}

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
const admittedArtifact = admittedSupport.candidateArtifacts[0] ?? null
const admittedRuntimeLockEligibility = admittedArtifact?.enrichment?.runtimeLockEligibility ?? null
const admittedRuntimeRouteArtifact = admittedRuntimeLockEligibility?.runtimeRouteArtifact ?? null
const admittedGreatStopStatus = admittedRuntimeLockEligibility?.greatStopStatus ?? null
const admittedReviewLockEligible = admittedRuntimeLockEligibility?.eligible ?? null
const scenarioOnlyLifecycle = observeLifecycleFromArtifact({
  artifact: null,
  selectedClusterConfirmation: 'Phase 3 local proof fixture direction',
  fallbackCity: 'San Jose',
})
const admittedLifecycle = observeLifecycleFromArtifact({
  artifact: admittedArtifact,
  selectedClusterConfirmation: 'Phase 3 local proof fixture direction',
  fallbackCity: 'San Jose',
})

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
    contractEntryStatus: 'blocked',
    runtimeRouteStatus: 'blocked',
    greatStopEvaluationStatus: 'not evaluated',
    reviewLockStatus: 'ineligible',
    lifecycleCaptureStatus: 'blocked',
    routeAuthoritySnapshotStatus: scenarioOnlyLifecycle.routeAuthoritySnapshotStatus,
    routeAuthoritySourceLabel: scenarioOnlyLifecycle.routeAuthoritySourceLabel,
    routeAuthorityRejectionReasons: scenarioOnlyLifecycle.routeAuthorityRejectionReasons,
    lockInputStatus: scenarioOnlyLifecycle.lockInputStatus,
    lockInputRejectionReason: scenarioOnlyLifecycle.lockInputRejectionReason,
    runtimeLockTruthStatus: scenarioOnlyLifecycle.runtimeLockTruthStatus,
    runtimeLockTruthReason: scenarioOnlyLifecycle.runtimeLockTruthReason,
    lifecycleInputAvailability: scenarioOnlyLifecycle.lifecycleInputAvailability,
    itineraryMissing: scenarioOnlyLifecycle.itineraryMissing,
    scoredVenuesMissing: scenarioOnlyLifecycle.scoredVenuesMissing,
    runtimeLockEligibilityMissing: scenarioOnlyLifecycle.runtimeLockEligibilityMissing,
    greatStopStatusMissing: scenarioOnlyLifecycle.greatStopStatusMissing,
    routeLevelLockTruthSourceMissing: scenarioOnlyLifecycle.routeLevelLockTruthSourceMissing,
    compatibilityRouteTruth: scenarioOnlyLifecycle.compatibilityRouteTruth,
    canonicalRouteTruth: scenarioOnlyLifecycle.canonicalRouteTruth,
    whyNotMvpGreen:
      'support selection failed closed before ContractEntryArtifact; RuntimeRouteArtifact, Great Stop, and Review/Lock are blocked',
  }),
  buildRow({
    routeLabel: admittedArtifact?.id ?? 'phase-3-row-1-admitted-support-diagnostic-route',
    supportSource: 'admitted_candidate_board',
    candidateProducer: 'Application/Curate bridge consuming Taste support verdict',
    supportScreenProducer: 'Taste evaluateTasteSupportCandidateVerdict via Curate bridge diagnostic',
    materializationSource: 'ContractEntryArtifact from scenario-backed Curate bridge',
    greatStopProducer: admittedGreatStopStatus
      ? 'ContractEntryArtifact runtimeLockEligibility'
      : 'not_observed - local diagnostic harness did not reach Great Stop lifecycle output',
    appInvolvement: 'Curate bridge DEMO-SPECIAL diagnostic surface; routeAuthority observed as compatibility gate',
    contractEntryProduced: true,
    runtimeRouteProduced: Boolean(admittedRuntimeRouteArtifact),
    greatStopPassFail: admittedGreatStopStatus === 'PASS' ? 'pass' : admittedGreatStopStatus === 'FAIL' ? 'fail' : 'not_evaluated',
    greatStopFailureReasons:
      admittedRuntimeLockEligibility?.greatStopRejectionReasons?.join('|') ||
      admittedRuntimeLockEligibility?.greatStopFailedCriteria?.join('|') ||
      'Great Stop lifecycle output not observed on local diagnostic ContractEntryArtifact',
    reviewLockEligible: admittedLifecycle.reviewLockEligible,
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
    contractEntryStatus: 'produced',
    runtimeRouteStatus: admittedLifecycle.runtimeRouteStatus,
    greatStopEvaluationStatus: admittedLifecycle.greatStopEvaluationStatus,
    reviewLockStatus: admittedLifecycle.reviewLockStatus,
    lifecycleCaptureStatus: admittedRuntimeRouteArtifact && admittedGreatStopStatus && admittedReviewLockEligible === true
      ? 'complete'
      : 'partial',
    routeAuthoritySnapshotStatus: admittedLifecycle.routeAuthoritySnapshotStatus,
    routeAuthoritySourceLabel: admittedLifecycle.routeAuthoritySourceLabel,
    routeAuthorityRejectionReasons: admittedLifecycle.routeAuthorityRejectionReasons,
    lockInputStatus: admittedLifecycle.lockInputStatus,
    lockInputRejectionReason: admittedLifecycle.lockInputRejectionReason,
    runtimeLockTruthStatus: admittedLifecycle.runtimeLockTruthStatus,
    runtimeLockTruthReason: admittedLifecycle.runtimeLockTruthReason,
    lifecycleInputAvailability: admittedLifecycle.lifecycleInputAvailability,
    itineraryMissing: admittedLifecycle.itineraryMissing,
    scoredVenuesMissing: admittedLifecycle.scoredVenuesMissing,
    runtimeLockEligibilityMissing: admittedLifecycle.runtimeLockEligibilityMissing,
    greatStopStatusMissing: admittedLifecycle.greatStopStatusMissing,
    routeLevelLockTruthSourceMissing: admittedLifecycle.routeLevelLockTruthSourceMissing,
    compatibilityRouteTruth: admittedLifecycle.compatibilityRouteTruth,
    canonicalRouteTruth: admittedLifecycle.canonicalRouteTruth,
    whyNotMvpGreen:
      'ContractEntryArtifact is produced and routeAuthority/lock-input are observed, but RuntimeRouteArtifact is unavailable because route-level lock inputs are missing; Great Stop is not observed; Review/Lock remains ineligible; static/DEMO-SPECIAL/app-authority flags remain',
  }),
]

const missingColumns = rows.flatMap((row, index) =>
  missingColumnsFor(row).map((column) => ({ row: index + 1, column })),
)
const compatibilityRouteTruthRows = rows.filter((row) => row['compatibility route truth? yes/no'] === 'yes').length
const canonicalRouteTruthRows = rows.filter((row) => row['canonical route truth? yes/no'] === 'yes').length
const diagnosticCompatibilityRowAdded = rows.some(
  (row) => row['compatibility route truth? yes/no'] === 'yes' && row['diagnostic-only? yes/no'] === 'yes',
)
const currentRow2 = rows.find((row) => row['support source'] === 'admitted_candidate_board') ?? null
const currentRow2MissingInputs = currentRow2
  ? {
      itineraryMissing: currentRow2['itinerary missing? yes/no'],
      scoredVenuesMissing: currentRow2['scored venues missing? yes/no'],
      runtimeLockEligibilityMissing: currentRow2['runtime lock eligibility missing? yes/no'],
      greatStopStatusMissing: currentRow2['Great Stop status missing? yes/no'],
      routeLevelLockTruthSourceMissing: currentRow2['route-level lock truth source missing? yes/no'],
      lockInputBlockedReason: currentRow2['lock input rejection reason'],
    }
  : null
assert(missingColumns.length === 0, `Missing Phase 3 proof columns: ${JSON.stringify(missingColumns)}`)
assert(
  rows.every((row) => row['compatibility route truth? yes/no'] !== 'yes' || row['valid MVP pass? yes/no'] === 'no'),
  'Compatibility route truth rows must not be marked as valid MVP passes.',
)
assert(fetchCallCount === 0, `Provider/hosted fetch calls must stay zero, got ${fetchCallCount}.`)

const outputDir = join(process.cwd(), '.audit-output-614a103', 'phase-3-proof-gate')
mkdirSync(outputDir, { recursive: true })
const csvPath = join(outputDir, 'phase-3-mvp-proof-gate.csv')
const ndjsonPath = join(outputDir, 'phase-3-mvp-proof-gate.ndjson')
const jsonPath = join(outputDir, 'phase-3-mvp-proof-gate.json')
const markdownPath = join(outputDir, 'phase-3-mvp-proof-gate-summary.md')

const summary = {
  generatedAt: new Date().toISOString(),
  head: metadataHead ?? 'unknown',
  branch: metadataBranch ?? 'unknown',
  metadataStatus,
  phase: PROOF_PHASE_LABEL,
  providerCalls: fetchCallCount,
  hostedCalls: 0,
  rowsProduced: rows.length,
  validMvpPasses: rows.filter((row) => row['valid MVP pass? yes/no'] === 'yes').length,
  diagnosticOnlyRows: rows.filter((row) => row['diagnostic-only? yes/no'] === 'yes').length,
  honestFails: rows.filter((row) => row['honest-fail? yes/no'] === 'yes').length,
  invalidFalseGreens: rows.filter((row) => row['invalid false-green? yes/no'] === 'yes').length,
  lifecycleCompleteRows: rows.filter((row) => row['lifecycle capture status'] === 'complete').length,
  lifecyclePartialRows: rows.filter((row) => row['lifecycle capture status'] === 'partial').length,
  lifecycleBlockedRows: rows.filter((row) => row['lifecycle capture status'] === 'blocked').length,
  compatibilityRouteTruthRows,
  canonicalRouteTruthRows,
  currentRow2MissingInputs,
  diagnosticCompatibilityRowAdded,
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
    `- phase: ${summary.phase}`,
    `- head: ${summary.head}`,
    `- branch: ${summary.branch}`,
    `- metadata status: ${summary.metadataStatus}`,
    '- claim: diagnostic-only harness implementation, not MVP green',
    `- rows produced: ${summary.rowsProduced}`,
    `- valid MVP passes: ${summary.validMvpPasses}`,
    `- diagnostic-only rows: ${summary.diagnosticOnlyRows}`,
    `- honest-fails: ${summary.honestFails}`,
    `- invalid false-greens: ${summary.invalidFalseGreens}`,
    `- lifecycle-complete rows: ${summary.lifecycleCompleteRows}`,
    `- lifecycle-partial rows: ${summary.lifecyclePartialRows}`,
    `- lifecycle-blocked rows: ${summary.lifecycleBlockedRows}`,
    `- compatibility route truth rows: ${summary.compatibilityRouteTruthRows}`,
    `- canonical route truth rows: ${summary.canonicalRouteTruthRows}`,
    `- diagnostic compatibility row added: ${yesNo(summary.diagnosticCompatibilityRowAdded)}`,
    `- current Row 2 missing inputs: ${summary.currentRow2MissingInputs ? JSON.stringify(summary.currentRow2MissingInputs) : 'not_found'}`,
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
        `- lifecycle capture: ${row['lifecycle capture status']}`,
        `- routeAuthority snapshot: ${row['routeAuthority snapshot status']}`,
        `- lock input: ${row['lock input status']}`,
        `- runtime lock truth: ${row['runtime lock truth status']}`,
        `- input missing flags: itinerary=${row['itinerary missing? yes/no']}; scored venues=${row['scored venues missing? yes/no']}; runtime lock eligibility=${row['runtime lock eligibility missing? yes/no']}; Great Stop status=${row['Great Stop status missing? yes/no']}; route-level lock truth source=${row['route-level lock truth source missing? yes/no']}`,
        `- route truth flags: compatibility=${row['compatibility route truth? yes/no']}; canonical=${row['canonical route truth? yes/no']}; false-green risk=${row['false-green risk? yes/no']}`,
        `- why not MVP green: ${row['why not MVP green']}`,
        `- proof validity: ${row['proof validity label']}`,
        '',
      ].join('\n'),
    ),
  ].join('\n'),
  'utf8',
)

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
