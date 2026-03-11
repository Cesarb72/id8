import { useState } from 'react'
import {
  generateSmokeTestPlan,
  type WaypointSmokeTestResult,
} from '../../integrations/waypoint/core'

type SmokeTestState =
  | { status: 'idle' }
  | { status: 'success'; data: WaypointSmokeTestResult }
  | { status: 'error'; message: string }

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function WaypointSmokeTest() {
  const [state, setState] = useState<SmokeTestState>({ status: 'idle' })

  const runSmokeTest = () => {
    try {
      const data = generateSmokeTestPlan()
      setState({ status: 'success', data })
    } catch (error) {
      setState({ status: 'error', message: toErrorMessage(error) })
    }
  }

  return (
    <section className="smoke-test-panel">
      <button onClick={runSmokeTest} type="button">
        Run Waypoint Smoke Test
      </button>

      {state.status === 'success' && (
        <pre className="smoke-output">{JSON.stringify(state.data, null, 2)}</pre>
      )}

      {state.status === 'error' && (
        <pre className="smoke-output smoke-error">{state.message}</pre>
      )}
    </section>
  )
}
