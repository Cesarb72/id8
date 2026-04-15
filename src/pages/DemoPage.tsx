import { useCallback, useEffect, useMemo, useState } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import {
  RealityCommitStep,
  getRealityInterpretation,
  type RealityCluster,
} from '../components/demo/RealityCommitStep'
import { JourneyMapReal } from '../components/journey/JourneyMapReal'
import { RouteSpine } from '../components/journey/RouteSpine'
import { PageShell } from '../components/layout/PageShell'
import { swapArcStop } from '../domain/arc/swapArcStop'
import { inverseRoleProjection } from '../domain/config/roleProjection'
import { saveLiveArtifactSession } from '../domain/live/liveArtifactSession'
import { getCrewPolicy } from '../domain/intent/getCrewPolicy'
import { projectItinerary } from '../domain/itinerary/projectItinerary'
import { buildTonightSignals } from '../domain/journey/buildTonightSignals'
import { runGeneratePlan } from '../domain/runGeneratePlan'
import type { ArcCandidate, ScoredVenue } from '../domain/types/arc'
import type { ExperienceLens } from '../domain/types/experienceLens'
import type { IntentProfile, PersonaMode, VibeAnchor } from '../domain/types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../domain/types/itinerary'
import type { RefinementMode } from '../domain/types/refinement'

interface DemoPlanState {
  itinerary: Itinerary
  selectedArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  intentProfile: IntentProfile
  lens: ExperienceLens
  selectedCluster: RealityCluster
  selectedClusterConfirmation: string
}

interface InlineAlternative {
  venueId: string
  name: string
  descriptor: string
}

interface InlineStopDetail {
  whyItFits: string
  tonightSignals?: string[]
  aroundHereSignals?: string[]
  knownFor: string
  goodToKnow: string
  localSignal?: string
  alternatives?: InlineAlternative[]
  venueLinkUrl?: string
}

interface PreviewSwapState {
  role: UserStopRole
  originalStop: ItineraryStop
  candidateStop: ItineraryStop
  swappedArc: ArcCandidate
  swappedItinerary: Itinerary
  descriptor: string
  whyItFits: string
  knownFor: string
  localSignal: string
  venueLinkUrl: string
  tradeoffSignal: string
  constraintSignal: string
  cascadeHint: string
}

const personaOptions: Array<{ label: string; value: PersonaMode }> = [
  { label: 'Romantic', value: 'romantic' },
  { label: 'Friends', value: 'friends' },
  { label: 'Family', value: 'family' },
]

const vibeOptions: Array<{ label: string; value: VibeAnchor }> = [
  { label: 'Lively', value: 'lively' },
  { label: 'Cozy', value: 'cozy' },
  { label: 'Cultured', value: 'cultured' },
]

const clusterRefinementMap: Record<RealityCluster, RefinementMode[]> = {
  lively: ['more-exciting'],
  chill: ['more-relaxed'],
  explore: ['more-unique'],
}

const roleToInternalRole: Record<UserStopRole, keyof ScoredVenue['roleScores']> = {
  start: 'warmup',
  highlight: 'peak',
  surprise: 'wildcard',
  windDown: 'cooldown',
}

function findScoredVenueForStop(
  stop: ItineraryStop,
  selectedArc: ArcCandidate,
): ScoredVenue | undefined {
  const targetRole = inverseRoleProjection[stop.role]
  const matched = selectedArc.stops.find(
    (arcStop) =>
      arcStop.role === targetRole &&
      arcStop.scoredVenue.venue.id === stop.venueId,
  )
  if (matched) {
    return matched.scoredVenue
  }
  return selectedArc.stops.find((arcStop) => arcStop.role === targetRole)?.scoredVenue
}

function getCoreStop(
  itinerary: Itinerary,
  role: UserStopRole,
): ItineraryStop | undefined {
  return itinerary.stops.find((stop) => stop.role === role)
}

function getRouteArcType(itinerary: Itinerary): 'full' | 'partial' | 'highlightOnly' {
  const hasStart = itinerary.stops.some((stop) => stop.role === 'start')
  const hasHighlight = itinerary.stops.some((stop) => stop.role === 'highlight')
  const hasWindDown = itinerary.stops.some((stop) => stop.role === 'windDown')
  if (hasHighlight && hasStart && hasWindDown) {
    return 'full'
  }
  if (hasHighlight && (hasStart || hasWindDown)) {
    return 'partial'
  }
  return 'highlightOnly'
}

function getHighlightIntensityFromArc(arc: ArcCandidate): number | undefined {
  return arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue.taste.signals.momentIntensity.score
}

