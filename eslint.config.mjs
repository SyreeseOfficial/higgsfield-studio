import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const BROWSER_GLOBALS = ["window", "document", "navigator", "localStorage", "sessionStorage", "indexedDB"].map(
  (name) => ({
    name,
    message: `Server-reachable code must not touch ${name} (SSR). Use it inside a client effect or handler.`,
  })
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Server actions, the platform client and the catalog run during SSR or on the server only.
  {
    files: [
      "generation/actions.ts",
      "generation/platform.ts",
      "generation/credentials.ts",
      "generation/errors.ts",
      "generation/to-platform.ts",
      "generation/catalog/**/*.ts",
      "app/api/**/*.ts",
    ],
    rules: { "no-restricted-globals": ["error", ...BROWSER_GLOBALS] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
