import {
  validateContractEntryArtifactBuildAnchor,
  validateRuntimeRouteBuildAnchor,
  type BuildAnchorCanonicalRole,
  type BuildAnchorTruthContract,
  type BuildAnchorTruthValidationResult,
} from '../../../domain/artifacts/buildAnchorTruthContract'
import {
  deriveContractEntryArtifactRoleCoverage,
  type ContractEntryArtifact,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import {
  evaluateHoursAdmissibility,
  type BearingsHoursAdmissibilityResult,
  type BearingsHoursTimeSpecificity,
} from '../../../domain/bearings/hoursAdmissibilityPolicy'
import type { BearingsStaticRuntimeHoursProofResult } from '../../../domain/bearings/staticRuntimeHoursProof'
import type { ScenarioRouteGeoCoherence } from '../../../domain/interpretation/construction/scenarioBuilder'
import type { PlanningTimeWindowSignal } from '../../../domain/types/hours'

export type BuildCandidateAdmissionMode = 'build' | 'curate'

export type BuildCandidateAdmissionTruthGateStatus =
  | 'passed'
  | 'warning'
  | 'failed'
  | 'not_evaluated'

export type BuildCandidateGeoPosture =
  | 'coherent'
  | 'controlled_adjacent'
  | 'scattered'
  | 'missing_geo'
  | 'unknown'

export type BuildCandidateAdmissionHardFailureReason =
  | 'missing_anchor_identity'
  | 'anchor_wrong_required_role'
  | 'anchor_support_only'
  | 'anchor_canonical_id_mismatch'
  | 'anchor_provider_id_only'
  | 'anchor_preservation_failed'
  | 'closed_for_plan_window'
  | 'explicit_time_requires_known_open_hours'
  | 'missing_core_route_roles'
  | 'stale_or_non_canonical_route_ids'
  | 'curate_geo_scattered'
  | 'curate_geo_missing'

export type BuildCandidateAdmissionWarningReason =
  | 'build_geo_scattered_required_anchor'
  | 'build_geo_cross_pocket_anchor'
  | 'build_geo_high_friction'
  | 'unspecified_time_unknown_hours_relaxed'

export interface BuildCandidateAdmissionGeoResult {
  posture: BuildCandidateGeoPosture
  penalty: number
  hardBlockReason?: BuildCandidateAdmissionHardFailureReason
  warnings: BuildCandidateAdmissionWarningReason[]
  diagnostics: {
    sourceStatus?: ScenarioRouteGeoCoherence['status']
    rejectionReason?: ScenarioRouteGeoCoherence['rejectionReason']
    uniqueGeoBucketCount?: number
    dominantGeoBucket?: string
    dominantGeoShare?: number
    highFrictionScore?: number
  }
}

export interface BuildCandidateAdmissionResult {
  admitted: boolean
  mode: BuildCandidateAdmissionMode
  requiredAnchorRole?: BuildAnchorCanonicalRole
  anchorPreservationStatus: BuildCandidateAdmissionTruthGateStatus
  geoPosture: BuildCandidateGeoPosture
  geoPenalty: number
  geoHardBlockReason?: BuildCandidateAdmissionHardFailureReason
  hoursAdmissibility?: BearingsHoursAdmissibilityResult
  truthGateStatus: BuildCandidateAdmissionTruthGateStatus
  diagnostics: {
    artifactId?: string
    sourceOpportunityId?: string
    anchorValidation?: BuildAnchorTruthValidationResult
    coreRouteIds: Partial<Record<BuildAnchorCanonicalRole, string>>
    expectedCanonicalRouteIds?: Partial<Record<BuildAnchorCanonicalRole, string>>
    missingCoreRoles: BuildAnchorCanonicalRole[]
    staleCoreRoles: BuildAnchorCanonicalRole[]
    geo: BuildCandidateAdmissionGeoResult['diagnostics']
    buildParked?: {
      providerSelectionAllowed: boolean
      providerMergedIntoVisiblePool: boolean
    }
  }
  rejectionReasons: BuildCandidateAdmissionHardFailureReason[]
  warningReasons: BuildCandidateAdmissionWarningReason[]
}

export interface EvaluateBuildCandidateAdmissionInput {
  mode: BuildCandidateAdmissionMode
  anchorContract?: BuildAnchorTruthContract | null
  contractEntryArtifact?: ContractEntryArtifact | null
  runtimeRouteArtifact?: RuntimeRouteArtifact | null
  expectedCanonicalRouteIds?: Partial<Record<BuildAnchorCanonicalRole, string>>
  geoCoherence?: ScenarioRouteGeoCoherence | null
  highFrictionScore?: number | null
  hoursAdmissibility?: BearingsHoursAdmissibilityResult | null
  hoursProof?: BearingsStaticRuntimeHoursProofResult | null
  planningWindow?: PlanningTimeWindowSignal
  timeSpecificity?: BearingsHoursTimeSpecificity
  buildParked?: {
    providerSelectionAllowed: boolean
    providerMergedIntoVisiblePool: boolean
  }
}

const CORE_ROUTE_ROLES: BuildAnchorCanonicalRole[] = ['start', 'highlight', 'windDown']

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function addRejection(
  reasons: BuildCandidateAdmissionHardFailureReason[],
  reason: BuildCandidateAdmissionHardFailureReason,
): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

function addWarning(
  reasons: BuildCandidateAdmissionWarningReason[],
  reason: BuildCandidateAdmissionWarningReason,
): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

function mapAnchorTruthReasons(
  validation: BuildAnchorTruthValidationResult,
): BuildCandidateAdmissionHardFailureReason[] {
  const reasons: BuildCandidateAdmissionHardFailureReason[] = []
  validation.reasons.forEach((reason) => {
    if (reason === 'anchor_identity_missing') {
      addRejection(reasons, 'missing_anchor_identity')
    } else if (
      reason === 'anchor_not_in_required_role' ||
      reason === 'anchor_role_ambiguous' ||
      reason === 'anchor_role_missing' ||
      reason === 'anchor_role_defaulted_highlight'
    ) {
      addRejection(reasons, 'anchor_wrong_required_role')
    } else if (reason === 'anchor_only_support_stop') {
      addRejection(reasons, 'anchor_support_only')
    } else if (reason === 'anchor_canonical_id_mismatch') {
      addRejection(reasons, 'anchor_canonical_id_mismatch')
    } else if (reason === 'anchor_provider_id_only') {
      addRejection(reasons, 'anchor_provider_id_only')
    } else if (reason === 'anchor_preservation_failed') {
      addRejection(reasons, 'anchor_preservation_failed')
    }
  })
  if (!validation.preserved) {
    addRejection(reasons, 'anchor_preservation_failed')
  }
  return reasons
}

function buildContractArtifactRouteIds(
  artifact: ContractEntryArtifact | null | undefined,
): Partial<Record<BuildAnchorCanonicalRole, string>> {
  if (!artifact) {
    return {}
  }
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(artifact)
  return {
    start: nonEmpty(roleCoverage.start),
    highlight: nonEmpty(artifact.anchorVenueId) ?? nonEmpty(roleCoverage.highlight),
    windDown: nonEmpty(roleCoverage.windDown),
  }
}

function buildRuntimeRouteIds(
  route: RuntimeRouteArtifact | null | undefined,
): Partial<Record<BuildAnchorCanonicalRole, string>> {
  if (!route) {
    return {}
  }
  return Object.fromEntries(
    CORE_ROUTE_ROLES.map((role) => [
      role,
      nonEmpty(route.stops.find((stop) => stop.role === role)?.venueId),
    ]),
  ) as Partial<Record<BuildAnchorCanonicalRole, string>>
}

function collectMissingCoreRoles(
  routeIds: Partial<Record<BuildAnchorCanonicalRole, string>>,
): BuildAnchorCanonicalRole[] {
  return CORE_ROUTE_ROLES.filter((role) => !routeIds[role])
}

function collectStaleCoreRoles(params: {
  routeIds: Partial<Record<BuildAnchorCanonicalRole, string>>
  expectedCanonicalRouteIds?: Partial<Record<BuildAnchorCanonicalRole, string>>
}): BuildAnchorCanonicalRole[] {
  return CORE_ROUTE_ROLES.filter((role) => {
    const expected = nonEmpty(params.expectedCanonicalRouteIds?.[role])
    const observed = nonEmpty(params.routeIds[role])
    return Boolean(expected && observed && expected !== observed)
  })
}

export function evaluateCandidateGeoPosture(params: {
  mode: BuildCandidateAdmissionMode
  geoCoherence?: ScenarioRouteGeoCoherence | null
  highFrictionScore?: number | null
}): BuildCandidateAdmissionGeoResult {
  const geoCoherence = params.geoCoherence
  const posture: BuildCandidateGeoPosture = geoCoherence?.status ?? 'unknown'
  const warnings: BuildCandidateAdmissionWarningReason[] = []
  let hardBlockReason: BuildCandidateAdmissionHardFailureReason | undefined
  let penalty = 0

  if (params.mode === 'curate') {
    if (posture === 'scattered') {
      hardBlockReason = 'curate_geo_scattered'
      penalty = 1
    } else if (posture === 'missing_geo') {
      hardBlockReason = 'curate_geo_missing'
      penalty = 1
    }
  } else if (posture === 'scattered') {
    addWarning(warnings, 'build_geo_scattered_required_anchor')
    penalty = Math.max(penalty, 0.55)
  } else if (posture === 'controlled_adjacent') {
    addWarning(warnings, 'build_geo_cross_pocket_anchor')
    penalty = Math.max(penalty, 0.22)
  }

  if (params.mode === 'build' && typeof params.highFrictionScore === 'number') {
    const normalizedFrictionPenalty = Math.min(0.45, Math.max(0, params.highFrictionScore / 10))
    if (normalizedFrictionPenalty >= 0.3) {
      addWarning(warnings, 'build_geo_high_friction')
    }
    penalty = Math.max(penalty, normalizedFrictionPenalty)
  }

  return {
    posture,
    penalty,
    ...(hardBlockReason ? { hardBlockReason } : {}),
    warnings,
    diagnostics: {
      sourceStatus: geoCoherence?.status,
      rejectionReason: geoCoherence?.rejectionReason,
      uniqueGeoBucketCount: geoCoherence?.uniqueGeoBucketCount,
      dominantGeoBucket: geoCoherence?.dominantGeoBucket,
      dominantGeoShare: geoCoherence?.dominantGeoShare,
      highFrictionScore: params.highFrictionScore ?? undefined,
    },
  }
}

function resolveHoursAdmissibility(
  input: EvaluateBuildCandidateAdmissionInput,
): BearingsHoursAdmissibilityResult | undefined {
  if (input.hoursAdmissibility) {
    return input.hoursAdmissibility
  }
  if (!input.hoursProof) {
    return undefined
  }
  return evaluateHoursAdmissibility({
    proof: input.hoursProof,
    planningWindow: input.planningWindow,
    timeSpecificity: input.timeSpecificity,
  })
}

function mapTruthGateStatus(
  validation: BuildAnchorTruthValidationResult | undefined,
  rejectionReasons: BuildCandidateAdmissionHardFailureReason[],
): BuildCandidateAdmissionTruthGateStatus {
  if (!validation) {
    return 'not_evaluated'
  }
  if (rejectionReasons.length > 0 || validation.status === 'invalid') {
    return 'failed'
  }
  if (validation.status === 'warning') {
    return 'warning'
  }
  return 'passed'
}

export function evaluateBuildCandidateAdmission(
  input: EvaluateBuildCandidateAdmissionInput,
): BuildCandidateAdmissionResult {
  const rejectionReasons: BuildCandidateAdmissionHardFailureReason[] = []
  const warningReasons: BuildCandidateAdmissionWarningReason[] = []
  const contractEntryArtifact = input.contractEntryArtifact ?? null
  const runtimeRouteArtifact = input.runtimeRouteArtifact ?? null
  const anchorContract = input.anchorContract ?? null

  let anchorValidation: BuildAnchorTruthValidationResult | undefined
  if (input.mode === 'build') {
    if (!anchorContract?.canonicalVenueId) {
      addRejection(rejectionReasons, 'missing_anchor_identity')
    } else {
      anchorValidation = runtimeRouteArtifact
        ? validateRuntimeRouteBuildAnchor(anchorContract, runtimeRouteArtifact)
        : validateContractEntryArtifactBuildAnchor(anchorContract, contractEntryArtifact)
      mapAnchorTruthReasons(anchorValidation).forEach((reason) =>
        addRejection(rejectionReasons, reason),
      )
    }
  }

  const routeIds =
    runtimeRouteArtifact && runtimeRouteArtifact.stops.length > 0
      ? buildRuntimeRouteIds(runtimeRouteArtifact)
      : buildContractArtifactRouteIds(contractEntryArtifact)
  const missingCoreRoles = collectMissingCoreRoles(routeIds)
  if (missingCoreRoles.length > 0) {
    addRejection(rejectionReasons, 'missing_core_route_roles')
  }
  const staleCoreRoles = collectStaleCoreRoles({
    routeIds,
    expectedCanonicalRouteIds: input.expectedCanonicalRouteIds,
  })
  if (staleCoreRoles.length > 0) {
    addRejection(rejectionReasons, 'stale_or_non_canonical_route_ids')
  }

  const geo = evaluateCandidateGeoPosture({
    mode: input.mode,
    geoCoherence: input.geoCoherence,
    highFrictionScore: input.highFrictionScore,
  })
  geo.warnings.forEach((reason) => addWarning(warningReasons, reason))
  if (geo.hardBlockReason) {
    addRejection(rejectionReasons, geo.hardBlockReason)
  }

  const hoursAdmissibility = resolveHoursAdmissibility(input)
  if (hoursAdmissibility) {
    if (!hoursAdmissibility.admitted) {
      if (hoursAdmissibility.reason === 'closed_for_plan_window') {
        addRejection(rejectionReasons, 'closed_for_plan_window')
      } else if (hoursAdmissibility.reason === 'explicit_time_requires_known_open_hours') {
        addRejection(rejectionReasons, 'explicit_time_requires_known_open_hours')
      }
    }
    if (
      hoursAdmissibility.status === 'admissible_with_unspecified_time_relaxation' ||
      hoursAdmissibility.diagnostics.relaxationApplied
    ) {
      addWarning(warningReasons, 'unspecified_time_unknown_hours_relaxed')
    }
  }

  const truthGateStatus = mapTruthGateStatus(anchorValidation, rejectionReasons)
  const anchorPreservationStatus =
    input.mode === 'build' ? truthGateStatus : 'not_evaluated'
  const admitted = rejectionReasons.length === 0

  return {
    admitted,
    mode: input.mode,
    ...(anchorContract?.requiredRole ? { requiredAnchorRole: anchorContract.requiredRole } : {}),
    anchorPreservationStatus,
    geoPosture: geo.posture,
    geoPenalty: geo.penalty,
    ...(geo.hardBlockReason ? { geoHardBlockReason: geo.hardBlockReason } : {}),
    ...(hoursAdmissibility ? { hoursAdmissibility } : {}),
    truthGateStatus,
    diagnostics: {
      artifactId: contractEntryArtifact?.id,
      sourceOpportunityId: contractEntryArtifact?.sourceOpportunityId,
      ...(anchorValidation ? { anchorValidation } : {}),
      coreRouteIds: routeIds,
      ...(input.expectedCanonicalRouteIds
        ? { expectedCanonicalRouteIds: input.expectedCanonicalRouteIds }
        : {}),
      missingCoreRoles: uniqueValues(missingCoreRoles),
      staleCoreRoles: uniqueValues(staleCoreRoles),
      geo: geo.diagnostics,
      ...(input.buildParked ? { buildParked: input.buildParked } : {}),
    },
    rejectionReasons,
    warningReasons,
  }
}
