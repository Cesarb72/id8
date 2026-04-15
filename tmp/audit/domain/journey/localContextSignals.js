const LOCAL_CONTEXT_BY_ROLE = {
    start: {
        mapLabels: ['quiet pocket'],
        aroundHereSignals: [
            'Quieter entry pocket with easier seating nearby',
            'Lower foot traffic before the district peaks',
        ],
        nearbyMarkers: [
            { kind: 'quiet' },
            { kind: 'food' },
            { kind: 'quiet' },
            { kind: 'food' },
        ],
    },
    highlight: {
        mapLabels: ['energy building'],
        aroundHereSignals: [
            'Live music and bar traffic build around this block',
            'Crowd energy rises quickly after peak-hour handoff',
        ],
        nearbyMarkers: [
            { kind: 'music' },
            { kind: 'food' },
            { kind: 'music' },
            { kind: 'quiet' },
            { kind: 'music' },
            { kind: 'food' },
        ],
    },
    windDown: {
        mapLabels: ['late-night spots'],
        aroundHereSignals: [
            'Dessert and late tea options stay open nearby',
            'Quieter side streets make exits smoother',
        ],
        nearbyMarkers: [
            { kind: 'food' },
            { kind: 'quiet' },
            { kind: 'food' },
            { kind: 'quiet' },
            { kind: 'food' },
        ],
    },
    surprise: {
        mapLabels: ['local pocket'],
        aroundHereSignals: [
            'Flexible nearby options if plans shift',
            'Good pivot point without long detours',
        ],
        nearbyMarkers: [
            { kind: 'music' },
            { kind: 'food' },
            { kind: 'quiet' },
            { kind: 'food' },
        ],
    },
};
export function getLocalContextForRole(role) {
    return LOCAL_CONTEXT_BY_ROLE[role] ?? LOCAL_CONTEXT_BY_ROLE.highlight;
}
