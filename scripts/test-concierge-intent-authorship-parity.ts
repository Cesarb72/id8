import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildApplicationConciergeIntent,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { projectConciergeIntentToIntentInput } from '../src/domain/interpretation/projectConciergeIntentToIntentInput.ts'
import type {
  AnchorRole,
  ConciergeIntent,
  ExperienceMode,
  IntentInput,
  PersonaMode,
  PlanAnchor,
  VibeAnchor,
} from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

type AuthorshipCaseName =
  | 'Surprise'
  | 'Curate'
  | 'Build'
  | 'Family / Lively'
  | 'Family / Cultured'
  | 'Build-anchor lineage'

type PlannerIntentAuthoritativeClassification =
  | 'inert stale diagnostic'
  | 'real authority leak'
  | 'inconclusive / needs C-suite gate'

interface AuthorshipCase {
  name: AuthorshipCaseName
  mode: ExperienceMode
  persona: PersonaMode
  primaryVibe: VibeAnchor
  objectiveOccasion?: ConciergeIntent['objective']['occasion']
  starterPack?: StarterPack | null
  anchor?: PlanAnchor | null
  anchorDisplayName?: string | null
  candidateLineage?: ConciergeIntent['candidateLineage'] | null
  projection: Omit<
    Parameters<typeof projectConciergeIntentToIntentInput>[0],
    'conciergeIntent'
  >
  expected: {
    intent: ReturnType<typeof summarizeConciergeIntent>
    cib: ReturnType<typeof summarizeCanonicalInterpretationBundle>
    input: ReturnType<typeof summarizeIntentInput>
    lineage: ReturnType<typeof summarizeLineage>
  }
}

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const curateStarterPack = {
  id: 'starter-cozy-date',
  title: 'Cozy Date Starter',
  description: 'Observer starter pack for ConciergeIntent parity.',
  personaBias: 'romantic',
  primaryAnchor: 'cozy',
  secondaryAnchors: ['cultured'],
  distanceMode: 'nearby',
} satisfies StarterPack

const buildAnchor = {
  venueId: 'sj-paper-plane',
  role: 'highlight',
} satisfies PlanAnchor

const buildAnchorLineage = {
  source: 'selected_candidate_route_artifact',
  candidateArtifactId: 'contract-entry:build-paper-plane',
  directionId: 'downtown-paper-plane',
  pocketId: 'downtown',
  sourceOpportunityId: 'contract-entry:build-paper-plane',
  anchorVenueId: 'sj-paper-plane',
  anchorRole: 'highlight',
  lineageSummary: 'Paper Plane anchored build route.',
} satisfies ConciergeIntent['candidateLineage']

function summarizeConciergeIntent(intent: ConciergeIntent) {
  return {
    id: intent.id,
    intentMode: intent.intentMode,
    objective: intent.objective,
    controlPosture: intent.controlPosture,
    experienceProfile: intent.experienceProfile,
    anchorPosture: intent.anchorPosture,
    constraintPosture: intent.constraintPosture,
    realityPosture: intent.realityPosture,
  }
}

function summarizeLineage(intent: ConciergeIntent) {
  return {
    starterLineage: intent.starterLineage,
    anchorLineage: intent.anchorLineage,
    candidateLineage: intent.candidateLineage,
  }
}

function summarizeCanonicalInterpretationBundle(
  bundle: ReturnType<typeof buildCanonicalInterpretationBundle>,
) {
  return {
    normalizedIntentId: bundle.normalizedIntent.id,
    occasion: {
      occasion: bundle.occasionSemantics.occasion,
      meaningTag: bundle.occasionSemantics.meaningTag,
    },
    experienceContract: {
      id: bundle.experienceContract.id,
      persona: bundle.experienceContract.persona,
      vibe: bundle.experienceContract.vibe,
      contractIdentity: bundle.experienceContract.contractIdentity,
      coordinationMode: bundle.experienceContract.coordinationMode,
      highlightModel: bundle.experienceContract.highlightModel,
      movementStyle: bundle.experienceContract.movementStyle,
      pacingStyle: bundle.experienceContract.pacingStyle,
    },
    contractConstraints: {
      id: bundle.contractConstraints.id,
      experienceContractId: bundle.contractConstraints.experienceContractId,
    },
    strategyFamily: bundle.strategyFamily,
    debugDerivedFrom: bundle.debug.derivedFrom,
  }
}

