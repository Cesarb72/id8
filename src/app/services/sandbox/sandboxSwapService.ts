import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../../../domain/artifacts/runtimeRouteArtifact'
import {
  assertLceRuntimeMutationMayCommit,
  buildLceRuntimeContract,
  type LceRuntimeContractDiagnostics,
  type LceRuntimeFieldReality,
} from '../../../domain/lce/lceRuntimeContract'
import { getCrewPolicy } from '../../../domain/intent/getCrewPolicy'
import {
  approveFinalRouteCandidate,
  type FinalRouteApprovalDiagnostics,
  type FinalRouteApprovalResult,
} from '../../../domain/routeApproval/approveFinalRouteCandidate'
import type { ExperienceLens } from '../../../domain/types/experienceLens'
import type { IntentProfile, RouteShapeContract } from '../../../domain/types/intent'
import type { ConciergeIntent } from '../../../domain/types/intent'
import type { ArcCandidate } from '../../../domain/types/arc'
import type { Itinerary, ItineraryStop, UserStopRole } from '../../../domain/types/itinerary'

export interface SwapReplacementCanonicalLike {
  displayName: string
  providerRecordId: string
  latitude: number
  longitude: number
  addressLine: string
  city: string
  neighborhood: string
}

export interface PreviewSwapStateLike<
  TCanonical extends SwapReplacementCanonicalLike = SwapReplacementCanonicalLike,
> {
  role: UserStopRole
  targetRouteId: string
  targetStopId: string
  targetStopIndex: number
  targetRole: UserStopRole
  swapBeforeStopId: string
  requestedReplacementId: string
  originalStop: ItineraryStop
  candidateStop: ItineraryStop
  replacementCanonical: TCanonical
  swappedArc: ArcCandidate
  swappedItinerary: Itinerary
}

export interface SwapCompatibilityResultLike {
  swapCompatibilityPassed: boolean
  swapCompatibilityReason: string
  swapCompatibilityRejectClass: 'none' | 'hard_structural' | 'soft_direction_drift'
  preservedRole: boolean
  preservedDistrict: boolean
  preservedFamily: boolean
  preservedFeasibility: boolean
  softDirectionDriftDetected: boolean
}

export interface SwapDebugBreadcrumbLike {
  swapTargetSlotIndex: number
  swapTargetRole: UserStopRole
  swapBeforeStopId: string
  swapRequestedReplacementId: string
  swapAppliedReplacementId: string | null
  postSwapCanonicalStopIdBySlot?: string[]
  postSwapRenderedStopIdBySlot?: string[]
  swapCommitSucceeded: boolean
  swapRenderSource: 'renderOnlyFinalRoute'
  routeVersion: number
  mismatch: boolean
  lceDiagnostics?: LceRuntimeContractDiagnostics
  finalRouteApproval?: FinalRouteApprovalDiagnostics
}

export interface SwapCommitPlanSnapshotLike {
  itinerary: Itinerary
  selectedArc: ArcCandidate
  selectedDirectionContract: {
    id: string
  }
  selectedDirectionPreviewContext?: unknown
  routeShapeContract: RouteShapeContract
  intentProfile?: IntentProfile
  lens?: ExperienceLens
  conciergeIntent?: ConciergeIntent
  runtimeFieldReality?: LceRuntimeFieldReality
}

export class SwapCommitCoreError extends Error {
  readonly compatibility?: SwapCompatibilityResultLike
  readonly finalRouteApproval?: FinalRouteApprovalResult

  constructor(
    message: string,
    compatibility?: SwapCompatibilityResultLike,
    finalRouteApproval?: FinalRouteApprovalResult,
  ) {
    super(message)
    this.name = 'SwapCommitCoreError'
    Object.setPrototypeOf(this, SwapCommitCoreError.prototype)
    this.compatibility = compatibility
    this.finalRouteApproval = finalRouteApproval
  }
}

