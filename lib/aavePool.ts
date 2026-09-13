import { createPublicClient, fallback, http, formatUnits, type Address } from "viem";
import { base } from "viem/chains";
import { getHealthFactorStatus } from "./healthFactor";

// Aave V3 Pool on Base Mainnet
export const AAVE_V3_POOL_BASE: Address = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";

const POOL_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserAccountData",
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const defaultRpcUrl = "https://mainnet.base.org";
const configuredRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL ?? defaultRpcUrl;

const transports = [
  http(configuredRpcUrl),
  ...(configuredRpcUrl === defaultRpcUrl ? [] : [http(defaultRpcUrl)]),
];

const publicClient = createPublicClient({
  chain: base,
  transport: fallback(transports),
});

export interface UserAccountData {
  walletAddress: string;
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: number;
  healthFactorRaw: bigint;
  status: "safe" | "warning" | "danger" | null;
  hasBorrows: boolean;
}

/**
 * Reads a single user's Aave V3 account data from the Pool contract on Base.
 */
export async function getUserAccountData(walletAddress: string): Promise<UserAccountData> {
  const result = await publicClient.readContract({
    address: AAVE_V3_POOL_BASE,
    abi: POOL_ABI,
    functionName: "getUserAccountData",
    args: [walletAddress as Address],
  });

  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactorRaw,
  ] = result;

  const healthFactor = Number(formatUnits(healthFactorRaw, 18));
  const hasBorrows = totalDebtBase > 0n;
  const status = getHealthFactorStatus(healthFactor, hasBorrows);

  return {
    walletAddress,
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor,
    healthFactorRaw,
    status,
    hasBorrows,
  };
}

/**
 * Batch reads account data for multiple wallets using sequential calls.
 * Processes in batches to avoid RPC rate limits.
 */
export async function batchGetUserAccountData(
  walletAddresses: string[],
  batchSize: number = 10
): Promise<UserAccountData[]> {
  const results: UserAccountData[] = [];

  for (let i = 0; i < walletAddresses.length; i += batchSize) {
    const batch = walletAddresses.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map((addr) => getUserAccountData(addr)));

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        console.warn("[AavePool] Failed to read account data:", result.reason);
      }
    }
  }

  return results;
}
