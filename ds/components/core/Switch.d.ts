import * as React from "react";

/**
 * Monochrome on/off toggle — the engine's binary controls (météo on/off,
 * enable/disable an element). Off = outlined track with ink thumb; On = solid
 * ink track with white thumb. No color, ever.
 */
export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  /** Controlled checked state. */
  checked?: boolean;
  /** Uncontrolled initial state. */
  defaultChecked?: boolean;
  /** Change handler (receives the input event). */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Optional text label beside the track. */
  label?: React.ReactNode;
  /** Show a mono "ON"/"OFF" readout (reflects current state). @default false */
  showState?: boolean;
  /** Style for the dark viewport. @default false */
  inverse?: boolean;
  disabled?: boolean;
}

export function Switch(props: SwitchProps): JSX.Element;
