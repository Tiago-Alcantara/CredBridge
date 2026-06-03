"use client";

import type { SidebarItem } from "@/components/patterns/Sidebar";
import { AppShell } from "@/components/patterns/AppShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const investorSidebarItems: SidebarItem[] = [
  { href: "/investor/dashboard",      icon: "chart",    label: "Portfólio" },
  // @TODO estamos pensando em como organizar melhor as páginas de recebíveis e cotas, então por ora vamos deixar elas de fora do menu
  // { href: "/investor/recebiveis",     icon: "box",      label: "Recebíveis" },
  // { href: "/investor/cotas",          icon: "wallet",   label: "Cotas" },
  // { href: "/investor/auditoria",      icon: "shield",   label: "Auditoria" },
  { group: "CONTA" },
  { href: "/investor/configuracoes",  icon: "settings", label: "Configurações" },
];

const investorUser = {
  name: "Investor User",
  initials: "IN",
  roleLabel: "Investidor",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth("investor");

  if (!isReady) return null;

  return <AppShell items={investorSidebarItems} user={investorUser}>{children}</AppShell>;
}
