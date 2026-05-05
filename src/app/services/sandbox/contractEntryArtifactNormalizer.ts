import type { RealityDirectionCard } from '../../types/realityDirectionCard'
import type {
  CanonicalCandidateRouteArtifact,
  ContractEntryArtifact,
  ContractEntryArtifactDirectionBacking,
  ContractEntryArtifactSelection,
  ContractEntryArtifactQualification,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import type {
  DiscoveryCandidate,
  DiscoveryDirection,
} from '../../../domain/discovery/getDiscoveryCandidates'
import type { CuratePreviewCommitabilityStateLike } from './curatePreviewQualificationTypes'

type QualificationRole<TQualification> =
  TQualification extends CuratePreviewCommitabilityStateLike<infer TDirectionCoreRole, unknown>
    ? TDirectionCoreRole
    : string

type QualificationApprovedPayload<TQualification> =
  TQualification extends CuratePreviewCommitabilityStateLike<string, infer TApprovedPayload>
    ? TApprovedPayload
    : unknown

function normalizeLabel(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

function normalizeRoleStopName(
  direction: DiscoveryDirection,
  candidate: DiscoveryCandidate,
): {
  start: string
  highlight: string
  windDown: string
} {
  return {
    start:
      candidate.role === 'start'
        ? candidate.name
        : normalizeLabel(direction.groups.find((group) => group.role === 'start')?.candidates[0]?.name, 'Selected start'),
    highlight:
      candidate.role === 'highlight'
        ? candidate.name
        : normalizeLabel(
            direction.groups.find((group) => group.role === 'highlight')?.candidates[0]?.name,
            'Selected highlight',
          ),
    windDown:
      candidate.role === 'windDown'
        ? candidate.name
        : normalizeLabel(
            direction.groups.find((group) => group.role === 'windDown')?.candidates[0]?.name,
            'Selected wind-down',
          ),
  }
}

function normalizeStopName(value: string): string {
  return value.trim().toLowerCase()
}

function getDirectionBackingPocketKey(directionCard: RealityDirectionCard): string {
  return directionCard.debugMeta?.pocketId ?? directionCard.id
}

function getFinalRouteStopNameByRole(
  finalRoute: RuntimeRouteArtifact,
  role: 'start' | 'highlight' | 'windDown',
): string | null {
  return finalRoute.stops.find((stop) => stop.role === role)?.displayName ?? null
}

export function buildContractEntryArtifactFromDirectionCard(
  directionCard: RealityDirectionCard,
): ContractEntryArtifact {
  const storySpine = directionCard.card.storySpinePreview
  const districtLine = directionCard.debugMeta?.pocketLabel
    ? `Mostly in ${directionCard.debugMeta.pocketLabel}`
    : normalizeLabel(directionCard.card.supportLine, directionCard.id)

  return {
    id: `direction-card:${directionCard.id}`,
    sourceOpportunityId: `direction-card:${directionCard.id}`,
    anchorVenueId: `direction-card:${directionCard.id}:highlight`,
    anchorRole: 'highlight',
    anchorName: normalizeLabel(storySpine?.highlight, directionCard.card.title),
    routeTitle: directionCard.card.title,
    flavorLine: normalizeLabel(directionCard.card.subtitle, directionCard.card.whyYou),
    routeSummary: directionCard.card.whyNow,
    traits: [directionCard.cluster, directionCard.card.toneTag]
      .filter((value): value is string => Boolean(value && value.trim())),
    storySpine: {
      start: normalizeLabel(storySpine?.start, 'Selected start'),
      highlight: normalizeLabel(storySpine?.highlight, 'Selected highlight'),
      windDown: normalizeLabel(storySpine?.windDown, 'Selected wind-down'),
    },
    districtLine,
    districtAnchorLine: normalizeLabel(directionCard.card.supportLine, districtLine),
    authorityLine: directionCard.card.whyYou,
    whyChooseLine: directionCard.card.confirmation,
    whyTonightProofLine: directionCard.card.selectedProofLine ?? directionCard.card.proofLine,
    selection: {
      pocketId: directionCard.debugMeta?.pocketId,
      directionId: directionCard.id,
    },
  }
}

export function buildContractEntryArtifactFromDiscoveryCandidate(params: {
  direction: DiscoveryDirection
  candidate: DiscoveryCandidate
}): ContractEntryArtifact {
  const { direction, candidate } = params
  const storySpine = normalizeRoleStopName(direction, candidate)

  return {
    id: `discovery-candidate:${direction.id}:${candidate.role}:${candidate.venueId}`,
    sourceOpportunityId: candidate.venueId,
    anchorVenueId: candidate.venueId,
    anchorRole: candidate.role,
    anchorName: candidate.name,
    routeTitle: direction.title,
    flavorLine: candidate.categoryLabel,
    routeSummary: direction.narrative,
    traits: [candidate.categoryLabel, candidate.areaLabel]
      .filter((value): value is string => Boolean(value && value.trim())),
    storySpine,
    districtLine: normalizeLabel(candidate.areaLabel, direction.pocketLabel ?? direction.id),
    districtAnchorLine: normalizeLabel(direction.pocketLabel, candidate.areaLabel),
    authorityLine: candidate.reason,
    whyChooseLine: candidate.reason,
    selection: {
      directionId: direction.id,
    },
  }
}

export function attachQualificationToContractEntryArtifact<
  TArtifact extends ContractEntryArtifact,
  TQualification extends CuratePreviewCommitabilityStateLike = CuratePreviewCommitabilityStateLike,
>(
  artifact: TArtifact,
  qualificationState: TQualification | null | undefined,
): TArtifact & {
  qualification?: ContractEntryArtifactQualification<
    QualificationRole<TQualification>,
    QualificationApprovedPayload<TQualification>
  >
  qualificationStatus?: TQualification['status'] | 'unchecked'
} {
  if (!qualificationState) {
    return {
      ...artifact,
      qualificationStatus: 'unchecked',
    }
  }

  return {
    ...artifact,
    qualification: {
      status: qualificationState.status,
      ...(qualificationState.failureKind
        ? { failureKind: qualificationState.failureKind }
        : {}),
      ...(qualificationState.failedCheck !== undefined
        ? { failedCheck: qualificationState.failedCheck }
        : {}),
      missingRoleForContract: qualificationState.missingRoleForContract,
      ...(qualificationState.candidatePoolSufficiencyByRole
        ? {
            candidatePoolSufficiencyByRole:
              qualificationState.candidatePoolSufficiencyByRole,
          }
        : {}),
      ...(qualificationState.contractBuildabilityStatus
        ? {
            contractBuildabilityStatus:
              qualificationState.contractBuildabilityStatus,
          }
        : {}),
      ...(qualificationState.hardCommitRequired !== undefined
        ? { hardCommitRequired: qualificationState.hardCommitRequired }
        : {}),
      ...(qualificationState.approvedRefinementEntryPayload !== undefined
        ? {
            approvedRefinementEntryPayload:
              qualificationState.approvedRefinementEntryPayload,
          }
        : {}),
    },
    qualificationStatus: qualificationState.status,
  }
}

export function attachFinalRouteParityToContractEntryArtifact<TArtifact extends ContractEntryArtifact>(
  artifact: TArtifact,
  finalRoute: RuntimeRouteArtifact | null | undefined,
): TArtifact & {
  finalRouteParity?: {
    selectedDirectionId: string | null
    startMatch: boolean
    highlightMatch: boolean
    windDownMatch: boolean
  }
} {
  if (!finalRoute) {
    return artifact
  }

  const finalStart = getFinalRouteStopNameByRole(finalRoute, 'start')
  const finalHighlight = getFinalRouteStopNameByRole(finalRoute, 'highlight')
  const finalWindDown = getFinalRouteStopNameByRole(finalRoute, 'windDown')

  return {
    ...artifact,
    finalRouteParity: {
      selectedDirectionId: finalRoute.selectedDirectionId ?? null,
      startMatch:
        finalStart != null && normalizeStopName(finalStart) === normalizeStopName(artifact.storySpine.start),
      highlightMatch:
        finalHighlight != null &&
        normalizeStopName(finalHighlight) === normalizeStopName(artifact.storySpine.highlight),
      windDownMatch:
        finalWindDown != null &&
        normalizeStopName(finalWindDown) === normalizeStopName(artifact.storySpine.windDown),
    },
  }
}

export function normalizeExistingContractEntryArtifact(
  artifact: CanonicalCandidateRouteArtifact,
): ContractEntryArtifact {
  return artifact
}

export function isContractEntryArtifactDirectionBacked(
  artifact: ContractEntryArtifact,
): boolean {
  return artifact.directionBacking?.status === 'backed'
}

export function partitionContractEntryArtifactsByDirectionBacking<
  TArtifact extends ContractEntryArtifact,
>(artifacts: TArtifact[]): {
  backedArtifacts: TArtifact[]
  suppressedUnbackedArtifacts: TArtifact[]
} {
  const backedArtifacts: TArtifact[] = []
  const suppressedUnbackedArtifacts: TArtifact[] = []

  artifacts.forEach((artifact) => {
    if (isContractEntryArtifactDirectionBacked(artifact)) {
      backedArtifacts.push(artifact)
      return
    }
    suppressedUnbackedArtifacts.push(artifact)
  })

  return {
    backedArtifacts,
    suppressedUnbackedArtifacts,
  }
}

export function resolveContractEntryArtifactDirectionBacking(params: {
  selection: ContractEntryArtifactSelection
  directionCards: RealityDirectionCard[]
  allDirectionCards: RealityDirectionCard[]
}): ContractEntryArtifactDirectionBacking {
  const { selection, directionCards, allDirectionCards } = params
  const selectionDirectionId = selection.directionId?.trim() || undefined
  const selectionPocketId = selection.pocketId?.trim() || undefined
  const findDirectionById = (directionId: string | undefined) => {
    if (!directionId) {
      return null
    }
    return (
      directionCards.find((entry) => entry.id === directionId) ??
      allDirectionCards.find((entry) => entry.id === directionId) ??
      null
    )
  }
  const findDirectionByPocket = (pocketId: string | undefined) => {
    if (!pocketId) {
      return null
    }
    return (
      directionCards.find((entry) => getDirectionBackingPocketKey(entry) === pocketId) ??
      allDirectionCards.find((entry) => getDirectionBackingPocketKey(entry) === pocketId) ??
      null
    )
  }

  const directionById = findDirectionById(selectionDirectionId)
  if (directionById) {
    return {
      status: 'backed',
      directionId: directionById.id,
      pocketId: getDirectionBackingPocketKey(directionById),
      source: 'selection_direction',
      reason: 'matched_selection_direction',
    }
  }

  const directionByPocket = findDirectionByPocket(selectionPocketId)
  if (directionByPocket) {
    return {
      status: 'backed',
      directionId: directionByPocket.id,
      pocketId: getDirectionBackingPocketKey(directionByPocket),
      source: 'selection_pocket',
      reason: 'matched_selection_pocket',
    }
  }

  return {
    status: 'unbacked',
    ...(selectionDirectionId ? { directionId: selectionDirectionId } : {}),
    ...(selectionPocketId ? { pocketId: selectionPocketId } : {}),
    source: 'none',
    reason: selectionDirectionId
      ? 'selection_direction_unmatched'
      : selectionPocketId
        ? 'selection_pocket_unmatched'
        : 'selection_missing_direction_and_pocket',
  }
}

export function enrichContractEntryArtifactWithDirectionBacking<
  TArtifact extends ContractEntryArtifact,
>(params: {
  artifact: TArtifact
  directionCards: RealityDirectionCard[]
  allDirectionCards: RealityDirectionCard[]
}): TArtifact & {
  directionBacking: ContractEntryArtifactDirectionBacking
} {
  const { artifact, directionCards, allDirectionCards } = params
  return {
    ...artifact,
    directionBacking: resolveContractEntryArtifactDirectionBacking({
      selection: artifact.selection,
      directionCards,
      allDirectionCards,
    }),
  }
}
