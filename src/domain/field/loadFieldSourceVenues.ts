import { curatedVenues } from '../../data/venues'
import {
  fetchHybridPortableVenues,
  type HybridPortableDiagnostics,
} from '../retrieval/hybridPortableAdapter'
import type { Venue } from '../types/venue'

export interface LoadFieldSourceVenuesInput {
  city?: string
}

export interface LoadFieldSourceVenuesResult {
  cityHint: string
  curatedCityVenues: Venue[]
  hasCuratedCoverage: boolean
  sourceVenues: Venue[]
  hybridDiagnostics?: HybridPortableDiagnostics
}

function normalizeCity(value: string | undefined): string {
  const token = (value ?? '').trim().toLowerCase().split(',')[0] ?? ''
  return token.replace(/\s+/g, ' ').trim()
}

export async function loadFieldSourceVenues(
  input: LoadFieldSourceVenuesInput,
): Promise<LoadFieldSourceVenuesResult> {
  const cityHint = normalizeCity(input.city)
  const curatedCityVenues =
    cityHint.length > 0
      ? curatedVenues.filter((venue) => normalizeCity(venue.city) === cityHint)
      : []
  const hasCuratedCoverage = curatedCityVenues.length >= 10

  if (!hasCuratedCoverage && cityHint.length > 0) {
    const hybrid = await fetchHybridPortableVenues(cityHint)
    return {
      cityHint,
      curatedCityVenues,
      hasCuratedCoverage,
      sourceVenues: hybrid.venues,
      hybridDiagnostics: hybrid.diagnostics,
    }
  }

  return {
    cityHint,
    curatedCityVenues,
    hasCuratedCoverage,
    sourceVenues: curatedCityVenues,
  }
}
