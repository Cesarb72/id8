import { mergePockets } from './mergePockets';
import { splitPocket } from './splitPocket';
export function refinePocketsWithSplitMerge(viablePockets) {
    const splitStage = viablePockets.flatMap((pocket) => splitPocket(pocket));
    const mergedStage = mergePockets(splitStage);
    return mergedStage.map((pocket) => ({
        ...pocket,
        refinement: {
            status: 'unchanged',
            actions: [
                {
                    action: 'keep',
                    note: 'Phase 1-3 pass-through refinement.',
                },
            ],
        },
    }));
}
