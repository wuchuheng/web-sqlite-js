# Specification: Homepage Hero Section & Call-to-Action

## Overview

Elevate the documentation homepage by introducing a dedicated "Hero" section above the interactive demo. This section will provide a clear, concise value proposition for `web-sqlite-js` and guide developers toward the next steps with clear action buttons.

## Requirements

### 1. Value Proposition (Description)

- **Content:** A friendly, out-of-the-box SQLite database for the web. Making persistent client-side storage simple for every developer.

- **Style:** Use the project's signature "Kalam" hand-drawn font. Keep it large enough to be the first thing a user reads but small enough to not push the demo entirely off-screen.

### 2. Action Buttons (Call-to-Action)

- **Primary Button (Quickstart):**
  - **Label:** "Quickstart"
  - **Visuals:** Hand-drawn border, slightly thicker than secondary. Filled with a subtle highlight color (e.g., `#d9f2d0` to match the dot color).
  - **Behavior:** Links to the `/getting-started` page.
- **Secondary Button (Dev Tools):**
  - **Label:** "Dev Tools (Coming soon)"
  - **Visuals:** Transparent background, hand-drawn border. Subtle grayed-out effect to indicate "Coming soon" state.
  - **Behavior:** Unclickable or leads to a "Notify me" modal (for now, just a placeholder/coming soon style).

### 3. Layout & Aesthetics

- **Positioning:** At the very top of the `HomePage.vue` component, preceding the `main-flow` and its connectors.
- **Visual Style:**
  - **Hand-drawn Borders:** Use SVG path borders or `rough.js`-style CSS to match the sketch aesthetic of the SQL Console and OPFS folder.
  - **Whitespace:** Use generous margins to maintain a "clean and elegant" feel.
  - **Responsiveness:** Stack the buttons vertically on mobile ('sm') and horizontally on 'md'/'lg' layouts.

## Implementation Plan

### Step 1: Design Hero Component

- Create `docs/.vitepress/theme/components/home-demo/HeroHeader.vue`.
- Define the SVG-based hand-drawn borders for the title and buttons.

### Step 2: Integrate into HomePage.vue

- Import `HeroHeader` into `HomePage.vue`.
- Place it at the top of the template.
- Adjust the layout logic to ensure the `BezierCurve` and other connectors are correctly positioned relative to the new header height.

### Step 3: Interaction & Hover Effects

- Add subtle "wobble" or scaling effects on hover for the buttons to reinforce the tactile, hand-drawn feel.

## Verification

- **Visual Check:** Verify the title and buttons appear above the demo and look integrated into the sketch aesthetic.
- **Navigation:** Click "Quickstart" and verify it navigates to the Getting Started page.
- **Responsive Check:** Verify the buttons stack correctly on mobile.
