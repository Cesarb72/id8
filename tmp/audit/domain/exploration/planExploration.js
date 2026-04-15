import { runGeneratePlan } from '../runGeneratePlan';
import { buildContinuationDisplayItinerary } from './buildContinuationDisplayItinerary';
import { deriveNextContext } from './deriveNextContext';
export async function planExploration(input, options = {}) {
    const arc1 = await runGeneratePlan(input, {
        starterPack: options.starterPack,
        debugMode: options.debugMode,
        strictShape: options.strictShape,
        sourceMode: options.sourceMode,
        sourceModeOverrideApplied: options.sourceModeOverrideApplied,
    });
    const transition = deriveNextContext(arc1);
    const arc2 = await runGeneratePlan(transition.nextIntent, {
        starterPack: options.starterPack,
        debugMode: options.debugMode,
        strictShape: options.strictShape,
        sourceMode: options.sourceMode,
        sourceModeOverrideApplied: options.sourceModeOverrideApplied,
    });
    return {
        arc1,
        transition,
        arc2,
        displayItinerary: buildContinuationDisplayItinerary({
            arc1,
            transition,
            arc2,
            displayItinerary: arc2.itinerary,
        }),
    };
}