export interface ApplyPreviewSwapCommitDependencies<
  TPlanSnapshot extends SwapCommitPlanSnapshotLike,
  TCanonical extends SwapReplacementCanonicalLike,
  TCompatibility extends SwapCompatibilityResultLike,
> {
  applyCanonicalIdentityToItinerary(
    itinerary: Itinerary,
    canonicalStopByRole: Partial<Record<UserStopRole, TCanonical>>,
  ): Itinerary
  evaluateSwapCompatibility(params: {
    role: UserStopRole
    swapSnapshot: PreviewSwapStateLike<TCanonical>
    canonicalItinerary: Itinerary
    planSnapshot: TPlanSnapshot
    finalRouteSnapshot: RuntimeRouteArtifact
    routeShapeContract: RouteShapeContract
  }): TCompatibility
  approveFormalSwapFinalRoute?(params: {
    role: UserStopRole
    swapSnapshot: PreviewSwapStateLike<TCanonical>
    planSnapshot: TPlanSnapshot
    proposedCandidate: ArcCandidate
    routeShapeContract: RouteShapeContract
  }): FinalRouteApprovalResult
  patchFinalRouteStop(params: {
    route: RuntimeRouteArtifact
    targetRole: UserStopRole
    targetStopId?: string
    targetStopIndex?: number
    replacementStop: RuntimeRouteStop
    notice?: string
    activeRole?: UserStopRole
  }): {
    route: RuntimeRouteArtifact
    resolvedStop: RuntimeRouteStop
    resolution: 'id' | 'index' | 'role'
  } | null
  getSharedItineraryStopFallbackImageUrl(stops: ItineraryStop[]): string
  hydrateRuntimeRouteStopDisplayFields(params: {
    stop: ItineraryStop
    existingRouteStop?: Partial<RuntimeRouteStop>
    fallbackImageUrl: string
  }): Pick<RuntimeRouteStop, 'title' | 'subtitle' | 'driveMinutes' | 'imageUrl'>
  getNonEmptyRuntimeRouteString(value: string | null | undefined): string | null
  getPreviewSwapFeedback(role: UserStopRole | null): string | null
}

export interface ApplyPreviewSwapCommitParams<
  TPlanSnapshot extends SwapCommitPlanSnapshotLike,
  TCanonical extends SwapReplacementCanonicalLike,
> {
  role: UserStopRole
  swapSnapshot: PreviewSwapStateLike<TCanonical>
  planSnapshot: TPlanSnapshot
  finalRouteSnapshot: RuntimeRouteArtifact
  routeVersionAtClick: number
  canonicalStopByRole: Partial<Record<UserStopRole, TCanonical>>
}

export interface ApplyPreviewSwapCommitResult<
  TCanonical extends SwapReplacementCanonicalLike,
  TCompatibility extends SwapCompatibilityResultLike,
> {
  compatibility: TCompatibility
  nextCanonicalStopByRole: Partial<Record<UserStopRole, TCanonical>>
  canonicalItineraryAfterSwap: Itinerary
  nextItinerary: Itinerary
  nextSelectedArc: ArcCandidate
  nextFinalRoute: RuntimeRouteArtifact
  swapDebugBreadcrumb: SwapDebugBreadcrumbLike
  previewFeedback: string | null
}

function isLegacySupportReplacementRole(role: UserStopRole): role is Extract<UserStopRole, 'start' | 'windDown'> {
  return role === 'start' || role === 'windDown'
}

function approveLegacySupportReplacementFinalRoute<
  TPlanSnapshot extends SwapCommitPlanSnapshotLike,
