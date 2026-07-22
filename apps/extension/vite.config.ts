import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import manifest from "./manifest.json";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL || "http://localhost:3000";
  const apiOrigin = new URL(apiUrl).origin;

  return {
    plugins: [
      react(),
      {
        name: "knewledge-manifest",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "manifest.json",
            source: JSON.stringify({ ...manifest, host_permissions: [`${apiOrigin}/*`] }, null, 2),
          });
        },
      },
    ],
    build: { outDir: "build", emptyOutDir: true, rollupOptions: { input: { popup: "popup.html" } } },
  };
});
