import { buildDistrictOpportunityProfiles } from '../src/engines/district'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
import { buildGreatStopAdmissibilitySignal } from '../src/domain/bearings/buildGreatStopAdmissibilitySignal'

const district = await buildDistrictOpportunityProfiles({ locationQuery: 'San Jose', includeDebug: true })
const canonical = buildCanonicalInterpretationBundle({ persona: 'friends', vibe: 'lively', city: 'San Jose' })
const signal = buildGreatStopAdmissibilitySignal({
  stopEvaluations:[
    {venueId:'a',name:'a',evaluation:{isReal:true,isRoleRight:true,isIntentRight:true,isPlaceRight:false,isMomentRight:false,failedCriteria:['place_right','moment_right']}},
    {venueId:'b',name:'b',evaluation:{isReal:true,isRoleRight:true,isIntentRight:true,isPlaceRight:false,isMomentRight:true,failedCriteria:['place_right']}}
  ],
  passesGreatStopStandard:false,
  failedStops:['a','b']
})
const gate = buildContractGateWorld({ ranked: district.ranked, context: { canonicalStrategyFamily: canonical.strategyFamily, canonicalStrategyFamilyResolution: canonical.strategyFamilyResolution, experienceContract: canonical.experienceContract, contractConstraints: canonical.contractConstraints, greatStopAdmissibilitySignal: signal }})
console.log(gate.decisionLog.slice(0,5))
console.log(gate.decisionByPocketId)
