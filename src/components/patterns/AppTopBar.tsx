"use client";

import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";
import { fmtTxHash } from "@/lib/format";

interface AppTopBarUser {
  name: string;
  initials: string;
  roleLabel: string;
  stellarAccountId?: string;
}

interface AppTopBarProps {
  user: AppTopBarUser;
}

export function AppTopBar({ user }: AppTopBarProps) {
  const stellarDisplay = user.stellarAccountId
    ? fmtTxHash(user.stellarAccountId, 6)
    : "GA…X7Q";

  return (
    <nav className="appnav">
      <div className="wrap-wide">
        <Logo />
        <span className="badge neutral no-dot" style={{ marginLeft: 4 }}>
          {user.roleLabel}
        </span>
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 8 }}>
          <div className="chip">
            <span className="dot-live" />
            <span>Stellar</span>
            <span className="mono t-2" style={{ fontSize: 11 }}>{stellarDisplay}</span>
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Buscar">
            <Icon name="search" size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" aria-label="Notificações">
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
            <span style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
