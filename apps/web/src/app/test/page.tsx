"use client";

import { useState } from "react";
import { useReceivables, useCreateReceivable } from "@/lib/api/receivables";
import { useLogin, useRegister, logout } from "@/lib/api/auth";
import { extractApiErrorMessage } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/auth-storage";

interface PingResponse {
  status: string;
  message: string;
  timestamp: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function TestPage() {
  const [response, setResponse] = useState<PingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const receivables = useReceivables();
  const createReceivable = useCreateReceivable();
  const [createError, setCreateError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const login = useLogin();
  const register = useRegister();
  const [email, setEmail] = useState("test@test.com");
  const [password, setPassword] = useState("secret123");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  async function handlePing() {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(`${API_URL}/v1/health/ping`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as PingResponse;
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setAuthError(null);
    setAuthStatus(null);
    try {
      const res = await login.mutateAsync({ email, password });
      setAuthStatus(`logged in as ${res.user.email} (${res.user.role})`);
    } catch (err) {
      setAuthError(extractApiErrorMessage(err));
    }
  }

  async function handleRegister() {
    setAuthError(null);
    setAuthStatus(null);
    try {
      const res = await register.mutateAsync({ email, password });
      setAuthStatus(`registered + logged in as ${res.user.email}`);
    } catch (err) {
      setAuthError(extractApiErrorMessage(err));
    }
  }

  function handleLogout() {
    logout();
    setAuthStatus("logged out");
  }

  async function handleCreate() {
    setCreateError(null);
    const validInput = {
      userId: "u1",
      value: 1234.56,
      type: "invoice" as const,
      debtorName: "ACME LTDA",
      debtorDocument: "12345678000199",
      dueDate: "2026-12-01",
    };
    const invalidInput = {
      userId: "u1",
    } as unknown as typeof validInput;
    try {
      await createReceivable.mutateAsync(invalid ? invalidInput : validInput);
    } catch (err) {
      setCreateError(extractApiErrorMessage(err));
    }
  }

  const tokenPresent = typeof window !== "undefined" && !!getAccessToken();

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1>Test API Connection</h1>
      <p>
        Calls <code>{API_URL}/v1/health/ping</code> and shows the JSON response.
      </p>

      <button
        onClick={handlePing}
        disabled={loading}
        style={{
          padding: "12px 24px",
          fontSize: 16,
          cursor: loading ? "not-allowed" : "pointer",
          background: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: 6,
          marginTop: 16,
        }}
      >
        {loading ? "Calling..." : "Ping API"}
      </button>

      {response && (
        <pre
          style={{
            marginTop: 24,
            padding: 16,
            background: "#0a0a0a",
            color: "#0f0",
            borderRadius: 6,
            overflow: "auto",
          }}
        >
          {JSON.stringify(response, null, 2)}
        </pre>
      )}

      {error && (
        <pre
          style={{
            marginTop: 24,
            padding: 16,
            background: "#3a0000",
            color: "#f88",
            borderRadius: 6,
          }}
        >
          Error: {error}
        </pre>
      )}

      <hr style={{ margin: "32px 0", borderColor: "#222" }} />

      <h2>Auth (JWT)</h2>
      <p style={{ fontSize: 13, color: "#888" }}>
        token in storage: <code>{tokenPresent ? "yes" : "no"}</code>
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          style={{ flex: 1, padding: 8, background: "#111", border: "1px solid #333", color: "white", borderRadius: 4 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          style={{ flex: 1, padding: 8, background: "#111", border: "1px solid #333", color: "white", borderRadius: 4 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={handleRegister} disabled={register.isPending} style={{ padding: "8px 14px" }}>
          {register.isPending ? "..." : "Register"}
        </button>
        <button onClick={handleLogin} disabled={login.isPending} style={{ padding: "8px 14px" }}>
          {login.isPending ? "..." : "Login"}
        </button>
        <button onClick={handleLogout} style={{ padding: "8px 14px" }}>
          Logout
        </button>
      </div>
      {authStatus && (
        <pre style={{ marginTop: 12, padding: 10, background: "#012", color: "#9cf", borderRadius: 6 }}>
          {authStatus}
        </pre>
      )}
      {authError && (
        <pre style={{ marginTop: 12, padding: 10, background: "#3a0000", color: "#f88", borderRadius: 6, whiteSpace: "pre-wrap" }}>
          {authError}
        </pre>
      )}

      <hr style={{ margin: "32px 0", borderColor: "#222" }} />

      <h2>Receivables (TanStack Query)</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        <button
          onClick={handleCreate}
          disabled={createReceivable.isPending}
          style={{
            padding: "10px 18px",
            background: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: createReceivable.isPending ? "not-allowed" : "pointer",
          }}
        >
          {createReceivable.isPending ? "Creating..." : "Create receivable"}
        </button>
        <label style={{ fontSize: 14 }}>
          <input
            type="checkbox"
            checked={invalid}
            onChange={(e) => setInvalid(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Send invalid body (test 400 validation)
        </label>
      </div>

      {createError && (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: "#3a0000",
            color: "#f88",
            borderRadius: 6,
            whiteSpace: "pre-wrap",
          }}
        >
          {createError}
        </pre>
      )}

      <pre
        style={{
          marginTop: 16,
          padding: 16,
          background: "#0a0a0a",
          color: "#9cf",
          borderRadius: 6,
          maxHeight: 320,
          overflow: "auto",
        }}
      >
        {receivables.isLoading
          ? "loading..."
          : receivables.error
            ? `error: ${extractApiErrorMessage(receivables.error)}`
            : JSON.stringify(receivables.data, null, 2)}
      </pre>
    </main>
  );
}
