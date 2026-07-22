import type { ScoredVenue } from '../../types/arc'
import type { InternalRole } from '../../types/venue'
import type { LensStopRole } from '../../types/experienceLens'
import {
  evaluateTasteRoleIntentCore,
  type TasteRoleIntentCoreFailure,
  type TasteRoleIntentCoreField,
  type TasteRoleIntentCoreMissingEvidence,
} from './computeRouteMeaningVerdict'
import type { TasteRouteMeaningStopEvidenceInput } from './computeRouteMeaningVerdict'

export type TasteSupportCandidateRole = 'start' | 'highlight' | 'windDown'

export type TasteSupportCandidateVerdictFailedReason =
  | 'taste_support_role_score_failed'
  | 'taste_support_shape_fit_failed'
  | 'taste_support_lens_compatibility_failed'
  | 'taste_support_context_specificity_failed'
  | 'taste_support_evidence_missing'

export interface TasteSupportCandidateEvidence {
  lensCompatibility: ScoredVenue['lensCompatibility']
  stopShapeFit: ScoredVenue['stopShapeFit']
  roleScores: ScoredVenue['roleScores']
  fitScore: ScoredVenue['fitScore']
  contextSpecificity: ScoredVenue['contextSpecificity']
  roleContract: ScoredVenue['roleContract']
  candidateIdentity: ScoredVenue['candidateIdentity']
}

export interface TasteSupportCandidateVerdict {
  owner: 'taste'
  coreFunctionName: 'evaluateTasteRoleIntentCore'
  role: TasteSupportCandidateRole
  passed: boolean
  failedReasons: TasteSupportCandidateVerdictFailedReason[]
  failures: readonly TasteSupportCandidateCoreDiagnostic[]
  scores: {
    roleScore: number | null
    stopShapeFit: number | null
    lensCompatibility: number | null
    fitScore: number | null
    contextSpecificity: number | null
    roleContractSatisfied: boolean | null
  }
  thresholds: {
    roleScore: number
    stopShapeFit: number
    lensCompatibility: number
    contextSpecificity: number
  }
  evidenceSource: 'scored_venue_taste_evidence'
}

export interface TasteSupportCandidateCoreDiagnostic {
  criterion: 'role_right' | 'intent_right'
  field: TasteRoleIntentCoreField
  actualValue: number | null
  threshold: number | null
  thresholdOwner: 'taste'
  thresholdSource: 'evaluateTasteRoleIntentCore'
  reasonCode: TasteSupportCandidateVerdictFailedReason
  evidencePresent: boolean
  coreFunctionName: 'evaluateTasteRoleIntentCore'
}

function getTasteEvidenceRoleKey(role: TasteSupportCandidateRole): Extract<InternalRole, 'warmup' | 'peak' | 'cooldown'> {
  return role === 'start' ? 'warmup' : role === 'highlight' ? 'peak' : 'cooldown'
}

function getTasteEvidenceShapeKey(role: TasteSupportCandidateRole): Extract<LensStopRole, 'start' | 'highlight' | 'windDown'> {
  return role === 'start' ? 'start' : role === 'highlight' ? 'highlight' : 'windDown'
}

function mapCoreFailureReason(
  failure: TasteRoleIntentCoreFailure,
): TasteSupportCandidateVerdictFailedReason {
  if (failure.field === 'role_fit') {
    return 'taste_support_role_score_failed'
  }
  if (failure.field === 'stop_shape_fit') {
    return 'taste_support_shape_fit_failed'
  }
  if (failure.field === 'lens_compatibility') {
    return 'taste_support_lens_compatibility_failed'
  }
  return 'taste_support_context_specificity_failed'
}

function thresholdForField(
  field: TasteRoleIntentCoreField,
  thresholds: ReturnType<typeof evaluateTasteRoleIntentCore>['thresholds'],
): number {
  if (field === 'role_fit') return thresholds.roleFit
  if (field === 'stop_shape_fit') return thresholds.stopShapeFit
  if (field === 'route_fit') return thresholds.routeFit
  if (field === 'lens_compatibility') return thresholds.lensCompatibility
  return thresholds.contextSpecificity
}

