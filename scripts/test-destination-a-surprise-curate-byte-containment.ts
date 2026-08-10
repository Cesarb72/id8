import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASELINE_COMMIT = 'f4a23fb323997326cf062c33898a108a46fed423'
const SNAPSHOT_SCHEMA_VERSION = 'destination-a-stage0-containment-v2'
const DEFAULT_TARGET_REPO = path.resolve(process.cwd(), '..', 'id8-audit-f4a23fb')
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), '.audit-output-destination-a')

type Args = {
  targetRepo: string
  outputDir: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    targetRepo: DEFAULT_TARGET_REPO,
    outputDir: DEFAULT_OUTPUT_DIR,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--target-repo') {
      args.targetRepo = path.resolve(argv[++index] ?? '')
    } else if (token === '--output-dir') {
      args.outputDir = path.resolve(argv[++index] ?? '')
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }
  return args
}

function runText(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}\n${result.stdout}\n${result.stderr}`,
    )
  }
  return result.stdout.trim()
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

function resolveTsxCliPath(controllerRepo: string): string {
  const candidates = [
    path.join(controllerRepo, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(controllerRepo, '..', '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ].map((entry) => path.resolve(entry))
  const tsxCliPath = candidates.find((candidate) => existsSync(candidate))
  if (!tsxCliPath) {
    throw new Error(`tsx CLI not found. Checked:\n${candidates.join('\n')}`)
  }
  return tsxCliPath
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys)
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortKeys(entry)]),
  )
}

const CREATE_ID_PREFIX_PATTERN =
  '(?:arc|arc_partial|arc_highlight_only|arc_shape_(?:warmup|peak|cooldown|wildcard)|arc_swap_(?:start|highlight|windDown|surprise)|contract_entry|itinerary|arc_curate_hard_commit|arc_contract_artifact_great_stop_candidate|arc_build_selected_contract|arc_fallback)'
const CREATE_ID_PATTERN = new RegExp(`^(${CREATE_ID_PREFIX_PATTERN})_[0-9a-z]{8,10}_[0-9a-z]+$`)
const ROUTE_ID_PATTERN = new RegExp(
  `^((?:${CREATE_ID_PREFIX_PATTERN})_[0-9a-z]{8,10}_[0-9a-z]+|[a-z0-9:_-]+)-[0-9]{13}$`,
)

function normalizeCreateIdString(value: string): string {
  return value.replace(CREATE_ID_PATTERN, '$1_<createIdTimestamp>_<createIdCounter>')
}

function normalizeSnapshotValue(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSnapshotValue(entry))
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      if (key === 'routeId') {
        const routeMatch = value.match(ROUTE_ID_PATTERN)
        if (routeMatch) {
          return `${normalizeCreateIdString(routeMatch[1])}-<routeIdTimestampMs>`
        }
      }
      return normalizeCreateIdString(value)
    }
    return value
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      normalizeSnapshotValue(entry, key),
    ]),
  )
}

function flattenPaths(value: unknown, prefix = '$'): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [prefix]
    }
    const paths = new Set<string>()
    value.forEach((entry) => {
      flattenPaths(entry, `${prefix}[]`).forEach((pathEntry) => paths.add(pathEntry))
    })
    return [...paths].sort()
  }
  if (!value || typeof value !== 'object') {
    return [prefix]
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    flattenPaths(entry, `${prefix}.${key}`),
  )
}

function buildRunnerSource(): string {
  return String.raw`
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const targetRepo = path.resolve(process.argv[2])
const SNAPSHOT_SCHEMA_VERSION = '${SNAPSHOT_SCHEMA_VERSION}'
const importedProductionModules = [
  'src/app/concierge/conciergeIntentAdapter.ts',
  'src/app/services/curate/publicCurateCardTruthService.ts',
  'src/app/services/canonicalPublicRouteTruthService.ts',
  'src/app/services/live/contractEntryLockHandoff.ts',
  'src/app/services/live/liveSessionHandoff.ts',
  'src/app/services/routeAuthority/routeAuthorityService.ts',
  'src/app/wrapper/curateRefinementEntry.ts',
  'src/data/starterPacks.ts',
  'src/data/venues.ts',
  'src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts',
  'src/domain/arc/directionPlanning.ts',
  'src/domain/artifacts/runtimeRouteProjection.ts',
  'src/domain/artifacts/selectedRouteProjection.ts',
  'src/domain/bearings/assessDirectionContractBuildability.ts',
  'src/domain/bearings/buildContractGateWorld.ts',
  'src/domain/bearings/buildStrategyAdmissibleWorlds.ts',
  'src/domain/interpretation/buildCanonicalInterpretationBundle.ts',
  'src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts',
  'src/domain/interpretation/discovery/stopTypeCandidateBoard.ts',
  'src/domain/live/liveArtifactSession.ts',
  'src/domain/live/validateLiveArtifact.ts',
  'src/domain/retrieval/liveEnvelope.ts',
  'src/domain/runGeneratePlan.ts',
]

function moduleUrl(relativePath) {
  return pathToFileURL(path.join(targetRepo, relativePath)).href
}

async function importBaseline(relativePath) {
  return import(moduleUrl(relativePath))
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const fetchCounters = {
  fetchCallCount: 0,
  fieldProxyHits: 0,
  browserProviderHits: 0,
  lceProviderHits: 0,
}
globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  fetchCounters.fetchCallCount += 1
  if (url.includes('/api/field/text-search')) fetchCounters.fieldProxyHits += 1
  if (/googleapis|places\.google|maps\.google|provider|text-search/i.test(url)) {
    fetchCounters.browserProviderHits += 1
  }
  if (/\/api\/lce|lce|keep-the-night|continuation/i.test(url)) fetchCounters.lceProviderHits += 1
  throw new Error('Stage 0 containment harness blocked network/provider call: ' + url)
}

const [
  conciergeAdapter,
  canonicalInterpretationModule,
  contractGateWorldModule,
  strategyWorldModule,
  districtProfilesModule,
  boardModule,
  liveEnvelopeModule,
  surpriseRouteShapeModule,
  directionPlanningModule,
  generatePlanModule,
  bearingsBuildabilityModule,
  runtimeRouteProjectionModule,
  routeAuthorityModule,
  liveHandoffModule,
  liveValidationModule,
  starterPacksModule,
  venuesModule,
  curateTruthModule,
  curateLockTruthModule,
  curatePayloadModule,
  selectedRouteProjectionModule,
  liveSessionModule,
  canonicalPublicTruthModule,
] = await Promise.all([
  importBaseline('src/app/concierge/conciergeIntentAdapter.ts'),
  importBaseline('src/domain/interpretation/buildCanonicalInterpretationBundle.ts'),
  importBaseline('src/domain/bearings/buildContractGateWorld.ts'),
  importBaseline('src/domain/bearings/buildStrategyAdmissibleWorlds.ts'),
  importBaseline('src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'),
  importBaseline('src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'),
  importBaseline('src/domain/retrieval/liveEnvelope.ts'),
  importBaseline('src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'),
  importBaseline('src/domain/arc/directionPlanning.ts'),
  importBaseline('src/domain/runGeneratePlan.ts'),
  importBaseline('src/domain/bearings/assessDirectionContractBuildability.ts'),
  importBaseline('src/domain/artifacts/runtimeRouteProjection.ts'),
  importBaseline('src/app/services/routeAuthority/routeAuthorityService.ts'),
  importBaseline('src/app/services/live/liveSessionHandoff.ts'),
  importBaseline('src/domain/live/validateLiveArtifact.ts'),
  importBaseline('src/data/starterPacks.ts'),
  importBaseline('src/data/venues.ts'),
  importBaseline('src/app/services/curate/publicCurateCardTruthService.ts'),
  importBaseline('src/app/services/live/contractEntryLockHandoff.ts'),
  importBaseline('src/app/wrapper/curateRefinementEntry.ts'),
  importBaseline('src/domain/artifacts/selectedRouteProjection.ts'),
  importBaseline('src/domain/live/liveArtifactSession.ts'),
  importBaseline('src/app/services/canonicalPublicRouteTruthService.ts'),
])

