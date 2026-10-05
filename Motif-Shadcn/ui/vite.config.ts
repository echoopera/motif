import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// One IIFE script (React, Base UI, the audiocn components and the islands) plus the stylesheet as a string the script can adopt.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: { entry: "src/main.tsx", name: "MotifShadcn", formats: ["iife"], fileName: () => "motif-shadcn.js" },
    outDir: "dist", emptyOutDir: true, minify: "esbuild", cssCodeSplit: false, sourcemap: false, target: "es2022",
  },
});
