import type { ContractEntryArtifact } from '../../domain/artifacts/contractEntryArtifact'
import type {
  DirectionPreviewModel,
  DirectionPreviewStop,
  SelectedRouteArtifact,
  SelectedRouteSummaryArtifact,
} from '../../domain/artifacts/selectedRouteArtifact'

export type PlanPreviewV01Source =
  | 'candidate_artifact'
  | 'direction_fallback'
  | 'generated_route'
  | 'committed_plan'
  | 'live_plan'

export type PlanPreviewV01Provenance =
  | 'candidate_artifact'
  | 'direction_card_fallback'
  | 'generated_runtime_route'

export interface PlanPreviewV01StorySpine {
  start: string | null
  highlight: string | null
  windDown: string | null
}

export interface PlanPreviewV01Stop {
  role: DirectionPreviewStop['role']
  name: string
}

export interface PlanPreviewV01 {
  id: string
  mode: 'pre_commit'
  source: PlanPreviewV01Source
  provenance: PlanPreviewV01Provenance
  renderModelSource: 'selected_route_artifact' | 'selected_route_summary_artifact'
  sourceCandidateArtifactId: string | null
  selectedDirectionId: string | null
  routeTitle: string | null
  flavorLine: string | null
  routeSummary: string | null
  whyThisWorks: string[]
  storySpine: PlanPreviewV01StorySpine
  stops: PlanPreviewV01Stop[]
  backingSummary: string | null
  validationSummary: string | null
}

export interface PlanPreviewComparisonResult {
  matches: boolean | null
  reason: string | null
}

function findPreviewStopName(
  preview: DirectionPreviewModel | undefined,
  role: DirectionPreviewStop['role'],
): string | null {
  const stop = preview?.stops.find((entry) => entry.role === role)
  return stop?.name?.trim() || null
}

function readStorySpine(params: {
  routeArtifact: SelectedRouteArtifact<unknown> | null
  routeSummaryArtifact: SelectedRouteSummaryArtifact | null
}): PlanPreviewV01StorySpine {
  const preview = params.routeArtifact?.preview ?? params.routeSummaryArtifact?.preview
  return {
    start: findPreviewStopName(preview, 'start'),
    highlight: findPreviewStopName(preview, 'highlight'),
    windDown: findPreviewStopName(preview, 'windDown'),
  }
}

function readStops(params: {
  routeArtifact: SelectedRouteArtifact<unknown> | null
  routeSummaryArtifact: SelectedRouteSummaryArtifact | null
}): PlanPreviewV01Stop[] {
  const previewStops = params.routeArtifact?.preview.stops ?? params.routeSummaryArtifact?.preview.stops
  return (previewStops ?? []).map((stop) => ({
    role: stop.role,
    name: stop.name,
  }))
}

function readWhyThisWorksLines(params: {
  routeArtifact: SelectedRouteArtifact<unknown> | null
  routeSummaryArtifact: SelectedRouteSummaryArtifact | null
}): string[] {
  const artifact = params.routeArtifact
  const summaryArtifact = params.routeSummaryArtifact
  return [
    artifact?.whyChooseLine,
    artifact?.whyTonightProofLine,
    ...(artifact?.scenarioEvaluationNotes ?? []).slice(0, 1),
    artifact?.authorityLine,
    artifact?.happeningsLine,
    summaryArtifact?.whyChooseLine,
    summaryArtifact?.whyTonightProofLine,
    ...(summaryArtifact?.scenarioEvaluationNotes ?? []).slice(0, 1),
    summaryArtifact?.authorityLine,
    summaryArtifact?.happeningsLine,
  ].filter((value): value is string => Boolean(value && value.trim()))
}

function summarizeDirectionBacking(artifact: ContractEntryArtifact | undefined): string | null {
  if (!artifact?.directionBacking) {
    return null
  }
  const { status, source, reason } = artifact.directionBacking
  return [status, source, reason].filter(Boolean).join(':')
}

