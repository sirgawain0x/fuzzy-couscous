"use client";

import { useState, useMemo } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
import { appChain } from "@/lib/wagmiConfig";
import { ATokenSendModal } from "./ATokenSendModal";
import Link from "next/link";

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function ATokenBalance() {
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const userAddress = useMemo(() => {
    if (crossmintWallet?.address) return crossmintWallet.address as `0x${string}`;
    return wagmiAddress;
  }, [crossmintWallet?.address, wagmiAddress]);

  const { reserve } = useBaseUsdcReserve();
  const aTokenAddress = reserve?.aToken?.address as Address | undefined;
  const assetDecimals = reserve?.underlyingToken?.decimals ?? 6;

  const { data: aTokenBalance, refetch } = useReadContract({
    address: aTokenAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: appChain.id,
    query: {
      enabled: !!aTokenAddress && !!userAddress,
      refetchInterval: 30000,
    },
  });

  const balance = aTokenBalance as bigint | undefined;
  const hasBalance = !!balance && balance > 0n;

  if (!hasBalance) return null;

  const formatted = formatUnits(balance, assetDecimals);
  const display = Number(formatted).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  return (
    <>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-600 uppercase">aBaseUSDC Balance</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900">{display} aBaseUSDC</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Interest accruing in real-time on Aave
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSendModalOpen(true)}
              className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Send
            </button>
            {aTokenAddress && (
              <Link
                href={`https://basescan.org/token/${aTokenAddress}?a=${userAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
              >
                View on Basescan
              </Link>
            )}
          </div>
        </div>
      </div>

      {aTokenAddress && userAddress && (
        <ATokenSendModal
          open={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          aTokenAddress={aTokenAddress}
          userAddress={userAddress}
          balance={balance}
          assetDecimals={assetDecimals}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}
