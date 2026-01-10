# Specification: Perfect SVG Trapezoidal Tabs

## Overview

Replace the CSS-transform-based tabs in `SqlConsole.vue` with an SVG-path-based implementation. This ensures pixel-perfect geometry, eliminates sub-pixel rendering artifacts, and guarantees that the "waists" of the trapezoid connect exactly with the toolbar's bottom border.

## Requirements

### 1. SVG Geometry

- **Shape:** A trapezoid where the bottom edge is the full width of the tab, and the top edge is inset by a fixed "slant" value (e.g., `12px`).
- **Path Construction:**
  - The path will render the **Left**, **Top**, and **Right** edges.
  - The **Bottom** edge will remain open (no stroke) to allow for the Chrome-style "merge" effect.
  - **Corners:** Use `stroke-linejoin="round"` and `stroke-linecap="round"` with a small radius (e.g., `4px` or handled via path arcs) to maintain the hand-drawn aesthetic.
- **Stroke:** A consistent `2px` stroke matching `#2d2d2d`.

### 2. Implementation Strategy: Inline SVG Background

- Each `.tool-btn` will contain an absolute-positioned SVG that serves as its background/border.
- The SVG will use `preserveAspectRatio="none"` and a dynamic `viewBox` based on the button's dimensions, or a fixed-height SVG with a path that calculates the width dynamically.
- **Why this is better:** CSS `perspective` and `rotateX` are difficult to align because they change the "real" footprint of the element in 3D space. SVG paths are defined in 2D space relative to the button's box, making alignment trivial.

### 3. Precision Alignment

- **The "Waist" Connection:** The SVG path will start at `(0, Height)` and end at `(Width, Height)`. This ensures that the 2px border of the toolbar meets the 2px border of the tab's slanted side at the exact same coordinate.
- **The Sliding Mask:**
  - The sliding mask will remain the primary method for "opening" the toolbar border.
  - Because the SVG tabs are now mathematically aligned to the button's `offsetLeft` and `offsetWidth`, the mask will cover the toolbar border with 100% precision.

### 4. Visual Polish

- **Hover/Active States:** The SVG's `<path>` will change its `fill` color based on the button's state (`#fdfbf6` for active/normal, `#f5f2e9` for hover).
- **Transition:** Maintain the `0.3s` sliding animation for the mask.

## Technical Details

### Tab SVG Path Data (Conceptual)

```html
<svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none">
  <path
    :d="`M 0,${height} L ${slant},2 L ${width - slant},2 L ${width},${height}`"
    fill="currentColor"
    stroke="#2d2d2d"
    stroke-width="2"
    stroke-linejoin="round"
  />
</svg>
```

_Note: The `y=2` for the top edge accounts for the 2px stroke width to prevent clipping at the top of the SVG viewport._

## Implementation Plan

1.  **Step 1: Create `SqlTabBackground.vue` (Optional/Internal)**
    - Create a small helper or a render function within `SqlConsole.vue` to generate the SVG path based on width.

2.  **Step 2: Update `SqlConsole.vue` Template**
    - Replace the `::before` pseudo-element logic with the inline SVG.
    - Bind the SVG `width` to the button's client width (using a `ResizeObserver` or simply the existing tracking logic).

3.  **Step 3: Refine Mask Logic**
    - Ensure the mask width exactly matches the `offsetWidth` of the button.
    - Since the SVG path hits the corners of the box exactly, no "bleed" or "offset" should be required anymore.

4.  **Step 4: Verification**
    - Zoom in to 400% in the browser to ensure the 2px lines meet perfectly at the intersection.
    - Verify that the slanted edges are sharp and do not exhibit the blurriness sometimes caused by 3D transforms.
