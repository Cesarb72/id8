import { buildDistrictOpportunityProfiles } from './src/engines/district'
import { previewDistrictRecommendations } from './src/domain/previewDistrictRecommendations'
import { buildCanonicalInterpretationBundle } from './src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from './src/domain/bearings/buildContractGateWorld'
import { applyScenarioContractToAggregation } from './src/domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { getHospitalityScenarioContract } from './src/domain/interpretation/taste/scenarioContracts'

function normalize(v){if(!v)return'';return v.toLowerCase().replace(/\b(district|pocket|area|core)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function keys(v){const n=normalize(v);if(!n)return[];return [...new Set([n,n.replace(/\s+/g,'')])]} 
function tokens(v){const n=normalize(v);if(!n)return[];return n.split(' ').map(t=>t.trim()).filter(t=>t.length>=3)}
function scoreSubset(cand,rec){if(!cand.length||!rec.length)return 0;const set=new Set(rec);let overlap=0;for(const t of cand){if(set.has(t))overlap++}const cov=overlap/cand.length;if(overlap===0)return 0;if(cand.length<=2)return cov>=0.5?cov:0;if(overlap>=2&&cov>=0.5)return cov;return 0}

const city='San Jose', persona='romantic', vibe='lively'
const districtPreviewResult=await buildDistrictOpportunityProfiles({locationQuery:city,includeDebug:true})
const districtRecommendations=(await previewDistrictRecommendations({persona,primaryVibe:vibe,city,distanceMode:'nearby'})).recommendedDistricts
const bundle=buildCanonicalInterpretationBundle({persona,vibe,city,planningMode:'engine-led',entryPoint:'direction_selection',hasAnchor:false})
const gate=buildContractGateWorld({ranked:districtPreviewResult.ranked??[],context:{canonicalStrategyFamily:bundle.strategyFamily,canonicalStrategyFamilyResolution:bundle.strategyFamilyResolution,experienceContract:bundle.experienceContract,contractConstraints:bundle.contractConstraints},source:'audit.join'})
const rankedSource=gate.contractAwareRanking.ranked.length>0?gate.contractAwareRanking.ranked:(districtPreviewResult?.ranked??[])
const recEntries=districtRecommendations.filter(r=>Boolean(r.tasteAggregation)).map(r=>({r,lookup:[...new Set([...keys(r.label),...keys(r.districtId)])],tok:[...new Set([...tokens(r.label),...tokens(r.districtId)])]}))
const recByKey=new Map();for(const e of recEntries){for(const k of e.lookup){if(!recByKey.has(k))recByKey.set(k,e.r)}}
const used=new Set()
const candidates=rankedSource.slice(0,6).map((entry)=>{const p=entry.profile;const ckeys=[...new Set([...keys(p.label),...keys(p.pocketId),...keys(p.meta.sourcePocketId)])];let rec=ckeys.map(k=>recByKey.get(k)).find(Boolean);if(!rec){const ct=tokens(p.label);const best=recEntries.map(e=>({r:e.r,s:scoreSubset(ct,e.tok)})).filter(e=>e.s>0).sort((a,b)=>b.s-a.s||b.r.score-a.r.score||a.r.label.localeCompare(b.r.label))[0];rec=best?.r}if(rec)used.add(rec.districtId);return{id:p.pocketId,label:p.label,rec}})
const fallback=recEntries.map(e=>e.r).filter(r=>!used.has(r.districtId)).slice().sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label))
for(const c of candidates){if(!c.rec){const next=fallback.shift();if(next){c.rec=next;used.add(next.districtId)}}}
const contract=getHospitalityScenarioContract({city,persona,vibe})
const stage=candidates.map((c)=>{const agg=c.rec?.tasteAggregation?applyScenarioContractToAggregation(c.rec.tasteAggregation,contract):undefined;const hasAgg=Boolean(agg);const hasAnchor=Boolean(agg?.anchors.strongestHighlight?.venueId&&agg?.anchors.strongestHighlight?.venueName);const hasSupport=((agg?.ingredients.startCandidates.length??0)>0)||((agg?.ingredients.windDownCandidates.length??0)>0);return{pocketId:c.id,label:c.label,attachedLabel:c.rec?.label,hasAgg,hasAnchor,hasSupport,anchor:agg?.anchors.strongestHighlight?.venueName,anchorId:agg?.anchors.strongestHighlight?.venueId}})
const survivors=stage.filter(s=>s.hasAgg&&s.hasAnchor&&s.hasSupport)
const anchorKeys=new Set();const deduped=[];const dedupeDropped=[];for(const s of survivors){const k=(s.anchorId||'').toLowerCase();if(!k){dedupeDropped.push(s);continue}if(!anchorKeys.has(k)){anchorKeys.add(k);deduped.push(s)}else{dedupeDropped.push(s)}}
console.log(JSON.stringify({preSurfacing:stage.length,stage,survivorsBeforeDedupe:survivors.length,dedupeDropped:dedupeDropped.length,finalVisibleAtCap4:deduped.slice(0,4).length},null,2))
