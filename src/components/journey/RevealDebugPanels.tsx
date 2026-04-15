import type { GenerationTrace } from '../../domain/runGeneratePlan'
import type { StopExplainabilityDiagnostics } from '../../domain/types/diagnostics'
import type { Itinerary, UserStopRole } from '../../domain/types/itinerary'

interface RevealDebugPanelsProps {
  itinerary: Itinerary
  generationTrace: GenerationTrace
}

function formatRole(role: UserStopRole): string {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Wind Down'
}

function formatLiveStage(stage?: string): string {
  if (!stage) {
    return 'n/a'
  }
  return stage
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDebugValue(value: number | string | boolean | null): string {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no'
  }
  if (value === null) {
    return 'n/a'
  }
  return String(value)
}

function formatTasteHighlightTier(value: 1 | 2 | 3): string {
  if (value === 1) {
    return 'Tier 1 (signature)'
  }
  if (value === 2) {
    return 'Tier 2 (strong support)'
  }
  return 'Tier 3 (connector)'
}

function formatSpatialMode(value: 'walkable' | 'flexible'): string {
  return value === 'walkable' ? 'WALKABLE' : 'FLEXIBLE'
}

export function RevealDebugPanels({
  itinerary,
  generationTrace,
}: RevealDebugPanelsProps) {
  const getStopDebug = (
    role: UserStopRole,
  ): StopExplainabilityDiagnostics | undefined => generationTrace.stopExplainability?.[role]

  return (
    <div className="debug-stack">
      <div className="helper-note">
        <strong>Debug share summary:</strong> {itinerary.shareSummary}
      </div>

      {generationTrace.refinementOutcome && (
        <div className="helper-note-stack">
          <p className="helper-note">
            Refinement summary: {generationTrace.refinementOutcome.summaryMessage}
          </p>
          {generationTrace.refinementOutcome.primaryTargetRole && (
            <p className="helper-note">
              Refinement targeted {formatRole(generationTrace.refinementOutcome.primaryTargetRole)} first.
            </p>
          )}
          {!generationTrace.refinementOutcome.targetRoleExistedInVisiblePlan &&
            generationTrace.refinementOutcome.targetRoleSelectionReason && (
              <p className="helper-note">
                {generationTrace.refinementOutcome.targetRoleSelectionReason}
              </p>
            )}
        </div>
      )}

      <details className="debug-panel" open>
        <summary>Plan Debug Summary</summary>
        <div className="debug-grid">
          <p>Total venues: {generationTrace.totalVenueCount}</p>
          <p>Retrieved: {generationTrace.retrievedVenueCount}</p>
          <p>requestedSourceMode: {generationTrace.retrievalDiagnostics.liveSource.requestedMode}</p>
          <p>effectiveSourceMode: {generationTrace.retrievalDiagnostics.liveSource.effectiveMode}</p>
          <p>
            fallbackToCurated:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.fallbackToCurated ? 'yes' : 'no'}
          </p>
          <p>Role arcs: {generationTrace.candidateArcCount}</p>
          <p>
            preRankingAnchorRoleLock:{' '}
            {generationTrace.preRankingAnchorRoleLockTrace?.lockApplied ? 'applied' : 'not_applied'}
          </p>
          <p>
            preRankingAnchorRoleLockReason:{' '}
            {generationTrace.preRankingAnchorRoleLockTrace?.triggerReason ?? 'n/a'}
          </p>
          <p>
            preRankingAnchorRoleLockCandidateCount:{' '}
            {generationTrace.preRankingAnchorRoleLockTrace?.preLockCandidateCount ?? 'n/a'} to{' '}
            {generationTrace.preRankingAnchorRoleLockTrace?.postLockCandidateCount ?? 'n/a'}
          </p>
          <p>
            preRankingAnchorRoleLockFallbackReason:{' '}
            {generationTrace.preRankingAnchorRoleLockTrace?.fallbackReason ?? 'n/a'}
          </p>
          <p>strictShapeEnabled: {generationTrace.strictShapeEnabled ? 'yes' : 'no'}</p>
          <p>Fallback relaxation: {generationTrace.fallbackRelaxationLevel}</p>
          <p>estimatedTotalMinutes: {generationTrace.routePacing.estimatedTotalMinutes}</p>
          <p>estimatedTotalLabel: {generationTrace.routePacing.estimatedTotalLabel}</p>
          <p>routeFeelLabel: {generationTrace.routePacing.routeFeelLabel}</p>
          <p>totalRouteFriction: {generationTrace.routePacing.totalRouteFriction}</p>
          <p>spatialMode: {formatSpatialMode(generationTrace.spatialCoherence.mode)}</p>
          <p>spatialHomeCluster: {generationTrace.spatialCoherence.homeClusterId}</p>
          <p>spatialScore: {generationTrace.spatialCoherence.score}</p>
          <p>spatialJumpUsed: {generationTrace.spatialCoherence.jumpUsed ? 'yes' : 'no'}</p>
          <p>recommendedDistrictCount: {generationTrace.recommendedDistricts.length}</p>
          <p>topDistrictId: {generationTrace.topDistrictId ?? 'n/a'}</p>
          <p>selectedDistrictId: {generationTrace.selectedDistrictId}</p>
          <p>selectedDistrictLabel: {generationTrace.selectedDistrictLabel}</p>
          <p>selectedDistrictSource: {generationTrace.selectedDistrictSource}</p>
          <p>selectedDistrictConfidence: {generationTrace.selectedDistrictConfidence}</p>
          <p>categoryDiversityScore: {generationTrace.categoryDiversity.categoryDiversityScore}</p>
          <p>repeatedCategoryCount: {generationTrace.categoryDiversity.repeatedCategoryCount}</p>
          <p>
            categoryDiversityPenaltyApplied:{' '}
            {generationTrace.categoryDiversity.categoryDiversityPenaltyApplied ? 'yes' : 'no'}
          </p>
          <p>categoryDiversityPenalty: {generationTrace.categoryDiversity.categoryDiversityPenalty}</p>
          <p>surpriseInjected: {generationTrace.surpriseInjection.surpriseInjected ? 'yes' : 'no'}</p>
          <p>surpriseCandidateCount: {generationTrace.surpriseInjection.surpriseCandidateCount}</p>
          <p>
            surpriseCandidateTierBreakdown:{' '}
            {generationTrace.surpriseInjection.surpriseCandidateTierBreakdown.strong}/
            {generationTrace.surpriseInjection.surpriseCandidateTierBreakdown.nearStrong}
          </p>
          <p>generatedSurpriseArcCount: {generationTrace.surpriseInjection.generatedSurpriseArcCount}</p>
          <p>
            surpriseComparedTierBreakdown:{' '}
            {generationTrace.surpriseInjection.surpriseComparedTierBreakdown.strong}/
            {generationTrace.surpriseInjection.surpriseComparedTierBreakdown.nearStrong}
          </p>
          <p>surpriseGateProbability: {generationTrace.surpriseInjection.surpriseGateProbability}</p>
          <p>
            fallbackArcTrigger:{' '}
            {generationTrace.buildFallbackTrace?.primaryPathFailureReason ?? 'n/a'}
          </p>
          <p>
            fallbackArcTriggerStage:{' '}
            {generationTrace.buildFallbackTrace?.triggerStage ?? 'n/a'}
          </p>
          <p>
            fallbackArcType:{' '}
            {generationTrace.buildFallbackTrace?.selectedFallbackType ?? 'n/a'}
          </p>
          <p>
            fallbackArcSelectedScore:{' '}
            {generationTrace.buildFallbackTrace?.selectedFallbackScore ?? 'n/a'}
          </p>
          <p>
            fallbackArcCandidateCounts:{' '}
            {generationTrace.buildFallbackTrace
              ? `full ${generationTrace.buildFallbackTrace.fullArcCandidatesCount} | partial ${generationTrace.buildFallbackTrace.partialArcCandidatesCount} | single ${generationTrace.buildFallbackTrace.highlightOnlyCandidatesCount}`
              : 'n/a'}
          </p>
          <p>surpriseRejectedBySpatialCount: {generationTrace.surpriseInjection.surpriseRejectedBySpatialCount}</p>
          <p>surpriseRejectedBySpatialTier2Count: {generationTrace.surpriseInjection.surpriseRejectedBySpatialTier2Count}</p>
          <p>surpriseScoreDeltaVsBaseArc: {generationTrace.surpriseInjection.scoreDeltaVsBaseArc ?? 'n/a'}</p>
          <p>surpriseTradeoffThreshold: {generationTrace.surpriseInjection.tradeoffThreshold ?? 'n/a'}</p>
          <p>
            surpriseAcceptanceBonusApplied:{' '}
            {generationTrace.surpriseInjection.surpriseAcceptanceBonusApplied ? 'yes' : 'no'}
          </p>
          <p>surpriseAcceptanceBonusValue: {generationTrace.surpriseInjection.surpriseAcceptanceBonusValue}</p>
          <p>
            surpriseTradeoffThresholdBlocked:{' '}
            {generationTrace.surpriseInjection.tradeoffThresholdBlocked ? 'yes' : 'no'}
          </p>
          <p>Geo penalty applied: {generationTrace.geoPenaltyApplied ? 'yes' : 'no'}</p>
          <p>Duplicate penalty applied: {generationTrace.duplicateCategoryPenaltyApplied ? 'yes' : 'no'}</p>
          <p>boundaryInvoked: {generationTrace.boundaryDiagnostics.boundaryInvoked ? 'yes' : 'no'}</p>
          <p>boundary candidateArcCount: {generationTrace.boundaryDiagnostics.candidateArcCount}</p>
          <p>winnerBeforeBoundary: {generationTrace.boundaryDiagnostics.winnerBeforeBoundary ?? 'n/a'}</p>
          <p>winnerAfterBoundary: {generationTrace.boundaryDiagnostics.winnerAfterBoundary ?? 'n/a'}</p>
          <p>finalProjectedWinner: {generationTrace.boundaryDiagnostics.finalProjectedWinner}</p>
          <p>
            finalProjectedMatchesPostBoundaryWinner:{' '}
            {generationTrace.boundaryDiagnostics.finalProjectedMatchesPostBoundaryWinner
              ? 'yes'
              : 'no'}
          </p>
          <p>boundaryChangedWinner: {generationTrace.boundaryDiagnostics.boundaryChangedWinner ? 'yes' : 'no'}</p>
          <p>changedOrderCount: {generationTrace.boundaryDiagnostics.changedOrderCount}</p>
          <p>averageRankDelta: {generationTrace.boundaryDiagnostics.averageRankDelta}</p>
          <p>topCandidateOverlapPct: {generationTrace.boundaryDiagnostics.topCandidateOverlapPct}%</p>
          <p>boundaryContributionLevel: {generationTrace.boundaryDiagnostics.boundaryContributionLevel}</p>
          {generationTrace.boundaryDiagnostics.refinementNudgeTrace && (
            <>
              <p>
                boundaryRefinementTokens:{' '}
                {generationTrace.boundaryDiagnostics.refinementNudgeTrace.requestedTokens.join(', ') || 'n/a'}
              </p>
              <p>
                boundaryRefinementAdjustedCandidates:{' '}
                {generationTrace.boundaryDiagnostics.refinementNudgeTrace.adjustedCandidateCount}
              </p>
              <p>
                boundaryRefinementNudgeRange:{' '}
                {generationTrace.boundaryDiagnostics.refinementNudgeTrace.minAdjustment} to{' '}
                {generationTrace.boundaryDiagnostics.refinementNudgeTrace.maxAdjustment}
              </p>
              <p>
                boundaryRefinementAverageNudge:{' '}
                {generationTrace.boundaryDiagnostics.refinementNudgeTrace.averageAdjustment}
              </p>
              <p>
                boundaryRefinementHostVocabularyApplied:{' '}
                {generationTrace.boundaryDiagnostics.refinementNudgeTrace.hostVocabularyMappingApplied
                  ? 'yes'
                  : 'no'}
              </p>
            </>
          )}
          {generationTrace.refinementOutcome && (
            <>
              <p>previousArcId: {generationTrace.refinementOutcome.previousArcId ?? 'n/a'}</p>
              <p>nextArcId: {generationTrace.refinementOutcome.nextArcId}</p>
              <p>previousItineraryId: {generationTrace.refinementOutcome.previousItineraryId ?? 'n/a'}</p>
              <p>nextItineraryId: {generationTrace.refinementOutcome.nextItineraryId ?? 'n/a'}</p>
              <p>refinement outcome: {generationTrace.refinementOutcome.outcomeType}</p>
              <p>refinement path result: {generationTrace.refinementOutcome.pathResult}</p>
              <p>primaryTargetRole: {generationTrace.refinementOutcome.primaryTargetRole ?? 'n/a'}</p>
              <p>targetedRoles: {generationTrace.refinementOutcome.targetedRoles.join(', ') || 'n/a'}</p>
              <p>
                targetRoleExistedInVisiblePlan:{' '}
                {generationTrace.refinementOutcome.targetRoleExistedInVisiblePlan ? 'yes' : 'no'}
              </p>
              <p>
                targetRoleSelectionReason:{' '}
                {generationTrace.refinementOutcome.targetRoleSelectionReason || 'n/a'}
              </p>
              <p>targetedCandidateCount: {generationTrace.refinementOutcome.targetedCandidateCount}</p>
              <p>
                targetedChangeSucceeded:{' '}
                {generationTrace.refinementOutcome.targetedChangeSucceeded ? 'yes' : 'no'}
              </p>
              <p>
                fullPlanFallbackUsed:{' '}
                {generationTrace.refinementOutcome.fullPlanFallbackUsed ? 'yes' : 'no'}
              </p>
              <p>changedStopCount: {generationTrace.refinementOutcome.changedStopCount}</p>
              <p>
                materiallyChangedStopCount:{' '}
                {generationTrace.refinementOutcome.materiallyChangedStopCount}
              </p>
              <p>sameResult: {generationTrace.refinementOutcome.sameResult ? 'yes' : 'no'}</p>
              <p>escalationUsed: {generationTrace.refinementOutcome.escalationUsed ? 'yes' : 'no'}</p>
              <p>
                winnerInertiaDetected:{' '}
                {generationTrace.refinementOutcome.winnerInertiaDetected ? 'yes' : 'no'}
              </p>
              <p>
                winnerInertiaReduced:{' '}
                {generationTrace.refinementOutcome.winnerInertiaReduced ? 'yes' : 'no'}
              </p>
            </>
          )}
        </div>

        {generationTrace.boundaryDiagnostics.warnings.length > 0 && (
          <div className="debug-subsection">
            <p className="debug-label">Boundary warnings</p>
            {generationTrace.boundaryDiagnostics.warnings.map((note) => (
              <p key={`boundary_warning_${note}`} className="debug-line">
                - {note}
              </p>
            ))}
          </div>
        )}

        <div className="debug-subsection">
          <p className="debug-label">Boundary order trace</p>
          <p className="debug-line">
            candidateIdsPassed: {generationTrace.boundaryDiagnostics.candidateIdsPassed.join(', ') || 'n/a'}
          </p>
          <p className="debug-line">
            preBoundaryOrder: {generationTrace.boundaryDiagnostics.preBoundaryOrder.join(', ') || 'n/a'}
          </p>
          <p className="debug-line">
            postBoundaryOrder: {generationTrace.boundaryDiagnostics.postBoundaryOrder.join(', ') || 'n/a'}
          </p>
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Pre-boundary top candidates</p>
          {generationTrace.boundaryDiagnostics.preBoundarySnapshot.map((candidate) => (
            <div key={`pre_${candidate.candidateId}`} className="debug-candidate">
              <p className="debug-line">
                {candidate.candidateId} | score {candidate.preBoundaryScore}
              </p>
              <p className="debug-line">stops: {JSON.stringify(candidate.stopIdsByRole)}</p>
              <p className="debug-line">categories: {candidate.categoryComposition.join(', ')}</p>
              <p className="debug-line">{candidate.diversitySummary}</p>
            </div>
          ))}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Post-boundary ranked candidates</p>
          {generationTrace.boundaryDiagnostics.postBoundarySnapshot.map((candidate) => (
            <div key={`post_${candidate.candidateId}`} className="debug-candidate">
              <p className="debug-line">
                #{candidate.rank} {candidate.candidateId} | boundary score {candidate.boundaryScore}
              </p>
              <p className="debug-line">
                previousRank: {candidate.previousRank} | rankChanged:{' '}
                {candidate.rankChanged ? 'yes' : 'no'} | becameWinner:{' '}
                {candidate.becameWinner ? 'yes' : 'no'}
              </p>
              <p className="debug-line">
                baseScore: {candidate.boundaryBaseScore ?? 'n/a'} | refinementNudge:{' '}
                {candidate.boundaryRefinementNudge ?? 'n/a'} | tiebreaker:{' '}
                {candidate.boundaryTiebreaker ?? 'n/a'}
              </p>
              <p className="debug-line">
                refinementTokens: {candidate.boundaryRefinementTokens?.join(', ') || 'none'}
              </p>
              <p className="debug-line">stops: {JSON.stringify(candidate.stopIdsByRole)}</p>
            </div>
          ))}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Route pacing</p>
          <p className="debug-line">
            estimatedStopMinutes: {generationTrace.routePacing.estimatedStopMinutes}
          </p>
          <p className="debug-line">
            estimatedTransitionMinutes: {generationTrace.routePacing.estimatedTransitionMinutes}
          </p>
          <p className="debug-line">
            pacingPenaltyApplied:{' '}
            {generationTrace.routePacing.pacingPenaltyApplied ? 'yes' : 'no'}
          </p>
          <p className="debug-line">
            smoothProgressionRewardApplied:{' '}
            {generationTrace.routePacing.smoothProgressionRewardApplied ? 'yes' : 'no'}
          </p>
          {generationTrace.routePacing.pacingPenaltyReasons.map((reason) => (
            <p key={`pacing_penalty_${reason}`} className="debug-line">
              - {reason}
            </p>
          ))}
          {generationTrace.routePacing.smoothProgressionRewardReasons.map((reason) => (
            <p key={`pacing_reward_${reason}`} className="debug-line">
              + {reason}
            </p>
          ))}
          {generationTrace.routePacing.transitions.map((transition) => (
            <p
              key={`transition_${transition.fromVenueId}_${transition.toVenueId}`}
              className="debug-line"
            >
              {formatRole(transition.fromRole)} to {formatRole(transition.toRole)} | friction{' '}
              {transition.frictionScore} | {transition.estimatedTransitionMinutes} min |{' '}
              {transition.movementMode} | {transition.neighborhoodContinuity}
              {transition.notes.length > 0 ? ` | ${transition.notes.join(', ')}` : ''}
            </p>
          ))}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Spatial coherence</p>
          <p className="debug-line">
            mode: {formatSpatialMode(generationTrace.spatialCoherence.mode)} | homeCluster:{' '}
            {generationTrace.spatialCoherence.homeClusterId} | clustersVisited:{' '}
            {generationTrace.spatialCoherence.clustersVisited.join(', ')}
          </p>
          <p className="debug-line">
            score: {generationTrace.spatialCoherence.score} | bonus {generationTrace.spatialCoherence.spatialBonus} | penalty{' '}
            {generationTrace.spatialCoherence.spatialPenalty}
          </p>
          <p className="debug-line">
            jumpUsed: {generationTrace.spatialCoherence.jumpUsed ? 'yes' : 'no'} | sameClusterTransitions:{' '}
            {generationTrace.spatialCoherence.sameClusterTransitionCount} | clusterEscapes:{' '}
            {generationTrace.spatialCoherence.clusterEscapeCount} | repeatedEscapes:{' '}
            {generationTrace.spatialCoherence.repeatedClusterEscapeCount} | longTransitions:{' '}
            {generationTrace.spatialCoherence.longTransitionCount}
          </p>
          {generationTrace.spatialCoherence.notes.map((note) => (
            <p key={`spatial_note_${note}`} className="debug-line">
              - {note}
            </p>
          ))}
          {generationTrace.spatialCoherence.clusterAssignments.map((assignment) => (
            <p key={`spatial_cluster_${assignment.venueId}`} className="debug-line">
              {assignment.venueName} ({assignment.venueId}) | neighborhood {assignment.neighborhood} | cluster{' '}
              {assignment.clusterId}
            </p>
          ))}
          {generationTrace.spatialCoherence.transitions.map((transition) => (
            <div
              key={`spatial_transition_${transition.fromVenueId}_${transition.toVenueId}`}
              className="debug-candidate"
            >
              <p className="debug-line">
                {transition.fromClusterId} to {transition.toClusterId} | driveGap {transition.driveGap} | sameCluster:{' '}
                {transition.sameCluster ? 'yes' : 'no'} | jumpUsed: {transition.jumpUsed ? 'yes' : 'no'} | spatialDelta{' '}
                {transition.scoreDelta}
              </p>
              <p className="debug-line">
                neighborhoods: {transition.fromNeighborhood} to {transition.toNeighborhood}
              </p>
              {transition.notes.map((note) => (
                <p
                  key={`spatial_transition_note_${transition.fromVenueId}_${transition.toVenueId}_${note}`}
                  className="debug-line"
                >
                  - {note}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">District anchor</p>
          <p className="debug-line">
            {generationTrace.selectedDistrictLabel} ({generationTrace.selectedDistrictId})
          </p>
          <p className="debug-line">
            source: {generationTrace.selectedDistrictSource} | confidence:{' '}
            {generationTrace.selectedDistrictConfidence}
          </p>
          <p className="debug-line">
            reason: {generationTrace.selectedDistrictReason}
          </p>
        </div>

        <div className="debug-subsection">
          <p className="debug-label">District recommendations</p>
          <p className="debug-line">topDistrictId: {generationTrace.topDistrictId ?? 'n/a'}</p>
          {generationTrace.recommendedDistricts.length > 0 ? (
            generationTrace.recommendedDistricts.map((district) => (
              <div key={`district_recommendation_${district.districtId}`} className="debug-candidate">
                <p className="debug-line">
                  {district.label} ({district.districtId}) | score {district.score}
                </p>
                <p className="debug-line">
                  density {district.signals.density} | relevance {district.signals.relevance} | diversity{' '}
                  {district.signals.diversity} | energy {district.signals.energy}
                </p>
                <p className="debug-line">reason: {district.reason}</p>
              </div>
            ))
          ) : (
            <p className="debug-line">No district recommendations generated.</p>
          )}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Category diversity</p>
          <p className="debug-line">
            score: {generationTrace.categoryDiversity.categoryDiversityScore} | repeatedCategories:{' '}
            {generationTrace.categoryDiversity.repeatedCategoryCount} | penaltyApplied:{' '}
            {generationTrace.categoryDiversity.categoryDiversityPenaltyApplied ? 'yes' : 'no'} | penalty:{' '}
            {generationTrace.categoryDiversity.categoryDiversityPenalty}
          </p>
          {generationTrace.categoryDiversity.notes.length > 0 ? (
            generationTrace.categoryDiversity.notes.map((note) => (
              <p key={`category_diversity_${note}`} className="debug-line">
                - {note}
              </p>
            ))
          ) : (
            <p className="debug-line">No core-role category repetition detected.</p>
          )}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Surprise injection</p>
          <p className="debug-line">
            injected: {generationTrace.surpriseInjection.surpriseInjected ? 'yes' : 'no'} | strongCandidates:{' '}
            {generationTrace.surpriseInjection.surpriseCandidateTierBreakdown.strong} | nearStrongCandidates:{' '}
            {generationTrace.surpriseInjection.surpriseCandidateTierBreakdown.nearStrong} | totalCandidates:{' '}
            {generationTrace.surpriseInjection.surpriseCandidateCount} | generated4StopArcs:{' '}
            {generationTrace.surpriseInjection.generatedSurpriseArcCount} | gateProbability:{' '}
            {generationTrace.surpriseInjection.surpriseGateProbability}
          </p>
          <p className="debug-line">
            comparedTierBreakdown: {generationTrace.surpriseInjection.surpriseComparedTierBreakdown.strong}/
            {generationTrace.surpriseInjection.surpriseComparedTierBreakdown.nearStrong}
          </p>
          <p className="debug-line">
            rejectedBySpatial: {generationTrace.surpriseInjection.surpriseRejectedBySpatialCount} | rejectedBySpatialTier2:{' '}
            {generationTrace.surpriseInjection.surpriseRejectedBySpatialTier2Count}
          </p>
          <p className="debug-line">
            scoreDeltaVsBaseArc: {generationTrace.surpriseInjection.scoreDeltaVsBaseArc ?? 'n/a'} | tradeoffThreshold:{' '}
            {generationTrace.surpriseInjection.tradeoffThreshold ?? 'n/a'} | tradeoffBlocked:{' '}
            {generationTrace.surpriseInjection.tradeoffThresholdBlocked ? 'yes' : 'no'} | rejectedByScore:{' '}
            {generationTrace.surpriseInjection.rejectedByScoreCount}
          </p>
          <p className="debug-line">
            acceptanceBonusApplied:{' '}
            {generationTrace.surpriseInjection.surpriseAcceptanceBonusApplied ? 'yes' : 'no'} | acceptanceBonusValue:{' '}
            {generationTrace.surpriseInjection.surpriseAcceptanceBonusValue}
          </p>
          <p className="debug-line">
            selectionReason: {generationTrace.surpriseInjection.surpriseSelectionReason}
          </p>
          {generationTrace.surpriseInjection.surpriseTasteSignals && (
            <>
              <p className="debug-line">
                venue: {generationTrace.surpriseInjection.surpriseTasteSignals.venueName} (
                {generationTrace.surpriseInjection.surpriseTasteSignals.venueId})
              </p>
              <p className="debug-line">
                experientialFactor:{' '}
                {generationTrace.surpriseInjection.surpriseTasteSignals.experientialFactor} | noveltyWeight:{' '}
                {generationTrace.surpriseInjection.surpriseTasteSignals.noveltyWeight} | roleSuitability:{' '}
                {generationTrace.surpriseInjection.surpriseTasteSignals.roleSuitability}
              </p>
              {generationTrace.surpriseInjection.surpriseTasteSignals.supportingSignals.map((signal) => (
                <p key={`surprise_signal_${signal}`} className="debug-line">
                  - {signal}
                </p>
              ))}
            </>
          )}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Retrieval diagnostics</p>
          <p className="debug-line">totalSeed: {generationTrace.retrievalDiagnostics.stageCounts.totalSeed}</p>
          <p className="debug-line">
            curatedSeed: {generationTrace.retrievalDiagnostics.stageCounts.curatedSeed}
          </p>
          <p className="debug-line">
            finalCurated: {generationTrace.retrievalDiagnostics.stageCounts.finalCurated}
          </p>
          <p className="debug-line">
            finalLive: {generationTrace.retrievalDiagnostics.stageCounts.finalLive}
          </p>
          <p className="debug-line">active: {generationTrace.retrievalDiagnostics.stageCounts.active}</p>
          <p className="debug-line">
            qualityApproved: {generationTrace.retrievalDiagnostics.stageCounts.qualityApproved}
          </p>
          <p className="debug-line">
            qualityDemoted: {generationTrace.retrievalDiagnostics.stageCounts.qualityDemoted}
          </p>
          <p className="debug-line">
            qualitySuppressed: {generationTrace.retrievalDiagnostics.stageCounts.qualitySuppressed}
          </p>
          <p className="debug-line">
            liveFetched: {generationTrace.retrievalDiagnostics.stageCounts.liveFetched}
          </p>
          <p className="debug-line">
            liveMapped: {generationTrace.retrievalDiagnostics.stageCounts.liveMapped}
          </p>
          <p className="debug-line">
            liveNormalized: {generationTrace.retrievalDiagnostics.stageCounts.liveNormalized}
          </p>
          <p className="debug-line">
            liveApproved: {generationTrace.retrievalDiagnostics.stageCounts.liveApproved}
          </p>
          <p className="debug-line">
            liveDemoted: {generationTrace.retrievalDiagnostics.stageCounts.liveDemoted}
          </p>
          <p className="debug-line">
            liveSuppressed: {generationTrace.retrievalDiagnostics.stageCounts.liveSuppressed}
          </p>
          <p className="debug-line">
            liveHoursDemoted: {generationTrace.retrievalDiagnostics.stageCounts.liveHoursDemoted}
          </p>
          <p className="debug-line">
            liveHoursSuppressed: {generationTrace.retrievalDiagnostics.stageCounts.liveHoursSuppressed}
          </p>
          <p className="debug-line">cityMatch: {generationTrace.retrievalDiagnostics.stageCounts.cityMatch}</p>
          <p className="debug-line">geographyMatch: {generationTrace.retrievalDiagnostics.stageCounts.geographyMatch}</p>
          <p className="debug-line">lensStrict: {generationTrace.retrievalDiagnostics.stageCounts.lensStrict}</p>
          <p className="debug-line">lensSoft: {generationTrace.retrievalDiagnostics.stageCounts.lensSoft}</p>
          <p className="debug-line">finalRetrieved: {generationTrace.retrievalDiagnostics.stageCounts.finalRetrieved}</p>
          <p className="debug-line">
            neighborhoodPreferred: {generationTrace.retrievalDiagnostics.stageCounts.neighborhoodPreferred}
          </p>
          <p className="debug-line">
            dedupedMerged: {generationTrace.retrievalDiagnostics.stageCounts.dedupedMerged}
          </p>
          <p className="debug-line">
            dedupedLive: {generationTrace.retrievalDiagnostics.stageCounts.dedupedLive}
          </p>
          <p className="debug-line">
            liveFetchAttempted:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveFetchAttempted ? 'yes' : 'no'}
          </p>
          <p className="debug-line">
            liveFetchSucceeded:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveFetchSucceeded ? 'yes' : 'no'}
          </p>
          <p className="debug-line">
            debugSourceOverrideApplied:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.debugOverrideApplied ? 'yes' : 'no'}
          </p>
          <p className="debug-line">
            liveProvider: {generationTrace.retrievalDiagnostics.liveSource.provider ?? 'n/a'}
          </p>
          <p className="debug-line">
            queryLocationLabel:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.queryLocationLabel ?? 'n/a'}
          </p>
          <p className="debug-line">
            liveQueryCount: {generationTrace.retrievalDiagnostics.liveSource.queryCount}
          </p>
          <p className="debug-line">
            liveQueryTemplatesUsed:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveQueryTemplatesUsed.join(', ') || 'n/a'}
          </p>
          <p className="debug-line">
            liveQueryLabelsUsed:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveQueryLabelsUsed.join(', ') || 'n/a'}
          </p>
          <p className="debug-line">
            partialFailure:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.partialFailure ? 'yes' : 'no'}
          </p>
          <p className="debug-line">
            liveHoursDemotedCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveHoursDemotedCount}
          </p>
          <p className="debug-line">
            liveHoursSuppressedCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveHoursSuppressedCount}
          </p>
          <p className="debug-line">
            liveRetrievedCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRetrievedCount}
          </p>
          <p className="debug-line">
            hybridLiveCompetitiveCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.hybridLiveCompetitiveCount}
          </p>
          <p className="debug-line">
            liveHighlightCandidateCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveHighlightCandidateCount}
          </p>
          <p className="debug-line">
            liveRejectedByHighlightValidityCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRejectedByHighlightValidityCount}
          </p>
          <p className="debug-line">
            liveRejectedByRolePoolCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRejectedByRolePoolCount}
          </p>
          <p className="debug-line">
            liveLostInArcAssemblyCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveLostInArcAssemblyCount}
          </p>
          <p className="debug-line">
            liveLostInFinalWinnerCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveLostInFinalWinnerCount}
          </p>
          <p className="debug-line">
            liveCompetitivenessLiftApplied:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveCompetitivenessLiftApplied}
          </p>
          <p className="debug-line">
            liveTimeConfidenceAdjustedCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveTimeConfidenceAdjustedCount}
          </p>
          <p className="debug-line">
            liveTimeConfidencePenaltyByRole:{' '}
            start {generationTrace.retrievalDiagnostics.liveSource.liveTimeConfidencePenaltyByRole.start} | highlight{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveTimeConfidencePenaltyByRole.highlight} | surprise{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveTimeConfidencePenaltyByRole.surprise} | windDown{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveTimeConfidencePenaltyByRole.windDown}
          </p>
          <p className="debug-line">
            strongLiveCandidatesFilteredCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.strongLiveCandidatesFilteredCount}
          </p>
          <p className="debug-line">
            countsBySource: curated {generationTrace.retrievalDiagnostics.liveSource.countsBySource.curated}
            {' '}| live {generationTrace.retrievalDiagnostics.liveSource.countsBySource.live}
          </p>
          <p className="debug-line">
            selectedStopSources:{' '}
            {Object.entries(generationTrace.retrievalDiagnostics.liveSource.selectedStopSources)
              .map(([role, source]) => `${role}:${source}`)
              .join(', ') || 'n/a'}
          </p>
          <p className="debug-line">
            liveRolePoolCounts:{' '}
            start {generationTrace.retrievalDiagnostics.liveSource.liveRolePoolCounts.start} | highlight{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRolePoolCounts.highlight} | surprise{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRolePoolCounts.surprise} | windDown{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRolePoolCounts.windDown}
          </p>
          <p className="debug-line">
            liveRoleWinCounts:{' '}
            start {generationTrace.retrievalDiagnostics.liveSource.liveRoleWinCounts.start} | highlight{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRoleWinCounts.highlight} | surprise{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRoleWinCounts.surprise} | windDown{' '}
            {generationTrace.retrievalDiagnostics.liveSource.liveRoleWinCounts.windDown}
          </p>
          {Object.entries(generationTrace.retrievalDiagnostics.liveSource.strongestLiveByRole).map(
            ([role, entry]) => (
              <p key={`strongest_live_${role}`} className="debug-line">
                strongestLiveByRole {role}: {entry.venueName} ({entry.roleScore}) | {entry.qualityGateStatus} |{' '}
                {entry.likelyOpenForCurrentWindow ? 'likely-open' : 'time-uncertain'} | timeConfidence{' '}
                {entry.timeConfidence}
              </p>
            ),
          )}
          {Object.entries(
            generationTrace.retrievalDiagnostics.liveSource.strongestLiveLossReasonByRole,
          ).map(([role, reason]) => (
            <p key={`strongest_live_loss_${role}`} className="debug-line">
              strongestLiveLossReasonByRole {role}: {reason}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.sourceBalanceNotes.map((note) => (
            <p key={`source_balance_${note}`} className="debug-line">
              * {note}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.liveRoleIntentQueryNotes.map((note) => (
            <p key={`query_note_${note}`} className="debug-line">
              + {note}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.liveCandidatesByQuery.map((entry) => (
            <p key={`query_count_${entry.label}`} className="debug-line">
              query {entry.label} [{entry.roleHint}/{entry.template}]: fetched {entry.fetchedCount} | mapped {entry.mappedCount} | normalized {entry.normalizedCount} | approved {entry.approvedCount} | demoted {entry.demotedCount} | suppressed {entry.suppressedCount}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.liveLostToCuratedReason.map((note) => (
            <p key={`live_loss_${note}`} className="debug-line">
              - {note}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.failureReason && (
            <p className="debug-line">
              liveFailureReason: {generationTrace.retrievalDiagnostics.liveSource.failureReason}
            </p>
          )}
          <p className="debug-line">
            personaFilteredCount: {generationTrace.retrievalDiagnostics.personaFilteredCount}
          </p>
          <p className="debug-line">
            starterPackFilteredCount: {generationTrace.retrievalDiagnostics.starterPackFilteredCount}
          </p>
          <p className="debug-line">
            refinementFilteredCount: {generationTrace.retrievalDiagnostics.refinementFilteredCount}
          </p>
          <p className="debug-line">
            geographyFilteredCount: {generationTrace.retrievalDiagnostics.geographyFilteredCount}
          </p>
          <p className="debug-line">
            roleShapeEligibleCount: {generationTrace.retrievalDiagnostics.roleShapeEligibleCount}
          </p>
          <p className="debug-line">
            overPruned: {generationTrace.retrievalDiagnostics.overPruned ? 'yes' : 'no'}
          </p>
          <p className="debug-line">
            primaryVibeMatchCount:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.primaryVibeMatchCount}
          </p>
          <p className="debug-line">
            secondaryVibeMatchCount:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.secondaryVibeMatchCount}
          </p>
          <p className="debug-line">
            weakVibeInfluence:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.weakVibeInfluence ? 'yes' : 'no'}
          </p>
          <p className="debug-line">
            selectedHighlightVibeFit:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.selectedHighlightVibeFit ?? 'n/a'}
          </p>
          <p className="debug-line">
            selectedHighlightPackPressure:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.selectedHighlightPackPressure ?? 'n/a'}
          </p>
          <p className="debug-line">
            selectedHighlightPressureSource:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.selectedHighlightPressureSource ?? 'n/a'}
          </p>
          <p className="debug-line">
            selectedHighlightMusicSupport:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.selectedHighlightMusicSupport ?? 'n/a'}
          </p>
          <p className="debug-line">
            selectedSupportStopVibeFit:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.selectedSupportStopVibeFit ?? 'n/a'}
          </p>
          <p className="debug-line">
            routeShapeBiasApplied:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.routeShapeBiasApplied ?? 'n/a'}
          </p>
          <p className="debug-line">
            routeShapeBiasScore:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.routeShapeBiasScore ?? 'n/a'}
          </p>
          <p className="debug-line">
            selectedHighlightAdventureRead:{' '}
            {generationTrace.retrievalDiagnostics.vibeInfluence.selectedHighlightAdventureRead ?? 'n/a'}
          </p>
          {(generationTrace.retrievalDiagnostics.vibeInfluence.outdoorVsUrbanNotes ?? []).map((note) => (
            <p key={`adventure_note_${note}`} className="debug-line">
              - {note}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.excludedByQualityGate.map((venue) => (
            <p key={`quality_gate_${venue.venueId}`} className="debug-line">
              suppressed {venue.venueName} | {venue.sourceOrigin}
              {venue.provider ? `/${venue.provider}` : ''} | category {venue.normalizedCategory ?? 'n/a'}
              {' '}| confidence {venue.sourceConfidence} | completeness {venue.completenessScore} |{' '}
              {venue.reasons.join(', ')}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.errors.map((error) => (
            <p key={`live_error_${error}`} className="debug-line">
              - live error: {error}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.curatedVsLiveWinnerNotes.map((note) => (
            <p key={`live_winner_${note}`} className="debug-line">
              - {note}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.pruneNotes.map((note) => (
            <p key={`prune_${note}`} className="debug-line">
              - {note}
            </p>
          ))}
        </div>

        {(generationTrace.retrievalDiagnostics.tasteInterpretation.seedExamples.length > 0 ||
          generationTrace.retrievalDiagnostics.tasteInterpretation.liveExamples.length > 0) && (
          <div className="debug-subsection">
            <p className="debug-label">Taste interpretation samples</p>
            {generationTrace.retrievalDiagnostics.tasteInterpretation.seedExamples.map((sample) => (
              <div key={`taste_seed_${sample.venueId}`} className="debug-candidate">
                <p className="debug-line">
                  {sample.venueName} ({sample.venueId}) | {sample.sourceType} |{' '}
                  {formatTasteHighlightTier(sample.highlightTier)}
                </p>
                <p className="debug-line">
                  energy {sample.energy} | socialDensity {sample.socialDensity} | intimacy{' '}
                  {sample.intimacy} | lingerFactor {sample.lingerFactor} | destinationFactor{' '}
                  {sample.destinationFactor} | experientialFactor {sample.experientialFactor} | conversation{' '}
                  {sample.conversationFriendliness}
                </p>
                <p className="debug-line">
                  roles start {sample.roleSuitability.start} | highlight {sample.roleSuitability.highlight} | surprise{' '}
                  {sample.roleSuitability.surprise} | windDown {sample.roleSuitability.windDown}
                </p>
                <p className="debug-line">
                  durationEstimate {sample.durationEstimate} | noveltyWeight {sample.noveltyWeight} | sourceMode{' '}
                  {sample.debug.sourceMode} | confidence {sample.debug.confidence}
                </p>
                <p className="debug-line">
                  signals: {sample.debug.supportingSignals.join(', ') || 'n/a'}
                </p>
              </div>
            ))}
            {generationTrace.retrievalDiagnostics.tasteInterpretation.liveExamples.map((sample) => (
              <div key={`taste_live_${sample.venueId}`} className="debug-candidate">
                <p className="debug-line">
                  {sample.venueName} ({sample.venueId}) | {sample.sourceType} |{' '}
                  {formatTasteHighlightTier(sample.highlightTier)}
                </p>
                <p className="debug-line">
                  energy {sample.energy} | socialDensity {sample.socialDensity} | intimacy{' '}
                  {sample.intimacy} | lingerFactor {sample.lingerFactor} | destinationFactor{' '}
                  {sample.destinationFactor} | experientialFactor {sample.experientialFactor} | conversation{' '}
                  {sample.conversationFriendliness}
                </p>
                <p className="debug-line">
                  roles start {sample.roleSuitability.start} | highlight {sample.roleSuitability.highlight} | surprise{' '}
                  {sample.roleSuitability.surprise} | windDown {sample.roleSuitability.windDown}
                </p>
                <p className="debug-line">
                  durationEstimate {sample.durationEstimate} | noveltyWeight {sample.noveltyWeight} | sourceMode{' '}
                  {sample.debug.sourceMode} | confidence {sample.debug.confidence}
                </p>
                <p className="debug-line">
                  signals: {sample.debug.supportingSignals.join(', ') || 'n/a'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="debug-subsection">
          <p className="debug-label">Live attrition trace</p>
          {generationTrace.retrievalDiagnostics.liveSource.liveAttritionTrace.stages.map((entry) => (
            <div key={`live_attrition_${entry.stage}`} className="debug-candidate">
              <p className="debug-line">
                {formatLiveStage(entry.stage)} | liveCount {entry.liveCount} | dropped {entry.droppedFromPrevious}
              </p>
              {entry.notes.map((note) => (
                <p key={`live_attrition_note_${entry.stage}_${note}`} className="debug-line">
                  - {note}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Strongest live vs curated by role</p>
          {Object.entries(generationTrace.retrievalDiagnostics.liveSource.roleCompetitionByRole).map(
            ([role, comparison]) => {
              if (!comparison) {
                return null
              }
              return (
                <div key={`role_comp_${role}`} className="debug-candidate">
                  <p className="debug-line">
                    {formatRole(role as UserStopRole)} | outcome {comparison.outcome} | liveLostAtStage{' '}
                    {formatLiveStage(comparison.strongestLiveLostAtStage)}
                  </p>
                  <p className="debug-line">
                    strongestLive:{' '}
                    {comparison.strongestLive
                      ? `${comparison.strongestLive.venueName} (${comparison.strongestLive.score.poolRankingScore})`
                      : 'n/a'}
                  </p>
                  <p className="debug-line">
                    strongestCurated:{' '}
                    {comparison.strongestCurated
                      ? `${comparison.strongestCurated.venueName} (${comparison.strongestCurated.score.poolRankingScore})`
                      : 'n/a'}
                  </p>
                  <p className="debug-line">
                    liveEnteredRolePool: {comparison.liveEnteredRolePool ? 'yes' : 'no'} | liveReachedArcAssembly:{' '}
                    {comparison.liveReachedArcAssembly ? 'yes' : 'no'} | liveWonFinalRoute:{' '}
                    {comparison.liveWonFinalRoute ? 'yes' : 'no'}
                  </p>
                  <p className="debug-line">
                    lossReason: {comparison.strongestLiveLossReason ?? 'n/a'}
                  </p>
                  {comparison.strongestLiveVsCuratedDelta.map((delta) => (
                    <p key={`role_comp_delta_${role}_${delta.key}`} className="debug-line">
                      {delta.label}: live {formatDebugValue(delta.liveValue)} | curated{' '}
                      {formatDebugValue(delta.curatedValue)} | favored {delta.favored} | {delta.explanation}
                    </p>
                  ))}
                  {comparison.arcScoreDelta.length > 0 && (
                    <>
                      <p className="debug-line">arc score comparison</p>
                      {comparison.arcScoreDelta.map((delta) => (
                        <p key={`role_arc_delta_${role}_${delta.key}`} className="debug-line">
                          {delta.label}: bestLiveArc {formatDebugValue(delta.liveValue)} | selectedWinner{' '}
                          {formatDebugValue(delta.curatedValue)} | favored {delta.favored} | {delta.explanation}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              )
            },
          )}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Curated dominance</p>
          <p className="debug-line">
            curatedDominanceDetected:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.curatedDominance.curatedDominanceDetected
              ? 'yes'
              : 'no'}
          </p>
          <p className="debug-line">
            curatedDominancePrimaryReason:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.curatedDominance.curatedDominancePrimaryReason}
          </p>
          {generationTrace.retrievalDiagnostics.liveSource.curatedDominance.repeatedCuratedWinnerPattern.map((item) => (
            <p key={`curated_pattern_${item}`} className="debug-line">
              - {item}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.curatedDominance.liveWouldNeedToImproveOn.map((item) => (
            <p key={`curated_improve_${item}`} className="debug-line">
              + liveWouldNeedToImproveOn {item}
            </p>
          ))}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Dedupe / novelty loss</p>
          <p className="debug-line">
            liveDedupedAgainstCuratedCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.dedupeNoveltyLoss.liveDedupedAgainstCuratedCount}
          </p>
          <p className="debug-line">
            liveNoveltyCollapsedCount:{' '}
            {generationTrace.retrievalDiagnostics.liveSource.dedupeNoveltyLoss.liveNoveltyCollapsedCount}
          </p>
          {generationTrace.retrievalDiagnostics.liveSource.dedupeNoveltyLoss.dedupeLossReason.map((reason) => (
            <p key={`dedupe_reason_${reason}`} className="debug-line">
              - {reason}
            </p>
          ))}
          {generationTrace.retrievalDiagnostics.liveSource.dedupeNoveltyLoss.strongestLiveDedupedExamples.map((loss) => (
            <div key={`dedupe_example_${loss.removedVenueId}_${loss.keptVenueId}`} className="debug-candidate">
              <p className="debug-line">
                removed {loss.removedVenueName} ({loss.removedSourceOrigin}) to kept {loss.keptVenueName} ({loss.keptSourceOrigin})
              </p>
              <p className="debug-line">
                duplicateReason: {loss.duplicateReason} | preferenceReason: {loss.preferenceReason}
              </p>
              <p className="debug-line">
                liveLostAgainstCurated: {loss.liveLostAgainstCurated ? 'yes' : 'no'} | liveNoveltyCollapsed:{' '}
                {loss.liveNoveltyCollapsed ? 'yes' : 'no'}
              </p>
            </div>
          ))}
        </div>

        <div className="debug-subsection">
          <p className="debug-label">Live trust breakdown</p>
          <p className="debug-line">top approved blockers</p>
          {generationTrace.retrievalDiagnostics.liveSource.liveTrustBreakdown.topApprovedBlockers.map((entry) => (
            <p key={`approved_blocker_${entry.reason}`} className="debug-line">
              - {entry.reason}: {entry.count}
            </p>
          ))}
          <p className="debug-line">top suppression reasons</p>
          {generationTrace.retrievalDiagnostics.liveSource.liveTrustBreakdown.topSuppressionReasons.map((entry) => (
            <p key={`suppression_reason_${entry.reason}`} className="debug-line">
              - {entry.reason}: {entry.count}
            </p>
          ))}
          <p className="debug-line">top dedupe reasons</p>
          {generationTrace.retrievalDiagnostics.liveSource.liveTrustBreakdown.topDedupeReasons.map((entry) => (
            <p key={`dedupe_breakdown_${entry.reason}`} className="debug-line">
              - {entry.reason}: {entry.count}
            </p>
          ))}

          {generationTrace.retrievalDiagnostics.liveSource.liveTrustBreakdown.strongestApprovalFailures.map((candidate) => (
            <div key={`approval_failure_${candidate.venueId}`} className="debug-candidate">
              <p className="debug-line">
                approval failure {candidate.venueName} | quality {candidate.qualityScore} | confidence {candidate.sourceConfidence} | completeness {candidate.completenessScore}
              </p>
              <p className="debug-line">
                signature {candidate.signatureScore} | generic {candidate.genericScore} | query {candidate.sourceQueryLabel ?? 'n/a'}
              </p>
              <p className="debug-line">blockers: {candidate.blockers.join(', ') || 'n/a'}</p>
              <p className="debug-line">helpedBy: {candidate.helpedBy.join(', ') || 'n/a'}</p>
              <p className="debug-line">hurtBy: {candidate.hurtBy.join(', ') || 'n/a'}</p>
            </div>
          ))}

          {generationTrace.retrievalDiagnostics.liveSource.liveTrustBreakdown.strongestSuppressedCandidates.map((candidate) => (
            <div key={`suppressed_failure_${candidate.venueId}`} className="debug-candidate">
              <p className="debug-line">
                suppressed {candidate.venueName} | quality {candidate.qualityScore} | confidence {candidate.sourceConfidence} | completeness {candidate.completenessScore}
              </p>
              <p className="debug-line">
                signature {candidate.signatureScore} | generic {candidate.genericScore} | query {candidate.sourceQueryLabel ?? 'n/a'}
              </p>
              <p className="debug-line">blockers: {candidate.blockers.join(', ') || 'n/a'}</p>
              <p className="debug-line">helpedBy: {candidate.helpedBy.join(', ') || 'n/a'}</p>
              <p className="debug-line">hurtBy: {candidate.hurtBy.join(', ') || 'n/a'}</p>
            </div>
          ))}
        </div>

        {generationTrace.faultIsolationNotes.length > 0 && (
          <div className="debug-subsection">
            <p className="debug-label">Fault isolation notes</p>
            {generationTrace.faultIsolationNotes.map((note) => (
              <p key={`fault_${note}`} className="debug-line">
                - {note}
              </p>
            ))}
          </div>
        )}

        {generationTrace.overlapDiagnostics && (
          <div className="debug-subsection">
            <p className="debug-label">Persona/pack overlap diagnostics</p>
            {generationTrace.overlapDiagnostics.scenarios.map((scenario) => (
              <div key={`overlap_scenario_${scenario.scenarioId}`} className="debug-candidate">
                <p className="debug-line">
                  {scenario.label} | mode {scenario.mode} | persona {scenario.persona}
                  {scenario.starterPackId ? ` | pack ${scenario.starterPackId}` : ''}
                </p>
                <p className="debug-line">
                  retrieved={scenario.retrievedVenueIds.length} | rolePool=
                  {scenario.rolePoolVenueIds.length} | topCandidates=
                  {scenario.topCandidateSignatures.length}
                </p>
                <p className="debug-line">winnerSignature: {scenario.winnerSignature}</p>
              </div>
            ))}
            {generationTrace.overlapDiagnostics.pairs.map((pair) => (
              <p
                key={`overlap_pair_${pair.leftScenarioId}_${pair.rightScenarioId}`}
                className="debug-line"
              >
                {pair.leftScenarioId} vs {pair.rightScenarioId} | retrieved{' '}
                {pair.retrievedVenueOverlapPct}% | rolePool {pair.rolePoolOverlapPct}% |
                topCandidates {pair.topCandidateOverlapPct}% | winner {pair.winnerOverlapPct}%
              </p>
            ))}
            {generationTrace.overlapDiagnostics.warnings.map((warning) => (
              <p key={`overlap_warning_${warning}`} className="debug-line">
                - {warning}
              </p>
            ))}
          </div>
        )}

        <div className="debug-subsection">
          <p className="debug-label">Role winner frequency (top ranked candidates)</p>
          {(Object.keys(generationTrace.roleWinnerFrequency) as UserStopRole[]).map((role) => (
            <div key={`role_winner_freq_${role}`} className="debug-candidate">
              <p className="debug-line">{formatRole(role)}</p>
              {(generationTrace.roleWinnerFrequency[role] ?? []).map((entry) => (
                <p key={`${role}_${entry.venueId}`} className="debug-line">
                  {entry.venueId}: {entry.wins} wins ({entry.winShare}%)
                  {entry.flaggedUniversal ? ' | universal' : ''}
                </p>
              ))}
            </div>
          ))}
        </div>

        {generationTrace.refinementOutcome?.winnerInertiaNotes.length ? (
          <div className="debug-subsection">
            <p className="debug-label">Winner inertia notes</p>
            {generationTrace.refinementOutcome.winnerInertiaNotes.map((note) => (
              <p key={`inertia_${note}`} className="debug-line">
                - {note}
              </p>
            ))}
          </div>
        ) : null}

        {generationTrace.starterPackInfluenceApplied &&
          generationTrace.starterPackInfluenceSummary.length > 0 && (
            <div className="debug-subsection">
              <p className="debug-label">Starter pack impact</p>
              {generationTrace.starterPackInfluenceSummary.map((item) => (
                <p key={item} className="debug-line">
                  {item}
                </p>
              ))}
            </div>
          )}
      </details>

      {itinerary.stops.map((stop) => {
        const debug = getStopDebug(stop.role)
        const pool = generationTrace.rolePoolDiagnostics[stop.role]
        const stopDelta = generationTrace.refinementOutcome?.stopDeltas.find(
          (delta) => delta.role === stop.role,
        )
        if (!debug || !pool) {
          return null
        }

        return (
          <details key={`debug_${stop.id}`} className="debug-panel">
            <summary>{stop.title} Debug</summary>
            <div className="debug-grid">
              <p>selectedBecause: {debug.selectedBecause}</p>
              <p>normalizedCategory: {debug.normalizedCategory}</p>
              <p>normalizedSubcategory: {debug.normalizedSubcategory}</p>
              <p>durationClass: {debug.durationClass}</p>
              <p>estimatedDurationMinutes: {debug.estimatedDurationMinutes}</p>
              <p>socialDensity: {debug.socialDensity}</p>
              <p>highlightCapability: {debug.highlightCapability}</p>
              <p>qualityGateStatus: {debug.qualityGateStatus}</p>
              <p>sourceOrigin: {debug.sourceOrigin}</p>
              <p>sourceProvider: {debug.sourceProvider ?? 'n/a'}</p>
              <p>sourceProviderRecordId: {debug.sourceProviderRecordId ?? 'n/a'}</p>
              <p>sourceQueryLabel: {debug.sourceQueryLabel ?? 'n/a'}</p>
              <p>
                openNow:{' '}
                {typeof debug.openNow === 'boolean' ? (debug.openNow ? 'yes' : 'no') : 'n/a'}
              </p>
              <p>hoursKnown: {debug.hoursKnown ? 'yes' : 'no'}</p>
              <p>
                likelyOpenForCurrentWindow:{' '}
                {debug.likelyOpenForCurrentWindow ? 'yes' : 'no'}
              </p>
              <p>businessStatus: {debug.businessStatus}</p>
              <p>timeConfidence: {debug.timeConfidence}</p>
              <p>hoursPressureLevel: {debug.hoursPressureLevel}</p>
              <p>
                hoursDemotionApplied: {debug.hoursDemotionApplied ? 'yes' : 'no'}
              </p>
              <p>
                hoursSuppressionApplied: {debug.hoursSuppressionApplied ? 'yes' : 'no'}
              </p>
              <p>sourceConfidence: {debug.sourceConfidence}</p>
              <p>completenessScore: {debug.completenessScore}</p>
              <p>normalizedFromRawType: {debug.normalizedFromRawType}</p>
              <p>ranking position: #{debug.roleRankingPosition}</p>
              <p>selection confidence: {debug.selectionConfidence}</p>
              <p>vibeAuthority: {debug.vibeAuthority ?? 'n/a'}</p>
              <p>highlightVibeFit: {debug.highlightVibeFit ?? 'n/a'}</p>
              <p>windDownVibeFit: {debug.windDownVibeFit ?? 'n/a'}</p>
              <p>highlightPackPressure: {debug.highlightPackPressure ?? 'n/a'}</p>
              <p>highlightPressureSource: {debug.highlightPressureSource ?? 'n/a'}</p>
              <p>musicSupportSource: {debug.musicSupportSource ?? 'n/a'}</p>
              <p>
                highlightValidForIntent:{' '}
                {typeof debug.highlightValidForIntent === 'boolean'
                  ? debug.highlightValidForIntent
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>highlightValidityLevel: {debug.highlightValidityLevel ?? 'n/a'}</p>
              <p>highlightCandidateTier: {debug.highlightCandidateTier ?? 'n/a'}</p>
              <p>highlightVetoReason: {debug.highlightVetoReason ?? 'n/a'}</p>
              <p>
                packLiteralRequirementSatisfied:{' '}
                {typeof debug.packLiteralRequirementSatisfied === 'boolean'
                  ? debug.packLiteralRequirementSatisfied
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>
                fallbackUsedBecauseNoValidHighlight:{' '}
                {typeof debug.fallbackUsedBecauseNoValidHighlight === 'boolean'
                  ? debug.fallbackUsedBecauseNoValidHighlight
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>bestValidHighlightChallenger: {debug.bestValidHighlightChallenger ?? 'n/a'}</p>
              <p>
                selectedHighlightViolatesIntent:{' '}
                {typeof debug.selectedHighlightViolatesIntent === 'boolean'
                  ? debug.selectedHighlightViolatesIntent
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>
                selectedHighlightIsFallback:{' '}
                {typeof debug.selectedHighlightIsFallback === 'boolean'
                  ? debug.selectedHighlightIsFallback
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>supportStopVibeFit: {debug.supportStopVibeFit ?? 'n/a'}</p>
              <p>supportStopVibeEffect: {debug.supportStopVibeEffect ?? 'n/a'}</p>
              <p>routeShapeBiasApplied: {debug.routeShapeBiasApplied ?? 'n/a'}</p>
              <p>outdoorVsUrbanRead: {debug.outdoorVsUrbanRead ?? 'n/a'}</p>
              <p>fallback used: {debug.fallbackUsed ? 'yes' : 'no'}</p>
              <p>fallback label: {debug.fallbackLabel}</p>
              <p>personaMatch: {debug.personaMatch}</p>
              <p>vibeMatch: {debug.vibeMatch}</p>
              <p>proximityMatch: {debug.proximityMatch}</p>
              <p>roleFit: {debug.roleScore}</p>
              <p>tasteInfluenceApplied: {debug.tasteInfluenceApplied ? 'yes' : 'no'}</p>
              <p>tasteBonus: {debug.tasteBonus ?? 'n/a'}</p>
              <p>
                tasteRoleSuitabilityContribution:{' '}
                {debug.tasteRoleSuitabilityContribution ?? 'n/a'}
              </p>
              <p>
                tasteHighlightPlausibilityBonus:{' '}
                {debug.tasteHighlightPlausibilityBonus ?? 'n/a'}
              </p>
              <p>lensCompatibility: {debug.lensCompatibility}</p>
              <p>contextSpecificity: {debug.contextSpecificity}</p>
              <p>dominancePenalty: {debug.dominancePenalty}</p>
              <p>universalityScore: {debug.universalityScore}</p>
              <p>universalWinnerFlag: {debug.universalWinnerFlag ? 'yes' : 'no'}</p>
              <p>
                moreContextSpecificChallengerExists:{' '}
                {debug.moreContextSpecificChallengerExists ? 'yes' : 'no'}
              </p>
              <p>rolePoolSize: {pool.rolePoolSize}</p>
              <p>strongCandidateCount: {pool.strongCandidateCount}</p>
              <p>categoryDiversityCount: {pool.categoryDiversityCount}</p>
              <p>topConfidenceBand: {pool.topConfidenceBand}</p>
              <p>weakPool: {pool.weakPool ? 'yes' : 'no'}</p>
              <p>weakPoolReason: {pool.weakPoolReason ?? 'n/a'}</p>
              <p>roleContractLabel: {pool.roleContractLabel ?? 'n/a'}</p>
              <p>roleContractStrength: {pool.roleContractStrength ?? 'n/a'}</p>
              <p>
                contractSatisfied:{' '}
                {typeof pool.contractSatisfied === 'boolean'
                  ? pool.contractSatisfied
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>
                contractRelaxed:{' '}
                {typeof pool.contractRelaxed === 'boolean'
                  ? pool.contractRelaxed
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>contractStrictCandidateCount: {pool.contractStrictCandidateCount ?? 'n/a'}</p>
              <p>contractRelaxedCandidateCount: {pool.contractRelaxedCandidateCount ?? 'n/a'}</p>
              <p>contractFallbackReason: {pool.contractFallbackReason ?? 'n/a'}</p>
              <p>bestContractCandidateId: {pool.bestContractCandidateId ?? 'n/a'}</p>
              <p>highlightValidCandidateCount: {pool.highlightValidCandidateCount ?? 'n/a'}</p>
              <p>highlightFallbackCandidateCount: {pool.highlightFallbackCandidateCount ?? 'n/a'}</p>
              <p>highlightInvalidCandidateCount: {pool.highlightInvalidCandidateCount ?? 'n/a'}</p>
              <p>
                fallbackUsedBecauseNoValidHighlight:{' '}
                {typeof pool.fallbackUsedBecauseNoValidHighlight === 'boolean'
                  ? pool.fallbackUsedBecauseNoValidHighlight
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>bestValidHighlightCandidateId: {pool.bestValidHighlightCandidateId ?? 'n/a'}</p>
              <p>bestValidHighlightChallengerId: {pool.bestValidHighlightChallengerId ?? 'n/a'}</p>
              <p>
                selectedContractSatisfied:{' '}
                {typeof pool.selectedContractSatisfied === 'boolean'
                  ? pool.selectedContractSatisfied
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>
                selectedViolatesContract:{' '}
                {typeof pool.selectedViolatesContract === 'boolean'
                  ? pool.selectedViolatesContract
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>selectedHighlightValidityLevel: {pool.selectedHighlightValidityLevel ?? 'n/a'}</p>
              <p>
                selectedHighlightValidForIntent:{' '}
                {typeof pool.selectedHighlightValidForIntent === 'boolean'
                  ? pool.selectedHighlightValidForIntent
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>
                selectedHighlightIsFallback:{' '}
                {typeof pool.selectedHighlightIsFallback === 'boolean'
                  ? pool.selectedHighlightIsFallback
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>
                selectedHighlightViolatesIntent:{' '}
                {typeof pool.selectedHighlightViolatesIntent === 'boolean'
                  ? pool.selectedHighlightViolatesIntent
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>selectedHighlightVetoReason: {pool.selectedHighlightVetoReason ?? 'n/a'}</p>
              <p>
                packLiteralRequirementSatisfied:{' '}
                {typeof pool.packLiteralRequirementSatisfied === 'boolean'
                  ? pool.packLiteralRequirementSatisfied
                    ? 'yes'
                    : 'no'
                  : 'n/a'}
              </p>
              <p>selectedVenueId: {pool.selectedVenueId}</p>
              <p>selectedScore: {pool.selectedScore}</p>
              <p>runnerUpVenueId: {pool.runnerUpVenueId ?? 'n/a'}</p>
              <p>runnerUpScore: {pool.runnerUpScore ?? 'n/a'}</p>
              {stopDelta && <p>previousVenueId: {stopDelta.previousVenueId ?? 'n/a'}</p>}
              {stopDelta && <p>nextVenueId: {stopDelta.nextVenueId ?? 'n/a'}</p>}
              {stopDelta && <p>previousScore: {stopDelta.previousScore ?? 'n/a'}</p>}
              {stopDelta && <p>nextScore: {stopDelta.nextScore ?? 'n/a'}</p>}
              {stopDelta && <p>scoreDelta: {stopDelta.scoreDelta ?? 'n/a'}</p>}
              {stopDelta && <p>previousConfidence: {stopDelta.previousConfidence ?? 'n/a'}</p>}
              {stopDelta && <p>nextConfidence: {stopDelta.nextConfidence ?? 'n/a'}</p>}
              {stopDelta && <p>confidenceDelta: {stopDelta.confidenceDelta ?? 'n/a'}</p>}
              {stopDelta && <p>deltaChanged: {stopDelta.changed ? 'yes' : 'no'}</p>}
              {stopDelta && <p>deltaMaterialChange: {stopDelta.materialChange ? 'yes' : 'no'}</p>}
            </div>

            {debug.starterPackImpact.length > 0 && (
              <div className="debug-subsection">
                <p className="debug-label">starterPackInfluence</p>
                {debug.starterPackImpact.map((item) => (
                  <p key={`${stop.id}_pack_${item}`} className="debug-line">
                    {item}
                  </p>
                ))}
              </div>
            )}

            {(debug.roleContractLabel ||
              debug.contractMatchedSignals?.length ||
              debug.contractViolationReasons?.length) && (
              <div className="debug-subsection">
                <p className="debug-label">roleContract</p>
                <p className="debug-line">label: {debug.roleContractLabel ?? 'n/a'}</p>
                <p className="debug-line">strength: {debug.roleContractStrength ?? 'n/a'}</p>
                <p className="debug-line">
                  satisfied:{' '}
                  {typeof debug.contractSatisfied === 'boolean'
                    ? debug.contractSatisfied
                      ? 'yes'
                      : 'no'
                    : 'n/a'}
                </p>
                <p className="debug-line">
                  relaxed:{' '}
                  {typeof debug.contractRelaxed === 'boolean'
                    ? debug.contractRelaxed
                      ? 'yes'
                      : 'no'
                    : 'n/a'}
                </p>
                <p className="debug-line">
                  selectedViolatesContract:{' '}
                  {typeof debug.selectedViolatesContract === 'boolean'
                    ? debug.selectedViolatesContract
                      ? 'yes'
                      : 'no'
                    : 'n/a'}
                </p>
                <p className="debug-line">fallbackReason: {debug.contractFallbackReason ?? 'n/a'}</p>
                <p className="debug-line">
                  bestContractCandidateId: {debug.bestContractCandidateId ?? 'n/a'}
                </p>
                {debug.contractMatchedSignals?.map((signal) => (
                  <p key={`${stop.id}_contract_match_${signal}`} className="debug-line">
                    + {signal}
                  </p>
                ))}
                {debug.contractViolationReasons?.map((reason) => (
                  <p key={`${stop.id}_contract_violation_${reason}`} className="debug-line">
                    - {reason}
                  </p>
                ))}
              </div>
            )}

            {(debug.highlightMatchedSignals?.length || debug.highlightViolationReasons?.length) && (
              <div className="debug-subsection">
                <p className="debug-label">highlightValidity</p>
                {debug.highlightMatchedSignals?.map((signal) => (
                  <p key={`${stop.id}_highlight_match_${signal}`} className="debug-line">
                    + {signal}
                  </p>
                ))}
                {debug.highlightViolationReasons?.map((reason) => (
                  <p key={`${stop.id}_highlight_violation_${reason}`} className="debug-line">
                    - {reason}
                  </p>
                ))}
              </div>
            )}

            {(debug.supportStopVibeNotes?.length || debug.outdoorVsUrbanNotes?.length) && (
              <div className="debug-subsection">
                <p className="debug-label">vibeReinforcement</p>
                {debug.supportStopVibeNotes?.map((note) => (
                  <p key={`${stop.id}_support_${note}`} className="debug-line">
                    + {note}
                  </p>
                ))}
                {debug.outdoorVsUrbanNotes?.map((note) => (
                  <p key={`${stop.id}_adventure_${note}`} className="debug-line">
                    + {note}
                  </p>
                ))}
              </div>
            )}

            {(debug.inferredFields.length > 0 || debug.missingFields.length > 0 || debug.qualityGateNotes.length > 0) && (
              <div className="debug-subsection">
                <p className="debug-label">normalization</p>
                {debug.inferredFields.map((field) => (
                  <p key={`${stop.id}_inferred_${field}`} className="debug-line">
                    + inferred {field}
                  </p>
                ))}
                {debug.missingFields.map((field) => (
                  <p key={`${stop.id}_missing_${field}`} className="debug-line">
                    - missing {field}
                  </p>
                ))}
                {debug.qualityGateNotes.map((note) => (
                  <p key={`${stop.id}_quality_${note}`} className="debug-line">
                    * {note}
                  </p>
                ))}
              </div>
            )}

            {debug.refinementImpact.length > 0 && (
              <div className="debug-subsection">
                <p className="debug-label">refinementInfluence</p>
                {debug.refinementImpact.map((item) => (
                  <p key={`${stop.id}_ref_${item}`} className="debug-line">
                    {item}
                  </p>
                ))}
                {typeof debug.scoreDeltaFromBaseline === 'number' && (
                  <p className="debug-line">
                    score delta vs baseline: {debug.scoreDeltaFromBaseline}
                  </p>
                )}
              </div>
            )}

            {debug.rejectedAlternatives.length > 0 && (
              <div className="debug-subsection">
                <p className="debug-label">Rejected alternatives</p>
                {debug.rejectedAlternatives.map((candidate) => (
                  <div key={`${stop.id}_${candidate.venueId}`} className="debug-candidate">
                    <p className="debug-line">
                      {candidate.venueName} ({candidate.score})
                    </p>
                    <p className="debug-line">{candidate.rejectionReasons.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="debug-subsection">
              <p className="debug-label">categoryDistribution</p>
              <p className="debug-line">{JSON.stringify(pool.categoryDistribution)}</p>
            </div>
          </details>
        )
      })}

      <details className="debug-panel">
        <summary>Raw Trace</summary>
        <pre>{JSON.stringify(generationTrace, null, 2)}</pre>
      </details>
    </div>
  )
}