>(params: {
  role: UserStopRole
  planSnapshot: TPlanSnapshot
  proposedCandidate: ArcCandidate
}): FinalRouteApprovalResult | undefined {
  if (!isLegacySupportReplacementRole(params.role)) {
    return undefined
  }
  const { intentProfile, lens, routeShapeContract } = params.planSnapshot
  if (!intentProfile || !lens) {
    return undefined
  }
  return approveFinalRouteCandidate({
    source: 'app.services.sandbox.applyPreviewSwapCommit.legacySupportReplacementFinalRouteApproval',
    targetRole: params.role,
    proposedCandidate: params.proposedCandidate,
    intent: intentProfile,
    crewPolicy: getCrewPolicy(intentProfile.crew),
    lens,
    routeShapeContract,
  })
}

export function applyPreviewSwapCommit<
  TPlanSnapshot extends SwapCommitPlanSnapshotLike,
  TCanonical extends SwapReplacementCanonicalLike,
  TCompatibility extends SwapCompatibilityResultLike,
>(
  params: ApplyPreviewSwapCommitParams<TPlanSnapshot, TCanonical>,
  dependencies: ApplyPreviewSwapCommitDependencies<TPlanSnapshot, TCanonical, TCompatibility>,
): ApplyPreviewSwapCommitResult<TCanonical, TCompatibility> {
  const { role, swapSnapshot, planSnapshot, finalRouteSnapshot, routeVersionAtClick } = params
  const lceContract = buildLceRuntimeContract({
    source: 'app.services.sandbox.applyPreviewSwapCommit',
    mutationKind: 'swap',
    phase: 'confirm',
    targetRole: role,
    canonicalRoute: finalRouteSnapshot,
    runtimeRouteArtifact: finalRouteSnapshot,
    runtimeFieldReality: planSnapshot.runtimeFieldReality,
    conciergeIntent: planSnapshot.conciergeIntent,
    routeShapeContract: planSnapshot.routeShapeContract,
    userConfirmed: true,
  })
  const lceCommitGate = assertLceRuntimeMutationMayCommit(lceContract)
  if (!lceCommitGate.ok) {
    throw new SwapCommitCoreError(
      `Swap rejected by LCE: ${lceCommitGate.reason ?? 'runtime continuity gate failed'}.`,
    )
  }
  const nextCanonicalStopByRole: Partial<Record<UserStopRole, TCanonical>> = {
    ...params.canonicalStopByRole,
    [role]: swapSnapshot.replacementCanonical,
  }
  const canonicalItinerary = dependencies.applyCanonicalIdentityToItinerary(
    swapSnapshot.swappedItinerary,
    nextCanonicalStopByRole,
  )
  const swapDirectionId = planSnapshot.selectedDirectionContract.id
  const swapPreviewContext = planSnapshot.selectedDirectionPreviewContext
  const compatibility = dependencies.evaluateSwapCompatibility({
    role,
    swapSnapshot,
    canonicalItinerary,
    planSnapshot,
    finalRouteSnapshot,
    routeShapeContract: planSnapshot.routeShapeContract,
  })
  if (!compatibility.swapCompatibilityPassed) {
    throw new SwapCommitCoreError(
      `Swap rejected: ${compatibility.swapCompatibilityReason}`,
      compatibility,
    )
  }
  if (!swapDirectionId || !swapPreviewContext) {
    throw new SwapCommitCoreError(
      'Route update failed: canonical route state is unavailable.',
      compatibility,
    )
  }
  if (finalRouteSnapshot.selectedDirectionId !== swapDirectionId) {
    throw new SwapCommitCoreError(
      'Swap rejected: route direction drifted from the selected direction contract.',
      compatibility,
    )
  }
  if (swapSnapshot.targetRouteId !== finalRouteSnapshot.routeId) {
    throw new SwapCommitCoreError(
      'Swap preview is stale. Please reopen swap options and try again.',
      compatibility,
    )
  }
  const sourceSwapStop = canonicalItinerary.stops.find((stop) => stop.role === role)
  const currentRouteStop =
    finalRouteSnapshot.stops.find((stop) => stop.id === swapSnapshot.targetStopId) ??
    finalRouteSnapshot.stops.find((stop) => stop.stopIndex === swapSnapshot.targetStopIndex) ??
    finalRouteSnapshot.stops.find((stop) => stop.role === swapSnapshot.targetRole)
  if (!sourceSwapStop || !currentRouteStop) {
    throw new SwapCommitCoreError(
      'Route update failed: swapped stop could not be resolved.',
      compatibility,
    )
  }
  if (
    currentRouteStop.role !== swapSnapshot.targetRole ||
    currentRouteStop.stopIndex !== swapSnapshot.targetStopIndex
  ) {
    throw new SwapCommitCoreError(
      'Swap target mismatch detected. Please retry from the current route.',
      compatibility,
    )
  }
  if (swapSnapshot.candidateStop.venueId !== swapSnapshot.requestedReplacementId) {
    throw new SwapCommitCoreError(
      `Swap integrity mismatch: modal requested ${swapSnapshot.requestedReplacementId}, candidate resolved ${swapSnapshot.candidateStop.venueId}.`,
      compatibility,
    )
  }
  let finalRouteApprovalDiagnostics: FinalRouteApprovalDiagnostics | undefined
  let approvedSwappedArc = swapSnapshot.swappedArc
  const approval =
    dependencies.approveFormalSwapFinalRoute?.({
      role,
      swapSnapshot,
      planSnapshot,
      proposedCandidate: swapSnapshot.swappedArc,
      routeShapeContract: planSnapshot.routeShapeContract,
    }) ??
    approveLegacySupportReplacementFinalRoute({
      role,
      planSnapshot,
      proposedCandidate: swapSnapshot.swappedArc,
    })
  if (approval) {
    finalRouteApprovalDiagnostics = approval.diagnostics
    if (approval.status !== 'approved') {
      throw new SwapCommitCoreError(
        `Swap rejected by final route approval (${approval.refusalOwner}): ${approval.reason}.`,
        compatibility,
        approval,
      )
    }
    approvedSwappedArc = approval.approvedCandidate
  }
  const projectedSwapMismatch = sourceSwapStop.venueId !== swapSnapshot.requestedReplacementId
  const canonicalItineraryAfterSwap = projectedSwapMismatch
    ? {
        ...canonicalItinerary,
        stops: canonicalItinerary.stops.map((stop) => {
          if (stop.role !== role) {
            return stop
          }
          return {
            ...stop,
            id: swapSnapshot.candidateStop.id,
            venueId: swapSnapshot.requestedReplacementId,
            venueName: swapSnapshot.replacementCanonical.displayName,
            city: swapSnapshot.replacementCanonical.city,
            neighborhood:
              swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood,
            driveMinutes: swapSnapshot.candidateStop.driveMinutes,
            imageUrl: swapSnapshot.candidateStop.imageUrl,
          }
        }),
      }
    : canonicalItinerary
  const fallbackImageUrl = dependencies.getSharedItineraryStopFallbackImageUrl(
    canonicalItineraryAfterSwap.stops,
  )
  const displayFields = dependencies.hydrateRuntimeRouteStopDisplayFields({
    stop: sourceSwapStop,
    existingRouteStop: {
      title: currentRouteStop.title,
      subtitle: currentRouteStop.subtitle,
      driveMinutes: swapSnapshot.candidateStop.driveMinutes,
      imageUrl:
        dependencies.getNonEmptyRuntimeRouteString(swapSnapshot.candidateStop.imageUrl) ??
        currentRouteStop.imageUrl,
    },
    fallbackImageUrl,
  })
  const replacementStop: RuntimeRouteStop = {
    id: swapSnapshot.candidateStop.id,
    sourceStopId: swapSnapshot.candidateStop.id,
    displayName: swapSnapshot.replacementCanonical.displayName,
    providerRecordId: swapSnapshot.replacementCanonical.providerRecordId,
    latitude: swapSnapshot.replacementCanonical.latitude,
    longitude: swapSnapshot.replacementCanonical.longitude,
    address: swapSnapshot.replacementCanonical.addressLine,
    role: currentRouteStop.role,
    stopIndex: currentRouteStop.stopIndex,
    venueId: swapSnapshot.requestedReplacementId,
    title: displayFields.title,
    subtitle: displayFields.subtitle,
    neighborhood:
      swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood,
    driveMinutes: displayFields.driveMinutes,
    imageUrl: displayFields.imageUrl,
  }
  const patched = dependencies.patchFinalRouteStop({
    route: finalRouteSnapshot,
    targetRole: swapSnapshot.targetRole,
    targetStopId: swapSnapshot.targetStopId,
    targetStopIndex: swapSnapshot.targetStopIndex,
    replacementStop,
    notice: `${role} swapped to ${replacementStop.displayName}.`,
    activeRole: role,
  })
  if (!patched) {
    throw new SwapCommitCoreError(
      'Route update failed: canonical route patch did not apply.',
      compatibility,
    )
  }
  if (
    patched.resolvedStop.role !== swapSnapshot.targetRole ||
    patched.resolvedStop.stopIndex !== swapSnapshot.targetStopIndex
  ) {
    throw new SwapCommitCoreError(
      'Swap target mismatch detected. Please retry from the current route.',
      compatibility,
    )
  }
  const nextFinalRoute = patched.route
  const appliedStop = nextFinalRoute.stops.find(
    (stop) => stop.stopIndex === swapSnapshot.targetStopIndex,
  )
  if (!appliedStop) {
    throw new SwapCommitCoreError(
      'Swap integrity mismatch: target slot is missing after route patch.',
      compatibility,
    )
  }
  if (appliedStop.role !== swapSnapshot.targetRole) {
    throw new SwapCommitCoreError(
      `Swap integrity mismatch: target role changed from ${swapSnapshot.targetRole} to ${appliedStop.role}.`,
      compatibility,
    )
  }
  const appliedReplacementId = appliedStop.venueId
  const swapMismatch = appliedReplacementId !== swapSnapshot.requestedReplacementId
  const swapDebugBreadcrumb: SwapDebugBreadcrumbLike = {
    swapTargetSlotIndex: swapSnapshot.targetStopIndex,
    swapTargetRole: swapSnapshot.targetRole,
    swapBeforeStopId: swapSnapshot.swapBeforeStopId,
    swapRequestedReplacementId: swapSnapshot.requestedReplacementId,
    swapAppliedReplacementId: appliedReplacementId,
    postSwapCanonicalStopIdBySlot: [...nextFinalRoute.stops]
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => stop.venueId),
    postSwapRenderedStopIdBySlot: canonicalItineraryAfterSwap.stops.map((stop) => stop.venueId),
    swapCommitSucceeded: !swapMismatch,
    swapRenderSource: 'renderOnlyFinalRoute',
    routeVersion: swapMismatch ? routeVersionAtClick : routeVersionAtClick + 1,
    mismatch: swapMismatch,
    lceDiagnostics: {
      ...lceContract.diagnostics,
      reasonCodes: lceCommitGate.reasonCodes,
    },
    finalRouteApproval: finalRouteApprovalDiagnostics,
  }
  if (swapMismatch) {
    throw new SwapCommitCoreError(
      `Swap integrity mismatch: requested ${swapSnapshot.requestedReplacementId}, applied ${appliedReplacementId}.`,
      compatibility,
    )
  }
  return {
    compatibility,
    nextCanonicalStopByRole,
    canonicalItineraryAfterSwap,
    nextItinerary: canonicalItineraryAfterSwap,
    nextSelectedArc: approvedSwappedArc,
    nextFinalRoute,
    swapDebugBreadcrumb,
    previewFeedback: dependencies.getPreviewSwapFeedback(role),
  }
}
