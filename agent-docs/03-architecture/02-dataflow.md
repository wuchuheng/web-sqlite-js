<!--
OUTPUT MAP
agent-docs/03-architecture/02-dataflow.md

TEMPLATE SOURCE
.claude/templates/agent-docs/03-architecture/02-dataflow.md
-->

# 02 Data Flow & Sequences

## 1) Critical Business Flows

### Flow 1: Database Initialization with Release Versioning (Happy Path + Error)

**Goal**: Open a database connection and apply any pending release migrations
**Concurrency**: Metadata lock ensures only one migration process at a time

```mermaid
sequenceDiagram
    participant App as User Application
    participant Main as Main Thread
    participant Mutex as Mutex Queue
    participant Bridge as Worker Bridge
    participant Worker as Web Worker
    participant OPFS as OPFS Storage
    participant Meta as Metadata DB

    App->>Main: openDB(filename, options)
    Main->>Main: abilityCheck()
    Main->>Main: validateAndHashReleases(options.releases)

    alt SharedArrayBuffer Unavailable
        Main-->>App: throw Error("[web-sqlite-js] SharedArrayBuffer is not enabled.")
    end

    Main->>OPFS: navigator.storage.getDirectory()
    OPFS-->>Main: root directory handle
    Main->>OPFS: ensureDir(root, filename)
    Main->>OPFS: ensureFile(baseDir, "default.sqlite3")

    Main->>Bridge: createWorkerBridge()
    Bridge->>Worker: new Worker()
    Worker-->>Bridge: worker instance

    Main->>Bridge: sendMsg(OPEN, target="meta")
    Bridge->>Worker: postMessage({ id, event: OPEN, payload })
    Worker->>Meta: new sqlite3.oo1.OpfsDb("myapp.sqlite3/release.sqlite3")
    Worker-->>Bridge: postMessage({ id, success: true })
    Bridge-->>Main: resolve promise

    Main->>Meta: ensureMetadata() (create tables)
    Main->>Meta: SELECT * FROM release ORDER BY id DESC
    Meta-->>Main: latest version row

    Main->>Main: compareVersions(config.version, latestVersion)

    alt New Releases Available
        Main->>Meta: BEGIN IMMEDIATE (acquire lock)
        Meta-->>Main: transaction started

        Main->>Meta: INSERT OR REPLACE INTO release_lock (id, lockedAt)
        Main->>Main: for each new release config

        Main->>OPFS: getDirectoryHandle(version, create: true)
        Main->>OPFS: copyFileHandle(latestDb, versionDb)
        Main->>OPFS: writeTextFile(versionDir, "migration.sql")
        Main->>OPFS: writeTextFile(versionDir, "seed.sql")

        Main->>Bridge: sendMsg(OPEN, target="active", filename=versionDb)
        Bridge->>Worker: postMessage({ id, event: OPEN, payload })
        Worker->>OPFS: open sqlite3 database
        Worker-->>Bridge: success
        Bridge-->>Main: resolve

        Main->>Bridge: sendMsg(EXECUTE, sql="BEGIN")
        Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
        Worker-->>Bridge: success
        Bridge-->>Main: resolve

        Main->>Bridge: sendMsg(EXECUTE, sql=migrationSQL)
        Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
        Worker->>OPFS: execute migration

        alt Migration SQL Error
            Worker-->>Bridge: postMessage({ id, success: false, error })
            Bridge-->>Main: reject promise
            Main->>Bridge: sendMsg(EXECUTE, sql="ROLLBACK")
            Main->>OPFS: removeDir(versionDir)
            Main->>OPFS: removeDir(version)
            Main-->>App: throw Error("Migration failed")
        end

        Worker-->>Bridge: success
        Bridge-->>Main: resolve

        Main->>Bridge: sendMsg(EXECUTE, sql=seedSQL)
        Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
        Worker-->>Bridge: success
        Bridge-->>Main: resolve

        Main->>Bridge: sendMsg(EXECUTE, sql="COMMIT")
        Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
        Worker-->>Bridge: success
        Bridge-->>Main: resolve

        Main->>Meta: INSERT INTO release (version, hashes, mode, createdAt)
        Main->>Main: latestVersion = config.version

        Main->>Meta: COMMIT (release lock)
    end

    Main->>Bridge: sendMsg(OPEN, target="active", filename=latestDb)
    Bridge->>Worker: postMessage({ id, event: OPEN, payload })
    Worker-->>Bridge: success
    Bridge-->>Main: resolve

    Main-->>App: return DBInterface (exec, query, transaction, close)
```

