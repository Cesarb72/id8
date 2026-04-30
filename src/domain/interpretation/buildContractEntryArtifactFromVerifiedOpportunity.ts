import type {
  CanonicalCandidateRouteArtifact,
  ContractEntryArtifact,
} from '../artifacts/contractEntryArtifact'
import type { BuiltScenarioStopPosition } from './construction/scenarioBuilder'

export interface VerifiedOpportunityArtifactBuilderEcsState {
  exploration: 'focused' | 'exploratory'
  discovery: 'reliable' | 'discover'
  highlight: 'casual' | 'standout'
}

interface VerifiedOpportunityArtifactBuilderStopOption {
  name: string
}

interface VerifiedOpportunityArtifactBuilderScenarioStop {
  position: BuiltScenarioStopPosition
  name: string
  whyThisStop?: string
}

interface VerifiedOpportunityArtifactBuilderScenarioNight {
  stops: VerifiedOpportunityArtifactBuilderScenarioStop[]
  evaluation?: ContractEntryArtifact['scenarioEvaluation']
}

interface VerifiedOpportunityArtifactBuilderWindDownDebug {
  finalRoleEligible?: boolean
  finalName?: string | null
}

export interface VerifiedOpportunityArtifactBuilderInput {
  id: string
  flavor: string
  anchor: {
    venueId: string
    name: string
    verificationReasons: string[]
  }
  starts: VerifiedOpportunityArtifactBuilderStopOption[]
  closes: VerifiedOpportunityArtifactBuilderStopOption[]
  nearbyHappenings: Array<{
    reason: string
  }>
  districtContext: {
    primaryDistrict: string
    secondaryDistricts?: string[]
  }
  fit: {
    confidenceLine: string
    matchLine?: string
  }
  storySpine: {
    start: string
    highlight: string
    windDown: string
  }
  selection: ContractEntryArtifact['selection']
  excellence: {
    localAuthority: number
  }
  whyTonightProofLine?: string
  scenarioWindDownDebug?: VerifiedOpportunityArtifactBuilderWindDownDebug
  scenarioNight?: VerifiedOpportunityArtifactBuilderScenarioNight
}

export function buildContractEntryArtifactFromVerifiedOpportunity(params: {
  opportunity: VerifiedOpportunityArtifactBuilderInput
  ecsState: VerifiedOpportunityArtifactBuilderEcsState
  useScenarioBackedArtifacts: boolean
}): ContractEntryArtifact | null {
  const { opportunity, ecsState, useScenarioBackedArtifacts } = params
  const secondaryDistrictContext =
    opportunity.districtContext.secondaryDistricts &&
    opportunity.districtContext.secondaryDistricts.length > 0
      ? ` / ${opportunity.districtContext.secondaryDistricts.join(', ')}`
      : ''
  const districtLine = `Mostly in ${opportunity.districtContext.primaryDistrict}${secondaryDistrictContext}`
  const authorityLine = `Authority ${Math.round(opportunity.excellence.localAuthority * 100)}%`
  const happeningsLine = opportunity.nearbyHappenings[0]?.reason

  if (useScenarioBackedArtifacts) {
    if (opportunity.scenarioWindDownDebug?.finalRoleEligible === false) {
      return null
    }
    const canonicalNight = opportunity.scenarioNight
    const canonicalStart = canonicalNight?.stops.find((stop) => stop.position === 'start')
    const canonicalHighlight = canonicalNight?.stops.find((stop) => stop.position === 'highlight')
    const canonicalWindDownName =
      opportunity.scenarioWindDownDebug?.finalName ?? opportunity.storySpine.windDown

    return {
      id: opportunity.id,
      sourceOpportunityId: opportunity.id,
      anchorVenueId: opportunity.anchor.venueId,
      anchorRole: 'highlight',
      anchorName: opportunity.anchor.name,
      routeTitle: opportunity.anchor.name,
      flavorLine: opportunity.flavor,
      routeSummary: opportunity.fit.confidenceLine,
      traits: buildStep2CardTraits(opportunity, ecsState),
      storySpine: {
        start: canonicalStart?.name ?? opportunity.storySpine.start,
        highlight: canonicalHighlight?.name ?? opportunity.storySpine.highlight,
        windDown: canonicalWindDownName,
      },
      districtLine,
      districtAnchorLine: `District anchor: ${opportunity.districtContext.primaryDistrict}`,
      authorityLine,
      happeningsLine,
      whyChooseLine: canonicalHighlight?.whyThisStop ?? opportunity.fit.confidenceLine,
      whyTonightProofLine: opportunity.whyTonightProofLine,
      scenarioEvaluation: canonicalNight?.evaluation,
      selection: opportunity.selection,
    }
  }

  const repairedStorySpine = validateOrRepairStep2StorySpine(opportunity)
  return {
    id: opportunity.id,
    sourceOpportunityId: opportunity.id,
    anchorVenueId: opportunity.anchor.venueId,
    anchorRole: 'highlight',
    anchorName: opportunity.anchor.name,
    routeTitle: opportunity.anchor.name,
    flavorLine: opportunity.flavor,
    routeSummary: opportunity.fit.confidenceLine,
    traits: buildStep2CardTraits(opportunity, ecsState),
    storySpine: repairedStorySpine,
    districtLine,
    districtAnchorLine: `District anchor: ${opportunity.districtContext.primaryDistrict}`,
    authorityLine,
    happeningsLine,
    whyChooseLine:
      opportunity.anchor.verificationReasons[0] ??
      opportunity.fit.matchLine ??
      opportunity.fit.confidenceLine,
    whyTonightProofLine: opportunity.whyTonightProofLine,
    selection: opportunity.selection,
  }
}

