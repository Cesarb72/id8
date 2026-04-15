import { useEffect, useMemo, useRef, useState } from 'react'
import { ProgressDots } from '../components/flow/ProgressDots'
import { starterPacks } from '../data/starterPacks'
import {
  canApplyComposeSearchResult,
  getComposeActionTargetRole,
  getDraftComposeActions,
  insertArcStop,
  type DraftComposeActionId,
  type DraftComposeSearchActionId,
  type DraftComposeSearchResult,
} from '../domain/arc/composeDraftArc'
import { getRoleAlternatives } from '../domain/arc/getRoleAlternatives'
import { isValidArcCombination } from '../domain/arc/isValidArcCombination'
import {
  getRoleShapeActions,
  reshapeArcStop,
  type DraftRoleShapeActionId,
} from '../domain/arc/reshapeArcStop'
import { scoreArcAssembly } from '../domain/arc/scoreArcAssembly'
import { swapArcStop } from '../domain/arc/swapArcStop'
import { inverseRoleProjection, roleProjection } from '../domain/config/roleProjection'
import { getRoleContract } from '../domain/contracts/getRoleContract'
import type { DiscoveryDirection } from '../domain/discovery/getDiscoveryCandidates'
import { getDiscoveryCandidates } from '../domain/discovery/getDiscoveryCandidates'
import { deriveLightNearbyExtensions } from '../domain/exploration/deriveLightNearbyExtensions'
import { planExploration } from '../domain/exploration/planExploration'
import { getCrewPolicy } from '../domain/intent/getCrewPolicy'
import { projectItinerary } from '../domain/itinerary/projectItinerary'
import { normalizeRawPlace } from '../domain/normalize/normalizeRawPlace'
import { getNearbyAlternatives } from '../domain/retrieval/getNearbyAlternatives'
import { scoreVenueFit } from '../domain/retrieval/scoreVenueFit'
import {
  generatePlanAdjustmentFeedback,
} from '../domain/interpretation/adjustment/generatePlanAdjustmentFeedback'
import { runGeneratePlan, type GenerationTrace } from '../domain/runGeneratePlan'
import { searchAnchorVenues } from '../domain/search/searchAnchorVenues'
import { getSourceMode } from '../domain/sources/getSourceMode'
import { proposeLceRepair, type LceRepairProposal, type LceRepairTrigger } from '../domain/lce/lceRepair'
import {
  SessionStoreProvider,
  useSessionStore,
  type FlowStep,
  type SessionState,
  type UserComposedStop,
} from './state/sessionStore'
import { assertCanonicalSelectedDirectionContext } from './wrapper/arcWrapperBoundary'
import { CurateExperiencePage } from '../pages/CurateExperiencePage'
import { GeneratingPage } from '../pages/GeneratingPage'
import { LandingPage } from '../pages/LandingPage'
import { MoodSelectionPage } from '../pages/MoodSelectionPage'
import { PreviewPage } from '../pages/PreviewPage'
import { RevealPage } from '../pages/RevealPage'
import { TicketPage } from '../pages/TicketPage'
import {
  consumeLiveArtifactExitNotice,
  type LiveArtifactExitNotice,
} from '../domain/live/liveArtifactSession'
import {
  getVibeLabel,
  type ExperienceMode,
  type PreferredDiscoveryVenue,
  type IntentInput,
  type IntentProfile,
  type VibeAnchor,
} from '../domain/types/intent'
import type { ArcCandidate, ScoredVenue } from '../domain/types/arc'
import type { ExperienceLens } from '../domain/types/experienceLens'
import type { Itinerary, UserStopRole } from '../domain/types/itinerary'
import type { PlanAdjustmentFeedback } from '../domain/types/planAdjustmentFeedback'
import type {
  PreviewControls,
  PreviewDistanceTolerance,
} from '../domain/types/previewControls'
import type { RawPlace } from '../domain/types/rawPlace'
import type { RefinementMode } from '../domain/types/refinement'
import type { StarterPack } from '../domain/types/starterPack'
import type { Venue } from '../domain/types/venue'
import type { InternalRole, VenueCategory } from '../domain/types/venue'
import { createId } from '../lib/ids'
import { readDevOriginMode, writeDevOriginMode } from './devRoutingState'

const stepProgress: Record<FlowStep, number> = {
  landing: 0,
  curate: 1,
  crew: 1,
  mood: 2,
  preview: 3,
  location: 3,
  how: 4,
  district: 4,
  discovery: 4,
  generating: 4,
  reveal: 4,
  ticket: 4,
}

type AppEnvironment = 'default' | 'dev' | 'archive'
type DevStartMode = Extract<ExperienceMode, 'surprise' | 'curate' | 'build'>

function buildDiscoveryRoleLookup(
  discoveryDirections?: DiscoveryDirection[],
): Map<string, PreferredDiscoveryVenue['role']> {
  const roleByVenueId = new Map<string, PreferredDiscoveryVenue['role']>()
  if (!discoveryDirections || discoveryDirections.length === 0) {
    return roleByVenueId
  }

  for (const direction of discoveryDirections) {
    for (const group of direction.groups) {
      for (const candidate of group.candidates) {
        if (
          candidate.role === 'start' ||
          candidate.role === 'highlight' ||
          candidate.role === 'windDown'
        ) {
          roleByVenueId.set(candidate.venueId, candidate.role)
        }
      }
    }
  }

  return roleByVenueId
}

function buildDiscoveryPreferences(
  selectedVenueIds: string[],
  discoveryDirections?: DiscoveryDirection[],
): PreferredDiscoveryVenue[] | undefined {
  if (
    selectedVenueIds.length === 0 ||
    !discoveryDirections ||
    discoveryDirections.length === 0
  ) {
    return undefined
  }

  const roleByVenueId = buildDiscoveryRoleLookup(discoveryDirections)

  const preferences = selectedVenueIds
    .map((venueId) => {
      const role = roleByVenueId.get(venueId)
      return role ? { venueId, role } : undefined
    })
    .filter((value): value is PreferredDiscoveryVenue => Boolean(value))

  return preferences.length > 0 ? preferences : undefined
}

function buildPlanAnchor(
  mode: SessionState['mode'],
  selectedVenueIds: string[],
  discoveryDirections?: DiscoveryDirection[],
): IntentInput['anchor'] | undefined {
  if (mode !== 'build' || selectedVenueIds.length === 0) {
    return undefined
  }

  const roleByVenueId = buildDiscoveryRoleLookup(discoveryDirections)
  const highlightedSelection = selectedVenueIds.find(
    (venueId) => roleByVenueId.get(venueId) === 'highlight',
  )
  const venueId = highlightedSelection ?? selectedVenueIds[0]

  return venueId
    ? {
        venueId,
        role: roleByVenueId.get(venueId) ?? 'highlight',
      }
    : undefined
}

function mapDistanceToleranceToDistanceMode(
  distanceTolerance: PreviewDistanceTolerance | undefined,
  fallback: SessionState['intentDraft']['distanceMode'],
): SessionState['intentDraft']['distanceMode'] {
  if (!distanceTolerance) {
    return fallback
  }
  return distanceTolerance === 'open' ? 'short-drive' : 'nearby'
}

function toPreferredNeighborhoodLabel(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  const normalized = value
    .replace(/\s+area$/i, '')
    .replace(/\s+district$/i, '')
    .trim()
  return normalized.length > 0 ? normalized : undefined
}

function applyPreviewControlsToInput(
  input: IntentInput,
  previewControls: PreviewControls,
  preferredDistrictNeighborhood?: string,
): IntentInput {
  const nextRefinementModes = [...new Set(input.refinementModes ?? [])]
  const removeRefinement = (mode: RefinementMode) => {
    const index = nextRefinementModes.indexOf(mode)
    if (index >= 0) {
      nextRefinementModes.splice(index, 1)
    }
  }

  if (previewControls.distanceTolerance === 'compact') {
    if (!nextRefinementModes.includes('closer-by')) {
      nextRefinementModes.push('closer-by')
    }
  } else if (previewControls.distanceTolerance === 'balanced') {
    removeRefinement('closer-by')
  } else if (previewControls.distanceTolerance === 'open') {
    removeRefinement('closer-by')
  }

  if (previewControls.energyBias === 'softer') {
    removeRefinement('more-exciting')
    if (!nextRefinementModes.includes('more-relaxed')) {
      nextRefinementModes.push('more-relaxed')
    }
  } else if (previewControls.energyBias === 'stronger') {
    removeRefinement('more-relaxed')
    if (!nextRefinementModes.includes('more-exciting')) {
      nextRefinementModes.push('more-exciting')
    }
  } else if (previewControls.energyBias === 'balanced') {
    removeRefinement('more-relaxed')
    removeRefinement('more-exciting')
  }

  return {
    ...input,
    district: previewControls.districtPreference ?? input.district,
    startTime: previewControls.startTime ?? input.startTime,
    neighborhood: previewControls.districtPreference
      ? preferredDistrictNeighborhood ?? input.neighborhood
      : previewControls.distanceTolerance === 'open'
        ? undefined
        : input.neighborhood,
    distanceMode: mapDistanceToleranceToDistanceMode(
      previewControls.distanceTolerance,
      input.distanceMode,
    ),
    refinementModes: nextRefinementModes,
  }
}

