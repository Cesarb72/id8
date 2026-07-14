import { starterPacks } from '../src/data/starterPacks.ts'
import {
  assessRuntimeHoursValidationDiagnostic,
  buildRuntimeHoursValidationDiagnostics,
} from '../src/domain/bearings/runtimeHoursValidationDiagnostics.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import type { Venue } from '../src/domain/types/venue.ts'
import { buildWhenSignalProfile } from '../src/domain/when/whenSignalProfile.ts'

const originalFetch = globalThis.fetch
const originalFlagValue = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Bearings runtime-hours diagnostics test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function setFlag(value: string | undefined): void {
  if (value === undefined) {
    delete process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
    return
  }
  process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = value
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function findRequiredVenue(): Venue {
  const promotedVenue = sanJoseProviderCorpusVenues.find(
    (candidate) =>
      candidate.venue.source.bearingsValidationRequirements?.includes(
        'runtime_hours_validation_required',
      ) === true,
  )
  if (!promotedVenue) {
    throw new Error('Missing required promoted venue fixture for runtime-hours diagnostics.')
  }
  return promotedVenue.venue
}

function findNotRequiredVenue(): Venue {
  const promotedVenue = sanJoseProviderCorpusVenues.find(
    (candidate) =>
      candidate.venue.source.bearingsValidationRequirements?.includes(
        'runtime_hours_validation_required',
      ) !== true,
  )
  if (!promotedVenue) {
    throw new Error('Missing non-required promoted venue fixture for runtime-hours diagnostics.')
  }
  return promotedVenue.venue
}

function validatePureHelper(): void {
  const requiredFixture = findRequiredVenue()
  const requiredLikelyOpen: Venue = {
    ...requiredFixture,
    source: {
      ...requiredFixture.source,
      likelyOpenForCurrentWindow: true,
      openNow: false,
      timeConfidence: 0.96,
      hoursPressureLevel: 'strong-open',
    },
  }
  const requiredOpenNow: Venue = {
    ...requiredFixture,
    source: {
      ...requiredFixture.source,
      likelyOpenForCurrentWindow: true,
      openNow: true,
      timeConfidence: 0.96,
      hoursPressureLevel: 'strong-open',
    },
  }
  const notRequired = findNotRequiredVenue()
  const requiredWithOpenProof: Venue = {
    ...requiredFixture,
    source: {
      ...requiredFixture.source,
      runtimeHoursPlanWindowProofStatus: 'open_for_plan_window',
      runtimeHoursPlanWindowSource: 'when_planning_window',
      runtimeHoursStructuredPeriodCount: 6,
    },
  }
  const requiredWithUnknownProof: Venue = {
    ...requiredFixture,
    source: {
      ...requiredFixture.source,
      runtimeHoursPlanWindowProofStatus: 'unknown_for_plan_window',
      runtimeHoursPlanWindowSource: 'when_planning_window',
      runtimeHoursStructuredPeriodCount: 0,
    },
  }

  const likelyOpenDiagnostic =
    assessRuntimeHoursValidationDiagnostic(requiredLikelyOpen)
  assert(
    likelyOpenDiagnostic.runtimeProofStatus === 'missing_runtime_proof',
    'Persisted likelyOpenForCurrentWindow must not count as runtime proof.',
  )
  assert(
    likelyOpenDiagnostic.wouldBlockUnderConservativeEnforcement,
    'Required venue with persisted likely-open signal must conservatively block.',
  )
  assert(
    likelyOpenDiagnostic.persistedHoursSnapshot.likelyOpenForCurrentWindow === true,
    'Diagnostic must retain persisted likely-open value only as a snapshot.',
  )

  const openNowDiagnostic = assessRuntimeHoursValidationDiagnostic(requiredOpenNow)
  assert(
    openNowDiagnostic.runtimeProofStatus === 'missing_runtime_proof',
    'Persisted openNow must not count as runtime proof.',
  )
  assert(
    openNowDiagnostic.wouldBlockUnderConservativeEnforcement,
    'Required venue with persisted open-now signal must conservatively block.',
  )
  assert(
    openNowDiagnostic.persistedHoursSnapshot.openNow === true,
    'Diagnostic must retain persisted openNow only as a snapshot.',
  )

  const notRequiredDiagnostic = assessRuntimeHoursValidationDiagnostic(notRequired)
  assert(
    notRequiredDiagnostic.runtimeProofStatus === 'not_required',
    'Venue without runtime-hours requirement must report not_required.',
  )
  assert(
    !notRequiredDiagnostic.wouldBlockUnderConservativeEnforcement,
    'Venue without runtime-hours requirement must not conservatively block.',
  )

  const openProofDiagnostic = assessRuntimeHoursValidationDiagnostic(requiredWithOpenProof)
  assert(
    openProofDiagnostic.runtimeProofStatus === 'open_for_plan_window',
    'Required venue with structured open proof must report open_for_plan_window.',
  )
  assert(
    !openProofDiagnostic.wouldBlockUnderConservativeEnforcement,
    'Required venue with structured open proof must not conservatively block.',
  )

  const unknownProofDiagnostic = assessRuntimeHoursValidationDiagnostic(requiredWithUnknownProof)
  assert(
    unknownProofDiagnostic.runtimeProofStatus === 'unknown_for_plan_window',
    'Required venue with no-period admission must report unknown_for_plan_window.',
  )
  assert(
    !unknownProofDiagnostic.wouldBlockUnderConservativeEnforcement,
    'Required venue with unknown proof must be admitted and not counted as a conservative block.',
  )

  const summary = buildRuntimeHoursValidationDiagnostics([
    requiredLikelyOpen,
    requiredOpenNow,
    requiredWithOpenProof,
    requiredWithUnknownProof,
    notRequired,
  ])
  assert(summary.evaluatedVenueCount === 5, 'Summary must evaluate all supplied venues.')
  assert(summary.requiredVenueCount === 4, 'Summary must count required venues.')
  assert(
    summary.missingRuntimeProofCount === 2,
    'Summary must count only required venues without runtime proof as missing runtime proof.',
  )
  assert(
    summary.wouldBlockUnderConservativeEnforcementCount === 2,
    'Summary must count only missing or closed runtime proof as conservative blocks.',
  )
}

async function validateCurateRetrievalDiagnostics(): Promise<void> {
  const starterPack = findStarterPack('hidden-cocktail-corners')
  const intent = normalizeIntent({
    persona: starterPack.personaBias,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode,
    mode: 'curate',
  })
  const lens = buildExperienceLens({ intent, starterPack })

  setFlag('1')
  const retrieval = await retrieveVenues(intent, lens, {
    requestedSourceMode: 'curated',
    starterPack,
    whenSignalProfile: buildWhenSignalProfile({ spatialMode: 'WALKABLE' }),
  })

  assert(retrieval.sourceMode.requestedMode === 'curated', 'Requested sourceMode must remain curated.')
  assert(retrieval.sourceMode.effectiveMode === 'curated', 'Effective sourceMode must remain curated.')
  assert(!retrieval.sourceMode.liveFetchAttempted, 'Curated retrieval must not attempt live fetch.')
  assert(retrieval.sourceMode.countsBySource.live === 0, 'Diagnostics must not make static corpus venues live.')
  assert(
    retrieval.sourceMode.curateStaticCorpus?.activated === true,
    'Static Field corpus must activate for the Curate fixture.',
  )

  const diagnostics = retrieval.sourceMode.bearingsRuntimeHours
  assert(diagnostics !== undefined, 'Bearings runtime-hours diagnostics must be surfaced.')
  assert(diagnostics.requiredVenueCount > 0, 'Diagnostics must count required venues.')
  assert(
    diagnostics.missingRuntimeProofCount === 0,
    'Structured Field corpus admission must not classify admitted required venues as missing runtime proof.',
  )
  assert(
    diagnostics.wouldBlockUnderConservativeEnforcementCount === 0,
    'Structured Field corpus admission must not report admitted required venues as conservative blocks.',
  )

  const admission = retrieval.sourceMode.curateStaticCorpus.runtimeHoursAdmission
  assert(admission !== undefined, 'Curate static corpus diagnostics must include runtime-hours admission.')
  assert(
    admission.planningWindow.source === 'when_planning_window',
    'Runtime-hours planning window source must come from Bearings When projection.',
  )
  assert(admission.evaluatedCount > 0, 'Runtime-hours admission must evaluate Field corpus candidates.')
  assert(
    admission.blockedCount === admission.closedBlockedCount,
    'Only closed_for_plan_window candidates may be blocked.',
  )
  assert(
    admission.unknownAdmittedCount >= 0,
    'Unknown runtime-hours candidates must be admitted and counted diagnostically.',
  )

  const finalRetrievedVenueIds = new Set(retrieval.venues.map((venue) => venue.id))
  const requiredRetrievedVenueIds = retrieval.venues
    .filter((venue) =>
      venue.source.bearingsValidationRequirements?.includes(
        'runtime_hours_validation_required',
      ),
    )
    .map((venue) => venue.id)
  assert(requiredRetrievedVenueIds.length > 0, 'Required venues must be present in retrieval output for diagnostics.')
  assert(
    requiredRetrievedVenueIds.every((venueId) => finalRetrievedVenueIds.has(venueId)),
    'Admitted required venues must remain in retrieval output.',
  )
}

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap
  validatePureHelper()
  await validateCurateRetrievalDiagnostics()
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('bearings runtime-hours diagnostics validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        flagKey: FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY,
      },
      null,
      2,
    )}\n`,
  )
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    setFlag(originalFlagValue)
  })
