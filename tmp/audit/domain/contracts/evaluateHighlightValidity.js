import { getHighlightValidityRules } from './getHighlightValidityRules';
function normalizeTag(value) {
    return value.toLowerCase();
}
function normalizedTags(venue) {
    return new Set(venue.tags.map(normalizeTag));
}
function hasAnyTag(tags, candidates) {
    return candidates.some((candidate) => tags.has(normalizeTag(candidate)));
}
function hasCategory(venue, categories) {
    return categories.includes(venue.category);
}
function isMusicCapableVenue(venue, tags) {
    return (venue.settings.musicCapable ||
        venue.settings.performanceCapable ||
        venue.category === 'live_music' ||
        venue.category === 'event' ||
        hasAnyTag(tags, ['live', 'jazz', 'listening', 'performance', 'local-artists', 'small-stage']));
}
function isOutdoorAnchorVenue(venue, tags) {
    return (venue.settings.setting === 'outdoor' ||
        venue.settings.setting === 'hybrid' ||
        venue.category === 'park' ||
        hasAnyTag(tags, [
            'nature',
            'trail',
            'viewpoint',
            'scenic',
            'walkable',
            'fresh-air',
            'open-air',
            'stargazing',
            'stroll',
            'garden',
        ]));
}
function isFamilyCodedVenue(venue, tags) {
    return (venue.settings.familyFriendly ||
        hasAnyTag(tags, ['family-friendly', 'accessible']) ||
        (venue.category === 'museum' && hasAnyTag(tags, ['hands-on', 'learning', 'interactive'])) ||
        (venue.category === 'activity' && hasAnyTag(tags, ['games', 'arcade', 'outdoor-play', 'animals'])));
}
function isKidFocusedVenue(tags) {
    return hasAnyTag(tags, [
        'family-friendly',
        'hands-on',
        'learning',
        'outdoor-play',
        'animals',
        'arcade',
        'games',
    ]);
}
function isAdultSocialVenue(venue, tags) {
    return (venue.settings.adultSocial ||
        venue.category === 'bar' ||
        venue.category === 'live_music' ||
        hasAnyTag(tags, ['cocktails', 'wine', 'late-night', 'stylish', 'date-night']));
}
function isDateToneVenue(venue, tags) {
    return (venue.settings.dateFriendly ||
        hasCategory(venue, ['restaurant', 'bar', 'dessert', 'cafe', 'live_music']) ||
        hasAnyTag(tags, [
            'intimate',
            'cozy',
            'conversation',
            'romantic',
            'quiet',
            'craft',
            'wine',
            'chef-led',
            'tea-room',
        ]));
}
function isQuietLingeringVenue(venue, tags) {
    return (venue.energyLevel <= 2 ||
        hasAnyTag(tags, ['quiet', 'conversation', 'calm', 'cozy', 'soft-landing', 'tea-room', 'wine']));
}
function isThoughtfulVenue(venue, tags) {
    return (venue.category === 'museum' ||
        hasAnyTag(tags, ['thoughtful', 'quiet', 'curated', 'historic', 'heritage', 'artisan']));
}
function isIndoorCulturalFamilyVenue(venue, tags) {
    return (hasCategory(venue, ['museum', 'activity']) &&
        !isOutdoorAnchorVenue(venue, tags));
}
function computeCandidateTier(venue, intent, starterPack, tags) {
    if (venue.settings.highlightCapabilityTier === 'connective-only') {
        return 'connective-only';
    }
    if (venue.settings.highlightCapabilityTier === 'highlight-capable') {
        return 'highlight-capable';
    }
    if (hasCategory(venue, ['restaurant', 'bar', 'live_music', 'event'])) {
        return 'highlight-capable';
    }
    if (venue.category === 'museum') {
        return intent.primaryAnchor === 'cultured' ||
            starterPack?.id === 'coffee-books' ||
            starterPack?.id === 'museum-afternoon' ||
            intent.crew === 'curator'
            ? 'highlight-capable'
            : 'support-only';
    }
    if (venue.category === 'activity') {
        return intent.primaryAnchor === 'playful' ||
            intent.crew === 'curator' ||
            intent.primaryAnchor === 'adventurous-outdoor'
            ? 'highlight-capable'
            : 'support-only';
    }
    if (venue.category === 'park') {
        return isOutdoorAnchorVenue(venue, tags) ? 'highlight-capable' : 'support-only';
    }
    if (venue.category === 'dessert') {
        return starterPack?.id === 'dessert-conversation' ||
            starterPack?.id === 'cozy-date-night' ||
            starterPack?.id === 'sunset-stroll' ||
            (intent.crew === 'romantic' && isQuietLingeringVenue(venue, tags))
            ? 'highlight-capable'
            : 'support-only';
    }
    if (venue.category === 'cafe') {
        return starterPack?.id === 'coffee-books' ||
            starterPack?.id === 'dessert-conversation' ||
            (intent.primaryAnchor === 'chill' && isThoughtfulVenue(venue, tags))
            ? 'highlight-capable'
            : 'support-only';
    }
    return venue.settings.highlightCapabilityTier;
}
function literalRequirementSatisfied(requirementType, venue, tags) {
    switch (requirementType) {
        case 'music-performance':
            return isMusicCapableVenue(venue, tags);
        case 'date-evening':
            return (!isKidFocusedVenue(tags) &&
                (isAdultSocialVenue(venue, tags) ||
                    venue.category === 'restaurant' ||
                    venue.category === 'dessert' ||
                    (venue.category === 'museum' && isThoughtfulVenue(venue, tags))));
        case 'conversation-dessert':
            return (hasCategory(venue, ['dessert', 'cafe', 'bar']) &&
                isQuietLingeringVenue(venue, tags) &&
                venue.energyLevel <= 3);
        case 'wine-evening':
            return (hasCategory(venue, ['restaurant', 'bar']) &&
                (hasAnyTag(tags, ['wine', 'craft', 'intimate', 'conversation', 'chef-led', 'elevated']) ||
                    venue.priceTier === '$$$' ||
                    venue.priceTier === '$$$$'));
        case 'outdoor-anchor':
            return isOutdoorAnchorVenue(venue, tags);
        case 'thoughtful-date':
            return (hasCategory(venue, ['cafe', 'museum', 'dessert']) &&
                (isThoughtfulVenue(venue, tags) || isQuietLingeringVenue(venue, tags)));
        default:
            return true;
    }
}
export function evaluateHighlightValidity({ venue, intent, starterPack, }) {
    const rules = getHighlightValidityRules(intent, starterPack);
    const tags = normalizedTags(venue);
    const candidateTier = computeCandidateTier(venue, intent, starterPack, tags);
    const packLiteralRequirementSatisfied = literalRequirementSatisfied(rules.literalRequirementType, venue, tags);
    const matchedSignals = [];
    const violations = [];
    const personaVetoes = [];
    const contextVetoes = [];
    const musicCapable = isMusicCapableVenue(venue, tags);
    const outdoorAnchor = isOutdoorAnchorVenue(venue, tags);
    const familyCoded = isFamilyCodedVenue(venue, tags);
    const kidFocused = isKidFocusedVenue(tags);
    const adultSocial = isAdultSocialVenue(venue, tags);
    const dateTone = isDateToneVenue(venue, tags);
    const quietLingering = isQuietLingeringVenue(venue, tags);
    const thoughtful = isThoughtfulVenue(venue, tags);
    const strongLiveTimeSupport = venue.source.sourceOrigin === 'live' &&
        venue.source.likelyOpenForCurrentWindow &&
        venue.source.timeConfidence >= 0.72;
    const strongLiveHighlightSupport = venue.source.sourceOrigin === 'live' &&
        venue.source.qualityGateStatus === 'approved' &&
        venue.source.sourceConfidence >= 0.72 &&
        venue.source.qualityScore >= 0.72 &&
        venue.settings.highlightCapabilityTier === 'highlight-capable';
    if (strongLiveTimeSupport) {
        matchedSignals.push('hours signal supports current planning window');
    }
    if (strongLiveHighlightSupport) {
        matchedSignals.push('live record is strong enough to compete as a centerpiece');
    }
    if (venue.source.sourceOrigin === 'live' &&
        !venue.source.hoursKnown) {
        violations.push('live venue has unknown hours for the current planning window');
    }
    if (venue.source.sourceOrigin === 'live' &&
        !venue.source.likelyOpenForCurrentWindow &&
        venue.source.timeConfidence >= 0.78) {
        contextVetoes.push('Live highlight vetoed: venue appears closed for the current planning window.');
    }
    if (venue.source.sourceOrigin === 'live' &&
        (venue.source.businessStatus === 'temporarily-closed' ||
            venue.source.businessStatus === 'closed-permanently')) {
        contextVetoes.push(`Live highlight vetoed: venue is ${venue.source.businessStatus}.`);
    }
    if (candidateTier === 'highlight-capable') {
        matchedSignals.push('highlight-capable venue shape');
    }
    else if (candidateTier === 'support-only') {
        matchedSignals.push('support-shaped venue');
    }
    else {
        violations.push('connective-only venue shape');
    }
    if (musicCapable) {
        matchedSignals.push('music/performance-capable');
    }
    if (outdoorAnchor) {
        matchedSignals.push('outdoor anchor signal');
    }
    if (quietLingering) {
        matchedSignals.push('quiet lingering signal');
    }
    if (thoughtful) {
        matchedSignals.push('thoughtful cultural signal');
    }
    if (adultSocial || dateTone) {
        matchedSignals.push('adult date-appropriate tone');
    }
    if (intent.crew === 'romantic') {
        if (familyCoded || kidFocused) {
            personaVetoes.push('Romantic highlight vetoed: child or family-coded centerpiece.');
        }
        if (venue.category === 'museum' &&
            hasAnyTag(tags, ['hands-on', 'learning', 'interactive']) &&
            starterPack?.id !== 'coffee-books') {
            personaVetoes.push('Romantic highlight vetoed: generic daytime educational centerpiece.');
        }
    }
    if (intent.crew === 'curator') {
        if (adultSocial || hasAnyTag(tags, ['romantic', 'date-night'])) {
            personaVetoes.push('Family highlight vetoed: adult-social or date-coded centerpiece.');
        }
    }
    if (intent.primaryAnchor === 'adventurous-outdoor') {
        if (!outdoorAnchor && isIndoorCulturalFamilyVenue(venue, tags)) {
            contextVetoes.push('Adventure Outdoor vetoed: highlight is indoor-only and not an outdoor anchor.');
        }
    }
    if (rules.musicPack && !musicCapable) {
        violations.push('pack literal requirement missing: music/performance capability');
    }
    if (rules.outdoorPack && !outdoorAnchor) {
        violations.push('pack literal requirement missing: outdoor anchor');
    }
    if (rules.dateCentered && (familyCoded || kidFocused)) {
        contextVetoes.push('Date-centered highlight vetoed: family or kid-coded venue.');
    }
    if (starterPack?.id === 'dessert-conversation') {
        if (hasCategory(venue, ['activity', 'live_music', 'event']) || venue.energyLevel >= 4) {
            contextVetoes.push('Dessert & Conversation vetoed: highlight is too noisy or activity-heavy.');
        }
    }
    if (starterPack?.id === 'cozy-date-night') {
        if (hasCategory(venue, ['activity']) ||
            (hasCategory(venue, ['live_music', 'event']) && !quietLingering)) {
            contextVetoes.push('Cozy Date Night vetoed: highlight is too performance-led or activity-heavy.');
        }
    }
    if (starterPack?.id === 'sunset-stroll' && !outdoorAnchor && venue.category === 'museum') {
        contextVetoes.push('Sunset Stroll vetoed: indoor cultural highlight displaced the outdoor anchor.');
    }
    if (rules.literalRequirementLabel && packLiteralRequirementSatisfied) {
        matchedSignals.push('pack literal requirement satisfied');
    }
    const vetoReason = personaVetoes[0] ?? contextVetoes[0];
    if (vetoReason) {
        return {
            validForIntent: false,
            validityLevel: 'invalid',
            fallbackEligible: false,
            candidateTier,
            packLiteralRequirementLabel: rules.literalRequirementLabel,
            packLiteralRequirementSatisfied,
            vetoReason,
            matchedSignals: [...new Set(matchedSignals)],
            violations: [...new Set([...violations, ...personaVetoes, ...contextVetoes])],
            personaVetoes,
            contextVetoes,
        };
    }
    if (!packLiteralRequirementSatisfied) {
        if (rules.literalRequirementStrength === 'hard') {
            return {
                validForIntent: false,
                validityLevel: 'invalid',
                fallbackEligible: false,
                candidateTier,
                packLiteralRequirementLabel: rules.literalRequirementLabel,
                packLiteralRequirementSatisfied,
                vetoReason: rules.literalRequirementLabel,
                matchedSignals: [...new Set(matchedSignals)],
                violations: [...new Set(violations)],
                personaVetoes,
                contextVetoes,
            };
        }
        if (candidateTier === 'connective-only') {
            return {
                validForIntent: false,
                validityLevel: 'invalid',
                fallbackEligible: false,
                candidateTier,
                packLiteralRequirementLabel: rules.literalRequirementLabel,
                packLiteralRequirementSatisfied,
                vetoReason: 'Highlight candidate was too connective to carry the requested outing.',
                matchedSignals: [...new Set(matchedSignals)],
                violations: [...new Set(violations)],
                personaVetoes,
                contextVetoes,
            };
        }
        return {
            validForIntent: false,
            validityLevel: 'fallback',
            fallbackEligible: true,
            candidateTier,
            packLiteralRequirementLabel: rules.literalRequirementLabel,
            packLiteralRequirementSatisfied,
            matchedSignals: [...new Set(matchedSignals)],
            violations: [...new Set(violations)],
            personaVetoes,
            contextVetoes,
        };
    }
    if (candidateTier === 'connective-only') {
        return {
            validForIntent: false,
            validityLevel: 'invalid',
            fallbackEligible: false,
            candidateTier,
            packLiteralRequirementLabel: rules.literalRequirementLabel,
            packLiteralRequirementSatisfied,
            vetoReason: 'Highlight candidate was too connective to serve as the center of the outing.',
            matchedSignals: [...new Set(matchedSignals)],
            violations: [...new Set(violations)],
            personaVetoes,
            contextVetoes,
        };
    }
    if (candidateTier === 'support-only') {
        return {
            validForIntent: false,
            validityLevel: 'fallback',
            fallbackEligible: true,
            candidateTier,
            packLiteralRequirementLabel: rules.literalRequirementLabel,
            packLiteralRequirementSatisfied,
            matchedSignals: [...new Set(matchedSignals)],
            violations: [...new Set(violations)],
            personaVetoes,
            contextVetoes,
        };
    }
    return {
        validForIntent: true,
        validityLevel: 'valid',
        fallbackEligible: false,
        candidateTier,
        packLiteralRequirementLabel: rules.literalRequirementLabel,
        packLiteralRequirementSatisfied,
        matchedSignals: [...new Set(matchedSignals)],
        violations: [...new Set(violations)],
        personaVetoes,
        contextVetoes,
    };
}
