import type { LiveDataProvider } from '../types/sourceMode'
import type { ProviderCanonicalMatchMethod } from './providerCanonicalVenueMapping'

export interface ProviderCanonicalVenueSeed {
  provider: Extract<LiveDataProvider, 'google-places'>
  providerRecordId: string
  canonicalVenueId: string
  confidence: number
  matchMethod: Extract<ProviderCanonicalMatchMethod, 'manual_seed'>
}

export const providerCanonicalVenueSeeds: ProviderCanonicalVenueSeed[] = [
  {
    provider: 'google-places',
    providerRecordId: 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
    canonicalVenueId: 'sj-paper-plane',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJkV6TlrDMj4ARIPxsqSMrdr4',
    canonicalVenueId: 'sj-haberdasher',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJR8HI1brMj4ARBnFq5rlvpx4',
    canonicalVenueId: 'sj-tech-interactive',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJC797reHMj4ARSaQDCMuHWSQ',
    canonicalVenueId: 'sj-adega-wine-atelier',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJ399WwE7Nj4ARngCc39Ai0Hw',
    canonicalVenueId: 'sj-miniboss',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJ36tnEywzjoARhS4v9dlu5EU',
    canonicalVenueId: 'sj-happy-hollow',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJsSB7paktjoARICgN717BTP4',
    canonicalVenueId: 'sj-evergreen-coffee-company',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJsSB7paktjoARQkvhs1bkjTI',
    canonicalVenueId: 'sj-village-grill',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
  {
    provider: 'google-places',
    providerRecordId: 'ChIJ-ZogKrvMj4ARKrML-5D1a88',
    canonicalVenueId: 'sj-alum-rock-park',
    confidence: 1,
    matchMethod: 'manual_seed',
  },
]
