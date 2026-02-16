import { JSX } from "react";

// Simple Header component for the dashboard.
export function Header(): JSX.Element {
  return (
    <header>
      <h1 className="text-xl font-bold">mini-tsenta AI</h1>
      <p className="text-sm text-muted-foreground">
        Automated WorkAtAStartup Applier
      </p>
    </header>
  );
}
