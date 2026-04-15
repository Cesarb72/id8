import { buildDistrictOpportunityProfiles } from '../src/engines/district/core/buildDistrictOpportunityProfiles'
import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy'
import { getRoleContract } from '../src/domain/contracts/getRoleContract'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues'
import { scoreVenueCollection } from '../src/domain/retrieval/scoreVenueFit'
import { getHospitalityScenarioContract } from '../src/domain/interpretation/taste/scenarioContracts'
import { buildExperienceContractFromScenarioContract } from '../src/domain/interpretation/contracts/experienceContract'
import { applyScenarioContractToAggregation } from '../src/domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { applyExperienceContractToAggregation } from '../src/domain/interpretation/taste/applyExperienceContractToOpportunityAggregation'

const city='San Jose'
const persona='romantic'
const vibe='cozy'
const targets=['La Foret','La Forêt','Hakone Gardens','Japanese Friendship Garden','Friendship Garden','Hedley Club Lounge','Willow Glen','Willow Court Wine Bar']
const ecs={exploration:'focused',discovery:'reliable',highlight:'standout'} as const

function norm(v?:string|null){return (v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function match(a?:string|null,b?:string|null){const x=norm(a),y=norm(b);if(!x||!y)return false;return x.includes(y)||y.includes(x)}
function dk(v?:string){if(!v)return'';return v.toLowerCase().replace(/\b(district|pocket|area|core)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function dkeys(v?:string){const n=dk(v);if(!n)return[];return [...new Set([n,n.replace(/\s+/g,'')])]} 
function dtokens(v?:string){const n=dk(v);if(!n)return[];return n.split(' ').map(t=>t.trim()).filter(t=>t.length>=3)}
function tokScore(c:string[],r:string[]){if(!c.length||!r.length)return 0;const rs=new Set(r);let o=0;for(const t of c){if(rs.has(t))o++}const cov=o/c.length;if(!o)return 0;if(c.length<=2)return cov>=0.5?cov:0;return o>=2&&cov>=0.5?cov:0}

function inc(s:any,t:string){if(t==='anchor')s.anchor++;else if(t==='supporting')s.supporting++;else if(t==='temporal')s.temporal++;else if(t==='discovery')s.discovery++;else s.community++}
function mvStats(ms:any[]){const m=new Map<string,any>();for(const x of ms){if(!x.venueId)continue;const s=m.get(x.venueId)??{maxStrength:0,anchor:0,supporting:0,temporal:0,discovery:0,community:0};s.maxStrength=Math.max(s.maxStrength,x.strength);inc(s,x.momentType);m.set(x.venueId,s)}return m}
function clamp(v:number){return Math.max(0,Math.min(1,v))}
function mscore(m:any,e:any){let s=m.strength*0.72+m.intentFit*0.2+m.timingRelevance*0.08;if(e.exploration==='focused'){if(m.momentType==='anchor')s+=0.08;else if(m.momentType==='supporting')s+=0.04}else{if(m.momentType==='discovery')s+=0.11;else if(m.momentType==='community')s+=0.09;else if(m.momentType==='temporal')s+=0.05;else if(m.momentType==='anchor')s-=0.03}if(e.discovery==='discover'){if(m.momentType==='discovery')s+=0.16;else if(m.momentType==='community')s+=0.12;else if(m.momentType==='anchor')s-=0.05}else if(m.momentType==='anchor')s+=0.1;else if(m.momentType==='supporting')s+=0.05;if(e.highlight==='standout'){if(m.momentType==='anchor')s+=0.14;else if(m.momentType==='temporal')s+=0.06}else if(m.momentType==='anchor')s-=0.1;else if(m.momentType==='supporting')s+=0.07;return s}
function reshapeMom(ms:any,e:any){const c=[...ms.primary,...ms.secondary];if(!c.length)return{primary:[],secondary:[]};const r=c.slice().sort((a,b)=>{const d=mscore(b,e)-mscore(a,e);if(d!==0)return d;if(b.strength!==a.strength)return b.strength-a.strength;return a.id.localeCompare(b.id)});const pc=Math.max(1,ms.primary.length),sc=ms.secondary.length;return{primary:r.slice(0,pc),secondary:r.slice(pc,pc+sc)}}
function cscore(c:any,role:string,stats:any,e:any,sh?:string){const s=stats.get(c.venueId);const ha=(s?.anchor??0)>0,hs=(s?.supporting??0)>0,hd=(s?.discovery??0)>0,hc=(s?.community??0)>0,ht=(s?.temporal??0)>0;let v=c.score;if(e.exploration==='focused'){v+=c.score*0.06;if(ha)v+=0.03}else{v+=hd||hc?0.1:0;v+=ht?0.04:0;v+=ha?-0.04:0.03;v+=(1-c.score)*0.03}if(e.discovery==='discover'){v+=hd?0.12:0;v+=hc?0.08:0;v-=ha&&!hd&&!hc?0.05:0}else{v+=ha?0.08:0;v+=hs?0.05:0;v-=hd?0.03:0}const hw=role==='highlight'?1:0.45;if(e.highlight==='standout'){v+=hw*(ha?0.12:0);v+=hw*(ht?0.05:0);v+=hw*c.score*0.04;if(role==='highlight'&&c.venueId===sh)v+=0.05}else{v-=hw*(ha?0.08:0);v+=hw*(hs?0.06:0);v+=hw*(hd?0.04:0);v+=hw*(1-c.score)*0.05}v+=(s?.maxStrength??0)*0.03;return clamp(v)}
function rankRole(cs:any[],role:string,stats:any,e:any,sh?:string){return cs.slice().sort((a,b)=>{const d=cscore(b,role,stats,e,sh)-cscore(a,role,stats,e,sh);if(d!==0)return d;if(b.score!==a.score)return b.score-a.score;return a.venueName.localeCompare(b.venueName)})}
function htier(c:any,orig:any){if(!c)return undefined;if(orig?.venueId===c.venueId)return orig.tier;if(c.score>=0.72)return 1;if(c.score>=0.56)return 2;return 3}
function shiftHP(v:string,dir:'up'|'down'){if(dir==='up'){if(v==='low')return'medium';if(v==='medium')return'high';return'high'}if(v==='high')return'medium';if(v==='medium')return'low';return'low'}
function shiftDB(v:string,dir:'toward_discover'|'toward_reliable'){if(dir==='toward_discover'){if(v==='familiar')return'balanced';if(v==='balanced')return'novel';return'novel'}if(v==='novel')return'balanced';if(v==='balanced')return'familiar';return'familiar'}
function applyEcs(a:any,e:any){const nm=reshapeMom(a.moments,e);const stats=mvStats([...nm.primary,...nm.secondary]);const sh=a.anchors.strongestHighlight?.venueId;const st=rankRole(a.ingredients.startCandidates,'start',stats,e,sh);const hi=rankRole(a.ingredients.highlightCandidates,'highlight',stats,e,sh);const wd=rankRole(a.ingredients.windDownCandidates,'windDown',stats,e,sh);const top=hi[0],tier=htier(top,a.anchors.strongestHighlight);const mp=e.exploration==='exploratory'?(a.summary.movementProfile==='tight'?'moderate':a.summary.movementProfile):(a.summary.movementProfile==='spread'?'moderate':a.summary.movementProfile);return{...a,summary:{...a.summary,movementProfile:mp,highlightPotential:e.highlight==='standout'?shiftHP(a.summary.highlightPotential,'up'):shiftHP(a.summary.highlightPotential,'down'),discoveryBalance:e.discovery==='discover'?shiftDB(a.summary.discoveryBalance,'toward_discover'):shiftDB(a.summary.discoveryBalance,'toward_reliable')},ingredients:{startCandidates:st,highlightCandidates:hi,windDownCandidates:wd},anchors:{strongestStart:st[0],strongestHighlight:top&&typeof tier==='number'?{...top,tier}:undefined,strongestWindDown:wd[0]},moments:nm}}

function aggIds(a:any){const s=new Set<string>();if(!a)return s;for(const c of a.ingredients.startCandidates)s.add(c.venueId);for(const c of a.ingredients.highlightCandidates)s.add(c.venueId);for(const c of a.ingredients.windDownCandidates)s.add(c.venueId);if(a.anchors.strongestStart?.venueId)s.add(a.anchors.strongestStart.venueId);if(a.anchors.strongestHighlight?.venueId)s.add(a.anchors.strongestHighlight.venueId);if(a.anchors.strongestWindDown?.venueId)s.add(a.anchors.strongestWindDown.venueId);for(const m of a.moments.primary){if(m.venueId)s.add(m.venueId)}for(const m of a.moments.secondary){if(m.venueId)s.add(m.venueId)}return s}

function buildDistrictCandidates(ranked:any[],recs:any[]){const entries=recs.filter(r=>Boolean(r.tasteAggregation)).map(r=>({r,keys:[...new Set([...dkeys(r.districtId),...dkeys(r.label)])],tokens:[...new Set([...dtokens(r.label),...dtokens(r.districtId)])]}));const by=new Map<string,any>();for(const e of entries){for(const k of e.keys){if(!by.has(k))by.set(k,e.r)}}const used=new Set<string>();const cands=ranked.slice(0,6).map(entry=>{const p=entry.profile;const ckeys=[...new Set([...dkeys(p.meta.sourcePocketId),...dkeys(p.pocketId),...dkeys(p.label)])];let rec=ckeys.map(k=>by.get(k)).find(Boolean);let join='key';if(!rec){const ct=[...new Set([...dtokens(p.meta.sourcePocketId),...dtokens(p.pocketId),...dtokens(p.label)])];const best=entries.map(e=>({r:e.r,s:tokScore(ct,e.tokens)})).filter(x=>x.s>0).sort((l,r)=>r.s-l.s||r.r.score-l.r.score||l.r.label.localeCompare(r.r.label))[0];rec=best?.r;join=rec?'token':'none'}if(rec)used.add(rec.districtId);return{entry,p,rec,join}});const fq=entries.map(e=>e.r).filter(r=>!used.has(r.districtId)).sort((l,r)=>r.score-l.score||l.label.localeCompare(r.label));for(const c of cands){if(c.rec)continue;const f=fq.shift();if(f){c.rec=f;c.join='fallback';used.add(f.districtId)}}return cands}

const intentInput={persona,primaryVibe:vibe,city,distanceMode:'nearby' as const,budget:'balanced' as const}
const intent=normalizeIntent(intentInput)
const lens=buildExperienceLens({intent})
const retrieval=await retrieveVenues(intent,lens)
const scored=scoreVenueCollection(retrieval.venues,intent,getCrewPolicy(intent.crew),lens,getRoleContract({intent}))
const rawIds=new Set(scored.map(s=>s.venue.id))
const districtResult=await buildDistrictOpportunityProfiles({locationQuery:city,includeDebug:true})
const recs=(await previewDistrictRecommendations(intentInput)).recommendedDistricts
const cands=buildDistrictCandidates(districtResult.ranked,recs)
const sc=getHospitalityScenarioContract({city,persona,vibe})
const ec=buildExperienceContractFromScenarioContract(sc)
const base=new Map<string,any>(),afterS=new Map<string,any>(),afterE=new Map<string,any>(),afterX=new Map<string,any>()
for(const c of cands){const a=c.rec?.tasteAggregation;if(!a)continue;base.set(c.p.pocketId,a);const s=applyScenarioContractToAggregation(a,sc);afterS.set(c.p.pocketId,s);const e=applyExperienceContractToAggregation(s,ec);afterE.set(c.p.pocketId,e);afterX.set(c.p.pocketId,applyEcs(e,ecs))}
const idsB=new Set<string>(),idsS=new Set<string>(),idsE=new Set<string>(),idsX=new Set<string>()
for(const a of base.values())for(const id of aggIds(a))idsB.add(id)
for(const a of afterS.values())for(const id of aggIds(a))idsS.add(id)
for(const a of afterE.values())for(const id of aggIds(a))idsE.add(id)
for(const a of afterX.values())for(const id of aggIds(a))idsX.add(id)

const survivors=[...afterX.entries()].map(([p,a])=>({p,anchor:a.anchors.strongestHighlight?.venueName??null,anchorId:a.anchors.strongestHighlight?.venueId??null,start:a.ingredients.startCandidates[0]?.venueName??null,windDown:a.ingredients.windDownCandidates[0]?.venueName??null,score:(a.anchors.strongestHighlight?.score??0)})).sort((l,r)=>r.score-l.score).slice(0,4)
const surfacedIds=new Set<string>();for(const s of survivors){if(s.anchorId)surfacedIds.add(s.anchorId)}

const namesById=new Map(scored.map(s=>[s.venue.id,s.venue.name]))
const targetRows=targets.map(t=>{const ids=[...rawIds].filter(id=>match(namesById.get(id),t));const inRaw=ids.length>0;const inBase=ids.some(id=>idsB.has(id));const inScenario=ids.some(id=>idsS.has(id));const inExperience=ids.some(id=>idsE.has(id));const inEcs=ids.some(id=>idsX.has(id));const inSurfaced=ids.some(id=>surfacedIds.has(id));const surfacedAsAnchor=survivors.some(s=>match(s.anchor,t));let droppedWhy:string|null=null;if(!inRaw)droppedWhy='not_in_retrieval_field';else if(!inBase)droppedWhy='not_in_aggregation_top_sets';else if(!inScenario||!inExperience||!inEcs)droppedWhy='demoted_in_shaping';else if(!inSurfaced&&!surfacedAsAnchor)droppedWhy='lost_in_final_surfacing';else if(inSurfaced&&!surfacedAsAnchor)droppedWhy='support_only_not_anchor';return{target:t,matchedVenueNames:ids.map(id=>namesById.get(id)).slice(0,8),inRaw,inBase,inScenario,inExperience,inEcs,inSurfaced,surfacedAsAnchor,droppedWhy}})

console.log(JSON.stringify({scenario:{city,persona,vibe},survivorAnchors:survivors,targetRows},null,2))
