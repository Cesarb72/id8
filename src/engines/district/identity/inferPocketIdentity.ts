import type { IdentifiedPocket, RefinedPocket } from '../types/districtTypes'
import { makeIdentityDecision } from './identityDecision'
import { computeIdentitySignals } from './identitySignals'

export function inferPocketIdentity(refinedPockets: RefinedPocket[]): IdentifiedPocket[] {
  return refinedPockets.map((pocket) => {
    const signals = computeIdentitySignals(pocket)
    const identity = makeIdentityDecision(pocket, signals)
    return {
      ...pocket,
      identity,
    }
  })
}

