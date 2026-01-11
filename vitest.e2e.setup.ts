/**
 * Setup file for E2E tests
 * Suppresses expected error and debug logs during testing
 */

// Suppress expected error logs from error isolation tests
// These tests intentionally throw errors to verify error handling
const originalError = console.error;

console.error = (...args: unknown[]) => {
  // Filter out expected error logs from error isolation pattern
  const message = args[0];
  if (
    typeof message === "string" &&
    (message === "[__web_sqlite] Event callback error:" ||
      message === "[LogDispatcher] Callback error:")
  ) {
    // Suppress these expected error logs during tests
    return;
  }
  // Pass through other errors
  originalError(...args);
};

// Suppress debug logs during E2E tests
// These are for development troubleshooting but clutter test output
const _originalDebug = console.debug;

console.debug = (..._args: unknown[]) => {
  // Suppress all console.debug output during tests
  // Uncomment to enable debug logs when troubleshooting:
  // _originalDebug(..._args);
};
