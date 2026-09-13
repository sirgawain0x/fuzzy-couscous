"use client";

import { useState, useMemo, useCallback } from "react";
import { useUserEMode, evmAddress, bigDecimal, type Market } from "@aave/react";
import { useSendTransaction } from "@aave/react/viem";
import { usePublicClient } from "wagmi";
import { useAaveWalletClient } from "@/hooks/useAaveWalletClient";
import { AAVE_TARGET_CHAIN_ID } from "@/lib/config/aave";
import {
  extractTxHash,
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

interface EModeSelectorProps {
  market: Market;
  userAddress: string;
  currentEModeEnabled: boolean;
  currentEModeCategoryId?: number;
}

/**
 * E-Mode selector for Aave V3.
 * Allows Investor+ members to enable Efficiency Mode for correlated assets,
 * maximizing LTV and borrowing power for stablecoins or ETH-correlated tokens.
 */
export function EModeSelector({
  market,
  userAddress,
  currentEModeEnabled,
  currentEModeCategoryId,
}: EModeSelectorProps) {
  const [setEMode] = useUserEMode();
  const walletClient = useAaveWalletClient();
  const publicClient = usePublicClient();
  const [sendTransaction] = useSendTransaction(walletClient);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    currentEModeCategoryId ?? null
  );

  const categories = useMemo(() => market.eModeCategories ?? [], [market.eModeCategories]);

  const currentCategory = useMemo(
    () =>
      currentEModeCategoryId ? categories.find((c: any) => c.id === currentEModeCategoryId) : null,
    [categories, currentEModeCategoryId]
  );

  const handleToggleEMode = useCallback(
    async (categoryId: number | null) => {
      if (!walletClient || !publicClient) return;

      setIsSubmitting(true);
      try {
        const result = await setEMode({
          market: evmAddress(market.address),
          user: evmAddress(userAddress),
          categoryId: categoryId != null ? (categoryId as any) : undefined,
          chainId: AAVE_TARGET_CHAIN_ID,
        });

        if (result.isErr()) {
          showTxErrorToast({
            title: "E-Mode update failed",
            description: result.error.message,
          });
          return;
        }

        const plan = result.value;
        const txResult = await sendTransaction(plan as any);
        if (txResult.isErr()) {
          const message = txResult.error?.message ?? "E-Mode update failed";
          showTxErrorToast({ title: "E-Mode update failed", description: message });
          return;
        }

        setSelectedCategory(categoryId);
        showTxSuccessToast({
          title: "E-Mode updated",
          description: categoryId
            ? `E-Mode enabled: ${categories.find((c: any) => c.id === categoryId)?.label ?? "Category " + categoryId}`
            : "E-Mode disabled",
          txHash: extractTxHash(txResult.value),
        });
      } catch (err: unknown) {
        const message = normalizeTxErrorMessage(err, "Failed to update E-Mode");
        showTxErrorToast({
          title: "Transaction failed",
          description: message,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [setEMode, sendTransaction, walletClient, publicClient, market.address, userAddress, categories]
  );

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Efficiency Mode (E-Mode)</h4>
          <p className="text-xs text-slate-500">Maximize borrowing power for correlated assets</p>
        </div>
        {currentEModeEnabled && currentCategory && (
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
            {(currentCategory as any).label}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {categories.map((category: any) => {
          const isActive = currentEModeEnabled && currentEModeCategoryId === category.id;

          return (
            <div
              key={category.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                isActive ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-900">{category.label}</span>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>
                    Max LTV:{" "}
                    <strong className="text-slate-700">
                      {category.maxLTV?.formatted
                        ? `${(Number(category.maxLTV.formatted) * 100).toFixed(0)}%`
                        : "—"}
                    </strong>
                  </span>
                  <span>
                    Liq. Threshold:{" "}
                    <strong className="text-slate-700">
                      {category.liquidationThreshold?.formatted
                        ? `${(Number(category.liquidationThreshold.formatted) * 100).toFixed(0)}%`
                        : "—"}
                    </strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleToggleEMode(isActive ? null : category.id)}
                disabled={isSubmitting}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                } disabled:opacity-50`}
              >
                {isSubmitting ? "..." : isActive ? "Disable" : "Enable"}
              </button>
            </div>
          );
        })}
      </div>

      {currentEModeEnabled && (
        <p className="text-xs text-blue-600">
          E-Mode is active. You can only borrow assets within the same category for higher LTV
          ratios.
        </p>
      )}
    </div>
  );
}
