import { readFileSync } from "node:fs";

interface PaquetNpm {
  version: string;
  description: string;
}

const paquet = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as PaquetNpm;

// Les clés préfixées `{{chrome}}` / `{{firefox}}` sont résolues par
// vite-plugin-web-extension selon la cible du build.
export function genereLeManifeste(): Record<string, unknown> {
  const icones = {
    16: "icone/16.png",
    32: "icone/32.png",
    48: "icone/48.png",
    128: "icone/128.png",
  };

  return {
    manifest_version: 3,
    name: "Détection de typosquatting",
    version: paquet.version,
    description: paquet.description,

    permissions: ["webNavigation", "tabs", "storage", "notifications"],
    host_permissions: ["<all_urls>"],

    "{{chrome}}.background": {
      service_worker: "src/arriere-plan/index.ts",
      type: "module",
    },
    "{{firefox}}.background": {
      scripts: ["src/arriere-plan/index.ts"],
      type: "module",
    },

    action: {
      default_title: "Détection de typosquatting",
      default_icon: icones,
      default_popup: "src/comparaison/index.html",
    },
    icons: icones,

    "{{firefox}}.browser_specific_settings": {
      gecko: {
        id: "anti-typosquatting@beta.gouv.fr",
        strict_min_version: "142.0",
        data_collection_permissions: { required: ["none"] },
      },
    },
  };
}
