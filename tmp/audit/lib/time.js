export function nowIso() {
    return new Date().toISOString();
}
export function formatReadableDate(input) {
    const date = new Date(input);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}
