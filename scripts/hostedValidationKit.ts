import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const canonicalHostedValidationUrl =
  'https://id8-git-recovery-pre-demo-mode-cesars-projects-a637e718.vercel.app'

export const hostedValidationBranch = 'recovery/pre-demo-mode'
export const hostedValidationReason = 'Hosted Preview validation for recovery/pre-demo-mode'

export interface HostedValidationManifest {
  branch: string
  expectedHead: string
  deploymentRowTitle: string
  deploymentRowCommit: string
  deploymentStatus: string
  environment: string
  canonicalValidationUrl: string
  oneOffDeploymentUrl: string
  ignoredUrls: string[]
  reason: string
}

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

export function stripTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/g, '')
}

export function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  assert(Boolean(value), `${name} is required.`)
  return value
}

export function getHostedValidationUrl(): string {
  const url = stripTrailingSlash(readRequiredEnv('ID8_HOSTED_VALIDATION_URL'))
  assert(
    url === canonicalHostedValidationUrl,
    `ID8_HOSTED_VALIDATION_URL must be the canonical branch alias: ${canonicalHostedValidationUrl}`,
  )
  return url
}

export function buildHostedValidationManifest(): HostedValidationManifest {
  const targetUrl = getHostedValidationUrl()
  const expectedHead = readRequiredEnv('ID8_EXPECTED_HEAD')
  return {
    branch: hostedValidationBranch,
    expectedHead,
    deploymentRowTitle: 'Not queried by local kit',
    deploymentRowCommit: expectedHead,
    deploymentStatus: 'Not queried by local kit',
    environment: 'Preview',
    canonicalValidationUrl: canonicalHostedValidationUrl,
    oneOffDeploymentUrl: targetUrl === canonicalHostedValidationUrl ? 'none' : targetUrl,
    ignoredUrls: targetUrl === canonicalHostedValidationUrl ? ['one-off deployment URLs'] : [],
    reason: hostedValidationReason,
  }
}

export function printValidationManifest(manifest: HostedValidationManifest): void {
  process.stdout.write('VALIDATION MANIFEST\n')
  process.stdout.write(`- Branch: ${manifest.branch}\n`)
  process.stdout.write(`- Expected HEAD commit: ${manifest.expectedHead}\n`)
  process.stdout.write(`- Deployment row title: ${manifest.deploymentRowTitle}\n`)
  process.stdout.write(`- Deployment row commit: ${manifest.deploymentRowCommit}\n`)
  process.stdout.write(`- Deployment status: ${manifest.deploymentStatus}\n`)
  process.stdout.write(`- Environment: ${manifest.environment}\n`)
  process.stdout.write(`- Canonical validation URL: ${manifest.canonicalValidationUrl}\n`)
  process.stdout.write(`- One-off deployment URL, if relevant: ${manifest.oneOffDeploymentUrl}\n`)
  process.stdout.write(`- URLs explicitly ignored: ${manifest.ignoredUrls.join(', ') || 'none'}\n`)
  process.stdout.write(`- Reason for validation: ${manifest.reason}\n`)
}

export function listTrackedFiles(): string[] {
  try {
    return execFileSync('git', ['ls-files'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split(/\r?\n/g)
      .map((path) => path.trim())
      .filter(Boolean)
  } catch {
    return findFiles('.', new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css']))
  }
}

export function findFiles(root: string, extensions: Set<string>): string[] {
  if (!existsSync(root)) {
    return []
  }
  return readdirSync(root).flatMap((name) => {
    if (name === '.git' || name === 'node_modules') {
      return []
    }
    const fullPath = join(root, name)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      return findFiles(fullPath, extensions)
    }
    return extensions.has(fullPath.slice(fullPath.lastIndexOf('.'))) ? [fullPath] : []
  })
}

export function readTrackedTextFiles(): Array<{ path: string; source: string }> {
  return listTrackedFiles()
    .filter((path) => existsSync(path))
    .filter((path) => {
      const ext = path.slice(path.lastIndexOf('.'))
      return new Set([
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.json',
        '.md',
        '.html',
        '.css',
        '.txt',
        '.yml',
        '.yaml',
      ]).has(ext)
    })
    .map((path) => ({
      path: normalizePath(path),
      source: readFileSync(path, 'utf8'),
    }))
}
