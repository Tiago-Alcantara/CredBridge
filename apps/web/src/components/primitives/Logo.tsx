import Link from "next/link";

interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 28 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="cblg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00D4FF" />
          <stop offset="1" stopColor="#7B2FFF" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="url(#cblg)" strokeWidth="1" />
      <path
        d="M7 10.5 L14 6 L21 10.5 L14 15 Z"
        stroke="url(#cblg)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7 17.5 L14 22 L21 17.5"
        stroke="url(#cblg)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="10.5" r="1.3" fill="#00D4FF" />
    </svg>
  );
}

interface LogoProps {
  size?: number;
}

export function Logo({ size = 28 }: LogoProps) {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark">
        <LogoMark size={size} />
      </span>
      <span>CredBridge</span>
    </Link>
  );
}
