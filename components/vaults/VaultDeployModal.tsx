"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bigDecimal,
  evmAddress,
  useVaultDeploy,
  type Market,
  type Reserve,
  type VaultDeployRequest,
} from "@aave/react";
import { useWalletClient, useAccount, usePublicClient } from "wagmi";
import { useSendTransaction } from "@aave/react/viem";
import { useAuth } from "@/context/AuthContext";
import { useWallet, EVMWallet } from "@crossmint/client-sdk-react-ui";
import { createWalletClient, custom, type WalletClient } from "viem";
import { base, baseSepolia } from "viem/chains";

import { Modal } from "@/components/common/Modal";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";
import { USDC_DECIMALS } from "@/lib/config/aave";
import { formatPercent } from "@/lib/formatters";
import { useMembership } from "@/context/MembershipContext";
import { shortenAddress } from "@/utils/shortenAddress";
import {
  CREATIVE_TREASURY_ADDRESS,
  YEARN_ACCOUNTANT_ADDRESS,
  FEE_RECEIVER_TIERS,
} from "@/lib/config/memberships";
import { FeeBreakdown } from "./FeeBreakdown";

type VaultDeployModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (txHash: string, vaultAddress?: string) => void;
  market?: Market;
  reserve?: Reserve;
};

type RecipientInput = {
  partnerAddress?: string;
  partnerPercent: number;
};

type SubmitState = {
  status: "idle" | "approval" | "deploying" | "success" | "error";
  message?: string;
  txHash?: string;
  vaultAddress?: string;
  retryable?: boolean;
};

function isTransientError(message: string): boolean {
  const patterns = [
    "panicked",
    "service unavailable",
    "502",
    "503",
    "504",
    "fetch failed",
    "network",
  ];
  return patterns.some((p) => message.toLowerCase().includes(p));
}

const CREATIVE_ADDRESS = "0xf46F1BA19A9280F752a451d0973b047D81c63D70";

