import { makeIdentityDecision } from './identityDecision';
import { computeIdentitySignals } from './identitySignals';
export function inferPocketIdentity(refinedPockets) {
    return refinedPockets.map((pocket) => {
        const signals = computeIdentitySignals(pocket);
        const identity = makeIdentityDecision(pocket, signals);
        return {
            ...pocket,
            identity,
        };
    });
}
