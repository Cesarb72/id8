import { PageShell } from '../components/layout/PageShell'

interface GeneratingPageProps {
  headline: string
  detail: string
}

export function GeneratingPage({ headline, detail }: GeneratingPageProps) {
  return (
    <PageShell title="Curating Your Plan" subtitle={headline}>
      <div className="generating-panel">
        <span className="loading-orb" aria-hidden="true" />
        <p>{detail}</p>
      </div>
    </PageShell>
  )
}
