"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import type { Edge, Node, NodeProps, OnNodeDrag } from "@xyflow/react";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import "@xyflow/react/dist/style.css";
import type { GraphEdge, GraphNode, RepositoryGraph } from "@/lib/api";

interface GraphCanvasProps {
  graph: RepositoryGraph | null;
}

type RelationshipType = GraphEdge["type"];
type NodeCategory = GraphNode["type"];
type SimulationNode = GraphNode & {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};
type SimulationLink = {
  source: string | SimulationNode;
  target: string | SimulationNode;
  type: RelationshipType;
};
type DotData = {
  label: string;
  kind: string;
  color: string;
  radius: number;
  showLabel: boolean;
  selected: boolean;
};

const relationshipTypes: RelationshipType[] = ["import", "contains", "calls"];
const relationshipColors: Record<RelationshipType, string> = {
  import: "#91a4bc",
  contains: "#d78b68",
  calls: "#6fb8aa",
};
const nodeColors: Record<NodeCategory, string> = {
  file: "#334155",
  symbol: "#d78b68",
};
const symbolKindColors: Record<string, string> = {
  class: "#f3cf45",
  function: "#73b9ae",
  method: "#e47783",
};

function nodeLabel(node: GraphNode): string {
  return node.name ?? node.path;
}

function colorForNode(node: GraphNode): string {
  return node.type === "symbol" && node.kind
    ? symbolKindColors[node.kind] ?? nodeColors.symbol
    : nodeColors[node.type];
}

function deterministicPosition(index: number, count: number): { x: number; y: number } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  return {
    x: (index % columns - (columns - 1) / 2) * 240,
    y: (Math.floor(index / columns) - Math.floor(count / columns) / 2) * 170,
  };
}

