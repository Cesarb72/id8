function toPriceLevel(priceTier) {
    if (priceTier === '$') {
        return 1;
    }
    if (priceTier === '$$') {
        return 2;
    }
    if (priceTier === '$$$') {
        return 3;
    }
    return 4;
}
function targetBudgetLevel(budget) {
    if (!budget) {
        return null;
    }
    if (budget === 'value') {
        return 1.5;
    }
    if (budget === 'balanced') {
        return 2.5;
    }
    return 3.5;
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
export function scoreBudgetFit(venue, budget) {
    const target = targetBudgetLevel(budget);
    if (target === null) {
        return 0.8;
    }
    const level = toPriceLevel(venue.priceTier);
    const distance = Math.abs(level - target);
    return clamp01(1 - distance / 3);
}
