import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  root: mode === "test" ? "." : "web",
  base: "/control/",
  plugins: [react()],
  build: {
    outDir: "../dist/control-web",
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    host: "127.0.0.1",
    strictPort: true,
    proxy: {
      "/api/v2": {
        target: "http://127.0.0.1:8081",
        changeOrigin: false,
      },
    },
  },
}));
