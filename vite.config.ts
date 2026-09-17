import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { genereLeManifeste } from "./manifeste.config";

const navigateurCible = process.env["TARGET_BROWSER"] ?? "chrome";

export default defineConfig({
  build: {
    outDir: `dist/${navigateurCible}`,
    emptyOutDir: true,
    target: "es2022",
    chunkSizeWarningLimit: 2048,
    assetsInlineLimit: 0,
  },
  plugins: [
    webExtension({
      manifest: genereLeManifeste,
      browser: navigateurCible,
      additionalInputs: ["src/alerte/index.html"],
      webExtConfig: {
        target: navigateurCible === "firefox" ? ["firefox-desktop"] : ["chromium"],
        startUrl: ["about:blank"],
      },
    }),
  ],
});
