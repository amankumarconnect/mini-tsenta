import "./assets/main.css"; // Import global CSS styles (Tailwind directives, etc.).

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App"; // Import the root React component.

// Mount the React application to the DOM element with ID 'root'.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
