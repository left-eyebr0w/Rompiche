import * as React from "react";

/**
 * Left-bordered aside for a key statement, definition or caveat — the doc
 * system's `.callout`. Black border = important; gray = muted aside.
 */
export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "default" */
  variant?: "default" | "muted" | "inverse";
  /** Optional bold lead-in rendered inline before the body. */
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function Callout(props: CalloutProps): JSX.Element;
