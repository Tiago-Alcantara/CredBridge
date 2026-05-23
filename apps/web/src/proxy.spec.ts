import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const PUBLIC_HOST = "www.lane-credbridge.app";
const VERCEL_PUBLIC_HOST = "cred-bridge.vercel.app";

function createRequest(pathname: string, hostname = PUBLIC_HOST) {
  return new NextRequest(`https://${hostname}${pathname}`);
}

describe("public landing proxy", () => {
  it("marks the root request for public-only rendering", () => {
    const response = proxy(createRequest("/"));

    expect(response.headers.get("x-middleware-request-x-credbridge-public-landing")).toBe(
      "true",
    );
  });

  it("redirects application routes on the public host to the landing", () => {
    const response = proxy(createRequest("/login?role=investor"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://${PUBLIC_HOST}/`);
  });

  it("redirects application routes on the Vercel production host to the landing", () => {
    const response = proxy(createRequest("/login", VERCEL_PUBLIC_HOST));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://${VERCEL_PUBLIC_HOST}/`);
  });

  it("does not redirect static assets needed by the landing", () => {
    const response = proxy(createRequest("/_next/static/chunks/app.js"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not restrict other hosts", () => {
    const response = proxy(createRequest("/login", "preview.lane-credbridge.app"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-credbridge-public-landing")).toBeNull();
  });
});
