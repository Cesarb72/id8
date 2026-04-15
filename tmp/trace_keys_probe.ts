import { runGeneratePlan } from '../src/domain/runGeneratePlan'

const result = await runGeneratePlan({
  city: 'San Jose',
  persona: 'romantic',
  primaryVibe: 'cozy',
  distanceMode: 'nearby',
})

console.log(Object.keys(result.trace).slice(0, 120))
console.log('retrievalDiagnostics keys', Object.keys((result.trace as any).retrievalDiagnostics ?? {}))
console.log('boundaryDiagnostics keys', Object.keys((result.trace as any).boundaryDiagnostics ?? {}))
console.log('selectedArc qualityContext', (result.trace as any).boundaryDiagnostics?.selectedCandidate?.qualityContext)
