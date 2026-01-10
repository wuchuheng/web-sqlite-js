# Specification: Dynamic Straight Connectors (IO Arrows)

## Overview

Implement dynamic, straight, dotted-line connectors between the `ResultTable` and the `OpfsExplorer`. These connectors will replace the static `IoArrows.vue` and provide a visual representation of the bidirectional data flow between the UI and the persistent storage (OPFS).

## Requirements

### 1. Visual Elements

- **Connectors:** Two parallel straight lines.
  - **Line A (Top):** From `ResultTable` (right side) to `OpfsExplorer` (left side). Arrow pointing to OPFS.
  - **Line B (Bottom):** From `OpfsExplorer` (left side) to `ResultTable` (right side). Arrow pointing to Table.
- **Styling:**
  - **Line:** Dotted (`stroke-dasharray: 6 6`), solid `#2d2d2d` stroke, 2px width.
  - **Dots:** Green dots (`#c6f0b3`) at the start and end of each line (on the boundaries of the components).
  - **Arrows:** Directional arrows at the end points with a 12px gap from the dots, matching the style in `BezierCurve.vue`.
- **Responsive Behavior:**
  - On desktop (horizontal layout): Connect right side of Table to left side of OPFS.
  - On mobile (vertical layout): Connect bottom side of Table to top side of OPFS.

### 2. Component Architecture

- **`StraightConnector.vue`**: A new reusable component (or revamped `IoArrows.vue`) that:
  - Accepts `p1` and `p2` coordinates.
  - Accepts an `arrow` prop (boolean or enum) to determine which end (or both/neither) gets the arrow.
  - Renders an SVG overlay.
  - Calculates the arrow rotation automatically based on the vector from `p1` to `p2`.
- **`HomePage.vue`**:
  - Manages the refs for `ResultTable` and `OpfsExplorer`.
  - Calculates 4 sets of points (2 lines, each with start/end).
  - Updates points on window resize.

### 3. Coordinate Calculation

- The parent will determine if the layout is horizontal or vertical.
- **Horizontal:**
  - `LineA`: `[Table.right, Table.centerY - 10]` to `[OPFS.left, OPFS.centerY - 10]`
  - `LineB`: `[OPFS.left, OPFS.centerY + 10]` to `[Table.right, Table.centerY + 10]`
- **Vertical:**
  - `LineA`: `[Table.centerX - 10, Table.bottom]` to `[OPFS.centerX - 10, OPFS.top]`
  - `LineB`: `[OPFS.centerX + 10, OPFS.top]` to `[Table.centerX + 10, Table.bottom]`

## Technical Details

### Arrow Rotation

- Vector $\vec{v} = P_2 - P_1$
- Angle $\theta = \text{atan2}(v_y, v_x)$

### Layering

- The lines should be behind the components (`z-index: 5`).
- The dots and arrows should be in front of the components (`z-index: 20`).

## Implementation Plan

1. **Step 1: Create `StraightConnector.vue`**
   - Implement the straight line SVG logic.
   - Add the arrow calculation and gap logic (ported from `BezierCurve.vue`).
   - Add the green dots.

2. **Step 2: Update `HomePage.vue`**
   - Add refs to `ResultTable` and `OpfsExplorer`.
   - Extend `updatePoints` to calculate the 4 new points.
   - Add logic to detect horizontal vs vertical layout.

3. **Step 3: Cleanup `IoArrows.vue`**
   - Either replace it with the new dynamic components or turn it into a wrapper for them.

4. **Step 4: Verification**
   - Ensure the arrows point correctly in both desktop and mobile views.
   - Verify the gap and dotted style matches `BezierCurve.vue`.
