import {
  evaluateStaticRuntimeHoursProof,
  type BearingsRuntimeHoursPlanWindowProofStatus,
} from './staticRuntimeHoursProof'
import {
  evaluateHoursAdmissibility,
  type BearingsHoursAdmissibilityReason,
  type BearingsHoursAdmissibilityStatus,
  type BearingsHoursTimeSpecificity,
} from './hoursAdmissibilityPolicy'
import type { PromotedFieldProviderCorpusVenue } from '../field/corpus/types'
import type { PlanningTimeWindowSignal } from '../types/hours'

export interface FieldCorpusRuntimeHoursAdmissionDiagnostic {
  venueId: string
  venueName: string
  providerRecordId: string
  required: boolean
  status: BearingsRuntimeHoursPlanWindowProofStatus
  admissibilityStatus: BearingsHoursAdmissibilityStatus
  admissibilityReason: BearingsHoursAdmissibilityReason
  timeSpecificity: BearingsHoursTimeSpecificity
  relaxationApplied: boolean
  admitted: boolean
  proofSource: PromotedFieldProviderCorpusVenue['runtimeHoursProof']['proofSource']
  structuredPeriodCount: number
  textHoursAvailable: boolean
}

export interface FieldCorpusRuntimeHoursAdmissionDiagnostics {
  planningWindow: {
    day: number
    hour: number
    minute: number
    label: string
    source?: PlanningTimeWindowSignal['source']
  }
  evaluatedCount: number
  requiredCount: number
  openCount: number
  closedBlockedCount: number
  unknownAdmittedCount: number
  notRequiredCount: number
  admittedCount: number
  blockedCount: number
  sampledBlockedVenues: FieldCorpusRuntimeHoursAdmissionDiagnostic[]
  sampledUnknownVenues: FieldCorpusRuntimeHoursAdmissionDiagnostic[]
}

export interface FieldCorpusRuntimeHoursAdmissionResult {
  admitted: PromotedFieldProviderCorpusVenue[]
  blocked: PromotedFieldProviderCorpusVenue[]
  diagnostics: FieldCorpusRuntimeHoursAdmissionDiagnostics
  diagnosticsByVenueId: Map<string, FieldCorpusRuntimeHoursAdmissionDiagnostic>
}

export function applyFieldCorpusRuntimeHoursAdmission(
  candidates: PromotedFieldProviderCorpusVenue[],
  planningWindow: PlanningTimeWindowSignal,
): FieldCorpusRuntimeHoursAdmissionResult {
  const admitted: PromotedFieldProviderCorpusVenue[] = []
  const blocked: PromotedFieldProviderCorpusVenue[] = []
  const venueDiagnostics: FieldCorpusRuntimeHoursAdmissionDiagnostic[] = []
  const diagnosticsByVenueId = new Map<string, FieldCorpusRuntimeHoursAdmissionDiagnostic>()

  for (const candidate of candidates) {
    const proof = evaluateStaticRuntimeHoursProof(candidate, planningWindow)
    const admissibility = evaluateHoursAdmissibility({
      proof,
      planningWindow,
    })
    const diagnostic: FieldCorpusRuntimeHoursAdmissionDiagnostic = {
      venueId: candidate.id,
      venueName: candidate.venue.name,
      providerRecordId: candidate.providerProvenance.providerRecordId,
      required: proof.required,
      status: proof.status,
      admissibilityStatus: admissibility.status,
      admissibilityReason: admissibility.reason,
      timeSpecificity: admissibility.timeSpecificity,
      relaxationApplied: admissibility.diagnostics.relaxationApplied,
      admitted: admissibility.admitted,
      proofSource: proof.proofSource,
      structuredPeriodCount: proof.structuredPeriodCount,
      textHoursAvailable: proof.textHoursAvailable,
    }

    venueDiagnostics.push(diagnostic)
    diagnosticsByVenueId.set(candidate.id, diagnostic)

    if (admissibility.admitted) {
      admitted.push(candidate)
    } else {
      blocked.push(candidate)
    }
  }

  const openCount = venueDiagnostics.filter(
    (diagnostic) => diagnostic.status === 'open_for_plan_window',
  ).length
  const closedBlocked = venueDiagnostics.filter(
    (diagnostic) => diagnostic.status === 'closed_for_plan_window',
  )
  const unknownAdmitted = venueDiagnostics.filter(
    (diagnostic) => diagnostic.status === 'unknown_for_plan_window',
  )
  const notRequiredCount = venueDiagnostics.filter(
    (diagnostic) => diagnostic.status === 'not_required',
  ).length

  return {
    admitted,
    blocked,
    diagnostics: {
      planningWindow: {
        day: planningWindow.day,
        hour: planningWindow.hour,
        minute: planningWindow.minute,
        label: planningWindow.label,
        source: planningWindow.source,
      },
      evaluatedCount: venueDiagnostics.length,
      requiredCount: venueDiagnostics.filter((diagnostic) => diagnostic.required).length,
      openCount,
      closedBlockedCount: closedBlocked.length,
      unknownAdmittedCount: unknownAdmitted.length,
      notRequiredCount,
      admittedCount: admitted.length,
      blockedCount: blocked.length,
      sampledBlockedVenues: closedBlocked.slice(0, 12),
      sampledUnknownVenues: unknownAdmitted.slice(0, 12),
    },
    diagnosticsByVenueId,
  }
}
