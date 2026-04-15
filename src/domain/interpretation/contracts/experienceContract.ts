import {
  getHospitalityScenarioContract,
  type HospitalityScenarioContract,
} from '../taste/scenarioContracts'

export type ExperienceCoordinationMode =
  | 'depth'
  | 'pulse'
  | 'narrative'
  | 'hang'
  | 'momentum'
  | 'balance'
  | 'play'
  | 'enrichment'

export type ExperienceHighlightModel =
  | 'single_peak'
  | 'multi_peak'
  | 'distributed'
  | 'earned_peak'
  | 'reflective_peak'

export type ExperienceMovementStyle =
  | 'contained'
  | 'exploratory'
  | 'compressed'
  | 'momentum_based'

export type ExperienceSocialPosture =
  | 'intimate'
  | 'shared_pulse'
  | 'group_social'
  | 'family_rhythm'
  | 'reflective'

export type ExperiencePacingStyle =
  | 'slow_build'
  | 'escalating'
  | 'deliberate'
  | 'elastic'
  | 'recovery_led'

export type ExperienceConstraintPriority =
  | 'tone_coherence'
  | 'friction_control'
  | 'capacity'
  | 'group_flow'
  | 'logistics'
  | 'recovery'

export type ExperienceContract = {
  city: string
  persona: string
  vibe: string
  coordinationMode: ExperienceCoordinationMode
  highlightModel: ExperienceHighlightModel
  movementStyle: ExperienceMovementStyle
  socialPosture: ExperienceSocialPosture
  pacingStyle: ExperiencePacingStyle
  constraintPriorities: ExperienceConstraintPriority[]
  scenarioId?: string
  notes?: string[]
}

type ExperienceContractLookupInput = {
  city?: string | null
  persona?: string | null
  vibe?: string | null
}

function buildRomanticExperienceContract(
  scenario: HospitalityScenarioContract,
): ExperienceContract {
  if (scenario.vibe === 'cozy') {
    return {
      city: scenario.city,
      persona: scenario.persona,
      vibe: scenario.vibe,
      coordinationMode: 'depth',
      highlightModel: 'earned_peak',
      movementStyle: 'contained',
      socialPosture: 'intimate',
      pacingStyle: 'slow_build',
      constraintPriorities: ['tone_coherence', 'friction_control', 'recovery'],
      scenarioId: scenario.id,
      notes: [
        scenario.buildLabel,
        `pace:${scenario.timingRules.paceLabel}`,
        scenario.toneGuidance,
      ],
    }
  }

  if (scenario.vibe === 'lively') {
    return {
      city: scenario.city,
      persona: scenario.persona,
      vibe: scenario.vibe,
      coordinationMode: 'pulse',
      highlightModel: 'multi_peak',
      movementStyle: 'momentum_based',
      socialPosture: 'shared_pulse',
      pacingStyle: 'escalating',
      constraintPriorities: ['tone_coherence', 'friction_control', 'capacity'],
      scenarioId: scenario.id,
      notes: [
        scenario.buildLabel,
        `pace:${scenario.timingRules.paceLabel}`,
        scenario.toneGuidance,
      ],
    }
  }

  return {
    city: scenario.city,
    persona: scenario.persona,
    vibe: scenario.vibe,
    coordinationMode: 'narrative',
    highlightModel: 'reflective_peak',
    movementStyle: 'exploratory',
    socialPosture: 'reflective',
    pacingStyle: 'deliberate',
    constraintPriorities: ['tone_coherence', 'friction_control', 'logistics'],
    scenarioId: scenario.id,
    notes: [
      scenario.buildLabel,
      `pace:${scenario.timingRules.paceLabel}`,
      scenario.toneGuidance,
    ],
  }
}

export function buildExperienceContractFromScenarioContract(
  scenario: HospitalityScenarioContract | null,
): ExperienceContract | null {
  if (!scenario) {
    return null
  }
  if (scenario.persona !== 'romantic') {
    return null
  }
  if (
    scenario.vibe !== 'cozy' &&
    scenario.vibe !== 'lively' &&
    scenario.vibe !== 'cultured'
  ) {
    return null
  }
  return buildRomanticExperienceContract(scenario)
}

export function buildExperienceContract(
  input: ExperienceContractLookupInput,
): ExperienceContract | null {
  const scenario = getHospitalityScenarioContract({
    city: input.city,
    persona: input.persona,
    vibe: input.vibe,
  })
  return buildExperienceContractFromScenarioContract(scenario)
}
