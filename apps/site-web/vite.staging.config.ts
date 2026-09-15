import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, mergeConfig } from "vite"
import base from "./vite.config"

export default mergeConfig(base, defineConfig({
  publicDir: false,
  build: { outDir: "dist-staging", emptyOutDir: true, sourcemap: false, rollupOptions: { input: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "staging.html") } },
}))
