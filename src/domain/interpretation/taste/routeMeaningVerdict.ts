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
  TValue extends TasteRouteMeaningComparableValue = TasteRouteMeaningComparableValue,
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
  lowShapeReasons?: readonly string[]
  roleRightReasons?: readonly string[]
  conflictEvidence?: readonly TasteRouteMeaningSignalComponent[]
}

export type TasteRouteMeaningRoleRightStatus = 'pass' | 'fail' | 'unknown'

export interface TasteRouteMeaningRoleRightFailureEvidence {
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  reason: string
  score?: number
  threshold: number
  evidenceType: 'low_role_fit' | 'low_shape_fit'
  components?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningRoleRightVerdict {
  status: TasteRouteMeaningRoleRightStatus
  ready: boolean
  reasons: readonly string[]
  roleFitThreshold: number
  shapeFitThreshold: number
  lowRoleEvidence: readonly TasteRouteMeaningRoleRightFailureEvidence[]
  lowShapeEvidence: readonly TasteRouteMeaningRoleRightFailureEvidence[]
  stopEvidence: readonly TasteRouteMeaningRoleStopVerdict[]
}

export type TasteRouteMeaningIntentRightStatus = 'pass' | 'fail' | 'unknown'

export type TasteRouteMeaningIntentRightFailureEvidenceType =
  | 'low_fit'
  | 'low_lens_compatibility'
  | 'low_context_specificity'

export interface TasteRouteMeaningIntentRightFailureEvidence {
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  reason: string
  score?: number
  threshold: number
  evidenceType: TasteRouteMeaningIntentRightFailureEvidenceType
  components?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningIntentStopVerdict {
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  routeFit?: TasteRouteMeaningScoreVerdict
  lensCompatibility?: TasteRouteMeaningScoreVerdict
  contextSpecificity?: TasteRouteMeaningScoreVerdict
  lowFitReasons?: readonly string[]
  lowLensCompatibilityReasons?: readonly string[]
  lowContextSpecificityReasons?: readonly string[]
  intentRightReasons?: readonly string[]
  conflictEvidence?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningIntentRightVerdict {
  status: TasteRouteMeaningIntentRightStatus
  ready: boolean
  reasons: readonly string[]
  routeFitThreshold: number
  lensCompatibilityThreshold: number
  contextSpecificityThreshold: number
  lowFitEvidence: readonly TasteRouteMeaningIntentRightFailureEvidence[]
  lowLensCompatibilityEvidence: readonly TasteRouteMeaningIntentRightFailureEvidence[]
  lowContextSpecificityEvidence: readonly TasteRouteMeaningIntentRightFailureEvidence[]
  stopEvidence: readonly TasteRouteMeaningIntentStopVerdict[]
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
  lowShapeReasons?: readonly string[]
  roleConflictEvidence?: readonly TasteRouteMeaningSignalComponent[]
  roleRightReady?: boolean
  roleRightVerdict?: TasteRouteMeaningRoleRightVerdict
}

export interface TasteRouteMeaningIntentVerdict {
  routeIntentFit: TasteRouteMeaningScoreVerdict
  lensCompatibility?: TasteRouteMeaningScoreVerdict
  contextSpecificity?: TasteRouteMeaningScoreVerdict
  occasionFit?: TasteRouteMeaningScoreVerdict
  objectiveFit?: TasteRouteMeaningScoreVerdict
  stopIntentFit?: readonly TasteRouteMeaningIntentStopVerdict[]
  lowFitReasons?: readonly string[]
  lowLensCompatibilityReasons?: readonly string[]
  lowContextSpecificityReasons?: readonly string[]
  intentConflictEvidence?: readonly TasteRouteMeaningSignalComponent[]
  intentRightReady?: boolean
  intentRightVerdict?: TasteRouteMeaningIntentRightVerdict
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

export interface TasteRouteMeaningRolePoolEvidence {
  role?: TasteRouteMeaningStopRole
  candidateVenueId?: TasteRouteMeaningVenueId
  roleSuitability?: Partial<Record<TasteRouteMeaningStopRole, TasteRouteMeaningScoreVerdict>>
  easyHangCompatibility?: TasteRouteMeaningCompatibilityStatus
  easyHangActive?: boolean
  hardIncompatibleSignals?: readonly string[]
  socialEvidence?: readonly TasteRouteMeaningSignalComponent[]
  romanticEvidence?: readonly TasteRouteMeaningSignalComponent[]
  familyEvidence?: readonly TasteRouteMeaningSignalComponent[]
  categoryVibeEvidence?: readonly TasteRouteMeaningSignalComponent[]
}

export interface TasteRouteMeaningCompatibility {
  arcScoreBreakdown?: Record<string, TasteRouteMeaningComparableValue>
  rolePoolDiagnostics?: Record<string, TasteRouteMeaningComparableValue>
  rolePoolEvidence?: readonly TasteRouteMeaningRolePoolEvidence[]
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
