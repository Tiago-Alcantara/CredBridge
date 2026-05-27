"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Icon } from "@/components/primitives/Icon";
import { usePrivySessionBootstrap } from "@/hooks/usePrivySessionBootstrap";
import { clearInternalSession } from "@/lib/api/auth-storage";

const AUTO_BOOTSTRAP_ATTEMPT_KEY = "credbridge.privyAutoBootstrapAttempted";

function hasAutomaticBootstrapAttempt(): boolean {
  try {
    return window.sessionStorage.getItem(AUTO_BOOTSTRAP_ATTEMPT_KEY) === "1";
  } catch {
    return false;
  }
}

function markAutomaticBootstrapAttempt(): void {
  try {
    window.sessionStorage.setItem(AUTO_BOOTSTRAP_ATTEMPT_KEY, "1");
  } catch {
    /* ignore disabled storage */
  }
}

function clearAutomaticBootstrapAttempt(): void {
  try {
    window.sessionStorage.removeItem(AUTO_BOOTSTRAP_ATTEMPT_KEY);
  } catch {
    /* ignore disabled storage */
  }
}

interface PrivyLoginPanelProps {
  targetRole?: "pme" | "investor" | "operator";
}

export function PrivyLoginPanel({ targetRole = "pme" }: PrivyLoginPanelProps) {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();
  const { login } = useLogin();
  const [roleError, setRoleError] = useState<string | null>(null);
  const {
    bootstrapSession,
    canBootstrapSession,
    isBootstrapping,
    error,
  } = usePrivySessionBootstrap();
  const didBootstrapRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const continueWithPrivy = useCallback(async () => {
    setRoleError(null);
    if (!authenticated) {
      login();
      return;
    }

    try {
      const session = await bootstrapSession();

      if (session.user.role !== targetRole) {
        await logout();
        clearAutomaticBootstrapAttempt();
        clearInternalSession();
        setRoleError(
          `Esta conta está registrada como ${session.user.role ? session.user.role.toUpperCase() : "desconhecido"}. Por favor, use o portal de login correto.`
        );
        return;
      }

      router.push(
        targetRole === "operator"
          ? "/operator/dashboard"
          : targetRole === "pme"
            ? "/pme/dashboard"
            : "/investor/dashboard",
      );
    } catch {
      return;
    }
  }, [authenticated, bootstrapSession, login, logout, router, targetRole]);

  useEffect(() => {
    if (ready && !authenticated) {
      clearAutomaticBootstrapAttempt();
      return;
    }

    if (
      !ready ||
      !authenticated ||
      !canBootstrapSession ||
      didBootstrapRef.current ||
      hasAutomaticBootstrapAttempt()
    ) {
      return;
    }

    didBootstrapRef.current = true;
    markAutomaticBootstrapAttempt();
    void continueWithPrivy();
  }, [authenticated, canBootstrapSession, continueWithPrivy, ready]);

  const restartLogin = useCallback(async () => {
    await logout();
    clearAutomaticBootstrapAttempt();
    clearInternalSession();
    setRoleError(null);
  }, [logout]);

  const getRoleName = () => {
    switch (targetRole) {
      case "pme": return "Empresas (PME)";
      case "investor": return "Investidores";
      case "operator": return "Operadores";
    }
  };

  return (
    <div style={{ margin: "auto 0", width: "100%", maxWidth: 440 }}>
      <h2 style={{ fontSize: 32, marginBottom: 8 }}>Entrar como {getRoleName()}</h2>
      <p className="t-2" style={{ marginBottom: 32, fontSize: 14 }}>
        Entre com Privy para criar sua sessão e sua carteira Stellar com segurança.
      </p>

      {(error || roleError) && (
        <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>
          {error || roleError}
        </p>
      )}

      <button
        className="btn btn-primary btn-lg"
        style={{ width: "100%" }}
        onClick={continueWithPrivy}
        disabled={!mounted || !ready || isBootstrapping}
      >
        {isBootstrapping
          ? "Preparando carteira e sessão..."
          : authenticated
            ? "Continuar"
            : "Entrar com Privy"}
        {!isBootstrapping && <Icon name="arrow_right" size={16} />}
      </button>

      {authenticated && (
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 12 }}
          onClick={restartLogin}
        >
          Usar outra conta
        </button>
      )}
    </div>
  );
}
