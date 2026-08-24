import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Mirrors vercel.json's /api rewrite so the frontend can talk to the
    // backend same-origin in both dev and prod - the session cookie stays
    // first-party either way, instead of only working locally because
    // localhost happens to make cross-port requests same-site.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