function buildDraftGenerationInput(
  state: SessionState,
  selectedPack?: StarterPack,
): IntentInput {
  const persona = state.intentDraft.persona
  const primaryVibe = state.intentDraft.primaryVibe ?? selectedPack?.primaryAnchor ?? null
  const secondaryVibe = state.intentDraft.secondaryVibe ?? selectedPack?.secondaryAnchors?.[0]
  const mode = state.mode ?? 'build'
  const discoveryPreferences = buildDiscoveryPreferences(
    state.selectedDiscoveryVenueIds,
    state.discoveryGroups,
  )
  const discoveryAnchor = buildPlanAnchor(
    mode,
    state.selectedDiscoveryVenueIds,
    state.discoveryGroups,
  )
  const anchor = state.intentDraft.anchor ?? discoveryAnchor
  const planningMode =
    state.intentDraft.planningMode ?? (anchor ? 'user-led' : 'engine-led')

  const draftInput: IntentInput = {
    mode,
    planningMode,
    anchor,
    persona,
    primaryVibe,
    secondaryVibe,
    city: state.intentDraft.city,
    district: state.intentDraft.district,
    neighborhood: state.intentDraft.neighborhood,
    distanceMode: selectedPack?.distanceMode ?? state.intentDraft.distanceMode,
    budget: state.intentDraft.budget,
    startTime: state.intentDraft.startTime || undefined,
    prefersHiddenGems:
      state.intentDraft.prefersHiddenGems ||
      mode === 'surprise' ||
      selectedPack?.lensPreset?.discoveryBias === 'high',
    refinementModes: [...new Set(state.selectedRefinements)],
    discoveryPreferences,
  }

  const preferredDistrictNeighborhood = toPreferredNeighborhoodLabel(
    state.generationTrace?.recommendedDistricts.find(
      (district) => district.districtId === state.previewControls.districtPreference,
    )?.label,
  )

  return applyPreviewControlsToInput(
    draftInput,
    state.previewControls,
    preferredDistrictNeighborhood,
  )
}

function buildRefinementInput(
  state: SessionState,
  modes: RefinementMode[],
  selectedPack?: StarterPack,
): IntentInput {
  const persona = state.intentDraft.persona ?? state.lastIntentProfile?.persona ?? null
  const primaryVibe =
    state.intentDraft.primaryVibe ??
    selectedPack?.primaryAnchor ??
    state.lastIntentProfile?.primaryAnchor ??
    null
  const secondaryVibe =
    state.intentDraft.secondaryVibe ??
    selectedPack?.secondaryAnchors?.[0] ??
    state.lastIntentProfile?.secondaryAnchors?.[0]
  const mode = state.mode ?? state.lastIntentProfile?.mode ?? 'build'
  const discoveryPreferences = buildDiscoveryPreferences(
    state.selectedDiscoveryVenueIds,
    state.discoveryGroups,
  )
  const discoveryAnchor = buildPlanAnchor(
    mode,
    state.selectedDiscoveryVenueIds,
    state.discoveryGroups,
  )
  const anchor = state.intentDraft.anchor ?? discoveryAnchor ?? state.lastIntentProfile?.anchor
  const planningMode =
    state.intentDraft.planningMode ??
    (anchor ? 'user-led' : state.lastIntentProfile?.planningMode ?? 'engine-led')

  return {
    mode,
    planningMode,
    anchor,
    persona,
    primaryVibe,
    secondaryVibe,
    city: state.intentDraft.city,
    district: state.intentDraft.district ?? state.lastIntentProfile?.district,
    neighborhood: state.intentDraft.neighborhood,
    distanceMode: selectedPack?.distanceMode ?? state.intentDraft.distanceMode,
    budget: state.intentDraft.budget,
    startTime: state.intentDraft.startTime || undefined,
    prefersHiddenGems:
      state.intentDraft.prefersHiddenGems ||
      mode === 'surprise' ||
      selectedPack?.lensPreset?.discoveryBias === 'high',
    refinementModes: [...new Set(modes)],
    discoveryPreferences,
  }
}

function buildIntentInputFromProfile(intent: IntentProfile): IntentInput {
  return {
    mode: intent.mode,
    persona: intent.persona ?? null,
    primaryVibe: intent.primaryAnchor,
    secondaryVibe: intent.secondaryAnchors?.[0],
    city: intent.city,
    district: intent.district,
    neighborhood: intent.neighborhood,
    distanceMode: intent.distanceMode,
    budget: intent.budget,
    startTime: intent.timeWindow,
    timeWindow: intent.timeWindow,
    prefersHiddenGems: intent.prefersHiddenGems,
    refinementModes: intent.refinementModes,
    planningMode: intent.planningMode,
    anchor: intent.anchor,
    discoveryPreferences: intent.discoveryPreferences,
  }
}

function buildGeneratingCopy(
  mode: 'surprise' | 'curate' | 'build' | null,
  city: string,
  district?: string,
  neighborhood?: string,
  primaryVibe?: VibeAnchor | null,
): { headline: string; detail: string } {
  const districtLabel = district?.includes('.')
    ? district
        .split('.')
        .slice(-1)[0]
        ?.replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase())
    : district
  const locationLabel = district
    ? `${districtLabel}, ${city}`
    : neighborhood
      ? `${neighborhood}, ${city}`
      : city
  if (mode === 'surprise') {
    return {
      headline: `Looking for hidden gems around ${locationLabel}...`,
      detail: 'Balancing discovery with a smooth stop-to-stop flow.',
    }
  }
  if (mode === 'curate') {
    return {
      headline: `Turning your starter pack into a route near ${locationLabel}...`,
      detail: 'Selecting strong local options while keeping the path realistic.',
    }
  }
  if (primaryVibe) {
    return {
      headline: `Finding your ${getVibeLabel(primaryVibe)} route nearby...`,
      detail: 'Shaping a stronger finish and a better neighborhood progression.',
    }
  }
  return {
    headline: 'Curating your route...',
    detail: 'Building a coherent plan across high-fit local venues.',
  }
}

const SURPRISE_BOOT_VIBES: VibeAnchor[] = [
  'lively',
  'playful',
  'cultured',
  'chill',
  'adventurous-urban',
  'cozy',
]

function pickNextSurpriseVibe(current?: VibeAnchor | null): VibeAnchor {
  const candidates = SURPRISE_BOOT_VIBES.filter((vibe) => vibe !== current)
  if (candidates.length === 0) {
    return 'lively'
  }
  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index] ?? 'lively'
}

const BASELINE_VISIBLE_ROLES: UserStopRole[] = ['start', 'highlight', 'windDown']

function filterRoleRecord<T>(
  value: Partial<Record<UserStopRole, T>>,
  roles: UserStopRole[],
): Partial<Record<UserStopRole, T>> {
  const allowed = new Set<UserStopRole>(roles)
  return Object.fromEntries(
    Object.entries(value).filter(([role]) => allowed.has(role as UserStopRole)),
  ) as Partial<Record<UserStopRole, T>>
}

function buildBaselineVisibleItinerary(itinerary: Itinerary): Itinerary {
  const visibleStops = itinerary.stops.filter((stop) => stop.role !== 'surprise')
  if (visibleStops.length === itinerary.stops.length) {
    return itinerary
  }
  const indexByStopId = new Map(itinerary.stops.map((stop, index) => [stop.id, index] as const))
  const movementRank = (mode: 'walkable' | 'short-drive' | 'drive'): number =>
    mode === 'drive' ? 3 : mode === 'short-drive' ? 2 : 1
  const continuityRank = (
    continuity: 'same-neighborhood' | 'adjacent-neighborhoods' | 'spread',
  ): number => (continuity === 'spread' ? 3 : continuity === 'adjacent-neighborhoods' ? 2 : 1)
  const visibleTransitions = visibleStops
    .slice(0, -1)
    .map((fromStop, index) => {
      const toStop = visibleStops[index + 1]
      if (!toStop) {
        return undefined
      }
      const fromIndex = indexByStopId.get(fromStop.id)
      const toIndex = indexByStopId.get(toStop.id)
      if (fromIndex == null || toIndex == null || toIndex <= fromIndex) {
        return {
          fromStopId: fromStop.id,
          toStopId: toStop.id,
          estimatedTravelMinutes: 10,
          transitionBufferMinutes: 5,
          estimatedTransitionMinutes: 15,
          frictionScore: 0.24,
          movementMode: 'short-drive' as const,
          neighborhoodContinuity: 'adjacent-neighborhoods' as const,
        }
      }
      let estimatedTravelMinutes = 0
      let transitionBufferMinutes = 0
      let estimatedTransitionMinutes = 0
      let frictionScore = 0
      let resolvedMovementMode: 'walkable' | 'short-drive' | 'drive' = 'walkable'
      let resolvedContinuity: 'same-neighborhood' | 'adjacent-neighborhoods' | 'spread' =
        'same-neighborhood'
      let legCount = 0
      for (let legIndex = fromIndex; legIndex < toIndex; legIndex += 1) {
        const leg = itinerary.transitions[legIndex]
        if (!leg) {
          continue
        }
        legCount += 1
        estimatedTravelMinutes += leg.estimatedTravelMinutes
        transitionBufferMinutes += leg.transitionBufferMinutes
        estimatedTransitionMinutes += leg.estimatedTransitionMinutes
        frictionScore += leg.frictionScore
        if (movementRank(leg.movementMode) > movementRank(resolvedMovementMode)) {
          resolvedMovementMode = leg.movementMode
        }
        if (continuityRank(leg.neighborhoodContinuity) > continuityRank(resolvedContinuity)) {
          resolvedContinuity = leg.neighborhoodContinuity
        }
      }
      if (legCount === 0) {
        return {
          fromStopId: fromStop.id,
          toStopId: toStop.id,
          estimatedTravelMinutes: 10,
          transitionBufferMinutes: 5,
          estimatedTransitionMinutes: 15,
          frictionScore: 0.24,
          movementMode: 'short-drive' as const,
          neighborhoodContinuity: 'adjacent-neighborhoods' as const,
        }
      }
      return {
        fromStopId: fromStop.id,
        toStopId: toStop.id,
        estimatedTravelMinutes,
        transitionBufferMinutes,
        estimatedTransitionMinutes,
        frictionScore: Number((frictionScore / legCount).toFixed(2)),
        movementMode: resolvedMovementMode,
        neighborhoodContinuity: resolvedContinuity,
      }
    })
    .filter((value): value is Itinerary['transitions'][number] => Boolean(value))
  const estimatedStopMinutes = visibleStops.reduce(
    (total, stop) => total + stop.estimatedDurationMinutes,
    0,
  )
  const estimatedTransitionMinutes = visibleTransitions.reduce(
    (total, transition) => total + transition.estimatedTransitionMinutes,
    0,
  )
  const totalRouteFriction = visibleTransitions.reduce(
    (total, transition) => total + transition.frictionScore,
    0,
  )
  return {
    ...itinerary,
    stops: visibleStops,
    transitions: visibleTransitions,
    estimatedTotalMinutes: estimatedStopMinutes + estimatedTransitionMinutes,
    totalRouteFriction: Number(totalRouteFriction.toFixed(2)),
  }
}

