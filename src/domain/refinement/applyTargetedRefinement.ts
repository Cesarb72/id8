import { inverseRoleProjection } from '../config/roleProjection'
import { swapArcStop } from '../arc/swapArcStop'
import { findTargetedRefinementCandidates } from './findTargetedRefinementCandidates'
import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type { CrewPolicy } from '../types/crewPolicies'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { RefinementDirective } from './getRefinementDirective'

export interface TargetedRefinementResult {
  nextArc?: ArcCandidate
  targetedRoles: UserStopRole[]
  primaryTargetRole?: UserStopRole
  targetedCandidateCount: number
  targetedChangeSucceeded: boolean
  winnerInertiaDetected: boolean
  winnerInertiaReduced: boolean
  winnerInertiaNotes: string[]
}

interface ApplyTargetedRefinementInput {
  currentArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  intent: IntentProfile
  crewPolicy: CrewPolicy
  lens: ExperienceLens
  directive: RefinementDirective
  targetedRoles: UserStopRole[]
}

export function applyTargetedRefinement({
  currentArc,
  scoredVenues,
  intent,
  crewPolicy,
  lens,
  directive,
  targetedRoles,
}: ApplyTargetedRefinementInput): TargetedRefinementResult {
  let targetedCandidateCount = 0
  let winnerInertiaDetected = false
  let winnerInertiaReduced = false
  const winnerInertiaNotes: string[] = []

  for (const role of targetedRoles) {
    const internalRole = inverseRoleProjection[role]
    const currentStop = currentArc.stops.find((stop) => stop.role === internalRole)
    if (!currentStop) {
      winnerInertiaNotes.push(`Targeted role ${role} is not present in the visible plan.`)
      continue
    }
    const candidates = findTargetedRefinementCandidates({
      role,
      currentArc,
      scoredVenues,
      intent,
      directive,
    })
    targetedCandidateCount += candidates.length
    if (candidates.length === 0) {
      winnerInertiaNotes.push(`No viable candidates for targeted ${role} change.`)
      continue
    }

    const axisLeader = candidates[0]
    const axisLeaderHasLeverage = axisLeader.objectiveDelta >= directive.minObjectiveGain
    let axisLeaderCouldNotWin = false

    for (const candidate of candidates) {
      const swapped = swapArcStop({
        currentArc,
        role: internalRole,
        replacement: candidate.scoredVenue,
        intent,
        crewPolicy,
        lens,
      })
      if (!swapped) {
        if (candidate === axisLeader && axisLeaderHasLeverage) {
          axisLeaderCouldNotWin = true
          winnerInertiaNotes.push(`Axis-leading ${role} challenger failed arc validity checks.`)
        }
        continue
      }

      const arcDelta = swapped.totalScore - currentArc.totalScore
      const objectiveImproved = candidate.objectiveDelta >= directive.minObjectiveGain
      const specificityGain =
        candidate.scoredVenue.contextSpecificity.byRole[internalRole] -
        currentStop.scoredVenue.contextSpecificity.byRole[internalRole]
      const challengerLeverage = candidate.objectiveDelta >= directive.minObjectiveGain * 1.6 ? 0.03 : 0
      const acceptableArcCost = arcDelta >= -(directive.maxArcScoreDrop + challengerLeverage)
      const specificityOverride =
        specificityGain >= 0.09 && arcDelta >= -(directive.maxArcScoreDrop + 0.02)

      if (objectiveImproved && (acceptableArcCost || specificityOverride)) {
        if (axisLeaderHasLeverage) {
          winnerInertiaReduced = true
        }
        if (specificityOverride && !acceptableArcCost) {
          winnerInertiaNotes.push(
            `Accepted ${role} challenger due to stronger context specificity (+${specificityGain.toFixed(3)}).`,
          )
        }
        return {
          nextArc: swapped,
          targetedRoles,
          primaryTargetRole: role,
          targetedCandidateCount,
          targetedChangeSucceeded: true,
          winnerInertiaDetected: winnerInertiaDetected || axisLeaderCouldNotWin,
          winnerInertiaReduced,
          winnerInertiaNotes,
        }
      }

      if (candidate === axisLeader && objectiveImproved && !acceptableArcCost) {
        axisLeaderCouldNotWin = true
        winnerInertiaNotes.push(
          `Axis-leading ${role} challenger rejected due to arc quality drop (${arcDelta.toFixed(3)}).`,
        )
      }
    }

    if (axisLeaderHasLeverage && axisLeaderCouldNotWin) {
      winnerInertiaDetected = true
    }
  }

  return {
    targetedRoles,
    primaryTargetRole: targetedRoles[0],
    targetedCandidateCount,
    targetedChangeSucceeded: false,
    winnerInertiaDetected,
    winnerInertiaReduced,
    winnerInertiaNotes,
  }
}
