export interface LiveProviderEnvelope {
  liveProviderAllowed?: boolean
  maxProviderCalls?: number
  maxQueryLabels?: number
  maxCenters?: number
}

export const CLOSED_PREVIEW_LIVE_ENVELOPE: LiveProviderEnvelope = {
  liveProviderAllowed: false,
  maxProviderCalls: 0,
  maxQueryLabels: 0,
  maxCenters: 0,
}
