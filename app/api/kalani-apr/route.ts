import { NextResponse } from "next/server";
import { base } from "viem/chains";
import { Address, createPublicClient, fallback, http } from "viem";

import { CREATIVE_BANK_VAULT, KALANI_VAULT_ADDRESSES } from "@/lib/config/kalani";

const KALANI_ORACLE_ABI = [
  {
    inputs: [{ internalType: "address", name: "_vault", type: "address" }],
    name: "getCurrentApr",
    outputs: [{ internalType: "uint256", name: "apr", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const defaultRpcUrl = "https://mainnet.base.org";
const configuredRpcUrl =
  process.env.KALANI_BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL ?? defaultRpcUrl;

const transports = [
  http(configuredRpcUrl),
  ...(configuredRpcUrl === defaultRpcUrl ? [] : [http(defaultRpcUrl)]),
];

const publicClient = createPublicClient({
  chain: base,
  transport: fallback(transports),
});

/**
 * Vault whose APR we read from the on-chain oracle. Must match the Creative Bank Yearn card
 * (`CREATIVE_BANK_VAULT` / `NEXT_PUBLIC_CREATIVE_BANK_YEARN_VAULT_ADDRESS`), not an arbitrary
 * `getAllVaults()[0]` entry (which often reports 0% from the oracle).
 */
const resolveVaultAddress = (): Address => {
  const configured =
    process.env.KALANI_VAULT_ADDRESS ?? process.env.NEXT_PUBLIC_KALANI_VAULT_ADDRESS;
  if (configured) {
    return configured as Address;
  }

  return CREATIVE_BANK_VAULT.address;
};

const normalizeApr = (rawApr: bigint | number | string) => {
  if (typeof rawApr === "bigint") {
    return Number(rawApr) / 1e18;
  }

  if (typeof rawApr === "number") {
    return rawApr;
  }

  const parsed = Number.parseFloat(rawApr);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
};

export const GET = async () => {
  try {
    const vaultAddress = resolveVaultAddress();

    const rawApr = await publicClient.readContract({
      abi: KALANI_ORACLE_ABI,
      address: KALANI_VAULT_ADDRESSES.aprOracle as Address,
      functionName: "getCurrentApr",
      args: [vaultAddress],
    });

    const aprValue = normalizeApr(rawApr);

    if (typeof aprValue === "undefined") {
      return NextResponse.json({ error: "APR oracle returned an invalid value." }, { status: 502 });
    }

    return NextResponse.json({ aprPercent: aprValue * 100 });
  } catch (error) {
    console.error("Kalani APR oracle fetch failed", error);

    if (
      error &&
      typeof error === "object" &&
      "shortMessage" in error &&
      typeof error.shortMessage === "string"
    ) {
      return NextResponse.json({ error: error.shortMessage }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Unable to fetch Kalani APR at this time.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
};
