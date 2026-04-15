import { buildDistrictOpportunityProfiles } from '../src/engines/district'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
import { buildGreatStopAdmissibilitySignal } from '../src/domain/bearings/buildGreatStopAdmissibilitySignal'

const district = await buildDistrictOpportunityProfiles({ locationQuery: 'San Jose', includeDebug: true })
const canonical = buildCanonicalInterpretationBundle({ persona: 'friends', vibe: 'lively', city: 'San Jose' })
const signal = buildGreatStopAdmissibilitySignal({
  stopEvaluations:[{venueId:'a',name:'a',evaluation:{isReal:true,isRoleRight:false,isIntentRight:true,isPlaceRight:false,isMomentRight:true,failedCriteria:['role_right','place_right']}}, {venueId:'b',name:'b',evaluation:{isReal:false,isRoleRight:false,isIntentRight:false,isPlaceRight:false,isMomentRight:false,failedCriteria:['real','role_right','intent_right','place_right','moment_right']}}],
  passesGreatStopStandard:false,
  failedStops:['a','b']
})
const gate = buildContractGateWorld({
  ranked: district.ranked,
  context: {
    canonicalStrategyFamily: canonical.strategyFamily,
    canonicalStrategyFamilyResolution: canonical.strategyFamilyResolution,
    experienceContract: canonical.experienceContract,
    contractConstraints: canonical.contractConstraints,
    greatStopAdmissibilitySignal: signal,
  },
})
const entries = gate.contractAwareRanking.ranked.slice(0,4).map((entry)=>({
  pocketId: entry.profile.pocketId,
  status: gate.gateDecisions.find((d)=>d.pocketId===entry.profile.pocketId)?.status,
  reason: gate.gateDecisions.find((d)=>d.pocketId===entry.profile.pocketId)?.reasonSummary,
  score: entry.score,
  meta: gate.contractAwareRanking.pocketDebugById[entry.profile.pocketId]
}))
console.log(JSON.stringify(entries, null, 2))
