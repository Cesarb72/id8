import { readFileSync } from 'node:fs'
import type { BearingsPlaceRightVerdict } from '../src/domain/bearings/routePlaceRightContract'
import {
  computeFieldRealVerdict,
  computeFieldRealVerdictForArcCandidate,
} from '../src/domain/field/computeFieldRealVerdict'
import { buildGreatStopGateResult } from '../src/domain/greatStop/buildGreatStopGateResult'
import type { FieldRealFailureReason } from '../src/domain/field/fieldRealVerdict'
import type { ArcCandidate, ArcStop, ScoredVenueCandidateIdentity } from '../src/domain/types/arc'
import type { RoutePacingDiagnostics } from '../src/domain/types/diagnostics'
import type { IntentProfile } from '../src/domain/types/intent'
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

interface FieldRealStopInputLike {
  role: string
  venue: Venue
  candidateIdentity: ScoredVenueCandidateIdentity
}

function assertHasReasons(actual: readonly string[], expected: FieldRealFailureReason[]) {
  for (const reason of expected) {
    assert(actual.includes(reason), `Expected Field Real reason ${reason}; saw ${actual.join('|')}`)
  }
}

function placeRightPassVerdict(
  routeId: string,
  stopBaseVenueIds: string[],
): BearingsPlaceRightVerdict {
  const pass = {
    status: 'pass',
    reasonCodes: [],
  } as const

  return {
    placeRightReady: true,
    status: 'pass',
    reasons: [],
    distanceBurden: {
      ...pass,
      burden: 'low',
      notes: ['total:6', 'max:3'],
    },
    movementToleranceFit: pass,
    stretchAdmissibility: pass,
    supportProximityVerdict: pass,
    supportSupplyBuildabilityVerdict: pass,
    requiredStopSurvivalVerdict: pass,
    openClosedViabilityVerdict: pass,
    stopEvidence: stopBaseVenueIds.map((baseVenueId) => ({
      baseVenueId,
      status: 'pass',
      reasonCodes: [],
    })),
    routeEvidence: {
      status: 'pass',
      distanceBurden: {
        ...pass,
        burden: 'low',
      },
      movementToleranceFit: pass,
      stretchAdmissibility: pass,
      supportProximity: pass,
      supportSupplyBuildability: pass,
      requiredStopSurvival: pass,
      openClosedViability: pass,
      reasonCodes: [],
    },
    compatibility: {
      greatStopPlaceRightStatus: 'pass',
      greatStopPlaceRightReasonCodes: [],
    },
    provenance: {
      source: 'bearings',
      version: 'test-place-right-pass',
      notes: [`route:${routeId}`, 'consumed-district-source:district'],
    },
  }
}

function arcStop(role: ArcStop['role'], input: FieldRealStopInputLike): ArcStop {
  const generatedRole =
    role === 'warmup' ? 'start' : role === 'peak' ? 'highlight' : 'windDown'
  const roleScores = {
    warmup: role === 'warmup' ? 0.86 : 0.64,
    peak: role === 'peak' ? 0.9 : 0.64,
    wildcard: 0.64,
    cooldown: role === 'cooldown' ? 0.86 : 0.64,
  }

  return {
    role,
    scoredVenue: {
      venue: input.venue,
      candidateIdentity: input.candidateIdentity,
      momentIdentity: {
        type: role === 'peak' ? 'anchor' : role === 'warmup' ? 'arrival' : 'close',
        strength: role === 'peak' ? 'strong' : 'medium',
      },
      fitBreakdown: {} as never,
      fitScore: 0.82,
      hiddenGemScore: 0.5,
      lensCompatibility: 0.8,
      contextSpecificity: {
        overall: 0.78,
        personaSignal: 0.78,
        vibeSignal: 0.78,
        lensSignal: 0.78,
        byRole: roleScores,
      },
      dominanceControl: {
        universalityScore: 0.4,
        flaggedUniversal: false,
        byRole: roleScores,
      },
      roleContract: {} as never,
      stopShapeFit: {
        start: generatedRole === 'start' ? 0.82 : 0.52,
        highlight: generatedRole === 'highlight' ? 0.82 : 0.52,
        surprise: 0.52,
        windDown: generatedRole === 'windDown' ? 0.82 : 0.52,
      },
      vibeAuthority: {} as never,
      highlightValidity: { validityLevel: role === 'peak' ? 'valid' : 'fallback' } as never,
      roleScores,
      taste: {
        signals: {} as never,
        modeAlignment: {
          score: 0.82,
          penalty: 0,
          lane: role === 'peak' ? 'nightlife' : 'food',
          tier: 'strong',
          supportiveTagScore: 0.8,
          lanePriorityScore: 0.8,
        },
        fallbackPenalty: {
          signalScore: 0.8,
          appliedPenalty: 0,
          applied: false,
          strongerAlternativePresent: false,
          reason: 'none',
        },
      },
    },
  } as ArcStop
}

