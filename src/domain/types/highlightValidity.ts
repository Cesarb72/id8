export type HighlightValidityLevel = 'valid' | 'fallback' | 'invalid'

export type HighlightCandidateTier = 'highlight-capable' | 'support-only' | 'connective-only'

export interface HighlightValidityEvaluation {
  validForIntent: boolean
  validityLevel: HighlightValidityLevel
  fallbackEligible: boolean
  candidateTier: HighlightCandidateTier
  packLiteralRequirementLabel?: string
  packLiteralRequirementSatisfied: boolean
  vetoReason?: string
  matchedSignals: string[]
  violations: string[]
  personaVetoes: string[]
  contextVetoes: string[]
}
