"use client";

import { useState } from "react";

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

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 600 }}>
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
    </main>
  );
}
