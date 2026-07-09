export type DbscanInput<TPoint> = {
  points: TPoint[]
  epsM: number
  minPoints: number
  distance: (a: TPoint, b: TPoint) => number
}

export type DbscanCluster<TPoint> = {
  id: string
  pointIndices: number[]
  points: TPoint[]
}

export type DbscanResult<TPoint> = {
  clusters: Array<DbscanCluster<TPoint>>
  noiseIndices: number[]
}

const UNASSIGNED = -1
const NOISE = -2

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

function regionQuery<TPoint>(
  points: TPoint[],
  index: number,
  epsM: number,
  distance: (a: TPoint, b: TPoint) => number,
): number[] {
  const neighbors: number[] = []
  for (let currentIndex = 0; currentIndex < points.length; currentIndex += 1) {
    if (distance(points[index], points[currentIndex]) <= epsM) {
      neighbors.push(currentIndex)
    }
  }
  return neighbors
}

function expandCluster<TPoint>(
  input: DbscanInput<TPoint>,
  seedIndex: number,
  clusterId: number,
  initialNeighbors: number[],
  assignments: number[],
  visited: boolean[],
): void {
  assignments[seedIndex] = clusterId
  const queue = [...initialNeighbors]

  while (queue.length > 0) {
    const candidateIndex = queue.shift()
    if (candidateIndex === undefined) {
      continue
    }

    if (!visited[candidateIndex]) {
      visited[candidateIndex] = true
      const candidateNeighbors = regionQuery(
        input.points,
        candidateIndex,
        input.epsM,
        input.distance,
      )
      if (candidateNeighbors.length >= input.minPoints) {
        queue.push(...candidateNeighbors)
      }
    }

    if (assignments[candidateIndex] === UNASSIGNED || assignments[candidateIndex] === NOISE) {
      assignments[candidateIndex] = clusterId
    }
  }
}

export function dbscan<TPoint>(input: DbscanInput<TPoint>): DbscanResult<TPoint> {
  if (input.points.length === 0) {
    return { clusters: [], noiseIndices: [] }
  }

  const visited = new Array<boolean>(input.points.length).fill(false)
  const assignments = new Array<number>(input.points.length).fill(UNASSIGNED)
  let clusterCount = 0

  for (let index = 0; index < input.points.length; index += 1) {
    if (visited[index]) {
      continue
    }

    visited[index] = true
    const neighbors = regionQuery(input.points, index, input.epsM, input.distance)

    if (neighbors.length < input.minPoints) {
      assignments[index] = NOISE
      continue
    }

    clusterCount += 1
    expandCluster(input, index, clusterCount, neighbors, assignments, visited)
  }

  const clusters: Array<DbscanCluster<TPoint>> = []
  for (let clusterId = 1; clusterId <= clusterCount; clusterId += 1) {
    const pointIndices = unique(
      assignments
        .map((assignment, index) => ({ assignment, index }))
        .filter(({ assignment }) => assignment === clusterId)
        .map(({ index }) => index),
    )
    if (pointIndices.length === 0) {
      continue
    }
    clusters.push({
      id: `cluster-${clusterId}`,
      pointIndices,
      points: pointIndices.map((index) => input.points[index]),
    })
  }

  const noiseIndices = assignments
    .map((assignment, index) => ({ assignment, index }))
    .filter(({ assignment }) => assignment === NOISE)
    .map(({ index }) => index)

  return { clusters, noiseIndices }
}

