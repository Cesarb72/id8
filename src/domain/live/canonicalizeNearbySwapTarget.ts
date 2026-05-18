import type { NearbyPlaceRecord } from '../nearby/fetchNearbyPlacesForWaypoint'
import { createLiveGoogleVenueId } from '../providers/admitLiveVenueIdentity'

export type NearbySwapCategory = NearbyPlaceRecord['category']
export type NearbySwapOptionContract = NearbyPlaceRecord

type NearbySwapCanonicalizationFailureCode =
  | 'missing_selected_option_id'
  | 'option_not_found'
  | 'duplicate_option_id'
  | 'invalid_option_id'
  | 'invalid_provider_record_id'
  | 'invalid_option_name'
  | 'invalid_option_minutes'
  | 'invalid_option_coordinates'
  | 'invalid_source_origin'
  | 'invalid_provider'
  | 'invalid_normalized_from_raw_type'
  | 'invalid_source_query_label'
  | 'invalid_source_provider_record_id'
  | 'invalid_source_query_label_mismatch'
  | 'invalid_source_provider_mismatch'
  | 'invalid_source_origin_mismatch'
  | 'invalid_source_normalized_type_mismatch'
  | 'invalid_identity_mismatch'

interface NearbySwapCanonicalizationFailure {
  ok: false
  code: NearbySwapCanonicalizationFailureCode
}

interface NearbySwapCanonicalizationSuccess {
  ok: true
  canonicalOption: NearbySwapOptionContract
}

export type NearbySwapCanonicalizationResult =
  | NearbySwapCanonicalizationFailure
  | NearbySwapCanonicalizationSuccess

function isFiniteCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

export function canonicalizeNearbySwapTarget(input: {
  selectedOptionId: string | null | undefined
  nearbyOptions: NearbySwapOptionContract[]
}): NearbySwapCanonicalizationResult {
  const selectedOptionId = input.selectedOptionId?.trim()
  if (!selectedOptionId) {
    return {
      ok: false,
      code: 'missing_selected_option_id',
    }
  }

  const matchingOptions = input.nearbyOptions.filter((option) => option.id === selectedOptionId)
  if (matchingOptions.length === 0) {
    return {
      ok: false,
      code: 'option_not_found',
    }
  }
  if (matchingOptions.length > 1) {
    return {
      ok: false,
      code: 'duplicate_option_id',
    }
  }

  const option = matchingOptions[0]
  if (!option) {
    return {
      ok: false,
      code: 'option_not_found',
    }
  }

  const canonicalId = option.id.trim()
  if (!canonicalId) {
    return {
      ok: false,
      code: 'invalid_option_id',
    }
  }
  const canonicalProviderRecordId = option.providerRecordId.trim()
  if (!canonicalProviderRecordId) {
    return {
      ok: false,
      code: 'invalid_provider_record_id',
    }
  }

  const canonicalName = option.name.trim()
  if (!canonicalName) {
    return {
      ok: false,
      code: 'invalid_option_name',
    }
  }

  if (!Number.isFinite(option.minutesAway) || option.minutesAway <= 0 || option.minutesAway > 180) {
    return {
      ok: false,
      code: 'invalid_option_minutes',
    }
  }

  const [longitude, latitude] = option.coordinates
  if (
    !isFiniteCoordinate(longitude, -180, 180) ||
    !isFiniteCoordinate(latitude, -90, 90)
  ) {
    return {
      ok: false,
      code: 'invalid_option_coordinates',
    }
  }
  if (option.sourceOrigin !== 'live') {
    return {
      ok: false,
      code: 'invalid_source_origin',
    }
  }
  if (option.provider !== 'google-places') {
    return {
      ok: false,
      code: 'invalid_provider',
    }
  }
  if (option.normalizedFromRawType !== 'raw-place') {
    return {
      ok: false,
      code: 'invalid_normalized_from_raw_type',
    }
  }
  const canonicalSourceQueryLabel = option.sourceQueryLabel.trim()
  if (!canonicalSourceQueryLabel) {
    return {
      ok: false,
      code: 'invalid_source_query_label',
    }
  }
  const sourceProviderRecordId = option.source.providerRecordId.trim()
  if (!sourceProviderRecordId) {
    return {
      ok: false,
      code: 'invalid_source_provider_record_id',
    }
  }
  if (sourceProviderRecordId !== canonicalProviderRecordId) {
    return {
      ok: false,
      code: 'invalid_source_provider_record_id',
    }
  }
  if (option.source.sourceQueryLabel.trim() !== canonicalSourceQueryLabel) {
    return {
      ok: false,
      code: 'invalid_source_query_label_mismatch',
    }
  }
  if (option.source.provider !== option.provider) {
    return {
      ok: false,
      code: 'invalid_source_provider_mismatch',
    }
  }
  if (option.source.sourceOrigin !== option.sourceOrigin) {
    return {
      ok: false,
      code: 'invalid_source_origin_mismatch',
    }
  }
  if (option.source.normalizedFromRawType !== option.normalizedFromRawType) {
    return {
      ok: false,
      code: 'invalid_source_normalized_type_mismatch',
    }
  }
  if (canonicalId !== createLiveGoogleVenueId(canonicalProviderRecordId)) {
    return {
      ok: false,
      code: 'invalid_identity_mismatch',
    }
  }

  return {
    ok: true,
    canonicalOption: {
      ...option,
      id: canonicalId,
      providerRecordId: canonicalProviderRecordId,
      name: canonicalName,
      minutesAway: Math.round(option.minutesAway),
      coordinates: [longitude, latitude],
      sourceQueryLabel: canonicalSourceQueryLabel,
      source: {
        ...option.source,
        providerRecordId: sourceProviderRecordId,
        sourceQueryLabel: canonicalSourceQueryLabel,
      },
    },
  }
}