function toFailureDiagnostic(params: {
  failure: TasteRoleIntentCoreFailure
}): TasteSupportCandidateCoreDiagnostic {
  return {
    criterion: params.failure.criterion,
    field: params.failure.field,
    actualValue: params.failure.score,
    threshold: params.failure.threshold,
    thresholdOwner: 'taste',
    thresholdSource: 'evaluateTasteRoleIntentCore',
    reasonCode: mapCoreFailureReason(params.failure),
    evidencePresent: true,
    coreFunctionName: 'evaluateTasteRoleIntentCore',
  }
}

function toMissingDiagnostic(params: {
  missing: TasteRoleIntentCoreMissingEvidence
  thresholds: ReturnType<typeof evaluateTasteRoleIntentCore>['thresholds']
}): TasteSupportCandidateCoreDiagnostic {
  return {
    criterion: params.missing.criterion,
    field: params.missing.field,
    actualValue: null,
    threshold: thresholdForField(params.missing.field, params.thresholds),
    thresholdOwner: 'taste',
    thresholdSource: 'evaluateTasteRoleIntentCore',
    reasonCode: 'taste_support_evidence_missing',
    evidencePresent: false,
    coreFunctionName: 'evaluateTasteRoleIntentCore',
  }
}

export function evaluateTasteSupportCandidateVerdict(params: {
  role: TasteSupportCandidateRole
  evidence?: TasteSupportCandidateEvidence | null
}): TasteSupportCandidateVerdict {
  const role = params.role
  const evidence = params.evidence ?? null
  const roleKey = getTasteEvidenceRoleKey(role)
  const shapeKey = getTasteEvidenceShapeKey(role)
  const roleScore = evidence?.roleScores[roleKey] ?? null
  const stopShapeFit = evidence?.stopShapeFit[shapeKey] ?? null
  const lensCompatibility = evidence?.lensCompatibility ?? null
  const fitScore = evidence?.fitScore ?? null
  const contextSpecificity = evidence?.contextSpecificity.overall ?? null
  const roleContractSatisfied = evidence?.roleContract[roleKey]?.satisfied ?? null
  const stopEvidence: TasteRouteMeaningStopEvidenceInput = {
    role,
    candidateVenueId: evidence?.candidateIdentity.baseVenueId ?? 'missing_candidate_identity',
    roleFitScore: roleScore ?? undefined,
    stopShapeFitScore: stopShapeFit ?? undefined,
    lensCompatibilityScore: lensCompatibility ?? undefined,
    contextSpecificityScore: contextSpecificity ?? undefined,
  }
  const coreVerdict = evaluateTasteRoleIntentCore({
    stop: stopEvidence,
    options: {
      roleRight: true,
      intentRight: {
        lensCompatibility: true,
        contextSpecificity: true,
      },
    },
  })
  const coreFailures = [
    ...coreVerdict.roleRight.failures,
    ...coreVerdict.intentRight.failures,
  ]
  const coreMissingEvidence = [
    ...coreVerdict.roleRight.missingEvidence,
    ...coreVerdict.intentRight.missingEvidence,
  ]
  const failures = [
    ...coreFailures.map((failure) => toFailureDiagnostic({ failure })),
    ...coreMissingEvidence.map((missing) =>
      toMissingDiagnostic({ missing, thresholds: coreVerdict.thresholds }),
    ),
  ]
  const failedReasons: TasteSupportCandidateVerdictFailedReason[] =
    coreMissingEvidence.length > 0
      ? ['taste_support_evidence_missing']
      : coreFailures.map(mapCoreFailureReason)

  return {
    owner: 'taste',
    coreFunctionName: coreVerdict.coreFunctionName,
    role,
    passed: coreMissingEvidence.length === 0 && coreFailures.length === 0,
    failedReasons,
    failures,
    scores: {
      roleScore,
      stopShapeFit,
      lensCompatibility,
      fitScore,
      contextSpecificity,
      roleContractSatisfied,
    },
    thresholds: {
      roleScore: coreVerdict.thresholds.roleFit,
      stopShapeFit: coreVerdict.thresholds.stopShapeFit,
      lensCompatibility: coreVerdict.thresholds.lensCompatibility,
      contextSpecificity: coreVerdict.thresholds.contextSpecificity,
    },
    evidenceSource: 'scored_venue_taste_evidence',
  }
}
