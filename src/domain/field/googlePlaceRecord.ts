import type { HoursPeriod } from '../types/hours'

export interface GooglePlaceRecord {
  id?: string
  displayName?: {
    text?: string
  }
  primaryType?: string
  types?: string[]
  liveMusic?: boolean
  servesBeer?: boolean
  servesWine?: boolean
  goodForGroups?: boolean
  goodForChildren?: boolean
  allowsDogs?: boolean
  servesVegetarianFood?: boolean
  formattedAddress?: string
  shortFormattedAddress?: string
  addressComponents?: Array<{
    longText?: string
    shortText?: string
    types?: string[]
  }>
  editorialSummary?: {
    text?: string
  }
  businessStatus?: string
  currentOpeningHours?: {
    openNow?: boolean
    weekdayDescriptions?: string[]
    periods?: GoogleHoursPeriod[]
  }
  regularOpeningHours?: {
    weekdayDescriptions?: string[]
    periods?: GoogleHoursPeriod[]
  }
  priceLevel?: string
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  utcOffsetMinutes?: number
  location?: {
    latitude?: number
    longitude?: number
  }
}

export type GoogleHoursPeriod = {
  open?: {
    day?: number
    hour?: number
    minute?: number
  }
  close?: {
    day?: number
    hour?: number
    minute?: number
  }
}

export function mapGoogleHoursPeriods(
  periods: GoogleHoursPeriod[] | undefined,
): HoursPeriod[] | undefined {
  if (!periods || periods.length === 0) {
    return undefined
  }

  return periods
    .map((period) => ({
      open:
        period.open?.day === undefined ||
        period.open.hour === undefined ||
        period.open.minute === undefined
          ? undefined
          : {
              day: period.open.day,
              hour: period.open.hour,
              minute: period.open.minute,
            },
      close:
        period.close?.day === undefined ||
        period.close.hour === undefined ||
        period.close.minute === undefined
          ? undefined
          : {
              day: period.close.day,
              hour: period.close.hour,
              minute: period.close.minute,
            },
    }))
    .filter((period) => period.open || period.close)
}
