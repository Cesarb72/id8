import {
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { StarterSemanticRepresentation } from '../../../domain/interpretation/construction/scenarioBuilder'
import type { GeneratePlanResult } from '../../../domain/runGeneratePlan'
import {
  getArcStopBaseVenueId,
  getArcStopCandidateId,
} from '../../../domain/candidates/candidateIdentity'
import { getCrewPolicy } from '../../../domain/intent/getCrewPolicy'
import {
  approveFinalRouteCandidate,
  type FinalRouteApprovalResult,
} from '../../../domain/routeApproval/approveFinalRouteCandidate'
import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { ArcCandidate } from '../../../domain/types/arc'
import type { BuildLocationClass } from '../../../domain/types/greatStopGate'
import type { IntentInput, RouteShapeContract } from '../../../domain/types/intent'
import type { StarterPack } from '../../../domain/types/starterPack'
import {
  buildCoffeeBooksSemanticRepresentationFromRouteStops,
} from './coffeeBooksSemanticRepresentation'

type PublicRouteRole = 'start' | 'highlight' | 'windDown'
type PlannerRouteRole = GeneratePlanResult['selectedArc']['stops'][number]['role']
type PlannerRouteStop = GeneratePlanResult['selectedArc']['stops'][number]

export type CurateCommittedRouteFallbackRejectedReason =
  | 'feature_flag_disabled'
  | 'source_mode_not_curated'
  | 'live_source_present'
  | 'missing_direction_backing'
  | 'missing_route_shape_contract'
  | 'missing_contract_entry_artifact'
  | 'missing_start_role'
  | 'missing_highlight_role'
  | 'missing_windDown_role'
  | 'runtime_lock_ineligible'
  | 'taste_final_route_refused'
  | 'bearings_final_route_refused'
  | 'waypoint_final_route_refused'
  | 'great_stop_final_route_refused'
  | 'final_route_identity_mismatch'
  | 'stale_projection'

export interface CurateCommittedRouteFallbackAccepted {
  status: 'accepted'
  artifact: ContractEntryArtifact
  approvedCandidate: ArcCandidate
  finalRouteApproval: Extract<FinalRouteApprovalResult, { status: 'approved' }>
  routeStops: string[]
  sourceMode: {
    requestedMode: string | null
    effectiveMode: string | null
    liveFetchAttempted: boolean | null
    liveCount: number | null
  }
}

export interface CurateCommittedRouteFallbackRejected {
  status: 'rejected'
  rejectedReason: CurateCommittedRouteFallbackRejectedReason
  routeStops: string[]
  sourceMode: {
    requestedMode: string | null
    effectiveMode: string | null
    liveFetchAttempted: boolean | null
    liveCount: number | null
  }
}

export type CurateCommittedRouteFallbackDecision =
  | CurateCommittedRouteFallbackAccepted
  | CurateCommittedRouteFallbackRejected

const routeRolePreference: Record<PublicRouteRole, PlannerRouteRole[]> = {
  start: ['warmup'],
  highlight: ['peak'],
  windDown: ['cooldown'],
}

const fallbackArtifactIdPrefix = 'curate_committed_route_fallback'

function readEnvValue(key: string): string | undefined {
  const importMetaEnv = import.meta.env as Record<string, string | undefined> | undefined
  const processEnv =
    typeof process === 'undefined'
      ? undefined
      : (process.env as Record<string, string | undefined>)
  return importMetaEnv?.[key] ?? processEnv?.[key]
}

export function isCurateCommittedRouteFallbackEnabled(): boolean {
  const raw = readEnvValue('VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE')
  return ['1', 'true', 'on', 'yes'].includes(String(raw ?? '').trim().toLowerCase())
}

export function buildCurateStarterPlannerInput(starterPack: StarterPack): IntentInput {
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

export function getCurateCommittedRouteFallbackArtifactId(starterPackId: string): string {
  return `${fallbackArtifactIdPrefix}:${starterPackId}`
}

export function isCurateCommittedRouteFallbackArtifact(
  artifact: Pick<ContractEntryArtifact, 'id'> | null | undefined,
): boolean {
  return Boolean(artifact?.id.startsWith(`${fallbackArtifactIdPrefix}:`))
}

function findRoleStopInCandidate(candidate: ArcCandidate, role: PublicRouteRole) {
  const plannerRoles = routeRolePreference[role]
  return candidate.stops.find((stop) => plannerRoles.includes(stop.role)) ?? null
}

function findRoleStop(result: GeneratePlanResult, role: PublicRouteRole) {
  return findRoleStopInCandidate(result.selectedArc, role)
}

function getRouteStops(result: GeneratePlanResult): string[] {
  return result.selectedArc.stops.map(
    (stop) => `${stop.role}:${stop.scoredVenue.venue.name}`,
  )
}

function getLiveSource(result: GeneratePlanResult) {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  return {
    requestedMode: liveSource.requestedMode,
    effectiveMode: liveSource.effectiveMode,
    liveFetchAttempted: liveSource.liveFetchAttempted,
    liveCount: liveSource.countsBySource.live,
  }
}

function buildCoffeeBooksFallbackSemanticRepresentation(
  stops: PlannerRouteStop[],
): StarterSemanticRepresentation {
  return buildCoffeeBooksSemanticRepresentationFromRouteStops(
    stops.map((stop) => {
      const venue = stop.scoredVenue.venue
      return {
        venueId: venue.id,
        name: venue.name,
        position:
          stop.role === 'warmup'
            ? 'start'
            : stop.role === 'peak'
              ? 'highlight'
              : stop.role === 'cooldown'
                ? 'windDown'
                : 'mid',
        stopType:
          venue.category === 'museum' ? 'cultural_institution' : 'atmospheric_experience',
        evidenceParts: [
          { field: 'venueCategory', value: venue.category },
          { field: 'venueSubcategory', value: venue.subcategory },
          { field: 'tag', value: venue.tags },
        ],
      }
    }),
  )
}

function routeIdentitySignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${getArcStopBaseVenueId(stop)}`)
    .join('|')
}

function publicRouteIdentitySignature(candidate: ArcCandidate): string {
  return (['start', 'highlight', 'windDown'] as const)
    .map((role) => {
      const stop = findRoleStopInCandidate(candidate, role)
      return `${role}:${stop ? getArcStopBaseVenueId(stop) : 'missing'}`
    })
    .join('|')
}

function publicRouteIdentityCandidates(
  candidate: ArcCandidate,
): Record<PublicRouteRole, string[]> {
  return {
    start: [],
    highlight: [],
    windDown: [],
  } satisfies Record<PublicRouteRole, string[]>
}

function buildPublicRouteIdentityCandidates(
  candidate: ArcCandidate,
): Record<PublicRouteRole, string[]> {
  const identities = publicRouteIdentityCandidates(candidate)
  ;(['start', 'highlight', 'windDown'] as const).forEach((role) => {
    const stop = findRoleStopInCandidate(candidate, role)
    if (!stop) {
      return
    }
    identities[role] = [
      getArcStopBaseVenueId(stop),
      getArcStopCandidateId(stop),
    ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
  })
  return identities
}

function runtimeRouteMatchesApprovedCandidate(params: {
  route: RuntimeRouteArtifact
  candidate: ArcCandidate
}): boolean {
  const approvedIdentities = buildPublicRouteIdentityCandidates(params.candidate)
  return (['start', 'highlight', 'windDown'] as const).every((role) => {
    const runtimeVenueId = params.route.stops
      .find((candidate) => candidate.role === role)
      ?.venueId?.trim()
    return Boolean(runtimeVenueId && approvedIdentities[role].includes(runtimeVenueId))
  })
}

function rejectedReasonForFinalRouteApproval(
  approval: Extract<FinalRouteApprovalResult, { status: 'rejected' }>,
): CurateCommittedRouteFallbackRejectedReason {
  if (approval.refusalOwner === 'taste') {
    return 'taste_final_route_refused'
  }
  if (approval.refusalOwner === 'bearings') {
    return 'bearings_final_route_refused'
  }
  if (approval.refusalOwner === 'waypoint') {
    return 'waypoint_final_route_refused'
  }
  return 'great_stop_final_route_refused'
}

function generatedArtifactIsRuntimeEligible(result: GeneratePlanResult): boolean {
  const artifact = result.contractEntryArtifact
  if (!artifact) {
    return false
  }
  const validation = validateContractEntryArtifactPreCommitTruth(artifact, {
    requireEnrichment: true,
  })
  return (
    validation.status === 'valid' &&
    validation.fullPlanVisible &&
    artifact.enrichment?.runtimeLockEligibility?.eligible === true &&
    artifact.enrichment.runtimeLockEligibility.greatStopStatus === 'PASS'
  )
}

export function buildCurateCommittedRouteFallbackDecision(params: {
  starterPack: StarterPack
  result: GeneratePlanResult
  selectedDirectionId: string | null | undefined
  selectedPocketId?: string | null
  routeShapeContract?: RouteShapeContract | null
  locationClass?: BuildLocationClass
}): CurateCommittedRouteFallbackDecision {
  const routeStops = getRouteStops(params.result)
  const sourceMode = getLiveSource(params.result)
  if (!isCurateCommittedRouteFallbackEnabled()) {
    return {
      status: 'rejected',
      rejectedReason: 'feature_flag_disabled',
      routeStops,
      sourceMode,
    }
  }
  if (sourceMode.requestedMode !== 'curated' || sourceMode.effectiveMode !== 'curated') {
    return {
      status: 'rejected',
      rejectedReason: 'source_mode_not_curated',
      routeStops,
      sourceMode,
    }
  }
  if (sourceMode.liveFetchAttempted || sourceMode.liveCount !== 0) {
    return {
      status: 'rejected',
      rejectedReason: 'live_source_present',
      routeStops,
      sourceMode,
    }
  }
  const selectedDirectionId = params.selectedDirectionId?.trim()
  if (!selectedDirectionId) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_direction_backing',
      routeStops,
      sourceMode,
    }
  }
  const proposedStart = findRoleStop(params.result, 'start')
  const proposedHighlight = findRoleStop(params.result, 'highlight')
  const proposedWindDown = findRoleStop(params.result, 'windDown')
  if (!proposedStart) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_start_role',
      routeStops,
      sourceMode,
    }
  }
  if (!proposedHighlight) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_highlight_role',
      routeStops,
      sourceMode,
    }
  }
  if (!proposedWindDown) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_windDown_role',
      routeStops,
      sourceMode,
    }
  }
  if (!params.routeShapeContract) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_route_shape_contract',
      routeStops,
      sourceMode,
    }
  }
  const routeShapeDirectionId =
    params.routeShapeContract.interpretationC1Projection?.selectedDirectionId
  const resultDirectionId =
    params.result.intentProfile.selectedDirectionContext?.directionId
  if (
    (routeShapeDirectionId && routeShapeDirectionId !== selectedDirectionId) ||
    (resultDirectionId && resultDirectionId !== selectedDirectionId)
  ) {
    return {
      status: 'rejected',
      rejectedReason: 'stale_projection',
      routeStops,
      sourceMode,
    }
  }
  if (!generatedArtifactIsRuntimeEligible(params.result)) {
    return {
      status: 'rejected',
      rejectedReason: params.result.contractEntryArtifact
        ? 'runtime_lock_ineligible'
        : 'missing_contract_entry_artifact',
      routeStops,
      sourceMode,
    }
  }
  const finalRouteApproval = approveFinalRouteCandidate({
    source: 'app.curate.committedRouteFallbackFinalRouteAuthority',
    targetRole: 'highlight',
    proposedCandidate: params.result.selectedArc,
    intent: params.result.intentProfile,
    crewPolicy: getCrewPolicy(params.result.intentProfile.crew),
    lens: params.result.lens,
    routeShapeContract: params.routeShapeContract,
    locationClass: params.locationClass,
  })
  if (finalRouteApproval.status === 'rejected') {
    return {
      status: 'rejected',
      rejectedReason: rejectedReasonForFinalRouteApproval(finalRouteApproval),
      routeStops,
      sourceMode,
    }
  }
  if (
    routeIdentitySignature(finalRouteApproval.approvedCandidate) !==
    routeIdentitySignature(params.result.selectedArc)
  ) {
    return {
      status: 'rejected',
      rejectedReason: 'final_route_identity_mismatch',
      routeStops,
      sourceMode,
    }
  }

  const start = findRoleStopInCandidate(finalRouteApproval.approvedCandidate, 'start')
  const highlight = findRoleStopInCandidate(finalRouteApproval.approvedCandidate, 'highlight')
  const windDown = findRoleStopInCandidate(finalRouteApproval.approvedCandidate, 'windDown')
  if (!start) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_start_role',
      routeStops,
      sourceMode,
    }
  }
  if (!highlight) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_highlight_role',
      routeStops,
      sourceMode,
    }
  }
  if (!windDown) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_windDown_role',
      routeStops,
      sourceMode,
    }
  }
  const fallbackRouteStops = [start, highlight, windDown]
  const coffeeBooksSemanticRepresentation =
    params.starterPack.id === 'coffee-books'
      ? buildCoffeeBooksFallbackSemanticRepresentation(fallbackRouteStops)
      : null

  const routeSummary =
    params.result.itinerary.storySpine?.routeSummary ?? params.result.itinerary.shareSummary
  const artifact: ContractEntryArtifact = {
    id: getCurateCommittedRouteFallbackArtifactId(params.starterPack.id),
    sourceOpportunityId: getCurateCommittedRouteFallbackArtifactId(params.starterPack.id),
    sourceMode: 'curated',
    anchorVenueId: highlight.scoredVenue.venue.id,
    anchorRole: 'highlight',
    anchorName: highlight.scoredVenue.venue.name,
    routeTitle: params.result.itinerary.storySpine?.title ?? params.result.itinerary.title,
    flavorLine: params.starterPack.description,
    routeSummary,
    traits: [
      params.starterPack.primaryAnchor,
      ...(params.starterPack.secondaryAnchors ?? []),
    ].filter((value) => Boolean(value && value.trim())),
    storySpine: {
      start: start.scoredVenue.venue.name,
      highlight: highlight.scoredVenue.venue.name,
      windDown: windDown.scoredVenue.venue.name,
    },
    districtLine: `Mostly in ${params.result.itinerary.city || 'San Jose'}`,
    districtAnchorLine: `District anchor: ${params.result.itinerary.city || 'San Jose'}`,
    authorityLine: routeSummary,
    whyChooseLine: routeSummary,
    selection: {
      directionId: selectedDirectionId,
      ...(params.selectedPocketId ? { pocketId: params.selectedPocketId } : {}),
    },
    ...(coffeeBooksSemanticRepresentation
      ? {
          enrichment: {
            ...params.result.contractEntryArtifact.enrichment,
            starterSemanticRepresentation: coffeeBooksSemanticRepresentation,
          },
        }
      : params.result.contractEntryArtifact.enrichment
        ? {
            enrichment: params.result.contractEntryArtifact.enrichment,
          }
      : {}),
  }

  return {
    status: 'accepted',
    artifact,
    approvedCandidate: finalRouteApproval.approvedCandidate,
    finalRouteApproval,
    routeStops,
    sourceMode,
  }
}

export function validateCurateCommittedRouteFallbackShownRouteAuthority(params: {
  decision: CurateCommittedRouteFallbackAccepted
  finalRoute: RuntimeRouteArtifact
}): { status: 'accepted' } | {
  status: 'rejected'
  rejectedReason: Extract<
    CurateCommittedRouteFallbackRejectedReason,
    'final_route_identity_mismatch'
  >
} {
  return runtimeRouteMatchesApprovedCandidate({
    route: params.finalRoute,
    candidate: params.decision.approvedCandidate,
  })
    ? { status: 'accepted' }
    : {
        status: 'rejected',
        rejectedReason: 'final_route_identity_mismatch',
      }
}