function summarizeIntentInput(input: IntentInput) {
  return {
    mode: input.mode,
    planningMode: input.planningMode,
    persona: input.persona,
    primaryVibe: input.primaryVibe,
    city: input.city,
    district: input.district,
    neighborhood: input.neighborhood,
    distanceMode: input.distanceMode,
    refinementModes: input.refinementModes,
    selectedDirectionContext: input.selectedDirectionContext,
    discoveryPreferences: input.discoveryPreferences,
    anchor: input.anchor,
  }
}

function buildExpected(params: {
  intent: ReturnType<typeof summarizeConciergeIntent>
  cib: ReturnType<typeof summarizeCanonicalInterpretationBundle>
  input: ReturnType<typeof summarizeIntentInput>
  lineage: ReturnType<typeof summarizeLineage>
}): AuthorshipCase['expected'] {
  return params
}

const cases: AuthorshipCase[] = [
  {
    name: 'Surprise',
    mode: 'surprise',
    persona: 'romantic',
    primaryVibe: 'lively',
    objectiveOccasion: 'explore',
    projection: {
      mode: 'surprise',
      city: 'San Jose',
      distanceMode: 'short-drive',
    },
    expected: buildExpected({
      intent: {
        id: 'cintent_v0_1_surprise_assistant_led_romantic_lively_san_jose_system_seeded',
        intentMode: 'surprise',
        objective: { primary: 'discover_route_shape', occasion: 'explore' },
        controlPosture: { mode: 'assistant_led' },
        experienceProfile: {
          persona: 'romantic',
          vibe: 'lively',
          pacing: 'quick',
          socialEnergy: 'high',
          explorationTolerance: 'medium',
        },
        anchorPosture: {
          mode: 'none',
          anchorType: 'none',
          anchorValue: 'San Jose',
          timeBound: 'tonight',
        },
        constraintPosture: {
          travelTolerance: 'tight',
          structureRigidity: 'balanced',
          swapTolerance: 'high',
        },
        realityPosture: {
          liveSignalPriority: 'high',
          coherencePriority: 'medium',
          noveltyPriority: 'medium',
          certaintyPriority: 'medium',
        },
      },
      cib: {
        normalizedIntentId:
          'cintent_v0_1_surprise_assistant_led_romantic_lively_san_jose_system_seeded',
        occasion: {
          occasion: 'explore',
          meaningTag: 'discovery-led, locally textured, less obvious route',
        },
        experienceContract: {
          id: 'xcontract_v0_1_romantic_lively',
          persona: 'romantic',
          vibe: 'lively',
          contractIdentity: 'romantic_pulse_multi_peak',
          coordinationMode: 'pulse',
          highlightModel: 'multi_peak',
          movementStyle: 'momentum',
          pacingStyle: 'dynamic',
        },
        contractConstraints: {
          id: 'cconstraints_v0_1_romantic_lively',
          experienceContractId: 'xcontract_v0_1_romantic_lively',
        },
        strategyFamily: 'romantic_lively',
        debugDerivedFrom: [
          'concierge_intent',
          'concierge_intent.experience_profile',
          'concierge_intent.anchor_posture',
          'concierge_intent.objective',
          'concierge_intent.constraint_posture',
          'concierge_intent.reality_posture',
          'concierge_intent.starter_lineage',
          'concierge_intent.anchor_lineage',
          'concierge_intent.candidate_lineage',
          'occasion_interpretation_profile_v0_1',
          'experience_contract_matrix_v0_1',
          'contract_constraints_matrix_v0_1',
        ],
      },
      input: {
        mode: 'surprise',
        planningMode: 'engine-led',
        persona: 'romantic',
        primaryVibe: 'lively',
        city: 'San Jose',
        district: undefined,
        neighborhood: undefined,
        distanceMode: 'short-drive',
        refinementModes: undefined,
        selectedDirectionContext: undefined,
        discoveryPreferences: undefined,
        anchor: undefined,
      },
      lineage: {
        starterLineage: { source: 'system_seeded' },
        anchorLineage: { source: 'system_seeded', required: false },
        candidateLineage: { source: 'none' },
      },
    }),
  },
  {
    name: 'Curate',
    mode: 'curate',
    persona: 'friends',
    primaryVibe: 'lively',
    objectiveOccasion: 'connect',
    starterPack: curateStarterPack,
    projection: {
      mode: 'curate',
      city: 'San Jose',
      district: 'Downtown',
      distanceMode: 'nearby',
    },
    expected: buildExpected({
      intent: {
        id: 'cintent_v0_1_curated_guided_assist_romantic_cozy_san_jose_starter_starter_cozy_date',
        intentMode: 'curated',
        objective: { primary: 'stabilize_selected_direction', occasion: 'connect' },
        controlPosture: { mode: 'guided_assist' },
        experienceProfile: {
          persona: 'romantic',
          vibe: 'cozy',
          pacing: 'linger',
          socialEnergy: 'low',
          explorationTolerance: 'low',
        },
        anchorPosture: {
          mode: 'soft',
          anchorType: 'none',
          anchorValue: 'starter-cozy-date',
          timeBound: 'tonight',
        },
        constraintPosture: {
          travelTolerance: 'tight',
          structureRigidity: 'balanced',
          swapTolerance: 'medium',
        },
        realityPosture: {
          liveSignalPriority: 'high',
          coherencePriority: 'medium',
          noveltyPriority: 'low',
          certaintyPriority: 'medium',
        },
      },
      cib: {
        normalizedIntentId:
          'cintent_v0_1_curated_guided_assist_romantic_cozy_san_jose_starter_starter_cozy_date',
        occasion: {
          occasion: 'connect',
          meaningTag: 'conversation-friendly shared time',
        },
        experienceContract: {
          id: 'xcontract_v0_1_romantic_cozy',
          persona: 'romantic',
          vibe: 'cozy',
          contractIdentity: 'contained_romantic_earned_centerpiece',
          coordinationMode: 'depth',
          highlightModel: 'single_peak',
          movementStyle: 'contained',
          pacingStyle: 'slow_linger',
        },
        contractConstraints: {
          id: 'cconstraints_v0_1_romantic_cozy',
          experienceContractId: 'xcontract_v0_1_romantic_cozy',
        },
        strategyFamily: 'romantic_cozy',
        debugDerivedFrom: [
          'concierge_intent',
          'concierge_intent.experience_profile',
          'concierge_intent.anchor_posture',
          'concierge_intent.objective',
          'concierge_intent.constraint_posture',
          'concierge_intent.reality_posture',
          'concierge_intent.starter_lineage',
          'concierge_intent.anchor_lineage',
          'concierge_intent.candidate_lineage',
          'occasion_interpretation_profile_v0_1',
          'experience_contract_matrix_v0_1',
          'contract_constraints_matrix_v0_1',
        ],
      },
      input: {
        mode: 'curate',
        planningMode: 'engine-led',
        persona: 'romantic',
        primaryVibe: 'cozy',
        city: 'San Jose',
        district: 'Downtown',
        neighborhood: undefined,
        distanceMode: 'nearby',
        refinementModes: undefined,
        selectedDirectionContext: undefined,
        discoveryPreferences: undefined,
        anchor: undefined,
      },
      lineage: {
        starterLineage: {
          source: 'starter_pack',
          starterPackId: 'starter-cozy-date',
          title: 'Cozy Date Starter',
          personaBias: 'romantic',
          primaryAnchor: 'cozy',
          secondaryAnchors: ['cultured'],
        },
        anchorLineage: {
          source: 'starter_seeded',
          anchorId: 'starter-cozy-date',
          displayName: 'Cozy Date Starter',
          required: false,
        },
        candidateLineage: { source: 'none' },
      },
    }),
  },
  {
    name: 'Build',
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    objectiveOccasion: 'connect',
    anchor: buildAnchor,
    anchorDisplayName: 'Paper Plane',
    projection: {
      mode: 'build',
      city: 'San Jose',
      district: 'Downtown',
      distanceMode: 'nearby',
      anchor: buildAnchor,
    },
    expected: buildExpected({
      intent: {
        id: 'cintent_v0_1_anchored_user_directed_friends_lively_san_jose_anchor_sj_paper_plane',
        intentMode: 'anchored',
        objective: { primary: 'lock_anchor_and_sequence', occasion: 'connect' },
        controlPosture: { mode: 'user_directed' },
        experienceProfile: {
          persona: 'friends',
          vibe: 'lively',
          pacing: 'quick',
          socialEnergy: 'high',
          explorationTolerance: 'medium',
        },
        anchorPosture: {
          mode: 'hard',
          anchorType: 'venue',
          anchorValue: 'sj-paper-plane',
          roleHint: 'highlight',
          timeBound: 'tonight',
        },
        constraintPosture: {
          travelTolerance: 'tight',
          structureRigidity: 'flexible',
          swapTolerance: 'high',
        },
        realityPosture: {
          liveSignalPriority: 'high',
          coherencePriority: 'low',
          noveltyPriority: 'medium',
          certaintyPriority: 'medium',
        },
      },
      cib: {
        normalizedIntentId:
          'cintent_v0_1_anchored_user_directed_friends_lively_san_jose_anchor_sj_paper_plane',
        occasion: {
          occasion: 'connect',
          meaningTag: 'conversation-friendly shared time',
        },
        experienceContract: {
          id: 'xcontract_v0_1_friends_lively',
          persona: 'friends',
          vibe: 'lively',
          contractIdentity: 'friends_momentum_distributed_peaks',
          coordinationMode: 'momentum',
          highlightModel: 'multi_peak',
          movementStyle: 'momentum',
          pacingStyle: 'dynamic',
        },
        contractConstraints: {
          id: 'cconstraints_v0_1_friends_lively',
          experienceContractId: 'xcontract_v0_1_friends_lively',
        },
        strategyFamily: 'friends_lively',
        debugDerivedFrom: [
          'concierge_intent',
          'concierge_intent.experience_profile',
          'concierge_intent.anchor_posture',
          'concierge_intent.objective',
          'concierge_intent.constraint_posture',
          'concierge_intent.reality_posture',
          'concierge_intent.starter_lineage',
          'concierge_intent.anchor_lineage',
          'concierge_intent.candidate_lineage',
          'occasion_interpretation_profile_v0_1',
          'experience_contract_matrix_v0_1',
          'contract_constraints_matrix_v0_1',
        ],
      },
      input: {
        mode: 'build',
        planningMode: 'user-led',
        persona: 'friends',
        primaryVibe: 'lively',
        city: 'San Jose',
        district: 'Downtown',
        neighborhood: undefined,
        distanceMode: 'nearby',
        refinementModes: undefined,
        selectedDirectionContext: undefined,
        discoveryPreferences: undefined,
        anchor: buildAnchor,
      },
      lineage: {
        starterLineage: { source: 'none' },
        anchorLineage: {
          source: 'build_anchor',
          anchorId: 'sj-paper-plane',
          displayName: 'Paper Plane',
          roleHint: 'highlight',
          required: true,
        },
        candidateLineage: { source: 'none' },
      },
    }),
  },
  {
    name: 'Family / Lively',
    mode: 'surprise',
    persona: 'family',
    primaryVibe: 'lively',
    objectiveOccasion: 'explore',
    projection: {
      mode: 'surprise',
      city: 'San Jose',
      distanceMode: 'short-drive',
    },
    expected: buildExpected({
      intent: {
        id: 'cintent_v0_1_surprise_assistant_led_family_lively_san_jose_system_seeded',
        intentMode: 'surprise',
        objective: { primary: 'discover_route_shape', occasion: 'explore' },
        controlPosture: { mode: 'assistant_led' },
        experienceProfile: {
          persona: 'family',
          vibe: 'lively',
          pacing: 'quick',
          socialEnergy: 'high',
          explorationTolerance: 'low',
        },
        anchorPosture: {
          mode: 'none',
          anchorType: 'none',
          anchorValue: 'San Jose',
          timeBound: 'tonight',
        },
        constraintPosture: {
          travelTolerance: 'tight',
          structureRigidity: 'tight',
          swapTolerance: 'high',
        },
        realityPosture: {
          liveSignalPriority: 'high',
          coherencePriority: 'high',
          noveltyPriority: 'low',
          certaintyPriority: 'high',
        },
      },
      cib: {
        normalizedIntentId:
          'cintent_v0_1_surprise_assistant_led_family_lively_san_jose_system_seeded',
        occasion: {
          occasion: 'explore',
          meaningTag: 'discovery-led, locally textured, less obvious route',
        },
        experienceContract: {
          id: 'xcontract_v0_1_family_lively',
          persona: 'family',
          vibe: 'lively',
          contractIdentity: 'family_play_distributed_peak',
          coordinationMode: 'play',
          highlightModel: 'distributed',
          movementStyle: 'compressed',
          pacingStyle: 'burst_reset',
        },
        contractConstraints: {
          id: 'cconstraints_v0_1_family_lively',
          experienceContractId: 'xcontract_v0_1_family_lively',
        },
        strategyFamily: 'family_lively',
        debugDerivedFrom: [
          'concierge_intent',
          'concierge_intent.experience_profile',
          'concierge_intent.anchor_posture',
          'concierge_intent.objective',
          'concierge_intent.constraint_posture',
          'concierge_intent.reality_posture',
          'concierge_intent.starter_lineage',
          'concierge_intent.anchor_lineage',
          'concierge_intent.candidate_lineage',
          'occasion_interpretation_profile_v0_1',
          'experience_contract_matrix_v0_1',
          'contract_constraints_matrix_v0_1',
        ],
      },
      input: {
        mode: 'surprise',
        planningMode: 'engine-led',
        persona: 'family',
        primaryVibe: 'lively',
        city: 'San Jose',
        district: undefined,
        neighborhood: undefined,
        distanceMode: 'short-drive',
        refinementModes: undefined,
        selectedDirectionContext: undefined,
        discoveryPreferences: undefined,
        anchor: undefined,
      },
      lineage: {
        starterLineage: { source: 'system_seeded' },
        anchorLineage: { source: 'system_seeded', required: false },
        candidateLineage: { source: 'none' },
      },
    }),
  },
  {
    name: 'Family / Cultured',
    mode: 'curate',
    persona: 'family',
    primaryVibe: 'cultured',
    objectiveOccasion: 'connect',
    projection: {
      mode: 'curate',
      city: 'San Jose',
      distanceMode: 'nearby',
    },
    expected: buildExpected({
      intent: {
        id: 'cintent_v0_1_curated_guided_assist_family_cultured_san_jose_system_seeded',
        intentMode: 'curated',
        objective: { primary: 'stabilize_selected_direction', occasion: 'connect' },
        controlPosture: { mode: 'guided_assist' },
        experienceProfile: {
          persona: 'family',
          vibe: 'cultured',
          pacing: 'balanced',
          socialEnergy: 'medium',
          explorationTolerance: 'high',
        },
        anchorPosture: {
          mode: 'none',
          anchorType: 'none',
          anchorValue: 'San Jose',
          timeBound: 'tonight',
        },
        constraintPosture: {
          travelTolerance: 'balanced',
          structureRigidity: 'tight',
          swapTolerance: 'low',
        },
        realityPosture: {
          liveSignalPriority: 'high',
          coherencePriority: 'high',
          noveltyPriority: 'high',
          certaintyPriority: 'high',
        },
      },
      cib: {
        normalizedIntentId:
          'cintent_v0_1_curated_guided_assist_family_cultured_san_jose_system_seeded',
        occasion: {
          occasion: 'connect',
          meaningTag: 'conversation-friendly shared time',
        },
        experienceContract: {
          id: 'xcontract_v0_1_family_cultured',
          persona: 'family',
          vibe: 'cultured',
          contractIdentity: 'family_cultured_parallel_enrichment',
          coordinationMode: 'enrichment',
          highlightModel: 'cumulative',
          movementStyle: 'compressed',
          pacingStyle: 'structured_acts',
        },
        contractConstraints: {
          id: 'cconstraints_v0_1_family_cultured',
          experienceContractId: 'xcontract_v0_1_family_cultured',
        },
        strategyFamily: 'family_cultured',
        debugDerivedFrom: [
          'concierge_intent',
          'concierge_intent.experience_profile',
          'concierge_intent.anchor_posture',
          'concierge_intent.objective',
          'concierge_intent.constraint_posture',
          'concierge_intent.reality_posture',
          'concierge_intent.starter_lineage',
          'concierge_intent.anchor_lineage',
          'concierge_intent.candidate_lineage',
          'occasion_interpretation_profile_v0_1',
          'experience_contract_matrix_v0_1',
          'contract_constraints_matrix_v0_1',
        ],
      },
      input: {
        mode: 'curate',
        planningMode: 'engine-led',
        persona: 'family',
        primaryVibe: 'cultured',
        city: 'San Jose',
        district: undefined,
        neighborhood: undefined,
        distanceMode: 'nearby',
        refinementModes: undefined,
        selectedDirectionContext: undefined,
        discoveryPreferences: undefined,
        anchor: undefined,
      },
      lineage: {
        starterLineage: { source: 'none' },
        anchorLineage: { source: 'none', required: false },
        candidateLineage: { source: 'none' },
      },
    }),
  },
  {
    name: 'Build-anchor lineage',
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'cozy',
    objectiveOccasion: 'connect',
    anchor: buildAnchor,
    anchorDisplayName: 'Paper Plane',
    candidateLineage: buildAnchorLineage,
    projection: {
      mode: 'build',
      city: 'San Jose',
      district: 'Downtown',
      distanceMode: 'nearby',
    },
    expected: buildExpected({
      intent: {
        id: 'cintent_v0_1_anchored_user_directed_romantic_cozy_san_jose_candidate_contract_entry_build_paper_plane',
        intentMode: 'anchored',
        objective: { primary: 'lock_anchor_and_sequence', occasion: 'connect' },
        controlPosture: { mode: 'user_directed' },
        experienceProfile: {
          persona: 'romantic',
          vibe: 'cozy',
          pacing: 'linger',
          socialEnergy: 'low',
          explorationTolerance: 'low',
        },
        anchorPosture: {
          mode: 'hard',
          anchorType: 'venue',
          anchorValue: 'sj-paper-plane',
          roleHint: 'highlight',
          timeBound: 'tonight',
        },
        constraintPosture: {
          travelTolerance: 'flexible',
          structureRigidity: 'balanced',
          swapTolerance: 'medium',
        },
        realityPosture: {
          liveSignalPriority: 'high',
          coherencePriority: 'medium',
          noveltyPriority: 'low',
          certaintyPriority: 'medium',
        },
      },
      cib: {
        normalizedIntentId:
          'cintent_v0_1_anchored_user_directed_romantic_cozy_san_jose_candidate_contract_entry_build_paper_plane',
        occasion: {
          occasion: 'connect',
          meaningTag: 'conversation-friendly shared time',
        },
        experienceContract: {
          id: 'xcontract_v0_1_romantic_cozy',
          persona: 'romantic',
          vibe: 'cozy',
          contractIdentity: 'contained_romantic_earned_centerpiece',
          coordinationMode: 'depth',
          highlightModel: 'single_peak',
          movementStyle: 'contained',
          pacingStyle: 'slow_linger',
        },
        contractConstraints: {
          id: 'cconstraints_v0_1_romantic_cozy',
          experienceContractId: 'xcontract_v0_1_romantic_cozy',
        },
        strategyFamily: 'romantic_cozy',
        debugDerivedFrom: [
          'concierge_intent',
          'concierge_intent.experience_profile',
          'concierge_intent.anchor_posture',
          'concierge_intent.objective',
          'concierge_intent.constraint_posture',
          'concierge_intent.reality_posture',
          'concierge_intent.starter_lineage',
          'concierge_intent.anchor_lineage',
          'concierge_intent.candidate_lineage',
          'occasion_interpretation_profile_v0_1',
          'experience_contract_matrix_v0_1',
          'contract_constraints_matrix_v0_1',
        ],
      },
      input: {
        mode: 'build',
        planningMode: 'user-led',
        persona: 'romantic',
        primaryVibe: 'cozy',
        city: 'San Jose',
        district: 'Downtown',
        neighborhood: undefined,
        distanceMode: 'nearby',
        refinementModes: undefined,
        selectedDirectionContext: undefined,
        discoveryPreferences: undefined,
        anchor: buildAnchor,
      },
      lineage: {
        starterLineage: { source: 'none' },
        anchorLineage: {
          source: 'build_anchor',
          anchorId: 'sj-paper-plane',
          displayName: 'Paper Plane',
          roleHint: 'highlight',
          required: true,
        },
        candidateLineage: buildAnchorLineage,
      },
    }),
  },
]

