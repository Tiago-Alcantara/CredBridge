"use client";

import type { SidebarItem } from "@/components/patterns/Sidebar";
import { AppShell } from "@/components/patterns/AppShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const pmeSidebarItems: SidebarItem[] = [
  { href: "/pme/dashboard",       icon: "home",     label: "Dashboard" },
  // @TODO estamos pensando em como organizar melhor as páginas de recebíveis e cotas, então por ora vamos deixar elas de fora do menu
  // { href: "/pme/recebiveis",      icon: "box",      label: "Recebíveis" },
  // { href: "/pme/documentos",      icon: "doc",      label: "Documentos" },
  // { href: "/pme/liquidacao",      icon: "wallet",   label: "Liquidação" },
  // { href: "/pme/auditoria",       icon: "shield",   label: "Auditoria" },
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
