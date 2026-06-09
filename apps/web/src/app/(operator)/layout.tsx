"use client";

import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useMe } from "@/lib/api/me";
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
