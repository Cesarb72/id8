import {
  AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT,
  AUTHORITATIVE_STAGE0_EVIDENCE_SHA256,
  validateIdentityEvidenceCorpusFile,
} from "./identityEvidenceCorpusGuard";
import {
  normalizeQualifiedStreetAddress,
  normalizeVenueIdentityEvidence,
  resolveVenueIdentity,
  serializePhysicalPlaceIdentityKey,
  type StaticCanonicalVenueIdentity,
  type VenueIdentityResolution,
  type VenueIdentityResolutionContext,
  type VenueIdentityResolutionEvidence,
} from "../src/domain/interpretation/venueIdentity";

const CORPUS_PATH =
  "src/domain/field/corpus/evidence/provider-corpus-real-1781057364783/provider-corpus-snapshot.provider.json";
const EXPECTED_CORPUS_SHA256 = AUTHORITATIVE_STAGE0_EVIDENCE_SHA256;
const EXPECTED_CORPUS_COUNT = AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT;

const STATIC_CANONICALS: StaticCanonicalVenueIdentity[] = [
  {
    baseVenueId: "sj-paper-plane",
    name: "Paper Plane",
    canonicalCityKey: "san-jose",
    formattedAddress: "72 S 1st St, San Jose, CA 95113",
    providerRecordIds: ["ChIJ2XdOpLzMj4ARkdRQg4ZRVTY"],
  },
  {
    baseVenueId: "sj-haberdasher",
    name: "Haberdasher",
    canonicalCityKey: "san-jose",
    formattedAddress: "43 W San Salvador St, San Jose, CA 95113",
    providerRecordIds: ["ChIJkV6TlrDMj4ARIPxsqSMrdr4"],
  },
  {
    baseVenueId: "sj-miniboss",
    name: "MINIBOSS",
    canonicalCityKey: "san-jose",
    formattedAddress: "52 E Santa Clara St, San Jose, CA 95113",
    providerRecordIds: ["ChIJ399WwE7Nj4ARngCc39Ai0Hw"],
  },
  {
    baseVenueId: "sj-tech-interactive",
    name: "The Tech Interactive",
    canonicalCityKey: "san-jose",
    formattedAddress: "201 S Market St, San Jose, CA 95113",
    providerRecordIds: ["ChIJR8HI1brMj4ARBnFq5rlvpx4"],
  },
];

const STATIC_ROWS = new Set([2, 7, 42, 64]);
const PENDING_BY_ROW = new Map<number, string>([
  [23, "multi_venue_address_without_unit_data"],
  [49, "multi_venue_address_without_unit_data"],
  [52, "multi_venue_address_without_unit_data"],
  [54, "multi_venue_address_without_unit_data"],
  [56, "multi_venue_address_without_unit_data"],
  [63, "coordinate_only"],
  [67, "coordinate_only"],
  [68, "coordinate_only"],
  [84, "multi_venue_address_without_unit_data"],
  [88, "multi_venue_address_without_unit_data"],
]);
const DUPLICATE_PAIRS: Array<[number, number]> = [
  [5, 15],
  [18, 50],
  [19, 73],
  [27, 85],
  [53, 74],
];

interface ProviderCorpusSnapshot {
  venues: ProviderCorpusVenue[];
}

interface ProviderCorpusVenue {
  rawPlace: {
    name: string;
    city?: string;
    neighborhood?: string;
    formattedAddress?: string;
    latitude?: number;
    longitude?: number;
    sourceTypes?: string[];
  };
  provider: string;
  providerRecordId: string;
  support: {
    categoryFamily?: string;
  };
}

