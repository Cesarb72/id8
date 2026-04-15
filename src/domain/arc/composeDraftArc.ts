import { createId } from '../../lib/ids'
import { inverseRoleProjection } from '../config/roleProjection'
import { isValidArcCombination } from './isValidArcCombination'
import { scoreArcAssembly } from './scoreArcAssembly'
import { swapArcStop } from './swapArcStop'
import type { ArcCandidate, ArcStop, ScoredVenue } from '../types/arc'
import type { CrewPolicy } from '../types/crewPolicies'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { InternalRole } from '../types/venue'

export type DraftComposeActionId =
  | 'remove-stop'
  | 'replace-stop'
  | 'add-before'
  | 'add-after'

export type DraftComposeSearchActionId = Exclude<DraftComposeActionId, 'remove-stop'>

export interface DraftComposeAction {
  id: DraftComposeActionId
  label: string
  acknowledgement: string
  requiresSearch: boolean
}

export interface DraftComposeSearchResult {
  id: string
  title: string
  subtitle: string
  rationale: string
  kind: 'candidate' | 'custom'
  scoredVenue: ScoredVenue
}

interface DraftComposeContext {
  currentArc: ArcCandidate
  intent: IntentProfile
  crewPolicy: CrewPolicy
  lens: ExperienceLens
}

interface GetDraftComposeActionsInput extends DraftComposeContext {
  role: UserStopRole
  scoredVenues: ScoredVenue[]
}

interface RemoveArcStopInput extends DraftComposeContext {
  role: InternalRole
  scoredVenues: ScoredVenue[]
}

interface InsertArcStopInput extends DraftComposeContext {
  role: InternalRole
  actionId: 'add-before' | 'add-after'
  inserted: ScoredVenue
}

const THREE_STOP_SHAPE: InternalRole[] = ['warmup', 'peak', 'cooldown']
const FOUR_STOP_SHAPE: InternalRole[] = ['warmup', 'peak', 'wildcard', 'cooldown']

function scoreDraftCompositionCandidate(
  candidate: ScoredVenue,
  role: InternalRole,
): number {
  return (
    candidate.roleScores[role] * 0.62 +
    candidate.fitScore * 0.22 +
    candidate.lensCompatibility * 0.08 +
    candidate.fitBreakdown.proximityFit * 0.08
  )
}

function buildArcCandidate(
  stops: ArcStop[],
  idPrefix: string,
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
): ArcCandidate | null {
  if (!isValidArcCombination(stops, intent, crewPolicy, lens)) {
    return null
  }

  const scored = scoreArcAssembly(stops, intent, crewPolicy, lens)
  return {
    id: createId(idPrefix),
    stops,
    totalScore: scored.totalScore,
    scoreBreakdown: scored.scoreBreakdown,
    pacing: scored.pacing,
    spatial: scored.spatial,
    hasWildcard: stops.some((stop) => stop.role === 'wildcard'),
  }
}

function sortCompositionCandidates(
  scoredVenues: ScoredVenue[],
  role: InternalRole,
  excludedIds: Set<string>,
): ScoredVenue[] {
  return scoredVenues
    .filter((item) => !excludedIds.has(item.venue.id))
    .sort(
      (left, right) =>
        scoreDraftCompositionCandidate(right, role) -
        scoreDraftCompositionCandidate(left, role),
    )
}

export function insertArcStop({
  currentArc,
  role,
  actionId,
  inserted,
  intent,
  crewPolicy,
  lens,
}: InsertArcStopInput): ArcCandidate | null {
  if (currentArc.stops.length !== 3 || currentArc.hasWildcard) {
    return null
  }

  const canInsertWildcard =
    (role === 'peak' && actionId === 'add-after') ||
    (role === 'cooldown' && actionId === 'add-before')
  if (!canInsertWildcard) {
    return null
  }

  const warmup = currentArc.stops.find((stop) => stop.role === 'warmup')
  const peak = currentArc.stops.find((stop) => stop.role === 'peak')
  const cooldown = currentArc.stops.find((stop) => stop.role === 'cooldown')
  if (!warmup || !peak || !cooldown) {
    return null
  }

  const nextStops: ArcStop[] = [
    { ...warmup, role: 'warmup' },
    { ...peak, role: 'peak' },
    { role: 'wildcard', scoredVenue: inserted },
    { ...cooldown, role: 'cooldown' },
  ]

  return buildArcCandidate(
    nextStops,
    `arc_insert_${actionId}`,
    intent,
    crewPolicy,
    lens,
  )
}

