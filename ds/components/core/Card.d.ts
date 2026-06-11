import * as React from "react";

/**
 * Surface panel — white fill, hairline border that goes black with a soft 2px
 * lift when interactive. The branch/page grid card from the doc system.
 *
 * @startingPoint section="Core" subtitle="Hairline card, hover lift, disabled" viewport="700x220"
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional heading rendered in the card head. */
  title?: React.ReactNode;
  /** Node placed at the top-right of the head (e.g. a Tag or arrow). */
  meta?: React.ReactNode;
  /** Apply hover lift even when not an anchor. @default false */
  interactive?: boolean;
  /** Dashed border + dimmed, non-interactive ("À venir"). @default false */
  disabled?: boolean;
  /** Remove inner padding (for media/flush content). @default false */
  flush?: boolean;
  /** Element to render (e.g. "a" for a linked card). @default "div" */
  as?: React.ElementType;
  children?: React.ReactNode;
}

export function Card(props: CardProps): JSX.Element;
