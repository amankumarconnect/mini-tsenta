import { resolve } from "path"; // Import the 'resolve' function from Node.js 'path' module to resolve correct absolute paths.
import { defineConfig } from "electron-vite"; // Import 'defineConfig' helper from 'electron-vite' to provide type inference for the configuration.
import react from "@vitejs/plugin-react"; // Import the standard Vite plugin for React support (handling JSX, HMR, etc.).
import tailwindcss from "@tailwindcss/vite"; // Import the TailwindCSS Vite plugin to process Tailwind styles.

// Export the default configuration object for the Electron-Vite build process.
// This defines how the main process, preload scripts, and renderer process are bundled.
export default defineConfig({
  // Configuration settings for the Electron Main process compilation.
  // Currently empty, implying default behavior (e.g., entry point at src/main/index.ts).
  main: {},

  // Configuration settings for the Electron Preload scripts compilation.
  // Currently empty, implying default behavior (e.g., entry point at src/preload/index.ts).
  preload: {},

  // Configuration settings for the Renderer process (the React frontend).
  renderer: {
    // Configure module resolution options.
    resolve: {
      // Define path aliases to simplify imports and avoid relative path hell (e.g., ../../../).
      alias: {
        // Map '@renderer' to the absolute path of 'src/renderer/src'.
        "@renderer": resolve("src/renderer/src"),
        // Map '@' to the absolute path of 'src/renderer/src', a common convention in React projects.
        "@": resolve("src/renderer/src"),
      },
    },
    // Register plugins for the renderer build process.
    plugins: [
      tailwindcss(), // Activate the TailwindCSS plugin to compile utility classes.
      react(), // Activate the React plugin.
    ],
  },
});
