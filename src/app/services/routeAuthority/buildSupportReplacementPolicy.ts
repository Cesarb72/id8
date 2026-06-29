import type { ContractEntryArtifact } from '../../../domain/artifacts/contractEntryArtifact'
import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { ArcCandidate } from '../../../domain/types/arc'
import type { RouteShapeContract } from '../../../domain/types/intent'
import type { InternalRole } from '../../../domain/types/venue'
import type { CoreRouteRole } from './routeAuthorityService'

export type BuildSupportReplacementPolicyReason =
  | 'anchor_survived_required_role'
  | 'exactly_one_start_highlight_wind_down'
  | 'route_shape_contract_present'
  | 'movement_profile_present'
  | 'role_profile_present'
  | 'generated_artifact_matches_final_route'
  | 'selected_arc_trace_present'
  | 'selected_direction_matches_final_route'
  | 'seed_support_stop_preserved'
  | 'seed_support_stop_replaced_as_non_required'
  | 'replacement_selected_by_deterministic_arc'
  | 'replacement_traced_to_post_parity_route'
  | 'no_support_replacement_required'

export type BuildSupportReplacementPolicyRejectionReason =
  | 'selected_candidate_missing'
  | 'generated_artifact_missing'
  | 'final_route_missing'
  | 'route_shape_contract_missing'
  | 'selected_arc_trace_missing'
  | 'anchor_missing_required_role'
  | 'core_role_count_invalid'
  | 'generated_artifact_final_route_mismatch'
  | 'selected_direction_final_route_mismatch'
  | 'required_support_stop_replaced'
  | 'replacement_missing_from_deterministic_arc'
  | 'replacement_role_missing_seed_identity'

export interface BuildSupportReplacementPolicyRoleDecision {
  role: CoreRouteRole
  seedVenueId: string | null
  generatedVenueId: string | null
  required: boolean
  replaced: boolean
  admitted: boolean
  reasonCodes: BuildSupportReplacementPolicyReason[]
  rejectionReasons: BuildSupportReplacementPolicyRejectionReason[]
}

export interface BuildSupportReplacementPolicyResult {
  admitted: boolean
  deterministic: boolean
  reasonCodes: BuildSupportReplacementPolicyReason[]
  rejectionReasons: BuildSupportReplacementPolicyRejectionReason[]
  roleDecisions: BuildSupportReplacementPolicyRoleDecision[]
  replacedRoles: CoreRouteRole[]
  preservedRoles: CoreRouteRole[]
}

export interface EvaluateBuildSupportReplacementPolicyInput {
  selectedCandidateArtifact?: ContractEntryArtifact | null
  generatedArtifact?: ContractEntryArtifact | null
  finalRoute?: RuntimeRouteArtifact | null
  selectedArc?: ArcCandidate | null
  routeShapeContract?: RouteShapeContract | null
  selectedAnchorVenueId?: string | null
  selectedAnchorRequiredRole?: CoreRouteRole | null
  requiredStopVenueIdsByRole?: Partial<Record<CoreRouteRole, string | null | undefined>>
}

const CORE_ROLES: CoreRouteRole[] = ['start', 'highlight', 'windDown']

