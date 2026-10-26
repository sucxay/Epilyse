/**
 * Canvas renderer — draws nodes, edges, labels, glows, cursor spotlight,
 * and particles onto an HTML5 Canvas.
 *
 * Single `requestAnimationFrame` loop with dirty-flag rendering.
 * Pre-renders glow sprites to offscreen canvases.
 */

import type { LayoutNode } from "./layout";
import type { PlacedLabel } from "./labels";
import type { Community } from "./communities";
import { BG, EDGE, EDGE_COLORS, GLOW, LABEL, NODE_KIND_STYLES, INTERACTION } from "./theme";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface RenderEdge {
  sourceId: string;
  targetId: string;
  type: string;
}

export interface Ripple {
  x: number;
  y: number;
  color: string;
  startTime: number;
}

export interface Particle {
  edgeIndex: number;
  t: number; // 0..1 progress along edge
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface CursorState {
  /** Actual cursor position (world coords) */
  targetX: number;
  targetY: number;
  /** Smoothed cursor position (world coords) */
  smoothX: number;
  smoothY: number;
}

export interface RenderState {
  nodes: LayoutNode[];
  edges: RenderEdge[];
  labels: PlacedLabel[];
  camera: CameraState;
  cursor: CursorState | null;
  hoveredId: string | null;
  selectedId: string | null;
  neighborIds: Set<string>;
  nodeCommunityMap: Map<string, Community>;
  degrees: Map<string, number>;
  ripples: Ripple[];
  particles: Particle[];
  dimmedNodeIds: Set<string>;
  /** 0..1 for each node's dim animation progress */
  dimProgress: Map<string, number>;
  highlightedEdgeIndices: Set<number>;
  settled: boolean;
  reducedMotion: boolean;
  visibleNodeIds: Set<string>;
  /** Pre-rendered glow sprites */
  glowSprites: Map<number, HTMLCanvasElement>;
}

/* ── Glow sprite cache ──────────────────────────────────────────────── */

export function createGlowSprites(): Map<number, HTMLCanvasElement> {
  const sprites = new Map<number, HTMLCanvasElement>();
  for (const r of GLOW.radii) {
    const size = r * 6;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.3)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.08)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    sprites.set(r, canvas);
  }
  return sprites;
}

function bestGlowSprite(
  radius: number,
  sprites: Map<number, HTMLCanvasElement>,
): HTMLCanvasElement | null {
  let bestKey: number = GLOW.radii[0];
  let bestDiff = Infinity;
  for (const r of GLOW.radii) {
    const diff = Math.abs(r - radius);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestKey = r;
    }
  }
  return sprites.get(bestKey) ?? null;
}

