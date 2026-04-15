import { ID8Butler } from '../butler/ID8Butler'
import { PageShell } from '../layout/PageShell'
import type { DiscoveryGroup } from '../../domain/discovery/getDiscoveryCandidates'

interface DiscoverySurfaceProps {
  groups: DiscoveryGroup[]
  selectedVenueIds: string[]
  loading: boolean
  onToggleVenue: (venueId: string) => void
  onBack: () => void
  onSkip: () => void
  onGenerate: () => void
}

function isSelected(selectedVenueIds: string[], venueId: string): boolean {
  return selectedVenueIds.includes(venueId)
}

function buildSelectionSummary(selectedCount: number): string {
  if (selectedCount === 0) {
    return 'No picks yet'
  }
  if (selectedCount === 1) {
    return '1 pick saved'
  }
  return '2 picks saved'
}

function buildSelectionHelper(selectedCount: number): string {
  if (selectedCount === 0) {
    return 'Pick up to two if you want to guide the night a bit.'
  }
  if (selectedCount === 1) {
    return 'You can add one more, or leave it there.'
  }
  return 'You are set. We will use these as soft preferences.'
}

export function DiscoverySurface({
  groups,
  selectedVenueIds,
  loading,
  onToggleVenue,
  onBack,
  onSkip,
  onGenerate,
}: DiscoverySurfaceProps) {
  const selectedCount = selectedVenueIds.length
  const canToggleMore = selectedCount < 2

  return (
    <PageShell
      topSlot={
        <ID8Butler
          message={
            loading
              ? 'Pulling together a few strong fits for your night.'
              : 'Here are a few strong fits. Pick any you want me to lean toward.'
          }
        />
      }
      title="A Few Strong Fits"
      subtitle={
        loading
          ? 'Grouping a small set of good options by role.'
          : "Optional. Pick up to two, or leave it fully in the planner's hands."
      }
      footer={
        <div className="action-row wrap discovery-footer-actions">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <button type="button" className="ghost-button subtle" onClick={onSkip}>
            Skip for now
          </button>
          <button type="button" className="primary-button" onClick={onGenerate}>
            Generate your outing
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="generating-panel">
          <div className="loading-orb" />
          <p>Finding a few strong candidates for this plan.</p>
        </div>
      ) : (
        <>
          <div className="discovery-status">
            <div className="discovery-meta">
              <span className="reveal-story-chip">Optional preview</span>
              <span className="reveal-story-chip">Pick up to 2</span>
              <span className={`reveal-story-chip${selectedCount > 0 ? ' active' : ''}`}>
                {buildSelectionSummary(selectedCount)}
              </span>
            </div>
            <p className="discovery-status-copy">{buildSelectionHelper(selectedCount)}</p>
          </div>

          <div className="discovery-surface">
            {groups.map((group) => (
              <section key={group.role} className="discovery-group">
                <div className="discovery-group-header">
                  <div>
                    <p className="discovery-group-kicker">Curated for {group.title.toLowerCase()}</p>
                    <h2>{group.title}</h2>
                  </div>
                  <p className="discovery-group-copy">{group.subtitle}</p>
                </div>

                <div className="discovery-card-list">
                  {group.candidates.map((candidate) => {
                    const selected = isSelected(selectedVenueIds, candidate.venueId)
                    const disabled = !selected && !canToggleMore

                    return (
                      <button
                        key={candidate.venueId}
                        type="button"
                        className={`discovery-card${selected ? ' selected' : ''}`}
                        aria-pressed={selected}
                        disabled={disabled}
                        onClick={() => onToggleVenue(candidate.venueId)}
                      >
                        <span className="discovery-card-topline">
                          <span className="discovery-card-type">{candidate.categoryLabel}</span>
                          <span className={`discovery-card-badge${selected ? ' selected' : ''}`}>
                            {selected ? 'Selected' : 'Tap to prefer'}
                          </span>
                        </span>
                        <strong>{candidate.name}</strong>
                        <span className="discovery-card-reason">{candidate.reason}</span>
                        <span className="discovery-card-meta">{candidate.areaLabel}</span>
                        <span className="discovery-card-state">
                          {selected
                            ? 'We will lean toward this if it fits cleanly.'
                            : disabled
                              ? 'Two picks already saved.'
                              : 'Optional nudge, not a hard lock.'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </PageShell>
  )
}