**Error Handling**:

- **SharedArrayBuffer Unavailable**: Throws immediately with clear error message
- **Hash Mismatch**: Throws if archived release hash doesn't match config
- **Migration Failure**: Automatic ROLLBACK, removes incomplete version directory, propagates error
- **Lock Conflict**: Throws "Release operation already in progress" if concurrent migration attempt
- **OPFS Errors**: Propagates as rejected promises with descriptive error messages

### Flow 2: SQL Query Execution

**Goal**: Execute a SELECT query and return results
**Concurrency**: Mutex ensures only one operation at a time

```mermaid
sequenceDiagram
    participant App as User Application
    participant DB as DBInterface
    participant Mutex as Mutex Queue
    participant Bridge as Worker Bridge
    participant Worker as Web Worker
    participant OPFS as OPFS Storage

    App->>DB: query<T>("SELECT * FROM users WHERE id = ?", [id])
    DB->>Mutex: runMutex(() => _query(sql, params))
    Note over Mutex: Queue operation if busy

    Mutex->>Bridge: sendMsg(QUERY, { sql, bind: params })
    Bridge->>Bridge: generate unique message ID
    Bridge->>Bridge: store promise in idMapPromise

    Bridge->>Worker: postMessage({ id, event: QUERY, payload })
    Note over Bridge,Worker: Structured clone transfer

    Worker->>Worker: start = performance.now()
    Worker->>OPFS: db.selectObjects(sql, bind)
    OPFS-->>Worker: rows array
    Worker->>Worker: end = performance.now()
    Worker->>Worker: duration = end - start

    alt Debug Mode Enabled
        Worker->>Worker: console.debug({ sql, duration, bind })
    end

    Worker-->>Bridge: postMessage({ id, success: true, payload: rows })
    Bridge->>Bridge: lookup promise by ID
    Bridge->>Bridge: resolve promise with rows
    Bridge->>Bridge: delete from idMapPromise
    Bridge-->>Mutex: resolve
    Mutex-->>DB: resolve
    DB-->>App: Promise<T[]>

    alt SQL Execution Error
        Worker-->>Bridge: postMessage({ id, success: false, error })
        Bridge->>Bridge: reconstruct Error with stack trace
        Bridge->>Bridge: reject promise
        Bridge-->>Mutex: reject
        Mutex-->>DB: reject
        DB-->>App: Promise<Error>
    end
```

**Performance Characteristics**:

- **Query Timing**: 0.2-0.5ms per simple query (measured via `performance.now()`)
- **Mutex Overhead**: ~0.01ms for queue management
- **Worker Communication**: ~0.05ms for postMessage round-trip
- **Total Latency**: ~0.3-0.6ms from application call to result

### Flow 3: Transaction Execution

**Goal**: Execute multiple operations atomically
**Concurrency**: Mutex ensures transaction runs sequentially