export function VaultDeployModal({
  open,
  onClose,
  onSuccess,
  market,
  reserve,
}: VaultDeployModalProps) {
  const { address: wagmiAddress } = useAccount();
  const { data: wagmiWalletClient } = useWalletClient();
  const targetChainId = process.env.NODE_ENV === "production" ? base.id : baseSepolia.id;
  const publicClient = usePublicClient({ chainId: targetChainId });
  const { wallet: crossmintWallet, status: walletStatus } = useWallet();
  const { status: authStatus } = useAuth();
  const { tier, isLoading: membershipLoading } = useMembership();
  const [deployVault, deployState] = useVaultDeploy();

  // Check if user has any membership (only after loading is complete)
  const hasMembership = !membershipLoading && tier !== null;
  const canSetFeeReceiver = hasMembership && tier !== null && FEE_RECEIVER_TIERS.includes(tier);

  // Determine active address (Crossmint takes priority, fallback to wagmi)
  const activeAddress = useMemo(() => {
    if (crossmintWallet?.address) {
      return crossmintWallet.address as `0x${string}`;
    }
    return wagmiAddress;
  }, [crossmintWallet?.address, wagmiAddress]);

  // Create wallet client from Crossmint wallet if available, otherwise use wagmi client
  const walletClient = useMemo((): WalletClient | undefined => {
    // If we have a Crossmint wallet, create a viem wallet client adapter
    if (crossmintWallet) {
      try {
        const evmWallet = EVMWallet.from(crossmintWallet);
        const chain = process.env.NODE_ENV === "production" ? base : baseSepolia;

        // Create a custom wallet client that uses Crossmint's EVMWallet for transactions
        return createWalletClient({
          chain,
          transport: custom({
            async request({ method, params }) {
              // Handle transaction sending through Crossmint's EVMWallet
              if (method === "eth_sendTransaction" && params?.[0]) {
                const tx = params[0] as {
                  to?: string;
                  value?: string;
                  data?: string;
                  gas?: string;
                  gasPrice?: string;
                  maxFeePerGas?: string;
                  maxPriorityFeePerGas?: string;
                };

                // Validate required fields
                if (!tx.to) {
                  throw new Error("Transaction 'to' address is required");
                }

                // Convert viem transaction format to Crossmint format
                // Convert hex string value to bigint as required by EVMTransactionInput
                const valueHex = tx.value || "0x0";
                const valueBigInt = BigInt(valueHex);

                const transaction = {
                  to: tx.to as `0x${string}`,
                  value: valueBigInt,
                  data: (tx.data || "0x") as `0x${string}`,
                };

                // Send transaction using Crossmint's EVMWallet
                const result = await evmWallet.sendTransaction(transaction);

                // Return the transaction hash in the format viem expects
                return result.hash;
              }

              // Handle account requests
              if (method === "eth_accounts" || method === "eth_requestAccounts") {
                return [crossmintWallet.address];
              }

              // Handle chain ID requests
              if (method === "eth_chainId") {
                return `0x${chain.id.toString(16)}`;
              }

              // Proxy read-only RPC calls (eth_call, eth_estimateGas, eth_getBalance, etc.)
              // through the public client so Aave SDK can prepare transactions
              if (publicClient) {
                return publicClient.request({ method, params } as Parameters<
                  typeof publicClient.request
                >[0]);
              }

              throw new Error(`Method ${method} not supported: no public client available`);
            },
          }),
        });
      } catch (error) {
        console.error("Failed to create wallet client from Crossmint wallet:", error);
      }
    }

    // Fallback to wagmi wallet client
    return wagmiWalletClient ?? undefined;
  }, [crossmintWallet, wagmiWalletClient, publicClient]);

  const [sendTransaction, sendTransactionState] = useSendTransaction(walletClient);

  const [shareName, setShareName] = useState("Aave USDC Vault Shares");
  const [shareSymbol, setShareSymbol] = useState("avUSDC");
  // Non-member: locked at 20%. Member: default 10% (minimum allowed)
  const [performanceFee, setPerformanceFee] = useState(hasMembership ? 10 : 20);
  const [feeReceiverAddress, setFeeReceiverAddress] = useState("");
  // 0.01 USDC permanent lock required by Aave to initialize the vault
  const [initialDeposit, setInitialDeposit] = useState(0.01);

  // Initialize recipient input based on membership status
  // If no membership or still loading: pre-fill with Creative address and 5%
  // If has membership: start empty and editable
  const getInitialRecipientInput = useCallback((): RecipientInput => {
    // If membership is still loading or user doesn't have membership, pre-fill with Creative
    if (membershipLoading || !hasMembership) {
      return { partnerAddress: CREATIVE_ADDRESS, partnerPercent: 5 };
    }
    return { partnerAddress: "", partnerPercent: 0 };
  }, [hasMembership, membershipLoading]);

  const [recipientInput, setRecipientInput] = useState<RecipientInput>(getInitialRecipientInput);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const reserveApy = formatPercent(reserve?.supplyInfo.apy?.formatted);

  const isSubmitting =
    deployState.loading || sendTransactionState.loading || submitState.status === "deploying";

  const assetSymbol = reserve?.underlyingToken?.symbol ?? "USDC";
  const assetDecimals = reserve?.underlyingToken?.decimals ?? USDC_DECIMALS;

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset fee when membership status changes
  useEffect(() => {
    if (!membershipLoading) {
      setPerformanceFee(hasMembership ? 10 : 20);
      setFeeReceiverAddress("");
    }
  }, [hasMembership, membershipLoading]);

  const resetForm = useCallback(() => {
    setSubmitState({ status: "idle" });
    setPerformanceFee(hasMembership ? 10 : 20);
    setFeeReceiverAddress("");
    setInitialDeposit(0.01);
    setRecipientInput(getInitialRecipientInput());
    setShareName(
      reserve ? `Aave ${reserve.underlyingToken.symbol} Vault Shares` : "Aave USDC Vault Shares"
    );
    setShareSymbol(reserve ? `av${reserve.underlyingToken.symbol}` : "avUSDC");
  }, [getInitialRecipientInput, reserve]);

  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  // Clear pending auto-close timeout on unmount to avoid calling handleClose after unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const validate = useCallback(() => {
    // Check if wallet is connected (either Crossmint or wagmi)
    if (!activeAddress) {
      // Provide more helpful error message
      if (authStatus === "initializing" || walletStatus === "in-progress") {
        return "Wallet is connecting. Please wait...";
      }
      return "Connect a wallet to deploy a vault.";
    }

    if (!market || !reserve) {
      return "Reserve data is still loading. Please try again in a moment.";
    }

    if (hasMembership) {
      if (Number.isNaN(performanceFee) || performanceFee < 10 || performanceFee > 50) {
        return "Performance fee must be between 10% and 50%.";
      }
    }
    // Non-member fee is locked at 20% — no validation needed

    if (Number.isNaN(initialDeposit) || initialDeposit < 0) {
      return "Initial deposit must be zero or a positive number.";
    }

    if (
      recipientInput.partnerPercent < 0 ||
      recipientInput.partnerPercent > 100 ||
      Number.isNaN(recipientInput.partnerPercent)
    ) {
      return "Partner revenue share must be between 0% and 100%.";
    }

    return null;
  }, [
    activeAddress,
    authStatus,
    walletStatus,
    initialDeposit,
    market,
    performanceFee,
    recipientInput.partnerPercent,
    reserve,
  ]);

  const recipients = useMemo(() => {
    const entries: VaultDeployRequest["recipients"] = [];

    // Yearn V3 Accountant always gets 10% of manager's half
    entries.push({
      address: evmAddress(YEARN_ACCOUNTANT_ADDRESS),
      percent: bigDecimal(10),
    });

    if (hasMembership) {
      // Member: Fee Receiver (Brand/Creator) or deployer wallet (Investor)
      const receiver =
        canSetFeeReceiver && feeReceiverAddress.trim()
          ? feeReceiverAddress.trim()
          : (activeAddress ?? "0x0000000000000000000000000000000000000000");

      entries.push({
        address: evmAddress(receiver),
        percent: bigDecimal(90),
      });
    } else {
      // Non-member: 90% goes to Creative Bank Treasury
      entries.push({
        address: evmAddress(CREATIVE_TREASURY_ADDRESS),
        percent: bigDecimal(90),
      });
    }

    return entries;
  }, [activeAddress, hasMembership, canSetFeeReceiver, feeReceiverAddress]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const validationMessage = validate();
      if (validationMessage) {
        setSubmitState({ status: "error", message: validationMessage });
        return;
      }

      if (!walletClient) {
        setSubmitState({
          status: "error",
          message: "Unable to access wallet client. Please reconnect your wallet.",
        });
        return;
      }

      if (!market || !reserve || !activeAddress) {
        setSubmitState({
          status: "error",
          message: "Missing context to deploy vault. Please try again.",
        });
        return;
      }

      setSubmitState({ status: "deploying" });

      try {
        const request: VaultDeployRequest = {
          market: evmAddress(market.address),
          chainId: market.chain.chainId,
          underlyingToken: evmAddress(reserve.underlyingToken.address),
          deployer: evmAddress(activeAddress),
          shareName,
          shareSymbol,
          initialFee: bigDecimal(performanceFee),
          initialLockDeposit: bigDecimal(initialDeposit),
          recipients,
        };

        const planResult = await deployVault(request);
        if (planResult.isErr()) {
          const msg = planResult.error.message;
          setSubmitState({ status: "error", message: msg, retryable: isTransientError(msg) });
          showTxErrorToast({ title: "Vault deployment failed", description: msg });
          return;
        }

        const plan = planResult.value;

        if (plan.__typename === "InsufficientBalanceError") {
          const message = `Insufficient balance. Required: ${plan.required.value} ${assetSymbol}.`;
          setSubmitState({
            status: "error",
            message,
          });
          showTxErrorToast({ title: "Vault deployment failed", description: message });
          return;
        }

        let transactionResult = null;

        if (plan.__typename === "TransactionRequest") {
          transactionResult = await sendTransaction(plan);
        } else if (plan.__typename === "ApprovalRequired") {
          setSubmitState({ status: "approval" });
          const approvalResult = await sendTransaction(plan.approval);
          if (approvalResult.isErr()) {
            const message = approvalResult.error.message;
            setSubmitState({
              status: "error",
              message,
            });
            showTxErrorToast({ title: "Vault deployment failed", description: message });
            return;
          }

          setSubmitState({ status: "deploying" });
          transactionResult = await sendTransaction(plan.originalTransaction);
        } else {
          const message = "Unsupported execution plan returned by Aave SDK.";
          setSubmitState({
            status: "error",
            message,
          });
          showTxErrorToast({ title: "Vault deployment failed", description: message });
          return;
        }

        if (transactionResult.isErr()) {
          const message = transactionResult.error.message;
          setSubmitState({
            status: "error",
            message,
          });
          showTxErrorToast({ title: "Vault deployment failed", description: message });
          return;
        }

        const txHash = transactionResult.value;

        // Wait for transaction receipt to get the vault address
        setSubmitState({
          status: "deploying",
          txHash,
          message: "Waiting for transaction confirmation...",
        });

        try {
          // Wait for the transaction to be mined using public client
          if (publicClient) {
            const receipt = await publicClient.waitForTransactionReceipt({
              hash: txHash as `0x${string}`,
              timeout: 120_000, // 2 minute timeout
            });

            // Try to extract vault address from transaction receipt
            // Aave vaults are deployed via factory, so the address is in event logs
            let vaultAddress: string | undefined;

            if (receipt.contractAddress) {
              vaultAddress = receipt.contractAddress;
            } else if (receipt.logs && receipt.logs.length > 0) {
              // Look for VaultDeployed event: VaultDeployed(address indexed vault, address indexed implementation, address indexed underlying, ...)
              // Event signature: 0xa225f10988fd8a4e80df4ed9fe9ddce048ffc02e51061eb4ceb5beb0c2ec4f2a
              const VAULT_DEPLOYED_EVENT_SIGNATURE =
                "0xa225f10988fd8a4e80df4ed9fe9ddce048ffc02e51061eb4ceb5beb0c2ec4f2a";

              for (const log of receipt.logs) {
                // Check if this is a VaultDeployed event
                if (
                  log.topics[0]?.toLowerCase() === VAULT_DEPLOYED_EVENT_SIGNATURE.toLowerCase() &&
                  log.topics.length >= 4
                ) {
                  // Second topic (index 1) is the vault address
                  const topic1 = log.topics[1];
                  const topic3 = log.topics[3];

                  if (topic1 && topic3 && reserve) {
                    const vaultAddr = `0x${topic1.slice(-40)}`;
                    const underlying = `0x${topic3.slice(-40)}`;
                    const expectedUnderlying = reserve.underlyingToken.address.toLowerCase();
                    if (underlying.toLowerCase() === expectedUnderlying) {
                      vaultAddress = vaultAddr;
                      break;
                    }
                  }
                }
              }
            }

            setSubmitState({
              status: "success",
              txHash,
              vaultAddress,
              message: vaultAddress
                ? `Vault deployed successfully!`
                : "Vault deployment confirmed!",
            });

            // If vault address found, save it to localStorage
            if (vaultAddress && typeof window !== "undefined") {
              try {
                const stored = localStorage.getItem("deployedVaults");
                const existingVaults = stored ? JSON.parse(stored) : [];

                // Check if vault already exists
                const exists = existingVaults.some(
                  (v: { address: string }) => v.address.toLowerCase() === vaultAddress.toLowerCase()
                );

                if (!exists) {
                  const newVault = {
                    address: vaultAddress.toLowerCase(),
                    name: shareName || undefined,
                    transactionHash: txHash,
                    performanceFee: performanceFee, // Store performance fee for net APR calculation
                  };
                  localStorage.setItem(
                    "deployedVaults",
                    JSON.stringify([...existingVaults, newVault])
                  );
                }
              } catch (error) {
                console.warn("Could not save vault to localStorage:", error);
              }
            }

            showTxSuccessToast({
              title: "Vault deployed",
              description: vaultAddress
                ? `Vault is live at ${shortenAddress(vaultAddress)}. It will appear in your list below.`
                : "Transaction confirmed. View on Basescan for vault address.",
              txHash,
            });
            onSuccess?.(txHash, vaultAddress);
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = setTimeout(() => {
              closeTimeoutRef.current = null;
              handleCloseRef.current();
            }, 2000);
          } else {
            // Fallback if public client not available
            setSubmitState({
              status: "success",
              txHash,
              message:
                "Vault deployment transaction submitted. Check Basescan to find the vault address in the transaction logs.",
            });
            showTxSuccessToast({
              title: "Vault deployed",
              description: "Transaction confirmed. View on Basescan for vault address.",
              txHash,
            });
            onSuccess?.(txHash, undefined);
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = setTimeout(() => {
              closeTimeoutRef.current = null;
              handleCloseRef.current();
            }, 2000);
          }
        } catch (error) {
          // If we can't get the receipt, still show success with transaction hash
          console.warn("Could not get transaction receipt:", error);
          setSubmitState({
            status: "success",
            txHash,
            message:
              "Vault deployment transaction submitted. Check Basescan to find the vault address.",
          });
          showTxSuccessToast({
            title: "Vault deployed",
            description: "Transaction submitted. View on Basescan to find the vault address.",
            txHash,
          });
          onSuccess?.(txHash, undefined);
          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = setTimeout(() => {
            closeTimeoutRef.current = null;
            handleCloseRef.current();
          }, 2000);
        }
      } catch (outerError) {
        const message = normalizeTxErrorMessage(outerError, "Deployment failed");
        console.error("Vault deployment failed:", outerError);
        setSubmitState({
          status: "error",
          message: `Deployment failed: ${message}`,
          retryable: isTransientError(message),
        });
        showTxErrorToast({ title: "Vault deployment failed", description: message });
      }
    },
    [
      activeAddress,
      deployVault,
      initialDeposit,
      market,
      onSuccess,
      performanceFee,
      publicClient,
      recipients,
      reserve,
      sendTransaction,
      shareName,
      shareSymbol,
      validate,
      walletClient,
    ]
  );

  // Add helper function to handle number input with better mobile UX
  const handleNumberInputChange = useCallback(
    (value: string, setter: (val: number) => void, allowDecimal = false) => {
      // If empty, set to 0
      if (value === "" || value === "-") {
        setter(0);
        return;
      }

      // Remove any non-numeric characters (except decimal point if allowed)
      const cleaned = allowDecimal ? value.replace(/[^\d.]/g, "") : value.replace(/[^\d]/g, "");

      // Parse the number
      const num = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);

      if (!isNaN(num)) {
        setter(num);
      }
    },
    []
  );

  // Handle share symbol with preserved cursor position
  const handleShareSymbolChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const cursorPosition = input.selectionStart || 0;
    const newValue = event.target.value.toUpperCase();

    setShareSymbol(newValue);

    // Restore cursor position after state update
    setTimeout(() => {
      input.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  }, []);

  // Handle number input focus - select all for easy replacement
  const handleNumberFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  }, []);

  // Handle partner percent with smart replacement when value is 0
  const handlePartnerPercentChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      const currentValue = recipientInput.partnerPercent;

      // If current value is 0 and user types a digit, replace instead of append
      if (currentValue === 0 && value.length === 2 && value.startsWith("0")) {
        const newValue = parseInt(value.slice(1), 10);
        if (!isNaN(newValue)) {
          setRecipientInput((previous) => ({
            ...previous,
            partnerPercent: newValue,
          }));
          return;
        }
      }

      handleNumberInputChange(value, (num) => {
        setRecipientInput((previous) => ({
          ...previous,
          partnerPercent: num,
        }));
      });
    },
    [recipientInput.partnerPercent, handleNumberInputChange]
  );

  if (!open) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Deploy Aave ${assetSymbol} Vault`}
      showCloseButton
      className="max-w-2xl bg-white text-slate-900"
    >
      <form
        className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700"
        onSubmit={handleSubmit}
      >
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-base font-semibold text-slate-900">Vault Configuration</h4>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase">Share Name</span>
            <input
              value={shareName}
              onChange={(event) => setShareName(event.target.value)}
              onFocus={handleNumberFocus}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder={`Aave ${assetSymbol} Vault Shares`}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase">Share Symbol</span>
            <input
              value={shareSymbol}
              onChange={handleShareSymbolChange}
              onFocus={handleNumberFocus}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder={`av${assetSymbol}`}
              required
            />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase">Performance Fee</span>
              <input
                type="tel"
                inputMode="decimal"
                step="0.1"
                min={hasMembership ? 10 : 20}
                max={hasMembership ? 50 : 20}
                value={performanceFee}
                onChange={(event) => {
                  if (!hasMembership) return; // Non-member: read-only
                  const val = Number(event.target.value);
                  if (!Number.isNaN(val) && val >= 10) {
                    handleNumberInputChange(event.target.value, setPerformanceFee, true);
                  }
                }}
                onFocus={handleNumberFocus}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                disabled={!hasMembership}
                readOnly={!hasMembership}
                required
              />
              <span className="text-xs text-slate-500">
                {hasMembership
                  ? "Minimum 10%. Aave Labs automatically receives 50% of this fee."
                  : "Membership required to customize fees. Default: 20%."}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase">
                Initial Lock Deposit ({assetSymbol})
              </span>
              <input
                type="text"
                value={`0.01 ${assetSymbol}`}
                disabled
                className="cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500"
              />
              <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                0.01 {assetSymbol} is permanently locked in the vault and cannot be withdrawn. This
                is required by the Aave protocol to initialize the vault.
              </p>
            </label>
          </div>
        </section>

        {/* Fee Breakdown */}
        <FeeBreakdown performanceFee={performanceFee} hasMembership={hasMembership} />

        {/* Fee Receiver — only for Brand/Creator members */}
        {canSetFeeReceiver && (
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Fee Receiver</h4>
              <p className="text-xs text-slate-500">
                As a {tier} member, you can route your net performance fees to a custom address.
              </p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase">
                Fee Receiver Address
              </span>
              <input
                value={feeReceiverAddress}
                onChange={(event) => setFeeReceiverAddress(event.target.value)}
                onFocus={handleNumberFocus}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                placeholder={
                  activeAddress ? shortenAddress(activeAddress) + " (your wallet)" : "0x..."
                }
              />
              <span className="text-xs text-slate-500">
                Leave blank to receive fees at your connected wallet.
              </span>
            </label>
          </section>
        )}

        {/* Non-member treasury notice */}
        {!hasMembership && !membershipLoading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">Standard fee tier (20%)</p>
            <p className="mt-1 text-xs">
              Performance fees are routed to the Creative Bank Treasury. Unlock a membership to
              reduce fees to 10% and receive yield directly.
            </p>
          </div>
        )}

        {reserve ? (
          <section className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <h4 className="text-base font-semibold">Underlying Reserve</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="flex flex-col">
                <span className="text-xs text-emerald-700 uppercase">Market</span>
                <span className="font-medium">{reserve.market.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-emerald-700 uppercase">Supply APR</span>
                <span className="font-medium">{reserveApy}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-emerald-700 uppercase">Underlying Token</span>
                <span className="font-medium">{reserve.underlyingToken.symbol}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-emerald-700 uppercase">aToken</span>
                <span className="font-medium">{reserve.aToken.symbol}</span>
              </div>
            </div>
          </section>
        ) : null}

        {submitState.status === "deploying" && submitState.txHash && submitState.message ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {submitState.message}
            <a
              href={`https://basescan.org/tx/${submitState.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-block underline"
            >
              View on Basescan
            </a>
          </p>
        ) : null}

        {submitState.status === "error" && submitState.message ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{submitState.message}</p>
            {submitState.retryable && (
              <button
                type="submit"
                className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
              >
                Retry
              </button>
            )}
          </div>
        ) : null}

        {submitState.status === "success" && submitState.message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="mb-3 font-semibold">{submitState.message}</p>
            {submitState.vaultAddress ? (
              <div className="mt-2 space-y-2">
                <div>
                  <span className="font-medium">Vault Address: </span>
                  <a
                    href={`https://basescan.org/address/${submitState.vaultAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all underline"
                  >
                    {submitState.vaultAddress}
                  </a>
                </div>
                <p className="text-xs text-emerald-700">
                  Your vault is now live! You can interact with it using the vault address above.
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-2 text-xs text-emerald-700">
                <p className="font-medium">To find your vault address:</p>
                <ol className="ml-2 list-inside list-decimal space-y-1">
                  <li>
                    Click{" "}
                    <a
                      href={`https://basescan.org/tx/${submitState.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View Transaction on Basescan
                    </a>
                  </li>
                  <li>Go to the "Logs" tab in the transaction details</li>
                  <li>Look for a "VaultCreated" or "Deployed" event</li>
                  <li>The vault address will be in the event parameters</li>
                </ol>
                <p className="mt-2 text-emerald-600">
                  <strong>Note:</strong> The vault address is the contract that was created by this
                  transaction. It will appear as a new contract creation in the transaction logs.
                </p>
              </div>
            )}
            {submitState.txHash ? (
              <div className="mt-3 border-t border-emerald-300 pt-3">
                <a
                  href={`https://basescan.org/tx/${submitState.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium underline"
                >
                  View Transaction on Basescan →
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 md:flex-row md:flex-row-reverse md:justify-end">
          <button
            type="submit"
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
            disabled={isSubmitting}
            tabIndex={0}
            aria-label="Deploy vault"
          >
            {submitState.status === "approval"
              ? "Confirming Approval..."
              : isSubmitting
                ? "Deploying..."
                : "Deploy Vault"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            tabIndex={0}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
