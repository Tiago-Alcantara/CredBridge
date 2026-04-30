export type IconName =
  | "home" | "box" | "zap" | "chart" | "wallet" | "code"
  | "settings" | "plus" | "arrow_right" | "arrow_up_right"
  | "upload" | "download" | "check" | "chain" | "shield"
  | "bell" | "search" | "key" | "webhook" | "doc" | "bolt"
  | "user" | "logout" | "copy" | "eye" | "menu";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

const iconPaths: Record<IconName, React.ReactNode> = {
  home:           <><path d="M3 11L12 4l9 7"/><path d="M5 10v10h14V10"/></>,
  box:            <><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></>,
  zap:            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
  chart:          <><path d="M3 20h18"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/></>,
  wallet:         <><path d="M3 6h15a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M3 9h18"/><circle cx="17" cy="15" r="1.2" fill="currentColor" stroke="none"/></>,
  code:           <><path d="M8 6l-5 6 5 6"/><path d="M16 6l5 6-5 6"/><path d="M14 4l-4 16"/></>,
  settings:       <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  plus:           <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  arrow_right:    <><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>,
  arrow_up_right: <><path d="M7 17L17 7"/><path d="M8 7h9v9"/></>,
  upload:         <><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/></>,
  download:       <><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/></>,
  check:          <path d="M5 12l5 5L20 6"/>,
  chain:          <><path d="M9.5 14.5a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L11 7.4"/><path d="M14.5 9.5a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6L13 16.6"/></>,
  shield:         <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>,
  bell:           <><path d="M6 10a6 6 0 1 1 12 0c0 4 2 6 2 6H4s2-2 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  search:         <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
  key:            <><circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M18 12v4"/><path d="M21 12v3"/></>,
  webhook:        <><circle cx="6" cy="7" r="3"/><circle cx="18" cy="17" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 5L14 14"/><path d="M15 17H9"/></>,
  doc:            <><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h7"/><path d="M10 17h7"/></>,
  bolt:           <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
  user:           <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></>,
  logout:         <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></>,
  copy:           <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
  eye:            <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  menu:           <><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>,
};

export function Icon({ name, size = 18, className }: IconProps) {
  const paths = iconPaths[name];
  if (!paths) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
