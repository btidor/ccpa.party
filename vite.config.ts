/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import * as path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 4 * 1024,
  },
  plugins: [react()],
  resolve: {
    alias: [{ find: "@src", replacement: path.resolve(__dirname, "src") }],
  },
  server: {
    headers: {
      "Content-Security-Policy": [
        "default-src 'self' 'unsafe-eval' 'unsafe-inline' blob: data:",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'none'",
      ].join("; "),
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["src/setupTests.tsx"],
  },
});