function main(): void {
  const { canonicalSha256: corpusHash, corpus } =
    validateIdentityEvidenceCorpusFile<ProviderCorpusSnapshot>(CORPUS_PATH, {
      expectedRowCount: EXPECTED_CORPUS_COUNT,
      expectedSha256: EXPECTED_CORPUS_SHA256,
      label: "Stage 0 identity evidence",
    });

  const evidenceRows = corpus.venues.map((venue, index) => ({
    row: index + 1,
    evidence: venueToEvidence(venue),
  }));
  const context = buildResolutionContext(evidenceRows.map((row) => row.evidence));
  const results = evidenceRows.map((row) => ({
    row: row.row,
    result: resolveVenueIdentity({ evidence: row.evidence, context }),
  }));

  const staticResults = results.filter(({ result }) => result.status === "static_canonical");
  const providerOnlyRows = results.filter(({ row }) => !STATIC_ROWS.has(row));
  const cleanProviderRows = providerOnlyRows.filter(({ result }) => result.status === "provider_only_canonical");
  const pendingRows = providerOnlyRows.filter(({ result }) => result.status === "pending");

  assert(staticResults.length === 4, `expected 4 static convergences, got ${staticResults.length}`);
  assertSet(
    new Set(staticResults.map(({ row }) => row)),
    STATIC_ROWS,
    "static convergence rows",
  );
  assert(
    cleanProviderRows.length === 82,
    `expected 82/92 clean provider-only observation resolutions, got ${cleanProviderRows.length}; pending rows=${pendingRows.map(({ row }) => row).join(",")}`,
  );
  assert(
    pendingRows.length === 10,
    `expected 10/92 pending provider-only observations, got ${pendingRows.length}; pending rows=${pendingRows.map(({ row }) => row).join(",")}`,
  );
  for (const [row, reason] of PENDING_BY_ROW) {
    const pending = results.find((result) => result.row === row)?.result;
    assert(pending?.status === "pending", `row ${row} should be pending`);
    assert(pending.pendingReason === reason, `row ${row} pending reason should be ${reason}, got ${pending.pendingReason}`);
    assert(pending.routeIdentityEligible === false, `row ${row} pending should not be route identity eligible`);
    assert(pending.diagnosticOnly === true, `row ${row} pending should be diagnostic-only`);
  }

  for (const [left, right] of DUPLICATE_PAIRS) {
    const leftId = resolvedId(results.find((result) => result.row === left)?.result);
    const rightId = resolvedId(results.find((result) => result.row === right)?.result);
    assert(leftId === rightId, `duplicate pair ${left}/${right} did not converge`);
  }

  assert(
    providerOnlyRows.filter(({ result }) => result.status === "pending" && result.pendingReason === "coordinate_only").length === 3,
    "coordinate-only observations should remain pending",
  );
  assert(
    providerOnlyRows.filter(
      ({ result }) => result.status === "pending" && result.pendingReason === "multi_venue_address_without_unit_data",
    ).length === 7,
    "multi-tenant observations missing required discriminators should remain pending",
  );

  assertSyntheticCases(context);

  for (const { result } of results) {
    const id = resolvedId(result);
    if (!id) {
      continue;
    }
    assert(!id.includes("live_google_"), `baseVenueId contains live_google_: ${id}`);
    assert(!id.includes(result.providerProvenance?.providerRecordId ?? "__not_present__"), "baseVenueId contains providerRecordId");
  }

  const uniqueProviderIds = new Set(cleanProviderRows.map(({ result }) => resolvedId(result))).size;
  const exampleProviderOnly = cleanProviderRows[0]?.result;
  assert(exampleProviderOnly?.status === "provider_only_canonical", "missing provider-only example");

  console.log("venue identity resolution proof PASS");
  console.log(`corpus observations=${corpus.venues.length}`);
  console.log(`corpus sha256=${corpusHash}`);
  console.log("static canonical convergences=4 rows=2,7,42,64");
  console.log(`provider-only observation-level clean=${cleanProviderRows.length}/92`);
  console.log(`provider-only unique clean identities=${uniqueProviderIds}`);
  console.log("pending=10 causes=multi_venue_address_without_unit_data:7, coordinate_only:3");
  console.log("duplicate convergence pairs=5/15,18/50,19/73,27/85,53/74");
  console.log(`physical place serialization example=${JSON.stringify(exampleProviderOnly.physicalPlaceKeySerialization)}`);
  console.log(`provider-only baseVenueId example=${exampleProviderOnly.baseVenueId}`);
  console.log("provider provenance retained=yes");
  console.log("provider calls=0");
  console.log("corpus writes=0");
}

