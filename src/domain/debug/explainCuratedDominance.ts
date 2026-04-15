import type {
  CuratedDominanceDiagnostics,
  LiveAttritionTraceDiagnostics,
  LiveNoveltyLossDiagnostics,
  RoleCompetitionDiagnostics,
} from '../types/diagnostics'
import type { UserStopRole } from '../types/itinerary'
import type { VenueSourceOrigin } from '../types/sourceMode'

interface ExplainCuratedDominanceInput {
  attritionTrace: LiveAttritionTraceDiagnostics
  dedupeNoveltyLoss: LiveNoveltyLossDiagnostics
  roleCompetitionByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
  selectedStopSources: Partial<Record<UserStopRole, VenueSourceOrigin>>
}

function formatSelectedStopSources(
  selectedStopSources: Partial<Record<UserStopRole, VenueSourceOrigin>>,
): string {
  return Object.entries(selectedStopSources)
    .map(([role, source]) => `${role}:${source}`)
    .join(', ')
}

export function explainCuratedDominance({
  attritionTrace,
  dedupeNoveltyLoss,
  roleCompetitionByRole,
  selectedStopSources,
}: ExplainCuratedDominanceInput): CuratedDominanceDiagnostics {
  const comparisons = Object.values(roleCompetitionByRole).filter(
    (comparison): comparison is RoleCompetitionDiagnostics => Boolean(comparison),
  )
  const curatedWins = comparisons.filter((comparison) => comparison.outcome === 'curated-won')
  const liveWins = comparisons.filter((comparison) => comparison.outcome === 'live-won')
  const stageFrequency = curatedWins.reduce<Record<string, number>>((acc, comparison) => {
    const stage = comparison.strongestLiveLostAtStage ?? 'unknown'
    acc[stage] = (acc[stage] ?? 0) + 1
    return acc
  }, {})
  const repeatedLossFactors = curatedWins.reduce<Record<string, number>>((acc, comparison) => {
    for (const delta of comparison.strongestLiveVsCuratedDelta.slice(0, 3)) {
      if (delta.favored !== 'curated') {
        continue
      }
      acc[delta.label] = (acc[delta.label] ?? 0) + 1
    }
    return acc
  }, {})

  const topStage = Object.entries(stageFrequency).sort((left, right) => right[1] - left[1])[0]
  const topFactors = Object.entries(repeatedLossFactors)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label]) => label)

  let curatedDominancePrimaryReason = 'Curated did not show a clear structural dominance pattern.'
  if (dedupeNoveltyLoss.liveDedupedAgainstCuratedCount > 0 && dedupeNoveltyLoss.liveNoveltyCollapsedCount > 0) {
    curatedDominancePrimaryReason =
      'Live novelty is being collapsed during dedupe before a full live-vs-curated competition can happen.'
  } else if (topStage?.[0] === 'role-pool') {
    curatedDominancePrimaryReason =
      'Live venues are reaching retrieval but repeatedly losing during role-pool ranking.'
  } else if (topStage?.[0] === 'highlight-validity') {
    curatedDominancePrimaryReason =
      'Highlight validity is the main blocker for live centerpiece break-in.'
  } else if (topStage?.[0] === 'arc-assembly') {
    curatedDominancePrimaryReason =
      'Live venues enter role pools but drop out during arc assembly.'
  } else if (topStage?.[0] === 'final-route-winner') {
    curatedDominancePrimaryReason =
      'Live venues reach arc assembly, but curated arcs still win the final route competition.'
  } else if (topFactors.length > 0) {
    curatedDominancePrimaryReason = `Curated winners are repeatedly stronger on ${topFactors.join(', ')}.`
  }

  return {
    curatedDominanceDetected: curatedWins.length >= 2 && liveWins.length === 0,
    curatedDominancePrimaryReason,
    repeatedCuratedWinnerPattern: [
      ...(topStage ? [`Most common loss stage: ${topStage[0]} (${topStage[1]} roles).`] : []),
      ...topFactors.map((factor) => `Repeated curated edge: ${factor}.`),
    ].slice(0, 4),
    liveWouldNeedToImproveOn: topFactors,
    sourceBalanceSummary: [
      `Live attrition: fetched ${attritionTrace.liveFetchedCount}, normalized ${attritionTrace.liveNormalizedCount}, retrieved ${attritionTrace.liveRetrievedCount}.`,
      `Role-pool live counts: start ${attritionTrace.liveEnteredRolePoolStart}, highlight ${attritionTrace.liveEnteredRolePoolHighlight}, surprise ${attritionTrace.liveEnteredRolePoolSurprise}, windDown ${attritionTrace.liveEnteredRolePoolWindDown}.`,
      `Final selected sources: ${formatSelectedStopSources(selectedStopSources) || 'n/a'}.`,
    ],
  }
}
