import { runGeneratePlan } from '../src/domain/runGeneratePlan'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildDistrictOpportunityProfiles } from '../src/engines/district/core/buildDistrictOpportunityProfiles'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds'
import { buildDirectionCandidates } from '../src/domain/direction/buildDirectionCandidates'
import { applyPersonaShaping } from '../src/domain/direction/applyPersonaShaping'
import { applyVibeShaping } from '../src/domain/direction/applyVibeShaping'
import { selectBestDistinctDirections } from '../src/domain/direction/selectBestDistinctDirections'
import { searchAnchorVenues } from '../src/domain/search/searchAnchorVenues'

const city = 'San Jose'
const persona = 'romantic' as const
const vibe = 'lively' as const

function normalize(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim() || undefined
}

function tokenize(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

function overlap(query: string, candidate: string): number {
  const q = new Set(tokenize(query))
  if (q.size === 0) return 0
  const c = tokenize(candidate)
  let count = 0
  for (const t of c) if (q.has(t)) count += 1
  return count / q.size
}

function inferIdentity(experienceFamily: string | undefined, cluster: string): 'social' | 'exploratory' | 'intimate' {
  const fam = (experienceFamily ?? '').toLowerCase()
  if (['intimate', 'ambient', 'indulgent'].includes(fam)) return 'intimate'
  if (['social', 'eventful', 'playful'].includes(fam)) return 'social'
  if (cluster === 'chill') return 'intimate'
  if (cluster === 'lively') return 'social'
  return 'exploratory'
}

function toInternalRole(role: 'start' | 'highlight' | 'windDown') {
  return role === 'start' ? 'warmup' : role === 'highlight' ? 'peak' : 'cooldown'
}

const preview = await buildDistrictOpportunityProfiles({ locationQuery: city, includeDebug: true })
const bundle = buildCanonicalInterpretationBundle({ persona, vibe, city, planningMode: 'engine-led', entryPoint: 'direction_selection', hasAnchor: false })
const gate = buildContractGateWorld({ ranked: preview.ranked, context: { persona, vibe, experienceContract: bundle.experienceContract, contractConstraints: bundle.contractConstraints }, source: 'audit.canonical' })
const worlds = buildStrategyAdmissibleWorlds({ contractGateWorld: gate, strategyFamily: bundle.strategyFamily, strategySummary: bundle.strategySemantics.summary })
const base = buildDirectionCandidates({ ranked: gate.contractAwareRanking.ranked, debug: preview.debug, candidatePoolLimit: Math.min(gate.admittedPockets.length, 10), contractGateWorld: gate, strategyAdmissibleWorlds: worlds, context: { persona, vibe, experienceContract: bundle.experienceContract, contractConstraints: bundle.contractConstraints } })
const finalSelection = selectBestDistinctDirections({ candidates: applyVibeShaping(applyPersonaShaping(base, persona), vibe), preShapeCandidates: base, requestedVibe: vibe, finalLimit: 3 })
const selected = finalSelection.finalists[0]
if (!selected) throw new Error('No selected direction candidate')

const generation = await runGeneratePlan({
  mode: 'build',
  planningMode: 'engine-led',
  persona,
  primaryVibe: vibe,
  city,
  district: selected.pocketLabel,
  distanceMode: 'nearby',
  selectedDirectionContext: {
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
  },
}, {
  sourceMode: 'curated',
  sourceModeOverrideApplied: true,
  debugMode: false,
  experienceContract: bundle.experienceContract,
  contractConstraints: bundle.contractConstraints,
})

const roles: Array<'start' | 'highlight' | 'windDown'> = ['start', 'highlight', 'windDown']
const results = [] as Array<Record<string, unknown>>
for (const role of roles) {
  const stop = generation.itinerary.stops.find((s) => s.role === role)
  const internal = toInternalRole(role)
  const scored = generation.selectedArc.stops.find((s) => s.role === internal)?.scoredVenue
  const provider = scored?.venue.source.providerRecordId ?? null
  const lat = scored?.venue.source.latitude ?? null
  const lng = scored?.venue.source.longitude ?? null
  const directPass = Boolean(provider && typeof lat === 'number' && typeof lng === 'number')

  const queryCandidates = [
    normalize(stop?.venueName),
    normalize(scored?.venue.name),
    normalize(scored?.candidateIdentity.traceLabel),
  ].filter((v): v is string => Boolean(v))

  let searchPass = false
  const attempts: Array<Record<string, unknown>> = []
  for (const query of [...new Set(queryCandidates)]) {
    const matches = await searchAnchorVenues({ query, city: stop?.city ?? city, neighborhood: stop?.neighborhood })
    const ranked = matches
      .map((match) => ({
        id: match.venue.id,
        name: match.venue.name,
        provider: match.venue.source.providerRecordId ?? null,
        lat: match.venue.source.latitude ?? null,
        lng: match.venue.source.longitude ?? null,
        overlap: overlap(query, match.venue.name),
      }))
      .filter((m) => Boolean(m.provider) && typeof m.lat === 'number' && typeof m.lng === 'number' && m.overlap > 0)
      .sort((a, b) => (b.overlap as number) - (a.overlap as number))
    attempts.push({ query, topRaw: matches[0] ? { id: matches[0].venue.id, provider: matches[0].venue.source.providerRecordId ?? null } : null, qualifiedCount: ranked.length })
    if (ranked.length > 0) {
      searchPass = true
      break
    }
  }

  results.push({
    role,
    stopVenueId: stop?.venueId ?? null,
    stopVenueName: stop?.venueName ?? null,
    directPass,
    directProvider: provider,
    directLat: lat,
    directLng: lng,
    searchPass,
    attempts,
  })
}

console.log(JSON.stringify({
  selectedDirection: { pocketId: selected.pocketId, strategyId: selected.directionStrategyId },
  contractGateStrength: gate.gateStrengthSummary,
  roleCanonicalResolution: results,
}, null, 2))
