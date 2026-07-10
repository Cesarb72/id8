import type { PersonaMode, VibeAnchor } from '../../types/intent'
import type {
  TasteExperienceArchetype,
  TasteExperienceFamily,
  TasteRole,
  TasteVenueCategory,
} from './types'

/**
 * Canonical venue identity for route-level Taste meaning verdicts.
 *
 * Values must come from ScoredVenue.candidateIdentity.baseVenueId, typically
 * via getScoredVenueBaseVenueId/getArcStopBaseVenueId. Do not use provider
 * ids, display names, or rendered labels for this identity.
 */
export type TasteRouteMeaningVenueId = string

export type TasteRouteMeaningVerdictSource = 'taste'

export type TasteRouteMeaningComparableValue = number | string | boolean

export interface TasteRouteMeaningProvenance {
  source: TasteRouteMeaningVerdictSource
  key: string
  label?: string
  reason?: string
}

export interface TasteRouteMeaningSignalComponent<
  TValue extends TasteRouteMeaningComparableValue = number,
> extends TasteRouteMeaningProvenance {
  value: TValue
  weight?: number
  contribution?: number
}

export type TasteRouteMeaningFitStrength =
  | 'strong'
  | 'medium'
  | 'light'
  | 'weak'
  | 'conflict'
  | 'unknown'

export type TasteRouteMeaningCompatibilityStatus =
  | 'compatible'
  | 'partial'
  | 'conflict'
  | 'unknown'

export type TasteRouteMeaningStopRole = TasteRole

