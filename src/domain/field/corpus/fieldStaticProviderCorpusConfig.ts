const ENABLED_VALUES = new Set(['1', 'true', 'on', 'yes'])

export const FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY =
  'VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE'

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

export function readFieldStaticProviderCorpusCurateEnvRaw(): string {
  return String(readEnvValue(FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY) ?? '')
}

export function readFieldStaticProviderCorpusCurateEnabled(): boolean {
  return ENABLED_VALUES.has(readFieldStaticProviderCorpusCurateEnvRaw().trim().toLowerCase())
}
