import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";

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
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={partnerUser} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar items={partnerSidebarItems} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
