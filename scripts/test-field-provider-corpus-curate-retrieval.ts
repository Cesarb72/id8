import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { starterPacks } from '../src/data/starterPacks.ts'
import { curatedVenues } from '../src/data/venues.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import {
  curateStaticFieldCorpusStarterAliases,
  resolveCurateStaticFieldCorpusVenues,
} from '../src/domain/field/corpus/resolveCurateStaticFieldCorpusVenues.ts'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues.ts'
import type { IntentProfile } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const originalFetch = globalThis.fetch
const originalFlagValue = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Field static corpus Curate retrieval test must not call fetch.')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function buildIntent(starterPack: StarterPack, mode: IntentProfile['mode'] = 'curate'): IntentProfile {
  return normalizeIntent({
    persona: starterPack.personaBias,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode,
    mode,
  })
}

function setFlag(value: string | undefined): void {
  if (value === undefined) {
    delete process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
    return
  }
  process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = value
}

function resolveForStarter(starterPack: StarterPack, mode: IntentProfile['mode'] = 'curate') {
  return resolveCurateStaticFieldCorpusVenues({
    intent: buildIntent(starterPack, mode),
    starterPack,
    existingCuratedVenues: curatedVenues,
    requestedSourceMode: 'curated',
    enabled: true,
  })
}

function findSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      return findSourceFiles(fullPath)
    }
    return stats.isFile() ? [fullPath] : []
  })
}

function normalizePath(path: string): string {
  return relative(process.cwd(), path).replace(/\\/g, '/')
}

function findPublicJargonHits(): string[] {
  const roots = ['src/pages', 'src/components', 'src/app']
  const pattern = /provider corpus|field corpus|static provider corpus|curateStaticCorpus|fieldStaticProviderCorpus/i
  return roots
    .flatMap((root) => findSourceFiles(join(process.cwd(), root)))
    .filter((filePath) => pattern.test(readFileSync(filePath, 'utf8')))
    .map(normalizePath)
}

async function validateFlagOffParity(): Promise<void> {
  const starterPack = findStarterPack('dessert-conversation')
  const intent = buildIntent(starterPack)
  const lens = buildExperienceLens({ intent, starterPack })

  setFlag(undefined)
  const baseline = await retrieveVenues(intent, lens, {
    requestedSourceMode: 'curated',
    starterPack,
  })
  setFlag('0')
  const disabled = await retrieveVenues(intent, lens, {
    requestedSourceMode: 'curated',
    starterPack,
  })

  assert(
    baseline.venues.map((venue) => venue.id).join('|') ===
      disabled.venues.map((venue) => venue.id).join('|'),
    'Flag-off retrieval venue ids must remain unchanged.',
  )
  assert(!baseline.sourceMode.curateStaticCorpus, 'Flag absent must not expose static corpus diagnostics.')
  assert(!disabled.sourceMode.curateStaticCorpus, 'Flag disabled must not expose static corpus diagnostics.')
}

async function validateFlagOnCurateRetrieval(): Promise<void> {
  const starterPack = findStarterPack('hidden-cocktail-corners')
  const intent = buildIntent(starterPack)
  const lens = buildExperienceLens({ intent, starterPack })

  setFlag('1')
  const retrieval = await retrieveVenues(intent, lens, {
    requestedSourceMode: 'curated',
    starterPack,
  })

  assert(retrieval.sourceMode.requestedMode === 'curated', 'Requested sourceMode must remain curated.')
  assert(retrieval.sourceMode.effectiveMode === 'curated', 'Effective sourceMode must remain curated.')
  assert(!retrieval.sourceMode.liveFetchAttempted, 'Curated retrieval must not attempt live fetch.')
  assert(retrieval.sourceMode.countsBySource.live === 0, 'Static corpus venues must not count as live inventory.')
  assert(
    retrieval.sourceMode.curateStaticCorpus?.activated === true,
    'Flag-on San Jose Curate retrieval must activate static corpus contribution.',
  )
  assert(
    (retrieval.sourceMode.curateStaticCorpus?.appendedCount ?? 0) > 0,
    'Flag-on San Jose Curate retrieval must append static corpus venues.',
  )
  assert(
    retrieval.sourceMode.curateStaticCorpus.runtimeHoursAdmission?.planningWindow.source ===
      'gate1_default_evening_window',
    'Flag-on Curate retrieval must expose explicit Gate 1 runtime-hours planning window source.',
  )
  assert(
    retrieval.sourceMode.curateStaticCorpus.runtimeHoursAdmission.evaluatedCount > 0,
    'Flag-on Curate retrieval must evaluate Field corpus runtime-hours admission.',
  )
  assert(
    retrieval.stageCounts.curatedSeed > curatedVenues.length,
    'Curated seed count must include appended static corpus venues.',
  )
}

