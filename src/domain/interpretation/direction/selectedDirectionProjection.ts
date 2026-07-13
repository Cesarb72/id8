import {
  inferDirectionIdentityFromSignals,
  type DirectionIdentityMode,
} from './directionIdentity'
import type {
  DirectionExperienceFamily,
  GreatStopDownstreamSignal,
  ResolvedDirectionContext,
  SelectedDirectionContext,
} from '../../types/intent'

export type { DirectionIdentityMode } from './directionIdentity'

export interface DirectionPlanningSelection {
  id: string
  label: string
  subtitle?: string
  pocketId: string
  pocketLabel: string
  archetype: string
  cluster: 'lively' | 'chill' | 'explore'
  identity: DirectionIdentityMode
  experienceFamily?: DirectionExperienceFamily
  familyConfidence?: number
  greatStopSignal?: GreatStopDownstreamSignal
}

export interface BuildDirectionPlanningSelectionInput {
  id: string
  label: string
  pocketId?: string
  pocketLabel?: string
  archetype?: string
  cluster: 'lively' | 'chill' | 'explore'
  experienceFamily?: DirectionExperienceFamily
  familyConfidence?: number
  subtitle?: string
  laneIdentity?: string
  macroLane?: string
  greatStopSignal?: GreatStopDownstreamSignal
}

export function buildDirectionPlanningSelection(
  input: BuildDirectionPlanningSelectionInput,
): DirectionPlanningSelection {
  return {
    id: input.id,
    label: input.label,
    subtitle: input.subtitle,
    pocketId: input.pocketId ?? input.id,
    pocketLabel: input.pocketLabel ?? input.label,
    archetype: input.archetype ?? input.cluster,
    cluster: input.cluster,
    identity: inferDirectionIdentityFromSignals({
      experienceFamily: input.experienceFamily,
      cluster: input.cluster,
      archetype: input.archetype,
      label: input.label,
      subtitle: input.subtitle,
      laneIdentity: input.laneIdentity,
      macroLane: input.macroLane,
    }),
    experienceFamily: input.experienceFamily,
    familyConfidence: input.familyConfidence,
    greatStopSignal: input.greatStopSignal,
  }
}

export function buildIntentSelectedDirectionContext(
  selectedDirection?: DirectionPlanningSelection,
): SelectedDirectionContext | undefined {
  // Canonical planning handoff artifact: wrappers pass this downstream, they do not assemble it.
  if (!selectedDirection) {
    return undefined
  }
  return {
    directionId: selectedDirection.id,
    label: selectedDirection.label,
    subtitle: selectedDirection.subtitle,
    pocketId: selectedDirection.pocketId,
    archetype: selectedDirection.archetype,
    identity: selectedDirection.identity,
    family: selectedDirection.experienceFamily,
    familyConfidence: selectedDirection.familyConfidence,
    cluster: selectedDirection.cluster,
    greatStopSignal: selectedDirection.greatStopSignal,
  }
}

export function buildResolvedDirectionContext(
  selectedDirection?: DirectionPlanningSelection,
): ResolvedDirectionContext | undefined {
  if (!selectedDirection) {
    return undefined
  }
  return {
    selectedDirectionId: selectedDirection.id,
    selectedPocketId: selectedDirection.pocketId,
    label: selectedDirection.label,
    archetype: selectedDirection.archetype,
    identity: selectedDirection.identity,
    greatStopSignal: selectedDirection.greatStopSignal,
  }
}