function getDebugQueryFlags(): {
  debugMode: boolean
  strictShape: boolean
  sourceMode: ReturnType<typeof getSourceMode>['requestedSourceMode']
  sourceModeOverrideApplied: boolean
} {
  if (typeof window === 'undefined') {
    return {
      debugMode: false,
      strictShape: false,
      sourceMode: 'curated',
      sourceModeOverrideApplied: false,
    }
  }
  const params = new URLSearchParams(window.location.search)
  const debugMode = params.get('debug') === '1'
  const strictShape = debugMode && params.get('strictShape') === '1'
  const sourceMode = getSourceMode({
    debugMode,
    search: window.location.search,
  })
  return {
    debugMode,
    strictShape,
    sourceMode: sourceMode.requestedSourceMode,
    sourceModeOverrideApplied: sourceMode.overrideApplied,
  }
}

function applyDiscoveryPreferences({
  selectedVenueIds,
  discoveryGroups,
  selectedArc,
  scoredVenues,
  intent,
  lens,
}: {
  selectedVenueIds: string[]
  discoveryGroups?: DiscoveryDirection[]
  selectedArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  intent: IntentProfile
  lens: ExperienceLens
}): ArcCandidate | undefined {
  if (selectedVenueIds.length === 0 || !discoveryGroups || discoveryGroups.length === 0) {
    return undefined
  }

  const roleByVenueId = new Map<string, UserStopRole>()
  for (const direction of discoveryGroups) {
    for (const group of direction.groups) {
      for (const candidate of group.candidates) {
        roleByVenueId.set(candidate.venueId, candidate.role)
      }
    }
  }

  const crewPolicy = getCrewPolicy(intent.crew)
  let nextArc = selectedArc
  let changed = false

  for (const venueId of selectedVenueIds) {
    const preferredRole = roleByVenueId.get(venueId)
    const replacement = scoredVenues.find((item) => item.venue.id === venueId)
    if (!preferredRole || !replacement) {
      continue
    }
    if (nextArc.stops.some((stop) => stop.scoredVenue.venue.id === venueId)) {
      continue
    }

    const swapped = swapArcStop({
      currentArc: nextArc,
      role: inverseRoleProjection[preferredRole],
      replacement,
      intent,
      crewPolicy,
      lens,
    })

    if (!swapped) {
      continue
    }

    nextArc = swapped
    changed = true
  }

  return changed ? nextArc : undefined
}

function matchesDraftComposeQuery(venue: Venue, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length < 2) {
    return false
  }

  return [
    venue.name,
    venue.neighborhood,
    venue.category,
    venue.subcategory,
    venue.shortDescription,
    ...venue.tags,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function buildComposeSubtitle(venue: Venue): string {
  return `${venue.neighborhood} | ${venue.driveMinutes} min | ${venue.category.replace('_', ' ')}`
}

function buildComposeRationale(
  candidate: ScoredVenue,
  targetRole: InternalRole,
  kind: 'candidate' | 'custom',
): string {
  if (kind === 'custom') {
    return 'Private stop'
  }
  if (candidate.fitBreakdown.proximityFit >= 0.72) {
    return 'Keeps the route tight'
  }
  if (targetRole === 'wildcard' && candidate.hiddenGemScore >= 0.62) {
    return 'Adds variety'
  }
  if (candidate.roleScores[targetRole] >= 0.72) {
    return 'Strong role fit'
  }
  if (candidate.lensCompatibility >= 0.65) {
    return 'Matches the vibe'
  }
  return 'Fits this route'
}

function slugCustomStopPart(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
}

function buildStableCustomStopId(name: string, city: string, neighborhood?: string): string {
  const label = slugCustomStopPart(name) || 'custom-stop'
  const cityPart = slugCustomStopPart(city) || 'city'
  const neighborhoodPart = slugCustomStopPart(neighborhood) || 'local'
  return `custom_stop_${cityPart}_${neighborhoodPart}_${label}`
}

function buildCustomDraftVenue({
  name,
  city,
  neighborhood,
  role,
  templateVenue,
}: {
  name: string
  city: string
  neighborhood?: string
  role: InternalRole
  templateVenue?: Venue
}): Venue {
  const baseTemplate = templateVenue
  const stableId = buildStableCustomStopId(name, city, neighborhood ?? templateVenue?.neighborhood)
  if (templateVenue) {
    return {
      ...templateVenue,
      id: stableId,
      name,
      city,
      neighborhood: neighborhood ?? templateVenue.neighborhood,
      imageUrl: templateVenue.imageUrl ?? '',
      shortDescription: `${name} was added manually to this draft.`,
      narrativeFlavor: `${name} is a custom stop added directly into the route.`,
      source: {
        ...templateVenue.source,
        provider: undefined,
        providerRecordId: undefined,
        sourceOrigin: 'live',
        sourceQueryLabel: 'draft-compose-custom',
        sourceConfidence: Math.max(templateVenue.source.sourceConfidence, 0.58),
      },
    }
  }

  const defaultCategoryByRole: Record<InternalRole, VenueCategory> = {
    warmup: 'cafe',
    peak: 'restaurant',
    wildcard: 'activity',
    cooldown: 'dessert',
  }
  const rawPlace: RawPlace = {
    rawType: 'place',
    id: stableId,
    name,
    city,
    neighborhood: neighborhood ?? baseTemplate?.neighborhood ?? city,
    driveMinutes: baseTemplate?.driveMinutes ?? (role === 'wildcard' ? 12 : 10),
    priceTier: baseTemplate?.priceTier ?? '$$',
    tags: [...new Set([...(baseTemplate?.tags ?? []), 'custom', 'manual'])].slice(0, 10),
    shortDescription: `${name} was added manually to this draft.`,
    narrativeFlavor: `${name} is a custom stop added directly into the route.`,
    imageUrl: baseTemplate?.imageUrl ?? '',
    categoryHint: baseTemplate?.category ?? defaultCategoryByRole[role],
    subcategoryHint: baseTemplate?.subcategory ?? 'custom stop',
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    sourceQueryLabel: 'draft-compose-custom',
    sourceConfidence: 0.55,
    queryTerms: [name],
  }

  return normalizeRawPlace(rawPlace)
}

function reconcileUserComposedStopsByArc(
  userComposedStopsByRole: Partial<Record<UserStopRole, UserComposedStop>>,
  arc: ArcCandidate,
): Partial<Record<UserStopRole, UserComposedStop>> {
  const composedByVenueId = new Map(
    Object.values(userComposedStopsByRole).map((item) => [item.venue.id, item] as const),
  )

  return arc.stops.reduce<Partial<Record<UserStopRole, UserComposedStop>>>(
    (nextStops, stop) => {
      const existing = composedByVenueId.get(stop.scoredVenue.venue.id)
      if (!existing) {
        return nextStops
      }

      const nextRole = roleProjection[stop.role]
      nextStops[nextRole] = {
        ...existing,
        role: nextRole,
        label: stop.scoredVenue.venue.name,
        venue: stop.scoredVenue.venue,
      }
      return nextStops
    },
    {},
  )
}

function buildUserComposedConflictMessage(failedStops: UserComposedStop[]): string | undefined {
  if (failedStops.length === 0) {
    return undefined
  }

  const labels = failedStops.map((stop) => stop.label).join(', ')
  return `Could not keep ${labels} in the updated route because the new plan context created a hard fit conflict.`
}

function buildAuthoredRouteConflictMessage(): string {
  return 'Could not fully preserve your edited route shape because the updated plan context created a hard fit conflict.'
}

function normalizeModeSet(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return ''
  }
  return [...new Set(values)].sort((left, right) => left.localeCompare(right)).join('|')
}

interface PendingPlanAdjustmentContext {
  previousPlan: {
    itinerary: Itinerary
    trace: GenerationTrace
  }
  controls: PreviewControls
}

