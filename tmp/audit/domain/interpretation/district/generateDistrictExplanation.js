const toneByVibe = {
    lively: 'Social and energetic',
    cozy: 'Calm and intimate',
    cultured: 'Intentional and exploratory',
    playful: 'Social and energetic',
    chill: 'Calm and intimate',
    'adventurous-outdoor': 'Intentional and exploratory',
    'adventurous-urban': 'Intentional and exploratory',
};
const signalThresholds = {
    signature: 0.66,
    coherence: 0.64,
    sequenceSupport: 0.64,
    roleFit: 0.62,
};
function getPersonaLine(context) {
    if (context.persona === 'romantic' || context.crew === 'romantic') {
        return 'for a romantic outing';
    }
    if (context.persona === 'friends' || context.crew === 'socialite') {
        return 'for a social night';
    }
    if (context.persona === 'family') {
        return 'for a shared outing';
    }
    if (context.crew === 'curator') {
        return 'for a curated night';
    }
    return 'for this outing';
}
function getSummaryLead(vibe) {
    if (vibe === 'lively' || vibe === 'playful') {
        return 'A lively, well-connected area';
    }
    if (vibe === 'cozy' || vibe === 'chill') {
        return 'A calm, walkable pocket';
    }
    return 'An intentional, exploratory district';
}
function getFitClause(affinity, context) {
    const personaLine = getPersonaLine(context);
    if (affinity >= 0.76) {
        return `that strongly matches your vibe ${personaLine}`;
    }
    if (affinity >= 0.64) {
        return `that matches your vibe ${personaLine}`;
    }
    return `that offers a balanced vibe match ${personaLine}`;
}
function getFlowClause(sequenceSupport) {
    if (sequenceSupport >= 0.76) {
        return 'with smooth transitions across stops';
    }
    if (sequenceSupport >= 0.64) {
        return 'with steady pacing across stops';
    }
    return 'with flexible pacing across stops';
}
function getStructureClause(roleFit) {
    if (roleFit >= 0.76) {
        return 'and clear anchors for key moments';
    }
    if (roleFit >= 0.64) {
        return 'and solid anchors across the night';
    }
    return 'and enough anchors to keep the night structured';
}
function buildSummary(signals, context) {
    return `${getSummaryLead(context.vibe)} ${getFitClause(signals.affinity, context)}, ${getFlowClause(signals.sequenceSupport)}, ${getStructureClause(signals.roleFit)}.`;
}
function buildHighlightCandidates(signals) {
    const candidates = [];
    const signatureHigh = signals.signature >= signalThresholds.signature;
    const coherenceHigh = signals.coherence >= signalThresholds.coherence;
    const sequenceHigh = signals.sequenceSupport >= signalThresholds.sequenceSupport;
    const roleFitHigh = signals.roleFit >= signalThresholds.roleFit;
    candidates.push({
        text: 'Distinctive local spots',
        score: signals.signature + (signatureHigh ? 0.08 : 0),
    });
    if (signatureHigh) {
        candidates.push({
            text: 'Strong identity and character',
            score: signals.signature + 0.03,
        });
    }
    candidates.push({
        text: 'Walkable and well-contained',
        score: signals.coherence + (coherenceHigh ? 0.08 : 0),
    });
    if (coherenceHigh) {
        candidates.push({
            text: 'Everything stays in one pocket',
            score: signals.coherence + 0.03,
        });
    }
    candidates.push({
        text: 'Smooth pacing across the night',
        score: signals.sequenceSupport + (sequenceHigh ? 0.08 : 0),
    });
    if (sequenceHigh) {
        candidates.push({
            text: 'Strong start-to-finish flow',
            score: signals.sequenceSupport + 0.03,
        });
    }
    candidates.push({
        text: 'Built around a strong central moment',
        score: signals.roleFit + (roleFitHigh ? 0.08 : 0),
    });
    return candidates;
}
function buildHighlights(signals) {
    const signalStrengths = [
        signals.signature,
        signals.coherence,
        signals.sequenceSupport,
        signals.roleFit,
    ].sort((left, right) => right - left);
    const desiredCount = signalStrengths[1] >= 0.7 || signalStrengths[0] >= 0.78 ? 3 : 2;
    const candidates = buildHighlightCandidates(signals)
        .sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return left.text.localeCompare(right.text);
    })
        .map((candidate) => candidate.text);
    const unique = [];
    for (const candidate of candidates) {
        if (!unique.includes(candidate)) {
            unique.push(candidate);
        }
        if (unique.length >= desiredCount) {
            break;
        }
    }
    return unique.slice(0, 3);
}
export function generateDistrictExplanation(district, context) {
    return {
        tone: toneByVibe[context.vibe] ?? 'Intentional and exploratory',
        summary: buildSummary(district, context),
        highlights: buildHighlights(district),
    };
}
