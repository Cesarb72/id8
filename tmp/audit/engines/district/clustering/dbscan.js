const UNASSIGNED = -1;
const NOISE = -2;
function unique(values) {
    return [...new Set(values)];
}
function regionQuery(points, index, epsM, distance) {
    const neighbors = [];
    for (let currentIndex = 0; currentIndex < points.length; currentIndex += 1) {
        if (distance(points[index], points[currentIndex]) <= epsM) {
            neighbors.push(currentIndex);
        }
    }
    return neighbors;
}
function expandCluster(input, seedIndex, clusterId, initialNeighbors, assignments, visited) {
    assignments[seedIndex] = clusterId;
    const queue = [...initialNeighbors];
    while (queue.length > 0) {
        const candidateIndex = queue.shift();
        if (candidateIndex === undefined) {
            continue;
        }
        if (!visited[candidateIndex]) {
            visited[candidateIndex] = true;
            const candidateNeighbors = regionQuery(input.points, candidateIndex, input.epsM, input.distance);
            if (candidateNeighbors.length >= input.minPoints) {
                queue.push(...candidateNeighbors);
            }
        }
        if (assignments[candidateIndex] === UNASSIGNED || assignments[candidateIndex] === NOISE) {
            assignments[candidateIndex] = clusterId;
        }
    }
}
export function dbscan(input) {
    if (input.points.length === 0) {
        return { clusters: [], noiseIndices: [] };
    }
    const visited = new Array(input.points.length).fill(false);
    const assignments = new Array(input.points.length).fill(UNASSIGNED);
    let clusterCount = 0;
    for (let index = 0; index < input.points.length; index += 1) {
        if (visited[index]) {
            continue;
        }
        visited[index] = true;
        const neighbors = regionQuery(input.points, index, input.epsM, input.distance);
        if (neighbors.length < input.minPoints) {
            assignments[index] = NOISE;
            continue;
        }
        clusterCount += 1;
        expandCluster(input, index, clusterCount, neighbors, assignments, visited);
    }
    const clusters = [];
    for (let clusterId = 1; clusterId <= clusterCount; clusterId += 1) {
        const pointIndices = unique(assignments
            .map((assignment, index) => ({ assignment, index }))
            .filter(({ assignment }) => assignment === clusterId)
            .map(({ index }) => index));
        if (pointIndices.length === 0) {
            continue;
        }
        clusters.push({
            id: `cluster-${clusterId}`,
            pointIndices,
            points: pointIndices.map((index) => input.points[index]),
        });
    }
    const noiseIndices = assignments
        .map((assignment, index) => ({ assignment, index }))
        .filter(({ assignment }) => assignment === NOISE)
        .map(({ index }) => index);
    return { clusters, noiseIndices };
}
