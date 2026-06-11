import type { ContractEntryArtifact } from '../../../domain/artifacts/contractEntryArtifact'
import type { StarterPack } from '../../../domain/types/starterPack'

export const PUBLIC_CURATE_CARD_TRUTH_CURRENT_SOURCE_COUNT = 34
export const PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT = 9
export const PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED = false

export type PublicCurateCardTruthStatus =
  | 'allowed'
  | 'rejected'
  | 'no_candidate'
  | 'not_migrated'

export type PublicCurateStarterFitRejectionReason =
  | 'starter_id_mismatch'
  | 'missing_required_role'
  | 'invalid_role_mapping'
  | 'category_family_mismatch'
  | 'card_promise_mismatch'
  | 'scenario_intent_mismatch'
  | 'invalid_source_provenance'
  | 'approved_payload_starter_mismatch'
  | 'approved_payload_artifact_mismatch'

export type PublicCurateRouteRole =
  | 'start'
  | 'highlight'
  | 'windDown'
  | 'warmup'
  | 'peak'
  | 'cooldown'
  | 'wildcard'

export interface PublicCurateRouteStopInput {
  role: PublicCurateRouteRole | string
  name: string
  category?: string | null
  sourceOrigin?: string | null
  sourceMode?: string | null
}

export interface PublicCurateQualificationDiagnostic {
  status: 'checking' | 'committable' | 'infeasible' | 'not_run'
  hasApprovedPayload: boolean
  approvedRefinementEntryPayload?: unknown
}

export interface PublicCurateApprovedPayloadReference {
  starterPackId?: string | null
  artifactId?: string | null
}

export interface PublicCurateCardTruthInput {
  selectedStarterPack: StarterPack | null
  cacheKeyScope?: string | null
  artifactCandidates?: ContractEntryArtifact[]
  routeStops?: PublicCurateRouteStopInput[]
  selectedArtifactId?: string | null
  qualificationByArtifactId?: Record<string, PublicCurateQualificationDiagnostic>
  approvedRefinementEntryPayload?: PublicCurateApprovedPayloadReference | null
  committedRouteFallbackRenderEnabled: boolean
  currentPageRender?: {
    wouldRenderCard: boolean
    primaryCardDisplayMode?: string | null
    selectedArtifactId?: string | null
  }
}

export interface PublicCurateStarterFitResult {
  status: 'passed' | 'rejected' | 'not_run'
  allowedToRender: boolean
  rejectionReasons: PublicCurateStarterFitRejectionReason[]
  routeStops: PublicCurateRouteStopInput[]
  normalizedRoles: Partial<Record<'start' | 'highlight' | 'windDown', string>>
}

export interface PublicCurateVisibleCardModel {
  artifactId: string
  routeTitle: string
  routeStops: PublicCurateRouteStopInput[]
  allowedToRender: boolean
  rejectionReasons: PublicCurateStarterFitRejectionReason[]
}

export interface PublicCurateRouteProjectionDiagnostic {
  artifactId: string | null
  allowedToRender: boolean
  source: 'service_diagnostic_only'
  routeStops: PublicCurateRouteStopInput[]
}

export interface PublicCurateCardTruthDiagnostics {
  currentAuditedTruthSourceCount: number
  serviceTruthSourceCount: number
  minimumLoadBearingTruthSourceCount: number
  publicRenderMigrated: boolean
  cardTruthStatus: PublicCurateCardTruthStatus
  starterFitStatus: PublicCurateStarterFitResult['status']
  rejectionReasons: PublicCurateStarterFitRejectionReason[]
  routeStops: PublicCurateRouteStopInput[]
  allowedToRender: boolean
  pageCurrentlyWouldRenderSomethingElse: boolean
  committedRouteFallbackRenderEnabled: boolean
  committedRouteFallbackRenderEligible: boolean
}

export interface PublicCurateCardTruthModel {
  starterPackId: string | null
  cacheKeyScope: string | null
  artifactCandidates: ContractEntryArtifact[]
  starterFitByArtifactId: Record<string, PublicCurateStarterFitResult>
  qualificationByArtifactId: Record<string, PublicCurateQualificationDiagnostic>
  visibleCards: PublicCurateVisibleCardModel[]
  selectedCard: PublicCurateVisibleCardModel | null
  selectedRouteProjection: PublicCurateRouteProjectionDiagnostic | null
  approvedRefinementEntryPayload: unknown | null
  reviewModel: PublicCurateRouteProjectionDiagnostic | null
  revealJourneyModel: PublicCurateRouteProjectionDiagnostic | null
  lockLiveModel: PublicCurateRouteProjectionDiagnostic | null
  plansHubPayload: PublicCurateRouteProjectionDiagnostic | null
  diagnostics: PublicCurateCardTruthDiagnostics
  actionsAllowed: {
    review: boolean
    revealJourneyMap: boolean
    lockLive: boolean
    plansHubSave: boolean
  }
}

