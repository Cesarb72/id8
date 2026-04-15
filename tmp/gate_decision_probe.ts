import { buildDistrictOpportunityProfiles } from '../src/engines/district'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
import { buildGreatStopAdmissibilitySignal } from '../src/domain/bearings/buildGreatStopAdmissibilitySignal'

const district = await buildDistrictOpportunityProfiles({ locationQuery: 'San Jose', includeDebug: true })
const canonical = buildCanonicalInterpretationBundle({ persona: 'friends', vibe: 'lively', city: 'San Jose' })
const signal = buildGreatStopAdmissibilitySignal({
  stopEvaluations:[{venueId:'a',name:'a',evaluation:{isReal:true,isRoleRight:false,isIntentRight:true,isPlaceRight:false,isMomentRight:true,failedCriteria:['role_right','place_right']}}],
  passesGreatStopStandard:false,
  failedStops:['a']
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
console.log(Object.keys(gate.contractAwareRanking))
console.log(gate.contractAwareRanking.decisions?.slice(0,2))
