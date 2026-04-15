export type PreviewDistanceTolerance = 'compact' | 'balanced' | 'open'
export type PreviewEnergyBias = 'softer' | 'balanced' | 'stronger'

export interface PreviewControls {
  districtPreference?: string
  startTime?: string
  distanceTolerance?: PreviewDistanceTolerance
  energyBias?: PreviewEnergyBias
}
