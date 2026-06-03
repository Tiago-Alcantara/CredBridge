"use client";

import { useEffect, useState } from "react";
import { AppTopBar } from "@/components/patterns/AppTopBar";
import type { AppTopBarUser } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";

interface AppShellProps {
  items: SidebarItem[];
  user: AppTopBarUser;
  children: React.ReactNode;
}

export function AppShell({ items, user, children }: AppShellProps) {
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
        <Sidebar items={items} open={drawerOpen} onClose={() => setDrawerOpen(false)} hidden={isMobile && !drawerOpen} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
