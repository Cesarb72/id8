export function nowIso(): string {
  return new Date().toISOString()
}

export function formatReadableDate(input: string): string {
  const date = new Date(input)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
