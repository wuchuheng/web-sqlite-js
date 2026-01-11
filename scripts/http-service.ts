#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";

/**
 * -----------------------
 * CLI Definition
 * -----------------------
 */
const program = new Command();

program
  .name("http-service")
  .description("Minimal static HTTP server (TypeScript, single file)")
  .argument("[root]", "static file root directory", ".")
  .option("-p, --port <number>", "port number", "8080")
  .option("--header <header...>", "custom response header (key:value)")
  .option("--cors", "enable CORS")
  .option("--base-url <url>", "base URL path (e.g., /index.html)")
  .helpOption("-h, --help", "display help");

program.parse();

const opts = program.opts();
const rootDir = path.resolve(process.cwd(), program.args[0] ?? ".");
const port = Number(opts.port);

/**
 * -----------------------
 * Header Parsing
 * -----------------------
 */
const customHeaders = new Map<string, string>();

if (Array.isArray(opts.header)) {
  for (const entry of opts.header) {
    const index = entry.indexOf(":");
    if (index === -1) {
      throw new Error(`Invalid header format: "${entry}" (expected key:value)`);
    }
    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    customHeaders.set(key, value);
  }
}

/**
 * -----------------------
 * MIME Types
 * -----------------------
 */
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
};

/**
 * -----------------------
 * HTTP Server
 * -----------------------
 */
const server = http.createServer((req, res) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) {
    res.writeHead(405);
    res.end();
    return;
  }

  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let filePath = path.join(rootDir, urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  /**
   * Apply headers
   */
  for (const [k, v] of customHeaders) {
    res.setHeader(k, v);
  }

  if (opts.cors) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  }

  const ext = path.extname(filePath);
  res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");

  fs.createReadStream(filePath).pipe(res);
});

/**
 * -----------------------
 * Start Server
 * -----------------------
 */
server.listen(port, () => {
  console.log(`✔ HTTP server running`);
  console.log(`✔ Root: ${rootDir}`);

  // Build full URL with base-url if provided
  const baseUrl = opts.baseUrl ?? "";
  const fullUrl = `http://localhost:${port}${baseUrl}`;

  console.log(`✔ ${fullUrl}`);
});
