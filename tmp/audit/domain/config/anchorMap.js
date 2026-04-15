import { getVibeProfile } from '../taste/getVibeProfile';
export const anchorMap = {
    cozy: {
        categories: getVibeProfile('cozy').preferredCategories,
        tags: getVibeProfile('cozy').preferredTags,
        idealEnergyRange: getVibeProfile('cozy').idealEnergyRange,
    },
    lively: {
        categories: getVibeProfile('lively').preferredCategories,
        tags: getVibeProfile('lively').preferredTags,
        idealEnergyRange: getVibeProfile('lively').idealEnergyRange,
    },
    playful: {
        categories: getVibeProfile('playful').preferredCategories,
        tags: getVibeProfile('playful').preferredTags,
        idealEnergyRange: getVibeProfile('playful').idealEnergyRange,
    },
    cultured: {
        categories: getVibeProfile('cultured').preferredCategories,
        tags: getVibeProfile('cultured').preferredTags,
        idealEnergyRange: getVibeProfile('cultured').idealEnergyRange,
    },
    chill: {
        categories: getVibeProfile('chill').preferredCategories,
        tags: getVibeProfile('chill').preferredTags,
        idealEnergyRange: getVibeProfile('chill').idealEnergyRange,
    },
    'adventurous-outdoor': {
        categories: getVibeProfile('adventurous-outdoor').preferredCategories,
        tags: getVibeProfile('adventurous-outdoor').preferredTags,
        idealEnergyRange: getVibeProfile('adventurous-outdoor').idealEnergyRange,
    },
    'adventurous-urban': {
        categories: getVibeProfile('adventurous-urban').preferredCategories,
        tags: getVibeProfile('adventurous-urban').preferredTags,
        idealEnergyRange: getVibeProfile('adventurous-urban').idealEnergyRange,
    },
};
