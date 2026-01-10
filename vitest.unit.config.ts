import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const srcDir = resolve(rootDir, "src");

/**
 * Unified E2E Test Configuration for SQLite3 WASM
 *
 * This configuration supports:
 * - OPFS E2E tests in src/jswasm/vfs/opfs/
 * - Browser E2E tests in tests/browser/
 * - Required headers for OPFS and SharedArrayBuffer functionality
 */
export default defineConfig({
  test: {
    include: ["**/*.unit.test.ts"],
    setupFiles: ["./vitest.unit.setup.ts"],
  },
  resolve: {
    alias: {
      "@": srcDir,
      "web-sqlite-js": resolve(srcDir, "main.ts"),
    },
  },

  /* Optimize dependencies */
  optimizeDeps: {
    exclude: ["web-sqlite-js"],
  },
});
