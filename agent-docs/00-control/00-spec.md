# web-sqlite-js Specification Index

**Project**: web-sqlite-js (web-sqlite-v2 repository)
**Version**: 1.1.2
**Last Updated**: 2026-01-10
**Status**: Stage 7 Complete - v2.0.0 Architecture Ready for Implementation

---

## Quick Navigation

### Start Here

1. **[Status Board](./01-status.md)** - Live progress tracking and task states
2. **[Discovery Brief](../01-discovery/01-brief.md)** - Problem, users, solution overview
3. **[Requirements](../01-discovery/02-requirements.md)** - MVP requirements, success criteria, non-goals
4. **[Scope & Glossary](../01-discovery/03-scope.md)** - In/out of scope, boundaries, terminology
5. **[Options Analysis](../02-feasibility/01-options.md)** - Technical options and recommendation
6. **[Risk Assessment](../02-feasibility/02-risk-assessment.md)** - Risk register and mitigations
7. **[Spike Plan](../02-feasibility/03-spike-plan.md)** - Future enhancement spikes
8. **[High-Level Design](../03-architecture/01-hld.md)** - System architecture and components
9. **[Data Flow](../03-architecture/02-dataflow.md)** - Data flow and sequence diagrams
10. **[Deployment](../03-architecture/03-deployment.md)** - Deployment and infrastructure
11. **[ADR Index](../04-adr/)** - Architecture decision records
12. **[LLD & Contracts](../05-design/)** - Low-level design and API contracts
13. **[Implementation Strategy](../06-implementation/)** - Build, test, release standards
14. **[Roadmap & Task Catalog](../07-taskManager/)** - Release planning and task breakdown (NEW)

**Navigation Note**: All documentation files now include navigation links at the bottom for easy browsing between related documents and stages.

**Docs Scope Note**: `/docs` contains internal specifications and ADRs. The public documentation site lives in `/vitepress-docs`.

### Architecture Decision Records (ADRs)

-   **[ADR-0001: Web Worker Architecture](../04-adr/0001-web-worker-architecture.md)** - Non-blocking database operations
-   **[ADR-0002: OPFS for Persistent Storage](../04-adr/0002-opfs-persistent-storage.md)** - File-based persistence
-   **[ADR-0003: Mutex Queue for Concurrency](../04-adr/0003-mutex-queue-concurrency.md)** - Serialized operation execution
-   **[ADR-0004: Release Versioning System](../04-adr/0004-release-versioning-system.md)** - Database migration management
-   **[ADR-0005: COOP/COEP Requirement](../04-adr/0005-coop-coep-requirement.md)** - SharedArrayBuffer support
-   **[ADR-0006: TypeScript Type System](../04-adr/0006-typescript-type-system.md)** - Generic type parameters
-   **[ADR-0007: Error Handling Strategy](../04-adr/0007-error-handling-strategy.md)** - Stack trace preservation

### Low-Level Design & Contracts

-   **[01 API Contracts](../05-design/01-contracts/01-api.md)** - Public API specifications with flow diagrams
-   **[02 Event Catalog](../05-design/01-contracts/02-events.md)** - Worker message events and data structures
-   **[03 Error Standards](../05-design/01-contracts/03-errors.md)** - Error codes, handling, and recovery
-   **[01 Database Schema](../05-design/02-schema/01-database.md)** - Metadata database and OPFS structure
-   **[02 Migration Strategy](../05-design/02-schema/02-migrations.md)** - Release versioning and migrations
-   **[Module: Core](../05-design/03-modules/core.md)** - Core database API implementation
-   **[Module: Release Management](../05-design/03-modules/release-management.md)** - Release versioning system
-   **[Module: Worker Bridge](../05-design/03-modules/worker-bridge.md)** - Worker communication layer

### Implementation Strategy & Standards

-   **[01 Build and Run Guide](../06-implementation/01-build-and-run.md)** - Build workflow and coding conventions
-   **[02 Test Plan](../06-implementation/02-test-plan.md)** - Testing strategy (unit + E2E with Vitest/Playwright)
-   **[03 Observability Guide](../06-implementation/03-observability.md)** - Debug mode and logging standards
-   **[04 Release and Rollback Guide](../06-implementation/04-release-and-rollback.md)** - npm publishing and versioning

