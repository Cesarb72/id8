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
]
