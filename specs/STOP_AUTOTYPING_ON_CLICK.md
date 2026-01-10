# Specification: Stop Autotyping on Click

## Overview

The `SqlConsole.vue` component currently features an "auto-typing" demo mode that simulates a user entering SQL commands. To improve the user experience and allow for immediate manual interaction, the auto-typing loop should be interrupted as soon as the user clicks anywhere on the component.

## Requirements

### 1. Interactivity & Responsiveness

- **Click to Interrupt:** Any click event within the `SqlConsole.vue` component's boundaries must immediately cancel the ongoing auto-typing animation.

- **Immediate Focus:** Upon clicking, the cursor should immediately appear in the editor (the editor should gain focus), allowing the user to start typing without an extra click.

- **Immediate Control:** After the interruption, the user should be able to type or interact with the editor without being interrupted by further automated typing from the same loop.

### 2. Implementation Details

- **Event Listener:** Add a click listener to the root element of the `SqlConsole.vue` component.

- **Interruption Logic:**
  - Check if `isAutoTyping` is currently `true`.

  - If so, call `cancelAutoTyping()`.

  - Emit the `user-input` event to notify the parent component (`HomePage.vue`) to halt the entire demo loop (`stopAutoDemo`).

  - **Always call `focusEditor()`** to ensure the cursor is active.

- **Bubbling & Capturing:** The click listener should be efficient and not interfere with other interactive elements like tabs or the "Run" hint (though stopping the demo is desired in those cases as well).

## Verification

### Manual Test Steps

1. Refresh the home page and wait for the auto-demo to start (it should begin typing `INSERT INTO...`).
2. Click anywhere on the SQL Console (e.g., the title bar, the empty space, or the editor itself).
3. **Verify:** The auto-typing stops immediately.
4. **Verify:** The cursor remains at the last typed position, and the user can now type manually.
5. **Verify:** The auto-demo loop does not resume on its own.
