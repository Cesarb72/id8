import { buildScenarioNightsFromCandidateBoard } from '../src/domain/interpretation/construction/scenarioBuilder'
import { buildStopTypeCandidateBoardFromIntent } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard'

const scenarios = [
  { city: 'San Jose', persona: 'romantic', vibe: 'cozy' },
  { city: 'San Jose', persona: 'romantic', vibe: 'lively' },
  { city: 'San Jose', persona: 'romantic', vibe: 'cultured' },
] as const

function format(value: number): string {
  return value.toFixed(2)
}

for (const scenario of scenarios) {
  const board = await buildStopTypeCandidateBoardFromIntent(scenario)
  console.log(`\n=== SCENARIO BUILDER PROBE ${scenario.city} / ${scenario.persona} / ${scenario.vibe} ===`)
  if (!board) {
    console.log('unsupported scenario')
    continue
  }
  const nights = buildScenarioNightsFromCandidateBoard(board, { minNights: 3, maxNights: 4 })
  console.log(`scenarioFamily: ${board.scenarioFamily}`)
  console.log(`builtNights: ${nights.length}`)
  nights.forEach((night, index) => {
    console.log(`  ${index + 1}. ${night.title} | ${night.flavorLine} | complete=${night.complete}`)
    if (!night.complete) {
      console.log(`     missing: ${(night.missingStopTypes ?? []).join(', ')}`)
      return
    }
    console.log(`     why: ${night.whyThisWorks}`)
    console.log(
      `     great-stop: pass=${night.evaluation?.passesGreatStopStandard ?? false}` +
        ` | failedStops=${(night.evaluation?.failedStops ?? []).join(', ') || 'none'}`,
    )
    night.stops.forEach((stop, stopIndex) => {
      console.log(
        `     - ${stopIndex + 1} ${stop.position} [${stop.stopType}] ${stop.name}` +
          ` (${stop.district ?? 'n/a'})` +
          ` | authority ${format(stop.authorityScore)}` +
          ` | current ${format(stop.currentRelevance)}` +
          `${stop.isHiddenGem ? ' | hidden-gem' : ''}`,
      )
      console.log(`       moment: ${stop.momentLabel}`)
      console.log(`       whyThisStop: ${stop.whyThisStop}`)
      if (stop.whyTonight) {
        console.log(`       whyTonight: ${stop.whyTonight}`)
      }
      if (stop.venueTypeLabel || stop.factualSummary) {
        console.log(
          `       trust: ${stop.venueTypeLabel ?? 'n/a'} | ${stop.factualSummary ?? 'n/a'}` +
            ` | source=${stop.sourceType ?? 'n/a'}`,
        )
      }
      if (stop.venueFeatures?.length || stop.serviceOptions?.length) {
        console.log(
          `       facts: features=[${(stop.venueFeatures ?? []).join(', ')}]` +
            ` services=[${(stop.serviceOptions ?? []).join(', ')}]`,
        )
      }
      if (stop.evaluation) {
        console.log(
          `       eval: real=${stop.evaluation.isReal} role=${stop.evaluation.isRoleRight}` +
            ` intent=${stop.evaluation.isIntentRight} place=${stop.evaluation.isPlaceRight}` +
            ` moment=${stop.evaluation.isMomentRight}` +
            ` fails=${stop.evaluation.failedCriteria.join(', ') || 'none'}`,
        )
      }
    })
  })
}
