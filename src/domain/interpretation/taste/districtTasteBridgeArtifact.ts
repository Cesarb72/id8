import type { DistrictOpportunityProfile } from '../../../engines/district/types/districtTypes'
import type { TasteOpportunityAggregation } from './aggregateTasteOpportunityFromVenues'

export interface DistrictTasteBridgeSourceVenueEvidence {
  venueId: string
  venueName: string
  experienceFamily?: string
  primaryExperienceArchetype?: string
  momentIdentity?: string
  primaryActivationType?: string
}

export interface DistrictStructuralEntityFact {
  entityId: string
  entityName: string
  location: DistrictOpportunityProfile['centroid']
  type: string
  categories: string[]
  tags?: string[]
  signals?: {
    popularity?: number
    activity?: number
    trust?: number
    openNow?: boolean
  }
}

export interface DistrictStructuralMicroPocketFact {
  microPocketId: string
  centroid: DistrictOpportunityProfile['centroid']
  radiusM: number
  entityIds: string[]
  dominantCategories: string[]
  dominantLanes: string[]
  coherenceScore?: number
}

export interface DistrictStructuralAnchorFact {
  entityId: string
  entityName: string
  score: number
  reasons: string[]
}

// District -> Taste: structural facts only. Taste owns the meaning derived from them.
export interface DistrictStructuralFacts {
  identity: {
    pocketId: string
    label: string
    identityKind: DistrictOpportunityProfile['meta']['identityKind']
    sourcePocketId?: string
  }
  geometry: {
    centroid: DistrictOpportunityProfile['centroid']
    radiusM: number
    metrics?: {
      maxDistanceFromCentroidM?: number
      avgDistanceFromCentroidM?: number
      maxPairwiseDistanceM?: number
      bboxWidthM?: number
      bboxHeightM?: number
      elongationRatio?: number
      areaM2?: number
      densityEntitiesPerKm2?: number
    }
  }
  composition: {
    entityCount: number
    categories: string[]
    categoryCounts?: Record<string, number>
    typeCounts?: Record<string, number>
  }
  structuralSignals: {
    density?: number
    walkability?: number
    categoryDiversity?: number
    compactness?: number
    viability?: number
    classification?: DistrictOpportunityProfile['classification']
  }
  entities?: DistrictStructuralEntityFact[]
  hyperlocal?: {
    primaryMicroPocket?: DistrictStructuralMicroPocketFact
    secondaryMicroPockets?: DistrictStructuralMicroPocketFact[]
    primaryAnchor?: DistrictStructuralAnchorFact
    secondaryAnchors?: DistrictStructuralAnchorFact[]
    localSpecificityScore?: number
    structuralEvidenceSignals?: string[]
  }
  lineage: {
    origin: DistrictOpportunityProfile['meta']['origin']
    truthTier: DistrictOpportunityProfile['meta']['truthTier']
    clusteringSource: DistrictOpportunityProfile['meta']['clusteringSource']
    fallbackReasonCode?: DistrictOpportunityProfile['meta']['fallbackReasonCode']
    originNotes: string[]
  }
}

// Taste -> District/downstream: lens meaning authored by Taste, not District.
export interface TastePocketMeaning {
  experientialTags: DistrictOpportunityProfile['tasteSignals']['experientialTags']
  hospitalityMix: DistrictOpportunityProfile['tasteSignals']['hospitalityMix']
  ambianceProfile: DistrictOpportunityProfile['tasteSignals']['ambianceProfile']
  momentSeeds: DistrictOpportunityProfile['tasteSignals']['momentSeeds']
  momentPotential: DistrictOpportunityProfile['tasteSignals']['momentPotential']
  roleSupport?: TasteOpportunityAggregation['diagnostics']['roleCoverage']
  dominantEnergy?: TasteOpportunityAggregation['summary']['dominantEnergy']
  dominantSocialDensity?: TasteOpportunityAggregation['summary']['dominantSocialDensity']
  highlightPotential?: TasteOpportunityAggregation['summary']['highlightPotential']
  discoveryBalance?: TasteOpportunityAggregation['summary']['discoveryBalance']
  dominantArchetypes?: string[]
  dominantMomentIdentities?: string[]
  topExperienceFamilies?: string[]
  topActivationTypes?: string[]
  rationale?: string[]
}

