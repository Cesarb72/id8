import type { ContractEntryArtifact } from '../../../domain/artifacts/contractEntryArtifact'
import {
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { StarterPack } from '../../../domain/types/starterPack'
import {
  buildCoffeeBooksSemanticRepresentationFromRouteStops,
  coffeeBooksSemanticRepresentationMissingReason,
  type CoffeeBooksSemanticRouteStopInput,
} from './coffeeBooksSemanticRepresentation'

export const PUBLIC_CURATE_CARD_TRUTH_CURRENT_SOURCE_COUNT = 34
export const PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT = 9
export const PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED = true

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
  | 'approved_payload_route_mismatch'
  | 'approved_payload_final_route_semantic_mismatch'

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
  finalRoute?: RuntimeRouteArtifact | null
}

export interface PublicCurateApprovedPayloadTruthResult {
  allowedToRender: boolean
  artifactId: string | null
  approvedPayloadArtifactId: string | null
  finalRoutePresent: boolean
  routeStops: PublicCurateRouteStopInput[]
  rejectionReasons: PublicCurateStarterFitRejectionReason[]
  coffeeBooksSemanticRepresentationStatus: 'represented' | 'missing' | 'not_applicable'
  coffeeBooksSuppressionReason: typeof coffeeBooksSemanticRepresentationMissingReason | null
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

export interface PublicCurateServiceCandidateInput {
  artifactId?: string | null
  routeStops: PublicCurateRouteStopInput[]
  sourceMode?: string | null
  qualification?: PublicCurateQualificationDiagnostic
  approvedRefinementEntryPayload?: PublicCurateApprovedPayloadReference | null
}

export interface PublicCurateStarterFitResult {
  status: 'passed' | 'rejected' | 'not_run'
  allowedToRender: boolean
  rejectionReasons: PublicCurateStarterFitRejectionReason[]
  routeStops: PublicCurateRouteStopInput[]
  normalizedRoles: Partial<Record<'start' | 'highlight' | 'windDown', string>>
}

export interface PublicCurateRoleCoverageDiagnostic {
  start: boolean
  highlight: boolean
  windDown: boolean
}

export interface PublicCurateServiceCandidateDiagnostic {
  starterPackId: string | null
  candidateArtifactId: string
  cacheKeyScope: string | null
  sourceMode: string | null
  routeStops: PublicCurateRouteStopInput[]
  roleCoverage: PublicCurateRoleCoverageDiagnostic
  starterFitStatus: PublicCurateStarterFitResult['status']
  rejectionReasons: PublicCurateStarterFitRejectionReason[]
  allowedToRender: boolean
  serviceTruthSourceCount: number
  publicRenderMigrated: boolean
  pageRenderMigrated: false
}

export interface PublicCurateCandidateConstructionDiagnostics {
  starterPackId: string | null
  serviceTruthSourceCount: number
  publicRenderMigrated: boolean
  pageRenderMigrated: false
  candidateCount: number
  candidateArtifactIds: string[]
  selectedCandidateArtifactId: string | null
  routeStops: PublicCurateRouteStopInput[]
  roleCoverage: PublicCurateRoleCoverageDiagnostic
  starterFitStatus: PublicCurateStarterFitResult['status']
  rejectionReasons: PublicCurateStarterFitRejectionReason[]
  cacheKeyScope: string | null
  sourceMode: string | null
  fetchCallCount: number
  allowedToRender: boolean
  committedRouteFallbackRenderEnabled: boolean
  committedRouteFallbackRenderEligible: boolean
  candidates: PublicCurateServiceCandidateDiagnostic[]
}

export type PublicCurateArcadeAndDrinksClassification =
  | 'corpus/data gap'
  | 'route-shape/planner gap'
  | 'card truth gap'
  | 'mixed'

export interface PublicCurateArcadeCorpusCandidateSummary {
  name: string
  category: string
  supportRoles: string[]
  warmupAffinity: number | null
  peakAffinity: number | null
  status: string
}

export interface PublicCurateArcadeAndDrinksDiagnostic {
  classification: PublicCurateArcadeAndDrinksClassification
  evidence: string[]
  supportedCandidateCount: number
  startRoleCandidateCount: number
  highlightOrSupportCandidateCount: number
  generatedRouteMissingStart: boolean
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

function routeStopsFromFinalRoute(
  finalRoute: RuntimeRouteArtifact | null | undefined,
): PublicCurateRouteStopInput[] {
  return (finalRoute?.stops ?? []).map((stop) => ({
    role: stop.role,
    name: stop.displayName,
    category: stop.title || stop.subtitle || stop.neighborhood || null,
    sourceOrigin: stop.providerRecordId ? 'provider_record' : null,
  }))
}

function normalizeRouteName(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function finalRouteMatchesArtifactCoreRoles(params: {
  artifact: ContractEntryArtifact
  finalRoute: RuntimeRouteArtifact
}): boolean {
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(params.artifact)
  const finalRouteByRole: Partial<Record<'start' | 'highlight' | 'windDown', string>> = {}
  params.finalRoute.stops.forEach((stop) => {
    const mappedRole = mapRouteRole(stop.role)
    if (mappedRole && !finalRouteByRole[mappedRole]) {
      finalRouteByRole[mappedRole] = stop.displayName
    }
  })
  return requiredRoles.every(
    (role) => normalizeRouteName(finalRouteByRole[role]) === normalizeRouteName(roleCoverage[role]),
  )
}

function routeStopsToCoffeeBooksInputs(
  routeStops: PublicCurateRouteStopInput[],
): CoffeeBooksSemanticRouteStopInput[] {
  return routeStops.map((stop, index) => ({
    venueId: `approved-final-route-${index}-${normalizeRouteName(stop.name) || 'stop'}`,
    name: stop.name,
    position:
      mapRouteRole(stop.role) === 'start'
        ? 'start'
        : mapRouteRole(stop.role) === 'highlight'
          ? 'highlight'
          : mapRouteRole(stop.role) === 'windDown'
            ? 'windDown'
            : 'mid',
    evidenceParts: [
      { field: 'displayName', value: stop.name },
      { field: 'venueCategory', value: stop.category },
      { field: 'sourceLabel', value: stop.sourceOrigin },
      { field: 'sourceType', value: stop.sourceMode },
    ],
  }))
}

export function validatePublicCurateApprovedPayloadTruth(params: {
  selectedStarterPack: StarterPack | null
  artifact: ContractEntryArtifact
  approvedRefinementEntryPayload?: PublicCurateApprovedPayloadReference | null
}): PublicCurateApprovedPayloadTruthResult {
  const rejectionReasons = new Set<PublicCurateStarterFitRejectionReason>()
  const approvedPayload = params.approvedRefinementEntryPayload ?? null
  const finalRoute = approvedPayload?.finalRoute ?? null
  const routeStops = routeStopsFromFinalRoute(finalRoute)

  if (!approvedPayload || !finalRoute) {
    rejectionReasons.add('approved_payload_route_mismatch')
  }
  if (approvedPayload?.starterPackId && params.selectedStarterPack) {
    if (approvedPayload.starterPackId !== params.selectedStarterPack.id) {
      rejectionReasons.add('approved_payload_starter_mismatch')
    }
  }
  if (approvedPayload?.artifactId !== params.artifact.id) {
    rejectionReasons.add('approved_payload_artifact_mismatch')
  }
  if (finalRoute && !finalRouteMatchesArtifactCoreRoles({ artifact: params.artifact, finalRoute })) {
    rejectionReasons.add('approved_payload_route_mismatch')
  }

  let coffeeBooksSemanticRepresentationStatus: PublicCurateApprovedPayloadTruthResult['coffeeBooksSemanticRepresentationStatus'] =
    'not_applicable'
  if (params.selectedStarterPack?.id === 'coffee-books') {
    const representation = buildCoffeeBooksSemanticRepresentationFromRouteStops(
      routeStopsToCoffeeBooksInputs(routeStops),
    )
    coffeeBooksSemanticRepresentationStatus = representation.status
    if (representation.status !== 'represented') {
      rejectionReasons.add('approved_payload_final_route_semantic_mismatch')
    }
  }

  return {
    allowedToRender: rejectionReasons.size === 0,
    artifactId: params.artifact.id,
    approvedPayloadArtifactId: approvedPayload?.artifactId ?? null,
    finalRoutePresent: Boolean(finalRoute),
    routeStops,
    rejectionReasons: [...rejectionReasons],
    coffeeBooksSemanticRepresentationStatus,
    coffeeBooksSuppressionReason:
      coffeeBooksSemanticRepresentationStatus === 'missing'
        ? coffeeBooksSemanticRepresentationMissingReason
        : null,
  }
}

function routeStopFingerprint(routeStops: PublicCurateRouteStopInput[]): string {
  const value = routeStops
    .map((stop) => `${normalizeText(stop.role)}-${normalizeText(stop.name)}`)
    .filter(Boolean)
    .join('--')
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'empty'
}

function buildDiagnosticCandidateArtifactId(params: {
  starterPackId: string | null
  index: number
  routeStops: PublicCurateRouteStopInput[]
}): string {
  return [
    params.starterPackId ?? 'no-starter',
    'service-candidate',
    String(params.index + 1),
    routeStopFingerprint(params.routeStops),
  ].join(':')
}

function buildRoleCoverage(
  starterFit: PublicCurateStarterFitResult,
): PublicCurateRoleCoverageDiagnostic {
  return {
    start: Boolean(starterFit.normalizedRoles.start?.trim()),
    highlight: Boolean(starterFit.normalizedRoles.highlight?.trim()),
    windDown: Boolean(starterFit.normalizedRoles.windDown?.trim()),
  }
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
  if (
    params.approvedRefinementEntryPayload?.finalRoute &&
    params.artifact &&
    !finalRouteMatchesArtifactCoreRoles({
      artifact: params.artifact,
      finalRoute: params.approvedRefinementEntryPayload.finalRoute,
    })
  ) {
    rejectionReasons.add('approved_payload_route_mismatch')
  }
  if (params.artifact?.sourceMode && params.artifact.sourceMode !== 'curated') {
    rejectionReasons.add('invalid_source_provenance')
  }
  if (params.artifact) {
    const artifactValidation = validateContractEntryArtifactPreCommitTruth(params.artifact, {
      requireEnrichment: true,
    })
    if (!artifactValidation.fullPlanVisible || artifactValidation.status !== 'valid') {
      rejectionReasons.add('missing_required_role')
    }
    if (params.artifact.enrichment?.mode && params.artifact.enrichment.mode !== 'curate') {
      rejectionReasons.add('scenario_intent_mismatch')
    }
    const artifactStarterPackId =
      params.artifact.enrichment?.starterContextFit?.starterPackId ??
      params.artifact.enrichment?.userInputContext?.starterPackId
    if (
      params.selectedStarterPack &&
      artifactStarterPackId &&
      artifactStarterPackId !== params.selectedStarterPack.id
    ) {
      rejectionReasons.add('starter_id_mismatch')
    }
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
  const routeStops = selectedArtifact ? routeStopsFromArtifact(selectedArtifact) : []
  const selectedStarterFit = selectedArtifact
    ? validatePublicCurateStarterFit({
        selectedStarterPack: input.selectedStarterPack,
        artifact: selectedArtifact,
        routeStops,
        approvedRefinementEntryPayload:
          input.qualificationByArtifactId?.[selectedArtifact.id]?.approvedRefinementEntryPayload ??
          input.approvedRefinementEntryPayload,
      })
    : {
        status: 'not_run' as const,
        allowedToRender: false,
        rejectionReasons: [] as PublicCurateStarterFitRejectionReason[],
        routeStops: [],
        normalizedRoles: {},
      }
  const starterFitByArtifactId = Object.fromEntries(
    (input.artifactCandidates ?? []).map((artifact) => [
      artifact.id,
      validatePublicCurateStarterFit({
        selectedStarterPack: input.selectedStarterPack,
        artifact,
        approvedRefinementEntryPayload:
          input.qualificationByArtifactId?.[artifact.id]?.approvedRefinementEntryPayload ??
          input.approvedRefinementEntryPayload,
      }),
    ]),
  )
  const qualificationByArtifactId = input.qualificationByArtifactId ?? {}
  const approvedPayloadTruthByArtifactId = Object.fromEntries(
    (input.artifactCandidates ?? []).map((artifact) => {
      const approvedPayload =
        qualificationByArtifactId[artifact.id]?.approvedRefinementEntryPayload ??
        input.approvedRefinementEntryPayload ??
        null
      return [
        artifact.id,
        validatePublicCurateApprovedPayloadTruth({
          selectedStarterPack: input.selectedStarterPack,
          artifact,
          approvedRefinementEntryPayload: approvedPayload,
        }),
      ] as const
    }),
  )
  const visibleCards = (input.artifactCandidates ?? [])
    .map((artifact) => {
      const starterFit = starterFitByArtifactId[artifact.id]
      const qualification = qualificationByArtifactId[artifact.id]
      const approvedPayloadTruth = approvedPayloadTruthByArtifactId[artifact.id]
      const approvedPayloadAllowed =
        qualification?.hasApprovedPayload === true &&
        approvedPayloadTruth?.allowedToRender === true
      return {
        artifactId: artifact.id,
        routeTitle: artifact.routeTitle,
        routeStops: approvedPayloadTruth?.routeStops?.length
          ? approvedPayloadTruth.routeStops
          : starterFit?.routeStops ?? routeStopsFromArtifact(artifact),
        allowedToRender: starterFit?.allowedToRender === true && approvedPayloadAllowed,
        rejectionReasons: [
          ...(starterFit?.rejectionReasons ?? []),
          ...(approvedPayloadTruth?.rejectionReasons ?? []),
        ],
      }
    })
    .filter((card) => card.allowedToRender)
  const selectedCard = visibleCards.find((card) => card.artifactId === selectedArtifact?.id) ?? visibleCards[0] ?? null
  const selectedApprovedPayloadTruth = selectedArtifact
    ? approvedPayloadTruthByArtifactId[selectedArtifact.id]
    : null
  const selectedApprovedPayloadTruthAllowed =
    selectedApprovedPayloadTruth?.allowedToRender === true &&
    qualificationByArtifactId[selectedArtifact?.id ?? '']?.hasApprovedPayload === true
  const projection: PublicCurateRouteProjectionDiagnostic | null =
    selectedStarterFit.allowedToRender && selectedApprovedPayloadTruthAllowed
    ? {
        artifactId: selectedArtifact?.id ?? input.selectedArtifactId ?? null,
        allowedToRender: true,
        source: 'service_diagnostic_only',
        routeStops: selectedApprovedPayloadTruth?.routeStops?.length
          ? selectedApprovedPayloadTruth.routeStops
          : routeStops,
      }
    : null
  const approvedPayload =
    selectedArtifact &&
    selectedStarterFit.allowedToRender &&
    selectedApprovedPayloadTruthAllowed
    ? qualificationByArtifactId[selectedArtifact.id]?.approvedRefinementEntryPayload ?? null
    : null
  const cardTruthStatus: PublicCurateCardTruthStatus =
    routeStops.length === 0
      ? 'no_candidate'
      : selectedStarterFit.allowedToRender && selectedApprovedPayloadTruth?.allowedToRender === true
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
      rejectionReasons: [
        ...selectedStarterFit.rejectionReasons,
        ...(selectedApprovedPayloadTruth?.rejectionReasons ?? []),
      ],
      routeStops: selectedApprovedPayloadTruth?.routeStops?.length
        ? selectedApprovedPayloadTruth.routeStops
        : routeStops,
      allowedToRender:
        selectedStarterFit.allowedToRender &&
        selectedApprovedPayloadTruth?.allowedToRender === true,
      pageCurrentlyWouldRenderSomethingElse: Boolean(
        input.currentPageRender?.wouldRenderCard && !selectedStarterFit.allowedToRender,
      ),
      committedRouteFallbackRenderEnabled: input.committedRouteFallbackRenderEnabled,
      committedRouteFallbackRenderEligible: Boolean(
        input.committedRouteFallbackRenderEnabled && selectedStarterFit.allowedToRender,
      ),
    },
    actionsAllowed: {
      review: Boolean(projection),
      revealJourneyMap: Boolean(projection),
      lockLive: Boolean(projection),
      plansHubSave: Boolean(projection),
    },
  }
}

export function buildPublicCurateCandidateConstructionDiagnostics(params: {
  selectedStarterPack: StarterPack | null
  cacheKeyScope?: string | null
  candidates: PublicCurateServiceCandidateInput[]
  sourceMode: string | null
  fetchCallCount: number
  committedRouteFallbackRenderEnabled: boolean
}): PublicCurateCandidateConstructionDiagnostics {
  const starterPackId = params.selectedStarterPack?.id ?? null
  const cacheKeyScope = params.cacheKeyScope ?? starterPackId
  const candidates = params.candidates.map((candidate, index) => {
    const candidateArtifactId =
      candidate.artifactId?.trim() ||
      buildDiagnosticCandidateArtifactId({
        starterPackId,
        index,
        routeStops: candidate.routeStops,
      })
    const starterFit = validatePublicCurateStarterFit({
      selectedStarterPack: params.selectedStarterPack,
      routeStops: candidate.routeStops,
      approvedRefinementEntryPayload: candidate.approvedRefinementEntryPayload,
    })
    return {
      starterPackId,
      candidateArtifactId,
      cacheKeyScope,
      sourceMode: candidate.sourceMode ?? params.sourceMode,
      routeStops: starterFit.routeStops,
      roleCoverage: buildRoleCoverage(starterFit),
      starterFitStatus: starterFit.status,
      rejectionReasons: starterFit.rejectionReasons,
      allowedToRender: starterFit.allowedToRender,
      serviceTruthSourceCount: PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT,
      publicRenderMigrated: PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED,
      pageRenderMigrated: false as const,
    }
  })
  const selectedCandidate = candidates.find((candidate) => candidate.allowedToRender) ?? candidates[0] ?? null
  const roleCoverage =
    selectedCandidate?.roleCoverage ?? { start: false, highlight: false, windDown: false }
  const rejectionReasons = selectedCandidate?.rejectionReasons ?? []

  return {
    starterPackId,
    serviceTruthSourceCount: PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT,
    publicRenderMigrated: PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED,
    pageRenderMigrated: false,
    candidateCount: candidates.length,
    candidateArtifactIds: candidates.map((candidate) => candidate.candidateArtifactId),
    selectedCandidateArtifactId: selectedCandidate?.candidateArtifactId ?? null,
    routeStops: selectedCandidate?.routeStops ?? [],
    roleCoverage,
    starterFitStatus: selectedCandidate?.starterFitStatus ?? 'not_run',
    rejectionReasons,
    cacheKeyScope,
    sourceMode: selectedCandidate?.sourceMode ?? params.sourceMode,
    fetchCallCount: params.fetchCallCount,
    allowedToRender: selectedCandidate?.allowedToRender ?? false,
    committedRouteFallbackRenderEnabled: params.committedRouteFallbackRenderEnabled,
    committedRouteFallbackRenderEligible: Boolean(
      params.committedRouteFallbackRenderEnabled && selectedCandidate?.allowedToRender,
    ),
    candidates,
  }
}

export function classifyArcadeAndDrinksCandidateState(params: {
  generatedRouteStops: PublicCurateRouteStopInput[]
  corpusCandidates: PublicCurateArcadeCorpusCandidateSummary[]
}): PublicCurateArcadeAndDrinksDiagnostic {
  const generatedStarterFit = validatePublicCurateStarterFit({
    selectedStarterPack: {
      id: 'arcade-and-drinks',
      title: 'Arcade + Drinks',
      description: 'High-social momentum with playful stop variety.',
      personaBias: 'friends',
      primaryAnchor: 'playful',
      secondaryAnchors: ['lively'],
      distanceMode: 'nearby',
      lensPreset: {
        lensTone: 'electric',
        energyBand: ['medium', 'high'],
        discoveryBias: 'medium',
        movementTolerance: 'high',
        preferredCategories: ['activity', 'bar', 'dessert'],
        preferredTags: ['interactive', 'social', 'playful'],
        preferredStopShapes: {
          highlight: {
            preferredCategories: ['activity', 'bar'],
            energyPreference: ['high'],
          },
        },
        windDown: {
          closeToBase: false,
          maxEnergy: 'medium',
        },
      },
    },
    routeStops: params.generatedRouteStops,
  })
  const startRoleCandidateCount = params.corpusCandidates.filter((candidate) =>
    candidate.supportRoles.some((role) => normalizeText(role) === 'start' || normalizeText(role) === 'warmup'),
  ).length
  const highlightOrSupportCandidateCount = params.corpusCandidates.filter((candidate) =>
    candidate.supportRoles.some((role) => {
      const normalized = normalizeText(role)
      return normalized === 'highlight' || normalized === 'support'
    }),
  ).length
  const generatedRouteMissingStart =
    generatedStarterFit.rejectionReasons.includes('missing_required_role') &&
    !generatedStarterFit.normalizedRoles.start
  const classification: PublicCurateArcadeAndDrinksClassification =
    startRoleCandidateCount === 0 && generatedRouteMissingStart
      ? 'mixed'
      : generatedRouteMissingStart
        ? 'route-shape/planner gap'
        : params.corpusCandidates.length === 0
          ? 'corpus/data gap'
          : 'card truth gap'

  return {
    classification,
    evidence: [
      `arcade-supported-candidate-count:${params.corpusCandidates.length}`,
      `arcade-start-role-candidate-count:${startRoleCandidateCount}`,
      `arcade-highlight-or-support-candidate-count:${highlightOrSupportCandidateCount}`,
      `generated-route-missing-start:${String(generatedRouteMissingStart)}`,
    ],
    supportedCandidateCount: params.corpusCandidates.length,
    startRoleCandidateCount,
    highlightOrSupportCandidateCount,
    generatedRouteMissingStart,
  }
}
