import type { RealityDirectionCard } from '../../types/realityDirectionCard'
import type { LiveRetrievalPocketHint } from '../../../domain/retrieval/liveEnvelope'
import type { StepBPreSupplyHoldReason } from './stepBProofGate'

export const ROW_1_COFFEE_BOOKS_PROOF_TARGET_ID = 'row1_step_b_coffee_books_representative'
export const ROW_1_COFFEE_BOOKS_PROOF_TARGET_POCKET_LABEL = 'Willow Glen'
export const ROW_1_COFFEE_BOOKS_REQUIRED_SEMANTIC_PROOF =
  'selected-stop-backed book, reading, literary, library, or bookstore evidence'
export const ROW_1_STEP_B_PRE_SUPPLY_ENVELOPE = {
  maxProviderCalls: 3,
  maxQueryLabels: 3,
  maxCenters: 1,
}

export type Row1CoffeeBooksProofPolicy =
  | 'curate_hard_pocket'
  | 'surprise_hard_pocket'
  | 'build_required_anchor_soft_geography'

export type Row1CoffeeBooksGeographyPolicy = 'hard_block' | 'soft_penalty'

export type CurateProofTargetDistrictCarrier = {
  id: string
  name: string
  centroid?: { lat: number; lng: number }
  radiusM?: number
}

export type CurateHardPocketProofTargetInstance = {
  proofTargetId: string
  requiredSemanticProof: string
  selectedDirectionId: string
  selectedPocketId: string
  selectedPocketLabel: string
  livePocketHint: LiveRetrievalPocketHint
  crossPocketAllowed: boolean
}

export type CurateHardPocketProofTargetResolutionReason =
  | 'not_configured'
  | 'proof_target_resolution_pending'
  | 'pre_supply_selected_pocket_unavailable_for_target'
  | 'pre_supply_live_pocket_hint_unavailable_for_target'
  | 'pre_supply_selected_direction_unavailable_for_target_pocket'

export type CurateHardPocketProofTargetResolutionDiagnostics = {
  diagnosticOnly: true
  configured: boolean
  status: 'not_configured' | 'pending' | 'resolved'
  reason: CurateHardPocketProofTargetResolutionReason | null
  preSupplyHoldReason: StepBPreSupplyHoldReason | null
  requestedProofTargetId: string
  requestedProofTargetPocketLabel: string
  selectedDirectionIdAvailable: boolean
  selectedPocketIdAvailable: boolean
  livePocketHintAvailable: boolean
  selectedProofStopEvidenceAvailable: boolean
  selectedProofStopPocketAvailable: boolean
  activeProofPocketMismatch: boolean
  proofPolicy: Row1CoffeeBooksProofPolicy
  proofMode: 'curate_or_surprise' | 'build_required_anchor'
  requiredAnchorPresent: boolean
  geographyPolicy: Row1CoffeeBooksGeographyPolicy
  selectedDirectionPocketId: string | null
  selectedDirectionPocketLabel: string | null
  anchorProofPocketId: string | null
  anchorProofPocketLabel: string | null
  pocketMismatchReason: string | null
  pocketMismatchAllowed: boolean
  pocketMismatchAllowedReason: string | null
  resolverRanBeforeRequiredCarriers: boolean
  targetPocketId: string | null
  targetPocketLabel: string | null
  matchedDirectionId: string | null
  matchedDirectionPocketId: string | null
  matchedDirectionPocketLabel: string | null
  matchingDirectionCarrierExists: boolean
  matchingPocketCarrierExists: boolean
  matchingLivePocketHintCarrierExists: boolean
  availableDirectionCardCount: number
  availableDirectionCardIds: string[]
  availableDirectionPocketCarriers: string[]
  availableDistrictPocketCarriers: string[]
  selectedDirectionResolutionReason: string | null
  selectedPocketResolutionReason: string | null
  livePocketHintResolutionReason: string | null
}

export type CurateHardPocketProofTargetResolution = {
  target: CurateHardPocketProofTargetInstance | null
  diagnostics: CurateHardPocketProofTargetResolutionDiagnostics
}