function assertCaseOutput(currentCase: AuthorshipCase) {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: currentCase.mode,
    persona: currentCase.persona,
    primaryVibe: currentCase.primaryVibe,
    city: currentCase.projection.city,
    objectiveOccasion: currentCase.objectiveOccasion,
    starterPack: currentCase.starterPack,
    anchor: currentCase.anchor,
    anchorDisplayName: currentCase.anchorDisplayName,
    candidateLineage: currentCase.candidateLineage,
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-concierge-intent-authorship-parity',
  })
  const projectedInput = projectConciergeIntentToIntentInput({
    ...currentCase.projection,
    conciergeIntent,
  })

  const intentSummary = summarizeConciergeIntent(conciergeIntent)
  const cibSummary = summarizeCanonicalInterpretationBundle(canonicalInterpretationBundle)
  const inputSummary = summarizeIntentInput(projectedInput)
  const lineageSummary = summarizeLineage(conciergeIntent)

  assert.deepEqual(intentSummary, currentCase.expected.intent, `${currentCase.name} ConciergeIntent parity drifted.`)
  assert.deepEqual(cibSummary, currentCase.expected.cib, `${currentCase.name} CIB parity drifted.`)
  assert.deepEqual(inputSummary, currentCase.expected.input, `${currentCase.name} IntentInput parity drifted.`)
  assert.deepEqual(lineageSummary, currentCase.expected.lineage, `${currentCase.name} lineage parity drifted.`)

  return {
    case: currentCase.name,
    conciergeIntentParity: 'pass',
    cibParity: 'pass',
    intentInputParity: 'pass',
    lineageParity: 'pass',
    pass: true,
    notes:
      currentCase.name === 'Build-anchor lineage'
        ? 'candidate lineage drives stable intent id while projection derives anchor from hard anchor posture'
        : 'current output frozen',
  }
}

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return []
  }
  return readdirSync(root).flatMap((entry) => {
    const absolute = join(root, entry)
    const stats = statSync(absolute)
    if (stats.isDirectory()) {
      return collectSourceFiles(absolute)
    }
    if (!absolute.endsWith('.ts') && !absolute.endsWith('.tsx')) {
      return []
    }
    return [absolute]
  })
}

