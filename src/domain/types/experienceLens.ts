import type { VenueCategory } from './venue'
import type { SelectedTasteMode } from '../taste/selectTasteMode'
import type { PersonaMode, PersonaSource, VibeAnchor } from './intent'

export type LensTone = 'intimate' | 'electric' | 'refined'
export type LensEnergy = 'low' | 'medium' | 'high'
export type LensBias = 'low' | 'medium' | 'high'
export type MovementTolerance = 'low' | 'medium' | 'high'
export type RepetitionTolerance = 'low' | 'medium' | 'high'
export type LensStopRole = 'start' | 'highlight' | 'surprise' | 'windDown'
export type PersonaContractHighlightType = 'activity' | 'scenic' | 'ambient'
export type ContractBlendMode = 'vibe_only' | 'aligned' | 'selective_energy' | 'tension'
export type ContractPriorityDriver = 'vibe' | 'persona' | 'balanced'

export interface StopShapeProfile {
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  preferredTags: string[]
  discouragedTags: string[]
  energyPreference: LensEnergy[]
}

export interface LensPersonaContract {
  persona: PersonaMode
  requiresMomentPresence: boolean
  requireMomentPresenceStrength: 'soft' | 'strong'
  preferredHighlightTypes: PersonaContractHighlightType[]
  discourageGenericHighlight: boolean
}

export interface ResolvedHighlightContract {
  requiresMomentPresence: boolean
  requireMomentPresenceStrength: 'none' | 'soft' | 'strong'
  preferredHighlightTypes: PersonaContractHighlightType[]
  discourageGenericHighlight: boolean
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  preferredTags: string[]
  discouragedTags: string[]
  energyPreference: LensEnergy[]
}

export interface ResolvedHospitalityContract {
  primaryVibe: VibeAnchor
  persona?: PersonaMode
  blendMode: ContractBlendMode
  compatibility: 'reinforcing' | 'tension'
  resolutionSummary: string
  priority: {
    highlightStructure: ContractPriorityDriver
    pacingEnergy: ContractPriorityDriver
    rolePreferences: ContractPriorityDriver
  }
  toneOverride?: LensTone
  movementToleranceOverride?: MovementTolerance
  movementToleranceCap?: MovementTolerance
  repetitionToleranceOverride?: RepetitionTolerance
  wildcardAggressivenessMin?: number
  wildcardAggressivenessMax?: number
  energyBandAdditions: LensEnergy[]
  energyBandRemovals: LensEnergy[]
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  preferredTags: string[]
  discouragedTags: string[]
  rolePreferences: Partial<Record<LensStopRole, Partial<StopShapeProfile>>>
  windDownExpectation: Partial<{
    preferredCategories: VenueCategory[]
    discouragedCategories: VenueCategory[]
    closeToBase: boolean
    maxEnergy: LensEnergy
  }>
  highlight: ResolvedHighlightContract
}

export interface ExperienceLens {
  tone: LensTone
  energyBand: LensEnergy[]
  discoveryBias: LensBias
  movementTolerance: MovementTolerance
  repetitionTolerance: RepetitionTolerance
  wildcardAggressiveness: number
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  preferredTags: string[]
  discouragedTags: string[]
  windDownExpectation: {
    preferredCategories: VenueCategory[]
    discouragedCategories: VenueCategory[]
    closeToBase: boolean
    maxEnergy: LensEnergy
  }
  preferredStopShapes: Record<LensStopRole, StopShapeProfile>
  tasteMode?: SelectedTasteMode
  personaContract?: LensPersonaContract
  resolvedContract?: ResolvedHospitalityContract
  interpretation?: {
    primaryVibe: VibeAnchor
    personaModifier?: PersonaMode
    personaSource: PersonaSource
    personaEffectSummary: string
  }
}