function buildResolutionContext(evidenceRows: VenueIdentityResolutionEvidence[]): VenueIdentityResolutionContext {
  const normalizedRows = evidenceRows.map((evidence) => normalizeVenueIdentityEvidence(evidence));
  const addressGroups = new Map<string, Set<string>>();

  for (const evidence of normalizedRows) {
    if (!evidence.normalizedQualifiedStreetAddress || !evidence.hasQualifiedStreetAddress) {
      continue;
    }
    const group = addressGroups.get(evidence.normalizedQualifiedStreetAddress) ?? new Set<string>();
    group.add(evidence.normalizedVenueName);
    addressGroups.set(evidence.normalizedQualifiedStreetAddress, group);
  }

  const requiredDiscriminatorAddressKeys = new Set<string>();
  for (const evidence of normalizedRows) {
    if (!evidence.normalizedQualifiedStreetAddress) {
      continue;
    }
    const hasExplicitMultiTenantSignal = (evidence.sourceTypes ?? []).some((type) => type === "food_court")
      || evidence.normalizedVenueName.includes("food hall")
      || evidence.normalizedVenueName.includes("food truck")
      || /\bmarket\b/.test(evidence.normalizedVenueName)
      || evidence.normalizedVenueName.includes("valley fair");
    const distinctNamesAtAddress = (addressGroups.get(evidence.normalizedQualifiedStreetAddress)?.size ?? 0) > 1;
    if (hasExplicitMultiTenantSignal || distinctNamesAtAddress) {
      requiredDiscriminatorAddressKeys.add(evidence.normalizedQualifiedStreetAddress);
    }
  }

  return {
    staticCanonicals: STATIC_CANONICALS,
    requiredDiscriminatorAddressKeys: [...requiredDiscriminatorAddressKeys],
  };
}

function venueToEvidence(venue: ProviderCorpusVenue): VenueIdentityResolutionEvidence {
  return {
    displayName: venue.rawPlace.name,
    city: venue.rawPlace.city,
    locality: venue.rawPlace.neighborhood,
    formattedAddress: venue.rawPlace.formattedAddress,
    coordinates: typeof venue.rawPlace.latitude === "number" && typeof venue.rawPlace.longitude === "number"
      ? { lat: venue.rawPlace.latitude, lng: venue.rawPlace.longitude }
      : undefined,
    categoryFamily: venue.support.categoryFamily,
    sourceTypes: venue.rawPlace.sourceTypes,
    providerProvenance: {
      provider: venue.provider,
      providerRecordId: venue.providerRecordId,
    },
  };
}

