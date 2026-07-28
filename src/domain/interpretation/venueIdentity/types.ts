export const VENUE_IDENTITY_ALGORITHM_VERSION = "venue_identity_resolution.v1" as const;
export const PHYSICAL_PLACE_KEY_VERSION = "physical_place_key.v1" as const;

export type VenueIdentityAlgorithmVersion = typeof VENUE_IDENTITY_ALGORITHM_VERSION;
export type PhysicalPlaceKeyVersion = typeof PHYSICAL_PLACE_KEY_VERSION;

export type VenueIdentityResolutionStatus =
  | "static_canonical"
  | "provider_only_canonical"
  | "pending"
  | "ambiguous";

export type VenueIdentityPendingReason =
  | "thin_or_absent_address"
  | "multi_venue_address_without_unit_data"
  | "coordinate_only"
  | "identity_pending_additional_evidence"
  | "ambiguous_static_canonical_match"
  | "ambiguous_provider_only_match"
  | "identity_collision_requires_review"
  | "identity_continuity_ambiguous";

export type MultiTenantDiagnosticSubtype =
  | "parent_market_food_hall"
  | "internal_tenant_or_stall"
  | "food_truck_aggregation"
  | "mall_storefront_missing_unit"
  | "unknown_multi_tenant_venue";

export type PhysicalDiscriminatorKind =
  | "unit"
  | "suite"
  | "floor"
  | "stall"
  | "hotel_internal"
  | "building"
  | "other";

export interface VenueCoordinates {
  lat: number;
  lng: number;
}

export interface PhysicalDiscriminator {
  kind: PhysicalDiscriminatorKind;
  value: string;
  normalizedValue: string;
}

export interface PhysicalPlaceIdentityKey {
  identityKeyVersion: PhysicalPlaceKeyVersion;
  canonicalCityKey: string;
  normalizedQualifiedStreetAddress: string;
  requiredPhysicalDiscriminator?: string;
}

export interface VenueIdentityProviderProvenance {
  provider: string;
  providerRecordId?: string;
  sourceStopId?: string;
  queryLabel?: string;
  runId?: string;
}

export interface StaticCanonicalVenueIdentity {
  baseVenueId: string;
  canonicalCityKey?: string;
  name?: string;
  formattedAddress?: string;
  normalizedQualifiedStreetAddress?: string;
  coordinates?: VenueCoordinates;
  categoryFamily?: string;
  providerRecordIds?: string[];
}

export interface IssuedProviderOnlyVenueIdentity {
  baseVenueId: string;
  physicalPlaceKey: PhysicalPlaceIdentityKey;
  providerRecordIds?: string[];
}

export interface VenueIdentityResolutionEvidence {
  displayName: string;
  formattedAddress?: string;
  city?: string;
  locality?: string;
  neighborhood?: string;
  coordinates?: VenueCoordinates;
  categoryFamily?: string;
  sourceTypes?: string[];
  providerProvenance?: VenueIdentityProviderProvenance;
  continuityBaseVenueId?: string;
}

export interface NormalizedVenueIdentityEvidence extends VenueIdentityResolutionEvidence {
  canonicalCityKey: string;
  normalizedVenueName: string;
  normalizedQualifiedStreetAddress?: string;
  physicalDiscriminator?: PhysicalDiscriminator;
  normalizedLocality?: string;
  normalizedCategoryFamily?: string;
  hasQualifiedStreetAddress: boolean;
}

export interface VenueIdentityResolutionContext {
  staticCanonicals?: StaticCanonicalVenueIdentity[];
  issuedProviderOnlyCanonicals?: IssuedProviderOnlyVenueIdentity[];
  requiredDiscriminatorAddressKeys?: string[];
}

export interface VenueIdentityResolutionInput {
  evidence: VenueIdentityResolutionEvidence | NormalizedVenueIdentityEvidence;
  context?: VenueIdentityResolutionContext;
}

export interface VenueIdentityResolutionBase {
  algorithmVersion: VenueIdentityAlgorithmVersion;
  status: VenueIdentityResolutionStatus;
  normalizedEvidence: NormalizedVenueIdentityEvidence;
  providerProvenance?: VenueIdentityProviderProvenance;
  routeIdentityEligible: boolean;
  diagnosticOnly: boolean;
  notes: string[];
}

export interface StaticCanonicalVenueIdentityResolution extends VenueIdentityResolutionBase {
  status: "static_canonical";
  baseVenueId: string;
  source: "persisted_continuity" | "exact_static_canonical" | "threshold_static_canonical";
  physicalPlaceKey?: PhysicalPlaceIdentityKey;
}

export interface ProviderOnlyVenueIdentityResolution extends VenueIdentityResolutionBase {
  status: "provider_only_canonical";
  baseVenueId: string;
  source: "existing_provider_only_canonical" | "new_provider_only_canonical";
  physicalPlaceKey: PhysicalPlaceIdentityKey;
  physicalPlaceKeySerialization: string;
}

export interface PendingVenueIdentityResolution extends VenueIdentityResolutionBase {
  status: "pending";
  pendingReason: VenueIdentityPendingReason;
  pendingSubtype?: MultiTenantDiagnosticSubtype;
  physicalPlaceKey?: PhysicalPlaceIdentityKey;
  physicalPlaceKeySerialization?: string;
}

export interface AmbiguousVenueIdentityResolution extends VenueIdentityResolutionBase {
  status: "ambiguous";
  pendingReason: VenueIdentityPendingReason;
  candidateBaseVenueIds: string[];
  physicalPlaceKey?: PhysicalPlaceIdentityKey;
  physicalPlaceKeySerialization?: string;
}

export type VenueIdentityResolution =
  | StaticCanonicalVenueIdentityResolution
  | ProviderOnlyVenueIdentityResolution
  | PendingVenueIdentityResolution
  | AmbiguousVenueIdentityResolution;
