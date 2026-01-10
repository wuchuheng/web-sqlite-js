# Specification: Full Responsive Refactor with JS Detection

## Overview

Refactor the homepage demo's responsive layout to use JavaScript-based breakpoint detection. This will allow for more granular control over component arrangement and connector point calculations across three distinct device categories: `sm`, `md`, and `lg`.

## Breakpoint Definitions

Based on project requirements:

- **`sm` (Small):** Width < 768px (48rem)
- **`md` (Medium):** 768px <= Width < 1024px (64rem)
- **`lg` (Large):** Width >= 1024px (64rem)

_Note: While `sm` starts at 640px in standard rules, for our layout logic, we treat everything below 768px as the "vertical stacked" `sm` mode to ensure readability._

## Layout Modes

### 1. Large Device (`lg`)

- **Structure:** Single horizontal row with 3 columns.
- **Column 1:** `SqlConsole` (50% width).
- **Column 2:** `WorkerConnector` (20% width).
- **Column 3:** Vertical Persistence Column (30% width).
  - **Row 1:** `ResultTable` (100% width of Column 3).
  - **Row 2:** `IO Connector` (Vertical orientation).
  - **Row 3:** `OpfsExplorer` (Centrally aligned, 50% width of Column 3).
- **Data Flow:** Mixed (Horizontal from Console to Table, Vertical between Table and OPFS).

### 2. Medium Device (`md`)

- **Structure:** Three main rows.
  - **Row 1:** `SqlConsole` (Full width)
  - **Row 2:** `WorkerConnector` (Full width)
  - **Row 3:** Horizontal flow for persistence:
    - `ResultTable`: 50%
    - `IO Spacer`: 20%
    - `OpfsExplorer`: 30%
- **Data Flow:** Mixed (Vertical from Console to Table, Horizontal from Table to OPFS).

### 3. Small Device (`sm`)

- **Structure:** Full vertical stack (5 rows).
  - **Row 1:** `SqlConsole`
  - **Row 2:** `WorkerConnector`
  - **Row 3:** `ResultTable`
  - **Row 4:** `IO Connector` (Vertical arrow)
  - **Row 5:** `OpfsExplorer`
- **Data Flow:** Fully Vertical (Top-to-Bottom).

## Technical Implementation

### JavaScript as Sole Source of Truth

- A reactive variable `deviceType` (`'sm' | 'md' | 'lg'`) will be the central configuration for all layout and connector logic.
- **Dynamic Styling:** Component widths and flex arrangements will be applied via JS-driven `:style` or `:class` bindings, rather than hardcoded `@media` queries in CSS.
- **Responsive Calculation:** `updatePoints` will use the exact state of `deviceType` to determine anchor points and paths.

## Layout Configuration (JS Standard)

| Component               | LG (Flex)    | MD (Flex)  | SM (Flex) |
| :---------------------- | :----------- | :--------- | :-------- |
| `SqlConsole`            | 50%          | 100%       | 100%      |
| `WorkerConnector`       | 20%          | 100%       | 100%      |
| `Persistence Column`    | 30%          | 100%       | 100%      |
| `ResultTable` (in Col)  | 100%         | 50%        | 100%      |
| `IO Connector` (in Col) | Vertical     | Horizontal | Vertical  |
| `OpfsExplorer` (in Col) | 50% (Center) | 30%        | 100%      |

## Implementation Plan

1. **Step 1: Implement Breakpoint Detection**
   - Add a resize listener to `HomePage.vue`.
   - Create a helper to map width to `deviceType`.

2. **Step 2: Refactor HomePage.vue for Dynamic Layout**
   - Replace static CSS layouts with dynamic bindings driven by `deviceType`.
   - Ensure all sub-components receive the necessary state to adjust their internal presentation if needed.

3. **Step 3: Update Connector Logic**
   - Refactor `updatePoints` to use `deviceType` for determining connection sides.
   - Ensure IO arrows handle the transition from horizontal (`md`) to vertical (`sm`, `lg`) correctly.

4. **Step 4: Verification**
   - Test across specific widths: 500px (`sm`), 850px (`md`), 1200px (`lg`).
   - Verify that the green dots and arrows remain perfectly aligned and correctly oriented in all 3 modes.
