import { computeLiveQualityFairness } from './computeLiveQualityFairness';
const emptyPressure = {
    boost: 0,
    penalty: 0,
    adjusted: false,
    notes: [],
};
export function computeRoleAwareHoursPressure(venue, role) {
    if (venue.source.sourceOrigin !== 'live') {
        return emptyPressure;
    }
    const notes = [];
    const supportRole = role === 'warmup' || role === 'cooldown';
    const strictRole = role === 'peak';
    const liveFairness = computeLiveQualityFairness(venue);
    const stronglyOpen = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= (strictRole ? 0.74 : supportRole ? 0.58 : 0.62);
    const moderatelyOpen = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= (strictRole ? 0.62 : supportRole ? 0.44 : 0.5);
    const uncertain = venue.source.hoursPressureLevel === 'unknown' ||
        (!venue.source.hoursKnown && venue.source.timeConfidence < (supportRole ? 0.58 : 0.62));
    const likelyClosed = !venue.source.likelyOpenForCurrentWindow &&
        venue.source.timeConfidence >= (strictRole ? 0.68 : supportRole ? 0.82 : 0.74);
    let boost = 0;
    let penalty = 0;
    if (stronglyOpen) {
        boost = strictRole ? 0.055 : supportRole ? 0.05 : 0.028;
        notes.push('strong time support for this role');
    }
    else if (moderatelyOpen) {
        boost = supportRole ? (liveFairness.supportRecoveryEligible ? 0.036 : 0.03) : strictRole ? 0.012 : 0.018;
        if (supportRole) {
            notes.push('moderate time support was accepted for support role');
        }
    }
    if (likelyClosed) {
        penalty = strictRole ? 0.18 : supportRole ? (liveFairness.supportRecoveryEligible ? 0.038 : 0.05) : 0.1;
        notes.push(strictRole ? 'highlight needs stronger hours confidence' : 'time confidence remained soft for this role');
    }
    else if (uncertain) {
        penalty = strictRole ? 0.06 : supportRole ? (liveFairness.supportRecoveryEligible ? 0.006 : 0.012) : 0.028;
        notes.push(strictRole
            ? 'highlight keeps a cautious penalty for time uncertainty'
            : liveFairness.supportRecoveryEligible
                ? 'support role kept a strong live venue in play despite hours ambiguity'
                : 'support role softened an otherwise generic hours penalty');
    }
    return {
        boost,
        penalty,
        adjusted: boost > 0 || penalty > 0,
        notes,
    };
}
