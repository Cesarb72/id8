import type { ExperienceMode } from '../domain/types/intent'
import { SandboxConciergePage } from './SandboxConciergePage'

type PublicConciergeMode = Extract<ExperienceMode, 'surprise' | 'curate' | 'build'>

export function PublicConciergePage({ initialMode }: { initialMode: PublicConciergeMode }) {
  return <SandboxConciergePage surface="public" initialMode={initialMode} />
}
