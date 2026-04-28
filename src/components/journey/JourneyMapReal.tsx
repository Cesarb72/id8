import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { UserStopRole } from '../../domain/types/itinerary'
import {
  fetchNearbyPlacesForWaypoint,
  type NearbyPlaceRecord,
} from '../../domain/nearby/fetchNearbyPlacesForWaypoint'

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
interface JourneyMapRealProps {
  activeRole: UserStopRole
  onNearbySummaryChange?: (role: UserStopRole, summary: string | null) => void
  onNearbyOptionsChange?: (role: UserStopRole, options: JourneyNearbyOption[]) => void
  waypointOverrides?: Partial<Record<UserStopRole, JourneyWaypointOverride>>
  routeStops?: JourneyMapRouteStop[]
  activeStopId?: string
  activeStopIndex?: number
  cityLabel?: string
  selectedNearbyPlaceIdByRole?: Partial<Record<UserStopRole, string>>
  continuationStops?: JourneyContinuationStop[]
  alertActive?: boolean
  alertRole?: UserStopRole | null
}

export interface JourneyMapRouteStop {
  id: string
  role: UserStopRole
  name: string
  displayName?: string
  stopIndex?: number
  latitude?: number
  longitude?: number
  coordinates?: [number, number]
}

interface RealWaypoint {
  id: string
  role: UserStopRole
  label: string
  name: string
  stopIndex: number
  coordinates: [number, number]
}

export type JourneyNearbyOption = NearbyPlaceRecord

export interface JourneyWaypointOverride {
  name?: string
  coordinates?: [number, number]
}

export interface JourneyContinuationStop {
  id: string
  name: string
  descriptor: string
  coordinates: [number, number]
}

function getRoleLabel(role: UserStopRole): string {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'windDown') {
    return 'Wind-down'
  }
  return 'Surprise'
}

function getCurrentStateLine(
  activeStop: JourneyMapRouteStop | undefined,
  activeStopIndex: number | undefined,
  stopCount: number,
): string {
  const roleLabel = getRoleLabel(activeStop?.role ?? 'start')
  if (!activeStop) {
    return 'Map follows the current stop in your route.'
  }
  const positionLabel =
    typeof activeStopIndex === 'number' && stopCount > 0
      ? `Stop ${activeStopIndex + 1} of ${stopCount}`
      : roleLabel
  return `${positionLabel}: ${roleLabel} - ${activeStop.name}`
}

function getNextStateLine(
  routeStops: JourneyMapRouteStop[],
  activeStopIndex: number | undefined,
): string {
  if (routeStops.length === 0) {
    return 'Next: No upcoming stop'
  }
  const hasActiveIndex = typeof activeStopIndex === 'number' && activeStopIndex >= 0
  const nextStop = hasActiveIndex ? routeStops[activeStopIndex + 1] : routeStops[1]
  if (!nextStop) {
    return 'Next: No upcoming stop'
  }
  return `Next: ${getRoleLabel(nextStop.role)} - ${nextStop.name}`
}

const REAL_WAYPOINTS: RealWaypoint[] = [
  {
    id: 'waypoint-start',
    role: 'start',
    label: '01',
    name: 'Heritage Tea House',
    stopIndex: 0,
    coordinates: [-121.8947, 37.3358],
  },
  {
    id: 'waypoint-highlight',
    role: 'highlight',
    label: '02',
    name: 'Theatre District Jazz Cellar',
    stopIndex: 1,
    coordinates: [-121.8892, 37.3331],
  },
  {
    id: 'waypoint-winddown',
    role: 'windDown',
    label: '03',
    name: 'Orchard Artisan Gelato',
    stopIndex: 2,
    coordinates: [-121.9275, 37.3229],
  },
]

const DEFAULT_COORDINATES_BY_ROLE: Record<UserStopRole, [number, number]> = {
  start: [-121.8947, 37.3358],
  highlight: [-121.8892, 37.3331],
  surprise: [-121.9078, 37.3292],
  windDown: [-121.9275, 37.3229],
}

