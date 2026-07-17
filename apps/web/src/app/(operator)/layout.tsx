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
  { href: "/operator/dashboard?tab=cobrancas", icon: "wallet", label: "Cobranças Sacados" },
  { group: "CONTA" },
  { href: "/operator/dashboard?tab=settings", icon: "settings", label: "Configurações" },
];
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth("operator");
  const { data: me } = useMe();
  const { t } = useTranslation("en");

  if (!isReady) return null;

  const operatorSidebarItems: SidebarItem[] = [
    { href: "/operator/dashboard", icon: "chart", label: t("nav_op_overview") },
    { group: t("nav_group_operations") },
    { href: "/operator/dashboard?tab=receivables", icon: "doc", label: t("nav_op_validate") },
    { href: "/operator/dashboard?tab=transactions", icon: "zap", label: t("nav_op_pool_approvals") },
    { href: "/operator/dashboard?tab=pool-status", icon: "wallet", label: t("nav_op_pool_status") },
    { group: t("nav_group_account") },
    { href: "/operator/dashboard?tab=settings", icon: "settings", label: t("nav_settings") },
  ];

  const operatorUser = {
    name: me?.name ?? "Victor Hugo",
    initials: me?.name ? me.name.substring(0, 2).toUpperCase() : "OP",
    roleLabel: t("nav_role_operator"),
  };

  return (
    <AppShell items={operatorSidebarItems} user={operatorUser}>
      {children}
    </AppShell>
  );
}
