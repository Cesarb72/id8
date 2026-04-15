import { buildStopTypeCandidateBoardFromIntent } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard'
import { buildScenarioNightsFromCandidateBoard } from '../src/domain/interpretation/construction/scenarioBuilder'

const board = await buildStopTypeCandidateBoardFromIntent({ city:'San Jose', persona:'family', vibe:'cultured' })
if (!board) { console.log('unsupported'); process.exit(0)}
const nights = buildScenarioNightsFromCandidateBoard(board, {minNights:3,maxNights:4})
for (const night of nights) {
  console.log(`\n${night.id} pass=${night.evaluation?.passesGreatStopStandard}`)
  for (const stop of night.stops) {
    const evalFails = stop.evaluation?.failedCriteria ?? []
    console.log(`${stop.position} ${stop.stopType} ${stop.name} | district=${stop.district ?? 'n/a'} | addr=${stop.address ?? 'n/a'} | fails=${evalFails.join('|') || 'none'}`)
  }
}