const NEARBY_RENDER_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [0.00008, 0.00002],
  [-0.00007, 0.00006],
  [0.00006, -0.00007],
  [-0.00006, -0.00005],
  [0.0001, 0.00004],
  [-0.00009, 0.00001],
  [0.00003, -0.0001],
]

function getNearbyRenderCoordinates(
  coordinates: [number, number],
  index: number,
  tier: 'primary' | 'secondary',
): [number, number] {
  const offset = NEARBY_RENDER_OFFSETS[index % NEARBY_RENDER_OFFSETS.length] ?? [0, 0]
  const scale = tier === 'primary' ? 0.65 : 1
  return [coordinates[0] + offset[0] * scale, coordinates[1] + offset[1] * scale]
}

function buildNearbyGeoJson(
  role: UserStopRole,
  places: NearbyPlaceRecord[],
  selectedPlaceId?: string,
  alertState?: { alertActive?: boolean; alertRole?: UserStopRole | null },
): GeoJSON.FeatureCollection {
  const alertFocusEnabled = Boolean(alertState?.alertActive && alertState.alertRole === role)
  return {
    type: 'FeatureCollection',
    features: places.map((place, index) => ({
      type: 'Feature',
      properties: {
        id: place.id,
        role,
        category: place.category,
        tier: index < 2 ? 'primary' : 'secondary',
        name: place.name,
        alertFocus: alertFocusEnabled && index === 0,
        selectedSwap: selectedPlaceId ? place.id === selectedPlaceId : false,
      },
      geometry: {
        type: 'Point',
        coordinates: getNearbyRenderCoordinates(
          place.coordinates,
          index,
          index < 2 ? 'primary' : 'secondary',
        ),
      },
    })),
  }
}

function buildActiveClusterGeoJson(role: UserStopRole, waypoints: RealWaypoint[]): GeoJSON.FeatureCollection {
  const waypoint = waypoints.find((entry) => entry.role === role) ?? waypoints[0]
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          role: waypoint.role,
        },
        geometry: {
          type: 'Point',
          coordinates: waypoint.coordinates,
        },
      },
    ],
  }
}

function buildNearbySummary(places: NearbyPlaceRecord[]): string | null {
  if (places.length === 0) {
    return null
  }
  const names = places.slice(0, 3).map((place) => place.name)
  if (names.length === 1) {
    return `Nearby now: ${names[0]}.`
  }
  if (names.length === 2) {
    return `Nearby now: ${names[0]} and ${names[1]}.`
  }
  return `Nearby now: ${names[0]}, ${names[1]}, and ${names[2]}.`
}

function resolveWaypoints(
  overrides?: Partial<Record<UserStopRole, JourneyWaypointOverride>>,
): RealWaypoint[] {
  return REAL_WAYPOINTS.map((waypoint) => {
    const override = overrides?.[waypoint.role]
    if (!override) {
      return waypoint
    }
    return {
      ...waypoint,
      name: override.name?.trim() || waypoint.name,
      coordinates: override.coordinates ?? waypoint.coordinates,
    }
  })
}

function toOrderedRouteStops(routeStops: JourneyMapRouteStop[]): JourneyMapRouteStop[] {
  return [...routeStops]
    .map((stop, index) => ({
      ...stop,
      stopIndex: typeof stop.stopIndex === 'number' ? stop.stopIndex : index,
    }))
    .sort((left, right) => {
      const leftIndex = left.stopIndex ?? 0
      const rightIndex = right.stopIndex ?? 0
      return leftIndex - rightIndex
    })
}

