import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import astroPlugin from "eslint-plugin-astro";
import globals from "globals";

export default [
  js.configs.recommended,
  ...astroPlugin.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "dist/**",
      ".astro/**",
      ".vercel/**",
      "node_modules/**",
      ".claude/**",
      ".agents/**",
      ".codex/**",
      ".cursor/**",
      ".gemini/**",
      ".grok/**",
    ],
  },
];
