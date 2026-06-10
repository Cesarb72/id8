export function buildCuratePreviewCommitabilityCacheKey(params: {
  starterPackId: string | null | undefined
  artifactId: string
}): string {
  const starterPackId = params.starterPackId?.trim() || 'no_starter'
  return `${starterPackId}:${params.artifactId}`
}
