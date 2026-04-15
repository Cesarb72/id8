import type { RefinementMode } from '../types/refinement'
import type { UserStopRole } from '../types/itinerary'

export interface RefinementDirective {
  mode: RefinementMode
  primaryTargets: string[]
  secondaryTargets: string[]
  acceptableSacrifices: string[]
  preferredRoleOrder: UserStopRole[]
  minObjectiveGain: number
  maxArcScoreDrop: number
  minRoleScore: number
}

export function getRefinementDirective(mode: RefinementMode): RefinementDirective {
  if (mode === 'more-unique') {
    return {
      mode,
      primaryTargets: ['distinctiveness', 'underexposure', 'hiddenGem'],
      secondaryTargets: ['surprise-role-fit', 'highlight-role-fit'],
      acceptableSacrifices: ['some familiarity', 'some price stability'],
      preferredRoleOrder: ['surprise', 'highlight', 'start'],
      minObjectiveGain: 0.06,
      maxArcScoreDrop: 0.11,
      minRoleScore: 0.48,
    }
  }
  if (mode === 'closer-by') {
    return {
      mode,
      primaryTargets: ['driveMinutes', 'geography-spread', 'neighborhood-continuity'],
      secondaryTargets: ['windDown-proximity'],
      acceptableSacrifices: ['some uniqueness'],
      preferredRoleOrder: ['windDown', 'highlight', 'start', 'surprise'],
      minObjectiveGain: 0.055,
      maxArcScoreDrop: 0.09,
      minRoleScore: 0.45,
    }
  }
  if (mode === 'more-relaxed') {
    return {
      mode,
      primaryTargets: ['lower-energy', 'calmer-transitions', 'windDown-fit'],
      secondaryTargets: ['proximity'],
      acceptableSacrifices: ['some excitement'],
      preferredRoleOrder: ['highlight', 'windDown', 'start'],
      minObjectiveGain: 0.06,
      maxArcScoreDrop: 0.11,
      minRoleScore: 0.46,
    }
  }
  if (mode === 'more-exciting') {
    return {
      mode,
      primaryTargets: ['energy', 'centerpiece-strength', 'surprise-strength'],
      secondaryTargets: ['distinctiveness'],
      acceptableSacrifices: ['some calm', 'some proximity'],
      preferredRoleOrder: ['highlight', 'surprise', 'start'],
      minObjectiveGain: 0.06,
      maxArcScoreDrop: 0.11,
      minRoleScore: 0.5,
    }
  }
  return {
    mode,
    primaryTargets: ['price-tier', 'tone', 'presentation'],
    secondaryTargets: ['calm-flow'],
    acceptableSacrifices: ['some casual comfort'],
    preferredRoleOrder: ['start', 'highlight', 'windDown'],
    minObjectiveGain: 0.05,
    maxArcScoreDrop: 0.09,
    minRoleScore: 0.46,
  }
}
