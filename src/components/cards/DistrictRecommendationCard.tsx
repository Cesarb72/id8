import type { DistrictRecommendation } from '../../domain/types/district'

interface DistrictRecommendationCardProps {
  recommendation: DistrictRecommendation
  selected: boolean
  isTopPick: boolean
  onSelect: (districtId: string) => void
}

export function DistrictRecommendationCard({
  recommendation,
  selected,
  isTopPick,
  onSelect,
}: DistrictRecommendationCardProps) {
  const explanation = recommendation.districtExplanation ?? {
    tone: 'Intentional and exploratory',
    summary: recommendation.reason,
    highlights: ['Distinctive local spots', 'Strong start-to-finish flow'],
  }
  const insider = recommendation.districtInsider ?? {
    whyNow: explanation.summary,
    whyYou: explanation.highlights[0] ?? recommendation.reason,
    whatStandsOut:
      explanation.highlights[1] ??
      explanation.highlights[0] ??
      'Distinctive local character in one pocket.',
  }

  return (
    <button
      type="button"
      className={`district-card${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(recommendation.districtId)}
    >
      <span className="district-card-topline">
        <span className="district-card-title">{recommendation.label}</span>
        {isTopPick && <span className="district-card-badge">Top Pick</span>}
      </span>
      <span className="district-card-tone">{explanation.tone}</span>
      <div className="district-card-insider">
        <p className="district-card-insider-line">
          <span>Why this area tonight:</span> {insider.whyNow}
        </p>
        <p className="district-card-insider-line">
          <span>Why it fits:</span> {insider.whyYou}
        </p>
        <p className="district-card-insider-line">
          <span>What stands out:</span> {insider.whatStandsOut}
        </p>
      </div>
    </button>
  )
}
