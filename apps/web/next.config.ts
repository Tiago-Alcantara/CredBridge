import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["passkey-kit", "passkey-kit-sdk", "sac-sdk"],
  serverExternalPackages: ["@stellar/stellar-sdk"],
  webpack(config) {
    // passkey-kit bundles stellar-sdk v14 which has a broken require('../../package.json')
    // in lib/minimal/bindings/config.js (lib/package.json doesn't exist).
    // Force all @stellar/stellar-sdk imports to use the root v15 copy where this is fixed.
    const stellarRoot = path.resolve(__dirname, "../../node_modules/@stellar/stellar-sdk");
    config.resolve.alias = {
      ...config.resolve.alias,
      // Force all stellar-sdk imports to use root v15 (passkey-kit's nested v14
      // has a broken require('../../package.json') in lib/minimal/bindings/config.js).
      // Subpath aliases are explicit because webpack doesn't walk exports maps via alias.
      "@stellar/stellar-sdk": stellarRoot,
      "@stellar/stellar-sdk/minimal": path.join(stellarRoot, "lib/minimal/index.js"),
      "@stellar/stellar-sdk/minimal/contract": path.join(stellarRoot, "lib/minimal/contract/index.js"),
      "@stellar/stellar-sdk/minimal/rpc": path.join(stellarRoot, "lib/minimal/rpc/index.js"),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
