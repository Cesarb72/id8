import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import { CrewCard } from '../components/cards/CrewCard'
import { VibeChip } from '../components/cards/VibeChip'
import { PageShell } from '../components/layout/PageShell'
import type { DiscoveryDirection } from '../domain/discovery/getDiscoveryCandidates'
import {
  searchAnchorVenues,
  type AnchorSearchChip,
  type AnchorSearchResult,
} from '../domain/search/searchAnchorVenues'
import {
  vibeOptions,
  type ExperienceMode,
  type PersonaMode,
  type VibeAnchor,
} from '../domain/types/intent'
import type { Venue } from '../domain/types/venue'

interface MoodSelectionPageProps {
  primaryVibe: VibeAnchor | null
  secondaryVibe?: VibeAnchor
  persona: PersonaMode | null
  city: string
  neighborhood?: string
  anchorName?: string
  anchorVenueId?: string
  showAnchorSearch?: boolean
  flowStage?: 'intent' | 'choose'
  modePosture?: ExperienceMode | null
  discoveryGroups?: DiscoveryDirection[]
  discoveryLoading: boolean
  selectedVenueIds: string[]
  debugPanel?: ReactNode
  onChange: (primary: VibeAnchor, secondary?: VibeAnchor) => void
  onPersonaChange: (persona: PersonaMode | null) => void
  onContextChange: (city: string, neighborhood?: string) => void
  onAnchorSelect: (venue: Venue) => void
  onToggleDiscoveryVenue: (venueId: string) => void
  onSetDiscoverySelection?: (venueIds: string[]) => void
  onBack: () => void
  onNext: () => void
}

type ExploreMode = 'directed' | 'discover'

interface ExploreModeContent {
  pageTitle: string
  pageSubtitle: string
  butlerMessage: string
  introKicker: string
  introTitle: string
  introCopy: string
  setupTitle: string
  setupCopy: string
  nextLabel: string
}

const areaHintOptions = [
  'Downtown',
  'SoFA District',
  'Santana Row',
  'Rose Garden',
  'Willow Glen',
  'North San Jose',
]

const anchorChipOptions: Array<{ value: AnchorSearchChip; label: string }> = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'movie', label: 'Movie' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'park', label: 'Park' },
  { value: 'activity', label: 'Activity' },
]

const personaOptions: Array<{
  persona: PersonaMode
  title: string
  description: string
}> = [
  {
    persona: 'romantic',
    title: 'Romantic',
    description: 'Intimate, polished, and lower-friction pacing.',
  },
  {
    persona: 'friends',
    title: 'Friends',
    description: 'Social, energetic, and variety-forward.',
  },
  {
    persona: 'family',
    title: 'Family',
    description: 'Comfortable for mixed ages with strong flow.',
  },
]

const exploreModeContent: Record<ExploreMode, ExploreModeContent> = {
  directed: {
    pageTitle: 'Build around what you know',
    pageSubtitle: 'Keep the page tight, choose the anchor, and shape the rest of the plan around it.',
    butlerMessage:
      'Set the tone, keep the area focused, and lock in the one thing the plan needs to include.',
    introKicker: 'Directed mode',
    introTitle: 'Start with the thing you already know you want.',
    introCopy:
      'This mode is build-oriented. The anchor search is the main move, and discovery stays in a supporting role.',
    setupTitle: 'Keep the rest of the plan aligned.',
    setupCopy:
      'Choose the vibe and area so the anchor search stays focused and the route builds in a straight line.',
    nextLabel: 'Build draft plan',
  },
  discover: {
    pageTitle: 'Discover a direction',
    pageSubtitle: 'Open the page up, compare a few paths, and let the route take shape from what stands out.',
    butlerMessage:
      'Set the tone, keep the area loose if you want, and pick the direction that feels most promising.',
    introKicker: 'Exploratory mode',
    introTitle: 'Start broad, then follow the most interesting path.',
    introCopy:
      'This mode is discovery-oriented. Direction cards lead the page, and you can save up to two signals before the draft tightens up.',
    setupTitle: 'Give discovery a point of view.',
    setupCopy:
      'Pick the vibe first, then browse directions that fit it. Use the area hint only if you want discovery to stay in one pocket.',
    nextLabel: 'See draft directions',
  },
}

