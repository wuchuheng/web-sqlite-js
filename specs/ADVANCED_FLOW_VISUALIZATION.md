# Specification: Advanced Data Flow Visualization

## Overview

Enhance the homepage demo by transforming static connectors into "Active Data Pipes". This refinement aims to visually communicate the non-blocking nature of the Web Worker by animating the flow of data packets between components.

## Requirements

### 1. Unified Smart Connector

- **Component:** Create (or refactor into) `SmartConnector.vue`.
- **Logic:**
  - If components are in a single row/column, use a **Straight Path**.
  - If components are offset (e.g., Console to Table in LG layout), use a **Cubic Bezier Path** for a more "organic" feel than the current quadratic one.
- **Wobble Effect:** Introduce a slight "hand-drawn" variance to the SVG paths using a small perturbation algorithm (simulating `Rough.js` style) to match the project's sketch aesthetic.

### 2. Flow Animation System

- **Packets:** Small circles (matches dot style) that move along the SVG path.
- **Trigger:** When `runQuery` is called in `HomePage.vue`, a sequence of packets is spawned:
  1. `Console` -> `Worker` (Command packet).
  2. `Worker` <-> `OPFS` (I/O packets, bidirectional).
  3. `Worker` -> `Table` (Result packet).
- **Non-Blocking Visualization:** Even while packets are moving between Worker and OPFS, the Console should remain interactable (e.g., hover effects or cursor blinking) to reinforce the "non-blocking" message.

### 3. Reactive States

- **Pulsing Worker:** The `WorkerConnector` should exhibit a "pulse" or "glow" animation while `isProcessing` is true.
- **Flow Speed:** The animation speed of packets should reflect the nature of the task (e.g., faster for simple SELECTs, slower for large INSERTs).

## Technical Implementation

### Cubic Bezier vs Quadratic

Instead of forcing a quadratic curve through a midpoint, use a Cubic Bezier:

- `M P1.x P1.y C C1.x C1.y C2.x C2.y P3.x P3.y`
- This allows the curve to "exit" the Console vertically and "enter" the Table vertically, creating a much smoother "S" or "U" shape depending on the layout.

### Packet Animation (CSS/SVG)

Use the `<animateMotion>` element or a CSS `offset-path` approach:

```html
<circle r="3" fill="#c6f0b3">
  <animateMotion
    dur="0.8s"
    repeatCount="1"
    path="...same as connector path..."
  />
</circle>
```

## Implementation Plan

1. **Step 1:** Implement `SmartConnector.vue` with cubic bezier support.
2. **Step 2:** Add the `spawnPacket` method to `HomePage.vue` to trigger animations based on the DB lifecycle.
3. **Step 3:** Refine `WorkerConnector.vue` to include a "Busy" visual state (pulsing lightning bolt).
4. **Step 4:** Add the "Wobble" logic to the SVG path generator for the final hand-drawn polish.
