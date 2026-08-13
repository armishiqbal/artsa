import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next@14 ships legacy (eslintrc) presets; FlatCompat translates
// them to flat config so `npm run lint` can run headless via the ESLint CLI.
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Canonical Next.js presets: react, react-hooks, @next/next core-web-vitals,
  // plus @typescript-eslint/recommended from the next/typescript preset.
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Build artifacts, generated types, and framework config files are not source.
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
    ],
  },
];

export default eslintConfig;
