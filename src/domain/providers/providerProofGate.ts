import type { ExperienceMode } from '../types/intent'
import type { SourceMode } from '../types/sourceMode'
import type { StarterPack } from '../types/starterPack'

export interface DessertConversationProofInput {
  mode: ExperienceMode
  requestedSourceMode: SourceMode
  starterPack?: StarterPack
}

export interface CurateProofSourceModeInput {
  mode: ExperienceMode
  starterPack?: StarterPack
}

export interface DessertConversationProofResolution {
  allowed: boolean
  effectiveSourceMode: SourceMode
  liveQueryLabels: string[]
  maxQueryCenters: number
  reason:
    | 'proof_enabled'
    | 'proof_disabled'
    | 'source_mode_not_hybrid'
    | 'mode_not_curate'
    | 'starter_not_allowed'
}

const DESSERT_CONVERSATION_PROOF_ENABLED_ENV_KEY =
  'VITE_ID8_PROVIDER_PROOF_DESSERT_CONVERSATION'
const DESSERT_CONVERSATION_STARTER_ID = 'dessert-conversation'
const DESSERT_CONVERSATION_LIVE_QUERY_LABEL = 'dessert-winddown'
const DESSERT_CONVERSATION_MAX_QUERY_CENTERS = 1

function getProcessEnvValue(key: string): string | undefined {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env
  return processEnv?.[key]
}

function readEnvValue(key: string): string | undefined {
  const importMetaEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env
  return importMetaEnv?.[key] ?? getProcessEnvValue(key)
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function blocked(
  reason: Exclude<DessertConversationProofResolution['reason'], 'proof_enabled'>,
): DessertConversationProofResolution {
  return {
    allowed: false,
    effectiveSourceMode: 'curated',
    liveQueryLabels: [],
    maxQueryCenters: 0,
    reason,
  }
}

export function resolveDessertConversationProviderProof(
  input: DessertConversationProofInput,
): DessertConversationProofResolution {
  if (!parseBooleanEnv(readEnvValue(DESSERT_CONVERSATION_PROOF_ENABLED_ENV_KEY))) {
    return blocked('proof_disabled')
  }

  if (input.requestedSourceMode !== 'hybrid') {
    return blocked('source_mode_not_hybrid')
  }

  if (input.mode !== 'curate') {
    return blocked('mode_not_curate')
  }

  if (input.starterPack?.id !== DESSERT_CONVERSATION_STARTER_ID) {
    return blocked('starter_not_allowed')
  }

  return {
    allowed: true,
    effectiveSourceMode: 'hybrid',
    liveQueryLabels: [DESSERT_CONVERSATION_LIVE_QUERY_LABEL],
    maxQueryCenters: DESSERT_CONVERSATION_MAX_QUERY_CENTERS,
    reason: 'proof_enabled',
  }
}

export function resolveCurateProofSourceMode(input: CurateProofSourceModeInput): SourceMode {
  const proof = resolveDessertConversationProviderProof({
    mode: input.mode,
    requestedSourceMode: 'hybrid',
    starterPack: input.starterPack,
  })

  return proof.allowed ? proof.effectiveSourceMode : 'curated'
}

export const providerProofGateConfig = {
  dessertConversation: {
    enabledEnvKey: DESSERT_CONVERSATION_PROOF_ENABLED_ENV_KEY,
    liveQueryLabel: DESSERT_CONVERSATION_LIVE_QUERY_LABEL,
    maxQueryCenters: DESSERT_CONVERSATION_MAX_QUERY_CENTERS,
    starterId: DESSERT_CONVERSATION_STARTER_ID,
  },
}
