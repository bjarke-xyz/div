import react from "@vitejs/plugin-react";
import { sync } from "glob";
import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: "@emotion/react",
    }),
  ],
  root: resolve(__dirname, "src"),
  build: {
    emptyOutDir: true,
    outDir: resolve(__dirname, "dist"),
    rollupOptions: {
      input: sync(resolve(__dirname, "src", "**/**.html")),
    },
  },
});
