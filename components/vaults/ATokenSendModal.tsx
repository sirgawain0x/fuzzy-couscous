"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { formatUnits, parseUnits, encodeFunctionData, isAddress, type Address } from "viem";
import { useWalletClient } from "wagmi";
import { useWallet, EVMWallet } from "@crossmint/client-sdk-react-ui";
import { appChain } from "@/lib/wagmiConfig";
import { Modal } from "@/components/common/Modal";
import {
  formatRecipientLabel,
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

const ERC20_TRANSFER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type ATokenSendModalProps = {
  open: boolean;
  onClose: () => void;
  aTokenAddress: Address;
  userAddress: `0x${string}`;
  balance: bigint;
  assetDecimals: number;
  onSuccess?: () => void;
};

export function ATokenSendModal({
  open,
  onClose,
  aTokenAddress,
  userAddress,
  balance,
  assetDecimals,
  onSuccess,
}: ATokenSendModalProps) {
  const { data: wagmiWalletClient } = useWalletClient();
  const { wallet: crossmintWallet } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendMax, setSendMax] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formattedBalance = formatUnits(balance, assetDecimals);
  const displayBalance = Number(formattedBalance).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  const sendAmount = useMemo(() => {
    if (sendMax) return balance;
    if (!amount) return 0n;
    try {
      return parseUnits(amount, assetDecimals);
    } catch {
      return 0n;
    }
  }, [sendMax, amount, balance, assetDecimals]);

  const isValidRecipient = isAddress(recipient.trim());
  const isValidAmount = sendAmount > 0n && sendAmount <= balance;

  const handleClose = useCallback(() => {
    setRecipient("");
    setAmount("");
    setSendMax(false);
    setError(null);
    onClose();
  }, [onClose]);

  const handleSend = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!isValidRecipient) {
        setError("Enter a valid Ethereum address (0x...)");
        return;
      }
      if (!isValidAmount) {
        setError("Enter a valid amount within your balance");
        return;
      }

      setLoading(true);
      try {
        const to = recipient.trim() as Address;
        let hash: string | undefined;

        if (crossmintWallet) {
          const evmWallet = EVMWallet.from(crossmintWallet);
          const result = await evmWallet.sendTransaction({
            to: aTokenAddress as `0x${string}`,
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [to as `0x${string}`, sendAmount],
          });
          hash = result.hash ?? undefined;
        } else if (wagmiWalletClient) {
          const data = encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [to, sendAmount],
          });
          hash = await wagmiWalletClient.sendTransaction({
            to: aTokenAddress,
            data,
            chain: appChain,
            account: userAddress,
          });
        } else {
          setError("No wallet connected");
          return;
        }

        const amountLabel = sendMax ? formattedBalance : amount;
        showTxSuccessToast({
          title: "Successfully sent",
          description: `Sent ${amountLabel} aBaseUSDC to ${formatRecipientLabel(to)}`,
          txHash: hash,
        });
        onSuccess?.();
        handleClose();
      } catch (err: unknown) {
        const message = normalizeTxErrorMessage(err, "Transfer failed");
        setError(message);
        showTxErrorToast({
          title:
            message === "Transaction was cancelled" ? "Transaction cancelled" : "Transfer failed",
          description: message,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      recipient,
      sendAmount,
      isValidRecipient,
      isValidAmount,
      crossmintWallet,
      wagmiWalletClient,
      aTokenAddress,
      userAddress,
      onSuccess,
      sendMax,
      formattedBalance,
      amount,
      handleClose,
    ]
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Send aBaseUSDC"
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <div className="mt-4 flex flex-col gap-4 text-sm">
        <form onSubmit={handleSend} className="flex flex-col gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Available: <strong>{displayBalance} aBaseUSDC</strong>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase">Recipient Address</span>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase">Amount</span>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={sendMax ? formattedBalance : amount}
                onChange={(e) => {
                  setSendMax(false);
                  setAmount(e.target.value);
                }}
                disabled={sendMax}
                placeholder="0.00"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setSendMax(!sendMax)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  sendMax
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Max
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isValidRecipient || !isValidAmount}
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
          >
            {loading ? "Sending..." : "Send aBaseUSDC"}
          </button>
        </form>
      </div>
    </Modal>
  );
}
