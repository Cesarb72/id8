import {
  normalizeQualifiedStreetAddress,
  normalizeVenueIdentityEvidence,
  slugify,
} from "./normalizeVenueIdentityEvidence";
import {
  PHYSICAL_PLACE_KEY_VERSION,
  VENUE_IDENTITY_ALGORITHM_VERSION,
  type AmbiguousVenueIdentityResolution,
  type IssuedProviderOnlyVenueIdentity,
  type MultiTenantDiagnosticSubtype,
  type NormalizedVenueIdentityEvidence,
  type PendingVenueIdentityResolution,
  type PhysicalPlaceIdentityKey,
  type ProviderOnlyVenueIdentityResolution,
  type StaticCanonicalVenueIdentity,
  type StaticCanonicalVenueIdentityResolution,
  type VenueIdentityPendingReason,
  type VenueIdentityResolution,
  type VenueIdentityResolutionInput,
} from "./types";

export function resolveVenueIdentity(input: VenueIdentityResolutionInput): VenueIdentityResolution {
  const normalizedEvidence = isNormalizedEvidence(input.evidence)
    ? input.evidence
    : normalizeVenueIdentityEvidence(input.evidence);
  const context = input.context ?? {};
  const notes: string[] = [];

  const continuityBaseVenueId = normalizedEvidence.continuityBaseVenueId?.trim();
  if (continuityBaseVenueId) {
    return staticResolution(normalizedEvidence, continuityBaseVenueId, "persisted_continuity", [
      "persisted continuity identity honored before mutable evidence",
    ]);
  }

  const staticMatches = findStaticCanonicalMatches(normalizedEvidence, context.staticCanonicals ?? []);
  if (staticMatches.length === 1) {
    return staticResolution(normalizedEvidence, staticMatches[0].baseVenueId, "exact_static_canonical", [
      "exact static-canonical convergence selected one authority identity",
    ]);
  }
  if (staticMatches.length > 1) {
    return ambiguousResolution(
      normalizedEvidence,
      "ambiguous_static_canonical_match",
      staticMatches.map((candidate) => candidate.baseVenueId),
      notes,
    );
  }

  if (!normalizedEvidence.normalizedQualifiedStreetAddress || !normalizedEvidence.hasQualifiedStreetAddress) {
    return pendingResolution(
      normalizedEvidence,
      normalizedEvidence.coordinates ? "coordinate_only" : "thin_or_absent_address",
      notes,
    );
  }

  const discriminatorRequirement = requiredDiscriminatorFor(normalizedEvidence, context.requiredDiscriminatorAddressKeys ?? []);
  if (discriminatorRequirement.required && !normalizedEvidence.physicalDiscriminator) {
    return pendingResolution(
      normalizedEvidence,
      "multi_venue_address_without_unit_data",
      notes,
      discriminatorRequirement.subtype,
    );
  }

  const physicalPlaceKey = buildPhysicalPlaceIdentityKey(
    normalizedEvidence,
    discriminatorRequirement.required ? normalizedEvidence.physicalDiscriminator?.normalizedValue : undefined,
  );
  const serialization = serializePhysicalPlaceIdentityKey(physicalPlaceKey);
  const issuedMatches = findIssuedProviderOnlyMatches(physicalPlaceKey, context.issuedProviderOnlyCanonicals ?? []);

  if (issuedMatches.length === 1) {
    return providerOnlyResolution(
      normalizedEvidence,
      issuedMatches[0].baseVenueId,
      "existing_provider_only_canonical",
      physicalPlaceKey,
      serialization,
      ["existing provider-only canonical located by physical-place key"],
    );
  }
  if (issuedMatches.length > 1) {
    return ambiguousResolution(
      normalizedEvidence,
      "ambiguous_provider_only_match",
      issuedMatches.map((candidate) => candidate.baseVenueId),
      notes,
      physicalPlaceKey,
      serialization,
    );
  }

  return providerOnlyResolution(
    normalizedEvidence,
    deriveProviderOnlyBaseVenueId(physicalPlaceKey),
    "new_provider_only_canonical",
    physicalPlaceKey,
    serialization,
    ["new provider-only canonical issued from physical-place key only"],
  );
}

