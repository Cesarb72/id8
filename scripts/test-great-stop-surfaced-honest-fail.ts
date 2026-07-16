import { readFileSync } from 'node:fs'
import { buildGreatStopRecoverySurfaceModel } from '../src/app/services/greatStopRecoverySurface.ts'
import { buildRouteRecommendationLifecycleDiagnostics } from '../src/app/services/routeRecommendationLifecycle.ts'
import type { GreatStopGateSelectionDiagnostics } from '../src/domain/types/greatStopGate.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-great-stop-surfaced-honest-fail must not call fetch.')
}) as typeof fetch

function forcedDiagnostics(
  failedCriteria: GreatStopGateSelectionDiagnostics['failedTopCandidateCriteria'],
): GreatStopGateSelectionDiagnostics {
  return {
    status: 'FAIL',
    stage: 'pre_selection_gate',
    evaluatedCandidateCount: 40,
    failureReasons: ['place_right:forced_observer_failure'],
    failedTopCandidateCriteria: failedCriteria,
    bestFailingCandidateSummary: {
      candidateId: 'forced-great-stop-failure',
      rank: 1,
      signature: 'forced observer failure',
      stopVenueIdsByRole: {},
      failedCriteria: failedCriteria ?? [],
      reasons: ['place_right:forced_observer_failure'],
    },
    passingCandidateCount: 0,
  }
}

function lifecycleRow(mode: 'surprise' | 'build') {
  const diagnostics = forcedDiagnostics(
    mode === 'build' ? ['place_right'] : ['role_right', 'place_right'],
  )
  const recovery = buildGreatStopRecoverySurfaceModel({
    mode,
    diagnostics,
    failureClassification: 'HONEST_FAIL_GREAT_STOP',
  })
  const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
    routeSummarySource: 'candidate',
    routeSummaryProvenance: 'candidate_artifact',
    renderedRouteSource: 'none',
    generatedContractEntryArtifactPresent: false,
    finalRoutePresent: false,
    runtimeRouteArtifactPresent: false,
    greatStopStatus: diagnostics.status,
    greatStopFailureClassification: 'HONEST_FAIL_GREAT_STOP',
    routeAuthorityStatus: 'invalid',
    lockInputAvailable: false,
    reviewEligible: true,
    lockEligible: true,
  })

  assert(recovery.active, `${mode} recovery model must be active.`)
  assert(recovery.reasonCode === 'great_stop_failed', `${mode} reason must be great_stop_failed.`)
  assert(lifecycle.phase === 'great_stop_failed', `${mode} lifecycle must be Great Stop failed.`)
  assert(!lifecycle.reviewEligible, `${mode} review must remain suppressed.`)
  assert(!lifecycle.lockEligible, `${mode} lock must remain suppressed.`)
  assert(
    lifecycle.reasons.includes('great_stop_failed'),
    `${mode} lifecycle must carry great_stop_failed.`,
  )

  return {
    mode,
    greatStopResult: diagnostics.status,
    surfaceShown: recovery.active,
    honestReasonShown: recovery.reasonCode === 'great_stop_failed',
    recoveryStateShown: recovery.copy.includes('Try another option or regenerate'),
    reviewCtaSuppressed: !lifecycle.reviewEligible,
    lockSuppressed: !lifecycle.lockEligible,
    reasonCode: recovery.reasonCode,
    failedCriteria: recovery.failedCriteria,
    userFacingRecoveryReason: recovery.userFacingRecoveryReason,
    source: 'forced Great Stop selection diagnostics fixture',
    providerCalls: fetchCallCount,
  }
}

try {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')

  assert(
    sandboxSource.includes('publicCommittedRouteReady'),
    'publicCommittedRouteReady gate must exist.',
  )
  assert(
    sandboxSource.includes('publicCandidateOnlyPreviewActive'),
    'publicCandidateOnlyPreviewActive gate must exist.',
  )
  assert(
    sandboxSource.includes('publicSurpriseTruthGateSuppressPreview'),
    'publicSurpriseTruthGateSuppressPreview gate must exist.',
  )
  assert(
    sandboxSource.includes('publicBuildTruthGateSuppressPreview'),
    'publicBuildTruthGateSuppressPreview gate must exist.',
  )
  assert(
    !sandboxSource.includes('publicCurateTruthGateSuppressPreview'),
    'Curate public truth-gate suppression must not be invented in S3.',
  )
  assert(
    sandboxSource.includes('publicSurpriseGreatStopFailureRecoveryVisible'),
    'Surprise Great Stop failure must feed existing public truth gate.',
  )
  assert(
    sandboxSource.includes('publicBuildGreatStopFailureRecoveryVisible'),
    'Build Great Stop failure must feed existing public truth gate.',
  )
  assert(
    sandboxSource.includes('data-id8-great-stop-recovery-state="visible"') &&
      sandboxSource.includes('data-id8-great-stop-recovery-reason=') &&
      sandboxSource.includes('Great Stop route recovery'),
    'Great Stop recovery state must be surfaced with capturable attributes.',
  )
  assert(
    sandboxSource.includes('!publicGreatStopFailureRecoveryVisible'),
    'Generic error copy must not duplicate the Great Stop recovery surface.',
  )

  const rows = [lifecycleRow('surprise'), lifecycleRow('build')]
  assert(fetchCallCount === 0, `Expected zero provider/fetch calls, got ${fetchCallCount}.`)

  process.stdout.write(
    `${JSON.stringify(
      {
        observer: 'great_stop_surfaced_honest_fail',
        fixtureJustification:
          'Post-Slice-C Surprise/Curate no-provider paths are green; Build final evidence is provider-tap blocked, so observer forces Great Stop FAIL diagnostics.',
        providerCalls: fetchCallCount,
        failureStateBehavior: rows,
        reasonPropagation: rows.map((row) => ({
          mode: row.mode,
          reasonCode: row.reasonCode,
          failedCriterion: row.failedCriteria.join(',') || 'none',
          userFacingRecoveryReason: row.userFacingRecoveryReason,
          source: row.source,
        })),
        gateUsage: [
          {
            gate: 'publicCommittedRouteReady',
            existing: true,
            mode: 'surprise/build',
            usedByS3: true,
            notes: 'Keeps candidate-only recovery from presenting as committed truth.',
          },
          {
            gate: 'publicCandidateOnlyPreviewActive',
            existing: true,
            mode: 'surprise/build',
            usedByS3: true,
            notes: 'S3 suppression applies only to candidate previews.',
          },
          {
            gate: 'publicSurpriseTruthGateSuppressPreview',
            existing: true,
            mode: 'surprise',
            usedByS3: true,
            notes: 'Now includes publicSurpriseGreatStopFailureRecoveryVisible.',
          },
          {
            gate: 'publicBuildTruthGateSuppressPreview',
            existing: true,
            mode: 'build',
            usedByS3: true,
            notes: 'Now includes publicBuildGreatStopFailureRecoveryVisible.',
          },
          {
            gate: 'publicCurateTruthGateSuppressPreview',
            existing: false,
            mode: 'curate',
            usedByS3: false,
            notes: 'No Curate equivalent invented; requires C-suite scope decision.',
          },
        ],
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
}
