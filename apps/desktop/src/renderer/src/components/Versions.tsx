import { useState } from "react";

// Component to display the versions of Electron, Chromium, and Node.js.
// Useful for debugging and verification of the runtime environment.
function Versions(): React.JSX.Element {
  // Access versions from the exposed Electron API (contextBridge in preload).
  const [versions] = useState(window.electron.process.versions);

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{versions.electron}</li>
      <li className="chrome-version">Chromium v{versions.chrome}</li>
      <li className="node-version">Node v{versions.node}</li>
    </ul>
  );
}

export default Versions;
