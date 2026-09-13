"use client";

import { useState, useMemo, useCallback } from "react";
import { Address } from "viem";
import { useAccount } from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { DeployedVaultCard } from "./DeployedVaultCard";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { USDC_ADDRESS_BASE } from "@/lib/config/yearn";
import type { Vault } from "@aave/react";

type DeployedVault = {
  address: Address;
  name?: string;
  transactionHash?: string;
  performanceFee?: number; // Performance fee in percentage (e.g., 12 for 12%)
};

export const MyDeployedVaults = () => {
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();
  const userAddress = useMemo(() => {
    if (crossmintWallet?.address) return crossmintWallet.address;
    return wagmiAddress ?? undefined;
  }, [crossmintWallet?.address, wagmiAddress]);

  const { vaults: apiVaults, loading: apiLoading } = useOwnedVaults(userAddress);

  const [localVaults, setLocalVaults] = useState<DeployedVault[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("deployedVaults");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newVaultAddress, setNewVaultAddress] = useState("");
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultTxHash, setNewVaultTxHash] = useState("");
  const [newVaultPerformanceFee, setNewVaultPerformanceFee] = useState("");

  const apiAddressSet = useMemo(
    () => new Set(apiVaults.map((v) => v.address.toLowerCase())),
    [apiVaults]
  );
  const localOnlyVaults = useMemo(
    () => localVaults.filter((v) => !apiAddressSet.has(v.address.toLowerCase())),
    [localVaults, apiAddressSet]
  );

  const saveLocalVaults = useCallback((newVaults: DeployedVault[]) => {
    setLocalVaults(newVaults);
    if (typeof window !== "undefined") {
      localStorage.setItem("deployedVaults", JSON.stringify(newVaults));
    }
  }, []);

  const handleAddVault = useCallback(() => {
    if (!newVaultAddress || !newVaultAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert("Please enter a valid Ethereum address (0x followed by 40 hex characters)");
      return;
    }

    const performanceFeeNum = newVaultPerformanceFee
      ? parseFloat(newVaultPerformanceFee)
      : undefined;

    if (
      performanceFeeNum !== undefined &&
      (isNaN(performanceFeeNum) || performanceFeeNum < 0 || performanceFeeNum > 100)
    ) {
      alert("Performance fee must be a number between 0 and 100");
      return;
    }

    const vault: DeployedVault = {
      address: newVaultAddress.toLowerCase() as Address,
      name: newVaultName || undefined,
      transactionHash: newVaultTxHash || undefined,
      performanceFee: performanceFeeNum,
    };

    if (localVaults.some((v) => v.address.toLowerCase() === vault.address.toLowerCase())) {
      alert("This vault is already added");
      return;
    }

    saveLocalVaults([...localVaults, vault]);
    setNewVaultAddress("");
    setNewVaultName("");
    setNewVaultTxHash("");
    setNewVaultPerformanceFee("");
    setShowAddForm(false);
  }, [
    newVaultAddress,
    newVaultName,
    newVaultTxHash,
    newVaultPerformanceFee,
    localVaults,
    saveLocalVaults,
  ]);

  const handleRemoveVault = useCallback(
    (address: Address) => {
      if (confirm("Remove this vault from your list?")) {
        saveLocalVaults(
          localVaults.filter((v) => v.address.toLowerCase() !== address.toLowerCase())
        );
      }
    },
    [localVaults, saveLocalVaults]
  );

  const hasAnyVaults = apiVaults.length > 0 || localOnlyVaults.length > 0;

  if (!hasAnyVaults && !showAddForm) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/80 p-8 text-center">
        <p className="mb-4 text-sm font-medium text-slate-500">No deployed vaults yet</p>
        <p className="mb-4 text-xs text-slate-400">
          Deploy a vault using the "Deploy Vault" button above, or add an existing vault address
          manually.
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Add Vault Address
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">My Deployed Vaults</h2>
          <p className="mt-1 text-sm text-slate-600">
            View and interact with your deployed Aave USDC vaults
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Add Vault
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Deployed Vault</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Vault Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newVaultAddress}
                onChange={(e) => setNewVaultAddress(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Find this in your deployment transaction on Basescan (check "Internal Transactions"
                or event logs)
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Vault Name (Optional)
              </label>
              <input
                type="text"
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                placeholder="My Aave Vault"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Transaction Hash (Optional)
              </label>
              <input
                type="text"
                value={newVaultTxHash}
                onChange={(e) => setNewVaultTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Performance Fee % (Optional)
              </label>
              <input
                type="tel"
                inputMode="decimal"
                value={newVaultPerformanceFee}
                onChange={(e) => setNewVaultPerformanceFee(e.target.value)}
                placeholder="12"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Enter the performance fee percentage (e.g., 12 for 12%) to calculate net APR. Aave
                Labs takes 50% of this fee.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddVault}
                className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Add Vault
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewVaultAddress("");
                  setNewVaultName("");
                  setNewVaultTxHash("");
                  setNewVaultPerformanceFee("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {apiLoading ? <p className="text-sm text-slate-500">Loading your vaults…</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {apiVaults.map((vault) => (
          <div key={vault.address} className="relative">
            <DeployedVaultCard
              vault={vault}
              vaultAddress={vault.address as Address}
              assetAddress={
                (vault.usedReserve?.underlyingToken?.address ?? USDC_ADDRESS_BASE) as Address
              }
              assetSymbol={vault.usedReserve?.underlyingToken?.symbol ?? "USDC"}
              assetDecimals={vault.usedReserve?.underlyingToken?.decimals ?? 6}
              name={vault.shareName}
              transactionHash={undefined}
              performanceFee={vault.fee?.formatted ? Number(vault.fee.formatted) : undefined}
              isApiOwned
            />
          </div>
        ))}
        {localOnlyVaults.map((vault) => (
          <div key={vault.address} className="relative">
            <DeployedVaultCard
              vaultAddress={vault.address}
              assetAddress={USDC_ADDRESS_BASE}
              assetSymbol="USDC"
              assetDecimals={6}
              name={vault.name}
              transactionHash={vault.transactionHash}
              performanceFee={vault.performanceFee}
            />
            <button
              onClick={() => handleRemoveVault(vault.address)}
              className="absolute top-2 right-2 z-10 rounded-full bg-red-100 p-1.5 text-red-600 transition hover:bg-red-200"
              aria-label="Remove vault"
              title="Remove vault"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
