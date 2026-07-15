import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'

const projectRoot = process.cwd()

const sourcePath = (relativePath: string) => join(projectRoot, relativePath)
const readSource = (relativePath: string) => readFileSync(sourcePath(relativePath), 'utf8')

const sandboxSource = readSource('src/pages/SandboxConciergePage.tsx')
const publicSource = readSource('src/pages/PublicConciergePage.tsx')
const appShellSource = readSource('src/app/AppShell.tsx')
const appImpactObserverSource = readSource('scripts/test-application-score-anchored-role-fit-impact.ts')
const arcAlternativesSource = readSource('src/domain/arc/getRoleAlternatives.ts')
const arcSwapSource = readSource('src/domain/arc/swapArcStop.ts')
const lceRepairSource = readSource('src/domain/lce/lceRepair.ts')
const waypointPrimitiveSource = readSource(
  'src/integrations/waypoint/coordination/coordinationPrimitive.ts',
)
const runtimeRouteProjectionSource = readSource('src/domain/artifacts/runtimeRouteProjection.ts')
const contractEntryArtifactSource = readSource('src/domain/artifacts/contractEntryArtifact.ts')
const routeShapeOwnershipSource = readSource(
  'src/integrations/waypoint/coordination/routeShapeOwnership.ts',
)

const fetchCalls: string[] = []
const originalFetch = globalThis.fetch

globalThis.fetch = ((input: RequestInfo | URL, _init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  fetchCalls.push(url)
  throw new Error(`Unexpected provider/network call in steering payload inventory: ${url}`)
}) as typeof fetch

type InventoryPath =
  | 'signature_highlight_shortlist'
  | 'curation_role_pools'
  | 'canonical_repair'
  | 'role_pool_repair'
  | 'swap_ordering'
  | 'swap_identity_hydration'

type Closeability = 'closeable' | 'partially_closeable' | 'likely_parked' | 'inconclusive'

interface SteeringShadowPathInventory {
  path: InventoryPath
  currentImplementation: string
  currentAuthor:
    | 'application'
    | 'application_arc_mixed'
    | 'arc_lce_mixed'
    | 'waypoint_over_owner_evidence'
  usesScoreAnchoredRoleFit: boolean
  behaviorDriving: boolean
  ownerAuthoredReplacementPossible: boolean
  minimalPayloadNeeded: string
  phase5Closeability: Closeability
}

interface ProposalFieldRecommendation {
  field: string
  required: boolean
  ownerSource: 'field' | 'taste' | 'bearings' | 'waypoint' | 'compat'
  why: string
}

function assertContains(source: string, marker: string, label: string): void {
  assert.ok(source.includes(marker), `${label} missing marker: ${marker}`)
}

function assertDoesNotContain(source: string, marker: string, label: string): void {
  assert.ok(!source.includes(marker), `${label} should not contain marker: ${marker}`)
}

function assertInventory(
  path: SteeringShadowPathInventory,
  expected: Partial<SteeringShadowPathInventory>,
): void {
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(
      path[key as keyof SteeringShadowPathInventory],
      value,
      `${path.path} inventory mismatch for ${key}`,
    )
  }
}

