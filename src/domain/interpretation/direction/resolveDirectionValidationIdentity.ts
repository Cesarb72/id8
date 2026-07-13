import type { DirectionIdentity } from '../../types/intent'

function mapScenarioFamilyToDirectionIdentity(
  scenarioFamily: string | undefined,
): DirectionIdentity | undefined {
  if (!scenarioFamily) {
    return undefined
  }
  if (scenarioFamily.endsWith('_cozy')) {
    return 'intimate'
  }
  if (scenarioFamily.endsWith('_lively')) {
    return 'social'
  }
  if (scenarioFamily.endsWith('_cultured')) {
    return 'exploratory'
  }
  return undefined
}

export function resolveDirectionValidationIdentity(params: {
  contractIdentity?: DirectionIdentity
  previewScenarioFamily?: string
}): DirectionIdentity {
  const previewIdentity = mapScenarioFamilyToDirectionIdentity(params.previewScenarioFamily)
  return previewIdentity ?? params.contractIdentity ?? 'exploratory'
}
