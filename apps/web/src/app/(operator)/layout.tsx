"use client";

import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useMe } from "@/lib/api/me";

const operatorSidebarItems: SidebarItem[] = [
  { href: "/operator/dashboard", icon: "chart", label: "Painel Geral" },
  { group: "OPERAÇÕES" },
  { href: "/operator/dashboard?tab=receivables", icon: "doc", label: "Validar NF-es" },
  { href: "/operator/dashboard?tab=transactions", icon: "zap", label: "Aprovações Pool" },
  { group: "CONTA" },
  { href: "/operator/dashboard?tab=settings", icon: "settings", label: "Configurações" },
];

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth("operator");
  const { data: me } = useMe();

  if (!isReady) return null;

  const operatorUser = {
    name: me?.name ?? "Victor Hugo",
    initials: me?.name ? me.name.substring(0, 2).toUpperCase() : "OP",
    roleLabel: "Operador CredBridge",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={operatorUser} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar items={operatorSidebarItems} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
