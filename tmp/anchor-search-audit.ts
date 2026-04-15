import { searchAnchorVenues } from '../src/domain/search/searchAnchorVenues'

const results = await searchAnchorVenues({ query: 'Theatre District Jazz Cellar', city: 'San Jose' })
console.log(JSON.stringify(results.map((r) => ({ id: r.venue.id, name: r.venue.name, provider: r.venue.source.providerRecordId ?? null, lat: r.venue.source.latitude ?? null, lng: r.venue.source.longitude ?? null })), null, 2))
