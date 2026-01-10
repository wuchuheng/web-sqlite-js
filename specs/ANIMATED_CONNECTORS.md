# Specification: Advanced Animated Path Drawing

## Overview

Implement a "Revealing Drawing Animation" for the `BezierCurve.vue` and `StraightConnector.vue` components. This animation visually represents data transmission by showing an arrow "drawing" a dashed line as it travels from the source to the destination.

## Research-Based Best Practices

Based on technical research, the most robust and performant way to reveal a **dashed** line (without the dashes themselves moving) is using an **SVG Mask** combined with `stroke-dashoffset`.

### 1. The Masking Technique

- **Dashed Path (The Content):** The visible dashed line. It stays static in terms of its pattern.
- **Solid Path (The Revealer):** A second path, identical in geometry but solid white, placed inside an SVG `<mask>`.
- **Logic:** By animating the `stroke-dashoffset` of the **solid path in the mask**, we reveal the dashed line underneath. This prevents the "crawling ants" effect where the dashes themselves appear to slide.

### 2. Synchronized Motion Path

- **Arrow Movement:** The arrow must be positioned using the quadratic Bezier formula:
  - $P(progress) = (1-progress)^2 P_1 + 2(1-progress)progress P_c + progress^2 P_3$
- **Arrow Rotation:** The rotation must match the tangent of the curve at the current `progress`.
- **Synchronization:** The `progress` value (0 to 1) will simultaneously drive the mask's `stroke-dashoffset` and the arrow's coordinates.

## Requirements

### 1. Trigger & Reset

- **Signal:** Animation triggers when `isProcessing` becomes `true`.
- **Reset:** Instantly set `progress` to 0. The dashed line disappears, and the arrow jumps to $P_1$.

### 2. Animation Phases

- **Duration:** 800ms - 1000ms.
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` for a smooth start and tactile finish.
- **Visuals:**
  - The arrow moves along the curve.
  - The dashed line is "painted" behind the arrow.
  - The text/icons at the destination (e.g., Worker pulse) trigger once the arrow arrives ($progress = 1$).

### 3. Real-Time Position Tracking (Debounced)

- **Requirement:** Connectors must remain attached to elements even when they move or change size (e.g., when the `ResultTable` expands during a transition).
- **Mechanism:**
  - Use `ResizeObserver` to monitor the source and destination elements.
  - Implement a **Debounced Recalculation** strategy:
    - **Real-Time:** Update positions immediately using `requestAnimationFrame` during high-frequency changes (like animations).
    - **Debounce:** Ensure a final, precise calculation runs 50ms after the last change to correct any sub-pixel drifts.
- **Independence:** The `StraightConnector.vue` will become "Smart": instead of receiving static `p1/p2` coordinates, it will receive the target elements and calculate its own anchor points dynamically.

## Technical Implementation Plan

### Step 1: Component State

- Add `progress` (ref) to `BezierCurve.vue`.
- Use a `watch` on `isProcessing` to trigger a Javascript animation loop (native `requestAnimationFrame` for maximum control).

### Step 2: SVG Structure (Masking)

```html
<defs>
  <mask :id="maskId">
    <path
      :d="pathData"
      stroke="white"
      :stroke-dasharray="pathLength"
      :stroke-dashoffset="maskOffset"
    />
  </mask>
</defs>
<path :d="pathData" class="dashed-line" :mask="`url(#${maskId})`" />
```

### Step 4: Autonomous Positioning (StraightConnector)

- Refactor `StraightConnector.vue` to accept element identifiers or refs.
- Implement a `ResizeObserver` to watch these targets.
- Implement a debounced tracking logic to keep the points `p1` and `p2` updated relative to the parent container.

## Verification

- Run a SQL query.
- Verify the line is hidden at start.
- Verify the arrow leads the reveal smoothly.
- Verify the final state shows the full dashed line and arrow at destination.
