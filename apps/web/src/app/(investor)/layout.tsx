"use client";

import type { SidebarItem } from "@/components/patterns/Sidebar";
import { AppShell } from "@/components/patterns/AppShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth("investor");
  const { t } = useTranslation("en");

  if (!isReady) return null;

  const investorSidebarItems: SidebarItem[] = [
    { href: "/investor/dashboard",     icon: "chart",    label: t("nav_portfolio") },
    { group: t("nav_group_account") },
    { href: "/investor/configuracoes", icon: "settings", label: t("nav_settings") },
  ];

  const investorUser = {
    name: "Investor User",
    initials: "IN",
    roleLabel: t("role_inv"),
  };

  return <AppShell items={investorSidebarItems} user={investorUser}>{children}</AppShell>;
}
