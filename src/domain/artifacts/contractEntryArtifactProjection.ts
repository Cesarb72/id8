import type { RuntimeRouteArtifact } from './runtimeRouteArtifact'
import {
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
  type ContractEntryArtifactMode,
  type ContractEntryArtifactValidationStatus,
} from './contractEntryArtifact'

export interface ContractEntryVisibleCardProjection {
  artifactId: string
  routeTitle: string
  routeSummary: string
  start: string
  highlight: string
  windDown: string
  allowedToRender: boolean
  rejectionReasons: string[]
}

export interface ContractEntryReviewProjection {
  artifactId: string
  routeTitle: string
  whyChooseLine: string
  routeRoles: {
    start: string
    highlight: string
    windDown: string
  }
  validationStatus: ContractEntryVisibleCardProjection['allowedToRender']
}

export interface ContractEntryRevealProjection {
  artifactId: string
  headline: string
  summary: string
  routeRoles: ContractEntryReviewProjection['routeRoles']
  districtLine: string
}

export interface ContractEntryLockProjection {
  artifactId: string
  eligible: boolean
  rejectionReasons: string[]
  runtimeRouteArtifact?: RuntimeRouteArtifact
}

export interface ContractEntryPlansSummaryProjection {
  artifactId: string
  title: string
  city?: string
  mode?: ContractEntryArtifactMode
  validationStatus: ContractEntryArtifactValidationStatus
}

/**
 * P0-A projection seam.
 *
 * These helpers derive display models from canonical ContractEntryArtifact truth.
 * They are not artifacts and must not be used to author engine proof fields.
 */

export function buildContractEntryVisibleCardProjection(
  artifact: ContractEntryArtifact,
): ContractEntryVisibleCardProjection {
  const validation = validateContractEntryArtifactPreCommitTruth(artifact)
  const roleCoverage = validation.roleCoverage
  return {
    artifactId: artifact.id,
    routeTitle: artifact.routeTitle,
    routeSummary: artifact.routeSummary,
    start: roleCoverage.start,
    highlight: roleCoverage.highlight,
    windDown: roleCoverage.windDown,
    allowedToRender: validation.fullPlanVisible,
    rejectionReasons: validation.rejectionReasons,
  }
}

export function buildContractEntryReviewProjection(
  artifact: ContractEntryArtifact,
): ContractEntryReviewProjection {
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(artifact)
  const validation = validateContractEntryArtifactPreCommitTruth(artifact)
  return {
    artifactId: artifact.id,
    routeTitle: artifact.routeTitle,
    whyChooseLine: artifact.whyChooseLine,
    routeRoles: roleCoverage,
    validationStatus: validation.fullPlanVisible,
  }
}

export function buildContractEntryRevealProjection(
  artifact: ContractEntryArtifact,
): ContractEntryRevealProjection {
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(artifact)
  return {
    artifactId: artifact.id,
    headline: artifact.routeTitle,
    summary: artifact.routeSummary,
    routeRoles: roleCoverage,
    districtLine: artifact.districtLine,
  }
}

export function buildContractEntryLockProjection(
  artifact: ContractEntryArtifact,
): ContractEntryLockProjection {
  const eligibility = artifact.enrichment?.runtimeLockEligibility
  return {
    artifactId: artifact.id,
    eligible: eligibility?.eligible === true,
    rejectionReasons: eligibility?.rejectionReasons ?? [],
    ...(eligibility?.runtimeRouteArtifact
      ? { runtimeRouteArtifact: eligibility.runtimeRouteArtifact }
      : {}),
  }
}

export function buildContractEntryPlansSummaryProjection(
  artifact: ContractEntryArtifact,
): ContractEntryPlansSummaryProjection {
  const validation = validateContractEntryArtifactPreCommitTruth(artifact)
  return {
    artifactId: artifact.id,
    title: artifact.routeTitle,
    city: artifact.enrichment?.locationContext?.city,
    mode: artifact.enrichment?.mode,
    validationStatus: validation.status,
  }
}
