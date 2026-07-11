import { readFileSync } from 'node:fs'
import { computeFieldRealVerdict } from '../src/domain/field/computeFieldRealVerdict'
import type { FieldRealFailureReason } from '../src/domain/field/fieldRealVerdict'
import type { ScoredVenueCandidateIdentity } from '../src/domain/types/arc'
import type { VenueSourceMetadata } from '../src/domain/types/normalization'
import type { InternalRole, Venue } from '../src/domain/types/venue'

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in no-network Field Real evidence test: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function source(overrides: Partial<VenueSourceMetadata> = {}): VenueSourceMetadata {
  return {
    normalizedFromRawType: 'seed',
    sourceOrigin: 'curated',
    curatedSubtype: 'manual-custom',
    sourceConfidence: 0.95,
    completenessScore: 0.94,
    qualityScore: 0.93,
    openNow: true,
    hoursKnown: true,
    likelyOpenForCurrentWindow: true,
    businessStatus: 'operational',
    timeConfidence: 0.95,
    hoursPressureLevel: 'strong-open',
    hoursPressureNotes: ['static record says available'],
    hoursDemotionApplied: false,
    hoursSuppressionApplied: false,
    sourceTypes: ['restaurant'],
    missingFields: [],
    inferredFields: [],
    qualityGateStatus: 'approved',
    qualityGateNotes: [],
    approvalBlockers: [],
    demotionReasons: [],
    suppressionReasons: [],
    ...overrides,
  }
}

function candidateIdentity(baseVenueId: string): ScoredVenueCandidateIdentity {
  return {
    candidateId: `${baseVenueId || 'missing'}:base`,
    baseVenueId,
    kind: 'base',
    traceLabel: baseVenueId || 'missing canonical identity',
  }
}

function venue(
  id: string,
  role: InternalRole,
  overrides: Partial<Venue> = {},
  sourceOverrides: Partial<VenueSourceMetadata> = {},
): Venue {
  return {
    id,
    name: `${id} Test Venue`,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 8,
    category: 'bar',
    subcategory: 'wine-bar',
    priceTier: '$$',
    tags: ['test'],
    useCases: [],
    vibeTags: [],
    energyLevel: role === 'peak' ? 0.82 : 0.58,
    socialDensity: 0.7,
    uniquenessScore: 0.7,
    distinctivenessScore: 0.7,
    underexposureScore: 0.6,
    shareabilityScore: 0.7,
    isChain: false,
    localSignals: {
      localFavoriteScore: 0.7,
      neighborhoodPrideScore: 0.7,
      repeatVisitorScore: 0.6,
    },
    roleAffinity: {
      warmup: role === 'warmup' ? 0.8 : 0.62,
      peak: role === 'peak' ? 0.86 : 0.62,
      wildcard: 0.6,
      cooldown: role === 'cooldown' ? 0.8 : 0.62,
    },
    imageUrl: '',
    shortDescription: 'Static test venue',
    narrativeFlavor: 'Static record truth fixture',
    isHiddenGem: false,
    isActive: true,
    highlightCapable: role === 'peak',
    durationProfile: {
      durationClass: 'M',
      estimatedMinutes: 60,
    },
    settings: {
      socialDensity: 0.7,
      highlightCapabilityTier: role === 'peak' ? 'highlight-capable' : 'support-only',
      highlightConfidence: role === 'peak' ? 0.88 : 0.52,
      supportOnly: role !== 'peak',
      connectiveOnly: false,
      setting: 'indoor',
      familyFriendly: false,
      adultSocial: true,
      dateFriendly: true,
      eventCapable: false,
      musicCapable: false,
      performanceCapable: false,
      routeFootprint: 'compact',
    },
    signature: {
      chainLike: false,
      genericScore: 0.25,
      signatureScore: 0.76,
    },
    source: source(sourceOverrides),
    ...overrides,
  }
}

function assertHasReasons(actual: FieldRealFailureReason[], expected: FieldRealFailureReason[]) {
  for (const reason of expected) {
    assert(actual.includes(reason), `Expected Field Real reason ${reason}; saw ${actual.join('|')}`)
  }
}

const goodVerdict = computeFieldRealVerdict([
  {
    role: 'start',
    venue: venue('real-good-start', 'warmup'),
    candidateIdentity: candidateIdentity('real-good-start'),
  },
  {
    role: 'highlight',
    venue: venue('real-good-peak', 'peak'),
    candidateIdentity: candidateIdentity('real-good-peak'),
  },
  {
    role: 'windDown',
    venue: venue('real-good-end', 'cooldown'),
    candidateIdentity: candidateIdentity('real-good-end'),
  },
])

assert(goodVerdict.status === 'pass', 'Good static record route should pass Field Real.')
assert(goodVerdict.realReady, 'Good static record route should be Real-ready.')
assert(goodVerdict.provenance.source === 'field', 'Field Real verdict must be Field-authored.')
assert(
  goodVerdict.provenance.evaluatedFrom === 'already_retrieved_record_truth',
  'Field Real verdict must evaluate already-retrieved record truth only.',
)
assert(
  goodVerdict.compatibility.greatStopRealInputs.realVerdict === 'pass',
  'Good static record route should expose Great Stop-compatible Real pass inputs.',
)

