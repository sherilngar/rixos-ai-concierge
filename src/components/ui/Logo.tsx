/**
 * Neutral text placeholder until the hotel supplies its official logo file.
 * To use the real logo, put it in public/brand/ and set LOGO_SRC (and its size);
 * the file is shown as-is, never redrawn.
 */
const LOGO_SRC: string | null = null;
const LOGO_SIZE = { width: 200, height: 60 };

export function Logo({ className = 'h-10' }: { className?: string }) {
  if (LOGO_SRC)
    return (
      <img
        src={LOGO_SRC}
        alt="Rixos Bab Al Bahr"
        width={LOGO_SIZE.width}
        height={LOGO_SIZE.height}
        className={`logo-img w-auto ${className}`}
      />
    );
  return (
    <svg
      viewBox="0 0 200 60"
      className={`w-auto text-fg ${className}`}
      role="img"
      aria-label="Rixos Bab Al Bahr"
    >
      <text
        x="0"
        y="34"
        fill="currentColor"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontSize="34"
        fontWeight="500"
        letterSpacing="6"
      >
        RIXOS
      </text>
      <text
        x="1"
        y="54"
        fill="currentColor"
        fontFamily="Rubik, system-ui, sans-serif"
        fontSize="11.5"
        letterSpacing="4.2"
        opacity="0.75"
      >
        BAB AL BAHR
      </text>
    </svg>
  );
}
