# Specification: Dynamic Bezier Curve Connector

## Overview

Implement a dynamic SVG-based Bezier curve that connects the SQL Console, the Worker Connector, and the Result Table in the documentation homepage demo. The curve will start from the SQL Console, pass through the Worker Connector, and terminate at the Result Table, providing a visual flow of data.

## Requirements

### 1. Visual Elements

- **Start Point (P1):** A small green dot at the bottom center of the `SqlConsole` component.
- **Mid Point (P2):** An invisible point at the center of the `WorkerConnector` component. The curve should pass _behind_ the `WorkerConnector` label.
- **End Point (P3):** A small green dot at the top center of the `ResultTable` component.
- **The Curve:** A smooth curve starting at P1, passing through P2, and ending at P3.
- **Coloring:**
  - The dots should use the "Mac-style green" (`#c6f0b3` or similar, matching existing UI).
  - The curve should be a solid `#2d2d2d` line to match the hand-drawn aesthetic.

### 2. Component Architecture

- **`BezierCurve.vue`**: A new component that:
  - Accepts three coordinate pairs (x, y) as props.
  - Renders an SVG overlay covering the relevant area.
  - Calculates the quadratic Bezier control point such that the curve passes through P2.
  - Renders the two green points and the path.
  - **Layering:** The SVG should have a `z-index` that places it behind the `WorkerConnector` but possibly above the background, ensuring the connector's label (with its background color) masks the curve.

### 3. Coordinate Calculation

- The parent component (`HomePage.vue`) will be responsible for calculating the absolute or relative coordinates of the three points.
- This will be achieved using `getBoundingClientRect()` on refs assigned to the target components.
- Calculations must be updated on window resize to maintain alignment.

## Technical Details

### Bezier Curve Math

To ensure the quadratic Bezier curve $B(t)$ passes through $P_2$ at $t=0.5$:

- $P_c = 2 \cdot P_2 - 0.5 \cdot P_1 - 0.5 \cdot P_3$
- SVG Path: `M P1.x P1.y Q Pc.x Pc.y P3.x P3.y`

### Coordinate System

- The SVG should likely be `position: absolute` or `fixed` relative to a common container (e.g., `.demo-container`) to ensure the points align correctly regardless of scrolling (if the container is the reference).
- Preferred: Use a full-width/height SVG overlay or a precisely positioned one within `.demo-container`.

## Implementation Plan

1. **Step 1: Create `BezierCurve.vue`**
   - Define props for `p1`, `p2`, `p3`.
   - Implement the SVG logic and computed control point.
   - Add styles for the green dots and the curve.

2. **Step 2: Update `HomePage.vue`**
   - Add `ref` to `SqlConsole`, `WorkerConnector`, and `ResultTable` (via a wrapper if necessary).
   - Implement a `updatePoints` function that uses `getBoundingClientRect`.
   - Add `resize` event listener to trigger `updatePoints`.
   - Pass the calculated points to `BezierCurve.vue`.

3. **Step 3: Refine Styling and Layering**
   - Ensure the curve matches the "hand-drawn" aesthetic of the project (solid `#2d2d2d` stroke).
   - Match the green color precisely to the existing "traffic light" green in `SqlConsole.vue`.
   - Set the `z-index` of the `BezierCurve` SVG to be lower than `SqlConsole` and `WorkerConnector`.
   - Ensure `WorkerConnector` has a non-transparent background (it already has `#f7f4ec`) to effectively mask the curve as it passes "through" it.

4. **Step 4: Cleanup**
   - Remove or hide the existing static arrow in `WorkerConnector.vue` if it conflicts with the new dynamic curve.
