import * as React from "react";

/**
 * Small uppercase mono pill for status / metadata. Mirrors the doc system's
 * tag language: `spec` = a decided, authoritative value (black border);
 * `tbd` = open/placeholder (dashed); `solid` = filled ink chip.
 */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "default" */
  variant?: "default" | "spec" | "tbd" | "solid";
  /** Style for the dark viewport context. @default false */
  inverse?: boolean;
  /** Show a leading status dot. @default false */
  dot?: boolean;
  children?: React.ReactNode;
}

export function Tag(props: TagProps): JSX.Element;
