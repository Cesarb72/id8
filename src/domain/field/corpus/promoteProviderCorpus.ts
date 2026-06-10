import { createLiveGoogleVenueId } from '../../providers/admitLiveVenueIdentity'
import type { ProviderCanonicalVenueMapping } from '../../providers/providerCanonicalVenueMapping'
import { resolveCanonicalVenueIdForProviderRecord } from '../../providers/providerCanonicalVenueMapping'
import type { ProviderCorpusArtifact } from '../../providers/providerCorpusArtifact'
import type { Venue } from '../../types/venue'
import {
  OFFLINE_CORPUS_TIME_SENSITIVE_AUDIT_REASON,
  PROMOTED_FIELD_PROVIDER_CORPUS_VERSION,
  RUNTIME_HOURS_VALIDATION_REQUIRED,
  type BearingsValidationRequirement,
  type PromotedFieldProviderCorpus,
  type PromotedFieldProviderCorpusValidationResult,
  type PromotedFieldProviderCorpusVenue,
} from './types'

export interface PromoteProviderCorpusInput {
  artifact: ProviderCorpusArtifact
  sourceRunId: string
  staticVenues: Venue[]
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function addError(errors: string[], condition: boolean, message: string): void {
  if (!condition) {
    errors.push(message)
  }
}

function resolvePromotedVenueId(mapping: ProviderCanonicalVenueMapping): string {
  return mapping.canonicalVenueId ?? createLiveGoogleVenueId(mapping.providerRecordId)
}

function buildBearingsValidationRequirements(
  demotionReasons: string[],
): BearingsValidationRequirement[] {
  return demotionReasons.includes(OFFLINE_CORPUS_TIME_SENSITIVE_AUDIT_REASON)
    ? [RUNTIME_HOURS_VALIDATION_REQUIRED]
    : []
}

function buildRuntimeHoursProof(
  venueArtifact: ProviderCorpusArtifact['venues'][number],
): PromotedFieldProviderCorpusVenue['runtimeHoursProof'] {
  const structuredPeriods = venueArtifact.rawPlace.hoursPeriods ?? []
  const textHoursAvailable = Boolean(
    venueArtifact.rawPlace.currentOpeningHoursText?.length ||
      venueArtifact.rawPlace.regularOpeningHoursText?.length,
  )

  return {
    structuredPeriods,
    textHoursAvailable,
    proofSource:
      structuredPeriods.length > 0
        ? 'structured_periods'
        : textHoursAvailable
          ? 'text_only'
          : 'none',
  }
}

function promoteVenue(
  venueArtifact: ProviderCorpusArtifact['venues'][number],
  staticVenues: Venue[],
): PromotedFieldProviderCorpusVenue | undefined {
  const sourceVenue = venueArtifact.normalizedVenue
  if (sourceVenue.source.qualityGateStatus === 'suppressed') {
    return undefined
  }

  const mapping = resolveCanonicalVenueIdForProviderRecord({
    provider: 'google-places',
    providerRecordId: venueArtifact.providerRecordId,
    staticVenues,
  })
  const id = resolvePromotedVenueId(mapping)
  const demotionReasons = [...sourceVenue.source.demotionReasons]
  const bearingsValidationRequirements = buildBearingsValidationRequirements(demotionReasons)
  const venue: Venue = {
    ...sourceVenue,
    id,
    source: {
      ...sourceVenue.source,
      bearingsValidationRequirements,
    },
  }

  return {
    id,
    providerProvenance: {
      canonicalMatch: {
        canonicalVenueId: mapping.canonicalVenueId,
        confidence: mapping.confidence,
        method: mapping.matchMethod,
      },
      fetchedAt: venueArtifact.fetchedAt,
      generatedAt: venueArtifact.generatedAt,
      originalVenueId: venueArtifact.id,
      provider: venueArtifact.provider,
      providerRecordId: venueArtifact.providerRecordId,
      sourceQueryLabel: venueArtifact.sourceQueryLabel,
      sourceQueryText: venueArtifact.sourceQueryText,
    },
    qualityGateStatus: sourceVenue.source.qualityGateStatus,
    runtimeHoursProof: buildRuntimeHoursProof(venueArtifact),
    support: venueArtifact.support,
    venue,
    venueAudit: {
      approvalBlockers: [...sourceVenue.source.approvalBlockers],
      demotionReasons,
      qualityGateNotes: [...sourceVenue.source.qualityGateNotes],
      suppressionReasons: [...sourceVenue.source.suppressionReasons],
    },
  }
}

function comparePromotedVenues(
  left: PromotedFieldProviderCorpusVenue,
  right: PromotedFieldProviderCorpusVenue,
): number {
  return (
    left.support.categoryFamily.localeCompare(right.support.categoryFamily) ||
    left.id.localeCompare(right.id) ||
    left.providerProvenance.providerRecordId.localeCompare(right.providerProvenance.providerRecordId)
  )
}

export function promoteProviderCorpus(
  input: PromoteProviderCorpusInput,
): PromotedFieldProviderCorpus {
  const venues = input.artifact.venues
    .map((venue) => promoteVenue(venue, input.staticVenues))
    .filter((venue): venue is PromotedFieldProviderCorpusVenue => Boolean(venue))
    .sort(comparePromotedVenues)

  return {
    artifactVersion: PROMOTED_FIELD_PROVIDER_CORPUS_VERSION,
    categoryFamilies: uniqueSorted(venues.map((venue) => venue.support.categoryFamily)),
    city: input.artifact.city,
    excluded: {
      suppressedVenueCount: input.artifact.venues.length - venues.length,
    },
    manifestQueryCount: input.artifact.manifestQueryCount,
    manifestVersion: input.artifact.manifestVersion,
    runtimeImportAllowed: false,
    source: input.artifact.source,
    sourceArtifactVersion: input.artifact.artifactVersion,
    sourceGeneratedAt: input.artifact.generatedAt,
    sourceRunId: input.sourceRunId,
    venueCount: venues.length,
    venues,
  }
}

export function stableStringifyPromotedProviderCorpus(
  corpus: PromotedFieldProviderCorpus,
): string {
  return `${JSON.stringify(corpus, null, 2)}\n`
}

export function validatePromotedFieldProviderCorpus(
  corpus: PromotedFieldProviderCorpus,
): PromotedFieldProviderCorpusValidationResult {
  const errors: string[] = []
  addError(
    errors,
    corpus.artifactVersion === PROMOTED_FIELD_PROVIDER_CORPUS_VERSION,
    'artifactVersion must be field-provider-corpus.v1.',
  )
  addError(errors, corpus.city === 'San Jose', 'city must be San Jose.')
  addError(errors, corpus.source === 'provider', 'source must be provider for the promoted real corpus.')
  addError(errors, corpus.runtimeImportAllowed === false, 'runtimeImportAllowed must be false.')
  addError(errors, corpus.venueCount === corpus.venues.length, 'venueCount must match venues length.')
  addError(errors, corpus.venues.length > 0, 'promoted corpus must include venues.')

  const sortedVenueIds = [...corpus.venues].sort(comparePromotedVenues).map((venue) => venue.id)
  addError(
    errors,
    JSON.stringify(sortedVenueIds) === JSON.stringify(corpus.venues.map((venue) => venue.id)),
    'venues must be sorted by categoryFamily, id, providerRecordId.',
  )

  for (const promotedVenue of corpus.venues) {
    addError(errors, promotedVenue.id === promotedVenue.venue.id, `${promotedVenue.id}: venue id mismatch.`)
    addError(
      errors,
      promotedVenue.venue.source.qualityGateStatus !== 'suppressed',
      `${promotedVenue.id}: suppressed venue must not be promoted.`,
    )
    addError(
      errors,
      promotedVenue.venue.source.provider === 'google-places',
      `${promotedVenue.id}: provider provenance missing from venue source.`,
    )
    addError(
      errors,
      promotedVenue.venue.source.providerRecordId === promotedVenue.providerProvenance.providerRecordId,
      `${promotedVenue.id}: providerRecordId must be provenance and source metadata.`,
    )
    addError(
      errors,
      !('rawPlace' in promotedVenue),
      `${promotedVenue.id}: rawPlace must not be present on promoted venue.`,
    )
    addError(
      errors,
      Array.isArray(promotedVenue.runtimeHoursProof.structuredPeriods),
      `${promotedVenue.id}: runtimeHoursProof.structuredPeriods must be an array.`,
    )
    addError(
      errors,
      typeof promotedVenue.runtimeHoursProof.textHoursAvailable === 'boolean',
      `${promotedVenue.id}: runtimeHoursProof.textHoursAvailable must be boolean.`,
    )
    addError(
      errors,
      ['structured_periods', 'text_only', 'none'].includes(promotedVenue.runtimeHoursProof.proofSource),
      `${promotedVenue.id}: runtimeHoursProof.proofSource is invalid.`,
    )
    addError(
      errors,
      !('openNow' in promotedVenue.runtimeHoursProof),
      `${promotedVenue.id}: runtimeHoursProof must not use persisted openNow as proof.`,
    )
    addError(
      errors,
      !('likelyOpenForCurrentWindow' in promotedVenue.runtimeHoursProof),
      `${promotedVenue.id}: runtimeHoursProof must not use persisted likelyOpenForCurrentWindow as proof.`,
    )
    addError(
      errors,
      !('timeConfidence' in promotedVenue.runtimeHoursProof),
      `${promotedVenue.id}: runtimeHoursProof must not use persisted timeConfidence as proof.`,
    )
    if (promotedVenue.venueAudit.demotionReasons.includes(OFFLINE_CORPUS_TIME_SENSITIVE_AUDIT_REASON)) {
      addError(
        errors,
        promotedVenue.venue.source.bearingsValidationRequirements?.includes(
          RUNTIME_HOURS_VALIDATION_REQUIRED,
        ) === true,
        `${promotedVenue.id}: runtime hours validation requirement missing.`,
      )
    }
  }

  return {
    errors,
    valid: errors.length === 0,
  }
}
