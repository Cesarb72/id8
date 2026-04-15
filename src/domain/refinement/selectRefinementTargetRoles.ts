import { roleProjection } from '../config/roleProjection'
import type { ArcCandidate } from '../types/arc'
import type { UserStopRole } from '../types/itinerary'
import type { RefinementDirective } from './getRefinementDirective'

interface SelectRefinementTargetRolesInput {
  directive: RefinementDirective
  baselineArc?: ArcCandidate
}

export interface RefinementTargetSelection {
  roles: UserStopRole[]
  primaryTargetRole?: UserStopRole
  targetRoleExistedInVisiblePlan: boolean
  selectionReason: string
}

function uniqueRoles(roles: UserStopRole[]): UserStopRole[] {
  return [...new Set(roles)]
}

export function selectRefinementTargetRoles({
  directive,
  baselineArc,
}: SelectRefinementTargetRolesInput): RefinementTargetSelection {
  const fallbackRoles = uniqueRoles(directive.preferredRoleOrder)

  if (!baselineArc) {
    return {
      roles: fallbackRoles,
      primaryTargetRole: fallbackRoles[0],
      targetRoleExistedInVisiblePlan: true,
      selectionReason: 'No baseline arc available; used default refinement role order.',
    }
  }

  const visibleRoles = uniqueRoles(baselineArc.stops.map((stop) => roleProjection[stop.role]))
  const includeVisibleOnly = (roles: UserStopRole[]): UserStopRole[] =>
    uniqueRoles(roles).filter((role) => visibleRoles.includes(role))

  if (directive.mode === 'more-unique') {
    const hasSurprise = visibleRoles.includes('surprise')
    const preferred: UserStopRole[] = hasSurprise
      ? ['surprise', 'highlight', 'start', 'windDown']
      : ['highlight', 'start', 'windDown']
    const roles = includeVisibleOnly(preferred)
    return {
      roles,
      primaryTargetRole: roles[0],
      targetRoleExistedInVisiblePlan: hasSurprise,
      selectionReason: hasSurprise
        ? 'More Unique prioritized Surprise because it exists in the visible plan.'
        : 'No visible Surprise slot; refinement targeted Highlight instead.',
    }
  }

  if (directive.mode === 'closer-by') {
    const byDrive = [...baselineArc.stops]
      .sort((left, right) => right.scoredVenue.venue.driveMinutes - left.scoredVenue.venue.driveMinutes)
      .map((stop) => roleProjection[stop.role])
    const roles = includeVisibleOnly([...byDrive, 'windDown', 'highlight', 'start', 'surprise']).slice(0, 4)
    return {
      roles,
      primaryTargetRole: roles[0],
      targetRoleExistedInVisiblePlan: roles.length > 0,
      selectionReason: 'Closer By targeted the farthest visible stop first.',
    }
  }

  if (directive.mode === 'more-relaxed') {
    const roles = includeVisibleOnly(['highlight', 'windDown', 'start', 'surprise']).slice(0, 4)
    return {
      roles,
      primaryTargetRole: roles[0],
      targetRoleExistedInVisiblePlan: roles.length > 0,
      selectionReason: 'More Relaxed targeted Highlight first, then calmer landing roles.',
    }
  }

  if (directive.mode === 'more-exciting') {
    const hasSurprise = visibleRoles.includes('surprise')
    const roles = includeVisibleOnly(
      hasSurprise
        ? ['highlight', 'surprise', 'start', 'windDown']
        : ['highlight', 'start', 'windDown'],
    ).slice(0, 4)
    return {
      roles,
      primaryTargetRole: roles[0],
      targetRoleExistedInVisiblePlan: hasSurprise,
      selectionReason: hasSurprise
        ? 'More Exciting prioritized Highlight then Surprise.'
        : 'No visible Surprise slot; More Exciting targeted Highlight then Start.',
    }
  }

  const roles = includeVisibleOnly(['start', 'highlight', 'windDown', 'surprise']).slice(0, 4)
  return {
    roles,
    primaryTargetRole: roles[0],
    targetRoleExistedInVisiblePlan: roles.length > 0,
    selectionReason: 'A Little Fancier targeted Start first, then Highlight.',
  }
}
