import type {
  ConciergeIntent,
  DistanceMode,
  ExperienceMode,
  IntentInput,
  PlanAnchor,
  PreferredDiscoveryVenue,
  SelectedDirectionContext,
} from '../types/intent'
import type { RefinementMode } from '../types/refinement'

type BuildAnchorRoleProvenanceSource =
  | 'explicit'
  | 'inferred'
  | 'defaulted_highlight'
  | 'missing'

type AnchorPostureWithRoleProvenance = ConciergeIntent['anchorPosture'] & {
  roleResolutionSource?: BuildAnchorRoleProvenanceSource
}

type PlanAnchorWithRoleProvenance = PlanAnchor & {
  roleResolutionSource?: BuildAnchorRoleProvenanceSource
}

export interface ProjectConciergeIntentToIntentInputParams {
  conciergeIntent: ConciergeIntent
  mode: ExperienceMode
  city: string
  district?: string
  neighborhood?: string
  distanceMode: DistanceMode
  refinementModes?: RefinementMode[]
  discoveryPreferences?: PreferredDiscoveryVenue[]
  selectedDirectionContext?: SelectedDirectionContext
  anchor?: PlanAnchor | null
}

function projectAnchorFromConciergeIntent(
  conciergeIntent: ConciergeIntent,
): PlanAnchorWithRoleProvenance | undefined {
  if (
    conciergeIntent.anchorPosture.mode !== 'hard' ||
    conciergeIntent.anchorPosture.anchorType !== 'venue' ||
    !conciergeIntent.anchorPosture.anchorValue
  ) {
    return undefined
  }
  const anchorPosture = conciergeIntent.anchorPosture as AnchorPostureWithRoleProvenance
  const roleHint = anchorPosture.roleHint
  return {
    venueId: conciergeIntent.anchorPosture.anchorValue,
    ...(roleHint ? { role: roleHint } : {}),
    ...(anchorPosture.roleResolutionSource
      ? { roleResolutionSource: anchorPosture.roleResolutionSource }
      : {}),
  }
}

export function projectConciergeIntentToIntentInput(
  params: ProjectConciergeIntentToIntentInputParams,
): IntentInput {
  const projectedAnchor = params.anchor ?? projectAnchorFromConciergeIntent(params.conciergeIntent)
  return {
    mode: params.mode,
    planningMode:
      params.conciergeIntent.controlPosture.mode === 'user_directed'
        ? 'user-led'
        : 'engine-led',
    persona: params.conciergeIntent.experienceProfile.persona,
    primaryVibe: params.conciergeIntent.experienceProfile.vibe,
    city: params.city,
    district: params.district,
    neighborhood: params.neighborhood,
    distanceMode: params.distanceMode,
    refinementModes: params.refinementModes,
    selectedDirectionContext: params.selectedDirectionContext,
    discoveryPreferences: params.discoveryPreferences,
    anchor: projectedAnchor,
  }
}
