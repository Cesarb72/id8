import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GreatStopGateSelectionError,
  type GreatStopGateSelectionDiagnostics,
} from '../src/domain/types/greatStopGate'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = async () => {
  fetchCallCount += 1
  throw new Error('Network access is not allowed in this no-network regression.')
}

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

const failedDiagnostics: GreatStopGateSelectionDiagnostics = {
  status: 'FAIL',
  stage: 'pre_selection_gate',
  evaluatedCandidateCount: 4,
  passingCandidateCount: 0,
  failedTopCandidateCriteria: ['place_right', 'moment_right'],
  failureReasons: [
    'required_anchor_role_missing',
    'place_right:cluster_escape_limit_exceeded',
    'moment_right:no_strong_moment',
  ],
  bestFailingCandidateSummary: {
    candidateId: 'rank-1-thin-route',
    rank: 1,
    signature: 'Heritage Tea House -> Adega -> Jtown Matcha Kissaten',
    stopVenueIdsByRole: {
      start: 'sj-heritage-tea-house',
      highlight: 'sj-adega-wine-atelier',
      windDown: 'sj-jtown-matcha-kissaten',
    },
    requiredAnchorPreserved: false,
    requiredAnchorRoleCorrect: false,
    failedCriteria: ['place_right', 'moment_right'],
    reasons: ['required_anchor_role_missing', 'no_passing_great_stop_candidate'],
  },
}

const thrown = new GreatStopGateSelectionError(failedDiagnostics)
assert(
  thrown.greatStopGateSelectionDiagnostics === failedDiagnostics,
  'GreatStopGateSelectionError must carry structured diagnostics on the thrown error.',
)

const modeledPageBoundary = {
  generatedContractEntryArtifactProduced: false,
  finalRouteProduced: false,
  lockInputAvailable: false,
  routeAuthorityStatus: 'invalid',
  greatStopGateSelectionDiagnostics: thrown.greatStopGateSelectionDiagnostics,
  greatStopGateFailureClassification:
    thrown.greatStopGateSelectionDiagnostics.status === 'FAIL'
      ? 'HONEST_FAIL_GREAT_STOP'
      : null,
}

assert(
  modeledPageBoundary.greatStopGateSelectionDiagnostics.status === 'FAIL',
  'Page boundary model must preserve FAIL status.',
)
assert(
  modeledPageBoundary.greatStopGateSelectionDiagnostics.stage === 'pre_selection_gate',
  'Page boundary model must preserve the Great Stop selection stage.',
)
assert(
  modeledPageBoundary.greatStopGateSelectionDiagnostics.evaluatedCandidateCount === 4,
  'Page boundary model must preserve evaluated candidate count.',
)
assert(
  modeledPageBoundary.greatStopGateSelectionDiagnostics.passingCandidateCount === 0,
  'Page boundary model must preserve passing candidate count.',
)
assert(
  modeledPageBoundary.greatStopGateFailureClassification === 'HONEST_FAIL_GREAT_STOP',
  'Great Stop all-candidates-fail must be distinguishable from authority failure.',
)
assert(
  !modeledPageBoundary.generatedContractEntryArtifactProduced &&
    !modeledPageBoundary.finalRouteProduced &&
    !modeledPageBoundary.lockInputAvailable,
  'All-candidates-fail must not produce generated route truth or lock input.',
)
assert(
  modeledPageBoundary.routeAuthorityStatus === 'invalid',
  'Route authority must remain invalid when no generated route truth exists.',
)

assert(
  sandboxSource.includes('const greatStopGateDiagnostics = readGreatStopGateSelectionDiagnostics(nextError)'),
  'Sandbox catch path must read GreatStopGateSelectionDiagnostics from thrown errors.',
)
assert(
  sandboxSource.includes("greatStopGateDiagnostics != null\n              ? 'great_stop_gate'"),
  'Sandbox catch path must mark Great Stop gate as the generation failure source.',
)
assert(
  sandboxSource.includes('greatStopGateSelectionDiagnostics: greatStopGateDiagnostics'),
  'Sandbox catch path must preserve thrown GreatStopGateSelectionDiagnostics in page diagnostics state.',
)
assert(
  sandboxSource.includes("greatStopGateDiagnostics?.status === 'FAIL' ? 'HONEST_FAIL_GREAT_STOP' : null"),
  'Sandbox catch path must classify Great Stop all-fail as HONEST_FAIL_GREAT_STOP.',
)
assert(
  sandboxSource.includes('generationContractDebug?.greatStopGateSelectionDiagnostics'),
  'Public Build quality diagnostics must expose preserved GreatStopGateSelectionDiagnostics.',
)
assert(
  sandboxSource.includes('greatStopGateFailureClassification'),
  'Public Build quality diagnostics must expose the Great Stop failure classification.',
)
assert(
  sandboxSource.includes('Could not find a Great Stop route that passes'),
  'Visible failure text must remain wired to the Great Stop selection error.',
)

assert(
  routeAuthoritySource.includes('provider_shadow_not_authority'),
  'provider_shadow must remain non-authoritative.',
)
assert(
  !runtimeRouteArtifactSource.includes('greatStopGateSelectionDiagnostics') &&
    !runtimeRouteArtifactSource.includes('greatStopGateFailureClassification'),
  'RuntimeRouteArtifact shape must not absorb Great Stop failure diagnostics.',
)

const output = {
  greatStopGateSelectionDiagnosticsPreserved: true,
  status: modeledPageBoundary.greatStopGateSelectionDiagnostics.status,
  stage: modeledPageBoundary.greatStopGateSelectionDiagnostics.stage,
  evaluatedCandidateCount:
    modeledPageBoundary.greatStopGateSelectionDiagnostics.evaluatedCandidateCount,
  passingCandidateCount:
    modeledPageBoundary.greatStopGateSelectionDiagnostics.passingCandidateCount,
  failedTopCandidateCriteria:
    modeledPageBoundary.greatStopGateSelectionDiagnostics.failedTopCandidateCriteria,
  failureReasons: modeledPageBoundary.greatStopGateSelectionDiagnostics.failureReasons,
  bestFailingCandidateSummaryPresent:
    Boolean(modeledPageBoundary.greatStopGateSelectionDiagnostics.bestFailingCandidateSummary),
  classification: modeledPageBoundary.greatStopGateFailureClassification,
  generatedContractEntryArtifactProduced:
    modeledPageBoundary.generatedContractEntryArtifactProduced,
  finalRouteProduced: modeledPageBoundary.finalRouteProduced,
  lockInputAvailable: modeledPageBoundary.lockInputAvailable,
  routeAuthorityUnchanged: routeAuthoritySource.includes('provider_shadow_not_authority'),
  runtimeRouteArtifactShapeUnchanged:
    !runtimeRouteArtifactSource.includes('greatStopGateSelectionDiagnostics') &&
    !runtimeRouteArtifactSource.includes('greatStopGateFailureClassification'),
  providerShadowRemainsNonAuthoritative:
    routeAuthoritySource.includes('provider_shadow_not_authority'),
  fetchCallCount,
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
