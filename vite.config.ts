import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig({
  base: "./",
  plugins: [sites()],
  server: {
    host: "127.0.0.1",
    port: 4188,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4189,
    strictPort: true,
  },
  build: {
    outDir: "dist/client",
    target: "es2022",
    sourcemap: false,
  },
});
