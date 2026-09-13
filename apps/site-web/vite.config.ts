import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const configDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(configDir, "./src"),
      "@m55-bill": path.resolve(configDir, "../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      strict: true,
      // The workspace also contains private evidence and operator files.
      allow: [
        path.resolve(configDir),
        path.resolve(configDir, "../../node_modules"),
        path.resolve(configDir, "../../data/research/answer-units/scope2-website.v1.json"),
        path.resolve(configDir, "../../data/research/answer-units/scope2-website.epa-inquiry.v1.json"),
        path.resolve(configDir, "../../data/research/answer-units/scope2-website.epa-acquisition.v1.json"),
        path.resolve(configDir, "../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf"),
      ],
      deny: [
        ".env", ".env.*", "*.{crt,pem,key,p12,pfx,cer,der}", ".npmrc", ".yarnrc.yml", "**/.git/**",
        "**/.superpowers/**", "**/data/research/{releases,conditions,candidates}/**", "**/*.candidate.json",
      ],
    },
    proxy: {
      "/research-api": {
        target: "http://127.0.0.1:3012",
        rewrite: (path) => path.replace(/^\/research-api/, "/research"),
      },
      "/calculation-api": {
        target: "http://127.0.0.1:3014",
        rewrite: (path) => path.replace(/^\/calculation-api/, "/calculation"),
      },
      "/workspace-api": {
        target: process.env.M54_WORKSPACE_TARGET ?? "http://127.0.0.1:3015",
        rewrite: (path) => path.replace(/^\/workspace-api/, ""),
      },
      "/api": {
        target: "http://localhost:3001",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
