import type { BuildDistrictOpportunityProfilesResult } from '../../engines/district'

interface DistrictPreviewPanelProps {
  data?: BuildDistrictOpportunityProfilesResult
  loading?: boolean
  error?: string
  locationQuery: string
}

function formatMetric(value: number | undefined, digits = 2): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return value.toFixed(digits)
}

function formatRounded(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return `${Math.round(value)}`
}

function readSignal(
  source: Record<string, number> | undefined,
  keys: string[],
): number | undefined {
  if (!source) {
    return undefined
  }
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number') {
      return value
    }
  }
  return undefined
}

function getTierClass(tier: string): string {
  if (tier === 'strong') {
    return 'district-preview-tier-strong'
  }
  if (tier === 'usable') {
    return 'district-preview-tier-usable'
  }
  if (tier === 'weak') {
    return 'district-preview-tier-weak'
  }
  return 'district-preview-tier-neutral'
}

export function DistrictPreviewPanel({
  data,
  loading,
  error,
  locationQuery,
}: DistrictPreviewPanelProps) {
  const ranked = data?.ranked ?? []
  const rawPocketById = new Map((data?.rawPockets ?? []).map((pocket) => [pocket.id, pocket]))
  const identifiedById = new Map(
    (data?.identifiedPockets ?? []).map((pocket) => [pocket.id, pocket]),
  )
  const debugTraceById = new Map(
    (data?.debug?.pocketTraces ?? []).map((trace) => [trace.pocketId, trace]),
  )
  const pocketDiagnostics = data?.debug?.pocketDiagnostics
  const rejectedPocketDiagnostics = pocketDiagnostics?.rejectedPockets ?? []

  return (
    <aside className="district-preview-panel">
      <div className="district-preview-header">
        <p className="district-preview-kicker">District Preview</p>
        <h3>{data?.location.displayLabel ?? locationQuery}</h3>
        <p className="district-preview-meta">
          entities {data?.entities.length ?? 0} | raw {data?.rawPockets.length ?? 0} | viable{' '}
          {data?.viablePockets.length ?? 0} | rejected {data?.rejectedPockets.length ?? 0} |
          selected {data?.selected.length ?? 0}
        </p>
        <p className="district-preview-meta">
          source {data?.location.source ?? 'n/a'} | city {data?.location.meta.city ?? 'n/a'} |
          query "{locationQuery || 'n/a'}"
        </p>
        <p className="district-preview-meta">
          retrieval {data?.retrieval.mode ?? 'n/a'} | curated {data?.retrieval.curatedCount ?? 0}{' '}
          | live fetched {data?.retrieval.liveFetchedCount ?? 0} | live accepted{' '}
          {data?.retrieval.liveAcceptedCount ?? 0} | bootstrap {data?.retrieval.bootstrapCount ?? 0}
        </p>
        <p className="district-preview-meta">
          live raw {data?.retrieval.liveRawFetchedCount ?? 0} | mapped{' '}
          {data?.retrieval.liveMappedCount ?? 0} (dropped {data?.retrieval.liveMappedDroppedCount ?? 0}) |
          normalized {data?.retrieval.liveNormalizedCount ?? 0} (dropped{' '}
          {data?.retrieval.liveNormalizationDroppedCount ?? 0}) | suppressed{' '}
          {data?.retrieval.liveSuppressedCount ?? 0}
        </p>
        <p className="district-preview-meta">
          geo buckets {data?.retrieval.geoBucketCount ?? 0} | dominant share{' '}
          {(data?.retrieval.dominantAreaShare ?? 0).toFixed(3)} | spread{' '}
          {(data?.retrieval.geoSpreadScore ?? 0).toFixed(3)} | downsampled{' '}
          {data?.retrieval.geoDiversityDownsampledCount ?? 0}
        </p>
        {data?.retrieval.notes && data.retrieval.notes.length > 0 && (
          <p className="district-preview-meta">
            {data.retrieval.notes[0]}
          </p>
        )}
        <p className="district-preview-meta">
          fallback {String(data?.debug?.pathFlags.usedFallbackClustering ?? false)} | synthetic{' '}
          {String(data?.debug?.pathFlags.usedSyntheticFallback ?? false)} | promoted{' '}
          {String(data?.debug?.pathFlags.usedPromotedReject ?? false)}
        </p>
        {pocketDiagnostics && (
          <>
            <p className="district-preview-meta">
              debug raw {pocketDiagnostics.rawPocketCount} | debug viable{' '}
              {pocketDiagnostics.viablePocketCount} | debug rejected{' '}
              {pocketDiagnostics.rejectedPocketCount}
            </p>
            <p className="district-preview-meta">
              raw sizes:{' '}
              {pocketDiagnostics.rawPocketSizes.length > 0
                ? pocketDiagnostics.rawPocketSizes
                    .map((entry) => `${entry.pocketId}:${entry.entityCount}`)
                    .join(', ')
                : 'none'}
            </p>
          </>
        )}
      </div>

      {loading && <p className="district-preview-status">Loading district engine output…</p>}
      {error && <p className="district-preview-status error">{error}</p>}

      {!loading && ranked.length === 0 && (
        <p className="district-preview-status">No pockets returned (check debug trace)</p>
      )}

      <div className="district-preview-pocket-list">
        {ranked.map((entry) => {
          const profile = entry.profile
          const tasteSignals = profile.tasteSignals
          const rawPocket = rawPocketById.get(profile.pocketId)
          const identifiedPocket = identifiedById.get(profile.pocketId)
          const debugTrace = debugTraceById.get(profile.pocketId)
          const legacyTasteSignals = profile.appSignals?.tasteSignals
          const stageNotes = [
            ...new Set([
              ...(profile.meta.originNotes ?? []),
              ...(debugTrace?.stageNotes ?? []),
            ]),
          ]

          const activityScore = readSignal(legacyTasteSignals, ['activityScore', 'socialDensity'])
          const momentumScore = readSignal(legacyTasteSignals, ['momentumScore'])
          const calmScore = readSignal(legacyTasteSignals, ['calmScore'])

          return (
            <section key={profile.pocketId} className="district-preview-pocket">
              <div className="district-preview-pocket-head">
                <div>
                  <h4>{profile.label}</h4>
                  <p className="district-preview-inline">
                    type {profile.meta.identityKind} | origin {profile.meta.origin}
                  </p>
                </div>
                <span className={`district-preview-tier ${getTierClass(profile.classification)}`}>
                  {profile.classification}
                </span>
              </div>

              <p className="district-preview-inline">
                rank {entry.rank} | score {formatMetric(entry.score, 3)} | confidence{' '}
                {formatMetric(identifiedPocket?.identity.confidence, 3)}
              </p>

              <p className="district-preview-section-title">Geometry</p>
              <p className="district-preview-inline">
                entities {profile.entityCount} | maxDist{' '}
                {formatRounded(rawPocket?.geometry.maxDistanceFromCentroidM)}m | elongation{' '}
                {formatMetric(rawPocket?.geometry.elongationRatio, 2)} | density{' '}
                {formatRounded(rawPocket?.geometry.densityEntitiesPerKm2)}
              </p>

              <p className="district-preview-section-title">Field Snapshot</p>
              <p className="district-preview-inline">
                activity {formatMetric(activityScore, 3)} | momentum {formatMetric(momentumScore, 3)}{' '}
                | calm {formatMetric(calmScore, 3)}
              </p>

              <p className="district-preview-section-title">Taste Bridge</p>
              <p className="district-preview-inline">
                tags{' '}
                {tasteSignals.experientialTags.length > 0
                  ? tasteSignals.experientialTags.join(', ')
                  : 'none'}
              </p>
              <p className="district-preview-inline">
                mix drinks {formatMetric(tasteSignals.hospitalityMix.drinks, 2)} | dining{' '}
                {formatMetric(tasteSignals.hospitalityMix.dining, 2)} | culture{' '}
                {formatMetric(tasteSignals.hospitalityMix.culture, 2)} | cafe{' '}
                {formatMetric(tasteSignals.hospitalityMix.cafe, 2)} | activity{' '}
                {formatMetric(tasteSignals.hospitalityMix.activity, 2)}
              </p>
              <p className="district-preview-inline">
                ambiance energy {tasteSignals.ambianceProfile.energy} | intimacy{' '}
                {tasteSignals.ambianceProfile.intimacy} | noise{' '}
                {tasteSignals.ambianceProfile.noise}
              </p>
              <p className="district-preview-inline">
                moment potential {formatMetric(tasteSignals.momentPotential, 3)}
              </p>
              {tasteSignals.momentSeeds.length > 0 && (
                <>
                  <p className="district-preview-section-title">Moment Seeds</p>
                  <ul className="district-preview-notes">
                    {tasteSignals.momentSeeds.map((seed, index) => (
                      <li key={`${profile.pocketId}_moment_seed_${index}`}>{seed}</li>
                    ))}
                  </ul>
                </>
              )}

              <p className="district-preview-section-title">Cluster</p>
              <p className="district-preview-inline">
                source {profile.meta.clusteringSource} | stage notes {stageNotes.length}
              </p>
              {stageNotes.length > 0 && (
                <ul className="district-preview-notes">
                  {stageNotes.map((note, index) => (
                    <li key={`${profile.pocketId}_note_${index}`}>{note}</li>
                  ))}
                </ul>
              )}

              {debugTrace?.composition && (
                <>
                  <p className="district-preview-section-title">Composition</p>
                  <p className="district-preview-inline">
                    categories{' '}
                    {debugTrace.composition.topCategories.length > 0
                      ? debugTrace.composition.topCategories
                          .map((entry) => `${entry.key} (${entry.count})`)
                          .join(', ')
                      : 'none'}
                  </p>
                  <p className="district-preview-inline">
                    lanes{' '}
                    {debugTrace.composition.dominantLanes.length > 0
                      ? debugTrace.composition.dominantLanes
                          .map((entry) => `${entry.key} (${entry.count})`)
                          .join(', ')
                      : 'none'}
                  </p>
                  <p className="district-preview-inline">
                    category diversity {debugTrace.composition.categoryDiversityCount} | lane
                    diversity {debugTrace.composition.laneDiversityCount} | lane score{' '}
                    {formatMetric(debugTrace.composition.laneDiversityScore, 2)}
                  </p>
                  {debugTrace.composition.representativeEntityNames.length > 0 && (
                    <>
                      <p className="district-preview-section-title">Representative Entities</p>
                      <ul className="district-preview-notes">
                        {debugTrace.composition.representativeEntityNames.map(
                          (entityName, index) => (
                            <li key={`${profile.pocketId}_entity_${index}`}>{entityName}</li>
                          ),
                        )}
                      </ul>
                    </>
                  )}
                </>
              )}

              <p className="district-preview-section-title">Debug Flags</p>
              <p className="district-preview-inline">
                densityClamped {String(rawPocket?.geometry.densityClamped ?? false)} | densityAreaFloorApplied{' '}
                {String(rawPocket?.geometry.densityAreaFloorApplied ?? false)}
              </p>
            </section>
          )
        })}
      </div>

      {rejectedPocketDiagnostics.length > 0 && (
        <div className="district-preview-pocket-list">
          <p className="district-preview-section-title">Rejected Pockets</p>
          {rejectedPocketDiagnostics.map((rejectedPocket) => (
            <section key={rejectedPocket.pocketId} className="district-preview-pocket">
              <div className="district-preview-pocket-head">
                <div>
                  <h4>{rejectedPocket.pocketId}</h4>
                  <p className="district-preview-inline">
                    origin {rejectedPocket.origin} | source {rejectedPocket.clusteringSource}
                  </p>
                </div>
                <span className={`district-preview-tier ${getTierClass('reject')}`}>reject</span>
              </div>

              <p className="district-preview-inline">
                entities {rejectedPocket.entityCount} | density{' '}
                {formatRounded(rejectedPocket.geometry.densityEntitiesPerKm2)} | maxDist{' '}
                {formatRounded(rejectedPocket.geometry.maxDistanceFromCentroidM)}m
              </p>

              <p className="district-preview-section-title">Rejection Summary</p>
              <p className="district-preview-inline">{rejectedPocket.rejectionReasonSummary}</p>

              <p className="district-preview-section-title">Geometry Snapshot</p>
              <p className="district-preview-inline">
                centroid ({rejectedPocket.geometry.centroid.lat.toFixed(5)},{' '}
                {rejectedPocket.geometry.centroid.lng.toFixed(5)}) | avgDist{' '}
                {formatRounded(rejectedPocket.geometry.avgDistanceFromCentroidM)}m | pairwise{' '}
                {formatRounded(rejectedPocket.geometry.maxPairwiseDistanceM)}m | bbox{' '}
                {formatRounded(rejectedPocket.geometry.bboxWidthM)}x
                {formatRounded(rejectedPocket.geometry.bboxHeightM)}m | elongation{' '}
                {formatMetric(rejectedPocket.geometry.elongationRatio, 2)}
              </p>

              {rejectedPocket.rejectionReasons.length > 0 && (
                <>
                  <p className="district-preview-section-title">Rejection Detail</p>
                  <ul className="district-preview-notes">
                    {rejectedPocket.rejectionReasons.map((reason, index) => (
                      <li key={`${rejectedPocket.pocketId}_reason_${index}`}>{reason}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}
        </div>
      )}
    </aside>
  )
}
