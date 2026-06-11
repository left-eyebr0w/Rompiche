import * as React from "react";

/**
 * Uppercase mono kicker that sits above a heading or section title — the
 * brand's signature "BRANCHE CADRAGE" / "DOCUMENTATION DU PROJET" label.
 */
export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  /** Color tone. @default "muted" */
  tone?: "muted" | "ink" | "inverse";
  /** Element to render. @default "span" */
  as?: React.ElementType;
  children?: React.ReactNode;
}

export function Eyebrow(props: EyebrowProps): JSX.Element;
