import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'

import type { RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact'
import type { ScoredVenue } from '../src/domain/types/arc'
import type { SteeringPrelockProposal } from '../src/integrations/waypoint/coordination/steeringPrelockProposal'
import {
  projectSteeringIdentityFromRuntimeStop,
  projectSteeringIdentityFromScoredVenue,
  projectSteeringStopIdentity,
} from '../src/integrations/waypoint/coordination/steeringIdentityProjection'

const projectRoot = process.cwd()
const projectionPath = join(
  projectRoot,
  'src/integrations/waypoint/coordination/steeringIdentityProjection.ts',
)
const proposalPath = join(
  projectRoot,
  'src/integrations/waypoint/coordination/steeringPrelockProposal.ts',
)
const projectionSource = readFileSync(projectionPath, 'utf8')
const proposalSource = readFileSync(proposalPath, 'utf8')

const fetchCalls: string[] = []
const originalFetch = globalThis.fetch

globalThis.fetch = ((input: RequestInfo | URL, _init?: RequestInit) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  fetchCalls.push(url)
  throw new Error(`Unexpected provider/network call in steering identity projection: ${url}`)
}) as typeof fetch

function assertSourceExcludes(marker: string, label: string): void {
  assert.ok(!projectionSource.includes(marker), `${label} must not include marker: ${marker}`)
}

function assertSourceContains(marker: string, label: string): void {
  assert.ok(projectionSource.includes(marker), `${label} missing marker: ${marker}`)
}

const currentRuntimeStop: RuntimeRouteStop = {
  id: 'runtime-highlight',
  sourceStopId: 'itinerary-highlight',
  displayName: 'Adega Wine Atelier',
  providerRecordId: 'live_google_adega',
  latitude: 37.332,
  longitude: -121.891,
  address: '1614 Alum Rock Ave, San Jose, CA',
  role: 'highlight',
  stopIndex: 1,
  venueId: 'sj-adega-wine-atelier',
  title: 'Stay for a textured wine-bar peak',
  subtitle: 'Little Portugal',
  neighborhood: 'Little Portugal',
  driveMinutes: 8,
  imageUrl: 'https://example.test/adega.jpg',
}

const candidateVenue = {
  id: 'live_google_adega',
  name: 'Adega Wine Atelier',
  neighborhood: 'Little Portugal',
  source: {
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: 'live_google_adega',
    latitude: 37.332,
    longitude: -121.891,
    formattedAddress: '1614 Alum Rock Ave, San Jose, CA',
  },
}

const candidateScoredVenue = {
  venue: candidateVenue,
  candidateIdentity: {
    candidateId: 'candidate:sj-adega-wine-atelier',
    baseVenueId: 'sj-adega-wine-atelier',
    kind: 'base',
    traceLabel: 'Adega Wine Atelier',
  },
} as ScoredVenue

