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
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function PmeLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth("pme");
  const { t } = useTranslation("en");

  if (!isReady) return null;

  const pmeSidebarItems: SidebarItem[] = [
    { href: "/pme/dashboard",     icon: "home",     label: t("nav_dashboard") },
    { group: t("nav_group_account") },
    { href: "/pme/configuracoes", icon: "settings", label: t("nav_settings") },
  ];

  const pmeUser = {
    name: "PME User",
    initials: "PM",
    roleLabel: t("role_pme"),
  };

  return <AppShell items={pmeSidebarItems} user={pmeUser}>{children}</AppShell>;
}
