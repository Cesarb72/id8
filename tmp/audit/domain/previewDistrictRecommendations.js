import { buildRolePools } from './arc/buildRolePools';
import { getRoleContract } from './contracts/getRoleContract';
import { recommendDistricts } from './interpretation/district/recommendDistricts';
import { buildExperienceLens } from './intent/buildExperienceLens';
import { getCrewPolicy } from './intent/getCrewPolicy';
import { normalizeIntent } from './intent/normalizeIntent';
import { retrieveVenues } from './retrieval/retrieveVenues';
import { scoreVenueCollection } from './retrieval/scoreVenueFit';
export async function previewDistrictRecommendations(input, options = {}) {
    const intent = normalizeIntent({
        ...input,
        district: undefined,
    });
    const lens = buildExperienceLens({
        intent,
        starterPack: options.starterPack,
        strictShape: options.strictShape,
    });
    const crewPolicy = getCrewPolicy(intent.crew);
    const roleContracts = getRoleContract({
        intent,
        starterPack: options.starterPack,
        strictShapeEnabled: options.strictShape,
    });
    const retrieval = await retrieveVenues(intent, lens, {
        requestedSourceMode: options.sourceMode,
        sourceModeOverrideApplied: options.sourceModeOverrideApplied,
        starterPack: options.starterPack,
    });
    const scoredVenues = scoreVenueCollection(retrieval.venues, intent, crewPolicy, lens, roleContracts, options.starterPack);
    const rolePools = buildRolePools(scoredVenues, crewPolicy, lens, intent, roleContracts, options.strictShape);
    const recommendedDistricts = recommendDistricts({
        scoredVenues,
        rolePools,
        intent,
        limit: 3,
    });
    return {
        recommendedDistricts,
        topDistrictId: recommendedDistricts[0]?.districtId,
    };
}