function resolveWaypointCoordinates(
  stop: JourneyMapRouteStop,
  overrides: Partial<Record<UserStopRole, JourneyWaypointOverride>> | undefined,
): [number, number] {
  if (stop.coordinates) {
    return stop.coordinates
  }
  if (typeof stop.longitude === 'number' && typeof stop.latitude === 'number') {
    return [stop.longitude, stop.latitude]
  }
  const overrideCoordinates = overrides?.[stop.role]?.coordinates
  if (overrideCoordinates) {
    return overrideCoordinates
  }
  return DEFAULT_COORDINATES_BY_ROLE[stop.role] ?? DEFAULT_COORDINATES_BY_ROLE.start
}

function buildWaypointsFromRouteStops(
  routeStops: JourneyMapRouteStop[],
  overrides?: Partial<Record<UserStopRole, JourneyWaypointOverride>>,
): RealWaypoint[] {
  return toOrderedRouteStops(routeStops).map((stop, index) => ({
    id: stop.id,
    role: stop.role,
    label: String(index + 1).padStart(2, '0'),
    name: stop.displayName?.trim() || stop.name.trim() || overrides?.[stop.role]?.name?.trim() || `Stop ${index + 1}`,
    stopIndex: stop.stopIndex ?? index,
    coordinates: resolveWaypointCoordinates(stop, overrides),
  }))
}

function toLineCoordinates(coordinates: [number, number][]): [number, number][] {
  if (coordinates.length >= 2) {
    return coordinates
  }
  const fallback = coordinates[0] ?? DEFAULT_COORDINATES_BY_ROLE.start
  return [fallback, fallback]
}

function buildContinuationRouteGeoJson(
  waypoints: RealWaypoint[],
  continuationStops: JourneyContinuationStop[],
): GeoJSON.FeatureCollection {
  if (continuationStops.length === 0) {
    return { type: 'FeatureCollection', features: [] }
  }
  const windDownWaypoint =
    waypoints.find((waypoint) => waypoint.role === 'windDown') ??
    waypoints[waypoints.length - 1]
  const coordinates: [number, number][] = [
    windDownWaypoint?.coordinates ??
      waypoints[waypoints.length - 1]?.coordinates ??
      REAL_WAYPOINTS[REAL_WAYPOINTS.length - 1].coordinates,
    ...continuationStops.map((stop) => stop.coordinates),
  ]
  if (coordinates.length < 2) {
    return { type: 'FeatureCollection', features: [] }
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  }
}

function buildContinuationPointsGeoJson(
  continuationStops: JourneyContinuationStop[],
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: continuationStops.map((stop, index) => ({
      type: 'Feature',
      properties: {
        id: stop.id,
        name: stop.name,
        label: `0${index + 4}`,
      },
      geometry: {
        type: 'Point',
        coordinates: stop.coordinates,
      },
    })),
  }
}

function applyRouteEmphasis(map: mapboxgl.Map): void {
  map.setPaintProperty('journey-waypoint-route-active-segment-line', 'line-opacity', 0.64)
  map.setPaintProperty('journey-waypoint-route-active-segment-line', 'line-width', 3.75)
}

function applyAlertRouteEmphasis(
  map: mapboxgl.Map,
  active: boolean,
  role: UserStopRole | null | undefined,
): void {
  if (!active || role !== 'highlight') {
    return
  }
  map.setPaintProperty('journey-waypoint-route-active-segment-line', 'line-opacity', 0.76)
  map.setPaintProperty('journey-waypoint-route-active-segment-line', 'line-width', 4.1)
}

