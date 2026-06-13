import type { BuiltScenarioNight } from '../interpretation/construction/scenarioBuilder'
import type { DirectionContractBuildability } from '../bearings/assessDirectionContractBuildability'
import type { UserStopRole } from '../types/itinerary'
import type { EngineSourceMode } from '../types/sourceMode'
import type { RuntimeRouteArtifact } from './runtimeRouteArtifact'

/**
 * ARC BOUNDARY: interpretation-owned candidate route artifact.
 *
 * `ContractEntryArtifact` is the canonical shared contract for Step 2 / pre-commit
 * route candidates. Application wrappers may select, project, and render it, but
 * should not redefine the artifact shape locally.
 */

export interface ContractEntryArtifactStorySpine {
  start: string
  highlight: string
  windDown: string
}

export interface ContractEntryArtifactSelection {
  pocketId?: string
  directionId?: string
}

export interface ContractEntryArtifactDirectionBacking {
  status: 'backed' | 'unbacked' | 'suppressed'
  directionId?: string
  pocketId?: string
  source: 'selection_direction' | 'selection_pocket' | 'direction_label_support' | 'none'
  reason: string
}

export interface ContractEntryArtifactLineage {
  artifactId: string
  sourceOpportunityId: string
  sourceMode?: EngineSourceMode
  anchorVenueId: string
  anchorRole?: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  directionId?: string
  pocketId?: string
}

export type ContractEntryArtifactMode = 'curate' | 'surprise' | 'build'

export type ContractEntryArtifactValidationStatus = 'valid' | 'incomplete' | 'rejected'

export interface ContractEntryArtifactUserInputContext {
  starterPackId?: string
  primaryVibe?: string
  secondaryVibe?: string
  persona?: string
  startTime?: string
  anchorVenueId?: string
  anchorName?: string
}

export interface ContractEntryArtifactLocationContext {
  city?: string
  neighborhood?: string
  areaHint?: string
  latitude?: number
  longitude?: number
}

export interface ContractEntryArtifactIntentSummary {
  conciergeIntentId?: string
  planningMode?: string
  primaryVibe?: string
  persona?: string
  summary?: string
}

export interface ContractEntryArtifactTasteDistrictSummary {
  tasteProfileId?: string
  districtId?: string
  districtLabel?: string
  pocketId?: string
  summary?: string
}

export interface ContractEntryArtifactFieldProvenanceSummary {
  sourceMode?: EngineSourceMode
  provider?: string
  liveProviderUsed?: boolean
  corpusUsed?: boolean
  calibrationOnly?: boolean
  candidateCount?: number
  queryLabels?: string[]
  provenanceId?: string
}

export interface ContractEntryArtifactProofSummary {
  status: 'present' | 'missing' | 'failed' | 'not_run'
  proofId?: string
  summary?: string
  rejectionReasons?: string[]
}

export interface ContractEntryArtifactCanonicalRouteRoleCoverage {
  start?: string
  highlight?: string
  windDown?: string
  support?: Array<{
    role: UserStopRole | string
    name: string
    venueId?: string
  }>
}

export interface ContractEntryArtifactStarterContextFit {
  status: 'passed' | 'rejected' | 'not_run'
  starterPackId?: string
  mode?: ContractEntryArtifactMode
  contextKey?: string
  rejectionReasons?: string[]
}

export interface ContractEntryArtifactModeContextFit {
  status: 'passed' | 'rejected' | 'not_run'
  mode?: ContractEntryArtifactMode
  contextKey?: string
  rejectionReasons?: string[]
}

export interface ContractEntryArtifactRuntimeLockEligibility {
  eligible: boolean
  status?: 'eligible' | 'ineligible' | 'not_evaluated'
  rejectionReasons?: string[]
  selectedDirectionId?: string
  runtimeRouteArtifact?: RuntimeRouteArtifact
  buildMetadata?: {
    canBuildRuntimeRoute: boolean
    missingRoles?: UserStopRole[]
    missingCanonicalIdentityRoles?: UserStopRole[]
  }
}

export interface ContractEntryArtifactEnrichment {
  mode?: ContractEntryArtifactMode
  locationContext?: ContractEntryArtifactLocationContext
  userInputContext?: ContractEntryArtifactUserInputContext
  conciergeIntentSummary?: ContractEntryArtifactIntentSummary
  tasteDistrictSummary?: ContractEntryArtifactTasteDistrictSummary
  fieldProvenanceSummary?: ContractEntryArtifactFieldProvenanceSummary
  bearingsAdmissionProof?: ContractEntryArtifactProofSummary
  waypointSequenceProof?: ContractEntryArtifactProofSummary
  canonicalRouteRoleCoverage?: ContractEntryArtifactCanonicalRouteRoleCoverage
  validationStatus?: ContractEntryArtifactValidationStatus
  rejectionReasons?: string[]
  starterContextFit?: ContractEntryArtifactStarterContextFit
  modeContextFit?: ContractEntryArtifactModeContextFit
  runtimeLockEligibility?: ContractEntryArtifactRuntimeLockEligibility
}

