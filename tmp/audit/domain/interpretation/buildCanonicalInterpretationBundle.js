function normalizeConciergeIntentToken(value) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
        return 'na';
    }
    const token = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return token.length > 0 ? token : 'na';
}
function getConciergeSocialEnergy(vibe) {
    if (vibe === 'lively' || vibe === 'playful') {
        return 'high';
    }
    if (vibe === 'cozy' || vibe === 'chill') {
        return 'low';
    }
    return 'medium';
}
function getConciergeExplorationTolerance(params) {
    const { persona, vibe } = params;
    if (vibe === 'adventurous-outdoor' ||
        vibe === 'adventurous-urban' ||
        vibe === 'cultured') {
        return 'high';
    }
    if (vibe === 'chill' || vibe === 'cozy' || persona === 'family') {
        return 'low';
    }
    return 'medium';
}
function getConciergePacing(params) {
    const { persona, vibe } = params;
    if (vibe === 'lively' || vibe === 'playful') {
        return 'quick';
    }
    if (vibe === 'chill' && persona !== 'family') {
        return 'linger';
    }
    if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
        return 'linger';
    }
    return 'balanced';
}
function buildConciergeIntent(params) {
    const { persona, vibe, city, planningMode = 'engine-led', entryPoint = 'direction_selection', hasAnchor = false, } = params;
    const controlMode = planningMode === 'user-led'
        ? 'user_directed'
        : entryPoint === 'search'
            ? 'assistant_led'
            : entryPoint === 'direction_selection'
                ? 'guided_assist'
                : 'guided_assist';
    const intentMode = entryPoint === 'search'
        ? 'search_led'
        : hasAnchor
            ? 'anchored'
            : planningMode === 'user-led'
                ? 'direct'
                : entryPoint === 'direction_selection'
                    ? 'curated'
                    : 'surprise';
    const objectivePrimary = intentMode === 'search_led'
        ? 'search_and_route'
        : intentMode === 'anchored'
            ? 'lock_anchor_and_sequence'
            : entryPoint === 'swap'
                ? 'preserve_route_integrity'
                : intentMode === 'surprise'
                    ? 'discover_route_shape'
                    : 'stabilize_selected_direction';
    const socialEnergy = getConciergeSocialEnergy(vibe);
    const explorationTolerance = getConciergeExplorationTolerance({
        persona,
        vibe,
    });
    const pacing = getConciergePacing({
        persona,
        vibe,
    });
    const travelTolerance = vibe === 'lively'
        ? 'tight'
        : vibe === 'chill' || vibe === 'cozy'
            ? 'flexible'
            : 'balanced';
    const structureRigidity = persona === 'family' ? 'tight' : persona === 'friends' ? 'flexible' : 'balanced';
    const swapTolerance = persona === 'friends' || vibe === 'lively' || vibe === 'playful'
        ? 'high'
        : persona === 'family'
            ? 'low'
            : 'medium';
    const anchorMode = hasAnchor
        ? 'hard'
        : 'none';
    const anchorType = hasAnchor
        ? 'venue'
        : 'none';
    const anchorRoleHint = undefined;
    const coherencePriority = structureRigidity === 'tight' ? 'high' : structureRigidity === 'balanced' ? 'medium' : 'low';
    const noveltyPriority = explorationTolerance === 'high'
        ? 'high'
        : explorationTolerance === 'low'
            ? 'low'
            : 'medium';
    const certaintyPriority = persona === 'family' ? 'high' : 'medium';
    const cityToken = normalizeConciergeIntentToken(city);
    const id = `cintent_v0_1_${intentMode}_${controlMode}_${persona}_${vibe}_${cityToken}`;
    return {
        id,
        intentMode,
        objective: {
            primary: objectivePrimary,
        },
        controlPosture: {
            mode: controlMode,
        },
        experienceProfile: {
            persona,
            vibe,
            pacing,
            socialEnergy,
            explorationTolerance,
        },
        anchorPosture: {
            mode: anchorMode,
            anchorType,
            anchorValue: city.trim() || undefined,
            roleHint: anchorRoleHint,
            timeBound: 'tonight',
        },
        constraintPosture: {
            travelTolerance,
            structureRigidity,
            swapTolerance,
        },
        realityPosture: {
            liveSignalPriority: 'high',
            coherencePriority,
            noveltyPriority,
            certaintyPriority,
        },
    };
}
const EXPERIENCE_CONTRACT_V0_1_MATRIX = {
    romantic: {
        cozy: {
            coordinationMode: 'depth',
            contractIdentity: 'contained_romantic_earned_centerpiece',
            summary: 'Contained romantic night with an earned centerpiece.',
            actPattern: ['connection_build', 'earned_centerpiece', 'soft_landing'],
            highlightModel: 'single_peak',
            highlightType: 'destination_dining',
            movementStyle: 'contained',
            socialPosture: 'intimate',
            pacingStyle: 'slow_linger',
            constraintPriority: {
                logistics: 'medium',
                biologicalRhythm: 'high',
                adultPayoffRequired: true,
                recoveryNodesRequired: true,
                lateNightAllowed: false,
            },
            venuePressure: {
                demandStrongCenterpiece: true,
                allowDistributedHighlight: false,
                requireCulturalAnchor: false,
                requireGroupBasecamp: false,
                requireKidEngagement: false,
            },
            contractReasonSummary: 'Romantic + cozy emphasizes intimacy, low-friction movement, and one earned destination moment.',
        },
        lively: {
            coordinationMode: 'pulse',
            contractIdentity: 'romantic_pulse_multi_peak',
            summary: 'Romantic momentum night with multiple energy peaks.',
            actPattern: ['energy_injection', 'pulse_build', 'peak', 'late_taper'],
            highlightModel: 'multi_peak',
            highlightType: 'experiential',
            movementStyle: 'momentum',
            socialPosture: 'balanced',
            pacingStyle: 'dynamic',
            constraintPriority: {
                logistics: 'medium',
                biologicalRhythm: 'medium',
                adultPayoffRequired: true,
                recoveryNodesRequired: false,
                lateNightAllowed: true,
            },
            venuePressure: {
                demandStrongCenterpiece: true,
                allowDistributedHighlight: true,
                requireCulturalAnchor: false,
                requireGroupBasecamp: false,
                requireKidEngagement: false,
            },
            contractReasonSummary: 'Romantic + lively favors energetic pacing, alternating peaks, and a controlled late taper.',
        },
        cultured: {
            coordinationMode: 'narrative',
            contractIdentity: 'romantic_cultured_thematic_arc',
            summary: 'Curated romantic narrative that culminates thematically.',
            actPattern: ['discovery_anchor', 'thematic_deepen', 'culmination', 'reflective_close'],
            highlightModel: 'cumulative',
            highlightType: 'thematic_culmination',
            movementStyle: 'curated_progression',
            socialPosture: 'intimate',
            pacingStyle: 'structured_acts',
            constraintPriority: {
                logistics: 'medium',
                biologicalRhythm: 'medium',
                adultPayoffRequired: true,
                recoveryNodesRequired: true,
                lateNightAllowed: false,
            },
            venuePressure: {
                demandStrongCenterpiece: true,
                allowDistributedHighlight: false,
                requireCulturalAnchor: true,
                requireGroupBasecamp: false,
                requireKidEngagement: false,
            },
            contractReasonSummary: 'Romantic + cultured builds through thematic acts with an intentional culmination and reflective close.',
        },
    },
    friends: {
        cozy: {
            coordinationMode: 'hang',
            contractIdentity: 'friends_cozy_distributed_hang',
            summary: 'Low-pressure group hang with distributed social anchors.',
            actPattern: ['easy_entry', 'settle_in', 'optional_anchor', 'elastic_close'],
            highlightModel: 'distributed',
            highlightType: 'social_anchor',
            movementStyle: 'compressed',
            socialPosture: 'group_internal',
            pacingStyle: 'steady',
            constraintPriority: {
                logistics: 'low',
                biologicalRhythm: 'low',
                adultPayoffRequired: false,
                recoveryNodesRequired: false,
                lateNightAllowed: true,
            },
            venuePressure: {
                demandStrongCenterpiece: false,
                allowDistributedHighlight: true,
                requireCulturalAnchor: false,
                requireGroupBasecamp: true,
                requireKidEngagement: false,
            },
            contractReasonSummary: 'Friends + cozy keeps movement compact and optional so the group can settle in without pressure.',
        },
        lively: {
            coordinationMode: 'momentum',
            contractIdentity: 'friends_momentum_distributed_peaks',
            summary: 'Group momentum night with distributed peaks.',
            actPattern: ['basecamp_or_injection', 'escalation', 'distributed_peaks', 'ritual_reset'],
            highlightModel: 'multi_peak',
            highlightType: 'distributed_social',
            movementStyle: 'momentum',
            socialPosture: 'social',
            pacingStyle: 'dynamic',
            constraintPriority: {
                logistics: 'low',
                biologicalRhythm: 'low',
                adultPayoffRequired: false,
                recoveryNodesRequired: false,
                lateNightAllowed: true,
            },
            venuePressure: {
                demandStrongCenterpiece: false,
                allowDistributedHighlight: true,
                requireCulturalAnchor: false,
                requireGroupBasecamp: true,
                requireKidEngagement: false,
            },
            contractReasonSummary: 'Friends + lively optimizes for movement, distributed social moments, and periodic resets.',
        },
        cultured: {
            coordinationMode: 'enrichment',
            contractIdentity: 'friends_cultured_dual_anchor',
            summary: 'Group enrichment arc with two anchors and debrief moments.',
            actPattern: ['anchor_one', 'debrief', 'anchor_two', 'conversation_close'],
            highlightModel: 'cumulative',
            highlightType: 'learning_anchor',
            movementStyle: 'exploratory',
            socialPosture: 'group_internal',
            pacingStyle: 'structured_acts',
            constraintPriority: {
                logistics: 'medium',
                biologicalRhythm: 'low',
                adultPayoffRequired: false,
                recoveryNodesRequired: false,
                lateNightAllowed: false,
            },
            venuePressure: {
                demandStrongCenterpiece: true,
                allowDistributedHighlight: false,
                requireCulturalAnchor: true,
                requireGroupBasecamp: false,
                requireKidEngagement: false,
            },
            contractReasonSummary: 'Friends + cultured leans on sequential learning anchors and shared debrief points.',
        },
    },
    family: {
        cozy: {
            coordinationMode: 'balance',
            contractIdentity: 'family_cozy_burst_reset_balance',
            summary: 'Family balance night with short engagement and recovery cycles.',
            actPattern: ['engage', 'recover', 'engage', 'easy_taper'],
            highlightModel: 'distributed',
            highlightType: 'distributed_social',
            movementStyle: 'compressed',
            socialPosture: 'family_unit',
            pacingStyle: 'burst_reset',
            constraintPriority: {
                logistics: 'high',
                biologicalRhythm: 'high',
                adultPayoffRequired: false,
                recoveryNodesRequired: true,
                lateNightAllowed: false,
            },
            venuePressure: {
                demandStrongCenterpiece: false,
                allowDistributedHighlight: true,
                requireCulturalAnchor: false,
                requireGroupBasecamp: true,
                requireKidEngagement: true,
            },
            contractReasonSummary: 'Family + cozy emphasizes low-friction movement, frequent resets, and dependable engagement beats.',
        },
        lively: {
            coordinationMode: 'play',
            contractIdentity: 'family_play_distributed_peak',
            summary: 'High-engagement family night with built-in resets.',
            actPattern: ['high_engagement', 'reset', 'reengage', 'tired_happy_close'],
            highlightModel: 'distributed',
            highlightType: 'play_peak',
            movementStyle: 'compressed',
            socialPosture: 'family_unit',
            pacingStyle: 'burst_reset',
            constraintPriority: {
                logistics: 'high',
                biologicalRhythm: 'high',
                adultPayoffRequired: false,
                recoveryNodesRequired: true,
                lateNightAllowed: false,
            },
            venuePressure: {
                demandStrongCenterpiece: false,
                allowDistributedHighlight: true,
                requireCulturalAnchor: false,
                requireGroupBasecamp: true,
                requireKidEngagement: true,
            },
            contractReasonSummary: 'Family + lively favors playful bursts with predictable reset points to preserve stamina.',
        },
        cultured: {
            coordinationMode: 'enrichment',
            contractIdentity: 'family_cultured_parallel_enrichment',
            summary: 'Structured family enrichment with decompression between anchors.',
            actPattern: ['learning_anchor', 'decompression', 'secondary_enrichment', 'reflective_taper'],
            highlightModel: 'cumulative',
            highlightType: 'learning_anchor',
            movementStyle: 'compressed',
            socialPosture: 'parallel_tracks',
            pacingStyle: 'structured_acts',
            constraintPriority: {
                logistics: 'high',
                biologicalRhythm: 'medium',
                adultPayoffRequired: false,
                recoveryNodesRequired: true,
                lateNightAllowed: false,
            },
            venuePressure: {
                demandStrongCenterpiece: true,
                allowDistributedHighlight: false,
                requireCulturalAnchor: true,
                requireGroupBasecamp: true,
                requireKidEngagement: true,
            },
            contractReasonSummary: 'Family + cultured uses staged learning anchors with decompression and parallel-track flexibility.',
        },
    },
};
export function normalizeExperienceContractVibe(vibe) {
    if (vibe === 'cozy' || vibe === 'chill') {
        return 'cozy';
    }
    if (vibe === 'lively' || vibe === 'playful') {
        return 'lively';
    }
    return 'cultured';
}
export function formatExperienceContractActShape(actPattern) {
    return actPattern.map((entry) => entry.replace(/_/g, ' ')).join(' -> ');
}
function buildExperienceContract(params) {
    const { persona, vibe, conciergeIntent, selectedDirectionContext } = params;
    const normalizedVibe = normalizeExperienceContractVibe(vibe);
    const template = EXPERIENCE_CONTRACT_V0_1_MATRIX[persona][normalizedVibe];
    const derivedFrom = ['persona', 'vibe'];
    if (conciergeIntent) {
        derivedFrom.push('concierge_intent');
    }
    if (selectedDirectionContext) {
        derivedFrom.push('selected_direction_context');
    }
    const id = `xcontract_v0_1_${persona}_${normalizedVibe}`;
    return {
        id,
        persona,
        vibe: normalizedVibe,
        coordinationMode: template.coordinationMode,
        contractIdentity: template.contractIdentity,
        summary: template.summary,
        actStructure: {
            actCount: template.actPattern.length,
            actPattern: [...template.actPattern],
        },
        highlightModel: template.highlightModel,
        highlightType: template.highlightType,
        movementStyle: template.movementStyle,
        socialPosture: template.socialPosture,
        pacingStyle: template.pacingStyle,
        constraintPriority: {
            ...template.constraintPriority,
        },
        venuePressure: {
            ...template.venuePressure,
        },
        debug: {
            derivedFrom,
            contractReasonSummary: selectedDirectionContext && conciergeIntent
                ? `${template.contractReasonSummary} Direction anchor: ${selectedDirectionContext.label}.`
                : template.contractReasonSummary,
        },
    };
}
const CONTRACT_CONSTRAINTS_V0_1_MATRIX = {
    romantic: {
        cozy: {
            peakCountModel: 'single',
            requireEscalation: false,
            requireContinuity: true,
            requireRecoveryWindows: false,
            maxEnergyDropTolerance: 'low',
            socialDensityBand: 'low',
            movementTolerance: 'contained',
            allowLateHighEnergy: false,
            windDownStrictness: 'soft_required',
            highlightPressure: 'strong',
            multiAnchorAllowed: false,
            groupBasecampPreferred: false,
            kidEngagementRequired: false,
            adultPayoffRequired: false,
            constraintReasonSummary: 'Single-center romantic containment with strict continuity and a soft required landing.',
        },
        lively: {
            peakCountModel: 'multi',
            requireEscalation: true,
            requireContinuity: true,
            requireRecoveryWindows: false,
            maxEnergyDropTolerance: 'low',
            socialDensityBand: 'medium_high',
            movementTolerance: 'moderate',
            allowLateHighEnergy: true,
            windDownStrictness: 'controlled',
            highlightPressure: 'strong',
            multiAnchorAllowed: true,
            groupBasecampPreferred: false,
            kidEngagementRequired: false,
            adultPayoffRequired: false,
            constraintReasonSummary: 'Escalating romantic pulse with multiple peaks, continuity guardrails, and controlled wind-down.',
        },
        cultured: {
            peakCountModel: 'cumulative',
            requireEscalation: false,
            requireContinuity: true,
            requireRecoveryWindows: false,
            maxEnergyDropTolerance: 'medium',
            socialDensityBand: 'low',
            movementTolerance: 'moderate',
            allowLateHighEnergy: false,
            windDownStrictness: 'soft_required',
            highlightPressure: 'strong',
            multiAnchorAllowed: true,
            groupBasecampPreferred: false,
            kidEngagementRequired: false,
            adultPayoffRequired: false,
            constraintReasonSummary: 'Cumulative romantic-cultural progression with continuity and strong thematic center pressure.',
        },
    },
    friends: {
        cozy: {
            peakCountModel: 'distributed',
            requireEscalation: false,
            requireContinuity: false,
            requireRecoveryWindows: false,
            maxEnergyDropTolerance: 'high',
            socialDensityBand: 'medium',
            movementTolerance: 'compressed',
            allowLateHighEnergy: false,
            windDownStrictness: 'flexible',
            highlightPressure: 'distributed',
            multiAnchorAllowed: true,
            groupBasecampPreferred: true,
            kidEngagementRequired: false,
            adultPayoffRequired: false,
            constraintReasonSummary: 'Distributed friend-hang structure with high tolerance for variance and flexible close.',
        },
        lively: {
            peakCountModel: 'multi',
            requireEscalation: true,
            requireContinuity: false,
            requireRecoveryWindows: false,
            maxEnergyDropTolerance: 'medium',
            socialDensityBand: 'high',
            movementTolerance: 'exploratory',
            allowLateHighEnergy: true,
            windDownStrictness: 'flexible',
            highlightPressure: 'distributed',
            multiAnchorAllowed: true,
            groupBasecampPreferred: true,
            kidEngagementRequired: false,
            adultPayoffRequired: false,
            constraintReasonSummary: 'High-density group momentum with distributed peaks, multi-anchor freedom, and loose taper.',
        },
        cultured: {
            peakCountModel: 'cumulative',
            requireEscalation: false,
            requireContinuity: true,
            requireRecoveryWindows: false,
            maxEnergyDropTolerance: 'medium',
            socialDensityBand: 'medium',
            movementTolerance: 'exploratory',
            allowLateHighEnergy: false,
            windDownStrictness: 'controlled',
            highlightPressure: 'moderate',
            multiAnchorAllowed: true,
            groupBasecampPreferred: false,
            kidEngagementRequired: false,
            adultPayoffRequired: false,
            constraintReasonSummary: 'Cultural friends route with multi-anchor enrichment, moderate center pressure, and controlled close.',
        },
    },
    family: {
        cozy: {
            peakCountModel: 'distributed',
            requireEscalation: false,
            requireContinuity: true,
            requireRecoveryWindows: true,
            maxEnergyDropTolerance: 'low',
            socialDensityBand: 'low',
            movementTolerance: 'compressed',
            allowLateHighEnergy: false,
            windDownStrictness: 'soft_required',
            highlightPressure: 'distributed',
            multiAnchorAllowed: true,
            groupBasecampPreferred: false,
            kidEngagementRequired: true,
            adultPayoffRequired: true,
            constraintReasonSummary: 'Family-cozy pacing requires recovery windows, tight movement, and a soft required taper.',
        },
        lively: {
            peakCountModel: 'distributed',
            requireEscalation: false,
            requireContinuity: true,
            requireRecoveryWindows: true,
            maxEnergyDropTolerance: 'low',
            socialDensityBand: 'medium',
            movementTolerance: 'compressed',
            allowLateHighEnergy: false,
            windDownStrictness: 'controlled',
            highlightPressure: 'distributed',
            multiAnchorAllowed: true,
            groupBasecampPreferred: false,
            kidEngagementRequired: true,
            adultPayoffRequired: true,
            constraintReasonSummary: 'Family-lively stays active but controlled: recovery windows, contained movement, no late energy spikes.',
        },
        cultured: {
            peakCountModel: 'cumulative',
            requireEscalation: false,
            requireContinuity: true,
            requireRecoveryWindows: true,
            maxEnergyDropTolerance: 'low',
            socialDensityBand: 'medium',
            movementTolerance: 'compressed',
            allowLateHighEnergy: false,
            windDownStrictness: 'controlled',
            highlightPressure: 'moderate',
            multiAnchorAllowed: true,
            groupBasecampPreferred: false,
            kidEngagementRequired: true,
            adultPayoffRequired: true,
            constraintReasonSummary: 'Family-cultural cumulative flow with recovery-protected cadence and moderate center pressure.',
        },
    },
};
function buildContractConstraints(experienceContract) {
    const normalizedVibe = normalizeExperienceContractVibe(experienceContract.vibe);
    const template = CONTRACT_CONSTRAINTS_V0_1_MATRIX[experienceContract.persona][normalizedVibe];
    return {
        id: `cconstraints_v0_1_${experienceContract.persona}_${normalizedVibe}`,
        experienceContractId: experienceContract.id,
        peakCountModel: template.peakCountModel,
        requireEscalation: template.requireEscalation,
        requireContinuity: template.requireContinuity,
        requireRecoveryWindows: template.requireRecoveryWindows,
        maxEnergyDropTolerance: template.maxEnergyDropTolerance,
        socialDensityBand: template.socialDensityBand,
        movementTolerance: template.movementTolerance,
        allowLateHighEnergy: template.allowLateHighEnergy,
        windDownStrictness: template.windDownStrictness,
        highlightPressure: template.highlightPressure,
        multiAnchorAllowed: template.multiAnchorAllowed,
        groupBasecampPreferred: template.groupBasecampPreferred,
        kidEngagementRequired: template.kidEngagementRequired,
        adultPayoffRequired: template.adultPayoffRequired,
        debug: {
            derivedFrom: [
                'experience_contract.id',
                'experience_contract.persona',
                'experience_contract.vibe',
                'experience_contract.highlightModel',
                'experience_contract.movementStyle',
            ],
            constraintReasonSummary: template.constraintReasonSummary,
        },
    };
}
const STRATEGY_FAMILY_SUMMARY_BY_ID = {
    romantic_lively: 'Romantic lively favors pulse-capable, multi-peak environments with emotional momentum.',
    romantic_cozy: 'Romantic cozy favors intimate containment, lingering tone, and soft landings.',
    romantic_cultured: 'Romantic cultured favors reflective anchors and thematic continuity.',
    friends_lively: 'Friends lively favors social throughput, crawl momentum, and late-capable density.',
    friends_cozy: 'Friends cozy favors easy hang flow, comfort, and settle-in pockets.',
    friends_cultured: 'Friends cultured favors conversational anchors and exploratory enrichment.',
    family_lively: 'Family lively favors bounded activation with predictable resets.',
    family_cozy: 'Family cozy favors low-friction movement and recovery-supported pacing.',
    family_cultured: 'Family cultured favors learning anchors with clustered enrichment and decompression.',
    adaptive: 'Adaptive semantics fallback used when persona-vibe mapping is ambiguous.',
};
function resolveInterpretationStrategyFamily(params) {
    const normalizedVibe = normalizeExperienceContractVibe(params.vibe);
    if (params.persona === 'romantic') {
        if (normalizedVibe === 'lively') {
            return 'romantic_lively';
        }
        if (normalizedVibe === 'cozy') {
            return 'romantic_cozy';
        }
        return 'romantic_cultured';
    }
    if (params.persona === 'friends') {
        if (normalizedVibe === 'lively') {
            return 'friends_lively';
        }
        if (normalizedVibe === 'cozy') {
            return 'friends_cozy';
        }
        return 'friends_cultured';
    }
    if (params.persona === 'family') {
        if (normalizedVibe === 'lively') {
            return 'family_lively';
        }
        if (normalizedVibe === 'cozy') {
            return 'family_cozy';
        }
        return 'family_cultured';
    }
    return 'adaptive';
}
export function buildCanonicalInterpretationBundle(input) {
    const normalizedIntent = buildConciergeIntent({
        persona: input.persona,
        vibe: input.vibe,
        city: input.city,
        planningMode: input.planningMode,
        entryPoint: input.entryPoint,
        hasAnchor: input.hasAnchor,
    });
    const experienceContract = buildExperienceContract({
        persona: input.persona,
        vibe: input.vibe,
        conciergeIntent: normalizedIntent,
        selectedDirectionContext: input.selectedDirectionContext,
    });
    const contractConstraints = buildContractConstraints(experienceContract);
    const strategyFamily = resolveInterpretationStrategyFamily({
        persona: input.persona,
        vibe: input.vibe,
    });
    const strategySummary = STRATEGY_FAMILY_SUMMARY_BY_ID[strategyFamily];
    const contractSummary = `${experienceContract.contractIdentity} | ${experienceContract.coordinationMode} | ${experienceContract.highlightModel} | ${experienceContract.movementStyle}`;
    return {
        normalizedIntent,
        experienceContract,
        contractConstraints,
        contractSummary,
        strategyFamily,
        strategySemantics: {
            family: strategyFamily,
            summary: strategySummary,
            source: 'persona_vibe_contract',
        },
        debug: {
            bundleSource: input.interpretationSource ?? 'domain.interpretation.buildCanonicalInterpretationBundle',
            derivedFrom: [
                'persona',
                'vibe',
                'city',
                'planning_mode',
                'entry_point',
                'anchor_posture',
                'experience_contract_matrix_v0_1',
                'contract_constraints_matrix_v0_1',
            ],
            contractReasonSummary: experienceContract.debug.contractReasonSummary,
            constraintReasonSummary: contractConstraints.debug.constraintReasonSummary,
            strategyReasonSummary: strategySummary,
        },
    };
}
