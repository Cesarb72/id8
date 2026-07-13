import { resolveDirectionValidationIdentity as resolveArcDirectionValidationIdentity } from '../src/domain/arc/resolveDirectionValidationIdentity.ts'
import { resolveDirectionValidationIdentity } from '../src/domain/interpretation/direction/resolveDirectionValidationIdentity.ts'
import type { DirectionIdentity } from '../src/domain/types/intent.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

type ValidationIdentityFixture = {
  label: string
  contractIdentity?: DirectionIdentity
  previewScenarioFamily?: string
  expected: DirectionIdentity
}

const fixtures: ValidationIdentityFixture[] = [
  {
    label: 'preview cozy overrides social contract',
    contractIdentity: 'social',
    previewScenarioFamily: 'date_night_cozy',
    expected: 'intimate',
  },
  {
    label: 'preview lively overrides intimate contract',
    contractIdentity: 'intimate',
    previewScenarioFamily: 'friends_night_lively',
    expected: 'social',
  },
  {
    label: 'preview cultured overrides intimate contract',
    contractIdentity: 'intimate',
    previewScenarioFamily: 'gallery_walk_cultured',
    expected: 'exploratory',
  },
  {
    label: 'unknown preview falls back to contract identity',
    contractIdentity: 'social',
    previewScenarioFamily: 'late_anchor_unknown',
    expected: 'social',
  },
  {
    label: 'partial preview suffix does not match',
    contractIdentity: 'intimate',
    previewScenarioFamily: 'cozy_intro',
    expected: 'intimate',
  },
  {
    label: 'missing preview falls back to contract identity',
    contractIdentity: 'exploratory',
    expected: 'exploratory',
  },
  {
    label: 'missing preview and contract falls back to exploratory',
    expected: 'exploratory',
  },
]

for (const fixture of fixtures) {
  const input = {
    contractIdentity: fixture.contractIdentity,
    previewScenarioFamily: fixture.previewScenarioFamily,
  }
  const directionIdentity = resolveDirectionValidationIdentity(input)
  const arcDirectionIdentity = resolveArcDirectionValidationIdentity(input)
  assert(
    directionIdentity === fixture.expected,
    `${fixture.label}: expected ${fixture.expected}, got ${directionIdentity}`,
  )
  assert(
    arcDirectionIdentity === directionIdentity,
    `${fixture.label}: Arc compatibility shim drifted (${arcDirectionIdentity} !== ${directionIdentity})`,
  )
}

console.log('[direction-validation-identity-parity] PASS')
console.log('[direction-validation-identity-parity] provider/network calls: 0')