function coreStops(stops) {
  return stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .sort((left, right) => (left.stopIndex ?? 0) - (right.stopIndex ?? 0))
}

function stableRuntimeStop(stop) {
  return {
    id: stop.id,
    sourceStopId: stop.sourceStopId,
    role: stop.role,
    stopIndex: stop.stopIndex,
    venueId: stop.venueId,
    displayName: stop.displayName,
    providerRecordId: stop.providerRecordId ?? null,
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
    address: stop.address ?? null,
    title: stop.title,
    subtitle: stop.subtitle ?? null,
    neighborhood: stop.neighborhood ?? null,
    driveMinutes: stop.driveMinutes ?? null,
  }
}

function stableRuntimeRoute(route) {
  return {
    routeId: route.routeId,
    selectedDirectionId: route.selectedDirectionId,
    location: route.location,
    persona: route.persona,
    vibe: route.vibe,
    activeStopIndex: route.activeStopIndex,
    routeHeadline: route.routeHeadline,
    routeSummary: route.routeSummary,
    stops: route.stops.map(stableRuntimeStop),
    orderedCoreVenueIds: coreStops(route.stops).map((stop) => stop.venueId),
    orderedCoreVenueNames: coreStops(route.stops).map((stop) => stop.displayName),
    orderedCoreRoles: coreStops(route.stops).map((stop) => stop.role),
    mapMarkers: route.mapMarkers.map((marker) => ({
      id: marker.id,
      displayName: marker.displayName,
      role: marker.role,
      stopIndex: marker.stopIndex,
      latitude: marker.latitude,
      longitude: marker.longitude,
    })),
    liveNotices: route.liveNotices,
  }
}

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((entry, index) => entry === right[index])
  )
}

function runtimeRouteIdFamily(routeId) {
  if (typeof routeId !== 'string' || routeId.length === 0) {
    return 'missing'
  }
  const createIdRouteMatch = routeId.match(
    /^(arc|arc_partial|arc_highlight_only|arc_shape_(?:warmup|peak|cooldown|wildcard)|arc_swap_(?:start|highlight|windDown|surprise)|contract_entry|itinerary|arc_curate_hard_commit|arc_contract_artifact_great_stop_candidate|arc_build_selected_contract|arc_fallback)_[0-9a-z]{8,10}_[0-9a-z]+-[0-9]{13}$/,
  )
  if (createIdRouteMatch) {
    return createIdRouteMatch[1]
  }
  const stableRouteMatch = routeId.match(/^([a-z0-9:_-]+)-[0-9]{13}$/)
  return stableRouteMatch?.[1] ?? 'unrecognized'
}

function buildRouteIdentitySemantics(params) {
  const {
    route,
    itinerary,
    artifact,
    routeAuthoritySnapshot,
    lockInput,
    acceptedRouteTruth,
  } = params
  const orderedCoreVenueIds = coreStops(route.stops).map((stop) => stop.venueId)
  const artifactEmbeddedRoute = artifact.enrichment?.runtimeLockEligibility?.runtimeRouteArtifact ?? null
  const acceptedRuntimeRoute = acceptedRouteTruth?.runtimeRouteArtifact ?? null
  const lockedPayloadFinalRoute = acceptedRouteTruth?.lockedPayloadFinalRoute ?? null
  const routeIdTimestampSuffixPresent = /-[0-9]{13}$/.test(route.routeId)
  const routeIdBindsItineraryId =
    typeof itinerary.id === 'string' && route.routeId.startsWith(String(itinerary.id) + '-')
  const lockCanonicalRouteIds = lockInput.diagnostics?.canonicalRouteIds ?? []
  const routeAuthorityCanonicalRouteIdsEqualRuntimeOrderedCoreVenueIds = sameStringArray(
    routeAuthoritySnapshot.canonicalRouteIds,
    orderedCoreVenueIds,
  )
  const lockCanonicalRouteIdsEqualRuntimeOrderedCoreVenueIds = sameStringArray(
    lockCanonicalRouteIds,
    orderedCoreVenueIds,
  )
  const lockCanonicalRouteIdsEqualRouteAuthorityCanonicalRouteIds = sameStringArray(
    lockCanonicalRouteIds,
    routeAuthoritySnapshot.canonicalRouteIds,
  )
  const routeAuthorityValid = routeAuthoritySnapshot.validationStatus === 'valid'
  const lockInputOk = Boolean(lockInput.ok)
  const routeAuthorityInvalid = routeAuthoritySnapshot.validationStatus === 'invalid'
  const authorityValidatedCanonicalRouteBinding = routeAuthorityValid && lockInputOk
  const routeAuthorityReviewAvailable = routeAuthorityValid
  const routeAuthorityLockAvailable = lockInputOk
  const routeAuthorityCanonicalRouteIds = routeAuthoritySnapshot.canonicalRouteIds ?? []
  const routeIdentityMapping =
    routeAuthorityCanonicalRouteIdsEqualRuntimeOrderedCoreVenueIds
      ? 'routeAuthority canonicalRouteIds match RuntimeRouteArtifact ordered core venueIds'
      : 'routeAuthority canonicalRouteIds are the authority/Lock canonical route ids; RuntimeRouteArtifact ordered core venueIds are preserved separately'
  const runtimeAndAuthorityCoreRouteLengthEqual =
    routeAuthorityCanonicalRouteIds.length === orderedCoreVenueIds.length
  const routeAuthoritySelectedArtifactIdEqualsContractEntryArtifactId =
    routeAuthoritySnapshot.selectedArtifactId === artifact.id
  const contractEntryEmbeddedRuntimeRouteIdEqualsRuntimeRouteArtifactRouteId =
    artifactEmbeddedRoute === null ? null : artifactEmbeddedRoute.routeId === route.routeId
  const acceptedRuntimeRouteIdEqualsRuntimeRouteArtifactRouteId =
    acceptedRuntimeRoute === null ? null : acceptedRuntimeRoute.routeId === route.routeId
  const lockedPayloadFinalRouteIdEqualsRuntimeRouteArtifactRouteId =
    lockedPayloadFinalRoute === null ? null : lockedPayloadFinalRoute.routeId === route.routeId
  const reviewAvailableEqualsAuthorityValid = routeAuthorityReviewAvailable === routeAuthorityValid
  const lockAvailableEqualsLockInputOk = routeAuthorityLockAvailable === lockInputOk

  assert(typeof route.routeId === 'string' && route.routeId.length > 0, 'RuntimeRouteArtifact.routeId missing.')
  assert(routeIdTimestampSuffixPresent, 'RuntimeRouteArtifact.routeId timestamp suffix missing.')
  assert(routeIdBindsItineraryId, 'RuntimeRouteArtifact.routeId no longer binds to itinerary.id.')
  assert(
    !lockInput.diagnostics?.canonicalRouteIds ||
      lockCanonicalRouteIdsEqualRouteAuthorityCanonicalRouteIds,
    'Lock canonical route ids diverged from RouteAuthority canonical route ids.',
  )
  assert(
    routeAuthoritySelectedArtifactIdEqualsContractEntryArtifactId,
    'RouteAuthority selected artifact id diverged from ContractEntryArtifact.id.',
  )
  assert(
    contractEntryEmbeddedRuntimeRouteIdEqualsRuntimeRouteArtifactRouteId !== false,
    'ContractEntryArtifact embedded runtime route id diverged from RuntimeRouteArtifact.routeId.',
  )
  assert(
    acceptedRuntimeRouteIdEqualsRuntimeRouteArtifactRouteId !== false,
    'Accepted public runtime route id diverged from RuntimeRouteArtifact.routeId.',
  )
  assert(
    lockedPayloadFinalRouteIdEqualsRuntimeRouteArtifactRouteId !== false,
    'Locked payload final route id diverged from RuntimeRouteArtifact.routeId.',
  )

  return {
    routeIdPresent: true,
    routeId: route.routeId,
    routeIdFamily: runtimeRouteIdFamily(route.routeId),
    routeIdTimestampSuffixPresent,
    routeIdProducerPattern: 'RuntimeRouteProjection.buildFinalRoute: itinerary.id + "-" + Date.now()',
    itineraryId: itinerary.id,
    routeIdBindsItineraryId,
    runtimeOrderedCoreVenueIds: orderedCoreVenueIds,
    routeAuthorityCanonicalRouteIds,
    lockCanonicalRouteIds,
    routeIdentityMapping,
    runtimeAndAuthorityCoreRouteLengthEqual,
    routeAuthorityValid,
    routeAuthorityInvalid,
    lockInputOk,
    authorityValidatedCanonicalRouteBinding,
    routeAuthorityCanonicalRouteIdsEqualRuntimeOrderedCoreVenueIds,
    lockCanonicalRouteIdsEqualRouteAuthorityCanonicalRouteIds,
    routeAuthoritySelectedArtifactIdEqualsContractEntryArtifactId,
    reviewAvailableEqualsAuthorityValid,
    lockAvailableEqualsLockInputOk,
    lockCanonicalRouteIdsEqualRuntimeOrderedCoreVenueIds,
    contractEntryEmbeddedRuntimeRouteIdEqualsRuntimeRouteArtifactRouteId,
    acceptedRuntimeRouteIdEqualsRuntimeRouteArtifactRouteId,
    lockedPayloadFinalRouteIdEqualsRuntimeRouteArtifactRouteId,
    expectedDistinctIdentifiers: {
      runtimeRouteArtifactRouteId: 'RuntimeRouteArtifact.routeId',
      contractEntryArtifactId: 'ContractEntryArtifact.id',
      routeAuthorityCanonicalRouteIds: 'ordered core venue ids, not RuntimeRouteArtifact.routeId',
      reviewAvailability: 'derived from routeAuthority.validationStatus',
      lockAvailability: 'derived from routeAuthority lock input',
    },
  }
}