const unavailableRecordVerdict = computeFieldRealVerdict([
  {
    role: 'start',
    venue: venue('real-available-start', 'warmup'),
    candidateIdentity: candidateIdentity('real-available-start'),
  },
  {
    role: 'highlight',
    venue: venue(
      'real-suppressed-peak',
      'peak',
      { isActive: false },
      {
        businessStatus: 'closed-permanently',
        openNow: false,
        likelyOpenForCurrentWindow: false,
        qualityGateStatus: 'suppressed',
        qualityGateNotes: ['stale provider record retained for guard coverage'],
        suppressionReasons: ['record suppressed by Field quality gate'],
        hoursSuppressionApplied: true,
      },
    ),
    candidateIdentity: candidateIdentity('real-suppressed-peak'),
  },
  {
    role: 'windDown',
    venue: venue('real-available-end', 'cooldown'),
    candidateIdentity: candidateIdentity('real-available-end'),
  },
])

assert(
  unavailableRecordVerdict.status === 'fail',
  'Suppressed/stale/inactive/unavailable record route should fail Field Real.',
)
assert(unavailableRecordVerdict.identityUsable, 'Availability failure should preserve identity usability.')
assert(unavailableRecordVerdict.sourceUsable, 'Availability failure should preserve source usability.')
assert(
  unavailableRecordVerdict.provenanceValid,
  'Availability failure should preserve provenance validity.',
)
assertHasReasons(unavailableRecordVerdict.failureReasons, [
  'real:inactive_record',
  'real:suppressed_record',
  'real:stale_record',
  'real:unavailable_from_record',
])
assert(
  unavailableRecordVerdict.availabilityStatus === 'unavailable_from_record',
  'Availability failure should be classified as unavailable from record truth.',
)

const invalidIdentitySourceVerdict = computeFieldRealVerdict([
  {
    role: 'start',
    venue: venue('real-valid-start', 'warmup'),
    candidateIdentity: candidateIdentity('real-valid-start'),
  },
  {
    role: 'highlight',
    venue: venue(
      'real-invalid-identity-peak',
      'peak',
      {},
      {
        sourceOrigin: 'live',
        provider: undefined,
        providerRecordId: undefined,
        sourceConfidence: 0,
        completenessScore: 0,
        qualityScore: 0,
      },
    ),
    candidateIdentity: candidateIdentity('Display Name Is Not Canonical'),
  },
  {
    role: 'windDown',
    venue: venue('real-valid-end', 'cooldown'),
    candidateIdentity: candidateIdentity('real-valid-end'),
  },
])

assert(
  invalidIdentitySourceVerdict.status === 'fail',
  'Invalid canonical identity and unusable source route should fail Field Real.',
)
assert(!invalidIdentitySourceVerdict.identityUsable, 'Invalid identity route should be identity-unusable.')
assert(!invalidIdentitySourceVerdict.sourceUsable, 'Invalid source route should be source-unusable.')
assert(
  !invalidIdentitySourceVerdict.provenanceValid,
  'Invalid live-source provenance should fail provenance validity.',
)
assertHasReasons(invalidIdentitySourceVerdict.failureReasons, [
  'real:invalid_canonical_identity',
  'real:unusable_source',
  'real:invalid_provenance',
])

const greatStopSource = readFileSync('src/domain/greatStop/buildGreatStopGateResult.ts', 'utf8')
assert(
  !greatStopSource.includes('computeFieldRealVerdict') &&
    !greatStopSource.includes('FieldRealVerdict') &&
    greatStopSource.includes('function evaluateReal(candidate: ArcCandidate)') &&
    greatStopSource.includes('real:unusable_stop:${roleFor(stop)}'),
  'GW1-REAL-2B must not rewire Great Stop Real; local compatibility path remains until 2C.',
)

const output = {
  classification: 'field_real_evidence_guard',
  goodRoute: {
    status: goodVerdict.status,
    ready: goodVerdict.realReady,
    fieldAuthored: goodVerdict.provenance.source === 'field',
    evaluatedFrom: goodVerdict.provenance.evaluatedFrom,
  },
  unavailableRecordRoute: {
    status: unavailableRecordVerdict.status,
    reasons: unavailableRecordVerdict.failureReasons,
    availabilityStatus: unavailableRecordVerdict.availabilityStatus,
    fieldAuthored: unavailableRecordVerdict.provenance.source === 'field',
  },
  invalidIdentitySourceRoute: {
    status: invalidIdentitySourceVerdict.status,
    reasons: invalidIdentitySourceVerdict.failureReasons,
    identityUsable: invalidIdentitySourceVerdict.identityUsable,
    sourceUsable: invalidIdentitySourceVerdict.sourceUsable,
    provenanceValid: invalidIdentitySourceVerdict.provenanceValid,
    fieldAuthored: invalidIdentitySourceVerdict.provenance.source === 'field',
  },
  greatStopRealRewired: false,
  providerNetworkCounts: {
    fetchCallCount,
  },
}

console.log(JSON.stringify(output, null, 2))
