import { createId } from '../../lib/ids'
import {
  isBuildAnchorCanonicalRole,
  type BuildAnchorCanonicalRole,
} from './buildAnchorTruthContract'
import type {
  ContractEntryArtifact,
  ContractEntryArtifactCanonicalRouteRoleCoverage,
  ContractEntryArtifactEnrichment,
  ContractEntryArtifactLineage,
  ContractEntryArtifactMode,
  ContractEntryArtifactValidationStatus,
} from './contractEntryArtifact'
import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type { GenerationDiagnostics } from '../types/diagnostics'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../types/itinerary'
import type { EngineSourceMode, SourceMode } from '../types/sourceMode'
import type { StarterPack } from '../types/starterPack'

export interface BuildContractEntryArtifactFromGenerationInput {
  itinerary: Itinerary
  selectedArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  intentProfile: IntentProfile
  lens: ExperienceLens
  diagnostics: GenerationDiagnostics
  rankingEngine: string
  starterPack?: StarterPack
  selectedArtifactLineage?: ContractEntryArtifactLineage
}

const SUPPORTED_MODES: ContractEntryArtifactMode[] = ['curate', 'surprise', 'build']

function mapSourceModeToEngineSourceMode(sourceMode: SourceMode): EngineSourceMode {
  return sourceMode === 'live' ? 'live' : 'curated'
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function getRoleStop(itinerary: Itinerary, role: UserStopRole): ItineraryStop | undefined {
  return itinerary.stops.find((stop) => stop.role === role)
}

function resolveGeneratedAnchor(params: {
  itinerary: Itinerary
  intentProfile: IntentProfile
  selectedArtifactLineage?: ContractEntryArtifactLineage
}): {
  anchorVenueId: string
  anchorRole?: BuildAnchorCanonicalRole
  anchorName: string
} {
  const { itinerary, intentProfile, selectedArtifactLineage } = params
  const buildAnchorRole =
    intentProfile.mode === 'build' && isBuildAnchorCanonicalRole(intentProfile.anchor?.role)
      ? intentProfile.anchor.role
      : undefined
  const buildAnchorStop =
    buildAnchorRole && intentProfile.anchor?.venueId
      ? getRoleStop(itinerary, buildAnchorRole)
      : undefined
  if (
    buildAnchorRole &&
    intentProfile.anchor?.venueId &&
    buildAnchorStop?.venueId === intentProfile.anchor.venueId
  ) {
    return {
      anchorVenueId: intentProfile.anchor.venueId,
      anchorRole: buildAnchorRole,
      anchorName: buildAnchorStop.venueName,
    }
  }

  const highlight = getRoleStop(itinerary, 'highlight') ?? itinerary.stops[0]
  return {
    anchorVenueId: highlight?.venueId ?? selectedArtifactLineage?.anchorVenueId ?? 'unknown-anchor',
    anchorRole: highlight ? 'highlight' : selectedArtifactLineage?.anchorRole,
    anchorName: highlight?.venueName ?? 'Unknown highlight',
  }
}

function buildRoleCoverage(itinerary: Itinerary): ContractEntryArtifactCanonicalRouteRoleCoverage {
  const start = getRoleStop(itinerary, 'start')
  const highlight = getRoleStop(itinerary, 'highlight')
  const windDown = getRoleStop(itinerary, 'windDown')
  const support = itinerary.stops
    .filter((stop) => stop.role !== 'start' && stop.role !== 'highlight' && stop.role !== 'windDown')
    .map((stop) => ({
      role: stop.role,
      name: stop.venueName,
      venueId: stop.venueId,
    }))

  return {
    ...(start ? { start: start.venueName } : {}),
    ...(highlight ? { highlight: highlight.venueName } : {}),
    ...(windDown ? { windDown: windDown.venueName } : {}),
    ...(support.length > 0 ? { support } : {}),
  }
}

function buildStorySpine(itinerary: Itinerary): ContractEntryArtifact['storySpine'] {
  const roleCoverage = buildRoleCoverage(itinerary)
  return {
    start: roleCoverage.start ?? 'Missing start',
    highlight: roleCoverage.highlight ?? 'Missing highlight',
    windDown: roleCoverage.windDown ?? 'Missing wind-down',
  }
}

function buildMissingRoleReasons(roleCoverage: ContractEntryArtifactCanonicalRouteRoleCoverage): string[] {
  return [
    roleCoverage.start ? null : 'missing_start_role',
    roleCoverage.highlight ? null : 'missing_highlight_role',
    roleCoverage.windDown ? null : 'missing_wind_down_role',
  ].filter((reason): reason is string => Boolean(reason))
}

function buildModeContextFit(mode: IntentProfile['mode']): ContractEntryArtifactEnrichment['modeContextFit'] {
  if (SUPPORTED_MODES.includes(mode)) {
    return {
      status: 'passed',
      mode,
      contextKey: `mode:${mode}`,
      rejectionReasons: [],
    }
  }

  return {
    status: 'rejected',
    contextKey: `mode:${String(mode)}`,
    rejectionReasons: ['unsupported_generation_mode'],
  }
}

function buildStarterContextFit(params: {
  mode: ContractEntryArtifactMode
  starterPack?: StarterPack
  city: string
  primaryVibe: string
}): ContractEntryArtifactEnrichment['starterContextFit'] {
  const { mode, starterPack, city, primaryVibe } = params
  if (!starterPack) {
    return {
      status: 'not_run',
      mode,
      contextKey: `no-starter:${mode}:${city}:${primaryVibe}`,
      rejectionReasons: [],
    }
  }

  return {
    status: 'passed',
    starterPackId: starterPack.id,
    mode,
    contextKey: `${starterPack.id}:${mode}:${city}:${primaryVibe}`,
    rejectionReasons: [],
  }
}

function buildBearingsAdmissionProof(
  diagnostics: GenerationDiagnostics,
): ContractEntryArtifactEnrichment['bearingsAdmissionProof'] {
  const runtimeHours = diagnostics.retrievalDiagnostics.bearingsRuntimeHours
  if (diagnostics.bearingsIngress?.supplied) {
    return {
      status: 'present',
      proofId: diagnostics.selectedDistrictId,
      summary: diagnostics.bearingsIngress.gateSummary,
      rejectionReasons: [],
    }
  }
  if (runtimeHours) {
    return {
      status: 'present',
      proofId: 'bearings-runtime-hours',
      summary: `${runtimeHours.requiredVenueCount} venues carried runtime-hours proof requirements.`,
      rejectionReasons: [],
    }
  }
  return {
    status: 'not_run',
    summary: 'No external bearings proof was supplied for this dry generation pass.',
    rejectionReasons: [],
  }
}

function buildFieldProvenanceSummary(params: {
  diagnostics: GenerationDiagnostics
  scoredVenues: ScoredVenue[]
}): ContractEntryArtifactEnrichment['fieldProvenanceSummary'] {
  const { diagnostics, scoredVenues } = params
  const liveSource = diagnostics.retrievalDiagnostics.liveSource
  const sourceMode = mapSourceModeToEngineSourceMode(liveSource.effectiveMode)
  return {
    sourceMode,
    provider: liveSource.provider ?? 'static-corpus',
    liveProviderUsed: liveSource.liveFetchAttempted && liveSource.liveFetchSucceeded,
    corpusUsed: liveSource.countsBySource.curated > 0,
    calibrationOnly: !liveSource.liveFetchAttempted,
    candidateCount: scoredVenues.length,
    queryLabels: [...liveSource.liveQueryLabelsUsed],
    provenanceId: `${liveSource.effectiveMode}:${diagnostics.selectedArcId}`,
  }
}

function buildConciergeIntentSummary(
  intentProfile: IntentProfile,
): ContractEntryArtifactEnrichment['conciergeIntentSummary'] {
  return {
    planningMode: intentProfile.planningMode,
    primaryVibe: intentProfile.primaryAnchor,
    persona: intentProfile.persona ?? undefined,
    summary: `${intentProfile.mode} ${intentProfile.primaryAnchor} route for ${intentProfile.city}.`,
  }
}

function buildTasteDistrictSummary(params: {
  intentProfile: IntentProfile
  diagnostics: GenerationDiagnostics
}): ContractEntryArtifactEnrichment['tasteDistrictSummary'] {
  const { intentProfile, diagnostics } = params
  return {
    tasteProfileId: `${intentProfile.primaryAnchor}:${intentProfile.persona ?? intentProfile.crew}`,
    districtId: diagnostics.selectedDistrictId,
    districtLabel: diagnostics.selectedDistrictLabel,
    pocketId: intentProfile.selectedDirectionContext?.pocketId ?? diagnostics.selectedDistrictId,
    summary: diagnostics.selectedDistrictReason,
  }
}

export function buildContractEntryArtifactFromGeneration(
  input: BuildContractEntryArtifactFromGenerationInput,
): ContractEntryArtifact {
  const {
    itinerary,
    selectedArc,
    scoredVenues,
    intentProfile,
    lens,
    diagnostics,
    rankingEngine,
    starterPack,
    selectedArtifactLineage,
  } = input
  const roleCoverage = buildRoleCoverage(itinerary)
  const missingRoleReasons = buildMissingRoleReasons(roleCoverage)
  const validationStatus: ContractEntryArtifactValidationStatus =
    missingRoleReasons.length > 0 ? 'incomplete' : 'valid'
  const highlight = getRoleStop(itinerary, 'highlight') ?? itinerary.stops[0]
  const start = getRoleStop(itinerary, 'start') ?? itinerary.stops[0]
  const locationStop = start ?? highlight
  const generatedAnchor = resolveGeneratedAnchor({
    itinerary,
    intentProfile,
    selectedArtifactLineage,
  })
  const sourceMode = mapSourceModeToEngineSourceMode(
    diagnostics.retrievalDiagnostics.liveSource.effectiveMode,
  )
  const mode = intentProfile.mode
  const waypointSequenceStatus = missingRoleReasons.length > 0 ? 'failed' : 'present'
  const selectedDirectionId =
    intentProfile.selectedDirectionContext?.directionId ?? selectedArtifactLineage?.directionId
  const selectedPocketId =
    intentProfile.selectedDirectionContext?.pocketId ??
    selectedArtifactLineage?.pocketId ??
    diagnostics.selectedDistrictId

  const enrichment: ContractEntryArtifactEnrichment = {
    mode,
    locationContext: {
      city: intentProfile.city,
      neighborhood: intentProfile.neighborhood ?? itinerary.neighborhood,
      areaHint: intentProfile.district ?? diagnostics.selectedDistrictLabel,
      ...(locationStop?.latitude !== undefined ? { latitude: locationStop.latitude } : {}),
      ...(locationStop?.longitude !== undefined ? { longitude: locationStop.longitude } : {}),
    },
    userInputContext: {
      ...(starterPack ? { starterPackId: starterPack.id } : {}),
      primaryVibe: intentProfile.primaryAnchor,
      secondaryVibe: intentProfile.secondaryAnchors?.[0],
      persona: intentProfile.persona ?? undefined,
      startTime: intentProfile.timeWindow,
      ...(intentProfile.anchor?.venueId ? { anchorVenueId: intentProfile.anchor.venueId } : {}),
      ...(highlight ? { anchorName: highlight.venueName } : {}),
    },
    conciergeIntentSummary: buildConciergeIntentSummary(intentProfile),
    tasteDistrictSummary: buildTasteDistrictSummary({ intentProfile, diagnostics }),
    fieldProvenanceSummary: buildFieldProvenanceSummary({ diagnostics, scoredVenues }),
    bearingsAdmissionProof: buildBearingsAdmissionProof(diagnostics),
    waypointSequenceProof: {
      status: waypointSequenceStatus,
      proofId: selectedArc.id,
      summary:
        waypointSequenceStatus === 'present'
          ? 'Canonical start, highlight, and wind-down roles are represented.'
          : 'Canonical route role coverage is incomplete.',
      rejectionReasons: missingRoleReasons,
    },
    canonicalRouteRoleCoverage: roleCoverage,
    validationStatus,
    rejectionReasons: missingRoleReasons,
    starterContextFit: buildStarterContextFit({
      mode,
      starterPack,
      city: intentProfile.city,
      primaryVibe: intentProfile.primaryAnchor,
    }),
    modeContextFit: buildModeContextFit(mode),
    runtimeLockEligibility: {
      eligible: missingRoleReasons.length === 0,
      status: missingRoleReasons.length === 0 ? 'eligible' : 'ineligible',
      rejectionReasons: missingRoleReasons,
      ...(selectedDirectionId ? { selectedDirectionId } : {}),
      buildMetadata: {
        canBuildRuntimeRoute: missingRoleReasons.length === 0,
        ...(missingRoleReasons.length > 0
          ? {
              missingRoles: missingRoleReasons.map((reason) =>
                reason === 'missing_start_role'
                  ? 'start'
                  : reason === 'missing_highlight_role'
                    ? 'highlight'
                    : 'windDown',
              ),
            }
          : {}),
      },
    },
  }

  return {
    id: createId('contract_entry'),
    sourceOpportunityId: selectedArtifactLineage?.sourceOpportunityId ?? selectedArc.id,
    sourceMode,
    anchorVenueId: generatedAnchor.anchorVenueId,
    ...(generatedAnchor.anchorRole ? { anchorRole: generatedAnchor.anchorRole } : {}),
    anchorName: generatedAnchor.anchorName,
    routeTitle: itinerary.storySpine?.title ?? itinerary.title,
    flavorLine: itinerary.story.subtitle,
    routeSummary: itinerary.storySpine?.routeSummary ?? itinerary.shareSummary,
    traits: [
      lens.tone,
      `${lens.discoveryBias}-discovery`,
      `${lens.movementTolerance}-movement`,
    ],
    storySpine: buildStorySpine(itinerary),
    districtLine: itinerary.neighborhood
      ? `Mostly in ${itinerary.neighborhood}`
      : `Mostly in ${itinerary.city}`,
    districtAnchorLine: `District anchor: ${diagnostics.selectedDistrictLabel}`,
    authorityLine: `Authority ${formatPercent(selectedArc.totalScore)}`,
    whyChooseLine:
      highlight?.selectedBecause ??
      diagnostics.stopExplainability.highlight?.selectedBecause ??
      `Selected by ${rankingEngine}.`,
    whyTonightProofLine: itinerary.estimatedTotalLabel,
    selection: {
      ...(selectedDirectionId ? { directionId: selectedDirectionId } : {}),
      ...(selectedPocketId ? { pocketId: selectedPocketId } : {}),
    },
    enrichment,
  }
}
