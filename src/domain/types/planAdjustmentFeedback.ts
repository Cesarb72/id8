export type PlanAdjustmentEffectStrength = 'minor' | 'moderate' | 'strong'

export interface PlanAdjustmentFeedback {
  headline: string
  changeSummary: string[]
  trustNotes: string[]
  effectStrength: PlanAdjustmentEffectStrength
}
