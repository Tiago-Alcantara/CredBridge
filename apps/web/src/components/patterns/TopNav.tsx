"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Lang = "pt" | "en";

interface TopNavProps {
  lang?: Lang;
  activePath?: string;
}

export function TopNav({ lang = "pt", activePath }: TopNavProps) {
  const { t } = useTranslation(lang);
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: "/",                       label: t("nav_product") },
    { href: "/#how",                   label: t("nav_howitworks") },
    { href: "/login?role=investor",    label: t("nav_investors") },
    { href: "/#api",                   label: t("nav_partners") },
    { href: "/#docs",                  label: t("nav_docs") },
  ];

  return (
    <nav className="appnav" style={{ position: "relative" }}>
      <div className="wrap-wide">
        <Logo />
        <button
          type="button"
          className="btn btn-ghost btn-sm js-nav-toggle topnav__menu-btn"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name="menu" size={16} />
        </button>
        <div className={`topnav__links ${menuOpen ? "topnav__links--open" : ""}`.trim()}>
          <div className="appnav-links" style={{ marginLeft: 24 }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`appnav-link ${activePath === link.href ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <Link className="appnav-link" href="/login" onClick={() => setMenuOpen(false)}>
            {t("nav_login")}
          </Link>
          <Link className="btn btn-primary btn-sm" href="/login" onClick={() => setMenuOpen(false)}>
            {t("cta_antecipar")} <Icon name="arrow_right" size={14} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