try {
  assertSourceExcludes('scoreAnchoredRoleFit', 'Steering identity projection')
  assertSourceExcludes('SandboxConciergePage', 'Steering identity projection')
  assertSourceExcludes('PublicConciergePage', 'Steering identity projection')
  assertSourceExcludes('AppShell', 'Steering identity projection')
  assertSourceExcludes('scoreArcAssembly', 'Steering identity projection')
  assertSourceExcludes('isValidArcCombination', 'Steering identity projection')

  assertSourceContains('baseVenueId', 'Route-logic identity')
  assertSourceContains('providerRecordId_not_route_logic_identity', 'Provider identity refusal')
  assertSourceContains("source: 'field'", 'Field-authored identity')
  assert.ok(
    proposalSource.includes('currentStopIdentity: SteeringStopIdentity') &&
      proposalSource.includes('candidateIdentity: SteeringStopIdentity'),
    'Waypoint proposal shape must consume SteeringStopIdentity projections.',
  )

  const currentStop = projectSteeringIdentityFromRuntimeStop(currentRuntimeStop, {
    baseVenueId: 'sj-adega-wine-atelier',
    sourceOrigin: 'live',
    sourceProvenance: 'field:runtime_route_artifact',
    candidateId: 'current:highlight',
  })
  assert.equal(currentStop.status, 'projected')
  assert.equal(currentStop.identity.source, 'field')
  assert.equal(currentStop.identity.baseVenueId, 'sj-adega-wine-atelier')
  assert.equal(currentStop.identity.venueId, 'sj-adega-wine-atelier')
  assert.equal(currentStop.identity.providerRecordId, 'live_google_adega')
  assert.notEqual(currentStop.identity.baseVenueId, currentStop.identity.providerRecordId)

  const candidateStop = projectSteeringIdentityFromScoredVenue(candidateScoredVenue)
  assert.equal(candidateStop.status, 'projected')
  assert.equal(candidateStop.identity.source, 'field')
  assert.equal(candidateStop.identity.baseVenueId, 'sj-adega-wine-atelier')
  assert.equal(candidateStop.identity.venueId, 'sj-adega-wine-atelier')
  assert.equal(candidateStop.identity.providerRecordId, 'live_google_adega')
  assert.equal(candidateStop.identity.candidateId, 'candidate:sj-adega-wine-atelier')
  assert.notEqual(candidateStop.identity.baseVenueId, candidateStop.identity.providerRecordId)

  const providerBacked = projectSteeringStopIdentity({
    baseVenueId: 'sj-adega-wine-atelier',
    venueId: 'sj-adega-wine-atelier',
    displayName: 'Adega Wine Atelier',
    providerRecordId: 'live_google_adega',
    sourceOrigin: 'live',
    sourceProvenance: 'field:google-places',
    coordinates: { lat: 37.332, lng: -121.891 },
    address: '1614 Alum Rock Ave, San Jose, CA',
    neighborhood: 'Little Portugal',
    candidateId: 'candidate:provider-backed-adega',
  })
  assert.equal(providerBacked.status, 'projected')
  assert.equal(providerBacked.identity.baseVenueId, 'sj-adega-wine-atelier')
  assert.equal(providerBacked.identity.providerRecordId, 'live_google_adega')

  const staticCurated = projectSteeringStopIdentity({
    baseVenueId: 'sj-paper-plane',
    venueId: 'sj-paper-plane',
    displayName: 'Paper Plane',
    sourceOrigin: 'curated',
    sourceProvenance: 'field:curated',
    coordinates: { lat: 37.336, lng: -121.889 },
    address: '72 S 1st St, San Jose, CA',
    neighborhood: 'Downtown',
    candidateId: 'candidate:sj-paper-plane',
  })
  assert.equal(staticCurated.status, 'projected')
  assert.equal(staticCurated.identity.providerRecordId, undefined)
  assert.equal(staticCurated.identity.baseVenueId, 'sj-paper-plane')

  const missingProviderId = projectSteeringStopIdentity({
    baseVenueId: 'sj-goodtime-bar',
    venueId: 'sj-goodtime-bar',
    displayName: 'Goodtime Bar',
    sourceOrigin: 'curated',
    sourceProvenance: 'field:curated',
    coordinates: { lat: 37.335, lng: -121.888 },
    address: 'Goodtime Bar, San Jose, CA',
    neighborhood: 'Downtown',
    candidateId: 'candidate:sj-goodtime-bar',
  })
  assert.equal(missingProviderId.status, 'projected')
  assert.equal(missingProviderId.identity.providerRecordId, undefined)
  assert.equal(missingProviderId.identity.baseVenueId, 'sj-goodtime-bar')

  const missingBaseVenueId = projectSteeringStopIdentity({
    displayName: 'Adega Wine Atelier',
    providerRecordId: 'live_google_adega',
    sourceOrigin: 'live',
    sourceProvenance: 'field:google-places',
    coordinates: { lat: 37.332, lng: -121.891 },
    address: '1614 Alum Rock Ave, San Jose, CA',
    neighborhood: 'Little Portugal',
    candidateId: 'candidate:provider-only-adega',
  })
  assert.equal(missingBaseVenueId.status, 'refused')
  assert.equal(missingBaseVenueId.identity.baseVenueId, undefined)
  assert.equal(missingBaseVenueId.identity.providerRecordId, 'live_google_adega')
  assert.equal(
    missingBaseVenueId.refusalReason.refusalClass,
    'identity_provenance_missing',
  )
  assert.ok(
    missingBaseVenueId.identity.missingIdentityReasons?.includes('missing_baseVenueId'),
    'Missing baseVenueId must be explicit.',
  )
  assert.ok(
    missingBaseVenueId.identity.missingIdentityReasons?.includes(
      'providerRecordId_not_route_logic_identity',
    ),
    'Provider ID must not be promoted to route-logic identity.',
  )

  const providerAsBaseVenueId = projectSteeringStopIdentity({
    baseVenueId: 'live_google_adega',
    venueId: 'live_google_adega',
    displayName: 'Adega Wine Atelier',
    providerRecordId: 'live_google_adega',
    sourceOrigin: 'live',
    sourceProvenance: 'field:google-places',
    candidateId: 'candidate:provider-id-as-base',
  })
  assert.equal(providerAsBaseVenueId.status, 'refused')
  assert.equal(providerAsBaseVenueId.identity.baseVenueId, undefined)
  assert.ok(
    providerAsBaseVenueId.identity.missingIdentityReasons?.includes(
      'baseVenueId_looks_like_provider_id',
    ),
    'Provider-looking baseVenueId must be rejected.',
  )

  const acceptedProposal: SteeringPrelockProposal = {
    status: 'proposed',
    action: 'swap_stop',
    targetRole: 'highlight',
    currentStopIdentity: currentStop.identity,
    candidateIdentity: candidateStop.identity,
    roleFitEvidence: [
      {
        source: 'taste',
        key: 'role_suitability',
        authority: 'owner_evidence',
        value: 0.91,
        role: 'highlight',
        verdict: 'strong_fit',
      },
    ],
    feasibility: [
      {
        source: 'bearings',
        key: 'admission',
        authority: 'owner_evidence',
        value: true,
        status: 'feasible',
      },
    ],
    rank: {
      source: 'waypoint',
      rank: 1,
      tieBreakKey: 'highlight:sj-adega-wine-atelier',
      rankingBasis: 'owner_evidence',
    },
    provenance: {
      waypoint: {
        source: 'waypoint',
        key: 'steering_prelock_proposal',
        action: 'swap_stop',
      },
      ownerTrace: [
        { source: 'field', key: 'current_stop_identity' },
        { source: 'field', key: 'candidate_identity' },
        { source: 'taste', key: 'role_suitability' },
        { source: 'bearings', key: 'admission' },
      ],
    },
  }

  assert.equal(acceptedProposal.currentStopIdentity.baseVenueId, 'sj-adega-wine-atelier')
  assert.equal(acceptedProposal.candidateIdentity.baseVenueId, 'sj-adega-wine-atelier')
  assert.equal(acceptedProposal.currentStopIdentity.providerRecordId, 'live_google_adega')
  assert.equal(acceptedProposal.candidateIdentity.providerRecordId, 'live_google_adega')

  const hydrationParity = {
    displayName: candidateStop.identity.displayName === candidateVenue.name,
    coordinates:
      candidateStop.identity.latitude === candidateVenue.source.latitude &&
      candidateStop.identity.longitude === candidateVenue.source.longitude,
    address: candidateStop.identity.formattedAddress === candidateVenue.source.formattedAddress,
    neighborhood: candidateStop.identity.neighborhood === candidateVenue.neighborhood,
    sourceOrigin: candidateStop.identity.sourceOrigin === candidateVenue.source.sourceOrigin,
    candidateId:
      candidateStop.identity.candidateId ===
      candidateScoredVenue.candidateIdentity.candidateId,
    providerRecordId:
      candidateStop.identity.providerRecordId === candidateVenue.source.providerRecordId,
  }

  assert.deepEqual(hydrationParity, {
    displayName: true,
    coordinates: true,
    address: true,
    neighborhood: true,
    sourceOrigin: true,
    candidateId: true,
    providerRecordId: true,
  })

  assert.equal(fetchCalls.length, 0, 'observer made provider/network calls')

  console.log(
    JSON.stringify(
      {
        observer: 'steering_identity_payload_projection',
        identityCases: {
          currentStop: {
            baseVenueId: currentStop.identity.baseVenueId,
            venueId: currentStop.identity.venueId,
            providerRecordId: currentStop.identity.providerRecordId,
            routeLogicIdentityCorrect:
              currentStop.identity.baseVenueId === 'sj-adega-wine-atelier' &&
              currentStop.identity.baseVenueId !== currentStop.identity.providerRecordId,
          },
          candidateStop: {
            baseVenueId: candidateStop.identity.baseVenueId,
            venueId: candidateStop.identity.venueId,
            providerRecordId: candidateStop.identity.providerRecordId,
            routeLogicIdentityCorrect:
              candidateStop.identity.baseVenueId === 'sj-adega-wine-atelier' &&
              candidateStop.identity.baseVenueId !== candidateStop.identity.providerRecordId,
          },
          missingBaseVenueId: {
            status: missingBaseVenueId.status,
            providerRecordId: missingBaseVenueId.identity.providerRecordId,
            baseVenueId: missingBaseVenueId.identity.baseVenueId ?? null,
            refusalClass: missingBaseVenueId.refusalReason.refusalClass,
          },
          providerAsBaseVenueId: {
            status: providerAsBaseVenueId.status,
            providerRecordId: providerAsBaseVenueId.identity.providerRecordId,
            baseVenueId: providerAsBaseVenueId.identity.baseVenueId ?? null,
            refusalClass: providerAsBaseVenueId.refusalReason.refusalClass,
          },
          adegaMismatchGuard: {
            providerRecordId: 'live_google_adega',
            routeLogicIdentity: candidateStop.identity.baseVenueId,
            providerPromotedToIdentity: false,
          },
        },
        hydrationParity,
        boundary: {
          fieldOwnsIdentity: true,
          waypointCarriesIdentityOnly: true,
          noAppPageImports: true,
          noScoreAnchoredRoleFit: true,
          noBehaviorWiring: true,
        },
        providerNetworkCalls: fetchCalls.length,
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