export function JourneyMapReal({
  activeRole,
  onNearbySummaryChange,
  onNearbyOptionsChange,
  waypointOverrides,
  routeStops = [],
  activeStopId,
  activeStopIndex,
  cityLabel,
  selectedNearbyPlaceIdByRole,
  continuationStops = [],
  alertActive = false,
  alertRole = null,
}: JourneyMapRealProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const activeRoleRef = useRef<UserStopRole>(activeRole)
  const nearbyEpochRef = useRef(0)
  const nearbyCacheRef = useRef<Partial<Record<UserStopRole, NearbyPlaceRecord[]>>>({})
  const markerElementsRef = useRef<Record<string, HTMLButtonElement>>({})
  const markerByStopIdRef = useRef<Record<string, mapboxgl.Marker>>({})
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const orderedRouteStops = useMemo(() => toOrderedRouteStops(routeStops), [routeStops])

  const activeRouteStop = useMemo(() => {
    if (orderedRouteStops.length === 0) {
      return undefined
    }
    if (activeStopId) {
      const matchedById = orderedRouteStops.find((stop) => stop.id === activeStopId)
      if (matchedById) {
        return matchedById
      }
    }
    if (
      typeof activeStopIndex === 'number' &&
      activeStopIndex >= 0 &&
      activeStopIndex < orderedRouteStops.length
    ) {
      return orderedRouteStops[activeStopIndex]
    }
    const matchedByRole = orderedRouteStops.find((stop) => stop.role === activeRole)
    if (matchedByRole) {
      return matchedByRole
    }
    if (activeRole === 'surprise') {
      return orderedRouteStops.find((stop) => stop.role === 'highlight') ?? orderedRouteStops[0]
    }
    return orderedRouteStops[0]
  }, [activeRole, activeStopId, activeStopIndex, orderedRouteStops])

  const effectiveActiveRole = activeRouteStop?.role ?? activeRole
  activeRoleRef.current = effectiveActiveRole
  const activeRouteStopIndex = useMemo(() => {
    if (typeof activeStopIndex === 'number' && activeStopIndex >= 0) {
      return activeStopIndex
    }
    if (!activeRouteStop) {
      return undefined
    }
    const matchedIndex = orderedRouteStops.findIndex((stop) => stop.id === activeRouteStop.id)
    return matchedIndex >= 0 ? matchedIndex : undefined
  }, [activeRouteStop, activeStopIndex, orderedRouteStops])

  const effectiveWaypoints = useMemo(
    () =>
      orderedRouteStops.length > 0
        ? buildWaypointsFromRouteStops(orderedRouteStops, waypointOverrides)
        : resolveWaypoints(waypointOverrides),
    [orderedRouteStops, waypointOverrides],
  )

  const routeCoordinates = useMemo(
    () => effectiveWaypoints.map((waypoint) => waypoint.coordinates),
    [effectiveWaypoints],
  )

  const activeRouteSegmentCoordinates = useMemo(() => {
    if (effectiveWaypoints.length < 2) {
      return routeCoordinates
    }
    const activeIndex =
      typeof activeRouteStopIndex === 'number' && activeRouteStopIndex >= 0
        ? Math.min(activeRouteStopIndex, effectiveWaypoints.length - 1)
        : Math.max(
            effectiveWaypoints.findIndex((waypoint) => waypoint.id === activeRouteStop?.id),
            0,
          )
    const fromIndex = Math.min(
      Math.max(activeIndex > 0 ? activeIndex - 1 : 0, 0),
      effectiveWaypoints.length - 2,
    )
    const toIndex = fromIndex + 1
    return [effectiveWaypoints[fromIndex].coordinates, effectiveWaypoints[toIndex].coordinates]
  }, [activeRouteStop?.id, activeRouteStopIndex, effectiveWaypoints, routeCoordinates])

  const activeWaypoint = useMemo(
    () =>
      effectiveWaypoints.find((waypoint) => waypoint.id === activeRouteStop?.id) ??
      effectiveWaypoints.find((waypoint) => waypoint.role === effectiveActiveRole) ??
      effectiveWaypoints[0],
    [activeRouteStop?.id, effectiveActiveRole, effectiveWaypoints],
  )

  useEffect(() => {
    if (!MAPBOX_ACCESS_TOKEN || !mapContainerRef.current || mapRef.current) {
      return
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: activeWaypoint.coordinates,
      zoom: 14.45,
      pitch: 0,
      bearing: 0,
      attributionControl: true,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      mapLoadedRef.current = true

      map.addSource('journey-waypoint-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: toLineCoordinates(routeCoordinates),
          },
        },
      })

      map.addSource('journey-waypoint-route-active-segment', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: toLineCoordinates(activeRouteSegmentCoordinates),
          },
        },
      })

      map.addSource('journey-waypoint-continuation-route', {
        type: 'geojson',
        data: buildContinuationRouteGeoJson(effectiveWaypoints, continuationStops),
      })

      map.addSource('journey-waypoint-continuation-points', {
        type: 'geojson',
        data: buildContinuationPointsGeoJson(continuationStops),
      })

      map.addLayer({
        id: 'journey-waypoint-route-base-line',
        type: 'line',
        source: 'journey-waypoint-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#80a39b',
          'line-width': 1.9,
          'line-opacity': 0.13,
        },
      })

      map.addLayer({
        id: 'journey-waypoint-route-active-segment-line',
        type: 'line',
        source: 'journey-waypoint-route-active-segment',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#0f7a6d',
          'line-width': 3.4,
          'line-opacity': 0.6,
          'line-blur': 0.2,
          'line-opacity-transition': { duration: 240, delay: 0 },
          'line-width-transition': { duration: 240, delay: 0 },
        },
      })

      map.addLayer({
        id: 'journey-waypoint-continuation-route-line',
        type: 'line',
        source: 'journey-waypoint-continuation-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#597884',
          'line-width': 2.3,
          'line-opacity': 0.38,
          'line-dasharray': [1.2, 1.4],
        },
      })

      map.addLayer({
        id: 'journey-waypoint-continuation-points-circle',
        type: 'circle',
        source: 'journey-waypoint-continuation-points',
        paint: {
          'circle-radius': 8,
          'circle-color': 'rgba(255,255,255,0.92)',
          'circle-stroke-color': '#6e8791',
          'circle-stroke-width': 1.2,
          'circle-opacity': 0.96,
        },
      })

      map.addLayer({
        id: 'journey-waypoint-continuation-points-label',
        type: 'symbol',
        source: 'journey-waypoint-continuation-points',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#425a63',
          'text-opacity': 0.86,
        },
      })

      map.addSource('journey-waypoint-active-cluster', {
        type: 'geojson',
        data: buildActiveClusterGeoJson(activeWaypoint.role, effectiveWaypoints),
      })

      map.addLayer({
        id: 'journey-waypoint-active-cluster-soft',
        type: 'circle',
        source: 'journey-waypoint-active-cluster',
        paint: {
          'circle-radius': [
            'match',
            ['get', 'role'],
            'start',
            52,
            'highlight',
            42,
            'windDown',
            48,
            46,
          ],
          'circle-color': '#2f8f7d',
          'circle-opacity': 0.07,
        },
      })

      map.addLayer({
        id: 'journey-waypoint-active-cluster-core',
        type: 'circle',
        source: 'journey-waypoint-active-cluster',
        paint: {
          'circle-radius': [
            'match',
            ['get', 'role'],
            'start',
            33,
            'highlight',
            27,
            'windDown',
            30,
            29,
          ],
          'circle-color': '#2f8f7d',
          'circle-opacity': 0.11,
        },
      })

      map.addSource('journey-waypoint-nearby-real', {
        type: 'geojson',
        data: buildNearbyGeoJson(
          activeWaypoint.role,
          [],
          selectedNearbyPlaceIdByRole?.[activeWaypoint.role],
          {
          alertActive,
          alertRole,
          },
        ),
      })

      map.addLayer({
        id: 'journey-waypoint-nearby-real-glow-layer',
        type: 'symbol',
        source: 'journey-waypoint-nearby-real',
        layout: {
          'text-field': [
            'match',
            ['get', 'category'],
            'nightlife',
            '◆',
            'dessert',
            '●',
            'cafe',
            '●',
            '■',
          ],
          'text-size': [
            'case',
            ['boolean', ['get', 'alertFocus'], false],
            22.6,
            ['boolean', ['get', 'selectedSwap'], false],
            21.6,
            ['match', ['get', 'tier'], 'primary', 20.2, 16.4],
          ],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': [
            'match',
            ['get', 'category'],
            'nightlife',
            'rgba(192,101,44,0.78)',
            'dessert',
            'rgba(42,132,118,0.78)',
            'cafe',
            'rgba(42,132,118,0.78)',
            'rgba(93,109,123,0.72)',
          ],
          'text-opacity': [
            'case',
            ['boolean', ['get', 'alertFocus'], false],
            0.34,
            ['boolean', ['get', 'selectedSwap'], false],
            0.31,
            ['match', ['get', 'tier'], 'primary', 0.26, 0.18],
          ],
          'text-halo-color': [
            'match',
            ['get', 'category'],
            'nightlife',
            'rgba(192,101,44,0.35)',
            'dessert',
            'rgba(42,132,118,0.35)',
            'cafe',
            'rgba(42,132,118,0.35)',
            'rgba(93,109,123,0.3)',
          ],
          'text-halo-width': 1.1,
          'text-halo-blur': 0.95,
          'text-opacity-transition': { duration: 220, delay: 0 },
        },
      })

      map.addLayer({
        id: 'journey-waypoint-nearby-real-layer',
        type: 'symbol',
        source: 'journey-waypoint-nearby-real',
        layout: {
          'text-field': [
            'match',
            ['get', 'category'],
            'nightlife',
            '◆',
            'dessert',
            '●',
            'cafe',
            '●',
            '■',
          ],
          'text-size': [
            'case',
            ['boolean', ['get', 'alertFocus'], false],
            19.7,
            ['boolean', ['get', 'selectedSwap'], false],
            18.8,
            ['match', ['get', 'tier'], 'primary', 17.6, 14.3],
          ],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': [
            'match',
            ['get', 'category'],
            'nightlife',
            '#c0652c',
            'dessert',
            '#2a8476',
            'cafe',
            '#2a8476',
            '#5d6d7b',
          ],
          'text-opacity': [
            'case',
            ['boolean', ['get', 'alertFocus'], false],
            0.98,
            ['boolean', ['get', 'selectedSwap'], false],
            0.93,
            ['match', ['get', 'tier'], 'primary', 0.88, 0.69],
          ],
          'text-halo-color': 'rgba(255,255,255,0.94)',
          'text-halo-width': 0.98,
          'text-halo-blur': 0.35,
          'text-opacity-transition': { duration: 220, delay: 0 },
        },
      })

      applyRouteEmphasis(map)
      applyAlertRouteEmphasis(map, alertActive, alertRole)

      for (const waypoint of effectiveWaypoints) {
        const markerElement = document.createElement('button')
        markerElement.type = 'button'
        markerElement.className = `journey-map-real-marker role-${waypoint.role}`
        const isActive =
          Boolean(activeStopId && waypoint.id === activeStopId) ||
          waypoint.id === activeRouteStop?.id ||
          waypoint.role === activeRoleRef.current
        if (isActive) {
          markerElement.classList.add('active')
        } else {
          markerElement.classList.add('inactive')
        }
        markerElement.textContent = waypoint.label
        markerElement.title = waypoint.name
        markerElement.setAttribute('aria-label', waypoint.name)
        markerElementsRef.current[waypoint.id] = markerElement
        const marker = new mapboxgl.Marker({
          element: markerElement,
          anchor: 'center',
        })
          .setLngLat(waypoint.coordinates)
          .addTo(map)
        markerByStopIdRef.current[waypoint.id] = marker
        markersRef.current.push(marker)
      }
    })

    return () => {
      mapLoadedRef.current = false
      for (const marker of markersRef.current) {
        marker.remove()
      }
      markersRef.current = []
      markerElementsRef.current = {}
      markerByStopIdRef.current = {}
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    nearbyCacheRef.current = {}
  }, [waypointOverrides])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) {
      return
    }

    const routeSource = map.getSource('journey-waypoint-route') as mapboxgl.GeoJSONSource | undefined
    const routeActiveSegmentSource = map.getSource('journey-waypoint-route-active-segment') as
      | mapboxgl.GeoJSONSource
      | undefined
    const activeClusterSource = map.getSource('journey-waypoint-active-cluster') as
      | mapboxgl.GeoJSONSource
      | undefined
    const continuationRouteSource = map.getSource('journey-waypoint-continuation-route') as
      | mapboxgl.GeoJSONSource
      | undefined
    const continuationPointsSource = map.getSource('journey-waypoint-continuation-points') as
      | mapboxgl.GeoJSONSource
      | undefined

    routeSource?.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: toLineCoordinates(routeCoordinates),
      },
    })
    routeActiveSegmentSource?.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: toLineCoordinates(activeRouteSegmentCoordinates),
      },
    })
    activeClusterSource?.setData(buildActiveClusterGeoJson(effectiveActiveRole, effectiveWaypoints))
    continuationRouteSource?.setData(buildContinuationRouteGeoJson(effectiveWaypoints, continuationStops))
    continuationPointsSource?.setData(buildContinuationPointsGeoJson(continuationStops))

    for (const waypoint of effectiveWaypoints) {
      markerByStopIdRef.current[waypoint.id]?.setLngLat(waypoint.coordinates)
      const markerElement = markerElementsRef.current[waypoint.id]
      if (markerElement) {
        markerElement.title = waypoint.name
        markerElement.setAttribute('aria-label', waypoint.name)
      }
    }
  }, [
    effectiveActiveRole,
    continuationStops,
    effectiveWaypoints,
    routeCoordinates,
    activeRouteSegmentCoordinates,
  ])

  useEffect(() => {
    for (const waypoint of effectiveWaypoints) {
      const markerElement = markerElementsRef.current[waypoint.id]
      if (!markerElement) {
        continue
      }
      const activeByStopId = Boolean(activeStopId) && waypoint.id === activeStopId
      const isActive =
        activeByStopId ||
        waypoint.id === activeRouteStop?.id ||
        (!activeStopId && !activeRouteStop && waypoint.role === effectiveActiveRole)
      markerElement.classList.toggle('active', isActive)
      markerElement.classList.toggle('inactive', !isActive)
      markerElement.classList.toggle(
        'lce-alert-target',
        Boolean(alertActive && alertRole === waypoint.role),
      )
    }
  }, [
    activeStopId,
    alertActive,
    alertRole,
    activeRouteStop?.id,
    effectiveWaypoints,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) {
      return
    }

    map.easeTo({
      center: activeWaypoint.coordinates,
      zoom: 14.45,
      duration: 700,
      essential: true,
    })

    const nearbySource = map.getSource('journey-waypoint-nearby-real') as
      | mapboxgl.GeoJSONSource
      | undefined
    const activeClusterSource = map.getSource('journey-waypoint-active-cluster') as
      | mapboxgl.GeoJSONSource
      | undefined

    if (activeClusterSource) {
      activeClusterSource.setData(buildActiveClusterGeoJson(activeWaypoint.role, effectiveWaypoints))
    }

    if (nearbySource) {
      const cached = nearbyCacheRef.current[activeWaypoint.role]
      if (cached) {
        nearbySource.setData(
          buildNearbyGeoJson(
            activeWaypoint.role,
            cached,
            selectedNearbyPlaceIdByRole?.[activeWaypoint.role],
            {
              alertActive,
              alertRole,
            },
          ),
        )
        onNearbySummaryChange?.(activeWaypoint.role, buildNearbySummary(cached))
        onNearbyOptionsChange?.(activeWaypoint.role, cached.slice(0, 6))
      } else {
        nearbySource.setData(
          buildNearbyGeoJson(
            activeWaypoint.role,
            [],
            selectedNearbyPlaceIdByRole?.[activeWaypoint.role],
            {
              alertActive,
              alertRole,
            },
          ),
        )
        onNearbySummaryChange?.(activeWaypoint.role, null)
        onNearbyOptionsChange?.(activeWaypoint.role, [])
      }

      const epoch = nearbyEpochRef.current + 1
      nearbyEpochRef.current = epoch

      fetchNearbyPlacesForWaypoint(activeWaypoint)
        .then((diagnostic) => {
          if (nearbyEpochRef.current !== epoch) {
            return
          }
          const places = diagnostic.places
          nearbyCacheRef.current[activeWaypoint.role] = places
          nearbySource.setData(
            buildNearbyGeoJson(
              activeWaypoint.role,
              places,
              selectedNearbyPlaceIdByRole?.[activeWaypoint.role],
              {
                alertActive,
                alertRole,
              },
            ),
          )
          onNearbySummaryChange?.(activeWaypoint.role, buildNearbySummary(places))
          onNearbyOptionsChange?.(activeWaypoint.role, places.slice(0, 6))

          const bounds = map.getBounds()
          const plottedPlaces = places.map((place) => ({
            name: place.name,
            category: place.category,
            coordinates: place.coordinates,
            inBounds: bounds.contains(place.coordinates),
          }))
          const inBoundsCount = plottedPlaces.filter((place) => place.inBounds).length
          const categoryCounts = plottedPlaces.reduce<Record<string, number>>((accumulator, place) => {
            accumulator[place.category] = (accumulator[place.category] ?? 0) + 1
            return accumulator
          }, {})

          void diagnostic
          void plottedPlaces
          void categoryCounts
          void inBoundsCount
          void bounds
        })
        .catch((error) => {
          if (nearbyEpochRef.current !== epoch) {
            return
          }
          nearbyCacheRef.current[activeWaypoint.role] = []
          nearbySource.setData(
            buildNearbyGeoJson(
              activeWaypoint.role,
              [],
              selectedNearbyPlaceIdByRole?.[activeWaypoint.role],
              {
                alertActive,
                alertRole,
              },
            ),
          )
          onNearbySummaryChange?.(activeWaypoint.role, null)
          onNearbyOptionsChange?.(activeWaypoint.role, [])
          void error
        })
    }

    applyRouteEmphasis(map)
    applyAlertRouteEmphasis(map, alertActive, alertRole)
  }, [
    activeWaypoint,
    effectiveWaypoints,
    onNearbySummaryChange,
    onNearbyOptionsChange,
    alertActive,
    alertRole,
    selectedNearbyPlaceIdByRole,
  ])

  return (
    <section className="journey-map-real">
      <div className="journey-map-header">
        <div>
          <p className="journey-map-kicker">Journey Map</p>
          <h2>{cityLabel?.trim() || 'Selected route'}</h2>
          <p className="journey-map-focus">
            {getCurrentStateLine(
              activeRouteStop,
              activeRouteStopIndex,
              orderedRouteStops.length,
            )}
          </p>
          <p className="journey-map-now-viewing">
            {getNextStateLine(orderedRouteStops, activeRouteStopIndex)}
          </p>
          <p className="journey-map-nearby-key" aria-hidden="true">
            nightlife - cafe/dessert - other nearby
          </p>
        </div>
      </div>
      {!MAPBOX_ACCESS_TOKEN ? (
        <div className="journey-map-real-missing-token">
          Map unavailable {'\u2014'} missing Mapbox token
        </div>
      ) : (
        <div ref={mapContainerRef} className="journey-map-real-canvas" />
      )}
    </section>
  )
}