export interface ContractEntryArtifactQualification<
  TDirectionCoreRole extends string = string,
  TApprovedPayload = unknown,
> {
  status: 'checking' | 'committable' | 'infeasible'
  failureKind?: 'structural_infeasibility' | 'validation_failure' | 'runtime_error'
  failedCheck?: string | null
  missingRoleForContract: TDirectionCoreRole | null
  candidatePoolSufficiencyByRole?: Record<TDirectionCoreRole, number>
  contractBuildabilityStatus?: DirectionContractBuildability['contractBuildabilityStatus']
  hardCommitRequired?: boolean
  approvedRefinementEntryPayload?: TApprovedPayload
}

export interface ContractEntryArtifact {
  id: string
  sourceOpportunityId: string
  sourceMode?: EngineSourceMode
  anchorVenueId: string
  anchorRole?: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  anchorName: string
  routeTitle: string
  flavorLine: string
  routeSummary: string
  traits: string[]
  storySpine: ContractEntryArtifactStorySpine
  districtLine: string
  districtAnchorLine: string
  authorityLine: string
  happeningsLine?: string
  whyChooseLine: string
  whyTonightProofLine?: string
  scenarioEvaluation?: BuiltScenarioNight['evaluation']
  selection: ContractEntryArtifactSelection
  directionBacking?: ContractEntryArtifactDirectionBacking
  qualification?: ContractEntryArtifactQualification
  /**
   * P0-A enrichment seam.
   *
   * This is the canonical pre-commit full-plan candidate truth extension. It is
   * optional for backward compatibility during migration; application/page code
   * may read and project it, but must not author engine proof fields.
   */
  enrichment?: ContractEntryArtifactEnrichment
}

export interface ContractEntryArtifactPreCommitValidationOptions {
  requireEnrichment?: boolean
}

export interface ContractEntryArtifactPreCommitValidationResult {
  status: ContractEntryArtifactValidationStatus
  fullPlanVisible: boolean
  roleCoverage: Required<Pick<ContractEntryArtifactCanonicalRouteRoleCoverage, 'start' | 'highlight' | 'windDown'>>
  rejectionReasons: string[]
}

export function buildContractEntryArtifactLineage(
  artifact: ContractEntryArtifact,
): ContractEntryArtifactLineage {
  return {
    artifactId: artifact.id,
    sourceOpportunityId: artifact.sourceOpportunityId,
    ...(artifact.sourceMode ? { sourceMode: artifact.sourceMode } : {}),
    anchorVenueId: artifact.anchorVenueId,
    ...(artifact.anchorRole ? { anchorRole: artifact.anchorRole } : {}),
    ...(artifact.selection.directionId ? { directionId: artifact.selection.directionId } : {}),
    ...(artifact.selection.pocketId ? { pocketId: artifact.selection.pocketId } : {}),
  }
}

function hasNonEmptyValue(value: string | undefined | null): boolean {
  return Boolean(value?.trim())
}

export function deriveContractEntryArtifactRoleCoverage(
  artifact: ContractEntryArtifact,
): Required<Pick<ContractEntryArtifactCanonicalRouteRoleCoverage, 'start' | 'highlight' | 'windDown'>> {
  return {
    start:
      artifact.enrichment?.canonicalRouteRoleCoverage?.start?.trim() ||
      artifact.storySpine.start,
    highlight:
      artifact.enrichment?.canonicalRouteRoleCoverage?.highlight?.trim() ||
      artifact.storySpine.highlight,
    windDown:
      artifact.enrichment?.canonicalRouteRoleCoverage?.windDown?.trim() ||
      artifact.storySpine.windDown,
  }
}

