import type { LiveDataProvider, VenueSourceOrigin } from '../types/sourceMode'

export type CandidateEvidenceProducer =
  | 'Field'
  | 'Interpretation'
  | 'District'
  | 'Bearings'
  | 'Waypoint'
  | 'Application'

export interface CandidateEvidenceIdentity {
  candidateId: string
  baseVenueId?: string
  venueId?: string
  traceLabel?: string
}

export interface CandidateEvidenceProvenance {
  sourceOrigin?: VenueSourceOrigin
  provider?: LiveDataProvider
  providerRecordId?: string
  sourceQueryLabel?: string
}

export type CandidateEvidenceObservation<
  TProducer extends CandidateEvidenceProducer,
  TKey extends string,
  TValue,
> =
  | {
      producer: TProducer
      key: TKey
      available: true
      value: TValue
    }
  | {
      producer: TProducer
      key: TKey
      available: false
      unavailableReason: 'not_observed' | 'not_retained' | 'not_applicable'
    }

export interface CandidateEvidenceRowBase<
  TProducer extends CandidateEvidenceProducer,
  TKind extends string,
> {
  protocolVersion: 'candidate-evidence.v1'
  producer: TProducer
  evidenceKind: TKind
  identity: CandidateEvidenceIdentity
  provenance: CandidateEvidenceProvenance
}
