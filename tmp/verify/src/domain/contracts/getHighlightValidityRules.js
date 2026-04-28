export function getHighlightValidityRules(intent, starterPack) {
    switch (starterPack?.id) {
        case 'cozy-jazz-night':
        case 'live-music-loop':
            return {
                literalRequirementType: 'music-performance',
                literalRequirementLabel: 'Highlight requires a music or performance-capable venue.',
                literalRequirementStrength: 'hard',
                dateCentered: false,
                musicPack: true,
                outdoorPack: false,
            };
        case 'cozy-date-night':
            return {
                literalRequirementType: 'date-evening',
                literalRequirementLabel: 'Highlight should read as an adult, intimate date-night anchor.',
                literalRequirementStrength: 'strong',
                dateCentered: true,
                musicPack: false,
                outdoorPack: false,
            };
        case 'dessert-conversation':
            return {
                literalRequirementType: 'conversation-dessert',
                literalRequirementLabel: 'Highlight should center dessert, coffee, wine, or low-energy conversation.',
                literalRequirementStrength: 'strong',
                dateCentered: true,
                musicPack: false,
                outdoorPack: false,
            };
        case 'wine-slow-evening':
            return {
                literalRequirementType: 'wine-evening',
                literalRequirementLabel: 'Highlight should feel wine-led, intimate, and built for lingering.',
                literalRequirementStrength: 'strong',
                dateCentered: true,
                musicPack: false,
                outdoorPack: false,
            };
        case 'sunset-stroll':
            return {
                literalRequirementType: 'outdoor-anchor',
                literalRequirementLabel: 'Highlight should anchor the outing outdoors with scenic or open-air character.',
                literalRequirementStrength: 'strong',
                dateCentered: true,
                musicPack: false,
                outdoorPack: true,
            };
        case 'coffee-books':
            return {
                literalRequirementType: 'thoughtful-date',
                literalRequirementLabel: 'Highlight should feel thoughtful, quiet, and date-appropriate.',
                literalRequirementStrength: 'strong',
                dateCentered: true,
                musicPack: false,
                outdoorPack: false,
            };
        case 'park-and-ice-cream':
            return {
                literalRequirementType: 'outdoor-anchor',
                literalRequirementLabel: 'Highlight should stay family-friendly and open-air.',
                literalRequirementStrength: 'strong',
                dateCentered: false,
                musicPack: false,
                outdoorPack: true,
            };
        default:
            return {
                literalRequirementType: intent.primaryAnchor === 'adventurous-outdoor' ? 'outdoor-anchor' : undefined,
                literalRequirementLabel: intent.primaryAnchor === 'adventurous-outdoor'
                    ? 'Highlight should read as an outdoor anchor for this outing.'
                    : undefined,
                literalRequirementStrength: intent.primaryAnchor === 'adventurous-outdoor' ? 'strong' : undefined,
                dateCentered: intent.crew === 'romantic',
                musicPack: false,
                outdoorPack: intent.primaryAnchor === 'adventurous-outdoor',
            };
    }
}
