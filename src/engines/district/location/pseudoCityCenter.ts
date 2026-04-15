import type { DistrictPoint } from '../types/districtTypes'

export function normalizeCityKey(value: string | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase().replace(/\./g, '')
  const [head] = normalized.split(',')
  return (head ?? normalized).replace(/\s+/g, ' ').trim()
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hashToUnit(value: string): number {
  return hashString(value) / 4294967295
}

export function getPseudoCityCenter(city: string): DistrictPoint {
  const cityKey = normalizeCityKey(city) || 'unknown'
  const lat = 30.5 + hashToUnit(`${cityKey}:lat`) * 11.5
  const lng = -121.5 + hashToUnit(`${cityKey}:lng`) * 23.5
  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
  }
}