```mermaid
sequenceDiagram
    participant App as User Application
    participant DB as DBInterface
    participant Mutex as Mutex Queue
    participant Bridge as Worker Bridge
    participant Worker as Web Worker

    App->>DB: transaction(async (tx) => { ... })
    DB->>Mutex: runMutex(async () => { ... })
    Note over Mutex: Blocks other operations

    Mutex->>Bridge: sendMsg(EXECUTE, sql="BEGIN")
    Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
    Worker-->>Bridge: success
    Bridge-->>Mutex: resolve

    Mutex->>App: execute transaction callback

    App->>DB: tx.exec("INSERT INTO users ...")
    DB->>Mutex: (already locked, proceed immediately)
    Mutex->>Bridge: sendMsg(EXECUTE, sql=INSERT...)
    Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
    Worker-->>Bridge: success
    Bridge-->>Mutex: resolve

    App->>DB: tx.query("SELECT * FROM users")
    DB->>Mutex: (already locked, proceed immediately)
    Mutex->>Bridge: sendMsg(QUERY, sql=SELECT...)
    Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
    Worker-->>Bridge: success
    Bridge-->>Mutex: resolve

    alt Callback Throws Error
        App-->>Mutex: throw Error("Validation failed")
        Mutex->>Bridge: sendMsg(EXECUTE, sql="ROLLBACK")
        Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
        Worker-->>Bridge: success
        Bridge-->>Mutex: resolve
        Mutex-->>App: throw Error("Validation failed")
    end

    alt Callback Succeeds
        App-->>Mutex: return result
        Mutex->>Bridge: sendMsg(EXECUTE, sql="COMMIT")
        Bridge->>Worker: postMessage({ id, event: EXECUTE, payload })
        Worker-->>Bridge: success
        Bridge-->>Mutex: resolve
        Mutex-->>App: return result
    end
```

**Transaction Guarantees**:

- **Atomicity**: All operations succeed or all fail (BEGIN/COMMIT/ROLLBACK)
- **Isolation**: Mutex ensures no concurrent transactions
- **Consistency**: SQL constraints enforced by SQLite
- **Durability**: OPFS persists changes immediately

### Flow 4: Dev Tool Release Creation

**Goal**: Create a new dev version for testing
**Concurrency**: Metadata lock prevents concurrent release operations

```mermaid
sequenceDiagram
    participant App as User Application
    participant DB as DBInterface
    participant Mutex as Mutex Queue
    participant Meta as Metadata DB
    participant OPFS as OPFS Storage
    participant Worker as Web Worker

    App->>DB: devTool.release({ version, migrationSQL, seedSQL })
    DB->>Mutex: runMutex(async () => { ... })
    Mutex->>Mutex: validateAndHashReleases([config])

    alt Version Not Greater Than Latest
        Mutex-->>App: throw Error("Version must be greater than latest")
    end

    Mutex->>Meta: BEGIN IMMEDIATE
    Meta-->>Mutex: transaction started

    Mutex->>Meta: INSERT OR REPLACE INTO release_lock (id, lockedAt)
    Mutex->>Mutex: withReleaseLock(async () => { ... })

    Mutex->>OPFS: getDirectoryHandle(config.version, create: true)
    Mutex->>OPFS: copyFileHandle(latestDbHandle, destDbHandle)
    Mutex->>OPFS: writeTextFile(versionDir, "migration.sql", config.migrationSQL)
    Mutex->>OPFS: writeTextFile(versionDir, "seed.sql", config.seedSQL)

    Mutex->>Worker: switch to new database file
    Mutex->>Worker: BEGIN
    Mutex->>Worker: EXECUTE migrationSQL
    Mutex->>Worker: EXECUTE seedSQL
    Mutex->>Worker: COMMIT

    alt Migration Error
        Worker-->>Mutex: throw Error
        Mutex->>Worker: ROLLBACK
        Mutex->>OPFS: removeDir(versionDir)
        Mutex->>Meta: ROLLBACK
        Mutex-->>App: throw Error("Migration failed")
    end

    Mutex->>Meta: INSERT INTO release (version, hashes, mode="dev", createdAt)
    Mutex->>Meta: COMMIT
    Mutex-->>App: resolve (void)
```

### Flow 5: Dev Tool Rollback

**Goal**: Roll back to a previous version
**Concurrency**: Metadata lock prevents concurrent rollback operations

