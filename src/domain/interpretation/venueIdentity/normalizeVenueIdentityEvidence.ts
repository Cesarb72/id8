import type {
  NormalizedVenueIdentityEvidence,
  PhysicalDiscriminator,
  VenueIdentityResolutionEvidence,
} from "./types";

const CITY_ALIASES: Record<string, string> = {
  "san jose": "san-jose",
  "san jose ca": "san-jose",
  "san jose california": "san-jose",
  "santa clara": "santa-clara",
  "santa clara ca": "santa-clara",
  "santa clara california": "santa-clara",
};

const LEGAL_SUFFIXES = new Set([
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "co",
  "company",
  "corp",
  "corporation",
]);

export function normalizeVenueIdentityEvidence(
  evidence: VenueIdentityResolutionEvidence,
): NormalizedVenueIdentityEvidence {
  const normalizedAddress = evidence.formattedAddress
    ? normalizeQualifiedStreetAddress(evidence.formattedAddress)
    : undefined;

  return {
    ...evidence,
    canonicalCityKey: normalizeCityKey(evidence.city ?? evidence.locality ?? evidence.formattedAddress ?? ""),
    normalizedVenueName: normalizeVenueName(evidence.displayName),
    normalizedQualifiedStreetAddress: normalizedAddress,
    physicalDiscriminator: evidence.formattedAddress
      ? extractPhysicalDiscriminator(evidence.formattedAddress)
      : undefined,
    normalizedLocality: evidence.locality ? normalizeText(evidence.locality) : undefined,
    normalizedCategoryFamily: evidence.categoryFamily ? normalizeText(evidence.categoryFamily) : undefined,
    hasQualifiedStreetAddress: Boolean(normalizedAddress && isQualifiedStreetAddress(normalizedAddress)),
  };
}

export function normalizeCityKey(value: string): string {
  const normalized = normalizeText(value)
    .replace(/\bca\b/g, " ")
    .replace(/\bcalifornia\b/g, " ")
    .replace(/\busa\b/g, " ")
    .replace(/\bunited states\b/g, " ")
    .trim();

  for (const [alias, key] of Object.entries(CITY_ALIASES)) {
    if (normalized.includes(alias)) {
      return key;
    }
  }

  const cityCandidate = normalized
    .split(/\b\d{5}(?:\d{4})?\b/)[0]
    .split(",")[0]
    .trim();

  return slugify(cityCandidate || normalized || "unknown-city");
}

export function normalizeVenueName(value: string): string {
  const normalized = normalizeText(value);
  const tokens = normalized.split(" ").filter((token) => token && !LEGAL_SUFFIXES.has(token));
  return tokens.join(" ");
}

export function normalizeQualifiedStreetAddress(value: string): string {
  return normalizeStreetAbbreviations(stripPhysicalDiscriminator(normalizeText(value)))
    .replace(/\busa\b/g, " ")
    .replace(/\bunited states\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9#/\-., ]+/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export function extractPhysicalDiscriminator(value: string): PhysicalDiscriminator | undefined {
  const normalized = normalizeText(value);
  const patterns: Array<[RegExp, PhysicalDiscriminator["kind"]]> = [
    [/\b(?:unit|apt|apartment)\s+#?\s*([a-z0-9-]+)/, "unit"],
    [/\b(?:suite|ste)\s+#?\s*([a-z0-9-]+)/, "suite"],
    [/#\s*([a-z0-9-]+)/, "unit"],
    [/\b(?:floor|fl)\s+#?\s*([a-z0-9-]+)/, "floor"],
    [/\b(?:stall|kiosk|booth)\s+#?\s*([a-z0-9-]+)/, "stall"],
    [/\b(?:bldg|building)\s+#?\s*([a-z0-9-]+)/, "building"],
  ];

  for (const [pattern, kind] of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return {
        kind,
        value: match[1],
        normalizedValue: `${kind}-${slugify(match[1])}`,
      };
    }
  }

  return undefined;
}

export function isQualifiedStreetAddress(normalizedAddress: string): boolean {
  return /^\d/.test(normalizedAddress) && /[a-z]/.test(normalizedAddress);
}

function stripPhysicalDiscriminator(normalizedAddress: string): string {
  return normalizedAddress
    .replace(/\b(?:unit|apt|apartment)\s+#?\s*[a-z0-9-]+/g, " ")
    .replace(/\b(?:suite|ste)\s+#?\s*[a-z0-9-]+/g, " ")
    .replace(/#\s*[a-z0-9-]+/g, " ")
    .replace(/\b(?:floor|fl)\s+#?\s*[a-z0-9-]+/g, " ")
    .replace(/\b(?:stall|kiosk|booth)\s+#?\s*[a-z0-9-]+/g, " ")
    .replace(/\b(?:bldg|building)\s+#?\s*[a-z0-9-]+/g, " ");
}

function normalizeStreetAbbreviations(value: string): string {
  return value
    .replace(/\bst\b/g, "street")
    .replace(/\brd\b/g, "road")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bblvd\b/g, "boulevard")
    .replace(/\bdr\b/g, "drive")
    .replace(/\bln\b/g, "lane")
    .replace(/\bct\b/g, "court")
    .replace(/\bpkwy\b/g, "parkway")
    .replace(/\bpl\b/g, "place")
    .replace(/\bsq\b/g, "square");
}
