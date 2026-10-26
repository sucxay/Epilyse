"use client";

/**
 * GraphCanvas — Obsidian-style canvas graph visualization.
 *
 * Replaces React Flow with a custom HTML5 Canvas renderer powered by
 * d3-force for layout.  Single requestAnimationFrame loop, spatial
 * index for hit testing, glow sprites, cursor spotlight, particles.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode, RepositoryGraph } from "@/lib/api";

// Graph modules
import { CLUSTER_PALETTE, CSS_VARS, EDGE_COLORS, INTERACTION, LAYOUT } from "@/lib/graph/theme";
import {
  createSimulation,
  computeDegrees,
  topDegreeNodeIds,
  buildNeighborSet,
  type LayoutNode,
  type SimulationResult,
} from "@/lib/graph/layout";
import {
  computeCommunities,
  buildNodeCommunityMap,
  buildClusterIndexMap,
  type Community,
} from "@/lib/graph/communities";
import { buildLabelCandidates, placeLabels } from "@/lib/graph/labels";
import {
  createGlowSprites,
  renderFrame,
  screenToWorld,
  type CameraState,
  type RenderEdge,
  type RenderState,
} from "@/lib/graph/render";
import { SpatialGrid } from "@/lib/graph/spatial";
import {
  createInteractionState,
  updateCursorSmooth,
  setCursorTarget,
  clearCursor,
  updateHover,
  updateDimProgress,
  addRipple,
  cleanRipples,
  spawnParticles,
  updateParticles,
  handleKeyboard,
  type InteractionState,
} from "@/lib/graph/interaction";

/* ── Types ──────────────────────────────────────────────────────────── */

interface GraphCanvasProps {
  graph: RepositoryGraph | null;
}

type RelationshipType = GraphEdge["type"];
type NodeCategory = GraphNode["type"];

/* ── Helpers ────────────────────────────────────────────────────────── */

function nodeLabel(node: GraphNode): string {
  return node.name ?? node.path.split("/").pop() ?? node.path;
}

/* ── Component ──────────────────────────────────────────────────────── */

