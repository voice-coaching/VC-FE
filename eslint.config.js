import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintPluginPrettier,
  globalIgnores([
    ".next/**",
    ".output/**",
    ".tanstack/**",
    ".wrangler/**",
    "out/**",
    "dist/**",
    "node_modules/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
