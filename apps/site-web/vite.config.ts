import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      strict: true,
      // The workspace also contains private evidence and operator files.
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "../../node_modules"),
        path.resolve(__dirname, "../../data/research/answer-units/scope2-website.v1.json"),
        path.resolve(__dirname, "../../data/research/answer-units/scope2-website.epa-inquiry.v1.json"),
        path.resolve(__dirname, "../../data/research/answer-units/scope2-website.epa-acquisition.v1.json"),
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
      "/api": {
        target: "http://localhost:3001",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
