import type { DistrictStructuralFacts } from '../interpretation/taste/districtTasteBridgeArtifact'
import type { PocketViabilityClass } from '../../engines/district/types/districtTypes'

export type BearingsPocketIdentityFacts = Pick<
  DistrictStructuralFacts['identity'],
  'pocketId' | 'label' | 'identityKind' | 'sourcePocketId'
>

export type BearingsPocketGeometryFacts = Pick<
  DistrictStructuralFacts['geometry'],
  'centroid' | 'radiusM' | 'metrics'
>

export type BearingsPocketCompositionFacts = Pick<
  DistrictStructuralFacts['composition'],
  'entityCount' | 'categories' | 'categoryCounts' | 'typeCounts'
>

export type BearingsPocketStructuralSignalFacts = Pick<
  DistrictStructuralFacts['structuralSignals'],
  'density' | 'walkability' | 'categoryDiversity' | 'compactness'
>

export type BearingsPocketLineageFacts = Pick<
  DistrictStructuralFacts['lineage'],
  'origin' | 'truthTier' | 'clusteringSource' | 'fallbackReasonCode' | 'originNotes'
>

// Bearings-facing view over DistrictStructuralFacts. District supplies measurements;
// Bearings owns threshold policy, admissibility, and viability verdicts.
export interface BearingsPocketFacts {
  identity: BearingsPocketIdentityFacts
  geometry: BearingsPocketGeometryFacts
  composition: BearingsPocketCompositionFacts
  structuralSignals: BearingsPocketStructuralSignalFacts
  lineage: BearingsPocketLineageFacts
}

export type BearingsViabilityPolicyPosture = 'strict' | 'standard' | 'relaxed'

export interface BearingsViabilityThresholdEvidence {
  code: string
  metric: string
  value: number
  threshold?: number
  passed: boolean
  note?: string
}

export interface BearingsViabilityDiagnostics {
  summary: string
  evidence: BearingsViabilityThresholdEvidence[]
  debugNotes?: string[]
}

export interface BearingsViabilityVerdict {
  admissible: boolean
  viabilityClass?: PocketViabilityClass
  score?: number
  reasonCodes: string[]
  thresholdEvidence: BearingsViabilityThresholdEvidence[]
  policy: {
    source: string
    version: string
    posture: BearingsViabilityPolicyPosture
  }
  diagnostics?: BearingsViabilityDiagnostics
}
