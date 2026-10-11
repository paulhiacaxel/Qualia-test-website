import type { ReactNode } from "react";
import { Aperture } from "./aperture";

export function AuthShell({
  title,
  eyebrow = "Welcome",
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="auth-page">
      <Aperture className="auth-aperture" />
      <div className="auth-container">
        <div className="auth-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {children}
      </div>
    </main>
  );
}
