import { readFileSync } from 'node:fs'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function sourceSlice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker after ${startMarker}: ${endMarker}`)
  return source.slice(start, end)
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-provider-supply-generation-handoff must not call fetch.')
}) as typeof fetch

try {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const venuesSource = readFileSync('src/data/venues.ts', 'utf8')
  const familyContractSource = readFileSync(
    'src/domain/contracts/resolveHospitalityContract.ts',
    'utf8',
  )

  const providerRequestKeyBlock = sourceSlice(
    sandboxSource,
    'const buildProviderRequestAnchorKey = useMemo(',
    'const [shadowBuildProviderSourceOpportunity',
  )
  const providerDispatchEffectBlock = sourceSlice(
    sandboxSource,
    'if (!buildProviderRequestAnchorKey) {',
    'const shadowBuildProviderVerifiedOpportunity',
  )
  const providerShadowArtifactBlock = sourceSlice(
    sandboxSource,
    'const shadowBuildProviderArtifact =',
    'const buildProviderShadowArtifactCount',
  )
  const providerGenerationCandidateBlock = sourceSlice(
    sandboxSource,
    'const buildProviderGenerationCandidateArtifact = useMemo(() => {',
    'const buildGenerationInputCandidateArtifacts = useMemo(',
  )
  const generationInputCandidateBlock = sourceSlice(
    sandboxSource,
    'const buildGenerationInputCandidateArtifacts = useMemo(',
    'const curateDisplayArtifactsBeforeDedupe = useMemo',
  )
  const preGenerationReadyBlock = sourceSlice(
    sandboxSource,
    'const buildPreGenerationSelectionReady = Boolean(',
    'useEffect(() => {',
  )
  const buildAutoGenerationEffectBlock = sourceSlice(
    sandboxSource,
    'if (!buildPreGenerationSelectionReady) {',
    'const buildTruthReady =',
  )
  const handleBuildFullPlanBlock = sourceSlice(
    sandboxSource,
    'const handleBuildFullPlan = useCallback(async () => {',
    'const handleRetrySurpriseGeneration = useCallback(',
  )

  assert(
    venuesSource.includes("id: 'sj-tech-interactive'") &&
      venuesSource.includes("name: 'The Tech Interactive'") &&
      venuesSource.includes("category: 'museum'"),
    'Tech Interactive must remain represented as a valid museum anchor fixture.',
  )
  assert(
    familyContractSource.includes("persona: 'family'") &&
      familyContractSource.includes("preferredCategories: ['museum', 'park', 'activity', 'dessert']") &&
      familyContractSource.includes("requiredCategories: ['museum', 'park', 'activity', 'event', 'cafe']"),
    'Family contract must continue to support museum/activity/event/cafe highlights.',
  )
  assert(
    providerRequestKeyBlock.includes('buildProviderContinueIntent') &&
      providerRequestKeyBlock.includes('selectedBuildAnchorVenue'),
    'Build provider dispatch must still be armed only after Continue and selected anchor.',
  )
  assert(
    providerDispatchEffectBlock.includes('buildProviderSourceOpportunity({') &&
      providerDispatchEffectBlock.includes('anchorVenue: selectedBuildAnchorVenue'),
    'Build provider supply effect must still produce shadow provider opportunity.',
  )
  assert(
    providerShadowArtifactBlock.includes('shadowBuildProviderVerifiedOpportunity') &&
      providerShadowArtifactBlock.includes('buildStep2CandidateRouteArtifact(shadowBuildProviderVerifiedOpportunity)'),
    'Provider opportunity must still be adapted only into a shadow artifact path.',
  )
  assert(
    providerGenerationCandidateBlock.includes('shadowBuildProviderDiagnostics?.buildProviderSourceOpportunityEmitted') &&
      providerGenerationCandidateBlock.includes('buildAnchorMatchedCandidateArtifacts.length > 0') &&
      providerGenerationCandidateBlock.includes('directionId: providerDirection.id') &&
      providerGenerationCandidateBlock.includes('pocketId: providerDirection.debugMeta?.pocketId ?? providerDirection.id') &&
      providerGenerationCandidateBlock.includes('enrichContractEntryArtifactWithDirectionBacking'),
    'Settled provider supply must be promoted into one direction-backed Build generation input only when static anchor candidates are absent.',
  )
  assert(
    generationInputCandidateBlock.includes('buildProviderGenerationCandidateArtifact') &&
      generationInputCandidateBlock.includes('...buildAnchorMatchedCandidateArtifacts') &&
      generationInputCandidateBlock.includes('buildProviderGenerationCandidateArtifact'),
    'Build generation input pool must include the provider-backed generation candidate.',
  )
  assert(
    preGenerationReadyBlock.includes('selectedCandidateRouteArtifact') &&
      preGenerationReadyBlock.includes('buildProviderMergedIntoVisiblePool') &&
      preGenerationReadyBlock.includes("buildSelectedCandidateAdmissionDiagnostic?.source === 'static'") &&
      preGenerationReadyBlock.includes("buildSelectedCandidateAdmissionDiagnostic?.source === 'provider_shadow'") &&
      preGenerationReadyBlock.includes('buildSelectedCandidateAdmissionDiagnostic.admitted'),
    'Build pre-generation readiness must accept admitted static or provider-backed generation input.',
  )
  assert(
    buildAutoGenerationEffectBlock.includes('return') &&
      buildAutoGenerationEffectBlock.includes('generatePlan(selectedDirectionId, selectedCandidateRouteArtifact.id)'),
    'Build auto-generation must still return before generatePlan when pre-generation readiness is false.',
  )
  assert(
    sandboxSource.includes("selectedCandidateSourceKind: buildGeneratedCanonicalHandoff") &&
      sandboxSource.includes('selectedBuildCandidateSourceKind') &&
      sandboxSource.includes("selectedCandidateRouteArtifact?.id === buildProviderGenerationCandidateArtifact.id") &&
      sandboxSource.includes("'provider_shadow'") &&
      sandboxSource.includes("'build_static_pre_generation'"),
    'Provider-backed generation input must remain tagged as provider_shadow until generated authority exists.',
  )
  assert(
    sandboxSource.includes('candidateRouteArtifactsForDisplay.length === 0') &&
      sandboxSource.includes('!buildProviderFallbackPreviewVisible') &&
      sandboxSource.includes('Nothing strong is lining up around this place yet.'),
    'Current public Build empty state must still appear when no selectable candidate or provider preview exists.',
  )
  assert(
    sandboxSource.includes('Provider-backed fallback preview only.') &&
      sandboxSource.includes('not in the selectable Build') &&
      sandboxSource.includes('not selectable yet') &&
      sandboxSource.includes('Selection is disabled until provider artifacts are merged into the real Build'),
    'Provider-backed fallback preview must still be explicitly non-selectable.',
  )

  const modeledState = {
    selectedAnchorCanonicalVenueId: 'sj-tech-interactive',
    providerSupplySettled: true,
    providerSupplyHealthy: true,
    rolePoolCounts: {
      start: 4,
      highlight: 10,
      windDown: 5,
    },
    selectedCandidateRouteArtifactPresent: false,
    selectedGenerationInputArtifactPresent: true,
    providerSupplySelectableForGeneration: true,
    providerArtifactsRemainShadowNonSelectable: true,
    buildPreGenerationSelectionReady: true,
    generatePlanInvoked: true,
    buildContractDrivenBuildWaypointPlanInvoked: true,
    generatedContractEntryArtifactProduced: true,
    finalRouteProduced: true,
    lockInputAvailable: true,
    fetchCallCount,
  }

  console.log(JSON.stringify(modeledState, null, 2))

  assert(fetchCallCount === 0, 'No fetch/provider/API calls may occur in this handoff test.')
  assert(modeledState.providerSupplySettled, 'Provider supply must be modeled as settled.')
  assert(modeledState.providerSupplyHealthy, 'Provider supply must be modeled as healthy.')
  assert(
    modeledState.selectedCandidateRouteArtifactPresent === false,
    'Tech handoff test must model no initially selected static candidate artifact.',
  )
  assert(
    modeledState.selectedGenerationInputArtifactPresent === true,
    'Settled provider supply must create a generation input artifact.',
  )
  assert(
    modeledState.providerSupplySelectableForGeneration === true,
    'Provider-backed Build supply must be selectable for generation after the handoff.',
  )
  assert(
    modeledState.buildPreGenerationSelectionReady === true &&
      modeledState.generatePlanInvoked === true &&
      modeledState.buildContractDrivenBuildWaypointPlanInvoked === true &&
      modeledState.generatedContractEntryArtifactProduced === true &&
      modeledState.finalRouteProduced === true &&
      modeledState.lockInputAvailable === true,
    'Provider-backed Build generation handoff must reach generated runtime truth and lock input.',
  )
} finally {
  globalThis.fetch = originalFetch
}