### Roadmap & Task Management (NEW)

-   **[01 Roadmap & Strategy](../07-taskManager/01-roadmap.md)** - Release planning, timeline visualization, strategic priorities
-   **[02 Task Catalog](../07-taskManager/02-task-catalog.md)** - Detailed task breakdown, Kanban board, dependencies, DoD

### Existing Specifications

-   **[Release Versioning System](../../specs/RELEASES.md)** - OPFS-based database migration and versioning
-   **[OPFS Explorer Refresh](../../specs/OPFS_REFRESH_AFTER_SQL.md)** - UI synchronization after SQL execution
-   Additional specs in `/specs/` directory for specific features

---

## Document Structure

```
agent-docs/
├── 00-control/                    # Control and coordination
│   ├── 00-spec.md              # This file - specification index
│   └── 01-status.md            # Live progress board
│
├── 01-discovery/                  # Stage 1: Problem framing (✓ COMPLETE)
│   ├── 01-brief.md             # Problem statement, users, solution
│   ├── 02-requirements.md      # MVP, success criteria, non-goals, backlog
│   └── 03-scope.md             # Scope boundaries and glossary
│
├── 02-feasibility/                # Stage 2: Options analysis (✓ COMPLETE)
│   ├── 01-options.md           # Technical options and trade-offs
│   ├── 02-risk-assessment.md   # Risk register and mitigations
│   └── 03-spike-plan.md        # Spike investigations for v2.0
│
├── 03-architecture/              # Stage 3: High-level design (✓ COMPLETE)
│   ├── 01-hld.md               # System architecture, containers, tech stack
│   ├── 02-dataflow.md          # Data flow, sequences, state machines
│   └── 03-deployment.md        # Deployment topology, infrastructure
│
├── 04-adr/                        # Stage 4: Architecture decisions (✓ COMPLETE)
│   ├── 0001-web-worker-architecture.md
│   ├── 0002-opfs-persistent-storage.md
│   ├── 0003-mutex-queue-concurrency.md
│   ├── 0004-release-versioning-system.md
│   ├── 0005-coop-coep-requirement.md
│   ├── 0006-typescript-type-system.md
│   └── 0007-error-handling-strategy.md
│
├── 05-design/                     # Stage 5: Low-level design (✓ COMPLETE)
│   ├── 01-contracts/           # API contracts and event catalog
│   │   ├── 01-api.md           # Public API specifications
│   │   ├── 02-events.md        # Worker message events
│   │   └── 03-errors.md        # Error codes and handling
│   ├── 02-schema/              # Database schema and migrations
│   │   ├── 01-database.md      # Metadata database and OPFS structure
│   │   └── 02-migrations.md    # Migration strategy and workflow
│   └── 03-modules/             # Module-level implementation details
│       ├── core.md             # Core database API
│       ├── release-management.md # Release versioning system
│       └── worker-bridge.md    # Worker communication layer
│
├── 06-implementation/             # Stage 6: Implementation (✓ COMPLETE)
│   ├── 01-build-and-run.md     # Build workflow and coding conventions
│   ├── 02-test-plan.md         # Testing strategy and coverage
│   ├── 03-observability.md     # Debug mode and logging standards
│   └── 04-release-and-rollback.md # Release process and rollback procedures
│
└── 07-taskManager/                   # Stage 7: Roadmap & Tasks (✓ COMPLETE)
    ├── 01-roadmap.md           # Release strategy and timeline
    └── 02-task-catalog.md      # Task breakdown and Kanban board
```

**Doc Update Checklist**:

-   Update `agent-docs/05-design/01-contracts/01-api.md` and `agent-docs/05-design/01-contracts/02-events.md` when public API or worker protocol changes.
-   Update `agent-docs/03-architecture/02-dataflow.md` and relevant ADRs for concurrency, release, or storage changes.
-   Keep `agent-docs/06-implementation/02-test-plan.md` and module test sections in sync with actual test files.
-   Mirror user-facing changes in `vitepress-agent-docs/` (public docs site).

---

## Reading Order

### For New Contributors

