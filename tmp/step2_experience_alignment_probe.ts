import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'
import { getHospitalityScenarioContract } from '../src/domain/interpretation/taste/scenarioContracts'
import { buildExperienceContractFromScenarioContract, type ExperienceContract } from '../src/domain/interpretation/contracts/experienceContract'
import { applyScenarioContractToAggregation } from '../src/domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { applyExperienceContractToAggregation } from '../src/domain/interpretation/taste/applyExperienceContractToOpportunityAggregation'
import type { TasteOpportunityAggregation } from '../src/domain/interpretation/taste/aggregateTasteOpportunityFromVenues'

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function getExperienceContractAlignmentScore(params: {
  contract: ExperienceContract | null
  aggregation: TasteOpportunityAggregation | undefined
  hasTemporal: boolean
  hasDiscoveryLike: boolean
  hasBothSupport: boolean
}): number {
  const { contract, aggregation, hasTemporal, hasDiscoveryLike, hasBothSupport } = params
  if (!contract || !aggregation) return 0.56
  let score = 0.56
  const energy = aggregation.summary.dominantEnergy
  const socialDensity = aggregation.summary.dominantSocialDensity
  const movement = aggregation.summary.movementProfile
  const discovery = aggregation.summary.discoveryBalance
  const highlightPotential = aggregation.summary.highlightPotential
  const supportCoverage = hasBothSupport ? 1 : 0.62

  if (contract.coordinationMode === 'pulse' || contract.highlightModel === 'multi_peak' || contract.pacingStyle === 'escalating') {
    score += energy === 'lively' ? 0.18 : energy === 'balanced' ? 0.08 : -0.12
    score += highlightPotential === 'high' ? 0.08 : highlightPotential === 'medium' ? 0.03 : -0.08
    score += movement === 'spread' || movement === 'moderate' ? 0.06 : -0.04
    score += hasTemporal ? 0.06 : -0.03
  }

  if (contract.coordinationMode === 'depth' || contract.highlightModel === 'earned_peak' || contract.pacingStyle === 'slow_build') {
    score += energy === 'calm' ? 0.14 : energy === 'balanced' ? 0.04 : -0.08
    score += socialDensity === 'intimate' ? 0.1 : socialDensity === 'mixed' ? 0.03 : -0.05
    score += movement === 'tight' || movement === 'moderate' ? 0.06 : -0.05
    score += discovery === 'balanced' ? 0.04 : discovery === 'familiar' ? 0.02 : -0.02
  }

  if (contract.coordinationMode === 'narrative' || contract.highlightModel === 'reflective_peak' || contract.pacingStyle === 'deliberate') {
    score += discovery === 'novel' ? 0.14 : discovery === 'balanced' ? 0.06 : -0.08
    score += energy === 'calm' || energy === 'balanced' ? 0.06 : -0.05
    score += movement === 'moderate' || movement === 'spread' ? 0.05 : -0.03
    score += hasDiscoveryLike ? 0.06 : -0.02
    score += hasTemporal ? -0.02 : 0
  }

  if (contract.socialPosture === 'shared_pulse') {
    score += socialDensity === 'social' ? 0.08 : socialDensity === 'mixed' ? 0.03 : -0.06
  } else if (contract.socialPosture === 'intimate') {
    score += socialDensity === 'intimate' ? 0.08 : socialDensity === 'mixed' ? 0.02 : -0.05
  } else if (contract.socialPosture === 'reflective') {
    score += hasDiscoveryLike ? 0.05 : 0
  }

  score += supportCoverage * 0.05
  return clampScore(score)
}

const city='San Jose'
const persona='romantic'
const vibes=['cozy','lively','cultured'] as const

for (const vibe of vibes) {
  const result = await previewDistrictRecommendations({ city, persona, primaryVibe: vibe, budget:'$$' })
  const scenario = getHospitalityScenarioContract({ city, persona, vibe })
  const experience = buildExperienceContractFromScenarioContract(scenario)
  const rows = result.recommendedDistricts
    .filter((d) => Boolean(d.tasteAggregation))
    .map((d) => {
      const shaped = applyExperienceContractToAggregation(
        applyScenarioContractToAggregation(d.tasteAggregation!, scenario),
        experience,
      )
      const hasTemporal = [...shaped.moments.primary, ...shaped.moments.secondary].some((m) => m.momentType === 'temporal')
      const hasDiscoveryLike = [...shaped.moments.primary, ...shaped.moments.secondary].some((m) => m.momentType === 'discovery' || m.momentType === 'community')
      const align = getExperienceContractAlignmentScore({
        contract: experience,
        aggregation: shaped,
        hasTemporal,
        hasDiscoveryLike,
        hasBothSupport: shaped.ingredients.startCandidates.length > 0 && shaped.ingredients.windDownCandidates.length > 0,
      })
      return {
        district: d.name,
        anchor: shaped.anchors.strongestHighlight?.venueName,
        energy: shaped.summary.dominantEnergy,
        discovery: shaped.summary.discoveryBalance,
        movement: shaped.summary.movementProfile,
        align,
      }
    })
    .sort((a,b)=>b.align-a.align)
    .slice(0,4)

  console.log('\n===ALIGN===', vibe)
  for (const row of rows) console.log(JSON.stringify(row))
}
