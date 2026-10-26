/**
 * Label placement — collision-aware greedy label layout.
 * Determines which labels to show and their positions, without overlap.
 */

import { LABEL } from "./theme";

export interface LabelCandidate {
  id: string;
  x: number;
  y: number;
  text: string;
  priority: number;
  nodeRadius: number;
}

export interface PlacedLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  /** Opacity for fade-in/out animation (0..1) */
  opacity: number;
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Truncate a label string with ellipsis if longer than the threshold.
 */
export function truncateLabel(text: string, maxLen: number = LABEL.truncateLength): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

/**
 * Estimate the pixel width of a label string.
 * Uses a simple character-width heuristic; accurate enough for collision detection.
 */
function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58 + 8;
}

/**
 * Given a list of label candidates (sorted by descending priority),
 * greedily place labels avoiding overlaps.
 *
 * @param candidates  — sorted by descending priority
 * @param zoom        — current camera zoom
 * @param prevLabels  — previously visible label IDs (for fade tracking)
 * @returns placed labels with positions
 */
export function placeLabels(
  candidates: LabelCandidate[],
  zoom: number,
  _prevLabels: Set<string>,
): PlacedLabel[] {
  if (zoom < LABEL.zoomThresholdHide) return [];

  const limit =
    zoom >= 1.1
      ? LABEL.maxAtZoomHigh
      : zoom >= 0.7
        ? LABEL.maxAtZoomMid
        : LABEL.maxAtZoomLow;

  const fontSize = zoom >= 0.8 ? 11 : 9;
  const placed: Rect[] = [];
  const result: PlacedLabel[] = [];

  for (const candidate of candidates) {
    if (result.length >= limit) break;

    const displayText = truncateLabel(candidate.text);
    const width = estimateWidth(displayText, fontSize) / zoom;
    const height = (fontSize + 6) / zoom;
    const yOffset = candidate.nodeRadius + 4 / zoom;

    const rect: Rect = {
      left: candidate.x - width / 2,
      right: candidate.x + width / 2,
      top: candidate.y + yOffset,
      bottom: candidate.y + yOffset + height,
    };

    if (placed.some((other) => rectsOverlap(rect, other))) {
      continue;
    }

    placed.push(rect);
    result.push({
      id: candidate.id,
      x: candidate.x,
      y: candidate.y + yOffset + height / 2,
      text: displayText,
      opacity: 1,
    });
  }

  return result;
}

/**
 * Build and sort label candidates from the current graph state.
 */
export function buildLabelCandidates(
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    label: string;
    radius: number;
    visible: boolean;
    dimmed: boolean;
  }>,
  selectedId: string | null,
  hoveredId: string | null,
  nearCursorIds: Set<string>,
  topDegreeIds: Set<string>,
  neighborIds: Set<string>,
  degrees: Map<string, number>,
): LabelCandidate[] {
  const candidates: LabelCandidate[] = [];

  for (const node of nodes) {
    if (!node.visible || node.dimmed) continue;

    const isSelected = node.id === selectedId;
    const isHovered = node.id === hoveredId;
    const isNeighbor = neighborIds.has(node.id);
    const isNearCursor = nearCursorIds.has(node.id);
    const isTopDegree = topDegreeIds.has(node.id);

    // Only show labels for qualified nodes
    if (!isSelected && !isHovered && !isNeighbor && !isNearCursor && !isTopDegree) continue;

    const priority =
      (isSelected ? 10000 : 0) +
      (isHovered ? 9000 : 0) +
      (isNeighbor ? 3000 : 0) +
      (isNearCursor ? 1500 : 0) +
      (isTopDegree ? 500 : 0) +
      (degrees.get(node.id) ?? 0);

    candidates.push({
      id: node.id,
      x: node.x,
      y: node.y,
      text: node.label,
      priority,
      nodeRadius: node.radius,
    });
  }

  // Sort by descending priority, then deterministic by id
  candidates.sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );

  return candidates;
}
