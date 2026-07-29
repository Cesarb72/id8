import {
  searchAnchorPlaces,
  type ProviderAnchorSearchDiagnosticResult,
  type ProviderAnchorSearchObservationResult,
} from '../providers/ProviderAdapter'
import {
  buildAdmittedVenueIdentityRouteSupplyRawPlaces,
  buildVenueIdentityAdmissionDiagnostics,
  type BearingsVenueIdentityAdmissionResult,
} from '../bearings/buildVenueIdentityAdmission'
import { resolveFieldInterpretationVenueIdentityHandoffs } from '../field/resolveFieldInterpretationVenueIdentityHandoffs'
import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import { resolveCanonicalVenueIdForProviderRecord } from '../providers/providerCanonicalVenueMapping'
import { isDevOrSandboxCloseoutFlow } from '../sources/getSourceMode'
import { curatedVenues } from '../../data/venues'
import type { StaticCanonicalVenueIdentity } from '../interpretation/venueIdentity'
import type { LivePlaceKind } from '../sources/buildLiveQueryPlan'
import type {
  BearingsVenueIdentityAdmissionObservationDiagnostic,
  FieldInterpretationVenueIdentityHandoff,
} from '../types/diagnostics'
import type { RawPlace } from '../types/rawPlace'
import type { SourceMode } from '../types/sourceMode'
import type { Venue } from '../types/venue'

export type AnchorSearchChip = 'restaurant' | 'movie' | 'drinks' | 'park' | 'activity'

export interface SelectableAnchorSearchResult {
  kind: 'selectable'
  diagnosticOnly: false
  routeIdentityEligible: true
  identity: {
    admission?: BearingsVenueIdentityAdmissionObservationDiagnostic
    duplicateGroupMemberSourceIdentities: string[]
    fieldSourceIdentity?: string
    handoff?: FieldInterpretationVenueIdentityHandoff
    inputSource: 'static_curated' | 'provider_observation'
    resolvedBaseVenueId: string
  }
  venue: Venue
  subtitle: string
}

export interface DiagnosticAnchorSearchResult {
  kind: 'diagnostic'
  diagnosticOnly: true
  routeIdentityEligible: false
  disposition: {
    admission?: BearingsVenueIdentityAdmissionObservationDiagnostic
    drop?: ProviderAnchorSearchDiagnosticResult
    fieldSourceIdentity?: string
    handoff?: FieldInterpretationVenueIdentityHandoff
    reason: string
  }
  subtitle: string
}

export type AnchorSearchResult = SelectableAnchorSearchResult | DiagnosticAnchorSearchResult

export function isSelectableAnchorSearchResult(
  result: AnchorSearchResult,
): result is SelectableAnchorSearchResult {
  return result.kind === 'selectable' && result.routeIdentityEligible && !result.diagnosticOnly
}

export function assertSelectableAnchorSearchResult(
  result: AnchorSearchResult,
): SelectableAnchorSearchResult {
  if (!isSelectableAnchorSearchResult(result)) {
    throw new Error('Diagnostic-only anchor search result cannot be selected.')
  }
  return result
}

const googleFieldMask = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
  'places.liveMusic',
  'places.servesBeer',
  'places.servesWine',
  'places.goodForGroups',
  'places.goodForChildren',
  'places.allowsDogs',
  'places.servesVegetarianFood',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
  'places.editorialSummary',
  'places.businessStatus',
  'places.currentOpeningHours.openNow',
  'places.currentOpeningHours.weekdayDescriptions',
  'places.currentOpeningHours.periods',
  'places.priceLevel',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.regularOpeningHours.periods',
  'places.rating',
  'places.userRatingCount',
  'places.utcOffsetMinutes',
  'places.websiteUri',
  'places.location',
].join(',')

function normalizeCity(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\./g, '')
  const [head] = normalized.split(',')
  return (head ?? normalized).trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function mapChipToQueryHint(chip?: AnchorSearchChip): string | undefined {
  if (chip === 'restaurant') {
    return 'restaurant'
  }
  if (chip === 'movie') {
    return 'movie theater'
  }
  if (chip === 'drinks') {
    return 'cocktail bar'
  }
  if (chip === 'park') {
    return 'park'
  }
  if (chip === 'activity') {
    return 'activity'
  }
  return undefined
}

function buildTextQuery(
  query: string,
  city: string,
  neighborhood?: string,
  chip?: AnchorSearchChip,
): string {
  const locationLabel = neighborhood ? `${neighborhood}, ${city}` : city
  const hint = mapChipToQueryHint(chip)
  return hint ? `${query} ${hint} in ${locationLabel}` : `${query} in ${locationLabel}`
}

function mapChipToRequestedKind(chip?: AnchorSearchChip): LivePlaceKind {
  if (chip === 'drinks') {
    return 'bar'
  }
  if (chip === 'park') {
    return 'park'
  }
  if (chip === 'movie' || chip === 'activity') {
    return 'activity'
  }
  return 'restaurant'
}