function candidateFromStops(
  id: string,
  stops: [FieldRealStopInputLike, FieldRealStopInputLike, FieldRealStopInputLike],
): ArcCandidate {
  return {
    id,
    stops: [
      arcStop('warmup', stops[0]),
      arcStop('peak', stops[1]),
      arcStop('cooldown', stops[2]),
    ],
    score: 0.91,
    scoreBreakdown: {
      geographyScore: 0.9,
      roleFlowScore: 0.9,
      diversityScore: 0.82,
      windDownScore: 0.86,
      highlightMomentScore: 0.92,
      momentStrengthScore: 0.94,
      momentVarianceScore: 0.9,
      momentFlatPenalty: 0,
      strongMomentPresent: true,
      momentQualityNote: 'Strong Field Real observer route.',
      roleEnergyNote: 'start-to-peak-to-wind-down',
    } as never,
    pacing: {} as never,
    spatial: {
      transitions: [{ driveGap: 3 }, { driveGap: 3 }],
    } as never,
    hasWildcard: false,
  } as ArcCandidate
}

function buildIntent(anchorBaseVenueId: string): IntentProfile {
  return {
    mode: 'build',
    city: 'San Jose',
    persona: 'friends',
    distanceMode: 'nearby',
    planningMode: 'user-led',
    anchor: {
      venueId: anchorBaseVenueId,
      role: 'highlight',
    },
    refinementModes: [],
  } as IntentProfile
}

function runFiveStampGate(candidate: ArcCandidate) {
  return buildGreatStopGateResult({
    selectedArc: candidate,
    intent: buildIntent(candidate.stops[1]!.scoredVenue.candidateIdentity.baseVenueId),
    routePacing: {} as RoutePacingDiagnostics,
    placeRightVerdict: placeRightPassVerdict(
      candidate.id,
      candidate.stops.map((stop) => stop.scoredVenue.candidateIdentity.baseVenueId),
    ),
    fieldRealVerdict: computeFieldRealVerdictForArcCandidate(candidate),
    locationClass: 'L1 Dense',
    locationClassSource: 'explicit',
  })
}

const goodStops: [FieldRealStopInputLike, FieldRealStopInputLike, FieldRealStopInputLike] = [
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
]

const goodVerdict = computeFieldRealVerdict(goodStops)
const goodFiveStampGate = runFiveStampGate(candidateFromStops('real-good-five-stamp', goodStops))

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
assert(goodFiveStampGate.status === 'PASS', 'Good route should pass all five Great Stop criteria.')
assert(goodFiveStampGate.criteria.real.passed, 'Good route Real should pass from Field verdict.')
assert(goodFiveStampGate.criteria.momentRight.passed, 'Good route Moment-Right should pass.')
assert(goodFiveStampGate.criteria.roleRight.passed, 'Good route Role-Right should pass.')
assert(goodFiveStampGate.criteria.placeRight.passed, 'Good route Place-Right should pass.')
assert(goodFiveStampGate.criteria.intentRight.passed, 'Good route Intent-Right should pass.')

const unavailableRecordStops: [
  FieldRealStopInputLike,
  FieldRealStopInputLike,
  FieldRealStopInputLike,
] = [
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
]

const unavailableRecordVerdict = computeFieldRealVerdict(unavailableRecordStops)
const unavailableRecordGate = runFiveStampGate(
  candidateFromStops('real-unavailable-five-stamp', unavailableRecordStops),
)

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
assert(
  unavailableRecordGate.failedCriteria.join('|') === 'real',
  'Availability-invalid route should fail only Real in the five-stamp gate.',
)
assertHasReasons(unavailableRecordGate.criteria.real.reasons, [
  'real:inactive_record',
  'real:suppressed_record',
  'real:stale_record',
  'real:unavailable_from_record',
])

