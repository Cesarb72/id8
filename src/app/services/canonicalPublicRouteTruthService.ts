import {
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../../domain/artifacts/contractEntryArtifact'
import {
  buildContractEntryLockProjection,
  buildContractEntryPlansSummaryProjection,
  buildContractEntryReviewProjection,
  buildContractEntryRevealProjection,
  buildContractEntryVisibleCardProjection,
} from '../../domain/artifacts/contractEntryArtifactProjection'
import type { ExperienceMode } from '../../domain/types/intent'
import type { Itinerary } from '../../domain/types/itinerary'
import type { StarterPack } from '../../domain/types/starterPack'
import { validatePublicCurateStarterFit } from './curate/publicCurateCardTruthService'

export interface PublicContractEntryArtifactTruthContext {
  mode: ExperienceMode | null
  starterPack?: StarterPack | null
}

export interface PublicContractEntryArtifactTruthResult {
  allowedToRender: boolean
  artifact: ContractEntryArtifact | null
  rejectionReasons: string[]
}

function normalizeRouteText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getItineraryRoleName(
  itinerary: Itinerary,
  role: 'start' | 'highlight' | 'windDown',
): string | null {
  return itinerary.stops.find((stop) => stop.role === role)?.venueName ?? null
}

function collectContextRejectionReasons(
  artifact: ContractEntryArtifact,
  context: PublicContractEntryArtifactTruthContext,
): string[] {
  const reasons = new Set<string>()
  const artifactMode = artifact.enrichment?.mode
  const expectedMode = context.mode
  if (!expectedMode) {
    reasons.add('missing_expected_mode')
  }
  if (expectedMode && artifactMode && artifactMode !== expectedMode) {
    reasons.add('mode_context_mismatch')
  }
  if (expectedMode && artifact.enrichment?.modeContextFit?.mode) {
    if (artifact.enrichment.modeContextFit.mode !== expectedMode) {
      reasons.add('mode_context_mismatch')
    }
  }

  const expectedStarterPackId = context.starterPack?.id
  const artifactStarterPackId =
    artifact.enrichment?.starterContextFit?.starterPackId ??
    artifact.enrichment?.userInputContext?.starterPackId
  if (expectedStarterPackId && artifactStarterPackId !== expectedStarterPackId) {
    reasons.add('starter_context_mismatch')
  }
  if (!expectedStarterPackId && artifactStarterPackId && expectedMode === 'curate') {
    reasons.add('starter_context_mismatch')
  }

  if (expectedMode === 'curate') {
    const starterFit = validatePublicCurateStarterFit({
      selectedStarterPack: context.starterPack ?? null,
      artifact,
    })
    if (!starterFit.allowedToRender) {
      for (const reason of starterFit.rejectionReasons) {
        reasons.add(`curate_${reason}`)
      }
    }
  }

  return [...reasons]
}

export function validatePublicContractEntryArtifactTruth(
  artifact: ContractEntryArtifact | undefined | null,
  context: PublicContractEntryArtifactTruthContext,
): PublicContractEntryArtifactTruthResult {
  if (!artifact) {
    return {
      allowedToRender: false,
      artifact: null,
      rejectionReasons: ['missing_contract_entry_artifact'],
    }
  }

  const validation = validateContractEntryArtifactPreCommitTruth(artifact, {
    requireEnrichment: true,
  })
  const rejectionReasons = new Set<string>(validation.rejectionReasons)
  for (const reason of collectContextRejectionReasons(artifact, context)) {
    rejectionReasons.add(reason)
  }
  const allowedToRender =
    validation.status === 'valid' &&
    validation.fullPlanVisible &&
    rejectionReasons.size === 0

  return {
    allowedToRender,
    artifact: allowedToRender ? artifact : null,
    rejectionReasons: [...rejectionReasons],
  }
}

export function buildArtifactBackedVisibleItinerary(params: {
  artifact: ContractEntryArtifact | undefined | null
  itinerary: Itinerary | undefined | null
  context: PublicContractEntryArtifactTruthContext
}): Itinerary | null {
  const { artifact, itinerary, context } = params
  if (!itinerary) {
    return null
  }
  const truth = validatePublicContractEntryArtifactTruth(artifact, context)
  if (!truth.allowedToRender || !truth.artifact) {
    return null
  }
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(truth.artifact)
  const roles = ['start', 'highlight', 'windDown'] as const
  const routeMatchesArtifact = roles.every((role) => {
    const itineraryName = getItineraryRoleName(itinerary, role)
    return normalizeRouteText(itineraryName) === normalizeRouteText(roleCoverage[role])
  })
  if (!routeMatchesArtifact) {
    return null
  }
  return itinerary
}

export function buildCanonicalPublicRouteFlowTruth(
  artifact: ContractEntryArtifact | undefined | null,
  context: PublicContractEntryArtifactTruthContext,
) {
  const truth = validatePublicContractEntryArtifactTruth(artifact, context)
  if (!truth.allowedToRender || !truth.artifact) {
    return {
      allowed: false,
      rejectionReasons: truth.rejectionReasons,
      visibleCard: null,
      review: null,
      reveal: null,
      lock: null,
      plans: null,
    }
  }

  return {
    allowed: true,
    rejectionReasons: [],
    visibleCard: buildContractEntryVisibleCardProjection(truth.artifact),
    review: buildContractEntryReviewProjection(truth.artifact),
    reveal: buildContractEntryRevealProjection(truth.artifact),
    lock: buildContractEntryLockProjection(truth.artifact),
    plans: buildContractEntryPlansSummaryProjection(truth.artifact),
  }
}
