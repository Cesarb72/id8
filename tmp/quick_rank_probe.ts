import { buildDistrictOpportunityProfiles } from '../src/engines/district/core/buildDistrictOpportunityProfiles'

const r = await buildDistrictOpportunityProfiles({ locationQuery: 'San Jose', includeDebug: true })
console.log(JSON.stringify(r.ranked.map((e)=>({pocketId:e.profile.pocketId,label:e.profile.label,score:e.score,rank:e.rank, reasons:e.reasons?.slice(0,2)})), null, 2))