export interface DistrictTasteBridgeArtifact {
  handoff?: {
    structuralFacts?: DistrictStructuralFacts
    tastePocketMeaning?: TastePocketMeaning
  }
  identity: {
    zoneId: string
    zoneLabel: string
    sourcePocketId?: string
    origin: DistrictOpportunityProfile['meta']['origin']
    truthTier: DistrictOpportunityProfile['meta']['truthTier']
  }
  districtLineage: {
    classification: DistrictOpportunityProfile['classification']
    categories: string[]
    radiusM: number
    entityCount: number
    hospitalityMix: DistrictOpportunityProfile['tasteSignals']['hospitalityMix']
    ambianceProfile: DistrictOpportunityProfile['tasteSignals']['ambianceProfile']
    momentSeeds: string[]
    districtMomentPotential: number
    whyHereSignals: string[]
    localSpecificityScore?: number
    primaryAnchorEntityId?: string
    primaryMicroPocketId?: string
  }
  tasteEnrichment: {
    aggregationPresent: boolean
    dominantEnergy?: TasteOpportunityAggregation['summary']['dominantEnergy']
    dominantSocialDensity?: TasteOpportunityAggregation['summary']['dominantSocialDensity']
    movementProfile?: TasteOpportunityAggregation['summary']['movementProfile']
    highlightPotential?: TasteOpportunityAggregation['summary']['highlightPotential']
    discoveryBalance?: TasteOpportunityAggregation['summary']['discoveryBalance']
    dominantArchetypes: string[]
    dominantMomentIdentities: string[]
    topExperienceFamilies: string[]
    topActivationTypes: string[]
    roleCoverage?: TasteOpportunityAggregation['diagnostics']['roleCoverage']
    sourceVenueCount: number
  }
  futurePlannerSignals: {
    zoneTone: string
    zoneVarietySignature: string
    zoneCenterpieceStrength: string
    zoneStartSupport: string
    zoneWindDownSupport: string
    zoneDifferentiationSignature: string
  }
  trace: {
    artifactVersion: string
    derivedFrom: string[]
    usesTasteAggregation: boolean
    usesSourceVenueEvidence: boolean
    notes: string[]
  }
}

function countByKey(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = value.trim()
    if (!key) {
      return acc
    }
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

function topKeys(values: string[], limit: number): string[] {
  return Object.entries(countByKey(values))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key]) => key)
}

function topKeysFromDistribution(
  distribution: Record<string, number> | undefined,
  limit: number,
): string[] {
  if (!distribution) {
    return []
  }
  return Object.entries(distribution)
    .filter((entry) => entry[1] > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key]) => key)
}

function getDistrictNativeExperienceFamilyFallback(
  profile: DistrictOpportunityProfile,
): string[] {
  const families = new Set<string>()
  const mix = profile.tasteSignals.hospitalityMix
  const ambiance = profile.tasteSignals.ambianceProfile
  const tags = new Set(
    profile.tasteSignals.experientialTags.map((tag) => tag.trim().toLowerCase()),
  )
  const seeds = profile.tasteSignals.momentSeeds.map((seed) => seed.trim().toLowerCase())

  if (mix.activity >= 0.26 || mix.drinks >= 0.24) {
    families.add('social')
  }
  if (mix.culture >= 0.22 || tags.has('arts-adjacent') || tags.has('curated')) {
    families.add('cultural')
  }
  if (mix.dining >= 0.24) {
    families.add(ambiance.intimacy === 'high' ? 'intimate' : 'dining')
  }
  if (mix.cafe >= 0.22) {
    families.add('ritual')
  }
  if (ambiance.energy === 'high' || seeds.some((seed) => /music|cocktail|late|night/.test(seed))) {
    families.add('eventful')
  }
  if (
    ambiance.intimacy === 'high' ||
    ambiance.noise === 'low' ||
    seeds.some((seed) => /wine|walk|wander|quiet|book|garden/.test(seed))
  ) {
    families.add('ambient')
  }
  if (
    tags.has('mixed-program') ||
    seeds.some((seed) => /gallery|museum|detour|explore|wander/.test(seed))
  ) {
    families.add('discovery')
  }

  return [...families].slice(0, 4)
}

function getZoneTone(
  profile: DistrictOpportunityProfile,
  aggregation?: TasteOpportunityAggregation,
): string {
  if (aggregation) {
    return `${aggregation.summary.dominantEnergy}_${aggregation.summary.dominantSocialDensity}`
  }
  const {
    ambianceProfile: { energy, intimacy },
  } = profile.tasteSignals
  if (energy === 'high') {
    return intimacy === 'high' ? 'lively_intimate' : 'lively_social'
  }
  if (energy === 'low') {
    return intimacy === 'high' ? 'calm_intimate' : 'calm_grounded'
  }
  return intimacy === 'high' ? 'balanced_intimate' : 'balanced_mixed'
}

