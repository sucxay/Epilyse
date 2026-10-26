/**
 * Graph visual theme — single source of truth for all colors, sizes, and
 * visual constants used by the canvas renderer.  Nothing in render code
 * should hardcode a color; import from here instead.
 */

/* ── Cluster palette (8–10 harmonious hues) ─────────────────────────── */
export const CLUSTER_PALETTE = [
  "#6c8cff", // cornflower
  "#e47783", // rose
  "#73b9ae", // teal
  "#f3cf45", // gold
  "#c084fc", // purple
  "#f97316", // orange
  "#38bdf8", // sky
  "#a3e635", // lime
  "#fb7185", // pink
  "#22d3ee", // cyan
] as const;

/* ── Edge relationship colors ───────────────────────────────────────── */
export const EDGE_COLORS: Record<string, string> = {
  import: "#5a7a9e",
  contains: "#7a5c42",
  calls: "#4a9e8e",
};

/* ── Node kind visual properties ────────────────────────────────────── */
export interface NodeKindStyle {
  minRadius: number;
  maxRadius: number;
  filled: boolean;
  ring: boolean;
}

export const NODE_KIND_STYLES: Record<string, NodeKindStyle> = {
  file: { minRadius: 6, maxRadius: 16, filled: true, ring: true },
  class: { minRadius: 5, maxRadius: 14, filled: true, ring: false },
  function: { minRadius: 3, maxRadius: 10, filled: true, ring: false },
  method: { minRadius: 2.5, maxRadius: 8, filled: true, ring: false },
};

/* ── Background ─────────────────────────────────────────────────────── */
export const BG = {
  color: "#05060f",
  vignetteColor: "rgba(5,6,15,0.85)",
  dotColor: "rgba(255,255,255,0.04)",
  dotSpacing: 28,
  dotRadius: 0.8,
} as const;

/* ── Edges ──────────────────────────────────────────────────────────── */
export const EDGE = {
  defaultOpacity: 0.1,
  highlightOpacity: 0.7,
  dimOpacity: 0.03,
  defaultWidth: 0.7,
  highlightWidth: 1.8,
  containsHiddenByDefault: true,
  /** Edges longer than this (px) are hidden until hover */
  maxVisibleLength: 600,
  particleSpeed: 1.5,
  particleSize: 1.8,
  maxParticles: 6,
} as const;

/* ── Labels ─────────────────────────────────────────────────────────── */
export const LABEL = {
  font: "500 11px Inter, system-ui, sans-serif",
  smallFont: "500 9px Inter, system-ui, sans-serif",
  color: "rgba(220,225,240,0.92)",
  haloColor: "rgba(5,6,15,0.75)",
  haloWidth: 3,
  fadeMs: 200,
  maxAtZoomHigh: 45,
  maxAtZoomMid: 24,
  maxAtZoomLow: 12,
  zoomThresholdHide: 0.45,
  maxLabelWidth: 160,
  truncateLength: 22,
} as const;

/* ── Glow ───────────────────────────────────────────────────────────── */
export const GLOW = {
  /** Pre-render glow sprites at these radii */
  radii: [12, 18, 26, 34],
  baseAlpha: 0.18,
  highDegreeAlpha: 0.32,
  /** Cursor spotlight radius */
  cursorRadius: 140,
  cursorAlpha: 0.06,
  cursorLerpFactor: 0.15,
} as const;

/* ── Interaction ────────────────────────────────────────────────────── */
export const INTERACTION = {
  hitRadius: 18,
  magneticScale: 1.6,
  magneticDriftPx: 4,
  springFactor: 0.12,
  neighborDimOpacity: 0.12,
  dimEaseMs: 300,
  rippleDurationMs: 600,
  cameraEaseMs: 500,
  focusPadding: 1.4,
} as const;

/* ── Layout (d3-force) ──────────────────────────────────────────────── */
export const LAYOUT = {
  linkDistanceIntra: 80,
  linkDistanceInter: 180,
  linkStrength: 0.45,
  chargeStrength: -260,
  chargeMax: 800,
  collisionRadius: 20,
  centerStrength: 0.06,
  gravityStrength: 0.02,
  velocityDecay: 0.58,
  alphaDecay: 0.035,
  alphaDecayReduced: 0.2,
  reheatAlpha: 0.12,
} as const;

/* ── CSS variable map (injected into container) ─────────────────────── */
export const CSS_VARS: Record<string, string> = {
  "--graph-bg": BG.color,
  "--graph-vignette": BG.vignetteColor,
  "--graph-dot": BG.dotColor,
  "--graph-label": LABEL.color,
  "--graph-label-halo": LABEL.haloColor,
  "--graph-sidebar-bg": "rgba(8,10,22,0.88)",
  "--graph-sidebar-border": "rgba(255,255,255,0.06)",
  "--graph-glass-blur": "16px",
};
