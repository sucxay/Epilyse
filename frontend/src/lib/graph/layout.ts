/**
 * Force layout — d3-force simulation with cluster gravity.
 * Nodes in the same cluster attract toward a cluster center;
 * clusters repel each other.  Disconnected components pulled to center.
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import type { GraphNode, GraphEdge } from "@/lib/api";
import { LAYOUT } from "./theme";

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  /** Cluster index for cluster-gravity force */
  cluster: number;
  /** Visual radius */
  radius: number;
  /** Degree (connection count) */
  degree: number;
}

export interface LayoutLink {
  source: string | LayoutNode;
  target: string | LayoutNode;
  type: string;
}

/**
 * Compute deterministic initial position for a node based on its index.
 */
function initialPosition(
  index: number,
  count: number,
): { x: number; y: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  return {
    x: ((index % cols) - (cols - 1) / 2) * 200,
    y: (Math.floor(index / cols) - Math.floor(count / cols) / 2) * 150,
  };
}

/**
 * Compute node radius based on degree and kind.
 * Files are larger; symbols scale with sqrt(degree).
 */
export function computeRadius(
  node: GraphNode,
  degree: number,
): number {
  const base = node.type === "file" ? 7 : 3.5;
  const scale = node.type === "file" ? 3 : 2;
  return Math.min(
    node.type === "file" ? 16 : 12,
    base + Math.sqrt(degree) * scale,
  );
}

/**
 * Compute degree map from edges.
 */
export function computeDegrees(edges: GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

/**
 * Get the top N node IDs by degree, for label display priority.
 */
export function topDegreeNodeIds(
  degrees: Map<string, number>,
  n: number = 15,
): Set<string> {
  return new Set(
    Array.from(degrees.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([id]) => id),
  );
}

/**
 * Build neighbor set for a given focus node.
 */
export function buildNeighborSet(
  focusId: string | null,
  edges: GraphEdge[],
): Set<string> {
  const neighbors = new Set<string>();
  if (!focusId) return neighbors;
  neighbors.add(focusId);
  for (const edge of edges) {
    if (edge.source === focusId) neighbors.add(edge.target);
    if (edge.target === focusId) neighbors.add(edge.source);
  }
  return neighbors;
}

export interface CreateSimulationOptions {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusterMap: Map<string, number>;
  degrees: Map<string, number>;
  /** Existing positions to restore (node id → {x, y}) */
  savedPositions: Map<string, { x: number; y: number }>;
  /** Whether reduced motion is preferred */
  reducedMotion: boolean;
  onTick: () => void;
  onEnd: () => void;
}

export interface SimulationResult {
  simulation: Simulation<LayoutNode, LayoutLink>;
  layoutNodes: LayoutNode[];
  layoutLinks: LayoutLink[];
  nodeMap: Map<string, LayoutNode>;
}

/**
 * Create and configure the d3-force simulation.
 */
export function createSimulation(
  options: CreateSimulationOptions,
): SimulationResult {
  const { nodes, edges, clusterMap, degrees, savedPositions, reducedMotion, onTick, onEnd } = options;

  const layoutNodes: LayoutNode[] = nodes.map((node, index) => {
    const saved = savedPositions.get(node.id);
    const pos = saved ?? initialPosition(index, nodes.length);
    const degree = degrees.get(node.id) ?? 0;
    return {
      ...node,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      cluster: clusterMap.get(node.id) ?? 0,
      radius: computeRadius(node, degree),
      degree,
    };
  });

  const nodeMap = new Map<string, LayoutNode>();
  for (const node of layoutNodes) {
    nodeMap.set(node.id, node);
  }

  const layoutLinks: LayoutLink[] = edges
    .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }));

  // Cluster gravity force — pulls nodes toward cluster centers
  const clusterCenters = new Map<number, { x: number; y: number; count: number }>();
  const clusterForce = (alpha: number) => {
    clusterCenters.clear();
    for (const node of layoutNodes) {
      const center = clusterCenters.get(node.cluster);
      if (center) {
        center.x += node.x;
        center.y += node.y;
        center.count++;
      } else {
        clusterCenters.set(node.cluster, { x: node.x, y: node.y, count: 1 });
      }
    }
    for (const center of clusterCenters.values()) {
      center.x /= center.count;
      center.y /= center.count;
    }

    const strength = alpha * 0.3;
    for (const node of layoutNodes) {
      const center = clusterCenters.get(node.cluster);
      if (!center) continue;
      node.vx += (center.x - node.x) * strength;
      node.vy += (center.y - node.y) * strength;
    }
  };

  const simulation = forceSimulation<LayoutNode>(layoutNodes)
    .force(
      "link",
      forceLink<LayoutNode, LayoutLink>(layoutLinks)
        .id((node) => node.id)
        .distance((link) => {
          const sourceNode = typeof link.source === "string" ? nodeMap.get(link.source) : link.source;
          const targetNode = typeof link.target === "string" ? nodeMap.get(link.target) : link.target;
          const sameCluster =
            sourceNode && targetNode && sourceNode.cluster === targetNode.cluster;
          return sameCluster ? LAYOUT.linkDistanceIntra : LAYOUT.linkDistanceInter;
        })
        .strength(LAYOUT.linkStrength),
    )
    .force(
      "charge",
      forceManyBody<LayoutNode>()
        .strength(LAYOUT.chargeStrength)
        .distanceMax(LAYOUT.chargeMax),
    )
    .force(
      "collision",
      forceCollide<LayoutNode>()
        .radius((node) => node.radius + 4)
        .strength(0.8),
    )
    .force("center", forceCenter(0, 0).strength(LAYOUT.centerStrength))
    .force("x", forceX(0).strength(LAYOUT.gravityStrength))
    .force("y", forceY(0).strength(LAYOUT.gravityStrength))
    .force("cluster", clusterForce)
    .velocityDecay(LAYOUT.velocityDecay)
    .alphaDecay(reducedMotion ? LAYOUT.alphaDecayReduced : LAYOUT.alphaDecay)
    .on("tick", onTick)
    .on("end", onEnd);

  if (reducedMotion) {
    simulation.tick(120).stop();
  }

  return { simulation, layoutNodes, layoutLinks, nodeMap };
}
