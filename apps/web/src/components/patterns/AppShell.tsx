"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AppTopBar } from "@/components/patterns/AppTopBar";
import type { AppTopBarUser } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";
import { Icon } from "@/components/primitives/Icon";
import { clearInternalSession } from "@/lib/api/auth-storage";

interface AppShellProps {
  items: SidebarItem[];
  user: AppTopBarUser;
  children: React.ReactNode;
}

export function AppShell({ items, user, children }: AppShellProps) {
  const router = useRouter();
  const { logout } = usePrivy();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Erro ao fazer logout no Privy:", err);
    }
    clearInternalSession();
    router.replace("/login");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={user} onToggleSidebar={() => setDrawerOpen((open) => !open)} sidebarOpen={drawerOpen} />
      <div style={{ display: "flex", flex: 1 }}>
        {drawerOpen && (
          <button
            type="button"
            className="sidebar__overlay"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <Sidebar
          items={items}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          hidden={isMobile && !drawerOpen}
          footer={
            <button
              onClick={handleLogout}
              className="sidenav-item"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--red)",
                fontWeight: 500,
                padding: "9px 10px",
              }}
            >
              <Icon name="logout" size={16} />
              <span>Sair da Conta</span>
            </button>
          }
        />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
