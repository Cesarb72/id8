import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
const liveSource = readFileSync('src/pages/LiveJourneyPage.tsx', 'utf8')

function assertIncludes(source: string, fragment: string, message: string): void {
  assert.ok(source.includes(fragment), message)
}

function assertExcludes(source: string, fragment: string, message: string): void {
  assert.ok(!source.includes(fragment), message)
}

assertIncludes(
  sandboxSource,
  'const publicSurpriseSelectableCardModels = useMemo',
  'Public Surprise must retain the ordered selectable projection.',
)
assertIncludes(
  sandboxSource,
  'const publicSurpriseSystemSelectedCardModel = useMemo',
  'Public Surprise must expose the system-selected card model seam.',
)
assertIncludes(
  sandboxSource,
  'return publicSurpriseSelectableCardModels[0] ?? null',
  'Public Surprise must consume the first existing selectable candidate in order.',
)
assertIncludes(
  sandboxSource,
  'publicSurpriseAutoSelectedArtifactIdRef.current === selectedArtifactId',
  'Public Surprise auto-selection must not repeatedly reselect the same artifact.',
)
assertIncludes(
  sandboxSource,
  'handleSelectStep2NightOption(publicSurpriseSystemSelectedCardModel.artifact)',
  'Public Surprise auto-selection must use the existing route option selection path.',
)
assertIncludes(
  sandboxSource,
  'selectedCandidateRouteArtifact ||\n      !publicSurpriseSystemSelectedCardModel',
  'Public Surprise auto-selection must preserve an existing selected candidate.',
)
assertIncludes(
  sandboxSource,
  'const publicSurpriseRouteChoiceVisible = false',
  'Public Surprise route-choice card visibility must be closed.',
)
assertIncludes(
  sandboxSource,
  'const publicSurpriseRouteChoiceRecoveryAvailable = false',
  'Public Surprise recovery must not reopen route-choice cards.',
)
assertIncludes(
  sandboxSource,
  'publicSurpriseSelectableCardModels.length === 0',
  'Public Surprise must preserve the zero-candidate honest empty state.',
)
assertIncludes(
  sandboxSource,
  'void generatePlan(selectedDirectionId, selectedCandidateRouteArtifact.id)',
  'Public Surprise generation must use the selected candidate artifact.',
)
assertIncludes(
  sandboxSource,
  'const handleTryAnotherDirection = useCallback',
  'Public Surprise must retain the Regenerate/Try Another handler.',
)
assertIncludes(
  sandboxSource,
  'setSelectedStep2CandidateArtifactId(nextCandidate.artifact.id)',
  'Regenerate must select the alternate artifact explicitly.',
)
assertIncludes(
  sandboxSource,
  'isPublicSurface && isSurpriseWrapperActive && !committedRevealReady',
  'Public Surprise Continue must stay gated by committed route readiness.',
)
assertIncludes(
  sandboxSource,
  '(!isPublicSurface || !isSurpriseWrapperActive || committedRevealReady)',
  'Public Surprise primary Continue action must require committed route readiness.',
)
assertIncludes(
  sandboxSource,
  'curatePrimaryCardDisplay.models.map((cardModel) => {',
  'Curate and Build route-card rendering must retain the existing card model path.',
)

assertExcludes(
  sandboxSource,
  'publicSurpriseSingleSelectableArtifact',
  'The one-candidate-only auto-selection seam must be removed.',
)
assertExcludes(
  sandboxSource,
  'Choose a route for tonight',
  'Public Surprise must not render route-choice prompt language.',
)
assertExcludes(
  sandboxSource,
  'Pick one route to keep the night moving.',
  'Public Surprise must not render route-choice instruction copy.',
)
assertExcludes(
  sandboxSource,
  '? publicSurpriseSelectableCardModels',
  'Public Surprise route-card render path must not depend on selectable card clicks.',
)

const r03ForbiddenFragments = [
  "setLiveAlertDecision('switch')",
  "liveAlertDecision === 'switch'",
  'patchFinalRouteStop',
  'Review swap options',
  'liveSwapPreview',
  'Use this instead',
]
for (const fragment of r03ForbiddenFragments) {
  assertExcludes(liveSource, fragment, `R-03 closure must remain intact: ${fragment}`)
}

process.stdout.write('R-01 public Surprise system selection proof: passed\n')
process.stdout.write('Provider calls: 0\n')
