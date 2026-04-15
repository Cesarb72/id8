import type { PropsWithChildren, ReactNode } from 'react'

interface PageShellProps extends PropsWithChildren {
  title: string
  subtitle?: string
  topSlot?: ReactNode
  footer?: ReactNode
  className?: string
}

export function PageShell({ title, subtitle, topSlot, footer, className, children }: PageShellProps) {
  return (
    <section className={className ? `page-shell ${className}` : 'page-shell'}>
      {topSlot}
      <header className="page-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <div className="page-body">{children}</div>
      {footer && <footer className="page-footer">{footer}</footer>}
    </section>
  )
}
