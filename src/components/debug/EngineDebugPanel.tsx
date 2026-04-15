import type { EngineDebugSnapshot } from '../../app/debug/buildEngineDebugSnapshot'

interface EngineDebugPanelProps {
  snapshot: EngineDebugSnapshot
}

export function EngineDebugPanel({ snapshot }: EngineDebugPanelProps) {
  return (
    <details className="debug-panel engine-debug-panel">
      <summary>Dev: Engine handoff</summary>
      <p className="engine-debug-summary">{snapshot.summary}</p>
      <div className="engine-debug-sections">
        {snapshot.sections.map((section) => (
          <section key={section.title} className="engine-debug-section">
            <p className="engine-debug-section-title">{section.title}</p>
            <div className="engine-debug-grid">
              {section.entries.map((entry) => (
                <div
                  key={`${section.title}_${entry.label}`}
                  className="engine-debug-entry"
                >
                  <p className="engine-debug-label">{entry.label}</p>
                  <p className="engine-debug-value">{entry.value}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  )
}
