import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../../App.Host/wwwroot",
    emptyOutDir: true,
  },
});
