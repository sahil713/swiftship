import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to Rails so the browser talks to a single origin in development.
    proxy: { "/api": { target: process.env.VITE_API_PROXY || "http://localhost:3000", changeOrigin: true } },
  },
});
