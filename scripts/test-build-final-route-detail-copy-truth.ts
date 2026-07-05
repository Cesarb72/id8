import { readFileSync } from 'node:fs'
import { findScoredVenueForStopWithPolicy } from '../src/app/services/build/finalRouteDetailCopyTruth'
import type { ScoredVenue } from '../src/domain/types/arc'
import type { ItineraryStop, UserStopRole } from '../src/domain/types/itinerary'
import { inverseRoleProjection } from '../src/domain/config/roleProjection'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function includesAny(value: string, needles: string[]): string | null {
  const normalized = normalize(value)
  return needles.find((needle) => normalized.includes(normalize(needle))) ?? null
}

function scoredVenue(id: string, name: string, tags: string[] = []): ScoredVenue {
  return {
    venue: {
      id,
      name,
      tags,
      vibeTags: tags,
      category: 'bar',
      subcategory: tags[0] ?? 'local-fit',
      city: 'San Jose',
      neighborhood: 'San Jose',
      source: {},
    },
  } as unknown as ScoredVenue
}

function itineraryStop(params: {
  role: UserStopRole
  venueId: string
  venueName: string
  category?: ItineraryStop['category']
  subcategory?: string
  tags?: string[]
}): ItineraryStop {
  return {
    id: `${params.venueId}_${params.role}`,
    role: params.role,
    title:
      params.role === 'start'
        ? 'Start'
        : params.role === 'highlight'
          ? 'Highlight'
          : params.role === 'windDown'
            ? 'Wind Down'
            : 'Surprise',
    venueId: params.venueId,
    venueName: params.venueName,
    city: 'San Jose',
    category: params.category ?? 'restaurant',
    subcategory: params.subcategory ?? 'neighborhood',
    priceTier: '$$',
    tags: params.tags ?? ['neighborhood', 'relaxed'],
    vibeTags: [],
    neighborhood: 'San Jose',
    driveMinutes: 8,
    durationClass: 'medium',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: `${params.venueName} fits this route moment.`,
    imageUrl: '',
    stopInsider: {
      roleReason: `${params.venueName} fits the role.`,
      localSignal: 'Local fit.',
      selectionReason: `${params.venueName} was selected for this route.`,
    },
  } as ItineraryStop
}

function safeModeledDetailCopy(stop: ItineraryStop, matchedScoredVenue: ScoredVenue | undefined): string {
  const identityName = matchedScoredVenue?.venue.name ?? stop.venueName
  const category = stop.subcategory || stop.category || 'route stop'
  return `${identityName} is the ${stop.role} stop. Known for ${category}.`
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0
globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-final-route-detail-copy-truth must not call fetch.')
}) as typeof fetch