function repairThreeStopRemoval({
  currentArc,
  role,
  scoredVenues,
  intent,
  crewPolicy,
  lens,
}: RemoveArcStopInput): ArcCandidate | null {
  const roleStop = currentArc.stops.find((stop) => stop.role === role)
  if (!roleStop) {
    return null
  }

  const excludedIds = new Set(
    currentArc.stops
      .filter((stop) => stop.role !== role)
      .map((stop) => stop.scoredVenue.venue.id),
  )
  excludedIds.add(roleStop.scoredVenue.venue.id)

  const candidates = sortCompositionCandidates(scoredVenues, role, excludedIds).slice(0, 20)
  for (const candidate of candidates) {
    const repaired = swapArcStop({
      currentArc,
      role,
      replacement: candidate,
      intent,
      crewPolicy,
      lens,
    })
    if (repaired) {
      return repaired
    }
  }

  return null
}

export function removeArcStop({
  currentArc,
  role,
  scoredVenues,
  intent,
  crewPolicy,
  lens,
}: RemoveArcStopInput): ArcCandidate | null {
  if (currentArc.stops.length === 3) {
    return repairThreeStopRemoval({
      currentArc,
      role,
      scoredVenues,
      intent,
      crewPolicy,
      lens,
    })
  }

  const remainingStops = currentArc.stops
    .filter((stop) => stop.role !== role)
    .map((stop, index) => ({
      ...stop,
      role: THREE_STOP_SHAPE[index]!,
    }))

  return buildArcCandidate(
    remainingStops,
    `arc_remove_${role}`,
    intent,
    crewPolicy,
    lens,
  )
}

export function getDraftComposeActions({
  currentArc,
  role,
  scoredVenues,
  intent,
  crewPolicy,
  lens,
}: GetDraftComposeActionsInput): DraftComposeAction[] {
  const internalRole = inverseRoleProjection[role]
  const actions: DraftComposeAction[] = [
    {
      id: 'replace-stop',
      label: 'Replace',
      acknowledgement: 'Stop updated',
      requiresSearch: true,
    },
  ]

  if (
    removeArcStop({
      currentArc,
      role: internalRole,
      scoredVenues,
      intent,
      crewPolicy,
      lens,
    })
  ) {
    actions.push({
      id: 'remove-stop',
      label: 'Remove',
      acknowledgement: 'Removed and rebalanced',
      requiresSearch: false,
    })
  }

  if (currentArc.stops.length === 3 && !currentArc.hasWildcard) {
    if (internalRole === 'peak') {
      actions.push({
        id: 'add-after',
        label: 'Add after',
        acknowledgement: 'Added later in the route',
        requiresSearch: true,
      })
    }
    if (internalRole === 'cooldown') {
      actions.push({
        id: 'add-before',
        label: 'Add before',
        acknowledgement: 'Added before the close',
        requiresSearch: true,
      })
    }
  }

  return actions
}

export function getComposeActionTargetRole(
  role: UserStopRole,
  actionId: DraftComposeSearchActionId,
): InternalRole {
  if (actionId === 'replace-stop') {
    return inverseRoleProjection[role]
  }
  return 'wildcard'
}

export function canApplyComposeSearchResult({
  currentArc,
  role,
  actionId,
  scoredVenue,
  intent,
  crewPolicy,
  lens,
}: DraftComposeContext & {
  role: UserStopRole
  actionId: DraftComposeSearchActionId
  scoredVenue: ScoredVenue
}): boolean {
  if (actionId === 'replace-stop') {
    return Boolean(
      swapArcStop({
        currentArc,
        role: inverseRoleProjection[role],
        replacement: scoredVenue,
        intent,
        crewPolicy,
        lens,
      }),
    )
  }

  return Boolean(
    insertArcStop({
      currentArc,
      role: inverseRoleProjection[role],
      actionId,
      inserted: scoredVenue,
      intent,
      crewPolicy,
      lens,
    }),
  )
}

export function getDraftAddInsertionShape(stopCount: number): InternalRole[] {
  return stopCount === 4 ? FOUR_STOP_SHAPE : THREE_STOP_SHAPE
}