function collectMissingEnrichmentReasons(
  artifact: ContractEntryArtifact,
): string[] {
  const enrichment = artifact.enrichment
  if (!enrichment) {
    return ['missing_enrichment']
  }
  return [
    enrichment.mode ? null : 'missing_mode',
    enrichment.locationContext ? null : 'missing_location_context',
    enrichment.userInputContext ? null : 'missing_user_input_context',
    enrichment.conciergeIntentSummary ? null : 'missing_concierge_intent_summary',
    enrichment.tasteDistrictSummary ? null : 'missing_taste_district_summary',
    enrichment.fieldProvenanceSummary ? null : 'missing_field_provenance_summary',
    enrichment.bearingsAdmissionProof ? null : 'missing_bearings_admission_proof',
    enrichment.waypointSequenceProof ? null : 'missing_waypoint_sequence_proof',
    enrichment.canonicalRouteRoleCoverage ? null : 'missing_canonical_route_role_coverage',
    enrichment.starterContextFit ? null : 'missing_starter_context_fit',
    enrichment.modeContextFit ? null : 'missing_mode_context_fit',
    enrichment.runtimeLockEligibility ? null : 'missing_runtime_lock_eligibility',
  ].filter((reason): reason is string => Boolean(reason))
}

export function validateContractEntryArtifactPreCommitTruth(
  artifact: ContractEntryArtifact,
  options: ContractEntryArtifactPreCommitValidationOptions = {},
): ContractEntryArtifactPreCommitValidationResult {
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(artifact)
  const rejectionReasons = new Set<string>()

  if (!hasNonEmptyValue(roleCoverage.start)) {
    rejectionReasons.add('missing_start_role')
  }
  if (!hasNonEmptyValue(roleCoverage.highlight)) {
    rejectionReasons.add('missing_highlight_role')
  }
  if (!hasNonEmptyValue(roleCoverage.windDown)) {
    rejectionReasons.add('missing_wind_down_role')
  }

  if (artifact.enrichment?.validationStatus === 'rejected') {
    rejectionReasons.add('artifact_validation_rejected')
  }
  if (artifact.enrichment?.validationStatus === 'incomplete') {
    rejectionReasons.add('artifact_validation_incomplete')
  }
  for (const reason of artifact.enrichment?.rejectionReasons ?? []) {
    if (reason.trim()) {
      rejectionReasons.add(reason)
    }
  }
  if (artifact.enrichment?.starterContextFit?.status === 'rejected') {
    rejectionReasons.add('starter_context_fit_rejected')
  }
  for (const reason of artifact.enrichment?.starterContextFit?.rejectionReasons ?? []) {
    if (reason.trim()) {
      rejectionReasons.add(reason)
    }
  }
  if (artifact.enrichment?.modeContextFit?.status === 'rejected') {
    rejectionReasons.add('mode_context_fit_rejected')
  }
  for (const reason of artifact.enrichment?.modeContextFit?.rejectionReasons ?? []) {
    if (reason.trim()) {
      rejectionReasons.add(reason)
    }
  }
  if (artifact.enrichment?.bearingsAdmissionProof?.status === 'failed') {
    rejectionReasons.add('bearings_admission_failed')
  }
  if (artifact.enrichment?.waypointSequenceProof?.status === 'failed') {
    rejectionReasons.add('waypoint_sequence_failed')
  }
  if (artifact.enrichment?.runtimeLockEligibility?.eligible === false) {
    rejectionReasons.add('runtime_lock_ineligible')
  }
  for (const reason of artifact.enrichment?.runtimeLockEligibility?.rejectionReasons ?? []) {
    if (reason.trim()) {
      rejectionReasons.add(reason)
    }
  }

  const missingEnrichmentReasons = options.requireEnrichment
    ? collectMissingEnrichmentReasons(artifact)
    : []
  missingEnrichmentReasons.forEach((reason) => rejectionReasons.add(reason))

  const hasIncompleteReason =
    missingEnrichmentReasons.length > 0 ||
    rejectionReasons.has('missing_start_role') ||
    rejectionReasons.has('missing_highlight_role') ||
    rejectionReasons.has('missing_wind_down_role') ||
    rejectionReasons.has('artifact_validation_incomplete')
  const fullPlanVisible =
    hasNonEmptyValue(roleCoverage.start) &&
    hasNonEmptyValue(roleCoverage.highlight) &&
    hasNonEmptyValue(roleCoverage.windDown) &&
    rejectionReasons.size === 0
  const status: ContractEntryArtifactValidationStatus =
    rejectionReasons.size > 0
      ? hasIncompleteReason
        ? 'incomplete'
        : 'rejected'
      : 'valid'

  return {
    status,
    fullPlanVisible,
    roleCoverage,
    rejectionReasons: [...rejectionReasons],
  }
}

export function enrichContractEntryArtifact<TArtifact extends ContractEntryArtifact>(
  artifact: TArtifact,
  enrichment: ContractEntryArtifactEnrichment,
): TArtifact {
  return {
    ...artifact,
    enrichment: {
      ...artifact.enrichment,
      ...enrichment,
    },
  }
}

// Compatibility alias during extraction from page-local naming.
export type CanonicalCandidateRouteArtifact = ContractEntryArtifact
