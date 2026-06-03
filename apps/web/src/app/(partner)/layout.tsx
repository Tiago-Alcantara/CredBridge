"use client";

import type { SidebarItem } from "@/components/patterns/Sidebar";
import { AppShell } from "@/components/patterns/AppShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const partnerSidebarItems: SidebarItem[] = [
  { href: "/partner/dashboard",     icon: "home",     label: "Dashboard" },
  { href: "/partner/api-keys",      icon: "key",      label: "Chaves de API" },
  { href: "/partner/webhooks",      icon: "webhook",  label: "Webhooks" },
  { href: "/partner/monitor",       icon: "zap",      label: "Monitor" },
  { href: "/partner/docs",          icon: "doc",      label: "Documentação" },
  { group: "CONTA" },
  { href: "/partner/configuracoes", icon: "settings", label: "Configurações" },
];

const partnerUser = {
  name: "Partner User",
  initials: "PA",
  roleLabel: "Parceiro",
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth("partner");

  if (!isReady) return null;

  return <AppShell items={partnerSidebarItems} user={partnerUser}>{children}</AppShell>;
}
