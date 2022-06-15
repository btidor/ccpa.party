/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Plugin, defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 4 * 1024,
    polyfillModulePreload: false,
    sourcemap: true,
  },
  plugins: [react(), go()],
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

// Plugin to compile our Go project to WASM, with hot reload. Uses the standard
// runner that ships with Go, which unfortunately pollutes globalThis.
function go(): Plugin {
  const trailer = `export default async function Run() {
    const data =
      typeof atob === "function"
        ? atob(wasm)
        : new Buffer(wasm, "base64").toString("binary");

    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data.charCodeAt(i);
    }
    const go = new Go();
    const result = await WebAssembly.instantiate(bytes, go.importObject);
    go.run(result.instance);
    return go;
  }`;
  return {
    name: "custom:go",
    configureServer(server) {
      const fn = (f: string) => {
        if (f.startsWith(path.join(server.config.root, "go/")))
          server.restart();
        if (f === path.join(server.config.root, "wasm_exec.js"))
          server.restart();
      };
      server.watcher.on("add", fn);
      server.watcher.on("change", fn);
      server.watcher.on("unlink", fn);
    },
    resolveId(id: string) {
      if (id === "@go") {
        return id;
      }
    },
    async load(id: string) {
      if (id === "@go") {
        const tmp = fs.mkdtempSync("/tmp/vite-go");
        const out = path.join(tmp, "go.wasm");
        await execFileSync("go", ["build", "-o", out, "."], {
          cwd: "go",
          env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
        });
        const data = fs.readFileSync(out);
        fs.rmSync(tmp, { recursive: true, force: true });

        const helper = await fs.readFileSync("./wasm_exec.js");
        return (
          `const wasm = "${data.toString("base64")}"\n\n` +
          helper.toString() +
          "\n\n" +
          trailer
        );
      }
    },
  };
}
