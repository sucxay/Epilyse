/**
 * Spatial index — simple grid-based spatial hash for O(1) hit testing and
 * cursor-proximity queries.  Avoids scanning all nodes per pointer move.
 */

export interface SpatialPoint {
  id: string;
  x: number;
  y: number;
  radius: number;
}

const CELL_SIZE = 64;

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export class SpatialGrid {
  private cells = new Map<string, SpatialPoint[]>();
  private allPoints: SpatialPoint[] = [];

  rebuild(points: SpatialPoint[]): void {
    this.cells.clear();
    this.allPoints = points;
    for (const p of points) {
      const cx = Math.floor(p.x / CELL_SIZE);
      const cy = Math.floor(p.y / CELL_SIZE);
      const key = cellKey(cx, cy);
      let cell = this.cells.get(key);
      if (!cell) {
        cell = [];
        this.cells.set(key, cell);
      }
      cell.push(p);
    }
  }

  /** Find the nearest point within `maxDist` of (x, y). */
  nearest(x: number, y: number, maxDist: number): SpatialPoint | null {
    const r = Math.ceil(maxDist / CELL_SIZE);
    const cx0 = Math.floor(x / CELL_SIZE);
    const cy0 = Math.floor(y / CELL_SIZE);

    let best: SpatialPoint | null = null;
    let bestDist = maxDist * maxDist;

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const cell = this.cells.get(cellKey(cx0 + dx, cy0 + dy));
        if (!cell) continue;
        for (const p of cell) {
          const dist = (p.x - x) ** 2 + (p.y - y) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            best = p;
          }
        }
      }
    }
    return best;
  }

  /** Return all points within `radius` of (x, y). */
  queryRadius(x: number, y: number, radius: number): SpatialPoint[] {
    const r = Math.ceil(radius / CELL_SIZE);
    const cx0 = Math.floor(x / CELL_SIZE);
    const cy0 = Math.floor(y / CELL_SIZE);
    const result: SpatialPoint[] = [];
    const r2 = radius * radius;

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const cell = this.cells.get(cellKey(cx0 + dx, cy0 + dy));
        if (!cell) continue;
        for (const p of cell) {
          if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2) {
            result.push(p);
          }
        }
      }
    }
    return result;
  }

  get size(): number {
    return this.allPoints.length;
  }
}