1. Read **[Brief](../01-discovery/01-brief.md)** to understand the project
2. Read **[Requirements](../01-discovery/02-requirements.md)** for MVP scope
3. Read **[Scope & Glossary](../01-discovery/03-scope.md)** for boundaries and terms
4. Read **[Options Analysis](../02-feasibility/01-options.md)** for technical decisions
5. Read **[High-Level Design](../03-architecture/01-hld.md)** for system architecture
6. Review **[ADR Index](../04-adr/)** for architectural decisions
7. Review **[LLD & Contracts](../05-design/)** for API specifications
8. Review **[Implementation Strategy](../06-implementation/)** for coding standards
9. **NEW**: Review **[Roadmap & Task Catalog](../07-taskManager/)** for planning and tasks
10. Check **[Status Board](./01-status.md)** for current progress

### For Architecture Decisions

1. Start with **[Brief](../01-discovery/01-brief.md)** for context
2. Review **[Options Analysis](../02-feasibility/01-options.md)** for architectural choices
3. Review **[High-Level Design](../03-architecture/01-hld.md)** for system structure
4. Review **[Data Flow](../03-architecture/02-dataflow.md)** for interaction patterns
5. Review **[ADR Index](../04-adr/)** for detailed decision records
6. Review **[LLD & Contracts](../05-design/)** for implementation details
7. Check **[Release Versioning Spec](../../specs/RELEASES.md)** for core architecture
8. See **[Status Board](./01-status.md)** for implementation stage

### For Feature Implementation

