import type {
  ExperienceLens,
  LensBias,
  LensEnergy,
  LensStopRole,
  LensTone,
  MovementTolerance,
  StopShapeProfile,
} from './experienceLens'
import type { DistanceMode, PersonaMode, VibeAnchor } from './intent'
import type { RoleContractStrength } from './roleContract'
import type { VenueCategory } from './venue'

export type StarterPackStopShapeOverrides = Partial<
  Record<LensStopRole, Partial<StopShapeProfile>>
>

export interface StarterPackLensPreset {
  lensTone?: LensTone
  energyBand?: LensEnergy[]
  discoveryBias?: LensBias
  movementTolerance?: MovementTolerance
  preferredCategories?: VenueCategory[]
  discouragedCategories?: VenueCategory[]
  preferredTags?: string[]
  discouragedTags?: string[]
  preferredStopShapes?: StarterPackStopShapeOverrides
  windDown?: Partial<ExperienceLens['windDownExpectation']>
}

export interface StarterPackRoleContract {
  strength: RoleContractStrength
  requiredCategories?: VenueCategory[]
  preferredCategories?: VenueCategory[]
  discouragedCategories?: VenueCategory[]
  requiredTags?: string[]
  preferredTags?: string[]
  discouragedTags?: string[]
  maxEnergyLevel?: number
}

export type StarterPackRoleContractMap = Partial<
  Record<LensStopRole, StarterPackRoleContract>
>

export interface StarterPack {
  id: string
  title: string
  description: string
  personaBias?: PersonaMode
  primaryAnchor: VibeAnchor
  secondaryAnchors?: VibeAnchor[]
  distanceMode?: DistanceMode
  lensPreset?: StarterPackLensPreset
  roleContracts?: StarterPackRoleContractMap
}