export function buildPhysicalPlaceIdentityKey(
  evidence: NormalizedVenueIdentityEvidence,
  requiredPhysicalDiscriminator?: string,
): PhysicalPlaceIdentityKey {
  return {
    identityKeyVersion: PHYSICAL_PLACE_KEY_VERSION,
    canonicalCityKey: evidence.canonicalCityKey,
    normalizedQualifiedStreetAddress: evidence.normalizedQualifiedStreetAddress ?? "",
    requiredPhysicalDiscriminator,
  };
}

export function serializePhysicalPlaceIdentityKey(key: PhysicalPlaceIdentityKey): string {
  return [
    key.identityKeyVersion,
    `city=${key.canonicalCityKey}`,
    `address=${key.normalizedQualifiedStreetAddress}`,
    `discriminator=${key.requiredPhysicalDiscriminator ?? "none"}`,
  ].join("\n");
}

export function deriveProviderOnlyBaseVenueId(key: PhysicalPlaceIdentityKey): string {
  const hash = sha256Hex(serializePhysicalPlaceIdentityKey(key)).slice(0, 12);
  const addressSlug = slugify(key.normalizedQualifiedStreetAddress).slice(0, 48);
  return `${key.canonicalCityKey}-venue-${addressSlug}-${hash}`;
}

function findStaticCanonicalMatches(
  evidence: NormalizedVenueIdentityEvidence,
  staticCanonicals: StaticCanonicalVenueIdentity[],
): StaticCanonicalVenueIdentity[] {
  const providerRecordId = evidence.providerProvenance?.providerRecordId;
  const providerMatches = providerRecordId
    ? staticCanonicals.filter((candidate) => candidate.providerRecordIds?.includes(providerRecordId))
    : [];
  if (providerMatches.length > 0) {
    return providerMatches;
  }

  return staticCanonicals.filter((candidate) => {
    const candidateAddress = candidate.normalizedQualifiedStreetAddress
      ?? (candidate.formattedAddress ? normalizeQualifiedStreetAddress(candidate.formattedAddress) : undefined);
    const candidateCity = candidate.canonicalCityKey ?? evidence.canonicalCityKey;
    const sameCity = candidateCity === evidence.canonicalCityKey;
    const sameAddress = Boolean(candidateAddress && candidateAddress === evidence.normalizedQualifiedStreetAddress);
    const sameName = candidate.name
      ? slugify(candidate.name) === slugify(evidence.normalizedVenueName)
      : false;
    return sameCity && sameAddress && sameName;
  });
}

function findIssuedProviderOnlyMatches(
  key: PhysicalPlaceIdentityKey,
  issuedCanonicals: IssuedProviderOnlyVenueIdentity[],
): IssuedProviderOnlyVenueIdentity[] {
  const serialized = serializePhysicalPlaceIdentityKey(key);
  return issuedCanonicals.filter((candidate) => serializePhysicalPlaceIdentityKey(candidate.physicalPlaceKey) === serialized);
}

function requiredDiscriminatorFor(
  evidence: NormalizedVenueIdentityEvidence,
  requiredAddressKeys: string[],
): { required: boolean; subtype?: MultiTenantDiagnosticSubtype } {
  const requiredByAddress = evidence.normalizedQualifiedStreetAddress
    ? requiredAddressKeys.includes(evidence.normalizedQualifiedStreetAddress)
    : false;
  const types = evidence.sourceTypes?.map((type) => type.toLowerCase()) ?? [];
  const name = evidence.normalizedVenueName;
  const foodCourt = types.includes("food_court") || name.includes("food hall");
  const foodTrucks = name.includes("food truck");
  const mall = name.includes("valley fair") || name.includes("mall");
  const market = /\bmarket\b/.test(name);

  if (!requiredByAddress && !foodCourt && !foodTrucks && !mall && !market) {
    return { required: false };
  }

  if (foodTrucks) {
    return { required: true, subtype: "food_truck_aggregation" };
  }
  if (mall) {
    return { required: true, subtype: "mall_storefront_missing_unit" };
  }
  if (foodCourt && !market) {
    return { required: true, subtype: "internal_tenant_or_stall" };
  }
  if (market || foodCourt) {
    return { required: true, subtype: "parent_market_food_hall" };
  }
  return { required: true, subtype: "unknown_multi_tenant_venue" };
}

