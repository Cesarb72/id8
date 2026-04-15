import { runGeneratePlan } from '../src/domain/runGeneratePlan'

const result = await runGeneratePlan({ city: 'San Jose', persona: 'friends', primaryVibe: 'lively', distanceMode: 'nearby' })
const t: any = result.trace
console.log('retrieval stageCounts', t.retrievalDiagnostics?.stageCounts)
console.log('liveSource keys', Object.keys(t.retrievalDiagnostics?.liveSource ?? {}))
console.log('liveSource', t.retrievalDiagnostics?.liveSource)
console.log('recommended district sample keys', Object.keys((t.recommendedDistricts?.[0] ?? {})))
console.log('recommended district sample', t.recommendedDistricts?.[0])
console.log('districtAnchor', t.districtAnchor)
console.log('selected stops', result.selectedArc.stops.map((s:any)=>({role:s.role,id:s.scoredVenue.venue.id,name:s.scoredVenue.venue.name,district:s.scoredVenue.venue.district,cat:s.scoredVenue.venue.category})))
