import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { sync } from "glob";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: "@emotion/react",
    }),
    tailwindcss(),
  ],
  root: resolve(__dirname, "frontend"),
  build: {
    emptyOutDir: true,
    outDir: resolve(__dirname, "dist"),
    rollupOptions: {
      input: sync(resolve(__dirname, "frontend", "**/**.html")),
    },
  },
});
