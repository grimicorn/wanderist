import { defineConfig } from "vitest/config";
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
    },
  },
  test: {
    environment: "happy-dom",
    exclude: ["node_modules", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
    typecheck: {
      tsconfig: "./tsconfig.vitest.json",
    },
  },
});
