import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
const SCORING_DEBUG_KEYS = [
    'pocketId',
    'archetype',
    'confidence',
    'finalScore',
    'candidatePoolSize',
    'preShapeRank',
    'shapedRank',
    'selectedRank',
    'shapedScoreBeforeCompression',
    'shapedScoreAfterCompression',
    'compressionApplied',
    'compressionDelta',
    'winnerStrengthBonus',
    'top1RawSeparation',
    'top1AdjustedSeparation',
];
const FAMILY_DEBUG_KEYS = [
    'persona',
    'personaBoost',
    'vibe',
    'vibeBoost',
    'experienceFamily',
    'familyConfidence',
    'familyBias',
    'laneIdentity',
    'macroLane',
    'momentumProfile',
    'districtIdentityStrength',
    'selectedFamilies',
    'familyDiversityApplied',
    'fallbackUsed',
    'laneCollapseRisk',
    'laneSeparatedSlot3',
    'laneSeparationReason',
];
const RICHNESS_DEBUG_KEYS = [
    'richnessBoostApplied',
    'similarityPenaltyApplied',
    'composedCandidateAccepted',
    'composedCandidateRejected',
    'richnessContrastReason',
    'compositionChangedByShaping',
    'elevatedFromOutsideTop3',
    'contrastEligible',
    'contrastReason',
    'diversityLift',
    'contrastScore',
];
const EXPRESSION_DEBUG_KEYS = [
    'expressionMode',
    'localSpecificityScore',
    'usedPrimaryMicroPocket',
    'usedPrimaryAnchor',
    'expressionPrimarySignal',
    'expressionPocketType',
    'selectedTemplateKeys',
];
const EXPERIENCE_CONTRACT_DEBUG_KEYS = [
    'directionExperienceIdentity',
    'directionPrimaryIdentitySource',
    'directionPeakModel',
    'directionMovementStyle',
    'directionDistrictSupportSummary',
    'directionStrategyId',
    'directionStrategyLabel',
    'directionStrategyFamily',
    'directionStrategySummary',
    'directionStrategySource',
    'directionCollapseGuardApplied',
    'directionStrategyOverlapSummary',
    'strategyConstraintStatus',
    'strategyPoolSize',
    'strategyRejectedCount',
    'strategyHardGuardStatus',
    'strategyHardGuardReason',
    'contractGateApplied',
    'contractGateSummary',
    'contractGateStrengthSummary',
    'contractGateRejectedCount',
    'contractGateAllowedPreview',
    'contractGateSuppressedPreview',
    'directionContractGateStatus',
    'directionContractGateReasonSummary',
    'directionNarrativeSource',
    'directionNarrativeMode',
    'directionNarrativeSummary',
    'experienceContractId',
    'experienceContractIdentity',
    'experienceContractSummary',
    'experienceContractCoordinationMode',
    'experienceContractHighlightModel',
    'experienceContractHighlightType',
    'experienceContractMovementStyle',
    'experienceContractSocialPosture',
    'experienceContractPacingStyle',
    'experienceContractActPattern',
    'experienceContractReasonSummary',
];
const SELECTION_DEBUG_KEYS = [
    'selectionMode',
    'maxSimilarityToSelected',
    'similarityToWinner',
    'similarityToSlot2',
    'sameLaneAsWinner',
    'similarityPenalty',
    'strongestShapedId',
    'correctedWinnerId',
    'finalSelectedId',
    'strongestShapedPreserved',
    'slot1GuardrailApplied',
];
const CLUSTER_ORDER = ['lively', 'chill', 'explore'];
const BASE_REALITY_CARDS = {
    lively: {
        title: 'Lively',
        toneTag: 'Magnetic',
        whyNow: 'Active later and well-suited to an evening build.',
        whyYou: 'Good for building social momentum early.',
        proofLine: 'Haberdasher | Mama Kin | Five Points',
        storySpinePreview: {
            start: 'Warm social entry with quick momentum.',
            highlight: 'Middle stretch peaks around high-energy stops.',
            windDown: 'Finish eases from peak to a cleaner close.',
            whyThisWorks: 'Built for a quick build, strong middle, and controlled landing.',
        },
        liveSignals: {
            title: 'Why this pocket works',
            items: [
                'Tight clustering supports short transitions between stops.',
                'Activity and drink categories overlap in a compact area.',
                'Support venues keep momentum without long dead zones.',
            ],
        },
        confirmation: "You're stepping into where the city's energy is already building.",
    },
    chill: {
        title: 'Chill',
        toneTag: 'Soft',
        whyNow: 'Quieter area with a steadier flow, better for a slower start.',
        whyYou: 'Supports a slower, more intimate opening.',
        proofLine: 'Paper Plane | Still O.G. | Orchard City Kitchen',
        storySpinePreview: {
            start: 'Softer opening with lower-friction movement.',
            highlight: 'Center beat stays warm and contained.',
            windDown: 'Close remains calm and easy to follow.',
            whyThisWorks: 'Built for steady pacing with a contained center and soft finish.',
        },
        liveSignals: {
            title: 'What defines this area',
            items: [
                'Dining and cafe density supports lower-friction pacing.',
                'Quieter cluster shape reduces abrupt energy shifts.',
            ],
        },
        confirmation: "You're easing into a quieter side of the city.",
    },
    explore: {
        title: 'Off the Radar',
        toneTag: 'Tucked Away',
        whyNow: 'Compact cluster that keeps movement low without feeling flat.',
        whyYou: 'Fits a cultural night without losing pacing.',
        proofLine: 'Five Points | District | The Continental',
        storySpinePreview: {
            start: 'Intentional start that sets a clear route.',
            highlight: 'Centerpoint stays focused around culture-forward stops.',
            windDown: 'Finish tapers without abrupt transitions.',
            whyThisWorks: 'Built for focused progression with a clear central moment.',
        },
        liveSignals: {
            title: 'Pocket shape',
            items: [
                'Culture-forward venues are packed into a compact loop.',
                'Strong overlap supports focused movement and easy sequencing.',
            ],
        },
        confirmation: "You're starting where most nights don't usually begin.",
    },
};
function getFallbackDominantCluster(vibe) {
    if (vibe === 'lively' || vibe === 'playful') {
        return 'lively';
    }
    if (vibe === 'cozy' || vibe === 'chill') {
        return 'chill';
    }
    return 'explore';
}
function formatDebugKey(value) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ');
}
function formatDebugValue(value) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return 'n/a';
        }
        return Number.isInteger(value) ? String(value) : value.toFixed(3);
    }
    if (typeof value === 'boolean') {
        return String(value);
    }
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : '[]';
    }
    if (value === null) {
        return 'null';
    }
    if (value === undefined) {
        return 'n/a';
    }
    return JSON.stringify(value);
}
function buildDebugSection(label, keys, meta, consumedKeys) {
    const rows = keys.reduce((acc, key) => {
        const value = meta[key];
        if (value === undefined) {
            return acc;
        }
        consumedKeys.add(String(key));
        acc.push({
            key: formatDebugKey(String(key)),
            value: formatDebugValue(value),
        });
        return acc;
    }, []);
    return rows.length > 0 ? { label, rows } : undefined;
}
function summarizeTemplateKeys(templateKeys) {
    if (!templateKeys || templateKeys.length === 0) {
        return undefined;
    }
    const preview = templateKeys.slice(0, 2).join(',');
    if (templateKeys.length <= 2) {
        return preview;
    }
    return `${preview} +${templateKeys.length - 2}`;
}
function getTopSignalCounts(signalCounts, limit = 2) {
    if (!signalCounts) {
        return [];
    }
    return Object.entries(signalCounts)
        .sort((left, right) => {
        if (right[1] !== left[1]) {
            return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
    })
        .slice(0, limit);
}
function buildCompactDebugSummary(meta) {
    const tokens = [];
    if (meta.directionExperienceIdentity) {
        tokens.push(`identity ${meta.directionExperienceIdentity}`);
    }
    if (meta.directionPeakModel) {
        tokens.push(`peak ${meta.directionPeakModel}`);
    }
    if (meta.directionMovementStyle) {
        tokens.push(`movement ${meta.directionMovementStyle}`);
    }
    if (meta.directionStrategyId) {
        tokens.push(`strategy ${meta.directionStrategyId}`);
    }
    if (meta.directionStrategyFamily) {
        tokens.push(`strategyFamily ${meta.directionStrategyFamily}`);
    }
    if (meta.strategyConstraintStatus) {
        tokens.push(`constraints req:${meta.strategyConstraintStatus.required} pref:${meta.strategyConstraintStatus.preferred.toFixed(2)} sup:${meta.strategyConstraintStatus.suppressed}`);
    }
    if (meta.strategyPoolSize !== undefined) {
        const rejected = meta.strategyRejectedCount ?? 0;
        tokens.push(`pool ${meta.strategyPoolSize} (rej ${rejected})`);
    }
    if (meta.strategyHardGuardStatus) {
        tokens.push(`hardGuard ${meta.strategyHardGuardStatus}`);
    }
    if (meta.contractGateApplied !== undefined) {
        tokens.push(`gate ${meta.contractGateApplied ? 'on' : 'off'}`);
    }
    if (meta.contractGateStrengthSummary) {
        tokens.push(`gateStrength ${meta.contractGateStrengthSummary}`);
    }
    if (meta.directionContractGateStatus) {
        tokens.push(`gateStatus ${meta.directionContractGateStatus}`);
    }
    if (meta.contractGateRejectedCount !== undefined) {
        tokens.push(`gateRejected ${meta.contractGateRejectedCount}`);
    }
    if (meta.directionNarrativeMode) {
        tokens.push(`narrative ${meta.directionNarrativeMode}`);
    }
    if (meta.experienceContractIdentity) {
        tokens.push(`contract ${meta.experienceContractIdentity}`);
    }
    if (meta.experienceContractCoordinationMode) {
        tokens.push(`coordination ${meta.experienceContractCoordinationMode}`);
    }
    if (meta.experienceContractHighlightModel) {
        tokens.push(`highlightModel ${meta.experienceContractHighlightModel}`);
    }
    if (meta.experienceFamily) {
        tokens.push(`family ${meta.experienceFamily}`);
    }
    if (meta.familyConfidence !== undefined) {
        tokens.push(`familyConf ${meta.familyConfidence.toFixed(3)}`);
    }
    if (meta.familyBias !== undefined) {
        tokens.push(`familyBias ${meta.familyBias.toFixed(3)}`);
    }
    if (meta.finalScore !== undefined) {
        const rankSuffix = meta.selectedRank !== undefined ? ` #${meta.selectedRank}` : '';
        tokens.push(`final ${meta.finalScore.toFixed(3)}${rankSuffix}`);
    }
    else if (meta.selectedRank !== undefined) {
        tokens.push(`rank #${meta.selectedRank}`);
    }
    if (meta.compressionApplied !== undefined) {
        tokens.push(`compression ${meta.compressionApplied ? 'on' : 'off'}`);
    }
    if (meta.richnessBoostApplied !== undefined || meta.similarityPenaltyApplied !== undefined) {
        tokens.push(`richness +${(meta.richnessBoostApplied ?? 0).toFixed(3)} / -${(meta.similarityPenaltyApplied ?? 0).toFixed(3)}`);
    }
    if (meta.composedCandidateAccepted !== undefined || meta.composedCandidateRejected !== undefined) {
        const composedState = meta.composedCandidateAccepted
            ? 'accepted'
            : meta.composedCandidateRejected
                ? 'rejected'
                : 'n/a';
        tokens.push(`composed ${composedState}`);
    }
    const templateSummary = summarizeTemplateKeys(meta.selectedTemplateKeys);
    if (templateSummary) {
        tokens.push(`templates ${templateSummary}`);
    }
    return tokens.length > 0 ? tokens.join(' | ') : 'no card debug metadata';
}
function buildDebugSections(meta, selection) {
    const consumedKeys = new Set();
    const sections = [];
    const groupedSections = [
        buildDebugSection('Scoring', SCORING_DEBUG_KEYS, meta, consumedKeys),
        buildDebugSection('Family', FAMILY_DEBUG_KEYS, meta, consumedKeys),
        buildDebugSection('Richness', RICHNESS_DEBUG_KEYS, meta, consumedKeys),
        buildDebugSection('Experience', EXPERIENCE_CONTRACT_DEBUG_KEYS, meta, consumedKeys),
        buildDebugSection('Expression', EXPRESSION_DEBUG_KEYS, meta, consumedKeys),
        buildDebugSection('Selection', SELECTION_DEBUG_KEYS, meta, consumedKeys),
    ];
    groupedSections.forEach((section) => {
        if (section) {
            sections.push(section);
        }
    });
    const selectionSection = sections.find((section) => section.label === 'Selection');
    if (selectionSection) {
        selectionSection.rows.push({
            key: 'canonical final selected id',
            value: selection.canonicalFinalSelectedId ?? 'n/a',
        }, {
            key: 'highlighted card id',
            value: selection.highlightedCardId ?? 'n/a',
        }, {
            key: 'selected sync ok',
            value: String(selection.selectedSyncOk),
        }, {
            key: 'selected id reconciled',
            value: String(selection.selectedIdReconciled),
        });
    }
    else {
        sections.push({
            label: 'Selection',
            rows: [
                {
                    key: 'canonical final selected id',
                    value: selection.canonicalFinalSelectedId ?? 'n/a',
                },
                {
                    key: 'highlighted card id',
                    value: selection.highlightedCardId ?? 'n/a',
                },
                {
                    key: 'selected sync ok',
                    value: String(selection.selectedSyncOk),
                },
                {
                    key: 'selected id reconciled',
                    value: String(selection.selectedIdReconciled),
                },
            ],
        });
    }
    const remainingRows = Object.entries(meta)
        .filter(([key, value]) => value !== undefined && !consumedKeys.has(key))
        .map(([key, value]) => ({
        key: formatDebugKey(key),
        value: formatDebugValue(value),
    }));
    if (remainingRows.length > 0) {
        sections.push({
            label: 'Other',
            rows: remainingRows,
        });
    }
    return sections;
}
function extractPreviewStops(proofLine) {
    return proofLine
        .split(/\||\u00B7|\u00C2\u00B7|,/)
        .map((part) => part.trim())
        .filter(Boolean);
}
function rewriteCenteredAround(value) {
    return value.replace(/Centered around/gi, 'Near');
}
function getDistrictFromConfirmation(confirmation) {
    if (!confirmation) {
        return undefined;
    }
    const match = confirmation.match(/starting in\s+(.+?)\s+(?:\u2014|-|\u00E2\u20AC\u201D)\s+/i);
    const district = match?.[1]?.trim();
    return district && district.length > 0 ? district : undefined;
}
function getConfirmationSummary(selectedDistrict, cluster) {
    const arcLine = cluster === 'chill'
        ? 'builds steady and lands cleanly'
        : cluster === 'explore'
            ? 'builds with focus and lands cleanly'
            : 'builds fast and lands cleanly';
    if (selectedDistrict) {
        return `Starts in ${selectedDistrict} \u00B7 ${arcLine}`;
    }
    return `${arcLine.charAt(0).toUpperCase()}${arcLine.slice(1)}`;
}
const SOCIAL_TERMS = [
    'bar',
    'social',
    'live',
    'jazz',
    'music',
    'club',
    'buzz',
    'busy',
    'haberdasher',
    'kin',
];
const EXPLORATORY_TERMS = [
    'museum',
    'gallery',
    'culture',
    'cultural',
    'district',
    'art',
    'theatre',
    'theater',
    'wander',
    'explore',
    'continental',
];
const INTIMATE_TERMS = [
    'restaurant',
    'kitchen',
    'dining',
    'table',
    'courtyard',
    'cafe',
    'tea',
    'dessert',
    'orchard',
    'still',
    'linger',
];
const MODE_SUMMARY_BASE = {
    social: 'A social, fast-moving night with energy building across nearby spots',
    exploratory: 'A curious, culture-led night with room to wander',
    intimate: 'A slower, more intimate night built around a few strong stops',
};
const MODE_SUMMARY_VARIANTS = {
    social: [
        'A social, fast-moving night with energy building across nearby spots',
        'An anchored social night with a strong center and quick transitions',
        'A social route with steady momentum and a confident middle',
    ],
    exploratory: [
        'A curious, culture-led night with room to wander',
        'A culture-led route with walkable variety and time to wander',
        'A curious route with exploratory pacing and clear focal moments',
    ],
    intimate: [
        'A slower, more intimate night built around a few strong stops',
        'An intimate route with anchored pacing and room to linger',
        'A quieter, intimate night centered on standout table moments',
    ],
};
const MODE_BEST_WHEN = {
    social: 'Best when you want the night to keep moving',
    exploratory: 'Best when you want to explore without rushing',
    intimate: 'Best when you want to settle in and linger',
};
const PERSONA_SUMMARY_VARIANTS = {
    romantic: {
        social: [
            'A social route with a stronger centerpiece and softer pacing around it',
            'A lively route that builds into one standout central moment',
            'A social night with momentum and a clear romantic center',
        ],
        exploratory: [
            'An atmospheric route with room to explore between intimate moments',
            'A culture-led route with slower pacing and stronger atmosphere',
            'A curious route that stays intentional and easy to settle into',
        ],
        intimate: [
            'A slower, intimate route centered on a few standout moments',
            'An intimate route with a strong center and a soft finish',
            'A quieter route built for atmosphere and steady pacing',
        ],
    },
    friends: {
        social: [
            'A social route that keeps moving with shared energy',
            'A fast-moving route with a strong center and easy momentum',
            'A lively route built for group flow across nearby spots',
        ],
        exploratory: [
            'A varied route with movement and interactive moments',
            'A curious route that keeps variety high without stalling',
            'An exploratory route with shared energy and clear pacing',
        ],
        intimate: [
            'A lower-key social route with a strong center',
            'A steadier route that still keeps group momentum',
            'A calmer route with easy flow and a clear middle',
        ],
    },
    family: {
        social: [
            'An easy, active route with clear anchors and simple transitions',
            'A higher-energy route that stays straightforward and accessible',
            'A social route with clear pacing and low-friction movement',
        ],
        exploratory: [
            'An accessible route with clear anchors and room to explore',
            'A culture-led route with simple pacing and easy transitions',
            'A varied route that stays structured and easy to follow',
        ],
        intimate: [
            'A calm route with low-friction pacing and clear anchor stops',
            'A slower route built around easy, dependable anchor moments',
            'A steady route with clear stops and a soft finish',
        ],
    },
};
const PERSONA_BEST_WHEN = {
    romantic: {
        social: 'Best when you want stronger atmosphere around one standout center',
        exploratory: 'Best when you want atmosphere with time between stops',
        intimate: 'Best when you want a slower pace and room to linger',
    },
    friends: {
        social: 'Best when you want shared energy and steady movement',
        exploratory: 'Best when your group wants variety without rushing',
        intimate: 'Best when you want a calmer plan with a clear center',
    },
    family: {
        social: 'Best when you want easy movement and clear anchor stops',
        exploratory: 'Best when you want variety with simple pacing',
        intimate: 'Best when you want a calm plan that stays easy to follow',
    },
};
const PERSONA_STOP_TERMS = {
    romantic: ['wine', 'cocktail', 'tea', 'dessert', 'courtyard', 'kitchen', 'lounge', 'bistro'],
    friends: ['bar', 'live', 'music', 'jazz', 'brew', 'club', 'social', 'tap', 'arcade'],
    family: ['museum', 'park', 'cafe', 'kitchen', 'market', 'garden', 'dessert', 'plaza'],
};
const FAMILY_NIGHTLIFE_TERMS = ['late', 'night', 'club', 'speakeasy', 'buzz'];
function scoreTerms(value, terms) {
    const normalized = value.toLowerCase();
    return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}
function scoreStopForMode(stopName, mode) {
    if (mode === 'social') {
        return scoreTerms(stopName, SOCIAL_TERMS);
    }
    if (mode === 'exploratory') {
        return scoreTerms(stopName, EXPLORATORY_TERMS);
    }
    return scoreTerms(stopName, INTIMATE_TERMS);
}
function scoreTextForMode(text, mode) {
    return scoreStopForMode(text, mode);
}
function getModeDensitySignal(text) {
    return text.reduce((score, value) => {
        const normalized = value.toLowerCase();
        if (normalized.includes('tight') ||
            normalized.includes('compact') ||
            normalized.includes('dense') ||
            normalized.includes('short transitions') ||
            normalized.includes('quick')) {
            return score + 1;
        }
        return score;
    }, 0);
}
function getModeAnchorStrength(text) {
    return text.reduce((score, value) => {
        const normalized = value.toLowerCase();
        if (normalized.includes('center') ||
            normalized.includes('central') ||
            normalized.includes('anchor') ||
            normalized.includes('focused')) {
            return score + 1;
        }
        return score;
    }, 0);
}
function detectPrimaryMode(entry, stops) {
    const card = entry.card;
    const sourceText = [
        card.title,
        card.subtitle ?? '',
        card.whyNow,
        card.whyYou,
        card.anchorLine ?? '',
        card.supportLine ?? '',
        card.liveSignals.title,
        ...card.liveSignals.items,
        entry.debugMeta?.momentumProfile ?? '',
        entry.debugMeta?.macroLane ?? '',
        entry.debugMeta?.laneIdentity ?? '',
    ].filter(Boolean);
    const socialTextScore = sourceText.reduce((score, item) => score + scoreTextForMode(item, 'social'), 0);
    const exploratoryTextScore = sourceText.reduce((score, item) => score + scoreTextForMode(item, 'exploratory'), 0);
    const intimateTextScore = sourceText.reduce((score, item) => score + scoreTextForMode(item, 'intimate'), 0);
    const socialStopScore = stops.reduce((score, stop) => score + scoreStopForMode(stop, 'social'), 0);
    const exploratoryStopScore = stops.reduce((score, stop) => score + scoreStopForMode(stop, 'exploratory'), 0);
    const intimateStopScore = stops.reduce((score, stop) => score + scoreStopForMode(stop, 'intimate'), 0);
    const densitySignal = getModeDensitySignal(sourceText);
    const anchorSignal = getModeAnchorStrength(sourceText);
    const walkSignal = sourceText.some((item) => /walk|wander|explore|district/i.test(item)) ? 1 : 0;
    const diningSignal = sourceText.some((item) => /dining|restaurant|table|courtyard|linger/i.test(item))
        ? 1
        : 0;
    const socialComposite = socialTextScore + socialStopScore + densitySignal;
    const exploratoryComposite = exploratoryTextScore + exploratoryStopScore + walkSignal;
    const intimateComposite = intimateTextScore + intimateStopScore + diningSignal + anchorSignal;
    if (socialComposite >= exploratoryComposite + 1 && socialComposite >= intimateComposite + 1) {
        return 'social';
    }
    if (exploratoryComposite >= socialComposite + 1 &&
        exploratoryComposite >= intimateComposite + 1) {
        return 'exploratory';
    }
    if (intimateComposite >= socialComposite && intimateComposite >= exploratoryComposite) {
        return 'intimate';
    }
    if (entry.cluster === 'lively') {
        return 'social';
    }
    if (entry.cluster === 'explore') {
        return 'exploratory';
    }
    return 'intimate';
}
function scoreStopForPersona(stopName, persona) {
    let score = scoreTerms(stopName, PERSONA_STOP_TERMS[persona]);
    if (persona === 'family') {
        const normalized = stopName.toLowerCase();
        if (FAMILY_NIGHTLIFE_TERMS.some((term) => normalized.includes(term))) {
            score -= 1;
        }
    }
    return score;
}
function getModeAlignedStops(stops, mode, persona) {
    const normalized = Array.from(new Set(stops.map((stop) => stop.trim()).filter((stop) => stop.length > 0)));
    if (normalized.length <= 1) {
        return normalized;
    }
    return normalized
        .map((stop, index) => ({
        stop,
        index,
        score: scoreStopForMode(stop, mode) * 1.1 + scoreStopForPersona(stop, persona) * 1.35,
    }))
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map((entry) => entry.stop);
}
function formatPreviewIncludes(stops) {
    if (stops.length === 0) {
        return 'Includes nearby picks';
    }
    const namedStops = stops.slice(0, 3).map((stop) => rewriteCenteredAround(stop));
    const suffix = stops.length > 3 ? ' and nearby picks' : '';
    return `Includes: ${namedStops.join(' \u00B7 ')}${suffix}`;
}
function modesMatchStops(stops, mode) {
    if (stops.length === 0) {
        return true;
    }
    const total = stops.reduce((score, stop) => score + scoreStopForMode(stop, mode), 0);
    return total >= 1;
}
function chooseBestModeFromStops(stops, fallback) {
    if (stops.length === 0) {
        return fallback;
    }
    const totals = [
        { mode: 'social', score: stops.reduce((score, stop) => score + scoreStopForMode(stop, 'social'), 0) },
        {
            mode: 'exploratory',
            score: stops.reduce((score, stop) => score + scoreStopForMode(stop, 'exploratory'), 0),
        },
        { mode: 'intimate', score: stops.reduce((score, stop) => score + scoreStopForMode(stop, 'intimate'), 0) },
    ];
    const top = totals.sort((left, right) => right.score - left.score)[0];
    return (top?.score ?? 0) > 0 ? top.mode : fallback;
}
function buildCardNarrativeCopy(cards, persona) {
    const detectedModes = cards.map((entry) => {
        const stops = extractPreviewStops(entry.card.proofLine);
        const detected = detectPrimaryMode(entry, stops);
        const correctedMode = modesMatchStops(stops, detected)
            ? detected
            : chooseBestModeFromStops(stops, detected);
        return {
            id: entry.id,
            mode: correctedMode,
            stopNames: stops,
            densitySignal: getModeDensitySignal([entry.card.whyNow, ...entry.card.liveSignals.items]),
            anchorSignal: getModeAnchorStrength([
                entry.card.whyYou,
                entry.card.storySpinePreview?.whyThisWorks ?? '',
            ]),
        };
    });
    const modeBuckets = new Map();
    detectedModes.forEach((entry) => {
        const existing = modeBuckets.get(entry.mode) ?? [];
        existing.push(entry);
        modeBuckets.set(entry.mode, existing);
    });
    const summaryById = new Map();
    for (const [mode, entries] of modeBuckets.entries()) {
        const ordered = [...entries].sort((left, right) => right.densitySignal - left.densitySignal || right.anchorSignal - left.anchorSignal);
        const variants = PERSONA_SUMMARY_VARIANTS[persona][mode];
        ordered.forEach((entry, index) => {
            summaryById.set(entry.id, variants[index] ?? variants[variants.length - 1] ?? MODE_SUMMARY_BASE[mode]);
        });
    }
    const usedSummaries = new Set();
    const narrativeById = {};
    detectedModes.forEach((entry) => {
        const variants = PERSONA_SUMMARY_VARIANTS[persona][entry.mode];
        let summary = summaryById.get(entry.id) ?? MODE_SUMMARY_BASE[entry.mode];
        if (usedSummaries.has(summary)) {
            summary = variants.find((variant) => !usedSummaries.has(variant)) ?? `${summary} (distinct pacing)`;
        }
        usedSummaries.add(summary);
        narrativeById[entry.id] = {
            mode: entry.mode,
            summary,
            bestWhen: PERSONA_BEST_WHEN[persona][entry.mode] ?? MODE_BEST_WHEN[entry.mode],
        };
    });
    return narrativeById;
}
export function getRealityInterpretation(persona, vibe) {
    const dominantFromVibe = getFallbackDominantCluster(vibe);
    const dominantCluster = persona === 'family' && dominantFromVibe === 'explore' ? 'chill' : dominantFromVibe;
    return {
        dominantCluster,
        cards: BASE_REALITY_CARDS,
    };
}
export function RealityCommitStep({ persona, vibe, selectedDirectionId, finalSelectedId, selectedIdReconciled = false, userSelectedOverrideActive = false, onSelectDirection, onGenerate, loading, directionCards, showDebugMeta, allowFallbackCards = true, }) {
    const showDebug = import.meta.env.VITE_VERTICAL_DEBUG === '1';
    const shouldShowDebug = showDebug;
    const [activeDebugCardId, setActiveDebugCardId] = useState(null);
    const [inspectDirectionId, setInspectDirectionId] = useState(null);
    const interpretation = getRealityInterpretation(persona, vibe);
    const fallbackCards = CLUSTER_ORDER.map((cluster) => ({
        id: `fallback-${cluster}`,
        cluster,
        card: interpretation.cards[cluster],
        recommended: interpretation.dominantCluster === cluster,
    }));
    const cards = directionCards && directionCards.length > 0
        ? directionCards
        : allowFallbackCards
            ? fallbackCards
            : [];
    const cardNarrativeById = useMemo(() => buildCardNarrativeCopy(cards, persona), [cards, persona]);
    const selectedCard = selectedDirectionId
        ? cards.find((entry) => entry.id === selectedDirectionId)
        : undefined;
    const selectedDistrict = getDistrictFromConfirmation(selectedCard?.card.confirmation);
    const confirmation = selectedDirectionId
        ? getConfirmationSummary(selectedDistrict, selectedCard?.cluster)
        : undefined;
    const canonicalFinalSelectedId = finalSelectedId ?? cards[0]?.id;
    const highlightedCardId = selectedCard?.id;
    const selectedSyncOk = highlightedCardId === undefined ||
        highlightedCardId === canonicalFinalSelectedId ||
        userSelectedOverrideActive;
    const activeDebugEntry = shouldShowDebug && activeDebugCardId
        ? cards.find((entry) => entry.id === activeDebugCardId)
        : undefined;
    const activeDebugSummary = activeDebugEntry?.debugMeta
        ? buildCompactDebugSummary(activeDebugEntry.debugMeta)
        : '';
    const activeDebugSections = activeDebugEntry?.debugMeta
        ? buildDebugSections(activeDebugEntry.debugMeta, {
            canonicalFinalSelectedId,
            highlightedCardId,
            selectedSyncOk,
            selectedIdReconciled,
        })
        : [];
    return (_jsxs("section", { className: "reality-step", children: [_jsx("h2", { className: "reality-step-title", children: "Choose tonight's direction" }), _jsx("p", { className: "reality-step-subline", children: "Choose how you want the night to feel." }), _jsx("p", { className: "reality-intent-line", children: "Built from what's working nearby tonight." }), _jsxs("div", { className: "reality-curated-starts", children: [_jsx("p", { className: "reality-curated-label", children: "Good ways to start" }), _jsx("p", { className: "reality-curated-copy", children: "Matched to your vibe." }), _jsx("div", { className: "reality-step-grid", children: cards.map((entry) => {
                            const cluster = entry.cluster;
                            const card = entry.card;
                            const selected = selectedDirectionId === entry.id;
                            const dimmed = Boolean(selectedDirectionId && !selected);
                            const recommended = Boolean(entry.recommended);
                            const debugSummary = entry.debugMeta ? buildCompactDebugSummary(entry.debugMeta) : '';
                            const isDebugExpanded = activeDebugCardId === entry.id;
                            const isInspectExpanded = inspectDirectionId === entry.id;
                            const strategyWorldDebug = entry.directionStrategyWorldDebug;
                            const topSuppressors = getTopSignalCounts(strategyWorldDebug?.suppressedBySignal);
                            const topRejectors = getTopSignalCounts(strategyWorldDebug?.rejectedBySignal);
                            const sampleDecisions = strategyWorldDebug?.sampleDecisions.slice(0, 3) ?? [];
                            const suppressedBySignalSummary = strategyWorldDebug && Object.keys(strategyWorldDebug.suppressedBySignal).length > 0
                                ? Object.entries(strategyWorldDebug.suppressedBySignal)
                                    .sort((left, right) => {
                                    if (right[1] !== left[1]) {
                                        return right[1] - left[1];
                                    }
                                    return left[0].localeCompare(right[0]);
                                })
                                    .map(([key, count]) => `${key}:${count}`)
                                    .join(', ')
                                : 'n/a';
                            const rejectedBySignalSummary = strategyWorldDebug && Object.keys(strategyWorldDebug.rejectedBySignal).length > 0
                                ? Object.entries(strategyWorldDebug.rejectedBySignal)
                                    .sort((left, right) => {
                                    if (right[1] !== left[1]) {
                                        return right[1] - left[1];
                                    }
                                    return left[0].localeCompare(right[0]);
                                })
                                    .map(([key, count]) => `${key}:${count}`)
                                    .join(', ')
                                : 'n/a';
                            console.log('STRATEGY WORLD DEBUG', entry.directionStrategyWorldDebug);
                            const renderedProofLine = selected && card.selectedProofLine
                                ? card.selectedProofLine
                                : card.proofLine;
                            const districtLabel = getDistrictFromConfirmation(card.confirmation);
                            const districtAnchorLine = districtLabel
                                ? `District support: ${districtLabel}`
                                : 'District support: local area';
                            const previewStops = extractPreviewStops(renderedProofLine);
                            const narrative = cardNarrativeById[entry.id];
                            const narrativeMode = narrative?.mode ?? detectPrimaryMode(entry, previewStops);
                            const includesLine = formatPreviewIncludes(getModeAlignedStops(previewStops, narrativeMode, persona));
                            const nightSummary = entry.debugMeta?.directionNarrativeSummary ??
                                card.whyNow ??
                                narrative?.summary ??
                                MODE_SUMMARY_BASE[narrativeMode];
                            const contractSummaryLine = entry.debugMeta?.directionDistrictSupportSummary ??
                                entry.debugMeta?.experienceContractSummary ??
                                (narrative?.bestWhen ?? MODE_BEST_WHEN[narrativeMode]);
                            const contractActLine = entry.debugMeta?.experienceContractActPattern
                                ? `Act shape: ${entry.debugMeta.experienceContractActPattern}`
                                : undefined;
                            const routeShapeHint = shouldShowDebug
                                ? entry.debugMeta?.routeShapeGrammarHint ??
                                    entry.debugMeta?.routeShapeMovementHint ??
                                    entry.debugMeta?.routeShapeSwapHint
                                : undefined;
                            const conciergeHint = shouldShowDebug
                                ? entry.debugMeta?.conciergeHint ??
                                    (entry.debugMeta?.conciergeControlPostureMode && entry.debugMeta?.conciergeIntentMode
                                        ? `${entry.debugMeta.conciergeControlPostureMode} | ${entry.debugMeta.conciergeIntentMode} intent`
                                        : undefined)
                                : undefined;
                            return (_jsxs("div", { className: "reality-step-card-shell", children: [_jsxs("button", { type: "button", className: `reality-step-card${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}${recommended ? ' recommended' : ''}`, onClick: () => onSelectDirection(entry.id), "aria-pressed": selected, children: [_jsxs("div", { className: "reality-step-card-topline", children: [_jsx("strong", { children: rewriteCenteredAround(card.title) }), card.toneTag && _jsx("span", { className: "reality-step-tag", children: card.toneTag })] }), districtAnchorLine && (_jsx("p", { className: "reality-step-insider-proof reality-step-district-anchor", children: rewriteCenteredAround(districtAnchorLine) })), card.subtitle && (_jsx("p", { className: "reality-step-supporting-line", children: rewriteCenteredAround(card.subtitle) })), _jsx("p", { className: "reality-step-night-summary", children: nightSummary }), selected ? (_jsxs("div", { className: "reality-step-live-strip direction-preview", children: [_jsx("p", { className: "reality-step-example-line", children: includesLine }), _jsx("p", { className: "direction-meta", children: contractSummaryLine }), contractActLine && _jsx("p", { className: "direction-meta", children: contractActLine }), routeShapeHint && _jsx("p", { className: "direction-meta", children: routeShapeHint }), conciergeHint && _jsx("p", { className: "direction-meta", children: conciergeHint })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "reality-step-example-line", children: includesLine }), _jsx("p", { className: "reality-step-supporting-line", children: contractSummaryLine }), contractActLine && (_jsx("p", { className: "reality-step-supporting-line", children: contractActLine })), routeShapeHint && (_jsx("p", { className: "reality-step-supporting-line", children: routeShapeHint })), conciergeHint && (_jsx("p", { className: "reality-step-supporting-line", children: conciergeHint }))] }))] }), shouldShowDebug && entry.debugMeta && (_jsxs("div", { className: "reality-step-inspect-shell", children: [_jsxs("button", { type: "button", className: "reality-step-inspect-toggle", onClick: () => setInspectDirectionId((previous) => (previous === entry.id ? null : entry.id)), "aria-expanded": isInspectExpanded, children: [_jsx("span", { children: "Inspect this direction" }), _jsx("span", { "aria-hidden": "true", children: isInspectExpanded ? '[-]' : '[+]' })] }), isInspectExpanded && (_jsxs("div", { className: "reality-step-inspect-panel", children: [_jsxs("p", { className: "reality-step-meta reality-step-debug-meta", children: [_jsx("span", { children: "Debug:" }), " ", debugSummary] }), strategyWorldDebug && (_jsxs("div", { className: "reality-step-live-strip reality-step-debug-strip", children: [_jsx("p", { className: "reality-step-live-title", children: "Strategy World Health:" }), _jsxs("ul", { className: "reality-step-live-list", children: [_jsxs("li", { children: ["Input: ", strategyWorldDebug.totalInputCount] }), _jsxs("li", { children: ["Admitted: ", strategyWorldDebug.admittedCount] }), _jsxs("li", { children: ["Suppressed: ", strategyWorldDebug.suppressedCount] }), _jsxs("li", { children: ["Rejected: ", strategyWorldDebug.rejectedCount] }), _jsxs("li", { children: ["Hard Fail: ", strategyWorldDebug.hardFailCount] }), _jsxs("li", { children: ["Status: ", strategyWorldDebug.survivabilityStatus] }), _jsxs("li", { children: ["suppressedBySignal: ", suppressedBySignalSummary] }), _jsxs("li", { children: ["rejectedBySignal: ", rejectedBySignalSummary] })] }), (topSuppressors.length > 0 || topRejectors.length > 0) && (_jsxs(_Fragment, { children: [_jsx("p", { className: "reality-step-live-title", children: "Failure Signals:" }), topSuppressors.length > 0 ? (_jsx("ul", { className: "reality-step-live-list", children: topSuppressors.map(([signalName, count]) => (_jsxs("li", { children: ["suppressor ", signalName, ": ", count] }, `${entry.id}_suppress_${signalName}`))) })) : (_jsx("p", { className: "reality-step-meta reality-step-debug-meta", children: "suppressor n/a" })), topRejectors.length > 0 ? (_jsx("ul", { className: "reality-step-live-list", children: topRejectors.map(([signalName, count]) => (_jsxs("li", { children: ["rejector ", signalName, ": ", count] }, `${entry.id}_reject_${signalName}`))) })) : (_jsx("p", { className: "reality-step-meta reality-step-debug-meta", children: "rejector n/a" }))] })), sampleDecisions.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "reality-step-live-title", children: "Sample Decisions:" }), _jsx("ul", { className: "reality-step-live-list", children: sampleDecisions.map((decision) => (_jsxs("li", { children: [decision.pocketId, " \u2192 ", decision.status, " (", decision.reasonSummary, ")"] }, `${entry.id}_decision_${decision.pocketId}`))) })] }))] })), selected && card.liveSignals.items.length > 0 && (_jsxs("div", { className: "reality-step-live-strip reality-step-debug-strip", children: [_jsxs("p", { className: "reality-step-live-title", children: [card.liveSignals.title, ":"] }), _jsx("ul", { className: "reality-step-live-list", children: card.liveSignals.items.slice(0, 3).map((item) => (_jsx("li", { children: rewriteCenteredAround(item) }, `${cluster}_${item}`))) })] })), selected && card.storySpinePreview && (_jsxs("div", { className: "reality-step-live-strip reality-step-debug-strip", children: [_jsx("p", { className: "reality-step-live-title", children: "Story spine preview:" }), _jsxs("ul", { className: "reality-step-live-list", children: [_jsxs("li", { children: [_jsx("strong", { children: "Start" }), " - ", rewriteCenteredAround(card.storySpinePreview.start)] }), _jsxs("li", { children: [_jsx("strong", { children: "Highlight" }), " - ", rewriteCenteredAround(card.storySpinePreview.highlight)] }), _jsxs("li", { children: [_jsx("strong", { children: "Wind-down" }), " - ", rewriteCenteredAround(card.storySpinePreview.windDown)] })] }), _jsx("p", { className: "reality-step-insider-fit", children: rewriteCenteredAround(card.storySpinePreview.whyThisWorks) })] })), selected && (_jsxs("p", { className: "reality-step-meta reality-step-debug-meta", children: [_jsx("span", { children: "Selection Sync:" }), " finalSelectedId ", canonicalFinalSelectedId ?? 'n/a', " | highlightedCardId", ' ', highlightedCardId ?? 'n/a', " | selectedSyncOk ", String(selectedSyncOk), " | selectedIdReconciled", ' ', String(selectedIdReconciled)] })), _jsx("p", { className: "reality-step-meta reality-step-debug-meta", children: _jsx("a", { href: `#debug-${entry.id}`, className: "reality-step-debug-link", onClick: (event) => {
                                                                event.preventDefault();
                                                                setActiveDebugCardId((previous) => (previous === entry.id ? null : entry.id));
                                                            }, "aria-expanded": isDebugExpanded, children: isDebugExpanded ? 'Hide full debug' : 'Show full debug' }) })] }))] }))] }, entry.id));
                        }) })] }), shouldShowDebug && activeDebugEntry?.debugMeta && (_jsx("div", { className: "reality-step-debug-inspector-backdrop", onClick: () => setActiveDebugCardId(null), children: _jsxs("aside", { className: "reality-step-debug-inspector", role: "dialog", "aria-modal": "true", "aria-label": `Full debug inspector for ${activeDebugEntry.card.title}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "reality-step-debug-inspector-header", children: [_jsxs("p", { className: "reality-step-debug-inspector-title", children: ["Full debug - ", activeDebugEntry.card.title] }), _jsx("button", { type: "button", className: "reality-step-debug-close", onClick: () => setActiveDebugCardId(null), children: "Close" })] }), _jsxs("p", { className: "reality-step-meta reality-step-debug-meta", children: [_jsx("span", { children: "Debug:" }), " ", activeDebugSummary] }), _jsx("div", { className: "reality-step-debug-panel", children: activeDebugSections.map((section) => (_jsxs("section", { className: "reality-step-debug-section", children: [_jsx("p", { className: "reality-step-debug-section-title", children: section.label }), _jsx("div", { className: "reality-step-debug-rows", children: section.rows.map((row) => (_jsxs("p", { className: "reality-step-debug-row", children: [_jsx("span", { children: row.key }), _jsx("code", { children: row.value })] }, `${activeDebugEntry.id}_${section.label}_${row.key}`))) })] }, `${activeDebugEntry.id}_${section.label}`))) })] }) })), confirmation && _jsx("p", { className: "reality-step-confirmation", children: confirmation }), _jsx("div", { className: "action-row draft-actions", children: _jsx("button", { type: "button", className: "primary-button", onClick: onGenerate, disabled: !selectedDirectionId || loading, children: loading ? 'Building your night...' : 'Generate night' }) })] }));
}
