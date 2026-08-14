import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "github-pages"),
  base: "/safe-smartfarm-evaluator/",
  publicDir: path.resolve(import.meta.dirname, "public"),
  plugins: [react()],
  build: {
    outDir: path.resolve(import.meta.dirname, "out"),
    emptyOutDir: true,
  },
});
