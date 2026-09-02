import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
}));
