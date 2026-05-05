"use client";

import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const pmeSidebarItems: SidebarItem[] = [
  { href: "/pme/dashboard",       icon: "home",     label: "Dashboard" },
  { href: "/pme/recebiveis",      icon: "box",      label: "Recebíveis" },
  { href: "/pme/documentos",      icon: "doc",      label: "Documentos" },
  { href: "/pme/liquidacao",      icon: "wallet",   label: "Liquidação" },
  { href: "/pme/auditoria",       icon: "shield",   label: "Auditoria" },
  { group: "CONTA" },
  { href: "/pme/configuracoes",   icon: "settings", label: "Configurações" },
];

const pmeUser = {
  name: "PME User",
  initials: "PM",
  roleLabel: "PME",
};

export default function PmeLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth("pme");

  if (!isReady) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={pmeUser} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar items={pmeSidebarItems} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
