"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export function Drawer({ open, onClose, title, children, width = 480 }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <button
        aria-label="Fechar"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          border: 0,
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width,
          maxWidth: "100vw",
          height: "100vh",
          background: "var(--surface)",
          borderLeft: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          className="row between"
          style={{
            backgroundColor: "#0A0A1A",
            padding: "18px 22px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <h3 style={{ fontSize: 16 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={14} />
          </button>
        </header>
        <div style={{ backgroundColor: "#0A0A1A", flex: 1, overflow: "auto", padding: "22px" }}>{children}</div>
      </aside>
    </div>
  );
}
