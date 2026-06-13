import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  prettier,
  {
    languageOptions: {
      parser: pluginVue.parser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: [".vue"],
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      ".netlify/**",
      ".nuxt/**",
      ".output/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
    ],
  },
];
