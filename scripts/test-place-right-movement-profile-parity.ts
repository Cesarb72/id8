import { buildGreatStopGatePlaceRightPresets } from '../src/domain/greatStop/buildGreatStopGateResult'
import { buildPlaceRightMovementProfile } from '../src/domain/interpretation/buildPlaceRightMovementProfile'
import type {
  PersonaMode,
  RouteShapePlaceRightLocationClass,
  RouteShapePlaceRightMovementProfile,
} from '../src/domain/types/intent'

type ComparableProfile = Omit<RouteShapePlaceRightMovementProfile, 'source' | 'reasonCodes'>

const personas: PersonaMode[] = ['romantic', 'friends', 'family']
const locationClasses: RouteShapePlaceRightLocationClass[] = ['L1 Dense', 'L2 Mid', 'L3 Sparse']

function comparable(profile: RouteShapePlaceRightMovementProfile): ComparableProfile {
  return {
    travelTolerance: profile.travelTolerance,
    maxComfortableTotalMovementMinutes: profile.maxComfortableTotalMovementMinutes,
    maxSingleTransitionMinutes: profile.maxSingleTransitionMinutes,
    maxClusterEscapes: profile.maxClusterEscapes,
    driveLikeMovement: profile.driveLikeMovement,
  }
}

function stable(value: unknown): string {
  return JSON.stringify(value)
}

const rows = personas.flatMap((persona) =>
  locationClasses.map((locationClass) => {
    const preset = buildGreatStopGatePlaceRightPresets[persona][locationClass]
    const movementProfile = buildPlaceRightMovementProfile({ persona, locationClass })
    const movementProfileValues = comparable(movementProfile)
    return {
      persona,
      locationClass,
      currentPresetValue: preset,
      newMovementProfileValue: movementProfileValues,
      exactParity: stable(preset) === stable(movementProfileValues),
      noValueDrift: stable(preset) === stable(movementProfileValues),
      source: movementProfile.source,
    }
  }),
)

const mismatches = rows.filter((row) => !row.exactParity)
const providerCalls = 0

console.log(
  JSON.stringify(
    {
      summary: {
        totalCells: rows.length,
        exactParityCells: rows.filter((row) => row.exactParity).length,
        mismatches: mismatches.length,
        noValueDrift: mismatches.length === 0,
        providerCalls,
      },
      rows,
    },
    null,
    2,
  ),
)

if (mismatches.length > 0) {
  throw new Error('Place-Right movement profile parity drift detected.')
}
