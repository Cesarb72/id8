import { ID8Butler } from '../components/butler/ID8Butler'
import { PageShell } from '../components/layout/PageShell'
import type { LiveArtifactExitNotice } from '../domain/live/liveArtifactSession'
import type { ExperienceMode } from '../domain/types/intent'

interface LandingPageProps {
  onSelectMode: (mode: ExperienceMode) => void
  notice?: LiveArtifactExitNotice
  onDismissNotice?: () => void
  conciergeHref?: string
  conciergeLabel?: string
}

export function LandingPage({
  onSelectMode,
  notice,
  onDismissNotice,
  conciergeHref = '/',
  conciergeLabel = 'Open Concierge',
}: LandingPageProps) {
  const showReadyActions = Boolean(notice?.mapPath && notice.showPlanAnotherNight)

  return (
    <PageShell
      topSlot={<ID8Butler message="Choose how you want to discover your next local experience." />}
      title="ID.8"
      subtitle="Not search. Not chat. Curated real-world plans."
    >
      {notice && (
        <div className="live-mode-note">
          {notice.title && <p className="live-mode-note-title">{notice.title}</p>}
          <p className="preview-notice-copy">{notice.message}</p>
          {showReadyActions && (
            <div className="action-row wrap live-mode-note-actions">
              <a className="primary-button" href={notice.mapPath ?? '/journey/live'}>
                View your live map
              </a>
              <button
                type="button"
                className="ghost-button subtle"
                onClick={() => onDismissNotice?.()}
              >
                Plan another night
              </button>
            </div>
          )}
        </div>
      )}
      <div className="hero-panel">
        <p>Choose a mode to begin.</p>
      </div>
      <div className="mode-grid">
        <button type="button" className="mode-card" onClick={() => onSelectMode('surprise')}>
          <span>Surprise Me</span>
          <small>Light input, exploratory route, hidden gems turned up.</small>
        </button>
        <button type="button" className="mode-card" onClick={() => onSelectMode('curate')}>
          <span>Curate Experience</span>
          <small>Browse starter packs and generate from guided discovery prompts.</small>
        </button>
        <button type="button" className="mode-card" onClick={() => onSelectMode('build')}>
          <span>Build My Plan</span>
          <small>Choose persona, vibes, and location with direct control.</small>
        </button>
      </div>
      <div className="action-row">
        <a className="ghost-button subtle" href={conciergeHref}>
          {conciergeLabel}
        </a>
      </div>
    </PageShell>
  )
}
