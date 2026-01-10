# Specification: Responsive Layout Optimization (LG Media)

## Overview

Optimize the `HomePage.vue` demo for large displays (`lg` media query, >= 1024px). The current vertical stacking of the SQL Console, Worker, and Persistence layer will be transformed into a single horizontal flow to better utilize horizontal screen space.

## Requirements

### 1. Media Query Definitions

Following the project's responsive rules:

- **sm**: `min-width: 640px` (40rem)
- **md**: `min-width: 768px` (48rem)
- **lg**: `min-width: 1024px` (64rem)

### 2. Layout Transformations

#### LG Layout (>= 1024px)

- All main components will be arranged in a single horizontal row.
- **Flexbox Allocation:**
  - `SqlConsole`: 35%
  - `WorkerConnector`: 20%
  - `ResultTable`: 25%
  - `IO Connector Spacer`: 10% (Space for `StraightConnector`)
  - `OpfsExplorer`: 10%
- **Flow Direction:** Left-to-Right.

#### MD/SM Layout (< 1024px)

- Maintain the current vertical stacking:
  - Top: `SqlConsole`
  - Middle: `WorkerConnector`
  - Bottom: `Persistence Layer` (Table + Explorer)
- `Persistence Layer` internal responsiveness (horizontal vs vertical) remains unchanged (switches at 768px).

### 3. Dynamic Connector Updates

#### Bezier Curve (Console -> Worker -> Table)

- **LG Mode:**
  - **Start Point (P1):** Right center of `SqlConsole`.
  - **Mid Point (P2):** Center of `WorkerConnector`.
  - **End Point (P3):** Left center of `ResultTable`.
- **MD/SM Mode:**
  - **Start Point (P1):** Bottom center of `SqlConsole`.
  - **Mid Point (P2):** Center of `WorkerConnector`.
  - **End Point (P3):** Top center of `ResultTable`.

#### Straight Connectors (Table <-> OPFS)

- The logic will continue to use `getBoundingClientRect` to detect relative positions (side-by-side vs top-to-bottom) and connect the nearest visual borders.

## Technical Details

### CSS Implementation

- Use a container with `display: flex` and `flex-wrap: wrap`.
- On `lg`, set `flex-direction: row` and apply specific percentage widths.
- A spacer `div` will be added between `ResultTable` and `OpfsExplorer` on `lg` to ensure the 10% flex gap for IO arrows.

### JS Implementation (`HomePage.vue`)

- The `updatePoints` function will be enhanced to:
  1. Detect the current layout mode (Horizontal Row vs Vertical Stack).
  2. Adjust the connection side (`right` vs `bottom` for P1, `left` vs `top` for P3).
  3. Recalculate all coordinates.

## Implementation Plan

1. **Step 1: Update `HomePage.vue` Template**
   - Wrap the main components in a layout-agnostic structure.
   - Introduce the IO spacer `div`.

2. **Step 2: Apply Responsive Styles**
   - Implement the `lg` media query to switch the flex layout.
   - Set the percentage widths for each component as specified.

3. **Step 3: Enhance `updatePoints` Logic**
   - Add detection for layout mode.
   - Update the `getPos` logic to handle horizontal vs vertical flow for the Bezier curve.

4. **Step 4: Cleanup & Testing**
   - Verify smooth transitions between mobile, tablet, and desktop viewports.
   - Ensure the curve and arrows remain perfectly attached during resize.
