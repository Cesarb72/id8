import { buildRolePools } from './arc/buildRolePools'
import { deriveVenueHappeningsSignals } from './normalize/deriveVenueHappeningsSignals'
import { getRoleContract } from './contracts/getRoleContract'
import {
  aggregateTasteOpportunityFromVenues,
  type TasteAggregatedVenueInput,
  type TasteOpportunityAggregation,
} from './interpretation/taste/aggregateTasteOpportunityFromVenues'
import { resolveDistrictAnchor } from './interpretation/district/resolveDistrictAnchor'
import { recommendDistricts } from './interpretation/district/recommendDistricts'
import { buildExperienceLens } from './intent/buildExperienceLens'
import { getCrewPolicy } from './intent/getCrewPolicy'
import { normalizeIntent } from './intent/normalizeIntent'
import { retrieveVenues } from './retrieval/retrieveVenues'
import { scoreVenueCollection } from './retrieval/scoreVenueFit'
import { getVenueClusterId } from './spatial/getVenueClusterId'
import type { ScoredVenue } from './types/arc'
import type { DistrictRecommendation } from './types/district'
import type { IntentInput } from './types/intent'
import type { SourceMode } from './types/sourceMode'
import type { StarterPack } from './types/starterPack'

interface PreviewDistrictRecommendationsOptions {
  starterPack?: StarterPack
  strictShape?: boolean
  sourceMode?: SourceMode
  sourceModeOverrideApplied?: boolean
}

export interface DistrictPreviewResult {
  recommendedDistricts: DistrictRecommendation[]
  topDistrictId?: string
}

function toTasteHoursStatus(scoredVenue: ScoredVenue): string {
  const source = scoredVenue.venue.source
  if (
    source.businessStatus === 'closed-permanently' ||
    source.businessStatus === 'temporarily-closed'
  ) {
    return 'closed'
  }
  if (source.hoursPressureLevel === 'strong-open') {
    return 'open'
  }
  if (source.hoursPressureLevel === 'likely-open') {
    return 'likely_open'
  }
  if (source.hoursPressureLevel === 'likely-closed') {
    return 'likely_closed'
  }
  if (source.hoursPressureLevel === 'closed') {
    return 'closed'
  }
  return source.hoursKnown ? 'uncertain' : 'unknown'
}

function buildDistrictTasteAggregationByDistrictId(
  scoredVenues: ScoredVenue[],
  city: string,
  context: {
    persona?: string
    vibe?: string
    timeWindow?: string
  },
): Map<string, TasteOpportunityAggregation> {
  const inputsByDistrictId = new Map<string, TasteAggregatedVenueInput[]>()
  for (const scoredVenue of scoredVenues) {
    const clusterId = getVenueClusterId(scoredVenue.venue)
    const districtAnchor = resolveDistrictAnchor({
      city,
      district: clusterId,
    })
    const currentInputs = inputsByDistrictId.get(districtAnchor.districtId) ?? []
    currentInputs.push({
      venueId: scoredVenue.venue.id,
      venueName: scoredVenue.venue.name,
      districtId: districtAnchor.districtId,
      districtLabel: districtAnchor.districtLabel,
      lat: scoredVenue.venue.source.latitude,
      lng: scoredVenue.venue.source.longitude,
      fitScore: scoredVenue.fitScore,
      tasteSignals: scoredVenue.taste.signals,
      happenings: scoredVenue.venue.source.happenings ?? deriveVenueHappeningsSignals(scoredVenue.venue),
      context,
      sourceFlags: {
        eventCapable: scoredVenue.venue.settings.eventCapable,
        musicCapable: scoredVenue.venue.settings.musicCapable,
        performanceCapable: scoredVenue.venue.settings.performanceCapable,
        highlightCapable: scoredVenue.venue.highlightCapable,
        hasHappyHour: scoredVenue.venue.tags.some((tag) => tag.toLowerCase().includes('happy hour')),
      },
      hoursStatus: toTasteHoursStatus(scoredVenue),
      hoursConfidence: scoredVenue.venue.source.timeConfidence,
    })
    inputsByDistrictId.set(districtAnchor.districtId, currentInputs)
  }

  const aggregationByDistrictId = new Map<string, TasteOpportunityAggregation>()
  for (const [districtId, districtInputs] of inputsByDistrictId.entries()) {
    aggregationByDistrictId.set(
      districtId,
      aggregateTasteOpportunityFromVenues(districtInputs),
    )
  }
  return aggregationByDistrictId
}

export async function previewDistrictRecommendations(
  input: IntentInput,
  options: PreviewDistrictRecommendationsOptions = {},
): Promise<DistrictPreviewResult> {
  const intent = normalizeIntent({
    ...input,
    district: undefined,
  })
  const lens = buildExperienceLens({
    intent,
    starterPack: options.starterPack,
    strictShape: options.strictShape,
  })
  const crewPolicy = getCrewPolicy(intent.crew)
  const roleContracts = getRoleContract({
    intent,
    starterPack: options.starterPack,
    strictShapeEnabled: options.strictShape,
  })
  const retrieval = await retrieveVenues(intent, lens, {
    requestedSourceMode: options.sourceMode,
    sourceModeOverrideApplied: options.sourceModeOverrideApplied,
    starterPack: options.starterPack,
  })
  const scoredVenues = scoreVenueCollection(
    retrieval.venues,
    intent,
    crewPolicy,
    lens,
    roleContracts,
    options.starterPack,
  )
  const rolePools = buildRolePools(
    scoredVenues,
    crewPolicy,
    lens,
    intent,
    roleContracts,
    options.strictShape,
  )
  const recommendedDistricts = recommendDistricts({
    scoredVenues,
    rolePools,
    intent,
    limit: 6,
  })
  const tasteAggregationByDistrictId = buildDistrictTasteAggregationByDistrictId(
    scoredVenues,
    intent.city,
    {
      persona: intent.persona ?? undefined,
      vibe: intent.primaryAnchor ?? undefined,
      timeWindow: intent.timeWindow,
    },
  )
  const recommendedDistrictsWithTaste = recommendedDistricts.map((district) => ({
    ...district,
    tasteAggregation: tasteAggregationByDistrictId.get(district.districtId),
  }))

  return {
    recommendedDistricts: recommendedDistrictsWithTaste,
    topDistrictId: recommendedDistrictsWithTaste[0]?.districtId,
  }
}