function getBearingsSignal(itinerary: Itinerary): string {
  const transitions = itinerary.transitions
  if (transitions.length === 0) {
    return 'Everything stays within a short drive.'
  }

  const maxTravel = Math.max(
    ...transitions.map((transition) => transition.estimatedTravelMinutes),
  )
  if (maxTravel <= 12) {
    return 'Everything stays within a short drive.'
  }
  return 'This route avoids long travel gaps.'
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getKnownForLine(stop: ItineraryStop): string {
  const priorityTags = stop.tags.filter((tag) =>
    ['jazz', 'cocktails', 'wine', 'dessert', 'chef-led', 'tasting', 'speakeasy', 'tea'].includes(
      tag.toLowerCase(),
    ),
  )
  const tags = (priorityTags.length > 0 ? priorityTags : stop.tags).slice(0, 2)
  if (tags.length > 0) {
    return `Known for ${tags.map((tag) => toTitleCase(tag)).join(' and ')}.`
  }
  if (stop.subcategory) {
    return `Known for its ${toTitleCase(stop.subcategory)} focus.`
  }
  return `Known for a strong local fit in ${stop.neighborhood}.`
}

function toTagSet(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.toLowerCase()))
}

function getAlternativeDescriptor(candidate: ScoredVenue): string {
  const tags = toTagSet(candidate.venue.tags)
  if (
    ['intimate', 'quiet', 'cozy', 'conversation', 'tea-room'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'more intimate'
  }
  if (
    ['live', 'jazz', 'music', 'social', 'cocktails', 'late-night'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'more lively'
  }
  if (
    ['dessert', 'gelato', 'ice-cream', 'tea', 'pastry'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'slower pace'
  }
  if (candidate.venue.category === 'museum' || candidate.venue.category === 'event') {
    return 'slower pace'
  }
  if (candidate.venue.category === 'park') {
    return 'more open-air'
  }
  if (candidate.venue.driveMinutes <= 8) {
    return 'closer, easier stop'
  }
  return 'different vibe'
}

function getRoleAlternatives(
  stop: ItineraryStop,
  scoredVenues: ScoredVenue[],
  itineraryStops: ItineraryStop[],
  currentArc: ArcCandidate,
  intent: IntentProfile,
  lens: ExperienceLens,
): InlineAlternative[] {
  const role = roleToInternalRole[stop.role]
  const usedVenueIds = new Set(itineraryStops.map((item) => item.venueId))
  const currentVenueId = stop.venueId
  const crewPolicy = getCrewPolicy(intent.crew)

  const buildRanked = (includeUsed: boolean, minRoleScore: number): ScoredVenue[] =>
    scoredVenues
      .filter((candidate) => candidate.venue.id !== currentVenueId)
      .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
      .filter((candidate) => (includeUsed ? true : !usedVenueIds.has(candidate.venue.id)))
      .filter((candidate) => candidate.roleScores[role] >= minRoleScore)
      .filter((candidate) =>
        Boolean(
          swapArcStop({
            currentArc,
            role: inverseRoleProjection[stop.role],
            replacement: candidate,
            intent,
            crewPolicy,
            lens,
          }),
        ),
      )
      .sort((left, right) => {
        const leftProximity = 1 / (1 + Math.abs(left.venue.driveMinutes - stop.driveMinutes))
        const rightProximity = 1 / (1 + Math.abs(right.venue.driveMinutes - stop.driveMinutes))
        const leftScore = left.roleScores[role] * 0.62 + left.fitScore * 0.24 + leftProximity * 0.14
        const rightScore =
          right.roleScores[role] * 0.62 + right.fitScore * 0.24 + rightProximity * 0.14
        return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name)
      })

  const strictPrimary = buildRanked(false, 0.52)
  const strictFallback = buildRanked(true, 0.52)
  const relaxedPrimary = buildRanked(false, 0.44)
  const relaxedFallback = buildRanked(true, 0.44)
  const combined = [...strictPrimary, ...strictFallback, ...relaxedPrimary, ...relaxedFallback]
  const alternatives: InlineAlternative[] = []
  const seenVenueIds = new Set<string>()

  for (const candidate of combined) {
    if (seenVenueIds.has(candidate.venue.id)) {
      continue
    }
    seenVenueIds.add(candidate.venue.id)
    alternatives.push({
      venueId: candidate.venue.id,
      name: candidate.venue.name,
      descriptor: getAlternativeDescriptor(candidate),
    })
    if (alternatives.length >= 3) {
      break
    }
  }

  return alternatives
}

function getLocalSignal(stop: ItineraryStop): string {
  const tags = toTagSet(stop.tags)
  if (
    ['reservations', 'reservation-recommended', 'book-ahead', 'bookings'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'Reservations recommended.'
  }
  if (
    ['late-night', 'night-owl', 'live', 'jazz', 'small-stage'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'Fills quickly after 9pm.'
  }
  if (
    ['walk-up', 'quick-start', 'coffee', 'tea-room', 'dessert', 'gelato'].some((tag) =>
      tags.has(tag),
    )
  ) {
    return 'Best earlier in the evening.'
  }
  if (stop.role === 'windDown') {
    return 'Best once the main moment eases out.'
  }
  if (stop.category === 'restaurant' || stop.category === 'bar' || stop.category === 'live_music') {
    return 'Reservations recommended.'
  }
  return 'Best earlier in the evening.'
}

function buildVenueLinkUrl(stop: ItineraryStop): string {
  const query = [stop.venueName, stop.neighborhood, stop.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function getRoleTravelWindow(itinerary: Itinerary, role: UserStopRole): number {
  const stopIndex = itinerary.stops.findIndex((stop) => stop.role === role)
  if (stopIndex < 0) {
    return 0
  }
  const before = stopIndex > 0 ? itinerary.transitions[stopIndex - 1]?.estimatedTravelMinutes ?? 0 : 0
  const after =
    stopIndex < itinerary.stops.length - 1
      ? itinerary.transitions[stopIndex]?.estimatedTravelMinutes ?? 0
      : 0
  return before + after
}

function getSwapTradeoffSignal(role: UserStopRole, candidate: ItineraryStop): string {
  const tags = toTagSet(candidate.tags)
  if (role === 'highlight') {
    if (
      candidate.category === 'museum' ||
      candidate.category === 'event' ||
      ['quiet', 'cozy', 'curated', 'gallery'].some((tag) => tags.has(tag))
    ) {
      return 'Keeps the centerpiece, shifts to a quieter pace.'
    }
    if (
      candidate.category === 'live_music' ||
      ['live', 'jazz', 'social', 'cocktails', 'late-night'].some((tag) => tags.has(tag))
    ) {
      return 'Keeps the centerpiece, shifts to a livelier middle.'
    }
    return 'Keeps the centerpiece, shifts the tone.'
  }

  if (role === 'start') {
    if (['coffee', 'tea-room', 'quiet'].some((tag) => tags.has(tag))) {
      return 'Starts with a calmer first beat.'
    }
    return 'Starts with a more active first beat.'
  }

  return 'Keeps the route shape, changes the landing style.'
}

function getSwapCascadeHint(role: UserStopRole, candidate: ItineraryStop): string {
  const tags = toTagSet(candidate.tags)
  if (role === 'highlight') {
    return ['quiet', 'cozy', 'conversation'].some((tag) => tags.has(tag))
      ? 'May soften the ending.'
      : 'May tighten the ending.'
  }
  if (role === 'start') {
    return 'May shift how quickly the middle builds.'
  }
  return 'May change how gently the night lands.'
}

function getPostSwapHintRole(role: UserStopRole): UserStopRole | null {
  if (role === 'start') {
    return 'highlight'
  }
  if (role === 'highlight') {
    return 'windDown'
  }
  return null
}

function getPostSwapHintText(role: UserStopRole): string | null {
  if (role === 'start') {
    return 'You may want to keep the middle focused.'
  }
  if (role === 'highlight') {
    return 'You may want to tighten this ending.'
  }
  return null
}

function getHighlightTypeLabel(stop?: ItineraryStop): string {
  if (!stop) {
    return 'main highlight'
  }
  const tags = toTagSet(stop.tags)
  const late = tags.has('late-night') || tags.has('night-owl')
  if (tags.has('jazz')) {
    return late ? 'late jazz set' : 'jazz set'
  }
  if (stop.category === 'live_music' || ['live', 'music', 'performance', 'listening'].some((tag) => tags.has(tag))) {
    return late ? 'late live music set' : 'live music set'
  }
  if (stop.category === 'restaurant' || ['dinner', 'chef-led', 'tasting'].some((tag) => tags.has(tag))) {
    return 'dinner anchor'
  }
  if (stop.category === 'bar' || ['cocktails', 'social'].some((tag) => tags.has(tag))) {
    return 'cocktail-forward highlight'
  }
  return 'main highlight'
}

function getStartPacingLabel(stop?: ItineraryStop): string {
  if (!stop) {
    return 'a balanced start'
  }
  const tags = toTagSet(stop.tags)
  if (['quiet', 'cozy', 'conversation', 'coffee', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
    return 'a relaxed start'
  }
  if (['high-energy', 'buzzing', 'social', 'lively'].some((tag) => tags.has(tag))) {
    return 'an energetic start'
  }
  return 'a balanced start'
}

function getFinishPacingLabel(stop?: ItineraryStop): string {
  if (!stop) {
    return 'a clean finish'
  }
  const tags = toTagSet(stop.tags)
  if (['dessert', 'quiet', 'cozy', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
    return 'a clean finish'
  }
  if (['social', 'late-night', 'cocktails'].some((tag) => tags.has(tag))) {
    return 'a social finish'
  }
  return 'a clean finish'
}

function getVibeNarrativeLabel(cluster: RealityCluster): string {
  if (cluster === 'lively') {
    return 'lively'
  }
  if (cluster === 'chill') {
    return 'slower-paced'
  }
  return 'exploratory'
}

type NightPreviewMode = 'social' | 'exploratory' | 'intimate'

function getNightPreviewMode(cluster: RealityCluster, itinerary: Itinerary): NightPreviewMode {
  let socialScore = 0
  let exploratoryScore = 0
  let intimateScore = 0

  itinerary.stops.forEach((stop) => {
    const tags = toTagSet(stop.tags)
    if (
      stop.category === 'live_music' ||
      stop.category === 'bar' ||
      ['live', 'music', 'jazz', 'social', 'cocktails'].some((tag) => tags.has(tag))
    ) {
      socialScore += 1
    }
    if (
      stop.category === 'museum' ||
      stop.category === 'activity' ||
      stop.category === 'park' ||
      ['gallery', 'culture', 'walking', 'walkable', 'explore'].some((tag) => tags.has(tag))
    ) {
      exploratoryScore += 1
    }
    if (
      stop.category === 'restaurant' ||
      ['quiet', 'cozy', 'conversation', 'tea', 'dessert', 'courtyard'].some((tag) =>
        tags.has(tag),
      )
    ) {
      intimateScore += 1
    }
  })

  if (socialScore > exploratoryScore && socialScore > intimateScore) {
    return 'social'
  }
  if (exploratoryScore > socialScore && exploratoryScore > intimateScore) {
    return 'exploratory'
  }
  if (intimateScore > socialScore && intimateScore > exploratoryScore) {
    return 'intimate'
  }
  if (cluster === 'lively') {
    return 'social'
  }
  if (cluster === 'explore') {
    return 'exploratory'
  }
  return 'intimate'
}

function getPreviewOneLiner(cluster: RealityCluster, itinerary: Itinerary): string {
  const mode = getNightPreviewMode(cluster, itinerary)
  if (mode === 'social') {
    return 'A lively night that builds and keeps moving'
  }
  if (mode === 'exploratory') {
    return 'A relaxed night with room to wander and discover'
  }
  return 'A slower night built around a few strong moments'
}

function getClusterInterpretation(cluster: RealityCluster): string {
  if (cluster === 'lively') {
    return 'Higher social momentum with a stronger midpoint.'
  }
  if (cluster === 'chill') {
    return 'Softer pacing with a steadier build into the highlight.'
  }
  return 'More exploratory pacing with contrast across stops.'
}

function getRouteThesis(cluster: RealityCluster, itinerary: Itinerary): string {
  void cluster
  void itinerary
  return ''
}

function getPreviewContinuityLine(
  _cluster: RealityCluster,
  _itinerary: Itinerary,
  _arc?: ArcCandidate,
): string {
  return 'Everything stays close and easy to move between'
}

function getPreviewStopDescription(stop?: ItineraryStop): string {
  if (!stop) {
    return 'This stop keeps the night moving.'
  }
  if (stop.role === 'start') {
    return `Start easy at ${stop.venueName} — a low-key spot to ease in.`
  }
  if (stop.role === 'highlight') {
    return `Head to ${stop.venueName} — this is where the night peaks.`
  }
  if (stop.role === 'windDown') {
    return `Wrap up at ${stop.venueName} — a relaxed place to land softly.`
  }
  return `If you want a pivot, ${stop.venueName} adds a flexible detour.`
}

function getInlineStopNarrative(
  stop: ItineraryStop,
  intent: IntentProfile,
  options?: {
    scoredVenue?: ScoredVenue
    roleTravelWindowMinutes?: number
    nearbySummary?: string
  },
): Pick<
  InlineStopDetail,
  | 'whyItFits'
  | 'tonightSignals'
  | 'aroundHereSignals'
  | 'knownFor'
  | 'goodToKnow'
  | 'localSignal'
  | 'venueLinkUrl'
> {
  const localSignal = getLocalSignal(stop)
  const venueLinkUrl = buildVenueLinkUrl(stop)
  const tonightSignals = buildTonightSignals({
    stop,
    scoredVenue: options?.scoredVenue,
    roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
    nearbySummary: options?.nearbySummary,
  })
  if (stop.role === 'highlight') {
    return {
      whyItFits: 'Stronger centerpiece than the closer options.',
      tonightSignals,
      knownFor: getKnownForLine(stop),
      goodToKnow: 'Best once the surrounding district is already picking up.',
      localSignal,
      venueLinkUrl,
    }
  }

  if (stop.role === 'start') {
    return {
      whyItFits: 'Sets the tone fast without peaking too early.',
      tonightSignals,
      knownFor: getKnownForLine(stop),
      goodToKnow:
        intent.persona === 'family'
          ? 'Good first stop when arrivals are staggered.'
          : 'Works well as an easy meeting point before the middle builds.',
      localSignal,
      venueLinkUrl,
    }
  }

  if (stop.role === 'windDown') {
    return {
      whyItFits: 'Lets the night land softly after the peak.',
      tonightSignals,
      knownFor: getKnownForLine(stop),
      goodToKnow: 'Best when you want a lower-noise finish with easy exits.',
      localSignal,
      venueLinkUrl,
    }
  }

  return {
    whyItFits: 'Adds contrast without breaking route flow.',
    tonightSignals,
    knownFor: getKnownForLine(stop),
    goodToKnow: 'Good as a flexible support stop if timing shifts.',
    localSignal,
    venueLinkUrl,
  }
}

function getInlineStopDetail(
  stop: ItineraryStop,
  intent: IntentProfile,
  scoredVenues: ScoredVenue[],
  itineraryStops: ItineraryStop[],
  currentArc: ArcCandidate,
  lens: ExperienceLens,
  options?: {
    roleTravelWindowMinutes?: number
    nearbySummary?: string
  },
): InlineStopDetail {
  const narrative = getInlineStopNarrative(stop, intent, {
    scoredVenue: findScoredVenueForStop(stop, currentArc),
    roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
    nearbySummary: options?.nearbySummary,
  })
  const alternatives = getRoleAlternatives(
    stop,
    scoredVenues,
    itineraryStops,
    currentArc,
    intent,
    lens,
  )
  return {
    ...narrative,
    alternatives,
  }
}

export function DemoPage() {
  const [city, setCity] = useState('San Jose')
  const [persona, setPersona] = useState<PersonaMode>('romantic')
  const [primaryVibe, setPrimaryVibe] = useState<VibeAnchor>('lively')
  const [selectedCluster, setSelectedCluster] = useState<RealityCluster | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [plan, setPlan] = useState<DemoPlanState>()
  const [hasRevealed, setHasRevealed] = useState(false)
  const [activeRole, setActiveRole] = useState<UserStopRole>('start')
  const [nearbySummaryByRole, setNearbySummaryByRole] = useState<Partial<Record<UserStopRole, string>>>(
    {},
  )
  const [isLocking, setIsLocking] = useState(false)
  const [previewSwap, setPreviewSwap] = useState<PreviewSwapState>()
  const [appliedSwapRole, setAppliedSwapRole] = useState<UserStopRole | null>(null)

  const generatePlan = async () => {
    if (!selectedCluster) {
      return
    }
    setLoading(true)
    setError(undefined)
    setIsLocking(false)
    setHasRevealed(false)
    setPreviewSwap(undefined)
    setAppliedSwapRole(null)
    setNearbySummaryByRole({})

    try {
      const interpretation = getRealityInterpretation(persona, primaryVibe)
      const selectedClusterConfirmation =
        interpretation.cards[selectedCluster].confirmation
      const result = await runGeneratePlan(
        {
          mode: 'build',
          planningMode: 'engine-led',
          persona,
          primaryVibe,
          city: city.trim() || 'San Jose',
          distanceMode: 'nearby',
          refinementModes: clusterRefinementMap[selectedCluster],
        },
        {
          sourceMode: 'curated',
          sourceModeOverrideApplied: true,
          debugMode: false,
        },
      )
      setPlan({
        itinerary: result.itinerary,
        selectedArc: result.selectedArc,
        scoredVenues: result.scoredVenues,
        intentProfile: result.intentProfile,
        lens: result.lens,
        selectedCluster,
        selectedClusterConfirmation,
      })
      setActiveRole('start')
      setNearbySummaryByRole({})
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Failed to generate plan.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSelectedCluster(null)
    setHasRevealed(false)
    setIsLocking(false)
    setPreviewSwap(undefined)
    setAppliedSwapRole(null)
    setNearbySummaryByRole({})
  }, [persona, primaryVibe])

  const handleNearbySummaryChange = useCallback(
    (role: UserStopRole, summary: string | null) => {
      setNearbySummaryByRole((current) => {
        if (!summary) {
          if (!(role in current)) {
            return current
          }
          const next = { ...current }
          delete next[role]
          return next
        }
        if (current[role] === summary) {
          return current
        }
        return {
          ...current,
          [role]: summary,
        }
      })
    },
    [],
  )

  const handlePreviewAlternative = (role: UserStopRole, venueId: string) => {
    if (!plan) {
      return
    }
    const replacement = plan.scoredVenues.find((candidate) => candidate.venue.id === venueId)
    const originalStop = plan.itinerary.stops.find((stop) => stop.role === role)
    if (!replacement || !originalStop) {
      return
    }
    const crewPolicy = getCrewPolicy(plan.intentProfile.crew)
    const swappedArc = swapArcStop({
      currentArc: plan.selectedArc,
      role: inverseRoleProjection[role],
      replacement,
      intent: plan.intentProfile,
      crewPolicy,
      lens: plan.lens,
    })
    if (!swappedArc) {
      return
    }
    const swappedItinerary = projectItinerary(swappedArc, plan.intentProfile, plan.lens)
    const candidateStop = swappedItinerary.stops.find((stop) => stop.role === role)
    if (!candidateStop) {
      return
    }
    const candidateNarrative = getInlineStopNarrative(candidateStop, plan.intentProfile, {
      scoredVenue: findScoredVenueForStop(candidateStop, swappedArc),
      roleTravelWindowMinutes: getRoleTravelWindow(swappedItinerary, role),
    })
    const originalTravel = getRoleTravelWindow(plan.itinerary, role)
    const candidateTravel = getRoleTravelWindow(swappedItinerary, role)
    const travelDelta = Math.round(candidateTravel - originalTravel)
    const constraintSignal =
      travelDelta >= 2
        ? `Adds ~${travelDelta} min travel.`
        : travelDelta <= -2
          ? `Saves ~${Math.abs(travelDelta)} min travel.`
          : 'Keeps travel about the same.'

    setActiveRole(role)
    setPreviewSwap({
      role,
      originalStop,
      candidateStop,
      swappedArc,
      swappedItinerary,
      descriptor: getAlternativeDescriptor(replacement),
      whyItFits: candidateNarrative.whyItFits,
      knownFor: candidateNarrative.knownFor,
      localSignal: candidateNarrative.localSignal ?? 'Best earlier in the evening.',
      venueLinkUrl: candidateNarrative.venueLinkUrl ?? buildVenueLinkUrl(candidateStop),
      tradeoffSignal: getSwapTradeoffSignal(role, candidateStop),
      constraintSignal,
      cascadeHint: getSwapCascadeHint(role, candidateStop),
    })
    setAppliedSwapRole(null)
  }

  const handleApplyPreviewSwap = (role: UserStopRole) => {
    if (!plan || !previewSwap || previewSwap.role !== role) {
      return
    }
    setPlan({
      ...plan,
      itinerary: previewSwap.swappedItinerary,
      selectedArc: previewSwap.swappedArc,
    })
    setPreviewSwap(undefined)
    setAppliedSwapRole(role)
    setActiveRole(role)
  }

  const handleKeepCurrentSwap = (role: UserStopRole) => {
    if (!previewSwap || previewSwap.role !== role) {
      return
    }
    setPreviewSwap(undefined)
  }

  const handleLockNight = () => {
    if (!plan || isLocking) {
      return
    }
    setIsLocking(true)
    saveLiveArtifactSession({
      city: plan.itinerary.city || city.trim() || 'San Jose',
      itinerary: plan.itinerary,
      selectedClusterConfirmation: plan.selectedClusterConfirmation,
      initialActiveRole: activeRole,
      lockedAt: Date.now(),
    })
    window.setTimeout(() => {
      window.location.assign('/journey/live')
    }, 220)
  }

  const startStop = useMemo(
    () => (plan ? getCoreStop(plan.itinerary, 'start') : undefined),
    [plan],
  )
  const highlightStop = useMemo(
    () => (plan ? getCoreStop(plan.itinerary, 'highlight') : undefined),
    [plan],
  )
  const windDownStop = useMemo(
    () => (plan ? getCoreStop(plan.itinerary, 'windDown') : undefined),
    [plan],
  )
  const previewCoreStops = useMemo(
    () =>
      plan
        ? plan.itinerary.stops.filter((stop) =>
            ['start', 'highlight', 'surprise', 'windDown'].includes(stop.role),
          )
        : [],
    [plan],
  )
  const previewImage =
    highlightStop?.imageUrl ?? startStop?.imageUrl ?? windDownStop?.imageUrl
  const inlineDetailsByRole = useMemo(() => {
    if (!plan) {
      return {}
    }
    return Object.fromEntries(
      plan.itinerary.stops.map((stop) => {
        const inlineDetail = getInlineStopDetail(
          stop,
          plan.intentProfile,
          plan.scoredVenues,
          plan.itinerary.stops,
          plan.selectedArc,
          plan.lens,
          {
            roleTravelWindowMinutes: getRoleTravelWindow(plan.itinerary, stop.role),
            nearbySummary: nearbySummaryByRole[stop.role],
          },
        )
        const nearbySummary = nearbySummaryByRole[stop.role]
        if (nearbySummary) {
          inlineDetail.aroundHereSignals = [nearbySummary]
        }
        return [stop.role, inlineDetail]
      }),
    ) as Partial<
      Record<
        UserStopRole,
        {
          whyItFits: string
          tonightSignals?: string[]
          aroundHereSignals?: string[]
          knownFor: string
          goodToKnow: string
          localSignal?: string
          alternatives?: InlineAlternative[]
          venueLinkUrl?: string
        }
      >
    >
  }, [nearbySummaryByRole, plan])
  const appliedSwapNoteByRole = useMemo(() => {
    if (!appliedSwapRole) {
      return {}
    }
    return {
      [appliedSwapRole]: 'Adjusted while keeping your flow intact',
    } as Partial<Record<UserStopRole, string>>
  }, [appliedSwapRole])
  const postSwapHintByRole = useMemo(() => {
    if (!appliedSwapRole || !plan) {
      return {}
    }
    const hintRole = getPostSwapHintRole(appliedSwapRole)
    const hintText = getPostSwapHintText(appliedSwapRole)
    if (!hintRole || !hintText || !plan.itinerary.stops.some((stop) => stop.role === hintRole)) {
      return {}
    }
    return {
      [hintRole]: hintText,
    } as Partial<Record<UserStopRole, string>>
  }, [appliedSwapRole, plan])

  return (
    <PageShell
      topSlot={
        <ID8Butler message="Pick a direction, review your route, and lock tonight when it feels right." />
      }
      title="ID.8 Concierge"
      subtitle="Plan tonight in minutes."
    >
      <div className="demo-flow-frame concierge-flow">
      <p className="concierge-context-line">Thoughtfully planned using real-time local context.</p>

      <section className="preview-adjustments draft-tune-panel">
        <div className="preview-adjustments-grid compact">
          <label className="input-group inline-field">
            <span className="input-label">Location</span>
            <input
              value="San Jose"
              readOnly
              aria-readonly="true"
            />
          </label>
          <label className="input-group inline-field">
            <span className="input-label">Persona</span>
            <select
              value={persona}
              onChange={(event) =>
                setPersona(event.target.value as PersonaMode)
              }
            >
              {personaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="input-group inline-field">
            <span className="input-label">Vibe</span>
            <select
              value={primaryVibe}
              onChange={(event) =>
                setPrimaryVibe(event.target.value as VibeAnchor)
              }
            >
              {vibeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <RealityCommitStep
        persona={persona}
        vibe={primaryVibe}
        selectedCluster={selectedCluster}
        onSelectCluster={setSelectedCluster}
        onGenerate={generatePlan}
        loading={loading}
      />

      {error && (
        <div className="preview-notice draft-feedback">
          <p className="preview-notice-title">Could not generate</p>
          <p className="preview-notice-copy">{error}</p>
        </div>
      )}

      {!hasRevealed && plan && (
        <section className="plan-preview">
          <article className="night-preview-card">
            {previewImage && (
              <div className="night-preview-media">
                <img src={previewImage} alt={highlightStop?.venueName ?? 'Tonight route'} />
              </div>
            )}
            <div className="night-preview-content">
              <p className="night-preview-kicker">Tonight&apos;s route</p>
              <p className="concierge-transition-line">Your night is ready.</p>
              <h3>{getPreviewOneLiner(plan.selectedCluster, plan.itinerary)}</h3>
              <div className="night-preview-stops">
                {previewCoreStops.map((stop) => (
                  <div key={stop.id} className="night-preview-stop-item">
                    <p className="night-preview-stop-description">{getPreviewStopDescription(stop)}</p>
                  </div>
                ))}
              </div>
              <p className="system-line">{getPreviewContinuityLine(plan.selectedCluster, plan.itinerary, plan.selectedArc)}</p>
              <div className="action-row draft-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setHasRevealed(true)}
                >
                  Review full route
                </button>
              </div>
            </div>
          </article>
        </section>
      )}

      {hasRevealed && plan && (
        <section className={`plan-reveal${isLocking ? ' is-locking' : ''}`}>
          <div className="confirm-night-header">
            <h2>Confirm your night</h2>
            <p>Take one last look.</p>
          </div>

          <p className="preview-notice-copy">{plan.selectedClusterConfirmation}</p>

          <JourneyMapReal
            activeRole={activeRole}
            routeStops={plan.itinerary.stops.map((stop, stopIndex) => ({
              id: stop.id,
              role: stop.role,
              name: stop.venueName,
              displayName: stop.venueName,
              stopIndex,
            }))}
            onNearbySummaryChange={handleNearbySummaryChange}
          />

          <RouteSpine
            className="draft-story-spine"
            stops={plan.itinerary.stops}
            storySpine={plan.itinerary.storySpine}
            routeHeadline={getPreviewOneLiner(plan.selectedCluster, plan.itinerary)}
            routeWhyLine={getPreviewContinuityLine(
              plan.selectedCluster,
              plan.itinerary,
              plan.selectedArc,
            )}
            usedRecoveredCentralMomentHighlight={Boolean(
              plan.selectedArc.scoreBreakdown.recoveredCentralMomentHighlight,
            )}
            routeDebugSummary={{
              arcType: getRouteArcType(plan.itinerary),
              highlightIntensity: getHighlightIntensityFromArc(plan.selectedArc),
              usedRecoveredCentralMomentHighlight: Boolean(
                plan.selectedArc.scoreBreakdown.usedRecoveredCentralMomentHighlight ??
                  plan.selectedArc.scoreBreakdown.recoveredCentralMomentHighlight,
              ),
            }}
            allowStopAdjustments={false}
            enableInlineDetails
            inlineDetailsByRole={inlineDetailsByRole}
            appliedSwapNoteByRole={appliedSwapNoteByRole}
            postSwapHintByRole={postSwapHintByRole}
            activeRole={activeRole}
            changedRoles={[]}
            animatedRoles={[]}
            alternativesByRole={{}}
            alternativeKindsByRole={{}}
            highlightDecisionSignal="Chosen over closer options to carry the night better."
            onFocusRole={setActiveRole}
            onShowSwap={() => undefined}
            onShowNearby={() => undefined}
            onApplySwap={() => undefined}
            onPreviewAlternative={handlePreviewAlternative}
          />

          <p className="system-line">{getBearingsSignal(plan.itinerary)}</p>
          {appliedSwapRole && (
            <p className="system-line swap-global-signal">
              Your route shifted slightly to keep the night balanced.
            </p>
          )}

          <p className="system-line">
            We&apos;ll keep your night on track as things shift.
          </p>

          <p className="confirm-decision-line">
            {isLocking
              ? 'Locking it in...'
              : 'Ready when you are.'}
          </p>

          <div className="action-row draft-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleLockNight}
              disabled={isLocking}
            >
              {isLocking ? 'Locking it in...' : 'Lock this night'}
            </button>
            <button type="button" className="ghost-button">
              Send to friends
            </button>
          </div>
        </section>
      )}
      </div>

      {previewSwap && (
        <div
          className="swap-preview-overlay"
          onClick={() => setPreviewSwap(undefined)}
          role="presentation"
        >
          <article
            className="swap-preview-popout"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swap-preview-header">
              <p className="swap-preview-kicker">Swap option</p>
              <button
                type="button"
                className="ghost-button subtle"
                onClick={() => setPreviewSwap(undefined)}
              >
                Close
              </button>
            </div>

            <div className="swap-preview-card">
              <div className="swap-preview-image-wrap">
                <img
                  src={previewSwap.candidateStop.imageUrl}
                  alt={previewSwap.candidateStop.venueName}
                />
              </div>
              <div className="swap-preview-body">
                <span className="reveal-story-chip active">{previewSwap.candidateStop.title}</span>
                <h3>{previewSwap.candidateStop.venueName}</h3>
                <p className="swap-preview-descriptor">{previewSwap.descriptor}</p>
                <p className="stop-card-meta">
                  <span className="district-name">{previewSwap.candidateStop.neighborhood}</span> |{' '}
                  {previewSwap.candidateStop.driveMinutes} min out
                </p>

                <div className="stop-card-inline-detail-row">
                  <p className="stop-card-inline-detail-label">Why it fits</p>
                  <p className="stop-card-inline-detail-copy">{previewSwap.whyItFits}</p>
                </div>
                <div className="stop-card-inline-detail-row">
                  <p className="stop-card-inline-detail-label">Known for</p>
                  <p className="stop-card-inline-detail-copy">{previewSwap.knownFor}</p>
                </div>
                <div className="stop-card-inline-detail-row">
                  <p className="stop-card-inline-detail-label">Local signal</p>
                  <p className="stop-card-inline-detail-copy">{previewSwap.localSignal}</p>
                </div>

                <div className="swap-preview-impact">
                  <p className="stop-card-inline-detail-label">What changes</p>
                  <ul className="swap-preview-impact-list">
                    <li>{previewSwap.tradeoffSignal}</li>
                    <li>{previewSwap.constraintSignal}</li>
                    <li>{previewSwap.cascadeHint}</li>
                  </ul>
                </div>
                <p className="swap-preview-reassure">The rest of your route stays stable.</p>

                <div className="swap-preview-actions">
                  <a
                    className="stop-card-venue-link"
                    href={previewSwap.venueLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open venue page{' ->'}
                  </a>
                  <div className="action-row">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleKeepCurrentSwap(previewSwap.role)}
                    >
                      Stay on plan
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => handleApplyPreviewSwap(previewSwap.role)}
                    >
                      Swap this stop
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </PageShell>
  )
}

