import { playwright } from '@vitest/browser-playwright'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Local-only config: runs the E2E suite against the system Chromium instead of
 * a Playwright-downloaded browser binary. NOT used on CI (CI uses
 * vitest.e2e.config.ts with Playwright-managed browsers).
 */
const rootDir = fileURLToPath(new URL('.', import.meta.url))
const srcDir = resolve(rootDir, 'src')
const headless = process.env.HEADERS === 'true'

export default defineConfig({
  test: {
    include: ['**/*.e2e.test.ts'],

    setupFiles: ['./vitest.e2e.setup.ts'],

    browser: {
      enabled: true,
      instances: [
        {
          browser: 'chromium',
        },
      ],
      provider: playwright({
        launchOptions: {
          executablePath: process.env.DIANZHI_SYSTEM_CHROMIUM ?? '/usr/bin/chromium-browser',
        },
      }),
      headless,
    },

    testTimeout: 1000 * 60 * 3,

    reporters: ['default'],
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  },

  build: {
    target: 'esnext',
    minify: false,
  },

  resolve: {
    alias: {
      '@': srcDir,
      'web-sqlite-js': resolve(srcDir, 'main.ts'),
    },
  },

  optimizeDeps: {
    exclude: ['web-sqlite-js'],
  },

  worker: {
    format: 'es',
  },
})
