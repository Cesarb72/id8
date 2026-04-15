import { buildDistrictOpportunityProfiles } from '../src/engines/district/core/buildDistrictOpportunityProfiles'
import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy'
import { getRoleContract } from '../src/domain/contracts/getRoleContract'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues'
import { scoreVenueCollection } from '../src/domain/retrieval/scoreVenueFit'
import { deriveVenueHappeningsSignals } from '../src/domain/normalize/deriveVenueHappeningsSignals'
import { getHospitalityScenarioContract } from '../src/domain/interpretation/taste/scenarioContracts'
import { buildExperienceContractFromScenarioContract } from '../src/domain/interpretation/contracts/experienceContract'
import { applyScenarioContractToAggregation } from '../src/domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { applyExperienceContractToAggregation } from '../src/domain/interpretation/taste/applyExperienceContractToOpportunityAggregation'

const city='San Jose', persona='romantic', vibes=['cozy','lively','cultured'] as const
const ecs={exploration:'focused',discovery:'reliable',highlight:'standout'} as const
function dk(v?:string){if(!v)return'';return v.toLowerCase().replace(/\b(district|pocket|area|core)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function dkeys(v?:string){const n=dk(v);if(!n)return[];return [...new Set([n,n.replace(/\s+/g,'')])]} 
function dtokens(v?:string){const n=dk(v);if(!n)return[];return n.split(' ').map(t=>t.trim()).filter(t=>t.length>=3)}
function tokScore(c:string[],r:string[]){if(!c.length||!r.length)return 0;const rs=new Set(r);let o=0;for(const t of c){if(rs.has(t))o++}const cov=o/c.length;if(!o)return 0;if(c.length<=2)return cov>=0.5?cov:0;return o>=2&&cov>=0.5?cov:0}
function shiftHP(v:string){if(v==='low')return'medium';if(v==='medium')return'high';return'high'}
function shiftDB(v:string){if(v==='novel')return'balanced';if(v==='balanced')return'familiar';return'familiar'}
function applyEcs(a:any){return{...a,summary:{...a.summary,highlightPotential:shiftHP(a.summary.highlightPotential),discoveryBalance:shiftDB(a.summary.discoveryBalance)},anchors:{...a.anchors}}}
function aggIds(a:any){const s=new Set<string>();if(!a)return s;for(const c of a.ingredients.startCandidates)s.add(c.venueId);for(const c of a.ingredients.highlightCandidates)s.add(c.venueId);for(const c of a.ingredients.windDownCandidates)s.add(c.venueId);if(a.anchors.strongestHighlight?.venueId)s.add(a.anchors.strongestHighlight.venueId);for(const m of a.moments.primary){if(m.venueId)s.add(m.venueId)}for(const m of a.moments.secondary){if(m.venueId)s.add(m.venueId)}return s}
function buildDistrictCandidates(ranked:any[],recs:any[]){const entries=recs.filter(r=>Boolean(r.tasteAggregation)).map(r=>({r,keys:[...new Set([...dkeys(r.districtId),...dkeys(r.label)])],tokens:[...new Set([...dtokens(r.label),...dtokens(r.districtId)])]}));const by=new Map<string,any>();for(const e of entries){for(const k of e.keys){if(!by.has(k))by.set(k,e.r)}}const used=new Set<string>();const cands=ranked.slice(0,6).map(entry=>{const p=entry.profile;const ckeys=[...new Set([...dkeys(p.meta.sourcePocketId),...dkeys(p.pocketId),...dkeys(p.label)])];let rec=ckeys.map(k=>by.get(k)).find(Boolean);if(!rec){const ct=[...new Set([...dtokens(p.meta.sourcePocketId),...dtokens(p.pocketId),...dtokens(p.label)])];const best=entries.map(e=>({r:e.r,s:tokScore(ct,e.tokens)})).filter(x=>x.s>0).sort((l,r)=>r.s-l.s||r.r.score-l.r.score||l.r.label.localeCompare(r.r.label))[0];rec=best?.r}if(rec)used.add(rec.districtId);return{p,rec}});return cands}

const districtResult=await buildDistrictOpportunityProfiles({locationQuery:city,includeDebug:true})
const out:any[]=[]
for(const vibe of vibes){
  const input={persona,primaryVibe:vibe,city,distanceMode:'nearby' as const,budget:'balanced' as const}
  const intent=normalizeIntent(input)
  const lens=buildExperienceLens({intent})
  const scored=scoreVenueCollection((await retrieveVenues(intent,lens)).venues,intent,getCrewPolicy(intent.crew),lens,getRoleContract({intent}))
  const meta=new Map(scored.map(s=>{const h=s.venue.source.happenings??deriveVenueHappeningsSignals(s.venue);return[s.venue.id,{name:s.venue.name,event:(s.venue.settings.eventCapable||h.eventPotential>=0.58),performance:(s.venue.settings.performanceCapable||h.performancePotential>=0.58),music:s.venue.settings.musicCapable,nightlife:h.liveNightlifePotential>=0.58,cultural:h.culturalAnchorPotential>=0.58,major:h.majorVenueStrength>=0.58,current:h.currentRelevance>=0.62||s.venue.source.likelyOpenForCurrentWindow}] as const}))
  const recs=(await previewDistrictRecommendations(input)).recommendedDistricts
  const cands=buildDistrictCandidates(districtResult.ranked,recs)
  const sc=getHospitalityScenarioContract({city,persona,vibe})
  const ec=buildExperienceContractFromScenarioContract(sc)
  const idsBase=new Set<string>(),idsFinal=new Set<string>()
  const surv:any[]=[]
  for(const c of cands){const a0=c.rec?.tasteAggregation;if(!a0)continue;const a=applyEcs(applyExperienceContractToAggregation(applyScenarioContractToAggregation(a0,sc),ec),ecs);for(const id of aggIds(a))idsBase.add(id);const anchor=a.anchors.strongestHighlight;const st=a.ingredients.startCandidates[0];const wd=a.ingredients.windDownCandidates[0];if(anchor?.venueId)idsFinal.add(anchor.venueId);if(st?.venueId)idsFinal.add(st.venueId);if(wd?.venueId)idsFinal.add(wd.venueId);surv.push({anchor:anchor?.venueName,start:st?.venueName,windDown:wd?.venueName})}
  const notable=[...meta.entries()].filter(([,m])=>m.event||m.performance||m.music||m.nightlife||m.cultural||m.major).map(([id,m])=>({id,name:m.name,event:m.event,performance:m.performance,music:m.music,nightlife:m.nightlife,cultural:m.cultural,major:m.major,inAggregation:idsBase.has(id),inFinal:idsFinal.has(id)}))
  const died=notable.filter(n=>n.inAggregation&&!n.inFinal).slice(0,10)
  const survived=notable.filter(n=>n.inFinal).slice(0,10)
  out.push({vibe,survivedNotables:survived,diedAfterAggregation:died,survivorSpines:surv})
}
console.log(JSON.stringify(out,null,2))
