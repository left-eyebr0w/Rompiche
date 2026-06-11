import * as React from "react";

/**
 * Primary action control. Monochrome — emphasis is carried by value and weight,
 * never color. `primary` is solid ink; `secondary` is an outline; `ghost` is
 * chrome-free until hover. `inverse` / `inverse-ghost` are for the dark viewport.
 *
 * @startingPoint section="Core" subtitle="Solid / outline / ghost, light + dark" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. @default "primary" */
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "inverse"
    | "inverse-ghost";
  /** Control height/padding. @default "md" */
  size?: "sm" | "md" | "lg";
  /** Use the mono "technical voice": uppercase, tracked, monospace. @default false */
  mono?: boolean;
  /** Element/icon rendered before the label. */
  iconLeft?: React.ReactNode;
  /** Element/icon rendered after the label. */
  iconRight?: React.ReactNode;
  /** Render as a different element (e.g. "a"). @default "button" */
  as?: React.ElementType;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
