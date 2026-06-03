"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/primitives/Icon";
import type { IconName } from "@/components/primitives/Icon";

export type { IconName };

export interface SidebarNavLink {
  href: string;
  icon: IconName;
  label: string;
  badge?: string;
}

export interface SidebarNavGroup {
  group: string;
}

export type SidebarItem = SidebarNavLink | SidebarNavGroup;

interface SidebarProps {
  items: SidebarItem[];
  footer?: React.ReactNode;
  open?: boolean;
  onClose?: () => void;
}

function isNavGroup(item: SidebarItem): item is SidebarNavGroup {
  return "group" in item;
}

export function Sidebar({ items, footer, open = false, onClose }: SidebarProps) {
  const currentPath = usePathname();

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`.trim()}>
      {items.map((item, index) => {
        if (isNavGroup(item)) {
          return (
            <div key={index} className="sidenav-group">
              {item.group}
            </div>
          );
        }

        const isActive = currentPath === item.href;

        return (
          <Link
            key={index}
            href={item.href}
            className={`sidenav-item ${isActive ? "active" : ""}`}
            onClick={onClose}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
            {item.badge && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: "var(--blue)",
                  fontFamily: "var(--sans)",
                  fontWeight: 600,
                }}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
      {footer && <div style={{ marginTop: "auto" }}>{footer}</div>}
    </aside>
  );
}