function getZoneVarietySignature(
  profile: DistrictOpportunityProfile,
  aggregation?: TasteOpportunityAggregation,
): string {
  if (aggregation?.summary.discoveryBalance === 'novel') {
    return 'novel_discovery'
  }
  if (profile.tasteSignals.experientialTags.includes('mixed-program')) {
    return 'mixed_program'
  }
  const mix = profile.tasteSignals.hospitalityMix
  const dominantMix = Object.entries(mix).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'activity'
  return `${dominantMix}_leaning`
}

function getZoneCenterpieceStrength(
  profile: DistrictOpportunityProfile,
  aggregation?: TasteOpportunityAggregation,
): string {
  if (aggregation?.summary.highlightPotential) {
    return aggregation.summary.highlightPotential
  }
  if (profile.tasteSignals.momentPotential >= 0.7) {
    return 'high'
  }
  if (profile.tasteSignals.momentPotential >= 0.45) {
    return 'medium'
  }
  return 'low'
}

function getZoneStartSupport(
  profile: DistrictOpportunityProfile,
  aggregation?: TasteOpportunityAggregation,
): string {
  const startCoverage = aggregation?.diagnostics.roleCoverage.start
  if (typeof startCoverage === 'number') {
    if (startCoverage >= 3) {
      return 'strong'
    }
    if (startCoverage >= 1) {
      return 'available'
    }
    return 'thin'
  }
  return profile.tasteSignals.hospitalityMix.cafe >= 0.22 ||
    profile.tasteSignals.hospitalityMix.activity >= 0.25
    ? 'available'
    : 'thin'
}

function getZoneWindDownSupport(
  profile: DistrictOpportunityProfile,
  aggregation?: TasteOpportunityAggregation,
): string {
  const windDownCoverage = aggregation?.diagnostics.roleCoverage.windDown
  if (typeof windDownCoverage === 'number') {
    if (windDownCoverage >= 3) {
      return 'strong'
    }
    if (windDownCoverage >= 1) {
      return 'available'
    }
    return 'thin'
  }
  return profile.tasteSignals.ambianceProfile.intimacy === 'high' ||
    profile.tasteSignals.hospitalityMix.dining >= 0.24 ||
    profile.tasteSignals.hospitalityMix.cafe >= 0.18
    ? 'available'
    : 'thin'
}

function getZoneDifferentiationSignature(
  profile: DistrictOpportunityProfile,
  sourceVenueEvidence: DistrictTasteBridgeSourceVenueEvidence[],
  aggregation?: TasteOpportunityAggregation,
): string {
  const familySignal =
    aggregation?.signatures.archetypes[0] ??
    sourceVenueEvidence[0]?.experienceFamily ??
    profile.tasteSignals.experientialTags[0] ??
    'generic_zone'
  const anchorSignal =
    profile.hyperlocal?.primaryAnchor?.entityId ??
    profile.hyperlocal?.primaryMicroPocket.id ??
    profile.meta.identityKind
  return `${familySignal}:${anchorSignal}`
}

