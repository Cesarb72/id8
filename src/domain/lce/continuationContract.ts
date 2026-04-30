/**
 * ARC BOUNDARY: shared continuation contract shell.
 *
 * This module defines the common contract vocabulary for continuation flows
 * without prescribing a mutation engine. Callers may target either locked
 * runtime route state or legacy planner draft state while exposing the same
 * detect -> alert -> preview -> confirm phases.
 */

export type ContinuationArtifactTargetKind =
  | 'runtime_final_route'
  | 'planner_arc_itinerary'

export type ContinuationContractStep = 'detect' | 'alert' | 'preview' | 'confirm'

export interface ContinuationOptionIdentity<TOptionId extends string = string> {
  id: TOptionId
  artifactTargetKind: ContinuationArtifactTargetKind
}

export interface ContinuationDetectContract {
  step: 'detect'
  artifactTargetKind: ContinuationArtifactTargetKind
  trigger: string
}

export interface ContinuationAlertContract<
  TDecisionId extends string = string,
  TOptionId extends string = string,
> {
  step: 'alert'
  artifactTargetKind: ContinuationArtifactTargetKind
  alertedRole?: string | null
  selectedDecisionId?: TDecisionId | null
  selectedOptionId?: TOptionId | null
}

export interface ContinuationPreviewContract<
  TOptionId extends string = string,
  TOptionPayload = unknown,
> {
  step: 'preview'
  artifactTargetKind: ContinuationArtifactTargetKind
  options: Array<
    ContinuationOptionIdentity<TOptionId> & {
      payload: TOptionPayload
    }
  >
  selectedOptionId?: TOptionId | null
}

export interface ContinuationConfirmContract<
  TDecisionId extends string = string,
  TOptionId extends string = string,
> {
  step: 'confirm'
  artifactTargetKind: ContinuationArtifactTargetKind
  decisionId?: TDecisionId | null
  selectedOptionId?: TOptionId | null
}

export interface ContinuationOptionContract<
  TOptionId extends string = string,
  TExtra extends object = Record<string, never>,
> extends ContinuationOptionIdentity<TOptionId>,
    TExtra {}

export function wrapContinuationOptionsWithArtifactTargetKind<
  TOptionId extends string,
  TOptionPayload,
>(
  artifactTargetKind: ContinuationArtifactTargetKind,
  options: Array<{
    id: TOptionId
    payload: TOptionPayload
  }>,
): ContinuationPreviewContract<TOptionId, TOptionPayload>['options'] {
  return options.map((option) => ({
    id: option.id,
    artifactTargetKind,
    payload: option.payload,
  }))
}

export function buildContinuationPreviewContract<
  TOptionId extends string,
  TOptionPayload,
>(params: {
  artifactTargetKind: ContinuationArtifactTargetKind
  options: Array<{
    id: TOptionId
    payload: TOptionPayload
  }>
  selectedOptionId?: TOptionId | null
}): ContinuationPreviewContract<TOptionId, TOptionPayload> {
  return {
    step: 'preview',
    artifactTargetKind: params.artifactTargetKind,
    options: wrapContinuationOptionsWithArtifactTargetKind(
      params.artifactTargetKind,
      params.options,
    ),
    selectedOptionId: params.selectedOptionId,
  }
}

export function resolveSelectedContinuationOption<
  TOptionId extends string,
  TOptionPayload,
>(
  contract: ContinuationPreviewContract<TOptionId, TOptionPayload>,
): (ContinuationPreviewContract<TOptionId, TOptionPayload>['options'][number] & {
  id: TOptionId
}) | null {
  if (!contract.selectedOptionId) {
    return null
  }
  return (
    contract.options.find((option) => option.id === contract.selectedOptionId) ?? null
  )
}