const requiredRoles = ['start', 'highlight', 'windDown'] as const

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function mapRouteRole(role: string): 'start' | 'highlight' | 'windDown' | null {
  const normalized = normalizeText(role)
  if (normalized === 'start' || normalized === 'warmup') {
    return 'start'
  }
  if (normalized === 'highlight' || normalized === 'peak') {
    return 'highlight'
  }
  if (normalized === 'winddown' || normalized === 'wind down' || normalized === 'cooldown') {
    return 'windDown'
  }
  return null
}

function parseRouteStop(value: string): PublicCurateRouteStopInput {
  const separatorIndex = value.indexOf(':')
  if (separatorIndex === -1) {
    return {
      role: 'unknown',
      name: value.trim(),
    }
  }
  return {
    role: value.slice(0, separatorIndex).trim(),
    name: value.slice(separatorIndex + 1).trim(),
  }
}

export function parsePublicCurateRouteStops(
  values: readonly string[] | null | undefined,
): PublicCurateRouteStopInput[] {
  return (values ?? []).map(parseRouteStop)
}

function routeStopsFromArtifact(artifact: ContractEntryArtifact): PublicCurateRouteStopInput[] {
  return [
    {
      role: 'start',
      name: artifact.storySpine.start,
    },
    {
      role: 'highlight',
      name: artifact.storySpine.highlight,
    },
    {
      role: 'windDown',
      name: artifact.storySpine.windDown,
    },
  ]
}

function inferCategoryTokens(stop: PublicCurateRouteStopInput): Set<string> {
  const corpus = normalizeText([stop.name, stop.category].filter(Boolean).join(' '))
  const tokens = new Set<string>()
  const addCategory = (category: string) => {
    tokens.add(normalizeText(category))
  }
  if (corpus.includes('music') || corpus.includes('theatre') || corpus.includes('theater') || corpus.includes('jazz')) {
    addCategory('live_music')
    addCategory('event')
  }
  if (corpus.includes('adega') || corpus.includes('wine') || corpus.includes('bar') || corpus.includes('sake')) {
    addCategory('bar')
    addCategory('restaurant')
  }
  if (corpus.includes('gelato') || corpus.includes('dessert') || corpus.includes('bakehouse') || corpus.includes('ice cream')) {
    addCategory('dessert')
  }
  if (corpus.includes('cafe') || corpus.includes('coffee') || corpus.includes('nirvana soul') || corpus.includes('matcha')) {
    addCategory('cafe')
  }
  if (corpus.includes('miniboss') || corpus.includes('arcade') || corpus.includes('gamebox') || corpus.includes('boardgame')) {
    addCategory('activity')
  }
  if (corpus.includes('gallery') || corpus.includes('museum') || corpus.includes('tech interactive')) {
    addCategory('museum')
  }
  if (corpus.includes('park') || corpus.includes('garden') || corpus.includes('promenade')) {
    addCategory('park')
  }
  return tokens
}

function hasRequiredCategoryFit(params: {
  starterPack: StarterPack
  role: 'start' | 'highlight' | 'windDown'
  stop: PublicCurateRouteStopInput | undefined
}): boolean {
  const roleShape = params.starterPack.lensPreset?.preferredStopShapes?.[params.role]
  const roleContract = params.starterPack.roleContracts?.[params.role]
  const requiredCategories = [
    ...(roleContract?.requiredCategories ?? []),
    ...(roleShape?.preferredCategories ?? []),
  ]
  if (requiredCategories.length === 0) {
    return true
  }
  if (!params.stop) {
    return false
  }
  const categoryTokens = inferCategoryTokens(params.stop)
  return requiredCategories.some((category) => categoryTokens.has(normalizeText(category)))
}

