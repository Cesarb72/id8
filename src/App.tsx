import { AppShell } from './app/AppShell'
import { DemoPage } from './pages/DemoPage'
import { HomePage } from './pages/HomePage'
import { LiveJourneyPage } from './pages/LiveJourneyPage'
import { PlansHubPage } from './pages/PlansHubPage'
import { SandboxConciergePage } from './pages/SandboxConciergePage'
import type { ExperienceMode } from './domain/types/intent'
import './App.css'

const ENVIRONMENT_LINKS = [
  { href: '/', label: 'Concierge' },
  { href: '/dev/home', label: 'Development Sandbox' },
  { href: '/archive', label: 'Archive' },
] as const

function EnvironmentAccessBar({ currentPath }: { currentPath: string }) {
  return (
    <nav className="environment-access-bar" aria-label="Environment quick access">
      <div className="environment-access-inner">
        {ENVIRONMENT_LINKS.map((link) => {
          const active =
            link.href === '/'
              ? currentPath === '/'
              : link.href === '/dev/home'
                ? (
                    currentPath === '/dev' ||
                    currentPath === '/sandbox' ||
                    currentPath === '/dev/home' ||
                    currentPath === '/home' ||
                    currentPath.startsWith('/dev/') ||
                    currentPath.startsWith('/sandbox/')
                  )
              : currentPath === link.href || currentPath.startsWith(`${link.href}/`)
          return (
            <a
              key={link.href}
              href={link.href}
              className={`environment-access-link${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  let normalizedPathname = pathname.toLowerCase()
  if (
    typeof window !== 'undefined' &&
    (normalizedPathname === '/dev' || normalizedPathname === '/sandbox')
  ) {
    window.history.replaceState(null, '', '/dev/home')
    normalizedPathname = '/dev/home'
  }
  const startModeMatch = normalizedPathname.match(/^\/start\/(surprise|curate|build)\/?$/)
  let page = <DemoPage />

  if (normalizedPathname === '/') {
    page = <DemoPage />
  } else if (startModeMatch?.[1]) {
    page = <AppShell initialMode={startModeMatch[1] as ExperienceMode} />
  }
  if (
    normalizedPathname === '/dev' ||
    normalizedPathname === '/sandbox' ||
    normalizedPathname === '/dev/home' ||
    normalizedPathname === '/dev/choose' ||
    normalizedPathname === '/dev/preview' ||
    normalizedPathname === '/dev/confirm' ||
    /^\/dev\/start\/(surprise|curate|build)\/?$/.test(normalizedPathname) ||
    normalizedPathname === '/dev/concierge' ||
    normalizedPathname === '/sandbox/concierge'
  ) {
    page = <SandboxConciergePage />
  } else if (normalizedPathname === '/dev/live') {
    page = <LiveJourneyPage />
  } else if (normalizedPathname === '/dev/plans') {
    page = <PlansHubPage />
  } else if (normalizedPathname === '/archive') {
    page = <AppShell environment="archive" />
  } else if (normalizedPathname === '/journey/live' || normalizedPathname === '/live') {
    page = <LiveJourneyPage />
  } else if (normalizedPathname === '/home') {
    page = <HomePage />
  } else if (normalizedPathname === '/plans') {
    page = <PlansHubPage />
  } else {
    const sharedPlanMatch = pathname.match(/^\/p\/([^/]+)\/?$/i)
    if (sharedPlanMatch?.[1]) {
      page = <LiveJourneyPage sharedPlanId={decodeURIComponent(sharedPlanMatch[1])} />
    }
  }

  return (
    <>
      <EnvironmentAccessBar currentPath={normalizedPathname} />
      {page}
    </>
  )
}

export default App
