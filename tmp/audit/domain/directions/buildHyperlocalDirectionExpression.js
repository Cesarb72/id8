import { clampWords, formatList, getExpressionFamilyMode, getFamilyAnchorOrder, getFamilyBulletOrder, getFamilySubtitleTemplate, getFamilySupportEmphasis, getFamilyTemplateKeys, resolveReasonTemplate, resolveReasonTitleSignal, toDisplayToken, toKey, } from './hyperlocalExpressionTemplates';
const HIGH_SPECIFICITY_THRESHOLD = 0.62;
const MEDIUM_SPECIFICITY_THRESHOLD = 0.45;
const MIN_BULLETS = 2;
const MAX_BULLETS = 3;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toSet(value) {
    return value ? new Set(value) : new Set();
}
function unique(values) {
    return Array.from(new Set(values));
}
function extractHyperlocal(input) {
    if (input.hyperlocal) {
        return input.hyperlocal;
    }
    const candidate = input.candidate;
    return (candidate?.derivedFrom?.hyperlocal ??
        candidate?.districtProfile?.hyperlocal ??
        candidate?.profile?.hyperlocal ??
        null);
}
function buildFallback(input) {
    return {
        title: input.defaultTitle,
        subtitle: input.defaultSubtitle,
        anchorLine: undefined,
        supportLine: input.defaultSupportLine,
        sectionLabel: input.defaultSectionLabel ?? 'Why this area works',
        bullets: input.defaultBullets ?? [],
        expressionMode: 'district_fallback',
        localSpecificityScore: 0,
        usedPrimaryMicroPocket: false,
        usedPrimaryAnchor: false,
        templateKeys: [],
    };
}
function getCompactness(radiusM) {
    return clamp(1 - radiusM / 260, 0, 1);
}
function getPocketTypeOrder(radiusM, compactness, activationStrength, identityStrength) {
    const preferred = activationStrength >= 0.72 && compactness >= 0.62
        ? 'core'
        : compactness >= 0.62 && radiusM <= 120
            ? 'pocket'
            : radiusM >= 170 && activationStrength >= 0.56
                ? 'strip'
                : identityStrength >= 0.62
                    ? 'cluster'
                    : 'zone';
    const alternativesByType = {
        core: ['cluster', 'pocket', 'zone', 'strip'],
        pocket: ['cluster', 'core', 'zone', 'strip'],
        cluster: ['pocket', 'core', 'zone', 'strip'],
        strip: ['zone', 'cluster', 'pocket', 'core'],
        zone: ['cluster', 'pocket', 'strip', 'core'],
    };
    return [preferred, ...alternativesByType[preferred]];
}
function pickFirstAvailable(ordered, used) {
    const available = ordered.find((value) => !used.has(value));
    return available ?? ordered[0];
}
function buildSignalCandidates(dominantCategories, reasonKeys) {
    const categoryCandidates = dominantCategories.slice(0, 3).map((category) => ({
        key: `category_${toKey(category)}`,
        label: toDisplayToken(category),
    }));
    const categoryBlend = dominantCategories.length >= 2
        ? {
            key: `category_blend_${toKey(dominantCategories[0])}_${toKey(dominantCategories[1])}`,
            label: `${toDisplayToken(dominantCategories[0])} + ${toDisplayToken(dominantCategories[1])}`,
        }
        : null;
    const reasonCandidates = reasonKeys.map((reasonKey) => ({
        key: `reason_${toKey(reasonKey)}`,
        label: resolveReasonTitleSignal(reasonKey),
    }));
    return unique([...categoryCandidates, categoryBlend, ...reasonCandidates]
        .filter((entry) => Boolean(entry))
        .map((entry) => `${entry.key}::${entry.label}`)).map((value) => {
        const [key, label] = value.split('::');
        return { key, label };
    });
}
function sanitizeTitleBlend(signal, pocketType) {
    const cleaned = signal
        .replace(/\b(event|events|district|pocket|cluster|core|strip|zone)\b/gi, '')
        .replace(/\s*\+\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const safe = cleaned.length > 0 ? cleaned : 'Balanced';
    const bounded = clampWords(safe, 4);
    if (bounded.toLowerCase().endsWith(pocketType)) {
        return bounded.slice(0, bounded.length - pocketType.length).trim();
    }
    return bounded;
}
function getAnchorPrefix(activationStrength, identityStrength, compactness, familyMode) {
    const metricPreferred = compactness >= 0.66 && activationStrength >= 0.6
        ? 'Centered around'
        : identityStrength >= 0.66
            ? 'Anchored by'
            : 'Built around';
    if (familyMode === 'neutral') {
        return metricPreferred;
    }
    const familyOrder = getFamilyAnchorOrder(familyMode);
    if (metricPreferred === familyOrder[0]) {
        return metricPreferred;
    }
    if (compactness >= 0.68 && familyOrder.includes('Centered around')) {
        return 'Centered around';
    }
    if (identityStrength >= 0.68 && familyOrder.includes('Anchored by')) {
        return 'Anchored by';
    }
    if (activationStrength >= 0.66 && familyOrder.includes('Built around')) {
        return 'Built around';
    }
    return familyOrder[0];
}
function getSubtitle(compactness, activationStrength) {
    const structure = compactness >= 0.66
        ? 'Dense overlap'
        : compactness >= 0.5
            ? 'Tighter layout'
            : 'Spread layout';
    const effect = activationStrength >= 0.66
        ? 'makes transitions quick.'
        : activationStrength >= 0.5
            ? 'keeps movement focused.'
            : 'supports steadier pacing.';
    return `${structure} ${effect}`;
}
function buildDensityBullet(compactness, activationStrength) {
    if (compactness >= 0.65 && activationStrength >= 0.65) {
        return 'High density and tight spacing keep hops short.';
    }
    if (compactness >= 0.5) {
        return 'Moderate density keeps transitions predictable.';
    }
    return 'Wider spacing supports a steadier progression.';
}
function buildMixBullet(dominantCategories, dominantLanes) {
    const categoryLabel = formatList(dominantCategories.map((value) => toDisplayToken(value)));
    const laneLabel = formatList(dominantLanes.map((value) => toDisplayToken(value)));
    return `Mix centers on ${categoryLabel} with ${laneLabel} support.`;
}
function buildTransitionBullet(reasonKeys, fallbackBullets) {
    const reason = reasonKeys[0];
    if (reason) {
        return resolveReasonTemplate(reason);
    }
    return fallbackBullets[0] ?? 'Category overlap keeps route changes manageable.';
}
function getFamilyContrastBullet(familyMode) {
    if (familyMode === 'social') {
        return 'Flow-first structure minimizes dead zones between social anchors.';
    }
    if (familyMode === 'cultural') {
        return 'Intentional sequencing keeps culture-forward stops coherent.';
    }
    if (familyMode === 'playful') {
        return 'Varied edges leave room for activity-led switch-ups.';
    }
    if (familyMode === 'intimate') {
        return 'Contained pacing favors closeness over broad circulation.';
    }
    if (familyMode === 'exploratory') {
        return 'Mixed adjacent signals support layered discovery paths.';
    }
    if (familyMode === 'ambient') {
        return 'Lower-friction edges let the area settle and unfold gradually.';
    }
    if (familyMode === 'eventful') {
        return 'High-energy anchors create punctuated peaks through the route.';
    }
    if (familyMode === 'ritual') {
        return 'Stepwise sequencing keeps the progression predictable and clean.';
    }
    if (familyMode === 'indulgent') {
        return 'Richer anchors favor staying depth-first over constant movement.';
    }
    return undefined;
}
function getSectionLabel(compactness, identityStrength) {
    if (compactness >= 0.6) {
        return 'Pocket shape';
    }
    if (identityStrength >= 0.62) {
        return 'What defines this area';
    }
    return 'Why this pocket works';
}
function buildSupportLine(activationStrength, environmentalInfluencePotential) {
    const activationBand = activationStrength >= 0.68
        ? 'strong overlap'
        : activationStrength >= 0.5
            ? 'steady overlap'
            : 'soft overlap';
    const influenceBand = environmentalInfluencePotential >= 0.66
        ? 'strong support influence'
        : environmentalInfluencePotential >= 0.5
            ? 'moderate support influence'
            : 'light support influence';
    return `Pocket shape: ${activationBand} + ${influenceBand}.`;
}
export function buildHyperlocalDirectionExpression(input) {
    const hyperlocal = extractHyperlocal(input);
    if (!hyperlocal) {
        return buildFallback(input);
    }
    const specificity = Math.max(0, Math.min(1, hyperlocal.localSpecificityScore ?? 0));
    const primaryPocket = hyperlocal.primaryMicroPocket ?? null;
    const primaryAnchor = hyperlocal.primaryAnchor ?? null;
    const reasonKeys = (hyperlocal.whyHereSignals ??
        primaryPocket?.reasonSignals ??
        []).slice(0, MAX_BULLETS);
    const fallbackBullets = (input.defaultBullets ?? []).slice(0, MAX_BULLETS);
    if (specificity < MEDIUM_SPECIFICITY_THRESHOLD || !primaryPocket) {
        return {
            ...buildFallback(input),
            localSpecificityScore: specificity,
            templateKeys: reasonKeys,
        };
    }
    const activationStrength = clamp(primaryPocket.activationStrength ?? 0.5, 0, 1);
    const identityStrength = clamp(primaryPocket.identityStrength ?? 0.5, 0, 1);
    const environmentalInfluencePotential = clamp(primaryPocket.environmentalInfluencePotential ?? 0.5, 0, 1);
    const radiusM = primaryPocket.radiusM ?? 130;
    const compactness = getCompactness(radiusM);
    const dominantCategories = primaryPocket.dominantCategories ?? [];
    const dominantLanes = primaryPocket.dominantLanes ?? [];
    const candidateIdentity = input.candidate;
    const familyMode = getExpressionFamilyMode(candidateIdentity?.experienceFamily, candidateIdentity?.familyConfidence);
    const familyTemplateKeys = getFamilyTemplateKeys(familyMode);
    const usedPrimarySignals = toSet(input.usedPrimarySignals);
    const usedPocketTypes = toSet(input.usedPocketTypes);
    const signalCandidates = buildSignalCandidates(dominantCategories, reasonKeys);
    const selectedSignal = pickFirstAvailable(signalCandidates.map((entry) => entry.key), usedPrimarySignals);
    const selectedSignalLabel = signalCandidates.find((entry) => entry.key === selectedSignal)?.label ?? 'Balanced Mix';
    const pocketTypeOrder = getPocketTypeOrder(radiusM, compactness, activationStrength, identityStrength);
    const selectedPocketType = pickFirstAvailable(pocketTypeOrder, usedPocketTypes);
    const blend = sanitizeTitleBlend(selectedSignalLabel, selectedPocketType);
    const title = input.preferDefaultTitle ? input.defaultTitle : `${blend} ${selectedPocketType}`;
    const subtitle = input.preferDefaultSubtitle
        ? input.defaultSubtitle
        : specificity >= HIGH_SPECIFICITY_THRESHOLD
            ? getFamilySubtitleTemplate(familyMode) ?? getSubtitle(compactness, activationStrength)
            : input.defaultSubtitle ??
                getFamilySubtitleTemplate(familyMode) ??
                getSubtitle(compactness, activationStrength);
    const anchorName = (primaryAnchor?.name ?? primaryAnchor?.entityName ?? '').trim();
    const usedPrimaryAnchor = anchorName.length > 0;
    const anchorPrefix = getAnchorPrefix(activationStrength, identityStrength, compactness, familyMode);
    const anchorLine = usedPrimaryAnchor
        ? anchorPrefix === 'Built around'
            ? `${anchorPrefix} ${anchorName} with nearby support`
            : `${anchorPrefix} ${anchorName}`
        : undefined;
    const bulletByKey = {
        density: buildDensityBullet(compactness, activationStrength),
        mix: buildMixBullet(dominantCategories, dominantLanes),
        transition: buildTransitionBullet(reasonKeys, fallbackBullets),
        contrast: getFamilyContrastBullet(familyMode),
    };
    const prioritizedBulletKeys = getFamilyBulletOrder(familyMode);
    const prioritizedBullets = prioritizedBulletKeys
        .map((key) => bulletByKey[key])
        .filter((value) => Boolean(value));
    const reasonBullets = reasonKeys.map((key) => resolveReasonTemplate(key));
    const bullets = unique([...prioritizedBullets, ...reasonBullets]).slice(0, MAX_BULLETS);
    const resolvedBullets = bullets.length >= MIN_BULLETS
        ? bullets
        : unique([...bullets, ...fallbackBullets]).slice(0, MAX_BULLETS);
    const supportLineBase = buildSupportLine(activationStrength, environmentalInfluencePotential);
    const familySupportEmphasis = getFamilySupportEmphasis(familyMode);
    const resolvedSupportLine = input.defaultSupportLine ??
        (familySupportEmphasis
            ? `${supportLineBase} ${familySupportEmphasis}`
            : supportLineBase);
    return {
        title,
        subtitle,
        anchorLine,
        supportLine: resolvedSupportLine,
        sectionLabel: getSectionLabel(compactness, identityStrength),
        bullets: resolvedBullets,
        expressionMode: usedPrimaryAnchor ? 'hyperlocal_anchor' : 'hyperlocal_pocket',
        localSpecificityScore: specificity,
        usedPrimaryMicroPocket: true,
        usedPrimaryAnchor,
        templateKeys: [...reasonKeys, ...familyTemplateKeys],
        primarySignalKey: selectedSignal,
        pocketType: selectedPocketType,
    };
}
