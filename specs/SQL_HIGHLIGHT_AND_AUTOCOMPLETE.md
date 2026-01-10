# Specification: SQL Syntax Highlighting & Autocomplete

## Overview

Enhance the `SqlConsole.vue` component by replacing the basic HTML `<textarea>` with a sophisticated SQL editor powered by **CodeMirror 6**. This will provide developers with a VS Code-like experience, including syntax highlighting, keyword suggestions, and context-aware autocomplete for database tables and columns.

## Requirements

### 1. Modern SQL Editor

- **Engine:** Use **CodeMirror 6** (modular, lightweight, and extensible).
- **Language Support:** Implement SQLite-specific syntax highlighting.
- **Visual Integration:** The editor must seamlessly blend with the project's "hand-drawn" aesthetic. Use the `Kalam` font and maintain the existing color palette (`#fdfbf6` background, `#2d2d2d` borders).

### 2. Intelligent Autocomplete & Snippets

- **Engine:** Deep integration with **`@codemirror/lang-sql`**.
- **Keyword Suggestions:** Standard SQL keywords suggested as the user types.
- **SQL Syntax Templates (Snippets):**
  - Provide "Smart Templates" for common operations. For example, typing `INS` will suggest a full `INSERT INTO table (cols) VALUES (vals)` pattern.
  - Supported templates: `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `ALTER TABLE`.
  - These templates will act as placeholder structures that the user can quickly fill in.
- **Schema-Awareness:**
  - The editor should suggest **table names** and **column names** existing in the current SQLite database.
  - **Reactive Updates:** If a user executes a `CREATE TABLE` or `ALTER TABLE` query, the autocomplete schema should refresh to include the new structures.
- **UI:** Suggestions should appear in a non-intrusive popup menu, styled to match the project's sketch-like aesthetic.

### 3. Developer Experience (DX)

- **Keybindings:**
  - `Ctrl + Enter` (or `Cmd + Enter` on Mac) should trigger the "Run" command.
  - Standard editor shortcuts (Undo/Redo, Indentation) should work as expected.
- **Auto-formatting:** (Optional/Future) Basic indentation and casing consistency.

### 4. Footer Keyboard Hint Refinement

- **Copywriting:** Update the hint to "Press `Ctrl` + `Enter` to execute."
- **Visuals:** Replace the legacy return icon with two pure SVG "Key Caps" representing the shortcut keys.
- **Mac-Style Aesthetic:**
  - The keys will be styled like Apple macOS keyboard caps (rounded rectangles with a subtle 3D border/shadow).
  - Key 1: **Ctrl** (or the symbol `⌃`).
  - Key 2: **Enter** (with the symbol `↵`).
- **Hand-Drawn Integration:** Ensure the SVG strokes match the hand-drawn weight (`2px`) and color (`#2d2d2d`) used throughout the demo.

## Technical Implementation

### Core Dependencies

To be added to `docs/package.json`:

- `codemirror`: Core editor logic.
- `@codemirror/lang-sql`: SQL language extension with schema support.
- `@codemirror/autocomplete`: For keyword, schema, and snippet suggestions.
- `@codemirror/state`, `@codemirror/view`: State management and DOM rendering.

### Schema & Snippet Integration

CodeMirror's SQL extension will be combined with custom snippet completion:

1. **Schema:** Dynamically updated via `sqlite_master` and `PRAGMA` queries.
2. **Snippets:** Define a `CompletionSource` that provides templates for:
   - `INSERT INTO ${table} (${columns}) VALUES (${values});`
   - `UPDATE ${table} SET ${column} = ${value} WHERE ${condition};`
   - `CREATE TABLE ${name} (${definitions});`

### Styling Strategy

- Disable the default CodeMirror borders.
- Apply `font-family: 'Kalam', cursive` to the editor's content.
- Ensure the editor's height matches the current 140px requirement or grows gracefully.

## Implementation Plan

### Step 1: Dependency Installation

Install the necessary CodeMirror 6 packages in the `docs` workspace.

### Step 2: Refactor `SqlConsole.vue`

- Replace `<textarea>` with a `div` ref for the CodeMirror mount point.
- Initialize the CodeMirror instance in `onMounted`.
- Sync `modelValue` (Vue prop) with the CodeMirror document state.

### Step 3: Implement Schema Provider

- Create a utility to extract the current schema from the SQLite database.
- Update the CodeMirror `Compartment` or reconfigure the SQL extension whenever the schema changes.

### Step 4: UI Polishing & Footer Update

- Match the "hand-drawn" aesthetic for the CodeMirror editor.
- Ensure the autocomplete popup is styled to match the project's look and feel.
- **Implement SVG Keyboard Keys:**
  - Design a small reusable SVG pattern or separate SVGs for "Ctrl" and "Enter" keys in the footer.
  - Update the template in `SqlConsole.vue` to display these keys next to the new copywriting.
- Verify `Ctrl+Enter` functionality.

## Verification

- Type `SEL` and verify `SELECT` is suggested.
- Create a table `test_table`, then type `INSERT INTO t` and verify `test_table` is suggested.
- Ensure the editor respects the existing layout and responsive behavior.
