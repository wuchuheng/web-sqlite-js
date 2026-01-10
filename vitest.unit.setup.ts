/**
 * Setup file for unit tests
 * Provides a mock window object for browser API simulation
 */

// Create a minimal mock window object for unit tests
// The namespace is a singleton, so we don't reset it between tests
if (typeof global.window === "undefined") {
  global.window = {} as unknown as Window & typeof globalThis;
}
