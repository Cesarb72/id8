import {
  computeRolePoolCandidateMeaningEvidence,
  computeRolePoolMeaningContextEvidence,
  computeRolePoolMeaningEvidence,
  type RolePoolMeaningCandidateEvidence,
  type RolePoolMeaningCandidateInput,
  type RolePoolMeaningContextEvidence,
  type RolePoolMeaningContextInput,
  type RolePoolMeaningEvidence,
} from './computeRolePoolMeaningEvidence'
import type {
  TasteRolePoolCandidateMeaningEvidence,
  TasteRolePoolMeaningView,
} from './tasteRolePoolMeaningView'
import type { TasteRouteMeaningStopRole } from './routeMeaningVerdict'

export interface TasteRolePoolMeaningCandidateRequest {
  role?: TasteRouteMeaningStopRole
  candidate: RolePoolMeaningCandidateInput
}

export interface ComputeTasteRolePoolMeaningViewInput {
  context: RolePoolMeaningContextInput
  candidates: readonly TasteRolePoolMeaningCandidateRequest[]
}

export interface ComputeTasteRolePoolMeaningViewResult {
  view: TasteRolePoolMeaningView
  foundation: readonly RolePoolMeaningEvidence[]
}

function buildRoleSuitabilityMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'role_suitability_meaning'> {
  return {
    source: 'taste',
    kind: 'role_suitability_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildEasyHangMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'easy_hang_meaning'> {
  return {
    source: 'taste',
    kind: 'easy_hang_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    compatibility: evidence.rolePoolEvidence.easyHangCompatibility,
    reasons: evidence.candidate.hardIncompatibleSignals,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildRomanticRoleMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'romantic_role_meaning'> {
  return {
    source: 'taste',
    kind: 'romantic_role_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    compatibility:
      evidence.candidate.romantic.cozyCompatible ||
      evidence.candidate.romantic.livelyCompatible
        ? 'compatible'
        : 'partial',
    components: evidence.rolePoolEvidence.romanticEvidence,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildFamilyRoleMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'family_role_meaning'> {
  return {
    source: 'taste',
    kind: 'family_role_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    compatibility: evidence.candidate.family.nightlifeConflict
      ? 'conflict'
      : evidence.candidate.family.boundedEnergyCompatible
        ? 'compatible'
        : 'partial',
    components: evidence.rolePoolEvidence.familyEvidence,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function groupByRole(
  candidates: readonly TasteRolePoolCandidateMeaningEvidence[],
): TasteRolePoolMeaningView['rolePools'] {
  const rolePools: NonNullable<TasteRolePoolMeaningView['rolePools']> = {}

  for (const candidate of candidates) {
    if (!candidate.role) {
      continue
    }
    rolePools[candidate.role] = [...(rolePools[candidate.role] ?? []), candidate]
  }

  return rolePools
}

export function computeTasteRolePoolMeaningView(
  input: ComputeTasteRolePoolMeaningViewInput,
): ComputeTasteRolePoolMeaningViewResult {
  const contextEvidence = computeRolePoolMeaningContextEvidence(input.context)
  const foundation = input.candidates.map((entry) =>
    computeRolePoolMeaningEvidence({
      role: entry.role,
      context: input.context,
      candidate: entry.candidate,
    }),
  )
  const candidates = foundation.flatMap((evidence) => [
    buildRoleSuitabilityMeaning(evidence),
    buildEasyHangMeaning(evidence),
    buildRomanticRoleMeaning(evidence),
    buildFamilyRoleMeaning(evidence),
  ])

  return {
    foundation,
    view: {
      source: 'taste',
      scope: 'candidate_set_pre_coordination',
      provenance: [
        {
          source: 'taste',
          key: 'computeRolePoolMeaningEvidence',
          label: 'Taste role-pool meaning evidence',
        },
      ],
      context: {
        source: 'taste',
        contextInput: input.context,
        contextEvidence,
      },
      candidates,
      rolePools: groupByRole(candidates),
      foundation,
    },
  }
}

export function computeTasteRolePoolMeaningForCandidate(input: {
  role?: TasteRouteMeaningStopRole
  context: RolePoolMeaningContextInput
  candidate: RolePoolMeaningCandidateInput
}): RolePoolMeaningEvidence {
  return computeTasteRolePoolMeaningView({
    context: input.context,
    candidates: [{ role: input.role, candidate: input.candidate }],
  }).foundation[0]!
}

export function computeTasteRolePoolContextMeaning(
  input: RolePoolMeaningContextInput,
): RolePoolMeaningContextEvidence {
  return computeRolePoolMeaningContextEvidence(input)
}

export function computeTasteRolePoolCandidateMeaning(
  input: RolePoolMeaningCandidateInput,
): RolePoolMeaningCandidateEvidence {
  return computeRolePoolCandidateMeaningEvidence(input)
}
