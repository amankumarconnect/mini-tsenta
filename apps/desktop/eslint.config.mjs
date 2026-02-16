import { defineConfig } from "eslint/config"; // Import helper to define flat config with type safety.
import tseslint from "@electron-toolkit/eslint-config-ts"; // Import TypeScript-specific linting rules from electron-toolkit.
import eslintConfigPrettier from "@electron-toolkit/eslint-config-prettier"; // Import Prettier config to disable formatting-related lint rules.
import eslintPluginReact from "eslint-plugin-react"; // Import React specific linting rules.
import eslintPluginReactHooks from "eslint-plugin-react-hooks"; // Import React Hooks specific linting rules.
import eslintPluginReactRefresh from "eslint-plugin-react-refresh"; // Import React Refresh rules (for HMR).

// Export the default ESLint configuration array (Flat Config format).
export default defineConfig(
  // Global ignore patterns. ESLint will exclude these files/folders from linting.
  { ignores: ["**/node_modules", "**/dist", "**/out"] },

  // Apply recommended TypeScript linting rules.
  tseslint.configs.recommended,

  // Apply recommended React linting rules.
  eslintPluginReact.configs.flat.recommended,

  // Apply specific React JSX Runtime rules (for new JSX transform where 'React' import is not needed).
  eslintPluginReact.configs.flat["jsx-runtime"],

  // Global settings for the configuration.
  {
    settings: {
      react: {
        version: "detect", // Automatically detect the installed React version.
      },
    },
  },

  // Rules specific to TypeScript and TSX files.
  {
    files: ["**/*.{ts,tsx}"], // Apply these settings only to .ts and .tsx files.
    plugins: {
      "react-hooks": eslintPluginReactHooks, // Register the React Hooks plugin.
      "react-refresh": eslintPluginReactRefresh, // Register the React Refresh plugin.
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules, // Spread and apply recommended React Hooks rules.
      ...eslintPluginReactRefresh.configs.vite.rules, // Spread and apply recommended React Refresh rules for Vite.
    },
  },

  // Apply Prettier config last to override any conflicting formatting rules.
  eslintConfigPrettier,
);
