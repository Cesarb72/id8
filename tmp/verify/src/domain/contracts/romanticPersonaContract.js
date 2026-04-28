function computeRomanticCenterpieceConviction(candidate) {
    const signals = candidate.taste.signals;
    const enrichment = signals.momentEnrichment;
    const atmosphericDepth = Math.max(signals.romanticSignals.ambiance, signals.romanticSignals.ambientExperience, enrichment.ambientUniqueness);
    const destinationFeel = Math.max(signals.destinationFactor, signals.anchorStrength, signals.momentPotential.score);
    const memorability = Math.max(candidate.venue.uniquenessScore, candidate.venue.distinctivenessScore, signals.momentIntensity.score);
    const hiddenGemSignal = Math.max(candidate.venue.underexposureScore, candidate.hiddenGemScore);
    const lingerGravity = Math.max(signals.lingerFactor, (signals.lingerFactor + signals.conversationFriendliness) / 2);
    const chefOrTastingSignal = candidate.venue.category === 'restaurant' &&
        (candidate.venue.tags.some((tag) => ['chef-led', 'tasting-menu', 'wine-pairing', 'reservation', 'omakase'].includes(tag.toLowerCase())) ||
            candidate.venue.subcategory.toLowerCase().includes('tasting') ||
            candidate.venue.subcategory.toLowerCase().includes('omakase') ||
            candidate.venue.subcategory.toLowerCase().includes('atelier'));
    const viewBackedDiningSignal = (signals.primaryExperienceArchetype === 'dining' ||
        signals.primaryExperienceArchetype === 'drinks' ||
        signals.primaryExperienceArchetype === 'sweet') &&
        signals.romanticSignals.scenic >= 0.52 &&
        signals.romanticSignals.intimacy >= 0.56 &&
        atmosphericDepth >= 0.56;
    const score = Math.max(0, Math.min(1, destinationFeel * 0.26 +
        atmosphericDepth * 0.22 +
        lingerGravity * 0.14 +
        memorability * 0.18 +
        hiddenGemSignal * 0.1 +
        (chefOrTastingSignal ? 0.08 : 0) +
        (viewBackedDiningSignal ? 0.08 : 0)));
    const qualifiers = [];
    const missing = [];
    if (destinationFeel >= 0.68)
        qualifiers.push('destination feel');
    else
        missing.push('destination feel');
    if (atmosphericDepth >= 0.6)
        qualifiers.push('atmospheric depth');
    else
        missing.push('atmospheric depth');
    if (lingerGravity >= 0.62)
        qualifiers.push('linger gravity');
    else
        missing.push('linger gravity');
    if (memorability >= 0.66)
        qualifiers.push('memorability');
    else
        missing.push('memorability');
    if (chefOrTastingSignal || viewBackedDiningSignal)
        qualifiers.push('date-destination dining');
    if (hiddenGemSignal >= 0.66)
        qualifiers.push('hidden gem pull');
    return {
        score,
        qualifies: score >= 0.64 &&
            destinationFeel >= 0.62 &&
            atmosphericDepth >= 0.56 &&
            memorability >= 0.6,
        qualifiers,
        missing: missing.slice(0, 3),
    };
}
export function isRomanticPersonaContractActive(lens) {
    return lens.resolvedContract?.persona === 'romantic';
}
export function requiresRomanticPersonaMoment(lens) {
    return Boolean(isRomanticPersonaContractActive(lens) &&
        lens.resolvedContract?.highlight.requiresMomentPresence);
}
export function getRomanticPersonaHighlightType(candidate, lens) {
    return assessRomanticPersonaHighlightQualification(candidate, lens).highlightType;
}
export function scopeRomanticHighlightCandidatesByMomentTier(candidates, lens) {
    if (!lens || !isRomanticPersonaContractActive(lens) || candidates.length === 0) {
        return {
            candidates,
            appliedTier: 'none',
            fallbackUsed: false,
        };
    }
    const anchorCandidates = candidates.filter((candidate) => candidate.taste.signals.momentTier === 'anchor');
    if (anchorCandidates.length > 0) {
        return {
            candidates: anchorCandidates,
            appliedTier: 'anchor',
            fallbackUsed: false,
        };
    }
    const builderCandidates = candidates.filter((candidate) => candidate.taste.signals.momentTier === 'builder');
    if (builderCandidates.length > 0) {
        return {
            candidates: builderCandidates,
            appliedTier: 'builder',
            fallbackUsed: true,
        };
    }
    const supportCandidates = candidates.filter((candidate) => candidate.taste.signals.momentTier === 'support');
    return {
        candidates: supportCandidates.length > 0 ? supportCandidates : candidates,
        appliedTier: 'support',
        fallbackUsed: true,
    };
}
export function assessRomanticPersonaHighlightQualification(candidate, lens) {
    const archetype = candidate.taste.signals.primaryExperienceArchetype;
    const signals = candidate.taste.signals.romanticSignals;
    const enrichment = candidate.taste.signals.momentEnrichment;
    const conviction = computeRomanticCenterpieceConviction(candidate);
    const family = candidate.taste.signals.experienceFamily;
    const atmosphericStrength = Math.max(signals.ambiance, signals.ambientExperience, enrichment.ambientUniqueness);
    const momentTier = candidate.taste.signals.momentTier;
    const cozyRomanticHighlightMode = lens?.resolvedContract?.persona === 'romantic' &&
        lens.resolvedContract.primaryVibe === 'cozy';
    const standardIntensity = candidate.taste.signals.momentIntensity.score >= 0.74 &&
        candidate.taste.signals.momentPotential.score >= 0.6;
    const expandedIntensity = candidate.taste.signals.momentIntensity.score >= 0.64 &&
        (candidate.taste.signals.momentPotential.score >= 0.5 ||
            candidate.taste.signals.experientialFactor >= 0.66 ||
            candidate.venue.signatureStrength >= 0.68);
    const experientialDiningIntensity = candidate.taste.signals.momentIntensity.score >= 0.6 &&
        (candidate.taste.signals.momentPotential.score >= 0.48 ||
            candidate.taste.signals.experientialFactor >= 0.68 ||
            candidate.venue.signatureStrength >= 0.7);
    const lowChaos = candidate.venue.energyLevel <= 3 &&
        candidate.taste.signals.energy <= 0.72 &&
        enrichment.socialEnergy <= 0.7;
    const groupDominant = candidate.taste.signals.socialDensity >= 0.74 &&
        enrichment.socialEnergy >= 0.72 &&
        signals.intimacy < 0.56;
    const hospitalityPrimary = archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet';
    const genericHospitalityOnly = hospitalityPrimary &&
        enrichment.ambientUniqueness < 0.54 &&
        enrichment.culturalDepth < 0.48 &&
        atmosphericStrength < 0.6 &&
        signals.intimacy < 0.66 &&
        candidate.venue.signature.genericScore >= 0.42;
    const weakCenterpieceConviction = !conviction.qualifies;
    const dateShapedProfile = candidate.taste.signals.experientialFactor >= 0.64 ||
        candidate.taste.signals.anchorStrength >= 0.68 ||
        candidate.venue.signatureStrength >= 0.68;
    const intimateAtmosphere = signals.intimacy >= 0.54 ||
        signals.ambiance >= 0.58 ||
        signals.ambientExperience >= 0.52 ||
        (atmosphericStrength >= 0.5 &&
            enrichment.ambientUniqueness >= 0.48 &&
            candidate.taste.signals.experientialFactor >= 0.66);
    const ambientCulturalCompatible = family === 'ambient_indoor' ||
        family === 'immersive_cultural' ||
        family === 'cultural' ||
        candidate.venue.category === 'live_music' ||
        candidate.venue.category === 'museum';
    const experientialDiningCompatible = family === 'intimate_dining' &&
        candidate.venue.signature.genericScore < 0.36 &&
        candidate.venue.signatureStrength >= 0.68 &&
        candidate.taste.signals.experientialFactor >= 0.66 &&
        enrichment.ambientUniqueness >= 0.48;
    const expandedAtmosphericDepth = atmosphericStrength >= 0.58 &&
        (enrichment.ambientUniqueness >= 0.48 ||
            enrichment.culturalDepth >= 0.42 ||
            signals.ambiance >= 0.62 ||
            signals.ambientExperience >= 0.5);
    const experientialDiningDepth = atmosphericStrength >= 0.5 &&
        enrichment.ambientUniqueness >= 0.48 &&
        candidate.taste.signals.experientialFactor >= 0.66;
    const expandedPathEligible = (ambientCulturalCompatible && expandedIntensity && expandedAtmosphericDepth) ||
        (experientialDiningCompatible && experientialDiningIntensity && experientialDiningDepth);
    const romanticDestinationReady = conviction.qualifies &&
        conviction.score >= (cozyRomanticHighlightMode ? 0.68 : 0.64);
    const cozyRomanticScenicRequiresExceptional = cozyRomanticHighlightMode &&
        (archetype === 'outdoor' || archetype === 'scenic' || signals.scenic >= 0.56) &&
        conviction.score < 0.74;
    if (momentTier === 'support') {
        return {
            qualifies: false,
            expanded: false,
            reason: 'support-tier moment is not centerpiece-capable',
        };
    }
    if (candidate.taste.signals.isRomanticMomentCandidate) {
        const scenicDepthLowForCozyRomantic = cozyRomanticHighlightMode &&
            (archetype === 'outdoor' || archetype === 'scenic' || signals.scenic >= 0.56) &&
            (atmosphericStrength < 0.62 ||
                signals.intimacy < 0.64 ||
                (enrichment.ambientUniqueness < 0.52 && enrichment.culturalDepth < 0.5) ||
                candidate.taste.signals.experientialFactor < 0.68);
        if (!scenicDepthLowForCozyRomantic &&
            !cozyRomanticScenicRequiresExceptional &&
            (archetype === 'outdoor' || archetype === 'scenic' || signals.scenic >= 0.56)) {
            return {
                qualifies: true,
                highlightType: 'scenic',
                expanded: false,
                reason: `centerpiece ${conviction.score.toFixed(2)} | scenic romantic path`,
            };
        }
        if (archetype === 'activity' ||
            (archetype === 'social' && signals.sharedActivity >= 0.56) ||
            signals.sharedActivity >= 0.6) {
            return {
                qualifies: true,
                highlightType: 'activity',
                expanded: false,
                reason: `centerpiece ${conviction.score.toFixed(2)} | shared-activity romantic path`,
            };
        }
        if (signals.ambientExperience >= 0.52 ||
            signals.ambiance >= 0.62 ||
            candidate.venue.category === 'live_music') {
            return {
                qualifies: true,
                highlightType: 'ambient',
                expanded: false,
                reason: `centerpiece ${conviction.score.toFixed(2)} | ambient romantic path`,
            };
        }
    }
    if (!lowChaos) {
        return {
            qualifies: false,
            expanded: false,
            reason: 'too much social/energy noise',
        };
    }
    if (groupDominant) {
        return {
            qualifies: false,
            expanded: false,
            reason: 'group-energy dominant',
        };
    }
    if (genericHospitalityOnly) {
        return {
            qualifies: false,
            expanded: false,
            reason: 'insufficient centerpiece conviction | generic hospitality without depth',
        };
    }
    if (weakCenterpieceConviction || !romanticDestinationReady) {
        return {
            qualifies: false,
            expanded: false,
            reason: `centerpiece conviction ${conviction.score.toFixed(2)} not complete | missing ${conviction.missing.join(', ') || 'destination depth'}`,
        };
    }
    if (!standardIntensity && !expandedIntensity && !experientialDiningIntensity) {
        return {
            qualifies: false,
            expanded: false,
            reason: 'insufficient intensity',
        };
    }
    if (!intimateAtmosphere) {
        return {
            qualifies: false,
            expanded: false,
            reason: 'insufficient intimate/atmospheric signal',
        };
    }
    if (!dateShapedProfile ||
        (enrichment.ambientUniqueness < 0.5 && enrichment.culturalDepth < 0.5)) {
        return {
            qualifies: false,
            expanded: false,
            reason: 'not date-shaped enough',
        };
    }
    if (archetype === 'outdoor' || archetype === 'scenic' || signals.scenic >= 0.56) {
        if (cozyRomanticScenicRequiresExceptional) {
            return {
                qualifies: false,
                expanded: false,
                reason: `centerpiece conviction ${conviction.score.toFixed(2)} below scenic-exception threshold`,
            };
        }
        return {
            qualifies: true,
            highlightType: 'scenic',
            expanded: false,
            reason: `centerpiece ${conviction.score.toFixed(2)} | scenic romantic path`,
        };
    }
    if (archetype === 'activity' ||
        (archetype === 'social' && signals.sharedActivity >= 0.56) ||
        signals.sharedActivity >= 0.6) {
        return {
            qualifies: true,
            highlightType: 'activity',
            expanded: false,
            reason: `centerpiece ${conviction.score.toFixed(2)} | shared-activity romantic path`,
        };
    }
    if (expandedPathEligible) {
        return {
            qualifies: true,
            highlightType: 'ambient',
            expanded: true,
            reason: experientialDiningCompatible
                ? `centerpiece ${conviction.score.toFixed(2)} | expanded experiential dining path`
                : `centerpiece ${conviction.score.toFixed(2)} | expanded ambient/cultural path`,
        };
    }
    return {
        qualifies: false,
        expanded: false,
        reason: 'qualification pattern not met',
    };
}
export function isExpandedRomanticHighlightCandidate(candidate) {
    return assessRomanticPersonaHighlightQualification(candidate).expanded;
}
export function satisfiesRomanticPersonaHighlightContract(candidate, lens) {
    const assessment = assessRomanticPersonaHighlightQualification(candidate, lens);
    return Boolean(isRomanticPersonaContractActive(lens) &&
        assessment.highlightType &&
        lens.resolvedContract?.highlight.preferredHighlightTypes.includes(assessment.highlightType));
}