function buildAnchorQueryTerms(query: string, chip?: AnchorSearchChip): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .slice(0, 4)
  const chipHint = mapChipToQueryHint(chip)
  return unique(chipHint ? [...terms, chipHint] : terms)
}

function scoreFallbackVenue(
  venue: Venue,
  query: string,
  chip?: AnchorSearchChip,
): number {
  const normalizedQuery = query.trim().toLowerCase()
  const haystack = [
    venue.name,
    venue.category,
    venue.subcategory,
    venue.shortDescription,
    ...venue.tags,
  ]
    .join(' ')
    .toLowerCase()
  const nameMatch = venue.name.toLowerCase().includes(normalizedQuery) ? 4 : 0
  const textMatch = haystack.includes(normalizedQuery) ? 2 : 0
  const chipMatch =
    chip === 'drinks'
      ? venue.category === 'bar'
      : chip === 'restaurant'
        ? venue.category === 'restaurant'
        : chip === 'park'
          ? venue.category === 'park'
          : chip === 'movie' || chip === 'activity'
            ? venue.category === 'activity' || venue.category === 'event' || venue.category === 'museum'
            : false
  return nameMatch + textMatch + (chipMatch ? 1 : 0)
}

function searchFallbackVenues(
  query: string,
  city: string,
  neighborhood?: string,
  chip?: AnchorSearchChip,
): AnchorSearchResult[] {
  return curatedVenues
    .filter((venue) => normalizeCity(venue.city) === normalizeCity(city))
    .filter((venue) => !neighborhood || venue.neighborhood.toLowerCase().includes(neighborhood.toLowerCase()))
    .map((venue) => ({
      venue,
      score: scoreFallbackVenue(venue, query, chip),
      subtitle: `${venue.neighborhood} - ${venue.category.replace('_', ' ')}`,
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.venue.driveMinutes - right.venue.driveMinutes)
    .slice(0, 6)
    .map(({ venue, subtitle }) => ({
      kind: 'selectable',
      diagnosticOnly: false,
      routeIdentityEligible: true,
      identity: {
        duplicateGroupMemberSourceIdentities: [venue.id],
        inputSource: 'static_curated',
        resolvedBaseVenueId: venue.id,
      },
      venue,
      subtitle,
    }))
}

function buildStaticCanonicalsForResolution(): StaticCanonicalVenueIdentity[] {
  return curatedVenues.map((venue) => ({
    baseVenueId: venue.id,
    categoryFamily: venue.category,
    coordinates:
      typeof venue.source.latitude === 'number' && typeof venue.source.longitude === 'number'
        ? {
            lat: venue.source.latitude,
            lng: venue.source.longitude,
          }
        : undefined,
    formattedAddress: venue.source.formattedAddress,
    name: venue.name,
    providerRecordIds: venue.source.providerRecordId ? [venue.source.providerRecordId] : [],
  }))
}

function buildIdentityInputs(
  observations: ProviderAnchorSearchObservationResult[],
  staticCanonicalsForResolution = buildStaticCanonicalsForResolution(),
): Parameters<typeof resolveFieldInterpretationVenueIdentityHandoffs>[0] {
  return observations.map((observation) => ({
    rawPlace: observation.rawPlace,
    canonicalMapping: resolveCanonicalVenueIdForProviderRecord({
      provider: 'google-places',
      providerRecordId: observation.providerRecordId,
      staticVenues: curatedVenues,
    }),
    staticCanonicalsForResolution,
  }))
}

function materializeSelectableProviderAnchors(params: {
  admissionResult: BearingsVenueIdentityAdmissionResult
  handoffsByFieldSourceIdentity: Map<string, FieldInterpretationVenueIdentityHandoff>
  observations: ProviderAnchorSearchObservationResult[]
}): SelectableAnchorSearchResult[] {
  const observationByFieldSourceIdentity = new Map(
    params.observations.map((observation) => [observation.fieldSourceIdentity, observation]),
  )
  const admittedRouteSupply = buildAdmittedVenueIdentityRouteSupplyRawPlaces({
    admissionResult: params.admissionResult,
    rawPlaces: params.observations.map((observation) => observation.rawPlace),
  })
  const routeRawPlaceById = new Map(admittedRouteSupply.rawPlaces.map((rawPlace) => [rawPlace.id, rawPlace]))

  return params.admissionResult.groups.flatMap((group) => {
    const representativeObservation = observationByFieldSourceIdentity.get(
      group.representativeFieldSourceIdentity,
    )
    const materializedRawPlace = routeRawPlaceById.get(group.resolvedBaseVenueId)
    if (!representativeObservation || !materializedRawPlace) {
      return []
    }
    const admission = params.admissionResult.observationsByFieldSourceIdentity.get(
      group.representativeFieldSourceIdentity,
    )
    if (!admission?.routeIdentityEligible || admission.diagnosticOnly) {
      return []
    }
    const handoff = params.handoffsByFieldSourceIdentity.get(group.representativeFieldSourceIdentity)
    return [{
      kind: 'selectable' as const,
      diagnosticOnly: false as const,
      routeIdentityEligible: true as const,
      identity: {
        admission,
        duplicateGroupMemberSourceIdentities: group.memberFieldSourceIdentities,
        fieldSourceIdentity: group.representativeFieldSourceIdentity,
        ...(handoff ? { handoff } : {}),
        inputSource: 'provider_observation' as const,
        resolvedBaseVenueId: group.resolvedBaseVenueId,
      },
      venue: normalizeRawPlace(materializedRawPlace),
      subtitle: representativeObservation.subtitle,
    }]
  })
}

function buildDiagnosticProviderAnchorResults(params: {
  admissionResult: BearingsVenueIdentityAdmissionResult
  drops: ProviderAnchorSearchDiagnosticResult[]
  handoffsByFieldSourceIdentity: Map<string, FieldInterpretationVenueIdentityHandoff>
}): DiagnosticAnchorSearchResult[] {
  const materializedFieldSourceIdentities = new Set(
    params.admissionResult.groups.map((group) => group.representativeFieldSourceIdentity),
  )
  const diagnosticAdmissions = params.admissionResult.observations.filter(
    (observation) =>
      observation.diagnosticOnly ||
      !observation.routeIdentityEligible ||
      !materializedFieldSourceIdentities.has(observation.fieldSourceIdentity),
  )
  return [
    ...diagnosticAdmissions.map((admission) => {
      const handoff = params.handoffsByFieldSourceIdentity.get(admission.fieldSourceIdentity)
      return {
        kind: 'diagnostic' as const,
        diagnosticOnly: true as const,
        routeIdentityEligible: false as const,
        disposition: {
          admission,
          fieldSourceIdentity: admission.fieldSourceIdentity,
          ...(handoff ? { handoff } : {}),
          reason: admission.routeAdmissionStatus,
        },
        subtitle:
          admission.retainedFieldEvidence.formattedAddress ??
          admission.retainedFieldEvidence.neighborhood ??
          admission.retainedFieldEvidence.city ??
          admission.retainedFieldEvidence.name,
      }
    }),
    ...params.drops.map((drop) => ({
      kind: 'diagnostic' as const,
      diagnosticOnly: true as const,
      routeIdentityEligible: false as const,
      disposition: {
        drop,
        reason: drop.dropReason,
      },
      subtitle: drop.subtitle,
    })),
  ]
}

export function materializeProviderAnchorSearchResults(
  providerResults: Array<ProviderAnchorSearchObservationResult | ProviderAnchorSearchDiagnosticResult>,
  options?: {
    staticCanonicalsForResolution?: StaticCanonicalVenueIdentity[]
  },
): AnchorSearchResult[] {
  const observations = providerResults.filter(
    (result): result is ProviderAnchorSearchObservationResult => result.kind === 'raw_observation',
  )
  const drops = providerResults.filter(
    (result): result is ProviderAnchorSearchDiagnosticResult => result.kind === 'field_diagnostic',
  )
  if (observations.length === 0) {
    return buildDiagnosticProviderAnchorResults({
      admissionResult: {
        groups: [],
        observations: [],
        observationsByFieldSourceIdentity: new Map(),
      },
      drops,
      handoffsByFieldSourceIdentity: new Map(),
    })
  }

  const handoffsByFieldSourceIdentity = resolveFieldInterpretationVenueIdentityHandoffs(
    buildIdentityInputs(observations, options?.staticCanonicalsForResolution),
  )
  const admissionResult = buildVenueIdentityAdmissionDiagnostics(
    handoffsByFieldSourceIdentity.values(),
  )
  return [
    ...materializeSelectableProviderAnchors({
      admissionResult,
      handoffsByFieldSourceIdentity,
      observations,
    }),
    ...buildDiagnosticProviderAnchorResults({
      admissionResult,
      drops,
      handoffsByFieldSourceIdentity,
    }),
  ]
}

export async function searchAnchorVenues(input: {
  query: string
  city: string
  neighborhood?: string
  chip?: AnchorSearchChip
  sourceMode?: SourceMode
}): Promise<AnchorSearchResult[]> {
  const trimmedQuery = input.query.trim()
  if (trimmedQuery.length < 2) {
    return []
  }

  if (isDevOrSandboxCloseoutFlow()) {
    return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip)
  }

  try {
    const googleResults = await searchAnchorPlaces({
      city: input.city,
      fieldMask: googleFieldMask,
      neighborhood: input.neighborhood,
      pageSize: 6,
      queryTerms: buildAnchorQueryTerms(trimmedQuery, input.chip),
      requestedKind: mapChipToRequestedKind(input.chip),
      sourceMode: input.sourceMode ?? 'curated',
      textQuery: buildTextQuery(trimmedQuery, input.city, input.neighborhood, input.chip),
    })
    if (googleResults.results.length > 0) {
      const providerAnchors = materializeProviderAnchorSearchResults(googleResults.results)
      return providerAnchors.some(isSelectableAnchorSearchResult)
        ? providerAnchors
        : [
            ...providerAnchors,
            ...searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip),
          ]
    }
  } catch (error) {
    void error
  }

  return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip)
}
