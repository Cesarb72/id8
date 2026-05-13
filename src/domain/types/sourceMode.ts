// Retrieval/provider activation mode. This governs whether Field may attempt live fetches.
export type SourceMode = 'curated' | 'live' | 'hybrid'

// Engine supply source mode. This travels with provider-seeded or opportunity-shaped inputs
// so downstream engines never infer supply lineage from venue shape or provider metadata.
export type EngineSourceMode = 'curated' | 'live' | 'bootstrap'

export type VenueSourceOrigin = 'curated' | 'live'

export type FieldGovernanceRuntimeMode =
  | 'demo_dev_closeout'
  | 'standard_local'
  | 'api_governed'

export type FieldFallbackSource =
  | 'curated'
  | 'bootstrap'
  | 'default_city'
  | 'fixture'

export type FieldInventoryTruth =
  | 'real_live'
  | 'hybrid_live_bootstrap'
  | 'curated_only'
  | 'fallback_filled'
  | 'live_failed_empty'

export type CuratedSourceSubtype =
  | 'seed'
  | 'bootstrap-portable'
  | 'manual-custom'
  | 'curated-derived'

export type LiveDataProvider = 'google-places'

export type ProviderAuthorityClass =
  | 'live_authoritative'
  | 'seed_non_authoritative'
  | 'manual_non_provider'
  | 'bootstrap_non_authoritative'
  | 'curated_non_authoritative'