function staticResolution(
  normalizedEvidence: NormalizedVenueIdentityEvidence,
  baseVenueId: string,
  source: StaticCanonicalVenueIdentityResolution["source"],
  notes: string[],
): StaticCanonicalVenueIdentityResolution {
  return {
    algorithmVersion: VENUE_IDENTITY_ALGORITHM_VERSION,
    status: "static_canonical",
    baseVenueId,
    source,
    normalizedEvidence,
    providerProvenance: normalizedEvidence.providerProvenance,
    routeIdentityEligible: true,
    diagnosticOnly: false,
    notes,
  };
}

function providerOnlyResolution(
  normalizedEvidence: NormalizedVenueIdentityEvidence,
  baseVenueId: string,
  source: ProviderOnlyVenueIdentityResolution["source"],
  physicalPlaceKey: PhysicalPlaceIdentityKey,
  physicalPlaceKeySerialization: string,
  notes: string[],
): ProviderOnlyVenueIdentityResolution {
  return {
    algorithmVersion: VENUE_IDENTITY_ALGORITHM_VERSION,
    status: "provider_only_canonical",
    baseVenueId,
    source,
    physicalPlaceKey,
    physicalPlaceKeySerialization,
    normalizedEvidence,
    providerProvenance: normalizedEvidence.providerProvenance,
    routeIdentityEligible: true,
    diagnosticOnly: false,
    notes,
  };
}

function pendingResolution(
  normalizedEvidence: NormalizedVenueIdentityEvidence,
  pendingReason: VenueIdentityPendingReason,
  notes: string[],
  pendingSubtype?: MultiTenantDiagnosticSubtype,
): PendingVenueIdentityResolution {
  return {
    algorithmVersion: VENUE_IDENTITY_ALGORITHM_VERSION,
    status: "pending",
    pendingReason,
    pendingSubtype,
    normalizedEvidence,
    providerProvenance: normalizedEvidence.providerProvenance,
    routeIdentityEligible: false,
    diagnosticOnly: true,
    notes,
  };
}

function ambiguousResolution(
  normalizedEvidence: NormalizedVenueIdentityEvidence,
  pendingReason: VenueIdentityPendingReason,
  candidateBaseVenueIds: string[],
  notes: string[],
  physicalPlaceKey?: PhysicalPlaceIdentityKey,
  physicalPlaceKeySerialization?: string,
): AmbiguousVenueIdentityResolution {
  return {
    algorithmVersion: VENUE_IDENTITY_ALGORITHM_VERSION,
    status: "ambiguous",
    pendingReason,
    candidateBaseVenueIds,
    physicalPlaceKey,
    physicalPlaceKeySerialization,
    normalizedEvidence,
    providerProvenance: normalizedEvidence.providerProvenance,
    routeIdentityEligible: false,
    diagnosticOnly: true,
    notes,
  };
}

function isNormalizedEvidence(
  evidence: VenueIdentityResolutionInput["evidence"],
): evidence is NormalizedVenueIdentityEvidence {
  return "canonicalCityKey" in evidence && "normalizedVenueName" in evidence;
}

function sha256Hex(input: string): string {
  const bytes = Array.from(input, (character) => character.charCodeAt(0) & 0xff);
  const words = new Array<number>(64);
  const hash = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  }

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      words[i] =
        (bytes[offset + i * 4] << 24)
        | (bytes[offset + i * 4 + 1] << 16)
        | (bytes[offset + i * 4 + 2] << 8)
        | bytes[offset + i * 4 + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotateRight(words[i - 15], 7) ^ rotateRight(words[i - 15], 18) ^ (words[i - 15] >>> 3);
      const s1 = rotateRight(words[i - 2], 17) ^ rotateRight(words[i - 2], 19) ^ (words[i - 2] >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + constants[i] + words[i]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