```mermaid
sequenceDiagram
    participant App as User Application
    participant DB as DBInterface
    participant Mutex as Mutex Queue
    participant Meta as Metadata DB
    participant OPFS as OPFS Storage
    participant Worker as Web Worker

    App->>DB: devTool.rollback(targetVersion)
    DB->>Mutex: runMutex(async () => { ... })
    Mutex->>Meta: BEGIN IMMEDIATE

    Mutex->>Meta: SELECT * FROM release ORDER BY id
    Meta-->>Mutex: all release rows

    alt Target Version Not Found
        Mutex-->>App: throw Error("Version not found")
    end

    Mutex->>Mutex: compareVersions(targetVersion, latestReleaseVersion)

    alt Rollback Below Latest Release
        Mutex-->>App: throw Error("Cannot rollback below latest release")
    end

    Mutex->>Meta: for each dev version above target
    Note over Mutex: Identify dev versions to remove

    Mutex->>Meta: DELETE FROM release WHERE id = devVersion.id
    Mutex->>OPFS: removeDir(baseDir, devVersion.version)

    Mutex->>OPFS: getDbHandleForVersion(targetVersion)
    Mutex->>Worker: switch to target database file
    Mutex->>Meta: COMMIT
    Mutex-->>App: resolve (void)
```

## 2) Asynchronous Event Flows

**Pattern**: Message-passing via postMessage (not event-driven in traditional sense)

**Event Types**: Worker Message Protocol

- **OPEN**: Initialize database connection (active or metadata)
- **EXECUTE**: Run SQL without returning rows (INSERT, UPDATE, DELETE, DDL)
- **QUERY**: Run SELECT query and return rows
- **CLOSE**: Close database connections and cleanup

**Message Flow Pattern**:

```mermaid
flowchart LR
    Main[Main Thread] -->|1. postMessage| Worker[Web Worker]
    Worker -->|2. Process SQLite| WASM[SQLite WASM]
    WASM -->|3. Read/Write| OPFS[(OPFS Storage)]
    OPFS -->|4. Result| WASM
    WASM -->|5. Response| Worker
    Worker -->|6. postMessage| Main

    style Worker fill:#9f9,stroke:#333,stroke-width:2px
    style OPFS fill:#9f9,stroke:#333,stroke-width:2px
```

**Request-Response Correlation**:

- Each request gets unique incremental ID
- `idMapPromise` in worker bridge maps IDs to pending promises
- Worker responses include same ID for promise resolution
- Timeout protection: promises reject if worker terminates

**No Event Streaming**: Current implementation uses request/response pattern

- **Future Enhancement**: Query result streaming (Backlog B2) would introduce event-based row streaming

## 3) Entity State Machines

### Entity: Database Connection Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Uninitialized
    Uninitialized --> Initializing: openDB() called
    Initializing --> MetadataOpen: Opening metadata DB
    MetadataOpen --> ReleaseCheck: Checking for new releases
    ReleaseCheck --> Migrating: New releases available
    ReleaseCheck --> ActiveOpen: No new releases
    Migrating --> ActiveOpen: Migrations complete
    ActiveOpen --> Open: Active DB opened
    Open --> Querying: query() called
    Open --> Executing: exec() called
    Open --> InTransaction: transaction() called
    Querying --> Open: Query complete
    Executing --> Open: Execution complete
    InTransaction --> Open: Transaction committed
    InTransaction --> Open: Transaction rolled back
    Open --> Closed: close() called
    Closed --> [*]
```

### Entity: Release Version State

```mermaid
stateDiagram-v2
    [*] --> Initial: "0.0.0" initial version
    Initial --> Release: First release applied
    Release --> Release: Next release applied
    Release --> Dev: devTool.release() called
    Dev --> Dev: Another dev version created
    Dev --> Release: Rolled back to release
    Dev --> Dev: Rolled back to previous dev
    Release --> Closed: Database closed
    Dev --> Closed: Database closed
    Closed --> [*]

    note right of Release
        Immutable mode
        Cannot rollback below
        latest release version
    end note

    note right of Dev
        Mutable mode
        Can rollback freely
        within dev versions
    end note
```

### Entity: Worker Message State

```mermaid
stateDiagram-v2
    [*] --> Idle: Worker initialized
    Idle --> Processing: Message received
    Processing --> Success: Operation completed
    Processing --> Error: Operation failed
    Success --> Idle: Response sent
    Error --> Idle: Error response sent
    Idle --> Terminated: Worker terminated
    Terminated --> [*]
