import { deriveReadableDistrictName } from '../../domain/districts/deriveReadableDistrictName'
import { deriveDistrictFlowNarrative } from '../../domain/itinerary/deriveDistrictFlowNarrative'
import type {
  DistrictFlowRole,
  DistrictFlowTransition,
} from '../../domain/itinerary/deriveDistrictFlowNarrative'
import type { Itinerary } from '../../domain/types/itinerary'

interface DistrictFlowNarrativeProps {
  itinerary: Itinerary
}

function getRoleLabel(role: DistrictFlowRole): string {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'windDown') {
    return 'Wind down'
  }
  return 'Highlight'
}

function getTransitionLabel(transition: DistrictFlowTransition): string {
  if (transition === 'stay_local') {
    return 'Stay in the pocket'
  }
  if (transition === 'district_shift') {
    return 'Move across districts'
  }
  return 'Quick shift'
}

export function DistrictFlowNarrative({ itinerary }: DistrictFlowNarrativeProps) {
  const steps = deriveDistrictFlowNarrative(itinerary)

  if (steps.length === 0) {
    return null
  }

  return (
    <section className="district-flow">
      <div className="district-flow-header">
        <div>
          <p className="district-flow-kicker">District lens</p>
          <h2>How your night flows</h2>
        </div>
        <p className="district-flow-copy">
          Where it opens, where it gathers energy, and where it settles.
        </p>
      </div>

      <div className="district-flow-list">
        {steps.map((step, index) => (
          <div key={`${step.role}_${step.district}_${index}`} className="district-flow-item">
            {step.transitionFromPrev && (
              <p className="district-flow-transition">
                {getTransitionLabel(step.transitionFromPrev)}
              </p>
            )}
            {(() => {
              const readableDistrict = deriveReadableDistrictName(step.district, {
                city: itinerary.city,
              })

              return (
                <div className="district-flow-step">
                  <span className="district-flow-role">{getRoleLabel(step.role)}</span>
                  <div className="district-flow-step-body">
                    <strong className="district-name">{readableDistrict.displayName}</strong>
                    {readableDistrict.optionalAnchor && (
                      <p className="anchor-line">{readableDistrict.optionalAnchor}</p>
                    )}
                    <p>{step.reason}</p>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </section>
  )
}
