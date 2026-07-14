import { sanJoseProviderCorpus, sanJoseProviderCorpusVenues } from './sanJoseProviderCorpus'
import { readFieldStaticProviderCorpusCurateEnabled } from './fieldStaticProviderCorpusConfig'
import {
  applyFieldCorpusRuntimeHoursAdmission,
  type FieldCorpusRuntimeHoursAdmissionDiagnostic,
  type FieldCorpusRuntimeHoursAdmissionDiagnostics,
} from '../../bearings/fieldCorpusRuntimeHoursAdmission'
import { resolvePlanningTimeWindowResolution } from '../../temporal/resolvePlanningTimeWindow'
import type { PromotedFieldProviderCorpusVenue } from './types'
import type { IntentProfile } from '../../types/intent'
import type { SourceMode } from '../../types/sourceMode'
import type { StarterPack } from '../../types/starterPack'
import type { Venue } from '../../types/venue'
import type { WhenSignalProfile } from '../../when/whenSignalProfile'

export const curateStaticFieldCorpusStarterAliases: Record<string, string> = {
  'arcade-and-drinks': 'arcade-drinks',
  'park-and-ice-cream': 'park-ice-cream',
}

export type CurateStaticFieldCorpusReason =
  | 'flag_disabled'
  | 'mode_not_curate'
  | 'city_not_supported'
  | 'source_mode_not_curated'
  | 'starter_missing'
  | 'starter_not_supported'
  | 'activated'

export interface CurateStaticFieldCorpusDiagnostics {
  enabled: boolean
  activated: boolean
  reason: CurateStaticFieldCorpusReason
  city: 'San Jose'
  starterId?: string
  starterSupportKey?: string
  candidateCount: number
  appendedCount: number
  duplicateCandidateCount: number
  staticCollisionCount: number
  suppressedExcludedCount: number
  approvedCount: number
  demotedCount: number
  bearingsRequirementCount: number
  runtimeHoursAdmission?: FieldCorpusRuntimeHoursAdmissionDiagnostics
}

export interface ResolveCurateStaticFieldCorpusVenuesInput {
  intent: IntentProfile
  whenSignalProfile?: WhenSignalProfile
  clock?: Date
  starterPack?: StarterPack
  existingCuratedVenues: Venue[]
  requestedSourceMode: SourceMode
  enabled?: boolean
}

export interface ResolveCurateStaticFieldCorpusVenuesResult {
  venues: Venue[]
  diagnostics: CurateStaticFieldCorpusDiagnostics
}