function normalizeProofTargetLookupKey(value: string | undefined): string {
  if (!value) {
    return ''
  }
  return value
    .toLowerCase()
    .replace(/\b(district|pocket|area|core)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildProofTargetLookupKeys(value: string | undefined): string[] {
  const normalized = normalizeProofTargetLookupKey(value)
  if (!normalized) {
    return []
  }
  return Array.from(new Set([normalized, normalized.replace(/\s+/g, '')]))
}

function proofTargetKeysOverlap(left: string[], right: string[]): boolean {
  return left.some((leftKey) =>
    right.some(
      (rightKey) =>
        leftKey === rightKey ||
        (leftKey.length >= 3 && rightKey.includes(leftKey)) ||
        (rightKey.length >= 3 && leftKey.includes(rightKey)),
    ),
  )
}

function buildDistrictCarrierKeys(carrier: CurateProofTargetDistrictCarrier): string[] {
  return Array.from(
    new Set([
      ...buildProofTargetLookupKeys(carrier.id),
      ...buildProofTargetLookupKeys(carrier.name),
      ...buildProofTargetLookupKeys(`${carrier.id} ${carrier.name}`),
    ]),
  )
}

function getDirectionResolverPocketKey(card: RealityDirectionCard): string {
  return card.debugMeta?.pocketId ?? card.id
}

function buildDirectionCarrierKeys(card: RealityDirectionCard): string[] {
  return Array.from(
    new Set([
      ...buildProofTargetLookupKeys(card.id),
      ...buildProofTargetLookupKeys(getDirectionResolverPocketKey(card)),
      ...buildProofTargetLookupKeys(card.debugMeta?.pocketLabel),
      ...buildProofTargetLookupKeys(card.debugMeta?.directionDistrictSupportSummary),
      ...buildProofTargetLookupKeys(card.card.title),
      ...buildProofTargetLookupKeys(card.card.subtitle),
    ]),
  )
}

export function directionCardMatchesProofTargetDistrict(params: {
  card: RealityDirectionCard
  targetDistrict: CurateProofTargetDistrictCarrier
}): boolean {
  return proofTargetKeysOverlap(
    buildDirectionCarrierKeys(params.card),
    buildDistrictCarrierKeys(params.targetDistrict),
  )
}

function districtCarrierMatchesProofTargetPocket(
  carrier: CurateProofTargetDistrictCarrier,
): boolean {
  return proofTargetKeysOverlap(
    buildDistrictCarrierKeys(carrier),
    buildProofTargetLookupKeys(ROW_1_COFFEE_BOOKS_PROOF_TARGET_POCKET_LABEL),
  )
}

function rankDirectionResolverCards(cards: RealityDirectionCard[]): RealityDirectionCard[] {
  return cards.slice().sort((left, right) => {
    const leftScore = left.debugMeta?.confidence ?? 0
    const rightScore = right.debugMeta?.confidence ?? 0
    if (rightScore !== leftScore) {
      return rightScore - leftScore
    }
    return left.id.localeCompare(right.id)
  })
}

function summarizeDirectionPocketCarrier(card: RealityDirectionCard): string {
  return [
    `directionId=${card.id}`,
    `pocketId=${getDirectionResolverPocketKey(card)}`,
    `pocketLabel=${card.debugMeta?.pocketLabel ?? 'n/a'}`,
  ].join('|')
}

function summarizeDistrictPocketCarrier(carrier: CurateProofTargetDistrictCarrier): string {
  return [
    `pocketId=${carrier.id}`,
    `pocketLabel=${carrier.name}`,
    `centroid=${carrier.centroid ? 'present' : 'missing'}`,
    `radiusM=${typeof carrier.radiusM === 'number' ? carrier.radiusM : 'missing'}`,
  ].join('|')
}

export function resolveCurateHardPocketProofTarget(params: {
  starterPackId?: string | null
  city: string
  districts: CurateProofTargetDistrictCarrier[]
  allDirectionCards: RealityDirectionCard[]
  proofPolicy?: Row1CoffeeBooksProofPolicy
  requiredAnchorPresent?: boolean
}): CurateHardPocketProofTargetResolution {
  const proofPolicy = params.proofPolicy ?? 'curate_hard_pocket'
  const buildSoftGeographyEligible =
    proofPolicy === 'build_required_anchor_soft_geography' &&
    params.requiredAnchorPresent === true
  const geographyPolicy: Row1CoffeeBooksGeographyPolicy = buildSoftGeographyEligible
    ? 'soft_penalty'
    : 'hard_block'
  const availableDirectionCardIds = params.allDirectionCards.map((card) => card.id)
  const availableDirectionPocketCarriers = params.allDirectionCards.map(summarizeDirectionPocketCarrier)
  const availableDistrictPocketCarriers = params.districts.map(summarizeDistrictPocketCarrier)
  const buildDiagnostics = (
    overrides: Partial<CurateHardPocketProofTargetResolutionDiagnostics>,
  ): CurateHardPocketProofTargetResolutionDiagnostics => {
    const reason =
      overrides.reason ??
      (params.starterPackId === 'coffee-books'
        ? 'proof_target_resolution_pending'
        : 'not_configured')
    return {
      diagnosticOnly: true,
      configured: params.starterPackId === 'coffee-books',
      status: params.starterPackId === 'coffee-books' ? 'pending' : 'not_configured',
      reason,
      preSupplyHoldReason: null,
      requestedProofTargetId: ROW_1_COFFEE_BOOKS_PROOF_TARGET_ID,
      requestedProofTargetPocketLabel: ROW_1_COFFEE_BOOKS_PROOF_TARGET_POCKET_LABEL,
      selectedDirectionIdAvailable: false,
      selectedPocketIdAvailable: false,
      livePocketHintAvailable: false,
      selectedProofStopEvidenceAvailable: false,
      selectedProofStopPocketAvailable: false,
      activeProofPocketMismatch: false,
      proofPolicy,
      proofMode: buildSoftGeographyEligible ? 'build_required_anchor' : 'curate_or_surprise',
      requiredAnchorPresent: params.requiredAnchorPresent === true,
      geographyPolicy,
      selectedDirectionPocketId: null,
      selectedDirectionPocketLabel: null,
      anchorProofPocketId: null,
      anchorProofPocketLabel: null,
      pocketMismatchReason: null,
      pocketMismatchAllowed: false,
      pocketMismatchAllowedReason: null,
      resolverRanBeforeRequiredCarriers: params.districts.length === 0 || params.allDirectionCards.length === 0,
      targetPocketId: null,
      targetPocketLabel: null,
      matchedDirectionId: null,
      matchedDirectionPocketId: null,
      matchedDirectionPocketLabel: null,
      matchingDirectionCarrierExists: false,
      matchingPocketCarrierExists: false,
      matchingLivePocketHintCarrierExists: false,
      availableDirectionCardCount: params.allDirectionCards.length,
      availableDirectionCardIds,
      availableDirectionPocketCarriers,
      availableDistrictPocketCarriers,
      selectedDirectionResolutionReason: 'not_resolved',
      selectedPocketResolutionReason: 'not_resolved',
      livePocketHintResolutionReason: 'not_resolved',
      ...overrides,
    }
  }
  if (params.starterPackId !== 'coffee-books') {
    return {
      target: null,
      diagnostics: buildDiagnostics({
        status: 'not_configured',
        reason: 'not_configured',
        preSupplyHoldReason: null,
        resolverRanBeforeRequiredCarriers: false,
        selectedDirectionResolutionReason: 'not_configured',
        selectedPocketResolutionReason: 'not_configured',
        livePocketHintResolutionReason: 'not_configured',
      }),
    }
  }
  const targetDistrict =
    params.districts.find((district) => districtCarrierMatchesProofTargetPocket(district)) ?? null
  if (!targetDistrict) {
    return {
      target: null,
      diagnostics: buildDiagnostics({
        reason: 'pre_supply_selected_pocket_unavailable_for_target',
        preSupplyHoldReason: 'pre_supply_selected_pocket_unavailable_for_target',
        resolverRanBeforeRequiredCarriers: params.districts.length === 0,
        selectedPocketResolutionReason: 'target_pocket_carrier_missing',
        livePocketHintResolutionReason: 'target_pocket_carrier_missing',
        selectedDirectionResolutionReason: 'target_pocket_carrier_missing',
      }),
    }
  }
  const matchingDirectionCards = rankDirectionResolverCards(
    params.allDirectionCards.filter((card) =>
      directionCardMatchesProofTargetDistrict({ card, targetDistrict }),
    ),
  )
  const matchingTargetDirection = matchingDirectionCards[0] ?? null
  const softGeographyFallbackDirection =
    buildSoftGeographyEligible && !matchingTargetDirection
      ? rankDirectionResolverCards(params.allDirectionCards)[0] ?? null
      : null
  const targetDirection = matchingTargetDirection ?? softGeographyFallbackDirection
  const targetDirectionPocketId = targetDirection ? getDirectionResolverPocketKey(targetDirection) : null
  const targetDirectionPocketLabel = targetDirection?.debugMeta?.pocketLabel ?? null
  const directionPocketDiffersFromTarget =
    Boolean(
      softGeographyFallbackDirection &&
        targetDirectionPocketId &&
        targetDirectionPocketId !== targetDistrict.id,
    ) &&
    !proofTargetKeysOverlap(
      buildProofTargetLookupKeys(targetDirectionPocketLabel ?? targetDirectionPocketId ?? undefined),
      buildDistrictCarrierKeys(targetDistrict),
    )
  const pocketMismatchReason = directionPocketDiffersFromTarget
    ? 'selected_direction_pocket_differs_from_required_anchor_pocket'
    : null
  const targetPocketCarrierAvailable = Boolean(targetDistrict.id)
  const targetLiveHintAvailable =
    Boolean(targetDistrict.centroid) && typeof targetDistrict.radiusM === 'number'
  if (!targetLiveHintAvailable) {
    return {
      target: null,
      diagnostics: buildDiagnostics({
        reason: 'pre_supply_live_pocket_hint_unavailable_for_target',
        preSupplyHoldReason: 'pre_supply_live_pocket_hint_unavailable_for_target',
        selectedPocketIdAvailable: targetPocketCarrierAvailable,
        livePocketHintAvailable: false,
        targetPocketId: targetDistrict.id,
        targetPocketLabel: targetDistrict.name,
        matchingDirectionCarrierExists: Boolean(matchingTargetDirection),
        matchingPocketCarrierExists: targetPocketCarrierAvailable,
        matchingLivePocketHintCarrierExists: false,
        matchedDirectionId: targetDirection?.id ?? null,
        matchedDirectionPocketId: targetDirectionPocketId,
        matchedDirectionPocketLabel: targetDirectionPocketLabel,
        selectedDirectionPocketId: targetDirectionPocketId,
        selectedDirectionPocketLabel: targetDirectionPocketLabel,
        anchorProofPocketId: targetDistrict.id,
        anchorProofPocketLabel: targetDistrict.name,
        pocketMismatchReason,
        pocketMismatchAllowed: Boolean(pocketMismatchReason && buildSoftGeographyEligible),
        pocketMismatchAllowedReason:
          pocketMismatchReason && buildSoftGeographyEligible
            ? 'build_required_anchor_geography_soft_penalty'
            : null,
        resolverRanBeforeRequiredCarriers: params.districts.length === 0,
        selectedPocketResolutionReason: targetPocketCarrierAvailable
          ? 'target_pocket_carrier_resolved'
          : 'target_pocket_carrier_missing',
        livePocketHintResolutionReason: 'target_pocket_hint_missing_centroid_or_radius',
        selectedDirectionResolutionReason: targetDirection
          ? 'target_direction_carrier_resolved'
          : 'target_direction_carrier_missing',
      }),
    }
  }
  const targetCentroid = targetDistrict.centroid
  const targetRadiusM = targetDistrict.radiusM
  if (!targetCentroid || typeof targetRadiusM !== 'number') {
    return {
      target: null,
      diagnostics: buildDiagnostics({
        reason: 'pre_supply_live_pocket_hint_unavailable_for_target',
        preSupplyHoldReason: 'pre_supply_live_pocket_hint_unavailable_for_target',
        selectedPocketIdAvailable: targetPocketCarrierAvailable,
        targetPocketId: targetDistrict.id,
        targetPocketLabel: targetDistrict.name,
        matchingDirectionCarrierExists: Boolean(matchingTargetDirection),
        matchingPocketCarrierExists: targetPocketCarrierAvailable,
        matchingLivePocketHintCarrierExists: false,
        matchedDirectionId: targetDirection?.id ?? null,
        matchedDirectionPocketId: targetDirectionPocketId,
        matchedDirectionPocketLabel: targetDirectionPocketLabel,
        selectedDirectionPocketId: targetDirectionPocketId,
        selectedDirectionPocketLabel: targetDirectionPocketLabel,
        anchorProofPocketId: targetDistrict.id,
        anchorProofPocketLabel: targetDistrict.name,
        pocketMismatchReason,
        pocketMismatchAllowed: Boolean(pocketMismatchReason && buildSoftGeographyEligible),
        pocketMismatchAllowedReason:
          pocketMismatchReason && buildSoftGeographyEligible
            ? 'build_required_anchor_geography_soft_penalty'
            : null,
        selectedPocketResolutionReason: targetPocketCarrierAvailable
          ? 'target_pocket_carrier_resolved'
          : 'target_pocket_carrier_missing',
        livePocketHintResolutionReason: 'target_pocket_hint_missing_centroid_or_radius',
        selectedDirectionResolutionReason: targetDirection
          ? 'target_direction_carrier_resolved'
          : 'target_direction_carrier_missing',
      }),
    }
  }
  if (!targetDirection) {
    return {
      target: null,
      diagnostics: buildDiagnostics({
        reason: 'pre_supply_selected_direction_unavailable_for_target_pocket',
        preSupplyHoldReason: 'pre_supply_selected_direction_unavailable_for_target_pocket',
        selectedPocketIdAvailable: true,
        livePocketHintAvailable: true,
        targetPocketId: targetDistrict.id,
        targetPocketLabel: targetDistrict.name,
        matchingDirectionCarrierExists: false,
        matchingPocketCarrierExists: true,
        matchingLivePocketHintCarrierExists: true,
        anchorProofPocketId: targetDistrict.id,
        anchorProofPocketLabel: targetDistrict.name,
        resolverRanBeforeRequiredCarriers: params.allDirectionCards.length === 0,
        selectedPocketResolutionReason: 'target_pocket_carrier_resolved',
        livePocketHintResolutionReason: 'target_pocket_hint_resolved',
        selectedDirectionResolutionReason: 'target_direction_carrier_missing',
      }),
    }
  }
  const target: CurateHardPocketProofTargetInstance = {
    proofTargetId: ROW_1_COFFEE_BOOKS_PROOF_TARGET_ID,
    requiredSemanticProof: ROW_1_COFFEE_BOOKS_REQUIRED_SEMANTIC_PROOF,
    selectedDirectionId: targetDirection.id,
    selectedPocketId: targetDistrict.id,
    selectedPocketLabel: targetDistrict.name,
    livePocketHint: {
      pocketId: targetDistrict.id,
      pocketLabel: targetDistrict.name,
      centroid: targetCentroid,
      radiusM: targetRadiusM,
      source: 'district_intelligence',
      city: params.city,
      locationLabel: `${targetDistrict.name}, ${params.city}`,
    },
    crossPocketAllowed: buildSoftGeographyEligible && Boolean(pocketMismatchReason),
  }
  return {
    target,
    diagnostics: buildDiagnostics({
      status: 'resolved',
      reason: null,
      preSupplyHoldReason: null,
      selectedDirectionIdAvailable: true,
      selectedPocketIdAvailable: true,
      livePocketHintAvailable: true,
      selectedProofStopEvidenceAvailable: false,
      selectedProofStopPocketAvailable: false,
      resolverRanBeforeRequiredCarriers: false,
      targetPocketId: targetDistrict.id,
      targetPocketLabel: targetDistrict.name,
      matchedDirectionId: targetDirection.id,
      matchedDirectionPocketId: targetDirectionPocketId,
      matchedDirectionPocketLabel: targetDirectionPocketLabel,
      matchingDirectionCarrierExists: Boolean(matchingTargetDirection),
      matchingPocketCarrierExists: true,
      matchingLivePocketHintCarrierExists: true,
      selectedDirectionPocketId: targetDirectionPocketId,
      selectedDirectionPocketLabel: targetDirectionPocketLabel,
      anchorProofPocketId: targetDistrict.id,
      anchorProofPocketLabel: targetDistrict.name,
      pocketMismatchReason,
      pocketMismatchAllowed: Boolean(pocketMismatchReason && buildSoftGeographyEligible),
      pocketMismatchAllowedReason:
        pocketMismatchReason && buildSoftGeographyEligible
          ? 'build_required_anchor_geography_soft_penalty'
          : null,
      selectedDirectionResolutionReason: matchingTargetDirection
        ? 'target_direction_carrier_resolved'
        : 'build_soft_geography_direction_pocket_mismatch_allowed',
      selectedPocketResolutionReason: 'target_pocket_carrier_resolved',
      livePocketHintResolutionReason: 'target_pocket_hint_resolved',
    }),
  }
}

export function resolveCurateHardPocketProofTargetInstance(params: {
  starterPackId?: string | null
  city: string
  districts: CurateProofTargetDistrictCarrier[]
  allDirectionCards: RealityDirectionCard[]
}): CurateHardPocketProofTargetInstance | null {
  return resolveCurateHardPocketProofTarget(params).target
}
