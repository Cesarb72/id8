import type {
  BuiltScenarioStopPosition,
  StarterSemanticEvidence,
  StarterSemanticEvidenceKind,
  StarterSemanticEvidenceMatch,
  StarterSemanticEvidenceMatchType,
  StarterSemanticEvidenceSourceScope,
  StarterSemanticRepresentation,
} from '../../../domain/interpretation/construction/scenarioBuilder'
import type { StopType } from '../../../domain/interpretation/discovery/stopTypeCandidateBoard'

export const coffeeBooksSemanticRepresentationMissingReason =
  'coffee_books_semantic_representation_missing' as const

export type CoffeeBooksSemanticEvidenceField =
  | 'displayName'
  | 'name'
  | 'venueName'
  | 'category'
  | 'subcategory'
  | 'venueCategory'
  | 'venueSubcategory'
  | 'providerCategory'
  | 'providerType'
  | 'sourceType'
  | 'sourceLabel'
  | 'tag'
  | 'tags'
  | 'sourceTypes'
  | 'vibeTag'
  | 'routeStory'
  | 'scenarioFamily'
  | 'starterText'
  | 'culturalAnchorPotential'
  | 'bodyText'
  | string

export interface CoffeeBooksSemanticEvidencePart {
  field: CoffeeBooksSemanticEvidenceField
  value: string | string[] | undefined | null
  sourceScope?: StarterSemanticEvidenceSourceScope
}

export interface CoffeeBooksSemanticRouteStopInput {
  venueId: string
  name: string
  position: BuiltScenarioStopPosition
  stopType?: StopType
  evidenceParts: CoffeeBooksSemanticEvidencePart[]
}

const selectedStopAdmissibleFields = new Set<CoffeeBooksSemanticEvidenceField>([
  'displayName',
  'name',
  'venueName',
  'category',
  'subcategory',
  'venueCategory',
  'venueSubcategory',
  'providerCategory',
  'providerType',
  'sourceType',
  'sourceLabel',
  'tag',
  'tags',
  'sourceTypes',
])

const coffeeBooksExplicitSemanticMatchers: Array<{
  evidenceType: StarterSemanticEvidenceKind
  terms: string[]
}> = [
  { evidenceType: 'book', terms: ['book', 'books'] },
  { evidenceType: 'reading', terms: ['reading'] },
  { evidenceType: 'literary', terms: ['literary'] },
  { evidenceType: 'library', terms: ['library'] },
  { evidenceType: 'bookstore', terms: ['bookstore', 'book store', 'book shop', 'bookshop'] },
  { evidenceType: 'museum', terms: ['museum'] },
  { evidenceType: 'gallery', terms: ['gallery', 'art gallery'] },
  { evidenceType: 'art', terms: ['art'] },
  { evidenceType: 'exhibit', terms: ['exhibit', 'exhibition'] },
  { evidenceType: 'cultural', terms: ['cultural center', 'cultural venue'] },
]

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function flattenEvidenceValues(value: string | string[] | undefined | null): string[] {
  const values = Array.isArray(value) ? value : [value]
  return values.filter((entry): entry is string => Boolean(entry?.trim()))
}

function findSemanticTermMatch(
  rawValue: string,
): {
  evidenceType: StarterSemanticEvidenceKind
  normalizedTerm: string
  matchType: StarterSemanticEvidenceMatchType
}[] {
  const normalizedValue = normalizeToken(rawValue)
  if (!normalizedValue) {
    return []
  }
  const tokens = new Set(normalizedValue.split(' ').filter(Boolean))
  const matches: {
    evidenceType: StarterSemanticEvidenceKind
    normalizedTerm: string
    matchType: StarterSemanticEvidenceMatchType
  }[] = []
  for (const matcher of coffeeBooksExplicitSemanticMatchers) {
    for (const term of matcher.terms) {
      const normalizedTerm = normalizeToken(term)
      const matchType: StarterSemanticEvidenceMatchType = normalizedTerm.includes(' ')
        ? 'phrase'
        : 'token'
      const matched =
        matchType === 'phrase'
          ? normalizedValue.includes(normalizedTerm)
          : tokens.has(normalizedTerm)
      if (matched) {
        matches.push({
          evidenceType: matcher.evidenceType,
          normalizedTerm,
          matchType,
        })
      }
    }
  }
  return matches
}

function isAdmissibleSelectedStopField(
  part: CoffeeBooksSemanticEvidencePart,
): boolean {
  const sourceScope = part.sourceScope ?? 'selected_stop_field'
  return sourceScope === 'selected_stop_field' && selectedStopAdmissibleFields.has(part.field)
}

export function collectCoffeeBooksSemanticEvidenceMatchesFromRouteStop(
  stop: CoffeeBooksSemanticRouteStopInput,
): StarterSemanticEvidenceMatch[] {
  const explicitStopNamePart: CoffeeBooksSemanticEvidencePart = {
    field: 'displayName',
    value: stop.name,
    sourceScope: 'selected_stop_field',
  }
  return [explicitStopNamePart, ...stop.evidenceParts].flatMap((part) => {
    const sourceScope = part.sourceScope ?? 'selected_stop_field'
    const admissibleField = isAdmissibleSelectedStopField(part)
    return flattenEvidenceValues(part.value).flatMap((rawValue) =>
      findSemanticTermMatch(rawValue).map((match) => ({
        stopVenueId: stop.venueId,
        stopName: stop.name,
        field: part.field,
        rawValue,
        normalizedTerm: match.normalizedTerm,
        evidenceType: match.evidenceType,
        matchType: match.matchType,
        sourceScope,
        admissible: admissibleField,
      })),
    )
  })
}

export function collectCoffeeBooksSemanticEvidenceFromRouteStop(
  stop: CoffeeBooksSemanticRouteStopInput,
): StarterSemanticEvidence[] {
  const admissibleMatches = collectCoffeeBooksSemanticEvidenceMatchesFromRouteStop(stop).filter(
    (match) => match.admissible,
  )
  if (admissibleMatches.length === 0) {
    return []
  }
  return [
    {
      starterPackId: 'coffee-books',
      venueId: stop.venueId,
      name: stop.name,
      position: stop.position,
      stopType: stop.stopType ?? 'atmospheric_experience',
      evidenceTypes: [...new Set(admissibleMatches.map((match) => match.evidenceType))],
      matchedTerms: [...new Set(admissibleMatches.map((match) => match.normalizedTerm))],
      matches: admissibleMatches,
      source: 'selected_route_stop',
    },
  ]
}

export function buildCoffeeBooksSemanticRepresentationFromRouteStops(
  stops: CoffeeBooksSemanticRouteStopInput[],
): StarterSemanticRepresentation {
  const matchedEvidence = stops.flatMap(collectCoffeeBooksSemanticEvidenceMatchesFromRouteStop)
  const evidence = stops.flatMap(collectCoffeeBooksSemanticEvidenceFromRouteStop)
  if (evidence.length > 0) {
    return {
      starterPackId: 'coffee-books',
      status: 'represented',
      evidence,
      matchedEvidence,
    }
  }
  return {
    starterPackId: 'coffee-books',
    status: 'missing',
    evidence: [],
    matchedEvidence,
    rejectionReasons: [coffeeBooksSemanticRepresentationMissingReason],
  }
}

export function hasCoffeeBooksSemanticRepresentationFromRouteStops(
  stops: CoffeeBooksSemanticRouteStopInput[],
): boolean {
  return buildCoffeeBooksSemanticRepresentationFromRouteStops(stops).status === 'represented'
}