function assertSyntheticCases(context: VenueIdentityResolutionContext): void {
  const sameNameDifferentAddressA = resolveVenueIdentity({
    evidence: syntheticEvidence("Chain Coffee", "101 Main St, San Jose, CA 95113", "San Jose"),
    context,
  });
  const sameNameDifferentAddressB = resolveVenueIdentity({
    evidence: syntheticEvidence("Chain Coffee", "201 Main St, San Jose, CA 95113", "San Jose"),
    context,
  });
  assert(resolvedId(sameNameDifferentAddressA) !== resolvedId(sameNameDifferentAddressB), "same name at different addresses should be distinct");

  const mutableA = resolveVenueIdentity({
    evidence: syntheticEvidence("Old Name Dessert", "45 Sample St, San Jose, CA 95113", "San Jose", "ice_cream"),
    context,
  });
  const mutableB = resolveVenueIdentity({
    evidence: syntheticEvidence("New Name Cafe", "45 Sample St, San Jose, CA 95113", "San Jose", "coffee_books"),
    context,
  });
  assert(resolvedId(mutableA) === resolvedId(mutableB), "mutable name/category/locality evidence should not author different IDs at same physical place");

  assert(mutableA.status === "provider_only_canonical", "rename seed should resolve provider-only");
  const renameResolution = resolveVenueIdentity({
    evidence: syntheticEvidence("Renamed Again", "45 Sample St, San Jose, CA 95113", "San Jose", "coffee_books"),
    context: {
      ...context,
      issuedProviderOnlyCanonicals: [
        {
          baseVenueId: mutableA.baseVenueId,
          physicalPlaceKey: mutableA.physicalPlaceKey,
        },
      ],
    },
  });
  assert(resolvedId(renameResolution) === mutableA.baseVenueId, "rename evidence should locate existing identity without reminting");

  const chainLocationA = resolveVenueIdentity({
    evidence: syntheticEvidence("Gelato Chain", "1 Center St, San Jose, CA 95113", "San Jose"),
    context,
  });
  const chainLocationB = resolveVenueIdentity({
    evidence: syntheticEvidence("Gelato Chain", "1 Center St, Oakland, CA 94612", "Oakland"),
    context,
  });
  assert(resolvedId(chainLocationA) !== resolvedId(chainLocationB), "chain locations in different cities should be distinct");

  const sanJose = resolveVenueIdentity({
    evidence: syntheticEvidence("Portable Cafe", "10 Santa Clara St, San Jose, CA 95113", "San José"),
    context,
  });
  const sanJoseAlias = resolveVenueIdentity({
    evidence: syntheticEvidence("Portable Cafe", "10 Santa Clara St, San Jose, CA 95113", "San Jose"),
    context,
  });
  assert(resolvedId(sanJose) === resolvedId(sanJoseAlias), "San Jose/San José aliases should converge");

  const noUnit = resolveVenueIdentity({
    evidence: syntheticEvidence("Market Stall", "777 Shared Market St, San Jose, CA 95113", "San Jose", "street_food", ["food_court"]),
    context,
  });
  assert(noUnit.status === "pending", "multi-tenant missing discriminator should be pending");

  const withUnit = resolveVenueIdentity({
    evidence: syntheticEvidence("Market Stall", "777 Shared Market St #12, San Jose, CA 95113", "San Jose", "street_food", ["food_court"]),
    context,
  });
  assert(withUnit.status === "provider_only_canonical", "multi-tenant with discriminator should issue");
  assert(
    withUnit.physicalPlaceKeySerialization.endsWith("discriminator=unit-12"),
    "discriminator should serialize separately and exactly once",
  );
  assert(
    serializePhysicalPlaceIdentityKey(withUnit.physicalPlaceKey).includes("address=777 shared market street san jose ca 95113\n"),
    "qualified address should exclude unit discriminator",
  );
}

function syntheticEvidence(
  displayName: string,
  formattedAddress: string,
  city: string,
  categoryFamily = "dining",
  sourceTypes: string[] = ["restaurant"],
): VenueIdentityResolutionEvidence {
  return {
    displayName,
    city,
    formattedAddress,
    categoryFamily,
    sourceTypes,
    providerProvenance: {
      provider: "google-places",
      providerRecordId: `synthetic-provider-${displayName}-${formattedAddress}`,
    },
  };
}

function resolvedId(result: VenueIdentityResolution | undefined): string | undefined {
  return result?.status === "static_canonical" || result?.status === "provider_only_canonical"
    ? result.baseVenueId
    : undefined;
}

function assertSet(actual: Set<number>, expected: Set<number>, label: string): void {
  assert(actual.size === expected.size, `${label} expected ${[...expected].join(",")}, got ${[...actual].join(",")}`);
  for (const value of expected) {
    assert(actual.has(value), `${label} missing ${value}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main();
