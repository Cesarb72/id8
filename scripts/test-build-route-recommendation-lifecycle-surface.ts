import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildRouteRecommendationLifecycleDiagnostics,
  isCandidateRouteLifecycleSurface,
} from '../src/app/services/routeRecommendationLifecycle'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(
    `Unexpected fetch in no-network route lifecycle surface test: ${String(args[0])}`,
  )
}) as typeof fetch

const repoRoot = process.cwd()
const sandboxSource = readFileSync(join(repoRoot, 'src/pages/SandboxConciergePage.tsx'), 'utf8')
const routeAuthoritySource = readFileSync(
  join(repoRoot, 'src/app/services/routeAuthority/routeAuthorityService.ts'),
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  join(repoRoot, 'src/domain/artifacts/runtimeRouteArtifact.ts'),
  'utf8',
)
const routeLifecycleSource = readFileSync(
  join(repoRoot, 'src/app/services/routeRecommendationLifecycle.ts'),
  'utf8',
)

const candidatePreview = buildRouteRecommendationLifecycleDiagnostics({
  routeSummarySource: 'candidate',
  routeSummaryProvenance: 'candidate_artifact',
  renderedRouteSource: 'none',
  generatedContractEntryArtifactPresent: false,
  finalRoutePresent: false,
  runtimeRouteArtifactPresent: false,
  greatStopStatus: null,
  greatStopFailureClassification: null,
  routeAuthorityStatus: 'invalid',
  lockInputAvailable: false,
  reviewEligible: true,
  lockEligible: true,
})

assert(
  isCandidateRouteLifecycleSurface({
    routeSummarySource: 'candidate',
    routeSummaryProvenance: 'candidate_artifact',
  }),
  'Candidate source/provenance must be detected as candidate preview.',
)
assert(candidatePreview.phase === 'candidate_preview', 'Candidate route must remain candidate_preview.')
assert(
  candidatePreview.userFacingLabel === 'Candidate preview - not a recommendation yet',
  'Candidate route must be labeled as preview, not generated recommendation.',
)
assert(
  candidatePreview.userFacingLabel !== 'Generated route summary',
  'Candidate route must not use the old Generated route summary label.',
)
assert(!candidatePreview.reviewEligible, 'Candidate preview must not be Review eligible.')
assert(!candidatePreview.lockEligible, 'Candidate preview must not be Lock eligible.')

const generationInput = buildRouteRecommendationLifecycleDiagnostics({
  routeSummarySource: 'committed',
  routeSummaryProvenance: 'generated_runtime_route',
  renderedRouteSource: 'none',
  generatedContractEntryArtifactPresent: false,
  finalRoutePresent: false,
  routeAuthorityStatus: 'invalid',
  lockInputAvailable: false,
  reviewEligible: false,
  lockEligible: false,
})
assert(
  generationInput.phase === 'generation_input',
  'Missing generated artifact/final route must not become generated_recommendation.',
)

const greatStopFailed = buildRouteRecommendationLifecycleDiagnostics({
  routeSummarySource: 'committed',
  routeSummaryProvenance: 'generated_runtime_route',
  renderedRouteSource: 'none',
  generatedContractEntryArtifactPresent: false,
  finalRoutePresent: false,
  greatStopStatus: 'FAIL',
  greatStopFailureClassification: 'HONEST_FAIL_GREAT_STOP',
  routeAuthorityStatus: 'invalid',
  lockInputAvailable: false,
})
assert(greatStopFailed.phase === 'great_stop_failed', 'Great Stop failure must expose great_stop_failed.')

const generatedRecommendation = buildRouteRecommendationLifecycleDiagnostics({
  routeSummarySource: 'committed',
  routeSummaryProvenance: 'generated_runtime_route',
  renderedRouteSource: 'canonicalRouteArtifact',
  generatedContractEntryArtifactPresent: true,
  finalRoutePresent: true,
  greatStopStatus: 'PASS',
  routeAuthorityStatus: 'invalid',
  lockInputAvailable: false,
  reviewEligible: true,
  lockEligible: false,
})
assert(
  generatedRecommendation.phase === 'generated_recommendation',
  'Great Stop PASS with generated artifact and final route may become generated_recommendation.',
)
assert(
  generatedRecommendation.userFacingLabel === 'Generated recommendation',
  'Generated recommendation label should remain available for generated truth.',
)