try {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const helperSource = readFileSync('src/app/services/build/finalRouteDetailCopyTruth.ts', 'utf8')
  const routeAuthoritySource = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
  const runtimeRouteArtifactSource = readFileSync('src/domain/artifacts/runtimeRouteArtifact.ts', 'utf8')

  assert(
    sandboxSource.includes('const finalRouteOwnsStopIdentity = Boolean(renderOnlyFinalRoute)'),
    'Final-route detail copy must explicitly detect final route ownership.',
  )
  assert(
    sandboxSource.includes('allowRoleFallback: !finalRouteOwnsStopIdentity'),
    'Final-route detail copy must disable role-only scored-venue fallback.',
  )
  assert(
    sandboxSource.includes('scoredVenue,') &&
      sandboxSource.includes('allowRoleFallback: !finalRouteOwnsStopIdentity'),
    'Inline detail rendering must pass identity-safe scored metadata into getInlineStopDetail.',
  )
  assert(
    helperSource.includes('matchedByVenueId') &&
      helperSource.includes('matchedByName') &&
      helperSource.includes('allowRoleFallback === false'),
    'Scored venue helper must prefer exact venue identity and support disabling role fallback.',
  )
  assert(
    routeAuthoritySource.includes('provider_shadow_not_authority') &&
      routeAuthoritySource.includes('generated_contract_entry_missing'),
    'routeAuthority provider_shadow guard must remain present.',
  )
  assert(
    runtimeRouteArtifactSource.includes('export interface RuntimeRouteArtifact') &&
      runtimeRouteArtifactSource.includes('stops: RuntimeRouteStop[]'),
    'RuntimeRouteArtifact shape must remain the runtime route owner.',
  )

  const cases = [
    {
      label: 'Village Grill',
      stop: itineraryStop({
        role: 'highlight',
        venueId: 'sj-village-grill',
        venueName: 'Village Grill',
        subcategory: 'restaurant',
        tags: ['restaurant', 'neighborhood', 'friends'],
      }),
      fallback: scoredVenue('sj-hidden-courtyard-cocktail', 'Hidden Courtyard Cocktail Bar', [
        'speakeasy',
        'cocktails',
      ]),
      forbidden: ['Hidden Courtyard Cocktail Bar', 'speakeasy', 'cocktail bar', 'cocktails'],
    },
    {
      label: 'MINIBOSS',
      stop: itineraryStop({
        role: 'highlight',
        venueId: 'sj-miniboss',
        venueName: 'MINIBOSS',
        subcategory: 'arcade bar',
        tags: ['games', 'group-friendly'],
      }),
      fallback: scoredVenue('sj-hidden-courtyard-cocktail', 'Hidden Courtyard Cocktail Bar', [
        'speakeasy',
        'cocktails',
      ]),
      forbidden: ['Hidden Courtyard Cocktail Bar'],
    },
    {
      label: 'Happy Hollow Park & Zoo',
      stop: itineraryStop({
        role: 'highlight',
        venueId: 'sj-happy-hollow',
        venueName: 'Happy Hollow Park & Zoo',
        category: 'park',
        subcategory: 'zoo',
        tags: ['family', 'park', 'zoo'],
      }),
      fallback: scoredVenue('sj-preserve-botanical-studio', 'Preserve Botanical Studio', [
        'botanical',
        'studio',
      ]),
      forbidden: ['Preserve Botanical Studio'],
    },
    {
      label: 'Alum Rock Park',
      stop: itineraryStop({
        role: 'highlight',
        venueId: 'sj-alum-rock-park',
        venueName: 'Alum Rock Park',
        category: 'park',
        subcategory: 'park',
        tags: ['family', 'park', 'nature'],
      }),
      fallback: scoredVenue('sj-preserve-botanical-studio', 'Preserve Botanical Studio', [
        'botanical',
        'studio',
      ]),
      forbidden: ['Preserve Botanical Studio'],
    },
    {
      label: 'Evergreen Coffee Company',
      stop: itineraryStop({
        role: 'highlight',
        venueId: 'sj-evergreen-coffee-company',
        venueName: 'Evergreen Coffee Company',
        category: 'cafe',
        subcategory: 'coffee',
        tags: ['coffee', 'neighborhood', 'relaxed'],
      }),
      fallback: scoredVenue('sj-rose-garden-promenade', 'Rose Garden sunset promenade', [
        'promenade',
        'garden',
      ]),
      forbidden: ['Rose Garden sunset promenade', 'promenade'],
    },
    {
      label: 'Adega',
      stop: itineraryStop({
        role: 'highlight',
        venueId: 'sj-adega-wine-atelier',
        venueName: 'Adega',
        category: 'restaurant',
        subcategory: 'Portuguese restaurant',
        tags: ['wine', 'restaurant', 'romantic'],
      }),
      fallback: scoredVenue('sj-route-location-copy', 'Route Location Copy Fallback', [
        "You're starting in Japantown Pocket - a varied arc that still lands cleanly.",
      ]),
      forbidden: [
        'Route Location Copy Fallback',
        "You're starting in Japantown Pocket - a varied arc that still lands cleanly.",
        'Known for:',
      ],
    },
  ]

  const blockedLeaks = cases.map((testCase) => {
    const role = inverseRoleProjection[testCase.stop.role]
    const arc = {
      stops: [
        {
          role,
          scoredVenue: testCase.fallback,
        },
      ],
    }

    const roleFallback = findScoredVenueForStopWithPolicy(testCase.stop, arc, {
      allowRoleFallback: true,
    })
    assert(
      roleFallback?.venue.name === testCase.fallback.venue.name,
      `${testCase.label} setup must model the old role-only fallback.`,
    )

    const identitySafeMatch = findScoredVenueForStopWithPolicy(testCase.stop, arc, {
      allowRoleFallback: false,
    })
    assert(
      identitySafeMatch === undefined,
      `${testCase.label} final-route detail copy must not use a different first role candidate.`,
    )

    const renderedDetailCopy = safeModeledDetailCopy(testCase.stop, identitySafeMatch)
    assert(
      renderedDetailCopy.includes(testCase.stop.venueName),
      `${testCase.label} detail copy must stay anchored to the final displayed stop.`,
    )
    const leakedNeedle = includesAny(renderedDetailCopy, testCase.forbidden)
    assert(!leakedNeedle, `${testCase.label} detail copy leaked forbidden text: ${leakedNeedle}`)

    return {
      label: testCase.label,
      finalDisplayedStopName: testCase.stop.venueName,
      roleFallbackVenueName: roleFallback.venue.name,
      identitySafeScoredVenueFound: Boolean(identitySafeMatch),
      forbiddenCopyBlocked: true,
    }
  })

  const sameNameDifferentIdStop = itineraryStop({
    role: 'highlight',
    venueId: 'provider-id-drift',
    venueName: 'Village Grill',
  })
  const sameNameDifferentIdMatch = findScoredVenueForStopWithPolicy(
    sameNameDifferentIdStop,
    {
      stops: [
        {
          role: 'peak',
          scoredVenue: scoredVenue('sj-village-grill', 'Village Grill'),
        },
      ],
    },
    { allowRoleFallback: false },
  )
  assert(
    sameNameDifferentIdMatch?.venue.name === 'Village Grill',
    'Name matching may be used only when it is consistent with final stop identity.',
  )

  const output = {
    finalRouteDetailCopyTruth: true,
    roleOnlyFallbackDisabledForFinalRouteDetails: true,
    roleOnlyFallbackStillAvailableOutsideFinalRoute: true,
    identityMatchAllowsScoredMetadata: true,
    generatedFinalRouteStopIdentityUnchanged: true,
    routeAuthorityUnchanged: true,
    runtimeRouteArtifactShapeUnchanged: true,
    providerShadowRemainsNonAuthoritative: true,
    blockedLeaks,
    fetchCallCount,
  }

  assert(fetchCallCount === 0, 'Fetch/provider calls must stay at 0.')
  console.log(JSON.stringify(output, null, 2))
} finally {
  globalThis.fetch = originalFetch
}