function validateResolverSemantics(): void {
  const arcadeStarter = findStarterPack('arcade-and-drinks')
  const hiddenStarter = findStarterPack('hidden-cocktail-corners')
  const wineStarter = findStarterPack('wine-slow-evening')
  const arcade = resolveForStarter(arcadeStarter)
  const hidden = resolveForStarter(hiddenStarter)
  const wine = resolveForStarter(wineStarter)

  assert(
    curateStaticFieldCorpusStarterAliases['arcade-and-drinks'] === 'arcade-drinks',
    'Arcade starter alias must resolve arcade-and-drinks to arcade-drinks.',
  )
  assert(
    arcade.diagnostics.starterSupportKey === 'arcade-drinks',
    'Arcade diagnostics must preserve resolved support key.',
  )
  assert(arcade.venues.length > 0, 'Arcade alias must contribute supported venues.')
  assert(hidden.venues.length > 0, 'Hidden cocktail starter must contribute venues.')
  assert(
    [...arcade.venues, ...hidden.venues].every((venue) => venue.source.sourceOrigin === 'curated'),
    'Static corpus contributions must enter retrieval as curated inventory.',
  )
  assert(
    [...arcade.venues, ...hidden.venues].every(
      (venue) =>
        venue.source.provider === 'google-places' &&
        venue.source.providerRecordId &&
        venue.id !== venue.source.providerRecordId,
    ),
    'Provider ids must remain provenance and not runtime identity.',
  )
  assert(
    [...arcade.venues, ...hidden.venues].every(
      (venue) => venue.source.qualityGateStatus !== 'suppressed',
    ),
    'Suppressed promoted venues must remain excluded from Curate retrieval.',
  )
  assert(
    arcade.venues.some((venue) => venue.source.qualityGateStatus === 'approved') &&
      arcade.venues.some((venue) => venue.source.qualityGateStatus === 'demoted'),
    'Approved and demoted venues must both remain eligible for retrieval.',
  )
  assert(
    hidden.venues.some((venue) =>
      venue.source.bearingsValidationRequirements?.includes(
        'runtime_hours_validation_required',
      ),
    ) ||
      wine.venues.some((venue) =>
        venue.source.bearingsValidationRequirements?.includes(
          'runtime_hours_validation_required',
        ),
      ),
    'Bearings runtime-hours validation requirement must survive retrieval projection.',
  )

  const promotedPaperPlane = sanJoseProviderCorpusVenues.find((venue) => venue.id === 'sj-paper-plane')
  assert(promotedPaperPlane, 'Promoted Paper Plane must exist.')
  assert(
    promotedPaperPlane?.providerProvenance.providerRecordId === 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
    'Promoted Paper Plane provider id must be preserved as provenance.',
  )
  assert(
    !hidden.venues.some((venue) => venue.id === 'sj-paper-plane'),
    'Static curated Paper Plane must win the identity collision.',
  )
  assert(
    hidden.diagnostics.staticCollisionCount > 0,
    'Resolver must record static curated collision drops.',
  )
  assert(
    hidden.diagnostics.runtimeHoursAdmission?.planningWindow.source === 'gate1_default_evening_window',
    'Resolver diagnostics must mark the Gate 1 default runtime-hours planning window source.',
  )
  assert(
    hidden.diagnostics.runtimeHoursAdmission.evaluatedCount > 0,
    'Resolver must evaluate runtime-hours admission before projection.',
  )
  assert(
    hidden.diagnostics.runtimeHoursAdmission.blockedCount ===
      hidden.diagnostics.runtimeHoursAdmission.closedBlockedCount,
    'Only closed required Field corpus venues may be blocked by runtime-hours admission.',
  )
}

function validateNonCurateNonConsumption(): void {
  const starterPack = findStarterPack('hidden-cocktail-corners')
  const surprise = resolveForStarter(starterPack, 'surprise')
  const build = resolveForStarter(starterPack, 'build')

  assert(!surprise.diagnostics.activated, 'Surprise must not consume static corpus in Patch 2A.')
  assert(surprise.diagnostics.reason === 'mode_not_curate', 'Surprise must be blocked before retrieval append.')
  assert(!build.diagnostics.activated, 'Build must not consume static corpus in Patch 2A.')
  assert(build.diagnostics.reason === 'mode_not_curate', 'Build must be blocked before retrieval append.')
}

function validateNoPublicJargonExposure(): void {
  const hits = findPublicJargonHits()
  assert(hits.length === 0, `Public UI/copy must not expose internal corpus jargon: ${hits.join(', ')}`)
}

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap
  await validateFlagOffParity()
  await validateFlagOnCurateRetrieval()
  validateResolverSemantics()
  validateNonCurateNonConsumption()
  validateNoPublicJargonExposure()
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('field static corpus Curate retrieval validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        flagKey: FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY,
        publicJargonHits: findPublicJargonHits(),
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}).finally(() => {
  globalThis.fetch = originalFetch
  setFlag(originalFlagValue)
})
