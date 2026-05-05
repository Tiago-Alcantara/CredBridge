"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
} from "react";
import { Icon } from "@/components/primitives/Icon";

type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

const COLORS: Record<ToastKind, string> = {
  error: "var(--red)",
  success: "var(--green)",
  info: "var(--blue)",
};

const ICONS: Record<ToastKind, "shield" | "check" | "bolt"> = {
  error: "shield",
  success: "check",
  info: "bolt",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 10,
              background: "var(--bg-2)",
              border: `1px solid ${COLORS[t.kind]}44`,
              color: "var(--fg)",
              fontSize: 13,
              fontFamily: "var(--body)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              maxWidth: 360,
              pointerEvents: "auto",
              animation: "fadeSlideUp 0.2s ease",
            }}
          >
            <span style={{ color: COLORS[t.kind], flexShrink: 0 }}>
              <Icon name={ICONS[t.kind]} size={14} />
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
