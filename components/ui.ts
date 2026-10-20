// Class names for the Figma Button (2:209) variants: 48px tall, 3px focus ring outside.

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed";

export const buttonClass = {
  primary: `${base} min-w-30 bg-primary px-5 py-3 text-ink-on-primary hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled-ink`,
  secondary: `${base} min-w-30 border border-border-input bg-surface px-5 py-3 text-primary hover:bg-primary-tint disabled:text-disabled-ink`,
  danger: `${base} min-w-30 bg-danger px-5 py-3 text-ink-on-primary hover:bg-danger-hover disabled:bg-disabled-bg disabled:text-disabled-ink`,
  ghost: `${base} px-2 py-3 text-primary hover:text-primary-hover hover:underline disabled:text-disabled-ink`,
};

export const fieldBoxClass =
  "flex h-12 w-full items-center gap-2 rounded-md border border-border-input bg-surface px-4 " +
  "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus";