function stableContractEntryArtifact(artifact) {
  return {
    id: artifact.id,
    sourceOpportunityId: artifact.sourceOpportunityId ?? null,
    sourceMode: artifact.sourceMode ?? null,
    anchorVenueId: artifact.anchorVenueId ?? null,
    anchorRole: artifact.anchorRole ?? null,
    anchorName: artifact.anchorName ?? null,
    routeTitle: artifact.routeTitle ?? null,
    flavorLine: artifact.flavorLine ?? null,
    routeSummary: artifact.routeSummary ?? null,
    traits: artifact.traits ?? [],
    storySpine: artifact.storySpine ?? null,
    districtLine: artifact.districtLine ?? null,
    districtAnchorLine: artifact.districtAnchorLine ?? null,
    authorityLine: artifact.authorityLine ?? null,
    whyChooseLine: artifact.whyChooseLine ?? null,
    whyTonightProofLine: artifact.whyTonightProofLine ?? null,
    selection: artifact.selection ?? null,
    qualification: artifact.qualification
      ? {
          status: artifact.qualification.status ?? null,
          failedCheck: artifact.qualification.failedCheck ?? null,
          missingRoleForContract: artifact.qualification.missingRoleForContract ?? null,
          hardCommitRequired: artifact.qualification.hardCommitRequired ?? null,
          contractBuildabilityStatus: artifact.qualification.contractBuildabilityStatus ?? null,
        }
      : null,
    enrichment: artifact.enrichment
      ? {
          mode: artifact.enrichment.mode ?? null,
          validationStatus: artifact.enrichment.validationStatus ?? null,
          rejectionReasons: artifact.enrichment.rejectionReasons ?? [],
          canonicalRouteRoleCoverage: artifact.enrichment.canonicalRouteRoleCoverage ?? null,
          runtimeLockEligibility: artifact.enrichment.runtimeLockEligibility
            ? {
                eligible: artifact.enrichment.runtimeLockEligibility.eligible ?? null,
                status: artifact.enrichment.runtimeLockEligibility.status ?? null,
                selectedDirectionId: artifact.enrichment.runtimeLockEligibility.selectedDirectionId ?? null,
                rejectionReasons: artifact.enrichment.runtimeLockEligibility.rejectionReasons ?? [],
                canBuildRuntimeRoute:
                  artifact.enrichment.runtimeLockEligibility.buildMetadata?.canBuildRuntimeRoute ?? null,
              }
            : null,
        }
      : null,
  }
}

function stableGreatStop(result) {
  const gate = result.trace.greatStopGateResult
  return gate
    ? {
        status: gate.status,
        failedCriteria: gate.failedCriteria,
        reasons: gate.reasons,
        routeId: gate.routeId,
        requiredAnchor: gate.requiredAnchor ?? null,
        criteria: gate.criteria,
        preset: gate.preset,
        diagnostics: {
          movement: gate.diagnostics.movement,
          clusterCoherence: gate.diagnostics.clusterCoherence,
          zigzagOrBacktrack: gate.diagnostics.zigzagOrBacktrack,
          arcProgression: gate.diagnostics.arcProgression,
          laneVariance: gate.diagnostics.laneVariance,
          strongMoment: gate.diagnostics.strongMoment,
        },
      }
    : null
}

