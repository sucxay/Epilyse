---
applyTo: "frontend/**"
---

# Graph Visual Polish

Goal: turn the repo graph from a cluttered hairball into something a person can read in 5 seconds and enjoy exploring. Calm by default, expressive on interaction.

## Before You Start
- Inspect the existing frontend first: find the graph library in use (check `package.json` and imports), the render loop, the data shape coming from the backend, and the styles. Reuse them.
- Do not add dependencies without asking. Prefer what is already installed (canvas/WebGL renderer, d3-force, etc.).
- Do not change the backend graph schema for visual reasons. Derive visual attributes (size, color, cluster) on the client.
- Never invent nodes or edges. Visuals may hide or fade data, never fabricate it.

## Known Problems To Fix (observed in the current UI)
1. **Label soup.** Every label renders at once, overlapping and unreadable, including labels of faded nodes.
2. **No visual hierarchy.** Files and symbols are tiny dots of similar size. Nothing says "this is important".
3. **Edge spaghetti.** Long curved edges cross the whole canvas at full opacity.
4. **Broken preview panel.** A blank white rectangle sits bottom-right (minimap or code preview with no content or no theme).
5. **Fake "communities".** The Communities list shows one entry per symbol. Communities must be real clusters, not a symbol list.
6. **Scattered layout.** Disconnected nodes drift far from the main structure, wasting space and shrinking everything.
7. **Weak focus.** Selecting a node only draws a ring. The neighborhood is not highlighted.
8. **Side panel clipped** at the right edge and visually flat.

## Visual System
**Theme:** deep navy/near-black background (`#05060f` range), subtle radial vignette, very faint dot grid. Define all colors as CSS variables / a single theme object. No hardcoded colors scattered in render code.

**Nodes**
- Size by importance: scale with degree (connection count) using a sqrt or log scale, clamped to a min and max. Files larger than symbols.
- Color by cluster (module or directory), using a restrained palette of 8 to 10 harmonious hues. Same cluster, same hue family.
- Shape or ring distinguishes kinds: file (filled with ring), class (larger, solid), function (small, solid), method (smallest).
- Soft glow (additive blur or radial gradient sprite) on nodes, stronger for high-degree nodes. Cache glow sprites; do not recompute per frame.

**Edges**
- Default opacity very low (0.08 to 0.15), thin (0.6 to 1px), color matches source cluster at low alpha.
- Use gentle curvature only when it reduces overlap. Straight is fine for short edges.
- Relationship types get distinct but subtle styles: IMPORT (cool gray-blue), CONTAINS (warm, very faint, hidden by default), CALLS (teal, dashed or with direction arrowheads on hover only).
- Consider edge bundling or hiding edges longer than a threshold until hover.

**Labels (most important fix)**
- Show labels only for: the hovered node, selected node, their direct neighbors, the top N nodes by degree, and nodes within a small radius of the cursor.
- Use collision detection: sort candidates by priority, place greedily, skip any label whose box overlaps an already placed label.
- Fade labels in and out (150 to 250 ms). Zoom level controls how many labels are allowed.
- Never render labels for dimmed nodes. Truncate long names with an ellipsis; show full name in a tooltip.
- Text needs a thin dark outline or halo so it stays readable over edges.

**Layout**
- Use a force layout with cluster gravity: nodes of the same cluster attract to a cluster center; clusters repel each other. Link distance shorter inside a cluster than between clusters.
- Pull disconnected components toward the center with weak gravity so nothing drifts off screen.
- Run the simulation, then let it settle and stop. Do not keep it jittering. Reheat gently on drag.
- Fit the camera to the graph on load with padding, using an eased transition.

**Communities**
- Compute real communities (Louvain or label propagation if already available client-side; otherwise group by directory or module path as a deterministic fallback).
- The panel lists communities (name, color swatch, node count). Clicking one focuses and fits it. Never list individual symbols as communities.
- Provide a collapsible symbol list separately if needed.

## Cursor Animation
All of this runs in one `requestAnimationFrame` loop. Pointer events only update target state; the loop reads it. Never do layout or DOM reads inside pointer handlers.

