import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { starterPacks } from '../src/data/starterPacks.ts'
import { validateContractEntryArtifactPreCommitTruth } from '../src/domain/artifacts/contractEntryArtifact.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { IntentInput } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import type { Venue } from '../src/domain/types/venue.ts'

const targetStarterIds = [
  'dessert-conversation',
  'coffee-books',
  'hidden-cocktail-corners',
  'arcade-and-drinks',
  'street-food-adventure',
  'wine-slow-evening',
  'live-music-loop',
] as const

const originalFetch = globalThis.fetch
const originalFlagValue = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Curate Field corpus route generation test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function setEnv(): void {
  globalThis.fetch = fetchTrap
  process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = '1'
  process.env.VITE_ID8_SOURCE_MODE = 'curated'
  delete process.env.VITE_GOOGLE_PLACES_API_KEY
}

function restoreEnv(): void {
  globalThis.fetch = originalFetch
  if (originalFlagValue === undefined) {
    delete process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
  } else {
    process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = originalFlagValue
  }
  if (originalSourceMode === undefined) {
    delete process.env.VITE_ID8_SOURCE_MODE
  } else {
    process.env.VITE_ID8_SOURCE_MODE = originalSourceMode
  }
  if (originalGoogleKey === undefined) {
    delete process.env.VITE_GOOGLE_PLACES_API_KEY
  } else {
    process.env.VITE_GOOGLE_PLACES_API_KEY = originalGoogleKey
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function buildStarterInput(starterPack: StarterPack): IntentInput {
  return {
    mode: 'curate',
    persona: starterPack.personaBias ?? null,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode ?? 'nearby',
    prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
  }
}

function findSourceFiles(directory: string): string[] {
  const fullRoot = join(process.cwd(), directory)
  try {
    return readdirSync(fullRoot).flatMap((name) => {
      const fullPath = join(fullRoot, name)
      const stats = statSync(fullPath)
      if (stats.isDirectory()) {
        return findSourceFiles(relative(process.cwd(), fullPath))
      }
      return stats.isFile() ? [fullPath] : []
    })
  } catch {
    return []
  }
}

function normalizePath(path: string): string {
  return relative(process.cwd(), path).replace(/\\/g, '/')
}

function findPublicJargonHits(): string[] {
  const roots = ['src/pages', 'src/components', 'src/app']
  const pattern = /provider corpus|field corpus|static provider corpus|curateStaticCorpus|fieldStaticProviderCorpus/i
  return roots
    .flatMap(findSourceFiles)
    .filter((filePath) => pattern.test(readFileSync(filePath, 'utf8')))
    .map(normalizePath)
}

function isCoherentSoftHighlight(starterId: string, venue: Venue): boolean {
  const tags = new Set(venue.tags.map((tag) => tag.toLowerCase()))
  if (starterId === 'dessert-conversation') {
    return (
      venue.category === 'dessert' ||
      venue.category === 'cafe' ||
      tags.has('tea-room') ||
      tags.has('coffee') ||
      tags.has('conversation') ||
      tags.has('cozy')
    )
  }
  if (starterId === 'coffee-books') {
    return (
      venue.category === 'cafe' ||
      venue.category === 'museum' ||
      venue.category === 'dessert' ||
      tags.has('coffee_books') ||
      tags.has('bookstore') ||
      tags.has('board-games') ||
      tags.has('literary') ||
      tags.has('curated')
    )
  }
  return true
}

async function main(): Promise<void> {
  setEnv()
  const summaries = []

  for (const starterId of targetStarterIds) {
    const starterPack = findStarterPack(starterId)
    const result = await runGeneratePlan(buildStarterInput(starterPack), {
      starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
    })
    const liveSource = result.trace.retrievalDiagnostics.liveSource
    const selectedHighlight = result.selectedArc.stops.find((stop) => stop.role === 'peak')
    const artifactValidation = validateContractEntryArtifactPreCommitTruth(
      result.contractEntryArtifact,
      { requireEnrichment: true },
    )

    assert(selectedHighlight, `${starterId}: generated route must include a highlight.`)
    assert(result.selectedArc.stops.length >= 2, `${starterId}: generated route must include at least two stops.`)
    const artifactRejectionReasons = artifactValidation.rejectionReasons
    const missingEnrichmentReasons = artifactRejectionReasons.filter((reason) =>
      reason.startsWith('missing_') &&
      reason !== 'missing_start_role' &&
      reason !== 'missing_highlight_role' &&
      reason !== 'missing_wind_down_role',
    )
    assert(
      missingEnrichmentReasons.length === 0,
      `${starterId}: enriched ContractEntryArtifact must not miss enrichment fields: ${missingEnrichmentReasons.join(', ')}`,
    )
    if (artifactValidation.fullPlanVisible) {
      assert(artifactValidation.status === 'valid', `${starterId}: full-plan artifact must be valid.`)
    } else {
      assert(
        artifactValidation.status === 'incomplete',
        `${starterId}: partial-route artifact must be truthfully incomplete.`,
      )
      assert(
        artifactRejectionReasons.some((reason) => reason.endsWith('_role')),
        `${starterId}: incomplete artifact must preserve missing role reasons.`,
      )
    }
    assert(
      result.contractEntryArtifact.enrichment?.mode === 'curate',
      `${starterId}: ContractEntryArtifact mode must be curate.`,
    )
    assert(
      result.contractEntryArtifact.enrichment?.starterContextFit?.starterPackId === starterId,
      `${starterId}: ContractEntryArtifact must carry starter context fit.`,
    )
    assert(
      result.contractEntryArtifact.enrichment?.modeContextFit?.status === 'passed',
      `${starterId}: ContractEntryArtifact must carry passed mode context fit.`,
    )
    assert(
      result.contractEntryArtifact.enrichment?.fieldProvenanceSummary?.liveProviderUsed === false,
      `${starterId}: ContractEntryArtifact must not mark live provider usage.`,
    )
    assert(
      result.contractEntryArtifact.enrichment?.runtimeLockEligibility?.eligible ===
        artifactValidation.fullPlanVisible,
      `${starterId}: ContractEntryArtifact lock eligibility must match full-plan visibility.`,
    )
    assert(liveSource.requestedMode === 'curated', `${starterId}: requested sourceMode must remain curated.`)
    assert(liveSource.effectiveMode === 'curated', `${starterId}: effective sourceMode must remain curated.`)
    assert(!liveSource.liveFetchAttempted, `${starterId}: live fetch must not be attempted.`)
    assert(liveSource.countsBySource.live === 0, `${starterId}: live source count must remain zero.`)

    if (starterId === 'dessert-conversation' || starterId === 'coffee-books') {
      assert(
        selectedHighlight.scoredVenue.highlightValidity.validityLevel === 'valid',
        `${starterId}: selected soft highlight must be highlight-valid.`,
      )
      assert(
        selectedHighlight.scoredVenue.highlightValidity.packLiteralRequirementSatisfied === true,
        `${starterId}: selected soft highlight must satisfy the starter literal contract.`,
      )
      assert(
        isCoherentSoftHighlight(starterId, selectedHighlight.scoredVenue.venue),
        `${starterId}: selected soft highlight must stay within starter-scoped categories/tags.`,
      )
    }

    summaries.push({
      starterId,
      stopCount: result.selectedArc.stops.length,
      selectedStops: result.selectedArc.stops.map((stop) => ({
        role: stop.role,
        id: stop.scoredVenue.venue.id,
        name: stop.scoredVenue.venue.name,
        category: stop.scoredVenue.venue.category,
        sourceOrigin: stop.scoredVenue.venue.source.sourceOrigin,
        curatedSubtype: stop.scoredVenue.venue.source.curatedSubtype,
      })),
      requestedMode: liveSource.requestedMode,
      effectiveMode: liveSource.effectiveMode,
      liveFetchAttempted: liveSource.liveFetchAttempted,
      liveCount: liveSource.countsBySource.live,
      bearingsRuntimeHoursPassive: Boolean(result.trace.retrievalDiagnostics.bearingsRuntimeHours),
    })
  }

  const publicJargonHits = findPublicJargonHits()
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  assert(publicJargonHits.length === 0, `Public UI must not expose internal jargon: ${publicJargonHits.join(', ')}`)

  process.stdout.write('Curate Field corpus route generation validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        targetStarterIds,
        publicJargonHits,
        summaries,
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
    restoreEnv()
  })
