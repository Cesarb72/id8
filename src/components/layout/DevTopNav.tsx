interface DevTopNavProps {
  homeHref: string
  backHref?: string
  backOnClick?: () => void
  backLabel?: string
  secondaryHref?: string
  secondaryOnClick?: () => void
  secondaryLabel?: string
}

export function DevTopNav({
  homeHref,
  backHref,
  backOnClick,
  backLabel = 'Back',
  secondaryHref,
  secondaryOnClick,
  secondaryLabel,
}: DevTopNavProps) {
  return (
    <nav className="dev-top-nav" aria-label="Page navigation">
      <a className="ghost-button subtle" href={homeHref}>
        Home
      </a>
      {backOnClick ? (
        <button type="button" className="ghost-button subtle" onClick={backOnClick}>
          {backLabel}
        </button>
      ) : (
        backHref && (
          <a className="ghost-button subtle" href={backHref}>
            {backLabel}
          </a>
        )
      )}
      {secondaryLabel &&
        (secondaryOnClick ? (
          <button type="button" className="ghost-button subtle" onClick={secondaryOnClick}>
            {secondaryLabel}
          </button>
        ) : (
          secondaryHref && (
            <a className="ghost-button subtle" href={secondaryHref}>
              {secondaryLabel}
            </a>
          )
        ))}
    </nav>
  )
}
