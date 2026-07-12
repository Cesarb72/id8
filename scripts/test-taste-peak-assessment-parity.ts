import {
  computeTasteRolePoolCandidateMeaning,
} from '../src/domain/interpretation/taste/computeTasteRolePoolMeaningView'
import type {
  RolePoolMeaningCandidateEvidence,
  RolePoolMeaningCandidateInput,
} from '../src/domain/interpretation/taste/computeRolePoolMeaningEvidence'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Taste peak assessment parity test: ${String(args[0])}`)
}) as typeof fetch

function baseCandidate(
  overrides: Partial<RolePoolMeaningCandidateInput>,
): RolePoolMeaningCandidateInput {
  return {
    candidateVenueId: 'taste-peak-parity-candidate',
    category: 'activity',
    subcategory: 'experience',
    tags: ['immersive', 'activity'],
    vibeTags: ['lively'],
    energy: 0.62,
    socialDensity: 0.54,
    intimacy: 0.42,
    lingerFactor: 0.52,
    destinationFactor: 0.62,
    experientialFactor: 0.74,
    conversationFriendliness: 0.48,
    interactiveStrength: 0.7,
    durationEstimate: 'medium',
    roleSuitability: {
      highlight: 0.72,
    },
    momentIntensityScore: 0.72,
    momentPotentialScore: 0.74,
    anchorStrength: 0.7,
    primaryExperienceArchetype: 'activity',
    ...overrides,
  }
}

function legacyPeakMomentException(candidate: RolePoolMeaningCandidateInput): boolean {
  return (
    candidate.momentPotentialScore >= 0.62 &&
    (candidate.primaryExperienceArchetype === 'outdoor' ||
      candidate.primaryExperienceArchetype === 'scenic' ||
      candidate.primaryExperienceArchetype === 'activity' ||
      candidate.primaryExperienceArchetype === 'culture' ||
      candidate.primaryExperienceArchetype === 'social')
  )
}

function tastePeakMomentException(evidence: RolePoolMeaningCandidateEvidence): boolean {
  const archetype = evidence.categoryArchetype.primaryExperienceArchetype
  return (
    evidence.expressionActivation.momentPotential >= 0.62 &&
    (archetype === 'outdoor' ||
      archetype === 'scenic' ||
      archetype === 'activity' ||
      archetype === 'culture' ||
      archetype === 'social')
  )
}

function legacyNonPeak(candidate: RolePoolMeaningCandidateInput): boolean {
  return (
    candidate.momentPotentialScore < 0.56 &&
    candidate.momentIntensityScore < 0.58 &&
    candidate.anchorStrength < 0.54
  )
}

function tasteNonPeak(evidence: RolePoolMeaningCandidateEvidence): boolean {
  return evidence.peakWorthiness.weakPeak || evidence.peakWorthiness.passivePeak
}

const peakWorthyCandidate = baseCandidate({})
const peakWorthyEvidence = computeTasteRolePoolCandidateMeaning(peakWorthyCandidate)
const legacyPeak = legacyPeakMomentException(peakWorthyCandidate)
const tastePeak = tastePeakMomentException(peakWorthyEvidence)

assert(legacyPeak, 'Expected legacy peak-worthy candidate to be peak-worthy')
assert(tastePeak, 'Expected Taste evidence to preserve peak-worthy decision')

const weakPassiveCandidate = baseCandidate({
  candidateVenueId: 'taste-peak-parity-weak-passive',
  category: 'restaurant',
  subcategory: 'casual dining',
  tags: ['dinner'],
  vibeTags: ['casual'],
  experientialFactor: 0.38,
  destinationFactor: 0.42,
  interactiveStrength: 0.34,
  momentIntensityScore: 0.5,
  momentPotentialScore: 0.52,
  anchorStrength: 0.48,
  primaryExperienceArchetype: 'dining',
})
const weakPassiveEvidence = computeTasteRolePoolCandidateMeaning(weakPassiveCandidate)
const legacyWeakPassive = legacyNonPeak(weakPassiveCandidate)
const tasteWeakPassive = tasteNonPeak(weakPassiveEvidence)

assert(legacyWeakPassive, 'Expected legacy weak/passive candidate to be non-peak')
assert(tasteWeakPassive, 'Expected Taste evidence to preserve non-peak decision')

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      peakWorthy: {
        legacy: legacyPeak,
        taste: tastePeak,
        tasteStatus: peakWorthyEvidence.peakWorthiness.status,
        centralMomentStatus: peakWorthyEvidence.centralMomentQuality.status,
      },
      weakPassive: {
        legacy: legacyWeakPassive,
        taste: tasteWeakPassive,
        tasteStatus: weakPassiveEvidence.peakWorthiness.status,
        centralMomentStatus: weakPassiveEvidence.centralMomentQuality.status,
        weakPeak: weakPassiveEvidence.peakWorthiness.weakPeak,
        passivePeak: weakPassiveEvidence.peakWorthiness.passivePeak,
      },
      providerNetworkCalls: fetchCallCount,
    },
    null,
    2,
  ),
)
