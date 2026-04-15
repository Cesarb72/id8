export type DevOriginMode = 'surprise' | 'curate' | 'build'

const DEV_ORIGIN_MODE_KEY = 'id8.dev.originMode'

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readDevOriginMode(): DevOriginMode | null {
  if (!canUseStorage()) {
    return null
  }
  try {
    const value = window.localStorage.getItem(DEV_ORIGIN_MODE_KEY)
    if (value === 'surprise' || value === 'curate' || value === 'build') {
      return value
    }
    return null
  } catch {
    return null
  }
}

export function writeDevOriginMode(mode: DevOriginMode): void {
  if (!canUseStorage()) {
    return
  }
  try {
    window.localStorage.setItem(DEV_ORIGIN_MODE_KEY, mode)
  } catch {
    // Ignore storage write failures in restricted contexts.
  }
}

export function resolveDevOriginMode(search: string): DevOriginMode | null {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(search)
    const modeHint = params.get('mode')
    if (modeHint === 'surprise' || modeHint === 'curate' || modeHint === 'build') {
      return modeHint
    }
  }
  return readDevOriginMode()
}

