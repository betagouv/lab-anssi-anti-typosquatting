import { resolve } from "node:path";

import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { genereLeManifeste } from "./manifeste.config";

const navigateurCible = process.env["TARGET_BROWSER"] ?? "chrome";

// Le Firefox empaqueté par snap ne peut pas lire le profil temporaire que
// web-ext crée dans /tmp. On lui en donne un dans le dossier personnel.
const profilFirefox = {
  firefoxProfile: resolve("profil-firefox-dev"),
  profileCreateIfMissing: true,
  keepProfileChanges: true,
};

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/profil-firefox-dev/**", "**/dist/**", "**/donnees-sources/**"],
    },
  },
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
      additionalInputs: ["src/alerte/index.html", "src/comparaison/index.html"],
      webExtConfig: {
        target: navigateurCible === "firefox" ? ["firefox-desktop"] : ["chromium"],
        startUrl: ["about:blank"],
        ...(navigateurCible === "firefox" ? profilFirefox : {}),
      },
    }),
  ],
});
