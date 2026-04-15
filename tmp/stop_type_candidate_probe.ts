import {
  buildStopTypeCandidateBoardFromIntent,
  type StopType,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard'

const scenarios = [
  { city: 'San Jose', persona: 'romantic', vibe: 'cozy' },
  { city: 'San Jose', persona: 'romantic', vibe: 'lively' },
  { city: 'San Jose', persona: 'romantic', vibe: 'cultured' },
] as const

function fmt(value: number | undefined): string {
  if (typeof value !== 'number') {
    return 'n/a'
  }
  return value.toFixed(2)
}

function printStopType(stopType: StopType, rows: Array<{
  name: string
  district?: string
  authorityScore: number
  hiddenGemScore: number
  currentRelevance: number
  reasons: string[]
}>): void {
  console.log(`  - ${stopType}: ${rows.length}`)
  rows.forEach((candidate, index) => {
    const reason = candidate.reasons[0] ?? 'fit signal present'
    console.log(
      `    ${index + 1}. ${candidate.name} (${candidate.district ?? 'n/a'})` +
        ` | authority ${fmt(candidate.authorityScore)}` +
        ` | hiddenGem ${fmt(candidate.hiddenGemScore)}` +
        ` | current ${fmt(candidate.currentRelevance)}` +
        ` | ${reason}`,
    )
  })
}

for (const scenario of scenarios) {
  const board = await buildStopTypeCandidateBoardFromIntent({
    city: scenario.city,
    persona: scenario.persona,
    vibe: scenario.vibe,
  })
  console.log(`\n=== STOP-TYPE PROBE ${scenario.city} / ${scenario.persona} / ${scenario.vibe} ===`)
  if (!board) {
    console.log('unsupported scenario')
    continue
  }
  console.log(`scenarioFamily: ${board.scenarioFamily}`)
  console.log(`requiredStopTypes: ${board.requiredStopTypes.join(', ')}`)
  board.requiredStopTypes.forEach((stopType) => {
    printStopType(
      stopType,
      board.candidatesByStopType[stopType].map((candidate) => ({
        name: candidate.name,
        district: candidate.district,
        authorityScore: candidate.authorityScore,
        hiddenGemScore: candidate.hiddenGemScore,
        currentRelevance: candidate.currentRelevance,
        reasons: candidate.reasons,
      })),
    )
  })
}

