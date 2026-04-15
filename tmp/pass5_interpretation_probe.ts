import { buildStopTypeCandidateBoardFromIntent } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard'
import { buildScenarioNightsFromCandidateBoard } from '../src/domain/interpretation/construction/scenarioBuilder'

const scenarios = [
  { city: 'San Jose', persona: 'friends', vibe: 'cozy' },
  { city: 'San Jose', persona: 'friends', vibe: 'lively' },
  { city: 'San Jose', persona: 'friends', vibe: 'cultured' },
  { city: 'San Jose', persona: 'family', vibe: 'cozy' },
  { city: 'San Jose', persona: 'family', vibe: 'lively' },
  { city: 'San Jose', persona: 'family', vibe: 'cultured' },
]

for (const scenario of scenarios) {
  const board = await buildStopTypeCandidateBoardFromIntent(scenario)
  console.log(`\n=== ${scenario.city} | ${scenario.persona} | ${scenario.vibe} ===`)
  if (!board) {
    console.log('unsupported')
    continue
  }
  const boardCoverage = board.requiredStopTypes.map((stopType) => ({
    stopType,
    count: board.candidatesByStopType[stopType]?.length ?? 0,
  }))
  const nights = buildScenarioNightsFromCandidateBoard(board, { minNights: 3, maxNights: 4 })
  console.log(
    JSON.stringify(
      {
        scenarioFamily: board.scenarioFamily,
        requiredStopTypes: board.requiredStopTypes,
        boardCoverage,
        builtNightCount: nights.length,
        sampleNight: nights[0]
          ? {
              id: nights[0].id,
              title: nights[0].title,
              complete: nights[0].complete,
              whyThisWorks: nights[0].whyThisWorks,
              evaluation: {
                passesGreatStopStandard: nights[0].evaluation?.passesGreatStopStandard,
                failedStops: nights[0].evaluation?.failedStops ?? [],
              },
              stops: nights[0].stops.map((stop) => ({
                position: stop.position,
                stopType: stop.stopType,
                name: stop.name,
                momentLabel: stop.momentLabel,
                whyThisStop: stop.whyThisStop,
                whyTonight: stop.whyTonight,
                district: stop.district,
                address: stop.address,
                venueTypeLabel: stop.venueTypeLabel,
                factualSummary: stop.factualSummary,
                evaluationFailedCriteria: stop.evaluation?.failedCriteria ?? [],
              })),
            }
          : null,
      },
      null,
      2,
    ),
  )
}
