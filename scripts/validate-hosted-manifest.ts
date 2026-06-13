import {
  assert,
  buildHostedValidationManifest,
  canonicalHostedValidationUrl,
  printValidationManifest,
} from './hostedValidationKit.js'

function main(): void {
  const manifest = buildHostedValidationManifest()
  printValidationManifest(manifest)
  assert(
    manifest.canonicalValidationUrl === canonicalHostedValidationUrl,
    'Canonical validation URL mismatch.',
  )
  assert(
    manifest.deploymentRowCommit === manifest.expectedHead,
    'Deployment row commit does not match expected HEAD.',
  )
  process.stdout.write('hosted validation manifest: passed\n')
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