1. Review **[Requirements](../01-discovery/02-requirements.md)** for P0 scope
2. Check **[Non-goals](../01-discovery/02-requirements.md#3-non-goals-explicitly-out-of-scope)** to avoid scope creep
3. Check **[Backlog](../01-discovery/02-requirements.md#4-backlog-future-ideas)** for future considerations
4. Review **[API Contracts](../05-design/01-contracts/01-api.md)** for API specifications
5. Review **[Module LLDs](../05-design/03-modules/)** for implementation details
6. Review **[Build and Run Guide](../06-implementation/01-build-and-run.md)** for coding standards
7. Review **[Data Flow](../03-architecture/02-dataflow.md)** for sequence diagrams
8. **NEW**: Review **[Task Catalog](../07-taskManager/02-task-catalog.md)** for task breakdown
9. Review **[Spike Plan](../02-feasibility/03-spike-plan.md)** for validation needs
10. Review relevant **[specs/](../../specs/)** for detailed specifications
11. Check relevant **[ADRs](../04-adr/)** for architectural constraints

### For API Integration

1. Review **[API Contracts](../05-design/01-contracts/01-api.md)** for complete API reference
2. Review **[Event Catalog](../05-design/01-contracts/02-events.md)** for worker protocol
3. Review **[Error Standards](../05-design/01-contracts/03-errors.md)** for error handling
4. Review **[Requirements](../01-discovery/02-requirements.md)** for feature scope
5. Check **[Data Flow](../03-architecture/02-dataflow.md)** for usage patterns
6. Review **[ADR Index](../04-adr/)** for architectural constraints

### For Development & Testing

1. Read **[Build and Run Guide](../06-implementation/01-build-and-run.md)** for development workflow
2. Read **[Test Plan](../06-implementation/02-test-plan.md)** for testing strategy
3. Read **[Observability Guide](../06-implementation/03-observability.md)** for debugging
4. Review **[API Contracts](../05-design/01-contracts/01-api.md)** for API usage
5. Check **[Error Standards](../05-design/01-contracts/03-errors.md)** for error handling

### For Deployment & Operations

1. Read **[Release and Rollback Guide](../06-implementation/04-release-and-rollback.md)** for publishing
2. Read **[Deployment Guide](../03-architecture/03-deployment.md)** for infrastructure
3. Review **[ADR-0005: COOP/COEP](../04-adr/0005-coop-coep-requirement.md)** for header configuration
4. Review **[Data Flow](../03-architecture/02-dataflow.md)** for error handling and recovery
5. Check **[High-Level Design](../03-architecture/01-hld.md)** for observability
6. Review **[Options Analysis](../02-feasibility/01-options.md)** for browser support

### For Future Roadmap

1. **NEW**: Read **[Roadmap & Strategy](../07-taskManager/01-roadmap.md)** for release planning
2. **NEW**: Read **[Task Catalog](../07-taskManager/02-task-catalog.md)** for task breakdown
3. Read **[Spike Plan](../02-feasibility/03-spike-plan.md)** for v2.0 investigations
4. Review **[Backlog](../01-discovery/02-requirements.md#4-backlog-future-ideas)** for feature ideas
5. Check **[Risk Assessment](../02-feasibility/02-risk-assessment.md)** for future risks
6. See **[Status Board](./01-status.md)** for current priorities

---

## Project Overview

**web-sqlite-js** is a browser-based SQLite library that provides:

-   Full SQLite engine running in WebAssembly (WASM)
-   Persistent storage via Origin Private File System (OPFS)
-   Non-blocking architecture with Web Worker execution
-   Type-safe TypeScript API
-   Release versioning system for database migrations
-   Dev tooling for testing and rollback

### Current Version

-   **Version**: 1.1.2
-   **NPM Package**: [web-sqlite-js](https://www.npmjs.com/package/web-sqlite-js)
-   **Documentation**: https://web-sqlite-js.wuchuheng.com
-   **Repository**: https://github.com/wuchuheng/web-sqlite-js

### Key Technologies

-   **SQLite**: Vendored WASM build (sqlite3.wasm)
-   **Storage**: OPFS (Origin Private File System)
-   **Concurrency**: Mutex-based operation queue
-   **Type Safety**: TypeScript with full definitions
-   **Testing**: Vitest (unit) + Playwright (E2E)
-   **Build**: Vite

---

## Stage Progress

| Stage                 | Status      | Documents                                      | Key Decisions                                          |
| --------------------- | ----------- | ---------------------------------------------- | ------------------------------------------------------ |
| **1. Discovery**      | ✅ COMPLETE | Brief, Requirements, Scope                     | Problem framed, users identified, MVP defined          |
| **2. Feasibility**    | ✅ COMPLETE | Options, Risk Assessment, Spike Plan           | Option B selected (WASM+OPFS+Workers), risks mitigated |
| **3. HLD**            | ✅ COMPLETE | Architecture, Data Flow, Deployment            | System structure formalized, flows documented          |
| **4. ADR**            | ✅ COMPLETE | 7 Architecture Decision Records                | All major architectural decisions documented           |
| **5. LLD**            | ✅ COMPLETE | API contracts, Events, Errors, Schema, Modules | API and implementation specifications documented       |
| **6. Implementation** | ✅ COMPLETE | Build, Test, Observability, Release            | Coding standards and workflows defined                 |
| **7. Roadmap**        | ✅ COMPLETE | Roadmap, Task Catalog                          | Release strategy and task breakdown created            |

### Notes

-   **All stages complete**: Comprehensive documentation for production v1.1.0 and future planning
-   **Stage 7 complete**: Roadmap and task catalog provide clear direction for future releases
-   **Existing specs**: Detailed specifications exist in `/specs/` for specific features
-   **Implementation**: All MVP requirements (P0) are implemented and tested
-   **Documentation**: Production-ready documentation for onboarding and maintenance

---

## Stage 7 Summary: Roadmap & Task Catalog

### Purpose

Transform the comprehensive design and implementation documentation into actionable work plans for future releases.

### Scope

-   **Release Roadmap**: Strategic planning for v1.1.x maintenance, v1.2.0, v2.0.0, v2.1.0, and v3.0.0
-   **Task Breakdown**: Detailed task catalog with dependencies, priorities, and Definition of Done
-   **Timeline Visualization**: Mermaid Gantt charts showing release schedules
-   **Risk Management**: Identification of high-risk items and mitigation strategies

### Key Deliverables

**01-roadmap.md**:

-   Release strategy for v1.1.x through v3.0.0
-   Timeline visualization with Gantt charts
-   Strategic priorities (immediate, short-term, long-term)
-   Risk assessment and dependencies
-   Success metrics and decision framework
-   Communication plan

**02-task-catalog.md**:

-   Comprehensive task breakdown for all releases
-   Kanban board structure (Pending, In Progress, Review, Done)
-   Task dependencies with Mermaid diagrams
-   Definition of Done for each task
-   Retrospective tasks for v1.1.0 (29 completed tasks)
-   Future tasks for v1.2.0, v2.0.0, v2.1.0, v3.0.0

### Documentation Quality

**Diagrams**: Extensive use of Mermaid diagrams

-   Gantt charts for release timelines
-   Dependency graphs for task relationships
-   Flowcharts for decision processes

**Task Details**:

-   1-4 hour granularity per task
-   Vertical slicing (feature-based tasks)
-   Clear boundaries and DoD
-   Priority levels (P0-P3)

**Cross-References**: Comprehensive linking

-   Roadmap links to Spike Plan (S-001 through S-005)
-   Task Catalog references implementation standards
-   Dependencies clearly documented

---

## Stage 6 Summary: Implementation Strategy & Standards

### Implementation Overview

**Purpose**: Define the constitution for engineers working on the web-sqlite-js project.

**Scope**:

-   **Build Workflow**: Code -> Test -> Refactor loop with quality gates
-   **Testing Strategy**: E2E-first with selective unit testing
-   **Observability**: Debug mode with SQL syntax highlighting and query timing
-   **Release Process**: Automated CI/CD with semantic versioning and rollback procedures

### Key Deliverables

**01-build-and-run.md**:

-   Mandatory "Code -> Test -> Refactor" workflow
-   Trunk-based development (short-lived feature branches)
-   Conventional commits (NO AI watermarks)
-   Coding standards (max 30 lines/function, max 3 nesting levels)
-   Functional programming preference
-   Vertical slicing (one file per use-case)
-   Build commands and environment setup
-   Troubleshooting guide

**02-test-plan.md**:

-   Testing tools (Vitest + Playwright)
-   E2E-first testing strategy (primary approach)
-   Selective unit testing (only for pure utilities)
-   Coverage requirements (100% for critical paths)
-   E2E test suite with critical flows
-   Test execution and CI pipeline
-   Test data management and isolation
-   Debugging tests

**03-observability.md**:

-   Debug mode configuration
-   Logging standards (debug, info, warn, error)
-   SQL syntax highlighting
-   Worker message logging
-   Performance metrics and benchmarks
-   Error tracking and context
-   Browser DevTools integration
-   Production monitoring

**04-release-and-rollback.md**:

-   Release workflow with CI/CD
-   Publishing to npm (automated)
-   Version bumping (semantic versioning)
-   Rollback procedures (unpublish/deprecate)
-   Hotfix process
-   Release notes and changelog
-   Release checklist
-   Troubleshooting

### Documentation Quality

**Diagrams**: Extensive use of Mermaid diagrams

-   Build pipeline flowcharts
-   Test pyramids and CI workflows
-   Release and rollback flows
-   Performance benchmarks

**Code Examples**: Real commands and configurations

-   npm scripts
-   Git workflows
-   CI/CD configurations
-   Test examples

**Standards Enforced**:

-   Max 30 lines per function
-   Max 3 nesting levels
-   Max 4 parameters per function
-   Three-phase pattern (Input -> Process -> Output)
-   Conventional commits (feat, fix, refactor, test, docs, chore)

---

## Definition of Done

A task is **DONE** only if:

-   ✅ Work completed
-   ✅ Evidence provided (commit/PR/test commands/results)
-   ✅ Status board updated: [agent-docs/00-control/01-status.md](./01-status.md)
-   ✅ This spec index updated if any reading order or stage outputs changed

---

## Change Log

| Date       | Change                                         | Impact                                                                |
| ---------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| 2025-01-08 | Initial Stage 1 Discovery documentation        | Created discovery docs, established spec index                        |
| 2025-01-08 | Created control documents                      | Set up status tracking and navigation                                 |
| 2025-01-08 | Stage 2 Feasibility Analysis complete          | Added options analysis, risk assessment, spike plans                  |
| 2025-01-08 | Stage 3 High-Level Design complete             | Added system architecture, data flow, deployment docs                 |
| 2025-01-09 | Stage 4 Architecture Decision Records complete | Added 7 ADRs documenting all major architectural decisions            |
| 2025-01-09 | Stage 5 Low-Level Design & Contracts complete  | Added API contracts, events, errors, schema, modules documentation    |
| 2025-01-09 | Navigation links added to all documents        | Enhanced document discoverability with consistent navigation sections |
| 2025-01-09 | Stage 6 Implementation Strategy complete       | Added build, test, observability, and release standards               |
| 2025-01-09 | **Stage 7 Roadmap & Task Catalog complete**    | Added release strategy and task breakdown for all future versions     |

---

## Quick Reference

### Critical Paths

-   **MVP Requirements**: [agent-docs/01-discovery/02-requirements.md#1-mvp-p0-requirements](../01-discovery/02-requirements.md#1-mvp-p0-requirements)
-   **Success Criteria**: [agent-docs/01-discovery/02-requirements.md#2-success-criteria](../01-discovery/02-requirements.md#2-success-criteria)
-   **Non-goals**: [agent-docs/01-discovery/02-requirements.md#3-non-goals-explicitly-out-of-scope](../01-discovery/02-requirements.md#3-non-goals-explicitly-out-of-scope)
-   **Glossary**: [agent-docs/01-discovery/03-scope.md#4-glossary](../01-discovery/03-scope.md#4-glossary)
-   **Technical Options**: [agent-docs/02-feasibility/01-options.md](../02-feasibility/01-options.md)
-   **Risk Register**: [agent-docs/02-feasibility/02-risk-assessment.md](../02-feasibility/02-risk-assessment.md)
-   **Spike Plans**: [agent-docs/02-feasibility/03-spike-plan.md](../02-feasibility/03-spike-plan.md)
-   **System Architecture**: [agent-docs/03-architecture/01-hld.md](../03-architecture/01-hld.md)
-   **Data Flow**: [agent-docs/03-architecture/02-dataflow.md](../03-architecture/02-dataflow.md)
-   **Deployment**: [agent-docs/03-architecture/03-deployment.md](../03-architecture/03-deployment.md)
-   **Architecture Decisions**: [agent-docs/04-adr/](../04-adr/)
-   **API Contracts**: [agent-docs/05-design/01-contracts/01-api.md](../05-design/01-contracts/01-api.md)
-   **Database Schema**: [agent-docs/05-design/02-schema/01-database.md](../05-design/02-schema/01-database.md)
-   **Build and Run Guide**: [agent-docs/06-implementation/01-build-and-run.md](../06-implementation/01-build-and-run.md)
-   **Test Plan**: [agent-docs/06-implementation/02-test-plan.md](../06-implementation/02-test-plan.md)
-   **Observability Guide**: [agent-docs/06-implementation/03-observability.md](../06-implementation/03-observability.md)
-   **Release and Rollback Guide**: [agent-docs/06-implementation/04-release-and-rollback.md](../06-implementation/04-release-and-rollback.md)
-   **Roadmap & Strategy**: [agent-docs/07-taskManager/01-roadmap.md](../07-taskManager/01-roadmap.md)
-   **Task Catalog**: [agent-docs/07-taskManager/02-task-catalog.md](../07-taskManager/02-task-catalog.md)

### Architecture Key Points

-   **Option B Selected**: SQLite WASM + OPFS + Dedicated Workers
-   **Worker-based**: All SQLite operations run in Web Worker
-   **OPFS storage**: Databases stored in Origin Private File System
-   **Mutex queue**: Operations execute sequentially for consistency
-   **Release versioning**: Schema migrations tracked in metadata database
-   **Type-safe**: Full TypeScript support with generic query results
-   **COOP/COEP required**: For SharedArrayBuffer zero-copy performance
-   **Trunk-based development**: Short-lived feature branches, main always deployable
-   **Code quality gates**: Max 30 lines/function, max 3 nesting levels
-   **E2E-first testing**: Primary testing approach in real browsers
-   **Selective unit tests**: Only for pure utilities without browser dependencies

### External Dependencies

-   **Browser APIs**: OPFS, Web Workers, SharedArrayBuffer
-   **HTTP Headers**: COOP/COEP required for SharedArrayBuffer
-   **Build Tools**: Vite, TypeScript, Vitest, Playwright
-   **Deployment**: Vercel, Netlify, Cloudflare Pages supported
-   **Package Registry**: npm (public)
-   **CI/CD**: GitHub Actions with NPM_TOKEN secret

---

**Maintainer**: wuchuheng <root@wuchuheng.com>
**License**: MIT
**Homepage**: https://web-sqlite-js.wuchuheng.com
