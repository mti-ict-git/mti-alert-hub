// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    // Keep app dependency prebundles separate from isolated preview/test servers.
    cacheDir: "node_modules/.vite-mti-app",
    optimizeDeps: { force: process.env.VITE_FORCE_OPTIMIZE === "1" },
    server: {
      proxy: {
        "/api": {
          target: process.env.DEV_API_TARGET ?? "http://127.0.0.1:4019",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
