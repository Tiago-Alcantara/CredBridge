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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={user} onToggleSidebar={() => setDrawerOpen((open) => !open)} />
      <div style={{ display: "flex", flex: 1 }}>
        {drawerOpen && (
          <button
            className="sidebar__overlay"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <Sidebar items={items} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