export interface TasteRouteMeaningScoreVerdict {
  score?: number
  strength: TasteRouteMeaningFitStrength
  reasons?: readonly string[]
  components?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningConflict {
  code: string
  severity: 'low' | 'medium' | 'high'
  reason?: string
  candidateVenueId?: TasteRouteMeaningVenueId
  evidence?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningStrength {
  code: string
  strength: TasteRouteMeaningFitStrength
  reason?: string
  candidateVenueId?: TasteRouteMeaningVenueId
  evidence?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningRoleStopVerdict {
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  roleFit: TasteRouteMeaningScoreVerdict
  shapeFit?: TasteRouteMeaningScoreVerdict
  lowRoleReasons?: readonly string[]
  conflictEvidence?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningPersonaVerdict {
  requestedPersona?: PersonaMode
  dominantPersona?: PersonaMode | 'mixed' | 'unknown'
  dominantPersonaFit: TasteRouteMeaningScoreVerdict
  routeFitByPersona: Partial<Record<PersonaMode, TasteRouteMeaningScoreVerdict>>
  personaConflicts?: readonly TasteRouteMeaningConflict[]
  personaStrengths?: readonly TasteRouteMeaningStrength[]
}

export interface TasteRouteMeaningRoleVerdict {
  routeRoleFit: TasteRouteMeaningScoreVerdict
  stopRoleFit: readonly TasteRouteMeaningRoleStopVerdict[]
  roleSuitability: Partial<Record<TasteRouteMeaningStopRole, TasteRouteMeaningScoreVerdict>>
  lowRoleReasons?: readonly string[]
  roleConflictEvidence?: readonly TasteRouteMeaningSignalComponent[]
  roleRightReady?: boolean
}

export interface TasteRouteMeaningIntentVerdict {
  routeIntentFit: TasteRouteMeaningScoreVerdict
  lensCompatibility?: TasteRouteMeaningScoreVerdict
  contextSpecificity?: TasteRouteMeaningScoreVerdict
  occasionFit?: TasteRouteMeaningScoreVerdict
  objectiveFit?: TasteRouteMeaningScoreVerdict
  intentRightReady?: boolean
}

export interface TasteRouteMeaningVibeVerdict {
  requestedPrimaryVibe?: VibeAnchor
  requestedSecondaryVibes?: readonly VibeAnchor[]
  vibeCoherence: TasteRouteMeaningScoreVerdict
  highlightVibeFit?: TasteRouteMeaningScoreVerdict
  supportStopVibeFit?: TasteRouteMeaningScoreVerdict
  vibeConflicts?: readonly TasteRouteMeaningConflict[]
  vibeStrengths?: readonly TasteRouteMeaningStrength[]
}

export interface TasteRouteMeaningCategoryVerdict {
  categoryMeaning: TasteRouteMeaningScoreVerdict
  categoryDiversity?: TasteRouteMeaningScoreVerdict
  repeatedCategories?: readonly TasteVenueCategory[]
  dominantCategories?: readonly TasteVenueCategory[]
  hospitalityMix?: Partial<Record<TasteExperienceArchetype, number>>
  categoryConflicts?: readonly TasteRouteMeaningConflict[]
}

export interface TasteRouteMeaningSocialVerdict {
  friendsSocialFit: TasteRouteMeaningScoreVerdict
  easyHangCompatibility?: TasteRouteMeaningCompatibilityStatus
  groupSocialMomentum?: TasteRouteMeaningScoreVerdict
  conversationSuitability?: TasteRouteMeaningScoreVerdict
  socialEnergy?: TasteRouteMeaningScoreVerdict
  groupAssemblyEvidence?: readonly TasteRouteMeaningSignalComponent[]
  socialConflicts?: readonly TasteRouteMeaningConflict[]
  socialStrengths?: readonly TasteRouteMeaningStrength[]
}

export interface TasteRouteMeaningRomanticVerdict {
  romanticRouteFit: TasteRouteMeaningScoreVerdict
  romanticHighlightSuitability?: TasteRouteMeaningScoreVerdict
  dateFormalityEvidence?: readonly TasteRouteMeaningSignalComponent[]
  romanticConflicts?: readonly TasteRouteMeaningConflict[]
  romanticStrengths?: readonly TasteRouteMeaningStrength[]
}

export interface TasteRouteMeaningFamilyVerdict {
  familyRouteFit: TasteRouteMeaningScoreVerdict
  familyCompatibility?: TasteRouteMeaningCompatibilityStatus
  boundedEnergyEvidence?: readonly TasteRouteMeaningSignalComponent[]
  nightlifeConflicts?: readonly TasteRouteMeaningConflict[]
  dateFormalityConflicts?: readonly TasteRouteMeaningConflict[]
  familyConflicts?: readonly TasteRouteMeaningConflict[]
  familyStrengths?: readonly TasteRouteMeaningStrength[]
}

export interface TasteRouteMeaningCompatibility {
  arcScoreBreakdown?: Record<string, TasteRouteMeaningComparableValue>
  rolePoolDiagnostics?: Record<string, TasteRouteMeaningComparableValue>
  greatStopRoleRightInputs?: Record<string, TasteRouteMeaningComparableValue>
  greatStopIntentRightInputs?: Record<string, TasteRouteMeaningComparableValue>
  debugSummaries?: readonly string[]
  testSummaries?: readonly string[]
}

export interface TasteRouteMeaningStopEvidence {
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  experienceFamily?: TasteExperienceFamily
  primaryExperienceArchetype?: TasteExperienceArchetype
  category?: TasteVenueCategory
  components?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningVerdict {
  source: TasteRouteMeaningVerdictSource
  provenance: readonly TasteRouteMeaningProvenance[]
  stops?: readonly TasteRouteMeaningStopEvidence[]
  personaVerdict: TasteRouteMeaningPersonaVerdict
  roleVerdict: TasteRouteMeaningRoleVerdict
  intentVerdict: TasteRouteMeaningIntentVerdict
  vibeVerdict: TasteRouteMeaningVibeVerdict
  categoryVerdict: TasteRouteMeaningCategoryVerdict
  socialVerdict: TasteRouteMeaningSocialVerdict
  romanticVerdict: TasteRouteMeaningRomanticVerdict
  familyVerdict: TasteRouteMeaningFamilyVerdict
  compatibility?: TasteRouteMeaningCompatibility
}