function nonEmpty(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function addUnique<T>(target: T[], value: T): void {
  if (!target.includes(value)) {
    target.push(value)
  }
}

function normalizeRole(value: string | null | undefined): CoreRouteRole | null {
  if (value === 'start' || value === 'highlight' || value === 'windDown') {
    return value
  }
  return null
}

function normalizeArcRole(value: InternalRole): CoreRouteRole | null {
  if (value === 'warmup') {
    return 'start'
  }
  if (value === 'peak') {
    return 'highlight'
  }
  if (value === 'cooldown') {
    return 'windDown'
  }
  return null
}

function artifactRoleVenueIds(
  artifact: ContractEntryArtifact | null | undefined,
): Partial<Record<CoreRouteRole, string>> {
  const ids: Partial<Record<CoreRouteRole, string>> = {}
  artifact?.enrichment?.canonicalRouteRoleCoverage?.support?.forEach((entry) => {
    const role = normalizeRole(String(entry.role))
    const venueId = nonEmpty(entry.venueId)
    if (role && venueId && !ids[role]) {
      ids[role] = venueId
    }
  })
  const anchorRole = normalizeRole(artifact?.anchorRole)
  const anchorVenueId = nonEmpty(artifact?.anchorVenueId)
  if (anchorRole && anchorVenueId && !ids[anchorRole]) {
    ids[anchorRole] = anchorVenueId
  }
  return ids
}

function routeRoleVenueIds(
  route: RuntimeRouteArtifact | null | undefined,
): Partial<Record<CoreRouteRole, string>> {
  const ids: Partial<Record<CoreRouteRole, string>> = {}
  route?.stops.forEach((stop) => {
    const role = normalizeRole(stop.role)
    const venueId = nonEmpty(stop.venueId)
    if (role && venueId && !ids[role]) {
      ids[role] = venueId
    }
  })
  return ids
}

function routeRoleCounts(route: RuntimeRouteArtifact | null | undefined): Record<CoreRouteRole, number> {
  return {
    start: route?.stops.filter((stop) => stop.role === 'start').length ?? 0,
    highlight: route?.stops.filter((stop) => stop.role === 'highlight').length ?? 0,
    windDown: route?.stops.filter((stop) => stop.role === 'windDown').length ?? 0,
  }
}

function selectedArcRoleVenueIds(
  selectedArc: ArcCandidate | null | undefined,
): Partial<Record<CoreRouteRole, string>> {
  const ids: Partial<Record<CoreRouteRole, string>> = {}
  selectedArc?.stops.forEach((stop) => {
    const role = normalizeArcRole(stop.role)
    const venueId = nonEmpty(stop.scoredVenue.venue.id)
    if (role && venueId && !ids[role]) {
      ids[role] = venueId
    }
  })
  return ids
}

function routeHasAnchorInRequiredRole(params: {
  finalRoute: RuntimeRouteArtifact | null | undefined
  selectedAnchorVenueId?: string | null
  selectedAnchorRequiredRole?: CoreRouteRole | null
}): boolean {
  const anchorVenueId = nonEmpty(params.selectedAnchorVenueId)
  const role = params.selectedAnchorRequiredRole
  if (!params.finalRoute || !anchorVenueId || !role) {
    return false
  }
  return params.finalRoute.stops.some((stop) => stop.role === role && stop.venueId === anchorVenueId)
}

function routeShapeContractReady(routeShapeContract: RouteShapeContract | null | undefined): boolean {
  return Boolean(
    routeShapeContract?.movementProfile &&
      routeShapeContract.roleProfile?.start &&
      routeShapeContract.roleProfile.highlight &&
      routeShapeContract.roleProfile.windDown &&
      routeShapeContract.roleInvariants?.start &&
      routeShapeContract.roleInvariants.highlight &&
      routeShapeContract.roleInvariants.windDown,
  )
}

export function evaluateBuildSupportReplacementPolicy(
  input: EvaluateBuildSupportReplacementPolicyInput,
): BuildSupportReplacementPolicyResult {
  const reasonCodes: BuildSupportReplacementPolicyReason[] = []
  const rejectionReasons: BuildSupportReplacementPolicyRejectionReason[] = []
  const selectedCandidateArtifact = input.selectedCandidateArtifact ?? null
  const generatedArtifact = input.generatedArtifact ?? null
  const finalRoute = input.finalRoute ?? null
  const routeShapeContract = input.routeShapeContract ?? null
  const selectedArc = input.selectedArc ?? null

  if (!selectedCandidateArtifact) {
    addUnique(rejectionReasons, 'selected_candidate_missing')
  }
  if (!generatedArtifact) {
    addUnique(rejectionReasons, 'generated_artifact_missing')
  }
  if (!finalRoute) {
    addUnique(rejectionReasons, 'final_route_missing')
  }
  if (!routeShapeContractReady(routeShapeContract)) {
    addUnique(rejectionReasons, 'route_shape_contract_missing')
  } else {
    addUnique(reasonCodes, 'route_shape_contract_present')
    addUnique(reasonCodes, 'movement_profile_present')
    addUnique(reasonCodes, 'role_profile_present')
  }
  if (!selectedArc) {
    addUnique(rejectionReasons, 'selected_arc_trace_missing')
  } else {
    addUnique(reasonCodes, 'selected_arc_trace_present')
  }
  if (
    !routeHasAnchorInRequiredRole({
      finalRoute,
      selectedAnchorVenueId: input.selectedAnchorVenueId,
      selectedAnchorRequiredRole: input.selectedAnchorRequiredRole,
    })
  ) {
    addUnique(rejectionReasons, 'anchor_missing_required_role')
  } else {
    addUnique(reasonCodes, 'anchor_survived_required_role')
  }

  const roleCounts = routeRoleCounts(finalRoute)
  if (!CORE_ROLES.every((role) => roleCounts[role] === 1)) {
    addUnique(rejectionReasons, 'core_role_count_invalid')
  } else {
    addUnique(reasonCodes, 'exactly_one_start_highlight_wind_down')
  }

  const generatedArtifactIds = artifactRoleVenueIds(generatedArtifact)
  const finalRouteIds = routeRoleVenueIds(finalRoute)
  const selectedCandidateIds = artifactRoleVenueIds(selectedCandidateArtifact)
  const selectedArcIds = selectedArcRoleVenueIds(selectedArc)

  const generatedMatchesFinalRoute = CORE_ROLES.every((role) => {
    const artifactId = generatedArtifactIds[role]
    const routeId = finalRouteIds[role]
    return Boolean(artifactId && routeId && artifactId === routeId)
  })
  if (!generatedMatchesFinalRoute) {
    addUnique(rejectionReasons, 'generated_artifact_final_route_mismatch')
  } else {
    addUnique(reasonCodes, 'generated_artifact_matches_final_route')
    addUnique(reasonCodes, 'replacement_traced_to_post_parity_route')
  }

  if (
    generatedArtifact?.selection.directionId &&
    finalRoute?.selectedDirectionId &&
    generatedArtifact.selection.directionId !== finalRoute.selectedDirectionId
  ) {
    addUnique(rejectionReasons, 'selected_direction_final_route_mismatch')
  } else if (generatedArtifact?.selection.directionId && finalRoute?.selectedDirectionId) {
    addUnique(reasonCodes, 'selected_direction_matches_final_route')
  }

  const requiredByRole = input.requiredStopVenueIdsByRole ?? {}
  const supportRoles = CORE_ROLES.filter((role) => role !== input.selectedAnchorRequiredRole)
  const roleDecisions = supportRoles.map((role): BuildSupportReplacementPolicyRoleDecision => {
    const roleReasonCodes: BuildSupportReplacementPolicyReason[] = []
    const roleRejections: BuildSupportReplacementPolicyRejectionReason[] = []
    const seedVenueId = selectedCandidateIds[role] ?? null
    const generatedVenueId = finalRouteIds[role] ?? null
    const requiredVenueId = nonEmpty(requiredByRole[role])
    const required = Boolean(requiredVenueId)
    const replaced = Boolean(seedVenueId && generatedVenueId && seedVenueId !== generatedVenueId)

    if (!seedVenueId) {
      addUnique(roleRejections, 'replacement_role_missing_seed_identity')
    }
    if (required && generatedVenueId !== requiredVenueId) {
      addUnique(roleRejections, 'required_support_stop_replaced')
    }
    if (!replaced) {
      addUnique(roleReasonCodes, 'seed_support_stop_preserved')
    } else {
      addUnique(roleReasonCodes, 'seed_support_stop_replaced_as_non_required')
      if (selectedArcIds[role] === generatedVenueId) {
        addUnique(roleReasonCodes, 'replacement_selected_by_deterministic_arc')
      } else {
        addUnique(roleRejections, 'replacement_missing_from_deterministic_arc')
      }
    }

    roleRejections.forEach((reason) => addUnique(rejectionReasons, reason))
    roleReasonCodes.forEach((reason) => addUnique(reasonCodes, reason))
    return {
      role,
      seedVenueId,
      generatedVenueId,
      required,
      replaced,
      admitted: roleRejections.length === 0,
      reasonCodes: roleReasonCodes,
      rejectionReasons: roleRejections,
    }
  })

  if (!roleDecisions.some((decision) => decision.replaced)) {
    addUnique(reasonCodes, 'no_support_replacement_required')
  }

  const admitted = rejectionReasons.length === 0
  return {
    admitted,
    deterministic: admitted,
    reasonCodes,
    rejectionReasons,
    roleDecisions,
    replacedRoles: roleDecisions
      .filter((decision) => decision.replaced)
      .map((decision) => decision.role),
    preservedRoles: roleDecisions
      .filter((decision) => !decision.replaced)
      .map((decision) => decision.role),
  }
}
