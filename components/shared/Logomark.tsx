type LogomarkProps = {
  size?: number;
  className?: string;
};

/**
 * Brand logomark — a fine gold ring with three sweeping lash-fan strokes.
 * Uses currentColor so it inherits color from a parent `text-*` class.
 */
export function Logomark({ size = 34, className = "" }: LogomarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1" />
      <path
        d="M9 22C13 11 18 9 22 16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M13 25C19 10 27 8 31 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M20 26C25 14 30 13 33 20"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