function buildStep2CardTraits(
  opportunity: VerifiedOpportunityArtifactBuilderInput,
  ecs: VerifiedOpportunityArtifactBuilderEcsState,
): string[] {
  const explorationTrait = ecs.exploration === 'exploratory' ? 'Exploratory' : 'Focused'
  const discoveryTrait =
    ecs.discovery === 'discover' || opportunity.nearbyHappenings.length > 0
      ? 'Discovery-forward'
      : 'Reliable'
  const flavorCorpus = `${opportunity.flavor} ${opportunity.fit.matchLine ?? ''}`.toLowerCase()
  const vibeTrait =
    flavorCorpus.includes('culture') ||
    flavorCorpus.includes('museum') ||
    flavorCorpus.includes('gallery')
      ? 'Cultural'
      : flavorCorpus.includes('intimate') ||
          flavorCorpus.includes('cozy') ||
          flavorCorpus.includes('romantic')
        ? 'Intimate'
        : flavorCorpus.includes('lively') ||
            flavorCorpus.includes('pulse') ||
            flavorCorpus.includes('energetic')
          ? 'Lively'
          : ecs.highlight === 'standout'
            ? 'Standout'
            : 'Balanced'
  return [explorationTrait, discoveryTrait, vibeTrait]
}

function uniqueStopNames(names: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  names.forEach((name) => {
    const trimmed = (name ?? '').trim()
    if (!trimmed) {
      return
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    ordered.push(trimmed)
  })
  return ordered
}

function firstDistinctStop(candidates: string[], blocked: string[]): string | null {
  const blockedSet = new Set(blocked.map((value) => value.trim().toLowerCase()))
  for (const candidate of candidates) {
    if (!blockedSet.has(candidate.toLowerCase())) {
      return candidate
    }
  }
  return null
}

function validateOrRepairStep2StorySpine(
  opportunity: VerifiedOpportunityArtifactBuilderInput,
): CanonicalCandidateRouteArtifact['storySpine'] {
  const fallbackHighlight = opportunity.anchor.name || opportunity.storySpine.highlight
  const highlight = fallbackHighlight.trim()
  const startCandidates = uniqueStopNames([
    ...opportunity.starts.map((entry) => entry.name),
    opportunity.storySpine.start,
    ...opportunity.closes.map((entry) => entry.name),
  ])
  const windDownCandidates = uniqueStopNames([
    ...opportunity.closes.map((entry) => entry.name),
    opportunity.storySpine.windDown,
    ...opportunity.starts.map((entry) => entry.name),
  ])
  const fallbackStart = startCandidates[0] ?? opportunity.storySpine.start
  const start = firstDistinctStop(startCandidates, [highlight]) ?? fallbackStart
  const fallbackWindDown =
    windDownCandidates[0] ?? opportunity.storySpine.windDown ?? opportunity.storySpine.start
  const windDown =
    firstDistinctStop(windDownCandidates, [highlight, start]) ??
    firstDistinctStop(windDownCandidates, [highlight]) ??
    fallbackWindDown

  return {
    start: start || opportunity.storySpine.start,
    highlight: highlight || opportunity.storySpine.highlight,
    windDown: windDown || opportunity.storySpine.windDown,
  }
}