const authorityValid = buildRouteRecommendationLifecycleDiagnostics({
  routeSummarySource: 'committed',
  routeSummaryProvenance: 'generated_runtime_route',
  renderedRouteSource: 'canonicalRouteArtifact',
  generatedContractEntryArtifactPresent: true,
  finalRoutePresent: true,
  greatStopStatus: 'PASS',
  routeAuthorityStatus: 'valid',
  lockInputAvailable: true,
  reviewEligible: true,
  lockEligible: true,
})
assert(
  authorityValid.phase === 'authority_valid_lockable',
  'Authority-valid route with lock input must be authority_valid_lockable.',
)
assert(authorityValid.reviewEligible, 'Authority-valid route should preserve Review eligibility.')
assert(authorityValid.lockEligible, 'Authority-valid route should preserve Lock eligibility.')

const runtimeRoute = buildRouteRecommendationLifecycleDiagnostics({
  routeSummarySource: 'committed',
  routeSummaryProvenance: 'generated_runtime_route',
  renderedRouteSource: 'canonicalRouteArtifact',
  generatedContractEntryArtifactPresent: true,
  finalRoutePresent: true,
  runtimeRouteArtifactPresent: true,
  greatStopStatus: 'PASS',
  routeAuthorityStatus: 'valid',
  lockInputAvailable: true,
  reviewEligible: true,
  lockEligible: true,
})
assert(runtimeRoute.phase === 'runtime_route', 'RuntimeRouteArtifact post-lock must become runtime_route.')

assert(
  sandboxSource.includes('routeLifecycleDiagnostics: buildRouteLifecycleDiagnostics'),
  'Sandbox page must expose routeLifecycleDiagnostics in public Build diagnostics.',
)
assert(
  sandboxSource.includes('buildRouteLifecycleDiagnostics.userFacingLabel') &&
    routeLifecycleSource.includes('Candidate preview - not a recommendation yet'),
  'Sandbox page must render the lifecycle user-facing label supplied by the helper.',
)
assert(
  sandboxSource.includes('data-id8-route-lifecycle-phase'),
  'Sandbox page must expose route lifecycle phase on the route summary surface.',
)
assert(
  routeAuthoritySource.includes("reasons.push('provider_shadow_not_authority')"),
  'routeAuthority must still reject provider_shadow as non-authority.',
)
assert(
  runtimeRouteArtifactSource.includes('export interface RuntimeRouteArtifact') &&
    !runtimeRouteArtifactSource.includes('routeLifecycleDiagnostics'),
  'RuntimeRouteArtifact shape must remain unchanged and not absorb lifecycle diagnostics.',
)
assert(fetchCallCount === 0, 'No fetch calls should occur in lifecycle surface regression.')

const output = {
  candidatePreview,
  generationInput,
  greatStopFailed,
  generatedRecommendation,
  authorityValid,
  runtimeRoute,
  candidateRouteNotGeneratedRecommendation:
    candidatePreview.phase === 'candidate_preview' &&
    candidatePreview.userFacingLabel !== 'Generated route summary',
  candidateRouteReviewEligible: candidatePreview.reviewEligible,
  candidateRouteLockEligible: candidatePreview.lockEligible,
  generatedRecommendationPathAvailable:
    generatedRecommendation.phase === 'generated_recommendation',
  routeAuthorityUnchanged: routeAuthoritySource.includes(
    "reasons.push('provider_shadow_not_authority')",
  ),
  runtimeRouteArtifactShapeUnchanged: !runtimeRouteArtifactSource.includes(
    'routeLifecycleDiagnostics',
  ),
  providerShadowRemainsNonAuthoritative: routeAuthoritySource.includes(
    'provider_shadow_not_authority',
  ),
  fetchCallCount,
}

console.log(JSON.stringify(output, null, 2))
