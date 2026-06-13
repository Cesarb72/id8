import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  assert,
  buildHostedValidationManifest,
  printValidationManifest,
  readTrackedTextFiles,
  readVercelBypassSecretValues,
} from './hostedValidationKit.js'

const forbiddenClientPatterns = [
  'VITE_GOOGLE_PLACES_API_KEY',
  'VITE_PROVIDER_API_KEY',
  'places.googleapis.com',
  'X-Goog-Api-Key',
  'X-Goog-FieldMask',
] as const

const allowedServerOnlyFiles = new Set([
  'api/field/_lib/fieldTextSearchProvider.ts',
])

function isClientOrBundlePath(path: string): boolean {
  return (
    path.startsWith('src/') ||
    path.startsWith('dist/') ||
    path.endsWith('.html') ||
    path.endsWith('.css')
  )
}

function isDocsPath(path: string): boolean {
  return path.endsWith('.md') || path.includes('/docs/')
}

function scanForbiddenClientPatterns(files: Array<{ path: string; source: string }>): string[] {
  const hits: string[] = []
  for (const file of files) {
    for (const pattern of forbiddenClientPatterns) {
      if (!file.source.includes(pattern)) {
        continue
      }
      if (allowedServerOnlyFiles.has(file.path)) {
        continue
      }
      if (isDocsPath(file.path) && !isClientOrBundlePath(file.path)) {
        process.stdout.write(`docs reference reported separately: ${file.path}:${pattern}\n`)
        continue
      }
      if (isClientOrBundlePath(file.path) || file.path.startsWith('api/')) {
        hits.push(`${file.path}:${pattern}`)
      }
    }
  }
  return hits
}

function scanSecretLiterals(files: Array<{ path: string; source: string }>): string[] {
  const hits: string[] = []
  const bypassSecrets = readVercelBypassSecretValues()
  const googleApiKeyPattern = /AIza[0-9A-Za-z_-]{35}/g
  const vercelTokenPattern = /\bvercel_[0-9A-Za-z]{20,}\b/g
  const upstashTokenAssignmentPattern = /\b(?:KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)\s*[:=]\s*['"]?([A-Za-z0-9._-]{24,})/g

  for (const file of files) {
    for (const bypassSecret of bypassSecrets) {
      if (file.source.includes(bypassSecret)) {
        hits.push(`${file.path}:<redacted Vercel bypass secret>`)
      }
    }
    if (googleApiKeyPattern.test(file.source)) {
      hits.push(`${file.path}:<redacted Google API key pattern>`)
    }
    googleApiKeyPattern.lastIndex = 0
    if (vercelTokenPattern.test(file.source)) {
      hits.push(`${file.path}:<redacted Vercel token pattern>`)
    }
    vercelTokenPattern.lastIndex = 0
    for (const match of file.source.matchAll(upstashTokenAssignmentPattern)) {
      const tokenLikeValue = match[1] ?? ''
      const lower = tokenLikeValue.toLowerCase()
      const isPlaceholder =
        lower.includes('test') ||
        lower.includes('placeholder') ||
        lower.includes('example') ||
        lower.includes('not-a-provider-key')
      if (!isPlaceholder) {
        hits.push(`${file.path}:<redacted Upstash token-like assignment>`)
      }
    }
  }

  return hits
}

function readBuiltOutputFiles(root = 'dist'): Array<{ path: string; source: string }> {
  if (!existsSync(root)) {
    return []
  }
  return readdirSync(root).flatMap((name) => {
    const fullPath = join(root, name)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      return readBuiltOutputFiles(fullPath)
    }
    if (!['.js', '.html', '.css'].some((extension) => fullPath.endsWith(extension))) {
      return []
    }
    return [
      {
        path: fullPath.replace(/\\/g, '/'),
        source: readFileSync(fullPath, 'utf8'),
      },
    ]
  })
}

function main(): void {
  const manifest = buildHostedValidationManifest()
  printValidationManifest(manifest)
  const files = [...readTrackedTextFiles(), ...readBuiltOutputFiles()]

  assert(!files.some((file) => file.path === '.env.local'), '.env.local must not be tracked.')

  const clientHits = scanForbiddenClientPatterns(files)
  assert(
    clientHits.length === 0,
    `forbidden browser/provider patterns found: ${clientHits.join(', ')}`,
  )

  const secretHits = scanSecretLiterals(files)
  assert(secretHits.length === 0, `literal secret scan failed: ${secretHits.join(', ')}`)

  process.stdout.write('hosted no-browser Google / secret scan: passed\n')
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
