import { normalizeIntent } from '../src/domain/intent/normalizeIntent'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy'
import { getRoleContract } from '../src/domain/contracts/getRoleContract'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues'

const intent = normalizeIntent({ city:'San Jose', persona:'romantic', primaryVibe:'cozy', budget:'$$' })
const lens = buildExperienceLens({ intent })
const crewPolicy = getCrewPolicy(intent.crew)
const roleContracts = getRoleContract({ intent })
const retrieval = await retrieveVenues(intent, lens, {})
console.log('venues', retrieval.venues.length)
const v = retrieval.venues[0]
console.log('top keys', Object.keys(v))
console.log('settings keys', Object.keys(v.settings||{}))
console.log('source keys', Object.keys(v.source||{}))
console.log('happenings', v.source?.happenings)