function AppShellContent({
  environment,
  initialMode,
  initialStep,
  initialGenerationTarget,
  initialDevStartMode,
}: {
  environment: AppEnvironment
  initialMode?: ExperienceMode
  initialStep?: FlowStep
  initialGenerationTarget?: GenerationTarget
  initialDevStartMode?: DevStartMode
}) {
  /**
   * ARC BOUNDARY: Application wrapper orchestration.
   *
   * Owns lifecycle, state bridges, and engine invocation order.
   * Must not author interpretation/bearings/waypoint canonical truth.
   */
  const { state, actions } = useSessionStore()
  const [landingNotice, setLandingNotice] = useState<LiveArtifactExitNotice | null>(null)
  const [lceRepairProposal, setLceRepairProposal] = useState<LceRepairProposal>()
  const [lceBrokenByRole, setLceBrokenByRole] = useState<
    Partial<Record<UserStopRole, 'removed' | 'unavailable'>>
  >({})
  const [lceSystemMessage, setLceSystemMessage] = useState<string>()
  const [lceTraceNote, setLceTraceNote] = useState<string>()
  const [planAdjustmentFeedback, setPlanAdjustmentFeedback] = useState<PlanAdjustmentFeedback>()
  const [pendingPlanAdjustment, setPendingPlanAdjustment] = useState<
    PendingPlanAdjustmentContext | undefined
  >()
  const [devStartMode, setDevStartMode] = useState<DevStartMode | null>(initialDevStartMode ?? null)
  const initialModeAppliedRef = useRef(false)
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''
  const isDevChooseStage = environment === 'dev' && currentPath === '/dev/choose'
  const activeStarterPack = useMemo(
    () => starterPacks.find((pack) => pack.id === state.selectedStarterPackId),
    [state.selectedStarterPackId],
  )
  const queryDebugFlags = getDebugQueryFlags()
  const debugFlags =
    environment === 'dev'
      ? {
          ...queryDebugFlags,
          debugMode: true,
        }
      : queryDebugFlags
  const effectiveDraftInput = useMemo(
    () => buildDraftGenerationInput(state, activeStarterPack),
    [
      activeStarterPack,
      state.discoveryGroups,
      state.intentDraft,
      state.mode,
      state.previewControls,
      state.selectedDiscoveryVenueIds,
      state.selectedRefinements,
    ],
  )
  const previewDirty =
    Boolean(state.generatedItinerary) &&
    Boolean(state.lastIntentProfile) &&
    (
      (effectiveDraftInput.district ?? '') !== (state.lastIntentProfile?.district ?? '') ||
      (effectiveDraftInput.neighborhood ?? '') !== (state.lastIntentProfile?.neighborhood ?? '') ||
      (effectiveDraftInput.startTime ?? '') !== (state.lastIntentProfile?.timeWindow ?? '') ||
      effectiveDraftInput.distanceMode !== state.lastIntentProfile?.distanceMode ||
      (effectiveDraftInput.budget ?? '') !== (state.lastIntentProfile?.budget ?? '') ||
      normalizeModeSet(effectiveDraftInput.refinementModes) !==
        normalizeModeSet(state.lastIntentProfile?.refinementModes)
    )
  const baselineVisibleItinerary = useMemo(() => {
    if (!state.generatedItinerary) {
      return state.generatedItinerary
    }
    return buildBaselineVisibleItinerary(state.generatedItinerary)
  }, [state.generatedItinerary])
  const baselineVisibleAlternativesByRole = useMemo(
    () => filterRoleRecord(state.alternativesByRole, BASELINE_VISIBLE_ROLES),
    [state.alternativesByRole],
  )
  const baselineVisibleAlternativeKindsByRole = useMemo(
    () => filterRoleRecord(state.alternativeKindsByRole, BASELINE_VISIBLE_ROLES),
    [state.alternativeKindsByRole],
  )

  useEffect(() => {
    setLandingNotice(consumeLiveArtifactExitNotice())
  }, [])

  const handleAnchorSelect = (venue: Venue) => {
    actions.clearDistrictPreview()
    actions.clearDiscoveryPreview()
    actions.setDiscoverySelection([])
    actions.setSelectedAnchorVenue(venue)
    actions.patchIntentDraft({
      planningMode: 'user-led',
      anchor: {
        venueId: venue.id,
        role: 'highlight',
      },
    })
  }

  useEffect(() => {
    if (state.currentStep !== 'generating') {
      return
    }

    const generationTarget = state.generationTarget
    const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId)
    const input = effectiveDraftInput
    let cancelled = false
    const timeoutHandle = window.setTimeout(() => {
      void (async () => {
        try {
          // Wrapper seam: pass canonical intent input to engine; do not synthesize engine truth here.
          assertCanonicalSelectedDirectionContext({
            wrapperSeam: 'app_shell.generate',
            input,
          })
          const result = await runGeneratePlan(input, {
            starterPack: selectedPack,
            debugMode: debugFlags.debugMode,
            strictShape: debugFlags.strictShape,
            sourceMode: debugFlags.sourceMode,
            sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
            seedVenues: state.selectedAnchorVenue ? [state.selectedAnchorVenue] : undefined,
          })
          if (cancelled) {
            return
          }
          const discoveryPreferredArc = applyDiscoveryPreferences({
            selectedVenueIds: state.selectedDiscoveryVenueIds,
            discoveryGroups: state.discoveryGroups,
            selectedArc: result.selectedArc,
            scoredVenues: result.scoredVenues,
            intent: result.intentProfile,
            lens: result.lens,
          })
          const preferredArc = discoveryPreferredArc ?? result.selectedArc
          const persistedAuthoredRoute = applyPersistedAuthoredRoute({
            arc: preferredArc,
            scoredVenues: result.scoredVenues,
            intentProfile: result.intentProfile,
            lens: result.lens,
          })
          const preferredItinerary =
            persistedAuthoredRoute.arc.id !== result.selectedArc.id
              ? projectItinerary(
                  persistedAuthoredRoute.arc,
                  result.intentProfile,
                  result.lens,
                )
              : result.itinerary
          if (generationTarget === 'preview') {
            if (pendingPlanAdjustment) {
              setPlanAdjustmentFeedback(
                generatePlanAdjustmentFeedback({
                  previousPlan: pendingPlanAdjustment.previousPlan,
                  nextPlan: {
                    itinerary: preferredItinerary,
                    trace: result.trace,
                  },
                  controls: pendingPlanAdjustment.controls,
                }),
              )
            } else {
              setPlanAdjustmentFeedback(undefined)
            }
            setPendingPlanAdjustment(undefined)
          }
          actions.setGeneration(
            result.itinerary,
            result.selectedArc,
            persistedAuthoredRoute.scoredVenues,
            result.intentProfile,
            result.lens,
            result.trace,
          )
          actions.setUserComposedStops(persistedAuthoredRoute.userComposedStopsByRole)
          actions.setRouteEditedByUser(persistedAuthoredRoute.routeEditedByUser)
          actions.setCompositionConflictMessage(
            persistedAuthoredRoute.compositionConflictMessage,
          )
          if (persistedAuthoredRoute.arc.id !== result.selectedArc.id) {
            actions.setArcAndItinerary(preferredItinerary, persistedAuthoredRoute.arc)
          }
          actions.setStep(generationTarget === 'preview' ? 'preview' : 'reveal')
        } catch (error) {
          console.error(error)
          if (!cancelled) {
            setPendingPlanAdjustment(undefined)
            if (environment === 'dev' && state.mode === 'surprise') {
              window.location.assign('/dev/home')
              return
            }
            actions.setStep(generationTarget === 'preview' ? 'mood' : 'preview')
          }
        }
      })()
    }, 650)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutHandle)
    }
  }, [
    actions,
    devStartMode,
    environment,
    effectiveDraftInput,
    state.currentStep,
    state.generationTarget,
    state.discoveryGroups,
    state.mode,
    state.selectedDiscoveryVenueIds,
    state.selectedAnchorVenue,
    state.selectedStarterPackId,
    pendingPlanAdjustment,
  ])

  const progress = stepProgress[state.currentStep]
  const environmentLabel =
    environment === 'dev'
      ? 'Development Sandbox'
      : environment === 'archive'
        ? 'Previous flow — for reference'
        : null

  useEffect(() => {
    if (environment !== 'dev') {
      return
    }
    if (devStartMode) {
      writeDevOriginMode(devStartMode)
      return
    }
    if (state.mode === 'surprise' || state.mode === 'curate' || state.mode === 'build') {
      writeDevOriginMode(state.mode)
    }
  }, [devStartMode, environment, state.mode])

  const generatingCopy = buildGeneratingCopy(
    state.mode,
    state.intentDraft.city,
    state.previewControls.districtPreference ?? state.intentDraft.district,
    state.previewControls.distanceTolerance === 'open'
      ? undefined
      : state.intentDraft.neighborhood,
    state.intentDraft.primaryVibe,
  )
  const lightNearbyExtensions =
    state.generatedArc && state.scoredVenues && state.lastIntentProfile && state.experienceLens
      ? deriveLightNearbyExtensions({
          currentArc: state.generatedArc,
          scoredVenues: state.scoredVenues,
          intent: state.lastIntentProfile,
          lens: state.experienceLens,
        })
      : []
  const previewAdjustDisabledRoles =
    state.lastIntentProfile?.planningMode === 'user-led' && state.lastIntentProfile.anchor?.role
      ? [state.lastIntentProfile.anchor.role]
      : []
  const previewAdjustLockedNotesByRole = state.lastIntentProfile?.anchor?.role
    ? {
        [state.lastIntentProfile.anchor.role]: 'This stop anchors your plan.',
      }
    : {}
  const previewOwnedStopKindsByRole = useMemo(
    () =>
      Object.entries(state.userComposedStopsByRole).reduce<
        Partial<Record<UserStopRole, 'candidate' | 'custom'>>
      >((ownedStops, [role, stop]) => {
        ownedStops[role as UserStopRole] = stop.kind
        return ownedStops
      }, {}),
    [state.userComposedStopsByRole],
  )
  const previewRoleShapeActionsByRole = useMemo(() => {
    if (!state.generatedArc || !state.lastIntentProfile || !state.experienceLens) {
      return {}
    }

    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    return state.generatedArc.stops.reduce((actionsByRole, stop) => {
      const userRole = roleProjection[stop.role]
      actionsByRole[userRole] = getRoleShapeActions({
        currentArc: state.generatedArc!,
        role: userRole,
        intent: state.lastIntentProfile!,
        crewPolicy,
        lens: state.experienceLens!,
      })
      return actionsByRole
    }, {} as Partial<Record<UserStopRole, ReturnType<typeof getRoleShapeActions>>>)
  }, [state.experienceLens, state.generatedArc, state.lastIntentProfile])
  const previewComposeActionsByRole = useMemo(() => {
    if (
      !state.generatedArc ||
      !state.scoredVenues ||
      !state.lastIntentProfile ||
      !state.experienceLens
    ) {
      return {}
    }

    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    return state.generatedArc.stops.reduce((actionsByRole, stop) => {
      const userRole = roleProjection[stop.role]
      actionsByRole[userRole] = getDraftComposeActions({
        currentArc: state.generatedArc!,
        role: userRole,
        scoredVenues: state.scoredVenues!,
        intent: state.lastIntentProfile!,
        crewPolicy,
        lens: state.experienceLens!,
      })
      return actionsByRole
    }, {} as Partial<Record<UserStopRole, ReturnType<typeof getDraftComposeActions>>>)
  }, [
    state.experienceLens,
    state.generatedArc,
    state.lastIntentProfile,
    state.scoredVenues,
  ])
  const baselineVisibleRoleShapeActionsByRole = useMemo(
    () => filterRoleRecord(previewRoleShapeActionsByRole, BASELINE_VISIBLE_ROLES),
    [previewRoleShapeActionsByRole],
  )
  const baselineVisibleComposeActionsByRole = useMemo(
    () => filterRoleRecord(previewComposeActionsByRole, BASELINE_VISIBLE_ROLES),
    [previewComposeActionsByRole],
  )
  const baselineVisibleOwnedStopKindsByRole = useMemo(
    () => filterRoleRecord(previewOwnedStopKindsByRole, BASELINE_VISIBLE_ROLES),
    [previewOwnedStopKindsByRole],
  )
  const baselineVisibleAdjustLockedNotesByRole = useMemo(
    () => filterRoleRecord(previewAdjustLockedNotesByRole ?? {}, BASELINE_VISIBLE_ROLES),
    [previewAdjustLockedNotesByRole],
  )

  const buildMergedPersistedScoredVenueMap = ({
    scoredVenues,
    authoredArc,
    intentProfile,
    lens,
  }: {
    scoredVenues: ScoredVenue[]
    authoredArc?: ArcCandidate
    intentProfile: IntentProfile
    lens: ExperienceLens
  }) => {
    const crewPolicy = getCrewPolicy(intentProfile.crew)
    const roleContracts = getRoleContract({
      intent: intentProfile,
      starterPack: activeStarterPack,
    })
    const mergedScoredVenueMap = new Map(scoredVenues.map((item) => [item.venue.id, item] as const))
    const persistedVenues = [
      ...(authoredArc?.stops.map((stop) => stop.scoredVenue.venue) ?? []),
      ...Object.values(state.userComposedStopsByRole).map((stop) => stop.venue),
    ]

    for (const venue of persistedVenues) {
      if (mergedScoredVenueMap.has(venue.id)) {
        continue
      }
      mergedScoredVenueMap.set(
        venue.id,
        scoreVenueFit(
          venue,
          intentProfile,
          crewPolicy,
          lens,
          roleContracts,
          activeStarterPack,
        ),
      )
    }

    return {
      crewPolicy,
      mergedScoredVenueMap,
    }
  }

  const rehydrateAuthoredArc = ({
    authoredArc,
    scoredVenueMap,
    intentProfile,
    lens,
    crewPolicy,
  }: {
    authoredArc: ArcCandidate
    scoredVenueMap: Map<string, ScoredVenue>
    intentProfile: IntentProfile
    lens: ExperienceLens
    crewPolicy: ReturnType<typeof getCrewPolicy>
  }): ArcCandidate | undefined => {
    const nextStops = authoredArc.stops.map((stop) => {
      const scoredVenue = scoredVenueMap.get(stop.scoredVenue.venue.id)
      return scoredVenue
        ? {
            role: stop.role,
            scoredVenue,
          }
        : undefined
    })

    if (nextStops.some((stop) => !stop)) {
      return undefined
    }

    const hydratedStops = nextStops.filter((stop): stop is NonNullable<typeof stop> => Boolean(stop))
    if (!isValidArcCombination(hydratedStops, intentProfile, crewPolicy, lens)) {
      return undefined
    }

    const rescored = scoreArcAssembly(hydratedStops, intentProfile, crewPolicy, lens)
    return {
      id: authoredArc.id,
      stops: hydratedStops,
      totalScore: rescored.totalScore,
      scoreBreakdown: rescored.scoreBreakdown,
      pacing: rescored.pacing,
      spatial: rescored.spatial,
      hasWildcard: hydratedStops.some((stop) => stop.role === 'wildcard'),
    }
  }

  const applyPersistedComposedStops = ({
    arc,
    scoredVenues,
    intentProfile,
    lens,
  }: {
    arc: ArcCandidate
    scoredVenues: ScoredVenue[]
    intentProfile: IntentProfile
    lens: ExperienceLens
  }) => {
    if (Object.keys(state.userComposedStopsByRole).length === 0) {
      return {
        arc,
        scoredVenues,
        userComposedStopsByRole: state.userComposedStopsByRole,
        compositionConflictMessage: undefined,
      }
    }

    const { crewPolicy, mergedScoredVenueMap } = buildMergedPersistedScoredVenueMap({
      scoredVenues,
      intentProfile,
      lens,
    })

    let nextArc = arc
    const failedStops: UserComposedStop[] = []
    for (const role of ['start', 'highlight', 'surprise', 'windDown'] as UserStopRole[]) {
      const composedStop = state.userComposedStopsByRole[role]
      if (!composedStop) {
        continue
      }

      const scoredVenue = mergedScoredVenueMap.get(composedStop.venue.id)
      if (!scoredVenue) {
        failedStops.push(composedStop)
        continue
      }

      const currentArcRole = nextArc.stops.find(
        (stop) => stop.scoredVenue.venue.id === composedStop.venue.id,
      )?.role

      const reappliedArc =
        currentArcRole && roleProjection[currentArcRole] !== role
          ? reshapeArcStop({
              currentArc: nextArc,
              role: currentArcRole,
              targetRole: inverseRoleProjection[role],
              intent: intentProfile,
              crewPolicy,
              lens,
            })
          : role === 'surprise'
            ? nextArc.hasWildcard
              ? swapArcStop({
                  currentArc: nextArc,
                  role: 'wildcard',
                  replacement: scoredVenue,
                  intent: intentProfile,
                  crewPolicy,
                  lens,
                })
              : insertArcStop({
                  currentArc: nextArc,
                  role: 'peak',
                  actionId: 'add-after',
                  inserted: scoredVenue,
                  intent: intentProfile,
                  crewPolicy,
                  lens,
                })
            : swapArcStop({
                currentArc: nextArc,
                role: inverseRoleProjection[role],
                replacement: scoredVenue,
                intent: intentProfile,
                crewPolicy,
                lens,
              })

      if (!reappliedArc) {
        failedStops.push(composedStop)
        continue
      }

      nextArc = reappliedArc
    }

    return {
      arc: nextArc,
      scoredVenues: [...mergedScoredVenueMap.values()],
      userComposedStopsByRole: reconcileUserComposedStopsByArc(
        state.userComposedStopsByRole,
        nextArc,
      ),
      compositionConflictMessage: buildUserComposedConflictMessage(failedStops),
    }
  }

  const applyPersistedAuthoredRoute = ({
    arc,
    scoredVenues,
    intentProfile,
    lens,
  }: {
    arc: ArcCandidate
    scoredVenues: ScoredVenue[]
    intentProfile: IntentProfile
    lens: ExperienceLens
  }) => {
    const authoredArc = state.routeEditedByUser ? state.generatedArc : undefined
    if (!authoredArc) {
      return {
        arc,
        scoredVenues,
        userComposedStopsByRole: state.userComposedStopsByRole,
        compositionConflictMessage: undefined,
        routeEditedByUser: false,
      }
    }

    const { crewPolicy, mergedScoredVenueMap } = buildMergedPersistedScoredVenueMap({
      scoredVenues,
      authoredArc,
      intentProfile,
      lens,
    })
    const exactAuthoredArc = rehydrateAuthoredArc({
      authoredArc,
      scoredVenueMap: mergedScoredVenueMap,
      intentProfile,
      lens,
      crewPolicy,
    })

    if (exactAuthoredArc) {
      return {
        arc: exactAuthoredArc,
        scoredVenues: [...mergedScoredVenueMap.values()],
        userComposedStopsByRole: reconcileUserComposedStopsByArc(
          state.userComposedStopsByRole,
          exactAuthoredArc,
        ),
        compositionConflictMessage: undefined,
        routeEditedByUser: true,
      }
    }

    const fallback = applyPersistedComposedStops({
      arc,
      scoredVenues: [...mergedScoredVenueMap.values()],
      intentProfile,
      lens,
    })

    return {
      ...fallback,
      compositionConflictMessage:
        fallback.compositionConflictMessage ?? buildAuthoredRouteConflictMessage(),
      routeEditedByUser: true,
    }
  }

  const commitDraftArcUpdate = (
    nextArc: ArcCandidate,
    nextUserComposedStopsByRole = reconcileUserComposedStopsByArc(
      state.userComposedStopsByRole,
      nextArc,
    ),
    compositionConflictMessage?: string,
  ) => {
    if (!state.lastIntentProfile || !state.experienceLens) {
      return
    }
    const itinerary = projectItinerary(nextArc, state.lastIntentProfile, state.experienceLens)
    actions.setArcAndItinerary(itinerary, nextArc)
    actions.setUserComposedStops(nextUserComposedStopsByRole)
    actions.setRouteEditedByUser(true)
    actions.setCompositionConflictMessage(compositionConflictMessage)
    setLceRepairProposal(undefined)
    setLceBrokenByRole({})
    setLceSystemMessage(undefined)
  }

  const handleProposeLceRepair = (
    role: UserStopRole,
    trigger: LceRepairTrigger,
  ): boolean => {
    if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
      return false
    }
    const brokenStop = state.generatedArc.stops.find(
      (stop) => roleProjection[stop.role] === role,
    )
    if (!brokenStop) {
      return false
    }

    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    const rolePoolAlternatives =
      state.alternativeKindsByRole[role] === 'swap' ? state.alternativesByRole[role] : undefined
    const proposal = proposeLceRepair({
      currentArc: state.generatedArc,
      role,
      trigger,
      scoredVenues: state.scoredVenues,
      intent: state.lastIntentProfile,
      crewPolicy,
      lens: state.experienceLens,
      rolePoolAlternatives,
    })

    setLceBrokenByRole((current) => ({
      ...current,
      [role]: trigger,
    }))
    setLceSystemMessage(undefined)
    if (!proposal) {
      setLceRepairProposal(undefined)
      setLceTraceNote(
        `broken: ${brokenStop.scoredVenue.venue.name} | role: ${role} | replacement: none | source: existing pool`,
      )
      return true
    }

    setLceRepairProposal(proposal)
    setLceTraceNote(
      `broken: ${proposal.brokenStopVenueName} | role: ${proposal.role} | replacement: ${proposal.replacement.venue.name} | source: ${proposal.source} | pending`,
    )
    return true
  }

  const handleApplyLceRepairProposal = () => {
    if (!lceRepairProposal) {
      return
    }
    commitDraftArcUpdate(lceRepairProposal.proposedArc)
    setLceSystemMessage('Adjusted for availability.')
    setLceTraceNote(
      `broken: ${lceRepairProposal.brokenStopVenueName} | role: ${lceRepairProposal.role} | replacement: ${lceRepairProposal.replacement.venue.name} | source: ${lceRepairProposal.source} | applied`,
    )
  }

  const handleKeepCurrentPlanAfterLce = () => {
    if (!lceRepairProposal) {
      return
    }
    setLceTraceNote(
      `broken: ${lceRepairProposal.brokenStopVenueName} | role: ${lceRepairProposal.role} | replacement: ${lceRepairProposal.replacement.venue.name} | source: ${lceRepairProposal.source} | declined`,
    )
    setLceRepairProposal(undefined)
    setLceSystemMessage(undefined)
  }

  const handleRefreshExplorePreview = async () => {
    const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId)
    const input = buildDraftGenerationInput(state, selectedPack)
    const debugFlags = getDebugQueryFlags()

    actions.beginDiscoveryPreview()

    try {
      const groups = await getDiscoveryCandidates(input, {
        starterPack: selectedPack,
        strictShape: debugFlags.strictShape,
        sourceMode: debugFlags.sourceMode,
        sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
      })
      actions.setDiscoveryPreview(groups)
    } catch (error) {
      console.error(error)
      actions.clearDiscoveryPreview()
    }
  }

  useEffect(() => {
    if (state.currentStep !== 'mood') {
      return
    }
    if (!state.intentDraft.primaryVibe) {
      actions.clearDiscoveryPreview()
      return
    }

    let cancelled = false
    const timeoutHandle = window.setTimeout(() => {
      void (async () => {
        try {
          await handleRefreshExplorePreview()
        } catch (error) {
          if (!cancelled) {
            console.error(error)
          }
        }
      })()
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutHandle)
    }
  }, [
    actions,
    state.currentStep,
    state.intentDraft.city,
    state.intentDraft.neighborhood,
    state.intentDraft.persona,
    state.intentDraft.primaryVibe,
    state.intentDraft.secondaryVibe,
    state.mode,
    state.selectedStarterPackId,
  ])

  const handleShowSwap = (role: UserStopRole) => {
    if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
      return
    }
    const internalRole = inverseRoleProjection[role]
    if (internalRole === 'wildcard' && !state.generatedArc.hasWildcard) {
      actions.setStopAlternatives(role, [], 'swap')
      return
    }
    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    const alternatives = getRoleAlternatives({
      role: internalRole,
      currentArc: state.generatedArc,
      scoredVenues: state.scoredVenues,
      intent: state.lastIntentProfile,
      crewPolicy,
      lens: state.experienceLens,
      limit: 5,
    })
    actions.setStopAlternatives(role, alternatives, 'swap')
    actions.setTraceAlternativeCount(role, alternatives.length, 'swap')
  }

  const handleShowNearby = (role: UserStopRole) => {
    if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
      return
    }
    const internalRole = inverseRoleProjection[role]
    if (internalRole === 'wildcard' && !state.generatedArc.hasWildcard) {
      actions.setStopAlternatives(role, [], 'nearby')
      return
    }
    const alternatives = getNearbyAlternatives({
      role: internalRole,
      currentArc: state.generatedArc,
      scoredVenues: state.scoredVenues,
      intent: state.lastIntentProfile,
      lens: state.experienceLens,
      limit: 4,
    })
    actions.setStopAlternatives(role, alternatives, 'nearby')
    actions.setTraceAlternativeCount(role, alternatives.length, 'nearby')
  }

  const handleApplySwap = (role: UserStopRole, venueId: string) => {
    if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
      return
    }
    const replacement = state.scoredVenues.find((item) => item.venue.id === venueId)
    if (!replacement) {
      return
    }
    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    const swapped = swapArcStop({
      currentArc: state.generatedArc,
      role: inverseRoleProjection[role],
      replacement,
      intent: state.lastIntentProfile,
      crewPolicy,
      lens: state.experienceLens,
    })
    if (!swapped) {
      return
    }
    commitDraftArcUpdate(swapped)
    const internalRole = inverseRoleProjection[role]
    const visibleKind = state.alternativeKindsByRole[role] ?? 'swap'
    const refreshedAlternatives =
      visibleKind === 'nearby'
        ? getNearbyAlternatives({
            role: internalRole,
            currentArc: swapped,
            scoredVenues: state.scoredVenues,
            intent: state.lastIntentProfile,
            lens: state.experienceLens,
            limit: 4,
          })
        : getRoleAlternatives({
            role: internalRole,
            currentArc: swapped,
            scoredVenues: state.scoredVenues,
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
            limit: 5,
          })
    actions.setStopAlternatives(role, refreshedAlternatives, visibleKind)
    actions.setTraceAlternativeCount(role, refreshedAlternatives.length, visibleKind)
  }

  const handleApplyRoleShape = (role: UserStopRole, actionId: DraftRoleShapeActionId): boolean => {
    if (!state.generatedArc || !state.lastIntentProfile || !state.experienceLens) {
      return false
    }

    const action = previewRoleShapeActionsByRole[role]?.find((item) => item.id === actionId)
    if (!action) {
      return false
    }

    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    const reshaped = reshapeArcStop({
      currentArc: state.generatedArc,
      role: inverseRoleProjection[role],
      targetRole: inverseRoleProjection[action.targetRole],
      intent: state.lastIntentProfile,
      crewPolicy,
      lens: state.experienceLens,
    })
    if (!reshaped) {
      return false
    }
    commitDraftArcUpdate(reshaped)
    return true
  }

  const handleApplyComposeAction = (
    role: UserStopRole,
    actionId: DraftComposeActionId,
  ): boolean => {
    if (
      actionId !== 'remove-stop' ||
      !state.generatedArc ||
      !state.scoredVenues ||
      !state.lastIntentProfile ||
      !state.experienceLens
    ) {
      return false
    }
    return handleProposeLceRepair(role, 'removed')
  }

  const handleSearchCompose = async (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    query: string,
  ): Promise<DraftComposeSearchResult[]> => {
    if (
      !state.generatedArc ||
      !state.scoredVenues ||
      !state.lastIntentProfile ||
      !state.experienceLens
    ) {
      return []
    }

    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      return []
    }

    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    const roleContracts = getRoleContract({
      intent: state.lastIntentProfile,
      starterPack: activeStarterPack,
    })
    const targetRole = getComposeActionTargetRole(role, actionId)
    const currentStop = state.generatedArc.stops.find(
      (stop) => roleProjection[stop.role] === role,
    )
    const localMatches = state.scoredVenues.filter((item) =>
      matchesDraftComposeQuery(item.venue, trimmedQuery),
    )

    const remoteMatches = await searchAnchorVenues({
      query: trimmedQuery,
      city: state.lastIntentProfile.city,
      neighborhood: state.lastIntentProfile.neighborhood ?? currentStop?.scoredVenue.venue.neighborhood,
    }).catch(() => [])

    const scoredRemoteMatches = remoteMatches.map((result) => ({
      scoredVenue: scoreVenueFit(
        result.venue,
        state.lastIntentProfile!,
        crewPolicy,
        state.experienceLens!,
        roleContracts,
        activeStarterPack,
      ),
      subtitle: result.subtitle,
    }))

    const seenIds = new Set<string>()
    const candidateResults = [
      ...localMatches.map((item) => ({
        kind: 'candidate' as const,
        scoredVenue: item,
        subtitle: buildComposeSubtitle(item.venue),
      })),
      ...scoredRemoteMatches.map((item) => ({
        kind: 'candidate' as const,
        scoredVenue: item.scoredVenue,
        subtitle: item.subtitle,
      })),
    ]
      .filter((item) => {
        if (seenIds.has(item.scoredVenue.venue.id)) {
          return false
        }
        seenIds.add(item.scoredVenue.venue.id)
        return canApplyComposeSearchResult({
          currentArc: state.generatedArc!,
          role,
          actionId,
          scoredVenue: item.scoredVenue,
          intent: state.lastIntentProfile!,
          crewPolicy,
          lens: state.experienceLens!,
        })
      })
      .sort(
        (left, right) =>
          right.scoredVenue.roleScores[targetRole] - left.scoredVenue.roleScores[targetRole] ||
          right.scoredVenue.fitScore - left.scoredVenue.fitScore,
      )
      .slice(0, 3)
      .map((item) => ({
        id: item.scoredVenue.venue.id,
        title: item.scoredVenue.venue.name,
        subtitle: item.subtitle,
        rationale: buildComposeRationale(item.scoredVenue, targetRole, item.kind),
        kind: item.kind,
        scoredVenue: item.scoredVenue,
      }))
    return candidateResults
  }

  const handleCreateCustomComposeStop = (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    label: string,
  ): boolean => {
    if (
      !state.generatedArc ||
      !state.lastIntentProfile ||
      !state.experienceLens ||
      label.trim().length < 2
    ) {
      return false
    }

    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    const roleContracts = getRoleContract({
      intent: state.lastIntentProfile,
      starterPack: activeStarterPack,
    })
    const targetRole = getComposeActionTargetRole(role, actionId)
    const currentStop = state.generatedArc.stops.find(
      (stop) => roleProjection[stop.role] === role,
    )
    const customVenue = buildCustomDraftVenue({
      name: label.trim(),
      city: state.lastIntentProfile.city,
      neighborhood:
        state.lastIntentProfile.neighborhood ?? currentStop?.scoredVenue.venue.neighborhood,
      role: targetRole,
      templateVenue: currentStop?.scoredVenue.venue,
    })
    const customCandidate = scoreVenueFit(
      customVenue,
      state.lastIntentProfile,
      crewPolicy,
      state.experienceLens,
      roleContracts,
      activeStarterPack,
    )

    if (
      !canApplyComposeSearchResult({
        currentArc: state.generatedArc,
        role,
        actionId,
        scoredVenue: customCandidate,
        intent: state.lastIntentProfile,
        crewPolicy,
        lens: state.experienceLens,
      })
    ) {
      return false
    }

    return handleApplyComposeSearchResult(role, actionId, {
      id: customCandidate.venue.id,
      title: customCandidate.venue.name,
      subtitle: `${customCandidate.venue.neighborhood} | custom/private stop`,
      rationale: buildComposeRationale(customCandidate, targetRole, 'custom'),
      kind: 'custom',
      scoredVenue: customCandidate,
    })
  }

  const handleApplyComposeSearchResult = (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    result: DraftComposeSearchResult,
  ): boolean => {
    if (!state.generatedArc || !state.lastIntentProfile || !state.experienceLens) {
      return false
    }

    const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew)
    const nextArc =
      actionId === 'replace-stop'
        ? swapArcStop({
            currentArc: state.generatedArc,
            role: inverseRoleProjection[role],
            replacement: result.scoredVenue,
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
          })
        : insertArcStop({
            currentArc: state.generatedArc,
            role: inverseRoleProjection[role],
            actionId,
            inserted: result.scoredVenue,
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
          })

    if (!nextArc) {
      return false
    }
    const nextRole = actionId === 'replace-stop' ? role : 'surprise'
    const nextUserComposedStopsByRole = reconcileUserComposedStopsByArc(
      {
        ...state.userComposedStopsByRole,
        [nextRole]: {
          ownedStopId: result.scoredVenue.venue.id,
          role: nextRole,
          label: result.scoredVenue.venue.name,
          venue: result.scoredVenue.venue,
          kind: result.kind,
          sourceAction: actionId,
        },
      },
      nextArc,
    )
    commitDraftArcUpdate(nextArc, nextUserComposedStopsByRole)
    return true
  }

  const handleApplyRefinement = (modes: RefinementMode[]) => {
    actions.setRefinements(modes)
    if (!state.generatedArc) {
      return
    }

    void (async () => {
      try {
        const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId)
        const input = buildRefinementInput(state, modes, selectedPack)
        // Wrapper seam: refinement orchestrates engine invocation, not planning truth assembly.
        assertCanonicalSelectedDirectionContext({
          wrapperSeam: 'app_shell.refinement',
          input,
        })
        const result = await runGeneratePlan(input, {
          starterPack: selectedPack,
          baselineArc: state.generatedArc,
          baselineTrace: state.generationTrace,
          baselineItineraryId: state.generatedItinerary?.id,
          debugMode: debugFlags.debugMode,
          strictShape: debugFlags.strictShape,
          sourceMode: debugFlags.sourceMode,
          sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
          seedVenues: state.selectedAnchorVenue ? [state.selectedAnchorVenue] : undefined,
        })
        const persistedAuthoredRoute = applyPersistedAuthoredRoute({
          arc: result.selectedArc,
          scoredVenues: result.scoredVenues,
          intentProfile: result.intentProfile,
          lens: result.lens,
        })
        actions.setGeneration(
          result.itinerary,
          result.selectedArc,
          persistedAuthoredRoute.scoredVenues,
          result.intentProfile,
          result.lens,
          result.trace,
        )
        actions.setUserComposedStops(persistedAuthoredRoute.userComposedStopsByRole)
        actions.setRouteEditedByUser(persistedAuthoredRoute.routeEditedByUser)
        actions.setCompositionConflictMessage(
          persistedAuthoredRoute.compositionConflictMessage,
        )
        if (persistedAuthoredRoute.arc.id !== result.selectedArc.id) {
          const preferredItinerary = projectItinerary(
            persistedAuthoredRoute.arc,
            result.intentProfile,
            result.lens,
          )
          actions.setArcAndItinerary(preferredItinerary, persistedAuthoredRoute.arc)
        }
      } catch (error) {
        console.error(error)
      }
    })()
  }

  const handleContinueOuting = () => {
    const currentIntentProfile = state.lastIntentProfile
    if (!currentIntentProfile) {
      return
    }

    actions.beginExploration()

    void (async () => {
      try {
        const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId)
        const input = buildIntentInputFromProfile(currentIntentProfile)
        const plan = await planExploration(input, {
          starterPack: selectedPack,
          debugMode: debugFlags.debugMode,
          strictShape: debugFlags.strictShape,
          sourceMode: debugFlags.sourceMode,
          sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
        })
        actions.setExplorationPlan(plan)
      } catch (error) {
        console.error(error)
        actions.clearExplorationPlan()
      }
    })()
  }

  const handleSelectMode = (mode: ExperienceMode) => {
    setLandingNotice(null)
    if (environment === 'dev') {
      setDevStartMode(mode)
    }
    actions.setMode(mode)
    actions.clearStopAlternatives()

    if (mode === 'curate') {
      actions.setStep('curate')
      return
    }

    actions.patchIntentDraft({
      primaryVibe: mode === 'surprise' ? null : state.intentDraft.primaryVibe,
      district: undefined,
      prefersHiddenGems: mode === 'surprise',
    })
    actions.selectStarterPack(undefined)
    actions.setStep('mood')
  }

  useEffect(() => {
    if (initialModeAppliedRef.current) {
      return
    }
    initialModeAppliedRef.current = true
    if (
      environment === 'dev' &&
      initialMode === 'surprise' &&
      initialStep === 'generating'
    ) {
      // Surprise start in dev owns its own boot path and skips generic mode-entry branching.
      setDevStartMode('surprise')
      actions.setMode('surprise')
      actions.selectStarterPack(undefined)
      actions.clearStopAlternatives()
      actions.patchIntentDraft({
        primaryVibe: pickNextSurpriseVibe(state.intentDraft.primaryVibe),
        secondaryVibe: undefined,
        district: undefined,
        prefersHiddenGems: true,
        planningMode: undefined,
        anchor: undefined,
      })
      actions.setGenerationTarget(initialGenerationTarget ?? 'preview')
      actions.setStep('generating')
      return
    }
    if (initialMode && state.currentStep === 'landing') {
      handleSelectMode(initialMode)
    }
    if (initialGenerationTarget) {
      actions.setGenerationTarget(initialGenerationTarget)
    }
    if (!initialStep) {
      return
    }
    if ((initialStep === 'preview' || initialStep === 'reveal') && !state.generatedItinerary) {
      if (environment === 'dev') {
        const restoredMode = devStartMode ?? readDevOriginMode() ?? initialDevStartMode ?? null
        if (initialStep === 'preview') {
          if (restoredMode === 'surprise') {
            window.location.assign('/dev/start/surprise')
            return
          }
          window.location.assign('/dev/choose')
          return
        }
        if (restoredMode === 'surprise') {
          window.location.assign('/dev/preview?mode=surprise')
          return
        }
        window.location.assign('/dev/preview')
        return
      }
      actions.setStep('mood')
      return
    }
    actions.setStep(initialStep)
  }, [
    actions,
    devStartMode,
    environment,
    initialDevStartMode,
    initialGenerationTarget,
    initialMode,
    initialStep,
    state.currentStep,
    state.intentDraft.primaryVibe,
  ])

  useEffect(() => {
    if (environment !== 'dev' || typeof window === 'undefined') {
      return
    }
    const targetPath = (() => {
      if (state.currentStep === 'landing') {
        return '/dev/home'
      }
      if (state.currentStep === 'curate') {
        return '/dev/start/curate'
      }
      if (state.currentStep === 'mood') {
        if (state.mode === 'build' && devStartMode === 'build') {
          return '/dev/start/build'
        }
        if (state.mode === 'curate' && devStartMode === 'curate') {
          return '/dev/start/curate'
        }
        return '/dev/choose'
      }
      if (state.currentStep === 'generating') {
        if (state.mode === 'surprise' && devStartMode === 'surprise') {
          return '/dev/start/surprise'
        }
        return state.mode === 'surprise' ? '/dev/preview?mode=surprise' : '/dev/preview'
      }
      if (state.currentStep === 'preview') {
        return state.mode === 'surprise' ? '/dev/preview?mode=surprise' : '/dev/preview'
      }
      if (state.currentStep === 'reveal' || state.currentStep === 'ticket') {
        return '/dev/confirm'
      }
      return '/dev/home'
    })()
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (currentPath === targetPath) {
      return
    }
    window.history.replaceState(null, '', targetPath)
  }, [devStartMode, environment, state.currentStep, state.mode])

  return (
    <main className="app-shell">
      <header className="app-topbar">
        {environmentLabel && <p className="shell-environment-label">{environmentLabel}</p>}
        <p className="brand">ID.8</p>
        {progress > 0 && <ProgressDots total={4} current={progress} />}
      </header>

      {state.currentStep === 'landing' && (
        <LandingPage
          notice={landingNotice ?? undefined}
          onDismissNotice={() => setLandingNotice(null)}
          conciergeHref={environment === 'dev' ? '/dev/home' : '/'}
          conciergeLabel={
            environment === 'dev' ? 'Enter Sandbox Concierge' : 'Open Concierge'
          }
          onSelectMode={handleSelectMode}
        />
      )}

      {state.currentStep === 'curate' && (
        <CurateExperiencePage
          packs={starterPacks}
          selectedPackId={state.selectedStarterPackId}
          onSelectPack={(packId) => {
            const pack = starterPacks.find((item) => item.id === packId)
            actions.selectStarterPack(packId)
            actions.patchIntentDraft({
              persona: pack?.personaBias ?? null,
              primaryVibe: pack?.primaryAnchor ?? null,
              secondaryVibe: pack?.secondaryAnchors?.[0],
              district: undefined,
              distanceMode: pack?.distanceMode ?? state.intentDraft.distanceMode,
              prefersHiddenGems: pack?.lensPreset?.discoveryBias === 'high',
            })
          }}
          onBack={() => {
            if (environment === 'dev') {
              window.location.assign('/dev/home')
              return
            }
            actions.setStep('landing')
          }}
          onContinue={() => {
            if (environment === 'dev') {
              setDevStartMode(null)
            }
            actions.setStep('mood')
          }}
        />
      )}

      {state.currentStep === 'mood' && (
        <MoodSelectionPage
          primaryVibe={state.intentDraft.primaryVibe}
          secondaryVibe={state.intentDraft.secondaryVibe}
          persona={state.intentDraft.persona}
          city={state.intentDraft.city}
          neighborhood={state.intentDraft.neighborhood}
          anchorName={state.selectedAnchorVenue?.name}
          anchorVenueId={state.intentDraft.anchor?.venueId ?? state.selectedAnchorVenue?.id}
          showAnchorSearch={state.mode === 'build'}
          flowStage={isDevChooseStage ? 'choose' : 'intent'}
          modePosture={state.mode}
          discoveryGroups={state.discoveryGroups}
          discoveryLoading={state.discoveryLoading}
          selectedVenueIds={state.selectedDiscoveryVenueIds}
          debugPanel={undefined}
          onChange={(primary, secondary) =>
            actions.patchIntentDraft({
              primaryVibe: primary,
              secondaryVibe: secondary,
            })
          }
          onPersonaChange={(persona) => actions.patchIntentDraft({ persona })}
          onContextChange={(city, neighborhood) =>
            actions.patchIntentDraft({
              city,
              district: undefined,
              neighborhood,
            })
          }
          onAnchorSelect={handleAnchorSelect}
          onToggleDiscoveryVenue={(venueId) => {
            const selected = state.selectedDiscoveryVenueIds.includes(venueId)
            if (selected) {
              actions.setDiscoverySelection(
                state.selectedDiscoveryVenueIds.filter((id) => id !== venueId),
              )
              return
            }
            if (state.selectedDiscoveryVenueIds.length >= 2) {
              return
            }
            actions.setDiscoverySelection([...state.selectedDiscoveryVenueIds, venueId])
          }}
          onSetDiscoverySelection={(venueIds) => {
            actions.setDiscoverySelection(venueIds)
          }}
          onBack={() =>
            {
              if (environment === 'dev') {
                if (isDevChooseStage) {
                  if (state.mode === 'build') {
                    window.location.assign('/dev/start/build')
                    return
                  }
                  if (state.mode === 'curate') {
                    window.location.assign('/dev/start/curate')
                    return
                  }
                  window.location.assign('/dev/start/surprise')
                  return
                }
                if (state.mode === 'build') {
                  if (devStartMode === 'build') {
                    window.location.assign('/dev/home')
                    return
                  }
                  setDevStartMode('build')
                  return
                }
                if (state.mode === 'curate') {
                  setDevStartMode('curate')
                  actions.setStep('curate')
                  return
                }
                window.location.assign('/dev/home')
                return
              }
              actions.setStep(
                state.mode === 'curate'
                  ? 'curate'
                  : 'landing',
              )
            }
          }
          onNext={() => {
            if (environment === 'dev') {
              setDevStartMode(null)
            }
            actions.setGenerationTarget('preview')
            actions.setStep('generating')
          }}
        />
      )}

      {state.currentStep === 'preview' && state.generatedItinerary && (
        <PreviewPage
          itinerary={baselineVisibleItinerary ?? state.generatedItinerary}
          generationTrace={state.generationTrace}
          planAdjustmentFeedback={previewDirty ? undefined : planAdjustmentFeedback}
          neighborhood={effectiveDraftInput.neighborhood}
          startTime={effectiveDraftInput.startTime}
          distanceMode={effectiveDraftInput.distanceMode}
          budget={effectiveDraftInput.budget}
          previewControls={state.previewControls}
          previewDirty={previewDirty}
          compositionConflictMessage={state.compositionConflictMessage}
          alternativesByRole={baselineVisibleAlternativesByRole}
          alternativeKindsByRole={baselineVisibleAlternativeKindsByRole}
          roleShapeActionsByRole={baselineVisibleRoleShapeActionsByRole}
          composeActionsByRole={baselineVisibleComposeActionsByRole}
          ownedStopKindsByRole={baselineVisibleOwnedStopKindsByRole}
          adjustDisabledRoles={previewAdjustDisabledRoles}
          adjustLockedNotesByRole={baselineVisibleAdjustLockedNotesByRole}
          unavailableByRole={lceBrokenByRole}
          lceRepairProposal={lceRepairProposal}
          lceSystemMessage={lceSystemMessage}
          lceTraceNote={lceTraceNote}
          debugPanel={undefined}
          showRoadmap={false}
          onChangePreviewControls={(patch) => actions.patchPreviewControls(patch)}
          onChangeNeighborhood={(neighborhood) =>
            actions.patchIntentDraft({
              district: undefined,
              neighborhood,
            })
          }
          onChangeBudget={(budget) => actions.patchIntentDraft({ budget })}
          onShowSwap={handleShowSwap}
          onApplySwap={handleApplySwap}
          onApplyRoleShape={handleApplyRoleShape}
          onApplyComposeAction={handleApplyComposeAction}
          onSearchCompose={handleSearchCompose}
          onCreateCustomComposeStop={handleCreateCustomComposeStop}
          onApplyComposeSearchResult={handleApplyComposeSearchResult}
          onApplyLceRepairProposal={handleApplyLceRepairProposal}
          onKeepCurrentPlanAfterLce={handleKeepCurrentPlanAfterLce}
          refreshLabel={
            environment === 'dev' && state.mode === 'surprise' ? 'Try another surprise' : 'Adjust plan'
          }
          refreshDisabled={environment === 'dev' && state.mode === 'surprise' ? false : !previewDirty}
          backLabel={
            environment === 'dev' && state.mode === 'surprise'
              ? 'Back to Home'
              : environment === 'dev'
                ? 'Back to Choose'
                : 'Back to Explore'
          }
          onBack={() => {
            if (environment === 'dev' && state.mode === 'surprise') {
              window.location.assign('/dev/home')
              return
            }
            if (environment === 'dev') {
              setDevStartMode(null)
            }
            setPlanAdjustmentFeedback(undefined)
            setPendingPlanAdjustment(undefined)
            actions.setStep('mood')
          }}
          onRefresh={() => {
            setLceRepairProposal(undefined)
            setLceBrokenByRole({})
            setLceSystemMessage(undefined)
            setLceTraceNote(undefined)
            setPlanAdjustmentFeedback(undefined)
            if (environment === 'dev' && state.mode === 'surprise') {
              setPendingPlanAdjustment(undefined)
              actions.patchIntentDraft({
                primaryVibe: pickNextSurpriseVibe(state.intentDraft.primaryVibe),
                secondaryVibe: undefined,
                prefersHiddenGems: true,
              })
              actions.setGenerationTarget('preview')
              actions.setStep('generating')
              return
            }
            if (state.generatedItinerary && state.generationTrace) {
              setPendingPlanAdjustment({
                previousPlan: {
                  itinerary: state.generatedItinerary,
                  trace: state.generationTrace,
                },
                controls: { ...state.previewControls },
              })
            } else {
              setPendingPlanAdjustment(undefined)
            }
            actions.setGenerationTarget('preview')
            actions.setStep('generating')
          }}
          onConfirm={() => {
            setLceRepairProposal(undefined)
            setLceBrokenByRole({})
            setLceSystemMessage(undefined)
            setLceTraceNote(undefined)
            setPendingPlanAdjustment(undefined)
            actions.setGenerationTarget('final')
            actions.setStep('generating')
          }}
        />
      )}

      {state.currentStep === 'generating' && (
        <GeneratingPage headline={generatingCopy.headline} detail={generatingCopy.detail} />
      )}

      {state.currentStep === 'reveal' && state.generatedItinerary && (
        <RevealPage
          itinerary={baselineVisibleItinerary ?? state.generatedItinerary}
          selectedRefinements={state.selectedRefinements}
          generationTrace={state.generationTrace}
          compositionConflictMessage={state.compositionConflictMessage}
          explorationPlan={state.explorationPlan}
          explorationLoading={state.explorationLoading}
          lightNearbyExtensions={lightNearbyExtensions}
          alternativesByRole={baselineVisibleAlternativesByRole}
          alternativeKindsByRole={baselineVisibleAlternativeKindsByRole}
          onShowSwap={handleShowSwap}
          onShowNearby={handleShowNearby}
          onApplySwap={handleApplySwap}
          onApplyRefinement={handleApplyRefinement}
          onContinueOuting={handleContinueOuting}
          forceDebug={false}
          showDebugPanels={false}
          showRoadmap={false}
          showExtensions={false}
          onBackToPreview={() => {
            actions.setStep('preview')
          }}
          onLock={() => {
            actions.lockPlan()
            actions.setStep('ticket')
          }}
          onStartOver={() => {
            if (environment === 'dev') {
              window.location.assign('/dev/home')
              return
            }
            actions.reset()
          }}
        />
      )}

      {state.currentStep === 'ticket' && state.generatedItinerary && (
        <TicketPage
          itinerary={baselineVisibleItinerary ?? state.generatedItinerary}
          lightNearbyExtensions={lightNearbyExtensions}
          explorationPlan={state.explorationPlan}
          explorationLoading={state.explorationLoading}
          lockedAt={state.lockedAt}
          onContinueOuting={handleContinueOuting}
          onStartOver={() => {
            if (environment === 'dev') {
              window.location.assign('/dev/home')
              return
            }
            actions.reset()
          }}
        />
      )}
    </main>
  )
}

export function AppShell({
  environment = 'default',
  initialMode,
  initialStep,
  initialGenerationTarget,
  initialDevStartMode,
}: {
  environment?: AppEnvironment
  initialMode?: ExperienceMode
  initialStep?: FlowStep
  initialGenerationTarget?: GenerationTarget
  initialDevStartMode?: DevStartMode
}) {
  return (
    <SessionStoreProvider>
      <AppShellContent
        environment={environment}
        initialMode={initialMode}
        initialStep={initialStep}
        initialGenerationTarget={initialGenerationTarget}
        initialDevStartMode={initialDevStartMode}
      />
    </SessionStoreProvider>
  )
}