/* ── Background ─────────────────────────────────────────────────────── */

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: CameraState,
  cursorSmooth: { x: number; y: number } | null,
  reducedMotion: boolean,
): void {
  // Solid background
  ctx.fillStyle = BG.color;
  ctx.fillRect(0, 0, width, height);

  // Dot grid (parallax-shifted if cursor present)
  const spacing = BG.dotSpacing * camera.zoom;
  if (spacing > 6) {
    let offsetX = (-camera.x * camera.zoom + width / 2) % spacing;
    let offsetY = (-camera.y * camera.zoom + height / 2) % spacing;

    // Subtle parallax
    if (cursorSmooth && !reducedMotion) {
      const px = (cursorSmooth.x - width / 2) * 0.003;
      const py = (cursorSmooth.y - height / 2) * 0.003;
      offsetX -= px;
      offsetY -= py;
    }

    ctx.fillStyle = BG.dotColor;
    for (let x = offsetX; x < width; x += spacing) {
      for (let y = offsetY; y < height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, BG.dotRadius * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Radial vignette
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7,
  );
  gradient.addColorStop(0, "rgba(5,6,15,0)");
  gradient.addColorStop(1, BG.vignetteColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/* ── Transform helpers ──────────────────────────────────────────────── */

function worldToScreen(
  wx: number,
  wy: number,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (wx - camera.x) * camera.zoom + canvasWidth / 2,
    y: (wy - camera.y) * camera.zoom + canvasHeight / 2,
  };
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (sx - canvasWidth / 2) / camera.zoom + camera.x,
    y: (sy - canvasHeight / 2) / camera.zoom + camera.y,
  };
}

/* ── Edge drawing ───────────────────────────────────────────────────── */

function drawEdges(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const { edges, nodes, camera, neighborIds, hoveredId, selectedId, highlightedEdgeIndices, nodeCommunityMap } = state;
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of nodes) nodeMap.set(node.id, node);
  const focusId = hoveredId ?? selectedId;

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const source = nodeMap.get(edge.sourceId);
    const target = nodeMap.get(edge.targetId);
    if (!source || !target) continue;
    if (!state.visibleNodeIds.has(source.id) || !state.visibleNodeIds.has(target.id)) continue;

    // Hide CONTAINS by default
    if (edge.type === "contains" && EDGE.containsHiddenByDefault) {
      if (!focusId || (edge.sourceId !== focusId && edge.targetId !== focusId)) continue;
    }

    const s = worldToScreen(source.x, source.y, camera, canvasWidth, canvasHeight);
    const t = worldToScreen(target.x, target.y, camera, canvasWidth, canvasHeight);

    // Cull off-screen edges
    const margin = 50;
    if (
      Math.max(s.x, t.x) < -margin ||
      Math.min(s.x, t.x) > canvasWidth + margin ||
      Math.max(s.y, t.y) < -margin ||
      Math.min(s.y, t.y) > canvasHeight + margin
    ) continue;

    const isHighlighted = highlightedEdgeIndices.has(i);
    const isConnected =
      focusId !== null &&
      (edge.sourceId === focusId || edge.targetId === focusId);

    // Length-based hiding
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > EDGE.maxVisibleLength && !isConnected) continue;

    const baseColor = EDGE_COLORS[edge.type] ?? "#5a7a9e";
    let opacity: number;
    let width: number;

    if (isHighlighted || isConnected) {
      opacity = EDGE.highlightOpacity;
      width = EDGE.highlightWidth;
    } else if (focusId !== null) {
      opacity = EDGE.dimOpacity;
      width = EDGE.defaultWidth;
    } else {
      opacity = EDGE.defaultOpacity;
      width = EDGE.defaultWidth;
    }

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);

    // Gentle curve for longer edges to reduce overlap
    if (len > 200) {
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      const nx = -(t.y - s.y) / len;
      const ny = (t.x - s.x) / len;
      const curveAmount = Math.min(len * 0.08, 20);
      ctx.quadraticCurveTo(mx + nx * curveAmount, my + ny * curveAmount, t.x, t.y);
    } else {
      ctx.lineTo(t.x, t.y);
    }

    ctx.strokeStyle = baseColor;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = width * camera.zoom;

    if (edge.type === "calls" && isConnected) {
      ctx.setLineDash([4 * camera.zoom, 3 * camera.zoom]);
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

/* ── Particle drawing (edge flow on highlighted edges) ──────────────── */

function drawParticles(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (state.reducedMotion) return;
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of state.nodes) nodeMap.set(node.id, node);

  for (const particle of state.particles) {
    const edge = state.edges[particle.edgeIndex];
    if (!edge) continue;
    const source = nodeMap.get(edge.sourceId);
    const target = nodeMap.get(edge.targetId);
    if (!source || !target) continue;

    const px = source.x + (target.x - source.x) * particle.t;
    const py = source.y + (target.y - source.y) * particle.t;
    const screen = worldToScreen(px, py, state.camera, canvasWidth, canvasHeight);

    const color = EDGE_COLORS[edge.type] ?? "#5a7a9e";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, EDGE.particleSize * state.camera.zoom, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ── Node drawing ───────────────────────────────────────────────────── */

function drawNodes(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const { nodes, camera, hoveredId, selectedId, nodeCommunityMap, degrees, dimProgress, glowSprites, visibleNodeIds } = state;
  const focusId = hoveredId ?? selectedId;

  for (const node of nodes) {
    if (!visibleNodeIds.has(node.id)) continue;

    const screen = worldToScreen(node.x, node.y, camera, canvasWidth, canvasHeight);

    // Cull off-screen
    const margin = 40;
    if (
      screen.x < -margin ||
      screen.x > canvasWidth + margin ||
      screen.y < -margin ||
      screen.y > canvasHeight + margin
    ) continue;

    const community = nodeCommunityMap.get(node.id);
    const color = community?.color ?? "#6c8cff";
    const kind = node.kind ?? node.type;
    const style = NODE_KIND_STYLES[kind] ?? NODE_KIND_STYLES.function;
    const degree = degrees.get(node.id) ?? 0;

    // Dim animation
    const dim = dimProgress.get(node.id) ?? 0;
    const alpha = focusId ? 1 - dim * (1 - INTERACTION.neighborDimOpacity) : 1;

    let radius = node.radius * camera.zoom;
    const isHovered = node.id === hoveredId;
    const isSelected = node.id === selectedId;

    // Magnetic hover scale
    if (isHovered && !state.reducedMotion) {
      radius *= INTERACTION.magneticScale;
    }

    // Glow (for high-degree or hovered nodes)
    if (camera.zoom > 0.4 && (degree > 3 || isHovered)) {
      const glowAlpha = isHovered
        ? GLOW.highDegreeAlpha
        : GLOW.baseAlpha * Math.min(1, degree / 8);
      const sprite = bestGlowSprite(node.radius, glowSprites);
      if (sprite) {
        ctx.globalAlpha = glowAlpha * alpha;
        const spriteSize = radius * 5;
        ctx.drawImage(
          sprite,
          screen.x - spriteSize / 2,
          screen.y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
        ctx.globalAlpha = 1;
      }
    }

    // Node body
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Ring for files
    if (style.ring || isSelected) {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? "#fff7ed" : `${color}88`;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();
    }

    // Selected glow ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = `${color}44`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}

/* ── Label drawing ──────────────────────────────────────────────────── */

function drawLabels(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const { labels, camera } = state;
  const fontSize = camera.zoom >= 0.8 ? 11 : 9;

  ctx.font = camera.zoom >= 0.8 ? LABEL.font : LABEL.smallFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const label of labels) {
    const screen = worldToScreen(label.x, label.y, camera, canvasWidth, canvasHeight);

    // Halo for readability
    ctx.globalAlpha = label.opacity;
    ctx.strokeStyle = LABEL.haloColor;
    ctx.lineWidth = LABEL.haloWidth;
    ctx.lineJoin = "round";
    ctx.strokeText(label.text, screen.x, screen.y);

    // Label text
    ctx.fillStyle = LABEL.color;
    ctx.fillText(label.text, screen.x, screen.y);
    ctx.globalAlpha = 1;
  }
}

/* ── Cursor glow ────────────────────────────────────────────────────── */

function drawCursorGlow(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (!state.cursor || state.reducedMotion) return;

  const screen = worldToScreen(
    state.cursor.smoothX,
    state.cursor.smoothY,
    state.camera,
    canvasWidth,
    canvasHeight,
  );

  const radius = GLOW.cursorRadius * state.camera.zoom;
  const gradient = ctx.createRadialGradient(
    screen.x, screen.y, 0,
    screen.x, screen.y, radius,
  );
  gradient.addColorStop(0, `rgba(140,160,255,${GLOW.cursorAlpha})`);
  gradient.addColorStop(0.5, `rgba(140,160,255,${GLOW.cursorAlpha * 0.4})`);
  gradient.addColorStop(1, "rgba(140,160,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/* ── Click ripple ───────────────────────────────────────────────────── */

function drawRipples(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
  now: number,
): void {
  if (state.reducedMotion) return;

  for (const ripple of state.ripples) {
    const elapsed = now - ripple.startTime;
    if (elapsed > INTERACTION.rippleDurationMs) continue;

    const progress = elapsed / INTERACTION.rippleDurationMs;
    const radius = 10 + progress * 80 * state.camera.zoom;
    const alpha = (1 - progress) * 0.5;

    const screen = worldToScreen(ripple.x, ripple.y, state.camera, canvasWidth, canvasHeight);

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = ripple.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* ── Main render function ───────────────────────────────────────────── */

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
  now: number,
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Screen-space cursor for parallax
  const cursorScreen = state.cursor
    ? worldToScreen(state.cursor.smoothX, state.cursor.smoothY, state.camera, canvasWidth, canvasHeight)
    : null;

  drawBackground(ctx, canvasWidth, canvasHeight, state.camera, cursorScreen, state.reducedMotion);
  drawCursorGlow(ctx, state, canvasWidth, canvasHeight);
  drawEdges(ctx, state, canvasWidth, canvasHeight);
  drawParticles(ctx, state, canvasWidth, canvasHeight);
  drawNodes(ctx, state, canvasWidth, canvasHeight);
  drawRipples(ctx, state, canvasWidth, canvasHeight, now);
  drawLabels(ctx, state, canvasWidth, canvasHeight);
}
