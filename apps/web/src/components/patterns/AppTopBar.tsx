"use client";

import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";
import { fmtTxHash } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/useTranslation";

export interface AppTopBarUser {
  name: string;
  initials: string;
  roleLabel: string;
  stellarAccountId?: string;
}

interface AppTopBarProps {
  user: AppTopBarUser;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function AppTopBar({ user, onToggleSidebar, sidebarOpen }: AppTopBarProps) {
  const { t } = useTranslation("en");
  const stellarDisplay = user.stellarAccountId
    ? fmtTxHash(user.stellarAccountId, 6)
    : "GA…X7Q";

  return (
    <nav className="appnav">
      <div className="wrap-wide">
        <button
          type="button"
          className="btn btn-ghost btn-sm js-sidebar-toggle appnav__menu"
          aria-label={sidebarOpen ? t("nav_close_menu") : t("nav_open_menu")}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          <Icon name="menu" size={16} />
        </button>
        <Logo />
        <span className="badge neutral no-dot" style={{ marginLeft: 4 }}>
          {user.roleLabel}
        </span>
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 8 }}>
          <div className="chip appnav__hide-sm">
            <span className="dot-live" />
            <span>Stellar</span>
            <span className="mono t-2" style={{ fontSize: 11 }}>{stellarDisplay}</span>
          </div>
          <button className="btn btn-ghost btn-sm" aria-label={t("search")}>
            <Icon name="search" size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" aria-label={t("nav_notifications")}>
            <Icon name="bell" size={14} />
          </button>
          <div
            className="row"
            style={{
              gap: 10,
              padding: "4px 10px 4px 4px",
              borderRadius: 999,
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--blue), var(--violet))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 12,
                color: "#04101A",
              }}
            >
              {user.initials}
            </div>
            <span className="appnav__hide-sm" style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
