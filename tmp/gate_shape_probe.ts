import { buildDistrictOpportunityProfiles } from '../src/engines/district'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
const district = await buildDistrictOpportunityProfiles({ locationQuery: 'San Jose', includeDebug: true })
const canonical = buildCanonicalInterpretationBundle({ persona: 'friends', vibe: 'lively', city: 'San Jose' })
const gate = buildContractGateWorld({ ranked: district.ranked, context: { canonicalStrategyFamily: canonical.strategyFamily, canonicalStrategyFamilyResolution: canonical.strategyFamilyResolution, experienceContract: canonical.experienceContract, contractConstraints: canonical.contractConstraints }})
console.log(Object.keys(gate))
console.log(JSON.stringify(gate.contractAwareRanking.pocketDebugById, null, 2).slice(0,1500))