function stableSelectedArc(arc) {
  return {
    id: arc.id,
    totalScore: arc.totalScore,
    stopSignature: arc.stops.map((stop) => ({
      role: stop.role,
      venueId: stop.scoredVenue.venue.id,
      name: stop.scoredVenue.venue.name,
      baseVenueId: stop.scoredVenue.candidateIdentity?.baseVenueId ?? null,
      roleScore: stop.scoredVenue.roleScores[stop.role],
    })),
    scoreBreakdown: {
      roleFlowScore: arc.scoreBreakdown.roleFlowScore,
      diversityScore: arc.scoreBreakdown.diversityScore,
      geographyScore: arc.scoreBreakdown.geographyScore,
      spatialCoherenceScore: arc.scoreBreakdown.spatialCoherenceScore,
      hiddenGemLift: arc.scoreBreakdown.hiddenGemLift,
      windDownScore: arc.scoreBreakdown.windDownScore,
      durationPacingScore: arc.scoreBreakdown.durationPacingScore,
      transitionSmoothnessScore: arc.scoreBreakdown.transitionSmoothnessScore,
      outingLengthScore: arc.scoreBreakdown.outingLengthScore,
      highlightMomentScore: arc.scoreBreakdown.highlightMomentScore,
      momentStrengthScore: arc.scoreBreakdown.momentStrengthScore,
      momentVarianceScore: arc.scoreBreakdown.momentVarianceScore,
      momentFlatPenalty: arc.scoreBreakdown.momentFlatPenalty,
      strongMomentPresent: arc.scoreBreakdown.strongMomentPresent,
      momentQualityNote: arc.scoreBreakdown.momentQualityNote,
      contractComplianceScore: arc.scoreBreakdown.contractComplianceScore,
      contractViolationPenalty: arc.scoreBreakdown.contractViolationPenalty,
      fallbackHighlightPenalty: arc.scoreBreakdown.fallbackHighlightPenalty,
      missedPeakPenalty: arc.scoreBreakdown.missedPeakPenalty,
      expressionReleaseScore: arc.scoreBreakdown.expressionReleaseScore,
      activationMomentElevationScore: arc.scoreBreakdown.activationMomentElevationScore,
      experienceCompositionStamp: arc.scoreBreakdown.experienceCompositionStamp ?? null,
    },
    pacing: {
      totalRouteFriction: arc.pacing.totalRouteFriction,
      estimatedStopMinutes: arc.pacing.estimatedStopMinutes,
      estimatedTransitionMinutes: arc.pacing.estimatedTransitionMinutes,
      estimatedTotalMinutes: arc.pacing.estimatedTotalMinutes,
      estimatedTotalLabel: arc.pacing.estimatedTotalLabel,
      routeFeelLabel: arc.pacing.routeFeelLabel,
      pacingPenaltyApplied: arc.pacing.pacingPenaltyApplied,
      pacingPenaltyReasons: arc.pacing.pacingPenaltyReasons,
      smoothProgressionRewardApplied: arc.pacing.smoothProgressionRewardApplied,
      smoothProgressionRewardReasons: arc.pacing.smoothProgressionRewardReasons,
    },
    spatial: {
      score: arc.spatial.score,
      mode: arc.spatial.mode,
      jumpUsed: arc.spatial.jumpUsed,
      clusterEscapeCount: arc.spatial.clusterEscapeCount,
      repeatedClusterEscapeCount: arc.spatial.repeatedClusterEscapeCount,
      longTransitionCount: arc.spatial.longTransitionCount,
      clustersVisited: arc.spatial.clustersVisited,
    },
  }
}

function stableRouteAuthority(snapshot, lockInput) {
  return {
    snapshot: {
      selectedDirectionId: snapshot.selectedDirectionId,
      selectedArtifactId: snapshot.selectedArtifactId,
      canonicalRouteIds: snapshot.canonicalRouteIds,
      sourceLabel: snapshot.sourceLabel,
      validationStatus: snapshot.validationStatus,
      mismatchReasons: snapshot.mismatchReasons,
      rejectionReasons: snapshot.rejectionReasons,
      observedSources: snapshot.observedSources.map((source) => ({
        kind: source.kind,
        classification: source.classification,
        present: source.present,
        artifactId: source.artifactId ?? null,
        directionId: source.directionId ?? null,
        routeIds: source.routeIds,
        displayNames: source.displayNames,
        mismatchReasons: source.mismatchReasons,
      })),
    },
    review: {
      available: snapshot.validationStatus === 'valid',
    },
    lock: {
      available: lockInput.ok,
      diagnostics: lockInput.diagnostics,
    },
  }
}

function buildCanonicalStopIdentityByRole(itinerary) {
  const canonicalStopByRole = {}
  for (const stop of itinerary.stops) {
    if (stop.role !== 'start' && stop.role !== 'highlight' && stop.role !== 'windDown') {
      continue
    }
    canonicalStopByRole[stop.role] = {
      displayName: stop.venueName,
      providerRecordId: 'provider:' + stop.venueId,
      latitude: stop.latitude ?? 37.33,
      longitude: stop.longitude ?? -121.89,
      addressLine: stop.formattedAddress ?? stop.venueName + ', San Jose, CA',
      city: stop.city,
      neighborhood: stop.neighborhood,
    }
  }
  return canonicalStopByRole
}

function buildRuntimeRoute(result) {
  const selectedDirectionId =
    result.contractEntryArtifact.selection.directionId ??
    result.intentProfile.selectedDirectionContext?.directionId ??
    'surprise-generated-direction'
  const finalRoute = runtimeRouteProjectionModule.buildFinalRoute({
    itinerary: result.itinerary,
    canonicalStopByRole: buildCanonicalStopIdentityByRole(result.itinerary),
    selectedDirectionId,
    city: result.intentProfile.city,
    persona: result.intentProfile.persona,
    vibe: result.intentProfile.primaryAnchor,
    activeRole: 'start',
    mode: 'surprise',
    routeHeadline: result.itinerary.storySpine?.title ?? result.itinerary.title,
    routeSummary: result.itinerary.storySpine?.routeSummary ?? result.itinerary.shareSummary,
  })
  assert(finalRoute, 'Generated Surprise finalRoute must build.')
  return finalRoute
}

function buildSelectedDirectionContext(selectedDirection) {
  return {
    directionId: selectedDirection.id,
    pocketId: selectedDirection.pocketId,
    label: selectedDirection.label,
    archetype: selectedDirection.archetype,
    identity: selectedDirection.identity,
    subtitle: selectedDirection.subtitle,
    family: selectedDirection.experienceFamily,
    familyConfidence: selectedDirection.familyConfidence,
    cluster: selectedDirection.cluster,
    greatStopSignal: selectedDirection.greatStopSignal,
  }
}