function DotNode({ data }: NodeProps<Node<DotData>>) {
  return (
    <div className="group relative flex items-center justify-center" title={data.label}>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1 !w-1 !border-0 !bg-transparent"
        aria-label={`${data.label} incoming connection`}
      />
      <span
        className="block rounded-full border-2 shadow-[0_0_14px_rgba(255,255,255,0.1)] transition-transform group-hover:scale-125"
        style={{
          width: data.radius,
          height: data.radius,
          backgroundColor: data.color,
          borderColor: data.selected ? "#fff7ed" : `${data.color}cc`,
          boxShadow: data.selected ? `0 0 0 4px ${data.color}44, 0 0 20px ${data.color}99` : undefined,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1 !w-1 !border-0 !bg-transparent"
        aria-label={`${data.label} outgoing connection`}
      />
      {data.showLabel && (
        <span className="pointer-events-none absolute left-1/2 top-full mt-1 max-w-44 -translate-x-1/2 truncate whitespace-nowrap text-[10px] font-medium text-slate-200">
          {data.label}
        </span>
      )}
    </div>
  );
}

const nodeTypes = { dot: DotNode };

function ForceGraph({ graph }: GraphCanvasProps) {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const graphRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<Simulation<SimulationNode, SimulationLink> | null>(null);
  const simNodesRef = useRef<SimulationNode[]>([]);
  const nodeMapRef = useRef(new Map<string, SimulationNode>());
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const pausedRef = useRef(false);
  const cursorPhysicsRef = useRef(false);
  const renderStateRef = useRef({ selectedId: null as string | null, query: "", zoom: 0.85 });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(252);
  const [dock, setDock] = useState<"left" | "right">("right");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const [cursorPhysics, setCursorPhysics] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => new Set());
  const [enabledRelationships, setEnabledRelationships] = useState<Set<RelationshipType>>(
    () => new Set(["import"]),
  );
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<NodeCategory>>(
    () => new Set(["file"]),
  );
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [settled, setSettled] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("epilyse-graph-sidebar");
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as { width?: number; dock?: "left" | "right"; collapsed?: boolean };
      if (typeof value.width === "number") setSidebarWidth(Math.min(380, Math.max(220, value.width)));
      if (value.dock === "left" || value.dock === "right") setDock(value.dock);
      if (typeof value.collapsed === "boolean") setSidebarCollapsed(value.collapsed);
    } catch {
      window.localStorage.removeItem("epilyse-graph-sidebar");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("epilyse-graph-sidebar", JSON.stringify({
      width: sidebarWidth,
      dock,
      collapsed: sidebarCollapsed,
    }));
  }, [dock, sidebarCollapsed, sidebarWidth]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === graphRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const allEdges = useMemo(() => graph?.edges ?? [], [graph]);
  const graphNodeIds = useMemo(
    () => new Set(graph?.nodes.map((node) => node.id) ?? []),
    [graph],
  );
  const invalidEdges = useMemo(
    () => allEdges.filter((edge) => !graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target)),
    [allEdges, graphNodeIds],
  );
  const selectedNode = graph?.nodes.find((node) => node.id === selectedId) ?? null;
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    graph?.nodes.forEach((node) => {
      if (!enabledNodeTypes.has(node.type)) return;
      ids.add(node.id);
    });
    if (selectedNode?.type === "symbol") ids.add(selectedNode.id);
    return ids;
  }, [enabledNodeTypes, graph, selectedNode]);

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

  const neighbors = useMemo(() => {
    const result = new Set<string>();
    const focusId = selectedId ?? hoveredId;
    if (!focusId) return result;
    result.add(focusId);
    allEdges.forEach((edge) => {
      if (edge.source === focusId) result.add(edge.target);
      if (edge.target === focusId) result.add(edge.source);
    });
    return result;
  }, [allEdges, hoveredId, selectedId]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return new Set(
      graph?.nodes
        .filter((node) => term && `${nodeLabel(node)} ${node.path}`.toLowerCase().includes(term))
        .map((node) => node.id) ?? [],
    );
  }, [graph, query]);

  useEffect(() => {
    const term = query.trim();
    if (!term || matches.size === 0 || !graph) return;
    const matchingNodes = graph.nodes.filter((node) => matches.has(node.id));
    const firstMatch = matchingNodes[0];
    if (!firstMatch) return;
    setEnabledNodeTypes((current) => {
      if (current.has(firstMatch.type)) return current;
      return new Set(current).add(firstMatch.type);
    });
    setSelectedId(firstMatch.id);
    window.requestAnimationFrame(() => fitView({ nodes: [{ id: firstMatch.id }], padding: 0.7, duration: 250 }));
  }, [fitView, graph, matches, query]);

  renderStateRef.current = { selectedId: selectedId ?? hoveredId, query, zoom };
  pausedRef.current = paused;
  cursorPhysicsRef.current = cursorPhysics;

  const requestRender = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const { selectedId: selected, query: search, zoom: currentZoom } = renderStateRef.current;
      const term = search.trim();
      setNodes(simNodesRef.current.map((node) => {
        const isRelated = !selected || neighbors.has(node.id);
        const isMatch = !term || matches.has(node.id);
        const radius = node.type === "file" ? 13 : 5 + Math.min(5, allEdges.filter((edge) => edge.source === node.id || edge.target === node.id).length);
        return {
          id: node.id,
          type: "dot",
          data: {
            label: nodeLabel(node),
            kind: node.kind ?? node.type,
            color: colorForNode(node),
            radius,
            showLabel: currentZoom > 0.72 || node.id === selected || matches.has(node.id),
            selected: node.id === selected,
          },
          position: { x: node.x, y: node.y },
          draggable: true,
          hidden: !visibleNodeIds.has(node.id),
          className: isRelated && isMatch ? "opacity-100" : "opacity-20",
        };
      }));
    });
  }, [allEdges, matches, neighbors, visibleNodeIds]);

  const renderEdges = useCallback(() => {
    setEdges(activeEdges.map((edge, index) => {
      const focusId = selectedId ?? hoveredId;
      const connected = !focusId || edge.source === focusId || edge.target === focusId;
      return {
        id: `${edge.source}-${edge.target}-${edge.type}-${index}`,
        source: edge.source,
        target: edge.target,
        label: zoom > 1.25 && connected ? edge.type.toUpperCase() : undefined,
        animated: false,
        style: {
          stroke: relationshipColors[edge.type],
          strokeWidth: connected ? 1.2 : 0.7,
          opacity: connected ? 0.65 : 0.1,
        },
        labelStyle: { fill: relationshipColors[edge.type], fontSize: 8, fontWeight: 700 },
      };
    }));
  }, [activeEdges, hoveredId, selectedId, zoom]);

  const architectureSignature = useMemo(
    () => `${Array.from(visibleNodeIds).sort().join("|")}::${activeEdges.map((edge) => `${edge.source}-${edge.target}-${edge.type}`).sort().join("|")}`,
    [activeEdges, visibleNodeIds],
  );

  // This effect is intentionally keyed only by the visible graph signature.
  // Search, selection, zoom, and cursor movement never recreate physics.
  useEffect(() => {
    const positions = positionsRef.current;
    simulationRef.current?.stop();
    simNodesRef.current = [];
    nodeMapRef.current.clear();
    setSettled(false);
    if (!graph || visibleNodeIds.size === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const sourceNodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id));
    const simulationNodes = sourceNodes.map((node, index) => {
      const saved = positionsRef.current.get(node.id) ?? deterministicPosition(index, sourceNodes.length);
      const simulationNode = { ...node, ...saved };
      simNodesRef.current.push(simulationNode);
      nodeMapRef.current.set(node.id, simulationNode);
      return simulationNode;
    });
    const links: SimulationLink[] = activeEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }));
    const pointerForce = (alpha: number) => {
      const pointer = pointerRef.current;
      if (!pointer || pausedRef.current || !cursorPhysicsRef.current) return;
      simNodesRef.current.forEach((node) => {
        const dx = node.x - pointer.x;
        const dy = node.y - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        if (distance < 95) {
              const strength = ((95 - distance) / 95) * Math.min(alpha, 0.04) * 0.12;
          node.vx = (node.vx ?? 0) + (dx / distance) * strength;
          node.vy = (node.vy ?? 0) + (dy / distance) * strength;
        }
      });
    };
    const boundsForce = () => {
      const width = Math.max(500, (graphRef.current?.clientWidth ?? 900) / 1.1);
      const height = Math.max(420, (graphRef.current?.clientHeight ?? 650) / 1.1);
      const xLimit = width / 2;
      const yLimit = height / 2;
      simNodesRef.current.forEach((node) => {
        if (node.x < -xLimit) node.vx = Math.max(node.vx ?? 0, (-xLimit - node.x) * 0.08);
        if (node.x > xLimit) node.vx = Math.min(node.vx ?? 0, (xLimit - node.x) * 0.08);
        if (node.y < -yLimit) node.vy = Math.max(node.vy ?? 0, (-yLimit - node.y) * 0.08);
        if (node.y > yLimit) node.vy = Math.min(node.vy ?? 0, (yLimit - node.y) * 0.08);
      });
    };
    const simulation = forceSimulation<SimulationNode>(simulationNodes)
      .force("link", forceLink<SimulationNode, SimulationLink>(links)
        .id((node) => node.id)
        .distance((link) => link.type === "import" ? 190 : 120)
        .strength(0.42))
      .force("charge", forceManyBody<SimulationNode>().strength(-300).distanceMax(850))
      .force("collision", forceCollide<SimulationNode>().radius((node) => node.type === "file" ? 32 : 24).strength(0.9))
      .force("center", forceCenter(0, 0).strength(0.05))
      .force("x", forceX(0).strength(0.018))
      .force("y", forceY(0).strength(0.018))
      .force("pointer", pointerForce)
      .force("bounds", boundsForce)
      .velocityDecay(0.62)
      .alphaDecay(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.2 : 0.04)
      .on("tick", requestRender)
      .on("end", () => {
        simNodesRef.current.forEach((node) => positionsRef.current.set(node.id, { x: node.x, y: node.y }));
        setSettled(true);
        requestRender();
      });
    simulationRef.current = simulation;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      simulation.tick(100).stop();
      setSettled(true);
    } else if (!paused) {
      simulation.restart();
    }
    renderEdges();
    requestRender();
    return () => {
      simulationNodes.forEach((node) => positions.set(node.id, { x: node.x, y: node.y }));
      simulation.stop();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [architectureSignature, graph, requestRender]);

  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    const linkForce = simulation.force("link") as ReturnType<typeof forceLink<SimulationNode, SimulationLink>> | undefined;
    linkForce?.links(activeEdges.map((edge) => ({ source: edge.source, target: edge.target, type: edge.type })));
    renderEdges();
    requestRender();
  }, [activeEdges, renderEdges, requestRender]);

  useEffect(() => {
    if (paused) simulationRef.current?.stop();
    else simulationRef.current?.alphaTarget(0).restart();
  }, [paused]);

  useEffect(() => {
    if (cursorPhysics && !paused) {
      simulationRef.current?.alpha(Math.max(simulationRef.current.alpha(), 0.04)).restart();
    }
  }, [cursorPhysics, paused]);

  const resetLayout = useCallback(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    positionsRef.current.clear();
    simNodesRef.current.forEach((node, index, all) => {
      const position = deterministicPosition(index, all.length);
      node.x = position.x;
      node.y = position.y;
      node.vx = 0;
      node.vy = 0;
    });
    setSettled(false);
    simulation.alpha(0.8).restart();
    window.setTimeout(() => fitView({ padding: 0.25, duration: 350 }), 350);
  }, [fitView]);

  const setPinnedPosition = useCallback((node: Node) => {
    const simulationNode = nodeMapRef.current.get(node.id);
    if (!simulationNode) return;
    simulationNode.fx = node.position.x;
    simulationNode.fy = node.position.y;
  }, []);
  const startDrag: OnNodeDrag = useCallback((_, node) => {
    setPinnedPosition(node);
    simulationRef.current?.alphaTarget(0.12).restart();
  }, [setPinnedPosition]);
  const moveDrag: OnNodeDrag = useCallback((_, node) => setPinnedPosition(node), [setPinnedPosition]);
  const stopDrag: OnNodeDrag = useCallback((_, node) => {
    setPinnedPosition(node);
    const simulationNode = nodeMapRef.current.get(node.id);
    if (simulationNode) {
      simulationNode.fx = null;
      simulationNode.fy = null;
    }
    simulationRef.current?.alphaTarget(0).restart();
  }, [setPinnedPosition]);
  const pointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
  }, [screenToFlowPosition]);

  useEffect(() => {
    const observer = new ResizeObserver(() => requestRender());
    if (graphRef.current) observer.observe(graphRef.current);
    return () => observer.disconnect();
  }, [requestRender]);

  const toggleSet = <T extends string>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleFileSymbols = (path: string) => {
    const isExpanded = expandedFiles.has(path);
    setExpandedFiles((current) => {
      const next = new Set(current);
      if (isExpanded) next.delete(path);
      else next.add(path);
      return next;
    });
    if (!isExpanded) {
      // Symbol visibility remains controlled by the sidebar checkbox.
      // Expanding a file only marks its scope for progressive exploration.
    }
  };

  const toggleFullscreen = async () => {
    if (!graphRef.current) return;
    setFullscreenError(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (graphRef.current.requestFullscreen) await graphRef.current.requestFullscreen();
      else setFullscreenError("Fullscreen is not supported by this browser.");
    } catch {
      setFullscreenError("Fullscreen could not be enabled.");
    }
  };

  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => {
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

  const selectedRelationships = allEdges.filter((edge) => edge.source === selectedId || edge.target === selectedId);
  const communities = useMemo(() => {
    const counts = new Map<string, number>();
    graph?.nodes
      .filter((node) => node.type === "symbol" && node.name)
      .forEach((node) => {
        const name = node.name?.split(".")[0] ?? "symbols";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16);
  }, [graph]);
  const sidebar = (
    <aside style={{ width: sidebarCollapsed ? 48 : sidebarWidth }} className={`relative shrink-0 ${dock === "left" ? "border-r" : "border-l"} border-slate-800 bg-slate-900/95 transition-[width]`}>
      <div className="flex items-center justify-between border-b border-slate-800 p-3">
        {!sidebarCollapsed && <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Communities</span>}
        <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "›" : "‹"}</button>
      </div>
      {!sidebarCollapsed && (
        <div className="space-y-5 overflow-y-auto p-4 text-xs text-slate-300">
          <label className="block"><span className="mb-2 block font-semibold text-slate-400">Search code</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Path, class, function…" className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none ring-orange-300 placeholder:text-slate-600 focus:ring-2" /></label>
          <fieldset><legend className="mb-2 font-semibold text-slate-400">Node categories</legend>{(["file", "symbol"] as NodeCategory[]).map((type) => <label key={type} className="mb-2 flex items-center gap-2"><input type="checkbox" checked={enabledNodeTypes.has(type)} onChange={() => toggleSet(setEnabledNodeTypes, type)} className="h-4 w-4 accent-sky-400" /><i className="h-2.5 w-2.5 rounded-full" style={{ background: nodeColors[type] }} />{type === "symbol" ? "Classes & functions" : "Files"}</label>)}</fieldset>
          <fieldset><legend className="mb-2 font-semibold text-slate-400">Relationships</legend>{relationshipTypes.map((type) => <label key={type} className="mb-2 flex items-center gap-2"><input type="checkbox" checked={enabledRelationships.has(type)} onChange={() => toggleSet(setEnabledRelationships, type)} className="accent-orange-400" /><i className="h-0.5 w-3" style={{ background: relationshipColors[type] }} />{type.toUpperCase()}</label>)}</fieldset>
          {communities.length > 0 && <fieldset className="border-t border-slate-800 pt-4"><legend className="mb-2 font-semibold uppercase tracking-[0.1em] text-slate-400">Communities</legend><label className="mb-3 flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={enabledNodeTypes.has("symbol")} onChange={() => toggleSet<NodeCategory>(setEnabledNodeTypes, "symbol")} className="h-4 w-4 accent-sky-400" />Select all symbols</label>{communities.map(([name, count], index) => <button type="button" key={name} onClick={() => { setQuery(name); setEnabledNodeTypes((current) => new Set<NodeCategory>(current).add("symbol")); }} className="flex w-full items-center gap-2 py-1 text-left text-slate-300 hover:text-white"><span className="h-3 w-3 rounded-full" style={{ background: Object.values(symbolKindColors)[index % 3] }} /><span className="min-w-0 flex-1 truncate">{name}</span><span className="text-slate-500">{count}</span></button>)}</fieldset>}
          <div className="border-t border-slate-800 pt-4"><p className="mb-2 font-semibold text-slate-400">View</p><button type="button" onClick={() => setDock((value) => value === "left" ? "right" : "left")} className="mr-2 rounded border border-slate-700 px-2 py-1.5 text-slate-300 hover:bg-slate-800">Dock {dock === "left" ? "right" : "left"}</button><button type="button" onClick={() => setCursorPhysics((value) => !value)} className={`rounded border px-2 py-1.5 ${cursorPhysics ? "border-teal-400/60 text-teal-200" : "border-slate-700 text-slate-300"}`}>{cursorPhysics ? "Cursor physics on" : "Cursor physics off"}</button><p className="mt-3 text-slate-500">{selectedId ? "Connected nodes are highlighted." : "Architecture overview shows files and imports."}</p></div>
          <div className="border-t border-slate-800 pt-4"><p className="mb-2 font-semibold text-slate-400">Legend</p><p className="mb-1 text-slate-500">Nodes</p><p className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#334155]" />Files / modules</p><p className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#d78b68]" />Symbols</p><p className="mb-1 mt-3 text-slate-500">Edges</p>{relationshipTypes.map((type) => <p key={type} className="flex items-center gap-2"><i className="h-0.5 w-3" style={{ background: relationshipColors[type] }} />{type.toUpperCase()}</p>)}</div>
        </div>
      )}
      {!sidebarCollapsed && <div onPointerDown={resizeSidebar} className={`absolute top-0 ${dock === "left" ? "-right-1" : "-left-1"} z-20 h-full w-2 cursor-col-resize`} aria-label="Resize graph sidebar" />}
    </aside>
  );

  return (
    <div ref={graphRef} className="flex min-h-[700px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl" style={{ flexDirection: dock === "right" ? "row-reverse" : "row" }}>
      {sidebar}
      <section className="min-w-0 flex-1">
        <div className="flex h-12 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4">
          <span className="text-xs text-slate-500">{visibleNodeIds.size} visible nodes · {activeEdges.length} visible edges{invalidEdges.length > 0 ? ` · ${invalidEdges.length} invalid` : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPaused((value) => !value)} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">{paused ? "Resume" : "Pause"} physics</button>
            <button type="button" onClick={resetLayout} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Reset layout</button>
            <button type="button" onClick={() => fitView({ padding: 0.25, duration: 350 })} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Fit</button>
            <button type="button" onClick={toggleFullscreen} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">{fullscreen ? "Exit full screen" : "Expand graph"}</button>
            <span className="ml-2 text-[11px] text-slate-600">{settled ? "Settled" : paused ? "Paused" : "Physics active"}</span>
          </div>
        </div>
        {invalidEdges.length > 0 && <p className="border-b border-amber-900/70 bg-amber-950/40 px-4 py-2 text-xs text-amber-200" role="status">Graph data contains {invalidEdges.length} edge{invalidEdges.length === 1 ? "" : "s"} with missing node endpoints; they are excluded from rendering.</p>}
        {fullscreenError && <p className="border-b border-red-900/70 bg-red-950/40 px-4 py-2 text-xs text-red-200" role="alert">{fullscreenError}</p>}
        <div className="relative h-[650px]" onPointerMove={pointerMove} onPointerLeave={() => { pointerRef.current = null; }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
            onNodeMouseLeave={() => setHoveredId(null)}
            onNodeDragStart={startDrag}
            onNodeDrag={moveDrag}
            onNodeDragStop={stopDrag}
            onMove={(_, viewport) => setZoom(viewport.zoom)}
            onPaneClick={() => setSelectedId(null)}
            aria-label="Interactive repository dependency graph"
          >
            <Background color="#273449" gap={24} size={1} />
            <Controls position="bottom-right" />
            <MiniMap nodeColor={(node) => node.data?.color as string ?? "#89a0b9"} maskColor="rgba(2, 6, 23, 0.78)" />
          </ReactFlow>
          {!graph && <div className="absolute inset-0 grid place-items-center text-center text-sm text-slate-500">Analyze a repository to explore its source-backed graph.</div>}
          {graph?.nodes.length === 0 && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">No supported source nodes were found.</div>}
          {selectedNode && <aside className="absolute right-4 top-4 z-10 w-64 rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-2xl" aria-live="polite"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Selected node</p><h2 className="mt-2 break-words text-sm font-bold text-white">{nodeLabel(selectedNode)}</h2><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">Type</dt><dd className="text-slate-200">{selectedNode.kind ?? selectedNode.type}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Path</dt><dd className="break-all text-right text-slate-300">{selectedNode.path}</dd></div>{selectedNode.line !== null && <div className="flex justify-between gap-3"><dt className="text-slate-500">Lines</dt><dd className="text-slate-200">{selectedNode.line}–{selectedNode.end_line}</dd></div>}<div className="flex justify-between gap-3"><dt className="text-slate-500">Relationships</dt><dd className="text-slate-200">{selectedRelationships.length}</dd></div></dl>{selectedNode.type === "file" && <button type="button" onClick={() => toggleFileSymbols(selectedNode.path)} className="mt-4 w-full rounded border border-orange-400/40 px-2 py-1.5 text-xs font-semibold text-orange-200 hover:bg-orange-950/50">{expandedFiles.has(selectedNode.path) ? "Collapse symbols" : "Expand classes & functions"}</button>}</aside>}
        </div>
      </section>
    </div>
  );
}

export function GraphCanvas({ graph }: GraphCanvasProps) {
  return <ReactFlowProvider><ForceGraph graph={graph} /></ReactFlowProvider>;
}
