import { buildDistrictOpportunityProfiles } from '../src/engines/district/index.ts'
for (const city of ['Austin, TX','Austin TX','Austin, Texas']) {
  const result = await buildDistrictOpportunityProfiles({ locationQuery: city, includeDebug: true })
  console.log(city, result.location.source, result.ranked.length, result.location.meta?.unresolvedReason ?? '')
}