async function captureSurprise() {
  const conciergeIntent = conciergeAdapter.buildApplicationConciergeIntent({
    mode: 'surprise',
    persona: 'romantic',
    primaryVibe: 'lively',
    city: 'San Jose',
    objectiveOccasion: 'explore',
  })
  const canonicalInterpretationBundle = canonicalInterpretationModule.buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'stage0.destination-a.containment',
  })
  const districtPreview = await districtProfilesModule.buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = contractGateWorldModule.buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'stage0.destination-a.containment',
  })
  const strategyAdmissibleWorlds = strategyWorldModule.buildStrategyAdmissibleWorlds({ contractGateWorld })
  const canonicalBoard = await boardModule.buildStopTypeCandidateBoardFromContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    contractGateWorld,
    locationQuery: 'San Jose',
    sourceMode: 'curated',
    liveEnvelope: liveEnvelopeModule.CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  const selectedDirection = directionPlanningModule.buildDirectionPlanningSelection({
    id: 'surprise-contract-proof-direction',
    label: 'Surprise contract proof direction',
    pocketId: 'downtown-san-jose',
    pocketLabel: 'Downtown San Jose',
    archetype: 'social',
    cluster: 'lively',
    experienceFamily: 'romantic_lively',
    familyConfidence: 0.9,
    laneIdentity: 'lively_core',
    macroLane: 'lively',
  })
  const selectedDirectionContextForValidation =
    directionPlanningModule.buildResolvedDirectionContext(selectedDirection)
  const routeShapeContract = surpriseRouteShapeModule.buildCanonicalSurpriseC1RouteShapeContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    selectedDirection,
    selectedDirectionContext: selectedDirectionContextForValidation,
  })
  const projectedInput = conciergeAdapter.projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'surprise',
    city: 'San Jose',
    district: selectedDirection.pocketLabel,
    distanceMode: 'nearby',
    selectedDirectionContext: buildSelectedDirectionContext(selectedDirection),
  })
  const result = await generatePlanModule.runGeneratePlan(projectedInput, {
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
    vibeTasteProfileScoring: 'off',
    occasionScoring: 'off',
    whenSpatialScoring: 'off',
    experienceContract: canonicalInterpretationBundle.experienceContract,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    canonicalInterpretationBundle,
    contractGateWorld,
    strategyAdmissibleWorlds,
    routeShapeContract,
  })
  const buildability = bearingsBuildabilityModule.assessDirectionContractBuildability({
    expectedDirectionIdentity: selectedDirectionContextForValidation.identity,
    scoredVenues: result.scoredVenues,
  })
  const directionValidation = directionPlanningModule.validateDirectionRouteContract({
    selectedDirectionContext: selectedDirectionContextForValidation,
    selectedDirection,
    itinerary: result.itinerary,
    buildability,
    mode: 'surprise',
  })
  const finalRoute = buildRuntimeRoute(result)
  const selectedDirectionId =
    result.contractEntryArtifact.selection.directionId ??
    result.intentProfile.selectedDirectionContext?.directionId ??
    finalRoute.selectedDirectionId
  const routeAuthoritySnapshot = routeAuthorityModule.buildRouteAuthoritySnapshot({
    contractEntryArtifact: result.contractEntryArtifact,
    runtimeRouteArtifact: finalRoute,
    selectedDirectionId,
    selectedArtifactId: result.contractEntryArtifact.id,
    selectedClusterConfirmation: 'Surprise generated route is ready for Review.',
    itinerary: result.itinerary,
  })
  const lockInput = routeAuthorityModule.buildLockInputFromRouteAuthoritySnapshot({
    snapshot: routeAuthoritySnapshot,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  assert(routeAuthoritySnapshot.validationStatus === 'valid', 'Surprise route authority must be valid.')
  assert(lockInput.ok, 'Surprise lock input must be available.')
  return {
    mode: 'surprise',
    entryPath: [
      'buildApplicationConciergeIntent',
      'buildCanonicalInterpretationBundle',
      'buildStopTypeCandidateBoardFromContract',
      'buildCanonicalSurpriseC1RouteShapeContract',
      'runGeneratePlan',
      'buildFinalRoute',
      'buildRouteAuthoritySnapshot',
      'buildLockInputFromRouteAuthoritySnapshot',
    ],
    fixture: {
      persona: 'romantic',
      primaryVibe: 'lively',
      city: 'San Jose',
      objectiveOccasion: 'explore',
      selectedDirectionId: selectedDirection.id,
      sourceMode: 'curated',
    },
    selected: {
      selectedDirectionId,
      selectedArtifactId: result.contractEntryArtifact.id,
      selectedArc: stableSelectedArc(result.selectedArc),
      routeIdentity: {
        orderedCoreVenueIds: coreStops(finalRoute.stops).map((stop) => stop.venueId),
        orderedCoreVenueNames: coreStops(finalRoute.stops).map((stop) => stop.displayName),
        orderedCoreRoles: coreStops(finalRoute.stops).map((stop) => stop.role),
      },
    },
    contractEntryArtifact: stableContractEntryArtifact(result.contractEntryArtifact),
    runtimeRouteArtifact: stableRuntimeRoute(finalRoute),
    routeIdentitySemantics: buildRouteIdentitySemantics({
      route: finalRoute,
      itinerary: result.itinerary,
      artifact: result.contractEntryArtifact,
      routeAuthoritySnapshot,
      lockInput,
      acceptedRouteTruth: null,
    }),
    greatStop: stableGreatStop(result),
    routeAuthority: stableRouteAuthority(routeAuthoritySnapshot, lockInput),
    directionValidation: {
      valid: directionValidation.valid,
      validatorMode: directionValidation.validatorMode,
      generationDriftReason: directionValidation.generationDriftReason,
      expectedDirectionIdentity: directionValidation.expectedDirectionIdentity,
      observedDirectionIdentity: directionValidation.observedDirectionIdentity,
      contractBuildabilityStatus: directionValidation.contractBuildabilityStatus,
      fallbackApplied: directionValidation.fallbackApplied,
      thinPoolRelaxationTrace: directionValidation.thinPoolRelaxationTrace ?? null,
    },
    fieldCandidateBoardInputSource: canonicalBoard.debug?.fieldDiscoveryContract?.inputSource ?? null,
  }
}

class MemoryStorage {
  values = new Map()
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, value) }
  removeItem(key) { this.values.delete(key) }
  clear() { this.values.clear() }
}

function findVenue(id) {
  const venue = venuesModule.curatedVenues.find((candidate) => candidate.id === id)
  assert(venue, 'Missing venue fixture: ' + id)
  return venue
}

function findStarterPack(id) {
  const pack = starterPacksModule.starterPacks.find((candidate) => candidate.id === id)
  assert(pack, 'Missing starter pack fixture: ' + id)
  return pack
}

function titleForRole(role) {
  return role === 'start' ? 'Start' : role === 'highlight' ? 'Highlight' : role === 'windDown' ? 'Wind Down' : 'Surprise'
}

function buildCurateStop(venue, role, index) {
  return {
    id: 'stop:' + venue.id,
    role,
    title: titleForRole(role),
    venueId: venue.id,
    venueName: venue.name,
    formattedAddress: venue.source.formattedAddress ?? (100 + index) + ' Local Fixture Way, San Jose, CA',
    latitude: venue.source.latitude ?? 37.33 + index * 0.001,
    longitude: venue.source.longitude ?? -121.89 - index * 0.001,
    city: venue.city,
    category: venue.category,
    subcategory: venue.subcategory,
    priceTier: venue.priceTier,
    tags: venue.tags,
    vibeTags: venue.vibeTags,
    neighborhood: venue.neighborhood,
    driveMinutes: venue.driveMinutes,
    durationClass: venue.durationProfile.durationClass,
    estimatedDurationMinutes: venue.durationProfile.estimatedMinutes,
    estimatedDurationLabel: venue.durationProfile.estimatedMinutes + ' min',
    subtitle: venue.shortDescription,
    imageUrl: venue.imageUrl,
    stopInsider: {
      roleReason: venue.name + ' holds the ' + role + ' role in the deterministic green path.',
      localSignal: venue.narrativeFlavor,
      selectionReason: 'Local fixture regression route.',
    },
  }
}

function buildCurateScoredVenue(venue) {
  return {
    venue,
    candidateIdentity: {
      candidateId: 'candidate:' + venue.id,
      baseVenueId: venue.id,
      kind: 'base',
      traceLabel: venue.name,
    },
  }
}

function buildWillowCourtItinerary() {
  const stops = [
    buildCurateStop(findVenue('sj-willow-court-wine-bar'), 'start', 0),
    buildCurateStop(findVenue('sj-willow-glen-tea-atelier'), 'surprise', 1),
    buildCurateStop(findVenue('sj-theatre-district-jazz-cellar'), 'highlight', 2),
    buildCurateStop(findVenue('sj-bramhall-park-promenade'), 'surprise', 3),
    buildCurateStop(findVenue('sj-hedley-club-lounge'), 'windDown', 4),
  ]
  return {
    id: 'itinerary:curate-green-path:willow-court',
    title: 'Willow Court to Jazz Cellar',
    city: 'San Jose',
    neighborhood: 'Willow Glen / Downtown',
    crew: 'romantic',
    vibes: ['cozy', 'cultured'],
    stops,
    transitions: [],
    totalRouteFriction: 0.16,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'Intimate, local, and music-led',
    story: {
      headline: 'Willow Court to Jazz Cellar',
      subtitle: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    },
    shareSummary: 'Start at Willow Court Wine Bar, peak at Theatre District Jazz Cellar, then wind down at Hedley Club Lounge.',
  }
}

