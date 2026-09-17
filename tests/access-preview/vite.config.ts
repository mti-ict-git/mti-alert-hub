import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
  root: path.resolve("tests/access-preview"),
  cacheDir: "../../node_modules/.vite-access-preview",
  plugins: [react(), tailwind()],
  resolve: { alias: { "@": path.resolve("src") } },
  server: { host: "127.0.0.1", port: 4207, strictPort: true },
  define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") },
});
