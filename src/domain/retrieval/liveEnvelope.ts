export interface LiveProviderEnvelope {
  liveProviderAllowed?: boolean
  maxProviderCalls?: number
  maxQueryLabels?: number
  maxCenters?: number
}

export interface LiveRetrievalPocketHint {
  pocketId: string
  pocketLabel: string
  centroid: { lat: number; lng: number }
  radiusM: number
  source: 'district_intelligence'
  city: string
  locationLabel?: string
}

export const CLOSED_PREVIEW_LIVE_ENVELOPE: LiveProviderEnvelope = {
  liveProviderAllowed: false,
  maxProviderCalls: 0,
  maxQueryLabels: 0,
  maxCenters: 0,
}

export const CLOSED_RUNTIME_LIVE_ENVELOPE: LiveProviderEnvelope = {
  liveProviderAllowed: false,
  maxProviderCalls: 0,
  maxQueryLabels: 0,
  maxCenters: 0,
}