function buildCurateArtifact(runtimeRouteArtifact, approvedPayload) {
  return {
    id: 'contract-entry:curate-green-path:willow-court',
    sourceOpportunityId: 'opportunity:curate-green-path:willow-court',
    sourceMode: 'curated',
    anchorVenueId: 'sj-theatre-district-jazz-cellar',
    anchorRole: 'highlight',
    anchorName: 'Theatre District Jazz Cellar',
    routeTitle: 'Willow Court to Jazz Cellar',
    flavorLine: 'Wine-bar warmup, intimate jazz peak, polished lounge cooldown.',
    routeSummary: 'A deterministic three-stop Curate route from Willow Court Wine Bar to Theatre District Jazz Cellar and Hedley Club Lounge.',
    traits: ['intimate', 'local', 'music-led'],
    storySpine: {
      start: 'Willow Court Wine Bar',
      highlight: 'Theatre District Jazz Cellar',
      windDown: 'Hedley Club Lounge',
    },
    districtLine: 'Willow Glen into Downtown San Jose',
    districtAnchorLine: 'District anchor: Theatre District Jazz Cellar',
    authorityLine: 'Approved local Curate green path.',
    whyChooseLine: 'The route keeps the proven warmup, peak, and cooldown identities intact.',
    whyTonightProofLine: 'Local-only regression fixture; no live provider required.',
    selection: {
      directionId: 'curate:green-path:willow-court',
      pocketId: 'willow-court-jazz-cellar',
    },
    qualification: {
      status: approvedPayload ? 'committable' : 'checking',
      failedCheck: null,
      missingRoleForContract: null,
      hardCommitRequired: true,
      ...(approvedPayload ? { approvedRefinementEntryPayload: approvedPayload } : {}),
    },
    enrichment: {
      mode: 'curate',
      locationContext: { city: 'San Jose', neighborhood: 'Willow Glen / Downtown' },
      userInputContext: {
        starterPackId: 'cozy-jazz-night',
        primaryVibe: 'cozy',
        secondaryVibe: 'cultured',
        persona: 'romantic',
        anchorVenueId: 'sj-theatre-district-jazz-cellar',
        anchorName: 'Theatre District Jazz Cellar',
      },
      conciergeIntentSummary: {
        planningMode: 'curated',
        primaryVibe: 'cozy',
        persona: 'romantic',
        summary: 'Curate green-path regression for the Willow Court route.',
      },
      tasteDistrictSummary: {
        tasteProfileId: 'cozy-jazz-night',
        districtId: 'willow-court-jazz-cellar',
        districtLabel: 'Willow Glen / Downtown',
        summary: 'Wine, jazz, and lounge sequencing.',
      },
      fieldProvenanceSummary: {
        sourceMode: 'curated',
        provider: 'static-corpus',
        liveProviderUsed: false,
        corpusUsed: true,
        calibrationOnly: false,
        candidateCount: 5,
        queryLabels: [],
        provenanceId: 'local-curated-fixture',
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: 'bearings:curate-green-path:willow-court',
        summary: 'Canonical warmup, peak, and cooldown roles are represented.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'waypoint:curate-green-path:willow-court',
        summary: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge.',
      },
      validationStatus: 'valid',
      rejectionReasons: [],
      canonicalRouteRoleCoverage: {
        start: 'Willow Court Wine Bar',
        highlight: 'Theatre District Jazz Cellar',
        windDown: 'Hedley Club Lounge',
        support: [
          { role: 'surprise', name: 'Willow Glen Tea Atelier', venueId: 'sj-willow-glen-tea-atelier' },
          { role: 'surprise', name: 'Bramhall Park Promenade', venueId: 'sj-bramhall-park-promenade' },
        ],
      },
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        selectedDirectionId: 'curate:green-path:willow-court',
        rejectionReasons: [],
        ...(runtimeRouteArtifact ? { runtimeRouteArtifact } : {}),
        buildMetadata: { canBuildRuntimeRoute: true },
      },
      starterContextFit: {
        status: 'passed',
        starterPackId: 'cozy-jazz-night',
        mode: 'curate',
        contextKey: 'cozy-jazz-night:willow-court-jazz-cellar',
        rejectionReasons: [],
      },
      modeContextFit: {
        status: 'passed',
        mode: 'curate',
        contextKey: 'mode:curate',
        rejectionReasons: [],
      },
    },
  }
}

