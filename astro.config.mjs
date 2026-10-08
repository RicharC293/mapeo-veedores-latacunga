// @ts-check
import { defineConfig } from "astro/config";

import preact from "@astrojs/preact";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],
  adapter: vercel(),
  output: "server",
  vite: {
    // La plantilla de Excel se importa con "?inline" (ver la descarga de la
    // matriz): sin esto Vite intentaría leerla como código.
    assetsInclude: ["**/*.xlsx"],
  },
});
