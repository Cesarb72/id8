import { runGeneratePlan } from '../src/domain/runGeneratePlan'

const result = await runGeneratePlan({ city: 'San Jose', persona: 'romantic', primaryVibe: 'cozy', distanceMode: 'nearby' })
const bd: any = result.trace.boundaryDiagnostics
console.log('warnings', bd?.warnings)
console.log('post snapshot first', JSON.stringify(bd?.postBoundarySnapshot?.[0], null, 2))
console.log('selectedArc metadata', JSON.stringify(result.selectedArc.metadata, null, 2))