function isSelected(selectedVenueIds: string[], venueId: string): boolean {
  return selectedVenueIds.includes(venueId)
}

function buildSelectionHelper(selectedCount: number): string {
  if (selectedCount === 0) {
    return 'Pick up to two if you want to guide the route a bit.'
  }
  if (selectedCount === 1) {
    return 'You can add one more, or leave it there.'
  }
  return 'You are set. We will use these as soft preferences.'
}

function inferInitialExploreMode(
  showAnchorSearch: boolean,
  anchorName?: string,
  selectedVenueIds: string[] = [],
): ExploreMode {
  if (!showAnchorSearch) {
    return 'discover'
  }
  if (anchorName) {
    return 'directed'
  }
  if (selectedVenueIds.length > 0) {
    return 'discover'
  }
  return 'directed'
}

function inferChooseExploreMode(modePosture?: ExperienceMode | null): ExploreMode {
  if (modePosture === 'build') {
    return 'directed'
  }
  return 'discover'
}

export function MoodSelectionPage({
  primaryVibe,
  secondaryVibe,
  persona,
  city,
  neighborhood,
  anchorName,
  anchorVenueId,
  showAnchorSearch = false,
  flowStage = 'intent',
  modePosture = null,
  discoveryGroups,
  discoveryLoading,
  selectedVenueIds,
  debugPanel,
  onChange,
  onPersonaChange,
  onContextChange,
  onAnchorSelect,
  onToggleDiscoveryVenue,
  onSetDiscoverySelection,
  onBack,
  onNext,
}: MoodSelectionPageProps) {
  const isChooseStage = flowStage === 'choose'
  const isDirectionChooseStage = isChooseStage
  const [anchorQuery, setAnchorQuery] = useState('')
  const [anchorChip, setAnchorChip] = useState<AnchorSearchChip | undefined>()
  const [anchorResults, setAnchorResults] = useState<AnchorSearchResult[]>([])
  const [anchorLoading, setAnchorLoading] = useState(false)
  const [anchorError, setAnchorError] = useState<string>()
  const [exploreMode, setExploreMode] = useState<ExploreMode>(() =>
    isChooseStage
      ? inferChooseExploreMode(modePosture)
      : inferInitialExploreMode(showAnchorSearch, anchorName, selectedVenueIds),
  )
  const selectedDirectionId = useMemo(() => {
    if (!isDirectionChooseStage || !discoveryGroups || discoveryGroups.length === 0) {
      return null
    }
    for (const direction of discoveryGroups) {
      const leadVenueIds = Array.from(
        new Set(
          direction.groups
            .map((group) => group.candidates[0]?.venueId)
            .filter((value): value is string => Boolean(value)),
        ),
      )
      if (leadVenueIds.length === 0) {
        continue
      }
      if (leadVenueIds.every((venueId) => selectedVenueIds.includes(venueId))) {
        return direction.id
      }
    }
    return null
  }, [discoveryGroups, isDirectionChooseStage, selectedVenueIds])
  const canContinue = isDirectionChooseStage ? Boolean(selectedDirectionId) : Boolean(primaryVibe)
  const canToggleMore = selectedVenueIds.length < 2
  const supportingDirections = useMemo(
    () => (discoveryGroups ?? []).slice(0, 2),
    [discoveryGroups],
  )
  const showSupportingFits =
    exploreMode === 'directed' &&
    Boolean(primaryVibe) &&
    Boolean(anchorVenueId) &&
    (discoveryLoading || supportingDirections.length > 0)
  const isDirectedMode = exploreMode === 'directed'
  const modeContent = exploreModeContent[exploreMode]
  const stagePageTitle = isChooseStage
    ? 'Choose tonight\'s direction'
    : modeContent.pageTitle
  const stagePageSubtitle = isChooseStage
    ? 'Pick one generated route direction to continue.'
    : modeContent.pageSubtitle
  const stageButlerMessage = isChooseStage
    ? 'Choose one built night direction and continue to review.'
    : modeContent.butlerMessage
  const stageIntroKicker = isChooseStage ? 'Choose stage' : modeContent.introKicker
  const stageIntroTitle = isChooseStage
    ? 'Select the direction you want to draft.'
    : modeContent.introTitle
  const stageIntroCopy = isChooseStage
    ? 'This step is for choosing the route direction before preview and adjustment.'
    : modeContent.introCopy
  const nextLabel = isDirectionChooseStage ? 'Continue' : modeContent.nextLabel
  const hasDiscoverDirections = (discoveryGroups?.length ?? 0) > 0

  useEffect(() => {
    if (isChooseStage) {
      setExploreMode(inferChooseExploreMode(modePosture))
      return
    }
    if (!showAnchorSearch) {
      setExploreMode('discover')
      return
    }
    if (anchorName) {
      setExploreMode('directed')
    }
  }, [anchorName, isChooseStage, modePosture, showAnchorSearch])

  useEffect(() => {
    if (exploreMode !== 'directed') {
      return
    }

    const trimmedQuery = anchorQuery.trim()
    if (trimmedQuery.length < 2) {
      setAnchorResults([])
      setAnchorLoading(false)
      setAnchorError(undefined)
      return
    }

    let cancelled = false
    setAnchorLoading(true)
    setAnchorError(undefined)

    const timeoutHandle = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchAnchorVenues({
            query: trimmedQuery,
            city,
            neighborhood,
            chip: anchorChip,
          })
          if (cancelled) {
            return
          }
          setAnchorResults(results)
          setAnchorError(
            results.length === 0 ? 'No close matches yet. Try a broader name.' : undefined,
          )
        } catch (error) {
          console.error(error)
          if (!cancelled) {
            setAnchorResults([])
            setAnchorError(
              'Search is unavailable right now. You can still continue without an anchor.',
            )
          }
        } finally {
          if (!cancelled) {
            setAnchorLoading(false)
          }
        }
      })()
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutHandle)
    }
  }, [anchorChip, anchorQuery, city, exploreMode, neighborhood])

  const renderDirection = (direction: DiscoveryDirection) => {
    const directionLeadVenueIds = Array.from(
      new Set(
        direction.groups
          .map((group) => group.candidates[0]?.venueId)
          .filter((value): value is string => Boolean(value)),
      ),
    )
    const directionSelected = isDirectionChooseStage
      ? selectedDirectionId === direction.id
      : directionLeadVenueIds.length > 0 &&
        directionLeadVenueIds.every((venueId) => selectedVenueIds.includes(venueId))

    return (
    <section
      key={direction.id}
      className={`direction-set${isDirectedMode ? ' compact' : ' spacious'}${
        directionSelected ? ' selected' : ''
      }`}
    >
      <div className="direction-set-header">
        <div>
          <p className="discovery-group-kicker">
            {isDirectedMode ? 'Good options for your plan' : 'You could go this direction'}
          </p>
          <h2>{direction.title}</h2>
        </div>
        <p className="discovery-group-copy">{direction.narrative}</p>
        <p className={`direction-set-guidance${isDirectedMode ? '' : ' primary'}`}>
          {isDirectionChooseStage
            ? 'Pick one built-night direction to carry into preview.'
            : isDirectedMode
            ? 'Optional support once the anchor is set.'
            : 'Pick from this set if this feels like the right path.'}
        </p>
      </div>

      <div className="discovery-meta">
        {direction.pocketLabel && (
          <span className="reveal-story-chip">{direction.pocketLabel}</span>
        )}
        <span className={`reveal-story-chip${isDirectedMode ? '' : ' active'}`}>
          {isDirectedMode ? 'Plan support' : 'Primary action'}
        </span>
        <span className="reveal-story-chip">Not final</span>
      </div>

      <div className="direction-set-grid">
        {direction.groups.map((group) =>
          group.candidates.map((candidate) => {
            const selected = isSelected(selectedVenueIds, candidate.venueId)
            const disabled = !selected && !canToggleMore

            const cardClassName = `discovery-card${selected ? ' selected' : ''}${isDirectedMode ? ' supporting' : ' priority'}`
            const cardContent = (
              <>
                <span className="discovery-card-topline">
                  <span className="discovery-card-type">{group.title}</span>
                  <span className={`discovery-card-badge${selected ? ' selected' : ''}`}>
                    {isDirectionChooseStage
                      ? 'Included'
                      : selected
                      ? isDirectedMode
                        ? 'Added'
                        : 'Saved'
                      : isDirectedMode
                        ? 'Support plan'
                        : 'Choose path'}
                  </span>
                </span>
                <strong>{candidate.name}</strong>
                <span className="discovery-card-reason">{candidate.reason}</span>
                <span className="discovery-card-meta">{candidate.areaLabel}</span>
                <span className="discovery-card-state">
                  {isDirectionChooseStage
                    ? 'Included as part of this built-night direction.'
                    : selected
                    ? isDirectedMode
                      ? 'We will keep this as optional support around your anchor.'
                      : 'We will treat this as a strong signal for the direction you want.'
                    : disabled
                      ? 'Two picks already saved.'
                      : isDirectedMode
                        ? 'Useful if it strengthens the anchor-led route.'
                        : 'Use this to tell us which direction feels right.'}
                </span>
              </>
            )

            if (isDirectionChooseStage) {
              return (
                <div
                  key={candidate.venueId}
                  className={cardClassName}
                >
                  {cardContent}
                </div>
              )
            }

            return (
              <button
                key={candidate.venueId}
                type="button"
                className={cardClassName}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onToggleDiscoveryVenue(candidate.venueId)}
              >
                {cardContent}
              </button>
            )
          }),
        )}
      </div>
      {isDirectionChooseStage && (
        <div className="action-row">
          <button
            type="button"
            className={`primary-button${directionSelected ? ' selected' : ''}`}
            onClick={() => {
              if (!onSetDiscoverySelection || directionLeadVenueIds.length === 0) {
                return
              }
              onSetDiscoverySelection(directionLeadVenueIds)
            }}
          >
            {directionSelected ? 'Selected' : 'Choose this night'}
          </button>
        </div>
      )}
    </section>
  )}

  const setupPanel = (
    <section className={`explore-setup-panel explore-setup-panel-${exploreMode}`}>
      <div className="explore-section-heading">
        <p className="input-label">{isDirectedMode ? 'Setup' : 'Set the lens'}</p>
        <h2>{modeContent.setupTitle}</h2>
        <p className="explore-section-copy">{modeContent.setupCopy}</p>
      </div>

      <div className="mood-section">
        <p className="input-label">Primary vibe</p>
        <div className="chip-grid">
          {vibeOptions.map((option) => (
            <VibeChip
              key={`primary_${option.value}`}
              vibe={option.value}
              label={option.label}
              sublabel={option.sublabel}
              selected={primaryVibe === option.value}
              onClick={(nextPrimary) =>
                onChange(
                  nextPrimary,
                  secondaryVibe === nextPrimary ? undefined : secondaryVibe,
                )
              }
            />
          ))}
        </div>
      </div>

      {primaryVibe && (
        <div className="mood-section">
          <p className="input-label">Secondary vibe (optional)</p>
          <div className="chip-grid">
            {vibeOptions
              .filter((option) => option.value !== primaryVibe)
              .map((option) => (
                <VibeChip
                  key={`secondary_${option.value}`}
                  vibe={option.value}
                  label={option.label}
                  sublabel={option.sublabel}
                  selected={secondaryVibe === option.value}
                  onClick={(nextSecondary) =>
                    onChange(
                      primaryVibe,
                      secondaryVibe === nextSecondary ? undefined : nextSecondary,
                    )
                  }
                />
              ))}
          </div>
        </div>
      )}

      {primaryVibe && (
        <div className="mood-section">
          <div className="explore-section-heading">
            <p className="input-label">Persona (optional)</p>
            <h2>Refine who this is for</h2>
            <p className="explore-section-copy">
              Keep this blank if the vibe should do the heavy lifting. Persona only adds a light modifier.
            </p>
          </div>

          <div className="card-stack">
            {personaOptions.map((option) => (
              <CrewCard
                key={option.persona}
                persona={option.persona}
                title={option.title}
                description={option.description}
                selected={persona === option.persona}
                onSelect={(nextPersona) =>
                  onPersonaChange(persona === nextPersona ? null : nextPersona)
                }
              />
            ))}
          </div>

          <div className="action-row">
            <button
              type="button"
              className="ghost-button"
              disabled={!persona}
              onClick={() => onPersonaChange(null)}
            >
              Skip persona
            </button>
          </div>
        </div>
      )}

      <div className={`explore-context-grid${isDirectedMode ? ' compact' : ''}`}>
        <label className="input-group">
          <span className="input-label">City</span>
          <input
            value={city}
            onChange={(event) => onContextChange(event.target.value, neighborhood)}
            placeholder="San Jose"
          />
        </label>

        <label className="input-group">
          <span className="input-label">Area hint (optional)</span>
          <select
            value={neighborhood ?? ''}
            onChange={(event) =>
              onContextChange(city, event.target.value ? event.target.value : undefined)
            }
          >
            <option value="">Anywhere nearby</option>
            {areaHintOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )

  return (
    <PageShell
      topSlot={
        <ID8Butler message={stageButlerMessage} />
      }
      title={stagePageTitle}
      subtitle={stagePageSubtitle}
      footer={
        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!canContinue}
            onClick={onNext}
          >
            {nextLabel}
          </button>
        </div>
      }
    >
      <div className={`explore-page explore-page-${exploreMode}`}>
        {showAnchorSearch && !isChooseStage && !isDirectionChooseStage && (
          <section className="explore-mode-section">
            <p className="input-label">How do you want to start?</p>
            <div className="explore-mode-grid">
              <button
                type="button"
                className={`explore-mode-card${exploreMode === 'directed' ? ' selected' : ''}`}
                onClick={() => setExploreMode('directed')}
              >
                <strong>I know what I want</strong>
                <span>Build around one anchor and keep discovery in support.</span>
              </button>
              <button
                type="button"
                className={`explore-mode-card${exploreMode === 'discover' ? ' selected' : ''}`}
                onClick={() => setExploreMode('discover')}
              >
                <strong>Help me discover</strong>
                <span>Open up the page and let direction cards lead the next step.</span>
              </button>
            </div>
          </section>
        )}

        <section className={`explore-mode-intro explore-mode-intro-${exploreMode}`}>
          <p className="discovery-group-kicker">{stageIntroKicker}</p>
          <h2>{stageIntroTitle}</h2>
          <p className="explore-mode-intro-copy">{stageIntroCopy}</p>
        </section>

        {debugPanel}

        {isDirectedMode && showAnchorSearch && !isDirectionChooseStage && (
          <section className="anchor-search-panel anchor-search-panel-primary">
            <div className="explore-section-heading">
              <p className="input-label">Primary action</p>
              <h2>Choose the anchor</h2>
              <p className="explore-section-copy">
                Search for the one place or activity the plan needs to include, then build the rest around it.
              </p>
            </div>

            <label className="input-group">
              <span className="input-label">Build around one thing</span>
              <input
                value={anchorQuery}
                onChange={(event) => setAnchorQuery(event.target.value)}
                placeholder="What's the one thing you definitely want to do?"
              />
            </label>

            <div className="chip-grid">
              {anchorChipOptions.map((option) => {
                const selected = anchorChip === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`chip-action${selected ? ' selected' : ''}`}
                    onClick={() =>
                      setAnchorChip((current) =>
                        current === option.value ? undefined : option.value
                      )
                    }
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {anchorName ? (
              <p className="anchor-search-note">
                Locked anchor: <strong>{anchorName}</strong>
              </p>
            ) : (
              <p className="anchor-search-status">
                Search for the thing you already know you want, then let the rest of the route follow it.
              </p>
            )}

            {(anchorLoading || anchorResults.length > 0 || anchorError) && (
              <div className="anchor-search-results">
                {anchorLoading && <p className="anchor-search-status">Searching nearby places...</p>}
                {!anchorLoading &&
                  anchorResults.map((result) => (
                    <button
                      key={result.venue.id}
                      type="button"
                      className="anchor-search-result"
                      onClick={() => onAnchorSelect(result.venue)}
                    >
                      <strong>{result.venue.name}</strong>
                      <span>{result.subtitle}</span>
                    </button>
                  ))}
                {!anchorLoading && anchorError && (
                  <p className="anchor-search-status">{anchorError}</p>
                )}
              </div>
            )}
          </section>
        )}

        {!isDirectionChooseStage && setupPanel}

        {isDirectionChooseStage ? (
          <section className="discovery-surface discovery-surface-exploratory">
            <div className="discovery-status primary">
              <div className="discovery-meta">
                <span className="reveal-story-chip active">Direction selection</span>
                <span className="reveal-story-chip">Choose 1</span>
                {selectedDirectionId && (
                  <span className="reveal-story-chip active">Selection saved</span>
                )}
              </div>
              <h2 className="explore-surface-title">Choose tonight's direction</h2>
              <p className="discovery-status-copy">
                Pick one full direction and continue to route review.
              </p>
            </div>
            {discoveryLoading ? (
              <div className="generating-panel">
                <div className="loading-orb" />
                <p>Building candidate nights from your selected starter.</p>
              </div>
            ) : hasDiscoverDirections ? (
              (discoveryGroups ?? []).map((direction) => renderDirection(direction))
            ) : (
              <div className="explore-secondary-note explore-secondary-note-spacious">
                <p className="input-label">Built-night options</p>
                <p>No directions are ready yet. Try again in a moment.</p>
              </div>
            )}
          </section>
        ) : isDirectedMode ? (
          showSupportingFits ? (
            <section className="discovery-surface supporting-fits">
              <div className="discovery-status compact">
                <div className="discovery-meta">
                  <span className="reveal-story-chip">Direction sets</span>
                  <span className="reveal-story-chip">Optional</span>
                </div>
                <h2 className="explore-surface-title">Good options for your plan</h2>
                <p className="discovery-status-copy">
                  Once the anchor is locked, these are optional directions that can strengthen the rest of the flow.
                </p>
              </div>

              {discoveryLoading ? (
                <div className="generating-panel">
                  <div className="loading-orb" />
                  <p>Shaping a few different routes around that anchor.</p>
                </div>
              ) : (
                supportingDirections.map((direction) => renderDirection(direction))
              )}
            </section>
          ) : (
            <section className="explore-secondary-note">
              <p className="input-label">Supporting discovery</p>
              <p>
                Pick an anchor first. Once it is set, optional supporting directions will appear here.
              </p>
            </section>
          )
        ) : null}

        {!isDirectionChooseStage && !isDirectedMode && (
          <section className="discovery-surface discovery-surface-exploratory">
            <div className="discovery-status primary">
              <div className="discovery-meta">
                <span className="reveal-story-chip active">Direction finding</span>
                <span className="reveal-story-chip">Pick up to 2</span>
                <span
                  className={`reveal-story-chip${selectedVenueIds.length > 0 ? ' active' : ''}`}
                >
                  {selectedVenueIds.length === 0
                    ? 'No picks yet'
                    : selectedVenueIds.length === 1
                      ? '1 pick saved'
                      : '2 picks saved'}
                </span>
              </div>
              <h2 className="explore-surface-title">Choose a direction to follow</h2>
              <p className="discovery-status-copy">{buildSelectionHelper(selectedVenueIds.length)}</p>
            </div>

            {discoveryLoading ? (
              <div className="generating-panel">
                <div className="loading-orb" />
                <p>Sketching a few different ways this night could go.</p>
              </div>
            ) : hasDiscoverDirections ? (
              (discoveryGroups ?? []).map((direction) => renderDirection(direction))
            ) : (
              <div className="explore-secondary-note explore-secondary-note-spacious">
                <p className="input-label">Direction cards</p>
                <p>Choose a primary vibe to unlock a few routes you could take from here.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </PageShell>
  )
}