try {
  assertContains(
    sandboxSource,
    "import { scoreAnchoredRoleFit } from '../domain/arc/scoreAnchoredRoleFit'",
    'Sandbox steering shadow import',
  )
  assertContains(publicSource, '<SandboxConciergePage surface="public"', 'Public page wrapper')

  assertContains(sandboxSource, 'function enforceFullStopRealityContract', 'Canonical repair path')
  assertContains(sandboxSource, 'scoreAnchoredRoleFit(left, roleScoreKey)', 'Canonical repair ordering')
  assertContains(
    sandboxSource,
    "scoreAnchoredRoleFit(candidate, 'peak') * 0.04",
    'Signature highlight shortlist ranking',
  )
  assertContains(
    sandboxSource,
    "scoreAnchoredRoleFit(candidate, 'peak') * 0.36",
    'Strong curation highlight pool ranking',
  )
  assertContains(
    sandboxSource,
    "scoreAnchoredRoleFit(candidate, 'warmup') * 0.52",
    'Strong curation start pool ranking',
  )
  assertContains(
    sandboxSource,
    "scoreAnchoredRoleFit(candidate, 'cooldown') * 0.54",
    'Strong curation wind-down pool ranking',
  )
  assertContains(sandboxSource, 'function getRoleAlternatives(', 'Sandbox local alternatives path')
  assertContains(
    sandboxSource,
    'coordinateSteeringPrelockSwapProposals',
    'Sandbox swap proposal coordination',
  )
  assertContains(
    sandboxSource,
    'projectSteeringSwapCandidateForCoordination',
    'Sandbox swap identity projection',
  )
  assertDoesNotContain(
    sandboxSource,
    'scoreAnchoredRoleFit(left, role) * 0.9 + leftProximity * 0.1',
    'Sandbox swap ordering',
  )
  assertDoesNotContain(
    sandboxSource,
    'scoreAnchoredRoleFit(left, internalRole)',
    'Sandbox swap identity hydration ordering',
  )

  assertContains(appShellSource, "import { getRoleAlternatives } from '../domain/arc/getRoleAlternatives'", 'AppShell alternatives import')
  assertContains(appShellSource, "import { swapArcStop } from '../domain/arc/swapArcStop'", 'AppShell swap import')
  assertContains(appShellSource, 'const alternatives = getRoleAlternatives({', 'AppShell pre-lock alternatives')
  assertContains(appShellSource, 'const swapped = swapArcStop({', 'AppShell pre-lock swap application')
  assertContains(appShellSource, 'const proposal = proposeLceRepair({', 'AppShell LCE repair proposal')

  assertContains(arcAlternativesSource, 'const nearbyPool = getNearbyAlternatives({', 'Arc role alternatives nearby pool')
  assertContains(arcAlternativesSource, 'const swappedArc = swapArcStop({', 'Arc role alternatives swap validation')
  assertContains(arcAlternativesSource, 'candidate.scoredVenue.roleScores[role] * 0.28', 'Arc role alternatives role score ranking')
  assertContains(arcAlternativesSource, 'roleSpecificBoost(role, candidate.scoredVenue, lens)', 'Arc role alternatives role-specific boost')
  assertContains(arcSwapSource, 'isValidArcCombination(updatedStops, intent, crewPolicy, lens)', 'Arc swap validation')
  assertContains(arcSwapSource, 'scoreArcAssembly(updatedStops, intent, crewPolicy, lens)', 'Arc swap scoring')

  assertContains(lceRepairSource, 'rolePoolAlternatives ?? getRoleAlternatives({', 'LCE repair fallback alternatives')
  assertContains(lceRepairSource, 'const proposedArc = swapArcStop({', 'LCE repair swap validation')
  assertContains(lceRepairSource, 'roleScore * 0.46', 'LCE repair role score ranking')
  assertContains(lceRepairSource, 'const continuity = computeLocalContinuityScore', 'LCE repair continuity ranking')

  assertContains(runtimeRouteProjectionSource, 'hydrateRuntimeRouteStopDisplayFields', 'Runtime route display hydration')
  assertContains(runtimeRouteProjectionSource, 'canonicalStopByRole', 'Runtime route canonical stop identity')
  assertContains(contractEntryArtifactSource, 'fieldProvenanceSummary', 'Contract entry field provenance')

  assertContains(waypointPrimitiveSource, "  | 'taste'", 'Waypoint primitive owner source: Taste')
  assertContains(waypointPrimitiveSource, "  | 'bearings'", 'Waypoint primitive owner source: Bearings')
  assertContains(waypointPrimitiveSource, "  | 'field'", 'Waypoint primitive owner source: Field')
  assertDoesNotContain(waypointPrimitiveSource, "  | 'waypoint'", 'Waypoint primitive input source')

  assertContains(routeShapeOwnershipSource, "'roleProfile'", 'Parked route-shape roleProfile residue')
  assertContains(routeShapeOwnershipSource, "'roleInvariants'", 'Parked route-shape roleInvariants residue')
  assertContains(
    routeShapeOwnershipSource,
    "'roleInvariants.semanticTraits'",
    'Parked route-shape semantic traits residue',
  )

  assertContains(
    appImpactObserverSource,
    "path: 'signature_highlight_shortlist'",
    'Application impact observer signature highlight path',
  )
  assertContains(
    appImpactObserverSource,
    "path: 'swap_ordering'",
    'Application impact observer swap ordering path',
  )
  assertContains(
    appImpactObserverSource,
    "replacementExists: 'held for Gate 2 / LCE steering'",
    'Application impact observer held steering paths',
  )

  const pathInventory: SteeringShadowPathInventory[] = [
    {
      path: 'signature_highlight_shortlist',
      currentImplementation:
        'Sandbox/Public shortlist scoring blends highlight qualification, Taste signals, signature score, and scoreAnchoredRoleFit.',
      currentAuthor: 'application',
      usesScoreAnchoredRoleFit: true,
      behaviorDriving: true,
      ownerAuthoredReplacementPossible: true,
      minimalPayloadNeeded:
        'owner-authored highlight shortlist over Taste highlight evidence plus Field identity and Bearings admissibility',
      phase5Closeability: 'partially_closeable',
    },
    {
      path: 'curation_role_pools',
      currentImplementation:
        'Sandbox/Public strong curation pools weight qualification and scoreAnchoredRoleFit for start/highlight/windDown.',
      currentAuthor: 'application',
      usesScoreAnchoredRoleFit: true,
      behaviorDriving: true,
      ownerAuthoredReplacementPossible: true,
      minimalPayloadNeeded:
        'canonical public role-pool projection with Taste role evidence, Bearings admission, and Waypoint rank',
      phase5Closeability: 'partially_closeable',
    },
    {
      path: 'canonical_repair',
      currentImplementation:
        'Sandbox full-stop reality repair orders replacement candidates with scoreAnchoredRoleFit before swapArcStop.',
      currentAuthor: 'application_arc_mixed',
      usesScoreAnchoredRoleFit: true,
      behaviorDriving: true,
      ownerAuthoredReplacementPossible: true,
      minimalPayloadNeeded:
        'pre-lock repair proposal with action, current stop, replacement identity, owner signals, rank, and refusal reason',
      phase5Closeability: 'partially_closeable',
    },
    {
      path: 'role_pool_repair',
      currentImplementation:
        'Sandbox role-pool fallback repair ordering blends role qualification and scoreAnchoredRoleFit.',
      currentAuthor: 'application',
      usesScoreAnchoredRoleFit: true,
      behaviorDriving: true,
      ownerAuthoredReplacementPossible: true,
      minimalPayloadNeeded:
        'role-pool repair proposal over canonical role pools and owner-authored candidate evidence',
      phase5Closeability: 'partially_closeable',
    },
    {
      path: 'swap_ordering',
      currentImplementation:
        'Sandbox pre-lock swap alternatives are ordered through Waypoint steering proposals over owner evidence; AppShell still has Arc alternatives active.',
      currentAuthor: 'waypoint_over_owner_evidence',
      usesScoreAnchoredRoleFit: false,
      behaviorDriving: true,
      ownerAuthoredReplacementPossible: true,
      minimalPayloadNeeded:
        'Waypoint pre-lock steering proposal ranking over Taste role-fit, Bearings movement/feasibility, Field identity, and route-shape validity',
      phase5Closeability: 'closeable',
    },
    {
      path: 'swap_identity_hydration',
      currentImplementation:
        'Sandbox resolves swap identity/display candidates using steering identity projection in Waypoint proposal order.',
      currentAuthor: 'waypoint_over_owner_evidence',
      usesScoreAnchoredRoleFit: false,
      behaviorDriving: true,
      ownerAuthoredReplacementPossible: true,
      minimalPayloadNeeded:
        'steering identity projection carrying display identity, provider/source provenance, coordinates, and candidate lineage',
      phase5Closeability: 'closeable',
    },
  ]

  const swapOrdering = pathInventory.find((entry) => entry.path === 'swap_ordering')
  assert.ok(swapOrdering, 'swap ordering inventory missing')
  assertInventory(swapOrdering, {
    currentAuthor: 'waypoint_over_owner_evidence',
    usesScoreAnchoredRoleFit: false,
    behaviorDriving: true,
    ownerAuthoredReplacementPossible: true,
    phase5Closeability: 'closeable',
  })

  const swapIdentityHydration = pathInventory.find((entry) => entry.path === 'swap_identity_hydration')
  assert.ok(swapIdentityHydration, 'swap identity hydration inventory missing')
  assertInventory(swapIdentityHydration, {
    currentAuthor: 'waypoint_over_owner_evidence',
    usesScoreAnchoredRoleFit: false,
    ownerAuthoredReplacementPossible: true,
    phase5Closeability: 'closeable',
  })

  const proposalShapeRecommendation: ProposalFieldRecommendation[] = [
    {
      field: 'action',
      required: true,
      ownerSource: 'waypoint',
      why: 'Waypoint coordinates the requested steering action without authoring owner truth.',
    },
    {
      field: 'targetRole',
      required: true,
      ownerSource: 'compat',
      why: 'The current route slot is needed to propose swap/repair alternatives.',
    },
    {
      field: 'currentStopIdentity',
      required: true,
      ownerSource: 'field',
      why: 'Display identity and source provenance must not be hydrated locally by Application.',
    },
    {
      field: 'candidateIdentity',
      required: true,
      ownerSource: 'field',
      why: 'Replacement identity needs canonical venue/provider/source lineage.',
    },
    {
      field: 'roleFitEvidence',
      required: true,
      ownerSource: 'taste',
      why: 'Waypoint can rank role suitability only from Taste-authored evidence.',
    },
    {
      field: 'feasibility',
      required: true,
      ownerSource: 'bearings',
      why: 'Movement, hours, admission, and route feasibility must come from Bearings.',
    },
    {
      field: 'movementDelta',
      required: true,
      ownerSource: 'bearings',
      why: 'Shorter-move and pacing adjustments need explicit movement impact.',
    },
    {
      field: 'rank',
      required: true,
      ownerSource: 'waypoint',
      why: 'Waypoint owns proposal ordering over already-authored signals.',
    },
    {
      field: 'refusalReason',
      required: true,
      ownerSource: 'waypoint',
      why: 'No eligible proposal must be explicit instead of masked by fallback.',
    },
    {
      field: 'provenance',
      required: true,
      ownerSource: 'compat',
      why: 'The proposal must expose the owner evidence it consumed.',
    },
  ]

  assert.ok(
    proposalShapeRecommendation.every((entry) => entry.required),
    'C/B-1 recommendation must include only required fields.',
  )

  const waypointBoundary = [
    {
      behavior: 'proposal ranking',
      waypointRole: 'rank over owner-authored candidate evidence',
      ownerEvidenceSource: 'taste/bearings/field',
      boundaryRisk: 'low if all comparable values carry owner provenance',
    },
    {
      behavior: 'role-fit evidence',
      waypointRole: 'consume only',
      ownerEvidenceSource: 'taste',
      boundaryRisk: 'high if Waypoint computes scoreAnchoredRoleFit or role meaning',
    },
    {
      behavior: 'movement and hours feasibility',
      waypointRole: 'consume only',
      ownerEvidenceSource: 'bearings',
      boundaryRisk: 'high if Waypoint applies feasibility rules directly',
    },
    {
      behavior: 'identity and display hydration',
      waypointRole: 'carry payload',
      ownerEvidenceSource: 'field',
      boundaryRisk: 'medium if Application continues local hydration',
    },
  ]

  const closeability = Object.fromEntries(
    pathInventory.map((entry) => [entry.path, entry.phase5Closeability]),
  )

  assert.deepEqual(closeability, {
    signature_highlight_shortlist: 'partially_closeable',
    curation_role_pools: 'partially_closeable',
    canonical_repair: 'partially_closeable',
    role_pool_repair: 'partially_closeable',
    swap_ordering: 'closeable',
    swap_identity_hydration: 'closeable',
  })

  assert.equal(fetchCalls.length, 0, 'inventory observer made provider/network calls')

  console.log(
    JSON.stringify(
      {
        observer: 'steering_prelock_payload_inventory',
        phase5Posture: {
          chapterBStandalone: false,
          nextChapter: 'Chapter C - Steering-before-lock',
          objectiveUiParked: true,
          broadExperienceCompositionParked: true,
        },
        currentSteeringInventory: pathInventory,
        swapOrderingDiagnosis: {
          currentOrderer:
            'Sandbox pre-lock swap path uses Waypoint steering proposals; AppShell/Arc alternatives and held repair paths remain active.',
          ownership: 'waypoint_over_owner_evidence',
          usesScoreAnchoredRoleFit: false,
          consumedSignals: [
            'Taste role-fit evidence',
            'Bearings feasibility',
            'Bearings movementDelta',
            'Field identity/provenance',
            'Waypoint proposal rank',
            'swapArcStop validation/scoring',
          ],
          waypointReplacementConsumedWithoutMeaningAuthorship: true,
          minimalWaypointReadModel:
            'Taste role-fit evidence + Bearings feasibility/movement + Field identity/provenance + compat route slot/action context',
        },
        identityHydrationDiagnosis: {
          applicationHydratesSwapLocally: false,
          fieldCanonicalIdentityProjectionConsumed: true,
          cB2Minimum:
            'displayName, providerRecordId, venueId/baseVenueId, coordinates, address, neighborhood, sourceOrigin, candidateId',
          providerIdsRemainProvenanceOnly: true,
        },
        rolePoolAndShortlistDiagnosis: {
          publicRolePoolPayloadExists: false,
          domainRolePoolsExist: true,
          signatureHighlightOwnerEquivalentExists: false,
          highlightShortlistRequiredForSteering: false,
          curationRolePoolProjectionRequiredForSteering: true,
        },
        proposalShapeRecommendation,
        waypointBoundary,
        providerNetworkCalls: fetchCalls.length,
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