function hasStarterPromiseFit(params: {
  starterPack: StarterPack
  normalizedRoles: Partial<Record<'start' | 'highlight' | 'windDown', string>>
  routeStopsByRole: Partial<Record<'start' | 'highlight' | 'windDown', PublicCurateRouteStopInput>>
}): boolean {
  const starterId = params.starterPack.id
  if (starterId === 'live-music-loop') {
    const highlightName = normalizeText(params.normalizedRoles.highlight)
    const highlightCategories = params.routeStopsByRole.highlight
      ? inferCategoryTokens(params.routeStopsByRole.highlight)
      : new Set<string>()
    return (
      highlightCategories.has('live music') ||
      highlightName.includes('music') ||
      highlightName.includes('theatre') ||
      highlightName.includes('theater') ||
      highlightName.includes('performance')
    )
  }
  if (starterId === 'hidden-cocktail-corners') {
    const routeCorpus = normalizeText(Object.values(params.normalizedRoles).join(' '))
    return (
      routeCorpus.includes('cocktail') ||
      routeCorpus.includes('bar') ||
      routeCorpus.includes('sake') ||
      routeCorpus.includes('music') ||
      routeCorpus.includes('theatre') ||
      routeCorpus.includes('theater')
    )
  }
  if (starterId === 'arcade-and-drinks') {
    const highlightName = normalizeText(params.normalizedRoles.highlight)
    const highlightCategories = params.routeStopsByRole.highlight
      ? inferCategoryTokens(params.routeStopsByRole.highlight)
      : new Set<string>()
    return (
      highlightCategories.has('activity') ||
      highlightCategories.has('bar') ||
      highlightName.includes('arcade') ||
      highlightName.includes('miniboss') ||
      highlightName.includes('game')
    )
  }
  return true
}

export function validatePublicCurateStarterFit(params: {
  selectedStarterPack: StarterPack | null
  artifact?: ContractEntryArtifact | null
  routeStops?: PublicCurateRouteStopInput[]
  approvedRefinementEntryPayload?: PublicCurateApprovedPayloadReference | null
}): PublicCurateStarterFitResult {
  const routeStops =
    params.routeStops && params.routeStops.length > 0
      ? params.routeStops
      : params.artifact
        ? routeStopsFromArtifact(params.artifact)
        : []
  const rejectionReasons = new Set<PublicCurateStarterFitRejectionReason>()
  const normalizedRoles: Partial<Record<'start' | 'highlight' | 'windDown', string>> = {}
  const routeStopsByRole: Partial<Record<'start' | 'highlight' | 'windDown', PublicCurateRouteStopInput>> = {}

  routeStops.forEach((stop) => {
    const mappedRole = mapRouteRole(stop.role)
    if (!mappedRole && normalizeText(stop.role) !== 'wildcard') {
      rejectionReasons.add('invalid_role_mapping')
      return
    }
    if (!mappedRole || normalizedRoles[mappedRole]) {
      return
    }
    normalizedRoles[mappedRole] = stop.name
    routeStopsByRole[mappedRole] = stop
  })

  if (!params.selectedStarterPack) {
    rejectionReasons.add('starter_id_mismatch')
  }

  requiredRoles.forEach((role) => {
    const value = normalizeText(normalizedRoles[role])
    if (!value || value.includes('missing ')) {
      rejectionReasons.add('missing_required_role')
    }
  })

  const starterPack = params.selectedStarterPack
  if (starterPack) {
    requiredRoles.forEach((role) => {
      if (!hasRequiredCategoryFit({
        starterPack,
        role,
        stop: routeStopsByRole[role],
      })) {
        rejectionReasons.add('category_family_mismatch')
      }
    })
    if (!hasStarterPromiseFit({
      starterPack,
      normalizedRoles,
      routeStopsByRole,
    })) {
      rejectionReasons.add('card_promise_mismatch')
    }
  }

  if (
    params.approvedRefinementEntryPayload?.starterPackId &&
    params.selectedStarterPack &&
    params.approvedRefinementEntryPayload.starterPackId !== params.selectedStarterPack.id
  ) {
    rejectionReasons.add('approved_payload_starter_mismatch')
  }
  if (
    params.approvedRefinementEntryPayload?.artifactId &&
    params.artifact &&
    params.approvedRefinementEntryPayload.artifactId !== params.artifact.id
  ) {
    rejectionReasons.add('approved_payload_artifact_mismatch')
  }
  if (params.artifact?.sourceMode && params.artifact.sourceMode !== 'curated') {
    rejectionReasons.add('invalid_source_provenance')
  }

  return {
    status: rejectionReasons.size > 0 ? 'rejected' : routeStops.length > 0 ? 'passed' : 'not_run',
    allowedToRender: rejectionReasons.size === 0 && routeStops.length > 0,
    rejectionReasons: [...rejectionReasons],
    routeStops,
    normalizedRoles,
  }
}

