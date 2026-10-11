import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { satellitePreview } from "./dev/satellite";

// Frontend build for Knox Atlas. Serves the desktop webview (Tauri, port 1420) now and the shared
// view-only web bundle later (Phase P4). Keep it framework-light around a custom canvas map engine.
export default defineConfig({
  plugins: [react(), satellitePreview()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist", target: "es2021", emptyOutDir: true },
});
