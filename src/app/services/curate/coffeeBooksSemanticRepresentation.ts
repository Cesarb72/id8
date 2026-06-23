import type {
  BuiltScenarioStopPosition,
  StarterSemanticEvidence,
  StarterSemanticEvidenceKind,
  StarterSemanticRepresentation,
} from '../../../domain/interpretation/construction/scenarioBuilder'
import type { StopType } from '../../../domain/interpretation/discovery/stopTypeCandidateBoard'

export const coffeeBooksSemanticRepresentationMissingReason =
  'coffee_books_semantic_representation_missing' as const

export interface CoffeeBooksSemanticRouteStopInput {
  venueId: string
  name: string
  position: BuiltScenarioStopPosition
  stopType?: StopType
  evidenceParts: Array<string | string[] | undefined | null>
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCorpus(parts: Array<string | string[] | undefined | null>): string {
  return normalizeToken(
    parts
      .flatMap((part) => (Array.isArray(part) ? part : [part]))
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' '),
  )
}

function corpusIncludesAny(corpus: string, terms: string[]): boolean {
  const tokens = new Set(corpus.split(' ').filter(Boolean))
  return terms.some((term) => {
    const normalizedTerm = normalizeToken(term)
    return normalizedTerm.includes(' ')
      ? corpus.includes(normalizedTerm)
      : tokens.has(normalizedTerm)
  })
}

const coffeeBooksExplicitSemanticMatchers: Array<{
  evidenceType: StarterSemanticEvidenceKind
  terms: string[]
}> = [
  { evidenceType: 'book', terms: ['book', 'books', 'bookshop'] },
  { evidenceType: 'reading', terms: ['reading', 'read'] },
  { evidenceType: 'literary', terms: ['literary', 'literature'] },
  { evidenceType: 'library', terms: ['library'] },
  { evidenceType: 'bookstore', terms: ['bookstore', 'book store', 'bookshop'] },
  { evidenceType: 'museum', terms: ['museum'] },
  { evidenceType: 'gallery', terms: ['gallery'] },
  { evidenceType: 'art', terms: ['art', 'arts'] },
  { evidenceType: 'exhibit', terms: ['exhibit', 'exhibition'] },
  { evidenceType: 'cultural', terms: ['cultural', 'culture', 'cultural venue'] },
]

export function collectCoffeeBooksSemanticEvidenceFromRouteStop(
  stop: CoffeeBooksSemanticRouteStopInput,
): StarterSemanticEvidence[] {
  const corpus = normalizeCorpus([stop.name, ...stop.evidenceParts])
  const evidenceTypes: StarterSemanticEvidenceKind[] = []
  const matchedTerms: string[] = []
  for (const matcher of coffeeBooksExplicitSemanticMatchers) {
    const matches = matcher.terms.filter((term) => corpusIncludesAny(corpus, [term]))
    if (matches.length === 0) {
      continue
    }
    evidenceTypes.push(matcher.evidenceType)
    matchedTerms.push(...matches)
  }
  if (evidenceTypes.length === 0) {
    return []
  }
  return [
    {
      starterPackId: 'coffee-books',
      venueId: stop.venueId,
      name: stop.name,
      position: stop.position,
      stopType: stop.stopType ?? 'atmospheric_experience',
      evidenceTypes: [...new Set(evidenceTypes)],
      matchedTerms: [...new Set(matchedTerms)],
      source: 'selected_route_stop',
    },
  ]
}

export function buildCoffeeBooksSemanticRepresentationFromRouteStops(
  stops: CoffeeBooksSemanticRouteStopInput[],
): StarterSemanticRepresentation {
  const evidence = stops.flatMap(collectCoffeeBooksSemanticEvidenceFromRouteStop)
  if (evidence.length > 0) {
    return {
      starterPackId: 'coffee-books',
      status: 'represented',
      evidence,
    }
  }
  return {
    starterPackId: 'coffee-books',
    status: 'missing',
    evidence: [],
    rejectionReasons: [coffeeBooksSemanticRepresentationMissingReason],
  }
}

export function hasCoffeeBooksSemanticRepresentationFromRouteStops(
  stops: CoffeeBooksSemanticRouteStopInput[],
): boolean {
  return buildCoffeeBooksSemanticRepresentationFromRouteStops(stops).status === 'represented'
}
