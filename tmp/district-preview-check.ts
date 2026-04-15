import { buildDistrictOpportunityProfiles } from '../src/engines/district/index.ts'

for (const city of ['San Jose','Denver','Austin']) {
  const result = await buildDistrictOpportunityProfiles({ locationQuery: city, includeDebug: true })
  console.log(city, result.location.source, result.ranked.length, result.location.meta?.unresolvedReason ?? '')
}