function sanitizeText(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeCity(value: string): string {
  return sanitizeText(value)
}

function resolveStarterSupportKey(starterPack?: StarterPack): string | undefined {
  if (!starterPack) {
    return undefined
  }
  return curateStaticFieldCorpusStarterAliases[starterPack.id] ?? starterPack.id
}

function buildDiagnostics(
  patch: Partial<CurateStaticFieldCorpusDiagnostics> & Pick<CurateStaticFieldCorpusDiagnostics, 'reason'>,
): CurateStaticFieldCorpusDiagnostics {
  return {
    enabled: false,
    activated: false,
    city: 'San Jose',
    candidateCount: 0,
    appendedCount: 0,
    duplicateCandidateCount: 0,
    staticCollisionCount: 0,
    suppressedExcludedCount: 0,
    approvedCount: 0,
    demotedCount: 0,
    bearingsRequirementCount: 0,
    ...patch,
  }
}

function hasStaticCollision(candidate: Venue, existingCuratedVenues: Venue[]): boolean {
  const candidateProviderRecordId = candidate.source.providerRecordId
  const candidateName = sanitizeText(candidate.name)
  const candidateCity = sanitizeCity(candidate.city)
  const candidateNeighborhood = sanitizeText(candidate.neighborhood)
  const candidateAddress = sanitizeText(candidate.source.formattedAddress)

  return existingCuratedVenues.some((existing) => {
    if (existing.id === candidate.id) {
      return true
    }
    if (candidateProviderRecordId && existing.source.providerRecordId === candidateProviderRecordId) {
      return true
    }

    const existingName = sanitizeText(existing.name)
    if (!candidateName || candidateName !== existingName) {
      return false
    }

    if (candidateCity && candidateCity !== sanitizeCity(existing.city)) {
      return false
    }

    const existingAddress = sanitizeText(existing.source.formattedAddress)
    if (candidateAddress && existingAddress && candidateAddress === existingAddress) {
      return true
    }

    return candidateNeighborhood !== '' && candidateNeighborhood === sanitizeText(existing.neighborhood)
  })
}

function projectStaticFieldVenue(
  promotedVenue: PromotedFieldProviderCorpusVenue,
  runtimeHoursAdmission?: FieldCorpusRuntimeHoursAdmissionDiagnostic,
  runtimeHoursPlanWindowSource?: Venue['source']['runtimeHoursPlanWindowSource'],
): Venue {
  return {
    ...promotedVenue.venue,
    source: {
      ...promotedVenue.venue.source,
      sourceOrigin: 'curated',
      curatedSubtype: 'curated-derived',
      provider: promotedVenue.providerProvenance.provider,
      providerRecordId: promotedVenue.providerProvenance.providerRecordId,
      sourceQueryLabel: promotedVenue.providerProvenance.sourceQueryLabel,
      qualityGateStatus: promotedVenue.qualityGateStatus,
      approvalBlockers: [...promotedVenue.venueAudit.approvalBlockers],
      demotionReasons: [...promotedVenue.venueAudit.demotionReasons],
      qualityGateNotes: [...promotedVenue.venueAudit.qualityGateNotes],
      suppressionReasons: [...promotedVenue.venueAudit.suppressionReasons],
      bearingsValidationRequirements: [
        ...(promotedVenue.venue.source.bearingsValidationRequirements ?? []),
      ],
      runtimeHoursPlanWindowProofStatus: runtimeHoursAdmission?.status,
      runtimeHoursPlanWindowSource: runtimeHoursAdmission
        ? runtimeHoursPlanWindowSource
        : undefined,
      runtimeHoursStructuredPeriodCount: runtimeHoursAdmission?.structuredPeriodCount,
      runtimeHoursTextHoursAvailable: runtimeHoursAdmission?.textHoursAvailable,
    },
  }
}

function dedupePromotedCandidates(
  candidates: PromotedFieldProviderCorpusVenue[],
): {
  venues: PromotedFieldProviderCorpusVenue[]
  duplicateCandidateCount: number
} {
  const seenVenueIds = new Set<string>()
  const seenProviderRecordIds = new Set<string>()
  const venues: PromotedFieldProviderCorpusVenue[] = []
  let duplicateCandidateCount = 0

  for (const candidate of candidates) {
    const providerRecordId = candidate.providerProvenance.providerRecordId
    if (seenVenueIds.has(candidate.id) || seenProviderRecordIds.has(providerRecordId)) {
      duplicateCandidateCount += 1
      continue
    }
    seenVenueIds.add(candidate.id)
    seenProviderRecordIds.add(providerRecordId)
    venues.push(candidate)
  }

  return { venues, duplicateCandidateCount }
}

export function resolveCurateStaticFieldCorpusVenues({
  intent,
  whenSignalProfile,
  clock,
  starterPack,
  existingCuratedVenues,
  requestedSourceMode,
  enabled = readFieldStaticProviderCorpusCurateEnabled(),
}: ResolveCurateStaticFieldCorpusVenuesInput): ResolveCurateStaticFieldCorpusVenuesResult {
  const starterSupportKey = resolveStarterSupportKey(starterPack)
  const baseDiagnostics = {
    enabled,
    starterId: starterPack?.id,
    starterSupportKey,
  }

  if (!enabled) {
    return {
      venues: [],
      diagnostics: buildDiagnostics({ ...baseDiagnostics, reason: 'flag_disabled' }),
    }
  }

  if (intent.mode !== 'curate') {
    return {
      venues: [],
      diagnostics: buildDiagnostics({ ...baseDiagnostics, reason: 'mode_not_curate' }),
    }
  }

  if (sanitizeCity(intent.city) !== 'san jose') {
    return {
      venues: [],
      diagnostics: buildDiagnostics({ ...baseDiagnostics, reason: 'city_not_supported' }),
    }
  }

  if (requestedSourceMode !== 'curated') {
    return {
      venues: [],
      diagnostics: buildDiagnostics({ ...baseDiagnostics, reason: 'source_mode_not_curated' }),
    }
  }

  if (!starterSupportKey) {
    return {
      venues: [],
      diagnostics: buildDiagnostics({ ...baseDiagnostics, reason: 'starter_missing' }),
    }
  }

  const suppressedExcludedCount = sanJoseProviderCorpus.excluded.suppressedVenueCount
  const candidates = sanJoseProviderCorpusVenues.filter(
    (promotedVenue) => promotedVenue.support.starters.includes(starterSupportKey),
  )

  if (candidates.length === 0) {
    return {
      venues: [],
      diagnostics: buildDiagnostics({
        ...baseDiagnostics,
        reason: 'starter_not_supported',
        suppressedExcludedCount,
      }),
    }
  }

  const dedupedCandidates = dedupePromotedCandidates(candidates)
  const planningWindowResolution = resolvePlanningTimeWindowResolution(intent, {
    whenSignalProfile,
    clock,
  })
  const planningWindow = planningWindowResolution.planningWindow
  const timeSpecificity =
    planningWindowResolution.whenProjection?.strictness === 'strict'
      ? 'explicit'
      : undefined
  const runtimeHoursAdmission = applyFieldCorpusRuntimeHoursAdmission(
    dedupedCandidates.venues,
    planningWindow,
    {
      timeSpecificity,
      invalidPlanningWindowReason: planningWindowResolution.whenProjection?.valid === false
        ? planningWindowResolution.whenProjection.invalidReason
        : undefined,
    },
  )
  const projectedCandidates = runtimeHoursAdmission.admitted.map((promotedVenue) =>
    projectStaticFieldVenue(
      promotedVenue,
      runtimeHoursAdmission.diagnosticsByVenueId.get(promotedVenue.id),
      planningWindow?.source,
    ),
  )
  const venues: Venue[] = []
  let staticCollisionCount = 0

  for (const candidate of projectedCandidates) {
    if (hasStaticCollision(candidate, existingCuratedVenues)) {
      staticCollisionCount += 1
      continue
    }
    venues.push(candidate)
  }

  return {
    venues,
    diagnostics: buildDiagnostics({
      ...baseDiagnostics,
      reason: 'activated',
      activated: venues.length > 0,
      candidateCount: candidates.length,
      appendedCount: venues.length,
      duplicateCandidateCount: dedupedCandidates.duplicateCandidateCount,
      staticCollisionCount,
      suppressedExcludedCount,
      approvedCount: venues.filter((venue) => venue.source.qualityGateStatus === 'approved').length,
      demotedCount: venues.filter((venue) => venue.source.qualityGateStatus === 'demoted').length,
      bearingsRequirementCount: venues.filter(
        (venue) => (venue.source.bearingsValidationRequirements ?? []).length > 0,
      ).length,
      runtimeHoursAdmission: runtimeHoursAdmission.diagnostics,
    }),
  }
}