1. **Cursor glow.** A soft radial light follows the pointer with lerp smoothing (factor around 0.15 per frame). Nodes near the glow brighten (distance falloff over roughly 140 px). This is the "spotlight" that also reveals nearby labels.
2. **Magnetic hover.** The nearest node within a hit radius scales up (1.0 to about 1.6) with eased spring motion, and drifts a few pixels toward the cursor. Release springs back smoothly.
3. **Neighborhood focus.** On hover: the node, its neighbors, and connecting edges animate to full opacity; everything else eases down to about 12 percent opacity. On leave, ease back over about 300 ms.
4. **Edge flow.** Highlighted edges show small particles or a dashed-offset animation moving from source to target, conveying direction. Only on highlighted edges, capped in count.
5. **Click ripple.** Clicking a node emits an expanding ring that fades out (about 600 ms) in the node's cluster color. The camera eases to center the node (about 500 ms, ease-in-out) and the source code panel opens.
6. **Soft parallax (optional).** Background grid shifts a few pixels opposite the cursor for depth. Keep it subtle.
7. **Pointer cursor states.** Default: small ring cursor. Over a node: ring grows and shows the node kind icon or a dot. While dragging: ring contracts. The native cursor stays visible for accessibility unless a custom one is clearly better.

## Panels and Chrome
- The side panel must never clip. Use a fixed width with internal scroll, consistent padding, and a glass effect (translucent background plus blur) matching the theme.
- Group controls: Search, Node categories, Relationships, Communities. Use styled toggles with colored swatches matching the canvas.
- Search: fuzzy match on path, class, function. Selecting a result flies the camera to that node and pulses it.
- **Preview panel:** fix or remove the blank white rectangle. If it is a minimap, render the actual graph in miniature with a viewport rectangle in the theme colors. If it is a code preview, show syntax-highlighted source in a dark theme, and hide the panel entirely when nothing is selected. A blank panel must never render.
- Smooth transitions (150 to 250 ms) on all toggle changes. Toggling a category fades nodes rather than popping them.

## Performance Rules
- Target 60 fps for up to a few thousand nodes. Use canvas or WebGL for the graph, not per-node DOM or SVG elements.
- Single render loop, dirty-flag rendering: skip frames when nothing changed (simulation settled, no hover animation active).
- Spatial index (quadtree or grid) for hit testing and cursor proximity; do not scan all nodes per pointer move.
- Pre-render glow sprites and icons to offscreen canvases.
- Throttle label layout to run when the camera or focus changes, not every frame.
- Level of detail: below a zoom threshold, draw nodes as simple circles, skip glows, labels, and particles.

## Accessibility
- Respect `prefers-reduced-motion`: disable parallax, particles, magnetic motion, and ripples; keep instant focus highlighting.
- Keep text contrast at WCAG AA or better against the background.
- Do not rely on color alone: kind is also encoded by size or shape.
- Support keyboard navigation: arrow keys or Tab move focus between neighbors, Enter opens source, Escape clears selection.

## Workflow
1. Inspect the current frontend code and run the app. Take a screenshot as the "before".
2. Fix in this order, since it gives the biggest improvement per effort: labels, edge opacity, node sizing, real communities, layout clustering, broken preview panel, then cursor animations.
3. Implement one concern at a time. Keep render code, layout code, and interaction code in separate modules.
4. Run the app after each step and compare against the "before" screenshot. Check at default zoom, zoomed in, and with a large graph.
5. Run the existing frontend tests and lint. Add tests for pure logic (label collision, community grouping, size scaling). No `assert` statements; use explicit checks with descriptive failure messages.
6. Report changed files, what improved, measured frame rate, and anything unresolved.

## Definition of Done
- At default zoom, no two labels overlap, and the graph's main clusters are visible at a glance.
- Hovering a node highlights its neighborhood and dims the rest, with smooth animation.
- Cursor glow, magnetic hover, and click ripple work and hold 60 fps on the largest repo you have.
- Communities panel shows real clusters, and clicking one focuses it.
- No blank or clipped panels anywhere.
- Reduced-motion mode works.