function normalizePathForReport(path: string): string {
  return relative(repoRoot, path).split(sep).join('/')
}

function classifyPlannerIntentAuthoritative(): {
  table: Array<{
    case: string
    observedValue: string
    drivesBehavior: string
    evidence: string
    classification: PlannerIntentAuthoritativeClassification
    recommendation: string
  }>
  productionReferences: string[]
} {
  const sourceFiles = collectSourceFiles(join(repoRoot, 'src'))
  const productionReferences = sourceFiles
    .filter((file) => readFileSync(file, 'utf8').includes('plannerIntentAuthoritative'))
    .map(normalizePathForReport)
    .sort()

  const allowedReferences = [
    'src/domain/runGeneratePlan.ts',
    'src/domain/types/diagnostics.ts',
    'src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts',
  ]
  assert.deepEqual(
    productionReferences,
    allowedReferences,
    'plannerIntentAuthoritative gained a new production reference; classification is no longer inert.',
  )

  const waypointBuildSource = readFileSync(
    join(repoRoot, 'src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts'),
    'utf8',
  )
  assert(
    waypointBuildSource.includes("contractAuthority: 'concierge_intent'") &&
      waypointBuildSource.includes('plannerIntentAuthoritative: false'),
    'Contract-driven Waypoint Build must keep ConciergeIntent authority and plannerIntentAuthoritative false.',
  )

  const runGeneratePlanSource = readFileSync(join(repoRoot, 'src/domain/runGeneratePlan.ts'), 'utf8')
  assert(
    runGeneratePlanSource.includes('function buildCanonicalInterpretationIngressDiagnostics') &&
      runGeneratePlanSource.includes('plannerIntentAuthoritative: true'),
    'runGeneratePlan canonical ingress diagnostic must expose the current true value for this watch item.',
  )

  return {
    productionReferences,
    table: [
      {
        case: 'runGeneratePlan canonicalInterpretationIngress',
        observedValue: 'true',
        drivesBehavior: 'no production read site found',
        evidence:
          'Only runGeneratePlan assignment and diagnostics type reference this true value.',
        classification: 'inert stale diagnostic',
        recommendation: 'park as named watch item; do not fix in this observer slice',
      },
      {
        case: 'contract-driven Waypoint Build diagnostics',
        observedValue: 'false',
        drivesBehavior: 'no; diagnostic reports contract posture',
        evidence:
          "buildContractDrivenBuildWaypointPlan reports contractAuthority: 'concierge_intent' and plannerIntentAuthoritative: false.",
        classification: 'inert stale diagnostic',
        recommendation:
          'keep Waypoint contract posture unchanged; handle stale ingress diagnostic separately if approved',
      },
    ],
  }
}

