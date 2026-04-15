import { runGeneratePlan } from '../src/domain/runGeneratePlan'

const result = await runGeneratePlan({ city: 'San Jose', persona: 'family', primaryVibe: 'cultured', distanceMode: 'nearby' })
const stop = result.selectedArc.stops[0].scoredVenue.venue as any
console.log(Object.keys(stop))
console.log({address: stop.address, formattedAddress: stop.formattedAddress, neighborhood: stop.neighborhood, district: stop.district, city: stop.city, source: stop.source})
