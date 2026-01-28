# TASK-423: Performance Validation

**Status**: DRAFT
**Priority**: P1 (Important)
**Estimated**: 2 hours
**Owner**: S8 Worker
**Dependencies**: TASK-406 (Tier 1 implemented), TASK-407 (Tier 2 implemented)

---

## Overview

Benchmark Tier 1 and Tier 2 validation performance to ensure targets are met. Tier 1 fast path should be < 0.1ms, Tier 2 slow path should be 1-5ms.

---

## Analysis

### Context from Design Docs

From F-003 design docs:

- **Tier 1 Fast Path**: trim() + hash comparison, target < 0.1ms
- **Tier 2 Slow Path**: prepare normalization + hash comparison, target 1-5ms
- Performance targets are based on typical database open operations

### Current Implementation

From `src/release/hash-utils-two-tier.ts`:

- `validateHashTier1()`: Fast path with trim + hash comparison
- `validateHashTier2()`: Slow path with normalizeSQLViaPrepare()

**Gap**: No benchmarks exist to verify performance targets are met.

---

## Implementation Plan

### File Changes

| File                                   | Changes                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `tests/bench/hash-validation.bench.ts` | Create benchmark suite for Tier 1 and Tier 2 validation |

### Pseudo-Code

```typescript
// tests/bench/hash-validation.bench.ts

import { bench, describe } from "vitest";
import { validateHashTier1 } from "../../src/release/hash-utils-two-tier";
import { createWorkerBridge } from "../../src/worker-bridge";

describe("TASK-423: Hash Validation Performance", () => {
  describe("Tier 1: Fast Path", () => {
    bench("should validate matching hash in < 0.1ms", async () => {
      const sql = "CREATE TABLE test (id INTEGER PRIMARY KEY);";
      const hash = await computeHash(sql);

      await validateHashTier1(sql, hash);
    });

    bench("should validate with whitespace in < 0.1ms", async () => {
      const sql = "  CREATE TABLE test (id INTEGER PRIMARY KEY);  ";
      const hash = await computeHash(sql.trim());

      await validateHashTier1(sql, hash);
    });

    bench("should detect mismatch in < 0.1ms", async () => {
      const sql = "CREATE TABLE test (id INTEGER PRIMARY KEY);";
      const wrongHash = "abc123";

      await validateHashTier1(sql, wrongHash);
    });
  });

  describe("Tier 2: Slow Path", () => {
    const workerBridge = await createWorkerBridge();

    bench("should normalize and validate in 1-5ms", async () => {
      const originalSQL = "CREATE TABLE test (id INTEGER PRIMARY KEY);";
      const currentSQL = "CREATE TABLE test (\n  id INTEGER PRIMARY KEY\n);";
      const originalHash = await computeHash(originalSQL);
      const currentHash = await computeHash(currentSQL);

      await validateHashTier2(
        originalSQL,
        currentSQL,
        originalHash,
        currentHash,
        workerBridge,
        "0.0.1",
        "migrationSQL",
      );
    });

    bench("should handle large SQL in 1-5ms", async () => {
      const largeSQL = generateLargeSQL(1000); // 1000 chars
      const reformattedSQL = reformatSQL(largeSQL);
      const originalHash = await computeHash(largeSQL);
      const currentHash = await computeHash(reformattedSQL);

      await validateHashTier2(
        largeSQL,
        reformattedSQL,
        originalHash,
        currentHash,
        workerBridge,
        "0.0.1",
        "migrationSQL",
      );
    });
  });

  describe("Various SQL Sizes", () => {
    const sizes = [50, 100, 500, 1000, 5000];

    sizes.forEach((size) => {
      bench(`Tier 1: ${size} chars`, async () => {
        const sql = generateSQL(size);
        const hash = await computeHash(sql);
        await validateHashTier1(sql, hash);
      });

      bench(`Tier 2: ${size} chars`, async () => {
        const sql = generateSQL(size);
        const reformattedSQL = reformatSQL(sql);
        const originalHash = await computeHash(sql);
        const currentHash = await computeHash(reformattedSQL);

        await validateHashTier2(
          sql,
          reformattedSQL,
          originalHash,
          currentHash,
          workerBridge,
          "0.0.1",
          "migrationSQL",
        );
      });
    });
  });
});
```

---

## Test Plan

### Unit Benchmarks

**Benchmark Suite 1: Tier 1 Performance**

- Matching hash (typical case)
- Whitespace normalization
- Hash mismatch detection
- Various SQL sizes (50, 100, 500, 1000, 5000 chars)

**Benchmark Suite 2: Tier 2 Performance**

- Normalization match (whitespace-only change)
- Large SQL statements
- Various SQL sizes
- Auto-update scenario

**Benchmark Suite 3: Comparison**

- Tier 1 vs Tier 2 performance delta
- Impact of SQL size on performance
- Worker communication overhead

### Verification Steps

1. Run benchmarks: `npm run bench`
2. Verify Tier 1 < 0.1ms for all cases
3. Verify Tier 2 1-5ms for all cases
4. Document results in spec
5. If targets not met, optimize code

---

## Risks & Considerations

### Risk: Benchmark Variance

Benchmarks can vary between runs due to:

- CPU load
- Worker initialization
- JavaScript JIT compilation

**Mitigation**:

- Run multiple iterations
- Use median time
- Run in consistent environment

### Risk: Worker Communication Overhead

Tier 2 requires worker communication for normalization:

- May add latency
- Could exceed 5ms target

**Mitigation**:

- Measure worker overhead separately
- Consider caching normalized SQL
- Optimize worker message handling

### Edge Case: Very Large SQL

SQL > 10KB may exceed targets:

- Tier 1 should still be fast (hash is fixed size)
- Tier 2 may be slower (prepare takes longer)

**Mitigation**:

- Test with various sizes
- Document size limitations
- Consider warnings for large SQL

---

## Definition of Done

- [ ] All file changes implemented
- [ ] Benchmarks passing (performance targets met)
- [ ] Code review checklist passed:
  - [ ] Three-Phase Pattern (1. Input / 2. Core / 3. Output)
  - [ ] No code duplication (2+ times)
  - [ ] Functions ≤ 30 lines
  - [ ] Nesting ≤ 3 levels
  - [ ] Parameters ≤ 4
  - [ ] TSDoc comments complete
- [ ] Design docs updated if implementation differed
- [ ] Task catalog marked complete with spec link
- [ ] Performance results documented

---

## Notes

**Performance Targets**:

- Tier 1: < 0.1ms (100 microseconds)
- Tier 2: 1-5ms (1000-5000 microseconds)

**Why These Targets?**:

- Tier 1 is simple string operations (trim, hash compare)
- Tier 2 requires worker communication and SQLite prepare
- Database open typically has 10-100ms budget
- Two-tier validation should be < 10% of open time

**Benchmark Tools**:

- Vitest provides `bench()` function
- Use `describe()` for organization
- Report median and percentiles

**Helper Functions Needed**:

- `computeHash()` - Compute SHA-256 hash
- `generateSQL(size)` - Generate SQL of specific size
- `reformatSQL(sql)` - Add whitespace to SQL
- `createWorkerBridge()` - Create worker for benchmarks

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26
