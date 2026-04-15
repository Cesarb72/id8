import { buildDistrictOpportunityProfiles } from '../src/engines/district/core/buildDistrictOpportunityProfiles'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds'
import { buildDirectionCandidates } from '../src/domain/direction/buildDirectionCandidates'
import { applyPersonaShaping } from '../src/domain/direction/applyPersonaShaping'
import { applyVibeShaping } from '../src/domain/direction/applyVibeShaping'
import { selectBestDistinctDirections } from '../src/domain/direction/selectBestDistinctDirections'
import { runGeneratePlan } from '../src/domain/runGeneratePlan'

const city = 'San Jose'
const persona = 'romantic' as const
const vibe = 'lively' as const

function inferIdentity(experienceFamily: string | undefined, cluster: string): 'social' | 'exploratory' | 'intimate' {
  const fam = (experienceFamily ?? '').toLowerCase()
  if (['intimate', 'ambient', 'indulgent'].includes(fam)) return 'intimate'
  if (['social', 'eventful', 'playful'].includes(fam)) return 'social'
  if (cluster === 'chill') return 'intimate'
  if (cluster === 'lively') return 'social'
  return 'exploratory'
}

const preview = await buildDistrictOpportunityProfiles({ locationQuery: city, includeDebug: true })
const bundle = buildCanonicalInterpretationBundle({
  persona,
  vibe,
  city,
  planningMode: 'engine-led',
  entryPoint: 'direction_selection',
  hasAnchor: false,
})
const gate = buildContractGateWorld({
  ranked: preview.ranked,
  context: {
    persona,
    vibe,
    experienceContract: bundle.experienceContract,
    contractConstraints: bundle.contractConstraints,
  },
  source: 'audit.script',
})
const strategyWorlds = buildStrategyAdmissibleWorlds({
  contractGateWorld: gate,
  strategyFamily: bundle.strategyFamily,
  strategySummary: bundle.strategySemantics.summary,
})

const baseCandidates = buildDirectionCandidates({
  ranked: gate.contractAwareRanking.ranked,
  debug: preview.debug,
  candidatePoolLimit: Math.min(gate.admittedPockets.length, 10),
  contractGateWorld: gate,
  strategyAdmissibleWorlds: strategyWorlds,
  context: {
    persona,
    vibe,
    experienceContract: bundle.experienceContract,
    contractConstraints: bundle.contractConstraints,
  },
})
const personaShaped = applyPersonaShaping(baseCandidates, persona)
const vibeShaped = applyVibeShaping(personaShaped, vibe)
const finalSelection = selectBestDistinctDirections({
  candidates: vibeShaped,
  preShapeCandidates: baseCandidates,
  requestedVibe: vibe,
  finalLimit: 3,
})
const correctedWinnerId = finalSelection.debug.correctedWinnerId ?? finalSelection.finalists[0]?.pocketId
const finalistsByPocketId = new Map(finalSelection.finalists.map((candidate) => [candidate.pocketId, candidate]))
const correctedWinner = correctedWinnerId ? finalistsByPocketId.get(correctedWinnerId) : undefined
const directionCandidates = [
  ...(correctedWinner ? [correctedWinner] : []),
  ...finalSelection.finalists.filter((candidate) => candidate.pocketId !== correctedWinner?.pocketId),
].slice(0, 3)

const selected = directionCandidates[0]

const selectedDirectionContext = selected
  ? {
      directionId: selected.pocketId,
      label: selected.label,
      pocketId: selected.pocketId,
      archetype: selected.archetype,
      identity: inferIdentity(selected.experienceFamily, selected.cluster),
      subtitle: selected.subtitle,
      reasons: selected.reasons,
      family: selected.experienceFamily,
      familyConfidence: selected.familyConfidence,
      cluster: selected.cluster,
    }
  : undefined

const generation = selected
  ? await runGeneratePlan(
      {
        mode: 'build',
        planningMode: 'engine-led',
        persona,
        primaryVibe: vibe,
        city,
        district: selected.pocketLabel,
        distanceMode: 'nearby',
        refinementModes: [],
        selectedDirectionContext,
      },
      {
        sourceMode: 'curated',
        sourceModeOverrideApplied: true,
        debugMode: false,
        experienceContract: bundle.experienceContract,
        contractConstraints: bundle.contractConstraints,
      },
    )
  : undefined

const output = {
  preview: {
    rankedCount: preview.ranked.length,
    topPocketIds: preview.ranked.slice(0, 5).map((entry) => entry.profile.pocketId),
  },
  interpretation: {
    strategyFamily: bundle.strategyFamily,
    contractIdentity: bundle.experienceContract.contractIdentity,
    coordinationMode: bundle.experienceContract.coordinationMode,
    constraints: {
      peakCountModel: bundle.contractConstraints.peakCountModel,
      requireEscalation: bundle.contractConstraints.requireEscalation,
      requireContinuity: bundle.contractConstraints.requireContinuity,
      windDownStrictness: bundle.contractConstraints.windDownStrictness,
    },
  },
  contractGate: {
    summary: gate.gateSummary,
    strength: gate.gateStrengthSummary,
    admittedCount: gate.admittedPockets.length,
    suppressedCount: gate.suppressedPockets.length,
    rejectedCount: gate.rejectedPockets.length,
    allowedPreview: gate.debug.allowedPreview,
    suppressedPreview: gate.debug.suppressedPreview,
    rejectedPreview: gate.debug.rejectedPreview,
  },
  strategyWorlds: strategyWorlds.map((world) => ({
    strategyId: world.strategyId,
    admittedCount: world.debug.admittedCount,
    suppressedCount: world.debug.suppressedCount,
    rejectedCount: world.debug.rejectedCount,
    fallbackAdmittedCount: world.debug.fallbackAdmittedCount,
    survivabilityStatus: world.debug.survivabilityStatus,
    topFailureReasons: world.debug.topFailureReasons,
    summary: world.summary,
  })),
  directions: directionCandidates.map((candidate) => ({
    pocketId: candidate.pocketId,
    strategyId: candidate.directionStrategyId,
    strategySource: candidate.directionStrategySource,
    strategyWorldId: candidate.selectedStrategyWorldId,
    strategyWorldStatus: candidate.directionStrategyWorldStatus,
    strategyWorldReason: candidate.directionStrategyWorldReasonSummary,
    family: candidate.experienceFamily,
    familyConfidence: candidate.familyConfidence,
  })),
  generation: generation
    ? {
        itineraryId: generation.itinerary.id,
        stopRoles: generation.itinerary.stops.map((stop) => stop.role),
        rolePoolSizes: generation.trace.rolePoolSizes,
        rolePoolVenueIdsByRole: generation.trace.rolePoolVenueIdsByRole,
        generationMode: generation.trace.mode,
        sourceMode: generation.trace.sourceMode,
        selectedArcStops: generation.selectedArc.stops.map((stop) => ({
          role: stop.role,
          venueId: stop.scoredVenue.venue.id,
          venueName: stop.scoredVenue.venue.name,
          providerRecordId: stop.scoredVenue.venue.source.providerRecordId ?? null,
          lat: stop.scoredVenue.venue.source.latitude ?? null,
          lng: stop.scoredVenue.venue.source.longitude ?? null,
          roleScores: stop.scoredVenue.roleScores,
          stopShapeFit: stop.scoredVenue.stopShapeFit,
        })),
      }
    : null,
}

console.log(JSON.stringify(output, null, 2))
