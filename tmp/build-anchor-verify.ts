import { runGeneratePlan } from '../src/domain/runGeneratePlan'
import { searchAnchorVenues } from '../src/domain/search/searchAnchorVenues'

type Chip = 'restaurant' | 'movie' | 'drinks' | 'park' | 'activity'

async function testAnchor(query: string, chip: Chip) {
  const city = 'San Jose'
  const results = await searchAnchorVenues({ query, city, chip })
  if (results.length === 0) {
    return { query, chip, found: false }
  }
  const anchor = results[0]!.venue
  try {
    const result = await runGeneratePlan(
      {
        mode: 'build',
        planningMode: 'user-led',
        persona: 'romantic',
        primaryVibe: 'lively',
        city,
        distanceMode: 'nearby',
        anchor: {
          venueId: anchor.id,
          role: 'highlight',
        },
      },
      {
        sourceMode: 'curated',
        sourceModeOverrideApplied: true,
        debugMode: false,
      },
    )
    const hasAnchor = result.itinerary.stops.some((stop) => stop.venueId === anchor.id)
    return {
      query,
      chip,
      found: true,
      anchorId: anchor.id,
      anchorName: anchor.name,
      hasAnchor,
      roles: result.itinerary.stops.map((s) => ({ role: s.role, venueId: s.venueId, name: s.venueName })),
    }
  } catch (error) {
    return {
      query,
      chip,
      found: true,
      anchorId: anchor.id,
      anchorName: anchor.name,
      hasAnchor: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const checks: Array<[string, Chip]> = [
    ['petiscos', 'restaurant'],
    ['orchard city kitchen', 'restaurant'],
    ['jazz', 'drinks'],
    ['restaurant', 'restaurant'],
    ['drinks', 'drinks'],
    ['park', 'park'],
    ['activity', 'activity'],
  ]
  const out = []
  for (const [query, chip] of checks) {
    out.push(await testAnchor(query, chip))
  }
  console.log(JSON.stringify(out, null, 2))
}

void main()
