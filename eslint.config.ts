import js from "@eslint/js";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint, { parser as eslintParserTypeScript } from "typescript-eslint";

export default defineConfig(
  {
    // .kilo holds an editor tool's copy of the whole repo. Left in, its tsconfig makes the
    // parser complain that it cannot tell which root it is looking at, and every file in
    // it gets linted twice over.
    ignores: ["**/node_modules/**", "dist/**", ".kilo/**", "public/tus.min.js"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    extends: [
      eslintPluginBetterTailwindcss.configs.recommended,
      eslintPluginBetterTailwindcss.configs.stylistic,
    ],
    languageOptions: {
      parser: eslintParserTypeScript,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/main.css",
      },
    },
    rules: {
      // Off because it and Prettier disagree and neither yields: the rule rewrites a long
      // class string across several lines, Prettier joins it back, and running the two in
      // sequence — which is exactly what `bun run format` and the autofix.ci workflow do —
      // lands in a two-state loop that never settles. That left autofix.ci reporting a diff
      // on every run, so it could never pass, and buried 457 warnings in the lint output
      // where a real one would not be noticed. Prettier owns formatting; this plugin keeps
      // the rule below, which catches a class name that does not exist.
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unknown-classes": [
        "warn",
        {
          ignore: [
            "^group(?:\\/(\\S*))?$",
            "^peer(?:\\/(\\S*))?$",
            "select_container",
            "convert_to_popup",
            "convert_to_group",
            "target",
            "convert_to_target",
            "job-details-toggle",
            // Set on <html> by the theme toggle, and read by Tailwind's dark variant
            "dark",
            // Hooks for script.js, like the ones above
            "recent-pills-list",
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ["**/*.{js,cjs,mjs,jsx}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
);