function assertAppCompatibilityAdapterThin(): void {
  const appAdapterSource = readFileSync(
    join(repoRoot, 'src/app/concierge/conciergeIntentAdapter.ts'),
    'utf8',
  )
  assert(
    appAdapterSource.includes(
      "from '../../domain/interpretation/conciergeIntent/buildConciergeIntent'",
    ),
    'App ConciergeIntent adapter must re-export the Interpretation-owned builder.',
  )
  assert(
    !appAdapterSource.includes('function ') &&
      !appAdapterSource.includes('const ') &&
      !appAdapterSource.includes('return {'),
    'App ConciergeIntent adapter must remain a thin compatibility re-export with no authorship logic.',
  )
}

function main(): void {
  assertAppCompatibilityAdapterThin()
  const modeResults = cases.map(assertCaseOutput)
  const plannerClassification = classifyPlannerIntentAuthoritative()

  const authorshipBoundary = [
    ['objective', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['control posture', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['pacing', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['travel tolerance', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['structure rigidity', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['swap tolerance', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['starter lineage', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['anchor lineage', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
    ['candidate lineage', 'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts', 'Interpretation', 'yes', 'moved'],
  ].map(([output, currentAuthor, correctOwner, observedParityFrozen, moveCandidate]) => ({
    output,
    currentAuthor,
    correctOwner,
    observedParityFrozen,
    moveCandidate,
    notes: 'Interpretation-owned output available through app compatibility re-export',
  }))

  console.info('ConciergeIntent authorship parity')
  console.table(modeResults)
  console.info('Authorship boundary map')
  console.table(authorshipBoundary)
  console.info('plannerIntentAuthoritative classification')
  console.table(plannerClassification.table)
  console.info('plannerIntentAuthoritative production references')
  console.info(plannerClassification.productionReferences.join('\n'))
  console.info('provider/network calls: 0')
}

main()
