import { defineConfig } from "vitepress";
import { resolve } from "path";
import { withPwa } from "@vite-pwa/vitepress";
import { pwaOptions } from "./pwa";

// https://vitepress.dev/reference/site-config
export default withPwa(
  defineConfig({
    title: "Web Sqlite JS",
    description:
      "Client-side SQLite for the browser: a relational database with persistent storage on the user's device via OPFS.",
    head: [
      ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
      [
        "link",
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png",
        },
      ],
      [
        "link",
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon-16x16.png",
        },
      ],
      [
        "link",
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
      ],
      [
        "link",
        {
          rel: "stylesheet",
          href: "/font-awesome/all.min.css",
        },
      ],
      ["meta", { name: "theme-color", content: "#f7f4ec" }],
    ],
    pwa: pwaOptions,
    vite: {
      resolve: {
        alias: {
          "web-sqlite-js": resolve(__dirname, "../../"),
          "@": resolve(__dirname, "../../src"),
        },
      },
      // Ensure worker is handled correctly if imported from src
      worker: {
        format: "es",
      },
      plugins: [
        {
          name: "configure-response-headers",
          configureServer: (server) => {
            server.middlewares.use((_req, res, next) => {
              res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
              res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
              next();
            });
          },
        },
      ],
      server: {
        headers: {
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
        },
      },
    },
    themeConfig: {
      logo: "/logo.svg",
      // https://vitepress.dev/reference/default-theme-config
      nav: [
        { text: "Home", link: "/" },
        { text: "Getting Started", link: "/getting-started" },
        { text: "Releases", link: "/releases" },
        { text: "API", link: "/api" },
      ],

      sidebar: [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/getting-started" },
            { text: "Browser Compatibility", link: "/browser-compatibility" },
            { text: "Releases(Migration)", link: "/releases" },
            { text: "API", link: "/api" },
          ],
        },
      ],

      socialLinks: [
        { icon: "github", link: "https://github.com/wuchuheng/web-sqlite-js" },
      ],

      footer: {
        message: "Released under the MIT License.",
        copyright: "Copyright © 2025-present wuchuheng",
      },
    },
  })
);
