/**
 * ARC APPLICATION WRAPPER CONTRACT
 *
 * Wrappers may:
 * - orchestrate lifecycle and engine invocation order
 * - pass canonical artifacts between engines
 * - track/debug invocation lineage
 *
 * Wrappers must not:
 * - infer semantic identity (Interpretation-owned)
 * - adjudicate feasibility/buildability (Bearings-owned)
 * - author structural planning truth (Waypoint-owned)
 */
type SelectedDirectionContextLike = {
  directionId?: string | null
}

type DirectionContextCarrierLike = {
  selectedDirectionContext?: SelectedDirectionContextLike
}

export function assertCanonicalSelectedDirectionContext(params: {
  wrapperSeam: string
  input: DirectionContextCarrierLike
}): void {
  const { wrapperSeam, input } = params
  console.assert(
    !input.selectedDirectionContext || Boolean(input.selectedDirectionContext.directionId),
    `[ARC-BOUNDARY] ${wrapperSeam} should pass canonical selectedDirectionContext artifacts.`,
  )
}

export function enforceSelectedDirectionLineage(params: {
  wrapperSeam: string
  expectedDirectionId: string
  actualSelectedDirectionContext?: SelectedDirectionContextLike
  errorMessage?: string
}): void {
  const { wrapperSeam, expectedDirectionId, actualSelectedDirectionContext, errorMessage } = params
  if (actualSelectedDirectionContext?.directionId === expectedDirectionId) {
    return
  }
  throw new Error(
    errorMessage ??
      `[ARC-BOUNDARY] ${wrapperSeam} failed to preserve selectedDirectionContext lineage.`,
  )
}
