import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import type { Plugin } from "vite";

// Redirect bare root "/" to the app's base path so the workflow health probe
// (which hits http://localhost:PORT/) gets a 200 instead of a 404.
function rootRedirectPlugin(basePath: string): Plugin {
  return {
    name: "root-redirect",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/" || req.url === "") {
          res.writeHead(302, { Location: basePath });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

const basePath = process.env.BASE_PATH || "/marbith-website/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    rootRedirectPlugin(basePath),
    ...(process.env.REPL_ID !== undefined ? [runtimeErrorOverlay()] : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "::",
    port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
    strictPort: false,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    host: "::",
    port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
    allowedHosts: true,
  },
});
