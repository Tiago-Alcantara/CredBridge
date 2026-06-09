"use client";

import type { SidebarItem } from "@/components/patterns/Sidebar";
import { AppShell } from "@/components/patterns/AppShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const pmeSidebarItems: SidebarItem[] = [
  { href: "/pme/dashboard",       icon: "home",     label: "Dashboard" },
  { href: "/pme/cobrancas",       icon: "wallet",   label: "Cobranças" },
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

  return <AppShell items={pmeSidebarItems} user={pmeUser}>{children}</AppShell>;
}
