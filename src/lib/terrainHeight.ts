import * as THREE from 'three';

interface Triangle {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  cx: number; cy: number; cz: number;
  minX: number; maxX: number; minZ: number; maxZ: number;
  denominator: number;
}

export interface TerrainHeightIndex {
  // Returns a height only if (x,z) lies over a terrain triangle.
  heightAt: (x: number, z: number) => number | null;
  // When outside the mesh, returns the interpolated height of its nearest boundary edge.
  nearestHeightAt: (x: number, z: number) => number | null;
  triangleCount: number;
  cellSize: number;
}

interface BoundaryEdge {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
}

const cache = new WeakMap<THREE.Object3D, TerrainHeightIndex>();
const CELL_SIZE = 32;

function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

function buildIndex(scene: THREE.Object3D): TerrainHeightIndex {
  scene.updateMatrixWorld(true);
  const triangles: Triangle[] = [];
  const grid = new Map<string, number[]>();
  const boundaryEdges: BoundaryEdge[] = [];
  const v = new THREE.Vector3();

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    if (!position) return;
    const index = mesh.geometry.getIndex();
    const matrix = mesh.matrixWorld;
    const vertexCount = index ? index.count : position.count;
    const edges = new Map<string, { edge: BoundaryEdge; count: number }>();

    const readVertex = (vertexIndex: number) => {
      v.fromBufferAttribute(position, vertexIndex).applyMatrix4(matrix);
      return [v.x, v.y, v.z] as const;
    };

    const vertexKey = (point: readonly number[]) =>
      `p${Math.round(point[0] * 1000)},${Math.round(point[1] * 1000)},${Math.round(point[2] * 1000)}`;
    const addEdge = (
      start: readonly number[],
      end: readonly number[],
    ) => {
      const startKey = vertexKey(start);
      const endKey = vertexKey(end);
      const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
      const existing = edges.get(key);
      if (existing) existing.count++;
      else {
        edges.set(key, {
          count: 1,
          edge: {
            ax: start[0], ay: start[1], az: start[2],
            bx: end[0], by: end[1], bz: end[2],
          },
        });
      }
    };

    for (let i = 0; i + 2 < vertexCount; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      const [ax, ay, az] = readVertex(ia);
      const [bx, by, bz] = readVertex(ib);
      const [cx, cy, cz] = readVertex(ic);
      const a = [ax, ay, az] as const;
      const b = [bx, by, bz] as const;
      const c = [cx, cy, cz] as const;
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(denominator) < 1e-8) continue;

      addEdge(a, b);
      addEdge(b, c);
      addEdge(c, a);

      const triangle: Triangle = {
        ax, ay, az, bx, by, bz, cx, cy, cz,
        minX: Math.min(ax, bx, cx), maxX: Math.max(ax, bx, cx),
        minZ: Math.min(az, bz, cz), maxZ: Math.max(az, bz, cz),
        denominator,
      };
      const triangleIndex = triangles.push(triangle) - 1;
      const minCellX = Math.floor(triangle.minX / CELL_SIZE);
      const maxCellX = Math.floor(triangle.maxX / CELL_SIZE);
      const minCellZ = Math.floor(triangle.minZ / CELL_SIZE);
      const maxCellZ = Math.floor(triangle.maxZ / CELL_SIZE);
      for (let gx = minCellX; gx <= maxCellX; gx++) {
        for (let gz = minCellZ; gz <= maxCellZ; gz++) {
          const key = cellKey(gx, gz);
          const bucket = grid.get(key);
          if (bucket) bucket.push(triangleIndex);
          else grid.set(key, [triangleIndex]);
        }
      }
    }

    for (const entry of edges.values()) {
      if (entry.count === 1) boundaryEdges.push(entry.edge);
    }
  });

  const heightAt = (x: number, z: number): number | null => {
    const candidates = grid.get(cellKey(Math.floor(x / CELL_SIZE), Math.floor(z / CELL_SIZE)));
    if (!candidates) return null;

    let highest: number | null = null;
    for (const triangleIndex of candidates) {
      const t = triangles[triangleIndex];
      if (x < t.minX - 1e-4 || x > t.maxX + 1e-4 || z < t.minZ - 1e-4 || z > t.maxZ + 1e-4) continue;

      const u = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / t.denominator;
      const v = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / t.denominator;
      const w = 1 - u - v;
      if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
      const y = u * t.ay + v * t.by + w * t.cy;
      if (highest === null || y > highest) highest = y;
    }
    return highest;
  };

  const nearestHeightAt = (x: number, z: number): number | null => {
    let nearestDistanceSq = Infinity;
    let nearestHeight: number | null = null;
    for (const edge of boundaryEdges) {
      const dx = edge.bx - edge.ax;
      const dz = edge.bz - edge.az;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq > 0
        ? THREE.MathUtils.clamp(((x - edge.ax) * dx + (z - edge.az) * dz) / lengthSq, 0, 1)
        : 0;
      const px = edge.ax + dx * t;
      const pz = edge.az + dz * t;
      const distanceSq = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestHeight = THREE.MathUtils.lerp(edge.ay, edge.by, t);
      }
    }
    return nearestHeight;
  };

  return { heightAt, nearestHeightAt, triangleCount: triangles.length, cellSize: CELL_SIZE };
}

export function getTerrainHeightIndex(scene: THREE.Object3D): TerrainHeightIndex {
  const existing = cache.get(scene);
  if (existing) return existing;
  const index = buildIndex(scene);
  cache.set(scene, index);
  return index;
}
