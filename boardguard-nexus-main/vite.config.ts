import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: ["trello.enginemc.it", "localhost"],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'fs', 'path'],
      output: {
        globals: {
          'better-sqlite3': 'Database'
        }
      }
    },
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2015'
  }
}));
