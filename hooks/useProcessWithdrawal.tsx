import { useEffect } from "react";
import { getTransactions } from "@/server-actions/getTransactions";
import { useBalance } from "./useBalance";
import { useActivityFeed } from "./useActivityFeed";
import type { AppWallet } from "@/hooks/useAppWallet";
import {
  formatRecipientLabel,
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

const getProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    return JSON.parse(processedTransactions)[transactionId] || false;
  }
  return false;
};

const setProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    const parsed = JSON.parse(processedTransactions);
    parsed[transactionId] = true;
    localStorage.setItem("processedTransactions", JSON.stringify(parsed));
  } else {
    localStorage.setItem("processedTransactions", JSON.stringify({ [transactionId]: true }));
  }
};

export function useProcessWithdrawal(walletAddress?: string, wallet?: AppWallet | null) {
  const { refetch: refetchBalance } = useBalance();
  const { refetch: refetchActivityFeed } = useActivityFeed();

  useEffect(() => {
    if (!walletAddress || !wallet) {
      return;
    }

    const processWithdrawal = async () => {
      try {
        const transactions = await getTransactions(walletAddress);

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
          return;
        }

        const pendingTransaction = transactions.find(
          (transaction) =>
            transaction?.status === "TRANSACTION_STATUS_STARTED" &&
            transaction?.transaction_id &&
            !getProccesedTransactions(transaction.transaction_id)
        );

        if (!pendingTransaction) return;

        setProccesedTransactions(pendingTransaction.transaction_id);

        try {
          const sendResult = await wallet.send(
            pendingTransaction.to_address,
            "usdc",
            pendingTransaction.sell_amount.value
          );

          const amount = pendingTransaction.sell_amount.value;
          showTxSuccessToast({
            title: "Withdrawal sent",
            description: `Sent $${amount} USDC to ${formatRecipientLabel(pendingTransaction.to_address)}`,
            txHash: sendResult?.hash,
            explorerLink: sendResult?.explorerLink,
          });

          await Promise.all([refetchBalance(), refetchActivityFeed()]);
        } catch (sendError) {
          const message = normalizeTxErrorMessage(sendError, "Withdrawal send failed");
          showTxErrorToast({
            title:
              message === "Transaction was cancelled"
                ? "Transaction cancelled"
                : "Withdrawal failed",
            description: message,
          });
          throw sendError;
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("credentials") || error.message.includes("API keys")) {
            return;
          }
          if (error.message.includes("production") || error.message.includes("enabled")) {
            return;
          }
          if (error.message.includes("network") || error.message.includes("fetch")) {
            return;
          }
        }
        console.warn("Unexpected error in withdrawal processing:", error);
      }
    };

    void processWithdrawal();
  }, [walletAddress, wallet, refetchBalance, refetchActivityFeed]);
}
