# Specification: SQL Console Tab Styling Refactor

## Overview

Refactor the toolbar buttons in `SqlConsole.vue` to behave and look like browser tabs. This includes changing their shape, removing the gap between the tabs and the content area, and implementing an "active" state where the bottom border of the tab merges seamlessly with the content area below (Chrome-style tabs).

## Requirements

### 1. Visual Design (Tab Shape)

- **Shape:** Change from pill-shaped (`border-radius: 20px`) to tab-shaped.
- **Corners:** Top-left and top-right corners should be rounded (e.g., `8px`), while bottom corners should be square (`0`).
- **Borders:** Tabs should have a `2px solid #2d2d2d` border on the top, left, and right sides.
- **Background:** Match the window background (`#fdfbf6`).

### 2. Active Tab State (Chrome-style)

- **Merging Effect:** When a tab is active, its bottom border should disappear (or be covered), creating a continuous surface with the `window-content` area.
- **Shadows:** Remove or adjust the `box-shadow` for the active tab to ensure it looks flat against the content area.
- **Tracking State:** The component must track which preset is currently active.

### 3. Smooth Sliding Transition

- **The "Sliding Gap" Effect:** When switching between tabs, the "empty" part of the bottom border should not simply jump. Instead, it should appear to "travel" along the border line.
- **Movement Logic:**
  - If moving from Tab A to Tab B (Left to Right): The border at Tab A should start "growing" back from left to right, while the border at Tab B should start "disappearing" from left to right.
  - Visually, this is achieved by a sliding mask that matches the background color and transitions its `left` and `width` properties.
- **Animation:** Use a smooth transition (e.g., `0.3s cubic-bezier(0.4, 0, 0.2, 1)`).

### 4. Layout & Alignment

- **Spacing:** Tabs should be placed side-by-side with minimal or zero gap.
- **Positioning:** Tabs should be anchored to the bottom of the `window-toolbar`.
- **Text Styling:** Maintain the `Kalam` font and 600 weight.

## Technical Details

### State Management

- Introduce a new reactive variable `activePreset` (type: `string | null`).
- Use a template `ref` (e.g., `tabRefs`) to access the DOM elements of the tabs for coordinate calculation.

### CSS Strategy (The Sliding Mask)

- **Toolbar Container:** `position: relative; border-bottom: 2px solid #2d2d2d;`.
- **The Mask Element:** A `div` (or pseudo-element) with:
  - `position: absolute; bottom: -2px;` (sitting exactly on the toolbar border).
  - `height: 2px;` (matching the border width).
  - `background: #fdfbf6;` (matching the content background).
  - `transition: left 0.3s, width 0.3s;`.
  - `z-index: 5;`.
- **Tab Component (`.tool-btn`):**
  - `border-bottom: none;` (The mask handles the "opening" of the border).
  - `z-index: 1;`.

### Coordination Logic

- A `computed` property or a `watcher` will calculate the `left` offset and `width` of the `activePreset`'s tab element relative to the toolbar container.
- Apply these values via `:style` to the Sliding Mask element.

## Implementation Plan

1. **Step 1: Update State & Refs**
   - Add `activePreset` ref.
   - Add `tabRefs` array to capture button elements.

2. **Step 2: Implement Calculation Logic**
   - Create a function `updateMaskPosition()` that uses `offsetLeft` and `offsetWidth` of the active tab.
   - Call this on `mounted` and whenever `activePreset` changes.

3. **Step 3: Update Template**
   - Add the `.active-tab-mask` element inside `.window-toolbar`.
   - Apply dynamic styles to the mask based on the calculated position.

4. **Step 4: Refactor Styles**
   - Change `.tool-btn` to tab-like styling (rounded top, flat bottom).
   - Remove the hardcoded `border-bottom` removal on tabs and let the mask handle the visual merge.
   - Add transition properties to the mask.

5. **Step 5: Verification**
   - Test the "sliding hole" effect by clicking non-adjacent tabs (e.g., Insert -> Update).
   - Ensure the mask correctly covers the border and moves smoothly.
