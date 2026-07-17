import type {
  InterpretationBuildProviderSemanticQueryProjection,
  InterpretationSemanticLiveQueryProjection,
} from '../interpretation/query/projectSemanticQueryProjection'
import type { ProviderTextSearchQuery } from '../providers/ProviderAdapter'
import type { LiveProviderEnvelope } from '../retrieval/liveEnvelope'
import type { LiveQueryPlanEntry } from '../sources/buildLiveQueryPlan'

export interface FieldMechanicalQueryCenter {
  id: string
  lat: number
  lng: number
}

export interface FieldMechanicalLiveQueryScaffold {
  entries: LiveQueryPlanEntry[]
  labelsConsidered: number
  labelsAdmitted: number
}

export interface FieldMechanicalProviderTextSearchScaffold {
  admittedEntries: LiveQueryPlanEntry[]
  queries: ProviderTextSearchQuery[]
  labelsConsidered: number
  labelsAdmitted: number
  centersConsidered: number
  centersAdmitted: number
  plannedCalls: number
  plannedWithinCap: boolean
}

export interface FieldMechanicalBuildProviderTextSearchScaffold {
  queries: ProviderTextSearchQuery[]
  labelsConsidered: number
  labelsAdmitted: number
  plannedCalls: number
  plannedWithinCap: boolean
}

function getMaxQueryLabels(
  labelCount: number,
  envelope?: Pick<LiveProviderEnvelope, 'maxQueryLabels'>,
): number {
  return typeof envelope?.maxQueryLabels === 'number'
    ? Math.max(0, envelope.maxQueryLabels)
    : labelCount
}

function getMaxProviderCalls(envelope?: Pick<LiveProviderEnvelope, 'maxProviderCalls'>): number {
  return typeof envelope?.maxProviderCalls === 'number'
    ? Math.max(0, envelope.maxProviderCalls)
    : Number.POSITIVE_INFINITY
}

export function projectFieldMechanicalLiveQueryScaffold(
  semanticProjection: InterpretationSemanticLiveQueryProjection,
  options: { liveQueryLabels?: string[]; envelope?: Pick<LiveProviderEnvelope, 'maxQueryLabels'> } = {},
): FieldMechanicalLiveQueryScaffold {
  const entries = semanticProjection.projectedEntries.map(({ compatibility, facets }) => ({
    ...compatibility,
    kind: facets.requestedKind ?? compatibility.kind,
    label: facets.queryIdentity,
    textQuery: compatibility.textQuery,
    queryTerms: [...compatibility.queryTerms],
    notes: [...compatibility.notes],
  }))
  const allowedLabels = new Set(options.liveQueryLabels ?? [])
  const beforeEnvelope =
    allowedLabels.size > 0
      ? entries.filter((entry) => allowedLabels.has(entry.label))
      : entries
  const admitted = beforeEnvelope.slice(0, getMaxQueryLabels(beforeEnvelope.length, options.envelope))
  return {
    entries: admitted,
    labelsConsidered: beforeEnvelope.length,
    labelsAdmitted: admitted.length,
  }
}

export function projectFieldMechanicalProviderTextSearchScaffold(input: {
  semanticProjection: InterpretationSemanticLiveQueryProjection
  centers: FieldMechanicalQueryCenter[]
  radiusM: number
  fieldMask: string
  pageSize: number
  envelope?: Pick<LiveProviderEnvelope, 'maxProviderCalls' | 'maxQueryLabels' | 'maxCenters'>
  liveQueryLabels?: string[]
}): FieldMechanicalProviderTextSearchScaffold {
  const liveEntries = projectFieldMechanicalLiveQueryScaffold(input.semanticProjection, {
    envelope: input.envelope,
    liveQueryLabels: input.liveQueryLabels,
  })
  const maxCenters =
    typeof input.envelope?.maxCenters === 'number'
      ? Math.max(0, input.envelope.maxCenters)
      : input.centers.length
  const centers = input.centers.slice(0, maxCenters)
  const maxProviderCalls = getMaxProviderCalls(input.envelope)
  const queries: ProviderTextSearchQuery[] = []

  for (const entry of liveEntries.entries) {
    for (const center of centers) {
      if (queries.length >= maxProviderCalls) {
        break
      }
      queries.push({
        fieldMask: input.fieldMask,
        locationBias: {
          circle: {
            center: {
              latitude: center.lat,
              longitude: center.lng,
            },
            radius: input.radiusM,
          },
        },
        pageSize: input.pageSize,
        queryLabel: `${entry.label}@${center.id}`,
        rankPreference: 'RELEVANCE',
        textQuery: entry.textQuery,
      })
    }
    if (queries.length >= maxProviderCalls) {
      break
    }
  }

  return {
    admittedEntries: liveEntries.entries,
    queries,
    labelsConsidered: liveEntries.labelsConsidered,
    labelsAdmitted: liveEntries.labelsAdmitted,
    centersConsidered: input.centers.length,
    centersAdmitted: centers.length,
    plannedCalls: queries.length,
    plannedWithinCap:
      typeof input.envelope?.maxProviderCalls === 'number'
        ? queries.length <= Math.max(0, input.envelope.maxProviderCalls)
        : true,
  }
}

export function projectFieldMechanicalBuildProviderTextSearchScaffold(input: {
  semanticProjection: InterpretationBuildProviderSemanticQueryProjection
  center: { latitude: number; longitude: number }
  radiusM: number
  fieldMask: string
  pageSize: number
  envelope?: Pick<LiveProviderEnvelope, 'maxProviderCalls' | 'maxQueryLabels'>
}): FieldMechanicalBuildProviderTextSearchScaffold {
  const maxQueryLabels = getMaxQueryLabels(input.semanticProjection.entries.length, input.envelope)
  const admittedEntries = input.semanticProjection.entries.slice(0, maxQueryLabels)
  const queries = admittedEntries
    .slice(0, getMaxProviderCalls(input.envelope))
    .map((entry): ProviderTextSearchQuery => ({
      fieldMask: input.fieldMask,
      locationBias: {
        circle: {
          center: input.center,
          radius: input.radiusM,
        },
      },
      pageSize: input.pageSize,
      queryLabel: entry.label,
      rankPreference: 'DISTANCE',
      textQuery: entry.textQuery,
    }))

  return {
    queries,
    labelsConsidered: input.semanticProjection.entries.length,
    labelsAdmitted: admittedEntries.length,
    plannedCalls: queries.length,
    plannedWithinCap:
      typeof input.envelope?.maxProviderCalls === 'number'
        ? queries.length <= Math.max(0, input.envelope.maxProviderCalls)
        : true,
  }
}
