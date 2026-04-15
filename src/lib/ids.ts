let runningId = 0

export function createId(prefix: string): string {
  runningId = (runningId + 1) % 1_000_000
  return `${prefix}_${Date.now().toString(36)}_${runningId.toString(36)}`
}

export function deterministicTiebreaker(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash % 10_000) / 10_000
}
