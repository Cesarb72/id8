import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const nodeNextApiCompileFiles = [
  'api/field/text-search.ts',
  'api/field/_lib/fieldCacheKeys.ts',
  'api/field/_lib/fieldLedgerStore.ts',
  'api/field/_lib/fieldRequestValidation.ts',
  'api/field/_lib/fieldTextSearchProvider.ts',
  'src/domain/field/fieldProxyTypes.ts',
  'src/domain/providers/providerTypes.ts',
] as const

const forbiddenBrowserPatterns = [
  'places.googleapis.com',
  'VITE_GOOGLE_PLACES_API_KEY',
  'VITE_PROVIDER_API_KEY',
  'X-Goog-Api-Key',
  'X-Goog-FieldMask',
] as const

const forbiddenBundlePatterns = [
  ...forbiddenBrowserPatterns,
  'GOOGLE_PLACES_API_KEY',
] as const

const allowedServerGoogleKeyFiles = new Set([
  'api/field/_lib/fieldTextSearchProvider.ts',
])

const allowedServerProviderPatternFiles = new Set([
  'api/field/_lib/fieldTextSearchProvider.ts',
])

const allowedServerProviderPatterns = new Set([
  'places.googleapis.com',
  'X-Goog-Api-Key',
  'X-Goog-FieldMask',
])

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function findFiles(root: string, extensions: Set<string>): string[] {
  if (!existsSync(root)) {
    return []
  }
  return readdirSync(root).flatMap((name) => {
    const fullPath = join(root, name)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      return findFiles(fullPath, extensions)
    }
    return extensions.has(fullPath.slice(fullPath.lastIndexOf('.'))) ? [fullPath] : []
  })
}

function assertNoPatternInFiles(input: {
  files: string[]
  patterns: readonly string[]
  label: string
  allow?: (relativePath: string, pattern: string) => boolean
}): void {
  const hits: string[] = []
  for (const file of input.files) {
    const relativePath = normalizePath(relative(process.cwd(), file))
    const source = readFileSync(file, 'utf8')
    for (const pattern of input.patterns) {
      if (source.includes(pattern) && input.allow?.(relativePath, pattern) !== true) {
        hits.push(`${relativePath}:${pattern}`)
      }
    }
  }
  assert(hits.length === 0, `${input.label}: forbidden browser/provider patterns found: ${hits.join(', ')}`)
}

function assertNodeNextRelativeImportsUseJsExtensions(files: readonly string[]): void {
  const hits: string[] = []
  const relativeImportPattern = /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]|import\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(relativeImportPattern)) {
      const specifier = match[1] ?? match[2] ?? ''
      if (!specifier.endsWith('.js')) {
        hits.push(`${normalizePath(file)}:${specifier}`)
      }
    }
  }
  assert(
    hits.length === 0,
    `NodeNext API compile scan: relative imports must use .js extensions: ${hits.join(', ')}`,
  )
}

function main(): void {
  const sourceFiles = [
    ...findFiles('src', new Set(['.ts', '.tsx'])),
    ...findFiles('api', new Set(['.ts'])),
  ]
  assertNoPatternInFiles({
    files: sourceFiles,
    patterns: forbiddenBrowserPatterns,
    label: 'source scan',
    allow: (relativePath, pattern) =>
      allowedServerProviderPatterns.has(pattern) &&
      allowedServerProviderPatternFiles.has(relativePath),
  })
  assertNoPatternInFiles({
    files: sourceFiles,
    patterns: ['GOOGLE_PLACES_API_KEY'],
    label: 'server key source scan',
    allow: (relativePath) => allowedServerGoogleKeyFiles.has(relativePath),
  })
  assertNodeNextRelativeImportsUseJsExtensions(nodeNextApiCompileFiles)

  const providerAdapterSource = readFileSync('src/domain/providers/ProviderAdapter.ts', 'utf8')
  assert(
    !providerAdapterSource.includes('fetch('),
    'ProviderAdapter must not contain a direct browser fetch path.',
  )

  const distFiles = findFiles('dist', new Set(['.js', '.html', '.css']))
  if (distFiles.length > 0) {
    assertNoPatternInFiles({
      files: distFiles,
      patterns: forbiddenBundlePatterns,
      label: 'bundle scan',
    })
  }

  process.stdout.write('no browser Google Places path: passed\n')
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