export function buildDistrictTasteBridgeArtifact(params: {
  districtProfile: DistrictOpportunityProfile
  tasteAggregation?: TasteOpportunityAggregation
  sourceVenueEvidence?: DistrictTasteBridgeSourceVenueEvidence[]
}): DistrictTasteBridgeArtifact {
  const { districtProfile, tasteAggregation } = params
  const sourceVenueEvidence = params.sourceVenueEvidence ?? []
  const whyHereSignals = districtProfile.hyperlocal?.whyHereSignals ?? []
  const dominantArchetypes = topKeys(
    [
      ...(tasteAggregation?.signatures.archetypes ?? []),
      ...sourceVenueEvidence
        .map((entry) => entry.primaryExperienceArchetype)
        .filter((value): value is string => Boolean(value)),
    ],
    4,
  )
  const dominantMomentIdentities = topKeys(
    [
      ...(tasteAggregation?.signatures.momentIdentities ?? []),
      ...sourceVenueEvidence
        .map((entry) => entry.momentIdentity)
        .filter((value): value is string => Boolean(value)),
      ],
    4,
  )
  const sourceVenueExperienceFamilies = topKeys(
    sourceVenueEvidence
      .map((entry) => entry.experienceFamily)
      .filter((value): value is string => Boolean(value)),
    4,
  )
  const topExperienceFamilies =
    sourceVenueExperienceFamilies.length > 0
      ? sourceVenueExperienceFamilies
      : (() => {
          const aggregationFamilies = topKeysFromDistribution(
            tasteAggregation?.diagnostics.familyDistribution,
            4,
          )
          if (aggregationFamilies.length > 0) {
            return aggregationFamilies
          }
          return getDistrictNativeExperienceFamilyFallback(districtProfile)
        })()
  const topActivationTypes = topKeys(
    sourceVenueEvidence
      .map((entry) => entry.primaryActivationType)
      .filter((value): value is string => Boolean(value)),
    4,
  )
  const traceNotes = [
    `district-origin:${districtProfile.meta.origin}`,
    `district-truth-tier:${districtProfile.meta.truthTier}`,
    `aggregation:${tasteAggregation ? 'present' : 'absent'}`,
    `source-evidence:${sourceVenueEvidence.length}`,
  ]
  if (whyHereSignals.length > 0) {
    traceNotes.push(`why-here:${whyHereSignals.slice(0, 2).join('|')}`)
  }

  return {
    identity: {
      zoneId: districtProfile.pocketId,
      zoneLabel: districtProfile.label,
      sourcePocketId: districtProfile.meta.sourcePocketId,
      origin: districtProfile.meta.origin,
      truthTier: districtProfile.meta.truthTier,
    },
    districtLineage: {
      classification: districtProfile.classification,
      categories: [...districtProfile.categories],
      radiusM: districtProfile.radiusM,
      entityCount: districtProfile.entityCount,
      hospitalityMix: {
        ...districtProfile.tasteSignals.hospitalityMix,
      },
      ambianceProfile: {
        ...districtProfile.tasteSignals.ambianceProfile,
      },
      momentSeeds: [...districtProfile.tasteSignals.momentSeeds],
      districtMomentPotential: districtProfile.tasteSignals.momentPotential,
      whyHereSignals: [...whyHereSignals],
      localSpecificityScore: districtProfile.hyperlocal?.localSpecificityScore,
      primaryAnchorEntityId: districtProfile.hyperlocal?.primaryAnchor?.entityId,
      primaryMicroPocketId: districtProfile.hyperlocal?.primaryMicroPocket.id,
    },
    tasteEnrichment: {
      aggregationPresent: Boolean(tasteAggregation),
      dominantEnergy: tasteAggregation?.summary.dominantEnergy,
      dominantSocialDensity: tasteAggregation?.summary.dominantSocialDensity,
      movementProfile: tasteAggregation?.summary.movementProfile,
      highlightPotential: tasteAggregation?.summary.highlightPotential,
      discoveryBalance: tasteAggregation?.summary.discoveryBalance,
      dominantArchetypes,
      dominantMomentIdentities,
      topExperienceFamilies,
      topActivationTypes,
      roleCoverage: tasteAggregation?.diagnostics.roleCoverage,
      sourceVenueCount:
        sourceVenueEvidence.length || tasteAggregation?.diagnostics.venueCount || 0,
    },
    futurePlannerSignals: {
      zoneTone: getZoneTone(districtProfile, tasteAggregation),
      zoneVarietySignature: getZoneVarietySignature(districtProfile, tasteAggregation),
      zoneCenterpieceStrength: getZoneCenterpieceStrength(districtProfile, tasteAggregation),
      zoneStartSupport: getZoneStartSupport(districtProfile, tasteAggregation),
      zoneWindDownSupport: getZoneWindDownSupport(districtProfile, tasteAggregation),
      zoneDifferentiationSignature: getZoneDifferentiationSignature(
        districtProfile,
        sourceVenueEvidence,
        tasteAggregation,
      ),
    },
    trace: {
      artifactVersion: 'district-taste-bridge.v1',
      derivedFrom: [
        'district_opportunity_profile',
        ...(tasteAggregation ? ['taste_opportunity_aggregation'] : []),
        ...(sourceVenueEvidence.length > 0 ? ['source_venue_taste_evidence'] : []),
      ],
      usesTasteAggregation: Boolean(tasteAggregation),
      usesSourceVenueEvidence: sourceVenueEvidence.length > 0,
      notes: traceNotes,
    },
  }
}
