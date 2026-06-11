import * as React from "react";

/**
 * Monochrome range control for the engine's continuous parameters — listener
 * position, density, gain, weather intensity [0–1]. Thin track, ink thumb,
 * optional tabular mono value readout.
 */
export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value" | "defaultValue"> {
  /** Label shown above the track. */
  label?: React.ReactNode;
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /** @default 1 */
  step?: number;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Format the readout (e.g. v => v.toFixed(2)). */
  formatValue?: (v: number) => React.ReactNode;
  /** Show the mono value readout. @default true */
  showValue?: boolean;
  /** Style for the dark viewport. @default false */
  inverse?: boolean;
  disabled?: boolean;
}

export function Slider(props: SliderProps): JSX.Element;
