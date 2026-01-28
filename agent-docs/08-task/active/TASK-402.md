# TASK-402: Update Release Manager to Populate Original SQL Columns

**Status**: ✅ COMPLETED - [Archived](../archive/TASK-402-Update-Release-Manager-to-Populate-Original-SQL-Columns/v1-impl.md)
**Priority**: P0 (Blocker)
**Estimated**: 4 hours
**Owner**: S8 Worker
**Dependencies**: TASK-401 (Schema columns added)

---

## Overview

Update the release manager to store original SQL (migration and seed) when creating releases. This enables F-003 two-tier validation: the original SQL is stored at release time and used later for normalized comparison when hash mismatches occur.

---

## Implementation Summary

### Files Changed

1. **`src/types/DB.ts`**
   - Added `originalMigrationSQL` and `originalSeedSQL` Maps to `DatabaseRecord` interface
   - Updated TSDoc comments with F-003 examples

2. **`src/release/types.ts`**
   - Added `originalMigrationSQL` and `originalSeedSQL` to `ReleaseConfigWithHash` type
   - Added `originalMigrationSQL` and `originalSeedSQL` to `ReleaseRow` type

3. **`src/release/hash-utils.ts`**
   - Updated `validateAndHashReleases()` to store original SQL in result
   - Added TSDoc comments documenting original SQL storage

4. **`src/release/release-manager.ts`**
   - Created `originalMigrationSQLMap` and `originalSeedSQLMap` in-memory Maps
   - Updated queries to include original SQL columns from metadata
   - Updated `applyVersion()` to insert original SQL into database
   - Updated `DatabaseRecord` to include original SQL Maps
   - Updated `devToolRollback()` to remove from Maps on rollback

### Key Features

- Original SQL stored in metadata database on release creation
- Original SQL Maps populated in memory for fast access
- Backward compatible with databases created before F-003
- Type definitions consistently updated across all files

---

**Created**: 2026-01-26
**Completed**: 2026-01-26
