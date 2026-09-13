import type { NextConfig } from "next";
import path from "node:path";
import { withBotId } from "botid/next/config";

// wagmi 3's `wagmi/connectors` barrel re-exports every connector
// (tempo, metaMask, etc.) unconditionally. We only use `injected` and
// `walletConnect`, so we alias the unused connectors' peer deps so neither
// bundler errors with "Module not found":
//   - webpack: `false` skips the module entirely
//   - turbopack: redirect to a stub file (boolean is not a valid alias value)
const SKIPPED_CONNECTOR_DEPS = [
  "accounts",
  "@metamask/connect-evm",
  "@base-org/account",
];
const EMPTY_MODULE = path.resolve(__dirname, "lib/empty-module.ts");

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...Object.fromEntries(SKIPPED_CONNECTOR_DEPS.map((dep) => [dep, false])),
    };
    return config;
  },
  turbopack: {
    resolveAlias: Object.fromEntries(SKIPPED_CONNECTOR_DEPS.map((dep) => [dep, EMPTY_MODULE])),
  },
};

export default withBotId(nextConfig);
