# Specification: Story-Driven Copywriting Strategy (v4)

## Overview

Transform the homepage demo's messaging from a functional technical diagram into a narrative experience. The goal is to clearly communicate three pillars: **Performance (Non-blocking)**, **Reliability (Persistence)**, and **Developer Experience (SQL)**.

## Messaging Pillars

### 1. The Header: From Functional to Aspirational

- **Current:** "Run SQL locally."
- **Proposed:** "SQLite at the Speed of the Web."

### 2. The Worker Path: From Jargon to Benefit

- **Current:** "Non-blocking web worker"
- **Proposed:** "UI stays fluid, even during heavy I/O."

### 3. The Persistence Path: From Storage Mode to Guarantee

- **Current:** "Persistent Database locally (OPFS)"
- **Proposed:** "Your data, safe and local."

## Component-Specific Changes

| Component             | Current Text                         | Proposed Text                             |
| :-------------------- | :----------------------------------- | :---------------------------------------- |
| `SqlConsole`          | "Run SQL locally."                   | **"Execute SQL locally."**                |
| `SqlConsole` (Footer) | "type 'enter' to run..."             | **"Press ↵ Enter to execute."**           |
| `WorkerConnector`     | "Non-blocking web worker"            | "Asynchronous Processing Engine"          |
| `OpfsExplorer`        | "Persistent Database locally (OPFS)" | **"Persistent Local File System (OPFS)"** |
| `ResultTable`         | (No Header)                          | "Live Data View"                          |

## Tone and Style Guidelines

- **Local-First Focus:** Explicitly use the word "Local" for both the Console and the Storage explorer to emphasize privacy and performance.
- **Action Labels:** Use expressive labels for SQL presets:
  - **Insert** -> **+ Add Data**
  - **Delete** -> **🗑 Remove**
  - **Update** -> **✎ Modify**

## Implementation Plan

1. **Step 1:** Update `SqlConsole.vue` title and hints.
2. **Step 2:** Update `OpfsExplorer.vue` to "Persistent Local File System (OPFS)".
3. **Step 3:** Refactor `WorkerConnector.vue` and `ResultTable.vue` labels.
