import type { LensStopRole } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { RoleContractRule, RoleContractSet, RoleContractStrength } from '../types/roleContract'
import type { StarterPack } from '../types/starterPack'
import type { VenueCategory } from '../types/venue'
import { resolveHospitalityContract } from './resolveHospitalityContract'

interface GetRoleContractInput {
  intent: IntentProfile
  starterPack?: StarterPack
  strictShapeEnabled?: boolean
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function strengthRank(value: RoleContractStrength): number {
  if (value === 'none') {
    return 0
  }
  if (value === 'soft') {
    return 1
  }
  if (value === 'strong') {
    return 2
  }
  return 3
}

function stronger(
  left: RoleContractStrength,
  right: RoleContractStrength,
): RoleContractStrength {
  return strengthRank(left) >= strengthRank(right) ? left : right
}

function baseRule(role: LensStopRole): RoleContractRule {
  return {
    label: `Default ${role}`,
    role,
    strength: 'none',
    requiredCategories: [],
    preferredCategories: [],
    discouragedCategories: [],
    requiredTags: [],
    preferredTags: [],
    discouragedTags: [],
  }
}

function mergeRule(
  base: RoleContractRule,
  patch: Partial<RoleContractRule>,
): RoleContractRule {
  return {
    ...base,
    label: patch.label ?? base.label,
    strength: patch.strength ? stronger(base.strength, patch.strength) : base.strength,
    requiredCategories: unique([...(base.requiredCategories ?? []), ...(patch.requiredCategories ?? [])]),
    preferredCategories: unique([...(base.preferredCategories ?? []), ...(patch.preferredCategories ?? [])]),
    discouragedCategories: unique([...(base.discouragedCategories ?? []), ...(patch.discouragedCategories ?? [])]),
    requiredTags: unique([...(base.requiredTags ?? []), ...(patch.requiredTags ?? [])]),
    preferredTags: unique([...(base.preferredTags ?? []), ...(patch.preferredTags ?? [])]),
    discouragedTags: unique([...(base.discouragedTags ?? []), ...(patch.discouragedTags ?? [])]),
    maxEnergyLevel:
      typeof patch.maxEnergyLevel === 'number'
        ? typeof base.maxEnergyLevel === 'number'
          ? Math.min(base.maxEnergyLevel, patch.maxEnergyLevel)
          : patch.maxEnergyLevel
        : base.maxEnergyLevel,
  }
}

function asCategories(values: VenueCategory[] | undefined): VenueCategory[] {
  return values ?? []
}

function starterPackContracts(
  starterPack?: StarterPack,
): Partial<Record<LensStopRole, Partial<RoleContractRule>>> {
  if (!starterPack?.roleContracts) {
    return {}
  }
  const build = (role: LensStopRole, label: string): Partial<RoleContractRule> | undefined => {
    const contract = starterPack.roleContracts?.[role]
    if (!contract) {
      return undefined
    }
    return {
      label,
      strength: contract.strength,
      requiredCategories: asCategories(contract.requiredCategories),
      preferredCategories: asCategories(contract.preferredCategories),
      discouragedCategories: asCategories(contract.discouragedCategories),
      requiredTags: contract.requiredTags ?? [],
      preferredTags: contract.preferredTags ?? [],
      discouragedTags: contract.discouragedTags ?? [],
      maxEnergyLevel: contract.maxEnergyLevel,
    }
  }
  return {
    start: build('start', `${starterPack.title} start contract`),
    highlight: build('highlight', `${starterPack.title} highlight contract`),
    surprise: build('surprise', `${starterPack.title} surprise contract`),
    windDown: build('windDown', `${starterPack.title} wind-down contract`),
  }
}

function tightenForStrictShape(rule: RoleContractRule): RoleContractRule {
  const tighterStrength: RoleContractStrength =
    rule.strength === 'none' ? 'soft' : rule.strength === 'soft' ? 'strong' : 'hard'
  return {
    ...rule,
    strength: tighterStrength,
    maxEnergyLevel:
      typeof rule.maxEnergyLevel === 'number'
        ? Math.max(1, rule.maxEnergyLevel - 1)
        : rule.role === 'windDown'
          ? 3
          : undefined,
  }
}

export function getRoleContract({
  intent,
  starterPack,
  strictShapeEnabled = false,
}: GetRoleContractInput): RoleContractSet {
  const base = {
    start: baseRule('start'),
    highlight: baseRule('highlight'),
    surprise: baseRule('surprise'),
    windDown: baseRule('windDown'),
  }
  const resolvedContractPackage = resolveHospitalityContract(intent)
  const persona = resolvedContractPackage.roleRulePatches
  const pack = starterPackContracts(starterPack)

  const merged: RoleContractSet = {
    sourceLabels: [intent.crew, starterPack?.id].filter(Boolean) as string[],
    personaContract: resolvedContractPackage.personaContract,
    resolvedContract: resolvedContractPackage.resolvedContract,
    byRole: {
      start: mergeRule(mergeRule(base.start, persona.start ?? {}), pack.start ?? {}),
      highlight: mergeRule(mergeRule(base.highlight, persona.highlight ?? {}), pack.highlight ?? {}),
      surprise: mergeRule(mergeRule(base.surprise, persona.surprise ?? {}), pack.surprise ?? {}),
      windDown: mergeRule(mergeRule(base.windDown, persona.windDown ?? {}), pack.windDown ?? {}),
    },
  }

  if (!strictShapeEnabled) {
    return merged
  }

  return {
    sourceLabels: [...merged.sourceLabels, 'strict-shape'],
    personaContract: merged.personaContract,
    resolvedContract: merged.resolvedContract,
    byRole: {
      start: tightenForStrictShape(merged.byRole.start),
      highlight: tightenForStrictShape(merged.byRole.highlight),
      surprise: tightenForStrictShape(merged.byRole.surprise),
      windDown: tightenForStrictShape(merged.byRole.windDown),
    },
  }
}
