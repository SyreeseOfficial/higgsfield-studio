import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const BROWSER_GLOBALS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "indexedDB",
].map((name) => ({
  name,
  message: `Server-reachable code must not touch ${name} (SSR). Use it inside a client effect or handler.`,
}))

const ACTIVATION = [
  "onClick",
  "onMouseDown",
  "onMouseUp",
  "onKeyPress",
  "onKeyDown",
  "onKeyUp",
]

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
  // House rules for all app code.
  {
    files: ["**/*.{ts,tsx,mjs}"],
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      // Browser code logs through lib/studio/logger.ts, server code through log() in platform.ts.
      "no-console": "error",
      // A prompt, reference URL, request body or key must never be written to a log.
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.object.name="console"] Identifier[name=/^(prompt|url|urls|body|apiKey|upload_url|public_url|signedUrl)$/]`,
          message: "Do not log prompts, URLs, bodies or keys.",
        },
        {
          selector: `CallExpression[callee.name=/^(log|logError)$/] Identifier[name=/^(prompt|url|urls|body|apiKey|upload_url|public_url|signedUrl)$/]`,
          message: "Do not log prompts, URLs, bodies or keys.",
        },
      ],
      // Accessibility beyond the Next defaults.
      "jsx-a11y/click-events-have-key-events": "error",
      // Only real activation handlers count; drag, hover and load events do not make an element a control.
      "jsx-a11y/no-static-element-interactions": [
        "error",
        { handlers: ACTIVATION },
      ],
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        { handlers: ACTIVATION },
      ],
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/mouse-events-have-key-events": "error",
      // React.
      "react-hooks/exhaustive-deps": "error",
      "react/jsx-no-target-blank": "error",
      "react/no-array-index-key": "warn",
      "react/self-closing-comp": "error",
    },
  },
  // shadcn primitives take their control from the caller.
  {
    files: ["components/ui/**"],
    rules: { "jsx-a11y/label-has-associated-control": "off" },
  },
  {
    files: [
      "lib/studio/logger.ts",
      "generation/platform.ts",
      "tests/**",
      "scripts/**",
      "next.config.ts",
      "instrumentation.ts",
    ],
    rules: { "no-console": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
