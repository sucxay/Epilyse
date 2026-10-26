/**
 * Interaction state machine — manages cursor glow smoothing, magnetic
 * hover, click ripples, keyboard navigation, and dim transitions.
 *
 * Pointer events only update target state; the render loop reads it.
 */

import type { CameraState, CursorState, Ripple, Particle, RenderEdge } from "./render";
import { GLOW, INTERACTION, EDGE } from "./theme";
import type { LayoutNode } from "./layout";
import { SpatialGrid } from "./spatial";

export interface InteractionState {
  cursor: CursorState | null;
  hoveredId: string | null;
  selectedId: string | null;
  neighborIds: Set<string>;
  dimProgress: Map<string, number>;
  ripples: Ripple[];
  particles: Particle[];
  highlightedEdgeIndices: Set<number>;
  isDragging: boolean;
  dragNodeId: string | null;
  dragOffsetX: number;
  dragOffsetY: number;
}

export function createInteractionState(): InteractionState {
  return {
    cursor: null,
    hoveredId: null,
    selectedId: null,
    neighborIds: new Set(),
    dimProgress: new Map(),
    ripples: [],
    particles: [],
    highlightedEdgeIndices: new Set(),
    isDragging: false,
    dragNodeId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
  };
}

/**
 * Update smooth cursor position (lerp toward target).
 * Call once per frame.
 */
export function updateCursorSmooth(state: InteractionState): void {
  if (!state.cursor) return;
  state.cursor.smoothX += (state.cursor.targetX - state.cursor.smoothX) * GLOW.cursorLerpFactor;
  state.cursor.smoothY += (state.cursor.targetY - state.cursor.smoothY) * GLOW.cursorLerpFactor;
}

/**
 * Set cursor world position from a pointer event.
 */
export function setCursorTarget(
  state: InteractionState,
  worldX: number,
  worldY: number,
): void {
  if (!state.cursor) {
    state.cursor = {
      targetX: worldX,
      targetY: worldY,
      smoothX: worldX,
      smoothY: worldY,
    };
  } else {
    state.cursor.targetX = worldX;
    state.cursor.targetY = worldY;
  }
}

/**
 * Clear cursor (pointer left the canvas).
 */
export function clearCursor(state: InteractionState): void {
  state.cursor = null;
  state.hoveredId = null;
}

/**
 * Update hovered node from spatial index.
 * Returns the hovered node ID if any.
 */
export function updateHover(
  state: InteractionState,
  spatialGrid: SpatialGrid,
  camera: CameraState,
): string | null {
  if (!state.cursor) {
    state.hoveredId = null;
    return null;
  }

  const nearest = spatialGrid.nearest(
    state.cursor.targetX,
    state.cursor.targetY,
    INTERACTION.hitRadius / camera.zoom,
  );
  state.hoveredId = nearest?.id ?? null;
  return state.hoveredId;
}

/**
 * Update dim progress for all nodes.
 * Nodes in the neighbor set ease toward 0 (fully visible);
 * all others ease toward 1 (dimmed).
 * @param dt — delta time in ms
 */
export function updateDimProgress(
  state: InteractionState,
  nodeIds: string[],
  dt: number,
): void {
  const hasFocus = state.hoveredId !== null || state.selectedId !== null;
  const speed = dt / INTERACTION.dimEaseMs;

  for (const id of nodeIds) {
    const current = state.dimProgress.get(id) ?? 0;
    let target: number;

    if (!hasFocus) {
      target = 0;
    } else if (state.neighborIds.has(id)) {
      target = 0;
    } else {
      target = 1;
    }

    if (Math.abs(current - target) < 0.01) {
      state.dimProgress.set(id, target);
    } else {
      state.dimProgress.set(id, current + (target - current) * Math.min(1, speed));
    }
  }
}

/**
 * Add a click ripple at the given world position.
 */
export function addRipple(
  state: InteractionState,
  x: number,
  y: number,
  color: string,
): void {
  state.ripples.push({ x, y, color, startTime: performance.now() });
}

/**
 * Clean up expired ripples.
 */
export function cleanRipples(state: InteractionState, now: number): void {
  state.ripples = state.ripples.filter(
    (r) => now - r.startTime < INTERACTION.rippleDurationMs,
  );
}

/**
 * Spawn particles on highlighted edges.
 */
export function spawnParticles(
  state: InteractionState,
  edges: RenderEdge[],
): void {
  state.highlightedEdgeIndices.clear();
  state.particles = [];

  const focusId = state.hoveredId ?? state.selectedId;
  if (!focusId) return;

  let count = 0;
  for (let i = 0; i < edges.length; i++) {
    if (count >= EDGE.maxParticles) break;
    const edge = edges[i];
    if (edge.sourceId === focusId || edge.targetId === focusId) {
      state.highlightedEdgeIndices.add(i);
      state.particles.push({
        edgeIndex: i,
        t: Math.random(),
      });
      count++;
    }
  }
}

/**
 * Advance particle positions.
 */
export function updateParticles(state: InteractionState, dt: number): void {
  const speed = (EDGE.particleSpeed * dt) / 1000;
  for (const p of state.particles) {
    p.t += speed;
    if (p.t > 1) p.t -= 1;
  }
}

/**
 * Handle keyboard navigation.
 * Returns true if the event was handled.
 */
export function handleKeyboard(
  event: KeyboardEvent,
  state: InteractionState,
  nodes: LayoutNode[],
  edges: RenderEdge[],
  onSelect: (id: string | null) => void,
  onFitNode: (id: string) => void,
): boolean {
  if (event.key === "Escape") {
    state.selectedId = null;
    state.neighborIds.clear();
    onSelect(null);
    return true;
  }

  if (!state.selectedId) return false;

  if (event.key === "Enter") {
    onFitNode(state.selectedId);
    return true;
  }

  // Arrow / Tab: move to a neighbor
  if (
    event.key === "ArrowRight" ||
    event.key === "ArrowDown" ||
    event.key === "Tab"
  ) {
    event.preventDefault();
    const neighbors = Array.from(state.neighborIds)
      .filter((id) => id !== state.selectedId)
      .sort();
    if (neighbors.length > 0) {
      const idx = neighbors.indexOf(state.selectedId);
      const next = neighbors[(idx + 1) % neighbors.length];
      state.selectedId = next;
      onSelect(next);
    }
    return true;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    const neighbors = Array.from(state.neighborIds)
      .filter((id) => id !== state.selectedId)
      .sort();
    if (neighbors.length > 0) {
      const idx = neighbors.indexOf(state.selectedId);
      const next = neighbors[(idx - 1 + neighbors.length) % neighbors.length];
      state.selectedId = next;
      onSelect(next);
    }
    return true;
  }

  return false;
}
