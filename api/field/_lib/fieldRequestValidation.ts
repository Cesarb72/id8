import type {
  FieldProxyMode,
  FieldProxyPurpose,
  FieldTextSearchRequest,
  FieldTextSearchResponse,
} from '../../../src/domain/field/fieldProxyTypes'
import { buildFieldQueryHash } from './fieldCacheKeys'

export type FieldRequestValidationFailureReason =
  | 'invalid_method'
  | 'invalid_json'
  | 'missing_purpose'
  | 'invalid_purpose'
  | 'missing_city'
  | 'unsupported_city'
  | 'missing_mode'
  | 'invalid_mode'
  | 'missing_query_label'
  | 'missing_text_query'
  | 'invalid_center'
  | 'invalid_radius'
  | 'invalid_page_size'
  | 'field_proxy_not_activated'
  | 'durable_store_unavailable'
  | 'daily_cap_exhausted'
  | 'provider_key_missing'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_error'

export type FieldRequestValidationResult =
  | {
      ok: true
      request: FieldTextSearchRequest
    }
  | {
      ok: false
      reason: FieldRequestValidationFailureReason
      statusCode: number
    }

const allowedPurposes = new Set<FieldProxyPurpose>([
  'retrieval_supply',
  'anchor_search',
  'waypoint_nearby',
  'field_refresh',
])

const allowedModes = new Set<FieldProxyMode>(['curate', 'surprise', 'build'])
const defaultBudgetCap = 32

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getStringField(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isSanJoseCity(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
  return (
    normalized === 'san jose' ||
    normalized === 'san jose, ca' ||
    normalized === 'san jose ca' ||
    normalized === 'san jose area'
  )
}

function validateCenter(value: unknown): FieldTextSearchRequest['center'] | null {
  if (value === undefined) {
    return undefined
  }
  if (!isRecord(value)) {
    return null
  }
  const lat = value.lat
  const lng = value.lng
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null
  }
  return { lat, lng }
}

function validateRadius(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 50000) {
    return null
  }
  return Math.round(value)
}

function validatePageSize(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) {
    return null
  }
  return value
}

function sanitizeOptionalContext(
  context: unknown,
): FieldTextSearchRequest['context'] | undefined {
  if (!isRecord(context)) {
    return undefined
  }
  const starterId = getStringField(context.starterId)
  const vibe = getStringField(context.vibe)
  const persona = getStringField(context.persona)
  const timeWindow = getStringField(context.timeWindow)
  const neighborhood = getStringField(context.neighborhood)
  const sessionId = getStringField(context.sessionId)
  const sanitized = {
    ...(starterId ? { starterId } : {}),
    ...(vibe ? { vibe } : {}),
    ...(persona ? { persona } : {}),
    ...(timeWindow ? { timeWindow } : {}),
    ...(neighborhood ? { neighborhood } : {}),
    ...(sessionId ? { sessionId } : {}),
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function validationFailure(
  reason: FieldRequestValidationFailureReason,
  statusCode: number,
): FieldRequestValidationResult {
  return { ok: false, reason, statusCode }
}

export function validateFieldProxyMethod(method: string | undefined): FieldRequestValidationResult | null {
  if (method !== 'POST') {
    return validationFailure('invalid_method', 405)
  }
  return null
}

export function parseFieldProxyJsonBody(body: unknown): FieldRequestValidationResult | { ok: true; body: unknown } {
  if (typeof body !== 'string') {
    return { ok: true, body }
  }
  try {
    return { ok: true, body: JSON.parse(body) as unknown }
  } catch {
    return validationFailure('invalid_json', 400)
  }
}

export function validateFieldTextSearchRequestBody(body: unknown): FieldRequestValidationResult {
  if (!isRecord(body)) {
    return validationFailure('invalid_json', 400)
  }

  const purpose = getStringField(body.purpose)
  if (!purpose) {
    return validationFailure('missing_purpose', 400)
  }
  if (!allowedPurposes.has(purpose as FieldProxyPurpose)) {
    return validationFailure('invalid_purpose', 400)
  }

  const city = getStringField(body.city)
  if (!city) {
    return validationFailure('missing_city', 400)
  }
  if (!isSanJoseCity(city)) {
    return validationFailure('unsupported_city', 400)
  }

  const mode = getStringField(body.mode)
  if (!mode) {
    return validationFailure('missing_mode', 400)
  }
  if (!allowedModes.has(mode as FieldProxyMode)) {
    return validationFailure('invalid_mode', 400)
  }

  const queryLabel = getStringField(body.queryLabel)
  if (!queryLabel) {
    return validationFailure('missing_query_label', 400)
  }

  const textQuery = getStringField(body.textQuery)
  if (!textQuery) {
    return validationFailure('missing_text_query', 400)
  }

  const center = validateCenter(body.center)
  if (center === null) {
    return validationFailure('invalid_center', 400)
  }

  const radiusMeters = validateRadius(body.radiusMeters)
  if (radiusMeters === null) {
    return validationFailure('invalid_radius', 400)
  }

  const pageSize = validatePageSize(body.pageSize)
  if (pageSize === null) {
    return validationFailure('invalid_page_size', 400)
  }

  return {
    ok: true,
    request: {
      purpose: purpose as FieldProxyPurpose,
      city,
      mode: mode as FieldProxyMode,
      queryLabel,
      textQuery,
      ...(center ? { center } : {}),
      ...(radiusMeters ? { radiusMeters } : {}),
      ...(pageSize ? { pageSize } : {}),
      ...(body.context ? { context: sanitizeOptionalContext(body.context) } : {}),
    },
  }
}

export function getFieldProxyBudgetSnapshot(date = new Date()): FieldTextSearchResponse['budget'] {
  const cap = Number.parseInt(process.env.ID8_PROVIDER_DAILY_CALL_CAP ?? '', 10)
  const resolvedCap = Number.isFinite(cap) && cap > 0 ? cap : defaultBudgetCap
  return {
    date: date.toISOString().slice(0, 10),
    cap: resolvedCap,
    used: 0,
    remaining: resolvedCap,
  }
}

export function buildFieldProxyBlockedResponse(params: {
  request?: FieldTextSearchRequest
  reason: FieldRequestValidationFailureReason
  date?: Date
  budget?: FieldTextSearchResponse['budget']
}): FieldTextSearchResponse {
  return {
    ok: false,
    cache: 'miss',
    budget: params.budget ?? getFieldProxyBudgetSnapshot(params.date),
    results: [],
    diagnostics: {
      purpose: params.request?.purpose ?? 'retrieval_supply',
      queryHash: params.request ? buildFieldQueryHash(params.request.textQuery) : 'unavailable',
      blockedReason: params.reason,
      errorCode: params.reason,
      resultCount: 0,
      callConsumed: false,
    },
  }
}
