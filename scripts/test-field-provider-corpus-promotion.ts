import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { curatedVenues } from '../src/data/venues.ts'
import {
  promoteProviderCorpus,
  stableStringifyPromotedProviderCorpus,
  validatePromotedFieldProviderCorpus,
} from '../src/domain/field/corpus/promoteProviderCorpus.ts'
import { sanJoseProviderCorpus } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import { sanJoseProviderCorpusManifest } from '../src/domain/field/corpus/sanJoseProviderCorpusManifest.ts'
import {
  OFFLINE_CORPUS_TIME_SENSITIVE_AUDIT_REASON,
  RUNTIME_HOURS_VALIDATION_REQUIRED,
} from '../src/domain/field/corpus/types.ts'
import type { PromotedFieldProviderCorpus } from '../src/domain/field/corpus/types.ts'
import type { ProviderCorpusArtifact } from '../src/domain/providers/providerCorpusArtifact.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Field provider corpus promotion test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function readSourceArtifact(): { artifact: ProviderCorpusArtifact; serialized: string } {
  const serialized = readFileSync(sanJoseProviderCorpusManifest.sourceArtifactPath, 'utf8')
  return {
    artifact: JSON.parse(serialized) as ProviderCorpusArtifact,
    serialized,
  }
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

function findKeyLikeHits(directory: string): string[] {
  const keyPattern = /AIza[0-9A-Za-z_-]{20,}/
  return findSourceFiles(directory)
    .filter((filePath) => keyPattern.test(readFileSync(filePath, 'utf8')))
    .map(normalizePath)
}

function findRuntimeCorpusImports(): string[] {
  const srcRoot = join(process.cwd(), 'src')
  const allowed = new Set(
    [
      'src/domain/field/corpus/promoteProviderCorpus.ts',
      'src/domain/field/corpus/sanJoseProviderCorpus.ts',
      'src/domain/field/corpus/sanJoseProviderCorpusManifest.ts',
      'src/domain/field/corpus/types.ts',
    ].map((path) => path.replace(/\//g, '\\')),
  )
  return findSourceFiles(srcRoot)
    .filter((filePath) => {
      const relativePath = relative(process.cwd(), filePath)
      return !allowed.has(relativePath)
    })
    .filter((filePath) => readFileSync(filePath, 'utf8').includes('sanJoseProviderCorpus'))
    .map(normalizePath)
}

function validatePromotion(): void {
  globalThis.fetch = fetchTrap
  const generatedPath = sanJoseProviderCorpusManifest.promotedCorpusPath
  assert(existsSync(generatedPath), `Generated corpus missing: ${generatedPath}`)

  const { artifact, serialized: sourceSerialized } = readSourceArtifact()
  const promoted = promoteProviderCorpus({
    artifact,
    sourceRunId: sanJoseProviderCorpusManifest.sourceRunId,
    staticVenues: curatedVenues,
  })
  const promotedSerialized = stableStringifyPromotedProviderCorpus(promoted)
  const generatedSerialized = readFileSync(generatedPath, 'utf8')
  const generatedJson = JSON.parse(generatedSerialized) as PromotedFieldProviderCorpus
  const validation = validatePromotedFieldProviderCorpus(generatedJson)
  assert(validation.valid, `Generated corpus validation failed: ${validation.errors.join('; ')}`)
  assert(
    generatedSerialized === promotedSerialized,
    'Generated corpus must be deterministic from the source artifact.',
  )
  assert(
    sha256(sourceSerialized) === sanJoseProviderCorpusManifest.sourceArtifactSha256,
    'Source artifact hash must match manifest.',
  )
  assert(
    sha256(generatedSerialized) === sanJoseProviderCorpusManifest.promotedCorpusSha256,
    'Promoted corpus hash must match manifest.',
  )
  assert(!generatedSerialized.includes('"rawPlace"'), 'Promoted corpus must not include rawPlace.')
  assert(!/AIza[0-9A-Za-z_-]{20,}/.test(generatedSerialized), 'Promoted corpus contains key-like value.')
  assert(sanJoseProviderCorpus.venueCount === generatedJson.venueCount, 'Typed wrapper venue count mismatch.')

  const sourceSuppressedCount = artifact.venues.filter(
    (venue) => venue.normalizedVenue.source.qualityGateStatus === 'suppressed',
  ).length
  assert(
    generatedJson.excluded.suppressedVenueCount === sourceSuppressedCount,
    'Suppressed exclusion count must match source artifact.',
  )
  assert(
    generatedJson.venues.every((venue) => venue.qualityGateStatus !== 'suppressed'),
    'Suppressed venues must not be promoted.',
  )
  assert(
    generatedJson.venues.some((venue) => venue.qualityGateStatus === 'approved') &&
      generatedJson.venues.some((venue) => venue.qualityGateStatus === 'demoted'),
    'Approved and demoted venues must both remain eligible.',
  )

  const paperPlane = generatedJson.venues.find((venue) => venue.venue.name === 'Paper Plane')
  assert(paperPlane?.id === 'sj-paper-plane', 'Paper Plane must promote as sj-paper-plane.')
  assert(
    paperPlane.providerProvenance.providerRecordId === 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
    'Paper Plane provider id must remain provenance.',
  )
  assert(
    paperPlane.venue.source.providerRecordId === paperPlane.providerProvenance.providerRecordId,
    'Provider id must be preserved in source provenance.',
  )
  assert(
    paperPlane.providerProvenance.originalVenueId.startsWith('live_google_'),
    'Original live_google id must remain provenance only.',
  )
  assert(
    paperPlane.venueAudit.demotionReasons.includes(OFFLINE_CORPUS_TIME_SENSITIVE_AUDIT_REASON),
    'Paper Plane audit demotion reason must be preserved.',
  )
  assert(
    paperPlane.venue.source.bearingsValidationRequirements?.includes(
      RUNTIME_HOURS_VALIDATION_REQUIRED,
    ) === true,
    'Paper Plane Bearings runtime hours requirement must be preserved.',
  )

  const keyHits = findKeyLikeHits(join(process.cwd(), 'src', 'domain', 'field', 'corpus'))
  assert(keyHits.length === 0, `Key-like values found: ${keyHits.join(', ')}`)
  const runtimeImports = findRuntimeCorpusImports()
  assert(
    runtimeImports.length === 0,
    `Static provider corpus must not be wired into runtime yet: ${runtimeImports.join(', ')}`,
  )
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('field provider corpus promotion validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        keyHits,
        paperPlane: {
          id: paperPlane.id,
          originalVenueId: paperPlane.providerProvenance.originalVenueId,
          providerRecordId: paperPlane.providerProvenance.providerRecordId,
        },
        promotedCorpusSha256: sha256(generatedSerialized),
        promotedVenueCount: generatedJson.venueCount,
        runtimeImports,
        sourceArtifactSha256: sha256(sourceSerialized),
        suppressedVenueCount: generatedJson.excluded.suppressedVenueCount,
      },
      null,
      2,
    )}\n`,
  )
}

try {
  validatePromotion()
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
} finally {
  globalThis.fetch = originalFetch
}