const invalidIdentitySourceStops: [
  FieldRealStopInputLike,
  FieldRealStopInputLike,
  FieldRealStopInputLike,
] = [
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
]

const invalidIdentitySourceVerdict = computeFieldRealVerdict(invalidIdentitySourceStops)
const invalidIdentitySourceGate = runFiveStampGate(
  candidateFromStops('real-invalid-identity-source-five-stamp', invalidIdentitySourceStops),
)

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
assert(
  invalidIdentitySourceGate.failedCriteria.join('|') === 'real',
  'Identity/source-invalid route should fail only Real in the five-stamp gate.',
)
assertHasReasons(invalidIdentitySourceGate.criteria.real.reasons, [
  'real:invalid_canonical_identity',
  'real:unusable_source',
  'real:invalid_provenance',
])

const greatStopSource = readFileSync('src/domain/greatStop/buildGreatStopGateResult.ts', 'utf8')
const legacyRealReason = 'real:unusable_' + 'stop'
const legacyVenueIdTrim = ['venue', 'id', 'trim()'].join('.')
const legacyVenueNameTrim = ['venue', 'name', 'trim()'].join('.')
const legacyVenueActiveCheck = ['venue', 'is' + 'Active !== false'].join('.')
assert(
  greatStopSource.includes('function evaluateRealFromField(verdict?: FieldRealVerdict)') &&
    greatStopSource.includes('params.fieldRealVerdict') &&
    !greatStopSource.includes('function stopIdentityUsable') &&
    !greatStopSource.includes(legacyRealReason) &&
    !greatStopSource.includes(legacyVenueIdTrim) &&
    !greatStopSource.includes(legacyVenueNameTrim) &&
    !greatStopSource.includes(legacyVenueActiveCheck),
  'GW1-REAL-2C must remove local Great Stop Real authority and stamp from Field verdict.',
)

const output = {
  classification: 'field_real_five_stamp_gate',
  goodRoute: {
    status: goodVerdict.status,
    ready: goodVerdict.realReady,
    fieldAuthored: goodVerdict.provenance.source === 'field',
    evaluatedFrom: goodVerdict.provenance.evaluatedFrom,
  },
  goodFiveStampRoute: {
    overall: goodFiveStampGate.status,
    real: goodFiveStampGate.criteria.real.passed ? 'PASS' : 'FAIL',
    momentRight: goodFiveStampGate.criteria.momentRight.passed ? 'PASS' : 'FAIL',
    roleRight: goodFiveStampGate.criteria.roleRight.passed ? 'PASS' : 'FAIL',
    placeRight: goodFiveStampGate.criteria.placeRight.passed ? 'PASS' : 'FAIL',
    intentRight: goodFiveStampGate.criteria.intentRight.passed ? 'PASS' : 'FAIL',
    ownerSources: {
      real: 'field',
      momentRight: 'taste',
      roleRight: 'taste',
      placeRight: 'bearings_from_district_facts',
      intentRight: 'taste',
    },
  },
  unavailableRecordRoute: {
    status: unavailableRecordVerdict.status,
    reasons: unavailableRecordVerdict.failureReasons,
    availabilityStatus: unavailableRecordVerdict.availabilityStatus,
    fieldAuthored: unavailableRecordVerdict.provenance.source === 'field',
    greatStopReal: unavailableRecordGate.criteria.real.passed ? 'PASS' : 'FAIL',
    greatStopReasons: unavailableRecordGate.criteria.real.reasons,
    overall: unavailableRecordGate.status,
  },
  invalidIdentitySourceRoute: {
    status: invalidIdentitySourceVerdict.status,
    reasons: invalidIdentitySourceVerdict.failureReasons,
    identityUsable: invalidIdentitySourceVerdict.identityUsable,
    sourceUsable: invalidIdentitySourceVerdict.sourceUsable,
    provenanceValid: invalidIdentitySourceVerdict.provenanceValid,
    fieldAuthored: invalidIdentitySourceVerdict.provenance.source === 'field',
    greatStopReal: invalidIdentitySourceGate.criteria.real.passed ? 'PASS' : 'FAIL',
    greatStopReasons: invalidIdentitySourceGate.criteria.real.reasons,
    overall: invalidIdentitySourceGate.status,
  },
  greatStopRealRewired: true,
  greatStopRealAuthority: 'field_real_verdict',
  providerNetworkCounts: {
    fetchCallCount,
  },
}

console.log(JSON.stringify(output, null, 2))
