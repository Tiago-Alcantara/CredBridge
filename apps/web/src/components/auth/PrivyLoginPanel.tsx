"use client";

import { useCallback, useEffect, useRef } from "react";
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

export function PrivyLoginPanel() {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();
  const { login } = useLogin();
  const {
    bootstrapSession,
    canBootstrapSession,
    isBootstrapping,
    error,
  } = usePrivySessionBootstrap();
  const didBootstrapRef = useRef(false);

  const continueWithPrivy = useCallback(async () => {
    if (!authenticated) {
      login();
      return;
    }

    try {
      const session = await bootstrapSession();
      if (session.needsRoleSelection || !session.user.role) {
        router.push("/onboarding/role");
        return;
      }

      router.push(
        session.user.role === "pme" ? "/pme/dashboard" : "/investor/dashboard",
      );
    } catch {
      return;
    }
  }, [authenticated, bootstrapSession, login, router]);

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
  }, [logout]);

  return (
    <div style={{ margin: "auto 0", width: "100%", maxWidth: 440 }}>
      <h2 style={{ fontSize: 32, marginBottom: 8 }}>Entrar na CredBridge</h2>
      <p className="t-2" style={{ marginBottom: 32, fontSize: 14 }}>
        Entre com Privy para criar sua sessão e sua carteira Stellar com segurança.
      </p>

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}

      <button
        className="btn btn-primary btn-lg"
        style={{ width: "100%" }}
        onClick={continueWithPrivy}
        disabled={!ready || isBootstrapping}
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
