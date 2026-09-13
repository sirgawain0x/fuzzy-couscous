import { createConfig, createStorage, fallback, http, noopStorage } from "wagmi";
import { createClient } from "viem";
import { injected, walletConnect } from "wagmi/connectors";
import { base, baseSepolia, mainnet } from "wagmi/chains";
import { Attribution } from "ox/erc8021";

// Public RPC endpoints for Base - these are free and rate-limited
const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
const DEFAULT_BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";

// Base Builder Code — appended to all transactions for onchain attribution
const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE;
const DATA_SUFFIX = BUILDER_CODE ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] }) : undefined;

const configuredChain = process.env.NEXT_PUBLIC_CHAIN_ID;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://finance.creativeplatform.xyz";

export const appChain = (() => {
  // Only use base-sepolia when explicitly configured; default to base mainnet
  if (configuredChain === "base-sepolia") {
    return baseSepolia;
  }

  return base;
})();

// Validate Alchemy API key format (should be alphanumeric with hyphens, not empty)
const isValidAlchemyKey = (key: string | undefined): boolean => {
  if (!key || key.trim().length === 0) return false;
  // Alchemy keys are typically alphanumeric with hyphens, at least 20 chars
  // Exclude keys that look like placeholder values
  const trimmed = key.trim();
  return trimmed.length >= 20 && !trimmed.includes("xxx") && !trimmed.includes("your_");
};

// Build Base Mainnet RPC endpoints with fallbacks
const buildBaseRpcEndpoints = () => {
  const endpoints = [];

  // 1. Server-side RPC proxy — keeps API keys secure and avoids browser rate limits.
  //    The proxy at /api/rpc/base forwards to Alchemy (if ALCHEMY_API_KEY is set)
  //    or to a configured BASE_RPC_URL on the server.
  endpoints.push(
    http("/api/rpc/base", {
      batch: {
        wait: 50,
      },
      retryCount: 2,
      retryDelay: 500,
    })
  );

  // 2. Client-side Alchemy endpoint (if NEXT_PUBLIC key provided)
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (isValidAlchemyKey(alchemyKey)) {
    endpoints.push(
      http(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`, {
        batch: {
          wait: 50,
        },
        retryCount: 2,
        retryDelay: 500,
      })
    );
  }

  // 3. Default Base public RPC
  endpoints.push(
    http(DEFAULT_BASE_RPC_URL, {
      batch: {
        wait: 50,
      },
      retryCount: 1,
    })
  );

  return endpoints;
};

// Build Base Sepolia RPC endpoints
const buildBaseSepoliaRpcEndpoints = () => {
  const endpoints = [];

  // Alchemy Sepolia endpoint (if provided and valid)
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (isValidAlchemyKey(alchemyKey)) {
    endpoints.push(
      http(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`, {
        batch: { wait: 50 },
        retryCount: 2, // Reduced retries to fail faster to fallback
        retryDelay: 500,
      })
    );
  }

  // Custom or default Sepolia RPC
  const sepoliaRpcUrl =
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? DEFAULT_BASE_SEPOLIA_RPC_URL;
  endpoints.push(
    http(sepoliaRpcUrl, {
      batch: { wait: 50 },
      retryCount: 2,
    })
  );

  return endpoints;
};

// Ethereum mainnet transport for Nexus Mutual CoverBroker (cover is purchased on mainnet, protects Base positions)
const buildEthereumRpcEndpoints = () => {
  return [
    http("/api/rpc/mainnet", {
      batch: { wait: 50 },
      retryCount: 2,
      retryDelay: 500,
    }),
  ];
};

const transports = {
  [base.id]: fallback(buildBaseRpcEndpoints(), {
    rank: true, // Rank transports by speed
  }),
  [baseSepolia.id]: fallback(buildBaseSepoliaRpcEndpoints(), {
    rank: true,
  }),
  [mainnet.id]: fallback(buildEthereumRpcEndpoints(), { rank: true }),
};

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Only initialize WalletConnect in the browser to avoid SSR issues with indexedDB
const isBrowser = typeof window !== "undefined";

const connectors = [
  injected({
    shimDisconnect: true,
  }),
  ...(walletConnectProjectId && isBrowser
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: "Creative Bank",
            description: "Creative Bank DeFi access",
            url: APP_URL,
            icons: [`${APP_URL}/icon.png`],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia, mainnet],
  client({ chain }) {
    return createClient({
      chain,
      transport: transports[chain.id] ?? http(),
      ...(DATA_SUFFIX ? { dataSuffix: DATA_SUFFIX } : {}),
    });
  },
  connectors,
  ssr: true,
  storage: createStorage({
    storage: noopStorage,
  }),
});

export const isBaseMainnet = appChain.id === base.id;
