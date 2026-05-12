"use client";

import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={investorUser} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar items={investorSidebarItems} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