async function captureCurate() {
  const originalWindow = globalThis.window
  globalThis.window = {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    location: { pathname: '/local-curate-green-path-regression', search: '' },
  }
  try {
    const starterPack = findStarterPack('cozy-jazz-night')
    const itinerary = buildWillowCourtItinerary()
    const scoredVenues = itinerary.stops.map((stop) => buildCurateScoredVenue(findVenue(stop.venueId)))
    const preLockArtifact = buildCurateArtifact()
    const lockTruth = curateLockTruthModule.buildContractEntryRuntimeRouteLockTruth({
      artifact: preLockArtifact,
      itinerary,
      scoredVenues,
      selectedDirectionId: 'curate:green-path:willow-court',
      selectedClusterConfirmation: 'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
      city: 'San Jose',
      persona: 'romantic',
      vibe: 'cozy',
      mode: 'curate',
    })
    assert(
      lockTruth.ok,
      'Curate lock truth must produce RuntimeRouteArtifact: ' + (lockTruth.reason ?? 'unknown'),
    )
    const approvedPayload = {
      starterPackId: 'cozy-jazz-night',
      ...curatePayloadModule.buildCurateRefinementEntryPayload({
        artifactId: 'contract-entry:curate-green-path:willow-court',
        selectedDirectionId: 'curate:green-path:willow-court',
        selectedArtifactLineageSummary: 'ContractEntryArtifact -> RuntimeRouteArtifact',
        previewRouteTitle: 'Willow Court to Jazz Cellar',
        planSnapshot: {
          source: 'local-deterministic-fixture',
          routeIds: [
            'sj-willow-court-wine-bar',
            'sj-theatre-district-jazz-cellar',
            'sj-hedley-club-lounge',
          ],
        },
        finalRoute: lockTruth.finalRoute,
        canonicalStopByRole: {
          start: 'sj-willow-court-wine-bar',
          highlight: 'sj-theatre-district-jazz-cellar',
          windDown: 'sj-hedley-club-lounge',
        },
        rejectedStopRoles: [],
      }),
    }
    const artifact = buildCurateArtifact(lockTruth.finalRoute, approvedPayload)
    const publicFlowTruth = canonicalPublicTruthModule.buildCanonicalPublicRouteFlowTruth(artifact, {
      mode: 'curate',
      starterPack,
    })
    const approvedPayloadTruth = curateTruthModule.validatePublicCurateApprovedPayloadTruth({
      selectedStarterPack: starterPack,
      artifact,
      approvedRefinementEntryPayload: approvedPayload,
    })
    const cardTruth = curateTruthModule.buildPublicCurateCardTruthModel({
      selectedStarterPack: starterPack,
      artifactCandidates: [artifact],
      selectedArtifactId: artifact.id,
      qualificationByArtifactId: {
        [artifact.id]: {
          status: 'committable',
          hasApprovedPayload: true,
          approvedRefinementEntryPayload: approvedPayload,
        },
      },
      committedRouteFallbackRenderEnabled: false,
    })
    const lockedPayload = liveHandoffModule.buildLockedLiveArtifactPayload({
      canonicalRouteArtifact: {
        selectedClusterConfirmation: lockTruth.selectedClusterConfirmation,
        itinerary: lockTruth.itinerary,
        finalRoute: lockTruth.finalRoute,
      },
      lockSafeItineraryStops: lockTruth.lockSafeItineraryStops,
      activeRole: 'start',
      fallbackCity: 'San Jose',
      lockedAt: 1787000000000,
      sessionId: 'curate-green-path-willow-court',
    })
    const payloadValidation = liveValidationModule.validateLockedLiveArtifactSessionPayload(lockedPayload)
    assert(publicFlowTruth.allowed, 'Curate public flow truth must be allowed.')
    assert(approvedPayloadTruth.allowedToRender, 'Curate approved payload must render.')
    assert(cardTruth.selectedCard?.allowedToRender === true, 'Curate selected card must render.')
    assert(cardTruth.reviewModel?.allowedToRender === true, 'Curate Review must render.')
    assert(cardTruth.lockLiveModel?.allowedToRender === true, 'Curate Lock must render.')
    assert(payloadValidation.ok, 'Curate locked payload must validate.')
    liveSessionModule.saveSharedLiveArtifactPlan('curate-green-path-willow-court', lockedPayload)
    const reopenedPlan = liveSessionModule.loadSharedLiveArtifactPlan('curate-green-path-willow-court')
    const preview = selectedRouteProjectionModule.buildPreviewFromFinalRoute(reopenedPlan.finalRoute)
    const routeAuthoritySnapshot = routeAuthorityModule.buildRouteAuthoritySnapshot({
      contractEntryArtifact: artifact,
      runtimeRouteArtifact: lockTruth.finalRoute,
      selectedDirectionId: 'curate:green-path:willow-court',
      selectedArtifactId: artifact.id,
      selectedClusterConfirmation: lockTruth.selectedClusterConfirmation,
      itinerary,
    })
    const lockInput = routeAuthorityModule.buildLockInputFromRouteAuthoritySnapshot({
      snapshot: routeAuthoritySnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    return {
      mode: 'curate',
      entryPath: [
        'buildContractEntryRuntimeRouteLockTruth',
        'buildCurateRefinementEntryPayload',
        'buildCanonicalPublicRouteFlowTruth',
        'validatePublicCurateApprovedPayloadTruth',
        'buildPublicCurateCardTruthModel',
        'buildLockedLiveArtifactPayload',
        'buildPreviewFromFinalRoute',
        'buildRouteAuthoritySnapshot',
        'buildLockInputFromRouteAuthoritySnapshot',
      ],
      fixture: {
        starterPackId: 'cozy-jazz-night',
        selectedDirectionId: 'curate:green-path:willow-court',
        artifactId: 'contract-entry:curate-green-path:willow-court',
        planSnapshotSource: 'local-deterministic-fixture',
      },
      selected: {
        selectedDirectionId: 'curate:green-path:willow-court',
        selectedArtifactId: artifact.id,
        routeIdentity: {
          orderedCoreVenueIds: coreStops(lockTruth.finalRoute.stops).map((stop) => stop.venueId),
          orderedCoreVenueNames: coreStops(lockTruth.finalRoute.stops).map((stop) => stop.displayName),
          orderedCoreRoles: coreStops(lockTruth.finalRoute.stops).map((stop) => stop.role),
        },
      },
      contractEntryArtifact: stableContractEntryArtifact(artifact),
      runtimeRouteArtifact: stableRuntimeRoute(lockTruth.finalRoute),
      routeIdentitySemantics: buildRouteIdentitySemantics({
        route: lockTruth.finalRoute,
        itinerary,
        artifact,
        routeAuthoritySnapshot,
        lockInput,
        acceptedRouteTruth: {
          runtimeRouteArtifact: publicFlowTruth.lock?.runtimeRouteArtifact ?? null,
          lockedPayloadFinalRoute: lockedPayload.finalRoute ?? null,
        },
      }),
      greatStop: null,
      routeAuthority: stableRouteAuthority(routeAuthoritySnapshot, lockInput),
      publicFlowTruth: {
        allowed: publicFlowTruth.allowed,
        visibleCardAllowed: publicFlowTruth.visibleCard?.allowedToRender ?? null,
        reviewAvailable: publicFlowTruth.review !== null,
        lockRuntimeRoutePresent: Boolean(publicFlowTruth.lock?.runtimeRouteArtifact),
        plansArtifactId: publicFlowTruth.plans?.artifactId ?? null,
      },
      cardTruth: {
        selectedCardAllowed: cardTruth.selectedCard?.allowedToRender ?? null,
        reviewAllowed: cardTruth.reviewModel?.allowedToRender ?? null,
        lockAllowed: cardTruth.lockLiveModel?.allowedToRender ?? null,
        plansAllowed: cardTruth.plansHubPayload?.allowedToRender ?? null,
      },
      lockPayload: {
        validationOk: payloadValidation.ok,
        itineraryStopCount: lockedPayload.itinerary.stops.length,
        finalRoutePresent: Boolean(lockedPayload.finalRoute),
        previewDirectionId: preview.directionId,
      },
    }
  } finally {
    globalThis.window = originalWindow
  }
}

const snapshot = {
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  sourceIsolation: {
    targetRepo,
    subprocessCwd: process.cwd(),
    importedProductionModules,
    importSpecifiers: importedProductionModules.map(moduleUrl),
    controllerProductionImports: [],
  },
  surprise: await captureSurprise(),
  curate: await captureCurate(),
  providerCounters: { ...fetchCounters },
}

assert(fetchCounters.fetchCallCount === 0, 'Expected zero fetch calls.')
assert(fetchCounters.fieldProxyHits === 0, 'Expected zero Field proxy calls.')
assert(fetchCounters.browserProviderHits === 0, 'Expected zero provider calls.')
assert(fetchCounters.lceProviderHits === 0, 'Expected zero LCE calls.')

process.stdout.write(JSON.stringify(snapshot))
`
}

async function writeRunner(outputDir: string): Promise<string> {
  const runnerPath = path.join(outputDir, 'stage0-baseline-runner.mjs')
  await writeFile(runnerPath, buildRunnerSource(), 'utf8')
  return runnerPath
}

function runSnapshot(params: {
  targetRepo: string
  runnerPath: string
  tsxCliPath: string
  label: string
}): unknown {
  const result = spawnSync(process.execPath, [params.tsxCliPath, params.runnerPath, params.targetRepo], {
    cwd: params.targetRepo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ID8_STAGE0_TARGET_REPO: params.targetRepo,
      ID8_STAGE0_RUN_LABEL: params.label,
    },
  })
  if (result.status !== 0) {
    throw new Error(
      `Stage 0 baseline snapshot ${params.label} failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    )
  }
  return JSON.parse(result.stdout) as unknown
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const controllerRepo = process.cwd()
  const controllerHead = runText('git', ['rev-parse', 'HEAD'], controllerRepo)
  const targetHead = runText('git', ['rev-parse', 'HEAD'], args.targetRepo)
  const targetStatus = runText('git', ['status', '--short'], args.targetRepo)
  if (targetHead !== BASELINE_COMMIT) {
    throw new Error(`Target repo HEAD mismatch. Expected ${BASELINE_COMMIT}, received ${targetHead}.`)
  }
  if (targetStatus.length > 0) {
    throw new Error(`Target repo is not clean:\n${targetStatus}`)
  }

  const tsxCliPath = resolveTsxCliPath(controllerRepo)

  await mkdir(args.outputDir, { recursive: true })
  const runnerPath = await writeRunner(args.outputDir)

  const rawRun1 = runSnapshot({
    targetRepo: args.targetRepo,
    runnerPath,
    tsxCliPath,
    label: 'run1',
  })
  const rawRun2 = runSnapshot({
    targetRepo: args.targetRepo,
    runnerPath,
    tsxCliPath,
    label: 'run2',
  })
  const normalizedRun1 = normalizeSnapshotValue(rawRun1)
  const normalizedRun2 = normalizeSnapshotValue(rawRun2)
  const normalizedRun1Bytes = stableStringify(normalizedRun1)
  const normalizedRun2Bytes = stableStringify(normalizedRun2)
  const run1Hash = sha256(normalizedRun1Bytes)
  const run2Hash = sha256(normalizedRun2Bytes)
  const deterministic = normalizedRun1Bytes === normalizedRun2Bytes
  if (!deterministic) {
    await writeFile(path.join(args.outputDir, 'run1.normalized.json'), normalizedRun1Bytes, 'utf8')
    await writeFile(path.join(args.outputDir, 'run2.normalized.json'), normalizedRun2Bytes, 'utf8')
    throw new Error(
      `STOP — CONTAINMENT BASELINE IS NOT DETERMINISTIC\nrun1=${run1Hash}\nrun2=${run2Hash}`,
    )
  }

  const report = {
    classification: 'PASS — DESTINATION A STAGE 0 CONTROL COMPLETE AND READY FOR PROOF-ONLY COMMIT',
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    baseline: {
      path: args.targetRepo,
      head: targetHead,
      statusShort: targetStatus,
    },
    controller: {
      path: controllerRepo,
      head: controllerHead,
      script: path.relative(controllerRepo, process.argv[1] ?? ''),
      tsxCliPath,
    },
    sourceIsolation: {
      subprocessCwd: args.targetRepo,
      runnerPath,
      targetRepoArgument: args.targetRepo,
      productionImportsAreAbsoluteTargetFileUrls: true,
      controllerProductionImports: [],
      baselinePackageResolution: {
        tsxCliPath,
        childProcessCwd: args.targetRepo,
        note: 'The controller supplies the tsx executable; every production import in the runner is an absolute file URL rooted at the target repo.',
      },
    },
    normalization: {
      createIdFormat: '${prefix}_${Date.now().toString(36)}_${runningId.toString(36)}',
      matchingRule: CREATE_ID_PATTERN.source,
      routeIdFormat:
        'RuntimeRouteArtifact.routeId is produced by buildFinalRoute as `${itinerary.id}-${Date.now()}`.',
      routeIdMatchingRule: ROUTE_ID_PATTERN.source,
      beforeAfterExamples: [
        {
          before: 'arc_mabcd123_1',
          after: 'arc_<createIdTimestamp>_<createIdCounter>',
        },
        {
          before: 'contract_entry_mabcd123_2',
          after: 'contract_entry_<createIdTimestamp>_<createIdCounter>',
        },
        {
          before: 'itinerary_mabcd123_3-1787000000000',
          after: 'itinerary_<createIdTimestamp>_<createIdCounter>-<routeIdTimestampMs>',
        },
      ],
      appliesTo: [
        'surprise.selected.selectedArc.id',
        'surprise.contractEntryArtifact.id',
        'surprise.runtimeRouteArtifact.routeId',
        'surprise.routeIdentitySemantics.routeId',
        'surprise.routeIdentitySemantics.itineraryId',
        'surprise.runtimeRouteArtifact.stops[].id when sourced from createId-derived itinerary stops',
        'surprise.runtimeRouteArtifact.mapMarkers[].id when sourced from createId-derived itinerary stops',
        'curate.runtimeRouteArtifact.routeId timestamp suffix only',
        'curate.routeIdentitySemantics.routeId timestamp suffix only',
      ],
      excludedVolatileDateNowFields: ['RuntimeRouteArtifact.updatedAt'],
      routeIdentitySemantics:
        'routeId presence, family, itinerary binding, routeAuthority canonical route ids, Review availability, Lock availability, and downstream accepted-route bindings are serialized under *.routeIdentitySemantics.',
    },
    relaxationTraceFinding: {
      classification: 'PROVEN OPTIONAL',
      typeEvidence:
        'src/domain/arc/directionPlanning.ts DirectionContractValidationResult declares thinPoolRelaxationTrace?: {...}.',
      producerEvidence:
        'validateDirectionRouteContract currently emits thinPoolRelaxationTrace on sufficient/no-fallback success paths, including validationOutcome accepted_without_relaxation.',
      laterSelectorPredicate:
        "thinPoolRelaxationTrace == null || thinPoolRelaxationTrace.validationOutcome === 'accepted_without_relaxation'",
      independentRequiredRejections: [
        "contractBuildabilityStatus !== 'sufficient'",
        'missingRoleForContract !== null',
        'fallbackApplied === true',
        'generationDriftReason !== null',
        'thin routes',
        'SOFT_FEASIBLE routes',
      ],
    },
    executionFooter: {
      deterministicLocalBaselineGenerationExecuted: true,
      liveProviderGenerationExecuted: false,
      fetchProviderNetworkCalls: 0,
      productionFilesChanged: false,
    },
    runHashes: {
      run1: run1Hash,
      run2: run2Hash,
    },
    outputFiles: {
      baselineSnapshot: path.join(args.outputDir, 'baseline.normalized.json'),
      run1Snapshot: path.join(args.outputDir, 'run1.normalized.json'),
      run2Snapshot: path.join(args.outputDir, 'run2.normalized.json'),
      schemaFields: path.join(args.outputDir, 'snapshot-fields.txt'),
      report: path.join(args.outputDir, 'stage0-report.json'),
      commands: path.join(args.outputDir, 'commands.txt'),
    },
  }

  await writeFile(path.join(args.outputDir, 'baseline.normalized.json'), normalizedRun1Bytes, 'utf8')
  await writeFile(path.join(args.outputDir, 'run1.normalized.json'), normalizedRun1Bytes, 'utf8')
  await writeFile(path.join(args.outputDir, 'run2.normalized.json'), normalizedRun2Bytes, 'utf8')
  await writeFile(
    path.join(args.outputDir, 'snapshot-fields.txt'),
    `${flattenPaths(normalizedRun1).join('\n')}\n`,
    'utf8',
  )
  await writeFile(path.join(args.outputDir, 'stage0-report.json'), stableStringify(report), 'utf8')
  await writeFile(
    path.join(args.outputDir, 'commands.txt'),
    [
      `npx tsx scripts/test-destination-a-surprise-curate-byte-containment.ts --target-repo "${args.targetRepo}" --output-dir "${args.outputDir}"`,
      `git -C "${args.targetRepo}" rev-parse HEAD`,
      `git -C "${args.targetRepo}" status --short`,
      '',
    ].join('\n'),
    'utf8',
  )

  process.stdout.write(`${stableStringify(report)}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
