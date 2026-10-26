/**
 * Community detection — deterministic directory-based clustering.
 * Groups nodes by their top-level directory (or module path prefix).
 * Produces real communities (not individual symbols) for the sidebar.
 */

import type { GraphNode, GraphEdge } from "@/lib/api";
import { CLUSTER_PALETTE } from "./theme";

export interface Community {
  id: string;
  name: string;
  color: string;
  nodeIds: Set<string>;
  nodeCount: number;
}

/**
 * Extract a deterministic cluster key from a node's path.
 * Uses the first meaningful directory segment.
 */
function clusterKeyFromPath(path: string): string {
  const segments = path.replace(/^\/+/, "").split("/");
  // Skip single-file roots; use first directory
  if (segments.length <= 1) return "(root)";
  return segments[0];
}

/**
 * Compute communities by grouping nodes by their directory prefix.
 * Returns sorted communities with deterministic colors from the palette.
 */
export function computeCommunities(
  nodes: GraphNode[],
  _edges: GraphEdge[],
): Community[] {
  const groups = new Map<string, Set<string>>();

  for (const node of nodes) {
    const key = clusterKeyFromPath(node.path);
    let group = groups.get(key);
    if (!group) {
      group = new Set();
      groups.set(key, group);
    }
    group.add(node.id);
  }

  // Sort deterministically by name
  const sorted = Array.from(groups.entries())
    .map(([name, nodeIds]) => ({ name, nodeIds }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return sorted.map((entry, index) => ({
    id: `community-${index}`,
    name: entry.name,
    color: CLUSTER_PALETTE[index % CLUSTER_PALETTE.length],
    nodeIds: entry.nodeIds,
    nodeCount: entry.nodeIds.size,
  }));
}

/**
 * Build a map from nodeId → community for fast lookup.
 */
export function buildNodeCommunityMap(
  communities: Community[],
): Map<string, Community> {
  const map = new Map<string, Community>();
  for (const community of communities) {
    for (const nodeId of community.nodeIds) {
      map.set(nodeId, community);
    }
  }
  return map;
}

/**
 * Build a map from nodeId → cluster index for force layout.
 */
export function buildClusterIndexMap(
  communities: Community[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < communities.length; i++) {
    for (const nodeId of communities[i].nodeIds) {
      map.set(nodeId, i);
    }
  }
  return map;
}
