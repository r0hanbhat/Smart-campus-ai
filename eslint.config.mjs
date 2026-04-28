import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "build-js-check/**",
    "build-js-check-*/**",
    "build-webpack-check/**",
    "next-env.d.ts",
    "functions/src/**",
    "functions/lib/**",
    "functions/node_modules/**",
  ]),
]);

export default eslintConfig;