function ForceGraph({ graph }: GraphCanvasProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const simRef = useRef<SimulationResult | null>(null);
  const interactionRef = useRef<InteractionState>(createInteractionState());
  const spatialGridRef = useRef(new SpatialGrid());
  const glowSpritesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
  const savedPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const dirtyRef = useRef(true);
  const lastFrameRef = useRef(performance.now());
  const prevLabelsRef = useRef(new Set<string>());
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const reducedMotionRef = useRef(false);

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [dock, setDock] = useState<"left" | "right">("right");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [enabledRelationships, setEnabledRelationships] = useState<Set<RelationshipType>>(
    () => new Set(["import", "calls"]),
  );
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<NodeCategory>>(
    () => new Set(["file", "symbol"]),
  );

  // Derived data
  const allEdges = useMemo(() => graph?.edges ?? [], [graph]);
  const allNodes = useMemo(() => graph?.nodes ?? [], [graph]);

  const degrees = useMemo(() => computeDegrees(allEdges), [allEdges]);
  const topDegreeIds = useMemo(() => topDegreeNodeIds(degrees, 15), [degrees]);

  const communities = useMemo(
    () => computeCommunities(allNodes, allEdges),
    [allNodes, allEdges],
  );
  const nodeCommunityMap = useMemo(
    () => buildNodeCommunityMap(communities),
    [communities],
  );
  const clusterIndexMap = useMemo(
    () => buildClusterIndexMap(communities),
    [communities],
  );

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of allNodes) {
      if (enabledNodeTypes.has(node.type)) ids.add(node.id);
    }
    // Always show selected node
    if (selectedId && !ids.has(selectedId)) {
      const node = allNodes.find((n) => n.id === selectedId);
      if (node) ids.add(node.id);
    }
    return ids;
  }, [allNodes, enabledNodeTypes, selectedId]);

  const visibleNodes = useMemo(
    () => allNodes.filter((n) => visibleNodeIds.has(n.id)),
    [allNodes, visibleNodeIds],
  );

  const activeEdges = useMemo(() => {
    const seen = new Set<string>();
    return allEdges.filter((edge) => {
      if (!enabledRelationships.has(edge.type)) return false;
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
      const key = `${edge.source}|${edge.target}|${edge.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allEdges, enabledRelationships, visibleNodeIds]);

  const renderEdges = useMemo<RenderEdge[]>(
    () => activeEdges.map((e) => ({ sourceId: e.source, targetId: e.target, type: e.type })),
    [activeEdges],
  );

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return new Set<string>();
    return new Set(
      allNodes
        .filter((n) => `${nodeLabel(n)} ${n.path}`.toLowerCase().includes(term))
        .map((n) => n.id),
    );
  }, [allNodes, query]);

  const selectedNode = allNodes.find((n) => n.id === selectedId) ?? null;
  const selectedRelationships = allEdges.filter(
    (e) => e.source === selectedId || e.target === selectedId,
  );

  // Initialize glow sprites and reduced motion detection
  useEffect(() => {
    glowSpritesRef.current = createGlowSprites();
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  // Persist sidebar prefs
  useEffect(() => {
    const saved = window.localStorage.getItem("epilyse-graph-sidebar");
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as {
        width?: number;
        dock?: "left" | "right";
        collapsed?: boolean;
      };
      if (typeof value.width === "number")
        setSidebarWidth(Math.min(380, Math.max(220, value.width)));
      if (value.dock === "left" || value.dock === "right") setDock(value.dock);
      if (typeof value.collapsed === "boolean")
        setSidebarCollapsed(value.collapsed);
    } catch {
      window.localStorage.removeItem("epilyse-graph-sidebar");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "epilyse-graph-sidebar",
      JSON.stringify({ width: sidebarWidth, dock, collapsed: sidebarCollapsed }),
    );
  }, [dock, sidebarCollapsed, sidebarWidth]);

  // Mark dirty when relevant state changes
  useEffect(() => {
    dirtyRef.current = true;
  }, [selectedId, query, enabledRelationships, enabledNodeTypes]);

  // ── Simulation ───────────────────────────────────────────────────
  useEffect(() => {
    if (visibleNodes.length === 0) {
      simRef.current = null;
      dirtyRef.current = true;
      return;
    }

    const onTick = () => {
      dirtyRef.current = true;
    };
    const onEnd = () => {
      setSettled(true);
      const sim = simRef.current;
      if (sim) {
        for (const node of sim.layoutNodes) {
          savedPositionsRef.current.set(node.id, { x: node.x, y: node.y });
        }
      }
      dirtyRef.current = true;
    };

    const result = createSimulation({
      nodes: visibleNodes,
      edges: activeEdges,
      clusterMap: clusterIndexMap,
      degrees,
      savedPositions: savedPositionsRef.current,
      reducedMotion: reducedMotionRef.current,
      onTick,
      onEnd,
    });

    simRef.current = result;
    setSettled(false);
    dirtyRef.current = true;

    // Fit camera after initial settle
    if (!reducedMotionRef.current) {
      setTimeout(() => {
        fitCamera();
      }, 800);
    } else {
      fitCamera();
    }

    return () => {
      for (const node of result.layoutNodes) {
        savedPositionsRef.current.set(node.id, { x: node.x, y: node.y });
      }
      result.simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes.length, activeEdges.length, clusterIndexMap]);

  // ── Camera ───────────────────────────────────────────────────────
  const fitCamera = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.layoutNodes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const node of sim.layoutNodes) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }

    const padding = INTERACTION.focusPadding;
    const graphWidth = (maxX - minX) || 200;
    const graphHeight = (maxY - minY) || 200;
    const zoom = Math.min(
      canvas.width / (graphWidth * padding),
      canvas.height / (graphHeight * padding),
      2.0,
    );

    cameraRef.current = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: Math.max(0.15, zoom),
    };
    dirtyRef.current = true;
  }, []);

  const focusNode = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    const node = sim.nodeMap.get(nodeId);
    if (!node) return;

    cameraRef.current = {
      x: node.x,
      y: node.y,
      zoom: Math.max(cameraRef.current.zoom, 1.0),
    };
    dirtyRef.current = true;
  }, []);

  // ── Search: fly to first match ───────────────────────────────────
  useEffect(() => {
    if (matches.size === 0) return;
    const firstMatchId = Array.from(matches).sort()[0];
    if (!firstMatchId) return;
    setSelectedId(firstMatchId);
    focusNode(firstMatchId);
  }, [matches, focusNode]);

  // ── Render loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(now - lastFrameRef.current, 50);
      lastFrameRef.current = now;

      const sim = simRef.current;
      const interaction = interactionRef.current;

      // Update interaction
      updateCursorSmooth(interaction);
      updateHover(interaction, spatialGridRef.current, cameraRef.current);
      const allNodeIds = sim?.layoutNodes.map((n) => n.id) ?? [];
      updateDimProgress(interaction, allNodeIds, dt);
      updateParticles(interaction, dt);
      cleanRipples(interaction, now);

      // Check if anything is animating
      const isAnimating =
        interaction.cursor !== null ||
        interaction.ripples.length > 0 ||
        interaction.particles.length > 0 ||
        !settled ||
        Array.from(interaction.dimProgress.values()).some(
          (v) => v > 0.01 && v < 0.99,
        );

      if (!dirtyRef.current && !isAnimating) return;
      dirtyRef.current = false;

      // Resize canvas
      const dpr = window.devicePixelRatio ?? 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width * dpr;
      const height = rect.height * dpr;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Rebuild spatial grid
      if (sim) {
        spatialGridRef.current.rebuild(
          sim.layoutNodes
            .filter((n) => visibleNodeIds.has(n.id))
            .map((n) => ({
              id: n.id,
              x: n.x,
              y: n.y,
              radius: n.radius,
            })),
        );
      }

      // Build neighbor set
      const focusId = interaction.hoveredId ?? interaction.selectedId;
      interaction.neighborIds = buildNeighborSet(focusId, activeEdges);

      // Spawn particles on focus change
      spawnParticles(interaction, renderEdges);

      // Near-cursor node IDs
      const nearCursorIds = new Set<string>();
      if (interaction.cursor) {
        const nearby = spatialGridRef.current.queryRadius(
          interaction.cursor.smoothX,
          interaction.cursor.smoothY,
          140 / cameraRef.current.zoom,
        );
        for (const p of nearby) nearCursorIds.add(p.id);
      }

      // Label placement
      const layoutNodes = sim?.layoutNodes ?? [];
      const labelNodes = layoutNodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        label: nodeLabel(n),
        radius: n.radius,
        visible: visibleNodeIds.has(n.id),
        dimmed: (interaction.dimProgress.get(n.id) ?? 0) > 0.5,
      }));

      const candidates = buildLabelCandidates(
        labelNodes,
        interaction.selectedId,
        interaction.hoveredId,
        nearCursorIds,
        topDegreeIds,
        interaction.neighborIds,
        degrees,
      );
      const labels = placeLabels(candidates, cameraRef.current.zoom, prevLabelsRef.current);
      prevLabelsRef.current = new Set(labels.map((l) => l.id));

      // Build render state
      const state: RenderState = {
        nodes: layoutNodes,
        edges: renderEdges,
        labels,
        camera: cameraRef.current,
        cursor: interaction.cursor,
        hoveredId: interaction.hoveredId,
        selectedId: interaction.selectedId,
        neighborIds: interaction.neighborIds,
        nodeCommunityMap,
        degrees,
        ripples: interaction.ripples,
        particles: interaction.particles,
        dimProgress: interaction.dimProgress,
        highlightedEdgeIndices: interaction.highlightedEdgeIndices,
        settled,
        reducedMotion: reducedMotionRef.current,
        visibleNodeIds,
        glowSprites: glowSpritesRef.current,
        dimmedNodeIds: new Set(
          allNodeIds.filter((id) => (interaction.dimProgress.get(id) ?? 0) > 0.5),
        ),
      };

      renderFrame(ctx, state, rect.width, rect.height, now);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [
    activeEdges,
    degrees,
    nodeCommunityMap,
    renderEdges,
    settled,
    topDegreeIds,
    visibleNodeIds,
  ]);

  // ── Pointer handlers ─────────────────────────────────────────────
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, cameraRef.current, rect.width, rect.height);

      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        cameraRef.current = {
          ...cameraRef.current,
          x: panStartRef.current.camX - dx / cameraRef.current.zoom,
          y: panStartRef.current.camY - dy / cameraRef.current.zoom,
        };
        dirtyRef.current = true;
        return;
      }

      // Drag node
      const interaction = interactionRef.current;
      if (interaction.isDragging && interaction.dragNodeId) {
        const sim = simRef.current;
        if (sim) {
          const node = sim.nodeMap.get(interaction.dragNodeId);
          if (node) {
            node.fx = world.x;
            node.fy = world.y;
            node.x = world.x;
            node.y = world.y;
            sim.simulation.alpha(0.1).restart();
            dirtyRef.current = true;
          }
        }
        return;
      }

      setCursorTarget(interaction, world.x, world.y);
      dirtyRef.current = true;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, cameraRef.current, rect.width, rect.height);

      const interaction = interactionRef.current;

      // Check if clicking a node
      const nearest = spatialGridRef.current.nearest(
        world.x,
        world.y,
        INTERACTION.hitRadius / cameraRef.current.zoom,
      );

      if (nearest) {
        // Start dragging
        interaction.isDragging = true;
        interaction.dragNodeId = nearest.id;
        const sim = simRef.current;
        if (sim) {
          const node = sim.nodeMap.get(nearest.id);
          if (node) {
            node.fx = node.x;
            node.fy = node.y;
            sim.simulation.alphaTarget(LAYOUT.reheatAlpha).restart();
          }
        }
        canvas.setPointerCapture(e.pointerId);
      } else {
        // Start panning
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          camX: cameraRef.current.x,
          camY: cameraRef.current.y,
        };
        canvas.setPointerCapture(e.pointerId);
      }
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, cameraRef.current, rect.width, rect.height);

      const interaction = interactionRef.current;

      if (interaction.isDragging && interaction.dragNodeId) {
        const sim = simRef.current;
        if (sim) {
          const node = sim.nodeMap.get(interaction.dragNodeId);
          if (node) {
            node.fx = null;
            node.fy = null;
            sim.simulation.alphaTarget(0).restart();
          }
        }

        // If we didn't move much, treat as click
        const draggedNode = simRef.current?.nodeMap.get(interaction.dragNodeId);
        if (draggedNode) {
          const community = nodeCommunityMap.get(interaction.dragNodeId);
          interaction.selectedId = interaction.dragNodeId;
          setSelectedId(interaction.dragNodeId);
          addRipple(interaction, draggedNode.x, draggedNode.y, community?.color ?? "#6c8cff");
        }

        interaction.isDragging = false;
        interaction.dragNodeId = null;
        canvas.releasePointerCapture(e.pointerId);
        dirtyRef.current = true;
        return;
      }

      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.releasePointerCapture(e.pointerId);

        // If didn't move much, treat as pane click (deselect)
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          interaction.selectedId = null;
          setSelectedId(null);
          dirtyRef.current = true;
        }
        return;
      }
    },
    [nodeCommunityMap],
  );

  const handlePointerLeave = useCallback(() => {
    clearCursor(interactionRef.current);
    dirtyRef.current = true;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const camera = cameraRef.current;
    const worldBefore = screenToWorld(sx, sy, camera, rect.width, rect.height);

    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = Math.max(0.1, Math.min(4, camera.zoom * zoomFactor));

    // Zoom toward cursor
    const worldAfter = screenToWorld(sx, sy, { ...camera, zoom: newZoom }, rect.width, rect.height);
    cameraRef.current = {
      x: camera.x + (worldBefore.x - worldAfter.x),
      y: camera.y + (worldBefore.y - worldAfter.y),
      zoom: newZoom,
    };
    dirtyRef.current = true;
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (!sim) return;
      const handled = handleKeyboard(
        e,
        interactionRef.current,
        sim.layoutNodes,
        renderEdges,
        (id) => {
          setSelectedId(id);
          dirtyRef.current = true;
        },
        focusNode,
      );
      if (handled) {
        dirtyRef.current = true;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [renderEdges, focusNode]);

  // ── Toggle helpers ───────────────────────────────────────────────
  const toggleSet = <T extends string>(
    setter: React.Dispatch<React.SetStateAction<Set<T>>>,
    value: T,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const resetLayout = useCallback(() => {
    savedPositionsRef.current.clear();
    const sim = simRef.current;
    if (sim) {
      sim.simulation.alpha(0.8).restart();
      setTimeout(() => fitCamera(), 500);
    }
  }, [fitCamera]);

  const resizeSidebar = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const delta = dock === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      setSidebarWidth(Math.min(380, Math.max(220, startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const focusCommunity = useCallback(
    (community: Community) => {
      if (!simRef.current) return;
      const nodes = simRef.current.layoutNodes.filter((n) =>
        community.nodeIds.has(n.id),
      );
      if (nodes.length === 0) return;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const node of nodes) {
        if (node.x < minX) minX = node.x;
        if (node.x > maxX) maxX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.y > maxY) maxY = node.y;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const graphWidth = (maxX - minX) || 200;
      const graphHeight = (maxY - minY) || 200;
      const zoom = Math.min(
        rect.width / (graphWidth * 1.8),
        rect.height / (graphHeight * 1.8),
        2.0,
      );

      cameraRef.current = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        zoom: Math.max(0.2, zoom),
      };
      dirtyRef.current = true;
    },
    [],
  );

  // ── Sidebar ──────────────────────────────────────────────────────
  const sidebar = (
    <aside
      style={{
        width: sidebarCollapsed ? 48 : sidebarWidth,
        background: "var(--graph-sidebar-bg)",
        borderColor: "var(--graph-sidebar-border)",
        backdropFilter: `blur(var(--graph-glass-blur))`,
        WebkitBackdropFilter: `blur(var(--graph-glass-blur))`,
      }}
      className={`graph-sidebar relative shrink-0 ${
        dock === "left" ? "border-r" : "border-l"
      } transition-[width] duration-200`}
    >
      <div className="graph-sidebar-header flex items-center justify-between border-b p-3"
        style={{ borderColor: "var(--graph-sidebar-border)" }}
      >
        {!sidebarCollapsed && (
          <span className="graph-sidebar-title text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "rgba(160,170,200,0.7)" }}
          >
            Explorer
          </span>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="graph-btn-collapse rounded p-1 transition-colors hover:bg-white/5"
          style={{ color: "rgba(160,170,200,0.6)" }}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="graph-sidebar-content space-y-5 overflow-y-auto p-4 text-xs"
          style={{ color: "rgba(200,210,230,0.8)", maxHeight: "calc(100% - 48px)" }}
        >
          {/* Search */}
          <label className="block">
            <span className="graph-label mb-2 block font-semibold"
              style={{ color: "rgba(160,170,200,0.6)" }}
            >
              Search code
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Path, class, function…"
              className="graph-search-input w-full rounded-lg px-3 py-2 text-xs outline-none transition-all focus:ring-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(220,225,240,0.92)",
                caretColor: "#6c8cff",
              }}
            />
          </label>

          {/* Node categories */}
          <fieldset>
            <legend className="graph-label mb-2 font-semibold"
              style={{ color: "rgba(160,170,200,0.6)" }}
            >
              Node categories
            </legend>
            {(["file", "symbol"] as NodeCategory[]).map((type) => (
              <label key={type} className="mb-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledNodeTypes.has(type)}
                  onChange={() => toggleSet(setEnabledNodeTypes, type)}
                  className="graph-checkbox h-3.5 w-3.5 rounded"
                  style={{ accentColor: "#6c8cff" }}
                />
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: type === "file" ? CLUSTER_PALETTE[0] : CLUSTER_PALETTE[1],
                  }}
                />
                <span>{type === "symbol" ? "Classes & functions" : "Files"}</span>
              </label>
            ))}
          </fieldset>

          {/* Relationships */}
          <fieldset>
            <legend className="graph-label mb-2 font-semibold"
              style={{ color: "rgba(160,170,200,0.6)" }}
            >
              Relationships
            </legend>
            {(["import", "contains", "calls"] as RelationshipType[]).map((type) => (
              <label key={type} className="mb-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledRelationships.has(type)}
                  onChange={() => toggleSet(setEnabledRelationships, type)}
                  className="graph-checkbox"
                  style={{ accentColor: EDGE_COLORS[type] }}
                />
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ background: EDGE_COLORS[type] }}
                />
                <span className="uppercase tracking-wide">{type}</span>
              </label>
            ))}
          </fieldset>

          {/* Communities */}
          {communities.length > 0 && (
            <fieldset
              className="border-t pt-4"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <legend className="graph-label mb-3 font-semibold uppercase tracking-[0.1em]"
                style={{ color: "rgba(160,170,200,0.6)" }}
              >
                Communities
              </legend>
              {communities.map((community) => (
                <button
                  type="button"
                  key={community.id}
                  onClick={() => focusCommunity(community)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: community.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{community.name}</span>
                  <span style={{ color: "rgba(160,170,200,0.4)" }}>
                    {community.nodeCount}
                  </span>
                </button>
              ))}
            </fieldset>
          )}

          {/* View controls */}
          <div
            className="border-t pt-4 space-y-2"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <p className="graph-label font-semibold"
              style={{ color: "rgba(160,170,200,0.6)" }}
            >
              View
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDock((v) => (v === "left" ? "right" : "left"))}
                className="graph-btn rounded-md px-2.5 py-1.5"
              >
                Dock {dock === "left" ? "right" : "left"}
              </button>
              <button
                type="button"
                onClick={resetLayout}
                className="graph-btn rounded-md px-2.5 py-1.5"
              >
                Reset layout
              </button>
              <button
                type="button"
                onClick={fitCamera}
                className="graph-btn rounded-md px-2.5 py-1.5"
              >
                Fit
              </button>
            </div>
          </div>

          {/* Legend */}
          <div
            className="border-t pt-4"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <p className="graph-label mb-2 font-semibold"
              style={{ color: "rgba(160,170,200,0.6)" }}
            >
              Legend
            </p>
            <div className="space-y-1">
              <p className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: CLUSTER_PALETTE[0] }} />
                Files / modules
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: CLUSTER_PALETTE[1] }} />
                Symbols
              </p>
            </div>
            <div className="mt-3 space-y-1">
              {(["import", "contains", "calls"] as RelationshipType[]).map((type) => (
                <p key={type} className="flex items-center gap-2">
                  <span className="h-0.5 w-4" style={{ background: EDGE_COLORS[type] }} />
                  <span className="uppercase tracking-wide">{type}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!sidebarCollapsed && (
        <div
          onPointerDown={resizeSidebar}
          className={`absolute top-0 ${
            dock === "left" ? "-right-1" : "-left-1"
          } z-20 h-full w-2 cursor-col-resize`}
          aria-label="Resize graph sidebar"
        />
      )}
    </aside>
  );

  // ── Selected node info panel ─────────────────────────────────────
  const infoPanel = selectedNode && (
    <aside
      className="graph-info-panel absolute right-4 top-4 z-10 w-64 rounded-xl p-4 shadow-2xl"
      style={{
        background: "var(--graph-sidebar-bg)",
        border: "1px solid var(--graph-sidebar-border)",
        backdropFilter: `blur(var(--graph-glass-blur))`,
        WebkitBackdropFilter: `blur(var(--graph-glass-blur))`,
      }}
      aria-live="polite"
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ color: "rgba(160,170,200,0.5)" }}
      >
        Selected node
      </p>
      <h2
        className="mt-2 break-words text-sm font-bold"
        style={{ color: "rgba(220,225,240,0.95)" }}
      >
        {nodeLabel(selectedNode)}
      </h2>
      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between gap-3">
          <dt style={{ color: "rgba(160,170,200,0.5)" }}>Type</dt>
          <dd style={{ color: "rgba(200,210,230,0.85)" }}>
            {selectedNode.kind ?? selectedNode.type}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt style={{ color: "rgba(160,170,200,0.5)" }}>Path</dt>
          <dd
            className="break-all text-right"
            style={{ color: "rgba(200,210,230,0.7)" }}
          >
            {selectedNode.path}
          </dd>
        </div>
        {selectedNode.line !== null && (
          <div className="flex justify-between gap-3">
            <dt style={{ color: "rgba(160,170,200,0.5)" }}>Lines</dt>
            <dd style={{ color: "rgba(200,210,230,0.85)" }}>
              {selectedNode.line}–{selectedNode.end_line}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt style={{ color: "rgba(160,170,200,0.5)" }}>Connections</dt>
          <dd style={{ color: "rgba(200,210,230,0.85)" }}>
            {selectedRelationships.length}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt style={{ color: "rgba(160,170,200,0.5)" }}>Community</dt>
          <dd className="flex items-center gap-1.5" style={{ color: "rgba(200,210,230,0.85)" }}>
            <span
              className="h-2 w-2 rounded-full inline-block"
              style={{ background: nodeCommunityMap.get(selectedId ?? "")?.color ?? "#6c8cff" }}
            />
            {nodeCommunityMap.get(selectedId ?? "")?.name ?? "—"}
          </dd>
        </div>
      </dl>
    </aside>
  );

  // ── Main render ──────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="graph-container flex overflow-hidden rounded-2xl shadow-2xl"
      style={{
        ...CSS_VARS,
        minHeight: 700,
        flexDirection: dock === "right" ? "row-reverse" : "row",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "var(--graph-bg)",
      } as React.CSSProperties}
    >
      {sidebar}
      <section className="min-w-0 flex-1 relative">
        {/* Status bar */}
        <div
          className="graph-statusbar flex h-10 items-center justify-between px-4"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(8,10,22,0.6)",
          }}
        >
          <span className="text-[11px]" style={{ color: "rgba(160,170,200,0.4)" }}>
            {visibleNodeIds.size} nodes · {activeEdges.length} edges
            {communities.length > 0 ? ` · ${communities.length} clusters` : ""}
          </span>
          <span className="text-[11px]" style={{ color: "rgba(160,170,200,0.3)" }}>
            {settled ? "Settled" : "Simulating…"} · zoom{" "}
            {cameraRef.current.zoom.toFixed(1)}×
          </span>
        </div>

        {/* Canvas */}
        <div className="relative" style={{ height: "calc(100% - 40px)" }}>
          <canvas
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onWheel={handleWheel}
            className="graph-canvas block h-full w-full"
            style={{ cursor: interactionRef.current.hoveredId ? "pointer" : "grab" }}
            aria-label="Interactive repository dependency graph"
            tabIndex={0}
          />

          {/* Empty states */}
          {!graph && (
            <div
              className="absolute inset-0 grid place-items-center text-center text-sm"
              style={{ color: "rgba(160,170,200,0.4)" }}
            >
              Analyze a repository to explore its source-backed graph.
            </div>
          )}
          {graph && allNodes.length === 0 && (
            <div
              className="absolute inset-0 grid place-items-center text-sm"
              style={{ color: "rgba(160,170,200,0.4)" }}
            >
              No supported source nodes were found.
            </div>
          )}

          {/* Info panel */}
          {infoPanel}
        </div>
      </section>
    </div>
  );
}

export function GraphCanvas({ graph }: GraphCanvasProps) {
  return <ForceGraph graph={graph} />;
}
