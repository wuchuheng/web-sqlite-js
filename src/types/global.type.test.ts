/**
 * Type test file for global namespace types
 * This file is NOT executed - it's only compiled to verify type correctness
 *
 * Run with: npx tsc --noEmit src/types/global.type.test.ts
 */

import type { WebSqliteNamespace, DatabaseChangeEvent } from "./global";

// Type: Window.__web_sqlite should be WebSqliteNamespace
const ns: WebSqliteNamespace = window.__web_sqlite;
void ns; // Use variable to suppress unused warning

// Type: databases should be readonly
// @ts-expect-error - Cannot assign to readonly property
ns.databases = {};

// Type: onDatabaseChange returns unsubscribe function
const unsubscribe: () => void = window.__web_sqlite.onDatabaseChange(
  (event: DatabaseChangeEvent) => {
    // Type: event.action should be literal "opened" | "closed"
    const action: "opened" | "closed" = event.action;
    void action; // Use variable to suppress unused warning

    // Type: event.dbName should be string
    const name: string = event.dbName;
    void name; // Use variable to suppress unused warning

    // Type: event.databases should be string[]
    const dbs: string[] = event.databases;
    void dbs; // Use variable to suppress unused warning
  },
);
void unsubscribe; // Use variable to suppress unused warning

// Type: DatabaseChangeEvent properties - valid case
const event: DatabaseChangeEvent = {
  action: "opened",
  dbName: "test.sqlite3",
  databases: ["test.sqlite3"],
};
void event; // Use variable to suppress unused warning

// Type: WebSqliteNamespace is exported and usable
const namespaceType: WebSqliteNamespace = {
  databases: {},
  onDatabaseChange: () => () => {},
};
void namespaceType; // Use variable to suppress unused warning

// Type: DatabaseChangeEvent is exported and usable
const eventType: DatabaseChangeEvent = {
  action: "opened",
  dbName: "test.sqlite3",
  databases: [],
};
void eventType; // Use variable to suppress unused warning