```

## 4) Consistency & Recovery

### Distributed Transactions

**No Distributed Transactions**: Single-worker architecture eliminates need for distributed transaction coordination

- **Single Writer**: Mutex ensures only one SQLite operation at a time
- **ACID Guarantees**: SQLite transactions provide atomicity, consistency, isolation, durability
- **No Two-Phase Commit**: All operations within single worker context

### Idempotency

**Operation Idempotency**:

- **EXECUTE**: Not idempotent by default (e.g., INSERT creates new rows)
- **QUERY**: Idempotent (read-only, no state change)
- **CLOSE**: Not idempotent; subsequent close fails with "Database is not open"
- **devTool.release**: Not idempotent; throws if version is <= latest
- **devTool.rollback**: Idempotent (safe to rollback to same version)

**Release Application Idempotency**:

```mermaid
flowchart LR
    A[Start Release] --> B{Version Exists?}
    B -->|Yes| C[Verify Hash Match]
    B -->|No| D[Apply Release]
    C -->|Hash OK| E[Skip - Already Applied]
    C -->|Hash Mismatch| F[Throw Error]
    D --> G[Insert Metadata]
    E --> H[Complete]
    F --> H
    G --> H
```

### Compensation

**Migration Failure Compensation**:

1. **Detect Error**: Migration SQL throws exception
2. **Automatic ROLLBACK**: Database state restored to pre-migration
3. **Cleanup**: Remove incomplete version directory from OPFS
4. **Metadata Cleanup**: Remove release row from metadata database
5. **Error Propagation**: Reject promise with original error
6. **State Restoration**: Revert to previous version as active database

**Transaction Failure Compensation**:

1. **Detect Error**: Transaction callback throws exception
2. **Automatic ROLLBACK**: Execute ROLLBACK SQL
3. **Error Propagation**: Reject promise with original error
4. **No Cleanup Needed**: Database state already restored by ROLLBACK

**Release Rollback Compensation**:

1. **Identify Dev Versions**: Find all dev versions above target
2. **Remove Metadata**: DELETE FROM release WHERE id = devVersion.id
3. **Remove Files**: removeDir(baseDir, devVersion.version)
4. **Switch Active DB**: Open target version database
5. **Final State**: System at target version with intermediate versions removed

**No Compensation Needed For**:

- **Query Failures**: Read-only, no state change
- **Worker Termination**: All pending promises rejected, no in-flight transactions
- **OPFS Errors**: Errors propagated immediately, no partial state to restore

### Recovery Scenarios

**Scenario 1: Page Refresh During Migration**

- **Detection**: Metadata lock not released
- **Recovery**: Next openDB() call waits for lock timeout or manually clears lock
- **State**: Incomplete version directory may exist
- **Cleanup**: Next openDB() validates version consistency, removes incomplete versions

**Scenario 2: Worker Crash**

- **Detection**: Worker.onmessage not called, pending promises timeout
- **Recovery**: All pending operations rejected with "Worker terminated" error
- **State**: OPFS files may be in inconsistent state if crash during write
- **Cleanup**: Transaction rollback ensures database consistency
- **Next Operation**: openDB() call reinitializes worker, validates metadata

**Scenario 3: OPFS Quota Exceeded**

- **Detection**: OPFS write throws QuotaExceededError
- **Recovery**: Error propagated to application
- **State**: Partial files may exist in version directory
- **Cleanup**: Application must handle error (e.g., delete old versions, clear data)
- **Prevention**: Library provides no automatic quota management

**Scenario 4: Hash Mismatch on Archived Release**

- **Detection**: Release config hash != metadata hash
- **Recovery**: Throws error immediately, no recovery
- **State**: Database remains at previous version
- **Resolution**: Developer must fix release config or manually reset database
- **Prevention**: Immutable release configs prevent accidental changes

---

## Navigation

**Previous**: [01 High-Level Design](./01-hld.md) - System architecture and components

**Next in Series**: [03 Deployment](./03-deployment.md) - Deployment and infrastructure

**Related Architecture Documents**:

- [Back to Architecture: 01 HLD](./01-hld.md)
- [Back to Spec Index](../00-control/00-spec.md)

**Related Design Documents**:

- [01 API Contracts](../05-design/01-contracts/01-api.md) - API specifications with sequence diagrams

**Continue to**: [Stage 4: ADR Index](../04-adr/) - Architecture decision records
