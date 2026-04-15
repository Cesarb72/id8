import { buildDistrictOpportunityProfiles } from '../src/engines/district'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'

const district = await buildDistrictOpportunityProfiles({ locationQuery: 'San Jose', includeDebug: true })
const canonical = buildCanonicalInterpretationBundle({ persona: 'romantic', vibe: 'cozy', city: 'San Jose' })
const gate = buildContractGateWorld({
  ranked: district.ranked,
  context: {
    canonicalStrategyFamily: canonical.strategyFamily,
    canonicalStrategyFamilyResolution: canonical.strategyFamilyResolution,
    experienceContract: canonical.experienceContract,
    contractConstraints: canonical.contractConstraints,
  },
})
console.log(Object.keys(gate.debug))
console.log(gate.debug)
