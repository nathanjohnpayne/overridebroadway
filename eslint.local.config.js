// Repository-specific overlay for the generated Mergepath ESLint floor.
// Keep policy-floor changes in the upstream template; this file contains
// only the application-specific compatibility configuration.

const baseConfig = require("./eslint.config.js");
const next = require("@next/eslint-plugin-next");

module.exports = [
  ...baseConfig,
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { "@next/next": next },
  },
  {
    // Both config files are intentionally CommonJS in this repository.
    files: ["eslint.config.js", "eslint.local.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // This repo has an existing unused-import backlog. Keep the signal
    // visible without making a tooling repair fail before that cleanup.
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      "react/no-unescaped-entities": "warn",
    },
  },
];
