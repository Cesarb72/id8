import { DistrictRecommendationCard } from '../components/cards/DistrictRecommendationCard'
import { ID8Butler } from '../components/butler/ID8Butler'
import { PageShell } from '../components/layout/PageShell'
import type { DistrictRecommendation } from '../domain/types/district'

interface DistrictSelectionPageProps {
  recommendations: DistrictRecommendation[]
  selectedDistrictId?: string
  loading: boolean
  onSelect: (districtId: string) => void
  onBack: () => void
  onSkip: () => void
  onContinue: () => void
}

export function DistrictSelectionPage({
  recommendations,
  selectedDistrictId,
  loading,
  onSelect,
  onBack,
  onSkip,
  onContinue,
}: DistrictSelectionPageProps) {
  return (
    <PageShell
      topSlot={
        <ID8Butler
          message={
            loading
              ? 'Scanning the strongest areas first.'
              : 'Where should you go tonight?'
          }
        />
      }
      title="Choose an area"
      subtitle={
        loading
          ? 'Finding the strongest districts before route planning.'
          : 'Pick one recommended district or skip and let the planner decide.'
      }
      footer={
        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          {!loading && (
            <button type="button" className="ghost-button" onClick={onSkip}>
              Let the planner choose
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            disabled={loading || !selectedDistrictId}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="generating-panel">
          <div className="loading-orb" />
          <p>Finding the best districts for this plan.</p>
        </div>
      ) : (
        <div className="card-stack">
          {recommendations.map((recommendation, index) => (
            <DistrictRecommendationCard
              key={recommendation.districtId}
              recommendation={recommendation}
              selected={selectedDistrictId === recommendation.districtId}
              isTopPick={index === 0}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}
