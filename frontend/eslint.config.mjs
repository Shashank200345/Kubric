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
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Timed animation loops and reset-on-open patterns intentionally call
      // setState inside effects. Keep it visible as a warning, not a build blocker.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