function summarizeValidation(artifact: ContractEntryArtifact | undefined): string | null {
  if (!artifact?.qualification) {
    return null
  }
  const { status, failureKind, failedCheck, missingRoleForContract, contractBuildabilityStatus } =
    artifact.qualification
  return [
    status,
    failureKind ?? null,
    failedCheck ?? null,
    missingRoleForContract ?? null,
    contractBuildabilityStatus ?? null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(':')
}

function resolvePlanPreviewSource(
  selectedRouteArtifact: SelectedRouteArtifact<unknown>,
): Pick<PlanPreviewV01, 'source' | 'provenance'> {
  if (selectedRouteArtifact.source === 'committed') {
    return {
      source: 'generated_route',
      provenance: 'generated_runtime_route',
    }
  }
  if (selectedRouteArtifact.candidateRouteArtifact) {
    return {
      source: 'candidate_artifact',
      provenance: 'candidate_artifact',
    }
  }
  return {
    source: 'direction_fallback',
    provenance: 'direction_card_fallback',
  }
}

function buildPlanPreviewId(params: {
  source: PlanPreviewV01Source
  selectedDirectionId: string | null
  sourceCandidateArtifactId: string | null
  storySpine: PlanPreviewV01StorySpine
}): string {
  const directionPart = params.selectedDirectionId ?? 'unknown-direction'
  if (params.sourceCandidateArtifactId) {
    return `${params.source}:${directionPart}:${params.sourceCandidateArtifactId}`
  }
  return [
    params.source,
    directionPart,
    params.storySpine.start ?? 'start',
    params.storySpine.highlight ?? 'highlight',
    params.storySpine.windDown ?? 'windDown',
  ].join(':')
}

export function buildPlanPreviewV01FromSelectedRouteArtifacts(params: {
  selectedRouteArtifact: SelectedRouteArtifact<unknown> | null
  selectedRouteSummaryArtifact: SelectedRouteSummaryArtifact | null
  committedCandidateArtifactId?: string | null
}): PlanPreviewV01 | null {
  const { selectedRouteArtifact, selectedRouteSummaryArtifact, committedCandidateArtifactId = null } =
    params
  if (!selectedRouteArtifact && !selectedRouteSummaryArtifact) {
    return null
  }

  if (!selectedRouteArtifact) {
    const storySpine = readStorySpine({
      routeArtifact: null,
      routeSummaryArtifact: selectedRouteSummaryArtifact,
    })
    const stops = readStops({
      routeArtifact: null,
      routeSummaryArtifact: selectedRouteSummaryArtifact,
    })
    const selectedDirectionId = selectedRouteSummaryArtifact?.preview.directionId ?? null
    return {
      id: buildPlanPreviewId({
        source: 'direction_fallback',
        selectedDirectionId,
        sourceCandidateArtifactId: null,
        storySpine,
      }),
      mode: 'pre_commit',
      source: 'direction_fallback',
      provenance: 'direction_card_fallback',
      renderModelSource: 'selected_route_summary_artifact',
      sourceCandidateArtifactId: null,
      selectedDirectionId,
      routeTitle: selectedRouteSummaryArtifact?.routeTitle ?? null,
      flavorLine: selectedRouteSummaryArtifact?.flavorLine ?? null,
      routeSummary: selectedRouteSummaryArtifact?.routeSummary ?? null,
      whyThisWorks: readWhyThisWorksLines({
        routeArtifact: null,
        routeSummaryArtifact: selectedRouteSummaryArtifact,
      }),
      storySpine,
      stops,
      backingSummary: null,
      validationSummary: null,
    }
  }

  const sourceState = resolvePlanPreviewSource(selectedRouteArtifact)
  const storySpine = readStorySpine({
    routeArtifact: selectedRouteArtifact,
    routeSummaryArtifact: selectedRouteSummaryArtifact,
  })
  const stops = readStops({
    routeArtifact: selectedRouteArtifact,
    routeSummaryArtifact: selectedRouteSummaryArtifact,
  })
  const sourceCandidateArtifactId =
    selectedRouteArtifact.source === 'committed'
      ? committedCandidateArtifactId ?? selectedRouteArtifact.candidateArtifactId ?? null
      : selectedRouteArtifact.candidateArtifactId ?? null
  return {
    id: buildPlanPreviewId({
      source: sourceState.source,
      selectedDirectionId: selectedRouteArtifact.directionId ?? null,
      sourceCandidateArtifactId,
      storySpine,
    }),
    mode: 'pre_commit',
    source: sourceState.source,
    provenance: sourceState.provenance,
    renderModelSource: 'selected_route_artifact',
    sourceCandidateArtifactId,
    selectedDirectionId: selectedRouteArtifact.directionId ?? null,
    routeTitle: selectedRouteArtifact.routeTitle ?? null,
    flavorLine: selectedRouteArtifact.flavorLine ?? null,
    routeSummary: selectedRouteArtifact.routeSummary ?? null,
    whyThisWorks: readWhyThisWorksLines({
      routeArtifact: selectedRouteArtifact,
      routeSummaryArtifact: selectedRouteSummaryArtifact,
    }),
    storySpine,
    stops,
    backingSummary: summarizeDirectionBacking(selectedRouteArtifact.candidateRouteArtifact),
    validationSummary: summarizeValidation(selectedRouteArtifact.candidateRouteArtifact),
  }
}

export function comparePlanPreviewV01ToSelectedRouteArtifact(params: {
  activePlanPreview: PlanPreviewV01 | null
  selectedRouteArtifact: SelectedRouteArtifact<unknown> | null
  committedCandidateArtifactId?: string | null
}): PlanPreviewComparisonResult {
  const { activePlanPreview, selectedRouteArtifact, committedCandidateArtifactId = null } = params
  if (!activePlanPreview && !selectedRouteArtifact) {
    return { matches: true, reason: null }
  }
  if (!activePlanPreview) {
    return { matches: false, reason: 'missing_active_plan_preview' }
  }
  if (!selectedRouteArtifact) {
    return { matches: false, reason: 'missing_selected_route_artifact' }
  }

  const expectedSource = resolvePlanPreviewSource(selectedRouteArtifact).source
  if (activePlanPreview.source !== expectedSource) {
    return { matches: false, reason: 'source_mismatch' }
  }

  const expectedCandidateArtifactId =
    selectedRouteArtifact.source === 'committed'
      ? committedCandidateArtifactId ?? selectedRouteArtifact.candidateArtifactId ?? null
      : selectedRouteArtifact.candidateArtifactId ?? null
  if (activePlanPreview.sourceCandidateArtifactId !== expectedCandidateArtifactId) {
    return { matches: false, reason: 'candidate_artifact_id_mismatch' }
  }
  if (activePlanPreview.selectedDirectionId !== selectedRouteArtifact.directionId) {
    return { matches: false, reason: 'direction_id_mismatch' }
  }

  const expectedStorySpine = readStorySpine({
    routeArtifact: selectedRouteArtifact,
    routeSummaryArtifact: null,
  })
  if (activePlanPreview.storySpine.start !== expectedStorySpine.start) {
    return { matches: false, reason: 'story_spine_start_mismatch' }
  }
  if (activePlanPreview.storySpine.highlight !== expectedStorySpine.highlight) {
    return { matches: false, reason: 'story_spine_highlight_mismatch' }
  }
  if (activePlanPreview.storySpine.windDown !== expectedStorySpine.windDown) {
    return { matches: false, reason: 'story_spine_wind_down_mismatch' }
  }

  return { matches: true, reason: null }
}

export function comparePlanPreviewV01ToRenderedPreview(params: {
  activePlanPreview: PlanPreviewV01 | null
  previewRenderedArtifactId: string | null
  previewDirectionId?: string | null
}): PlanPreviewComparisonResult {
  const { activePlanPreview, previewRenderedArtifactId, previewDirectionId = null } = params
  if (!activePlanPreview) {
    return { matches: false, reason: 'missing_active_plan_preview' }
  }
  if (!previewRenderedArtifactId) {
    return {
      matches: null,
      reason: activePlanPreview.sourceCandidateArtifactId
        ? 'preview_rendered_artifact_id_unavailable'
        : null,
    }
  }
  if (!activePlanPreview.sourceCandidateArtifactId) {
    return { matches: false, reason: 'active_preview_candidate_artifact_id_unavailable' }
  }
  if (activePlanPreview.sourceCandidateArtifactId !== previewRenderedArtifactId) {
    return { matches: false, reason: 'preview_rendered_artifact_id_mismatch' }
  }
  if (previewDirectionId && activePlanPreview.selectedDirectionId !== previewDirectionId) {
    return { matches: false, reason: 'preview_rendered_direction_id_mismatch' }
  }
  return { matches: true, reason: null }
}
