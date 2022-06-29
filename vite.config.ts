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
  plugins: [react(), goDev()],
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
  },
  worker: {
    plugins: [goProd()],
  },
});

// Plugin to compile our Go project to WASM, with hot reload. Uses the standard
// runner that ships with Go, which unfortunately pollutes globalThis.
function goDev(): Plugin {
  return {
    name: "custom:go",
    apply: "serve",
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
        await execFileSync(
          "../node_modules/.go/bin/go",
          ["build", "-o", out, "."],
          {
            cwd: "go",
            env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
          }
        );
        const data = fs.readFileSync(out);
        fs.rmSync(tmp, { recursive: true, force: true });

        return `const wasm = "${data.toString("base64")}";

        ${await fs.readFileSync("./wasm_exec.js")}

        export default async function Run() {
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
      }
    },
  };
}

function goProd(): Plugin {
  return {
    name: "custom:go",
    apply: "build",
    resolveId(id: string) {
      if (id === "@go") {
        return id;
      }
    },
    async load(id: string) {
      if (id === "@go") {
        const tmp = fs.mkdtempSync("/tmp/vite-go");
        const out = path.join(tmp, "go.wasm");
        await execFileSync(
          "../node_modules/.go/bin/go",
          [
            "build",
            "-trimpath",
            "-buildvcs=false",
            "-ldflags",
            "-s -w -buildid=",
            "-o",
            out,
            ".",
          ],
          {
            cwd: "go",
            env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
          }
        );
        const ref = this.emitFile({
          type: "asset",
          name: "go.wasm",
          source: fs.readFileSync(out),
        });
        fs.rmSync(tmp, { recursive: true, force: true });

        return `${await fs.readFileSync("./wasm_exec.js")}

        export default async function Run() {
          const go = new Go();
          const result = await WebAssembly.instantiateStreaming(
            fetch("__VITE_ASSET__${ref}__"), go.importObject,
          );
          go.run(result.instance);
          return go;
        }`;
      }
    },
  };
}
