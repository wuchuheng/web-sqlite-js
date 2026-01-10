# Specification: Advanced Table Transitions (Tactile Units with Clarity/Blur)

## Overview

Refine the `ResultTable.vue` transitions into a high-fidelity animation system using tactile "Page" units. The system features a blur-to-focus transition for incoming content and a focus-to-blur transition for outgoing content.

## Requirements

### 1. Structural Transitions (Add/Delete)

- **Basic Unit:** The entire `<tr>`.
- **Keying:** Use `:key="row.id"`.
- **Sequential Add (Gap First):**
  1. **Gap Phase:** The table opens an empty, borderless gap at the target position. Table height extends slowly and smoothly.
  2. **Descent Phase:** The row becomes visible ~3 rows above its target.
  3. **Clarity transition:** The text starts **heavily blurry** (`filter: blur(8px)`) and gradually becomes sharp as the row slides down into the gap.
- **Sequential Delete (Tear-off First):**
  1. **Tear-off Phase:** The row detaches and swipes **down and to the right** with a slight rotation.
  2. **Clarity Transition:** The text starts clear and gradually becomes **blurry** as it moves away.
  3. **Collapse Phase:** The resulting empty gap slowly contracts, shrinking the table height.

### 2. Content Transitions (Update)

- **Basic Unit:** The text content within a `<td>`.
- **Visual Logic:** Follows the "Row Unit" behavior but constrained to the cell.
- **Keying:** Wrap each cell value in a `<Transition name="cell-tactile" mode="out-in">` keyed by value.
- **Tear-off & Focus:**
  - **Old Value:** Swipes down-right and becomes blurry.
  - **New Value:** Slides down from the top of the cell, starting blurry and becoming clear upon arrival.

### 3. Technical Implementation

- **Row Animations:** Use Vue Javascript hooks (`@before-enter`, `@enter`, `@leave`) to manage the height vs. movement sequence.
- **Cell Animations:** Use CSS transitions for the mini "page" effects inside cells.
- **Blur Management:** Use `filter: blur()` in the transition classes.
- **Flex Layout:** Maintain the flex-based table structure to allow for independent row height and positioning during absolute-leaving states.

## Implementation Plan

### Step 1: Template Update

- Row keys stay as `row.id`.
- Wrap cell values in `<Transition name="cell-tactile" mode="out-in">` with blur support.

### Step 2: JavaScript Row Controller

- Implement `onEnter` to first animate `height` (opening the gap), then animate `translateY` and `blur` together.
- Implement `onLeave` to first animate `translateY`, `rotate`, and `blur` (the tear-off), then animate `height` to zero.

### Step 3: CSS Polish

- Define `.cell-tactile-enter-from` with `translateY(-100%)` and `blur(4px)`.
- Define `.cell-tactile-leave-to` with `translateY(100%)`, `translateX(20px)`, and `blur(4px)`.

## Verification

- **Add:** Table height grows -> Blurry row appears above -> Row slides down and focuses.
- **Update:** Only the updated cell text performs a mini blurry "flip".
- **Delete:** Row unit swipes away and blurs -> Table height collapses.
