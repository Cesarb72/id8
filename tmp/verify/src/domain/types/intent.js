export const vibeOptions = [
    { value: 'cozy', label: 'Cozy', sublabel: 'warm | intimate | relaxed' },
    { value: 'lively', label: 'Lively', sublabel: 'energetic | social | buzzing' },
    { value: 'playful', label: 'Playful', sublabel: 'fun | active | interactive' },
    { value: 'cultured', label: 'Cultured', sublabel: 'arts | music | thoughtful' },
    { value: 'chill', label: 'Chill', sublabel: 'easygoing | casual | low-pressure' },
    {
        value: 'adventurous-outdoor',
        label: 'Adventurous (Outdoor)',
        sublabel: 'scenic | open-air | exploratory',
    },
    {
        value: 'adventurous-urban',
        label: 'Adventurous (Urban)',
        sublabel: 'local | wandering | discovery',
    },
];
const vibeLabels = {
    cozy: 'Cozy',
    lively: 'Lively',
    playful: 'Playful',
    cultured: 'Cultured',
    chill: 'Chill',
    'adventurous-outdoor': 'Adventurous (Outdoor)',
    'adventurous-urban': 'Adventurous (Urban)',
    culinary: 'Culinary',
    creative: 'Creative',
    culture: 'Culture',
    outdoors: 'Outdoors',
    relaxed: 'Relaxed',
};
export function getVibeLabel(value) {
    return vibeLabels[value];
}
export function getVibeSublabel(value) {
    return vibeOptions.find((option) => option.value === value)?.sublabel ?? '';
}