export function buildPublicCurateCardTruthModel(
  input: PublicCurateCardTruthInput,
): PublicCurateCardTruthModel {
  const selectedArtifact =
    input.artifactCandidates?.find((artifact) => artifact.id === input.selectedArtifactId) ??
    input.artifactCandidates?.[0] ??
    null
  const routeStops = input.routeStops?.length
    ? input.routeStops
    : selectedArtifact
      ? routeStopsFromArtifact(selectedArtifact)
      : []
  const selectedStarterFit = validatePublicCurateStarterFit({
    selectedStarterPack: input.selectedStarterPack,
    artifact: selectedArtifact,
    routeStops,
    approvedRefinementEntryPayload: input.approvedRefinementEntryPayload,
  })
  const starterFitByArtifactId = Object.fromEntries(
    (input.artifactCandidates ?? []).map((artifact) => [
      artifact.id,
      validatePublicCurateStarterFit({
        selectedStarterPack: input.selectedStarterPack,
        artifact,
        approvedRefinementEntryPayload: input.approvedRefinementEntryPayload,
      }),
    ]),
  )
  const qualificationByArtifactId = input.qualificationByArtifactId ?? {}
  const visibleCards = (input.artifactCandidates ?? [])
    .map((artifact) => {
      const starterFit = starterFitByArtifactId[artifact.id]
      return {
        artifactId: artifact.id,
        routeTitle: artifact.routeTitle,
        routeStops: starterFit?.routeStops ?? routeStopsFromArtifact(artifact),
        allowedToRender: starterFit?.allowedToRender === true,
        rejectionReasons: starterFit?.rejectionReasons ?? [],
      }
    })
    .filter((card) => card.allowedToRender)
  const selectedCard = visibleCards.find((card) => card.artifactId === selectedArtifact?.id) ?? visibleCards[0] ?? null
  const projection: PublicCurateRouteProjectionDiagnostic | null = selectedStarterFit.allowedToRender
    ? {
        artifactId: selectedArtifact?.id ?? input.selectedArtifactId ?? null,
        allowedToRender: true,
        source: 'service_diagnostic_only',
        routeStops,
      }
    : null
  const approvedPayload =
    selectedArtifact &&
    selectedStarterFit.allowedToRender &&
    qualificationByArtifactId[selectedArtifact.id]?.hasApprovedPayload === true
      ? qualificationByArtifactId[selectedArtifact.id]?.approvedRefinementEntryPayload ?? null
      : null
  const cardTruthStatus: PublicCurateCardTruthStatus =
    routeStops.length === 0
      ? 'no_candidate'
      : selectedStarterFit.allowedToRender
        ? 'allowed'
        : 'rejected'

  return {
    starterPackId: input.selectedStarterPack?.id ?? null,
    cacheKeyScope: input.cacheKeyScope ?? input.selectedStarterPack?.id ?? null,
    artifactCandidates: input.artifactCandidates ?? [],
    starterFitByArtifactId,
    qualificationByArtifactId,
    visibleCards,
    selectedCard,
    selectedRouteProjection: projection,
    approvedRefinementEntryPayload: approvedPayload,
    reviewModel: projection,
    revealJourneyModel: projection,
    lockLiveModel: projection,
    plansHubPayload: projection,
    diagnostics: {
      currentAuditedTruthSourceCount: PUBLIC_CURATE_CARD_TRUTH_CURRENT_SOURCE_COUNT,
      serviceTruthSourceCount: PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT,
      minimumLoadBearingTruthSourceCount: PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT,
      publicRenderMigrated: PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED,
      cardTruthStatus,
      starterFitStatus: selectedStarterFit.status,
      rejectionReasons: selectedStarterFit.rejectionReasons,
      routeStops,
      allowedToRender: selectedStarterFit.allowedToRender,
      pageCurrentlyWouldRenderSomethingElse: Boolean(
        input.currentPageRender?.wouldRenderCard && !selectedStarterFit.allowedToRender,
      ),
      committedRouteFallbackRenderEnabled: input.committedRouteFallbackRenderEnabled,
      committedRouteFallbackRenderEligible: Boolean(
        input.committedRouteFallbackRenderEnabled && selectedStarterFit.allowedToRender,
      ),
    },
    actionsAllowed: {
      review: false,
      revealJourneyMap: false,
      lockLive: false,
      plansHubSave: false,
    },
  }
}
