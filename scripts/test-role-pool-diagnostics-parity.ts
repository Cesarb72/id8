import { starterPacks } from '../src/data/starterPacks.ts'
import { sanJoseVenues } from '../src/data/venues.ts'
import { buildCurateFailedStarterDiagnostics } from '../src/domain/diagnostics/buildCurateFailedStarterDiagnostics.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { RolePoolDiagnostics } from '../src/domain/types/diagnostics.ts'
import type { IntentInput } from '../src/domain/types/intent.ts'
import type { UserStopRole } from '../src/domain/types/itinerary.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const originalFetch = globalThis.fetch
const originalCorpusFlag = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY

let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Role-pool diagnostics parity observer must not call fetch: ${url}`)
}) as typeof fetch

process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = '1'
process.env.VITE_ID8_SOURCE_MODE = 'curated'
delete process.env.VITE_GOOGLE_PLACES_API_KEY

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertDeepEqual<T>(actual: T, expected: T, label: string): void {
  const actualJson = JSON.stringify(actual, null, 2)
  const expectedJson = JSON.stringify(expected, null, 2)
  assert(actualJson === expectedJson, `${label} changed.\nExpected:\n${expectedJson}\nActual:\n${actualJson}`)
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  assert(starterPack, `Missing starter pack fixture: ${id}`)
  return starterPack
}

function summarizeRolePoolDiagnostics(
  diagnostics: Partial<Record<UserStopRole, RolePoolDiagnostics>>,
) {
  return {
    roles: (['start', 'highlight', 'surprise', 'windDown'] as const).filter(
      (role) => diagnostics[role] !== undefined,
    ),
    start: summarizeRoleDiagnostic(diagnostics.start),
    highlight: summarizeRoleDiagnostic(diagnostics.highlight),
    windDown: summarizeRoleDiagnostic(diagnostics.windDown),
  }
}

function summarizeRoleDiagnostic(diagnostic: RolePoolDiagnostics | undefined) {
  if (!diagnostic) {
    return undefined
  }
  return {
    rolePoolSize: diagnostic.rolePoolSize,
    strongCandidateCount: diagnostic.strongCandidateCount,
    categoryDiversityCount: diagnostic.categoryDiversityCount,
    topConfidenceBand: diagnostic.topConfidenceBand,
    weakPool: diagnostic.weakPool,
    weakPoolReason: diagnostic.weakPoolReason,
    selectedVenueId: diagnostic.selectedVenueId,
    selectedScore: diagnostic.selectedScore,
    runnerUpVenueId: diagnostic.runnerUpVenueId,
    runnerUpScore: diagnostic.runnerUpScore,
    fallbackUsed: diagnostic.fallbackUsed,
    fallbackLabel: diagnostic.fallbackLabel,
    roleContractLabel: diagnostic.roleContractLabel,
    roleContractStrength: diagnostic.roleContractStrength,
    contractStrictCandidateCount: diagnostic.contractStrictCandidateCount,
    contractRelaxedCandidateCount: diagnostic.contractRelaxedCandidateCount,
    contractSatisfied: diagnostic.contractSatisfied,
    contractRelaxed: diagnostic.contractRelaxed,
    contractFallbackReason: diagnostic.contractFallbackReason,
    bestContractCandidateId: diagnostic.bestContractCandidateId,
    preferredDiscoveryVenueId: diagnostic.preferredDiscoveryVenueId,
    preferredDiscoveryVenueAdmitted: diagnostic.preferredDiscoveryVenueAdmitted,
    preferredDiscoveryVenueRejectedReason: diagnostic.preferredDiscoveryVenueRejectedReason,
    preferredCandidateSurvivedToArc: diagnostic.preferredCandidateSurvivedToArc,
    preferredCandidateDroppedPreAssembly: diagnostic.preferredCandidateDroppedPreAssembly,
    selectedContractOverrideApplied: diagnostic.selectedContractOverrideApplied,
    selectedContractOverrideRole: diagnostic.selectedContractOverrideRole,
    selectedCandidateStillLostReason: diagnostic.selectedCandidateStillLostReason,
    selectedContractSatisfied: diagnostic.selectedContractSatisfied,
    selectedViolatesContract: diagnostic.selectedViolatesContract,
    highlightValidCandidateCount: diagnostic.highlightValidCandidateCount,
    highlightFallbackCandidateCount: diagnostic.highlightFallbackCandidateCount,
    highlightInvalidCandidateCount: diagnostic.highlightInvalidCandidateCount,
    fallbackUsedBecauseNoValidHighlight: diagnostic.fallbackUsedBecauseNoValidHighlight,
    bestValidHighlightCandidateId: diagnostic.bestValidHighlightCandidateId,
    bestValidHighlightChallengerId: diagnostic.bestValidHighlightChallengerId,
    selectedHighlightValidityLevel: diagnostic.selectedHighlightValidityLevel,
    selectedHighlightValidForIntent: diagnostic.selectedHighlightValidForIntent,
    selectedHighlightIsFallback: diagnostic.selectedHighlightIsFallback,
    selectedHighlightViolatesIntent: diagnostic.selectedHighlightViolatesIntent,
    selectedHighlightVetoReason: diagnostic.selectedHighlightVetoReason,
    packLiteralRequirementSatisfied: diagnostic.packLiteralRequirementSatisfied,
  }
}

function summarizeCompactnessDiagnostics(trace: Awaited<ReturnType<typeof runGeneratePlan>>['trace']) {
  const diagnostics = trace.buildCandidatePoolCompactnessDiagnostics
  if (!diagnostics) {
    return undefined
  }
  return {
    fullAssembledCandidateCount: diagnostics.fullAssembledCandidateCount,
    anchorPreservingAssembledCandidateCount: diagnostics.anchorPreservingAssembledCandidateCount,
    preTop40CandidateCount: diagnostics.preTop40CandidateCount,
    postTop40CandidateCount: diagnostics.postTop40CandidateCount,
    rolePoolNearAnchorSupportVisibility: diagnostics.rolePoolNearAnchorSupportVisibility,
  }
}

function summarizeFallbackTrace(trace: Awaited<ReturnType<typeof runGeneratePlan>>['trace']) {
  const fallback = trace.buildFallbackTrace
  if (!fallback) {
    return undefined
  }
  return {
    fullArcCandidatesCount: fallback.fullArcCandidatesCount,
    partialArcCandidatesCount: fallback.partialArcCandidatesCount,
    highlightOnlyCandidatesCount: fallback.highlightOnlyCandidatesCount,
    bestFullArcFound: fallback.bestFullArcFound,
    bestPartialArcFound: fallback.bestPartialArcFound,
    bestHighlightOnlyFound: fallback.bestHighlightOnlyFound,
    usedRecoveredCentralMomentHighlight: fallback.usedRecoveredCentralMomentHighlight,
    recoveredHighlightCandidatesCount: fallback.recoveredHighlightCandidatesCount,
    centralMomentRecoveryReason: fallback.centralMomentRecoveryReason,
    selectedFallbackType: fallback.selectedFallbackType,
    fallbackFailureReason: fallback.fallbackFailureReason,
  }
}

function summarizeFailedStarterRoleStatus(
  diagnostics: Awaited<ReturnType<typeof buildCurateFailedStarterDiagnostics>>,
) {
  const highlight = diagnostics.rolePools.highlight.contractStatus
  return {
    starterId: diagnostics.starterId,
    startCount: diagnostics.rolePools.start.count,
    highlightCount: diagnostics.rolePools.highlight.count,
    windDownCount: diagnostics.rolePools.windDown.count,
    highlightStatus: {
      role: highlight.role,
      contractLabel: highlight.contractLabel,
      contractStrength: highlight.contractStrength,
      contractSatisfied: highlight.contractSatisfied,
      contractRelaxed: highlight.contractRelaxed,
      fallbackReason: highlight.fallbackReason,
      strictCandidateCount: highlight.strictCandidateCount,
      relaxedCandidateCount: highlight.relaxedCandidateCount,
      bestContractCandidateId: highlight.bestContractCandidateId,
      validCandidateCount: highlight.validCandidateCount,
      fallbackCandidateCount: highlight.fallbackCandidateCount,
      invalidCandidateCount: highlight.invalidCandidateCount,
      fallbackUsedBecauseNoValidHighlight: highlight.fallbackUsedBecauseNoValidHighlight,
      bestValidHighlightCandidateId: highlight.bestValidHighlightCandidateId,
      bestValidHighlightChallengerId: highlight.bestValidHighlightChallengerId,
      recoveredCentralMomentHighlight: highlight.recoveredCentralMomentHighlight,
      recoveredHighlightCandidatesCount: highlight.recoveredHighlightCandidatesCount,
      centralMomentRecoveryReason: highlight.centralMomentRecoveryReason,
    },
  }
}

async function main(): Promise<void> {
  const input: IntentInput = {
    mode: 'build',
    planningMode: 'user-led',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    city: 'San Jose',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    anchor: {
      venueId: 'sj-adega-wine-atelier',
      role: 'highlight',
    },
    discoveryPreferences: [
      {
        venueId: 'sj-adega-wine-atelier',
        role: 'highlight',
      },
    ],
  }

  const generated = await runGeneratePlan(input, {
    seedVenues: sanJoseVenues,
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
  })
  const failedStarter = await buildCurateFailedStarterDiagnostics(
    findStarterPack('dessert-conversation'),
  )

  const observed = {
    route: generated.selectedArc.stops.map((stop) => ({
      role: stop.role,
      venueId: stop.scoredVenue.candidateIdentity.baseVenueId,
    })),
    rolePoolDiagnostics: summarizeRolePoolDiagnostics(generated.trace.rolePoolDiagnostics),
    compactnessDiagnostics: summarizeCompactnessDiagnostics(generated.trace),
    fallbackTrace: summarizeFallbackTrace(generated.trace),
    failedStarter: summarizeFailedStarterRoleStatus(failedStarter),
  }

  const expected = {
    route: [
      { role: 'warmup', venueId: 'sj-voyager-coffee' },
      { role: 'peak', venueId: 'sj-adega-wine-atelier' },
      { role: 'wildcard', venueId: 'moment::sofa-jazz-alley-set' },
      { role: 'cooldown', venueId: 'sj-orchard-artisan-gelato' },
    ],
    rolePoolDiagnostics: {
      roles: ['start', 'highlight', 'surprise', 'windDown'],
      start: {
        rolePoolSize: 14,
        strongCandidateCount: 10,
        categoryDiversityCount: 3,
        topConfidenceBand: 'strong',
        weakPool: false,
        selectedVenueId: 'sj-voyager-coffee',
        selectedScore: 91.5,
        runnerUpVenueId: 'sj-sketchbook-supper-club',
        runnerUpScore: 92.7,
        fallbackUsed: false,
        fallbackLabel: 'Strong fit',
        roleContractLabel: 'Resolved romantic start contract',
        roleContractStrength: 'strong',
        contractStrictCandidateCount: 19,
        contractRelaxedCandidateCount: 19,
        contractSatisfied: true,
        contractRelaxed: false,
        bestContractCandidateId: 'sj-little-portugal-pastry-bar',
        selectedContractOverrideApplied: false,
        selectedContractSatisfied: true,
        selectedViolatesContract: false,
      },
      highlight: {
        rolePoolSize: 9,
        strongCandidateCount: 1,
        categoryDiversityCount: 3,
        topConfidenceBand: 'medium',
        weakPool: true,
        weakPoolReason: 'Few strong candidates for this role.',
        selectedVenueId: 'sj-adega-wine-atelier',
        selectedScore: 100,
        runnerUpVenueId: 'sj-petiscos',
        runnerUpScore: 100,
        fallbackUsed: false,
        fallbackLabel: 'Strong fit',
        roleContractLabel: 'Resolved romantic highlight contract',
        roleContractStrength: 'strong',
        contractStrictCandidateCount: 31,
        contractRelaxedCandidateCount: 8,
        contractSatisfied: true,
        contractRelaxed: false,
        bestContractCandidateId: 'sj-petiscos',
        preferredDiscoveryVenueId: 'sj-adega-wine-atelier',
        preferredDiscoveryVenueAdmitted: true,
        preferredCandidateSurvivedToArc: true,
        preferredCandidateDroppedPreAssembly: false,
        selectedContractOverrideApplied: true,
        selectedContractOverrideRole: 'highlight',
        selectedContractSatisfied: true,
        selectedViolatesContract: false,
        highlightValidCandidateCount: 47,
        highlightFallbackCandidateCount: 5,
        highlightInvalidCandidateCount: 9,
        fallbackUsedBecauseNoValidHighlight: false,
        bestValidHighlightCandidateId: 'sj-petiscos',
        bestValidHighlightChallengerId: 'sj-lunas-mexican-kitchen',
        selectedHighlightValidityLevel: 'valid',
        selectedHighlightValidForIntent: true,
        selectedHighlightIsFallback: false,
        selectedHighlightViolatesIntent: false,
        packLiteralRequirementSatisfied: true,
      },
      windDown: {
        rolePoolSize: 16,
        strongCandidateCount: 13,
        categoryDiversityCount: 3,
        topConfidenceBand: 'strong',
        weakPool: false,
        selectedVenueId: 'sj-orchard-artisan-gelato',
        selectedScore: 92.3,
        runnerUpVenueId: 'sj-willow-glen-bakehouse',
        runnerUpScore: 92.5,
        fallbackUsed: false,
        fallbackLabel: 'Strong fit',
        roleContractLabel: 'Resolved romantic wind-down contract',
        roleContractStrength: 'strong',
        contractStrictCandidateCount: 19,
        contractRelaxedCandidateCount: 19,
        contractSatisfied: true,
        contractRelaxed: false,
        bestContractCandidateId: 'sj-little-portugal-pastry-bar',
        selectedContractOverrideApplied: false,
        selectedContractSatisfied: true,
        selectedViolatesContract: false,
      },
    },
    failedStarter: {
      starterId: 'dessert-conversation',
      startCount: 14,
      highlightCount: 14,
      windDownCount: 16,
      highlightStatus: {
        role: 'peak',
        contractLabel: 'Dessert & Conversation highlight contract',
        contractStrength: 'hard',
        contractSatisfied: true,
        contractRelaxed: false,
        fallbackReason: 'Dessert & Conversation highlight contract retained starter-scoped soft highlights.',
        strictCandidateCount: 34,
        relaxedCandidateCount: 34,
        bestContractCandidateId: 'live_google_ChIJW5Ondc_Lj4ARJAwUecl7o3s',
        validCandidateCount: 34,
        fallbackCandidateCount: 19,
        invalidCandidateCount: 7,
        fallbackUsedBecauseNoValidHighlight: false,
        bestValidHighlightCandidateId: 'live_google_ChIJW5Ondc_Lj4ARJAwUecl7o3s',
        bestValidHighlightChallengerId: 'live_google_ChIJ-bROCHLLj4AR7F3uIwQLL3w',
        recoveredCentralMomentHighlight: false,
        recoveredHighlightCandidatesCount: 0,
      },
    },
  }

  assertDeepEqual(observed, expected, 'Role-pool diagnostics parity snapshot')
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write(
    `${JSON.stringify(
      {
        observer: 'role_pool_diagnostics_parity',
        status: 'PASS',
        diagnosticsFieldsCovered: {
          strictRelaxedCounts: true,
          bestCandidateIds: true,
          highlightValidityDiagnostics: true,
          selectedHighlightValidity: true,
          failedStarterDiagnostics: true,
          tightSupportDiagnostics: observed.compactnessDiagnostics !== undefined,
          recoveredCentralMomentTrace: observed.fallbackTrace !== undefined,
          generationTraceRolePoolDiagnosticsShape: true,
        },
        caveats: {
          tightSupportDiagnostics:
            observed.compactnessDiagnostics === undefined
              ? 'not emitted for the representative generated route'
              : 'covered',
          recoveredCentralMomentTrace:
            observed.fallbackTrace === undefined
              ? 'not emitted for the representative generated route'
              : 'covered',
        },
        providerNetworkCounts: { fetchCallCount },
      },
      null,
      2,
    )}\n`,
  )
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    if (originalCorpusFlag === undefined) {
      delete process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
    } else {
      process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = originalCorpusFlag
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
  })
