import { defineConfig, configDefaults } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "~": resolve(root, "app"),
      "@": resolve(root, "app"),
      // Nitro uses bracketed file and directory names ([id]) for dynamic route
      // params. Vite's static import analysis treats [ ] as glob characters and
      // fails to resolve those paths. Tests use these aliases instead so vite
      // resolves the files correctly without glob expansion.
      "@trips-id.get": resolve(root, "server/api/trips/[id].get"),
      "@trips-id.patch": resolve(root, "server/api/trips/[id].patch"),
      "@trips-id.delete": resolve(root, "server/api/trips/[id].delete"),
      "@trips-id-stops-handler": resolve(root, "server/api/trips/[id]/stops"),
      "@trips-id-stopid.patch": resolve(
        root,
        "server/api/trips/[id]/stops/[stopId].patch",
      ),
      "@trips-id-stopid.delete": resolve(
        root,
        "server/api/trips/[id]/stops/[stopId].delete",
      ),
    },
  },
  test: {
    environment: "happy-dom",
    // Spread configDefaults.exclude (which globs **/node_modules/**) rather than
    // replacing it — a bare "node_modules" string is not a glob and misses nested
    // copies like .netlify/plugins/node_modules created during the Netlify build.
    exclude: [...configDefaults.exclude, "e2e/**", ".netlify/**"],
    setupFiles: ["./vitest.setup.ts"],
    typecheck: {
      tsconfig: "./tsconfig.vitest.json",
    },
  },
});
