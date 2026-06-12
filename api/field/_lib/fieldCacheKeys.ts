import { createHash } from 'node:crypto'
import type { FieldTextSearchRequest } from '../../../src/domain/field/fieldProxyTypes.js'

export interface FieldCacheKeyInput {
  date: string
  environment: string
  request: FieldTextSearchRequest
}

function normalizeKeyPart(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._:-]+/g, '-')
  return normalized ? normalized.replace(/^-+|-+$/g, '') : fallback
}

export function buildFieldQueryHash(textQuery: string): string {
  const normalized = textQuery.trim().toLowerCase().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export function buildFieldCenterBucket(center: FieldTextSearchRequest['center']): string {
  if (!center) {
    return 'no-center'
  }
  return `${center.lat.toFixed(3)}:${center.lng.toFixed(3)}`
}

export function buildFieldRadiusBucket(radiusMeters: number | undefined): string {
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters)) {
    return 'radius-default'
  }
  const bucket = Math.max(250, Math.round(radiusMeters / 250) * 250)
  return `radius-${bucket}`
}

export function buildFieldContextKey(context: FieldTextSearchRequest['context']): string {
  if (!context) {
    return 'no-context'
  }
  return [
    `starter=${normalizeKeyPart(context.starterId, 'none')}`,
    `vibe=${normalizeKeyPart(context.vibe, 'none')}`,
    `persona=${normalizeKeyPart(context.persona, 'none')}`,
    `time=${normalizeKeyPart(context.timeWindow, 'none')}`,
    `neighborhood=${normalizeKeyPart(context.neighborhood, 'none')}`,
    // Intentionally omit raw sessionId from cache keys and logs.
  ].join('|')
}

export function buildFieldTextSearchCacheKey(input: FieldCacheKeyInput): string {
  const request = input.request
  return [
    'field',
    'v1',
    normalizeKeyPart(input.environment, 'unknown-env'),
    normalizeKeyPart(input.date, 'unknown-date'),
    normalizeKeyPart(request.city, 'unknown-city'),
    request.mode,
    request.purpose,
    buildFieldContextKey(request.context),
    normalizeKeyPart(request.queryLabel, 'unknown-query-label'),
    buildFieldQueryHash(request.textQuery),
    buildFieldCenterBucket(request.center),
    buildFieldRadiusBucket(request.radiusMeters),
  ].join(':')
}
