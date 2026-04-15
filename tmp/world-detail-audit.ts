import { buildDistrictOpportunityProfiles } from '../src/engines/district/core/buildDistrictOpportunityProfiles'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds'

const city='San Jose'
const persona='romantic' as const
const vibe='lively' as const

const preview = await buildDistrictOpportunityProfiles({locationQuery:city, includeDebug:true})
const bundle = buildCanonicalInterpretationBundle({persona,vibe,city,planningMode:'engine-led',entryPoint:'direction_selection',hasAnchor:false})
const gate = buildContractGateWorld({ ranked: preview.ranked, context:{persona,vibe,experienceContract:bundle.experienceContract,contractConstraints:bundle.contractConstraints}, source:'audit.world.detail'})
const worlds = buildStrategyAdmissibleWorlds({contractGateWorld:gate, strategyFamily:bundle.strategyFamily, strategySummary: bundle.strategySemantics.summary})

console.log(JSON.stringify({
  gateAdmitted: gate.admittedPockets.map((p)=>p.profile.pocketId),
  worlds: worlds.map((w)=>({
    strategyId:w.strategyId,
    admitted:w.admittedPockets.map((p)=>p.profile.pocketId),
    suppressed:w.suppressedPockets.map((p)=>p.profile.pocketId),
    rejected:w.rejectedPockets.map((p)=>p.profile.pocketId),
    decisionLog:w.decisionLog,
  }))
}, null, 2))
