"use client";

import { AppShell } from "@/components/patterns/AppShell";
import type { SidebarItem } from "@/components/patterns/Sidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useMe } from "@/lib/api/me";

const operatorSidebarItems: SidebarItem[] = [
  { href: "/operator/dashboard", icon: "chart", label: "Painel Geral" },
  { group: "OPERAÇÕES" },
  { href: "/operator/dashboard?tab=receivables", icon: "doc", label: "Validar NF-es" },
  { href: "/operator/dashboard?tab=transactions", icon: "zap", label: "Aprovações Pool" },
  { href: "/operator/dashboard?tab=pool-status", icon: "wallet", label: "Situação pool" },
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
    <AppShell items={operatorSidebarItems} user={operatorUser}>
      {children}
    </AppShell>
  );
}
